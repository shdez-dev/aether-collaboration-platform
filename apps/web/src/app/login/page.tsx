'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  email: string;
  password: string;
};

type TouchedFields = {
  email: boolean;
  password: boolean;
};

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

function FieldError({ message }: { message: string }) {
  return (
    <p style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif', fontSize: '12px', color: 'rgba(255,100,100,0.9)', marginTop: '6px' }}>
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

  // Redirigir automáticamente a la pantalla de verificación si el correo no está confirmado
  useEffect(() => {
    if (emailNotVerified) {
      router.push(`/verify-email/pending?email=${encodeURIComponent(emailNotVerified)}`);
    }
  }, [emailNotVerified, router]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  function validateEmail(value: string): string {
    if (!value.trim()) return t.login_validation_email_required;
    if (!EMAIL_REGEX.test(value.trim())) return t.login_validation_email_invalid;
    return '';
  }

  function validatePassword(value: string): string {
    if (!value) return t.login_validation_password_required;
    return '';
  }

  function handleBlur(field: keyof TouchedFields) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    if (field === 'email') {
      setErrors((prev) => ({ ...prev, email: validateEmail(email) }));
    } else {
      setErrors((prev) => ({ ...prev, password: validatePassword(password) }));
    }
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (touched.email) setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (touched.password) setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
  }

  function validateAll(): boolean {
    const newErrors: FieldErrors = {
      email: validateEmail(email),
      password: validatePassword(password),
    };
    setErrors(newErrors);
    setTouched({ email: true, password: true });
    return !Object.values(newErrors).some(Boolean);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateAll()) return;
    await login(email, password);
  };

  const FONT = '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif';
  const MONO = 'JetBrains Mono, monospace';

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
      {/* Glow ambiente */}
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

      <div style={{ position: 'relative', zIndex: 10, width: '100%', maxWidth: '420px' }}>

        {/* Back link */}
        <Link
          href="/"
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
          ← {t.login_btn_back}
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
            {t.login_title}
          </h1>
          <p style={{ fontFamily: FONT, fontSize: '14px', fontWeight: 300, color: 'rgba(180,210,255,0.5)', margin: 0 }}>
            {t.login_welcome_subtitle}
          </p>
        </div>

        {/* Formulario */}
        <div className="hud-panel" style={{ padding: '28px 24px' }}>
          <form onSubmit={handleSubmit} noValidate>

            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)', marginBottom: '8px' }}
              >
                {t.login_label_email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`auth-input${touched.email && errors.email ? ' auth-input--error' : ''}`}
                placeholder={t.login_placeholder_email}
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && errors.email && <FieldError message={errors.email} />}
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <label
                  htmlFor="password"
                  style={{ fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)' }}
                >
                  {t.login_label_password}
                </label>
                <Link
                  href="/forgot-password"
                  style={{ fontFamily: FONT, fontSize: '12px', color: 'rgba(56,182,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#38b6ff')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(56,182,255,0.6)')}
                >
                  {t.login_forgot_password}
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`auth-input${touched.password && errors.password ? ' auth-input--error' : ''}`}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
              {touched.password && errors.password && <FieldError message={errors.password} />}
            </div>

            {/* Email no verificado */}
            {emailNotVerified && (
              <div
                style={{
                  background: 'rgba(56,182,255,0.06)',
                  border: '1px solid rgba(56,182,255,0.25)',
                  borderRadius: '6px',
                  padding: '12px 14px',
                  marginBottom: '20px',
                }}
              >
                <p style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.8)', margin: '0 0 8px 0' }}>
                  Debes verificar tu correo electrónico antes de iniciar sesión.
                </p>
                <Link
                  href={`/verify-email/pending?email=${encodeURIComponent(emailNotVerified)}`}
                  style={{ fontFamily: FONT, fontSize: '12px', color: '#38b6ff', textDecoration: 'none' }}
                >
                  Reenviar correo de verificación →
                </Link>
              </div>
            )}

            {/* Error del servidor */}
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

            {/* Submit */}
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
              {isLoading ? t.login_btn_submitting : t.login_btn_submit}
            </button>
          </form>

          {/* Link a registro */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(56,182,255,0.08)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.4)' }}>
              {t.login_no_account}{' '}
            </span>
            <Link
              href="/register"
              style={{ fontFamily: FONT, fontSize: '13px', color: '#38b6ff', textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              {t.login_link_create}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
