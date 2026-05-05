'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

// ── Kanban mock — visual fiel al diseño actual del proyecto ──────────────────

const COLS = [
  {
    name: 'Backlog',
    count: 8,
    cards: [
      { id: 'AET-241', title: 'Migrar workers a streaming SSE', tag: 'feat', av: 'AM', avColor: '#3b82f6' },
      { id: 'AET-238', title: 'Auditoría queries N+1 en GraphQL', tag: 'ops', av: 'RK', avColor: '#10b981' },
      { id: 'AET-233', title: 'Rate limit por workspace', tag: 'feat', av: 'JL', avColor: '#f59e0b' },
    ],
  },
  {
    name: 'In Progress',
    count: 5,
    cards: [
      { id: 'AET-240', title: 'CRDT para documentos colaborativos', tag: 'feat', av: 'SO', avColor: '#a855f7' },
      { id: 'AET-237', title: 'Fix: conflicto de cursores en tablas', tag: 'bug', av: 'AM', avColor: '#3b82f6' },
    ],
  },
  {
    name: 'In Review',
    count: 3,
    cards: [
      { id: 'AET-231', title: 'RFC: permisos granulares por recurso', tag: 'rfc', av: 'JL', avColor: '#f59e0b' },
      { id: 'AET-229', title: 'Index invertido para búsqueda global', tag: 'feat', av: 'SO', avColor: '#a855f7' },
    ],
  },
  {
    name: 'Done',
    count: 14,
    cards: [
      { id: 'AET-226', title: 'Presencia en vivo con heartbeat', tag: 'feat', av: 'AM', avColor: '#3b82f6' },
      { id: 'AET-224', title: 'CLI: aether ship para deploys', tag: 'feat', av: 'RK', avColor: '#10b981' },
    ],
  },
];

const TAG: Record<string, { background: string; color: string }> = {
  feat: { background: 'rgba(59,130,246,0.15)', color: '#93c5fd' },
  bug:  { background: 'rgba(239,68,68,0.15)',  color: '#fca5a5' },
  ops:  { background: 'rgba(245,158,11,0.15)', color: '#fcd34d' },
  rfc:  { background: 'rgba(100,116,139,0.2)', color: '#cbd5e1' },
};

const CURSOR_1 = [[280, 110], [180, 220], [360, 280], [500, 160]];
const CURSOR_2 = [[520, 200], [680, 130], [590, 300], [410, 240]];

// Sidebar navigation matching actual DashboardLayout
const SIDEBAR_NAV = [
  { icon: '▣', name: 'Workspaces', count: '4', active: false },
  { icon: '▦', name: 'Boards', count: '12', active: false },
  { icon: '▤', name: 'Documentos', count: '8', active: false },
  { icon: '◉', name: 'Notificaciones', count: '3', active: false },
];

