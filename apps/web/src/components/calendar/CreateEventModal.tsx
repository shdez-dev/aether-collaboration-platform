// apps/web/src/components/calendar/CreateEventModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useCalendarEventStore, type CalendarEvent, type CreateEventInput } from '@/stores/calendarEventStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTeamStore } from '@/stores/teamStore';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SORA   = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const COLORS = [
  { label: 'Naranja',   value: '#7452A6' },
  { label: 'Azul',      value: '#8076A7' },
  { label: 'Verde',     value: '#548B73' },
  { label: 'Ámbar',     value: '#A97556' },
  { label: 'Violeta',   value: '#8262B2' },
  { label: 'Celeste',   value: '#7D91B1' },
  { label: 'Rojo',      value: '#B45C72' },
  { label: 'Terracota', value: '#A87876' },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open:          boolean;
  onClose:       () => void;
  initialDate?:  string;          // YYYY-MM-DD
  initialHour?:  number;          // 0-23
  eventToEdit?:  CalendarEvent | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function buildISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

// ── Field component ───────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
      <label style={{
        fontFamily: SORA, fontSize: '11px', fontWeight: 600,
        letterSpacing: '0.09em', textTransform: 'uppercase', color: 'var(--c-text4)',
      }}>
        {label}
      </label>
      {children}
    </div>
  );
}

const inputBase: React.CSSProperties = {
  width: '100%', fontFamily: MANROPE, fontSize: '14.5px', color: 'var(--c-text)',
  background: 'rgba(97,71,130,0.04)', border: '1px solid rgba(97,71,130,0.09)',
  borderRadius: '8px', padding: '11px 14px', outline: 'none',
  colorScheme: 'light',
};

function AInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      {...props}
      style={{ ...inputBase, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)'; props.onFocus?.(e); }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(97,71,130,0.09)'; props.onBlur?.(e); }}
    />
  );
}

function ATextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      style={{ ...inputBase, resize: 'none', lineHeight: 1.55, ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(97,71,130,0.09)'; }}
    />
  );
}

function ASelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      style={{ ...inputBase, cursor: 'pointer', ...props.style }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(97,71,130,0.09)'; }}
    />
  );
}

// ── Toggle ────────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: () => void; label: string }) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', userSelect: 'none' }}>
      <div
        onClick={onChange}
        style={{
          width: '34px', height: '20px', borderRadius: '10px',
          background: checked ? '#7452A6' : 'rgba(97,71,130,0.1)',
          position: 'relative', transition: 'background 0.2s', flexShrink: 0,
        }}
      >
        <div style={{
          position: 'absolute', top: '3px', left: checked ? '17px' : '3px',
          width: '14px', height: '14px', borderRadius: '50%', background: '#fff',
          transition: 'left 0.2s',
        }} />
      </div>
      <span style={{ fontFamily: MANROPE, fontSize: '13.5px', color: 'var(--c-text2)' }}>{label}</span>
    </label>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────

