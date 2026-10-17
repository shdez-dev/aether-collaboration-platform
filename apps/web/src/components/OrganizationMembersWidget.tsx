'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, MessageCircle, RefreshCw, UserRoundPlus, UsersRound } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import styles from './OrganizationMembersWidget.module.css';

type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
};
type OrganizationSummary = { id: string; name: string; type: string; role?: string; memberCount?: number };

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0] ?? '').join('').toLocaleUpperCase('es');
}

function roleName(role: OrganizationMember['role']) {
  if (role === 'OWNER') return 'Propietario';
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'BILLING_ADMIN') return 'Facturación';
  return 'Integrante';
}

function memberTone(id: string) {
  const colors = ['#9171bb', '#579e8b', '#708dc2', '#c17e92', '#ba9564'];
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  return colors[hash % colors.length];
}

export function OrganizationMembersWidget({ organization }: { organization?: OrganizationSummary | null }) {
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [loadedOrganizationId, setLoadedOrganizationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);
  const organizationHref = organization
    ? `/dashboard/organizations?organizationId=${encodeURIComponent(organization.id)}`
    : '/dashboard/organizations';
  const isLoading = Boolean(organization?.id && (loadedOrganizationId !== organization.id || loading));
  const visibleMembers = loadedOrganizationId === organization?.id ? members : [];
  const canInvite = organization?.type !== 'PERSONAL' && ['OWNER', 'ADMIN'].includes(organization?.role ?? '');

  useEffect(() => {
    const currentRequest = ++requestId.current;
    let active = true;
    if (!organization?.id) {
      setMembers([]);
      setLoadedOrganizationId(null);
      setLoading(false);
      setError(false);
      return () => { active = false; };
    }
    setMembers([]);
    setLoadedOrganizationId(null);
    setLoading(true);
    setError(false);
    void apiService.get<{ members: OrganizationMember[] }>(
      `/api/organizations/${encodeURIComponent(organization.id)}/members`, true,
    ).then((response) => {
      if (!active || requestId.current !== currentRequest) return;
      if (!response.success || !response.data) throw new Error('Unable to load members');
      setMembers(response.data.members ?? []);
      setLoadedOrganizationId(organization.id);
    }).catch(() => {
      if (!active || requestId.current !== currentRequest) return;
      setError(true);
      setLoadedOrganizationId(organization.id);
    }).finally(() => {
      if (active && requestId.current === currentRequest) setLoading(false);
    });
    return () => { active = false; };
  }, [organization?.id, reloadKey]);

  function openChat(member: OrganizationMember) {
    window.dispatchEvent(new CustomEvent('aether:open-chat', {
      detail: { id: member.userId, userId: member.userId, name: member.name, avatar: member.avatar ?? null, position: roleName(member.role) },
    }));
  }

  return <section className={styles.root} aria-label="Miembros de la organización" aria-busy={isLoading}>
    <header className={styles.header}>
      <div className={styles.heading}><span className={styles.headingIcon}><UsersRound size={14} aria-hidden="true" /></span><strong>Personas</strong><span className={styles.count}>{(organization?.memberCount ?? visibleMembers.length).toLocaleString('es-CL')}</span></div>
      <div className={styles.actions}>
        <Link href={organizationHref} className={styles.viewLink}>Ver organización <ArrowUpRight size={12} aria-hidden="true" /></Link>
        <button type="button" className={styles.refresh} onClick={() => setReloadKey((value) => value + 1)} disabled={isLoading} aria-label="Actualizar integrantes"><RefreshCw size={12} aria-hidden="true" /></button>
      </div>
    </header>

    {!organization ? <div className={styles.state}><UsersRound size={16} /><strong>Elige una organización</strong></div>
      : isLoading ? <div className={styles.skeleton} role="status" aria-label="Cargando integrantes"><span /><span /><span /><span /></div>
        : error ? <div className={styles.state} role="alert"><span className={styles.stateIcon}><RefreshCw size={14} aria-hidden="true" /></span><span><strong>No se pudieron cargar las personas</strong><small>Revisa tu conexión y vuelve a intentarlo.</small></span><button type="button" onClick={() => setReloadKey((value) => value + 1)}>Reintentar</button></div>
          : visibleMembers.length === 0 ? <div className={styles.state}><span className={styles.stateIcon}><UsersRound size={15} aria-hidden="true" /></span><span><strong>Aún no hay integrantes</strong><small>Las personas con acceso aparecerán aquí.</small></span></div>
            : <div className={styles.memberGrid}>
              {visibleMembers.slice(0, 8).map((member) => {
                const avatarUrl = getAvatarUrl(member.avatar ?? null);
                return <button key={member.id} type="button" className={styles.member} onClick={() => openChat(member)} title={`Abrir chat con ${member.name}`} style={{ '--member-tone': memberTone(member.userId) } as React.CSSProperties}>
                  <span className={styles.avatar}>
                    {avatarUrl ? <Image src={avatarUrl} alt="" width={34} height={34} unoptimized /> : initials(member.name)}
                  </span>
                  <span className={styles.memberCopy}><strong>{member.name}</strong><small>{roleName(member.role)}</small></span>
                  <span className={styles.chatAction} aria-hidden="true"><MessageCircle size={12} /></span>
                </button>;
              })}
            </div>}

    {organization && <footer className={styles.footer}>
      <span>{isLoading ? 'Cargando personas…' : error ? 'No se pudo cargar el recuento.' : visibleMembers.length > 8 ? 'Mostrando 8 de ' + visibleMembers.length : visibleMembers.length + (visibleMembers.length === 1 ? ' persona con acceso' : ' personas con acceso')}</span>
      {canInvite && <Link href={organizationHref} className={styles.inviteLink}><UserRoundPlus size={12} aria-hidden="true" />Invitar personas</Link>}
    </footer>}
  </section>;
}
