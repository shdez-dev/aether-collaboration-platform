// apps/web/src/components/CardDetailModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useBoardStore } from '@/stores/boardStore';
import { useProjectStore } from '@/stores/projectStore';
import { useTimelineStore } from '@/stores/timelineStore';
import { useTypingIndicator, useTypingListeners } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from './realtime/TypingIndicator';
import { MemberPicker } from './MemberPicker';
import { LabelPicker } from './LabelPicker';
import { CommentList } from './comments/CommentList';
import { X, Calendar, Zap, ChevronLeft, ChevronRight, Trash2, Flag } from 'lucide-react';
import { es } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';
import { CardChecklist } from './CardChecklist';
import { CardDependencies } from './CardDependencies';
import type { Sprint } from '@aether/types';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Custom Calendar ───────────────────────────────────────────────────────────
function CustomCalendar({ value, onChange, onClose }: {
  value: string; onChange: (date: string) => void; onClose: () => void;
}) {
  const t = es;

  const parseLocalDate = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };
  const toNoonUTC = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00.000Z`;

  const [currentDate, setCurrentDate] = useState(() => value ? parseLocalDate(value) : new Date());
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const selectedDate = value ? parseLocalDate(value) : null;

  const calendarDays: { day: number; isCurrentMonth: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--)
    calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  for (let day = 1; day <= daysInMonth; day++)
    calendarDays.push({ day, isCurrentMonth: true });
  for (let day = 1; day <= 42 - calendarDays.length; day++)
    calendarDays.push({ day, isCurrentMonth: false });

  const isToday = (day: number) => {
    const n = new Date();
    return n.getDate() === day && n.getMonth() === month && n.getFullYear() === year;
  };
  const isSelected = (day: number) =>
    !!selectedDate && selectedDate.getDate() === day && selectedDate.getMonth() === month && selectedDate.getFullYear() === year;

  return (
    <div style={{
      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
      background: C.surface, border: `1px solid ${C.border2}`,
      borderRadius: '10px', boxShadow: '0 16px 40px rgba(0,0,0,0.55)',
      zIndex: 100, padding: '14px', width: '252px',
    }}>
      {/* Nav */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>
          {t.months_long[month]} {year}
        </span>
        <div style={{ display: 'flex', gap: '2px' }}>
          {[
            { icon: <ChevronLeft style={{ width: '14px', height: '14px' }} />, fn: () => setCurrentDate(new Date(year, month - 1, 1)) },
            { icon: <ChevronRight style={{ width: '14px', height: '14px' }} />, fn: () => setCurrentDate(new Date(year, month + 1, 1)) },
          ].map(({ icon, fn }, i) => (
            <button key={i} onClick={fn} type="button" style={{ padding: '4px 5px', borderRadius: '5px', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, display: 'flex' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
            >{icon}</button>
          ))}
        </div>
      </div>

      {/* Day names */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', marginBottom: '4px' }}>
        {t.days_short.map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 600, color: C.text4, padding: '2px 0' }}>{d}</div>
        ))}
      </div>

      {/* Days */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px' }}>
        {calendarDays.map((item, idx) => {
          const sel = item.isCurrentMonth && isSelected(item.day);
          const tod = item.isCurrentMonth && isToday(item.day);
          return (
            <button
              key={idx} type="button"
              onClick={() => item.isCurrentMonth && (onChange(toNoonUTC(year, month, item.day)), onClose())}
              disabled={!item.isCurrentMonth}
              style={{
                aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', borderRadius: '5px', cursor: item.isCurrentMonth ? 'pointer' : 'default',
                background: sel ? C.accent : tod ? `${C.accent}20` : 'transparent',
                color: sel ? '#fff' : tod ? C.accent : item.isCurrentMonth ? C.text2 : C.text4,
                border: tod && !sel ? `1px solid ${C.accent}44` : '1px solid transparent',
                fontWeight: sel || tod ? 600 : 400,
                opacity: item.isCurrentMonth ? 1 : 0.25,
              }}
              onMouseEnter={(e) => { if (item.isCurrentMonth && !sel) (e.currentTarget as HTMLElement).style.background = C.hover; }}
              onMouseLeave={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = tod ? `${C.accent}20` : 'transparent'; }}
            >
              {item.day}
            </button>
          );
        })}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', gap: '6px', marginTop: '12px', paddingTop: '10px', borderTop: `1px solid ${C.border}` }}>
        <button onClick={() => { onChange(''); onClose(); }} type="button"
          style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11.5px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer' }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.text4)}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border2)}
        >{t.card_due_date_clear}</button>
        <button onClick={() => { const n = new Date(); onChange(toNoonUTC(n.getFullYear(), n.getMonth(), n.getDate())); onClose(); }} type="button"
          style={{ flex: 1, padding: '6px', borderRadius: '6px', fontSize: '11.5px', background: C.accent, border: 'none', color: '#fff', cursor: 'pointer', fontWeight: 600 }}
        >{t.card_due_date_today}</button>
      </div>
    </div>
  );
}

// ── Section label ─────────────────────────────────────────────────────────────
function SectionLabel({ icon, label }: { icon?: React.ReactNode; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
      {icon && <span style={{ color: C.text4, display: 'flex' }}>{icon}</span>}
      <span style={{ fontSize: '10.5px', fontWeight: 600, color: C.text4, letterSpacing: '0.07em', textTransform: 'uppercase' }}>{label}</span>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────
export function CardDetailModal() {
  const t = es;
  const { selectedCard, setSelectedCard, updateCard, removeCard, currentWorkspaceId } = useCardStore();
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { currentBoard } = useBoardStore();
  const invalidateTimeline = useTimelineStore((s) => s.invalidate);
  const projectMilestones = useProjectStore((s) => s.currentProject?.milestones ?? []);
  const userRole = currentWorkspace?.userRole;
  // Allow editing unless the user is an explicit VIEWER; undefined role (no board/workspace
  // context, e.g. opened from Gantt) is treated as editable.
  const canEdit  = userRole !== 'VIEWER';

  const SORA    = "'Sora', system-ui, sans-serif";
  const MANROPE = "'Manrope', system-ui, sans-serif";

  const priorityOptions = [
    { value: null,     label: t.card_priority_none,   color: '#615846',  bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)', symbol: '' },
    { value: 'LOW',    label: t.card_priority_low,    color: C.accent,   bg: `${C.accent}15`,          border: `${C.accent}40`,          symbol: '▼' },
    { value: 'MEDIUM', label: t.card_priority_medium, color: C.amber,    bg: `${C.amber}15`,           border: `${C.amber}40`,           symbol: '■' },
    { value: 'HIGH',   label: t.card_priority_high,   color: C.red,      bg: `${C.red}15`,             border: `${C.red}40`,             symbol: '▲' },
  ];

  // ── state ──────────────────────────────────────────────────────────────────
  const [editedTitle,       setEditedTitle]       = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedPriority,    setEditedPriority]    = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);
  const [editedStartDate,   setEditedStartDate]   = useState('');
  const [editedDueDate,     setEditedDueDate]     = useState('');
  const [bufferDays,        setBufferDays]        = useState<number | null>(null);
  const [bufferSaving,      setBufferSaving]      = useState(false);
  const [editingTitle,      setEditingTitle]      = useState(false);
  const [editingDesc,       setEditingDesc]       = useState(false);
  const [savingTitle,       setSavingTitle]       = useState(false);
  const [savingDesc,        setSavingDesc]        = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showCalendar,      setShowCalendar]      = useState(false);
  const [,                  setCommentCount]      = useState(0);
  const [isVisible,         setIsVisible]         = useState(false);
  const [isDescFocused,     setIsDescFocused]     = useState(false);
  const [,                  setChecklistProgress] = useState<{ done: number; total: number }>({ done: 0, total: 0 });

  const [boardSprints,      setBoardSprints]      = useState<Sprint[]>([]);
  const [cardSprintId,      setCardSprintId]      = useState<string | null>(null);
  const [sprintUpdating,    setSprintUpdating]    = useState(false);
  // boardId captured from the card stub (may come from Gantt where currentBoard is null)
  const [boardIdContext,    setBoardIdContext]     = useState<string | null>(null);
  const [cardMilestoneId,   setCardMilestoneId]   = useState<string | null>(null);
  const [milestoneUpdating, setMilestoneUpdating] = useState(false);

  const handleCommentCountChange      = useCallback((n: number) => setCommentCount(n), []);
  const handleChecklistProgressChange = useCallback((done: number, total: number) => setChecklistProgress({ done, total }), []);

  useTypingIndicator({ cardId: selectedCard?.id || '', isTyping: isDescFocused, debounceMs: 500, disabled: !selectedCard });
  const typingUsers = useTypingListeners(selectedCard?.id || '');

  const startCalendarRef = useRef<HTMLDivElement>(null);
  const calendarRef      = useRef<HTMLDivElement>(null);

  // ── effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (selectedCard) {
      setEditedTitle(selectedCard.title);
      setEditedDescription(selectedCard.description || '');
      setEditedPriority(selectedCard.priority || null);
      setEditedStartDate(selectedCard.startDate || '');
      setEditedDueDate(selectedCard.dueDate || '');
      setBufferDays((selectedCard as any).bufferDays ?? null);
      // Capture boardId from stub (passed from Gantt) before the full fetch overwrites it
      const stubBoardId = (selectedCard as any)._boardId as string | undefined;
      if (stubBoardId) setBoardIdContext(stubBoardId);
      setEditingTitle(false); setEditingDesc(false);
      setTimeout(() => setIsVisible(true), 10);
      document.body.classList.add('card-detail-drawer-open');
      apiService.get<{ card: any }>(`/api/cards/${selectedCard.id}`, true)
        .then((r) => { if (r.success && r.data) { setSelectedCard(r.data.card); updateCard(selectedCard.id, r.data.card); } })
        .catch(() => {});
    } else {
      setIsVisible(false);
      document.body.classList.remove('card-detail-drawer-open');
    }
    return () => { document.body.classList.remove('card-detail-drawer-open'); };
  }, [selectedCard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (startCalendarRef.current && !startCalendarRef.current.contains(e.target as Node)) setShowStartCalendar(false);
      if (calendarRef.current      && !calendarRef.current.contains(e.target as Node))      setShowCalendar(false);
    };
    if (showStartCalendar || showCalendar) { document.addEventListener('mousedown', h); return () => document.removeEventListener('mousedown', h); }
  }, [showStartCalendar, showCalendar]);

  useEffect(() => {
    if (!selectedCard) return;
    const boardId = currentBoard?.id ?? boardIdContext;
    if (!boardId) return;
    apiService.get<{ sprints: Sprint[] }>(`/api/boards/${boardId}/sprints`, true)
      .then((r) => {
        if (!r.success || !r.data) return;
        setBoardSprints(r.data.sprints);
        const found = r.data.sprints.find((s) => s.status !== 'COMPLETED' && (s.cards ?? []).some((c: any) => c.id === selectedCard.id));
        setCardSprintId(found?.id ?? null);
      }).catch(() => {});
    setCardMilestoneId(selectedCard.milestoneId ?? null);
  }, [selectedCard?.id, currentBoard?.id, boardIdContext]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose(); };
    if (selectedCard) { document.addEventListener('keydown', h); return () => document.removeEventListener('keydown', h); }
  }, [selectedCard?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── guard ──────────────────────────────────────────────────────────────────
  if (!selectedCard) return null;

  // ── handlers ───────────────────────────────────────────────────────────────
  const handleClose = () => {
    setIsVisible(false);
    setEditingTitle(false); setEditingDesc(false);
    setTimeout(() => { setSelectedCard(null); setShowDeleteConfirm(false); setShowStartCalendar(false); setShowCalendar(false); setIsDescFocused(false); }, 280);
  };

  const saveTitle = async () => {
    const v = editedTitle.trim();
    if (!v || v === selectedCard.title) { setEditedTitle(selectedCard.title); setEditingTitle(false); return; }
    setSavingTitle(true);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { title: v }, true);
      if (r.success && r.data) { updateCard(selectedCard.id, r.data.card); setSelectedCard(r.data.card); invalidateTimeline(); }
    } catch {} finally { setSavingTitle(false); setEditingTitle(false); }
  };

  const saveDesc = async () => {
    setIsDescFocused(false);
    const next = editedDescription.trim() || null;
    const curr = selectedCard.description || null;
    if (next === curr) { setEditingDesc(false); return; }
    setSavingDesc(true);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { description: next }, true);
      if (r.success && r.data) { updateCard(selectedCard.id, r.data.card); setSelectedCard(r.data.card); }
    } catch {} finally { setSavingDesc(false); setEditingDesc(false); }
  };

  const savePriority = async (priority: 'LOW' | 'MEDIUM' | 'HIGH' | null) => {
    if (!canEdit || priority === editedPriority) return;
    const prev = editedPriority;
    setEditedPriority(priority);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { priority }, true);
      if (r.success && r.data) { updateCard(selectedCard.id, r.data.card); setSelectedCard(r.data.card); invalidateTimeline(); }
    } catch { setEditedPriority(prev); }
  };

  const handleDateChange = async (field: 'startDate' | 'dueDate', value: string) => {
    if (!selectedCard) return;
    if (field === 'startDate') setEditedStartDate(value); else setEditedDueDate(value);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { [field]: value || null }, true);
      if (r.success && r.data) { updateCard(selectedCard.id, r.data.card); setSelectedCard(r.data.card); invalidateTimeline(); }
    } catch {}
  };

  const handleBufferChange = async (days: number | null) => {
    if (!selectedCard || bufferSaving) return;
    const prev = bufferDays;
    setBufferDays(days);            // optimistic
    setBufferSaving(true);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { bufferDays: days }, true);
      if (r.success && r.data) {
        updateCard(selectedCard.id, r.data.card);
        setSelectedCard(r.data.card);
        invalidateTimeline();
      } else {
        setBufferDays(prev);        // revert on failure
      }
    } catch { setBufferDays(prev); } finally { setBufferSaving(false); }
  };

  const handleSprintChange = async (newId: string | null) => {
    if (!selectedCard || sprintUpdating) return;
    setSprintUpdating(true);
    try {
      if (cardSprintId) await apiService.delete(`/api/sprints/${cardSprintId}/cards/${selectedCard.id}`, true);
      if (newId)        await apiService.post(`/api/sprints/${newId}/cards`, { cardId: selectedCard.id }, true);
      setCardSprintId(newId);
      invalidateTimeline();
    } catch {} finally { setSprintUpdating(false); }
  };

  const handleMilestoneChange = async (newId: string | null) => {
    if (!selectedCard || milestoneUpdating) return;
    const prev = cardMilestoneId;
    setCardMilestoneId(newId);      // optimistic
    setMilestoneUpdating(true);
    try {
      const r = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { milestoneId: newId }, true);
      if (r.success && r.data) {
        updateCard(selectedCard.id, r.data.card);
        setSelectedCard(r.data.card);
      } else {
        setCardMilestoneId(prev);   // revert on failure
      }
    } catch { setCardMilestoneId(prev); } finally { setMilestoneUpdating(false); }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setIsDeleting(true);
    try {
      const r = await apiService.delete(`/api/cards/${selectedCard.id}`, true);
      if (!r.success) throw new Error(r.error?.message || 'Error');
      removeCard(selectedCard.id, selectedCard.listId);
      handleClose();
    } catch (e: any) { alert(`Error: ${e.message}`); } finally { setIsDeleting(false); }
  };

  const handleMemberAssigned = (m: any) => { const ms = [...(selectedCard.members || []), m]; updateCard(selectedCard.id, { members: ms }); setSelectedCard({ ...selectedCard, members: ms }); };
  const handleMemberRemoved  = (id: string) => { const ms = (selectedCard.members || []).filter((x) => x.id !== id); updateCard(selectedCard.id, { members: ms }); setSelectedCard({ ...selectedCard, members: ms }); };
  const handleLabelAssigned  = (l: any) => { const ls = [...(selectedCard.labels || []), l]; updateCard(selectedCard.id, { labels: ls }); setSelectedCard({ ...selectedCard, labels: ls }); };
  const handleLabelRemoved   = (id: string) => { const ls = (selectedCard.labels || []).filter((x) => x.id !== id); updateCard(selectedCard.id, { labels: ls }); setSelectedCard({ ...selectedCard, labels: ls }); };

  const fmt = (ds: string) => formatShort(ds, user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, user?.language as 'es' | 'en');
  const activePriority = priorityOptions.find((p) => p.value === editedPriority);

  // ── sidebar row helper ────────────────────────────────────────────────────
  const SbLabel = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: '#615846', textTransform: 'uppercase', fontFamily: SORA, display: 'block', marginBottom: '8px' }}>
      {children}
    </span>
  );

  // ── render ─────────────────────────────────────────────────────────────────
  return (
    <>
      <style>{`
        @keyframes cdmIn {
          0%   { opacity:0; transform:scale(0.88) translateY(40px); }
          55%  { opacity:1; transform:scale(1.018) translateY(-5px); }
          78%  { transform:scale(0.999) translateY(1px); }
          100% { opacity:1; transform:scale(1) translateY(0); }
        }
        @keyframes cdmOut {
          0%   { opacity:1; transform:scale(1) translateY(0); }
          30%  { transform:scale(0.99) translateY(-3px); }
          100% { opacity:0; transform:scale(0.91) translateY(24px); }
        }
        @keyframes cdmColIn {
          from { opacity:0; transform:translateY(20px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes cdmSbIn {
          from { opacity:0; transform:translateX(20px); }
          to   { opacity:1; transform:translateX(0); }
        }
        @keyframes cdmTopIn {
          from { opacity:0; transform:translateY(-10px); }
          to   { opacity:1; transform:translateY(0); }
        }
        @keyframes cdmSpin { to { transform:rotate(360deg) } }
        .cdm-l { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.1) transparent; }
        .cdm-l::-webkit-scrollbar { width:4px; }
        .cdm-l::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.12); border-radius:2px; }
        .cdm-title::placeholder { color:#615846; }
        .cdm-desc::placeholder  { color:#403832; font-style:italic; }
        .cdm-desc:focus { border-color:rgba(255,255,255,0.18) !important; }
      `}</style>

      {/* ── Backdrop ──────────────────────────────────────────────────────── */}
      <div
        style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,0.45)',
          backdropFilter:'blur(4px)',
          WebkitBackdropFilter:'blur(4px)',
          zIndex:40,
          transition:'opacity 0.18s cubic-bezier(0.4,0,0.2,1)',
          opacity:isVisible?1:0,
          pointerEvents:isVisible?'auto':'none',
        }}
        onClick={handleClose}
      />

      {/* ── Modal wrapper ─────────────────────────────────────────────────── */}
      <div onClick={handleClose} style={{ position:'fixed', inset:0, zIndex:50, display:'flex', alignItems:'center', justifyContent:'center', padding:'20px', pointerEvents:isVisible?'auto':'none' }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width:'100%', maxWidth:'1000px', height:'min(88vh, 860px)',
            background:'#161B2E', border:'1px solid rgba(255,255,255,0.09)',
            borderRadius:'16px', overflow:'hidden', display:'flex', flexDirection:'column',
            boxShadow:'0 48px 120px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04) inset',
            animation: isVisible
              ? 'cdmIn 0.22s cubic-bezier(0.16,1,0.3,1) both'
              : 'cdmOut 0.18s cubic-bezier(0.4,0,1,1) forwards',
          }}
        >

          {/* ── Top bar ─────────────────────────────────────────────────── */}
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'11px 20px', borderBottom:'1px solid rgba(255,255,255,0.07)', background:'rgba(255,255,255,0.015)', flexShrink:0, animation:'cdmTopIn 0.18s cubic-bezier(0.16,1,0.3,1) 0.02s both' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'6px', flex:1, minWidth:0 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="4" width="5" height="16" rx="1.4" stroke="#403832" strokeWidth="1.8"/>
                <rect x="10" y="4" width="5" height="11" rx="1.4" stroke="#403832" strokeWidth="1.8"/>
                <rect x="17" y="4" width="5" height="13" rx="1.4" stroke="#403832" strokeWidth="1.8"/>
              </svg>
              <span style={{ fontSize:'12px', color:'#615846', fontFamily:MANROPE }}>{currentBoard?.name ?? '…'}</span>
              <span style={{ fontSize:'12px', color:'rgba(255,255,255,0.1)' }}>›</span>
              <span style={{ fontSize:'12px', color:'#827A6D', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:MANROPE }}>Tarjeta</span>
            </div>
            <button
              onClick={handleClose}
              style={{ width:'26px', height:'26px', borderRadius:'7px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', cursor:'pointer', color:'#615846', display:'flex', alignItems:'center', justifyContent:'center', transition:'background 0.12s, color 0.12s', flexShrink:0 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
            >
              <X style={{ width:'13px', height:'13px' }} />
            </button>
          </div>

          {/* ── Two-column body ─────────────────────────────────────────── */}
          <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

            {/* ══ LEFT — main content ══════════════════════════════════════ */}
            <div className="cdm-l" style={{ flex:1, overflowY:'auto', padding:'28px 32px', display:'flex', flexDirection:'column', gap:'22px', animation:'cdmColIn 0.22s cubic-bezier(0.16,1,0.3,1) 0.04s both' }}>

              {/* Title */}
              <div>
                {editingTitle && canEdit ? (
                  <input
                    className="cdm-title"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    onBlur={saveTitle}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); saveTitle(); } if (e.key === 'Escape') { setEditedTitle(selectedCard.title); setEditingTitle(false); } }}
                    autoFocus maxLength={255}
                    style={{ width:'100%', background:'transparent', border:'none', borderBottom:'2px solid rgba(255,255,255,0.15)', outline:'none', fontSize:'1.6rem', fontWeight:700, color:'#F4EEE2', lineHeight:1.25, fontFamily:SORA, paddingBottom:'4px', boxSizing:'border-box' as const }}
                  />
                ) : (
                  <h2
                    onClick={() => canEdit && (setEditingTitle(true), setEditedTitle(selectedCard.title))}
                    title={canEdit ? 'Haz clic para editar' : undefined}
                    style={{ margin:0, fontSize:'1.6rem', fontWeight:700, color:'#F4EEE2', lineHeight:1.25, wordBreak:'break-word', fontFamily:SORA, cursor:canEdit?'text':'default' }}
                  >
                    {selectedCard.title}
                    {savingTitle && <span style={{ fontSize:'11px', color:'#615846', marginLeft:'10px', fontWeight:400, fontFamily:MANROPE }}>Guardando…</span>}
                  </h2>
                )}
              </div>

              {/* Description */}
              <div>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                  <SectionLabel label={t.card_section_description} />
                  {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} position="inline" size="sm" />}
                </div>
                {editingDesc && canEdit ? (
                  <textarea
                    className="cdm-desc"
                    value={editedDescription}
                    onChange={(e) => setEditedDescription(e.target.value)}
                    onFocus={() => setIsDescFocused(true)}
                    onBlur={saveDesc}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setEditedDescription(selectedCard.description || ''); saveDesc(); } }}
                    placeholder={t.card_placeholder_description}
                    rows={6}
                    autoFocus
                    style={{ width:'100%', padding:'14px 16px', borderRadius:'10px', resize:'vertical', lineHeight:1.7, background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.1)', color:'#C8BFAE', fontSize:'14px', outline:'none', boxSizing:'border-box' as const, fontFamily:MANROPE, transition:'border-color 0.15s' }}
                  />
                ) : (
                  <div
                    onClick={() => canEdit && setEditingDesc(true)}
                    style={{ minHeight:'88px', padding:'14px 16px', borderRadius:'10px', lineHeight:1.7, background:canEdit?'rgba(255,255,255,0.02)':'transparent', border:`1px solid ${canEdit?'rgba(255,255,255,0.06)':'transparent'}`, cursor:canEdit?'text':'default', fontSize:'14px', transition:'border-color 0.15s, background 0.15s' }}
                    onMouseEnter={(e) => { if (canEdit) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.13)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = canEdit?'rgba(255,255,255,0.06)':'transparent'; (e.currentTarget as HTMLElement).style.background = canEdit?'rgba(255,255,255,0.02)':'transparent'; }}
                  >
                    {selectedCard.description
                      ? <span style={{ color:'#C8BFAE', whiteSpace:'pre-wrap' }}>{selectedCard.description}</span>
                      : <span style={{ color:'#403832', fontStyle:'italic' }}>{canEdit ? t.card_click_add_description : t.card_no_description}</span>
                    }
                    {savingDesc && <span style={{ fontSize:'11px', color:'#615846', marginLeft:'8px', fontFamily:MANROPE }}>Guardando…</span>}
                  </div>
                )}
              </div>

              {/* Checklist */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'20px' }}>
                <CardChecklist cardId={selectedCard.id} onProgressChange={handleChecklistProgressChange} />
              </div>

              {/* Dependencies */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'20px' }}>
                <CardDependencies cardId={selectedCard.id} />
              </div>

              {/* Comments */}
              <div style={{ borderTop:'1px solid rgba(255,255,255,0.06)', paddingTop:'20px' }}>
                <CommentList cardId={selectedCard.id} maxHeight="440px" minHeight="100px" showForm={true} showCount={true} onCountChange={handleCommentCountChange} workspaceId={currentWorkspaceId || undefined} />
              </div>
            </div>

            {/* ══ RIGHT — sidebar ══════════════════════════════════════════ */}
            <div className="cdm-l" style={{ width:'286px', flexShrink:0, borderLeft:'1px solid rgba(255,255,255,0.07)', overflowY:'auto', padding:'24px 20px', display:'flex', flexDirection:'column', gap:'0', background:'rgba(255,255,255,0.008)', animation:'cdmSbIn 0.22s cubic-bezier(0.16,1,0.3,1) 0.07s both' }}>

              {/* Priority */}
              <div style={{ paddingBottom:'18px', borderBottom:'1px solid rgba(255,255,255,0.06)', marginBottom:'4px' }}>
                <SbLabel>{t.card_section_priority}</SbLabel>
                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'4px' }}>
                  {priorityOptions.map((opt) => {
                    const active = editedPriority === opt.value;
                    return (
                      <button
                        key={opt.value ?? 'none'}
                        onClick={() => savePriority(opt.value as any)}
                        disabled={!canEdit}
                        title={opt.label}
                        style={{ padding:'7px 4px', borderRadius:'7px', fontSize:'10.5px', fontWeight: active ? 700 : 400, background: active ? opt.bg : 'rgba(255,255,255,0.02)', border:`1px solid ${active ? opt.border : 'rgba(255,255,255,0.07)'}`, color: active ? opt.color : '#615846', cursor:canEdit?'pointer':'default', transition:'all 0.12s', display:'flex', flexDirection:'column', alignItems:'center', gap:'3px' }}
                        onMouseEnter={(e) => { if (canEdit && !active) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.18)'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; }}}
                        onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.07)'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}}
                      >
                        {opt.symbol && <span style={{ fontSize:'9px', lineHeight:1 }}>{opt.symbol}</span>}
                        <span>{opt.label}</span>
                      </button>
                    );
                  })}
                </div>
                {activePriority?.value && (
                  <p style={{ margin:'6px 0 0', fontSize:'11px', color: activePriority.color, fontFamily:MANROPE }}>
                    Prioridad {activePriority.label.toLowerCase()}
                  </p>
                )}
              </div>

              {/* Dates */}
              <div style={{ padding:'18px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <SbLabel>Fechas</SbLabel>
                <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                  {/* Start */}
                  <div>
                    <span style={{ fontSize:'10.5px', color:'#615846', display:'block', marginBottom:'4px', fontFamily:MANROPE }}>{t.card_section_start_date}</span>
                    <div style={{ position:'relative' }} ref={startCalendarRef}>
                      <button type="button" disabled={!canEdit}
                        onClick={() => { if (!canEdit) return; setShowStartCalendar(!showStartCalendar); setShowCalendar(false); }}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:editedStartDate?'#C8BFAE':'#615846', fontSize:'12.5px', textAlign:'left', cursor:canEdit?'pointer':'default', display:'flex', alignItems:'center', gap:'7px', transition:'border-color 0.12s', fontFamily:MANROPE }}
                        onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      >
                        <Calendar style={{ width:'12px', height:'12px', flexShrink:0 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{editedStartDate ? fmt(editedStartDate) : t.card_start_date_none}</span>
                      </button>
                      {showStartCalendar && <CustomCalendar value={editedStartDate} onChange={(v) => handleDateChange('startDate', v)} onClose={() => setShowStartCalendar(false)} />}
                    </div>
                  </div>
                  {/* Due */}
                  <div>
                    <span style={{ fontSize:'10.5px', color:'#615846', display:'block', marginBottom:'4px', fontFamily:MANROPE }}>{t.card_section_due_date}</span>
                    <div style={{ position:'relative' }} ref={calendarRef}>
                      <button type="button" disabled={!canEdit}
                        onClick={() => { if (!canEdit) return; setShowCalendar(!showCalendar); setShowStartCalendar(false); }}
                        style={{ width:'100%', padding:'7px 10px', borderRadius:'7px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:editedDueDate?'#C8BFAE':'#615846', fontSize:'12.5px', textAlign:'left', cursor:canEdit?'pointer':'default', display:'flex', alignItems:'center', gap:'7px', transition:'border-color 0.12s', fontFamily:MANROPE }}
                        onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
                      >
                        <Calendar style={{ width:'12px', height:'12px', flexShrink:0 }} />
                        <span style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{editedDueDate ? fmt(editedDueDate) : t.card_due_date_none}</span>
                      </button>
                      {showCalendar && <CustomCalendar value={editedDueDate} onChange={(v) => handleDateChange('dueDate', v)} onClose={() => setShowCalendar(false)} />}
                    </div>
                  </div>
                </div>
              </div>

              {/* Buffer days */}
              <div style={{ padding:'14px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <SbLabel>
                  <svg style={{ width:'10px', height:'10px', display:'inline', marginRight:'5px', verticalAlign:'middle', flexShrink:0 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                  </svg>
                  Colchón
                </SbLabel>
                <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'4px', flex:1, padding:'6px 10px', borderRadius:'7px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', transition:'border-color 0.12s' }}
                    onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'}
                    onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
                  >
                    <input
                      type="number" min="0" max="365" disabled={!canEdit || bufferSaving}
                      value={bufferDays ?? ''}
                      placeholder="Auto"
                      onChange={(e) => {
                        const v = e.target.value === '' ? null : Math.max(0, Math.min(365, parseInt(e.target.value, 10)));
                        setBufferDays(isNaN(v as any) ? null : v);
                      }}
                      onBlur={(e) => {
                        const v = e.target.value === '' ? null : parseInt(e.target.value, 10);
                        handleBufferChange(isNaN(v as any) ? null : v);
                      }}
                      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                      style={{ flex:1, background:'transparent', border:'none', outline:'none', fontSize:'12.5px', color:bufferDays != null ? '#C8BFAE' : '#615846', fontFamily:MANROPE, minWidth:0 }}
                    />
                    <span style={{ fontSize:'11px', color:'#615846', flexShrink:0, fontFamily:MANROPE }}>días</span>
                  </div>
                  {bufferDays != null && canEdit && (
                    <button onClick={() => handleBufferChange(null)} disabled={bufferSaving}
                      title="Volver a automático"
                      style={{ width:'30px', height:'30px', borderRadius:'7px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'#615846', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color 0.12s, color 0.12s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'; (e.currentTarget as HTMLElement).style.color = '#C8BFAE'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
                    >
                      <X style={{ width:'11px', height:'11px' }} />
                    </button>
                  )}
                  {bufferSaving && <div style={{ width:'13px', height:'13px', borderRadius:'50%', border:`2px solid ${C.accent}`, borderTopColor:'transparent', animation:'cdmSpin 0.6s linear infinite', flexShrink:0 }} />}
                </div>
                <p style={{ margin:'5px 0 0', fontSize:'10px', color:'#3E3830', fontFamily:MANROPE, lineHeight:1.4 }}>
                  {bufferDays != null ? `${bufferDays} días manuales` : 'Automático según prioridad: alta 50 %, media 30 %, baja 15 %'}
                </p>
              </div>

              {/* Sprint */}
              {boardSprints.filter((s) => s.status !== 'COMPLETED').length > 0 && (
                <div style={{ padding:'18px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <SbLabel><Zap style={{ width:'10px', height:'10px', display:'inline', marginRight:'5px', verticalAlign:'middle' }} />{t.card_section_sprint}</SbLabel>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <select value={cardSprintId ?? ''} onChange={(e) => handleSprintChange(e.target.value || null)} disabled={!canEdit || sprintUpdating}
                      style={{ flex:1, padding:'7px 10px', borderRadius:'7px', fontSize:'12.5px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color:cardSprintId?C.accent:'#827A6D', outline:'none', cursor:canEdit?'pointer':'default', colorScheme:'dark', fontFamily:MANROPE }}
                    >
                      <option value="">{t.card_sprint_none}</option>
                      {boardSprints.filter((s) => s.status !== 'COMPLETED').map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {cardSprintId && canEdit && (
                      <button onClick={() => handleSprintChange(null)} disabled={sprintUpdating}
                        style={{ width:'30px', height:'30px', borderRadius:'7px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'#615846', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color 0.12s, color 0.12s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${C.red}50`; (e.currentTarget as HTMLElement).style.color = C.red; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
                      >
                        <X style={{ width:'11px', height:'11px' }} />
                      </button>
                    )}
                    {sprintUpdating && <div style={{ width:'13px', height:'13px', borderRadius:'50%', border:`2px solid ${C.accent}`, borderTopColor:'transparent', animation:'cdmSpin 0.6s linear infinite', flexShrink:0 }} />}
                  </div>
                </div>
              )}

              {/* Hito */}
              {projectMilestones.length > 0 && (
                <div style={{ padding:'18px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                  <SbLabel>
                    <Flag style={{ width:'10px', height:'10px', display:'inline', marginRight:'5px', verticalAlign:'middle' }} />
                    Hito
                  </SbLabel>
                  <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                    <select
                      value={cardMilestoneId ?? ''}
                      onChange={(e) => handleMilestoneChange(e.target.value || null)}
                      disabled={!canEdit || milestoneUpdating}
                      style={{ flex:1, padding:'7px 10px', borderRadius:'7px', fontSize:'12.5px', background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)', color: cardMilestoneId ? (projectMilestones.find((m) => m.id === cardMilestoneId)?.color ?? '#7B8FA8') : '#827A6D', outline:'none', cursor:canEdit?'pointer':'default', colorScheme:'dark', fontFamily:MANROPE }}
                    >
                      <option value="">Sin hito</option>
                      {projectMilestones.map((m) => (
                        <option key={m.id} value={m.id}>{m.name}</option>
                      ))}
                    </select>
                    {cardMilestoneId && canEdit && (
                      <button
                        onClick={() => handleMilestoneChange(null)}
                        disabled={milestoneUpdating}
                        style={{ width:'30px', height:'30px', borderRadius:'7px', background:'transparent', border:'1px solid rgba(255,255,255,0.08)', color:'#615846', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, transition:'border-color 0.12s, color 0.12s' }}
                        onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${C.red}50`; (e.currentTarget as HTMLElement).style.color = C.red; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
                      >
                        <X style={{ width:'11px', height:'11px' }} />
                      </button>
                    )}
                    {milestoneUpdating && <div style={{ width:'13px', height:'13px', borderRadius:'50%', border:'2px solid #7B8FA8', borderTopColor:'transparent', animation:'cdmSpin 0.6s linear infinite', flexShrink:0 }} />}
                  </div>
                  {cardMilestoneId && (() => {
                    const m = projectMilestones.find((x) => x.id === cardMilestoneId);
                    if (!m) return null;
                    const d = new Date(m.date);
                    const label = d.toLocaleDateString('es-ES', { day:'numeric', month:'short', year:'numeric' });
                    const isPast = d < new Date() && m.status === 'PENDING';
                    return (
                      <p style={{ margin:'6px 0 0', fontSize:'11px', color: isPast ? C.red : '#615846', fontFamily:MANROPE }}>
                        {isPast ? '⚠ ' : ''}{label} - {m.status === 'REACHED' ? 'Alcanzado' : m.status === 'MISSED' ? 'Perdido' : 'Pendiente'}
                      </p>
                    );
                  })()}
                </div>
              )}

              {/* Labels */}
              <div style={{ padding:'18px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <SbLabel>{t.card_section_labels}</SbLabel>
                <div style={{ maxHeight:'160px', overflowY:'auto' }}>
                  {currentWorkspaceId
                    ? <LabelPicker workspaceId={currentWorkspaceId} cardId={selectedCard.id} assignedLabels={selectedCard.labels || []} onLabelAssigned={handleLabelAssigned} onLabelRemoved={handleLabelRemoved} />
                    : <p style={{ fontSize:'11px', color:C.text4, margin:0 }}>{t.loading}</p>
                  }
                </div>
              </div>

              {/* Members */}
              <div style={{ padding:'18px 0', borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                <SbLabel>{t.card_section_members}</SbLabel>
                <div style={{ maxHeight:'180px', overflowY:'auto' }}>
                  {currentWorkspaceId ? (
                    canEdit ? (
                      <MemberPicker workspaceId={currentWorkspaceId} cardId={selectedCard.id} assignedMembers={selectedCard.members || []} onMemberAssigned={handleMemberAssigned} onMemberRemoved={handleMemberRemoved} />
                    ) : (
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        {(selectedCard.members || []).length > 0
                          ? (selectedCard.members || []).map((m: any) => {
                              const name  = m.name  ?? m.user?.name  ?? '';
                              const email = m.email ?? m.user?.email ?? '';
                              return (
                                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'5px 8px', borderRadius:'6px', background:'rgba(255,255,255,0.03)' }}>
                                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:`${C.accent}cc`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', fontWeight:700, color:'#fff', flexShrink:0 }}>{name.charAt(0).toUpperCase()}</div>
                                  <div style={{ minWidth:0 }}>
                                    <p style={{ fontSize:'12px', fontWeight:500, color:C.text, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{name}</p>
                                    <p style={{ fontSize:'10.5px', color:C.text4, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', margin:0 }}>{email}</p>
                                  </div>
                                </div>
                              );
                            })
                          : <p style={{ fontSize:'11px', color:C.text4, margin:0 }}>{t.card_members_none}</p>
                        }
                      </div>
                    )
                  ) : <p style={{ fontSize:'11px', color:C.text4, margin:0 }}>{t.loading}</p>}
                </div>
              </div>

              {/* Delete — pinned at bottom */}
              {canEdit && (
                <div style={{ paddingTop:'18px', marginTop:'auto' }}>
                  <button
                    onClick={() => setShowDeleteConfirm(true)}
                    style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'center', gap:'7px', padding:'9px', borderRadius:'8px', fontSize:'12.5px', fontWeight:500, background:'rgba(224,82,82,0.05)', border:'1px solid rgba(224,82,82,0.15)', color:'#615846', cursor:'pointer', transition:'all 0.15s', fontFamily:MANROPE }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.12)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.4)'; (e.currentTarget as HTMLElement).style.color = C.red; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.05)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.15)'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
                  >
                    <Trash2 style={{ width:'12px', height:'12px' }} />
                    {t.btn_delete}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Delete confirm ──────────────────────────────────────────────────── */}
      {showDeleteConfirm && canEdit && (
        <>
          <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', zIndex:60, backdropFilter:'blur(2px)' }} onClick={() => setShowDeleteConfirm(false)} />
          <div style={{ position:'fixed', inset:0, zIndex:70, display:'flex', alignItems:'center', justifyContent:'center', padding:'16px' }}>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:'12px', maxWidth:'380px', width:'100%', padding:'22px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'10px' }}>
                <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:`${C.red}15`, border:`1px solid ${C.red}35`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <Trash2 style={{ width:'14px', height:'14px', color:C.red }} />
                </div>
                <h3 style={{ fontSize:'14px', fontWeight:700, color:C.text, margin:0 }}>{t.card_delete_title}</h3>
              </div>
              <p style={{ fontSize:'12.5px', color:C.text3, lineHeight:1.6, marginBottom:'18px' }}>{t.card_delete_desc(selectedCard.title)}</p>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                  style={{ flex:1, padding:'8px', borderRadius:'7px', fontSize:'12.5px', fontWeight:500, background:C.hover, border:`1px solid ${C.border2}`, color:C.text2, cursor:'pointer' }}>{t.btn_cancel}</button>
                <button onClick={handleDelete} disabled={isDeleting}
                  style={{ flex:1, padding:'8px', borderRadius:'7px', fontSize:'12.5px', fontWeight:600, background:C.red, color:'#fff', border:'none', cursor:'pointer', opacity:isDeleting?0.7:1 }}>{isDeleting ? t.card_btn_deleting : t.btn_delete}</button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
