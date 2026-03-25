'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft } from 'lucide-react';
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

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, isHydrated, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [errors, setErrors] = useState<FieldErrors>({ email: '', password: '' });
  const [touched, setTouched] = useState<TouchedFields>({ email: false, password: false });

  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isHydrated, router]);

  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  // Limpiar error del store cuando el usuario empieza a escribir
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
    if (touched.email) {
      setErrors((prev) => ({ ...prev, email: validateEmail(value) }));
    }
  }

  function handlePasswordChange(value: string) {
    setPassword(value);
    if (touched.password) {
      setErrors((prev) => ({ ...prev, password: validatePassword(value) }));
    }
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

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Volver */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.login_btn_back}</span>
        </Link>

        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-2xl font-normal mb-2">[ AETHER ]</h1>
          <p className="text-text-secondary text-sm">~/ {t.login_subtitle}</p>
          <div className="status-online mt-4">ONLINE</div>
        </div>

        {/* Formulario */}
        <div className="card-terminal">
          <h2 className="section-header">AUTH.LOGIN</h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Correo electrónico */}
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-2">
                {t.login_label_email}:
              </label>
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={(e) => handleEmailChange(e.target.value)}
                onBlur={() => handleBlur('email')}
                className={`input-terminal ${touched.email && errors.email ? 'border-error focus:border-error' : ''}`}
                placeholder="usuario@ejemplo.com"
                disabled={isLoading}
                autoComplete="email"
              />
              {touched.email && errors.email && (
                <p className="text-error text-xs mt-1.5">✗ {errors.email}</p>
              )}
            </div>

            {/* Contraseña */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="password" className="block text-sm text-text-secondary">
                  {t.login_label_password}:
                </label>
                <Link
                  href="/forgot-password"
                  className="text-xs text-primary hover:text-primary-hover transition-colors"
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
                className={`input-terminal ${touched.password && errors.password ? 'border-error focus:border-error' : ''}`}
                placeholder="••••••••"
                disabled={isLoading}
                autoComplete="current-password"
              />
              {touched.password && errors.password && (
                <p className="text-error text-xs mt-1.5">✗ {errors.password}</p>
              )}
            </div>

            {/* Error del servidor */}
            {error && (
              <div className="bg-error/10 border border-error/50 rounded-terminal p-3">
                <p className="text-error text-sm">✗ {error}</p>
              </div>
            )}

            {/* Botón submit */}
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading" />
                  {t.login_btn_submitting}
                </span>
              ) : (
                `[ → ${t.login_btn_submit.toUpperCase()} ]`
              )}
            </button>
          </form>

          {/* Links footer */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-text-secondary text-sm">
              {t.login_no_account}{' '}
              <Link href="/register" className="link-terminal">
                {t.login_link_create}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-text-muted text-xs">
          <p>v0.1.0 | Plataforma de colaboración en tiempo real</p>
        </div>
      </div>
    </div>
  );
}
