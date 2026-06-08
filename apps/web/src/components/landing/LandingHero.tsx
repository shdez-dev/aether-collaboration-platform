'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

/* ── Network data ──────────────────────────────────────────────────────── */

const NODES = [
  { id: 0,  cx: 260, cy: 170, r: 9,   color: '#38b6ff' }, // central hub
  { id: 1,  cx: 88,  cy: 72,  r: 5.5, color: '#00e5cc' },
  { id: 2,  cx: 260, cy: 42,  r: 5,   color: '#38b6ff' },
  { id: 3,  cx: 428, cy: 72,  r: 4.5, color: '#a78bfa' },
  { id: 4,  cx: 476, cy: 195, r: 6,   color: '#38b6ff' },
  { id: 5,  cx: 404, cy: 312, r: 5,   color: '#00e5cc' },
  { id: 6,  cx: 260, cy: 330, r: 5.5, color: '#a78bfa' },
  { id: 7,  cx: 108, cy: 308, r: 4.5, color: '#38b6ff' },
  { id: 8,  cx: 48,  cy: 200, r: 4,   color: '#00e5cc' },
  { id: 9,  cx: 152, cy: 168, r: 5.5, color: '#38b6ff' },
  { id: 10, cx: 368, cy: 162, r: 5.5, color: '#00e5cc' },
  { id: 11, cx: 174, cy: 268, r: 4,   color: '#a78bfa' },
  { id: 12, cx: 358, cy: 264, r: 4.5, color: '#38b6ff' },
];

const EDGES: [number, number][] = [
  // Hub to inner satellites
  [0, 9], [0, 10], [0, 2], [0, 11], [0, 12], [0, 4], [0, 6],
  // Inner left to outer
  [9, 1], [9, 8], [9, 7], [9, 11],
  // Inner right to outer
  [10, 3], [10, 4], [10, 5], [10, 12],
  // Outer ring
  [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [8, 1],
  // Inner shortcuts
  [11, 6], [12, 5],
];

/* ── Adjacency list ────────────────────────────────────────────────────── */

function buildAdj(): Map<number, number[]> {
  const m = new Map<number, number[]>();
  NODES.forEach(n => m.set(n.id, []));
  EDGES.forEach(([a, b]) => { m.get(a)!.push(b); m.get(b)!.push(a); });
  return m;
}
const ADJ = buildAdj();

/* ── Background particles (deterministic for SSR safety) ──────────────── */

const PARTICLES = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  x: ((i * 37 + 11) % 90) + 4,
  y: ((i * 53 + 23) % 90) + 4,
  size: i % 3 === 0 ? 2.3 : 1.5,
  color: (['#38b6ff', '#00e5cc', '#a78bfa'] as const)[i % 3],
  opacity: 0.12 + (i % 5) * 0.04,
}));

const NUM_PACKETS = 7;
const PACKET_COLORS = ['#38b6ff', '#00e5cc', '#a78bfa', '#38b6ff', '#00e5cc', '#a78bfa', '#38b6ff'];

/* ── Component ─────────────────────────────────────────────────────────── */

