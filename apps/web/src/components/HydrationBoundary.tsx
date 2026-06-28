'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

function LoadingScreen() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#13182A',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'column',
      gap: '26px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: '360px', height: '360px',
        marginLeft: '-180px', marginTop: '-180px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(242,87,30,0.12), transparent 65%)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: '15px', position: 'relative', animation: 'lpulse 2.4s ease-in-out infinite' }}>
        <span style={{
          width: '58px', height: '58px', borderRadius: '16px',
          background: '#F2571E',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 10px 32px -10px rgba(242,87,30,0.6)',
        }}>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none">
            <path d="M12 4.5 L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 4.5 L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
          </svg>
        </span>
        <span style={{ fontFamily: "'Sora', system-ui, sans-serif", fontWeight: 700, fontSize: '32px', letterSpacing: '-0.02em', color: '#ECE5D6' }}>
          Aether
        </span>
      </div>

      <div style={{ width: '160px', height: '3px', borderRadius: '3px', background: 'rgba(255,255,255,0.1)', overflow: 'hidden', position: 'relative' }}>
        <div style={{ height: '100%', background: '#F2571E', transformOrigin: 'left', animation: 'lbar 1.8s ease-in-out infinite' }} />
      </div>

      <span style={{ fontFamily: "'Manrope', system-ui, sans-serif", fontSize: '13px', color: '#615846', position: 'relative' }}>
        Preparando tu espacio…
      </span>

      <style>{`
        @keyframes lpulse { 0%,100%{transform:scale(1)} 50%{transform:scale(1.04)} }
        @keyframes lbar { 0%{transform:scaleX(0)} 80%,100%{transform:scaleX(1)} }
      `}</style>
    </div>
  );
}

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const authIsHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (authIsHydrated) setIsHydrated(true);
  }, [authIsHydrated]);

  if (!isHydrated) return <LoadingScreen />;

  return <>{children}</>;
}
