'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowDownAZ, ArrowUpRight, CalendarClock, Clock3, MailCheck, RefreshCw, ShieldCheck } from 'lucide-react';
import { apiService } from '@/services/apiService';
import styles from './OrganizationInvitationsWidget.module.css';

type Invitation = {
  id: string;
  email: string;
  role: 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
};

type OrganizationSummary = { id: string; name: string; type: string; role?: string };
type LoadState = 'loading' | 'ready' | 'error';
type SortMode = 'expiry' | 'recent';

const DAY_MS = 24 * 60 * 60 * 1000;

function formatCount(value: number) {
  return value.toLocaleString('es-CL');
}

function roleName(role: Invitation['role']) {
  if (role === 'ADMIN') return 'Administrador';
  if (role === 'BILLING_ADMIN') return 'Facturación';
  return 'Miembro';
}

function formatExpiry(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Fecha pendiente';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(date);
}

function expiresSoon(value: string) {
  const remaining = new Date(value).getTime() - Date.now();
  return Number.isFinite(remaining) && remaining >= 0 && remaining <= 3 * DAY_MS;
}

export function OrganizationInvitationsWidget({ organization }: { organization?: OrganizationSummary | null }) {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [invitationsOrganizationId, setInvitationsOrganizationId] = useState<string | null>(null);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('expiry');
  const [reloadKey, setReloadKey] = useState(0);
  const requestId = useRef(0);

  const canManage = organization?.role === 'OWNER' || organization?.role === 'ADMIN';
  const isPersonal = organization?.type === 'PERSONAL';
  const organizationHref = organization
    ? `/dashboard/organizations?organizationId=${encodeURIComponent(organization.id)}`
    : '/dashboard/organizations';

  useEffect(() => {
    const currentRequest = ++requestId.current;
    let active = true;

    if (!organization?.id || isPersonal || !canManage) {
      setInvitations([]);
      setInvitationsOrganizationId(organization?.id ?? null);
      setLoadState('ready');
      setErrorMessage('');
      return () => { active = false; };
    }

    setInvitations([]);
    setInvitationsOrganizationId(organization.id);
    setLoadState('loading');
    setErrorMessage('');

    void apiService.get<{ invitations: Invitation[] }>(
      `/api/organizations/${encodeURIComponent(organization.id)}/invitations`, true,
    ).then((response) => {
      if (!active || currentRequest !== requestId.current) return;
      if (!response.success || !response.data) {
        setErrorMessage(response.error?.code === 'FORBIDDEN'
          ? 'Solo el propietario o un administrador puede ver estas invitaciones.'
          : 'No se pudieron cargar las invitaciones. Comprueba la conexión e inténtalo otra vez.');
        setLoadState('error');
        return;
      }
      setInvitations(response.data.invitations ?? []);
      setLoadState('ready');
    }).catch(() => {
      if (!active || currentRequest !== requestId.current) return;
      setErrorMessage('No se pudieron cargar las invitaciones. Comprueba la conexión e inténtalo otra vez.');
      setLoadState('error');
    });

    return () => { active = false; };
  }, [canManage, isPersonal, organization?.id, reloadKey]);

  const sortedInvitations = useMemo(() => [...invitations].sort((left, right) => {
    if (sortMode === 'expiry') return new Date(left.expiresAt).getTime() - new Date(right.expiresAt).getTime();
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  }), [invitations, sortMode]);
  const visibleInvitations = invitationsOrganizationId === organization?.id ? sortedInvitations : [];
  const isLoading = Boolean(organization?.id && canManage && !isPersonal
    && (invitationsOrganizationId !== organization.id || loadState === 'loading'));
  const summary = !organization ? 'Sin organización'
    : isPersonal ? 'Personal'
      : !canManage ? 'Acceso limitado'
        : isLoading ? 'Cargando…'
          : loadState === 'error' ? 'No disponible'
            : `${formatCount(visibleInvitations.length)} ${visibleInvitations.length === 1 ? 'activa' : 'activas'}`;

  return <section className={styles.widget} aria-label="Invitaciones pendientes" aria-busy={isLoading}>
    <header className={styles.header}>
      <span className={styles.count}>{summary}</span>
      <div className={styles.headerActions}>
        <Link className={styles.viewLink} href={organizationHref} title="Abrir organización">
          <span>Organización</span><ArrowUpRight size={12} aria-hidden="true" />
        </Link>
        {canManage && !isPersonal && <button className={styles.refreshButton} type="button" onClick={() => setReloadKey((value) => value + 1)} disabled={isLoading} aria-label="Actualizar invitaciones" title="Actualizar">
          <RefreshCw size={13} aria-hidden="true" />
        </button>}
      </div>
    </header>

    {canManage && !isPersonal && loadState === 'ready' && visibleInvitations.length > 0 && <div className={styles.toolbar}>
      <span>{sortMode === 'expiry' ? 'Ordenadas por vencimiento' : 'Ordenadas por envío'}</span>
      <button className={styles.sortButton} type="button" onClick={() => setSortMode((value) => value === 'expiry' ? 'recent' : 'expiry')} aria-label={`Ordenar por ${sortMode === 'expiry' ? 'fecha de envío' : 'vencimiento'}`} title={`Ordenar por ${sortMode === 'expiry' ? 'fecha de envío' : 'vencimiento'}`}>
        {sortMode === 'expiry' ? <Clock3 size={12} aria-hidden="true" /> : <ArrowDownAZ size={12} aria-hidden="true" />}
        <span>{sortMode === 'expiry' ? 'Vencen antes' : 'Más recientes'}</span>
      </button>
    </div>}

    {canManage && !isPersonal && isLoading ? <div className={styles.loadingState} role="status" aria-label="Cargando invitaciones">
      <span /><span /><span />
    </div> : canManage && !isPersonal && loadState === 'error' ? <div className={styles.stateMessage} role="alert">
      <span className={styles.stateIcon}><RefreshCw size={14} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>No se pudieron actualizar</strong><small>{errorMessage}</small></span>
      <button className={styles.retryButton} type="button" onClick={() => setReloadKey((value) => value + 1)} aria-label="Reintentar carga de invitaciones"><RefreshCw size={13} aria-hidden="true" /></button>
    </div> : !organization ? <div className={styles.stateMessage}>
      <span className={styles.stateIcon}><MailCheck size={15} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>Elige una organización</strong><small>Aquí verás las invitaciones que esperan respuesta.</small></span>
      <Link className={styles.stateLink} href={organizationHref} aria-label="Ver organizaciones"><ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div> : isPersonal ? <div className={styles.stateMessage}>
      <span className={styles.stateIcon}><ShieldCheck size={15} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>Este espacio es personal</strong><small>Las invitaciones se gestionan dentro de una organización.</small></span>
      <Link className={styles.stateLink} href="/dashboard/organizations" aria-label="Ver organizaciones"><ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div> : !canManage ? <div className={styles.stateMessage}>
      <span className={styles.stateIcon}><ShieldCheck size={15} aria-hidden="true" /></span>
      <span className={styles.stateCopy}><strong>Solo para administradores</strong><small>Un propietario o administrador puede consultar las invitaciones pendientes.</small></span>
      <Link className={styles.stateLink} href={organizationHref} aria-label="Abrir organización"><ArrowUpRight size={13} aria-hidden="true" /></Link>
    </div> : visibleInvitations.length === 0 ? <div className={styles.emptyState}>
      <span className={styles.emptyMark}><MailCheck size={17} aria-hidden="true" /></span>
      <span className={styles.emptyCopy}><strong>Todo al día</strong><small>No hay invitaciones pendientes.</small></span>
      <Link className={styles.inviteLink} href={organizationHref}>Invitar personas <ArrowUpRight size={12} aria-hidden="true" /></Link>
    </div> : <ul className={styles.invitationList} aria-label={`Invitaciones de ${organization.name}`}>
      {visibleInvitations.map((invitation) => {
        const soon = expiresSoon(invitation.expiresAt);
        return <li className={styles.invitationItem} key={invitation.id}>
          <Link className={styles.invitationRow} href={organizationHref} title={`Gestionar la invitación de ${invitation.email}`}>
            <span className={styles.rowCopy}>
              <strong>{invitation.email}</strong>
              <span className={styles.rowMeta}>
                <span className={styles.roleLabel}>{roleName(invitation.role)}</span>
                <span className={styles.expiry} data-soon={soon || undefined}><CalendarClock size={10} aria-hidden="true" />Vence {formatExpiry(invitation.expiresAt)}</span>
              </span>
            </span>
            <ArrowUpRight className={styles.rowArrow} size={13} aria-hidden="true" />
          </Link>
        </li>;
    })}
    </ul>}
  </section>;
}
