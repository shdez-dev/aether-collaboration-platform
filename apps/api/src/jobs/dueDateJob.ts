// apps/api/src/jobs/dueDateJob.ts
// Cron job: notificaciones de fechas de vencimiento de tarjetas

import { pool } from '../lib/db';
import { notificationService } from '../services/NotificationService';

let jobInterval: NodeJS.Timeout | null = null;

/**
 * Busca tarjetas que vencen en las próximas 48h o ya vencieron
 * y envía notificaciones a los miembros asignados.
 */
async function runDueDateCheck(): Promise<void> {
  try {
    // Tarjetas que vencen en las próximas 48 horas (no completadas, no archivadas)
    const dueSoonResult = await pool.query(
      `SELECT
         c.id        AS card_id,
         c.title     AS card_title,
         c.due_date,
         cm.user_id,
         l.board_id
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       JOIN card_members cm ON cm.card_id = c.id
       WHERE c.completed = false
         AND c.due_date IS NOT NULL
         AND c.due_date > NOW()
         AND c.due_date <= NOW() + INTERVAL '48 hours'`
    );

    for (const row of dueSoonResult.rows) {
      try {
        await notificationService.createCardDueSoonNotification({
          userId: row.user_id,
          cardId: row.card_id,
          cardTitle: row.card_title,
          dueDate: new Date(row.due_date),
          boardId: row.board_id,
        });
      } catch {}
    }

    // Tarjetas ya vencidas
    const overdueResult = await pool.query(
      `SELECT
         c.id        AS card_id,
         c.title     AS card_title,
         c.due_date,
         cm.user_id,
         l.board_id
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       JOIN card_members cm ON cm.card_id = c.id
       WHERE c.completed = false
         AND c.due_date IS NOT NULL
         AND c.due_date < NOW()`
    );

    for (const row of overdueResult.rows) {
      try {
        await notificationService.createCardOverdueNotification({
          userId: row.user_id,
          cardId: row.card_id,
          cardTitle: row.card_title,
          dueDate: new Date(row.due_date),
          boardId: row.board_id,
        });
      } catch {}
    }
  } catch (error) {
    console.error('[dueDateJob] Error en verificación de fechas:', error);
  }
}

/**
 * Inicia el cron job — se ejecuta cada hora
 */
export function startDueDateJob(): void {
  // Ejecutar inmediatamente al inicio
  runDueDateCheck();

  // Repetir cada hora (3600000 ms)
  jobInterval = setInterval(runDueDateCheck, 3_600_000);
  console.log('[dueDateJob] Cron job iniciado — verificación cada hora');
}

/**
 * Detiene el cron job (para graceful shutdown)
 */
export function stopDueDateJob(): void {
  if (jobInterval) {
    clearInterval(jobInterval);
    jobInterval = null;
  }
}
