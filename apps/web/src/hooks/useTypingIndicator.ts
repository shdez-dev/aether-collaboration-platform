// apps/web/src/hooks/useTypingIndicator.ts

import { useEffect, useRef, useCallback } from 'react';
import { socketService } from '@/services/socketService';

interface UseTypingIndicatorOptions {
  /**
   * ID de la card donde se está escribiendo
   */
  cardId: string;

  /**
   * Si el usuario está escribiendo actualmente
   */
  isTyping: boolean;

  /**
   * Delay en ms antes de emitir "dejó de escribir"
   * @default 500
   */
  debounceMs?: number;

  /**
   * Si está deshabilitado (no emite eventos)
   * @default false
   */
  disabled?: boolean;
}

/**
 * Hook para detectar cuando el usuario está escribiendo
 * y emitir eventos de typing a otros usuarios
 *
 * @example
 * ```tsx
 * function CardModal({ cardId }: { cardId: string }) {
 *   const [description, setDescription] = useState('');
 *   const [isFocused, setIsFocused] = useState(false);
 *
 *   // Detectar typing automáticamente
 *   useTypingIndicator({
 *     cardId,
 *     isTyping: isFocused && description.length > 0
 *   });
 *
 *   return (
 *     <textarea
 *       value={description}
 *       onChange={(e) => setDescription(e.target.value)}
 *       onFocus={() => setIsFocused(true)}
 *       onBlur={() => setIsFocused(false)}
 *     />
 *   );
 * }
 * ```
 */
export function useTypingIndicator({
  cardId,
  isTyping,
  debounceMs = 500,
  disabled = false,
}: UseTypingIndicatorOptions) {
  const isTypingRef = useRef(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Limpiar timeout al desmontar
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, []);

  // Emitir evento de "empezó a escribir"
  const emitTypingStart = useCallback(() => {
    if (disabled || !socketService.isConnected()) return;

    socketService.startTyping(cardId);
    isTypingRef.current = true;
  }, [cardId, disabled]);

  // Emitir evento de "dejó de escribir"
  const emitTypingStop = useCallback(() => {
    if (disabled || !socketService.isConnected()) return;

    socketService.stopTyping(cardId);
    isTypingRef.current = false;
  }, [cardId, disabled]);

  // Efecto principal: detectar cambios en isTyping
  useEffect(() => {
    if (disabled) return;

    if (isTyping) {
      // Usuario está escribiendo
      if (!isTypingRef.current) {
        emitTypingStart();
      }

      // Limpiar timeout anterior si existe
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      // Programar "dejó de escribir" con debounce
      timeoutRef.current = setTimeout(() => {
        emitTypingStop();
      }, debounceMs);
    } else {
      // Usuario dejó de escribir inmediatamente
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (isTypingRef.current) {
        emitTypingStop();
      }
    }

    // Cleanup: emitir stop al desmontar o cambiar cardId
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (isTypingRef.current) {
        emitTypingStop();
      }
    };
  }, [isTyping, cardId, disabled, debounceMs, emitTypingStart, emitTypingStop]);
}

/**
 * Hook para escuchar cuando OTROS usuarios están escribiendo
 *
 * @example
 * ```tsx
 * function CardModal({ cardId }: { cardId: string }) {
 *   const typingUsers = useTypingListeners(cardId);
 *
 *   return (
 *     <div>
 *       <TypingIndicator typingUsers={typingUsers} />
 *       <textarea ... />
 *     </div>
 *   );
 * }
 * ```
 */
export function useTypingListeners(cardId: string) {
  const [typingUsers, setTypingUsers] = useState<Array<{ userId: string; userName: string }>>([]);

  useEffect(() => {
    // Listener para cuando alguien empieza a escribir
    const handleTypingStarted = (data: { cardId: string; userId: string; userName: string }) => {
      if (data.cardId !== cardId) return;


      setTypingUsers((prev) => {
        // Evitar duplicados
        if (prev.some((u) => u.userId === data.userId)) {
          return prev;
        }
        return [...prev, { userId: data.userId, userName: data.userName }];
      });
    };

    // Listener para cuando alguien deja de escribir
    const handleTypingStopped = (data: { cardId: string; userId: string }) => {
      if (data.cardId !== cardId) return;


      setTypingUsers((prev) => prev.filter((u) => u.userId !== data.userId));
    };

    // Suscribirse a eventos
    socketService.onTypingStarted(handleTypingStarted);
    socketService.onTypingStopped(handleTypingStopped);

    // Cleanup: limpiar listeners y usuarios
    return () => {
      socketService.off('typing:started', handleTypingStarted);
      socketService.off('typing:stopped', handleTypingStopped);
      setTypingUsers([]);
    };
  }, [cardId]);

  return typingUsers;
}

// Agregar import de useState
import { useState } from 'react';
