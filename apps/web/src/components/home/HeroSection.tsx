'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

const NODES = [
  { cx: 110, cy: 28, delay: 0 },
  { cx: 196, cy: 158, delay: 0.2 },
  { cx: 24, cy: 158, delay: 0.4 },
];

function CollabVisual() {
  return (
    <svg width="220" height="188" viewBox="0 0 220 188" fill="none" className="mx-auto">
      <motion.path
        d="M 110 28 L 196 158"
        stroke="rgba(124,58,237,0.28)"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.6 }}
      />
      <motion.path
        d="M 196 158 L 24 158"
        stroke="rgba(124,58,237,0.28)"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 0.95 }}
      />
      <motion.path
        d="M 24 158 L 110 28"
        stroke="rgba(124,58,237,0.28)"
        strokeWidth="1"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.9, delay: 1.3 }}
      />
      {NODES.map((node, i) => (
        <motion.g
          key={i}
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4, delay: node.delay, type: 'spring' }}
        >
          <motion.circle
            cx={node.cx}
            cy={node.cy}
            r="16"
            fill="none"
            stroke="rgba(124,58,237,0.15)"
            strokeWidth="1"
            animate={{ r: [16, 28, 16], opacity: [0.15, 0, 0.15] }}
            transition={{
              duration: 3.2,
              delay: node.delay + 2,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
          <circle
            cx={node.cx}
            cy={node.cy}
            r="13"
            fill="rgba(124,58,237,0.07)"
            stroke="rgba(124,58,237,0.3)"
            strokeWidth="1"
          />
          <circle cx={node.cx} cy={node.cy} r="3.5" fill="rgba(124,58,237,0.85)" />
        </motion.g>
      ))}
    </svg>
  );
}

export function HeroSection() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Language switcher — top right */}
      <div className="absolute top-5 right-5 z-20">
        <LanguageSwitcher variant="floating" />
      </div>

      {/* Ambient glows */}
      <div className="home-glow-primary absolute top-1/4 left-1/4 w-96 h-96 bg-accent/8 rounded-full blur-[140px] pointer-events-none" />
      <div className="home-glow-secondary absolute bottom-1/3 right-1/4 w-64 h-64 bg-purple-500/8 rounded-full blur-[100px] pointer-events-none" />

      {/* MOBILE */}
      <div className="relative z-10 w-full px-6 py-16 md:hidden">
        <div className="flex flex-col items-center text-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-6xl font-black tracking-tighter leading-none">
              <span className="home-aether-text">AETHER</span>
            </h1>
            <p className="mt-3 text-accent text-sm font-medium tracking-wide">
              {t.home_hero_tagline}
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.15 }}
            className="text-text-secondary text-sm leading-relaxed max-w-sm"
          >
            {t.home_hero_description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.25 }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="w-full py-4 bg-accent text-white font-semibold text-center rounded-lg active:scale-95 transition-transform"
              >
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full py-4 bg-accent text-white font-semibold text-center rounded-lg active:scale-95 transition-transform"
                >
                  {t.home_hero_cta_start}
                </Link>
                <Link
                  href="/login"
                  className="w-full py-4 bg-background border border-border text-text-primary font-medium text-center rounded-lg active:scale-95 transition-transform"
                >
                  {t.home_hero_cta_login}
                </Link>
              </>
            )}
          </motion.div>
        </div>
      </div>

      {/* DESKTOP */}
      <div className="relative z-10 w-full max-w-4xl mx-auto px-8 py-24 hidden md:block">
        <div className="flex flex-col items-center text-center gap-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h1 className="text-8xl xl:text-9xl font-bold tracking-tight leading-none">
              <span className="home-aether-text">AETHER</span>
            </h1>
            <p className="mt-5 text-text-secondary font-light text-lg tracking-[0.18em] uppercase">
              {t.home_hero_tagline}
            </p>
          </motion.div>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="max-w-lg text-text-secondary text-lg leading-relaxed"
          >
            {t.home_hero_description}
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex items-center gap-4"
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="px-8 py-3.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors shadow-[0_0_20px_rgba(124,58,237,0.3)]"
              >
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-8 py-3.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors shadow-[0_0_20px_rgba(124,58,237,0.3)]"
                >
                  {t.home_hero_cta_start}
                </Link>
                <Link
                  href="/login"
                  className="px-8 py-3.5 text-text-primary border border-border rounded-lg hover:border-accent/50 hover:text-accent transition-all"
                >
                  {t.home_hero_cta_login}
                </Link>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.55 }}
            className="mt-4"
          >
            <CollabVisual />
          </motion.div>
        </div>
      </div>
    </section>
  );
}
