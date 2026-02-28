// apps/web/src/components/BoardCalendarView.tsx
'use client';

import { useState, useMemo } from 'react';
import type { Card, List } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useT } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, Calendar, AlertTriangle } from 'lucide-react';

interface Props {
  lists: List[];
  filteredCards?: Record<string, Card[]> | null;
  onCardClick: (card: Card) => void;
}

const DAYS_SHORT = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const MONTHS_FULL = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

function startOfWeekMonday(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function isSameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const PRIORITY_DOT: Record<string, string> = {
  HIGH: 'bg-error',
  MEDIUM: 'bg-warning',
  LOW: 'bg-blue-500',
};

export function BoardCalendarView({ lists, filteredCards, onCardClick }: Props) {
  const t = useT();
  const cards = useCardStore((s) => s.cards);
  const [current, setCurrent] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d;
  });

  const allCards = useMemo(() => {
    const source = filteredCards ?? cards;
    return Object.values(source).flat() as Card[];
  }, [filteredCards, cards]);

  // Cards agrupadas por día (solo las que tienen dueDate)
  const cardsByDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of allCards) {
      if (!card.dueDate) continue;
      const key = card.dueDate.slice(0, 10); // YYYY-MM-DD
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [allCards]);

  // Cards sin fecha
  const noDateCards = useMemo(() => allCards.filter((c) => !c.dueDate), [allCards]);

  // Calcular días del calendario (6 semanas, empezando el lunes)
  const calDays = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();
    const firstDay = new Date(year, month, 1);
    const start = startOfWeekMonday(firstDay);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [current]);

  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  function prevMonth() {
    setCurrent((c) => {
      const d = new Date(c);
      d.setMonth(d.getMonth() - 1);
      return d;
    });
  }
  function nextMonth() {
    setCurrent((c) => {
      const d = new Date(c);
      d.setMonth(d.getMonth() + 1);
      return d;
    });
  }
  function goToday() {
    const d = new Date();
    d.setDate(1);
    setCurrent(d);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header del calendario */}
      <div className="px-6 py-3 border-b border-border bg-card flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={prevMonth}
            className="p-1.5 hover:bg-surface border border-transparent hover:border-border transition-all"
          >
            <ChevronLeft className="w-4 h-4 text-text-muted" />
          </button>
          <h2 className="text-base font-semibold text-text-primary min-w-[180px] text-center font-mono">
            {MONTHS_FULL[current.getMonth()]} {current.getFullYear()}
          </h2>
          <button
            onClick={nextMonth}
            className="p-1.5 hover:bg-surface border border-transparent hover:border-border transition-all"
          >
            <ChevronRight className="w-4 h-4 text-text-muted" />
          </button>
        </div>
        <button
          onClick={goToday}
          className="px-3 py-1.5 text-xs text-text-muted hover:text-text-primary border border-border hover:border-accent transition-all font-mono"
        >
          {t.calendar_today}
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Grid del calendario */}
        <div className="flex-1 flex flex-col overflow-auto">
          {/* Cabecera de días */}
          <div className="grid grid-cols-7 border-b border-border bg-card flex-shrink-0">
            {DAYS_SHORT.map((d) => (
              <div
                key={d}
                className="py-2 text-center text-[11px] font-semibold text-text-muted uppercase tracking-wider"
              >
                {d}
              </div>
            ))}
          </div>

          {/* Semanas */}
          <div className="grid grid-cols-7 flex-1" style={{ gridTemplateRows: 'repeat(6, 1fr)' }}>
            {calDays.map((day, i) => {
              const key = toDateKey(day);
              const dayCards = cardsByDay.get(key) ?? [];
              const isToday = isSameDay(day, today);
              const isCurrentMonth = day.getMonth() === current.getMonth();
              const isPast = day < today && !isToday;
              const visibleCards = dayCards.slice(0, 3);
              const extra = dayCards.length - 3;

              return (
                <div
                  key={i}
                  className={`border-b border-r border-border p-1.5 min-h-[100px] flex flex-col ${
                    isCurrentMonth ? 'bg-background' : 'bg-card/40'
                  }`}
                >
                  {/* Número del día */}
                  <div className="flex items-center justify-between mb-1">
                    <span
                      className={`text-xs font-mono font-medium w-6 h-6 flex items-center justify-center rounded-full ${
                        isToday
                          ? 'bg-accent text-white'
                          : isCurrentMonth
                            ? isPast
                              ? 'text-text-muted'
                              : 'text-text-primary'
                            : 'text-text-muted/40'
                      }`}
                    >
                      {day.getDate()}
                    </span>
                  </div>

                  {/* Cards del día */}
                  <div className="flex flex-col gap-0.5 flex-1">
                    {visibleCards.map((card) => {
                      const isOverdue = isPast && !card.completed && isCurrentMonth;
                      return (
                        <button
                          key={card.id}
                          onClick={() => onCardClick(card)}
                          className={`w-full text-left px-1.5 py-0.5 text-[10px] leading-snug truncate border transition-colors ${
                            card.completed
                              ? 'border-success/20 bg-success/10 text-success line-through'
                              : isOverdue
                                ? 'border-error/30 bg-error/10 text-error hover:bg-error/20'
                                : 'border-accent/20 bg-accent/10 text-text-primary hover:bg-accent/20'
                          }`}
                          title={card.title}
                        >
                          <div className="flex items-center gap-1">
                            {card.priority && (
                              <div
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[card.priority] ?? 'bg-text-muted'}`}
                              />
                            )}
                            <span className="truncate">{card.title}</span>
                          </div>
                        </button>
                      );
                    })}
                    {extra > 0 && (
                      <span className="text-[9px] text-text-muted pl-1 font-mono">
                        +{extra} más
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: cards sin fecha */}
        <div className="w-56 border-l border-border bg-card flex-shrink-0 flex flex-col overflow-hidden">
          <div className="px-3 py-2.5 border-b border-border flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-text-muted" />
            <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
              {t.calendar_no_date}
            </span>
            <span className="ml-auto text-xs text-text-muted font-mono">{noDateCards.length}</span>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            {noDateCards.length === 0 ? (
              <p className="text-[11px] text-text-muted text-center py-4 font-mono">—</p>
            ) : (
              noDateCards.map((card) => (
                <button
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  className="w-full text-left px-2 py-1.5 text-[11px] border border-border hover:border-accent hover:bg-surface transition-colors"
                  title={card.title}
                >
                  <div className="flex items-center gap-1.5">
                    {card.priority && (
                      <div
                        className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PRIORITY_DOT[card.priority]}`}
                      />
                    )}
                    <span
                      className={`truncate ${card.completed ? 'line-through text-text-muted' : 'text-text-secondary'}`}
                    >
                      {card.title}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
