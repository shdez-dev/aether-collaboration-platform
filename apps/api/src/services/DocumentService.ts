// apps/api/src/services/DocumentService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import * as Y from 'yjs';
import type {
  Document,
  DocumentWithCreator,
  DocumentWithDetails,
  DocumentVersion,
  DocumentComment,
  DocumentPermission,
} from '@aether/types';

export class DocumentService {
  /**
   * Extraer texto plano de Yjs state para búsqueda y preview
   * Intenta múltiples nombres de fragments porque TipTap puede usar diferentes nombres
   */
  private extractTextFromYjs(yjsState: Uint8Array): string {
    try {
      const tempDoc = new Y.Doc();
      Y.applyUpdate(tempDoc, yjsState);

      // PASO 1: Intentar nombres comunes de fragments
      const possibleNames = ['default', 'prosemirror', 'document', 'content', 'main'];

      for (const name of possibleNames) {
        try {
          const fragment = tempDoc.getXmlFragment(name);
          if (fragment && fragment._start) {
            const text = this.extractTextFromFragment(fragment);
            if (text.length > 0) {
              tempDoc.destroy();
              return text;
            }
          }
        } catch (e) {
          // Fragment no existe, continuar con el siguiente
        }
      }

      // PASO 2: Si no encontró nada, listar todos los fragments disponibles
      const allFragments = Array.from(tempDoc.share.keys());

      if (allFragments.length > 0) {
        // Intentar con el primer fragment disponible
        const firstFragment = tempDoc.getXmlFragment(allFragments[0]);
        const text = this.extractTextFromFragment(firstFragment);

        if (text.length > 0) {
          tempDoc.destroy();
          return text;
        }
      }

      console.warn('[Documents] ⚠️  No text content found in Yjs state');
      tempDoc.destroy();
      return '';
    } catch (error) {
      return '';
    }
  }

  /**
   * Extraer texto de un fragment Yjs recursivamente
   */
  private extractTextFromFragment(fragment: any): string {
    if (!fragment || !fragment._start) return '';

    let text = '';
    let item = fragment._start;

    while (item) {
      // Procesar el contenido del item
      if (item.content) {
        // Caso 1: YText o tipos con toString()
        if (item.content.type) {
          if (item.content.type instanceof Y.Text) {
            text += item.content.type.toString();
          } else if (item.content.type instanceof Y.XmlElement) {
            // Recursivamente extraer de elementos XML
            text += this.extractTextFromFragment(item.content.type);
          } else if (item.content.type instanceof Y.XmlFragment) {
            text += this.extractTextFromFragment(item.content.type);
          } else if (typeof item.content.type.toString === 'function') {
            text += item.content.type.toString();
          }
        }
        // Caso 2: ContentString (texto directo)
        else if (item.content.str) {
          text += item.content.str;
        }
      }

      item = item.right;
    }

    // Limpieza: remover espacios múltiples y newlines excesivos
    text = text
      .replace(/\s+/g, ' ') // Múltiples espacios → un espacio
      .replace(/\n{3,}/g, '\n\n') // Múltiples newlines → máximo 2
      .trim();

    return text;
  }

