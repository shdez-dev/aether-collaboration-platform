'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

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
    <div
      style={{
        position: 'absolute',
        top: '20%',
        left: '50%',
        transform: 'translateX(-50%)',
        width: '600px',
        height: '500px',
        background: 'radial-gradient(ellipse, rgba(56,182,255,0.05) 0%, transparent 65%)',
        filter: 'blur(40px)',
        pointerEvents: 'none',
      }}
    />
  );
}

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (response.ok) {
        setIsSuccess(true);
      } else {
        setError(data.error?.message || t.forgot_error_default);
      }
    } catch {
      setError(t.forgot_error_network);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Estado de éxito ─────────────────────────────────────────────── */
  if (isSuccess) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: '#080c14',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '2rem',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <GlowBg />
        <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>
          <div className="hud-panel" style={{ padding: '40px 32px', textAlign: 'center' }}>
            {/* Icono check */}
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '50%',
                background: 'rgba(0,229,204,0.08)',
                border: '1px solid rgba(0,229,204,0.3)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 24px',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M4 11l5 5 9-9" stroke="#00e5cc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>

            <h1
              style={{
                fontFamily: FONT,
                fontWeight: 300,
                fontSize: '22px',
                color: '#f0f6ff',
                letterSpacing: '-0.02em',
                margin: '0 0 10px 0',
              }}
            >
              {t.forgot_success_title}
            </h1>
            <p
              style={{
                fontFamily: FONT,
                fontSize: '14px',
                fontWeight: 300,
                lineHeight: 1.65,
                color: 'rgba(180,210,255,0.5)',
                margin: '0 0 32px 0',
              }}
            >
              {t.forgot_success_desc}
            </p>

            <button
              onClick={() => router.push('/login')}
              className="landing-btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '12px', border: 'none', cursor: 'pointer' }}
            >
              {t.login_btn_back_to_login}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario ──────────────────────────────────────────────────── */
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#080c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      <GlowBg />

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>

        {/* Back link */}
        <Link
          href="/login"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            fontFamily: FONT,
            fontSize: '13px',
            color: 'rgba(180,210,255,0.45)',
            textDecoration: 'none',
            marginBottom: '32px',
            transition: 'color 0.2s',
          }}
          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.85)')}
          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(180,210,255,0.45)')}
        >
          ← {t.login_btn_back_to_login}
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
            {t.forgot_title}
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: 0 }}>
            {t.forgot_subtitle}
          </p>
        </div>

        {/* Card */}
        <div className="hud-panel" style={{ padding: '28px 24px' }}>
          <form onSubmit={handleSubmit} noValidate>

            <div style={{ marginBottom: '28px' }}>
              <label
                htmlFor="email"
                style={{
                  display: 'block',
                  fontFamily: MONO,
                  fontSize: '10px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'rgba(180,210,255,0.5)',
                  marginBottom: '8px',
                }}
              >
                {t.forgot_label_email}
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="auth-input"
                placeholder={t.forgot_placeholder_email}
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {error && (
              <div
                style={{
                  background: 'rgba(255,80,80,0.07)',
                  border: '1px solid rgba(255,80,80,0.3)',
                  borderRadius: '6px',
                  padding: '10px 14px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(255,100,100,0.9)', margin: 0 }}>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="landing-btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                padding: '12px',
                fontSize: '14px',
                opacity: isLoading ? 0.6 : 1,
                cursor: isLoading ? 'not-allowed' : 'pointer',
                border: 'none',
              }}
            >
              {isLoading ? t.forgot_btn_submitting : t.forgot_btn_submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
