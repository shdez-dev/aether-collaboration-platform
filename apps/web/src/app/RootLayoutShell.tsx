'use client';

import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { useIsAuthenticated } from '@/stores/authStore';
import { useT, useLanguage } from '@/lib/i18n';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HydrationBoundary } from '@/components/HydrationBoundary';
import { ThemeProvider } from '@/providers/ThemeProvider';

export function RootLayoutShell({ children }: { children: React.ReactNode }) {
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
  const lang = useLanguage();

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  // No mostrar navegación en páginas de auth o dashboard (tienen su propio layout)
  const hideNav =
    pathname === '/' ||
    pathname === '/login' ||
    pathname === '/join' ||
    pathname === '/forgot-password' ||
    pathname?.startsWith('/legal/') ||
    pathname?.startsWith('/verify-email') ||
    pathname === '/organization-invitation' ||
    pathname?.startsWith('/dashboard');

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <HydrationBoundary>
          {/* Navigation Bar */}
          {!hideNav && (
            <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border safe-area-top">
              <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-14 sm:h-16 gap-2">
                  {/* Logo */}
                  <Link
                    href="/"
                    aria-label="AETHER, inicio"
                    className="flex items-center gap-2 text-accent hover:text-accent-hover transition-colors flex-shrink-0 min-h-[44px]"
                  >
                    <BrandMark size={36} />
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
                      <Link href="/login" className="px-2 sm:px-4 py-2 text-xs sm:text-sm font-medium text-text-primary hover:text-accent transition-colors whitespace-nowrap min-h-[44px] flex items-center">
                        {t.nav_login}
                      </Link>
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
  );
}
