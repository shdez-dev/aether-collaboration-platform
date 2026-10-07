'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Check, ChevronDown, FolderKanban, Plus, X } from 'lucide-react';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { ProjectProposalFields, EMPTY_PROJECT_PROPOSAL, PROPOSAL_STEPS, type ProjectProposalAnswers, type ProposalStep } from '@/components/ProjectProposalFields';
import { useT } from '@/lib/i18n';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { markStepDone } from '@/lib/utils/onboardingGuide';

const PROJECT_COLOR = '#F2571E';
const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
  defaultWorkspaceId?: string;
}

export default function CreateProjectModal({ onClose, onCreated, defaultWorkspaceId }: CreateProjectModalProps) {
  const t = useT();
  const createProject = useProjectStore((state) => state.createProject);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const projectWorkspaces = useMemo(() => workspaces.filter((workspace) => !workspace.archived && workspace.organization?.type !== 'INSTITUTION'), [workspaces]);

  const [proposal, setProposal] = useState<ProjectProposalAnswers>(EMPTY_PROJECT_PROPOSAL);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [step, setStep] = useState<ProposalStep>(0);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [closing, setClosing] = useState(false);

  useEffect(() => { void fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    if (!projectWorkspaces.length) {
      setSelectedWorkspaceId('');
      return;
    }
    const requested = projectWorkspaces.find((workspace) => workspace.id === defaultWorkspaceId);
    if (requested) {
      if (selectedWorkspaceId !== requested.id) setSelectedWorkspaceId(requested.id);
      return;
    }
    if (projectWorkspaces.some((workspace) => workspace.id === selectedWorkspaceId)) return;
    setSelectedWorkspaceId(projectWorkspaces.length === 1 ? projectWorkspaces[0].id : '');
  }, [projectWorkspaces, defaultWorkspaceId, selectedWorkspaceId]);

  const selectedWorkspace = projectWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId);
  const hasInstitutionalWorkspace = workspaces.some((workspace) => !workspace.archived && workspace.organization?.type === 'INSTITUTION');
  const canSubmit = Boolean(selectedWorkspace && proposal.title.trim() && !isLoading);

  const handleClose = () => {
    if (isLoading || closing) return;
    setClosing(true);
    window.setTimeout(onClose, 180);
  };

  const updateProposal = (key: keyof ProjectProposalAnswers, value: string) => {
    setProposal((current) => ({ ...current, [key]: value }));
    if (error) setError('');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < 2) {
      setStep((current) => (current + 1) as ProposalStep);
      return;
    }
    if (!selectedWorkspace) {
      setError('Selecciona un espacio personal o de equipo para crear el proyecto.');
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
      });
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
        @keyframes createProjectPanelIn { from { opacity: 0; transform: translateY(12px) scale(.985) } to { opacity: 1; transform: translateY(0) scale(1) } }
        @keyframes createProjectPanelOut { from { opacity: 1; transform: translateY(0) scale(1) } to { opacity: 0; transform: translateY(6px) scale(.99) } }
        @keyframes createProjectSpin { to { transform: rotate(360deg) } }
        .create-project-input::placeholder { color: #777365; }
        .create-project-action:hover:not(:disabled) { filter: brightness(1.07); }
        @media (prefers-reduced-motion: reduce) {
          .create-project-overlay, .create-project-panel { animation-duration: .01ms !important; }
        }
      `}</style>

      <div
        className="create-project-overlay"
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'rgba(5,8,15,0.68)', backdropFilter: 'blur(5px)', animation: `${closing ? 'createProjectOverlayOut' : 'createProjectOverlayIn'} 180ms ease both` }}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-labelledby="create-project-title"
          onClick={(event) => event.stopPropagation()}
          className="create-project-panel"
          style={{ width: '100%', maxWidth: 560, maxHeight: 'min(92vh, 790px)', display: 'flex', flexDirection: 'column', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, background: '#171E30', boxShadow: '0 32px 90px rgba(0,0,0,0.56)', animation: `${closing ? 'createProjectPanelOut' : 'createProjectPanelIn'} 220ms cubic-bezier(.2,.75,.25,1) both` }}
        >
          <header style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '22px 24px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ width: 40, height: 40, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 12, color: PROJECT_COLOR, background: 'rgba(242,87,30,0.1)', border: '1px solid rgba(242,87,30,0.2)' }}><FolderKanban size={19} strokeWidth={1.8} /></div>
            <div style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
              <h2 id="create-project-title" style={{ margin: 0, color: '#F4EEE2', fontSize: 19, lineHeight: 1.3, fontWeight: 700, letterSpacing: '-0.02em', fontFamily: SORA }}>Crear proyecto</h2>
              <p style={{ margin: '5px 0 0', color: '#9C9486', fontSize: 13, lineHeight: 1.5, fontFamily: MANROPE }}>Contexto, impacto y propuesta en tres pasos.</p>
            </div>
            <button type="button" onClick={handleClose} aria-label="Cerrar" disabled={isLoading} style={{ width: 32, height: 32, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 9, color: '#9C9486', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', cursor: isLoading ? 'not-allowed' : 'pointer' }}><X size={16} /></button>
          </header>

          <form onSubmit={handleSubmit} style={{ minHeight: 0, display: 'flex', flex: 1, flexDirection: 'column' }}>
            <div style={{ padding: '18px 24px 10px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }} aria-label="Pasos para crear proyecto">
                {PROPOSAL_STEPS.map((item, index) => (
                  <div key={item.title} aria-current={index === step ? 'step' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, padding: '8px 9px', borderRadius: 9, border: `1px solid ${index === step ? 'rgba(242,87,30,0.34)' : 'rgba(255,255,255,0.07)'}`, background: index === step ? 'rgba(242,87,30,0.09)' : 'transparent' }}>
                    <span style={{ width: 22, height: 22, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 99, color: index <= step ? PROJECT_COLOR : '#777365', background: index <= step ? 'rgba(242,87,30,0.12)' : 'rgba(255,255,255,0.04)', fontSize: 10, fontWeight: 800 }}>{index < step ? <Check size={12} /> : `0${index + 1}`}</span>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', color: index === step ? '#F4EEE2' : '#9C9486', fontSize: 11, fontWeight: 700 }}>{item.title}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ minHeight: 0, padding: '8px 24px 24px', overflowY: 'auto' }}>
              <div style={{ marginBottom: 18 }}>
                <h3 style={{ margin: '4px 0 5px', color: '#F4EEE2', fontFamily: SORA, fontSize: 16, letterSpacing: '-0.02em' }}>{PROPOSAL_STEPS[step].title}</h3>
                <p style={{ margin: 0, color: '#9C9486', fontSize: 12, lineHeight: 1.5 }}>{PROPOSAL_STEPS[step].description}</p>
              </div>

              {step === 0 && (
                <div style={{ marginBottom: 20 }}>
                  <label htmlFor="create-project-workspace" style={{ display: 'block', marginBottom: 8, color: '#C8BFAE', fontSize: 12, fontWeight: 700, fontFamily: MANROPE }}>Espacio de trabajo <span style={{ color: PROJECT_COLOR }}>*</span></label>
                  {projectWorkspaces.length > 1 ? (
                    <div style={{ position: 'relative' }}>
                      <select id="create-project-workspace" required value={selectedWorkspaceId} onChange={(event) => { setSelectedWorkspaceId(event.target.value); if (error) setError(''); }} className="create-project-input" style={{ width: '100%', height: 46, boxSizing: 'border-box', appearance: 'none', padding: '0 42px 0 13px', borderRadius: 9, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', color: '#F4EEE2', colorScheme: 'dark', fontSize: 13, fontFamily: MANROPE }}>
                        <option value="" disabled>Selecciona dónde guardar el proyecto</option>
                        {projectWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
                      </select>
                      <ChevronDown size={16} aria-hidden="true" style={{ position: 'absolute', top: 15, right: 13, color: '#9C9486', pointerEvents: 'none' }} />
                    </div>
                  ) : selectedWorkspace ? (
                    <div style={{ minHeight: 46, display: 'flex', alignItems: 'center', gap: 11, padding: '0 13px', borderRadius: 9, background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <span style={{ width: 27, height: 27, display: 'grid', placeItems: 'center', flexShrink: 0, borderRadius: 8, color: selectedWorkspace.color ?? PROJECT_COLOR, background: `${selectedWorkspace.color ?? PROJECT_COLOR}1A` }}><WorkspaceIcon icon={selectedWorkspace.icon ?? 'Folder'} style={{ width: 14, height: 14 }} /></span>
                      <span style={{ minWidth: 0, flex: 1, color: '#E8E1D2', fontSize: 13, fontWeight: 600, fontFamily: MANROPE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{selectedWorkspace.name}</span>
                      <Check size={16} aria-label="Espacio seleccionado" style={{ color: PROJECT_COLOR, flexShrink: 0 }} />
                    </div>
                  ) : (
                    <div style={{ minHeight: 46, display: 'flex', alignItems: 'center', padding: '10px 13px', borderRadius: 9, color: '#9C9486', background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 12, lineHeight: 1.45, fontFamily: MANROPE }}>
                      No hay espacios personales o de equipo disponibles para crear proyectos.
                    </div>
                  )}
                </div>
              )}

              {projectWorkspaces.length > 0 ? <ProjectProposalFields step={step} values={proposal} onChange={updateProposal} accent={PROJECT_COLOR} /> : (
                <div style={{ padding: '16px', borderRadius: 11, border: '1px solid rgba(242,87,30,0.2)', background: 'rgba(242,87,30,0.06)' }}>
                  <p style={{ margin: '0 0 12px', color: '#D8D1C5', fontSize: 13, lineHeight: 1.55 }}>En una organización institucional, las propuestas pasan por la bandeja de iniciativas antes de convertirse en proyectos.</p>
                  {hasInstitutionalWorkspace && <Link href="/dashboard/initiatives/new" onClick={handleClose} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, color: PROJECT_COLOR, fontSize: 12, fontWeight: 800, textDecoration: 'none' }}>Crear iniciativa institucional <ArrowRight size={14} /></Link>}
                </div>
              )}

              {error && <p role="alert" style={{ margin: '16px 0 0', padding: '10px 12px', borderRadius: 9, color: '#F2A19A', background: 'rgba(184,92,92,0.1)', border: '1px solid rgba(184,92,92,0.24)', fontSize: 12.5, lineHeight: 1.45, fontFamily: MANROPE }}>{error}</p>}
            </div>

            <footer style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', background: 'rgba(255,255,255,0.015)' }}>
              <span style={{ color: '#777365', fontSize: 11.5, lineHeight: 1.4, fontFamily: MANROPE }}>Paso {step + 1} de 3</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 9, flexShrink: 0 }}>
                {step > 0 && <button type="button" onClick={() => setStep((current) => (current - 1) as ProposalStep)} disabled={isLoading} style={{ height: 40, padding: '0 14px', borderRadius: 9, color: '#C8BFAE', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}><ArrowLeft size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />Anterior</button>}
                {step === 0 && <button type="button" onClick={handleClose} disabled={isLoading} style={{ height: 40, padding: '0 15px', borderRadius: 9, color: '#C8BFAE', background: 'rgba(255,255,255,0.035)', border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontSize: 12.5, fontWeight: 600, fontFamily: MANROPE }}>{t.btn_cancel}</button>}
                <button type="submit" disabled={!projectWorkspaces.length || (step === 0 && projectWorkspaces.length > 1 && !selectedWorkspaceId) || (step === 2 && !canSubmit)} className="create-project-action" style={{ height: 40, minWidth: 130, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '0 15px', borderRadius: 9, color: '#20150E', background: PROJECT_COLOR, border: 0, cursor: !projectWorkspaces.length || (step === 0 && projectWorkspaces.length > 1 && !selectedWorkspaceId) || (step === 2 && !canSubmit) ? 'not-allowed' : 'pointer', opacity: !projectWorkspaces.length || (step === 0 && projectWorkspaces.length > 1 && !selectedWorkspaceId) || (step === 2 && !canSubmit) ? 0.4 : 1, fontSize: 12.5, fontWeight: 700, fontFamily: SORA }}>
                  {isLoading ? <><span style={{ width: 13, height: 13, borderRadius: '50%', border: '2px solid rgba(32,21,14,0.3)', borderTopColor: '#20150E', animation: 'createProjectSpin 650ms linear infinite' }} />{t.btn_creating}</> : step === 2 ? <><Plus size={15} strokeWidth={2.2} />Crear proyecto</> : <>Continuar<ArrowRight size={14} /></>}
                </button>
              </div>
            </footer>
          </form>
        </section>
      </div>
    </>
  );
}
