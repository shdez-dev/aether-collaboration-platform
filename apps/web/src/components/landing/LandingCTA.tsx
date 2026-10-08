'use client';

import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

const TAGS = ['Tareas', 'Notas', 'Documentos', 'Equipo', 'Calendario'];

export function LandingCTA() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <>
      {/* ── STATEMENT ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1000px', margin: 'clamp(90px, 12vw, 170px) auto 0',
        padding: '0 clamp(20px, 5vw, 64px)', textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700,
          fontSize: 'clamp(2.1rem, 4.6vw, 3.5rem)',
          letterSpacing: '-0.03em', lineHeight: 1.08,
          color: 'var(--c-text)', margin: 0,
        }}>
          Organizar no tiene por qué doler.{' '}
          <span style={{ background: '#7452A6', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            Con Aether, simplemente fluye.
          </span>
        </h2>

        <p style={{ maxWidth: '600px', margin: '22px auto 0', fontSize: 'clamp(1.05rem, 1.4vw, 1.2rem)', lineHeight: 1.6, color: 'var(--c-text2)' }}>
          Sin manuales, sin curva de aprendizaje, sin sentirte abrumado. Lo abres y ya sabes usarlo.
        </p>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center', marginTop: '36px' }}>
          {TAGS.map((tag, i) => (
            <span key={tag} style={{
              fontFamily: "'Sora', sans-serif", fontSize: '14px', fontWeight: 500,
              color: 'var(--c-text2)', background: 'rgba(97,71,130,0.04)',
              border: '1px solid rgba(97,71,130,0.09)',
              padding: '10px 18px', borderRadius: '8px',
              animation: 'bob 3.2s ease-in-out infinite',
              animationDelay: `${i * 0.4}s`,
            }}>
              {tag}
            </span>
          ))}
        </div>
      </section>

      {/* ── FINAL CTA ── */}
      <section id="empezar" style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1100px', margin: 'clamp(90px, 12vw, 170px) auto 0',
        padding: '0 clamp(20px, 5vw, 64px)',
      }}>
        <div style={{
          borderRadius: '8px',
          border: '1px solid rgba(97,71,130,0.1)',
          background: 'rgba(20,28,46,0.6)',
          padding: 'clamp(48px, 7vw, 86px) clamp(24px, 5vw, 64px)',
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Sora', sans-serif", fontWeight: 700,
            fontSize: 'clamp(2rem, 4vw, 3.1rem)',
            letterSpacing: '-0.03em', lineHeight: 1.07,
            color: 'var(--c-text)', margin: 0,
          }}>
            Tu próximo proyecto empieza aquí.
          </h2>
          <p style={{ maxWidth: '520px', margin: '18px auto 0', fontSize: 'clamp(1.02rem, 1.3vw, 1.16rem)', lineHeight: 1.6, color: 'var(--c-text2)' }}>
            {isAuthenticated
              ? 'Tu espacio ya está listo. Vuelve a donde lo dejaste y sigue avanzando con tu equipo.'
              : 'Crea tu espacio en segundos y trae a tu equipo. Empezar es gratis y no necesitas configurar nada.'}
          </p>
          <div style={{ marginTop: '36px' }}>
            <Link href={isAuthenticated ? '/dashboard' : '/register'} style={{
              display: 'inline-block',
              padding: '15px 36px', borderRadius: '8px',
              background: '#7452A6', color: '#FFFFFF',
              fontFamily: "'Sora', sans-serif", fontWeight: 600,
              fontSize: '16px', textDecoration: 'none',
            }}>
              {isAuthenticated ? 'Mi espacio' : 'Regístrate gratis'}
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
