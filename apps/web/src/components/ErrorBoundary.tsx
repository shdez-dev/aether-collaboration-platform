'use client';

import React, { Component, ReactNode } from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { BrandMark } from '@/components/brand/BrandMark';
import styles from './ErrorBoundary.module.css';

interface Props {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.handleReset);
      }

      return (
        <main className={styles.screen}>
          <section className={styles.shell} aria-labelledby="error-title" role="alert">
            <div className={styles.brand} aria-label="Aether">
              <BrandMark size={30} tone="adaptive" />
              <span>AETHER</span>
            </div>

            <div className={styles.card}>
              <div className={styles.cardGlow} aria-hidden="true" />
              <div className={styles.content}>
                <div className={styles.iconWrap} aria-hidden="true">
                  <AlertTriangle size={27} strokeWidth={1.8} />
                </div>
                <p className={styles.eyebrow}>ALGO NO SALIÓ COMO ESPERÁBAMOS</p>
                <h1 id="error-title" className={styles.title}>No pudimos cargar esta vista</h1>
                <p className={styles.description}>
                  Hubo un problema inesperado. Puedes volver a intentarlo o regresar al inicio de Aether.
                </p>

                <div className={styles.actions}>
                  <button type="button" onClick={this.handleReload} className={styles.primaryAction}>
                    <RefreshCw size={16} aria-hidden="true" />
                    Recargar página
                  </button>
                  <Link href="/dashboard" className={styles.secondaryAction}>
                    <ArrowLeft size={16} aria-hidden="true" />
                    Ir al inicio
                  </Link>
                </div>

                {process.env.NODE_ENV === 'development' && (
                  <details className={styles.debugDetails}>
                    <summary>Ver detalles técnicos</summary>
                    <div className={styles.debugContent}>
                      <p>{this.state.error.message}</p>
                      {this.state.error.stack && <pre>{this.state.error.stack.slice(0, 1200)}</pre>}
                    </div>
                  </details>
                )}
              </div>
              <footer className={styles.cardFooter}>
                Si el problema continúa, vuelve a cargar la página en unos segundos.
              </footer>
            </div>
          </section>
        </main>
      );
    }

    return this.props.children;
  }
}
