'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

// AI Builder is intentionally disabled until its product flow is project-scoped.
// Keeping the redirect explicit avoids exposing an orphaned feature entry point.
export default function AiBuilderPage() {
  const router = useRouter();
  useEffect(() => { router.replace('/dashboard'); }, []);
  return null;
}
