'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { ArrowLeft } from 'lucide-react';
import { useT } from '@/lib/i18n';

export default function RegisterPage() {
  const t = useT();
  const router = useRouter();
  const { register, isLoading, error, isAuthenticated, isHydrated, clearError } = useAuthStore();

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [validationError, setValidationError] = useState('');

  // Redirigir si ya está autenticado (SOLO después de hidratar)
  useEffect(() => {
    if (isHydrated && isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, isHydrated, router]);

  // Limpiar error al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    clearError();

    // Validación de contraseñas
    if (password !== confirmPassword) {
      setValidationError(t.register_validation_passwords);
      return;
    }

    if (password.length < 8) {
      setValidationError(t.register_validation_password_short);
      return;
    }

    if (name.trim().length < 2) {
      setValidationError(t.register_validation_name_short);
      return;
    }

    await register(name.trim(), email.trim(), password);

    // Si el registro fue exitoso, el auto-login redirigirá automáticamente
  };

  const displayError = validationError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Back to Home Button */}
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.register_btn_back}</span>
        </Link>

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-normal mb-2">[ AETHER ]</h1>
          <p className="text-text-secondary text-sm">~/ Crear nueva cuenta</p>
          <div className="status-online mt-4">ONLINE</div>
        </div>

        {/* Register Form */}
        <div className="card-terminal">
          <h2 className="section-header">AUTH.REGISTER</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-sm text-text-secondary mb-2">
                NAME:
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="input-terminal"
                placeholder={t.register_placeholder_name}
                required
                disabled={isLoading}
                minLength={2}
                autoComplete="name"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-2">
                EMAIL:
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-terminal"
                placeholder="user@example.com"
                required
                disabled={isLoading}
                autoComplete="email"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm text-text-secondary mb-2">
                PASSWORD:
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input-terminal"
                placeholder={t.register_placeholder_password}
                required
                disabled={isLoading}
                minLength={8}
                autoComplete="new-password"
              />
              <p className="text-text-muted text-xs mt-1">{t.register_password_hint}</p>
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="confirmPassword" className="block text-sm text-text-secondary mb-2">
                CONFIRM PASSWORD:
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="input-terminal"
                placeholder={t.register_placeholder_confirm}
                required
                disabled={isLoading}
                autoComplete="new-password"
              />
            </div>

            {/* Error message */}
            {displayError && (
              <div className="bg-error/10 border border-error/50 rounded-terminal p-3">
                <p className="text-error text-sm">✗ {displayError}</p>
              </div>
            )}

            {/* Submit button */}
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading" />
                  CREATING ACCOUNT...
                </span>
              ) : (
                '[ → CREATE ACCOUNT ]'
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 pt-6 border-t border-border">
            <p className="text-text-secondary text-sm">
              {t.register_has_account}{' '}
              <Link href="/login" className="link-terminal">
                {t.register_link_signin}
              </Link>
            </p>
          </div>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center text-text-muted text-xs">
          <p>v0.1.0 | Event-sourced collaboration platform</p>
        </div>
      </div>
    </div>
  );
}