  /**
   * Create a new document
   */
  async createDocument(
    workspaceId: string,
    userId: string,
    data: {
      title: string;
      templateId?: string;
      content?: any;
    }
  ): Promise<Document> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO documents (workspace_id, title, content, created_by)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
        [workspaceId, data.title, '', userId]
      );

      const document = this.formatDocument(result.rows[0]);

      // ✅ Inicializar yjs_state con documento Yjs vacío válido
      const emptyYDoc = new Y.Doc();
      const emptyState = Y.encodeStateAsUpdate(emptyYDoc);
      await client.query(`UPDATE documents SET yjs_state = $1 WHERE id = $2`, [
        Buffer.from(emptyState),
        document.id,
      ]);
      emptyYDoc.destroy();


      // Dar permiso EDIT al creador automáticamente
      await client.query(
        `INSERT INTO document_permissions (document_id, user_id, permission)
       VALUES ($1, $2, $3)`,
        [document.id, userId, 'EDIT']
      );

      await client.query('COMMIT');

      const payload = {
        documentId: document.id as any,
        workspaceId: workspaceId as any,
        title: document.title,
        createdBy: userId as any,
        templateId: data.templateId,
      };

      await eventStore.emit('document.created', payload, userId as any);

      return document;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get documents from a workspace
   */
  async getWorkspaceDocuments(
    workspaceId: string,
    options: {
      search?: string;
      sortBy?: 'createdAt' | 'updatedAt' | 'title';
      sortOrder?: 'asc' | 'desc';
      limit?: number;
      offset?: number;
    } = {}
  ): Promise<{ documents: DocumentWithCreator[]; total: number }> {
    const { search, sortBy = 'updatedAt', sortOrder = 'desc', limit = 50, offset = 0 } = options;

    let query = `
      SELECT 
        d.*,
        json_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email,
          'avatar', u.avatar
        ) as creator
      FROM documents d
      INNER JOIN users u ON d.created_by = u.id
      WHERE d.workspace_id = $1
    `;

    const params: any[] = [workspaceId];
    let paramIndex = 2;

    if (search) {
      query += ` AND (
        d.title ILIKE $${paramIndex} OR
        d.content ILIKE $${paramIndex}
      )`;
      params.push(`%${search}%`);
      paramIndex++;
    }

    const countResult = await pool.query(
      `SELECT COUNT(*) as total FROM documents WHERE workspace_id = $1 ${search ? `AND (title ILIKE $2 OR content ILIKE $2)` : ''}`,
      search ? [workspaceId, `%${search}%`] : [workspaceId]
    );

    const total = parseInt(countResult.rows[0].total);

    const sortColumnMap: Record<string, string> = {
      createdAt: 'd.created_at',
      updatedAt: 'd.updated_at',
      title: 'd.title',
    };

    const sortColumn = sortColumnMap[sortBy] || 'd.updated_at';
    query += ` ORDER BY ${sortColumn} ${sortOrder.toUpperCase()}`;

    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);

    const documents = result.rows.map((row) => ({
      ...this.formatDocument(row),
      creator: row.creator,
    }));

    return { documents, total };
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId: string): Promise<Document | null> {
    const result = await pool.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);

    if (result.rows.length === 0) return null;

    return this.formatDocument(result.rows[0]);
  }

  /**
   * Get document with complete details
   */
  async getDocumentWithDetails(
    documentId: string,
    userId: string
  ): Promise<DocumentWithDetails | null> {
    const client = await pool.connect();

    try {
      const docResult = await client.query(
        `SELECT 
          d.*,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar
          ) as creator
         FROM documents d
         INNER JOIN users u ON d.created_by = u.id
         WHERE d.id = $1`,
        [documentId]
      );

      if (docResult.rows.length === 0) return null;

      const document = this.formatDocument(docResult.rows[0]);

      const permissionsResult = await client.query(
        `SELECT 
          dp.*,
          json_build_object(
            'id', u.id,
            'name', u.name,
            'email', u.email,
            'avatar', u.avatar
          ) as user
         FROM document_permissions dp
         INNER JOIN users u ON dp.user_id = u.id
         WHERE dp.document_id = $1`,
        [documentId]
      );

      const countsResult = await client.query(
        `SELECT 
          (SELECT COUNT(*) FROM document_comments WHERE document_id = $1) as comment_count,
          (SELECT COUNT(*) FROM document_versions WHERE document_id = $1) as version_count`,
        [documentId]
      );

      // Get effective permission (considers workspace owner and creator)
      const userPermission = await this.getEffectiveUserPermission(documentId, userId);

      return {
        ...document,
        creator: docResult.rows[0].creator,
        permissions: permissionsResult.rows.map((row) => ({
          id: row.id,
          documentId: row.document_id,
          userId: row.user_id,
          permission: row.permission,
          createdAt: row.created_at,
          user: row.user,
        })),
        activeUsers: [],
        commentCount: parseInt(countsResult.rows[0].comment_count),
        versionCount: parseInt(countsResult.rows[0].version_count),
        userPermission: userPermission || undefined,
      };
    } finally {
      client.release();
    }
  }

  /**
   * Update document
   */
  async updateDocument(
    documentId: string,
    userId: string,
    data: {
      title?: string;
      content?: string;
    }
  ): Promise<Document> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const updates: string[] = [];
      const values: any[] = [];
      let paramIndex = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramIndex++}`);
        values.push(data.title);
      }

      if (data.content !== undefined) {
        updates.push(`content = $${paramIndex++}`);
        values.push(data.content);
      }

      updates.push(`updated_at = CURRENT_TIMESTAMP`);
      values.push(documentId);

      const result = await client.query(
        `UPDATE documents 
         SET ${updates.join(', ')}
         WHERE id = $${paramIndex}
         RETURNING *`,
        values
      );

      const document = this.formatDocument(result.rows[0]);

      await client.query('COMMIT');

      const payload = {
        documentId: document.id as any,
        workspaceId: document.workspaceId as any,
        changes: data,
        updatedBy: userId as any,
      };

      await eventStore.emit('document.updated', payload, userId as any);

      return document;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Delete document
   */
  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const docResult = await client.query(`SELECT workspace_id FROM documents WHERE id = $1`, [
        documentId,
      ]);

      if (docResult.rows.length === 0) {
        throw new Error('Document not found');
      }

      const workspaceId = docResult.rows[0].workspace_id;

      await client.query(`DELETE FROM documents WHERE id = $1`, [documentId]);

      await client.query('COMMIT');

      const payload = {
        documentId: documentId as any,
        workspaceId: workspaceId as any,
        deletedBy: userId as any,
      };

      await eventStore.emit('document.deleted', payload, userId as any);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Update Yjs state of document
   * ✅ TAMBIÉN EXTRAE Y GUARDA TEXTO PLANO
   */
  async updateYjsState(documentId: string, yjsState: Uint8Array): Promise<void> {
    // Extraer texto plano del estado Yjs
    const plainText = this.extractTextFromYjs(yjsState);

    // Guardar tanto yjs_state como content (texto plano)
    await pool.query(
      `UPDATE documents 
       SET yjs_state = $1, content = $2, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $3`,
      [Buffer.from(yjsState), plainText, documentId]
    );

  }

  /**
   * Get Yjs state of document
   */
  async getYjsState(documentId: string): Promise<Uint8Array | null> {
    const result = await pool.query(`SELECT yjs_state FROM documents WHERE id = $1`, [documentId]);

    if (result.rows.length === 0 || !result.rows[0].yjs_state) {
      return null;
    }

    const yjsState = new Uint8Array(result.rows[0].yjs_state);

    return yjsState;
  }

  /**
   * Create document version
   */
  async createVersion(
    documentId: string,
    userId: string,
    metadata?: { description?: string }
  ): Promise<DocumentVersion> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const yjsState = await this.getYjsState(documentId);

      if (!yjsState) {
        throw new Error('Document has no Yjs state');
      }

      const result = await client.query(
        `INSERT INTO document_versions (document_id, yjs_state, metadata, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING *`,
        [documentId, Buffer.from(yjsState), JSON.stringify(metadata || {}), userId]
      );

      const version = this.formatVersion(result.rows[0]);

      await client.query('COMMIT');

      const docResult = await client.query(`SELECT workspace_id FROM documents WHERE id = $1`, [
        documentId,
      ]);
      const workspaceId = docResult.rows[0]?.workspace_id;

      const payload = {
        versionId: version.id as any,
        documentId: documentId as any,
        workspaceId: workspaceId as any,
        metadata: metadata || {},
        createdBy: userId as any,
      };

      await eventStore.emit('document.version.created', payload, userId as any);

      return version;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get versions of a document
   */
  async getVersions(documentId: string): Promise<DocumentVersion[]> {
    const result = await pool.query(
      `SELECT * FROM document_versions WHERE document_id = $1 ORDER BY created_at DESC`,
      [documentId]
    );

    return result.rows.map(this.formatVersion);
  }

  /**
   * Restore version
   */
  async restoreVersion(documentId: string, versionId: string, userId: string): Promise<Document> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const versionResult = await client.query(
        `SELECT yjs_state FROM document_versions WHERE id = $1 AND document_id = $2`,
        [versionId, documentId]
      );

      if (versionResult.rows.length === 0) {
        throw new Error('Version not found');
      }

      const yjsState = new Uint8Array(versionResult.rows[0].yjs_state);

      // Extraer texto plano del snapshot
      const plainText = this.extractTextFromYjs(yjsState);

      // Restaurar tanto yjs_state como content
      await client.query(
        `UPDATE documents 
         SET yjs_state = $1, content = $2, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $3`,
        [Buffer.from(yjsState), plainText, documentId]
      );

      const docResult = await client.query(`SELECT * FROM documents WHERE id = $1`, [documentId]);
      const document = this.formatDocument(docResult.rows[0]);

      await client.query('COMMIT');

      const payload = {
        versionId: versionId as any,
        documentId: documentId as any,
        workspaceId: document.workspaceId as any,
        restoredBy: userId as any,
      };

      await eventStore.emit('document.version.restored', payload, userId as any);

      return document;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user has access to document
   * Returns true if user is a member of the document's workspace
   */
  async checkDocumentAccess(documentId: string, userId: string): Promise<boolean> {
    const result = await pool.query(
      `SELECT 1
       FROM documents d
       INNER JOIN workspace_members wm ON d.workspace_id = wm.workspace_id
       WHERE d.id = $1 AND wm.user_id = $2
       LIMIT 1`,
      [documentId, userId]
    );

    return result.rows.length > 0;
  }

  /**
   * Get workspace ID of a document
   */
  async getDocumentWorkspace(documentId: string): Promise<string | null> {
    const result = await pool.query(`SELECT workspace_id FROM documents WHERE id = $1`, [
      documentId,
    ]);

    return result.rows.length > 0 ? result.rows[0].workspace_id : null;
  }

  /**
   * Get user permission on document
   */
  async getUserPermission(documentId: string, userId: string): Promise<DocumentPermission | null> {
    const result = await pool.query(
      `SELECT permission FROM document_permissions 
       WHERE document_id = $1 AND user_id = $2`,
      [documentId, userId]
    );

    return result.rows[0]?.permission || null;
  }

  /**
   * Get effective user permission (considering workspace owner and creator)
   * Returns the highest permission level for the user:
   * - Workspace OWNER: always EDIT
   * - Document creator: always EDIT
   * - Explicit permission: as defined
   * - Default: VIEW (if member of workspace)
   */
  async getEffectiveUserPermission(
    documentId: string,
    userId: string
  ): Promise<DocumentPermission | null> {
    const result = await pool.query(
      `SELECT 
        d.created_by,
        d.workspace_id,
        wm.role as workspace_role,
        dp.permission as explicit_permission
       FROM documents d
       INNER JOIN workspace_members wm ON d.workspace_id = wm.workspace_id AND wm.user_id = $2
       LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = $2
       WHERE d.id = $1`,
      [documentId, userId]
    );

    if (result.rows.length === 0) {
      return null; // User is not a member of the workspace
    }

    const { created_by, workspace_role, explicit_permission } = result.rows[0];

    // Workspace OWNER always has EDIT permission
    if (workspace_role === 'OWNER') {
      return 'EDIT';
    }

    // Document creator always has EDIT permission
    if (created_by === userId) {
      return 'EDIT';
    }

    // Return explicit permission if set
    if (explicit_permission) {
      return explicit_permission;
    }

    // Default: VIEW for all workspace members
    return 'VIEW';
  }

  /**
   * Update permission
   */
  async updatePermission(
    documentId: string,
    targetUserId: string,
    permission: DocumentPermission,
    updatedBy: string
  ): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query(
        `INSERT INTO document_permissions (document_id, user_id, permission)
         VALUES ($1, $2, $3)
         ON CONFLICT (document_id, user_id)
         DO UPDATE SET permission = $3`,
        [documentId, targetUserId, permission]
      );

      await client.query('COMMIT');

      const workspaceId = await this.getDocumentWorkspace(documentId);

      const payload = {
        documentId: documentId as any,
        workspaceId: workspaceId as any,
        targetUserId: targetUserId as any,
        permission,
        updatedBy: updatedBy as any,
      };

      await eventStore.emit('document.permission.updated', payload, updatedBy as any);

      // Broadcast real-time permission update via WebSocket
      const { getYjsGateway } = require('../websocket/Yjsgateway');
      try {
        const gateway = getYjsGateway();

        // Calculate effective permission for the target user
        const effectivePermission = await this.getEffectiveUserPermission(documentId, targetUserId);

        gateway.broadcastToUserInDocument(targetUserId, 'document:permission:changed', {
          documentId,
          permission: effectivePermission,
          updatedBy,
        });
      } catch (wsError) {
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Check if user is document creator or workspace owner
   */
  async checkUserIsOwnerOrCreator(
    documentId: string,
    userId: string,
    workspaceId: string
  ): Promise<boolean> {
    const result = await pool.query(
      `SELECT 
        d.created_by,
        wm.role
       FROM documents d
       INNER JOIN workspace_members wm ON d.workspace_id = wm.workspace_id
       WHERE d.id = $1 AND wm.user_id = $2 AND d.workspace_id = $3`,
      [documentId, userId, workspaceId]
    );

    if (result.rows.length === 0) return false;

    const { created_by, role } = result.rows[0];
    return created_by === userId || role === 'OWNER';
  }

  /**
   * Get workspace members with their document permissions
   */
  async getWorkspaceMembersWithPermissions(documentId: string): Promise<
    Array<{
      userId: string;
      name: string;
      email: string;
      avatar?: string;
      workspaceRole: string;
      documentPermission: DocumentPermission | null;
      effectivePermission: DocumentPermission;
      isCreator: boolean;
    }>
  > {
    const result = await pool.query(
      `SELECT 
        u.id as user_id,
        u.name,
        u.email,
        u.avatar,
        wm.role as workspace_role,
        dp.permission as document_permission,
        d.created_by
       FROM documents d
       INNER JOIN workspace_members wm ON d.workspace_id = wm.workspace_id
       INNER JOIN users u ON wm.user_id = u.id
       LEFT JOIN document_permissions dp ON d.id = dp.document_id AND dp.user_id = u.id
       WHERE d.id = $1
       ORDER BY 
         CASE wm.role 
           WHEN 'OWNER' THEN 1
           WHEN 'ADMIN' THEN 2
           WHEN 'MEMBER' THEN 3
           ELSE 4
         END,
         u.name`,
      [documentId]
    );

    return result.rows.map((row) => {
      const isCreator = row.created_by === row.user_id;
      const isOwner = row.workspace_role === 'OWNER';

      let effectivePermission: DocumentPermission = 'VIEW';
      if (isOwner || isCreator) {
        effectivePermission = 'EDIT';
      } else if (row.document_permission) {
        effectivePermission = row.document_permission;
      }

      return {
        userId: row.user_id,
        name: row.name,
        email: row.email,
        avatar: row.avatar,
        workspaceRole: row.workspace_role,
        documentPermission: row.document_permission,
        effectivePermission,
        isCreator,
      };
    });
  }

  /**
   * Format document row to Document type
   */
  private formatDocument(row: any): Document {
    return {
      id: row.id,
      workspaceId: row.workspace_id,
      title: row.title,
      content: row.content,
      yjsState: row.yjs_state ? new Uint8Array(row.yjs_state) : undefined,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Format version row to DocumentVersion type
   */
  private formatVersion(row: any): DocumentVersion {
    return {
      id: row.id,
      documentId: row.document_id,
      yjsState: new Uint8Array(row.yjs_state),
      metadata: row.metadata,
      createdBy: row.created_by,
      createdAt: row.created_at,
    };
  }
}

export const documentService = new DocumentService();
