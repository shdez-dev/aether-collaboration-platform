// apps/web/src/hooks/useBoardCursors.ts
'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';

export interface RemoteCursor {
  userId: string;
  name: string;
  x: number; // porcentaje 0–100 del contenedor
  y: number;
  color: string;
}

const CURSOR_COLORS = [
  '#3b82f6', '#a855f7', '#ec4899', '#f97316',
  '#14b8a6', '#6366f1', '#f43f5e', '#06b6d4',
  '#f59e0b', '#10b981',
];

function getCursorColor(userId: string): string {
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  }
  return CURSOR_COLORS[Math.abs(hash) % CURSOR_COLORS.length];
}

/**
 * Rastrea cursores de otros usuarios en el board.
 *
 * @param boardId  ID del board actual
 * @param el       Elemento DOM del contenedor kanban (puede ser null mientras carga)
 */
export function useBoardCursors(
  boardId: string | null,
  el: HTMLElement | null
): { cursors: RemoteCursor[] } {
  const [cursors, setCursors] = useState<Map<string, RemoteCursor>>(new Map());
  const lastEmitRef = useRef<number>(0);
  const currentUserId = useAuthStore((s) => s.user?.id);

  // ── Escuchar movimientos remotos ──────────────────────────────────────────
  useEffect(() => {
    if (!boardId) return;

    const handler = (data: { userId: string; name: string; x: number; y: number }) => {
      if (data.userId === currentUserId) return;
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
  }, [boardId, currentUserId]);

  // ── Limpiar cursores cuando alguien deja el board ─────────────────────────
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

  // Limpiar al cambiar de board
  useEffect(() => {
    setCursors(new Map());
  }, [boardId]);

  // ── Emitir posición local del ratón ───────────────────────────────────────
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!boardId || !el) return;
      const now = Date.now();
      if (now - lastEmitRef.current < 40) return; // throttle 25fps
      lastEmitRef.current = now;

      const rect = el.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100));
      socketService.emitCursorMove(boardId, x, y);
    },
    [boardId, el]
  );

  // Re-registra el listener cada vez que el elemento cambia (resuelve el ref trap)
  useEffect(() => {
    if (!el || !boardId) return;
    el.addEventListener('mousemove', handleMouseMove);
    return () => el.removeEventListener('mousemove', handleMouseMove);
  }, [el, boardId, handleMouseMove]);

  return { cursors: Array.from(cursors.values()) };
}
