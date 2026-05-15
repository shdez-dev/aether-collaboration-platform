'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Mail, RefreshCw, ArrowLeft, CheckCircle } from 'lucide-react';

function VerifyEmailPendingContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';

  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleResend = async () => {
    if (status === 'sending' || status === 'sent') return;
    setStatus('sending');
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

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
                {'>'} Luego inicia sesión normalmente
              </p>
            </div>

            {status === 'sent' ? (
              <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--c-success, #22c55e)' }}>
                <CheckCircle className="w-4 h-4" />
                <span>Email reenviado correctamente</span>
              </div>
            ) : (
              <button
                onClick={handleResend}
                disabled={status === 'sending'}
                className="btn-ghost w-full flex items-center justify-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${status === 'sending' ? 'animate-spin' : ''}`} />
                {status === 'sending' ? 'Enviando...' : 'Reenviar correo de verificación'}
              </button>
            )}

            {status === 'error' && (
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
