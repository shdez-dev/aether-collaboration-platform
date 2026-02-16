// apps/web/src/lib/i18n/index.ts

import { es } from './es';
import { en } from './en';
import { useAuthStore } from '@/stores/authStore';

export type Language = 'es' | 'en';

const dictionaries = { es, en } as const;

/**
 * Hook principal de traducciones.
 * Lee el idioma del usuario desde el store y devuelve el diccionario correcto.
 *
 * Uso:
 *   const t = useT();
 *   <p>{t('profile_title')}</p>
 *   <p>{t('dashboard_cards_total', 5)}</p>   // para funciones con argumentos
 */
export function useT() {
  const language = useAuthStore((state) => state.user?.language) as Language | undefined;
  const lang: Language = language === 'en' ? 'en' : 'es';
  return dictionaries[lang];
}

/**
 * Versión sin hook (para uso fuera de componentes React, ej: utilidades).
 */
export function getT(language?: string) {
  const lang: Language = language === 'en' ? 'en' : 'es';
  return dictionaries[lang];
}

export { es, en };
export type { Translations } from './es';
