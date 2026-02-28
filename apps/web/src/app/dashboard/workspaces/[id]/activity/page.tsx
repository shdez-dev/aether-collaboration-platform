'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, AlertCircle, Activity } from 'lucide-react';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import {
  ActivityFiltersComponent,
  type ActivityFilters,
} from '@/components/activity/ActivityFilters';
import { type ActivityLogEntry } from '@/lib/utils/activityLog';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const EVENTS_PER_PAGE = 20;

export default function WorkspaceActivityPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { currentWorkspace, fetchWorkspaceById, currentMembers, fetchMembers } =
    useWorkspaceStore();
  const { accessToken } = useAuthStore();

  // State
  const [events, setEvents] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const [filters, setFilters] = useState<ActivityFilters>({
    eventTypes: [],
    startDate: undefined,
    endDate: undefined,
    userId: undefined,
    boardId: undefined,
  });

  // Boards for filters (we'll fetch them separately if needed)
  const [boards, setBoards] = useState<Array<{ id: string; name: string }>>([]);

  // Fetch workspace and members on mount
  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceById(workspaceId);
      fetchMembers(workspaceId);
      fetchBoards();
    }
  }, [workspaceId]);

  // Fetch boards for filter dropdown
  const fetchBoards = async () => {
    try {
      if (!accessToken) return;

      const response = await apiService.get<{ boards: Array<{ id: string; name: string }> }>(
        `/api/workspaces/${workspaceId}/boards`,
        true
      );

      if (!response.success || !response.data) {
        throw new Error('Failed to fetch boards');
      }

      setBoards(response.data.boards || []);
    } catch (err) {
      // Error fetching boards
    }
  };

  // Fetch activity log
  const fetchActivity = useCallback(
    async (reset = false) => {
      try {
        if (reset) {
          setIsLoading(true);
          setOffset(0);
          setEvents([]);
        } else {
          setIsLoadingMore(true);
        }

        setError(null);

        if (!accessToken) {
          throw new Error('No estás autenticado. Por favor, inicia sesión nuevamente.');
        }

        const queryParams = new URLSearchParams();

        // Add pagination
        queryParams.append('limit', EVENTS_PER_PAGE.toString());
        queryParams.append('offset', (reset ? 0 : offset).toString());

        // Add filters
        if (filters.eventTypes.length > 0) {
          queryParams.append('eventTypes', filters.eventTypes.join(','));
        }
        if (filters.startDate) {
          queryParams.append('startDate', filters.startDate);
        }
        if (filters.endDate) {
          queryParams.append('endDate', filters.endDate);
        }
        if (filters.userId) {
          queryParams.append('userId', filters.userId);
        }
        if (filters.boardId) {
          queryParams.append('boardId', filters.boardId);
        }

        const endpoint = `/api/workspaces/${workspaceId}/activity?${queryParams}`;

        const response = await apiService.get<{
          events: ActivityLogEntry[];
          pagination: { total: number; limit: number; offset: number; hasMore: boolean };
        }>(endpoint, true);

        if (!response.success || !response.data) {
          if (
            response.error?.code === 'UNAUTHORIZED' ||
            response.error?.code === 'SESSION_EXPIRED'
          ) {
            throw new Error('Tu sesión ha expirado. Por favor, inicia sesión nuevamente.');
          } else if (response.error?.code === 'NOT_WORKSPACE_MEMBER') {
            throw new Error('No tienes acceso a este workspace.');
          }
          throw new Error(
            response.error?.message || 'No se pudo cargar el historial de actividad.'
          );
        }

        const newEvents: ActivityLogEntry[] = response.data.events || [];

        if (reset) {
          setEvents(newEvents);
        } else {
          setEvents((prev) => [...prev, ...newEvents]);
        }

        setHasMore(newEvents.length === EVENTS_PER_PAGE);
        setOffset((prev) => (reset ? EVENTS_PER_PAGE : prev + EVENTS_PER_PAGE));
      } catch (err) {
        setError('No se pudo cargar el historial de actividad. Intenta nuevamente.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    [workspaceId, offset, filters]
  );

  // Initial fetch
  useEffect(() => {
    fetchActivity(true);
  }, [workspaceId, filters]);

  // Load more handler
  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMore) {
      fetchActivity(false);
    }
  }, [isLoadingMore, hasMore, fetchActivity]);

  // Filter change handler
  const handleFiltersChange = (newFilters: ActivityFilters) => {
    setFilters(newFilters);
    setOffset(0);
    setEvents([]);
  };

  // Prepare users for filter dropdown
  const usersForFilter = currentMembers.map((m) => ({
    id: m.userId,
    name: m.user?.name || 'Unknown User',
  }));

  return (
    <div className="space-y-6">
      {/* Header Navigation */}
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.workspace_btn_back}</span>
        </Link>

        {currentWorkspace && (
          <div className="flex items-center gap-3 px-4 py-2 bg-surface border border-border">
            <Activity className="w-4 h-4 text-text-muted" />
            <div>
              <p className="text-xs text-text-muted">Workspace</p>
              <p className="text-sm font-medium text-text-primary">{currentWorkspace.name}</p>
            </div>
          </div>
        )}
      </div>

      {/* Page Header */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-accent/10 border border-accent/30">
            <Activity className="w-5 h-5 text-accent" />
          </div>
          <h1 className="text-2xl font-bold text-text-primary">{t.activity_page_title}</h1>
        </div>
        <p className="text-sm text-text-muted">{t.activity_page_subtitle}</p>
      </div>

      {/* Error State */}
      {error && (
        <div className="bg-error/10 border border-error p-4 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-error flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-text-primary mb-1">
              {t.activity_error_loading_title}
            </p>
            <p className="text-sm text-text-secondary mb-3">{error}</p>
            <button onClick={() => fetchActivity(true)} className="btn-primary text-sm">
              {t.activity_btn_retry}
            </button>
          </div>
        </div>
      )}

      {/* Layout: Filters + Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Filters Sidebar */}
        <div className="lg:sticky lg:top-6 lg:self-start">
          <ActivityFiltersComponent
            filters={filters}
            onChange={handleFiltersChange}
            users={usersForFilter}
            boards={boards}
          />
        </div>

        {/* Timeline */}
        <div className="min-w-0">
          <ActivityTimeline
            events={events}
            onLoadMore={handleLoadMore}
            hasMore={hasMore}
            isLoading={isLoading}
            isLoadingMore={isLoadingMore}
          />
        </div>
      </div>
    </div>
  );
}
