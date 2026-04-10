'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { LanguageSwitcher } from '@/components/ui/LanguageSwitcher';

// Nodos y coordenadas del logo — idéntico al banner pero escalado para el hero
// ViewBox 220x220. Apex (110,30), base-izq (32,182), base-der (188,182)
// Travesaño en el 62% de las piernas: (66,122) → (154,122)

const MAIN_NODES = [
  { id: 'apex', cx: 110, cy: 30,  r: 9,   delay: 0   },
  { id: 'bl',   cx: 32,  cy: 182, r: 9,   delay: 0.2 },
  { id: 'br',   cx: 188, cy: 182, r: 9,   delay: 0.2 },
];

// Red decorativa exterior — misma estética que el network graph del banner
const NET_NODES = [
  { cx: 14,  cy: 62,  r: 4.5 },
  { cx: 206, cy: 44,  r: 4   },
  { cx: 8,   cy: 148, r: 3.5 },
  { cx: 212, cy: 136, r: 3.5 },
  { cx: 58,  cy: 210, r: 4   },
  { cx: 162, cy: 210, r: 4   },
  { cx: 110, cy: 218, r: 3   },
];

const NET_EDGES = [
  'M 32 182 L 8 148 L 14 62',
  'M 188 182 L 212 136 L 206 44',
  'M 32 182 L 58 210 L 110 218 L 162 210 L 188 182',
  'M 14 62 L 206 44',
];

// Approximate path lengths for strokeDashoffset travel animations
// Left leg M110,39→32,173: sqrt(78²+134²) ≈ 155  | Right leg: same ≈ 155 | Crossbar: 88
const LEG_LEN   = 155;
const CROSS_LEN = 88;
// Cycle: left dot (1.6s) → right dot starts 1.4s later → crossbar starts 2.8s later → pause → repeat (total ~8s)
const CYCLE = 8;

function AetherLogo({ size = 300 }: { size?: number }) {
  return (
    <motion.div
      animate={{ y: [0, -9, 0] }}
      transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
      style={{ display: 'inline-block', lineHeight: 0 }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 220 220"
        fill="none"
        aria-label="Aether logo"
      >
        <defs>
          <filter id="hero-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
          <filter id="dot-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.5" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Red exterior decorativa */}
        {NET_EDGES.map((d, i) => (
          <motion.path
            key={`net-e-${i}`}
            d={d}
            stroke="#3B82F6"
            strokeWidth="1"
            fill="none"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.14 }}
            transition={{ duration: 0.5, delay: 1.3 + i * 0.1 }}
          />
        ))}
        {NET_NODES.map((n, i) => (
          <motion.circle
            key={`net-n-${i}`}
            cx={n.cx} cy={n.cy} r={n.r}
            fill="#3B82F6"
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.18 }}
            transition={{ duration: 0.4, delay: 1.2 + i * 0.07 }}
          />
        ))}

        {/* Piernas de la A */}
        <motion.path
          d="M 110 39 L 32 173"
          stroke="#3B82F6"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.5, ease: 'easeOut' }}
        />
        <motion.path
          d="M 110 39 L 188 173"
          stroke="#3B82F6"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.72, ease: 'easeOut' }}
        />

        {/* Travesaño */}
        <motion.path
          d="M 66 122 L 154 122"
          stroke="#3B82F6"
          strokeWidth="5.5"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{ pathLength: 1, opacity: 1 }}
          transition={{ duration: 0.45, delay: 0.96, ease: 'easeOut' }}
        />

        {/* ── Traveling dots (loop: left → right → crossbar) ── */}
        {/* Left leg dot */}
        <motion.path
          d="M 110 39 L 32 173"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#dot-glow)"
          strokeDasharray={`7 ${LEG_LEN + 20}`}
          initial={{ strokeDashoffset: 7, opacity: 0 }}
          animate={{
            strokeDashoffset: [7, -(LEG_LEN + 7)],
            opacity:          [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.6,
            delay: 2.2,
            repeat: Infinity,
            repeatDelay: CYCLE - 1.6,
            ease: 'easeInOut',
          }}
        />
        {/* Right leg dot */}
        <motion.path
          d="M 110 39 L 188 173"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#dot-glow)"
          strokeDasharray={`7 ${LEG_LEN + 20}`}
          initial={{ strokeDashoffset: 7, opacity: 0 }}
          animate={{
            strokeDashoffset: [7, -(LEG_LEN + 7)],
            opacity:          [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.6,
            delay: 2.2 + 1.4,
            repeat: Infinity,
            repeatDelay: CYCLE - 1.6,
            ease: 'easeInOut',
          }}
        />
        {/* Crossbar dot */}
        <motion.path
          d="M 66 122 L 154 122"
          stroke="rgba(255,255,255,0.85)"
          strokeWidth="4"
          strokeLinecap="round"
          fill="none"
          filter="url(#dot-glow)"
          strokeDasharray={`7 ${CROSS_LEN + 20}`}
          initial={{ strokeDashoffset: 7, opacity: 0 }}
          animate={{
            strokeDashoffset: [7, -(CROSS_LEN + 7)],
            opacity:          [0, 1, 1, 0],
          }}
          transition={{
            duration: 1.1,
            delay: 2.2 + 2.8,
            repeat: Infinity,
            repeatDelay: CYCLE - 1.1,
            ease: 'easeInOut',
          }}
        />

        {/* Nodo inferior muted */}
        <motion.g
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, delay: 1.1, type: 'spring' }}
        >
          <circle cx="110" cy="196" r="6" fill="#94a3b8" opacity="0.6" />
          <line x1="32" y1="191" x2="104" y2="195" stroke="#94a3b8" strokeWidth="2.5" opacity="0.35" strokeLinecap="round" />
          <line x1="188" y1="191" x2="116" y2="195" stroke="#94a3b8" strokeWidth="2.5" opacity="0.35" strokeLinecap="round" />
        </motion.g>

        {/* Tres nodos principales con glow */}
        {MAIN_NODES.map((node) => (
          <motion.g
            key={node.id}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: node.delay, type: 'spring', stiffness: 220 }}
          >
            <motion.circle
              cx={node.cx} cy={node.cy}
              r={node.r + 8}
              fill="none"
              stroke="rgba(59,130,246,0.15)"
              strokeWidth="1"
              animate={{
                r: [node.r + 8, node.r + 22, node.r + 8],
                opacity: [0.15, 0, 0.15],
              }}
              transition={{ duration: 3.5, delay: node.delay + 2, repeat: Infinity, ease: 'easeInOut' }}
            />
            <circle
              cx={node.cx} cy={node.cy}
              r={node.r}
              fill="#3B82F6"
              filter="url(#hero-glow)"
            />
          </motion.g>
        ))}
      </svg>
    </motion.div>
  );
}

