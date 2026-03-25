'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft } from 'lucide-react';
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

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, isHydrated, clearError } = useAuthStore();

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
    return () => clearError();
  }, [clearError]);

  // Limpiar error del store cuando el usuario empieza a escribir
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
            // Revalidar confirmación si ya fue tocada
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
    if (touched.name) {
      setErrors((prev) => ({ ...prev, name: validateName(value) }));
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
    if (authenticated) {
      router.push('/dashboard');
    }
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
          <span>{t.register_btn_back}</span>
        </Link>

        {/* Encabezado */}
        <div className="mb-8">
          <h1 className="text-2xl font-normal mb-2">[ AETHER ]</h1>
          <p className="text-text-secondary text-sm">~/ Crear nueva cuenta</p>
          <div className="status-online mt-4">ONLINE</div>
        </div>

        {/* Formulario */}
        <div className="card-terminal">
          <h2 className="section-header">AUTH.REGISTER</h2>

          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            {/* Nombre */}
            <div>
              <label htmlFor="name" className="block text-sm text-text-secondary mb-2">
                {t.register_label_name}:
              </label>
              <input
                id="name"
                name="name"
                type="text"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={() => handleBlur('name')}
                className={`input-terminal ${touched.name && errors.name ? 'border-error focus:border-error' : ''}`}
                placeholder={t.register_placeholder_name}
                disabled={isLoading}
                autoComplete="name"
              />
              {touched.name && errors.name && (
                <p className="text-error text-xs mt-1.5">✗ {errors.name}</p>
              )}
            </div>

            {/* Correo electrónico */}
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-2">
                {t.register_label_email}:
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
              <label htmlFor="password" className="block text-sm text-text-secondary mb-2">
                {t.register_label_password}:
              </label>
              <input
                id="password"
                name="password"
                type="password"
                value={password}
                onChange={(e) => handlePasswordChange(e.target.value)}
                onBlur={() => handleBlur('password')}
                className={`input-terminal ${touched.password && errors.password ? 'border-error focus:border-error' : ''}`}
                placeholder={t.register_placeholder_password}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.password && errors.password ? (
                <p className="text-error text-xs mt-1.5">✗ {errors.password}</p>
              ) : (
                <p className="text-text-muted text-xs mt-1">{t.register_password_hint}</p>
              )}
            </div>

            {/* Confirmar contraseña */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-text-secondary mb-2">
                {t.register_label_confirm}:
              </label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => handleConfirmChange(e.target.value)}
                onBlur={() => handleBlur('confirmPassword')}
                className={`input-terminal ${touched.confirmPassword && errors.confirmPassword ? 'border-error focus:border-error' : ''}`}
                placeholder={t.register_placeholder_confirm}
                disabled={isLoading}
                autoComplete="new-password"
              />
              {touched.confirmPassword && errors.confirmPassword && (
                <p className="text-error text-xs mt-1.5">✗ {errors.confirmPassword}</p>
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
                  {t.register_btn_submitting}
                </span>
              ) : (
                `[ → ${t.register_btn_submit.toUpperCase()} ]`
              )}
            </button>
          </form>

          {/* Link a login */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-text-secondary text-sm">
              {t.register_has_account}{' '}
              <Link href="/login" className="link-terminal">
                {t.register_link_signin}
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
