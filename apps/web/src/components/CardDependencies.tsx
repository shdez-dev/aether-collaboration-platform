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
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { CardDependency } from '@aether/types';

interface CardDependenciesProps {
  cardId: string;
  /** Callback cuando cambian las dependencias (para actualizar la mini-card) */
  onDepsChange?: (blockedByCount: number, blockingCount: number) => void;
}

interface SearchResult {
  id: string;
  title: string;
  completed: boolean;
  listId: string;
  listName: string;
}

const API = process.env.NEXT_PUBLIC_API_URL;

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

  return (
    <div
      className={`group flex items-center gap-2.5 px-3 py-2 border transition-colors ${
        card?.completed
          ? 'border-success/30 bg-success/5'
          : 'border-border bg-surface/50 hover:border-border-light'
      }`}
    >
      {/* Estado */}
      {card?.completed ? (
        <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
      ) : (
        <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
      )}

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p
          className={`text-sm font-mono truncate ${
            card?.completed ? 'line-through text-text-muted' : 'text-text-primary'
          }`}
        >
          {card?.title ?? '(card eliminada)'}
        </p>
        {card?.listName && <p className="text-xs text-text-muted truncate">{card.listName}</p>}
      </div>

      {/* Badge estado */}
      <span
        className={`text-[10px] px-1.5 py-0.5 border font-mono flex-shrink-0 ${
          card?.completed
            ? 'text-success border-success/40 bg-success/10'
            : 'text-text-muted border-border'
        }`}
      >
        {card?.completed ? t.dep_status_done : t.dep_status_pending}
      </span>

      {/* Eliminar */}
      {canEdit && (
        <button
          onClick={() => onRemove(dep.id)}
          title={t.dep_remove_confirm}
          className="opacity-0 group-hover:opacity-100 p-0.5 text-text-muted hover:text-error transition-all flex-shrink-0"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

// ── Componente principal ─────────────────────────────────────────────────────
export function CardDependencies({ cardId, onDepsChange }: CardDependenciesProps) {
  const t = useT();
  const { accessToken } = useAuthStore();
  const { currentWorkspace } = useWorkspaceStore();
  const userRole = currentWorkspace?.userRole;
  const canEdit = userRole !== 'VIEWER';

  const [blockedBy, setBlockedBy] = useState<CardDependency[]>([]);
  const [blocking, setBlocking] = useState<CardDependency[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Picker de nueva dependencia
  const [showPicker, setShowPicker] = useState<'blockedBy' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Collapse de secciones
  const [showBlockedBy, setShowBlockedBy] = useState(true);
  const [showBlocking, setShowBlocking] = useState(true);

  const searchRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // ── Cargar dependencias ──────────────────────────────────────────────────
  const fetchDeps = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/cards/${cardId}/dependencies`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (res.ok) {
        const { data } = await res.json();
        setBlockedBy(data.blockedBy ?? []);
        setBlocking(data.blocking ?? []);
      }
    } finally {
      setIsLoading(false);
    }
  }, [cardId, accessToken]);

  useEffect(() => {
    fetchDeps();
  }, [fetchDeps]);

  useEffect(() => {
    onDepsChange?.(blockedBy.length, blocking.length);
  }, [blockedBy.length, blocking.length, onDepsChange]);

  // Focus en el input al abrir el picker
  useEffect(() => {
    if (showPicker) {
      setTimeout(() => searchRef.current?.focus(), 50);
    }
  }, [showPicker]);

  // Cerrar picker al hacer clic fuera
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        closePicker();
      }
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
        const res = await fetch(
          `${API}/api/cards/${cardId}/dependencies/search?q=${encodeURIComponent(searchQuery)}`,
          { headers: { Authorization: `Bearer ${accessToken}` } }
        );
        if (res.ok) {
          const { data } = await res.json();
          setSearchResults(data.cards ?? []);
        }
      } finally {
        setIsSearching(false);
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [searchQuery, showPicker, cardId, accessToken]);

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
      const res = await fetch(`${API}/api/cards/${cardId}/dependencies`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ blockingCardId }),
      });

      const json = await res.json();

      if (!res.ok) {
        if (json.error?.code === 'CIRCULAR_DEPENDENCY') {
          setErrorMsg(t.dep_circular_error);
        } else {
          setErrorMsg(json.error?.message ?? 'Error');
        }
        return;
      }

      setBlockedBy((prev) => [...prev, json.data.dependency]);
      closePicker();
    } finally {
      setIsAdding(false);
    }
  };

  // ── Eliminar dependencia ──────────────────────────────────────────────────
  const handleRemove = async (depId: string) => {
    // Determinar si es blockedBy o blocking
    const isBlockedBy = blockedBy.some((d) => d.id === depId);

    // Optimistic
    if (isBlockedBy) setBlockedBy((prev) => prev.filter((d) => d.id !== depId));
    else setBlocking((prev) => prev.filter((d) => d.id !== depId));

    try {
      const res = await fetch(`${API}/api/cards/${cardId}/dependencies/${depId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!res.ok) {
        // Rollback
        await fetchDeps();
      }
    } catch {
      await fetchDeps();
    }
  };

  // ── Helpers visuales ─────────────────────────────────────────────────────
  const isCurrentlyBlocked = blockedBy.some((d) => !d.relatedCard?.completed);
  const totalDeps = blockedBy.length + blocking.length;

  if (isLoading) {
    return (
      <section>
        <div className="flex items-center gap-2 mb-3">
          <Link2 className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
            {t.dep_section_title}
          </h3>
        </div>
        <div className="h-10 bg-surface border border-border animate-pulse" />
      </section>
    );
  }

  return (
    <section>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Link2 className="w-4 h-4 text-text-muted" />
          <h3 className="text-sm font-bold text-text-primary font-mono tracking-wider">
            {t.dep_section_title}
          </h3>
          {totalDeps > 0 && (
            <span className="text-xs text-text-muted font-mono">({totalDeps})</span>
          )}
          {/* Badge de bloqueo activo */}
          {isCurrentlyBlocked && (
            <span className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] bg-warning/10 border border-warning/40 text-warning font-mono">
              <AlertTriangle className="w-3 h-3" />
              {t.dep_badge_blocked}
            </span>
          )}
        </div>

        {/* Botón agregar bloqueante */}
        {canEdit && (
          <button
            onClick={() => setShowPicker(showPicker ? null : 'blockedBy')}
            className={`flex items-center gap-1 px-2 py-1 text-xs border transition-colors ${
              showPicker
                ? 'border-accent text-accent bg-accent/10'
                : 'border-border text-text-muted hover:border-accent hover:text-accent'
            }`}
          >
            <Link2 className="w-3 h-3" />
            {t.dep_add_blocking}
          </button>
        )}
      </div>

      {/* ── Picker para agregar dependencia ─────────────────────────────── */}
      {showPicker && canEdit && (
        <div ref={pickerRef} className="mb-4 border border-accent/40 bg-card shadow-lg">
          {/* Explicación contextual */}
          <div className="px-3 py-2 bg-accent/5 border-b border-accent/20 flex items-start gap-2">
            <ArrowRight className="w-3.5 h-3.5 text-accent mt-0.5 flex-shrink-0" />
            <p className="text-xs text-text-secondary font-mono leading-relaxed">
              {t.dep_blocked_by_desc}
            </p>
          </div>

          {/* Search input */}
          <div className="relative p-2">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted pointer-events-none" />
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.dep_search_placeholder}
              className="w-full pl-8 pr-3 py-1.5 text-sm bg-surface border border-border focus:outline-none focus:border-accent transition-colors font-mono"
            />
          </div>

          {/* Error */}
          {errorMsg && (
            <p className="px-3 pb-2 text-xs text-error font-mono flex items-center gap-1">
              <AlertTriangle className="w-3 h-3" /> {errorMsg}
            </p>
          )}

          {/* Resultados */}
          <div className="max-h-48 overflow-y-auto border-t border-border">
            {isSearching ? (
              <div className="px-3 py-3 text-xs text-text-muted font-mono text-center">
                Buscando...
              </div>
            ) : searchResults.length === 0 ? (
              <div className="px-3 py-3 text-xs text-text-muted font-mono text-center">
                {searchQuery ? t.dep_no_cards_found : t.dep_search_placeholder}
              </div>
            ) : (
              searchResults.map((card) => (
                <button
                  key={card.id}
                  onClick={() => handleAdd(card.id)}
                  disabled={isAdding}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-surface transition-colors border-b border-border/50 last:border-0 disabled:opacity-50"
                >
                  {card.completed ? (
                    <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                  ) : (
                    <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p
                      className={`text-sm font-mono truncate ${card.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}
                    >
                      {card.title}
                    </p>
                    <p className="text-xs text-text-muted truncate">{card.listName}</p>
                  </div>
                  <span className="text-[10px] text-text-muted font-mono flex-shrink-0">
                    {card.id.slice(0, 6)}
                  </span>
                </button>
              ))
            )}
          </div>

          {/* Cerrar */}
          <div className="p-2 border-t border-border flex justify-end">
            <button
              onClick={closePicker}
              className="text-xs text-text-muted hover:text-text-primary px-2 py-1"
            >
              {t.btn_cancel}
            </button>
          </div>
        </div>
      )}

      {/* ── Sección: Bloqueada por ───────────────────────────────────────── */}
      <div className="space-y-1 mb-3">
        <button
          onClick={() => setShowBlockedBy((v) => !v)}
          className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors w-full text-left py-1"
        >
          {showBlockedBy ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          <span className="font-mono uppercase tracking-wider">{t.dep_blocked_by_title}</span>
          {blockedBy.length > 0 && (
            <span
              className={`ml-auto px-1.5 py-0 text-[10px] rounded-full font-mono ${
                isCurrentlyBlocked ? 'bg-warning/20 text-warning' : 'bg-success/20 text-success'
              }`}
            >
              {blockedBy.length}
            </span>
          )}
        </button>

        {showBlockedBy && (
          <div className="space-y-1 pl-1">
            {blockedBy.length === 0 ? (
              <p className="text-xs text-text-muted font-mono py-1 pl-2 italic">
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
        <div className="space-y-1">
          <button
            onClick={() => setShowBlocking((v) => !v)}
            className="flex items-center gap-2 text-xs text-text-muted hover:text-text-primary transition-colors w-full text-left py-1"
          >
            {showBlocking ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            <span className="font-mono uppercase tracking-wider">{t.dep_blocking_title}</span>
            <span className="ml-auto px-1.5 py-0 text-[10px] rounded-full font-mono bg-surface text-text-muted">
              {blocking.length}
            </span>
          </button>

          {showBlocking && (
            <div className="space-y-1 pl-1">
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
