'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDownUp, ArrowRight, Building2, CalendarClock, Check, ChevronDown, CircleAlert, ClipboardCheck, Clock3, FileSearch, FolderKanban, ListFilter, Plus, RefreshCw, Search, Settings2, ShieldCheck, UserRound, X } from 'lucide-react';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { Initiative, InitiativeIntakeInfo, InitiativeStage, normalizeInitiativeIntake, useInitiativeStore } from '@/stores/initiativeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import styles from './page.module.css';

const stageOptions: Array<{ value: InitiativeStage; label: string }> = [
  { value: 'SUBMITTED', label: 'Recibidas' },
  { value: 'TRIAGE', label: 'Triage' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico' },
  { value: 'VALIDATION', label: 'Validación' },
  { value: 'APPROVED', label: 'Aprobadas' },
  { value: 'PAUSED', label: 'En pausa' },
  { value: 'DECLINED', label: 'No continúan' },
  { value: 'ARCHIVED', label: 'Archivadas' },
];

const stageLabels = Object.fromEntries(stageOptions.map(({ value, label }) => [value, label])) as Record<InitiativeStage, string>;
const priorityLabels: Record<Initiative['priority'], string> = { URGENT: 'Urgente', HIGH: 'Alta', MEDIUM: 'Media', LOW: 'Baja' };
const priorityRank: Record<Initiative['priority'], number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
const activeQueueStages: InitiativeStage[] = ['SUBMITTED', 'TRIAGE', 'DIAGNOSIS', 'VALIDATION', 'APPROVED', 'PAUSED'];

type QueueFilter = 'QUEUE' | 'ALL' | InitiativeStage;
type QuickFilter = 'ALL' | 'OVERDUE' | 'UNASSIGNED';

function isOverdue(initiative: Initiative, now: number) {
  return Boolean(initiative.nextReviewAt && new Date(initiative.nextReviewAt).getTime() < now && !['DECLINED', 'ARCHIVED'].includes(initiative.stage));
}

function dateLabel(value?: string | null, timeZone = 'America/Santiago') {
  if (!value) return 'Sin fecha de revisión';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha por confirmar';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', timeZone }).format(date);
}

function nextAction(initiative: Initiative) {
  if (!initiative.triageOwner && !['DECLINED', 'ARCHIVED', 'APPROVED'].includes(initiative.stage)) return 'Asignar coordinación';
  switch (initiative.stage) {
    case 'SUBMITTED': return 'Revisar y clasificar';
    case 'TRIAGE': return 'Completar el filtro inicial';
    case 'DIAGNOSIS': return 'Acompañar la maduración';
    case 'VALIDATION': return 'Evaluar criterios y decidir';
    case 'APPROVED': return initiative.formalizedProjectId ? 'Abrir proyecto formalizado' : 'Formalizar como proyecto';
    case 'PAUSED': return 'Revisar cuándo retomar';
    case 'DECLINED': return 'Consultar la decisión registrada';
    case 'ARCHIVED': return 'Consultar el historial';
  }
}

function emptyIntake(message: string): InitiativeIntakeInfo {
  return {
    enabled: false,
    reason: message,
    requesterLabel: 'Solicitante',
    openInitiativesCount: 0,
    maxOpenInitiatives: 0,
    limitReached: false,
    isReviewer: false,
    requesterRules: { canSubmit: false, canEditAfterSubmission: false, canAttach: false, canInviteCollaborators: false, canWithdraw: false, decisionVisibility: 'STATUS', isDefaultWorkspace: false, hasDefaultWorkspace: false },
    governanceRules: { mentorRequiredForValidation: false, separateApproverFromRequester: false, coordinatorCanApprove: false, leadRequiredForConversion: false },
    privacyRules: { allowExternalInitiativeAccess: false },
    communicationRules: { notifyOnSubmission: false, notifyOnDecision: false },
    businessDays: [1, 2, 3, 4, 5],
    timezone: 'America/Santiago',
    triageCriteria: [],
    reviewCadenceDays: 7,
  };
}

