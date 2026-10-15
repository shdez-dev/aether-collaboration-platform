'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type DragEvent,
  type KeyboardEvent,
} from 'react';
import { CalendarDays, Check, GripVertical, Plus, Trash2, X } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { createPortal } from 'react-dom';
import { apiService } from '@/services/apiService';
import { CalendarDatePicker } from './calendar/DateTimePickers';
import styles from './ProjectSprintPlanner.module.css';

export interface SprintPlanCard {
  id: string;
  title: string;
  completed: boolean;
  boardName: string;
  listName: string;
  boardId?: string;
  priority?: string | null;
  startDate?: string | null;
  dueDate?: string | null;
  listId?: string;
  position?: number;
}
export interface ProjectSprint {
  id: string;
  name: string;
  goal: string | null;
  startDate: string;
  endDate: string;
  status: 'PLANNED' | 'ACTIVE' | 'COMPLETED';
  boardId: string | null;
  cards: SprintPlanCard[];
}
interface BacklogCandidate extends SprintPlanCard {
  sprintId?: string | null;
  sprintName?: string | null;
}
const localDate = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const formatDate = (value: string) =>
  new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'short',
  });
const labels = { ACTIVE: 'En curso', PLANNED: 'Planificado', COMPLETED: 'Completado' } as const;

