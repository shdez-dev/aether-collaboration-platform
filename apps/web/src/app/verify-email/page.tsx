'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONO = 'JetBrains Mono, monospace';

function LogoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 220 220" fill="none" aria-hidden>
      <path d="M110 39L32 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M110 39L188 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
      <path d="M66 122L154 122" stroke="#00e5cc" strokeWidth="7" strokeLinecap="round" />
      <circle cx="110" cy="39" r="9" fill="#38b6ff" />
      <circle cx="32" cy="173" r="9" fill="#38b6ff" />
      <circle cx="188" cy="173" r="9" fill="#00e5cc" />
    </svg>
  );
}

function GlowBg() {
  return (
    <div style={{
      position: 'absolute', top: '20%', left: '50%',
      transform: 'translateX(-50%)', width: '600px', height: '500px',
      background: 'radial-gradient(ellipse, rgba(56,182,255,0.05) 0%, transparent 65%)',
      filter: 'blur(40px)', pointerEvents: 'none',
    }} />
  );
}

function StatusIcon({ type }: { type: 'loading' | 'success' | 'error' }) {
  const configs = {
    loading: { bg: 'rgba(56,182,255,0.08)', border: 'rgba(56,182,255,0.25)' },
    success: { bg: 'rgba(0,229,204,0.08)', border: 'rgba(0,229,204,0.3)' },
    error:   { bg: 'rgba(255,80,80,0.08)', border: 'rgba(255,80,80,0.3)' },
  };
  const c = configs[type];

  return (
    <div style={{
      width: '56px', height: '56px', borderRadius: '50%',
      background: c.bg, border: `1px solid ${c.border}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      margin: '0 auto 24px',
    }}>
      {type === 'loading' && (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="11" cy="11" r="8" stroke="rgba(56,182,255,0.2)" strokeWidth="2" />
          <path d="M11 3a8 8 0 0 1 8 8" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
      )}
      {type === 'success' && (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M4 11l5 5 9-9" stroke="#00e5cc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )}
      {type === 'error' && (
        <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
          <path d="M6 6l10 10M16 6L6 16" stroke="rgba(255,100,100,0.9)" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setStatus('error');
      setErrorMessage('Token de verificación no encontrado');
      return;
    }
    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        if (data.data?.accessToken && data.data?.user) {
          setAuth(data.data.user, {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          });
        }
        setTimeout(() => router.push('/dashboard'), 2000);
      } else {
        setStatus('error');
        setErrorMessage(
          data.error?.message ||
            (data.error?.code === 'TOKEN_EXPIRED'
              ? 'Token de verificación expirado'
              : 'Token de verificación inválido')
        );
      }
    } catch {
      setStatus('error');
      setErrorMessage('Error al verificar el email');
    }
  };

  return (
    <div style={{
      minHeight: '100vh', background: '#080c14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      <GlowBg />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>

        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
          <LogoIcon />
          <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: '16px', color: '#f0f6ff', letterSpacing: '-0.01em' }}>
            Aether
          </span>
        </div>

        <div className="hud-panel" style={{ padding: '36px 28px', textAlign: 'center' }}>
          <StatusIcon type={status} />

          {status === 'loading' && (
            <>
              <h1 style={{ fontFamily: FONT, fontWeight: 300, fontSize: '22px', color: '#f0f6ff', letterSpacing: '-0.02em', margin: '0 0 10px 0' }}>
                Verificando tu correo...
              </h1>
              <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: 0 }}>
                Por favor espera un momento.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <h1 style={{ fontFamily: FONT, fontWeight: 300, fontSize: '22px', color: '#f0f6ff', letterSpacing: '-0.02em', margin: '0 0 10px 0' }}>
                Correo verificado
              </h1>
              <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: '0 0 20px 0' }}>
                Tu cuenta está lista. Ingresando a Aether...
              </p>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(0,229,204,0.6)' }}>
                  Redirigiendo al dashboard
                </span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <h1 style={{ fontFamily: FONT, fontWeight: 300, fontSize: '22px', color: '#f0f6ff', letterSpacing: '-0.02em', margin: '0 0 10px 0' }}>
                Error al verificar
              </h1>
              <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: '0 0 28px 0' }}>
                {errorMessage}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <button
                  onClick={() => router.push('/login')}
                  className="landing-btn-primary"
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', border: 'none', cursor: 'pointer' }}
                >
                  Ir a iniciar sesión
                </button>
                <button
                  onClick={() => router.push('/verify-email/pending')}
                  className="landing-btn-secondary"
                  style={{ width: '100%', justifyContent: 'center', padding: '10px', cursor: 'pointer', background: 'none' }}
                >
                  Reenviar correo de verificación
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
