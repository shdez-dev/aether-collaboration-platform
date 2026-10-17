'use client';

import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { ArrowRight, ArrowUpRight, CalendarCheck2, ChevronLeft, ChevronRight, Clock3, RotateCcw } from 'lucide-react';
import type { CalendarEvent } from '@/stores/calendarEventStore';
import { addDays, dateKey, overlapsDay, startOfDay, startOfWeek } from '@/app/dashboard/calendar/calendarMath';
import { useCalendarRangeEvents } from '@/components/calendar/useCalendarRangeEvents';
import styles from './WeekAgendaWidget.module.css';

type CalendarSource = CalendarEvent['type'];
type WeekEntry = { event: CalendarEvent; start: Date; end: Date };

const SOURCES: { key: CalendarSource; label: string; color: string }[] = [
  { key: 'personal', label: 'Personal', color: '#9675cc' },
  { key: 'workspace', label: 'Espacios', color: '#66ab91' },
  { key: 'team', label: 'Equipos', color: '#81a4ce' },
];
const weekdayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'short' });
const dateFormat = new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' });
const monthYearFormat = new Intl.DateTimeFormat('es-CL', { month: 'short', year: 'numeric' });
const fullDayFormat = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const timeFormat = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

function capitalize(value: string) { return value.charAt(0).toLocaleUpperCase('es') + value.slice(1); }
function weekdayLabel(date: Date) { return weekdayFormat.format(date).replace('.', '').toLocaleUpperCase('es'); }
function sourceColor(event: CalendarEvent) { return /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : SOURCES.find((source) => source.key === event.type)?.color ?? '#4d9a84'; }
function sourceLabel(source: CalendarSource) { return SOURCES.find((item) => item.key === source)?.label ?? 'Calendario'; }
function dayHref(date: Date) { return `/dashboard/calendar?view=day&at=${encodeURIComponent(date.toISOString())}`; }

