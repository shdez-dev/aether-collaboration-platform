'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type CSSProperties, type FormEvent, useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarClock, CheckCircle2, ClipboardList, ExternalLink, FileText, History, Link2, LoaderCircle, ShieldCheck, UserMinus, UserPlus, Users } from 'lucide-react';
import { InitiativePriority, InitiativeStage, TriageAssessmentStatus, useInitiativeStore } from '@/stores/initiativeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const stageLabels: Record<InitiativeStage, string> = {
  SUBMITTED: 'Recibida', TRIAGE: 'Triage', DIAGNOSIS: 'Diagnóstico', VALIDATION: 'Validación',
  APPROVED: 'Aprobada', DECLINED: 'No continúa', PAUSED: 'En pausa', ARCHIVED: 'Archivada',
};

const roleLabels: Record<string, string> = {
  REQUESTER: 'Solicitante', TRIAGE_COORDINATOR: 'Coordinación de triage', MENTOR: 'Mentoría',
  EVALUATOR: 'Evaluación', PROJECT_LEAD: 'Liderazgo de proyecto', COLLABORATOR: 'Colaboración', SPONSOR: 'Patrocinio',
};

const allowedNextStages: Record<InitiativeStage, InitiativeStage[]> = {
  SUBMITTED: ['TRIAGE', 'PAUSED', 'ARCHIVED'], TRIAGE: ['DIAGNOSIS', 'DECLINED', 'PAUSED', 'ARCHIVED'],
  DIAGNOSIS: ['TRIAGE', 'VALIDATION', 'DECLINED', 'PAUSED', 'ARCHIVED'], VALIDATION: ['DIAGNOSIS', 'APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED'],
  APPROVED: ['PAUSED', 'ARCHIVED'], PAUSED: ['TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'ARCHIVED'], DECLINED: ['ARCHIVED'], ARCHIVED: [],
};
const decisionStages: InitiativeStage[] = ['APPROVED', 'DECLINED', 'PAUSED', 'ARCHIVED'];
const assignableRoles = ['TRIAGE_COORDINATOR', 'MENTOR', 'EVALUATOR', 'PROJECT_LEAD', 'COLLABORATOR', 'SPONSOR'] as const;
const assessmentStatusLabels: Record<TriageAssessmentStatus, string> = { PASS: 'Cumple', FAIL: 'No cumple', NOT_APPLICABLE: 'No aplica' };
const priorities: InitiativePriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

type EvidenceDraft = { title: string; url: string; note: string };
type AttachmentDraft = { name: string; url: string; type: string };
type InitiativeEditForm = {
  description: string;
  problemStatement: string;
  proposedNextStep: string;
  priority: InitiativePriority;
  nextReviewAt: string;
  evidence: EvidenceDraft[];
  attachments: AttachmentDraft[];
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return 'Sin fecha';
  return new Intl.DateTimeFormat('es-CL', includeTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'long', year: 'numeric' }
  ).format(new Date(value));
}

function stageLabel(stage?: InitiativeStage | null) {
  return stage ? stageLabels[stage] ?? stage : 'Sin etapa previa';
}

function assessmentPill(status?: TriageAssessmentStatus): CSSProperties {
  const tones: Record<TriageAssessmentStatus, Pick<CSSProperties, 'color' | 'background' | 'borderColor'>> = {
    PASS: { color: '#bde7c8', background: '#173525', borderColor: '#3b704b' },
    FAIL: { color: '#fecaca', background: '#3a202a', borderColor: '#7f3d4c' },
    NOT_APPLICABLE: { color: '#d2d9e5', background: '#252c40', borderColor: '#46516a' },
  };
  return { display: 'inline-flex', width: 'fit-content', border: '1px solid', borderRadius: 99, padding: '4px 8px', fontSize: 11, fontWeight: 800, ...(status ? tones[status] : { color: '#a6b0c1', background: '#22283a', borderColor: '#414b62' }) };
}

