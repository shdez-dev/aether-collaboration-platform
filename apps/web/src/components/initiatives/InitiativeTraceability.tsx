'use client';

import { useMemo, useState } from 'react';
import { ArrowRight, ClipboardCheck, Download, FileClock, History, UserRound } from 'lucide-react';
import type {
  InitiativeAssignmentEntry,
  InitiativeContentEntry,
  InitiativeStage,
  InitiativeWorkflowEntry,
  TriageAssessment,
} from '@/stores/initiativeStore';
import styles from './InitiativeTraceability.module.css';

const stages: InitiativeStage[] = ['SUBMITTED', 'TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'APPROVED'];
const stageNames: Record<InitiativeStage, string> = {
  SUBMITTED: 'Recepción',
  TRIAGE: 'Triage',
  DIAGNOSIS: 'Diagnóstico',
  VALIDATION: 'Validación',
  APPROVED: 'Aprobación',
  DECLINED: 'No continúa',
  PAUSED: 'En pausa',
  ARCHIVED: 'Archivada',
};
const roleNames: Record<string, string> = {
  REQUESTER: 'solicitante',
  TRIAGE_COORDINATOR: 'coordinación de triage',
  MENTOR: 'mentoría',
  EVALUATOR: 'evaluación',
  PROJECT_LEAD: 'liderazgo de proyecto',
  COLLABORATOR: 'colaboración',
  SPONSOR: 'patrocinio',
};
const fieldNames: Record<string, string> = {
  title: 'Nombre',
  description: 'Resumen',
  problemStatement: 'Problemática',
  impactedPeople: 'Personas impactadas',
  problemImpact: 'Impacto de la problemática',
  impactedCount: 'Cantidad de personas',
  expectedOutcome: 'Propuesta de valor',
  proposedSolution: 'Solución',
  differentiation: 'Diferenciación',
  proposedNextStep: 'Siguiente paso',
  priority: 'Prioridad',
  nextReviewAt: 'Próxima revisión',
  evidence: 'Evidencias',
  attachments: 'Adjuntos',
};

type Category = 'all' | 'workflow' | 'assignment' | 'content';
type TraceEvent = {
  id: string;
  category: Exclude<Category, 'all'>;
  date: string;
  title: string;
  actor: string;
  detail?: string;
  changes?: InitiativeContentEntry['changes'];
  assessment?: TriageAssessment[] | null;
  nextReviewAt?: string | null;
};

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Sin registrar';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) return value.length ? JSON.stringify(value, null, 2) : 'Sin registrar';
  return JSON.stringify(value, null, 2);
}

function dateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Fecha no disponible'
    : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}

