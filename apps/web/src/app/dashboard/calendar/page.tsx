// apps/web/src/app/dashboard/calendar/page.tsx
'use client';

import { useEffect, useState, useMemo, useRef } from 'react';
import { useCalendarEventStore, type CalendarEvent, type CreateEventInput } from '@/stores/calendarEventStore';
import CreateEventModal from '@/components/calendar/CreateEventModal';
import { apiService } from '@/services/apiService';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Constants ─────────────────────────────────────────────────────────────────

const START_HOUR = 7;
const END_HOUR   = 21;
const TOTAL_HRS  = END_HOUR - START_HOUR;
const HOUR_PX    = 64;

const MONTHS_ES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio',
                    'Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
const DAYS_SHORT = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
const DAYS_UPPER = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const DAYS_FULL  = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];

const EVENT_PALETTE = ['#4B607F','#76A878','#DB8A66','#8C7C9E','#F2571E','#5B8FA8','#A87876'];
function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return EVENT_PALETTE[Math.abs(h) % EVENT_PALETTE.length];
}

function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function sameDay(a: Date, b: Date) { return toKey(a) === toKey(b); }
function pad2(n: number) { return String(n).padStart(2, '0'); }

function fmtHM(hour: number, minute: number) {
  return `${pad2(hour)}:${pad2(minute)}`;
}
function fmtTime(dateStr: string) {
  const d = new Date(dateStr);
  return fmtHM(d.getHours(), d.getMinutes());
}
function addHours(hour: number, minute: number, dh: number) {
  const totalM = hour * 60 + minute + Math.round(dh * 60);
  return { hour: Math.floor(totalM / 60), minute: totalM % 60 };
}

// ── Types ─────────────────────────────────────────────────────────────────────

interface UserCard {
  id: string; title: string; dueDate: string | null;
  priority: 'LOW'|'MEDIUM'|'HIGH'|null;
  completed: boolean; boardName: string; workspaceId: string; boardId: string;
}

