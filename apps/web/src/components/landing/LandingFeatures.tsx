'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

const FEATURE_ICONS = [
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <rect x="1" y="1" width="9" height="9" rx="2" stroke="#38b6ff" strokeWidth="1.5" />
        <rect x="12" y="1" width="9" height="9" rx="2" stroke="#38b6ff" strokeWidth="1.5" />
        <rect x="1" y="12" width="9" height="9" rx="2" stroke="rgba(56,182,255,0.4)" strokeWidth="1.5" />
        <rect x="12" y="12" width="9" height="9" rx="2" stroke="rgba(56,182,255,0.4)" strokeWidth="1.5" />
      </svg>
    ),
    accent: '#38b6ff',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 5h14M4 9h10M4 13h12M4 17h8" stroke="#00e5cc" strokeWidth="1.5" strokeLinecap="round" />
        <circle cx="18" cy="15" r="3.5" fill="rgba(0,229,204,0.15)" stroke="#00e5cc" strokeWidth="1.5" />
        <path d="M16.5 15l1 1 2-2" stroke="#00e5cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
    accent: '#00e5cc',
  },
  {
    icon: (
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <circle cx="11" cy="7" r="3" stroke="#38b6ff" strokeWidth="1.5" />
        <circle cx="4" cy="16" r="2.5" stroke="rgba(56,182,255,0.5)" strokeWidth="1.5" />
        <circle cx="18" cy="16" r="2.5" stroke="rgba(56,182,255,0.5)" strokeWidth="1.5" />
        <path d="M8 14.5C8.5 12.5 13.5 12.5 14 14.5" stroke="#38b6ff" strokeWidth="1.5" strokeLinecap="round" />
        <path d="M2 19.5C2.4 17.8 5.8 17 7 17.5" stroke="rgba(56,182,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M20 19.5C19.6 17.8 16.2 17 15 17.5" stroke="rgba(56,182,255,0.4)" strokeWidth="1.2" strokeLinecap="round" />
      </svg>
    ),
    accent: '#38b6ff',
  },
];

export function LandingFeatures() {
  const t = useT();
  const sectionRef = useRef<HTMLElement>(null);

  const FEATURES = [
    { ...FEATURE_ICONS[0], title: t.landing_features_feat1_title, body: t.landing_features_feat1_body },
    { ...FEATURE_ICONS[1], title: t.landing_features_feat2_title, body: t.landing_features_feat2_body },
    { ...FEATURE_ICONS[2], title: t.landing_features_feat3_title, body: t.landing_features_feat3_body },
  ];

  useGSAP(
    () => {
      gsap.fromTo(
        '.features-heading',
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

      gsap.fromTo(
        '.feature-card',
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.15,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: '.feature-card',
            start: 'top 80%',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="features"
      ref={sectionRef}
      style={{
        background: '#080c14',
        padding: '120px 0',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Separator top */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: '10%',
          right: '10%',
          height: '1px',
          background: 'linear-gradient(90deg, transparent, rgba(56,182,255,0.15), transparent)',
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
          className="features-heading"
          style={{
            opacity: 0,
            textAlign: 'center',
            marginBottom: '72px',
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
            {t.landing_features_label}
          </div>
          <h2
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontWeight: 300,
              fontSize: 'clamp(28px, 3.5vw, 44px)',
              lineHeight: 1.2,
              letterSpacing: '-0.03em',
              color: '#f0f6ff',
              margin: 0,
            }}
          >
            {t.landing_features_heading}{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #38b6ff 0%, #00e5cc 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 400,
              }}
            >
              {t.landing_features_heading_highlight}
            </span>
          </h2>
        </div>

        {/* Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '20px',
          }}
        >
          {FEATURES.map((f, i) => (
            <div
              key={i}
              className="feature-card hud-panel"
              style={{
                opacity: 0,
                padding: '32px 28px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '10px',
                  background: 'rgba(56,182,255,0.07)',
                  border: '1px solid rgba(56,182,255,0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '22px',
                }}
              >
                {f.icon}
              </div>

              <h3
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  fontWeight: 500,
                  fontSize: '16px',
                  color: '#f0f6ff',
                  margin: '0 0 12px 0',
                  letterSpacing: '-0.01em',
                }}
              >
                {f.title}
              </h3>

              <p
                style={{
                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                  fontSize: '14px',
                  fontWeight: 300,
                  lineHeight: 1.7,
                  color: 'rgba(180,210,255,0.55)',
                  margin: 0,
                }}
              >
                {f.body}
              </p>

              <div
                style={{
                  marginTop: '28px',
                  height: '1px',
                  background: `linear-gradient(90deg, ${f.accent}33, transparent)`,
                }}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
