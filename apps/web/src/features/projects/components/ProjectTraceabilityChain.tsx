'use client';

import Link from 'next/link';
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowUpRight,
  ClipboardCheck,
  Check,
  ChevronRight,
  ClipboardList,
  CircleCheck,
  CircleDashed,
  CircleDot,
  Flag,
  LoaderCircle,
  Plus,
  Pencil,
  RefreshCw,
  Target,
  TriangleAlert,
  Trash2,
  TrendingUp,
  X,
} from 'lucide-react';
import { CalendarDatePicker } from '@/components/calendar/DateTimePickers';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import {
  projectApi,
  type ProjectBacklogCard,
  type ProjectTraceabilityData,
  type ProjectTraceabilityDeliverable,
  type ProjectTraceabilityOutcome,
  type ProjectTraceabilityRequirement,
} from '@/features/projects/api';
import styles from './ProjectTraceabilityChain.module.css';

type Props = { projectId: string; canEdit: boolean; refreshKey: number };
type ObjectiveDraft = {
  statement: string;
  successMetric: string;
  targetValue: string;
  unit: string;
  changeReason: string;
};
type ObjectiveErrors = Partial<Record<'statement' | 'targetValue' | 'changeReason', string>>;
type DeliverableDraft = { name: string; description: string; cardIds: string[] };
type RequirementDraft = {
  title: string;
  description: string;
  acceptanceCriteria: string;
  requirementType: ProjectTraceabilityRequirement['requirementType'];
  priority: ProjectTraceabilityRequirement['priority'];
  status: ProjectTraceabilityRequirement['status'];
  verificationMethod: string;
  evidence: string;
  cardIds: string[];
};
type OutcomeDraft = {
  metricName: string;
  targetValue: string;
  actualValue: string;
  unit: string;
  evidence: string;
  measuredAt: string;
  deliverableId: string;
  milestoneId: string;
};
type OutcomeErrors = Partial<
  Record<'metricName' | 'actualValue' | 'targetValue' | 'unit' | 'measuredAt', string>
>;

const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};
const emptyObjective: ObjectiveDraft = {
  statement: '',
  successMetric: '',
  targetValue: '',
  unit: '',
  changeReason: '',
};
const objectiveTextLimits = { statement: 2000, successMetric: 160, unit: 40, changeReason: 1500 };
const emptyDeliverable: DeliverableDraft = { name: '', description: '', cardIds: [] };
const emptyRequirement: RequirementDraft = {
  title: '',
  description: '',
  acceptanceCriteria: '',
  requirementType: 'FUNCTIONAL',
  priority: 'MEDIUM',
  status: 'DEFINED',
  verificationMethod: '',
  evidence: '',
  cardIds: [],
};
const emptyOutcome: OutcomeDraft = {
  metricName: '',
  targetValue: '',
  actualValue: '',
  unit: '',
  evidence: '',
  measuredAt: today(),
  deliverableId: '',
  milestoneId: '',
};
const outcomeTextLimits = { metricName: 160, unit: 40, evidence: 2000 };
const statusLabels: Record<ProjectTraceabilityDeliverable['status'], string> = {
  PLANNED: 'Planificado',
  IN_PROGRESS: 'En curso',
  DONE: 'Completado',
  AT_RISK: 'En riesgo',
};
const statusOptions = [
  {
    value: 'PLANNED' as const,
    label: statusLabels.PLANNED,
    description: 'Preparado para comenzar',
    icon: <CircleDashed size={14} />,
    tone: 'neutral' as const,
  },
  {
    value: 'IN_PROGRESS' as const,
    label: statusLabels.IN_PROGRESS,
    description: 'El equipo está trabajando en ello',
    icon: <CircleDot size={14} />,
    tone: 'accent' as const,
  },
  {
    value: 'DONE' as const,
    label: statusLabels.DONE,
    description: 'Entregado y validado',
    icon: <CircleCheck size={14} />,
    tone: 'success' as const,
  },
  {
    value: 'AT_RISK' as const,
    label: statusLabels.AT_RISK,
    description: 'Requiere atención y seguimiento',
    icon: <TriangleAlert size={14} />,
    tone: 'warning' as const,
  },
];
const requirementStatusLabels: Record<ProjectTraceabilityRequirement['status'], string> = {
  DEFINED: 'Definido',
  IN_PROGRESS: 'En validación',
  VERIFIED: 'Verificado',
  BLOCKED: 'Bloqueado',
};
const requirementStatusOptions = [
  { value: 'DEFINED', label: 'Definido', description: 'Aún no comienza su validación', icon: <CircleDashed size={14} />, tone: 'neutral' as const },
  { value: 'IN_PROGRESS', label: 'En validación', description: 'El equipo está comprobándolo', icon: <CircleDot size={14} />, tone: 'accent' as const },
  { value: 'VERIFIED', label: 'Verificado', description: 'Cumple los criterios acordados', icon: <CircleCheck size={14} />, tone: 'success' as const },
  { value: 'BLOCKED', label: 'Bloqueado', description: 'No puede avanzar por ahora', icon: <TriangleAlert size={14} />, tone: 'warning' as const },
];
const requirementTypeOptions = [
  { value: 'FUNCTIONAL', label: 'Funcional', description: 'Comportamiento o capacidad esperada', icon: <ClipboardCheck size={14} />, tone: 'accent' as const },
  { value: 'NON_FUNCTIONAL', label: 'No funcional', description: 'Calidad, rendimiento o seguridad', icon: <TrendingUp size={14} />, tone: 'neutral' as const },
  { value: 'CONSTRAINT', label: 'Restricción', description: 'Límite técnico, legal o operativo', icon: <TriangleAlert size={14} />, tone: 'warning' as const },
];
const requirementPriorityOptions = [
  { value: 'LOW', label: 'Baja', description: 'Puede resolverse más adelante', icon: <CircleDashed size={14} />, tone: 'neutral' as const },
  { value: 'MEDIUM', label: 'Media', description: 'Importante para el entregable', icon: <CircleDot size={14} />, tone: 'accent' as const },
  { value: 'HIGH', label: 'Alta', description: 'Debe resolverse pronto', icon: <TriangleAlert size={14} />, tone: 'warning' as const },
  { value: 'CRITICAL', label: 'Crítica', description: 'Condiciona el éxito del entregable', icon: <TriangleAlert size={14} />, tone: 'danger' as const },
];
const requirementTypeLabels: Record<ProjectTraceabilityRequirement['requirementType'], string> = {
  FUNCTIONAL: 'Funcional',
  NON_FUNCTIONAL: 'No funcional',
  CONSTRAINT: 'Restricción',
};
const requirementPriorityLabels: Record<ProjectTraceabilityRequirement['priority'], string> = {
  LOW: 'Baja',
  MEDIUM: 'Media',
  HIGH: 'Alta',
  CRITICAL: 'Crítica',
};

function formatDate(value?: string | null) {
  if (!value) return 'Sin fecha';
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? 'Sin fecha'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

function containDialogFocus(event: KeyboardEvent<HTMLElement>, onClose: () => void) {
  if (event.key === 'Escape') {
    event.preventDefault();
    event.stopPropagation();
    onClose();
    return;
  }
  if (event.key !== 'Tab') return;

  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => element.getClientRects().length > 0);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) {
    event.preventDefault();
    return;
  }

  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

