'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, CheckCircle2, CircleAlert, Mail, ShieldCheck } from 'lucide-react';
import { PasswordFlowShell } from '@/components/PasswordFlowShell';
import styles from '@/components/PasswordFlowFields.module.css';
import { useT } from '@/lib/i18n';

function FieldError({ msg }: { msg: string }) {
  return <p className={styles.errorText} id="email-error" role="alert">{msg}</p>;
}

export default function ForgotPasswordPage() {
  const t = useT();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [emailErr, setEmailErr] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [serverErr, setServerErr] = useState('');

  function validate(value: string) {
    if (!value.trim()) return `${t.forgot_label_email} es requerido`;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) return 'Correo inválido';
    return '';
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const validationError = validate(email);
    setEmailErr(validationError);
    if (validationError) return;

    setServerErr('');
    setIsLoading(true);
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await response.json();
      if (response.ok) setIsSuccess(true);
      else setServerErr(data.error?.message || t.forgot_error_default);
    } catch {
      setServerErr(t.forgot_error_network);
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <PasswordFlowShell step={1} backHref="/login" backLabel={t.login_btn_back_to_login}>
        <section className={`${styles.status} ${styles.statusSuccess}`} aria-labelledby="recovery-sent-title">
          <span className={styles.iconTile}><CheckCircle2 size={25} strokeWidth={1.8} /></span>
          <h1 className={styles.title} id="recovery-sent-title">{t.forgot_success_title}</h1>
          <p className={styles.description}>{t.forgot_success_desc}</p>
          <div className={styles.statusActions}>
            <button className={styles.primaryButton} type="button" onClick={() => router.push('/login')}>
              {t.login_btn_back_to_login}<ArrowRight size={16} />
            </button>
          </div>
        </section>
      </PasswordFlowShell>
    );
  }

  return (
    <PasswordFlowShell step={1} backHref="/login" backLabel={t.login_btn_back_to_login}>
      <section aria-labelledby="forgot-title">
        <span className={styles.iconTile}><Mail size={22} strokeWidth={1.8} /></span>
        <h1 className={styles.title} id="forgot-title">{t.forgot_title}</h1>
        <p className={styles.description}>{t.forgot_subtitle}</p>

        <form className={styles.form} onSubmit={handleSubmit} noValidate>
          <div className={styles.fieldGroup}>
            <div className={styles.labelRow}>
              <label className={styles.label} htmlFor="email">{t.forgot_label_email}</label>
              <span className={styles.labelHint}>Te enviaremos un enlace</span>
            </div>
            <div className={styles.inputWrap}>
              <Mail className={styles.inputIcon} size={17} aria-hidden="true" />
              <input
                id="email"
                name="email"
                type="email"
                value={email}
                onChange={event => { setEmail(event.target.value); setEmailErr(''); setServerErr(''); }}
                onBlur={() => setEmailErr(validate(email))}
                className={`aether-field ${styles.field}`}
                placeholder={t.forgot_placeholder_email}
                disabled={isLoading}
                autoComplete="email"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={Boolean(emailErr)}
                aria-describedby={emailErr ? 'email-error' : undefined}
              />
            </div>
            {emailErr && <FieldError msg={emailErr} />}
          </div>

          {serverErr && <div className={styles.alert} role="alert"><CircleAlert size={17} /><span>{serverErr}</span></div>}

          <button className={styles.primaryButton} type="submit" disabled={isLoading}>
            {isLoading ? <><span className={styles.spinner} aria-hidden="true" />{t.forgot_btn_submitting}</> : <>{t.forgot_btn_submit}<ArrowRight size={16} /></>}
          </button>
        </form>

        <p className={styles.helper}><ShieldCheck size={15} /><span>Si existe una cuenta asociada, recibirás las instrucciones en ese correo.</span></p>
      </section>
    </PasswordFlowShell>
  );
}
