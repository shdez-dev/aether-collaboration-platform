'use client';

import { FormEvent, type CSSProperties, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ClipboardCheck, FolderKanban, Plus, RefreshCw, ShieldCheck } from 'lucide-react';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { Initiative, InitiativeStage, useInitiativeStore } from '@/stores/initiativeStore';

const stages: Array<{ value: InitiativeStage; label: string; color: string }> = [
  { value: 'SUBMITTED', label: 'Recibidas', color: '#94a3b8' }, { value: 'TRIAGE', label: 'Triage', color: '#60a5fa' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico', color: '#a78bfa' }, { value: 'VALIDATION', label: 'Validación', color: '#fbbf24' },
  { value: 'APPROVED', label: 'Aprobadas', color: '#4ade80' }, { value: 'PAUSED', label: 'En pausa', color: '#fb923c' },
  { value: 'DECLINED', label: 'No continúan', color: '#f87171' }, { value: 'ARCHIVED', label: 'Archivadas', color: '#64748b' },
];
const stageMeta = (stage: InitiativeStage) => stages.find((item) => item.value === stage) ?? stages[0];
const priorities: Record<string, string> = { LOW: '#94a3b8', MEDIUM: '#60a5fa', HIGH: '#fb923c', URGENT: '#f87171' };

function date(value?: string | null) { return value ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(value)) : 'Sin fecha'; }

