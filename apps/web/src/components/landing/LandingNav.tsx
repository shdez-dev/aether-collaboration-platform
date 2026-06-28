'use client';

import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

export function LandingNav() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <nav style={{
      position: 'relative', zIndex: 20,
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px',
      maxWidth: '1320px', margin: '0 auto',
      padding: '22px clamp(20px, 5vw, 64px)',
    }}>
      <Link href="/" style={{
        display: 'flex', alignItems: 'center', gap: '11px',
        fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '20px',
        letterSpacing: '-0.01em', color: '#ECE5D6', textDecoration: 'none',
      }}>
        <span style={{
          width: '30px', height: '30px', borderRadius: '9px',
          background: '#F2571E', display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 6px 18px -6px rgba(242,87,30,0.8)', flexShrink: 0,
        }}>
          <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
            <path d="M12 4.5 L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 4.5 L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
          </svg>
        </span>
        Aether
      </Link>

      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        {isAuthenticated ? (
          <Link href="/dashboard" style={{
            padding: '11px 20px', borderRadius: '8px',
            background: '#F2571E', color: '#24180A',
            fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '15px',
            textDecoration: 'none',
          }}>
            Mi espacio
          </Link>
        ) : (
          <>
            <Link href="/login" className="landing-nav-login" style={{
              fontSize: '15px', color: '#9C9486', fontWeight: 500, textDecoration: 'none',
            }}>
              Entrar
            </Link>
            <Link href="/register" style={{
              padding: '11px 20px', borderRadius: '8px',
              background: '#F2571E', color: '#24180A',
              fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 600, fontSize: '15px',
              textDecoration: 'none',
            }}>
              Regístrate
            </Link>
          </>
        )}
      </div>
    </nav>
  );
}
