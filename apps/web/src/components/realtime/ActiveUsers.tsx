// apps/web/src/components/realtime/ActiveUsers.tsx

'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ActiveUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  joinedAt: string;
  lastActivity: string;
}

interface ActiveUsersProps {
  users: ActiveUser[];
  maxVisible?: number;
  showCount?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ActiveUsers({
  users,
  maxVisible = 5,
  showCount = true,
  size = 'md',
  className,
}: ActiveUsersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const visibleUsers = isExpanded ? users : users.slice(0, maxVisible);
  const hiddenCount = users.length - maxVisible;

  const avatarSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const avatarSize = avatarSizes[size];

  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <div className="flex items-center -space-x-2">
        {visibleUsers.map((user, index) => (
          <UserAvatar
            key={user.id}
            user={user}
            size={avatarSize}
            zIndex={visibleUsers.length - index}
          />
        ))}

        {hiddenCount > 0 && !isExpanded && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setIsExpanded(true)}
                  className={cn(
                    'flex items-center justify-center rounded-full bg-muted border-2 border-background hover:bg-muted/80 transition-colors cursor-pointer',
                    avatarSize
                  )}
                  style={{ zIndex: 0 }}
                >
                  <span className="text-xs font-medium text-muted-foreground">+{hiddenCount}</span>
                </button>
              </TooltipTrigger>
              <TooltipContent className="bg-[#1a1a1a] border-[#2a2a2a]">
                <p className="text-sm">Ver todos los usuarios activos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {showCount && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="font-medium">{users.length}</span>
          <span className="hidden sm:inline">
            {users.length === 1 ? 'usuario activo' : 'usuarios activos'}
          </span>
        </div>
      )}

      {isExpanded && hiddenCount > 0 && (
        <button
          onClick={() => setIsExpanded(false)}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Mostrar menos
        </button>
      )}
    </div>
  );
}

function UserAvatar({ user, size, zIndex }: { user: ActiveUser; size: string; zIndex: number }) {
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const timeActive = getTimeActive(user.joinedAt);
  const bgColor = getUserColor(user.id);

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          <div
            className="relative transition-transform hover:scale-110 hover:z-50"
            style={{ zIndex }}
          >
            <Avatar className={cn(size, 'border-2 border-background cursor-pointer')}>
              {user.avatar ? (
                <AvatarImage src={user.avatar} alt={user.name} />
              ) : (
                <AvatarFallback className={bgColor}>
                  <span className="text-xs font-semibold text-white">{initials}</span>
                </AvatarFallback>
              )}
            </Avatar>

            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"
              aria-label="Usuario activo"
            />
          </div>
        </TooltipTrigger>

        {/* ✅ Tooltip con colores oscuros personalizados */}
        <TooltipContent
          side="bottom"
          className="max-w-xs bg-[#1a1a1a] border-[#2a2a2a] text-[#e0e0e0]"
        >
          <div className="space-y-1">
            <p className="font-semibold text-white">{user.name}</p>
            <p className="text-xs text-gray-400">{user.email}</p>
            <p className="text-xs text-gray-500">Activo hace {timeActive}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function getUserColor(userId: string): string {
  const colors = [
    'bg-blue-500',
    'bg-purple-500',
    'bg-pink-500',
    'bg-orange-500',
    'bg-teal-500',
    'bg-indigo-500',
    'bg-rose-500',
    'bg-cyan-500',
    'bg-amber-500',
    'bg-emerald-500',
  ];

  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

function getTimeActive(joinedAt: string): string {
  const now = new Date();
  const joined = new Date(joinedAt);
  const diffMs = now.getTime() - joined.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'menos de 1 min';
  if (diffMins < 60) return `${diffMins} min`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours} h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
}

export function ActiveUsersCompact({
  users,
  maxVisible = 3,
}: {
  users: ActiveUser[];
  maxVisible?: number;
}) {
  return <ActiveUsers users={users} maxVisible={maxVisible} showCount={false} size="sm" />;
}

export function ActiveUsersExpandable({
  users,
  className,
}: {
  users: ActiveUser[];
  className?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (users.length === 0) return null;

  return (
    <div className={cn('relative', className)}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted transition-colors"
      >
        <div className="flex -space-x-2">
          {users.slice(0, 3).map((user, index) => {
            const initials = user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <Avatar key={user.id} className="h-6 w-6 border-2 border-background">
                {user.avatar ? (
                  <AvatarImage src={user.avatar} alt={user.name} />
                ) : (
                  <AvatarFallback className={getUserColor(user.id)}>
                    <span className="text-[10px] font-semibold text-white">{initials}</span>
                  </AvatarFallback>
                )}
              </Avatar>
            );
          })}
        </div>

        <span className="text-sm font-medium">
          {users.length} {users.length === 1 ? 'usuario' : 'usuarios'}
        </span>
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* ✅ Popover con tema oscuro */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-lg z-50 p-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm mb-3 text-white">Usuarios activos</h4>

              {users.map((user) => {
                const initials = user.name
                  .split(' ')
                  .map((n) => n[0])
                  .join('')
                  .toUpperCase()
                  .slice(0, 2);

                return (
                  <div key={user.id} className="flex items-center gap-2">
                    <Avatar className="h-8 w-8">
                      {user.avatar ? (
                        <AvatarImage src={user.avatar} alt={user.name} />
                      ) : (
                        <AvatarFallback className={getUserColor(user.id)}>
                          <span className="text-xs font-semibold text-white">{initials}</span>
                        </AvatarFallback>
                      )}
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate text-white">{user.name}</p>
                      <p className="text-xs text-gray-400 truncate">{user.email}</p>
                    </div>

                    <div className="h-2 w-2 rounded-full bg-green-500" />
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
