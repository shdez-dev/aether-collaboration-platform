// apps/api/src/controllers/WorkspaceGithubController.ts

import { Request, Response } from 'express';
import { pool } from '../lib/db';
import crypto from 'crypto';

// ── helpers ──────────────────────────────────────────────────────────────────

async function githubFetch(path: string, token: string, opts: RequestInit = {}) {
  return fetch(`https://api.github.com${path}`, {
    ...opts,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'Aether-App',
      ...(opts.headers ?? {}),
    },
  });
}

function generateSecret(): string {
  return crypto.randomBytes(32).toString('hex');
}

// ── controller ───────────────────────────────────────────────────────────────

export class WorkspaceGithubController {
  /**
   * GET /api/workspaces/:id/github
   * Devuelve el estado de la conexión (nunca expone el token en claro)
   */
  async getConnection(req: Request, res: Response): Promise<void> {
    const { id: workspaceId } = req.params;

    const r = await pool.query(
      `SELECT github_login, repos, created_at, connected_by FROM workspace_github_connections WHERE workspace_id = $1`,
      [workspaceId],
    );

    if (r.rows.length === 0) {
      res.json({ success: true, data: null });
      return;
    }

    const row = r.rows[0];
    res.json({
      success: true,
      data: {
        githubLogin: row.github_login,
        repos: row.repos ?? [],
        connectedAt: row.created_at,
      },
    });
  }

  /**
   * GET /api/workspaces/:id/github/repos
   * Lista los repos accesibles con el token guardado
   */
  async listRepos(req: Request, res: Response): Promise<void> {
    const { id: workspaceId } = req.params;

    const r = await pool.query(
      `SELECT github_token FROM workspace_github_connections WHERE workspace_id = $1`,
      [workspaceId],
    );

    // Si no hay conexión, usa el token del body (paso de validación antes de guardar)
    const token = r.rows[0]?.github_token ?? (req.query.token as string | undefined);
    if (!token) {
      res.status(400).json({ success: false, error: { code: 'NO_TOKEN', message: 'Token requerido' } });
      return;
    }

    const resp = await githubFetch('/user/repos?per_page=100&sort=pushed&visibility=all', token);
    if (!resp.ok) {
      res.status(resp.status === 401 ? 401 : 502).json({
        success: false,
        error: { code: resp.status === 401 ? 'GITHUB_TOKEN_INVALID' : 'GITHUB_ERROR', message: 'Error al listar repos' },
      });
      return;
    }

    const repos = await resp.json() as any[];
    res.json({
      success: true,
      data: repos.map((r) => ({ fullName: r.full_name, private: r.private, url: r.html_url })),
    });
  }

  /**
   * POST /api/workspaces/:id/github
   * Conecta GitHub: valida token, guarda conexión, registra webhooks en los repos seleccionados
   */
  async connect(req: Request, res: Response): Promise<void> {
    const { id: workspaceId } = req.params;
    const userId = req.user?.id;
    const { githubToken, repos } = req.body as { githubToken: string; repos: string[] };

    if (!githubToken?.trim()) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'githubToken requerido' } });
      return;
    }
    if (!Array.isArray(repos) || repos.length === 0) {
      res.status(400).json({ success: false, error: { code: 'BAD_REQUEST', message: 'Selecciona al menos un repo' } });
      return;
    }

    // 1. Validar token con GitHub
    const userResp = await githubFetch('/user', githubToken);
    if (!userResp.ok) {
      res.status(400).json({ success: false, error: { code: 'GITHUB_TOKEN_INVALID', message: 'Token de GitHub inválido' } });
      return;
    }
    const ghUser: any = await userResp.json();

    // 2. Generar webhook secret
    const webhookSecret = generateSecret();

    // 3. Construir URL del webhook
    const apiBase = process.env.API_PUBLIC_URL ?? process.env.BACKEND_URL ?? '';
    const webhookUrl = `${apiBase}/api/webhooks/github/${workspaceId}`;

    // 4. Registrar webhook en cada repo (best-effort — puede fallar en repos sin permisos admin)
    const webhookErrors: string[] = [];
    if (apiBase) {
      for (const repo of repos) {
        try {
          const hookResp = await githubFetch(`/repos/${repo}/hooks`, githubToken, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: 'web',
              active: true,
              events: ['push', 'pull_request', 'pull_request_review', 'create', 'delete'],
              config: {
                url: webhookUrl,
                content_type: 'json',
                secret: webhookSecret,
                insecure_ssl: '0',
              },
            }),
          });
          if (!hookResp.ok && hookResp.status !== 422) {
            // 422 = webhook ya existe
            webhookErrors.push(repo);
          }
        } catch {
          webhookErrors.push(repo);
        }
      }
    }

    // 5. Guardar en DB (upsert)
    await pool.query(
      `INSERT INTO workspace_github_connections (workspace_id, github_token, repos, webhook_secret, github_login, connected_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (workspace_id) DO UPDATE SET
         github_token   = EXCLUDED.github_token,
         repos          = EXCLUDED.repos,
         webhook_secret = EXCLUDED.webhook_secret,
         github_login   = EXCLUDED.github_login,
         connected_by   = EXCLUDED.connected_by,
         updated_at     = NOW()`,
      [workspaceId, githubToken, repos, webhookSecret, ghUser.login, userId],
    );

    res.json({
      success: true,
      data: {
        githubLogin: ghUser.login,
        repos,
        webhookErrors,
        webhookUrl: apiBase ? webhookUrl : null,
      },
    });
  }

  /**
   * DELETE /api/workspaces/:id/github
   * Desconecta GitHub: elimina webhooks y borra la fila
   */
  async disconnect(req: Request, res: Response): Promise<void> {
    const { id: workspaceId } = req.params;

    const r = await pool.query(
      `SELECT github_token, repos FROM workspace_github_connections WHERE workspace_id = $1`,
      [workspaceId],
    );

    if (r.rows.length === 0) {
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Sin conexión de GitHub' } });
      return;
    }

    const { github_token: token, repos } = r.rows[0];

    // Eliminar webhooks de GitHub (best-effort)
    for (const repo of (repos as string[])) {
      try {
        // Listar hooks y eliminar el que apunte a este workspace
        const hooksResp = await githubFetch(`/repos/${repo}/hooks`, token);
        if (hooksResp.ok) {
          const hooks = await hooksResp.json() as any[];
          for (const hook of hooks) {
            if (hook.config?.url?.includes(`/api/webhooks/github/${workspaceId}`)) {
              await githubFetch(`/repos/${repo}/hooks/${hook.id}`, token, { method: 'DELETE' });
            }
          }
        }
      } catch { /* best-effort */ }
    }

    await pool.query(`DELETE FROM workspace_github_connections WHERE workspace_id = $1`, [workspaceId]);
    res.json({ success: true });
  }
}

export const workspaceGithubController = new WorkspaceGithubController();
