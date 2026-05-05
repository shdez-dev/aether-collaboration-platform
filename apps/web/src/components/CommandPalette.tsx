'use client';

// apps/web/src/components/CommandPalette.tsx
// Paleta de búsqueda global — se activa con ⌘K / Ctrl+K

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Tokens de color ───────────────────────────────────────────────────────────

// ── Types ─────────────────────────────────────────────────────────────────────

interface SearchCard {
  id: string; title: string; priority: string | null; dueDate: string | null;
  listName: string; boardId: string; boardName: string;
  workspaceId: string; workspaceName: string;
}
interface SearchProject {
  id: string; name: string; status: string; color: string | null;
  workspaceId: string; workspaceName: string;
}
interface SearchBoard {
  id: string; name: string; workspaceId: string; workspaceName: string;
}
interface SearchWorkspace {
  id: string; name: string; description: string | null; color: string | null;
}
interface SearchDocument {
  id: string; title: string; workspaceId: string; workspaceName: string;
}
interface SearchResults {
  cards: SearchCard[];
  projects: SearchProject[];
  boards: SearchBoard[];
  workspaces: SearchWorkspace[];
  documents: SearchDocument[];
}

// ── Icons SVG inline ──────────────────────────────────────────────────────────

const IconCard = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <rect x="1" y="2" width="12" height="10" rx="1.5" />
    <path d="M4 6h6M4 8.5h3" />
  </svg>
);
const IconProject = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <circle cx="7" cy="7" r="5" />
    <path d="M7 4v3l2 2" />
  </svg>
);
const IconBoard = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <rect x="1" y="2" width="12" height="10" rx="1" />
    <path d="M5 2v10M9 2v10" />
  </svg>
);
const IconWorkspace = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <rect x="1" y="3" width="12" height="8" rx="1" />
    <path d="M4 3V2h6v1" />
  </svg>
);
const IconDoc = () => (
  <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
    <path d="M3 1h6l3 3v9H3V1z" />
    <path d="M9 1v3h3M5 7h4M5 9.5h2.5" />
  </svg>
);

const PRIORITY_COLOR: Record<string, string> = {
  URGENT: '#ef4444',
  HIGH:   '#f59e0b',
  MEDIUM: '#3b82f6',
  LOW:    '#6b7280',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function highlight(text: string, q: string) {
  if (!q) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx === -1) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark style={{ background: `${C.accent}33`, color: C.accent, borderRadius: '2px' }}>
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

// ── Result item ───────────────────────────────────────────────────────────────

function ResultItem({
  icon,
  label,
  sub,
  accent,
  isSelected,
  onClick,
  q,
}: {
  icon: React.ReactNode;
  label: string;
  sub?: string;
  accent?: string;
  isSelected: boolean;
  onClick: () => void;
  q: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' });
    }
  }, [isSelected]);

  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        padding: '7px 12px',
        cursor: 'pointer',
        borderRadius: '6px',
        background: isSelected ? C.hover : 'transparent',
        transition: 'background 0.1s',
      }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = isSelected ? C.hover : 'transparent'; }}
    >
      <span style={{ color: accent || C.text3, flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: '13px', color: C.text, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {highlight(label, q)}
        </span>
        {sub && (
          <span style={{ fontSize: '11px', color: C.text3, display: 'block', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
            {sub}
          </span>
        )}
      </span>
    </div>
  );
}

// ── Section header ────────────────────────────────────────────────────────────

function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ padding: '8px 12px 4px', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: C.text4 }}>
      {label}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

