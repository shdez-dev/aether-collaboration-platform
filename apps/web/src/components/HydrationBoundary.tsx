'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';

function LoadingScreen() {
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

export function HydrationBoundary({ children }: { children: React.ReactNode }) {
  const [isHydrated, setIsHydrated] = useState(false);
  const authIsHydrated = useAuthStore((state) => state.isHydrated);

  useEffect(() => {
    if (authIsHydrated) setIsHydrated(true);
  }, [authIsHydrated]);

  if (!isHydrated) return <LoadingScreen />;

  return <>{children}</>;
}
