'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowLeft, ArrowRight, Check, ClipboardList, LoaderCircle } from 'lucide-react';
import { ProjectProposalFields, EMPTY_PROJECT_PROPOSAL, PROPOSAL_STEPS, type ProjectProposalAnswers, type ProposalStep } from '@/components/ProjectProposalFields';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useInitiativeStore } from '@/stores/initiativeStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';

const accent = '#7452A6';

export default function NewInstitutionalInitiativePage() {
  const router = useRouter();
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const workspaces = useWorkspaceStore((state) => state.workspaces);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const createInitiative = useInitiativeStore((state) => state.createInitiative);
  const storeError = useInitiativeStore((state) => state.error);
  const institutionalWorkspaces = workspaces.filter((workspace) => !workspace.archived && workspace.organization?.type === 'INSTITUTION');
  const [workspaceLoading, setWorkspaceLoading] = useState(true);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [proposal, setProposal] = useState<ProjectProposalAnswers>(EMPTY_PROJECT_PROPOSAL);
  const [step, setStep] = useState<ProposalStep>(0);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    let cancelled = false;
    void fetchWorkspaces().then(() => {
      if (cancelled) return;
      const available = useWorkspaceStore.getState().workspaces.filter((workspace) => !workspace.archived && workspace.organization?.type === 'INSTITUTION');
      const initial = available.find((workspace) => workspace.id === activeWorkspaceId) ?? (available.length === 1 ? available[0] : null);
      setSelectedWorkspaceId(initial?.id ?? '');
    }).finally(() => {
      if (!cancelled) setWorkspaceLoading(false);
    });
    return () => { cancelled = true; };
  }, [activeWorkspaceId, fetchWorkspaces]);

  const selectedWorkspace = institutionalWorkspaces.find((workspace) => workspace.id === selectedWorkspaceId);

  const updateProposal = (key: keyof ProjectProposalAnswers, value: string) => {
    setProposal((current) => ({ ...current, [key]: value }));
    setFormError('');
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (step < 2) {
      setStep((current) => (current + 1) as ProposalStep);
      return;
    }
    if (!selectedWorkspace) {
      setFormError('Selecciona un espacio de una organización institucional para recibir esta iniciativa.');
      return;
    }

    setSaving(true);
    setFormError('');
    const created = await createInitiative({
      workspaceId: selectedWorkspace.id,
      title: proposal.title.trim(),
      description: proposal.summary.trim(),
      problemStatement: proposal.problemStatement.trim(),
      impactedPeople: proposal.impactedPeople.trim(),
      problemImpact: proposal.problemImpact.trim(),
      impactedCount: Number(proposal.impactedCount),
      expectedOutcome: proposal.expectedOutcome.trim(),
      proposedSolution: proposal.proposedSolution.trim(),
      differentiation: proposal.differentiation.trim(),
    });
    setSaving(false);
    if (created) router.push(`/dashboard/initiatives/${created.id}`);
    else setFormError(storeError || 'No se pudo enviar la iniciativa. Revisa los datos e inténtalo otra vez.');
  }

  if (workspaceLoading) return <main style={page}><section style={stateCard}><LoaderCircle className="animate-spin" size={22} />Cargando espacio institucional…</section></main>;

  if (!institutionalWorkspaces.length) {
    return <main style={page}><section style={stateCard}><ClipboardList size={27} /><h1 style={stateTitle}>Esta pantalla es para organizaciones institucionales</h1><p style={stateCopy}>En organizaciones personales y de equipos, la propuesta se registra directamente al crear el proyecto.</p><Link href="/dashboard/projects" style={secondaryButton}><ArrowLeft size={15} /> Ir a proyectos</Link></section></main>;
  }

  return (
    <main style={page}>
      <div style={shell}>
        <Link href="/dashboard/initiatives" style={backLink}><ArrowLeft size={15} /> Volver a iniciativas</Link>

        <header style={header}>
          <p style={eyebrow}>PROPUESTA INSTITUCIONAL</p>
          <h1 style={title}>Nueva iniciativa</h1>
          <p style={subtitle}>Cuéntanos qué necesidad existe, a quién afecta y qué valor esperas generar.</p>
        </header>

        <div style={stepper} aria-label="Pasos de la iniciativa">
          {PROPOSAL_STEPS.map((item, index) => <div key={item.title} aria-current={index === step ? 'step' : undefined} style={{ ...stepItem, color: index === step ? 'var(--c-text)' : '#8D8A83' }}><span style={{ ...stepNumber, color: index <= step ? accent : '#8D8A83', borderColor: index <= step ? 'rgba(116,82,166,0.45)' : 'rgba(97,71,130,0.12)', background: index < step ? 'rgba(116,82,166,0.12)' : 'transparent' }}>{index < step ? <Check size={13} /> : `0${index + 1}`}</span>{item.title}</div>)}
        </div>

        <form onSubmit={submit} style={form}>
          <div style={workspacePicker}>
            <label htmlFor="initiative-workspace" style={workspaceLabel}>Espacio institucional</label>
            <select id="initiative-workspace" required value={selectedWorkspaceId} onChange={(event) => setSelectedWorkspaceId(event.target.value)} style={workspaceSelect}>
              <option value="" disabled>Selecciona dónde enviar la iniciativa</option>
              {institutionalWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
            </select>
          </div>
          <section style={questionnaire}>
            <p style={stepLabel}>PASO {String(step + 1).padStart(2, '0')} DE 03</p>
            <h2 style={sectionTitle}>{PROPOSAL_STEPS[step].title}</h2>
            <p style={sectionCopy}>{PROPOSAL_STEPS[step].description}</p>
            <div style={{ marginTop: 24 }}><ProjectProposalFields step={step} values={proposal} onChange={updateProposal} accent={accent} /></div>
            {(formError || storeError) && <p role="alert" style={errorText}>{formError || storeError}</p>}
          </section>

          <footer style={footer}>
            <span style={progressText}>Paso {step + 1} de 3</span>
            <div style={{ display: 'flex', gap: 9 }}>
              {step > 0 && <button type="button" onClick={() => setStep((current) => (current - 1) as ProposalStep)} disabled={saving} style={secondaryButton}><ArrowLeft size={14} /> Anterior</button>}
              {step === 0 && <Link href="/dashboard/initiatives" style={secondaryButton}>Cancelar</Link>}
              <button type="submit" disabled={saving || !selectedWorkspaceId} style={{ ...primaryButton, opacity: saving || !selectedWorkspaceId ? .55 : 1 }}>
                {saving ? <><LoaderCircle className="animate-spin" size={15} /> Enviando…</> : step === 2 ? <>Enviar a evaluación <ArrowRight size={15} /></> : <>Continuar <ArrowRight size={15} /></>}
              </button>
            </div>
          </footer>
        </form>
        <p style={footnote}>La iniciativa se guardará en este espacio y pasará por el proceso institucional de evaluación antes de convertirse en proyecto.</p>
      </div>
    </main>
  );
}

