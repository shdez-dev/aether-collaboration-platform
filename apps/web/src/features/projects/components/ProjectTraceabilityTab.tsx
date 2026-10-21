'use client';

import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeftRight,
  CalendarDays,
  Check,
  Clock3,
  FileClock,
  GitCompareArrows,
  LoaderCircle,
  Plus,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react';
import { CalendarDatePicker } from '@/components/calendar/DateTimePickers';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import { useRouteSectionState } from '@/hooks/useRouteSectionState';
import { ProjectTraceabilityChain } from './ProjectTraceabilityChain';
import {
  projectApi,
  type ProjectBaseline,
  type ProjectBaselineEffortUnit,
  type ProjectDecision,
  type ProjectTraceabilityData,
} from '@/features/projects/api';
import type { ProjectWorkflowHistoryItem } from '@/stores/projectStore';
import styles from './ProjectTraceabilityTab.module.css';

type Section = 'chain' | 'decisions' | 'baseline';
type Dialog = { kind: 'decision'; supersedesId: string | null } | { kind: 'baseline' } | null;

type DecisionDraft = {
  title: string;
  context: string;
  outcome: string;
  rationale: string;
  decisionDate: string;
  subjectType: ProjectDecision['subjectType'];
  subjectId: string | null;
};

type BaselineDraft = {
  scope: string;
  startDate: string;
  targetDate: string;
  effortValue: string;
  effortUnit: ProjectBaselineEffortUnit;
  changeReason: string;
};

type FieldErrors = Record<string, string>;

type Props = {
  projectId: string;
  canEdit: boolean;
  externalRefreshKey?: number;
  projectStartDate?: string | null;
  projectTargetDate?: string | null;
  workflowHistory?: ProjectWorkflowHistoryItem[];
};

const unitLabels: Record<ProjectBaselineEffortUnit, string> = {
  HOURS: 'Horas',
  DAYS: 'Días-persona',
  STORY_POINTS: 'Puntos de historia',
};

const effortUnitOptions = [
  {
    value: 'HOURS',
    label: 'Horas',
    description: 'Tiempo directo de trabajo',
    icon: <Clock3 size={14} />,
    tone: 'accent' as const,
  },
  {
    value: 'DAYS',
    label: 'Días-persona',
    description: 'Una persona trabajando durante un día',
    icon: <CalendarDays size={14} />,
    tone: 'neutral' as const,
  },
  {
    value: 'STORY_POINTS',
    label: 'Puntos de historia',
    description: 'Complejidad relativa del trabajo',
    icon: <GitCompareArrows size={14} />,
    tone: 'neutral' as const,
  },
];

const decisionTextLimits = {
  title: 200,
  context: 1200,
  outcome: 2000,
  rationale: 2000,
} as const;

const baselineTextLimits = {
  scope: 5000,
  changeReason: 1500,
} as const;

const stageLabels: Record<string, string> = {
  INTAKE: 'Ingreso',
  DIAGNOSIS: 'Diagnóstico',
  VALIDATION: 'Validación',
  PREPARATION: 'Preparación',
  EXECUTION: 'Ejecución',
  CLOSURE: 'Cierre',
  PAUSED: 'En pausa',
  DECLINED: 'Descartado',
};

function todayISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Fecha no disponible';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return formatDate(value);
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function dateSpan(startDate: string, targetDate: string) {
  return `${formatDate(startDate)} – ${formatDate(targetDate)}`;
}

function initialBaselineDraft(
  props: Pick<Props, 'projectStartDate' | 'projectTargetDate'>,
  baseline?: ProjectBaseline,
): BaselineDraft {
  return {
    scope: baseline?.scope ?? '',
    startDate: baseline?.startDate ?? props.projectStartDate?.slice(0, 10) ?? '',
    targetDate: baseline?.targetDate ?? props.projectTargetDate?.slice(0, 10) ?? '',
    effortValue: baseline ? String(baseline.effortValue) : '',
    effortUnit: baseline?.effortUnit ?? 'DAYS',
    changeReason: '',
  };
}

