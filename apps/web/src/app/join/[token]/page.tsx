// apps/web/src/app/join/[token]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import { CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';

type Status = 'idle' | 'loading' | 'success' | 'error_invalid' | 'error_already' | 'error_auth';

interface JoinResponse {
  workspace: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
  };
}

export default function JoinWorkspacePage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { user } = useAuthStore();

  const [status, setStatus] = useState<Status>('idle');
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [workspaceName, setWorkspaceName] = useState<string>('');

  useEffect(() => {
    if (!user) {
      // Redirect to login preserving the join URL
      router.replace(`/login?redirect=/join/${token}`);
      return;
    }
    handleJoin();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleJoin = async () => {
    setStatus('loading');
    try {
      const response = await apiService.post<JoinResponse>(
        `/api/workspaces/join/${token}`,
        {},
        true
      );
      if (response.data?.workspace) {
        setWorkspaceId(response.data.workspace.id);
        setWorkspaceName(response.data.workspace.name);
        setStatus('success');
      } else {
        setStatus('error_invalid');
      }
    } catch (err: any) {
      const msg = err?.message?.toLowerCase() || '';
      if (msg.includes('already') || msg.includes('ya eres')) {
        setStatus('error_already');
      } else {
        setStatus('error_invalid');
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-md w-full bg-card border border-border p-8 text-center space-y-5">
        <h1 className="text-xl font-medium text-text-primary">{t.join_title}</h1>

        {(status === 'idle' || status === 'loading') && (
          <>
            <Loader2 className="w-10 h-10 mx-auto text-accent animate-spin" />
            <p className="text-sm text-text-secondary">{t.join_loading}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 mx-auto bg-success/10 border border-success flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-success" />
            </div>
            <div>
              <p className="text-sm font-medium text-text-primary">{t.join_success}</p>
              {workspaceName && <p className="text-xs text-text-secondary mt-1">{workspaceName}</p>}
            </div>
            <Link
              href={`/dashboard/workspaces/${workspaceId}`}
              className="block w-full px-4 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors text-center"
            >
              {t.join_btn_go}
            </Link>
          </>
        )}

        {(status === 'error_invalid' || status === 'error_already') && (
          <>
            <div className="w-16 h-16 mx-auto bg-error/10 border border-error flex items-center justify-center">
              <AlertTriangle className="w-8 h-8 text-error" />
            </div>
            <p className="text-sm text-text-secondary">
              {status === 'error_already' ? t.join_error_already : t.join_error_invalid}
            </p>
            <div className="flex gap-3">
              {status === 'error_invalid' && (
                <button
                  onClick={handleJoin}
                  className="flex-1 px-4 py-2.5 border border-border bg-surface text-text-primary text-sm font-medium hover:bg-card transition-colors"
                >
                  {t.join_btn_retry}
                </button>
              )}
              <Link
                href="/dashboard/workspaces"
                className="flex-1 px-4 py-2.5 bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors text-center"
              >
                {status === 'error_already' ? t.join_btn_go : t.join_btn_home}
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