function weekPeriodLabel(start: Date) {
  const end = addDays(start, 6);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()} – ${end.getDate()} ${monthYearFormat.format(end)}`;
  }
  return `${dateFormat.format(start)} – ${dateFormat.format(end)} ${end.getFullYear()}`;
}

function eventTime(entry: WeekEntry, day: Date, now: Date) {
  const dayStart = startOfDay(day);
  const nextDay = addDays(dayStart, 1);
  if (entry.event.allDay) return 'Todo el día';
  if (entry.start < dayStart) return entry.start <= now && entry.end > now ? 'En curso · continúa' : 'Continúa';
  if (entry.end > nextDay) return `${timeFormat.format(entry.start)} · continúa`;
  if (entry.start <= now && entry.end > now) return 'En curso';
  return `${timeFormat.format(entry.start)} – ${timeFormat.format(entry.end)}`;
}

function EventSkeleton() {
  return <div className={styles.skeletonList} role="status" aria-label="Cargando agenda semanal">
    {[0, 1].map((row) => <div className={styles.skeletonRow} key={row}><i /><span><b /><small /></span></div>)}
  </div>;
}

export function WeekAgendaWidget() {
  const reduceMotion = useReducedMotion();
  const [selectedDate, setSelectedDate] = useState(() => startOfDay(new Date()));
  const [visibleSources, setVisibleSources] = useState<CalendarSource[]>(SOURCES.map(({ key }) => key));
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const weekStart = useMemo(() => startOfWeek(selectedDate), [selectedDate]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const from = weekStart.toISOString();
  const to = addDays(weekStart, 7).toISOString();
  const { events, loading, error, refresh } = useCalendarRangeEvents(from, to);

  const entries = useMemo(() => events.map((event) => ({ event, start: new Date(event.startTime), end: new Date(event.endTime) }))
    .filter((entry) => Number.isFinite(entry.start.getTime()) && Number.isFinite(entry.end.getTime()) && entry.start < new Date(to) && entry.end > new Date(from))
    .sort((left, right) => left.start.getTime() - right.start.getTime()), [events, from, to]);
  const filteredEntries = useMemo(() => entries.filter(({ event }) => visibleSources.includes(event.type)), [entries, visibleSources]);
  const selectedEntries = filteredEntries.filter((entry) => overlapsDay(entry.start, entry.end, selectedDate));
  const allSelectedEntries = entries.filter((entry) => overlapsDay(entry.start, entry.end, selectedDate));
  const todayKey = dateKey(now);
  const selectedKey = dateKey(selectedDate);
  const selectedLabel = capitalize(fullDayFormat.format(selectedDate));
  const motionKey = `${selectedKey}:${visibleSources.join(',')}`;

  const toggleSource = (source: CalendarSource) => setVisibleSources((current) => current.includes(source)
    ? current.filter((item) => item !== source)
    : [...current, source]);
  const setWeekOffset = (offset: number) => setSelectedDate((current) => addDays(current, offset * 7));
  const goToToday = () => setSelectedDate(startOfDay(new Date()));

  return <section className={styles.widget} aria-label="Agenda de la semana" aria-busy={loading}>
    <header className={styles.header}>
      <div className={styles.heading}>
        <div className={styles.headingCopy}>
          <strong className={styles.headingLabel}>Agenda semanal</strong>
          <small>{weekPeriodLabel(weekStart)}</small>
        </div>
      </div>
      <div className={styles.navigation} aria-label="Navegar semanas">
        <button type="button" onClick={goToToday} className={styles.todayButton} aria-label="Volver a esta semana">Hoy</button>
        <span className={styles.arrowGroup}><button type="button" onClick={() => setWeekOffset(-1)} aria-label="Semana anterior"><ChevronLeft size={15} /></button><button type="button" onClick={() => setWeekOffset(1)} aria-label="Semana siguiente"><ChevronRight size={15} /></button></span>
      </div>
    </header>

    <div className={styles.sourceFilters} role="group" aria-label="Mostrar eventos de">
      {SOURCES.map((source) => {
        const count = entries.filter(({ event }) => event.type === source.key).length;
        const active = visibleSources.includes(source.key);
        return <button key={source.key} type="button" aria-pressed={active} onClick={() => toggleSource(source.key)} style={{ '--source-color': source.color } as CSSProperties}>
          <i />{source.label}<small>{count}</small>
        </button>;
      })}
      {visibleSources.length === 0 && <button type="button" className={styles.resetFilters} onClick={() => setVisibleSources(SOURCES.map(({ key }) => key))}><RotateCcw size={11} /> Mostrar todos</button>}
    </div>

    <div className={styles.weekDays} role="group" aria-label="Seleccionar día">
      {days.map((day) => {
        const dayEntries = filteredEntries.filter((entry) => overlapsDay(entry.start, entry.end, day));
        const dayKey = dateKey(day);
        const isToday = dayKey === todayKey;
        const selected = dayKey === selectedKey;
        return <button key={dayKey} type="button" className={`${styles.dayButton} ${selected ? styles.daySelected : ''} ${isToday ? styles.dayToday : ''}`} aria-pressed={selected} aria-label={`${capitalize(fullDayFormat.format(day))}, ${dayEntries.length} ${dayEntries.length === 1 ? 'evento' : 'eventos'}${isToday ? ', hoy' : ''}`} onClick={() => setSelectedDate(day)}>
          <span className={styles.dayName}>{weekdayLabel(day)}</span>
          <strong>{day.getDate()}</strong>
          {isToday && <small className={styles.todayLabel}>HOY</small>}
          {!isToday && <small className={styles.dayCount}>{dayEntries.length || '·'}</small>}
          <span className={styles.eventDots} aria-hidden="true">{dayEntries.slice(0, 3).map(({ event }) => <i key={event.id} style={{ background: sourceColor(event) }} />)}{dayEntries.length > 3 && <em>+{dayEntries.length - 3}</em>}</span>
        </button>;
      })}
    </div>

    <div className={styles.dayPanel} aria-busy={loading}>
      <div className={styles.dayHeading}>
        <span className={styles.dayHeadingAccent} />
        <strong>{selectedLabel}</strong>
        <span className={styles.daySummary}>{loading && entries.length === 0 ? '…' : `${selectedEntries.length} ${selectedEntries.length === 1 ? 'plan' : 'planes'}`}</span>
      </div>

      {error && <div className={styles.error} role="alert"><span>{error}</span><button type="button" onClick={refresh}>Reintentar</button></div>}
      <div className={styles.dayContent}>
        {loading && entries.length === 0 && !error ? <EventSkeleton /> : selectedEntries.length > 0 ? <motion.div key={motionKey} className={styles.eventList} initial={reduceMotion ? false : { opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={reduceMotion ? undefined : { opacity: 0, y: -3 }} transition={{ duration: reduceMotion ? 0.08 : 0.18, ease: [0.2, 0.7, 0.2, 1] }}>
          {selectedEntries.slice(0, 4).map((entry) => {
            const color = sourceColor(entry.event);
            return <Link key={entry.event.id} href={dayHref(selectedDate)} className={styles.eventRow} style={{ '--event-color': color } as CSSProperties} aria-label={`Abrir ${entry.event.title} en el calendario, ${eventTime(entry, selectedDate, now)}`}>
              <span className={styles.eventTime}><Clock3 size={12} />{eventTime(entry, selectedDate, now)}</span>
              <span className={styles.eventInfo}><strong>{entry.event.title}</strong><small><i />{sourceLabel(entry.event.type)}</small></span>
              <ArrowRight className={styles.eventArrow} size={14} aria-hidden="true" />
            </Link>;
          })}
          {selectedEntries.length > 4 && <Link className={styles.moreEvents} href={dayHref(selectedDate)}>+{selectedEntries.length - 4} eventos más <ArrowRight size={12} /></Link>}
        </motion.div> : !error ? <div className={styles.emptyState}>
          <span className={styles.emptyIcon}><CalendarCheck2 size={17} /></span>
          <span><strong>{allSelectedEntries.length > 0 ? 'No hay eventos con estos filtros' : 'Un espacio para tus planes'}</strong><small>{allSelectedEntries.length > 0 ? 'Activa otro calendario para volver a verlos.' : 'Este día está libre. Puedes revisarlo en tu calendario.'}</small></span>
          {allSelectedEntries.length > 0 && visibleSources.length > 0
            ? <button type="button" onClick={() => setVisibleSources(SOURCES.map(({ key }) => key))} aria-label="Mostrar todos los calendarios"><RotateCcw size={14} /></button>
            : <Link href={dayHref(selectedDate)} aria-label="Abrir este día en el calendario"><ArrowUpRight size={15} /></Link>}
        </div> : null}
      </div>
    </div>

  </section>;
}
