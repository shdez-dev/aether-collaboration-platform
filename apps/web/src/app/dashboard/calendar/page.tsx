'use client';
/**
 * Calendario — Spine (Day View)
 * Diseño basado en: "Aether Calendario - Spine (standalone).html"
 */

import { useEffect, useState, useMemo, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { useCalendarEventStore, type CalendarEvent } from '@/stores/calendarEventStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTeamStore } from '@/stores/teamStore';
import CreateEventModal from '@/components/calendar/CreateEventModal';

/* ── Paleta exacta de la referencia ──────────────────────── */
const R = {
  bg:    '#0b1320', bg2:   '#0f1d2e', bg3:   '#142536',
  line:  '#1a2a3d', line2: '#233649',
  text:  '#cfe0f2', text2: '#8fa6bf', text3: '#5d7491', text4: '#3f5571',
  cyan:  '#5ec5ff', pink:  '#ff6b9d', violet:'#a78bfa',
  green: '#4ade80', amber: '#fbbf24',
} as const;

const BOARD_PALETTE = [R.cyan, R.pink, R.violet, R.amber, R.green, '#f87171', '#818cf8', '#34d399'];

/* ── Spine config ─────────────────────────────────────────── */
const HOUR_PX    = 64;   // px por hora
const START_HOUR = 8;
const END_HOUR   = 20;
const TOTAL_HRS  = END_HOUR - START_HOUR;

/* ── Types (cards) ───────────────────────────────────────── */
interface UserCard {
  id: string; title: string; dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent' | null;
  completed: boolean; listName: string; boardName: string;
  workspaceName: string; boardId: string; workspaceId: string;
}
interface UserCardsResponse { pending: UserCard[]; overdue: UserCard[]; completed: UserCard[]; }

/* ── API helpers ─────────────────────────────────────────── */
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

function getAuthToken(): string | null {
  try {
    const r = localStorage.getItem('aether-auth-storage');
    return r ? JSON.parse(r).state?.accessToken ?? null : null;
  } catch { return null; }
}

async function fetchUserCards(): Promise<UserCardsResponse> {
  const token = getAuthToken();
  const res = await fetch(`${API_URL}/api/users/me/cards`, {
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
  });
  if (!res.ok) throw new Error('Error al obtener cards');
  const j = await res.json();
  return j.data ?? j;
}

/* ── Utilidades de fecha ─────────────────────────────────── */
function toKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function fromKey(k: string) { return new Date(k + 'T00:00:00'); }
function pad(n: number)     { return String(n).padStart(2, '0'); }

function getWeekNum(d: Date) {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7);
}

const DAY_UPPER  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const MONTHS_ES  = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

/* ── Breakpoint ──────────────────────────────────────────── */
function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const fn = () => setM(window.innerWidth < 768);
    fn(); window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, []);
  return m;
}

/* ── navBtn ──────────────────────────────────────────────── */
const navBtn: React.CSSProperties = {
  height: 28, border: `1px solid ${R.line}`, borderRadius: 5,
  background: 'transparent', color: R.text2,
  display: 'grid', placeItems: 'center', cursor: 'pointer',
  fontFamily: "'JetBrains Mono', monospace", fontSize: 13,
};

/* ── Posicionamiento de evento en spine ─────────────────── */
function eventPosition(ev: CalendarEvent) {
  const start   = new Date(ev.startTime);
  const end     = new Date(ev.endTime);
  const startH  = start.getHours() + start.getMinutes() / 60;
  const endH    = end.getHours()   + end.getMinutes()   / 60;
  const clampS  = Math.max(startH, START_HOUR);
  const clampE  = Math.min(endH,   END_HOUR);
  return {
    top:    (clampS - START_HOUR) * HOUR_PX,
    height: Math.max((clampE - clampS) * HOUR_PX - 4, 24),
  };
}

/* ═══════════════════════════════════════════════════════════
   MINI CALENDAR
   ═══════════════════════════════════════════════════════════ */
