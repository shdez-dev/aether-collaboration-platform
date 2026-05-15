'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

export default function VerifyEmailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');

    if (!token) {
      setStatus('error');
      setErrorMessage('Token de verificación no encontrado');
      return;
    }

    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token: string) => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/verify-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token }),
      });

      const data = await response.json();

      if (response.ok) {
        setStatus('success');
        // Auto-login con los tokens devueltos y redirigir al dashboard
        if (data.data?.accessToken && data.data?.user) {
          setAuth(data.data.user, {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          });
        }
        setTimeout(() => {
          router.push('/dashboard');
        }, 2000);
      } else {
        setStatus('error');
        setErrorMessage(
          data.error?.message ||
            (data.error?.code === 'TOKEN_EXPIRED'
              ? 'Token de verificación expirado'
              : 'Token de verificación inválido')
        );
      }
    } catch (error) {
      setStatus('error');
      setErrorMessage('Error al verificar el email');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 px-4">
      <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
        <div className="flex flex-col items-center text-center">
          {status === 'loading' && (
            <>
              <Loader2 className="w-16 h-16 text-indigo-600 dark:text-indigo-400 animate-spin mb-4" />
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Verificando tu email...
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Por favor espera mientras verificamos tu dirección de correo electrónico.
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
                <CheckCircle className="w-10 h-10 text-green-600 dark:text-green-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Email verificado exitosamente
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Tu dirección de correo ha sido verificada. Ingresando a Aether...
              </p>
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Redirigiendo al dashboard...</span>
              </div>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mb-4">
                <XCircle className="w-10 h-10 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Error al verificar email
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mb-6">{errorMessage}</p>
              <div className="flex flex-col gap-3 w-full">
                <button
                  onClick={() => router.push('/login')}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  Ir a Iniciar Sesión
                </button>
                <button
                  onClick={() => router.push('/verify-email/pending')}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
                >
                  <Mail className="w-4 h-4" />
                  Reenviar correo de verificación
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
