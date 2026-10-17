// apps/web/src/middleware.ts
// Protege todas las rutas /dashboard/* redirigiendo al login si no hay sesión activa.
// El Edge runtime no puede acceder a localStorage, por eso usamos una cookie ligera
// (aether_session) que el authStore establece al autenticar y borra al cerrar sesión.

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { buildContentSecurityPolicy } from './lib/security/contentSecurityPolicy';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes));
  const contentSecurityPolicy = buildContentSecurityPolicy({
    nonce,
    apiUrl: process.env.NEXT_PUBLIC_API_URL,
    websocketUrl: process.env.NEXT_PUBLIC_WS_URL,
    production: process.env.NODE_ENV === 'production',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', contentSecurityPolicy);

  // La cookie solo guía la navegación; las API siguen validando JWT y permisos.
  let response: NextResponse;
  if (pathname.startsWith('/dashboard') && !request.cookies.has('aether_session')) {
    const loginUrl = new URL('/login', request.url);
    // Guardar la ruta original para redirigir tras login
    loginUrl.searchParams.set('redirect', pathname);
    response = NextResponse.redirect(loginUrl);
  } else {
    response = NextResponse.next({
      request: { headers: requestHeaders },
    });
  }

  response.headers.set('Content-Security-Policy', contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff|woff2|ttf|otf|txt|xml|json)$).*)',
  ],
};
