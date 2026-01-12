// apps/web/src/components/realtime/RealtimeToast.tsx

'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useBoardStore } from '@/stores/boardStore';
import {
  CheckCircle2,
  Trash2,
  Edit3,
  MoveRight,
  Plus,
  ListPlus,
  type LucideIcon,
} from 'lucide-react';

interface ToastEvent {
  type: string;
  message: string;
  icon: LucideIcon;
  variant?: 'default' | 'destructive';
}

export function RealtimeToast() {
  const { toast } = useToast();
  const { currentBoard } = useBoardStore();

  useEffect(() => {
    if (!currentBoard) return;

    // Suscribirse a cambios del boardStore
    // Nota: Esta es una implementación simplificada
    const unsubscribe = useBoardStore.subscribe((state) => {
      // Este callback se ejecuta cada vez que cambia el estado
      // Para una implementación completa, usa RealtimeNotificationProvider
    });

    return () => {
      unsubscribe();
    };
  }, [currentBoard, toast]);

  // Este componente no renderiza nada visible
  return null;
}

/**
 * Mapear eventos a configuración de toast
 */
function getToastConfigForEvent(event: any): ToastEvent | null {
  const { type, payload, metadata } = event;
  const userName = metadata?.user?.name || 'Alguien';

  switch (type) {
    // ========== CARD EVENTS ==========
    case 'card.created':
      return {
        type,
        message: `${userName} creó una card`,
        icon: Plus,
      };

    case 'card.updated':
      return {
        type,
        message: `${userName} actualizó una card`,
        icon: Edit3,
      };

    case 'card.moved':
      return {
        type,
        message: `${userName} movió una card`,
        icon: MoveRight,
      };

    case 'card.deleted':
      return {
        type,
        message: `${userName} eliminó una card`,
        icon: Trash2,
        variant: 'destructive',
      };

    case 'card.archived':
      return {
        type,
        message: `${userName} archivó una card`,
        icon: CheckCircle2,
      };

    // ========== LIST EVENTS ==========
    case 'list.created':
      return {
        type,
        message: `${userName} creó una lista`,
        icon: ListPlus,
      };

    case 'list.updated':
      return {
        type,
        message: `${userName} actualizó una lista`,
        icon: Edit3,
      };

    case 'list.deleted':
      return {
        type,
        message: `${userName} eliminó una lista`,
        icon: Trash2,
        variant: 'destructive',
      };

    case 'list.reordered':
      return {
        type,
        message: `${userName} reordenó las listas`,
        icon: MoveRight,
      };

    // ========== BOARD EVENTS ==========
    case 'board.updated':
      return {
        type,
        message: `${userName} actualizó el board`,
        icon: Edit3,
      };

    // No mostrar notificación para estos eventos
    case 'card.member.assigned':
    case 'card.member.unassigned':
    case 'card.label.added':
    case 'card.label.removed':
      return null;

    default:
      return null;
  }
}

/**
 * Hook para mostrar toasts manualmente desde cualquier componente
 */
export function useRealtimeToast() {
  const { toast } = useToast();

  const showSuccess = (message: string) => {
    toast({
      description: (
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      ),
      duration: 3000,
    });
  };

  const showError = (message: string) => {
    toast({
      description: (
        <div className="flex items-center gap-2">
          <Trash2 className="h-4 w-4" />
          <span>{message}</span>
        </div>
      ),
      variant: 'destructive',
      duration: 3000,
    });
  };

  const showInfo = (message: string, icon?: LucideIcon) => {
    const Icon = icon || Edit3;
    toast({
      description: (
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <span>{message}</span>
        </div>
      ),
      duration: 3000,
    });
  };

  return {
    showSuccess,
    showError,
    showInfo,
    toast, // Acceso directo al toast original si se necesita
  };
}
