'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

function AetherLogo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none', marginBottom: 40 }}>
      <span style={{
        width: 32, height: 32, borderRadius: 9, background: '#F2571E',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 14px -4px rgba(242,87,30,0.5)',
      }}>
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
          <path d="M12 4.5L5.5 19.5"  stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12"  cy="4.5"  r="2.2" fill="#F8F1E3"/>
          <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
          <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
        </svg>
      </span>
      <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 17, color: '#ECE5D6', letterSpacing: '-0.015em' }}>
        Aether
      </span>
    </Link>
  );
}

function StatusCircle({ type }: { type: 'loading' | 'success' | 'error' }) {
  if (type === 'loading') return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%', margin: '0 auto 24px',
      background: 'rgba(242,87,30,0.08)', border: '1px solid rgba(242,87,30,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
        <circle cx="11" cy="11" r="8" stroke="rgba(242,87,30,0.15)" strokeWidth="2"/>
        <path d="M11 3a8 8 0 0 1 8 8" stroke="#F2571E" strokeWidth="2" strokeLinecap="round"/>
      </svg>
    </div>
  );

  if (type === 'success') return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%', margin: '0 auto 24px',
      background: 'rgba(110,183,110,0.08)', border: '1px solid rgba(110,183,110,0.3)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M4 11l5 5 9-9" stroke="#6EB76E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
  );

  return (
    <div style={{
      width: 52, height: 52, borderRadius: '50%', margin: '0 auto 24px',
      background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
        <path d="M6 6l10 10M16 6L6 16" stroke="rgba(255,100,100,0.9)" strokeWidth="1.8" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

export default function VerifyEmailPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const { setAuth }  = useAuthStore();
  const [status, setStatus]           = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const startedToken = useRef<string | null>(null);
  const token = searchParams.get('token');

  useEffect(() => {
    if (!token) { setStatus('error'); setErrorMessage('Token de verificación no encontrado'); return; }
    if (startedToken.current === token) return;
    startedToken.current = token;
    void verifyEmail(token);
  }, [token]);

  const verifyEmail = async (token: string) => {
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        if (data.data?.accessToken && data.data?.user) {
          setAuth(data.data.user, { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken });
        }
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setStatus('error');
        setErrorMessage(
          data.error?.code === 'TOKEN_EXPIRED'
            ? 'El enlace de verificación ha expirado'
            : data.error?.message || 'Enlace de verificación inválido'
        );
      }
    } catch {
      setStatus('error');
      setErrorMessage('No se pudo conectar con el servidor. Intenta de nuevo.');
    }
  };

  const titles = {
    loading: 'Verificando tu correo...',
    success: 'Correo verificado',
    error:   'No pudimos verificar',
  };
  const subtitles = {
    loading: 'Por favor espera un momento.',
    success: 'Tu cuenta está lista. Ingresando a Aether...',
    error:   errorMessage,
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#0D0F12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      {/* Glow sutil */}
      <div style={{
        position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)',
        width: 560, height: 420,
        background: 'radial-gradient(ellipse, rgba(242,87,30,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }}/>

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 400 }}>
        <AetherLogo />

        <div style={{
          background: 'rgba(255,255,255,0.025)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16, padding: '36px 28px', textAlign: 'center',
        }}>
          <StatusCircle type={status} />

          <h1 style={{
            fontFamily: SORA, fontWeight: 700, fontSize: 22,
            letterSpacing: '-0.02em', color: '#F4EEE2', margin: '0 0 10px',
          }}>
            {titles[status]}
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: 14, color: '#9C9486', margin: '0 0 24px', lineHeight: 1.6 }}>
            {subtitles[status]}
          </p>

          {status === 'success' && (
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(110,183,110,0.07)', border: '1px solid rgba(110,183,110,0.2)',
              borderRadius: 8, padding: '7px 14px',
            }}>
              <svg width="11" height="11" viewBox="0 0 11 11" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
                <circle cx="5.5" cy="5.5" r="4" stroke="rgba(110,183,110,0.2)" strokeWidth="1.5"/>
                <path d="M5.5 1.5a4 4 0 0 1 4 4" stroke="#6EB76E" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span style={{ fontFamily: MANROPE, fontSize: 12, color: 'rgba(110,183,110,0.8)' }}>
                Redirigiendo al dashboard
              </span>
            </div>
          )}

          {status === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <button
                onClick={() => router.push('/login')}
                style={{
                  width: '100%', padding: '11px', border: 'none', borderRadius: 10, cursor: 'pointer',
                  background: '#F2571E', fontFamily: MANROPE, fontWeight: 600, fontSize: 14, color: '#FEF3EE',
                  letterSpacing: '-0.01em',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#D94919')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#F2571E')}
              >
                Ir a iniciar sesión
              </button>
              <button
                onClick={() => router.push('/verify-email/pending')}
                style={{
                  width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
                  background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: MANROPE, fontSize: 14, color: '#9C9486',
                }}
                onMouseEnter={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                  (e.currentTarget as HTMLElement).style.color = '#C8BFAE';
                }}
                onMouseLeave={e => {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  (e.currentTarget as HTMLElement).style.color = '#9C9486';
                }}
              >
                Reenviar correo de verificación
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
