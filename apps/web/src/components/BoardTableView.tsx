// apps/web/src/components/BoardTableView.tsx
'use client';

import { useState, useMemo } from 'react';
import type { Card, List } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useT } from '@/lib/i18n';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Circle,
  ArrowUpDown,
} from 'lucide-react';

interface Props {
  lists: List[];
  filteredCards?: Record<string, Card[]> | null;
  onCardClick: (card: Card) => void;
}

type SortField = 'title' | 'list' | 'priority' | 'dueDate' | 'status';
type SortDir = 'asc' | 'desc';

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, null: 3 };
const MONTHS = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function dateStatus(iso: string | undefined, completed: boolean) {
  if (completed) return 'completed';
  if (!iso) return 'none';
  const now = new Date();
  const due = new Date(iso);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay < today) return 'overdue';
  if (dueDay.getTime() === today.getTime()) return 'today';
  return 'ok';
}

export function BoardTableView({ lists, filteredCards, onCardClick }: Props) {
  const t = useT();
  const cards = useCardStore((s) => s.cards);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({
    field: 'list',
    dir: 'asc',
  });
  const [search, setSearch] = useState('');

  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  // Flatten all cards
  const allCards: Card[] = useMemo(() => {
    const source = filteredCards ?? cards;
    return Object.values(source).flat() as Card[];
  }, [filteredCards, cards]);

  // Filter by search
  const filtered = useMemo(() => {
    if (!search.trim()) return allCards;
    const q = search.toLowerCase();
    return allCards.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [allCards, search]);

  // Sort
  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case 'title':
          cmp = a.title.localeCompare(b.title);
          break;
        case 'list': {
          const la = listMap.get(a.listId)?.name ?? '';
          const lb = listMap.get(b.listId)?.name ?? '';
          cmp = la.localeCompare(lb);
          break;
        }
        case 'priority':
          cmp =
            (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3) -
            (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3);
          break;
        case 'dueDate': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = da - db;
          break;
        }
        case 'status':
          cmp = Number(a.completed) - Number(b.completed);
          break;
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, listMap]);

  function toggleSort(field: SortField) {
    setSort((s) =>
      s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }
    );
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ChevronsUpDown className="w-3.5 h-3.5 opacity-30" />;
    return sort.dir === 'asc' ? (
      <ChevronUp className="w-3.5 h-3.5" />
    ) : (
      <ChevronDown className="w-3.5 h-3.5" />
    );
  }

  const priorityConfig = {
    HIGH: { label: 'Alta', color: 'text-error bg-error/10 border-error/30' },
    MEDIUM: { label: 'Media', color: 'text-warning bg-warning/10 border-warning/30' },
    LOW: { label: 'Baja', color: 'text-blue-500 bg-blue-500/10 border-blue-500/30' },
  };

  return (
    <div className="flex flex-col h-full">
      {/* Barra de búsqueda rápida */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center gap-3">
        <ArrowUpDown className="w-4 h-4 text-text-muted flex-shrink-0" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar en la tabla…"
          className="flex-1 bg-transparent text-sm text-text-primary placeholder-text-muted focus:outline-none font-mono"
        />
        <span className="text-xs text-text-muted font-mono">{sorted.length} cards</span>
      </div>

      {/* Tabla */}
      <div className="flex-1 overflow-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-text-muted font-mono text-sm">
            {t.table_empty}
          </div>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead className="sticky top-0 z-10 bg-card border-b border-border">
              <tr>
                {(
                  [
                    ['title', t.table_col_title],
                    ['list', t.table_col_list],
                    ['priority', t.table_col_priority],
                    ['dueDate', t.table_col_due],
                    ['status', t.table_col_status],
                  ] as [SortField, string][]
                ).map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider cursor-pointer hover:text-text-primary select-none group"
                  >
                    <div className="flex items-center gap-1.5">
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t.table_col_members}
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-text-muted uppercase tracking-wider">
                  {t.table_col_labels}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((card, i) => {
                const list = listMap.get(card.listId);
                const prio = card.priority ? priorityConfig[card.priority] : null;
                const ds = dateStatus(card.dueDate, card.completed);

                return (
                  <tr
                    key={card.id}
                    onClick={() => onCardClick(card)}
                    className={`border-b border-border/50 cursor-pointer transition-colors hover:bg-surface ${
                      card.completed ? 'opacity-60' : ''
                    } ${i % 2 === 0 ? 'bg-background' : 'bg-card/50'}`}
                  >
                    {/* Título */}
                    <td className="px-4 py-3 max-w-[280px]">
                      <div className="flex items-center gap-2">
                        {card.completed ? (
                          <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                        ) : ds === 'overdue' ? (
                          <AlertTriangle className="w-4 h-4 text-error flex-shrink-0" />
                        ) : (
                          <Circle className="w-4 h-4 text-text-muted flex-shrink-0" />
                        )}
                        <span
                          className={`font-medium truncate ${card.completed ? 'line-through text-text-muted' : 'text-text-primary'}`}
                        >
                          {card.title}
                        </span>
                      </div>
                    </td>

                    {/* Lista */}
                    <td className="px-4 py-3">
                      <span className="text-xs px-2 py-0.5 bg-surface border border-border text-text-secondary font-mono truncate max-w-[120px] inline-block">
                        {list?.name ?? '—'}
                      </span>
                    </td>

                    {/* Prioridad */}
                    <td className="px-4 py-3">
                      {prio ? (
                        <span
                          className={`text-[10px] px-2 py-0.5 border font-medium uppercase ${prio.color}`}
                        >
                          {prio.label}
                        </span>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td className="px-4 py-3 font-mono text-xs">
                      {card.dueDate ? (
                        <div
                          className={`flex items-center gap-1 ${
                            ds === 'overdue'
                              ? 'text-error'
                              : ds === 'today'
                                ? 'text-warning'
                                : 'text-text-secondary'
                          }`}
                        >
                          <Clock className="w-3 h-3" />
                          {fmtDate(card.dueDate)}
                        </div>
                      ) : (
                        <span className="text-text-muted">—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td className="px-4 py-3">
                      {card.completed ? (
                        <span className="text-[10px] px-2 py-0.5 border border-success/30 bg-success/10 text-success font-medium">
                          {t.table_completed}
                        </span>
                      ) : ds === 'overdue' ? (
                        <span className="text-[10px] px-2 py-0.5 border border-error/30 bg-error/10 text-error font-medium">
                          {t.table_overdue}
                        </span>
                      ) : (
                        <span className="text-[10px] px-2 py-0.5 border border-border text-text-muted font-medium">
                          {t.table_pending}
                        </span>
                      )}
                    </td>

                    {/* Miembros */}
                    <td className="px-4 py-3">
                      {card.members && card.members.length > 0 ? (
                        <div className="flex -space-x-1.5">
                          {card.members.slice(0, 3).map((m) => (
                            <div
                              key={m.id}
                              className="w-6 h-6 rounded-full bg-accent text-white flex items-center justify-center text-[10px] font-bold border-2 border-card"
                              title={m.name}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {card.members.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-surface text-text-secondary flex items-center justify-center text-[10px] font-bold border-2 border-card">
                              +{card.members.length - 3}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>

                    {/* Labels */}
                    <td className="px-4 py-3">
                      {card.labels && card.labels.length > 0 ? (
                        <div className="flex items-center gap-1">
                          {card.labels.slice(0, 4).map((l) => (
                            <div
                              key={l.id}
                              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                              style={{ backgroundColor: l.color }}
                              title={l.name}
                            />
                          ))}
                          {card.labels.length > 4 && (
                            <span className="text-[10px] text-text-muted">
                              +{card.labels.length - 4}
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-text-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
