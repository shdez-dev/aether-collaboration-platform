'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, FolderKanban, GitBranch, Plus, RotateCcw, X } from 'lucide-react';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { ProjectCreationFields, EMPTY_PROJECT_CREATION_ANSWERS, type ProjectCreationAnswers, type ProjectCreationFieldErrors } from '@/components/ProjectCreationFields';
import { ProjectMethodologyStep, type ProjectParticipant, type ProjectTeamOption } from '@/components/ProjectMethodologyStep';
import { useT } from '@/lib/i18n';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { canManageOrganizationRole, supportsOrganizationProjectPlanning, supportsOrganizationTeams } from '@/lib/workspaceFeatures';
import { markStepDone } from '@/lib/utils/onboardingGuide';
import { clearProjectCreationDraft, PROJECT_CREATION_DRAFT_MAX_AGE, readProjectCreationDraft, saveProjectCreationDraft } from '@/lib/projectCreationDraft';

const PROJECT_COLOR = '#7452A6';
const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";
const PROJECT_SETUP_STEPS = [
  { title: 'Contexto', description: 'Aclara qué problema u oportunidad da origen al proyecto.' },
  { title: 'Objetivo y alcance', description: 'Define el cambio esperado y los límites del proyecto.' },
] as const;
const STEPS = [...PROJECT_SETUP_STEPS, { title: 'Personas y condiciones', description: 'Define quién participa y qué condiciones debe considerar.' }] as const;
const PERSONAL_STEPS = [...PROJECT_SETUP_STEPS, { title: 'Condiciones', description: 'Registra fechas o límites importantes para el proyecto.' }] as const;

function suggestCardPrefix(projectName: string) {
  const words = projectName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().match(/[A-Z0-9]+/g) ?? [];
  if (!words.length) return 'PRO';
  if (words.length === 1) return words[0].length >= 3 ? words[0].slice(0, 3) : 'PRO';
  const initials = words.slice(0, 3).map((word) => word[0]).join('');
  if (initials.length === 3) return initials;
  const suggestion = `${initials}${words.map((word) => word.slice(1)).join('')}`.slice(0, 3);
  return suggestion.length === 3 ? suggestion : 'PRO';
}

function validateProjectTitle(value: string) {
  const title = value.trim();
  if (!title) return 'Escribe un nombre para el proyecto.';
  if (title.length < 3) return 'Usa al menos 3 caracteres para identificarlo con claridad.';
  return '';
}

function validateProjectObjective(value: string) {
  const objective = value.trim();
  if (!objective) return 'Describe el resultado que debería lograr el proyecto.';
  if (objective.length < 2) return 'Añade un poco más de detalle al objetivo.';
  return '';
}

function validateProjectContext(value: string) {
  const context = value.trim();
  if (!context) return 'Describe el problema u oportunidad que da origen al proyecto.';
  if (context.length < 10) return 'Añade un poco más de contexto para entender la necesidad.';
  return '';
}

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
  defaultWorkspaceId?: string;
}

