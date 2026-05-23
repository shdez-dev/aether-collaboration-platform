'use client';

import { useRef, useEffect } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

const STATS_BASE = [
  { value: 0, target: 12, suffix: 'ms', accent: '#38b6ff' },
  { value: 0, target: 0,  suffix: '',   accent: '#00e5cc', display: '∞' },
  { value: 0, target: 99, suffix: '%',  accent: '#38b6ff' },
];

type Stat = (typeof STATS_BASE)[0] & { label: string; description: string };

function StatCard({
  stat,
  index,
}: {
  stat: Stat;
  index: number;
}) {
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = numRef.current;
    if (!el || stat.display) return;

    const trigger = ScrollTrigger.create({
      trigger: el,
      start: 'top 85%',
      onEnter: () => {
        gsap.fromTo(
          { val: stat.value },
          { val: stat.target },
          {
            val: stat.target,
            duration: 1.6,
            ease: 'power2.out',
            onUpdate: function () {
              if (el) el.textContent = Math.round(this.targets()[0].val).toString();
            },
          }
        );
      },
      once: true,
    });

    return () => trigger.kill();
  }, [stat]);

  return (
    <div
      className={`stat-card-${index} hud-panel`}
      style={{
        opacity: 0,
        padding: '36px 32px',
        textAlign: 'center',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Glow top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '60%',
          height: '1px',
          background: `linear-gradient(90deg, transparent, ${stat.accent}66, transparent)`,
        }}
      />

      {/* Number */}
      <div
        style={{
          fontFamily: 'JetBrains Mono, monospace',
          fontSize: 'clamp(40px, 5vw, 56px)',
          fontWeight: 700,
          letterSpacing: '-0.04em',
          lineHeight: 1,
          marginBottom: '8px',
          background: `linear-gradient(135deg, ${stat.accent} 0%, ${stat.accent}99 100%)`,
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
        }}
      >
        {stat.display ? (
          stat.display
        ) : (
          <>
            <span ref={numRef}>{stat.value}</span>
            {stat.suffix}
          </>
        )}
      </div>

      {/* Label */}
      <div
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          fontWeight: 500,
          fontSize: '15px',
          color: '#f0f6ff',
          marginBottom: '10px',
          letterSpacing: '-0.01em',
        }}
      >
        {stat.label}
      </div>

      {/* Description */}
      <p
        style={{
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
          fontSize: '13px',
          fontWeight: 300,
          lineHeight: 1.65,
          color: 'rgba(180,210,255,0.5)',
          margin: 0,
        }}
      >
        {stat.description}
      </p>
    </div>
  );
}

export function LandingArchitecture() {
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);

  const STATS: Stat[] = [
    { ...STATS_BASE[0], label: t.landing_arch_stat1_label, description: t.landing_arch_stat1_desc },
    { ...STATS_BASE[1], label: t.landing_arch_stat2_label, description: t.landing_arch_stat2_desc },
    { ...STATS_BASE[2], label: t.landing_arch_stat3_label, description: t.landing_arch_stat3_desc },
  ];

  useGSAP(
    () => {
      gsap.fromTo(
        '.stats-heading',
        { opacity: 0, y: 14 },
        {
          opacity: 1,
          y: 0,
          duration: 0.55,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 82%',
          },
        }
      );

      [0, 1, 2].forEach((i) => {
        gsap.fromTo(
          `.stat-card-${i}`,
          { opacity: 0, y: 28 },
          {
            opacity: 1,
            y: 0,
            duration: 0.6,
            delay: i * 0.12,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: `.stat-card-${i}`,
              start: 'top 80%',
            },
          }
        );
      });
    },
    { scope: sectionRef }
  );

  return (
    <section
      ref={sectionRef}
      style={{
        background: '#080c14',
        padding: '100px 0 120px',
        position: 'relative',
      }}
    >
      {/* Ambient glow center */}
      <div
        style={{
          position: 'absolute',
          top: '30%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '700px',
          height: '300px',
          background: 'radial-gradient(ellipse, rgba(56,182,255,0.04) 0%, transparent 70%)',
          filter: 'blur(40px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
        }}
      >
        {/* Heading */}
        <div
          className="stats-heading"
          style={{
            opacity: 0,
            textAlign: 'center',
            marginBottom: '64px',
          }}
        >
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#00e5cc',
              marginBottom: '16px',
            }}
          >
            {t.landing_arch_label}
          </div>
          <h2
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontWeight: 300,
              fontSize: 'clamp(26px, 3vw, 40px)',
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: '#f0f6ff',
              margin: 0,
            }}
          >
            {t.landing_arch_heading}{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #38b6ff 0%, #00e5cc 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 400,
              }}
            >
              {t.landing_arch_heading_highlight}
            </span>
          </h2>
        </div>

        {/* Stats grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }}
        >
          {STATS.map((stat, i) => (
            <StatCard key={i} stat={stat} index={i} />
          ))}
        </div>
      </div>
    </section>
  );
}
