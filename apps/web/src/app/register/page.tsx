'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

type TouchedFields = {
  name: boolean;
  email: boolean;
  password: boolean;
  confirmPassword: boolean;
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
    <p
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
        fontSize: '12px',
        color: 'rgba(255,100,100,0.9)',
        marginTop: '6px',
      }}
    >
      {message}
    </p>
  );
}

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, isHydrated, clearError, pendingEmailVerification, clearPendingVerification } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [touched, setTouched] = useState<TouchedFields>({
    name: false,
    email: false,
    password: false,
    confirmPassword: false,
  });

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isHydrated, router]);

  useEffect(() => {
    if (pendingEmailVerification) {
      clearPendingVerification();
      router.push(`/verify-email/pending?email=${encodeURIComponent(pendingEmailVerification)}`);
    }
  }, [pendingEmailVerification, clearPendingVerification, router]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, password, confirmPassword]);

  function validateName(value: string): string {
    if (!value.trim()) return t.register_validation_name_required;
    if (value.trim().length < 2) return t.register_validation_name_short;
    return '';
  }

  function validateEmail(value: string): string {
    if (!value.trim()) return t.register_validation_email_required;
    if (!EMAIL_REGEX.test(value.trim())) return t.register_validation_email_invalid;
    return '';
  }

  function validatePassword(value: string): string {
    if (!value) return t.register_validation_password_required;
    if (value.length < 8) return t.register_validation_password_short;
    return '';
  }

  function validateConfirm(value: string, pwd: string): string {
    if (!value) return t.register_validation_confirm_required;
    if (value !== pwd) return t.register_validation_passwords;
    return '';
  }

  function handleBlur(field: keyof TouchedFields) {
    setTouched((prev) => ({ ...prev, [field]: true }));
    validateField(field);
  }

  function validateField(field: keyof TouchedFields) {
    setErrors((prev) => {
      switch (field) {
        case 'name':
          return { ...prev, name: validateName(name) };
        case 'email':
          return { ...prev, email: validateEmail(email) };
        case 'password':
          return {
            ...prev,
            password: validatePassword(password),
            confirmPassword: touched.confirmPassword
              ? validateConfirm(confirmPassword, password)
              : prev.confirmPassword,
          };
        case 'confirmPassword':
          return { ...prev, confirmPassword: validateConfirm(confirmPassword, password) };
        default:
          return prev;
      }
    });
  }

  function handleNameChange(value: string) {
    setName(value);
    if (touched.name) setErrors((prev) => ({ ...prev, name: validateName(value) }));
  }

  function handleEmailChange(value: string) {
    setEmail(value);
    if (touched.email) setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (touched.password) {
      setErrors((prev) => ({
        ...prev,
        password: validatePassword(value),
        confirmPassword: touched.confirmPassword
          ? validateConfirm(confirmPassword, value)
          : prev.confirmPassword,
      }));
    }
  }

  function handleConfirmChange(value: string) {
    setConfirmPassword(value);
    if (touched.confirmPassword) {
      setErrors((prev) => ({ ...prev, confirmPassword: validateConfirm(value, password) }));
    }
  }

  function validateAll(): boolean {
    const newErrors: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirm(confirmPassword, password),
    };
    setErrors(newErrors);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    return !Object.values(newErrors).some(Boolean);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateAll()) return;
    await register(name.trim(), email.trim(), password);
    const { isAuthenticated: authenticated } = useAuthStore.getState();
    if (authenticated) router.push('/dashboard');
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
          ← Volver
        </Link>

        {/* Logo + título */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
            <LogoIcon />
            <span
              style={{
                fontFamily: FONT,
                fontWeight: 500,
                fontSize: '16px',
                color: '#f0f6ff',
                letterSpacing: '-0.01em',
              }}
            >
              Aether
            </span>
          </div>
          <h1
            style={{
              fontFamily: FONT,
              fontWeight: 300,
              fontSize: '26px',
              color: '#f0f6ff',
              letterSpacing: '-0.02em',
              margin: '0 0 8px 0',
            }}
          >
            Crear cuenta
          </h1>
          <p
            style={{
              fontFamily: FONT,
              fontSize: '14px',
              fontWeight: 300,
              color: 'rgba(180,210,255,0.5)',
              margin: 0,
            }}
          >
            Empieza a colaborar con tu equipo hoy.
          </p>
        </div>

        {/* Formulario */}
        <div className="hud-panel" style={{ padding: '28px 24px' }}>
          <form onSubmit={handleSubmit} noValidate>

            {/* Nombre */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="name"
                style={{ display: 'block', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)', marginBottom: '8px' }}
              >
                {t.register_label_name}
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => handleBlur('name')}
                className={`auth-input${touched.name && errors.name ? ' auth-input--error' : ''}`}
                placeholder={t.register_placeholder_name}
                disabled={isLoading}
                autoComplete="name"
              />
              {touched.name && errors.name && <FieldError message={errors.name} />}
            </div>

            {/* Email */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="email"
                style={{ display: 'block', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)', marginBottom: '8px' }}
              >
                {t.register_label_email}
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`auth-input${touched.email && errors.email ? ' auth-input--error' : ''}`}
                placeholder="usuario@ejemplo.com"
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && errors.email && <FieldError message={errors.email} />}
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: '20px' }}>
              <label
                htmlFor="password"
                style={{ display: 'block', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)', marginBottom: '8px' }}
              >
                {t.register_label_password}
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`auth-input${touched.password && errors.password ? ' auth-input--error' : ''}`}
                placeholder={t.register_placeholder_password}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.password && errors.password ? (
                <FieldError message={errors.password} />
              ) : (
                <p style={{ fontFamily: FONT, fontSize: '11px', color: 'rgba(180,210,255,0.3)', marginTop: '6px' }}>
                  {t.register_password_hint}
                </p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div style={{ marginBottom: '28px' }}>
              <label
                htmlFor="confirmPassword"
                style={{ display: 'block', fontFamily: MONO, fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'rgba(180,210,255,0.5)', marginBottom: '8px' }}
              >
                {t.register_label_confirm}
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`auth-input${touched.confirmPassword && errors.confirmPassword ? ' auth-input--error' : ''}`}
                placeholder={t.register_placeholder_confirm}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <FieldError message={errors.confirmPassword} />
              )}
            </div>

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
              {isLoading ? t.register_btn_submitting : t.register_btn_submit}
            </button>
          </form>

          {/* Divider + login link */}
          <div
            style={{
              marginTop: '24px',
              paddingTop: '20px',
              borderTop: '1px solid rgba(56,182,255,0.08)',
              textAlign: 'center',
            }}
          >
            <span style={{ fontFamily: FONT, fontSize: '13px', color: 'rgba(180,210,255,0.4)' }}>
              {t.register_has_account}{' '}
            </span>
            <Link
              href="/login"
              style={{
                fontFamily: FONT,
                fontSize: '13px',
                color: '#38b6ff',
                textDecoration: 'none',
                transition: 'opacity 0.2s',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              {t.register_link_signin}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
