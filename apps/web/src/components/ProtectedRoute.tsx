'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { BrandMark } from '@/components/brand/BrandMark';

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
        background: 'var(--c-bg)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: '26px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Radial glow */}
        <div style={{
          position: 'absolute',
          top: '50%', left: '50%',
          width: '360px', height: '360px',
          marginLeft: '-180px', marginTop: '-180px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(116,82,166,0.12), transparent 65%)',
          pointerEvents: 'none',
        }} />

        {/* Brand symbol */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', animation: 'lpulse 2.4s ease-in-out infinite' }}>
          <span style={{
            width: '58px', height: '58px', borderRadius: '16px',
            background: '#7452A6',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 10px 32px -10px rgba(116,82,166,0.6)',
          }}>
            <BrandMark size={48} tone="light" />
          </span>
        </div>

        {/* Progress bar */}
        <div style={{ width: '160px', height: '3px', borderRadius: '3px', background: 'rgba(97,71,130,0.1)', overflow: 'hidden', position: 'relative' }}>
          <div style={{ height: '100%', background: '#7452A6', transformOrigin: 'left', animation: 'lbar 1.8s ease-in-out infinite' }} />
        </div>

        <span style={{ fontFamily: "'Manrope', system-ui, sans-serif", fontSize: '13px', color: 'var(--c-text4)', position: 'relative' }}>
          Preparando tu espacio…
        </span>

        <style>{`
          @keyframes lpulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
          @keyframes lbar { 0%{transform:scaleX(0)} 80%,100%{transform:scaleX(1)} }
        `}</style>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}
