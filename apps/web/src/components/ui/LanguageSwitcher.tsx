'use client';

import { Globe } from 'lucide-react';
import { useAuthStore } from '@/stores/authStore';

interface LanguageSwitcherProps {
  variant?: 'topbar' | 'floating';
}

export function LanguageSwitcher({ variant = 'topbar' }: LanguageSwitcherProps) {
  const { user, uiLanguage, setUiLanguage, updateProfile } = useAuthStore();

  const currentLang = (user?.language ?? uiLanguage ?? 'es') as 'es' | 'en';
  const nextLang: 'es' | 'en' = currentLang === 'es' ? 'en' : 'es';

  const handleToggle = async () => {
    setUiLanguage(nextLang);
    if (user) {
      await updateProfile({ language: nextLang });
    }
  };

  if (variant === 'floating') {
    return (
      <button
        onClick={handleToggle}
        title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
        className="flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 rounded-lg text-xs font-medium transition-all"
        style={{
          color: 'var(--home-glass-text)',
          background: 'var(--home-glass)',
          border: '1px solid var(--home-glass-border)',
        }}
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang.toUpperCase()}</span>
        <span className="hidden sm:inline" style={{ color: 'var(--home-text-4)' }}>·</span>
        <span className="hidden sm:inline" style={{ color: 'var(--home-text-3)' }}>{nextLang.toUpperCase()}</span>
      </button>
    );
  }

  return (
    <button
      onClick={handleToggle}
      title={currentLang === 'es' ? 'Switch to English' : 'Cambiar a Español'}
      className="flex items-center gap-1.5 p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface/50 transition-all"
    >
      <Globe className="w-4 h-4" />
      <span className="text-xs font-medium hidden sm:block">{currentLang.toUpperCase()}</span>
    </button>
  );
}
