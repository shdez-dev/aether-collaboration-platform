'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { BrandMark } from '@/components/brand/BrandMark';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';
import styles from './page.module.css';

type Preview = { email: string; organizationName?: string; expiresAt: string; type: 'PLATFORM' | 'ORGANIZATION' };

export default function JoinPage() {
  const token = useSearchParams().get('token') ?? '';
  const router = useRouter();
  const { isAuthenticated, isHydrated, login, logout, error: loginError } = useAuthStore();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [termsRead, setTermsRead] = useState(false);
  const [privacyRead, setPrivacyRead] = useState(false);
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (!/^[a-f0-9]{64}$/i.test(token)) { setLoading(false); return; }
    let active = true;
    apiService.get<{ invitation: Preview }>(`/api/auth/invitations/${token}`, false)
      .then((response) => {
        if (active && response.success && response.data?.invitation) setPreview(response.data.invitation);
      })
      .catch(() => { if (active) setError('No pudimos consultar la invitación. Inténtalo de nuevo.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [token]);

  useEffect(() => {
    if (!isHydrated || !isAuthenticated || !preview) return;
    if (preview.type === 'ORGANIZATION') router.replace(`/organization-invitation?token=${encodeURIComponent(token)}`);
    else if (registered) router.replace('/dashboard');
  }, [isHydrated, isAuthenticated, preview, registered, router, token]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview || submitting) return;
    if (name.trim().length < 2) { setError('Escribe tu nombre completo.'); return; }
    if (password.length < 8 || password.length > 128 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('La contraseña debe tener entre 8 y 128 caracteres, al menos una letra y un número.'); return;
    }
    if (password !== confirmPassword) { setError('Las contraseñas no coinciden.'); return; }
    if (!termsRead || !privacyRead) { setError('Confirma por separado la lectura de los términos y la política de privacidad.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const response = await apiService.post<{ user: { id: string } }>('/api/auth/join', {
        email: preview.email, name: name.trim(), password, invitationToken: token, termsRead, privacyRead,
      }, false);
      if (!response.success) {
        setError(response.error?.message ?? 'No fue posible activar la cuenta.');
        return;
      }
      setRegistered(true);
      await login(preview.email, password);
      if (!useAuthStore.getState().isAuthenticated) {
        setError(useAuthStore.getState().error ?? loginError ?? (preview.type === 'PLATFORM' ? 'Cuenta creada. Inicia sesión para continuar.' : 'Cuenta creada. Inicia sesión para aceptar la invitación.'));
      }
    } catch {
      setError('No pudimos activar tu cuenta. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  const signInUrl = `/login?next=${encodeURIComponent(`/organization-invitation?token=${token}`)}`;
  return <div className={styles.page}>
    <main className={styles.card}>
      <Link href="/" className={styles.brand}><BrandMark size={34} tone="light" /><span>AETHER</span></Link>
      <span className={styles.eyebrow}>ACCESO AL PILOTO</span>
      <h1>Tu invitación a AETHER</h1>
      {loading ? <p role="status">Consultando invitación…</p> : preview ? <>
        <p className={styles.intro}>{preview.type === 'PLATFORM' ? <>Te invitamos a entrar a <strong>AETHER</strong>.</> : <>Te invitaron a colaborar en <strong>{preview.organizationName}</strong>.</>} Este acceso es exclusivo para <strong>{preview.email}</strong> y vence el {new Date(preview.expiresAt).toLocaleDateString('es-CL')}.</p>
        <div className={styles.notice}><strong>Estás entrando a un piloto.</strong><span>Las funciones pueden cambiar y podrías encontrar interrupciones o errores. Evita usarlo como único lugar para información crítica y comunícanos cualquier problema.</span></div>
        {registered && !isAuthenticated ? <div className={styles.notice} role="status"><strong>Tu cuenta ya está creada.</strong><span>{error || 'Inicia sesión para continuar en Aether.'}</span><Link href="/login">Ir a iniciar sesión</Link></div> : isHydrated && isAuthenticated && preview.type === 'PLATFORM' && !registered ? <div className={styles.notice}><strong>Ya hay una sesión abierta.</strong><span>Cierra sesión para crear la cuenta con el correo invitado.</span><button type="button" onClick={() => void logout()}>Cerrar sesión</button></div> : <form onSubmit={submit} className={styles.form}>
          <label>Tu nombre<input required minLength={2} maxLength={255} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} /></label>
          <label>Contraseña<input required type="password" minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /><small>8 caracteres como mínimo, con una letra y un número.</small></label>
          <label>Confirmar contraseña<input required type="password" minLength={8} autoComplete="new-password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
          <div className={styles.consent}><input id="join-terms-read" type="checkbox" required checked={termsRead} onChange={(event) => setTermsRead(event.target.checked)} /><label htmlFor="join-terms-read">He leído los Términos de servicio y el aviso sobre este piloto.</label><a href="/legal/terms">Leer términos</a></div>
          <div className={styles.consent}><input id="join-privacy-read" type="checkbox" required checked={privacyRead} onChange={(event) => setPrivacyRead(event.target.checked)} /><label htmlFor="join-privacy-read">He leído la Política de privacidad.</label><a href="/legal/privacy">Leer política</a></div>
          {error && <p role="alert" className={styles.error}>{error}</p>}
          <button type="submit" disabled={submitting || !termsRead || !privacyRead}>{submitting ? 'Activando acceso…' : 'Activar mi cuenta'}</button>
        </form>}
        <p className={styles.footer}>{preview.type === 'PLATFORM' ? <>¿Ya activaste tu cuenta? <Link href="/login">Inicia sesión</Link>.</> : <>¿Ya tienes cuenta? <Link href={signInUrl}>Inicia sesión para aceptar la invitación</Link>.</>}</p>
      </> : <><p role="alert" className={styles.error}>{error || 'La invitación no existe, venció o fue cancelada. Pide un nuevo enlace a quien te invitó.'}</p><Link href="/login">Volver al inicio de sesión</Link></>}
    </main>
  </div>;
}