export default function InitiativesPage() {
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const { initiatives, loading, error, fetchInitiatives, createInitiative, transition, convert } = useInitiativeStore();
  const [filter, setFilter] = useState<InitiativeStage | 'ALL'>('ALL');
  const [creating, setCreating] = useState(false); const [selected, setSelected] = useState<Initiative | null>(null);
  const [transitionStage, setTransitionStage] = useState<InitiativeStage>('TRIAGE'); const [reason, setReason] = useState('');

  useEffect(() => { if (activeWorkspaceId) fetchInitiatives(activeWorkspaceId); }, [activeWorkspaceId, fetchInitiatives]);
  useEffect(() => { if (selected) { setTransitionStage(selected.stage); setReason(selected.decisionReason ?? ''); } }, [selected]);
  const visible = useMemo(() => filter === 'ALL' ? initiatives : initiatives.filter((item) => item.stage === filter), [filter, initiatives]);
  const counts = useMemo(() => Object.fromEntries(stages.map(({ value }) => [value, initiatives.filter((item) => item.stage === value).length])), [initiatives]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!activeWorkspaceId) return;
    const form = new FormData(e.currentTarget);
    const created = await createInitiative({ workspaceId: activeWorkspaceId, title: String(form.get('title')), description: String(form.get('description') || '') || null, problemStatement: String(form.get('problem') || '') || null, proposedNextStep: String(form.get('nextStep') || '') || null, priority: String(form.get('priority')) as Initiative['priority'], nextReviewAt: form.get('review') ? new Date(String(form.get('review'))).toISOString() : null });
    if (created) setCreating(false);
  }
  async function submitTransition(e: FormEvent) { e.preventDefault(); if (!selected) return; const next = await transition(selected.id, { stage: transitionStage, reason: reason || undefined, decision: transitionStage === 'APPROVED' ? 'APPROVED' : undefined }); if (next) setSelected({ ...selected, ...next }); }
  async function formalize() { if (!selected) return; const result = await convert(selected.id); if (result) setSelected({ ...selected, formalizedProjectId: result.projectId }); }

  if (!activeWorkspaceId) return <main style={page}><section style={empty}><FolderKanban size={32} /><h1>Selecciona un espacio de trabajo</h1><p>Las iniciativas pertenecen a un espacio institucional concreto.</p></section></main>;
  return <main style={page}>
    <header style={header}><div><p style={eyebrow}>ENTORNO INSTITUCIONAL</p><h1 style={title}>Iniciativas</h1><p style={subtitle}>Propuestas en evaluación. Los proyectos comienzan solo después de una aprobación trazable.</p></div><div style={{ display: 'flex', gap: 10 }}><Link href="/dashboard/projects" style={secondaryButton}><FolderKanban size={16} /> Ver proyectos</Link><button onClick={() => setCreating(true)} style={primaryButton}><Plus size={17} /> Nueva iniciativa</button></div></header>
    <section style={guidance}><ShieldCheck size={18} color="#60a5fa" /><span><strong>Bandeja de triage.</strong> Prioriza, asigna responsables y registra una decisión antes de llevar una iniciativa a ejecución.</span></section>
    <nav style={tabs}><button onClick={() => setFilter('ALL')} style={filter === 'ALL' ? tabActive : tab}>Todas <b>{initiatives.length}</b></button>{stages.slice(0, 6).map((item) => <button key={item.value} onClick={() => setFilter(item.value)} style={filter === item.value ? tabActive : tab}>{item.label} <b>{counts[item.value]}</b></button>)}</nav>
    {error && <p style={{ color: '#fca5a5' }}>{error}</p>}
    <section style={grid}>{loading ? <div style={empty}><RefreshCw className="animate-spin" /> Cargando iniciativas…</div> : visible.length === 0 ? <div style={empty}><ClipboardCheck size={28} /><strong>No hay iniciativas en esta vista.</strong><span>Recibe una propuesta o ajusta el filtro.</span></div> : visible.map((initiative) => <button key={initiative.id} onClick={() => setSelected(initiative)} style={card}>
      <div style={cardTop}><span style={{ ...pill, color: stageMeta(initiative.stage).color, borderColor: `${stageMeta(initiative.stage).color}66` }}>{stageMeta(initiative.stage).label}</span><span style={{ color: priorities[initiative.priority], fontSize: 12, fontWeight: 800 }}>{initiative.priority}</span></div>
      <h2 style={cardTitle}>{initiative.title}</h2><p style={cardText}>{initiative.problemStatement || initiative.description || 'Sin problema declarado todavía.'}</p>
      <div style={cardMeta}><span>Responsable: {initiative.triageOwner?.name ?? 'Por asignar'}</span><span>Revisión: {date(initiative.nextReviewAt)}</span></div>
      <div style={nextStep}><ArrowRight size={14} /> {initiative.proposedNextStep || 'Definir siguiente paso'}</div>
    </button>)}</section>
    {creating && <div style={overlay}><form onSubmit={submit} style={modal}><div style={modalHeader}><div><p style={eyebrow}>SOLICITUD</p><h2 style={{ margin: 0 }}>Nueva iniciativa</h2></div><button type="button" onClick={() => setCreating(false)} style={close}>×</button></div><label style={label}>Título<input name="title" required minLength={3} style={input} placeholder="¿Qué propuesta necesita evaluación?" /></label><label style={label}>Problema u oportunidad<textarea name="problem" style={textarea} placeholder="Qué ocurre, a quién afecta y por qué importa." /></label><label style={label}>Evidencia inicial<textarea name="description" style={textarea} placeholder="Datos, contexto o antecedentes disponibles." /></label><label style={label}>Siguiente paso propuesto<input name="nextStep" style={input} placeholder="Ej.: entrevista con usuarios" /></label><div style={{ display: 'flex', gap: 12 }}><label style={{ ...label, flex: 1 }}>Prioridad<select name="priority" defaultValue="MEDIUM" style={input}>{Object.keys(priorities).map((item) => <option key={item}>{item}</option>)}</select></label><label style={{ ...label, flex: 1 }}>Revisión<input name="review" type="date" style={input} /></label></div><div style={actions}><button type="button" onClick={() => setCreating(false)} style={secondaryButton}>Cancelar</button><button style={primaryButton}>Enviar a triage</button></div></form></div>}
    {selected && <div style={overlay}><aside style={drawer}><div style={modalHeader}><div><p style={eyebrow}>{stageMeta(selected.stage).label}</p><h2 style={{ margin: 0 }}>{selected.title}</h2></div><button onClick={() => setSelected(null)} style={close}>×</button></div><section style={detail}><h3>Problema</h3><p>{selected.problemStatement || 'Aún no declarado.'}</p><h3>Evidencia</h3><p>{selected.description || selected.evidence?.map((item) => item.title).join(', ') || 'Aún no adjunta.'}</p><h3>Siguiente paso</h3><p>{selected.proposedNextStep || 'Pendiente de definición.'}</p><div style={detailGrid}><span>Solicitante<strong>{selected.requester?.name ?? 'Interno'}</strong></span><span>Responsable<strong>{selected.triageOwner?.name ?? 'Por asignar'}</strong></span><span>Mentor<strong>{selected.mentor?.name ?? 'Sin mentor'}</strong></span><span>Revisión<strong>{date(selected.nextReviewAt)}</strong></span></div></section>
      <form onSubmit={submitTransition} style={transitionBox}><strong>Decisión y etapa</strong><select value={transitionStage} onChange={(e) => setTransitionStage(e.target.value as InitiativeStage)} style={input}>{stages.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><textarea value={reason} onChange={(e) => setReason(e.target.value)} style={textarea} placeholder="Motivo de la decisión o próximo paso" /><button style={primaryButton}>Registrar cambio</button></form>
      {selected.stage === 'APPROVED' && !selected.formalizedProjectId && <button onClick={formalize} style={{ ...primaryButton, width: '100%', justifyContent: 'center', background: '#22c55e' }}>Convertir en proyecto</button>}
      {selected.formalizedProjectId && <Link href={`/dashboard/projects/${selected.formalizedProjectId}`} style={{ ...secondaryButton, justifyContent: 'center' }}>Abrir proyecto formalizado <ArrowRight size={16} /></Link>}
    </aside></div>}
  </main>;
}

