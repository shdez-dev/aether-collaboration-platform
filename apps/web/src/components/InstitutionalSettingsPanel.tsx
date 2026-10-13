'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowDown, ArrowUp, Building2, Check, ChevronRight, LoaderCircle, Plus, Save, Settings2, Trash2 } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useTeamStore } from '@/stores/teamStore';
import styles from './InstitutionalSettingsPanel.module.css';

type Settings = {
  profile: { description: string; logoUrl: string; timezone: string; locale: 'es-CL' | 'es-ES' | 'en-US'; businessDays: number[] };
  membership: { invitationAuthority: 'OWNER_AND_ADMIN' | 'OWNER_ONLY'; allowedEmailDomains: string[] };
  requester: { label: string; defaultWorkspaceId: string | null; canSubmit: boolean; canEditAfterSubmission: boolean; canAttach: boolean; canInviteCollaborators: boolean; canWithdraw: boolean; maxOpenInitiatives: number; decisionVisibility: 'STATUS' | 'REASON' };
  governance: { mentorRequiredForValidation: boolean; separateApproverFromRequester: boolean; coordinatorCanApprove: boolean; leadRequiredForConversion: boolean };
  privacy: { allowExternalInitiativeAccess: boolean };
  communication: { notifyOnSubmission: boolean; notifyOnDecision: boolean };
  operations: { intakePaused: boolean };
};
type Section = 'identity' | 'people' | 'flow' | 'privacy' | 'communication' | 'programs' | 'history';
type Workspace = { id: string; name: string; archived: boolean; mode: string };
type ProgramSettings = { initiative_team_id: string | null; intake_enabled: boolean; triage_criteria: string[]; review_cadence_days: number; required_initiative_fields: string[]; active_standard_id: string | null };

const sections: Array<{ id: Section; label: string; hint: string }> = [
  { id: 'identity', label: 'Identidad', hint: 'Perfil y calendario' },
  { id: 'people', label: 'Personas', hint: 'Invitaciones y solicitantes' },
  { id: 'flow', label: 'Gobierno', hint: 'Decisiones y conversión' },
  { id: 'privacy', label: 'Privacidad', hint: 'Acceso externo' },
  { id: 'communication', label: 'Avisos', hint: 'Eventos del proceso' },
  { id: 'programs', label: 'Programas', hint: 'Reglas por espacio' },
  { id: 'history', label: 'Historial', hint: 'Cambios de reglas' },
];
const sectionLabels: Record<string, string> = { profile: 'Identidad', membership: 'Personas', requester: 'Solicitantes', governance: 'Gobierno', privacy: 'Privacidad', communication: 'Avisos', operations: 'Recepción' };
const weekdays = [{ id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mié' }, { id: 4, label: 'Jue' }, { id: 5, label: 'Vie' }, { id: 6, label: 'Sáb' }, { id: 0, label: 'Dom' }];
const fieldOptions = [
  ['title', 'Título'], ['description', 'Resumen'], ['problemStatement', 'Problema'],
  ['impactedPeople', 'Personas afectadas'], ['problemImpact', 'Impacto'],
  ['impactedCount', 'Cantidad estimada'], ['expectedOutcome', 'Resultado esperado'],
  ['proposedSolution', 'Solución propuesta'], ['differentiation', 'Diferenciación'],
  ['proposedNextStep', 'Siguiente paso'], ['evidence', 'Evidencia'], ['attachments', 'Adjuntos'],
] as const;
const coreFields = new Set(fieldOptions.slice(0, 9).map(([value]) => value));

function previewDate(locale: string, timezone: string) {
  try { return new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: timezone }).format(new Date()); }
  catch { return 'Revisa la zona horaria'; }
}

