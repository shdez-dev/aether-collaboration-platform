'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Link from 'next/link';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, PanelLeft, Plus, Search, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';
import { useCalendarEventStore, type CalendarEvent } from '@/stores/calendarEventStore';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import { addDays, clippedMinutes, dateKey, HOUR_HEIGHT, layoutTimedSegments, monthDays, overlapsDay, startOfDay, startOfWeek } from './calendarMath';
import styles from './page.module.css';

type View = 'day' | 'week' | 'month' | 'agenda';
type Source = 'personal' | 'workspace' | 'team' | 'deadline';
type AssignedCard = {
  id: string; title: string; dueDate: string | null; completed: boolean;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | null; boardId: string;
  boardName: string; workspaceName: string;
};
type CalendarItem = {
  id: string; kind: 'event' | 'card'; title: string; start: Date; end: Date;
  allDay: boolean; source: Source; color: string;
  event?: CalendarEvent; card?: AssignedCard;
};
type CreateContext = { date: string; hour?: number; minute?: number; allDay?: boolean };

const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const VIEWS: { key: View; label: string }[] = [
  { key: 'day', label: 'Día' }, { key: 'week', label: 'Semana' },
  { key: 'month', label: 'Mes' }, { key: 'agenda', label: 'Agenda' },
];
const SOURCES: { key: Source; label: string; color: string }[] = [
  { key: 'personal', label: 'Personal', color: '#8262B2' },
  { key: 'workspace', label: 'Espacios', color: '#548B73' },
  { key: 'team', label: 'Equipos', color: '#7D91B1' },
  { key: 'deadline', label: 'Entregas', color: '#B45C72' },
];

const dayFormatter = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const monthFormatter = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });
const timeFormatter = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const formatTime = (date: Date) => timeFormatter.format(date);
const capitalizeFirst = (value: string) => value.charAt(0).toLocaleUpperCase('es') + value.slice(1);

function periodTitle(date: Date, view: View): string {
  if (view === 'day') return capitalizeFirst(dayFormatter.format(date));
  if (view === 'month') return capitalizeFirst(monthFormatter.format(date));
  if (view === 'agenda') return `Desde el ${dayFormatter.format(date)}`;
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  const firstMonth = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(first);
  const lastMonth = new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(last);
  return first.getMonth() === last.getMonth()
    ? `${first.getDate()}–${last.getDate()} de ${firstMonth} de ${last.getFullYear()}`
    : `${first.getDate()} de ${firstMonth} – ${last.getDate()} de ${lastMonth} de ${last.getFullYear()}`;
}

function compactPeriodTitle(date: Date, view: View): string {
  const shortMonth = (day: Date) => new Intl.DateTimeFormat('es-CL', { month: 'short' }).format(day);
  if (view === 'day') return `${date.getDate()} ${shortMonth(date)}`;
  if (view === 'month') return `${shortMonth(date)} ${date.getFullYear()}`;
  if (view === 'agenda') return `Desde ${date.getDate()} ${shortMonth(date)}`;
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  return `${first.getDate()}–${last.getDate()} ${shortMonth(last)}`;
}

function sourceColor(event: CalendarEvent): string {
  return /^#[0-9a-f]{6}$/i.test(event.color) ? event.color
    : SOURCES.find((source) => source.key === event.type)?.color ?? '#8262B2';
}

function timeRange(item: CalendarItem) {
  if (item.kind === 'card') return 'Fecha límite';
  return item.allDay ? 'Todo el día' : `${formatTime(item.start)}–${formatTime(item.end)}`;
}

function CalendarPill({ item, onClick, compact = false }: { item: CalendarItem; onClick: () => void; compact?: boolean }) {
  return <button type="button" className={`${styles.pill} ${compact ? styles.pillCompact : ''}`} style={{ '--item-color': item.color } as CSSProperties} title={`${item.title} | ${timeRange(item)}`} onClick={(event) => { event.stopPropagation(); onClick(); }}>
    <span className={styles.pillDot} /><span className={styles.pillText}>{item.title}</span>{!compact && <small>{timeRange(item)}</small>}
  </button>;
}

