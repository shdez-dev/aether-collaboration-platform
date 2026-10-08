// apps/web/src/app/dashboard/today/page.tsx
'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

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
  HIGH: '#B45C72', MEDIUM: '#A97556', LOW: '#548B73',
};

const WS_PALETTE = ['#8076A7', '#548B73', '#A97556', '#8262B2', '#7452A6', '#7D91B1'];
function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return WS_PALETTE[Math.abs(h) % WS_PALETTE.length];
}

function getDayLabel(dateStr: string): string {
  const d = new Date(dateStr);
  const days = ['DOM', 'LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB'];
  return days[d.getDay()];
}

function todayDate(): string {
  return new Date().toLocaleDateString('es', { weekday: 'long', day: 'numeric', month: 'long' });
}

// ── Task item — exact design spec ─────────────────────────────────────────────

function TaskItem({ title, project, dotColor, done, time, isOverdue, onToggle, onClick }: {
  title: string; project?: string; dotColor?: string;
  done: boolean; time?: string | null; isOverdue?: boolean;
  onToggle: () => void; onClick?: () => void;
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
        background: hov ? 'rgba(97,71,130,0.03)' : 'transparent',
      }}
    >
      <span
        onClick={e => { e.stopPropagation(); onToggle(); }}
        style={{
          width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
          background: done ? '#548B73' : 'transparent',
          border: done ? '2px solid #548B73' : '1.8px solid #3F3930',
          display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
        }}
      >
        {done && (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </span>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0, background: dotColor ?? 'var(--c-text4)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '14.5px', color: done ? 'var(--c-text4)' : 'var(--c-text2)', textDecoration: done ? 'line-through' : 'none' }}>
          {title}
        </div>
        {project && <div style={{ fontSize: '12px', color: 'var(--c-text3)', marginTop: '2px' }}>{project}</div>}
      </div>
      {time && (
        <span style={{
          fontSize: '12px', color: isOverdue ? '#B45C72' : 'var(--c-text3)',
          background: 'rgba(97,71,130,0.05)', padding: '3px 9px', borderRadius: '8px', flexShrink: 0,
        }}>
          {time}
        </span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function TodayPage() {
  const router = useRouter();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [cards, setCards] = useState<{ overdue: UserCard[]; today: UserCard[]; upcoming: UserCard[] }>({
    overdue: [], today: [], upcoming: [],
  });
  const [cardsLoading, setCardsLoading] = useState(true);

  const [todoItems, setTodoItems] = useState<TodoItem[]>([]);
  const [quickText, setQuickText] = useState('');
  const quickRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const firstWsId = workspaces[0]?.id ?? null;

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

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
      }, true).catch(() => {});
    }, 1500);
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
    setTimeout(() => quickRef.current?.focus(), 0);
  }

  function toggleTodo(id: string) {
    persistTodos(todoItems.map(i => i.id === id ? { ...i, completed: !i.completed } : i));
  }

  const pendingTodos = todoItems.filter(i => !i.completed);
  const doneTodos = todoItems.filter(i => i.completed);
  const totalToday = cards.today.length + pendingTodos.length + cards.overdue.length;

  const pendingLabel = (() => {
    const n = totalToday;
    if (n === 0) return 'Sin pendientes';
    return `${n} ${n === 1 ? 'pendiente' : 'pendientes'}`;
  })();

  return (
    <div style={{ maxWidth: '1140px', margin: '0 auto', padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px', fontFamily: MANROPE, animation: 'fadeUp .4s ease both' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: SORA, fontWeight: 700,
            fontSize: 'clamp(1.7rem,3vw,2.2rem)',
            letterSpacing: '-0.02em', color: 'var(--c-text)', margin: 0,
          }}>
            Para hoy
          </h1>
          <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: 'var(--c-text2)' }}>
            {todayDate()}
          </p>
        </div>
        <button
          onClick={() => quickRef.current?.focus()}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '11px 18px', borderRadius: '8px', border: 'none',
            background: '#7452A6', color: '#FFFFFF',
            fontFamily: SORA, fontWeight: 600, fontSize: '14px', cursor: 'pointer',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = 'none')}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round"/>
          </svg>
          Nueva tarea
        </button>
      </div>

      {/* Quick-add bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        marginTop: '24px', padding: '4px 4px 4px 18px', borderRadius: '8px',
        border: '1px solid rgba(97,71,130,0.09)', background: 'rgba(97,71,130,0.03)',
        maxWidth: '680px',
      }}>
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M12 5v14M5 12h14" stroke="#7452A6" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <input
          ref={quickRef}
          className="dshInput"
          value={quickText}
          onChange={e => setQuickText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addQuickTask(); }}
          placeholder="Añade una tarea y pulsa Enter"
          style={{
            flex: 1, minWidth: 0, padding: '13px 0', border: 'none',
            background: 'transparent', color: 'var(--c-text)',
            fontFamily: MANROPE, fontSize: '15.5px', outline: 'none',
          }}
        />
        <span style={{
          fontSize: '11.5px', color: 'var(--c-text4)',
          border: '1px solid rgba(97,71,130,0.1)', borderRadius: '8px',
          padding: '3px 8px', marginRight: '10px',
        }}>
          Enter
        </span>
      </div>

      {/* Task list */}
      <div style={{ maxWidth: '680px', marginTop: '30px' }}>

        {/* "Hoy" section */}
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: '10px' }}>
          <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: 0 }}>Hoy</h2>
          <span style={{ fontSize: '13px', color: 'var(--c-text3)' }}>{pendingLabel}</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          {cards.overdue.map(c => (
            <TaskItem
              key={`ov-${c.id}`}
              title={c.title}
              project={`${c.boardName} - ${c.workspaceName}`}
              dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? '#B45C72'}
              done={c.completed}
              time="Vencida"
              isOverdue
              onToggle={() => {}}
              onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
            />
          ))}
          {cards.today.map(c => (
            <TaskItem
              key={`td-${c.id}`}
              title={c.title}
              project={`${c.boardName} - ${c.workspaceName}`}
              dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)}
              done={c.completed}
              time="Hoy"
              onToggle={() => {}}
              onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
            />
          ))}
          {pendingTodos.map(item => (
            <TaskItem
              key={`td-todo-${item.id}`}
              title={item.text}
              dotColor="var(--c-text2)"
              done={false}
              onToggle={() => toggleTodo(item.id)}
            />
          ))}
          {doneTodos.map(item => (
            <TaskItem
              key={`done-${item.id}`}
              title={item.text}
              dotColor="#548B73"
              done
              onToggle={() => toggleTodo(item.id)}
            />
          ))}
          {cardsLoading && (
            <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
              <div style={{ width: '20px', height: '20px', borderRadius: '50%', border: '2px solid rgba(97,71,130,0.1)', borderTopColor: 'var(--c-accent-text)', animation: 'spin 0.8s linear infinite' }} />
            </div>
          )}
          {!cardsLoading && totalToday === 0 && (
            <div style={{ padding: '32px 14px', textAlign: 'center', color: 'var(--c-text4)', fontSize: '14px' }}>
              Sin tareas para hoy — usa el campo de arriba para añadir una.
            </div>
          )}
        </div>

        {/* "Próximas" section */}
        {cards.upcoming.length > 0 && (
          <>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: 'var(--c-text)', margin: '28px 0 10px' }}>
              Próximas
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {cards.upcoming.map(c => (
                <TaskItem
                  key={`up-${c.id}`}
                  title={c.title}
                  project={`${c.boardName} - ${c.workspaceName}`}
                  dotColor={PRIORITY_COLORS[c.priority ?? ''] ?? hashColor(c.boardId)}
                  done={c.completed}
                  time={c.dueDate ? getDayLabel(c.dueDate) : undefined}
                  onToggle={() => {}}
                  onClick={() => router.push(`/dashboard/boards/${c.boardId}`)}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
