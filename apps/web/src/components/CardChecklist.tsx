// apps/web/src/components/CardChecklist.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { CheckSquare, Square, Plus, Trash2, Pencil, X, Check } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useCardStore } from '@/stores/cardStore';
import type { ChecklistItem } from '@aether/types';

interface CardChecklistProps {
  cardId: string;
  /** Callback para que el padre pueda reflejar el progreso en la mini-card */
  onProgressChange?: (done: number, total: number) => void;
}

const API = process.env.NEXT_PUBLIC_API_URL;

export function CardChecklist({ cardId, onProgressChange }: CardChecklistProps) {
  const t = useT();
  const { accessToken } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;
  const updateCard = useCardStore((state) => state.updateCard);

  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER' || userRole === 'MEMBER';
  const canDelete = userRole === 'ADMIN' || userRole === 'OWNER';

  const [items, setItems] = useState<ChecklistItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Agregar ítem
  const [newTitle, setNewTitle] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [showInput, setShowInput] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Editar ítem inline
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // ── Cargar ítems ──────────────────────────────────────────────────────────

  const fetchItems = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cards/${cardId}/checklist`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        setItems(data.items ?? []);
      }
    } catch {
      // silencioso
    } finally {
      setIsLoading(false);
    }
  }, [cardId, accessToken]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  // Notificar progreso al padre
  useEffect(() => {
    const done = items.filter((i) => i.completed).length;
    onProgressChange?.(done, items.length);
  }, [items, onProgressChange]);

  // Sincronizar checklistItems con el store para que la card kanban se actualice en tiempo real
  useEffect(() => {
    if (!isLoading) {
      updateCard(cardId, { checklistItems: items });
    }
  }, [items, isLoading, cardId, updateCard]);

  // Foco al mostrar input
  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  // ── Progress ──────────────────────────────────────────────────────────────

  const total = items.length;
  const done = items.filter((i) => i.completed).length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  // ── Toggle completado (optimista) ─────────────────────────────────────────

  const handleToggle = async (item: ChecklistItem) => {
    if (!canEdit) return;

    // Optimistic update
    setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, completed: !i.completed } : i)));

    try {
      const res = await fetch(`${API}/api/cards/${cardId}/checklist/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ completed: !item.completed }),
      });
      if (!res.ok) throw new Error('Error al actualizar');
      const { data } = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    } catch {
      // Rollback
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? { ...i, completed: item.completed } : i))
      );
    }
  };

  // ── Agregar ítem ──────────────────────────────────────────────────────────

  const handleAdd = async () => {
    if (!newTitle.trim() || isAdding) return;
    setIsAdding(true);

    try {
      const res = await fetch(`${API}/api/cards/${cardId}/checklist`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (!res.ok) throw new Error('Error al crear');
      const { data } = await res.json();
      setItems((prev) => [...prev, data.item]);
      setNewTitle('');
      // Mantiene el input abierto para añadir más
      inputRef.current?.focus();
    } catch {
      // silencioso
    } finally {
      setIsAdding(false);
    }
  };

  const handleAddKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleAdd();
    if (e.key === 'Escape') {
      setShowInput(false);
      setNewTitle('');
    }
  };

  // ── Editar ítem inline ────────────────────────────────────────────────────

  const startEdit = (item: ChecklistItem) => {
    if (!canEdit) return;
    setEditingId(item.id);
    setEditingTitle(item.title);
  };

  const handleEditSave = async (item: ChecklistItem) => {
    if (!editingTitle.trim() || editingTitle.trim() === item.title) {
      setEditingId(null);
      return;
    }
    const oldTitle = item.title;
    // Optimistic
    setItems((prev) =>
      prev.map((i) => (i.id === item.id ? { ...i, title: editingTitle.trim() } : i))
    );
    setEditingId(null);

    try {
      const res = await fetch(`${API}/api/cards/${cardId}/checklist/${item.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      if (!res.ok) throw new Error('Error al editar');
      const { data } = await res.json();
      setItems((prev) => prev.map((i) => (i.id === item.id ? data.item : i)));
    } catch {
      // Rollback
      setItems((prev) => prev.map((i) => (i.id === item.id ? { ...i, title: oldTitle } : i)));
    }
  };

  const handleEditKeyDown = (e: React.KeyboardEvent, item: ChecklistItem) => {
    if (e.key === 'Enter') handleEditSave(item);
    if (e.key === 'Escape') setEditingId(null);
  };

  // ── Eliminar ítem ─────────────────────────────────────────────────────────

  const handleDelete = async (item: ChecklistItem) => {
    if (!canDelete) return;
    // Optimistic
    setItems((prev) => prev.filter((i) => i.id !== item.id));

    try {
      const res = await fetch(`${API}/api/cards/${cardId}/checklist/${item.id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) throw new Error('Error al eliminar');
    } catch {
      // Rollback
      setItems((prev) => {
        const idx = prev.findIndex((i) => i.position >= item.position);
        const next = [...prev];
        if (idx === -1) next.push(item);
        else next.splice(idx, 0, item);
        return next;
      });
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <CheckSquare className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
            {t.checklist_section_title}
          </h3>
        </div>
        <div className="space-y-2">
          {[1, 2].map((n) => (
            <div key={n} className="h-8 bg-surface border border-border animate-pulse" />
          ))}
        </div>
      </section>
    );
  }

  return (
    <section>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
            {t.checklist_section_title}
          </h3>
          {total > 0 && (
            <span className="text-xs text-text-muted font-mono">
              {t.checklist_progress(done, total)}
            </span>
          )}
        </div>
        {canEdit && (
          <button
            onClick={() => setShowInput((v) => !v)}
            className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${
              showInput
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-muted hover:border-accent hover:text-accent'
            }`}
          >
            <Plus className="w-3 h-3" />
            {t.checklist_btn_add}
          </button>
        )}
      </div>

      {/* Barra de progreso */}
      {total > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-surface border border-border overflow-hidden">
              <div
                className={`h-full transition-all duration-300 ${
                  pct === 100 ? 'bg-success' : 'bg-accent'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span
              className={`text-xs font-mono w-8 text-right ${
                pct === 100 ? 'text-success' : 'text-text-muted'
              }`}
            >
              {pct}%
            </span>
          </div>
        </div>
      )}

      {/* Lista de ítems */}
      <div className="space-y-1">
        {items.length === 0 && !showInput && (
          <p className="text-xs text-text-muted font-mono py-2 text-center">{t.checklist_empty}</p>
        )}

        {items.map((item) => (
          <div
            key={item.id}
            className={`group flex items-center gap-2 px-2 py-1.5 border transition-colors ${
              item.completed
                ? 'border-success/20 bg-success/5'
                : 'border-transparent hover:border-border hover:bg-surface'
            }`}
          >
            {/* Checkbox */}
            <button
              onClick={() => handleToggle(item)}
              disabled={!canEdit}
              className={`flex-shrink-0 transition-colors ${
                canEdit ? 'hover:text-accent cursor-pointer' : 'cursor-default'
              }`}
            >
              {item.completed ? (
                <CheckSquare className="w-4 h-4 text-success" />
              ) : (
                <Square className="w-4 h-4 text-text-muted" />
              )}
            </button>

            {/* Título o input de edición */}
            {editingId === item.id ? (
              <div className="flex-1 flex items-center gap-1">
                <input
                  value={editingTitle}
                  onChange={(e) => setEditingTitle(e.target.value)}
                  onKeyDown={(e) => handleEditKeyDown(e, item)}
                  onBlur={() => handleEditSave(item)}
                  autoFocus
                  className="flex-1 text-sm bg-transparent border-b border-accent focus:outline-none font-mono text-text-primary"
                  placeholder={t.checklist_edit_placeholder}
                />
                <button
                  onMouseDown={() => handleEditSave(item)}
                  className="p-0.5 text-success hover:text-success/80"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onMouseDown={() => setEditingId(null)}
                  className="p-0.5 text-text-muted hover:text-text-primary"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span
                className={`flex-1 text-sm font-mono transition-colors select-none ${
                  item.completed ? 'line-through text-text-muted' : 'text-text-primary'
                } ${canEdit ? 'cursor-pointer' : ''}`}
                onDoubleClick={() => canEdit && startEdit(item)}
                title={canEdit ? 'Doble clic para editar' : undefined}
              >
                {item.title}
              </span>
            )}

            {/* Acciones (sólo al hacer hover) */}
            {editingId !== item.id && (
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {canEdit && (
                  <button
                    onClick={() => startEdit(item)}
                    className="p-0.5 text-text-muted hover:text-accent transition-colors"
                    title="Editar"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => handleDelete(item)}
                    className="p-0.5 text-text-muted hover:text-error transition-colors"
                    title="Eliminar"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {/* Input para nueva subtarea */}
        {showInput && canEdit && (
          <div className="flex items-center gap-2 px-2 py-1.5 border border-accent/40 bg-accent/5">
            <Plus className="w-4 h-4 text-accent flex-shrink-0" />
            <input
              ref={inputRef}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={handleAddKeyDown}
              placeholder={t.checklist_input_placeholder}
              disabled={isAdding}
              className="flex-1 text-sm bg-transparent focus:outline-none font-mono text-text-primary placeholder-text-muted"
            />
            <button
              onClick={handleAdd}
              disabled={!newTitle.trim() || isAdding}
              className="px-2 py-0.5 text-xs bg-accent text-white disabled:opacity-40 hover:bg-accent/80 transition-colors"
            >
              {isAdding ? '...' : t.checklist_btn_add}
            </button>
            <button
              onClick={() => {
                setShowInput(false);
                setNewTitle('');
              }}
              className="p-0.5 text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
