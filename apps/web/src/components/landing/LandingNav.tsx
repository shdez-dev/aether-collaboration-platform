'use client';

import Link from 'next/link';
import { useIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

function Logo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="20" height="20" aria-label="Aether">
      <defs>
        <linearGradient id="nav-aether" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22a5d6" />
          <stop offset="100%" stopColor="#3fd0e8" />
        </linearGradient>
      </defs>
      <path d="M18 20 C 38 38, 42 54, 50 78" fill="none" stroke="#1f8fc4" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M50 14 C 50 38, 50 54, 50 78" fill="none" stroke="url(#nav-aether)" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M82 20 C 62 38, 58 54, 50 78" fill="none" stroke="#3fd0e8" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="18" cy="20" r="5.5" fill="#1f8fc4" />
      <circle cx="50" cy="14" r="5.5" fill="#2bb4dd" />
      <circle cx="82" cy="20" r="5.5" fill="#3fd0e8" />
      <circle cx="50" cy="80" r="8" fill="url(#nav-aether)" />
    </svg>
  );
}

function LangToggle() {
  const uiLanguage = useAuthStore((s) => s.uiLanguage);
  const setUiLanguage = useAuthStore((s) => s.setUiLanguage);
  const userLanguage = useAuthStore((s) => s.user?.language);

  const current = uiLanguage ?? userLanguage ?? 'es';
  const next = current === 'es' ? 'en' : 'es';

  return (
    <button
      onClick={() => setUiLanguage(next)}
      style={{
        background: 'none',
        border: '1px solid rgba(56,182,255,0.2)',
        borderRadius: '5px',
        padding: '5px 10px',
        cursor: 'pointer',
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: '11px',
        letterSpacing: '0.08em',
        color: 'rgba(180,210,255,0.5)',
        transition: 'border-color 0.2s, color 0.2s',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.5)';
        (e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.85)';
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.2)';
        (e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.5)';
      }}
      title={`Cambiar a ${next.toUpperCase()}`}
    >
      {current.toUpperCase()}
    </button>
  );
}

export function LandingNav() {
  const t = useT();
  const isAuthenticated = useIsAuthenticated();

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: 'rgba(8, 12, 20, 0.85)',
        borderBottom: '1px solid rgba(56, 182, 255, 0.1)',
      }}
    >
      <div
        style={{
          maxWidth: '1200px',
          margin: '0 auto',
          padding: '0 2rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          height: '62px',
        }}
      >
        {/* Logo */}
        <Link
          href="/"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            textDecoration: 'none',
            fontFamily: FONT,
            fontWeight: 500,
            fontSize: '15px',
            color: '#f0f6ff',
            letterSpacing: '-0.01em',
          }}
        >
          <Logo />
          Aether
        </Link>

        {/* Lang toggle + CTA */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <LangToggle />

          {isAuthenticated ? (
            <Link href="/dashboard" className="landing-btn-primary" style={{ fontFamily: FONT }}>
              {t.home_hero_cta_dashboard} →
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                style={{
                  padding: '8px 16px',
                  color: 'rgba(180, 210, 255, 0.6)',
                  fontFamily: FONT,
                  fontSize: '14px',
                  textDecoration: 'none',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#f0f6ff')}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180, 210, 255, 0.6)')}
              >
                {t.login_btn_submit}
              </Link>
              <Link
                href="/register"
                className="landing-btn-primary"
                style={{ fontFamily: FONT, padding: '8px 20px', fontSize: '14px' }}
              >
                {t.register_btn_submit}
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
