'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { BellRing, X } from 'lucide-react';
import type { Notification } from '@aether/types';
import { useNotificationStore } from '@/stores/notificationStore';

function NotificationPopup({ notification }: { notification: Notification }) {
  const dismissPopup = useNotificationStore((s) => s.dismissPopup);

  useEffect(() => {
    const timer = window.setTimeout(() => dismissPopup(notification.id), 6000);
    return () => window.clearTimeout(timer);
  }, [dismissPopup, notification.id]);

  return (
    <div className="notification-popup" role="status" aria-live="polite">
      <div className="notification-popup-icon"><BellRing size={18} aria-hidden="true" /></div>
      <Link className="notification-popup-content" href="/dashboard/notifications" onClick={() => dismissPopup(notification.id)}>
        <span className="notification-popup-label">Nueva notificación</span>
        <strong>{notification.title}</strong>
        <span>{notification.message}</span>
      </Link>
      <button className="notification-popup-close" type="button" aria-label="Cerrar notificación" onClick={() => dismissPopup(notification.id)}>
        <X size={15} aria-hidden="true" />
      </button>
    </div>
  );
}

export function NotificationPopupHost({ sidebarCompact }: { sidebarCompact: boolean }) {
  const notifications = useNotificationStore((s) => s.popupNotifications);

  if (notifications.length === 0) return null;

  return (
    <div className={`notification-popup-host${sidebarCompact ? ' is-compact' : ''}`} aria-label="Notificaciones recientes">
      {notifications.map((notification) => <NotificationPopup key={notification.id} notification={notification} />)}
    </div>
  );
}