export function HeroSection() {
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  return (
    <section className="relative min-h-screen flex items-center justify-center">
      {/* Language switcher */}
      <div className="absolute top-5 right-5 z-20">
        <LanguageSwitcher variant="floating" />
      </div>

      {/* Decorativos con overflow propio para no recortar el texto */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grid de fondo sutil */}
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
              linear-gradient(rgba(59,130,246,0.06) 1px, transparent 1px),
              linear-gradient(90deg, rgba(59,130,246,0.06) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
            maskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 80% at 50% 50%, black 30%, transparent 100%)',
          }}
        />
        {/* Ambient glows */}
        <div className="absolute top-1/3 left-1/3 w-[500px] h-[500px] bg-accent/6 rounded-full blur-[160px]" />
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-blue-400/5 rounded-full blur-[120px]" />
      </div>

      {/* ── MOBILE ─────────────────────────────────────────── */}
      <div className="relative z-10 w-full px-6 py-20 md:hidden">
        <div className="flex flex-col items-center text-center gap-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
          >
            <h1 className="text-6xl font-black leading-none">
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
              <Link href="/dashboard" className="w-full py-3.5 bg-accent text-white font-semibold text-center rounded-lg active:scale-95 transition-transform text-sm whitespace-nowrap px-4">
                {t.home_hero_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link href="/register" className="w-full py-3.5 bg-accent text-white font-semibold text-center rounded-lg active:scale-95 transition-transform text-sm whitespace-nowrap px-4">
                  {t.home_hero_cta_start}
                </Link>
                <Link href="/login" className="w-full py-3.5 bg-background border border-border text-text-primary font-medium text-center rounded-lg active:scale-95 transition-transform text-sm whitespace-nowrap px-4">
                  {t.home_hero_cta_login}
                </Link>
              </>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.88 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.4 }}
          >
            <AetherLogo size={200} />
          </motion.div>
        </div>
      </div>

      {/* ── DESKTOP ────────────────────────────────────────── */}
      <div className="relative z-10 w-full max-w-5xl mx-auto px-10 hidden md:block">
        <div className="grid grid-cols-2 gap-12 items-center">

          {/* Columna izquierda: título + descripción + CTAs */}
          <div className="flex flex-col gap-8">
            <motion.div
              initial={{ opacity: 0, x: -24 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col gap-3"
            >
              <h1 className="text-7xl xl:text-8xl font-bold leading-[0.9]">
                <span className="home-aether-text">AETHER</span>
              </h1>
              <p className="text-text-secondary font-light text-sm tracking-[0.2em] uppercase">
                {t.home_hero_tagline}
              </p>
            </motion.div>

            <motion.p
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.18 }}
              className="text-text-secondary text-base leading-relaxed"
            >
              {t.home_hero_description}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, x: -18 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6, delay: 0.32 }}
              className="flex items-center gap-4"
            >
              {isAuthenticated ? (
                <Link href="/dashboard" className="px-8 py-3.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors shadow-[0_0_24px_rgba(59,130,246,0.3)]">
                  {t.home_hero_cta_dashboard}
                </Link>
              ) : (
                <>
                  <Link href="/register" className="px-8 py-3.5 bg-accent text-white font-medium rounded-lg hover:bg-accent/90 transition-colors shadow-[0_0_24px_rgba(59,130,246,0.3)]">
                    {t.home_hero_cta_start}
                  </Link>
                  <Link href="/login" className="px-8 py-3.5 text-text-primary border border-border rounded-lg hover:border-accent/50 hover:text-accent transition-all">
                    {t.home_hero_cta_login}
                  </Link>
                </>
              )}
            </motion.div>
          </div>

          {/* Columna derecha: logo de red */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85, x: 24 }}
            animate={{ opacity: 1, scale: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.45 }}
            className="flex items-center justify-center"
          >
            <AetherLogo size={320} />
          </motion.div>

        </div>
      </div>
    </section>
  );
}
