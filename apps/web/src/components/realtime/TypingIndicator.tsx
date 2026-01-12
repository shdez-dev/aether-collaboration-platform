// apps/web/src/components/realtime/TypingIndicator.tsx

'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TypingUser {
  userId: string;
  userName: string;
}

interface TypingIndicatorProps {
  /** Lista de usuarios escribiendo */
  typingUsers: TypingUser[];
  /** Posición del indicador */
  position?: 'top' | 'bottom' | 'inline';
  /** Tamaño del indicador */
  size?: 'sm' | 'md' | 'lg';
  /** Clase CSS adicional */
  className?: string;
}

/**
 * TypingIndicator
 * Muestra indicador animado cuando otros usuarios están escribiendo
 *
 * @example
 * ```tsx
 * <TypingIndicator
 *   typingUsers={[
 *     { userId: '1', userName: 'Juan' },
 *     { userId: '2', userName: 'María' }
 *   ]}
 *   position="bottom"
 * />
 * ```
 */
export function TypingIndicator({
  typingUsers,
  position = 'inline',
  size = 'sm',
  className,
}: TypingIndicatorProps) {
  const [visible, setVisible] = useState(false);

  // Efecto de fade in/out
  useEffect(() => {
    if (typingUsers.length > 0) {
      setVisible(true);
    } else {
      const timer = setTimeout(() => setVisible(false), 200);
      return () => clearTimeout(timer);
    }
  }, [typingUsers.length]);

  if (!visible || typingUsers.length === 0) {
    return null;
  }

  // Generar texto según cantidad de usuarios
  const text = getTypingText(typingUsers);

  // Clases según posición
  const positionClasses = {
    top: 'absolute -top-6 left-0',
    bottom: 'absolute -bottom-6 left-0',
    inline: 'relative',
  };

  // Clases según tamaño
  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 text-muted-foreground animate-in fade-in-0 duration-200',
        positionClasses[position],
        sizeClasses[size],
        className
      )}
    >
      {/* Indicador animado de puntos */}
      <TypingDots size={size} />

      {/* Texto */}
      <span className="font-medium">{text}</span>
    </div>
  );
}

/**
 * Animación de puntos escribiendo
 */
function TypingDots({ size }: { size: 'sm' | 'md' | 'lg' }) {
  const dotSizes = {
    sm: 'h-1 w-1',
    md: 'h-1.5 w-1.5',
    lg: 'h-2 w-2',
  };

  const dotSize = dotSizes[size];

  return (
    <div className="flex items-center gap-0.5">
      <span
        className={cn('rounded-full bg-muted-foreground animate-bounce', dotSize)}
        style={{ animationDelay: '0ms', animationDuration: '1s' }}
      />
      <span
        className={cn('rounded-full bg-muted-foreground animate-bounce', dotSize)}
        style={{ animationDelay: '150ms', animationDuration: '1s' }}
      />
      <span
        className={cn('rounded-full bg-muted-foreground animate-bounce', dotSize)}
        style={{ animationDelay: '300ms', animationDuration: '1s' }}
      />
    </div>
  );
}

/**
 * Generar texto según usuarios escribiendo
 */
function getTypingText(users: TypingUser[]): string {
  const count = users.length;

  if (count === 1) {
    return `${users[0].userName} está escribiendo...`;
  }

  if (count === 2) {
    return `${users[0].userName} y ${users[1].userName} están escribiendo...`;
  }

  if (count === 3) {
    return `${users[0].userName}, ${users[1].userName} y ${users[2].userName} están escribiendo...`;
  }

  // 4 o más usuarios
  return `${users[0].userName} y ${count - 1} más están escribiendo...`;
}

/**
 * Variante compacta (solo icono animado)
 */
export function TypingIndicatorCompact({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1 text-muted-foreground', className)}>
      <Loader2 className="h-3 w-3 animate-spin" />
      <span className="text-xs">Escribiendo...</span>
    </div>
  );
}

/**
 * Variante para badge/chip
 */
export function TypingBadge({ count }: { count: number }) {
  if (count === 0) return null;

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted text-muted-foreground text-xs font-medium">
      <TypingDots size="sm" />
      <span>{count === 1 ? '1 escribiendo' : `${count} escribiendo`}</span>
    </div>
  );
}
