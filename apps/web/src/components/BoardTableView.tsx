// apps/web/src/components/BoardTableView.tsx
'use client';

import { useState, useMemo } from 'react';
import type { Card, List } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useT } from '@/lib/i18n';
import {
  ChevronUp, ChevronDown, ChevronsUpDown,
  CheckCircle2, Clock, AlertTriangle, Circle, Search,
} from 'lucide-react';
import { C } from '@/lib/colors';


interface Props {
  lists: List[];
  filteredCards?: Record<string, Card[]> | null;
  onCardClick: (card: Card) => void;
}

type SortField = 'title' | 'list' | 'priority' | 'dueDate' | 'status';
type SortDir   = 'asc' | 'desc';

const PRIORITY_ORDER = { HIGH: 0, MEDIUM: 1, LOW: 2, null: 3 };
const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];

function fmtDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

function dateStatus(iso: string | undefined, completed: boolean) {
  if (completed) return 'completed';
  if (!iso) return 'none';
  const now = new Date();
  const due = new Date(iso);
  const today  = new Date(now.getFullYear(),  now.getMonth(),  now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  if (dueDay < today) return 'overdue';
  if (dueDay.getTime() === today.getTime()) return 'today';
  return 'ok';
}

const PRIORITY_CFG = {
  HIGH:   { label: 'Alta',   color: C.red,   bg: `${C.red}15`,   border: `${C.red}35`   },
  MEDIUM: { label: 'Media',  color: C.amber, bg: `${C.amber}15`, border: `${C.amber}35` },
  LOW:    { label: 'Baja',   color: C.accent, bg: `${C.accent}15`, border: `${C.accent}35` },
};

export function BoardTableView({ lists, filteredCards, onCardClick }: Props) {
  const t = useT();
  const cards = useCardStore((s) => s.cards);
  const [sort, setSort] = useState<{ field: SortField; dir: SortDir }>({ field: 'list', dir: 'asc' });
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  const listMap = useMemo(() => new Map(lists.map((l) => [l.id, l])), [lists]);

  const allCards: Card[] = useMemo(() => {
    const source = filteredCards ?? cards;
    return Object.values(source).flat() as Card[];
  }, [filteredCards, cards]);

  const filtered = useMemo(() => {
    if (!search.trim()) return allCards;
    const q = search.toLowerCase();
    return allCards.filter(
      (c) => c.title.toLowerCase().includes(q) || c.description?.toLowerCase().includes(q)
    );
  }, [allCards, search]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sort.field) {
        case 'title':    cmp = a.title.localeCompare(b.title); break;
        case 'list': {
          const la = listMap.get(a.listId)?.name ?? '';
          const lb = listMap.get(b.listId)?.name ?? '';
          cmp = la.localeCompare(lb); break;
        }
        case 'priority':
          cmp = (PRIORITY_ORDER[a.priority as keyof typeof PRIORITY_ORDER] ?? 3)
              - (PRIORITY_ORDER[b.priority as keyof typeof PRIORITY_ORDER] ?? 3);
          break;
        case 'dueDate': {
          const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
          const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
          cmp = da - db; break;
        }
        case 'status': cmp = Number(a.completed) - Number(b.completed); break;
      }
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [filtered, sort, listMap]);

  function toggleSort(field: SortField) {
    setSort((s) => s.field === field
      ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' }
      : { field, dir: 'asc' }
    );
  }

  function SortIcon({ field }: { field: SortField }) {
    if (sort.field !== field) return <ChevronsUpDown style={{ width: '12px', height: '12px', opacity: 0.3 }} />;
    return sort.dir === 'asc'
      ? <ChevronUp   style={{ width: '12px', height: '12px', color: C.accent }} />
      : <ChevronDown style={{ width: '12px', height: '12px', color: C.accent }} />;
  }

  const COLS: [SortField, string][] = [
    ['title',    t.table_col_title],
    ['list',     t.table_col_list],
    ['priority', t.table_col_priority],
    ['dueDate',  t.table_col_due],
    ['status',   t.table_col_status],
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg }}>

      {/* Barra superior */}
      <div style={{
        padding: '10px 20px',
        borderBottom: `1px solid ${C.border}`,
        background: C.surface2,
        display: 'flex', alignItems: 'center', gap: '10px',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flex: 1,
          padding: '6px 11px', borderRadius: '7px',
          background: C.surface,
          border: `1px solid ${searchFocused ? C.accent : C.border}`,
          transition: 'border-color 0.15s',
        }}>
          <Search style={{ width: '13px', height: '13px', color: C.text4, flexShrink: 0 }} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Buscar tarjeta…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              fontSize: '12.5px', color: C.text,
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text4, padding: 0, display: 'flex', fontSize: '12px', lineHeight: 1 }}
            >×</button>
          )}
        </div>
        <span style={{ fontSize: '11px', color: C.text4, whiteSpace: 'nowrap' }}>
          {sorted.length} {sorted.length === 1 ? 'tarjeta' : 'tarjetas'}
        </span>
      </div>

      {/* Tabla */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {sorted.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: C.text4, fontSize: '13px' }}>
            {t.table_empty}
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr style={{ background: C.surface, borderBottom: `1px solid ${C.border}` }}>
                {COLS.map(([field, label]) => (
                  <th
                    key={field}
                    onClick={() => toggleSort(field)}
                    style={{
                      padding: '9px 14px', textAlign: 'left',
                      fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em',
                      color: sort.field === field ? C.accent : C.text4,
                      textTransform: 'uppercase', cursor: 'pointer',
                      userSelect: 'none', whiteSpace: 'nowrap',
                      transition: 'color 0.12s',
                    }}
                    onMouseEnter={(e) => { if (sort.field !== field) (e.currentTarget as HTMLElement).style.color = C.text3; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = sort.field === field ? C.accent : C.text4; }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                      {label}
                      <SortIcon field={field} />
                    </div>
                  </th>
                ))}
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', color: C.text4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {t.table_col_members}
                </th>
                <th style={{ padding: '9px 14px', textAlign: 'left', fontSize: '10.5px', fontWeight: 600, letterSpacing: '0.06em', color: C.text4, textTransform: 'uppercase', whiteSpace: 'nowrap' }}>
                  {t.table_col_labels}
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((card, i) => {
                const list = listMap.get(card.listId);
                const prio = card.priority ? PRIORITY_CFG[card.priority as keyof typeof PRIORITY_CFG] : null;
                const ds   = dateStatus(card.dueDate, card.completed);
                const isHovered = hoveredRow === card.id;
                const rowBg = isHovered
                  ? C.hover
                  : i % 2 === 0 ? 'transparent' : `${C.surface}60`;

                return (
                  <tr
                    key={card.id}
                    onClick={() => onCardClick(card)}
                    onMouseEnter={() => setHoveredRow(card.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                    style={{
                      background: rowBg,
                      borderBottom: `1px solid ${C.border}`,
                      cursor: 'pointer',
                      opacity: card.completed ? 0.55 : 1,
                      transition: 'background 0.1s',
                    }}
                  >
                    {/* Título */}
                    <td style={{ padding: '9px 14px', maxWidth: '260px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        {card.completed ? (
                          <CheckCircle2 style={{ width: '14px', height: '14px', color: C.green, flexShrink: 0 }} />
                        ) : ds === 'overdue' ? (
                          <AlertTriangle style={{ width: '14px', height: '14px', color: C.red, flexShrink: 0 }} />
                        ) : (
                          <Circle style={{ width: '14px', height: '14px', color: C.text4, flexShrink: 0 }} />
                        )}
                        <span style={{
                          fontSize: '12.5px', fontWeight: 500,
                          color: card.completed ? C.text3 : C.text,
                          textDecoration: card.completed ? 'line-through' : 'none',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {card.title}
                        </span>
                      </div>
                    </td>

                    {/* Lista */}
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{
                        fontSize: '11px', padding: '2px 8px', borderRadius: '4px',
                        background: C.surface, border: `1px solid ${C.border2}`,
                        color: C.text3, whiteSpace: 'nowrap',
                        display: 'inline-block', maxWidth: '130px',
                        overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {list?.name ?? '—'}
                      </span>
                    </td>

                    {/* Prioridad */}
                    <td style={{ padding: '9px 14px' }}>
                      {prio ? (
                        <span style={{
                          fontSize: '10px', padding: '2px 7px', borderRadius: '4px',
                          background: prio.bg, border: `1px solid ${prio.border}`,
                          color: prio.color, fontWeight: 600, letterSpacing: '0.04em',
                          textTransform: 'uppercase', whiteSpace: 'nowrap',
                        }}>
                          {prio.label}
                        </span>
                      ) : (
                        <span style={{ fontSize: '12px', color: C.text4 }}>—</span>
                      )}
                    </td>

                    {/* Fecha */}
                    <td style={{ padding: '9px 14px' }}>
                      {card.dueDate ? (
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: '5px', whiteSpace: 'nowrap',
                          fontSize: '11.5px',
                          color: ds === 'overdue' ? C.red : ds === 'today' ? C.amber : C.text3,
                        }}>
                          <Clock style={{ width: '11px', height: '11px', flexShrink: 0 }} />
                          {fmtDate(card.dueDate)}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: C.text4 }}>—</span>
                      )}
                    </td>

                    {/* Estado */}
                    <td style={{ padding: '9px 14px' }}>
                      {card.completed ? (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${C.green}15`, border: `1px solid ${C.green}35`, color: C.green, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {t.table_completed}
                        </span>
                      ) : ds === 'overdue' ? (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${C.red}12`, border: `1px solid ${C.red}30`, color: C.red, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {t.table_overdue}
                        </span>
                      ) : ds === 'today' ? (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: `${C.amber}12`, border: `1px solid ${C.amber}30`, color: C.amber, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          Hoy
                        </span>
                      ) : (
                        <span style={{ fontSize: '10px', padding: '2px 7px', borderRadius: '4px', background: 'transparent', border: `1px solid ${C.border2}`, color: C.text4, fontWeight: 500, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                          {t.table_pending}
                        </span>
                      )}
                    </td>

                    {/* Miembros */}
                    <td style={{ padding: '9px 14px' }}>
                      {card.members && card.members.length > 0 ? (
                        <div style={{ display: 'flex' }}>
                          {card.members.slice(0, 4).map((m, mi) => (
                            <div
                              key={m.id}
                              title={m.name}
                              style={{
                                width: '22px', height: '22px', borderRadius: '50%',
                                background: `linear-gradient(135deg, ${C.accent}cc, ${C.accent}55)`,
                                color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: '9px', fontWeight: 700,
                                border: `2px solid ${C.surface}`,
                                marginLeft: mi > 0 ? '-6px' : 0,
                                zIndex: 4 - mi,
                                position: 'relative',
                              }}
                            >
                              {m.name.charAt(0).toUpperCase()}
                            </div>
                          ))}
                          {card.members.length > 4 && (
                            <div style={{
                              width: '22px', height: '22px', borderRadius: '50%',
                              background: C.hover, color: C.text3,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '9px', fontWeight: 600,
                              border: `2px solid ${C.surface}`,
                              marginLeft: '-6px', position: 'relative',
                            }}>
                              +{card.members.length - 4}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: C.text4 }}>—</span>
                      )}
                    </td>

                    {/* Labels */}
                    <td style={{ padding: '9px 14px' }}>
                      {card.labels && card.labels.length > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {card.labels.slice(0, 5).map((l) => (
                            <div
                              key={l.id}
                              title={l.name}
                              style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }}
                            />
                          ))}
                          {card.labels.length > 5 && (
                            <span style={{ fontSize: '10px', color: C.text4 }}>+{card.labels.length - 5}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '12px', color: C.text4 }}>—</span>
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
