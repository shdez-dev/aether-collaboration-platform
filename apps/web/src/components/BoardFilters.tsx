// apps/web/src/components/BoardFilters.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, Filter, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { User, Label } from '@aether/types';

export type PriorityFilter = 'LOW' | 'MEDIUM' | 'HIGH';
export type DateFilter = 'overdue' | 'due_today' | 'due_week' | 'no_date';

export interface BoardFilterState {
  search: string;
  priorities: PriorityFilter[];
  memberIds: string[];
  labelIds: string[];
  dates: DateFilter[];
}

export const EMPTY_FILTERS: BoardFilterState = {
  search: '',
  priorities: [],
  memberIds: [],
  labelIds: [],
  dates: [],
};

export function hasActiveFilters(filters: BoardFilterState): boolean {
  return (
    filters.search.trim() !== '' ||
    filters.priorities.length > 0 ||
    filters.memberIds.length > 0 ||
    filters.labelIds.length > 0 ||
    filters.dates.length > 0
  );
}

interface BoardFiltersProps {
  filters: BoardFilterState;
  onChange: (filters: BoardFilterState) => void;
  members: User[];
  labels: Label[];
  totalCards: number;
  filteredCards: number;
}

// ─── Pill toggle helper ───────────────────────────────────────────────────────
function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

