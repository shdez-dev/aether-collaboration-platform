// apps/web/src/app/dashboard/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useProjectStore } from '@/stores/projectStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserCard {
  id: string;
  title: string;
  dueDate: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  completed: boolean;
  listName: string;
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

const TODO_LS_KEY = 'aether-today-todos';
const TODO_TTL_MS = 24 * 60 * 60 * 1000;

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: '#E05252',
  MEDIUM: '#DB8A66',
  LOW: '#76A878',
};

const WS_PALETTE = ['#4B607F', '#76A878', '#DB8A66', '#8C7C9E', '#F2571E', '#5B8FA8'];
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
  const now = new Date(); now.setHours(0,0,0,0);
  const diffDays = Math.ceil((d.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) return `Hace ${Math.abs(diffDays)}d`;
  if (diffDays === 0) return 'Hoy';
  if (diffDays === 1) return 'Mañana';
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short' });
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  return days[d.getDay()];
}

// ── Task item — matches design exactly ────────────────────────────────────────

function TaskItem({ title, project, dotColor, done, time, isOverdue, onToggle, onClick }: {
  title: string;
  project?: string;
  dotColor?: string;
  done: boolean;
  time?: string | null;
  isOverdue?: boolean;
  onToggle: () => void;
  onClick?: () => void;
}) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick ?? onToggle}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px',
        padding: '13px 14px', borderRadius: '8px', cursor: 'pointer',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
      }}
    >
      {/* Circle checkbox */}
      <span
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          background: done ? '#76A878' : 'transparent',
          border: done ? '2px solid #76A878' : '1.8px solid #3F3930',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#24180A" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>

      {/* Color dot */}
      <span style={{
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
        background: dotColor ?? '#615846',
      }} />

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14.5px',
          color: done ? '#615846' : '#D8D0C1',
          textDecoration: done ? 'line-through' : 'none',
        }}>
          {title}
        </div>
        {project && (
          <div style={{ fontSize: '12px', color: '#827A6D', marginTop: '2px' }}>{project}</div>
        )}
      </div>

      {/* Time badge */}
      {time && (
        <span style={{
          fontSize: '12px', color: isOverdue ? '#E05252' : '#8B8275',
          background: 'rgba(255,255,255,0.05)',
          padding: '3px 9px', borderRadius: '8px', flexShrink: 0,
        }}>
          {time}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { projects, fetchProjects } = useProjectStore();
  const { setActiveWorkspaceId } = useActiveWorkspaceStore();
  useT(); // keep i18n initialised

  const [cards, setCards] = useState<{ overdue: UserCard[]; today: UserCard[]; upcoming: UserCard[] }>({
    overdue: [], today: [], upcoming: [],
  });
  const [cardsLoading, setCardsLoading] = useState(true);
  const [togglingCards, setTogglingCards] = useState<Set<string>>(new Set());

  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [quickText, setQuickText] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstWsId = workspaces[0]?.id ?? null;

  // ── Fetch ────────────────────────────────────────────────────────────────────
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  useEffect(() => {
    setCardsLoading(true);
    apiService.get<{ pending: UserCard[]; overdue: UserCard[] }>('/api/users/me/cards', true)
      .then(res => {
        if (!res.success || !res.data) return;
        const { pending = [], overdue: ov = [] } = res.data;
        const now = new Date();
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const weekEnd = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);
        setCards({
          overdue: ov,
          today: pending.filter(c => c.dueDate && new Date(c.dueDate) <= todayEnd),
          upcoming: pending.filter(c => c.dueDate && new Date(c.dueDate) > todayEnd && new Date(c.dueDate) <= weekEnd),
        });
      })
      .finally(() => setCardsLoading(false));
  }, []);

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
      if (!firstWsId) return;
      const pending = items.filter(i => !i.completed);
      apiService.put('/api/users/me/standup', {
        workspaceId: firstWsId,
        todayItems: pending.map(i => ({ id: i.id, text: i.text })),
        yesterdayItems: [], blockers: [],
      }, true).then(res => {
        if (res.success && pending.length > 0) apiService.post('/api/users/me/standup/publish', { workspaceId: firstWsId }, true);
      }).catch(() => {});
    }, 1500);
  }

  async function toggleCard(card: UserCard) {
    if (togglingCards.has(card.id)) return;
    setTogglingCards(prev => new Set([...prev, card.id]));

    const newCompleted = !card.completed;

    const applyToAll = (completed: boolean) =>
      setCards(prev => ({
        overdue: prev.overdue.map(c => c.id === card.id ? { ...c, completed } : c),
        today:   prev.today.map(c => c.id === card.id ? { ...c, completed } : c),
        upcoming: prev.upcoming.map(c => c.id === card.id ? { ...c, completed } : c),
      }));

    applyToAll(newCompleted);

    try {
      const res = await apiService.put(`/api/cards/${card.id}`, { completed: newCompleted }, true);
      if (res.success && newCompleted) {
        // Remove from lists after brief visual confirmation
        setTimeout(() => {
          setCards(prev => ({
            overdue:  prev.overdue.filter(c => c.id !== card.id),
            today:    prev.today.filter(c => c.id !== card.id),
            upcoming: prev.upcoming.filter(c => c.id !== card.id),
          }));
        }, 750);
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
    if (!text) return;
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

  // ── Derived ──────────────────────────────────────────────────────────────────
  const greetMsg = greetingText(user?.name ?? 'equipo');

  const recentProjects = [...projects]
    .filter(p => p.status !== 'ARCHIVED')
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 3);

  const pendingTodos = todoItems.filter(i => !i.completed);
  const doneTodos = todoItems.filter(i => i.completed);
  const totalToday = cards.today.length + pendingTodos.length;
  const totalOverdue = cards.overdue.length;

  const summaryText = (() => {
    if (totalOverdue > 0) return `Tienes ${totalOverdue} ${totalOverdue === 1 ? 'tarea vencida' : 'tareas vencidas'} y ${totalToday} para hoy.`;
    if (totalToday > 0) return `Tienes ${totalToday} ${totalToday === 1 ? 'tarea pendiente' : 'tareas pendientes'} para hoy.`;
    return 'Todo al día. ¡Buen trabajo!';
  })();

  const pendingLabel = (() => {
    const n = totalToday + totalOverdue;
    if (n === 0) return 'Sin pendientes';
    return `${n} ${n === 1 ? 'tarea' : 'tareas'}`;
  })();

  // Agenda grouped by day label
  const agendaByDay: { day: string; color: string; tasks: UserCard[] }[] = [];
  const dayColors = ['#4B607F', '#76A878', '#DB8A66', '#8C7C9E', '#F2571E', '#5B8FA8'];
  const seenDays: Record<string, number> = {};
  for (const c of cards.upcoming) {
    if (!c.dueDate) continue;
    const day = getDayLabel(c.dueDate);
    if (seenDays[day] === undefined) { seenDays[day] = agendaByDay.length; agendaByDay.push({ day, color: dayColors[agendaByDay.length % dayColors.length], tasks: [] }); }
    agendaByDay[seenDays[day]].tasks.push(c);
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px', fontFamily: MANROPE }}>

      {/* Greeting */}
      <div style={{ animation: 'fadeUp .4s ease both' }}>
        <h1 style={{
          fontFamily: SORA, fontWeight: 700,
          fontSize: 'clamp(1.7rem,3vw,2.2rem)',
          letterSpacing: '-0.02em', color: '#F4EEE2', margin: 0,
        }}>
          {greetMsg}
        </h1>
        <p style={{ margin: '8px 0 0', fontSize: '1.05rem', color: totalOverdue > 0 ? '#E05252' : '#9C9486' }}>
          {summaryText}
        </p>
      </div>

      {/* Quick-add bar — exact design spec */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginTop: '26px',
        padding: '4px 4px 4px 18px', borderRadius: '8px',
        border: '1px solid rgba(255,255,255,0.09)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 5v14M5 12h14" stroke="#F2571E" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          ref={quickRef}
          className="dshInput"
          value={quickText}
          onChange={e => setQuickText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addQuickTask(); }}
          placeholder="Añade una tarea para hoy y pulsa Enter"
          style={{
            flex: 1, minWidth: 0, padding: '13px 0',
            border: 'none', background: 'transparent',
            color: '#E8E1D2', fontFamily: MANROPE, fontSize: '15.5px', outline: 'none',
          }}
        />
        <span style={{
          fontSize: '11.5px', color: '#5C5447',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '8px', padding: '3px 8px', marginRight: '10px',
        }}>
          Enter
        </span>
      </div>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '26px', alignItems: 'flex-start', marginTop: '30px', flexWrap: 'wrap' }}>

        {/* ── Left: Para hoy ─────────────────────────────────────────────── */}
        <section style={{ flex: '1 1 440px', minWidth: 0 }}>

          {/* Section header — Sora h2, same as design */}
          <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '14px' }}>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: '#E8E1D2', margin: 0 }}>
              Para hoy
            </h2>
            <span style={{ fontSize: '13px', color: '#827A6D' }}>{pendingLabel}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* Overdue */}
            {cards.overdue.map(c => (
              <TaskItem
                key={c.id}
                title={c.title}
                project={`${c.boardName} - ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? '#E05252'}
                done={c.completed}
                time={c.dueDate ? formatDueShort(c.dueDate) : undefined}
                isOverdue
                onToggle={() => toggleCard(c)}
                onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
              />
            ))}

            {/* Today cards */}
            {cards.today.map(c => (
              <TaskItem
                key={c.id}
                title={c.title}
                project={`${c.boardName} - ${c.workspaceName}`}
                dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)}
                done={c.completed}
                time={c.dueDate ? formatDueShort(c.dueDate) : undefined}
                onToggle={() => toggleCard(c)}
                onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
              />
            ))}

            {/* Quick-add todos */}
            {pendingTodos.map(item => (
              <TaskItem
                key={item.id}
                title={item.text}
                dotColor="#9C9486"
                done={false}
                onToggle={() => toggleTodo(item.id)}
              />
            ))}

            {/* Done todos */}
            {doneTodos.map(item => (
              <TaskItem
                key={item.id}
                title={item.text}
                dotColor="#76A878"
                done
                onToggle={() => toggleTodo(item.id)}
              />
            ))}

            {/* Loading */}
            {cardsLoading && totalToday === 0 && (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                <div style={{
                  width: '20px', height: '20px', borderRadius: '50%',
                  border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#F2571E',
                  animation: 'spin 0.8s linear infinite',
                }} />
              </div>
            )}

            {/* Empty */}
            {!cardsLoading && totalToday === 0 && totalOverdue === 0 && todoItems.length === 0 && (
              <div style={{ padding: '40px 14px', textAlign: 'center' }}>
                <p style={{ color: '#615846', fontSize: '14px', margin: '0 0 14px' }}>
                  Sin tareas para hoy
                </p>
                <button
                  onClick={() => quickRef.current?.focus()}
                  style={{
                    background: 'rgba(242,87,30,0.1)', border: '1px solid rgba(242,87,30,0.2)',
                    color: '#F2571E', borderRadius: '8px', padding: '8px 18px',
                    fontFamily: SORA, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                  }}
                >
                  + Añadir tarea
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ── Right: Aside ──────────────────────────────────────────────── */}
        <aside style={{ flex: '1 1 320px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Necesita tu atención */}
          <section>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: '#E8E1D2', margin: '0 0 14px' }}>
              Necesita tu atención
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              {cards.overdue.length > 0 ? cards.overdue.slice(0, 3).map(c => (
                <div
                  key={c.id}
                  onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
                  style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 12px', borderRadius: '8px', cursor: 'pointer' }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                >
                  <span style={{
                    width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
                    background: hashColor(c.workspaceId),
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#24180A',
                  }}>
                    {c.workspaceName?.[0]?.toUpperCase() ?? '?'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: '13px', color: '#C8BFAE', lineHeight: 1.4 }}>
                    <strong style={{ color: '#E8E1D2' }}>{c.boardName}</strong>{' '}
                    tiene una tarea en{' '}
                    <strong style={{ color: '#F2571E' }}>{c.title}</strong>
                  </div>
                  <span style={{ fontSize: '11px', color: '#736B5E', flexShrink: 0 }}>
                    {c.dueDate ? formatDueShort(c.dueDate) : ''}
                  </span>
                </div>
              )) : (
                <div style={{ padding: '16px 12px', fontSize: '13px', color: '#615846' }}>
                  Sin elementos urgentes — <span style={{ color: '#76A878' }}>¡todo bien!</span>
                </div>
              )}
            </div>
          </section>

          {/* Continúa donde lo dejaste */}
          <section>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: '#E8E1D2', margin: '0 0 14px' }}>
              Continúa donde lo dejaste
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {recentProjects.map(p => {
                const color = p.color ?? '#4B607F';
                const pct   = p.progressPercent ?? p.stats?.progressPercent ?? 0;
                const statusLabel = p.status === 'ACTIVE' ? 'Activo' : p.status === 'PLANNING' ? 'Planificación' : p.status === 'ON_HOLD' ? 'En pausa' : p.status === 'COMPLETED' ? 'Completado' : p.status;
                return (
                  <div
                    key={p.id}
                    onClick={() => { setActiveWorkspaceId(p.workspaceId); router.push(`/dashboard/projects/${p.id}`); }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '13px',
                      padding: '13px', borderRadius: '8px',
                      border: '1px solid rgba(255,255,255,0.07)',
                      background: 'rgba(255,255,255,0.02)', cursor: 'pointer',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; }}
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
                      <div style={{ fontSize: '14px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {p.name}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                        <span style={{ fontSize: '11px', color: '#827A6D' }}>{statusLabel}</span>
                        {pct > 0 && (
                          <>
                            <span style={{ fontSize: '11px', color: '#5C5447' }}>-</span>
                            <span style={{ fontSize: '11px', color }}>{ pct}%</span>
                          </>
                        )}
                      </div>
                    </div>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                      <path d="M9 6l6 6-6 6" stroke="#5C5447" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </div>
                );
              })}
              {recentProjects.length === 0 && (
                <div style={{
                  padding: '20px', textAlign: 'center', fontSize: '13px', color: '#615846',
                  border: '1px dashed rgba(255,255,255,0.07)', borderRadius: '8px',
                }}>
                  Sin proyectos aún
                </div>
              )}
            </div>
          </section>

          {/* Tu semana */}
          {agendaByDay.length > 0 && (
            <section>
              <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: '#E8E1D2', margin: '0 0 14px' }}>
                Tu semana
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {agendaByDay.slice(0, 5).flatMap(grp =>
                  grp.tasks.map(c => (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', borderRadius: '8px', cursor: 'pointer' }}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                    >
                      <span style={{ fontFamily: SORA, fontSize: '11px', fontWeight: 700, color: '#827A6D', width: '34px', flexShrink: 0 }}>
                        {grp.day}
                      </span>
                      <span style={{ width: '3px', height: '26px', borderRadius: '8px', background: grp.color, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '13.5px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {c.title}
                      </span>
                      <span style={{ fontSize: '12px', color: '#827A6D' }}>
                        {c.dueDate ? formatDueShort(c.dueDate) : ''}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </section>
          )}
        </aside>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
