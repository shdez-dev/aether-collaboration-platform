// apps/api/src/services/CardService.ts

import { pool } from '../lib/db';
import { EventStoreService } from './EventStoreService';
import type { Card } from '@aether/types';

const eventStore = new EventStoreService();

export class CardService {
  /**
   * Obtener todas las cards de una lista
   * Incluye relaciones con miembros y labels
   * Ordena por posición ascendente
   */
  static async getCardsByListId(listId: string): Promise<Card[]> {
    const result = await pool.query(
      `SELECT 
        c.*,
        json_agg(DISTINCT jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        )) FILTER (WHERE u.id IS NOT NULL) as members,
        json_agg(DISTINCT jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'color', l.color
        )) FILTER (WHERE l.id IS NOT NULL) as labels
       FROM cards c
       LEFT JOIN card_members cm ON c.id = cm.card_id
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN card_labels cl ON c.id = cl.card_id
       LEFT JOIN labels l ON cl.label_id = l.id
       WHERE c.list_id = $1
       GROUP BY c.id
       ORDER BY c.position ASC`,
      [listId]
    );

    return result.rows.map((row) => this.mapCard(row));
  }

  /**
   * Crear una card en una lista
   */
  static async createCard(
    listId: string,
    userId: string,
    data: {
      title: string;
      description?: string;
      dueDate?: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH';
    }
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener la posición máxima en la lista para colocar la nueva card al final
      const maxPosResult = await client.query(
        'SELECT COALESCE(MAX(position), 0) as max_pos FROM cards WHERE list_id = $1',
        [listId]
      );

      const newPosition = maxPosResult.rows[0].max_pos + 1;

      // Crear la card con la nueva posición
      const result = await client.query(
        `INSERT INTO cards (list_id, title, description, position, due_date, priority, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING *`,
        [
          listId,
          data.title,
          data.description || null,
          newPosition,
          data.dueDate || null,
          data.priority || null,
          userId,
        ]
      );

      const card = this.mapCard(result.rows[0]);

      // Registrar evento de creación en el event store
      await eventStore.emit(
        'card.created',
        {
          cardId: card.id as any,
          listId: card.listId as any,
          title: card.title,
          description: card.description,
          position: card.position,
          createdBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Obtener card por ID con relaciones
   */
  static async getCardById(cardId: string): Promise<Card | null> {
    const result = await pool.query(
      `SELECT 
        c.*,
        json_agg(DISTINCT jsonb_build_object(
          'id', u.id,
          'name', u.name,
          'email', u.email
        )) FILTER (WHERE u.id IS NOT NULL) as members,
        json_agg(DISTINCT jsonb_build_object(
          'id', l.id,
          'name', l.name,
          'color', l.color
        )) FILTER (WHERE l.id IS NOT NULL) as labels
       FROM cards c
       LEFT JOIN card_members cm ON c.id = cm.card_id
       LEFT JOIN users u ON cm.user_id = u.id
       LEFT JOIN card_labels cl ON c.id = cl.card_id
       LEFT JOIN labels l ON cl.label_id = l.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [cardId]
    );

    if (result.rows.length === 0) return null;

    return this.mapCard(result.rows[0]);
  }

  /**
   * Actualizar card
   * Solo actualiza los campos que se envían en data
   */
  static async updateCard(
    cardId: string,
    userId: string,
    data: {
      title?: string;
      description?: string | null;
      dueDate?: string | null;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
    }
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Construir query dinámica solo con campos que cambiaron
      const updates: string[] = [];
      const values: any[] = [];
      let paramCount = 1;

      if (data.title !== undefined) {
        updates.push(`title = $${paramCount++}`);
        values.push(data.title);
      }

      if (data.description !== undefined) {
        updates.push(`description = $${paramCount++}`);
        values.push(data.description);
      }

      if (data.dueDate !== undefined) {
        updates.push(`due_date = $${paramCount++}`);
        values.push(data.dueDate);
      }

      if (data.priority !== undefined) {
        updates.push(`priority = $${paramCount++}`);
        values.push(data.priority);
      }

      // Siempre actualizar updated_at
      updates.push(`updated_at = NOW()`);
      values.push(cardId);

      const result = await client.query(
        `UPDATE cards SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`,
        values
      );

      const card = this.mapCard(result.rows[0]);

      // Registrar evento solo con los campos que cambiaron
      const changes: any = {};
      if (data.title !== undefined) changes.title = data.title;
      if (data.description !== undefined) changes.description = data.description;
      if (data.dueDate !== undefined) changes.dueDate = data.dueDate;
      if (data.priority !== undefined) changes.priority = data.priority;

      await eventStore.emit(
        'card.updated',
        {
          cardId: card.id as any,
          changes,
          updatedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mover card (cambiar de lista o reordenar)
   * Maneja el reordenamiento automático de posiciones
   */
  static async moveCard(
    cardId: string,
    userId: string,
    data: {
      toListId: string;
      position: number;
    }
  ): Promise<Card> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener card actual
      const currentResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const currentCard = currentResult.rows[0];

      if (!currentCard) {
        throw new Error('Card not found');
      }

      const fromListId = currentCard.list_id;
      const fromPosition = currentCard.position;

      // Si cambió de lista, ajustar posiciones en lista origen
      if (fromListId !== data.toListId) {
        await client.query(
          'UPDATE cards SET position = position - 1 WHERE list_id = $1 AND position > $2',
          [fromListId, fromPosition]
        );
      }

      // Ajustar posiciones en lista destino para hacer espacio
      await client.query(
        'UPDATE cards SET position = position + 1 WHERE list_id = $1 AND position >= $2',
        [data.toListId, data.position]
      );

      // Actualizar la card con nueva lista y posición
      const result = await client.query(
        `UPDATE cards 
         SET list_id = $1, position = $2, updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [data.toListId, data.position, cardId]
      );

      const card = this.mapCard(result.rows[0]);

      // Registrar evento de movimiento
      await eventStore.emit(
        'card.moved',
        {
          cardId: card.id as any,
          fromListId: fromListId as any,
          toListId: data.toListId as any,
          fromPosition,
          toPosition: data.position,
          movedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');

      return card;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Eliminar card
   * Ajusta automáticamente las posiciones de las cards restantes
   */
  static async deleteCard(cardId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Obtener card antes de eliminar para el evento
      const cardResult = await client.query('SELECT * FROM cards WHERE id = $1', [cardId]);
      const card = cardResult.rows[0];

      if (!card) {
        throw new Error('Card not found');
      }

      // Eliminar card (cascade eliminará relaciones con members y labels)
      await client.query('DELETE FROM cards WHERE id = $1', [cardId]);

      // Ajustar posiciones de cards restantes en la lista
      await client.query(
        'UPDATE cards SET position = position - 1 WHERE list_id = $1 AND position > $2',
        [card.list_id, card.position]
      );

      // Registrar evento de eliminación
      await eventStore.emit(
        'card.deleted',
        {
          cardId: card.id as any,
          listId: card.list_id as any,
          deletedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Asignar miembro a card
   */
  static async assignMember(cardId: string, memberId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que no esté ya asignado
      const existingResult = await client.query(
        'SELECT * FROM card_members WHERE card_id = $1 AND user_id = $2',
        [cardId, memberId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Member already assigned');
      }

      // Asignar miembro a la card
      await client.query('INSERT INTO card_members (card_id, user_id) VALUES ($1, $2)', [
        cardId,
        memberId,
      ]);

      // Registrar evento de asignación
      await eventStore.emit(
        'card.member.assigned',
        {
          cardId: cardId as any,
          userId: memberId as any,
          assignedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Desasignar miembro de card
   */
  static async unassignMember(cardId: string, memberId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM card_members WHERE card_id = $1 AND user_id = $2', [
        cardId,
        memberId,
      ]);

      // Registrar evento de desasignación
      await eventStore.emit(
        'card.member.unassigned',
        {
          cardId: cardId as any,
          userId: memberId as any,
          unassignedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Agregar label a card
   */
  static async addLabel(cardId: string, labelId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Verificar que no esté ya agregada
      const existingResult = await client.query(
        'SELECT * FROM card_labels WHERE card_id = $1 AND label_id = $2',
        [cardId, labelId]
      );

      if (existingResult.rows.length > 0) {
        throw new Error('Label already added');
      }

      await client.query('INSERT INTO card_labels (card_id, label_id) VALUES ($1, $2)', [
        cardId,
        labelId,
      ]);

      // Registrar evento de agregación de label
      await eventStore.emit(
        'card.label.added',
        {
          cardId: cardId as any,
          labelId: labelId as any,
          addedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Remover label de card
   */
  static async removeLabel(cardId: string, labelId: string, userId: string): Promise<void> {
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      await client.query('DELETE FROM card_labels WHERE card_id = $1 AND label_id = $2', [
        cardId,
        labelId,
      ]);

      // Registrar evento de remoción de label
      await eventStore.emit(
        'card.label.removed',
        {
          cardId: cardId as any,
          labelId: labelId as any,
          removedBy: userId as any,
        },
        userId as any
      );

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Mapear card de base de datos a modelo
   * Convierte snake_case a camelCase y formatea relaciones
   */
  private static mapCard(row: any): Card {
    return {
      id: row.id,
      listId: row.list_id,
      title: row.title,
      description: row.description,
      position: row.position,
      dueDate: row.due_date,
      priority: row.priority,
      createdBy: row.created_by,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      members: row.members || [],
      labels: row.labels || [],
    };
  }
}
