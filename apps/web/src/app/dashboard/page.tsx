// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useMemo, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import type { Notification } from '@aether/types';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useProjectStore } from '@/stores/projectStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { groupMyDayCards, type MyDayCard } from '@/lib/myDay';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

type UserCard = MyDayCard;
type DayFilter = 'today' | 'week' | 'blocked';

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

const TODO_LS_KEY = 'aether-today-todos';
const TODO_TTL_MS = 24 * 60 * 60 * 1000;

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#B45C72',
  MEDIUM: '#A97556',
  LOW: '#548B73',
};

const WS_PALETTE = ['#8076A7', '#548B73', '#A97556', '#8262B2', '#7452A6', '#7D91B1'];
function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return WS_PALETTE[Math.abs(h) % WS_PALETTE.length];
}

function greetingText(name: string): string {
  const h = new Date().getHours();
  const first = name.split(' ')[0];
  if (h < 12) return `Buenos días, ${first}.`;
  if (h < 19) return `Buenas tardes, ${first}.`;
  return `Buenas noches, ${first}.`;
}

function formatDueShort(dueDate: string): string {
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '';
  const now = new Date(); now.setHours(0,0,0,0);
  const diffDays = (Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
    - Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())) / 86400000;
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

// ── Task item — matches design exactly ────────────────────────────────────────

