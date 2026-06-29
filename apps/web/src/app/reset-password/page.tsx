'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

function EyeIcon({ open }: { open: boolean }) {
  return open ? (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
      <circle cx="12" cy="12" r="3"/>
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24"/>
      <line x1="1" y1="1" x2="23" y2="23"/>
    </svg>
  );
}

function PasswordField({
  id, label, value, onChange, showPw, onToggle, placeholder, disabled,
}: {
  id: string; label: string; value: string; onChange: (v: string) => void;
  showPw: boolean; onToggle: () => void; placeholder: string; disabled: boolean;
}) {
  return (
    <div style={{ marginBottom: '18px' }}>
      <label htmlFor={id} style={{
        display: 'block', fontFamily: MANROPE, fontSize: '12px', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.1em', color: '#9C9486', marginBottom: '8px',
      }}>
        {label}
      </label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          type={showPw ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="aether-field"
          placeholder={placeholder}
          disabled={disabled}
          style={{ paddingRight: '42px' }}
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggle}
          disabled={disabled}
          style={{
            position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
            background: 'none', border: 'none', cursor: 'pointer',
            color: '#615846', padding: '2px', display: 'flex', alignItems: 'center',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#615846')}
          aria-label={showPw ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        >
          <EyeIcon open={showPw} />
        </button>
      </div>
    </div>
  );
}

type Status = 'idle' | 'success' | 'error-no-token';

export default function ResetPasswordPage() {
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken]             = useState<string | null>(null);
  const [status, setStatus]           = useState<Status>('idle');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw]     = useState('');
  const [showNew, setShowNew]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState('');

  useEffect(() => {
    const t = searchParams.get('token');
    if (!t) setStatus('error-no-token');
    else setToken(t);
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 8) {
      setError('La contraseña debe tener al menos 8 caracteres');
      return;
    }
    if (newPassword !== confirmPw) {
      setError('Las contraseñas no coinciden');
      return;
    }
    if (!token) { setError('Token inválido'); return; }

    setIsLoading(true);
    try {
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await res.json();

      if (res.ok) {
        setStatus('success');
        setTimeout(() => router.push('/login'), 3000);
      } else {
        setError(
          data.error?.message ||
          (data.error?.code === 'TOKEN_EXPIRED'
            ? 'El enlace de recuperación ha expirado. Solicita uno nuevo.'
            : 'El enlace de recuperación es inválido o ya fue usado.'),
        );
      }
    } catch {
      setError('Error de conexión. Por favor inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Token ausente ──────────────────────────────────────────────────────── */
  if (status === 'error-no-token') {
    return (
      <div className="auth-layout" >
        <div className="auth-form-panel" >
          <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(255,80,80,0.08)', border: '1px solid rgba(255,80,80,0.25)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,100,100,0.9)" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '24px', letterSpacing: '-0.025em', color: '#F4EEE2', margin: '0 0 10px' }}>
              Enlace inválido
            </h1>
            <p style={{ fontFamily: MANROPE, fontSize: '14px', lineHeight: 1.65, color: '#9C9486', margin: '0 0 32px' }}>
              El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo desde la página de inicio de sesión.
            </p>
            <button
              onClick={() => router.push('/forgot-password')}
              style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: '#F2571E', color: '#1A0B03',
                fontFamily: SORA, fontWeight: 700, fontSize: '14px', cursor: 'pointer',
              }}
            >
              Solicitar nuevo enlace
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Éxito ──────────────────────────────────────────────────────────────── */
  if (status === 'success') {
    return (
      <div className="auth-layout" >
        <div className="auth-form-panel" >
          <div style={{ width: '100%', maxWidth: '400px', textAlign: 'center' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '50%',
              background: 'rgba(118,168,120,0.12)', border: '1px solid rgba(118,168,120,0.3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 24px',
            }}>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                <path d="M5 12l4 4 10-9" stroke="#76A878" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '24px', letterSpacing: '-0.025em', color: '#F4EEE2', margin: '0 0 10px' }}>
              ¡Contraseña actualizada!
            </h1>
            <p style={{ fontFamily: MANROPE, fontSize: '14px', lineHeight: 1.65, color: '#9C9486', margin: '0 0 24px' }}>
              Tu contraseña se actualizó correctamente. Ahora puedes iniciar sesión con tu nueva contraseña.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div style={{
                width: '14px', height: '14px', borderRadius: '50%',
                border: '2px solid rgba(155,148,134,0.5)',
                borderTopColor: '#9C9486',
                animation: 'spin 1s linear infinite',
              }} />
              <span style={{ fontFamily: MANROPE, fontSize: '13px', color: '#9C9486' }}>
                Redirigiendo a inicio de sesión…
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ── Formulario ─────────────────────────────────────────────────────────── */
  return (
    <div className="auth-layout" >
      <div className="auth-form-panel" >
        <div style={{ width: '100%', maxWidth: '400px' }}>

          {/* Back */}
          <Link href="/login" style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            fontFamily: MANROPE, fontSize: '13px', color: '#615846',
            textDecoration: 'none', marginBottom: '36px',
          }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = '#615846')}
          >
            ← Volver al inicio de sesión
          </Link>

          {/* Logo */}
          <Link href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', textDecoration: 'none', marginBottom: '28px' }}>
            <span style={{
              width: '34px', height: '34px', borderRadius: '10px',
              background: '#F2571E', display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px -4px rgba(242,87,30,0.6)',
            }}>
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
                <path d="M12 4.5L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
                <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
                <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
              </svg>
            </span>
            <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: '18px', color: '#ECE5D6', letterSpacing: '-0.015em' }}>Aether</span>
          </Link>

          {/* Header */}
          <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: '28px', letterSpacing: '-0.025em', color: '#F4EEE2', margin: '0 0 8px' }}>
            Nueva contraseña
          </h1>
          <p style={{ fontFamily: MANROPE, fontSize: '14px', color: '#9C9486', margin: '0 0 32px' }}>
            Elige una contraseña segura de al menos 8 caracteres.
          </p>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate>
            <PasswordField
              id="newPassword"
              label="Nueva contraseña"
              value={newPassword}
              onChange={setNewPassword}
              showPw={showNew}
              onToggle={() => setShowNew(v => !v)}
              placeholder="Mínimo 8 caracteres"
              disabled={isLoading}
            />

            <PasswordField
              id="confirmPassword"
              label="Confirmar contraseña"
              value={confirmPw}
              onChange={setConfirmPw}
              showPw={showConfirm}
              onToggle={() => setShowConfirm(v => !v)}
              placeholder="Repite tu contraseña"
              disabled={isLoading}
            />

            {error && (
              <div style={{
                background: 'rgba(255,80,80,0.07)', border: '1px solid rgba(255,80,80,0.25)',
                borderRadius: '8px', padding: '11px 14px', marginBottom: '20px',
              }}>
                <p style={{ fontFamily: MANROPE, fontSize: '13px', color: 'rgba(255,100,100,0.9)', margin: 0 }}>
                  {error}
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              style={{
                width: '100%', padding: '13px', borderRadius: '9px', border: 'none',
                background: isLoading ? 'rgba(242,87,30,0.6)' : '#F2571E',
                color: '#1A0B03', fontFamily: SORA, fontWeight: 700, fontSize: '14px',
                cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'filter 0.15s',
              }}
              onMouseEnter={e => { if (!isLoading) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.filter = 'none')}
            >
              {isLoading ? 'Actualizando…' : 'Actualizar contraseña'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
