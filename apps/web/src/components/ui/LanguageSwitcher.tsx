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
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-surface/80 backdrop-blur-sm text-text-secondary hover:text-text-primary hover:border-accent/40 transition-all text-xs font-medium shadow-sm"
      >
        <Globe className="w-3.5 h-3.5" />
        <span>{currentLang === 'es' ? 'ES' : 'EN'}</span>
        <span className="text-text-muted">·</span>
        <span className="text-text-muted">{currentLang === 'es' ? 'EN' : 'ES'}</span>
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
