'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { AlertTriangle, CheckCircle2, Clock, Users, Send, ExternalLink } from 'lucide-react';
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

interface TeamStandup {
  id: string;
  userId: string;
  userName: string;
  userAvatar: string | null;
  todayItems: { id: string; text: string }[];
  blockers: { id: string; text: string }[];
  publishedAt: string;
}

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
  const [teammates,     setTeammates]     = useState<Teammate[]>([]);
  const [teamStandups,  setTeamStandups]  = useState<TeamStandup[]>([]);
  const [teamLoading,   setTeamLoading]   = useState(true);

  // My standup
  const [standupText,    setStandupText]    = useState('');
  const [standupPublished, setStandupPublished] = useState(false);
  const [standupSaving,  setStandupSaving]  = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // First workspace for standup API
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
        const noDateCards   = pending.filter((c) => !c.dueDate);

        setOverdue(ov);
        setToday(todayCards);
        setUpcoming(upcomingCards);
        setNoDate(noDateCards);
      })
      .finally(() => setCardsLoading(false));
  }, []);

  useEffect(() => {
    setTeamLoading(true);
    Promise.all([
      apiService.get<{ teammates: Teammate[] }>('/api/users/me/teammates', true),
      apiService.get<{ standups: TeamStandup[] }>('/api/users/me/team-standups', true),
    ]).then(([tmRes, sdRes]) => {
      if (tmRes.success && tmRes.data) setTeammates(tmRes.data.teammates);
      if (sdRes.success && sdRes.data) setTeamStandups(sdRes.data.standups);
    }).finally(() => setTeamLoading(false));
  }, []);

  // Load my standup
  useEffect(() => {
    if (!firstWsId) return;
    apiService.get<{ todayItems: { text: string }[]; publishedAt: string | null }>(
      `/api/users/me/standup?workspaceId=${firstWsId}`, true
    ).then((res) => {
      if (res.success && res.data) {
        const text = (res.data.todayItems ?? []).map((i) => i.text).join(', ');
        setStandupText(text);
        setStandupPublished(!!res.data.publishedAt);
      }
    });
  }, [firstWsId]);

  // Autosave standup con debounce
  const saveStandup = useCallback((text: string) => {
    if (!firstWsId || !text.trim()) return;
    setStandupSaving(true);
    apiService.put('/api/users/me/standup', {
      workspaceId:   firstWsId,
      todayItems:    [{ text }],
      yesterdayItems: [],
      blockers:      [],
    }, true).finally(() => setStandupSaving(false));
  }, [firstWsId]);

  function handleStandupChange(val: string) {
    setStandupText(val);
    setStandupPublished(false);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => saveStandup(val), 1200);
  }

  async function publishStandup() {
    if (!firstWsId || !standupText.trim()) return;
    await saveStandup(standupText);
    const res = await apiService.post('/api/users/me/standup/publish', { workspaceId: firstWsId }, true);
    if (res.success) setStandupPublished(true);
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

          {/* Standup input */}
          <div style={{ padding: '14px 24px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            <MiniAvatar name={user?.name ?? 'U'} size={28} />
            <input
              value={standupText}
              onChange={(e) => handleStandupChange(e.target.value)}
              placeholder={t.dashboard_standup_placeholder}
              disabled={standupPublished}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '13.5px', color: standupPublished ? C.text3 : C.text,
                fontStyle: standupPublished ? 'italic' : 'normal',
              }}
              onKeyDown={(e) => { if (e.key === 'Enter') publishStandup(); }}
            />
            {standupPublished ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: C.green }}>
                <CheckCircle2 style={{ width: '13px', height: '13px' }} />
                {t.dashboard_standup_published}
              </div>
            ) : standupText.trim() ? (
              <button
                onClick={publishStandup}
                disabled={standupSaving}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', opacity: standupSaving ? 0.7 : 1 }}
              >
                <Send style={{ width: '11px', height: '11px' }} />
                {standupSaving ? t.btn_saving : t.btn_save}
              </button>
            ) : (
              <span style={{ fontSize: '11px', color: C.text4 }}>{t.dashboard_standup_hint}</span>
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

            {/* HOY EN EL EQUIPO (standups) */}
            {(teamStandups.length > 0 || !teamLoading) && (
              <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.dashboard_activity_title}</span>
                </div>

                <div style={{ padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {teamStandups.length === 0 ? (
                    <div style={{ fontSize: '12px', color: C.text4, textAlign: 'center', padding: '10px 0' }}>
                      {t.dashboard_activity_empty}
                    </div>
                  ) : (
                    teamStandups.map((sd) => (
                      <div key={sd.id} style={{ display: 'flex', gap: '9px' }}>
                        <MiniAvatar name={sd.userName} size={24} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11.5px', fontWeight: 600, color: C.text2, marginBottom: '3px' }}>
                            {sd.userName.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: '12px', color: C.text3, lineHeight: 1.5 }}>
                            {sd.todayItems.map((i) => i.text).join(' · ')}
                          </div>
                          {sd.blockers.length > 0 && (
                            <div style={{ fontSize: '11.5px', color: C.amber, marginTop: '4px', display: 'flex', alignItems: 'flex-start', gap: '4px' }}>
                              <AlertTriangle style={{ width: '11px', height: '11px', marginTop: '2px', flexShrink: 0 }} />
                              {sd.blockers.map((b) => b.text).join(', ')}
                            </div>
                          )}
                          <div style={{ fontSize: '10.5px', color: C.text4, marginTop: '4px' }}>
                            {timeAgo(sd.publishedAt, t)}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
    </>
  );
}
