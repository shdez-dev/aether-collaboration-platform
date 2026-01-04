'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading, getCurrentUser } = useAuthStore();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      // Si no hay token, redirigir inmediatamente
      if (!isAuthenticated) {
        router.push('/login');
        return;
      }

      // Verificar que el token siga siendo válido
      try {
        await getCurrentUser();
        setIsChecking(false);
      } catch (error) {
        // Token inválido, redirigir a login
        router.push('/login');
      }
    };

    checkAuth();
  }, [isAuthenticated, getCurrentUser, router]);

  // Mostrar loading mientras verifica
  if (isChecking || isLoading) {
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

  // Si no está autenticado, no mostrar nada (ya está redirigiendo)
  if (!isAuthenticated) {
    return null;
  }

  // Usuario autenticado, mostrar contenido
  return <>{children}</>;
}
