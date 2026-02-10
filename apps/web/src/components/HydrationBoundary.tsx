'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const authIsHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    // Wait for auth store to hydrate
    if (authIsHydrated) {
      setIsHydrated(true);
    }
  }, [authIsHydrated]);

  // Show loading screen while hydrating
  if (!isHydrated) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-400 text-sm">Cargando...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
