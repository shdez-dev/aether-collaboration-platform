'use client';

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useProjectStore, type Project, type ProjectMilestone, type ProjectBoard, type ProjectMaturityStage } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import { useTeamStore } from '@/stores/teamStore';
import { useDocumentStore } from '@/stores/documentStore';
import type { Document } from '@aether/types';
import { apiService } from '@/services/apiService';
import { projectApi, type ProjectActivityEntry as ActivityEntry, type ProjectDirectMember as DirectMember, type ProjectTeam as AssignedTeam, type ProjectTeamMember } from '@/features/projects/api';
import { ProjectDocumentsTab } from '@/features/projects/components/ProjectDocumentsTab';
import { ProjectTeamSelector } from '@/features/projects/components/ProjectTeamSelector';
import { socketService } from '@/services/socketService';
import { useT } from '@/lib/i18n';
import {
  Plus, X, Check, Trash2, AlertCircle, Flag,
  LayoutDashboard, Settings, MoreHorizontal,
  Calendar, Users, GitBranch, Pencil, UserPlus,
} from 'lucide-react';
import { C } from '@/lib/colors';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { ProjectAppearanceModal } from '@/components/ProjectAppearanceModal';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import { InlineBoardView } from '@/components/InlineBoardView';
import { CardDetailModal } from '@/components/CardDetailModal';
import { useCardStore } from '@/stores/cardStore';
import { useTimelineStore } from '@/stores/timelineStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import type { Card } from '@aether/types';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStatusCfg(status: string, t: ReturnType<typeof useT>) {
  switch (status) {
    case 'ACTIVE':    return { label: t.projects_status_active,    color: '#9271BD', bg: 'rgba(116,82,166,0.12)',   border: 'rgba(116,82,166,0.25)'   };
    case 'PLANNING':  return { label: t.projects_status_planning,  color: 'var(--c-text2)', bg: 'rgba(97,71,130,0.06)', border: 'rgba(97,71,130,0.12)' };
    case 'ON_HOLD':   return { label: t.projects_status_on_hold,   color: '#A97556', bg: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.25)' };
    case 'COMPLETED': return { label: t.projects_status_completed, color: '#548B73', bg: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.25)' };
    case 'ARCHIVED':  return { label: t.projects_status_cancelled, color: 'var(--c-text3)', bg: 'rgba(97,71,130,0.05)', border: 'rgba(97,71,130,0.10)' };
    default:          return { label: status,                       color: 'var(--c-text3)', bg: 'rgba(97,71,130,0.05)', border: 'rgba(97,71,130,0.10)' };
  }
}

function getMaturityCfg(stage: ProjectMaturityStage) {
  switch (stage) {
    case 'IDEA':       return { label: 'Idea', color: '#8D84B0', bg: 'rgba(123,143,168,0.14)', border: 'rgba(123,143,168,0.28)' };
    case 'DRAFT':      return { label: 'Borrador', color: '#AA895E', bg: 'rgba(196,168,110,0.14)', border: 'rgba(196,168,110,0.26)' };
    case 'FORMALIZED': return { label: 'Formalizado', color: '#548B73', bg: 'rgba(118,168,120,0.14)', border: 'rgba(118,168,120,0.26)' };
    case 'PLANNED':    return { label: 'Planificado', color: '#8076A7', bg: 'rgba(75,96,127,0.14)', border: 'rgba(75,96,127,0.28)' };
    case 'ACTIVE':     return { label: 'En ejecución', color: '#9271BD', bg: 'rgba(116,82,166,0.14)', border: 'rgba(116,82,166,0.28)' };
    case 'ON_HOLD':    return { label: 'En pausa', color: '#A97556', bg: 'rgba(219,138,102,0.14)', border: 'rgba(219,138,102,0.28)' };
    case 'COMPLETED':  return { label: 'Completado', color: '#548B73', bg: 'rgba(118,168,120,0.14)', border: 'rgba(118,168,120,0.26)' };
    case 'ARCHIVED':   return { label: 'Archivado', color: 'var(--c-text3)', bg: 'rgba(97,71,130,0.06)', border: 'rgba(97,71,130,0.12)' };
    default:           return { label: stage, color: 'var(--c-text3)', bg: 'rgba(97,71,130,0.06)', border: 'rgba(97,71,130,0.12)' };
  }
}

