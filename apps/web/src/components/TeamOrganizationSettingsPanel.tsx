'use client';

import { useEffect, useState } from 'react';
import { Check, LoaderCircle, Plus, Save, ShieldCheck, UsersRound, Workflow, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import styles from './TeamOrganizationSettingsPanel.module.css';

type InvitationAuthority = 'OWNER_AND_ADMIN' | 'OWNER_ONLY' | 'ALL_MEMBERS';
type TeamSettings = {
  membership: {
    invitationAuthority: InvitationAuthority;
    allowedEmailDomains: string[];
    defaultWorkspaceId: string | null;
  };
};
type Workspace = { id: string; name: string; archived: boolean; mode: string };

function normalizeDomain(value: string) { return value.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/$/, ''); }
function isDomain(value: string) { return /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/.test(value) && value.length <= 253; }

export function TeamOrganizationSettingsPanel({
  organizationId,
  canManage,
  onInvitationAuthorityChange,
}: {
  organizationId: string;
  canManage: boolean;
  onInvitationAuthorityChange?: (value: InvitationAuthority) => void;
}) {
  const [settings, setSettings] = useState<TeamSettings | null>(null);
  const [saved, setSaved] = useState('');
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [domainDraft, setDomainDraft] = useState('');
  const [domainError, setDomainError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const dirty = settings !== null && JSON.stringify(settings) !== saved;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    setSettings(null);
    void Promise.all([
      apiService.get<{ settings: TeamSettings }>(`/api/organizations/${organizationId}/team-settings`, true),
      apiService.get<{ organization: { workspaces: Workspace[] } }>(`/api/organizations/${organizationId}`, true),
    ]).then(([settingsResponse, organizationResponse]) => {
      if (!active) return;
      if (!settingsResponse.success || !settingsResponse.data?.settings) {
        throw new Error(settingsResponse.error?.message ?? 'No se pudo cargar la configuración del equipo.');
      }
      const value = settingsResponse.data.settings;
      setSettings(value);
      setSaved(JSON.stringify(value));
      onInvitationAuthorityChange?.(value.membership.invitationAuthority);
      setWorkspaces((organizationResponse.data?.organization?.workspaces ?? [])
        .filter((workspace) => !workspace.archived && workspace.mode === 'TEAM'));
    }).catch((caught) => {
      if (active) setError(caught instanceof Error ? caught.message : 'No se pudo cargar la configuración.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, onInvitationAuthorityChange]);

  function changeMembership<K extends keyof TeamSettings['membership']>(key: K, value: TeamSettings['membership'][K]) {
    setSettings((current) => current ? { ...current, membership: { ...current.membership, [key]: value } } : current);
    setNotice('');
  }
  function addDomain() {
    if (!settings || !canManage) return;
    const domain = normalizeDomain(domainDraft);
    if (!domain) return;
    if (!isDomain(domain)) { setDomainError('Escribe un dominio válido, por ejemplo equipo.com.'); return; }
    if (settings.membership.allowedEmailDomains.includes(domain)) { setDomainError('Ese dominio ya está en la lista.'); return; }
    if (settings.membership.allowedEmailDomains.length >= 30) { setDomainError('Puedes añadir hasta 30 dominios.'); return; }
    changeMembership('allowedEmailDomains', [...settings.membership.allowedEmailDomains, domain]);
    setDomainDraft('');
    setDomainError('');
  }
  async function save() {
    if (!settings || !canManage || saving || !dirty) return;
    setSaving(true); setError(''); setNotice('');
    try {
      const response = await apiService.put<{ settings: TeamSettings }>(`/api/organizations/${organizationId}/team-settings`, settings, true);
      if (!response.success || !response.data?.settings) throw new Error(response.error?.message ?? 'No se pudieron guardar los cambios.');
      setSettings(response.data.settings);
      setSaved(JSON.stringify(response.data.settings));
      onInvitationAuthorityChange?.(response.data.settings.membership.invitationAuthority);
      setNotice('Configuración guardada. Las reglas de invitación ya están activas.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudieron guardar los cambios.');
    } finally { setSaving(false); }
  }

  return <section className={styles.shell} aria-labelledby="team-settings-title">
    <header className={styles.header}>
      <span className={styles.headerIcon}><Workflow size={19} /></span>
      <div><h2 id="team-settings-title">Configuración del equipo</h2><p>Define cómo se integran las personas a esta organización.</p></div>
      <span className={styles.scopeTag}><ShieldCheck size={13} /> Organización Teams</span>
    </header>

    {loading ? <div className={styles.state}><LoaderCircle size={17} className="animate-spin" /> Cargando configuración…</div>
      : error && !settings ? <div className={styles.error} role="alert">{error}</div>
        : settings ? <>
          <div className={styles.content}>
            <section className={styles.section} aria-labelledby="team-access-title">
              <div className={styles.sectionHeading}>
                <span className={styles.sectionIcon}><UsersRound size={17} /></span>
                <div><h3 id="team-access-title">Acceso e incorporación</h3><p>Reglas para invitar personas y darles un punto de entrada.</p></div>
              </div>
              <div className={styles.fieldGrid}>
                <label className={styles.field}>Quién puede invitar
                  <ProjectOptionSelect
                    label="Quién puede invitar"
                    value={settings.membership.invitationAuthority}
                    disabled={!canManage}
                    onChange={(value) => changeMembership('invitationAuthority', value as InvitationAuthority)}
                    options={[
                      { value: 'OWNER_AND_ADMIN', label: 'Propietario y administradores' },
                      { value: 'OWNER_ONLY', label: 'Solo el propietario' },
                      { value: 'ALL_MEMBERS', label: 'Todas las personas miembro' },
                    ]}
                  />
                  <small>Si se permite a todos, solo podrán invitar con el rol Miembro.</small>
                </label>
                <label className={styles.field}>Espacio predeterminado para nuevas personas
                  <ProjectOptionSelect
                    label="Espacio predeterminado para nuevas personas"
                    value={settings.membership.defaultWorkspaceId ?? ''}
                    disabled={!canManage}
                    onChange={(value) => changeMembership('defaultWorkspaceId', value || null)}
                    options={[
                      { value: '', label: 'Sin asignación automática' },
                      ...workspaces.map((workspace) => ({ value: workspace.id, label: workspace.name })),
                    ]}
                  />
                  <small>Se asigna automáticamente al aceptar la invitación a la organización (excepto al rol de facturación). Puedes cambiarlo después.</small>
                </label>
                <div className={styles.domainField}>
                  <div className={styles.domainLabel}><strong>Dominios de correo permitidos</strong><span>{settings.membership.allowedEmailDomains.length ? `${settings.membership.allowedEmailDomains.length}/30` : 'Opcional'}</span></div>
                  <p className={styles.fieldHelp}>Vacío permite invitar cualquier correo. Si agregas dominios, se validan al enviar la invitación.</p>
                  {settings.membership.allowedEmailDomains.length > 0 ? <div className={styles.domainList}>
                    {settings.membership.allowedEmailDomains.map((domain) => <span className={styles.domainChip} key={domain}>{domain}{canManage && <button type="button" aria-label={`Quitar dominio ${domain}`} onClick={() => changeMembership('allowedEmailDomains', settings.membership.allowedEmailDomains.filter((item) => item !== domain))}><X size={13} /></button>}</span>)}
                  </div> : <p className={styles.domainEmpty}>No hay restricciones de dominio.</p>}
                  {canManage && <div className={styles.addDomainRow}>
                    <input value={domainDraft} maxLength={253} aria-label="Añadir dominio de correo" placeholder="empresa.com" onChange={(event) => { setDomainDraft(event.target.value); setDomainError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); addDomain(); } }} />
                    <button type="button" onClick={addDomain} disabled={!domainDraft.trim()}><Plus size={15} /> Añadir</button>
                  </div>}
                  {domainError && <p className={styles.fieldError} role="alert">{domainError}</p>}
                </div>
              </div>
            </section>

          </div>

          <footer className={styles.footer}>
            <div aria-live="polite">{error ? <span className={styles.footerError} role="alert">{error}</span> : notice ? <span className={styles.footerNotice}><Check size={14} /> {notice}</span> : dirty ? <span>Cambios sin guardar</span> : <span>Configuración actualizada</span>}</div>
            {canManage && <button type="button" onClick={() => void save()} disabled={!dirty || saving || loading}><Save size={15} />{saving ? 'Guardando…' : 'Guardar cambios'}</button>}
          </footer>
        </> : <div className={styles.state}>No se pudo mostrar la configuración.</div>}
  </section>;
}
