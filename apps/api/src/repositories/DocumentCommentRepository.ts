// apps/api/src/repositories/DocumentCommentRepository.ts

import { query } from '../lib/db';

export interface DocumentCommentRow {
  id: string;
  documentId: string;
  content: string;
  position: { from: number; to: number };
  resolved: boolean;
  createdBy: string;
  parentId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentCommentWithUser extends DocumentCommentRow {
  user: {
    id: string;
    name: string;
    email: string;
    avatar: string | null;
  };
  replies?: DocumentCommentWithUser[];
}

export class DocumentCommentRepository {
  /**
   * Crear un nuevo comentario (raíz o respuesta)
   */
  async create(data: {
    documentId: string;
    userId: string;
    content: string;
    position: { from: number; to: number };
    parentId?: string | null;
  }): Promise<DocumentCommentRow> {
    const result = await query<DocumentCommentRow>(
      `INSERT INTO document_comments (document_id, content, position, created_by, parent_id)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING
         id,
         document_id   AS "documentId",
         content,
         position,
         resolved,
         created_by    AS "createdBy",
         parent_id     AS "parentId",
         created_at    AS "createdAt",
         updated_at    AS "updatedAt"`,
      [
        data.documentId,
        data.content,
        JSON.stringify(data.position),
        data.userId,
        data.parentId ?? null,
      ]
    );
    return result.rows[0];
  }

  /**
   * Obtener todos los comentarios raíz de un documento con sus respuestas
   */
  async findByDocumentId(documentId: string): Promise<DocumentCommentWithUser[]> {
    // Obtener todos los comentarios (raíz + respuestas) del documento
    const result = await query<DocumentCommentWithUser>(
      `SELECT
         dc.id,
         dc.document_id  AS "documentId",
         dc.content,
         dc.position,
         dc.resolved,
         dc.created_by   AS "createdBy",
         dc.parent_id    AS "parentId",
         dc.created_at   AS "createdAt",
         dc.updated_at   AS "updatedAt",
         json_build_object(
           'id',     u.id,
           'name',   u.name,
           'email',  u.email,
           'avatar', u.avatar
         ) AS user
       FROM document_comments dc
       INNER JOIN users u ON dc.created_by = u.id
       WHERE dc.document_id = $1
       ORDER BY dc.created_at ASC`,
      [documentId]
    );

    // Armar árbol raíz → respuestas en memoria
    const all = result.rows;
    const roots: DocumentCommentWithUser[] = [];
    const byId = new Map<string, DocumentCommentWithUser>();

    all.forEach((c) => {
      byId.set(c.id, { ...c, replies: [] });
    });

    byId.forEach((c) => {
      if (c.parentId) {
        const parent = byId.get(c.parentId);
        if (parent) {
          parent.replies!.push(c);
        }
      } else {
        roots.push(c);
      }
    });

    return roots;
  }

  /**
   * Obtener un comentario por ID con datos del usuario
   */
  async findById(commentId: string): Promise<DocumentCommentWithUser | null> {
    const result = await query<DocumentCommentWithUser>(
      `SELECT
         dc.id,
         dc.document_id  AS "documentId",
         dc.content,
         dc.position,
         dc.resolved,
         dc.created_by   AS "createdBy",
         dc.parent_id    AS "parentId",
         dc.created_at   AS "createdAt",
         dc.updated_at   AS "updatedAt",
         json_build_object(
           'id',     u.id,
           'name',   u.name,
           'email',  u.email,
           'avatar', u.avatar
         ) AS user
       FROM document_comments dc
       INNER JOIN users u ON dc.created_by = u.id
       WHERE dc.id = $1`,
      [commentId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Actualizar el contenido de un comentario
   */
  async update(commentId: string, content: string): Promise<DocumentCommentRow | null> {
    const result = await query<DocumentCommentRow>(
      `UPDATE document_comments
       SET content = $1
       WHERE id = $2
       RETURNING
         id,
         document_id   AS "documentId",
         content,
         position,
         resolved,
         created_by    AS "createdBy",
         parent_id     AS "parentId",
         created_at    AS "createdAt",
         updated_at    AS "updatedAt"`,
      [content, commentId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Resolver / reabrir un comentario
   */
  async setResolved(commentId: string, resolved: boolean): Promise<DocumentCommentRow | null> {
    const result = await query<DocumentCommentRow>(
      `UPDATE document_comments
       SET resolved = $1
       WHERE id = $2
       RETURNING
         id,
         document_id   AS "documentId",
         content,
         position,
         resolved,
         created_by    AS "createdBy",
         parent_id     AS "parentId",
         created_at    AS "createdAt",
         updated_at    AS "updatedAt"`,
      [resolved, commentId]
    );
    return result.rows[0] ?? null;
  }

  /**
   * Eliminar un comentario (y sus respuestas en cascada por FK)
   */
  async delete(commentId: string): Promise<boolean> {
    const result = await query('DELETE FROM document_comments WHERE id = $1', [commentId]);
    return (result.rowCount ?? 0) > 0;
  }

  /**
   * Verificar autoría
   */
  async isAuthor(commentId: string, userId: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM document_comments WHERE id = $1 AND created_by = $2',
      [commentId, userId]
    );
    return result.rows.length > 0;
  }

  /**
   * Obtener el documentId de un comentario (para emitir eventos)
   */
  async getDocumentId(commentId: string): Promise<string | null> {
    const result = await query<{ documentId: string }>(
      'SELECT document_id AS "documentId" FROM document_comments WHERE id = $1',
      [commentId]
    );
    return result.rows[0]?.documentId ?? null;
  }
}

let instance: DocumentCommentRepository | null = null;

export function getDocumentCommentRepository(): DocumentCommentRepository {
  if (!instance) instance = new DocumentCommentRepository();
  return instance;
}