export function InstitutionalSettingsPanel({ organizationId, canManage, onInvitationAuthorityChange }: { organizationId: string; canManage: boolean; onInvitationAuthorityChange?: (value: Settings['membership']['invitationAuthority']) => void }) {
  const [section, setSection] = useState<Section>('people');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [domainsText, setDomainsText] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [workspaceId, setWorkspaceId] = useState('');
  const [program, setProgram] = useState<ProgramSettings | null>(null);
  const [programSaved, setProgramSaved] = useState('');
  const [programError, setProgramError] = useState('');
  const [programLoading, setProgramLoading] = useState(false);
  const [programSaving, setProgramSaving] = useState(false);
  const [history, setHistory] = useState<Array<{ id: string; createdAt: string; actorName: string; changedSections: string[] }>>([]);
  const [historyError, setHistoryError] = useState('');
  const [historyVersion, setHistoryVersion] = useState(0);
  const { teams, fetchTeams } = useTeamStore();
  const dirty = settings !== null && JSON.stringify(settings) !== saved;
  const programDirty = program !== null && JSON.stringify(program) !== programSaved;
  const workspaceTeams = useMemo(() => teams.filter((team) => team.workspaceId === workspaceId), [teams, workspaceId]);

  useEffect(() => {
    let active = true;
    setLoading(true); setError(''); setSettings(null); setProgram(null); setWorkspaceId('');
    void Promise.all([
      apiService.get<{ settings: Settings }>(`/api/organizations/${organizationId}/institutional-settings`, true),
      apiService.get<{ organization: { workspaces: Workspace[] } }>(`/api/organizations/${organizationId}`, true),
    ]).then(([settingsResponse, organizationResponse]) => {
      if (!active) return;
      if (!settingsResponse.success || !settingsResponse.data?.settings) throw new Error(settingsResponse.error?.message ?? 'No se pudo cargar la configuración institucional.');
      const value = settingsResponse.data.settings;
      setSettings(value); setSaved(JSON.stringify(value));
      onInvitationAuthorityChange?.(value.membership.invitationAuthority);
      setDomainsText(value.membership.allowedEmailDomains.join('\n'));
      const available = (organizationResponse.data?.organization?.workspaces ?? []).filter((workspace) => !workspace.archived && workspace.mode === 'INSTITUTIONAL');
      setWorkspaces(available); setWorkspaceId(available[0]?.id ?? '');
    }).catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la configuración.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, onInvitationAuthorityChange]);

  useEffect(() => {
    if (!workspaceId || !canManage) return;
    let active = true;
    setProgramLoading(true); setProgramError(''); setProgram(null);
    void Promise.all([
      apiService.get<{ settings: ProgramSettings }>(`/api/initiatives/settings/${workspaceId}`, true),
      fetchTeams(workspaceId),
    ]).then(([response]) => {
      if (!active) return;
      if (!response.success || !response.data?.settings) throw new Error(response.error?.message ?? 'No se pudo cargar el programa.');
      setProgram(response.data.settings); setProgramSaved(JSON.stringify(response.data.settings));
    }).catch((caught) => { if (active) setProgramError(caught instanceof Error ? caught.message : 'No se pudo cargar el programa.'); })
      .finally(() => { if (active) setProgramLoading(false); });
    return () => { active = false; };
  }, [workspaceId, canManage, fetchTeams]);

  useEffect(() => {
    if (section !== 'history' || !canManage) return;
    let active = true;
    void apiService.get<{ history: typeof history }>(`/api/organizations/${organizationId}/institutional-settings/history`, true).then((response) => {
      if (!active) return;
      if (response.success && response.data) { setHistory(response.data.history); setHistoryError(''); }
      else setHistoryError(response.error?.message ?? 'No se pudo cargar el historial.');
    });
    return () => { active = false; };
  }, [organizationId, section, canManage, historyVersion]);

  function change<K extends keyof Settings>(group: K, key: keyof Settings[K], value: unknown) {
    setSettings((current) => current ? { ...current, [group]: { ...current[group], [key]: value } } : current);
    setNotice('');
  }
  function changeProgram<K extends keyof ProgramSettings>(key: K, value: ProgramSettings[K]) {
    setProgram((current) => current ? { ...current, [key]: value } : current);
    setNotice('');
  }
  async function save() {
    if (!settings || !canManage || saving) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const domains = domainsText.split(/[\s,;]+/).map((item) => item.trim().toLowerCase()).filter(Boolean);
      const next = { ...settings, membership: { ...settings.membership, allowedEmailDomains: [...new Set(domains)] } };
      const response = await apiService.put<{ settings: Settings }>(`/api/organizations/${organizationId}/institutional-settings`, next, true);
      if (!response.success || !response.data?.settings) throw new Error(response.error?.message ?? 'No se pudieron guardar los cambios.');
      setSettings(response.data.settings); setSaved(JSON.stringify(response.data.settings));
      setHistoryVersion((version) => version + 1);
      onInvitationAuthorityChange?.(response.data.settings.membership.invitationAuthority);
      setDomainsText(response.data.settings.membership.allowedEmailDomains.join('\n'));
      setNotice('Configuración institucional guardada.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudieron guardar los cambios.'); }
    finally { setSaving(false); }
  }
  async function saveProgram() {
    if (!program || !workspaceId || !canManage || programSaving) return;
    setProgramSaving(true); setProgramError(''); setNotice('');
    try {
      const criteria = program.triage_criteria.map((item) => item.trim()).filter(Boolean);
      const response = await apiService.put<{ settings: ProgramSettings }>(`/api/initiatives/settings/${workspaceId}`, {
        initiativeTeamId: program.initiative_team_id,
        intakeEnabled: program.intake_enabled,
        triageCriteria: criteria,
        reviewCadenceDays: program.review_cadence_days,
        requiredInitiativeFields: program.required_initiative_fields,
      }, true);
      if (!response.success || !response.data?.settings) throw new Error(response.error?.message ?? 'No se pudo guardar el programa.');
      setProgram(response.data.settings); setProgramSaved(JSON.stringify(response.data.settings));
      setNotice('Reglas del programa guardadas.');
    } catch (caught) { setProgramError(caught instanceof Error ? caught.message : 'No se pudo guardar el programa.'); }
    finally { setProgramSaving(false); }
  }

  return <section className={styles.shell} aria-labelledby="institutional-settings-heading">
    <div className={styles.heading}>
      <span className={styles.headingIcon}><Settings2 size={20} /></span>
      <div><h2 id="institutional-settings-heading">Configuración institucional</h2><p>Reglas de acceso, gobierno y recepción para esta organización.</p></div>
    </div>
    {loading ? <p className={styles.state}><LoaderCircle size={17} className="animate-spin" /> Cargando configuración…</p> : error && !settings ? <p role="alert" className={styles.error}>{error}</p> : settings ? <div className={styles.layout}>
      <nav className={styles.nav} aria-label="Secciones institucionales">{sections.filter((item) => canManage || item.id !== 'programs').map((item) => <button type="button" key={item.id} className={section === item.id ? styles.navActive : ''} aria-current={section === item.id ? 'page' : undefined} onClick={() => setSection(item.id)}><span><strong>{item.label}</strong><small>{item.hint}</small></span><ChevronRight size={15} /></button>)}</nav>
      <div className={styles.content}>
        {section === 'identity' && <><h3>Identidad y calendario</h3><p className={styles.intro}>Datos que identifican a la institución y ordenan las fechas de revisión.</p>
          <div className={styles.profilePreview}>{settings.profile.logoUrl ? <img src={settings.profile.logoUrl} alt="Logo de la organización" /> : <Building2 size={22} />}<div><strong>Vista de la institución</strong><p>{settings.profile.description || 'Agrega una descripción breve para presentar a la organización.'}</p><small>Formato de fecha: {previewDate(settings.profile.locale, settings.profile.timezone)}</small></div></div>
          <div className={styles.fieldColumns}>
            <label className={styles.field}>Descripción<textarea value={settings.profile.description} disabled={!canManage} maxLength={2000} onChange={(event) => change('profile', 'description', event.target.value)} /></label>
            <label className={styles.field}>URL del logo<input type="url" value={settings.profile.logoUrl} disabled={!canManage} placeholder="https://…" onChange={(event) => change('profile', 'logoUrl', event.target.value)} /></label>
            <label className={styles.field}>Zona horaria<input value={settings.profile.timezone} disabled={!canManage} placeholder="America/Santiago" onChange={(event) => change('profile', 'timezone', event.target.value)} /></label>
            <label className={styles.field}>Idioma<select value={settings.profile.locale} disabled={!canManage} onChange={(event) => change('profile', 'locale', event.target.value)}><option value="es-CL">Español (Chile)</option><option value="es-ES">Español (España)</option><option value="en-US">English (US)</option></select></label>
          </div>
          <fieldset className={styles.group}><legend>Días de atención</legend><div className={styles.dayList}>{weekdays.map((day) => <label key={day.id}><input type="checkbox" disabled={!canManage} checked={settings.profile.businessDays.includes(day.id)} onChange={(event) => change('profile', 'businessDays', event.target.checked ? [...settings.profile.businessDays, day.id].sort() : settings.profile.businessDays.filter((value) => value !== day.id))} />{day.label}</label>)}</div></fieldset>
        </>}
        {section === 'people' && <><h3>Personas y solicitantes</h3><p className={styles.intro}>La membresía se gestiona en «Personas y accesos». Estas reglas se aplican a las invitaciones y a quien presenta iniciativas.</p>
          <h4 className={styles.groupTitle}>Invitaciones</h4>
          <div className={styles.fieldColumns}>
            <label className={styles.field}>Quién puede invitar<select value={settings.membership.invitationAuthority} disabled={!canManage} onChange={(event) => change('membership', 'invitationAuthority', event.target.value)}><option value="OWNER_AND_ADMIN">Propietario y administradores</option><option value="OWNER_ONLY">Solo propietario</option></select></label>
            <label className={styles.field}>Dominios de correo permitidos <small>Uno por línea. Vacío permite cualquier dominio.</small><textarea value={domainsText} disabled={!canManage} placeholder={'organizacion.org\nejemplo.cl'} onChange={(event) => { setDomainsText(event.target.value); change('membership', 'allowedEmailDomains', event.target.value.split(/[\s,;]+/).filter(Boolean)); }} /></label>
          </div>
          <h4 className={styles.groupTitle}>Presentación de iniciativas</h4>
          <div className={styles.fieldColumns}>
            <label className={styles.field}>Nombre del perfil que presenta iniciativas<input value={settings.requester.label} disabled={!canManage} maxLength={60} onChange={(event) => change('requester', 'label', event.target.value)} /><small>Por defecto, «Solicitante». Usa el nombre que corresponda a tu institución.</small></label>
            <label className={styles.field}>Espacio predeterminado para solicitantes<select value={settings.requester.defaultWorkspaceId ?? ''} disabled={!canManage || (workspaces.length === 0 && !settings.requester.defaultWorkspaceId)} onChange={(event) => change('requester', 'defaultWorkspaceId', event.target.value || null)}><option value="">Sin asignación automática</option>{settings.requester.defaultWorkspaceId && !workspaces.some((workspace) => workspace.id === settings.requester.defaultWorkspaceId) && <option value={settings.requester.defaultWorkspaceId}>Espacio no disponible — elige otro</option>}{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select><small>{workspaces.length === 0 ? 'Crea primero un espacio institucional para habilitar esta opción.' : 'Quienes acepten una invitación como miembro entrarán aquí automáticamente. No afecta a miembros actuales ni a administradores.'}</small></label>
            <label className={styles.field}>Máximo de iniciativas abiertas por persona y espacio<input type="number" min={0} max={100} value={settings.requester.maxOpenInitiatives} disabled={!canManage} onChange={(event) => change('requester', 'maxOpenInitiatives', Number(event.target.value))} /><small>0 significa sin límite.</small></label>
            <label className={styles.field}>Información visible al solicitante después de decidir<select value={settings.requester.decisionVisibility} disabled={!canManage} onChange={(event) => change('requester', 'decisionVisibility', event.target.value)}><option value="REASON">Estado y motivo comunicado</option><option value="STATUS">Solo estado</option></select></label>
          </div>
          <div className={styles.switches}>
            {switchRow('Permitir presentar iniciativas', settings.requester.canSubmit, (value) => change('requester', 'canSubmit', value), !canManage)}
            {switchRow('Permitir editar después del envío', settings.requester.canEditAfterSubmission, (value) => change('requester', 'canEditAfterSubmission', value), !canManage)}
            {switchRow('Permitir adjuntos y evidencia', settings.requester.canAttach, (value) => change('requester', 'canAttach', value), !canManage)}
            {switchRow('Permitir invitar colaboradores', settings.requester.canInviteCollaborators, (value) => change('requester', 'canInviteCollaborators', value), !canManage)}
            {switchRow('Permitir retirar una iniciativa propia', settings.requester.canWithdraw, (value) => change('requester', 'canWithdraw', value), !canManage)}
          </div>
        </>}
        {section === 'flow' && <><h3>Gobierno del flujo</h3><p className={styles.intro}>Determina quién puede decidir y qué condiciones deben cumplirse antes de avanzar.</p><div className={styles.switches}>
          {switchRow('Exigir mentor antes de la evaluación', settings.governance.mentorRequiredForValidation, (value) => change('governance', 'mentorRequiredForValidation', value), !canManage)}
          {switchRow('Impedir que quien presenta decida su propuesta', settings.governance.separateApproverFromRequester, (value) => change('governance', 'separateApproverFromRequester', value), !canManage)}
          {switchRow('Permitir decisiones al coordinador', settings.governance.coordinatorCanApprove, (value) => change('governance', 'coordinatorCanApprove', value), !canManage, 'Al desactivarlo, decide un administrador del espacio.')}
          {switchRow('Exigir líder asignado antes de convertir', settings.governance.leadRequiredForConversion, (value) => change('governance', 'leadRequiredForConversion', value), !canManage)}
          {switchRow('Pausar recepción en toda la institución', settings.operations.intakePaused, (value) => change('operations', 'intakePaused', value), !canManage)}
        </div></>}
        {section === 'privacy' && <><h3>Privacidad</h3><p className={styles.intro}>Los expedientes solo son visibles para personas autorizadas. El acceso externo requiere además una concesión específica.</p><div className={styles.switches}>{switchRow('Permitir acceso externo a iniciativas', settings.privacy.allowExternalInitiativeAccess, (value) => change('privacy', 'allowExternalInitiativeAccess', value), !canManage)}</div></>}
        {section === 'communication' && <><h3>Avisos del proceso</h3><p className={styles.intro}>AETHER avisa a las personas implicadas cuando ocurre una acción relevante.</p><div className={styles.switches}>
          {switchRow('Avisar al recibir una iniciativa', settings.communication.notifyOnSubmission, (value) => change('communication', 'notifyOnSubmission', value), !canManage)}
          {switchRow('Avisar al registrar una decisión', settings.communication.notifyOnDecision, (value) => change('communication', 'notifyOnDecision', value), !canManage)}
        </div></>}
        {section === 'programs' && <><h3>Reglas por programa</h3><p className={styles.intro}>Cada espacio institucional puede abrir su recepción y ajustar los criterios de seguimiento.</p>
          {workspaces.length === 0 ? <p className={styles.state}>Crea un espacio institucional para configurar un programa.</p> : <><label className={styles.field}>Espacio institucional<select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)}>{workspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}</select></label>
            {programLoading ? <p className={styles.state}><LoaderCircle size={16} className="animate-spin" /> Cargando reglas…</p> : programError && !program ? <p role="alert" className={styles.error}>{programError}</p> : program ? <>
              <div className={styles.switches}>{switchRow('Recepción abierta en este espacio', program.intake_enabled, (value) => changeProgram('intake_enabled', value), !canManage)}</div>
              <div className={styles.fieldColumns}>
                <label className={styles.field}>Equipo coordinador<select value={program.initiative_team_id ?? ''} disabled={!canManage} onChange={(event) => changeProgram('initiative_team_id', event.target.value || null)}><option value="">Sin equipo</option>{workspaceTeams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}</select><small>Las personas administradoras de este equipo pueden coordinar iniciativas.</small></label>
                <label className={styles.field}>Días de atención entre revisiones<input type="number" min={1} max={365} value={program.review_cadence_days} disabled={!canManage} onChange={(event) => changeProgram('review_cadence_days', Number(event.target.value))} /></label>
                <div className={styles.criteriaEditor}>
                  <div className={styles.criteriaHeading}><span><strong>Criterios de triage</strong><small>Define qué revisará el equipo y ajusta el orden según el flujo de tu organización.</small></span><span className={styles.criteriaCount}>{program.triage_criteria.length}/30</span></div>
                  {program.triage_criteria.length > 0 ? <ol className={styles.criteriaList}>
                    {program.triage_criteria.map((criterion, index) => <li className={styles.criteriaRow} key={`criterion-${index}`}>
                      <span className={styles.criteriaNumber}>{index + 1}</span>
                      <input className={styles.criteriaInput} type="text" maxLength={300} value={criterion} disabled={!canManage} aria-label={`Criterio ${index + 1}`} placeholder="Ej. Alineación con los objetivos institucionales" onChange={(event) => changeProgram('triage_criteria', program.triage_criteria.map((item, itemIndex) => itemIndex === index ? event.target.value : item))} />
                      <div className={styles.criteriaActions}>
                        <button type="button" aria-label={`Subir criterio ${index + 1}`} title="Subir" disabled={!canManage || index === 0} onClick={() => changeProgram('triage_criteria', moveItem(program.triage_criteria, index, index - 1))}><ArrowUp size={15} /></button>
                        <button type="button" aria-label={`Bajar criterio ${index + 1}`} title="Bajar" disabled={!canManage || index === program.triage_criteria.length - 1} onClick={() => changeProgram('triage_criteria', moveItem(program.triage_criteria, index, index + 1))}><ArrowDown size={15} /></button>
                        <button type="button" className={styles.criteriaRemove} aria-label={`Eliminar criterio ${index + 1}`} title="Eliminar" disabled={!canManage} onClick={() => changeProgram('triage_criteria', program.triage_criteria.filter((_, itemIndex) => itemIndex !== index))}><Trash2 size={15} /></button>
                      </div>
                    </li>)}
                  </ol> : <div className={styles.criteriaEmpty}>Aún no hay criterios. Agrégalos para orientar la primera revisión.</div>}
                  <button type="button" className={styles.addCriterion} disabled={!canManage || program.triage_criteria.length >= 30} onClick={() => changeProgram('triage_criteria', [...program.triage_criteria, ''])}><Plus size={15} /> Añadir criterio</button>
                </div>
              </div>
              <fieldset className={styles.group}><legend>Información requerida para convertir en proyecto</legend><div className={styles.fieldGrid}>{fieldOptions.map(([value, label]) => <label key={value}><input type="checkbox" checked={coreFields.has(value) || program.required_initiative_fields.includes(value)} disabled={!canManage || coreFields.has(value)} onChange={(event) => changeProgram('required_initiative_fields', event.target.checked ? [...program.required_initiative_fields, value] : program.required_initiative_fields.filter((item) => item !== value))} />{label}{coreFields.has(value) && <small>Siempre</small>}</label>)}</div></fieldset>
              <p className={styles.linkLine}><Building2 size={15} /> Estándar activo y equipos: <Link href="/dashboard/initiatives/settings">abrir configuración del espacio</Link></p>
            </> : null}
          </>}
        </>}
        {section === 'history' && <><h3>Historial de configuración</h3><p className={styles.intro}>Las reglas nuevas se aplican a las acciones siguientes. Los expedientes mantienen su historial.</p>
          {historyError ? <p role="alert" className={styles.error}>{historyError}</p> : history.length === 0 ? <p className={styles.state}>Todavía no hay cambios registrados.</p> : <ol className={styles.history}>{history.map((item) => <li key={item.id}><strong>{item.actorName}</strong><span>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(item.createdAt))}</span><small>{item.changedSections.map((name) => sectionLabels[name] ?? name).join(' — ')}</small></li>)}</ol>}
        </>}
        {(error || programError) && <p role="alert" className={styles.error}>{error || programError}</p>}
        {notice && <p role="status" className={styles.success}><Check size={16} />{notice}</p>}
        {canManage && section !== 'history' && <div className={styles.footer}><span>{section === 'programs' ? programDirty ? 'Hay cambios sin guardar' : 'Reglas guardadas' : dirty ? 'Hay cambios sin guardar' : 'Configuración guardada'}</span><button type="button" disabled={section === 'programs' ? !programDirty || programSaving : !dirty || saving} onClick={() => void (section === 'programs' ? saveProgram() : save())}>{saving || programSaving ? <LoaderCircle size={15} className="animate-spin" /> : <Save size={15} />} Guardar cambios</button></div>}
      </div>
    </div> : null}
  </section>;
}

function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (to < 0 || to >= items.length) return items;
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function switchRow(label: string, checked: boolean, onChange: (checked: boolean) => void, disabled: boolean, help?: string) {
  return <label className={styles.switchRow}><span><strong>{label}</strong>{help && <small>{help}</small>}</span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} disabled={disabled} /></label>;
}
