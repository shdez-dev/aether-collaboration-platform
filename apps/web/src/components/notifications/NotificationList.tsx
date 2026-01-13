// apps/web/src/components/notifications/NotificationList.tsx

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { NotificationItem } from './NotificationItem';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Loader2, Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '@/hooks/useNotifications';

interface NotificationListProps {
  /**
   * Callback para cerrar el dropdown
   */
  onClose?: () => void;

  /**
   * Altura máxima del scroll
   */
  maxHeight?: string;
}

export function NotificationList({ onClose, maxHeight = '400px' }: NotificationListProps) {
  const router = useRouter();

  const {
    notifications,
    unreadCount,
    hasUnread,
    isLoading,
    loadNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  // Cargar notificaciones solo si no hay datos
  useEffect(() => {
    if (notifications.length === 0 && !isLoading) {
      loadNotifications();
    }
  }, []); // ← Solo al montar, no cada vez que se abre

  /**
   * Navegar a la página completa de notificaciones
   */
  const handleViewAll = () => {
    onClose?.();
    router.push('/dashboard/notifications');
  };

  /**
   * Loading state
   */
  if (isLoading) {
    return (
      <div className="flex h-[200px] w-[380px] items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <p className="text-sm">Cargando notificaciones...</p>
        </div>
      </div>
    );
  }

  /**
   * Empty state
   */
  if (!isLoading && notifications.length === 0) {
    return (
      <div className="w-[380px] p-6">
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-8 text-center">
          <Bell className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium">No hay notificaciones</p>
          <p className="text-xs text-muted-foreground mt-1">
            Te notificaremos cuando haya novedades
          </p>
        </div>
      </div>
    );
  }

  /**
   * Lista con notificaciones
   */
  return (
    <div className="w-[380px]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Notificaciones</h3>
          {hasUnread && (
            <span className="flex h-5 items-center justify-center rounded-full bg-primary px-2 text-xs font-medium text-primary-foreground">
              {unreadCount}
            </span>
          )}
        </div>

        {/* Botón marcar todas como leídas */}
        {hasUnread && (
          <Button variant="ghost" size="sm" onClick={markAllAsRead} className="h-7 text-xs">
            <CheckCheck className="mr-1.5 h-3.5 w-3.5" />
            Marcar todas
          </Button>
        )}
      </div>

      {/* Lista con scroll */}
      <ScrollArea style={{ maxHeight }}>
        <div className="divide-y">
          {notifications.map((notification) => (
            <NotificationItem
              key={notification.id}
              notification={notification}
              onMarkAsRead={markAsRead}
              onDelete={deleteNotification}
              onClose={onClose}
            />
          ))}
        </div>
      </ScrollArea>

      {/* Footer con botón "Ver todas" */}
      <Separator />
      <div className="p-2">
        <Button variant="ghost" size="sm" className="w-full text-xs" onClick={handleViewAll}>
          Ver todas las notificaciones
        </Button>
      </div>
    </div>
  );
}
