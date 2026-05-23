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
      <div style={{
        minHeight: '100vh',
        background: '#080c14',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '20px',
      }}>
        <svg width="32" height="32" viewBox="0 0 220 220" fill="none">
          <path d="M110 39L32 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
          <path d="M110 39L188 173" stroke="#38b6ff" strokeWidth="10" strokeLinecap="round" />
          <path d="M66 122L154 122" stroke="#00e5cc" strokeWidth="7" strokeLinecap="round" />
          <circle cx="110" cy="39" r="9" fill="#38b6ff" />
          <circle cx="32" cy="173" r="9" fill="#38b6ff" />
          <circle cx="188" cy="173" r="9" fill="#00e5cc" />
        </svg>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="9" stroke="rgba(56,182,255,0.15)" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke="#38b6ff" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
