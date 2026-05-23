'use client';

import { useRef } from 'react';
import { useGSAP } from '@gsap/react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

gsap.registerPlugin(ScrollTrigger);

export function LandingCTA() {
  const sectionRef = useRef<HTMLElement>(null);
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  useGSAP(
    () => {
      gsap.fromTo(
        '.cta-content',
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.65,
          ease: 'power3.out',
          scrollTrigger: {
            trigger: sectionRef.current,
            start: 'top 78%',
          },
        }
      );
    },
    { scope: sectionRef }
  );

  return (
    <section
      id="cta"
      ref={sectionRef}
      style={{
        background: '#080c14',
        padding: '100px 0 120px',
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

      {/* Radial glow */}
      <div
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '600px',
          height: '400px',
          background: 'radial-gradient(ellipse, rgba(56,182,255,0.07) 0%, transparent 65%)',
          filter: 'blur(30px)',
          pointerEvents: 'none',
        }}
      />

      <div
        style={{
          maxWidth: '720px',
          margin: '0 auto',
          padding: '0 2rem',
          textAlign: 'center',
          position: 'relative',
          zIndex: 10,
        }}
      >
        <div
          className="cta-content"
          style={{ opacity: 0 }}
        >
          {/* Tag */}
          <div
            style={{
              fontFamily: 'JetBrains Mono, monospace',
              fontSize: '11px',
              fontWeight: 400,
              textTransform: 'uppercase',
              letterSpacing: '0.2em',
              color: '#00e5cc',
              marginBottom: '24px',
            }}
          >
            {t.landing_cta_label}
          </div>

          {/* Headline */}
          <h2
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontWeight: 300,
              fontSize: 'clamp(30px, 4vw, 52px)',
              lineHeight: 1.15,
              letterSpacing: '-0.03em',
              color: '#f0f6ff',
              margin: '0 0 20px 0',
            }}
          >
            {t.landing_cta_heading}{' '}
            <span
              style={{
                background: 'linear-gradient(90deg, #38b6ff 0%, #00e5cc 100%)',
                WebkitBackgroundClip: 'text',
                backgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                fontWeight: 400,
              }}
            >
              {t.landing_cta_heading_highlight}
            </span>
          </h2>

          {/* Subtext */}
          <p
            style={{
              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
              fontSize: 'clamp(14px, 1.5vw, 16px)',
              fontWeight: 300,
              lineHeight: 1.7,
              color: 'rgba(180,210,255,0.55)',
              margin: '0 0 44px 0',
              maxWidth: '480px',
              marginLeft: 'auto',
              marginRight: 'auto',
            }}
          >
            {t.landing_cta_subtext}
          </p>

          {/* Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '12px',
              justifyContent: 'center',
              alignItems: 'center',
              flexWrap: 'wrap',
            }}
          >
            {isAuthenticated ? (
              <Link href="/dashboard" className="landing-btn-primary">
                {t.landing_cta_dashboard}
              </Link>
            ) : (
              <>
                <Link
                  href="/register"
                  className="landing-btn-primary"
                  style={{ padding: '14px 36px', fontSize: '15px' }}
                >
                  {t.landing_cta_start}
                </Link>
                <Link href="/login" className="landing-btn-secondary" style={{ padding: '13px 28px', fontSize: '15px' }}>
                  {t.landing_cta_login}
                </Link>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
