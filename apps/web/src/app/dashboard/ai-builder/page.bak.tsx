'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// AI Builder temporalmente deshabilitado.
// El codigo original esta en page.bak.tsx
// Para reactivar: reemplazar este archivo con page.bak.tsx
export default function AiBuilderPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, []);
  return null;
}
