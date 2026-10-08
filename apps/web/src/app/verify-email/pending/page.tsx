'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

function AetherLogo() {
  return (
    <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
      <span style={{
        width: 30, height: 30, borderRadius: 8, background: '#7452A6',
        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
        boxShadow: '0 4px 14px -4px rgba(116,82,166,0.5)',
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 4.5L5.5 19.5"  stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M12 4.5L18.5 19.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12"   cy="4.5"  r="2.2" fill="#FFFFFF"/>
          <circle cx="5.5"  cy="19.5" r="2.2" fill="#FFFFFF"/>
          <circle cx="18.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
        </svg>
      </span>
      <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: 16, color: 'var(--c-text)', letterSpacing: '-0.015em' }}>
        Aether
      </span>
    </Link>
  );
}

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const email        = searchParams.get('email') || '';
  const initialDeliveryFailed = searchParams.get('delivery') === 'failed';

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

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
      minHeight: '100vh', background: 'var(--c-bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: '25%', left: '50%', transform: 'translateX(-50%)',
        width: 560, height: 420,
        background: 'radial-gradient(ellipse, rgba(116,82,166,0.05) 0%, transparent 65%)',
        pointerEvents: 'none',
      }}/>
      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: 420 }}>
        {children}
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  /* ── Pendiente ──────────────────────────────────────────────────── */
  return baseLayout(
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 36 }}>
        <AetherLogo />
        <Link
          href="/login"
          style={{ fontFamily: MANROPE, fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text4)')}
        >
          ← Iniciar sesión
        </Link>
      </div>

      {/* Título */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 28, letterSpacing: '-0.025em', color: 'var(--c-text)', margin: '0 0 8px' }}>
          Revisa tu correo
        </h1>
        <p style={{ fontFamily: MANROPE, fontSize: 14, color: 'var(--c-text2)', margin: 0, lineHeight: 1.6 }}>
          {initialDeliveryFailed
            ? 'Tu cuenta se creó, pero no pudimos confirmar el envío inicial. Prueba con el botón de reenviar.'
            : 'Te enviamos un enlace de verificación. Ábrelo para activar tu cuenta e iniciar sesión.'}
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'rgba(97,71,130,0.025)', border: '1px solid rgba(97,71,130,0.08)',
        borderRadius: 16, padding: '24px',
      }}>

        {/* Email */}
        <div style={{
          background: 'rgba(116,82,166,0.05)', border: '1px solid rgba(116,82,166,0.15)',
          borderRadius: 10, padding: '12px 14px', marginBottom: 22,
        }}>
          <p style={{ fontFamily: MANROPE, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text4)', margin: '0 0 4px' }}>
            {initialDeliveryFailed ? 'Cuenta creada para' : 'Enviado a'}
          </p>
          <p style={{ fontFamily: MANROPE, fontSize: 14, fontWeight: 600, color: 'var(--c-text2)', margin: 0, wordBreak: 'break-all' }}>
            {email || '—'}
          </p>
        </div>

        {/* Pasos */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 22 }}>
          {[
            'Abre el correo de Aether en tu bandeja',
            'Haz clic en el botón "Verificar correo"',
            'En la página del enlace entrarás a tu cuenta',
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span style={{
                width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                background: 'rgba(116,82,166,0.1)', border: '1px solid rgba(116,82,166,0.2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: MANROPE, fontSize: 10, fontWeight: 700, color: 'var(--c-accent-text)',
              }}>
                {i + 1}
              </span>
              <span style={{ fontFamily: MANROPE, fontSize: 13, color: 'var(--c-text2)', lineHeight: '20px' }}>
                {step}
              </span>
            </div>
          ))}
        </div>

        <p style={{ paddingBottom: 20, marginBottom: 20, borderBottom: '1px solid rgba(97,71,130,0.06)', fontFamily: MANROPE, fontSize: 12, color: 'var(--c-text2)' }}>
          ¿Ya verificaste desde otra pestaña? <Link href="/login" style={{ color: 'var(--c-accent-text)' }}>Inicia sesión aquí</Link>.
        </p>

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
              background: 'transparent', border: '1px solid rgba(97,71,130,0.1)',
              fontFamily: MANROPE, fontSize: 13, color: 'var(--c-text2)',
              opacity: resendStatus === 'sending' ? 0.5 : 1,
              transition: 'border-color 0.2s, color 0.2s',
            }}
            onMouseEnter={e => {
              if (resendStatus !== 'sending') {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.2)';
                (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)';
              }
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.1)';
              (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)';
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
      <p style={{ textAlign: 'center', fontFamily: MANROPE, fontSize: 13, color: 'var(--c-text4)', marginTop: 20 }}>
        ¿El correo es incorrecto?{' '}
        <Link
          href="/register"
          style={{ color: 'var(--c-accent-text)', textDecoration: 'none' }}
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
      <div style={{ minHeight: '100vh', background: 'var(--c-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 0.9s linear infinite' }}>
          <circle cx="10" cy="10" r="7.5" stroke="rgba(116,82,166,0.15)" strokeWidth="2"/>
          <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" stroke="#7452A6" strokeWidth="2" strokeLinecap="round"/>
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