interface MiniCalProps {
  year: number; month: number;
  miniGrid: any[]; miniDir: number;
  onPrev: () => void; onNext: () => void;
  onSelect: (cell: any) => void;
  eventDays: Set<string>;
  todayKey: string; selKey: string;
}
function MiniCalendar({ year, month, miniGrid, miniDir, onPrev, onNext, onSelect, todayKey, selKey }: MiniCalProps) {
  return (
    <div style={{ borderBottom: `1px solid ${R.line}` }}>
      <div style={{ padding: '12px 12px 0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <button onClick={onPrev} style={{ ...navBtn, width: 18, height: 18 }}>‹</button>
          <div style={{ overflow: 'hidden', flex: 1, textAlign: 'center' }}>
            <AnimatePresence mode="wait" custom={miniDir}>
              <motion.span
                key={`${year}-${month}`} custom={miniDir}
                initial={{ y: miniDir * 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: miniDir * -8, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                style={{ display: 'block', fontSize: 11, color: R.text }}
              >
                {MONTHS_ES[month]} {year}
              </motion.span>
            </AnimatePresence>
          </div>
          <button onClick={onNext} style={{ ...navBtn, width: 18, height: 18 }}>›</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2, marginBottom: 3 }}>
          {['D','L','M','M','J','V','S'].map((d, i) => (
            <div key={i} style={{ textAlign: 'center', fontSize: 9, color: R.text4, letterSpacing: '.14em', padding: '3px 0' }}>{d}</div>
          ))}
        </div>

        <div style={{ overflow: 'hidden', paddingBottom: 10 }}>
          <AnimatePresence mode="wait" custom={miniDir}>
            <motion.div
              key={`${year}-${month}`} custom={miniDir}
              initial={{ x: miniDir * 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: miniDir * -20, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}
            >
              {miniGrid.map((cell, i) => {
                const k = cell.out ? '' : `${year}-${pad(month+1)}-${pad(cell.n)}`;
                const isSel   = k === selKey;
                const isToday = k === todayKey;
                return (
                  <div
                    key={i}
                    onClick={() => onSelect(cell)}
                    className={!cell.out && !isSel ? 'mini-day-hoverable' : ''}
                    style={{
                      height: 30, display: 'grid', placeItems: 'center', fontSize: 10, borderRadius: 4,
                      cursor:     cell.out ? 'default' : 'pointer', position: 'relative',
                      color:      cell.out ? R.text4 : isSel ? '#031322' : R.text2,
                      background: isSel ? R.cyan : cell.hasEvent ? 'rgba(94,197,255,.07)' : 'transparent',
                      fontWeight: isSel ? 600 : 400,
                      border:     isToday && !isSel ? `1px solid ${R.cyan}` : '1px solid transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {cell.n}
                    {cell.hasEvent && !isSel && (
                      <span style={{ position: 'absolute', bottom: 2, left: '50%', transform: 'translateX(-50%)', width: 3, height: 3, borderRadius: '50%', background: R.cyan }} />
                    )}
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   PÁGINA PRINCIPAL
   ═══════════════════════════════════════════════════════════ */
export default function CalendarPage() {
  const router   = useRouter();
  const isMobile = useIsMobile();

  const today    = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);
  const todayKey = useMemo(() => toKey(today), [today]);

  /* ── Stores ───────────────────────────────────────────── */
  const { events, loading: evLoading, fetchEvents, } = useCalendarEventStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const { teams, fetchTeams }           = useTeamStore();

  /* ── Estado ───────────────────────────────────────────── */
  const [cards,      setCards]      = useState<UserCard[]>([]);
  const [selKey,     setSelKey]     = useState(todayKey);
  const [miniYear,   setMiniYear]   = useState(today.getFullYear());
  const [miniMonth,  setMiniMonth]  = useState(today.getMonth());
  const [miniDir,    setMiniDir]    = useState(0);
  const [panelOpen,  setPanelOpen]  = useState(false);
  const [modalOpen,  setModalOpen]  = useState(false);
  const [editEvent,  setEditEvent]  = useState<CalendarEvent | null>(null);
  const [clickHour,  setClickHour]  = useState<number>(9);

  const spineRef = useRef<HTMLDivElement>(null);

  /* ── Cargar datos ─────────────────────────────────────── */
  useEffect(() => {
    fetchUserCards().then(d => setCards([...d.pending, ...d.overdue, ...d.completed])).catch(() => {});
    fetchWorkspaces();
    fetchTeams();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch eventos para el mes visible + buffer
  useEffect(() => {
    const from = new Date(miniYear, miniMonth - 1, 1).toISOString();
    const to   = new Date(miniYear, miniMonth + 2, 0, 23, 59, 59).toISOString();
    fetchEvents(from, to);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [miniYear, miniMonth]);

  /* ── Derivados ────────────────────────────────────────── */
  const boardIds = useMemo(() => {
    const seen = new Set<string>(); const out: string[] = [];
    for (const c of cards) if (!seen.has(c.boardId)) { seen.add(c.boardId); out.push(c.boardId); }
    return out;
  }, [cards]);

  function boardColor(boardId: string) {
    return BOARD_PALETTE[boardIds.indexOf(boardId) % BOARD_PALETTE.length] ?? R.cyan;
  }

  const byDay = useMemo(() => {
    const m: Record<string, UserCard[]> = {};
    for (const c of cards) { if (!c.dueDate) continue; const k = c.dueDate.slice(0,10); (m[k]||=[]).push(c); }
    return m;
  }, [cards]);

  // Eventos del día seleccionado
  const dayEvents = useMemo(() =>
    events
      .filter(e => e.startTime.slice(0,10) === selKey || e.endTime.slice(0,10) === selKey)
      .sort((a, b) => a.startTime.localeCompare(b.startTime)),
  [events, selKey]);

  // Cards del día
  const dayCards = byDay[selKey] ?? [];

  // Días con eventos para el mini-calendario
  const eventDays = useMemo(() => {
    const s = new Set<string>();
    events.forEach(e => s.add(e.startTime.slice(0,10)));
    Object.keys(byDay).forEach(k => s.add(k));
    return s;
  }, [events, byDay]);

  // Upcoming (próximos 7 días)
  const upcoming = useMemo(() => {
    const in7 = new Date(today); in7.setDate(in7.getDate()+7);
    return events
      .filter(e => { const d = new Date(e.startTime); return d >= today && d <= in7; })
      .sort((a,b) => a.startTime.localeCompare(b.startTime))
      .slice(0, 6);
  }, [events, today]);

  // Boards únicos
  const boardsLegend = useMemo(() => {
    const m = new Map<string,string>();
    cards.forEach(c => m.set(c.boardId, c.boardName));
    return [...m.entries()];
  }, [cards]);

  const noDate = useMemo(() => cards.filter(c => !c.dueDate && !c.completed), [cards]);

  const selDate  = fromKey(selKey);
  const weekNum  = getWeekNum(selDate);
  const pendingEvCount = dayEvents.filter(e => !e.allDay).length;

  /* ── Hora actual para línea NOW ───────────────────────── */
  const [nowMinutes, setNowMinutes] = useState(() => {
    const d = new Date(); return d.getHours() * 60 + d.getMinutes();
  });
  useEffect(() => {
    const id = setInterval(() => {
      const d = new Date(); setNowMinutes(d.getHours() * 60 + d.getMinutes());
    }, 60_000);
    return () => clearInterval(id);
  }, []);
  const nowTop    = (nowMinutes / 60 - START_HOUR) * HOUR_PX;
  const showNow   = selKey === todayKey && nowMinutes/60 >= START_HOUR && nowMinutes/60 <= END_HOUR;
  const nowLabel  = `${pad(Math.floor(nowMinutes/60))}:${pad(nowMinutes%60)}`;

  /* ── Mini-calendar grid ───────────────────────────────── */
  const miniGrid = useMemo(() => {
    const first   = new Date(miniYear, miniMonth, 1).getDay();
    const dim     = new Date(miniYear, miniMonth+1, 0).getDate();
    const prevDim = new Date(miniYear, miniMonth, 0).getDate();
    type Cell = { n:number; out:boolean; hasEvent:boolean };
    const cells: Cell[] = [];
    for (let i=0; i<first; i++) cells.push({ n: prevDim-first+1+i, out:true,  hasEvent:false });
    for (let d=1; d<=dim;  d++) {
      const k = `${miniYear}-${pad(miniMonth+1)}-${pad(d)}`;
      cells.push({ n: d, out:false, hasEvent: eventDays.has(k) });
    }
    let n=1; while (cells.length<42) cells.push({ n:n++, out:true, hasEvent:false });
    return cells;
  }, [miniYear, miniMonth, eventDays]);

  /* ── Navegación ───────────────────────────────────────── */
  function selectDay(k: string) {
    const d = fromKey(k); setSelKey(k); setMiniYear(d.getFullYear()); setMiniMonth(d.getMonth());
  }
  function prevDay() { const d=fromKey(selKey); d.setDate(d.getDate()-1); selectDay(toKey(d)); }
  function nextDay() { const d=fromKey(selKey); d.setDate(d.getDate()+1); selectDay(toKey(d)); }
  function goToday() { selectDay(todayKey); }

  function miniPrev() {
    setMiniDir(-1);
    if (miniMonth===0) { setMiniMonth(11); setMiniYear(y=>y-1); } else setMiniMonth(m=>m-1);
  }
  function miniNext() {
    setMiniDir(1);
    if (miniMonth===11) { setMiniMonth(0); setMiniYear(y=>y+1); } else setMiniMonth(m=>m+1);
  }
  function selectMiniCell(cell: { n:number; out:boolean }) {
    if (cell.out) return;
    selectDay(`${miniYear}-${pad(miniMonth+1)}-${pad(cell.n)}`);
    setPanelOpen(false);
  }

  /* ── Click en spine → crear evento ───────────────────── */
  function handleSpineClick(e: React.MouseEvent<HTMLDivElement>) {
    // Solo si el click no fue sobre un evento existente
    const target = e.target as HTMLElement;
    if (target.closest('[data-event]')) return;
    const rect = spineRef.current?.getBoundingClientRect();
    if (!rect) return;
    const relY = e.clientY - rect.top;
    const hour = Math.floor(relY / HOUR_PX) + START_HOUR;
    setClickHour(Math.max(START_HOUR, Math.min(hour, END_HOUR - 1)));
    setEditEvent(null);
    setModalOpen(true);
  }

  /* ── Sidebar ──────────────────────────────────────────── */
  const Sidebar = (
    <div style={{ width: 300, flexShrink:0, borderLeft:`1px solid ${R.line}`, background:R.bg2, display:'flex', flexDirection:'column', overflowY:'auto' }}>

      <MiniCalendar
        year={miniYear} month={miniMonth} miniGrid={miniGrid} miniDir={miniDir}
        onPrev={miniPrev} onNext={miniNext} onSelect={selectMiniCell}
        eventDays={eventDays} todayKey={todayKey} selKey={selKey}
      />

      {/* Próximos 7 días */}
      {upcoming.length > 0 && (
        <div style={{ borderBottom:`1px solid ${R.line}` }}>
          <div style={{ padding:'10px 12px 6px', fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:R.text4 }}>
            PRÓXIMOS · 7 DÍAS
          </div>
          {upcoming.map(ev => {
            const d = new Date(ev.startTime);
            return (
              <div
                key={ev.id}
                onClick={() => { selectDay(ev.startTime.slice(0,10)); setEditEvent(ev); setModalOpen(true); setPanelOpen(false); }}
                style={{ display:'grid', gridTemplateColumns:'38px 1fr auto', gap:10, padding:'5px 12px', fontSize:11, alignItems:'center', cursor:'pointer' }}
                className="mini-day-hoverable"
              >
                <div style={{ color:R.text3, fontSize:10, lineHeight:1.2 }}>
                  <div style={{ color:R.text, fontSize:14, fontWeight:500 }}>{d.getDate()}</div>
                  {DAY_UPPER[d.getDay()]}
                </div>
                <div style={{ color:R.text2, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.title}</div>
                <span style={{ width:6, height:6, borderRadius:2, background:ev.color, flexShrink:0 }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Tableros */}
      {boardsLegend.length > 0 && (
        <div style={{ padding:'10px 12px 12px', borderBottom:`1px solid ${R.line}` }}>
          <div style={{ fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:R.text4, marginBottom:8 }}>TABLEROS</div>
          {boardsLegend.map(([id, name]) => (
            <div key={id} style={{ display:'flex', alignItems:'center', gap:8, fontSize:11, color:R.text2, padding:'3px 0' }}>
              <span style={{ width:10, height:10, borderRadius:2, background:boardColor(id), flexShrink:0 }} />
              <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{name}</span>
            </div>
          ))}
        </div>
      )}

      {/* Sin fecha */}
      {noDate.length > 0 && (
        <div style={{ padding:'10px 12px' }}>
          <div style={{ fontSize:9, letterSpacing:'.18em', textTransform:'uppercase', color:R.text4, marginBottom:6 }}>
            SIN FECHA · {noDate.length}
          </div>
          {noDate.slice(0,5).map(c => (
            <div
              key={c.id}
              onClick={() => router.push(`/dashboard/workspaces/${c.workspaceId}/boards/${c.boardId}`)}
              style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:R.text3, padding:'3px 0', cursor:'pointer' }}
            >
              <span style={{ width:4, height:4, borderRadius:'50%', background:boardColor(c.boardId), flexShrink:0 }} />
              <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{c.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  /* ── Render ───────────────────────────────────────────── */
  return (
    <div style={{ width:'100%', height:'100%', minHeight:'100%', display:'flex', background:R.bg, fontFamily:"'JetBrains Mono', monospace", color:R.text, fontSize:12, overflow:'hidden' }}>

      {/* ── Panel principal: spine ───────────────────────── */}
      <div style={{ flex:1, padding:'22px 28px 22px', display:'flex', flexDirection:'column', minHeight:0, overflow:'hidden', minWidth:0 }}>

        {/* Eyebrow */}
        <div style={{ fontSize:10, letterSpacing:'.16em', color:R.cyan, display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
          <span>—</span> CALENDARIO · DÍA
        </div>

        {/* Cabecera del día */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', marginBottom:20, gap:16, flexWrap:'wrap', flexShrink:0 }}>
          <div style={{ display:'flex', alignItems:'baseline', gap:14 }}>
            <div style={{ fontFamily:"'Inter', 'JetBrains Mono', monospace", fontSize: isMobile ? 40 : 56, lineHeight:1, fontWeight:300, color:R.text, letterSpacing:'-.02em' }}>
              {selDate.getDate()}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
              <div style={{ color:R.cyan, fontSize:12, letterSpacing:'.14em' }}>{DAY_UPPER[selDate.getDay()]}</div>
              <div style={{ color:R.text3, fontSize:10, letterSpacing:'.14em' }}>
                {MONTHS_ES[selDate.getMonth()].toUpperCase()} · {selDate.getFullYear()} · W{weekNum}
              </div>
              <div style={{ color:R.text3, fontSize:11, marginTop:4 }}>
                {evLoading
                  ? 'cargando…'
                  : `${pendingEvCount} evento${pendingEvCount !== 1 ? 's' : ''} · ${dayCards.length} card${dayCards.length !== 1 ? 's' : ''}`
                }
              </div>
            </div>
          </div>

          {/* Nav + nuevo evento */}
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <button onClick={prevDay} style={{ ...navBtn, width:28, padding:'0 8px' }}>‹</button>
            <button onClick={goToday} style={{ ...navBtn, width:'auto', padding:'0 12px' }}>HOY</button>
            <button onClick={nextDay} style={{ ...navBtn, width:28, padding:'0 8px' }}>›</button>
            <motion.button
              onClick={() => { setEditEvent(null); setClickHour(9); setModalOpen(true); }}
              whileHover={{ backgroundColor: `${R.cyan}22`, borderColor: R.cyan }}
              whileTap={{ scale: 0.95 }}
              style={{ ...navBtn, width:'auto', padding:'0 12px', display:'flex', alignItems:'center', gap:5, color: R.cyan, borderColor:`${R.cyan}55`, marginLeft:4 }}
            >
              <Plus size={12} /> Nuevo
            </motion.button>
            {isMobile && (
              <button onClick={() => setPanelOpen(true)} style={{ ...navBtn, width:28, padding:'0 8px', marginLeft:4 }}>≡</button>
            )}
          </div>
        </div>

        {/* ── Spine de horas ─────────────────────────────── */}
        <div style={{ flex:1, minHeight:0, overflow:'hidden', display:'flex', flexDirection:'column' }}>
          <div
            ref={spineRef}
            onClick={handleSpineClick}
            style={{ flex:1, overflowY:'auto', overflowX:'hidden', position:'relative', cursor:'crosshair' }}
          >
            {/* Grid de horas */}
            <div style={{ display:'grid', gridTemplateColumns:'50px 1px 1fr', minHeight: TOTAL_HRS * HOUR_PX }}>

              {/* Columna de horas */}
              <div>
                {Array.from({ length: TOTAL_HRS }, (_, i) => (
                  <div key={i} style={{ height:HOUR_PX, color:R.text4, fontSize:10, paddingTop:0, textAlign:'right', paddingRight:12, lineHeight:`${HOUR_PX}px` }}>
                    {pad(START_HOUR + i)}:00
                  </div>
                ))}
              </div>

              {/* Rail central con burbuja NOW */}
              <div style={{ position:'relative', background:`linear-gradient(180deg, ${R.line} 0%, ${R.line} 30%, ${R.line2} 30%, ${R.line2} 60%, ${R.line} 60%)` }}>
                {showNow && (
                  <div style={{ position:'absolute', left:-4, top: nowTop - 4, width:9, height:9, borderRadius:'50%', background:R.cyan, boxShadow:`0 0 0 4px rgba(94,197,255,.18), 0 0 12px rgba(94,197,255,.5)` }} />
                )}
              </div>

              {/* Columna de eventos */}
              <div style={{ position:'relative', paddingLeft:20 }}>

                {/* Líneas de hora */}
                {Array.from({ length: TOTAL_HRS + 1 }, (_, i) => (
                  <div key={i} style={{ position:'absolute', left:0, right:0, height:1, background:R.line, opacity:.5, top: i * HOUR_PX }} />
                ))}

                {/* Línea NOW */}
                {showNow && (
                  <>
                    <div style={{ position:'absolute', left:-1, right:0, height:1, background:R.cyan, opacity:.7, top: nowTop }} />
                    <div style={{ position:'absolute', right:8, top: nowTop, transform:'translateY(-50%)', background:R.cyan, color:'#031322', fontSize:9, fontWeight:600, letterSpacing:'.1em', padding:'2px 6px', borderRadius:3 }}>
                      AHORA · {nowLabel}
                    </div>
                  </>
                )}

                {/* Eventos del calendario */}
                <AnimatePresence>
                  {dayEvents.filter(e => !e.allDay).map((ev) => {
                    const { top, height } = eventPosition(ev);
                    const start = new Date(ev.startTime);
                    const end   = new Date(ev.endTime);
                    const timeStr = `${pad(start.getHours())}:${pad(start.getMinutes())} – ${pad(end.getHours())}:${pad(end.getMinutes())}`;

                    return (
                      <motion.div
                        key={ev.id}
                        data-event="true"
                        initial={{ opacity:0, x:-6 }}
                        animate={{ opacity:1, x:0 }}
                        exit={{ opacity:0, x:-6 }}
                        transition={{ duration:0.18 }}
                        whileHover={{ filter:'brightness(1.1)' }}
                        onClick={(e) => { e.stopPropagation(); setEditEvent(ev); setModalOpen(true); }}
                        style={{
                          position:'absolute', left:12, right:16, top, height,
                          background: `linear-gradient(135deg, ${ev.color}1f, ${ev.color}0a)`,
                          border: `1px solid ${ev.color}44`,
                          borderLeft: `2px solid ${ev.color}`,
                          borderRadius:5, padding:'8px 12px', color:R.text,
                          display:'flex', flexDirection:'column', gap:4,
                          cursor:'pointer', overflow:'hidden',
                        }}
                      >
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
                          <div style={{ fontWeight:500, fontSize:12, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                            {ev.title}
                          </div>
                          <div style={{ fontSize:10, color:R.text3, flexShrink:0 }}>{timeStr}</div>
                        </div>

                        {height > 40 && (
                          <div style={{ fontSize:10, color:R.text3, display:'flex', alignItems:'center', gap:8 }}>
                            {/* Avatares de asistentes */}
                            {ev.attendees.length > 0 && (
                              <div style={{ display:'flex' }}>
                                {ev.attendees.slice(0,4).map((att, j) => (
                                  <div
                                    key={att.id}
                                    title={att.name}
                                    style={{
                                      width:16, height:16, borderRadius:'50%',
                                      border:`1px solid ${R.bg}`,
                                      marginLeft: j===0 ? 0 : -5,
                                      background: att.avatar ? `url(${API_URL}${att.avatar}) center/cover` : `linear-gradient(135deg, ${ev.color}, ${ev.color}88)`,
                                      color:'#fff', fontSize:8, fontWeight:600,
                                      display:'grid', placeItems:'center', flexShrink:0,
                                    }}
                                  >
                                    {!att.avatar && att.name.charAt(0).toUpperCase()}
                                  </div>
                                ))}
                                {ev.attendees.length > 4 && (
                                  <div style={{ width:16, height:16, borderRadius:'50%', border:`1px solid ${R.bg}`, marginLeft:-5, background:R.line2, color:R.text3, fontSize:8, display:'grid', placeItems:'center' }}>
                                    +{ev.attendees.length - 4}
                                  </div>
                                )}
                              </div>
                            )}
                            {ev.description && (
                              <span style={{ overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>{ev.description}</span>
                            )}
                          </div>
                        )}
                      </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Eventos todo el día */}
          {dayEvents.filter(e => e.allDay).length > 0 && (
            <div style={{ flexShrink:0, borderTop:`1px solid ${R.line}`, padding:'8px 0 4px' }}>
              <div style={{ fontSize:9, letterSpacing:'.14em', color:R.text4, marginBottom:6, paddingLeft:70 }}>TODO EL DÍA</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, paddingLeft:70 }}>
                {dayEvents.filter(e => e.allDay).map(ev => (
                  <div
                    key={ev.id}
                    data-event="true"
                    onClick={(e) => { e.stopPropagation(); setEditEvent(ev); setModalOpen(true); }}
                    style={{
                      padding:'4px 10px', borderRadius:4, fontSize:11, cursor:'pointer',
                      background:`${ev.color}18`, borderLeft:`2px solid ${ev.color}`,
                      color:R.text2, marginRight:16,
                    }}
                  >
                    {ev.title}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cards del día */}
          {dayCards.length > 0 && (
            <div style={{ flexShrink:0, borderTop:`1px solid ${R.line}`, padding:'8px 0 6px' }}>
              <div style={{ fontSize:9, letterSpacing:'.14em', color:R.text4, marginBottom:6, paddingLeft:70 }}>CARDS · {selDate.getDate()}/{selDate.getMonth()+1}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:3, paddingLeft:70, maxHeight:120, overflowY:'auto' }}>
                {dayCards.map(c => {
                  const color = boardColor(c.boardId);
                  return (
                    <div
                      key={c.id}
                      onClick={() => router.push(`/dashboard/workspaces/${c.workspaceId}/boards/${c.boardId}`)}
                      style={{
                        padding:'4px 10px', borderRadius:4, fontSize:10, cursor:'pointer',
                        background:`${color}0d`, borderLeft:`2px solid ${color}`,
                        color: c.completed ? R.text4 : R.text2,
                        textDecoration: c.completed ? 'line-through' : 'none',
                        marginRight:16, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                      }}
                    >
                      {c.title}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Sidebar desktop ──────────────────────────────── */}
      {!isMobile && Sidebar}

      {/* ── Sidebar mobile overlay ───────────────────────── */}
      <AnimatePresence>
        {isMobile && panelOpen && (
          <>
            <motion.div
              initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
              transition={{ duration:0.15 }}
              onClick={() => setPanelOpen(false)}
              style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:30 }}
            />
            <motion.div
              initial={{ x:'100%' }} animate={{ x:0 }} exit={{ x:'100%' }}
              transition={{ type:'spring', damping:30, stiffness:340 }}
              style={{ position:'fixed', right:0, top:0, bottom:0, zIndex:40, display:'flex', overflowY:'auto' }}
            >
              <div style={{ position:'absolute', top:10, left:12, zIndex:1 }}>
                <button onClick={() => setPanelOpen(false)} style={{ background:'transparent', border:'none', cursor:'pointer', color:R.text3 }}>
                  <X size={14} />
                </button>
              </div>
              {Sidebar}
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Modal crear/editar evento ────────────────────── */}
      <CreateEventModal
        open={modalOpen}
        onClose={() => { setModalOpen(false); setEditEvent(null); }}
        initialDate={selKey}
        initialHour={clickHour}
        eventToEdit={editEvent}
      />
    </div>
  );
}
