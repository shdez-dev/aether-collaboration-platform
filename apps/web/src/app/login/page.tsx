'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email: string; password: string };
type TouchedFields = { email: boolean; password: boolean };

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const BRAND_AVATARS = [
  { bg: '#8076A7', t: 'M' },
  { bg: '#548B73', t: 'D' },
  { bg: '#A97556', t: 'S' },
  { bg: '#8262B2', t: 'A' },
];

function FieldError({ message }: { message: string }) {
  return (
    <p style={{ fontFamily: MANROPE, fontSize: '12px', color: 'rgba(255,100,100,0.9)', marginTop: '6px', marginBottom: 0 }}>
      {message}
    </p>
  );
}

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const searchParams = useSearchParams();
  const requestedNext = searchParams.get('next');
  const nextPath = requestedNext?.startsWith('/') && !requestedNext.startsWith('//') ? requestedNext : '/dashboard';
  const { login, isLoading, error, isAuthenticated, isHydrated, clearError, emailNotVerified } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({ email: '', password: '' });
  const [touched, setTouched] = useState<TouchedFields>({ email: false, password: false });

  // Clear any stale emailNotVerified state when the login page mounts.
  // Without this, returning from /verify-email/pending would immediately
  // redirect back because the store value persists across navigation.
  useEffect(() => {
    clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isHydrated && isAuthenticated) router.push(nextPath);
  }, [isAuthenticated, isHydrated, nextPath, router]);

  // Only redirect to verify-email when emailNotVerified is set AFTER a login
  // attempt on this page (not from a previous session).
  useEffect(() => {
    if (emailNotVerified) {
      router.push(`/verify-email/pending?email=${encodeURIComponent(emailNotVerified)}`);
    }
  }, [emailNotVerified, router]);

  useEffect(() => { return () => clearError(); }, [clearError]);

  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  function validateEmail(v: string) {
    if (!v.trim()) return t.login_validation_email_required;
    if (!EMAIL_REGEX.test(v.trim())) return t.login_validation_email_invalid;
    return '';
  }
  function validatePassword(v: string) {
    if (!v) return t.login_validation_password_required;
    return '';
  }

  function handleBlur(field: keyof TouchedFields) {
    setTouched(p => ({ ...p, [field]: true }));
    if (field === 'email') setErrors(p => ({ ...p, email: validateEmail(email) }));
    else setErrors(p => ({ ...p, password: validatePassword(password) }));
  }

  function handleEmailChange(v: string) {
    setEmail(v);
    if (touched.email) setErrors(p => ({ ...p, email: validateEmail(v) }));
  }
  function handlePasswordChange(v: string) {
    setPassword(v);
    if (touched.password) setErrors(p => ({ ...p, password: validatePassword(v) }));
  }

  function validateAll() {
    const e: FieldErrors = { email: validateEmail(email), password: validatePassword(password) };
    setErrors(e);
    setTouched({ email: true, password: true });
    return !Object.values(e).some(Boolean);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateAll()) return;
    await login(email, password);
  };

  return (
    <div className="auth-layout">

      {/* ── Brand panel (hidden on mobile) ── */}
      <aside className="auth-brand">
        <Link href="/" aria-label="AETHER, inicio" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 14px -4px rgba(116,82,166,0.6)',
          }}>
            <BrandMark size={26} tone="light" />
          </span>
        </Link>

        <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: '60px' }}>
          <h2 style={{
            fontFamily: SORA, fontWeight: 700,
            fontSize: 'clamp(1.9rem, 2.6vw, 2.5rem)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            color: 'var(--c-text)', margin: '0 0 18px',
          }}>
            Tu equipo te espera{' '}
            <span style={{ background: '#7452A6', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              justo donde lo dejaste.
            </span>
          </h2>
          <p style={{ fontFamily: MANROPE, fontSize: '15px', lineHeight: 1.65, color: 'var(--c-text2)', margin: '0', maxWidth: '320px' }}>
            Tareas, notas, documentos y conversaciones. Todo en el mismo sitio, siempre sincronizado.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '32px' }}>
            {['Tableros', 'Documentos', 'Equipo'].map(tag => (
              <span key={tag} style={{
                fontFamily: MANROPE, fontSize: '13px', fontWeight: 500,
                color: 'var(--c-text2)', background: 'rgba(97,71,130,0.04)',
                border: '1px solid rgba(97,71,130,0.08)',
                padding: '7px 14px', borderRadius: '8px',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Avatars */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: 'auto', paddingTop: '40px' }}>
          <div style={{ display: 'flex' }}>
            {BRAND_AVATARS.map((av, i) => (
              <span key={i} style={{
                width: '32px', height: '32px', borderRadius: '50%',
                background: av.bg, border: '2px solid #0F1424',
                marginLeft: i > 0 ? '-9px' : 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '11px', fontWeight: 700, color: '#fff',
              }}>{av.t}</span>
            ))}
          </div>
          <span style={{ fontFamily: MANROPE, fontSize: '12px', color: 'var(--c-text4)', lineHeight: 1.4 }}>
            Miles de equipos ya organizan su trabajo con Aether
          </span>
        </div>
      </aside>

      {/* ── Form panel ── */}
      <main className="auth-form-panel">
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Back link */}
          <Link href="/" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-text4)',
            textDecoration: 'none', marginBottom: '36px',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text2)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text4)')}
          >
            ← Volver al inicio
          </Link>

          {/* Header */}
          <h1 style={{
            fontFamily: SORA, fontWeight: 700, fontSize: '28px',
            letterSpacing: '-0.025em', color: 'var(--c-text)', margin: '0 0 8px',
          }}>
            {t.login_title}
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: '14px', color: 'var(--c-text2)', margin: '0 0 32px' }}>
            {t.login_welcome_subtitle}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label htmlFor="email" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.login_label_email}
              </label>
              <input
                id="email" name="email" type="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`aether-field${touched.email && errors.email ? ' aether-field--error' : ''}`}
                placeholder={t.login_placeholder_email}
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && errors.email && <FieldError message={errors.email} />}
            </div>

            {/* Password */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label htmlFor="password" style={{
                  fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                  textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)',
                }}>
                  {t.login_label_password}
                </label>
                <Link href="/forgot-password" style={{
                  fontFamily: MANROPE, fontSize: '12px', color: 'var(--c-text4)', textDecoration: 'none',
                }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text2)')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text4)')}
                >
                  {t.login_forgot_password}
                </Link>
              </div>
              <input
                id="password" name="password" type="password"
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`aether-field${touched.password && errors.password ? ' aether-field--error' : ''}`}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
              {touched.password && errors.password && <FieldError message={errors.password} />}
            </div>

            {/* Email no verificado */}
            {emailNotVerified && (
              <div style={{
                background: 'rgba(116,82,166,0.07)', border: '1px solid rgba(116,82,166,0.2)',
                borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-text2)', margin: '0 0 8px' }}>
                  Debes verificar tu correo electrónico antes de iniciar sesión.
                </p>
                <Link
                  href={`/verify-email/pending?email=${encodeURIComponent(emailNotVerified)}`}
                  style={{ fontFamily: MANROPE, fontSize: '12px', color: 'var(--c-accent-text)', textDecoration: 'none' }}
                >
                  Reenviar correo de verificación →
                </Link>
              </div>
            )}

            {/* Server error */}
            {error && (
              <div style={{
                background: 'rgba(255,80,80,0.07)', border: '1px solid rgba(255,80,80,0.25)',
                borderRadius: '8px', padding: '10px 14px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: MANROPE, fontSize: '13px', color: 'rgba(255,110,110,0.9)', margin: 0 }}>
                  {error}
                </p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: '8px',
                background: '#7452A6', color: '#FFFFFF', border: 'none',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                fontFamily: SORA, fontWeight: 600, fontSize: '15px',
                opacity: isLoading ? 0.6 : 1,
              }}
            >
              {isLoading ? t.login_btn_submitting : t.login_btn_submit}
            </button>
          </form>

          {/* Register link */}
          <div style={{
            marginTop: '24px', paddingTop: '20px',
            borderTop: '1px solid rgba(97,71,130,0.06)',
            textAlign: 'center',
          }}>
            <span style={{ fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-text4)' }}>
              {t.login_no_account}{' '}
            </span>
            <Link href="/register" style={{ fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-accent-text)', textDecoration: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              {t.login_link_create}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