function TaskItem({ title, project, dotColor, done, time, isOverdue, blockerCount = 0, onToggle, onClick }: {
  title: string;
  project?: string;
  dotColor?: string;
  done: boolean;
  time?: string | null;
  isOverdue?: boolean;
  blockerCount?: number;
  onToggle: () => void;
  onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px',
        padding: '8px 14px', borderRadius: '8px',
        background: hov ? 'rgba(97,71,130,0.03)' : 'transparent',
      }}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={blockerCount > 0 && !done}
        aria-label={blockerCount > 0 && !done ? `${title}: resuelve los bloqueos antes de completarla` : done ? `Marcar ${title} como pendiente` : `Completar ${title}`}
        title={blockerCount > 0 && !done ? 'Resuelve las dependencias pendientes para completarla' : undefined}
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          background: done ? '#548B73' : 'transparent',
          border: done ? '2px solid #548B73' : '1.8px solid #3F3930',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0, cursor: blockerCount > 0 && !done ? 'not-allowed' : 'pointer',
          opacity: blockerCount > 0 && !done ? .55 : 1,
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </button>

      <button type="button" onClick={onClick ?? onToggle} style={{
        display: 'flex', alignItems: 'center', gap: '13px', flex: 1, minWidth: 0,
        padding: '5px 0', border: 0, background: 'transparent', textAlign: 'left',
        cursor: 'pointer', fontFamily: MANROPE,
      }}>
        <span style={{
          width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
          background: dotColor ?? 'var(--c-text4)',
        }} />

        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{
            display: 'block', fontSize: '14.5px',
            color: done ? 'var(--c-text4)' : 'var(--c-text2)',
            textDecoration: done ? 'line-through' : 'none',
          }}>{title}</span>
          {(project || blockerCount > 0) && (
            <span style={{ display: 'block', fontSize: '12px', color: 'var(--c-text3)', marginTop: '2px' }}>
              {project}{blockerCount > 0 && <strong style={{ color: '#B45C72', fontWeight: 600 }}> · {blockerCount} {blockerCount === 1 ? 'bloqueo' : 'bloqueos'}</strong>}
            </span>
          )}
        </span>

        {time && (
          <span style={{
            fontSize: '12px', color: isOverdue ? '#B45C72' : 'var(--c-text3)',
            background: 'rgba(97,71,130,0.05)',
            padding: '3px 9px', borderRadius: '8px', flexShrink: 0,
          }}>{time}</span>
        )}
      </button>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { projects, fetchProjects } = useProjectStore();
  const { activeWorkspaceId, setActiveWorkspaceId } = useActiveWorkspaceStore();
  useT(); // keep i18n initialised

  const [assignedCards, setAssignedCards] = useState<UserCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState('');
  const [cardsRefreshKey, setCardsRefreshKey] = useState(0);
  const [referenceDate, setReferenceDate] = useState(() => new Date());
  const [dayFilter, setDayFilter] = useState<DayFilter>('today');
  const [togglingCards, setTogglingCards] = useState<Set<string>>(new Set());
  const notifications = useNotificationStore((state) => state.notifications);
  const fetchNotifications = useNotificationStore((state) => state.fetchNotifications);
  const markNotificationAsRead = useNotificationStore((state) => state.markAsRead);
  const cards = useMemo(() => groupMyDayCards(assignedCards, referenceDate), [assignedCards, referenceDate]);

  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [quickText, setQuickText] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const standupWorkspaceId = workspaces.find((workspace) => workspace.id === activeWorkspaceId)?.id ?? workspaces[0]?.id ?? null;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);
  useEffect(() => { if (user?.id) void fetchNotifications(); }, [fetchNotifications, user?.id]);

  useEffect(() => {
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const queueRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        setReferenceDate(new Date());
        setCardsRefreshKey((key) => key + 1);
      }, 120);
    };
    const onWorkspaceInvalidate = (event: Event) => {
      const update = (event as CustomEvent<{ workspaceId?: string; resource?: string }>).detail;
      if (!workspaces.some((workspace) => workspace.id === update?.workspaceId)
        || !['boards', 'all'].includes(update?.resource ?? '')) return;
      queueRefresh();
    };
    const onBoardEvent = (event: { type?: string }) => {
      if (event.type?.startsWith('card.')) queueRefresh();
    };
    const onVisibilityChange = () => { if (document.visibilityState === 'visible') queueRefresh(); };
    window.addEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
    window.addEventListener('focus', queueRefresh);
    document.addEventListener('visibilitychange', onVisibilityChange);
    socketService.on('event', onBoardEvent);
    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      window.removeEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
      window.removeEventListener('focus', queueRefresh);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      socketService.off('event', onBoardEvent);
    };
  }, [workspaces]);

  useEffect(() => {
    let active = true;
    setCardsLoading(true);
    setCardsError('');
    apiService.get<{ pending: UserCard[]; overdue: UserCard[] }>('/api/users/me/cards', true)
      .then(res => {
        if (!active) return;
        if (!res.success || !res.data) {
          setCardsError(res.error?.message ?? 'No se pudieron cargar tus tareas.');
          return;
        }
        const unique = new Map<string, UserCard>();
        for (const card of [...(res.data.pending ?? []), ...(res.data.overdue ?? [])]) {
          unique.set(card.id, { ...card, blockedByPendingCount: card.blockedByPendingCount ?? 0 });
        }
        setAssignedCards([...unique.values()]);
      })
      .catch(() => { if (active) setCardsError('No se pudieron cargar tus tareas.'); })
      .finally(() => { if (active) setCardsLoading(false); });
    return () => { active = false; };
  }, [cardsRefreshKey]);

  // LocalStorage todos
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TODO_LS_KEY);
      if (!raw) return;
      const items: TodoItem[] = JSON.parse(raw);
      const fresh = items.filter(i => new Date(i.createdAt).getTime() > Date.now() - TODO_TTL_MS);
      setTodoItems(fresh);
      localStorage.setItem(TODO_LS_KEY, JSON.stringify(fresh));
    } catch {}
  }, []);

  function persistTodos(items: TodoItem[]) {
    setTodoItems(items);
    try { localStorage.setItem(TODO_LS_KEY, JSON.stringify(items)); } catch {}
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!standupWorkspaceId) return;
      const pending = items.filter(i => !i.completed);
      apiService.put('/api/users/me/standup', {
        workspaceId: standupWorkspaceId,
        todayItems: pending.map(i => ({ id: i.id, text: i.text })),
        yesterdayItems: [], blockers: [],
      }, true).then(res => {
        if (res.success && pending.length > 0) apiService.post('/api/users/me/standup/publish', { workspaceId: standupWorkspaceId }, true);
      }).catch(() => {});
    }, 1500);
  }

  async function toggleCard(card: UserCard) {
    if (togglingCards.has(card.id)) return;
    setTogglingCards(prev => new Set([...prev, card.id]));

    const newCompleted = !card.completed;

    const applyToAll = (completed: boolean) =>
      setAssignedCards(prev => prev.map(c => c.id === card.id ? { ...c, completed } : c));

    applyToAll(newCompleted);

    try {
      const res = await apiService.put(`/api/cards/${card.id}`, { completed: newCompleted }, true);
      if (res.success && newCompleted) {
        setAssignedCards(prev => prev.filter(c => c.id !== card.id));
      } else if (!res.success) {
        applyToAll(card.completed);
      }
    } catch {
      applyToAll(card.completed);
    } finally {
      setTogglingCards(prev => { const s = new Set(prev); s.delete(card.id); return s; });
    }
  }

  function addQuickTask() {
    const text = quickText.trim();
    if (!text || text.length > 120) return;
    const item: TodoItem = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      text, completed: false, createdAt: new Date().toISOString(),
    };
    persistTodos([...todoItems, item]);
    setQuickText('');
  }

  function toggleTodo(id: string) {
    persistTodos(todoItems.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  }

  function openCard(card: UserCard) {
    setActiveWorkspaceId(card.workspaceId);
    router.push(`/dashboard/boards/${card.boardId}?cardId=${encodeURIComponent(card.id)}`);
  }

  function openMention(notification: Notification) {
    if (!notification.read) void markNotificationAsRead(notification.id);
    if (notification.data?.workspaceId) setActiveWorkspaceId(notification.data.workspaceId);
    if (notification.type === 'DOCUMENT_MENTION' && notification.data?.documentId) {
      router.push(`/dashboard/documents/${notification.data.documentId}`);
    } else if (notification.data?.boardId && notification.data?.cardId) {
      router.push(`/dashboard/boards/${notification.data.boardId}?cardId=${encodeURIComponent(notification.data.cardId)}`);
    } else {
      router.push('/dashboard/notifications');
    }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const greetMsg = greetingText(user?.name ?? 'equipo');
  const mentions = notifications.filter((notification) => !notification.read
    && (notification.type === 'COMMENT_MENTION' || notification.type === 'DOCUMENT_MENTION'));

  const recentProjects = [...projects]
    .filter(p => p.status !== 'ARCHIVED')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const pendingTodos = todoItems.filter(i => !i.completed);
  const doneTodos = todoItems.filter(i => i.completed);
  const totalToday = cards.today.length + cards.unscheduled.length + pendingTodos.length;
  const totalOverdue = cards.overdue.length;
  const todayCount = totalOverdue + totalToday;
  const weekCards = [...cards.today, ...cards.upcoming];
  const attentionCards = [
    ...cards.blocked.map((card) => ({ card, reason: 'Bloqueada' })),
    ...cards.overdue.filter((card) => !cards.blocked.some((blocked) => blocked.id === card.id))
      .map((card) => ({ card, reason: 'Vencida' })),
  ].slice(0, 4);

  const summaryText = (() => {
    const parts = [];
    if (totalOverdue) parts.push(`${totalOverdue} ${totalOverdue === 1 ? 'tarea vencida' : 'tareas vencidas'}`);
    if (totalToday) parts.push(`${totalToday} ${totalToday === 1 ? 'pendiente' : 'pendientes'} para hoy`);
    if (cards.blocked.length) parts.push(`${cards.blocked.length} ${cards.blocked.length === 1 ? 'bloqueo' : 'bloqueos'}`);
    if (mentions.length) parts.push(`${mentions.length} ${mentions.length === 1 ? 'mención nueva' : 'menciones nuevas'}`);
    return parts.length ? `${greetMsg} ${parts.join(' · ')}.` : `${greetMsg} Todo al día.`;
  })();

  const filterCount = dayFilter === 'today' ? todayCount : dayFilter === 'week' ? weekCards.length : cards.blocked.length;
  const pendingLabel = filterCount === 0 ? 'Sin pendientes' : `${filterCount} ${filterCount === 1 ? 'tarea' : 'tareas'}`;

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px', fontFamily: MANROPE }}>

      {/* Greeting */}
      <div style={{ animation: 'fadeUp .4s ease both' }}>
        <h1 style={{
          fontFamily: SORA, fontWeight: 700,
          fontSize: 'clamp(1.7rem,3vw,2.2rem)',
          letterSpacing: '-0.02em', color: 'var(--c-text)', margin: 0,
        }}>
          Mi día
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '1.05rem', color: totalOverdue > 0 ? '#B45C72' : 'var(--c-text2)' }}>
          {summaryText}
        </p>
      </div>

      {/* Quick-add bar — exact design spec */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginTop: '26px',
        padding: '4px 4px 4px 18px', borderRadius: '8px',
        border: '1px solid rgba(97,71,130,0.09)',
        background: 'rgba(97,71,130,0.03)',
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 5v14M5 12h14" stroke="#7452A6" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          ref={quickRef}
          className="dshInput"
          value={quickText}
          maxLength={120}
          onChange={e => setQuickText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addQuickTask(); }}
          placeholder="Añade un pendiente personal para hoy y pulsa Enter"
          style={{
            flex: 1, minWidth: 0, padding: '13px 0',
            border: 'none', background: 'transparent',
            color: 'var(--c-text)', fontFamily: MANROPE, fontSize: '15.5px', outline: 'none',
          }}
        />
        <span style={{ fontSize: '11px', color: 'var(--c-text4)', flexShrink: 0 }}>{quickText.length}/120</span>
        <span style={{
          fontSize: '11.5px', color: 'var(--c-text4)',
          border: '1px solid rgba(97,71,130,0.1)',
          borderRadius: '8px', padding: '3px 8px', marginRight: '10px',
        }}>
          Enter
        </span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '26px', alignItems: 'flex-start', marginTop: '30px', flexWrap: 'wrap' }}>

        {/* ── Left: Mi día ────────────────────────────────────────────────── */}
        <section style={{ flex: '1 1 440px', minWidth: 0 }}>

          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px', gap: '12px' }}>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: 0 }}>
              Tus tareas
            </h2>
            <span style={{ fontSize: '13px', color: 'var(--c-text3)' }}>{pendingLabel}</span>
          </div>

          <div role="group" aria-label="Filtrar tareas" style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginBottom: '12px' }}>
            {([
              ['today', 'Hoy', todayCount],
              ['week', 'Esta semana', weekCards.length],
              ['blocked', 'Bloqueado', cards.blocked.length],
            ] as const).map(([filter, label, count]) => (
              <button key={filter} type="button" onClick={() => setDayFilter(filter)} aria-pressed={dayFilter === filter}
                style={{ padding: '7px 11px', borderRadius: '8px', border: dayFilter === filter ? '1px solid rgba(116,82,166,0.35)' : '1px solid rgba(97,71,130,0.1)', background: dayFilter === filter ? 'rgba(116,82,166,0.12)' : 'transparent', color: dayFilter === filter ? 'var(--c-accent-text)' : 'var(--c-text3)', fontFamily: MANROPE, fontSize: '12px', fontWeight: dayFilter === filter ? 700 : 500, cursor: 'pointer' }}>
                {label} <span style={{ marginLeft: '4px', opacity: .8 }}>{count}</span>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {dayFilter === 'today' && cards.overdue.length > 0 && <p style={{ margin: '9px 14px 4px', fontSize: '11px', fontWeight: 700, color: '#B45C72', textTransform: 'uppercase', letterSpacing: '.06em' }}>Vencidas</p>}
            {dayFilter === 'today' && cards.overdue.map(c => (
              <TaskItem
                key={c.id}
                title={c.title}
                project={`${c.boardName} · ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? '#B45C72'}
                done={c.completed}
                time={c.dueDate ? formatDueShort(c.dueDate) : undefined}
                isOverdue
                blockerCount={c.blockedByPendingCount}
                onToggle={() => toggleCard(c)}
                onClick={() => openCard(c)}
              />
            ))}

            {dayFilter === 'today' && cards.today.length > 0 && <p style={{ margin: '9px 14px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Vencen hoy</p>}
            {dayFilter === 'today' && cards.today.map(c => (
              <TaskItem
                key={c.id}
                title={c.title}
                project={`${c.boardName} · ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)}
                done={c.completed}
                time={c.dueDate ? formatDueShort(c.dueDate) : undefined}
                blockerCount={c.blockedByPendingCount}
                onToggle={() => toggleCard(c)}
                onClick={() => openCard(c)}
              />
            ))}

            {dayFilter === 'today' && cards.unscheduled.length > 0 && <p style={{ margin: '9px 14px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Sin fecha</p>}
            {dayFilter === 'today' && cards.unscheduled.map(c => (
              <TaskItem key={c.id} title={c.title} project={`${c.boardName} · ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)} done={c.completed}
                blockerCount={c.blockedByPendingCount} onToggle={() => toggleCard(c)} onClick={() => openCard(c)} />
            ))}

            {dayFilter === 'today' && (pendingTodos.length > 0 || doneTodos.length > 0) && <p style={{ margin: '9px 14px 4px', fontSize: '11px', fontWeight: 700, color: 'var(--c-text3)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Pendientes personales</p>}
            {dayFilter === 'today' && pendingTodos.map(item => (
              <TaskItem
                key={item.id}
                title={item.text}
                dotColor="var(--c-text2)"
                done={false}
                onToggle={() => toggleTodo(item.id)}
              />
            ))}

            {dayFilter === 'today' && doneTodos.map(item => (
              <TaskItem
                key={item.id}
                title={item.text}
                dotColor="#548B73"
                done
                onToggle={() => toggleTodo(item.id)}
              />
            ))}

            {dayFilter === 'week' && weekCards.map(c => (
              <TaskItem key={c.id} title={c.title} project={`${c.boardName} · ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)} done={c.completed}
                time={c.dueDate ? formatDueShort(c.dueDate) : undefined} blockerCount={c.blockedByPendingCount}
                onToggle={() => toggleCard(c)} onClick={() => openCard(c)} />
            ))}

            {dayFilter === 'blocked' && cards.blocked.map(c => (
              <TaskItem key={c.id} title={c.title} project={`${c.boardName} · ${c.workspaceName}`}
                dotColor="#B45C72" done={c.completed} time={c.dueDate ? formatDueShort(c.dueDate) : undefined}
                blockerCount={c.blockedByPendingCount} onToggle={() => toggleCard(c)} onClick={() => openCard(c)} />
            ))}

            {cardsLoading && assignedCards.length === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid rgba(97,71,130,0.1)', borderTopColor: 'var(--c-accent-text)',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {cardsError && <div role="alert" style={{ padding: '12px 14px', color: '#B45C72', fontSize: '13px' }}>
              {cardsError} <button type="button" onClick={() => setCardsRefreshKey(key => key + 1)} style={{ border: 0, background: 'transparent', color: 'var(--c-accent-text)', fontWeight: 700, cursor: 'pointer' }}>Reintentar</button>
            </div>}

            {!cardsLoading && !cardsError && filterCount === 0 && (dayFilter !== 'today' || todoItems.length === 0) && (
              <div style={{ padding: '40px 14px', textAlign: 'center' }}>
                <p style={{ color: 'var(--c-text4)', fontSize: '14px', margin: '0 0 14px' }}>
                  {dayFilter === 'blocked' ? 'No tienes tareas bloqueadas' : dayFilter === 'week' ? 'Sin tareas con fecha esta semana' : 'Sin tareas para hoy'}
                </p>
                {dayFilter === 'today' && <button
                  onClick={() => quickRef.current?.focus()}
                  style={{
                    background: 'rgba(116,82,166,0.1)', border: '1px solid rgba(116,82,166,0.2)',
                    color: 'var(--c-accent-text)', borderRadius: '8px', padding: '8px 18px',
                    fontFamily: SORA, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  + Añadir tarea
                </button>}
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Aside ──────────────────────────────────────────────── */}
        <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Necesita tu atención */}
          <section>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: '0 0 14px' }}>
              Necesita tu atención
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {attentionCards.length > 0 ? attentionCards.map(({ card: c, reason }) => (
                <button
                  key={c.id} type="button"
                  onClick={() => openCard(c)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', borderRadius: '8px', cursor: 'pointer', border: 0, width: '100%', background: 'transparent', textAlign: 'left', fontFamily: MANROPE }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.03)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: hashColor(c.workspaceId),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#FFFFFF',
                  }}>
                    {c.workspaceName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: 'var(--c-text2)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--c-text)' }}>{c.title}</strong>
                    <span style={{ display: 'block', color: 'var(--c-text3)', fontSize: '11px', marginTop: '2px' }}>{c.boardName}</span>
                  </div>
                  <span style={{ fontSize: '11px', color: '#B45C72', flexShrink: 0 }}>
                    {reason}
                  </span>
                </button>
              )) : (
                <div style={{ padding: '16px 12px', fontSize: '13px', color: 'var(--c-text4)' }}>
                  Sin elementos urgentes — <span style={{ color: '#548B73' }}>¡todo bien!</span>
                </div>
              )}
            </div>
          </section>

          <section>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '10px', marginBottom: '14px' }}>
              <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: 0 }}>Menciones</h2>
              <button type="button" onClick={() => router.push('/dashboard/notifications')} style={{ border: 0, background: 'transparent', color: 'var(--c-accent-text)', fontFamily: MANROPE, fontSize: '12px', cursor: 'pointer' }}>Ver todas</button>
            </div>
            {mentions.length > 0 ? mentions.slice(0, 4).map(notification => (
              <button key={notification.id} type="button" onClick={() => openMention(notification)}
                style={{ display: 'block', width: '100%', padding: '10px 12px', border: 0, borderRadius: '8px', background: 'transparent', textAlign: 'left', cursor: 'pointer', fontFamily: MANROPE }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.03)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
                <strong style={{ display: 'block', color: 'var(--c-text)', fontSize: '13px', fontWeight: 600 }}>{notification.title}</strong>
                {notification.message && <span style={{ display: 'block', color: 'var(--c-text3)', fontSize: '12px', marginTop: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notification.message}</span>}
              </button>
            )) : <div style={{ padding: '16px 12px', fontSize: '13px', color: 'var(--c-text4)' }}>Sin menciones nuevas</div>}
          </section>

          {/* Continúa donde lo dejaste */}
          <section>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: '0 0 14px' }}>
              Continúa donde lo dejaste
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentProjects.map(p => {
                const color = p.color ?? '#8076A7';
                const pct   = p.progressPercent ?? p.stats?.progressPercent ?? 0;
                const statusLabel = p.status === 'ACTIVE' ? 'Activo' : p.status === 'PLANNING' ? 'Planificación' : p.status === 'ON_HOLD' ? 'En pausa' : p.status === 'COMPLETED' ? 'Completado' : p.status;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setActiveWorkspaceId(p.workspaceId); router.push(`/dashboard/projects/${p.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '13px',
                      padding: '13px', borderRadius: '8px',
                      border: '1px solid rgba(97,71,130,0.07)',
                      background: 'rgba(97,71,130,0.02)', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.16)'; (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.02)'; }}
                  >
                    {/* Project icon */}
                    <span style={{
                      width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0,
                      background: `${color}22`, border: `1px solid ${color}33`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {p.icon
                        ? <WorkspaceIcon icon={p.icon} style={{ width: '17px', height: '17px', color }} />
                        : <span style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 700, color }}>{(p.name.trim()[0] ?? '?').toUpperCase()}</span>
                      }
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: 'var(--c-text3)' }}>{statusLabel}</span>
                        {pct > 0 && (
                          <>
                            <span style={{ fontSize: '11px', color: 'var(--c-text4)' }}>-</span>
                            <span style={{ fontSize: '11px', color }}>{ pct}%</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M9 6l6 6-6 6" stroke="var(--c-text4)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                );
              })}
              {recentProjects.length === 0 && (
                <div style={{
                  padding: '20px', textAlign: 'center', fontSize: '13px', color: 'var(--c-text4)',
                  border: '1px dashed rgba(97,71,130,0.07)', borderRadius: '8px',
                }}>
                  Sin proyectos aún
                </div>
              )}
            </div>
          </section>

        </aside>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