function ProductShot() {
  const [pos1, setPos1] = useState<number[]>(CURSOR_1[0]);
  const [pos2, setPos2] = useState<number[]>(CURSOR_2[0]);

  useEffect(() => {
    let i1 = 0, i2 = 1;
    setTimeout(() => {
      setPos1(CURSOR_1[1]);
      setPos2(CURSOR_2[0]);
    }, 600);
    const timer = setInterval(() => {
      i1 = (i1 + 1) % CURSOR_1.length;
      i2 = (i2 + 1) % CURSOR_2.length;
      setPos1(CURSOR_1[i1]);
      setPos2(CURSOR_2[i2]);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // App colors — match actual project theme
  const bg = 'hsl(0 0% 7%)';          // --background
  const surface = 'hsl(0 0% 12%)';    // --muted / surface
  const border = 'hsl(0 0% 20%)';     // --border
  const textPrimary = 'hsl(210 40% 98%)';
  const textMuted = 'hsl(215 20.2% 65.1%)';
  const accent = 'hsl(217.2 91.2% 59.8%)'; // #3b82f6

  return (
    <div
      className="rounded-xl overflow-hidden font-mono"
      style={{
        background: bg,
        border: `1px solid ${border}`,
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.7), 0 0 60px -20px rgba(59,130,246,0.1)',
      }}
    >
      {/* Window chrome */}
      <div
        className="flex items-center gap-3 px-4 py-2.5"
        style={{ borderBottom: `1px solid ${border}`, background: surface }}
      >
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2.5 h-2.5 rounded-full" style={{ background: border }} />
          ))}
        </div>
        <span className="flex-1 text-center text-[11px]" style={{ color: textMuted }}>
          aether.app / workspace / platform-team / sprint-14
        </span>
        <div className="w-12" />
      </div>

      {/* Dashboard layout */}
      <div className="flex" style={{ minHeight: 500 }}>
        {/* Sidebar — fiel al DashboardLayout real */}
        <aside
          className="w-[200px] shrink-0 flex flex-col"
          style={{ borderRight: `1px solid ${border}` }}
        >
          {/* Header */}
          <div className="p-4" style={{ borderBottom: `1px solid ${border}` }}>
            <h1 className="text-base font-normal mb-0.5" style={{ color: textPrimary }}>
              [ AETHER ]
            </h1>
            <p className="text-[11px]" style={{ color: textMuted }}>
              Event-sourced platform
            </p>
            <div
              className="mt-2 text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded w-fit"
              style={{ color: '#22c55e', background: 'rgba(34,197,94,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}
            >
              OPERATIONAL
            </div>
          </div>

          {/* User info */}
          <div className="p-3" style={{ borderBottom: `1px solid ${border}` }}>
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-sm flex items-center justify-center text-sm font-bold shrink-0"
                style={{ background: 'rgba(59,130,246,0.2)', color: accent }}
              >
                A
              </div>
              <div className="min-w-0">
                <p className="text-[12px] truncate" style={{ color: textPrimary }}>Ana García</p>
                <p className="text-[10px] truncate" style={{ color: textMuted }}>ana@platform.dev</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-3 space-y-0.5">
            {SIDEBAR_NAV.map((item, i) => (
              <div
                key={item.name}
                className="flex items-center gap-2.5 px-2.5 py-2 rounded-sm text-[12px]"
                style={{
                  background: i === 0 ? `rgba(59,130,246,0.15)` : 'transparent',
                  color: i === 0 ? accent : textMuted,
                  border: i === 0 ? `1px solid rgba(59,130,246,0.35)` : '1px solid transparent',
                }}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.name}</span>
                <span className="ml-auto text-[10px]" style={{ color: textMuted }}>{item.count}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Main board */}
        <div className="flex-1 p-4 overflow-hidden relative" style={{ background: bg }}>
          {/* Board header */}
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: textMuted }}>
                platform / sprint-14
              </p>
              <h3 className="text-[14px] font-normal" style={{ color: textPrimary }}>
                Plataforma — Sprint 14
              </h3>
            </div>
            <div className="flex -space-x-1.5">
              {[
                { init: 'AM', color: '#3b82f6' },
                { init: 'RK', color: '#10b981' },
                { init: 'JL', color: '#f59e0b' },
                { init: 'SO', color: '#a855f7' },
              ].map((av) => (
                <div
                  key={av.init}
                  className="w-5 h-5 rounded-sm flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                  style={{ background: av.color, outline: `2px solid ${bg}` }}
                >
                  {av.init}
                </div>
              ))}
            </div>
          </div>

          {/* Kanban columns */}
          <div className="grid grid-cols-4 gap-3">
            {COLS.map((col) => (
              <div
                key={col.name}
                className="rounded-sm p-2.5"
                style={{ background: surface, border: `1px solid ${border}` }}
              >
                <div className="flex items-center justify-between mb-2.5">
                  <span className="text-[10px] uppercase tracking-[0.08em]" style={{ color: textMuted }}>
                    {col.name}
                  </span>
                  <span
                    className="text-[10px] px-1 py-0.5 rounded-sm"
                    style={{ background: border, color: textMuted }}
                  >
                    {col.count}
                  </span>
                </div>
                <div className="flex flex-col gap-1.5">
                  {col.cards.map((card) => (
                    <div
                      key={card.id}
                      className="rounded-sm p-2"
                      style={{ background: bg, border: `1px solid ${border}` }}
                    >
                      <p className="text-[9px] mb-0.5" style={{ color: textMuted }}>{card.id}</p>
                      <p className="text-[11px] leading-[1.35] mb-1.5" style={{ color: textPrimary }}>
                        {card.title}
                      </p>
                      <div className="flex items-center justify-between">
                        <span
                          className="text-[8px] px-1 py-0.5 rounded-sm uppercase tracking-[0.03em]"
                          style={TAG[card.tag] ?? TAG.feat}
                        >
                          {card.tag}
                        </span>
                        <div
                          className="w-3.5 h-3.5 rounded-sm flex items-center justify-center text-[7px] font-bold text-white"
                          style={{ background: card.avColor }}
                        >
                          {card.av}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Live cursor 1 */}
          <div
            className="absolute pointer-events-none z-10 top-0 left-0"
            style={{
              transform: `translate(${pos1[0]}px, ${pos1[1]}px)`,
              transition: 'transform 2.8s cubic-bezier(0.4,0.2,0.2,1)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
              <path d="M2 2L16 8L8 10L6 16L2 2Z" fill="#10b981" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute top-3.5 left-2.5 text-[9px] px-1 py-0.5 rounded-sm font-medium text-white whitespace-nowrap"
              style={{ background: '#10b981' }}
            >
              Rafa
            </span>
          </div>

          {/* Live cursor 2 */}
          <div
            className="absolute pointer-events-none z-10 top-0 left-0"
            style={{
              transform: `translate(${pos2[0]}px, ${pos2[1]}px)`,
              transition: 'transform 2.8s cubic-bezier(0.4,0.2,0.2,1)',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 18 18" fill="none" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.5))' }}>
              <path d="M2 2L16 8L8 10L6 16L2 2Z" fill="#a855f7" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
            </svg>
            <span
              className="absolute top-3.5 left-2.5 text-[9px] px-1 py-0.5 rounded-sm font-medium text-white whitespace-nowrap"
              style={{ background: '#a855f7' }}
            >
              Sofi
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Logo del proyecto — la "A" SVG estática (versión small para nav) ──────────
function AetherNavLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 220 220"
      fill="none"
      aria-label="Aether logo"
    >
      {/* Piernas de la A */}
      <path d="M 110 39 L 32 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
      <path d="M 110 39 L 188 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
      {/* Travesaño */}
      <path d="M 66 122 L 154 122" stroke="#3B82F6" strokeWidth="7" strokeLinecap="round" />
      {/* Nodos principales */}
      <circle cx="110" cy="39" r="9" fill="#3B82F6" />
      <circle cx="32" cy="173" r="9" fill="#3B82F6" />
      <circle cx="188" cy="173" r="9" fill="#3B82F6" />
    </svg>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export function HeroSection() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  return (
    <>
      {/* ── NAV ──────────────────────────────────────────────────────────── */}
      <nav
        className="sticky top-0 z-50"
        style={{
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          background: 'var(--home-nav-bg)',
          borderBottom: '1px solid var(--home-nav-border)',
        }}
      >
        <div className="max-w-[1240px] mx-auto px-8 flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 text-sm font-semibold" style={{ color: 'var(--home-text-logo)' }}>
            <AetherNavLogo />
            <span>Aether</span>
          </Link>

          {/* Actions */}
          <div className="flex items-center gap-2.5">
            <div className="hidden sm:block">
              <LanguageSwitcher variant="floating" />
            </div>
            {!isAuthenticated && (
              <Link
                href="/login"
                className="hidden sm:inline-flex text-sm px-3 py-2 rounded-lg transition-colors"
                style={{ color: 'var(--home-text-2)' }}
              >
                {t.home_hero_cta_login}
              </Link>
            )}
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center text-sm font-medium text-white px-3.5 py-2 rounded-lg transition-all hover:-translate-y-px"
                style={{
                  background: '#3b82f6',
                  boxShadow: '0 4px 14px -4px rgba(59,130,246,0.4)',
                }}
              >
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <Link
                href="/register"
                className="inline-flex items-center text-sm font-medium text-white px-3.5 py-2 rounded-lg transition-all hover:-translate-y-px"
                style={{
                  background: '#3b82f6',
                  boxShadow: '0 4px 14px -4px rgba(59,130,246,0.4)',
                }}
              >
                {t.home_hero_cta_start}
              </Link>
            )}
          </div>
        </div>
      </nav>

      {/* ── HERO ─────────────────────────────────────────────────────────── */}
      <section className="relative pt-20 pb-0">
        {/* Grid background */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `
                linear-gradient(var(--home-grid-line) 1px, transparent 1px),
                linear-gradient(90deg, var(--home-grid-line) 1px, transparent 1px)
              `,
              backgroundSize: '64px 64px',
              maskImage: 'radial-gradient(ellipse 90% 60% at 50% 30%, black 40%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 30%, black 40%, transparent 100%)',
            }}
          />
        </div>

        <div className="relative z-10 max-w-[1240px] mx-auto px-8">
          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.06 }}
            className="font-bold leading-[1.02] mb-6 max-w-[920px]"
            style={{ fontSize: 'clamp(40px, 6vw, 72px)', letterSpacing: '-0.035em' }}
          >
            <span style={{ color: 'var(--home-text-1)' }}>{t.home_hero_title_main} </span>
            <span style={{ color: 'var(--home-text-3)' }}>{t.home_hero_title_dim}</span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.14 }}
            className="leading-relaxed mb-9 max-w-xl text-[19px]"
            style={{ color: 'var(--home-text-2)' }}
          >
            {t.home_hero_description}
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="flex items-center gap-3 flex-wrap mb-14"
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 font-medium text-white px-5 py-3 rounded-[10px] transition-all hover:-translate-y-px text-[15px]"
                style={{
                  background: '#3b82f6',
                  boxShadow: '0 4px 16px -4px rgba(59,130,246,0.45)',
                }}
              >
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center gap-2 font-medium text-white px-5 py-3 rounded-[10px] transition-all hover:-translate-y-px text-[15px]"
                  style={{
                    background: '#3b82f6',
                    boxShadow: '0 4px 16px -4px rgba(59,130,246,0.45)',
                  }}
                >
                  {t.home_hero_cta_start} →
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center font-medium text-[15px] px-5 py-3 rounded-[10px] transition-all"
                  style={{
                    color: 'var(--home-glass-text)',
                    background: 'var(--home-glass)',
                    border: '1px solid var(--home-glass-border)',
                  }}
                >
                  {t.home_hero_cta_login}
                </Link>
              </>
            )}
          </motion.div>

          {/* Meta stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.32 }}
            className="flex gap-10 flex-wrap font-mono text-xs mb-16 pt-6 max-w-[620px]"
            style={{
              color: 'var(--home-text-3)',
              borderTop: '1px solid var(--home-border)',
            }}
          >
            {[
              { value: t.home_hero_stat1_value, label: t.home_hero_stat1_label },
              { value: t.home_hero_stat2_value, label: t.home_hero_stat2_label },
              { value: t.home_hero_stat3_value, label: t.home_hero_stat3_label },
            ].map((s) => (
              <div key={s.label}>
                <strong
                  className="block font-semibold mb-0.5 text-[15px]"
                  style={{ color: 'var(--home-stat-value)', fontFamily: 'inherit' }}
                >
                  {s.value}
                </strong>
                <span>{s.label}</span>
              </div>
            ))}
          </motion.div>

          {/* Product shot */}
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.42 }}
            className="hidden md:block"
          >
            <ProductShot />
          </motion.div>
        </div>
      </section>
    </>
  );
}
