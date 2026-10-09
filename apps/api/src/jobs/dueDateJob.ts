// apps/api/src/jobs/dueDateJob.ts
// Cron job: notificaciones de fechas de vencimiento de tarjetas

import { pool } from '../lib/db';
import { notificationService } from '../services/NotificationService';

let jobInterval: NodeJS.Timeout | null = null;

/**
 * Envía un único aviso de plazo por tarjeta/usuario/fecha.
 * Una asignación reciente ya genera su propio aviso, por lo que no se envía
 * además un recordatorio de vencimiento inmediato.
 */
async function runDueDateCheck(): Promise<void> {
  try {
    // Un recordatorio dentro de las últimas 24h, solo para asignaciones con
    // al menos 24h de antigüedad y mientras falten 2h o más para vencer.
    const dueSoonResult = await pool.query(
      `SELECT
         c.id        AS card_id,
         c.title     AS card_title,
         c.due_date,
         cm.user_id,
         l.board_id
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       JOIN card_members cm ON cm.card_id = c.id
       WHERE c.completed = false
         AND b.archived = false
         AND c.due_date IS NOT NULL
         AND c.due_date > NOW() + INTERVAL '2 hours'
         AND c.due_date <= NOW() + INTERVAL '24 hours'
         AND cm.assigned_at <= NOW() - INTERVAL '24 hours'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = cm.user_id
             AND n.dedupe_key = 'card-deadline:' || c.id::text || ':' || TO_CHAR(c.due_date, 'YYYY-MM-DD')
         )`
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

    // Si no hubo recordatorio previo, avisar una vez entre 2h y 24h después
    // del vencimiento. No inundar la bandeja con tareas antiguas al reiniciar.
    // La clave compartida en NotificationService impide un segundo aviso.
    const overdueResult = await pool.query(
      `SELECT
         c.id        AS card_id,
         c.title     AS card_title,
         c.due_date,
         cm.user_id,
         l.board_id
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       JOIN boards b ON b.id = l.board_id
       JOIN card_members cm ON cm.card_id = c.id
       WHERE c.completed = false
         AND b.archived = false
         AND c.due_date IS NOT NULL
         AND c.due_date <= NOW() - INTERVAL '2 hours'
         AND c.due_date > NOW() - INTERVAL '24 hours'
         AND cm.assigned_at <= NOW() - INTERVAL '2 hours'
         AND NOT EXISTS (
           SELECT 1 FROM notifications n
           WHERE n.user_id = cm.user_id
             AND n.dedupe_key = 'card-deadline:' || c.id::text || ':' || TO_CHAR(c.due_date, 'YYYY-MM-DD')
         )`
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