export function ProjectTraceabilityChain({ projectId, canEdit, refreshKey }: Props) {
  const [data, setData] = useState<ProjectTraceabilityData | null>(null);
  const [cards, setCards] = useState<ProjectBacklogCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cardLoadWarning, setCardLoadWarning] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingObjective, setEditingObjective] = useState(false);
  const [objectiveDraft, setObjectiveDraft] = useState<ObjectiveDraft>(emptyObjective);
  const [objectiveErrors, setObjectiveErrors] = useState<ObjectiveErrors>({});
  const [showDeliverableForm, setShowDeliverableForm] = useState(false);
  const [deliverableDraft, setDeliverableDraft] = useState<DeliverableDraft>(emptyDeliverable);
  const [activeDeliverableId, setActiveDeliverableId] = useState('');
  const [deliverableNameError, setDeliverableNameError] = useState('');
  const [editingRequirement, setEditingRequirement] = useState<{ deliverableId: string; requirementId?: string } | null>(null);
  const [requirementDraft, setRequirementDraft] = useState<RequirementDraft>(emptyRequirement);
  const [requirementTitleError, setRequirementTitleError] = useState('');
  const [requirementCriteriaError, setRequirementCriteriaError] = useState('');
  const [confirmDeleteRequirementId, setConfirmDeleteRequirementId] = useState<string | null>(null);
  const [confirmDeleteDeliverableId, setConfirmDeleteDeliverableId] = useState<string | null>(null);
  const [confirmDeleteOutcomeId, setConfirmDeleteOutcomeId] = useState<string | null>(null);
  const [editingCardsId, setEditingCardsId] = useState<string | null>(null);
  const [deliverableCardDraft, setDeliverableCardDraft] = useState<string[]>([]);
  const [cardSearch, setCardSearch] = useState('');
  const [showOutcomeForm, setShowOutcomeForm] = useState(false);
  const [outcomeDraft, setOutcomeDraft] = useState<OutcomeDraft>(emptyOutcome);
  const [outcomeErrors, setOutcomeErrors] = useState<OutcomeErrors>({});
  const [localError, setLocalError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setCardLoadWarning('');
    try {
      const [traceability, backlog] = await Promise.all([
        projectApi.getTraceability(projectId),
        projectApi.getBacklog(projectId).catch(() => null),
      ]);
      setData(traceability);
      setCards(backlog ?? []);
      if (!backlog)
        setCardLoadWarning(
          'No se pudieron cargar las tarjetas. Puedes consultar la cadena e intentar cargar las tarjetas de nuevo.'
        );
      setObjectiveDraft({
        statement: traceability.objective?.statement ?? '',
        successMetric: traceability.objective?.successMetric ?? '',
        targetValue:
          traceability.objective?.targetValue == null
            ? ''
            : String(traceability.objective.targetValue),
        unit: traceability.objective?.unit ?? '',
        changeReason: '',
      });
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo cargar la cadena de trazabilidad.'
      );
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  const filteredCards = useMemo(() => {
    const query = cardSearch.trim().toLocaleLowerCase('es-CL');
    return cards
      .filter(
        (card) =>
          !query || `${card.title} ${card.listName}`.toLocaleLowerCase('es-CL').includes(query)
      )
      .slice(0, 24);
  }, [cards, cardSearch]);

  async function saveObjective(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    const nextErrors: ObjectiveErrors = {};
    if (!objectiveDraft.statement.trim()) {
      nextErrors.statement = 'Escribe el cambio que debe lograr el proyecto.';
    }
    if (data?.objective && !objectiveDraft.changeReason.trim()) {
      nextErrors.changeReason = 'Explica por qué se modifica este objetivo.';
    }
    if (objectiveDraft.targetValue.trim() && !Number.isFinite(Number(objectiveDraft.targetValue))) {
      nextErrors.targetValue = 'Escribe una meta numérica válida.';
    }
    setObjectiveErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = Object.keys(nextErrors)[0];
      const fieldId =
        firstInvalidField === 'targetValue'
          ? 'objective-target'
          : `objective-${firstInvalidField === 'changeReason' ? 'change-reason' : 'statement'}`;
      document.getElementById(fieldId)?.focus();
      return;
    }
    setSaving(true);
    try {
      await projectApi.saveTraceabilityObjective(projectId, {
        statement: objectiveDraft.statement.trim(),
        successMetric: objectiveDraft.successMetric.trim() || null,
        targetValue: objectiveDraft.targetValue === '' ? null : Number(objectiveDraft.targetValue),
        unit: objectiveDraft.unit.trim() || null,
        changeReason: objectiveDraft.changeReason.trim() || null,
      });
      setEditingObjective(false);
      setMessage('Objetivo guardado.');
      await load();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No se pudo guardar el objetivo.');
    } finally {
      setSaving(false);
    }
  }

  async function createDeliverable(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (!data?.objective) {
      setLocalError('Define el objetivo antes de registrar entregables.');
      return;
    }
    if (!deliverableDraft.name.trim()) {
      setDeliverableNameError('Escribe un nombre para identificar este entregable.');
      return;
    }
    setDeliverableNameError('');
    setSaving(true);
    try {
      await projectApi.createTraceabilityDeliverable(projectId, {
        name: deliverableDraft.name.trim(),
        description: deliverableDraft.description.trim() || null,
        cardIds: deliverableDraft.cardIds,
      });
      setDeliverableDraft(emptyDeliverable);
      setCardSearch('');
      setShowDeliverableForm(false);
      setActiveDeliverableId('');
      setMessage('Entregable añadido a la cadena.');
      await load();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No se pudo crear el entregable.');
    } finally {
      setSaving(false);
    }
  }

  async function updateDeliverableStatus(
    deliverable: ProjectTraceabilityDeliverable,
    status: ProjectTraceabilityDeliverable['status']
  ) {
    try {
      await projectApi.updateTraceabilityDeliverable(projectId, deliverable.id, { status });
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo actualizar el entregable.');
    }
  }

  async function deleteDeliverable(deliverable: ProjectTraceabilityDeliverable) {
    setSaving(true);
    setError('');
    try {
      const impact = await projectApi.deleteTraceabilityDeliverable(projectId, deliverable.id);
      setActiveDeliverableId('');
      setConfirmDeleteDeliverableId(null);
      setEditingCardsId(null);
      setConfirmDeleteRequirementId(null);
      setMessage(
        `Entregable eliminado. ${impact.requirementsDeleted} requisitos eliminados; ` +
        `${impact.cardLinksRemoved} vínculos con tarjetas retirados; ` +
        `${impact.milestonesUnlinked} hitos y ${impact.outcomesUnlinked} resultados quedaron sin asociación. Las tarjetas se conservaron.`
      );
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el entregable.');
    } finally {
      setSaving(false);
    }
  }

  async function saveDeliverableCards(deliverableId: string) {
    setSaving(true);
    try {
      await projectApi.updateTraceabilityDeliverable(projectId, deliverableId, {
        cardIds: deliverableCardDraft,
      });
      setEditingCardsId(null);
      setMessage('Tarjetas relacionadas actualizadas.');
      await load();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : 'No se pudieron actualizar las tarjetas relacionadas.'
      );
    } finally {
      setSaving(false);
    }
  }

  function openRequirementEditor(deliverableId: string, requirement?: ProjectTraceabilityRequirement) {
    setLocalError('');
    setRequirementTitleError('');
    setRequirementCriteriaError('');
    setCardSearch('');
    setConfirmDeleteRequirementId(null);
    setRequirementDraft(requirement ? {
      title: requirement.title,
      description: requirement.description ?? '',
      acceptanceCriteria: requirement.acceptanceCriteria,
      requirementType: requirement.requirementType,
      priority: requirement.priority,
      status: requirement.status,
      verificationMethod: requirement.verificationMethod ?? '',
      evidence: requirement.evidence ?? '',
      cardIds: requirement.cards.map((card) => card.id),
    } : emptyRequirement);
    setEditingRequirement({ deliverableId, ...(requirement ? { requirementId: requirement.id } : {}) });
  }

  async function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (!requirementDraft.title.trim()) {
      setRequirementTitleError('Escribe un nombre para identificar este requisito.');
      return;
    }
    setRequirementTitleError('');
    if (!requirementDraft.acceptanceCriteria.trim()) {
      setRequirementCriteriaError('Define cómo se comprobará que el requisito está cumplido.');
      return;
    }
    setRequirementCriteriaError('');
    if (!editingRequirement) return;
    setSaving(true);
    try {
      const payload = {
        title: requirementDraft.title.trim(),
        description: requirementDraft.description.trim() || null,
        acceptanceCriteria: requirementDraft.acceptanceCriteria.trim(),
        requirementType: requirementDraft.requirementType,
        priority: requirementDraft.priority,
        status: requirementDraft.status,
        verificationMethod: requirementDraft.verificationMethod.trim() || null,
        evidence: requirementDraft.evidence.trim() || null,
        cardIds: requirementDraft.cardIds,
      };
      if (editingRequirement.requirementId) {
        await projectApi.updateTraceabilityRequirement(
          projectId,
          editingRequirement.deliverableId,
          editingRequirement.requirementId,
          payload
        );
        setMessage('Requisito actualizado.');
      } else {
        await projectApi.createTraceabilityRequirement(projectId, editingRequirement.deliverableId, payload);
        setMessage('Requisito añadido a la cadena.');
      }
      setEditingRequirement(null);
      setRequirementDraft(emptyRequirement);
      setCardSearch('');
      await load();
    } catch (caught) {
      setLocalError(caught instanceof Error ? caught.message : 'No se pudo guardar el requisito.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteRequirement(requirement: ProjectTraceabilityRequirement) {
    setSaving(true);
    try {
      await projectApi.deleteTraceabilityRequirement(projectId, requirement.deliverableId, requirement.id);
      setConfirmDeleteRequirementId(null);
      setMessage('Requisito eliminado.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el requisito.');
    } finally {
      setSaving(false);
    }
  }

  async function linkMilestone(milestoneId: string, deliverableId: string) {
    try {
      await projectApi.linkMilestoneToDeliverable(projectId, milestoneId, deliverableId || null);
      setMessage('Hito asociado al entregable.');
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo asociar el hito.');
    }
  }

  async function createOutcome(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocalError('');
    if (!data?.objective) {
      setLocalError('Define el objetivo antes de registrar un resultado.');
      return;
    }
    const nextErrors: OutcomeErrors = {};
    if (!outcomeDraft.metricName.trim()) {
      nextErrors.metricName = 'Escribe el indicador que estás midiendo.';
    }
    if (outcomeDraft.actualValue === '') {
      nextErrors.actualValue = 'Ingresa el valor observado.';
    } else if (!Number.isFinite(Number(outcomeDraft.actualValue))) {
      nextErrors.actualValue = 'Ingresa un valor numérico válido.';
    }
    if (
      outcomeDraft.targetValue !== '' &&
      !Number.isFinite(Number(outcomeDraft.targetValue))
    ) {
      nextErrors.targetValue = 'Ingresa una meta numérica válida.';
    }
    if (!outcomeDraft.unit.trim()) {
      nextErrors.unit = 'Indica la unidad del valor medido.';
    }
    if (!outcomeDraft.measuredAt) {
      nextErrors.measuredAt = 'Selecciona la fecha de medición.';
    }
    setOutcomeErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      const firstInvalidField = Object.keys(nextErrors)[0];
      const fieldIds: Record<string, string> = {
        metricName: 'outcome-metric',
        actualValue: 'outcome-actual-value',
        targetValue: 'outcome-target',
        unit: 'outcome-unit',
      };
      if (firstInvalidField === 'measuredAt') {
        document
          .querySelector<HTMLButtonElement>('[aria-describedby~="outcome-measured-at-error"]')
          ?.focus();
      } else {
        document.getElementById(fieldIds[firstInvalidField])?.focus();
      }
      return;
    }
    setSaving(true);
    try {
      await projectApi.createMeasuredOutcome(projectId, {
        metricName: outcomeDraft.metricName.trim(),
        actualValue: Number(outcomeDraft.actualValue),
        targetValue: outcomeDraft.targetValue === '' ? null : Number(outcomeDraft.targetValue),
        unit: outcomeDraft.unit.trim(),
        evidence: outcomeDraft.evidence.trim() || null,
        measuredAt: outcomeDraft.measuredAt,
        deliverableId: outcomeDraft.deliverableId || null,
        milestoneId: outcomeDraft.milestoneId || null,
      });
      setOutcomeDraft(emptyOutcome);
      setOutcomeErrors({});
      setShowOutcomeForm(false);
      setMessage('Resultado medido guardado.');
      await load();
    } catch (caught) {
      setLocalError(
        caught instanceof Error ? caught.message : 'No se pudo registrar el resultado.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function deleteOutcome(outcome: ProjectTraceabilityOutcome) {
    setSaving(true);
    setError('');
    try {
      await projectApi.deleteMeasuredOutcome(projectId, outcome.id);
      setConfirmDeleteOutcomeId(null);
      setMessage(`Resultado medido «${outcome.metricName}» eliminado y registrado en la actividad del proyecto.`);
      await load();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo eliminar el resultado medido.');
    } finally {
      setSaving(false);
    }
  }

  if (loading && !data)
    return (
      <div className={styles.state} role="status">
        <LoaderCircle className={styles.spinner} size={18} /> Cargando origen, objetivos y
        resultados…
      </div>
    );
  if (error && !data)
    return (
      <div className={styles.state} role="alert">
        <strong>No se pudo cargar la cadena</strong>
        <span>{error}</span>
        <button type="button" onClick={() => void load()}>
          <RefreshCw size={14} /> Reintentar
        </button>
      </div>
    );
  if (!data) return null;

  const origin = data.origin;
  const originLabel =
    origin?.type === 'INITIATIVE'
      ? 'Iniciativa institucional'
      : origin?.type === 'DIRECT'
        ? 'Brief directo del proyecto'
        : 'Contexto del proyecto';
  const deliverableOptions = [
    {
      value: '',
      label: 'Sin entregable asociado',
      description: 'Mantener este elemento sin vínculo',
      icon: <CircleDashed size={14} />,
      tone: 'neutral' as const,
    },
    ...data.deliverables.map((item) => ({
      value: item.id,
      label: item.name,
      description: `${item.cards.length} ${item.cards.length === 1 ? 'tarjeta asociada' : 'tarjetas asociadas'}`,
      icon: <Check size={14} />,
      tone: 'accent' as const,
    })),
  ];
  const activeDeliverable =
    data.deliverables.find((item) => item.id === activeDeliverableId) ?? null;
  const activeDeliverableDeletionImpact = activeDeliverable
    ? {
        requirementsDeleted: activeDeliverable.requirements.length,
        cardLinksRemoved:
          activeDeliverable.cards.length +
          activeDeliverable.requirements.reduce((count, requirement) => count + requirement.cards.length, 0),
        milestonesUnlinked: data.milestones.filter((item) => item.deliverableId === activeDeliverable.id).length,
        outcomesUnlinked: data.outcomes.filter((item) => item.deliverableId === activeDeliverable.id).length,
      }
    : null;
  const milestoneOptions = [
    {
      value: '',
      label: 'Sin hito asociado',
      description: 'La medición queda sin vínculo a un hito',
      icon: <Flag size={14} />,
      tone: 'neutral' as const,
    },
    ...data.milestones.map((item) => ({
      value: item.id,
      label: item.name,
      description: `Fecha ${formatDate(item.date)}`,
      icon: <Flag size={14} />,
      tone: 'accent' as const,
    })),
  ];
  const linkedCardCount = new Set(
    data.deliverables.flatMap((item) => item.cards.map((card) => card.id))
  ).size;
  const requirementCount = data.deliverables.reduce((total, item) => total + (item.requirements?.length ?? 0), 0);
  const requirementDeliverable = editingRequirement
    ? data.deliverables.find((item) => item.id === editingRequirement.deliverableId) ?? null
    : null;
  const requirementCardIds = new Set(requirementDeliverable?.cards.map((card) => card.id) ?? []);
  const requirementCardOptions = cards.filter((card) => {
    if (!requirementCardIds.has(card.id)) return false;
    const query = cardSearch.trim().toLocaleLowerCase('es-CL');
    return !query || `${card.title} ${card.listName}`.toLocaleLowerCase('es-CL').includes(query);
  }).slice(0, 24);
  const chainSteps = [
    { label: 'Origen', detail: origin ? 'Registrado' : 'Por definir', complete: Boolean(origin) },
    {
      label: 'Objetivo',
      detail: data.objective ? 'Definido' : 'Por definir',
      complete: Boolean(data.objective),
    },
    {
      label: 'Entregables',
      detail: `${data.deliverables.length} ${data.deliverables.length === 1 ? 'registrado' : 'registrados'}`,
      complete: data.deliverables.length > 0,
    },
    {
      label: 'Requisitos',
      detail: `${requirementCount} ${requirementCount === 1 ? 'definido' : 'definidos'}`,
      complete: requirementCount > 0,
    },
    {
      label: 'Tarjetas',
      detail: `${linkedCardCount} ${linkedCardCount === 1 ? 'vinculada' : 'vinculadas'}`,
      complete: linkedCardCount > 0,
    },
    {
      label: 'Hitos',
      detail: `${data.milestones.length} ${data.milestones.length === 1 ? 'registrado' : 'registrados'}`,
      complete: data.milestones.length > 0,
    },
    {
      label: 'Resultados',
      detail: `${data.outcomes.length} ${data.outcomes.length === 1 ? 'medido' : 'medidos'}`,
      complete: data.outcomes.length > 0,
    },
  ];
  const completedStepCount = chainSteps.filter((step) => step.complete).length;
  const isEditorOpen =
    editingObjective || showDeliverableForm || editingCardsId !== null || showOutcomeForm || editingRequirement !== null;

  return (
    <div className={styles.root}>
      {isEditorOpen && <div className={styles.editorBackdrop} aria-hidden="true" />}
      <div className={styles.chainIntro}>
        <div className={styles.chainIntroTop}>
          <div>
            <h3>Del origen al impacto</h3>
            <p>Sigue cada paso desde el motivo del proyecto hasta el cambio medido.</p>
          </div>
          <span className={styles.chainSummary} aria-label={`${completedStepCount} de ${chainSteps.length} etapas con datos`}>
            <strong>{completedStepCount}/{chainSteps.length}</strong>
            <span>etapas con datos</span>
          </span>
        </div>
        <ol className={styles.chainMap} aria-label="Estado de las etapas de trazabilidad">
          {chainSteps.map((step, index) => (
            <li
              key={step.label}
              className={`${styles.chainStep} ${step.complete ? styles.chainStepComplete : ''} ${step.complete && chainSteps[index + 1]?.complete ? styles.chainStepConnected : ''}`}
            >
              <span className={styles.chainStepDot} aria-hidden="true">
                {step.complete && <Check size={10} />}
              </span>
              <strong>{step.label}</strong>
              <small>{step.detail}</small>
            </li>
          ))}
        </ol>
      </div>

      {message && (
        <p className={styles.success} role="status">
          <Check size={14} /> {message}
          <button type="button" aria-label="Cerrar aviso" onClick={() => setMessage('')}>
            <X size={14} />
          </button>
        </p>
      )}
      {cardLoadWarning && (
        <p className={styles.warning} role="status">
          <span>{cardLoadWarning}</span>
          <button type="button" onClick={() => void load()}>
            <RefreshCw size={13} /> Reintentar
          </button>
        </p>
      )}
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}

      <div className={styles.chainGrid}>
        <section
          className={`${styles.node} ${styles.originNode}`}
          aria-labelledby="trace-origin-heading"
        >
          <header className={styles.nodeHeader}>
            <span className={styles.nodeIcon}>
              <ClipboardList size={16} />
            </span>
            <div>
              <span className={styles.eyebrow}>Origen</span>
              <h4 id="trace-origin-heading">{originLabel}</h4>
            </div>
          </header>
          {origin ? (
            <>
              <h5 className={styles.nodeTitle}>{origin.title}</h5>
              <p className={styles.bodyText}>
                {origin.problemStatement ||
                  origin.description ||
                  'El registro de origen no incluye contexto adicional.'}
              </p>
              <div className={styles.originDetails}>
                <dl>
                  {origin.impactedPeople && (
                    <div>
                      <dt>Personas involucradas</dt>
                      <dd>{origin.impactedPeople}</dd>
                    </div>
                  )}
                  {origin.problemImpact && (
                    <div>
                      <dt>Impacto del problema</dt>
                      <dd>{origin.problemImpact}</dd>
                    </div>
                  )}
                  {origin.impactedCount != null && (
                    <div>
                      <dt>Personas afectadas</dt>
                      <dd>{origin.impactedCount.toLocaleString('es-CL')}</dd>
                    </div>
                  )}
                  {origin.expectedOutcome && (
                    <div>
                      <dt>Impacto esperado</dt>
                      <dd>{origin.expectedOutcome}</dd>
                    </div>
                  )}
                  {origin.proposedSolution && (
                    <div>
                      <dt>Solución propuesta</dt>
                      <dd>{origin.proposedSolution}</dd>
                    </div>
                  )}
                  {origin.differentiation && (
                    <div>
                      <dt>Diferenciación</dt>
                      <dd>{origin.differentiation}</dd>
                    </div>
                  )}
                </dl>
              </div>
              {origin.type === 'INITIATIVE' && origin.sourceInitiativeId && (
                <Link
                  className={styles.sourceLink}
                  href={`/dashboard/initiatives/${origin.sourceInitiativeId}`}
                >
                  Abrir iniciativa <ArrowUpRight size={13} />
                </Link>
              )}
              {origin.isReconstructed && (
                <small className={styles.legacyNote}>
                  Contexto reconstruido al habilitar la trazabilidad; no corresponde a una captura
                  original.
                </small>
              )}
            </>
          ) : (
            <div className={styles.nodeEmpty}>No hay un registro de origen disponible.</div>
          )}
        </section>

        <section
          className={`${styles.node} ${styles.objectiveNode}`}
          aria-labelledby="trace-objective-heading"
        >
          <header className={styles.nodeHeader}>
            <span className={styles.nodeIcon}>
              <Target size={16} />
            </span>
            <div>
              <span className={styles.eyebrow}>
                Dirección · v{data.objective?.version ?? 0}
              </span>
              <h4 id="trace-objective-heading">Objetivo</h4>
            </div>
            {canEdit && !editingObjective && (
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => {
                  setLocalError('');
                  setObjectiveErrors({});
                  setEditingObjective(true);
                }}
              >
                {data.objective ? 'Editar' : 'Definir'}
              </button>
            )}
          </header>
          {editingObjective ? (
            <form
              className={styles.form}
              role="dialog"
              aria-modal="true"
              aria-label={
                data.objective ? 'Editar objetivo del proyecto' : 'Definir objetivo del proyecto'
              }
              onKeyDown={(event) =>
                containDialogFocus(event, () => {
                  if (!saving) {
                    setEditingObjective(false);
                    setLocalError('');
                    setObjectiveErrors({});
                  }
                })
              }
              onSubmit={saveObjective}
            >
              <div className={styles.editorHeading}>
                <div>
                  <strong>{data.objective ? 'Editar objetivo' : 'Definir objetivo'}</strong>
                  <p>Define un resultado claro y comprobable para el equipo.</p>
                </div>
                <button
                  type="button"
                  className={styles.dialogClose}
                  aria-label="Cerrar editor de objetivo"
                  disabled={saving}
                  onClick={() => {
                    setEditingObjective(false);
                    setLocalError('');
                    setObjectiveErrors({});
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              {localError && (
                <p className={styles.error} role="alert">
                  {localError}
                </p>
              )}
              <div className={styles.objectiveField}>
                <div className={styles.objectiveFieldHeading}>
                  <label htmlFor="objective-statement">
                    ¿Qué cambio debe lograr el proyecto?{' '}
                    <span className={styles.requiredTag}>Obligatorio</span>
                  </label>
                  <span className={styles.characterCount}>
                    {objectiveDraft.statement.length}/{objectiveTextLimits.statement}
                  </span>
                </div>
                <p className={styles.objectiveHint} id="objective-statement-hint">
                  Describe el resultado que justificará el proyecto y orientará sus entregables.
                </p>
                <textarea
                  autoFocus
                  id="objective-statement"
                  rows={3}
                  maxLength={objectiveTextLimits.statement}
                  value={objectiveDraft.statement}
                  aria-required="true"
                  aria-invalid={Boolean(objectiveErrors.statement)}
                  aria-describedby={`objective-statement-hint${objectiveErrors.statement ? ' objective-statement-error' : ''}`}
                  onBlur={() => {
                    if (!objectiveDraft.statement.trim()) {
                      setObjectiveErrors((current) => ({
                        ...current,
                        statement: 'Escribe el cambio que debe lograr el proyecto.',
                      }));
                    }
                  }}
                  onChange={(event) => {
                    const statement = event.target.value;
                    setObjectiveDraft((current) => ({ ...current, statement }));
                    if (statement.trim()) {
                      setObjectiveErrors((current) => ({ ...current, statement: undefined }));
                    }
                  }}
                  placeholder="Describe el resultado que justificará el proyecto"
                />
                {objectiveErrors.statement && (
                  <small className={styles.fieldError} id="objective-statement-error" role="alert">
                    {objectiveErrors.statement}
                  </small>
                )}
              </div>
              <div className={styles.formGrid}>
                <div className={styles.objectiveField}>
                  <div className={styles.objectiveFieldHeading}>
                    <label htmlFor="objective-metric">
                      Métrica de éxito <span className={styles.optionalTag}>Opcional</span>
                    </label>
                    <span className={styles.characterCount}>
                      {objectiveDraft.successMetric.length}/{objectiveTextLimits.successMetric}
                    </span>
                  </div>
                  <p className={styles.objectiveHint} id="objective-metric-hint">
                    Indicador que permitirá comprobar si se logró el cambio.
                  </p>
                  <input
                    id="objective-metric"
                    maxLength={objectiveTextLimits.successMetric}
                    value={objectiveDraft.successMetric}
                    aria-describedby="objective-metric-hint"
                    onChange={(event) =>
                      setObjectiveDraft((current) => ({
                        ...current,
                        successMetric: event.target.value,
                      }))
                    }
                    placeholder="Ej. tiempo de respuesta"
                  />
                </div>
                <div className={styles.objectiveField}>
                  <div className={styles.objectiveFieldHeading}>
                    <label htmlFor="objective-target">
                      Meta <span className={styles.optionalTag}>Opcional</span>
                    </label>
                  </div>
                  <p className={styles.objectiveHint} id="objective-target-hint">
                    Valor esperado para la métrica de éxito.
                  </p>
                  <input
                    id="objective-target"
                    type="number"
                    step="any"
                    value={objectiveDraft.targetValue}
                    aria-invalid={Boolean(objectiveErrors.targetValue)}
                    aria-describedby={`objective-target-hint${objectiveErrors.targetValue ? ' objective-target-error' : ''}`}
                    onBlur={() => {
                      if (
                        objectiveDraft.targetValue.trim() &&
                        !Number.isFinite(Number(objectiveDraft.targetValue))
                      ) {
                        setObjectiveErrors((current) => ({
                          ...current,
                          targetValue: 'Escribe una meta numérica válida.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const targetValue = event.target.value;
                      setObjectiveDraft((current) => ({ ...current, targetValue }));
                      if (!targetValue.trim() || Number.isFinite(Number(targetValue))) {
                        setObjectiveErrors((current) => ({ ...current, targetValue: undefined }));
                      }
                    }}
                    placeholder="Ej. 80"
                  />
                  {objectiveErrors.targetValue && (
                    <small className={styles.fieldError} id="objective-target-error" role="alert">
                      {objectiveErrors.targetValue}
                    </small>
                  )}
                </div>
                <div className={styles.objectiveField}>
                  <div className={styles.objectiveFieldHeading}>
                    <label htmlFor="objective-unit">
                      Unidad <span className={styles.optionalTag}>Opcional</span>
                    </label>
                    <span className={styles.characterCount}>
                      {objectiveDraft.unit.length}/{objectiveTextLimits.unit}
                    </span>
                  </div>
                  <p className={styles.objectiveHint} id="objective-unit-hint">
                    Forma en que se expresa el valor, por ejemplo horas o porcentaje.
                  </p>
                  <input
                    id="objective-unit"
                    maxLength={objectiveTextLimits.unit}
                    value={objectiveDraft.unit}
                    aria-describedby="objective-unit-hint"
                    onChange={(event) =>
                      setObjectiveDraft((current) => ({ ...current, unit: event.target.value }))
                    }
                    placeholder="Ej. horas, %"
                  />
                </div>
              </div>
              {data.objective && (
                <div className={styles.objectiveField}>
                  <div className={styles.objectiveFieldHeading}>
                    <label htmlFor="objective-change-reason">
                      Motivo del cambio <span className={styles.requiredTag}>Obligatorio</span>
                    </label>
                    <span className={styles.characterCount}>
                      {objectiveDraft.changeReason.length}/{objectiveTextLimits.changeReason}
                    </span>
                  </div>
                  <p className={styles.objectiveHint} id="objective-change-reason-hint">
                    Explica qué motivó la revisión; este motivo quedará en el historial.
                  </p>
                  <input
                    id="objective-change-reason"
                    maxLength={objectiveTextLimits.changeReason}
                    value={objectiveDraft.changeReason}
                    aria-required="true"
                    aria-invalid={Boolean(objectiveErrors.changeReason)}
                    aria-describedby={`objective-change-reason-hint${objectiveErrors.changeReason ? ' objective-change-reason-error' : ''}`}
                    onBlur={() => {
                      if (!objectiveDraft.changeReason.trim()) {
                        setObjectiveErrors((current) => ({
                          ...current,
                          changeReason: 'Explica por qué se modifica este objetivo.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const changeReason = event.target.value;
                      setObjectiveDraft((current) => ({ ...current, changeReason }));
                      if (changeReason.trim()) {
                        setObjectiveErrors((current) => ({ ...current, changeReason: undefined }));
                      }
                    }}
                    placeholder="Por qué se revisa el objetivo"
                  />
                  {objectiveErrors.changeReason && (
                    <small
                      className={styles.fieldError}
                      id="objective-change-reason-error"
                      role="alert"
                    >
                      {objectiveErrors.changeReason}
                    </small>
                  )}
                </div>
              )}
              <div className={`${styles.formActions} ${styles.objectiveActions}`}>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => {
                    setEditingObjective(false);
                    setLocalError('');
                    setObjectiveErrors({});
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar objetivo'}
                </button>
              </div>
            </form>
          ) : data.objective ? (
            <>
              <p className={styles.objectiveText}>{data.objective.statement}</p>
              {data.objective.successMetric && (
                <div className={styles.metricTarget}>
                  <span>{data.objective.successMetric}</span>
                  {data.objective.targetValue != null && (
                    <strong>
                      Meta: {data.objective.targetValue.toLocaleString('es-CL')}{' '}
                      {data.objective.unit}
                    </strong>
                  )}
                </div>
              )}
              {data.objectiveHistory.length > 1 && (
                <details className={styles.objectiveHistory}>
                  <summary>
                    Historial del objetivo · {data.objectiveHistory.length} versiones
                  </summary>
                  <ol>
                    {data.objectiveHistory
                      .filter((item) => !item.isCurrent)
                      .map((item) => (
                        <li key={item.id}>
                          <strong>v{item.version}</strong>
                          <span>{item.statement}</span>
                          {item.changeReason && <small>{item.changeReason}</small>}
                        </li>
                      ))}
                  </ol>
                </details>
              )}
            </>
          ) : (
            <div className={styles.nodeEmpty}>
              El impacto esperado ya está guardado como contexto. Define aquí un objetivo que pueda
              guiar entregables y mediciones.
            </div>
          )}
        </section>

        <section
          className={`${styles.node} ${styles.deliverablesNode}`}
          aria-labelledby="trace-deliverables-heading"
        >
          <header className={styles.nodeHeader}>
            <span className={styles.nodeIcon}>
              <Check size={16} />
            </span>
            <div>
              <span className={styles.eyebrow}>Trabajo concreto</span>
              <h4 id="trace-deliverables-heading">
                Entregables <span className={styles.count}>{data.deliverables.length}</span>
              </h4>
            </div>
            {canEdit && data.objective && (
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => {
                  setLocalError('');
                  setDeliverableNameError('');
                  setCardSearch('');
                  setDeliverableDraft(emptyDeliverable);
                  setShowDeliverableForm(true);
                }}
              >
                <Plus size={14} /> Añadir
              </button>
            )}
          </header>
          {showDeliverableForm && (
            <form
              className={`${styles.form} ${styles.deliverableForm}`}
              role="dialog"
              aria-modal="true"
              aria-label="Añadir entregable"
              onKeyDown={(event) =>
                containDialogFocus(event, () => {
                  if (!saving) {
                    setShowDeliverableForm(false);
                    setDeliverableDraft(emptyDeliverable);
                    setCardSearch('');
                    setDeliverableNameError('');
                    setLocalError('');
                  }
                })
              }
              onSubmit={createDeliverable}
            >
              <div className={styles.editorHeading}>
                <div>
                  <strong>Añadir entregable</strong>
                  <p>Define qué se entregará y qué trabajo contribuye a lograrlo.</p>
                </div>
                <button
                  type="button"
                  className={styles.dialogClose}
                  aria-label="Cerrar editor de entregable"
                  disabled={saving}
                  onClick={() => {
                    setShowDeliverableForm(false);
                    setDeliverableDraft(emptyDeliverable);
                    setCardSearch('');
                    setDeliverableNameError('');
                    setLocalError('');
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              {localError && (
                <p className={styles.error} role="alert">
                  {localError}
                </p>
              )}
              <div className={styles.deliverableLayout}>
                <div className={styles.deliverableDetails}>
                  <div className={styles.deliverableField}>
                    <div className={styles.deliverableFieldHeading}>
                      <label htmlFor="deliverable-name">
                        Nombre del entregable{' '}
                        <span className={styles.requiredTag}>Obligatorio</span>
                      </label>
                      <span className={styles.characterCount}>
                        {deliverableDraft.name.length}/160
                      </span>
                    </div>
                    <input
                      autoFocus
                      id="deliverable-name"
                      maxLength={160}
                      value={deliverableDraft.name}
                      aria-invalid={deliverableNameError ? true : undefined}
                      aria-describedby={deliverableNameError ? 'deliverable-name-error' : undefined}
                      onBlur={() => {
                        if (!deliverableDraft.name.trim()) {
                          setDeliverableNameError(
                            'Escribe un nombre para identificar este entregable.'
                          );
                        }
                      }}
                      onChange={(event) => {
                        const name = event.target.value;
                        setDeliverableDraft({ ...deliverableDraft, name });
                        if (name.trim()) setDeliverableNameError('');
                      }}
                      placeholder="Ej. Portal de autoservicio"
                    />
                    {deliverableNameError && (
                      <span className={styles.fieldError} id="deliverable-name-error" role="alert">
                        {deliverableNameError}
                      </span>
                    )}
                  </div>
                  <div className={styles.deliverableField}>
                    <div className={styles.deliverableFieldHeading}>
                      <label htmlFor="deliverable-description">
                        Descripción <span className={styles.optionalTag}>Opcional</span>
                      </label>
                      <span className={styles.characterCount}>
                        {deliverableDraft.description.length}/1000
                      </span>
                    </div>
                    <textarea
                      id="deliverable-description"
                      rows={4}
                      maxLength={1000}
                      value={deliverableDraft.description}
                      onChange={(event) =>
                        setDeliverableDraft({
                          ...deliverableDraft,
                          description: event.target.value,
                        })
                      }
                      placeholder="Qué se entregará y cómo se reconocerá"
                    />
                  </div>
                </div>
                <CardPicker
                  cards={filteredCards}
                  search={cardSearch}
                  setSearch={setCardSearch}
                  selected={deliverableDraft.cardIds}
                  setSelected={(cardIds) => setDeliverableDraft({ ...deliverableDraft, cardIds })}
                />
              </div>
              <div className={styles.formActions}>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => {
                    setShowDeliverableForm(false);
                    setDeliverableDraft(emptyDeliverable);
                    setCardSearch('');
                    setDeliverableNameError('');
                    setLocalError('');
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar entregable'}
                </button>
              </div>
            </form>
          )}
          {data.deliverables.length ? (
            activeDeliverable ? (
              <div className={styles.deliverableDetail}>
                <button
                  type="button"
                  className={styles.deliverableBack}
                  onClick={() => {
                    setActiveDeliverableId('');
                    setEditingCardsId(null);
                    setCardSearch('');
                    setConfirmDeleteRequirementId(null);
                    setConfirmDeleteDeliverableId(null);
                  }}
                >
                  <ArrowLeft size={14} /> Volver a entregables
                </button>
                <div className={styles.deliverableList}>
              {[activeDeliverable].map((item) => (
                <article className={styles.deliverable} key={item.id}>
                  <div className={styles.deliverableTop}>
                    <div>
                      <h5>{item.name}</h5>
                      {item.description && <p>{item.description}</p>}
                    </div>
                    <div className={styles.deliverableControls}>
                      <div className={styles.deliverableStatus}>
                        <span>Estado</span>
                        {canEdit ? (
                          <ProjectOptionSelect
                            id={`deliverable-status-${item.id}`}
                            label={`Estado de ${item.name}`}
                            value={item.status}
                            options={statusOptions}
                            density="comfortable"
                            variant="contextual"
                            closeOnTab
                            onChange={(value) =>
                              void updateDeliverableStatus(
                                item,
                                value as ProjectTraceabilityDeliverable['status']
                              )
                            }
                          />
                        ) : (
                          <span className={styles.status}>{statusLabels[item.status]}</span>
                        )}
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.deleteButton}
                          aria-label={`Eliminar entregable ${item.name}`}
                          title="Eliminar entregable"
                          aria-expanded={confirmDeleteDeliverableId === item.id}
                          disabled={saving}
                          onClick={() => setConfirmDeleteDeliverableId(confirmDeleteDeliverableId === item.id ? null : item.id)}
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                  {confirmDeleteDeliverableId === item.id && (
                    <div className={styles.deleteConfirm} role="group" aria-label={`Confirmar eliminación de ${item.name}`}>
                      <div className={styles.deleteConfirmCopy}>
                        <strong>¿Eliminar “{item.name}”?</strong>
                        <p>
                          Se eliminarán {activeDeliverableDeletionImpact?.requirementsDeleted ?? 0}{' '}
                          {(activeDeliverableDeletionImpact?.requirementsDeleted ?? 0) === 1 ? 'requisito' : 'requisitos'} y{' '}
                          {activeDeliverableDeletionImpact?.cardLinksRemoved ?? 0}{' '}
                          {(activeDeliverableDeletionImpact?.cardLinksRemoved ?? 0) === 1 ? 'vínculo con tarjetas' : 'vínculos con tarjetas'}. Las tarjetas se conservarán.
                          {' '}{activeDeliverableDeletionImpact?.milestonesUnlinked ?? 0}{' '}
                          {(activeDeliverableDeletionImpact?.milestonesUnlinked ?? 0) === 1 ? 'hito' : 'hitos'} y{' '}
                          {activeDeliverableDeletionImpact?.outcomesUnlinked ?? 0}{' '}
                          {(activeDeliverableDeletionImpact?.outcomesUnlinked ?? 0) === 1 ? 'resultado medido' : 'resultados medidos'} se conservarán, pero perderán el vínculo con este entregable.
                        </p>
                      </div>
                      <div className={styles.deleteConfirmActions}>
                        <button type="button" className={styles.quietButton} disabled={saving} onClick={() => setConfirmDeleteDeliverableId(null)}>Conservar</button>
                        <button type="button" className={styles.deleteDangerButton} disabled={saving} onClick={() => void deleteDeliverable(item)}>
                          {saving ? 'Eliminando…' : 'Eliminar entregable'}
                        </button>
                      </div>
                    </div>
                  )}
                  <div className={styles.linkedItems}>
                    <span>Tarjetas relacionadas</span>
                    {item.cards.length ? (
                      item.cards.map((card) => (
                        <span
                          className={card.completed ? styles.cardDone : styles.cardLink}
                          key={card.id}
                        >
                          {card.cardCode ? `${card.cardCode} · ` : ''}
                          {card.title}
                        </span>
                      ))
                    ) : (
                      <small>Sin tarjetas relacionadas</small>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        className={styles.inlineAction}
                        onClick={() => {
                          setEditingCardsId(editingCardsId === item.id ? null : item.id);
                          setDeliverableCardDraft(item.cards.map((card) => card.id));
                          setCardSearch('');
                        }}
                      >
                        {editingCardsId === item.id ? 'Cerrar selección' : 'Editar tarjetas'}
                      </button>
                    )}
                  </div>
                  <section className={styles.requirementsSection} aria-label={`Requisitos de ${item.name}`}>
                    <div className={styles.requirementsHeading}>
                      <div>
                        <strong>Requisitos</strong>
                        <span className={styles.count}>{item.requirements?.length ?? 0}</span>
                      </div>
                      {canEdit && (
                        <button
                          type="button"
                          className={styles.inlineAction}
                          onClick={() => openRequirementEditor(item.id)}
                        >
                          <Plus size={13} /> Añadir requisito
                        </button>
                      )}
                    </div>
                    {item.requirements?.length ? (
                      <div className={styles.requirementList}>
                        {item.requirements.map((requirement) => (
                          <article className={styles.requirementCard} key={requirement.id}>
                            <div className={styles.requirementTop}>
                              <div className={styles.requirementHeading}>
                                <h6>{requirement.title}</h6>
                                <div className={styles.requirementBadges}>
                                  <span>{requirementTypeLabels[requirement.requirementType]}</span>
                                  <span className={requirement.priority === 'CRITICAL' || requirement.priority === 'HIGH' ? styles.requirementPriorityHigh : ''}>
                                    Prioridad {requirementPriorityLabels[requirement.priority].toLowerCase()}
                                  </span>
                                  <span className={requirement.status === 'VERIFIED' ? styles.requirementVerified : requirement.status === 'BLOCKED' ? styles.requirementBlocked : ''}>
                                    {requirementStatusLabels[requirement.status]}
                                  </span>
                                </div>
                              </div>
                              {canEdit && (
                                <div className={styles.requirementActions}>
                                  <button type="button" aria-label={`Editar ${requirement.title}`} onClick={() => openRequirementEditor(item.id, requirement)}>
                                    <Pencil size={13} />
                                  </button>
                                  <button type="button" aria-label={`Eliminar ${requirement.title}`} onClick={() => setConfirmDeleteRequirementId(confirmDeleteRequirementId === requirement.id ? null : requirement.id)}>
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              )}
                            </div>
                            {requirement.description && <p>{requirement.description}</p>}
                            <div className={styles.requirementCriteria}>
                              <strong>Criterio de aceptación</strong>
                              <span>{requirement.acceptanceCriteria}</span>
                            </div>
                            {requirement.cards.length > 0 && (
                              <div className={styles.requirementLinks}>
                                <strong>Tarjetas que lo implementan</strong>
                                <div>
                                  {requirement.cards.map((card) => (
                                    <span key={card.id} className={card.completed ? styles.cardDone : styles.cardLink}>
                                      {card.cardCode ? `${card.cardCode} · ` : ''}{card.title}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(requirement.verificationMethod || requirement.evidence) && (
                              <div className={styles.requirementEvidence}>
                                {requirement.verificationMethod && <span><strong>Validación:</strong> {requirement.verificationMethod}</span>}
                                {requirement.evidence && <span><strong>Evidencia:</strong> {requirement.evidence}</span>}
                              </div>
                            )}
                            {confirmDeleteRequirementId === requirement.id && (
                              <div className={styles.deleteRequirementPrompt} role="group" aria-label={`Confirmar eliminación de ${requirement.title}`}>
                                <span>¿Eliminar este requisito y sus vínculos?</span>
                                <button type="button" onClick={() => setConfirmDeleteRequirementId(null)}>Conservar</button>
                                <button type="button" disabled={saving} onClick={() => void deleteRequirement(requirement)}>
                                  {saving ? 'Eliminando…' : 'Eliminar'}
                                </button>
                              </div>
                            )}
                          </article>
                        ))}
                      </div>
                    ) : (
                      <p className={styles.requirementEmpty}>
                        Aún no hay requisitos. Añade condiciones verificables y vincúlalas con sus tarjetas.
                      </p>
                    )}
                  </section>
                  {editingCardsId === item.id &&
                    typeof document !== 'undefined' &&
                    createPortal(
                      <div
                        className={styles.cardEditor}
                        role="dialog"
                        aria-modal="true"
                        aria-label={`Editar tarjetas de ${item.name}`}
                        onKeyDown={(event) =>
                          containDialogFocus(event, () => {
                            if (!saving) setEditingCardsId(null);
                          })
                        }
                      >
                        <div className={styles.editorHeading}>
                          <div>
                            <strong>Vincular tarjetas</strong>
                            <p>Elige las tarjetas que forman este entregable.</p>
                          </div>
                          <button
                            type="button"
                            className={styles.dialogClose}
                            aria-label="Cerrar selección de tarjetas"
                            disabled={saving}
                            onClick={() => setEditingCardsId(null)}
                          >
                            <X size={16} />
                          </button>
                        </div>
                        <CardPicker
                          cards={filteredCards}
                          search={cardSearch}
                          setSearch={setCardSearch}
                          selected={deliverableCardDraft}
                          setSelected={setDeliverableCardDraft}
                          autoFocus
                        />
                        <div className={styles.formActions}>
                          <button
                            type="button"
                            className={styles.quietButton}
                            onClick={() => setEditingCardsId(null)}
                          >
                            Cancelar
                          </button>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={saving}
                            onClick={() => void saveDeliverableCards(item.id)}
                          >
                            {saving ? 'Guardando…' : 'Guardar tarjetas'}
                          </button>
                        </div>
                      </div>,
                      document.body
                    )}
                </article>
              ))}
                </div>
              </div>
            ) : (
              <div className={styles.deliverablePicker}>
                <p>Selecciona un entregable para gestionar su estado, tarjetas y requisitos.</p>
                <div className={styles.deliverableChoices}>
                  {data.deliverables.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={styles.deliverableChoice}
                      onClick={() => setActiveDeliverableId(item.id)}
                    >
                      <span className={styles.deliverableChoiceContent}>
                        <strong>{item.name}</strong>
                        <small>
                          {item.cards.length} {item.cards.length === 1 ? 'tarjeta' : 'tarjetas'},{' '}
                          {item.requirements?.length ?? 0}{' '}
                          {(item.requirements?.length ?? 0) === 1 ? 'requisito' : 'requisitos'}
                        </small>
                      </span>
                      <span className={styles.status}>{statusLabels[item.status]}</span>
                      <ChevronRight size={15} aria-hidden="true" />
                    </button>
                  ))}
                </div>
              </div>
            )
          ) : (
            <div className={styles.nodeEmpty}>
              {data.objective
                ? 'Todavía no hay entregables. Añade el primero y asocia las tarjetas que lo construyen.'
                : 'Define el objetivo antes de crear entregables.'}
            </div>
          )}
        </section>

        <section
          className={`${styles.node} ${styles.milestonesNode}`}
          aria-labelledby="trace-milestones-heading"
        >
          <header className={styles.nodeHeader}>
            <span className={styles.nodeIcon}>
              <Flag size={16} />
            </span>
            <div>
              <span className={styles.eyebrow}>Seguimiento</span>
              <h4 id="trace-milestones-heading">
                Hitos <span className={styles.count}>{data.milestones.length}</span>
              </h4>
            </div>
          </header>
          {data.milestones.length ? (
            <div className={styles.milestoneList}>
              {data.milestones.map((milestone) => (
                <article className={styles.milestone} key={milestone.id}>
                  <div className={styles.milestoneHeading}>
                    <strong>{milestone.name}</strong>
                    <time>{formatDate(milestone.date)}</time>
                  </div>
                  <span
                    className={
                      milestone.status === 'REACHED'
                        ? styles.statusDone
                        : milestone.status === 'MISSED'
                          ? styles.statusMissed
                          : styles.status
                    }
                  >
                    {milestone.status === 'REACHED'
                      ? 'Alcanzado'
                      : milestone.status === 'MISSED'
                        ? 'No alcanzado'
                        : 'Pendiente'}
                  </span>
                  {canEdit && data.deliverables.length > 0 && (
                    <label className={styles.milestoneLink}>
                      Entregable relacionado
                      <ProjectOptionSelect
                        id={`milestone-deliverable-${milestone.id}`}
                        label={`Entregable relacionado con ${milestone.name}`}
                        value={milestone.deliverableId ?? ''}
                        options={deliverableOptions}
                        density="comfortable"
                        variant="contextual"
                        closeOnTab
                        onChange={(value) => void linkMilestone(milestone.id, value)}
                      />
                    </label>
                  )}
                  {!canEdit && milestone.deliverableName && (
                    <small>Entregable: {milestone.deliverableName}</small>
                  )}
                </article>
              ))}
            </div>
          ) : (
            <div className={styles.nodeEmpty}>
              Los hitos creados en el cronograma aparecerán aquí.
            </div>
          )}
        </section>

        <section
          className={`${styles.node} ${styles.outcomeNode}`}
          aria-labelledby="trace-outcomes-heading"
        >
          <header className={styles.nodeHeader}>
            <span className={styles.nodeIcon}>
              <TrendingUp size={16} />
            </span>
            <div>
              <span className={styles.eyebrow}>Impacto observado</span>
              <h4 id="trace-outcomes-heading">
                Resultados medidos <span className={styles.count}>{data.outcomes.length}</span>
              </h4>
            </div>
            {canEdit && data.objective && (
              <button
                type="button"
                className={styles.quietButton}
                onClick={() => {
                  setOutcomeDraft({
                    ...emptyOutcome,
                    metricName: data.objective?.successMetric ?? '',
                    targetValue:
                      data.objective?.targetValue == null ? '' : String(data.objective.targetValue),
                    unit: data.objective?.unit ?? '',
                  });
                  setLocalError('');
                  setOutcomeErrors({});
                  setShowOutcomeForm(true);
                }}
              >
                <Plus size={14} /> Registrar
              </button>
            )}
          </header>
          {showOutcomeForm && (
            <form
              className={`${styles.form} ${styles.outcomeForm}`}
              role="dialog"
              aria-modal="true"
              aria-label="Registrar resultado medido"
              onKeyDown={(event) =>
                containDialogFocus(event, () => {
                  if (!saving) {
                    setShowOutcomeForm(false);
                    setOutcomeDraft(emptyOutcome);
                    setLocalError('');
                    setOutcomeErrors({});
                  }
                })
              }
              onSubmit={createOutcome}
            >
              <div className={styles.editorHeading}>
                <div>
                  <strong>Registrar resultado medido</strong>
                  <p>Guarda una medición y vincúlala con el trabajo relacionado.</p>
                </div>
                <button
                  type="button"
                  className={styles.dialogClose}
                  aria-label="Cerrar registro de resultado"
                  disabled={saving}
                  onClick={() => {
                    setShowOutcomeForm(false);
                    setOutcomeDraft(emptyOutcome);
                    setLocalError('');
                    setOutcomeErrors({});
                  }}
                >
                  <X size={16} />
                </button>
              </div>
              {localError && (
                <p className={styles.error} role="alert">
                  {localError}
                </p>
              )}
              <div
                className={`${styles.formGrid} ${styles.outcomeFields} ${styles.outcomeMeasurementFields}`}
              >
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-metric">
                      Métrica <span className={styles.requiredTag}>Obligatorio</span>
                    </label>
                    <span className={styles.characterCount}>
                      {outcomeDraft.metricName.length}/{outcomeTextLimits.metricName}
                    </span>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-metric-hint">
                    Indicador que quieres observar, como tiempo de respuesta o satisfacción.
                  </p>
                  <input
                    autoFocus
                    id="outcome-metric"
                    maxLength={outcomeTextLimits.metricName}
                    value={outcomeDraft.metricName}
                    aria-required="true"
                    aria-invalid={Boolean(outcomeErrors.metricName)}
                    aria-describedby={`outcome-metric-hint${outcomeErrors.metricName ? ' outcome-metric-error' : ''}`}
                    onBlur={() => {
                      if (!outcomeDraft.metricName.trim()) {
                        setOutcomeErrors((current) => ({
                          ...current,
                          metricName: 'Escribe el indicador que estás midiendo.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const metricName = event.target.value;
                      setOutcomeDraft((current) => ({ ...current, metricName }));
                      if (metricName.trim()) {
                        setOutcomeErrors((current) => ({ ...current, metricName: undefined }));
                      }
                    }}
                    placeholder="Ej. tiempo de respuesta"
                  />
                  {outcomeErrors.metricName && (
                    <small className={styles.fieldError} id="outcome-metric-error" role="alert">
                      {outcomeErrors.metricName}
                    </small>
                  )}
                </div>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-actual-value">
                      Valor medido <span className={styles.requiredTag}>Obligatorio</span>
                    </label>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-actual-value-hint">
                    Dato obtenido en esta medición.
                  </p>
                  <input
                    id="outcome-actual-value"
                    className={styles.noNumberSpin}
                    type="number"
                    step="any"
                    value={outcomeDraft.actualValue}
                    aria-required="true"
                    aria-invalid={Boolean(outcomeErrors.actualValue)}
                    aria-describedby={`outcome-actual-value-hint${outcomeErrors.actualValue ? ' outcome-actual-value-error' : ''}`}
                    onBlur={() => {
                      if (outcomeDraft.actualValue === '') {
                        setOutcomeErrors((current) => ({
                          ...current,
                          actualValue: 'Ingresa el valor observado.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const actualValue = event.target.value;
                      setOutcomeDraft((current) => ({ ...current, actualValue }));
                      if (actualValue !== '' && Number.isFinite(Number(actualValue))) {
                        setOutcomeErrors((current) => ({ ...current, actualValue: undefined }));
                      }
                    }}
                    placeholder="Ej. 4.5"
                  />
                  {outcomeErrors.actualValue && (
                    <small className={styles.fieldError} id="outcome-actual-value-error" role="alert">
                      {outcomeErrors.actualValue}
                    </small>
                  )}
                </div>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-target">
                      Meta <span className={styles.optionalTag}>Opcional</span>
                    </label>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-target-hint">
                    Valor de referencia para comparar el resultado.
                  </p>
                  <input
                    id="outcome-target"
                    type="number"
                    step="any"
                    value={outcomeDraft.targetValue}
                    aria-invalid={Boolean(outcomeErrors.targetValue)}
                    aria-describedby={`outcome-target-hint${outcomeErrors.targetValue ? ' outcome-target-error' : ''}`}
                    onBlur={() => {
                      if (
                        outcomeDraft.targetValue !== '' &&
                        !Number.isFinite(Number(outcomeDraft.targetValue))
                      ) {
                        setOutcomeErrors((current) => ({
                          ...current,
                          targetValue: 'Ingresa una meta numérica válida.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const targetValue = event.target.value;
                      setOutcomeDraft((current) => ({ ...current, targetValue }));
                      if (targetValue === '' || Number.isFinite(Number(targetValue))) {
                        setOutcomeErrors((current) => ({ ...current, targetValue: undefined }));
                      }
                    }}
                    placeholder="Ej. 80"
                  />
                  {outcomeErrors.targetValue && (
                    <small className={styles.fieldError} id="outcome-target-error" role="alert">
                      {outcomeErrors.targetValue}
                    </small>
                  )}
                </div>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-unit">
                      Unidad <span className={styles.requiredTag}>Obligatorio</span>
                    </label>
                    <span className={styles.characterCount}>
                      {outcomeDraft.unit.length}/{outcomeTextLimits.unit}
                    </span>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-unit-hint">
                    Forma en que se expresa el valor, por ejemplo horas o porcentaje.
                  </p>
                  <input
                    id="outcome-unit"
                    maxLength={outcomeTextLimits.unit}
                    value={outcomeDraft.unit}
                    aria-required="true"
                    aria-invalid={Boolean(outcomeErrors.unit)}
                    aria-describedby={`outcome-unit-hint${outcomeErrors.unit ? ' outcome-unit-error' : ''}`}
                    onBlur={() => {
                      if (!outcomeDraft.unit.trim()) {
                        setOutcomeErrors((current) => ({
                          ...current,
                          unit: 'Indica la unidad del valor medido.',
                        }));
                      }
                    }}
                    onChange={(event) => {
                      const unit = event.target.value;
                      setOutcomeDraft((current) => ({ ...current, unit }));
                      if (unit.trim()) {
                        setOutcomeErrors((current) => ({ ...current, unit: undefined }));
                      }
                    }}
                    placeholder="Ej. horas, %"
                  />
                  {outcomeErrors.unit && (
                    <small className={styles.fieldError} id="outcome-unit-error" role="alert">
                      {outcomeErrors.unit}
                    </small>
                  )}
                </div>
              </div>
              <div className={`${styles.formGrid} ${styles.outcomeFields}`}>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-deliverable">
                      Entregable asociado <span className={styles.optionalTag}>Opcional</span>
                    </label>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-deliverable-hint">
                    Vincula la medición con el trabajo que contribuye al resultado.
                  </p>
                  <ProjectOptionSelect
                    id="outcome-deliverable"
                    label="Entregable asociado al resultado"
                    value={outcomeDraft.deliverableId}
                    options={deliverableOptions}
                    density="comfortable"
                    variant="contextual"
                    menuZIndex={1200}
                    closeOnTab
                    onChange={(deliverableId) =>
                      setOutcomeDraft((current) => ({ ...current, deliverableId }))
                    }
                  />
                </div>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-milestone">
                      Hito relacionado <span className={styles.optionalTag}>Opcional</span>
                    </label>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-milestone-hint">
                    Asocia el momento del proyecto en que se observó el cambio.
                  </p>
                  <ProjectOptionSelect
                    id="outcome-milestone"
                    label="Hito relacionado con el resultado"
                    value={outcomeDraft.milestoneId}
                    options={milestoneOptions}
                    density="comfortable"
                    variant="contextual"
                    menuZIndex={1200}
                    closeOnTab
                    onChange={(milestoneId) =>
                      setOutcomeDraft((current) => ({ ...current, milestoneId }))
                    }
                  />
                </div>
                <div className={styles.outcomeField}>
                  <div className={styles.outcomeFieldHeading}>
                    <label htmlFor="outcome-measured-at">
                      Fecha de medición <span className={styles.requiredTag}>Obligatorio</span>
                    </label>
                  </div>
                  <p className={styles.outcomeHint} id="outcome-measured-at-hint">
                    Día en que se recogió el dato.
                  </p>
                  <CalendarDatePicker
                    id="outcome-measured-at"
                    label="Fecha de medición"
                    value={outcomeDraft.measuredAt}
                    ariaRequired
                    ariaInvalid={Boolean(outcomeErrors.measuredAt)}
                    ariaDescribedBy={`outcome-measured-at-hint${outcomeErrors.measuredAt ? ' outcome-measured-at-error' : ''}`}
                    onChange={(measuredAt) => {
                      setOutcomeDraft((current) => ({ ...current, measuredAt }));
                      if (measuredAt) {
                        setOutcomeErrors((current) => ({ ...current, measuredAt: undefined }));
                      }
                    }}
                    portal
                    matchTriggerWidth
                  />
                  {outcomeErrors.measuredAt && (
                    <small className={styles.fieldError} id="outcome-measured-at-error" role="alert">
                      {outcomeErrors.measuredAt}
                    </small>
                  )}
                </div>
              </div>
              <div className={styles.outcomeField}>
                <div className={styles.outcomeFieldHeading}>
                  <label htmlFor="outcome-evidence">
                    Evidencia o lectura <span className={styles.optionalTag}>Opcional</span>
                  </label>
                  <span className={styles.characterCount}>
                    {outcomeDraft.evidence.length}/{outcomeTextLimits.evidence}
                  </span>
                </div>
                <p className={styles.outcomeHint} id="outcome-evidence-hint">
                  Añade la fuente, periodo, muestra o interpretación del dato.
                </p>
                <textarea
                  id="outcome-evidence"
                  rows={2}
                  maxLength={outcomeTextLimits.evidence}
                  value={outcomeDraft.evidence}
                  aria-describedby="outcome-evidence-hint"
                  onChange={(event) =>
                    setOutcomeDraft((current) => ({ ...current, evidence: event.target.value }))
                  }
                  placeholder="Fuente, periodo, muestra o interpretación del dato"
                />
              </div>
              <div className={`${styles.formActions} ${styles.outcomeActions}`}>
                <button
                  type="button"
                  className={styles.quietButton}
                  onClick={() => {
                    setShowOutcomeForm(false);
                    setOutcomeDraft(emptyOutcome);
                    setLocalError('');
                    setOutcomeErrors({});
                  }}
                >
                  Cancelar
                </button>
                <button type="submit" className={styles.primaryButton} disabled={saving}>
                  {saving ? 'Guardando…' : 'Guardar medición'}
                </button>
              </div>
            </form>
          )}
          {data.outcomes.length ? (
            <div className={styles.outcomeList}>
              {data.outcomes.map((outcome) => (
                <OutcomeCard
                  outcome={outcome}
                  key={outcome.id}
                  canEdit={canEdit}
                  saving={saving}
                  confirmingDelete={confirmDeleteOutcomeId === outcome.id}
                  onToggleDelete={() => setConfirmDeleteOutcomeId(confirmDeleteOutcomeId === outcome.id ? null : outcome.id)}
                  onDelete={() => void deleteOutcome(outcome)}
                  onCancelDelete={() => setConfirmDeleteOutcomeId(null)}
                />
              ))}
            </div>
          ) : (
            <div className={styles.nodeEmpty}>
              {data.objective
                ? 'Aún no hay resultados medidos. Registra la primera medición cuando exista evidencia.'
                : 'Define el objetivo antes de registrar mediciones.'}
            </div>
          )}
        </section>
      </div>
      {editingRequirement && requirementDeliverable && (
        <form
          className={`${styles.form} ${styles.requirementForm}`}
          role="dialog"
          aria-modal="true"
          aria-label={editingRequirement.requirementId ? 'Editar requisito' : 'Añadir requisito'}
          onKeyDown={(event) => containDialogFocus(event, () => {
            if (!saving) {
              setEditingRequirement(null);
              setRequirementDraft(emptyRequirement);
              setRequirementTitleError('');
              setRequirementCriteriaError('');
              setLocalError('');
            }
          })}
          onSubmit={saveRequirement}
        >
          <div className={styles.editorHeading}>
            <div>
              <strong>{editingRequirement.requirementId ? 'Editar requisito' : 'Añadir requisito'}</strong>
              <p>Define qué debe cumplirse para aceptar “{requirementDeliverable.name}”.</p>
            </div>
            <button
              type="button"
              className={styles.dialogClose}
              aria-label="Cerrar editor de requisito"
              disabled={saving}
              onClick={() => {
                setEditingRequirement(null);
                setRequirementDraft(emptyRequirement);
                setRequirementTitleError('');
                setRequirementCriteriaError('');
                setLocalError('');
              }}
            >
              <X size={16} />
            </button>
          </div>
          {localError && <p className={styles.error} role="alert">{localError}</p>}
          <div className={styles.requirementFields}>
            <div className={styles.deliverableField}>
              <div className={styles.deliverableFieldHeading}>
                <label htmlFor="requirement-title">Requisito <span className={styles.requiredTag}>Obligatorio</span></label>
                <span className={styles.characterCount}>{requirementDraft.title.length}/160</span>
              </div>
              <input
                autoFocus
                id="requirement-title"
                maxLength={160}
                value={requirementDraft.title}
                aria-invalid={requirementTitleError ? true : undefined}
                aria-describedby={requirementTitleError ? 'requirement-title-error' : undefined}
                onChange={(event) => {
                  setRequirementDraft({ ...requirementDraft, title: event.target.value });
                  if (event.target.value.trim()) setRequirementTitleError('');
                }}
                placeholder="Ej. El sistema permite recuperar la contraseña"
              />
              {requirementTitleError && <span className={styles.fieldError} id="requirement-title-error" role="alert">{requirementTitleError}</span>}
            </div>
            <div className={styles.requirementMeta}>
              <label>
                Tipo
                <ProjectOptionSelect
                  id="requirement-type"
                  label="Tipo de requisito"
                  value={requirementDraft.requirementType}
                  options={requirementTypeOptions}
                  density="comfortable"
                  variant="contextual"
                  closeOnTab
                  menuZIndex={1202}
                  onChange={(value) => setRequirementDraft({ ...requirementDraft, requirementType: value as RequirementDraft['requirementType'] })}
                />
              </label>
              <label>
                Prioridad
                <ProjectOptionSelect
                  id="requirement-priority"
                  label="Prioridad del requisito"
                  value={requirementDraft.priority}
                  options={requirementPriorityOptions}
                  density="comfortable"
                  variant="contextual"
                  closeOnTab
                  menuZIndex={1202}
                  onChange={(value) => setRequirementDraft({ ...requirementDraft, priority: value as RequirementDraft['priority'] })}
                />
              </label>
              <label>
                Estado
                <ProjectOptionSelect
                  id="requirement-status"
                  label="Estado del requisito"
                  value={requirementDraft.status}
                  options={requirementStatusOptions}
                  density="comfortable"
                  variant="contextual"
                  closeOnTab
                  menuZIndex={1202}
                  onChange={(value) => setRequirementDraft({ ...requirementDraft, status: value as RequirementDraft['status'] })}
                />
              </label>
            </div>
            <div className={styles.deliverableField}>
              <div className={styles.deliverableFieldHeading}>
                <label htmlFor="requirement-description">Descripción <span className={styles.optionalTag}>Opcional</span></label>
                <span className={styles.characterCount}>{requirementDraft.description.length}/1000</span>
              </div>
              <textarea
                id="requirement-description"
                rows={2}
                maxLength={1000}
                value={requirementDraft.description}
                onChange={(event) => setRequirementDraft({ ...requirementDraft, description: event.target.value })}
                placeholder="Explica el comportamiento o condición que se necesita"
              />
            </div>
            <div className={styles.deliverableField}>
              <div className={styles.deliverableFieldHeading}>
                <label htmlFor="requirement-acceptance">Criterio de aceptación <span className={styles.requiredTag}>Obligatorio</span></label>
                <span className={styles.characterCount}>{requirementDraft.acceptanceCriteria.length}/2000</span>
              </div>
              <textarea
                id="requirement-acceptance"
                rows={3}
                maxLength={2000}
                value={requirementDraft.acceptanceCriteria}
                aria-invalid={requirementCriteriaError ? true : undefined}
                aria-describedby={requirementCriteriaError ? 'requirement-acceptance-error' : undefined}
                onChange={(event) => {
                  setRequirementDraft({ ...requirementDraft, acceptanceCriteria: event.target.value });
                  if (event.target.value.trim()) setRequirementCriteriaError('');
                }}
                placeholder="¿Qué debe ocurrir para considerar que se cumple?"
              />
              {requirementCriteriaError && <span className={styles.fieldError} id="requirement-acceptance-error" role="alert">{requirementCriteriaError}</span>}
            </div>
            <div className={styles.deliverableField}>
              <div className={styles.deliverableFieldHeading}>
                <label htmlFor="requirement-verification">Método de validación <span className={styles.optionalTag}>Opcional</span></label>
                <span className={styles.characterCount}>{requirementDraft.verificationMethod.length}/500</span>
              </div>
              <input
                id="requirement-verification"
                maxLength={500}
                value={requirementDraft.verificationMethod}
                onChange={(event) => setRequirementDraft({ ...requirementDraft, verificationMethod: event.target.value })}
                placeholder="Ej. Prueba funcional con tres perfiles"
              />
            </div>
            <div className={styles.deliverableField}>
              <div className={styles.deliverableFieldHeading}>
                <label htmlFor="requirement-evidence">Evidencia <span className={styles.optionalTag}>Opcional</span></label>
                <span className={styles.characterCount}>{requirementDraft.evidence.length}/2000</span>
              </div>
              <textarea
                id="requirement-evidence"
                rows={2}
                maxLength={2000}
                value={requirementDraft.evidence}
                onChange={(event) => setRequirementDraft({ ...requirementDraft, evidence: event.target.value })}
                placeholder="Enlace, referencia o resultado de la validación"
              />
            </div>
            <div className={styles.requirementCardPicker}>
              {requirementCardOptions.length || requirementDraft.cardIds.length ? (
                <CardPicker
                  cards={requirementCardOptions}
                  search={cardSearch}
                  setSearch={setCardSearch}
                  selected={requirementDraft.cardIds}
                  setSelected={(cardIds) => setRequirementDraft({ ...requirementDraft, cardIds })}
                />
              ) : (
                <div className={styles.requirementNoCards}>
                  <strong>Tarjetas que implementan este requisito</strong>
                  <span>Primero vincula tarjetas al entregable “{requirementDeliverable.name}”.</span>
                </div>
              )}
            </div>
          </div>
          <div className={styles.formActions}>
            <button
              type="button"
              className={styles.quietButton}
              disabled={saving}
              onClick={() => {
                setEditingRequirement(null);
                setRequirementDraft(emptyRequirement);
                setRequirementTitleError('');
                setRequirementCriteriaError('');
                setLocalError('');
              }}
            >Cancelar</button>
            <button type="submit" className={styles.primaryButton} disabled={saving}>
              {saving ? 'Guardando…' : editingRequirement.requirementId ? 'Guardar cambios' : 'Añadir requisito'}
            </button>
          </div>
        </form>
      )}
      <p className={styles.footnote}>
        El brief de origen queda como referencia. El objetivo puede ajustarse y los resultados se
        guardan como mediciones históricas.
      </p>
    </div>
  );
}

function CardPicker({
  cards,
  search,
  setSearch,
  selected,
  setSelected,
  autoFocus = false,
}: {
  cards: ProjectBacklogCard[];
  search: string;
  setSearch: (value: string) => void;
  selected: string[];
  setSelected: (value: string[]) => void;
  autoFocus?: boolean;
}) {
  return (
    <fieldset className={styles.cardPicker}>
      <legend>
        <span>
          Tarjetas relacionadas <i className={styles.optionalTag}>Opcional</i>
        </span>
        <small className={styles.selectionCount}>
          {selected.length} {selected.length === 1 ? 'seleccionada' : 'seleccionadas'}
        </small>
      </legend>
      <input
        autoFocus={autoFocus}
        aria-label="Buscar tarjetas"
        maxLength={120}
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Buscar por título o código"
      />
      <div className={styles.cardPickerList}>
        {cards.length ? (
          cards.map((card) => (
            <label key={card.id}>
              <input
                type="checkbox"
                checked={selected.includes(card.id)}
                onChange={(event) =>
                  setSelected(
                    event.target.checked
                      ? [...selected, card.id]
                      : selected.filter((id) => id !== card.id)
                  )
                }
              />
              <span className={styles.cardPickerText}>
                <strong>{card.title}</strong>
                <small className={styles.cardListBadge}>Lista: {card.listName}</small>
              </span>
            </label>
          ))
        ) : (
          <small>No hay tarjetas que coincidan con la búsqueda.</small>
        )}
      </div>
    </fieldset>
  );
}

function OutcomeCard({
  outcome,
  canEdit,
  saving,
  confirmingDelete,
  onToggleDelete,
  onDelete,
  onCancelDelete,
}: {
  outcome: ProjectTraceabilityOutcome;
  canEdit: boolean;
  saving: boolean;
  confirmingDelete: boolean;
  onToggleDelete: () => void;
  onDelete: () => void;
  onCancelDelete: () => void;
}) {
  const delta = outcome.targetValue == null ? null : outcome.actualValue - outcome.targetValue;
  const preservedRelations = [
    'el objetivo',
    outcome.deliverableName ? `el entregable “${outcome.deliverableName}”` : null,
    outcome.milestoneName ? `el hito “${outcome.milestoneName}”` : null,
  ].filter(Boolean);
  return (
    <article className={styles.outcome}>
      <div className={styles.outcomeTop}>
        <div>
          <span className={styles.eyebrow}>{formatDate(outcome.measuredAt)}</span>
          <h5>{outcome.metricName}</h5>
        </div>
        <div className={styles.outcomeTopActions}>
          <strong>
            {outcome.actualValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
            <span>{outcome.unit}</span>
          </strong>
          {canEdit && (
            <button
              type="button"
              className={styles.deleteIconButton}
              aria-label={`Eliminar resultado ${outcome.metricName}`}
              aria-expanded={confirmingDelete}
              title="Eliminar resultado"
              disabled={saving}
              onClick={onToggleDelete}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {outcome.targetValue != null && (
        <p className={styles.outcomeTarget}>
          Meta: {outcome.targetValue.toLocaleString('es-CL', { maximumFractionDigits: 2 })}{' '}
          {outcome.unit}
          {delta != null && (
            <span className={styles.delta}>
              {' '}
              · Diferencia {delta > 0 ? '+' : ''}
              {delta.toLocaleString('es-CL', { maximumFractionDigits: 2 })}
            </span>
          )}
        </p>
      )}
      <small>
        Objetivo v{outcome.objectiveVersion}: {outcome.objectiveStatement}
      </small>
      {(outcome.deliverableName || outcome.milestoneName) && (
        <div className={styles.outcomeRelations}>
          {outcome.deliverableName && (
            <span>
              <strong>Entregable</strong>
              {outcome.deliverableName}
            </span>
          )}
          {outcome.milestoneName && (
            <span>
              <strong>Hito</strong>
              {outcome.milestoneName}
            </span>
          )}
        </div>
      )}
      {outcome.evidence && <p className={styles.evidence}>{outcome.evidence}</p>}
      <footer>Registró {outcome.recorderName}</footer>
      {confirmingDelete && (
        <div className={styles.deleteConfirm} role="group" aria-label={`Confirmar eliminación de la medición ${outcome.metricName}`}>
          <div className={styles.deleteConfirmCopy}>
            <strong>¿Eliminar esta medición?</strong>
            <p>
              Dejará de aparecer en resultados medidos; su copia con métrica, valor, fecha, evidencia y vínculos quedará en la actividad del proyecto. Los elementos relacionados ({preservedRelations.join(', ')}) permanecerán intactos.
            </p>
          </div>
          <div className={styles.deleteConfirmActions}>
            <button type="button" className={styles.quietButton} disabled={saving} onClick={onCancelDelete}>Conservar</button>
            <button type="button" className={styles.deleteDangerButton} disabled={saving} onClick={onDelete}>
              {saving ? 'Eliminando…' : 'Eliminar medición'}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}
