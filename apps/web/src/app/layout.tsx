'use client';

import '../styles/globals.css';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useIsAuthenticated } from '@/stores/authStore';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { HydrationBoundary } from '@/components/HydrationBoundary';
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthenticated = useIsAuthenticated();

  // No mostrar navegación en páginas de auth o dashboard (tienen su propio layout)
  const hideNav =
    pathname === '/login' || pathname === '/register' || pathname?.startsWith('/dashboard');

  return (
    <html lang="en">
      <body>
        <ErrorBoundary>
          <ThemeProvider defaultTheme="dark">
            <HydrationBoundary>
              {/* Navigation Bar */}
              {!hideNav && (
                <nav className="fixed top-0 left-0 right-0 z-50 bg-surface/95 backdrop-blur-sm border-b border-border">
                  <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="flex items-center justify-between h-16">
                      {/* Logo */}
                      <Link
                        href="/"
                        className="flex items-center gap-2 text-accent hover:text-accent-hover transition-colors"
                      >
                        <span className="text-xl font-bold font-mono">[ AETHER ]</span>
                      </Link>

                      {/* Navigation Links */}
                      <div className="flex items-center gap-4">
                        {isAuthenticated ? (
                          <Link
                            href="/dashboard"
                            className="px-5 py-2 bg-blue-600 text-white rounded-md font-medium text-sm hover:bg-blue-700 transition-colors"
                          >
                            Dashboard
                          </Link>
                        ) : (
                          <>
                            <Link
                              href="/login"
                              className="px-4 py-2 text-sm font-medium text-text-primary hover:text-accent transition-colors"
                            >
                              Iniciar Sesión
                            </Link>
                            <Link
                              href="/register"
                              className="px-4 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg font-semibold transition-all duration-300 text-sm"
                            >
                              Crear Cuenta
                            </Link>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </nav>
              )}

              {/* Main Content */}
              <main className={hideNav ? '' : 'pt-16'}>{children}</main>
            </HydrationBoundary>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
