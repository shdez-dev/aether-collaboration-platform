'use client';

import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, CalendarDays, Check, CircleHelp, Clock3, Flag, RefreshCw, Target, UserRound } from 'lucide-react';
import type { Project, ProjectMilestone, ProjectStats } from '@/stores/projectStore';
import { apiService } from '@/services/apiService';
import {
  projectApi,
  type ProjectActivityEntry,
  type ProjectBacklogCard,
  type ProjectBaseline,
  type ProjectRisk,
  type ProjectTraceabilityData,
} from '@/features/projects/api';
import styles from './ProjectDirectionSummary.module.css';

type ProjectOverviewTab = 'traceability' | 'schedule' | 'risks' | 'backlog' | 'activity' | 'members';
type DirectionNavigationOptions = { traceSection?: 'chain' | 'baseline'; createBaseline?: boolean };
type DirectionCard = Pick<ProjectBacklogCard, 'completed' | 'dueDate' | 'blockedByPendingCount'>;
type OwnerOption = { id: string; name: string; email: string };

type Props = {
  project: Project;
  stats: ProjectStats | null;
  milestones: ProjectMilestone[];
  cards: DirectionCard[];
  cardsLoading: boolean;
  activity: ProjectActivityEntry[];
  activityLoading: boolean;
  activityError: boolean;
  canEdit: boolean;
  canManageTraceability?: boolean;
  canUseProjectPlanning: boolean;
  onAssignOwner: (ownerId: string) => Promise<void>;
  onNavigate: (tab: ProjectOverviewTab, options?: DirectionNavigationOptions) => void;
};

