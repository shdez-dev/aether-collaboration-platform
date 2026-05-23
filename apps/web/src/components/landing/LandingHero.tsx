'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

/* ── Partículas de fondo ─────────────────────────────────────────── */
const PARTICLES = Array.from({ length: 18 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() > 0.6 ? 2 : 1.5,
  color: Math.random() > 0.5 ? '#38b6ff' : '#00e5cc',
}));

/* ── Nodos de la red ─────────────────────────────────────────────── */
const NODES = [
  { cx: 160, cy: 60,  r: 5,   color: '#38b6ff', cls: 'node-a' },
  { cx: 280, cy: 130, r: 7,   color: '#00e5cc', cls: 'node-b' },
  { cx: 100, cy: 190, r: 4,   color: '#38b6ff', cls: 'node-c' },
  { cx: 240, cy: 240, r: 5,   color: '#38b6ff', cls: 'node-d' },
  { cx: 350, cy: 80,  r: 4,   color: '#00e5cc', cls: 'node-e' },
  { cx: 60,  cy: 110, r: 3.5, color: 'rgba(56,182,255,0.5)', cls: 'node-f' },
  { cx: 310, cy: 200, r: 3.5, color: 'rgba(0,229,204,0.5)',  cls: 'node-g' },
];

const EDGES = [
  [0, 1], [1, 2], [1, 3], [0, 4], [4, 1],
  [2, 5], [3, 6], [1, 6],
];

/* ── Componente principal ────────────────────────────────────────── */
export function LandingHero() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();
  const containerRef = useRef<HTMLElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      // Partículas — movimiento browniano
      const dots = particlesRef.current?.querySelectorAll('.hero-particle');
      dots?.forEach((dot) => {
        const animate = () => {
          gsap.to(dot, {
            x: (Math.random() - 0.5) * 80,
            y: (Math.random() - 0.5) * 80,
            duration: 4 + Math.random() * 5,
            ease: 'power1.inOut',
            onComplete: animate,
          });
        };
        gsap.set(dot, { x: 0, y: 0 });
        gsap.delayedCall(Math.random() * 2, animate);
      });

      // Hero entrance
      const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
      tl.fromTo('.hero-tagline',        { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1);
      tl.fromTo('.hero-headline-line',  { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.15 }, 0.25);
      tl.fromTo('.hero-sub',            { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55);
      tl.fromTo('.hero-btns',           { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, 0.7);
      tl.fromTo('.hero-visual',         { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.65 }, 0.3);

      // Nodos — pulso suave individual
      NODES.forEach(({ cls }, i) => {
        gsap.to(`.${cls}`, {
          scale: 1.35,
          duration: 1.8 + i * 0.2,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: -1,
          delay: i * 0.3,
          transformOrigin: 'center center',
        });
      });

      // Líneas — opacidad pulsante
      gsap.to('.hero-edge', {
        opacity: 0.12,
        duration: 2.4,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        stagger: { each: 0.4, from: 'random' },
      });
    },
    { scope: containerRef }
  );

  return (
    <section
      ref={containerRef}
      style={{
        position: 'relative',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        overflow: 'hidden',
        background: '#080c14',
        padding: '80px 0',
      }}
    >
      {/* Partículas */}
      <div
        ref={particlesRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      >
        {PARTICLES.map((p) => (
          <div
            key={p.id}
            className="hero-particle"
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: `${p.size}px`,
              height: `${p.size}px`,
              borderRadius: '50%',
              background: p.color,
              opacity: 0.25,
            }}
          />
        ))}
      </div>

      {/* Glow ambiente */}
      <div
        style={{
          position: 'absolute',
          top: '20%',
          left: '-10%',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(56,182,255,0.06) 0%, transparent 65%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      {/* Contenido */}
      <div
        style={{
          position: 'relative',
          zIndex: 10,
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
          width: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '80px',
          alignItems: 'center',
        }}
      >
        {/* ── Columna izquierda ─────────────────────────────────── */}
        <div>
          <div
            className="hero-tagline"
            style={{
              opacity: 0,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#00e5cc',
              marginBottom: '28px',
            }}
          >
            {t.landing_hero_tagline}
          </div>

          <h1
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontWeight: 300,
              fontSize: 'clamp(40px, 5.5vw, 72px)',
              lineHeight: 1.1,
              letterSpacing: '-0.03em',
              color: '#f0f6ff',
              marginBottom: '24px',
            }}
          >
            <span className="hero-headline-line" style={{ display: 'block', opacity: 0 }}>
              {t.landing_hero_h1_word}{' '}
              <span
                style={{
                  background: 'linear-gradient(90deg, #38b6ff 0%, #00e5cc 100%)',
                  WebkitBackgroundClip: 'text',
                  backgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontWeight: 400,
                }}
              >
                {t.landing_hero_h1_highlight}
              </span>
            </span>
            <span className="hero-headline-line" style={{ display: 'block', opacity: 0 }}>
              {t.landing_hero_h1_line2}
            </span>
          </h1>

          <p
            className="hero-sub"
            style={{
              opacity: 0,
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontSize: 'clamp(15px, 1.6vw, 17px)',
              fontWeight: 300,
              lineHeight: 1.7,
              color: 'rgba(180, 210, 255, 0.65)',
              maxWidth: '440px',
              marginBottom: '40px',
            }}
          >
            {t.landing_hero_description}
          </p>

          <div
            className="hero-btns"
            style={{
              opacity: 0,
              display: 'flex',
              gap: '12px',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {isAuthenticated ? (
              <Link href="/dashboard" className="landing-btn-primary">
                {t.landing_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link href="/register" className="landing-btn-primary">
                  {t.landing_hero_cta_start}
                </Link>
                <Link href="/login" className="landing-btn-secondary">
                  {t.landing_hero_cta_login}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Columna derecha: red de nodos ────────────────────── */}
        <div
          className="hero-visual"
          style={{
            opacity: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg
            viewBox="0 0 420 300"
            width="100%"
            style={{ maxWidth: '420px', overflow: 'visible' }}
            aria-hidden
          >
            {/* Edges */}
            {EDGES.map(([a, b], i) => (
              <line
                key={i}
                className="hero-edge"
                x1={NODES[a].cx} y1={NODES[a].cy}
                x2={NODES[b].cx} y2={NODES[b].cy}
                stroke="#38b6ff"
                strokeWidth="1"
                opacity="0.25"
              />
            ))}

            {/* Nodes: glow ring (círculo exterior semitransparente) + punto central */}
            {NODES.map((n) => (
              <g key={n.cls} className={n.cls}>
                <circle cx={n.cx} cy={n.cy} r={n.r * 3.5} fill={n.color} opacity="0.08" />
                <circle cx={n.cx} cy={n.cy} r={n.r * 2}   fill={n.color} opacity="0.18" />
                <circle cx={n.cx} cy={n.cy} r={n.r}        fill={n.color} />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
