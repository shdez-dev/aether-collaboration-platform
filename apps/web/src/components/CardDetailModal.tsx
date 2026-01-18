// apps/web/src/components/CardDetailModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useCardStore } from '@/stores/cardStore';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useTypingIndicator, useTypingListeners } from '@/hooks/useTypingIndicator';
import { TypingIndicator } from './realtime/TypingIndicator';
import { MemberPicker } from './MemberPicker';
import { LabelPicker } from './LabelPicker';
import { CommentList } from './comments/CommentList';
import { X, Calendar, Flag, Tag, Users as UsersIcon } from 'lucide-react';

const priorityOptions = [
  {
    value: null,
    label: 'Sin prioridad',
    color: 'text-text-muted',
    symbol: '',
    iconColor: 'text-text-muted',
  },
  { value: 'LOW', label: 'Baja', color: 'text-success', symbol: '▼', iconColor: 'text-success' },
  {
    value: 'MEDIUM',
    label: 'Media',
    color: 'text-warning',
    symbol: '■',
    iconColor: 'text-warning',
  },
  { value: 'HIGH', label: 'Alta', color: 'text-error', symbol: '▲', iconColor: 'text-error' },
];

const DAYS = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sa'];
const MONTHS = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
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
    if (value) return new Date(value);
    return new Date();
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  const selectedDate = value ? new Date(value) : null;

  const handlePrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const handleNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const handleDateSelect = (day: number) => {
    const selected = new Date(year, month, day);
    onChange(selected.toISOString());
    onClose();
  };
  const handleToday = () => {
    onChange(new Date().toISOString());
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
          {MONTHS[month]} {year}
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
        {DAYS.map((day) => (
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
          Limpiar
        </button>
        <button
          onClick={handleToday}
          className="flex-1 px-3 py-1.5 text-xs bg-accent text-white hover:bg-accent/80 transition-colors"
          type="button"
        >
          Hoy
        </button>
      </div>
    </div>
  );
}

export function CardDetailModal() {
  const { selectedCard, setSelectedCard, updateCard, removeCard, currentWorkspaceId } =
    useCardStore();
  const { accessToken } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const [isEditing, setIsEditing] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [editedDescription, setEditedDescription] = useState('');
  const [editedPriority, setEditedPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | null>(null);
  const [editedDueDate, setEditedDueDate] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [isVisible, setIsVisible] = useState(false);

  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';
  const [isDescriptionFocused, setIsDescriptionFocused] = useState(false);

  useTypingIndicator({
    cardId: selectedCard?.id || '',
    isTyping: isDescriptionFocused && isEditing,
    debounceMs: 500,
    disabled: !selectedCard,
  });

  const typingUsers = useTypingListeners(selectedCard?.id || '');
  const calendarRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (selectedCard) {
      setEditedTitle(selectedCard.title);
      setEditedDescription(selectedCard.description || '');
      setEditedPriority(selectedCard.priority || null);
      setEditedDueDate(selectedCard.dueDate || '');
      // Trigger animation
      setTimeout(() => setIsVisible(true), 10);
      // Agregar clase al body para prevenir scroll
      document.body.classList.add('card-detail-drawer-open');

      // ✅ REFRESCAR CARD COMPLETA DESDE EL SERVIDOR
      const fetchFreshCard = async () => {
        try {
          const response = await fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${selectedCard.id}`,
            {
              headers: {
                Authorization: `Bearer ${accessToken}`,
              },
            }
          );

          if (response.ok) {
            const { data } = await response.json();
            // Actualizar card con datos frescos del servidor
            setSelectedCard(data.card);
            updateCard(selectedCard.id, data.card);
          }
        } catch (error) {
          console.error('❌ Error al refrescar card:', error);
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
  }, [selectedCard?.id, accessToken]);

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
    setIsVisible(false);
    setTimeout(() => {
      setSelectedCard(null);
      setIsEditing(false);
      setShowDeleteConfirm(false);
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

      if (!response.ok) throw new Error('Error al actualizar');

      const { data } = await response.json();
      updateCard(selectedCard.id, data.card);
      setSelectedCard(data.card);
      setIsEditing(false);
      setIsDescriptionFocused(false);
    } catch (error: any) {
      console.error('Error:', error);
      alert(`Error: ${error.message}`);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    setIsDeleting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${selectedCard.id}`,
        { method: 'DELETE', headers: { Authorization: `Bearer ${accessToken}` } }
      );

      if (!response.ok) throw new Error('Error al eliminar');

      removeCard(selectedCard.id, selectedCard.listId);
      handleClose();
    } catch (error: any) {
      console.error('Error:', error);
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getDate()} ${MONTHS[date.getMonth()]}, ${date.getFullYear()}`;
  };

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

      {/* SIDEBAR DRAWER - Animación de derecha a izquierda */}
      <div
        className={`fixed top-0 right-0 h-full w-[600px] bg-card border-l border-border shadow-2xl z-50 transform transition-transform duration-300 ease-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* HEADER */}
          <div className="border-b border-border px-6 py-5">
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
                className="p-2 hover:bg-surface border border-transparent hover:border-border transition-all"
                aria-label="Cerrar"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-xs text-text-muted font-mono">
              Creada {formatDate(selectedCard.createdAt)}
              {selectedCard.updatedAt !== selectedCard.createdAt &&
                ` • Actualizada ${formatDate(selectedCard.updatedAt)}`}
            </p>
          </div>

          {/* BODY - SCROLLABLE */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
            {/* DESCRIPCIÓN */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
                  DESCRIPCIÓN
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
                  placeholder="Añade una descripción..."
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
                      {canEdit ? 'Clic para añadir descripción...' : 'Sin descripción'}
                    </p>
                  )}
                </div>
              )}
            </section>

            {/* PRIORIDAD Y FECHA */}
            <section className="grid grid-cols-2 gap-4">
              {/* Prioridad */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Flag className={`w-4 h-4 ${currentPriority?.iconColor || 'text-text-muted'}`} />
                  <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
                    PRIORIDAD
                  </h3>
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
                      {currentPriority?.label || 'Sin prioridad'}
                    </span>
                  </button>
                )}
              </div>

              {/* Fecha límite */}
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
                    FECHA LÍMITE
                  </h3>
                </div>

                {isEditing && canEdit ? (
                  <div className="relative" ref={calendarRef}>
                    <button
                      type="button"
                      onClick={() => setShowCalendar(!showCalendar)}
                      className="w-full p-2 bg-surface border border-border text-sm font-mono hover:border-accent transition-colors text-left"
                    >
                      {editedDueDate ? formatDate(editedDueDate) : 'Seleccionar fecha'}
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
                    onClick={() => canEdit && setIsEditing(true)}
                    disabled={!canEdit}
                    className={`w-full p-2 bg-surface border border-border text-sm font-mono ${
                      canEdit ? 'hover:border-accent' : ''
                    } transition-colors text-left`}
                  >
                    {selectedCard.dueDate ? formatDate(selectedCard.dueDate) : 'Sin fecha límite'}
                  </button>
                )}
              </div>
            </section>

            {/* ETIQUETAS Y MIEMBROS - EN LA MISMA FILA */}
            <section className="grid grid-cols-2 gap-4">
              {/* Etiquetas */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Tag className="w-4 h-4 text-text-muted" />
                  <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
                    ETIQUETAS
                  </h3>
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
                    <p className="text-xs text-text-muted font-mono">Cargando...</p>
                  )}
                </div>
              </div>

              {/* Miembros */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <UsersIcon className="w-4 h-4 text-text-muted" />
                  <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
                    MIEMBROS
                  </h3>
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
                                <p className="text-xs font-medium truncate">{member.user?.name}</p>
                                <p className="text-xs text-text-muted truncate">
                                  {member.user?.email}
                                </p>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-text-muted font-mono">
                            Sin miembros asignados
                          </p>
                        )}
                      </div>
                    )
                  ) : (
                    <p className="text-xs text-text-muted font-mono">Cargando...</p>
                  )}
                </div>
              </div>
            </section>

            {/* COMENTARIOS - ALTURA MÍNIMA DE 3 COMENTARIOS */}
            <section>
              <CommentList
                cardId={selectedCard.id}
                maxHeight="400px"
                minHeight="300px"
                showForm={true}
                showCount={true}
                onCountChange={setCommentCount}
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
                Eliminar
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
                      setEditedDueDate(selectedCard.dueDate || '');
                      setShowCalendar(false);
                    }}
                    disabled={isUpdating}
                    className="px-4 py-2 border border-border hover:bg-surface transition-colors text-sm font-medium"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleUpdate}
                    disabled={isUpdating || !editedTitle.trim()}
                    className="px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {isUpdating ? 'Guardando...' : 'Guardar'}
                  </button>
                </>
              ) : (
                canEdit && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="px-4 py-2 bg-accent text-white hover:bg-accent/80 transition-colors text-sm font-medium"
                  >
                    Editar
                  </button>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Delete Confirmation */}
      {showDeleteConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
            <div className="bg-card border border-error max-w-md w-full p-6">
              <h3 className="text-lg font-semibold mb-2 font-mono">¿Eliminar Tarjeta?</h3>
              <p className="text-sm text-text-secondary mb-4 font-mono">
                ¿Estás seguro de eliminar "<strong>{selectedCard.title}</strong>"? No se puede
                deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 border border-border hover:bg-surface transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="flex-1 px-4 py-2 bg-error text-white hover:bg-error/80 transition-colors"
                >
                  {isDeleting ? 'Eliminando...' : 'Eliminar'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
