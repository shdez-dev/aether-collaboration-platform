import { pool } from '../lib/db';
import type { PoolClient } from 'pg';
import { capabilityService, type CapabilityQueryExecutor } from './CapabilityService';

// The plan catalog presents storage using decimal MB/GB (10,000 MB = 10 GB).
const BYTES_PER_MB = 1_000_000n;

export class OrganizationStorageLimitError extends Error {
  readonly code = 'ORGANIZATION_STORAGE_LIMIT_REACHED';

  constructor(
    public readonly usedBytes: bigint,
    public readonly limitBytes: bigint,
  ) {
    super('El espacio de almacenamiento de la organización alcanzó el límite de su plan.');
    this.name = 'OrganizationStorageLimitError';
  }
}

const poolExecutor: CapabilityQueryExecutor = (text, params) => pool.query(text, params);

export class OrganizationStorageService {
  private clientExecutor(client: PoolClient): CapabilityQueryExecutor {
    return (text, params) => client.query(text, params);
  }

  /** Serialize document writes per organization while their storage is measured. */
  async lockForWorkspace(client: PoolClient, workspaceId: string): Promise<string> {
    const execute = this.clientExecutor(client);
    const result = await execute(
      'SELECT organization_id FROM workspaces WHERE id = $1',
      [workspaceId],
    );
    const organizationId = result.rows[0]?.organization_id as string | undefined;
    if (!organizationId) throw new Error(`Workspace not found: ${workspaceId}`);
    await execute(
      `SELECT pg_advisory_xact_lock(hashtextextended('organization-storage:' || $1::text, 0))`,
      [organizationId],
    );
    return organizationId;
  }

  async lockForDocument(client: PoolClient, documentId: string): Promise<string> {
    const execute = this.clientExecutor(client);
    const result = await execute(
      `SELECT w.organization_id
         FROM documents d
         JOIN workspaces w ON w.id = d.workspace_id
        WHERE d.id = $1`,
      [documentId],
    );
    const organizationId = result.rows[0]?.organization_id as string | undefined;
    if (!organizationId) throw new Error(`Document not found: ${documentId}`);
    await execute(
      `SELECT pg_advisory_xact_lock(hashtextextended('organization-storage:' || $1::text, 0))`,
      [organizationId],
    );
    return organizationId;
  }

  async getUsage(organizationId: string, execute: CapabilityQueryExecutor = poolExecutor) {
    const entitlement = await capabilityService.getOrganizationCapabilities(organizationId, execute);
    const usage = await execute(
        `SELECT (COALESCE(SUM(
           octet_length(d.title) + octet_length(d.description) + octet_length(d.content)
           + COALESCE(octet_length(d.yjs_state), 0)
           + COALESCE(versions.bytes, 0)
         ), 0) + COALESCE((
           SELECT SUM(octet_length(e.snapshot_text))
             FROM project_evidence_links e
             JOIN projects p ON p.id = e.project_id
             JOIN workspaces ew ON ew.id = p.workspace_id
            WHERE ew.organization_id = $1
         ), 0))::text AS used_bytes
           FROM documents d
           JOIN workspaces w ON w.id = d.workspace_id
           LEFT JOIN LATERAL (
             SELECT SUM(COALESCE(octet_length(dv.yjs_state), 0) + octet_length(dv.metadata::text)) AS bytes
               FROM document_versions dv
              WHERE dv.document_id = d.id
           ) versions ON TRUE
          WHERE w.organization_id = $1`,
        [organizationId],
      );
    const storageMb = entitlement.capabilities.storage_mb;
    const limitBytes = typeof storageMb === 'number' ? BigInt(storageMb) * BYTES_PER_MB : null;

    return {
      planCode: entitlement.planCode,
      usedBytes: BigInt(usage.rows[0]?.used_bytes ?? 0),
      limitBytes,
      storageMb: typeof storageMb === 'number' ? storageMb : null,
    };
  }

  async assertWithinLimit(organizationId: string, client: PoolClient, previousUsedBytes?: bigint) {
    const usage = await this.getUsage(organizationId, this.clientExecutor(client));
    const increasedUsage = previousUsedBytes === undefined || usage.usedBytes > previousUsedBytes;
    if (usage.limitBytes !== null && usage.usedBytes > usage.limitBytes && increasedUsage) {
      throw new OrganizationStorageLimitError(usage.usedBytes, usage.limitBytes);
    }
    return usage;
  }
}

export const organizationStorageService = new OrganizationStorageService();
