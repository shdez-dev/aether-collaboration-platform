'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading, error, isAuthenticated, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // Redirigir si ya está autenticado
  useEffect(() => {
    if (isAuthenticated) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, router]);

  // Limpiar error al desmontar
  useEffect(() => {
    return () => clearError();
  }, [clearError]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    clearError();

    await login(email, password);

    // Si el login fue exitoso, el useEffect de arriba manejará la redirección
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-normal mb-2">[ AETHER ]</h1>
          <p className="text-text-secondary text-sm">
            ~/ Adaptive Event-driven Trusted Human-Environment
          </p>
          <div className="status-online mt-4">ONLINE</div>
        </div>

        {/* Login Form */}
        <div className="card-terminal">
          <h2 className="section-header">AUTH.LOGIN</h2>

          <form onSubmit={handleSubmit} className="space-y-4">
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
                placeholder="••••••••"
                required
                disabled={isLoading}
                autoComplete="current-password"
              />
            </div>

            {/* Error message */}
            {error && (
              <div className="bg-error/10 border border-error/50 rounded-terminal p-3">
                <p className="text-error text-sm">✗ {error}</p>
              </div>
            )}

            {/* Submit button */}
            <button type="submit" disabled={isLoading} className="btn-primary w-full">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading" />
                  AUTHENTICATING...
                </span>
              ) : (
                '[ → LOGIN ]'
              )}
            </button>
          </form>

          {/* Footer links */}
          <div className="mt-6 pt-6 border-t border-border space-y-2">
            <p className="text-text-secondary text-sm">
              ¿No tienes cuenta?{' '}
              <Link href="/register" className="link-terminal">
                Crear cuenta
              </Link>
            </p>
            <p className="text-text-muted text-xs">
              ¿Olvidaste tu contraseña?{' '}
              <Link href="/forgot-password" className="link-terminal">
                Recuperar
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