export default function CreateEventModal({ open, onClose, initialDate, initialHour, eventToEdit }: Props) {
  const createEvent = useCalendarEventStore(s => s.createEvent);
  const updateEvent = useCalendarEventStore(s => s.updateEvent);
  const deleteEvent = useCalendarEventStore(s => s.deleteEvent);
  const workspaces  = useWorkspaceStore(s => s.workspaces);
  const teams       = useTeamStore(s => s.teams);

  const isEdit = !!eventToEdit;

  const today       = new Date();
  const defaultDate = initialDate ?? `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const defaultHour = initialHour ?? today.getHours();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [date,        setDate]        = useState(defaultDate);
  const [startTime,   setStartTime]   = useState(`${pad(defaultHour)}:00`);
  const [endTime,     setEndTime]     = useState(`${pad(Math.min(defaultHour + 1, 23))}:00`);
  const [allDay,      setAllDay]      = useState(false);
  const [color,       setColor]       = useState(COLORS[0].value);
  const [type,        setType]        = useState<'personal' | 'workspace' | 'team'>('personal');
  const [workspaceId, setWorkspaceId] = useState('');
  const [teamId,      setTeamId]      = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState('');
  const [visible,     setVisible]     = useState(false);

  // Animation state
  useEffect(() => {
    if (open) { setTimeout(() => setVisible(true), 10); }
    else      { setVisible(false); }
  }, [open]);

  // Prefill on edit
  useEffect(() => {
    if (eventToEdit) {
      const start = new Date(eventToEdit.startTime);
      const end   = new Date(eventToEdit.endTime);
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description ?? '');
      setDate(`${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`);
      setStartTime(`${pad(start.getHours())}:${pad(start.getMinutes())}`);
      setEndTime(`${pad(end.getHours())}:${pad(end.getMinutes())}`);
      setAllDay(eventToEdit.allDay);
      setColor(eventToEdit.color);
      setType(eventToEdit.type);
      setWorkspaceId(eventToEdit.workspaceId ?? '');
      setTeamId(eventToEdit.teamId ?? '');
    } else {
      setTitle(''); setDescription('');
      setDate(defaultDate);
      setStartTime(`${pad(defaultHour)}:00`);
      setEndTime(`${pad(Math.min(defaultHour + 1, 23))}:00`);
      setAllDay(false); setColor(COLORS[0].value);
      setType('personal'); setWorkspaceId(''); setTeamId('');
    }
    setError('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventToEdit, open]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);

  function validate(): string {
    if (!title.trim())                        return 'El título es requerido';
    if (!allDay && startTime >= endTime)      return 'La hora de fin debe ser posterior al inicio';
    if (type === 'workspace' && !workspaceId) return 'Selecciona un workspace';
    if (type === 'team'      && !teamId)      return 'Selecciona un equipo';
    return '';
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true); setError('');

    const startISO = allDay
      ? new Date(`${date}T00:00:00`).toISOString()
      : buildISO(date, startTime);
    const endISO = allDay
      ? new Date(`${date}T23:59:59`).toISOString()
      : buildISO(date, endTime);

    const input: CreateEventInput = {
      title:       title.trim(),
      description: description.trim() || undefined,
      startTime:   startISO,
      endTime:     endISO,
      allDay, color, type,
      workspaceId: type === 'workspace' ? workspaceId : undefined,
      teamId:      type === 'team'      ? teamId      : undefined,
    };

    if (isEdit && eventToEdit) {
      const ok = await updateEvent(eventToEdit.id, input);
      if (!ok) { setError('No se pudo actualizar el evento'); setSaving(false); return; }
    } else {
      const ok = await createEvent(input);
      if (!ok) { setError('No se pudo crear el evento'); setSaving(false); return; }
    }
    setSaving(false);
    onClose();
  }

  async function handleDelete() {
    if (!eventToEdit) return;
    setDeleting(true);
    await deleteEvent(eventToEdit.id);
    setDeleting(false);
    onClose();
  }

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(0,0,0,0.6)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 0.18s ease',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 101,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '16px', pointerEvents: 'none',
        }}
      >
        <div
          onClick={e => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '460px', pointerEvents: 'all',
            background: 'var(--c-surface)',
            border: '1px solid rgba(97,71,130,0.1)',
            borderRadius: '14px',
            boxShadow: '0 32px 80px rgba(0,0,0,0.6)',
            overflow: 'hidden',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0) scale(1)' : 'translateY(12px) scale(0.97)',
            transition: 'opacity 0.2s ease, transform 0.2s ease',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px',
            borderBottom: '1px solid rgba(97,71,130,0.07)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                width: '28px', height: '28px', borderRadius: '7px',
                background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="5" width="17" height="15" rx="2.5" stroke="#FFFFFF" strokeWidth="1.8"/>
                  <path d="M3.5 9h17M8 3.5v3M16 3.5v3" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
              </span>
              <h2 style={{
                fontFamily: SORA, fontWeight: 700, fontSize: '16px',
                color: 'var(--c-text)', margin: 0,
              }}>
                {isEdit ? 'Editar evento' : 'Nuevo evento'}
              </h2>
            </div>
            <button
              onClick={onClose}
              style={{
                width: '30px', height: '30px', borderRadius: '7px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'var(--c-text3)',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.06)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text3)'; }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div style={{ padding: '22px', display: 'flex', flexDirection: 'column', gap: '18px', maxHeight: '70vh', overflowY: 'auto' }}>

              {/* Título */}
              <Field label="Título">
                <AInput
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Nombre del evento"
                  style={{ fontSize: '15px', fontWeight: 600 }}
                />
              </Field>

              {/* Descripción */}
              <Field label="Descripción">
                <ATextarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalles opcionales..."
                  rows={2}
                />
              </Field>

              {/* Fecha + Todo el día */}
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <Field label="Fecha">
                    <AInput type="date" value={date} onChange={e => setDate(e.target.value)} />
                  </Field>
                </div>
                <div style={{ paddingBottom: '2px' }}>
                  <Toggle checked={allDay} onChange={() => setAllDay(v => !v)} label="Todo el día" />
                </div>
              </div>

              {/* Hora inicio / fin */}
              {!allDay && (
                <div style={{ display: 'flex', gap: '14px' }}>
                  <Field label="Inicio">
                    <AInput
                      type="time"
                      value={startTime}
                      onChange={e => {
                        setStartTime(e.target.value);
                        if (e.target.value >= endTime) {
                          const [h] = e.target.value.split(':').map(Number);
                          setEndTime(`${pad(Math.min(h + 1, 23))}:00`);
                        }
                      }}
                      style={{ flex: 1 }}
                    />
                  </Field>
                  <Field label="Fin">
                    <AInput type="time" value={endTime} onChange={e => setEndTime(e.target.value)} style={{ flex: 1 }} />
                  </Field>
                </div>
              )}

              {/* Color */}
              <Field label="Color">
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.value)}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        background: c.value, border: 'none', cursor: 'pointer',
                        outline: color === c.value ? `3px solid ${c.value}` : 'none',
                        outlineOffset: '2px',
                        transform: color === c.value ? 'scale(1.15)' : 'scale(1)',
                        transition: 'transform 0.15s, outline 0.15s',
                      }}
                    />
                  ))}
                </div>
              </Field>

              {/* Tipo */}
              <Field label="Tipo">
                <div style={{ display: 'flex', gap: '6px' }}>
                  {(['personal', 'workspace', 'team'] as const).map(t => {
                    const isActive = type === t;
                    const labels = { personal: 'Personal', workspace: 'Workspace', team: 'Equipo' };
                    const icons = {
                      personal: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.7"/><path d="M4 20a8 8 0 0 1 16 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
                      workspace: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.7"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20" stroke="currentColor" strokeWidth="1.7"/></svg>,
                      team: <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="1.7"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/><path d="M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/></svg>,
                    };
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setType(t)}
                        style={{
                          flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                          padding: '9px 0', borderRadius: '8px', cursor: 'pointer',
                          border: `1px solid ${isActive ? color : 'rgba(97,71,130,0.09)'}`,
                          background: isActive ? `${color}18` : 'rgba(97,71,130,0.02)',
                          color: isActive ? color : 'var(--c-text2)',
                          fontFamily: MANROPE, fontSize: '13px', fontWeight: isActive ? 600 : 400,
                          transition: 'all 0.15s',
                        }}
                      >
                        {icons[t]}
                        {labels[t]}
                      </button>
                    );
                  })}
                </div>
              </Field>

              {/* Workspace selector */}
              {type === 'workspace' && (
                <Field label="Workspace">
                  <ASelect value={workspaceId} onChange={e => setWorkspaceId(e.target.value)}>
                    <option value="">Selecciona un workspace…</option>
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </ASelect>
                </Field>
              )}

              {/* Team selector */}
              {type === 'team' && (
                <Field label="Equipo">
                  <ASelect value={teamId} onChange={e => setTeamId(e.target.value)}>
                    <option value="">Selecciona un equipo…</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </ASelect>
                </Field>
              )}

              {/* Error */}
              {error && (
                <div style={{
                  background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)',
                  borderRadius: '8px', padding: '10px 14px',
                }}>
                  <span style={{ fontFamily: MANROPE, fontSize: '13px', color: '#B45C72' }}>{error}</span>
                </div>
              )}
            </div>

            {/* Footer actions */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '10px',
              padding: '16px 22px',
              borderTop: '1px solid rgba(97,71,130,0.07)',
            }}>
              {isEdit && (
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  style={{
                    padding: '9px 16px', borderRadius: '8px', cursor: deleting ? 'not-allowed' : 'pointer',
                    background: 'rgba(224,82,82,0.08)', border: '1px solid rgba(224,82,82,0.25)',
                    color: '#B45C72', fontFamily: MANROPE, fontWeight: 600, fontSize: '13.5px',
                    opacity: deleting ? 0.5 : 1,
                  }}
                >
                  {deleting ? 'Eliminando…' : 'Eliminar'}
                </button>
              )}

              <div style={{ flex: 1 }} />

              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(97,71,130,0.1)',
                  color: 'var(--c-text2)', fontFamily: MANROPE, fontWeight: 600, fontSize: '13.5px',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)'; }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={saving}
                style={{
                  padding: '9px 22px', borderRadius: '8px',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  background: '#7452A6', border: 'none',
                  color: '#FFFFFF', fontFamily: SORA, fontWeight: 700, fontSize: '13.5px',
                  opacity: saving ? 0.65 : 1,
                }}
                onMouseEnter={e => { if (!saving) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
              >
                {saving ? 'Guardando…' : isEdit ? 'Actualizar' : 'Crear evento'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
