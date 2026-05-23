// apps/api/src/routes/github_webhook.ts
// Receives GitHub webhook events and converts them to internal activity events.
// This route uses express.raw() — must be registered BEFORE express.json().

import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { pool } from '../lib/db';
import { eventStore } from '../services/EventStoreService';
import type { GithubEventType } from '@aether/types';

const router = Router();

// ── HMAC verification ────────────────────────────────────────────────────────

function verifySignature(rawBody: Buffer, secret: string, signature: string): boolean {
  const expected = `sha256=${crypto.createHmac('sha256', secret).update(rawBody).digest('hex')}`;
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
  } catch {
    return false;
  }
}

// ── payload → internal event mapper ─────────────────────────────────────────

interface MappedEvent {
  type: GithubEventType;
  payload: Record<string, unknown>;
}

function mapGithubEvent(ghEvent: string, body: any): MappedEvent | null {
  const repo: string = body.repository?.full_name ?? '';

  if (ghEvent === 'push') {
    const branch: string = (body.ref as string)?.replace('refs/heads/', '') ?? '';
    const commits: any[] = body.commits ?? [];
    return {
      type: 'github.push.received',
      payload: {
        repo,
        branch,
        commits: commits.slice(0, 5).map((c: any) => ({
          sha: (c.id as string)?.slice(0, 7),
          message: c.message?.split('\n')[0],
          author: c.author?.name,
          url: c.url,
        })),
        pusher: body.pusher?.name,
        compareUrl: body.compare,
      },
    };
  }

  if (ghEvent === 'pull_request') {
    const action: string = body.action;
    const pr = body.pull_request;
    const base: MappedEvent['payload'] = {
      repo,
      prNumber: pr?.number,
      title: pr?.title,
      url: pr?.html_url,
      author: pr?.user?.login,
      authorAvatar: pr?.user?.avatar_url,
      draft: pr?.draft,
      base: pr?.base?.ref,
      head: pr?.head?.ref,
    };

    if (action === 'opened' || action === 'reopened') {
      return { type: 'github.pr.opened', payload: base };
    }
    if (action === 'closed') {
      return {
        type: pr?.merged ? 'github.pr.merged' : 'github.pr.closed',
        payload: { ...base, mergedBy: pr?.merged_by?.login },
      };
    }
    return null;
  }

  if (ghEvent === 'pull_request_review') {
    // No está en el catálogo canónico de eventos
    return null;
  }

  return null;
}

// ── route ────────────────────────────────────────────────────────────────────

router.post('/:workspaceId', async (req: Request, res: Response) => {
  const { workspaceId } = req.params;
  const rawBody = req.body as Buffer;
  const signature = req.headers['x-hub-signature-256'] as string | undefined;
  const ghEvent = req.headers['x-github-event'] as string | undefined;

  if (!signature || !ghEvent) {
    res.status(400).json({ error: 'Missing GitHub headers' });
    return;
  }

  // Look up workspace connection
  const connR = await pool.query(
    `SELECT webhook_secret, connected_by FROM workspace_github_connections WHERE workspace_id = $1`,
    [workspaceId],
  );
  if (connR.rows.length === 0) {
    res.status(404).json({ error: 'Workspace not found or GitHub not connected' });
    return;
  }

  const { webhook_secret: secret, connected_by: connectedBy } = connR.rows[0];

  if (!verifySignature(rawBody, secret, signature)) {
    res.status(401).json({ error: 'Invalid signature' });
    return;
  }

  let body: any;
  try {
    body = JSON.parse(rawBody.toString('utf-8'));
  } catch {
    res.status(400).json({ error: 'Invalid JSON' });
    return;
  }

  // Map to internal event
  const mapped = mapGithubEvent(ghEvent, body);
  if (!mapped) {
    // Unsupported event — acknowledge silently
    res.status(200).json({ ok: true });
    return;
  }

  // Emit event into the system using the connected user as the actor
  const actorResult = await pool.query('SELECT name FROM users WHERE id = $1', [connectedBy]);
  const actorName = actorResult.rows[0]?.name ?? 'GitHub';

  await eventStore.emit({
    type: mapped.type as any,
    actor: { id: connectedBy, name: actorName },
    subject: { type: 'repository', id: String(mapped.payload.repo ?? ''), name: String(mapped.payload.repo ?? '') },
    context: { workspaceId },
    payload: mapped.payload,
  } as any);

  res.status(200).json({ ok: true });
});

export default router;
