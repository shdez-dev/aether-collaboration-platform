// apps/web/src/components/BoardCalendarView.tsx
'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Card, List } from '@aether/types';
import { useCardStore } from '@/stores/cardStore';
import { useT } from '@/lib/i18n';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface Props {
  lists: List[];
  filteredCards?: Record<string, Card[]> | null;
  onCardClick: (card: Card) => void;
}

// ─────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────
const DAYS_FULL  = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const DAYS_MINI  = ['L',   'M',   'X',   'J',   'V',   'S',   'D'  ];
const MONTHS_FULL = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
];
const MONTHS_SHORT = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
const DAY_ABBR = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];

// Rotating palette for lists (matching reference palette feel)
const LIST_COLORS = [
  '#38b6ff', // blue  (accent)
  '#e91e8c', // pink
  '#00e5cc', // teal
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ef4444', // red
  '#10b981', // emerald
  '#f97316', // orange
];

const PRIORITY_COLORS: Record<string, string> = {
  HIGH:   '#ef4444',
  MEDIUM: '#f59e0b',
  LOW:    '#38b6ff',
};

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────
function startOfWeekMonday(date: Date) {
  const d   = new Date(date);
  const day = d.getDay();
  d.setDate(d.getDate() + (day === 0 ? -6 : 1 - day));
  d.setHours(0, 0, 0, 0);
  return d;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() &&
         a.getMonth()    === b.getMonth()    &&
         a.getDate()     === b.getDate();
}
function toDateKey(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function buildCalDays(current: Date): Date[] {
  const start = startOfWeekMonday(new Date(current.getFullYear(), current.getMonth(), 1));
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

// ─────────────────────────────────────────────
// Sub-component: Mini calendar (sidebar)
// ─────────────────────────────────────────────
interface MiniCalendarProps {
  current:     Date;
  calDays:     Date[];
  cardsByDay:  Map<string, Card[]>;
  today:       Date;
  onPrev:      () => void;
  onNext:      () => void;
}

function MiniCalendar({ current, calDays, cardsByDay, today, onPrev, onNext }: MiniCalendarProps) {
  return (
    <div className="px-3 pt-3 pb-2 flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
      {/* Month nav */}
      <div className="flex items-center justify-between mb-2">
        <button
          onClick={onPrev}
          className="touch-auto w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-white/5"
        >
          <ChevronLeft className="w-3 h-3" style={{ color: 'var(--c-text3)' }} />
        </button>
        <span className="text-[10px] font-mono tracking-[0.12em] uppercase" style={{ color: 'var(--c-text2)' }}>
          {MONTHS_SHORT[current.getMonth()]} {current.getFullYear()}
        </span>
        <button
          onClick={onNext}
          className="touch-auto w-5 h-5 flex items-center justify-center rounded transition-colors hover:bg-white/5"
        >
          <ChevronRight className="w-3 h-3" style={{ color: 'var(--c-text3)' }} />
        </button>
      </div>

      {/* Day letters */}
      <div className="grid grid-cols-7 mb-0.5">
        {DAYS_MINI.map((d) => (
          <div key={d} className="text-center text-[9px] font-mono py-0.5" style={{ color: 'var(--c-text4)' }}>
            {d}
          </div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7">
        {calDays.map((day, i) => {
          const isToday        = isSameDay(day, today);
          const isCurrent      = day.getMonth() === current.getMonth();
          const hasCards       = cardsByDay.has(toDateKey(day));

          return (
            <div key={i} className="flex flex-col items-center py-px">
              <span
                className="w-5 h-5 flex items-center justify-center rounded-full text-[9px] font-mono transition-all"
                style={{
                  background: isToday ? 'var(--c-accent)' : 'transparent',
                  color:      isToday ? '#000' : isCurrent ? 'var(--c-text2)' : 'var(--c-text4)',
                  fontWeight: isToday ? 700 : 400,
                }}
              >
                {day.getDate()}
              </span>
              {/* dot for days with cards */}
              {hasCards && (
                <span
                  className="w-0.5 h-0.5 rounded-full mt-px"
                  style={{ background: isToday ? '#000' : 'var(--c-accent)' }}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: Upcoming section
// ─────────────────────────────────────────────
interface UpcomingSectionProps {
  cards:        Card[];
  onCardClick:  (card: Card) => void;
  listColorMap: Map<string, string>;
  today:        Date;
}

function UpcomingSection({ cards, onCardClick, listColorMap, today }: UpcomingSectionProps) {
  if (cards.length === 0) return null;

  return (
    <div className="flex-shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
      <div className="px-3 pt-2.5 pb-1">
        <span className="text-[9px] font-mono tracking-[0.15em] uppercase" style={{ color: 'var(--c-text3)' }}>
          PRÓXIMOS · 7 DÍAS
        </span>
      </div>
      <div className="pb-2">
        {cards.map((card, i) => {
          const date      = new Date(card.dueDate!);
          const dayNum    = date.getDate();
          const dayAbbr   = DAY_ABBR[date.getDay()];
          const color     = listColorMap.get(card.listId) ?? 'var(--c-accent)';
          const isOverdue = date < today;

          return (
            <motion.button
              key={card.id}
              onClick={() => onCardClick(card)}
              initial={{ opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.04 }}
              whileHover={{ backgroundColor: 'var(--c-surface)' }}
              className="touch-auto w-full flex items-center gap-2 px-3 py-1.5 transition-colors text-left"
            >
              {/* Day badge */}
              <div className="flex-shrink-0 w-7 text-right">
                <div className="text-[11px] font-mono leading-none" style={{ color: isOverdue ? 'var(--c-red)' : 'var(--c-text)' }}>
                  {dayNum}
                </div>
                <div className="text-[8px] font-mono tracking-wide" style={{ color: 'var(--c-text4)' }}>
                  {dayAbbr}
                </div>
              </div>

              {/* Title */}
              <span
                className="flex-1 text-[10px] font-mono truncate"
                style={{
                  color:          isOverdue ? 'var(--c-red)' : 'var(--c-text2)',
                  textDecoration: card.completed ? 'line-through' : 'none',
                }}
              >
                {card.title}
              </span>

              {/* Color dot */}
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: color }} />
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: Lists section ("Calendarios")
// ─────────────────────────────────────────────
interface ListsSectionProps {
  lists:        List[];
  listColorMap: Map<string, string>;
}

function ListsSection({ lists, listColorMap }: ListsSectionProps) {
  if (lists.length === 0) return null;

  return (
    <div className="flex-shrink-0 px-3 pt-2.5 pb-3" style={{ borderBottom: '1px solid var(--c-border)' }}>
      <span className="text-[9px] font-mono tracking-[0.15em] uppercase block mb-2" style={{ color: 'var(--c-text3)' }}>
        LISTAS
      </span>
      <div className="space-y-1.5">
        {lists.map((list) => {
          const color = listColorMap.get(list.id) ?? 'var(--c-accent)';
          return (
            <div key={list.id} className="flex items-center gap-2">
              <span
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: color }}
              />
              <span className="text-[10px] font-mono truncate" style={{ color: 'var(--c-text2)' }}>
                {list.name}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────
// Sub-component: No-date section
// ─────────────────────────────────────────────
interface NoDateSectionProps {
  count:       number;
  cards:       Card[];
  onCardClick: (card: Card) => void;
}

function NoDateSection({ count, cards, onCardClick }: NoDateSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="flex-shrink-0">
      <button
        onClick={() => setExpanded((v) => !v)}
        className="touch-auto w-full flex items-center justify-between px-3 py-2 hover:bg-white/5 transition-colors"
      >
        <span className="text-[9px] font-mono tracking-[0.15em] uppercase" style={{ color: 'var(--c-text3)' }}>
          SIN FECHA
        </span>
        <span className="text-[9px] font-mono" style={{ color: 'var(--c-text4)' }}>
          {count}
        </span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="overflow-hidden"
          >
            <div className="pb-2 max-h-40 overflow-y-auto">
              {cards.map((card, i) => (
                <motion.button
                  key={card.id}
                  onClick={() => onCardClick(card)}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  whileHover={{ backgroundColor: 'var(--c-surface)' }}
                  className="touch-auto w-full flex items-center gap-2 px-3 py-1.5 text-left transition-colors"
                >
                  <span
                    className="w-1 h-1 rounded-full flex-shrink-0"
                    style={{ background: 'var(--c-text4)' }}
                  />
                  <span
                    className="text-[10px] font-mono truncate"
                    style={{
                      color:          'var(--c-text3)',
                      textDecoration: card.completed ? 'line-through' : 'none',
                    }}
                  >
                    {card.title}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────
export function BoardCalendarView({ lists, filteredCards, onCardClick }: Props) {
  const t    = useT();
  const cards = useCardStore((s) => s.cards);

  const [current,     setCurrent]     = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const [direction,   setDirection]   = useState(0);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allCards = useMemo(() => {
    const source = filteredCards ?? cards;
    return Object.values(source).flat() as Card[];
  }, [filteredCards, cards]);

  const cardsByDay = useMemo(() => {
    const map = new Map<string, Card[]>();
    for (const card of allCards) {
      if (!card.dueDate) continue;
      const key = card.dueDate.slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(card);
    }
    return map;
  }, [allCards]);

  const noDateCards = useMemo(() => allCards.filter((c) => !c.dueDate), [allCards]);

  const upcomingCards = useMemo(() => {
    const now  = new Date(); now.setHours(0,0,0,0);
    const in7  = new Date(now); in7.setDate(in7.getDate() + 7);
    return allCards
      .filter((c) => { if (!c.dueDate) return false; const d = new Date(c.dueDate); return d >= now && d <= in7; })
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 8);
  }, [allCards]);

  const calDays = useMemo(() => buildCalDays(current), [current]);

  const today = useMemo(() => { const d = new Date(); d.setHours(0,0,0,0); return d; }, []);

  const listColorMap = useMemo(() => {
    const map = new Map<string, string>();
    lists.forEach((list, i) => map.set(list.id, LIST_COLORS[i % LIST_COLORS.length]));
    return map;
  }, [lists]);

  function prevMonth() {
    setDirection(-1);
    setCurrent((c) => { const d = new Date(c); d.setMonth(d.getMonth()-1); return d; });
  }
  function nextMonth() {
    setDirection(1);
    setCurrent((c) => { const d = new Date(c); d.setMonth(d.getMonth()+1); return d; });
  }
  function goToday() {
    setDirection(0);
    const d = new Date(); d.setDate(1);
    setCurrent(d);
  }

  const Sidebar = (
    <>
      <MiniCalendar
        current={current}
        calDays={calDays}
        cardsByDay={cardsByDay}
        today={today}
        onPrev={prevMonth}
        onNext={nextMonth}
      />
      <UpcomingSection
        cards={upcomingCards}
        onCardClick={onCardClick}
        listColorMap={listColorMap}
        today={today}
      />
      <ListsSection lists={lists} listColorMap={listColorMap} />
      {noDateCards.length > 0 && (
        <NoDateSection count={noDateCards.length} cards={noDateCards} onCardClick={onCardClick} />
      )}
    </>
  );

  return (
    <div className="flex flex-col h-full" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>

      {/* ── Header ───────────────────────────────── */}
      <div
        className="px-4 sm:px-6 py-2.5 flex items-center justify-between flex-shrink-0"
        style={{ borderBottom: '1px solid var(--c-border)', background: 'var(--c-bg)' }}
      >
        {/* Mode label + month/year */}
        <div className="flex items-center gap-3 overflow-hidden">
          <span
            className="hidden sm:block text-[9px] font-mono tracking-[0.18em] uppercase flex-shrink-0"
            style={{ color: 'var(--c-text3)' }}
          >
            CALENDARIO · MES
          </span>

          <div className="overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={`${current.getFullYear()}-${current.getMonth()}`}
                custom={direction}
                initial={{ y: direction >= 0 ? 10 : -10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: direction >= 0 ? -10 : 10, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeOut' }}
                className="flex items-baseline gap-1.5"
              >
                <span className="text-sm font-mono font-semibold" style={{ color: 'var(--c-text)' }}>
                  {MONTHS_FULL[current.getMonth()]}
                </span>
                <span className="text-sm font-mono" style={{ color: 'var(--c-text3)' }}>
                  {current.getFullYear()}
                </span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <motion.button
            onClick={prevMonth}
            whileHover={{ backgroundColor: 'var(--c-surface)' }}
            whileTap={{ scale: 0.88 }}
            className="touch-auto w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ border: '1px solid var(--c-border)' }}
            aria-label={t.calendar_prev}
          >
            <ChevronLeft className="w-3.5 h-3.5" style={{ color: 'var(--c-text3)' }} />
          </motion.button>

          <motion.button
            onClick={goToday}
            whileHover={{ backgroundColor: 'var(--c-surface)' }}
            whileTap={{ scale: 0.95 }}
            className="touch-auto px-2.5 h-6 text-[10px] font-mono tracking-wide rounded transition-colors"
            style={{ border: '1px solid var(--c-border)', color: 'var(--c-text2)' }}
          >
            HOY
          </motion.button>

          <motion.button
            onClick={nextMonth}
            whileHover={{ backgroundColor: 'var(--c-surface)' }}
            whileTap={{ scale: 0.88 }}
            className="touch-auto w-6 h-6 flex items-center justify-center rounded transition-colors"
            style={{ border: '1px solid var(--c-border)' }}
            aria-label={t.calendar_next}
          >
            <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--c-text3)' }} />
          </motion.button>

          {/* Mobile: panel toggle */}
          <motion.button
            onClick={() => setSidebarOpen(true)}
            whileTap={{ scale: 0.9 }}
            className="md:hidden touch-auto w-6 h-6 flex items-center justify-center rounded transition-colors ml-1"
            style={{ border: '1px solid var(--c-border)' }}
          >
            <span className="text-[10px] font-mono" style={{ color: 'var(--c-text3)' }}>≡</span>
          </motion.button>
        </div>
      </div>

      {/* ── Body ─────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden relative">

        {/* Main calendar grid */}
        <div className="flex-1 flex flex-col overflow-auto min-w-0">

          {/* Day-of-week headers */}
          <div
            className="grid grid-cols-7 flex-shrink-0"
            style={{ borderBottom: '1px solid var(--c-border)' }}
          >
            {DAYS_FULL.map((d, i) => (
              <div
                key={d}
                className="py-2 text-center text-[9px] sm:text-[10px] font-mono tracking-[0.12em] uppercase"
                style={{ color: i >= 5 ? 'var(--c-text4)' : 'var(--c-text3)' }}
              >
                <span className="hidden sm:inline">{d}</span>
                <span className="sm:hidden">{d.charAt(0)}</span>
              </div>
            ))}
          </div>

          {/* Month grid */}
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={`${current.getFullYear()}-${current.getMonth()}`}
              custom={direction}
              initial={{ x: direction * 24, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: direction * -24, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="grid grid-cols-7 flex-1"
              style={{ gridTemplateRows: 'repeat(6, 1fr)' }}
            >
              {calDays.map((day, i) => {
                const key           = toDateKey(day);
                const dayCards      = cardsByDay.get(key) ?? [];
                const isToday       = isSameDay(day, today);
                const isCurrentMonth = day.getMonth() === current.getMonth();
                const isPast        = day < today && !isToday;
                const isWeekend     = day.getDay() === 0 || day.getDay() === 6;
                const visibleCards  = dayCards.slice(0, 3);
                const extra         = dayCards.length - 3;

                return (
                  <div
                    key={i}
                    className="flex flex-col p-1 sm:p-1.5"
                    style={{
                      borderBottom: '1px solid var(--c-border)',
                      borderRight:  '1px solid var(--c-border)',
                      minHeight:    '72px',
                      background:   !isCurrentMonth
                        ? 'transparent'
                        : isWeekend
                          ? 'rgba(56,182,255,0.018)'
                          : 'var(--c-bg)',
                    }}
                  >
                    {/* Day number */}
                    <div className="flex items-start mb-1">
                      <span
                        className="text-[10px] sm:text-[11px] font-mono w-5 h-5 sm:w-[22px] sm:h-[22px] flex items-center justify-center rounded-full leading-none transition-all flex-shrink-0"
                        style={{
                          background: isToday ? 'var(--c-accent)' : 'transparent',
                          color: isToday
                            ? '#000'
                            : !isCurrentMonth
                              ? 'var(--c-text4)'
                              : isPast
                                ? 'var(--c-text3)'
                                : 'var(--c-text2)',
                          fontWeight: isToday ? 700 : 400,
                        }}
                      >
                        {day.getDate()}
                      </span>
                    </div>

                    {/* Card chips */}
                    <div className="flex flex-col gap-[2px] flex-1">
                      {visibleCards.map((card, ci) => {
                        const isOverdue  = isPast && !card.completed && isCurrentMonth;
                        const listColor  = listColorMap.get(card.listId) ?? 'var(--c-accent)';
                        const chipColor  = isOverdue
                          ? 'var(--c-red)'
                          : card.completed
                            ? 'var(--c-green)'
                            : (card.priority ? PRIORITY_COLORS[card.priority] : listColor);

                        return (
                          <motion.button
                            key={card.id}
                            onClick={() => onCardClick(card)}
                            initial={{ opacity: 0, y: 2 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: ci * 0.04 }}
                            whileHover={{ filter: 'brightness(1.15)', x: 0.5 }}
                            className="touch-auto w-full text-left text-[9px] sm:text-[10px] font-mono leading-snug truncate transition-all"
                            style={{
                              paddingLeft:    '4px',
                              paddingRight:   '3px',
                              paddingTop:     '1px',
                              paddingBottom:  '1px',
                              borderLeft:     `2px solid ${chipColor}`,
                              borderRadius:   '0 2px 2px 0',
                              background:     isOverdue
                                ? 'rgba(239,68,68,0.08)'
                                : card.completed
                                  ? 'rgba(0,229,204,0.07)'
                                  : `${chipColor}14`,
                              color:          isOverdue
                                ? 'var(--c-red)'
                                : card.completed
                                  ? 'var(--c-green)'
                                  : 'var(--c-text2)',
                              textDecoration: card.completed ? 'line-through' : 'none',
                            }}
                            title={card.title}
                          >
                            <span className="hidden sm:inline">{card.title}</span>
                            <span className="sm:hidden">
                              {card.title.length > 5 ? `${card.title.slice(0,5)}…` : card.title}
                            </span>
                          </motion.button>
                        );
                      })}

                      {extra > 0 && (
                        <span
                          className="text-[9px] font-mono pl-1 leading-none"
                          style={{ color: 'var(--c-text4)' }}
                        >
                          +{extra}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* ── Desktop sidebar ───────────────────── */}
        <motion.aside
          initial={{ opacity: 0, x: 8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.14 }}
          className="hidden md:flex flex-col flex-shrink-0 overflow-y-auto"
          style={{
            width:      '210px',
            borderLeft: '1px solid var(--c-border)',
            background: 'var(--c-bg2)',
          }}
        >
          {Sidebar}
        </motion.aside>

        {/* ── Mobile sidebar overlay ────────────── */}
        <AnimatePresence>
          {sidebarOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                onClick={() => setSidebarOpen(false)}
                className="md:hidden absolute inset-0 z-10"
                style={{ background: 'rgba(0,0,0,0.65)' }}
              />
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 30, stiffness: 340 }}
                className="md:hidden absolute right-0 top-0 bottom-0 z-20 flex flex-col overflow-y-auto shadow-xl"
                style={{
                  width:      '230px',
                  background: 'var(--c-bg2)',
                  borderLeft: '1px solid var(--c-border)',
                }}
              >
                {/* Mobile panel header */}
                <div
                  className="flex items-center justify-between px-3 py-2 flex-shrink-0"
                  style={{ borderBottom: '1px solid var(--c-border)' }}
                >
                  <span className="text-[9px] font-mono tracking-[0.18em] uppercase" style={{ color: 'var(--c-text3)' }}>
                    PANEL
                  </span>
                  <motion.button
                    onClick={() => setSidebarOpen(false)}
                    whileTap={{ scale: 0.9 }}
                    className="touch-auto p-1"
                    style={{ color: 'var(--c-text3)' }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </motion.button>
                </div>

                <MiniCalendar
                  current={current}
                  calDays={calDays}
                  cardsByDay={cardsByDay}
                  today={today}
                  onPrev={prevMonth}
                  onNext={nextMonth}
                />
                <UpcomingSection
                  cards={upcomingCards}
                  onCardClick={(c) => { onCardClick(c); setSidebarOpen(false); }}
                  listColorMap={listColorMap}
                  today={today}
                />
                <ListsSection lists={lists} listColorMap={listColorMap} />
                {noDateCards.length > 0 && (
                  <NoDateSection
                    count={noDateCards.length}
                    cards={noDateCards}
                    onCardClick={(c) => { onCardClick(c); setSidebarOpen(false); }}
                  />
                )}
              </motion.div>
            </>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
