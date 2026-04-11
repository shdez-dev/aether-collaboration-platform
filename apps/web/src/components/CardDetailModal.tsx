// apps/web/src/components/CardDetailModal.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useBoardStore } from '@/stores/boardStore';
import { useTimelineStore } from '@/stores/timelineStore';
import { useTypingIndicator, useTypingListeners } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from './realtime/TypingIndicator';
import { MemberPicker } from './MemberPicker';
import { LabelPicker } from './LabelPicker';
import { CommentList } from './comments/CommentList';
import { X, Calendar, Flag, Tag, Users as UsersIcon, Zap } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';
import { CardChecklist } from './CardChecklist';
import { CardDependencies } from './CardDependencies';
import type { Sprint } from '@aether/types';
import { motion, PanInfo } from 'framer-motion';

function CustomCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (date: string) => void;
  onClose: () => void;
}) {
  const t = useT();

  // Parse ISO string using only the date part to avoid UTC midnight timezone shift
  const parseLocalDate = (iso: string) => {
    const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
    return new Date(y, m - 1, d);
  };

  // Store dates as noon UTC so the date never shifts across any timezone (±11h)
  const toNoonUTC = (y: number, m: number, d: number) =>
    `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T12:00:00.000Z`;

  const [currentDate, setCurrentDate] = useState(() => {
    if (value) return parseLocalDate(value);
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const selectedDate = value ? parseLocalDate(value) : null;

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleDateSelect = (day: number) => {
    onChange(toNoonUTC(year, month, day));
    onClose();
  };
  const handleToday = () => {
    const today = new Date();
    onChange(toNoonUTC(today.getFullYear(), today.getMonth(), today.getDate()));
    onClose();
  };
  const handleClear = () => {
    onChange('');
    onClose();
  };

  const isToday = (day: number) => {
    const today = new Date();
    return today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === month &&
      selectedDate.getFullYear() === year
    );
  };

  const calendarDays = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    calendarDays.push({ day: daysInPrevMonth - i, isCurrentMonth: false });
  }
  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({ day, isCurrentMonth: true });
  }
  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({ day, isCurrentMonth: false });
  }

  return (
    <div className="absolute right-0 top-full mt-2 bg-card border border-border shadow-xl z-50 p-4 w-72">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm font-semibold font-mono">
          {t.months_long[month]} {year}
        </span>
        <div className="flex gap-1">
          <button
            onClick={handlePrevMonth}
            className="p-1 hover:bg-surface transition-colors"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="15 18 9 12 15 6"></polyline>
            </svg>
          </button>
          <button
            onClick={handleNextMonth}
            className="p-1 hover:bg-surface transition-colors"
            type="button"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="9 18 15 12 9 6"></polyline>
            </svg>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 mb-2">
        {t.days_short.map((day) => (
          <div key={day} className="text-center text-xs text-text-muted font-mono">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => item.isCurrentMonth && handleDateSelect(item.day)}
            disabled={!item.isCurrentMonth}
            className={`
              aspect-square flex items-center justify-center text-xs font-mono transition-colors
              ${!item.isCurrentMonth ? 'text-text-muted/30' : 'text-text-primary hover:bg-surface'}
              ${isToday(item.day) && item.isCurrentMonth ? 'bg-accent/20 border border-accent' : ''}
              ${isSelected(item.day) && item.isCurrentMonth ? 'bg-accent text-white' : ''}
            `}
          >
            {item.day}
          </button>
        ))}
      </div>

      <div className="flex gap-2 mt-4 pt-3 border-t border-border">
        <button
          onClick={handleClear}
          className="flex-1 px-3 py-1.5 text-xs border border-border hover:bg-surface transition-colors"
          type="button"
        >
          {t.card_due_date_clear}
        </button>
        <button
          onClick={handleToday}
          className="flex-1 px-3 py-1.5 text-xs bg-accent text-white hover:bg-accent/80 transition-colors"
          type="button"
        >
          {t.card_due_date_today}
        </button>
      </div>
    </div>
  );
}

