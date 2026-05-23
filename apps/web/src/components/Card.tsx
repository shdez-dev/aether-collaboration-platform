// apps/web/src/components/Card.tsx
'use client';

import { Card as CardType } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useState, memo } from 'react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';
import { useAuthStore } from '@/stores/authStore';

interface CardProps {
  card: CardType;
}


const PRIORITY_COLORS = {
  LOW:    { color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  MEDIUM: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  HIGH:   { color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
};

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

export function Card({ card }: CardProps) {
  const t = useT();
  const updateCard     = useCardStore((s) => s.updateCard);
  const setSelectedCard = useCardStore((s) => s.setSelectedCard);
  const userRole       = useWorkspaceStore((s) => s.currentWorkspace?.userRole);

  const PRIORITY = {
    LOW:    { label: t.card_priority_low,    ...PRIORITY_COLORS.LOW    },
    MEDIUM: { label: t.card_priority_medium, ...PRIORITY_COLORS.MEDIUM },
    HIGH:   { label: t.card_priority_high,   ...PRIORITY_COLORS.HIGH   },
  };

  const [isTogglingComplete, setIsTogglingComplete] = useState(false);

  const currentUserId = useAuthStore((s) => s.user?.id);

  const canEdit     = userRole === 'ADMIN' || userRole === 'OWNER';
  const canDragByRole = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  // Members can only complete cards that have no assignees (anyone can)
  // or cards where they are explicitly assigned.
  const cardMembers: Array<{ id: string }> = (card as any).members || [];
  const cardHasAssignees = cardMembers.length > 0;
  const isAssignedToMe   = cardMembers.some((m) => m.id === currentUserId);
  const canComplete = canEdit || (userRole === 'MEMBER' && (!cardHasAssignees || isAssignedToMe));

  const blockedByPendingCount = card.blockedByPendingCount ?? 0;
  const isBlocked = blockedByPendingCount > 0 && !card.completed;
  const canDrag = canDragByRole && !isBlocked;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: card.id,
    data: { type: 'card', card },
    disabled: !canDrag,
  });

  const dndStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : card.completed ? 0.72 : 1,
    willChange: isDragging ? 'transform' : 'auto',
  };

  const handleClick = (e: React.MouseEvent) => {
    if (isDragging) return;
    setSelectedCard(card);
  };

  const handleToggleComplete = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canComplete || isTogglingComplete || isBlocked) return;
    setIsTogglingComplete(true);
    const next = !card.completed;
    updateCard(card.id, { completed: next, completedAt: next ? new Date().toISOString() : undefined });
    try {
      const r = await apiService.put<{ card: any }>(
        `/api/cards/${card.id}`,
        { completed: next, completedAt: next ? new Date().toISOString() : null },
        true
      );
      if (!r.success) { updateCard(card.id, { completed: card.completed, completedAt: card.completedAt }); return; }
      updateCard(card.id, r.data!.card);
    } catch {
      updateCard(card.id, { completed: card.completed, completedAt: card.completedAt });
    } finally { setIsTogglingComplete(false); }
  };

  const formatDueDate = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diff = Math.ceil((d.getTime() - now.getTime()) / 86400000);
    const text = diff === 0 ? 'Hoy' : `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (diff < 0)  return { text, color: C.red   };
    if (diff === 0) return { text, color: C.amber };
    if (diff <= 3)  return { text, color: C.amber };
    return { text, color: C.text4 };
  };

  const due      = card.dueDate ? formatDueDate(card.dueDate) : null;
  const prio     = card.priority ? PRIORITY[card.priority] : null;
  const labels   = (card as any).labels || [];
  const members  = card.members || [];
  const commentCount = (card as any)._count?.comments || 0;
  const blockingCount = card.blockingCount ?? 0;

  const checklistItems: Array<{ completed: boolean }> = card.checklistItems || [];
  const checklistTotal = checklistItems.length;
  const checklistDone  = checklistItems.filter((i) => i.completed).length;
  const checklistPct   = checklistTotal > 0 ? Math.round((checklistDone / checklistTotal) * 100) : 0;

  const description = card.description ?? '';

  // Derive base border/bg from card state
  const baseBorder  = card.completed ? `${C.green}40` : isBlocked ? `${C.amber}88` : C.border;
  const baseBg      = card.completed ? `${C.green}09` : isBlocked ? `${C.amber}0e` : C.surface;
  const hoverBorder = card.completed ? `${C.green}66` : isBlocked ? `${C.amber}cc` : C.border2;
  const hoverBg     = card.completed ? `${C.green}12` : isBlocked ? `${C.amber}16` : C.hover;
  const baseShadow  = isBlocked ? `inset 3px 0 0 ${C.amber}cc` : 'none';
  const hoverShadow = isBlocked ? `inset 3px 0 0 ${C.amber}` : 'none';

  return (
    <div
      ref={setNodeRef}
      style={{
        ...dndStyle,
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        borderRadius: '8px',
        padding: '9px 10px 8px',
        cursor: isDragging ? 'grabbing' : canDrag ? 'grab' : 'pointer',
        boxShadow: baseShadow,
        transition: `${dndStyle.transition ?? ''}, border-color 0.12s, background 0.12s, box-shadow 0.12s`.trimStart().replace(/^,\s*/, ''),
      }}
      {...(canDrag ? attributes : {})}
      {...(canDrag ? listeners : {})}
      onClick={handleClick}
      onMouseEnter={(e) => {
        if (!isDragging) {
          e.currentTarget.style.borderColor = hoverBorder;
          e.currentTarget.style.background  = hoverBg;
          e.currentTarget.style.boxShadow   = hoverShadow;
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = baseBorder;
        e.currentTarget.style.background  = baseBg;
        e.currentTarget.style.boxShadow   = baseShadow;
      }}
      title={isBlocked ? `Bloqueada por ${blockedByPendingCount} dependencia${blockedByPendingCount !== 1 ? 's' : ''} pendiente${blockedByPendingCount !== 1 ? 's' : ''}` : ''}
    >
      {/* Label strips */}
      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {labels.slice(0, 4).map((label: any) => (
            <span
              key={label.id}
              title={label.name}
              style={{ display: 'inline-block', height: '4px', width: '24px', borderRadius: '2px', background: label.color }}
            />
          ))}
          {labels.length > 4 && (
            <span style={{ fontSize: '9px', color: C.text4, lineHeight: '4px', alignSelf: 'center' }}>
              +{labels.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Checkbox + Title */}
      <div className="flex items-start gap-2">
        <button
          onClick={handleToggleComplete}
          disabled={!canComplete || isTogglingComplete || isBlocked}
          title={
            isBlocked ? `Bloqueada por ${blockedByPendingCount} dep. pendiente${blockedByPendingCount !== 1 ? 's' : ''}`
            : !canComplete ? 'Sin permisos'
            : card.completed ? 'Marcar como pendiente'
            : 'Marcar como completada'
          }
          className="flex-shrink-0 flex items-center justify-center rounded-[5px] transition-colors mt-[1px]"
          style={{
            width: '16px', height: '16px',
            border: `1.5px solid ${isBlocked ? C.amber : card.completed ? C.green : C.text3}`,
            background: card.completed ? C.green : isBlocked ? `${C.amber}22` : 'transparent',
            cursor: !canComplete || isBlocked ? 'not-allowed' : 'pointer',
            flexShrink: 0,
          }}
        >
          {isBlocked ? (
            <svg viewBox="0 0 12 12" fill="none" stroke={C.amber} strokeWidth="1.5" width="8" height="8">
              <rect x="2" y="5" width="8" height="6" rx="1" /><path d="M4 5V3.5a2 2 0 014 0V5" />
            </svg>
          ) : card.completed ? (
            <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" width="8" height="8">
              <path d="M2 5l2.5 2.5 3.5-4" />
            </svg>
          ) : null}
        </button>

        <h4
          style={{
            fontSize: '12.5px',
            fontWeight: 500,
            lineHeight: 1.45,
            color: card.completed ? C.text3 : C.text,
            textDecoration: card.completed ? 'line-through' : 'none',
            flex: 1,
            wordBreak: 'break-word',
          }}
        >
          {card.title}
        </h4>
      </div>

      {/* Description preview */}
      {description && !card.completed && (
        <p
          style={{
            fontSize: '11.5px',
            color: C.text3,
            lineHeight: 1.5,
            margin: '5px 0 0 22px',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            wordBreak: 'break-word',
          }}
        >
          {description}
        </p>
      )}

      {/* Checklist bar (only if there are items) */}
      {checklistTotal > 0 && (
        <div className="flex items-center gap-1.5 mt-2">
          <span style={{ fontSize: '10px', color: checklistPct === 100 ? C.green : C.text4, flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
            {checklistDone}/{checklistTotal}
          </span>
          <div style={{ flex: 1, height: '3px', background: C.border2, borderRadius: '2px', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%', borderRadius: '2px',
                width: `${checklistPct}%`,
                background: checklistPct === 100 ? C.green : C.accent,
                transition: 'width 0.3s',
              }}
            />
          </div>
        </div>
      )}

      {/* Footer meta row */}
      <div className="flex items-center gap-2 mt-2 flex-wrap" style={{ minHeight: '18px' }}>
        {/* Priority */}
        {prio && (
          <span
            style={{
              fontSize: '10px', fontWeight: 600,
              padding: '1px 5px', borderRadius: '3px',
              background: prio.bg, color: prio.color,
              border: `1px solid ${prio.color}33`,
              flexShrink: 0,
            }}
          >
            {prio.label}
          </span>
        )}

        {/* Due date */}
        {due && (
          <div className="flex items-center gap-[3px]" style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 14 14" fill="none" stroke={due.color} strokeWidth="1.4" width="10" height="10">
              <rect x="1" y="2" width="12" height="11" rx="1.5" />
              <path d="M4 1v2M10 1v2M1 6h12" />
            </svg>
            <span style={{ fontSize: '10.5px', color: due.color, fontVariantNumeric: 'tabular-nums' }}>
              {due.text}
            </span>
          </div>
        )}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Comments */}
        {commentCount > 0 && (
          <div className="flex items-center gap-[3px]" style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 14 14" fill="none" stroke={C.text4} strokeWidth="1.4" width="10" height="10">
              <path d="M2 2h10v7H8l-2 2-2-2H2z" />
            </svg>
            <span style={{ fontSize: '10px', color: C.text4 }}>{commentCount}</span>
          </div>
        )}

        {/* Blocked indicator */}
        {isBlocked && (
          <div
            className="flex items-center gap-[3px]"
            title={`Bloqueada por ${blockedByPendingCount} dep. pendiente${blockedByPendingCount !== 1 ? 's' : ''}`}
            style={{ flexShrink: 0 }}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke={C.amber} strokeWidth="1.5" width="10" height="10">
              <rect x="1.5" y="5" width="9" height="6.5" rx="1" /><path d="M3.5 5V3.5a2.5 2.5 0 015 0V5" />
            </svg>
            <span style={{ fontSize: '10px', color: C.amber }}>{blockedByPendingCount}</span>
          </div>
        )}

        {/* Blocking indicator */}
        {!isBlocked && blockingCount > 0 && (
          <div
            className="flex items-center gap-[3px]"
            title={`Bloquea a ${blockingCount} card${blockingCount !== 1 ? 's' : ''}`}
            style={{ flexShrink: 0 }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke={C.text4} strokeWidth="1.4" width="10" height="10">
              <circle cx="4" cy="3" r="1.5" /><circle cx="4" cy="11" r="1.5" /><circle cx="10" cy="3" r="1.5" />
              <path d="M4 4.5v5M10 4.5C10 8 4 9 4 9.5" />
            </svg>
            <span style={{ fontSize: '10px', color: C.text4 }}>{blockingCount}</span>
          </div>
        )}

        {/* Members */}
        {members.length > 0 && (
          <div className="flex items-center" style={{ flexShrink: 0 }}>
            {members.slice(0, 3).map((m: any, i: number) => (
              <div
                key={m.id}
                title={m.name}
                style={{
                  width: '18px', height: '18px',
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${C.accent}bb, ${C.accent}55)`,
                  border: `1.5px solid ${C.bg}`,
                  marginLeft: i === 0 ? 0 : '-5px',
                  fontSize: '9px', fontWeight: 700, color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  zIndex: 3 - i,
                  position: 'relative',
                }}
              >
                {m.name.charAt(0).toUpperCase()}
              </div>
            ))}
            {members.length > 3 && (
              <div
                style={{
                  width: '18px', height: '18px', borderRadius: '50%',
                  background: C.hover, border: `1.5px solid ${C.bg}`,
                  marginLeft: '-5px', fontSize: '9px', fontWeight: 700, color: C.text3,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
                }}
              >
                +{members.length - 3}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(Card, (prev, next) =>
  prev.card.id === next.card.id &&
  prev.card.title === next.card.title &&
  (prev.card.description ?? '') === (next.card.description ?? '') &&
  prev.card.position === next.card.position &&
  prev.card.completed === next.card.completed &&
  prev.card.dueDate === next.card.dueDate &&
  prev.card.priority === next.card.priority &&
  prev.card.members?.length === next.card.members?.length &&
  prev.card.labels?.length === next.card.labels?.length &&
  prev.card.checklistItems?.length === next.card.checklistItems?.length &&
  prev.card.checklistItems?.filter((i) => i.completed).length ===
    next.card.checklistItems?.filter((i) => i.completed).length &&
  prev.card.blockedByPendingCount === next.card.blockedByPendingCount &&
  prev.card.blockingCount === next.card.blockingCount
);
