'use client';

import { motion, useMotionValue, useTransform, animate } from 'framer-motion';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useEffect, useState } from 'react';

const TERMINAL_LINES = [
  { prefix: '$', text: 'aether connect --workspace team-alpha', delay: 0.8 },
  { prefix: '>', text: 'Establishing secure channel...', delay: 1.4, muted: true },
  {
    prefix: '>',
    text: '3 users joined • latency 4ms • CRDT sync active',
    delay: 2.0,
    accent: true,
  },
  { prefix: '$', text: 'aether board --live', delay: 2.8 },
  {
    prefix: '>',
    text: 'Board synced. Events: 1,204 • Conflicts resolved: 0',
    delay: 3.4,
    muted: true,
  },
];

function TerminalLine({
  prefix,
  text,
  delay,
  muted,
  accent,
}: {
  prefix: string;
  text: string;
  delay: number;
  muted?: boolean;
  accent?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay }}
      className="flex items-start gap-1.5 sm:gap-2 font-mono text-[11px] xs:text-xs sm:text-sm leading-relaxed"
    >
      <span className="text-accent select-none shrink-0">{prefix}</span>
      <span
        className={`break-words ${accent ? 'text-accent' : muted ? 'text-text-muted' : 'text-text-primary'}`}
      >
        {text}
      </span>
    </motion.div>
  );
}

function BlinkingCursor() {
  return (
    <motion.span
      animate={{ opacity: [1, 0, 1] }}
      transition={{ duration: 0.8, repeat: Infinity, repeatType: 'loop' }}
      className="inline-block w-2 h-4 bg-accent align-middle ml-1"
    />
  );
}