function getHealthCfg(score: number, t: ReturnType<typeof useT>) {
  if (score >= 70) return { label: t.projects_health_good,     color: '#548B73', bg: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.25)' };
  if (score >= 40) return { label: t.projects_health_at_risk,  color: '#A97556', bg: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.25)' };
  return              { label: t.projects_health_critical,      color: '#B45C72', bg: 'rgba(224,82,82,0.12)',   border: 'rgba(224,82,82,0.25)'   };
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
type ActCategory = 'milestone' | 'board' | 'document' | 'team' | 'project';

type ActGroup = { month: string; days: { day: string; events: ActivityEntry[] }[] };

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
  if (type.startsWith('document.')) return 'document';
  if (type.startsWith('team.') || type.startsWith('project.member') || type.startsWith('workspace.member')) return 'team';
  if (
    type.startsWith('sprint')  || type.startsWith('board')  ||
    type.startsWith('list')    || type.startsWith('card')   ||
    type.startsWith('comment') || type.startsWith('checklist') ||
    type.startsWith('project.board')
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

function describeEvent(ev: ActivityEntry): { verb: string; target: string; accent: string; detail?: string } {
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
    case 'project.created':             return { verb: 'creó el proyecto',              target: tn,                          accent: '#8076A7' };
    case 'project.updated': {
      const labels: Record<string, string> = {
        description: 'resumen', icon: 'icono', color: 'color', maturityStage: 'madurez',
        problemStatement: 'problemática', impactedPeople: 'personas impactadas',
        problemImpact: 'impacto', impactedCount: 'cantidad de personas impactadas',
        expectedOutcome: 'propuesta de valor', proposedSolution: 'solución',
        differentiation: 'diferenciación', nextStep: 'siguiente paso',
        startDate: 'fecha de inicio', endDate: 'fecha de fin',
      };
      const fields = Array.isArray(p.changedFields) ? p.changedFields.filter((field: unknown): field is string => typeof field === 'string') : [];
      if (fields.length === 1 && fields[0] === 'name')
        return { verb: 'renombró el proyecto a', target: tn, accent: '#8076A7' };
      const names = fields.filter((field: string) => field !== 'name').map((field: string) => labels[field]).filter(Boolean);
      if (names.length === 1)
        return { verb: `actualizó ${names[0]} del proyecto`, target: tn, accent: '#8076A7' };
      if (names.length > 1)
        return { verb: `actualizó ${names.slice(0, -1).join(', ')} y ${names[names.length - 1]} del proyecto`, target: tn, accent: '#8076A7' };
      return { verb: 'editó el proyecto', target: tn, accent: '#8076A7' };
    }
    case 'project.workflow.changed': {
      const stages: Record<string, string> = { INTAKE: 'Recepción', DIAGNOSIS: 'Diagnóstico', VALIDATION: 'Validación', PREPARATION: 'Preparación', EXECUTION: 'Ejecución', CLOSURE: 'Cierre', PAUSED: 'En pausa', DECLINED: 'Rechazada' };
      const stage = String(p.toStage ?? '');
      return { verb: `movió el proyecto «${tn}» a la etapa`, target: stages[stage] ?? stage, accent: '#8076A7' };
    }
    case 'project.status.changed':      return { verb: `cambió el estado de «${tn}» a`, target: statusLabel(p.newStatus),    accent: '#A97556' };
    case 'project.deleted':             return { verb: 'eliminó el proyecto',           target: tn,                          accent: '#AE7C9B' };
    case 'project.board.linked':        return { verb: 'vinculó el tablero',            target: p.boardName ?? tn,           accent: '#AA895E' };
    case 'project.board.unlinked':      return { verb: 'desvinculó el tablero',         target: p.boardName ?? tn,           accent: 'var(--c-text4)' };
    case 'project.milestone.created':   return { verb: 'creó el hito',                 target: tn,                          accent: '#8076A7' };
    case 'project.milestone.completed': return { verb: 'completó el hito',             target: tn,                          accent: '#548B73' };
    case 'project.milestone.missed':    return { verb: 'marcó como perdido el hito',   target: tn,                          accent: '#AE7C9B' };
    case 'project.milestone.deleted':   return { verb: 'eliminó el hito',              target: tn,                          accent: 'var(--c-text4)' };
    case 'project.milestone.updated':   return { verb: 'actualizó el hito',            target: tn,                          accent: '#8076A7' };
    case 'project.team.assigned':       return { verb: `asignó al proyecto «${tn}» el equipo`, target: p.teamName ?? '', accent: '#8262B2' };
    case 'project.team.removed':        return { verb: `quitó del proyecto «${tn}» el equipo`, target: p.teamName ?? '', accent: 'var(--c-text4)' };
    case 'project.member.added':        return { verb: `añadió al proyecto «${tn}» a`, target: p.memberName ?? '', accent: '#548B73' };
    case 'project.member.removed':      return { verb: `quitó del proyecto «${tn}» a`, target: p.memberName ?? '', accent: '#AE7C9B' };

    // ── Sprints ─────────────────────────────────────────────────────────────
    case 'sprint.created':              return { verb: 'creó el sprint',               target: spr,                         accent: '#8D84B0' };
    case 'sprint.started':              return { verb: 'inició el sprint',             target: spr,                         accent: '#548B73' };
    case 'sprint.completed':            return { verb: 'completó el sprint',           target: spr,                         accent: '#AA895E' };
    case 'sprint.card.added':           return { verb: `añadió «${tn || card}» al sprint`, target: spr,                    accent: '#8D84B0' };
    case 'sprint.card.removed':         return { verb: `quitó «${tn || card}» del sprint`, target: spr,                    accent: 'var(--c-text4)' };

    // ── Tablero ─────────────────────────────────────────────────────────────
    case 'board.created':               return { verb: 'creó el tablero',              target: tn,                          accent: '#8076A7' };
    case 'board.updated':               return { verb: 'editó el tablero',             target: tn,                          accent: '#8076A7' };
    case 'board.deleted':               return { verb: 'eliminó el tablero',           target: tn,                          accent: '#AE7C9B' };
    case 'board.archived':              return { verb: 'archivó el tablero',           target: tn,                          accent: 'var(--c-text4)' };
    case 'board.restored':              return { verb: 'restauró el tablero',          target: tn,                          accent: '#548B73' };

    // ── Listas ──────────────────────────────────────────────────────────────
    case 'list.created':                return { verb: 'creó la lista',                target: tn,                          accent: '#8076A7' };
    case 'list.updated':                return { verb: 'renombró la lista a',          target: tn,                          accent: '#8076A7' };
    case 'list.deleted':                return { verb: 'eliminó la lista',             target: tn,                          accent: '#AE7C9B' };
    case 'list.archived':               return { verb: 'archivó la lista',             target: tn,                          accent: 'var(--c-text4)' };
    case 'list.order-changed':          return { verb: 'reordenó las listas',          target: '',                          accent: 'var(--c-text4)' };

    // ── Tarjetas ─────────────────────────────────────────────────────────────
    case 'card.created':                return { verb: 'creó la tarjeta',              target: tn,                          accent: '#548B73' };
    case 'card.updated': {
      const d = ev.delta;
      if (d?.before?.title !== undefined)
        return { verb: `renombró «${String(d.before.title)}» a`, target: String(d.after?.title ?? tn), accent: '#8076A7' };
      if ('description' in (d?.before ?? {}))
        return { verb: 'actualizó la descripción de', target: tn, accent: '#8076A7' };
      if ('startDate' in (d?.before ?? {}) || 'startDate' in (d?.after ?? {}))
        return { verb: 'cambió la fecha de inicio de', target: tn, accent: '#8D84B0' };
      if ('milestoneId' in (d?.before ?? {}))
        return { verb: 'cambió el hito de', target: tn, accent: '#AA895E' };
      if ('bufferDays' in (d?.before ?? {}))
        return { verb: 'ajustó el buffer de tiempo de', target: tn, accent: '#8D84B0' };
      return { verb: 'editó la tarjeta', target: tn, accent: '#8076A7' };
    }
    case 'card.deleted':                return { verb: 'eliminó la tarjeta',           target: tn,                          accent: '#AE7C9B' };
    case 'card.archived':               return { verb: 'archivó la tarjeta',           target: tn,                          accent: 'var(--c-text4)' };
    case 'card.restored':               return { verb: 'restauró la tarjeta',          target: tn,                          accent: '#548B73' };
    case 'card.moved': {
      const from = (ev.delta?.before as any)?.listName as string | undefined;
      const to   = (ev.delta?.after  as any)?.listName as string | undefined;
      return from && to
        ? { verb: `movió «${tn}» de «${from}» a`, target: to, accent: '#AA895E' }
        : { verb: 'movió la tarjeta', target: tn, accent: '#AA895E' };
    }
    case 'card.status-changed': {
      const completed = (ev.delta?.after as any)?.completed;
      return completed
        ? { verb: 'completó la tarjeta', target: tn, accent: '#548B73' }
        : { verb: 'reabrió la tarjeta',  target: tn, accent: '#A97556' };
    }
    case 'card.priority.changed': {
      const after = (ev.delta?.after as any)?.priority as string | undefined;
      return after
        ? { verb: `cambió la prioridad de «${tn}» a`, target: priorityLabel(after), accent: '#AA895E' }
        : { verb: 'cambió la prioridad de',            target: tn,                  accent: '#AA895E' };
    }
    case 'card.due-date.set':           return { verb: 'puso fecha límite en',         target: tn,                          accent: '#A97556' };
    case 'card.due-date.removed':       return { verb: 'quitó la fecha límite de',     target: tn,                          accent: 'var(--c-text4)' };

    // ── Miembros de tarjeta ──────────────────────────────────────────────────
    case 'card.member.assigned':
      return card
        ? { verb: `asignó a «${mem}» en`, target: card, accent: '#8262B2' }
        : { verb: 'asignó a',              target: mem,  accent: '#8262B2' };
    case 'card.member.removed':
      return card
        ? { verb: `quitó a «${mem}» de`, target: card, accent: 'var(--c-text4)' }
        : { verb: 'quitó a',              target: mem,  accent: 'var(--c-text4)' };

    // ── Etiquetas ────────────────────────────────────────────────────────────
    case 'card.label.added':
      return card
        ? { verb: `añadió la etiqueta «${lbl}» en`, target: card, accent: '#AA895E' }
        : { verb: 'añadió la etiqueta',               target: lbl,  accent: '#AA895E' };
    case 'card.label.removed':
      return card
        ? { verb: `quitó la etiqueta «${lbl}» de`, target: card, accent: 'var(--c-text4)' }
        : { verb: 'quitó la etiqueta',               target: lbl,  accent: 'var(--c-text4)' };

    // ── Dependencias ─────────────────────────────────────────────────────────
    case 'card.dependency.added':
      return bked
        ? { verb: `bloqueó «${bked}» hasta completar`, target: bking, accent: '#8262B2' }
        : { verb: 'añadió dependencia en',              target: bking, accent: '#8262B2' };
    case 'card.dependency.removed':
      return bked
        ? { verb: `desbloqueó «${bked}» de`, target: bking, accent: '#548B73' }
        : { verb: 'quitó dependencia de',     target: bking, accent: 'var(--c-text4)' };

    // ── Comentarios ──────────────────────────────────────────────────────────
    case 'comment.created':
      return card
        ? { verb: 'comentó en la tarjeta', target: card, accent: '#8D84B0', detail: tn }
        : { verb: 'publicó un comentario', target: '', accent: '#8D84B0', detail: tn };
    case 'comment.updated':
      return card
        ? { verb: `editó un comentario en`,     target: card, accent: '#8076A7' }
        : { verb: 'editó un comentario',         target: '',   accent: '#8076A7' };
    case 'comment.deleted':
      return card
        ? { verb: `eliminó un comentario en`,   target: card, accent: '#AE7C9B' }
        : { verb: 'eliminó un comentario',       target: '',   accent: '#AE7C9B' };
    case 'comment.mention-added':
      return { verb: `mencionó a ${String(p.mentionedUserName || 'una persona')} en un comentario`, target: card ? `de ${card}` : '', accent: '#8262B2' };

    // ── Documentos del proyecto ────────────────────────────────────────────
    case 'document.created':            return { verb: 'creó el documento', target: tn, accent: '#8076A7' };
    case 'document.updated':            return { verb: 'editó el documento', target: tn, accent: '#8076A7' };
    case 'document.deleted':            return { verb: 'eliminó el documento', target: tn, accent: '#AE7C9B' };
    case 'document.version.saved':      return { verb: 'guardó una versión del documento', target: tn, accent: '#8076A7' };
    case 'document.version.restored':   return { verb: 'restauró una versión del documento', target: tn, accent: '#548B73' };
    case 'document.exported':           return { verb: 'exportó el documento', target: tn, accent: '#8076A7' };
    case 'document.permission.changed': return { verb: 'cambió los permisos del documento', target: tn, accent: '#8262B2' };
    case 'document.comment.added':      return { verb: 'comentó en el documento', target: tn, accent: '#8D84B0' };
    case 'document.comment.resolved':   return { verb: 'resolvió un comentario del documento', target: tn, accent: '#548B73' };

    // ── Subtareas (checklist) ─────────────────────────────────────────────────
    case 'checklist.created':            return { verb: 'creó checklist en',            target: tn,  accent: '#8076A7' };
    case 'checklist.deleted':            return { verb: 'eliminó checklist en',         target: tn,  accent: '#AE7C9B' };
    case 'checklist.item.created':
      return card
        ? { verb: `añadió la subtarea «${item}» en`, target: card, accent: '#548B73' }
        : { verb: 'añadió subtarea',                  target: item, accent: '#548B73' };
    case 'checklist.item.updated':
      return card
        ? { verb: `renombró la subtarea «${item}» en`, target: card, accent: '#8076A7' }
        : { verb: 'actualizó subtarea',                 target: item, accent: '#8076A7' };
    case 'checklist.item.deleted':
      return card
        ? { verb: `eliminó la subtarea «${item}» de`, target: card, accent: '#AE7C9B' }
        : { verb: 'eliminó subtarea',                  target: item, accent: '#AE7C9B' };
    case 'checklist.item.status-changed': {
      const checked = (ev.delta?.after as any)?.checked as boolean | undefined;
      return card
        ? (checked
            ? { verb: `completó la subtarea «${item}» en`, target: card, accent: '#548B73' }
            : { verb: `desmarcó la subtarea «${item}» en`, target: card, accent: '#A97556' })
        : (checked
            ? { verb: 'completó la subtarea', target: item, accent: '#548B73' }
            : { verb: 'desmarcó la subtarea', target: item, accent: '#A97556' });
    }

    default: return { verb: `registró el evento «${ev.eventType}»`, target: tn || '', accent: 'var(--c-text4)' };
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
  completed: boolean;
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
  projectId, milestones, color, refreshTick, projectBoards,
}: {
  projectId: string;
  milestones: ProjectMilestone[];
  color: string;
  refreshTick?: number;
  projectBoards?: ProjectBoard[];
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
  const boardIdsKey = (projectBoards ?? []).map((board) => board.id).join(',');
  const boardNamesRef = useRef<Map<string, string>>(new Map());
  boardNamesRef.current = new Map((projectBoards ?? []).map((board) => [board.id, board.name]));
  useEffect(() => {
    const ids = boardIdsKey ? boardIdsKey.split(',') : [];
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
        const fetchedBoardIds = [...new Set([...boardIdsKey.split(',').filter(Boolean), ...fetched.map((c) => c.boardId)])];
        const cardIdSet = new Set(fetched.map((c) => c.id));

        // Fetch dependency edges + sprints in parallel per board
        const edges: { blockingCardId: string; blockedCardId: string }[] = [];
        const allSprints: SprintItem[] = [];
        await Promise.all(fetchedBoardIds.map(async (bid) => {
          const boardName = boardNamesRef.current.get(bid) ?? fetched.find((c) => c.boardId === bid)?.boardName ?? '';
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
  }, [projectId, refreshTick, internalTick, timelineVersion, boardIdsKey]);

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
    ...boardSprints.flatMap((s) => [s.startDate, s.endDate].map((d) => new Date(d).getTime())),
  ];

  if (allDates.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '32px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
        <Calendar style={{ width: '22px', height: '22px', color: C.text4 }} />
        <p style={{ margin: 0, fontSize: '12.5px', color: C.text3 }}>Sin fechas asignadas</p>
        <p style={{ margin: 0, fontSize: '11.5px', color: C.text4, textAlign: 'center', maxWidth: '280px' }}>
          Asigna fechas a un hito, sprint o tarjeta para ver la línea de tiempo.
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
  const SECTION_H = 34;
  const SIDEBAR_W = 238;
  const MONTH_H   = 34;
  const DAY_H     = DAY_W >= 20 ? 36 : 28;
  const HEADER_H  = MONTH_H + DAY_H;
  // Actual rendered row heights (used for dependency line geometry)
  const GANTT_MONTH_H   = MONTH_H;
  const GANTT_WEEK_H    = DAY_H;
  const GANTT_ROW_H_ACT = ROW_H;

  function showTip(e: React.MouseEvent, tip: TooltipState) {
    setTooltip({ ...tip, x: e.clientX, y: e.clientY });
  }

  type Row =
    | { kind: 'section'; label: string; icon: 'flag' | 'board' | 'sprint' }
    | { kind: 'sprint'; s: SprintItem }
    | { kind: 'milestone'; m: ProjectMilestone }
    | { kind: 'card'; card: TimelineCard; rowIdx: number };

  const SPRINT_ROW_H = 40;

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
          background: C.surface, border: `1px solid ${C.border2}`, boxShadow: '0 4px 16px rgba(48,32,74,0.12)',
          borderRadius: 6, padding: '3px 8px',
          fontSize: '10.5px', color: C.text3,
          pointerEvents: 'none',
        }}>
          <div style={{ width: 9, height: 9, border: '1.5px solid rgba(97,71,130,0.2)', borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite', flexShrink: 0 }} />
          Actualizando
        </div>
      )}
      {/* Custom scrollbar para el Gantt */}
      <style>{`
        .dshScroll { scrollbar-width: thin; scrollbar-color: rgba(97,71,130,0.18) transparent; }
        .dshScroll::-webkit-scrollbar { height: 10px; width: 10px; }
        .dshScroll::-webkit-scrollbar-track { background: transparent; margin: 0 8px; }
        .dshScroll::-webkit-scrollbar-thumb {
          background: linear-gradient(90deg, rgba(97,71,130,0.14), rgba(97,71,130,0.2));
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
          background: 'var(--c-surface)', border: `1px solid ${C.border2}`,
          borderRadius: '8px', padding: '10px 13px',
          boxShadow: '0 10px 30px rgba(48,32,74,0.16)',
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

      <div className="dshScroll" style={{ overflowX: 'auto', border: `1px solid ${C.border}`, borderRadius: '11px', background: C.surface }}>
        <div style={{ width: `${SIDEBAR_W + TRACK_W}px`, minWidth: '100%', position: 'relative' }}>

          {/* ── Header (month + days) ──────────────────────────────── */}
          {(() => {
            const DOW_ES = ['D','L','M','X','J','V','S'];
            const showDow = DAY_W >= 20;
            const DAY_HDR_H = DAY_H;
            const step = DAY_W < 14 ? 7 : DAY_W < 20 ? 3 : 1;
            return (
              <>
                {/* Month row */}
                <div style={{ display: 'flex', background: C.bg2, borderBottom: `1px solid ${C.border}` }}>
                  <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: C.bg2, borderRight: `1px solid ${C.border}`, height: `${MONTH_H}px`, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                    <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text3 }}>Elemento</span>
                  </div>
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${MONTH_H}px` }}>
                    {monthCols.map((mc2, i) => (
                      <div key={i} style={{ position: 'absolute', top: 0, bottom: 0, left: mc2.x, width: mc2.width, borderLeft: i > 0 ? `1px solid ${C.border}` : 'none', display: 'flex', alignItems: 'center', paddingLeft: '12px', overflow: 'hidden' }}>
                        <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.04em', color: C.text2, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{mc2.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Day row */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 11, background: C.surface, borderRight: `1px solid ${C.border}`, height: `${DAY_HDR_H}px`, display: 'flex', alignItems: 'center', padding: '0 16px', color: C.text4, fontSize: '11px' }}>Vista diaria</div>
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
                              ? '1px solid rgba(97,71,130,0.12)'
                              : isWeekend
                                ? '1px solid rgba(97,71,130,0.05)'
                                : '1px solid rgba(97,71,130,0.03)',
                            background: isToday
                              ? 'rgba(209,131,96,0.16)'
                              : isWeekend
                                ? 'rgba(97,71,130,0.02)'
                                : 'transparent',
                            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px',
                          }}
                        >
                          {showLabel && showDow && (
                            <span style={{ fontSize: '8.5px', fontWeight: 600, color: isToday ? '#B66B4E' : isWeekend ? C.text4 : C.text3, lineHeight: 1, userSelect: 'none' }}>
                              {DOW_ES[dow]}
                            </span>
                          )}
                          {showLabel && (
                            isToday ? (
                              <span style={{ width: DAY_W - 6, height: DAY_W - 6, maxWidth: '20px', maxHeight: '20px', minWidth: '13px', minHeight: '13px', borderRadius: '50%', background: '#D18360', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ fontSize: DAY_W < 14 ? '8px' : '10px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1, userSelect: 'none' }}>{d.getDate()}</span>
                              </span>
                            ) : (
                              <span style={{ fontSize: DAY_W < 14 ? '9px' : '10px', fontWeight: isWeekend ? 500 : 600, color: isWeekend ? C.text4 : C.text2, lineHeight: 1, userSelect: 'none' }}>
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
                    background: isToday ? 'rgba(226,160,126,0.07)' : 'rgba(97,71,130,0.018)',
                  }} />
                );
              })}
            </div>


            {/* ── Sprint background bands ─────────────────────────── */}
            {boardSprints.map((s) => {
              const sx = dayX(new Date(s.startDate));
              const ex = dayX(new Date(s.endDate));
              const bw = Math.max(0, ex - sx);
              const bc = s.status === 'ACTIVE' ? '#548B73' : 'var(--c-text2)';
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
                  <svg viewBox="0 0 12 12" fill="none" stroke="var(--c-text3)" strokeWidth="1.5" strokeLinecap="round" width="11" height="11" style={{ flexShrink: 0 }}>
                    <path d="M2 8.5a4 4 0 1 1 8 0M2 8.5l1.3-2M10 8.5l-1.3-2"/>
                  </svg>
                );
                return (
                  <div key={rIdx} style={{ display: 'flex', borderTop: `1px solid ${C.border}`, background: C.bg2 }}>
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: C.bg2, borderRight: `1px solid ${C.border}`, height: `${SECTION_H}px`, display: 'flex', alignItems: 'center', gap: '8px', padding: '0 16px' }}>
                      {row.icon === 'flag'
                        ? <Flag style={{ width: '11px', height: '11px', color: 'var(--c-text3)', flexShrink: 0 }} />
                        : row.icon === 'sprint'
                          ? <SprintIcon />
                          : <LayoutDashboard style={{ width: '11px', height: '11px', color: 'var(--c-text3)', flexShrink: 0 }} />}
                      <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.06em', color: C.text2, textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.label}</span>
                    </div>
                    <div style={{ flex: 'none', width: `${TRACK_W}px`, height: `${SECTION_H}px` }} />
                  </div>
                );
              }

              // ── Sprint row ──
              if (row.kind === 'sprint') {
                const { s } = row;
                const sColor = s.status === 'ACTIVE' ? '#548B73' : 'var(--c-text2)';
                const sLabel = s.status === 'ACTIVE' ? 'Activo' : 'Planificado';
                const sx = dayX(new Date(s.startDate));
                const ex = dayX(new Date(s.endDate));
                const barW = Math.max(DAY_W * 2, ex - sx);
                const fmtS = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
                return (
                  <div key={s.id} style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    {/* Sidebar */}
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: C.surface, borderRight: `1px solid ${C.border}`, height: `${SPRINT_ROW_H}px`, display: 'flex', alignItems: 'center', gap: '9px', padding: '0 14px' }}>
                      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: sColor, flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontSize: '12px', fontWeight: 650, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.25 }}>{s.name}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{s.boardName}</span>
                      </span>
                    </div>
                    {/* Track */}
                    <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${SPRINT_ROW_H}px` }}>
                      <div
                        style={{
                          position: 'absolute', left: sx, top: '50%', transform: 'translateY(-50%)',
                          width: barW, height: '14px', borderRadius: '7px',
                          background: s.status === 'ACTIVE' ? `${sColor}cc` : `${sColor}55`,
                          border: `1px solid ${sColor}60`,
                          display: 'flex', alignItems: 'center', overflow: 'hidden',
                          cursor: 'default',
                        }}
                        onMouseEnter={(e) => showTip(e, {
                          title: s.name,
                          subtitle: `${sLabel} - ${s.boardName}`,
                          color: sColor,
                          range: `${fmtS(s.startDate)} → ${fmtS(s.endDate)}`,
                          x: e.clientX, y: e.clientY,
                        })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        {/* Sprint name label inside bar (if bar is wide enough) */}
                        {barW > 70 && (
                          <span style={{ fontSize: '9px', fontWeight: 700, color: s.status === 'ACTIVE' ? '#FFFFFF' : C.text, paddingLeft: '8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', userSelect: 'none' }}>
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
                const dotColor = isPast ? C.red : m.status === 'REACHED' ? C.green : (m.color || '#8076A7');
                const mx       = dayX(new Date(m.date));
                return (
                  <div key={m.id} style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: C.surface, borderRight: `1px solid ${C.border}`, height: `${ROW_H}px`, display: 'flex', alignItems: 'center', gap: '10px', padding: '0 16px' }}>
                      <span style={{ width: '9px', height: '9px', background: dotColor, transform: 'rotate(45deg)', flexShrink: 0 }} />
                      <span style={{ minWidth: 0 }}>
                        <span style={{ display: 'block', fontFamily: "'Sora', system-ui, sans-serif", fontSize: '12px', fontWeight: 600, color: m.status === 'MISSED' ? 'var(--c-text4)' : 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>{m.name}</span>
                        <span style={{ display: 'block', fontSize: '10px', color: C.text3 }}>{fmtShort(m.date)}</span>
                      </span>
                    </div>
                    <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${ROW_H}px` }}>
                      <div
                        style={{ position: 'absolute', left: mx, top: '50%', transform: 'translate(-50%, -50%)', cursor: 'pointer' }}
                        onMouseEnter={(e) => showTip(e, { title: m.name, subtitle: m.description ?? '', color: dotColor, date: `📅 ${fmtDate(m.date)}`, x: e.clientX, y: e.clientY })}
                        onMouseMove={(e) => setTooltip((tt) => tt ? { ...tt, x: e.clientX, y: e.clientY } : null)}
                        onMouseLeave={() => setTooltip(null)}
                      >
                        <span style={{ display: 'block', width: '14px', height: '14px', background: dotColor, transform: 'rotate(45deg)', border: `2px solid ${C.surface}`, borderRadius: '3px', boxShadow: `0 0 0 1px ${dotColor}88` }} />
                      </div>
                    </div>
                  </div>
                );
              }

              // ── Task row (card) ──
              const { card } = row;
              const hasRange  = !!(card.startDate && card.dueDate);
              const barColor  = card.completed ? C.green : (PRIORITY_COLOR[card.priority ?? ''] ?? '#548B73');
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
                <div key={card.id} className="ganttRow" style={{ display: 'flex', borderTop: `1px solid ${C.border}` }}>
                  {/* Sidebar — clickable to open detail */}
                  <button
                    onClick={() => handleCardClick(card)}
                    style={{ flex: 'none', width: `${SIDEBAR_W}px`, position: 'sticky', left: 0, zIndex: 10, background: C.surface, borderRight: `1px solid ${C.border}`, height: `${ROW_H}px`, display: 'flex', alignItems: 'center', gap: '9px', padding: '0 14px', border: 'none', cursor: 'pointer', textAlign: 'left' }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = C.surface; }}
                  >
                    <span style={{ width: '19px', height: '19px', borderRadius: '50%', background: barColor, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8.5px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>{who}</span>
                    <span style={{ minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '11.5px', fontWeight: 600, color: card.completed ? C.text4 : C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: card.completed ? 'line-through' : 'none', lineHeight: 1.3 }}>{card.title}</span>
                      <span style={{ display: 'block', fontSize: '10px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.2 }}>{card.boardName}</span>
                    </span>
                  </button>
                  <div style={{ position: 'relative', flex: 'none', width: `${TRACK_W}px`, height: `${ROW_H}px` }}>
                    {hasRange && startX !== null ? (
                      <>
                        {/* Main bar */}
                        <div
                          style={{ position: 'absolute', left: startX, top: '50%', transform: 'translateY(-50%)', width: barPx, height: '11px', borderRadius: bufPx > 0 ? '6px 0 0 6px' : '6px', background: card.completed ? `${barColor}77` : barColor, cursor: 'pointer', boxShadow: isOverdue ? `0 0 0 1.5px ${C.red}88` : 'none', transition: 'filter 0.12s', zIndex: 1 }}
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
                              width: bufPx, height: '11px', borderRadius: '0 6px 6px 0',
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

type ProjectMember = ProjectTeamMember;
type SearchUser    = { id: string; name: string; email: string; avatar?: string | null; };

const MEMBER_PALETTE = ['#7452A6', '#548B73', '#8076A7', '#A97556', '#8262B2', '#AA895E'];
function memberColor(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return MEMBER_PALETTE[h % MEMBER_PALETTE.length];
}

// ── Team Selector Popover ─────────────────────────────────────────────────────

function LegacyTeamSelector({ projectId, assigned, allTeams, onAssign, onRemove }: {
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

function datePopupPosition(rect: DOMRect) {
  const popupWidth = 274;
  const popupHeight = Math.min(310, window.innerHeight - 24);
  const preferredTop = window.innerHeight - rect.bottom < popupHeight + 12 && rect.top > popupHeight + 12
    ? rect.top - popupHeight - 6
    : rect.bottom + 6;
  return {
    left: Math.max(12, Math.min(rect.left, window.innerWidth - popupWidth - 12)),
    top: Math.max(12, Math.min(preferredTop, window.innerHeight - popupHeight - 12)),
  };
}

function DatePicker({ value, onChange, placeholder = 'Sin fecha', accent = '#7452A6' }: {
  value: string; onChange: (v: string) => void; placeholder?: string; accent?: string;
}) {
  const today = new Date();
  const parsed = value ? new Date(value + 'T00:00:00') : null;
  const [open,      setOpen]      = useState(false);
  const [viewYear,  setViewYear]  = useState(parsed?.getFullYear()  ?? today.getFullYear());
  const [viewMonth, setViewMonth] = useState(parsed?.getMonth()     ?? today.getMonth());
  const ref = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [popupPosition, setPopupPosition] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!open) return;
    const placePopup = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPopupPosition(datePopupPosition(rect));
    };
    placePopup();
    window.addEventListener('resize', placePopup);
    window.addEventListener('scroll', placePopup, true);
    return () => {
      window.removeEventListener('resize', placePopup);
      window.removeEventListener('scroll', placePopup, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      const target = e.target as Node;
      if (!ref.current?.contains(target) && !popupRef.current?.contains(target)) setOpen(false);
    };
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
      <button ref={triggerRef} type="button" onClick={(event) => {
        setPopupPosition(datePopupPosition(event.currentTarget.getBoundingClientRect()));
        setOpen(v => !v);
      }}
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
      {open && createPortal(
        <div ref={popupRef} style={{ position: 'fixed', top: popupPosition.top, left: popupPosition.left, zIndex: 60, background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: '10px', boxShadow: '0 16px 48px rgba(0,0,0,0.3)', padding: '12px', width: 'min(274px, calc(100vw - 24px))', maxHeight: 'calc(100dvh - 24px)', overflowY: 'auto', animation: 'dpIn 0.15s cubic-bezier(0.16,1,0.3,1)' }}>
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
                  style={{ width: '32px', height: '32px', borderRadius: '7px', border: 'none', background: sel ? accent : 'transparent', color: sel ? '#FFFFFF' : isCurr ? C.text : C.text4, fontSize: '12.5px', fontWeight: sel || tod ? 700 : 400, cursor: isCurr ? 'pointer' : 'default', outline: !sel && tod ? `2px solid ${accent}` : 'none', outlineOffset: '-1px', opacity: !isCurr ? 0.28 : 1, transition: 'background 0.1s', boxSizing: 'border-box' as const }}
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
            <button type="button" onClick={() => { onChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`); setOpen(false); }}
              style={{ fontSize: '11px', color: C.text3, background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: "'Manrope', system-ui, sans-serif", transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = C.text)}
              onMouseLeave={e => (e.currentTarget.style.color = C.text3)}
            >Hoy</button>
          </div>
        </div>, document.body
      )}
    </div>
  );
}

// ── ConfigModal ───────────────────────────────────────────────────────────────
function ConfigModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const { updateProject, deleteProject } = useProjectStore();
  const { removeSidebarProject } = useActiveWorkspaceStore();
  const router = useRouter();

  const [name,    setName]    = useState(project.name);
  const [desc,    setDesc]    = useState(project.description ?? '');
  const [problem, setProblem] = useState(project.problemStatement ?? '');
  const [impactedPeople, setImpactedPeople] = useState(project.impactedPeople ?? '');
  const [problemImpact, setProblemImpact] = useState(project.problemImpact ?? '');
  const [impactedCount, setImpactedCount] = useState(project.impactedCount?.toString() ?? '');
  const [expectedOutcome, setExpectedOutcome] = useState(project.expectedOutcome ?? '');
  const [proposedSolution, setProposedSolution] = useState(project.proposedSolution ?? '');
  const [differentiation, setDifferentiation] = useState(project.differentiation ?? '');
  const [nextStep, setNextStep] = useState(project.nextStep ?? '');
  const [status,  setStatus]  = useState(project.status);
  const [maturityStage, setMaturityStage] = useState<ProjectMaturityStage>(project.maturityStage ?? 'IDEA');
  const [start,   setStart]   = useState(project.startDate?.slice(0, 10) ?? '');
  const [end,     setEnd]     = useState(project.endDate?.slice(0, 10) ?? '');
  const [saving,  setSaving]  = useState(false);
  const [saveError, setSaveError] = useState('');
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
    if ((name !== project.name && name.trim().length > 120) || (desc !== (project.description ?? '') && desc.trim().length > 1000)) {
      setSaveError('El nombre admite hasta 120 caracteres y el resumen hasta 1000.');
      return;
    }
    const parsedImpactedCount = impactedCount.trim() ? Number(impactedCount) : null;
    if (parsedImpactedCount !== null && (!Number.isInteger(parsedImpactedCount) || parsedImpactedCount < 1 || parsedImpactedCount > 1_000_000_000)) {
      setSaveError('La cantidad de personas debe ser un número entero mayor que cero.');
      return;
    }
    setSaving(true);
    setSaveError('');
    try {
      await updateProject(project.id, {
        ...(name !== project.name ? { name: name.trim() } : {}),
        ...(desc !== (project.description ?? '') ? { description: desc.trim() || null } : {}),
        problemStatement: problem.trim() || null,
        impactedPeople: impactedPeople.trim() || null,
        problemImpact: problemImpact.trim() || null,
        impactedCount: parsedImpactedCount,
        expectedOutcome: expectedOutcome.trim() || null,
        proposedSolution: proposedSolution.trim() || null,
        differentiation: differentiation.trim() || null,
        nextStep: nextStep.trim() || null,
        status: status as any,
        maturityStage,
        startDate: start || null,
        endDate: end || null,
      });
      handleClose();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo guardar el proyecto. Inténtalo de nuevo.');
    } finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDel) { setConfirmDel(true); return; }
    await deleteProject(project.id);
    removeSidebarProject(project.id);
    router.push('/dashboard/projects');
  };

  const accent = project.color || C.accent;
  const LBL = ({ children }: { children: React.ReactNode }) => (
    <label style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, textTransform: 'uppercase' as const, display: 'block', marginBottom: '5px', fontFamily: "'Sora', system-ui, sans-serif" }}>{children}</label>
  );
  const fieldStyle: React.CSSProperties = { width: '100%', padding: '9px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.14s', fontFamily: "'Manrope', system-ui, sans-serif" };
  const textAreaStyle: React.CSSProperties = { ...fieldStyle, resize: 'vertical', lineHeight: 1.55 };
  const sectionStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12, padding: 14, borderRadius: 10, border: `1px solid ${C.border}`, background: 'rgba(97,71,130,0.018)' };
  const sectionHeadingStyle: React.CSSProperties = { margin: 0, color: C.text, fontSize: 12.5, fontWeight: 700, fontFamily: "'Sora', system-ui, sans-serif" };
  const sectionDescriptionStyle: React.CSSProperties = { margin: '3px 0 0', color: C.text4, fontSize: 11, lineHeight: 1.45 };
  const twoColumnStyle: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 230px), 1fr))', gap: 12 };
  const statusLabelsEs: Record<string, string> = { PLANNING: 'Planificación', ACTIVE: 'En ejecución', ON_HOLD: 'En pausa', COMPLETED: 'Completado', ARCHIVED: 'Archivado' };

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
          style={{ width: '100%', maxWidth: '680px', maxHeight: 'calc(100vh - 32px)', display: 'flex', flexDirection: 'column', background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 32px 80px rgba(0,0,0,0.65)', animation: closing ? 'cfgPanOut 0.18s ease forwards' : 'cfgPanIn 0.28s cubic-bezier(0.16,1,0.3,1) both' }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${C.border}` }}>
            <div>
              <span style={{ fontSize: '13.5px', fontWeight: 600, color: C.text, fontFamily: "'Sora', system-ui, sans-serif" }}>Editar proyecto</span>
              <p style={{ margin: '3px 0 0', color: C.text4, fontSize: 11 }}>Actualiza el contexto, impacto y propuesta que aparecen en el resumen.</p>
            </div>
            <button onClick={handleClose} style={{ width: '26px', height: '26px', borderRadius: '6px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.12s, color 0.12s' }}
              onMouseEnter={e => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
            ><X style={ic(14)} /></button>
          </div>

          {/* Body */}
          <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', minHeight: 0, flex: '1 1 auto' }}>

            {/* Nombre */}
            <div>
              <LBL>Nombre</LBL>
              <input value={name} maxLength={Math.max(120, project.name.length)} onChange={(e) => setName(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.14s', fontFamily: "'Manrope', system-ui, sans-serif" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
              <small style={{ display: 'block', textAlign: 'right', color: name.length > 120 ? C.red : C.text4 }}>{name.length}/120</small>
            </div>

            <div>
              <LBL>Resumen del proyecto</LBL>
              <textarea value={desc} maxLength={Math.max(1000, (project.description ?? '').length)} onChange={(e) => setDesc(e.target.value)} rows={3}
                placeholder="Resume la oportunidad que se está explorando."
                style={textAreaStyle}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
              <small style={{ display: 'block', textAlign: 'right', color: desc.length > 1000 ? C.red : C.text4 }}>{desc.length}/1000</small>
            </div>

            <section style={sectionStyle}>
              <div><h3 style={sectionHeadingStyle}>Contexto</h3><p style={sectionDescriptionStyle}>La necesidad que da origen al proyecto.</p></div>
              <div>
                <LBL>Problemática identificada</LBL>
                <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={3}
                  placeholder="Describe la necesidad y la situación actual, sin adelantar la solución."
                  style={textAreaStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                />
              </div>
            </section>

            <section style={sectionStyle}>
              <div><h3 style={sectionHeadingStyle}>Impacto</h3><p style={sectionDescriptionStyle}>A quién afecta y qué consecuencias tiene.</p></div>
              <div style={twoColumnStyle}>
                <div>
                  <LBL>Personas impactadas</LBL>
                  <textarea value={impactedPeople} onChange={(e) => setImpactedPeople(e.target.value)} rows={2}
                    placeholder="Grupos o perfiles afectados."
                    style={textAreaStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                  />
                </div>
                <div>
                  <LBL>Impacto de la problemática</LBL>
                  <textarea value={problemImpact} onChange={(e) => setProblemImpact(e.target.value)} rows={2}
                    placeholder="Consecuencias para las personas o la organización."
                    style={textAreaStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                  />
                </div>
              </div>
              <div style={{ maxWidth: 250 }}>
                <LBL>Cantidad aproximada de personas</LBL>
                <input type="number" min={1} max={1_000_000_000} step={1} value={impactedCount} onChange={(e) => setImpactedCount(e.target.value)} placeholder="Ejemplo: 120"
                  style={fieldStyle}
                  onFocus={e => (e.currentTarget.style.borderColor = accent)}
                  onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                />
              </div>
            </section>

            <section style={sectionStyle}>
              <div><h3 style={sectionHeadingStyle}>Propuesta</h3><p style={sectionDescriptionStyle}>El cambio que se busca y cómo alcanzarlo.</p></div>
              <div style={{ display: 'grid', gap: 12 }}>
                <div>
                  <LBL>Propuesta de valor</LBL>
                  <textarea value={expectedOutcome} onChange={(e) => setExpectedOutcome(e.target.value)} rows={2}
                    placeholder="Qué cambio se espera lograr y cómo podría medirse."
                    style={textAreaStyle}
                    onFocus={e => (e.currentTarget.style.borderColor = accent)}
                    onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                  />
                </div>
                <div style={twoColumnStyle}>
                  <div>
                    <LBL>Solución</LBL>
                    <textarea value={proposedSolution} onChange={(e) => setProposedSolution(e.target.value)} rows={2}
                      placeholder="En qué consiste la solución propuesta."
                      style={textAreaStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                    />
                  </div>
                  <div>
                    <LBL>Diferenciación</LBL>
                    <textarea value={differentiation} onChange={(e) => setDifferentiation(e.target.value)} rows={2}
                      placeholder="Qué la hace distinta o mejor que las alternativas."
                      style={textAreaStyle}
                      onFocus={e => (e.currentTarget.style.borderColor = accent)}
                      onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
                    />
                  </div>
                </div>
              </div>
            </section>

            <div>
              <LBL>Siguiente paso explícito</LBL>
              <textarea value={nextStep} onChange={(e) => setNextStep(e.target.value)} rows={2}
                placeholder="Próxima acción concreta para mover el proyecto"
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', fontSize: '12.5px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', resize: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.14s', fontFamily: "'Manrope', system-ui, sans-serif" }}
                onFocus={e => (e.currentTarget.style.borderColor = accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>

            {saveError && <p role="alert" style={{ margin: 0, padding: '9px 11px', borderRadius: 7, border: `1px solid ${C.red}55`, background: `${C.red}12`, color: C.red, fontSize: 11.5 }}>{saveError}</p>}

            {/* Estado */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
              <LBL>Estado</LBL>
              <ProjectOptionSelect label="Estado" value={status} onChange={value => setStatus(value as Project['status'])} options={(['PLANNING','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'] as const).map(s => ({ value: s, label: statusLabelsEs[s] }))} />
              </div>
              <div>
                <LBL>Madurez</LBL>
                <ProjectOptionSelect label="Madurez" value={maturityStage} onChange={value => setMaturityStage(value as ProjectMaturityStage)} options={(['IDEA','DRAFT','FORMALIZED','PLANNED','ACTIVE','ON_HOLD','COMPLETED','ARCHIVED'] as const).map(stage => ({ value: stage, label: getMaturityCfg(stage).label }))} />
              </div>
            </div>

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <LBL>Fecha de inicio</LBL>
                <DatePicker value={start} onChange={setStart} placeholder="Inicio" accent={accent} />
              </div>
              <div>
                <LBL>Fecha de término</LBL>
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
                {confirmDel ? '¿Confirmar eliminación?' : 'Eliminar proyecto'}
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
                style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)', color: 'var(--c-text2)', cursor: 'pointer', transition: 'background 0.1s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.09)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.05)')}
              >Cancelar</button>
              <button onClick={save} disabled={saving}
                style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: accent, color: '#FFFFFF', border: 'none', cursor: saving ? 'not-allowed' : 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: saving ? 0.75 : 1, transition: 'filter 0.1s' }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = ''; }}
              >
                {saving ? 'Guardando...' : 'Guardar'}
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
  const { recordCreatedBoard } = useProjectStore();
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
      const board = await createBoard(project.workspaceId, { name: name.trim(), description: desc.trim() || undefined, projectId: project.id });
      recordCreatedBoard(project.id, board);
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
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(97,71,130,0.06)'; e.currentTarget.style.color = C.text; }}
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
            style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)', color: 'var(--c-text2)', cursor: 'pointer' }}
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleCreate} disabled={creating}
            style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: color, color: '#FFFFFF', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: creating ? 0.75 : 1 }}
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
          <button onClick={handleClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)', color: 'var(--c-text2)', cursor: 'pointer' }}>{t.btn_cancel}</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#7452A6', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: loading ? 0.75 : 1 }}>
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
function CreateDocumentModal({ workspaceId, projectId, color, onClose, onCreated }: { workspaceId: string; projectId: string; color: string; onClose: () => void; onCreated: (doc: Document) => void }) {
  const t = useT();
  const { createDocument } = useDocumentStore();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
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
      const doc = await createDocument(workspaceId, { title: name, description: description.trim(), projectId });
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
            <input autoFocus value={title} maxLength={180} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }} placeholder="Ej. Especificación técnica"
              style={{ width: '100%', padding: '9px 11px', borderRadius: '7px', fontSize: '13px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', boxSizing: 'border-box' as const }} />
            <small style={{ textAlign: 'right', color: C.text4 }}>{title.length}/180</small>
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5, color: C.text3, fontSize: 11 }}>
            Descripción (opcional)
            <textarea value={description} maxLength={300} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="¿De qué trata este documento?" style={{ padding: '9px 11px', borderRadius: 7, background: C.bg2, border: `1px solid ${C.border2}`, color: C.text, resize: 'vertical' }} />
            <small style={{ textAlign: 'right', color: C.text4 }}>{description.length}/300</small>
          </label>
          {error && <p style={{ margin: 0, fontSize: '11.5px', color: C.red }}>{error}</p>}
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', padding: '12px 18px', borderTop: `1px solid ${C.border}` }}>
          <button onClick={handleClose} style={{ padding: '9px 16px', borderRadius: '8px', fontSize: '13px', background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)', color: 'var(--c-text2)', cursor: 'pointer' }}>{t.btn_cancel}</button>
          <button onClick={submit} disabled={loading} style={{ padding: '9px 18px', borderRadius: '8px', fontSize: '13.5px', fontWeight: 600, background: '#7452A6', color: '#FFFFFF', border: 'none', cursor: 'pointer', fontFamily: "'Sora', system-ui, sans-serif", opacity: loading ? 0.75 : 1 }}>
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

  const { currentProject, currentStats, fetchProjectById, fetchStats, updateMilestone, deleteMilestone, removeBoard, adoptCurrentStandard } = useProjectStore();
  const { workspaces, currentProjectStandard, fetchProjectStandard } = useWorkspaceStore();
  const { teams: allTeams, fetchTeams } = useTeamStore();

  // ── Role-based permissions ─────────────────────────────────────────────────
  // Derived after currentProject loads (workspaceId needed to find the workspace)
  const canEdit  = currentProject?.access?.canManage === true;
  const isOwner  = currentProject?.access?.canManage === true;
  const { documents, fetchProjectDocuments } = useDocumentStore();

  const [showConfig,    setShowConfig]    = useState(false);
  const [showAppearance, setShowAppearance] = useState(false);
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
  const [actCats,          setActCats]          = useState<Set<ActCategory>>(new Set(['milestone', 'board', 'document', 'team', 'project']));
  const [actUser,          setActUser]          = useState<string>('all');
  const [backlogCards,     setBacklogCards]     = useState<BacklogCard[]>([]);
  const [backlogLoading,   setBacklogLoading]   = useState(false);
  const [backlogPriority,  setBacklogPriority]  = useState('all');
  const [backlogDate,      setBacklogDate]      = useState('all');
  const [backlogStatus,    setBacklogStatus]    = useState('pending');
  const [adoptingStandard, setAdoptingStandard] = useState(false);

  const linkedBoardIdsRef = useRef<Set<string>>(new Set());
  const linkedDocumentNamesRef = useRef<Map<string, string>>(new Map());

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
  }, [projectId, fetchProjectById, fetchStats]);

  useEffect(() => {
    if (currentProject?.workspaceId) fetchTeams(currentProject.workspaceId);
  }, [currentProject?.workspaceId, fetchTeams]);

  useEffect(() => {
    projectApi.getTeams(projectId)
      .then((teams) => setAssignedTeams(teams))
      .catch(() => setAssignedTeams([]));
  }, [projectId]);

  useEffect(() => {
    if (currentProject?.workspaceId) {
      fetchProjectStandard(currentProject.workspaceId);
    }
  }, [currentProject?.workspaceId, fetchProjectStandard]);

  // Solo documentos vinculados al proyecto; los documentos globales permanecen en el workspace.
  useEffect(() => {
    if (currentProject?.id) fetchProjectDocuments(currentProject.id);
  }, [currentProject?.id, fetchProjectDocuments]);

  // Miembros de cada equipo asignado al proyecto.
  useEffect(() => {
    let cancelled = false;
    if (assignedTeams.length === 0) { setMembers([]); return; }
    projectApi.getTeamMembers(projectId)
      .then((teamMembers) => { if (!cancelled) setMembers(teamMembers); })
      .catch(() => { if (!cancelled) setMembers([]); });
    return () => { cancelled = true; };
  }, [assignedTeams, projectId]);

  // Miembros directos del proyecto
  useEffect(() => {
    projectApi.getDirectMembers(projectId)
      .then((members) => setDirectMembers(members))
      .catch(() => setDirectMembers([]));
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
    projectApi.getActivity(projectId)
      .then((events) => { if (!cancelled) setActivityEntries(events); })
      .catch(() => { if (!cancelled) setActivityEntries([]); })
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
    setBacklogLoading(true);
    projectApi.getBacklog(projectId)
      .then((cards) => setBacklogCards(cards))
      .catch(() => setBacklogCards([]))
      .finally(() => setBacklogLoading(false));
  }, [activeTab, projectId]);

  // Mantener ref de boards vinculados actualizado para el handler de socket
  useEffect(() => {
    linkedBoardIdsRef.current = new Set((currentProject?.boards ?? []).map((b) => b.id));
  }, [currentProject?.boards]);

  useEffect(() => {
    linkedDocumentNamesRef.current = new Map(documents.map((document) => [document.id, document.title]));
  }, [documents]);

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
        (ev.context?.boardId && linkedBoardIdsRef.current.has(ev.context.boardId)) ||
        (ev.context?.documentId && linkedDocumentNamesRef.current.has(ev.context.documentId));
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
        targetName: ev.subject?.name || linkedDocumentNamesRef.current.get(ev.context?.documentId),
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
          projectApi.getTeams(projectId)
            .then((teams) => setAssignedTeams(teams))
            .catch(() => undefined);
          break;

        case 'project.team.removed': {
          const teamId = p.teamId;
          if (teamId) setAssignedTeams((prev) => prev.filter((t) => t.id !== teamId));
          break;
        }

        case 'project.member.added':
        case 'project.member.removed':
          projectApi.getDirectMembers(projectId)
            .then((members) => setDirectMembers(members))
            .catch(() => undefined);
          break;
      }
    };

    socketService.onEvent(handleEvent);

    return () => {
      socketService.off('event', handleEvent);
    };
  }, [currentProject?.workspaceId, projectId, fetchProjectById, fetchStats]);

  async function handleAssignTeam(teamId: string) {
    await projectApi.assignTeam(projectId, teamId);
    const team = allTeams.find((t) => t.id === teamId);
    if (team) setAssignedTeams((prev) => [...prev, { id: team.id, name: team.name, color: team.color ?? null, memberCount: team.memberCount ?? 0, leadName: team.leadName ?? null }]);
  }

  async function handleRemoveTeam(teamId: string) {
    await projectApi.removeTeam(projectId, teamId);
    setAssignedTeams((prev) => prev.filter((t) => t.id !== teamId));
  }

  async function handleAddDirectMember(userId: string) {
    setAddingUserId(userId);
    try {
      const member = await projectApi.addDirectMember(projectId, userId);
      setDirectMembers((prev) => [...prev.filter((m) => m.id !== member.id), member]);
      setInviteSearch('');
      setInviteResults([]);
      setShowInvitePanel(false);
    } finally { setAddingUserId(null); }
  }

  async function handleRemoveDirectMember(userId: string) {
    await projectApi.removeDirectMember(projectId, userId);
    setDirectMembers((prev) => prev.filter((m) => m.id !== userId));
  }

  async function handleChangeDirectMemberRole(userId: string, role: string) {
    await projectApi.updateDirectMemberRole(projectId, userId, role);
    setDirectMembers((prev) => prev.map((m) => m.id === userId ? { ...m, role } : m));
  }

  async function handleConfirmRemoveBoard() {
    if (!boardToRemove) return;
    setRemovingBoard(true);
    try { await removeBoard(currentProject!.id, boardToRemove.id); setBoardToRemove(null); }
    catch { /* silencio */ }
    finally { setRemovingBoard(false); }
  }

  if (!currentProject || currentProject.id !== projectId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--c-bg)' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(97,71,130,0.08)', borderTopColor: 'var(--c-accent-text)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
      </div>
    );
  }

  const project    = currentProject;
  const stats      = currentStats;
  const color      = project.color || C.accent;
  const stCfg      = getStatusCfg(project.status, t);
  const maturityCfg = getMaturityCfg(project.maturityStage ?? 'IDEA');
  const progress   = stats?.progressPercent ?? project.progressPercent ?? 0;
  const workspace  = workspaces.find((w) => w.id === project.workspaceId);
  const workspaceStandard = currentProjectStandard?.workspaceId === project.workspaceId ? currentProjectStandard : null;
  const milestones = (project.milestones ?? []).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const boards     = project.boards ?? [];
  // ── Actividad del proyecto — desde el event store ─────────────────────────────
  const actUsers    = [...new Set(activityEntries.map((e) => e.userName))].sort();
  const filteredAct = activityEntries
    .filter((e) => actCats.has(eventCategory(e.eventType)))
    .filter((e) => actUser === 'all' || e.userName === actUser);
  const actGroups   = groupByMonth(filteredAct);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--c-bg)', overflow: 'hidden' }}>

      {/* ── HEADER (collapse wrapper) ──────────────────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateRows: activeBoardId ? '0fr' : '1fr',
        transition: 'grid-template-rows 0.42s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
      }}>
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
      <header style={{
        background: 'var(--c-bg)',
        borderBottom: '1px solid rgba(97,71,130,0.07)',
        transform: activeBoardId ? 'translateY(-14px)' : 'translateY(0)',
        opacity: activeBoardId ? 0 : 1,
        transition: 'transform 0.38s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease',
      }}>
        <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '20px clamp(20px,4vw,48px) 0' }}>

          {/* Identity row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', flexWrap: 'wrap' }}>

            {/* Project icon */}
            <button type="button" disabled={!canEdit} onClick={() => setShowAppearance(true)} title={canEdit ? 'Personalizar icono y color' : undefined} aria-label="Personalizar icono y color del proyecto" style={{
              width: '54px', height: '54px', borderRadius: '50%', flexShrink: 0,
              background: color + '1A',
              border: '1px solid rgba(97,71,130,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: canEdit ? 'pointer' : 'default', transition: 'transform 160ms ease, box-shadow 160ms ease',
            }}>
              <WorkspaceIcon icon={project.icon} size={24} color={color} />
            </button>

            <div style={{ flex: '1 1 360px', minWidth: 0 }}>
              {/* Name + status badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700, fontSize: 'clamp(1.6rem,2.8vw,2.1rem)', letterSpacing: '-0.02em', color: 'var(--c-text)' }}>
                  {project.name}
                </h1>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: stCfg.color, background: stCfg.bg, padding: '5px 11px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: stCfg.color }} />
                  {stCfg.label}
                </span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: maturityCfg.color, background: maturityCfg.bg, border: `1px solid ${maturityCfg.border}`, padding: '5px 11px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: maturityCfg.color }} />
                  {maturityCfg.label}
                </span>
              </div>

              {/* Description */}
              {project.description && (
                <p style={{ margin: '8px 0 0', fontSize: '1rem', color: 'var(--c-text2)', maxWidth: '620px', lineHeight: 1.55, fontFamily: "'Manrope', system-ui, sans-serif" }}>
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
                    border: '2px solid var(--c-bg)',
                    marginLeft: i > 0 ? '-8px' : 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0,
                  }}>
                    {team.name.trim()[0]?.toUpperCase()}
                  </span>
                ))}
                <span onClick={() => setActiveTab('members')} title="Gestionar miembros" style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  background: 'rgba(97,71,130,0.06)', border: '1.5px dashed rgba(97,71,130,0.2)',
                  marginLeft: assignedTeams.length > 0 ? '-8px' : 0,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text3)', cursor: 'pointer',
                }}>
                  {assignedTeams.length > 3 ? `+${assignedTeams.length - 3}` : '+'}
                </span>
              </div>

              {canEdit && (
                <button onClick={() => setShowAddBoard(true)}
                  style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#7452A6', color: '#FFFFFF', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '13.5px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                  onMouseLeave={e => (e.currentTarget.style.filter = '')}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round"/></svg>
                  Nuevo tablero
                </button>
              )}

              {canEdit && (
                <button onClick={() => setShowConfig(true)} title="Configuración"
                  style={{ width: '38px', height: '38px', borderRadius: '8px', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.1)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text2)', transition: 'background 0.1s, color 0.1s' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(97,71,130,0.08)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'rgba(97,71,130,0.04)'; e.currentTarget.style.color = 'var(--c-text2)'; }}
                >
                  <MoreHorizontal style={ic(15)} />
                </button>
              )}
            </div>
          </div>

          {/* Progress + meta row */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', marginTop: '22px', padding: '16px 20px', borderRadius: '8px', border: '1px solid rgba(97,71,130,0.07)', background: 'rgba(97,71,130,0.02)', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 280px', minWidth: '200px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '9px' }}>
                <span style={{ fontSize: '13px', color: 'var(--c-text2)' }}>Progreso</span>
                <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--c-text)' }}>{progress}%</span>
              </div>
              <div style={{ height: '8px', borderRadius: '8px', background: 'rgba(97,71,130,0.07)', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progress}%`, borderRadius: '8px', background: color, transition: 'width 0.4s ease' }} />
              </div>
            </div>

            {stats && stats.totalCards > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--c-text2)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="#548B73" strokeWidth="1.7"/><path d="M9 12l2 2 4-4" stroke="#548B73" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <span style={{ fontSize: '13.5px' }}>{stats.completedCards}/{stats.totalCards} tareas</span>
              </div>
            )}

            {project.endDate && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', color: 'var(--c-text2)' }}>
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none"><rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="var(--c-text2)" strokeWidth="1.7"/><path d="M3.5 9h17M8 3.5v3M16 3.5v3" stroke="var(--c-text2)" strokeWidth="1.7" strokeLinecap="round"/></svg>
                <span style={{ fontSize: '13.5px' }}>Entrega {fmtShort(project.endDate)}</span>
              </div>
            )}

          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '6px', margin: '24px 0 0', borderBottom: '1px solid rgba(97,71,130,0.07)', flexWrap: 'wrap' }}>
            {TABS.map((tab) => {
              const active = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => { setActiveTab(tab.key); if (tab.key !== 'boards') setActiveBoardId(null); }}
                  style={{
                    padding: '11px 4px', margin: '0 12px -1px 0', border: 'none', background: 'transparent',
                    borderBottom: active ? '2px solid #7452A6' : '2px solid transparent',
                    fontFamily: "'Sora', system-ui, sans-serif",
                    fontWeight: 600, fontSize: '13.5px',
                    color: active ? 'var(--c-text)' : 'var(--c-text3)',
                    cursor: 'pointer', transition: 'color 0.15s',
                  }}
                  onMouseEnter={e => { if (!active) e.currentTarget.style.color = 'var(--c-text2)'; }}
                  onMouseLeave={e => { if (!active) e.currentTarget.style.color = 'var(--c-text3)'; }}
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
          const proposalGroups: Array<{ number: string; title: string; description: string; fields: Array<[string, string]> }> = [
            {
              number: '01',
              title: 'Contexto',
              description: 'La necesidad que da origen al proyecto.',
              fields: [
                ['Resumen del proyecto', project.description?.trim() ?? ''],
                ['Problemática identificada', project.problemStatement ?? ''],
              ],
            },
            {
              number: '02',
              title: 'Impacto',
              description: 'A quién afecta y qué consecuencias tiene.',
              fields: [
                ['Personas impactadas', project.impactedPeople ?? ''],
                ['Impacto de la problemática', project.problemImpact ?? ''],
                ['Cantidad aproximada', project.impactedCount != null ? `${project.impactedCount.toLocaleString('es-CL')} personas` : ''],
              ],
            },
            {
              number: '03',
              title: 'Propuesta',
              description: 'El cambio que se busca y cómo alcanzarlo.',
              fields: [
                ['Propuesta de valor', project.expectedOutcome ?? ''],
                ['Solución', project.proposedSolution ?? ''],
                ['Diferenciación', project.differentiation ?? ''],
              ],
            },
          ];
          const visibleGroups = proposalGroups
            .map((group) => ({ ...group, fields: group.fields.filter(([, value]) => value.trim().length > 0) }))
            .filter((group) => group.fields.length > 0);
          const hasProposalDetails = visibleGroups.length > 0;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 15 }}>
              {hasProposalDetails ? (
                <section style={{ border: '1px solid rgba(97,71,130,0.08)', borderRadius: 12, background: 'rgba(97,71,130,0.02)', overflow: 'hidden' }}>
                  <header style={{ padding: '19px 24px', borderBottom: '1px solid rgba(97,71,130,0.07)' }}>
                    <h2 style={{ margin: 0, color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 16 }}>Información general del proyecto</h2>
                  </header>
                  {visibleGroups.map((group) => (
                    <div key={group.number} style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0, padding: '22px 24px', borderBottom: group.number === visibleGroups[visibleGroups.length - 1].number ? 'none' : '1px solid rgba(97,71,130,0.07)' }}>
                      <header style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
                        <span style={{ width: 29, height: 29, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, border: '1px solid rgba(116,82,166,0.2)', background: 'rgba(116,82,166,0.09)', color: '#9271BD', fontSize: 10, fontWeight: 800 }}>{group.number}</span>
                        <div>
                          <h2 style={{ margin: 0, color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 15, lineHeight: 1.35, fontWeight: 650 }}>{group.title}</h2>
                          <p style={{ margin: '4px 0 0', color: 'var(--c-text3)', fontSize: 11.5, lineHeight: 1.45 }}>{group.description}</p>
                        </div>
                      </header>
                      <div style={{ display: 'grid', gap: 17, paddingLeft: 40 }}>
                        {group.fields.map(([label, value]) => (
                          <div key={label} style={{ minWidth: 0 }}>
                            <span style={{ color: 'var(--c-text3)', fontSize: 9.5, fontWeight: 800, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
                            <p style={{ margin: '5px 0 0', color: 'var(--c-text)', fontSize: 12.5, lineHeight: 1.55, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </section>
              ) : (
                <section style={{ padding: '17px 19px', border: '1px solid rgba(97,71,130,0.08)', borderRadius: 12, background: 'rgba(97,71,130,0.02)' }}>
                  <p style={{ margin: 0, color: 'var(--c-text2)', fontSize: 12.5, lineHeight: 1.55 }}>Este proyecto todavía no tiene información de contexto, impacto o propuesta. Puedes agregarla desde Editar proyecto.</p>
                </section>
              )}

              {project.sourceInitiativeId && (
                <Link href={`/dashboard/initiatives/${project.sourceInitiativeId}`} style={{ display: 'inline-flex', alignSelf: 'flex-start', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 12px', border: '1px solid rgba(116,82,166,0.2)', borderRadius: 9, background: 'rgba(116,82,166,0.06)', color: '#9271BD', fontSize: 11.5, fontWeight: 700, textDecoration: 'none' }}>
                  Ver iniciativa de origen <span aria-hidden="true">→</span>
                </Link>
              )}
              {workspaceStandard && (project.appliedStandardVersion ?? 1) < workspaceStandard.version && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', padding: '13px 16px', borderRadius: '10px', border: '1px solid rgba(196,168,110,0.2)', background: 'rgba(196,168,110,0.07)' }}>
                  <span style={{ color: 'var(--c-text2)', fontSize: '12.5px', lineHeight: 1.45 }}>Hay una actualización disponible para el marco de trabajo de este proyecto.</span>
                  {canEdit && <button type="button" disabled={adoptingStandard} onClick={async () => {
                    if (adoptingStandard) return;
                    setAdoptingStandard(true);
                    try { await adoptCurrentStandard(project.id); } finally { setAdoptingStandard(false); }
                  }} style={{ minHeight: '32px', padding: '0 11px', borderRadius: '8px', border: '1px solid rgba(196,168,110,0.24)', background: 'rgba(196,168,110,0.1)', color: '#AA895E', cursor: adoptingStandard ? 'wait' : 'pointer', fontSize: '11.5px', fontWeight: 700, flexShrink: 0 }}>
                    {adoptingStandard ? 'Actualizando…' : 'Actualizar'}
                  </button>}
                </div>
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
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0' }}>
                <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <LayoutDashboard style={{ ...ic(24), color: 'var(--c-text4)' }} />
                </span>
                <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--c-text2)', fontFamily: "'Sora', system-ui, sans-serif" }}>{t.projects_boards_empty}</p>
              </div>
            </div>
          ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(264px, 1fr))', gap: '16px', alignItems: 'stretch' }}>
                {boards.map((board) => (
                  <BoardCard key={board.id} board={board} color={C.accent} workspaceId={project.workspaceId}
                    onNavigate={() => setActiveBoardId(board.id)}
                    onRemove={canEdit ? () => setBoardToRemove({ id: board.id, name: board.name }) : undefined}
                  />
                ))}
                {canEdit && <NewBoardCard onClick={() => setShowAddBoard(true)} />}
              </div>
          )
        )}

        {/* ── BACKLOG ──────────────────────────────────────────────────────── */}
        {activeTab === 'backlog' && (() => {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const nextWeek = new Date(today);
          nextWeek.setDate(nextWeek.getDate() + 7);
          const filteredCards = backlogCards.filter((card) => {
            if (backlogPriority !== 'all' && (card.priority ?? 'none') !== backlogPriority) return false;
            if (backlogStatus === 'pending' && card.completed) return false;
            if (backlogStatus === 'completed' && !card.completed) return false;
            if (backlogDate === 'none') return !card.dueDate;
            if (backlogDate === 'dated') return !!card.dueDate;
            if (backlogDate === 'all') return true;
            if (!card.dueDate) return false;
            const due = new Date(card.dueDate);
            if (backlogDate === 'overdue') return due < today;
            if (backlogDate === 'today') return due >= today && due < new Date(today.getTime() + 86400000);
            if (backlogDate === 'week') return due >= today && due < nextWeek;
            return true;
          });
          const PMAP = {
            HIGH:   { label: 'ALTA',          color: '#ef4444', bg: 'rgba(239,68,68,0.1)',    border: 'rgba(239,68,68,0.25)'  },
            MEDIUM: { label: 'MEDIA',          color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',   border: 'rgba(245,158,11,0.25)' },
            LOW:    { label: 'BAJA',           color: '#10b981', bg: 'rgba(16,185,129,0.1)',   border: 'rgba(16,185,129,0.25)' },
            none:   { label: 'SIN PRIORIDAD',  color: 'var(--c-text3)', bg: 'rgba(97,71,130,0.04)', border: 'rgba(97,71,130,0.1)' },
          };

          return (
            <div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
                {[
                  { label: 'Prioridad', value: backlogPriority, onChange: setBacklogPriority, options: [['all', 'Todas'], ['HIGH', 'Alta'], ['MEDIUM', 'Media'], ['LOW', 'Baja'], ['none', 'Sin prioridad']] },
                  { label: 'Fecha', value: backlogDate, onChange: setBacklogDate, options: [['all', 'Todas'], ['overdue', 'Vencidas'], ['today', 'Hoy'], ['week', 'Próximos 7 días'], ['dated', 'Con fecha'], ['none', 'Sin fecha']] },
                  { label: 'Estado', value: backlogStatus, onChange: setBacklogStatus, options: [['pending', 'Pendientes'], ['completed', 'Completadas'], ['all', 'Todas']] },
                ].map((filter) => (
                  <div key={filter.label} style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 180px', color: 'var(--c-text3)', fontSize: 10, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                    <span>{filter.label}</span>
                    <ProjectOptionSelect label={`Filtrar por ${filter.label.toLowerCase()}`} value={filter.value} onChange={filter.onChange} options={filter.options.map(([value, label]) => ({ value, label }))} />
                  </div>
                ))}
              </div>

              {/* Spinner */}
              {backlogLoading && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0', gap: '10px' }}>
                  <div style={{ width: '20px', height: '20px', border: `2px solid rgba(97,71,130,0.1)`, borderTopColor: color, borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                  <span style={{ fontSize: '13.5px', color: 'var(--c-text2)' }}>Cargando backlog…</span>
                </div>
              )}

              {/* Empty state */}
              {!backlogLoading && filteredCards.length === 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '64px 0', borderRadius: '10px', border: '1px dashed rgba(97,71,130,0.1)' }}>
                  <span style={{ width: '54px', height: '54px', borderRadius: '50%', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2" stroke="var(--c-text4)" strokeWidth="1.7" strokeLinecap="round"/>
                      <rect x="9" y="3" width="6" height="4" rx="1" stroke="var(--c-text4)" strokeWidth="1.7"/>
                      <path d="M9 12h6M9 16h4" stroke="var(--c-text4)" strokeWidth="1.7" strokeLinecap="round"/>
                    </svg>
                  </span>
                  <p style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14.5px', fontWeight: 500, color: 'var(--c-text2)' }}>
                    {boards.length === 0 ? 'Sin tableros vinculados' : backlogCards.length === 0 ? 'Sin tareas todavía' : 'Sin tareas con estos filtros'}
                  </p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--c-text4)', textAlign: 'center', maxWidth: '320px' }}>
                    {boards.length === 0
                      ? 'Vincula un tablero al proyecto para ver las tareas aquí'
                      : backlogCards.length === 0 ? 'Las tareas de los tableros aparecerán aquí' : 'Prueba otra prioridad, fecha o estado'}
                  </p>
                </div>
              )}

              {/* Groups by priority */}
              {!backlogLoading && (['HIGH', 'MEDIUM', 'LOW', null] as const).map(priority => {
                const pKey  = priority ?? 'none';
                const group = filteredCards.filter(c => c.priority === priority);
                if (group.length === 0) return null;
                const pc = PMAP[pKey as keyof typeof PMAP];

                return (
                  <div key={pKey} style={{ marginBottom: '28px' }}>
                    {/* Group header */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.1em', color: pc.color, background: pc.bg, border: `1px solid ${pc.border}`, padding: '3px 11px', borderRadius: '6px' }}>
                        {pc.label}
                      </span>
                      <span style={{ fontSize: '12px', color: 'var(--c-text4)' }}>{group.length} tarea{group.length !== 1 ? 's' : ''}</span>
                      <span style={{ flex: 1, height: '1px', background: 'rgba(97,71,130,0.06)' }} />
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
                              position: 0, completed: card.completed,
                              priority: card.priority as any,
                              createdBy: '', createdAt: '', updatedAt: '',
                              dueDate: card.dueDate ?? undefined,
                            })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '12px',
                              padding: '12px 14px', borderRadius: '8px',
                              border: '1px solid rgba(97,71,130,0.07)',
                              background: 'rgba(97,71,130,0.02)',
                              cursor: 'pointer', transition: 'background 0.1s, border-color 0.1s',
                            }}
                            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.045)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.16)'; }}
                            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.02)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.07)'; }}
                          >
                            {/* Priority dot */}
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: pc.color, flexShrink: 0 }} />

                            {/* Title */}
                            <span style={{ flex: '1 1 0', minWidth: 0, fontSize: '13.5px', color: 'var(--c-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {card.title}
                            </span>

                            {/* Board - Lista */}
                            <span style={{ fontSize: '12px', color: 'var(--c-text4)', flexShrink: 0, display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="none">
                                <rect x="3" y="4" width="7" height="16" rx="1.6" stroke="var(--c-text4)" strokeWidth="1.8"/>
                                <rect x="14" y="4" width="7" height="10" rx="1.6" stroke="var(--c-text4)" strokeWidth="1.8"/>
                              </svg>
                              {card.boardName}
                              <span style={{ color: '#3A3530' }}>-</span>
                              {card.listName}
                            </span>

                            {/* Due date */}
                            {card.dueDate && (
                              <span style={{
                                fontSize: '12px', flexShrink: 0,
                                color: isOverdue ? '#B45C72' : 'var(--c-text2)',
                                background: isOverdue ? 'rgba(224,82,82,0.1)' : 'rgba(97,71,130,0.04)',
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
          <div style={{ display: 'grid', gap: '18px' }}>
            <section style={{ border: `1px solid ${C.border}`, borderRadius: '16px', background: C.surface, overflow: 'hidden', boxShadow: '0 12px 32px rgba(48,32,74,0.035)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', padding: '22px 24px 18px', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                  <span style={{ width: '38px', height: '38px', borderRadius: '11px', background: 'color-mix(in srgb, var(--c-accent) 12%, transparent)', color: C.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Calendar style={ic(18)} /></span>
                  <div>
                    <h2 style={{ margin: 0, color: C.text, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '17px', fontWeight: 650 }}>Panorama temporal</h2>
                    <p style={{ margin: '5px 0 0', color: C.text3, fontSize: '12.5px', lineHeight: 1.5 }}>Fechas, sprints y compromisos del proyecto en una sola línea de tiempo.</p>
                  </div>
                </div>
                {canEdit && (
                  <button type="button" onClick={() => setShowAddMs(true)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', minHeight: '38px', padding: '0 15px', borderRadius: '9px', border: 'none', background: C.accent, color: '#FFFFFF', fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '12.5px', cursor: 'pointer' }}
                    onMouseEnter={e => (e.currentTarget.style.filter = 'brightness(1.08)')}
                    onMouseLeave={e => (e.currentTarget.style.filter = '')}
                  ><Plus style={ic(15)} />Nuevo hito</button>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '12px 24px', borderTop: `1px solid ${C.border}`, background: C.bg2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap', color: C.text2, fontSize: '11.5px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><span style={{ width: '9px', height: '9px', background: '#8076A7', transform: 'rotate(45deg)', borderRadius: '2px' }} />Hito</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><span style={{ width: '17px', height: '7px', background: '#548B73', borderRadius: '5px' }} />Tarea</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><span style={{ width: '17px', height: '7px', background: '#8076A7', borderRadius: '5px', opacity: 0.6 }} />Sprint</span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '7px' }}><span style={{ width: '2px', height: '13px', background: '#D18360', borderRadius: '2px' }} />Hoy</span>
                </div>
                <span style={{ color: C.text3, fontSize: '11px' }}>Desliza horizontalmente para explorar fechas →</span>
              </div>
              <div style={{ padding: '14px' }}>
                <ProjectGantt
                  projectId={projectId}
                  milestones={milestones}
                  color={color}
                  refreshTick={ganttRefreshTick}
                  projectBoards={currentProject?.boards ?? []}
                />
              </div>
            </section>

            {milestones.length === 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '18px 20px', borderRadius: '12px', border: `1px dashed ${C.border2}`, background: C.surface }}>
                <span style={{ width: '38px', height: '38px', borderRadius: '10px', background: C.bg2, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
                  <Flag style={{ ...ic(17), color: C.text3 }} />
                </span>
                <div>
                  <p style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '13px', fontWeight: 600, color: C.text }}>Aún no hay hitos</p>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: C.text3 }}>Añade una fecha clave para que aparezca en el cronograma.</p>
                </div>
              </div>
            )}

            {/* Gestión de hitos */}
            {milestones.length > 0 && (
              <div style={{ border: `1px solid ${C.border}`, borderRadius: '14px', background: C.surface, padding: '18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', margin: '0 2px 15px' }}>
                  <div>
                    <h3 style={{ margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 650, color: C.text }}>Hitos del proyecto</h3>
                    <p style={{ margin: '3px 0 0', fontSize: '11.5px', color: C.text3 }}>Fechas clave y su estado actual</p>
                  </div>
                  <span style={{ padding: '5px 10px', borderRadius: '8px', background: C.bg2, color: C.text2, fontSize: '11px', fontWeight: 700 }}>{milestones.length}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                  {[...milestones].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).map((m) => {
                    const mc     = getMilestoneCfg(m.status, t);
                    const isPast = new Date(m.date) < new Date() && m.status === 'PENDING';
                    const msDay  = Math.ceil((new Date(m.date).getTime() - Date.now()) / 86400000);
                    return (
                      <div key={m.id}
                        style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '13px 14px', borderRadius: '10px', background: C.bg2, border: `1px solid ${C.border}`, transition: 'border-color 0.1s', flexWrap: 'wrap' }}
                        onMouseEnter={e => (e.currentTarget.style.borderColor = C.border2)}
                        onMouseLeave={e => (e.currentTarget.style.borderColor = C.border)}
                      >
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: mc.bg, border: `1.5px solid ${mc.color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {m.status === 'REACHED' && <Check style={{ ...ic(12), color: mc.color }} />}
                          {m.status === 'MISSED'  && <X    style={{ ...ic(12), color: mc.color }} />}
                          {m.status === 'PENDING' && <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: isPast ? C.red : mc.color }} />}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: m.status === 'MISSED' ? 'var(--c-text3)' : 'var(--c-text)', textDecoration: m.status === 'MISSED' ? 'line-through' : 'none' }}>{m.name}</p>
                          {m.description && <p style={{ margin: '2px 0 0', fontSize: '12px', color: 'var(--c-text3)' }}>{m.description}</p>}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '2px' }}>
                          <span style={{ fontSize: '12px', color: isPast ? C.red : 'var(--c-text2)' }}>{fmtDate(m.date)}</span>
                          {m.status === 'PENDING' && msDay > 0 && msDay <= 30 && (
                            <span style={{ fontSize: '11px', color: msDay <= 7 ? C.amber : 'var(--c-text4)' }}>{t.projects_time_ago_days_left(msDay)}</span>
                          )}
                          {isPast && <span style={{ fontSize: '11px', color: C.red }}>Vencido</span>}
                        </div>
                        <span style={{ fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '6px', background: mc.bg, color: mc.color, flexShrink: 0 }}>{mc.label}</span>
                        {canEdit && (
                          <div style={{ display: 'flex', gap: '3px', flexShrink: 0 }}>
                            <button onClick={() => setEditMs(m)} title="Editar hito"
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text3)' }}
                              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(97,71,130,0.06)'; e.currentTarget.style.color = 'var(--c-text)'; }}
                              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--c-text3)'; }}
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
                              style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--c-text3)' }}
                              onMouseEnter={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.06)')}
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
          <ProjectDocumentsTab
            documents={documents}
            members={members}
            color={color}
            canEdit={canEdit}
            onCreate={() => setShowAddDoc(true)}
            onOpen={(documentId) => router.push(`/dashboard/documents/${documentId}`)}
          />
        )}

        {/* ── MIEMBROS ─────────────────────────────────────────────────────── */}
        {activeTab === 'members' && (() => {
          const allMemberIds     = new Set([...directMembers.map((m) => m.id), ...members.map((m) => m.id)]);
          const teamMemberIds    = new Set(members.map((m) => m.id));
          const directOnlyMembers = directMembers.filter((m) => !teamMemberIds.has(m.id));
          const firstTeamByUser = new Map<string, string>();
          members.forEach((m) => { if (!firstTeamByUser.has(m.id)) firstTeamByUser.set(m.id, m.teamId); });
          const filteredResults  = inviteResults.filter((u) => !allMemberIds.has(u.id));
          const isEmpty          = directMembers.length === 0 && members.length === 0 && assignedTeams.length === 0;

          return (
            <div>
              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', marginBottom: '16px', flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: '0.98rem', color: 'var(--c-text2)', fontFamily: "'Manrope', system-ui, sans-serif" }}>Personas con acceso a este proyecto.</p>
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
                    <ProjectTeamSelector
                      assigned={assignedTeams}
                      allTeams={(allTeams as any[]).filter((tm) => tm.workspaceId === project.workspaceId).map((tm) => ({ id: tm.id, name: tm.name, color: tm.color ?? null, memberCount: tm.memberCount ?? 0, leadName: tm.leadName ?? null }))}
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
                      style={{ flex: 1, padding: '7px 12px', borderRadius: '6px', border: `1px solid ${C.border2}`, background: 'var(--c-bg2)', color: C.text, fontSize: '13px', fontFamily: "'Manrope', system-ui, sans-serif", outline: 'none', minWidth: 0 }}
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
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(97,71,130,0.04)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ width: '32px', height: '32px', borderRadius: '50%', background: memberColor(u.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0 }}>
                            {u.name.trim()[0]?.toUpperCase()}
                          </span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '13.5px', fontWeight: 600, color: C.text }}>{u.name}</div>
                            <div style={{ fontSize: '12px', color: C.text3 }}>{u.email}</div>
                          </div>
                          <button
                            onClick={() => handleAddDirectMember(u.id)}
                            disabled={addingUserId === u.id}
                            style={{ padding: '5px 14px', borderRadius: '6px', border: 'none', background: C.accent, color: '#FFFFFF', fontSize: '12px', fontWeight: 600, cursor: addingUserId === u.id ? 'default' : 'pointer', fontFamily: "'Manrope', system-ui, sans-serif", opacity: addingUserId === u.id ? 0.6 : 1, whiteSpace: 'nowrap', transition: 'opacity 0.13s' }}
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
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '60px 0', borderRadius: '8px', border: '1px dashed rgba(97,71,130,0.1)' }}>
                  <span style={{ width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users style={{ ...ic(22), color: 'var(--c-text4)' }} />
                  </span>
                  <p style={{ margin: 0, fontSize: '14px', fontWeight: 500, color: 'var(--c-text2)', fontFamily: "'Sora', system-ui, sans-serif" }}>Sin miembros todavía</p>
                  <p style={{ margin: 0, fontSize: '12.5px', color: 'var(--c-text4)' }}>Invita personas o asigna un equipo para dar acceso al proyecto</p>
                </div>
              )}

              {/* Direct members */}
              {directOnlyMembers.length > 0 && (
                <div style={{ marginBottom: members.length > 0 ? '20px' : 0 }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--c-text4)', marginBottom: '8px', padding: '0 2px' }}>Acceso individual</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {directOnlyMembers.map((m) => {
                      const roleLbl = m.role === 'ADMIN' ? 'Admin' : m.role === 'VIEWER' ? 'Lector' : 'Miembro';
                      return (
                        <div key={m.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '11px 14px', borderRadius: '8px', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(97,71,130,0.03)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <span style={{ width: '36px', height: '36px', borderRadius: '50%', background: m.avatar ? 'transparent' : memberColor(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#FFFFFF', flexShrink: 0, overflow: 'hidden' }}>
                            {m.avatar
                              ? <img src={m.avatar} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                              : m.name.trim()[0]?.toUpperCase()
                            }
                          </span>
                          <div style={{ flex: '1 1 160px', minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--c-text)' }}>{m.name}</span>
                            </div>
                            <div style={{ fontSize: '12.5px', color: 'var(--c-text3)', marginTop: '2px' }}>{m.email}</div>
                          </div>
                          {/* Role selector — editable by OWNER, read-only badge otherwise */}
                          {isOwner ? (
                            <select
                              value={m.role}
                              onChange={(e) => handleChangeDirectMemberRole(m.id, e.target.value)}
                              style={{
                                fontSize: '11px', fontWeight: 600, color: 'var(--c-text2)',
                                background: 'rgba(97,71,130,0.06)', border: '1px solid rgba(97,71,130,0.1)',
                                padding: '3px 8px', borderRadius: '8px', cursor: 'pointer',
                                outline: 'none', flexShrink: 0,
                              }}
                            >
                              <option value="MEMBER">Miembro</option>
                              <option value="ADMIN">Admin</option>
                              <option value="VIEWER">Lector</option>
                            </select>
                          ) : (
                            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text2)', background: 'rgba(97,71,130,0.06)', padding: '2px 9px', borderRadius: '8px', flexShrink: 0 }}>{roleLbl}</span>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => handleRemoveDirectMember(m.id)}
                              title="Quitar del proyecto"
                              style={{ padding: '5px', borderRadius: '6px', border: 'none', background: 'transparent', color: '#4A4540', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'color 0.12s' }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = '#AE7C9B')}
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

              {/* Personas agrupadas por el equipo que les da acceso. */}
              {assignedTeams.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--c-text4)', padding: '0 2px' }}>Equipos asignados</div>
                  {assignedTeams.map((team) => {
                    const teamMembers = members.filter((member) => member.teamId === team.id);
                    return (
                      <section key={team.id} style={{ border: `1px solid ${C.border}`, borderRadius: '12px', background: C.surface, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '13px 16px', background: C.bg2, borderBottom: teamMembers.length ? `1px solid ${C.border}` : 'none' }}>
                          <span style={{ width: 30, height: 30, borderRadius: 9, background: team.color || C.accent, color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>{team.name.trim()[0]?.toUpperCase()}</span>
                          <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: C.text }}>{team.name}</span>
                          <span style={{ fontSize: 12, color: C.text3 }}>{teamMembers.length} {teamMembers.length === 1 ? 'persona' : 'personas'}</span>
                        </div>
                        {teamMembers.length === 0 ? (
                          <p style={{ margin: 0, padding: '16px', fontSize: 12.5, color: C.text4 }}>Este equipo aún no tiene miembros con acceso al espacio de trabajo.</p>
                        ) : teamMembers.map((m) => {
                          const direct = directMembers.find((person) => person.id === m.id);
                          const showDirectControls = direct && firstTeamByUser.get(m.id) === team.id;
                          const roleLbl = m.role === 'ADMIN' ? 'Admin' : m.role === 'VIEWER' ? 'Lector' : 'Miembro';
                          return (
                            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderTop: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
                              <span style={{ width: 36, height: 36, borderRadius: '50%', background: m.avatar ? 'transparent' : memberColor(m.id), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FFFFFF', fontWeight: 700, fontSize: 12, flexShrink: 0, overflow: 'hidden' }}>
                                {m.avatar ? <img src={m.avatar} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.name.trim()[0]?.toUpperCase()}
                              </span>
                              <div style={{ flex: '1 1 180px', minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                  <span style={{ fontSize: 13.5, fontWeight: 600, color: C.text }}>{m.name}</span>
                                  <span style={{ fontSize: 11, color: team.color || C.accent, background: C.bg2, borderRadius: 8, padding: '2px 8px' }}>{roleLbl} del equipo</span>
                                  {showDirectControls && <span style={{ fontSize: 11, color: C.text3 }}>También acceso individual</span>}
                                </div>
                                <div style={{ fontSize: 12, color: C.text3, marginTop: 2 }}>{m.email}</div>
                              </div>
                              {showDirectControls && (isOwner ? (
                                <select aria-label={`Rol individual de ${m.name}`} value={direct.role} onChange={(e) => handleChangeDirectMemberRole(m.id, e.target.value)} style={{ fontSize: 11, color: C.text2, background: C.bg2, border: `1px solid ${C.border}`, padding: '4px 8px', borderRadius: 8 }}>
                                  <option value="MEMBER">Miembro</option><option value="ADMIN">Admin</option><option value="VIEWER">Lector</option>
                                </select>
                              ) : <span style={{ fontSize: 11, color: C.text3 }}>Acceso individual: {direct.role === 'ADMIN' ? 'Admin' : direct.role === 'VIEWER' ? 'Lector' : 'Miembro'}</span>)}
                              {showDirectControls && canEdit && <button type="button" onClick={() => handleRemoveDirectMember(m.id)} title="Quitar acceso individual al proyecto" aria-label={`Quitar acceso individual de ${m.name}`} style={{ padding: 5, border: 'none', background: 'transparent', color: C.text3, cursor: 'pointer' }}><X style={{ width: 15, height: 15 }} /></button>}
                            </div>
                          );
                        })}
                      </section>
                    );
                  })}
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
                {([['milestone', 'Hitos'], ['board', 'Tableros y tarjetas'], ['document', 'Documentos'], ['team', 'Equipos y miembros'], ['project', 'Proyecto']] as [ActCategory, string][]).map(([key, label]) => {
                  const on = actCats.has(key);
                  return (
                    <div key={key}
                      onClick={() => setActCats((prev) => { const n = new Set(prev); n.has(key) ? n.delete(key) : n.add(key); return n; })}
                      style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '7px 10px', borderRadius: '7px', cursor: 'pointer', userSelect: 'none', background: on ? 'rgba(116,82,166,0.08)' : 'transparent', transition: 'background 0.12s' }}
                      onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = 'rgba(97,71,130,0.04)'; }}
                      onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = 'transparent'; }}
                    >
                      <span style={{ width: '14px', height: '14px', borderRadius: '4px', border: `2px solid ${on ? C.accent : C.border2}`, background: on ? C.accent : 'transparent', flexShrink: 0, transition: 'all 0.12s', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {on && <svg width="8" height="8" viewBox="0 0 10 10"><path d="M2 5l2.5 2.5L8 2.5" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                      </span>
                      <span style={{ fontSize: '12.5px', fontWeight: 500, color: on ? C.text : C.text3 }}>{label}</span>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4, marginBottom: '9px' }}>Persona</div>
              <select value={actUser} onChange={(e) => setActUser(e.target.value)}
                style={{ width: '100%', padding: '8px 10px', borderRadius: '7px', border: `1px solid ${C.border2}`, background: 'var(--c-bg2)', color: C.text2, fontFamily: "'Manrope', system-ui, sans-serif", fontSize: '12.5px', outline: 'none' }}
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
                  <span style={{ display: 'inline-flex', width: '52px', height: '52px', borderRadius: '50%', background: 'rgba(97,71,130,0.04)', border: `1px solid ${C.border2}`, alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
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
                                  style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '12px 14px', borderRadius: '8px', border: `1px solid ${C.border2}`, borderLeft: `3px solid ${desc.accent}`, background: 'rgba(97,71,130,0.018)', transition: 'background 0.1s' }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(97,71,130,0.035)')}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(97,71,130,0.018)')}
                                >
                                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: memberColor(ev.userId), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11.5px', fontWeight: 700, color: '#FFFFFF' }}>
                                    {ev.userName.trim()[0]?.toUpperCase()}
                                  </span>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '13.5px', color: C.text2, lineHeight: 1.55 }}>
                                      <strong style={{ color: C.text, fontWeight: 600 }}>{ev.userName}</strong>
                                      {' '}{desc.verb}{' '}
                                      {desc.target && <strong style={{ color: desc.accent, fontWeight: 600 }}>{desc.target}</strong>}
                                    </div>
                                    {desc.detail && <div style={{ fontSize: '12px', color: C.text3, marginTop: '3px', overflowWrap: 'anywhere' }}>“{desc.detail}”</div>}
                                    <div style={{ fontSize: '11.5px', color: C.text4, marginTop: '4px' }}>{hour} - {timeAgo(ev.createdAt, t)}</div>
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
      {showAppearance && <ProjectAppearanceModal project={project} onClose={() => setShowAppearance(false)} />}
      {showAddBoard && <AddBoardModal          project={project}   onClose={() => setShowAddBoard(false)} />}
      {showAddMs    && <CreateMilestoneModal   projectId={project.id} color={color} onClose={() => setShowAddMs(false)} />}
      {editMs       && <CreateMilestoneModal   projectId={project.id} color={color} milestone={editMs} onClose={() => setEditMs(null)} />}
      {showAddDoc   && <CreateDocumentModal    workspaceId={project.workspaceId} projectId={project.id} color={color} onClose={() => setShowAddDoc(false)} onCreated={(doc) => router.push(`/dashboard/documents/${doc.id}`)} />}

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
                  <><div style={{ width: '12px', height: '12px', border: '2px solid rgba(97,71,130,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} /> {t.btn_deleting}</>
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
        border: `1px solid ${hov ? `color-mix(in srgb, ${color} 36%, transparent)` : 'rgba(97,71,130,0.08)'}`,
        background: hov ? 'rgba(97,71,130,0.045)' : 'rgba(97,71,130,0.02)',
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
          <span style={{ width: '38px', height: '38px', borderRadius: '50%', background: `color-mix(in srgb, ${color} 13%, transparent)`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <rect x="3" y="4" width="7" height="16" rx="1.6" stroke={color} strokeWidth="1.8"/>
              <rect x="14" y="4" width="7" height="10" rx="1.6" stroke={color} strokeWidth="1.8"/>
            </svg>
          </span>
          <div style={{ minWidth: 0, paddingRight: hov ? '28px' : 0, transition: 'padding 0.15s' }}>
            <div style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '15.5px', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {board.name}
            </div>
          </div>
        </div>

        {/* Description */}
        <p style={{ margin: '13px 0 0', fontSize: '12.5px', color: 'var(--c-text3)', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '37px' }}>
          {board.description || 'Sin descripción'}
        </p>

        {/* Footer: editado + abrir */}
        <div style={{ marginTop: 'auto', paddingTop: '14px', borderTop: '1px solid rgba(97,71,130,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: 'var(--c-text4)' }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="var(--c-text4)" strokeWidth="1.7"/><path d="M12 7.5v5l3 2" stroke="var(--c-text4)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
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
          style={{ position: 'absolute', top: '16px', right: '14px', width: '24px', height: '24px', borderRadius: '6px', background: 'rgba(224,82,82,0.12)', border: '1px solid rgba(224,82,82,0.3)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#B45C72', zIndex: 2 }}
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
        border: `1.5px dashed ${hov ? 'rgba(97,71,130,0.3)' : 'rgba(97,71,130,0.14)'}`,
        background: hov ? 'rgba(97,71,130,0.03)' : 'transparent',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px',
        cursor: 'pointer', transition: 'border-color 0.15s, background 0.15s',
      }}
    >
      <span style={{ width: '42px', height: '42px', borderRadius: '50%', background: hov ? 'rgba(97,71,130,0.1)' : 'rgba(97,71,130,0.05)', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s' }}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke={hov ? 'var(--c-text)' : 'var(--c-text4)'} strokeWidth="2" strokeLinecap="round"/></svg>
      </span>
      <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: '14px', fontWeight: 600, color: hov ? 'var(--c-text2)' : 'var(--c-text4)', transition: 'color 0.15s' }}>
        Nuevo tablero
      </span>
    </div>
  );
}
