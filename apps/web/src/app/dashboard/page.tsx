'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { Users, ExternalLink, Plus, X, Check, Clock, FileText, MessageCircle, LayoutGrid, Archive, User, Tag, Edit, Trash2, Move } from 'lucide-react';
import { useT } from '@/lib/i18n';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

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

interface Teammate {
  id: string;
  name: string;
  email: string;
  avatar: string | null;
  totalCards: number;
  overdueCards: number;
  completedThisWeek: number;
  lastActivity: string | null;
}

interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface UserActivityEvent {
  id: string;
  type: string;
  payload: Record<string, any>;
  timestamp: string;
  userName: string;
  userAvatar: string | null;
}

const TODO_LS_KEY = 'aether-today-todos';
const TODO_TTL_MS = 24 * 60 * 60 * 1000;

// ── Helpers ───────────────────────────────────────────────────────────────────

function timeAgo(date: string | null | undefined, t: Record<string, any>): string {
  if (!date) return '';
  const diff = Date.now() - new Date(date).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)   return t.activity_time_just_now;
  if (m < 60)  return t.activity_time_minutes(m);
  if (h < 24)  return t.activity_time_hours(h);
  if (d < 30)  return t.activity_time_days(d);
  return t.activity_time_days(Math.floor(d / 30) * 30);
}

function greeting(name: string, t: ReturnType<typeof useT>): string {
  const h = new Date().getHours();
  const firstName = name.split(' ')[0];
  if (h < 12) return `${t.dashboard_greeting_morning}, ${firstName}.`;
  if (h < 19) return `${t.dashboard_greeting_afternoon}, ${firstName}.`;
  return `${t.dashboard_greeting_evening}, ${firstName}.`;
}

function dueSoon(dueDate: string | null): boolean {
  if (!dueDate) return false;
  const d = Math.ceil((new Date(dueDate).getTime() - Date.now()) / 86400000);
  return d >= 0 && d <= 2;
}

const AVATAR_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c'];
function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function MiniAvatar({ name, size = 24 }: { name: string; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: hashColor(name),
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size < 28 ? '10px' : '12px', fontWeight: 700, color: '#fff', flexShrink: 0,
    }}>
      {name.trim()[0]?.toUpperCase() ?? '?'}
    </div>
  );
}

// ── Card item row ─────────────────────────────────────────────────────────────