// ─── Dropdown wrapper ─────────────────────────────────────────────────────────
function Dropdown({
  label,
  active,
  children,
}: {
  label: React.ReactNode;
  active: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 text-sm border transition-all ${
          active
            ? 'border-accent text-accent bg-accent/10'
            : 'border-border text-text-secondary hover:border-accent/50 hover:text-text-primary'
        }`}
      >
        {label}
        <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute top-full left-0 mt-1 z-50 bg-card border border-border shadow-xl min-w-[180px] py-1">
          {children}
        </div>
      )}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function BoardFilters({
  filters,
  onChange,
  members,
  labels,
  totalCards,
  filteredCards,
}: BoardFiltersProps) {
  const t = useT();
  const active = hasActiveFilters(filters);

  const set = (partial: Partial<BoardFilterState>) => onChange({ ...filters, ...partial });

  const clearAll = () => onChange(EMPTY_FILTERS);

  // ── Priority options ────────────────────────────────────────────────────────
  const priorityOptions: { value: PriorityFilter; label: string; color: string }[] = [
    { value: 'HIGH', label: t.card_priority_high, color: 'text-error' },
    { value: 'MEDIUM', label: t.card_priority_medium, color: 'text-warning' },
    { value: 'LOW', label: t.card_priority_low, color: 'text-blue-400' },
  ];

  // ── Date options ────────────────────────────────────────────────────────────
  const dateOptions: { value: DateFilter; label: string }[] = [
    { value: 'overdue', label: t.board_filter_date_overdue },
    { value: 'due_today', label: t.board_filter_date_today },
    { value: 'due_week', label: t.board_filter_date_week },
    { value: 'no_date', label: t.board_filter_date_none },
  ];

  const activeCount =
    filters.priorities.length +
    filters.memberIds.length +
    filters.labelIds.length +
    filters.dates.length;

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1: search + dropdowns */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[180px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted pointer-events-none" />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder={t.board_filter_search_placeholder}
            className="w-full pl-8 pr-8 py-1.5 text-sm bg-surface border border-border text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
          />
          {filters.search && (
            <button
              onClick={() => set({ search: '' })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Priority dropdown */}
        <Dropdown
          active={filters.priorities.length > 0}
          label={
            <>
              <SlidersHorizontal className="w-3.5 h-3.5" />
              {t.board_filter_priority}
              {filters.priorities.length > 0 && (
                <span className="ml-1 bg-accent text-white text-xs px-1.5 py-0 rounded-full leading-5">
                  {filters.priorities.length}
                </span>
              )}
            </>
          }
        >
          {priorityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ priorities: toggle(filters.priorities, opt.value) })}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface transition-colors ${
                filters.priorities.includes(opt.value) ? 'bg-accent/10' : ''
              }`}
            >
              <span
                className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                  filters.priorities.includes(opt.value)
                    ? 'border-accent bg-accent'
                    : 'border-border'
                }`}
              >
                {filters.priorities.includes(opt.value) && (
                  <span className="text-white text-xs leading-none">✓</span>
                )}
              </span>
              <span className={opt.color}>{opt.label}</span>
            </button>
          ))}
        </Dropdown>

        {/* Members dropdown */}
        {members.length > 0 && (
          <Dropdown
            active={filters.memberIds.length > 0}
            label={
              <>
                {t.board_filter_member}
                {filters.memberIds.length > 0 && (
                  <span className="ml-1 bg-accent text-white text-xs px-1.5 py-0 rounded-full leading-5">
                    {filters.memberIds.length}
                  </span>
                )}
              </>
            }
          >
            {members.map((m) => (
              <button
                key={m.id}
                onClick={() => set({ memberIds: toggle(filters.memberIds, m.id) })}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface transition-colors ${
                  filters.memberIds.includes(m.id) ? 'bg-accent/10' : ''
                }`}
              >
                <span
                  className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                    filters.memberIds.includes(m.id) ? 'border-accent bg-accent' : 'border-border'
                  }`}
                >
                  {filters.memberIds.includes(m.id) && (
                    <span className="text-white text-xs leading-none">✓</span>
                  )}
                </span>
                {m.avatar ? (
                  <img src={m.avatar} alt={m.name} className="w-5 h-5 rounded-full object-cover" />
                ) : (
                  <span className="w-5 h-5 rounded-full bg-accent/20 text-accent text-xs flex items-center justify-center font-medium flex-shrink-0">
                    {m.name?.[0]?.toUpperCase() ?? '?'}
                  </span>
                )}
                <span className="text-text-primary truncate max-w-[120px]">{m.name}</span>
              </button>
            ))}
          </Dropdown>
        )}

        {/* Labels dropdown */}
        {labels.length > 0 && (
          <Dropdown
            active={filters.labelIds.length > 0}
            label={
              <>
                {t.board_filter_label}
                {filters.labelIds.length > 0 && (
                  <span className="ml-1 bg-accent text-white text-xs px-1.5 py-0 rounded-full leading-5">
                    {filters.labelIds.length}
                  </span>
                )}
              </>
            }
          >
            {labels.map((lbl) => (
              <button
                key={lbl.id}
                onClick={() => set({ labelIds: toggle(filters.labelIds, lbl.id) })}
                className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface transition-colors ${
                  filters.labelIds.includes(lbl.id) ? 'bg-accent/10' : ''
                }`}
              >
                <span
                  className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                    filters.labelIds.includes(lbl.id) ? 'border-accent bg-accent' : 'border-border'
                  }`}
                >
                  {filters.labelIds.includes(lbl.id) && (
                    <span className="text-white text-xs leading-none">✓</span>
                  )}
                </span>
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: lbl.color }}
                />
                <span className="text-text-primary truncate max-w-[120px]">{lbl.name}</span>
              </button>
            ))}
          </Dropdown>
        )}

        {/* Date dropdown */}
        <Dropdown
          active={filters.dates.length > 0}
          label={
            <>
              {t.board_filter_date}
              {filters.dates.length > 0 && (
                <span className="ml-1 bg-accent text-white text-xs px-1.5 py-0 rounded-full leading-5">
                  {filters.dates.length}
                </span>
              )}
            </>
          }
        >
          {dateOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => set({ dates: toggle(filters.dates, opt.value) })}
              className={`flex items-center gap-2 w-full px-3 py-2 text-sm text-left hover:bg-surface transition-colors ${
                filters.dates.includes(opt.value) ? 'bg-accent/10' : ''
              }`}
            >
              <span
                className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${
                  filters.dates.includes(opt.value) ? 'border-accent bg-accent' : 'border-border'
                }`}
              >
                {filters.dates.includes(opt.value) && (
                  <span className="text-white text-xs leading-none">✓</span>
                )}
              </span>
              <span className="text-text-primary">{opt.label}</span>
            </button>
          ))}
        </Dropdown>

        {/* Clear all */}
        {active && (
          <button
            onClick={clearAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-error border border-error/40 hover:bg-error/10 transition-colors"
          >
            <X className="w-3.5 h-3.5" />
            {t.board_filter_clear}
          </button>
        )}
      </div>

      {/* Row 2: active filter pills + result count */}
      {active && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <Filter className="w-3 h-3" />
            {t.board_filter_showing(filteredCards, totalCards)}
          </span>

          {/* Priority pills */}
          {filters.priorities.map((p) => {
            const opt = priorityOptions.find((o) => o.value === p)!;
            return (
              <span
                key={p}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-border text-text-secondary"
              >
                <span className={opt.color}>{opt.label}</span>
                <button
                  onClick={() => set({ priorities: filters.priorities.filter((x) => x !== p) })}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* Member pills */}
          {filters.memberIds.map((id) => {
            const m = members.find((u) => u.id === id);
            if (!m) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-border text-text-secondary"
              >
                {m.name}
                <button
                  onClick={() => set({ memberIds: filters.memberIds.filter((x) => x !== id) })}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* Label pills */}
          {filters.labelIds.map((id) => {
            const lbl = labels.find((l) => l.id === id);
            if (!lbl) return null;
            return (
              <span
                key={id}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-border text-text-secondary"
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: lbl.color }} />
                {lbl.name}
                <button
                  onClick={() => set({ labelIds: filters.labelIds.filter((x) => x !== id) })}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}

          {/* Date pills */}
          {filters.dates.map((d) => {
            const opt = dateOptions.find((o) => o.value === d)!;
            return (
              <span
                key={d}
                className="flex items-center gap-1 px-2 py-0.5 text-xs bg-surface border border-border text-text-secondary"
              >
                {opt.label}
                <button
                  onClick={() => set({ dates: filters.dates.filter((x) => x !== d) })}
                  className="text-text-muted hover:text-text-primary"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
