'use client';

import Link from 'next/link';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, BarChart3, ClipboardList, FolderKanban, PauseCircle, RefreshCw, ShieldAlert, TimerReset } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import type { InitiativeStage } from '@/stores/initiativeStore';

type StageCount = { stage: InitiativeStage; count: number | string };
type StageDuration = { stage: InitiativeStage; average_days: number | string | null };
type InitiativeReport = {
  received: number | string;
  approved: number | string;
  paused: number | string;
  without_followup: number | string;
  formalized: number | string;
  byStage: StageCount[];
  timeByStage: StageDuration[];
};

const STAGES: Array<{ value: InitiativeStage; label: string; color: string }> = [
  { value: 'SUBMITTED', label: 'Recibidas', color: '#94a3b8' },
  { value: 'TRIAGE', label: 'Triage', color: '#60a5fa' },
  { value: 'DIAGNOSIS', label: 'Diagnóstico', color: '#a78bfa' },
  { value: 'VALIDATION', label: 'Validación', color: '#fbbf24' },
  { value: 'APPROVED', label: 'Aprobadas', color: '#4ade80' },
  { value: 'PAUSED', label: 'En pausa', color: '#fb923c' },
  { value: 'DECLINED', label: 'No continúan', color: '#f87171' },
  { value: 'ARCHIVED', label: 'Archivadas', color: '#64748b' },
];

function number(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function duration(value: number | string | null | undefined): string {
  const days = number(value);
  return days > 0 ? `${days.toLocaleString('es-CL', { maximumFractionDigits: 1 })} días` : 'Sin datos aún';
}

export default function InitiativeReportsPage() {
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const [report, setReport] = useState<InitiativeReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeWorkspaceId) return;
    setLoading(true);
    setError(null);
    setReport(null);
    const response = await apiService.get<InitiativeReport>(`/api/initiatives/reports?workspaceId=${encodeURIComponent(activeWorkspaceId)}`, true);
    if (!response.success || !response.data) {
      setError(response.error?.message ?? 'No fue posible cargar los reportes institucionales.');
      setLoading(false);
      return;
    }
    setReport(response.data);
    setLoading(false);
  }, [activeWorkspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const stageCounts = useMemo(() => {
    const counts = new Map(report?.byStage.map((item) => [item.stage, number(item.count)]) ?? []);
    return STAGES.map((stage) => ({ ...stage, count: counts.get(stage.value) ?? 0 }));
  }, [report]);
  const stageDurations = useMemo(() => {
    const durations = new Map(report?.timeByStage.map((item) => [item.stage, item.average_days]) ?? []);
    return STAGES.map((stage) => ({ ...stage, averageDays: durations.get(stage.value) ?? null }));
  }, [report]);
  const maxStageCount = Math.max(1, ...stageCounts.map((stage) => stage.count));

  if (!activeWorkspaceId) {
    return <main style={page}><section style={empty}><ShieldAlert size={30} /><h1>Selecciona un espacio de trabajo</h1><p>Los reportes se calculan para un espacio institucional concreto.</p></section></main>;
  }

  return <main style={page}>
    <header style={header}>
      <div>
        <p style={eyebrow}>ENTORNO INSTITUCIONAL</p>
        <h1 style={title}>Reportes de iniciativas</h1>
        <p style={subtitle}>Salud de la bandeja de triage y conversión de propuestas a proyectos.</p>
      </div>
      <div style={headerActions}>
        <Link href="/dashboard/initiatives" style={secondaryButton}><ArrowLeft size={16} /> Volver a iniciativas</Link>
        <button type="button" style={primaryButton} onClick={() => void load()} disabled={loading}><RefreshCw size={16} className={loading ? 'animate-spin' : undefined} /> Actualizar</button>
      </div>
    </header>

    {loading && <section style={empty}><RefreshCw size={26} className="animate-spin" /><strong>Calculando indicadores…</strong></section>}
    {!loading && error && <section style={errorBox}><ShieldAlert size={22} /><div><strong>No se muestran datos sin autorización.</strong><p>{error}</p></div><button type="button" style={secondaryButton} onClick={() => void load()}>Reintentar</button></section>}
    {!loading && !error && report && <>
      <section style={metricsGrid} aria-label="Indicadores institucionales">
        <Metric icon={<ClipboardList size={20} />} label="Recibidas" value={number(report.received)} help="Propuestas registradas en este espacio." color="#60a5fa" />
        <Metric icon={<BarChart3 size={20} />} label="Aprobadas" value={number(report.approved)} help="Listas para formalizar o ejecutar." color="#4ade80" />
        <Metric icon={<PauseCircle size={20} />} label="En pausa" value={number(report.paused)} help="Requieren una revisión o decisión." color="#fb923c" />
        <Metric icon={<TimerReset size={20} />} label="Sin seguimiento" value={number(report.without_followup)} help="Activas sin fecha de próxima revisión." color="#f87171" />
        <Metric icon={<FolderKanban size={20} />} label="Formalizadas" value={number(report.formalized)} help="Ya convertidas en proyectos." color="#a78bfa" />
      </section>

      <section style={sections}>
        <article style={panel}>
          <div style={panelHeader}><div><h2 style={panelTitle}>Distribución por etapa</h2><p style={panelSubtitle}>Muestra dónde se concentra la carga de evaluación.</p></div><BarChart3 size={20} color="#60a5fa" /></div>
          <div style={rows}>
            {stageCounts.map((stage) => <div key={stage.value} style={stageRow}>
              <span style={stageName}><i style={{ ...dot, background: stage.color }} />{stage.label}</span>
              <div style={barTrack}><div style={{ ...bar, width: `${(stage.count / maxStageCount) * 100}%`, background: stage.color }} /></div>
              <strong style={count}>{stage.count}</strong>
            </div>)}
          </div>
        </article>
        <article style={panel}>
          <div style={panelHeader}><div><h2 style={panelTitle}>Tiempo promedio por etapa</h2><p style={panelSubtitle}>Calculado a partir del historial de cambios de etapa.</p></div><TimerReset size={20} color="#fbbf24" /></div>
          <div style={durationGrid}>
            {stageDurations.map((stage) => <div key={stage.value} style={durationCard}><span style={{ ...durationLabel, color: stage.color }}>{stage.label}</span><strong style={durationValue}>{duration(stage.averageDays)}</strong></div>)}
          </div>
        </article>
      </section>
    </>}
  </main>;
}

