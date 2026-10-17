'use client';

import Link from 'next/link';
import { ArrowRight, CalendarClock, CheckCircle2, CircleAlert, Clock3, Flag, ListTodo, RotateCw } from 'lucide-react';
import type { MyDayCard } from '@/lib/myDay';
import styles from './MyOpenCardsWidget.module.css';

type DueTone = 'overdue' | 'today' | 'soon' | 'later' | 'none';
type DueInfo = { label: string; tone: DueTone; date: Date | null; dayOffset: number | null };

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

function dueInfo(value: string | null, today: Date): DueInfo {
  const date = localDate(value);
  if (!date) return { label: 'Sin fecha', tone: 'none', date: null, dayOffset: null };
  const dayOffset = Math.round((date.getTime() - today.getTime()) / 86_400_000);
  if (dayOffset < 0) return { label: dayOffset === -1 ? 'Venció ayer' : `Venció hace ${Math.abs(dayOffset)} días`, tone: 'overdue', date, dayOffset };
  if (dayOffset === 0) return { label: 'Vence hoy', tone: 'today', date, dayOffset };
  if (dayOffset === 1) return { label: 'Mañana', tone: 'soon', date, dayOffset };
  return { label: date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' }).replace('.', ''), tone: 'later', date, dayOffset };
}

function priorityRank(priority: MyDayCard['priority']) {
  return priority === 'HIGH' ? 0 : priority === 'MEDIUM' ? 1 : 2;
}

function cardHref(card: MyDayCard) {
  return `/dashboard/boards/${card.boardId}?cardId=${encodeURIComponent(card.id)}`;
}

function LoadingQueue() {
  return <div className={styles.queueLoading} role="status" aria-label="Cargando tus tarjetas abiertas">
    <div className={styles.loadingOverview}><i /><i /><i /></div>
    <div className={styles.loadingRow}><i /><span><b /><b /></span><em /></div>
    <div className={styles.loadingRow}><i /><span><b /><b /></span><em /></div>
    <div className={styles.loadingRow}><i /><span><b /><b /></span><em /></div>
  </div>;
}

export function MyOpenCardsWidget({ cards, loading, error, onRetry }: {
  cards: MyDayCard[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  const today = startOfToday();
  const openCards = cards.filter((card) => !card.completed).sort((left, right) => {
    const leftDue = localDate(left.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    const rightDue = localDate(right.dueDate)?.getTime() ?? Number.POSITIVE_INFINITY;
    return leftDue - rightDue
      || Number(right.blockedByPendingCount > 0) - Number(left.blockedByPendingCount > 0)
      || priorityRank(left.priority) - priorityRank(right.priority)
      || left.title.localeCompare(right.title, 'es');
  });
  const overdueCount = openCards.filter((card) => (dueInfo(card.dueDate, today).dayOffset ?? 0) < 0).length;
  const todayCount = openCards.filter((card) => dueInfo(card.dueDate, today).dayOffset === 0).length;
  const blockedCount = openCards.filter((card) => card.blockedByPendingCount > 0).length;

  return <section className={styles.openCards} aria-label="Mis tarjetas abiertas" aria-busy={loading}>
    {loading ? <LoadingQueue /> : error ? <div className={styles.queueError} role="alert">
      <span className={styles.stateGlyph}><CircleAlert size={17} /></span>
      <span className={styles.stateCopy}><strong>No pudimos actualizar tus tarjetas</strong><small>Inténtalo de nuevo en un momento.</small></span>
      <button type="button" onClick={onRetry} aria-label="Reintentar carga de tarjetas"><RotateCw size={14} /><span>Reintentar</span></button>
    </div> : openCards.length === 0 ? <div className={styles.queueEmpty}>
      <span className={styles.emptyGlyph}><CheckCircle2 size={19} /></span>
      <span className={styles.stateCopy}><strong>Tu cola está despejada</strong><small>Cuando te asignen una tarjeta, aparecerá aquí.</small></span>
      <Link href="/dashboard/projects">Explorar proyectos <ArrowRight size={13} /></Link>
    </div> : <>
      <div className={styles.queueOverview}>
        <div className={styles.openCount}>
          <strong>{openCards.length.toLocaleString('es-CL')}</strong>
          <span><b>abiertas</b><small>en tus tableros</small></span>
        </div>
        <div className={styles.queueSignals} role="group" aria-label={`${overdueCount} vencidas, ${todayCount} para hoy, ${blockedCount} bloqueadas`}>
          <span data-tone="overdue"><i />{overdueCount} <small>vencidas</small></span>
          <span data-tone="today"><i />{todayCount} <small>hoy</small></span>
          <span data-tone="blocked"><i />{blockedCount} <small>bloqueadas</small></span>
        </div>
      </div>
      <nav className={styles.cardQueue} aria-label={`Tarjetas asignadas, ${openCards.length} abiertas`}>
        {openCards.map((card) => {
          const due = dueInfo(card.dueDate, today);
          const Mark = card.blockedByPendingCount > 0 ? CircleAlert : due.tone === 'overdue' ? Clock3 : card.priority === 'HIGH' ? Flag : ListTodo;
          const priorityLabel = card.priority === 'HIGH' ? 'Prioridad alta' : card.priority === 'MEDIUM' ? 'Prioridad media' : 'Prioridad baja';
          return <Link className={styles.cardRow} data-tone={due.tone} href={cardHref(card)} key={card.id} title={`${card.title} · ${card.boardName} · ${card.listName}`} aria-label={`Abrir ${card.title}, tablero ${card.boardName}, lista ${card.listName}, ${due.label}, ${priorityLabel}${card.blockedByPendingCount > 0 ? `, bloqueada por ${card.blockedByPendingCount} tarjetas` : ''}`}>
            <span className={styles.cardMark} data-priority={card.priority?.toLowerCase() ?? 'low'}><Mark size={14} /></span>
            <span className={styles.cardCopy}>
              <strong>{card.title}</strong>
              <small><span>{card.boardName}</span><i>·</i><span>{card.listName}</span></small>
            </span>
            <span className={styles.cardMeta}>
              <span className={styles.dueBadge} data-tone={due.tone} title={due.date ? due.date.toLocaleDateString('es-CL', { dateStyle: 'long' }) : 'Sin fecha límite'}>
                {due.tone === 'none' ? <CalendarClock size={11} /> : due.tone === 'overdue' ? <Clock3 size={11} /> : <CalendarClock size={11} />}
                {due.label}
              </span>
              {card.blockedByPendingCount > 0 && <span className={styles.blockedBadge} title={`${card.blockedByPendingCount} dependencias pendientes`}><CircleAlert size={11} /><span>Bloqueada</span></span>}
              <ArrowRight className={styles.rowArrow} size={14} />
            </span>
          </Link>;
        })}
      </nav>
      <div className={styles.queueFooter} aria-hidden="true"><span><i /> Lo más urgente aparece primero</span><span>{today.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' }).replace('.', '')}</span></div>
    </>}
  </section>;
}
