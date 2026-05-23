'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';

function LogoIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 220 220" fill="none" aria-hidden>
      <path d="M110 39L32 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M110 39L188 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M66 122L154 122" stroke="#00e5cc" strokeWidth="7" strokeLinecap="round" />
      <circle cx="110" cy="39" r="9" fill="#38b6ff" />
      <circle cx="32" cy="173" r="9" fill="#38b6ff" />
      <circle cx="188" cy="173" r="9" fill="#00e5cc" />
    </svg>
  );
}

export function LandingFooter() {
  const t = useT();

  const LINKS = [
    { label: t.landing_footer_login, href: '/login' },
    { label: t.landing_footer_register, href: '/register' },
  ];

  return (
    <footer
      style={{
        background: '#080c14',
        borderTop: '1px solid rgba(56,182,255,0.08)',
        padding: '40px 0',
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
          gap: '24px',
          flexWrap: 'wrap',
        }}
      >
        {/* Logo + name */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
            fontWeight: 500,
            fontSize: '14px',
            color: 'rgba(180,210,255,0.5)',
            letterSpacing: '-0.01em',
          }}
        >
          <LogoIcon />
          Aether
        </div>

        {/* Links */}
        <div
          style={{
            display: 'flex',
            gap: '28px',
            flexWrap: 'wrap',
          }}
        >
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              style={{
                fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
                fontSize: '13px',
                fontWeight: 400,
                color: 'rgba(180,210,255,0.35)',
                textDecoration: 'none',
                transition: 'color 0.2s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.7)')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.35)')}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Copyright */}
        <div
          style={{
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: '11px',
            color: 'rgba(180,210,255,0.2)',
          }}
        >
          © 2026 Aether
        </div>
      </div>
    </footer>
  );
}
