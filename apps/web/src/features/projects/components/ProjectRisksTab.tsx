'use client';

import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowRight,
  AlertTriangle,
  CalendarDays,
  CalendarClock,
  Check,
  ChevronDown,
  ClipboardList,
  LoaderCircle,
  Pencil,
  Plus,
  RefreshCw,
  ShieldCheck,
  ShieldAlert,
  UserRound,
  X,
} from 'lucide-react';
import { CalendarDatePicker } from '@/components/calendar/DateTimePickers';
import {
  projectApi,
  type ProjectRisk,
  type ProjectRiskInput,
  type ProjectRiskOwner,
  type ProjectRiskStatus,
} from '@/features/projects/api';
import styles from './ProjectRisksTab.module.css';

type Draft = {
  title: string;
  description: string;
  probability: number;
  impact: number;
  residualProbability: number | null;
  residualImpact: number | null;
  mitigationPlan: string;
  ownerId: string;
  status: ProjectRiskStatus;
  nextReviewAt: string;
};

type Filter = 'active' | 'all';

const RISK_TITLE_MAX_LENGTH = 255;
const RISK_TEXT_MAX_LENGTH = 5000;

const emptyDraft = (ownerId = ''): Draft => ({
  title: '', description: '', probability: 3, impact: 3,
  residualProbability: null, residualImpact: null,
  mitigationPlan: '', ownerId, status: 'OPEN', nextReviewAt: '',
});

const statusCopy: Record<ProjectRiskStatus, string> = {
  OPEN: 'Abierto', MITIGATING: 'En mitigación', ACCEPTED: 'Aceptado', CLOSED: 'Cerrado',
};
const statusDescriptions: Record<ProjectRiskStatus, string> = {
  OPEN: 'Registrado y pendiente de respuesta',
  MITIGATING: 'El plan de respuesta está en marcha',
  ACCEPTED: 'El equipo asume esta exposición',
  CLOSED: 'Ya no requiere seguimiento activo',
};

const probabilityLabels = ['Rara', 'Poco probable', 'Posible', 'Probable', 'Casi segura'];
const impactLabels = ['Insignificante', 'Menor', 'Moderado', 'Mayor', 'Crítico'];
const probabilityDescriptions = [
  'Solo ocurriría en circunstancias excepcionales',
  'Podría ocurrir de forma ocasional',
  'Es posible durante el proyecto',
  'Es esperable que ocurra',
  'Casi seguro que ocurrirá',
];
const impactDescriptions = [
  'Efecto mínimo en el trabajo',
  'Retrabajo acotado al equipo',
  'Afecta plazos o entregables',
  'Compromete un hito o el alcance',
  'Amenaza los objetivos del proyecto',
];

type RiskTone = 'low' | 'medium' | 'high' | 'critical' | 'neutral';

type RiskSelectOption = {
  value: string;
  label: string;
  description?: string;
  score?: string;
  tone?: RiskTone;
  icon?: ReactNode;
};

function toneClass(tone: RiskTone = 'neutral') {
  return styles[`tone${tone[0].toUpperCase()}${tone.slice(1)}` as keyof typeof styles];
}

function dimensionTone(value: number): RiskTone {
  if (value >= 5) return 'critical';
  if (value >= 4) return 'high';
  if (value >= 3) return 'medium';
  return 'low';
}

