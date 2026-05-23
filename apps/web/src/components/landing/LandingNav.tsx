'use client';

import Link from 'next/link';
import { useIsAuthenticated, useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';

function Logo() {
  return (
    <svg width="20" height="20" viewBox="0 0 220 220" fill="none" aria-label="Aether">
      <path d="M110 39L32 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M110 39L188 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M66 122L154 122" stroke="#00e5cc" strokeWidth="7" strokeLinecap="round" />
      <circle cx="110" cy="39" r="9" fill="#38b6ff" />
      <circle cx="32" cy="173" r="9" fill="#38b6ff" />
      <circle cx="188" cy="173" r="9" fill="#00e5cc" />
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
