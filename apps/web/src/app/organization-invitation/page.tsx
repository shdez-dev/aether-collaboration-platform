'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';

export default function OrganizationInvitationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const { isAuthenticated, isHydrated } = useAuthStore();
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isHydrated && !isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(`/organization-invitation?token=${token}`)}`);
    }
  }, [isAuthenticated, isHydrated, router, token]);

  const accept = async () => {
    setLoading(true); setError('');
    const response = await apiService.post<{ message: string }>(`/api/organizations/invitations/${token}/accept`, {}, true);
    setLoading(false);
    if (!response.success) return setError(response.error?.message ?? 'No fue posible aceptar la invitación.');
    setMessage('Ya eres parte de la organización. Ahora puedes acceder a los espacios que te asignen.');
  };

  if (!isHydrated) return null;
  return (
    <main className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--c-bg)', color: 'var(--c-text)' }}>
      <section className="w-full max-w-md rounded-xl p-7" style={{ background: 'var(--c-surface)', border: '1px solid rgba(97,71,130,.1)' }}>
        <p className="text-xs uppercase tracking-widest mb-3" style={{ color: 'var(--c-accent-text)' }}>Aether</p>
        <h1 className="text-2xl font-semibold mb-3">Invitación a organización</h1>
        {!token && <p style={{ color: '#FCA5A5' }}>El enlace de invitación no es válido.</p>}
        {token && !message && <>
          <p className="text-sm mb-6" style={{ color: '#B8B0A3' }}>Acepta para incorporarte a la organización. El acceso a sus workspaces se otorga por separado.</p>
          {error && <p className="text-sm mb-4" style={{ color: '#FCA5A5' }}>{error}</p>}
          <button disabled={loading || !isAuthenticated} onClick={accept} className="w-full rounded-lg px-4 py-2.5 font-semibold disabled:opacity-50" style={{ background: '#7452A6', color: '#1A120E' }}>
            {loading ? 'Aceptando…' : 'Aceptar invitación'}
          </button>
        </>}
        {message && <>
          <p className="text-sm mb-6" style={{ color: '#A7DCA8' }}>{message}</p>
          <button onClick={() => router.push('/dashboard')} className="w-full rounded-lg px-4 py-2.5 font-semibold" style={{ background: '#7452A6', color: '#1A120E' }}>Ir al dashboard</button>
        </>}
      </section>
    </main>
  );
}