function RiskSelect({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecciona una opción',
  disabled = false,
  labelledBy,
}: {
  label: string;
  value: string;
  options: RiskSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  labelledBy?: string;
}) {
  const id = useId();
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLDivElement | null>>([]);
  const typeaheadRef = useRef('');
  const typeaheadTimerRef = useRef<number | null>(null);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(Math.max(0, selectedIndex));
  const [menuPosition, setMenuPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!rootRef.current?.contains(target) && !menuRef.current?.contains(target)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    return () => document.removeEventListener('pointerdown', closeOnOutsidePointer);
  }, [open]);

  useLayoutEffect(() => {
    if (!open) {
      setMenuPosition(null);
      return;
    }
    const updatePosition = () => {
      const anchor = triggerRef.current?.getBoundingClientRect();
      const menu = menuRef.current;
      if (!anchor || !menu) return;
      const edge = 10;
      const width = Math.min(anchor.width, window.innerWidth - edge * 2);
      const height = Math.min(menu.scrollHeight, window.innerHeight - edge * 2);
      const left = Math.max(edge, Math.min(anchor.left, window.innerWidth - width - edge));
      const below = window.innerHeight - anchor.bottom - edge;
      const placeAbove = below < height + 8 && anchor.top > height + edge;
      const top = placeAbove
        ? anchor.top - height - 8
        : Math.min(anchor.bottom + 8, window.innerHeight - height - edge);
      setMenuPosition({ top, left, width });
    };
    updatePosition();
    const frame = window.requestAnimationFrame(() => optionRefs.current[activeIndex]?.focus({ preventScroll: true }));
    window.addEventListener('resize', updatePosition);
    document.addEventListener('scroll', updatePosition, true);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('resize', updatePosition);
      document.removeEventListener('scroll', updatePosition, true);
    };
  }, [open, activeIndex, options.length]);

  function openAt(index: number) {
    if (disabled || options.length === 0) return;
    setActiveIndex(Math.max(0, Math.min(index, options.length - 1)));
    setOpen(true);
  }

  function closeAndRestoreFocus() {
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function choose(option: RiskSelectOption) {
    if (disabled) return;
    onChange(option.value);
    closeAndRestoreFocus();
  }

  function moveActive(nextIndex: number) {
    const next = (nextIndex + options.length) % options.length;
    setActiveIndex(next);
    optionRefs.current[next]?.focus();
    optionRefs.current[next]?.scrollIntoView({ block: 'nearest' });
  }

  function handleTriggerKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>) {
    if (disabled || options.length === 0) return;
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ')) {
      event.preventDefault();
      openAt(event.key === 'ArrowUp' ? (selectedIndex >= 0 ? selectedIndex : options.length - 1) : Math.max(selectedIndex, 0));
    } else if (open && event.key === 'Escape') {
      event.preventDefault();
      closeAndRestoreFocus();
    }
  }

  function handleMenuKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveActive(activeIndex + 1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveActive(activeIndex - 1);
    } else if (event.key === 'Home') {
      event.preventDefault();
      moveActive(0);
    } else if (event.key === 'End') {
      event.preventDefault();
      moveActive(options.length - 1);
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      const option = options[activeIndex];
      if (option) choose(option);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      closeAndRestoreFocus();
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      typeaheadRef.current += event.key.toLocaleLowerCase();
      if (typeaheadTimerRef.current) window.clearTimeout(typeaheadTimerRef.current);
      typeaheadTimerRef.current = window.setTimeout(() => { typeaheadRef.current = ''; }, 600);
      const match = Array.from({ length: options.length }, (_, offset) => (activeIndex + offset) % options.length)
        .find((index) => options[index].label.toLocaleLowerCase().startsWith(typeaheadRef.current));
      if (match !== undefined) moveActive(match);
    }
  }

  const menu = open && typeof document !== 'undefined' ? createPortal(
    <div
      ref={menuRef}
      id={`${id}-listbox`}
      className={styles.selectMenu}
      role="listbox"
      aria-label={label}
      onKeyDown={handleMenuKeyDown}
      style={{
        position: 'fixed',
        top: menuPosition?.top ?? 0,
        left: menuPosition?.left ?? 0,
        width: menuPosition?.width ?? triggerRef.current?.getBoundingClientRect().width,
        visibility: menuPosition ? 'visible' : 'hidden',
      }}
    >
      {options.map((option, index) => (
        <div
          key={option.value}
          ref={(element) => { optionRefs.current[index] = element; }}
          id={`${id}-option-${index}`}
          role="option"
          aria-selected={option.value === value}
          tabIndex={index === activeIndex ? 0 : -1}
          className={`${styles.selectOption} ${index === activeIndex ? styles.selectOptionActive : ''} ${option.value === value ? styles.selectOptionSelected : ''}`}
          onFocus={() => setActiveIndex(index)}
          onPointerEnter={() => setActiveIndex(index)}
          onClick={() => choose(option)}
        >
          {option.score ? (
            <span className={`${styles.optionScore} ${toneClass(option.tone)}`}>{option.score}</span>
          ) : option.icon ? (
            <span className={styles.optionIcon}>{option.icon}</span>
          ) : null}
          <span className={styles.optionCopy}>
            <strong>{option.label}</strong>
            {option.description && <small>{option.description}</small>}
          </span>
          {option.value === value && <Check className={styles.optionCheck} size={16} aria-hidden="true" />}
        </div>
      ))}
    </div>,
    document.body,
  ) : null;

  return (
    <div ref={rootRef} className={styles.selectRoot}>
      <button
        ref={triggerRef}
        type="button"
        className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
        aria-label={labelledBy ? undefined : `${label}: ${selectedOption?.label ?? placeholder}`}
        aria-labelledby={labelledBy ? `${labelledBy} ${id}-value` : undefined}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-controls={`${id}-listbox`}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex >= 0 ? selectedIndex : 0))}
        onKeyDown={handleTriggerKeyDown}
      >
        {selectedOption?.score ? (
          <span className={`${styles.optionScore} ${toneClass(selectedOption.tone)}`}>{selectedOption.score}</span>
        ) : selectedOption?.icon ? (
          <span className={styles.optionIcon}>{selectedOption.icon}</span>
        ) : null}
        <span id={`${id}-value`} className={`${styles.selectCurrent} ${!selectedOption ? styles.selectPlaceholder : ''}`}>
          <strong>{selectedOption?.label ?? placeholder}</strong>
          {selectedOption?.description && <small>{selectedOption.description}</small>}
        </span>
        <ChevronDown size={16} className={styles.selectChevron} aria-hidden="true" />
      </button>
      {menu}
    </div>
  );
}

