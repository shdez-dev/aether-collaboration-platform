// apps/web/src/components/CardDetailModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useBoardStore } from '@/stores/boardStore';
import { useTimelineStore } from '@/stores/timelineStore';
import { useTypingIndicator, useTypingListeners } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from './realtime/TypingIndicator';
import { MemberPicker } from './MemberPicker';
import { LabelPicker } from './LabelPicker';
import { CommentList } from './comments/CommentList';
import { X, Calendar, Flag, Tag, Users as UsersIcon, Zap, ChevronLeft, ChevronRight, Trash2, Edit2, Save } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';
import { CardChecklist } from './CardChecklist';
import { CardDependencies } from './CardDependencies';
import type { Sprint } from '@aether/types';
import { motion, PanInfo } from 'framer-motion';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Custom Calendar ───────────────────────────────────────────────────────────
function CustomCalendar({ value, onChange, onClose }: {
  value: string; onChange: (date: string) => void; onClose: () => void;
}) {
  const t = useT();

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
  const t = useT();
  const { selectedCard, setSelectedCard, updateCard, removeCard, currentWorkspaceId } = useCardStore();
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { currentBoard } = useBoardStore();
  const invalidateTimeline = useTimelineStore((s) => s.invalidate);
  const userRole = currentWorkspace?.userRole;

  const priorityOptions = [
    { value: null,     label: t.card_priority_none,   color: C.text3,  bg: 'transparent', border: C.border2, symbol: '' },
    { value: 'LOW',    label: t.card_priority_low,    color: C.accent, bg: `${C.accent}12`, border: `${C.accent}35`, symbol: '▼' },
    { value: 'MEDIUM', label: t.card_priority_medium, color: C.amber,  bg: `${C.amber}12`,  border: `${C.amber}35`,  symbol: '■' },
    { value: 'HIGH',   label: t.card_priority_high,   color: C.red,    bg: `${C.red}12`,    border: `${C.red}35`,    symbol: '▲' },
  ];

  const [isEditing,          setIsEditing]          = useState(false);
  const [editedTitle,        setEditedTitle]        = useState('');
  const [editedDescription,  setEditedDescription]  = useState('');
  const [editedPriority,     setEditedPriority]     = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);
  const [editedStartDate,    setEditedStartDate]    = useState('');
  const [editedDueDate,      setEditedDueDate]      = useState('');
  const [isUpdating,         setIsUpdating]         = useState(false);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [isDeleting,         setIsDeleting]         = useState(false);
  const [showStartCalendar,  setShowStartCalendar]  = useState(false);
  const [showCalendar,       setShowCalendar]       = useState(false);
  const [commentCount,       setCommentCount]       = useState(0);
  const [isVisible,          setIsVisible]          = useState(false);
  const [checklistProgress,  setChecklistProgress]  = useState<{ done: number; total: number }>({ done: 0, total: 0 });
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';

  const handleCommentCountChange   = useCallback((count: number) => setCommentCount(count), []);
  const handleChecklistProgressChange = useCallback((done: number, total: number) => setChecklistProgress({ done, total }), []);

  const [boardSprints,  setBoardSprints]  = useState<Sprint[]>([]);
  const [cardSprintId,  setCardSprintId]  = useState<string | null>(null);
  const [sprintUpdating, setSprintUpdating] = useState(false);

  useTypingIndicator({ cardId: selectedCard?.id || '', isTyping: isDescriptionFocused && isEditing, debounceMs: 500, disabled: !selectedCard });
  const typingUsers = useTypingListeners(selectedCard?.id || '');
  const startCalendarRef = useRef<HTMLDivElement>(null);
  const calendarRef      = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCard) {
      setEditedTitle(selectedCard.title);
      setEditedDescription(selectedCard.description || '');
      setEditedPriority(selectedCard.priority || null);
      setEditedStartDate(selectedCard.startDate || '');
      setEditedDueDate(selectedCard.dueDate || '');
      setTimeout(() => setIsVisible(true), 10);
      document.body.classList.add('card-detail-drawer-open');
      apiService.get<{ card: any }>(`/api/cards/${selectedCard.id}`, true)
        .then((res) => { if (res.success && res.data) { setSelectedCard(res.data.card); updateCard(selectedCard.id, res.data.card); } })
        .catch(() => {});
    } else {
      setIsVisible(false);
      document.body.classList.remove('card-detail-drawer-open');
    }
    return () => { document.body.classList.remove('card-detail-drawer-open'); };
  }, [selectedCard?.id]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (startCalendarRef.current && !startCalendarRef.current.contains(e.target as Node)) setShowStartCalendar(false);
      if (calendarRef.current      && !calendarRef.current.contains(e.target as Node))      setShowCalendar(false);
    };
    if (showStartCalendar || showCalendar) { document.addEventListener('mousedown', handler); return () => document.removeEventListener('mousedown', handler); }
  }, [showStartCalendar, showCalendar]);

  useEffect(() => {
    if (!selectedCard || !currentBoard?.id) return;
    apiService.get<{ sprints: Sprint[] }>(`/api/boards/${currentBoard.id}/sprints`, true)
      .then((res) => {
        if (!res.success || !res.data) return;
        setBoardSprints(res.data.sprints);
        const found = res.data.sprints.find((s) => (s.cards ?? []).some((c: any) => c.id === selectedCard.id));
        setCardSprintId(found?.id ?? null);
      }).catch(() => {});
  }, [selectedCard?.id, currentBoard?.id]);

  const handleDateChange = async (field: 'startDate' | 'dueDate', value: string) => {
    if (!selectedCard) return;
    if (field === 'startDate') setEditedStartDate(value); else setEditedDueDate(value);
    try {
      const res = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, { [field]: value || null }, true);
      if (res.success && res.data) { updateCard(selectedCard.id, res.data.card); setSelectedCard(res.data.card); }
    } catch {}
  };

  const handleSprintChange = async (newSprintId: string | null) => {
    if (!selectedCard || sprintUpdating) return;
    setSprintUpdating(true);
    try {
      if (cardSprintId) await apiService.delete(`/api/sprints/${cardSprintId}/cards/${selectedCard.id}`, true);
      if (newSprintId) await apiService.post(`/api/sprints/${newSprintId}/cards`, { cardId: selectedCard.id }, true);
      setCardSprintId(newSprintId);
      invalidateTimeline();
    } catch {} finally { setSprintUpdating(false); }
  };

  if (!selectedCard) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => { setSelectedCard(null); setIsEditing(false); setShowDeleteConfirm(false); setShowStartCalendar(false); setShowCalendar(false); setIsDescriptionFocused(false); }, 300);
  };

  const handleUpdate = async () => {
    if (!canEdit || !editedTitle.trim()) return;
    setIsUpdating(true);
    try {
      const updates: any = {};
      if (editedTitle !== selectedCard.title) updates.title = editedTitle;
      if (editedDescription !== (selectedCard.description || '')) updates.description = editedDescription || null;
      if (editedPriority !== selectedCard.priority) updates.priority = editedPriority;
      if (Object.keys(updates).length === 0) { setIsEditing(false); setIsUpdating(false); return; }
      const res = await apiService.put<{ card: any }>(`/api/cards/${selectedCard.id}`, updates, true);
      if (!res.success) throw new Error(res.error?.message || 'Error al actualizar');
      updateCard(selectedCard.id, res.data!.card);
      setSelectedCard(res.data!.card);
      setIsEditing(false);
      setIsDescriptionFocused(false);
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setIsUpdating(false); }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setIsDeleting(true);
    try {
      const res = await apiService.delete(`/api/cards/${selectedCard.id}`, true);
      if (!res.success) throw new Error(res.error?.message || 'Error al eliminar');
      removeCard(selectedCard.id, selectedCard.listId);
      handleClose();
    } catch (err: any) { alert(`Error: ${err.message}`); } finally { setIsDeleting(false); }
  };

  const handleMemberAssigned = (member: any) => { const m = [...(selectedCard.members || []), member]; updateCard(selectedCard.id, { members: m }); setSelectedCard({ ...selectedCard, members: m }); };
  const handleMemberRemoved  = (memberId: string) => { const m = (selectedCard.members || []).filter((x) => x.id !== memberId); updateCard(selectedCard.id, { members: m }); setSelectedCard({ ...selectedCard, members: m }); };
  const handleLabelAssigned  = (label: any) => { const l = [...(selectedCard.labels || []), label]; updateCard(selectedCard.id, { labels: l }); setSelectedCard({ ...selectedCard, labels: l }); };
  const handleLabelRemoved   = (labelId: string) => { const l = (selectedCard.labels || []).filter((x) => x.id !== labelId); updateCard(selectedCard.id, { labels: l }); setSelectedCard({ ...selectedCard, labels: l }); };

  const formatDate = (ds: string) => formatShort(ds, user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, user?.language as 'es' | 'en');
  const currentPriority = priorityOptions.find((p) => p.value === editedPriority);

  // shared styles
  const inputStyle: React.CSSProperties = { width: '100%', padding: '7px 10px', borderRadius: '6px', background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '12.5px', outline: 'none', boxSizing: 'border-box' };
  const fieldBtn: React.CSSProperties  = { width: '100%', padding: '7px 10px', borderRadius: '6px', background: C.bg2, border: `1px solid ${C.border}`, color: C.text2, fontSize: '12.5px', textAlign: 'left', cursor: canEdit ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: '6px' };

  return (
    <>
      {/* Overlay */}
      <div
        style={{ position: 'fixed', inset: 0, background: 'transparent', zIndex: 40, transition: 'opacity 0.3s', opacity: isVisible ? 1 : 0, pointerEvents: isVisible ? 'auto' : 'none' }}
        onClick={handleClose}
      />

      {/* Drawer */}
      <motion.div
        drag={typeof window !== 'undefined' && window.innerWidth < 640 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(_e, info: PanInfo) => { if (info.offset.x > 100 || info.velocity.x > 500) handleClose(); }}
        initial={{ x: '100%' }}
        animate={{ x: isVisible ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{
          position: 'fixed', top: 0, right: 0, height: '100%',
          width: '100%', maxWidth: '580px',
          background: C.surface2, borderLeft: `1px solid ${C.border}`,
          boxShadow: '-20px 0 60px rgba(0,0,0,0.5)',
          zIndex: 50, display: 'flex', flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px 14px', borderBottom: `1px solid ${C.border}`, background: C.surface, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '8px' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              {isEditing && canEdit ? (
                <input
                  type="text" value={editedTitle} onChange={(e) => setEditedTitle(e.target.value)}
                  autoFocus maxLength={255}
                  style={{ ...inputStyle, fontSize: '15px', fontWeight: 700, background: C.bg2, padding: '6px 10px' }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                />
              ) : (
                <h2 style={{ fontSize: '15px', fontWeight: 700, color: C.text, lineHeight: 1.3, wordBreak: 'break-word' }}>
                  {selectedCard.title}
                </h2>
              )}
            </div>
            <button
              onClick={handleClose}
              style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border}`, cursor: 'pointer', color: C.text3, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text2; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text3; }}
            >
              <X style={{ width: '13px', height: '13px' }} />
            </button>
          </div>
          <p style={{ fontSize: '10.5px', color: C.text4 }}>
            {t.card_created(formatDate(selectedCard.createdAt))}
            {selectedCard.updatedAt !== selectedCard.createdAt && ` · ${t.card_updated(formatDate(selectedCard.updatedAt))}`}
          </p>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Descripción */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <SectionLabel label={t.card_section_description} />
              {typingUsers.length > 0 && <TypingIndicator typingUsers={typingUsers} position="inline" size="sm" />}
            </div>
            {isEditing && canEdit ? (
              <textarea
                value={editedDescription}
                onChange={(e) => setEditedDescription(e.target.value)}
                onFocus={() => setIsDescriptionFocused(true)}
                onBlur={() => setIsDescriptionFocused(false)}
                placeholder={t.card_placeholder_description}
                rows={4}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }}
                onFocusCapture={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlurCapture={(e) => (e.currentTarget.style.borderColor = C.border)}
              />
            ) : (
              <div
                onClick={() => canEdit && setIsEditing(true)}
                style={{ ...fieldBtn, minHeight: '80px', alignItems: 'flex-start', cursor: canEdit ? 'pointer' : 'default', lineHeight: 1.6, transition: 'border-color 0.15s' }}
                onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
              >
                {selectedCard.description ? (
                  <span style={{ fontSize: '12.5px', color: C.text2, whiteSpace: 'pre-wrap' }}>{selectedCard.description}</span>
                ) : (
                  <span style={{ fontSize: '12px', color: C.text4, fontStyle: 'italic' }}>
                    {canEdit ? t.card_click_add_description : t.card_no_description}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Separador */}
          <div style={{ height: '1px', background: C.border }} />

          {/* Prioridad & Fechas */}
          <div>
            <SectionLabel icon={<Flag style={{ width: '11px', height: '11px' }} />} label={`${t.card_section_priority} & ${t.card_section_due_date}`} />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>

              {/* Prioridad */}
              <div>
                <span style={{ fontSize: '10px', color: C.text4, display: 'block', marginBottom: '4px' }}>{t.card_section_priority}</span>
                {isEditing && canEdit ? (
                  <select
                    value={editedPriority || ''}
                    onChange={(e) => setEditedPriority((e.target.value || null) as any)}
                    style={{ ...inputStyle, cursor: 'pointer', color: currentPriority?.color || C.text2 }}
                  >
                    {priorityOptions.map((o) => (
                      <option key={o.value || 'none'} value={o.value || ''}>{o.symbol && `${o.symbol} `}{o.label}</option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => canEdit && setIsEditing(true)} disabled={!canEdit}
                    style={{ ...fieldBtn, justifyContent: 'center', background: currentPriority?.bg || C.bg2, border: `1px solid ${currentPriority?.border || C.border}`, color: currentPriority?.color || C.text3 }}
                  >
                    {currentPriority?.symbol && <span style={{ fontSize: '10px' }}>{currentPriority.symbol}</span>}
                    <span style={{ fontSize: '12px', fontWeight: 500 }}>{currentPriority?.label || t.card_priority_none}</span>
                  </button>
                )}
              </div>

              {/* Fecha inicio */}
              <div>
                <span style={{ fontSize: '10px', color: C.text4, display: 'block', marginBottom: '4px' }}>{t.card_section_start_date}</span>
                <div style={{ position: 'relative' }} ref={startCalendarRef}>
                  <button
                    type="button" disabled={!canEdit}
                    onClick={() => { if (!canEdit) return; setShowStartCalendar(!showStartCalendar); setShowCalendar(false); }}
                    style={{ ...fieldBtn, gap: '5px', color: editedStartDate ? C.text2 : C.text4 }}
                    onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                  >
                    <Calendar style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editedStartDate ? formatDate(editedStartDate) : t.card_start_date_none}
                    </span>
                  </button>
                  {showStartCalendar && (
                    <CustomCalendar value={editedStartDate} onChange={(v) => handleDateChange('startDate', v)} onClose={() => setShowStartCalendar(false)} />
                  )}
                </div>
              </div>

              {/* Fecha límite */}
              <div>
                <span style={{ fontSize: '10px', color: C.text4, display: 'block', marginBottom: '4px' }}>{t.card_section_due_date}</span>
                <div style={{ position: 'relative' }} ref={calendarRef}>
                  <button
                    type="button" disabled={!canEdit}
                    onClick={() => { if (!canEdit) return; setShowCalendar(!showCalendar); setShowStartCalendar(false); }}
                    style={{ ...fieldBtn, gap: '5px', color: editedDueDate ? C.text2 : C.text4 }}
                    onMouseEnter={(e) => { if (canEdit) (e.currentTarget as HTMLElement).style.borderColor = C.accent; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; }}
                  >
                    <Calendar style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                    <span style={{ fontSize: '12px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {editedDueDate ? formatDate(editedDueDate) : t.card_due_date_none}
                    </span>
                  </button>
                  {showCalendar && (
                    <CustomCalendar value={editedDueDate} onChange={(v) => handleDateChange('dueDate', v)} onClose={() => setShowCalendar(false)} />
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Separador */}
          <div style={{ height: '1px', background: C.border }} />

          {/* Sprint */}
          {boardSprints.length > 0 && (
            <>
              <div>
                <SectionLabel icon={<Zap style={{ width: '11px', height: '11px' }} />} label={t.card_section_sprint} />
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select
                    value={cardSprintId ?? ''}
                    onChange={(e) => handleSprintChange(e.target.value || null)}
                    disabled={!canEdit || sprintUpdating}
                    style={{ ...inputStyle, cursor: canEdit ? 'pointer' : 'default', color: cardSprintId ? C.accent : C.text3, opacity: !canEdit ? 0.6 : 1 }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                  >
                    <option value="">{t.card_sprint_none}</option>
                    {boardSprints.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  {cardSprintId && canEdit && (
                    <button onClick={() => handleSprintChange(null)} disabled={sprintUpdating}
                      style={{ width: '32px', height: '32px', borderRadius: '6px', background: 'transparent', border: `1px solid ${C.border}`, color: C.text3, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${C.red}50`; (e.currentTarget as HTMLElement).style.color = C.red; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.text3; }}
                    >
                      <X style={{ width: '12px', height: '12px' }} />
                    </button>
                  )}
                  {sprintUpdating && <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />}
                </div>
              </div>
              <div style={{ height: '1px', background: C.border }} />
            </>
          )}

          {/* Checklist */}
          <div>
            <CardChecklist cardId={selectedCard.id} onProgressChange={handleChecklistProgressChange} />
          </div>

          <div style={{ height: '1px', background: C.border }} />

          {/* Dependencias */}
          <div>
            <CardDependencies cardId={selectedCard.id} />
          </div>

          <div style={{ height: '1px', background: C.border }} />

          {/* Etiquetas & Miembros */}
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div>
                <SectionLabel icon={<Tag style={{ width: '11px', height: '11px' }} />} label={t.card_section_labels} />
                <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {currentWorkspaceId ? (
                    <LabelPicker workspaceId={currentWorkspaceId} cardId={selectedCard.id} assignedLabels={selectedCard.labels || []} onLabelAssigned={handleLabelAssigned} onLabelRemoved={handleLabelRemoved} />
                  ) : (
                    <p style={{ fontSize: '11px', color: C.text4 }}>{t.loading}</p>
                  )}
                </div>
              </div>
              <div>
                <SectionLabel icon={<UsersIcon style={{ width: '11px', height: '11px' }} />} label={t.card_section_members} />
                <div style={{ background: C.bg2, border: `1px solid ${C.border}`, borderRadius: '7px', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
                  {currentWorkspaceId ? (
                    canEdit ? (
                      <MemberPicker workspaceId={currentWorkspaceId} cardId={selectedCard.id} assignedMembers={selectedCard.members || []} onMemberAssigned={handleMemberAssigned} onMemberRemoved={handleMemberRemoved} />
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {selectedCard.members && selectedCard.members.length > 0 ? selectedCard.members.map((m: any) => (
                          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 8px', borderRadius: '6px', background: C.surface }}>
                            <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: `linear-gradient(135deg, ${C.accent}cc, ${C.accent}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                              {m.user?.name?.charAt(0).toUpperCase()}
                            </div>
                            <div style={{ minWidth: 0 }}>
                              <p style={{ fontSize: '12px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user?.name}</p>
                              <p style={{ fontSize: '10.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.user?.email}</p>
                            </div>
                          </div>
                        )) : (
                          <p style={{ fontSize: '11px', color: C.text4 }}>{t.card_members_none}</p>
                        )}
                      </div>
                    )
                  ) : <p style={{ fontSize: '11px', color: C.text4 }}>{t.loading}</p>}
                </div>
              </div>
            </div>
          </div>

          <div style={{ height: '1px', background: C.border }} />

          {/* Comentarios */}
          <div>
            <SectionLabel label={t.comments_section_title} />
            <CommentList cardId={selectedCard.id} maxHeight="380px" minHeight="260px" showForm={true} showCount={true} onCountChange={handleCommentCountChange} workspaceId={currentWorkspaceId || undefined} />
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '12px 20px', borderTop: `1px solid ${C.border}`, background: C.surface, display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          {canEdit && (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: 'transparent', border: `1px solid ${C.border}`, color: C.text3, cursor: 'pointer' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = `${C.red}50`; (e.currentTarget as HTMLElement).style.color = C.red; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.color = C.text3; }}
            >
              <Trash2 style={{ width: '12px', height: '12px' }} />
              {t.btn_delete}
            </button>
          )}
          <div style={{ flex: 1 }} />
          {isEditing && canEdit ? (
            <>
              <button
                onClick={() => { setIsEditing(false); setIsDescriptionFocused(false); setEditedTitle(selectedCard.title); setEditedDescription(selectedCard.description || ''); setEditedPriority(selectedCard.priority || null); setEditedStartDate(selectedCard.startDate || ''); setEditedDueDate(selectedCard.dueDate || ''); setShowStartCalendar(false); setShowCalendar(false); }}
                disabled={isUpdating}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}
              >
                {t.btn_cancel}
              </button>
              <button
                onClick={handleUpdate} disabled={isUpdating || !editedTitle.trim()}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer', opacity: !editedTitle.trim() ? 0.5 : 1 }}
              >
                <Save style={{ width: '12px', height: '12px' }} />
                {isUpdating ? t.card_btn_saving : t.btn_save}
              </button>
            </>
          ) : canEdit && (
            <button
              onClick={() => setIsEditing(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: C.accent, color: '#fff', border: 'none', cursor: 'pointer' }}
            >
              <Edit2 style={{ width: '12px', height: '12px' }} />
              {t.btn_edit}
            </button>
          )}
        </div>
      </motion.div>

      {/* Delete confirmation */}
      {showDeleteConfirm && canEdit && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 60, backdropFilter: 'blur(2px)' }} onClick={() => setShowDeleteConfirm(false)} />
          <div style={{ position: 'fixed', inset: 0, zIndex: 70, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
            <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '12px', maxWidth: '380px', width: '100%', padding: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: `${C.red}15`, border: `1px solid ${C.red}35`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Trash2 style={{ width: '14px', height: '14px', color: C.red }} />
                </div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>{t.card_delete_title}</h3>
              </div>
              <p style={{ fontSize: '12.5px', color: C.text3, lineHeight: 1.6, marginBottom: '18px' }}>
                {t.card_delete_desc(selectedCard.title)}
              </p>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={() => setShowDeleteConfirm(false)} disabled={isDeleting}
                  style={{ flex: 1, padding: '8px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>
                  {t.btn_cancel}
                </button>
                <button onClick={handleDelete} disabled={isDeleting}
                  style={{ flex: 1, padding: '8px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 600, background: C.red, color: '#fff', border: 'none', cursor: 'pointer', opacity: isDeleting ? 0.7 : 1 }}>
                  {isDeleting ? t.card_btn_deleting : t.btn_delete}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