function CardRow({ card, router, t }: { card: UserCard; router: ReturnType<typeof useRouter>; t: Record<string, any> }) {
  const [hov, setHov] = useState(false);
  const isOverdue = !card.completed && card.dueDate && new Date(card.dueDate) < new Date();
  const soon = dueSoon(card.dueDate);

  return (
    <div
      onClick={() => router.push(`/dashboard/workspaces/${card.workspaceId}/boards/${card.boardId}`)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', borderRadius: '7px', cursor: 'pointer',
        background: hov ? C.hover : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      {/* Priority dot */}
      <div style={{
        width: '7px', height: '7px', borderRadius: '50%', flexShrink: 0,
        background: card.priority === 'HIGH' ? C.red : card.priority === 'MEDIUM' ? C.amber : C.border2,
      }} />

      {/* Title + context */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '13px', color: C.text, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {card.title}
        </div>
        <div style={{ fontSize: '11px', color: C.text4, marginTop: '1px' }}>
          {card.boardName} · {card.workspaceName}
        </div>
      </div>

      {/* Due date */}
      {card.dueDate && (
        <div style={{
          fontSize: '11px', fontWeight: 600, flexShrink: 0,
          color: isOverdue ? C.red : soon ? C.amber : C.text4,
        }}>
          {isOverdue
            ? t.dashboard_card_overdue_days(Math.abs(Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000)))
            : soon
            ? `${Math.ceil((new Date(card.dueDate).getTime() - Date.now()) / 86400000)}d`
            : new Date(card.dueDate).toLocaleDateString(t.locale, { day: 'numeric', month: 'short' })
          }
        </div>
      )}

      {hov && (
        <ExternalLink style={{ width: '11px', height: '11px', color: C.text4, flexShrink: 0 }} />
      )}
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────

function SectionLabel({ children, count }: { children: React.ReactNode; count?: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 10px', marginBottom: '4px' }}>
      <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4 }}>
        {children}
      </span>
      {count !== undefined && (
        <span style={{ fontSize: '10px', color: C.text4 }}>({count})</span>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router   = useRouter();
  const { user } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const t = useT();

  const [isCreateWsOpen, setIsCreateWsOpen] = useState(false);

  // Cards
  const [overdue,  setOverdue]  = useState<UserCard[]>([]);
  const [today,    setToday]    = useState<UserCard[]>([]);
  const [upcoming, setUpcoming] = useState<UserCard[]>([]);
  const [noDate,   setNoDate]   = useState<UserCard[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);

  // Team
  const [teammates,   setTeammates]   = useState<Teammate[]>([]);
  const [teamLoading, setTeamLoading] = useState(true);

  // My activity
  const [myActivity,       setMyActivity]       = useState<UserActivityEvent[]>([]);
  const [activityLoading,  setActivityLoading]  = useState(true);

  // Todo list widget
  const [todoItems,    setTodoItems]    = useState<TodoItem[]>([]);
  const [newItemText,  setNewItemText]  = useState('');
  const [isAddingItem, setIsAddingItem] = useState(false);
  const newItemRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // First workspace for standup API sync
  const firstWsId = workspaces[0]?.id ?? null;

  // ── Fetch data ──────────────────────────────────────────────────────────────

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    setCardsLoading(true);
    apiService.get<{ pending: UserCard[]; overdue: UserCard[] }>('/api/users/me/cards', true)
      .then((res) => {
        if (!res.success || !res.data) return;
        const { pending = [], overdue: ov = [] } = res.data;

        const now = new Date();
        const todayEnd = new Date(now); todayEnd.setHours(23, 59, 59, 999);
        const weekEnd  = new Date(now); weekEnd.setDate(weekEnd.getDate() + 7);

        const todayCards    = pending.filter((c) => c.dueDate && new Date(c.dueDate) <= todayEnd);
        const upcomingCards = pending.filter((c) => c.dueDate && new Date(c.dueDate) > todayEnd && new Date(c.dueDate) <= weekEnd);
        const laterCards    = pending.filter((c) => c.dueDate && new Date(c.dueDate) > weekEnd);
        const noDateCards   = pending.filter((c) => !c.dueDate);

        setOverdue(ov);
        setToday(todayCards);
        setUpcoming([...upcomingCards, ...laterCards]);
        setNoDate(noDateCards);
      })
      .finally(() => setCardsLoading(false));
  }, []);

  useEffect(() => {
    setTeamLoading(true);
    apiService.get<{ teammates: Teammate[] }>('/api/users/me/teammates', true)
      .then((res) => {
        if (res.success && res.data) setTeammates(res.data.teammates);
      })
      .finally(() => setTeamLoading(false));
  }, []);

  useEffect(() => {
    setActivityLoading(true);
    apiService.get<{ events: UserActivityEvent[] }>('/api/users/me/activity?range=week', true)
      .then((res) => {
        if (res.success && res.data) setMyActivity(res.data.events || []);
      })
      .finally(() => setActivityLoading(false));
  }, []);

  // Load + purge todo items from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(TODO_LS_KEY);
      if (!raw) return;
      const items: TodoItem[] = JSON.parse(raw);
      const cutoff = Date.now() - TODO_TTL_MS;
      const fresh = items.filter((i) => new Date(i.createdAt).getTime() > cutoff);
      localStorage.setItem(TODO_LS_KEY, JSON.stringify(fresh));
      setTodoItems(fresh);
    } catch {}
  }, []);

  function persistTodos(items: TodoItem[]) {
    setTodoItems(items);
    try { localStorage.setItem(TODO_LS_KEY, JSON.stringify(items)); } catch {}
    // Sync non-completed items to standup API for team visibility (debounced)
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!firstWsId) return;
      const pendingItems = items.filter((i) => !i.completed);
      apiService.put('/api/users/me/standup', {
        workspaceId:    firstWsId,
        todayItems:     pendingItems.map((i) => ({ id: i.id, text: i.text })),
        yesterdayItems: [],
        blockers:       [],
      }, true).then((res) => {
        if (res.success && pendingItems.length > 0) {
          apiService.post('/api/users/me/standup/publish', { workspaceId: firstWsId }, true);
        }
      }).catch(() => {});
    }, 1500);
  }

  function addTodoItem() {
    const text = newItemText.trim();
    if (!text) return;
    const item: TodoItem = {
      id: Math.random().toString(36).slice(2) + Date.now().toString(36),
      text,
      completed: false,
      createdAt: new Date().toISOString(),
    };
    persistTodos([...todoItems, item]);
    setNewItemText('');
    setTimeout(() => newItemRef.current?.focus(), 0);
  }

  function toggleTodo(id: string) {
    persistTodos(todoItems.map((i) => i.id === id ? { ...i, completed: !i.completed } : i));
  }

  function deleteTodo(id: string) {
    persistTodos(todoItems.filter((i) => i.id !== id));
  }

  // ── Derived ─────────────────────────────────────────────────────────────────

  const totalPending  = overdue.length + today.length + upcoming.length + noDate.length;
  const summaryLine   = overdue.length > 0
    ? t.dashboard_summary_overdue_today(overdue.length, today.length)
    : today.length > 0
    ? t.dashboard_summary_today(today.length)
    : totalPending > 0
    ? t.dashboard_summary_week(totalPending)
    : t.dashboard_summary_all_done;

  // ── Activity helpers ────────────────────────────────────────────────────────

  function getActivityIcon(type: string) {
    const s = 12;
    if (type.startsWith('comment'))   return <MessageCircle width={s} height={s} />;
    if (type.startsWith('document'))  return <FileText width={s} height={s} />;
    if (type.startsWith('board'))     return <LayoutGrid width={s} height={s} />;
    if (type.startsWith('list'))      return <LayoutGrid width={s} height={s} />;
    if (type.includes('archived'))    return <Archive width={s} height={s} />;
    if (type.includes('assigned'))    return <User width={s} height={s} />;
    if (type.includes('label'))       return <Tag width={s} height={s} />;
    if (type.includes('moved'))       return <Move width={s} height={s} />;
    if (type.includes('created'))     return <Plus width={s} height={s} />;
    if (type.includes('deleted'))     return <Trash2 width={s} height={s} />;
    if (type.includes('updated') || type.includes('renamed') || type.includes('changed')) return <Edit width={s} height={s} />;
    return <Clock width={s} height={s} />;
  }

  function getActivityIconColor(type: string): string {
    if (type.includes('deleted'))  return C.red;
    if (type.includes('archived')) return C.amber;
    if (type.includes('created'))  return C.green;
    if (type.includes('completed')) return C.green;
    if (type.includes('moved'))    return C.amber;
    return C.accent;
  }

  function getActivityText(event: UserActivityEvent): { action: string; subject?: string; extra?: string } {
    const { type, payload } = event;
    const title = payload.cardTitle || payload.title || payload.name || '';
    const newTitle = payload.newTitle || payload.newName || '';

    switch (type) {
      // Workspace
      case 'workspace.created':      return { action: t.activity_workspace_created, subject: payload.name };
      case 'workspace.updated':      return { action: t.activity_workspace_updated, subject: payload.name };
      case 'workspace.member.invited': return { action: t.activity_workspace_member_invited, subject: payload.inviteeName, extra: payload.workspaceName };
      case 'workspace.member.joined':  return { action: t.activity_workspace_member_joined };
      case 'workspace.member.removed':     return { action: t.activity_workspace_member_removed, subject: payload.memberName };
      case 'workspace.deleted':            return { action: t.activity_workspace_deleted, subject: payload.name };
      case 'workspace.member.roleChanged': return { action: t.activity_workspace_member_role_changed, subject: payload.memberName, extra: payload.newRole };
      // Board
      case 'board.created':   return { action: t.activity_board_created, subject: payload.name || payload.title };
      case 'board.updated':   return { action: t.activity_board_updated, subject: payload.name || payload.title };
      case 'board.archived':  return { action: t.activity_board_archived, subject: payload.name || payload.title };
      case 'board.unarchived':return { action: t.activity_board_unarchived, subject: payload.name || payload.title };
      case 'board.deleted':   return { action: t.activity_board_deleted, subject: payload.name || payload.title };
      case 'board.renamed':   return { action: t.activity_board_renamed, subject: newTitle || payload.name };
      // List
      case 'list.created':  return { action: t.activity_list_created, subject: payload.name, extra: payload.boardTitle || payload.boardName };
      case 'list.renamed':  return { action: t.activity_list_renamed, subject: payload.name };
      case 'list.deleted':  return { action: t.activity_list_deleted, subject: payload.name };
      // Card
      case 'card.created':   return { action: t.activity_card_created, subject: payload.title, extra: payload.listName };
      case 'card.deleted':   return { action: t.activity_card_deleted, subject: payload.title };
      case 'card.moved':     return { action: t.activity_card_moved, subject: payload.title, extra: payload.toListName || payload.newListName };
      case 'card.completed': return { action: t.activity_card_completed, subject: payload.title };
      case 'card.uncompleted': return { action: t.activity_card_uncompleted, subject: payload.title };
      case 'card.renamed':   return { action: t.activity_card_renamed, subject: newTitle || payload.title };
      case 'card.description.changed': return { action: t.activity_card_description_changed, subject: title };
      case 'card.priority.changed':    return { action: t.activity_card_priority_changed, subject: title };
      case 'card.archived':            return { action: t.activity_card_archived, subject: title };
      case 'card.unarchived':          return { action: t.activity_card_unarchived, subject: title };
      case 'card.duedate.set':         return { action: t.activity_card_duedate_set, subject: title };
      case 'card.duedate.changed':     return { action: t.activity_card_duedate_changed, subject: title };
      case 'card.duedate.removed':     return { action: t.activity_card_duedate_removed, subject: title };
      case 'card.member.assigned':     return { action: t.activity_member_assigned, subject: payload.assignedUserName || payload.memberName, extra: title };
      case 'card.member.unassigned':   return { action: t.activity_member_unassigned, subject: payload.unassignedUserName || payload.memberName, extra: title };
      case 'card.label.added':           return { action: t.activity_label_added, subject: payload.labelName, extra: title };
      case 'card.label.removed':         return { action: t.activity_label_removed, subject: payload.labelName, extra: title };
      case 'card.dependency.added':      return { action: t.activity_card_dependency_added, subject: payload.blockingCardTitle || payload.blockingCardId, extra: payload.blockedCardTitle || payload.blockedCardId };
      case 'card.dependency.removed':    return { action: t.activity_card_dependency_removed, subject: payload.cardTitle || payload.cardId };
      // Comment
      case 'comment.created':   return { action: t.activity_comment_created, subject: payload.cardTitle };
      case 'comment.updated':   return { action: t.activity_comment_updated, subject: payload.cardTitle };
      case 'comment.deleted':   return { action: t.activity_comment_deleted, subject: payload.cardTitle };
      case 'comment.mentioned': return { action: t.activity_comment_mentioned, subject: payload.cardTitle };
      // Checklist
      case 'checklist.item.created': return { action: t.activity_checklist_item_created, subject: payload.cardTitle };
      case 'checklist.item.deleted': return { action: t.activity_checklist_item_deleted, subject: payload.cardTitle };
      // Document
      case 'document.created':          return { action: t.activity_document_created, subject: payload.title };
      case 'document.deleted':          return { action: t.activity_document_deleted, subject: payload.title };
      case 'document.version.created':  return { action: t.activity_document_version, subject: payload.title };
      case 'document.version.restored':    return { action: t.activity_document_version_restored, subject: payload.title };
      case 'document.permission.updated':  return { action: t.activity_document_permission_updated, subject: payload.title };
      // Project
      case 'project.created':            return { action: t.activity_project_created, subject: payload.name };
      case 'project.updated':            return { action: t.activity_project_updated, subject: payload.name };
      case 'project.deleted':            return { action: t.activity_project_deleted, subject: payload.name };
      case 'project.status.changed':     return { action: t.activity_project_status_changed, subject: payload.name, extra: payload.newStatus };
      case 'project.board.assigned':     return { action: t.activity_project_board_assigned, subject: payload.boardName, extra: payload.projectName };
      case 'project.board.removed':      return { action: t.activity_project_board_removed, subject: payload.boardName, extra: payload.projectName };
      case 'project.milestone.created':  return { action: t.activity_project_milestone_created, subject: payload.milestoneName, extra: payload.projectName };
      case 'project.milestone.completed':return { action: t.activity_project_milestone_completed, subject: payload.milestoneName, extra: payload.projectName };
      // Team
      case 'team.created':              return { action: t.activity_team_created, subject: payload.name };
      case 'team.updated':              return { action: t.activity_team_updated, subject: payload.name };
      case 'team.deleted':              return { action: t.activity_team_deleted, subject: payload.name };
      case 'team.member.added':         return { action: t.activity_team_member_added, subject: payload.memberName, extra: payload.teamName };
      case 'team.member.removed':       return { action: t.activity_team_member_removed, subject: payload.memberName, extra: payload.teamName };
      case 'team.member.roleChanged':   return { action: t.activity_team_member_role_changed, subject: payload.memberName, extra: payload.teamName };
      default: return { action: t.activity_default };
    }
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <>
    {isCreateWsOpen && (
      <CreateWorkspaceModal isOpen={isCreateWsOpen} onClose={() => setIsCreateWsOpen(false)} />
    )}
    <div style={{ height: '100%', overflow: 'auto', background: C.bg }}>
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '32px 28px', display: 'flex', flexDirection: 'column', gap: '28px' }}>

        {/* ── GREETING + SUMMARY + STANDUP ─────────────────────────────── */}
        <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>

          {/* Greeting row */}
          <div style={{ padding: '20px 24px 16px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '18px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
              {greeting(user?.name ?? t.sidebar_unknown_user, t)}
            </div>
            <div style={{ fontSize: '13px', color: overdue.length > 0 ? C.red : C.text3 }}>
              {summaryLine}
            </div>
          </div>

          {/* Todo list widget */}
          <div style={{ padding: '14px 24px 16px' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4, marginBottom: '10px' }}>
              {t.dashboard_standup_placeholder}
            </div>

            {/* Items list — scrollable when > 5 */}
            {todoItems.length > 0 && (
              <div style={{
                maxHeight: todoItems.length > 5 ? '168px' : 'none',
                overflowY: todoItems.length > 5 ? 'auto' : 'visible',
                marginBottom: '4px',
              }}>
                {todoItems.map((item) => (
                  <div
                    key={item.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', minHeight: '30px' }}
                  >
                    {/* Text */}
                    <span style={{
                      flex: 1, fontSize: '13.5px', lineHeight: 1.4,
                      color: item.completed ? C.green : C.text,
                    }}>
                      {item.text}
                    </span>

                    {/* Actions: check + delete */}
                    <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
                      <button
                        onClick={() => toggleTodo(item.id)}
                        style={{
                          width: '22px', height: '22px', borderRadius: '5px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: item.completed ? `${C.green}20` : 'none',
                          border: 'none', cursor: 'pointer', color: C.green,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.green}28`; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = item.completed ? `${C.green}20` : 'none'; }}
                      >
                        <Check size={13} strokeWidth={2.5} />
                      </button>
                      <button
                        onClick={() => deleteTodo(item.id)}
                        style={{
                          width: '22px', height: '22px', borderRadius: '5px',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: 'none', border: 'none', cursor: 'pointer', color: C.text4,
                          transition: 'background 0.12s',
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.red}20`; e.currentTarget.style.color = C.red; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text4; }}
                      >
                        <X size={12} strokeWidth={2} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add item: input when active, + button otherwise */}
            {isAddingItem ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '3px 0', marginTop: todoItems.length > 0 ? '4px' : '0' }}>
                <input
                  ref={newItemRef}
                  autoFocus
                  value={newItemText}
                  onChange={(e) => setNewItemText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') addTodoItem();
                    if (e.key === 'Escape') { setIsAddingItem(false); setNewItemText(''); }
                  }}
                  placeholder={t.dashboard_todo_add_placeholder}
                  style={{
                    flex: 1, background: 'transparent', border: 'none', outline: 'none',
                    fontSize: '13.5px', color: C.text,
                    borderBottom: `1px solid ${C.border2}`, paddingBottom: '2px',
                  }}
                />
                <button
                  onClick={addTodoItem}
                  disabled={!newItemText.trim()}
                  style={{
                    width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: newItemText.trim() ? C.accent : C.hover,
                    border: 'none', cursor: newItemText.trim() ? 'pointer' : 'default',
                    transition: 'background 0.12s',
                  }}
                >
                  <Plus size={12} color="#fff" strokeWidth={2.5} />
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', marginTop: todoItems.length > 0 ? '8px' : '0' }}>
                <button
                  onClick={() => setIsAddingItem(true)}
                  style={{
                    width: '22px', height: '22px', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'none', border: `1.5px dashed ${C.border2}`,
                    cursor: 'pointer', color: C.text4, transition: 'all 0.12s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = C.accent;
                    e.currentTarget.style.color = C.accent;
                    e.currentTarget.style.background = `${C.accent}12`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = C.border2;
                    e.currentTarget.style.color = C.text4;
                    e.currentTarget.style.background = 'none';
                  }}
                >
                  <Plus size={11} strokeWidth={2.5} />
                </button>
                {todoItems.length === 0 && (
                  <span style={{ fontSize: '11.5px', color: C.text4 }}>
                    {t.dashboard_standup_hint}
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── MAIN GRID ────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '20px', alignItems: 'start' }}>

          {/* ── MIS TAREAS ───────────────────────────────────────────── */}
          <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
            <div style={{ padding: '14px 20px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{t.dashboard_section_my_cards}</span>
              {totalPending > 0 && (
                <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '8px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}` }}>
                  {totalPending}
                </span>
              )}
            </div>

            <div style={{ padding: '12px 10px' }}>
              {cardsLoading ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                  <div className="w-5 h-5 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
                </div>
              ) : totalPending === 0 && overdue.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '36px 0', color: C.text4, fontSize: '13px' }}>
                  {t.dashboard_empty_pending_title}
                </div>
              ) : (
                <>
                  {/* Vencidas */}
                  {overdue.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <SectionLabel count={overdue.length}>
                        <span style={{ color: C.red }}>⚠ {t.dashboard_tab_overdue}</span>
                      </SectionLabel>
                      {overdue.map((c) => <CardRow key={c.id} card={c} router={router} t={t} />)}
                    </div>
                  )}

                  {/* Hoy */}
                  {today.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <SectionLabel count={today.length}>{t.dashboard_due_today}</SectionLabel>
                      {today.map((c) => <CardRow key={c.id} card={c} router={router} t={t} />)}
                    </div>
                  )}

                  {/* Esta semana */}
                  {upcoming.length > 0 && (
                    <div style={{ marginBottom: '16px' }}>
                      <SectionLabel count={upcoming.length}>{t.dashboard_this_week}</SectionLabel>
                      {upcoming.map((c) => <CardRow key={c.id} card={c} router={router} t={t} />)}
                    </div>
                  )}

                  {/* Sin fecha */}
                  {noDate.length > 0 && (
                    <div>
                      <SectionLabel count={noDate.length}>{t.board_filter_date_none}</SectionLabel>
                      {noDate.map((c) => <CardRow key={c.id} card={c} router={router} t={t} />)}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>

          {/* ── COLUMNA DERECHA ──────────────────────────────────────── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* MI EQUIPO */}
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Users style={{ width: '13px', height: '13px', color: C.text4 }} />
                <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.teams_title}</span>
              </div>

              <div style={{ padding: '8px 0' }}>
                {teamLoading ? (
                  <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                    <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
                  </div>
                ) : teammates.length === 0 ? (
                  <div style={{ padding: '18px 16px', fontSize: '12px', color: C.text4, textAlign: 'center' }}>
                    {t.teams_empty_title}
                  </div>
                ) : (
                  teammates.map((tm) => (
                    <div
                      key={tm.id}
                      style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 16px' }}
                    >
                      <MiniAvatar name={tm.name} size={26} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12.5px', fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {tm.name.split(' ')[0]}
                        </div>
                        <div style={{ fontSize: '11px', color: tm.overdueCards > 0 ? C.red : C.text4 }}>
                          {tm.totalCards} cards{tm.overdueCards > 0 ? ` · ${tm.overdueCards} ${t.dashboard_overdue_label(tm.overdueCards)}` : ''}
                        </div>
                      </div>
                      <div style={{ fontSize: '10.5px', color: C.text4, flexShrink: 0 }}>
                        {timeAgo(tm.lastActivity, t)}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* MI ACTIVIDAD RECIENTE */}
            <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                  <Clock style={{ width: '13px', height: '13px', color: C.text4 }} />
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.dashboard_my_activity_title}</span>
                </div>
                <span style={{ fontSize: '10.5px', color: C.text4 }}>{t.dashboard_my_activity_range}</span>
              </div>

              {activityLoading ? (
                <div style={{ padding: '20px', display: 'flex', justifyContent: 'center' }}>
                  <div className="w-4 h-4 rounded-full border-2 animate-spin" style={{ borderColor: C.border2, borderTopColor: C.accent }} />
                </div>
              ) : myActivity.length === 0 ? (
                <div style={{ padding: '18px 16px', fontSize: '12px', color: C.text4, textAlign: 'center' }}>
                  {t.dashboard_my_activity_empty}
                </div>
              ) : (
                <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
                  {myActivity.map((event, i) => {
                    const { action, subject, extra } = getActivityText(event);
                    const iconColor = getActivityIconColor(event.type);
                    return (
                      <div
                        key={event.id}
                        style={{
                          display: 'flex', alignItems: 'flex-start', gap: '9px',
                          padding: '8px 16px',
                          borderBottom: i < myActivity.length - 1 ? `1px solid ${C.border}` : 'none',
                        }}
                      >
                        <div style={{
                          width: '24px', height: '24px', borderRadius: '5px', flexShrink: 0,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          background: `${iconColor}18`, color: iconColor,
                          border: `1px solid ${iconColor}28`,
                          marginTop: '1px',
                        }}>
                          {getActivityIcon(event.type)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: '12px', color: C.text, lineHeight: 1.4, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            <span style={{ color: C.text3 }}>{action}</span>
                            {subject && <> <strong style={{ color: C.text, fontWeight: 500 }}>{subject}</strong></>}
                            {extra && <span style={{ color: C.text4 }}> · {extra}</span>}
                          </p>
                          <div style={{ fontSize: '10.5px', color: C.text4, marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {[event.payload.workspaceName, event.payload.boardName].filter(Boolean).join(' › ')}
                            {(event.payload.workspaceName || event.payload.boardName) && ' · '}
                            {timeAgo(event.timestamp, t)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
    </>
  );
}
