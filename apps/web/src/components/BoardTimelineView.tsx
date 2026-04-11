// apps/web/src/components/BoardTimelineView.tsx
'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import type { Card, List, Sprint, Milestone } from '@aether/types';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useTimelineStore } from '@/stores/timelineStore';
import { useT } from '@/lib/i18n';
import {
  Plus,
  X,
  Check,
  Pencil,
  Trash2,
  ChevronDown,
  ChevronRight,
  Flag,
  Zap,
  Calendar,
  CheckCircle2,
  Circle,
  GripVertical,
} from 'lucide-react';

interface Props {
  boardId: string;
  lists: List[];
  filteredCards?: Record<string, Card[]> | null;
  onCardClick: (card: Card) => void;
}

// ─── Layout constants ─────────────────────────────────────────────────────────
const DAY_W = 32;
const ROW_H = 38;
const SIDEBAR_W = 280;
const YEAR_H = 22;
const MONTH_H = 24;
const DAY_H = 22;
const HEADER_H = YEAR_H + MONTH_H + DAY_H;

// ─── Colour maps ──────────────────────────────────────────────────────────────
const STATUS_PILL: Record<string, string> = {
  PLANNED: 'bg-zinc-500/15 border-zinc-500/30 text-zinc-400',
  ACTIVE: 'bg-accent/15 border-accent/30 text-accent',
  COMPLETED: 'bg-success/15 border-success/30 text-success',
};
const STATUS_BAR: Record<string, string> = {
  PLANNED: 'bg-zinc-600/30 border-zinc-500/40',
  ACTIVE: 'bg-accent/25 border-accent/50',
  COMPLETED: 'bg-success/25 border-success/50',
};
const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-error',
  MEDIUM: 'bg-warning',
  LOW: 'bg-blue-500',
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
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

function toISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseDate(iso: string) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
}
function toMidnightLocal(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function daysBetween(a: Date, b: Date) {
  return Math.round((toMidnightLocal(b).getTime() - toMidnightLocal(a).getTime()) / 86400000);
}
function addDays(d: Date, n: number) {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

// ─── Draggable card chip ──────────────────────────────────────────────────────
function DraggableCard({
  card,
  sprintId,
  onCardClick,
  onRemove,
  canEdit,
}: {
  card: any;
  sprintId?: string;
  onCardClick: (card: any) => void;
  onRemove?: () => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `card-${card.id}`,
    data: { cardId: card.id, fromSprintId: sprintId ?? null },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 px-2 py-1 border border-border/40 bg-background hover:border-border hover:bg-surface/40 transition-colors group/card cursor-default"
    >
      {/* Drag handle */}
      <div
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-muted/30 hover:text-text-muted transition-colors"
      >
        <GripVertical className="w-3 h-3" />
      </div>

      {card.priority && (
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[card.priority]}`} />
      )}
      {card.completed ? (
        <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />
      ) : (
        <Circle className="w-3 h-3 text-text-muted/30 flex-shrink-0" />
      )}

      <button
        className={`flex-1 text-left text-[11px] font-mono truncate ${
          card.completed
            ? 'line-through text-text-muted'
            : 'text-text-secondary hover:text-text-primary'
        }`}
        onClick={() => onCardClick(card)}
      >
        {card.title}
      </button>

      {/* date badge */}
      {(card.startDate || card.dueDate) && (
        <span className="text-[9px] text-text-muted font-mono flex-shrink-0">
          {card.startDate ? card.startDate.slice(5, 10) : ''}
          {card.startDate && card.dueDate ? '→' : ''}
          {card.dueDate ? card.dueDate.slice(5, 10) : ''}
        </span>
      )}

      {/* Remove from sprint */}
      {onRemove && canEdit && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/card:opacity-100 p-0.5 text-text-muted hover:text-error transition-all flex-shrink-0"
          title="Quitar del sprint"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Draggable milestone chip ─────────────────────────────────────────────────
function DraggableMilestone({
  milestone,
  onRemove,
  canEdit,
}: {
  milestone: Milestone;
  onRemove?: () => void;
  canEdit: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `milestone-${milestone.id}`,
    data: { milestoneId: milestone.id, fromSprintId: milestone.sprintId ?? null },
  });

  return (
    <div
      ref={setNodeRef}
      style={{ opacity: isDragging ? 0.4 : 1 }}
      className="flex items-center gap-1.5 px-2 py-1 border border-border/40 bg-background hover:border-border hover:bg-surface/40 transition-colors group/ms cursor-default"
    >
      <div
        {...listeners}
        {...attributes}
        className="flex-shrink-0 cursor-grab active:cursor-grabbing text-text-muted/30 hover:text-text-muted transition-colors"
      >
        <GripVertical className="w-3 h-3" />
      </div>
      <div
        style={{
          width: 10,
          height: 10,
          backgroundColor: milestone.color,
          transform: 'rotate(45deg)',
          flexShrink: 0,
        }}
        className="rounded-sm"
      />
      <span className="flex-1 text-[11px] font-mono text-text-secondary truncate">
        {milestone.name}
      </span>
      <span className="text-[9px] text-text-muted font-mono flex-shrink-0">
        {milestone.date.slice(5, 10)}
      </span>
      {onRemove && canEdit && (
        <button
          onClick={onRemove}
          className="opacity-0 group-hover/ms:opacity-100 p-0.5 text-text-muted hover:text-error transition-all flex-shrink-0"
          title="Quitar del sprint"
        >
          <X className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

// ─── Droppable sprint zone ────────────────────────────────────────────────────
function DroppableSprint({
  sprint,
  liveCards,
  children,
  isCollapsed,
  onToggle,
  onEdit,
  onDelete,
  onAddCards,
  canEdit,
}: {
  sprint: Sprint;
  liveCards: any[];
  children: React.ReactNode;
  isCollapsed: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddCards: () => void;
  canEdit: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `sprint-${sprint.id}` });
  const doneCount = liveCards.filter((c) => c.completed).length;
  const pct = liveCards.length ? Math.round((doneCount / liveCards.length) * 100) : 0;

  return (
    <div
      ref={setNodeRef}
      className={`border-b border-border/40 transition-colors ${isOver ? 'bg-accent/5 border-accent/30' : ''}`}
    >
      {/* Sprint header row */}
      <div
        style={{ height: ROW_H }}
        className="flex items-center px-2 gap-1.5 group hover:bg-surface/40 cursor-pointer select-none"
        onClick={onToggle}
      >
        {isCollapsed ? (
          <ChevronRight className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-text-muted flex-shrink-0" />
        )}
        <Zap className="w-3 h-3 text-accent flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1">
            <p className="text-[11px] font-semibold text-text-primary truncate font-mono leading-tight">
              {sprint.name}
            </p>
            <span
              className={`text-[9px] font-mono px-1 py-0.5 rounded border ${STATUS_PILL[sprint.status]} flex-shrink-0`}
            >
              {sprint.status === 'ACTIVE' ? '●' : sprint.status === 'COMPLETED' ? '✓' : '○'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-0.5">
            <div className="flex-1 h-1 bg-border rounded-full overflow-hidden">
              <div
                className="h-full bg-accent rounded-full transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="text-[9px] text-text-muted font-mono flex-shrink-0">
              {doneCount}/{liveCards.length}
            </span>
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1 text-text-muted hover:text-accent rounded"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1 text-text-muted hover:text-error rounded"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Drop zone hint */}
      {isOver && (
        <div className="mx-2 mb-1 border border-dashed border-accent/50 text-[10px] text-accent font-mono text-center py-1 rounded">
          Soltar aquí
        </div>
      )}

      {/* Sprint cards */}
      {!isCollapsed && (
        <div className="pb-1 space-y-0.5 px-2">
          {children}
          {liveCards.length === 0 && !isOver && (
            <p className="text-[10px] text-text-muted/50 font-mono italic text-center py-2">
              Arrastra cards aquí
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Droppable "sin sprint" pool ──────────────────────────────────────────────
function DroppablePool({ children }: { children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'pool' });
  return (
    <div ref={setNodeRef} className={`transition-colors ${isOver ? 'bg-accent/5' : ''}`}>
      {children}
    </div>
  );
}

// ─── Sprint form ──────────────────────────────────────────────────────────────
interface SprintFormProps {
  initial?: Partial<Sprint>;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}
function SprintForm({ initial, onSave, onCancel, saving }: SprintFormProps) {
  const t = useT();
  const today = toISO(new Date());
  const twoWeeks = toISO(addDays(new Date(), 14));
  const [name, setName] = useState(initial?.name ?? '');
  const [goal, setGoal] = useState(initial?.goal ?? '');
  const [start, setStart] = useState(initial?.startDate?.slice(0, 10) ?? today);
  const [end, setEnd] = useState(initial?.endDate?.slice(0, 10) ?? twoWeeks);
  const [status, setStatus] = useState<string>(initial?.status ?? 'PLANNED');

  return (
    <div className="p-3 border border-border bg-card space-y-2.5">
      <div className="flex items-center gap-2">
        <Zap className="w-3.5 h-3.5 text-accent" />
        <span className="text-xs font-semibold text-text-primary font-mono">
          {initial?.id ? t.timeline_edit_sprint : t.timeline_create_sprint}
        </span>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.timeline_sprint_name}
        className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary placeholder-text-muted"
      />
      <textarea
        value={goal}
        onChange={(e) => setGoal(e.target.value)}
        placeholder={t.timeline_sprint_goal}
        rows={2}
        className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary placeholder-text-muted resize-none"
      />
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-text-muted font-mono uppercase mb-1 block">
            Inicio
          </label>
          <input
            type="date"
            value={start}
            onChange={(e) => setStart(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary"
          />
        </div>
        <div>
          <label className="text-[10px] text-text-muted font-mono uppercase mb-1 block">Fin</label>
          <input
            type="date"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary"
          />
        </div>
      </div>
      <div>
        <label className="text-[10px] text-text-muted font-mono uppercase mb-1 block">
          {t.timeline_sprint_status}
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary"
        >
          <option value="PLANNED">{t.timeline_status_planned}</option>
          <option value="ACTIVE">{t.timeline_status_active}</option>
          <option value="COMPLETED">{t.timeline_status_completed}</option>
        </select>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() =>
            onSave({ name, goal: goal || undefined, startDate: start, endDate: end, status })
          }
          disabled={!name.trim() || saving}
          className="flex-1 py-1.5 text-xs bg-accent text-white hover:bg-accent/80 disabled:opacity-40 transition-colors font-mono flex items-center justify-center gap-1"
        >
          <Check className="w-3 h-3" />
          {saving ? '…' : 'Guardar'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-border text-text-muted hover:text-text-primary transition-colors font-mono"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Milestone form ───────────────────────────────────────────────────────────
const MILESTONE_COLORS = [
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#06b6d4',
  '#22c55e',
  '#f97316',
  '#ec4899',
];

interface MilestoneFormProps {
  initial?: Partial<Milestone>;
  onSave: (data: any) => void;
  onCancel: () => void;
  saving: boolean;
}
function MilestoneForm({ initial, onSave, onCancel, saving }: MilestoneFormProps) {
  const t = useT();
  const [name, setName] = useState(initial?.name ?? '');
  const [date, setDate] = useState(initial?.date?.slice(0, 10) ?? toISO(new Date()));
  const [desc, setDesc] = useState(initial?.description ?? '');
  const [color, setColor] = useState(initial?.color ?? '#f59e0b');
  return (
    <div className="p-3 border border-border bg-card space-y-2.5">
      <div className="flex items-center gap-2">
        <Flag className="w-3.5 h-3.5" style={{ color }} />
        <span className="text-xs font-semibold text-text-primary font-mono">
          {initial?.id ? t.timeline_edit_milestone : t.timeline_create_milestone}
        </span>
      </div>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t.timeline_milestone_name}
        className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary placeholder-text-muted"
      />
      <input
        type="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="w-full px-2 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary"
      />
      <input
        value={desc}
        onChange={(e) => setDesc(e.target.value)}
        placeholder="Descripción opcional"
        className="w-full px-2.5 py-1.5 text-xs bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary placeholder-text-muted"
      />
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-text-muted font-mono uppercase">Color:</span>
        <div className="flex gap-1.5">
          {MILESTONE_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-4 h-4 rounded-full transition-transform ${color === c ? 'scale-125 ring-2 ring-white/40' : 'hover:scale-110'}`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => onSave({ name, date, description: desc || undefined, color })}
          disabled={!name.trim() || saving}
          className="flex-1 py-1.5 text-xs bg-accent text-white hover:bg-accent/80 disabled:opacity-40 transition-colors font-mono flex items-center justify-center gap-1"
        >
          <Check className="w-3 h-3" />
          {saving ? '…' : 'Guardar'}
        </button>
        <button
          onClick={onCancel}
          className="px-3 py-1.5 text-xs border border-border text-text-muted hover:text-text-primary font-mono"
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function BoardTimelineView({ boardId, lists, filteredCards, onCardClick }: Props) {
  const t = useT();
  const { currentWorkspace } = useWorkspaceStore();
  const cards = useCardStore((s) => s.cards);
  const timelineVersion = useTimelineStore((s) => s.version);
  const canEdit = currentWorkspace?.userRole === 'ADMIN' || currentWorkspace?.userRole === 'OWNER';
  const scrollRef = useRef<HTMLDivElement>(null);

  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [depEdges, setDepEdges] = useState<{ blockingCardId: string; blockedCardId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  const [showSprintForm, setShowSprintForm] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [showMilestoneForm, setShowMilestoneForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<Milestone | null>(null);
  const [saving, setSaving] = useState(false);

  // Pool search
  const [poolSearch, setPoolSearch] = useState('');
  const [poolCollapsed, setPoolCollapsed] = useState<Set<string>>(new Set());

  // DnD active items
  const [draggingCard, setDraggingCard] = useState<any | null>(null);
  const [draggingMilestone, setDraggingMilestone] = useState<Milestone | null>(null);

  // Mobile-optimized drag sensors for timeline
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 15, // Increased from 6px for better touch accuracy
        delay: 150, // Add delay to distinguish between scroll and drag
        tolerance: 5,
      },
    })
  );

  // ── Fetch helpers ─────────────────────────────────────────────────────────
  const loadRemoteData = useCallback(async () => {
    if (!boardId) return;
    const [sRes, mRes, dRes] = await Promise.all([
      apiService.get<{ sprints: any[] }>(`/api/boards/${boardId}/sprints`, true),
      apiService.get<{ milestones: any[] }>(`/api/boards/${boardId}/milestones`, true),
      apiService.get<{ graph: { edges: any[] } }>(`/api/boards/${boardId}/dependency-graph`, true),
    ]);
    if (sRes.success && sRes.data) setSprints(sRes.data.sprints);
    if (mRes.success && mRes.data) setMilestones(mRes.data.milestones);
    if (dRes.success && dRes.data) setDepEdges(dRes.data.graph.edges ?? []);
  }, [boardId]);

  // Initial load — shows spinner
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      await loadRemoteData();
    } finally {
      setLoading(false);
    }
  }, [loadRemoteData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Silent refresh — triggered by timelineVersion bump, no spinner
  useEffect(() => {
    if (timelineVersion === 0) return; // skip on mount (fetchData handles it)
    loadRemoteData();
  }, [timelineVersion, loadRemoteData]);

  // ── All board cards (flat) ────────────────────────────────────────────────
  const allBoardCards = useMemo(
    () => Object.values(filteredCards ?? cards).flat() as Card[],
    [filteredCards, cards]
  );

  // ── Live card map: id → card (always up-to-date from store) ──────────────
  const cardById = useMemo(() => new Map(allBoardCards.map((c) => [c.id, c])), [allBoardCards]);

  // ── Sprint card ID set ────────────────────────────────────────────────────
  const sprintCardIds = useMemo(
    () => new Set(sprints.flatMap((s) => (s.cards ?? []).map((c: any) => c.id))),
    [sprints]
  );

  // ── Pool: all cards not in any sprint, filtered by search ─────────────────
  const poolCardsByList = useMemo(() => {
    const unassigned = allBoardCards.filter((c) => !sprintCardIds.has(c.id));
    const byList: Record<string, Card[]> = {};
    for (const c of unassigned) {
      if (!byList[c.listId]) byList[c.listId] = [];
      if (poolSearch === '' || c.title.toLowerCase().includes(poolSearch.toLowerCase())) {
        byList[c.listId].push(c);
      }
    }
    return byList;
  }, [allBoardCards, sprintCardIds, poolSearch]);

  // ── Timeline date range ───────────────────────────────────────────────────
  const { rangeStart, totalDays } = useMemo(() => {
    const pts: Date[] = [new Date()];
    for (const s of sprints) {
      pts.push(parseDate(s.startDate));
      pts.push(parseDate(s.endDate));
    }
    for (const m of milestones) pts.push(parseDate(m.date));
    for (const c of allBoardCards) {
      if (c.startDate) pts.push(parseDate(c.startDate));
      if (c.dueDate) pts.push(parseDate(c.dueDate));
    }
    const minDate = new Date(Math.min(...pts.map((d) => d.getTime())));
    const maxDate = new Date(Math.max(...pts.map((d) => d.getTime())));
    minDate.setDate(minDate.getDate() - 10);
    maxDate.setDate(maxDate.getDate() + 21);
    return { rangeStart: minDate, totalDays: daysBetween(minDate, maxDate) };
  }, [sprints, milestones, allBoardCards]);

  const todayOffset = useMemo(() => daysBetween(rangeStart, new Date()), [rangeStart]);

  // Scroll to today on mount
  useEffect(() => {
    if (!loading && scrollRef.current) {
      const x = todayOffset * DAY_W - scrollRef.current.clientWidth / 3;
      scrollRef.current.scrollLeft = Math.max(0, x);
    }
  }, [loading, todayOffset]);

  // ── Header bands ──────────────────────────────────────────────────────────
  const yearBands = useMemo(() => {
    const bands: { label: string; x: number; width: number }[] = [];
    let i = 0;
    while (i < totalDays) {
      const d = addDays(rangeStart, i);
      const y = d.getFullYear();
      let j = i;
      while (j < totalDays && addDays(rangeStart, j).getFullYear() === y) j++;
      bands.push({ label: String(y), x: i * DAY_W, width: (j - i) * DAY_W });
      i = j;
    }
    return bands;
  }, [rangeStart, totalDays]);

  const monthBands = useMemo(() => {
    const bands: { label: string; x: number; width: number }[] = [];
    let i = 0;
    while (i < totalDays) {
      const d = addDays(rangeStart, i);
      const mo = d.getMonth(),
        yr = d.getFullYear();
      let j = i;
      while (j < totalDays) {
        const nd = addDays(rangeStart, j);
        if (nd.getMonth() !== mo || nd.getFullYear() !== yr) break;
        j++;
      }
      bands.push({ label: MONTHS_SHORT[mo], x: i * DAY_W, width: (j - i) * DAY_W });
      i = j;
    }
    return bands;
  }, [rangeStart, totalDays]);

  const dayColumns = useMemo(
    () =>
      Array.from({ length: totalDays }, (_, i) => {
        const d = addDays(rangeStart, i);
        const dow = d.getDay();
        return {
          n: d.getDate(),
          isWeekend: dow === 0 || dow === 6,
          x: i * DAY_W,
          isToday: i === todayOffset,
        };
      }),
    [rangeStart, totalDays, todayOffset]
  );

  // ── CRUD helpers ──────────────────────────────────────────────────────────
  async function createSprint(data: any) {
    setSaving(true);
    try {
      const r = await apiService.post<{ sprint: any }>(`/api/boards/${boardId}/sprints`, data, true);
      if (r.success && r.data) {
        setSprints((p) => [...p, r.data!.sprint]);
        setShowSprintForm(false);
      }
    } finally {
      setSaving(false);
    }
  }
  async function updateSprint(sprintId: string, data: any) {
    setSaving(true);
    try {
      const r = await apiService.put<{ sprint: any }>(`/api/sprints/${sprintId}`, data, true);
      if (r.success && r.data) {
        setSprints((p) => p.map((s) => (s.id === sprintId ? r.data!.sprint : s)));
        setEditingSprint(null);
      }
    } finally {
      setSaving(false);
    }
  }
  async function deleteSprint(sprintId: string) {
    if (!confirm('¿Eliminar este sprint? Las cards no se eliminan.')) return;
    await apiService.delete(`/api/sprints/${sprintId}`, true);
    setSprints((p) => p.filter((s) => s.id !== sprintId));
  }
  async function addCardToSprint(sprintId: string, cardId: string) {
    // Optimistic: add card to sprint in local state immediately
    const card = allBoardCards.find((c) => c.id === cardId);
    if (card) {
      setSprints((p) =>
        p.map((s) =>
          s.id === sprintId
            ? { ...s, cards: [...(s.cards ?? []).filter((c: any) => c.id !== cardId), card] }
            : s
        )
      );
    }
    // Persist to server
    try {
      const r = await apiService.post(`/api/sprints/${sprintId}/cards`, { cardId }, true);
      if (!r.success) fetchData(); // revert
    } catch {
      fetchData(); // revert
    }
  }
  async function removeCardFromSprint(sprintId: string, cardId: string) {
    // Optimistic: remove immediately
    setSprints((p) =>
      p.map((s) =>
        s.id === sprintId ? { ...s, cards: (s.cards ?? []).filter((c: any) => c.id !== cardId) } : s
      )
    );
    try {
      const r = await apiService.delete(`/api/sprints/${sprintId}/cards/${cardId}`, true);
      if (!r.success) fetchData(); // revert
    } catch {
      fetchData(); // revert
    }
  }
  function removeMilestoneFromSprint(milestoneId: string) {
    setMilestones((p) => p.map((m) => (m.id === milestoneId ? { ...m, sprintId: undefined } : m)));
    apiService.put(`/api/milestones/${milestoneId}`, { sprintId: null }, true).catch(() => fetchData());
  }

  async function createMilestone(data: any) {
    setSaving(true);
    try {
      const r = await apiService.post<{ milestone: any }>(`/api/boards/${boardId}/milestones`, data, true);
      if (r.success && r.data) {
        setMilestones((p) => [...p, r.data!.milestone]);
        setShowMilestoneForm(false);
      }
    } finally {
      setSaving(false);
    }
  }
  async function updateMilestone(milestoneId: string, data: any) {
    setSaving(true);
    try {
      const r = await apiService.put<{ milestone: any }>(`/api/milestones/${milestoneId}`, data, true);
      if (r.success && r.data) {
        setMilestones((p) => p.map((m) => (m.id === milestoneId ? r.data!.milestone : m)));
        setEditingMilestone(null);
      }
    } finally {
      setSaving(false);
    }
  }
  async function deleteMilestone(milestoneId: string) {
    if (!confirm('¿Eliminar este hito?')) return;
    await apiService.delete(`/api/milestones/${milestoneId}`, true);
    setMilestones((p) => p.filter((m) => m.id !== milestoneId));
  }

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart(event: DragStartEvent) {
    const data = event.active.data.current as any;
    if (data.milestoneId) {
      const ms = milestones.find((m) => m.id === data.milestoneId);
      setDraggingMilestone(ms ?? null);
      setDraggingCard(null);
    } else {
      const card = allBoardCards.find((c) => c.id === data.cardId);
      setDraggingCard(card ?? null);
      setDraggingMilestone(null);
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    setDraggingCard(null);
    setDraggingMilestone(null);
    const { over, active } = event;
    if (!over) return;

    const data = active.data.current as any;
    const overId = String(over.id);

    // ── Milestone drop ──────────────────────────────────────────────────────
    if (data.milestoneId) {
      const milestoneId: string = data.milestoneId;
      const fromSprintId: string | null = data.fromSprintId;

      if (overId.startsWith('sprint-')) {
        const toSprintId = overId.replace('sprint-', '');
        if (toSprintId === fromSprintId) return;
        // Optimistic update
        setMilestones((p) =>
          p.map((m) => (m.id === milestoneId ? { ...m, sprintId: toSprintId } : m))
        );
        try {
          const r = await apiService.put(`/api/milestones/${milestoneId}`, { sprintId: toSprintId }, true);
          if (!r.success) throw new Error('PUT milestone failed');
        } catch {
          fetchData();
        }
      }
      if (overId === 'pool' && fromSprintId) {
        setMilestones((p) =>
          p.map((m) => (m.id === milestoneId ? { ...m, sprintId: undefined } : m))
        );
        try {
          const r = await apiService.put(`/api/milestones/${milestoneId}`, { sprintId: null }, true);
          if (!r.success) throw new Error('PUT milestone (unassign) failed');
        } catch {
          fetchData();
        }
      }
      return;
    }

    // ── Card drop ───────────────────────────────────────────────────────────
    const { cardId, fromSprintId } = data as { cardId: string; fromSprintId: string | null };

    // Drop onto a sprint
    if (overId.startsWith('sprint-')) {
      const toSprintId = overId.replace('sprint-', '');
      if (toSprintId === fromSprintId) return;

      const card = allBoardCards.find((c) => c.id === cardId);
      if (!card) return;

      // Single atomic optimistic update
      setSprints((p) =>
        p.map((s) => {
          if (s.id === fromSprintId) {
            // Remove from old sprint
            return { ...s, cards: (s.cards ?? []).filter((c: any) => c.id !== cardId) };
          }
          if (s.id === toSprintId) {
            // Add to new sprint (avoid duplicates)
            const already = (s.cards ?? []).some((c: any) => c.id === cardId);
            return already ? s : { ...s, cards: [...(s.cards ?? []), card] };
          }
          return s;
        })
      );

      // Persist: remove from old sprint, then add to new sprint
      try {
        if (fromSprintId) {
          const delRes = await apiService.delete(`/api/sprints/${fromSprintId}/cards/${cardId}`, true);
          if (!delRes.success) throw new Error('DELETE failed');
        }
        const addRes = await apiService.post(`/api/sprints/${toSprintId}/cards`, { cardId }, true);
        if (!addRes.success) throw new Error('POST failed');
      } catch {
        fetchData(); // revert optimistic update
      }
    }

    // Drop back onto pool — remove from sprint
    if (overId === 'pool' && fromSprintId) {
      removeCardFromSprint(fromSprintId, cardId);
    }
  }

  // ── Bar geometry ──────────────────────────────────────────────────────────
  function cardBarGeom(card: any): { x: number; w: number; dueOnly: boolean } | null {
    const hasStart = !!card.startDate;
    const hasDue = !!card.dueDate;
    if (!hasStart && !hasDue) return null;
    if (hasStart && hasDue) {
      const s = parseDate(card.startDate);
      const e = parseDate(card.dueDate);
      return {
        x: daysBetween(rangeStart, s) * DAY_W,
        w: Math.max((daysBetween(s, e) + 1) * DAY_W, DAY_W),
        dueOnly: false,
      };
    }
    if (hasDue) {
      return {
        x: daysBetween(rangeStart, parseDate(card.dueDate)) * DAY_W,
        w: DAY_W,
        dueOnly: true,
      };
    }
    return {
      x: daysBetween(rangeStart, parseDate(card.startDate!)) * DAY_W,
      w: DAY_W * 2,
      dueOnly: false,
    };
  }

  function sprintBarGeom(sprint: Sprint) {
    const s = parseDate(sprint.startDate);
    const e = parseDate(sprint.endDate);
    return {
      x: daysBetween(rangeStart, s) * DAY_W,
      w: Math.max((daysBetween(s, e) + 1) * DAY_W, DAY_W),
    };
  }

  // ── Canvas geometry map: cardId → pixel rect of its bar ──────────────────
  // Mirrors the canvas render layout exactly so dependency lines hit the right spots.
  // Must live after cardBarGeom (which uses rangeStart) and after sprintCardIds.
  const cardCanvasGeom = useMemo(() => {
    const map = new Map<string, { x: number; y: number; w: number; dueOnly: boolean }>();
    let sectionTop = 0;

    const sortedSprints = [...sprints].sort((a, b) => a.startDate.localeCompare(b.startDate));
    for (const sprint of sortedSprints) {
      const sprintCardsRaw = (sprint.cards ?? []).map((c: any) => cardById.get(c.id) ?? c) as any[];
      const datedInSprint = sprintCardsRaw.filter((c: any) => c.dueDate || c.startDate);
      const sprintMilestones = milestones.filter((m) => m.sprintId === sprint.id);
      const milestoneRow = sprintMilestones.length > 0 ? 1 : 0;
      datedInSprint.forEach((card: any, idx: number) => {
        const geom = cardBarGeom(card);
        if (!geom) return;
        const rowTop = sectionTop + ROW_H * (idx + 1);
        map.set(card.id, {
          x: geom.x,
          y: rowTop + ROW_H / 2 - 11,
          w: geom.w,
          dueOnly: geom.dueOnly,
        });
      });
      sectionTop += ROW_H * (1 + datedInSprint.length + milestoneRow);
    }

    // Unassigned dated cards section
    const unassigned = allBoardCards.filter(
      (c) => !sprintCardIds.has(c.id) && (c.dueDate || c.startDate)
    );
    unassigned.forEach((card, idx) => {
      const geom = cardBarGeom(card);
      if (!geom) return;
      const rowTop = sectionTop + ROW_H * (idx + 1);
      map.set(card.id, { x: geom.x, y: rowTop + ROW_H / 2 - 11, w: geom.w, dueOnly: geom.dueOnly });
    });

    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sprints, milestones, allBoardCards, cardById, sprintCardIds, rangeStart]);

  // ── Card bar renderer ─────────────────────────────────────────────────────
  function CardBar({ card, topPx }: { card: any; topPx: number }) {
    const geom = cardBarGeom(card);
    if (!geom) return null;
    const { x, w, dueOnly } = geom;

    if (dueOnly) {
      return (
        <div
          style={{
            position: 'absolute',
            left: x + DAY_W / 2 - 8,
            top: topPx + ROW_H / 2 - 8,
            width: 16,
            height: 16,
            cursor: 'pointer',
          }}
          onClick={() => onCardClick(card)}
          title={`${card.title} — ${card.dueDate?.slice(0, 10)}`}
        >
          <div
            style={{ width: 14, height: 14, transform: 'rotate(45deg)', margin: 1 }}
            className={`${card.completed ? 'bg-success border-success/60' : 'bg-accent border-accent/60'} border shadow-sm hover:scale-125 transition-transform`}
          />
          {card.priority && (
            <div
              className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ${PRIORITY_DOT[card.priority]}`}
            />
          )}
        </div>
      );
    }
    return (
      <div
        style={{
          position: 'absolute',
          left: x,
          top: topPx + ROW_H / 2 - 11,
          width: w,
          height: 22,
          cursor: 'pointer',
        }}
        className={`rounded-sm border flex items-center px-2 gap-1 overflow-hidden font-mono text-[10px] hover:opacity-80 transition-opacity shadow-sm ${
          card.completed
            ? 'bg-success/20 border-success/40 text-success'
            : 'bg-accent/20 border-accent/40 text-text-primary'
        }`}
        onClick={() => onCardClick(card)}
        title={card.title}
      >
        {card.priority && (
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[card.priority]}`}
          />
        )}
        {card.completed && <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-success" />}
        <span className={`truncate ${card.completed ? 'line-through' : ''}`}>{card.title}</span>
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-text-muted font-mono text-sm">
        <div className="inline-block w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mr-2" />
        Cargando timeline…
      </div>
    );
  }

  const totalWidth = totalDays * DAY_W;
  const todayX = todayOffset * DAY_W;

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="flex h-full overflow-hidden bg-background">
        {/* ── Left sidebar ──────────────────────────────────────────────── */}
        <div
          style={{ width: SIDEBAR_W }}
          className="flex-shrink-0 border-r border-border bg-card flex flex-col overflow-hidden"
        >
          {/* Action bar */}
          <div className="px-3 py-2 border-b border-border flex flex-wrap items-center gap-1.5 flex-shrink-0">
            {canEdit && !showSprintForm && !editingSprint && (
              <button
                onClick={() => {
                  setShowSprintForm(true);
                  setShowMilestoneForm(false);
                  setEditingMilestone(null);
                }}
                className="flex items-center gap-1 text-[11px] text-accent hover:text-accent/80 border border-accent/30 hover:border-accent px-2 py-1 transition-colors font-mono"
              >
                <Plus className="w-3 h-3" /> {t.timeline_create_sprint}
              </button>
            )}
            {canEdit && !showMilestoneForm && !editingMilestone && (
              <button
                onClick={() => {
                  setShowMilestoneForm(true);
                  setShowSprintForm(false);
                  setEditingSprint(null);
                }}
                className="flex items-center gap-1 text-[11px] text-text-muted hover:text-text-primary border border-border hover:border-accent/50 px-2 py-1 transition-colors font-mono"
              >
                <Flag className="w-3 h-3" /> {t.timeline_create_milestone}
              </button>
            )}
          </div>

          {/* Inline forms */}
          {showSprintForm && (
            <div className="border-b border-border flex-shrink-0">
              <SprintForm
                onSave={createSprint}
                onCancel={() => setShowSprintForm(false)}
                saving={saving}
              />
            </div>
          )}
          {showMilestoneForm && (
            <div className="border-b border-border flex-shrink-0">
              <MilestoneForm
                onSave={createMilestone}
                onCancel={() => setShowMilestoneForm(false)}
                saving={saving}
              />
            </div>
          )}

          {/* Header spacer aligned with timeline */}
          <div
            style={{ height: HEADER_H }}
            className="flex-shrink-0 border-b border-border flex items-end pb-1 px-3 gap-2"
          >
            <span className="text-[9px] text-text-muted font-mono uppercase tracking-widest flex-1">
              Cards · Sprints
            </span>
          </div>

          {/* Scrollable list */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden flex flex-col">
            {/* ── POOL: all cards not in any sprint ── */}
            <div className="flex-shrink-0">
              {/* Pool header */}
              <div className="sticky top-0 z-10 bg-card border-b border-border px-3 py-1.5 flex items-center gap-2">
                <button
                  onClick={() =>
                    setPoolCollapsed((p) => {
                      const n = new Set(p);
                      n.has('pool') ? n.delete('pool') : n.add('pool');
                      return n;
                    })
                  }
                  className="flex items-center gap-1.5 flex-1 min-w-0"
                >
                  {poolCollapsed.has('pool') ? (
                    <ChevronRight className="w-3 h-3 text-text-muted flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-3 h-3 text-text-muted flex-shrink-0" />
                  )}
                  <span className="text-[10px] font-semibold text-text-muted font-mono uppercase tracking-wider truncate">
                    Sin sprint
                  </span>
                  <span className="text-[9px] text-text-muted font-mono ml-1">
                    ({allBoardCards.filter((c) => !sprintCardIds.has(c.id)).length})
                  </span>
                </button>
                <input
                  value={poolSearch}
                  onChange={(e) => setPoolSearch(e.target.value)}
                  placeholder="Buscar…"
                  onClick={(e) => e.stopPropagation()}
                  className="w-20 px-1.5 py-0.5 text-[10px] bg-surface border border-border focus:border-accent focus:outline-none font-mono text-text-primary placeholder-text-muted"
                />
              </div>

              {!poolCollapsed.has('pool') && (
                <DroppablePool>
                  {lists.map((list) => {
                    const listCards = poolCardsByList[list.id] ?? [];
                    if (listCards.length === 0) return null;
                    const isListCollapsed = poolCollapsed.has(list.id);
                    return (
                      <div key={list.id} className="border-b border-border/30">
                        {/* List sub-header */}
                        <button
                          onClick={() =>
                            setPoolCollapsed((p) => {
                              const n = new Set(p);
                              n.has(list.id) ? n.delete(list.id) : n.add(list.id);
                              return n;
                            })
                          }
                          className="w-full flex items-center gap-1.5 px-3 py-1 hover:bg-surface/40 transition-colors"
                        >
                          {isListCollapsed ? (
                            <ChevronRight className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                          ) : (
                            <ChevronDown className="w-3 h-3 text-text-muted/50 flex-shrink-0" />
                          )}
                          <span className="text-[10px] text-text-muted font-mono truncate flex-1 text-left">
                            {list.name}
                          </span>
                          <span className="text-[9px] text-text-muted/50 font-mono">
                            {listCards.length}
                          </span>
                        </button>
                        {!isListCollapsed && (
                          <div className="px-2 pb-1 space-y-0.5">
                            {listCards.map((card) => (
                              <DraggableCard
                                key={card.id}
                                card={card}
                                sprintId={undefined}
                                onCardClick={onCardClick}
                                canEdit={canEdit}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {Object.keys(poolCardsByList).length === 0 && (
                    <p className="text-[10px] text-text-muted/50 font-mono text-center py-4 italic">
                      {poolSearch ? 'Sin resultados' : 'Todas las cards están en un sprint'}
                    </p>
                  )}
                </DroppablePool>
              )}
            </div>

            {/* ── SPRINTS ── */}
            {sprints.length > 0 && (
              <div className="flex-shrink-0">
                <div className="sticky top-0 z-10 bg-card border-b border-t border-border px-3 py-1.5">
                  <span className="text-[10px] font-semibold text-accent font-mono uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3 h-3" /> Sprints ({sprints.length})
                  </span>
                </div>
                {sprints.map((sprint) => {
                  const isCollapsedSprint = collapsed.has(sprint.id);
                  // Merge live store data so dates always reflect latest edits
                  const sprintCards = (sprint.cards ?? []).map(
                    (c: any) => cardById.get(c.id) ?? c
                  ) as any[];
                  return (
                    <div key={sprint.id}>
                      {editingSprint?.id === sprint.id && (
                        <div className="border-b border-border">
                          <SprintForm
                            initial={sprint}
                            onSave={(d) => updateSprint(sprint.id, d)}
                            onCancel={() => setEditingSprint(null)}
                            saving={saving}
                          />
                        </div>
                      )}
                      <DroppableSprint
                        sprint={sprint}
                        liveCards={sprintCards}
                        isCollapsed={isCollapsedSprint}
                        onToggle={() =>
                          setCollapsed((p) => {
                            const n = new Set(p);
                            n.has(sprint.id) ? n.delete(sprint.id) : n.add(sprint.id);
                            return n;
                          })
                        }
                        onEdit={() => {
                          setEditingSprint(sprint);
                          setShowSprintForm(false);
                        }}
                        onDelete={() => deleteSprint(sprint.id)}
                        onAddCards={() => {}}
                        canEdit={canEdit}
                      >
                        {sprintCards.map((card: any) => (
                          <DraggableCard
                            key={card.id}
                            card={card}
                            sprintId={sprint.id}
                            onCardClick={onCardClick}
                            onRemove={() => removeCardFromSprint(sprint.id, card.id)}
                            canEdit={canEdit}
                          />
                        ))}
                        {/* Milestones assigned to this sprint */}
                        {milestones
                          .filter((m) => m.sprintId === sprint.id)
                          .map((m) => (
                            <div key={m.id} className="flex items-center gap-1">
                              <DraggableMilestone
                                milestone={m}
                                onRemove={() => removeMilestoneFromSprint(m.id)}
                                canEdit={canEdit}
                              />
                              {canEdit && (
                                <div className="flex gap-0.5 flex-shrink-0">
                                  <button
                                    onClick={() => {
                                      setEditingMilestone(m);
                                      setShowMilestoneForm(false);
                                    }}
                                    className="p-0.5 text-text-muted hover:text-accent"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                  <button
                                    onClick={() => deleteMilestone(m.id)}
                                    className="p-0.5 text-text-muted hover:text-error"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                </div>
                              )}
                              {editingMilestone?.id === m.id && (
                                <MilestoneForm
                                  initial={m}
                                  onSave={(d) => updateMilestone(m.id, d)}
                                  onCancel={() => setEditingMilestone(null)}
                                  saving={saving}
                                />
                              )}
                            </div>
                          ))}
                      </DroppableSprint>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Empty state */}
            {sprints.length === 0 && allBoardCards.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 px-4 text-center gap-3">
                <Calendar className="w-8 h-8 text-text-muted/30" />
                <p className="text-xs text-text-muted font-mono">Sin cards en el board</p>
              </div>
            )}

            {/* Milestones — unassigned (no sprint) */}
            {milestones.filter((m) => !m.sprintId).length > 0 && (
              <div className="border-t border-border/40 flex-shrink-0">
                <div className="px-3 py-1.5 flex items-center gap-1.5">
                  <Flag className="w-3 h-3 text-text-muted" />
                  <span className="text-[10px] font-semibold text-text-muted font-mono uppercase tracking-wider">
                    Hitos
                  </span>
                  {sprints.length > 0 && (
                    <span className="text-[9px] text-text-muted/60 font-mono ml-1">
                      — arrastra a un sprint
                    </span>
                  )}
                </div>
                <DroppablePool>
                  <div className="px-2 pb-1 space-y-0.5">
                    {milestones
                      .filter((m) => !m.sprintId)
                      .map((m) => (
                        <div key={m.id}>
                          {editingMilestone?.id === m.id && (
                            <MilestoneForm
                              initial={m}
                              onSave={(d) => updateMilestone(m.id, d)}
                              onCancel={() => setEditingMilestone(null)}
                              saving={saving}
                            />
                          )}
                          <div className="flex items-center gap-1">
                            <DraggableMilestone milestone={m} canEdit={canEdit} />
                            {canEdit && (
                              <div className="flex gap-0.5 flex-shrink-0">
                                <button
                                  onClick={() => {
                                    setEditingMilestone(m);
                                    setShowMilestoneForm(false);
                                  }}
                                  className="p-0.5 text-text-muted hover:text-accent"
                                >
                                  <Pencil className="w-3 h-3" />
                                </button>
                                <button
                                  onClick={() => deleteMilestone(m.id)}
                                  className="p-0.5 text-text-muted hover:text-error"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                </DroppablePool>
              </div>
            )}
          </div>
        </div>

        {/* ── Timeline canvas ────────────────────────────────────────────── */}
        <div ref={scrollRef} className="flex-1 overflow-auto relative">
          <div style={{ width: totalWidth, minWidth: '100%', position: 'relative' }}>
            {/* 3-level sticky header */}
            <div className="sticky top-0 z-20" style={{ height: HEADER_H }}>
              {/* Year */}
              <div
                style={{ height: YEAR_H }}
                className="relative bg-card border-b border-border/60 flex items-center"
              >
                {yearBands.map((b, i) => (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: b.x, width: b.width, height: YEAR_H }}
                    className="flex items-center px-2 border-r border-border/30 overflow-hidden"
                  >
                    <span className="text-[10px] font-bold text-text-muted/70 font-mono tracking-widest">
                      {b.label}
                    </span>
                  </div>
                ))}
              </div>
              {/* Month */}
              <div style={{ height: MONTH_H }} className="relative bg-card border-b border-border">
                {monthBands.map((b, i) => (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: b.x, width: b.width, height: MONTH_H }}
                    className="flex items-center px-2 border-r border-border/50 overflow-hidden"
                  >
                    <span className="text-[11px] font-semibold text-text-secondary font-mono uppercase tracking-wider">
                      {b.label}
                    </span>
                  </div>
                ))}
                <div
                  style={{ position: 'absolute', left: todayX + DAY_W / 2 - 14, top: 2 }}
                  className="px-1.5 py-0.5 bg-accent text-white text-[9px] font-mono font-bold z-10 rounded-sm shadow"
                >
                  HOY
                </div>
              </div>
              {/* Days */}
              <div style={{ height: DAY_H }} className="relative bg-card border-b border-border">
                {dayColumns.map((d, i) => (
                  <div
                    key={i}
                    style={{ position: 'absolute', left: d.x, width: DAY_W, height: DAY_H }}
                    className={`flex items-center justify-center border-r border-border/20 ${d.isToday ? 'bg-accent/10' : d.isWeekend ? 'bg-surface/40' : ''}`}
                  >
                    <span
                      className={`text-[10px] font-mono ${d.isToday ? 'text-accent font-bold' : d.isWeekend ? 'text-text-muted/40' : 'text-text-muted/70'}`}
                    >
                      {d.n}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Today line */}
            <div
              style={{
                position: 'absolute',
                left: todayX + DAY_W / 2,
                top: YEAR_H + MONTH_H,
                bottom: 0,
                width: 1,
              }}
              className="bg-accent/50 z-10 pointer-events-none"
            />

            {/* Content rows */}
            <div style={{ position: 'relative' }}>
              {/* One section per sprint, sorted by startDate */}
              {[...sprints]
                .sort((a, b) => a.startDate.localeCompare(b.startDate))
                .map((sprint) => {
                  const { x, w } = sprintBarGeom(sprint);
                  // Merge live store data so dates/completion always reflect latest edits
                  const sprintCards = (sprint.cards ?? []).map(
                    (c: any) => cardById.get(c.id) ?? c
                  ) as any[];
                  const datedInSprint = sprintCards.filter((c: any) => c.dueDate || c.startDate);
                  const sprintMilestones = milestones.filter((m) => m.sprintId === sprint.id);
                  // Height: sprint bar row + one row per dated card + one milestone row at the bottom (if any milestones)
                  const cardRows = Math.max(datedInSprint.length, 0);
                  const milestoneRow = sprintMilestones.length > 0 ? 1 : 0;
                  const totalH = ROW_H * (1 + cardRows + milestoneRow);
                  // Milestone row sits at the very bottom of the section
                  const milestoneRowTop = ROW_H * (1 + cardRows);
                  return (
                    <div
                      key={sprint.id}
                      style={{ height: totalH, position: 'relative' }}
                      className="border-b border-border/50"
                    >
                      {/* Weekend / today shading */}
                      {dayColumns.map((d, i) =>
                        d.isWeekend || d.isToday ? (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: d.x,
                              top: 0,
                              bottom: 0,
                              width: DAY_W,
                            }}
                            className={d.isToday ? 'bg-accent/5' : 'bg-surface/20'}
                          />
                        ) : null
                      )}
                      {/* Sprint bar — row 0 */}
                      <div
                        style={{
                          position: 'absolute',
                          left: x,
                          top: ROW_H / 2 - 11,
                          width: w,
                          height: 22,
                        }}
                        className={`border rounded flex items-center px-2 gap-1.5 overflow-hidden shadow-sm pointer-events-none ${STATUS_BAR[sprint.status]} ${STATUS_PILL[sprint.status]}`}
                      >
                        <Zap className="w-3 h-3 flex-shrink-0" />
                        <span className="text-[10px] font-semibold font-mono truncate">
                          {sprint.name}
                        </span>
                        <span className="text-[9px] font-mono opacity-70 flex-shrink-0">
                          {sprint.startDate.slice(5, 10)} – {sprint.endDate.slice(5, 10)}
                        </span>
                      </div>
                      {/* Card bars — rows 1..cardRows */}
                      {datedInSprint.map((card: any, idx: number) => (
                        <CardBar key={card.id} card={card} topPx={ROW_H * (idx + 1)} />
                      ))}
                      {/* Milestone row — always last, below all cards */}
                      {sprintMilestones.length > 0 && (
                        <>
                          {/* Dashed separator line at the top of the milestone row */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              right: 0,
                              top: milestoneRowTop,
                              height: 1,
                            }}
                            className="border-t border-dashed border-border/40 pointer-events-none"
                          />
                          {sprintMilestones.map((m) => {
                            const mx =
                              daysBetween(rangeStart, parseDate(m.date)) * DAY_W + DAY_W / 2;
                            return (
                              <div
                                key={m.id}
                                style={{
                                  position: 'absolute',
                                  left: mx - 10,
                                  top: milestoneRowTop + ROW_H / 2 - 10,
                                }}
                                title={`${m.name} — ${m.date.slice(0, 10)}`}
                              >
                                <div
                                  style={{
                                    width: 20,
                                    height: 20,
                                    backgroundColor: m.color,
                                    transform: 'rotate(45deg)',
                                    borderRadius: 2,
                                  }}
                                  className="shadow-md cursor-pointer hover:scale-125 transition-transform"
                                />
                              </div>
                            );
                          })}
                          {/* Milestone label on the left edge */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 4,
                              top: milestoneRowTop,
                              height: ROW_H,
                            }}
                            className="flex items-center pointer-events-none"
                          >
                            <span className="text-[9px] font-mono text-text-muted/40 italic">
                              hitos
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}

              {/* Unassigned dated cards — last section */}
              {(() => {
                const unassigned = allBoardCards.filter(
                  (c) => !sprintCardIds.has(c.id) && (c.dueDate || c.startDate)
                );
                if (unassigned.length === 0) return null;
                const totalH = ROW_H * (1 + unassigned.length);
                return (
                  <div
                    style={{ height: totalH, position: 'relative' }}
                    className="border-b border-border/30"
                  >
                    {dayColumns.map((d, i) =>
                      d.isWeekend || d.isToday ? (
                        <div
                          key={i}
                          style={{
                            position: 'absolute',
                            left: d.x,
                            top: 0,
                            bottom: 0,
                            width: DAY_W,
                          }}
                          className={d.isToday ? 'bg-accent/5' : 'bg-surface/20'}
                        />
                      ) : null
                    )}
                    <div
                      style={{ position: 'absolute', left: 8, top: ROW_H / 2 - 8, height: 16 }}
                      className="flex items-center gap-1 text-[9px] text-text-muted/50 font-mono italic pointer-events-none"
                    >
                      sin sprint
                    </div>
                    {unassigned.map((card, idx) => (
                      <CardBar key={card.id} card={card} topPx={ROW_H * (idx + 1)} />
                    ))}
                  </div>
                );
              })()}

              {/* Unassigned milestones in canvas */}
              {(() => {
                const unassigned = milestones.filter((m) => !m.sprintId);
                if (unassigned.length === 0) return null;
                return (
                  <div
                    style={{ height: ROW_H * (1 + unassigned.length), position: 'relative' }}
                    className="border-b border-border/30"
                  >
                    {dayColumns.map(
                      (d, i) =>
                        (d.isWeekend || d.isToday) && (
                          <div
                            key={i}
                            style={{
                              position: 'absolute',
                              left: d.x,
                              top: 0,
                              bottom: 0,
                              width: DAY_W,
                            }}
                            className={d.isToday ? 'bg-accent/5' : 'bg-surface/20'}
                          />
                        )
                    )}
                    {unassigned.map((m, i) => {
                      const mx = daysBetween(rangeStart, parseDate(m.date)) * DAY_W + DAY_W / 2;
                      return (
                        <div
                          key={m.id}
                          style={{
                            position: 'absolute',
                            left: mx - 10,
                            top: ROW_H * (i + 1) + ROW_H / 2 - 10,
                          }}
                          title={`${m.name} — ${m.date.slice(0, 10)}`}
                        >
                          <div
                            style={{
                              width: 20,
                              height: 20,
                              backgroundColor: m.color,
                              transform: 'rotate(45deg)',
                              borderRadius: 2,
                            }}
                            className="shadow-md cursor-pointer hover:scale-125 transition-transform"
                          />
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              {/* Dependency connector lines — SVG overlay over entire canvas */}
              {depEdges.length > 0 &&
                (() => {
                  const paths: React.ReactNode[] = [];
                  for (const edge of depEdges) {
                    const from = cardCanvasGeom.get(edge.blockingCardId);
                    const to = cardCanvasGeom.get(edge.blockedCardId);
                    if (!from || !to) continue;

                    // Source point: bottom-right of blocking bar
                    const x1 = from.dueOnly
                      ? from.x + DAY_W / 2 + 8 // diamond center-right
                      : from.x + from.w; // bar right edge
                    const y1 = from.y + 22; // bar bottom (height=22)

                    // Target point: top-left of blocked bar
                    const x2 = to.dueOnly
                      ? to.x + DAY_W / 2 - 8 // diamond center-left
                      : to.x; // bar left edge
                    const y2 = to.y; // bar top

                    // Cubic bezier: drop down first, then travel horizontally
                    const dy = Math.abs(y2 - y1);
                    const curve = Math.max(dy * 0.5, 20);
                    const d = `M ${x1} ${y1} C ${x1} ${y1 + curve}, ${x2} ${y2 - curve}, ${x2} ${y2}`;

                    const isBlocked = !cardById.get(edge.blockingCardId)?.completed;
                    paths.push(
                      <path
                        key={edge.blockingCardId + '-' + edge.blockedCardId}
                        d={d}
                        fill="none"
                        stroke={
                          isBlocked
                            ? 'var(--color-error, #ef4444)'
                            : 'var(--color-success, #22c55e)'
                        }
                        strokeWidth={1.5}
                        strokeDasharray={isBlocked ? '4 3' : 'none'}
                        strokeOpacity={0.55}
                      />
                    );
                  }
                  if (paths.length === 0) return null;
                  return (
                    <svg
                      style={{
                        position: 'absolute',
                        inset: 0,
                        width: totalDays * DAY_W,
                        height: '100%',
                        pointerEvents: 'none',
                        overflow: 'visible',
                        zIndex: 5,
                      }}
                    >
                      {paths}
                    </svg>
                  );
                })()}
            </div>
          </div>
        </div>
      </div>

      {/* Drag overlay */}
      <DragOverlay>
        {draggingCard && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border border-accent bg-card shadow-xl text-[11px] font-mono text-text-primary max-w-[200px] opacity-90">
            {draggingCard.priority && (
              <div
                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[draggingCard.priority]}`}
              />
            )}
            <span className="truncate">{draggingCard.title}</span>
          </div>
        )}
        {draggingMilestone && (
          <div className="flex items-center gap-1.5 px-2 py-1.5 border border-accent bg-card shadow-xl text-[11px] font-mono text-text-primary max-w-[200px] opacity-90">
            <div
              style={{
                width: 10,
                height: 10,
                backgroundColor: draggingMilestone.color,
                transform: 'rotate(45deg)',
                flexShrink: 0,
              }}
              className="rounded-sm"
            />
            <span className="truncate">{draggingMilestone.name}</span>
          </div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
