'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BellRing, Check, LoaderCircle, Users, X } from 'lucide-react';
import type { Notification } from '@aether/types';
import { acceptTeamInvitationAndSync } from '@/lib/acceptTeamInvitation';
import { useNotificationStore } from '@/stores/notificationStore';
import styles from './NotificationPopupHost.module.css';

function NotificationPopup({ notification }: { notification: Notification }) {
  const router = useRouter();
  const dismissPopup = useNotificationStore((s) => s.dismissPopup);
  const markAsRead = useNotificationStore((s) => s.markAsRead);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState('');
  const invitationId = notification.data?.invitationId;
  const teamId = notification.data?.teamId;
  const isTeamInvite = notification.type === 'TEAM_INVITE' && Boolean(invitationId);

  useEffect(() => {
    if (accepting || error) return;
    const timer = window.setTimeout(() => dismissPopup(notification.id), 9000);
    return () => window.clearTimeout(timer);
  }, [accepting, dismissPopup, error, notification.id]);

  async function handleAccept() {
    if (!invitationId || accepting) return;
    setAccepting(true);
    setError('');
    try {
      const accepted = await acceptTeamInvitationAndSync(invitationId, {
        teamId,
        workspaceId: notification.data?.workspaceId,
      });
      await markAsRead(notification.id);
      dismissPopup(notification.id);
      router.push(`/dashboard/teams/${accepted.teamId}`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo aceptar la invitación. Inténtalo de nuevo.');
      setAccepting(false);
    }
  }

  const Icon = isTeamInvite ? Users : BellRing;

  return (
    <article className={styles.popup} role="status" aria-live="polite">
      <div className={styles.topline}>
        <span className={styles.icon}><Icon size={17} strokeWidth={1.9} aria-hidden="true" /></span>
        <span className={styles.kind}>{isTeamInvite ? 'Invitación al equipo' : 'Nueva notificación'}</span>
        <button className={styles.close} type="button" aria-label="Cerrar notificación" onClick={() => dismissPopup(notification.id)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      {isTeamInvite ? (
        <div className={styles.content}>
          <strong>{notification.title}</strong>
          <p>{notification.message}</p>
          {error && <p className={styles.error} role="alert">{error}</p>}
          <div className={styles.actions}>
            <button className={styles.accept} type="button" onClick={handleAccept} disabled={accepting}>
              {accepting ? <LoaderCircle size={15} className={styles.spinner} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}
              {accepting ? 'Aceptando…' : 'Aceptar invitación'}
            </button>
            {teamId && <Link className={styles.view} href="/dashboard/notifications" onClick={() => dismissPopup(notification.id)}>Ver notificación</Link>}
          </div>
        </div>
      ) : (
        <Link className={styles.content} href="/dashboard/notifications" onClick={() => dismissPopup(notification.id)}>
          <strong>{notification.title}</strong>
          <p>{notification.message}</p>
          <span className={styles.open}>Abrir notificaciones</span>
        </Link>
      )}
    </article>
  );
}

export function NotificationPopupHost({ sidebarCompact }: { sidebarCompact: boolean }) {
  const notifications = useNotificationStore((s) => s.popupNotifications);

  if (notifications.length === 0) return null;

  return (
    <div className={styles.host} data-sidebar-compact={sidebarCompact} aria-label="Notificaciones recientes">
      {notifications.map((notification) => <NotificationPopup key={notification.id} notification={notification} />)}
    </div>
  );
}
