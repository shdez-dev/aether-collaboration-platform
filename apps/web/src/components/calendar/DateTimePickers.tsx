'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { createPortal } from 'react-dom';
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3 } from 'lucide-react';
import styles from './DateTimePickers.module.css';
import { availableEndHours, availableEndMinutes, timeForSelectedHour } from './calendarTime';

const WEEKDAYS = ['Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa', 'Do'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function pad(value: number) { return String(value).padStart(2, '0'); }
function toISO(date: Date) { return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`; }
function parseDate(value: string) {
  const [year, month, day] = value.split('-').map(Number);
  return year && month && day ? new Date(year, month - 1, day) : null;
}

function useOutsideClose(
  ref: RefObject<HTMLDivElement | null>,
  close: () => void,
  open: boolean,
  floatingRef?: RefObject<HTMLDivElement | null>,
) {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!ref.current?.contains(target) && !floatingRef?.current?.contains(target)) close();
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [ref, floatingRef, close, open]);
}

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  min?: string;
  label: string;
  align?: 'left' | 'right';
  compact?: boolean;
  portal?: boolean;
}

export function CalendarDatePicker({ value, onChange, min, label, align = 'left', compact = false, portal = false }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [floatingPosition, setFloatingPosition] = useState<{ top: number; left: number } | null>(null);
  const [view, setView] = useState(() => {
    const selected = parseDate(value) ?? new Date();
    return new Date(selected.getFullYear(), selected.getMonth(), 1);
  });
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);
  const closeCalendar = useCallback(() => setOpen(false), []);
  useOutsideClose(root, closeCalendar, open, portal ? calendarRef : undefined);

  const positionCalendar = useCallback(() => {
    const anchor = root.current;
    const calendar = calendarRef.current;
    if (!anchor || !calendar) return;
    const anchorRect = anchor.getBoundingClientRect();
    const calendarRect = calendar.getBoundingClientRect();
    const edge = 10;
    const gap = 8;
    const left = Math.max(edge, Math.min(anchorRect.left, window.innerWidth - calendarRect.width - edge));
    const roomBelow = window.innerHeight - anchorRect.bottom - edge;
    const top = roomBelow >= calendarRect.height || anchorRect.top < calendarRect.height + edge
      ? Math.min(anchorRect.bottom + gap, window.innerHeight - calendarRect.height - edge)
      : Math.max(edge, anchorRect.top - calendarRect.height - gap);
    setFloatingPosition(current => current?.top === top && current.left === left ? current : { top, left });
  }, []);

  useLayoutEffect(() => {
    if (!open || !portal) {
      setFloatingPosition(null);
      return;
    }
    positionCalendar();
    calendarRef.current
      ?.querySelector<HTMLButtonElement>('[aria-pressed="true"]:not(:disabled)')
      ?.focus({ preventScroll: true });
    window.addEventListener('resize', positionCalendar);
    document.addEventListener('scroll', positionCalendar, true);
    return () => {
      window.removeEventListener('resize', positionCalendar);
      document.removeEventListener('scroll', positionCalendar, true);
    };
  }, [open, portal, positionCalendar]);

  const selected = parseDate(value);
  const today = toISO(new Date());
  const firstWeekday = (view.getDay() + 6) % 7;
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells = Array.from({ length: Math.ceil((firstWeekday + daysInMonth) / 7) * 7 }, (_, index) => {
    const date = new Date(view.getFullYear(), view.getMonth(), index - firstWeekday + 1);
    return { date, iso: toISO(date), inMonth: date.getMonth() === view.getMonth() };
  });

  function changeMonth(offset: number) {
    setView(current => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  }

  function handlePickerKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      window.requestAnimationFrame(() => triggerRef.current?.focus());
    }
  }

  function chooseDate(iso: string) {
    onChange(iso);
    setOpen(false);
    window.requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div ref={root} className={styles.picker} onKeyDown={handlePickerKeyDown}>
      <button ref={triggerRef} type="button" className={`${styles.trigger} ${compact ? styles.compactTrigger : ''} ${open ? styles.triggerOpen : ''}`} aria-label={`${label}: ${selected ? selected.toLocaleDateString('es-CL') : 'sin fecha'}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => {
        if (!open) {
          const next = parseDate(value) ?? new Date();
          setView(new Date(next.getFullYear(), next.getMonth(), 1));
        }
        setOpen(!open);
      }}>
        <CalendarDays size={16} aria-hidden="true" />
        <span>{selected ? selected.toLocaleDateString('es-CL', { day: '2-digit', month: compact ? 'short' : '2-digit', year: 'numeric' }) : 'Elegir fecha'}</span>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && typeof document !== 'undefined' && (() => {
        const calendar = (
        <div
          ref={calendarRef}
          className={`${styles.calendar} ${!portal && align === 'right' ? styles.alignRight : ''}`}
          role="dialog"
          aria-label={`Seleccionar ${label.toLowerCase()}`}
          onKeyDown={handlePickerKeyDown}
          style={portal ? {
            position: 'fixed',
            top: floatingPosition?.top ?? 0,
            left: floatingPosition?.left ?? 0,
            right: 'auto',
            zIndex: 1200,
            visibility: floatingPosition ? 'visible' : 'hidden',
          } : undefined}
        >
          <div className={styles.calendarHeader}>
            <strong>{MONTHS[view.getMonth()]} {view.getFullYear()}</strong>
            <div className={styles.navigation}>
              <button type="button" onClick={() => changeMonth(-1)} aria-label="Mes anterior"><ChevronLeft size={17} /></button>
              <button type="button" onClick={() => changeMonth(1)} aria-label="Mes siguiente"><ChevronRight size={17} /></button>
            </div>
          </div>
          <div className={styles.days}>
            {WEEKDAYS.map(day => <span key={day} className={styles.weekday}>{day}</span>)}
            {cells.map(({ date, iso, inMonth }) => (
              <button key={iso} type="button" disabled={!!min && iso < min} className={`${styles.day} ${inMonth ? '' : styles.otherMonth} ${iso === value ? styles.selectedDay : ''} ${iso === today ? styles.today : ''}`} aria-label={date.toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })} aria-pressed={iso === value} onClick={() => chooseDate(iso)}>{date.getDate()}</button>
            ))}
          </div>
          <div className={styles.calendarFooter}>
            <span>{selected?.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' }) ?? 'Selecciona un día'}</span>
            <button type="button" disabled={!!min && today < min} onClick={() => chooseDate(today)}>Hoy</button>
          </div>
        </div>
        );
        return portal ? createPortal(calendar, document.body) : calendar;
      })()}
    </div>
  );
}

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  align?: 'left' | 'right';
  minTime?: string;
}