interface QuickCreate {
  hour: number;
  minute: number;   // 0 or 30
  durationH: number; // 0.5 | 1 | 1.5 | 2 | 3
  title: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getMonthGrid(year: number, month: number) {
  const first = new Date(year, month, 1).getDay();
  const days  = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = Array(first).fill(null);
  for (let d = 1; d <= days; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function getWeekDays(date: Date): Date[] {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return Array.from({ length: 7 }, (_, i) => {
    const day = new Date(d); day.setDate(d.getDate() + i); return day;
  });
}

function eventTop(ev: CalendarEvent) {
  const s = new Date(ev.startTime);
  return Math.max(0, (s.getHours() + s.getMinutes() / 60 - START_HOUR) * HOUR_PX);
}
function eventHeight(ev: CalendarEvent) {
  const s = new Date(ev.startTime), e = new Date(ev.endTime);
  return Math.max((e.getTime() - s.getTime()) / 3600000 * HOUR_PX - 4, 22);
}
function nowTopPx() {
  const now = new Date();
  const h = now.getHours() + now.getMinutes() / 60;
  if (h < START_HOUR || h > END_HOUR) return -1;
  return (h - START_HOUR) * HOUR_PX;
}

// ── CircleBtn ─────────────────────────────────────────────────────────────────

function CircleBtn({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <span onClick={onClick}
      className="cal-circle-btn"
      style={{ width: '34px', height: '34px', borderRadius: '50%', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
      {children}
    </span>
  );
}

// ── Mini Calendar ─────────────────────────────────────────────────────────────

function MiniCalendar({ year, month, selectedDate, today, eventDays, onPrev, onNext, onSelectDay }: {
  year: number; month: number; selectedDate: Date; today: Date; eventDays: Set<string>;
  onPrev: () => void; onNext: () => void; onSelectDay: (day: number) => void;
}) {
  const cells    = getMonthGrid(year, month);
  const todayKey = toKey(today);
  const selKey   = toKey(selectedDate);

  return (
    <div style={{ border: '1px solid rgba(255,255,255,0.07)', borderRadius: '8px', padding: '16px', background: 'rgba(255,255,255,0.02)', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <CircleBtn onClick={onPrev}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9C9486" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </CircleBtn>
        <span style={{ fontFamily: SORA, fontWeight: 600, fontSize: '14px', color: '#E8E1D2' }}>{MONTHS_ES[month]} {year}</span>
        <CircleBtn onClick={onNext}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9C9486" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </CircleBtn>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '2px', marginBottom: '4px' }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '10.5px', fontWeight: 600, color: '#615846', padding: '3px 0' }}>{d}</div>)}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '3px' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`e-${i}`} />;
          const key = `${year}-${pad2(month+1)}-${pad2(day)}`;
          const isToday = key === todayKey, isSel = key === selKey, hasEv = eventDays.has(key);
          return (
            <div key={key} onClick={() => onSelectDay(day)}
              style={{ aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s' }}
              onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              {isSel
                ? <span style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#F2571E', color: '#24180A', fontWeight: 700, fontSize: '12.5px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{day}</span>
                : <span style={{ fontSize: '12.5px', color: isToday ? '#F2571E' : '#9C9486', fontWeight: isToday ? 700 : 400 }}>{day}</span>
              }
              {hasEv && !isSel && <span style={{ width: '4px', height: '4px', borderRadius: '50%', background: '#F2571E' }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── QuickCreate inline form ───────────────────────────────────────────────────

const DURATIONS: { label: string; value: number }[] = [
  { label: '30m', value: 0.5 },
  { label: '1h',  value: 1   },
  { label: '1h 30m', value: 1.5 },
  { label: '2h',  value: 2   },
  { label: '3h',  value: 3   },
];

function QuickCreateCard({ qc, onChange, onCancel, onSave, saving }: {
  qc: QuickCreate;
  onChange: (qc: QuickCreate) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const end = addHours(qc.hour, qc.minute, qc.durationH);

  useEffect(() => { inputRef.current?.focus(); }, []);

  return (
    <div
      onClick={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
      style={{
        position: 'absolute', left: '68px', right: '8px',
        top: `${(qc.hour + qc.minute / 60 - START_HOUR) * HOUR_PX}px`,
        minHeight: `${Math.max(qc.durationH * HOUR_PX, 148)}px`,
        zIndex: 20, borderRadius: '10px',
        background: '#1C2236',
        border: '1px solid rgba(242,87,30,0.35)',
        borderLeft: '3px solid #F2571E',
        padding: '12px 14px',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        display: 'flex', flexDirection: 'column', gap: '10px',
        animation: 'qcIn 0.22s cubic-bezier(0.16,1,0.3,1)',
        transformOrigin: 'top center',
      }}
    >
      {/* Time range */}
      <div style={{ fontSize: '12px', fontWeight: 600, color: '#F2571E', fontFamily: SORA }}>
        {fmtHM(qc.hour, qc.minute)} → {fmtHM(end.hour, end.minute)}
      </div>

      {/* Title input */}
      <input
        ref={inputRef}
        value={qc.title}
        onChange={e => onChange({ ...qc, title: e.target.value })}
        onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') onCancel(); }}
        placeholder="Título del evento…"
        style={{
          padding: '8px 10px', borderRadius: '7px',
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.12)',
          color: '#E8E1D2', fontFamily: MANROPE, fontSize: '14px',
          outline: 'none', transition: 'border-color 0.12s',
        }}
        onFocus={e => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.28)')}
        onBlur={e  => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)')}
      />

      {/* Duration chips */}
      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
        {DURATIONS.map(({ label, value }) => {
          const active = qc.durationH === value;
          return (
            <span key={value} onClick={() => onChange({ ...qc, durationH: value })}
              style={{
                fontSize: '11.5px', padding: '4px 9px', borderRadius: '6px', cursor: 'pointer',
                background: active ? '#F2571E' : 'rgba(255,255,255,0.06)',
                color: active ? '#24180A' : '#9C9486',
                fontWeight: active ? 700 : 400, transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.12)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}>
              {label}
            </span>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '2px' }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '7px', borderRadius: '7px', background: 'none', border: '1px solid rgba(255,255,255,0.1)', color: '#827A6D', fontFamily: SORA, fontSize: '12.5px', cursor: 'pointer', transition: 'background 0.13s, border-color 0.13s' }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}>
          Cancelar
        </button>
        <button onClick={onSave} disabled={saving || !qc.title.trim()}
          style={{ flex: 2, padding: '7px', borderRadius: '7px', border: 'none', background: qc.title.trim() && !saving ? '#F2571E' : 'rgba(255,255,255,0.07)', color: qc.title.trim() && !saving ? '#24180A' : '#615846', fontFamily: SORA, fontWeight: 600, fontSize: '12.5px', cursor: qc.title.trim() && !saving ? 'pointer' : 'not-allowed', transition: 'background 0.15s, color 0.15s, filter 0.13s' }}
          onMouseEnter={e => { if (qc.title.trim() && !saving) e.currentTarget.style.filter = 'brightness(1.08)'; }}
          onMouseLeave={e => { e.currentTarget.style.filter = 'none'; }}>
          {saving ? 'Guardando…' : '+ Crear evento'}
        </button>
      </div>
    </div>
  );
}

// ── Day View ──────────────────────────────────────────────────────────────────

function DayView({ date, events, cards, quickCreate, onGridClick, onQcChange, onQcCancel, onQcSave, qcSaving, onEventClick }: {
  date: Date; events: CalendarEvent[]; cards: UserCard[];
  quickCreate: QuickCreate | null;
  onGridClick: (h: number, m: number) => void;
  onQcChange: (qc: QuickCreate) => void;
  onQcCancel: () => void;
  onQcSave: () => void;
  qcSaving: boolean;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const [nowTop, setNowTop] = useState(nowTopPx());
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { const id = setInterval(() => setNowTop(nowTopPx()), 60000); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (scrollRef.current && nowTop > 0) scrollRef.current.scrollTop = Math.max(0, nowTop - 140);
  }, [nowTop]);

  const hours = Array.from({ length: TOTAL_HRS + 1 }, (_, i) => {
    const h = START_HOUR + i;
    const label = h === 12 ? '12:00' : h < 12 ? `${h}:00` : `${h}:00`;
    return { h, label, top: i * HOUR_PX };
  });

  const dayEvents = events.filter(ev => sameDay(new Date(ev.startTime), date));
  const dayCards  = cards.filter(c => c.dueDate && sameDay(new Date(c.dueDate), date) && !c.completed);
  const isToday   = sameDay(date, new Date());
  const eventsCount = dayEvents.length + dayCards.length;

  function handleGridClick(e: React.MouseEvent<HTMLDivElement>) {
    if ((e.target as HTMLElement).closest('[data-event]')) return;
    const rect = (scrollRef.current as HTMLDivElement).getBoundingClientRect();
    const relX = e.clientX - rect.left;
    if (relX < 58) return;
    const relY = e.clientY - rect.top + (scrollRef.current?.scrollTop ?? 0);
    const fracH = relY / HOUR_PX;
    const hour  = START_HOUR + Math.floor(fracH);
    const rawM  = (fracH % 1) * 60;
    const minute = rawM < 20 ? 0 : rawM < 50 ? 30 : 0;
    if (hour < START_HOUR || hour >= END_HOUR) return;
    onGridClick(hour, minute < 60 ? minute : 0);
  }

  return (
    <section style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Day header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '18px', flexShrink: 0 }}>
        <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(2.4rem,4vw,3rem)', lineHeight: 0.9, color: '#F2571E' }}>
          {date.getDate()}
        </span>
        <div style={{ paddingTop: '4px' }}>
          <div style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.05rem', color: '#E8E1D2' }}>{DAYS_FULL[date.getDay()]}</div>
          <div style={{ fontSize: '13px', color: '#827A6D', marginTop: '3px' }}>{MONTHS_ES[date.getMonth()]} {date.getFullYear()}</div>
          <div style={{ fontSize: '12.5px', color: '#827A6D', marginTop: '1px' }}>
            {eventsCount === 0 ? 'Sin eventos' : `${eventsCount} ${eventsCount === 1 ? 'evento' : 'eventos'}`}
            {isToday && <span style={{ color: '#F2571E', marginLeft: '8px' }}>· Hoy</span>}
          </div>
        </div>
      </div>

      {/* Time grid — scrolls internally */}
      <div
        ref={scrollRef}
        className="dshScroll"
        onClick={handleGridClick}
        style={{ flex: 1, position: 'relative', overflowY: 'auto', marginTop: '20px', borderTop: '1px solid rgba(255,255,255,0.06)', cursor: 'crosshair', paddingTop: '12px' }}
      >
        {/* Inner fixed-height canvas */}
        <div style={{ position: 'relative', height: `${TOTAL_HRS * HOUR_PX}px` }}>

          {/* Hour rows */}
          {hours.map(({ h, label, top }) => (
            <div key={h}>
              <div style={{ position: 'absolute', left: '60px', right: 0, top: `${top}px`, borderTop: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', left: 0, top: `${top - 9}px`, fontSize: '11px', color: '#5C5447', userSelect: 'none', pointerEvents: 'none', width: '54px', textAlign: 'right', paddingRight: '8px' }}>
                {label}
              </div>
            </div>
          ))}

          {/* Now line */}
          {isToday && nowTop >= 0 && (
            <div data-event style={{ position: 'absolute', left: '60px', right: 0, top: `${nowTop}px`, borderTop: '1.5px solid #F2571E', zIndex: 3, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', left: '-5px', top: '-5px', width: '9px', height: '9px', borderRadius: '50%', background: '#F2571E' }} />
            </div>
          )}

          {/* Calendar events */}
          {dayEvents.map(ev => {
            const color = hashColor(ev.id);
            return (
              <div key={ev.id} data-event="true"
                style={{ position: 'absolute', left: '68px', right: '8px', top: `${eventTop(ev)}px`, height: `${eventHeight(ev)}px`, borderRadius: '8px', background: `${color}18`, borderLeft: `3px solid ${color}`, padding: '6px 10px', cursor: 'pointer', overflow: 'hidden', zIndex: 2, transition: 'filter 0.14s, transform 0.14s' }}
                onClick={e => { e.stopPropagation(); onEventClick(ev); }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.12)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#E8E1D2' }}>{ev.title}</div>
                <div style={{ fontSize: '11px', color: '#8B8275', marginTop: '1px' }}>{fmtTime(ev.startTime)} – {fmtTime(ev.endTime)}</div>
              </div>
            );
          })}

          {/* Due-date cards */}
          {dayCards.map((c, idx) => {
            const color = c.priority === 'HIGH' ? '#E05252' : c.priority === 'MEDIUM' ? '#DB8A66' : '#76A878';
            const topPx = Math.max(0, (9 + idx * 0.5 - START_HOUR) * HOUR_PX);
            return (
              <div key={c.id} data-event="true"
                style={{ position: 'absolute', left: '68px', right: '8px', top: `${topPx}px`, height: `${HOUR_PX * 0.7}px`, borderRadius: '8px', background: `${color}14`, borderLeft: `3px solid ${color}`, padding: '5px 10px', cursor: 'pointer', overflow: 'hidden', zIndex: 2 }}
                onClick={e => e.stopPropagation()}>
                <div style={{ fontSize: '12.5px', fontWeight: 600, color: '#E8E1D2' }}>{c.title}</div>
                <div style={{ fontSize: '11px', color: '#8B8275', marginTop: '1px' }}>{c.boardName} · Fecha límite</div>
              </div>
            );
          })}

          {/* QuickCreate inline form */}
          {quickCreate && (
            <QuickCreateCard
              qc={quickCreate}
              onChange={onQcChange}
              onCancel={onQcCancel}
              onSave={onQcSave}
              saving={qcSaving}
            />
          )}

          {/* Empty state */}
          {dayEvents.length === 0 && dayCards.length === 0 && !quickCreate && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '10px', color: '#615846', fontSize: '13px', pointerEvents: 'none' }}>
              <span style={{ fontSize: '26px', opacity: 0.25 }}>◎</span>
              Día libre — haz clic para añadir un evento
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

// ── Week View ─────────────────────────────────────────────────────────────────

function WeekView({ selectedDate, events, cards, onSelectDay, onEventClick }: {
  selectedDate: Date; events: CalendarEvent[]; cards: UserCard[];
  onSelectDay: (d: Date) => void;
  onEventClick: (ev: CalendarEvent) => void;
}) {
  const weekDays = getWeekDays(selectedDate);
  const today    = new Date();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      {/* Header */}
      <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7,1fr)`, flexShrink: 0, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div />
        {weekDays.map(d => {
          const isToday = sameDay(d, today), isSel = sameDay(d, selectedDate);
          return (
            <div key={toKey(d)} onClick={() => onSelectDay(d)} style={{ textAlign: 'center', padding: '10px 4px', cursor: 'pointer', transition: 'opacity 0.14s' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.8')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}>
              <div style={{ fontSize: '11px', color: '#615846', fontFamily: SORA, fontWeight: 600 }}>{DAYS_UPPER[d.getDay()]}</div>
              <span style={{ display: 'inline-flex', width: '30px', height: '30px', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', marginTop: '4px', background: isSel ? '#F2571E' : 'transparent', color: isSel ? '#24180A' : isToday ? '#F2571E' : '#E8E1D2', fontWeight: isSel || isToday ? 700 : 400, fontSize: '14px', fontFamily: SORA, transition: 'background 0.18s, color 0.18s' }}>
                {d.getDate()}
              </span>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div className="dshScroll" style={{ flex: 1, overflowY: 'auto', position: 'relative', paddingTop: '12px' }}>
        <div style={{ position: 'relative', height: `${TOTAL_HRS * HOUR_PX}px` }}>
          {Array.from({ length: TOTAL_HRS + 1 }, (_, i) => {
            const h = START_HOUR + i;
            return (
              <div key={h}>
                <div style={{ position: 'absolute', left: '56px', right: 0, top: `${i*HOUR_PX}px`, borderTop: '1px solid rgba(255,255,255,0.05)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', left: 0, top: `${i*HOUR_PX-9}px`, fontSize: '11px', color: '#5C5447', userSelect: 'none', width: '52px', textAlign: 'right', paddingRight: '6px' }}>{h}:00</div>
              </div>
            );
          })}
          {weekDays.map((d, colIdx) => {
            const dayEvents = events.filter(ev => sameDay(new Date(ev.startTime), d));
            const dayCards  = cards.filter(c => c.dueDate && sameDay(new Date(c.dueDate), d) && !c.completed);
            const colL = `calc(56px + ${colIdx} * (100% - 56px) / 7)`;
            const colW = `calc((100% - 56px) / 7 - 4px)`;
            return (
              <div key={toKey(d)}>
                {dayEvents.map(ev => {
                  const color = hashColor(ev.id);
                  return (
                    <div key={ev.id} style={{ position: 'absolute', left: colL, width: colW, top: `${eventTop(ev)}px`, height: `${eventHeight(ev)}px`, borderRadius: '6px', background: `${color}18`, borderLeft: `3px solid ${color}`, padding: '3px 6px', overflow: 'hidden', cursor: 'pointer', zIndex: 2, transition: 'filter 0.14s' }}
                      onClick={() => onEventClick(ev)}
                      onMouseEnter={e => ((e.currentTarget as HTMLElement).style.filter = 'brightness(1.1)')}
                      onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = 'none')}>
                      <div style={{ fontSize: '11.5px', fontWeight: 600, color: '#E8E1D2' }}>{ev.title}</div>
                    </div>
                  );
                })}
                {dayCards.map((c, i) => {
                  const color = c.priority === 'HIGH' ? '#E05252' : c.priority === 'MEDIUM' ? '#DB8A66' : '#76A878';
                  return (
                    <div key={c.id} style={{ position: 'absolute', left: colL, width: colW, top: `${(9+i*0.5-START_HOUR)*HOUR_PX}px`, height: `${HOUR_PX*0.7}px`, borderRadius: '6px', background: `${color}14`, borderLeft: `3px solid ${color}`, padding: '3px 6px', overflow: 'hidden', cursor: 'pointer', zIndex: 2 }}>
                      <div style={{ fontSize: '11px', fontWeight: 600, color: '#E8E1D2' }}>{c.title}</div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Month View ────────────────────────────────────────────────────────────────

function MonthView({ year, month, selectedDate, events, cards, onSelectDay }: {
  year: number; month: number; selectedDate: Date;
  events: CalendarEvent[]; cards: UserCard[]; onSelectDay: (d: Date) => void;
}) {
  const cells = getMonthGrid(year, month);
  const today = new Date();

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '8px', flexShrink: 0 }}>
        {DAYS_SHORT.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: 600, color: '#615846', padding: '4px 0', fontFamily: SORA }}>{d}</div>)}
      </div>
      <div className="dshScroll" style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
          {cells.map((day, i) => {
            if (day === null) return <div key={`e-${i}`} style={{ minHeight: '80px' }} />;
            const d = new Date(year, month, day);
            const key = toKey(d);
            const isToday = sameDay(d, today), isSel = sameDay(d, selectedDate);
            const dayEvs = events.filter(ev => sameDay(new Date(ev.startTime), d));
            const dayCs  = cards.filter(c => c.dueDate && sameDay(new Date(c.dueDate), d) && !c.completed);
            const total  = dayEvs.length + dayCs.length;
            return (
              <div key={key} onClick={() => onSelectDay(d)}
                style={{ minHeight: '80px', padding: '8px', borderRadius: '8px', cursor: 'pointer', border: isSel ? '1px solid rgba(242,87,30,0.4)' : '1px solid rgba(255,255,255,0.04)', background: isSel ? 'rgba(242,87,30,0.06)' : 'rgba(255,255,255,0.01)', transition: 'background 0.14s, border-color 0.14s' }}
                onMouseEnter={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { if (!isSel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.01)'; }}>
                <span style={{ display: 'inline-flex', width: '24px', height: '24px', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', background: isToday && !isSel ? '#F2571E' : 'transparent', color: isToday && !isSel ? '#24180A' : isSel ? '#F2571E' : '#9C9486', fontSize: '12.5px', fontWeight: isToday || isSel ? 700 : 400 }}>{day}</span>
                {dayEvs.slice(0, 2).map(ev => { const c = hashColor(ev.id); return <div key={ev.id} style={{ marginTop: '3px', padding: '1px 5px', borderRadius: '3px', background: `${c}20`, borderLeft: `2px solid ${c}`, fontSize: '10px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>; })}
                {dayCs.slice(0, total > 2 ? 1 : 2).map(c => { const col = c.priority === 'HIGH' ? '#E05252' : c.priority === 'MEDIUM' ? '#DB8A66' : '#76A878'; return <div key={c.id} style={{ marginTop: '2px', padding: '1px 5px', borderRadius: '3px', background: `${col}16`, borderLeft: `2px solid ${col}`, fontSize: '10px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>; })}
                {total > 3 && <div style={{ marginTop: '2px', fontSize: '10px', color: '#615846' }}>+{total - 3} más</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ── Event Detail Modal ────────────────────────────────────────────────────────

function DetailRow({ icon, text, muted }: { icon: React.ReactNode; text: string; muted?: boolean }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
      <span style={{ color: '#5C5447', flexShrink: 0, marginTop: '1px', lineHeight: 0 }}>{icon}</span>
      <span style={{ fontSize: '13.5px', color: muted ? '#827A6D' : '#C8C0B1', lineHeight: 1.55, wordBreak: 'break-word' }}>{text}</span>
    </div>
  );
}

function EventDetailModal({ event, onClose, onDelete }: {
  event: CalendarEvent;
  onClose: () => void;
  onDelete: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const color  = hashColor(event.id);
  const start  = new Date(event.startTime);
  const end    = new Date(event.endTime);
  const dMs    = end.getTime() - start.getTime();
  const dH     = Math.floor(dMs / 3600000);
  const dM     = Math.round((dMs % 3600000) / 60000);
  const durStr = dH > 0 ? (dM > 0 ? `${dH}h ${dM}m` : `${dH}h`) : `${dM}m`;
  const typeLabel = event.type === 'personal' ? 'Personal' : event.type === 'workspace' ? 'Workspace' : 'Equipo';

  const handleDelete = async () => {
    setDeleting(true);
    await onDelete();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: '#13171D', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.08)', boxShadow: '0 24px 64px rgba(0,0,0,0.6)', width: '400px', maxWidth: 'calc(100vw - 32px)', overflow: 'hidden', animation: 'qcIn 0.22s cubic-bezier(0.16,1,0.3,1)', transformOrigin: 'center' }}
      >
        {/* Color bar */}
        <div style={{ height: '4px', background: color }} />

        <div style={{ padding: '22px 24px 24px' }}>
          {/* Title row */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '20px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginBottom: '2px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#615846', textTransform: 'uppercase', letterSpacing: '0.07em', fontFamily: SORA }}>{typeLabel}</span>
              </div>
              <h2 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '19px', color: '#E8E1D2', margin: 0, lineHeight: 1.2 }}>{event.title}</h2>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#5C5447', cursor: 'pointer', padding: '2px', lineHeight: 0, flexShrink: 0, marginTop: '2px', transition: 'color 0.13s' }}
              onMouseEnter={e => (e.currentTarget.style.color = '#9C9486')}
              onMouseLeave={e => (e.currentTarget.style.color = '#5C5447')}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/></svg>
            </button>
          </div>

          {/* Details */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
            <DetailRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.8"/><path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
              text={`${DAYS_FULL[start.getDay()]}, ${start.getDate()} de ${MONTHS_ES[start.getMonth()]} ${start.getFullYear()}`}
            />
            <DetailRow
              icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8"/><path d="M12 7v5l3 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
              text={`${fmtHM(start.getHours(), start.getMinutes())} → ${fmtHM(end.getHours(), end.getMinutes())}  ·  ${durStr}`}
            />
            {event.description && (
              <DetailRow
                icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 6h16M4 10h16M4 14h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                text={event.description}
                muted
              />
            )}
          </div>

          {/* Delete */}
          <button
            onClick={handleDelete}
            disabled={deleting}
            style={{ marginTop: '22px', width: '100%', padding: '10px 0', borderRadius: '9px', border: '1px solid rgba(224,82,82,0.32)', background: 'rgba(224,82,82,0.07)', color: deleting ? '#7A4040' : '#E05252', fontFamily: SORA, fontWeight: 600, fontSize: '13.5px', cursor: deleting ? 'not-allowed' : 'pointer', transition: 'background 0.14s, border-color 0.14s, color 0.14s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '7px' }}
            onMouseEnter={e => { if (!deleting) { e.currentTarget.style.background = 'rgba(224,82,82,0.15)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,0.5)'; }}}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(224,82,82,0.07)'; e.currentTarget.style.borderColor = 'rgba(224,82,82,0.32)'; }}
          >
            {!deleting && <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/></svg>}
            {deleting ? 'Eliminando…' : 'Eliminar evento'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

type ViewType = 'dia' | 'semana' | 'mes';

export default function CalendarPage() {
  const { events, fetchEvents, createEvent, deleteEvent } = useCalendarEventStore();

  const [view,         setView]         = useState<ViewType>('dia');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [miniMonth,    setMiniMonth]    = useState({ year: new Date().getFullYear(), month: new Date().getMonth() });
  const [cards,        setCards]        = useState<UserCard[]>([]);
  const [showModal,    setShowModal]    = useState(false);
  const [modalHour,    setModalHour]    = useState<number | undefined>(undefined);
  const [quickCreate,  setQuickCreate]  = useState<QuickCreate | null>(null);
  const [qcSaving,     setQcSaving]     = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  const today = useMemo(() => new Date(), []);

  useEffect(() => { fetchEvents(); }, [fetchEvents]);
  useEffect(() => {
    apiService.get<{ pending: UserCard[]; overdue: UserCard[] }>('/api/users/me/cards', true)
      .then(res => { if (res.success && res.data) setCards([...res.data.pending, ...res.data.overdue]); })
      .catch(() => {});
  }, []);

  // Dismiss quick-create on outside click
  useEffect(() => {
    if (!quickCreate) return;
    const handler = () => setQuickCreate(null);
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [quickCreate]);

  function navigate(delta: number) {
    const d = new Date(selectedDate);
    if (view === 'dia')    d.setDate(d.getDate() + delta);
    if (view === 'semana') d.setDate(d.getDate() + delta * 7);
    if (view === 'mes')    d.setMonth(d.getMonth() + delta);
    setSelectedDate(d);
    setMiniMonth({ year: d.getFullYear(), month: d.getMonth() });
  }

  function goToday() {
    const d = new Date();
    setSelectedDate(d);
    setMiniMonth({ year: d.getFullYear(), month: d.getMonth() });
  }

  function handleGridClick(hour: number, minute: number) {
    setQuickCreate({ hour, minute, durationH: 1, title: '' });
  }

  async function handleQcSave() {
    if (!quickCreate || !quickCreate.title.trim()) return;
    setQcSaving(true);
    try {
      const dateStr = `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth()+1)}-${pad2(selectedDate.getDate())}`;
      const startISO = new Date(`${dateStr}T${pad2(quickCreate.hour)}:${pad2(quickCreate.minute)}:00`).toISOString();
      const end = addHours(quickCreate.hour, quickCreate.minute, quickCreate.durationH);
      const endH = Math.min(end.hour, 23), endM = end.hour > 23 ? 59 : end.minute;
      const endISO = new Date(`${dateStr}T${pad2(endH)}:${pad2(endM)}:00`).toISOString();
      const result = await createEvent({
        title:     quickCreate.title,
        startTime: startISO,
        endTime:   endISO,
        type:      'personal',
        color:     '#F2571E',
      });
      if (result) {
        fetchEvents();
        setQuickCreate(null);
      }
    } catch {
      // keep form open on error
    } finally {
      setQcSaving(false);
    }
  }

  async function handleDeleteEvent() {
    if (!selectedEvent) return;
    await deleteEvent(selectedEvent.id);
    setSelectedEvent(null);
  }

  const eventDays = useMemo(() => {
    const s = new Set<string>();
    for (const ev of events) s.add(toKey(new Date(ev.startTime)));
    for (const c of cards) { if (c.dueDate) s.add(toKey(new Date(c.dueDate))); }
    return s;
  }, [events, cards]);

  const agenda = useMemo(() => {
    const upcoming: { key: string; day: string; color: string; title: string; time: string }[] = [];
    const now = new Date();
    const limit = new Date(now); limit.setDate(limit.getDate() + 14);
    for (const ev of events) {
      const d = new Date(ev.startTime);
      if (d >= now && d <= limit) upcoming.push({ key: ev.id, day: DAYS_UPPER[d.getDay()], color: hashColor(ev.id), title: ev.title, time: fmtTime(ev.startTime) });
    }
    for (const c of cards) {
      if (!c.dueDate) continue;
      const d = new Date(c.dueDate);
      if (d >= now && d <= limit) {
        const color = c.priority === 'HIGH' ? '#E05252' : c.priority === 'MEDIUM' ? '#DB8A66' : '#76A878';
        upcoming.push({ key: c.id, day: DAYS_UPPER[d.getDay()], color, title: c.title, time: 'Límite' });
      }
    }
    return upcoming.sort((a, b) => a.day.localeCompare(b.day)).slice(0, 7);
  }, [events, cards]);

  const headerLabel = (() => {
    if (view === 'dia')    return `${selectedDate.getDate()} ${MONTHS_ES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
    if (view === 'semana') { const w = getWeekDays(selectedDate); return `${w[0].getDate()} – ${w[6].getDate()} ${MONTHS_ES[selectedDate.getMonth()]}`; }
    return `${MONTHS_ES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  })();

  const dateStr = `${selectedDate.getFullYear()}-${pad2(selectedDate.getMonth()+1)}-${pad2(selectedDate.getDate())}`;

  return (
    <div style={{
      height: '100vh', overflow: 'hidden',
      display: 'flex', flexDirection: 'column',
      fontFamily: MANROPE,
    }}>
      <style>{`
        @keyframes qcIn {
          from { opacity: 0; transform: translateY(-7px) scale(0.975); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .cal-circle-btn {
          background: transparent;
          transition: background 0.15s;
        }
        .cal-circle-btn:hover {
          background: rgba(255,255,255,0.07) !important;
        }
      `}</style>

      {/* ── Centered container ── */}
      <div style={{
        maxWidth: '1320px', width: '100%', margin: '0 auto',
        padding: 'clamp(18px,2.5vw,32px) clamp(18px,3vw,40px) 0',
        display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0,
      }}>

      {/* ── Toolbar ──────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexShrink: 0, paddingBottom: '16px' }}>

        {/* View switcher */}
        <div style={{ display: 'flex', gap: '2px', padding: '3px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)' }}>
          {(['dia','semana','mes'] as ViewType[]).map(key => (
            <span key={key} onClick={() => setView(key)}
              style={{ padding: '6px 15px', borderRadius: '8px', fontFamily: SORA, fontWeight: 600, fontSize: '13px', color: view === key ? '#24180A' : '#8B8275', background: view === key ? '#F2571E' : 'transparent', cursor: 'pointer', transition: 'background 0.18s, color 0.18s' }}>
              {key === 'dia' ? 'Día' : key === 'semana' ? 'Semana' : 'Mes'}
            </span>
          ))}
        </div>

        {/* Date label */}
        <span style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 600, color: '#E8E1D2', flex: 1, textAlign: 'center' }}>
          {headerLabel}
        </span>

        {/* Nav + create */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CircleBtn onClick={() => navigate(-1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M15 6l-6 6 6 6" stroke="#9C9486" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </CircleBtn>
          <span onClick={goToday}
            style={{ padding: '7px 14px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)', fontFamily: SORA, fontWeight: 600, fontSize: '13px', color: '#D8D0C1', cursor: 'pointer', transition: 'background 0.14s' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'transparent')}>
            Hoy
          </span>
          <CircleBtn onClick={() => navigate(1)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M9 6l6 6-6 6" stroke="#9C9486" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </CircleBtn>
          <button onClick={() => { setModalHour(undefined); setShowModal(true); }}
            style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '8px 15px', borderRadius: '8px', border: 'none', background: '#F2571E', color: '#24180A', fontFamily: SORA, fontWeight: 600, fontSize: '13px', cursor: 'pointer', transition: 'filter 0.14s, transform 0.14s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#24180A" strokeWidth="2.2" strokeLinecap="round"/></svg>
            Nuevo evento
          </button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', gap: '24px', minHeight: 0, paddingBottom: '16px' }}>

        {/* Main calendar view */}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
          {view === 'dia' && (
            <DayView
              date={selectedDate} events={events} cards={cards}
              quickCreate={quickCreate}
              onGridClick={handleGridClick}
              onQcChange={setQuickCreate}
              onQcCancel={() => setQuickCreate(null)}
              onQcSave={handleQcSave}
              qcSaving={qcSaving}
              onEventClick={setSelectedEvent}
            />
          )}
          {view === 'semana' && (
            <WeekView selectedDate={selectedDate} events={events} cards={cards}
              onSelectDay={d => { setSelectedDate(d); setView('dia'); }}
              onEventClick={setSelectedEvent} />
          )}
          {view === 'mes' && (
            <MonthView year={selectedDate.getFullYear()} month={selectedDate.getMonth()}
              selectedDate={selectedDate} events={events} cards={cards}
              onSelectDay={d => { setSelectedDate(d); setView('dia'); }} />
          )}
        </div>

        {/* Right aside */}
        <aside className="dshScroll" style={{ width: '268px', flexShrink: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <MiniCalendar
            year={miniMonth.year} month={miniMonth.month}
            selectedDate={selectedDate} today={today} eventDays={eventDays}
            onPrev={() => setMiniMonth(m => { const d = new Date(m.year, m.month-1,1); return { year: d.getFullYear(), month: d.getMonth() }; })}
            onNext={() => setMiniMonth(m => { const d = new Date(m.year, m.month+1,1); return { year: d.getFullYear(), month: d.getMonth() }; })}
            onSelectDay={day => {
              const d = new Date(miniMonth.year, miniMonth.month, day);
              setSelectedDate(d);
              if (view === 'mes') setView('dia');
            }}
          />

          <div>
            <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '13px', color: '#615846', textTransform: 'uppercase', letterSpacing: '0.07em', margin: '0 0 10px' }}>Próximos</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {agenda.length > 0 ? agenda.map(e => (
                <div key={e.key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 10px', borderRadius: '8px', cursor: 'pointer', transition: 'background 0.12s' }}
                  onMouseEnter={ev => ((ev.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
                  onMouseLeave={ev => ((ev.currentTarget as HTMLElement).style.background = 'transparent')}>
                  <span style={{ fontFamily: SORA, fontSize: '11px', fontWeight: 700, color: '#827A6D', width: '32px', flexShrink: 0 }}>{e.day}</span>
                  <span style={{ width: '3px', height: '24px', borderRadius: '8px', background: e.color, flexShrink: 0 }} />
                  <span style={{ flex: 1, fontSize: '13px', color: '#D8D0C1', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</span>
                  <span style={{ fontSize: '11.5px', color: '#827A6D', flexShrink: 0 }}>{e.time}</span>
                </div>
              )) : (
                <div style={{ padding: '14px 10px', fontSize: '13px', color: '#615846' }}>Sin eventos próximos</div>
              )}
            </div>
          </div>
        </aside>
      </div>

      </div>{/* end centered container */}

      <CreateEventModal
        open={showModal}
        onClose={() => { setShowModal(false); fetchEvents(); }}
        initialDate={dateStr}
        initialHour={modalHour}
      />

      {selectedEvent && (
        <EventDetailModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onDelete={handleDeleteEvent}
        />
      )}
    </div>
  );
}