function dateOnly(value: string | null | undefined): Date | null {
  if (!value) return null;
  const match = value.slice(0, 10).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function formatDate(value: string | null | undefined) {
  const date = dateOnly(value);
  return date ? date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
}

function dateDistanceLabel(value: string) {
  const date = dateOnly(value);
  if (!date) return 'Fecha por confirmar';
  const days = Math.round((date.getTime() - startOfToday().getTime()) / 86_400_000);
  if (days < 0) return `Atrasado ${Math.abs(days)} ${Math.abs(days) === 1 ? 'día' : 'días'}`;
  if (days === 0) return 'Es hoy';
  if (days === 1) return 'Es mañana';
  return `En ${days} días`;
}

function eventLabel(event: ProjectActivityEntry, projectName: string) {
  const labels: Record<string, string> = {
    'project.created': 'Se creó el proyecto',
    'project.updated': 'Se actualizaron los datos del proyecto',
    'project.status.changed': 'Cambió el estado del proyecto',
    'project.workflow.changed': 'Cambió la etapa del proyecto',
    'project.milestone.created': 'Se creó el hito',
    'project.milestone.updated': 'Se actualizó el hito',
    'project.milestone.completed': 'Se completó el hito',
    'project.milestone.missed': 'Se venció el hito',
    'project.risk.created': 'Se registró el riesgo',
    'project.risk.updated': 'Se actualizó el riesgo',
    'project.risk.status-changed': 'Cambió el estado del riesgo',
    'card.created': 'Se creó la tarjeta',
    'card.updated': 'Se actualizó la tarjeta',
    'card.moved': 'Se movió la tarjeta',
    'card.status-changed': 'Cambió el estado de la tarjeta',
    'sprint.created': 'Se creó el sprint',
    'sprint.started': 'Comenzó el sprint',
    'sprint.completed': 'Se completó el sprint',
  };
  const label = labels[event.eventType] ?? 'Se registró un cambio';
  const target = event.targetName?.trim();
  return target && target !== projectName ? `${label}: ${target}` : label;
}

function attentionLabel(event: ProjectActivityEntry) {
  const date = new Date(event.createdAt);
  if (Number.isNaN(date.getTime())) return 'Cambio reciente';
  return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
}

function isHighRisk(risk: ProjectRisk) {
  return risk.status !== 'CLOSED' && risk.residualScore >= 10;
}

function effortLabel(baseline: ProjectBaseline) {
  const units: Record<ProjectBaseline['effortUnit'], string> = {
    HOURS: 'horas',
    DAYS: 'días-persona',
    STORY_POINTS: 'puntos',
  };
  return `${baseline.effortValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })} ${units[baseline.effortUnit]}`;
}

export function ProjectDirectionSummary({
  project,
  stats,
  milestones,
  cards,
  cardsLoading,
  activity,
  activityLoading,
  activityError,
  canEdit,
  canManageTraceability = canEdit,
  canUseProjectPlanning,
  onAssignOwner,
  onNavigate,
}: Props) {
  const [traceability, setTraceability] = useState<ProjectTraceabilityData | null>(null);
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [retryKey, setRetryKey] = useState(0);
  const [ownerEditorOpen, setOwnerEditorOpen] = useState(false);
  const [ownerOptions, setOwnerOptions] = useState<OwnerOption[]>([]);
  const [ownerSearch, setOwnerSearch] = useState('');
  const [selectedOwnerId, setSelectedOwnerId] = useState(project.ownerId);
  const [ownerLoading, setOwnerLoading] = useState(false);
  const [ownerSaving, setOwnerSaving] = useState(false);
  const [ownerError, setOwnerError] = useState('');
  const [ownerRetryKey, setOwnerRetryKey] = useState(0);

  useEffect(() => {
    if (!ownerEditorOpen || !canEdit) return;
    let active = true;
    setOwnerLoading(true);
    setOwnerError('');
    void apiService.get<{ members: Array<{ user: OwnerOption }> }>(`/api/workspaces/${project.workspaceId}/members`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar las personas del espacio.');
        setOwnerOptions(response.data.members.map((membership) => membership.user));
      })
      .catch((cause) => {
        if (!active) return;
        setOwnerOptions([]);
        setOwnerError(cause instanceof Error ? cause.message : 'No se pudieron cargar las personas del espacio.');
      })
      .finally(() => { if (active) setOwnerLoading(false); });
    return () => { active = false; };
  }, [canEdit, ownerEditorOpen, ownerRetryKey, project.workspaceId]);

  const visibleOwnerOptions = ownerOptions.filter((owner) =>
    `${owner.name} ${owner.email}`.toLocaleLowerCase().includes(ownerSearch.trim().toLocaleLowerCase()),
  );

  const saveOwner = async () => {
    if (!selectedOwnerId || selectedOwnerId === project.ownerId || ownerSaving) return;
    setOwnerSaving(true);
    setOwnerError('');
    try {
      await onAssignOwner(selectedOwnerId);
      setOwnerEditorOpen(false);
      setOwnerSearch('');
    } catch (cause) {
      setOwnerError(cause instanceof Error ? cause.message : 'No se pudo cambiar el responsable.');
    } finally {
      setOwnerSaving(false);
    }
  };

  useEffect(() => {
    let active = true;
    setLoading(true);
    void Promise.allSettled([
      projectApi.getTraceability(project.id),
      projectApi.getBaselines(project.id),
      projectApi.getRisks(project.id),
    ]).then(([traceResult, baselineResult, riskResult]) => {
      if (!active) return;
      const failures: string[] = [];
      if (traceResult.status === 'fulfilled') setTraceability(traceResult.value);
      else { setTraceability(null); failures.push('trazabilidad'); }
      if (baselineResult.status === 'fulfilled') setBaselines(baselineResult.value);
      else { setBaselines([]); failures.push('línea base'); }
      if (riskResult.status === 'fulfilled') setRisks(riskResult.value.risks);
      else { setRisks([]); failures.push('riesgos'); }
      setFailedSources(failures);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [project.id, retryKey]);

  const objective = traceability?.objective;
  const currentBaseline = useMemo(
    () => baselines.find((baseline) => baseline.isCurrent) ?? baselines[0] ?? null,
    [baselines],
  );
  const objectiveText = objective?.statement?.trim() || project.productGoal?.trim() || project.expectedOutcome?.trim() || '';
  const hasMetric = Boolean(objective?.successMetric?.trim());
  const hasTarget = objective?.targetValue != null;
  const hasMeasuredGoal = Boolean(objectiveText && hasMetric && hasTarget);
  const objectiveActionLabel = !objectiveText
    ? 'Definir objetivo'
    : !hasMetric && !hasTarget
      ? 'Definir indicador y meta'
      : !hasMetric
        ? 'Definir indicador'
        : !hasTarget
          ? 'Definir meta'
          : 'Ver objetivo';
  const measurementHint = !objectiveText
    ? 'Define el resultado que debe lograr el proyecto.'
    : !hasMetric && !hasTarget
      ? 'Añade un indicador y una meta para comprobar el resultado.'
      : !hasMetric
        ? 'Añade un indicador para comprobar el resultado.'
        : 'Define una meta para comparar el resultado.';
  const traceabilityUnavailable = failedSources.includes('trazabilidad');
  const baselineUnavailable = failedSources.includes('línea base');
  const upcomingMilestone = useMemo(() => milestones
    .filter((milestone) => milestone.status !== 'REACHED')
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0] ?? null,
  [milestones]);

  const today = startOfToday();
  const activeHighRisks = risks.filter(isHighRisk);
  const criticalRisks = activeHighRisks.filter((risk) => risk.residualScore >= 16).length;
  const highRisks = activeHighRisks.length - criticalRisks;
  const overdueReviews = risks.filter((risk) => risk.status !== 'CLOSED' && risk.nextReviewAt && (dateOnly(risk.nextReviewAt)?.getTime() ?? Infinity) < today.getTime()).length;
  const blockedCards = cards.filter((card) => !card.completed && card.blockedByPendingCount > 0).length;
  const backlogOverdueCards = cards.filter((card) => !card.completed && dateOnly(card.dueDate)?.getTime() != null && dateOnly(card.dueDate)!.getTime() < today.getTime()).length;
  const overdueCards = stats?.overdueCards ?? backlogOverdueCards;
  const milestoneOverdue = upcomingMilestone ? upcomingMilestone.status === 'MISSED' || (dateOnly(upcomingMilestone.date)?.getTime() ?? Infinity) < today.getTime() : false;
  const latestActivity = activity[0] ?? null;

  const setupItemsToComplete: Array<{ label: string; tab: ProjectOverviewTab; options?: DirectionNavigationOptions } | null> = [
    !loading && !traceabilityUnavailable && !hasMeasuredGoal ? { label: objectiveActionLabel, tab: 'traceability' as const, options: { traceSection: 'chain' } } : null,
    !loading && !baselineUnavailable && !currentBaseline ? { label: 'Acordar alcance y fechas', tab: 'traceability' as const, options: { traceSection: 'baseline', createBaseline: canManageTraceability } } : null,
    !upcomingMilestone ? (canUseProjectPlanning ? { label: 'Crear el primer hito', tab: 'schedule' as const } : null) : null,
  ];
  const setupItems = setupItemsToComplete.filter((item): item is { label: string; tab: ProjectOverviewTab; options?: DirectionNavigationOptions } => item !== null);

  const alertItems = [
    ...(criticalRisks ? [{ label: 'Riesgos críticos', detail: `${criticalRisks} requieren atención`, tab: 'risks' as const, tone: 'critical' }] : []),
    ...(highRisks ? [{ label: 'Riesgos altos', detail: `${highRisks} activos`, tab: 'risks' as const, tone: 'warning' }] : []),
    ...(overdueReviews ? [{ label: 'Revisiones de riesgo vencidas', detail: `${overdueReviews} por revisar`, tab: 'risks' as const, tone: 'warning' }] : []),
    ...(!cardsLoading && blockedCards ? [{ label: 'Tarjetas bloqueadas', detail: `${blockedCards} con dependencias pendientes`, tab: 'backlog' as const, tone: 'warning' }] : []),
    ...(!cardsLoading && overdueCards ? [{ label: 'Tarjetas vencidas', detail: `${overdueCards} fuera de fecha`, tab: 'backlog' as const, tone: 'critical' }] : []),
    ...(milestoneOverdue && upcomingMilestone ? [{ label: 'Hito atrasado', detail: upcomingMilestone.name, tab: canUseProjectPlanning ? 'schedule' as const : 'traceability' as const, tone: 'critical' }] : []),
  ];

  const dateStatus = currentBaseline?.targetDate
    ? (project.status === 'COMPLETED' ? 'Proyecto completado' : dateDistanceLabel(currentBaseline.targetDate))
    : null;

  return (
    <section className={styles.root} aria-labelledby="project-direction-title">
      <header className={styles.heading}>
        <div>
          <h2 id="project-direction-title">Dirección del proyecto</h2>
          <p>Objetivo, compromiso y puntos que necesitan atención.</p>
        </div>
        <button type="button" className={styles.textButton} onClick={() => onNavigate('traceability', { traceSection: 'chain' })}>
          Ver trazabilidad <ArrowRight size={14} aria-hidden="true" />
        </button>
      </header>

      {failedSources.length > 0 && (
        <div className={styles.loadNotice} role="status">
          <span>No se pudieron cargar {failedSources.join(', ')}.</span>
          <button type="button" onClick={() => setRetryKey((value) => value + 1)}><RefreshCw size={13} /> Reintentar</button>
        </div>
      )}

      <div className={styles.primaryGrid}>
        <article className={styles.objectivePanel}>
          <div className={styles.panelLabel}><span className={styles.icon}><Target size={16} /></span><div className={styles.panelTitle}><h3>Objetivo y resultado esperado</h3><span className={styles.sourceHint}>Al crear el proyecto; indicador y meta en Trazabilidad → Cadena</span></div></div>
          {objectiveText ? (
            <p className={styles.objectiveText}>{objectiveText}</p>
          ) : (
            <div className={styles.emptyValue}><CircleHelp size={16} /><span>Define qué resultado debe lograr el proyecto.</span></div>
          )}
          <div className={styles.objectiveFooter}>
            <div className={styles.measureDetails}>
              <div className={styles.measureRow}>
                <span className={!hasMetric ? styles.measurePending : undefined}>
                  <small>Indicador</small>
                  <strong>{loading ? 'Verificando…' : traceabilityUnavailable ? 'No disponible' : objective?.successMetric?.trim() || 'Por definir'}</strong>
                </span>
                <span className={!hasTarget ? styles.measurePending : undefined}>
                  <small>Meta</small>
                  <strong>{loading ? 'Verificando…' : traceabilityUnavailable ? 'No disponible' : objective?.targetValue != null ? `${objective.targetValue.toLocaleString('es-CL')}${objective.unit ? ` ${objective.unit}` : ''}` : 'Por definir'}</strong>
                </span>
              </div>
              {traceabilityUnavailable ? <p className={styles.measureHint}>No se pudo cargar la medición del objetivo.</p> : !loading && !hasMeasuredGoal && <p className={styles.measureHint}>{measurementHint}</p>}
            </div>
            <button type="button" className={styles.quietButton} onClick={() => traceabilityUnavailable ? setRetryKey((value) => value + 1) : onNavigate('traceability', { traceSection: 'chain' })}>
              {traceabilityUnavailable ? 'Reintentar carga' : objectiveActionLabel} <ArrowRight size={13} />
            </button>
          </div>
        </article>

        <div className={styles.sideStack}>
          <article className={styles.baselinePanel}>
            <div className={styles.panelLabel}><span className={styles.icon}><CalendarDays size={16} /></span><div className={styles.panelTitle}><h3>Alcance y fechas</h3><span className={styles.sourceHint}>Se crea en Trazabilidad → Línea base</span></div></div>
            {loading ? (
              <p className={styles.mutedLine}>Verificando la línea base…</p>
            ) : baselineUnavailable ? (
              <div className={styles.pendingValue}><span>No se pudo cargar la línea base.</span><button type="button" onClick={() => setRetryKey((value) => value + 1)}>Reintentar <RefreshCw size={12} /></button></div>
            ) : currentBaseline ? (
              <>
                <p className={styles.baselineScope}>{currentBaseline.scope}</p>
                <div className={styles.baselineFacts}>
                  <span><small>Inicio</small><strong>{formatDate(currentBaseline.startDate)}</strong></span>
                  <span><small>Fecha objetivo</small><strong>{formatDate(currentBaseline.targetDate)}</strong></span>
                  <span><small>Esfuerzo</small><strong>{effortLabel(currentBaseline)}</strong></span>
                </div>
                <span className={`${styles.dateBadge} ${dateStatus?.startsWith('Atrasado') ? styles.dateBadgeLate : ''}`}>
                  {dateStatus?.startsWith('Atrasado') && <AlertTriangle size={12} />}{dateStatus}
                </span>
              </>
            ) : (
              <div className={styles.pendingValue}><span>Falta acordar alcance, fechas y esfuerzo.</span><button type="button" onClick={() => onNavigate('traceability', { traceSection: 'baseline', createBaseline: canManageTraceability })}>{canManageTraceability ? 'Crear línea base' : 'Ver línea base'} <ArrowRight size={13} /></button></div>
            )}
          </article>

          <article className={styles.ownerPanel}>
            <div className={styles.ownerHeader}>
              <div className={styles.panelLabel}><span className={styles.icon}><UserRound size={16} /></span><div className={styles.panelTitle}><h3>Responsable del proyecto</h3><span className={styles.sourceHint}>Se puede asignar o cambiar aquí</span></div></div>
              {canEdit && !ownerEditorOpen && <button type="button" className={styles.ownerEditButton} onClick={() => { setSelectedOwnerId(project.ownerId); setOwnerSearch(''); setOwnerError(''); setOwnerEditorOpen(true); }}>Cambiar</button>}
            </div>
            <strong className={styles.ownerName}>{project.ownerName?.trim() || 'Responsable asignado'}</strong>
            {!ownerEditorOpen && <small>Tiene acceso para gestionar el proyecto.</small>}
            {ownerEditorOpen && (
              <div className={styles.ownerEditor}>
                <label htmlFor="project-owner-search">Elegir una persona del espacio de trabajo</label>
                <input id="project-owner-search" type="search" value={ownerSearch} onChange={(event) => setOwnerSearch(event.target.value)} placeholder="Buscar por nombre o correo" disabled={ownerSaving} />
                <div className={styles.ownerOptions} role="radiogroup" aria-label="Nuevo responsable del proyecto">
                  {ownerLoading ? <span className={styles.ownerEmpty}>Cargando personas…</span> : visibleOwnerOptions.length ? visibleOwnerOptions.map((owner) => (
                    <label key={owner.id} className={styles.ownerOption}>
                      <input type="radio" name="project-owner" value={owner.id} checked={selectedOwnerId === owner.id} onChange={() => setSelectedOwnerId(owner.id)} disabled={ownerSaving} />
                      <span><strong>{owner.name}</strong><small>{owner.email}</small></span>
                    </label>
                  )) : <span className={styles.ownerEmpty}>{ownerOptions.length ? 'No hay coincidencias.' : 'No hay personas disponibles.'}</span>}
                </div>
                {ownerError && <div className={styles.ownerError} role="alert">{ownerError}{!ownerOptions.length && !ownerLoading && <button type="button" onClick={() => setOwnerRetryKey((value) => value + 1)}>Reintentar</button>}</div>}
                <div className={styles.ownerActions}>
                  <button type="button" onClick={() => setOwnerEditorOpen(false)} disabled={ownerSaving}>Cancelar</button>
                  <button type="button" onClick={saveOwner} disabled={ownerLoading || ownerSaving || !selectedOwnerId || selectedOwnerId === project.ownerId}>{ownerSaving ? 'Guardando…' : 'Guardar responsable'}</button>
                </div>
              </div>
            )}
          </article>
        </div>
      </div>

      <div className={styles.secondaryGrid}>
        <article className={styles.milestonePanel}>
          <div className={styles.panelLabel}><span className={styles.icon}><Flag size={16} /></span><div className={styles.panelTitle}><h3>Próximo hito</h3><span className={styles.sourceHint}>{canUseProjectPlanning ? 'Se programa en Cronograma' : 'Disponible en proyectos de equipo'}</span></div></div>
          {upcomingMilestone ? (
            <div className={styles.milestoneContent}>
              <div><strong>{upcomingMilestone.name}</strong><span>{formatDate(upcomingMilestone.date)}</span></div>
              <span className={`${styles.milestoneStatus} ${milestoneOverdue ? styles.statusLate : ''}`}>
                {milestoneOverdue ? 'Atrasado' : upcomingMilestone.status === 'MISSED' ? 'Requiere revisión' : dateDistanceLabel(upcomingMilestone.date)}
              </span>
            </div>
          ) : (
            <div className={styles.pendingValue}><span>Todavía no hay un hito programado.</span>{canUseProjectPlanning && <button type="button" onClick={() => onNavigate('schedule')}>Agregar hito <ArrowRight size={13} /></button>}</div>
          )}
        </article>

        <article className={styles.attentionPanel}>
          <div className={styles.panelLabel}><span className={styles.icon}><AlertTriangle size={16} /></span><div className={styles.panelTitle}><h3>Atención</h3><span className={styles.sourceHint}>Se actualiza desde Riesgos, Backlog y Cronograma</span></div>{alertItems.length > 0 && <span className={styles.alertCount}>{alertItems.length}</span>}</div>
          {loading && risks.length === 0 ? (
            <p className={styles.mutedLine}>Cargando señales del proyecto…</p>
          ) : alertItems.length > 0 ? (
            <ul className={styles.alertList}>
              {alertItems.slice(0, 4).map((item) => (
                <li key={item.label} data-tone={item.tone}>
                  <span><strong>{item.label}</strong><small>{item.detail}</small></span>
                  <button type="button" aria-label={`Ver ${item.label.toLowerCase()}`} onClick={() => onNavigate(item.tab)}><ArrowRight size={14} /></button>
                </li>
              ))}
            </ul>
          ) : failedSources.includes('riesgos') || cardsLoading ? (
            <p className={styles.mutedLine}>La revisión de alertas todavía no está completa.</p>
          ) : (
            <p className={styles.clearLine}><Check size={14} /> Sin riesgos altos, tarjetas bloqueadas o fechas vencidas.</p>
          )}
          <div className={styles.recentChange}>
            <span className={styles.recentIcon}><Clock3 size={13} /></span>
            <span className={styles.recentBody}>
              <small className={styles.recentLabel}>Último cambio en Actividad</small>
              {activityLoading ? <span className={styles.mutedLine}>Buscando cambios recientes…</span> : activityError ? <span className={styles.mutedLine}>No se pudo cargar el último cambio.</span> : latestActivity ? (
                <span className={styles.recentText}><strong>{eventLabel(latestActivity, project.name)}</strong><small><span>{latestActivity.userName}</span><time dateTime={latestActivity.createdAt}>{attentionLabel(latestActivity)}</time></small></span>
              ) : <span className={styles.mutedLine}>Aún no hay cambios recientes.</span>}
            </span>
            <button type="button" aria-label="Ver actividad del proyecto" onClick={() => onNavigate('activity')}><ArrowRight size={14} /></button>
          </div>
        </article>
      </div>

      {setupItems.length > 0 && (
        <aside className={styles.setupPanel} aria-label="Información pendiente del proyecto">
          <div>
            <div className={styles.setupHeading}><strong>Completa la dirección</strong><span>{setupItems.length} {setupItems.length === 1 ? 'pendiente' : 'pendientes'}</span></div>
            <p>Estos datos ayudan al equipo a mantener el proyecto medible y en curso.</p>
          </div>
          <ul>
            {setupItems.map((item) => <li key={item.label}><button type="button" onClick={() => onNavigate(item.tab, item.options)}>{item.label}<ArrowRight size={13} /></button></li>)}
          </ul>
        </aside>
      )}
    </section>
  );
}