export default function CreateProjectModal({ onClose, onCreated, defaultWorkspaceId }: CreateProjectModalProps) {
  const t = useT();
  const createProject = useProjectStore((state) => state.createProject);
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id ?? '';
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === defaultWorkspaceId && !workspace.archived);
  const selectedWorkspace = activeWorkspace?.organization?.type === 'INSTITUTION' ? undefined : activeWorkspace;
  const selectedWorkspaceId = selectedWorkspace?.id ?? '';
  const canCreateProject = canManageOrganizationRole(selectedWorkspace?.organization?.role);
  const canConfigureMethodology = supportsOrganizationProjectPlanning(selectedWorkspace);
  const canSelectTeams = supportsOrganizationTeams(selectedWorkspace);
  const projectSteps = canConfigureMethodology ? STEPS : PERSONAL_STEPS;

  const [answers, setAnswers] = useState<ProjectCreationAnswers>(EMPTY_PROJECT_CREATION_ANSWERS);
  const [customCardPrefix, setCustomCardPrefix] = useState<string | null>(null);
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [methodology, setMethodology] = useState<'FLEXIBLE' | 'SCRUM'>('FLEXIBLE');
  const [advancedTraceability, setAdvancedTraceability] = useState(false);
  const [teams, setTeams] = useState<ProjectTeamOption[]>([]);
  const [members, setMembers] = useState<ProjectParticipant[]>([]);
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [memberIds, setMemberIds] = useState<string[]>([]);
  const [productOwnerId, setProductOwnerId] = useState('');
  const [scrumMasterId, setScrumMasterId] = useState('');
  const [participantsLoading, setParticipantsLoading] = useState(false);
  const [participantsError, setParticipantsError] = useState('');
  const [participantsRetry, setParticipantsRetry] = useState(0);
  const loadedWorkspaceId = useRef('');
  const contentRef = useRef<HTMLDivElement>(null);
  const draftRestored = useRef(false);
  const pendingDraft = useRef<ReturnType<typeof readProjectCreationDraft>>(null);
  const [resumingDraft, setResumingDraft] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<ProjectCreationFieldErrors>({});
  const [closing, setClosing] = useState(false);
  const suggestedPrefix = suggestCardPrefix(answers.title);
  const cardPrefix = customCardPrefix ?? suggestedPrefix;
  const validCardPrefix = /^[A-Z0-9]{3}$/.test(cardPrefix);
  useEffect(() => { void fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    if (draftRestored.current || !currentUserId || !selectedWorkspaceId) return;
    draftRestored.current = true;
    const draft = readProjectCreationDraft();
    if (!draft) return;
    if (draft.userId !== currentUserId || Date.now() - draft.savedAt > PROJECT_CREATION_DRAFT_MAX_AGE) {
      clearProjectCreationDraft();
      return;
    }
    if (draft.workspaceId !== selectedWorkspaceId) return;
    pendingDraft.current = draft;
    setAnswers(draft.answers);
    setCustomCardPrefix(draft.cardPrefixCustomized ? (draft.cardPrefix ?? '').slice(0, 3) : null);
    setMethodology(canConfigureMethodology ? draft.methodology : 'FLEXIBLE');
    setAdvancedTraceability(Boolean(draft.advancedTraceability));
    setResumingDraft(true);
    setStep(2);
  }, [canConfigureMethodology, currentUserId, selectedWorkspaceId]);

  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [step]);

  const isInstitutionalWorkspace = activeWorkspace?.organization?.type === 'INSTITUTION';
  const canSubmit = Boolean(canCreateProject && selectedWorkspace && answers.title.trim() && answers.objective.trim() && !isLoading);
  const participantIds = new Set([currentUserId, ...memberIds, ...teams.filter((team) => teamIds.includes(team.id)).flatMap((team) => team.members.map((person) => person.id))]);
  const scrumReady = methodology !== 'SCRUM' || Boolean(participantIds.size >= 3 && productOwnerId && scrumMasterId && productOwnerId !== scrumMasterId && participantIds.has(productOwnerId) && participantIds.has(scrumMasterId));
  const finalDisabled = !canSubmit || !validCardPrefix || participantsLoading || loadedWorkspaceId.current !== selectedWorkspaceId || Boolean(participantsError) || (canConfigureMethodology && !scrumReady);

  useEffect(() => {
    if (step !== 2 || !selectedWorkspaceId) return;
    if (loadedWorkspaceId.current === selectedWorkspaceId) return;
    setTeams([]); setMembers([]); setTeamIds([]); setMemberIds([]);
    setProductOwnerId(''); setScrumMasterId(''); setParticipantsError('');
    let active = true;
    setParticipantsLoading(true);
    void apiService.get<{ teams: ProjectTeamOption[]; members: ProjectParticipant[] }>(`/api/workspaces/${selectedWorkspaceId}/project-participants`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los participantes.');
        loadedWorkspaceId.current = selectedWorkspaceId;
        setTeams(response.data.teams);
        setMembers(response.data.members);
        if (pendingDraft.current?.workspaceId === selectedWorkspaceId) {
          const draft = pendingDraft.current;
          setTeamIds(draft.teamIds.filter((id) => response.data!.teams.some((team) => team.id === id)));
          setMemberIds(canConfigureMethodology ? draft.memberIds.filter((id) => response.data!.members.some((member) => member.id === id)) : []);
          setProductOwnerId(draft.productOwnerId);
          setScrumMasterId(draft.scrumMasterId);
          pendingDraft.current = null;
        }
      }).catch((cause) => { if (active) { loadedWorkspaceId.current = ''; setParticipantsError(cause instanceof Error ? cause.message : 'No se pudieron cargar los participantes.'); } })
      .finally(() => { if (active) setParticipantsLoading(false); });
    return () => { active = false; };
  }, [canConfigureMethodology, selectedWorkspaceId, step, participantsRetry]);

  const leaveForTeams = () => {
    saveProjectCreationDraft({
      savedAt: Date.now(), userId: currentUserId, workspaceId: selectedWorkspaceId,
      answers, cardPrefix, cardPrefixCustomized: customCardPrefix !== null,
      methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
      advancedTraceability,
      teamIds: canSelectTeams ? teamIds : [], memberIds: canConfigureMethodology ? memberIds : [], productOwnerId, scrumMasterId,
    });
    setResumingDraft(true);
    onClose();
  };

  const saveCurrentDraft = () => {
    if (!selectedWorkspaceId) return;
    const waitingDraft = pendingDraft.current?.workspaceId === selectedWorkspaceId ? pendingDraft.current : null;
    const participantsLoaded = loadedWorkspaceId.current === selectedWorkspaceId;
    saveProjectCreationDraft({
      savedAt: Date.now(), userId: currentUserId, workspaceId: selectedWorkspaceId,
      answers, cardPrefix, cardPrefixCustomized: customCardPrefix !== null,
      methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
      advancedTraceability,
      teamIds: canSelectTeams ? (participantsLoaded ? teamIds : waitingDraft?.teamIds ?? teamIds) : [],
      memberIds: canConfigureMethodology ? (participantsLoaded ? memberIds : waitingDraft?.memberIds ?? memberIds) : [],
      productOwnerId: participantsLoaded ? productOwnerId : waitingDraft?.productOwnerId ?? productOwnerId,
      scrumMasterId: participantsLoaded ? scrumMasterId : waitingDraft?.scrumMasterId ?? scrumMasterId,
    });
  };

  const handleClose = () => {
    if (isLoading || closing) return;
    if (resumingDraft) saveCurrentDraft();
    else if (selectedWorkspaceId) clearProjectCreationDraft(selectedWorkspaceId);
    setClosing(true);
    window.setTimeout(onClose, 180);
  };

  const updateAnswer = (key: keyof ProjectCreationAnswers, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      if (key === 'title' && current.title) return { ...current, title: validateProjectTitle(value) };
      if (key === 'context' && current.context) return { ...current, context: validateProjectContext(value) };
      if (key === 'objective' && current.objective) return { ...current, objective: validateProjectObjective(value) };
      return current;
    });
    if (error) setError('');
  };

  const goToStep = (nextStep: 0 | 1 | 2) => {
    setStepDirection(nextStep < step ? 'backward' : 'forward');
    setError('');
    setFieldErrors({});
    setStep(nextStep);
  };

  const focusInvalidField = (id: string) => {
    window.requestAnimationFrame(() => {
      const field = document.getElementById(id);
      if (!field) return;
      const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      field.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'center' });
      field.focus({ preventScroll: true });
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 2) {
      if (step === 0) {
        const titleError = validateProjectTitle(answers.title);
        const contextError = validateProjectContext(answers.context);
        setFieldErrors({ title: titleError, context: contextError });
        if (titleError || contextError) {
          setError('');
          focusInvalidField(titleError ? 'project-creation-title' : 'project-creation-context');
          return;
        }
      }
      if (step === 1) {
        const objectiveError = validateProjectObjective(answers.objective);
        setFieldErrors({ objective: objectiveError });
        if (objectiveError) {
          setError('');
          focusInvalidField('project-creation-objective');
          return;
        }
      }
      goToStep((step + 1) as 0 | 1 | 2);
      return;
    }
    const titleError = validateProjectTitle(answers.title);
    const contextError = validateProjectContext(answers.context);
    const objectiveError = validateProjectObjective(answers.objective);
    if (titleError || contextError || objectiveError) {
      const invalidStep = titleError || contextError ? 0 : 1;
      const invalidFieldId = titleError
        ? 'project-creation-title'
        : contextError
          ? 'project-creation-context'
          : 'project-creation-objective';
      setFieldErrors({ title: titleError, context: contextError, objective: objectiveError });
      setStepDirection('backward');
      setStep(invalidStep);
      setError('');
      window.setTimeout(() => focusInvalidField(invalidFieldId), 0);
      return;
    }
    if (!selectedWorkspace) {
      setError('Activa un espacio personal o de equipo desde el menú lateral para crear el proyecto.');
      return;
    }
    if (!canCreateProject) {
      setError('Solo el propietario o un administrador de la organización puede crear proyectos.');
      return;
    }
    if (finalDisabled) {
      setError(methodology === 'SCRUM' ? 'Scrum necesita Product Owner, Scrum Master y al menos una persona Developer.' : 'Espera a que se carguen los participantes.');
      return;
    }

    setError('');
    setIsLoading(true);
    try {
      const project = await createProject({
        workspaceId: selectedWorkspace.id,
        name: answers.title.trim(),
        cardPrefix: cardPrefix.trim(),
        description: null,
        problemStatement: answers.context.trim() || null,
        impactedPeople: answers.impactedPeople.trim() || null,
        problemImpact: answers.problemImpact.trim() || null,
        impactedCount: null,
        expectedOutcome: answers.objective.trim(),
        expectedDeliverables: answers.expectedDeliverables.trim() || null,
        scopeInclusions: answers.scopeInclusions.trim() || null,
        scopeExclusions: answers.scopeExclusions.trim() || null,
        projectConstraints: answers.projectConstraints.trim() || null,
        proposedSolution: null,
        differentiation: null,
        endDate: answers.endDate || undefined,
        maturityStage: 'IDEA',
        icon: 'Folder',
        color: PROJECT_COLOR,
        methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
        advancedTraceability,
        teamIds: canSelectTeams ? teamIds : [],
        memberIds: canConfigureMethodology ? memberIds : [],
        productOwnerId: methodology === 'SCRUM' ? productOwnerId : null,
        scrumMasterId: methodology === 'SCRUM' ? scrumMasterId : null,
      });
      clearProjectCreationDraft(selectedWorkspaceId);
      markStepDone('project');
      onCreated(project);
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'No se pudo crear el proyecto. Inténtalo de nuevo.';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @keyframes createProjectOverlayIn { from { opacity: 0 } to { opacity: 1 } }
        @keyframes createProjectOverlayOut { from { opacity: 1 } to { opacity: 0 } }
        @keyframes createProjectPanelIn { from { opacity: 0; transform: translateY(10px) scale(.99) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes createProjectPanelOut { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(5px) scale(.995) } }
        @keyframes createProjectSpin { to { transform: rotate(360deg) } }
        @keyframes createProjectStepForward { from { opacity: .5; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes createProjectStepBackward { from { opacity: .5; transform: translateX(-12px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes createProjectCheckIn { from { opacity: .4; transform: scale(.65) } to { opacity: 1; transform: scale(1) } }
        @keyframes createProjectNoticeIn { from { opacity: 0; transform: translateY(5px) } to { opacity: 1; transform: translateY(0) } }
        .create-project-step-content { animation: createProjectStepForward 240ms cubic-bezier(.16,1,.3,1) both; }
        .create-project-step-content--backward { animation-name: createProjectStepBackward; }
        .create-project-step-item, .create-project-step-number { transition: border-color 220ms ease, background-color 220ms ease, color 220ms ease; }
        .create-project-step-number svg { animation: createProjectCheckIn 200ms cubic-bezier(.16,1,.3,1) both; }
        .create-project-progress { height: 2px; margin-top: 11px; overflow: hidden; border-radius: 99px; background: var(--c-border); }
        .create-project-progress-fill { width: 100%; height: 100%; transform-origin: left center; background: var(--c-accent-text); transition: transform 280ms cubic-bezier(.16,1,.3,1); }
        .create-project-action, .create-project-back, .create-project-cancel, .create-project-close { transition: transform 160ms cubic-bezier(.16,1,.3,1), border-color 160ms ease, background-color 160ms ease, color 160ms ease, filter 160ms ease, opacity 160ms ease; }
        .create-project-action:hover:not(:disabled) { filter: brightness(1.09); transform: translateY(-1px); }
        .create-project-back:hover:not(:disabled), .create-project-cancel:hover:not(:disabled), .create-project-close:hover:not(:disabled) { border-color: var(--c-border2) !important; color: var(--c-text) !important; background: var(--c-surface2) !important; }
        .create-project-action:active:not(:disabled), .create-project-back:active:not(:disabled), .create-project-cancel:active:not(:disabled), .create-project-close:active:not(:disabled) { transform: scale(.98); }
        .create-project-action:focus-visible, .create-project-back:focus-visible, .create-project-cancel:focus-visible, .create-project-close:focus-visible { outline: 2px solid var(--c-accent-text); outline-offset: 2px; }
        .create-project-error { animation: createProjectNoticeIn 180ms cubic-bezier(.16,1,.3,1) both; }
        .create-project-steps { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
        .create-project-back { display: inline-flex; align-items: center; justify-content: center; gap: 7px; white-space: nowrap; }
        @media (max-width: 500px) { .create-project-steps { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (prefers-reduced-motion: reduce) {
          .create-project-overlay, .create-project-panel, .create-project-step-content, .create-project-step-number svg, .create-project-error { animation-duration: .01ms !important; }
          .create-project-progress-fill, .create-project-step-item, .create-project-step-number, .create-project-action, .create-project-back, .create-project-cancel, .create-project-close { transition-duration: .01ms !important; }
          .create-project-action:hover:not(:disabled), .create-project-action:active:not(:disabled), .create-project-back:active:not(:disabled), .create-project-cancel:active:not(:disabled), .create-project-close:active:not(:disabled) { transform: none; }
          .create-project-spinner { animation: none !important; }
        }
      `}</style>

      <div
        className="create-project-overlay"
        style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(5,8,15,0.68)', backdropFilter: 'blur(5px)', animation: `${closing ? 'createProjectOverlayOut' : 'createProjectOverlayIn'} 180ms ease both` }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
          onClick={(event) => event.stopPropagation()}
          className="create-project-panel"
          style={{ width: 'min(840px, calc(100vw - 32px))', height: 'min(820px, calc(100dvh - 32px))', minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(97,71,130,0.1)', borderRadius: 16, background: 'var(--c-surface)', boxShadow: '0 32px 90px rgba(0,0,0,0.56)', fontFamily: MANROPE, animation: `${closing ? 'createProjectPanelOut 150ms' : 'createProjectPanelIn 260ms'} cubic-bezier(.16,1,.3,1) both` }}
        >
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '22px 24px 18px', borderBottom: '1px solid rgba(97,71,130,0.07)' }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, color: PROJECT_COLOR, background: 'rgba(116,82,166,0.1)', border: '1px solid rgba(116,82,166,0.2)' }}><FolderKanban size={19} strokeWidth={1.8} /></div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <h2 id="create-project-title" style={{ margin: 0, color: 'var(--c-text)', fontSize: 19, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: SORA }}>Crear proyecto</h2>
              <p style={{ margin: '5px 0 0', color: 'var(--c-text2)', fontSize: 13, lineHeight: 1.5, fontFamily: MANROPE }}>Define el problema, el resultado esperado y los límites del proyecto.</p>
            </div>
            <button type="button" className="create-project-close" onClick={handleClose} aria-label="Cerrar" disabled={isLoading} style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, color: 'var(--c-text2)', background: 'transparent', border: '1px solid rgba(97,71,130,0.08)', cursor: isLoading ? 'not-allowed' : 'pointer' }}><X size={16} /></button>
          </header>

          <form noValidate onSubmit={handleSubmit} style={{ minHeight: 0, display: 'flex', flex: 1, flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px 10px' }}>
              <div className="create-project-steps" aria-label="Pasos para crear proyecto">
                {projectSteps.map((item, index) => (
                  <div key={item.title} className="create-project-step-item" aria-current={index === step ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '8px 9px', borderRadius: 9, border: `1px solid ${index === step ? 'rgba(116,82,166,0.34)' : 'rgba(97,71,130,0.07)'}`, background: index === step ? 'rgba(116,82,166,0.09)' : 'transparent' }}>
                    <span className="create-project-step-number" style={{ width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 99, color: index <= step ? PROJECT_COLOR : '#777365', background: index <= step ? 'rgba(116,82,166,0.12)' : 'rgba(97,71,130,0.04)', fontSize: 10, fontWeight: 800 }}>{index < step ? <Check size={12} /> : `0${index + 1}`}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: index === step ? 'var(--c-text)' : 'var(--c-text2)', fontSize: 11, fontWeight: 700 }}>{item.title}</span>
                  </div>
                ))}
              </div>
              <div className="create-project-progress" aria-hidden="true"><div className="create-project-progress-fill" style={{ transform: `scaleX(${(step + 1) / projectSteps.length})` }} /></div>
            </div>

            <div ref={contentRef} style={{ minHeight: 0, flex: 1, padding: '8px 24px 24px', overflowX: 'hidden', overflowY: 'auto', scrollbarColor: 'var(--c-border2) transparent', scrollbarWidth: 'thin' }}>
              <div key={step} className={`create-project-step-content${stepDirection === 'backward' ? ' create-project-step-content--backward' : ''}`}>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '4px 0 5px', color: 'var(--c-text)', fontFamily: SORA, fontSize: 16, letterSpacing: '-0.02em' }}>{projectSteps[step].title}</h3>
                <p style={{ margin: 0, color: 'var(--c-text2)', fontSize: 12, lineHeight: 1.5 }}>{projectSteps[step].description}</p>
              </div>

              {step === 0 && selectedWorkspace && (
                <div style={{ marginBottom: 20 }}>
                  <span style={{ display: 'block', marginBottom: 8, color: 'var(--c-text2)', fontSize: 12, fontWeight: 700, fontFamily: MANROPE }}>Se creará en</span>
                  <div style={{ minHeight: 46, display: 'flex', alignItems: 'center', gap: 11, padding: '0 13px', borderRadius: 9, background: 'rgba(97,71,130,0.035)', border: '1px solid rgba(97,71,130,0.08)' }}>
                    <span style={{ width: 27, height: 27, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 8, color: selectedWorkspace.color ?? PROJECT_COLOR, background: `${selectedWorkspace.color ?? PROJECT_COLOR}1A` }}><WorkspaceIcon icon={selectedWorkspace.icon ?? 'Folder'} style={{ width: 14, height: 14 }} /></span>
                    <span style={{ minWidth: 0, flex: 1, color: 'var(--c-text)', fontSize: 13, fontWeight: 600, fontFamily: MANROPE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedWorkspace.organization?.name ? `${selectedWorkspace.organization.name} / ` : ''}{selectedWorkspace.name}</span>
                    <Check size={16} aria-label="Espacio activo" style={{ color: PROJECT_COLOR, flexShrink: 0 }} />
                  </div>
                </div>
              )}

              {selectedWorkspace && <ProjectCreationFields step={step} values={answers} errors={fieldErrors} onChange={updateAnswer} accent={PROJECT_COLOR} />}

              {selectedWorkspace && step === 2 && <ProjectMethodologyStep
                methodology={methodology} onMethodologyChange={setMethodology}
                teams={teams} members={members} teamIds={teamIds} onTeamIdsChange={setTeamIds}
                memberIds={memberIds} onMemberIdsChange={setMemberIds}
                productOwnerId={productOwnerId} onProductOwnerChange={setProductOwnerId}
                scrumMasterId={scrumMasterId} onScrumMasterChange={setScrumMasterId}
                currentUserId={currentUserId} currentUser={currentUser ? { id: currentUser.id, name: currentUser.name, email: currentUser.email } : null}
                supportsMethodology={canConfigureMethodology} supportsTeams={canSelectTeams} supportsMembers={canConfigureMethodology}
                canCreateTeam={canSelectTeams && canManageOrganizationRole(selectedWorkspace?.organization?.role)}
                createTeamHref={`/dashboard/teams?create=1&workspaceId=${encodeURIComponent(selectedWorkspaceId)}`} onLeaveForTeams={leaveForTeams}
                loading={participantsLoading} loadError={participantsError}
                onRetry={() => { loadedWorkspaceId.current = ''; setParticipantsRetry((current) => current + 1); }}
              />}

              {!selectedWorkspace && (
                <div style={{ padding: '16px', borderRadius: 11, border: '1px solid rgba(116,82,166,0.2)', background: 'rgba(116,82,166,0.06)' }}>
                  <p style={{ margin: '0 0 12px', color: '#D8D1C5', fontSize: 13, lineHeight: 1.55 }}>{isInstitutionalWorkspace ? 'En esta organización, las propuestas pasan por la bandeja de iniciativas antes de convertirse en proyectos.' : 'Activa un espacio personal o de equipo desde el menú lateral para crear el proyecto.'}</p>
                  {isInstitutionalWorkspace && <Link href="/dashboard/initiatives/new" onClick={handleClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: PROJECT_COLOR, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Crear iniciativa institucional <ArrowRight size={14} /></Link>}
                </div>
              )}

              {selectedWorkspace && step === 2 && (
                <section aria-labelledby="project-traceability-title" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', alignItems: 'start', gap: '10px 14px', marginTop: 18, padding: '14px 15px', border: '1px solid rgba(116,82,166,0.2)', borderRadius: 11, background: 'linear-gradient(125deg, rgba(116,82,166,0.075), rgba(97,71,130,0.025))' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, minWidth: 0 }}>
                    <span style={{ width: 31, height: 31, flex: '0 0 31px', display: 'grid', placeItems: 'center', border: '1px solid rgba(116,82,166,0.22)', borderRadius: 9, color: PROJECT_COLOR, background: 'rgba(116,82,166,0.1)' }}><GitBranch size={15} /></span>
                    <div style={{ minWidth: 0 }}>
                      <h4 id="project-traceability-title" style={{ margin: '1px 0 4px', color: 'var(--c-text)', fontSize: 12, fontWeight: 750, fontFamily: MANROPE }}>Trazabilidad avanzada <span style={{ color: 'var(--c-text4)', fontSize: 10, fontWeight: 600 }}>Complemento opcional</span></h4>
                      <p style={{ margin: 0, color: 'var(--c-text3)', fontSize: 10.5, lineHeight: 1.5, fontFamily: MANROPE }}>Añade herramientas para dar seguimiento a entregables, requisitos, hitos, resultados y decisiones. Puedes activarla más adelante.</p>
                    </div>
                  </div>
                  <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 30, padding: '0 9px', border: `1px solid ${advancedTraceability ? 'rgba(116,82,166,0.42)' : 'rgba(97,71,130,0.14)'}`, borderRadius: 8, background: advancedTraceability ? 'rgba(116,82,166,0.12)' : 'rgba(97,71,130,0.035)', color: advancedTraceability ? 'var(--c-text)' : 'var(--c-text2)', cursor: isLoading ? 'not-allowed' : 'pointer', fontSize: 10.5, fontWeight: 700, whiteSpace: 'nowrap' }}>
                    <input type="checkbox" checked={advancedTraceability} onChange={(event) => setAdvancedTraceability(event.target.checked)} disabled={isLoading} style={{ accentColor: PROJECT_COLOR }} />
                    {advancedTraceability ? 'Incluida' : 'Incluir'}
                  </label>
                </section>
              )}

              {selectedWorkspace && step === 2 && <section aria-labelledby="project-card-prefix-title" style={{ marginTop: 20, padding: '16px 0 2px', borderTop: '1px solid rgba(97,71,130,0.12)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 260px', minWidth: 0 }}>
                    <h4 id="project-card-prefix-title" style={{ margin: 0, color: 'var(--c-text)', fontSize: 12, fontWeight: 700, fontFamily: MANROPE }}>Prefijo de tarjetas</h4>
                    <p style={{ margin: '4px 0 0', color: 'var(--c-text3)', fontSize: 10.5, lineHeight: 1.45, fontFamily: MANROPE }}>Cada tarjeta tendrá un código consecutivo, por ejemplo CFT-01.</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <input
                      id="project-card-prefix"
                      name="cardPrefix"
                      aria-label="Prefijo de tres caracteres"
                      aria-required="true"
                      maxLength={3}
                      value={cardPrefix}
                      onChange={(event) => {
                        setCustomCardPrefix(event.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3));
                        if (error) setError('');
                      }}
                      aria-describedby="project-card-prefix-hint"
                      aria-invalid={!validCardPrefix}
                      autoComplete="off"
                      spellCheck={false}
                      style={{ width: 82, height: 38, boxSizing: 'border-box', borderRadius: 9, padding: '0 10px', border: `1px solid ${validCardPrefix ? 'rgba(97,71,130,0.18)' : 'rgba(184,92,92,0.5)'}`, color: 'var(--c-text)', background: 'rgba(97,71,130,0.045)', outlineColor: PROJECT_COLOR, fontFamily: MANROPE, fontSize: 13, fontWeight: 800, letterSpacing: '0.08em', textAlign: 'center', textTransform: 'uppercase' }}
                    />
                    {customCardPrefix !== null && <button type="button" onClick={() => setCustomCardPrefix(null)} className="create-project-back" aria-label="Restaurar prefijo sugerido" style={{ minHeight: 36, padding: '0 9px', border: '1px solid rgba(97,71,130,0.14)', borderRadius: 8, color: 'var(--c-text2)', background: 'transparent', font: `600 10.5px ${MANROPE}`, cursor: 'pointer' }}><RotateCcw size={12} />Sugerido</button>}
                    <span aria-live="polite" style={{ display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 36, padding: '0 10px', borderRadius: 9, border: '1px solid rgba(116,82,166,0.22)', background: 'rgba(116,82,166,0.08)' }}>
                      <span style={{ color: 'var(--c-text3)', fontSize: 10.5, fontFamily: MANROPE }}>Código</span>
                      <code style={{ color: PROJECT_COLOR, fontSize: 12, fontWeight: 800, letterSpacing: '0.02em', fontVariantNumeric: 'tabular-nums' }}>{validCardPrefix ? `${cardPrefix}-01` : 'ABC-01'}</code>
                    </span>
                  </div>
                </div>
                <p id="project-card-prefix-hint" style={{ margin: '8px 0 0', color: validCardPrefix ? 'var(--c-text3)' : '#D98B9B', fontSize: 10.5, lineHeight: 1.4, fontFamily: MANROPE }}>
                  {validCardPrefix ? 'Usa 3 letras o números, sin espacios. Puedes cambiar la sugerencia.' : 'Escribe exactamente 3 letras o números.'}
                </p>
              </section>}

              {error && <p role="alert" className="create-project-error" style={{ margin: '16px 0 0', padding: '10px 12px', borderRadius: 9, color: '#9F455F', background: 'rgba(184,92,92,0.1)', border: '1px solid rgba(184,92,92,0.24)', fontSize: 12.5, lineHeight: 1.45, fontFamily: MANROPE }}>{error}</p>}
              </div>
            </div>

            <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '14px 24px', borderTop: '1px solid rgba(97,71,130,0.07)', background: 'rgba(97,71,130,0.015)' }}>
              <span style={{ color: '#777365', fontSize: 11.5, lineHeight: 1.4, fontFamily: MANROPE }}>Paso {step + 1} de {projectSteps.length}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                {step > 0 && <button type="button" className="create-project-back" onClick={() => goToStep((step - 1) as 0 | 1 | 2)} disabled={isLoading} style={{ height: 40, minWidth: 108, padding: '0 14px', borderRadius: 9, color: 'var(--c-text2)', background: 'rgba(97,71,130,0.035)', border: '1px solid rgba(97,71,130,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}><ArrowLeft size={14} />Anterior</button>}
                {step === 0 && <button type="button" className="create-project-cancel" onClick={handleClose} disabled={isLoading} style={{ height: 40, padding: '0 15px', borderRadius: 9, color: 'var(--c-text2)', background: 'rgba(97,71,130,0.035)', border: '1px solid rgba(97,71,130,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}>{t.btn_cancel}</button>}
                <button type="submit" disabled={!selectedWorkspace || (step === 2 && finalDisabled)} className="create-project-action" style={{ height: 40, minWidth: 130, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 15px', borderRadius: 9, color: '#FFFFFF', background: PROJECT_COLOR, border: 0, cursor: !selectedWorkspace || (step === 2 && finalDisabled) ? 'not-allowed' : 'pointer', opacity: !selectedWorkspace || (step === 2 && finalDisabled) ? 0.4 : 1, fontSize: 12.5, fontWeight: 700, fontFamily: SORA }}>
                  {isLoading ? <><span className="create-project-spinner" style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF', animation: 'createProjectSpin 650ms linear infinite' }} />{t.btn_creating}</> : step === 2 ? <><Plus size={15} strokeWidth={2.2} />Crear proyecto</> : <>Continuar<ArrowRight size={14} /></>}
                </button>
              </div>
            </footer>
          </form>
        </section>
      </div>
    </>
  );
}
