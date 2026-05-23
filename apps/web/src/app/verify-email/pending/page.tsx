'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
const MONO = 'JetBrains Mono, monospace';
const POLL_INTERVAL_MS = 4000;

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

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const email = searchParams.get('email') || '';

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [verified, setVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!email) return;

    const poll = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/check-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (data.data?.verified && data.data?.accessToken) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setAuth(data.data.user, {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          });
          setVerified(true);
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      } catch {
        // Silencioso — seguirá intentando
      }
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
    } catch {
      setResendStatus('error');
    }
  };

  /* ── Verificado ─────────────────────────────────────────────────── */
  if (verified) {
    return (
      <div style={{
        minHeight: '100vh', background: '#080c14',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '2rem', position: 'relative', overflow: 'hidden',
      }}>
        <GlowBg />
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>
          <div className="hud-panel" style={{ padding: '40px 28px', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(0,229,204,0.08)', border: '1px solid rgba(0,229,204,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px',
            }}>
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 11l5 5 9-9" stroke="#00e5cc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <h1 style={{ fontFamily: FONT, fontWeight: 300, fontSize: '22px', color: '#f0f6ff', letterSpacing: '-0.02em', margin: '0 0 10px 0' }}>
              ¡Email verificado!
            </h1>
            <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: 0 }}>
              Ingresando al dashboard...
            </p>
          </div>
        </div>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  /* ── Pendiente ──────────────────────────────────────────────────── */
  return (
    <div style={{
      minHeight: '100vh', background: '#080c14',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '2rem', position: 'relative', overflow: 'hidden',
    }}>
      <GlowBg />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>

        {/* Back */}
        <Link
          href="/login"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.45)',
            textDecoration: 'none', marginBottom: '32px', transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.85)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.45)')}
        >
          ← Volver a iniciar sesión
        </Link>

        {/* Logo + título */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <LogoIcon />
            <span style={{ fontFamily: FONT, fontWeight: 500, fontSize: '16px', color: '#f0f6ff', letterSpacing: '-0.01em' }}>
              Aether
            </span>
          </div>
          <h1 style={{ fontFamily: FONT, fontWeight: 300, fontSize: '26px', color: '#f0f6ff', letterSpacing: '-0.02em', margin: '0 0 8px 0' }}>
            Revisa tu correo
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: 0 }}>
            Te enviamos un enlace de verificación.
          </p>
        </div>

        {/* Card */}
        <div className="hud-panel" style={{ padding: '28px 24px' }}>

          {/* Email destacado */}
          <div style={{
            background: 'rgba(56,182,255,0.05)', border: '1px solid rgba(56,182,255,0.15)',
            borderRadius: '6px', padding: '12px 14px', marginBottom: '24px',
          }}>
            <div style={{ fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.4)', marginBottom: '4px' }}>
              Enviado a
            </div>
            <div style={{ fontFamily: MONO, fontSize: '13px', color: '#38b6ff' }}>
              {email || '—'}
            </div>
          </div>

          {/* Pasos */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '24px' }}>
            {[
              'Abre el correo de Aether',
              'Haz clic en "Verificar correo"',
              'Esta página avanzará automáticamente',
            ].map((step, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                <span style={{
                  fontFamily: MONO, fontSize: '10px', color: 'rgba(56,182,255,0.5)',
                  minWidth: '16px', lineHeight: '20px',
                }}>
                  {i + 1}.
                </span>
                <span style={{ fontFamily: FONT, fontSize: '13px', fontWeight: 300, color: 'rgba(180,210,255,0.6)', lineHeight: '20px' }}>
                  {step}
                </span>
              </div>
            ))}
          </div>

          {/* Indicador de espera */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            paddingBottom: '20px', marginBottom: '20px',
            borderBottom: '1px solid rgba(56,182,255,0.08)',
          }}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" style={{ animation: 'spin 1s linear infinite', flexShrink: 0 }}>
              <circle cx="6" cy="6" r="4.5" stroke="rgba(56,182,255,0.2)" strokeWidth="1.5" />
              <path d="M6 1.5a4.5 4.5 0 0 1 4.5 4.5" stroke="#38b6ff" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'rgba(180,210,255,0.35)' }}>
              Esperando verificación...
            </span>
          </div>

          {/* Reenviar */}
          {resendStatus === 'sent' ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7l3 3 6-6" stroke="#00e5cc" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(0,229,204,0.7)' }}>
                Correo reenviado
              </span>
            </div>
          ) : (
            <button
              onClick={handleResend}
              disabled={resendStatus === 'sending'}
              style={{
                width: '100%', background: 'none', border: '1px solid rgba(56,182,255,0.2)',
                borderRadius: '6px', padding: '10px', cursor: resendStatus === 'sending' ? 'not-allowed' : 'pointer',
                fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.5)',
                transition: 'border-color 0.2s, color 0.2s',
                opacity: resendStatus === 'sending' ? 0.6 : 1,
              }}
              onMouseEnter={(e) => {
                if (resendStatus !== 'sending') {
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.45)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.8)';
                }
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.2)';
                (e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.5)';
              }}
            >
              {resendStatus === 'sending' ? 'Enviando...' : 'Reenviar correo de verificación'}
            </button>
          )}

          {resendStatus === 'error' && (
            <p style={{ fontFamily: FONT, fontSize: '12px', color: 'rgba(255,100,100,0.8)', marginTop: '8px', textAlign: 'center' }}>
              Error al reenviar. Intenta de nuevo.
            </p>
          )}
        </div>

        {/* Footer */}
        <p style={{ textAlign: 'center', fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.3)', marginTop: '20px' }}>
          ¿El correo es incorrecto?{' '}
          <Link
            href="/register"
            style={{ color: '#38b6ff', textDecoration: 'none' }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            Crear otra cuenta
          </Link>
        </p>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={
      <div style={{ minHeight: '100vh', background: '#080c14', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="10" cy="10" r="7.5" stroke="rgba(56,182,255,0.2)" strokeWidth="2" />
          <path d="M10 2.5a7.5 7.5 0 0 1 7.5 7.5" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    }>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
