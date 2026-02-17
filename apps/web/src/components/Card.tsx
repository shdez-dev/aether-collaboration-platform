// apps/web/src/components/Card.tsx
'use client';

import { Card as CardType } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, memo } from 'react';

interface CardProps {
  card: CardType;
}

const priorityConfig = {
  LOW: {
    color: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
    label: 'Baja',
    icon: '▼',
  },
  MEDIUM: {
    color: 'bg-warning/10 text-warning border-warning/30',
    label: 'Media',
    icon: '■',
  },
  HIGH: {
    color: 'bg-error/10 text-error border-error/30',
    label: 'Alta',
    icon: '▲',
  },
};

const MONTHS_SHORT = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

export function Card({ card }: CardProps) {
  // Optimización: Solo extraer lo que necesitamos del store
  const updateCard = useCardStore((state) => state.updateCard);
  const setSelectedCard = useCardStore((state) => state.setSelectedCard);
  const accessToken = useAuthStore((state) => state.accessToken);
  const userRole = useWorkspaceStore((state) => state.currentWorkspace?.userRole);

  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  // ✅ PERMISOS ACTUALIZADOS:
  // OWNER y ADMIN: pueden editar campos (título, descripción, etc.)
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';

  // OWNER, ADMIN y MEMBER: pueden arrastrar cards
  const canDrag = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
    disabled: !canDrag, // ✅ Cambiado de canEdit a canDrag
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : card.completed ? 0.7 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    setSelectedCard(card);
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();

    if (!canEdit || isTogglingComplete || isBlocked) return;

    setIsTogglingComplete(true);
    const newCompletedState = !card.completed;

    updateCard(card.id, {
      completed: newCompletedState,
      completedAt: newCompletedState ? new Date().toISOString() : undefined,
    });

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/cards/${card.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          completed: newCompletedState,
          completedAt: newCompletedState ? new Date().toISOString() : null,
        }),
      });

      if (!response.ok) {
        const json = await response.json().catch(() => ({}));
        // Rollback optimistic update
        updateCard(card.id, { completed: card.completed, completedAt: card.completedAt });
        if (json?.error?.code === 'BLOCKED_BY_DEPENDENCY') {
          // El backend rechazó el completado por dependencias bloqueantes
          console.warn('Card bloqueada por dependencias:', json.error.message);
        } else {
          console.error('Error al actualizar tarjeta:', json);
        }
        return;
      }

      const { data } = await response.json();
      updateCard(card.id, data.card);
    } catch (error) {
      console.error('Error al cambiar estado de completado:', error);
      updateCard(card.id, {
        completed: card.completed,
        completedAt: card.completedAt,
      });
    } finally {
      setIsTogglingComplete(false);
    }
  };

  const formatDueDate = (date: string) => {
    const dueDate = new Date(date);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    const day = dueDate.getDate();
    const month = MONTHS_SHORT[dueDate.getMonth()];
    const dateText = `${day} ${month}`;

    if (diffDays < 0) return { text: dateText, color: 'text-error', isOverdue: true };
    if (diffDays === 0) return { text: 'Hoy', color: 'text-warning', isOverdue: false };
    if (diffDays <= 3) return { text: dateText, color: 'text-warning', isOverdue: false };
    return { text: dateText, color: 'text-text-muted', isOverdue: false };
  };

  const dueDate = card.dueDate ? formatDueDate(card.dueDate) : null;
  const priority = card.priority ? priorityConfig[card.priority] : null;
  const commentCount = (card as any)._count?.comments || 0;

  const labels = (card as any).labels || [];
  const visibleLabels = labels.slice(0, 3);
  const remainingLabels = labels.length > 3 ? labels.length - 3 : 0;

  // Progreso del checklist (solo disponible si la card fue abierta al menos 1 vez)
  const checklistItems: Array<{ completed: boolean }> = card.checklistItems || [];
  const checklistTotal = checklistItems.length;
  const checklistDone = checklistItems.filter((i) => i.completed).length;
  const checklistPct = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  // Dependencias (disponibles después de abrir la card al menos 1 vez)
  const blockedByPendingCount = card.blockedByPendingCount ?? 0;
  const blockingCount = card.blockingCount ?? 0;
  const isBlocked = blockedByPendingCount > 0 && !card.completed;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      onClick={handleClick}
      className={`
        bg-card border rounded-lg p-3
        transition-all cursor-pointer
        ${isDragging ? 'cursor-grabbing shadow-xl border-accent' : canDrag ? 'cursor-grab' : 'cursor-pointer'}
        ${
          card.completed
            ? 'border-success/30 bg-success/5'
            : 'border-border hover:bg-surface hover:border-accent/50 hover:shadow-lg'
        }
      `}
    >
      {/* Checkbox + Título */}
      <div className="pb-2 border-b border-border/30 flex items-start gap-2">
        {/* CHECKBOX DE COMPLETADO - Solo ADMIN y OWNER pueden completar; bloqueado si hay dependencias pendientes */}
        <button
          onClick={handleToggleComplete}
          disabled={!canEdit || isTogglingComplete || isBlocked}
          title={
            isBlocked
              ? `Bloqueada por ${blockedByPendingCount} dependencia${blockedByPendingCount !== 1 ? 's' : ''} pendiente${blockedByPendingCount !== 1 ? 's' : ''}`
              : !canEdit
                ? 'Sin permisos para completar'
                : card.completed
                  ? 'Marcar como pendiente'
                  : 'Marcar como completada'
          }
          className={`
            mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 
            flex items-center justify-center transition-all
            ${
              isBlocked
                ? 'border-warning/50 bg-warning/10 cursor-not-allowed'
                : card.completed
                  ? 'bg-success border-success hover:bg-success/80 cursor-pointer'
                  : canEdit
                    ? 'border-border hover:border-accent cursor-pointer'
                    : 'border-border cursor-not-allowed opacity-50'
            }
          `}
        >
          {isBlocked ? (
            <svg
              className="w-2.5 h-2.5 text-warning"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          ) : card.completed ? (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={3}
                d="M5 13l4 4L19 7"
              />
            </svg>
          ) : null}
        </button>

        {/* Título */}
        <h4
          className={`
            text-[15px] font-medium leading-relaxed flex-1
            ${card.completed ? 'text-text-muted line-through' : 'text-text-primary'}
          `}
        >
          {card.title}
        </h4>
      </div>

      {/* Task ID */}
      <div className="py-1.5 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-xs text-text-muted">
          <span>#</span>
          <span>ID Tarea</span>
        </div>
        <div className="text-xs text-text-primary font-mono">{card.id.slice(0, 8)}</div>
      </div>

      {/* Due Date */}
      {dueDate && (
        <div className="py-1.5 border-b border-border/30 flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-text-muted">
            <svg
              className="w-3 h-3 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>Fecha límite</span>
          </div>
          <div className={`${dueDate.color} text-xs font-medium`}>{dueDate.text}</div>
        </div>
      )}

      {/* Priority */}
      {priority && (
        <div className="py-1.5 border-b border-border/30 flex items-center justify-between">
          <div className="text-xs text-text-muted">Prioridad</div>
          <div
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border ${priority.color} text-[10px] font-medium uppercase`}
          >
            <span>{priority.icon}</span>
            <span>{priority.label}</span>
          </div>
        </div>
      )}

      {/* Assigned Members */}
      {card.members && card.members.length > 0 && (
        <div className="py-1.5 border-b border-border/30 flex items-center justify-between">
          <div className="text-xs text-text-muted">Asignados</div>
          <div className="flex -space-x-1.5">
            {card.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold border-2 border-card ring-1 ring-border"
                title={member.name}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {card.members.length > 3 && (
              <div className="w-6 h-6 rounded-full bg-surface text-text-secondary flex items-center justify-center text-[10px] font-bold border-2 border-card ring-1 ring-border">
                +{card.members.length - 3}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Checklist progress bar */}
      {checklistTotal > 0 && (
        <div className="py-1.5 border-b border-border/30">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-text-muted flex-shrink-0">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                />
              </svg>
              <span>
                {checklistDone}/{checklistTotal}
              </span>
            </div>
            <div className="flex-1 h-1 bg-surface border border-border/50 overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${checklistPct === 100 ? 'bg-success' : 'bg-accent'}`}
                style={{ width: `${checklistPct}%` }}
              />
            </div>
            <span
              className={`text-[10px] font-mono w-7 text-right ${checklistPct === 100 ? 'text-success' : 'text-text-muted'}`}
            >
              {checklistPct}%
            </span>
          </div>
        </div>
      )}

      {/* Footer: comentarios · dependencias · labels · completado */}
      <div className="pt-2 flex items-center justify-between gap-2 min-w-0">
        {/* Izquierda: comentarios + dependencias */}
        <div className="flex items-center gap-2.5 min-w-0 flex-shrink-0">
          {/* Comentarios */}
          <div
            className="flex items-center gap-1 text-text-muted"
            title={`${commentCount} comentario${commentCount !== 1 ? 's' : ''}`}
          >
            <svg
              className="w-3.5 h-3.5 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
            <span className="text-xs font-medium">{commentCount}</span>
          </div>

          {/* Dependencias: solo iconos + números */}
          {isBlocked && (
            <div
              className="flex items-center gap-1 text-warning"
              title={`Bloqueada por ${blockedByPendingCount} dependencia${blockedByPendingCount !== 1 ? 's' : ''} pendiente${blockedByPendingCount !== 1 ? 's' : ''}`}
            >
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
              <span className="text-xs font-medium">{blockedByPendingCount}</span>
            </div>
          )}
          {!isBlocked && blockingCount > 0 && (
            <div
              className="flex items-center gap-1 text-text-muted"
              title={`Bloquea a ${blockingCount} card${blockingCount !== 1 ? 's' : ''}`}
            >
              <svg
                className="w-3 h-3 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              <span className="text-xs font-medium">{blockingCount}</span>
            </div>
          )}
        </div>

        {/* Derecha: labels + completado */}
        <div className="flex items-center gap-2 min-w-0 justify-end flex-1">
          {/* Labels: puntos de color */}
          {labels.length > 0 && (
            <div className="flex items-center gap-1 flex-shrink-0">
              {visibleLabels.map((label: any) => (
                <div
                  key={label.id}
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                  title={label.name}
                />
              ))}
              {remainingLabels > 0 && (
                <span
                  className="text-[10px] text-text-muted font-medium"
                  title={`${remainingLabels} etiquetas más`}
                >
                  +{remainingLabels}
                </span>
              )}
            </div>
          )}

          {/* Badge completado */}
          {card.completed && (
            <div title="Completada">
              <svg
                className="w-3.5 h-3.5 text-success flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Memoizar para evitar re-renders innecesarios cuando las props no cambian
export default memo(Card, (prevProps, nextProps) => {
  // Solo re-renderizar si la card realmente cambió
  return (
    prevProps.card.id === nextProps.card.id &&
    prevProps.card.title === nextProps.card.title &&
    prevProps.card.position === nextProps.card.position &&
    prevProps.card.completed === nextProps.card.completed &&
    prevProps.card.dueDate === nextProps.card.dueDate &&
    prevProps.card.priority === nextProps.card.priority &&
    prevProps.card.members?.length === nextProps.card.members?.length &&
    prevProps.card.labels?.length === nextProps.card.labels?.length &&
    prevProps.card.checklistItems?.length === nextProps.card.checklistItems?.length &&
    prevProps.card.checklistItems?.filter((i) => i.completed).length ===
      nextProps.card.checklistItems?.filter((i) => i.completed).length &&
    prevProps.card.blockedByPendingCount === nextProps.card.blockedByPendingCount &&
    prevProps.card.blockingCount === nextProps.card.blockingCount
  );
});
