// apps/web/src/hooks/useWorkspaceMembers.ts

import { useState, useEffect } from 'react';
import { apiService } from '@/services/apiService';

export interface WorkspaceMember {
  id: string;
  name: string;
  email: string;
  avatar?: string | null;
}

/**
 * Hook para obtener miembros del workspace actual
 */
export function useWorkspaceMembers(workspaceId?: string) {
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!workspaceId) {
      setMembers([]);
      return;
    }

    const fetchMembers = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiService.get<{ members: any[] }>(
          `/api/workspaces/${workspaceId}/members`,
          true
        );

        if (!response.success) {
          throw new Error(response.error?.message || 'Failed to fetch workspace members');
        }

        const membersData = response.data?.members || [];

        const transformedMembers: WorkspaceMember[] = membersData.map((item: any) => {
          if (item.name && item.email) {
            return { id: item.id, name: item.name, email: item.email, avatar: item.avatar || null };
          }
          if (item.user) {
            return {
              id: item.user.id || item.userId,
              name: item.user.name,
              email: item.user.email,
              avatar: item.user.avatar || null,
            };
          }
          return item;
        });

        setMembers(transformedMembers);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
        setMembers([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMembers();
  }, [workspaceId]);

  return { members, isLoading, error };
}
