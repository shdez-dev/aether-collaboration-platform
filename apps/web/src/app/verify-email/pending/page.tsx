'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";
const POLL_INTERVAL_MS = 4000;

function AetherLogo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, background: '#F2571E',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 14px -4px rgba(242,87,30,0.5)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 4.5L5.5 19.5"  stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12"   cy="4.5"  r="2.2" fill="#F8F1E3"/>
          <circle cx="5.5"  cy="19.5" r="2.2" fill="#F8F1E3"/>
          <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
        </svg>
      </span>
      <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 16, color: '#ECE5D6', letterSpacing: '-0.015em' }}>
        Aether
      </span>
    </Link>
  );
}

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const { setAuth }  = useAuthStore();
  const email        = searchParams.get('email') || '';

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [verified, setVerified]         = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!email) return;
    const poll = async () => {
      try {
        const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/check-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();
        if (data.data?.verified && data.data?.accessToken) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setAuth(data.data.user, { accessToken: data.data.accessToken, refreshToken: data.data.refreshToken });
          setVerified(true);
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      } catch { /* silencioso */ }
    };
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [email, setAuth, router]);

  const handleResend = async () => {
    if (resendStatus === 'sending' || resendStatus === 'sent') return;
    setResendStatus('sending');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendStatus(res.ok ? 'sent' : 'error');
      if (res.ok) setTimeout(() => setResendStatus('idle'), 30000);
    } catch { setResendStatus('error'); }
  };

  const baseLayout = (children: React.ReactNode) => (
    <div style={{
      minHeight: '100vh', background: '#0D0F12',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)',
        width: 560, height: 420,
        background: 'radial-gradient(ellipse, rgba(242,87,30,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }}/>
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420 }}>
        {children}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── Verificado ─────────────────────────────────────────────────── */
  if (verified) {
    return baseLayout(
      <div style={{
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '48px 28px', textAlign: 'center',
      }}>
        <div style={{
          width: 52, height: 52, borderRadius: '50%', margin: '0 auto 24px',
          background: 'rgba(110,183,110,0.08)', border: '1px solid rgba(110,183,110,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M4 11l5 5 9-9" stroke="#6EB76E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
        <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 22, letterSpacing: '-0.02em', color: '#F4EEE2', margin: '0 0 10px' }}>
          ¡Email verificado!
        </h1>
        <p style={{ fontFamily: MANROPE, fontSize: 14, color: '#9C9486', margin: 0 }}>
          Ingresando al dashboard...
        </p>
      </div>
    );
  }

  /* ── Pendiente ──────────────────────────────────────────────────── */
  return baseLayout(
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <AetherLogo />
        <Link
          href="/login"
          style={{ fontFamily: MANROPE, fontSize: 13, color: '#615846', textDecoration: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#615846')}
        >
          ← Iniciar sesión
        </Link>
      </div>

      {/* Título */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 28, letterSpacing: '-0.025em', color: '#F4EEE2', margin: '0 0 8px' }}>
          Revisa tu correo
        </h1>
        <p style={{ fontFamily: MANROPE, fontSize: 14, color: '#9C9486', margin: 0, lineHeight: 1.6 }}>
          Te enviamos un enlace de verificación. Esta página avanzará sola cuando lo abras.
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 16, padding: '24px',
      }}>

        {/* Email */}
        <div style={{
          background: 'rgba(242,87,30,0.05)', border: '1px solid rgba(242,87,30,0.15)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 22,
        }}>
          <p style={{ fontFamily: MANROPE, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#615846', margin: '0 0 4px' }}>
            Enviado a
          </p>
          <p style={{ fontFamily: MANROPE, fontSize: 14, fontWeight: 600, color: '#C8BFAE', margin: 0, wordBreak: 'break-all' }}>
            {email || '—'}
          </p>
        </div>

        {/* Pasos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {[
            'Abre el correo de Aether en tu bandeja',
            'Haz clic en el botón "Verificar correo"',
            'Esta página avanzará automáticamente',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(242,87,30,0.1)', border: '1px solid rgba(242,87,30,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MANROPE, fontSize: 10, fontWeight: 700, color: '#F2571E',
              }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: MANROPE, fontSize: 13, color: '#9C9486', lineHeight: '20px' }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        {/* Indicador de espera */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          paddingBottom: 20, marginBottom: 20,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: 'spin 0.9s linear infinite', flexShrink: 0 }}>
            <circle cx="6" cy="6" r="4.5" stroke="rgba(242,87,30,0.15)" strokeWidth="1.5"/>
            <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" stroke="#F2571E" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={{ fontFamily: MANROPE, fontSize: 12, color: '#615846' }}>
            Esperando verificación...
          </span>
        </div>

        {/* Reenviar */}
        {resendStatus === 'sent' ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2.5 7l3 3 6-6" stroke="#6EB76E" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={{ fontFamily: MANROPE, fontSize: 13, color: 'rgba(110,183,110,0.8)' }}>
              Correo reenviado
            </span>
          </div>
        ) : (
          <button
            onClick={handleResend}
            disabled={resendStatus === 'sending'}
            style={{
              width: '100%', padding: '10px', borderRadius: 10, cursor: resendStatus === 'sending' ? 'not-allowed' : 'pointer',
              background: 'transparent', border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: MANROPE, fontSize: 13, color: '#9C9486',
              opacity: resendStatus === 'sending' ? 0.5 : 1,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              if (resendStatus !== 'sending') {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                (e.currentTarget as HTMLElement).style.color = '#C8BFAE';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
              (e.currentTarget as HTMLElement).style.color = '#9C9486';
            }}
          >
            {resendStatus === 'sending' ? 'Enviando...' : 'Reenviar correo de verificación'}
          </button>
        )}

        {resendStatus === 'error' && (
          <p style={{ fontFamily: MANROPE, fontSize: 12, color: 'rgba(255,100,100,0.8)', marginTop: 8, textAlign: 'center', marginBottom: 0 }}>
            Error al reenviar. Intenta de nuevo.
          </p>
        )}
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontFamily: MANROPE, fontSize: 13, color: '#615846', marginTop: 20 }}>
        ¿El correo es incorrecto?{' '}
        <Link
          href="/register"
          style={{ color: '#F2571E', textDecoration: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
        >
          Crear otra cuenta
        </Link>
      </p>
    </>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#0D0F12', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
          <circle cx="10" cy="10" r="7.5" stroke="rgba(242,87,30,0.15)" strokeWidth="2"/>
          <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" stroke="#F2571E" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
