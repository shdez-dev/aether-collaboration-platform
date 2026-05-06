// apps/web/src/hooks/useBoardCursors.ts
'use client';

import { useEffect, useRef, useCallback, useState, RefObject } from 'react';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';

export interface RemoteCursor {
  userId: string;
  name: string;
  /** Porcentaje horizontal dentro del contenedor visible (0–100) */
  x: number;
  /** Porcentaje vertical dentro del contenedor visible (0–100) */
  y: number;
  color: string;
}

const CURSOR_COLORS = [
  '#3b82f6', // blue
  '#a855f7', // purple
  '#ec4899', // pink
  '#f97316', // orange
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f43f5e', // rose
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
];

function getCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Rastrea posición de cursores de otros usuarios en un board.
 *
 * - Emite la posición local del ratón al servidor (throttled a 25 fps).
 * - Escucha las posiciones de otros usuarios y las expone como `cursors`.
 * - Limpia cursores cuando un usuario abandona el board (vía `presence:users`).
 *
 * Las coordenadas son porcentaje (0–100) del contenedor visible para que
 * funcionen independientemente de la resolución de pantalla.
 */
export function useBoardCursors(
  boardId: string | null,
  containerRef: RefObject<HTMLElement | null>
): { cursors: RemoteCursor[] } {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const lastEmitRef = useRef<number>(0);
  const user = useAuthStore((s) => s.user);

  // ── Escuchar movimientos de cursores remotos ───────────────────────────────
  useEffect(() => {
    if (!boardId) return;

    const handler = (data: { userId: string; name: string; x: number; y: number }) => {
      if (data.userId === user?.id) return;
      setCursors((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          userId: data.userId,
          name: data.name,
          x: data.x,
          y: data.y,
          color: getCursorColor(data.userId),
        });
        return next;
      });
    };

    socketService.onCursorMoved(handler);
    return () => socketService.offCursorMoved(handler);
  }, [boardId, user?.id]);

  // ── Limpiar cursores cuando un usuario abandona el board ──────────────────
  useEffect(() => {
    if (!boardId) return;

    const handler = (data: { boardId: string; users: Array<{ id: string }> }) => {
      if (data.boardId !== boardId) return;
      const activeIds = new Set(data.users.map((u) => u.id));
      setCursors((prev) => {
        let changed = false;
        const next = new Map(prev);
        for (const uid of next.keys()) {
          if (!activeIds.has(uid)) { next.delete(uid); changed = true; }
        }
        return changed ? next : prev;
      });
    };

    socketService.on('presence:users', handler);
    return () => socketService.off('presence:users', handler);
  }, [boardId]);

  // Limpiar todos los cursores al cambiar de board
  useEffect(() => {
    setCursors(new Map());
  }, [boardId]);

  // ── Emitir posición local del ratón ───────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!boardId || !containerRef.current) return;

      // Throttle a ~25 fps (40 ms)
      const now = Date.now();
      if (now - lastEmitRef.current < 40) return;
      lastEmitRef.current = now;

      const rect = containerRef.current.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));

      socketService.emitCursorMove(boardId, x, y);
    },
    [boardId, containerRef]
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el || !boardId) return;

    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, [boardId, containerRef, handleMouseMove]);

  return { cursors: Array.from(cursors.values()) };
}