export function LandingHero() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  const containerRef  = useRef<HTMLElement>(null);
  const particlesRef  = useRef<HTMLDivElement>(null);
  const svgRef        = useRef<SVGSVGElement>(null);
  const nodeRefs      = useRef<(SVGGElement | null)[]>(new Array(NODES.length).fill(null));
  const edgeRefs      = useRef<(SVGLineElement | null)[]>(new Array(EDGES.length).fill(null));
  const packetRefs    = useRef<(SVGGElement | null)[]>(new Array(NUM_PACKETS).fill(null));
  const vpos          = useRef(NODES.map(n => ({ x: n.cx, y: n.cy })));

  useGSAP(() => {
    const pos = vpos.current;

    /* ─ 1. Node drift ───────────────────────────────────────────── */
    NODES.forEach((n, i) => {
      const amp = 7 + (i % 4) * 2.5;
      const dur = 5.5 + (i % 5) * 1.2;
      const tx  = n.cx + ((i % 7) - 3) * (amp / 3);
      const ty  = n.cy + ((i % 5) - 2) * (amp / 3);
      gsap.to(pos[i], {
        x: tx, y: ty,
        duration: dur,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: i * 0.35,
      });
    });

    /* ─ 2. Ticker: sync node transforms + edge endpoints ────────── */
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

    /* ─ 3. Sonar rings on each node ─────────────────────────────── */
    NODES.forEach((n, i) => {
      const el = nodeRefs.current[i];
      if (!el) return;
      const rings = el.querySelectorAll<SVGCircleElement>('.nring');

      const fire = () => {
        rings.forEach((ring, j) => {
          gsap.fromTo(ring,
            { attr: { r: n.r, opacity: 0.6 } },
            {
              attr: { r: n.r * 9, opacity: 0 },
              duration: 2.4,
              ease: 'power2.out',
              delay: j * 0.5,
            }
          );
        });
        gsap.delayedCall(4.5 + (i % 6) * 0.8, fire);
      };
      gsap.delayedCall(0.6 + i * 0.45, fire);
    });

    /* ─ 4. Traveling data packets ───────────────────────────────── */
    const travel = (pIdx: number, fromId: number) => {
      const neighbors = ADJ.get(fromId) ?? [];
      if (!neighbors.length) return;
      const toId = neighbors[Math.floor((pIdx * 7 + fromId * 3) % neighbors.length)];

      const pEl = packetRefs.current[pIdx];
      if (!pEl) return;

      const src = pos[fromId];
      const dst = pos[toId];

      // Find edge index
      const eIdx = EDGES.findIndex(([a, b]) =>
        (a === fromId && b === toId) || (a === toId && b === fromId)
      );
      const eEl = eIdx >= 0 ? edgeRefs.current[eIdx] : null;

      // Light up edge
      if (eEl) {
        gsap.to(eEl, {
          attr: { opacity: 0.75, 'stroke-width': 2 },
          duration: 0.12,
          overwrite: 'auto',
        });
      }

      // Position packet at source
      gsap.set(pEl, { x: src.x, y: src.y, opacity: 1, scale: 1 });

      // Distance-based duration
      const dist = Math.sqrt((dst.x - src.x) ** 2 + (dst.y - src.y) ** 2);
      const dur  = Math.max(0.45, dist / 195);

      gsap.to(pEl, {
        x: dst.x,
        y: dst.y,
        duration: dur,
        ease: 'power1.inOut',
        onComplete() {
          // Dim edge back
          if (eEl) {
            gsap.to(eEl, {
              attr: { opacity: 0.2, 'stroke-width': 1 },
              duration: 0.55,
              overwrite: 'auto',
            });
          }

          // Arrival pulse on destination node
          const destEl = nodeRefs.current[toId];
          if (destEl) {
            const rings = destEl.querySelectorAll<SVGCircleElement>('.nring');
            rings.forEach((ring, j) => {
              gsap.fromTo(ring,
                { attr: { r: NODES[toId].r, opacity: 0.8 } },
                { attr: { r: NODES[toId].r * 6, opacity: 0 }, duration: 0.9, ease: 'power3.out', delay: j * 0.28 }
              );
            });
          }

          // Scale flash on arrival
          gsap.fromTo(pEl, { scale: 1.8 }, { scale: 1, duration: 0.25, ease: 'power2.out' });

          // Continue to next node
          gsap.delayedCall(0.12 + (pIdx % 4) * 0.08, () => travel(pIdx, toId));
        },
      });
    };

    // Staggered start from different nodes
    const origins = [0, 1, 3, 5, 7, 10, 2];
    for (let i = 0; i < NUM_PACKETS; i++) {
      gsap.delayedCall(0.2 + i * 0.42, () => travel(i, origins[i]));
    }

    /* ─ 5. Ambient edge pulse (edges not currently lit) ─────────── */
    gsap.to(edgeRefs.current.filter(Boolean), {
      attr: { opacity: 0.28 },
      duration: 3.5,
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
      stagger: { each: 0.18, from: 'random' },
    });

    /* ─ 6. Background particles ─────────────────────────────────── */
    const dots = particlesRef.current?.querySelectorAll('.hero-particle');
    dots?.forEach((dot, i) => {
      const go = () => {
        gsap.to(dot, {
          x: ((i * 41 + Date.now() % 200) % 100) - 50,
          y: ((i * 29 + Date.now() % 150) % 100) - 50,
          duration: 6 + (i % 5) * 1.5,
          ease: 'power1.inOut',
          onComplete: go,
        });
      };
      gsap.delayedCall(i * 0.15, go);
    });

    /* ─ 7. Mouse parallax ───────────────────────────────────────── */
    const onMove = (e: MouseEvent) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect || !svgRef.current) return;
      const nx = (e.clientX - rect.left) / rect.width - 0.5;
      const ny = (e.clientY - rect.top) / rect.height - 0.5;
      gsap.to(svgRef.current, {
        x: nx * 20,
        y: ny * 12,
        duration: 1.6,
        ease: 'power2.out',
      });
    };
    containerRef.current?.addEventListener('mousemove', onMove);

    /* ─ 8. Entrance animation ───────────────────────────────────── */
    const tl = gsap.timeline({ defaults: { ease: 'power3.out' } });
    tl.fromTo('.hero-tagline',       { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.5 }, 0.1);
    tl.fromTo('.hero-headline-line', { opacity: 0, y: 20 }, { opacity: 1, y: 0, duration: 0.55, stagger: 0.15 }, 0.25);
    tl.fromTo('.hero-sub',           { opacity: 0, y: 12 }, { opacity: 1, y: 0, duration: 0.5 }, 0.55);
    tl.fromTo('.hero-btns',          { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.45 }, 0.7);
    tl.fromTo('.hero-visual',        { opacity: 0, x: 20 }, { opacity: 1, x: 0, duration: 0.65 }, 0.3);

    // Staggered edge + node entrance
    gsap.fromTo(
      edgeRefs.current.filter(Boolean),
      { attr: { opacity: 0 } },
      { attr: { opacity: 0.2 }, duration: 0.6, stagger: { each: 0.04, from: 'random' }, delay: 0.4 }
    );
    gsap.fromTo(
      nodeRefs.current.filter(Boolean),
      { scale: 0, transformOrigin: '50% 50%' },
      { scale: 1, duration: 0.5, ease: 'back.out(1.6)', stagger: { each: 0.06, from: 'center' }, delay: 0.5 }
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
      {/* Background particles */}
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
        position: 'absolute', top: '15%', left: '-8%',
        width: '700px', height: '700px',
        background: 'radial-gradient(circle, rgba(56,182,255,0.055) 0%, transparent 65%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '-5%',
        width: '520px', height: '520px',
        background: 'radial-gradient(circle, rgba(167,139,250,0.04) 0%, transparent 65%)',
        filter: 'blur(40px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: '45%', left: '50%', transform: 'translate(-50%,-50%)',
        width: '400px', height: '400px',
        background: 'radial-gradient(circle, rgba(0,229,204,0.03) 0%, transparent 65%)',
        filter: 'blur(50px)', pointerEvents: 'none',
      }} />

      {/* Main content */}
      <div style={{
        position: 'relative', zIndex: 10,
        maxWidth: '1200px', margin: '0 auto',
        padding: '0 2rem', width: '100%',
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '80px',
        alignItems: 'center',
      }}>

        {/* Left: text */}
        <div>
          <div
            className="hero-tagline"
            style={{
              opacity: 0,
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px', fontWeight: 400,
              textTransform: 'uppercase', letterSpacing: '0.2em',
              color: '#00e5cc', marginBottom: '28px',
            }}
          >
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

        {/* Right: network visualization */}
        <div className="hero-visual" style={{ opacity: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg
            ref={svgRef}
            viewBox="0 0 524 374"
            width="100%"
            style={{ maxWidth: '524px', overflow: 'visible' }}
            aria-hidden
          >
            <defs>
              {/* Glow filter for packets */}
              <filter id="hpglow" x="-120%" y="-120%" width="340%" height="340%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.8" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Soft glow for node cores */}
              <filter id="hnglow" x="-80%" y="-80%" width="260%" height="260%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
              {/* Strong glow for hub node */}
              <filter id="hhubglow" x="-100%" y="-100%" width="300%" height="300%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* ── Edges ─────────────────────────────────────────── */}
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

            {/* ── Nodes ─────────────────────────────────────────── */}
            {NODES.map((n, i) => (
              <g key={n.id} ref={el => { nodeRefs.current[i] = el; }}>
                {/* Sonar rings (animated) */}
                <circle className="nring" cx={n.cx} cy={n.cy} r={n.r}
                  fill="none" stroke={n.color} strokeWidth="1.5" opacity="0" />
                <circle className="nring" cx={n.cx} cy={n.cy} r={n.r}
                  fill="none" stroke={n.color} strokeWidth="1" opacity="0" />

                {/* Halo layers */}
                <circle cx={n.cx} cy={n.cy} r={n.r * 5.5} fill={n.color} opacity="0.04" />
                <circle cx={n.cx} cy={n.cy} r={n.r * 3}   fill={n.color} opacity="0.08" />
                <circle cx={n.cx} cy={n.cy} r={n.r * 1.8} fill={n.color} opacity="0.15" />

                {/* Core */}
                <circle
                  cx={n.cx} cy={n.cy} r={n.r}
                  fill={n.color}
                  filter={i === 0 ? 'url(#hhubglow)' : 'url(#hnglow)'}
                  opacity="0.92"
                />
                {/* Bright center */}
                <circle cx={n.cx} cy={n.cy} r={n.r * 0.38} fill="#fff" opacity="0.75" />
              </g>
            ))}

            {/* ── Traveling packets ─────────────────────────────── */}
            {Array.from({ length: NUM_PACKETS }, (_, i) => (
              <g
                key={i}
                ref={el => { packetRefs.current[i] = el; }}
                style={{ opacity: 0 }}
              >
                {/* Outer glow */}
                <circle cx={0} cy={0} r={7}   fill={PACKET_COLORS[i]} opacity="0.18" filter="url(#hpglow)" />
                {/* Mid ring */}
                <circle cx={0} cy={0} r={4}   fill={PACKET_COLORS[i]} opacity="0.45" />
                {/* Core */}
                <circle cx={0} cy={0} r={2.4} fill={PACKET_COLORS[i]} filter="url(#hpglow)" />
                {/* White center */}
                <circle cx={0} cy={0} r={1}   fill="#fff" opacity="0.9" />
              </g>
            ))}
          </svg>
        </div>
      </div>
    </section>
  );
}
