import { query } from '../lib/db';

let interval: NodeJS.Timeout | null = null;

export async function purgeExpiredDirectMessages(): Promise<void> {
  await query('DELETE FROM direct_messages WHERE expires_at <= NOW()');
  await query(`DELETE FROM direct_conversations c WHERE c.created_at < NOW() - INTERVAL '30 days'
    AND NOT EXISTS (SELECT 1 FROM direct_messages m WHERE m.conversation_id = c.id)`);
}

export function startDirectMessageRetentionJob(): void {
  if (interval) return;
  void purgeExpiredDirectMessages().catch((error) => console.error('[directMessageRetentionJob]', error));
  interval = setInterval(() => {
    void purgeExpiredDirectMessages().catch((error) => console.error('[directMessageRetentionJob]', error));
  }, 3_600_000);
  interval.unref();
}

export function stopDirectMessageRetentionJob(): void {
  if (interval) clearInterval(interval);
  interval = null;
}
