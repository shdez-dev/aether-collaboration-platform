// apps/web/src/components/notifications/NotificationItem.tsx

'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Check, X, MessageSquare, UserPlus, Calendar, Mail } from 'lucide-react';
import type { Notification } from '@aether/types';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { useT } from '@/lib/i18n';

interface NotificationItemProps {
  notification: Notification;
  onMarkAsRead?: (notificationId: string) => Promise<void>;
  onDelete?: (notificationId: string) => Promise<void>;
  onClose?: () => void;
}

export function NotificationItem({
  notification,
  onMarkAsRead,
  onDelete,
  onClose,
}: NotificationItemProps) {
  const t = useT();
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  /**
   * Obtener icono según el tipo de notificación
   */
  const getIcon = () => {
    switch (notification.type) {
      case 'COMMENT_MENTION':
        return <MessageSquare className="h-4 w-4" />;
      case 'CARD_ASSIGNED':
        return <UserPlus className="h-4 w-4" />;
      case 'CARD_DUE_SOON':
        return <Calendar className="h-4 w-4" />;
      case 'BOARD_INVITE':
      case 'WORKSPACE_INVITE':
        return <Mail className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  /**
   * Obtener color según el tipo
   */
  const getColorClass = () => {
    switch (notification.type) {
      case 'COMMENT_MENTION':
        return 'text-blue-500 bg-blue-500/10';
      case 'CARD_ASSIGNED':
        return 'text-green-500 bg-green-500/10';
      case 'CARD_DUE_SOON':
        return 'text-orange-500 bg-orange-500/10';
      case 'BOARD_INVITE':
      case 'WORKSPACE_INVITE':
        return 'text-purple-500 bg-purple-500/10';
      default:
        return 'text-muted-foreground bg-muted';
    }
  };

  /**
   * Navegar a la card o recurso relacionado
   */
  const handleClick = async () => {
    // Marcar como leída si no lo está
    if (!notification.read && onMarkAsRead) {
      setIsLoading(true);
      try {
        await onMarkAsRead(notification.id);
      } catch (error) {
      } finally {
        setIsLoading(false);
      }
    }

    // Navegar según el tipo de notificación
    if (notification.type === 'COMMENT_MENTION' && notification.data.cardId) {
      // TODO: Navegar a la card modal
      // Por ahora cerramos el dropdown
      onClose?.();
    }

    if (notification.type === 'CARD_ASSIGNED' && notification.data.cardId) {
      onClose?.();
    }

    if (notification.type === 'BOARD_INVITE' && notification.data.boardId) {
      router.push(`/boards/${notification.data.boardId}`);
      onClose?.();
    }

    if (notification.type === 'WORKSPACE_INVITE' && notification.data.workspaceId) {
      router.push(`/workspaces/${notification.data.workspaceId}`);
      onClose?.();
    }
  };

  /**
   * Marcar como leída sin navegar
   */
  const handleMarkAsRead = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onMarkAsRead || notification.read) return;

    setIsLoading(true);
    try {
      await onMarkAsRead(notification.id);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Eliminar notificación
   */
  const handleDelete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!onDelete) return;

    setIsLoading(true);
    try {
      await onDelete(notification.id);
    } catch (error) {
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formatear fecha relativa
   */
  const getRelativeTime = () => {
    try {
      return formatDistanceToNow(new Date(notification.createdAt), {
        addSuffix: true,
        locale: es,
      });
    } catch (error) {
      return notification.createdAt;
    }
  };

  return (
    <div
      onClick={handleClick}
      className={`
        group relative flex gap-3 p-3 rounded-lg transition-all cursor-pointer
        ${notification.read ? 'bg-background hover:bg-muted/50' : 'bg-primary/5 hover:bg-primary/10'}
        ${isLoading ? 'opacity-50 pointer-events-none' : ''}
      `}
    >
      {/* Indicador de no leída */}
      {!notification.read && (
        <div className="absolute left-1 top-1/2 -translate-y-1/2 h-2 w-2 rounded-full bg-primary" />
      )}

      {/* Icono */}
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${getColorClass()}`}
      >
        {getIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-1 min-w-0">
        {/* Title */}
        <p className="text-sm font-medium leading-tight">{notification.title}</p>

        {/* Message */}
        <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>

        {/* Time */}
        <p className="text-xs text-muted-foreground">{getRelativeTime()}</p>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        {!notification.read && onMarkAsRead && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleMarkAsRead}
            title={t.notifications_btn_mark_read}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
        )}

        {onDelete && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={handleDelete}
            title={t.notifications_btn_delete}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
