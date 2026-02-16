// apps/web/src/lib/utils/phone.ts

/**
 * Prefijos internacionales y sus patrones de formateo.
 * El patrón define cuántos dígitos van en cada grupo tras el prefijo.
 * Ej: [3, 3, 4] → "XXX XXX XXXX"
 */
const COUNTRY_FORMATS: { prefix: string; groups: number[] }[] = [
  // América
  { prefix: '+1', groups: [3, 3, 4] }, // EE.UU. / Canadá: +1 XXX XXX XXXX
  { prefix: '+52', groups: [2, 4, 4] }, // México: +52 XX XXXX XXXX
  { prefix: '+54', groups: [2, 4, 4] }, // Argentina: +54 XX XXXX XXXX
  { prefix: '+55', groups: [2, 5, 4] }, // Brasil: +55 XX XXXXX XXXX
  { prefix: '+56', groups: [1, 4, 4] }, // Chile: +56 X XXXX XXXX
  { prefix: '+57', groups: [3, 7] }, // Colombia: +57 XXX XXXXXXX
  { prefix: '+51', groups: [3, 3, 3] }, // Perú: +51 XXX XXX XXX
  { prefix: '+58', groups: [3, 7] }, // Venezuela: +58 XXX XXXXXXX
  { prefix: '+593', groups: [2, 3, 4] }, // Ecuador: +593 XX XXX XXXX
  { prefix: '+595', groups: [3, 3, 3] }, // Paraguay: +595 XXX XXX XXX
  { prefix: '+598', groups: [4, 4] }, // Uruguay: +598 XXXX XXXX
  { prefix: '+591', groups: [8] }, // Bolivia: +591 XXXXXXXX
  // Europa
  { prefix: '+34', groups: [3, 3, 3] }, // España: +34 XXX XXX XXX
  { prefix: '+44', groups: [4, 6] }, // Reino Unido: +44 XXXX XXXXXX
  { prefix: '+33', groups: [1, 2, 2, 2, 2] }, // Francia: +33 X XX XX XX XX
  { prefix: '+49', groups: [3, 4, 4] }, // Alemania: +49 XXX XXXX XXXX
  { prefix: '+39', groups: [3, 4, 4] }, // Italia: +39 XXX XXXX XXXX
  { prefix: '+351', groups: [3, 3, 3] }, // Portugal: +351 XXX XXX XXX
  { prefix: '+31', groups: [2, 4, 4] }, // Países Bajos: +31 XX XXXX XXXX
  { prefix: '+32', groups: [3, 2, 2, 2] }, // Bélgica: +32 XXX XX XX XX
  { prefix: '+41', groups: [2, 3, 2, 2] }, // Suiza: +41 XX XXX XX XX
  { prefix: '+43', groups: [3, 4, 4] }, // Austria: +43 XXX XXXX XXXX
  // Resto del mundo (genérico)
  { prefix: '+', groups: [3, 3, 4] }, // Fallback genérico
];

/**
 * Detecta el formato del país según el prefijo más largo que coincida.
 */
function detectFormat(digits: string): { prefix: string; groups: number[] } | null {
  // digits incluye el '+' y los dígitos del prefijo + número
  const sorted = COUNTRY_FORMATS.slice().sort((a, b) => b.prefix.length - a.prefix.length);
  return sorted.find((f) => digits.startsWith(f.prefix)) ?? null;
}

/**
 * Formatea un número de teléfono para mostrar en la UI.
 * Input:  "+56912345678"  (valor limpio de la BD)
 * Output: "+56 9 1234 5678"
 */
export function formatPhoneDisplay(raw: string): string {
  if (!raw) return '';

  // Solo trabajamos con + y dígitos
  const clean = raw.replace(/[^\d+]/g, '').replace(/(?!^\+)\+/g, '');
  if (!clean.startsWith('+')) return clean;

  const fmt = detectFormat(clean);
  if (!fmt) return clean;

  const afterPrefix = clean.slice(fmt.prefix.length);
  const groups: string[] = [];
  let pos = 0;

  for (const size of fmt.groups) {
    const chunk = afterPrefix.slice(pos, pos + size);
    if (!chunk) break;
    groups.push(chunk);
    pos += size;
  }

  // Si quedan dígitos, añadirlos al último grupo
  if (pos < afterPrefix.length) {
    groups.push(afterPrefix.slice(pos));
  }

  return groups.length > 0 ? `${fmt.prefix} ${groups.join(' ')}` : fmt.prefix;
}

/**
 * Limpia el valor formateado para guardar en la BD: solo '+' y dígitos.
 * "+56 9 1234 5678" → "+56912345678"
 */
export function cleanPhoneValue(formatted: string): string {
  return formatted.replace(/[^\d+]/g, '').replace(/(?!^\+)\+/g, '');
}

/**
 * Valida un número de teléfono.
 * - Debe empezar con '+'
 * - Entre 7 y 15 dígitos en total (estándar E.164)
 */
export function validatePhone(raw: string): { valid: boolean; error?: string } {
  if (!raw) return { valid: true }; // Campo opcional

  const clean = cleanPhoneValue(raw);

  if (!clean.startsWith('+')) {
    return { valid: false, error: 'no_prefix' };
  }

  const digitsOnly = clean.slice(1); // sin el '+'
  if (digitsOnly.length < 6) {
    return { valid: false, error: 'too_short' };
  }
  if (digitsOnly.length > 15) {
    return { valid: false, error: 'too_long' };
  }
  if (!/^\d+$/.test(digitsOnly)) {
    return { valid: false, error: 'invalid_chars' };
  }

  return { valid: true };
}