export function ClockTimePicker({ value, onChange, label, align = 'left', minTime }: TimePickerProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const hoursColumn = useRef<HTMLDivElement>(null);
  const minutesColumn = useRef<HTMLDivElement>(null);
  useOutsideClose(root, () => setOpen(false), open);
  const [hour = '00', minute = '00'] = value.split(':');
  const hours = availableEndHours(minTime);
  const visibleHour = hours.includes(Number(hour)) ? Number(hour) : hours[0];
  const minutes = availableEndMinutes(visibleHour, minTime);

  useEffect(() => {
    if (!open) return;
    if (hoursColumn.current) hoursColumn.current.scrollTop = Math.max(0, hours.indexOf(visibleHour) * 32 - 80);
    if (minutesColumn.current) minutesColumn.current.scrollTop = Math.max(0, minutes.indexOf(Number(minute)) * 32 - 80);
  }, [open]); // Scroll to the current selection when the picker opens.

  return (
    <div ref={root} className={styles.picker} onKeyDown={event => {
      if (event.key === 'Escape' && open) { event.stopPropagation(); setOpen(false); }
    }}>
      <button type="button" className={`${styles.trigger} ${open ? styles.triggerOpen : ''}`} aria-label={`${label}: ${value}`} aria-expanded={open} aria-haspopup="dialog" onClick={() => setOpen(!open)}>
        <Clock3 size={16} aria-hidden="true" />
        <span>{value}</span>
        <ChevronDown size={14} className={styles.chevron} aria-hidden="true" />
      </button>
      {open && (
        <div className={`${styles.clock} ${align === 'right' ? styles.alignRight : ''}`} role="dialog" aria-label={`Seleccionar hora de ${label.toLowerCase()}`}>
          <div className={styles.clockHeader}>Hora <span>{hour}:{minute}</span></div>
          <div className={styles.clockColumns}>
            <div ref={hoursColumn} className={styles.clockColumn} role="group" aria-label="Horas">
              {hours.map(value => pad(value)).map(option => (
                <button key={option} type="button" className={`${styles.timeOption} ${hour === option ? styles.selectedTime : ''}`} aria-pressed={hour === option} onClick={() => onChange(timeForSelectedHour(Number(option), Number(minute), minTime))}>{option}{hour === option && <Check size={12} />}</button>
              ))}
            </div>
            <div ref={minutesColumn} className={styles.clockColumn} role="group" aria-label="Minutos">
              {minutes.map(value => pad(value)).map(option => (
                <button key={option} type="button" className={`${styles.timeOption} ${minute === option ? styles.selectedTime : ''}`} aria-pressed={minute === option} onClick={() => onChange(`${pad(visibleHour)}:${option}`)}>{option}{minute === option && <Check size={12} />}</button>
              ))}
            </div>
          </div>
          <button type="button" className={styles.done} onClick={() => setOpen(false)}>Listo</button>
        </div>
      )}
    </div>
  );
}
