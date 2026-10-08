'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useT } from '@/lib/i18n';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type FieldErrors = { name: string; email: string; password: string; confirmPassword: string };
type TouchedFields = { name: boolean; email: boolean; password: boolean; confirmPassword: boolean };

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

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, isHydrated, clearError, pendingEmailVerification, pendingEmailDeliveryFailed, clearPendingVerification } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({ name: '', email: '', password: '', confirmPassword: '' });
  const [touched, setTouched] = useState<TouchedFields>({ name: false, email: false, password: false, confirmPassword: false });

  useEffect(() => {
    if (isHydrated && isAuthenticated) router.push('/dashboard');
  }, [isAuthenticated, isHydrated, router]);

  useEffect(() => {
    if (pendingEmailVerification) {
      clearPendingVerification();
      router.push(`/verify-email/pending?email=${encodeURIComponent(pendingEmailVerification)}${pendingEmailDeliveryFailed ? '&delivery=failed' : ''}`);
    }
  }, [pendingEmailVerification, pendingEmailDeliveryFailed, clearPendingVerification, router]);

  useEffect(() => { return () => clearError(); }, [clearError]);

  useEffect(() => {
    if (error) clearError();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name, email, password, confirmPassword]);

  function validateName(v: string) {
    if (!v.trim()) return t.register_validation_name_required;
    if (v.trim().length < 2) return t.register_validation_name_short;
    return '';
  }
  function validateEmail(v: string) {
    if (!v.trim()) return t.register_validation_email_required;
    if (!EMAIL_REGEX.test(v.trim())) return t.register_validation_email_invalid;
    return '';
  }
  function validatePassword(v: string) {
    if (!v) return t.register_validation_password_required;
    if (v.length < 8) return t.register_validation_password_short;
    return '';
  }
  function validateConfirm(v: string, pwd: string) {
    if (!v) return t.register_validation_confirm_required;
    if (v !== pwd) return t.register_validation_passwords;
    return '';
  }

  function handleBlur(field: keyof TouchedFields) {
    setTouched(p => ({ ...p, [field]: true }));
    validateField(field);
  }

  function validateField(field: keyof TouchedFields) {
    setErrors(prev => {
      switch (field) {
        case 'name': return { ...prev, name: validateName(name) };
        case 'email': return { ...prev, email: validateEmail(email) };
        case 'password': return {
          ...prev,
          password: validatePassword(password),
          confirmPassword: touched.confirmPassword ? validateConfirm(confirmPassword, password) : prev.confirmPassword,
        };
        case 'confirmPassword': return { ...prev, confirmPassword: validateConfirm(confirmPassword, password) };
        default: return prev;
      }
    });
  }

  function handleNameChange(v: string) {
    setName(v);
    if (touched.name) setErrors(p => ({ ...p, name: validateName(v) }));
  }
  function handleEmailChange(v: string) {
    setEmail(v);
    if (touched.email) setErrors(p => ({ ...p, email: validateEmail(v) }));
  }
  function handlePasswordChange(v: string) {
    setPassword(v);
    if (touched.password) setErrors(p => ({
      ...p,
      password: validatePassword(v),
      confirmPassword: touched.confirmPassword ? validateConfirm(confirmPassword, v) : p.confirmPassword,
    }));
  }
  function handleConfirmChange(v: string) {
    setConfirmPassword(v);
    if (touched.confirmPassword) setErrors(p => ({ ...p, confirmPassword: validateConfirm(v, password) }));
  }

  function validateAll() {
    const e: FieldErrors = {
      name: validateName(name),
      email: validateEmail(email),
      password: validatePassword(password),
      confirmPassword: validateConfirm(confirmPassword, password),
    };
    setErrors(e);
    setTouched({ name: true, email: true, password: true, confirmPassword: true });
    return !Object.values(e).some(Boolean);
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();
    if (!validateAll()) return;
    await register(name.trim(), email.trim(), password);
    const { isLoading, error: storeError } = useAuthStore.getState();
    if (!isLoading && !storeError) router.push('/login');
  };

  return (
    <div className="auth-layout">

      {/* ── Brand panel (hidden on mobile) ── */}
      <aside className="auth-brand">
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{
            width: '34px', height: '34px', borderRadius: '10px',
            background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 4px 14px -4px rgba(116,82,166,0.6)',
          }}>
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5 L5.5 19.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 4.5 L18.5 19.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#FFFFFF" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="4.5" r="2.2" fill="#FFFFFF"/>
              <circle cx="5.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
              <circle cx="18.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
            </svg>
          </span>
          <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: '18px', color: 'var(--c-text)', letterSpacing: '-0.015em' }}>Aether</span>
        </Link>

        <div style={{ marginTop: 'auto', marginBottom: 'auto', paddingTop: '60px' }}>
          <h2 style={{
            fontFamily: SORA, fontWeight: 700,
            fontSize: 'clamp(1.9rem, 2.6vw, 2.5rem)',
            letterSpacing: '-0.03em', lineHeight: 1.1,
            color: 'var(--c-text)', margin: '0 0 18px',
          }}>
            Crea tu espacio{' '}
            <span style={{ background: '#7452A6', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              en segundos.
            </span>
          </h2>
          <p style={{ fontFamily: MANROPE, fontSize: '15px', lineHeight: 1.65, color: 'var(--c-text2)', margin: 0, maxWidth: '320px' }}>
            Sin configurar nada. Sin tutoriales. Abre, invita a tu equipo y empieza a trabajar.
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', marginTop: '32px' }}>
            {[
              { icon: '◈', label: 'Tableros Kanban para organizar tareas' },
              { icon: '◇', label: 'Documentos colaborativos en tiempo real' },
              { icon: '◉', label: 'Tu equipo siempre conectado' },
            ].map(item => (
              <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '14px', color: 'var(--c-accent-text)', flexShrink: 0 }}>{item.icon}</span>
                <span style={{ fontFamily: MANROPE, fontSize: '14px', color: 'var(--c-text2)' }}>{item.label}</span>
              </div>
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
            Únete a miles de equipos que ya trabajan con Aether
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
            ← Volver
          </Link>

          {/* Header */}
          <h1 style={{
            fontFamily: SORA, fontWeight: 700, fontSize: '28px',
            letterSpacing: '-0.025em', color: 'var(--c-text)', margin: '0 0 8px',
          }}>
            Crear cuenta
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: '14px', color: 'var(--c-text2)', margin: '0 0 32px' }}>
            Empieza a colaborar con tu equipo hoy.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>

            {/* Nombre */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="name" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.register_label_name}
              </label>
              <input
                id="name" name="name" type="text"
                value={name}
                onChange={e => handleNameChange(e.target.value)}
                onBlur={() => handleBlur('name')}
                className={`aether-field${touched.name && errors.name ? ' aether-field--error' : ''}`}
                placeholder={t.register_placeholder_name}
                disabled={isLoading}
                autoComplete="name"
              />
              {touched.name && errors.name && <FieldError message={errors.name} />}
            </div>

            {/* Email */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="email" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.register_label_email}
              </label>
              <input
                id="email" name="email" type="email"
                value={email}
                onChange={e => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`aether-field${touched.email && errors.email ? ' aether-field--error' : ''}`}
                placeholder="usuario@ejemplo.com"
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && errors.email && <FieldError message={errors.email} />}
            </div>

            {/* Contraseña */}
            <div style={{ marginBottom: '16px' }}>
              <label htmlFor="password" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.register_label_password}
              </label>
              <input
                id="password" name="password" type="password"
                value={password}
                onChange={e => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`aether-field${touched.password && errors.password ? ' aether-field--error' : ''}`}
                placeholder={t.register_placeholder_password}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.password && errors.password
                ? <FieldError message={errors.password} />
                : <p style={{ fontFamily: MANROPE, fontSize: '11px', color: 'var(--c-text4)', marginTop: '6px', marginBottom: 0 }}>
                    {t.register_password_hint}
                  </p>
              }
            </div>

            {/* Confirmar contraseña */}
            <div style={{ marginBottom: '28px' }}>
              <label htmlFor="confirmPassword" style={{
                display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--c-text2)', marginBottom: '8px',
              }}>
                {t.register_label_confirm}
              </label>
              <input
                id="confirmPassword" name="confirmPassword" type="password"
                value={confirmPassword}
                onChange={e => handleConfirmChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`aether-field${touched.confirmPassword && errors.confirmPassword ? ' aether-field--error' : ''}`}
                placeholder={t.register_placeholder_confirm}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.confirmPassword && errors.confirmPassword && <FieldError message={errors.confirmPassword} />}
            </div>

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
              {isLoading ? t.register_btn_submitting : t.register_btn_submit}
            </button>
          </form>

          {/* Login link */}
          <div style={{
            marginTop: '24px', paddingTop: '20px',
            borderTop: '1px solid rgba(97,71,130,0.06)',
            textAlign: 'center',
          }}>
            <span style={{ fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-text4)' }}>
              {t.register_has_account}{' '}
            </span>
            <Link href="/login" style={{ fontFamily: MANROPE, fontSize: '13px', color: 'var(--c-accent-text)', textDecoration: 'none' }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              {t.register_link_signin}
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
