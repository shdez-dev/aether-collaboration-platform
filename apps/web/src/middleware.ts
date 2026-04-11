// apps/web/src/middleware.ts
// Protege todas las rutas /dashboard/* redirigiendo al login si no hay sesión activa.
// El Edge runtime no puede acceder a localStorage, por eso usamos una cookie ligera
// (aether_session) que el authStore establece al autenticar y borra al cerrar sesión.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Solo proteger rutas del dashboard
  if (!pathname.startsWith('/dashboard')) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('aether_session');

  if (!hasSession) {
    const loginUrl = new URL('/login', request.url);
    // Guardar la ruta original para redirigir tras login
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*'],
};