function scoreTone(score: number) {
  if (score >= 16) return styles.critical;
  if (score >= 10) return styles.high;
  if (score >= 5) return styles.medium;
  return styles.low;
}

function scoreName(score: number) {
  if (score >= 16) return 'Crítico';
  if (score >= 10) return 'Alto';
  if (score >= 5) return 'Moderado';
  return 'Bajo';
}

function formatReviewDate(value: string | null) {
  if (!value) return 'Sin fecha de revisión';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Fecha no disponible';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(date);
}

function isReviewOverdue(risk: ProjectRisk) {
  if (!risk.nextReviewAt || risk.status === 'CLOSED') return false;
  const date = new Date(`${risk.nextReviewAt.slice(0, 10)}T00:00:00`);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return !Number.isNaN(date.getTime()) && date < today;
}

function draftFromRisk(risk: ProjectRisk): Draft {
  return {
    title: risk.title,
    description: risk.description ?? '',
    probability: risk.probability,
    impact: risk.impact,
    residualProbability: risk.residualProbability,
    residualImpact: risk.residualImpact,
    mitigationPlan: risk.mitigationPlan,
    ownerId: risk.ownerId ?? '',
    status: risk.status,
    nextReviewAt: risk.nextReviewAt?.slice(0, 10) ?? '',
  };
}

