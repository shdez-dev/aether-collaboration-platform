'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';
import { C } from '@/lib/colors';

// ── Datos del mock ────────────────────────────────────────────────────────────

const COLS: {
  name: string;
  count: number;
  cards: { title: string; priority: 'HIGH' | 'MEDIUM' | 'LOW'; labels: string[]; av: string; avColor: string; due?: string; dueColor?: string; completed?: boolean }[];
}[] = [
  {
    name: 'Backlog',
    count: 8,
    cards: [
      { title: 'Migrar workers a streaming SSE', priority: 'HIGH', labels: ['#3b82f6', '#a855f7'], av: 'AM', avColor: '#3b82f6' },
      { title: 'Auditoría queries N+1 en GraphQL', priority: 'MEDIUM', labels: ['#f59e0b'], av: 'RK', avColor: '#10b981', due: '12 Jun', dueColor: '#6b7280' },
      { title: 'Rate limit por workspace', priority: 'LOW', labels: ['#3b82f6'], av: 'JL', avColor: '#f59e0b' },
    ],
  },
  {
    name: 'In Progress',
    count: 5,
    cards: [
      { title: 'CRDT para documentos colaborativos', priority: 'HIGH', labels: ['#a855f7', '#3b82f6'], av: 'SO', avColor: '#a855f7', due: 'Hoy', dueColor: '#f59e0b' },
      { title: 'Fix: conflicto de cursores en tablas', priority: 'MEDIUM', labels: ['#ef4444'], av: 'AM', avColor: '#3b82f6' },
    ],
  },
  {
    name: 'In Review',
    count: 3,
    cards: [
      { title: 'RFC: permisos granulares por recurso', priority: 'LOW', labels: ['#6b7280'], av: 'JL', avColor: '#f59e0b', due: '20 Jun', dueColor: '#6b7280' },
      { title: 'Index invertido para búsqueda global', priority: 'MEDIUM', labels: ['#3b82f6'], av: 'SO', avColor: '#a855f7' },
    ],
  },
  {
    name: 'Done',
    count: 14,
    cards: [
      { title: 'Presencia en vivo con heartbeat', priority: 'HIGH', labels: ['#3b82f6'], av: 'AM', avColor: '#3b82f6', completed: true },
      { title: 'CLI: aether ship para deploys', priority: 'MEDIUM', labels: ['#10b981'], av: 'RK', avColor: '#10b981', completed: true },
    ],
  },
];

