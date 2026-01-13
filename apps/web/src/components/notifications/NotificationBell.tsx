// apps/web/src/components/notifications/NotificationBell.tsx

'use client';

import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { NotificationList } from './NotificationList';
import { useNotificationCount } from '@/hooks/useNotifications';
import { useNotificationStore } from '@/stores/notificationStore';

export function NotificationBell() {
  const { unreadCount, hasUnread } = useNotificationCount();
  const { isOpen, toggleDropdown, closeDropdown } = useNotificationStore();

  return (
    <DropdownMenu open={isOpen} onOpenChange={toggleDropdown}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label={`Notificaciones${hasUnread ? ` (${unreadCount} nuevas)` : ''}`}
        >
          <Bell className="h-5 w-5" />

          {/* Badge de contador */}
          {hasUnread && (
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}

          {/* Animación de pulso para notificaciones nuevas */}
          {hasUnread && (
            <span className="absolute -right-1 -top-1 h-5 w-5 animate-ping rounded-full bg-primary opacity-75" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="p-0">
        <NotificationList onClose={closeDropdown} />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
