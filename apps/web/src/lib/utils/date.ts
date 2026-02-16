// apps/web/src/lib/utils/date.ts
// Utilidades de formato de fecha que respetan la zona horaria y el idioma del usuario

import { formatDistanceToNow, format, isValid, parseISO } from 'date-fns';
import { es, enUS, type Locale } from 'date-fns/locale';

export type SupportedLanguage = 'es' | 'en';
export type SupportedTimezone = string; // IANA timezone: 'America/New_York', 'Europe/Madrid', 'UTC', etc.

const LOCALES: Record<SupportedLanguage, Locale> = {
  es,
  en: enUS,
};

/**
 * Convierte una fecha a la zona horaria del usuario y la formatea.
 * @param date - string ISO, Date, o timestamp
 * @param timezone - IANA timezone string (ej: 'Europe/Madrid', 'UTC', 'America/New_York')
 * @param language - idioma del usuario ('es' | 'en')
 * @param formatStr - formato de date-fns (por defecto: 'dd MMM yyyy, HH:mm')
 */
export function formatDate(
  date: string | Date | number | null | undefined,
  timezone: string = 'UTC',
  language: SupportedLanguage = 'es',
  formatStr: string = 'dd MMM yyyy, HH:mm'
): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '';

    // Usar Intl para convertir a la zona horaria correcta
    const locale = LOCALES[language] || es;

    // Convertir a la timezone del usuario usando Intl.DateTimeFormat
    const options: Intl.DateTimeFormatOptions = {
      timeZone: isValidTimezone(timezone) ? timezone : 'UTC',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    };

    // Extraer partes en la timezone del usuario
    const parts = new Intl.DateTimeFormat('en-US', options).formatToParts(d);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

    const localDate = new Date(
      `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`
    );

    return format(localDate, formatStr, { locale });
  } catch {
    return '';
  }
}

/**
 * Formato relativo ("hace 2 horas") respetando el idioma del usuario.
 */
export function formatRelative(
  date: string | Date | number | null | undefined,
  language: SupportedLanguage = 'es'
): string {
  if (!date) return '';

  try {
    const d = typeof date === 'string' ? parseISO(date) : new Date(date);
    if (!isValid(d)) return '';

    const locale = LOCALES[language] || es;
    return formatDistanceToNow(d, { addSuffix: true, locale });
  } catch {
    return '';
  }
}

/**
 * Formato corto de fecha (ej: "12 ene 2025")
 */
export function formatShort(
  date: string | Date | number | null | undefined,
  timezone: string = 'UTC',
  language: SupportedLanguage = 'es'
): string {
  return formatDate(date, timezone, language, language === 'en' ? 'MMM d, yyyy' : 'dd MMM yyyy');
}

/**
 * Formato solo hora (ej: "14:30")
 */
export function formatTime(
  date: string | Date | number | null | undefined,
  timezone: string = 'UTC',
  language: SupportedLanguage = 'es'
): string {
  return formatDate(date, timezone, language, 'HH:mm');
}

/**
 * Valida si un string es un timezone IANA válido
 */
export function isValidTimezone(tz: string): boolean {
  if (!tz) return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Devuelve el offset UTC actual del timezone (ej: "UTC+2")
 */
export function getTimezoneOffset(timezone: string): string {
  try {
    const now = new Date();
    const formatted = new Intl.DateTimeFormat('en', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
    }).formatToParts(now);
    return formatted.find((p) => p.type === 'timeZoneName')?.value ?? 'UTC';
  } catch {
    return 'UTC';
  }
}
