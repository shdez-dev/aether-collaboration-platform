'use client';

import Link from 'next/link';
import { type CSSProperties, useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Building2, CheckCircle2, Loader2, Save, Settings2, ShieldAlert, UsersRound } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useTeamStore } from '@/stores/teamStore';
import { type WorkspaceProjectStandard, useWorkspaceStore } from '@/stores/workspaceStore';

type RequiredField = 'title' | 'description' | 'problemStatement' | 'proposedNextStep' | 'evidence' | 'attachments';

type InitiativeSettings = {
  workspace_id: string;
  initiative_team_id: string | null;
  active_standard_id: string | null;
  intake_enabled: boolean;
  triage_criteria: string[];
  review_cadence_days: number;
  required_initiative_fields: RequiredField[];
};

const REQUIRED_FIELDS: Array<{ value: RequiredField; label: string; help: string }> = [
  { value: 'title', label: 'Título', help: 'Identifica claramente la propuesta.' },
  { value: 'problemStatement', label: 'Problema u oportunidad', help: 'Explica por qué vale la pena evaluar la iniciativa.' },
  { value: 'proposedNextStep', label: 'Siguiente paso', help: 'Evita que una propuesta quede sin seguimiento.' },
  { value: 'description', label: 'Evidencia inicial', help: 'Contexto, datos o antecedentes disponibles.' },
  { value: 'evidence', label: 'Evidencia estructurada', help: 'Registros de evidencia dentro de la iniciativa.' },
  { value: 'attachments', label: 'Adjuntos', help: 'Documentos o enlaces de respaldo.' },
];

const FALLBACK_SETTINGS: InitiativeSettings = {
  workspace_id: '',
  initiative_team_id: null,
  active_standard_id: null,
  intake_enabled: true,
  triage_criteria: [],
  review_cadence_days: 7,
  required_initiative_fields: ['title', 'problemStatement', 'proposedNextStep'],
};

function normalizeSettings(settings: InitiativeSettings): InitiativeSettings {
  return {
    ...FALLBACK_SETTINGS,
    ...settings,
    triage_criteria: Array.isArray(settings.triage_criteria) ? settings.triage_criteria : [],
    required_initiative_fields: Array.isArray(settings.required_initiative_fields)
      ? settings.required_initiative_fields
      : FALLBACK_SETTINGS.required_initiative_fields,
  };
}

