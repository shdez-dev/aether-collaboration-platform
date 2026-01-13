// apps/web/src/services/notificationService.ts

import type { Notification } from '@aether/types';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

/**
 * Helper para obtener el token del localStorage
 */
function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;

  try {
    const authStorage = localStorage.getItem('aether-auth-storage');
    if (!authStorage) return null;

    const parsed = JSON.parse(authStorage);
    return parsed.state?.accessToken || null;
  } catch (error) {
    console.error('[NotificationService] Error reading auth token:', error);
    return null;
  }
}

/**
 * NotificationService
 * Maneja todas las operaciones HTTP relacionadas con notificaciones
 */
class NotificationService {
  /**
   * Obtener headers con autenticación
   */
  private getHeaders(): HeadersInit {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };

    const token = getAuthToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    return headers;
  }

  /**
   * GET /api/notifications
   * Obtener todas las notificaciones del usuario
   */
  async getNotifications(onlyUnread: boolean = false): Promise<Notification[]> {
    try {
      const url = onlyUnread
        ? `${API_URL}/api/notifications?unread=true`
        : `${API_URL}/api/notifications`;

      const response = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      return data.data.notifications || [];
    } catch (error) {
      console.error('[NotificationService] Error fetching notifications:', error);
      throw error;
    }
  }

  /**
   * GET /api/notifications/unread-count
   * Obtener contador de notificaciones no leídas
   */
  async getUnreadCount(): Promise<number> {
    try {
      const response = await fetch(`${API_URL}/api/notifications/unread-count`, {
        method: 'GET',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch unread count');
      }

      const data = await response.json();
      return data.data.count || 0;
    } catch (error) {
      console.error('[NotificationService] Error fetching unread count:', error);
      return 0;
    }
  }

  /**
   * PATCH /api/notifications/:id/read
   * Marcar una notificación como leída
   */
  async markAsRead(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}/read`, {
        method: 'PATCH',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark notification as read');
      }
    } catch (error) {
      console.error('[NotificationService] Error marking as read:', error);
      throw error;
    }
  }

  /**
   * POST /api/notifications/mark-all-read
   * Marcar todas las notificaciones como leídas
   */
  async markAllAsRead(): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/notifications/mark-all-read`, {
        method: 'POST',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }
    } catch (error) {
      console.error('[NotificationService] Error marking all as read:', error);
      throw error;
    }
  }

  /**
   * DELETE /api/notifications/:id
   * Eliminar una notificación
   */
  async deleteNotification(notificationId: string): Promise<void> {
    try {
      const response = await fetch(`${API_URL}/api/notifications/${notificationId}`, {
        method: 'DELETE',
        headers: this.getHeaders(),
      });

      if (!response.ok) {
        throw new Error('Failed to delete notification');
      }
    } catch (error) {
      console.error('[NotificationService] Error deleting notification:', error);
      throw error;
    }
  }
}

export const notificationService = new NotificationService();
