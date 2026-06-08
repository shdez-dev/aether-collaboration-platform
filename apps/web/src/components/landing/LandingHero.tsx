'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

/* ── Network ─────────────────────────────────────────────────────────────
   Topology: outer ring of 8 nodes + 2 inner satellites + 1 center.
   Max 4 connections per node — no single hub dominates.
   ──────────────────────────────────────────────────────────────────────── */

const NODES = [
  // Outer ring (8 nodes — loose, organic, not a perfect circle)
  { id: 0, cx: 90,  cy: 78,  r: 4,   color: '#00e5cc' },
  { id: 1, cx: 268, cy: 50,  r: 5,   color: '#38b6ff' },
  { id: 2, cx: 432, cy: 84,  r: 4,   color: '#a78bfa' },
  { id: 3, cx: 466, cy: 208, r: 4.5, color: '#38b6ff' },
  { id: 4, cx: 406, cy: 318, r: 4,   color: '#00e5cc' },
  { id: 5, cx: 256, cy: 340, r: 5,   color: '#a78bfa' },
  { id: 6, cx: 102, cy: 314, r: 4,   color: '#38b6ff' },
  { id: 7, cx: 50,  cy: 200, r: 4,   color: '#00e5cc' },
  // Inner satellites
  { id: 8, cx: 170, cy: 168, r: 5.5, color: '#38b6ff' }, // inner-left
  { id: 9, cx: 350, cy: 164, r: 5.5, color: '#00e5cc' }, // inner-right
  // Center
  { id: 10, cx: 256, cy: 224, r: 7,  color: '#38b6ff' },
];

/*
  Edge layout (18 total, max 4 per node):
  – Outer ring connects adjacent nodes
  – Inner-left (8) reaches into the left arc of the ring
  – Inner-right (9) reaches into the right arc
  – Center (10) bridges top, bottom and both satellites
*/
const EDGES: [number, number][] = [
  // Outer ring
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0],
  // Inner-left (8) → left section of ring
  [8, 0], [8, 7], [8, 6],
  // Inner-right (9) → right section of ring
  [9, 2], [9, 3], [9, 4],
  // Center (10) → bridges
  [10, 8], [10, 9], [10, 1], [10, 5],
];

/* ── Adjacency ───────────────────────────────────────────────────────── */

function buildAdj() {
  const m = new Map<number, number[]>();
  NODES.forEach(n => m.set(n.id, []));
  EDGES.forEach(([a, b]) => { m.get(a)!.push(b); m.get(b)!.push(a); });
  return m;
}
const ADJ = buildAdj();

/* ── Particles (sparse, deterministic) ──────────────────────────────── */

const PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  id: i,
  x: ((i * 43 + 11) % 88) + 5,
  y: ((i * 59 + 27) % 86) + 6,
  size: i % 5 === 0 ? 2.2 : 1.4,
  color: (['#38b6ff', '#00e5cc', '#a78bfa'] as const)[i % 3],
  opacity: 0.1 + (i % 4) * 0.025,
}));

const NUM_PACKETS = 4;
const PACKET_COLORS: string[] = ['#38b6ff', '#00e5cc', '#a78bfa', '#38b6ff'];

/* ── Component ───────────────────────────────────────────────────────── */