const PRIORITY_META = {
  HIGH:   { label: 'Alta',   color: '#ef4444', bg: 'rgba(239,68,68,0.12)'  },
  MEDIUM: { label: 'Media',  color: '#f59e0b', bg: 'rgba(245,158,11,0.12)' },
  LOW:    { label: 'Baja',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
};

const CURSOR_1 = [[300, 120], [190, 230], [380, 290], [510, 165]];
const CURSOR_2 = [[530, 210], [690, 140], [600, 310], [420, 250]];

// ── Mock card — idéntica al componente Card real ──────────────────────────────

function MockCard({ title, priority, labels, av, avColor, due, dueColor, completed }: (typeof COLS)[0]['cards'][0]) {
  const prio = PRIORITY_META[priority];
  const baseBg     = completed ? `${C.green}09` : C.surface;
  const baseBorder = completed ? `${C.green}2e` : C.border;

  return (
    <div
      style={{
        background: baseBg,
        border: `1px solid ${baseBorder}`,
        borderRadius: '8px',
        padding: '9px 10px 8px',
      }}
    >
      {/* Label strips */}
      {labels.length > 0 && (
        <div className="flex gap-1 mb-2">
          {labels.map((color, i) => (
            <span key={i} style={{ display: 'inline-block', height: '4px', width: '24px', borderRadius: '2px', background: color }} />
          ))}
        </div>
      )}

      {/* Checkbox + Title */}
      <div className="flex items-start gap-2">
        <span
          className="flex-shrink-0 flex items-center justify-center rounded-[5px] mt-[1px]"
          style={{
            width: '16px', height: '16px',
            border: `1.5px solid ${completed ? C.green : C.text3}`,
            background: completed ? C.green : 'transparent',
            flexShrink: 0,
          }}
        >
          {completed && (
            <svg viewBox="0 0 10 10" fill="none" stroke="white" strokeWidth="2" width="8" height="8">
              <path d="M2 5l2.5 2.5 3.5-4" />
            </svg>
          )}
        </span>
        <p style={{
          fontSize: '12.5px', fontWeight: 500, lineHeight: 1.45, flex: 1, wordBreak: 'break-word',
          color: completed ? C.text3 : C.text,
          textDecoration: completed ? 'line-through' : 'none',
        }}>
          {title}
        </p>
      </div>

      {/* Footer */}
      <div className="flex items-center gap-2 mt-2 flex-wrap" style={{ minHeight: '18px' }}>
        <span style={{
          fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px',
          background: prio.bg, color: prio.color, border: `1px solid ${prio.color}33`, flexShrink: 0,
        }}>
          {prio.label}
        </span>

        {due && (
          <div className="flex items-center gap-[3px]" style={{ flexShrink: 0 }}>
            <svg viewBox="0 0 14 14" fill="none" stroke={dueColor} strokeWidth="1.4" width="10" height="10">
              <rect x="1" y="2" width="12" height="11" rx="1.5" /><path d="M4 1v2M10 1v2M1 6h12" />
            </svg>
            <span style={{ fontSize: '10.5px', color: dueColor, fontVariantNumeric: 'tabular-nums' }}>{due}</span>
          </div>
        )}

        <div style={{ flex: 1 }} />

        <div
          className="flex items-center justify-center text-[8px] font-bold text-white"
          style={{ width: '16px', height: '16px', borderRadius: '4px', background: avColor, flexShrink: 0 }}
        >
          {av}
        </div>
      </div>
    </div>
  );
}

// ── Mock list — idéntica al componente BoardList real ─────────────────────────

function MockList({ name, count, cards }: (typeof COLS)[0]) {
  return (
    <div style={{
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: '10px',
      width: '210px',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '10px 10px 10px 8px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex', alignItems: 'center', gap: '6px',
      }}>
        {/* Drag handle dots */}
        <svg viewBox="0 0 10 16" fill="none" width="10" height="14" style={{ color: C.text4, flexShrink: 0 }}>
          <circle cx="3" cy="3" r="1.2" fill="currentColor" /><circle cx="7" cy="3" r="1.2" fill="currentColor" />
          <circle cx="3" cy="8" r="1.2" fill="currentColor" /><circle cx="7" cy="8" r="1.2" fill="currentColor" />
          <circle cx="3" cy="13" r="1.2" fill="currentColor" /><circle cx="7" cy="13" r="1.2" fill="currentColor" />
        </svg>
        <span style={{ flex: 1, fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name}
        </span>
        <span style={{
          fontSize: '10.5px', fontWeight: 600, color: C.text4,
          background: C.hover, border: `1px solid ${C.border2}`,
          borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
        }}>
          {count}
        </span>
      </div>

      {/* Cards */}
      <div style={{ padding: '8px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {cards.map((card, i) => <MockCard key={i} {...card} />)}
      </div>
    </div>
  );
}

// ── ProductShot ───────────────────────────────────────────────────────────────

function ProductShot() {
  const [pos1, setPos1] = useState<number[]>(CURSOR_1[0]);
  const [pos2, setPos2] = useState<number[]>(CURSOR_2[0]);

  useEffect(() => {
    const timer = setInterval(() => {
      setPos1((p) => {
        const i = (CURSOR_1.findIndex((c) => c[0] === p[0] && c[1] === p[1]) + 1) % CURSOR_1.length;
        return CURSOR_1[i];
      });
      setPos2((p) => {
        const i = (CURSOR_2.findIndex((c) => c[0] === p[0] && c[1] === p[1]) + 1) % CURSOR_2.length;
        return CURSOR_2[i];
      });
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div
      className="rounded-xl overflow-hidden font-mono"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        boxShadow: '0 32px 64px -16px rgba(0,0,0,0.5), 0 0 60px -20px rgba(59,130,246,0.08)',
      }}
    >
      {/* Window chrome */}
      <div style={{ borderBottom: `1px solid ${C.border}`, background: C.bg2, display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 16px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[C.red, C.amber, C.green].map((color, i) => (
            <span key={i} style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, opacity: 0.7 }} />
          ))}
        </div>
        <span style={{ flex: 1, textAlign: 'center', fontSize: '11px', color: C.text3 }}>
          aether.app / platform-team / sprint-14
        </span>
        <div style={{ width: '52px' }} />
      </div>

      {/* Layout */}
      <div style={{ display: 'flex', minHeight: '480px' }}>
        {/* Sidebar */}
        <aside style={{ width: '180px', flexShrink: 0, borderRight: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', background: C.bg2 }}>
          {/* Brand */}
          <div style={{ padding: '12px', borderBottom: `1px solid ${C.border}` }}>
            <div style={{ fontSize: '12px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>[ Aether ]</div>
            <div style={{ fontSize: '10px', color: C.text3 }}>platform-team</div>
          </div>

          {/* User */}
          <div style={{ padding: '8px 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(59,130,246,0.2)', color: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>A</div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '11px', color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Ana García</div>
              <div style={{ fontSize: '10px', color: C.text3 }}>OWNER</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{ flex: 1, padding: '8px' }}>
            {/* Section label */}
            <div style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 8px 6px', fontWeight: 500 }}>Workspaces</div>
            {[
              { name: 'Platform', color: '#3b82f6', active: true },
              { name: 'Mobile App', color: '#a855f7', active: false },
              { name: 'Marketing', color: '#10b981', active: false },
            ].map((ws) => (
              <div key={ws.name} style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 8px', borderRadius: '6px', marginBottom: '2px',
                background: ws.active ? `rgba(59,130,246,0.12)` : 'transparent',
                border: ws.active ? `1px solid rgba(59,130,246,0.28)` : '1px solid transparent',
              }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: ws.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11.5px', color: ws.active ? C.accent : C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
              </div>
            ))}

            <div style={{ fontSize: '10px', color: C.text4, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '10px 8px 6px', fontWeight: 500 }}>Boards</div>
            {[
              { name: 'Sprint 14', active: true },
              { name: 'Roadmap Q3', active: false },
            ].map((b) => (
              <div key={b.name} style={{
                display: 'flex', alignItems: 'center', gap: '7px', padding: '5px 8px', borderRadius: '6px', marginBottom: '2px',
                background: b.active ? C.hover : 'transparent',
              }}>
                <svg viewBox="0 0 12 10" fill="none" width="11" height="9" style={{ flexShrink: 0 }}>
                  <rect x="0.5" y="0.5" width="3" height="9" rx="1" fill={b.active ? C.accent : C.text4} opacity={b.active ? 0.8 : 0.5} />
                  <rect x="4.5" y="2.5" width="3" height="7" rx="1" fill={b.active ? C.accent : C.text4} opacity={b.active ? 0.6 : 0.35} />
                  <rect x="8.5" y="1.5" width="3" height="8" rx="1" fill={b.active ? C.accent : C.text4} opacity={b.active ? 0.4 : 0.25} />
                </svg>
                <span style={{ fontSize: '11.5px', color: b.active ? C.text : C.text3 }}>{b.name}</span>
              </div>
            ))}
          </nav>
        </aside>

        {/* Board area */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', background: C.bg }}>
          {/* Board top bar */}
          <div style={{
            padding: '10px 16px', borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: C.bg2, flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: '10px', color: C.text3, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '2px' }}>
                platform / sprint-14
              </div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Sprint 14</div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Avatars */}
              <div style={{ display: 'flex' }}>
                {[{ init: 'AM', c: '#3b82f6' }, { init: 'RK', c: '#10b981' }, { init: 'JL', c: '#f59e0b' }, { init: 'SO', c: '#a855f7' }].map((av, i) => (
                  <div key={av.init} style={{
                    width: '20px', height: '20px', borderRadius: '5px', background: av.c,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '8px', fontWeight: 700, color: 'white', flexShrink: 0,
                    marginLeft: i > 0 ? '-4px' : 0, outline: `2px solid ${C.bg2}`,
                  }}>{av.init}</div>
                ))}
              </div>

              {/* View toggle */}
              <div style={{ display: 'flex', background: C.hover, border: `1px solid ${C.border2}`, borderRadius: '6px', overflow: 'hidden' }}>
                {[
                  { icon: (
                    <svg viewBox="0 0 12 10" fill="none" width="12" height="10">
                      <rect x="0" y="0" width="3.5" height="10" rx="1" fill="currentColor" opacity="0.9"/>
                      <rect x="4.5" y="0" width="3" height="10" rx="1" fill="currentColor" opacity="0.6"/>
                      <rect x="8.5" y="0" width="3.5" height="10" rx="1" fill="currentColor" opacity="0.4"/>
                    </svg>
                  ), active: true },
                  { icon: (
                    <svg viewBox="0 0 12 10" fill="none" width="12" height="10">
                      <rect x="0" y="0.5" width="12" height="2" rx="0.8" fill="currentColor" opacity="0.9"/>
                      <rect x="0" y="4" width="12" height="2" rx="0.8" fill="currentColor" opacity="0.6"/>
                      <rect x="0" y="7.5" width="8" height="2" rx="0.8" fill="currentColor" opacity="0.4"/>
                    </svg>
                  ), active: false },
                ].map((btn, i) => (
                  <button key={i} style={{
                    padding: '4px 8px', display: 'flex', alignItems: 'center',
                    background: btn.active ? C.border : 'transparent',
                    color: btn.active ? C.text : C.text4,
                    border: 'none', cursor: 'pointer',
                  }}>
                    {btn.icon}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Kanban columns */}
          <div style={{ padding: '14px 16px', display: 'flex', gap: '10px', overflow: 'hidden', flex: 1, position: 'relative' }}>
            {COLS.map((col) => <MockList key={col.name} {...col} />)}

            {/* Live cursor 1 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10,
              transform: `translate(${pos1[0]}px, ${pos1[1]}px)`,
              transition: 'transform 2.8s cubic-bezier(0.4,0.2,0.2,1)',
            }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M2 2L16 8L8 10L6 16L2 2Z" fill="#10b981" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span style={{ position: 'absolute', top: '14px', left: '10px', fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: '#10b981', color: 'white', whiteSpace: 'nowrap', fontWeight: 600 }}>Rafa</span>
            </div>

            {/* Live cursor 2 */}
            <div style={{
              position: 'absolute', top: 0, left: 0, pointerEvents: 'none', zIndex: 10,
              transform: `translate(${pos2[0]}px, ${pos2[1]}px)`,
              transition: 'transform 2.8s cubic-bezier(0.4,0.2,0.2,1)',
            }}>
              <svg width="13" height="13" viewBox="0 0 18 18" fill="none">
                <path d="M2 2L16 8L8 10L6 16L2 2Z" fill="#a855f7" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
              </svg>
              <span style={{ position: 'absolute', top: '14px', left: '10px', fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: '#a855f7', color: 'white', whiteSpace: 'nowrap', fontWeight: 600 }}>Sofi</span>
            </div>
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
