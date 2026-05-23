// apps/web/src/components/calendar/CreateEventModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Clock, AlignLeft, Palette, Users, Globe, User } from 'lucide-react';
import { useCalendarEventStore, type CalendarEvent, type CreateEventInput } from '@/stores/calendarEventStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTeamStore } from '@/stores/teamStore';

// ─── Colores de la paleta de la referencia ────────────────────────────────────
const COLORS = [
  { label: 'Cyan',    value: '#5ec5ff' },
  { label: 'Rosa',    value: '#ff6b9d' },
  { label: 'Violeta', value: '#a78bfa' },
  { label: 'Ámbar',   value: '#fbbf24' },
  { label: 'Verde',   value: '#4ade80' },
  { label: 'Rojo',    value: '#f87171' },
  { label: 'Índigo',  value: '#818cf8' },
  { label: 'Esmeralda',value:'#34d399' },
];

// ─── Tokens del diseño (igual que la referencia) ──────────────────────────────
const R = {
  bg:    '#0b1320',
  bg2:   '#0f1d2e',
  bg3:   '#142536',
  line:  '#1a2a3d',
  line2: '#233649',
  text:  '#cfe0f2',
  text2: '#8fa6bf',
  text3: '#5d7491',
  text4: '#3f5571',
  cyan:  '#5ec5ff',
};

// ─── Props ────────────────────────────────────────────────────────────────────
interface Props {
  open:         boolean;
  onClose:      () => void;
  initialDate?: string;       // YYYY-MM-DD
  initialHour?: number;       // 0-23
  eventToEdit?: CalendarEvent | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n: number) { return String(n).padStart(2, '0'); }

function toTimeStr(date: Date) {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function buildISO(dateStr: string, timeStr: string): string {
  return new Date(`${dateStr}T${timeStr}:00`).toISOString();
}

const ROW = 26;

const MIN_HOUR = 6;
const MAX_HOUR = 23;

function TimeSelect({ value, onChange, minHour = MIN_HOUR, maxHour = MAX_HOUR }: {
  value: string; onChange: (v: string) => void; minHour?: number; maxHour?: number;
}) {
  const [h, m] = value.split(':').map(Number);
  const [dirH, setDirH] = useState(0);
  const [dirM, setDirM] = useState(0);

  const stepH = (d: number) => {
    const next = h + d;
    if (next < minHour || next > maxHour) return;
    setDirH(d);
    onChange(`${pad(next)}:${pad(m)}`);
  };
  const stepM = (d: number) => {
    const newM = (m + d * 5 + 60) % 60;
    // Si estamos en el límite de hora y los minutos van a cruzar, no permitir
    if (d > 0 && h >= maxHour) return;
    if (d < 0 && h <= minHour && m === 0) return;
    setDirM(d);
    onChange(`${pad(h)}:${pad(newM)}`);
  };

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 0,
      background: '#0f1d2e', border: '1px solid #1a2a3d', borderRadius: 7,
    }}>
      <DrumUnit
        value={pad(h)}
        prevVal={h - 1 >= minHour ? pad(h - 1) : null}
        nextVal={h + 1 <= maxHour ? pad(h + 1) : null}
        dir={dirH}
        onUp={() => stepH(-1)}
        onDown={() => stepH(1)}
      />
      <span style={{ fontSize: 13, color: '#233649', fontFamily: "'JetBrains Mono', monospace", userSelect: 'none', padding: '0 1px' }}>:</span>
      <DrumUnit
        value={pad(m)}
        prevVal={!(h <= minHour && m === 0) ? pad((m - 5 + 60) % 60) : null}
        nextVal={h < maxHour ? pad((m + 5) % 60) : null}
        dir={dirM}
        onUp={() => stepM(-1)}
        onDown={() => stepM(1)}
      />
    </div>
  );
}