function Metric({ icon, label, value, help, color }: { icon: ReactNode; label: string; value: number; help: string; color: string }) {
  return <article style={metric}><span style={{ ...metricIcon, color, borderColor: `${color}55` }}>{icon}</span><div><p style={metricLabel}>{label}</p><strong style={metricValue}>{value.toLocaleString('es-CL')}</strong><p style={metricHelp}>{help}</p></div></article>;
}

const page: CSSProperties = { minHeight: '100%', padding: '40px clamp(20px, 4vw, 64px)', color: 'var(--c-text)', background: 'var(--c-bg)', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 24, alignItems: 'flex-end', marginBottom: 28, flexWrap: 'wrap' };
const headerActions: CSSProperties = { display: 'flex', gap: 10, flexWrap: 'wrap' };
const title: CSSProperties = { margin: '4px 0 8px', fontSize: 'clamp(32px, 4vw, 46px)', letterSpacing: '-.05em' };
const subtitle: CSSProperties = { margin: 0, color: 'var(--c-text3)', maxWidth: 620, lineHeight: 1.6 };
const eyebrow: CSSProperties = { margin: 0, color: 'var(--c-accent-text)', fontWeight: 800, fontSize: 11, letterSpacing: '.1em' };
const primaryButton: CSSProperties = { border: 0, borderRadius: 9, background: '#7452A6', color: '#FFFFFF', padding: '11px 15px', display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 800, cursor: 'pointer' };
const secondaryButton: CSSProperties = { border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface)', color: 'var(--c-text)', padding: '10px 14px', display: 'inline-flex', gap: 8, alignItems: 'center', fontWeight: 700, cursor: 'pointer', textDecoration: 'none' };
const empty: CSSProperties = { minHeight: 230, border: '1px dashed var(--c-border2)', borderRadius: 12, color: 'var(--c-text3)', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 10, textAlign: 'center' };
const errorBox: CSSProperties = { border: '1px solid #8a343f', background: 'rgba(127, 29, 29, .18)', borderRadius: 12, padding: 18, color: '#9F455F', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' };
const metricsGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(195px, 1fr))', gap: 14, marginBottom: 18 };
const metric: CSSProperties = { display: 'flex', gap: 12, alignItems: 'flex-start', border: '1px solid var(--c-border2)', borderRadius: 12, padding: 16, background: 'var(--c-bg2)' };
const metricIcon: CSSProperties = { display: 'grid', placeItems: 'center', width: 39, height: 39, border: '1px solid', borderRadius: 10, background: 'var(--c-bg)', flexShrink: 0 };
const metricLabel: CSSProperties = { margin: 0, color: 'var(--c-text2)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' };
const metricValue: CSSProperties = { display: 'block', fontSize: 29, margin: '3px 0 2px', letterSpacing: '-.04em' };
const metricHelp: CSSProperties = { margin: 0, color: 'var(--c-text3)', lineHeight: 1.4, fontSize: 12 };
const sections: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 18 };
const panel: CSSProperties = { border: '1px solid var(--c-border2)', borderRadius: 13, padding: 20, background: 'var(--c-bg2)', minWidth: 0 };
const panelHeader: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, borderBottom: '1px solid var(--c-border2)', paddingBottom: 15, marginBottom: 16 };
const panelTitle: CSSProperties = { margin: 0, fontSize: 17 };
const panelSubtitle: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text3)', lineHeight: 1.45, fontSize: 13 };
const rows: CSSProperties = { display: 'grid', gap: 12 };
const stageRow: CSSProperties = { display: 'grid', gridTemplateColumns: 'minmax(105px, .9fr) minmax(80px, 2fr) 30px', gap: 10, alignItems: 'center' };
const stageName: CSSProperties = { display: 'flex', alignItems: 'center', gap: 7, color: 'var(--c-text2)', fontSize: 12, fontWeight: 700 };
const dot: CSSProperties = { width: 8, height: 8, borderRadius: 99, flexShrink: 0 };
const barTrack: CSSProperties = { height: 7, borderRadius: 99, background: 'var(--c-bg)', overflow: 'hidden' };
const bar: CSSProperties = { height: '100%', borderRadius: 99, minWidth: 0, transition: 'width .2s ease' };
const count: CSSProperties = { textAlign: 'right', fontSize: 13, color: 'var(--c-text)' };
const durationGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 };
const durationCard: CSSProperties = { border: '1px solid var(--c-border2)', background: 'var(--c-surface2)', borderRadius: 9, padding: 12, minWidth: 0 };
const durationLabel: CSSProperties = { display: 'block', fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.035em', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' };
const durationValue: CSSProperties = { display: 'block', marginTop: 5, color: 'var(--c-text)', fontSize: 14 };
