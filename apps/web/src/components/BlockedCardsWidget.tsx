'use client';

import Link from 'next/link';
import {
  ArrowDownRight, ArrowRight, CalendarClock, CheckCircle2, CircleAlert,
  GitBranch, RotateCw, Unplug,
} from 'lucide-react';
import type { MyDayCard } from '@/lib/myDay';
import styles from './BlockedCardsWidget.module.css';

function localDate(value: string | null): Date | null {
  if (!value) return null;
  const datePart = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  const parsed = datePart
    ? new Date(Number(datePart[1]), Number(datePart[2]) - 1, Number(datePart[3]))
    : new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
}

function startOfToday() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

function dueLabel(value: string | null, today: Date) {
  const date = localDate(value);
  if (!date) return { label: 'Sin fecha', overdue: false };
  const offset = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (offset < 0) return { label: offset === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(offset)} d`, overdue: true };
  if (offset === 0) return { label: 'Vence hoy', overdue: false };
  if (offset === 1) return { label: 'Mañana', overdue: false };
  return { label: date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', ''), overdue: false };
}

function cardHref(card: MyDayCard) {
  return `/dashboard/boards/${card.boardId}?cardId=${encodeURIComponent(card.id)}`;
}

function BlockedLoading() {
  return <div className={styles.loading} role="status" aria-label="Buscando tarjetas bloqueadas">
    <div className={styles.loadingSignal}><i /><span /><b /></div>
    {[0, 1, 2].map((item) => <div className={styles.loadingCard} key={item}><i /><span><b /><em /></span><small /></div>)}
  </div>;
}

export function BlockedCardsWidget({ cards, loading, error, onRetry }: {
  cards: MyDayCard[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const today = startOfToday();
  const blocked = cards.filter((card) => !card.completed && card.blockedByPendingCount > 0).sort((left, right) => {
    const leftDue = localDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDue = localDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const leftOverdue = Number(leftDue < today.getTime());
    const rightOverdue = Number(rightDue < today.getTime());
    return rightOverdue - leftOverdue
      || right.blockedByPendingCount - left.blockedByPendingCount
      || leftDue - rightDue
      || left.title.localeCompare(right.title, 'es');
  });
  const dependencyCount = blocked.reduce((sum, card) => sum + card.blockedByPendingCount, 0);
  const overdueCount = blocked.filter((card) => {
    const due = localDate(card.dueDate);
    return due !== null && due < today;
  }).length;

  return <section className={styles.blockedWidget} aria-label="Tarjetas bloqueadas" aria-busy={loading}>
    {loading ? <BlockedLoading /> : error ? <div className={styles.statePanel} role="alert">
      <span className={styles.stateIcon}><CircleAlert size={18} /></span>
      <span className={styles.stateCopy}><strong>No pudimos leer las dependencias</strong><small>Vuelve a intentarlo para actualizar el radar.</small></span>
      <button type="button" onClick={onRetry} aria-label="Reintentar carga de tarjetas bloqueadas"><RotateCw size={14} /><span>Reintentar</span></button>
    </div> : blocked.length === 0 ? <div className={styles.clearState}>
      <div className={styles.clearDiagram} aria-hidden="true"><span><CheckCircle2 size={17} /></span><i /><i /><i /></div>
      <div className={styles.stateCopy}><strong>El flujo está despejado</strong><small>Cuando una tarjeta quede a la espera de otra, aparecerá aquí.</small></div>
      <Link href="/dashboard/projects">Ver tableros <ArrowRight size={13} /></Link>
    </div> : <>
      <div className={styles.radarHeader}>
        <div className={styles.blockedCount}><strong>{String(blocked.length).padStart(2, '0')}</strong><span><b>{blocked.length === 1 ? 'tarjeta detenida' : 'tarjetas detenidas'}</b><small>en tus tableros</small></span></div>
        <div className={styles.dependencyTotal}><GitBranch size={14} /><strong>{dependencyCount}</strong><span>{dependencyCount === 1 ? 'dependencia' : 'dependencias'}</span></div>
      </div>

      <div className={styles.radarRail} aria-hidden="true"><span /><i /><i /><i /><b>{overdueCount > 0 ? <ArrowDownRight size={12} /> : <Unplug size={12} />}</b></div>

      <div className={styles.blockedList} aria-label={`${blocked.length} tarjetas detenidas`}>
        {blocked.map((card, index) => {
          const due = dueLabel(card.dueDate, today);
          return <Link className={styles.blockedCard} href={cardHref(card)} key={card.id} data-overdue={due.overdue || undefined} aria-label={`Abrir ${card.title}, ${card.blockedByPendingCount} dependencias pendientes, tablero ${card.boardName}, lista ${card.listName}, ${due.label}`}>
            <span className={styles.nodeColumn} aria-hidden="true"><i>{index + 1}</i><b /></span>
            <span className={styles.cardDetails}>
              <strong>{card.title}</strong>
              <small><span>{card.boardName}</span><i>·</i><span>{card.listName}</span></small>
            </span>
            <span className={styles.cardFacts}>
              <span className={styles.dependencyBadge}><GitBranch size={11} /><b>{card.blockedByPendingCount}</b><small>{card.blockedByPendingCount === 1 ? 'pendiente' : 'pendientes'}</small></span>
              <span className={styles.dueBadge} data-overdue={due.overdue || undefined}><CalendarClock size={11} />{due.label}</span>
              <ArrowRight className={styles.cardArrow} size={14} />
            </span>
          </Link>;
        })}
      </div>

      <div className={styles.radarFooter}><span><i />{overdueCount ? `${overdueCount} ${overdueCount === 1 ? 'vencida' : 'vencidas'} dentro de los bloqueos` : 'Ordenadas por impacto y fecha'}</span><span>Abre una tarjeta para revisar su ruta</span></div>
    </>}
  </section>;
}
