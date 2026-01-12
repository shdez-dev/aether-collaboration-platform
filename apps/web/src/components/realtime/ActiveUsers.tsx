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

/**
 * Componente ActiveUsers
 * Muestra avatares de usuarios activos en el board
 * Con tooltips y contador de usuarios
 */
export function ActiveUsers({
  users,
  maxVisible = 5,
  showCount = true,
  size = 'md',
  className,
}: ActiveUsersProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // Usuarios visibles
  const visibleUsers = isExpanded ? users : users.slice(0, maxVisible);
  const hiddenCount = users.length - maxVisible;

  // Tamaños de avatar según prop size
  const avatarSizes = {
    sm: 'h-7 w-7',
    md: 'h-9 w-9',
    lg: 'h-11 w-11',
  };

  const avatarSize = avatarSizes[size];

  // Si no hay usuarios, no mostrar nada
  if (users.length === 0) {
    return null;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      {/* Avatares de usuarios */}
      <div className="flex items-center -space-x-2">
        {visibleUsers.map((user, index) => (
          <UserAvatar
            key={user.id}
            user={user}
            size={avatarSize}
            zIndex={visibleUsers.length - index}
          />
        ))}

        {/* Botón de "más usuarios" */}
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
              <TooltipContent>
                <p className="text-sm">Ver todos los usuarios activos</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Contador de usuarios (opcional) */}
      {showCount && (
        <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Users className="h-4 w-4" />
          <span className="font-medium">{users.length}</span>
          <span className="hidden sm:inline">
            {users.length === 1 ? 'usuario activo' : 'usuarios activos'}
          </span>
        </div>
      )}

      {/* Botón para colapsar (si está expandido) */}
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

/**
 * Componente individual de avatar de usuario
 */
function UserAvatar({ user, size, zIndex }: { user: ActiveUser; size: string; zIndex: number }) {
  // Generar iniciales del nombre
  const initials = user.name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  // Tiempo desde que se unió
  const timeActive = getTimeActive(user.joinedAt);

  // Color de fondo basado en el ID del usuario (consistente)
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

            {/* Indicador de actividad (punto verde) */}
            <span
              className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-background"
              aria-label="Usuario activo"
            />
          </div>
        </TooltipTrigger>

        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">{user.name}</p>
            <p className="text-xs text-muted-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground">Activo hace {timeActive}</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Generar color consistente basado en el ID del usuario
 */
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

  // Generar índice basado en el hash del userId
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Calcular tiempo desde que el usuario se unió
 */
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

/**
 * Variante compacta del componente (solo avatares, sin contador)
 */
export function ActiveUsersCompact({
  users,
  maxVisible = 3,
}: {
  users: ActiveUser[];
  maxVisible?: number;
}) {
  return <ActiveUsers users={users} maxVisible={maxVisible} showCount={false} size="sm" />;
}

/**
 * Variante con lista expandible (muestra lista completa en popover)
 */
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

      {/* Lista expandida */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />

          {/* Popover */}
          <div className="absolute top-full right-0 mt-2 w-64 bg-popover border rounded-lg shadow-lg z-50 p-3">
            <div className="space-y-2">
              <h4 className="font-semibold text-sm mb-3">Usuarios activos</h4>

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
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
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
