'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

// ── Metrics strip ─────────────────────────────────────────────────────────────

function MetricsStrip() {
  const t = useT();
  const metrics = [
    { value: '38', unit: 'ms', label: t.home_metrics_sync },
    { value: '99.99', unit: '%', label: t.home_metrics_uptime },
    { value: '140', unit: '+', label: t.home_metrics_shortcuts },
    { value: '0', unit: '', label: t.home_metrics_deps },
  ];

  return (
    <div
      className="grid grid-cols-2 md:grid-cols-4"
      style={{
        borderTop: '1px solid rgba(255,255,255,0.06)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      {metrics.map((m, i) => (
        <div
          key={m.label}
          className="px-6 py-8"
          style={{
            borderRight: i < metrics.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
          }}
        >
          <div
            className="font-bold font-sans mb-1.5"
            style={{ fontSize: '36px', letterSpacing: '-0.02em', color: 'rgba(255,255,255,0.9)', fontVariantNumeric: 'tabular-nums' }}
          >
            {m.value}
            <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.3)' }}>{m.unit}</span>
          </div>
          <p className="font-mono text-[11px] uppercase tracking-[0.05em]" style={{ color: 'rgba(255,255,255,0.3)' }}>
            {m.label}
          </p>
        </div>
      ))}
    </div>
  );
}

// ── Activity feed section ─────────────────────────────────────────────────────

const FEED_ROWS = [
  { ts: '14:32', who: 'ana', action: 'movió', obj: 'AET-240', tail: 'a In Review' },
  { ts: '14:31', who: 'rafa', action: 'comentó en', obj: 'AET-237', tail: '' },
  { ts: '14:29', who: 'sofi', action: 'publicó RFC', obj: 'AET-231', tail: '' },
  { ts: '14:27', who: 'ci-bot', action: 'cerró', obj: 'AET-226', tail: 'vía deploy' },
  { ts: '14:24', who: 'jl', action: 'asignó', obj: 'AET-233', tail: 'a rafa' },
  { ts: '14:20', who: 'ana', action: 'editó', obj: 'doc/arquitectura', tail: '' },
];

function ActivitySection() {
  const t = useT();

  return (
    <section className="py-16 px-4 md:px-8" id="activity">
      <div className="max-w-[1240px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          {/* Feed mock */}
          <motion.div
            initial={{ opacity: 0, x: -16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55 }}
            className="rounded-xl overflow-hidden"
            style={{ background: 'hsl(0 0% 13%)', border: '1px solid rgba(255,255,255,0.14)' }}
          >
            <div
              className="flex items-center justify-between px-5 py-3.5 font-mono text-[11px] uppercase tracking-[0.05em]"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.08)',
                background: 'hsl(0 0% 10%)',
                color: 'rgba(255,255,255,0.4)',
              }}
            >
              <span>ACTIVIDAD · platform-team</span>
              <span style={{ color: '#22c55e' }}>EN VIVO ●</span>
            </div>
            {FEED_ROWS.map((row, i) => (
              <div
                key={i}
                className="flex gap-3.5 items-start px-5 py-3 text-[13px]"
                style={{
                  borderBottom: i < FEED_ROWS.length - 1 ? '1px solid rgba(255,255,255,0.06)' : undefined,
                }}
              >
                <span className="font-mono text-[11px] pt-0.5 min-w-[42px]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                  {row.ts}
                </span>
                <div style={{ color: 'rgba(255,255,255,0.55)' }}>
                  <span className="font-semibold" style={{ color: 'rgba(255,255,255,0.88)' }}>{row.who}</span>
                  {' '}{row.action}{' '}
                  <span
                    className="font-mono text-[12px] px-1.5 py-0.5 rounded"
                    style={{ color: '#93c5fd', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.2)' }}
                  >
                    {row.obj}
                  </span>
                  {row.tail && <> {row.tail}</>}
                </div>
              </div>
            ))}
          </motion.div>

          {/* Text */}
          <motion.div
            initial={{ opacity: 0, x: 16 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <div
              className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] mb-4"
              style={{ color: '#3b82f6' }}
            >
              <span className="w-5 h-px" style={{ background: '#3b82f6', opacity: 0.6 }} />
              {t.home_activity_label}
            </div>
            <h2
              className="font-bold leading-[1.08] mb-5 max-w-[540px]"
              style={{ fontSize: 'clamp(28px, 3.5vw, 44px)', letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.95)' }}
            >
              {t.home_activity_title}
            </h2>
            <p className="text-[17px] leading-relaxed" style={{ color: 'rgba(255,255,255,0.48)', maxWidth: '480px' }}>
              {t.home_activity_sub}
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

// ── CTA box ───────────────────────────────────────────────────────────────────

function CtaBox() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  return (
    <section className="py-20 px-4 md:px-8" id="signup">
      <div className="max-w-[1240px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.55 }}
          className="relative text-center rounded-2xl overflow-hidden px-12 py-16"
          style={{
            background: 'radial-gradient(ellipse 80% 70% at 50% 0%, rgba(59,130,246,0.22), transparent 70%), hsl(0 0% 11%)',
            border: '1px solid rgba(59,130,246,0.25)',
          }}
        >
          {/* Top glow line */}
          <span
            className="absolute top-0 left-1/2 -translate-x-1/2 h-px"
            style={{ width: '280px', background: 'linear-gradient(90deg, transparent, rgba(59,130,246,0.9), transparent)' }}
          />
          <h2
            className="font-bold mb-3.5 mx-auto"
            style={{
              fontSize: 'clamp(26px, 3.5vw, 42px)',
              letterSpacing: '-0.025em',
              color: 'rgba(255,255,255,0.95)',
              maxWidth: '680px',
            }}
          >
            {t.home_cta_title}
          </h2>
          <p className="text-[17px] mb-7 mx-auto" style={{ color: 'rgba(255,255,255,0.48)', maxWidth: '460px' }}>
            {t.home_cta_sub}
          </p>
          <div className="flex items-center justify-center gap-2.5 flex-wrap">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center font-medium text-white text-[15px] px-5 py-3 rounded-[10px] transition-all hover:-translate-y-px"
                style={{
                  background: '#3b82f6',
                  boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 10px 28px -6px rgba(59,130,246,0.7)',
                }}
              >
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="inline-flex items-center font-medium text-white text-[15px] px-5 py-3 rounded-[10px] transition-all hover:-translate-y-px"
                  style={{
                    background: '#3b82f6',
                    boxShadow: '0 1px 0 rgba(255,255,255,0.2) inset, 0 10px 28px -6px rgba(59,130,246,0.7)',
                  }}
                >
                  {t.home_cta_primary}
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center text-[15px] font-medium px-5 py-3 rounded-[10px] transition-all"
                  style={{
                    color: 'rgba(255,255,255,0.8)',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.12)',
                  }}
                >
                  {t.home_cta_secondary}
                </Link>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ── Export ────────────────────────────────────────────────────────────────────

export function ShowcaseSection() {
  return (
    <>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8">
        <MetricsStrip />
      </div>
      <ActivitySection />
      <CtaBox />
    </>
  );
}
