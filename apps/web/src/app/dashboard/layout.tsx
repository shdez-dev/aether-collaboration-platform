// apps/web/src/app/dashboard/layout.tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import ProtectedRoute from '@/components/ProtectedRoute';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  const navigation = [
    {
      name: 'Dashboard',
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
      name: 'Documents',
      href: '/dashboard/documents',
      icon: '▤',
      active: pathname?.startsWith('/dashboard/documents'),
    },
    {
      name: 'Notifications',
      href: '/dashboard/notifications',
      icon: '◉',
      active: pathname?.startsWith('/dashboard/notifications'),
    },
  ];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background flex">
        {/* Sidebar */}
        <aside
          className={`bg-surface border-r border-border transition-all duration-300 ${
            isSidebarOpen ? 'w-64' : 'w-0'
          } flex flex-col overflow-hidden`}
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
                  <span>Settings</span>
                </Link>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3 py-2 rounded-terminal text-error hover:bg-error/10 transition-colors text-sm"
                >
                  <span>⏻</span>
                  <span>Logout</span>
                </button>
              </div>
            </>
          )}
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top Bar */}
          <header className="bg-surface border-b border-border px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="text-text-secondary hover:text-text-primary transition-colors"
                aria-label="Toggle sidebar"
              >
                <span className="text-xl">{isSidebarOpen ? '◀' : '▶'}</span>
              </button>
              <div>
                <h2 className="text-lg text-text-primary font-normal">
                  {navigation.find((item) => item.active)?.name || 'Dashboard'}
                </h2>
                <p className="text-xs text-text-muted">~/ {pathname}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Search */}
              <div className="relative">
                <input
                  type="search"
                  placeholder="Search..."
                  className="input-terminal w-64 text-sm"
                />
              </div>

              {/* Status indicator */}
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                <span className="text-xs text-text-muted">CONNECTED</span>
              </div>
            </div>
          </header>

          {/* Page Content */}
          <main className="flex-1 p-6 overflow-auto">{children}</main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
