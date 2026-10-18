// apps/web/src/components/BoardList.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { markStepDone } from '@/lib/utils/onboardingGuide';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2, Pencil, GripVertical, Inbox } from 'lucide-react';
import { es } from '@/lib/i18n';
import { C } from '@/lib/colors';
import composerStyles from './CardComposer.module.css';


interface List {
  id: string;
  boardId: string;
  name: string;
  position: number;
  createdAt: string;
  updatedAt: string;
  cardCount?: number;
  cards?: any[];
}

interface BoardListProps {
  list: List;
  filteredCards?: any[];
}

export default function BoardList({ list, filteredCards: filteredCardsProp }: BoardListProps) {
  const { updateList, deleteList } = useBoardStore();
  const { cards, addCard } = useCardStore();
  const setSelectedCard = useCardStore((s) => s.setSelectedCard);
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;

  const [isEditing, setIsEditing]           = useState(false);
  const [editedName, setEditedName]         = useState(list.name);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isMenuOpen, setIsMenuOpen]         = useState(false);
  const [isAddingCard, setIsAddingCard]     = useState(false);
  const [cardTitle, setCardTitle]           = useState('');
  const [isCreatingCard, setIsCreatingCard] = useState(false);
  const [cardCreateError, setCardCreateError] = useState('');

  const t = es;

  const canEdit = userRole === 'ADMIN' || userRole === 'OWNER';
  const canDrag = userRole === 'OWNER' || userRole === 'ADMIN' || userRole === 'MEMBER';

  const {
    attributes, listeners, setNodeRef: setSortableNodeRef,
    transform, transition, isDragging,
  } = useSortable({
    id: list.id,
    data: { type: 'list', list },
    disabled: !canEdit,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1,
  };

  const { setNodeRef: setDroppableNodeRef, isOver } = useDroppable({
    id: `list-droppable-${list.id}`,
    data: { type: 'list', listId: list.id },
    disabled: !canDrag,
  });

  const handleSave = async () => {
    if (!canEdit) return;
    if (editedName.trim() === list.name || !editedName.trim()) {
      setEditedName(list.name); setIsEditing(false); return;
    }
    await updateList(list.id, editedName.trim());
    setIsEditing(false);
  };

  const handleDelete = async () => {
    if (!canEdit) return;
    if (allListCards.length > 0) return;
    await deleteList(list.id);
  };

  const handleCreateCard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !cardTitle.trim()) return;
    setCardCreateError('');
    setIsCreatingCard(true);
    try {
      const r = await apiService.post<{ card: any }>(`/api/lists/${list.id}/cards`, { title: cardTitle.trim() }, true);
      if (!r.success) throw new Error(r.error?.message || 'Error al crear la tarjeta');
      addCard(list.id, r.data!.card);
      markStepDone('card');
      setSelectedCard(r.data!.card);
      setCardTitle(''); setIsAddingCard(false);
    } catch (err: any) {
      setCardCreateError(err?.message || 'No se pudo crear la tarjeta. Inténtalo de nuevo.');
    } finally { setIsCreatingCard(false); }
  };

  const allListCards = cards[list.id] || [];
  const listCards    = filteredCardsProp ?? allListCards;
  const cardIds      = listCards.map((c) => c.id);
  const isFiltered   = filteredCardsProp !== undefined;

  return (
    <>
      <div
        ref={setSortableNodeRef}
        role="group"
        aria-label={list.name}
        style={{ ...style, width: 'min(304px, calc(100vw - 48px))', flexShrink: 0 }}
      >
        <div
          style={{
            background: C.bg2,
            border: `1px solid ${isOver ? C.accent : C.border}`,
            borderRadius: '12px',
            display: 'flex',
            flexDirection: 'column',
            minHeight: '252px',
            transition: 'border-color 0.15s',
          }}
        >
          {/* ── Header ─────────────────────────────────────── */}
          <div
            style={{
              padding: '12px 12px 12px 9px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              minHeight: '56px',
              flexShrink: 0,
            }}
          >
            {/* Drag handle */}
            <div
              {...(canEdit ? attributes : {})}
              {...(canEdit ? listeners : {})}
              style={{
                cursor: canEdit ? 'grab' : 'default',
                color: C.text3,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                padding: '5px',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => { if (canEdit) (e.currentTarget.style.color = C.text3); }}
              onMouseLeave={(e) => { if (canEdit) (e.currentTarget.style.color = C.text4); }}
            >
              <GripVertical size={15} />
            </div>

            {/* Name */}
            {isEditing && canEdit ? (
              <input
                type="text"
                value={editedName}
                onChange={(e) => setEditedName(e.target.value)}
                onBlur={handleSave}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') { setEditedName(list.name); setIsEditing(false); } }}
                autoFocus
                maxLength={255}
                onClick={(e) => e.stopPropagation()}
                style={{
                  flex: 1, background: C.surface, border: `1px solid ${C.accent}`,
                  borderRadius: '5px', padding: '3px 7px', fontSize: '13px',
                  color: C.text, outline: 'none',
                }}
              />
            ) : (
              <span
                style={{
                  flex: 1, fontSize: '13px', fontWeight: 650, fontFamily: "'Sora', system-ui, sans-serif", color: C.text,
                  cursor: canEdit ? 'text' : 'default', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
                onClick={() => canEdit && setIsEditing(true)}
              >
                {list.name}
              </span>
            )}

            {/* Count badge */}
            <span
              style={{
                fontSize: '11px', fontWeight: 700, color: C.text2,
                background: C.surface, border: `1px solid ${C.border}`,
                borderRadius: '7px', padding: '3px 8px', flexShrink: 0,
              }}
            >
              {isFiltered ? `${listCards.length}/${allListCards.length}` : allListCards.length}
            </span>

            {/* Menu */}
            {canEdit && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen((v) => !v); }}
                  aria-label={`Opciones de la lista ${list.name}`}
                  aria-expanded={isMenuOpen}
                  style={{
                    width: '28px', height: '28px', borderRadius: '7px',
                    color: C.text4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    background: 'transparent',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text2); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text4); }}
                >
                  <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14">
                    <circle cx="8" cy="3" r="1.2"/><circle cx="8" cy="8" r="1.2"/><circle cx="8" cy="13" r="1.2"/>
                  </svg>
                </button>

                {isMenuOpen && <div className="fixed inset-0 z-10" onClick={() => setIsMenuOpen(false)} />}
                {isMenuOpen && (
                  <div
                    className="absolute right-0 top-full z-20"
                    style={{
                      marginTop: '4px', minWidth: '140px',
                      background: C.bg2, border: `1px solid ${C.border2}`,
                      borderRadius: '7px', overflow: 'hidden',
                      boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    }}
                  >
                    <button
                      onClick={(e) => { e.stopPropagation(); setIsEditing(true); setIsMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left transition-colors"
                      style={{ padding: '8px 12px', fontSize: '12.5px', color: C.text2 }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Pencil size={12} /> {t.btn_edit}
                    </button>
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setIsMenuOpen(false); }}
                      className="flex items-center gap-2 w-full text-left transition-colors"
                      style={{ padding: '8px 12px', fontSize: '12.5px', color: C.red }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = `${C.red}15`)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Trash2 size={12} /> {t.list_btn_delete}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Cards area ─────────────────────────────────── */}
          <div
            ref={setDroppableNodeRef}
            style={{
              padding: '10px',
              minHeight: '150px',
              maxHeight: 'min(64vh, 680px)',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: `${C.border2} transparent`,
            }}
          >
            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {listCards.length > 0 ? (
                  listCards.map((card) => <Card key={card.id} card={card} />)
                ) : (
                  <div style={{ minHeight: '130px', display: 'grid', placeContent: 'center', justifyItems: 'center', gap: '7px', textAlign: 'center', padding: '18px', borderRadius: '9px', background: isOver ? `color-mix(in srgb, ${C.accent} 10%, ${C.surface})` : C.surface, color: isOver ? C.accent : C.text3, transition: 'background-color 0.15s, color 0.15s' }}>
                    <Inbox size={20} strokeWidth={1.5} aria-hidden="true" />
                    <span style={{ fontSize: '12px', fontWeight: 650 }}>{isOver ? 'Suelta la tarjeta aquí' : isFiltered ? 'Sin resultados para estos filtros' : 'Aún no hay tarjetas'}</span>
                    {!isOver && !isFiltered && canEdit && <span style={{ fontSize: '11px', color: C.text3 }}>Añade la primera tarjeta para empezar.</span>}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>

          {/* ── Add card ───────────────────────────────────── */}
          {canEdit && (
            <div style={{ padding: '0 10px 10px', flexShrink: 0 }}>
              {isAddingCard ? (
                <form onSubmit={handleCreateCard} className={composerStyles.composer}>
                  <div className={composerStyles.heading}>
                    <label htmlFor={`new-card-${list.id}`}>Nueva tarjeta</label>
                    <span>{cardTitle.length}/255</span>
                  </div>
                  <textarea
                    id={`new-card-${list.id}`}
                    value={cardTitle}
                    maxLength={255}
                    onChange={(e) => { setCardTitle(e.target.value); if (cardCreateError) setCardCreateError(''); }}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setCardTitle(''); setCardCreateError(''); setIsAddingCard(false); } if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
                    placeholder="¿Qué hay que hacer?"
                    autoFocus
                    rows={2}
                    disabled={isCreatingCard}
                    className={composerStyles.input}
                  />
                  {cardCreateError && <p role="alert" className={composerStyles.error}>{cardCreateError}</p>}
                  <div className={composerStyles.actions}>
                    <button
                      type="submit"
                      disabled={!cardTitle.trim() || isCreatingCard}
                      className={composerStyles.submit}
                    >
                      <Plus size={14} /> {isCreatingCard ? t.btn_creating : 'Crear tarjeta'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCardTitle(''); setCardCreateError(''); setIsAddingCard(false); }}
                      disabled={isCreatingCard}
                      className={composerStyles.cancel}
                    >
                      Cancelar
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingCard(true)}
                  className="flex items-center gap-2 w-full transition-colors"
                  style={{
                    minHeight: '38px', padding: '8px 10px', borderRadius: '8px', fontSize: '12px', fontWeight: 650,
                    color: C.text2, background: C.surface,
                    border: `1px solid ${C.border}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget.style.borderColor = C.accent); (e.currentTarget.style.color = C.accent); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border); (e.currentTarget.style.color = C.text2); }}
                >
                  <Plus size={14} /> Añadir tarjeta
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Delete confirm ─────────────────────────────────── */}
      {showDeleteConfirm && canEdit && (
        <>
          <div
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={() => setShowDeleteConfirm(false)}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div
              className="pointer-events-auto rounded-[10px] overflow-hidden w-full"
              style={{ maxWidth: '380px', background: C.bg2, border: `1px solid ${C.red}44`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '20px 20px 0' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="flex items-center justify-center rounded-[7px] flex-shrink-0"
                    style={{ width: '34px', height: '34px', background: `${C.red}18`, border: `1px solid ${C.red}40` }}
                  >
                    <Trash2 size={15} style={{ color: C.red }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{t.list_delete_modal_title}</p>
                    <p style={{ fontSize: '12px', color: C.text3 }}>Esta acción no se puede deshacer</p>
                  </div>
                </div>
                <div
                  style={{
                    borderRadius: '7px', padding: '10px 12px', marginBottom: '16px',
                    background: C.surface, border: `1px solid ${C.border}`, fontSize: '13px', color: C.text2,
                  }}
                >
                  {allListCards.length > 0 ? (
                    <span style={{ color: C.red }}>
                      ⚠ Esta lista tiene <strong>{allListCards.length}</strong> tarjeta{allListCards.length !== 1 ? 's' : ''}. Muévelas o elimínalas primero.
                    </span>
                  ) : (
                    <>¿Eliminar la lista <strong style={{ color: C.text }}>{list.name}</strong>?</>
                  )}
                </div>
              </div>
              <div
                className="flex gap-2"
                style={{ padding: '12px 20px 16px', borderTop: `1px solid ${C.border}` }}
              >
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 rounded-[7px] font-medium transition-colors"
                  style={{ padding: '8px 0', fontSize: '13px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2 }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.text4)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border2)}
                >
                  {t.btn_cancel}
                </button>
                <button
                  onClick={handleDelete}
                  disabled={allListCards.length > 0}
                  className="flex-1 rounded-[7px] font-medium text-white transition-colors"
                  style={{ padding: '8px 0', fontSize: '13px', background: C.red, opacity: allListCards.length > 0 ? 0.4 : 1 }}
                  onMouseEnter={(e) => { if (allListCards.length === 0) (e.currentTarget.style.background = '#dc2626'); }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = C.red)}
                >
                  {t.btn_delete}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
