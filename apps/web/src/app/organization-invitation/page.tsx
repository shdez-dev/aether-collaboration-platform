'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Building2, Check, CircleAlert, LoaderCircle, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import styles from './page.module.css';

type InvitationPreview = {
  id: string;
  organizationId: string;
  organizationName: string;
  email: string;
  role: string;
  expiresAt: string;
};

const roleLabels: Record<string, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  BILLING_ADMIN: 'Administración de facturación',
  MEMBER: 'Miembro',
};

export default function OrganizationInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const invitationId = searchParams.get('invitationId') ?? '';
  const { isAuthenticated, isHydrated, user } = useAuthStore();
  const setActiveWorkspaceId = useActiveWorkspaceStore((state) => state.setActiveWorkspaceId);
  const fetchWorkspaces = useWorkspaceStore((state) => state.fetchWorkspaces);
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);
  const [loadingAccept, setLoadingAccept] = useState(false);
  const [error, setError] = useState('');
  const [accepted, setAccepted] = useState(false);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const referenceIsValid = Boolean(token || invitationId);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      const reference = token
        ? `token=${encodeURIComponent(token)}`
        : `invitationId=${encodeURIComponent(invitationId)}`;
      router.replace(`/login?next=${encodeURIComponent(`/organization-invitation?${reference}`)}`);
    }
  }, [isAuthenticated, isHydrated, invitationId, router, token]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !referenceIsValid) return;
    let active = true;
    const reference = token
      ? `token=${encodeURIComponent(token)}`
      : `invitationId=${encodeURIComponent(invitationId)}`;
    setLoadingPreview(true);
    setError('');
    apiService.get<{ invitation: InvitationPreview }>(`/api/organizations/invitations/preview?${reference}`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data?.invitation) {
          setError(response.error?.message ?? 'Esta invitación ya no está disponible para esta cuenta.');
          return;
        }
        setInvitation(response.data.invitation);
      })
      .catch(() => {
        if (active) setError('No pudimos cargar la invitación. Verifica tu conexión e inténtalo otra vez.');
      })
      .finally(() => { if (active) setLoadingPreview(false); });
    return () => { active = false; };
  }, [isAuthenticated, isHydrated, invitationId, referenceIsValid, token]);

  async function acceptInvitation() {
    if (!invitation) return;
    setLoadingAccept(true);
    setError('');
    const endpoint = invitationId
      ? `/api/organizations/invitations/by-id/${encodeURIComponent(invitation.id)}/accept`
      : `/api/organizations/invitations/${encodeURIComponent(token)}/accept`;
    try {
      const response = await apiService.post<{ organizationId: string; workspaceId: string | null }>(endpoint, {}, true);
      if (!response.success || !response.data?.organizationId) {
        setError(response.error?.message ?? 'No fue posible aceptar la invitación.');
        return;
      }
      setHasWorkspace(Boolean(response.data.workspaceId));
      if (response.data.workspaceId) setActiveWorkspaceId(response.data.workspaceId);
      window.dispatchEvent(new Event('aether:organizations-changed'));
      fetchWorkspaces().catch(() => {});
      setAccepted(true);
    } catch {
      setError('No pudimos aceptar la invitación. Verifica tu conexión e inténtalo otra vez.');
    } finally {
      setLoadingAccept(false);
    }
  }

  if (!isHydrated || !isAuthenticated) return null;

  return (
    <div className={styles.page}>
      <div className={styles.ambient} aria-hidden="true" />
      <div className={styles.shell}>
        <header className={styles.header}>
          <a href="/dashboard" className={styles.brand} aria-label="AETHER, ir al panel">
            <BrandMark size={34} tone="light" />
            <span>AETHER</span>
          </a>
          <div className={styles.account}>
            <span className={styles.accountDot} />
            <span>{user?.email ?? 'Sesión iniciada'}</span>
          </div>
        </header>

        <div className={styles.main}>
          <section className={styles.card} aria-labelledby="invitation-title">
            <div className={styles.cardTop}>
              <div className={`${styles.mark} ${accepted ? styles.markSuccess : ''}`}>
                {accepted ? <Check size={25} strokeWidth={2.2} /> : <Building2 size={25} strokeWidth={1.8} />}
              </div>
              <div className={styles.intro}>
                <p className={styles.kicker}>{accepted ? 'Acceso confirmado' : 'Invitación de organización'}</p>
                <h1 id="invitation-title">{accepted ? 'Ya formas parte' : 'Te invitaron a colaborar'}</h1>
                <p className={styles.subtitle}>
                  {accepted
                    ? `Tu acceso a ${invitation?.organizationName ?? 'la organización'} quedó listo.`
                    : 'Revisa los detalles antes de unirte a este espacio de trabajo compartido.'}
                </p>
              </div>
            </div>

            <div className={styles.content}>
              {!referenceIsValid ? (
                <div className={styles.stateError} role="alert">
                  <CircleAlert size={19} />
                  <span>El enlace no contiene una invitación válida. Pide que te envíen uno nuevo.</span>
                </div>
              ) : loadingPreview ? (
                <div className={styles.loading} role="status"><LoaderCircle size={19} />Cargando invitación</div>
              ) : invitation ? (
                <>
                  <div className={styles.organization}>
                    <span className={styles.organizationIcon}><Building2 size={19} /></span>
                    <div className={styles.organizationText}>
                      <span>Organización</span>
                      <strong>{invitation.organizationName}</strong>
                    </div>
                    <span className={styles.role}>{roleLabels[invitation.role] ?? invitation.role}</span>
                  </div>

                  <div className={styles.recipient}>
                    <ShieldCheck size={18} aria-hidden="true" />
                    <p>
                      Esta invitación es para <strong>{invitation.email}</strong>. Estás usando esa cuenta, así que puedes continuar.
                    </p>
                  </div>

                  {error && <div className={styles.stateError} role="alert"><CircleAlert size={18} /><span>{error}</span></div>}

                  {accepted ? (
                    <div className={styles.successActions}>
                      <p>{hasWorkspace ? 'Ya tienes acceso al espacio de trabajo asignado.' : 'Podrás entrar a los espacios que te asignen desde la organización.'}</p>
                      <button className={styles.primaryButton} type="button" onClick={() => router.push(hasWorkspace ? '/dashboard' : '/dashboard/organizations')}>
                        {hasWorkspace ? 'Ir al espacio' : 'Ver organización'}<ArrowRight size={17} />
                      </button>
                    </div>
                  ) : (
                    <div className={styles.actions}>
                      <p>Al aceptar, la organización aparecerá en tu selector de espacios.</p>
                      <button className={styles.primaryButton} type="button" onClick={acceptInvitation} disabled={loadingAccept}>
                        {loadingAccept ? <><LoaderCircle className={styles.buttonSpinner} size={17} />Aceptando</> : <>Aceptar invitación<ArrowRight size={17} /></>}</button>
                    </div>
                  )}
                </>
              ) : (
                <div className={styles.stateError} role="alert"><CircleAlert size={19} /><span>{error || 'No pudimos encontrar esta invitación.'}</span></div>
              )}
            </div>
            <footer className={styles.cardFooter}>
              <span>Las invitaciones solo se aceptan con el correo al que fueron enviadas.</span>
              <a href="/dashboard">Volver a AETHER</a>
            </footer>
          </section>
          <p className={styles.pageNote}>Colaboración clara para que el trabajo avance en conjunto.</p>
        </div>
      </div>
    </div>
  );
}