const page = { minHeight: '100%', padding: '28px clamp(16px, 4vw, 52px) 50px', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: "'Manrope', system-ui, sans-serif" } as const;
const shell = { width: '100%', maxWidth: 820, margin: '0 auto' } as const;
const backLink = { display: 'inline-flex', alignItems: 'center', gap: 7, color: 'var(--c-text3)', fontSize: 12, textDecoration: 'none', marginBottom: 22 } as const;
const header = { textAlign: 'center' as const, marginBottom: 24 };
const eyebrow = { margin: '0 0 8px', color: accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.13em' } as const;
const title = { margin: 0, fontFamily: "'Sora', system-ui, sans-serif", fontSize: 'clamp(28px, 4vw, 38px)', letterSpacing: '-0.045em' } as const;
const subtitle = { maxWidth: 580, margin: '9px auto 0', color: 'var(--c-text3)', fontSize: 13, lineHeight: 1.55 } as const;
const stepper = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', maxWidth: 650, margin: '0 auto 15px', borderBottom: '1px solid rgba(97,71,130,0.11)' } as const;
const stepItem = { minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, borderBottom: '2px solid transparent', fontSize: 12, fontWeight: 700 } as const;
const stepNumber = { width: 24, height: 24, display: 'grid', placeItems: 'center', border: '1px solid', borderRadius: 99, fontSize: 10, fontWeight: 800 } as const;
const form = { border: '1px solid rgba(97,71,130,0.1)', borderRadius: 15, background: 'var(--c-surface)', overflow: 'hidden', boxShadow: '0 20px 50px rgba(0,0,0,0.18)' } as const;
const workspacePicker = { display: 'grid', gap: 7, padding: '18px clamp(18px, 4vw, 34px) 0' } as const;
const workspaceLabel = { color: 'var(--c-text2)', fontSize: 11, fontWeight: 800, letterSpacing: '.06em', textTransform: 'uppercase' as const };
const workspaceSelect = { minHeight: 42, boxSizing: 'border-box' as const, padding: '0 12px', border: '1px solid rgba(97,71,130,0.11)', borderRadius: 9, background: 'var(--c-surface)', color: 'var(--c-text)', colorScheme: 'light' as const, fontFamily: "'Manrope', system-ui, sans-serif", fontSize: 12.5 };
const questionnaire = { padding: '24px clamp(18px, 4vw, 34px) 28px' } as const;
const stepLabel = { margin: 0, color: accent, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em' } as const;
const sectionTitle = { margin: '7px 0 0', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 21, letterSpacing: '-0.03em' } as const;
const sectionCopy = { margin: '5px 0 0', color: 'var(--c-text2)', fontSize: 12.5 } as const;
const footer = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '14px clamp(18px, 4vw, 34px)', borderTop: '1px solid rgba(97,71,130,0.08)', background: 'rgba(97,71,130,0.015)' } as const;
const progressText = { color: 'var(--c-text3)', fontSize: 11 } as const;
const primaryButton = { minHeight: 39, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 15px', border: 0, borderRadius: 9, background: accent, color: '#FFFFFF', fontSize: 12, fontWeight: 800, cursor: 'pointer', textDecoration: 'none' } as const;
const secondaryButton = { minHeight: 39, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '0 13px', border: '1px solid rgba(97,71,130,0.11)', borderRadius: 9, background: 'rgba(97,71,130,0.025)', color: 'var(--c-text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textDecoration: 'none' } as const;
const errorText = { margin: '15px 0 0', padding: '10px 12px', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, background: 'rgba(248,113,113,0.08)', color: '#9F455F', fontSize: 12 } as const;
const footnote = { margin: '13px 0 0', textAlign: 'center' as const, color: 'var(--c-text3)', fontSize: 11, lineHeight: 1.5 };
const stateCard = { maxWidth: 520, minHeight: 250, margin: '8vh auto', display: 'flex', flexDirection: 'column' as const, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 28, border: '1px solid rgba(97,71,130,0.1)', borderRadius: 14, background: 'var(--c-surface)', color: 'var(--c-text2)', textAlign: 'center' as const };
const stateTitle = { margin: 0, color: 'var(--c-text)', fontSize: 20, fontFamily: "'Sora', system-ui, sans-serif" };
const stateCopy = { maxWidth: 380, margin: 0, color: 'var(--c-text2)', fontSize: 13, lineHeight: 1.55 };