export function ProjectRisksTab({
  projectId,
  canEdit,
  refreshKey = 0,
}: {
  projectId: string;
  canEdit: boolean;
  refreshKey?: number;
}) {
  const [risks, setRisks] = useState<ProjectRisk[]>([]);
  const [owners, setOwners] = useState<ProjectRiskOwner[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [filter, setFilter] = useState<Filter>('active');
  const [showForm, setShowForm] = useState(false);
  const [editingRiskId, setEditingRiskId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const formRef = useRef<HTMLFormElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!showForm) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const focusFrame = window.requestAnimationFrame(() => {
      const firstField = formRef.current?.querySelector<HTMLElement>(
        'input:not(:disabled), textarea:not(:disabled), button:not(:disabled)',
      );
      firstField?.focus({ preventScroll: true });
    });

    const handleModalKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        return;
      }
      if (event.key !== 'Tab') return;

      const form = formRef.current;
      if (!form) return;
      const selector = 'button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';
      const inForm = Array.from(form.querySelectorAll<HTMLElement>(selector));
      const inPortals = Array.from(document.querySelectorAll<HTMLElement>(
        '[role="listbox"] [tabindex="0"], [role="dialog"][aria-label^="Seleccionar "] button:not([disabled])',
      ));
      const focusable = [...new Set([...inForm, ...inPortals])].filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;

      const currentIndex = focusable.indexOf(document.activeElement as HTMLElement);
      const nextIndex = event.shiftKey
        ? (currentIndex <= 0 ? focusable.length - 1 : currentIndex - 1)
        : (currentIndex < 0 || currentIndex === focusable.length - 1 ? 0 : currentIndex + 1);
      event.preventDefault();
      focusable[nextIndex]?.focus();
    };

    document.addEventListener('keydown', handleModalKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFrame);
      document.removeEventListener('keydown', handleModalKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showForm]);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setLoadError('');
    projectApi.getRisks(projectId)
      .then((data) => {
        if (!current) return;
        setRisks(data.risks);
        setOwners(data.owners);
        setDraft((previous) => previous.ownerId ? previous : emptyDraft(data.owners[0]?.id ?? ''));
      })
      .catch((error) => {
        if (current) setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los riesgos.');
      })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [projectId, refreshKey, retryKey]);

  const activeRisks = useMemo(() => risks.filter((risk) => risk.status !== 'CLOSED'), [risks]);
  const overdueReviews = useMemo(() => activeRisks.filter(isReviewOverdue).length, [activeRisks]);
  const criticalRisks = useMemo(() => activeRisks.filter((risk) => risk.residualScore >= 16).length, [activeRisks]);
  const visibleRisks = filter === 'active' ? activeRisks : risks;
  const probabilityOptions = probabilityLabels.map((label, index): RiskSelectOption => ({
    value: String(index + 1),
    label,
    description: probabilityDescriptions[index],
    score: String(index + 1).padStart(2, '0'),
    tone: dimensionTone(index + 1),
  }));
  const impactOptions = impactLabels.map((label, index): RiskSelectOption => ({
    value: String(index + 1),
    label,
    description: impactDescriptions[index],
    score: String(index + 1).padStart(2, '0'),
    tone: dimensionTone(index + 1),
  }));
  const residualProbabilityOptions: RiskSelectOption[] = [
    { value: 'same', label: 'Igual a la inherente', description: `Conserva el nivel: ${probabilityLabels[draft.probability - 1]}`, score: '=', tone: 'neutral' },
    ...probabilityOptions,
  ];
  const residualImpactOptions: RiskSelectOption[] = [
    { value: 'same', label: 'Igual al inherente', description: `Conserva el nivel: ${impactLabels[draft.impact - 1]}`, score: '=', tone: 'neutral' },
    ...impactOptions,
  ];
  const ownerOptions = owners.map((owner): RiskSelectOption => ({
    value: owner.id,
    label: owner.name,
    description: owner.email,
    icon: <UserRound size={16} aria-hidden="true" />,
  }));
  const statusOptions = (Object.keys(statusCopy) as ProjectRiskStatus[]).map((status): RiskSelectOption => ({
    value: status,
    label: statusCopy[status],
    description: statusDescriptions[status],
    icon: status === 'CLOSED' ? <Check size={16} aria-hidden="true" /> : status === 'MITIGATING' ? <Activity size={16} aria-hidden="true" /> : status === 'ACCEPTED' ? <ShieldCheck size={16} aria-hidden="true" /> : <AlertTriangle size={16} aria-hidden="true" />,
  }));
  const inherentScore = draft.probability * draft.impact;
  const residualScore = (draft.residualProbability ?? draft.probability) * (draft.residualImpact ?? draft.impact);

  function startCreate() {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingRiskId(null);
    setDraft(emptyDraft(owners[0]?.id ?? ''));
    setFormError('');
    setShowForm(true);
  }

  function startEdit(risk: ProjectRisk) {
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    setEditingRiskId(risk.id);
    setDraft(draftFromRisk(risk));
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingRiskId(null);
    setFormError('');
    window.requestAnimationFrame(() => {
      if (returnFocusRef.current?.isConnected) returnFocusRef.current.focus();
      returnFocusRef.current = null;
    });
  }

  async function saveRisk(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    const input: ProjectRiskInput = {
      title: draft.title.trim(),
      description: draft.description.trim() || null,
      probability: draft.probability,
      impact: draft.impact,
      residualProbability: draft.residualProbability,
      residualImpact: draft.residualImpact,
      mitigationPlan: draft.mitigationPlan.trim(),
      ownerId: draft.ownerId,
      status: draft.status,
      nextReviewAt: draft.nextReviewAt || null,
    };
    try {
      const saved = editingRiskId
        ? await projectApi.updateRisk(projectId, editingRiskId, input)
        : await projectApi.createRisk(projectId, input);
      setRisks((current) => editingRiskId
        ? current.map((risk) => risk.id === saved.id ? saved : risk)
        : [saved, ...current]);
      closeForm();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'No se pudo guardar el riesgo. Inténtalo de nuevo.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className={styles.root} aria-labelledby="project-risks-title" aria-busy={loading}>
      <header className={styles.heading}>
        <div>
          <h2 id="project-risks-title">Registro de riesgos</h2>
          <p>Evalúa exposición, asigna a una persona responsable y deja visible cómo se responderá.</p>
        </div>
        {canEdit && (
          <button type="button" className={styles.primaryButton} onClick={startCreate} disabled={loading || owners.length === 0}>
            <Plus size={16} /> Registrar riesgo
          </button>
        )}
      </header>

      <div className={styles.summary} aria-label="Resumen de riesgos del proyecto">
        <div><span>Riesgos activos</span><strong>{activeRisks.length}</strong></div>
        <div><span>Exposición crítica</span><strong className={criticalRisks ? styles.summaryAlert : ''}>{criticalRisks}</strong></div>
        <div><span>Revisiones vencidas</span><strong className={overdueReviews ? styles.summaryAlert : ''}>{overdueReviews}</strong></div>
        <small>El puntaje residual se calcula sobre una matriz de probabilidad × impacto de 1 a 5.</small>
      </div>

      {showForm && (
        createPortal(
        <div className={styles.modalBackdrop}>
        <form ref={formRef} className={styles.formPanel} onSubmit={saveRisk} role="dialog" aria-modal="true" aria-labelledby="risk-form-title">
          <div className={styles.formHeading}>
            <div>
              <h3 id="risk-form-title">{editingRiskId ? 'Editar riesgo' : 'Nuevo riesgo'}</h3>
              <p>Describe qué podría ocurrir, decide cómo responder y estima qué exposición quedará.</p>
            </div>
            <button type="button" className={styles.iconButton} aria-label="Cerrar formulario" onClick={closeForm} disabled={saving}><X size={17} /></button>
          </div>

          <div className={styles.formBody}>
          {owners.length === 0 ? (
            <p className={styles.formError} role="alert">Para asignar el riesgo, primero agrega una persona al proyecto o a uno de sus equipos.</p>
          ) : (
            <>
              <section className={styles.formSection} aria-labelledby="risk-identify-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionIcon}><ClipboardList size={16} aria-hidden="true" /></span>
                  <div><h4 id="risk-identify-title">Describe el riesgo</h4><p>Enuncia la incertidumbre de forma concreta para que el equipo pueda reconocerla.</p></div>
                </div>
                <div className={styles.formGrid}>
                  <label className={`${styles.field} ${styles.fullField}`}>
                    <span>¿Qué podría ocurrir? <em>Requerido</em><small className={styles.characterCount}>{draft.title.length}/{RISK_TITLE_MAX_LENGTH}</small></span>
                    <input autoFocus={!editingRiskId} maxLength={RISK_TITLE_MAX_LENGTH} required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="Ej. El proveedor podría retrasar la entrega crítica" />
                  </label>
                  <label className={`${styles.field} ${styles.fullField}`}>
                    <span>Contexto y causa <small>Opcional</small><small className={styles.characterCount}>{draft.description.length}/{RISK_TEXT_MAX_LENGTH}</small></span>
                    <textarea maxLength={RISK_TEXT_MAX_LENGTH} rows={2} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="¿Qué lo puede provocar y a qué parte del proyecto afectaría?" />
                  </label>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="risk-inherent-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionIcon}><Activity size={16} aria-hidden="true" /></span>
                  <div><h4 id="risk-inherent-title">Evalúa la exposición inicial</h4><p>Valora probabilidad e impacto antes de aplicar una respuesta.</p></div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <span id="risk-probability-label">Probabilidad inherente</span>
                    <RiskSelect label="Probabilidad inherente" labelledBy="risk-probability-label" value={String(draft.probability)} options={probabilityOptions} disabled={saving} onChange={(value) => setDraft({ ...draft, probability: Number(value) })} />
                  </div>
                  <div className={styles.field}>
                    <span id="risk-impact-label">Impacto inherente</span>
                    <RiskSelect label="Impacto inherente" labelledBy="risk-impact-label" value={String(draft.impact)} options={impactOptions} disabled={saving} onChange={(value) => setDraft({ ...draft, impact: Number(value) })} />
                  </div>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="risk-response-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionIcon}><ShieldCheck size={16} aria-hidden="true" /></span>
                  <div><h4 id="risk-response-title">Define la respuesta</h4><p>Asigna a una persona y registra las acciones que reducirán o manejarán la exposición.</p></div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <span id="risk-owner-label">Responsable <em>Requerido</em></span>
                    <RiskSelect label="Responsable" labelledBy="risk-owner-label" value={draft.ownerId} options={ownerOptions} placeholder="Elige quién lo seguirá" disabled={saving} onChange={(ownerId) => setDraft({ ...draft, ownerId })} />
                  </div>
                  {editingRiskId && (
                    <div className={styles.field}>
                      <span id="risk-status-label">Estado del riesgo</span>
                      <RiskSelect label="Estado del riesgo" labelledBy="risk-status-label" value={draft.status} options={statusOptions} disabled={saving} onChange={(status) => setDraft({ ...draft, status: status as ProjectRiskStatus })} />
                    </div>
                  )}
                  <label className={`${styles.field} ${styles.fullField}`}>
                    <span>Plan de mitigación o respuesta <em>Requerido</em><small className={styles.characterCount}>{draft.mitigationPlan.length}/{RISK_TEXT_MAX_LENGTH}</small></span>
                    <textarea maxLength={RISK_TEXT_MAX_LENGTH} required rows={3} value={draft.mitigationPlan} onChange={(event) => setDraft({ ...draft, mitigationPlan: event.target.value })} placeholder="Describe acciones, responsables de ejecución y cómo sabrán que la respuesta funciona." />
                  </label>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="risk-residual-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionIcon}><Activity size={16} aria-hidden="true" /></span>
                  <div><h4 id="risk-residual-title">Estima lo que quedará</h4><p>Recalifica después de la respuesta. Si no cambia, conserva el nivel inherente.</p></div>
                </div>
                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <span id="risk-residual-probability-label">Probabilidad residual</span>
                    <RiskSelect
                      label="Probabilidad residual"
                      labelledBy="risk-residual-probability-label"
                      value={draft.residualProbability === null ? 'same' : String(draft.residualProbability)}
                      options={residualProbabilityOptions}
                      disabled={saving}
                      onChange={(value) => setDraft({ ...draft, residualProbability: value === 'same' ? null : Number(value) })}
                    />
                  </div>
                  <div className={styles.field}>
                    <span id="risk-residual-impact-label">Impacto residual</span>
                    <RiskSelect
                      label="Impacto residual"
                      labelledBy="risk-residual-impact-label"
                      value={draft.residualImpact === null ? 'same' : String(draft.residualImpact)}
                      options={residualImpactOptions}
                      disabled={saving}
                      onChange={(value) => setDraft({ ...draft, residualImpact: value === 'same' ? null : Number(value) })}
                    />
                  </div>
                </div>
                <div className={styles.scoreComparison} aria-live="polite">
                  <div className={styles.scoreCard}>
                    <span>Antes de responder</span>
                    <div><strong>{inherentScore}</strong><small>/25</small><em className={scoreTone(inherentScore)}>{scoreName(inherentScore)}</em></div>
                    <small>{draft.probability} × {draft.impact}</small>
                  </div>
                  <ArrowRight className={styles.scoreArrow} size={18} aria-hidden="true" />
                  <div className={styles.scoreCard}>
                    <span>Después de responder</span>
                    <div><strong>{residualScore}</strong><small>/25</small><em className={scoreTone(residualScore)}>{scoreName(residualScore)}</em></div>
                    <small>{draft.residualProbability ?? draft.probability} × {draft.residualImpact ?? draft.impact}</small>
                  </div>
                  <p>La cartera prioriza la exposición residual del proyecto.</p>
                </div>
              </section>

              <section className={styles.formSection} aria-labelledby="risk-review-title">
                <div className={styles.sectionHeading}>
                  <span className={styles.sectionIcon}><CalendarDays size={16} aria-hidden="true" /></span>
                  <div><h4 id="risk-review-title">Programa una revisión</h4><p>Define cuándo volver a comprobar el riesgo y la respuesta.</p></div>
                </div>
                <div className={styles.reviewGrid}>
                  <div className={styles.field}>
                    <span>Próxima revisión <small>Opcional</small></span>
                    <div className={styles.datePickerControl}>
                      <CalendarDatePicker
                        label="Fecha de próxima revisión"
                        value={draft.nextReviewAt}
                        onChange={(nextReviewAt) => setDraft({ ...draft, nextReviewAt })}
                        portal
                        matchTriggerWidth
                      />
                      {draft.nextReviewAt && (
                        <button type="button" className={styles.clearDateButton} aria-label="Quitar fecha de revisión" onClick={() => setDraft({ ...draft, nextReviewAt: '' })} disabled={saving}>
                          <X size={15} aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </div>
                  <p className={styles.reviewHint}>Una fecha mantiene visible cuándo debe revisarse la mitigación. Puedes dejarla vacía si aún no está acordada.</p>
                </div>
              </section>
            </>
          )}

          {formError && <p className={styles.formError} role="alert">{formError}</p>}
          </div>
          <div className={styles.formActions}>
            <button type="button" className={styles.secondaryButton} onClick={closeForm} disabled={saving}>Cancelar</button>
            <button type="submit" className={styles.primaryButton} disabled={saving || owners.length === 0}>
              {saving ? <LoaderCircle className={styles.spin} size={15} /> : <Check size={15} />}
              {saving ? 'Guardando…' : editingRiskId ? 'Guardar cambios' : 'Guardar riesgo'}
            </button>
          </div>
        </form>
        </div>,
        document.body,
        )
      )}

      <div className={styles.listHeader}>
        <div>
          <h3>Exposición registrada</h3>
          <span>{visibleRisks.length} {visibleRisks.length === 1 ? 'registro' : 'registros'}</span>
        </div>
        <div className={styles.filters} aria-label="Filtrar riesgos">
          <button type="button" aria-pressed={filter === 'active'} className={filter === 'active' ? styles.filterActive : styles.filter} onClick={() => setFilter('active')}>Activos</button>
          <button type="button" aria-pressed={filter === 'all'} className={filter === 'all' ? styles.filterActive : styles.filter} onClick={() => setFilter('all')}>Todos</button>
        </div>
      </div>

      {loading ? (
        <div className={styles.loading} role="status"><LoaderCircle className={styles.spin} size={18} /> Cargando registro de riesgos…</div>
      ) : loadError ? (
        <div className={styles.emptyState} role="alert">
          <AlertTriangle size={20} />
          <strong>No se pudo cargar el registro</strong>
          <p>{loadError}</p>
          <button type="button" className={styles.secondaryButton} onClick={() => setRetryKey((key) => key + 1)}><RefreshCw size={14} /> Reintentar</button>
        </div>
      ) : visibleRisks.length === 0 ? (
        <div className={styles.emptyState}>
          <ShieldAlert size={22} />
          <strong>{filter === 'all' ? 'Todavía no hay riesgos registrados' : 'No hay riesgos activos'}</strong>
          <p>{filter === 'all' ? 'Cuando el equipo identifique una incertidumbre, documenta su exposición y respuesta.' : 'Los riesgos cerrados se conservan en el historial del proyecto.'}</p>
          {canEdit && filter === 'all' && owners.length > 0 && <button type="button" className={styles.secondaryButton} onClick={startCreate}><Plus size={14} /> Registrar el primero</button>}
        </div>
      ) : (
        <div className={styles.riskList}>
          {visibleRisks.map((risk) => (
            <article className={styles.riskRow} key={risk.id}>
              <div className={styles.riskTopline}>
                <div className={styles.riskTitleGroup}>
                  <h4>{risk.title}</h4>
                  <span className={`${styles.status} ${risk.status === 'CLOSED' ? styles.statusClosed : risk.status === 'ACCEPTED' ? styles.statusAccepted : risk.status === 'MITIGATING' ? styles.statusMitigating : styles.statusOpen}`}>
                    {statusCopy[risk.status]}
                  </span>
                </div>
                <div className={`${styles.riskLevel} ${scoreTone(risk.residualScore)}`}>
                  <strong>{risk.residualScore}/25</strong><span>{scoreName(risk.residualScore)}</span>
                </div>
              </div>

              {risk.description && <p className={styles.description}>{risk.description}</p>}

              <div className={styles.riskFacts}>
                <div><span>Inherente</span><strong>{risk.inherentScore}/25 <small>({risk.probability} × {risk.impact})</small></strong></div>
                <div><span>Residual</span><strong>{risk.residualScore}/25 <small>({risk.residualProbability ?? risk.probability} × {risk.residualImpact ?? risk.impact})</small></strong></div>
                <div className={styles.ownerFact}><span>Responsable</span><strong><UserRound size={13} /> {risk.ownerName || 'Sin responsable'}</strong></div>
              </div>

              <div className={styles.mitigation}>
                <span>Respuesta / mitigación</span>
                <p>{risk.mitigationPlan}</p>
              </div>

              <footer className={styles.riskFooter}>
                <span className={isReviewOverdue(risk) ? styles.reviewOverdue : styles.reviewDate}>
                  {isReviewOverdue(risk) ? <AlertTriangle size={13} /> : <CalendarClock size={13} />}
                  {isReviewOverdue(risk) ? 'Revisión vencida: ' : ''}{formatReviewDate(risk.nextReviewAt)}
                </span>
                {canEdit && (
                  <button type="button" className={styles.editButton} onClick={() => startEdit(risk)}>
                    <Pencil size={13} /> Editar
                  </button>
                )}
              </footer>
            </article>
          ))}
        </div>
      )}

      <div className={styles.scaleLegend} aria-label="Rangos de puntaje de riesgo">
        <span className={styles.legendLow}><strong>Bajo</strong><small>1–4 puntos</small></span>
        <span className={styles.legendModerate}><strong>Moderado</strong><small>5–9 puntos</small></span>
        <span className={styles.legendHigh}><strong>Alto</strong><small>10–15 puntos</small></span>
        <span className={styles.legendCritical}><strong>Crítico</strong><small>16–25 puntos</small></span>
        <p>La cartera prioriza el puntaje residual.</p>
      </div>
      {!canEdit && <p className={styles.readOnly}><UserRound size={13} /> Tienes acceso de lectura a este registro.</p>}
    </section>
  );
}
