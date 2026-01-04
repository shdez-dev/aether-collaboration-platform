// apps/web/src/app/dashboard/workspaces/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';

export default function WorkspacesPage() {
  const { workspaces, isLoading, fetchWorkspaces } = useWorkspaceStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'text-accent border-accent/50 bg-accent/10';
      case 'ADMIN':
        return 'text-success border-success/50 bg-success/10';
      case 'MEMBER':
        return 'text-text-secondary border-border bg-card';
      case 'VIEWER':
        return 'text-text-muted border-border-light bg-surface';
      default:
        return 'text-text-secondary border-border bg-card';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal mb-1">Workspaces</h1>
          <p className="text-text-secondary text-sm">
            Gestiona tus espacios de trabajo y colabora con tu equipo
          </p>
        </div>
        <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
          <span className="flex items-center gap-2">
            <span>+</span>
            <span>Create Workspace</span>
          </span>
        </button>
      </div>

      {/* Loading State */}
      {isLoading && workspaces.length === 0 && (
        <div className="card-terminal">
          <div className="flex flex-col items-center justify-center py-12">
            <div className="loading-lg mb-4" />
            <p className="text-text-secondary text-sm">Loading workspaces...</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && workspaces.length === 0 && (
        <div className="card-terminal bg-accent/5 border-accent/50">
          <div className="text-center py-12">
            <div className="text-6xl mb-4">▣</div>
            <h3 className="text-xl mb-2">No workspaces yet</h3>
            <p className="text-text-secondary text-sm mb-6">
              Create your first workspace to start organizing your projects
            </p>
            <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
              <span className="flex items-center gap-2">
                <span>+</span>
                <span>Create Workspace</span>
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Workspaces Grid */}
      {workspaces.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {workspaces.map((workspace) => (
            <Link
              key={workspace.id}
              href={`/dashboard/workspaces/${workspace.id}`}
              className="card-terminal hover:border-accent/50 transition-all group"
            >
              {/* Header */}
              <div className="flex items-start gap-3 mb-4">
                <div
                  className="w-12 h-12 rounded-terminal flex items-center justify-center text-2xl flex-shrink-0"
                  style={{
                    backgroundColor: `${workspace.color}20`,
                    color: workspace.color,
                  }}
                >
                  {workspace.icon || '▣'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-lg font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                    {workspace.name}
                  </h3>
                  <p className="text-xs text-text-muted truncate">
                    {workspace.description || 'No description'}
                  </p>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center gap-4 mb-4 text-sm">
                <div className="flex items-center gap-1">
                  <span className="text-text-muted">▦</span>
                  <span className="text-text-secondary">{workspace.boardCount || 0} boards</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-text-muted">◉</span>
                  <span className="text-text-secondary">{workspace.memberCount || 0} members</span>
                </div>
              </div>

              {/* Role Badge */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs px-2 py-1 rounded-terminal border ${getRoleBadgeColor(
                    workspace.userRole
                  )}`}
                >
                  {workspace.userRole || 'MEMBER'}
                </span>
                <span className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Create Modal */}
      <CreateWorkspaceModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />
    </div>
  );
}
