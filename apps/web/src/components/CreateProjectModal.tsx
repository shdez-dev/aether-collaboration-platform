'use client';

import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, FolderKanban, Plus, X } from 'lucide-react';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { ProjectProposalFields, EMPTY_PROJECT_PROPOSAL, PROPOSAL_STEPS, type ProjectProposalAnswers, type ProposalStep } from '@/components/ProjectProposalFields';
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
const STEPS = [...PROPOSAL_STEPS, { title: 'Equipo y enfoque', description: 'Elige quién participa y cómo se organizará este proyecto.' }] as const;
const PERSONAL_STEPS = [...PROPOSAL_STEPS, { title: 'Proyecto personal', description: 'Este proyecto será privado para ti.' }] as const;
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

  const [proposal, setProposal] = useState<ProjectProposalAnswers>(EMPTY_PROJECT_PROPOSAL);
  const [step, setStep] = useState<0 | 1 | 2 | 3>(0);
  const [stepDirection, setStepDirection] = useState<'forward' | 'backward'>('forward');
  const [methodology, setMethodology] = useState<'FLEXIBLE' | 'SCRUM'>('FLEXIBLE');
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
  const [closing, setClosing] = useState(false);

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
    setProposal(draft.proposal);
    setMethodology(canConfigureMethodology ? draft.methodology : 'FLEXIBLE');
    setResumingDraft(true);
    setStep(3);
  }, [canConfigureMethodology, currentUserId, selectedWorkspaceId]);

  useEffect(() => { if (contentRef.current) contentRef.current.scrollTop = 0; }, [step]);

  const isInstitutionalWorkspace = activeWorkspace?.organization?.type === 'INSTITUTION';
  const canSubmit = Boolean(canCreateProject && selectedWorkspace && proposal.title.trim() && !isLoading);
  const participantIds = new Set([currentUserId, ...memberIds, ...teams.filter((team) => teamIds.includes(team.id)).flatMap((team) => team.members.map((person) => person.id))]);
  const scrumReady = methodology !== 'SCRUM' || Boolean(participantIds.size >= 3 && productOwnerId && scrumMasterId && productOwnerId !== scrumMasterId && participantIds.has(productOwnerId) && participantIds.has(scrumMasterId));
  const finalDisabled = !canSubmit || participantsLoading || loadedWorkspaceId.current !== selectedWorkspaceId || Boolean(participantsError) || (canConfigureMethodology && !scrumReady);

  useEffect(() => {
    if (step !== 3 || !selectedWorkspaceId) return;
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
      proposal, methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
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
      proposal, methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
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

  const updateProposal = (key: keyof ProjectProposalAnswers, value: string) => {
    setProposal((current) => ({ ...current, [key]: value }));
    if (error) setError('');
  };

  const goToStep = (nextStep: 0 | 1 | 2 | 3) => {
    setStepDirection(nextStep < step ? 'backward' : 'forward');
    setError('');
    setStep(nextStep);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 3) {
      goToStep((step + 1) as 0 | 1 | 2 | 3);
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
        name: proposal.title.trim(),
        description: proposal.summary.trim(),
        problemStatement: proposal.problemStatement.trim(),
        impactedPeople: proposal.impactedPeople.trim(),
        problemImpact: proposal.problemImpact.trim(),
        impactedCount: Number(proposal.impactedCount),
        expectedOutcome: proposal.expectedOutcome.trim(),
        proposedSolution: proposal.proposedSolution.trim(),
        differentiation: proposal.differentiation.trim(),
        maturityStage: 'IDEA',
        icon: 'Folder',
        color: PROJECT_COLOR,
        methodology: canConfigureMethodology ? methodology : 'FLEXIBLE',
        teamIds: canSelectTeams ? teamIds : [],
        memberIds: canConfigureMethodology ? memberIds : [],
        productOwnerId: methodology === 'SCRUM' ? productOwnerId : null,
        scrumMasterId: methodology === 'SCRUM' ? scrumMasterId : null,
      });
      clearProjectCreationDraft(selectedWorkspaceId);
      markStepDone('project');
      onCreated(project);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo crear el proyecto. Inténtalo de nuevo.');
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
        .create-project-steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
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
              <p style={{ margin: '5px 0 0', color: 'var(--c-text2)', fontSize: 13, lineHeight: 1.5, fontFamily: MANROPE }}>De la propuesta al equipo que la realizará.</p>
            </div>
            <button type="button" className="create-project-close" onClick={handleClose} aria-label="Cerrar" disabled={isLoading} style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, color: 'var(--c-text2)', background: 'transparent', border: '1px solid rgba(97,71,130,0.08)', cursor: isLoading ? 'not-allowed' : 'pointer' }}><X size={16} /></button>
          </header>

          <form onSubmit={handleSubmit} style={{ minHeight: 0, display: 'flex', flex: 1, flexDirection: 'column' }}>
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

              {selectedWorkspace && step < 3 ? <ProjectProposalFields step={step as ProposalStep} values={proposal} onChange={updateProposal} accent={PROJECT_COLOR} /> : selectedWorkspace ? <ProjectMethodologyStep
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
              /> : (
                <div style={{ padding: '16px', borderRadius: 11, border: '1px solid rgba(116,82,166,0.2)', background: 'rgba(116,82,166,0.06)' }}>
                  <p style={{ margin: '0 0 12px', color: '#D8D1C5', fontSize: 13, lineHeight: 1.55 }}>{isInstitutionalWorkspace ? 'En esta organización, las propuestas pasan por la bandeja de iniciativas antes de convertirse en proyectos.' : 'Activa un espacio personal o de equipo desde el menú lateral para crear el proyecto.'}</p>
                  {isInstitutionalWorkspace && <Link href="/dashboard/initiatives/new" onClick={handleClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: PROJECT_COLOR, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Crear iniciativa institucional <ArrowRight size={14} /></Link>}
                </div>
              )}

              {error && <p role="alert" className="create-project-error" style={{ margin: '16px 0 0', padding: '10px 12px', borderRadius: 9, color: '#9F455F', background: 'rgba(184,92,92,0.1)', border: '1px solid rgba(184,92,92,0.24)', fontSize: 12.5, lineHeight: 1.45, fontFamily: MANROPE }}>{error}</p>}
              </div>
            </div>

            <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap', padding: '14px 24px', borderTop: '1px solid rgba(97,71,130,0.07)', background: 'rgba(97,71,130,0.015)' }}>
              <span style={{ color: '#777365', fontSize: 11.5, lineHeight: 1.4, fontFamily: MANROPE }}>Paso {step + 1} de {projectSteps.length}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                {step > 0 && <button type="button" className="create-project-back" onClick={() => goToStep((step - 1) as 0 | 1 | 2 | 3)} disabled={isLoading} style={{ height: 40, minWidth: 108, padding: '0 14px', borderRadius: 9, color: 'var(--c-text2)', background: 'rgba(97,71,130,0.035)', border: '1px solid rgba(97,71,130,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}><ArrowLeft size={14} />Anterior</button>}
                {step === 0 && <button type="button" className="create-project-cancel" onClick={handleClose} disabled={isLoading} style={{ height: 40, padding: '0 15px', borderRadius: 9, color: 'var(--c-text2)', background: 'rgba(97,71,130,0.035)', border: '1px solid rgba(97,71,130,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}>{t.btn_cancel}</button>}
                <button type="submit" disabled={!selectedWorkspace || (step === 3 && finalDisabled)} className="create-project-action" style={{ height: 40, minWidth: 130, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 15px', borderRadius: 9, color: '#FFFFFF', background: PROJECT_COLOR, border: 0, cursor: !selectedWorkspace || (step === 3 && finalDisabled) ? 'not-allowed' : 'pointer', opacity: !selectedWorkspace || (step === 3 && finalDisabled) ? 0.4 : 1, fontSize: 12.5, fontWeight: 700, fontFamily: SORA }}>
                  {isLoading ? <><span className="create-project-spinner" style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#FFFFFF', animation: 'createProjectSpin 650ms linear infinite' }} />{t.btn_creating}</> : step === 3 ? <><Plus size={15} strokeWidth={2.2} />Crear proyecto</> : <>Continuar<ArrowRight size={14} /></>}
                </button>
              </div>
            </footer>
          </form>
        </section>
      </div>
    </>
  );
}
