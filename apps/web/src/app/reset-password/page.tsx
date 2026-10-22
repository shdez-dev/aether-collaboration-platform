'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowRight, Check, CheckCircle2, Circle, CircleAlert, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck } from 'lucide-react';
import { PasswordFlowShell } from '@/components/PasswordFlowShell';
import styles from '@/components/PasswordFlowFields.module.css';

type Status = 'idle' | 'success' | 'error-no-token';

function PasswordField({
  id,
  label,
  value,
  onChange,
  showPassword,
  onToggle,
  placeholder,
  disabled,
  describedBy,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  showPassword: boolean;
  onToggle: () => void;
  placeholder: string;
  disabled: boolean;
  describedBy?: string;
}) {
  return (
    <div className={styles.fieldGroup}>
      <div className={styles.labelRow}>
        <label className={styles.label} htmlFor={id}>{label}</label>
      </div>
      <div className={styles.inputWrap}>
        <LockKeyhole className={styles.inputIcon} size={17} aria-hidden="true" />
        <input
          id={id}
          name={id}
          type={showPassword ? 'text' : 'password'}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`aether-field ${styles.field} ${styles.fieldWithToggle}`}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="new-password"
          maxLength={128}
          aria-describedby={describedBy}
        />
        <button
          className={styles.togglePassword}
          type="button"
          onClick={onToggle}
          disabled={disabled}
          aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
          aria-pressed={showPassword}
        >
          {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );
}

function Requirement({ met, children }: { met: boolean; children: React.ReactNode }) {
  return <li className={styles.requirement} data-met={met ? 'true' : undefined}>{met ? <Check size={13} /> : <Circle size={13} />}{children}</li>;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [token, setToken] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const hasValidLength = newPassword.length >= 8 && newPassword.length <= 128;
  const hasLetter = /[A-Za-z]/.test(newPassword);
  const hasNumber = /\d/.test(newPassword);
  const passwordsMatch = confirmPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    const searchToken = searchParams.get('token');
    if (!searchToken) setStatus('error-no-token');
    else setToken(searchToken);
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');

    if (!hasValidLength) {
      setError('La contraseña debe tener entre 8 y 128 caracteres.');
      return;
    }
    if (!hasLetter || !hasNumber) {
      setError('Incluye al menos una letra y un número.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Las contraseñas no coinciden.');
      return;
    }
    if (!token) {
      setError('El enlace de recuperación no es válido. Solicita uno nuevo.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });
      const data = await response.json();

      if (response.ok) {
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

  if (status === 'error-no-token') {
    return (
      <PasswordFlowShell step={2} backHref="/forgot-password" backLabel="Solicitar otro enlace">
        <section className={`${styles.status} ${styles.statusError}`} aria-labelledby="invalid-link-title">
          <span className={styles.iconTile}><CircleAlert size={25} strokeWidth={1.8} /></span>
          <h1 className={styles.title} id="invalid-link-title">Enlace inválido</h1>
          <p className={styles.description}>El enlace de recuperación no es válido o ya expiró. Solicita uno nuevo para continuar.</p>
          <div className={styles.statusActions}>
            <Link className={styles.primaryButton} href="/forgot-password">Solicitar nuevo enlace<ArrowRight size={16} /></Link>
          </div>
        </section>
      </PasswordFlowShell>
    );
  }

  if (status === 'success') {
    return (
      <PasswordFlowShell step={2} backHref="/login" backLabel="Volver a iniciar sesión">
        <section className={`${styles.status} ${styles.statusSuccess}`} aria-labelledby="password-updated-title">
          <span className={styles.iconTile}><CheckCircle2 size={26} strokeWidth={1.8} /></span>
          <h1 className={styles.title} id="password-updated-title">¡Contraseña actualizada!</h1>
          <p className={styles.description}>Ya puedes iniciar sesión con tu nueva contraseña. También cerramos las sesiones que estaban abiertas.</p>
          <div className={styles.statusActions}>
            <Link className={styles.primaryButton} href="/login">Iniciar sesión<ArrowRight size={16} /></Link>
          </div>
        </section>
      </PasswordFlowShell>
    );
  }

  return (
    <PasswordFlowShell step={2} backHref="/login" backLabel="Volver a iniciar sesión">
      <section aria-labelledby="reset-title">
        <span className={styles.iconTile}><KeyRound size={22} strokeWidth={1.8} /></span>
        <h1 className={styles.title} id="reset-title">Nueva contraseña</h1>
        <p className={styles.description}>Crea una contraseña nueva para volver a tu cuenta.</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <PasswordField
              id="newPassword"
              label="Nueva contraseña"
              value={newPassword}
              onChange={value => { setNewPassword(value); setError(''); }}
              showPassword={showNew}
              onToggle={() => setShowNew(value => !value)}
              placeholder="Escribe una contraseña nueva"
              disabled={isLoading}
              describedBy="password-requirements"
            />
            <ul className={styles.requirements} id="password-requirements" aria-label="Requisitos de la contraseña">
              <Requirement met={hasValidLength}>Entre 8 y 128 caracteres</Requirement>
              <Requirement met={hasLetter}>Al menos una letra</Requirement>
              <Requirement met={hasNumber}>Al menos un número</Requirement>
            </ul>
          </div>

          <PasswordField
            id="confirmPassword"
            label="Confirmar contraseña"
            value={confirmPassword}
            onChange={value => { setConfirmPassword(value); setError(''); }}
            showPassword={showConfirm}
            onToggle={() => setShowConfirm(value => !value)}
            placeholder="Vuelve a escribirla"
            disabled={isLoading}
          />

          {confirmPassword.length > 0 && <ul className={styles.requirements} aria-live="polite"><Requirement met={passwordsMatch}>Las contraseñas coinciden</Requirement></ul>}

          {error && <div className={styles.alert} role="alert"><CircleAlert size={17} /><span>{error}</span></div>}

          <button className={styles.primaryButton} type="submit" disabled={isLoading}>
            {isLoading ? <><span className={styles.spinner} aria-hidden="true" />Actualizando contraseña…</> : <>Guardar nueva contraseña<ArrowRight size={16} /> </>}
          </button>
        </form>

        <p className={styles.helper}><ShieldCheck size={15} /><span>Al guardar, se cerrarán las sesiones abiertas en otros dispositivos.</span></p>
      </section>
    </PasswordFlowShell>
  );
}