function csvCell(value: string) {
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function InitiativeTraceability({
  initiativeId,
  currentStage,
  receivedAt,
  projectId,
  history,
  assignmentHistory,
  contentHistory,
}: {
  initiativeId: string;
  currentStage: InitiativeStage;
  receivedAt: string;
  projectId?: string | null;
  history: InitiativeWorkflowEntry[];
  assignmentHistory: InitiativeAssignmentEntry[];
  contentHistory: InitiativeContentEntry[];
}) {
  const [category, setCategory] = useState<Category>('all');
  const events = useMemo<TraceEvent[]>(
    () =>
      [
        ...history.map((entry) => ({
          id: `workflow-${entry.id}`,
          category: 'workflow' as const,
          date: entry.createdAt,
          title:
            entry.decision === 'FORMALIZED'
              ? 'Proyecto formalizado'
              : entry.fromStage
                ? `${stageNames[entry.fromStage]} → ${stageNames[entry.toStage ?? currentStage]}`
                : 'Iniciativa recibida',
          actor: entry.actorName || 'Sistema',
          detail: [
            entry.decision && entry.decision !== 'FORMALIZED'
              ? `Decisión: ${entry.decision}`
              : null,
            entry.reason,
          ]
            .filter(Boolean)
            .join(' · '),
          assessment: entry.triageAssessment,
          nextReviewAt: entry.nextReviewAt,
        })),
        ...assignmentHistory.map((entry) => ({
          id: `assignment-${entry.id}`,
          category: 'assignment' as const,
          date: entry.createdAt,
          title: `${entry.action === 'ASSIGNED' ? 'Asignación' : entry.action === 'REVOKED' ? 'Revocación' : 'Remoción'} de ${roleNames[entry.role] ?? entry.role}`,
          actor: entry.actorName || 'Sistema',
          detail: [entry.subjectName || 'Participante', entry.reason].filter(Boolean).join(' · '),
        })),
        ...contentHistory.map((entry) => ({
          id: `content-${entry.id}`,
          category: 'content' as const,
          date: entry.createdAt,
          title: 'Expediente actualizado',
          actor: entry.actorName || 'Sistema',
          changes: entry.changes,
          detail: Object.keys(entry.changes)
            .map((field) => fieldNames[field] ?? field)
            .join(', '),
        })),
      ].sort(
        (a, b) =>
          new Date(b.date).getTime() - new Date(a.date).getTime() || a.id.localeCompare(b.id)
      ),
    [assignmentHistory, contentHistory, currentStage, history]
  );
  const visible =
    category === 'all' ? events : events.filter((event) => event.category === category);
  const visited = new Set(history.map((entry) => entry.toStage));

  function downloadCsv() {
    const rows = [
      ['Fecha', 'Tipo', 'Hecho', 'Responsable', 'Detalle', 'Cambios'],
      ...events.map((event) => [
        dateTime(event.date),
        event.category,
        event.title,
        event.actor,
        event.detail ?? '',
        event.changes ? JSON.stringify(event.changes) : '',
      ]),
    ];
    const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `trazabilidad-iniciativa-${initiativeId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={styles.panel} aria-labelledby="initiative-trace-heading">
      <div className={styles.heading}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>
            <History size={14} /> HISTORIAL INSTITUCIONAL
          </span>
          <h2 id="initiative-trace-heading">Trazabilidad de la iniciativa</h2>
          <p>
            Consulta las decisiones, responsables y cambios del expediente en orden cronológico.
          </p>
        </div>
        <button
          type="button"
          className={styles.exportButton}
          onClick={downloadCsv}
          disabled={!events.length}
        >
          <Download size={15} /> Descargar historial
        </button>
      </div>

      <div className={styles.summary}>
        <div>
          <span>Recibida</span>
          <strong>{dateTime(receivedAt)}</strong>
        </div>
        <div>
          <span>Estado actual</span>
          <strong>{stageNames[currentStage]}</strong>
        </div>
        <div>
          <span>Movimientos</span>
          <strong>{events.length}</strong>
        </div>
        <div>
          <span>Resultado</span>
          <strong>
            {projectId
              ? 'Proyecto formalizado'
              : currentStage === 'APPROVED'
                ? 'Pendiente de formalizar'
                : 'En iniciativa'}
          </strong>
        </div>
      </div>

      <div className={styles.journey} aria-label="Recorrido institucional">
        {stages.map((stage, index) => (
          <div
            key={stage}
            className={`${styles.step} ${visited.has(stage) || currentStage === stage ? styles.visited : ''} ${currentStage === stage ? styles.current : ''}`}
          >
            <span className={styles.stepNumber}>{index + 1}</span>
            <span>{stageNames[stage]}</span>
          </div>
        ))}
        <div className={`${styles.step} ${projectId ? styles.visited : ''}`}>
          <span className={styles.stepNumber}>6</span>
          <span>Proyecto</span>
        </div>
      </div>
      {['DECLINED', 'PAUSED', 'ARCHIVED'].includes(currentStage) && (
        <p className={styles.interruption}>
          Estado actual: {stageNames[currentStage]}. Revisa la decisión y su motivo en el historial.
        </p>
      )}

      <div className={styles.historyHeading}>
        <h3>Registro de actividad</h3>
        <span>
          {visible.length} {visible.length === 1 ? 'registro' : 'registros'}
        </span>
      </div>
      <div className={styles.filters} role="group" aria-label="Filtrar historial">
        {(
          [
            ['all', 'Todo'],
            ['workflow', 'Etapas y decisiones'],
            ['assignment', 'Responsables'],
            ['content', 'Expediente'],
          ] as const
        ).map(([value, text]) => (
          <button
            key={value}
            type="button"
            aria-pressed={category === value}
            className={category === value ? styles.filterActive : styles.filter}
            onClick={() => setCategory(value)}
          >
            {text}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className={styles.empty}>
          <FileClock size={20} />
          <strong>Sin movimientos en esta categoría</strong>
          <span>Los cambios nuevos aparecerán aquí con fecha y responsable.</span>
        </div>
      ) : (
        <ol className={styles.timeline}>
          {visible.map((event) => (
            <li key={event.id} className={styles.event}>
              <span className={styles.dot} data-category={event.category} aria-hidden="true" />
              <div className={styles.eventBody}>
                <div className={styles.eventTop}>
                  <span className={styles.eventType}>
                    {event.category === 'workflow' ? (
                      <ClipboardCheck size={14} />
                    ) : event.category === 'assignment' ? (
                      <UserRound size={14} />
                    ) : (
                      <FileClock size={14} />
                    )}
                    {event.category === 'workflow'
                      ? 'Flujo'
                      : event.category === 'assignment'
                        ? 'Responsables'
                        : 'Expediente'}
                  </span>
                  <time dateTime={event.date}>{dateTime(event.date)}</time>
                </div>
                <strong>{event.title}</strong>
                {event.detail && <p>{event.detail}</p>}
                {event.assessment && event.assessment.length > 0 && (
                  <div className={styles.assessment}>
                    <span>Evaluación registrada</span>
                    {event.assessment.map((criterion, index) => (
                      <div key={`${criterion.criterion}-${index}`}>
                        <strong>{criterion.criterion}</strong>
                        <span>
                          {criterion.status === 'PASS'
                            ? 'Cumple'
                            : criterion.status === 'FAIL'
                              ? 'No cumple'
                              : 'No aplica'}
                        </span>
                        {criterion.note && <p>{criterion.note}</p>}
                      </div>
                    ))}
                  </div>
                )}
                {event.nextReviewAt && (
                  <p className={styles.review}>
                    Próxima revisión fijada: {dateTime(event.nextReviewAt)}
                  </p>
                )}
                <span className={styles.actor}>Por {event.actor}</span>
                {event.changes && (
                  <details className={styles.details}>
                    <summary>
                      Ver valores anteriores y nuevos <ArrowRight size={13} />
                    </summary>
                    <div className={styles.changes}>
                      {Object.entries(event.changes).map(([field, values]) => (
                        <div key={field} className={styles.change}>
                          <strong>{fieldNames[field] ?? field}</strong>
                          <div>
                            <span>Antes</span>
                            <pre>{displayValue(values.from)}</pre>
                          </div>
                          <div>
                            <span>Después</span>
                            <pre>{displayValue(values.to)}</pre>
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