function toDateTimeLocal(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function isHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

export default function InitiativeDetailPage() {
  const params = useParams<{ id: string }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const { initiativeDetail, detailLoading, error, actionError, fetchInitiativeDetail, transitionDetail, updateDetail, assignParticipant, removeParticipant, convertDetail, clearActionError } = useInitiativeStore();
  const workspaceMembers = useWorkspaceStore((state) => state.currentMembers);
  const fetchWorkspaceMembers = useWorkspaceStore((state) => state.fetchMembers);
  const [transitionStage, setTransitionStage] = useState<InitiativeStage | ''>('');
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [participantUserId, setParticipantUserId] = useState('');
  const [participantRole, setParticipantRole] = useState<(typeof assignableRoles)[number]>('MENTOR');
  const [triageAssessment, setTriageAssessment] = useState<Record<string, { status: TriageAssessmentStatus | ''; note: string }>>({});
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState<InitiativeEditForm>({ description: '', problemStatement: '', proposedNextStep: '', priority: 'MEDIUM', nextReviewAt: '', evidence: [], attachments: [] });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (id) void fetchInitiativeDetail(id);
  }, [fetchInitiativeDetail, id]);

  useEffect(() => {
    const detail = initiativeDetail;
    if (!detail?.access.canManage || !detail.initiative.workspaceId) return;
    void fetchWorkspaceMembers(detail.initiative.workspaceId);
  }, [fetchWorkspaceMembers, initiativeDetail?.access.canManage, initiativeDetail?.initiative.workspaceId]);

  useEffect(() => {
    if (!initiativeDetail) return;
    setTransitionStage(allowedNextStages[initiativeDetail.initiative.stage][0] ?? '');
    setDecision('');
    setReason('');
    setFormError(null);
    setTriageAssessment(Object.fromEntries((initiativeDetail.initiative.triageCriteria ?? []).map((criterion) => {
      const saved = (initiativeDetail.initiative.triageAssessment ?? []).find((entry) => entry.criterion === criterion);
      return [criterion, { status: saved?.status ?? '', note: saved?.note ?? '' }];
    })));
    setEditForm({
      description: initiativeDetail.initiative.description ?? '',
      problemStatement: initiativeDetail.initiative.problemStatement ?? '',
      proposedNextStep: initiativeDetail.initiative.proposedNextStep ?? '',
      priority: initiativeDetail.initiative.priority,
      nextReviewAt: toDateTimeLocal(initiativeDetail.initiative.nextReviewAt),
      evidence: initiativeDetail.initiative.evidence.map((entry) => ({ title: entry.title, url: entry.url ?? '', note: entry.note ?? '' })),
      attachments: initiativeDetail.initiative.attachments.map((entry) => ({ name: entry.name, url: entry.url, type: entry.type ?? '' })),
    });
    setEditing(false);
  }, [initiativeDetail?.initiative.id, initiativeDetail?.initiative.stage]);

  if (detailLoading) return <main style={page}><section style={state}><LoaderCircle className="animate-spin" size={24} /><span>Cargando iniciativa…</span></section></main>;
  if (error) return <main style={page}><section style={state}><ClipboardList size={28} /><h1>No fue posible abrir esta iniciativa</h1><p>{error}</p><Link href="/dashboard/initiatives" style={secondaryButton}><ArrowLeft size={16} /> Volver a iniciativas</Link></section></main>;
  if (!initiativeDetail) return <main style={page}><section style={state}><ClipboardList size={28} /><h1>Iniciativa no encontrada</h1><p>Puede que no tengas acceso o que ya no exista.</p><Link href="/dashboard/initiatives" style={secondaryButton}><ArrowLeft size={16} /> Volver a iniciativas</Link></section></main>;

  const { initiative, access, participants, history, assignmentHistory } = initiativeDetail;
  const canChangeContent = access.canEdit || access.canManage;
  const nextStages = allowedNextStages[initiative.stage];
  const needsDecision = transitionStage !== '' && decisionStages.includes(transitionStage);
  const triageCriteria = initiative.triageCriteria ?? [];
  const assessmentPayload = triageCriteria.flatMap((criterion) => {
    const draft = triageAssessment[criterion];
    return draft?.status ? [{ criterion, status: draft.status, note: draft.note.trim() || null }] : [];
  });

  function resetEditForm() {
    setEditForm({
      description: initiative.description ?? '',
      problemStatement: initiative.problemStatement ?? '',
      proposedNextStep: initiative.proposedNextStep ?? '',
      priority: initiative.priority,
      nextReviewAt: toDateTimeLocal(initiative.nextReviewAt),
      evidence: initiative.evidence.map((entry) => ({ title: entry.title, url: entry.url ?? '', note: entry.note ?? '' })),
      attachments: initiative.attachments.map((entry) => ({ name: entry.name, url: entry.url, type: entry.type ?? '' })),
    });
  }

  async function refreshAfterAction() {
    if (id) await fetchInitiativeDetail(id);
  }

  async function submitTransition(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!transitionStage) return;
    if (needsDecision && (!decision.trim() || !reason.trim())) {
      setFormError('Esta decisión requiere una decisión explícita y su motivo.');
      return;
    }
    if (transitionStage === 'APPROVED' && assessmentPayload.length !== triageCriteria.length) {
      setFormError('Completa el resultado de cada criterio de triage antes de aprobar.');
      return;
    }
    setFormError(null); clearActionError(); setActionBusy(true);
    const completed = await transitionDetail(initiative.id, { stage: transitionStage, decision: needsDecision ? decision.trim() : undefined, reason: reason.trim() || undefined, triageAssessment: assessmentPayload });
    if (completed) await refreshAfterAction();
    setActionBusy(false);
  }

  async function submitParticipant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!participantUserId) { setFormError('Selecciona una persona del espacio de trabajo.'); return; }
    setFormError(null); clearActionError(); setActionBusy(true);
    const completed = await assignParticipant(initiative.id, { userId: participantUserId, role: participantRole });
    if (completed) { setParticipantUserId(''); await refreshAfterAction(); }
    setActionBusy(false);
  }

  async function removePerson(userId: string, name: string) {
    if (!window.confirm(`¿Remover a ${name} de los roles operativos de esta iniciativa?`)) return;
    setFormError(null); clearActionError(); setActionBusy(true);
    const completed = await removeParticipant(initiative.id, userId);
    if (completed) await refreshAfterAction();
    setActionBusy(false);
  }

  async function formalizeInitiative() {
    setFormError(null); clearActionError(); setActionBusy(true);
    const completed = await convertDetail(initiative.id);
    if (completed) await refreshAfterAction();
    setActionBusy(false);
  }

  async function submitEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const evidence = editForm.evidence.filter((entry) => entry.title.trim() || entry.url.trim() || entry.note.trim());
    const attachments = editForm.attachments.filter((entry) => entry.name.trim() || entry.url.trim() || entry.type.trim());
    const invalidEvidence = evidence.find((entry) => !entry.title.trim() || (entry.url.trim() && !isHttpUrl(entry.url.trim())));
    const invalidAttachment = attachments.find((entry) => !entry.name.trim() || !isHttpUrl(entry.url.trim()));
    if (invalidEvidence) { setFormError('Cada evidencia necesita título y, si tiene enlace, una URL http(s) válida.'); return; }
    if (invalidAttachment) { setFormError('Cada adjunto necesita nombre y una URL http(s) válida.'); return; }

    setFormError(null); clearActionError(); setActionBusy(true);
    const completed = await updateDetail(initiative.id, {
      description: editForm.description.trim() || null,
      problemStatement: editForm.problemStatement.trim() || null,
      proposedNextStep: editForm.proposedNextStep.trim() || null,
      priority: editForm.priority,
      nextReviewAt: editForm.nextReviewAt ? new Date(editForm.nextReviewAt).toISOString() : null,
      evidence: evidence.map((entry) => ({ title: entry.title.trim(), url: entry.url.trim() || undefined, note: entry.note.trim() || undefined })),
      attachments: attachments.map((entry) => ({ name: entry.name.trim(), url: entry.url.trim(), type: entry.type.trim() || undefined })),
    });
    if (completed) { setEditing(false); await refreshAfterAction(); }
    setActionBusy(false);
  }

  return <main style={page}>
    <Link href="/dashboard/initiatives" style={backLink}><ArrowLeft size={16} /> Iniciativas</Link>
    <header style={header}>
      <div>
        <p style={eyebrow}>{access.isExternal ? 'ACCESO EXTERNO LIMITADO' : 'INICIATIVA INSTITUCIONAL'}</p>
        <div style={titleRow}><h1 style={title}>{initiative.title}</h1><span style={stagePill}>{stageLabel(initiative.stage)}</span></div>
        <p style={subtitle}>{initiative.description || 'Propuesta en evaluación institucional.'}</p>
      </div>
      <section style={reviewCard}><CalendarClock size={18} /><div><span style={muted}>Próxima revisión</span><strong>{formatDate(initiative.nextReviewAt)}</strong></div></section>
    </header>

    {canChangeContent && <section style={permissionBanner}>
      <ShieldCheck size={18} /><span>{access.canManage ? 'Tienes permisos de coordinación para administrar esta iniciativa.' : 'Puedes actualizar la información de esta iniciativa durante esta etapa.'}</span>
    </section>}

    <div style={layout}>
      <div style={mainColumn}>
        <section style={panel}>
          <h2 style={sectionTitle}>Diagnóstico y siguiente paso</h2>
          <div style={contentBlock}><span style={label}>Problema u oportunidad</span><p>{initiative.problemStatement || 'Aún no se ha declarado un problema u oportunidad.'}</p></div>
          <div style={contentBlock}><span style={label}>Siguiente paso</span><p>{initiative.proposedNextStep || 'Pendiente de definir por la coordinación.'}</p></div>
          {(initiative.decision || initiative.decisionReason) && <div style={decisionStyle}><CheckCircle2 size={18} /><div><strong>{initiative.decision || 'Decisión registrada'}</strong><p>{initiative.decisionReason || 'Sin motivo adicional.'}</p></div></div>}
        </section>

        {!access.isExternal && triageCriteria.length > 0 && <section style={panel}>
          <h2 style={sectionTitle}>Criterios de triage</h2>
          <p style={emptyText}>Esta evaluación corresponde a los criterios vigentes cuando se recibió la iniciativa. Se requiere completar todos para aprobarla.</p>
          <div style={criteriaList}>
            {triageCriteria.map((criterion) => {
              const saved = (initiative.triageAssessment ?? []).find((entry) => entry.criterion === criterion);
              const draft = triageAssessment[criterion];
              return <article key={criterion} style={criterionCard}>
                <strong>{criterion}</strong>
                {access.canManage ? <>
                  <select value={draft?.status ?? ''} onChange={(event) => setTriageAssessment((current) => ({ ...current, [criterion]: { status: event.target.value as TriageAssessmentStatus | '', note: current[criterion]?.note ?? '' } }))} style={input} disabled={actionBusy} aria-label={`Resultado para ${criterion}`}>
                    <option value="">Selecciona un resultado</option>
                    {(Object.keys(assessmentStatusLabels) as TriageAssessmentStatus[]).map((status) => <option key={status} value={status}>{assessmentStatusLabels[status]}</option>)}
                  </select>
                  <textarea value={draft?.note ?? ''} onChange={(event) => setTriageAssessment((current) => ({ ...current, [criterion]: { status: current[criterion]?.status ?? '', note: event.target.value } }))} style={criteriaNote} disabled={actionBusy} placeholder="Nota opcional de evaluación" aria-label={`Nota para ${criterion}`} />
                </> : <div style={criteriaReadOnly}>
                  <span style={assessmentPill(saved?.status)}>{saved ? assessmentStatusLabels[saved.status] : 'Sin evaluar'}</span>
                  {saved?.note && <p>{saved.note}</p>}
                </div>}
              </article>;
            })}
          </div>
        </section>}

        {canChangeContent && <section style={panel}>
          <h2 style={sectionTitle}><ShieldCheck size={18} /> Coordinación de la iniciativa</h2>
          {(actionError || formError) && <p style={actionErrorStyle}>{formError || actionError}</p>}
          {!editing ? <button type="button" onClick={() => { resetEditForm(); setFormError(null); clearActionError(); setEditing(true); }} style={secondaryButton} disabled={actionBusy}>Editar información</button> : <form onSubmit={submitEdit} style={editFormStyle}>
            <h3 style={subsectionTitle}>Información de la iniciativa</h3>
            <label style={formLabel}>Descripción
              <textarea value={editForm.description} onChange={(event) => setEditForm((current) => ({ ...current, description: event.target.value }))} style={textarea} disabled={actionBusy} placeholder="Contexto y antecedentes de la propuesta" />
            </label>
            <label style={formLabel}>Problema u oportunidad
              <textarea value={editForm.problemStatement} onChange={(event) => setEditForm((current) => ({ ...current, problemStatement: event.target.value }))} style={textarea} disabled={actionBusy} placeholder="Qué problema se busca resolver" />
            </label>
            <label style={formLabel}>Próximo paso
              <textarea value={editForm.proposedNextStep} onChange={(event) => setEditForm((current) => ({ ...current, proposedNextStep: event.target.value }))} style={textarea} disabled={actionBusy} placeholder="Acción concreta para avanzar" />
            </label>
            <div style={twoColumns}>
              <label style={formLabel}>Prioridad
                <select value={editForm.priority} onChange={(event) => setEditForm((current) => ({ ...current, priority: event.target.value as InitiativePriority }))} style={input} disabled={actionBusy}>{priorities.map((priority) => <option key={priority} value={priority}>{priority}</option>)}</select>
              </label>
              <label style={formLabel}>Próxima revisión
                <input type="datetime-local" value={editForm.nextReviewAt} onChange={(event) => setEditForm((current) => ({ ...current, nextReviewAt: event.target.value }))} style={input} disabled={actionBusy} />
              </label>
            </div>

            <div style={editResourceSection}><div style={editResourceHeader}><h4 style={resourceHeading}>Evidencia</h4><button type="button" onClick={() => setEditForm((current) => ({ ...current, evidence: [...current.evidence, { title: '', url: '', note: '' }] }))} style={textButton} disabled={actionBusy}>Agregar evidencia</button></div>
              {editForm.evidence.map((entry, index) => <div key={`evidence-${index}`} style={resourceEditor}><input value={entry.title} onChange={(event) => setEditForm((current) => ({ ...current, evidence: current.evidence.map((item, itemIndex) => itemIndex === index ? { ...item, title: event.target.value } : item) }))} style={input} disabled={actionBusy} placeholder="Título" /><input value={entry.url} onChange={(event) => setEditForm((current) => ({ ...current, evidence: current.evidence.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} style={input} disabled={actionBusy} placeholder="Enlace opcional https://" /><textarea value={entry.note} onChange={(event) => setEditForm((current) => ({ ...current, evidence: current.evidence.map((item, itemIndex) => itemIndex === index ? { ...item, note: event.target.value } : item) }))} style={compactTextarea} disabled={actionBusy} placeholder="Nota opcional" /><button type="button" onClick={() => setEditForm((current) => ({ ...current, evidence: current.evidence.filter((_, itemIndex) => itemIndex !== index) }))} style={removeTextButton} disabled={actionBusy}>Quitar</button></div>)}
            </div>

            <div style={editResourceSection}><div style={editResourceHeader}><h4 style={resourceHeading}>Adjuntos</h4><button type="button" onClick={() => setEditForm((current) => ({ ...current, attachments: [...current.attachments, { name: '', url: '', type: '' }] }))} style={textButton} disabled={actionBusy}>Agregar adjunto</button></div>
              {editForm.attachments.map((entry, index) => <div key={`attachment-${index}`} style={resourceEditor}><input value={entry.name} onChange={(event) => setEditForm((current) => ({ ...current, attachments: current.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, name: event.target.value } : item) }))} style={input} disabled={actionBusy} placeholder="Nombre del archivo" /><input value={entry.url} onChange={(event) => setEditForm((current) => ({ ...current, attachments: current.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, url: event.target.value } : item) }))} style={input} disabled={actionBusy} placeholder="Enlace https://" /><input value={entry.type} onChange={(event) => setEditForm((current) => ({ ...current, attachments: current.attachments.map((item, itemIndex) => itemIndex === index ? { ...item, type: event.target.value } : item) }))} style={input} disabled={actionBusy} placeholder="Tipo opcional" /><button type="button" onClick={() => setEditForm((current) => ({ ...current, attachments: current.attachments.filter((_, itemIndex) => itemIndex !== index) }))} style={removeTextButton} disabled={actionBusy}>Quitar</button></div>)}
            </div>
            <div style={editActions}><button type="button" onClick={() => { resetEditForm(); setEditing(false); setFormError(null); clearActionError(); }} style={secondaryButton} disabled={actionBusy}>Cancelar</button><button type="submit" style={primaryButton} disabled={actionBusy}>{actionBusy ? 'Guardando…' : 'Guardar información'}</button></div>
          </form>}
          {!editing && nextStages.length > 0 && <form onSubmit={submitTransition} style={manageForm}>
            <label style={formLabel}>Siguiente etapa
              <select value={transitionStage} onChange={(event) => setTransitionStage(event.target.value as InitiativeStage)} style={input} disabled={actionBusy}>
                {nextStages.map((stage) => <option key={stage} value={stage}>{stageLabel(stage)}</option>)}
              </select>
            </label>
            {needsDecision && <label style={formLabel}>Decisión explícita
              <input value={decision} onChange={(event) => setDecision(event.target.value)} style={input} disabled={actionBusy} required placeholder="Ej.: Aprobada por comité" />
            </label>}
            <label style={formLabel}>{needsDecision ? 'Motivo de la decisión' : 'Motivo o próximo paso'}
              <textarea value={reason} onChange={(event) => setReason(event.target.value)} style={textarea} disabled={actionBusy} required={needsDecision} placeholder={needsDecision ? 'Explica el criterio y la decisión.' : 'Deja el contexto de este cambio.'} />
            </label>
            <button type="submit" style={primaryButton} disabled={actionBusy}>{actionBusy ? 'Guardando…' : 'Registrar cambio de etapa'} <ArrowRight size={15} /></button>
          </form>}
          {!editing && initiative.stage === 'APPROVED' && !initiative.formalizedProjectId && <div style={formalizeBox}><div><strong>Lista para ejecución</strong><p>La formalización crea el proyecto, tablero, roles e hito inicial definidos por el estándar.</p></div><button type="button" onClick={formalizeInitiative} style={successButton} disabled={actionBusy}>{actionBusy ? 'Formalizando…' : 'Convertir en proyecto'} <ArrowRight size={15} /></button></div>}
        </section>}

        <section style={panel}>
          <h2 style={sectionTitle}><Link2 size={18} /> Evidencia y adjuntos</h2>
          {initiative.evidence.length === 0 && initiative.attachments.length === 0 ? <p style={emptyText}>No hay evidencia ni adjuntos disponibles.</p> : <div style={resourceList}>
            {initiative.evidence.map((item, index) => <article key={`${item.title}-${index}`} style={resource}><FileText size={17} /><div><strong>{item.title}</strong>{item.note && <span>{item.note}</span>}</div>{item.url && <a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir evidencia ${item.title}`} style={iconLink}><ExternalLink size={16} /></a>}</article>)}
            {initiative.attachments.map((item, index) => <article key={`${item.name}-${index}`} style={resource}><FileText size={17} /><div><strong>{item.name}</strong>{item.type && <span>{item.type}</span>}</div><a href={item.url} target="_blank" rel="noreferrer" aria-label={`Abrir adjunto ${item.name}`} style={iconLink}><ExternalLink size={16} /></a></article>)}
          </div>}
        </section>

        {!access.isExternal && <section style={panel}>
          <h2 style={sectionTitle}><History size={18} /> Historial de decisiones y etapas</h2>
          {history.length === 0 ? <p style={emptyText}>Todavía no se han registrado cambios de etapa.</p> : <ol style={timeline}>{history.map((entry) => <li key={entry.id} style={timelineItem}><span style={timelineDot} /><div><strong>{stageLabel(entry.fromStage)} <ArrowRight size={13} /> {stageLabel(entry.toStage)}</strong>{entry.decision && <span style={decisionLabel}>{entry.decision}</span>}<p>{entry.reason || 'Sin motivo registrado.'}</p><small>{entry.actorName || 'Sistema'} · {formatDate(entry.createdAt, true)}</small></div></li>)}</ol>}
        </section>}

        {!access.isExternal && <section style={panel}>
          <h2 style={sectionTitle}><History size={18} /> Trazabilidad de asignaciones</h2>
          {assignmentHistory.length === 0 ? <p style={emptyText}>No hay cambios de responsables registrados.</p> : <ol style={timeline}>{assignmentHistory.map((entry) => <li key={entry.id} style={timelineItem}><span style={timelineDot} /><div><strong>{entry.action === 'ASSIGNED' ? 'Asignación' : entry.action === 'REVOKED' ? 'Revocación' : 'Remoción'} · {roleLabels[entry.role] || entry.role}</strong><p>{entry.subjectName || 'Participante'}{entry.reason ? ` · ${entry.reason}` : ''}</p><small>{entry.actorName || 'Sistema'} · {formatDate(entry.createdAt, true)}</small></div></li>)}</ol>}
        </section>}
      </div>

      <aside style={sidebar}>
        <section style={panel}>
          <h2 style={sectionTitle}><Users size={18} /> Participantes</h2>
          {access.isExternal ? <p style={emptyText}>Los participantes internos no se comparten mediante este acceso.</p> : participants.length === 0 ? <p style={emptyText}>Sin participantes asignados.</p> : <div style={people}>{participants.map((participant) => <div key={participant.id} style={person}><div style={avatar}>{participant.user.name.slice(0, 1).toUpperCase()}</div><div><strong>{participant.user.name}</strong><span>{roleLabels[participant.role] || participant.role}</span></div>{access.canManage && participant.role !== 'REQUESTER' && <button type="button" onClick={() => void removePerson(participant.user.id, participant.user.name)} style={removeButton} disabled={actionBusy} aria-label={`Remover a ${participant.user.name}`}><UserMinus size={15} /></button>}</div>)}</div>}
          {access.canManage && <form onSubmit={submitParticipant} style={assignmentForm}>
            <label style={formLabel}>Asignar persona del espacio
              <select value={participantUserId} onChange={(event) => setParticipantUserId(event.target.value)} style={input} disabled={actionBusy} required>
                <option value="">Selecciona una persona</option>
                {workspaceMembers.map((member) => <option key={member.userId} value={member.userId}>{member.user?.name || member.userId}</option>)}
              </select>
            </label>
            <label style={formLabel}>Rol operativo
              <select value={participantRole} onChange={(event) => setParticipantRole(event.target.value as (typeof assignableRoles)[number])} style={input} disabled={actionBusy}>
                {assignableRoles.map((role) => <option key={role} value={role}>{roleLabels[role]}</option>)}
              </select>
            </label>
            <button type="submit" style={secondaryButton} disabled={actionBusy}><UserPlus size={15} /> Asignar</button>
          </form>}
        </section>

        <section style={panel}>
          <h2 style={sectionTitle}>Trazabilidad</h2>
          <dl style={metadata}><div><dt>Recibida</dt><dd>{formatDate(initiative.receivedAt)}</dd></div><div><dt>Prioridad</dt><dd>{initiative.priority}</dd></div><div><dt>Solicitante</dt><dd>{initiative.requester?.name || (access.isExternal ? 'No disponible' : 'Interno')}</dd></div><div><dt>Responsable de triage</dt><dd>{initiative.triageOwner?.name || 'Por asignar'}</dd></div><div><dt>Mentoría</dt><dd>{initiative.mentor?.name || 'Sin mentor asignado'}</dd></div></dl>
        </section>

        {initiative.formalizedProjectId && <section style={{ ...panel, ...successPanel }}><CheckCircle2 size={19} /><div><strong>Proyecto formalizado</strong><p>La propuesta ya pasó a ejecución con trazabilidad conservada.</p><Link href={`/dashboard/projects/${initiative.formalizedProjectId}`} style={secondaryButton}>Abrir proyecto <ArrowRight size={15} /></Link></div></section>}
      </aside>
    </div>
  </main>;
}

const page: CSSProperties = { minHeight: '100%', padding: '36px clamp(20px, 4vw, 64px)', color: '#f8fafc', background: '#12172a', fontFamily: "'Manrope', system-ui, sans-serif" };
const backLink: CSSProperties = { display: 'inline-flex', gap: 7, alignItems: 'center', color: '#aeb8cb', fontWeight: 700, textDecoration: 'none', fontSize: 14, marginBottom: 24 };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 22, flexWrap: 'wrap' };
const eyebrow: CSSProperties = { margin: 0, color: '#f97316', fontWeight: 800, letterSpacing: '.1em', fontSize: 11 };
const titleRow: CSSProperties = { display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' };
const title: CSSProperties = { margin: '5px 0 8px', fontSize: 'clamp(29px, 4vw, 44px)', lineHeight: 1.05, letterSpacing: '-.045em' };
const subtitle: CSSProperties = { margin: 0, lineHeight: 1.6, color: '#aeb8cb', maxWidth: 700 };
const stagePill: CSSProperties = { display: 'inline-block', border: '1px solid #4c668d', borderRadius: 99, background: '#1b2942', color: '#bfdbfe', padding: '5px 10px', fontSize: 12, fontWeight: 800 };
const reviewCard: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', padding: '12px 14px', border: '1px solid #313e5c', borderRadius: 10, background: '#192038', minWidth: 210, color: '#f6b18d' };
const muted: CSSProperties = { display: 'block', color: '#9aa7bd', fontSize: 11, marginBottom: 3 };
const permissionBanner: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, border: '1px solid #325765', background: '#142a31', color: '#bde7e0', borderRadius: 10, padding: '12px 14px', marginBottom: 20, lineHeight: 1.45 };
const layout: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(270px, 340px)', gap: 18, alignItems: 'start' };
const mainColumn: CSSProperties = { display: 'grid', gap: 18 };
const sidebar: CSSProperties = { display: 'grid', gap: 18 };
const panel: CSSProperties = { border: '1px solid #2d3853', borderRadius: 12, padding: 18, background: '#181e33' };
const sectionTitle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, margin: '0 0 16px', fontSize: 16, color: '#f1f5f9' };
const contentBlock: CSSProperties = { borderTop: '1px solid #29334b', padding: '13px 0 0', marginTop: 13, lineHeight: 1.58, color: '#c8d1df' };
const label: CSSProperties = { display: 'block', color: '#8390a8', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' };
const decisionStyle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start', marginTop: 18, padding: 13, borderRadius: 9, border: '1px solid #31563e', background: '#172b25', color: '#bde7c8' };
const resourceList: CSSProperties = { display: 'grid', gap: 8 };
const resource: CSSProperties = { display: 'flex', alignItems: 'center', gap: 10, padding: 11, border: '1px solid #2c3851', borderRadius: 9, color: '#9db4d2' };
const iconLink: CSSProperties = { color: '#f7ae86', marginLeft: 'auto', display: 'inline-flex' };
const emptyText: CSSProperties = { margin: 0, color: '#91a0b7', lineHeight: 1.5, fontSize: 14 };
const timeline: CSSProperties = { display: 'grid', gap: 15, margin: 0, padding: 0, listStyle: 'none' };
const timelineItem: CSSProperties = { position: 'relative', paddingLeft: 20, color: '#ccd4e2', lineHeight: 1.45 };
const timelineDot: CSSProperties = { position: 'absolute', left: 0, top: 5, width: 9, height: 9, borderRadius: '50%', background: '#f97316', boxShadow: '0 0 0 3px rgba(249,115,22,.15)' };
const decisionLabel: CSSProperties = { display: 'inline-block', marginLeft: 8, color: '#bce3bf', border: '1px solid #386244', borderRadius: 99, padding: '1px 7px', fontSize: 10, fontWeight: 800 };
const people: CSSProperties = { display: 'grid', gap: 11 };
const person: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, color: '#d9e0eb' };
const avatar: CSSProperties = { display: 'grid', placeItems: 'center', width: 30, height: 30, flex: '0 0 30px', borderRadius: '50%', color: '#e9d5ff', background: '#55436c', fontWeight: 800, fontSize: 13 };
const metadata: CSSProperties = { display: 'grid', gap: 12, margin: 0 };
const successPanel: CSSProperties = { display: 'flex', gap: 11, background: '#172c25', borderColor: '#31583e', color: '#c8eed2' };
const secondaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 7, width: 'fit-content', marginTop: 10, border: '1px solid #3b4a67', borderRadius: 8, background: '#202943', color: '#e5e7eb', padding: '9px 11px', fontWeight: 700, fontSize: 13, textDecoration: 'none' };
const state: CSSProperties = { minHeight: '55vh', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, textAlign: 'center', color: '#b6c1d3' };
const manageForm: CSSProperties = { display: 'grid', gap: 12 };
const assignmentForm: CSSProperties = { display: 'grid', gap: 10, marginTop: 16, paddingTop: 15, borderTop: '1px solid #2c3851' };
const formLabel: CSSProperties = { display: 'grid', gap: 6, color: '#b9c4d7', fontSize: 12, fontWeight: 750 };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid #3b4865', borderRadius: 8, background: '#11172a', color: '#f8fafc', padding: '10px 11px', font: 'inherit' };
const textarea: CSSProperties = { ...input, minHeight: 82, resize: 'vertical' };
const primaryButton: CSSProperties = { display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 7, border: 0, borderRadius: 8, background: '#f2571e', color: '#1d1420', padding: '10px 13px', fontWeight: 850, cursor: 'pointer' };
const successButton: CSSProperties = { ...primaryButton, background: '#54a66a', color: '#0d2113', whiteSpace: 'nowrap' };
const formalizeBox: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, borderTop: '1px solid #2c3851', marginTop: 18, paddingTop: 16, color: '#cbd6df' };
const actionErrorStyle: CSSProperties = { margin: '0 0 14px', padding: '9px 11px', border: '1px solid #7b3b45', borderRadius: 8, background: '#331e27', color: '#fecaca', lineHeight: 1.45, fontSize: 13 };
const removeButton: CSSProperties = { display: 'inline-grid', placeItems: 'center', marginLeft: 'auto', border: '1px solid #603847', borderRadius: 7, background: '#2c1c27', color: '#fca5a5', padding: 6, cursor: 'pointer' };
const criteriaList: CSSProperties = { display: 'grid', gap: 10, marginTop: 15 };
const criterionCard: CSSProperties = { display: 'grid', gap: 10, padding: 13, border: '1px solid #303b56', borderRadius: 9, background: '#151b2e', color: '#dce4ef', lineHeight: 1.4 };
const criteriaNote: CSSProperties = { ...textarea, minHeight: 58 };
const criteriaReadOnly: CSSProperties = { display: 'grid', gap: 8, color: '#b9c4d6', fontSize: 13 };
const editFormStyle: CSSProperties = { display: 'grid', gap: 13, margin: '16px 0', padding: 15, border: '1px solid #354766', borderRadius: 10, background: '#141b30' };
const subsectionTitle: CSSProperties = { margin: 0, color: '#e6edf8', fontSize: 14 };
const twoColumns: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 };
const editResourceSection: CSSProperties = { display: 'grid', gap: 9, borderTop: '1px solid #2c3851', paddingTop: 13 };
const editResourceHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 };
const resourceHeading: CSSProperties = { margin: 0, color: '#ccd6e6', fontSize: 13 };
const resourceEditor: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 8, alignItems: 'start' };
const compactTextarea: CSSProperties = { ...input, minHeight: 40, resize: 'vertical' };
const textButton: CSSProperties = { border: 0, background: 'transparent', color: '#f8af85', padding: 0, font: 'inherit', fontSize: 12, fontWeight: 750, cursor: 'pointer' };
const removeTextButton: CSSProperties = { ...textButton, color: '#fca5a5', padding: '9px 4px' };
const editActions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10 };