const page: CSSProperties = { minHeight: '100%', padding: '40px clamp(20px, 4vw, 64px)', color: '#f8fafc', background: '#12172a', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end', marginBottom: 24, flexWrap: 'wrap' };
const title: CSSProperties = { margin: '4px 0 8px', fontSize: 'clamp(32px, 4vw, 46px)', letterSpacing: '-.05em' };
const subtitle: CSSProperties = { margin: 0, color: '#a6afc5', maxWidth: 650, lineHeight: 1.6 }; const eyebrow: CSSProperties = { margin: 0, color: '#f97316', fontWeight: 800, fontSize: 11, letterSpacing: '.1em' };
const primaryButton: CSSProperties = { border: 0, borderRadius: 9, background: '#f2571e', color: '#1c1320', padding: '11px 15px', display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 800, cursor: 'pointer', textDecoration: 'none' };
const secondaryButton: CSSProperties = { border: '1px solid #303850', borderRadius: 9, background: '#1b2137', color: '#e5e7eb', padding: '10px 14px', display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' };
const guidance: CSSProperties = { display: 'flex', gap: 10, alignItems: 'center', background: '#19213a', border: '1px solid #2d3a5c', borderRadius: 10, padding: '13px 16px', color: '#cbd5e1', marginBottom: 20, lineHeight: 1.4 };
const tabs: CSSProperties = { display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 12, marginBottom: 8 };
const tab: CSSProperties = { border: '1px solid #303850', background: 'transparent', borderRadius: 20, color: '#a6afc5', padding: '8px 12px', whiteSpace: 'nowrap', cursor: 'pointer' }; const tabActive: CSSProperties = { ...tab, borderColor: '#f2571e', color: '#fff0e9', background: 'rgba(242,87,30,.12)' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 14 }; const card: CSSProperties = { textAlign: 'left', border: '1px solid #29314a', background: '#181e33', color: '#eef2ff', borderRadius: 12, padding: 17, cursor: 'pointer', minHeight: 220 };
const cardTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', marginBottom: 16 }; const pill: CSSProperties = { border: '1px solid', borderRadius: 16, padding: '4px 8px', fontSize: 11, fontWeight: 800 }; const cardTitle: CSSProperties = { margin: '0 0 8px', fontSize: 17 }; const cardText: CSSProperties = { color: '#aeb8cb', margin: 0, lineHeight: 1.5, minHeight: 46, fontSize: 13 }; const cardMeta: CSSProperties = { display: 'grid', gap: 5, color: '#8290a9', fontSize: 12, margin: '16px 0 12px' }; const nextStep: CSSProperties = { display: 'flex', gap: 7, alignItems: 'center', color: '#f9b38f', fontSize: 12, fontWeight: 700 };
const empty: CSSProperties = { minHeight: 230, gridColumn: '1 / -1', border: '1px dashed #37415b', borderRadius: 12, color: '#a6afc5', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, textAlign: 'center' }; const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(8,11,22,.72)', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 20 }; const modal: CSSProperties = { background: '#1a2138', border: '1px solid #384361', borderRadius: 14, padding: 22, maxWidth: 600, width: '100%', display: 'grid', gap: 14, maxHeight: '90vh', overflowY: 'auto' }; const drawer: CSSProperties = { ...modal, maxWidth: 580, marginLeft: 'auto', height: '100%', maxHeight: '100%', borderRadius: 0, justifyContent: 'start' }; const modalHeader: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'start', gap: 14 }; const close: CSSProperties = { border: 0, background: 'transparent', color: '#a6afc5', fontSize: 26, cursor: 'pointer' }; const label: CSSProperties = { display: 'grid', gap: 7, color: '#bac4d7', fontSize: 12, fontWeight: 700 }; const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#11172a', border: '1px solid #36415c', borderRadius: 8, color: '#f8fafc', padding: '10px 11px', marginTop: 4 }; const textarea: CSSProperties = { ...input, minHeight: 74, resize: 'vertical', fontFamily: 'inherit' }; const actions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 }; const detail: CSSProperties = { color: '#c5cede', lineHeight: 1.55 }; const detailGrid: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 18 }; const transitionBox: CSSProperties = { display: 'grid', gap: 10, padding: 14, background: '#12182b', border: '1px solid #35415e', borderRadius: 10, marginTop: 16 };
