// apps/web/src/app/dashboard/notifications/page.tsx
'use client';

import { useEffect } from 'react';
import { useNotificationStore } from '@/stores/notificationStore';
import { NotificationItem } from '@/components/notifications/NotificationItem';
import { Button } from '@/components/ui/button';
import { Loader2, Bell } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function NotificationsPage() {
  const t = useT();
  const { notifications, isLoading, fetchNotifications, markAllAsRead } = useNotificationStore();

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t.notifications_title}</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0
              ? t.notifications_unread_count(unreadCount)
              : t.notifications_no_unread}
          </p>
        </div>

        {unreadCount > 0 && (
          <Button onClick={markAllAsRead} variant="outline" size="sm">
            {t.notifications_btn_mark_all_read}
          </Button>
        )}
      </div>

      {/* Notifications List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : notifications.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <Bell className="mb-3 h-12 w-12 text-muted-foreground/50" />
          <p className="text-sm font-medium">{t.notifications_empty_title}</p>
          <p className="text-xs text-muted-foreground mt-1">{t.notifications_empty_desc}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((notification) => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </div>
      )}
    </div>
  );
}
