'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import Link from 'next/link';
import { ArrowUpRight, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3, PencilLine, Plus, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { useAuthStore } from '@/stores/authStore';
import type { CalendarEvent } from '@/stores/calendarEventStore';
import { addDays, clippedMinutes, dateKey, layoutTimedSegments, monthDays, overlapsDay, startOfDay, startOfWeek } from '@/app/dashboard/calendar/calendarMath';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import styles from './CalendarDashboardWidget.module.css';

type View = 'day' | 'week' | 'month';
type Source = 'personal' | 'workspace' | 'team' | 'deadline';
type Deadline = { id: string; title: string; dueDate: string | null; completed: boolean; priority: 'LOW' | 'MEDIUM' | 'HIGH' | null; boardId: string; boardName: string };
type Item = { id: string; title: string; start: Date; end: Date; allDay: boolean; source: Source; color: string; event?: CalendarEvent; card?: Deadline };
type CreateContext = { date: string; hour?: number; minute?: number; allDay?: boolean };
type Sticky = { id: string; text: string; tone: 'violet' | 'mint' | 'amber' };

const SOURCES: { key: Source; label: string; color: string }[] = [
  { key: 'personal', label: 'Personal', color: '#9675cc' },
  { key: 'workspace', label: 'Espacios', color: '#66ab91' },
  { key: 'team', label: 'Equipos', color: '#81a4ce' },
  { key: 'deadline', label: 'Entregas', color: '#d98095' },
];
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const HOUR_HEIGHT = 48;
const DAY_PARTS = [
  { label: 'Mañana', hour: 6 },
  { label: 'Tarde', hour: 12 },
  { label: 'Noche', hour: 18 },
] as const;
const monthName = new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' });
const weekdayName = new Intl.DateTimeFormat('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
const shortTime = new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const NOTE_TONES: { value: Sticky['tone']; label: string }[] = [
  { value: 'violet', label: 'Violeta' },
  { value: 'mint', label: 'Menta' },
  { value: 'amber', label: 'Ámbar' },
];

function capitalize(value: string) { return value.charAt(0).toLocaleUpperCase('es') + value.slice(1); }
function itemColor(event: CalendarEvent) { return /^#[0-9a-f]{6}$/i.test(event.color) ? event.color : SOURCES.find((source) => source.key === event.type)?.color ?? '#9675cc'; }
function itemTime(item: Item) { return item.card ? 'Entrega' : item.allDay ? 'Todo el día' : shortTime.format(item.start); }
function includesDay(item: Item, day: Date) { return item.card ? dateKey(item.start) === dateKey(day) : overlapsDay(item.start, item.end, day); }
function itemStyle(item: Item): CSSProperties { return { '--event-color': item.color } as CSSProperties; }

function periodLabel(date: Date, view: View) {
  if (view === 'month') return capitalize(monthName.format(date));
  if (view === 'day') return capitalize(weekdayName.format(date));
  const first = startOfWeek(date);
  const last = addDays(first, 6);
  const month = new Intl.DateTimeFormat('es-CL', { month: 'short' });
  return `${first.getDate()} ${month.format(first)} – ${last.getDate()} ${month.format(last)} ${last.getFullYear()}`;
}

function EventChip({ item, onSelect, compact = false }: { item: Item; onSelect: (item: Item) => void; compact?: boolean }) {
  return <button type="button" className={`${styles.eventChip} ${compact ? styles.eventChipCompact : ''}`} style={itemStyle(item)} title={`${item.title} · ${itemTime(item)}`} onClick={(event) => { event.stopPropagation(); onSelect(item); }}>
    <i aria-hidden="true" /><span>{item.title}</span>{!compact && <small>{itemTime(item)}</small>}
  </button>;
}

function DayStickyNotes({ day, userId }: { day: Date; userId?: string }) {
  const reduceMotion = useReducedMotion();
  const storageKey = `aether:calendar-widget:stickies:v1:${userId ?? 'local'}:${dateKey(day)}`;
  const [notes, setNotes] = useState<Sticky[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [tone, setTone] = useState<Sticky['tone']>('violet');
  const [composing, setComposing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  useEffect(() => {
    try {
      const stored: unknown = JSON.parse(window.localStorage.getItem(storageKey) ?? '[]');
      setNotes(Array.isArray(stored) ? stored.filter((note): note is Sticky => Boolean(note && typeof note.id === 'string' && typeof note.text === 'string' && ['violet', 'mint', 'amber'].includes(note.tone))).slice(0, 20) : []);
    } catch { setNotes([]); }
    setLoadedKey(storageKey);
    setComposing(false);
    setEditingId(null);
  }, [storageKey]);
  useEffect(() => {
    if (loadedKey !== storageKey) return;
    try { window.localStorage.setItem(storageKey, JSON.stringify(notes)); } catch { /* The notes remain usable in this session if storage is unavailable. */ }
  }, [loadedKey, notes, storageKey]);

  const saveNew = () => {
    const text = draft.trim();
    if (!text) return;
    setNotes((current) => [{ id: crypto.randomUUID(), text, tone }, ...current]);
    setDraft('');
    setComposing(false);
  };
  const saveEdit = () => {
    const text = editText.trim();
    if (text) setNotes((current) => current.map((note) => note.id === editingId ? { ...note, text } : note));
    setEditingId(null);
  };

  return <section className={styles.stickyPanel} aria-label="Notas rápidas del día">
    <div className={styles.stickyHead}><div><span className={styles.sideEyebrow}>A MANO</span><strong>Notas rápidas</strong></div><button type="button" onClick={() => setComposing((value) => !value)} aria-label={composing ? 'Cerrar nueva nota' : 'Añadir nota'} aria-expanded={composing} disabled={notes.length >= 20}><Plus size={16} /></button></div>
    <div className={styles.stickyScroll}>
      <AnimatePresence initial={false}>
        {composing && <motion.div key="composer" className={`${styles.stickyComposer} ${styles[`sticky${capitalize(tone)}`]}`} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -8 }} animate={reduceMotion ? { opacity: 1 } : { opacity: 1, height: 'auto', y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -6 }} transition={{ duration: reduceMotion ? 0.08 : 0.22, ease: [0.16, 1, 0.3, 1] }}>
          <div className={styles.composerTop}><span><PencilLine size={13} /> Nota para {new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(day)}</span><button type="button" aria-label="Cancelar nota" onClick={() => { setComposing(false); setDraft(''); }}><X size={14} /></button></div>
          <textarea autoFocus maxLength={240} rows={4} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') saveNew(); }} placeholder="¿Qué quieres recordar hoy?" aria-label="Escribir nueva nota" />
          <div className={styles.stickyComposerFoot}><div className={styles.tonePicker} role="group" aria-label="Color de la nota">{NOTE_TONES.map((option) => <button key={option.value} type="button" className={styles[`tone${capitalize(option.value)}`]} aria-label={option.label} aria-pressed={tone === option.value} title={option.label} onClick={() => setTone(option.value)} />)}</div><span className={styles.stickyCounter}>{draft.length}/240</span><button type="button" className={styles.saveSticky} onClick={saveNew} disabled={!draft.trim()}><Check size={12} /> Guardar nota</button></div>
        </motion.div>}
      </AnimatePresence>
      {loadedKey === storageKey && notes.length === 0 && !composing && <div className={styles.stickyEmpty}><span aria-hidden="true">✳</span><p>Una idea, un pendiente o algo que no quieras olvidar.</p><button type="button" onClick={() => setComposing(true)}>Escribir nota <Plus size={12} /></button></div>}
      <div className={styles.stickyGrid}><AnimatePresence initial={false} mode="popLayout">{notes.map((note) => <motion.div key={note.id} layout={!reduceMotion} initial={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 9 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: -6 }} transition={{ duration: reduceMotion ? 0.08 : 0.2, ease: [0.16, 1, 0.3, 1] }} className={`${styles.stickyNote} ${styles[`sticky${capitalize(note.tone)}`]}`}>
        <div className={styles.stickyNoteTop}><i aria-hidden="true" /><button type="button" aria-label="Eliminar nota" onClick={() => setNotes((current) => current.filter((entry) => entry.id !== note.id))}><X size={12} /></button></div>
        {editingId === note.id ? <div className={styles.stickyEditor}><textarea autoFocus maxLength={240} aria-label="Editar nota" value={editText} onChange={(event) => setEditText(event.target.value)} /><div><button type="button" onClick={() => setEditingId(null)}>Cancelar</button><button type="button" onClick={saveEdit}>Guardar</button></div></div> : <button type="button" className={styles.stickyText} aria-label={`Editar nota: ${note.text}`} onClick={() => { setEditingId(note.id); setEditText(note.text); }}>{note.text}</button>}
      </motion.div>)}</AnimatePresence></div>
    </div>
    <span className={styles.stickyPrivacy}>Guardadas en este navegador · {capitalize(weekdayName.format(day))}</span>
  </section>;
}

export default function CalendarDashboardWidget() {
  const reduceMotion = useReducedMotion();
  const userId = useAuthStore((state) => state.user?.id);
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('week');
  const [navigationDirection, setNavigationDirection] = useState(0);
  const [date, setDate] = useState(() => startOfDay(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [visibleSources, setVisibleSources] = useState<Source[]>(SOURCES.map((source) => source.key));
  const [cards, setCards] = useState<Deadline[]>([]);
  const [refreshKey, setRefreshKey] = useState(0);
  const [createContext, setCreateContext] = useState<CreateContext | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [hoverMinute, setHoverMinute] = useState<number | null>(null);
  const [activeDayPart, setActiveDayPart] = useState(0);
  const dayScrollRef = useRef<HTMLDivElement | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  const visibleDays = useMemo(() => view === 'month' ? monthDays(date) : view === 'week'
    ? Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(date), index)) : [startOfDay(date)], [date, view]);
  const from = visibleDays[0].toISOString();
  const to = addDays(visibleDays[visibleDays.length - 1], 1).toISOString();

  useEffect(() => {
    if (!userId) return;
    let active = true;
    setLoading(true);
    setError(null);
    const endpoint = `/api/events/me?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`;
    void apiService.get<{ events: CalendarEvent[] }>(endpoint, true).then((response) => {
      if (!active) return;
      if (response.success && response.data) { setEvents(response.data.events); setError(null); }
      else setError(response.error?.message ?? 'No se pudieron cargar los eventos.');
    }).catch(() => { if (active) setError('No se pudieron cargar los eventos.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [from, to, refreshKey, userId]);
  useEffect(() => {
    if (!userId) return;
    let active = true;
    void apiService.get<{ pending: Deadline[]; overdue: Deadline[] }>('/api/users/me/cards', true).then((response) => {
      if (!active || !response.success || !response.data) return;
      const unique = new Map<string, Deadline>();
      for (const card of [...(response.data.pending ?? []), ...(response.data.overdue ?? [])]) unique.set(card.id, card);
      setCards([...unique.values()]);
    }).catch(() => { /* Preserve the last available deadlines until the next refresh. */ });
    return () => { active = false; };
  }, [refreshKey, userId]);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { if (timer) clearTimeout(timer); timer = setTimeout(() => setRefreshKey((value) => value + 1), 120); };
    const onVisibility = () => { if (document.visibilityState === 'visible') refresh(); };
    const onWorkspaceInvalidate = (event: Event) => { if (['boards', 'all'].includes((event as CustomEvent<{ resource?: string }>).detail?.resource ?? '')) refresh(); };
    const onBoardEvent = (event: { type?: string }) => { if (event.type?.startsWith('card.')) refresh(); };
    socketService.on('calendar:invalidate', refresh);
    socketService.on('event', onBoardEvent);
    window.addEventListener('focus', refresh);
    window.addEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      if (timer) clearTimeout(timer);
      socketService.off('calendar:invalidate', refresh);
      socketService.off('event', onBoardEvent);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('aether:realtime:workspace-invalidate', onWorkspaceInvalidate);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const items = useMemo<Item[]>(() => {
    const eventItems = events.map((event) => ({ id: `event-${event.id}`, title: event.title, start: new Date(event.startTime), end: new Date(event.endTime), allDay: event.allDay, source: event.type, color: itemColor(event), event }));
    const deadlines = cards.filter((card) => card.dueDate && !card.completed).map((card) => {
      const due = new Date(card.dueDate!);
      return { id: `card-${card.id}`, title: card.title, start: due, end: new Date(due.getTime() + 60_000), allDay: true, source: 'deadline' as const, color: card.priority === 'HIGH' ? '#d98095' : card.priority === 'MEDIUM' ? '#d7a679' : '#66ab91', card };
    });
    return [...eventItems, ...deadlines].filter((item) => Number.isFinite(item.start.getTime()) && Number.isFinite(item.end.getTime()) && item.start.getTime() < new Date(to).getTime() && item.end.getTime() > new Date(from).getTime() && visibleSources.includes(item.source)).sort((left, right) => left.start.getTime() - right.start.getTime());
  }, [events, cards, from, to, visibleSources]);

  const dayItems = (day: Date) => items.filter((item) => includesDay(item, day));
  const navigate = (delta: number) => {
    setNavigationDirection(delta);
    setDate((current) => view === 'month'
      ? new Date(current.getFullYear(), current.getMonth() + delta, Math.min(current.getDate(), 28))
      : addDays(current, delta * (view === 'week' ? 7 : 1)));
  };
  const openCreate = (day: Date, hour?: number, minute?: number, allDay = false) => setCreateContext({ date: dateKey(day), hour, minute, allDay });
  const selectDay = (day: Date) => { setNavigationDirection(0); setDate(day); setView('day'); setSelectedItem(null); };
  const isToday = (day: Date) => dateKey(day) === dateKey(now);
  const calendarHref = (day: Date) => `/dashboard/calendar?view=day&at=${encodeURIComponent(day.toISOString())}`;

  const dayDateKey = dateKey(date);
  const setDayScrollRef = useCallback((node: HTMLDivElement | null) => {
    dayScrollRef.current = node;
    if (node) {
      const hour = dayDateKey === dateKey(new Date()) ? Math.max(0, new Date().getHours() - 2) : 8;
      node.scrollTop = hour * HOUR_HEIGHT;
      setActiveDayPart(hour < 12 ? 0 : hour < 18 ? 1 : 2);
    }
  }, [dayDateKey]);
  const jumpToHour = (hour: number) => {
    dayScrollRef.current?.scrollTo({ top: hour * HOUR_HEIGHT, behavior: reduceMotion ? 'auto' : 'smooth' });
    setActiveDayPart(hour < 12 ? 0 : hour < 18 ? 1 : 2);
  };
  useEffect(() => {
    if (!selectedItem) return;
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedItem(null); };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [selectedItem]);

  const timedItems = view === 'day' ? layoutTimedSegments(dayItems(date).flatMap((item) => {
    if (item.allDay) return [];
    const segment = clippedMinutes(item.start, item.end, date);
    return segment ? [{ id: item.id, item, ...segment }] : [];
  })) : [];
  const allDayItems = view === 'day' ? dayItems(date).filter((item) => item.allDay) : [];
  const freeHour = isToday(date) ? Math.min(21, Math.max(8, now.getHours() + 1)) : 9;
  const viewKey = view === 'month' ? `month-${date.getFullYear()}-${date.getMonth()}`
    : view === 'week' ? `week-${dateKey(startOfWeek(date))}` : `day-${dayDateKey}`;
  const motionContext = { direction: navigationDirection, reduced: Boolean(reduceMotion) };

  return <div className={styles.calendarWidget}>
    <header className={styles.header}>
      <div className={styles.period}><span className={styles.periodAccent} aria-hidden="true" /><strong>{periodLabel(date, view)}</strong><small>{loading ? 'Actualizando…' : `${items.length} ${items.length === 1 ? 'elemento' : 'elementos'} en esta vista`}</small></div>
      <div className={styles.headerActions}>
        <button type="button" className={styles.todayButton} onClick={() => { setNavigationDirection(Math.sign(Date.now() - date.getTime())); setDate(startOfDay(new Date())); }}>Hoy</button>
        <div className={styles.navigation}><button type="button" aria-label="Periodo anterior" onClick={() => navigate(-1)}><ChevronLeft size={17} /></button><button type="button" aria-label="Periodo siguiente" onClick={() => navigate(1)}><ChevronRight size={17} /></button></div>
        <div className={styles.viewSwitch} role="group" aria-label="Vista del calendario">{(['day', 'week', 'month'] as View[]).map((option) => <button key={option} type="button" aria-pressed={view === option} onClick={() => { setNavigationDirection(0); setView(option); }}>{option === 'day' ? 'Día' : option === 'week' ? 'Semana' : 'Mes'}</button>)}</div>
        <button type="button" className={styles.createButton} onClick={() => openCreate(date)} aria-label="Crear evento"><Plus size={16} /><span>Evento</span></button>
      </div>
    </header>

    <div className={styles.content} aria-busy={loading}>
      {error && <div className={styles.error} role="alert">No se pudieron cargar los eventos. <button type="button" onClick={() => setRefreshKey((value) => value + 1)}>Reintentar</button></div>}
      <AnimatePresence initial={false} mode="wait" custom={motionContext}>
      <motion.div key={viewKey} className={styles.viewMotion} custom={motionContext} initial="enter" animate="center" exit="exit" variants={{
        enter: ({ direction, reduced }: typeof motionContext) => ({ opacity: 0, x: reduced ? 0 : direction * 22, scale: reduced || direction ? 1 : 0.985 }),
        center: { opacity: 1, x: 0, scale: 1, transition: { duration: reduceMotion ? 0.08 : 0.24, ease: [0.16, 1, 0.3, 1] } },
        exit: ({ direction, reduced }: typeof motionContext) => ({ opacity: 0, x: reduced ? 0 : -direction * 14, scale: reduced || direction ? 1 : 0.99, transition: { duration: reduced ? 0.06 : 0.14, ease: 'easeIn' } }),
      }}>
      {view === 'month' && <div className={styles.monthScroll}><div className={styles.monthGrid}>
        {WEEKDAYS.map((name) => <span key={name} className={styles.monthWeekday}>{name}</span>)}
        {visibleDays.map((day) => {
          const entries = dayItems(day);
          return <div key={dateKey(day)} className={`${styles.monthCell} ${day.getMonth() !== date.getMonth() ? styles.outsideMonth : ''} ${isToday(day) ? styles.currentDay : ''}`} onClick={() => selectDay(day)}>
            <div className={styles.monthCellTop}><button type="button" className={styles.dayNumber} onClick={(event) => { event.stopPropagation(); selectDay(day); }} aria-label={`Abrir ${weekdayName.format(day)}`}>{day.getDate()}</button>{isToday(day) && <span className={styles.monthTodayLabel}>Hoy</span>}{entries.length > 0 && <span className={styles.monthCount}>{entries.length} {entries.length === 1 ? 'plan' : 'planes'}</span>}</div>
            <button type="button" className={styles.cellAdd} onClick={(event) => { event.stopPropagation(); openCreate(day, undefined, undefined, true); }} aria-label={`Crear evento el ${weekdayName.format(day)}`}><Plus size={12} /></button>
            <div className={styles.monthEvents}>{entries.slice(0, 2).map((item) => <EventChip key={item.id} item={item} onSelect={setSelectedItem} compact />)}{entries.length > 2 && <button type="button" className={styles.moreEvents} onClick={(event) => { event.stopPropagation(); selectDay(day); }}>+{entries.length - 2} más</button>}</div>
          </div>;
        })}
      </div></div>}

      {view === 'week' && <div className={styles.weekScroll}><div className={styles.weekGrid}>
        {visibleDays.map((day) => {
          const entries = dayItems(day);
          return <section key={dateKey(day)} className={`${styles.weekColumn} ${isToday(day) ? styles.weekToday : ''}`}>
            <button type="button" className={styles.weekDayHead} onClick={() => selectDay(day)}><span>{WEEKDAYS[(day.getDay() + 6) % 7]}</span><strong>{day.getDate()}</strong><small>{entries.length} {entries.length === 1 ? 'plan' : 'planes'}</small></button>
            <div className={styles.weekEvents}>{entries.slice(0, 5).map((item) => <EventChip key={item.id} item={item} onSelect={setSelectedItem} />)}{entries.length > 5 && <button type="button" className={styles.moreEvents} onClick={() => selectDay(day)}>+{entries.length - 5} más</button>}{entries.length === 0 && <span className={styles.weekEmpty}>Sin planes</span>}</div>
            <button type="button" className={styles.weekAdd} onClick={() => openCreate(day, undefined, undefined, true)}><Plus size={13} /> Añadir</button>
          </section>;
        })}
      </div></div>}

      {view === 'day' && <div className={styles.dayView}>
        <div className={styles.daySchedule}>
        <div className={styles.dayTop}>
          <div className={styles.dayIdentity}><span className={styles.dayBigNumber}>{date.getDate()}</span><span className={styles.dayIdentityText}><strong>{capitalize(new Intl.DateTimeFormat('es-CL', { weekday: 'long' }).format(date))}</strong><small>{capitalize(new Intl.DateTimeFormat('es-CL', { month: 'long', year: 'numeric' }).format(date))}</small></span></div>
          <Link href={calendarHref(date)} className={styles.openCalendar}>Abrir calendario <ArrowUpRight size={14} /></Link>
        </div>
        <div className={styles.dayTools} aria-label="Ir a una hora del día">
          <div className={styles.dayPartButtons}>{DAY_PARTS.map((part, index) => <button key={part.label} type="button" className={`${styles.dayPartButton} ${activeDayPart === index ? styles.dayPartActive : ''}`} onClick={() => jumpToHour(part.hour)} aria-pressed={activeDayPart === index}>{part.label}<span>{String(part.hour).padStart(2, '0')}:00</span></button>)}</div>
          {isToday(date) && <button type="button" className={styles.jumpNow} onClick={() => jumpToHour(Math.max(0, now.getHours() - 1))}><span /> Ahora</button>}
        </div>
        {allDayItems.length > 0 && <div className={styles.allDay}><span>Todo el día</span><div>{allDayItems.map((item) => <EventChip key={item.id} item={item} onSelect={setSelectedItem} compact />)}</div></div>}
        <div className={styles.dayScroll} ref={setDayScrollRef} onScroll={(event) => { const hour = (event.currentTarget.scrollTop + HOUR_HEIGHT * 2) / HOUR_HEIGHT; const next = hour < 12 ? 0 : hour < 18 ? 1 : 2; setActiveDayPart((current) => current === next ? current : next); }}><div className={styles.dayTimeline}>
          <div className={styles.hourRail}>{Array.from({ length: 24 }, (_, hour) => <span key={hour} className={hour === 6 || hour === 12 || hour === 18 ? styles.hourMilestone : ''} style={{ top: hour * HOUR_HEIGHT - 7 }}>{String(hour).padStart(2, '0')}:00</span>)}</div>
          <div className={styles.hourTrack} onPointerMove={(event) => {
            if (event.pointerType !== 'mouse' || (event.target as HTMLElement).closest('[data-event]')) { setHoverMinute(null); return; }
            const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
            setHoverMinute(Math.max(0, Math.min(1410, Math.floor(top / (HOUR_HEIGHT / 2)) * 30)));
          }} onPointerLeave={() => setHoverMinute(null)} onClick={(event) => {
            if ((event.target as HTMLElement).closest('[data-event]')) return;
            const top = event.clientY - event.currentTarget.getBoundingClientRect().top;
            const minute = Math.max(0, Math.min(1410, Math.floor(top / (HOUR_HEIGHT / 2)) * 30));
            openCreate(date, Math.floor(minute / 60), minute % 60);
          }}>
            <div className={styles.dayPhase} style={{ top: 6 * HOUR_HEIGHT, height: 6 * HOUR_HEIGHT }} aria-hidden="true" />
            <div className={styles.dayPhase} style={{ top: 12 * HOUR_HEIGHT, height: 6 * HOUR_HEIGHT }} aria-hidden="true" />
            <div className={styles.dayPhase} style={{ top: 18 * HOUR_HEIGHT, height: 6 * HOUR_HEIGHT }} aria-hidden="true" />
            {isToday(date) && <div className={styles.nowLine} style={{ top: ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_HEIGHT }}><i /><span>Ahora</span></div>}
            {timedItems.length === 0 && allDayItems.length === 0 && <button type="button" data-event className={styles.freeMoment} style={{ top: freeHour * HOUR_HEIGHT + 4 }} onClick={(event) => { event.stopPropagation(); openCreate(date, freeHour, 0); }}><span className={styles.freeMomentIcon}><Plus size={15} /></span><span><strong>Un espacio para tus planes</strong><small>Añade un evento a este día</small></span><ArrowUpRight size={15} /></button>}
            {hoverMinute !== null && <div className={styles.slotHover} style={{ top: (hoverMinute / 60) * HOUR_HEIGHT }}><span><Plus size={12} /> Crear evento</span><time>{String(Math.floor(hoverMinute / 60)).padStart(2, '0')}:{String(hoverMinute % 60).padStart(2, '0')}</time></div>}
            {timedItems.map(({ item, startMinute, endMinute, column, columns }) => <button key={item.id} type="button" data-event className={styles.timedEvent} style={{ ...itemStyle(item), top: startMinute / 60 * HOUR_HEIGHT + 2, height: Math.max(26, (endMinute - startMinute) / 60 * HOUR_HEIGHT - 4), left: `calc(${column} * 100% / ${columns} + 4px)`, width: `calc(100% / ${columns} - 8px)` }} onClick={(event) => { event.stopPropagation(); setSelectedItem(item); }}><strong>{item.title}</strong><small>{shortTime.format(item.start)}–{shortTime.format(item.end)}</small></button>)}
          </div>
        </div></div>
        </div>
        <aside className={styles.daySide}>
          <DayStickyNotes key={`${userId ?? 'local'}:${dateKey(date)}`} day={date} userId={userId} />
        </aside>
      </div>}
      </motion.div>
      </AnimatePresence>
    </div>

    <footer className={styles.footer}><div className={styles.sources} aria-label="Filtrar calendarios">{SOURCES.map((source) => <button key={source.key} type="button" aria-pressed={visibleSources.includes(source.key)} onClick={() => setVisibleSources((current) => current.includes(source.key) ? current.filter((key) => key !== source.key) : [...current, source.key])}><i style={{ background: source.color }} />{source.label}</button>)}</div><span className={styles.timezone}><Clock3 size={12} /> {Intl.DateTimeFormat().resolvedOptions().timeZone.replaceAll('_', ' ')}</span></footer>

    {selectedItem && <div className={styles.detailBackdrop} onClick={() => setSelectedItem(null)}><section className={styles.detail} role="dialog" aria-modal="true" aria-label={selectedItem.title} onClick={(event) => event.stopPropagation()} style={itemStyle(selectedItem)}>
      <button type="button" className={styles.detailClose} onClick={() => setSelectedItem(null)} aria-label="Cerrar detalle"><X size={17} /></button>
      <span className={styles.detailSource}><i /> {SOURCES.find((source) => source.key === selectedItem.source)?.label}</span><h3>{selectedItem.title}</h3>
      <p><CalendarDays size={15} /> {capitalize(weekdayName.format(selectedItem.start))}</p><p><Clock3 size={15} /> {selectedItem.allDay ? itemTime(selectedItem) : `${shortTime.format(selectedItem.start)}–${shortTime.format(selectedItem.end)}`}</p>
      {selectedItem.event?.description && <div className={styles.detailDescription}>{selectedItem.event.description}</div>}
      {selectedItem.card && <small>Tablero: {selectedItem.card.boardName}</small>}
      <div className={styles.detailActions}>{selectedItem.card ? <Link href={`/dashboard/boards/${selectedItem.card.boardId}?cardId=${encodeURIComponent(selectedItem.card.id)}`}>Abrir tarjeta <ArrowUpRight size={14} /></Link> : <><Link href={calendarHref(selectedItem.start)}>Abrir calendario <ArrowUpRight size={14} /></Link>{selectedItem.event?.createdBy === userId && <button type="button" onClick={() => { setEditingEvent(selectedItem.event ?? null); setSelectedItem(null); }}>Editar</button>}</>}</div>
    </section></div>}

    {mounted && createPortal(<CreateEventModal open={Boolean(createContext) || Boolean(editingEvent)} onClose={() => { setCreateContext(null); setEditingEvent(null); setRefreshKey((value) => value + 1); }} initialDate={createContext?.date} initialHour={createContext?.hour} initialMinute={createContext?.minute} initialAllDay={createContext?.allDay} eventToEdit={editingEvent} />, document.body)}
  </div>;
}