export function ProjectTraceabilityTab({
  projectId,
  canEdit,
  externalRefreshKey = 0,
  projectStartDate,
  projectTargetDate,
  workflowHistory = [],
}: Props) {
  const [section, setSection] = useRouteSectionState<Section>(
    'traceSection',
    'chain',
    ['chain', 'decisions', 'baseline'],
    projectId,
  );
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [baselines, setBaselines] = useState<ProjectBaseline[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [filter, setFilter] = useState<'current' | 'all'>('current');
  const [dialog, setDialog] = useState<Dialog>(null);
  const [decisionDraft, setDecisionDraft] = useState<DecisionDraft>({
    title: '', context: '', outcome: '', rationale: '', decisionDate: todayISO(), subjectType: 'PROJECT', subjectId: null,
  });
  const [decisionTargets, setDecisionTargets] = useState<ProjectTraceabilityData | null>(null);
  const [decisionFocusId, setDecisionFocusId] = useState<string | null>(null);
  const [baselineDraft, setBaselineDraft] = useState<BaselineDraft>(initialBaselineDraft({ projectStartDate, projectTargetDate }));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState('');
  const [comparisonId, setComparisonId] = useState<string | null>(null);
  const combinedRefreshKey = refreshKey + externalRefreshKey;
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const savingRef = useRef(false);
  savingRef.current = saving;
  const currentBaseline = baselines.find((baseline) => baseline.isCurrent) ?? null;
  const comparisonBaseline = baselines.find((baseline) => baseline.id === comparisonId) ?? null;

  useEffect(() => {
    const handleTraceabilityNavigation = (event: Event) => {
      const detail = (event as CustomEvent<{ projectId: string; section: Section }>).detail;
      if (detail?.projectId === projectId) setSection(detail.section);
    };
    window.addEventListener('aether:project-traceability-section', handleTraceabilityNavigation);
    return () => window.removeEventListener('aether:project-traceability-section', handleTraceabilityNavigation);
  }, [projectId, setSection]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    Promise.all([projectApi.getDecisions(projectId), projectApi.getBaselines(projectId)])
      .then(([nextDecisions, nextBaselines]) => {
        if (!active) return;
        setDecisions(nextDecisions);
        setBaselines(nextBaselines);
        setComparisonId(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        setLoadError(error instanceof Error ? error.message : 'No se pudo cargar la trazabilidad del proyecto.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [projectId, combinedRefreshKey]);

  useEffect(() => {
    if (section !== 'decisions') return;
    let active = true;
    setDecisionTargets(null);
    projectApi.getTraceability(projectId)
      .then((traceability) => { if (active) setDecisionTargets(traceability); })
      .catch(() => { if (active) setDecisionTargets(null); });
    return () => { active = false; };
  }, [projectId, section, combinedRefreshKey]);

  useEffect(() => {
    if (section !== 'decisions' || !decisionFocusId || loading) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(`project-decision-${decisionFocusId}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setDecisionFocusId(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [section, decisionFocusId, loading]);

  useEffect(() => {
    if (section !== 'baseline' || loading) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get('traceAction') !== 'create-baseline') return;
    url.searchParams.delete('traceAction');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
    if (loadError || !canEdit) return;

    returnFocusRef.current = document.querySelector<HTMLElement>('[data-baseline-create]');
    setBaselineDraft(initialBaselineDraft({ projectStartDate, projectTargetDate }, currentBaseline ?? undefined));
    setFormError('');
    setFieldErrors({});
    setDialog({ kind: 'baseline' });
  }, [section, loading, loadError, canEdit, projectStartDate, projectTargetDate, currentBaseline]);

  useEffect(() => {
    if (!dialog) return;
    const panel = dialogRef.current;
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>(
      'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex="0"]',
    ) ?? []);
    focusable()[0]?.focus();
    const trapFocus = (event: globalThis.KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        if (!savingRef.current) {
          setDialog(null);
          setFormError('');
          setFieldErrors({});
          window.requestAnimationFrame(() => {
            returnFocusRef.current?.focus();
            returnFocusRef.current = null;
          });
        }
        return;
      }
      if (event.key !== 'Tab') return;
      const items = focusable();
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    panel?.addEventListener('keydown', trapFocus);
    return () => {
      panel?.removeEventListener('keydown', trapFocus);
    };
  }, [dialog]);

  const timeline = useMemo(() => {
    const records = decisions
      .filter((decision) => filter === 'all' || decision.isCurrent)
      .map((decision) => ({ kind: 'decision' as const, at: `${decision.decisionDate}T12:00:00`, decision }));
    const stageChanges = workflowHistory
      .filter((item) => item.fromStage !== item.toStage || item.decision || item.reason)
      .map((change) => ({ kind: 'stage' as const, at: change.createdAt, change }));
    return [...records, ...stageChanges].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [decisions, filter, workflowHistory]);
  const stageChangeCount = workflowHistory.filter((item) => item.fromStage !== item.toStage || item.decision || item.reason).length;

  function closeDialog() {
    if (saving) return;
    setDialog(null);
    setFormError('');
    setFieldErrors({});
    window.requestAnimationFrame(() => {
      returnFocusRef.current?.focus();
      returnFocusRef.current = null;
    });
  }

  function clearFieldError(fieldId: string) {
    setFieldErrors((current) => {
      if (!current[fieldId]) return current;
      const next = { ...current };
      delete next[fieldId];
      return next;
    });
  }

  function openDecisionDialog(supersedesId: string | null = null) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previous = decisions.find((decision) => decision.id === supersedesId);
    setDecisionDraft({ title: '', context: '', outcome: '', rationale: '', decisionDate: todayISO(), subjectType: previous?.subjectType ?? 'PROJECT', subjectId: previous?.subjectId ?? null });
    setFormError('');
    setFieldErrors({});
    setDialog({ kind: 'decision', supersedesId });
  }

  function openBaselineDialog() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setBaselineDraft(initialBaselineDraft({ projectStartDate, projectTargetDate }, currentBaseline ?? undefined));
    setFormError('');
    setFieldErrors({});
    setDialog({ kind: 'baseline' });
  }

  async function submitDecision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (dialog?.kind !== 'decision') return;
    setFormError('');
    const errors: FieldErrors = {};
    if (!decisionDraft.title.trim()) errors['decision-title'] = 'Escribe el acuerdo o pregunta que se resolverá.';
    if (!decisionDraft.outcome.trim()) errors['decision-outcome'] = 'Describe qué decidió el equipo.';
    if (!decisionDraft.rationale.trim()) errors['decision-rationale'] = 'Explica el motivo o la evidencia que respalda esta decisión.';
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const decision = await projectApi.createDecision(projectId, {
        ...decisionDraft,
        context: decisionDraft.context.trim() || null,
        supersedesId: dialog.supersedesId,
      });
      setDecisions((current) => [
        decision,
        ...current.map((item) => item.id === dialog.supersedesId
          ? { ...item, isCurrent: false, supersededById: decision.id }
          : item),
      ]);
      setFilter('all');
      setNotice(dialog.supersedesId ? 'La decisión anterior quedó reemplazada.' : 'La decisión quedó registrada.');
      setDialog(null);
      setFieldErrors({});
      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo registrar la decisión.');
    } finally {
      setSaving(false);
    }
  }

  async function submitBaseline(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');
    const errors: FieldErrors = {};
    if (!baselineDraft.scope.trim()) errors['baseline-scope'] = 'Describe el alcance acordado para esta línea base.';
    if (!baselineDraft.startDate) errors['baseline-start-date'] = 'Selecciona cuándo comienza el plan.';
    if (!baselineDraft.targetDate) errors['baseline-target-date'] = 'Selecciona la fecha objetivo del proyecto.';
    else if (baselineDraft.startDate && baselineDraft.targetDate < baselineDraft.startDate) {
      errors['baseline-target-date'] = 'La fecha objetivo debe ser igual o posterior al inicio.';
    }
    const effortValue = baselineDraft.effortValue.trim();
    const parsedEffort = Number(effortValue);
    if (!effortValue || !Number.isFinite(parsedEffort)) {
      errors['baseline-effort'] = 'Indica el esfuerzo estimado.';
    } else if (parsedEffort <= 0) {
      errors['baseline-effort'] = 'El esfuerzo debe ser mayor que cero.';
    } else if (parsedEffort > 9999999999.99) {
      errors['baseline-effort'] = 'El esfuerzo supera el máximo permitido.';
    } else if (Math.abs(parsedEffort * 100 - Math.round(parsedEffort * 100)) >= 0.000001) {
      errors['baseline-effort'] = 'Usa un máximo de dos decimales.';
    }
    if (Object.keys(errors).length) {
      setFieldErrors(errors);
      window.requestAnimationFrame(() => dialogRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus());
      return;
    }
    setSaving(true);
    setFormError('');
    setFieldErrors({});
    try {
      const baseline = await projectApi.createBaseline(projectId, {
        scope: baselineDraft.scope,
        startDate: baselineDraft.startDate,
        targetDate: baselineDraft.targetDate,
        effortValue: Number(baselineDraft.effortValue),
        effortUnit: baselineDraft.effortUnit,
        changeReason: baselineDraft.changeReason.trim() || null,
      });
      setBaselines((current) => [baseline, ...current.map((item) => ({ ...item, isCurrent: false }))]);
      setComparisonId(null);
      setNotice(`La línea base v${baseline.version} quedó guardada.`);
      setDialog(null);
      setFieldErrors({});
      window.requestAnimationFrame(() => {
        returnFocusRef.current?.focus();
        returnFocusRef.current = null;
      });
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar la línea base.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.root} aria-labelledby="traceability-heading">
      <header className={styles.pageHeader}>
        <div>
          <h2 id="traceability-heading">Trazabilidad del proyecto</h2>
          <p>Consulta qué se acordó y cómo han cambiado alcance, fechas y esfuerzo.</p>
        </div>
      </header>

      <div className={styles.sectionTabs} role="group" aria-label="Registros del proyecto">
        <button type="button" aria-pressed={section === 'chain'} className={section === 'chain' ? styles.sectionTabActive : styles.sectionTab} onClick={() => setSection('chain')}>
          <GitCompareArrows size={16} /> Cadena <span>Origen → impacto</span>
        </button>
        <button type="button" aria-pressed={section === 'decisions'} className={section === 'decisions' ? styles.sectionTabActive : styles.sectionTab} onClick={() => setSection('decisions')}>
          <Scale size={16} /> Decisiones <span>{decisions.length + stageChangeCount}</span>
        </button>
        <button type="button" aria-pressed={section === 'baseline'} className={section === 'baseline' ? styles.sectionTabActive : styles.sectionTab} onClick={() => setSection('baseline')}>
          <FileClock size={16} /> Línea base <span>{currentBaseline ? `v${currentBaseline.version}` : 'Sin crear'}</span>
        </button>
      </div>

      {notice && <p className={styles.notice} role="status"><Check size={15} /> {notice}<button type="button" aria-label="Cerrar aviso" onClick={() => setNotice('')}><X size={14} /></button></p>}

      {loading ? (
        <div className={styles.statePanel} role="status"><LoaderCircle className={styles.spinner} size={20} /> Cargando registros del proyecto…</div>
      ) : loadError ? (
        <div className={styles.statePanel} role="alert">
          <strong>No se pudo cargar la trazabilidad</strong>
          <span>{loadError}</span>
          <button type="button" className={styles.secondaryButton} onClick={() => setRefreshKey((value) => value + 1)}><RefreshCw size={14} /> Reintentar</button>
        </div>
      ) : section === 'chain' ? (
        <div key={section} className={styles.sectionContent}>
          <ProjectTraceabilityChain
            projectId={projectId}
            canEdit={canEdit}
            refreshKey={combinedRefreshKey}
            decisions={decisions}
            currentBaseline={currentBaseline}
            onOpenSection={setSection}
            onOpenDecision={(decisionId) => { setFilter('current'); setDecisionFocusId(decisionId); setSection('decisions'); }}
          />
        </div>
      ) : section === 'decisions' ? (
        <div key={section} className={styles.sectionContent}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>Registro de decisiones</h3>
              <p>Conserva el acuerdo, su motivo y quién lo registró. Los reemplazos mantienen el historial.</p>
            </div>
            {canEdit && <button type="button" className={styles.primaryButton} onClick={() => openDecisionDialog()}><Plus size={15} /> Registrar decisión</button>}
          </div>

          <div className={styles.listToolbar}>
            <div className={styles.filterGroup} role="group" aria-label="Filtrar decisiones">
              <button type="button" aria-pressed={filter === 'current'} className={filter === 'current' ? styles.filterActive : styles.filter} onClick={() => setFilter('current')}>Vigentes</button>
              <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? styles.filterActive : styles.filter} onClick={() => setFilter('all')}>Todo el historial</button>
            </div>
            <span>{decisions.length} {decisions.length === 1 ? 'decisión registrada' : 'decisiones registradas'}</span>
          </div>

          {timeline.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><Scale size={20} /></span>
              <h4>Aún no hay decisiones registradas</h4>
              <p>{canEdit ? 'Registra acuerdos del proyecto para conservar qué se eligió y por qué.' : 'No hay acuerdos registrados todavía. Pide a alguien con permiso de edición que registre la primera decisión.'}</p>
              {canEdit && <button type="button" className={styles.secondaryButton} onClick={() => openDecisionDialog()}><Plus size={14} /> Registrar la primera decisión</button>}
            </div>
          ) : (
            <ol className={styles.timeline}>
              {timeline.map((item) => item.kind === 'decision' ? (
                <li key={`decision-${item.decision.id}`} id={`project-decision-${item.decision.id}`} className={styles.timelineItem}>
                  <span className={styles.timelineMarker}><Scale size={14} /></span>
                  <article className={styles.record}>
                    <div className={styles.recordTopline}>
                      <span className={item.decision.isCurrent ? styles.statusCurrent : styles.statusReplaced}>
                        {item.decision.isCurrent ? 'Vigente' : 'Reemplazada'}
                      </span>
                      <time dateTime={item.decision.decisionDate}>{formatDate(item.decision.decisionDate)}</time>
                    </div>
                    <h4>{item.decision.title}</h4>
                    <span className={styles.decisionSubject}>
                      Afecta a {item.decision.subjectType === 'OBJECTIVE' ? 'Objetivo' : item.decision.subjectType === 'DELIVERABLE'
                        ? decisionTargets ? decisionTargets.deliverables.find((target) => target.id === item.decision.subjectId)?.name ?? 'Entregable eliminado' : 'Entregable'
                        : item.decision.subjectType === 'OUTCOME'
                          ? decisionTargets ? decisionTargets.outcomes.find((target) => target.id === item.decision.subjectId)?.metricName ?? 'Resultado eliminado' : 'Resultado medido'
                          : 'Proyecto en general'}
                    </span>
                    {item.decision.context && <p className={styles.context}>{item.decision.context}</p>}
                    <div className={styles.decisionBlock}>
                      <span>Decisión</span>
                      <p>{item.decision.outcome}</p>
                    </div>
                    <div className={styles.decisionBlock}>
                      <span>Motivo</span>
                      <p>{item.decision.rationale}</p>
                    </div>
                    <footer className={styles.recordFooter}>
                      <span>Registró {item.decision.recorderName}</span>
                      {canEdit && item.decision.isCurrent && <button type="button" className={styles.textButton} onClick={() => openDecisionDialog(item.decision.id)}><ArrowLeftRight size={13} /> Reemplazar</button>}
                    </footer>
                  </article>
                </li>
              ) : (
                <li key={`stage-${item.change.id}`} className={styles.timelineItem}>
                  <span className={`${styles.timelineMarker} ${styles.timelineMarkerStage}`}><ArrowLeftRight size={14} /></span>
                  <article className={`${styles.record} ${styles.stageRecord}`}>
                    <div className={styles.recordTopline}><span className={styles.stageBadge}>Cambio de etapa</span><time dateTime={item.change.createdAt}>{formatDateTime(item.change.createdAt)}</time></div>
                    <h4>{item.change.fromStage ? `${stageLabels[item.change.fromStage] ?? item.change.fromStage} → ` : ''}{stageLabels[item.change.toStage] ?? item.change.toStage}</h4>
                    {item.change.decision && <p className={styles.context}>Decisión: {item.change.decision.replace(/_/g, ' ').toLocaleLowerCase('es-CL')}</p>}
                    {item.change.reason && <div className={styles.decisionBlock}><span>Motivo</span><p>{item.change.reason}</p></div>}
                    <footer className={styles.recordFooter}><span>Registró {item.change.actorName ?? 'Persona del proyecto'}</span></footer>
                  </article>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div key={section} className={styles.sectionContent}>
          <div className={styles.sectionHeading}>
            <div>
              <h3>Línea base de alcance, fechas y esfuerzo</h3>
              <p>Guarda una referencia aprobada. Cada ajuste crea una versión nueva y conserva las anteriores.</p>
            </div>
            {canEdit && <button type="button" data-baseline-create className={styles.primaryButton} onClick={openBaselineDialog}><Plus size={15} /> {currentBaseline ? 'Crear nueva versión' : 'Crear línea base'}</button>}
          </div>

          {!currentBaseline ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><FileClock size={20} /></span>
              <h4>El proyecto aún no tiene una línea base</h4>
              <p>{canEdit ? 'Define el alcance acordado, sus fechas y el esfuerzo estimado. Esa será la versión inicial para comparar cambios.' : 'No existe una línea base todavía. Pide a alguien con permiso de edición que registre la versión inicial.'}</p>
              {canEdit && <button type="button" className={styles.secondaryButton} onClick={openBaselineDialog}><Plus size={14} /> Crear versión inicial</button>}
            </div>
          ) : (
            <>
              <article className={styles.currentBaseline}>
                <div className={styles.currentHeading}>
                  <div><span className={styles.currentTag}><Check size={12} /> VIGENTE</span><h4>Versión {currentBaseline.version}</h4></div>
                  <div className={styles.baselineMeta}><span>Creada {formatDate(currentBaseline.createdAt)}</span><span>por {currentBaseline.creatorName}</span></div>
                </div>
                <div className={styles.baselineFacts}>
                  <div><span>Fechas acordadas</span><strong><CalendarDays size={14} /> {dateSpan(currentBaseline.startDate, currentBaseline.targetDate)}</strong></div>
                  <div><span>Esfuerzo estimado</span><strong>{currentBaseline.effortValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {unitLabels[currentBaseline.effortUnit]}</strong></div>
                </div>
                <div className={styles.scopeBlock}><span>Alcance aprobado</span><p>{currentBaseline.scope}</p></div>
                {currentBaseline.changeReason && <p className={styles.changeReason}><ArrowLeftRight size={13} /> {currentBaseline.changeReason}</p>}
              </article>

              {comparisonBaseline && currentBaseline && (
                <section className={styles.comparison} aria-label={`Comparación de la versión ${comparisonBaseline.version} con la versión ${currentBaseline.version}`}>
                  <div className={styles.comparisonHeader}><div><GitCompareArrows size={16} /><h4>Comparación de versiones</h4></div><button type="button" className={styles.iconButton} aria-label="Cerrar comparación" onClick={() => setComparisonId(null)}><X size={15} /></button></div>
                  <div className={styles.compareColumns}>
                    <div className={styles.compareColumn}><span>Versión {comparisonBaseline.version}</span><p>{dateSpan(comparisonBaseline.startDate, comparisonBaseline.targetDate)}</p><p>{comparisonBaseline.effortValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {unitLabels[comparisonBaseline.effortUnit]}</p><p className={styles.compareScope}>{comparisonBaseline.scope}</p></div>
                    <div className={styles.compareColumn}><span>Versión {currentBaseline.version} vigente</span><p>{dateSpan(currentBaseline.startDate, currentBaseline.targetDate)}{comparisonBaseline.startDate !== currentBaseline.startDate || comparisonBaseline.targetDate !== currentBaseline.targetDate ? <b> Cambió</b> : null}</p><p>{currentBaseline.effortValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {unitLabels[currentBaseline.effortUnit]}{comparisonBaseline.effortValue !== currentBaseline.effortValue || comparisonBaseline.effortUnit !== currentBaseline.effortUnit ? <b> Cambió</b> : null}</p><p className={styles.compareScope}>{currentBaseline.scope}{comparisonBaseline.scope !== currentBaseline.scope ? <b> Cambió</b> : null}</p></div>
                  </div>
                </section>
              )}

              <div className={styles.historyHeader}><div><Clock3 size={15} /><h4>Historial de versiones</h4></div><span>{baselines.length} {baselines.length === 1 ? 'versión' : 'versiones'}</span></div>
              <ol className={styles.baselineHistory}>
                {baselines.map((baseline) => (
                  <li key={baseline.id} className={baseline.isCurrent ? styles.baselineVersionCurrent : styles.baselineVersion}>
                    <div className={styles.versionNumber}>v{baseline.version}</div>
                    <div className={styles.versionContent}>
                      <div className={styles.versionTitle}><strong>Versión {baseline.version}</strong>{baseline.isCurrent && <span>Vigente</span>}<time dateTime={baseline.createdAt}>{formatDate(baseline.createdAt)}</time></div>
                      <p>{dateSpan(baseline.startDate, baseline.targetDate)}, {baseline.effortValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })} {unitLabels[baseline.effortUnit]}</p>
                      <p className={styles.versionScope}>{baseline.scope}</p>
                      {baseline.changeReason && <p className={styles.versionReason}><ArrowLeftRight size={12} /> {baseline.changeReason}</p>}
                      {!baseline.isCurrent && <button type="button" className={styles.textButton} onClick={() => setComparisonId(baseline.id)}><GitCompareArrows size={13} /> Comparar con la vigente</button>}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}
        </div>
      )}

      {dialog && typeof document !== 'undefined' && createPortal(
        <div className={styles.backdrop}>
          <div ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="traceability-dialog-title">
            <header className={styles.dialogHeader}>
              <div><h3 id="traceability-dialog-title">{dialog.kind === 'decision' ? 'Registrar decisión' : currentBaseline ? `Crear versión ${currentBaseline.version + 1} de la línea base` : 'Crear línea base inicial'}</h3><p>{dialog.kind === 'decision' ? 'Deja el acuerdo y el motivo disponibles para el equipo.' : 'Esta versión quedará como referencia vigente del proyecto.'}</p></div>
              <button type="button" className={styles.iconButton} aria-label="Cerrar" onClick={closeDialog}><X size={17} /></button>
            </header>

            {dialog.kind === 'decision' ? (
              <form className={styles.dialogForm} onSubmit={submitDecision} noValidate>
                <div className={styles.dialogBody}>
                  {dialog.supersedesId && <p className={styles.replacementNotice}><ArrowLeftRight size={14} /> Al guardar, la decisión vigente seleccionada quedará reemplazada y seguirá visible en el historial.</p>}
                  <div className={styles.field}>
                    <span>Afecta a</span>
                    <ProjectOptionSelect
                      id="decision-subject"
                      label="Elemento al que afecta la decisión"
                      value={decisionDraft.subjectType === 'DELIVERABLE' || decisionDraft.subjectType === 'OUTCOME' ? `${decisionDraft.subjectType}:${decisionDraft.subjectId}` : decisionDraft.subjectType}
                      options={[
                        { value: 'PROJECT', label: 'Proyecto en general', description: 'Acuerdo transversal', icon: <Scale size={14} />, tone: 'neutral' as const },
                        ...(decisionTargets?.objective ? [{ value: 'OBJECTIVE', label: 'Objetivo', description: 'Dirección del proyecto', icon: <GitCompareArrows size={14} />, tone: 'accent' as const }] : []),
                        ...(decisionTargets?.deliverables ?? []).map((item) => ({ value: `DELIVERABLE:${item.id}`, label: item.name, description: 'Entregable', icon: <Check size={14} />, tone: 'neutral' as const })),
                        ...(decisionTargets?.outcomes ?? []).map((item) => ({ value: `OUTCOME:${item.id}`, label: item.metricName, description: 'Resultado medido', icon: <FileClock size={14} />, tone: 'neutral' as const })),
                      ]}
                      density="comfortable"
                      variant="contextual"
                      menuZIndex={1200}
                      closeOnTab
                      onChange={(value) => {
                        const [subjectType, subjectId] = value.split(':');
                        setDecisionDraft((current) => ({ ...current, subjectType: subjectType as ProjectDecision['subjectType'], subjectId: subjectId ?? null }));
                      }}
                    />
                    <small>La decisión aparecerá junto al elemento elegido. Las decisiones generales quedan solo en el registro.</small>
                  </div>
                  <label className={`${styles.field} ${fieldErrors['decision-title'] ? styles.fieldInvalid : ''}`}>
                    <span className={styles.fieldHeading}><span>Acuerdo o pregunta <em>Obligatorio</em></span><small className={styles.charCounter}>{decisionDraft.title.length}/{decisionTextLimits.title}</small></span>
                    <input id="decision-title" autoFocus maxLength={decisionTextLimits.title} value={decisionDraft.title} aria-required="true" aria-invalid={Boolean(fieldErrors['decision-title'])} aria-describedby={fieldErrors['decision-title'] ? 'decision-title-error' : undefined} onChange={(event) => { clearFieldError('decision-title'); setDecisionDraft((current) => ({ ...current, title: event.target.value })); }} placeholder="Ej. ¿Qué proveedor usaremos para los pagos?" />
                    {fieldErrors['decision-title'] && <small id="decision-title-error" className={styles.fieldError} role="alert">{fieldErrors['decision-title']}</small>}
                  </label>
                  <label className={styles.field}>
                    <span className={styles.fieldHeading}><span>Contexto <small>Opcional</small></span><small className={styles.charCounter}>{decisionDraft.context.length}/{decisionTextLimits.context}</small></span>
                    <textarea maxLength={decisionTextLimits.context} rows={3} value={decisionDraft.context} onChange={(event) => setDecisionDraft({ ...decisionDraft, context: event.target.value })} placeholder="Antecedentes y opciones que se evaluaron…" />
                  </label>
                  <label className={`${styles.field} ${fieldErrors['decision-outcome'] ? styles.fieldInvalid : ''}`}>
                    <span className={styles.fieldHeading}><span>Decisión tomada <em>Obligatorio</em></span><small className={styles.charCounter}>{decisionDraft.outcome.length}/{decisionTextLimits.outcome}</small></span>
                    <textarea id="decision-outcome" maxLength={decisionTextLimits.outcome} rows={3} value={decisionDraft.outcome} aria-required="true" aria-invalid={Boolean(fieldErrors['decision-outcome'])} aria-describedby={fieldErrors['decision-outcome'] ? 'decision-outcome-error' : undefined} onChange={(event) => { clearFieldError('decision-outcome'); setDecisionDraft((current) => ({ ...current, outcome: event.target.value })); }} placeholder="Describe qué acordó el equipo…" />
                    {fieldErrors['decision-outcome'] && <small id="decision-outcome-error" className={styles.fieldError} role="alert">{fieldErrors['decision-outcome']}</small>}
                  </label>
                  <label className={`${styles.field} ${fieldErrors['decision-rationale'] ? styles.fieldInvalid : ''}`}>
                    <span className={styles.fieldHeading}><span>Motivo y evidencia <em>Obligatorio</em></span><small className={styles.charCounter}>{decisionDraft.rationale.length}/{decisionTextLimits.rationale}</small></span>
                    <textarea id="decision-rationale" maxLength={decisionTextLimits.rationale} rows={3} value={decisionDraft.rationale} aria-required="true" aria-invalid={Boolean(fieldErrors['decision-rationale'])} aria-describedby={fieldErrors['decision-rationale'] ? 'decision-rationale-error' : undefined} onChange={(event) => { clearFieldError('decision-rationale'); setDecisionDraft((current) => ({ ...current, rationale: event.target.value })); }} placeholder="Explica por qué se eligió esta opción y qué se tuvo en cuenta…" />
                    {fieldErrors['decision-rationale'] && <small id="decision-rationale-error" className={styles.fieldError} role="alert">{fieldErrors['decision-rationale']}</small>}
                  </label>
                  <div className={styles.formGrid}>
                    <label className={styles.field}><span>Fecha de decisión</span><CalendarDatePicker label="Fecha de decisión" value={decisionDraft.decisionDate} onChange={(decisionDate) => setDecisionDraft({ ...decisionDraft, decisionDate })} portal matchTriggerWidth /></label>
                    <div className={styles.recorderField}><span>Registrada por</span><p>Tu cuenta de Aether</p><small>La persona autenticada queda guardada como autora del registro.</small></div>
                  </div>
                  {formError && <p className={styles.formError} role="alert">{formError}</p>}
                </div>
                <footer className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={closeDialog} disabled={saving}>Cancelar</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle className={styles.spinner} size={14} /> : <Check size={14} />} {saving ? 'Guardando…' : 'Guardar decisión'}</button></footer>
              </form>
            ) : (
              <form className={styles.dialogForm} onSubmit={submitBaseline} noValidate>
                <div className={styles.dialogBody}>
                  {currentBaseline && <p className={styles.replacementNotice}><FileClock size={14} /> La versión anterior se conservará y dejará de ser la vigente. Este registro no se puede editar después.</p>}
                  <label className={`${styles.field} ${fieldErrors['baseline-scope'] ? styles.fieldInvalid : ''}`}>
                    <span className={styles.fieldHeading}><span>Alcance acordado <em>Obligatorio</em></span><small className={styles.charCounter}>{baselineDraft.scope.length}/{baselineTextLimits.scope}</small></span>
                    <textarea id="baseline-scope" autoFocus maxLength={baselineTextLimits.scope} rows={5} value={baselineDraft.scope} aria-required="true" aria-invalid={Boolean(fieldErrors['baseline-scope'])} aria-describedby={fieldErrors['baseline-scope'] ? 'baseline-scope-error' : undefined} onChange={(event) => { clearFieldError('baseline-scope'); setBaselineDraft((current) => ({ ...current, scope: event.target.value })); }} placeholder="Describe entregables incluidos, límites y exclusiones…" />
                    {fieldErrors['baseline-scope'] && <small id="baseline-scope-error" className={styles.fieldError} role="alert">{fieldErrors['baseline-scope']}</small>}
                  </label>
                  <div className={styles.formGrid}>
                    <label className={`${styles.field} ${fieldErrors['baseline-start-date'] ? styles.fieldInvalid : ''}`}>
                      <span>Fecha de inicio <em>Obligatorio</em></span>
                      <CalendarDatePicker label="Fecha de inicio" value={baselineDraft.startDate} ariaInvalid={Boolean(fieldErrors['baseline-start-date'])} ariaDescribedBy={fieldErrors['baseline-start-date'] ? 'baseline-start-date-error' : undefined} onChange={(startDate) => { clearFieldError('baseline-start-date'); if (baselineDraft.targetDate && baselineDraft.targetDate < startDate) { clearFieldError('baseline-target-date'); setBaselineDraft((current) => ({ ...current, startDate, targetDate: '' })); } else { setBaselineDraft((current) => ({ ...current, startDate })); } }} portal matchTriggerWidth />
                      {fieldErrors['baseline-start-date'] && <small id="baseline-start-date-error" className={styles.fieldError} role="alert">{fieldErrors['baseline-start-date']}</small>}
                    </label>
                    <label className={`${styles.field} ${fieldErrors['baseline-target-date'] ? styles.fieldInvalid : ''}`}>
                      <span>Fecha objetivo <em>Obligatorio</em></span>
                      <CalendarDatePicker label="Fecha objetivo" value={baselineDraft.targetDate} min={baselineDraft.startDate || undefined} ariaInvalid={Boolean(fieldErrors['baseline-target-date'])} ariaDescribedBy={fieldErrors['baseline-target-date'] ? 'baseline-target-date-error' : undefined} onChange={(targetDate) => { clearFieldError('baseline-target-date'); setBaselineDraft((current) => ({ ...current, targetDate })); }} portal matchTriggerWidth />
                      {fieldErrors['baseline-target-date'] && <small id="baseline-target-date-error" className={styles.fieldError} role="alert">{fieldErrors['baseline-target-date']}</small>}
                    </label>
                    <div className={`${styles.field} ${styles.effortField} ${fieldErrors['baseline-effort'] ? styles.fieldInvalid : ''}`}>
                      <span>Esfuerzo estimado <em>Obligatorio</em></span>
                      <div className={styles.effortControls}>
                        <label className={styles.effortSubfield} htmlFor="baseline-effort">
                          <span>Cantidad</span>
                          <input id="baseline-effort" type="number" min="0.01" max="9999999999.99" step="0.01" value={baselineDraft.effortValue} aria-required="true" aria-invalid={Boolean(fieldErrors['baseline-effort'])} aria-describedby={fieldErrors['baseline-effort'] ? 'baseline-effort-error baseline-effort-hint' : 'baseline-effort-hint'} onChange={(event) => { clearFieldError('baseline-effort'); setBaselineDraft((current) => ({ ...current, effortValue: event.target.value })); }} placeholder="Ej. 24" />
                        </label>
                        <div className={styles.effortSubfield}>
                          <span>Unidad</span>
                          <ProjectOptionSelect id="baseline-effort-unit" label="Unidad del esfuerzo estimado" value={baselineDraft.effortUnit} options={effortUnitOptions} density="comfortable" variant="contextual" onChange={(effortUnit) => setBaselineDraft({ ...baselineDraft, effortUnit: effortUnit as ProjectBaselineEffortUnit })} menuZIndex={1200} closeOnTab />
                        </div>
                      </div>
                      {fieldErrors['baseline-effort'] && <small id="baseline-effort-error" className={styles.fieldError} role="alert">{fieldErrors['baseline-effort']}</small>}
                      <small id="baseline-effort-hint" className={styles.effortHint}>La unidad explica la cantidad: horas, días-persona (1 persona × 1 día) o puntos de historia (complejidad relativa).</small>
                    </div>
                  </div>
                  {currentBaseline && <label className={`${styles.field} ${fieldErrors['baseline-change-reason'] ? styles.fieldInvalid : ''}`}>
                    <span className={styles.fieldHeading}><span>Motivo del cambio <em>Obligatorio</em></span><small className={styles.charCounter}>{baselineDraft.changeReason.length}/{baselineTextLimits.changeReason}</small></span>
                    <textarea id="baseline-change-reason" maxLength={baselineTextLimits.changeReason} rows={3} value={baselineDraft.changeReason} aria-required="true" aria-invalid={Boolean(fieldErrors['baseline-change-reason'])} aria-describedby={fieldErrors['baseline-change-reason'] ? 'baseline-change-reason-error' : undefined} onChange={(event) => { clearFieldError('baseline-change-reason'); setBaselineDraft((current) => ({ ...current, changeReason: event.target.value })); }} placeholder="Qué cambió y qué acuerdo o evidencia respalda la actualización…" />
                    {fieldErrors['baseline-change-reason'] && <small id="baseline-change-reason-error" className={styles.fieldError} role="alert">{fieldErrors['baseline-change-reason']}</small>}
                  </label>}
                  {!currentBaseline && <p className={styles.helperNote}>La primera versión será el punto de comparación para los cambios futuros.</p>}
                  {formError && <p className={styles.formError} role="alert">{formError}</p>}
                </div>
                <footer className={styles.dialogActions}><button type="button" className={styles.secondaryButton} onClick={closeDialog} disabled={saving}>Cancelar</button><button type="submit" className={styles.primaryButton} disabled={saving}>{saving ? <LoaderCircle className={styles.spinner} size={14} /> : <Check size={14} />} {saving ? 'Guardando…' : 'Guardar línea base'}</button></footer>
              </form>
            )}
          </div>
        </div>,
        document.body,
      )}
    </section>
  );
}