export default function InitiativeSettingsPage() {
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { teams, fetchTeams } = useTeamStore();
  const [settings, setSettings] = useState<InitiativeSettings | null>(null);
  const [standard, setStandard] = useState<WorkspaceProjectStandard | null>(null);
  const [criteriaText, setCriteriaText] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const workspace = useMemo(
    () => workspaces.find((item) => item.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  );
  const isInstitutional = workspace?.mode === 'INSTITUTIONAL';
  const workspaceTeams = useMemo(
    () => teams.filter((team) => team.workspaceId === activeWorkspaceId),
    [activeWorkspaceId, teams]
  );

  const load = useCallback(async () => {
    if (!activeWorkspaceId || !isInstitutional) {
      setSettings(null);
      setStandard(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    setNotice(null);
    const [settingsResponse, standardResponse] = await Promise.all([
      apiService.get<{ settings: InitiativeSettings }>(`/api/initiatives/settings/${activeWorkspaceId}`, true),
      apiService.get<{ standard: WorkspaceProjectStandard }>(`/api/workspaces/${activeWorkspaceId}/project-standard`, true),
      fetchTeams(activeWorkspaceId),
    ]);

    if (!settingsResponse.success || !settingsResponse.data) {
      setError(settingsResponse.error?.message || 'No fue posible cargar la configuración institucional.');
      setSettings(null);
      setStandard(null);
      setLoading(false);
      return;
    }

    const nextSettings = normalizeSettings(settingsResponse.data.settings);
    setSettings(nextSettings);
    setCriteriaText(nextSettings.triage_criteria.join('\n'));
    if (standardResponse.success && standardResponse.data) {
      setStandard(standardResponse.data.standard);
    } else {
      setStandard(null);
    }
    setLoading(false);
  }, [activeWorkspaceId, fetchTeams, isInstitutional]);

  useEffect(() => {
    if (!workspaces.length) void fetchWorkspaces();
  }, [fetchWorkspaces, workspaces.length]);

  useEffect(() => {
    void load();
  }, [load]);

  function updateSettings(patch: Partial<InitiativeSettings>) {
    setNotice(null);
    setSettings((current) => current ? { ...current, ...patch } : current);
  }

  function toggleRequiredField(field: RequiredField) {
    if (!settings) return;
    const selected = settings.required_initiative_fields.includes(field);
    if (selected && settings.required_initiative_fields.length === 1) {
      setError('La iniciativa debe exigir al menos un campo.');
      return;
    }
    setError(null);
    updateSettings({
      required_initiative_fields: selected
        ? settings.required_initiative_fields.filter((item) => item !== field)
        : [...settings.required_initiative_fields, field],
    });
  }

  async function save() {
    if (!activeWorkspaceId || !settings || !isInstitutional || saving) return;
    const criteria = criteriaText.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    if (criteria.some((item) => item.length > 300)) {
      setError('Cada criterio puede tener hasta 300 caracteres.');
      return;
    }
    if (!settings.required_initiative_fields.length) {
      setError('Selecciona al menos un campo obligatorio.');
      return;
    }

    setSaving(true);
    setError(null);
    setNotice(null);
    const response = await apiService.put<{ settings: InitiativeSettings }>(
      `/api/initiatives/settings/${activeWorkspaceId}`,
      {
        initiativeTeamId: settings.initiative_team_id,
        activeStandardId: standard?.id ?? settings.active_standard_id,
        intakeEnabled: settings.intake_enabled,
        triageCriteria: criteria,
        reviewCadenceDays: settings.review_cadence_days,
        requiredInitiativeFields: settings.required_initiative_fields,
      },
      true
    );
    setSaving(false);

    if (!response.success || !response.data) {
      setError(response.error?.message || 'No fue posible guardar la configuración.');
      return;
    }

    const nextSettings = normalizeSettings(response.data.settings);
    setSettings(nextSettings);
    setCriteriaText(nextSettings.triage_criteria.join('\n'));
    setNotice('Configuración institucional actualizada.');
  }

  if (!activeWorkspaceId || (!workspace && workspaces.length === 0) || loading) {
    return <main style={page}><section style={stateCard}><Loader2 size={28} style={{ animation: 'spin 1s linear infinite' }} /><strong>Cargando configuración institucional…</strong></section></main>;
  }

  if (!isInstitutional) {
    return <main style={page}><section style={stateCard}><ShieldAlert size={30} color="#f7b267" /><div><h1 style={stateTitle}>Este workspace no es institucional</h1><p style={stateCopy}>La recepción y el gobierno de iniciativas se habilitan únicamente en espacios institucionales. Cambia a un workspace institucional para configurar este flujo.</p></div><Link href="/dashboard/initiatives" style={secondaryButton}><ArrowLeft size={16} /> Volver a iniciativas</Link></section></main>;
  }

  if (error && !settings) {
    return <main style={page}><section style={stateCard}><ShieldAlert size={30} color="#f87171" /><div><h1 style={stateTitle}>Configuración no disponible</h1><p style={stateCopy}>{error}</p></div><button type="button" onClick={() => void load()} style={secondaryButton}>Reintentar</button></section></main>;
  }

  if (!settings) return null;

  return <main style={page}>
    <header style={header}>
      <div>
        <Link href="/dashboard/initiatives" style={backLink}><ArrowLeft size={15} /> Iniciativas</Link>
        <p style={eyebrow}>GOBIERNO INSTITUCIONAL</p>
        <h1 style={title}>Configuración de iniciativas</h1>
        <p style={subtitle}>Define cómo recibe y madura propuestas {workspace?.name ? `el workspace ${workspace.name}` : 'este workspace'}.</p>
      </div>
      <button type="button" onClick={() => void save()} disabled={saving} style={{ ...primaryButton, opacity: saving ? .7 : 1 }}>
        {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
        {saving ? 'Guardando…' : 'Guardar cambios'}
      </button>
    </header>

    {error && <div role="alert" style={errorBox}>{error}</div>}
    {notice && <div role="status" style={successBox}><CheckCircle2 size={16} /> {notice}</div>}

    <div style={grid}>
      <section style={panel}>
        <div style={panelTitle}><Building2 size={18} color="#f7b267" /><div><h2>Recepción y responsables</h2><p>Controla cuándo se aceptan propuestas y quién opera la bandeja.</p></div></div>
        <label style={switchRow}>
          <input type="checkbox" checked={settings.intake_enabled} onChange={(event) => updateSettings({ intake_enabled: event.target.checked })} style={{ accentColor: '#f2571e', width: 17, height: 17 }} />
          <span><strong>Recepción de iniciativas habilitada</strong><small>Al desactivarla, no se pueden crear nuevas iniciativas en este workspace.</small></span>
        </label>
        <label style={field}><span>Equipo de iniciativas</span><select value={settings.initiative_team_id ?? ''} onChange={(event) => updateSettings({ initiative_team_id: event.target.value || null })} style={input}><option value="">Sin equipo coordinador</option>{workspaceTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><small>Los administradores de este equipo pueden coordinar el triage.</small></label>
        {!workspaceTeams.length && <p style={hint}><UsersRound size={15} /> Aún no hay equipos en este workspace. Crea uno antes de delegar el triage.</p>}
      </section>

      <section style={panel}>
        <div style={panelTitle}><Settings2 size={18} color="#8ab4f8" /><div><h2>Estándar y revisión</h2><p>La formalización usa el estándar activo del workspace.</p></div></div>
        <label style={field}><span>Estándar activo</span><div style={readOnlyField}>{standard?.id ? <><strong>{standard.name}</strong><small>Versión {standard.version}</small></> : <span>Sin estándar activo</span>}</div><small>Para cambiarlo, actualiza el estándar del workspace. Esta pantalla sólo referencia el estándar activo.</small></label>
        <label style={field}><span>Cadencia de revisión</span><div style={inlineField}><input type="number" min={1} max={365} value={settings.review_cadence_days} onChange={(event) => updateSettings({ review_cadence_days: Math.max(1, Math.min(365, Number(event.target.value) || 1)) })} style={{ ...input, maxWidth: 110 }} /><span>días</span></div><small>Las nuevas iniciativas reciben una fecha de revisión con esta frecuencia.</small></label>
      </section>

      <section style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={panelTitle}><CheckCircle2 size={18} color="#74c69d" /><div><h2>Campos obligatorios</h2><p>Una propuesta debe contener esta información antes de entrar a triage.</p></div></div>
        <div style={checkboxGrid}>{REQUIRED_FIELDS.map((fieldItem) => <label key={fieldItem.value} style={checkCard}><input type="checkbox" checked={settings.required_initiative_fields.includes(fieldItem.value)} onChange={() => toggleRequiredField(fieldItem.value)} style={{ accentColor: '#f2571e', width: 16, height: 16, marginTop: 2 }} /><span><strong>{fieldItem.label}</strong><small>{fieldItem.help}</small></span></label>)}</div>
      </section>

      <section style={{ ...panel, gridColumn: '1 / -1' }}>
        <div style={panelTitle}><Settings2 size={18} color="#c4a7e7" /><div><h2>Criterios de triage</h2><p>Registra una pregunta o criterio por línea. El equipo los usa al evaluar cada propuesta.</p></div></div>
        <textarea value={criteriaText} onChange={(event) => { setCriteriaText(event.target.value); setNotice(null); }} style={textarea} placeholder={'Ej.: ¿Existe evidencia del problema?\nEj.: ¿Hay un responsable disponible para la siguiente etapa?'} />
        <p style={hint}>Los criterios no reemplazan una decisión: cada cambio de etapa conserva su motivo y responsable.</p>
      </section>
    </div>
  </main>;
}

const page: CSSProperties = { minHeight: '100%', padding: '40px clamp(20px, 4vw, 64px)', background: '#12172a', color: '#f8fafc', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 20, flexWrap: 'wrap', marginBottom: 26 };
const eyebrow: CSSProperties = { margin: '18px 0 5px', color: '#f2571e', fontSize: 11, letterSpacing: '.1em', fontWeight: 800 };
const title: CSSProperties = { margin: 0, fontSize: 'clamp(30px, 4vw, 42px)', letterSpacing: '-.045em' };
const subtitle: CSSProperties = { maxWidth: 680, margin: '8px 0 0', color: '#aeb8cb', lineHeight: 1.55 };
const backLink: CSSProperties = { display: 'inline-flex', gap: 6, alignItems: 'center', color: '#b8c6de', fontSize: 13, textDecoration: 'none', fontWeight: 700 };
const primaryButton: CSSProperties = { border: 0, borderRadius: 9, padding: '11px 15px', background: '#f2571e', color: '#1c1320', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 800 };
const secondaryButton: CSSProperties = { border: '1px solid #35415e', borderRadius: 9, padding: '10px 14px', background: '#1a2138', color: '#e5e7eb', display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontWeight: 700, textDecoration: 'none', width: 'fit-content' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, maxWidth: 1160 };
const panel: CSSProperties = { padding: 20, border: '1px solid #303b59', borderRadius: 13, background: '#191f34', display: 'grid', alignContent: 'start', gap: 16 };
const panelTitle: CSSProperties = { display: 'flex', gap: 10, alignItems: 'flex-start' };
const field: CSSProperties = { display: 'grid', gap: 7, color: '#d7ddeb', fontSize: 13, fontWeight: 750 };
const input: CSSProperties = { boxSizing: 'border-box', width: '100%', border: '1px solid #394664', borderRadius: 8, padding: '10px 11px', background: '#101628', color: '#f8fafc', fontFamily: 'inherit', fontSize: 14 };
const textarea: CSSProperties = { ...input, minHeight: 140, resize: 'vertical', lineHeight: 1.55 };
const switchRow: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 10, padding: 13, border: '1px solid #35415e', borderRadius: 9, background: '#12182b', cursor: 'pointer' };
const checkCard: CSSProperties = { display: 'flex', gap: 10, padding: 12, border: '1px solid #35415e', borderRadius: 9, background: '#12182b', cursor: 'pointer', minHeight: 65 };
const checkboxGrid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 };
const inlineField: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, color: '#b5bfd1', fontWeight: 600 };
const readOnlyField: CSSProperties = { ...input, display: 'grid', gap: 3, minHeight: 40, color: '#cdd8ec', background: '#151c31' };
const hint: CSSProperties = { display: 'flex', gap: 7, alignItems: 'center', margin: 0, color: '#9cacC7', fontSize: 12, lineHeight: 1.45 };
const errorBox: CSSProperties = { maxWidth: 1160, margin: '0 0 16px', padding: '11px 13px', border: '1px solid #7f1d1d', borderRadius: 9, background: '#3a1d26', color: '#fecaca' };
const successBox: CSSProperties = { maxWidth: 1160, margin: '0 0 16px', padding: '11px 13px', border: '1px solid #275740', borderRadius: 9, background: '#17372b', color: '#bbf7d0', display: 'flex', gap: 8, alignItems: 'center' };
const stateCard: CSSProperties = { maxWidth: 650, minHeight: 230, margin: '8vh auto', padding: 26, border: '1px solid #35415e', borderRadius: 13, background: '#191f34', display: 'grid', placeItems: 'center', alignContent: 'center', gap: 16, textAlign: 'center' };
const stateTitle: CSSProperties = { margin: 0, fontSize: 22 };
const stateCopy: CSSProperties = { color: '#abb6ca', lineHeight: 1.55, margin: '8px 0 0' };