function DrumUnit({ value, prevVal, nextVal, dir, onUp, onDown }: {
  value: string; prevVal: string | null; nextVal: string | null;
  dir: number; onUp: () => void; onDown: () => void;
}) {
  const [open, setOpen] = useState(false);

  const ghostStyle: React.CSSProperties = {
    height: ROW, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontSize: 12, fontFamily: "'JetBrains Mono', monospace",
    color: '#3a5570', cursor: 'pointer', userSelect: 'none',
    transition: 'color 0.1s, background 0.1s',
  };

  return (
    <div
      style={{ width: 38, position: 'relative' }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onWheel={e => { e.preventDefault(); e.deltaY < 0 ? onUp() : onDown(); }}
    >
      {/* fila anterior — flota encima sin afectar layout */}
      <AnimatePresence>
        {open && prevVal !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute', bottom: '100%', left: 0, right: 0,
              background: '#0f1d2e', borderRadius: '5px 5px 0 0',
              borderTop: '1px solid #1a2a3d', borderLeft: '1px solid #1a2a3d', borderRight: '1px solid #1a2a3d',
              overflow: 'hidden', zIndex: 10,
            }}
          >
            <div
              style={ghostStyle}
              onClick={onUp}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#8fa6bf'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(94,197,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#3a5570'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {prevVal}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* fila actual — siempre en el flujo normal */}
      <div style={{
        height: ROW, display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'default',
      }}>
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={value}
            initial={{ y: dir > 0 ? 9 : -9, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: dir > 0 ? -9 : 9, opacity: 0 }}
            transition={{ duration: 0.13, ease: 'easeOut' }}
            style={{
              display: 'block', fontSize: 13,
              fontFamily: "'JetBrains Mono', monospace",
              color: open ? '#5ec5ff' : '#cfe0f2',
              fontWeight: 600, userSelect: 'none',
              transition: 'color 0.12s',
            }}
          >
            {value}
          </motion.span>
        </AnimatePresence>
      </div>

      {/* fila siguiente — flota debajo sin afectar layout */}
      <AnimatePresence>
        {open && nextVal !== null && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: '#0f1d2e', borderRadius: '0 0 5px 5px',
              borderBottom: '1px solid #1a2a3d', borderLeft: '1px solid #1a2a3d', borderRight: '1px solid #1a2a3d',
              overflow: 'hidden', zIndex: 10,
            }}
          >
            <div
              style={ghostStyle}
              onClick={onDown}
              onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.color = '#8fa6bf'; (e.currentTarget as HTMLDivElement).style.background = 'rgba(94,197,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.color = '#3a5570'; (e.currentTarget as HTMLDivElement).style.background = 'transparent'; }}
            >
              {nextVal}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Input styles ─────────────────────────────────────────────────────────────
const inputStyle: React.CSSProperties = {
  width:        '100%',
  background:   R.bg3,
  border:       `1px solid ${R.line2}`,
  borderRadius: 5,
  padding:      '8px 11px',
  color:        R.text,
  fontSize:     12,
  fontFamily:   "'JetBrains Mono', monospace",
  outline:      'none',
};

const labelStyle: React.CSSProperties = {
  fontSize:      9,
  letterSpacing: '.14em',
  textTransform: 'uppercase' as const,
  color:         R.text4,
  marginBottom:  5,
  display:       'block',
};

// ─── Componente ───────────────────────────────────────────────────────────────
export default function CreateEventModal({ open, onClose, initialDate, initialHour, eventToEdit }: Props) {
  const createEvent = useCalendarEventStore(s => s.createEvent);
  const updateEvent = useCalendarEventStore(s => s.updateEvent);
  const deleteEvent = useCalendarEventStore(s => s.deleteEvent);

  const workspaces  = useWorkspaceStore(s => s.workspaces);
  const teams       = useTeamStore(s => s.teams);

  const isEdit = !!eventToEdit;

  // ── Estado del formulario ────────────────────────────────────────────────────
  const today = new Date();
  const defaultDate = initialDate ?? `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
  const defaultHour = initialHour ?? today.getHours();

  const [title,       setTitle]       = useState('');
  const [description, setDescription] = useState('');
  const [date,        setDate]        = useState(defaultDate);
  const [startTime,   setStartTime]   = useState(`${pad(defaultHour)}:00`);
  const [endTime,     setEndTime]     = useState(`${pad(defaultHour + 1)}:00`);
  const [allDay,      setAllDay]      = useState(false);
  const [color,       setColor]       = useState(COLORS[0].value);
  const [type,        setType]        = useState<'personal' | 'workspace' | 'team'>('personal');
  const [workspaceId, setWorkspaceId] = useState('');
  const [teamId,      setTeamId]      = useState('');
  const [saving,      setSaving]      = useState(false);
  const [deleting,    setDeleting]    = useState(false);
  const [error,       setError]       = useState('');

  // ── Precargar datos al editar ────────────────────────────────────────────────
  useEffect(() => {
    if (eventToEdit) {
      const start = new Date(eventToEdit.startTime);
      const end   = new Date(eventToEdit.endTime);
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description ?? '');
      setDate(`${start.getFullYear()}-${pad(start.getMonth()+1)}-${pad(start.getDate())}`);
      setStartTime(toTimeStr(start));
      setEndTime(toTimeStr(end));
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

  // ── Validación rápida ────────────────────────────────────────────────────────
  function validate(): string {
    if (!title.trim())                         return 'El título es requerido';
    if (!allDay && startTime >= endTime)       return 'La hora de fin debe ser posterior al inicio';
    if (type === 'workspace' && !workspaceId)  return 'Selecciona un workspace';
    if (type === 'team'      && !teamId)       return 'Selecciona un equipo';
    return '';
  }

  // ── Submit ───────────────────────────────────────────────────────────────────
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
      allDay,
      color,
      type,
      workspaceId: type === 'workspace' ? workspaceId : undefined,
      teamId:      type === 'team'      ? teamId      : undefined,
    };

    if (isEdit && eventToEdit) {
      const updated = await updateEvent(eventToEdit.id, input);
      if (!updated) setError('No se pudo actualizar el evento');
      else          onClose();
    } else {
      const created = await createEvent(input);
      if (!created) setError('No se pudo crear el evento');
      else          onClose();
    }
    setSaving(false);
  }

  // ── Eliminar ─────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!eventToEdit) return;
    setDeleting(true);
    await deleteEvent(eventToEdit.id);
    setDeleting(false);
    onClose();
  }

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Overlay + centering wrapper */}
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', zIndex: 50,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: '16px',
            }}
          >
          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.97 }}
            animate={{ opacity: 1, y: 0,  scale: 1     }}
            exit={{ opacity: 0,    y: 12, scale: 0.97  }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            onClick={e => e.stopPropagation()}
            style={{
              position:      'relative',
              zIndex:        51,
              width:         '100%',
              maxWidth:      420,
              background:    R.bg2,
              border:        `1px solid ${R.line2}`,
              borderRadius:  10,
              boxShadow:     '0 24px 64px rgba(0,0,0,0.7)',
              fontFamily:    "'JetBrains Mono', monospace",
              overflow:      'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: `1px solid ${R.line}` }}>
              <div style={{ fontSize: 9, letterSpacing: '.18em', textTransform: 'uppercase', color: R.cyan }}>
                — {isEdit ? 'EDITAR EVENTO' : 'NUEVO EVENTO'}
              </div>
              <button onClick={onClose} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: R.text3, display: 'flex', padding: 2 }}>
                <X size={14} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: 14 }}>

              {/* Título */}
              <div>
                <label style={labelStyle}>Título</label>
                <input
                  autoFocus
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="Ej. Daily meeting"
                  style={{ ...inputStyle }}
                  onFocus={e => (e.target.style.borderColor = R.cyan)}
                  onBlur={e  => (e.target.style.borderColor = R.line2)}
                />
              </div>

              {/* Descripción */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <AlignLeft size={10} /> Descripción
                </label>
                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value)}
                  placeholder="Detalles opcionales..."
                  rows={2}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                  onFocus={e => (e.target.style.borderColor = R.cyan)}
                  onBlur={e  => (e.target.style.borderColor = R.line2)}
                />
              </div>

              {/* Fecha + Todo el día */}
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>Fecha</label>
                  <input
                    type="date"
                    value={date}
                    onChange={e => setDate(e.target.value)}
                    style={{ ...inputStyle, colorScheme: 'dark' }}
                    onFocus={e => (e.target.style.borderColor = R.cyan)}
                    onBlur={e  => (e.target.style.borderColor = R.line2)}
                  />
                </div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', paddingBottom: 9, whiteSpace: 'nowrap' }}>
                  <div
                    onClick={() => setAllDay(v => !v)}
                    style={{
                      width: 28, height: 16, borderRadius: 8,
                      background: allDay ? R.cyan : R.line2,
                      position: 'relative', cursor: 'pointer', transition: 'background 0.2s',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{
                      position: 'absolute', top: 2, left: allDay ? 14 : 2,
                      width: 12, height: 12, borderRadius: '50%', background: '#fff',
                      transition: 'left 0.2s',
                    }} />
                  </div>
                  <span style={{ fontSize: 10, color: R.text3 }}>Todo el día</span>
                </label>
              </div>

              {/* Horas */}
              {!allDay && (
                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={9} /> Inicio
                    </label>
                    <TimeSelect value={startTime} onChange={v => {
                      setStartTime(v);
                      // Auto-push endTime si el inicio la alcanza o supera
                      const [sh, sm] = v.split(':').map(Number);
                      const [eh, em] = endTime.split(':').map(Number);
                      if (sh * 60 + sm >= eh * 60 + em) {
                        const newEh = Math.min(sh + 1, MAX_HOUR);
                        setEndTime(`${pad(newEh)}:${pad(sm)}`);
                      }
                    }} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                      <Clock size={9} /> Fin
                    </label>
                    <TimeSelect value={endTime} onChange={setEndTime} />
                  </div>
                </div>
              )}

              {/* Color */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Palette size={9} /> Color
                </label>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button
                      key={c.value}
                      type="button"
                      title={c.label}
                      onClick={() => setColor(c.value)}
                      style={{
                        width:  20, height: 20, borderRadius: '50%',
                        background: c.value, border: 'none', cursor: 'pointer',
                        boxShadow:  color === c.value ? `0 0 0 2px ${R.bg2}, 0 0 0 4px ${c.value}` : 'none',
                        transition: 'box-shadow 0.15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Tipo */}
              <div>
                <label style={{ ...labelStyle, display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Users size={9} /> Tipo
                </label>
                <div style={{ display: 'flex', gap: 6 }}>
                  {(['personal', 'workspace', 'team'] as const).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setType(t)}
                      style={{
                        flex:         1,
                        padding:      '6px 0',
                        borderRadius: 5,
                        fontSize:     10,
                        cursor:       'pointer',
                        border:       `1px solid ${type === t ? color : R.line2}`,
                        background:   type === t ? `${color}18` : 'transparent',
                        color:        type === t ? color : R.text3,
                        display:      'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                        transition:   'all 0.15s',
                      }}
                    >
                      {t === 'personal'  && <User  size={9} />}
                      {t === 'workspace' && <Globe size={9} />}
                      {t === 'team'      && <Users size={9} />}
                      {t === 'personal' ? 'Personal' : t === 'workspace' ? 'Workspace' : 'Equipo'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selector workspace */}
              {type === 'workspace' && (
                <div>
                  <label style={labelStyle}>Workspace</label>
                  <select
                    value={workspaceId}
                    onChange={e => setWorkspaceId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Selecciona un workspace…</option>
                    {workspaces.map(ws => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Selector equipo */}
              {type === 'team' && (
                <div>
                  <label style={labelStyle}>Equipo</label>
                  <select
                    value={teamId}
                    onChange={e => setTeamId(e.target.value)}
                    style={{ ...inputStyle, cursor: 'pointer' }}
                  >
                    <option value="">Selecciona un equipo…</option>
                    {teams.map(team => (
                      <option key={team.id} value={team.id}>{team.name}</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Error */}
              {error && (
                <div style={{ fontSize: 10, color: '#f87171', padding: '6px 10px', background: 'rgba(248,113,113,.08)', borderRadius: 5, border: '1px solid rgba(248,113,113,.2)' }}>
                  {error}
                </div>
              )}

              {/* Acciones */}
              <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
                {isEdit && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    style={{
                      padding: '8px 14px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                      background: 'transparent', border: '1px solid rgba(248,113,113,.4)',
                      color: '#f87171', opacity: deleting ? 0.5 : 1,
                    }}
                  >
                    {deleting ? '…' : 'Eliminar'}
                  </button>
                )}
                <div style={{ flex: 1 }} />
                <button
                  type="button"
                  onClick={onClose}
                  style={{
                    padding: '8px 16px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                    background: 'transparent', border: `1px solid ${R.line2}`, color: R.text3,
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  style={{
                    padding:    '8px 20px', borderRadius: 5, fontSize: 11, cursor: 'pointer',
                    background: color, border: 'none', color: '#031322',
                    fontWeight: 600, opacity: saving ? 0.6 : 1,
                    fontFamily: "'JetBrains Mono', monospace",
                    transition: 'opacity 0.15s',
                  }}
                >
                  {saving ? '…' : isEdit ? 'Guardar' : 'Crear evento'}
                </button>
              </div>

            </form>
          </motion.div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
