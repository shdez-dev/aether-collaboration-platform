import bcrypt from 'bcrypt';
import { randomBytes } from 'node:crypto';
import type { PoolClient } from 'pg';
import { pool } from '../lib/db';
import { storageService } from './StorageService';
import { invalidateUserSockets } from '../websocket/RealtimeGateway';
import { emailService } from './EmailService';

const SYSTEM_USER_ID = '00000000-0000-4000-8000-000000000001';
const BATCH_SIZE = 100;

type Blocker = { type: 'organization' | 'workspace' | 'project'; id: string; name: string };
type Queryable = Pick<PoolClient, 'query'>;

function quote(identifier: string): string {
  return `"${identifier.replace(/"/g, '""')}"`;
}

async function blockers(db: Queryable, userId: string): Promise<Blocker[]> {
  const result = await db.query(
    `SELECT 'organization' AS type, o.id, o.name FROM organizations o
       WHERE o.owner_user_id = $1 AND (
         o.type <> 'PERSONAL'
         OR EXISTS (SELECT 1 FROM workspaces w WHERE w.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM portfolios p WHERE p.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM networks n WHERE n.owner_organization_id = o.id)
         OR EXISTS (SELECT 1 FROM network_organizations no WHERE no.organization_id = o.id)
         OR EXISTS (SELECT 1 FROM organization_members om WHERE om.organization_id = o.id AND om.user_id <> $1)
       )
     UNION ALL
     SELECT 'workspace', w.id, w.name FROM workspaces w WHERE w.owner_id = $1
     UNION ALL
     SELECT 'project', p.id, p.name FROM projects p WHERE p.owner_id = $1`,
    [userId]
  );
  return result.rows as Blocker[];
}

export class AccountDeletionError extends Error {
  constructor(public code: string, message: string, public status = 400, public blockers: Blocker[] = []) {
    super(message);
  }
}

export async function getAccountDeletionBlockers(userId: string): Promise<Blocker[]> {
  return blockers(pool, userId);
}

