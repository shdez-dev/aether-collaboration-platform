import Link from 'next/link';
import { ArrowLeft, KeyRound, Mail, ShieldCheck } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import styles from './PasswordFlowShell.module.css';

type PasswordFlowShellProps = {
  children: React.ReactNode;
  step: 1 | 2;
  backHref: string;
  backLabel: string;
};

export function PasswordFlowShell({ children, step, backHref, backLabel }: PasswordFlowShellProps) {
  return (
    <main className={styles.shell}>
      <aside className={styles.story} aria-label="Recuperación de acceso">
        <Link className={styles.brand} href="/" aria-label="AETHER, inicio">
          <span className={styles.brandMark}><BrandMark size={28} tone="light" /></span>
          <span className={styles.brandName}>AETHER</span>
        </Link>

        <div className={styles.storyContent}>
          <div className={styles.journeyArt} aria-hidden="true">
            <span className={styles.journeyTrack} />
            <span className={styles.journeyNode}><Mail size={22} strokeWidth={1.8} /></span>
            <span className={styles.journeyNode}><KeyRound size={22} strokeWidth={1.8} /></span>
          </div>
          <h2 className={styles.storyTitle}>Vuelve a tus proyectos.</h2>
          <p className={styles.storyText}>Recupera el acceso a tu cuenta y continúa donde lo dejaste.</p>

          <div className={styles.steps} aria-label="Pasos para recuperar el acceso">
            <div className={styles.step} data-active={step === 1 ? 'true' : undefined} data-complete={step === 2 ? 'true' : undefined} aria-current={step === 1 ? 'step' : undefined}>
              <span className={styles.stepMark}>{step === 2 ? '✓' : '01'}</span>
              <span className={styles.stepCopy}><strong>Solicita el enlace</strong><small>Te lo enviaremos a tu correo.</small></span>
            </div>
            <div className={styles.step} data-active={step === 2 ? 'true' : undefined} aria-current={step === 2 ? 'step' : undefined}>
              <span className={styles.stepMark}>02</span>
              <span className={styles.stepCopy}><strong>Define una contraseña</strong><small>Elige una nueva para tu cuenta.</small></span>
            </div>
          </div>
        </div>

        <div className={styles.storyFooter}><ShieldCheck size={16} /><span>Tu contraseña actual nunca se muestra.</span></div>
      </aside>

      <section className={styles.main}>
        <nav className={styles.mainTop} aria-label="Navegación de recuperación">
          <Link className={styles.mobileBrand} href="/" aria-label="AETHER, inicio">
            <span className={styles.brandMark}><BrandMark size={28} tone="light" /></span>
            <span className={styles.brandName}>AETHER</span>
          </Link>
          <Link className={styles.backLink} href={backHref}><ArrowLeft size={15} />{backLabel}</Link>
        </nav>
        <div className={styles.panel}>{children}</div>
        <p className={styles.mainFooter}>Recuperación de acceso a AETHER</p>
      </section>
    </main>
  );
}
