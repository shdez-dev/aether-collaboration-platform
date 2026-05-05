// apps/web/src/components/BoardFilters.tsx
'use client';

import { useState, useRef, useEffect } from 'react';
import { Search, X, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { User, Label } from '@aether/types';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { C } from '@/lib/colors';

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

export function hasActiveFilters(f: BoardFilterState): boolean {
  return f.search.trim() !== '' || f.priorities.length > 0 || f.memberIds.length > 0 || f.labelIds.length > 0 || f.dates.length > 0;
}

function toggle<T>(arr: T[], value: T): T[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}


// ── Dropdown ──────────────────────────────────────────────────────────────────
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
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-1.5 transition-colors"
        style={{
          padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 500,
          color: active ? C.accent : C.text3,
          background: active ? `${C.accent}14` : C.surface,
          border: `1px solid ${active ? `${C.accent}44` : C.border}`,
        }}
        onMouseEnter={(e) => {
          if (!active) { (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); }
        }}
        onMouseLeave={(e) => {
          if (!active) { (e.currentTarget.style.borderColor = C.border); (e.currentTarget.style.color = C.text3); }
        }}
      >
        {label}
        <ChevronDown
          width={11} height={11}
          style={{ transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none', flexShrink: 0 }}
        />
      </button>

      {open && (
        <div
          style={{
            position: 'absolute', top: 'calc(100% + 5px)', left: 0, zIndex: 50,
            background: '#13161b', border: `1px solid ${C.border2}`,
            borderRadius: '8px', minWidth: '180px', overflow: 'hidden',
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
          }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Checkbox row item ─────────────────────────────────────────────────────────
function DropItem({
  checked,
  onClick,
  children,
}: {
  checked: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-2 w-full text-left transition-colors"
      style={{
        padding: '7px 12px', fontSize: '12.5px',
        background: checked ? `${C.accent}12` : 'transparent',
        color: C.text2,
      }}
      onMouseEnter={(e) => { if (!checked) (e.currentTarget.style.background = C.hover); }}
      onMouseLeave={(e) => { if (!checked) (e.currentTarget.style.background = 'transparent'); }}
    >
      {/* Checkbox */}
      <span
        className="flex items-center justify-center flex-shrink-0"
        style={{
          width: '14px', height: '14px', borderRadius: '3px',
          border: `1.5px solid ${checked ? C.accent : C.border2}`,
          background: checked ? C.accent : 'transparent',
          transition: 'all 0.12s',
        }}
      >
        {checked && (
          <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" width="8" height="8">
            <path d="M2 5l2.5 2.5 3.5-4" />
          </svg>
        )}
      </span>
      {children}
    </button>
  );
}

// ── Active pill ───────────────────────────────────────────────────────────────
function ActivePill({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span
      className="flex items-center gap-1"
      style={{
        padding: '2px 6px 2px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: 500,
        background: `${C.accent}18`, border: `1px solid ${C.accent}33`, color: C.accent,
      }}
    >
      {children}
      <button
        onClick={onRemove}
        style={{ color: `${C.accent}aa`, display: 'flex', alignItems: 'center' }}
        onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
        onMouseLeave={(e) => (e.currentTarget.style.color = `${C.accent}aa`)}
      >
        <X width={10} height={10} />
      </button>
    </span>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function BoardFilters({
  filters,
  onChange,
  members,
  labels,
  totalCards,
  filteredCards,
}: {
  filters: BoardFilterState;
  onChange: (f: BoardFilterState) => void;
  members: User[];
  labels: Label[];
  totalCards: number;
  filteredCards: number;
}) {
  const t = useT();
  const active = hasActiveFilters(filters);
  const set = (partial: Partial<BoardFilterState>) => onChange({ ...filters, ...partial });

  const priorityOptions: { value: PriorityFilter; label: string; color: string }[] = [
    { value: 'HIGH',   label: t.card_priority_high,   color: C.red   },
    { value: 'MEDIUM', label: t.card_priority_medium, color: C.amber },
    { value: 'LOW',    label: t.card_priority_low,    color: C.accent },
  ];

  const dateOptions: { value: DateFilter; label: string }[] = [
    { value: 'overdue',   label: t.board_filter_date_overdue },
    { value: 'due_today', label: t.board_filter_date_today   },
    { value: 'due_week',  label: t.board_filter_date_week    },
    { value: 'no_date',   label: t.board_filter_date_none    },
  ];

  const activeCount = filters.priorities.length + filters.memberIds.length + filters.labelIds.length + filters.dates.length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

      {/* Row 1: search + dropdowns */}
      <div className="flex items-center flex-wrap" style={{ gap: '6px' }}>

        {/* Search */}
        <div style={{ position: 'relative', minWidth: '180px', maxWidth: '260px', flex: 1 }}>
          <Search
            width={13} height={13}
            style={{
              position: 'absolute', left: '9px', top: '50%', transform: 'translateY(-50%)',
              color: C.text4, pointerEvents: 'none', flexShrink: 0,
            }}
          />
          <input
            type="text"
            value={filters.search}
            onChange={(e) => set({ search: e.target.value })}
            placeholder={t.board_filter_search_placeholder}
            style={{
              width: '100%', paddingLeft: '28px', paddingRight: filters.search ? '26px' : '9px',
              paddingTop: '4px', paddingBottom: '4px',
              background: C.surface, border: `1px solid ${filters.search ? `${C.accent}44` : C.border}`,
              borderRadius: '6px', fontSize: '12px', color: C.text,
              outline: 'none', transition: 'border-color 0.15s',
            }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = filters.search ? `${C.accent}44` : C.border)}
          />
          {filters.search && (
            <button
              onClick={() => set({ search: '' })}
              style={{
                position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)',
                color: C.text4, display: 'flex', alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
            >
              <X width={11} height={11} />
            </button>
          )}
        </div>

        {/* Priority */}
        <Dropdown
          active={filters.priorities.length > 0}
          label={
            <span className="flex items-center gap-1.5">
              <SlidersHorizontal width={11} height={11} />
              {t.board_filter_priority}
              {filters.priorities.length > 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, lineHeight: 1,
                  padding: '1px 4px', borderRadius: '3px',
                  background: C.accent, color: '#fff',
                }}>
                  {filters.priorities.length}
                </span>
              )}
            </span>
          }
        >
          {priorityOptions.map((opt) => (
            <DropItem
              key={opt.value}
              checked={filters.priorities.includes(opt.value)}
              onClick={() => set({ priorities: toggle(filters.priorities, opt.value) })}
            >
              <span style={{ color: opt.color, fontWeight: 500 }}>{opt.label}</span>
            </DropItem>
          ))}
        </Dropdown>

        {/* Members */}
        {members.length > 0 && (
          <Dropdown
            active={filters.memberIds.length > 0}
            label={
              <span className="flex items-center gap-1.5">
                {t.board_filter_member}
                {filters.memberIds.length > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, lineHeight: 1,
                    padding: '1px 4px', borderRadius: '3px',
                    background: C.accent, color: '#fff',
                  }}>
                    {filters.memberIds.length}
                  </span>
                )}
              </span>
            }
          >
            {members.map((m) => {
              const av = getAvatarUrl(m.avatar);
              return (
                <DropItem
                  key={m.id}
                  checked={filters.memberIds.includes(m.id)}
                  onClick={() => set({ memberIds: toggle(filters.memberIds, m.id) })}
                >
                  {av ? (
                    <img src={av} alt={m.name} crossOrigin="anonymous"
                      style={{ width: '18px', height: '18px', borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                  ) : (
                    <span style={{
                      width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
                      background: `${C.accent}22`, color: C.accent,
                      fontSize: '10px', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {m.name?.[0]?.toUpperCase() ?? '?'}
                    </span>
                  )}
                  <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                    {m.name}
                  </span>
                </DropItem>
              );
            })}
          </Dropdown>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <Dropdown
            active={filters.labelIds.length > 0}
            label={
              <span className="flex items-center gap-1.5">
                {t.board_filter_label}
                {filters.labelIds.length > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 700, lineHeight: 1,
                    padding: '1px 4px', borderRadius: '3px',
                    background: C.accent, color: '#fff',
                  }}>
                    {filters.labelIds.length}
                  </span>
                )}
              </span>
            }
          >
            {labels.map((lbl) => (
              <DropItem
                key={lbl.id}
                checked={filters.labelIds.includes(lbl.id)}
                onClick={() => set({ labelIds: toggle(filters.labelIds, lbl.id) })}
              >
                <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: lbl.color, flexShrink: 0 }} />
                <span style={{ color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '130px' }}>
                  {lbl.name}
                </span>
              </DropItem>
            ))}
          </Dropdown>
        )}

        {/* Date */}
        <Dropdown
          active={filters.dates.length > 0}
          label={
            <span className="flex items-center gap-1.5">
              {t.board_filter_date}
              {filters.dates.length > 0 && (
                <span style={{
                  fontSize: '10px', fontWeight: 700, lineHeight: 1,
                  padding: '1px 4px', borderRadius: '3px',
                  background: C.accent, color: '#fff',
                }}>
                  {filters.dates.length}
                </span>
              )}
            </span>
          }
        >
          {dateOptions.map((opt) => (
            <DropItem
              key={opt.value}
              checked={filters.dates.includes(opt.value)}
              onClick={() => set({ dates: toggle(filters.dates, opt.value) })}
            >
              <span style={{ color: C.text2 }}>{opt.label}</span>
            </DropItem>
          ))}
        </Dropdown>

        {/* Clear all */}
        {active && (
          <button
            onClick={() => onChange(EMPTY_FILTERS)}
            className="flex items-center gap-1 transition-colors"
            style={{
              padding: '4px 9px', borderRadius: '6px', fontSize: '12px',
              color: C.red, background: `${C.red}12`, border: `1px solid ${C.red}33`,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = `${C.red}1e`)}
            onMouseLeave={(e) => (e.currentTarget.style.background = `${C.red}12`)}
          >
            <X width={11} height={11} /> Limpiar
          </button>
        )}
      </div>

      {/* Row 2: active pills + result count */}
      {active && (
        <div className="flex items-center flex-wrap" style={{ gap: '5px' }}>
          {/* Result count */}
          <span style={{ fontSize: '11px', color: C.text4, marginRight: '2px', fontVariantNumeric: 'tabular-nums' }}>
            <span style={{ color: C.accent, fontWeight: 600 }}>{filteredCards}</span>
            <span> / {totalCards} tarjetas</span>
          </span>

          {/* Priority pills */}
          {filters.priorities.map((p) => {
            const opt = priorityOptions.find((o) => o.value === p)!;
            return (
              <ActivePill key={p} onRemove={() => set({ priorities: filters.priorities.filter((x) => x !== p) })}>
                <span style={{ color: opt.color }}>{opt.label}</span>
              </ActivePill>
            );
          })}

          {/* Member pills */}
          {filters.memberIds.map((id) => {
            const m = members.find((u) => u.id === id);
            if (!m) return null;
            return (
              <ActivePill key={id} onRemove={() => set({ memberIds: filters.memberIds.filter((x) => x !== id) })}>
                {m.name}
              </ActivePill>
            );
          })}

          {/* Label pills */}
          {filters.labelIds.map((id) => {
            const lbl = labels.find((l) => l.id === id);
            if (!lbl) return null;
            return (
              <ActivePill key={id} onRemove={() => set({ labelIds: filters.labelIds.filter((x) => x !== id) })}>
                <span style={{ width: '8px', height: '8px', borderRadius: '2px', background: lbl.color, flexShrink: 0 }} />
                {lbl.name}
              </ActivePill>
            );
          })}

          {/* Date pills */}
          {filters.dates.map((d) => {
            const opt = dateOptions.find((o) => o.value === d)!;
            return (
              <ActivePill key={d} onRemove={() => set({ dates: filters.dates.filter((x) => x !== d) })}>
                {opt.label}
              </ActivePill>
            );
          })}
        </div>
      )}
    </div>
  );
}
