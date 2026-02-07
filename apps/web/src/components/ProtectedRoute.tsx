'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, isHydrated, getCurrentUser } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [mounted, setMounted] = useState(false); // ← NUEVO

  // ← NUEVO: Asegurar que solo renderice en el cliente
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
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

  // ← NUEVO: No renderizar nada en el servidor
  if (!mounted) {
    return null;
  }

  if (!isHydrated || isChecking || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg-primary">
        <div className="card-terminal max-w-md">
          <div className="flex flex-col items-center gap-4 py-8">
            <div className="loading-lg" />
            <p className="text-text-secondary text-sm">VERIFYING AUTHENTICATION...</p>
            <div className="text-accent text-xs font-mono">[ ▓▓▓▓▓▓▓░░░ ] 70%</div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
