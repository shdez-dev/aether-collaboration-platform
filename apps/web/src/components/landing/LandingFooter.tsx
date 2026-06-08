'use client';

import Link from 'next/link';
import { useT } from '@/lib/i18n';

function LogoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="16" height="16" aria-hidden>
      <defs>
        <linearGradient id="footer-aether" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22a5d6" />
          <stop offset="100%" stopColor="#3fd0e8" />
        </linearGradient>
      </defs>
      <path d="M18 20 C 38 38, 42 54, 50 78" fill="none" stroke="#1f8fc4" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M50 14 C 50 38, 50 54, 50 78" fill="none" stroke="url(#footer-aether)" strokeWidth="6.5" strokeLinecap="round" />
      <path d="M82 20 C 62 38, 58 54, 50 78" fill="none" stroke="#3fd0e8" strokeWidth="6.5" strokeLinecap="round" />
      <circle cx="18" cy="20" r="5.5" fill="#1f8fc4" />
      <circle cx="50" cy="14" r="5.5" fill="#2bb4dd" />
      <circle cx="82" cy="20" r="5.5" fill="#3fd0e8" />
      <circle cx="50" cy="80" r="8" fill="url(#footer-aether)" />
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