export function ProjectSprintPlanner({
  projectId,
  cards,
  canManage,
  canPlan,
  onChange,
  draggingCardId,
}: {
  projectId: string;
  cards: BacklogCandidate[];
  canManage: boolean;
  canPlan: boolean;
  onChange: () => void;
  draggingCardId?: string | null;
}) {
  const [sprints, setSprints] = useState<ProjectSprint[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [pendingDeleteSprint, setPendingDeleteSprint] = useState<ProjectSprint | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pickerId, setPickerId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [internalDragId, setInternalDragId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [goal, setGoal] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const deleteDialogRef = useRef<HTMLElement>(null);
  const cancelDeleteButtonRef = useRef<HTMLButtonElement>(null);
  const prefersReducedMotion = useReducedMotion() ?? false;
  const motionDuration = prefersReducedMotion ? 0.12 : 0.22;
  const entryOffset = prefersReducedMotion ? 0 : 8;

  const load = useCallback(async () => {
    try {
      const response = await apiService.get<{ sprints: ProjectSprint[] }>(
        `/api/projects/${projectId}/sprints`,
        true
      );
      if (!response.success || !response.data)
        throw new Error(response.error?.message || 'No se pudieron cargar los sprints');
      setSprints(response.data.sprints);
      setError('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los sprints');
    } finally {
      setLoading(false);
    }
  }, [projectId]);
  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => {
    if (!pendingDeleteSprint) return;
    const previousFocus =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    cancelDeleteButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus?.isConnected) previousFocus.focus();
    };
  }, [pendingDeleteSprint]);

  function closeEditor() {
    setEditingId(null);
    setName('');
    setGoal('');
    setStartDate('');
    setEndDate('');
    setError('');
  }
  function beginCreate() {
    closeEditor();
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + 13);
    setName(`Sprint ${sprints.length + 1}`);
    setStartDate(localDate(today));
    setEndDate(localDate(end));
    setEditingId('new');
  }
  function beginEdit(sprint: ProjectSprint) {
    closeEditor();
    setEditingId(sprint.id);
    setName(sprint.name);
    setGoal(sprint.goal ?? '');
    setStartDate(sprint.startDate.slice(0, 10));
    setEndDate(sprint.endDate.slice(0, 10));
  }
  async function saveSprint() {
    if (!canManage) return;
    if (!name.trim() || !startDate || !endDate || startDate > endDate) {
      setError('Escribe un nombre y un rango de fechas válido.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const path = `/api/projects/${projectId}/sprints`;
      const payload = { name: name.trim(), goal: goal.trim(), startDate, endDate };
      const response =
        editingId === 'new'
          ? await apiService.post(path, { ...payload, cardIds: [] }, true)
          : await apiService.patch(`${path}/${editingId}`, payload, true);
      if (!response.success)
        throw new Error(response.error?.message || 'No se pudo guardar el sprint');
      closeEditor();
      await load();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar el sprint');
    } finally {
      setBusy(false);
    }
  }
  async function assignCard(cardId: string, sprint: ProjectSprint) {
    if (!canPlan || busy || sprint.status === 'COMPLETED') return;
    const card = cards.find((item) => item.id === cardId);
    if (!card || card.completed || card.sprintId === sprint.id) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post(`/api/sprints/${sprint.id}/cards`, { cardId }, true);
      if (!response.success)
        throw new Error(response.error?.message || 'No se pudo mover la tarjeta al sprint');
      setPickerId(null);
      await load();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo mover la tarjeta al sprint');
    } finally {
      setBusy(false);
    }
  }
  async function removeCard(cardId: string, sprint: ProjectSprint) {
    if (!canPlan || busy || sprint.status === 'COMPLETED') return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.delete(`/api/sprints/${sprint.id}/cards/${cardId}`, true);
      if (!response.success)
        throw new Error(response.error?.message || 'No se pudo devolver la tarjeta al backlog');
      await load();
      onChange();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'No se pudo devolver la tarjeta al backlog'
      );
    } finally {
      setBusy(false);
    }
  }
  async function changeStatus(sprint: ProjectSprint, status: 'ACTIVE' | 'COMPLETED') {
    if (!canManage) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.patch(
        `/api/projects/${projectId}/sprints/${sprint.id}`,
        { status },
        true
      );
      if (!response.success)
        throw new Error(response.error?.message || 'No se pudo actualizar el sprint');
      await load();
      onChange();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar el sprint');
    } finally {
      setBusy(false);
    }
  }
  function closeDeleteConfirmation() {
    if (busy) return;
    setPendingDeleteSprint(null);
    setDeleteError('');
  }
  function handleDeleteDialogKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDeleteConfirmation();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      deleteDialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])'
      ) ?? []
    );
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }
  async function removeSprint() {
    const sprint = pendingDeleteSprint;
    if (!sprint || busy) return;
    setBusy(true);
    setDeleteError('');
    try {
      const response = await apiService.delete(
        `/api/projects/${projectId}/sprints/${sprint.id}`,
        true
      );
      if (!response.success)
        throw new Error(response.error?.message || 'No se pudo eliminar el sprint');
      if (editingId === sprint.id) closeEditor();
      setPendingDeleteSprint(null);
      await load();
      onChange();
    } catch (cause) {
      setDeleteError(cause instanceof Error ? cause.message : 'No se pudo eliminar el sprint');
    } finally {
      setBusy(false);
    }
  }
  function dropCard(event: DragEvent<HTMLElement>, sprint: ProjectSprint) {
    event.preventDefault();
    setOverId(null);
    const cardId =
      event.dataTransfer.getData('application/x-aether-card-id') ||
      event.dataTransfer.getData('text/plain');
    if (cardId) void assignCard(cardId, sprint);
  }

  const ordered = sprints;
  return (
    <aside className={styles.planner} aria-label="Planificación de sprints">
      <header className={styles.heading}>
        <div>
          <h2>Sprints</h2>
          <p>Planifica el trabajo del proyecto.</p>
        </div>
        {canManage && (
          <button
            type="button"
            className={styles.primary}
            onClick={beginCreate}
            disabled={busy || editingId === 'new'}
          >
            <Plus size={15} /> Crear
          </button>
        )}
      </header>
      {canPlan && (
        <p className={styles.instruction}>
          <GripVertical size={14} /> Arrastra tarjetas desde el backlog o entre sprints.
        </p>
      )}
      <AnimatePresence initial={false}>
        {editingId && canManage && (
          <motion.div
            key="sprint-editor"
            className={styles.editor}
            initial={{ opacity: 0, y: entryOffset, scale: prefersReducedMotion ? 1 : 0.99 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4, scale: 1 }}
            transition={{ duration: motionDuration, ease: 'easeOut' }}
          >
            <div className={styles.editorHeading}>
              <h3>{editingId === 'new' ? 'Nuevo sprint' : 'Configurar sprint'}</h3>
              <button
                type="button"
                className={styles.iconButton}
                aria-label="Cerrar configuración"
                onClick={closeEditor}
              >
                <X size={16} />
              </button>
            </div>
            <label className={styles.field}>
              Nombre
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={255}
                placeholder="Sprint 1"
              />
            </label>
            <label className={styles.field}>
              Objetivo
              <textarea
                value={goal}
                onChange={(event) => setGoal(event.target.value)}
                maxLength={1000}
                rows={2}
                placeholder="Resultado que se busca entregar"
              />
            </label>
            <div className={styles.dates}>
              <div className={styles.field}>
                <span>Inicio</span>
                <CalendarDatePicker
                  value={startDate}
                  label="Fecha de inicio"
                  onChange={setStartDate}
                  compact
                  portal
                />
              </div>
              <div className={styles.field}>
                <span>Fin</span>
                <CalendarDatePicker
                  value={endDate}
                  min={startDate}
                  label="Fecha de fin"
                  onChange={setEndDate}
                  compact
                  portal
                />
              </div>
            </div>
            <div className={styles.editorActions}>
              <button type="button" className={styles.secondary} onClick={closeEditor}>
                Cancelar
              </button>
              <button type="button" className={styles.primary} disabled={busy} onClick={saveSprint}>
                {busy ? 'Guardando…' : editingId === 'new' ? 'Crear sprint' : 'Guardar'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        {loading ? (
          <motion.p
            key="loading-sprints"
            className={styles.muted}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration }}
          >
            Cargando sprints…
          </motion.p>
        ) : ordered.length === 0 ? (
          <motion.div
            key="empty-sprints"
            className={styles.empty}
            initial={{ opacity: 0, y: entryOffset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4 }}
            transition={{ duration: motionDuration, ease: 'easeOut' }}
          >
            <CalendarDays size={22} />
            <strong>Aún no hay sprints</strong>
            <span>{canManage
              ? 'Crea uno aquí y arrastra las tarjetas que formarán parte del trabajo.'
              : canPlan
                ? 'El Scrum Master puede crear el sprint y el equipo ayudará a definir su alcance.'
                : 'Cuando el Scrum Master planifique un sprint, aparecerá aquí.'}</span>
          </motion.div>
        ) : (
          <motion.div
            key="sprints"
            layout="position"
            transition={{ duration: motionDuration, ease: 'easeOut' }}
            className={styles.sprints}
          >
            <AnimatePresence initial={false}>
              {ordered.map((sprint) => {
                const completed = sprint.cards.filter((card) => card.completed).length;
                const droppable = canPlan && sprint.status !== 'COMPLETED';
                const options = cards.filter(
                  (card) => !card.completed && card.sprintId !== sprint.id
                );
                return (
                  <motion.section
                    key={sprint.id}
                    layout="position"
                    initial={{ opacity: 0, y: entryOffset, scale: prefersReducedMotion ? 1 : 0.99 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -5, scale: 1 }}
                    transition={{ duration: motionDuration, ease: 'easeOut' }}
                    className={`${styles.sprint} ${overId === sprint.id ? styles.dropActive : ''}`}
                    onDragOver={(event) => {
                      if (droppable && (draggingCardId || internalDragId)) {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = 'move';
                        setOverId(sprint.id);
                      }
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget as Node))
                        setOverId(null);
                    }}
                    onDrop={(event) => {
                      if (droppable) dropCard(event, sprint);
                    }}
                  >
                    <div className={styles.sprintHeading}>
                      <span className={`${styles.status} ${styles[sprint.status.toLowerCase()]}`}>
                        {labels[sprint.status]}
                      </span>
                      <span className={styles.count}>
                        {completed}/{sprint.cards.length}
                      </span>
                    </div>
                    <h3>{sprint.name}</h3>
                    <p className={styles.range}>
                      <CalendarDays size={13} /> {formatDate(sprint.startDate)} –{' '}
                      {formatDate(sprint.endDate)}
                    </p>
                    {sprint.goal && <p className={styles.goal}>{sprint.goal}</p>}
                    <motion.div
                      layout
                      transition={{ duration: motionDuration, ease: 'easeOut' }}
                      className={`${styles.dropArea} ${(draggingCardId || internalDragId) && droppable ? styles.dropReady : ''}`}
                    >
                      <AnimatePresence initial={false}>
                        {sprint.cards.length === 0 ? (
                          <motion.p
                            key={`empty-${sprint.id}`}
                            className={styles.dropPrompt}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: motionDuration }}
                          >
                            {droppable ? 'Suelta aquí una tarjeta del backlog' : 'Sin tarjetas'}
                          </motion.p>
                        ) : (
                          sprint.cards.map((card) => (
                            <motion.div
                              key={card.id}
                              layout="position"
                              layoutId={`sprint-card-${card.id}`}
                              initial={{
                                opacity: 0,
                                y: prefersReducedMotion ? 0 : 5,
                                scale: prefersReducedMotion ? 1 : 0.99,
                              }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -4, scale: 1 }}
                              transition={{ duration: motionDuration, ease: 'easeOut' }}
                              className={styles.assignedRow}
                            >
                              {droppable && !card.completed && (
                                <span
                                  className={styles.assignedGrip}
                                  draggable
                                  title="Mover a otro sprint"
                                  aria-label={`Arrastrar ${card.title} a otro sprint`}
                                  onDragStart={(event) => {
                                    event.stopPropagation();
                                    event.dataTransfer.setData(
                                      'application/x-aether-card-id',
                                      card.id
                                    );
                                    event.dataTransfer.setData('text/plain', card.id);
                                    event.dataTransfer.effectAllowed = 'move';
                                    setInternalDragId(card.id);
                                  }}
                                  onDragEnd={() => {
                                    setInternalDragId(null);
                                    setOverId(null);
                                  }}
                                >
                                  <GripVertical size={14} />
                                </span>
                              )}
                              <span className={card.completed ? styles.done : ''}>
                                {card.completed && <Check size={12} />}
                                {card.title}
                                <small>
                                  {card.boardName} — {card.listName}
                                </small>
                              </span>
                              {droppable && !card.completed && (
                                <button
                                  type="button"
                                  className={styles.removeCard}
                                  aria-label={`Devolver ${card.title} al backlog`}
                                  title="Devolver al backlog"
                                  disabled={busy}
                                  onClick={() => void removeCard(card.id, sprint)}
                                >
                                  <X size={14} />
                                </button>
                              )}
                            </motion.div>
                          ))
                        )}
                      </AnimatePresence>
                    </motion.div>
                    {droppable && (
                      <div className={styles.sprintActions}>
                        {canPlan && <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => setPickerId(pickerId === sprint.id ? null : sprint.id)}
                        >
                          <Plus size={13} /> Añadir tarjeta
                        </button>}
                        {canManage && <button
                          type="button"
                          className={styles.textButton}
                          onClick={() => beginEdit(sprint)}
                        >
                          Configurar
                        </button>}
                      </div>
                    )}
                    <AnimatePresence initial={false}>
                      {pickerId === sprint.id && droppable && (
                        <motion.div
                          key={`picker-${sprint.id}`}
                          className={styles.picker}
                          aria-label={`Tarjetas disponibles para ${sprint.name}`}
                          initial={{
                            opacity: 0,
                            y: prefersReducedMotion ? 0 : -5,
                            scale: prefersReducedMotion ? 1 : 0.99,
                          }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: prefersReducedMotion ? 0 : -3, scale: 1 }}
                          transition={{ duration: motionDuration, ease: 'easeOut' }}
                        >
                          {options.length ? (
                            options.map((card, index) => (
                              <motion.button
                                key={card.id}
                                type="button"
                                disabled={busy}
                                initial={{ opacity: 0, x: prefersReducedMotion ? 0 : -4 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{
                                  duration: motionDuration,
                                  delay: prefersReducedMotion ? 0 : Math.min(index * 0.025, 0.12),
                                  ease: 'easeOut',
                                }}
                                onClick={() => void assignCard(card.id, sprint)}
                              >
                                <span>
                                  {card.title}
                                  <small>
                                    {card.boardName}
                                    {card.sprintName ? ` — ${card.sprintName}` : ''}
                                  </small>
                                </span>
                                <Plus size={14} />
                              </motion.button>
                            ))
                          ) : (
                            <p>No hay tarjetas pendientes disponibles.</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    {canManage && (
                      <div className={styles.lifecycle}>
                        {sprint.status === 'PLANNED' && (
                          <button
                            type="button"
                            className={styles.secondary}
                            disabled={busy || sprints.some((item) => item.status === 'ACTIVE')}
                            onClick={() => void changeStatus(sprint, 'ACTIVE')}
                          >
                            Iniciar sprint
                          </button>
                        )}
                        {sprint.status === 'ACTIVE' && (
                          <button
                            type="button"
                            className={styles.secondary}
                            disabled={busy}
                            onClick={() => void changeStatus(sprint, 'COMPLETED')}
                          >
                            Completar sprint
                          </button>
                        )}
                        {sprint.status === 'PLANNED' && (
                          <button
                            type="button"
                            className={styles.danger}
                            disabled={busy}
                            onClick={() => {
                              setDeleteError('');
                              setPendingDeleteSprint(sprint);
                            }}
                          >
                            Eliminar
                          </button>
                        )}
                      </div>
                    )}
                  </motion.section>
                );
              })}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence initial={false}>
        {error && (
          <motion.p
            key={error}
            className={styles.error}
            role="alert"
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: motionDuration, ease: 'easeOut' }}
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
      {typeof document !== 'undefined' &&
        createPortal(
          <AnimatePresence>
            {pendingDeleteSprint && (
              <motion.div
                key="delete-sprint-overlay"
                className={styles.confirmOverlay}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: prefersReducedMotion ? 0.12 : 0.18, ease: 'easeOut' }}
                onMouseDown={(event) => {
                  if (event.target === event.currentTarget) closeDeleteConfirmation();
                }}
              >
                <motion.section
                  ref={deleteDialogRef}
                  className={styles.confirmDialog}
                  role="alertdialog"
                  aria-modal="true"
                  aria-labelledby="delete-sprint-title"
                  aria-describedby="delete-sprint-description"
                  tabIndex={-1}
                  onKeyDown={handleDeleteDialogKeyDown}
                  initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: prefersReducedMotion ? 0 : 5, scale: 0.99 }}
                  transition={{ duration: prefersReducedMotion ? 0.12 : 0.2, ease: 'easeOut' }}
                >
                  <div className={styles.confirmHeading}>
                    <span className={styles.confirmIcon} aria-hidden="true">
                      <Trash2 size={18} />
                    </span>
                    <div>
                      <h2 id="delete-sprint-title">¿Eliminar {pendingDeleteSprint.name}?</h2>
                      <p id="delete-sprint-description">
                        Las tarjetas de este sprint volverán al backlog.
                      </p>
                    </div>
                  </div>
                  {deleteError && (
                    <p className={styles.confirmError} role="alert">
                      {deleteError}
                    </p>
                  )}
                  <div className={styles.confirmActions}>
                    <button
                      ref={cancelDeleteButtonRef}
                      type="button"
                      className={styles.secondary}
                      disabled={busy}
                      onClick={closeDeleteConfirmation}
                    >
                      Cancelar
                    </button>
                    <button
                      type="button"
                      className={styles.confirmDelete}
                      disabled={busy}
                      onClick={() => void removeSprint()}
                    >
                      {busy ? 'Eliminando…' : 'Eliminar sprint'}
                    </button>
                  </div>
                </motion.section>
              </motion.div>
            )}
          </AnimatePresence>,
          document.body
        )}
    </aside>
  );
}