export default function InitiativesPage() {
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const initiatives = useInitiativeStore((state) => state.initiatives);
  const loading = useInitiativeStore((state) => state.loading);
  const loadingMore = useInitiativeStore((state) => state.loadingMore);
  const nextCursor = useInitiativeStore((state) => state.nextCursor);
  const error = useInitiativeStore((state) => state.error);
  const fetchInitiatives = useInitiativeStore((state) => state.fetchInitiatives);
  const fetchMoreInitiatives = useInitiativeStore((state) => state.fetchMoreInitiatives);
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('QUEUE');
  const [quickFilter, setQuickFilter] = useState<QuickFilter>('ALL');
  const [search, setSearch] = useState('');
  const [intake, setIntake] = useState<InitiativeIntakeInfo | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const isInstitutional = activeWorkspace?.organization?.type === 'INSTITUTION';

  useEffect(() => { if (!workspaces.length) void fetchWorkspaces(); }, [fetchWorkspaces, workspaces.length]);
  useEffect(() => {
    setQueueFilter('QUEUE');
    setQuickFilter('ALL');
    setSearch('');
    if (activeWorkspaceId && isInstitutional) void fetchInitiatives(activeWorkspaceId);
  }, [activeWorkspaceId, fetchInitiatives, isInstitutional]);
  useEffect(() => {
    if (!activeWorkspaceId || !isInstitutional) { setIntake(null); return; }
    let active = true;
    setIntake(null);
    void apiService.get<InitiativeIntakeInfo>(`/api/initiatives/intake/${activeWorkspaceId}`, true).then((response) => {
      if (!active) return;
      setIntake(response.success && response.data
        ? normalizeInitiativeIntake(response.data)
        : emptyIntake(response.error?.message ?? 'No se pudo comprobar la recepción.'));
    });
    return () => { active = false; };
  }, [activeWorkspaceId, isInstitutional]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const overdueCount = initiatives.filter((initiative) => isOverdue(initiative, now)).length;
  const unassignedCount = initiatives.filter((initiative) => !initiative.triageOwner && !['DECLINED', 'ARCHIVED', 'APPROVED'].includes(initiative.stage)).length;

  const visible = useMemo(() => {
    const query = search.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
    return initiatives
      .filter((initiative) => queueFilter === 'QUEUE'
        ? activeQueueStages.includes(initiative.stage)
        : queueFilter === 'ALL' || initiative.stage === queueFilter)
      .filter((initiative) => quickFilter === 'OVERDUE'
        ? isOverdue(initiative, now)
        : quickFilter === 'UNASSIGNED'
          ? !initiative.triageOwner && !['DECLINED', 'ARCHIVED', 'APPROVED'].includes(initiative.stage)
          : true)
      .filter((initiative) => !query || [
        initiative.title,
        initiative.problemStatement,
        initiative.description,
        initiative.requester?.name,
        initiative.requester?.email,
        initiative.triageOwner?.name,
        initiative.mentor?.name,
        stageLabels[initiative.stage],
      ].some((value) => value?.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').includes(query)))
      .sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority]
        || (a.nextReviewAt ? new Date(a.nextReviewAt).getTime() : Number.POSITIVE_INFINITY) - (b.nextReviewAt ? new Date(b.nextReviewAt).getTime() : Number.POSITIVE_INFINITY)
        || new Date(b.createdAt ?? b.receivedAt).getTime() - new Date(a.createdAt ?? a.receivedAt).getTime());
  }, [initiatives, now, queueFilter, quickFilter, search]);

  if (!activeWorkspaceId || !activeWorkspace) {
    return <main className={styles.page}><section className={styles.statePanel} role="status"><RefreshCw size={21} className="animate-spin" /><h1>{activeWorkspaceId ? 'Cargando espacio de trabajo' : 'Selecciona un espacio institucional'}</h1><p>Las iniciativas se reciben y revisan dentro de un espacio institucional.</p></section></main>;
  }

  if (!isInstitutional) {
    return <main className={styles.page}><section className={styles.statePanel}><FolderKanban size={27} /><h1>Las iniciativas están disponibles en organizaciones institucionales</h1><p>En organizaciones personales o de equipo, el trabajo comienza directamente como proyecto.</p><Link href="/dashboard/projects" className={styles.secondaryButton}><FolderKanban size={15} /> Ir a proyectos</Link></section></main>;
  }

  const hasActiveFilters = search.trim().length > 0 || quickFilter !== 'ALL';
  const heading = intake?.isReviewer ? 'Bandeja de revisión' : 'Mis iniciativas';

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.pageHeader}>
          <div className={styles.headingGroup}>
            <div className={styles.contextLine}><span className={styles.contextIcon}><Building2 size={15} /></span><span>{activeWorkspace.organization?.name ?? 'Organización institucional'}</span><span className={styles.contextDivider}>/</span><span>{activeWorkspace.name}</span></div>
            <h1>Iniciativas</h1>
            <p>{intake?.isReviewer ? 'Revisa propuestas, registra decisiones y acompaña su maduración antes de formalizarlas.' : 'Consulta el avance de tus propuestas y las acciones pendientes en cada etapa.'}</p>
          </div>
          <div className={styles.headerActions}>
            <Link href="/dashboard/projects" className={styles.secondaryButton}><FolderKanban size={16} /> <span>Proyectos</span></Link>
            {intake?.isReviewer && <>
              <Link href="/dashboard/initiatives/reports" className={styles.secondaryButton}>Reportes</Link>
              <Link href={`/dashboard/organizations?organizationId=${encodeURIComponent(activeWorkspace.organizationId)}&view=settings`} className={styles.secondaryButton}><Settings2 size={15} /> Reglas</Link>
            </>}
            <Link href="/dashboard/initiatives/new" aria-disabled={!intake?.enabled} tabIndex={intake?.enabled ? undefined : -1} title={intake?.reason ?? undefined} onClick={(event) => { if (!intake?.enabled) event.preventDefault(); }} className={`${styles.primaryButton} ${!intake?.enabled ? styles.disabledButton : ''}`}><Plus size={17} /> Nueva iniciativa</Link>
          </div>
        </header>

        <section className={`${styles.intakeBanner} ${intake?.enabled ? styles.intakeOpen : styles.intakeClosed}`} aria-live="polite">
          <div className={styles.intakeStatusIcon}>{intake?.enabled ? <Check size={17} /> : <CircleAlert size={17} />}</div>
          <div className={styles.intakeMessage}>
            <strong>{intake?.enabled ? 'Recepción abierta' : intake?.limitReached ? 'Límite personal alcanzado' : intake ? 'Recepción pausada' : 'Comprobando recepción'}</strong>
            <span>{intake?.enabled ? `Las personas con perfil «${intake.requesterLabel}» pueden presentar propuestas en este espacio.` : intake?.reason ?? 'Consultando las reglas de esta organización.'}</span>
          </div>
          <Link href="/dashboard/initiatives/settings" className={styles.bannerLink}>Configuración del espacio <ArrowRight size={14} /></Link>
        </section>

        <div className={styles.contentGrid}>
          <section className={styles.queuePanel} aria-labelledby="queue-heading">
            <div className={styles.queueHeader}>
              <div>
                <h2 id="queue-heading">{heading}</h2>
                <p>{intake?.isReviewer ? 'Ordenada por prioridad y próxima revisión.' : 'Cada propuesta conserva su evaluación y seguimiento.'}</p>
              </div>
              <span className={styles.resultCount}>{visible.length} {visible.length === 1 ? 'resultado visible' : 'resultados visibles'}</span>
            </div>

            {intake?.isReviewer && <div className={styles.attentionStrip} aria-label="Pendientes de atención">
              <button type="button" onClick={() => { setQueueFilter('QUEUE'); setQuickFilter(quickFilter === 'OVERDUE' ? 'ALL' : 'OVERDUE'); }} className={`${styles.attentionItem} ${quickFilter === 'OVERDUE' ? styles.attentionSelected : ''}`} aria-label={`${overdueCount} revisiones vencidas entre las iniciativas cargadas`}><Clock3 size={15} /><span>Vencidas cargadas</span><b>{overdueCount}</b></button>
              <span className={styles.attentionSeparator} />
              <button type="button" onClick={() => { setQueueFilter('QUEUE'); setQuickFilter(quickFilter === 'UNASSIGNED' ? 'ALL' : 'UNASSIGNED'); }} className={`${styles.attentionItem} ${quickFilter === 'UNASSIGNED' ? styles.attentionSelected : ''}`} aria-label={`${unassignedCount} iniciativas sin responsable entre las iniciativas cargadas`}><UserRound size={15} /><span>Sin responsable</span><b>{unassignedCount}</b></button>
              <div className={styles.sortHint}><ArrowDownUp size={14} /> Prioridad y fecha</div>
            </div>}

            <div className={styles.queueControls}>
              <label className={styles.searchBox}>
                <Search size={17} aria-hidden="true" />
                <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar por iniciativa, persona o correo" aria-label="Buscar iniciativas por nombre, persona o correo" />
                {search && <button type="button" onClick={() => setSearch('')} aria-label="Limpiar búsqueda"><X size={13} /></button>}
              </label>
              <label className={styles.stageSelectLabel}>
                <ListFilter size={15} aria-hidden="true" />
                <span className={styles.visuallyHidden}>Filtrar por etapa</span>
                <select value={queueFilter} onChange={(event) => { setQueueFilter(event.target.value as QueueFilter); setQuickFilter('ALL'); }} aria-label="Filtrar iniciativas por etapa">
                  <option value="QUEUE">En curso</option>
                  <option value="ALL">Todas las etapas</option>
                  {stageOptions.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
                </select>
                <ChevronDown size={14} aria-hidden="true" />
              </label>
            </div>

            {error && <p role="alert" className={styles.errorBanner}>{error}</p>}

            <div className={styles.tableWrap}>
              <table className={styles.queueTable}>
                <thead><tr><th scope="col">Iniciativa</th><th scope="col">Etapa</th><th scope="col">Responsable</th><th scope="col">Próxima revisión</th><th scope="col"><span className={styles.visuallyHidden}>Abrir</span></th></tr></thead>
                <tbody>
                  {loading ? <tr><td colSpan={5}><div className={styles.tableState}><RefreshCw size={18} className="animate-spin" /> Cargando iniciativas…</div></td></tr> : visible.length === 0 ? <tr><td colSpan={5}><div className={styles.tableState}><FileSearch size={21} /><strong>{initiatives.length ? 'No hay coincidencias en esta vista' : 'Aún no hay iniciativas'}</strong><span>{initiatives.length ? 'Prueba con otra búsqueda o etapa.' : intake?.enabled ? 'Cuando se reciba una propuesta, aparecerá aquí para iniciar su evaluación.' : 'Las propuestas registradas aparecerán aquí cuando estén disponibles.'}</span>{initiatives.length > 0 && hasActiveFilters && <button type="button" className={styles.textButton} onClick={() => { setSearch(''); setQuickFilter('ALL'); setQueueFilter('ALL'); }}>Limpiar filtros</button>}</div></td></tr> : visible.map((initiative) => {
                    const overdue = isOverdue(initiative, now);
                    return <tr key={initiative.id} className={overdue ? styles.overdueRow : undefined}>
                      <td className={styles.initiativeCell}>
                        <Link href={`/dashboard/initiatives/${initiative.id}`} className={styles.initiativeLink}>
                          <span className={styles.initiativeTitle}>{initiative.title}</span>
                          <span className={styles.initiativeMeta}><span>{initiative.requester?.name ?? intake?.requesterLabel ?? 'Persona solicitante'}</span><span className={styles.metaDot} /> <span>{nextAction(initiative)}</span></span>
                        </Link>
                      </td>
                      <td><span className={`${styles.stagePill} ${styles[`stage_${initiative.stage}`]}`}>{stageLabels[initiative.stage]}</span><span className={`${styles.priorityPill} ${styles[`priority_${initiative.priority}`]}`}>{priorityLabels[initiative.priority]}</span></td>
                      <td><span className={styles.ownerName}>{initiative.triageOwner?.name ?? 'Sin asignar'}</span>{initiative.mentor && <span className={styles.ownerMeta}>Mentoría — {initiative.mentor.name}</span>}</td>
                      <td><span className={`${styles.reviewDate} ${overdue ? styles.reviewOverdue : ''}`}>{overdue && <CircleAlert size={13} />}{dateLabel(initiative.nextReviewAt, intake?.timezone)}</span>{overdue && <span className={styles.overdueHint}>Requiere atención</span>}</td>
                      <td className={styles.openCell}><Link href={`/dashboard/initiatives/${initiative.id}`} aria-label={`Abrir iniciativa ${initiative.title}`} className={styles.openLink}><ArrowRight size={17} /></Link></td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>
            <footer className={styles.queueFooter}>
              <span>Mostrando {visible.length} de {initiatives.length} iniciativas cargadas{nextCursor ? ' — hay más resultados' : ''}</span>
              {nextCursor && <button type="button" onClick={() => activeWorkspaceId && void fetchMoreInitiatives(activeWorkspaceId)} disabled={loadingMore} className={styles.loadMoreButton}>{loadingMore ? <><RefreshCw size={14} className="animate-spin" /> Cargando…</> : <>Cargar más <ChevronDown size={14} /></>}</button>}
            </footer>
          </section>

          <aside className={styles.rulesPanel} aria-labelledby="rules-heading">
            <header className={styles.rulesHeader}><span className={styles.rulesIcon}><ShieldCheck size={17} /></span><div><h2 id="rules-heading">Reglas de esta organización</h2><p>Se aplican a las propuestas de este espacio.</p></div></header>
            {!intake ? <div className={styles.rulesLoading}><RefreshCw size={16} className="animate-spin" /> Cargando reglas…</div> : <>
              <section className={styles.ruleSection}>
                <h3>Recepción</h3>
                <ul className={styles.ruleList}>
                  <li><span>Presentación de iniciativas</span><b>{intake.requesterRules.canSubmit ? 'Permitida' : 'Desactivada'}</b></li>
                  <li><span>Perfil de presentación</span><b>{intake.requesterLabel}</b></li>
                  <li><span>Espacio predeterminado de recepción</span><b>{intake.requesterRules.isDefaultWorkspace ? 'Este espacio' : intake.requesterRules.hasDefaultWorkspace ? 'Otro espacio' : 'Sin definir'}</b></li>
                  <li><span>Iniciativas abiertas por persona</span><b>{intake.maxOpenInitiatives > 0 ? `${intake.maxOpenInitiatives} máximo` : 'Sin límite'}</b></li>
                  <li><span>Edición después del envío</span><b>{intake.requesterRules.canEditAfterSubmission ? 'Permitida' : 'Cerrada'}</b></li>
                  <li><span>Adjuntar evidencia</span><b>{intake.requesterRules.canAttach ? 'Permitido' : 'No permitido'}</b></li>
                  <li><span>Invitar colaboradores</span><b>{intake.requesterRules.canInviteCollaborators ? 'Permitido' : 'No permitido'}</b></li>
                  <li><span>Retirar una propuesta</span><b>{intake.requesterRules.canWithdraw ? 'Permitido' : 'No permitido'}</b></li>
                </ul>
              </section>
              <section className={styles.ruleSection}>
                <h3>Gobierno y evaluación</h3>
                <ul className={styles.ruleList}>
                  <li><span>Mentoría para validar</span><b>{intake.governanceRules.mentorRequiredForValidation ? 'Requerida' : 'Opcional'}</b></li>
                  <li><span>Quien presenta puede decidir</span><b>{intake.governanceRules.separateApproverFromRequester ? 'No' : 'Según permisos'}</b></li>
                  <li><span>Coordinación puede aprobar</span><b>{intake.governanceRules.coordinatorCanApprove ? 'Sí' : 'Solo administración'}</b></li>
                  <li><span>Líder antes de formalizar</span><b>{intake.governanceRules.leadRequiredForConversion ? 'Requerido' : 'No requerido'}</b></li>
                  <li><span>Motivo de decisión</span><b>{intake.requesterRules.decisionVisibility === 'REASON' ? 'Visible' : 'Solo estado'}</b></li>
                </ul>
              </section>
              <section className={styles.ruleSection}>
                <h3>Ritmo de revisión</h3>
                <p className={styles.cadence}><CalendarClock size={15} /> Revisión programada cada <strong>{intake.reviewCadenceDays} {intake.reviewCadenceDays === 1 ? 'día hábil' : 'días hábiles'}</strong>.</p>
                <p className={styles.calendarDays}>Calendario: {intake.businessDays.map((day) => ['dom.', 'lun.', 'mar.', 'mié.', 'jue.', 'vie.', 'sáb.'][day]).join(' — ')} — {intake.timezone}</p>
                {intake.triageCriteria.length > 0 ? <details className={styles.criteriaDisclosure}>
                  <summary><ClipboardCheck size={15} /> {intake.triageCriteria.length} criterios de triage <ChevronDown size={14} /></summary>
                  <ol>{intake.triageCriteria.map((criterion, index) => <li key={`${criterion}-${index}`}>{criterion}</li>)}</ol>
                </details> : <p className={styles.noCriteria}>No hay criterios de triage personalizados.</p>}
              </section>
              <section className={styles.ruleSection}>
                <h3>Transparencia y avisos</h3>
                <ul className={styles.ruleList}>
                  <li><span>Notificar al recibir</span><b>{intake.communicationRules.notifyOnSubmission ? 'Activado' : 'Desactivado'}</b></li>
                  <li><span>Notificar una decisión</span><b>{intake.communicationRules.notifyOnDecision ? 'Activado' : 'Desactivado'}</b></li>
                  <li><span>Acceso externo a iniciativas</span><b>{intake.privacyRules.allowExternalInitiativeAccess ? 'Permitido por invitación' : 'Desactivado'}</b></li>
                </ul>
              </section>
              {intake.isReviewer && <Link href={`/dashboard/organizations?organizationId=${encodeURIComponent(activeWorkspace.organizationId)}&view=settings`} className={styles.rulesLink}>Ver configuración institucional <ArrowRight size={14} /></Link>}
            </>}
          </aside>
        </div>
      </div>
    </main>
  );
}
