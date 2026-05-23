// apps/api/src/services/DependencyService.ts

import { pool } from '../lib/db';
import { eventStore } from './EventStoreService';
import type { CardDependency } from '@aether/types';

export class DependencyService {
  // ── Helpers ─────────────────────────────────────────────────────────────────

  private static async getBoardAndWorkspace(cardId: string) {
    const r = await pool.query(
      `SELECT l.board_id, b.workspace_id
       FROM cards c
       JOIN lists l ON c.list_id = l.id
       JOIN boards b ON l.board_id = b.id
       WHERE c.id = $1`,
      [cardId]
    );
    return r.rows[0] || null;
  }

  private static mapRow(row: any): CardDependency {
    return {
      id: row.id,
      blockingCardId: row.blocking_card_id,
      blockedCardId: row.blocked_card_id,
      createdBy: row.created_by,
      createdAt: row.created_at,
      relatedCard: row.related_id
        ? {
            id: row.related_id,
            title: row.related_title,
            completed: row.related_completed,
            listName: row.related_list_name,
            listId: row.related_list_id,
          }
        : undefined,
    };
  }

  // ── Detección de ciclos (DFS simple) ─────────────────────────────────────────
  /**
   * Verifica si agregar (blockingId → blockedId) crearía un ciclo.
   * Un ciclo ocurre si blockedId ya puede llegar a blockingId a través
   * de dependencias existentes.
   */
  private static async wouldCreateCycle(blockingId: string, blockedId: string): Promise<boolean> {
    // BFS desde blockedId siguiendo las aristas "blocking → blocked"
    // Si llegamos a blockingId, hay ciclo.
    const visited = new Set<string>();
    const queue: string[] = [blockedId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === blockingId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const r = await pool.query(
        `SELECT blocked_card_id FROM card_dependencies WHERE blocking_card_id = $1`,
        [current]
      );
      for (const row of r.rows) {
        if (!visited.has(row.blocked_card_id)) {
          queue.push(row.blocked_card_id);
        }
      }
    }
    return false;
  }

  // ── CRUD ─────────────────────────────────────────────────────────────────────

  /**
   * Obtener dependencias de una card en ambas direcciones:
   * - blockedBy : cards que bloquean a esta (deben completarse primero)
   * - blocking  : cards que esta bloquea (esperan a que esta termine)
   */
  static async getDependencies(cardId: string): Promise<{
    blockedBy: CardDependency[];
    blocking: CardDependency[];
  }> {
    // Cards que bloquean a esta (blockedBy)
    const blockedByResult = await pool.query(
      `SELECT d.*,
              c.id   AS related_id,
              c.title AS related_title,
              c.completed AS related_completed,
              l.id   AS related_list_id,
              l.name AS related_list_name
       FROM card_dependencies d
       JOIN cards c ON c.id = d.blocking_card_id
       JOIN lists l ON l.id = c.list_id
       WHERE d.blocked_card_id = $1
       ORDER BY d.created_at ASC`,
      [cardId]
    );

    // Cards que esta bloquea (blocking)
    const blockingResult = await pool.query(
      `SELECT d.*,
              c.id   AS related_id,
              c.title AS related_title,
              c.completed AS related_completed,
              l.id   AS related_list_id,
              l.name AS related_list_name
       FROM card_dependencies d
       JOIN cards c ON c.id = d.blocked_card_id
       JOIN lists l ON l.id = c.list_id
       WHERE d.blocking_card_id = $1
       ORDER BY d.created_at ASC`,
      [cardId]
    );

    return {
      blockedBy: blockedByResult.rows.map(this.mapRow),
      blocking: blockingResult.rows.map(this.mapRow),
    };
  }