function MiniCalendar({ date, onSelect }: { date: Date; onSelect: (date: Date) => void }) {
  const [displayMonth, setDisplayMonth] = useState(() => new Date(date.getFullYear(), date.getMonth(), 1));
  useEffect(() => { setDisplayMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }, [date]);
  const today = dateKey(new Date());
  return <div className={styles.miniCalendar}>
    <div className={styles.miniHeader}>
      <strong>{capitalizeFirst(new Intl.DateTimeFormat('es-CL', { month: 'long' }).format(displayMonth))} {displayMonth.getFullYear()}</strong>
      <div><button type="button" aria-label="Mes anterior" onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() - 1, 1))}><ChevronLeft size={15} /></button><button type="button" aria-label="Mes siguiente" onClick={() => setDisplayMonth(new Date(displayMonth.getFullYear(), displayMonth.getMonth() + 1, 1))}><ChevronRight size={15} /></button></div>
    </div>
    <div className={styles.miniGrid} key={dateKey(displayMonth)}>
      {DAY_NAMES.map((day) => <span className={styles.miniWeekday} key={day}>{day.charAt(0)}</span>)}
      {monthDays(displayMonth).map((day) => {
        const key = dateKey(day);
        const isSelected = key === dateKey(date);
        return <button type="button" key={key} aria-label={dayFormatter.format(day)} aria-pressed={isSelected} className={`${styles.miniDay} ${day.getMonth() !== displayMonth.getMonth() ? styles.miniOutside : ''} ${isSelected ? styles.miniSelected : ''} ${key === today ? styles.miniToday : ''}`} onClick={() => onSelect(day)}>{day.getDate()}</button>;
      })}
    </div>
  </div>;
}