export function LandingHero() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  const containerRef = useRef<HTMLElement>(null);
  const particlesRef = useRef<HTMLDivElement>(null);
  const svgRef       = useRef<SVGSVGElement>(null);
  const nodeRefs     = useRef<(SVGGElement | null)[]>(new Array(NODES.length).fill(null));
  const edgeRefs     = useRef<(SVGLineElement | null)[]>(new Array(EDGES.length).fill(null));
  const packetRefs   = useRef<(SVGGElement | null)[]>(new Array(NUM_PACKETS).fill(null));
  const vpos         = useRef(NODES.map(n => ({ x: n.cx, y: n.cy })));
  const lastVisited  = useRef<number[]>(new Array(NUM_PACKETS).fill(-1));

  useGSAP(() => {
    const pos  = vpos.current;
    const last = lastVisited.current;

    /* ── 1. Gentle drift per node ──────────────────────────────
       Outer ring nodes: ±5 px. Inner/center: ±9 px.
       Very slow — 7–13 s per half-cycle.
    ─────────────────────────────────────────────────────────── */
    NODES.forEach((n, i) => {
      const amp = i < 8 ? 5 : 9;
      const dur = 7 + (i % 6) * 1.1;
      const tx  = n.cx + (((i * 3 + 1) % 7) - 3) * (amp / 3.5);
      const ty  = n.cy + (((i * 5 + 2) % 7) - 3) * (amp / 3.5);
      gsap.to(pos[i], {
        x: tx, y: ty,
        duration: dur,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: i * 0.6,
      });
    });

    /* ── 2. Ticker: keep edges + node positions in sync ─────── */
    const tick = () => {
      NODES.forEach((n, i) => {
        const el = nodeRefs.current[i];
        if (!el) return;
        el.style.transform = `translate(${pos[i].x - n.cx}px,${pos[i].y - n.cy}px)`;
      });
      EDGES.forEach(([a, b], i) => {
        const el = edgeRefs.current[i];
        if (!el) return;
        el.setAttribute('x1', String(pos[a].x));
        el.setAttribute('y1', String(pos[a].y));
        el.setAttribute('x2', String(pos[b].x));
        el.setAttribute('y2', String(pos[b].y));
      });
    };
    gsap.ticker.add(tick);

    /* ── 3. Sonar rings — slow, periodic ────────────────────── */
    NODES.forEach((n, i) => {
      const el = nodeRefs.current[i];
      if (!el) return;
      const rings = el.querySelectorAll<SVGCircleElement>('.nring');

      const fire = () => {
        rings.forEach((ring, j) => {
          gsap.fromTo(ring,
            { attr: { r: n.r, opacity: 0.45 } },
            { attr: { r: n.r * 7, opacity: 0 }, duration: 3.2, ease: 'power1.out', delay: j * 0.65 }
          );
        });
        // Fire next ring 6–11 s later, staggered per node
        gsap.delayedCall(6 + (i % 7) * 0.8, fire);
      };
      gsap.delayedCall(1.2 + i * 0.75, fire);
    });

    /* ── 4. Data packets — unhurried, no backtracking ────────── */
    const travel = (pIdx: number, fromId: number) => {
      const neighbors = ADJ.get(fromId) ?? [];
      // Avoid going straight back
      const pool = neighbors.filter(id => id !== last[pIdx]);
      const candidates = pool.length > 0 ? pool : neighbors;
      const toId = candidates[(pIdx * 3 + fromId) % candidates.length];
      last[pIdx] = fromId;

      const pEl = packetRefs.current[pIdx];
      if (!pEl) return;

      const src  = pos[fromId];
      const dst  = pos[toId];
      const dist = Math.sqrt((dst.x - src.x) ** 2 + (dst.y - src.y) ** 2);
      // ~2–4 s per edge depending on length
      const dur  = Math.max(1.1, dist / 105);

      // Find and illuminate the traversed edge
      const eIdx = EDGES.findIndex(([a, b]) =>
        (a === fromId && b === toId) || (a === toId && b === fromId)
      );
      const eEl = eIdx >= 0 ? edgeRefs.current[eIdx] : null;
      if (eEl) {
        gsap.to(eEl, { attr: { opacity: 0.65, 'stroke-width': 1.8 }, duration: 0.25, overwrite: 'auto' });
      }

      gsap.set(pEl, { x: src.x, y: src.y, opacity: 1, scale: 1 });
      gsap.to(pEl, {
        x: dst.x, y: dst.y,
        duration: dur,
        ease: 'power1.inOut',
        onComplete() {
          // Dim edge back — let it breathe for a moment before fading
          if (eEl) {
            gsap.to(eEl, { attr: { opacity: 0.18, 'stroke-width': 1 }, duration: 1.2, delay: 0.15, overwrite: 'auto' });
          }
          // Brief arrival pulse on destination
          const destEl = nodeRefs.current[toId];
          if (destEl) {
            const rings = destEl.querySelectorAll<SVGCircleElement>('.nring');
            rings.forEach((ring, j) => {
              gsap.fromTo(ring,
                { attr: { r: NODES[toId].r, opacity: 0.6 } },
                { attr: { r: NODES[toId].r * 5, opacity: 0 }, duration: 0.9, ease: 'power2.out', delay: j * 0.3 }
              );
            });
          }
          // Pause at destination before moving on
          const pause = 0.55 + (pIdx % 4) * 0.15;
          gsap.delayedCall(pause, () => travel(pIdx, toId));
        },
      });
    };

    // Start packets at spread-out origin nodes, well staggered
    const origins = [1, 4, 7, 10];
    for (let i = 0; i < NUM_PACKETS; i++) {
      gsap.delayedCall(0.8 + i * 1.1, () => travel(i, origins[i]));
    }

    /* ── 5. Ambient edge breathing (very subtle) ─────────────── */
    gsap.to(edgeRefs.current.filter(Boolean), {
      attr: { opacity: 0.24 },
      duration: 5.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.35, from: 'random' },
    });

    /* ── 6. Particles — slow, lazy drift ────────────────────── */
    const dots = particlesRef.current?.querySelectorAll('.hero-particle');
    dots?.forEach((dot, i) => {
      const drift = () => {
        gsap.to(dot, {
          x: (((i * 47) % 70) - 35),
          y: (((i * 37) % 60) - 30),
          duration: 9 + (i % 5) * 2.5,
          ease: 'sine.inOut',
          yoyo: true,
          repeat: 1,
          onComplete: drift,
        });
      };
      gsap.delayedCall(i * 0.25, drift);
    });

    /* ── 7. Mouse parallax (subtle depth) ───────────────────── */
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !svgRef.current) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(svgRef.current, { x: nx * 16, y: ny * 9, duration: 2.2, ease: 'power2.out' });
    };
    containerRef.current?.addEventListener('mousemove', onMove);

    /* ── 8. Entrance ─────────────────────────────────────────── */
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.hero-tagline',       { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1);
    tl.fromTo('.hero-headline-line', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.15 }, 0.25);
    tl.fromTo('.hero-sub',           { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55);
    tl.fromTo('.hero-btns',          { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, 0.7);
    tl.fromTo('.hero-visual',        { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.85 }, 0.3);

    // Edges and nodes fade/scale in with a calm stagger
    gsap.fromTo(
      edgeRefs.current.filter(Boolean),
      { attr: { opacity: 0 } },
      { attr: { opacity: 0.18 }, duration: 1.4, stagger: { each: 0.07, from: 'random' }, delay: 0.6 }
    );
    gsap.fromTo(
      nodeRefs.current.filter(Boolean),
      { scale: 0, transformOrigin: '50% 50%' },
      { scale: 1, duration: 0.55, ease: 'back.out(1.7)', stagger: { each: 0.08, from: 'edges' }, delay: 0.7 }
    );

    return () => {
      gsap.ticker.remove(tick);
      containerRef.current?.removeEventListener('mousemove', onMove);
    };
  }, { scope: containerRef });

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
      {/* Sparse background particles */}
      <div
        ref={particlesRef}
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}
      >
        {PARTICLES.map(p => (
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
              opacity: p.opacity,
            }}
          />
        ))}
      </div>

      {/* Ambient glows */}
      <div style={{
        position: 'absolute', top: '12%', left: '-10%',
        width: '680px', height: '680px',
        background: 'radial-gradient(circle, rgba(56,182,255,0.048) 0%, transparent 65%)',
        filter: 'blur(48px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '8%', right: '-6%',
        width: '500px', height: '500px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.038) 0%, transparent 65%)',
        filter: 'blur(48px)', pointerEvents: 'none',
      }} />

      {/* Content */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: '1200px', margin: '0 auto',
        padding: '0 2rem', width: '100%',
        display: 'grid', gridTemplateColumns: '1fr 1fr',
        gap: '80px', alignItems: 'center',
      }}>

        {/* Left: copy */}
        <div>
          <div className="hero-tagline" style={{
            opacity: 0,
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px', fontWeight: 400,
            textTransform: 'uppercase', letterSpacing: '0.2em',
            color: '#00e5cc', marginBottom: '28px',
          }}>
            {t.landing_hero_tagline}
          </div>

          <h1 style={{
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            fontWeight: 300, fontSize: 'clamp(40px, 5.5vw, 72px)',
            lineHeight: 1.1, letterSpacing: '-0.03em',
            color: '#f0f6ff', marginBottom: '24px',
          }}>
            <span className="hero-headline-line" style={{ display: 'block', opacity: 0 }}>
              {t.landing_hero_h1_word}{' '}
              <span style={{
                background: 'linear-gradient(90deg, #38b6ff 0%, #00e5cc 100%)',
                WebkitBackgroundClip: 'text', backgroundClip: 'text',
                WebkitTextFillColor: 'transparent', fontWeight: 400,
              }}>
                {t.landing_hero_h1_highlight}
              </span>
            </span>
            <span className="hero-headline-line" style={{ display: 'block', opacity: 0 }}>
              {t.landing_hero_h1_line2}
            </span>
          </h1>

          <p className="hero-sub" style={{
            opacity: 0,
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            fontSize: 'clamp(15px, 1.6vw, 17px)', fontWeight: 300,
            lineHeight: 1.7, color: 'rgba(180,210,255,0.65)',
            maxWidth: '440px', marginBottom: '40px',
          }}>
            {t.landing_hero_description}
          </p>

          <div className="hero-btns" style={{ opacity: 0, display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
            {isAuthenticated ? (
              <Link href="/dashboard" className="landing-btn-primary">{t.landing_hero_cta_dashboard}</Link>
            ) : (
              <>
                <Link href="/register" className="landing-btn-primary">{t.landing_hero_cta_start}</Link>
                <Link href="/login"    className="landing-btn-secondary">{t.landing_hero_cta_login}</Link>
              </>
            )}
          </div>
        </div>

        {/* Right: network */}
        <div className="hero-visual" style={{ opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 520 390"
            width="100%"
            style={{ maxWidth: '520px', overflow: 'visible' }}
            aria-hidden
          >
            <defs>
              <filter id="hpglow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <filter id="hnglow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Edges */}
            {EDGES.map(([a, b], i) => (
              <line
                key={i}
                ref={el => { edgeRefs.current[i] = el; }}
                x1={NODES[a].cx} y1={NODES[a].cy}
                x2={NODES[b].cx} y2={NODES[b].cy}
                stroke={NODES[a].color}
                strokeWidth="1"
                opacity="0"
              />
            ))}

            {/* Nodes */}
            {NODES.map((n, i) => (
              <g key={n.id} ref={el => { nodeRefs.current[i] = el; }}>
                {/* Two sonar rings */}
                <circle className="nring" cx={n.cx} cy={n.cy} r={n.r} fill="none" stroke={n.color} strokeWidth="1.5" opacity="0" />
                <circle className="nring" cx={n.cx} cy={n.cy} r={n.r} fill="none" stroke={n.color} strokeWidth="1"   opacity="0" />
                {/* Layered halo */}
                <circle cx={n.cx} cy={n.cy} r={n.r * 5} fill={n.color} opacity="0.04" />
                <circle cx={n.cx} cy={n.cy} r={n.r * 2.8} fill={n.color} opacity="0.08" />
                <circle cx={n.cx} cy={n.cy} r={n.r * 1.7} fill={n.color} opacity="0.14" />
                {/* Core */}
                <circle cx={n.cx} cy={n.cy} r={n.r} fill={n.color} filter="url(#hnglow)" opacity="0.9" />
                {/* Bright center */}
                <circle cx={n.cx} cy={n.cy} r={n.r * 0.35} fill="#fff" opacity="0.7" />
              </g>
            ))}

            {/* Traveling packets */}
            {Array.from({ length: NUM_PACKETS }, (_, i) => (
              <g key={i} ref={el => { packetRefs.current[i] = el; }} style={{ opacity: 0 }}>
                <circle cx={0} cy={0} r={6.5} fill={PACKET_COLORS[i]} opacity="0.15" filter="url(#hpglow)" />
                <circle cx={0} cy={0} r={3.5} fill={PACKET_COLORS[i]} opacity="0.5"  />
                <circle cx={0} cy={0} r={2}   fill={PACKET_COLORS[i]} filter="url(#hpglow)" />
                <circle cx={0} cy={0} r={0.9} fill="#fff"             opacity="0.88" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
