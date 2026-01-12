// apps/web/src/components/CardDetailModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useTypingIndicator, useTypingListeners } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from './realtime/TypingIndicator';
import { MemberPicker } from './MemberPicker';
import { LabelPicker } from './LabelPicker';
import '../styles/card-detail-modal.css';

const priorityOptions = [
  { value: null, label: 'No priority', color: 'text-text-muted', symbol: '' },
  { value: 'LOW', label: 'Low', color: 'text-success', symbol: '▼' },
  { value: 'MEDIUM', label: 'Medium', color: 'text-warning', symbol: '■' },
  { value: 'HIGH', label: 'High', color: 'text-error', symbol: '▲' },
];

const DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

function CustomCalendar({
  value,
  onChange,
  onClose,
}: {
  value: string;
  onChange: (date: string) => void;
  onClose: () => void;
}) {
  const [currentDate, setCurrentDate] = useState(() => {
    if (value) {
      return new Date(value);
    }
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const selectedDate = value ? new Date(value) : null;

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleDateSelect = (day: number) => {
    const selected = new Date(year, month, day);
    onChange(selected.toISOString());
    onClose();
  };

  const handleToday = () => {
    const today = new Date();
    onChange(today.toISOString());
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
    calendarDays.push({
      day: daysInPrevMonth - i,
      isCurrentMonth: false,
      isPrevMonth: true,
    });
  }

  for (let day = 1; day <= daysInMonth; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: true,
      isPrevMonth: false,
    });
  }

  const remainingDays = 42 - calendarDays.length;
  for (let day = 1; day <= remainingDays; day++) {
    calendarDays.push({
      day,
      isCurrentMonth: false,
      isPrevMonth: false,
    });
  }

  return (
    <div className="custom-calendar">
      <div className="calendar-header">
        <span className="calendar-month-year">
          {MONTHS[month]} {year}
        </span>
        <div className="calendar-nav">
          <button onClick={handlePrevMonth} className="calendar-nav-btn" type="button">
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
          <button onClick={handleNextMonth} className="calendar-nav-btn" type="button">
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

      <div className="calendar-weekdays">
        {DAYS.map((day) => (
          <div key={day} className="calendar-weekday">
            {day}
          </div>
        ))}
      </div>

      <div className="calendar-grid">
        {calendarDays.map((item, idx) => (
          <button
            key={idx}
            type="button"
            onClick={() => item.isCurrentMonth && handleDateSelect(item.day)}
            disabled={!item.isCurrentMonth}
            className={`
              calendar-day
              ${!item.isCurrentMonth ? 'calendar-day-other' : ''}
              ${isToday(item.day) && item.isCurrentMonth ? 'calendar-day-today' : ''}
              ${isSelected(item.day) && item.isCurrentMonth ? 'calendar-day-selected' : ''}
            `}
          >
            {item.day}
          </button>
        ))}
      </div>

      <div className="calendar-footer">
        <button onClick={handleClear} className="calendar-btn-clear" type="button">
          Clear
        </button>
        <button onClick={handleToday} className="calendar-btn-today" type="button">
          Today
        </button>
      </div>
    </div>
  );
}

