'use client';

import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';
import { BrandMark } from '@/components/brand/BrandMark';

export function LandingNav() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <nav className="home-nav" aria-label="Navegación principal">
      <Link href="/" className="home-brand" aria-label="AETHER, inicio">
        <BrandMark size={40} tone="light" />
      </Link>
      <div className="home-nav-center">
        <a href="#recorrido">Cómo funciona</a>
        <a href="#plataforma">La plataforma</a>
      </div>
      <div className="home-nav-end">
        {!isAuthenticated && <Link href="/login" className="home-nav-login">Entrar</Link>}
        <Link href={isAuthenticated ? '/dashboard' : '/register'} className="home-nav-action">
          {isAuthenticated ? 'Mi espacio' : 'Crear mi espacio'}
        </Link>
      </div>
    </nav>
  );
}