export function CardDetailModal() {
  const t = useT();
  const { selectedCard, setSelectedCard, updateCard, removeCard, currentWorkspaceId } =
    useCardStore();
  const { user } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { currentBoard } = useBoardStore();
  const invalidateTimeline = useTimelineStore((s) => s.invalidate);
  const userRole = currentWorkspace?.userRole;

  const priorityOptions = [
    {
      value: null,
      label: t.card_priority_none,
      color: 'text-text-muted',
      symbol: '',
      iconColor: 'text-text-muted',
    },
    {
      value: 'LOW',
      label: t.card_priority_low,
      color: 'text-success',
      symbol: '▼',
      iconColor: 'text-success',
    },
    {
      value: 'MEDIUM',
      label: t.card_priority_medium,
      color: 'text-warning',
      symbol: '■',
      iconColor: 'text-warning',
    },
    {
      value: 'HIGH',
      label: t.card_priority_high,
      color: 'text-error',
      symbol: '▲',
      iconColor: 'text-error',
    },
  ];

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedPriority, setEditedPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);
  const [editedStartDate, setEditedStartDate] = useState('');
  const [editedDueDate, setEditedDueDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showStartCalendar, setShowStartCalendar] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const [checklistProgress, setChecklistProgress] = useState<{ done: number; total: number }>({
    done: 0,
    total: 0,
  });

  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  // Memoizar los callbacks para evitar loops infinitos
  const handleCommentCountChange = useCallback((count: number) => {
    setCommentCount(count);
  }, []);

  const handleChecklistProgressChange = useCallback((done: number, total: number) => {
    setChecklistProgress({ done, total });
  }, []);

  // ── Sprint assignment ────────────────────────────────────────────────────
  const [boardSprints, setBoardSprints] = useState<Sprint[]>([]);
  const [cardSprintId, setCardSprintId] = useState<string | null>(null);
  const [sprintUpdating, setSprintUpdating] = useState(false);

  useTypingIndicator({
    cardId: selectedCard?.id || '',
    isTyping: isDescriptionFocused && isEditing,
    debounceMs: 500,
    disabled: !selectedCard,
  });

  const typingUsers = useTypingListeners(selectedCard?.id || '');
  const startCalendarRef = useRef<HTMLDivElement>(null);
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCard) {
      setEditedTitle(selectedCard.title);
      setEditedDescription(selectedCard.description || '');
      setEditedPriority(selectedCard.priority || null);
      setEditedStartDate(selectedCard.startDate || '');
      setEditedDueDate(selectedCard.dueDate || '');
      // Trigger animation
      setTimeout(() => setIsVisible(true), 10);
      // Agregar clase al body para prevenir scroll
      document.body.classList.add('card-detail-drawer-open');

      // ✅ REFRESCAR CARD COMPLETA DESDE EL SERVIDOR
      const fetchFreshCard = async () => {
        try {
          const response = await apiService.get<{ card: any }>(
            `/api/cards/${selectedCard.id}`,
            true
          );
          if (response.success && response.data) {
            setSelectedCard(response.data.card);
            updateCard(selectedCard.id, response.data.card);
          }
        } catch {
          // Error al refrescar card
        }
      };

      fetchFreshCard();
    } else {
      setIsVisible(false);
      document.body.classList.remove('card-detail-drawer-open');
    }

    return () => {
      document.body.classList.remove('card-detail-drawer-open');
    };
  }, [selectedCard?.id]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (startCalendarRef.current && !startCalendarRef.current.contains(event.target as Node)) {
        setShowStartCalendar(false);
      }
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showStartCalendar || showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showStartCalendar, showCalendar]);

  // Fetch board sprints when modal opens
  useEffect(() => {
    if (!selectedCard || !currentBoard?.id) return;
    const boardId = currentBoard.id;
    apiService.get<{ sprints: Sprint[] }>(`/api/boards/${boardId}/sprints`, true)
      .then((res) => {
        if (!res.success || !res.data) return;
        const sprints = res.data.sprints;
        setBoardSprints(sprints);
        const found = sprints.find((s) =>
          (s.cards ?? []).some((c: any) => c.id === selectedCard.id)
        );
        setCardSprintId(found?.id ?? null);
      })
      .catch(() => {});
  }, [selectedCard?.id, currentBoard?.id]);

  // ── Auto-save a single date field immediately ────────────────────────────
  const handleDateChange = async (field: 'startDate' | 'dueDate', value: string) => {
    if (!selectedCard) return;
    // Update local state immediately
    if (field === 'startDate') setEditedStartDate(value);
    else setEditedDueDate(value);

    try {
      const response = await apiService.put<{ card: any }>(
        `/api/cards/${selectedCard.id}`,
        { [field]: value || null },
        true
      );
      if (response.success && response.data) {
        updateCard(selectedCard.id, response.data.card);
        setSelectedCard(response.data.card);
      }
    } catch {
      // Error saving date
    }
  };

  const handleSprintChange = async (newSprintId: string | null) => {
    if (!selectedCard || sprintUpdating) return;
    setSprintUpdating(true);
    try {
      if (cardSprintId) {
        await apiService.delete(`/api/sprints/${cardSprintId}/cards/${selectedCard.id}`, true);
      }
      if (newSprintId) {
        await apiService.post(`/api/sprints/${newSprintId}/cards`, { cardId: selectedCard.id }, true);
      }
      setCardSprintId(newSprintId);
      invalidateTimeline();
    } catch {
      // Error updating sprint
    } finally {
      setSprintUpdating(false);
    }
  };

  if (!selectedCard) return null;

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(() => {
      setSelectedCard(null);
      setIsEditing(false);
      setShowDeleteConfirm(false);
      setShowStartCalendar(false);
      setShowCalendar(false);
      setIsDescriptionFocused(false);
    }, 300);
  };

  const handleUpdate = async () => {
    if (!canEdit || !editedTitle.trim()) return;

    setIsUpdating(true);

    try {
      const updates: any = {};
      if (editedTitle !== selectedCard.title) updates.title = editedTitle;
      if (editedDescription !== (selectedCard.description || ''))
        updates.description = editedDescription || null;
      if (editedPriority !== selectedCard.priority) updates.priority = editedPriority;
      // Dates are auto-saved on pick; skip them here to avoid overwriting with stale state

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        setIsUpdating(false);
        return;
      }

      const response = await apiService.put<{ card: any }>(
        `/api/cards/${selectedCard.id}`,
        updates,
        true
      );

      if (!response.success) throw new Error(response.error?.message || 'Error al actualizar');

      updateCard(selectedCard.id, response.data!.card);
      setSelectedCard(response.data!.card);
      setIsEditing(false);
      setIsDescriptionFocused(false);
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setIsDeleting(true);

    try {
      const response = await apiService.delete(`/api/cards/${selectedCard.id}`, true);

      if (!response.success) throw new Error(response.error?.message || 'Error al eliminar');

      removeCard(selectedCard.id, selectedCard.listId);
      handleClose();
    } catch (error: any) {
      alert(`Error: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMemberAssigned = (member: any) => {
    const updatedMembers = [...(selectedCard.members || []), member];
    updateCard(selectedCard.id, { members: updatedMembers });
    setSelectedCard({ ...selectedCard, members: updatedMembers });
  };

  const handleMemberRemoved = (memberId: string) => {
    const updatedMembers = (selectedCard.members || []).filter((m) => m.id !== memberId);
    updateCard(selectedCard.id, { members: updatedMembers });
    setSelectedCard({ ...selectedCard, members: updatedMembers });
  };

  const handleLabelAssigned = (label: any) => {
    const updatedLabels = [...(selectedCard.labels || []), label];
    updateCard(selectedCard.id, { labels: updatedLabels });
    setSelectedCard({ ...selectedCard, labels: updatedLabels });
  };

  const handleLabelRemoved = (labelId: string) => {
    const updatedLabels = (selectedCard.labels || []).filter((l) => l.id !== labelId);
    updateCard(selectedCard.id, { labels: updatedLabels });
    setSelectedCard({ ...selectedCard, labels: updatedLabels });
  };

  const formatDate = (dateString: string) =>
    formatShort(dateString, user?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone, user?.language as 'es' | 'en');

  const currentPriority = priorityOptions.find((p) => p.value === editedPriority);

  return (
    <>
      {/* OVERLAY - Bloquea interacción y cierra al hacer clic */}
      <div
        className={`fixed inset-0 bg-transparent z-40 transition-opacity duration-300 ${
          isVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* SIDEBAR DRAWER - Mobile: Full screen with swipe, Desktop: Drawer 600px */}
      <motion.div
        drag={window.innerWidth < 640 ? 'x' : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.2}
        onDragEnd={(e, info: PanInfo) => {
          // Close if dragged right more than 100px or velocity > 500
          if (info.offset.x > 100 || info.velocity.x > 500) {
            handleClose();
          }
        }}
        initial={{ x: '100%' }}
        animate={{ x: isVisible ? 0 : '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed top-0 right-0 h-full w-full sm:w-[600px] bg-card border-l border-border shadow-2xl z-50"
      >
        <div className="flex flex-col h-full">
          {/* HEADER - Responsive padding */}
          <div className="border-b border-border px-4 sm:px-6 py-4 sm:py-5">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div className="flex-1 min-w-0">
                {isEditing && canEdit ? (
                  <input
                    type="text"
                    value={editedTitle}
                    onChange={(e) => setEditedTitle(e.target.value)}
                    className="w-full text-xl font-semibold bg-transparent border-b border-accent focus:outline-none pb-2 font-mono"
                    autoFocus
                    maxLength={255}
                  />
                ) : (
                  <h2 className="text-xl font-semibold text-text-primary font-mono">
                    {selectedCard.title}
                  </h2>
                )}
              </div>
              <button
                onClick={handleClose}
                className="p-2 hover:bg-surface border border-transparent hover:border-border transition-all touch-manipulation min-h-[44px] min-w-[44px] flex items-center justify-center"
                aria-label={t.btn_close}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-text-muted font-mono">
              {t.card_created(formatDate(selectedCard.createdAt))}
              {selectedCard.updatedAt !== selectedCard.createdAt &&
                ` • ${t.card_updated(formatDate(selectedCard.updatedAt))}`}
            </p>
          </div>

          {/* BODY - SCROLLABLE - Responsive padding */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 sm:space-y-8 custom-scrollbar">
            {/* DESCRIPCIÓN */}
            <section className="pb-6 border-b border-border/50">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs sm:text-xs sm:text-sm font-bold text-text-primary font-mono tracking-wider uppercase">
                  {t.card_section_description}
                </h3>
                {typingUsers.length > 0 && (
                  <TypingIndicator typingUsers={typingUsers} position="inline" size="sm" />
                )}
              </div>

              {isEditing && canEdit ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onFocus={() => setIsDescriptionFocused(true)}
                  onBlur={() => setIsDescriptionFocused(false)}
                  placeholder={t.card_placeholder_description}
                  rows={5}
                  className="w-full p-3 bg-surface border border-border text-sm font-mono resize-none focus:outline-none focus:border-accent transition-colors"
                />
              ) : (
                <div
                  onClick={() => canEdit && setIsEditing(true)}
                  className={`p-3 bg-surface border border-border min-h-[100px] ${
                    canEdit ? 'cursor-pointer hover:border-accent' : 'cursor-default'
                  } transition-colors`}
                >
                  {selectedCard.description ? (
                    <p className="text-sm text-text-primary font-mono whitespace-pre-wrap">
                      {selectedCard.description}
                    </p>
                  ) : (
                    <p className="text-sm text-text-muted font-mono italic">
                      {canEdit ? t.card_click_add_description : t.card_no_description}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* CHECKLIST / SUBTAREAS */}
            <section className="pb-6 border-b border-border/50">
              <CardChecklist
                cardId={selectedCard.id}
                onProgressChange={handleChecklistProgressChange}
              />
            </section>

            {/* DEPENDENCIAS */}
            <section className="pb-6 border-b border-border/50">
              <CardDependencies cardId={selectedCard.id} />
            </section>

            {/* PRIORIDAD Y FECHAS */}
            <section className="pb-6 border-b border-border/50 space-y-4">
              <h3 className="text-xs sm:text-sm font-bold text-text-primary font-mono tracking-wider uppercase">
                {t.card_section_priority} & {t.card_section_due_date}
              </h3>

              {/* Prioridad */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flag className={`w-4 h-4 ${currentPriority?.iconColor || 'text-text-muted'}`} />
                  <label className="text-xs font-semibold text-text-muted font-mono">
                    {t.card_section_priority}
                  </label>
                </div>

                {isEditing && canEdit ? (
                  <select
                    value={editedPriority || ''}
                    onChange={(e) =>
                      setEditedPriority(
                        (e.target.value || null) as 'LOW' | 'MEDIUM' | 'HIGH' | null
                      )
                    }
                    className="w-full p-2 bg-surface border border-border text-sm font-mono focus:outline-none focus:border-accent"
                  >
                    {priorityOptions.map((option) => (
                      <option key={option.value || 'none'} value={option.value || ''}>
                        {option.symbol && `${option.symbol} `}
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <button
                    onClick={() => canEdit && setIsEditing(true)}
                    disabled={!canEdit}
                    className={`w-full p-2 bg-surface border border-border text-sm font-mono flex items-center justify-center gap-2 ${
                      canEdit ? 'hover:border-accent' : ''
                    } transition-colors`}
                  >
                    {currentPriority?.symbol && (
                      <span className={currentPriority.color}>{currentPriority.symbol}</span>
                    )}
                    <span className={currentPriority?.color || 'text-text-muted'}>
                      {currentPriority?.label || t.card_priority_none}
                    </span>
                  </button>
                )}
              </div>

              {/* Fechas: Start Date y Due Date en la misma fila */}
              <div className="grid grid-cols-2 gap-4">
                {/* Fecha de inicio */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <label className="text-xs font-semibold text-text-muted font-mono">
                      {t.card_section_start_date}
                    </label>
                  </div>
                  <div className="relative" ref={startCalendarRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return;
                        setShowStartCalendar(!showStartCalendar);
                        setShowCalendar(false);
                      }}
                      disabled={!canEdit}
                      className={`w-full p-2 bg-surface border border-border text-sm font-mono ${
                        canEdit ? 'hover:border-accent' : ''
                      } transition-colors text-left`}
                    >
                      {editedStartDate ? formatDate(editedStartDate) : t.card_start_date_none}
                    </button>
                    {showStartCalendar && (
                      <CustomCalendar
                        value={editedStartDate}
                        onChange={(v) => handleDateChange('startDate', v)}
                        onClose={() => setShowStartCalendar(false)}
                      />
                    )}
                  </div>
                </div>

                {/* Fecha límite */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-text-muted" />
                    <label className="text-xs font-semibold text-text-muted font-mono">
                      {t.card_section_due_date}
                    </label>
                  </div>
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => {
                        if (!canEdit) return;
                        setShowCalendar(!showCalendar);
                        setShowStartCalendar(false);
                      }}
                      disabled={!canEdit}
                      className={`w-full p-2 bg-surface border border-border text-sm font-mono ${
                        canEdit ? 'hover:border-accent' : ''
                      } transition-colors text-left`}
                    >
                      {editedDueDate ? formatDate(editedDueDate) : t.card_due_date_none}
                    </button>
                    {showCalendar && (
                      <CustomCalendar
                        value={editedDueDate}
                        onChange={(v) => handleDateChange('dueDate', v)}
                        onClose={() => setShowCalendar(false)}
                      />
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* SPRINT */}
            {boardSprints.length > 0 && (
              <section className="pb-6 border-b border-border/50">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-accent" />
                  <h3 className="text-xs sm:text-sm font-bold text-text-primary font-mono tracking-wider uppercase">
                    {t.card_section_sprint}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={cardSprintId ?? ''}
                    onChange={(e) => handleSprintChange(e.target.value || null)}
                    disabled={!canEdit || sprintUpdating}
                    className={`flex-1 p-2 bg-surface border border-border text-sm font-mono focus:outline-none focus:border-accent transition-colors ${
                      !canEdit ? 'opacity-60 cursor-default' : 'hover:border-accent cursor-pointer'
                    } ${cardSprintId ? 'text-accent' : 'text-text-muted'}`}
                  >
                    <option value="">{t.card_sprint_none}</option>
                    {boardSprints.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  {cardSprintId && canEdit && (
                    <button
                      onClick={() => handleSprintChange(null)}
                      disabled={sprintUpdating}
                      className="p-2 text-text-muted hover:text-error border border-border hover:border-error/50 transition-colors"
                      title={t.card_sprint_remove}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                  {sprintUpdating && (
                    <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin flex-shrink-0" />
                  )}
                </div>
              </section>
            )}

            {/* ETIQUETAS Y MIEMBROS */}
            <section className="pb-6 border-b border-border/50">
              <h3 className="text-xs sm:text-sm font-bold text-text-primary font-mono tracking-wider uppercase mb-4">
                {t.card_section_labels} & {t.card_section_members}
              </h3>
              <div className="grid grid-cols-2 gap-4">
                {/* Etiquetas */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Tag className="w-4 h-4 text-text-muted" />
                    <label className="text-xs font-semibold text-text-muted font-mono">
                      {t.card_section_labels}
                    </label>
                  </div>
                  <div className="bg-surface border border-border p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {currentWorkspaceId ? (
                      <LabelPicker
                        workspaceId={currentWorkspaceId}
                        cardId={selectedCard.id}
                        assignedLabels={selectedCard.labels || []}
                        onLabelAssigned={handleLabelAssigned}
                        onLabelRemoved={handleLabelRemoved}
                      />
                    ) : (
                      <p className="text-xs text-text-muted font-mono">{t.loading}</p>
                    )}
                  </div>
                </div>

                {/* Members */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <UsersIcon className="w-4 h-4 text-text-muted" />
                    <label className="text-xs font-semibold text-text-muted font-mono">
                      {t.card_section_members}
                    </label>
                  </div>
                  <div className="bg-surface border border-border p-3 max-h-[200px] overflow-y-auto custom-scrollbar">
                    {currentWorkspaceId ? (
                      canEdit ? (
                        <MemberPicker
                          workspaceId={currentWorkspaceId}
                          cardId={selectedCard.id}
                          assignedMembers={selectedCard.members || []}
                          onMemberAssigned={handleMemberAssigned}
                          onMemberRemoved={handleMemberRemoved}
                        />
                      ) : (
                        <div className="space-y-2">
                          {selectedCard.members && selectedCard.members.length > 0 ? (
                            selectedCard.members.map((member: any) => (
                              <div
                                key={member.id}
                                className="flex items-center gap-2 p-2 bg-background border border-border"
                              >
                                <div className="w-8 h-8 bg-accent/20 flex items-center justify-center border border-accent/30">
                                  <span className="text-accent text-xs font-bold">
                                    {member.user?.name?.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">
                                    {member.user?.name}
                                  </p>
                                  <p className="text-xs text-text-muted truncate">
                                    {member.user?.email}
                                  </p>
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-text-muted font-mono">
                              {t.card_members_none}
                            </p>
                          )}
                        </div>
                      )
                    ) : (
                      <p className="text-xs text-text-muted font-mono">{t.loading}</p>
                    )}
                  </div>
                </div>
              </div>
            </section>

            {/* COMENTARIOS */}
            <section>
              <h3 className="text-xs sm:text-sm font-bold text-text-primary font-mono tracking-wider uppercase mb-4">
                {t.comments_section_title}
              </h3>
              <CommentList
                cardId={selectedCard.id}
                maxHeight="400px"
                minHeight="300px"
                showForm={true}
                showCount={true}
                onCountChange={handleCommentCountChange}
                workspaceId={currentWorkspaceId || undefined}
              />
            </section>
          </div>

          {/* FOOTER */}
          <div className="border-t border-border p-6 flex items-center justify-between">
            {canEdit && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="px-4 py-2 border border-error/30 bg-error/10 text-error hover:bg-error hover:text-white transition-all text-sm font-medium"
              >
                {t.btn_delete}
              </button>
            )}

            <div className="flex gap-2 ml-auto">
              {isEditing && canEdit ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setIsDescriptionFocused(false);
                      setEditedTitle(selectedCard.title);
                      setEditedDescription(selectedCard.description || '');
                      setEditedPriority(selectedCard.priority || null);
                      setEditedStartDate(selectedCard.startDate || '');
                      setEditedDueDate(selectedCard.dueDate || '');
                      setShowStartCalendar(false);
                      setShowCalendar(false);
                    }}
                    disabled={isUpdating}
                    className="px-4 py-2 border border-border hover:bg-surface transition-colors text-sm font-medium"
                  >
                    {t.btn_cancel}
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating || !editedTitle.trim()}
                    className="px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isUpdating ? t.card_btn_saving : t.btn_save}
                  </button>
                </>
              ) : (
                canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors text-sm font-medium"
                  >
                    {t.btn_edit}
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-card border border-error max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-2 font-mono">{t.card_delete_title}</h3>
              <p className="text-sm text-text-secondary mb-4 font-mono">
                {t.card_delete_desc(selectedCard.title)}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-border hover:bg-surface transition-colors"
                >
                  {t.btn_cancel}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-error text-white hover:bg-error/80 transition-colors"
                >
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