export function CardDetailModal() {
  const { selectedCard, setSelectedCard, updateCard, removeCard, currentWorkspaceId } =
    useCardStore();
  const { accessToken } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedPriority, setEditedPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);
  const [editedDueDate, setEditedDueDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);

  // ==================== TYPING INDICATOR ====================
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  // Detectar cuando YO estoy escribiendo
  useTypingIndicator({
    cardId: selectedCard?.id || '',
    isTyping: isDescriptionFocused && isEditing,
    debounceMs: 500,
    disabled: !selectedCard,
  });

  // Escuchar cuando OTROS están escribiendo
  const typingUsers = useTypingListeners(selectedCard?.id || '');

  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCard) {
      setEditedTitle(selectedCard.title);
      setEditedDescription(selectedCard.description || '');
      setEditedPriority(selectedCard.priority || null);
      setEditedDueDate(selectedCard.dueDate || '');
    }
  }, [selectedCard]);

  useEffect(() => {
    if (selectedCard) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [selectedCard]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
        setShowCalendar(false);
      }
    };

    if (showCalendar) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showCalendar]);

  if (!selectedCard) return null;

  const handleClose = () => {
    setSelectedCard(null);
    setIsEditing(false);
    setShowDeleteConfirm(false);
    setShowCalendar(false);
    setIsDescriptionFocused(false);
  };

  const handleUpdate = async () => {
    if (!editedTitle.trim()) {
      alert('Title cannot be empty');
      return;
    }

    setIsUpdating(true);

    try {
      const updates: any = {};

      if (editedTitle !== selectedCard.title) updates.title = editedTitle;
      if (editedDescription !== (selectedCard.description || ''))
        updates.description = editedDescription || null;
      if (editedPriority !== selectedCard.priority) updates.priority = editedPriority;
      if (editedDueDate !== (selectedCard.dueDate || '')) updates.dueDate = editedDueDate || null;

      if (Object.keys(updates).length === 0) {
        setIsEditing(false);
        setIsUpdating(false);
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${selectedCard.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(updates),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to update card');
      }

      const { data } = await response.json();
      updateCard(selectedCard.id, data.card);
      setSelectedCard(data.card);
      setIsEditing(false);
      setIsDescriptionFocused(false);
    } catch (error: any) {
      console.error('Error updating card:', error);
      alert(`Failed to update card: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${selectedCard.id}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error?.message || 'Failed to delete card');
      }

      removeCard(selectedCard.id, selectedCard.listId);
      handleClose();
    } catch (error: any) {
      console.error('Error deleting card:', error);
      alert(`Failed to delete card: ${error.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleMemberAssigned = (member: any) => {
    const updatedMembers = [...(selectedCard.members || []), member];
    const updatedCard = { ...selectedCard, members: updatedMembers };
    updateCard(selectedCard.id, { members: updatedMembers });
    setSelectedCard(updatedCard);
  };

  const handleMemberRemoved = (memberId: string) => {
    const updatedMembers = (selectedCard.members || []).filter((m) => m.id !== memberId);
    const updatedCard = { ...selectedCard, members: updatedMembers };
    updateCard(selectedCard.id, { members: updatedMembers });
    setSelectedCard(updatedCard);
  };

  const handleLabelAssigned = (label: any) => {
    const updatedLabels = [...(selectedCard.labels || []), label];
    const updatedCard = { ...selectedCard, labels: updatedLabels };
    updateCard(selectedCard.id, { labels: updatedLabels });
    setSelectedCard(updatedCard);
  };

  const handleLabelRemoved = (labelId: string) => {
    const updatedLabels = (selectedCard.labels || []).filter((l) => l.id !== labelId);
    const updatedCard = { ...selectedCard, labels: updatedLabels };
    updateCard(selectedCard.id, { labels: updatedLabels });
    setSelectedCard(updatedCard);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const currentPriority = priorityOptions.find((p) => p.value === editedPriority);

  return (
    <>
      <div className="modal-backdrop" onClick={handleClose} />

      <div className="modal-container">
        {/* Main Modal Content */}
        <div className="modal-content">
          {/* Header */}
          <div className="modal-header">
            <div className="modal-title-section">
              {isEditing ? (
                <input
                  type="text"
                  value={editedTitle}
                  onChange={(e) => setEditedTitle(e.target.value)}
                  className="input-terminal w-full text-lg"
                  autoFocus
                  maxLength={255}
                />
              ) : (
                <h2 className="modal-title">{selectedCard.title}</h2>
              )}
              <p className="modal-subtitle">
                Created {formatDate(selectedCard.createdAt)}
                {selectedCard.updatedAt !== selectedCard.createdAt &&
                  ` • Updated ${formatDate(selectedCard.updatedAt)}`}
              </p>
            </div>
            <button onClick={handleClose} className="modal-close" aria-label="Close">
              ×
            </button>
          </div>

          {/* Main Content */}
          <div className="modal-body">
            {/* Description */}
            <div className="modal-section">
              <div className="flex items-center justify-between mb-2">
                <h3 className="modal-section-title">DESCRIPTION</h3>

                {/* Typing Indicator */}
                {typingUsers.length > 0 && (
                  <TypingIndicator typingUsers={typingUsers} position="inline" size="sm" />
                )}
              </div>

              {isEditing ? (
                <textarea
                  value={editedDescription}
                  onChange={(e) => setEditedDescription(e.target.value)}
                  onFocus={() => setIsDescriptionFocused(true)}
                  onBlur={() => setIsDescriptionFocused(false)}
                  placeholder="Add a description..."
                  rows={4}
                  className="input-terminal w-full text-sm resize-none"
                />
              ) : (
                <div onClick={() => setIsEditing(true)} className="description-box">
                  {selectedCard.description ? (
                    <p className="description-text">{selectedCard.description}</p>
                  ) : (
                    <p className="description-placeholder">Click to add a description...</p>
                  )}
                </div>
              )}
            </div>

            {/* Priority & Due Date */}
            <div className="modal-section">
              <div className="grid grid-cols-2 gap-3">
                {/* Priority */}
                <div>
                  <h3 className="modal-section-title">PRIORITY</h3>
                  {isEditing ? (
                    <select
                      value={editedPriority || ''}
                      onChange={(e) =>
                        setEditedPriority(
                          (e.target.value || null) as 'LOW' | 'MEDIUM' | 'HIGH' | null
                        )
                      }
                      className="input-terminal w-full text-sm"
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
                      onClick={() => setIsEditing(true)}
                      className="info-button w-full justify-center"
                    >
                      {currentPriority?.symbol && (
                        <span className={currentPriority.color}>{currentPriority.symbol}</span>
                      )}
                      <span className={currentPriority?.color || 'text-text-muted'}>
                        {currentPriority?.label || 'No priority'}
                      </span>
                    </button>
                  )}
                </div>

                {/* Due Date */}
                <div>
                  <h3 className="modal-section-title">DUE DATE</h3>
                  {isEditing ? (
                    <div className="relative" ref={calendarRef}>
                      <button
                        type="button"
                        onClick={() => setShowCalendar(!showCalendar)}
                        className="date-input-button"
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                          <line x1="16" y1="2" x2="16" y2="6"></line>
                          <line x1="8" y1="2" x2="8" y2="6"></line>
                          <line x1="3" y1="10" x2="21" y2="10"></line>
                        </svg>
                        <span>{editedDueDate ? formatDate(editedDueDate) : 'Select date'}</span>
                      </button>

                      {showCalendar && (
                        <CustomCalendar
                          value={editedDueDate}
                          onChange={setEditedDueDate}
                          onClose={() => setShowCalendar(false)}
                        />
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => setIsEditing(true)}
                      className="info-button w-full justify-center"
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect>
                        <line x1="16" y1="2" x2="16" y2="6"></line>
                        <line x1="8" y1="2" x2="8" y2="6"></line>
                        <line x1="3" y1="10" x2="21" y2="10"></line>
                      </svg>
                      <span>
                        {selectedCard.dueDate ? formatDate(selectedCard.dueDate) : 'No due date'}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Comments */}
            <div className="modal-section">
              <h3 className="modal-section-title">COMMENTS</h3>
              <div className="p-3 bg-surface rounded-terminal border border-border text-center">
                <p className="text-xs text-text-muted font-mono">Comments coming in Milestone 6</p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer">
            <button onClick={() => setShowDeleteConfirm(true)} className="btn-delete">
              Delete Card
            </button>

            <div className="flex gap-2">
              {isEditing ? (
                <>
                  <button
                    onClick={() => {
                      setIsEditing(false);
                      setIsDescriptionFocused(false);
                      setEditedTitle(selectedCard.title);
                      setEditedDescription(selectedCard.description || '');
                      setEditedPriority(selectedCard.priority || null);
                      setEditedDueDate(selectedCard.dueDate || '');
                      setShowCalendar(false);
                    }}
                    disabled={isUpdating}
                    className="btn-cancel"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating || !editedTitle.trim()}
                    className="btn-save"
                  >
                    {isUpdating ? 'Saving...' : 'Save'}
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)} className="btn-edit">
                  Edit Card
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar Container */}
        <div className="modal-sidebars-container">
          {/* Labels Sidebar */}
          <div className="modal-sidebar modal-sidebar-labels">
            <h3 className="sidebar-section-title">LABELS</h3>
            {currentWorkspaceId ? (
              <LabelPicker
                workspaceId={currentWorkspaceId}
                cardId={selectedCard.id}
                assignedLabels={selectedCard.labels || []}
                onLabelAssigned={handleLabelAssigned}
                onLabelRemoved={handleLabelRemoved}
              />
            ) : (
              <p className="text-xs text-text-muted font-mono">Loading...</p>
            )}
          </div>

          {/* Members Sidebar */}
          <div className="modal-sidebar modal-sidebar-members">
            <h3 className="sidebar-section-title">MEMBERS</h3>
            {currentWorkspaceId ? (
              <MemberPicker
                workspaceId={currentWorkspaceId}
                cardId={selectedCard.id}
                assignedMembers={selectedCard.members || []}
                onMemberAssigned={handleMemberAssigned}
                onMemberRemoved={handleMemberRemoved}
              />
            ) : (
              <p className="text-xs text-text-muted font-mono">Loading...</p>
            )}
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && (
        <>
          <div className="modal-backdrop-dark" onClick={() => setShowDeleteConfirm(false)} />
          <div className="delete-modal-container">
            <div className="delete-modal">
              <h3 className="text-lg mb-2 font-mono">Delete Card?</h3>
              <p className="text-text-secondary mb-4 text-sm font-mono">
                Are you sure you want to delete "<strong>{selectedCard.title}</strong>"? This action
                cannot be undone.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="btn-cancel flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="btn-confirm-delete flex-1"
                >
                  {isDeleting ? 'Deleting...' : 'Delete'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
