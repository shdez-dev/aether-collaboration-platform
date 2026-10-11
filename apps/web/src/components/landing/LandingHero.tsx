'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

const journey = [
  {
    id: 'propuesta',
    title: 'La propuesta',
    subtitle: 'Lo que queremos cambiar',
    example: 'Simplificar la bienvenida de nuevas personas al equipo.',
    context: 'La necesidad y su origen quedan claros para todos.',
  },
  {
    id: 'decision',
    title: 'La decisión',
    subtitle: 'Qué haremos y por qué',
    example: 'Crear una guía compartida con responsables definidos.',
    context: 'El acuerdo conserva el motivo que lo impulsó.',
  },
  {
    id: 'proyecto',
    title: 'El proyecto',
    subtitle: 'Quién lo lleva adelante',
    example: 'Organizar tareas, documentos y una fecha de revisión.',
    context: 'El equipo puede seguir el próximo paso sin reconstruir la historia.',
  },
] as const;

export function LandingHero() {
  const isAuthenticated = useIsAuthenticated();
  const [active, setActive] = useState(0);
  const selected = journey[active];

  return (
    <header className="home-hero" id="inicio">
      <div className="home-hero-intro">
        <div className="home-hero-message">
          <h1>Una idea es solo<br />el principio.</h1>
          <p>AETHER mantiene unidos el contexto, las decisiones y el trabajo que viene después. Para que tu equipo sepa no solo qué hacer, sino por qué.</p>
          <div className="home-hero-actions">
            <Link className="home-primary-action" href={isAuthenticated ? '/dashboard' : '/register'}>
              {isAuthenticated ? 'Ir a mi espacio' : 'Crear mi espacio'}
              <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </Link>
            <a href="#plataforma" className="home-secondary-action">Conocer la plataforma</a>
          </div>
        </div>
      </div>

      <div className="home-journey" id="recorrido">
        <div className="home-journey-intro">
          <span>Un mismo hilo de trabajo</span>
          <span>Selecciona cada etapa para explorarla</span>
        </div>
        <div className="home-journey-stages" role="group" aria-label="Etapas de una idea en AETHER">
          <svg className="home-journey-track" viewBox="0 0 1000 250" preserveAspectRatio="none" fill="none" aria-hidden="true">
            <path d="M0 28H310L350 80H610L650 18H1000" stroke="currentColor" strokeWidth="1.4" vectorEffect="non-scaling-stroke" />
          </svg>
          {journey.map((stage, index) => (
            <button
              key={stage.id}
              type="button"
              className={`home-journey-stage ${active === index ? 'is-active' : ''}`}
              onClick={() => setActive(index)}
              aria-pressed={active === index}
              aria-controls="home-journey-detail"
            >
              <span className="home-stage-node" aria-hidden="true" />
              <span className="home-stage-number">0{index + 1}</span>
              <strong>{stage.title}</strong>
              <small>{stage.subtitle}</small>
            </button>
          ))}
        </div>
        <div className="home-journey-detail" id="home-journey-detail" aria-live="polite">
          <span>Ejemplo ilustrativo</span>
          <strong>{selected.example}</strong>
          <p>{selected.context}</p>
        </div>
      </div>
    </header>
  );
}
