'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, CalendarClock, Clock3, RefreshCw } from 'lucide-react';
import type { CalendarEvent } from '@/stores/calendarEventStore';
import { useCalendarRangeEvents } from '@/components/calendar/useCalendarRangeEvents';
import styles from './UpcomingEventsWidget.module.css';

const HORIZON_DAYS = 30;
const EVENT_SOURCE_COLORS: Record<CalendarEvent['type'], string> = {
  personal: '#9675cc',
  workspace: '#66ab91',
  team: '#81a4ce',
};
const weekdayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'short' });
const monthFormat = new Intl.DateTimeFormat('es-CL', { month: 'short' });
const timeFormat = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const dateRangeFormat = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateKey(date: Date) {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function eventColor(event: CalendarEvent) {
  return /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : EVENT_SOURCE_COLORS[event.type];
}

function sourceLabel(type: CalendarEvent['type']) {
  if (type === 'workspace') return 'Espacio';
  if (type === 'team') return 'Equipo';
  return 'Personal';
}

function dateHref(date: Date) {
  return `/dashboard/calendar?view=day&at=${encodeURIComponent(date.toISOString())}`;
}

function eventTime(event: CalendarEvent, start: Date, end: Date, now: Date) {
  if (event.allDay) return 'Todo el día';
  if (start <= now && end > now) return 'En curso';
  return `${timeFormat.format(start)} – ${timeFormat.format(end)}`;
}

function relativeDay(date: Date, today: Date) {
  const difference = Math.round((startOfDay(date).getTime() - today.getTime()) / 86_400_000);
  if (difference === 0) return 'Hoy';
  if (difference === 1) return 'Mañana';
  return weekdayFormat.format(date).replace('.', '');
}

function LoadingRows() {
  return <div className={styles.loadingList} role="status" aria-label="Cargando próximos eventos">
    {[0, 1, 2].map((item) => <div key={item} className={styles.skeletonRow}><i /><span><b /><small /></span></div>)}
  </div>;
}

export function UpcomingEventsWidget() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const start = startOfDay(now);
  const end = new Date(start);
  end.setDate(end.getDate() + HORIZON_DAYS);
  const from = start.toISOString();
  const to = end.toISOString();
  const { events, loading, error, refresh } = useCalendarRangeEvents(from, to);

  const upcoming = useMemo(() => events.map((event) => ({
    event,
    start: new Date(event.startTime),
    end: new Date(event.endTime),
  })).filter(({ start, end }) => Number.isFinite(start.getTime()) && Number.isFinite(end.getTime()) && end > now && start < new Date(to))
    .sort((left, right) => left.start.getTime() - right.start.getTime()), [events, now, to]);

  const rangeLabel = `${dateRangeFormat.format(start)} – ${dateRangeFormat.format(new Date(end.getTime() - 1))}`;

  return <section className={styles.widget} aria-label="Próximos eventos" aria-busy={loading}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.headingCopy}>
          <strong className={styles.headingLabel}>Próximos eventos</strong>
        </div>
      </div>
      <Link href="/dashboard/calendar?view=agenda" className={styles.openCalendar}>Ver agenda <ArrowUpRight size={14} /></Link>
    </header>

    <div className={styles.range}><span><i /> {rangeLabel}</span></div>

    <div className={styles.content}>
      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={refresh} aria-label="Reintentar carga de eventos"><RefreshCw size={14} /> Reintentar</button></div>}
      {loading && upcoming.length === 0 && !error ? <LoadingRows /> : upcoming.length > 0 ? <div className={styles.eventList} role="list">
        {upcoming.slice(0, 4).map(({ event, start: eventStart, end: eventEnd }, index) => {
          const color = eventColor(event);
          const sameDay = dateKey(eventStart) === dateKey(start);
          const current = !event.allDay && eventStart <= now && eventEnd > now;
          return <Link key={event.id} role="listitem" href={dateHref(eventStart)} className={`${styles.eventRow} ${index === 0 ? styles.nextEvent : ''}`} style={{ '--event-color': color } as CSSProperties} aria-label={`Abrir ${event.title} en el calendario, ${relativeDay(eventStart, start)}${event.allDay ? ', todo el día' : `, ${timeFormat.format(eventStart)}`}`}>
            <time className={`${styles.dateBadge} ${sameDay ? styles.todayBadge : ''}`} dateTime={event.startTime}>
              <span>{relativeDay(eventStart, start)}</span><strong>{eventStart.getDate()}</strong><small>{monthFormat.format(eventStart).replace('.', '')}</small>
            </time>
            <span className={styles.eventDetails}>
              {index === 0 && <span className={styles.nextLabel}>{current ? 'EN CURSO' : sameDay ? 'HOY' : 'SIGUIENTE'}</span>}
              <strong className={styles.eventTitle}>{event.title}</strong>
              <span className={styles.eventMeta}><span className={current ? styles.inProgress : ''}><Clock3 size={12} />{eventTime(event, eventStart, eventEnd, now)}</span><small>{sourceLabel(event.type)}</small></span>
            </span>
            <ArrowRight className={styles.eventArrow} size={15} aria-hidden="true" />
          </Link>;
        })}
      </div> : !error ? <div className={styles.emptyState}>
        <span className={styles.emptyIcon}><CalendarClock size={20} strokeWidth={1.7} /></span>
        <span><strong>Tu agenda tiene espacio</strong><small>Cuando llegue un plan, lo verás aquí.</small></span>
        <Link href="/dashboard/calendar?view=agenda" aria-label="Abrir agenda"><ArrowUpRight size={15} /></Link>
      </div> : null}
    </div>

  </section>;
}
