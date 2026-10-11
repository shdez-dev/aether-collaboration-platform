'use client';

import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

export function LandingCTA() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <section className="home-close" id="empezar" aria-labelledby="home-close-title">
      <div className="home-close-symbol" aria-hidden="true"><span /><span /><span /></div>
      <h2 id="home-close-title">Dale continuidad<br />a lo que importa.</h2>
      <p>Empieza con un espacio para tu equipo. Los proyectos, las decisiones y las personas tendrán un lugar en común.</p>
      <Link className="home-primary-action" href={isAuthenticated ? '/dashboard' : '/register'}>
        {isAuthenticated ? 'Volver a mi espacio' : 'Crear mi espacio'}
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
    </section>
  );
}