  /**
   * Agregar dependencia: blockingCardId debe completarse antes que blockedCardId.
   * Valida ciclos y auto-referencia.
   */
  static async addDependency(
    blockingCardId: string,
    blockedCardId: string,
    userId: string,
    socketId?: string
  ): Promise<CardDependency> {
    if (blockingCardId === blockedCardId) {
      throw new Error('A card cannot depend on itself');
    }

    // Verificar ciclo
    if (await this.wouldCreateCycle(blockingCardId, blockedCardId)) {
      throw new Error('Circular dependency detected');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `INSERT INTO card_dependencies (blocking_card_id, blocked_card_id, created_by)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [blockingCardId, blockedCardId, userId]
      );

      const row = result.rows[0];

      // Enriquecer con datos de la card bloqueante
      const cardInfo = await client.query(
        `SELECT c.id, c.title, c.completed, l.id AS list_id, l.name AS list_name
         FROM cards c JOIN lists l ON l.id = c.list_id
         WHERE c.id = $1`,
        [blockingCardId]
      );

      const dep: CardDependency = {
        id: row.id,
        blockingCardId: row.blocking_card_id,
        blockedCardId: row.blocked_card_id,
        createdBy: row.created_by,
        createdAt: row.created_at,
        relatedCard: cardInfo.rows[0]
          ? {
              id: cardInfo.rows[0].id,
              title: cardInfo.rows[0].title,
              completed: cardInfo.rows[0].completed,
              listId: cardInfo.rows[0].list_id,
              listName: cardInfo.rows[0].list_name,
            }
          : undefined,
      };

      // Emitir evento realtime al board
      const meta = await this.getBoardAndWorkspace(blockedCardId);
      if (meta) {
        const actorResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const actorName = actorResult.rows[0]?.name ?? '';
        const dependsOnTitle = dep.relatedCard?.title ?? '';
        await eventStore.emit({
          type: 'card.dependency.added',
          actor: { id: userId, name: actorName },
          subject: { type: 'dependency', id: dep.id, name: dependsOnTitle },
          context: { workspaceId: meta.workspace_id, boardId: meta.board_id, cardId: blockedCardId },
          payload: { blockingCardId, blockedCardId },
          socketId,
        });
      }

      await client.query('COMMIT');
      return dep;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar una dependencia por su ID.
   */
  static async removeDependency(
    dependencyId: string,
    cardId: string,
    userId: string,
    socketId?: string
  ): Promise<void> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const result = await client.query(
        `DELETE FROM card_dependencies
         WHERE id = $1 AND (blocking_card_id = $2 OR blocked_card_id = $2)
         RETURNING *`,
        [dependencyId, cardId]
      );

      if (result.rows.length === 0) {
        throw new Error('Dependency not found');
      }

      const removedDep = result.rows[0];
      const blockingCardId = removedDep.blocking_card_id;
      const blockedCardId = removedDep.blocked_card_id;

      const meta = await this.getBoardAndWorkspace(cardId);
      if (meta) {
        const actorResult = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
        const actorName = actorResult.rows[0]?.name ?? '';
        await eventStore.emit({
          type: 'card.dependency.removed',
          actor: { id: userId, name: actorName },
          subject: { type: 'dependency', id: dependencyId, name: '' },
          context: { workspaceId: meta.workspace_id, boardId: meta.board_id, cardId },
          payload: { blockingCardId, blockedCardId },
          socketId,
        });
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Buscar cards del mismo board para seleccionar como dependencia.
   * Excluye la card actual y las que ya tienen relación con ella.
   */
  static async searchCards(
    cardId: string,
    boardId: string,
    query: string
  ): Promise<
    Array<{ id: string; title: string; completed: boolean; listName: string; listId: string }>
  > {
    // Excluir mediante subquery: la card actual + cualquier card que ya tenga
    // relación directa con ella en cualquier dirección
    const r = await pool.query(
      `SELECT c.id, c.title, c.completed, l.id AS list_id, l.name AS list_name
       FROM cards c
       JOIN lists l ON l.id = c.list_id
       WHERE l.board_id = $1
         AND c.title ILIKE $2
         AND c.id <> $3
         AND c.id NOT IN (
           SELECT blocking_card_id FROM card_dependencies WHERE blocked_card_id  = $3
           UNION ALL
           SELECT blocked_card_id  FROM card_dependencies WHERE blocking_card_id = $3
         )
       ORDER BY l.position ASC, c.position ASC
       LIMIT 20`,
      [boardId, `%${query}%`, cardId]
    );

    return r.rows.map((row: any) => ({
      id: row.id,
      title: row.title,
      completed: row.completed,
      listId: row.list_id,
      listName: row.list_name,
    }));
  }

  /**
   * Obtener el boardId de una card (para búsqueda contextual)
   */
  static async getBoardIdFromCard(cardId: string): Promise<string | null> {
    const r = await pool.query(
      `SELECT l.board_id FROM cards c JOIN lists l ON c.list_id = l.id WHERE c.id = $1`,
      [cardId]
    );
    return r.rows[0]?.board_id || null;
  }
}