export async function requestAccountDeletion(userId: string, password: string): Promise<string> {
  const client = await pool.connect();
  let recipient = '';
  let receiptId = '';
  try {
    await client.query('BEGIN');
    const user = await client.query('SELECT email, password, deletion_requested_at FROM users WHERE id = $1 FOR UPDATE', [userId]);
    if (!user.rows[0] || user.rows[0].deletion_requested_at) {
      throw new AccountDeletionError('ACCOUNT_UNAVAILABLE', 'La cuenta ya no está disponible.', 409);
    }
    if (!await bcrypt.compare(password, user.rows[0].password)) {
      throw new AccountDeletionError('INVALID_PASSWORD', 'La contraseña no es correcta.', 403);
    }
    const pending = await blockers(client, userId);
    if (pending.length) {
      throw new AccountDeletionError('OWNERSHIP_TRANSFER_REQUIRED', 'Transfiere o elimina los espacios y proyectos que administras antes de eliminar tu cuenta.', 409, pending);
    }
    await client.query('UPDATE users SET deletion_requested_at = NOW() WHERE id = $1', [userId]);
    const receipt = await client.query('INSERT INTO account_deletion_jobs (user_id) VALUES ($1) RETURNING id', [userId]);
    receiptId = receipt.rows[0].id;
    await client.query('COMMIT');
    recipient = user.rows[0].email;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
  await invalidateUserSockets(userId).catch((error) => console.error('[accountDeletion] socket invalidation:', error));
  await emailService.sendEmail({
    to: recipient,
    subject: 'Recibimos tu solicitud de eliminación | AETHER',
    html: `<p>Recibimos tu solicitud de eliminación de cuenta en AETHER. Tu acceso ha sido desactivado. Procesaremos tus datos por etapas.</p><p>Número de solicitud: <strong>${receiptId}</strong>.</p><p>Para consultar su estado o solicitar revisión de contenido compartido, escribe a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>.</p>`,
    text: `Recibimos tu solicitud de eliminación de cuenta en AETHER. Tu acceso ha sido desactivado. Procesaremos tus datos por etapas. Número de solicitud: ${receiptId}. Para consultar su estado o solicitar revisión de contenido compartido, escribe a sebastian@shernandez.dev.`,
  }).catch((error) => console.error('[accountDeletion] receipt email:', error));
  return receiptId;
}

type ForeignKey = { schema_name: string; table_name: string; column_name: string; nullable: boolean; action: string };

async function foreignKeys(client: PoolClient): Promise<ForeignKey[]> {
  const result = await client.query<ForeignKey>(
    `SELECT ns.nspname AS schema_name, cls.relname AS table_name, att.attname AS column_name,
            NOT att.attnotnull AS nullable, con.confdeltype AS action
       FROM pg_constraint con
       JOIN pg_class cls ON cls.oid = con.conrelid
       JOIN pg_namespace ns ON ns.oid = cls.relnamespace
       JOIN pg_attribute att ON att.attrelid = con.conrelid AND att.attnum = con.conkey[1]
      WHERE con.contype = 'f' AND con.confrelid = 'users'::regclass
        AND cardinality(con.conkey) = 1 AND ns.nspname = 'public'
      ORDER BY cls.relname, att.attname`
  );
  return result.rows;
}

async function batchDelete(client: PoolClient, table: string, column: string, userId: string): Promise<number> {
  const result = await client.query(
    `WITH target AS (SELECT ctid FROM ${table} WHERE ${quote(column)} = $1 LIMIT $2 FOR UPDATE)
     DELETE FROM ${table} row USING target WHERE row.ctid = target.ctid`,
    [userId, BATCH_SIZE]
  );
  return result.rowCount ?? 0;
}

async function batchReplace(client: PoolClient, table: string, column: string, userId: string, replacement: string | null): Promise<number> {
  const result = await client.query(
    `WITH target AS (SELECT ctid FROM ${table} WHERE ${quote(column)} = $1 LIMIT $3 FOR UPDATE)
     UPDATE ${table} row SET ${quote(column)} = $2 FROM target WHERE row.ctid = target.ctid`,
    [userId, replacement, BATCH_SIZE]
  );
  return result.rowCount ?? 0;
}

// Estas tablas conservan trabajo de otros integrantes. Su autor pasa a ser una
// identidad técnica cerrada, sin correo ni credenciales del antiguo usuario.
const SHARED_CONTENT = new Set(['boards', 'lists', 'cards', 'teams', 'calendar_events']);
const UNLINKED: Array<{ table: string; column: string; mode: 'delete' | 'deleteEmail' | 'replace' | 'clear' | 'event' | 'decision' | 'mention' | 'privateCalendar' }> = [
  { table: 'calendar_events', column: 'created_by', mode: 'privateCalendar' },
  { table: 'platform_invitations', column: 'email', mode: 'deleteEmail' },
  { table: 'organization_invitations', column: 'email', mode: 'deleteEmail' },
  { table: 'document_permissions', column: 'user_id', mode: 'delete' },
  { table: 'document_comments', column: 'user_id', mode: 'delete' },
  { table: 'documents', column: 'created_by', mode: 'replace' },
  { table: 'document_versions', column: 'created_by', mode: 'replace' },
  { table: 'workspace_project_standards', column: 'created_by', mode: 'clear' },
  { table: 'card_checklist_items', column: 'created_by', mode: 'clear' },
  { table: 'card_dependencies', column: 'created_by', mode: 'replace' },
  { table: 'project_document_profiles', column: 'updated_by', mode: 'clear' },
  { table: 'project_evidence_links', column: 'created_by', mode: 'clear' },
  { table: 'board_sprints', column: 'created_by', mode: 'replace' },
  { table: 'board_milestones', column: 'created_by', mode: 'replace' },
  { table: 'project_epics', column: 'created_by', mode: 'clear' },
  { table: 'portfolios', column: 'created_by', mode: 'clear' },
  { table: 'institutional_organization_settings', column: 'updated_by', mode: 'clear' },
  { table: 'team_organization_settings', column: 'updated_by', mode: 'clear' },
  { table: 'events', column: 'actor_id', mode: 'event' },
  { table: 'events', column: 'subject_id', mode: 'event' },
  { table: 'project_decisions', column: 'actor_id', mode: 'decision' },
  { table: 'project_workflow_history', column: 'actor_id', mode: 'clear' },
  { table: 'initiative_workflow_history', column: 'actor_id', mode: 'clear' },
  { table: 'initiative_content_history', column: 'actor_id', mode: 'clear' },
  { table: 'institutional_organization_settings_history', column: 'actor_id', mode: 'clear' },
  { table: 'comments', column: 'mentions', mode: 'mention' },
];

async function ensureSystemUser(client: PoolClient): Promise<void> {
  const existing = await client.query('SELECT 1 FROM users WHERE id = $1', [SYSTEM_USER_ID]);
  if (existing.rows.length) return;
  const password = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
  await client.query(
    `INSERT INTO users (id, email, password, name, email_verified, deletion_requested_at, created_at, updated_at)
     VALUES ($1, 'deleted-account@internal.aether.invalid', $2, 'Cuenta eliminada', false, NOW(), NOW(), NOW())
     ON CONFLICT (id) DO NOTHING`,
    [SYSTEM_USER_ID, password]
  );
}

async function processOneBatch(client: PoolClient, userId: string, email: string, step: number): Promise<{ done: boolean; nextStep: number }> {
  // Mensajes privados antes que la conversación para evitar una cascada grande.
  if (step === 0) {
    const result = await client.query(
      `WITH target AS (SELECT dm.id FROM direct_messages dm JOIN direct_conversations dc ON dc.id = dm.conversation_id
        WHERE dc.user_a_id = $1 OR dc.user_b_id = $1 LIMIT $2 FOR UPDATE OF dm)
       DELETE FROM direct_messages dm USING target WHERE dm.id = target.id`,
      [userId, BATCH_SIZE]
    );
    return { done: false, nextStep: step + ((result.rowCount ?? 0) === 0 ? 1 : 0) };
  }
  if (step <= UNLINKED.length) {
    const target = UNLINKED[step - 1];
    const table = quote(target.table);
    let count: number;
    if (target.mode === 'privateCalendar') {
      const result = await client.query(
        `WITH target AS (SELECT ce.id FROM calendar_events ce
           WHERE ce.created_by = $1 AND ce.type = 'personal'
             AND NOT EXISTS (SELECT 1 FROM calendar_event_attendees a WHERE a.event_id = ce.id AND a.user_id <> $1)
             AND NOT EXISTS (SELECT 1 FROM calendar_event_invitations i WHERE i.event_id = ce.id AND i.user_id <> $1)
           LIMIT $2 FOR UPDATE OF ce)
         DELETE FROM calendar_events ce USING target WHERE ce.id = target.id`,
        [userId, BATCH_SIZE]
      );
      count = result.rowCount ?? 0;
    } else if (target.mode === 'delete' || target.mode === 'deleteEmail') count = await batchDelete(client, table, target.column, target.mode === 'deleteEmail' ? email : userId);
    else if (target.mode === 'replace' || target.mode === 'clear') {
      count = await batchReplace(client, table, target.column, userId, target.mode === 'clear' ? null : SYSTEM_USER_ID);
    } else if (target.mode === 'mention') {
      const result = await client.query(
        `WITH target AS (SELECT ctid FROM comments WHERE $1::uuid = ANY(mentions) LIMIT $2 FOR UPDATE)
         UPDATE comments row SET mentions = array_remove(row.mentions, $1::uuid) FROM target WHERE row.ctid = target.ctid`,
        [userId, BATCH_SIZE]
      );
      count = result.rowCount ?? 0;
    } else {
      const nameColumn = target.mode === 'event' ? (target.column === 'actor_id' ? 'actor_name' : 'subject_name') : 'actor_name';
      const idReplacement = target.mode === 'event' ? SYSTEM_USER_ID : null;
      const result = await client.query(
        `WITH target AS (SELECT ctid FROM ${table} WHERE ${quote(target.column)} = $1 LIMIT $3 FOR UPDATE)
         UPDATE ${table} row SET ${quote(target.column)} = $2, ${quote(nameColumn)} = 'Cuenta eliminada'
         FROM target WHERE row.ctid = target.ctid`,
        [userId, idReplacement, BATCH_SIZE]
      );
      count = result.rowCount ?? 0;
    }
    return { done: false, nextStep: step + (count === 0 ? 1 : 0) };
  }
  const keys = await foreignKeys(client);
  const fkIndex = step - UNLINKED.length - 1;
  if (fkIndex < keys.length) {
    const fk = keys[fkIndex];
    const table = `${quote(fk.schema_name)}.${quote(fk.table_name)}`;
    const preserve = SHARED_CONTENT.has(fk.table_name) || (fk.action !== 'c' && !fk.nullable);
    const count = preserve
      ? await batchReplace(client, table, fk.column_name, userId, SYSTEM_USER_ID)
      : fk.action === 'c'
        ? await batchDelete(client, table, fk.column_name, userId)
        : await batchReplace(client, table, fk.column_name, userId, null);
    return { done: false, nextStep: step + (count === 0 ? 1 : 0) };
  }

  // Una organización personal vacía es la única propiedad que se elimina aquí.
  // Las demás se transfieren o eliminan antes de aceptar la solicitud.
  const owned = await blockers(client, userId);
  if (owned.length) throw new Error('Account acquired owned resources while deletion was pending');
  const invitations = await client.query(
    `WITH target AS (
       SELECT oi.id FROM organization_invitations oi
       JOIN organizations o ON o.id = oi.organization_id
       WHERE o.owner_user_id = $1 AND o.type = 'PERSONAL'
       LIMIT $2 FOR UPDATE OF oi
     ) DELETE FROM organization_invitations oi USING target WHERE oi.id = target.id`,
    [userId, BATCH_SIZE]
  );
  if ((invitations.rowCount ?? 0) > 0) return { done: false, nextStep: step };
  for (let index = 0; index < keys.length; index += 1) {
    const fk = keys[index];
    const table = `${quote(fk.schema_name)}.${quote(fk.table_name)}`;
    const remaining = await client.query(`SELECT 1 FROM ${table} WHERE ${quote(fk.column_name)} = $1 LIMIT 1`, [userId]);
    if (remaining.rows.length) return { done: false, nextStep: UNLINKED.length + 1 + index };
  }
  await client.query(`DELETE FROM organizations WHERE owner_user_id = $1 AND type = 'PERSONAL'`, [userId]);
  await client.query('DELETE FROM users WHERE id = $1', [userId]);
  return { done: true, nextStep: step };
}

let running = false;
export async function runAccountDeletionBatch(): Promise<void> {
  if (running) return;
  running = true;
  const client = await pool.connect().catch((error) => { running = false; throw error; });
  let jobId: string | undefined;
  try {
    await client.query('BEGIN');
    await client.query("SET LOCAL lock_timeout = '2s'");
    await client.query("SET LOCAL statement_timeout = '5s'");
    // Una sola instancia procesa un lote a la vez, incluso con varias réplicas.
    const leader = await client.query('SELECT pg_try_advisory_xact_lock(72171921) AS acquired');
    if (!leader.rows[0]?.acquired) { await client.query('COMMIT'); return; }
    const claimed = await client.query(
      `SELECT id, user_id, attempts, COALESCE(step, 0) AS step FROM account_deletion_jobs
        WHERE status = 'PENDING' AND next_run_at <= NOW()
        ORDER BY requested_at LIMIT 1 FOR UPDATE SKIP LOCKED`
    );
    const job = claimed.rows[0];
    if (!job) { await client.query('COMMIT'); return; }
    jobId = job.id;
    const user = await client.query('SELECT email, avatar, deletion_requested_at FROM users WHERE id = $1', [job.user_id]);
    if (!user.rows[0]?.deletion_requested_at) throw new Error('Deletion job has no inactive account');
    if (job.step === 0 && user.rows[0].avatar) {
      await storageService.deleteByUrl(user.rows[0].avatar);
      await client.query('UPDATE users SET avatar = NULL WHERE id = $1', [job.user_id]);
    }
    if (job.step <= UNLINKED.length + 1) await ensureSystemUser(client);
    const result = await processOneBatch(client, job.user_id, user.rows[0].email, job.step);
    await client.query(
      `UPDATE account_deletion_jobs SET step = $2, status = $3, user_id = CASE WHEN $4 THEN NULL ELSE user_id END,
       completed_at = CASE WHEN $4 THEN NOW() ELSE NULL END, next_run_at = NOW() + INTERVAL '1 second',
       attempts = 0, last_error = NULL WHERE id = $1`,
      [job.id, result.nextStep, result.done ? 'COMPLETED' : 'PENDING', result.done]
    );
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (jobId) {
      await pool.query(
        `UPDATE account_deletion_jobs SET attempts = attempts + 1,
         next_run_at = NOW() + make_interval(secs => LEAST(3600, POWER(2, LEAST(attempts + 1, 11)))::int),
         last_error = $2 WHERE id = $1`,
        [jobId, error instanceof Error ? error.message.slice(0, 1000) : 'Unknown error']
      ).catch(() => {});
    }
    console.error('[accountDeletion] batch failed:', error);
  } finally {
    client.release();
    running = false;
  }
}
