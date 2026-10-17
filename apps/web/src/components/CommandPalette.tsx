'use client';

import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ClipboardList,
  CornerDownLeft,
  FileText,
  FolderKanban,
  LayoutDashboard,
  LoaderCircle,
  RotateCw,
  Search,
  X,
} from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import styles from './CommandPalette.module.css';

interface SearchCard {
  id: string;
  title: string;
  cardCode: string | null;
  description: string | null;
  acceptanceCriteria: string | null;
  priority: string | null;
  dueDate: string | null;
  listName: string;
  boardId: string;
  boardName: string;
  workspaceId: string;
  workspaceName: string;
  projectName: string | null;
}

interface SearchProject {
  id: string;
  name: string;
  status: string;
  color: string | null;
  workspaceId: string;
  workspaceName: string;
}

interface SearchBoard {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
}

interface SearchWorkspace {
  id: string;
  name: string;
  description: string | null;
  color: string | null;
}

interface SearchDocument {
  id: string;
  title: string;
  workspaceId: string;
  workspaceName: string;
}

interface SearchResults {
  cards: SearchCard[];
  projects: SearchProject[];
  boards: SearchBoard[];
  workspaces: SearchWorkspace[];
  documents: SearchDocument[];
}

type ResultType = 'workspace' | 'project' | 'board' | 'card' | 'document';

interface FlatResult {
  type: ResultType;
  id: string;
  label: string;
  code?: string;
  sub?: string;
  detail?: string;
  accent?: string;
  action: () => void;
}

interface ResultGroup {
  type: ResultType;
  label: string;
  items: FlatResult[];
}

const foldText = (value: string) => {
  let folded = '';
  const ranges: Array<{ start: number; end: number }> = [];

  for (let index = 0; index < value.length;) {
    const codePoint = value.codePointAt(index);
    if (codePoint === undefined) break;
    const character = String.fromCodePoint(codePoint);
    const normalized = character.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase();
    for (let offset = 0; offset < normalized.length; offset += 1) {
      folded += normalized[offset];
      ranges.push({ start: index, end: index + character.length });
    }
    index += character.length;
  }

  return { folded, ranges };
};

const searchTokens = (value: string) => foldText(value).folded.split(/[^\p{L}\p{N}]+/u).filter((token) => token.length >= 2);

function matchingRanges(text: string, query: string) {
  const { folded, ranges: sourceRanges } = foldText(text);
  const terms = searchTokens(query);
  const matches: Array<{ start: number; end: number }> = [];

  terms.forEach((term) => {
    let offset = folded.indexOf(term);
    while (offset !== -1) {
      const first = sourceRanges[offset];
      const last = sourceRanges[offset + term.length - 1];
      if (first && last) matches.push({ start: first.start, end: last.end });
      offset = folded.indexOf(term, offset + term.length);
    }
  });

  return matches.sort((a, b) => a.start - b.start || a.end - b.end).reduce<Array<{ start: number; end: number }>>((ranges, match) => {
    const previous = ranges[ranges.length - 1];
    if (previous && match.start <= previous.end) previous.end = Math.max(previous.end, match.end);
    else ranges.push({ ...match });
    return ranges;
  }, []);
}

function Highlight({ text, query }: { text: string; query: string }) {
  const ranges = matchingRanges(text, query);
  if (!ranges.length) return <>{text}</>;

  const parts: ReactNode[] = [];
  let cursor = 0;
  ranges.forEach((range, index) => {
    if (range.start > cursor) parts.push(text.slice(cursor, range.start));
    parts.push(<mark className={styles.match} key={`${range.start}-${index}`}>{text.slice(range.start, range.end)}</mark>);
    cursor = range.end;
  });
  if (cursor < text.length) parts.push(text.slice(cursor));
  return <>{parts}</>;
}

function matchingExcerpt(text: string | null | undefined, query: string) {
  const cleanText = text?.replace(/\s+/g, ' ').trim();
  if (!cleanText) return undefined;

  const terms = searchTokens(query);
  const { folded, ranges } = foldText(cleanText);
  const firstMatch = terms
    .map((term) => folded.indexOf(term))
    .filter((index) => index >= 0)
    .sort((a, b) => a - b)[0];
  if (firstMatch === undefined) return undefined;

  const match = ranges[firstMatch];
  let start = Math.max(0, match.start - 34);
  let end = Math.min(cleanText.length, match.end + 62);
  if (start > 0) {
    const boundary = cleanText.indexOf(' ', start);
    if (boundary !== -1 && boundary < match.start) start = boundary + 1;
  }
  if (end < cleanText.length) {
    const boundary = cleanText.lastIndexOf(' ', end);
    if (boundary > match.end) end = boundary;
  }

  return `${start > 0 ? '…' : ''}${cleanText.slice(start, end)}${end < cleanText.length ? '…' : ''}`;
}

function optionId(result: FlatResult) {
  return `command-search-option-${result.type}-${result.id}`;
}