function TimeGrid({ days, items, selectedDate, onDateSelect, onSlotClick, onItemClick }: {
  days: Date[]; items: CalendarItem[]; selectedDate: Date;
  onDateSelect: (date: Date) => void;
  onSlotClick: (date: Date, hour: number, minute: number) => void;
  onItemClick: (item: CalendarItem) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState(() => new Date());
  const [hoverSlot, setHoverSlot] = useState<{ day: string; minute: number } | null>(null);
  const isWeek = days.length === 7;

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, []);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = Math.max(0, (days.some((day) => dateKey(day) === dateKey(new Date())) ? new Date().getHours() - 2 : 7) * HOUR_HEIGHT);
  }, [days, isWeek, selectedDate]);

  const allDayByDate = (day: Date) => items.filter((item) => (item.allDay || item.kind === 'card') && (item.kind === 'card' ? dateKey(item.start) === dateKey(day) : overlapsDay(item.start, item.end, day)));
  const timedByDate = (day: Date) => layoutTimedSegments(items.flatMap((item) => {
    if (item.allDay || item.kind === 'card') return [];
    const segment = clippedMinutes(item.start, item.end, day);
    return segment ? [{ id: item.id, item, ...segment }] : [];
  }));

  return <div className={styles.timeView}>
    <div className={styles.timeViewInner} ref={scrollRef} style={{ minWidth: isWeek ? 780 : 360 }}>
      <div className={styles.dayHeader} style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className={styles.zoneLabel}>GMT{new Date().getTimezoneOffset() > 0 ? '-' : '+'}{Math.abs(new Date().getTimezoneOffset() / 60)}</div>
        {days.map((day) => <button type="button" key={dateKey(day)} className={`${styles.dayHeading} ${dateKey(day) === dateKey(now) ? styles.dayHeadingToday : ''}`} onClick={() => onDateSelect(day)}>
          <span>{new Intl.DateTimeFormat('es-CL', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong>
        </button>)}
      </div>
      <div className={styles.allDayRow} style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))` }}>
        <div className={styles.allDayLabel}>Todo el día</div>
        {days.map((day) => {
          const entries = allDayByDate(day);
          return <div className={styles.allDayCell} key={dateKey(day)} title="Haz clic para crear un evento de todo el día" onClick={() => onSlotClick(day, -1, 0)}>
            {entries.slice(0, 3).map((item) => <CalendarPill key={item.id} item={item} compact onClick={() => onItemClick(item)} />)}
            {entries.length > 3 && <button className={styles.more} onClick={(event) => { event.stopPropagation(); onDateSelect(day); }}>+{entries.length - 3} más</button>}
          </div>;
        })}
      </div>
      <div className={styles.timeScroll}>
        <div className={styles.timeCanvas} style={{ gridTemplateColumns: `64px repeat(${days.length}, minmax(0, 1fr))`, height: HOUR_HEIGHT * 24 }}>
          <div className={styles.hours}>{Array.from({ length: 24 }, (_, hour) => <span className={styles.hourLabel} key={hour} style={{ top: hour * HOUR_HEIGHT - 7 }}>{hour === 0 ? '' : `${String(hour).padStart(2, '0')}:00`}</span>)}</div>
          {days.map((day) => {
            const isToday = dateKey(day) === dateKey(now);
            const segments = timedByDate(day);
            return <div className={`${styles.dayColumn} ${isToday ? styles.dayColumnToday : ''}`} key={dateKey(day)} onPointerMove={(event) => {
              if (event.pointerType !== 'mouse' || (event.target as HTMLElement).closest('[data-calendar-item]')) { setHoverSlot(null); return; }
              const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
              const minute = Math.max(0, Math.min(1410, Math.floor(top / (HOUR_HEIGHT / 2)) * 30));
              setHoverSlot((current) => current?.day === dateKey(day) && current.minute === minute ? current : { day: dateKey(day), minute });
            }} onPointerLeave={() => setHoverSlot(null)} onClick={(event) => {
              if ((event.target as HTMLElement).closest('[data-calendar-item]')) return;
              const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
              const minutes = Math.max(0, Math.min(1410, Math.floor(top / (HOUR_HEIGHT / 2)) * 30));
              onSlotClick(day, Math.floor(minutes / 60), minutes % 60);
            }}>
              {hoverSlot?.day === dateKey(day) && <div className={styles.slotPreview} style={{ top: hoverSlot.minute / 60 * HOUR_HEIGHT }}><Plus size={11} /> {String(Math.floor(hoverSlot.minute / 60)).padStart(2, '0')}:{String(hoverSlot.minute % 60).padStart(2, '0')}</div>}
              {isToday && <div className={styles.nowLine} style={{ top: (now.getHours() * 60 + now.getMinutes()) / 60 * HOUR_HEIGHT }}><span /></div>}
              {segments.map(({ item, startMinute, endMinute, column, columns }) => <button key={item.id} type="button" data-calendar-item className={styles.timeEvent} style={{
                top: startMinute / 60 * HOUR_HEIGHT + 2,
                height: Math.max(24, (endMinute - startMinute) / 60 * HOUR_HEIGHT - 4),
                left: `calc(${column} * 100% / ${columns} + 3px)`,
                width: `calc(100% / ${columns} - 6px)`,
                '--item-color': item.color,
              } as CSSProperties} onClick={(event) => { event.stopPropagation(); onItemClick(item); }} title={`${item.title} | ${timeRange(item)}`}>
                <strong>{item.title}</strong><span>{formatTime(item.start)}–{formatTime(item.end)}</span>
              </button>)}
            </div>;
          })}
        </div>
      </div>
    </div>
  </div>;
}

function MonthGrid({ date, items, onDateSelect, onCreate, onItemClick }: {
  date: Date; items: CalendarItem[]; onDateSelect: (date: Date) => void;
  onCreate: (date: Date) => void; onItemClick: (item: CalendarItem) => void;
}) {
  const days = monthDays(date);
  const today = dateKey(new Date());
  return <div className={styles.monthScroll}><div className={styles.monthGrid}>
    {DAY_NAMES.map((name) => <div className={styles.monthWeekday} key={name}>{name}</div>)}
    {days.map((day) => {
      const key = dateKey(day);
      const entries = items.filter((item) => item.kind === 'card' ? dateKey(item.start) === key : overlapsDay(item.start, item.end, day));
      return <div className={`${styles.monthCell} ${day.getMonth() !== date.getMonth() ? styles.monthOutside : ''} ${key === today ? styles.monthToday : ''}`} key={key} onClick={() => onDateSelect(day)}>
        <div className={styles.monthCellHead}><button type="button" className={styles.monthDate} onClick={(event) => { event.stopPropagation(); onDateSelect(day); }}>{day.getDate()}</button><button type="button" className={styles.monthAdd} aria-label={`Crear evento el ${dayFormatter.format(day)}`} onClick={(event) => { event.stopPropagation(); onCreate(day); }}><Plus size={13} /></button></div>
        <div className={styles.monthItems}>{entries.slice(0, 4).map((item) => <CalendarPill key={item.id} item={item} compact onClick={() => onItemClick(item)} />)}{entries.length > 4 && <button className={styles.more} onClick={(event) => { event.stopPropagation(); onDateSelect(day); }}>+{entries.length - 4} más</button>}</div>
      </div>;
    })}
  </div></div>;
}

function AgendaView({ date, items, onItemClick, onCreate }: { date: Date; items: CalendarItem[]; onItemClick: (item: CalendarItem) => void; onCreate: (date: Date) => void }) {
  const days = Array.from({ length: 30 }, (_, index) => addDays(date, index));
  const daysWithItems = days.map((day) => ({ day, entries: items.filter((item) => item.kind === 'card' ? dateKey(item.start) === dateKey(day) : overlapsDay(item.start, item.end, day)) })).filter(({ entries }) => entries.length > 0);
  if (daysWithItems.length === 0) return <div className={styles.agendaEmpty}><CalendarDays size={28} /><h2>No hay compromisos en los próximos 30 días</h2><p>Puedes crear un evento o añadir una fecha límite a una tarjeta.</p><button onClick={() => onCreate(date)}>Crear evento</button></div>;
  return <div className={styles.agendaScroll}>{daysWithItems.map(({ day, entries }) => <section className={styles.agendaGroup} key={dateKey(day)}><div className={styles.agendaDate}><strong>{day.getDate()}</strong><span>{new Intl.DateTimeFormat('es-CL', { weekday: 'long', month: 'long' }).format(day)}</span></div><div className={styles.agendaItems}>{entries.sort((a, b) => a.start.getTime() - b.start.getTime()).map((item) => <button type="button" key={item.id} className={styles.agendaItem} onClick={() => onItemClick(item)}><span className={styles.agendaStripe} style={{ background: item.color }} /><span className={styles.agendaTime}>{timeRange(item)}</span><span className={styles.agendaTitle}>{item.title}<small>{item.kind === 'card' ? item.card?.boardName : item.source === 'personal' ? 'Personal' : item.source === 'workspace' ? 'Espacio' : 'Equipo'}</small></span><ChevronRight size={16} /></button>)}</div></section>)}</div>;
}

function ItemDetail({ item, userId, closing, onClose, onEdit, onDelete }: { item: CalendarItem; userId?: string; closing: boolean; onClose: () => void; onEdit: () => void; onDelete: () => Promise<boolean> }) {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState(false);
  const canEdit = item.kind === 'event' && item.event?.createdBy === userId;
  return <div className={`${styles.detailBackdrop} ${closing ? styles.detailBackdropClosing : ''}`} onClick={onClose}><section role="dialog" aria-modal="true" aria-label={item.title} className={`${styles.detail} ${closing ? styles.detailClosing : ''}`} onClick={(event) => event.stopPropagation()}>
    <div className={styles.detailAccent} style={{ background: item.color }} /><button className={styles.detailClose} onClick={onClose} aria-label="Cerrar"><X size={17} /></button>
    <span className={styles.detailKind}>{item.kind === 'card' ? 'FECHA LÍMITE' : item.source === 'personal' ? 'PERSONAL' : item.source === 'workspace' ? 'ESPACIO' : 'EQUIPO'}</span><h2>{item.title}</h2>
    <div className={styles.detailRow}><CalendarDays size={17} /><span>{dayFormatter.format(item.start)}{dateKey(item.start) !== dateKey(item.end) && item.kind === 'event' ? ` – ${dayFormatter.format(item.end)}` : ''}</span></div>
    <div className={styles.detailRow}><Clock3 size={17} /><span>{timeRange(item)}</span></div>
    {item.event?.description && <p className={styles.detailDescription}>{item.event.description}</p>}
    {item.event && item.event.attendees.length > 0 && <div className={styles.attendees}><span>Participantes</span><div>{item.event.attendees.map((attendee) => <span key={attendee.id}>{attendee.name}</span>)}</div></div>}
    {item.card && <p className={styles.detailDescription}>Tablero: {item.card.boardName}<br />Espacio: {item.card.workspaceName}</p>}
    {deleteError && <p className={styles.detailError} role="alert">No se pudo eliminar el evento. Inténtalo de nuevo.</p>}
    <div className={styles.detailActions}>{item.card && <Link href={`/dashboard/boards/${item.card.boardId}`} className={styles.primaryAction}>Abrir tablero</Link>}{canEdit && <><button className={styles.primaryAction} onClick={onEdit}>Editar evento</button><button className={styles.deleteAction} disabled={deleting} onClick={async () => { setDeleting(true); setDeleteError(false); const deleted = await onDelete(); if (!deleted) setDeleteError(true); setDeleting(false); }}>{deleting ? 'Eliminando…' : 'Eliminar'}</button></>}</div>
  </section></div>;
}

export default function CalendarPage() {
  const userId = useAuthStore((state) => state.user?.id);
  const { events, loading, error, fetchEvents, deleteEvent } = useCalendarEventStore();
  const [view, setView] = useState<View>('week');
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [sideOpen, setSideOpen] = useState(false);
  const [cards, setCards] = useState<AssignedCard[]>([]);
  const [visibleSources, setVisibleSources] = useState<Source[]>(['personal', 'workspace', 'team', 'deadline']);
  const [search, setSearch] = useState('');
  const [createContext, setCreateContext] = useState<CreateContext | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [detailItem, setDetailItem] = useState<CalendarItem | null>(null);
  const [detailClosing, setDetailClosing] = useState(false);
  const detailCloseTimer = useRef<number | null>(null);

  useEffect(() => {
    if (window.innerWidth <= 650) setView('day');
  }, []);

  const visibleDays = useMemo(() => view === 'month' ? monthDays(date) : view === 'week' ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index)) : view === 'agenda' ? Array.from({ length: 30 }, (_, index) => addDays(date, index)) : [startOfDay(date)], [date, view]);
  const from = visibleDays[0].toISOString();
  const to = addDays(visibleDays[visibleDays.length - 1], 1).toISOString();

  useEffect(() => { void fetchEvents(from, to); }, [fetchEvents, from, to]);
  useEffect(() => {
    let active = true;
    void apiService.get<{ pending: AssignedCard[]; overdue: AssignedCard[] }>('/api/users/me/cards', true).then((response) => {
      if (active && response.success && response.data) setCards([...response.data.pending, ...response.data.overdue]);
    });
    return () => { active = false; };
  }, []);

  const items = useMemo<CalendarItem[]>(() => {
    const eventItems = events.map((event) => ({
      id: event.id, kind: 'event' as const, title: event.title,
      start: new Date(event.startTime), end: new Date(event.endTime), allDay: event.allDay,
      source: event.type, color: sourceColor(event), event,
    }));
    const deadlineItems = cards.filter((card) => card.dueDate && !card.completed).map((card) => {
      const due = new Date(card.dueDate!);
      return { id: `card-${card.id}`, kind: 'card' as const, title: card.title, start: due,
        end: new Date(due.getTime() + 60_000), allDay: true, source: 'deadline' as const,
        color: card.priority === 'HIGH' ? '#B45C72' : card.priority === 'MEDIUM' ? '#A97556' : '#548B73', card };
    });
    const term = search.trim().toLocaleLowerCase('es');
    return [...eventItems, ...deadlineItems].filter((item) => {
      const details = item.kind === 'event' ? item.event.description ?? '' : item.card.boardName;
      const inRange = item.start.getTime() < new Date(to).getTime() && item.end.getTime() > new Date(from).getTime();
      return inRange && visibleSources.includes(item.source) && (!term || `${item.title} ${details}`.toLocaleLowerCase('es').includes(term));
    });
  }, [events, cards, visibleSources, search, from, to]);

  const navigate = useCallback((delta: number) => setDate((current) => {
    if (view === 'month') return new Date(current.getFullYear(), current.getMonth() + delta, Math.min(current.getDate(), 28));
    return addDays(current, delta * (view === 'week' ? 7 : view === 'agenda' ? 30 : 1));
  }), [view]);
  const openCreate = (day: Date, hour?: number, minute?: number, allDay = false) => setCreateContext({ date: dateKey(day), hour, minute, allDay });
  const openItem = (item: CalendarItem) => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current);
    setDetailClosing(false);
    setDetailItem(item);
  };
  const closeDetail = useCallback(() => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current);
    setDetailClosing(true);
    detailCloseTimer.current = window.setTimeout(() => {
      setDetailItem(null);
      setDetailClosing(false);
      detailCloseTimer.current = null;
    }, 220);
  }, []);

  useEffect(() => () => {
    if (detailCloseTimer.current) window.clearTimeout(detailCloseTimer.current);
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || /INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName ?? '')) return;
      if (detailItem) { if (event.key === 'Escape') closeDetail(); return; }
      if (createContext || editingEvent) return;
      if (event.key === 't' || event.key === 'T') setDate(startOfDay(new Date()));
      if (event.key === 'n' || event.key === 'N') openCreate(date);
      if (event.key === 'ArrowLeft') navigate(-1);
      if (event.key === 'ArrowRight') navigate(1);
      const shortcuts: Record<string, View> = { '1': 'day', '2': 'week', '3': 'month', '4': 'agenda' };
      if (shortcuts[event.key]) setView(shortcuts[event.key]);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [date, navigate, detailItem, createContext, editingEvent, closeDetail]);

  return <div className={styles.root}>
    <button type="button" className={`${styles.sideBackdrop} ${sideOpen ? styles.sideBackdropOpen : ''}`} aria-label="Cerrar calendarios" aria-hidden={!sideOpen} tabIndex={sideOpen ? 0 : -1} onClick={() => setSideOpen(false)} />
    <aside className={`${styles.sidePanel} ${sideOpen ? styles.sidePanelOpen : ''}`} aria-label="Navegación del calendario">
      <div className={styles.sideTop}><span>CALENDARIO</span><button type="button" className={styles.sideClose} aria-label="Cerrar panel" onClick={() => setSideOpen(false)}><X size={17} /></button></div>
      <button type="button" className={styles.sideCreate} onClick={() => { openCreate(date); setSideOpen(false); }}><Plus size={17} /> Nuevo evento</button>
      <label className={styles.sideSearch}><Search size={15} /><input aria-label="Buscar eventos en móvil" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar eventos" /></label>
      <MiniCalendar date={date} onSelect={(day) => { setDate(day); setSideOpen(false); }} />
      <div className={styles.sourceSection}><div className={styles.sourceHeading}>Mis calendarios</div>
        {SOURCES.map((source) => { const selected = visibleSources.includes(source.key); return <button key={source.key} type="button" className={styles.sourceRow} aria-pressed={selected} onClick={() => setVisibleSources((current) => selected ? current.filter((value) => value !== source.key) : [...current, source.key])}><span className={styles.sourceCheck} style={{ background: selected ? source.color : 'transparent', borderColor: source.color }}>{selected && <Check size={11} strokeWidth={3} />}</span><span>{source.label}</span></button>; })}
      </div>
      <div className={styles.focusCard}><span>EN ESTA VISTA</span><strong>{items.filter((item) => item.kind === 'event').length} {items.filter((item) => item.kind === 'event').length === 1 ? 'evento' : 'eventos'}</strong><p>{items.filter((item) => item.kind === 'card').length} {items.filter((item) => item.kind === 'card').length === 1 ? 'entrega' : 'entregas'} por atender</p></div>
      <div className={styles.sideFoot}><Clock3 size={13} /><span>{Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span></div>
    </aside>
    <div className={styles.mainPane}>
      <header className={styles.topbar}>
        <div className={styles.topbarLeft}><button type="button" className={styles.panelToggle} aria-label="Mostrar calendarios" onClick={() => setSideOpen(true)}><PanelLeft size={18} /></button><button className={styles.today} onClick={() => setDate(startOfDay(new Date()))}>Hoy</button><div className={styles.navArrows}><button aria-label="Periodo anterior" onClick={() => navigate(-1)}><ChevronLeft size={18} /></button><button aria-label="Periodo siguiente" onClick={() => navigate(1)}><ChevronRight size={18} /></button></div><h1><span className={styles.periodFull}>{periodTitle(date, view)}</span><span className={styles.periodCompact}>{compactPeriodTitle(date, view)}</span></h1></div>
        <div className={styles.topbarRight}><label className={styles.search}><Search size={16} /><input aria-label="Buscar en el calendario" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar eventos" />{search && <button type="button" aria-label="Limpiar búsqueda" onClick={() => setSearch('')}><X size={14} /></button>}</label><select className={styles.viewSelect} aria-label="Vista del calendario" value={view} onChange={(event) => setView(event.target.value as View)}>{VIEWS.map(({ key, label }) => <option key={key} value={key}>{label}</option>)}</select></div>
      </header>
      <div className={styles.subbar}><span><CalendarDays size={14} /> {view === 'week' ? 'Vista semanal' : view === 'day' ? 'Vista diaria' : view === 'month' ? 'Vista mensual' : 'Próximos 30 días'} <small>{loading ? 'Actualizando…' : `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'}`}</small></span><div className={styles.viewTabs} aria-label="Vista del calendario">{VIEWS.map(({ key, label }) => <button type="button" key={key} aria-pressed={view === key} className={view === key ? styles.viewTabActive : ''} onClick={() => setView(key)}>{label}</button>)}</div></div>
      {error && <div className={styles.error} role="alert">No se pudieron cargar los eventos: {error}</div>}
      <section className={styles.calendar} aria-busy={loading}>
        <div className={styles.viewMotion} key={`${view}-${dateKey(visibleDays[0])}`}>
          {(view === 'day' || view === 'week') && <TimeGrid days={visibleDays} items={items} selectedDate={date} onDateSelect={(next) => { setDate(next); setView('day'); }} onSlotClick={(day, hour, minute) => openCreate(day, hour < 0 ? undefined : hour, minute, hour < 0)} onItemClick={openItem} />}
          {view === 'month' && <MonthGrid date={date} items={items} onDateSelect={(next) => { setDate(next); setView('day'); }} onCreate={(day) => openCreate(day, undefined, undefined, true)} onItemClick={openItem} />}
          {view === 'agenda' && <AgendaView date={date} items={items} onCreate={(day) => openCreate(day)} onItemClick={openItem} />}
        </div>
      </section>
    </div>
    <CreateEventModal open={Boolean(createContext) || Boolean(editingEvent)} onClose={() => { setCreateContext(null); setEditingEvent(null); void fetchEvents(from, to); }} initialDate={createContext?.date} initialHour={createContext?.hour} initialMinute={createContext?.minute} initialAllDay={createContext?.allDay} eventToEdit={editingEvent} />
    {detailItem && <ItemDetail item={detailItem} userId={userId} closing={detailClosing} onClose={closeDetail} onEdit={() => { setEditingEvent(detailItem.event ?? null); closeDetail(); }} onDelete={async () => { const deleted = detailItem.event ? await deleteEvent(detailItem.event.id) : false; if (deleted) closeDetail(); return deleted; }} />}
  </div>;
}
