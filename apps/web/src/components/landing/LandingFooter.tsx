'use client';

import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

export function LandingFooter() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <footer className="landing-footer" style={{
      position: 'relative', zIndex: 5,
      maxWidth: '1240px', margin: 'clamp(60px, 8vw, 100px) auto 0',
      padding: '30px clamp(20px, 5vw, 64px) 46px',
      borderTop: '1px solid rgba(97,71,130,0.07)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: '20px', flexWrap: 'wrap',
    }}>
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '16px',
        color: 'var(--c-text2)', textDecoration: 'none',
      }}>
        <span style={{
          width: '26px', height: '26px', borderRadius: '8px',
          background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 4.5 L5.5 19.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 4.5 L18.5 19.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="4.5" r="2.2" fill="#FFFFFF"/>
            <circle cx="5.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
            <circle cx="18.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
          </svg>
        </span>
        Aether
      </Link>

      {isAuthenticated ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <Link href="/dashboard" style={{ fontSize: '14px', color: 'var(--c-text2)', textDecoration: 'none' }}>Mi espacio</Link>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
          <Link href="/login" style={{ fontSize: '14px', color: 'var(--c-text2)', textDecoration: 'none' }}>Entrar</Link>
          <Link href="/register" style={{ fontSize: '14px', color: 'var(--c-text2)', textDecoration: 'none' }}>Registrarse</Link>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px', flexWrap: 'wrap' }}>
        <Link href="/legal/terms"   style={{ fontSize: '12px', color: 'var(--c-text4)', textDecoration: 'none' }}>Términos</Link>
        <Link href="/legal/privacy" style={{ fontSize: '12px', color: 'var(--c-text4)', textDecoration: 'none' }}>Privacidad</Link>
        <Link href="/legal/aup"     style={{ fontSize: '12px', color: 'var(--c-text4)', textDecoration: 'none' }}>Uso aceptable</Link>
        <span style={{ fontSize: '12px', color: '#3D3830' }}>© 2026 Aether</span>
      </div>
    </footer>
  );
}
