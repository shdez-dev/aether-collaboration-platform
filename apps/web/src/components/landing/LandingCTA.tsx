'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

export function LandingCTA() {
  const isAuthenticated = useIsAuthenticated();
  const symbolRef = useRef<HTMLDivElement>(null);
  const [symbolVisible, setSymbolVisible] = useState(false);

  useEffect(() => {
    const symbol = symbolRef.current;
    if (!symbol) return;

    let inView = false;
    const updateMotion = () => setSymbolVisible(inView && document.visibilityState === 'visible');
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      updateMotion();
    }, { threshold: 0.15 });

    observer.observe(symbol);
    document.addEventListener('visibilitychange', updateMotion);
    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', updateMotion);
    };
  }, []);

  return (
    <section className="home-close" id="empezar" aria-labelledby="home-close-title">
      <div ref={symbolRef} className="home-close-symbol" data-motion-active={symbolVisible} aria-hidden="true"><span /><span /><span /></div>
      <h2 id="home-close-title">Dale continuidad<br />a lo que importa.</h2>
      <p>Empieza con un espacio para tu equipo. Los proyectos, las decisiones y las personas tendrán un lugar en común.</p>
      <Link className="home-primary-action" href={isAuthenticated ? '/dashboard' : '/register'}>
        {isAuthenticated ? 'Volver a mi espacio' : 'Crear mi espacio'}
        <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M3 9h11m-4-4 4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
      </Link>
    </section>
  );
}
