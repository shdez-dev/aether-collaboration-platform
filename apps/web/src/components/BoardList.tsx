// apps/web/src/components/BoardList.tsx
'use client';

import { useState } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useCardStore } from '@/stores/cardStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useSortable } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from './Card';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Plus, Trash2, Pencil, GripVertical } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';


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

  const t = useT();

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
    setIsCreatingCard(true);
    try {
      const r = await apiService.post<{ card: any }>(`/api/lists/${list.id}/cards`, { title: cardTitle.trim() }, true);
      if (!r.success) throw new Error(r.error?.message || 'Error al crear la tarjeta');
      addCard(list.id, r.data!.card);
      setSelectedCard(r.data!.card);
      setCardTitle(''); setIsAddingCard(false);
    } catch (err: any) {
      alert(`Error al crear la tarjeta: ${err.message}`);
    } finally { setIsCreatingCard(false); }
  };

  const allListCards = cards[list.id] || [];
  const listCards    = filteredCardsProp ?? allListCards;
  const cardIds      = listCards.map((c) => c.id);
  const isFiltered   = filteredCardsProp !== undefined;

  return (
    <>
      <div ref={setSortableNodeRef} style={{ ...style, width: '272px', flexShrink: 0 }}>
        <div
          style={{
            background: C.bg2,
            border: `1px solid ${isOver ? C.accent : C.border}`,
            borderRadius: '10px',
            display: 'flex',
            flexDirection: 'column',
            transition: 'border-color 0.15s',
            boxShadow: isOver ? `0 0 0 1px ${C.accent}33` : 'none',
          }}
        >
          {/* ── Header ─────────────────────────────────────── */}
          <div
            style={{
              padding: '10px 10px 10px 8px',
              borderBottom: `1px solid ${C.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              flexShrink: 0,
            }}
          >
            {/* Drag handle */}
            <div
              {...(canEdit ? attributes : {})}
              {...(canEdit ? listeners : {})}
              style={{
                cursor: canEdit ? 'grab' : 'default',
                color: C.text4,
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
                padding: '2px',
                borderRadius: '4px',
              }}
              onMouseEnter={(e) => { if (canEdit) (e.currentTarget.style.color = C.text3); }}
              onMouseLeave={(e) => { if (canEdit) (e.currentTarget.style.color = C.text4); }}
            >
              <GripVertical size={14} />
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
                  flex: 1, fontSize: '13px', fontWeight: 600, color: C.text,
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
                fontSize: '10.5px', fontWeight: 600, color: C.text4,
                background: C.hover, border: `1px solid ${C.border2}`,
                borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
              }}
            >
              {isFiltered ? `${listCards.length}/${allListCards.length}` : allListCards.length}
            </span>

            {/* Menu */}
            {canEdit && (
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <button
                  onClick={(e) => { e.stopPropagation(); setIsMenuOpen((v) => !v); }}
                  style={{
                    width: '24px', height: '24px', borderRadius: '5px',
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
                      background: '#13161b', border: `1px solid ${C.border2}`,
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
              padding: '8px',
              minHeight: '80px',
              maxHeight: '56vh',
              overflowY: 'auto',
              overflowX: 'hidden',
              scrollbarWidth: 'thin',
              scrollbarColor: `${C.border2} transparent`,
            }}
          >
            <SortableContext items={cardIds} strategy={verticalListSortingStrategy}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {listCards.length > 0 ? (
                  listCards.map((card) => <Card key={card.id} card={card} />)
                ) : (
                  <div
                    style={{
                      textAlign: 'center', padding: '24px 12px',
                      fontSize: '12px',
                      color: isOver ? C.accent : C.text4,
                      border: `1px dashed ${isOver ? C.accent : C.border}`,
                      borderRadius: '6px',
                      transition: 'border-color 0.15s, color 0.15s',
                    }}
                  >
                    {isOver ? 'Soltar aquí' : isFiltered ? 'Sin resultados' : 'Sin tarjetas'}
                  </div>
                )}
              </div>
            </SortableContext>
          </div>

          {/* ── Add card ───────────────────────────────────── */}
          {canEdit && (
            <div style={{ padding: '0 8px 8px', flexShrink: 0 }}>
              {isAddingCard ? (
                <form onSubmit={handleCreateCard} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <textarea
                    value={cardTitle}
                    onChange={(e) => setCardTitle(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Escape') { setCardTitle(''); setIsAddingCard(false); } }}
                    placeholder={t.card_placeholder_description}
                    autoFocus
                    rows={2}
                    disabled={isCreatingCard}
                    style={{
                      width: '100%', background: C.surface, border: `1px solid ${C.accent}`,
                      borderRadius: '6px', padding: '7px 9px', fontSize: '12.5px',
                      color: C.text, outline: 'none', resize: 'none',
                    }}
                  />
                  <div style={{ display: 'flex', gap: '5px' }}>
                    <button
                      type="submit"
                      disabled={!cardTitle.trim() || isCreatingCard}
                      style={{
                        flex: 1, padding: '5px 0', borderRadius: '5px', fontSize: '12px', fontWeight: 500,
                        background: C.accent, color: '#fff', opacity: !cardTitle.trim() ? 0.5 : 1,
                        cursor: !cardTitle.trim() ? 'not-allowed' : 'pointer',
                      }}
                    >
                      {isCreatingCard ? t.btn_creating : t.checklist_btn_add}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setCardTitle(''); setIsAddingCard(false); }}
                      disabled={isCreatingCard}
                      style={{
                        padding: '5px 10px', borderRadius: '5px', fontSize: '12px',
                        background: C.hover, border: `1px solid ${C.border2}`, color: C.text2,
                      }}
                    >
                      ✕
                    </button>
                  </div>
                </form>
              ) : (
                <button
                  onClick={() => setIsAddingCard(true)}
                  className="flex items-center gap-1.5 w-full transition-colors"
                  style={{
                    padding: '6px 8px', borderRadius: '6px', fontSize: '12px',
                    color: C.text4, background: 'transparent',
                    border: `1px dashed ${C.border}`,
                  }}
                  onMouseEnter={(e) => { (e.currentTarget.style.borderColor = C.accent); (e.currentTarget.style.color = C.accent); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border); (e.currentTarget.style.color = C.text4); }}
                >
                  <Plus size={12} /> {t.addlist_btn}
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
              style={{ maxWidth: '380px', background: '#13161b', border: `1px solid ${C.red}44`, boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
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
