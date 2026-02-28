'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout, isAuthenticated, isHydrated, getCurrentUser } = useAuthStore();

  // Mobile-first: sidebar cerrado por defecto en móvil, abierto en desktop
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px) to trigger close
  const minSwipeDistance = 50;

  // Detectar si es móvil y ajustar sidebar inicial
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      // En desktop, abrir sidebar por defecto solo la primera vez
      if (!mobile && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Swipe gesture handlers for mobile sidebar
  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;

    if (isLeftSwipe && isSidebarOpen && isMobile) {
      setIsSidebarOpen(false);
    }

    setTouchStart(null);
    setTouchEnd(null);
  };

  // Verificar autenticación
  useEffect(() => {
    const checkAuth = async () => {
      // CRÍTICO: Esperar a que Zustand termine de cargar desde localStorage
      if (!isHydrated) {
        return;
      }

      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      try {
        await getCurrentUser();
        setIsChecking(false);
      } catch (error) {
        router.push('/login');
      }
    };

    checkAuth();
  }, [isAuthenticated, isHydrated, getCurrentUser, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navigation = [
    {
      name: 'Panel',
      href: '/dashboard',
      icon: '◆',
      active: pathname === '/dashboard',
    },
    {
      name: 'Workspaces',
      href: '/dashboard/workspaces',
      icon: '▣',
      active: pathname?.startsWith('/dashboard/workspaces'),
    },
    {
      name: 'Boards',
      href: '/dashboard/boards',
      icon: '▦',
      active: pathname?.startsWith('/dashboard/boards'),
    },
    {
      name: 'Documentos',
      href: '/dashboard/documents',
      icon: '▤',
      active: pathname?.startsWith('/dashboard/documents'),
    },
    {
      name: 'Notificaciones',
      href: '/dashboard/notifications',
      icon: '◉',
      active: pathname?.startsWith('/dashboard/notifications'),
    },
    {
      name: 'Usuarios',
      href: '/dashboard/users',
      icon: '◎',
      active: pathname?.startsWith('/dashboard/users'),
    },
  ];

  // Mostrar loading mientras verifica O mientras se hidrata el estado
  if (!isHydrated || isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="card-terminal max-w-md">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="w-12 h-12 border-4 border-accent border-t-transparent rounded-full animate-spin" />
            <p className="text-text-secondary text-sm">Verificando autenticación...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar Overlay (Mobile only) */}
      {isSidebarOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
          aria-label="Cerrar menú"
        />
      )}

      {/* Sidebar - Mobile: Fixed drawer, Desktop: Static sidebar */}
      <aside
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        className={`
          bg-surface border-r border-border flex flex-col
          transition-transform duration-300 ease-out
          ${isMobile ? 'fixed top-0 left-0 h-full w-72 z-50' : 'relative'}
          ${isMobile && !isSidebarOpen ? '-translate-x-full' : 'translate-x-0'}
          ${!isMobile && !isSidebarOpen ? 'w-0' : isMobile ? 'w-72' : 'w-64'}
          overflow-hidden
        `}
      >
        {isSidebarOpen && (
          <>
            {/* Header */}
            <div className="p-6 border-b border-border">
              <h1 className="text-xl font-normal mb-1">[ AETHER ]</h1>
              <p className="text-text-muted text-xs">Event-sourced platform</p>
              <div className="status-online mt-3">OPERATIONAL</div>
            </div>

            {/* User Info */}
            <div className="p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-terminal bg-accent/20 flex items-center justify-center">
                  <span className="text-accent font-bold">
                    {user?.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-text-primary truncate">{user?.name}</p>
                  <p className="text-xs text-text-muted truncate">{user?.email}</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
              {navigation.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2 rounded-terminal transition-colors ${
                    item.active
                      ? 'bg-accent/20 text-accent border border-accent/50'
                      : 'text-text-secondary hover:bg-card hover:text-text-primary'
                  }`}
                >
                  <span className="text-lg">{item.icon}</span>
                  <span className="text-sm">{item.name}</span>
                </Link>
              ))}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-border space-y-2">
              <Link
                href="/dashboard/settings"
                className="flex items-center gap-3 px-3 py-2 rounded-terminal text-text-secondary hover:bg-card hover:text-text-primary transition-colors text-sm"
              >
                <span>⚙</span>
                <span>Configuración</span>
              </Link>
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-terminal text-error hover:bg-error/10 transition-colors text-sm"
              >
                <span>⏻</span>
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar - Mobile optimized */}
        <header className="bg-surface border-b border-border px-4 md:px-6 py-3 md:py-4 flex items-center justify-between">
          <div className="flex items-center gap-3 md:gap-4 flex-1 min-w-0">
            {/* Hamburger Menu Button - Mobile friendly */}
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 -ml-2 text-text-secondary hover:text-text-primary hover:bg-surface/50 rounded-lg transition-all active:scale-95"
              aria-label="Alternar menú"
            >
              {isSidebarOpen && !isMobile ? (
                <span className="text-xl">◀</span>
              ) : (
                <svg
                  className="w-6 h-6"
                  fill="none"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>

            {/* Page Title - Responsive */}
            <div className="flex-1 min-w-0">
              <h2 className="text-base md:text-lg text-text-primary font-normal truncate">
                {navigation.find((item) => item.active)?.name || 'Panel'}
              </h2>
              <p className="text-xs text-text-muted truncate hidden sm:block">~/ {pathname}</p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Search - Hidden on mobile, shown on tablet+ */}
            <div className="relative hidden md:block">
              <input
                type="search"
                placeholder="Buscar..."
                className="input-terminal w-48 lg:w-64 text-sm"
              />
            </div>

            {/* Status indicator - Hidden on mobile */}
            <div className="hidden sm:flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-xs text-text-muted">CONECTADO</span>
            </div>

            {/* User Avatar - Mobile: Just avatar, Desktop: with name */}
            <Link
              href="/dashboard/settings"
              className="flex items-center gap-2 p-1.5 rounded-lg hover:bg-surface/50 transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
                <span className="text-accent font-bold text-sm">
                  {user?.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-text-primary hidden lg:block">{user?.name}</span>
            </Link>
          </div>
        </header>

        {/* Page Content - Add bottom padding for mobile bottom nav */}
        <main className="flex-1 p-4 md:p-6 overflow-auto pb-20 md:pb-6">{children}</main>
      </div>

      {/* Bottom Navigation - Mobile Only */}
      <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-border md:hidden z-30 safe-area-bottom">
        <div className="flex items-center justify-around h-16">
          {/* Main navigation items for mobile */}
          {navigation.slice(0, 4).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-1 transition-colors ${
                item.active
                  ? 'text-accent bg-accent/5'
                  : 'text-text-muted hover:text-text-primary active:bg-surface/50'
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.name}</span>
            </Link>
          ))}

          {/* More menu button */}
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="flex flex-col items-center justify-center flex-1 h-full gap-1 text-text-muted hover:text-text-primary active:bg-surface/50 transition-colors"
          >
            <svg
              className="w-6 h-6"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            <span className="text-[10px] font-medium">Más</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
