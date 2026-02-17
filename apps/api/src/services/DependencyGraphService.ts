// apps/api/src/services/DependencyGraphService.ts

import { pool } from '../lib/db';

export interface GraphCard {
  id: string;
  title: string;
  completed: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  listId: string;
  listName: string;
  listPosition: number;
  blockedByPendingCount: number;
}

export interface GraphEdge {
  id: string;
  blockingCardId: string;
  blockedCardId: string;
}

export interface DependencyGraph {
  cards: GraphCard[];
  edges: GraphEdge[];
}

export class DependencyGraphService {
  /**
   * Obtiene todos los nodos y aristas de dependencias de un board.
   * Solo incluye cards que participan en al menos una dependencia.
   */
  static async getGraph(boardId: string): Promise<DependencyGraph> {
    // 1. Obtener todas las dependencias del board con info de ambas cards
    const edgesResult = await pool.query(
      `SELECT
         cd.id          AS dep_id,
         cd.blocking_card_id,
         cd.blocked_card_id,
         -- Card bloqueante
         bc.id          AS blocking_id,
         bc.title       AS blocking_title,
         bc.completed   AS blocking_completed,
         bc.priority    AS blocking_priority,
         bc.list_id     AS blocking_list_id,
         bl.name        AS blocking_list_name,
         bl.position    AS blocking_list_position,
         -- Card bloqueada
         dc.id          AS blocked_id,
         dc.title       AS blocked_title,
         dc.completed   AS blocked_completed,
         dc.priority    AS blocked_priority,
         dc.list_id     AS blocked_list_id,
         dl.name        AS blocked_list_name,
         dl.position    AS blocked_list_position
       FROM card_dependencies cd
       INNER JOIN cards bc ON cd.blocking_card_id = bc.id
       INNER JOIN lists bl ON bc.list_id = bl.id
       INNER JOIN cards dc ON cd.blocked_card_id = dc.id
       INNER JOIN lists dl ON dc.list_id = dl.id
       WHERE bl.board_id = $1
         AND dl.board_id = $1`,
      [boardId]
    );

    if (edgesResult.rows.length === 0) {
      return { cards: [], edges: [] };
    }

    // 2. Construir mapa de cards únicas (por id)
    const cardMap = new Map<string, GraphCard>();

    for (const row of edgesResult.rows) {
      if (!cardMap.has(row.blocking_id)) {
        cardMap.set(row.blocking_id, {
          id: row.blocking_id,
          title: row.blocking_title,
          completed: row.blocking_completed,
          priority: row.blocking_priority,
          listId: row.blocking_list_id,
          listName: row.blocking_list_name,
          listPosition: row.blocking_list_position,
          blockedByPendingCount: 0,
        });
      }
      if (!cardMap.has(row.blocked_id)) {
        cardMap.set(row.blocked_id, {
          id: row.blocked_id,
          title: row.blocked_title,
          completed: row.blocked_completed,
          priority: row.blocked_priority,
          listId: row.blocked_list_id,
          listName: row.blocked_list_name,
          listPosition: row.blocked_list_position,
          blockedByPendingCount: 0,
        });
      }
    }

    // 3. Calcular blockedByPendingCount para cada card bloqueada
    for (const row of edgesResult.rows) {
      const blockingCard = cardMap.get(row.blocking_id)!;
      if (!blockingCard.completed) {
        const blocked = cardMap.get(row.blocked_id)!;
        blocked.blockedByPendingCount += 1;
      }
    }

    // 4. Construir edges
    const edges: GraphEdge[] = edgesResult.rows.map((row) => ({
      id: row.dep_id,
      blockingCardId: row.blocking_card_id,
      blockedCardId: row.blocked_card_id,
    }));

    return {
      cards: Array.from(cardMap.values()),
      edges,
    };
  }
}
