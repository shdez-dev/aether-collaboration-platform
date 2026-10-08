'use client';

import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Building2, Clock3, Mail, RefreshCw, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiService } from '@/services/apiService';
import { getDisplayOrganizationName } from '@/lib/organizationName';
import { useWorkspaceStore } from '@/stores/workspaceStore';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
type InviteRole = 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';

type Organization = {
  id: string;
  name: string;
  type: 'PERSONAL' | 'COMPANY' | 'INSTITUTION' | 'NETWORK_OPERATOR';
  role: OrganizationRole;
  memberCount: number;
  workspaceCount: number;
};

type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: OrganizationRole;
  joinedAt: string;
};

type OrganizationInvitation = {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
};

const canManage = (role?: OrganizationRole) => role === 'OWNER' || role === 'ADMIN';
const roleLabel: Record<OrganizationRole, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  BILLING_ADMIN: 'Administrador de facturación',
  MEMBER: 'Miembro',
};

function invitationError(code?: string, message?: string) {
  if (code === 'INVITATION_ALREADY_PENDING') return 'Ya existe una invitación pendiente para ese correo.';
  if (code === 'ALREADY_MEMBER') return 'Esta persona ya pertenece a la organización.';
  if (code === 'PERSONAL_ORGANIZATION_IMMUTABLE') return 'Las organizaciones personales no admiten miembros adicionales.';
  if (code === 'FORBIDDEN') return 'No tienes permisos para realizar esta acción.';
  return message || 'No se pudo completar la operación. Inténtalo de nuevo.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

export default function OrganizationsPage() {
  const { currentWorkspace } = useWorkspaceStore();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('MEMBER');
  const [sending, setSending] = useState(false);
  const [revokingId, setRevokingId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);

  useEffect(() => {
    let active = true;
    setLoadingOrganizations(true);
    apiService.get<{ organizations: Organization[] }>('/api/organizations', true).then((response) => {
      if (!active) return;
      if (!response.success || !response.data) {
        setLoadError(response.error?.message ?? 'No se pudieron cargar las organizaciones.');
        setOrganizations([]);
        return;
      }
      const available = response.data.organizations ?? [];
      setOrganizations(available);
      const queryOrganizationId = new URLSearchParams(window.location.search).get('organizationId');
      const workspaceOrganizationId = currentWorkspace?.organization?.id ?? currentWorkspace?.organizationId;
      const preferred = available.find((organization) => organization.id === queryOrganizationId)
        ?? available.find((organization) => organization.id === workspaceOrganizationId)
        ?? available[0];
      setOrganizationId((current) => current || preferred?.id || '');
      setLoadError('');
    }).catch(() => {
      if (active) setLoadError('No se pudieron cargar las organizaciones. Revisa tu conexión.');
    }).finally(() => { if (active) setLoadingOrganizations(false); });
    return () => { active = false; };
  }, [currentWorkspace?.organization?.id, currentWorkspace?.organizationId, refreshCount]);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? null,
    [organizations, organizationId],
  );
  const isManager = canManage(selectedOrganization?.role);
  const isPersonal = selectedOrganization?.type === 'PERSONAL';

  useEffect(() => {
    if (!selectedOrganization) {
      setMembers([]);
      setInvitations([]);
      return;
    }
    let active = true;
    setLoadingMembers(true);
    setLoadError('');
    setActionError('');
    const memberRequest = apiService.get<{ members: OrganizationMember[] }>(`/api/organizations/${selectedOrganization.id}/members`, true);
    const invitationRequest = isManager && !isPersonal
      ? apiService.get<{ invitations: OrganizationInvitation[] }>(`/api/organizations/${selectedOrganization.id}/invitations`, true)
      : Promise.resolve(null);
    Promise.all([memberRequest, invitationRequest]).then(([memberResponse, invitationResponse]) => {
      if (!active) return;
      if (!memberResponse.success || !memberResponse.data) {
        setLoadError(memberResponse.error?.message ?? 'No se pudieron cargar los miembros de la organización.');
        setMembers([]);
      } else {
        setMembers(memberResponse.data.members ?? []);
      }
      if (invitationResponse) {
        if (!invitationResponse.success || !invitationResponse.data) {
          setActionError(invitationError(invitationResponse.error?.code, invitationResponse.error?.message));
          setInvitations([]);
        } else {
          setInvitations(invitationResponse.data.invitations ?? []);
        }
      } else {
        setInvitations([]);
      }
    }).catch(() => {
      if (active) setLoadError('No se pudieron cargar los datos de esta organización. Revisa tu conexión.');
    }).finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [selectedOrganization, isManager, isPersonal, refreshCount]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization || !isManager || isPersonal || sending) return;
    setSending(true);
    setActionError('');
    const response = await apiService.post<{ message: string }>(
      `/api/organizations/${selectedOrganization.id}/invitations`,
      { email: email.trim().toLowerCase(), role: inviteRole },
      true,
    );
    setSending(false);
    if (!response.success) {
      const message = invitationError(response.error?.code, response.error?.message);
      setActionError(message);
      return;
    }
    toast.success(`Invitación enviada a ${email.trim()}.`);
    setEmail('');
    setInviteRole('MEMBER');
    setInviteOpen(false);
    setRefreshCount((count) => count + 1);
  }

  async function revokeInvitation(invitation: OrganizationInvitation) {
    if (!selectedOrganization || revokingId) return;
    const confirmed = window.confirm(`¿Revocar la invitación enviada a ${invitation.email}?`);
    if (!confirmed) return;
    setRevokingId(invitation.id);
    setActionError('');
    const response = await apiService.delete<void>(`/api/organizations/${selectedOrganization.id}/invitations/${invitation.id}`, true);
    setRevokingId('');
    if (!response.success) {
      setActionError(invitationError(response.error?.code, response.error?.message));
      return;
    }
    toast.success('Invitación revocada.');
    setRefreshCount((count) => count + 1);
  }

  return (
    <main style={page}>
      <header style={header}>
        <div>
          <p style={eyebrow}>PERSONAS Y ACCESOS</p>
          <h1 style={title}>Organización</h1>
          <p style={subtitle}>Invita personas a la organización y revisa quiénes ya forman parte.</p>
        </div>
        <div style={headerActions}>
          <label style={field}>
            Organización
            <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} disabled={loadingOrganizations || organizations.length === 0} style={select}>
              {organizations.length === 0 && <option value="">Sin organizaciones</option>}
              {organizations.map((organization) => <option key={organization.id} value={organization.id}>{getDisplayOrganizationName(organization.name)}</option>)}
            </select>
          </label>
          {selectedOrganization && isManager && !isPersonal && (
            <button type="button" style={primaryButton} onClick={() => { setActionError(''); setInviteOpen(true); }}>
              <UserPlus size={16} /> Invitar persona
            </button>
          )}
        </div>
      </header>

      {loadError && <div role="alert" style={errorBanner}>{loadError}</div>}
      {actionError && <div role="alert" style={errorBanner}>{actionError}</div>}
      {loadingOrganizations && <div style={empty}><RefreshCw className="animate-spin" size={22} /> Cargando organizaciones…</div>}
      {!loadingOrganizations && organizations.length === 0 && !loadError && (
        <section style={empty}><Building2 size={30} /><strong>No hay organizaciones disponibles.</strong><span>Crea una organización o solicita que te inviten para poder administrar su equipo.</span></section>
      )}

      {selectedOrganization && (
        <>
          <section style={orgCard}>
            <span style={orgIcon}><Building2 size={20} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={orgName}>{getDisplayOrganizationName(selectedOrganization.name)}</h2>
              <p style={orgMeta}>{selectedOrganization.type === 'INSTITUTION' ? 'Institución' : selectedOrganization.type === 'NETWORK_OPERATOR' ? 'Red de colaboración' : isPersonal ? 'Personal' : 'Equipo o empresa'} · {selectedOrganization.workspaceCount} {selectedOrganization.workspaceCount === 1 ? 'espacio de trabajo' : 'espacios de trabajo'}</p>
            </div>
            <span style={countPill}><Users size={14} /> {members.length} {members.length === 1 ? 'miembro' : 'miembros'}</span>
          </section>

          {isPersonal ? (
            <section style={notice}><ShieldCheck size={18} /><span>Esta es una organización personal. No admite invitaciones. Cambia a una organización de equipo, empresa o institución para agregar personas.</span></section>
          ) : (
            <section style={notice}>
              <Mail size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span>La persona recibirá un correo y deberá aceptar la invitación con esa misma dirección. Después, asígnale un espacio de trabajo para que pueda colaborar. La invitación a la organización no concede acceso automático a sus espacios.</span>
                <div style={{ marginTop: 10 }}>
                  <Link href="/dashboard/users" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--c-accent-text)', fontSize: 12, fontWeight: 700, textDecoration: 'none' }}>
                    Asignar acceso a un espacio de trabajo <ArrowRight size={14} />
                  </Link>
                </div>
              </div>
            </section>
          )}

          <section style={section}>
            <div style={sectionHeader}><div><h2 style={sectionTitle}>Miembros</h2><p style={sectionCopy}>Personas que ya aceptaron unirse a esta organización.</p></div><span style={countPill}>{members.length}</span></div>
            {loadingMembers ? <div style={listEmpty}><RefreshCw className="animate-spin" size={18} /> Cargando miembros…</div> : members.length === 0 ? <div style={listEmpty}>Todavía no hay miembros.</div> : (
              <div style={list}>
                {members.map((member) => (
                  <article key={member.userId} style={personRow}>
                    <span style={avatar}>{initials(member.name)}</span>
                    <span style={personCopy}><strong style={{ fontSize: 13, fontWeight: 700 }}>{member.name}</strong><small style={{ color: 'var(--c-text3)', fontSize: 11.5 }}>{member.email}</small></span>
                    <span style={rolePill}>{roleLabel[member.role]}</span>
                  </article>
                ))}
              </div>
            )}
          </section>

          {!isPersonal && isManager && <section style={section}>
            <div style={sectionHeader}><div><h2 style={sectionTitle}>Invitaciones pendientes</h2><p style={sectionCopy}>Tienen una semana para aceptar el enlace que recibieron por correo.</p></div><span style={countPill}><Clock3 size={14} /> {invitations.length}</span></div>
            {loadingMembers ? <div style={listEmpty}>Cargando invitaciones…</div> : invitations.length === 0 ? <div style={listEmpty}>No hay invitaciones pendientes.</div> : (
              <div style={list}>
                {invitations.map((invitation) => (
                  <article key={invitation.id} style={personRow}>
                    <span style={inviteIcon}><Mail size={16} /></span>
                    <span style={personCopy}><strong style={{ fontSize: 13, fontWeight: 700 }}>{invitation.email}</strong><small style={{ color: 'var(--c-text3)', fontSize: 11.5 }}>Invitó {invitation.invitedBy.name}. Vence el {formatDate(invitation.expiresAt)}.</small></span>
                    <span style={rolePill}>{roleLabel[invitation.role]}</span>
                    <button type="button" aria-label={`Revocar invitación para ${invitation.email}`} title="Revocar invitación" onClick={() => void revokeInvitation(invitation)} disabled={revokingId === invitation.id} style={iconButton}>
                      {revokingId === invitation.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>}

          {!isPersonal && !isManager && <section style={notice}><ShieldCheck size={18} /><span>Solo el propietario o los administradores pueden invitar personas y gestionar invitaciones pendientes.</span></section>}
        </>
      )}

      {inviteOpen && selectedOrganization && <div style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setInviteOpen(false); }}>
        <form onSubmit={(event) => void sendInvitation(event)} style={modal}>
          <div style={modalHeader}><div><p style={eyebrow}>INVITAR A LA ORGANIZACIÓN</p><h2 style={modalTitle}>Añadir una persona</h2></div><button type="button" aria-label="Cerrar" onClick={() => setInviteOpen(false)} style={iconButton}><X size={17} /></button></div>
          <p style={modalCopy}>Enviaremos un enlace de aceptación a su correo. La invitación caduca en siete días.</p>
          <label style={field}>Correo electrónico<input autoFocus required type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" style={input} /></label>
          <label style={field}>Rol en la organización<select value={inviteRole} onChange={(event) => setInviteRole(event.target.value as InviteRole)} style={select}>
            <option value="MEMBER">Miembro</option>
            {selectedOrganization.role === 'OWNER' && <><option value="ADMIN">Administrador</option><option value="BILLING_ADMIN">Administrador de facturación</option></>}
          </select></label>
          {selectedOrganization.role !== 'OWNER' && <p style={roleHint}>Como administrador, puedes invitar miembros. El propietario gestiona los demás roles.</p>}
          {actionError && <p role="alert" style={errorBanner}>{actionError}</p>}
          <div style={actions}><button type="button" onClick={() => setInviteOpen(false)} disabled={sending} style={secondaryButton}>Cancelar</button><button type="submit" disabled={!email.trim() || sending} style={primaryButton}>{sending ? 'Enviando…' : 'Enviar invitación'}</button></div>
        </form>
      </div>}
    </main>
  );
}

const page: CSSProperties = { width: '100%', maxWidth: 1120, minHeight: '100%', margin: '0 auto', padding: 'clamp(24px, 4vw, 44px) clamp(18px, 4vw, 56px) 64px', boxSizing: 'border-box', color: 'var(--c-text)', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 26 };
const headerActions: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' };
const eyebrow: CSSProperties = { margin: 0, color: 'var(--c-accent-text)', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' };
const title: CSSProperties = { margin: '6px 0 7px', color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 'clamp(29px, 4vw, 38px)', letterSpacing: '-.045em' };
const subtitle: CSSProperties = { margin: 0, color: 'var(--c-text2)', lineHeight: 1.55, fontSize: 14 };
const field: CSSProperties = { display: 'grid', gap: 6, color: 'var(--c-text3)', fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' };
const select: CSSProperties = { minWidth: 'clamp(210px, 24vw, 280px)', border: '1px solid var(--c-border2)', borderRadius: 10, background: 'var(--c-surface)', color: 'var(--c-text)', padding: '11px 13px', font: '600 13px Manrope, system-ui, sans-serif', textTransform: 'none', letterSpacing: 0, outlineColor: 'var(--c-accent-text)' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface2)', color: 'var(--c-text)', padding: '11px 12px', font: '500 13px Manrope, system-ui, sans-serif', textTransform: 'none', letterSpacing: 0, outlineColor: 'var(--c-accent-text)' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--c-accent)', borderRadius: 10, background: 'var(--c-accent)', color: '#fff', padding: '11px 15px', font: "700 13px 'Manrope', system-ui, sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 5px 14px color-mix(in srgb, var(--c-accent) 20%, transparent)' };
const secondaryButton: CSSProperties = { border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface2)', color: 'var(--c-text2)', padding: '10px 14px', font: "600 13px 'Manrope', system-ui, sans-serif", cursor: 'pointer' };
const orgCard: CSSProperties = { display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', marginBottom: 14, border: '1px solid var(--c-border)', borderRadius: 14, background: 'linear-gradient(115deg, color-mix(in srgb, var(--c-accent-text) 7%, var(--c-surface)), var(--c-surface) 68%)', boxShadow: '0 10px 28px color-mix(in srgb, var(--c-text) 4%, transparent)' };
const orgIcon: CSSProperties = { width: 46, height: 46, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: 13, color: 'var(--c-accent-text)', background: 'color-mix(in srgb, var(--c-accent-text) 11%, var(--c-surface))', border: '1px solid color-mix(in srgb, var(--c-accent-text) 20%, transparent)' };
const orgName: CSSProperties = { margin: 0, color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 16 };
const orgMeta: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text3)', fontSize: 12 };
const countPill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, border: '1px solid var(--c-border)', borderRadius: 999, padding: '7px 10px', color: 'var(--c-text2)', background: 'var(--c-surface2)', fontSize: 11, fontWeight: 700 };
const notice: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 16px', marginBottom: 18, border: '1px solid color-mix(in srgb, var(--c-accent-text) 22%, transparent)', borderRadius: 11, background: 'color-mix(in srgb, var(--c-accent-text) 6%, var(--c-surface))', color: 'var(--c-text2)', fontSize: 12.5, lineHeight: 1.6 };
const section: CSSProperties = { padding: '19px 20px', marginTop: 14, border: '1px solid var(--c-border)', borderRadius: 14, background: 'var(--c-surface)', boxShadow: '0 8px 24px color-mix(in srgb, var(--c-text) 3%, transparent)' };
const sectionHeader: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 15 };
const sectionTitle: CSSProperties = { margin: 0, color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 15 };
const sectionCopy: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text3)', fontSize: 12, lineHeight: 1.5 };
const list: CSSProperties = { display: 'grid', gap: 8 };
const personRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 11, minWidth: 0, padding: '11px 12px', border: '1px solid var(--c-border)', borderRadius: 10, background: 'var(--c-surface2)' };
const avatar: CSSProperties = { width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--c-accent)', color: '#FFFFFF', fontSize: 11, fontWeight: 800 };
const inviteIcon: CSSProperties = { ...avatar, background: 'color-mix(in srgb, var(--c-accent-text) 11%, var(--c-surface))', color: 'var(--c-accent-text)', borderRadius: 10 };
const personCopy: CSSProperties = { display: 'grid', flex: 1, minWidth: 0, gap: 3, color: 'var(--c-text)' };
const rolePill: CSSProperties = { flexShrink: 0, border: '1px solid var(--c-border2)', borderRadius: 999, padding: '5px 9px', color: 'var(--c-text2)', background: 'var(--c-surface)', fontSize: 10, fontWeight: 700, textAlign: 'center' };
const iconButton: CSSProperties = { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 34, height: 34, border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface)', color: 'var(--c-text3)', cursor: 'pointer' };
const listEmpty: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 82, border: '1px dashed var(--c-border2)', borderRadius: 10, color: 'var(--c-text3)', background: 'var(--c-surface2)', fontSize: 12 };
const empty: CSSProperties = { minHeight: 220, display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 10, border: '1px dashed var(--c-border2)', borderRadius: 14, color: 'var(--c-text3)', background: 'var(--c-surface)', padding: 24, textAlign: 'center' };
const errorBanner: CSSProperties = { padding: '11px 13px', marginBottom: 12, border: '1px solid color-mix(in srgb, var(--c-red) 30%, transparent)', borderRadius: 10, background: 'color-mix(in srgb, var(--c-red) 9%, var(--c-surface))', color: 'var(--c-red)', fontSize: 12.5 };
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(18, 14, 24, .58)', backdropFilter: 'blur(6px)' };
const modal: CSSProperties = { width: 'min(460px, 100%)', display: 'grid', gap: 15, padding: 22, border: '1px solid var(--c-border2)', borderRadius: 15, background: 'var(--c-surface)', color: 'var(--c-text)', boxShadow: '0 22px 70px rgba(25, 18, 34, .22)' };
const modalHeader: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 };
const modalTitle: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 18 };
const modalCopy: CSSProperties = { margin: 0, color: 'var(--c-text2)', fontSize: 12.5, lineHeight: 1.55 };
const roleHint: CSSProperties = { margin: '-8px 0 0', color: 'var(--c-text3)', fontSize: 11, lineHeight: 1.5 };
const actions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 3 };
