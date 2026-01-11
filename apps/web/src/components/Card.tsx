// apps/web/src/components/Card.tsx
'use client';

import { Card as CardType } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

interface CardProps {
  card: CardType;
}

// Mapeo de prioridad a colores y símbolos
const priorityConfig = {
  LOW: { color: 'border-l-success', symbol: '▼', textColor: 'text-success' },
  MEDIUM: { color: 'border-l-warning', symbol: '■', textColor: 'text-warning' },
  HIGH: { color: 'border-l-error', symbol: '▲', textColor: 'text-error' },
};

export function Card({ card }: CardProps) {
  const setSelectedCard = useCardStore((state) => state.setSelectedCard);

  // Configurar sortable para drag & drop
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: {
      type: 'card',
      card,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const handleClick = (e: React.MouseEvent) => {
    // No abrir modal si se está arrastrando
    if (isDragging) return;
    setSelectedCard(card);
  };

  // Formatear fecha de vencimiento
  const formatDueDate = (date: string) => {
    const dueDate = new Date(date);
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { text: 'Overdue', color: 'text-error' };
    if (diffDays === 0) return { text: 'Today', color: 'text-warning' };
    if (diffDays === 1) return { text: 'Tomorrow', color: 'text-warning' };
    return { text: dueDate.toLocaleDateString(), color: 'text-text-muted' };
  };

  const dueDate = card.dueDate ? formatDueDate(card.dueDate) : null;
  const priority = card.priority ? priorityConfig[card.priority] : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={handleClick}
      className={`
        bg-card border border-border rounded-terminal p-3
        ${priority ? priority.color : 'border-l-border'}
        border-l-4
        hover:bg-card-hover hover:border-border-light
        transition-colors cursor-pointer
        group
        ${isDragging ? 'cursor-grabbing' : 'cursor-grab'}
      `}
    >
      {/* Header: Título y prioridad */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-sm font-normal text-text-primary flex-1 leading-snug">{card.title}</h4>
        {priority && (
          <span className={`text-xs ${priority.textColor}`} title={card.priority}>
            {priority.symbol}
          </span>
        )}
      </div>

      {/* Labels */}
      {card.labels && card.labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {card.labels.map((label) => (
            <span
              key={label.id}
              className="px-2 py-0.5 rounded-terminal text-xs font-mono"
              style={{
                backgroundColor: label.color,
                color: '#fff',
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
      )}

      {/* Footer: Metadata */}
      <div className="flex items-center justify-between text-xs text-text-muted">
        {/* Fecha de vencimiento */}
        {dueDate && (
          <div className={`flex items-center gap-1 ${dueDate.color}`}>
            <span>◷</span>
            <span className="font-mono">{dueDate.text}</span>
          </div>
        )}

        {/* Miembros asignados */}
        {card.members && card.members.length > 0 && (
          <div className="flex -space-x-2">
            {card.members.slice(0, 3).map((member) => (
              <div
                key={member.id}
                className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-xs font-mono border-2 border-card"
                title={member.name}
              >
                {member.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {card.members.length > 3 && (
              <div className="w-5 h-5 rounded-full bg-surface text-text-muted flex items-center justify-center text-xs font-mono border-2 border-card">
                +{card.members.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
