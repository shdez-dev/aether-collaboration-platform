// apps/web/src/hooks/useWorkspaceMembers.ts

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

/**
 * Hook para obtener miembros del workspace actual
 * Usa la misma lógica que MemberPicker (que sí funciona)
 */
export function useWorkspaceMembers(workspaceId?: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accessToken } = useAuthStore();

  useEffect(() => {
    // No hacer fetch si no hay workspaceId o accessToken
    if (!workspaceId || !accessToken) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}/members`,
          {
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch workspace members');
        }

        const { data } = await response.json();

        // Usar la misma lógica de transformación que MemberPicker
        const membersData = data.members || data || [];

        const transformedMembers: WorkspaceMember[] = membersData.map((item: any) => {
          // Si ya tiene la estructura correcta
          if (item.name && item.email) {
            return {
              id: item.id,
              name: item.name,
              email: item.email,
              avatar: item.avatar || null,
            };
          }

          // Si viene con estructura { user: {...} }
          if (item.user) {
            return {
              id: item.user.id || item.userId,
              name: item.user.name,
              email: item.user.email,
              avatar: item.user.avatar || null,
            };
          }

          // Fallback
          return item;
        });

        setMembers(transformedMembers);
      } catch (err) {
        console.error('[useWorkspaceMembers] Error:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [workspaceId, accessToken]);

  return { members, isLoading, error };
}