export function HeroSection() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background: subtle scanline grid - HIDDEN ON MOBILE */}
      <div className="absolute inset-0 pointer-events-none hidden md:block">
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              0deg,
              transparent,
              transparent 2px,
              rgba(124, 58, 237, 0.8) 2px,
              rgba(124, 58, 237, 0.8) 3px
            )`,
            backgroundSize: '100% 4px',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `repeating-linear-gradient(
              90deg,
              transparent,
              transparent 40px,
              rgba(124, 58, 237, 0.5) 40px,
              rgba(124, 58, 237, 0.5) 41px
            )`,
          }}
        />
      </div>

      {/* Mobile gradient background */}
      <div className="absolute inset-0 bg-gradient-to-b from-accent/5 via-background to-background md:hidden" />

      {/* Ambient glow blobs - Different sizes per screen */}
      <div className="absolute top-20 -left-20 w-40 h-40 md:top-1/4 md:left-1/4 md:w-96 md:h-96 bg-accent/10 md:bg-accent/8 rounded-full blur-[60px] md:blur-[120px] pointer-events-none" />
      <div className="absolute bottom-40 -right-20 w-32 h-32 md:bottom-1/3 md:right-1/4 md:w-64 md:h-64 bg-purple-500/8 md:bg-purple-500/6 rounded-full blur-[50px] md:blur-[100px] pointer-events-none" />

      {/* MOBILE LAYOUT (< md) */}
      <div className="relative z-10 w-full px-4 py-8 md:hidden">
        <div className="flex flex-col items-center text-center gap-6">
          {/* MOBILE: Compact status badge */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[10px] font-mono font-semibold">
              <span className="relative flex h-1 w-1">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75" />
                <span className="relative inline-flex rounded-full h-1 w-1 bg-accent" />
              </span>
              LIVE
            </span>
          </motion.div>

          {/* MOBILE: Large bold title */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="space-y-3"
          >
            <h1 className="text-6xl font-black tracking-tighter leading-[0.9]">
              <span className="bg-gradient-to-br from-white via-accent-foreground to-accent bg-clip-text text-transparent">
                AETHER
              </span>
            </h1>
            <p className="text-accent text-sm font-bold tracking-wide">Colabora en Tiempo Real</p>
          </motion.div>

          {/* MOBILE: Simple value prop */}
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-text-secondary text-sm leading-relaxed max-w-sm"
          >
            Workspaces, boards y documentos que se sincronizan al instante con tu equipo.
          </motion.p>

          {/* MOBILE: Stacked CTAs - Simple design */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
            className="flex flex-col gap-3 w-full max-w-xs"
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="w-full py-4 bg-accent text-white font-semibold text-center rounded-lg shadow-lg active:scale-95 transition-transform"
              >
                Ir al Dashboard
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="w-full py-4 bg-accent text-white font-semibold text-center rounded-lg shadow-lg active:scale-95 transition-transform"
                >
                  Crear Cuenta Gratis
                </Link>
                <Link
                  href="/login"
                  className="w-full py-4 bg-surface/50 border border-border text-text-primary font-medium text-center rounded-lg active:scale-95 transition-transform backdrop-blur-sm"
                >
                  Iniciar Sesión
                </Link>
              </>
            )}
          </motion.div>

          {/* MOBILE: Feature highlights - Simple icons */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, delay: 0.4 }}
            className="flex items-center justify-center gap-6 text-text-muted text-xs mt-2"
          >
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Real-time</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Sin lag</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-accent" />
              <span>Seguro</span>
            </div>
          </motion.div>
        </div>
      </div>

      {/* DESKTOP LAYOUT (>= md) */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-6 lg:px-8 py-20 hidden md:block">
        <div className="flex flex-col items-center text-center gap-8">
          {/* Desktop: Status pill */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-accent/25 bg-accent/5 text-accent text-xs font-mono tracking-widest uppercase">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-60" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-accent" />
              </span>
              v1.0 · Sistema Operacional
            </span>
          </motion.div>

          {/* Desktop: Main heading */}
          <div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-7xl lg:text-8xl xl:text-9xl font-bold tracking-tight leading-none"
            >
              <span className="bg-gradient-to-br from-white via-white to-white/40 bg-clip-text text-transparent">
                AETHER
              </span>
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.25 }}
              className="mt-4 text-base lg:text-lg text-text-muted font-mono tracking-[0.2em] uppercase"
            >
              Colaboración en Tiempo Real
            </motion.p>
          </div>

          {/* Desktop: Value proposition */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="max-w-xl text-text-secondary text-lg leading-relaxed"
          >
            Tu equipo, sincronizado al instante. Boards, documentos y presencia en vivo — todo
            convergiendo sin conflictos.
          </motion.p>

          {/* Desktop: CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex items-center gap-3"
          >
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="group inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-mono text-sm rounded border border-accent hover:bg-accent/90 transition-all duration-200 shadow-[0_0_20px_rgba(124,58,237,0.25)] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
              >
                <span className="text-white/60 select-none">$</span>
                aether open --dashboard
                <span className="text-white/60 group-hover:translate-x-1 transition-transform">
                  →
                </span>
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="group inline-flex items-center gap-2 px-6 py-3 bg-accent text-white font-mono text-sm rounded border border-accent hover:bg-accent/90 transition-all duration-200 shadow-[0_0_20px_rgba(124,58,237,0.25)] hover:shadow-[0_0_30px_rgba(124,58,237,0.4)]"
                >
                  <span className="text-white/60 select-none">$</span>
                  aether init --new-workspace
                  <span className="text-white/60 group-hover:translate-x-1 transition-transform">
                    →
                  </span>
                </Link>
                <Link
                  href="/login"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-transparent text-text-secondary font-mono text-sm rounded border border-border hover:border-accent/50 hover:text-accent transition-all duration-200"
                >
                  <span className="text-text-muted select-none">$</span>
                  aether login
                </Link>
              </>
            )}
          </motion.div>

          {/* Desktop: Terminal block */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="w-full max-w-2xl"
          >
            <div className="rounded-lg border border-border bg-surface/60 backdrop-blur-sm overflow-hidden shadow-[0_0_40px_rgba(0,0,0,0.5)]">
              {/* Terminal titlebar */}
              <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-card/50">
                <span className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-green-500/70" />
                <span className="ml-3 text-xs font-mono text-text-muted tracking-wide">
                  aether — zsh
                </span>
              </div>

              {/* Terminal body */}
              <div className="px-5 py-4 space-y-1.5 min-h-[140px]">
                {TERMINAL_LINES.map((line, i) => (
                  <TerminalLine key={i} {...line} />
                ))}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 4.0 }}
                  className="flex items-center font-mono text-sm text-text-muted mt-2"
                >
                  <span className="text-accent mr-2">$</span>
                  <BlinkingCursor />
                </motion.div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
