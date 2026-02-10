// apps/web/src/lib/utils/avatar.ts

/**
 * Construye la URL completa del avatar
 * @param avatarPath - Path del avatar (puede ser: nombre de archivo, path relativo, o URL completa)
 * @returns URL completa del avatar
 */
export function getAvatarUrl(avatarPath: string | null | undefined): string | null {
  if (!avatarPath) return null;

  // Si ya es una URL completa, devolverla tal cual
  if (avatarPath.startsWith('http://') || avatarPath.startsWith('https://')) {
    return avatarPath;
  }

  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

  // Si empieza con /uploads, construir URL completa
  if (avatarPath.startsWith('/uploads')) {
    return `${apiUrl}${avatarPath}`;
  }

  // Si empieza con uploads/ (sin barra inicial)
  if (avatarPath.startsWith('uploads/')) {
    return `${apiUrl}/${avatarPath}`;
  }

  // Si es solo el nombre del archivo, construir path completo
  // Asumiendo que está en /uploads/avatars/
  return `${apiUrl}/uploads/avatars/${avatarPath}`;
}

/**
 * Obtiene las iniciales de un nombre para el avatar fallback
 * @param name - Nombre completo
 * @returns Iniciales (máximo 2 caracteres)
 */
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}
