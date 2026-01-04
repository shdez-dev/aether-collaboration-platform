'use client';

import { useAuthStore } from '@/stores/authStore';

export default function DashboardPage() {
  const { user } = useAuthStore();

  const stats = [
    {
      label: 'Workspaces',
      value: '0',
      icon: '▣',
      color: 'text-accent',
    },
    {
      label: 'Active Boards',
      value: '0',
      icon: '▦',
      color: 'text-success',
    },
    {
      label: 'Total Cards',
      value: '0',
      icon: '▤',
      color: 'text-warning',
    },
    {
      label: 'Team Members',
      value: '1',
      icon: '◉',
      color: 'text-accent',
    },
  ];

  const recentActivity = [
    {
      type: 'user.registered',
      message: 'Account created successfully',
      timestamp: new Date().toISOString(),
      icon: '✓',
      color: 'text-success',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Header */}
      <div className="card-terminal">
        <h1 className="text-2xl mb-2">
          Welcome back, <span className="text-accent">{user?.name}</span>
        </h1>
        <p className="text-text-secondary text-sm">
          Here's what's happening with your projects today.
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => (
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

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Activity */}
        <div className="card-terminal">
          <h2 className="section-header">RECENT ACTIVITY</h2>
          <div className="space-y-3">
            {recentActivity.length > 0 ? (
              recentActivity.map((activity, index) => (
                <div
                  key={index}
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

        {/* Quick Actions */}
        <div className="card-terminal">
          <h2 className="section-header">QUICK ACTIONS</h2>
          <div className="space-y-3">
            <button className="btn-primary w-full">
              <span className="flex items-center justify-center gap-2">
                <span>+</span>
                <span>Create Workspace</span>
              </span>
            </button>
            <button className="btn-secondary w-full">
              <span className="flex items-center justify-center gap-2">
                <span>+</span>
                <span>Create Board</span>
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

      {/* Getting Started */}
      <div className="card-terminal bg-accent/5 border-accent/50">
        <h2 className="section-header text-accent">GETTING STARTED</h2>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <span className="text-accent text-xl">1.</span>
            <div>
              <h3 className="text-text-primary font-medium mb-1">Create your first workspace</h3>
              <p className="text-text-secondary text-sm">
                Workspaces help you organize projects and collaborate with your team.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-accent text-xl">2.</span>
            <div>
              <h3 className="text-text-primary font-medium mb-1">Set up your first board</h3>
              <p className="text-text-secondary text-sm">
                Boards use a Kanban-style layout to help you track tasks and progress.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-accent text-xl">3.</span>
            <div>
              <h3 className="text-text-primary font-medium mb-1">Invite team members</h3>
              <p className="text-text-secondary text-sm">
                Collaborate in real-time with your team members across all your projects.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* System Info */}
      <div className="card-terminal bg-card">
        <div className="flex items-center justify-between text-xs text-text-muted">
          <div className="space-y-1">
            <p>User ID: {user?.id.slice(0, 8)}...</p>
            <p>Session: Active</p>
          </div>
          <div className="space-y-1 text-right">
            <p>Event Store: Connected</p>
            <p>WebSocket: Ready</p>
          </div>
        </div>
      </div>
    </div>
  );
}
