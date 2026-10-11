'use client';

import { useState } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

function FieldError({ msg }: { msg: string }) {
  return (
    <p style={{ fontFamily: MANROPE, fontSize: '12px', color: 'rgba(255,100,100,0.9)', marginTop: '6px', marginBottom: 0 }}>
      {msg}
    </p>
  );
}

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail]         = useState('');
  const [emailErr, setEmailErr]   = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverErr, setServerErr] = useState('');

  function validate(v: string) {
    if (!v.trim()) return t.forgot_label_email + ' es requerido';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())) return 'Correo inválido';
    return '';
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const err = validate(email);
    setEmailErr(err);
    if (err) return;

    setServerErr('');
    setIsLoading(true);
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
      } else {
        setServerErr(data.error?.message || t.forgot_error_default);
      }
    } catch {
      setServerErr(t.forgot_error_network);
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Estado de éxito ───────────────────────────────────────────────────── */
  if (isSuccess) {
    return (
      <div className="auth-layout" >
        <div className="auth-form-panel" >
          <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>

            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(118,168,120,0.12)', border: '1px solid rgba(118,168,120,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-9" stroke="#548B73" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>

            <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '24px', letterSpacing: '-0.025em', color: 'var(--c-text)', margin: '0 0 10px' }}>
              {t.forgot_success_title}
            </h1>
            <p style={{ fontFamily: MANROPE, fontSize: '14px', lineHeight: 1.65, color: 'var(--c-text2)', margin: '0 0 32px' }}>
              {t.forgot_success_desc}
            </p>

            <button
              onClick={() => router.push('/login')}
              style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: '#7452A6', color: '#1A0B03',
                fontFamily: SORA, fontWeight: 700, fontSize: '14px', cursor: 'pointer',
                transition: 'filter 0.15s',
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = 'none')}
            >
              {t.login_btn_back_to_login}
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario ─────────────────────────────────────────────────────────── */
  return (
    <div className="auth-layout" >
      <div className="auth-form-panel" >
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Back */}
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-text4)',
            textDecoration: 'none', marginBottom: '36px',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text4)')}
          >
            ← {t.login_btn_back_to_login}
          </Link>

          {/* Logo */}
          <Link href="/" aria-label="AETHER, inicio" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '28px' }}>
            <span style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px -4px rgba(116,82,166,0.6)',
            }}>
              <BrandMark size={26} tone="light" />
            </span>
          </Link>

          {/* Header */}
          <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '28px', letterSpacing: '-0.025em', color: 'var(--c-text)', margin: '0 0 8px' }}>
            {t.forgot_title}
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: '14px', color: 'var(--c-text2)', margin: '0 0 32px' }}>
            {t.forgot_subtitle}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: '20px' }}>
              <label htmlFor="email" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.forgot_label_email}
              </label>
              <input
                id="email" name="email" type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setEmailErr(''); setServerErr(''); }}
                onBlur={() => setEmailErr(validate(email))}
                className={`aether-field${emailErr ? ' aether-field--error' : ''}`}
                placeholder={t.forgot_placeholder_email}
                disabled={isLoading}
                autoComplete="email"
              />
              {emailErr && <FieldError msg={emailErr} />}
            </div>

            {serverErr && (
              <div style={{
                background: 'rgba(255,80,80,0.07)', border: '1px solid rgba(255,80,80,0.25)',
                borderRadius: '8px', padding: '11px 14px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: MANROPE, fontSize: '13px', color: 'rgba(255,100,100,0.9)', margin: 0 }}>
                  {serverErr}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: isLoading ? 'rgba(116,82,166,0.6)' : '#7452A6',
                color: '#1A0B03', fontFamily: SORA, fontWeight: 700, fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'filter 0.15s',
              }}
              onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = 'none')}
            >
              {isLoading ? t.forgot_btn_submitting : t.forgot_btn_submit}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
