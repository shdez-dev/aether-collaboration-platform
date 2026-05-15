'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, RefreshCw, ArrowLeft, CheckCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

const POLL_INTERVAL_MS = 4000;

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const email = searchParams.get('email') || '';

  const [resendStatus, setResendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [verified, setVerified] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Polling: cada 4 segundos comprueba si el email ya fue verificado
  useEffect(() => {
    if (!email) return;

    const poll = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/check-verification`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const data = await res.json();

        if (data.data?.verified && data.data?.accessToken) {
          // Detener polling
          if (intervalRef.current) clearInterval(intervalRef.current);

          // Auto-login con los tokens
          setAuth(data.data.user, {
            accessToken: data.data.accessToken,
            refreshToken: data.data.refreshToken,
          });

          setVerified(true);

          // Pequeña pausa para mostrar el mensaje de éxito
          setTimeout(() => router.push('/dashboard'), 1500);
        }
      } catch {
        // Silencioso — seguirá intentando
      }
    };

    // Primer check inmediato
    poll();
    intervalRef.current = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [email, setAuth, router]);

  const handleResend = async () => {
    if (resendStatus === 'sending' || resendStatus === 'sent') return;
    setResendStatus('sending');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setResendStatus(res.ok ? 'sent' : 'error');
      // Después de reenviar, resetear para poder reenviar de nuevo más tarde
      if (res.ok) setTimeout(() => setResendStatus('idle'), 30000);
    } catch {
      setResendStatus('error');
    }
  };

  if (verified) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="card-terminal">
            <div className="flex flex-col items-center text-center py-6 gap-4">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(34,197,94,0.15)' }}
              >
                <CheckCircle className="w-7 h-7" style={{ color: '#22c55e' }} />
              </div>
              <div>
                <p className="text-text-primary font-medium mb-1">¡Email verificado!</p>
                <p className="text-text-secondary text-sm">Ingresando al dashboard...</p>
              </div>
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver a Iniciar Sesión</span>
        </Link>

        <div className="mb-8">
          <h1 className="text-2xl font-normal mb-2">[ Aether ]</h1>
          <p className="text-text-secondary text-sm">~/ verify.email</p>
          <div className="status-online mt-4">PENDING</div>
        </div>

        <div className="card-terminal">
          <h2 className="section-header">EMAIL.VERIFICATION</h2>

          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center"
              style={{ background: 'var(--c-primary-alpha, rgba(99,102,241,0.15))' }}
            >
              <Mail className="w-7 h-7 text-primary" />
            </div>

            <div>
              <p className="text-text-primary font-medium mb-1">Revisa tu correo electrónico</p>
              <p className="text-text-secondary text-sm">
                Enviamos un enlace de verificación a{' '}
                <span className="text-primary font-mono">{email || 'tu correo'}</span>
              </p>
            </div>

            <div
              className="w-full rounded-terminal p-3 text-left"
              style={{ background: 'var(--c-bg2)', border: '1px solid var(--c-border)' }}
            >
              <p className="text-text-secondary text-xs font-mono leading-relaxed">
                {'>'} Abre el email de Aether
                <br />
                {'>'} Haz clic en "Verificar correo"
                <br />
                {'>'} Esta página te llevará al dashboard automáticamente
              </p>
            </div>

            {/* Indicador de espera activa */}
            <div className="flex items-center gap-2 text-text-muted text-xs">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Esperando verificación...</span>
            </div>

            {/* Botón de reenvío */}
            {resendStatus === 'sent' ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-success, #22c55e)' }}>
                <CheckCircle className="w-4 h-4" />
                <span>Email reenviado correctamente</span>
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={resendStatus === 'sending'}
                className="btn-ghost w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${resendStatus === 'sending' ? 'animate-spin' : ''}`} />
                {resendStatus === 'sending' ? 'Enviando...' : 'Reenviar correo de verificación'}
              </button>
            )}

            {resendStatus === 'error' && (
              <p className="text-error text-xs">✗ Error al reenviar. Intenta de nuevo.</p>
            )}
          </div>
        </div>

        <p className="text-center text-text-muted text-xs mt-6">
          ¿El correo es incorrecto?{' '}
          <Link href="/register" className="link-terminal">
            Crear otra cuenta
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPendingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><span className="loading" /></div>}>
      <VerifyEmailPendingContent />
    </Suspense>
  );
}
