'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { socketService } from '@/services/socketService';
import { Loader2 } from 'lucide-react';

interface DashboardStats {
  workspaceCount: number;
  activeBoardCount: number;
  totalCardCount: number;
  totalMemberCount: number;
}

interface ActivityEvent {
  id: string;
  type: string;
  message: string;
  timestamp: string;
  icon: string;
  color: string;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, accessToken } = useAuthStore();

  const [stats, setStats] = useState<DashboardStats>({
    workspaceCount: 0,
    activeBoardCount: 0,
    totalCardCount: 0,
    totalMemberCount: 0,
  });

  const [recentActivity, setRecentActivity] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchDashboardStats = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/stats`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();
        setStats(data);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching stats:', error);
    }
  };

  const fetchRecentActivity = async () => {
    if (!accessToken) return;

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/users/me/activity`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (response.ok) {
        const { data } = await response.json();

        const activities: ActivityEvent[] = data.events.map((event: any) => ({
          id: event.id,
          type: event.type,
          message: formatActivityMessage(event),
          timestamp: event.timestamp,
          icon: getActivityIcon(event.type),
          color: getActivityColor(event.type),
        }));

        setRecentActivity(activities);
      }
    } catch (error) {
      console.error('[Dashboard] Error fetching activity:', error);
    }
  };

  const formatActivityMessage = (event: any): string => {
    switch (event.type) {
      case 'workspace.created':
        return `Created workspace "${event.payload.name}"`;
      case 'board.created':
        return `Created board "${event.payload.title || event.payload.name}"`;
      case 'card.created':
        return `Created card "${event.payload.title}"`;
      case 'card.updated':
        return `Updated card "${event.payload.title}"`;
      case 'comment.created':
        return `Commented on a card`;
      case 'list.created':
        return `Created list "${event.payload.name}"`;
      case 'user.registered':
        return 'Account created successfully';
      default:
        return event.type;
    }
  };

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'workspace.created':
        return '▣';
      case 'board.created':
        return '▦';
      case 'list.created':
        return '▨';
      case 'card.created':
      case 'card.updated':
        return '▤';
      case 'comment.created':
        return '💬';
      case 'user.registered':
        return '✓';
      default:
        return '•';
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'workspace.created':
      case 'board.created':
        return 'text-success';
      case 'card.created':
        return 'text-accent';
      case 'card.updated':
        return 'text-warning';
      case 'comment.created':
        return 'text-blue-500';
      case 'list.created':
        return 'text-purple-500';
      default:
        return 'text-text-muted';
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      await Promise.all([fetchDashboardStats(), fetchRecentActivity()]);
      setIsLoading(false);
    };

    loadDashboard();
  }, [accessToken]);

  useEffect(() => {
    if (!socketService.isConnected()) return;

    const handleRealtimeEvent = (event: any) => {
      console.log('[Dashboard] Realtime event:', event);
      fetchDashboardStats();

      const newActivity: ActivityEvent = {
        id: event.id || Date.now().toString(),
        type: event.type,
        message: formatActivityMessage(event),
        timestamp: event.timestamp || new Date().toISOString(),
        icon: getActivityIcon(event.type),
        color: getActivityColor(event.type),
      };

      setRecentActivity((prev) => [newActivity, ...prev].slice(0, 20));
    };

    socketService.on('workspace.created', handleRealtimeEvent);
    socketService.on('board.created', handleRealtimeEvent);
    socketService.on('card.created', handleRealtimeEvent);
    socketService.on('card.updated', handleRealtimeEvent);
    socketService.on('comment.created', handleRealtimeEvent);
    socketService.on('list.created', handleRealtimeEvent);

    return () => {
      socketService.off('workspace.created', handleRealtimeEvent);
      socketService.off('board.created', handleRealtimeEvent);
      socketService.off('card.created', handleRealtimeEvent);
      socketService.off('card.updated', handleRealtimeEvent);
      socketService.off('comment.created', handleRealtimeEvent);
      socketService.off('list.created', handleRealtimeEvent);
    };
  }, []);

  const statCards = [
    {
      label: 'Workspaces',
      value: stats.workspaceCount.toString(),
      icon: '▣',
      color: 'text-accent',
    },
    {
      label: 'Active Boards',
      value: stats.activeBoardCount.toString(),
      icon: '▦',
      color: 'text-success',
    },
    {
      label: 'Total Cards',
      value: stats.totalCardCount.toString(),
      icon: '▤',
      color: 'text-warning',
    },
    {
      label: 'Team Members',
      value: stats.totalMemberCount.toString(),
      icon: '◉',
      color: 'text-accent',
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Cargando dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="card-terminal">
        <h1 className="text-2xl mb-2">
          Welcome back, <span className="text-accent">{user?.name}</span>
        </h1>
        <p className="text-text-secondary text-sm">
          Here's what's happening with your projects today.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((stat) => (
          <div key={stat.label} className="card-terminal">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-text-muted text-xs mb-1">{stat.label}</p>
                <p className="text-3xl font-bold text-text-primary">{stat.value}</p>
              </div>
              <span className={`text-3xl ${stat.color}`}>{stat.icon}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* RECENT ACTIVITY */}
        <div className="card-terminal flex flex-col h-[259px]">
          <h2 className="section-header flex-shrink-0">RECENT ACTIVITY</h2>
          <div className="activity-scroll flex-1 overflow-y-auto pr-2 space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start gap-3 p-3 bg-background rounded-terminal border border-border"
                >
                  <span className={`text-lg ${activity.color}`}>{activity.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary">{activity.message}</p>
                    <p className="text-xs text-text-muted mt-1">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-text-muted text-sm text-center py-8">No recent activity</p>
            )}
          </div>
        </div>

        {/* QUICK ACTIONS */}
        <div className="card-terminal">
          <h2 className="section-header">QUICK ACTIONS</h2>
          <div className="space-y-3">
            <button
              className="btn-primary w-full"
              onClick={() => router.push('/dashboard/workspaces?create=true')}
            >
              <span className="flex items-center justify-center gap-2">
                <span>+</span>
                <span>Create Workspace</span>
              </span>
            </button>
            <button className="btn-secondary w-full">
              <span className="flex items-center justify-center gap-2">
                <span>+</span>
                <span>Create Document</span>
              </span>
            </button>
          </div>
        </div>
      </div>

      <div className="card-terminal bg-card">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <div className="space-y-1">
            <p>User ID: {user?.id.slice(0, 8)}...</p>
            <p>Session: Active</p>
          </div>
          <div className="space-y-1 text-right">
            <p>Event Store: Connected</p>
            <p>WebSocket: {socketService.isConnected() ? 'Ready' : 'Connecting...'}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
