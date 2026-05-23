// apps/web/src/components/CardDependencies.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Link2,
  X,
  Search,
  CheckCircle2,
  Circle,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { useTimelineStore } from '@/stores/timelineStore';
import { useCardStore } from '@/stores/cardStore';
import { C } from '@/lib/colors';
import type { CardDependency } from '@aether/types';

interface CardDependenciesProps {
  cardId: string;
  onDepsChange?: (blockedByCount: number, blockingCount: number) => void;
}

interface SearchResult {
  id: string;
  title: string;
  completed: boolean;
  listId: string;
  listName: string;
}

// ── Sub-componente: ítem de dependencia ──────────────────────────────────────
function DepItem({
  dep,
  onRemove,
  canEdit,
}: {
  dep: CardDependency;
  onRemove: (depId: string) => void;
  canEdit: boolean;
}) {
  const t = useT();
  const card = dep.relatedCard;
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 10px',
        borderRadius: '6px',
        border: `1px solid ${card?.completed ? `${C.green}40` : C.border}`,
        background: card?.completed ? `${C.green}08` : hovered ? C.hover : C.surface,
        transition: 'background 0.12s, border-color 0.12s',
      }}
    >
      {/* Estado */}
      {card?.completed
        ? <CheckCircle2 style={{ width: '14px', height: '14px', color: C.green, flexShrink: 0 }} />
        : <Circle style={{ width: '14px', height: '14px', color: C.text4, flexShrink: 0 }} />
      }

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '12px', color: card?.completed ? C.text4 : C.text,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          textDecoration: card?.completed ? 'line-through' : 'none',
        }}>
          {card?.title ?? '(card eliminada)'}
        </p>
        {card?.listName && (
          <p style={{ fontSize: '10.5px', color: C.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {card.listName}
          </p>
        )}
      </div>

      {/* Badge estado */}
      <span style={{
        fontSize: '10px', padding: '1px 6px',
        borderRadius: '4px',
        border: `1px solid ${card?.completed ? `${C.green}50` : C.border}`,
        background: card?.completed ? `${C.green}14` : 'transparent',
        color: card?.completed ? C.green : C.text4,
        flexShrink: 0,
      }}>
        {card?.completed ? t.dep_status_done : t.dep_status_pending}
      </span>

      {/* Eliminar */}
      {canEdit && (
        <button
          onClick={() => onRemove(dep.id)}
          title={t.dep_remove_confirm}
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: '20px', height: '20px', borderRadius: '4px',
            background: 'transparent', border: 'none', cursor: 'pointer',
            color: C.text4, padding: 0, flexShrink: 0,
            opacity: hovered ? 1 : 0, transition: 'opacity 0.12s, color 0.12s',
          }}
          onMouseEnter={(e) => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = `${C.red}14`; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = C.text4; e.currentTarget.style.background = 'transparent'; }}
        >
          <X style={{ width: '12px', height: '12px' }} />
        </button>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function CardDependencies({ cardId, onDepsChange }: CardDependenciesProps) {
  const t = useT();
  const { currentWorkspace } = useWorkspaceStore();
  const invalidateTimeline = useTimelineStore((s) => s.invalidate);
  const updateCard = useCardStore((s) => s.updateCard);
  const userRole = currentWorkspace?.userRole;
  const canEdit = userRole !== 'VIEWER';

  const [blockedBy, setBlockedBy] = useState<CardDependency[]>([]);
  const [blocking, setBlocking] = useState<CardDependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [showPicker, setShowPicker] = useState<'blockedBy' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [showBlockedBy, setShowBlockedBy] = useState(true);
  const [showBlocking, setShowBlocking] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ── Cargar dependencias ──────────────────────────────────────────────────
  const fetchDeps = useCallback(async () => {
    try {
      const res = await apiService.get<{ blockedBy: any[]; blocking: any[] }>(
        `/api/cards/${cardId}/dependencies`,
        true
      );
      if (res.success && res.data) {
        setBlockedBy(res.data.blockedBy ?? []);
        setBlocking(res.data.blocking ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cardId]);

  useEffect(() => { fetchDeps(); }, [fetchDeps]);
  useEffect(() => { onDepsChange?.(blockedBy.length, blocking.length); }, [blockedBy.length, blocking.length, onDepsChange]);

  useEffect(() => {
    if (showPicker) setTimeout(() => searchRef.current?.focus(), 50);
  }, [showPicker]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) closePicker();
    };
    if (showPicker) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showPicker]);

  // ── Búsqueda con debounce ─────────────────────────────────────────────────
  useEffect(() => {
    if (!showPicker) return;
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await apiService.get<{ cards: any[] }>(
          `/api/cards/${cardId}/dependencies/search?q=${encodeURIComponent(searchQuery)}`,
          true
        );
        if (res.success && res.data) setSearchResults(res.data.cards ?? []);
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, showPicker, cardId]);

  const closePicker = () => {
    setShowPicker(null);
    setSearchQuery('');
    setSearchResults([]);
    setErrorMsg(null);
  };

  // ── Agregar dependencia ───────────────────────────────────────────────────
  const handleAdd = async (blockingCardId: string) => {
    if (isAdding) return;
    setIsAdding(true);
    setErrorMsg(null);
    try {
      const res = await apiService.post<{ dependency: any }>(
        `/api/cards/${cardId}/dependencies`,
        { blockingCardId },
        true
      );
      if (!res.success) {
        setErrorMsg(res.error?.code === 'CIRCULAR_DEPENDENCY' ? t.dep_circular_error : (res.error?.message ?? 'Error'));
        return;
      }
      const newDep = res.data!.dependency;
      setBlockedBy((prev) => [...prev, newDep]);
      const pendingCount = [...blockedBy, newDep].filter((d) => d.relatedCard && !d.relatedCard.completed).length;
      updateCard(cardId, { blockedByPendingCount: pendingCount, blockedBy: [...blockedBy, newDep] as any });
      closePicker();
      invalidateTimeline();
    } finally {
      setIsAdding(false);
    }
  };

  // ── Eliminar dependencia ──────────────────────────────────────────────────
  const handleRemove = async (depId: string) => {
    const isBlockedBy = blockedBy.some((d) => d.id === depId);
    if (isBlockedBy) {
      const newBlockedBy = blockedBy.filter((d) => d.id !== depId);
      setBlockedBy(newBlockedBy);
      const pendingCount = newBlockedBy.filter((d) => d.relatedCard && !d.relatedCard.completed).length;
      updateCard(cardId, { blockedByPendingCount: pendingCount, blockedBy: newBlockedBy as any });
    } else {
      setBlocking((prev) => prev.filter((d) => d.id !== depId));
    }
    try {
      const res = await apiService.delete(`/api/cards/${cardId}/dependencies/${depId}`, true);
      if (!res.success) await fetchDeps();
      else invalidateTimeline();
    } catch {
      await fetchDeps();
    }
  };

  const isCurrentlyBlocked = blockedBy.some((d) => !d.relatedCard?.completed);
  const totalDeps = blockedBy.length + blocking.length;

  if (isLoading) {
    return (
      <section>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <Link2 style={{ width: '15px', height: '15px', color: C.text4 }} />
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: C.text, margin: 0 }}>{t.dep_section_title}</h3>
        </div>
        <div style={{ height: '40px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border}`, animation: 'pulse 1.5s ease-in-out infinite' }} />
      </section>
    );
  }

  return (
    <section>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link2 style={{ width: '15px', height: '15px', color: C.text4 }} />
          <h3 style={{ fontSize: '12px', fontWeight: 700, color: C.text, margin: 0 }}>{t.dep_section_title}</h3>
          {totalDeps > 0 && (
            <span style={{ fontSize: '11px', color: C.text4 }}>({totalDeps})</span>
          )}
          {isCurrentlyBlocked && (
            <span style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              padding: '2px 7px', fontSize: '10px', borderRadius: '4px',
              background: `${C.amber}18`, border: `1px solid ${C.amber}50`, color: C.amber,
            }}>
              <AlertTriangle style={{ width: '10px', height: '10px' }} />
              {t.dep_badge_blocked}
            </span>
          )}
        </div>

        {canEdit && (
          <button
            onClick={() => setShowPicker(showPicker ? null : 'blockedBy')}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '4px 10px', borderRadius: '5px', fontSize: '11.5px', cursor: 'pointer',
              border: `1px solid ${showPicker ? C.accent : C.border}`,
              background: showPicker ? `${C.accent}14` : 'transparent',
              color: showPicker ? C.accent : C.text3,
              transition: 'all 0.12s',
            }}
            onMouseEnter={(e) => { if (!showPicker) { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; } }}
            onMouseLeave={(e) => { if (!showPicker) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text3; } }}
          >
            <Link2 style={{ width: '11px', height: '11px' }} />
            {t.dep_add_blocking}
          </button>
        )}
      </div>

      {/* ── Picker para agregar dependencia ─────────────────────────────── */}
      {showPicker && canEdit && (
        <div
          ref={pickerRef}
          style={{
            marginBottom: '16px', borderRadius: '8px',
            border: `1px solid ${C.accent}50`,
            background: C.surface,
            boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
            overflow: 'hidden',
          }}
        >
          {/* Descripción contextual */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '8px',
            padding: '8px 12px',
            background: `${C.accent}0a`,
            borderBottom: `1px solid ${C.accent}25`,
          }}>
            <ArrowRight style={{ width: '13px', height: '13px', color: C.accent, marginTop: '1px', flexShrink: 0 }} />
            <p style={{ fontSize: '11.5px', color: C.text3, margin: 0, lineHeight: 1.5 }}>
              {t.dep_blocked_by_desc}
            </p>
          </div>

          {/* Search input */}
          <div style={{ position: 'relative', padding: '8px' }}>
            <Search style={{ position: 'absolute', left: '18px', top: '50%', transform: 'translateY(-50%)', width: '13px', height: '13px', color: C.text4, pointerEvents: 'none' }} />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.dep_search_placeholder}
              style={{
                width: '100%', paddingLeft: '32px', paddingRight: '10px', paddingTop: '6px', paddingBottom: '6px',
                fontSize: '12px', borderRadius: '6px',
                background: C.bg2, border: `1px solid ${C.border}`,
                color: C.text, outline: 'none', boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <p style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '0 12px 8px', fontSize: '11.5px', color: C.red, margin: 0 }}>
              <AlertTriangle style={{ width: '12px', height: '12px' }} /> {errorMsg}
            </p>
          )}

          {/* Resultados */}
          <div style={{ maxHeight: '192px', overflowY: 'auto', borderTop: `1px solid ${C.border}` }}>
            {isSearching ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: C.text4 }}>Buscando...</div>
            ) : searchResults.length === 0 ? (
              <div style={{ padding: '12px', textAlign: 'center', fontSize: '12px', color: C.text4 }}>
                {searchQuery ? t.dep_no_cards_found : t.dep_search_placeholder}
              </div>
            ) : (
              searchResults.map((card, idx) => (
                <button
                  key={card.id}
                  onClick={() => handleAdd(card.id)}
                  disabled={isAdding}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                    padding: '8px 12px', textAlign: 'left',
                    background: 'transparent', border: 'none',
                    borderBottom: idx < searchResults.length - 1 ? `1px solid ${C.border}` : 'none',
                    cursor: isAdding ? 'not-allowed' : 'pointer',
                    opacity: isAdding ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {card.completed
                    ? <CheckCircle2 style={{ width: '14px', height: '14px', color: C.green, flexShrink: 0 }} />
                    : <Circle style={{ width: '14px', height: '14px', color: C.text4, flexShrink: 0 }} />
                  }
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: '12px', color: card.completed ? C.text4 : C.text, margin: 0,
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      textDecoration: card.completed ? 'line-through' : 'none',
                    }}>
                      {card.title}
                    </p>
                    <p style={{ fontSize: '10.5px', color: C.text4, margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {card.listName}
                    </p>
                  </div>
                  <span style={{ fontSize: '10px', color: C.text4, flexShrink: 0 }}>
                    {card.id.slice(0, 6)}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Cerrar */}
          <div style={{ padding: '6px 8px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
            <button
              onClick={closePicker}
              style={{ padding: '4px 10px', fontSize: '11.5px', color: C.text3, background: 'transparent', border: 'none', cursor: 'pointer', borderRadius: '5px' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text; e.currentTarget.style.background = C.hover; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text3; e.currentTarget.style.background = 'transparent'; }}
            >
              {t.btn_cancel}
            </button>
          </div>
        </div>
      )}

      {/* ── Sección: Bloqueada por ───────────────────────────────────────── */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={() => setShowBlockedBy((v) => !v)}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            width: '100%', textAlign: 'left', padding: '3px 0',
            background: 'transparent', border: 'none', cursor: 'pointer', color: C.text4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
          onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
        >
          {showBlockedBy
            ? <ChevronUp style={{ width: '12px', height: '12px' }} />
            : <ChevronDown style={{ width: '12px', height: '12px' }} />
          }
          <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            {t.dep_blocked_by_title}
          </span>
          {blockedBy.length > 0 && (
            <span style={{
              marginLeft: 'auto', padding: '0 6px', fontSize: '10px', borderRadius: '10px',
              background: isCurrentlyBlocked ? `${C.amber}20` : `${C.green}20`,
              color: isCurrentlyBlocked ? C.amber : C.green,
            }}>
              {blockedBy.length}
            </span>
          )}
        </button>

        {showBlockedBy && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px', marginTop: '4px' }}>
            {blockedBy.length === 0 ? (
              <p style={{ fontSize: '11.5px', color: C.text4, fontStyle: 'italic', padding: '2px 6px', margin: 0 }}>
                {t.dep_empty_blocked_by}
              </p>
            ) : (
              blockedBy.map((dep) => (
                <DepItem key={dep.id} dep={dep} onRemove={handleRemove} canEdit={canEdit} />
              ))
            )}
          </div>
        )}
      </div>

      {/* ── Sección: Bloquea a ───────────────────────────────────────────── */}
      {blocking.length > 0 && (
        <div>
          <button
            onClick={() => setShowBlocking((v) => !v)}
            style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              width: '100%', textAlign: 'left', padding: '3px 0',
              background: 'transparent', border: 'none', cursor: 'pointer', color: C.text4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
            onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
          >
            {showBlocking
              ? <ChevronUp style={{ width: '12px', height: '12px' }} />
              : <ChevronDown style={{ width: '12px', height: '12px' }} />
            }
            <span style={{ fontSize: '10.5px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              {t.dep_blocking_title}
            </span>
            <span style={{
              marginLeft: 'auto', padding: '0 6px', fontSize: '10px', borderRadius: '10px',
              background: C.hover, color: C.text4,
            }}>
              {blocking.length}
            </span>
          </button>

          {showBlocking && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '4px', marginTop: '4px' }}>
              {blocking.map((dep) => (
                <DepItem key={dep.id} dep={dep} onRemove={handleRemove} canEdit={canEdit} />
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
