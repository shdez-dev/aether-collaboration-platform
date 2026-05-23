// app/not-found.tsx
'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: '#080c14',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>

      {/* Grid de fondo */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: `
          linear-gradient(rgba(56,182,255,0.03) 1px, transparent 1px),
          linear-gradient(90deg, rgba(56,182,255,0.03) 1px, transparent 1px)
        `,
        backgroundSize: '48px 48px',
        pointerEvents: 'none',
      }} />

      {/* Glow central difuso */}
      <div style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '600px',
        height: '400px',
        background: 'radial-gradient(ellipse at center, rgba(56,182,255,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      {/* Contenido */}
      <div style={{
        position: 'relative',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '0',
      }}>

        {/* Código de error */}
        <div style={{ position: 'relative', marginBottom: '8px' }}>
          <span style={{
            fontSize: 'clamp(96px, 18vw, 160px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: 'transparent',
            WebkitTextStroke: '1px rgba(56,182,255,0.25)',
            display: 'block',
            userSelect: 'none',
          }}>
            404
          </span>
          {/* Versión rellena con glow */}
          <span style={{
            position: 'absolute',
            inset: 0,
            fontSize: 'clamp(96px, 18vw, 160px)',
            fontWeight: 800,
            letterSpacing: '-0.04em',
            lineHeight: 1,
            color: '#38b6ff',
            opacity: 0.12,
            display: 'block',
            userSelect: 'none',
            filter: 'blur(2px)',
          }}>
            404
          </span>
        </div>

        {/* Línea divisora con acento */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          marginBottom: '24px',
          width: '240px',
        }}>
          <div style={{ flex: 1, height: '1px', background: 'rgba(56,182,255,0.15)' }} />
          <div style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: '#38b6ff',
            boxShadow: '0 0 8px #38b6ff',
          }} />
          <div style={{ flex: 1, height: '1px', background: 'rgba(56,182,255,0.15)' }} />
        </div>

        {/* Mensaje */}
        <p style={{
          fontSize: '18px',
          fontWeight: 700,
          color: '#e8ebf0',
          marginBottom: '10px',
          letterSpacing: '-0.01em',
        }}>
          Página no encontrada
        </p>
        <p style={{
          fontSize: '13.5px',
          color: '#5a6477',
          lineHeight: 1.7,
          maxWidth: '320px',
          marginBottom: '36px',
        }}>
          La ruta que buscas no existe o fue movida a otro lugar.
        </p>

        {/* Acciones */}
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <button
            onClick={() => router.back()}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '8px', cursor: 'pointer',
              background: 'transparent',
              border: '1px solid rgba(56,182,255,0.2)',
              color: '#7a8699', fontSize: '13px', fontWeight: 500,
              transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56,182,255,0.4)';
              e.currentTarget.style.color = '#b8c4d6';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(56,182,255,0.2)';
              e.currentTarget.style.color = '#7a8699';
            }}
          >
            <ArrowLeft size={14} />
            Volver
          </button>

          <Link
            href="/dashboard"
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '8px',
              background: 'rgba(56,182,255,0.1)',
              border: '1px solid rgba(56,182,255,0.3)',
              color: '#38b6ff', fontSize: '13px', fontWeight: 600,
              textDecoration: 'none', transition: 'all 0.15s',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(56,182,255,0.18)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.5)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = 'rgba(56,182,255,0.1)';
              (e.currentTarget as HTMLElement).style.borderColor = 'rgba(56,182,255,0.3)';
            }}
          >
            <Home size={14} />
            Ir al dashboard
          </Link>
        </div>

        {/* Firma discreta */}
        <p style={{
          marginTop: '52px',
          fontSize: '11px',
          color: 'rgba(56,182,255,0.25)',
          letterSpacing: '0.12em',
          textTransform: 'uppercase',
          fontWeight: 600,
        }}>
          Aether
        </p>
      </div>
    </div>
  );
}
