'use client';

import '../styles/globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HydrationBoundary } from '@/components/HydrationBoundary';
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // Suprimir errores de extensiones del navegador
  useEffect(() => {
    const originalError = console.error;
    console.error = (...args) => {
      // Filtrar errores de extensiones del navegador
      const errorMessage = args[0]?.toString() || '';
      if (
        errorMessage.includes('disconnected port') ||
        errorMessage.includes('Extension context invalidated')
      ) {
        return; // Ignorar estos errores
      }
      originalError.apply(console, args);
    };

    return () => {
      console.error = originalError;
    };
  }, []);
  const pathname = usePathname();
  const isAuthenticated = useIsAuthenticated();
  const t = useT();

  // No mostrar navegación en páginas de auth o dashboard (tienen su propio layout)
  const hideNav =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/register' ||
    pathname?.startsWith('/dashboard');

  return (
    <html lang="es">
      <head>
        <meta charSet="utf-8" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes"
        />
        <meta name="theme-color" content="#3B82F6" />
        <meta
          name="description"
          content="AETHER - Event-driven collaboration platform for teams. Manage workspaces, boards, and documents in real-time."
        />
        <meta name="application-name" content="Aether" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Aether" />
        <meta name="format-detection" content="telephone=no" />
        <meta name="mobile-web-app-capable" content="yes" />

        {/* PWA Manifest */}
        <link rel="manifest" href="/manifest.json" />

        {/* Favicons */}
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />

        <title>AETHER - Collaboration Platform</title>
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="dark">
            <HydrationBoundary>
              {/* Navigation Bar */}
              {!hideNav && (
                <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border safe-area-top">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
                      {/* Logo */}
                      <Link
                        href="/"
                        className="flex items-center gap-2 text-accent hover:text-accent-hover transition-colors flex-shrink-0 min-h-[44px]"
                      >
                        <span className="text-lg sm:text-xl font-bold font-mono whitespace-nowrap">[ AETHER ]</span>
                      </Link>

                      {/* Navigation Links */}
                      <div className="flex items-center gap-1.5 sm:gap-4 flex-shrink-0">
                        {isAuthenticated ? (
                          <Link
                            href="/dashboard"
                            className="px-3 sm:px-5 py-2 bg-blue-600 text-white rounded-md font-medium text-xs sm:text-sm hover:bg-blue-700 transition-colors whitespace-nowrap min-h-[44px] flex items-center"
                          >
                            <span className="hidden xs:inline">Dashboard</span>
                            <span className="xs:hidden">Panel</span>
                          </Link>
                        ) : (
                          <>
                            <Link
                              href="/login"
                              className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-text-primary hover:text-accent transition-colors whitespace-nowrap min-h-[44px] flex items-center"
                            >
                              <span className="hidden xs:inline">{t.nav_login}</span>
                              <span className="xs:hidden">Login</span>
                            </Link>
                            <Link
                              href="/register"
                              className="px-2.5 sm:px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-all duration-300 text-xs sm:text-sm whitespace-nowrap min-h-[44px] flex items-center"
                            >
                              <span className="hidden xs:inline">{t.nav_register}</span>
                              <span className="xs:hidden">Reg.</span>
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </nav>
              )}

              {/* Main Content */}
              <main className={hideNav ? '' : 'pt-14 sm:pt-16'}>{children}</main>
            </HydrationBoundary>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