function ResultOption({
  item,
  query,
  index,
  total,
  selected,
  onChoose,
  onPoint,
}: {
  item: FlatResult;
  query: string;
  index: number;
  total: number;
  selected: boolean;
  onChoose: () => void;
  onPoint: () => void;
}) {
  const optionRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selected) optionRef.current?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  const icon = item.type === 'workspace'
    ? <Building2 size={16} />
    : item.type === 'project'
      ? <FolderKanban size={16} />
      : item.type === 'board'
        ? <LayoutDashboard size={16} />
        : item.type === 'card'
          ? <ClipboardList size={16} />
          : <FileText size={16} />;

  return (
    <div
      id={optionId(item)}
      ref={optionRef}
      className={`${styles.option} ${selected ? styles.optionSelected : ''}`}
      role="option"
      aria-selected={selected}
      aria-posinset={index + 1}
      aria-setsize={total}
      tabIndex={-1}
      onClick={onChoose}
      onMouseMove={onPoint}
      onMouseDown={(event) => event.preventDefault()}
    >
      <span className={styles.optionIcon} style={item.accent ? { color: item.accent } : undefined} aria-hidden="true">
        {icon}
      </span>
      <span className={styles.optionCopy}>
        <span className={styles.optionTitle}>
          {item.code && <code className={styles.optionCode}><Highlight text={item.code} query={query} /></code>}
          <span className={styles.optionTitleText}><Highlight text={item.label} query={query} /></span>
        </span>
        {item.sub && <span className={styles.optionMeta}>{item.sub}</span>}
        {item.detail && <span className={styles.optionDetail}><Highlight text={item.detail} query={query} /></span>}
      </span>
      <span className={styles.openHint} aria-hidden="true"><CornerDownLeft size={14} /></span>
    </div>
  );
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const t = useT();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [retryVersion, setRetryVersion] = useState(0);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLElement>(null);

  const searchTerm = query.trim().replace(/\s+/g, ' ');

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 35);
    setQuery('');
    setResults(null);
    setLoading(false);
    setHasError(false);
    setSelectedIdx(0);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocus?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (searchTerm.length < 2) {
      setResults(null);
      setLoading(false);
      setHasError(false);
      return;
    }

    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setResults(null);
    setHasError(false);

    const timer = window.setTimeout(async () => {
      try {
        const response = await apiService.get<SearchResults>(
          `/api/search?q=${encodeURIComponent(searchTerm)}`,
          true,
          { signal: controller.signal },
        );
        if (!active) return;
        if (response.success && response.data) {
          setResults(response.data);
        } else {
          setHasError(true);
        }
      } catch {
        if (active) setHasError(true);
      } finally {
        if (active) setLoading(false);
      }
    }, 180);

    return () => {
      active = false;
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [open, searchTerm, retryVersion]);

  const groups = useMemo<ResultGroup[]>(() => {
    if (!results) return [];

    const nextGroups: ResultGroup[] = [
      {
        type: 'card',
        label: t.command_search_project_cards,
        items: results.cards.map((card) => ({
          type: 'card', id: card.id, code: card.cardCode ?? undefined, label: card.title,
          sub: [card.projectName || card.workspaceName, card.boardName, card.listName].filter(Boolean).join(' / '),
          detail: matchingExcerpt(card.description, searchTerm) ?? matchingExcerpt(card.acceptanceCriteria, searchTerm),
          action: () => { router.push(`/dashboard/boards/${card.boardId}?card=${card.id}`); onClose(); },
        })),
      },
      {
        type: 'workspace',
        label: t.command_search_workspaces,
        items: results.workspaces.map((workspace) => ({
          type: 'workspace', id: workspace.id, label: workspace.name,
          sub: workspace.description ?? undefined,
          action: () => { router.push('/dashboard/projects'); onClose(); },
        })),
      },
      {
        type: 'project',
        label: t.command_search_projects,
        items: results.projects.map((project) => ({
          type: 'project', id: project.id, label: project.name, sub: project.workspaceName,
          accent: project.color ?? undefined,
          action: () => { router.push(`/dashboard/projects/${project.id}`); onClose(); },
        })),
      },
      {
        type: 'board',
        label: t.command_search_boards,
        items: results.boards.map((board) => ({
          type: 'board', id: board.id, label: board.name, sub: board.workspaceName,
          action: () => { router.push(`/dashboard/boards/${board.id}`); onClose(); },
        })),
      },
      {
        type: 'document',
        label: t.command_search_documents,
        items: results.documents.map((document) => ({
          type: 'document', id: document.id, label: document.title, sub: document.workspaceName,
          action: () => { router.push(`/dashboard/documents/${document.id}`); onClose(); },
        })),
      },
    ];

    return nextGroups.filter((group) => group.items.length > 0);
  }, [onClose, results, router, searchTerm, t]);

  const flat = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const activeOption = flat[selectedIdx];
  const isEmpty = Boolean(results && flat.length === 0);

  useEffect(() => { setSelectedIdx(0); }, [results]);

  const handleInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown' && flat.length) {
      event.preventDefault();
      setSelectedIdx((index) => Math.min(index + 1, flat.length - 1));
    } else if (event.key === 'ArrowUp' && flat.length) {
      event.preventDefault();
      setSelectedIdx((index) => Math.max(index - 1, 0));
    } else if (event.key === 'Enter' && activeOption) {
      event.preventDefault();
      activeOption.action();
    }
  };

  const handleDialogKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
      return;
    }
    if (event.key !== 'Tab') return;

    const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  if (!open) return null;

  let groupStart = 0;
  const resultCount = flat.length;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}
    >
      <section ref={panelRef} className={styles.panel} role="dialog" aria-modal="true" aria-label={t.command_search_title} onKeyDown={handleDialogKeyDown}>
        <header className={styles.header}>
          <span className={styles.headerIcon} aria-hidden="true"><Search size={17} /></span>
          <div className={styles.headerCopy}>
            <h2>{t.command_search_title}</h2>
            <span>{t.command_search_subtitle}</span>
          </div>
          <button type="button" className={styles.closeButton} onClick={onClose} aria-label={t.command_search_close} title={`${t.command_search_close} (Esc)`}>
            <X size={16} />
          </button>
        </header>

        <div className={styles.searchField}>
          <Search className={styles.fieldIcon} size={18} aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => { setQuery(event.target.value); setSelectedIdx(0); }}
            onKeyDown={handleInputKeyDown}
            placeholder={t.command_search_placeholder}
            aria-label={t.command_search_placeholder}
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={groups.length > 0}
            aria-controls={groups.length > 0 ? 'command-search-results' : undefined}
            aria-activedescendant={activeOption ? optionId(activeOption) : undefined}
            autoComplete="off"
            spellCheck={false}
          />
          {query ? (
            <button type="button" className={styles.clearButton} onClick={() => { setQuery(''); setSelectedIdx(0); }} aria-label={t.command_search_clear} title={t.command_search_clear}>
              <X size={15} />
            </button>
          ) : (
            <kbd className={styles.escapeHint}>Esc</kbd>
          )}
        </div>

        <div className={styles.results} aria-live="polite" aria-busy={loading}>
          {!searchTerm && (
            <div className={styles.initialState}>
              <span className={styles.stateIcon}><Search size={19} /></span>
              <strong>{t.command_search_initial_title}</strong>
              <span>{t.command_search_intro}</span>
              <div className={styles.searchScopes} aria-label={t.command_search_includes}>
                <span><ClipboardList size={13} /> {t.command_search_project_cards}</span>
                <span><FolderKanban size={13} /> {t.command_search_projects}</span>
                <span><LayoutDashboard size={13} /> {t.command_search_boards}</span>
              </div>
            </div>
          )}

          {searchTerm.length === 1 && <div className={styles.messageState}>{t.command_search_min_chars}</div>}

          {loading && (
            <div className={styles.loadingState} role="status">
              <LoaderCircle size={17} className={styles.spinner} />
              <span>{t.command_search_loading}</span>
              <div className={styles.skeletons} aria-hidden="true"><i /><i /><i /></div>
            </div>
          )}

          {!loading && hasError && (
            <div className={styles.messageState}>
              <span className={styles.stateIcon}><RotateCw size={18} /></span>
              <strong>{t.command_search_error_title}</strong>
              <span>{t.command_search_error_hint}</span>
              <button type="button" className={styles.retryButton} onClick={() => setRetryVersion((version) => version + 1)}>
                <RotateCw size={14} /> {t.command_search_retry}
              </button>
            </div>
          )}

          {!loading && !hasError && isEmpty && (
            <div className={`${styles.messageState} ${styles.emptyState}`}>
              <span className={styles.stateIcon}><Search size={18} /></span>
              <strong>{t.command_search_no_results_title}</strong>
              <span>{t.command_search_no_results_body(searchTerm)}</span>
              <small>{t.command_search_no_results_hint}</small>
            </div>
          )}

          {!loading && !hasError && groups.length > 0 && (
            <div className={styles.resultList} id="command-search-results" role="listbox" aria-label={t.command_search_results}>
              <div className={styles.resultSummary}>
                <span>{t.command_search_results}</span>
                <span className={styles.resultCount}>{resultCount}</span>
              </div>
              {groups.map((group) => {
                const startIndex = groupStart;
                groupStart += group.items.length;
                return (
                  <section className={styles.resultGroup} role="group" aria-label={group.label} key={group.type}>
                    <h3 className={styles.groupLabel}><span>{group.label}</span><span>{group.items.length}</span></h3>
                    {group.items.map((item, index) => {
                      const flatIndex = startIndex + index;
                      return (
                        <ResultOption
                          key={`${item.type}-${item.id}`}
                          item={item}
                          query={searchTerm}
                          index={flatIndex}
                          total={resultCount}
                          selected={selectedIdx === flatIndex}
                          onChoose={item.action}
                          onPoint={() => setSelectedIdx(flatIndex)}
                        />
                      );
                    })}
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <span><kbd><ArrowUp size={11} /><ArrowDown size={11} /></kbd> {t.command_search_navigate}</span>
          <span><kbd><CornerDownLeft size={11} /></kbd> {t.command_search_open}</span>
          <span><kbd>Esc</kbd> {t.command_search_dismiss}</span>
        </footer>
      </section>
    </div>
  );
}
