'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { email: string; password: string };
type TouchedFields = { email: boolean; password: boolean };

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const BRAND_AVATARS = [
  { bg: '#4B607F', t: 'M' },
  { bg: '#76A878', t: 'D' },
  { bg: '#DB8A66', t: 'S' },
  { bg: '#8C7C9E', t: 'A' },
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
  const { login, isLoading, error, isAuthenticated, isHydrated, clearError, emailNotVerified } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({ email: '', password: '' });
  const [touched, setTouched] = useState<TouchedFields>({ email: false, password: false });

  useEffect(() => {
    if (isHydrated && isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, isHydrated, router]);

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
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: '#F2571E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 14px -4px rgba(242,87,30,0.6)',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5 L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 4.5 L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            </svg>
          </span>
          <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: '18px', color: '#ECE5D6', letterSpacing: '-0.015em' }}>Aether</span>
        </Link>

        <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: '60px' }}>
          <h2 style={{
            fontFamily: SORA, fontWeight: 700,
            fontSize: 'clamp(1.9rem, 2.6vw, 2.5rem)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            color: '#F4EEE2', margin: '0 0 18px',
          }}>
            Tu equipo te espera{' '}
            <span style={{ background: '#F2571E', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              justo donde lo dejaste.
            </span>
          </h2>
          <p style={{ fontFamily: MANROPE, fontSize: '15px', lineHeight: 1.65, color: '#9C9486', margin: '0', maxWidth: '320px' }}>
            Tareas, notas, documentos y conversaciones. Todo en el mismo sitio, siempre sincronizado.
          </p>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '32px' }}>
            {['Tableros', 'Documentos', 'Equipo'].map(tag => (
              <span key={tag} style={{
                fontFamily: MANROPE, fontSize: '13px', fontWeight: 500,
                color: '#CFC6B5', background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
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
          <span style={{ fontFamily: MANROPE, fontSize: '12px', color: '#615846', lineHeight: 1.4 }}>
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
            fontFamily: MANROPE, fontSize: '13px', color: '#615846',
            textDecoration: 'none', marginBottom: '36px',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#615846')}
          >
            ← Volver al inicio
          </Link>

          {/* Header */}
          <h1 style={{
            fontFamily: SORA, fontWeight: 700, fontSize: '28px',
            letterSpacing: '-0.025em', color: '#F4EEE2', margin: '0 0 8px',
          }}>
            {t.login_title}
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: '14px', color: '#9C9486', margin: '0 0 32px' }}>
            {t.login_welcome_subtitle}
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ marginBottom: '18px' }}>
              <label htmlFor="email" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9C9486', marginBottom: '8px',
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
                  textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9C9486',
                }}>
                  {t.login_label_password}
                </label>
                <Link href="/forgot-password" style={{
                  fontFamily: MANROPE, fontSize: '12px', color: '#615846', textDecoration: 'none',
                }}
                  onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
                  onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#615846')}
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
                background: 'rgba(242,87,30,0.07)', border: '1px solid rgba(242,87,30,0.2)',
                borderRadius: '8px', padding: '12px 14px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: MANROPE, fontSize: '13px', color: '#CFC6B5', margin: '0 0 8px' }}>
                  Debes verificar tu correo electrónico antes de iniciar sesión.
                </p>
                <Link
                  href={`/verify-email/pending?email=${encodeURIComponent(emailNotVerified)}`}
                  style={{ fontFamily: MANROPE, fontSize: '12px', color: '#F2571E', textDecoration: 'none' }}
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
                background: '#F2571E', color: '#24180A', border: 'none',
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
            borderTop: '1px solid rgba(255,255,255,0.06)',
            textAlign: 'center',
          }}>
            <span style={{ fontFamily: MANROPE, fontSize: '13px', color: '#615846' }}>
              {t.login_no_account}{' '}
            </span>
            <Link href="/register" style={{ fontFamily: MANROPE, fontSize: '13px', color: '#F2571E', textDecoration: 'none' }}
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
