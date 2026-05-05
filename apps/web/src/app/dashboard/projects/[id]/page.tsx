'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjectStore, type Project, type ProjectMilestone, type ProjectBoard } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import { useTeamStore } from '@/stores/teamStore';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import {
  Plus, X, Check, Trash2, AlertCircle, Flag,
  LayoutDashboard, Settings, MoreHorizontal,
  Calendar, Clock, Target, Users, GitBranch,
} from 'lucide-react';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusCfg(status: string, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'ACTIVE':    return { label: t.projects_status_active,    color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.25)' };
    case 'PLANNING':  return { label: t.projects_status_planning,  color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.25)' };
    case 'ON_HOLD':   return { label: t.projects_status_on_hold,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.25)' };
    case 'COMPLETED': return { label: t.projects_status_completed, color: '#a1a7b0', bg: 'rgba(161,167,176,0.1)',  border: 'rgba(161,167,176,0.2)' };
    case 'ARCHIVED':  return { label: t.projects_status_cancelled, color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' };
    default:          return { label: status,                       color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.2)' };
  }
}

function getHealthCfg(score: number, t: ReturnType<typeof useT>) {
  if (score >= 70) return { label: t.projects_health_good,     color: '#10b981', bg: 'rgba(16,185,129,0.12)', border: 'rgba(16,185,129,0.25)' };
  if (score >= 40) return { label: t.projects_health_at_risk,  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', border: 'rgba(245,158,11,0.25)' };
  return              { label: t.projects_health_critical,      color: '#ef4444', bg: 'rgba(239,68,68,0.12)',  border: 'rgba(239,68,68,0.25)' };
}

function getMilestoneCfg(status: string, t: ReturnType<typeof useT>) {
  if (status === 'REACHED') return { color: C.green, bg: 'rgba(16,185,129,0.12)', label: t.projects_milestone_achieved };
  if (status === 'MISSED')  return { color: C.red,   bg: 'rgba(239,68,68,0.12)',  label: t.projects_milestone_missed   };
  return                            { color: C.text3, bg: C.hover,                label: t.projects_milestone_pending  };
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}
function fmtShort(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}
function fmtMonth(d: string) {
  return new Date(d).toLocaleDateString('es-ES', { month: 'short' }).toUpperCase();
}
function timeAgo(d: string, t: ReturnType<typeof useT>) {
  const ms = Date.now() - new Date(d).getTime();
  const m = Math.floor(ms / 60000), h = Math.floor(ms / 3600000), dy = Math.floor(ms / 86400000);
  if (m < 1)   return t.projects_time_ago_now;
  if (m < 60)  return t.projects_time_ago_min(m);
  if (h < 24)  return t.projects_time_ago_h(h);
  if (dy < 30) return t.projects_time_ago_d(dy);
  return t.projects_time_ago_d(Math.floor(dy / 30));
}
function daysLeft(endDate: string | null | undefined, t: ReturnType<typeof useT>): { n: number; label: string; color: string } | null {
  if (!endDate) return null;
  const d = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (d < -90 || d > 365) return null;
  if (d < 0)  return { n: Math.abs(d), label: t.projects_overdue(Math.abs(d)),  color: C.red };
  if (d === 0) return { n: 0,          label: t.projects_due_today,              color: C.amber };
  if (d <= 7)  return { n: d,          label: t.projects_days_left(d),           color: C.amber };
  return              { n: d,          label: t.projects_days_left(d),           color: C.text2 };
}

const ic = (s: number) => ({ width: `${s}px`, height: `${s}px` } as const);

// ── Timeline horizontal ───────────────────────────────────────────────────────
function TimelineBar({
  startDate, endDate, milestones, color, t,
}: {
  startDate: string; endDate: string;
  milestones: ProjectMilestone[];
  color: string;
  t: ReturnType<typeof useT>;
}) {
  const start = new Date(startDate).getTime();
  const end   = new Date(endDate).getTime();
  const total = end - start;
  const now   = Date.now();

  const todayPct  = Math.min(100, Math.max(0, ((now - start) / total) * 100));
  const pastStart = now < start;
  const pastEnd   = now > end;

  function msPct(m: ProjectMilestone) {
    return Math.min(100, Math.max(0, ((new Date(m.date).getTime() - start) / total) * 100));
  }

  const cfg = (status: string) => getMilestoneCfg(status, t);

  return (
    <div style={{ padding: '10px 20px 14px', borderBottom: `1px solid ${C.border}`, background: C.bg2 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <Calendar style={{ ...ic(11), color: C.text4 }} />
        <span style={{ fontSize: '11px', color: C.text4 }}>
          {fmtShort(startDate)} → {fmtShort(endDate)}
        </span>
        {pastEnd && <span style={{ fontSize: '10px', fontWeight: 600, color: C.red, padding: '1px 6px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)' }}>VENCIDO</span>}
      </div>

      {/* Track */}
      <div style={{ position: 'relative', height: '24px' }}>
        {/* Background line */}
        <div style={{ position: 'absolute', top: '11px', left: 0, right: 0, height: '2px', background: C.border2, borderRadius: '1px' }} />

        {/* Progress fill */}
        <div style={{ position: 'absolute', top: '11px', left: 0, height: '2px', width: `${todayPct}%`, background: `linear-gradient(to right, ${color}, ${color}99)`, borderRadius: '1px', transition: 'width 0.3s' }} />

        {/* Start label */}
        <span style={{ position: 'absolute', left: 0, top: 0, fontSize: '10px', color: C.text4, whiteSpace: 'nowrap' }}>
          {fmtMonth(startDate)}
        </span>

        {/* End label */}
        <span style={{ position: 'absolute', right: 0, top: 0, fontSize: '10px', color: C.text4, whiteSpace: 'nowrap' }}>
          {fmtMonth(endDate)}
        </span>

        {/* HOY marker */}
        {!pastStart && !pastEnd && (
          <div style={{ position: 'absolute', left: `${todayPct}%`, transform: 'translateX(-50%)', top: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
            <div style={{ width: '2px', height: '12px', background: color, borderRadius: '1px' }} />
            <span style={{ fontSize: '9px', fontWeight: 700, color, letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>HOY</span>
          </div>
        )}

        {/* Milestones as diamonds */}
        {milestones.map((m) => {
          const pct = msPct(m);
          const mc  = cfg(m.status);
          const isPast = new Date(m.date) < new Date() && m.status === 'PENDING';
          return (
            <div key={m.id} title={`${m.name} — ${fmtShort(m.date)}`}
              style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)', top: '5px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', cursor: 'default' }}
            >
              {/* Diamond shape */}
              <div style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', background: isPast ? C.red : mc.color, borderRadius: '2px', border: `2px solid ${C.bg2}`, flexShrink: 0 }} />
              <span style={{ fontSize: '9px', color: isPast ? C.red : C.text4, whiteSpace: 'nowrap', maxWidth: '60px', overflow: 'hidden', textOverflow: 'ellipsis', textAlign: 'center' }}>
                {m.name.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Project Gantt Timeline ────────────────────────────────────────────────────

interface TimelineCard {
  id: string;
  title: string;
  dueDate: string | null;
  startDate: string | null;
  priority: string | null;
  completed: boolean;
  boardId: string;
  boardName: string;
  listName: string;
}

const PRIORITY_COLOR: Record<string, string> = {
  HIGH: '#ef4444',
  MEDIUM: '#f59e0b',
  LOW: '#10b981',
};

interface TooltipState {
  x: number; y: number;
  title: string;
  subtitle: string;
  color: string;
  date?: string;
  range?: string;
  listName?: string;
}

function ProjectGantt({
  projectId, milestones, color,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  color: string;
}) {
  const [cards, setCards]     = useState<TimelineCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  useEffect(() => {
    apiService.get<{ cards: TimelineCard[] }>(`/api/projects/${projectId}/timeline-cards`, true)
      .then((res) => { if (res.success && res.data) setCards(res.data.cards); })
      .finally(() => setLoading(false));
  }, [projectId]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
        <div style={{ width: '16px', height: '16px', border: `2px solid ${C.border2}`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const allDates: number[] = [
    ...milestones.filter((m) => m.date).map((m) => new Date(m.date).getTime()),
    ...cards.flatMap((c) => [c.dueDate, c.startDate].filter(Boolean).map((d) => new Date(d!).getTime())),
  ];

  if (allDates.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
        <Calendar style={{ width: '22px', height: '22px', color: C.text4 }} />
        <p style={{ margin: 0, fontSize: '12.5px', color: C.text3 }}>Sin fechas asignadas</p>
        <p style={{ margin: 0, fontSize: '11.5px', color: C.text4, textAlign: 'center', maxWidth: '280px' }}>
          Asigna fechas límite a los hitos o cards para ver el timeline
        </p>
      </div>
    );
  }

  // ── Date range — snap to month start/end with padding ─────────────────
  const minTs = Math.min(...allDates);
  const maxTs = Math.max(...allDates);
  const rangeStart = new Date(minTs);
  rangeStart.setDate(1); // first day of min month
  const rangeEnd = new Date(maxTs);
  rangeEnd.setMonth(rangeEnd.getMonth() + 1, 0); // last day of max month
  const MS_PER_DAY = 86400000;
  const totalDays = Math.max(1, Math.ceil((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY));

  // Pixel width per day — adaptive based on range length
  const DAY_W = totalDays <= 60 ? 32 : totalDays <= 120 ? 22 : totalDays <= 240 ? 16 : 12;
  const TRACK_W = totalDays * DAY_W; // full track width in px

  /** Convert a date to pixel X position on the track */
  function dayX(d: Date): number {
    return Math.round((d.getTime() - rangeStart.getTime()) / MS_PER_DAY * DAY_W);
  }

  const todayX = dayX(new Date());

  // ── Build month columns ──────────────────────────────────────────────
  type MonthCol = { label: string; x: number; width: number };
  const monthCols: MonthCol[] = [];
  const mc = new Date(rangeStart);
  while (mc <= rangeEnd) {
    const x = dayX(mc);
    const nextMonth = new Date(mc); nextMonth.setMonth(nextMonth.getMonth() + 1, 1);
    const endX = Math.min(dayX(nextMonth), TRACK_W);
    monthCols.push({
      label: mc.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' }).toUpperCase(),
      x, width: endX - x,
    });
    mc.setMonth(mc.getMonth() + 1, 1);
  }

  // ── Day labels — density depends on DAY_W ───────────────────────────
  const dayStep = DAY_W >= 28 ? 1 : DAY_W >= 18 ? 3 : DAY_W >= 12 ? 7 : 14;

  // ── Group cards by board ─────────────────────────────────────────────
  const boardMap = new Map<string, { name: string; cards: TimelineCard[] }>();
  for (const c of cards) {
    if (!boardMap.has(c.boardId)) boardMap.set(c.boardId, { name: c.boardName, cards: [] });
    boardMap.get(c.boardId)!.cards.push(c);
  }
  const boards = Array.from(boardMap.values());

  const ROW_H     = 42;
  const SECTION_H = 28;
  const SIDEBAR_W = 200;
  const MONTH_H   = 22;
  const DAY_H     = 18;
  const HEADER_H  = MONTH_H + DAY_H;

  function showTip(e: React.MouseEvent, tip: TooltipState) {
    setTooltip({ ...tip, x: e.clientX, y: e.clientY });
  }

  type Row =
    | { kind: 'section'; label: string; icon: 'flag' | 'board' }
    | { kind: 'milestone'; m: ProjectMilestone }
    | { kind: 'card'; card: TimelineCard; rowIdx: number };

  const rows: Row[] = [];
  if (milestones.length > 0) {
    rows.push({ kind: 'section', label: 'Hitos', icon: 'flag' });
    milestones.forEach((m) => rows.push({ kind: 'milestone', m }));
  }
  boards.forEach((board) => {
    rows.push({ kind: 'section', label: board.name, icon: 'board' });
    board.cards.forEach((card, i) => rows.push({ kind: 'card', card, rowIdx: i }));
  });

  const totalH = HEADER_H + rows.reduce((h, r) => h + (r.kind === 'section' ? SECTION_H : ROW_H), 0);

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setTooltip(null)}>
      {/* Tooltip */}
      {tooltip && (
        <div style={{
          position: 'fixed', zIndex: 9999,
          left: tooltip.x + 14, top: tooltip.y - 10,
          background: '#13161b', border: `1px solid ${C.border2}`,
          borderRadius: '8px', padding: '10px 13px',
          boxShadow: '0 8px 28px rgba(0,0,0,0.55)',
          pointerEvents: 'none', maxWidth: '260px',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: tooltip.date || tooltip.range ? '6px' : 0 }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: tooltip.color, flexShrink: 0 }} />
            <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text, lineHeight: 1.3 }}>{tooltip.title}</span>
          </div>
          {tooltip.subtitle && <p style={{ margin: '0 0 5px', fontSize: '11px', color: C.text3 }}>{tooltip.subtitle}</p>}
          {tooltip.range   && <p style={{ margin: '0 0 3px', fontSize: '11px', color: C.text2 }}>{tooltip.range}</p>}
          {tooltip.date    && <p style={{ margin: 0, fontSize: '11px', color: C.text2 }}>{tooltip.date}</p>}
          {tooltip.listName && <p style={{ margin: '4px 0 0', fontSize: '10px', color: C.text4 }}>{tooltip.listName}</p>}
        </div>
      )}

      <div style={{ overflowX: 'auto', borderRadius: '10px', border: `1px solid ${C.border}`, background: C.surface }}>
        {/* Fixed total width = sidebar + track */}
        <div style={{ width: `${SIDEBAR_W + TRACK_W}px`, minWidth: '700px', position: 'relative' }}>

          {/* ── Header ─────────────────────────────────────────────── */}
          <div style={{ position: 'sticky', top: 0, zIndex: 10, background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
            {/* Sidebar label */}
            <div style={{ position: 'absolute', left: 0, top: 0, width: `${SIDEBAR_W}px`, height: `${HEADER_H}px`, borderRight: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', paddingLeft: '12px', background: C.bg2, zIndex: 2 }}>
              <span style={{ fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.08em', color: C.text4, textTransform: 'uppercase' }}>Tarea / Hito</span>
            </div>

            {/* Month row */}
            <div style={{ position: 'relative', height: `${MONTH_H}px`, marginLeft: SIDEBAR_W, borderBottom: `1px solid ${C.border}` }}>
              {monthCols.map((mc2, i) => (
                <div key={i} style={{ position: 'absolute', left: mc2.x, top: 0, width: mc2.width, height: '100%', overflow: 'hidden', borderRight: `1px solid ${C.border}` }}>
                  <span style={{ position: 'sticky', left: 4, fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', color: C.text3, lineHeight: `${MONTH_H}px`, whiteSpace: 'nowrap' }}>
                    {mc2.label}
                  </span>
                </div>
              ))}
              {/* Today marker in month row */}
              {todayX >= 0 && todayX <= TRACK_W && (
                <div style={{ position: 'absolute', left: todayX, top: 2, transform: 'translateX(-50%)', fontSize: '7.5px', fontWeight: 800, color: color, padding: '1px 3px', background: color + '22', borderRadius: '3px', whiteSpace: 'nowrap', zIndex: 1 }}>HOY</div>
              )}
            </div>

            {/* Day row */}
            <div style={{ position: 'relative', height: `${DAY_H}px`, marginLeft: SIDEBAR_W }}>
              {/* Day columns */}
              {Array.from({ length: totalDays }).map((_, di) => {
                if (di % dayStep !== 0) return null;
                const d = new Date(rangeStart.getTime() + di * MS_PER_DAY);
                const x = di * DAY_W;
                return (
                  <div key={di} style={{ position: 'absolute', left: x, top: 0, width: dayStep * DAY_W, height: '100%', borderRight: `1px solid ${C.border}`, overflow: 'hidden' }}>
                    <span style={{ fontSize: '8.5px', color: C.text4, lineHeight: `${DAY_H}px`, paddingLeft: '3px', whiteSpace: 'nowrap' }}>{d.getDate()}</span>
                  </div>
                );
              })}
              {/* Today vertical line in day row */}
              {todayX >= 0 && todayX <= TRACK_W && (
                <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: '2px', background: color, opacity: 0.8 }} />
              )}
            </div>
          </div>

          {/* ── Rows ───────────────────────────────────────────────── */}
          {rows.map((row, rIdx) => {
            const isEven = rIdx % 2 === 0;

            // ── Section header ──
            if (row.kind === 'section') {
              return (
                <div key={rIdx} style={{ position: 'relative', height: `${SECTION_H}px`, background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ position: 'sticky', left: 0, width: `${SIDEBAR_W}px`, height: '100%', display: 'flex', alignItems: 'center', gap: '6px', paddingLeft: '12px', background: C.bg2, borderRight: `1px solid ${C.border}`, zIndex: 1 }}>
                    {row.icon === 'flag'
                      ? <Flag style={{ width: '10px', height: '10px', color: C.amber, flexShrink: 0 }} />
                      : <LayoutDashboard style={{ width: '10px', height: '10px', color, flexShrink: 0 }} />}
                    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', color: C.text3, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                  </div>
                  {/* Day grid lines on track */}
                  <div style={{ position: 'absolute', left: SIDEBAR_W, top: 0, width: TRACK_W, height: '100%' }}>
                    {Array.from({ length: totalDays }).map((_, di) => {
                      if (di % dayStep !== 0) return null;
                      return <div key={di} style={{ position: 'absolute', left: di * DAY_W, top: 0, bottom: 0, width: '1px', background: C.border, opacity: 0.2 }} />;
                    })}
                    {todayX >= 0 && todayX <= TRACK_W && <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: '2px', background: color, opacity: 0.2 }} />}
                  </div>
                </div>
              );
            }

            // ── Milestone row ──
            if (row.kind === 'milestone') {
              const { m } = row;
              const isPast   = new Date(m.date) < new Date() && m.status === 'PENDING';
              const dotColor = isPast ? C.red : m.status === 'REACHED' ? C.green : (m.color || C.amber);
              const mx       = dayX(new Date(m.date));

              return (
                <div key={m.id} style={{ position: 'relative', height: `${ROW_H}px`, background: isEven ? C.surface : C.bg, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ position: 'sticky', left: 0, width: `${SIDEBAR_W}px`, height: '100%', display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '16px', paddingRight: '8px', background: isEven ? C.surface : C.bg, borderRight: `1px solid ${C.border}`, zIndex: 1 }}>
                    <div style={{ width: '8px', height: '8px', transform: 'rotate(45deg)', background: dotColor, borderRadius: '2px', flexShrink: 0 }} />
                    <span style={{ fontSize: '11.5px', fontWeight: 500, color: m.status === 'MISSED' ? C.text4 : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>{m.name}</span>
                  </div>
                  <div style={{ position: 'absolute', left: SIDEBAR_W, top: 0, width: TRACK_W, height: '100%' }}>
                    {Array.from({ length: totalDays }).map((_, di) => di % dayStep === 0 ? (
                      <div key={di} style={{ position: 'absolute', left: di * DAY_W, top: 0, bottom: 0, width: '1px', background: C.border, opacity: 0.15 }} />
                    ) : null)}
                    {todayX >= 0 && todayX <= TRACK_W && <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: '2px', background: color, opacity: 0.15 }} />}
                    {/* Diamond marker */}
                    <div
                      style={{ position: 'absolute', left: mx, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}
                      onMouseEnter={(e) => showTip(e, { title: m.name, subtitle: m.description ?? '', color: dotColor, date: `📅 ${fmtDate(m.date)}`, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div style={{ width: '14px', height: '14px', transform: 'rotate(45deg)', background: dotColor, borderRadius: '3px', border: `2px solid ${C.surface}`, boxShadow: `0 0 0 2px ${dotColor}55` }} />
                      <span style={{ fontSize: '8.5px', fontWeight: 600, color: dotColor, whiteSpace: 'nowrap' }}>{fmtShort(m.date)}</span>
                    </div>
                  </div>
                </div>
              );
            }

            // ── Card row ──
            const { card } = row;
            const hasRange  = !!(card.startDate && card.dueDate);
            const barColor  = card.completed ? C.green : (PRIORITY_COLOR[card.priority ?? ''] ?? color);
            const isOverdue = !card.completed && card.dueDate && new Date(card.dueDate) < new Date();
            const startX    = card.startDate ? dayX(new Date(card.startDate)) : null;
            const endX2     = card.dueDate   ? dayX(new Date(card.dueDate))   : null;
            const markerX   = endX2 ?? startX;
            const barPx     = hasRange && startX !== null && endX2 !== null ? Math.max(DAY_W, endX2 - startX) : 0;

            return (
              <div key={card.id} style={{ position: 'relative', height: `${ROW_H}px`, background: isEven ? C.surface : C.bg, borderBottom: `1px solid ${C.border}` }}>
                <div style={{ position: 'sticky', left: 0, width: `${SIDEBAR_W}px`, height: '100%', display: 'flex', alignItems: 'center', gap: '7px', paddingLeft: '20px', paddingRight: '8px', background: isEven ? C.surface : C.bg, borderRight: `1px solid ${C.border}`, zIndex: 1 }}>
                  <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: card.completed ? 'transparent' : barColor, border: `2px solid ${barColor}`, flexShrink: 0 }} />
                  <span style={{ fontSize: '11px', color: card.completed ? C.text3 : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: card.completed ? 'line-through' : 'none' }}>{card.title}</span>
                </div>
                <div style={{ position: 'absolute', left: SIDEBAR_W, top: 0, width: TRACK_W, height: '100%' }}>
                  {Array.from({ length: totalDays }).map((_, di) => di % dayStep === 0 ? (
                    <div key={di} style={{ position: 'absolute', left: di * DAY_W, top: 0, bottom: 0, width: '1px', background: C.border, opacity: 0.12 }} />
                  ) : null)}
                  {todayX >= 0 && todayX <= TRACK_W && <div style={{ position: 'absolute', left: todayX, top: 0, bottom: 0, width: '2px', background: color, opacity: 0.12 }} />}

                  {hasRange && startX !== null && (
                    <div
                      style={{ position: 'absolute', left: startX, top: '50%', transform: 'translateY(-50%)', width: barPx, height: '16px', borderRadius: '8px', background: card.completed ? `${barColor}55` : `linear-gradient(to right, ${barColor}dd, ${barColor}88)`, border: `1.5px solid ${barColor}${card.completed ? '44' : 'bb'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', paddingLeft: '7px', overflow: 'hidden', boxShadow: isOverdue ? `0 0 0 1px ${C.red}77` : 'none' }}
                      onMouseEnter={(e) => showTip(e, { title: card.title, subtitle: card.boardName, color: barColor, range: `${fmtShort(card.startDate!)} → ${fmtShort(card.dueDate!)}`, listName: card.listName, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <span style={{ fontSize: '9.5px', fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{card.title}</span>
                    </div>
                  )}

                  {!hasRange && markerX !== null && (
                    <div
                      style={{ position: 'absolute', left: markerX, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                      onMouseEnter={(e) => showTip(e, { title: card.title, subtitle: card.boardName, color: barColor, date: `📅 ${fmtShort(card.dueDate ?? card.startDate!)}`, listName: card.listName, x: e.clientX, y: e.clientY })}
                      onMouseMove={(e) => setTooltip((t) => t ? { ...t, x: e.clientX, y: e.clientY } : null)}
                      onMouseLeave={() => setTooltip(null)}
                    >
                      <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: card.completed ? 'transparent' : barColor, border: `2.5px solid ${barColor}`, boxShadow: isOverdue ? `0 0 0 2px ${C.red}55` : `0 0 0 3px ${barColor}22` }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* ── Legend ─────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', padding: '9px 14px', borderTop: `1px solid ${C.border}`, background: C.bg2, flexWrap: 'wrap' }}>
            <span style={{ fontSize: '9px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' }}>Leyenda</span>
            {([['#ef4444', 'Alta'], ['#f59e0b', 'Media'], ['#10b981', 'Baja']] as [string,string][]).map(([c, l]) => (
              <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '9px', height: '9px', borderRadius: '50%', background: c }} />
                <span style={{ fontSize: '9.5px', color: C.text4 }}>{l}</span>
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '22px', height: '9px', borderRadius: '5px', background: `${C.green}66`, border: `1.5px solid ${C.green}` }} />
              <span style={{ fontSize: '9.5px', color: C.text4 }}>Completada</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '10px', height: '10px', transform: 'rotate(45deg)', background: C.amber, borderRadius: '2px' }} />
              <span style={{ fontSize: '9.5px', color: C.text4 }}>Hito</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '2px', height: '14px', background: color }} />
              <span style={{ fontSize: '9.5px', color: C.text4 }}>Hoy</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Team types ────────────────────────────────────────────────────────────────

interface AssignedTeam {
  id: string;
  name: string;
  color: string | null;
  memberCount: number;
  leadName: string | null;
}

// ── Team Selector Popover ─────────────────────────────────────────────────────

function TeamSelector({ projectId, assigned, allTeams, onAssign, onRemove }: {
  projectId: string;
  assigned: AssignedTeam[];
  allTeams: AssignedTeam[];
  onAssign: (teamId: string) => Promise<void>;
  onRemove: (teamId: string) => Promise<void>;
}) {
  const t = useT();
  const [open, setOpen]       = useState(false);
  const [loading, setLoading] = useState<string | null>(null);

  const assignedIds = new Set(assigned.map((team) => team.id));
  const available   = allTeams.filter((team) => !assignedIds.has(team.id));

  async function handleAssign(teamId: string) {
    setLoading(teamId);
    try { await onAssign(teamId); } finally { setLoading(null); setOpen(false); }
  }
  async function handleRemove(teamId: string) {
    setLoading(teamId);
    try { await onRemove(teamId); } finally { setLoading(null); }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
      {/* Chips de equipos asignados */}
      {assigned.map((team) => (
        <div key={team.id} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '4px 10px 4px 8px', borderRadius: '6px', fontSize: '12.5px', background: `${team.color ?? C.accent}15`, border: `1px solid ${team.color ?? C.accent}40`, color: team.color ?? C.accent }}>
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: team.color ?? C.accent, flexShrink: 0 }} />
          <span style={{ fontWeight: 600 }}>{team.name}</span>
          {team.memberCount > 0 && (
            <span style={{ fontSize: '11px', opacity: 0.65 }}>{team.memberCount}m</span>
          )}
          <button
            onClick={() => handleRemove(team.id)}
            disabled={loading === team.id}
            style={{ display: 'flex', alignItems: 'center', background: 'none', border: 'none', cursor: 'pointer', padding: '1px', color: 'inherit', opacity: 0.6, marginLeft: '2px' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
          >
            <X style={ic(10)} />
          </button>
        </div>
      ))}

      {/* Botón asignar equipo */}
      <div style={{ position: 'relative' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, background: C.surface, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s, background 0.15s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = `${C.accent}10`; }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.surface; }}
        >
          <Plus style={ic(11)} />
          {assigned.length === 0 ? t.projects_teams_assign : t.projects_teams_add}
        </button>

        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '8px', minWidth: '220px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
              {available.length === 0 ? (
                <div style={{ padding: '14px 16px', fontSize: '12.5px', color: C.text4 }}>
                  {allTeams.length === 0 ? t.projects_teams_no_teams : t.projects_teams_all_assigned}
                </div>
              ) : (
                available.map((team) => (
                  <button
                    key={team.id}
                    onClick={() => handleAssign(team.id)}
                    disabled={loading === team.id}
                    style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 14px', background: 'none', border: 'none', cursor: 'pointer', color: C.text2, fontSize: '13px', textAlign: 'left', transition: 'background 0.1s' }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = C.hover)}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'none')}
                  >
                    <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: team.color ?? C.accent, flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 500 }}>{team.name}</div>
                      {team.memberCount > 0 && (
                        <div style={{ fontSize: '11px', color: C.text4 }}>{t.teams_members_count(team.memberCount)}</div>
                      )}
                    </div>
                    {loading === team.id && (
                      <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="12" height="12"><circle cx="8" cy="8" r="6" stroke={C.accent} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg>
                    )}
                  </button>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Config Modal ──────────────────────────────────────────────────────────────
function ConfigModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT();
  const { updateProject, deleteProject } = useProjectStore();
  const router = useRouter();
  const [name,    setName]    = useState(project.name);
  const [desc,    setDesc]    = useState(project.description ?? '');
  const [status,  setStatus]  = useState(project.status);
  const [start,   setStart]   = useState(project.startDate?.slice(0, 10) ?? '');
  const [end,     setEnd]     = useState(project.endDate?.slice(0, 10) ?? '');
  const [saving,  setSaving]  = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await updateProject(project.id, {
        name: name.trim(),
        description: desc.trim() || null,
        status: status as any,
        startDate: start || null,
        endDate: end || null,
      });
      onClose();
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div style={{ width: '420px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.6)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{t.projects_config_title}</span>
          <button onClick={onClose} style={{ color: C.text3, background: 'none', border: 'none', cursor: 'pointer' }}><X style={ic(15)} /></button>
        </div>

        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {[
            { label: t.projects_config_name, node: <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} /> },
            { label: t.projects_config_desc, node: <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} /> },
            { label: t.projects_config_status, node: (
              <select value={status} onChange={(e) => setStatus(e.target.value as any)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', colorScheme: 'dark' }}>
                {['PLANNING','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'].map((s) => <option key={s} value={s}>{getStatusCfg(s, t).label}</option>)}
              </select>
            )},
            { label: t.projects_config_start, node: <input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', colorScheme: 'dark' }} /> },
            { label: t.projects_config_end,   node: <input type="date" value={end}   onChange={(e) => setEnd(e.target.value)}   style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', colorScheme: 'dark' }} /> },
          ].map(({ label, node }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' }}>{label}</label>
              {node}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={async () => {
            if (!confirm(`¿Eliminar "${project.name}"? Esta acción no se puede deshacer.`)) return;
            await deleteProject(project.id);
            router.push(`/dashboard/workspaces/${project.workspaceId}`);
          }}
            style={{ fontSize: '11.5px', color: C.red, background: 'transparent', border: 'none', cursor: 'pointer', padding: 0, transition: 'opacity 0.1s' }}
            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.7')}
            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
          >
            {t.projects_config_delete}
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={onClose} style={{ padding: '7px 13px', borderRadius: '7px', fontSize: '12px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>{t.btn_cancel}</button>
            <button onClick={save} disabled={saving} style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? t.projects_config_saving : t.projects_config_save}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Add Board Modal ───────────────────────────────────────────────────────────
function AddBoardModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT();
  const { addBoard } = useProjectStore();
  const { createBoard } = useBoardStore();
  const router = useRouter();
  const [tab, setTab] = useState<'create' | 'assign'>('create');

  // Crear nuevo
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Asignar existente
  const [boards, setBoards] = useState<ProjectBoard[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);

  const color = project.color || C.accent;

  // Cargar boards existentes al cambiar a pestaña asignar
  useEffect(() => {
    if (tab !== 'assign') return;
    setLoadingBoards(true);
    apiService.get<{ boards: ProjectBoard[] }>(`/api/workspaces/${project.workspaceId}/boards`, true)
      .then((r) => { if (r.success && r.data) setBoards(r.data.boards ?? []); })
      .finally(() => setLoadingBoards(false));
  }, [tab, project.workspaceId]);

  const assigned = new Set(project.boards?.map((b) => b.id) ?? []);
  const available = boards.filter((b) => !b.archived && !assigned.has(b.id));

  const handleCreate = async () => {
    if (!newName.trim()) { setCreateError(t.create_ws_validation_name); return; }
    setCreating(true);
    setCreateError('');
    try {
      const board = await createBoard(project.workspaceId, { name: newName.trim(), description: newDesc.trim() || undefined });
      await addBoard(project.id, board.id);
      onClose();
    } catch (e: any) {
      setCreateError(e.message || t.create_board_error);
    } finally {
      setCreating(false);
    }
  };

  const tabStyle = (active: boolean) => ({
    flex: 1, padding: '7px 0', fontSize: '12.5px', fontWeight: 500 as const,
    background: 'none', border: 'none', cursor: 'pointer' as const,
    borderBottom: active ? `2px solid ${color}` : '2px solid transparent',
    color: active ? C.text : C.text3,
    transition: 'color 0.1s',
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div style={{ width: '400px', maxHeight: '70vh', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px 0', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{t.projects_add_board_title}</span>
          <button onClick={onClose} style={{ color: C.text3, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '0' }}><X style={ic(15)} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, padding: '0 18px', gap: '8px' }}>
          <button style={tabStyle(tab === 'create')} onClick={() => setTab('create')}>{t.projects_add_board_tab_create}</button>
          <button style={tabStyle(tab === 'assign')} onClick={() => setTab('assign')}>{t.projects_add_board_tab_assign}</button>
        </div>

        {/* Create tab */}
        {tab === 'create' && (
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
            {[
              { label: t.projects_milestone_name_label, node: (
                <input autoFocus value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                  placeholder="Nombre del board"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
              )},
              { label: t.projects_config_desc, node: (
                <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={2} placeholder="Opcional"
                  style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} />
              )},
            ].map(({ label, node }) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' }}>{label}</label>
                {node}
              </div>
            ))}
            {createError && <p style={{ fontSize: '11.5px', color: C.red, margin: 0 }}>{createError}</p>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
              <button onClick={onClose} style={{ padding: '7px 13px', borderRadius: '7px', fontSize: '12px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>{t.btn_cancel}</button>
              <button onClick={handleCreate} disabled={creating}
                style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: color, color: '#fff', border: 'none', cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
                {creating ? t.btn_creating : t.projects_add_board_title}
              </button>
            </div>
          </div>
        )}

        {/* Assign tab */}
        {tab === 'assign' && (
          <div style={{ overflowY: 'auto', padding: '8px' }}>
            {loadingBoards ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="20" height="20"><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg>
              </div>
            ) : available.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '28px 0' }}>
                <p style={{ textAlign: 'center', fontSize: '12.5px', color: C.text3, margin: 0 }}>
                  {boards.length === 0 ? t.projects_boards_no_boards_in_ws : t.projects_boards_all_assigned}
                </p>
                <button onClick={() => setTab('create')} style={{ fontSize: '12px', color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  {t.projects_boards_create_one}
                </button>
              </div>
            ) : available.map((b) => (
              <button key={b.id}
                onClick={async () => { setAdding(b.id); try { await addBoard(project.id, b.id); onClose(); } catch {} finally { setAdding(null); } }}
                disabled={adding === b.id}
                style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '7px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: `${color}18`, border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <LayoutDashboard style={{ ...ic(13), color }} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: '12.5px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</p>
                  {b.description && <p style={{ margin: 0, fontSize: '11px', color: C.text4 }}>{b.description}</p>}
                </div>
                {adding === b.id
                  ? <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13"><circle cx="8" cy="8" r="6" stroke={color} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg>
                  : <Check style={{ ...ic(13), color: C.green, opacity: 0 }} />
                }
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Create Milestone Modal ────────────────────────────────────────────────────
function CreateMilestoneModal({ projectId, color, onClose }: { projectId: string; color: string; onClose: () => void }) {
  const t = useT();
  const { createMilestone } = useProjectStore();
  const [name, setName] = useState('');
  const [date, setDate] = useState('');
  const [desc, setDesc] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    if (!name.trim()) { setError(t.create_ws_validation_name); return; }
    if (!date)        { setError(t.create_ws_validation_name); return; }
    setLoading(true);
    try {
      await createMilestone(projectId, { name: name.trim(), description: desc.trim() || undefined, date: new Date(date).toISOString() });
      onClose();
    } catch (e: any) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div style={{ width: '380px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{t.projects_milestone_new}</span>
          <button onClick={onClose} style={{ color: C.text3, background: 'none', border: 'none', cursor: 'pointer' }}><X style={ic(15)} /></button>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {[
            { label: 'Nombre *',     node: <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del hito" style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} /> },
            { label: 'Fecha *',      node: <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', colorScheme: 'dark' }} /> },
            { label: 'Descripción',  node: <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} placeholder="Opcional" style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const }} /> },
          ].map(({ label, node }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' }}>{label}</label>
              {node}
            </div>
          ))}
          {error && <p style={{ fontSize: '11.5px', color: C.red }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={onClose} style={{ padding: '7px 13px', borderRadius: '7px', fontSize: '12px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>{t.btn_cancel}</button>
          <button onClick={submit} disabled={loading} style={{ padding: '7px 14px', borderRadius: '7px', fontSize: '12px', fontWeight: 600, background: color, color: '#fff', border: 'none', cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? t.btn_creating : t.projects_milestone_create}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function ProjectDetailPage() {
  const t         = useT();
  const params    = useParams();
  const router    = useRouter();
  const projectId = params.id as string;

  const { currentProject, currentStats, fetchProjectById, fetchStats, updateMilestone, deleteMilestone, removeBoard } = useProjectStore();
  const { workspaces } = useWorkspaceStore();
  const { teams: allTeams, fetchTeams } = useTeamStore();

  const [showConfig,    setShowConfig]    = useState(false);
  const [showAddBoard,  setShowAddBoard]  = useState(false);
  const [showAddMs,     setShowAddMs]     = useState(false);
  const [assignedTeams, setAssignedTeams] = useState<AssignedTeam[]>([]);
  const [boardToRemove, setBoardToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removingBoard, setRemovingBoard] = useState(false);

  useEffect(() => {
    fetchProjectById(projectId);
    fetchStats(projectId);
    fetchTeams();
  }, [projectId, fetchProjectById, fetchStats, fetchTeams]);

  useEffect(() => {
    apiService.get<{ teams: AssignedTeam[] }>(`/api/projects/${projectId}/teams`, true)
      .then((res) => { if (res.success && res.data) setAssignedTeams(res.data.teams); });
  }, [projectId]);

  async function handleAssignTeam(teamId: string) {
    await apiService.post(`/api/projects/${projectId}/teams`, { teamId }, true);
    const team = allTeams.find((t) => t.id === teamId);
    if (team) setAssignedTeams((prev) => [...prev, { id: team.id, name: team.name, color: team.color ?? null, memberCount: team.memberCount ?? 0, leadName: team.leadName ?? null }]);
  }

  async function handleRemoveTeam(teamId: string) {
    await apiService.delete(`/api/projects/${projectId}/teams/${teamId}`, true);
    setAssignedTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  async function handleConfirmRemoveBoard() {
    if (!boardToRemove) return;
    setRemovingBoard(true);
    try { await removeBoard(currentProject!.id, boardToRemove.id); setBoardToRemove(null); }
    catch { /* silencio */ }
    finally { setRemovingBoard(false); }
  }

  if (!currentProject) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: C.bg }}>
        <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="22" height="22">
          <circle cx="8" cy="8" r="6" stroke={C.accent} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
      </div>
    );
  }

  const project    = currentProject;
  const stats      = currentStats;
  const color      = project.color || C.accent;
  const initial    = (project.name.trim()[0] ?? '?').toUpperCase();
  const stCfg      = getStatusCfg(project.status, t);
  const hlthCfg    = stats ? getHealthCfg(stats.healthScore, t) : null;
  const progress   = stats?.progressPercent ?? project.progressPercent ?? 0;
  const dl         = daysLeft(project.endDate, t);
  const workspace  = workspaces.find((w) => w.id === project.workspaceId);
  const milestones = (project.milestones ?? []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const boards     = project.boards ?? [];
  const hasTimeline = !!(project.startDate && project.endDate);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden' }}>

      {/* ── HEADER ─────────────────────────────────────────────────────────── */}
      <header style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

        {/* Back button */}
        <div style={{ padding: '7px 20px', borderBottom: `1px solid ${C.border}` }}>
          <button
            onClick={() => router.push(workspace ? `/dashboard/workspaces/${project.workspaceId}` : '/dashboard/workspaces')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
              <path d="M10 3L5 8l5 5" />
            </svg>
            {t.projects_back}
          </button>
        </div>

        {/* Identity row */}
        <div style={{ padding: '13px 20px 10px', display: 'flex', alignItems: 'flex-start', gap: '13px', background: `linear-gradient(to bottom, ${color}08, transparent)` }}>
          {/* Avatar */}
          <div style={{ width: '44px', height: '44px', borderRadius: '10px', flexShrink: 0, background: color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', fontWeight: 800, color: '#fff', boxShadow: `0 0 0 1px ${color}55` }}>
            {initial}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '16px', fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>{project.name}</span>
              <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', padding: '2px 7px', borderRadius: '4px', background: stCfg.bg, color: stCfg.color, border: `1px solid ${stCfg.border}` }}>
                {stCfg.label.toUpperCase()}
              </span>
              {hlthCfg && (
                <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em', padding: '2px 7px', borderRadius: '4px', background: hlthCfg.bg, color: hlthCfg.color, border: `1px solid ${hlthCfg.border}` }}>
                  {hlthCfg.label.toUpperCase()}
                </span>
              )}
            </div>
            {project.description && (
              <p style={{ margin: '0 0 8px', fontSize: '12px', color: C.text3, lineHeight: 1.4, maxWidth: '520px' }}>{project.description}</p>
            )}
            {/* Equipos row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: project.description ? '0' : '6px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.text4, flexShrink: 0 }}>Equipos</span>
              <TeamSelector
                projectId={projectId}
                assigned={assignedTeams}
                allTeams={(allTeams as any[]).map((t) => ({ id: t.id, name: t.name, color: t.color ?? null, memberCount: t.memberCount ?? 0, leadName: t.leadName ?? null }))}
                onAssign={handleAssignTeam}
                onRemove={handleRemoveTeam}
              />
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '7px', flexShrink: 0, alignItems: 'center' }}>
            <button onClick={() => setShowAddBoard(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: C.surface, color: C.text2, border: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'border-color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.text4; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
            >
              <Plus style={ic(11)} /> Board
            </button>
            <button onClick={() => setShowAddMs(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 11px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: color, color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Flag style={ic(11)} /> Hito
            </button>
            <button onClick={() => setShowConfig(true)}
              style={{ width: '30px', height: '30px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border2}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, transition: 'color 0.1s, border-color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; e.currentTarget.style.borderColor = C.text4; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border2; }}
            >
              <MoreHorizontal style={ic(14)} />
            </button>
          </div>
        </div>

        {/* Progress band */}
        <div style={{ padding: '8px 20px 10px', display: 'flex', alignItems: 'center', gap: '14px', borderTop: `1px solid ${C.border}` }}>
          {/* % big */}
          <span style={{ fontSize: '22px', fontWeight: 800, color, lineHeight: 1, flexShrink: 0 }}>{progress}%</span>
          {/* Bar */}
          <div style={{ flex: 1, height: '8px', borderRadius: '4px', background: C.border2, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${progress}%`, borderRadius: '4px', background: progress === 100 ? C.green : `linear-gradient(to right, ${color}, ${color}99)`, transition: 'width 0.5s' }} />
          </div>
          {/* Deadline */}
          {dl ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <Clock style={{ ...ic(11), color: dl.color }} />
              <span style={{ fontSize: '12px', fontWeight: 600, color: dl.color }}>{dl.label}</span>
            </div>
          ) : (
            <button onClick={() => setShowConfig(true)}
              style={{ fontSize: '11.5px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0, transition: 'color 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = color)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
            >
              + Definir fecha límite
            </button>
          )}
        </div>

        {/* Timeline or no-dates banner */}
        {hasTimeline ? (
          <TimelineBar
            startDate={project.startDate!}
            endDate={project.endDate!}
            milestones={milestones}
            color={color}
            t={t}
          />
        ) : (
          <div style={{ padding: '8px 20px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px', background: C.bg2 }}>
            <Calendar style={{ ...ic(11), color: C.text4 }} />
            <span style={{ fontSize: '11.5px', color: C.text4 }}>{t.projects_timeline_no_dates}</span>
            <button onClick={() => setShowConfig(true)}
              style={{ fontSize: '11.5px', color, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
            >
              {t.projects_milestone_add_dates}
            </button>
          </div>
        )}

        {/* Accent gradient line */}
        <div style={{ height: '2px', background: `linear-gradient(90deg, ${color}cc, ${color}44, transparent)` }} />
      </header>

      {/* ── BODY — scrolleable ───────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 26px', display: 'flex', flexDirection: 'column', gap: '32px' }}>

        {/* ── SECCIÓN HITOS ────────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flag style={{ ...ic(12), color: C.amber }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>
                Hitos{milestones.length > 0 ? ` · ${milestones.length}` : ''}
              </span>
            </div>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <button onClick={() => setShowAddMs(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: C.surface, color: C.text3, border: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'color 0.1s, border-color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text4; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border2; }}
            >
              <Plus style={ic(10)} /> Hito
            </button>
          </div>

          {milestones.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
              <Flag style={{ ...ic(24), color: C.text4 }} />
              <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>{t.projects_milestone_empty}</p>
              <button onClick={() => setShowAddMs(true)}
                style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: color, color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <Plus style={ic(11)} /> {t.projects_milestone_create}
              </button>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {milestones.map((m) => {
                const mc     = getMilestoneCfg(m.status, t);
                const isPast = new Date(m.date) < new Date() && m.status === 'PENDING';
                const msDay  = Math.ceil((new Date(m.date).getTime() - Date.now()) / 86400000);

                return (
                  <div key={m.id}
                    style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', borderRadius: '8px', background: C.surface, border: `1px solid ${C.border}`, transition: 'border-color 0.1s' }}
                    className="group"
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border2; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                  >
                    {/* Status icon */}
                    <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: mc.bg, border: `1.5px solid ${mc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {m.status === 'REACHED' && <Check style={{ ...ic(11), color: mc.color }} />}
                      {m.status === 'MISSED'  && <X    style={{ ...ic(11), color: mc.color }} />}
                      {m.status === 'PENDING' && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: isPast ? C.red : mc.color }} />}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: m.status === 'MISSED' ? C.text3 : C.text, textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>
                        {m.name}
                      </p>
                      {m.description && <p style={{ margin: 0, fontSize: '11.5px', color: C.text4, marginTop: '1px' }}>{m.description}</p>}
                    </div>

                    {/* Date + days */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontSize: '11.5px', color: isPast ? C.red : C.text3 }}>{fmtDate(m.date)}</span>
                      {m.status === 'PENDING' && msDay > 0 && msDay <= 30 && (
                        <span style={{ fontSize: '10.5px', color: msDay <= 7 ? C.amber : C.text4 }}>{t.projects_time_ago_days_left(msDay)}</span>
                      )}
                      {isPast && <span style={{ fontSize: '10.5px', color: C.red }}>Vencido</span>}
                    </div>

                    {/* Status badge */}
                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: mc.bg, color: mc.color, flexShrink: 0 }}>
                      {mc.label}
                    </span>

                    {/* Hover actions */}
                    <div style={{ display: 'flex', gap: '3px', flexShrink: 0, opacity: 0, transition: 'opacity 0.1s' }}
                      className="group-hover:opacity-100"
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0'; }}
                    >
                      {m.status !== 'REACHED' && (
                        <button onClick={() => updateMilestone(project.id, m.id, { status: 'REACHED' })} title="Marcar alcanzado"
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = `${C.green}18`)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        ><Check style={ic(11)} /></button>
                      )}
                      {m.status === 'PENDING' && (
                        <button onClick={() => updateMilestone(project.id, m.id, { status: 'MISSED' })} title="Marcar perdido"
                          style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = `${C.red}18`)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        ><X style={ic(11)} /></button>
                      )}
                      <button onClick={() => deleteMilestone(project.id, m.id)} title="Eliminar"
                        style={{ width: '24px', height: '24px', borderRadius: '4px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text4 }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      ><Trash2 style={ic(11)} /></button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── SECCIÓN BOARDS ───────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <LayoutDashboard style={{ ...ic(12), color }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>
                Boards{boards.length > 0 ? ` · ${boards.length}` : ''}
              </span>
            </div>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <button onClick={() => setShowAddBoard(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 500, background: C.surface, color: C.text3, border: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'color 0.1s, border-color 0.1s' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.text4; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border2; }}
            >
              <Plus style={ic(10)} /> Board
            </button>
          </div>

          {boards.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
              <LayoutDashboard style={{ ...ic(24), color: C.text4 }} />
              <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>{t.projects_boards_empty}</p>
              <button onClick={() => setShowAddBoard(true)}
                style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: color, color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <Plus style={ic(11)} /> {t.projects_boards_add}
              </button>
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {boards.map((board) => (
                <BoardCard key={board.id} board={board} color={color} workspaceId={project.workspaceId}
                  onNavigate={() => router.push(`/dashboard/workspaces/${project.workspaceId}/boards/${board.id}`)}
                  onRemove={() => setBoardToRemove({ id: board.id, name: board.name })}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── SECCIÓN RESUMEN ──────────────────────────────────────────────── */}
        {stats && stats.totalCards > 0 && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>Resumen</span>
              <div style={{ flex: 1, height: '1px', background: C.border }} />
            </div>

            {/* Stat chips */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: stats.bottleneckBoardId ? '12px' : 0 }}>
              {[
                { label: 'tareas totales',    value: stats.totalCards,     color: C.text2  },
                { label: 'completadas',       value: stats.completedCards, color: C.green  },
                { label: 'vencidas',          value: stats.overdueCards,   color: stats.overdueCards > 0 ? C.red : C.text4 },
                ...(stats.totalDocuments > 0 ? [{ label: 'documentos', value: stats.totalDocuments, color: C.text3 }] : []),
              ].map(({ label, value, color: col }) => (
                <div key={label} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 14px', borderRadius: '8px', background: C.surface, border: `1px solid ${C.border}` }}>
                  <span style={{ fontSize: '18px', fontWeight: 700, color: col, lineHeight: 1 }}>{value}</span>
                  <span style={{ fontSize: '11.5px', color: C.text4 }}>{label}</span>
                </div>
              ))}
            </div>

            {/* Bottleneck alert */}
            {stats.bottleneckBoardId && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '10px 14px', borderRadius: '8px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <AlertCircle style={{ ...ic(13), color: C.red, flexShrink: 0, marginTop: '1px' }} />
                <span style={{ fontSize: '12.5px', color: C.text3 }}>
                  Board más atrasado: <span style={{ color: C.red, fontWeight: 600 }}>{stats.bottleneckBoardName}</span>
                </span>
              </div>
            )}
          </section>
        )}

        {/* ── SECCIÓN TIMELINE ─────────────────────────────────────────────── */}
        <section>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <GitBranch style={{ width: '12px', height: '12px', color }} />
              <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', color: C.text3, textTransform: 'uppercase' }}>
                Timeline
              </span>
            </div>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
          </div>
          <ProjectGantt projectId={projectId} milestones={milestones} color={color} />
        </section>

        {/* Empty state if truly no content */}
        {boards.length === 0 && milestones.length === 0 && !stats && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '40px 0' }}>
            <Target style={{ ...ic(32), color: C.text4 }} />
            <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>Proyecto sin contenido aún</p>
            <p style={{ margin: 0, fontSize: '12px', color: C.text4, textAlign: 'center', maxWidth: '300px' }}>Añade hitos para marcar objetivos y boards para gestionar las tareas</p>
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {showConfig   && <ConfigModal            project={project}   onClose={() => setShowConfig(false)} />}
      {showAddBoard && <AddBoardModal          project={project}   onClose={() => setShowAddBoard(false)} />}
      {showAddMs    && <CreateMilestoneModal   projectId={project.id} color={color} onClose={() => setShowAddMs(false)} />}

      {/* ── Modal confirmar quitar board ─────────────────────────────────────── */}
      {boardToRemove && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={() => { if (!removingBoard) setBoardToRemove(null); }}
        >
          <div
            style={{ width: '380px', maxWidth: 'calc(100vw - 32px)', background: '#13161b', border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Trash2 style={{ width: '15px', height: '15px', color: C.red }} />
              </div>
              <div>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: C.text }}>¿Quitar board del proyecto?</p>
                <p style={{ margin: 0, fontSize: '12px', color: C.text4, marginTop: '2px' }}>Esta acción no elimina el board, solo lo desvincula.</p>
              </div>
            </div>
            {/* Body */}
            <div style={{ padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 13px', borderRadius: '8px', background: C.surface, border: `1px solid ${C.border}` }}>
                <LayoutDashboard style={{ width: '14px', height: '14px', color: color, flexShrink: 0 }} />
                <span style={{ fontSize: '13px', fontWeight: 500, color: C.text }}>{boardToRemove.name}</span>
              </div>
            </div>
            {/* Footer */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 20px 18px', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={() => setBoardToRemove(null)}
                disabled={removingBoard}
                style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', background: 'none', border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmRemoveBoard}
                disabled={removingBoard}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500, background: removingBoard ? 'rgba(239,68,68,0.4)' : C.red, color: '#fff', border: 'none', cursor: removingBoard ? 'not-allowed' : 'pointer', transition: 'background 0.15s' }}
                onMouseEnter={(e) => { if (!removingBoard) e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={(e) => { if (!removingBoard) e.currentTarget.style.background = C.red; }}
              >
                {removingBoard ? (
                  <><div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> {t.btn_deleting}</>
                ) : t.projects_boards_confirm_remove}
              </button>
            </div>
          </div>
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      )}
    </div>
  );
}

// ── Board Card ────────────────────────────────────────────────────────────────
function BoardCard({ board, color, workspaceId, onNavigate, onRemove }: {
  board: ProjectBoard;
  color: string;
  workspaceId: string;
  onNavigate: () => void;
  onRemove: () => void;
}) {
  const t = useT();
  const [hov, setHov] = useState(false);
  const initial = (board.name.trim()[0] ?? '?').toUpperCase();

  return (
    <div
      style={{ background: C.surface, borderRadius: '9px', border: `1px solid ${hov ? color + '44' : C.border}`, overflow: 'hidden', transition: 'border-color 0.15s, box-shadow 0.15s', boxShadow: hov ? `0 4px 14px ${color}12` : 'none', position: 'relative' }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* Top stripe */}
      <div style={{ height: '3px', background: `linear-gradient(to right, ${color}, ${color}55)` }} />

      <div style={{ padding: '11px 13px 12px', cursor: 'pointer' }} onClick={onNavigate}>
        {/* Icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '9px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '7px', background: color + '18', border: `1.5px solid ${color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color, flexShrink: 0 }}>
            {initial}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</p>
            <p style={{ margin: 0, fontSize: '11px', color: C.text4, marginTop: '1px' }}>{timeAgo(board.updatedAt, t)}</p>
          </div>
        </div>
        {/* Description */}
        {board.description && (
          <p style={{ margin: 0, fontSize: '11.5px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.description}</p>
        )}
      </div>

      {/* Remove button — visible on hover */}
      {hov && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ position: 'absolute', top: '8px', right: '8px', width: '22px', height: '22px', borderRadius: '4px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red }}
          title="Quitar del proyecto"
        >
          <X style={ic(11)} />
        </button>
      )}
    </div>
  );
}