type FlatResult = { type: string; id: string; label: string; sub?: string; accent?: string; action: () => void };

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Foco al abrir
  useEffect(() => {
    if (open) {
      setQuery('');
      setResults(null);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Búsqueda con debounce
  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await apiService.get<SearchResults>(`/api/search?q=${encodeURIComponent(q)}`, true);
      if (res.success && res.data) setResults(res.data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(query), 200);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, doSearch]);

  // Flatten results para navegación por teclado
  const flat: FlatResult[] = [];
  if (results) {
    results.workspaces.forEach((w) => flat.push({
      type: 'workspace', id: w.id, label: w.name, sub: w.description ?? undefined,
      action: () => { router.push(`/dashboard/workspaces/${w.id}`); onClose(); },
    }));
    results.projects.forEach((p) => flat.push({
      type: 'project', id: p.id, label: p.name, sub: p.workspaceName,
      accent: p.color ?? undefined,
      action: () => { router.push(`/dashboard/projects/${p.id}`); onClose(); },
    }));
    results.boards.forEach((b) => flat.push({
      type: 'board', id: b.id, label: b.name, sub: b.workspaceName,
      action: () => { router.push(`/dashboard/workspaces/${b.workspaceId}?board=${b.id}`); onClose(); },
    }));
    results.cards.forEach((c) => flat.push({
      type: 'card', id: c.id, label: c.title,
      sub: `${c.boardName} · ${c.listName}`,
      accent: c.priority ? PRIORITY_COLOR[c.priority] : undefined,
      action: () => { router.push(`/dashboard/workspaces/${c.workspaceId}?board=${c.boardId}&card=${c.id}`); onClose(); },
    }));
    results.documents.forEach((d) => flat.push({
      type: 'document', id: d.id, label: d.title, sub: d.workspaceName,
      action: () => { router.push(`/dashboard/documents/${d.id}`); onClose(); },
    }));
  }

  // Teclado
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, flat.length - 1)); }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
      if (e.key === 'Enter' && flat[selectedIdx]) { flat[selectedIdx].action(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, flat, selectedIdx, onClose]);

  // Reset selectedIdx when results change
  useEffect(() => { setSelectedIdx(0); }, [results]);

  if (!open) return null;

  const isEmpty = results && flat.length === 0;
  const hasResults = results && flat.length > 0;

  const iconFor = (type: string) => {
    if (type === 'card')      return <IconCard />;
    if (type === 'project')   return <IconProject />;
    if (type === 'board')     return <IconBoard />;
    if (type === 'workspace') return <IconWorkspace />;
    return <IconDoc />;
  };

  // Group index tracking
  let cardStart = -1, projStart = -1, boardStart = -1, wsStart = -1, docStart = -1;
  if (results) {
    let idx = 0;
    if (results.workspaces.length) { wsStart = idx; idx += results.workspaces.length; }
    if (results.projects.length)   { projStart = idx; idx += results.projects.length; }
    if (results.boards.length)     { boardStart = idx; idx += results.boards.length; }
    if (results.cards.length)      { cardStart = idx; idx += results.cards.length; }
    if (results.documents.length)  { docStart = idx; }
  }

  return (
    /* Backdrop */
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '80px', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Panel */}
      <div
        style={{
          width: '560px',
          maxWidth: 'calc(100vw - 32px)',
          background: C.surface,
          border: `1px solid ${C.border2}`,
          borderRadius: '10px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '70vh',
        }}
      >
        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0 14px', borderBottom: `1px solid ${C.border}` }}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15" style={{ color: C.text3, flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t.board_filter_search_placeholder}
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: C.text,
              fontSize: '14px',
              padding: '14px 0',
              caretColor: C.accent,
            }}
          />
          {loading && (
            <div style={{ width: '14px', height: '14px', border: `2px solid ${C.border2}`, borderTopColor: C.accent, borderRadius: '50%', animation: 'spin 0.6s linear infinite', flexShrink: 0 }} />
          )}
          <span style={{ fontSize: '11px', color: C.text4, fontFamily: 'monospace', flexShrink: 0 }}>ESC</span>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {!query && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: C.text3, fontSize: '13px' }}>
              {t.board_filter_search_placeholder}
            </div>
          )}

          {query && query.length < 2 && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: C.text3, fontSize: '13px' }}>
              {t.btn_loading}
            </div>
          )}

          {isEmpty && (
            <div style={{ padding: '32px 16px', textAlign: 'center', color: C.text3, fontSize: '13px' }}>
              {t.comments_mention_no_results}
            </div>
          )}

          {hasResults && (
            <div style={{ padding: '6px' }}>
              {/* Workspaces */}
              {wsStart !== -1 && <SectionLabel label={t.nav_workspaces} />}
              {results!.workspaces.map((w, i) => (
                <ResultItem
                  key={`ws-${w.id}`}
                  icon={<IconWorkspace />}
                  label={w.name}
                  sub={w.description ?? undefined}
                  isSelected={selectedIdx === wsStart + i}
                  onClick={flat[wsStart + i].action}
                  q={query}
                />
              ))}

              {/* Proyectos */}
              {projStart !== -1 && <SectionLabel label={t.projects_title} />}
              {results!.projects.map((p, i) => (
                <ResultItem
                  key={`proj-${p.id}`}
                  icon={<IconProject />}
                  label={p.name}
                  sub={p.workspaceName}
                  accent={p.color ?? undefined}
                  isSelected={selectedIdx === projStart + i}
                  onClick={flat[projStart + i].action}
                  q={query}
                />
              ))}

              {/* Boards */}
              {boardStart !== -1 && <SectionLabel label={t.workspace_section_boards} />}
              {results!.boards.map((b, i) => (
                <ResultItem
                  key={`board-${b.id}`}
                  icon={<IconBoard />}
                  label={b.name}
                  sub={b.workspaceName}
                  isSelected={selectedIdx === boardStart + i}
                  onClick={flat[boardStart + i].action}
                  q={query}
                />
              ))}

              {/* Cards */}
              {cardStart !== -1 && <SectionLabel label={t.board_stat_cards} />}
              {results!.cards.map((c, i) => (
                <ResultItem
                  key={`card-${c.id}`}
                  icon={<IconCard />}
                  label={c.title}
                  sub={`${c.boardName} · ${c.listName}`}
                  accent={c.priority ? PRIORITY_COLOR[c.priority] : undefined}
                  isSelected={selectedIdx === cardStart + i}
                  onClick={flat[cardStart + i].action}
                  q={query}
                />
              ))}

              {/* Documentos */}
              {docStart !== -1 && <SectionLabel label={t.documents_section_title} />}
              {results!.documents.map((d, i) => (
                <ResultItem
                  key={`doc-${d.id}`}
                  icon={<IconDoc />}
                  label={d.title}
                  sub={d.workspaceName}
                  isSelected={selectedIdx === docStart + i}
                  onClick={flat[docStart + i].action}
                  q={query}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{ display: 'flex', gap: '14px', padding: '8px 14px', borderTop: `1px solid ${C.border}`, fontSize: '11px', color: C.text4 }}
        >
          <span><kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> navegar</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>↵</kbd> abrir</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>ESC</kbd> cerrar</span>
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
