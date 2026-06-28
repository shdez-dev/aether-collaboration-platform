'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjectStore, type Project, type ProjectMilestone, type ProjectBoard } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import { useTeamStore, type TeamMember } from '@/stores/teamStore';
import { useDocumentStore } from '@/stores/documentStore';
import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useT } from '@/lib/i18n';
import {
  Plus, X, Check, Trash2, AlertCircle, Flag,
  LayoutDashboard, Settings, MoreHorizontal,
  Calendar, Target, Users, GitBranch, Pencil, UserPlus,
} from 'lucide-react';
import { C } from '@/lib/colors';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { InlineBoardView } from '@/components/InlineBoardView';
import { CardDetailModal } from '@/components/CardDetailModal';
import { useCardStore } from '@/stores/cardStore';
import { useTimelineStore } from '@/stores/timelineStore';
import type { Card } from '@aether/types';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusCfg(status: string, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'ACTIVE':    return { label: t.projects_status_active,    color: '#F4905A', bg: 'rgba(242,87,30,0.12)',   border: 'rgba(242,87,30,0.25)'   };
    case 'PLANNING':  return { label: t.projects_status_planning,  color: '#9C9486', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' };
    case 'ON_HOLD':   return { label: t.projects_status_on_hold,   color: '#DB8A66', bg: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.25)' };
    case 'COMPLETED': return { label: t.projects_status_completed, color: '#76A878', bg: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.25)' };
    case 'ARCHIVED':  return { label: t.projects_status_cancelled, color: '#827A6D', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' };
    default:          return { label: status,                       color: '#827A6D', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' };
  }
}

function getHealthCfg(score: number, t: ReturnType<typeof useT>) {
  if (score >= 70) return { label: t.projects_health_good,     color: '#76A878', bg: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.25)' };
  if (score >= 40) return { label: t.projects_health_at_risk,  color: '#DB8A66', bg: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.25)' };
  return              { label: t.projects_health_critical,      color: '#E05252', bg: 'rgba(224,82,82,0.12)',   border: 'rgba(224,82,82,0.25)'   };
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

// ── Documentos / Actividad helpers ──────────────────────────────────────────────
function docSnippet(content: string) {
  const txt = (content ?? '').replace(/\s+/g, ' ').trim();
  return txt.length > 120 ? txt.slice(0, 120) + '…' : txt || 'Documento vacío';
}
function docWords(content: string) {
  const n = (content ?? '').trim() ? (content.trim().match(/\S+/g)?.length ?? 0) : 0;
  return `${n.toLocaleString('es-ES')} ${n === 1 ? 'palabra' : 'palabras'}`;
}

type ActCategory = 'milestone' | 'board' | 'team' | 'project';

interface ActivityEntry {
  id: string;
  eventType: string;
  payload: any;
  delta?: any;
  userId: string;
  userName: string;
  userAvatar?: string;
  timestamp: number;
  createdAt: string;
  targetType?: string;
  targetId?: string;
  targetName?: string;
  cardId?: string;
}

type ActGroup = { month: string; days: { day: string; events: ActivityEntry[] }[] };

function authorName(members: { memberId?: string; id: string; name: string }[], userId: string) {
  const m = members.find((mb) => mb.memberId === userId || mb.id === userId);
  return m?.name ?? 'Un miembro';
}

function groupByMonth(entries: ActivityEntry[]): ActGroup[] {
  const groups: ActGroup[] = [];
  for (const e of entries) {
    const d = new Date(e.createdAt);
    const monthLabel = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    const dayLabel   = d.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    let g = groups.find((x) => x.month === monthLabel);
    if (!g) { g = { month: monthLabel, days: [] }; groups.push(g); }
    let dy = g.days.find((x) => x.day === dayLabel);
    if (!dy) { dy = { day: dayLabel, events: [] }; g.days.push(dy); }
    dy.events.push(e);
  }
  return groups;
}

function eventCategory(type: string): ActCategory {
  if (type.includes('milestone')) return 'milestone';
  if (type.startsWith('team.') || type.startsWith('project.member') || type.startsWith('workspace.member')) return 'team';
  if (
    type.startsWith('sprint')  || type.startsWith('board')  ||
    type.startsWith('list')    || type.startsWith('card')   ||
    type.startsWith('comment') || type.startsWith('checklist')
  ) return 'board';
  return 'project';
}

function statusLabel(s: string): string {
  switch (s) {
    case 'PLANNING':  return 'Planificación';
    case 'ACTIVE':    return 'Activo';
    case 'ON_HOLD':   return 'En pausa';
    case 'COMPLETED': return 'Completado';
    case 'ARCHIVED':  return 'Archivado';
    default:          return s ?? '';
  }
}

function priorityLabel(p: string): string {
  switch (p) {
    case 'HIGH':   return 'Alta';
    case 'MEDIUM': return 'Media';
    case 'LOW':    return 'Baja';
    case 'NONE':   return 'Sin prioridad';
    default:       return p ?? '—';
  }
}

function describeEvent(ev: ActivityEntry): { verb: string; target: string; accent: string } {
  const p  = ev.payload ?? {};
  const tn = ev.targetName ?? '';

  // Helpers
  const card  = (p.cardTitle  as string) || '';
  const item  = (p.itemTitle  as string) || tn;
  const mem   = (p.memberName as string) || tn;
  const lbl   = (p.labelName  as string) || tn;
  const bking = (p.blockingCardTitle as string) || tn;
  const bked  = (p.blockedCardTitle  as string) || '';
  const spr   = (p.sprintName as string) || tn;

  switch (ev.eventType) {
    // ── Proyecto ────────────────────────────────────────────────────────────
    case 'project.created':             return { verb: 'creó el proyecto',              target: tn,                          accent: '#4B607F' };
    case 'project.updated':             return { verb: 'editó el proyecto',             target: tn,                          accent: '#4B607F' };
    case 'project.status.changed':      return { verb: 'cambió el estado a',            target: statusLabel(p.newStatus),    accent: '#DB8A66' };
    case 'project.deleted':             return { verb: 'eliminó el proyecto',           target: tn,                          accent: '#E5705A' };
    case 'project.board.linked':        return { verb: 'vinculó el tablero',            target: p.boardName ?? tn,           accent: '#C2904B' };
    case 'project.board.unlinked':      return { verb: 'desvinculó el tablero',         target: p.boardName ?? tn,           accent: '#615846' };
    case 'project.milestone.created':   return { verb: 'creó el hito',                 target: tn,                          accent: '#4B607F' };
    case 'project.milestone.completed': return { verb: 'completó el hito',             target: tn,                          accent: '#76A878' };
    case 'project.milestone.missed':    return { verb: 'marcó como perdido el hito',   target: tn,                          accent: '#E5705A' };
    case 'project.milestone.deleted':   return { verb: 'eliminó el hito',              target: tn,                          accent: '#615846' };
    case 'project.milestone.updated':   return { verb: 'actualizó el hito',            target: tn,                          accent: '#4B607F' };
    case 'project.team.assigned':       return { verb: 'asignó el equipo',             target: p.teamName ?? tn,            accent: '#8C7C9E' };
    case 'project.team.removed':        return { verb: 'quitó el equipo',              target: p.teamName ?? tn,            accent: '#615846' };
    case 'project.member.added':        return { verb: 'invitó a',                     target: p.memberName ?? tn,          accent: '#76A878' };
    case 'project.member.removed':      return { verb: 'quitó a',                      target: p.memberName ?? tn,          accent: '#E5705A' };

    // ── Sprints ─────────────────────────────────────────────────────────────
    case 'sprint.created':              return { verb: 'creó el sprint',               target: spr,                         accent: '#7B8FA8' };
    case 'sprint.started':              return { verb: 'inició el sprint',             target: spr,                         accent: '#76A878' };
    case 'sprint.completed':            return { verb: 'completó el sprint',           target: spr,                         accent: '#C2904B' };
    case 'sprint.card.added':           return { verb: `añadió «${tn || card}» al sprint`, target: spr,                    accent: '#7B8FA8' };
    case 'sprint.card.removed':         return { verb: `quitó «${tn || card}» del sprint`, target: spr,                    accent: '#615846' };

    // ── Tablero ─────────────────────────────────────────────────────────────
    case 'board.created':               return { verb: 'creó el tablero',              target: tn,                          accent: '#4B607F' };
    case 'board.updated':               return { verb: 'editó el tablero',             target: tn,                          accent: '#4B607F' };
    case 'board.deleted':               return { verb: 'eliminó el tablero',           target: tn,                          accent: '#E5705A' };
    case 'board.archived':              return { verb: 'archivó el tablero',           target: tn,                          accent: '#615846' };
    case 'board.restored':              return { verb: 'restauró el tablero',          target: tn,                          accent: '#76A878' };

    // ── Listas ──────────────────────────────────────────────────────────────
    case 'list.created':                return { verb: 'creó la lista',                target: tn,                          accent: '#4B607F' };
    case 'list.updated':                return { verb: 'renombró la lista a',          target: tn,                          accent: '#4B607F' };
    case 'list.deleted':                return { verb: 'eliminó la lista',             target: tn,                          accent: '#E5705A' };
    case 'list.archived':               return { verb: 'archivó la lista',             target: tn,                          accent: '#615846' };
    case 'list.order-changed':          return { verb: 'reordenó las listas',          target: '',                          accent: '#615846' };

    // ── Tarjetas ─────────────────────────────────────────────────────────────
    case 'card.created':                return { verb: 'creó la tarjeta',              target: tn,                          accent: '#76A878' };
    case 'card.updated':                return { verb: 'editó la tarjeta',             target: tn,                          accent: '#4B607F' };
    case 'card.deleted':                return { verb: 'eliminó la tarjeta',           target: tn,                          accent: '#E5705A' };
    case 'card.archived':               return { verb: 'archivó la tarjeta',           target: tn,                          accent: '#615846' };
    case 'card.restored':               return { verb: 'restauró la tarjeta',          target: tn,                          accent: '#76A878' };
    case 'card.moved': {
      const from = (ev.delta?.before as any)?.listName as string | undefined;
      const to   = (ev.delta?.after  as any)?.listName as string | undefined;
      return from && to
        ? { verb: `movió «${tn}» de «${from}» a`, target: to, accent: '#C2904B' }
        : { verb: 'movió la tarjeta', target: tn, accent: '#C2904B' };
    }
    case 'card.status-changed': {
      const completed = (ev.delta?.after as any)?.completed;
      return completed
        ? { verb: 'completó la tarjeta', target: tn, accent: '#76A878' }
        : { verb: 'reabrió la tarjeta',  target: tn, accent: '#DB8A66' };
    }
    case 'card.priority.changed': {
      const after = (ev.delta?.after as any)?.priority as string | undefined;
      return after
        ? { verb: `cambió la prioridad de «${tn}» a`, target: priorityLabel(after), accent: '#C2904B' }
        : { verb: 'cambió la prioridad de',            target: tn,                  accent: '#C2904B' };
    }
    case 'card.due-date.set':           return { verb: 'puso fecha límite en',         target: tn,                          accent: '#DB8A66' };
    case 'card.due-date.removed':       return { verb: 'quitó la fecha límite de',     target: tn,                          accent: '#615846' };

    // ── Miembros de tarjeta ──────────────────────────────────────────────────
    case 'card.member.assigned':
      return card
        ? { verb: `asignó a «${mem}» en`, target: card, accent: '#8C7C9E' }
        : { verb: 'asignó a',              target: mem,  accent: '#8C7C9E' };
    case 'card.member.removed':
      return card
        ? { verb: `quitó a «${mem}» de`, target: card, accent: '#615846' }
        : { verb: 'quitó a',              target: mem,  accent: '#615846' };

    // ── Etiquetas ────────────────────────────────────────────────────────────
    case 'card.label.added':
      return card
        ? { verb: `añadió la etiqueta «${lbl}» en`, target: card, accent: '#C2904B' }
        : { verb: 'añadió la etiqueta',               target: lbl,  accent: '#C2904B' };
    case 'card.label.removed':
      return card
        ? { verb: `quitó la etiqueta «${lbl}» de`, target: card, accent: '#615846' }
        : { verb: 'quitó la etiqueta',               target: lbl,  accent: '#615846' };

    // ── Dependencias ─────────────────────────────────────────────────────────
    case 'card.dependency.added':
      return bked
        ? { verb: `bloqueó «${bked}» hasta completar`, target: bking, accent: '#8C7C9E' }
        : { verb: 'añadió dependencia en',              target: bking, accent: '#8C7C9E' };
    case 'card.dependency.removed':
      return bked
        ? { verb: `desbloqueó «${bked}» de`, target: bking, accent: '#76A878' }
        : { verb: 'quitó dependencia de',     target: bking, accent: '#615846' };

    // ── Comentarios ──────────────────────────────────────────────────────────
    case 'comment.created':
      return card
        ? { verb: `comentó en «${card}»:`,      target: tn || '…',  accent: '#7B8FA8' }
        : { verb: 'comentó:',                    target: tn || '…',  accent: '#7B8FA8' };
    case 'comment.updated':
      return card
        ? { verb: `editó un comentario en`,     target: card, accent: '#4B607F' }
        : { verb: 'editó un comentario',         target: '',   accent: '#4B607F' };
    case 'comment.deleted':
      return card
        ? { verb: `eliminó un comentario en`,   target: card, accent: '#E5705A' }
        : { verb: 'eliminó un comentario',       target: '',   accent: '#E5705A' };
    case 'comment.mention-added':
      return { verb: 'mencionó a alguien en',   target: card || tn, accent: '#8C7C9E' };

    // ── Subtareas (checklist) ─────────────────────────────────────────────────
    case 'checklist.created':            return { verb: 'creó checklist en',            target: tn,  accent: '#4B607F' };
    case 'checklist.deleted':            return { verb: 'eliminó checklist en',         target: tn,  accent: '#E5705A' };
    case 'checklist.item.created':
      return card
        ? { verb: `añadió la subtarea «${item}» en`, target: card, accent: '#76A878' }
        : { verb: 'añadió subtarea',                  target: item, accent: '#76A878' };
    case 'checklist.item.updated':
      return card
        ? { verb: `renombró la subtarea «${item}» en`, target: card, accent: '#4B607F' }
        : { verb: 'actualizó subtarea',                 target: item, accent: '#4B607F' };
    case 'checklist.item.deleted':
      return card
        ? { verb: `eliminó la subtarea «${item}» de`, target: card, accent: '#E5705A' }
        : { verb: 'eliminó subtarea',                  target: item, accent: '#E5705A' };
    case 'checklist.item.status-changed': {
      const checked = (ev.delta?.after as any)?.checked as boolean | undefined;
      return card
        ? (checked
            ? { verb: `completó la subtarea «${item}» en`, target: card, accent: '#76A878' }
            : { verb: `desmarcó la subtarea «${item}» en`, target: card, accent: '#DB8A66' })
        : (checked
            ? { verb: 'completó la subtarea', target: item, accent: '#76A878' }
            : { verb: 'desmarcó la subtarea', target: item, accent: '#DB8A66' });
    }

    default: return { verb: 'realizó una acción',  target: tn || '', accent: '#5C5447' };
  }
}

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
  bufferDays: number | null;
  boardId: string;
  boardName: string;
  listName: string;
}

interface SprintCardItem {
  id: string;
  title: string;
  completed: boolean;
  priority: string | null;
  startDate: string | null;
  dueDate: string | null;
  listId: string;
  position: number;
}

interface SprintItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  boardId: string;
  boardName: string;
  cards?: SprintCardItem[];
}

interface BacklogCard {
  id: string;
  title: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW' | null;
  dueDate: string | null;
  boardId: string;
  boardName: string;
  listId: string;
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
  projectId, milestones, color, refreshTick, boardIds,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  color: string;
  refreshTick?: number;
  boardIds?: string[];
}) {
  const [cards,        setCards]        = useState<TimelineCard[]>([]);
  const [depEdges,     setDepEdges]     = useState<{ blockingCardId: string; blockedCardId: string }[]>([]);
  const [boardSprints, setBoardSprints] = useState<SprintItem[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [syncing,      setSyncing]      = useState(false);
  const [tooltip,      setTooltip]      = useState<TooltipState | null>(null);
  const [internalTick, setInternalTick] = useState(0);
  const timelineVersion = useTimelineStore((s) => s.version);
  const setSelectedCard = useCardStore((s) => s.setSelectedCard);
  // Tracks the last projectId that completed a full load, so background refreshes
  // (timelineVersion / internalTick changes) don't trigger the full loading spinner.
  const lastLoadedProject = useRef<string | null>(null);

  // Suscripción en tiempo real a los boards del proyecto
  const boardIdsKey = (boardIds ?? []).join(',');
  useEffect(() => {
    const ids = boardIds ?? [];
    if (!ids.length) return;

    ids.forEach(bid => socketService.joinBoard(bid));

    const GANTT_EVENTS = new Set([
      'card.created', 'card.updated', 'card.deleted', 'card.moved',
      'card.due-date.set', 'card.due-date.removed',
      'card.priority.changed', 'card.status-changed',
      'sprint.created', 'sprint.started', 'sprint.completed',
    ]);

    let debounce: ReturnType<typeof setTimeout>;
    const onEvent = (ev: any) => {
      if (!GANTT_EVENTS.has(ev.type)) return;
      clearTimeout(debounce);
      debounce = setTimeout(() => setInternalTick(n => n + 1), 600);
    };

    socketService.onEvent(onEvent);
    return () => {
      clearTimeout(debounce);
      socketService.off('event', onEvent);
      ids.forEach(bid => socketService.leaveBoard(bid));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardIdsKey]);

  useEffect(() => {
    // First load for this project: show full spinner. Background refreshes are silent.
    const isBgRefresh = lastLoadedProject.current === projectId;
    if (isBgRefresh) setSyncing(true); else setLoading(true);

    apiService.get<{ cards: TimelineCard[] }>(`/api/projects/${projectId}/timeline-cards`, true)
      .then(async (res) => {
        if (!res.success || !res.data) return;
        const fetched = res.data.cards;
        const fetchedBoardIds = [...new Set(fetched.map((c) => c.boardId))];
        const cardIdSet = new Set(fetched.map((c) => c.id));

        // Fetch dependency edges + sprints in parallel per board
        const edges: { blockingCardId: string; blockedCardId: string }[] = [];
        const allSprints: SprintItem[] = [];
        await Promise.all(fetchedBoardIds.map(async (bid) => {
          const boardName = fetched.find((c) => c.boardId === bid)?.boardName ?? '';
          await Promise.all([
            apiService.get<{ graph: { edges: { blockingCardId: string; blockedCardId: string }[] } }>(
              `/api/boards/${bid}/dependency-graph`, true
            ).then((r) => {
              if (!r.success || !r.data) return;
              for (const e of r.data.graph.edges ?? []) {
                if (cardIdSet.has(e.blockingCardId) && cardIdSet.has(e.blockedCardId))
                  edges.push(e);
              }
            }).catch(() => {}),

            apiService.get<{ sprints: Array<SprintItem & { cards: SprintCardItem[] }> }>(`/api/boards/${bid}/sprints`, true)
              .then((r) => {
                if (!r.success || !r.data) return;
                for (const s of r.data.sprints) {
                  if (s.status !== 'COMPLETED' && s.startDate && s.endDate)
                    allSprints.push({ ...s, boardId: bid, boardName });
                }
              }).catch(() => {}),
          ]);
        }));

        // Batch all state updates together so React renders once
        setCards(fetched);
        setDepEdges(edges);
        setBoardSprints(allSprints.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()));
        lastLoadedProject.current = projectId;
      })
      .finally(() => { setLoading(false); setSyncing(false); });
  }, [projectId, refreshTick, internalTick, timelineVersion]);

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

  // ── Date range — snap to month start/end, normalized to local midnight ────
  const rawMin = new Date(Math.min(...allDates));
  const rawMax = new Date(Math.max(...allDates));
  // Normalize to local midnight to avoid timezone/DST shifts in day calculations
  const rangeStart = new Date(rawMin.getFullYear(), rawMin.getMonth(), 1);
  const rangeEnd   = new Date(rawMax.getFullYear(), rawMax.getMonth() + 1, 0); // last day of max month
  const MS_PER_DAY = 86400000;
  const baseDays   = Math.max(1, Math.round((rangeEnd.getTime() - rangeStart.getTime()) / MS_PER_DAY) + 1);

  // Compute max buffer padding needed so buffer bars don't get clipped
  const maxBufDays = cards.reduce((max, c) => {
    if (!c.startDate || !c.dueDate) return max;
    const dur = Math.max(1, Math.round((new Date(c.dueDate).getTime() - new Date(c.startDate).getTime()) / MS_PER_DAY));
    const buf = c.bufferDays != null ? c.bufferDays : Math.max(1, Math.round(dur * (c.priority === 'HIGH' ? 0.5 : c.priority === 'MEDIUM' ? 0.3 : 0.15)));
    return Math.max(max, buf);
  }, 0);
  const totalDays = baseDays + maxBufDays + 3; // +3 days visual breathing room

  // Pixel width per day — adaptive based on range length
  const DAY_W = baseDays <= 60 ? 32 : baseDays <= 120 ? 22 : baseDays <= 240 ? 16 : 12;
  const TRACK_W = totalDays * DAY_W; // full track width in px

  /** Convert a date to pixel X position on the track */
  function dayX(d: Date): number {
    return Math.round((d.getTime() - rangeStart.getTime()) / MS_PER_DAY * DAY_W);
  }

  const _now = new Date();
  const todayX = dayX(new Date(_now.getFullYear(), _now.getMonth(), _now.getDate()));

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
  // Actual rendered row heights (used for dependency line geometry)
  const GANTT_MONTH_H   = 30; // month band
  const GANTT_WEEK_H    = 22; // week header
  const GANTT_ROW_H_ACT = 34; // card/milestone row

  function showTip(e: React.MouseEvent, tip: TooltipState) {
    setTooltip({ ...tip, x: e.clientX, y: e.clientY });
  }

  type Row =
    | { kind: 'section'; label: string; icon: 'flag' | 'board' | 'sprint' }
    | { kind: 'sprint'; s: SprintItem }
    | { kind: 'milestone'; m: ProjectMilestone }
    | { kind: 'card'; card: TimelineCard; rowIdx: number };

  const SPRINT_ROW_H = 30;

  const rows: Row[] = [];

  // IDs de cards ya mostradas bajo un sprint (para evitar duplicados en la sección de boards)
  const sprintCardIdSet = new Set<string>();

  if (boardSprints.length > 0) {
    rows.push({ kind: 'section', label: 'Sprints', icon: 'sprint' });
    boardSprints.forEach((s) => {
      rows.push({ kind: 'sprint', s });
      // Cards del sprint — se muestran inmediatamente después de su sprint
      const sprintCards = (s.cards ?? []).filter(c => !c.completed);
      sprintCards.forEach((c, i) => {
        sprintCardIdSet.add(c.id);
        // Si la card no tiene fechas propias, usa las del sprint como referencia visual
        const effectiveStart = c.startDate ?? s.startDate;
        const effectiveDue   = c.dueDate   ?? s.endDate;
        rows.push({ kind: 'card', card: {
          id: c.id, title: c.title, completed: c.completed,
          priority: c.priority, startDate: effectiveStart, dueDate: effectiveDue,
          bufferDays: null, boardId: s.boardId, boardName: s.boardName, listName: '',
        }, rowIdx: i });
      });
    });
  }
  if (milestones.length > 0) {
    rows.push({ kind: 'section', label: 'Hitos', icon: 'flag' });
    milestones.forEach((m) => rows.push({ kind: 'milestone', m }));
  }
  // Cards sin sprint asignado (excluir las que ya aparecen bajo un sprint)
  boards.forEach((board) => {
    board.cards
      .filter(c => !sprintCardIdSet.has(c.id))
      .forEach((card, i) => rows.push({ kind: 'card', card, rowIdx: i }));
  });

  const totalH = HEADER_H + rows.reduce((h, r) =>
    h + (r.kind === 'section' ? SECTION_H : r.kind === 'sprint' ? SPRINT_ROW_H : ROW_H), 0);

  // ── Card geometry for dependency lines ─────────────────────────────────
  const cardGeom = new Map<string, { x: number; y: number; w: number; dueOnly: boolean }>();
  {
    let y = GANTT_MONTH_H + GANTT_WEEK_H;
    for (const row of rows) {
      if (row.kind === 'section') {
        y += SECTION_H;
      } else if (row.kind === 'sprint') {
        y += SPRINT_ROW_H;
      } else if (row.kind === 'milestone') {
        y += GANTT_ROW_H_ACT;
      } else {
        const { card } = row;
        const sX = card.startDate ? dayX(new Date(card.startDate)) : null;
        const eX = card.dueDate   ? dayX(new Date(card.dueDate))   : null;
        const mX = eX ?? sX;
        if (mX !== null) {
          const hasRange = sX !== null && eX !== null;
          cardGeom.set(card.id, {
            x: hasRange ? sX! : mX,
            y,
            w: hasRange ? Math.max(DAY_W, eX! - sX!) : 0,
            dueOnly: !hasRange,
          });
        }
        y += GANTT_ROW_H_ACT;
      }
    }
  }

  // ── Open CardDetailModal on card click ─────────────────────────────────
  function handleCardClick(card: TimelineCard) {
    setSelectedCard({
      id: card.id, title: card.title, listId: '',
      position: 0, completed: card.completed,
      startDate: card.startDate ?? undefined,
      dueDate: card.dueDate ?? undefined,
      priority: card.priority as Card['priority'],
      createdBy: '', createdAt: '', updatedAt: '',
      _boardId: card.boardId,   // picked up by CardDetailModal for sprint fetch
    } as any);
  }

  return (
    <div style={{ position: 'relative' }} onMouseLeave={() => setTooltip(null)}>
      {/* Indicador de sincronización silenciosa — no bloquea el Gantt */}
      {syncing && (
        <div style={{
          position: 'absolute', top: 6, right: 8, zIndex: 20,
          display: 'flex', alignItems: 'center', gap: 5,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)',
          borderRadius: 6, padding: '3px 8px',
          fontSize: '10.5px', color: 'rgba(255,255,255,0.5)',
          pointerEvents: 'none',
        }}>
          <div style={{ width: 9, height: 9, border: '1.5px solid rgba(255,255,255,0.2)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          Actualizando
        </div>
      )}
      {/* Custom scrollbar para el Gantt */}
      <style>{`
        .dshScroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) transparent; }
        .dshScroll::-webkit-scrollbar { height: 10px; width: 10px; }
        .dshScroll::-webkit-scrollbar-track { background: transparent; margin: 0 8px; }
        .dshScroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(255,255,255,0.14), rgba(255,255,255,0.2));
          border-radius: 999px;
          border: 2px solid transparent;
          background-clip: padding-box;
          transition: background 0.18s ease;
        }
        .dshScroll::-webkit-scrollbar-thumb:hover {
          background: linear-gradient(90deg, ${color}cc, ${color});
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        .dshScroll::-webkit-scrollbar-thumb:active {
          background: ${color};
          background-clip: padding-box;
          border: 2px solid transparent;
        }
        .dshScroll::-webkit-scrollbar-corner { background: transparent; }
        .dshScroll:hover { scrollbar-color: ${color}99 transparent; }
      `}</style>

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

      <div className="dshScroll" style={{ overflowX: 'auto', border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', background: 'rgba(255,255,255,0.015)' }}>
        <div style={{ width: `${SIDEBAR_W + TRACK_W}px`, minWidth: '100%', position: 'relative' }}>

          {/* ── Header (month + days) ──────────────────────────────── */}
          {(() => {
            const DOW_ES = ['D','L','M','X','J','V','S'];
            const showDow = DAY_W >= 20;
            const DAY_HDR_H = showDow ? 34 : 26;
            const step = DAY_W < 14 ? 7 : DAY_W < 20 ? 3 : 1;
            return (
              <>
                {/* Month row */}
                <div style={{ display: 'flex', background: 'rgba(255,255,255,0.018)', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: '#13172A', borderRight: '1px solid rgba(255,255,255,0.08)', height: '28px', display: 'flex', alignItems: 'center', padding: '0 14px' }}>
                    <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846' }}>Tarea</span>
                  </div>
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: '28px' }}>
                    {monthCols.map((mc2, i) => (
                      <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: mc2.x, width: mc2.width, borderLeft: i > 0 ? '1px solid rgba(255,255,255,0.08)' : 'none', display: 'flex', alignItems: 'center', paddingLeft: '10px', overflow: 'hidden' }}>
                        <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: '#A8A09A', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{mc2.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day row */}
                <div style={{ display: 'flex', borderBottom: '1px solid rgba(255,255,255,0.10)', background: '#13172A' }}>
                  <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: '#13172A', borderRight: '1px solid rgba(255,255,255,0.08)', height: `${DAY_HDR_H}px` }} />
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${DAY_HDR_H}px` }}>
                    {Array.from({ length: totalDays }).map((_, di) => {
                      const d          = new Date(rangeStart.getTime() + di * MS_PER_DAY);
                      const dow        = d.getDay();
                      const isWeekend  = dow === 0 || dow === 6;
                      const isToday    = di * DAY_W === todayX;
                      const showLabel  = di % step === 0;
                      const isMonthStart = d.getDate() === 1;
                      return (
                        <div
                          key={di}
                          style={{
                            position: 'absolute', top: 0, bottom: 0,
                            left: di * DAY_W, width: DAY_W,
                            borderLeft: isMonthStart
                              ? '1px solid rgba(255,255,255,0.12)'
                              : isWeekend
                                ? '1px solid rgba(255,255,255,0.05)'
                                : '1px solid rgba(255,255,255,0.03)',
                            background: isToday
                              ? 'rgba(226,160,126,0.13)'
                              : isWeekend
                                ? 'rgba(255,255,255,0.02)'
                                : 'transparent',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px',
                          }}
                        >
                          {showLabel && showDow && (
                            <span style={{ fontSize: '7.5px', fontWeight: 500, color: isToday ? '#E2A07E99' : isWeekend ? '#615846' : '#3E3830', lineHeight: 1, userSelect: 'none' }}>
                              {DOW_ES[dow]}
                            </span>
                          )}
                          {showLabel && (
                            isToday ? (
                              <span style={{ width: DAY_W - 6, height: DAY_W - 6, maxWidth: '16px', maxHeight: '16px', minWidth: '11px', minHeight: '11px', borderRadius: '50%', background: '#E2A07E', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: DAY_W < 14 ? '7px' : '8px', fontWeight: 700, color: '#1A1208', lineHeight: 1, userSelect: 'none' }}>{d.getDate()}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: DAY_W < 14 ? '8px' : '9.5px', fontWeight: isWeekend ? 500 : 400, color: isWeekend ? '#615846' : '#4A4540', lineHeight: 1, userSelect: 'none' }}>
                                {d.getDate()}
                              </span>
                            )
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            );
          })()}

          {/* ── Body ───────────────────────────────────────────────── */}
          <div style={{ position: 'relative' }}>
            {/* Weekend column shading + today column highlight */}
            <div style={{ position: 'absolute', top: 0, bottom: 0, left: SIDEBAR_W, width: TRACK_W, pointerEvents: 'none', zIndex: 0 }}>
              {Array.from({ length: totalDays }).map((_, di) => {
                const d   = new Date(rangeStart.getTime() + di * MS_PER_DAY);
                const dow = d.getDay();
                const isWeekend = dow === 0 || dow === 6;
                const isToday   = di * DAY_W === todayX;
                if (!isWeekend && !isToday) return null;
                return (
                  <div key={di} style={{
                    position: 'absolute', top: 0, bottom: 0,
                    left: di * DAY_W, width: DAY_W,
                    background: isToday ? 'rgba(226,160,126,0.07)' : 'rgba(255,255,255,0.018)',
                  }} />
                );
              })}
            </div>


            {/* ── Sprint background bands ─────────────────────────── */}
            {boardSprints.map((s) => {
              const sx = dayX(new Date(s.startDate));
              const ex = dayX(new Date(s.endDate));
              const bw = Math.max(0, ex - sx);
              const bc = s.status === 'ACTIVE' ? '#76A878' : '#9C9486';
              return (
                <div key={'band-' + s.id} style={{
                  position: 'absolute', top: 0, bottom: 0,
                  left: SIDEBAR_W + sx, width: bw,
                  background: `${bc}${s.status === 'ACTIVE' ? '0d' : '07'}`,
                  borderLeft:  `1px solid ${bc}28`,
                  borderRight: `1px solid ${bc}28`,
                  pointerEvents: 'none', zIndex: 0,
                }} />
              );
            })}

            {rows.map((row, rIdx) => {
              // ── Section header ──
              if (row.kind === 'section') {
                const SprintIcon = () => (
                  <svg viewBox="0 0 12 12" fill="none" stroke="#827A6D" strokeWidth="1.5" strokeLinecap="round" width="11" height="11" style={{ flexShrink: 0 }}>
                    <path d="M2 8.5a4 4 0 1 1 8 0M2 8.5l1.3-2M10 8.5l-1.3-2"/>
                  </svg>
                );
                return (
                  <div key={rIdx} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: `${SECTION_H}px`, display: 'flex', alignItems: 'center', gap: '7px', padding: '0 12px' }}>
                      {row.icon === 'flag'
                        ? <Flag style={{ width: '11px', height: '11px', color: '#827A6D', flexShrink: 0 }} />
                        : row.icon === 'sprint'
                          ? <SprintIcon />
                          : <LayoutDashboard style={{ width: '11px', height: '11px', color: '#827A6D', flexShrink: 0 }} />}
                      <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', color: '#827A6D', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                    </div>
                    <div style={{ flex: 'none', width: `${TRACK_W}px`, height: `${SECTION_H}px`, background: 'rgba(255,255,255,0.012)' }} />
                  </div>
                );
              }

              // ── Sprint row ──
              if (row.kind === 'sprint') {
                const { s } = row;
                const sColor = s.status === 'ACTIVE' ? '#76A878' : '#9C9486';
                const sLabel = s.status === 'ACTIVE' ? 'Activo' : 'Planificado';
                const sx = dayX(new Date(s.startDate));
                const ex = dayX(new Date(s.endDate));
                const barW = Math.max(DAY_W * 2, ex - sx);
                const fmtS = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                return (
                  <div key={s.id} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    {/* Sidebar */}
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: `${SPRINT_ROW_H}px`, display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sColor, flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: '#C8BFAE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{s.name}</span>
                        <span style={{ display: 'block', fontSize: '9px', color: '#5C5447', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{s.boardName}</span>
                      </span>
                    </div>
                    {/* Track */}
                    <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${SPRINT_ROW_H}px` }}>
                      <div
                        style={{
                          position: 'absolute', left: sx, top: '50%', transform: 'translateY(-50%)',
                          width: barW, height: '10px', borderRadius: '5px',
                          background: s.status === 'ACTIVE' ? `${sColor}cc` : `${sColor}55`,
                          border: `1px solid ${sColor}60`,
                          display: 'flex', alignItems: 'center', overflow: 'hidden',
                          cursor: 'default',
                        }}
                        onMouseEnter={(e) => showTip(e, {
                          title: s.name,
                          subtitle: `${sLabel} · ${s.boardName}`,
                          color: sColor,
                          range: `${fmtS(s.startDate)} → ${fmtS(s.endDate)}`,
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Sprint name label inside bar (if bar is wide enough) */}
                        {barW > 70 && (
                          <span style={{ fontSize: '9px', fontWeight: 600, color: s.status === 'ACTIVE' ? '#1a2e1a' : '#3a3530', paddingLeft: '6px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none' }}>
                            {s.name}
                          </span>
                        )}
                      </div>
                      {/* Start marker */}
                      <div style={{ position: 'absolute', left: sx, top: 0, bottom: 0, width: '1px', background: `${sColor}50`, pointerEvents: 'none' }} />
                      {/* End marker */}
                      <div style={{ position: 'absolute', left: sx + barW, top: 0, bottom: 0, width: '1px', background: `${sColor}50`, pointerEvents: 'none' }} />
                    </div>
                  </div>
                );
              }

              // ── Phase row (milestone) ──
              if (row.kind === 'milestone') {
                const { m } = row;
                const isPast   = new Date(m.date) < new Date() && m.status === 'PENDING';
                const dotColor = isPast ? C.red : m.status === 'REACHED' ? C.green : (m.color || '#4B607F');
                const mx       = dayX(new Date(m.date));
                return (
                  <div key={m.id} style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: '34px', display: 'flex', alignItems: 'center', gap: '8px', padding: '0 12px' }}>
                      <span style={{ width: '9px', height: '9px', background: dotColor, transform: 'rotate(45deg)', flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: "'Sora', system-ui, sans-serif", fontSize: '12px', fontWeight: 600, color: m.status === 'MISSED' ? '#615846' : '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>{m.name}</span>
                        <span style={{ display: 'block', fontSize: '9.5px', color: '#615846' }}>{fmtShort(m.date)}</span>
                      </span>
                    </div>
                    <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: '34px' }}>
                      <div
                        style={{ position: 'absolute', left: mx, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                        onMouseEnter={(e) => showTip(e, { title: m.name, subtitle: m.description ?? '', color: dotColor, date: `📅 ${fmtDate(m.date)}`, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span style={{ display: 'block', width: '13px', height: '13px', background: dotColor, transform: 'rotate(45deg)', border: '2px solid #161B2E', boxShadow: `0 0 0 1px ${dotColor}88` }} />
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Task row (card) ──
              const { card } = row;
              const hasRange  = !!(card.startDate && card.dueDate);
              const barColor  = card.completed ? C.green : (PRIORITY_COLOR[card.priority ?? ''] ?? '#76A878');
              const isOverdue = !card.completed && card.dueDate && new Date(card.dueDate) < new Date();
              const startX    = card.startDate ? dayX(new Date(card.startDate)) : null;
              const endX2     = card.dueDate   ? dayX(new Date(card.dueDate))   : null;
              const markerX   = endX2 ?? startX;
              const barPx     = hasRange && startX !== null && endX2 !== null ? Math.max(DAY_W, endX2 - startX) : 0;
              const who       = (card.title.trim()[0] ?? '?').toUpperCase();

              // Buffer calculation — manual override OR priority-based auto
              const durDays = (hasRange && card.startDate && card.dueDate)
                ? Math.max(1, Math.round((new Date(card.dueDate).getTime() - new Date(card.startDate).getTime()) / MS_PER_DAY))
                : 0;
              const autoBufDays = durDays > 0
                ? Math.max(1, Math.round(durDays * (card.priority === 'HIGH' ? 0.5 : card.priority === 'MEDIUM' ? 0.3 : 0.15)))
                : 0;
              const bufDays   = card.bufferDays != null ? card.bufferDays : autoBufDays;
              const bufPx     = hasRange && endX2 !== null ? bufDays * DAY_W : 0;

              return (
                <div key={card.id} className="ganttRow" style={{ display: 'flex', borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  {/* Sidebar — clickable to open detail */}
                  <button
                    onClick={() => handleCardClick(card)}
                    style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: '#161B2E', borderRight: '1px solid rgba(255,255,255,0.07)', height: '34px', display: 'flex', alignItems: 'center', gap: '7px', padding: '0 10px', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = '#161B2E'; }}
                  >
                    <span style={{ width: '19px', height: '19px', borderRadius: '50%', background: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>{who}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '11px', color: card.completed ? '#615846' : '#C8BFAE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: card.completed ? 'line-through' : 'none', lineHeight: 1.3 }}>{card.title}</span>
                      <span style={{ display: 'block', fontSize: '9px', color: '#615846', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{card.boardName}</span>
                    </span>
                  </button>
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: '34px' }}>
                    {hasRange && startX !== null ? (
                      <>
                        {/* Main bar */}
                        <div
                          style={{ position: 'absolute', left: startX, top: '50%', transform: 'translateY(-50%)', width: barPx, height: '8px', borderRadius: bufPx > 0 ? '4px 0 0 4px' : '4px', background: card.completed ? `${barColor}55` : `${barColor}d9`, cursor: 'pointer', boxShadow: isOverdue ? `0 0 0 1.5px ${C.red}88` : 'none', transition: 'filter 0.12s', zIndex: 1 }}
                          onClick={() => handleCardClick(card)}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.18)'; showTip(e, { title: card.title, subtitle: card.boardName, color: barColor, range: `${fmtShort(card.startDate!)} → ${fmtShort(card.dueDate!)}`, listName: card.listName, x: e.clientX, y: e.clientY }); }}
                          onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; setTooltip(null); }}
                        />
                        {/* Buffer zone */}
                        {bufPx > 0 && (
                          <div
                            style={{
                              position: 'absolute', left: startX + barPx, top: '50%', transform: 'translateY(-50%)',
                              width: bufPx, height: '8px', borderRadius: '0 4px 4px 0',
                              background: `${barColor}35`,
                              borderRight: `2px solid ${barColor}88`,
                              cursor: 'pointer',
                            }}
                            onClick={() => handleCardClick(card)}
                            onMouseEnter={(e) => showTip(e, { title: card.title, subtitle: `Colchón: ${bufDays}d${card.bufferDays != null ? ' (manual)' : ' (auto)'}`, color: barColor, range: `${fmtShort(card.startDate!)} → ${fmtShort(card.dueDate!)}`, listName: card.listName, x: e.clientX, y: e.clientY })}
                            onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                            onMouseLeave={() => setTooltip(null)}
                          />
                        )}
                      </>
                    ) : markerX !== null && (
                      <div
                        style={{ position: 'absolute', left: markerX, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                        onClick={() => handleCardClick(card)}
                        onMouseEnter={(e) => showTip(e, { title: card.title, subtitle: card.boardName, color: barColor, date: `📅 ${fmtShort(card.dueDate ?? card.startDate!)}`, listName: card.listName, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <div style={{ width: '11px', height: '11px', borderRadius: '50%', background: card.completed ? 'transparent' : barColor, border: `2px solid ${barColor}`, transition: 'transform 0.12s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.3)'; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.transform = ''; }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* ── Dependency staircase lines ── */}
            {depEdges.length > 0 && (() => {
              const cardById = new Map(cards.map((c) => [c.id, c]));
              const els: React.ReactNode[] = [];
              for (const edge of depEdges) {
                const from = cardGeom.get(edge.blockingCardId);
                const to   = cardGeom.get(edge.blockedCardId);
                if (!from || !to) continue;
                const blocking = cardById.get(edge.blockingCardId);
                const isBlocked = !blocking?.completed;
                const stroke = isBlocked ? '#ef4444' : '#22c55e';

                // Source right edge center
                const x1 = SIDEBAR_W + (from.dueOnly ? from.x + 5.5 : from.x + from.w);
                const y1 = from.y + GANTT_ROW_H_ACT / 2;
                // Target left edge center
                const x2 = SIDEBAR_W + (to.dueOnly ? to.x - 5.5 : to.x);
                const y2 = to.y + GANTT_ROW_H_ACT / 2;

                const stub = Math.max(8, (x2 - x1) * 0.2);
                const midX = x1 + stub;
                const path = y1 === y2
                  ? `M ${x1} ${y1} H ${x2}`
                  : `M ${x1} ${y1} H ${midX} V ${y2} H ${x2}`;

                const arrowTip = x2 >= midX ? 1 : -1;
                els.push(
                  <g key={edge.blockingCardId + '-' + edge.blockedCardId} opacity={0.7}>
                    <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeDasharray={isBlocked ? '5 3' : 'none'} />
                    <polygon points={`${x2 + arrowTip * 5},${y2} ${x2},${y2 - 3.5} ${x2},${y2 + 3.5}`} fill={stroke} />
                  </g>
                );
              }
              if (els.length === 0) return null;
              const svgH = rows.reduce((h, r) =>
                h + (r.kind === 'section' ? SECTION_H : r.kind === 'sprint' ? SPRINT_ROW_H : GANTT_ROW_H_ACT),
                GANTT_MONTH_H + GANTT_WEEK_H);
              return (
                <svg style={{ position: 'absolute', inset: 0, width: SIDEBAR_W + TRACK_W, height: svgH, pointerEvents: 'none', overflow: 'visible', zIndex: 4 }}>
                  {els}
                </svg>
              );
            })()}
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

type ProjectMember = TeamMember & { teamName: string; teamColor: string | null };
type DirectMember  = { id: string; name: string; email: string; avatar?: string | null; role: string; addedAt: string; };
type SearchUser    = { id: string; name: string; email: string; avatar?: string | null; };

const MEMBER_PALETTE = ['#F2571E', '#76A878', '#4B607F', '#DB8A66', '#8C7C9E', '#C2904B'];
function memberColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_PALETTE[h % MEMBER_PALETTE.length];
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
            <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '8px', minWidth: '220px', maxHeight: '240px', overflowY: 'auto', boxShadow: '0 8px 32px rgba(0,0,0,0.45)' }}>
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
// ── DatePicker ────────────────────────────────────────────────────────────────
const DP_DAYS   = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá', 'Do'];
const DP_MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function DatePicker({ value, onChange, placeholder = 'Sin fecha', accent = '#F2571E' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; accent?: string;
}) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()     ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  // sync view when value changes externally
  useEffect(() => {
    if (value) {
      const d = new Date(value + 'T00:00:00');
      setViewYear(d.getFullYear());
      setViewMonth(d.getMonth());
    }
  }, [value]);

  const prevMonth = () => viewMonth === 0  ? (setViewYear(y => y - 1), setViewMonth(11))    : setViewMonth(m => m - 1);
  const nextMonth = () => viewMonth === 11 ? (setViewYear(y => y + 1), setViewMonth(0))     : setViewMonth(m => m + 1);

  const startOffset   = (new Date(viewYear, viewMonth, 1).getDay() + 6) % 7;
  const daysInMonth   = new Date(viewYear, viewMonth + 1, 0).getDate();
  const daysInPrev    = new Date(viewYear, viewMonth, 0).getDate();

  const cells: { d: number; m: 'prev' | 'curr' | 'next' }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ d: daysInPrev - i, m: 'prev' });
  for (let d = 1; d <= daysInMonth; d++)      cells.push({ d, m: 'curr' });
  while (cells.length % 7 !== 0)              cells.push({ d: cells.length - daysInMonth - startOffset + 1, m: 'next' });

  const fmt = (v: string) => new Date(v + 'T00:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });

  const isSelected = (d: number) => {
    if (!value) return false;
    const [sy, sm, sd] = value.split('-').map(Number);
    return sy === viewYear && sm - 1 === viewMonth && sd === d;
  };
  const isToday = (d: number) => today.getFullYear() === viewYear && today.getMonth() === viewMonth && today.getDate() === d;

  const select = (d: number) => {
    onChange(`${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
    setOpen(false);
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* Trigger */}
      <button type="button" onClick={() => setOpen(v => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${open ? accent : C.border2}`, color: value ? C.text : C.text4, cursor: 'pointer', textAlign: 'left', transition: 'border-color 0.14s', boxSizing: 'border-box' as const }}
      >
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" width="13" height="13" style={{ flexShrink: 0, color: C.text3 }}>
          <rect x="1.5" y="2.5" width="13" height="12" rx="2"/><path d="M1.5 6h13M5 1v3M11 1v3" strokeLinecap="round"/>
        </svg>
        <span style={{ flex: 1 }}>{value ? fmt(value) : placeholder}</span>
        {value && (
          <span onClick={(e) => { e.stopPropagation(); onChange(''); }}
            style={{ display: 'flex', alignItems: 'center', color: C.text4, cursor: 'pointer', padding: '2px' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = C.text2)}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = C.text4)}
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" width="10" height="10"><path d="M1 1l8 8M9 1L1 9"/></svg>
          </span>
        )}
      </button>

      {/* Calendar */}
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 400, background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.55)', padding: '12px', minWidth: '248px', animation: 'dpIn 0.15s cubic-bezier(0.16,1,0.3,1)' }}>
          <style>{`@keyframes dpIn { from { opacity:0; transform:translateY(-5px) scale(0.97) } to { opacity:1; transform:translateY(0) scale(1) } }`}</style>

          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            {[
              { dir: 'prev', path: 'M7 1L3 5l4 4', fn: prevMonth },
              { dir: 'next', path: 'M3 1l4 4-4 4', fn: nextMonth },
            ].map(({ dir, path, fn }, idx) => (
              <button key={dir} type="button" onClick={fn}
                style={{ order: idx === 0 ? 0 : 2, width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text3, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s, color 0.1s' }}
                onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
                onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; }}
              >
                <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.6" width="10" height="10"><path d={path} strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            ))}
            <span style={{ order: 1, fontSize: '12.5px', fontWeight: 700, color: C.text, fontFamily: "'Sora', system-ui, sans-serif" }}>
              {DP_MONTHS[viewMonth]} {viewYear}
            </span>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
            {DP_DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: C.text4, letterSpacing: '0.04em', padding: '2px 0', fontFamily: "'Sora', system-ui, sans-serif" }}>{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px' }}>
            {cells.map((cell, i) => {
              const isCurr = cell.m === 'curr';
              const sel    = isCurr && isSelected(cell.d);
              const tod    = isCurr && isToday(cell.d);
              return (
                <button key={i} type="button" onClick={() => isCurr && select(cell.d)}
                  style={{ width: '32px', height: '32px', borderRadius: '7px', border: 'none', background: sel ? accent : 'transparent', color: sel ? '#24180A' : isCurr ? C.text : C.text4, fontSize: '12.5px', fontWeight: sel || tod ? 700 : 400, cursor: isCurr ? 'pointer' : 'default', outline: !sel && tod ? `2px solid ${accent}` : 'none', outlineOffset: '-1px', opacity: !isCurr ? 0.28 : 1, transition: 'background 0.1s', boxSizing: 'border-box' as const }}
                  onMouseEnter={e => { if (isCurr && !sel) e.currentTarget.style.background = C.hover; }}
                  onMouseLeave={e => { if (isCurr && !sel) e.currentTarget.style.background = 'transparent'; }}
                >
                  {cell.d}
                </button>
              );
            })}
          </div>

          {/* Hoy shortcut */}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${C.border}`, textAlign: 'center' }}>
            <button type="button" onClick={() => { setViewYear(today.getFullYear()); setViewMonth(today.getMonth()); select(today.getDate()); }}
              style={{ fontSize: '11px', color: C.text3, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Manrope', system-ui, sans-serif", transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.text3)}
            >Hoy</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── ConfigModal ───────────────────────────────────────────────────────────────
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
  const [confirmDel, setConfirmDel] = useState(false);

  // animation
  const [animIn,  setAnimIn]  = useState(false);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimIn(true));
    return () => { cancelAnimationFrame(id); if (closeTimer.current) clearTimeout(closeTimer.current); };
  }, []);

  const handleClose = () => {
    if (saving) return;
    setAnimIn(false);
    setClosing(true);
    closeTimer.current = setTimeout(onClose, 200);
  };

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
      handleClose();
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    await deleteProject(project.id);
    router.push('/dashboard/projects');
  };

  const accent = project.color || C.accent;
  const LBL = ({ children }: { children: React.ReactNode }) => (
    <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' as const, display: 'block', marginBottom: '5px', fontFamily: "'Sora', system-ui, sans-serif" }}>{children}</label>
  );

  return (
    <>
      <style>{`
        @keyframes cfgOverIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cfgOverOut { from { opacity:1 } to { opacity:0 } }
        @keyframes cfgPanIn   { from { opacity:0; transform:translateY(12px) scale(0.96) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes cfgPanOut  { from { opacity:1; transform:translateY(0) scale(1) } to { opacity:0; transform:translateY(8px) scale(0.98) } }
      `}</style>

      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: `rgba(0,0,0,${animIn ? 0.7 : 0})`, backdropFilter: 'blur(4px)', transition: 'background 0.2s ease', animation: closing ? 'cfgOverOut 0.2s ease forwards' : undefined }}
        onClick={handleClose}
      >
        <div
          style={{ width: '100%', maxWidth: '440px', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.65)', animation: closing ? 'cfgPanOut 0.18s ease forwards' : 'cfgPanIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
            <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text, fontFamily: "'Sora', system-ui, sans-serif" }}>{t.projects_config_title}</span>
            <button onClick={handleClose} style={{ width: '26px', height: '26px', borderRadius: '6px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
            ><X style={ic(14)} /></button>
          </div>

          {/* Body */}
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

            {/* Nombre */}
            <div>
              <LBL>{t.projects_config_name}</LBL>
              <input value={name} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.14s', fontFamily: "'Manrope', system-ui, sans-serif" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>

            {/* Descripción */}
            <div>
              <LBL>{t.projects_config_desc}</LBL>
              <textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.14s', fontFamily: "'Manrope', system-ui, sans-serif" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>

            {/* Estado */}
            <div>
              <LBL>{t.projects_config_status}</LBL>
              <select value={status} onChange={(e) => setStatus(e.target.value as any)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', colorScheme: 'dark', cursor: 'pointer' }}
              >
                {(['PLANNING','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'] as const).map((s) => (
                  <option key={s} value={s}>{getStatusCfg(s, t).label}</option>
                ))}
              </select>
            </div>

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <LBL>{t.projects_config_start}</LBL>
                <DatePicker value={start} onChange={setStart} placeholder="Inicio" accent={accent} />
              </div>
              <div>
                <LBL>{t.projects_config_end}</LBL>
                <DatePicker value={end} onChange={setEnd} placeholder="Fin" accent={accent} />
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <button onClick={handleDelete}
                style={{ fontSize: '11.5px', color: confirmDel ? C.red : C.text4, background: confirmDel ? `${C.red}12` : 'transparent', border: `1px solid ${confirmDel ? C.red : 'transparent'}`, borderRadius: '6px', cursor: 'pointer', padding: '4px 10px', transition: 'all 0.15s', fontFamily: "'Manrope', system-ui, sans-serif", fontWeight: confirmDel ? 600 : 400 }}
                onMouseEnter={e => { if (!confirmDel) { e.currentTarget.style.color = C.red; e.currentTarget.style.background = `${C.red}0f`; } }}
                onMouseLeave={e => { if (!confirmDel) { e.currentTarget.style.color = C.text4; e.currentTarget.style.background = 'transparent'; } }}
              >
                {confirmDel ? '¿Confirmar eliminación?' : t.projects_config_delete}
              </button>
              {confirmDel && (
                <button onClick={() => setConfirmDel(false)}
                  style={{ fontSize: '10.5px', color: C.text4, background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', padding: '0 10px', fontFamily: "'Manrope', system-ui, sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.color = C.text2)}
                  onMouseLeave={e => (e.currentTarget.style.color = C.text4)}
                >Cancelar</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={handleClose} disabled={saving}
                style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.05)')}
              >{t.btn_cancel}</button>
              <button onClick={save} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: accent, color: '#24180A', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: saving ? 0.75 : 1, transition: 'filter 0.1s' }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; }}
              >
                {saving ? t.projects_config_saving : t.projects_config_save}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Add Board Modal ───────────────────────────────────────────────────────────
function AddBoardModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const t = useT();
  const { addBoard } = useProjectStore();
  const { createBoard } = useBoardStore();
  const color = project.color || C.accent;

  const [name,    setName]    = useState('');
  const [desc,    setDesc]    = useState('');
  const [creating, setCreating] = useState(false);
  const [error,   setError]   = useState('');
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (creating) return;
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError(t.create_ws_validation_name); return; }
    setCreating(true);
    setError('');
    try {
      const board = await createBoard(project.workspaceId, { name: name.trim(), description: desc.trim() || undefined });
      await addBoard(project.id, board.id);
      handleClose();
    } catch (e: any) {
      setError(e.message || t.create_board_error);
      setCreating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)', animation: `${closing ? 'msOverlayOut' : 'msOverlayIn'} 0.2s ease forwards` }}
      onClick={handleClose}
    >
      <div
        style={{ width: '420px', maxWidth: 'calc(100vw - 32px)', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.65)', animation: closing ? 'msPanelOut 0.15s ease forwards' : 'msPanelIn 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: C.text, fontFamily: "'Sora', system-ui, sans-serif" }}>
            <LayoutDashboard style={{ ...ic(14), color }} />
            Nuevo tablero
          </span>
          <button
            onClick={handleClose}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '7px', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, transition: 'background 0.12s, color 0.12s' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = C.text; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
          >
            <X style={ic(15)} />
          </button>
        </div>

        {/* Fields */}
        <div style={{ padding: '20px 18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {[
            { label: 'Nombre *', node: (
              <input
                autoFocus value={name} onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Ej. Sprint Q3, Diseño UI, Backend API…"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const, fontFamily: "'Manrope', system-ui, sans-serif", transition: 'border-color 0.15s' }}
                onFocus={e => (e.currentTarget.style.borderColor = color)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border2)}
              />
            )},
            { label: 'Descripción', node: (
              <textarea
                value={desc} onChange={(e) => setDesc(e.target.value)} rows={2}
                placeholder="Opcional — propósito del tablero"
                style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, fontFamily: "'Manrope', system-ui, sans-serif", transition: 'border-color 0.15s' }}
                onFocus={e => (e.currentTarget.style.borderColor = color)}
                onBlur={e => (e.currentTarget.style.borderColor = C.border2)}
              />
            )},
          ].map(({ label, node }) => (
            <div key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase', fontFamily: "'Sora', system-ui, sans-serif" }}>{label}</label>
              {node}
            </div>
          ))}
          {error && <p style={{ margin: 0, fontSize: '11.5px', color: C.red }}>{error}</p>}
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button
            onClick={handleClose}
            style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer' }}
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleCreate} disabled={creating}
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: color, color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: creating ? 0.75 : 1 }}
          >
            {creating ? t.btn_creating : 'Crear tablero'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Milestone Modal ────────────────────────────────────────────────────
function CreateMilestoneModal({ projectId, color, milestone, onClose }: { projectId: string; color: string; milestone?: ProjectMilestone; onClose: () => void }) {
  const t = useT();
  const { createMilestone, updateMilestone } = useProjectStore();
  const isEdit = !!milestone;
  const [name, setName] = useState(milestone?.name ?? '');
  const [date, setDate] = useState(milestone ? new Date(milestone.date).toISOString().slice(0, 10) : '');
  const [desc, setDesc] = useState(milestone?.description ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const submit = async () => {
    if (!name.trim()) { setError('El nombre del hito es obligatorio'); return; }
    if (!date)        { setError('La fecha es obligatoria'); return; }
    setLoading(true);
    try {
      if (isEdit) {
        await updateMilestone(projectId, milestone!.id, { name: name.trim(), description: desc.trim() || null, date: new Date(date).toISOString() });
      } else {
        await createMilestone(projectId, { name: name.trim(), description: desc.trim() || undefined, date: new Date(date).toISOString() });
      }
      handleClose();
    } catch (e: any) { setError(e.message); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', animation: `${closing ? 'msOverlayOut' : 'msOverlayIn'} 0.2s ease forwards` }}
      onClick={handleClose}
    >
      <div style={{ width: '380px', maxWidth: 'calc(100vw - 32px)', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: closing ? 'msPanelOut 0.15s ease forwards' : 'msPanelIn 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: C.text }}>
            {isEdit
              ? <Pencil style={{ ...ic(14), color }} />
              : <Flag style={{ ...ic(14), color }} />}
            {isEdit ? 'Editar hito' : t.projects_milestone_new}
          </span>
          <button onClick={handleClose} style={{ color: C.text3, background: 'none', border: 'none', cursor: 'pointer' }}><X style={ic(15)} /></button>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          {[
            { label: 'Nombre *',     node: <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del hito" style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} /> },
            { label: 'Fecha *',      node: <DatePicker value={date} onChange={setDate} placeholder="Selecciona una fecha" accent={color} /> },
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
          <button onClick={handleClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer' }}>{t.btn_cancel}</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#F2571E', color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: loading ? 0.75 : 1 }}>
            {loading ? (isEdit ? t.btn_saving : t.btn_creating) : (isEdit ? t.btn_save : t.projects_milestone_create)}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes msOverlayIn  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes msOverlayOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes msPanelIn    { from { opacity: 0; transform: translateY(14px) scale(0.96) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes msPanelOut   { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(8px) scale(0.98) } }
      `}</style>
    </div>
  );
}

// ── Create Document Modal ─────────────────────────────────────────────────────
function CreateDocumentModal({ workspaceId, color, onClose, onCreated }: { workspaceId: string; color: string; onClose: () => void; onCreated: (doc: Document) => void }) {
  const t = useT();
  const { createDocument } = useDocumentStore();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  const handleClose = () => {
    if (loading) return;
    setClosing(true);
    setTimeout(onClose, 150);
  };

  const submit = async () => {
    const name = title.trim();
    if (!name) { setError('El título del documento es obligatorio'); return; }
    setLoading(true);
    try {
      const doc = await createDocument(workspaceId, { title: name });
      onCreated(doc);
    } catch (e: any) { setError(e?.message || 'No se pudo crear el documento'); setLoading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)', animation: `${closing ? 'msOverlayOut' : 'msOverlayIn'} 0.2s ease forwards` }}
      onClick={handleClose}
    >
      <div style={{ width: '400px', maxWidth: 'calc(100vw - 32px)', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.5)', animation: closing ? 'msPanelOut 0.15s ease forwards' : 'msPanelIn 0.3s cubic-bezier(0.16,1,0.3,1) both' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13.5px', fontWeight: 600, color: C.text }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/><path d="M13 3v5h5" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/></svg>
            Nuevo documento
          </span>
          <button onClick={handleClose} style={{ color: C.text3, background: 'none', border: 'none', cursor: 'pointer' }}><X style={ic(15)} /></button>
        </div>
        <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '13px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
            <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' }}>Título *</label>
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Ej. Especificación técnica"
              style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
          </div>
          {error && <p style={{ margin: 0, fontSize: '11.5px', color: C.red }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#D8D0C1', cursor: 'pointer' }}>{t.btn_cancel}</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#F2571E', color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: loading ? 0.75 : 1 }}>
            {loading ? t.btn_creating : 'Crear documento'}
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

  // ── Role-based permissions ─────────────────────────────────────────────────
  // Derived after currentProject loads (workspaceId needed to find the workspace)
  const wsRole   = workspaces.find((w) => w.id === currentProject?.workspaceId)?.userRole ?? 'VIEWER';
  const canEdit  = wsRole === 'OWNER' || wsRole === 'ADMIN';
  const isOwner  = wsRole === 'OWNER';
  const { documents, fetchDocuments } = useDocumentStore();

  const [showConfig,    setShowConfig]    = useState(false);
  const [showAddBoard,  setShowAddBoard]  = useState(false);
  const [showAddMs,     setShowAddMs]     = useState(false);
  const [showAddDoc,    setShowAddDoc]    = useState(false);
  const [editMs,        setEditMs]        = useState<ProjectMilestone | null>(null);
  const [assignedTeams, setAssignedTeams] = useState<AssignedTeam[]>([]);
  const [boardToRemove, setBoardToRemove] = useState<{ id: string; name: string } | null>(null);
  const [removingBoard, setRemovingBoard] = useState(false);
  const [activeTab,     setActiveTab]     = useState<'overview' | 'boards' | 'backlog' | 'schedule' | 'docs' | 'members' | 'activity'>('overview');
  const [activeBoardId,    setActiveBoardId]    = useState<string | null>(null);
  const [ganttRefreshTick, setGanttRefreshTick] = useState(0);
  const [members,          setMembers]          = useState<ProjectMember[]>([]);
  const [directMembers,    setDirectMembers]    = useState<DirectMember[]>([]);
  const [showInvitePanel,  setShowInvitePanel]  = useState(false);
  const [inviteSearch,     setInviteSearch]     = useState('');
  const [inviteResults,    setInviteResults]    = useState<SearchUser[]>([]);
  const [addingUserId,     setAddingUserId]     = useState<string | null>(null);
  const [activityEntries,  setActivityEntries]  = useState<ActivityEntry[]>([]);
  const [loadingActivity,  setLoadingActivity]  = useState(false);
  const [actCats,          setActCats]          = useState<Set<ActCategory>>(new Set(['milestone', 'board', 'team', 'project']));
  const [actUser,          setActUser]          = useState<string>('all');
  const [backlogCards,     setBacklogCards]     = useState<BacklogCard[]>([]);
  const [backlogLoading,   setBacklogLoading]   = useState(false);

  const linkedBoardIdsRef = useRef<Set<string>>(new Set());

  const setSelectedCard = useCardStore((s) => s.setSelectedCard);

  const TABS = [
    { key: 'overview',  label: 'Resumen'     },
    { key: 'boards',    label: 'Tableros'    },
    { key: 'backlog',   label: 'Backlog'     },
    { key: 'schedule',  label: 'Cronograma'  },
    { key: 'docs',      label: 'Documentos'  },
    { key: 'members',   label: 'Miembros'    },
    { key: 'activity',  label: 'Actividad'   },
  ] as const;

  useEffect(() => {
    fetchProjectById(projectId);
    fetchStats(projectId);
    fetchTeams();
  }, [projectId, fetchProjectById, fetchStats, fetchTeams]);

  useEffect(() => {
    apiService.get<{ teams: AssignedTeam[] }>(`/api/projects/${projectId}/teams`, true)
      .then((res) => { if (res.success && res.data) setAssignedTeams(res.data.teams); });
  }, [projectId]);

  // Documentos del workspace al que pertenece el proyecto
  useEffect(() => {
    if (currentProject?.workspaceId) fetchDocuments(currentProject.workspaceId);
  }, [currentProject?.workspaceId, fetchDocuments]);

  // Miembros — agregados desde los equipos asignados (únicos por usuario)
  useEffect(() => {
    let cancelled = false;
    if (assignedTeams.length === 0) { setMembers([]); return; }
    Promise.all(
      assignedTeams.map((tm) =>
        apiService.get<{ team: { members?: TeamMember[] } }>(`/api/teams/${tm.id}`, true)
          .then((res) => (res.success && res.data?.team.members ? res.data.team.members.map((mb) => ({ ...mb, teamName: tm.name, teamColor: tm.color })) : []))
          .catch(() => [] as ProjectMember[])
      )
    ).then((lists) => {
      if (cancelled) return;
      const byId = new Map<string, ProjectMember>();
      for (const list of lists) for (const mb of list) if (!byId.has(mb.id)) byId.set(mb.id, mb);
      setMembers(Array.from(byId.values()));
    });
    return () => { cancelled = true; };
  }, [assignedTeams]);

  // Miembros directos del proyecto
  useEffect(() => {
    apiService.get<{ members: DirectMember[] }>(`/api/projects/${projectId}/members`, true)
      .then((res) => { if (res.success && res.data) setDirectMembers(res.data.members); });
  }, [projectId]);

  // Búsqueda de usuarios para invitar (debounced, mín. 3 chars)
  useEffect(() => {
    if (inviteSearch.length < 3) { setInviteResults([]); return; }
    const timer = setTimeout(async () => {
      const res = await apiService.get<{ users: SearchUser[] }>(`/api/users/search?q=${encodeURIComponent(inviteSearch)}`, true);
      if (res.success && res.data) setInviteResults(res.data.users);
    }, 280);
    return () => clearTimeout(timer);
  }, [inviteSearch]);

  // Actividad real del proyecto desde el event store — se refresca al entrar al tab
  useEffect(() => {
    if (activeTab !== 'activity') return;
    let cancelled = false;
    setLoadingActivity(true);
    apiService.get<{ events: ActivityEntry[] }>(`/api/projects/${projectId}/activity?limit=100`, true)
      .then((res) => { if (!cancelled && res.success && res.data) setActivityEntries(res.data.events); })
      .finally(() => { if (!cancelled) setLoadingActivity(false); });
    return () => { cancelled = true; };
  }, [projectId, activeTab]);

  // Cuando el usuario cierra el board (activeBoardId → null), refrescar el Gantt
  useEffect(() => {
    if (activeBoardId === null) setGanttRefreshTick((t) => t + 1);
  }, [activeBoardId]);

  // Backlog: agrega todas las tarjetas no completadas de los tableros vinculados
  useEffect(() => {
    if (activeTab !== 'backlog' && activeTab !== 'overview') return;
    const linkedBoards = currentProject?.boards ?? [];
    if (linkedBoards.length === 0) { setBacklogCards([]); setBacklogLoading(false); return; }
    setBacklogLoading(true);
    Promise.all(
      linkedBoards.map(b =>
        apiService.get<{ board: { lists: { id: string; name: string; cards: { id: string; title: string; completed: boolean; priority: string | null; dueDate: string | null }[] }[] } }>(
          `/api/boards/${b.id}`, true
        ).then(res => {
          if (!res.success || !res.data?.board?.lists) return [] as BacklogCard[];
          return res.data.board.lists.flatMap(list =>
            list.cards
              .filter(c => !c.completed)
              .map(c => ({
                id: c.id, title: c.title,
                priority: (c.priority as BacklogCard['priority']) ?? null,
                dueDate: c.dueDate ?? null,
                boardId: b.id, boardName: b.name,
                listId: list.id, listName: list.name,
              }))
          );
        }).catch(() => [] as BacklogCard[])
      )
    ).then(results => {
      const all = results.flat();
      const pOrder: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
      all.sort((a, b) => (pOrder[a.priority ?? ''] ?? 3) - (pOrder[b.priority ?? ''] ?? 3));
      setBacklogCards(all);
    }).finally(() => setBacklogLoading(false));
  }, [activeTab, currentProject?.boards?.length, projectId]);

  // Mantener ref de boards vinculados actualizado para el handler de socket
  useEffect(() => {
    linkedBoardIdsRef.current = new Set((currentProject?.boards ?? []).map((b) => b.id));
  }, [currentProject?.boards]);

  // Tiempo real — escucha eventos del workspace y actualiza estado local
  useEffect(() => {
    if (!currentProject?.workspaceId) return;
    const wsId = currentProject.workspaceId;

    socketService.joinWorkspace(wsId);

    const handleEvent = (ev: any) => {
      const p = ev.payload ?? {};
      const isForProject =
        ev.subject?.id === projectId ||
        p.projectId    === projectId ||
        (ev.context?.boardId && linkedBoardIdsRef.current.has(ev.context.boardId));
      if (!isForProject) return;

      // Añadir al feed de actividad (dedup por id)
      const nowMs = typeof ev.timestamp === 'number' ? ev.timestamp : Date.now();
      const entry: ActivityEntry = {
        id: ev.id ?? `ws-${nowMs}-${Math.random().toString(36).slice(2, 7)}`,
        eventType: ev.type,
        payload: p,
        delta:    ev.delta,
        userId:   ev.actor?.id   ?? '',
        userName: ev.actor?.name ?? 'Usuario',
        timestamp: nowMs,
        createdAt: new Date(nowMs).toISOString(),
        targetType: ev.subject?.type,
        targetId:   ev.subject?.id,
        targetName: ev.subject?.name,
        cardId:   ev.context?.cardId,
      };
      setActivityEntries((prev) => {
        if (prev.some((e) => e.id === entry.id)) return prev;
        return [entry, ...prev];
      });

      // Actualizar estado por tipo de evento
      switch (ev.type) {
        case 'project.updated':
        case 'project.status.changed':
          fetchProjectById(projectId);
          fetchStats(projectId);
          break;

        case 'project.milestone.created':
        case 'project.milestone.updated':
        case 'project.milestone.completed':
        case 'project.milestone.missed':
        case 'project.milestone.deleted':
          fetchProjectById(projectId);
          fetchStats(projectId);
          break;

        case 'project.board.linked':
        case 'project.board.unlinked':
          fetchProjectById(projectId);
          break;

        case 'project.team.assigned':
          apiService.get<{ teams: AssignedTeam[] }>(`/api/projects/${projectId}/teams`, true)
            .then((res) => { if (res.success && res.data) setAssignedTeams(res.data.teams); });
          break;

        case 'project.team.removed': {
          const teamId = p.teamId;
          if (teamId) setAssignedTeams((prev) => prev.filter((t) => t.id !== teamId));
          break;
        }

        case 'project.member.added':
        case 'project.member.removed':
          apiService.get<{ members: DirectMember[] }>(`/api/projects/${projectId}/members`, true)
            .then((res) => { if (res.success && res.data) setDirectMembers(res.data.members); });
          break;
      }
    };

    socketService.onEvent(handleEvent);

    return () => {
      socketService.off('event', handleEvent);
    };
  }, [currentProject?.workspaceId, projectId, fetchProjectById, fetchStats]);

  async function handleAssignTeam(teamId: string) {
    await apiService.post(`/api/projects/${projectId}/teams`, { teamId }, true);
    const team = allTeams.find((t) => t.id === teamId);
    if (team) setAssignedTeams((prev) => [...prev, { id: team.id, name: team.name, color: team.color ?? null, memberCount: team.memberCount ?? 0, leadName: team.leadName ?? null }]);
  }

  async function handleRemoveTeam(teamId: string) {
    await apiService.delete(`/api/projects/${projectId}/teams/${teamId}`, true);
    setAssignedTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  async function handleAddDirectMember(userId: string) {
    setAddingUserId(userId);
    try {
      const res = await apiService.post<{ member: DirectMember }>(`/api/projects/${projectId}/members`, { userId }, true);
      if (res.success && res.data) {
        setDirectMembers((prev) => [...prev.filter((m) => m.id !== res.data!.member.id), res.data!.member]);
        setInviteSearch('');
        setInviteResults([]);
        setShowInvitePanel(false);
      }
    } finally { setAddingUserId(null); }
  }

  async function handleRemoveDirectMember(userId: string) {
    await apiService.delete(`/api/projects/${projectId}/members/${userId}`, true);
    setDirectMembers((prev) => prev.filter((m) => m.id !== userId));
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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: '#161B2E' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.08)', borderTopColor: '#F2571E', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const project    = currentProject;
  const stats      = currentStats;
  const color      = project.color || C.accent;
  const stCfg      = getStatusCfg(project.status, t);
  const progress   = stats?.progressPercent ?? project.progressPercent ?? 0;
  const workspace  = workspaces.find((w) => w.id === project.workspaceId);
  const milestones = (project.milestones ?? []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const boards     = project.boards ?? [];

  // ── Actividad del proyecto — desde el event store ─────────────────────────────
  const actUsers    = [...new Set(activityEntries.map((e) => e.userName))].sort();
  const filteredAct = activityEntries
    .filter((e) => actCats.has(eventCategory(e.eventType)))
    .filter((e) => actUser === 'all' || e.userName === actUser);
  const actGroups   = groupByMonth(filteredAct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#161B2E', overflow: 'hidden' }}>

      {/* ── HEADER (collapse wrapper) ──────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: activeBoardId ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.42s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
      <header style={{
        background: '#161B2E',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
        transform: activeBoardId ? 'translateY(-14px)' : 'translateY(0)',
        opacity: activeBoardId ? 0 : 1,
        transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
      }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '20px clamp(20px,4vw,48px) 0' }}>

          {/* Identity row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>

            {/* Project icon */}
            <span style={{
              width: '54px', height: '54px', borderRadius: '50%', flexShrink: 0,
              background: color + '1A',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <WorkspaceIcon icon={project.icon} size={24} color={color} />
            </span>

            <div style={{ flex: '1 1 360px', minWidth: 0 }}>
              {/* Name + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700, fontSize: 'clamp(1.6rem,2.8vw,2.1rem)', letterSpacing: '-0.02em', color: '#F4EEE2' }}>
                  {project.name}
                </h1>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: stCfg.color, background: stCfg.bg, padding: '5px 11px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stCfg.color }} />
                  {stCfg.label}
                </span>
              </div>

              {/* Description */}
              {project.description && (
                <p style={{ margin: '8px 0 0', fontSize: '1rem', color: '#9C9486', maxWidth: '620px', lineHeight: 1.55, fontFamily: "'Manrope', system-ui, sans-serif" }}>
                  {project.description}
                </p>
              )}
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              {/* Team overlapping avatars + add */}
              <div style={{ display: 'flex', alignItems: 'center', marginRight: '4px' }}>
                {assignedTeams.slice(0, 3).map((team, i) => (
                  <span key={team.id} title={team.name} style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    background: team.color ?? color,
                    border: '2px solid #161B2E',
                    marginLeft: i > 0 ? '-8px' : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#24180A', flexShrink: 0,
                  }}>
                    {team.name.trim()[0]?.toUpperCase()}
                  </span>
                ))}
                <span onClick={() => setActiveTab('members')} title="Gestionar miembros" style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(255,255,255,0.06)', border: '1.5px dashed rgba(255,255,255,0.2)',
                  marginLeft: assignedTeams.length > 0 ? '-8px' : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#827A6D', cursor: 'pointer',
                }}>
                  {assignedTeams.length > 3 ? `+${assignedTeams.length - 3}` : '+'}
                </span>
              </div>

              {canEdit && (
                <button onClick={() => setShowAddBoard(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F2571E', color: '#24180A', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  Nuevo tablero
                </button>
              )}

              {canEdit && (
                <button onClick={() => setShowConfig(true)} title="Configuración"
                  style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9C9486', transition: 'background 0.1s, color 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = '#E8E1D2'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; e.currentTarget.style.color = '#9C9486'; }}
                >
                  <MoreHorizontal style={ic(15)} />
                </button>
              )}
            </div>
          </div>

          {/* Progress + meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '22px', padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                <span style={{ fontSize: '13px', color: '#9C9486' }}>Progreso</span>
                <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: '#E8E1D2' }}>{progress}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '8px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, borderRadius: '8px', background: color, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {stats && stats.totalCards > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#C8BFAE' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#76A878" strokeWidth="1.7"/><path d="M9 12l2 2 4-4" stroke="#76A878" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: '13.5px' }}>{stats.completedCards}/{stats.totalCards} tareas</span>
              </div>
            )}

            {project.endDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: '#C8BFAE' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="#9C9486" strokeWidth="1.7"/><path d="M3.5 9h17M8 3.5v3M16 3.5v3" stroke="#9C9486" strokeWidth="1.7" strokeLinecap="round"/></svg>
                <span style={{ fontSize: '13.5px' }}>Entrega {fmtShort(project.endDate)}</span>
              </div>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', margin: '24px 0 0', borderBottom: '1px solid rgba(255,255,255,0.07)', flexWrap: 'wrap' }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); if (tab.key !== 'boards') setActiveBoardId(null); }}
                  style={{
                    padding: '11px 4px', margin: '0 12px -1px 0', border: 'none', background: 'transparent',
                    borderBottom: active ? '2px solid #F2571E' : '2px solid transparent',
                    fontFamily: "'Sora', system-ui, sans-serif",
                    fontWeight: 600, fontSize: '13.5px',
                    color: active ? '#F4EEE2' : '#827A6D',
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = '#C8BFAE'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = '#827A6D'; }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </header>
      </div>
      </div>

      {/* ── BODY ──────────────────────────────────────────────────────────── */}
      <style>{`
        @keyframes tabFadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
      <div
        key={activeTab}
        style={{
          flex: 1, overflowY: 'auto', width: '100%',
          maxWidth: activeBoardId ? 'none' : '1140px',
          margin: '0 auto',
          padding: activeBoardId ? '20px clamp(16px,2.5vw,32px) 0' : '26px clamp(20px,4vw,48px) 60px',
          animation: 'tabFadeIn 0.22s cubic-bezier(0.16,1,0.3,1)',
          transition: 'max-width 0.42s cubic-bezier(0.4,0,0.2,1), padding 0.42s cubic-bezier(0.4,0,0.2,1)',
        }}
      >

        {/* ── RESUMEN ──────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && (() => {
          const reached    = milestones.filter(m => m.status === 'REACHED').length;
          const upcoming   = milestones.filter(m => m.status === 'PENDING' && new Date(m.date) > new Date());
          const overdueMil = milestones.filter(m => m.status === 'PENDING' && new Date(m.date) < new Date());
          const highCount  = backlogCards.filter(c => c.priority === 'HIGH').length;

          const STAT: React.CSSProperties = {
            padding: '20px', borderRadius: '10px',
            border: '1px solid rgba(255,255,255,0.08)',
            background: 'rgba(255,255,255,0.02)',
            display: 'flex', flexDirection: 'column', gap: '8px',
          };
          const LABEL: React.CSSProperties = {
            fontSize: '11px', fontWeight: 600, letterSpacing: '0.08em',
            textTransform: 'uppercase', color: '#615846',
          };
          const VAL: React.CSSProperties = {
            fontFamily: "'Sora', system-ui, sans-serif",
            fontSize: '2rem', fontWeight: 700, lineHeight: 1,
          };

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '28px' }}>

              {/* ── Stat cards ── */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: '14px' }}>

                {/* Progreso */}
                <div style={STAT}>
                  <span style={LABEL}>Progreso</span>
                  <span style={{ ...VAL, color }}>{progress}%</span>
                  <div style={{ height: '4px', borderRadius: '4px', background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${progress}%`, background: color, borderRadius: '4px', transition: 'width 0.4s' }} />
                  </div>
                  {stats && <span style={{ fontSize: '12px', color: '#827A6D' }}>{stats.completedCards}/{stats.totalCards} tareas</span>}
                </div>

                {/* Hitos */}
                <div style={STAT}>
                  <span style={LABEL}>Hitos</span>
                  <span style={{ ...VAL, color: '#76A878' }}>
                    {reached}
                    <span style={{ fontSize: '1rem', fontWeight: 500, color: '#827A6D' }}>/{milestones.length}</span>
                  </span>
                  <span style={{ fontSize: '12px', color: overdueMil.length > 0 ? '#E05252' : '#827A6D' }}>
                    {overdueMil.length > 0
                      ? `${overdueMil.length} vencido(s)`
                      : upcoming.length > 0
                        ? `Próximo en ${Math.ceil((new Date(upcoming[0].date).getTime() - Date.now()) / 86400000)}d`
                        : 'Todos alcanzados'}
                  </span>
                </div>

                {/* Backlog */}
                <div
                  style={{ ...STAT, cursor: 'pointer' }}
                  onClick={() => setActiveTab('backlog')}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                >
                  <span style={LABEL}>Backlog</span>
                  <span style={{ ...VAL, color: '#DB8A66' }}>{backlogLoading ? '…' : backlogCards.length}</span>
                  <span style={{ fontSize: '12px', color: highCount > 0 ? '#E05252' : '#827A6D' }}>
                    {highCount > 0 ? `${highCount} alta prioridad` : 'tareas pendientes'}
                  </span>
                </div>

                {/* Equipo */}
                <div style={STAT}>
                  <span style={LABEL}>Equipo</span>
                  <span style={{ ...VAL, color: '#8C7C9E' }}>{directMembers.length + members.length}</span>
                  <span style={{ fontSize: '12px', color: '#827A6D' }}>
                    {assignedTeams.length > 0 ? `${assignedTeams.length} equipo(s)` : 'Sin equipos asignados'}
                  </span>
                </div>
              </div>

              {/* ── Dos columnas: hitos + alta prioridad ── */}
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

                {/* Próximos hitos */}
                <section style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 600, color: '#E8E1D2' }}>
                      Próximos hitos
                    </h3>
                    <button onClick={() => setActiveTab('schedule')} style={{ fontSize: '12px', color: '#827A6D', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Ver todos →
                    </button>
                  </div>
                  {upcoming.length === 0 && overdueMil.length === 0 ? (
                    <p style={{ fontSize: '13px', color: '#615846', margin: 0 }}>Sin hitos pendientes</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {[...overdueMil, ...upcoming].slice(0, 5).map(m => {
                        const d = Math.ceil((new Date(m.date).getTime() - Date.now()) / 86400000);
                        const ov = d < 0;
                        return (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '11px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)' }}>
                            <span style={{ width: '9px', height: '9px', background: ov ? '#E05252' : d <= 7 ? '#DB8A66' : '#4B607F', transform: 'rotate(45deg)', flexShrink: 0 }} />
                            <span style={{ flex: 1, fontSize: '13.5px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                            <span style={{ fontSize: '12px', color: ov ? '#E05252' : d <= 7 ? '#DB8A66' : '#827A6D', flexShrink: 0 }}>
                              {ov ? `Hace ${Math.abs(d)}d` : d === 0 ? 'Hoy' : `${d}d`}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>

                {/* Alta prioridad del backlog */}
                <section style={{ flex: '1 1 300px', minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                    <h3 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 600, color: '#E8E1D2' }}>
                      Alta prioridad
                    </h3>
                    <button onClick={() => setActiveTab('backlog')} style={{ fontSize: '12px', color: '#827A6D', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                      Ver backlog →
                    </button>
                  </div>
                  {backlogLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px 0' }}>
                      <div style={{ width: '14px', height: '14px', border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                      <span style={{ fontSize: '12.5px', color: '#827A6D' }}>Cargando…</span>
                    </div>
                  ) : highCount === 0 ? (
                    <p style={{ fontSize: '13px', color: '#615846', margin: 0 }}>Sin tareas de alta prioridad — ¡bien!</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {backlogCards.filter(c => c.priority === 'HIGH').slice(0, 5).map(c => (
                        <div key={c.id}
                          onClick={() => setSelectedCard({ id: c.id, title: c.title, listId: c.listId, position: 0, completed: false, priority: c.priority as any, createdBy: '', createdAt: '', updatedAt: '', dueDate: c.dueDate ?? undefined })}
                          style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '7px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.045)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                        >
                          <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                          <span style={{ flex: 1, fontSize: '13px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</span>
                          <span style={{ fontSize: '11.5px', color: '#615846', flexShrink: 0 }}>{c.boardName}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              </div>

              {/* ── Distribución visual ── */}
              {(stats?.totalCards ?? 0) > 0 && (
                <section>
                  <h3 style={{ margin: '0 0 14px', fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 600, color: '#E8E1D2' }}>
                    Distribución del trabajo
                  </h3>
                  <div style={{ padding: '20px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)' }}>
                    {/* Stacked bar */}
                    <div style={{ height: '12px', borderRadius: '8px', overflow: 'hidden', display: 'flex', marginBottom: '16px' }}>
                      <div style={{ width: `${progress}%`, background: color, transition: 'width 0.4s', borderRadius: progress === 100 ? '8px' : '8px 0 0 8px', flexShrink: 0 }} />
                      <div style={{ flex: 1, background: 'rgba(255,255,255,0.07)', borderRadius: progress === 0 ? '8px' : '0 8px 8px 0' }} />
                    </div>
                    {/* Leyenda */}
                    <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: color, flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', color: '#9C9486' }}>Completadas ({stats?.completedCards ?? 0})</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: 'rgba(255,255,255,0.14)', flexShrink: 0 }} />
                        <span style={{ fontSize: '12.5px', color: '#9C9486' }}>Pendientes ({(stats?.totalCards ?? 0) - (stats?.completedCards ?? 0)})</span>
                      </div>
                      {highCount > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '2px', background: '#ef4444', flexShrink: 0 }} />
                          <span style={{ fontSize: '12.5px', color: '#9C9486' }}>Alta prioridad ({highCount})</span>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

            </div>
          );
        })()}

        {/* ── TABLEROS ─────────────────────────────────────────────────────── */}
        {activeTab === 'boards' && (
          activeBoardId ? (
            <InlineBoardView
              boardId={activeBoardId}
              onBack={() => setActiveBoardId(null)}
            />
          ) : boards.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0' }}>
              <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <LayoutDashboard style={{ ...ic(24), color: '#615846' }} />
              </span>
              <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#9C9486', fontFamily: "'Sora', system-ui, sans-serif" }}>{t.projects_boards_empty}</p>
              {canEdit && (
                <button onClick={() => setShowAddBoard(true)}
                  style={{ marginTop: '4px', display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#F2571E', color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  {t.projects_boards_add}
                </button>
              )}
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' }}>
                <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486', fontFamily: "'Manrope', system-ui, sans-serif" }}>
                  {boards.length} {boards.length === 1 ? 'tablero' : 'tableros'} en este proyecto.
                </p>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
                {boards.map((board) => (
                  <BoardCard key={board.id} board={board} color={color} workspaceId={project.workspaceId}
                    onNavigate={() => setActiveBoardId(board.id)}
                    onRemove={canEdit ? () => setBoardToRemove({ id: board.id, name: board.name }) : undefined}
                  />
                ))}
                {canEdit && <NewBoardCard onClick={() => setShowAddBoard(true)} />}
              </div>
            </>
          )
        )}

        {/* ── BACKLOG ──────────────────────────────────────────────────────── */}
        {activeTab === 'backlog' && (() => {
          const PMAP = {
            HIGH:   { label: 'ALTA',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'  },
            MEDIUM: { label: 'MEDIA',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
            LOW:    { label: 'BAJA',           color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
            none:   { label: 'SIN PRIORIDAD',  color: '#827A6D', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.1)' },
          };

          return (
            <div>
              {/* Header */}
              <div style={{ marginBottom: '22px' }}>
                <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486' }}>
                  {backlogLoading
                    ? 'Cargando tareas…'
                    : backlogCards.length === 0
                      ? boards.length === 0 ? 'No hay tableros vinculados a este proyecto.' : 'No hay tareas pendientes.'
                      : `${backlogCards.length} tarea${backlogCards.length !== 1 ? 's' : ''} pendiente${backlogCards.length !== 1 ? 's' : ''} en ${boards.length} tablero${boards.length !== 1 ? 's' : ''}.`}
                </p>
                <p style={{ margin: '4px 0 0', fontSize: '12.5px', color: '#615846' }}>
                  Haz clic en cualquier tarea para ver su detalle y editarla.
                </p>
              </div>

              {/* Spinner */}
              {backlogLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', border: `2px solid rgba(255,255,255,0.1)`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: '13.5px', color: '#9C9486' }}>Cargando backlog…</span>
                </div>
              )}

              {/* Empty state */}
              {!backlogLoading && backlogCards.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px 0', borderRadius: '10px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="#615846" strokeWidth="1.7" strokeLinecap="round"/>
                      <rect x="9" y="3" width="6" height="4" rx="1" stroke="#615846" strokeWidth="1.7"/>
                      <path d="M9 12h6M9 16h4" stroke="#615846" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <p style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14.5px', fontWeight: 500, color: '#9C9486' }}>
                    {boards.length === 0 ? 'Sin tableros vinculados' : '¡Todo completado!'}
                  </p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#615846', textAlign: 'center', maxWidth: '320px' }}>
                    {boards.length === 0
                      ? 'Vincula un tablero al proyecto para ver las tareas aquí'
                      : 'No quedan tareas pendientes en los tableros de este proyecto'}
                  </p>
                </div>
              )}

              {/* Groups by priority */}
              {!backlogLoading && (['HIGH', 'MEDIUM', 'LOW', null] as const).map(priority => {
                const pKey  = priority ?? 'none';
                const group = backlogCards.filter(c => c.priority === priority);
                if (group.length === 0) return null;
                const pc = PMAP[pKey as keyof typeof PMAP];

                return (
                  <div key={pKey} style={{ marginBottom: '28px' }}>
                    {/* Group header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: pc.color, background: pc.bg, border: `1px solid ${pc.border}`, padding: '3px 11px', borderRadius: '6px' }}>
                        {pc.label}
                      </span>
                      <span style={{ fontSize: '12px', color: '#615846' }}>{group.length} tarea{group.length !== 1 ? 's' : ''}</span>
                      <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.06)' }} />
                    </div>

                    {/* Card rows */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {group.map(card => {
                        const isOverdue = !!card.dueDate && new Date(card.dueDate) < new Date();
                        return (
                          <div
                            key={card.id}
                            onClick={() => setSelectedCard({
                              id: card.id, title: card.title, listId: card.listId,
                              position: 0, completed: false,
                              priority: card.priority as any,
                              createdBy: '', createdAt: '', updatedAt: '',
                              dueDate: card.dueDate ?? undefined,
                            })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 14px', borderRadius: '8px',
                              border: '1px solid rgba(255,255,255,0.07)',
                              background: 'rgba(255,255,255,0.02)',
                              cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.045)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.16)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; }}
                          >
                            {/* Priority dot */}
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: pc.color, flexShrink: 0 }} />

                            {/* Title */}
                            <span style={{ flex: '1 1 0', minWidth: 0, fontSize: '13.5px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {card.title}
                            </span>

                            {/* Board · Lista */}
                            <span style={{ fontSize: '12px', color: '#615846', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="7" height="16" rx="1.6" stroke="#615846" strokeWidth="1.8"/>
                                <rect x="14" y="4" width="7" height="10" rx="1.6" stroke="#615846" strokeWidth="1.8"/>
                              </svg>
                              {card.boardName}
                              <span style={{ color: '#3A3530' }}>·</span>
                              {card.listName}
                            </span>

                            {/* Due date */}
                            {card.dueDate && (
                              <span style={{
                                fontSize: '12px', flexShrink: 0,
                                color: isOverdue ? '#E05252' : '#9C9486',
                                background: isOverdue ? 'rgba(224,82,82,0.1)' : 'rgba(255,255,255,0.04)',
                                padding: '2px 8px', borderRadius: '6px',
                              }}>
                                {fmtShort(card.dueDate)}
                              </span>
                            )}

                            {/* Chevron */}
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, color: '#4A4540' }}>
                              <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })()}

        {/* ── CRONOGRAMA ───────────────────────────────────────────────────── */}
        {activeTab === 'schedule' && (
          <div>
            {/* Toolbar: leyenda + nuevo hito */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486', fontFamily: "'Manrope', system-ui, sans-serif" }}>Hitos y tareas ordenados por fecha.</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', fontSize: '12px', color: '#827A6D' }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '11px', height: '11px', background: '#4B607F', transform: 'rotate(45deg)', display: 'inline-block' }} />Hito</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '16px', height: '8px', background: '#76A878', opacity: 0.85, borderRadius: '3px', display: 'inline-block' }} />Tarea</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}><span style={{ width: '2px', height: '13px', background: '#E2A07E', display: 'inline-block' }} />Hoy</span>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => setShowAddMs(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F2571E', color: '#24180A', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 4 4 12l8 8 8-8-8-8Z" stroke="#24180A" strokeWidth="1.8" strokeLinejoin="round"/></svg>
                  Nuevo hito
                </button>
              )}
            </div>

            <ProjectGantt
  projectId={projectId}
  milestones={milestones}
  color={color}
  refreshTick={ganttRefreshTick}
  boardIds={currentProject?.boards?.map(b => b.id) ?? []}
/>

            {/* Gestión de hitos */}
            {milestones.length > 0 && (
              <div style={{ marginTop: '26px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '0 0 16px' }}>
                  <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                  <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: '#C8BFAE', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', padding: '5px 14px', borderRadius: '8px' }}>Hitos</span>
                  <span style={{ flex: 1, height: '1px', background: 'rgba(255,255,255,0.07)' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {milestones.map((m) => {
                    const mc     = getMilestoneCfg(m.status, t);
                    const isPast = new Date(m.date) < new Date() && m.status === 'PENDING';
                    const msDay  = Math.ceil((new Date(m.date).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 16px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.08)', transition: 'border-color 0.1s' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)')}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)')}
                      >
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: mc.bg, border: `1.5px solid ${mc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {m.status === 'REACHED' && <Check style={{ ...ic(12), color: mc.color }} />}
                          {m.status === 'MISSED'  && <X    style={{ ...ic(12), color: mc.color }} />}
                          {m.status === 'PENDING' && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isPast ? C.red : mc.color }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: m.status === 'MISSED' ? '#827A6D' : '#E8E1D2', textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>{m.name}</p>
                          {m.description && <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#827A6D' }}>{m.description}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' }}>
                          <span style={{ fontSize: '12px', color: isPast ? C.red : '#9C9486' }}>{fmtDate(m.date)}</span>
                          {m.status === 'PENDING' && msDay > 0 && msDay <= 30 && (
                            <span style={{ fontSize: '11px', color: msDay <= 7 ? C.amber : '#615846' }}>{t.projects_time_ago_days_left(msDay)}</span>
                          )}
                          {isPast && <span style={{ fontSize: '11px', color: C.red }}>Vencido</span>}
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: mc.bg, color: mc.color, flexShrink: 0 }}>{mc.label}</span>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                            <button onClick={() => setEditMs(m)} title="Editar hito"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#827A6D' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = '#E8E1D2'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#827A6D'; }}
                            ><Pencil style={ic(11)} /></button>
                            {m.status !== 'REACHED' && (
                              <button onClick={() => updateMilestone(project.id, m.id, { status: 'REACHED' })} title="Marcar alcanzado"
                                style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.green }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${C.green}18`)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              ><Check style={ic(11)} /></button>
                            )}
                            {m.status === 'PENDING' && (
                              <button onClick={() => updateMilestone(project.id, m.id, { status: 'MISSED' })} title="Marcar perdido"
                                style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.red }}
                                onMouseEnter={e => (e.currentTarget.style.background = `${C.red}18`)}
                                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                              ><X style={ic(11)} /></button>
                            )}
                            <button onClick={() => deleteMilestone(project.id, m.id)} title="Eliminar"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#827A6D' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
                              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                            ><Trash2 style={ic(11)} /></button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── DOCUMENTOS ───────────────────────────────────────────────────── */}
        {activeTab === 'docs' && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486', fontFamily: "'Manrope', system-ui, sans-serif" }}>Documentos asociados a este proyecto.</p>
              {canEdit && (
                <button onClick={() => setShowAddDoc(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#F2571E', color: '#24180A', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  Nuevo documento
                </button>
              )}
            </div>
            {documents.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke="#615846" strokeWidth="1.7" strokeLinejoin="round"/><path d="M13 3v5h5" stroke="#615846" strokeWidth="1.7" strokeLinejoin="round"/></svg>
                </span>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#9C9486', fontFamily: "'Sora', system-ui, sans-serif" }}>Aún no hay documentos</p>
                <p style={{ margin: 0, fontSize: '12.5px', color: '#615846' }}>Crea un documento para empezar a colaborar</p>
                <button onClick={() => setShowAddDoc(true)}
                  style={{ marginTop: '6px', display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#F2571E', color: '#24180A', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif" }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  Nuevo documento
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {documents.map((d) => {
                  const author = authorName(members, d.createdBy);
                  return (
                    <div key={d.id}
                      onClick={() => router.push(`/dashboard/documents/${d.id}`)}
                      style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.02)', cursor: 'pointer', transition: 'border-color 0.1s, background 0.1s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.16)'; e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
                    >
                      <span style={{ width: '40px', height: '40px', borderRadius: '50%', background: color + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <svg width="19" height="19" viewBox="0 0 24 24" fill="none"><path d="M6 3h8l4 4v14H6V3Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/><path d="M13 3v5h5" stroke={color} strokeWidth="1.7" strokeLinejoin="round"/></svg>
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.title}</div>
                        <div style={{ fontSize: '12.5px', color: '#827A6D', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{docSnippet(d.content)}</div>
                      </div>
                      <span style={{ fontSize: '12px', color: '#827A6D', flexShrink: 0 }}>Editado {timeAgo(d.updatedAt, t)}</span>
                      <span style={{ fontSize: '12px', color: '#5C5447', width: '104px', textAlign: 'right', flexShrink: 0 }}>{docWords(d.content)}</span>
                      <span title={author} style={{ width: '26px', height: '26px', borderRadius: '50%', background: memberColor(d.createdBy), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>
                        {author.trim()[0]?.toUpperCase()}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── MIEMBROS ─────────────────────────────────────────────────────── */}
        {activeTab === 'members' && (() => {
          const allMemberIds     = new Set([...directMembers.map((m) => m.id), ...members.map((m) => m.id)]);
          const filteredResults  = inviteResults.filter((u) => !allMemberIds.has(u.id));
          const isEmpty          = directMembers.length === 0 && members.length === 0 && assignedTeams.length === 0;

          return (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: '0.98rem', color: '#9C9486', fontFamily: "'Manrope', system-ui, sans-serif" }}>Personas con acceso a este proyecto.</p>
                {canEdit && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <button
                      onClick={() => { setShowInvitePanel((p) => !p); setInviteSearch(''); setInviteResults([]); }}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, background: showInvitePanel ? `${C.accent}10` : C.surface, border: `1px solid ${showInvitePanel ? C.accent : C.border2}`, color: showInvitePanel ? C.accent : C.text2, cursor: 'pointer', transition: 'border-color 0.15s, color 0.15s, background 0.15s' }}
                      onMouseEnter={(e) => { if (!showInvitePanel) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; e.currentTarget.style.background = `${C.accent}10`; } }}
                      onMouseLeave={(e) => { if (!showInvitePanel) { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; e.currentTarget.style.background = C.surface; } }}
                    >
                      <UserPlus style={ic(11)} />
                      Invitar persona
                    </button>
                    <TeamSelector
                      projectId={projectId}
                      assigned={assignedTeams}
                      allTeams={(allTeams as any[]).map((tm) => ({ id: tm.id, name: tm.name, color: tm.color ?? null, memberCount: tm.memberCount ?? 0, leadName: tm.leadName ?? null }))}
                      onAssign={handleAssignTeam}
                      onRemove={handleRemoveTeam}
                    />
                  </div>
                )}
              </div>

              {/* Invite panel */}
              {showInvitePanel && canEdit && (
                <div style={{ marginBottom: '20px', padding: '14px 16px', borderRadius: '10px', border: `1px solid ${C.border2}`, background: C.surface, animation: 'invitePanelIn 0.2s cubic-bezier(0.16,1,0.3,1)' }}>
                  <style>{`@keyframes invitePanelIn { from { opacity:0; transform:translateY(-6px) } to { opacity:1; transform:translateY(0) } }`}</style>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <input
                      type="text"
                      value={inviteSearch}
                      onChange={(e) => setInviteSearch(e.target.value)}
                      placeholder="Email del usuario…"
                      autoFocus
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: `1px solid ${C.border2}`, background: '#1B2237', color: C.text, fontSize: '13px', fontFamily: "'Manrope', system-ui, sans-serif", outline: 'none', minWidth: 0 }}
                    />
                    <button
                      onClick={() => { setShowInvitePanel(false); setInviteSearch(''); setInviteResults([]); }}
                      style={{ padding: '7px 12px', borderRadius: '6px', border: `1px solid ${C.border2}`, background: 'transparent', color: C.text3, fontSize: '12.5px', fontWeight: 500, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'color 0.13s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
                    >Cancelar</button>
                  </div>
                  {inviteSearch.length >= 3 && filteredResults.length === 0 && (
                    <p style={{ margin: '10px 0 0', fontSize: '12.5px', color: C.text4, fontFamily: "'Manrope', system-ui, sans-serif" }}>Sin resultados para "{inviteSearch}"</p>
                  )}
                  {filteredResults.length > 0 && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '8px' }}>
                      {filteredResults.map((u) => (
                        <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 10px', borderRadius: '7px', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: memberColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>
                            {u.name.trim()[0]?.toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{u.name}</div>
                            <div style={{ fontSize: '12px', color: C.text3 }}>{u.email}</div>
                          </div>
                          <button
                            onClick={() => handleAddDirectMember(u.id)}
                            disabled={addingUserId === u.id}
                            style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: C.accent, color: '#24180A', fontSize: '12px', fontWeight: 600, cursor: addingUserId === u.id ? 'default' : 'pointer', fontFamily: "'Manrope', system-ui, sans-serif", opacity: addingUserId === u.id ? 0.6 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.13s' }}
                          >
                            {addingUserId === u.id ? '…' : 'Agregar'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Empty state */}
              {isEmpty && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0', borderRadius: '8px', border: '1px dashed rgba(255,255,255,0.1)' }}>
                  <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users style={{ ...ic(22), color: '#615846' }} />
                  </span>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: '#9C9486', fontFamily: "'Sora', system-ui, sans-serif" }}>Sin miembros todavía</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: '#615846' }}>Invita personas o asigna un equipo para dar acceso al proyecto</p>
                </div>
              )}

              {/* Direct members */}
              {directMembers.length > 0 && (
                <div style={{ marginBottom: members.length > 0 ? '20px' : 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#615846', marginBottom: '8px', padding: '0 2px' }}>Invitados directamente</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {directMembers.map((m) => {
                      const roleLbl = m.role === 'ADMIN' ? 'Admin' : m.role === 'VIEWER' ? 'Lector' : 'Miembro';
                      return (
                        <div key={m.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '11px 14px', borderRadius: '8px', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: memberColor(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#24180A', flexShrink: 0 }}>
                            {m.name.trim()[0]?.toUpperCase()}
                          </span>
                          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: '#E8E1D2' }}>{m.name}</span>
                              <span style={{ fontSize: '11px', fontWeight: 600, color: '#9C9486', background: 'rgba(255,255,255,0.06)', padding: '2px 9px', borderRadius: '8px' }}>{roleLbl}</span>
                              <span style={{ fontSize: '11px', color: '#DB8A66', background: 'rgba(219,138,102,0.1)', padding: '2px 8px', borderRadius: '8px' }}>Directo</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: '#827A6D', marginTop: '2px' }}>{m.email}</div>
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleRemoveDirectMember(m.id)}
                              title="Quitar del proyecto"
                              style={{ padding: '5px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#4A4540', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.12s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#E5705A')}
                              onMouseLeave={(e) => (e.currentTarget.style.color = '#4A4540')}
                            >
                              <X style={{ width: '15px', height: '15px' }} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Team members */}
              {(members.length > 0 || (assignedTeams.length > 0 && !isEmpty)) && (
                <div>
                  {directMembers.length > 0 && (
                    <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: '#615846', marginBottom: '8px', padding: '0 2px' }}>Por equipo</div>
                  )}
                  {members.length === 0 ? (
                    <p style={{ margin: 0, fontSize: '13px', color: '#615846', padding: '12px 2px' }}>{assignedTeams.length === 0 ? 'Aún no hay equipos asignados' : 'Sin miembros en los equipos'}</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                      {members.map((m) => {
                        const online   = !!m.workload?.lastActivity && (Date.now() - new Date(m.workload.lastActivity).getTime()) < 5 * 60000;
                        const roleLbl  = m.role === 'ADMIN' ? 'Admin' : m.role === 'VIEWER' ? 'Lector' : 'Miembro';
                        const statusTx = online ? 'En línea' : m.workload?.lastActivity ? `Activo ${timeAgo(m.workload.lastActivity, t)}` : 'Sin actividad';
                        return (
                          <div key={m.id}
                            style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 14px', borderRadius: '8px', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span style={{ position: 'relative', flexShrink: 0 }}>
                              <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: memberColor(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#24180A' }}>
                                {m.name.trim()[0]?.toUpperCase()}
                              </span>
                              {online && <span style={{ position: 'absolute', right: '-1px', bottom: '-1px', width: '11px', height: '11px', borderRadius: '50%', background: '#76A878', border: '2px solid #161B2E' }} />}
                            </span>
                            <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '14.5px', fontWeight: 600, color: '#E8E1D2' }}>{m.name}</span>
                                <span style={{ fontSize: '11px', fontWeight: 600, color: '#9C9486', background: 'rgba(255,255,255,0.06)', padding: '2px 9px', borderRadius: '8px' }}>{roleLbl}</span>
                                <span style={{ fontSize: '11px', color: '#615846' }}>· {m.teamName}</span>
                              </div>
                              <div style={{ fontSize: '12.5px', color: '#827A6D', marginTop: '3px' }}>{m.email}</div>
                            </div>
                            <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#8B8275', flexShrink: 0 }}>
                              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: online ? '#76A878' : '#5C5447' }} />
                              {statusTx}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ACTIVIDAD ────────────────────────────────────────────────────── */}
        {activeTab === 'activity' && (
          <div style={{ display: 'flex', gap: '22px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            {/* Filtros */}
            <aside style={{ flex: '0 0 220px', maxWidth: '100%', border: `1px solid ${C.border2}`, borderRadius: '8px', background: C.surface, padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z" stroke={C.accent} strokeWidth="1.8" strokeLinejoin="round"/></svg>
                <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: C.text }}>Filtros</span>
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4, marginBottom: '9px' }}>Categoría</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '18px' }}>
                {([['milestone', 'Hitos'], ['board', 'Tableros'], ['team', 'Equipos y miembros'], ['project', 'Proyecto']] as [ActCategory, string][]).map(([key, label]) => {
                  const on = actCats.has(key);
                  return (
                    <div key={key}
                      onClick={() => setActCats((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '7px', cursor: 'pointer', userSelect: 'none', background: on ? 'rgba(242,87,30,0.08)' : 'transparent', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', border: `2px solid ${on ? C.accent : C.border2}`, background: on ? C.accent : 'transparent', flexShrink: 0, transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2.5" stroke="#24180A" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <span style={{ fontSize: '12.5px', fontWeight: 500, color: on ? C.text : C.text3 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4, marginBottom: '9px' }}>Persona</div>
              <select value={actUser} onChange={(e) => setActUser(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${C.border2}`, background: '#1B2237', color: C.text2, fontFamily: "'Manrope', system-ui, sans-serif", fontSize: '12.5px', outline: 'none' }}
              >
                <option value="all">Todos</option>
                {actUsers.map((name) => <option key={name} value={name}>{name}</option>)}
              </select>
            </aside>

            {/* Timeline */}
            <div style={{ flex: '1 1 440px', minWidth: 0 }}>
              {loadingActivity ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: '10px' }}>
                  <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${C.border2}`, borderTopColor: C.accent, animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: '13px', color: C.text3 }}>Cargando actividad…</span>
                </div>
              ) : actGroups.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '60px 0' }}>
                  <span style={{ display: 'inline-flex', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border2}`, alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke={C.text4} strokeWidth="1.6"/><path d="M12 7v5l3 2" stroke={C.text4} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </span>
                  <p style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", color: C.text3 }}>Sin actividad registrada aún</p>
                  <p style={{ margin: '6px 0 0', fontSize: '12.5px', color: C.text4 }}>Las acciones en este proyecto aparecerán aquí</p>
                </div>
              ) : (
                <>
                  {actGroups.map((g) => (
                    <div key={g.month}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', margin: '0 0 16px' }}>
                        <span style={{ flex: 1, height: '1px', background: C.border2 }} />
                        <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '12px', fontWeight: 600, color: C.text2, background: C.surface, border: `1px solid ${C.border2}`, padding: '4px 12px', borderRadius: '8px', textTransform: 'capitalize' }}>{g.month}</span>
                        <span style={{ flex: 1, height: '1px', background: C.border2 }} />
                      </div>
                      {g.days.map((dy) => (
                        <div key={dy.day} style={{ marginBottom: '24px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 10px 2px' }}>
                            <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '11.5px', fontWeight: 600, color: C.text, textTransform: 'capitalize' }}>{dy.day}</span>
                            <span style={{ width: '3px', height: '3px', borderRadius: '50%', background: C.text4 }} />
                            <span style={{ fontSize: '11.5px', color: C.text3 }}>{dy.events.length} {dy.events.length === 1 ? 'evento' : 'eventos'}</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {dy.events.map((ev) => {
                              const desc = describeEvent(ev);
                              const hour = new Date(ev.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
                              return (
                                <div key={ev.id}
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${C.border2}`, borderLeft: `3px solid ${desc.accent}`, background: 'rgba(255,255,255,0.018)', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.035)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.018)')}
                                >
                                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: memberColor(ev.userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: 700, color: '#24180A' }}>
                                    {ev.userName.trim()[0]?.toUpperCase()}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13.5px', color: C.text2, lineHeight: 1.55 }}>
                                      <strong style={{ color: C.text, fontWeight: 600 }}>{ev.userName}</strong>
                                      {' '}{desc.verb}{' '}
                                      {desc.target && <strong style={{ color: desc.accent, fontWeight: 600 }}>{desc.target}</strong>}
                                      {' '}en <span style={{ color: C.text3 }}>{project.name}</span>
                                    </div>
                                    <div style={{ fontSize: '11.5px', color: C.text4, marginTop: '4px' }}>{hour} · {timeAgo(ev.createdAt, t)}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div style={{ textAlign: 'center', padding: '6px 0 2px', fontSize: '11.5px', color: C.text4 }}>Fin del historial</div>
                </>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── MODALS ──────────────────────────────────────────────────────────── */}
      {showConfig   && <ConfigModal            project={project}   onClose={() => setShowConfig(false)} />}
      {showAddBoard && <AddBoardModal          project={project}   onClose={() => setShowAddBoard(false)} />}
      {showAddMs    && <CreateMilestoneModal   projectId={project.id} color={color} onClose={() => setShowAddMs(false)} />}
      {editMs       && <CreateMilestoneModal   projectId={project.id} color={color} milestone={editMs} onClose={() => setEditMs(null)} />}
      {showAddDoc   && <CreateDocumentModal    workspaceId={project.workspaceId} color={color} onClose={() => setShowAddDoc(false)} onCreated={(doc) => router.push(`/dashboard/documents/${doc.id}`)} />}

      {/* ── Modal confirmar quitar board ─────────────────────────────────────── */}
      {boardToRemove && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={() => { if (!removingBoard) setBoardToRemove(null); }}
        >
          <div
            style={{ width: '380px', maxWidth: 'calc(100vw - 32px)', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
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

      {/* CardDetailModal lives at page level so it's accessible from both boards and cronograma tabs */}
      <CardDetailModal />
    </div>
  );
}

// ── Board Card ────────────────────────────────────────────────────────────────
function BoardCard({ board, color, workspaceId, onNavigate, onRemove }: {
  board: ProjectBoard;
  color: string;
  workspaceId: string;
  onNavigate: () => void;
  onRemove?: () => void;
}) {
  const t = useT();
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onNavigate}
      style={{
        width: '100%', height: '100%', minHeight: '168px',
        display: 'flex', flexDirection: 'column',
        borderRadius: '10px',
        border: `1px solid ${hov ? color + '55' : 'rgba(255,255,255,0.08)'}`,
        background: hov ? 'rgba(255,255,255,0.045)' : 'rgba(255,255,255,0.02)',
        overflow: 'hidden', position: 'relative', cursor: 'pointer',
        transition: 'border-color 0.15s, background 0.15s, box-shadow 0.15s, transform 0.15s',
        boxShadow: hov ? '0 8px 24px rgba(0,0,0,0.28)' : 'none',
        transform: hov ? 'translateY(-2px)' : 'none',
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {/* 8px colored top stripe */}
      <div style={{ height: '8px', background: color, flexShrink: 0 }} />

      <div style={{ padding: '18px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Circle icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: color + '22', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="7" height="16" rx="1.6" stroke={color} strokeWidth="1.8"/>
              <rect x="14" y="4" width="7" height="10" rx="1.6" stroke={color} strokeWidth="1.8"/>
            </svg>
          </span>
          <div style={{ minWidth: 0, paddingRight: hov ? '28px' : 0, transition: 'padding 0.15s' }}>
            <div style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '15.5px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {board.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <p style={{ margin: '13px 0 0', fontSize: '12.5px', color: '#827A6D', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '37px' }}>
          {board.description || 'Sin descripción'}
        </p>

        {/* Footer: editado + abrir */}
        <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#5C5447' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#5C5447" strokeWidth="1.7"/><path d="M12 7.5v5l3 2" stroke="#5C5447" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
            {timeAgo(board.updatedAt, t)}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', fontWeight: 600, fontFamily: "'Sora', system-ui, sans-serif", color, opacity: hov ? 1 : 0, transform: hov ? 'translateX(0)' : 'translateX(-4px)', transition: 'opacity 0.15s, transform 0.15s' }}>
            Abrir
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </span>
        </div>
      </div>

      {/* Remove on hover */}
      {hov && onRemove && (
        <button onClick={(e) => { e.stopPropagation(); onRemove(); }}
          style={{ position: 'absolute', top: '16px', right: '14px', width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#E05252', zIndex: 2 }}
          title="Quitar del proyecto"
        >
          <X style={ic(11)} />
        </button>
      )}
    </div>
  );
}

// ── New Board Card (dashed) ───────────────────────────────────────────────────
function NewBoardCard({ onClick }: { onClick: () => void }) {
  const [hov, setHov] = useState(false);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: '100%', height: '100%', minHeight: '168px',
        borderRadius: '10px',
        border: `1.5px dashed ${hov ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.14)'}`,
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: hov ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={hov ? '#E8E1D2' : '#615846'} strokeWidth="2" strokeLinecap="round"/></svg>
      </span>
      <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 600, color: hov ? '#C8BFAE' : '#615846', transition: 'color 0.15s' }}>
        Nuevo tablero
      </span>
    </div>
  );
}
