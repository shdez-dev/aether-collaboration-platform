'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import { Search, Star, Clock, Users, Grid3x3, LayoutGrid, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n';

type ViewMode = 'grid' | 'list';

export default function WorkspacesPage() {
  const t = useT();
  const router = useRouter();
  const { workspaces, isLoading, fetchWorkspaces } = useWorkspaceStore();
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetchWorkspaces();
    const savedFavorites = localStorage.getItem('aether-favorite-workspaces');
    if (savedFavorites) {
      setFavorites(new Set(JSON.parse(savedFavorites)));
    }
  }, [fetchWorkspaces]);

  const toggleFavorite = (e: React.MouseEvent, workspaceId: string) => {
    e.preventDefault();
    e.stopPropagation();

    const newFavorites = new Set(favorites);
    if (newFavorites.has(workspaceId)) {
      newFavorites.delete(workspaceId);
    } else {
      newFavorites.add(workspaceId);
    }
    setFavorites(newFavorites);
    localStorage.setItem('aether-favorite-workspaces', JSON.stringify([...newFavorites]));
  };

  const getRoleBadgeColor = (role?: string) => {
    switch (role) {
      case 'OWNER':
        return 'text-accent border-accent/50 bg-accent/20';
      case 'ADMIN':
        return 'text-success border-success/50 bg-success/20';
      case 'MEMBER':
        return 'text-text-secondary border-border bg-surface';
      case 'VIEWER':
        return 'text-text-muted border-text-muted/30 bg-text-muted/10';
      default:
        return 'text-text-secondary border-border bg-surface';
    }
  };

  const getRoleLabel = (role?: string) => {
    const labels: Record<string, string> = {
      OWNER: t.role_owner,
      ADMIN: t.role_admin,
      MEMBER: t.role_member,
      VIEWER: t.role_viewer,
    };
    return labels[role || 'MEMBER'] || t.role_member;
  };

  const filteredWorkspaces = workspaces.filter(
    (w) =>
      w.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      w.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const favoriteWorkspaces = filteredWorkspaces.filter((w) => favorites.has(w.id));
  const ownedWorkspaces = filteredWorkspaces.filter(
    (w) => w.userRole === 'OWNER' && !favorites.has(w.id)
  );
  const sharedWorkspaces = filteredWorkspaces.filter(
    (w) => w.userRole !== 'OWNER' && !favorites.has(w.id)
  );

  const recentWorkspaces = filteredWorkspaces.slice(0, 3);

  const WorkspaceCard = ({ workspace, compact = false }: any) => {
    const isFavorite = favorites.has(workspace.id);

    if (viewMode === 'list' || compact) {
      return (
        <Link
          href={`/dashboard/workspaces/${workspace.id}`}
          className="group flex items-center gap-4 p-4 border border-border bg-card hover:border-accent hover:bg-surface transition-all"
        >
          <div
            className="w-12 h-12 flex items-center justify-center text-2xl flex-shrink-0 border"
            style={{
              backgroundColor: `${workspace.color}15`,
              color: workspace.color,
              borderColor: `${workspace.color}40`,
            }}
          >
            {workspace.icon || '▣'}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-base font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                {workspace.name}
              </h3>
              <span
                className={`text-xs px-2 py-0.5 border font-medium ${getRoleBadgeColor(
                  workspace.userRole
                )}`}
              >
                {getRoleLabel(workspace.userRole)}
              </span>
            </div>
            <p className="text-sm text-text-secondary truncate">
              {workspace.description || t.no_description}
            </p>
          </div>

          <div className="flex items-center gap-4 text-sm text-text-muted">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="w-4 h-4" />
              <span>{workspace.boardCount || 0}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>{workspace.memberCount || 0}</span>
            </div>
          </div>

          <button
            onClick={(e) => toggleFavorite(e, workspace.id)}
            className={`p-2 transition-colors ${
              isFavorite
                ? 'text-warning hover:text-warning/70'
                : 'text-text-muted hover:text-warning'
            }`}
          >
            <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
          </button>
        </Link>
      );
    }

    return (
      <Link
        href={`/dashboard/workspaces/${workspace.id}`}
        className="group relative bg-card border border-border hover:border-accent transition-all p-5"
      >
        <button
          onClick={(e) => toggleFavorite(e, workspace.id)}
          className={`absolute top-4 right-4 p-1.5 transition-colors z-10 ${
            isFavorite
              ? 'text-warning hover:text-warning/70'
              : 'text-text-muted hover:text-warning opacity-0 group-hover:opacity-100'
          }`}
        >
          <Star className="w-4 h-4" fill={isFavorite ? 'currentColor' : 'none'} />
        </button>

        <div className="flex items-start gap-4 mb-4">
          <div
            className="w-14 h-14 flex items-center justify-center text-2xl flex-shrink-0 border"
            style={{
              backgroundColor: `${workspace.color}15`,
              color: workspace.color,
              borderColor: `${workspace.color}40`,
            }}
          >
            {workspace.icon || '▣'}
          </div>
          <div className="flex-1 min-w-0 pr-8">
            <h3 className="text-lg font-medium text-text-primary truncate group-hover:text-accent transition-colors mb-1">
              {workspace.name}
            </h3>
            <p className="text-sm text-text-secondary line-clamp-2">
              {workspace.description || t.no_description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 mb-4 text-sm text-text-muted">
          <div className="flex items-center gap-1.5">
            <LayoutGrid className="w-4 h-4" />
            <span className="font-medium">{workspace.boardCount || 0}</span>
            <span>{t.workspace_stat_boards}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Users className="w-4 h-4" />
            <span className="font-medium">{workspace.memberCount || 0}</span>
            <span>{t.workspace_stat_members}</span>
          </div>
        </div>

        <span
          className={`inline-flex items-center text-xs px-2 py-1 border font-medium ${getRoleBadgeColor(
            workspace.userRole
          )}`}
        >
          {getRoleLabel(workspace.userRole)}
        </span>
      </Link>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h1 className="text-2xl font-medium mb-2">{t.workspaces_title}</h1>
          <p className="text-text-secondary text-sm">{t.workspaces_subtitle}</p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 p-1 bg-surface border border-border">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-2 transition-colors ${
                viewMode === 'grid'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Vista en cuadrícula"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-2 transition-colors ${
                viewMode === 'list'
                  ? 'bg-accent text-white'
                  : 'text-text-muted hover:text-text-primary'
              }`}
              title="Vista en lista"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>
          </div>

          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>{t.workspaces_btn_create}</span>
            </span>
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
        <input
          type="text"
          placeholder={t.workspaces_search_placeholder}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-surface border border-border text-sm text-text-primary placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-primary"
          >
            ✕
          </button>
        )}
      </div>

      {/* Loading State */}
      {isLoading && workspaces.length === 0 && (
        <div className="bg-card border border-border p-12">
          <div className="flex flex-col items-center justify-center">
            <div className="loading-lg mb-4" />
            <p className="text-text-secondary text-sm">{t.workspaces_loading}</p>
          </div>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && workspaces.length === 0 && (
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-accent/10 border border-accent flex items-center justify-center">
            <LayoutGrid className="w-10 h-10 text-accent" />
          </div>
          <h3 className="text-xl font-medium mb-2">{t.workspaces_empty_title}</h3>
          <p className="text-text-secondary text-sm mb-6">{t.workspaces_empty_desc}</p>
          <button onClick={() => setIsCreateModalOpen(true)} className="btn-primary">
            <span className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              <span>{t.workspaces_btn_create}</span>
            </span>
          </button>
        </div>
      )}

      {/* Workspaces Content */}
      {workspaces.length > 0 && (
        <div className="space-y-0">
          {/* Recent Workspaces */}
          {!searchQuery && recentWorkspaces.length > 0 && (
            <>
              <div className="pb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-3.5 h-3.5 text-text-muted" />
                  <h2 className="text-xs font-medium text-text-primary uppercase tracking-wide">
                    {t.workspaces_section_recent}
                  </h2>
                </div>
                <div className="space-y-2">
                  {recentWorkspaces.map((workspace) => {
                    const isFavorite = favorites.has(workspace.id);
                    return (
                      <Link
                        key={workspace.id}
                        href={`/dashboard/workspaces/${workspace.id}`}
                        className="group flex items-center gap-3 p-2.5 border border-border bg-card hover:border-accent hover:bg-surface transition-all"
                      >
                        <div
                          className="w-9 h-9 flex items-center justify-center text-lg flex-shrink-0 border"
                          style={{
                            backgroundColor: `${workspace.color}15`,
                            color: workspace.color,
                            borderColor: `${workspace.color}40`,
                          }}
                        >
                          {workspace.icon || '▣'}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-medium text-text-primary truncate group-hover:text-accent transition-colors">
                              {workspace.name}
                            </h3>
                            <span
                              className={`text-[10px] px-1.5 py-0.5 border font-medium ${getRoleBadgeColor(
                                workspace.userRole
                              )}`}
                            >
                              {getRoleLabel(workspace.userRole)}
                            </span>
                          </div>
                          <p className="text-xs text-text-secondary truncate">
                            {workspace.description || t.no_description}
                          </p>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-text-muted">
                          <span className="flex items-center gap-1">
                            <LayoutGrid className="w-3.5 h-3.5" />
                            {workspace.boardCount || 0}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {workspace.memberCount || 0}
                          </span>
                        </div>

                        <button
                          onClick={(e) => toggleFavorite(e, workspace.id)}
                          className={`p-1 transition-colors ${
                            isFavorite
                              ? 'text-warning hover:text-warning/70'
                              : 'text-text-muted hover:text-warning opacity-0 group-hover:opacity-100'
                          }`}
                        >
                          <Star
                            className="w-3.5 h-3.5"
                            fill={isFavorite ? 'currentColor' : 'none'}
                          />
                        </button>
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* Separator Line */}
              <div className="border-t border-border my-8" />
            </>
          )}

          {/* Favorites */}
          {favoriteWorkspaces.length > 0 && (
            <>
              <div className="py-6">
                <div className="flex items-center gap-2 mb-4">
                  <Star className="w-4 h-4 text-warning" fill="currentColor" />
                  <h2 className="text-sm font-medium text-text-primary uppercase tracking-wide">
                    {t.workspaces_section_favorites}
                  </h2>
                  <span className="text-xs text-text-muted">({favoriteWorkspaces.length})</span>
                </div>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'space-y-3'
                  }
                >
                  {favoriteWorkspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} workspace={workspace} />
                  ))}
                </div>
              </div>

              {/* Separator Line */}
              <div className="border-t border-border my-8" />
            </>
          )}

          {/* My Workspaces */}
          {ownedWorkspaces.length > 0 && (
            <>
              <div className="py-6">
                <div className="flex items-center gap-2 mb-4">
                  <LayoutGrid className="w-4 h-4 text-accent" />
                  <h2 className="text-sm font-medium text-text-primary uppercase tracking-wide">
                    {t.workspaces_section_mine}
                  </h2>
                  <span className="text-xs text-text-muted">({ownedWorkspaces.length})</span>
                </div>
                <div
                  className={
                    viewMode === 'grid'
                      ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                      : 'space-y-3'
                  }
                >
                  {ownedWorkspaces.map((workspace) => (
                    <WorkspaceCard key={workspace.id} workspace={workspace} />
                  ))}
                </div>
              </div>

              {/* Separator Line - Solo si hay shared workspaces después */}
              {sharedWorkspaces.length > 0 && <div className="border-t border-border my-8" />}
            </>
          )}

          {/* Shared With Me */}
          {sharedWorkspaces.length > 0 && (
            <div className="py-6">
              <div className="flex items-center gap-2 mb-4">
                <Users className="w-4 h-4 text-success" />
                <h2 className="text-sm font-medium text-text-primary uppercase tracking-wide">
                  {t.workspaces_section_shared}
                </h2>
                <span className="text-xs text-text-muted">({sharedWorkspaces.length})</span>
              </div>
              <div
                className={
                  viewMode === 'grid'
                    ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'
                    : 'space-y-3'
                }
              >
                {sharedWorkspaces.map((workspace) => (
                  <WorkspaceCard key={workspace.id} workspace={workspace} />
                ))}
              </div>
            </div>
          )}

          {/* No Results */}
          {searchQuery && filteredWorkspaces.length === 0 && (
            <div className="bg-card border border-border p-16 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-text-muted/10 border border-text-muted/30 flex items-center justify-center">
                <Search className="w-8 h-8 text-text-muted" />
              </div>
              <h3 className="text-lg font-medium mb-2">{t.workspaces_no_results_title}</h3>
              <p className="text-text-secondary text-sm">{t.workspaces_no_results_desc}</p>
            </div>
          )}
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
