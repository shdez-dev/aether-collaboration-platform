// apps/web/src/components/Card.tsx
'use client';

import { Card as CardType } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState } from 'react';

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

// ✅ Función para calcular contraste de texto
function getTextColor(hexColor: string): string {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substr(0, 2), 16);
  const g = parseInt(hex.substr(2, 2), 16);
  const b = parseInt(hex.substr(4, 2), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (luminance > 0.7) {
    return 'rgba(0, 0, 0, 0.85)';
  } else if (luminance > 0.5) {
    return 'rgba(0, 0, 0, 0.75)';
  } else if (luminance > 0.3) {
    return 'rgba(255, 255, 255, 0.95)';
  } else {
    return 'rgba(255, 255, 255, 1)';
  }
}

export function Card({ card }: CardProps) {
  const setSelectedCard = useCardStore((state) => state.setSelectedCard);
  const updateCard = useCardStore((state) => state.updateCard);
  const { accessToken } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();

  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  const userRole = currentWorkspace?.userRole;
  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
    disabled: !canEdit,
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

    if (!canEdit || isTogglingComplete) return;

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

      if (!response.ok) throw new Error('Error al actualizar tarjeta');

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

  // ✅ LABELS LOGIC
  const labels = (card as any).labels || [];
  const visibleLabels = labels.slice(0, 3);
  const remainingLabels = labels.length > 3 ? labels.length - 3 : 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...(canEdit ? attributes : {})}
      {...(canEdit ? listeners : {})}
      onClick={handleClick}
      className={`
        bg-card border rounded-lg p-3
        transition-all cursor-pointer
        ${isDragging ? 'cursor-grabbing shadow-xl border-accent' : canEdit ? 'cursor-grab' : 'cursor-pointer'}
        ${
          card.completed
            ? 'border-success/30 bg-success/5'
            : 'border-border hover:bg-surface hover:border-accent/50 hover:shadow-lg'
        }
      `}
    >
      {/* Checkbox + Título */}
      <div className="pb-2 border-b border-border/30 flex items-start gap-2">
        {/* CHECKBOX DE COMPLETADO */}
        <button
          onClick={handleToggleComplete}
          disabled={!canEdit || isTogglingComplete}
          className={`
            mt-0.5 flex-shrink-0 w-5 h-5 rounded border-2 
            flex items-center justify-center transition-all
            ${
              card.completed
                ? 'bg-success border-success hover:bg-success/80'
                : 'border-border hover:border-accent'
            }
            ${!canEdit ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
          `}
        >
          {card.completed && (
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
          )}
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

      {/* Comments + Labels + Completed Badge */}
      <div className="pt-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-text-muted">
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <span className="text-xs font-medium">{commentCount}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* LABELS DOTS */}
          {labels.length > 0 && (
            <div className="flex items-center gap-1">
              {visibleLabels.map((label: any) => (
                <div
                  key={label.id}
                  className="w-2 h-2 rounded-full"
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

          {/* BADGE DE COMPLETADO */}
          {card.completed && card.completedAt && (
            <div className="flex items-center gap-1 text-xs text-success">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <span>Completada</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
