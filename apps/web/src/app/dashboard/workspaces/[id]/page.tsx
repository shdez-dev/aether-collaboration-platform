'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import InviteMemberModal from '@/components/InviteMemberModal';
import ConfirmRemoveMemberModal from '@/components/ConfirmRemoveMemberModal';
import CreateBoardModal from '@/components/CreateBoardModal';
import ActivityFeed from '@/components/ActivityFeed';
import DocumentsSection from '@/components/workspace/DocumentsSection';
import {
  Settings,
  ArrowLeft,
  Users,
  Activity,
  LayoutGrid,
  Plus,
  Calendar,
  Archive,
  Crown,
  Shield,
  Eye,
  UserCircle,
  Sparkles,
  UserMinus,
  ChevronRight,
  BarChart2,
  CheckSquare,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  UserX,
  Zap,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { formatShort } from '@/lib/utils/date';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';

export default function WorkspaceDetailPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const { user } = useAuthStore();

  const {
    currentWorkspace,
    currentStats,
    fetchWorkspaceById,
    fetchMembers,
    fetchStats,
    currentMembers,
    isLoading,
    removeMember,
    changeMemberRole,
  } = useWorkspaceStore();

  const { boards, fetchBoards } = useBoardStore();

  const [activeTab, setActiveTab] = useState<'stats' | 'boards'>('stats');
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateBoardModal, setShowCreateBoardModal] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [removingMember, setRemovingMember] = useState(false);
  const [changingRoleMemberId, setChangingRoleMemberId] = useState<string | null>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceById(workspaceId);
      fetchMembers(workspaceId);
      fetchBoards(workspaceId);
      fetchStats(workspaceId);
    }
  }, [workspaceId, fetchWorkspaceById, fetchMembers, fetchBoards, fetchStats]);

  if (isLoading && !currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-lg" />
          <p className="text-sm text-text-muted">{t.workspace_loading}</p>
        </div>
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="max-w-2xl mx-auto mt-20">
        <div className="bg-card border border-border p-16 text-center">
          <div className="w-20 h-20 mx-auto mb-6 bg-error/10 border border-error flex items-center justify-center">
            <span className="text-4xl">⚠</span>
          </div>
          <h3 className="text-2xl font-medium mb-2">{t.workspace_not_found_title}</h3>
          <p className="text-text-secondary mb-8">{t.workspace_not_found_desc}</p>
          <Link
            href="/dashboard/workspaces"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.workspace_btn_back}</span>
          </Link>
        </div>
      </div>
    );
  }

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(currentWorkspace.userRole || '');
  const isOwner = currentWorkspace.userRole === 'OWNER';
  const activeBoards = boards.filter((b) => !b.archived).length;

  const handleRemoveClick = (userId: string, memberName: string) => {
    setMemberToRemove({ userId, name: memberName });
  };

  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try {
      await removeMember(workspaceId, memberToRemove.userId);
      setMemberToRemove(null);
    } catch (error) {
      console.error('Error removing member:', error);
      alert(t.workspace_error_removing_member);
    } finally {
      setRemovingMember(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string) => {
    setChangingRoleMemberId(userId);
    try {
      await changeMemberRole(workspaceId, userId, newRole);
    } catch (error) {
      console.error('Error changing role:', error);
      alert(t.workspace_error_changing_role);
    } finally {
      setChangingRoleMemberId(null);
    }
  };

  const handleGoToBoard = (boardId: string) => {
    router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);
  };

  const handleBoardCreated = (boardId: string) => {
    setShowCreateBoardModal(false);
    router.push(`/dashboard/workspaces/${workspaceId}/boards/${boardId}`);
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'OWNER':
        return <Crown className="w-3 h-3" />;
      case 'ADMIN':
        return <Shield className="w-3 h-3" />;
      case 'MEMBER':
        return <UserCircle className="w-3 h-3" />;
      case 'VIEWER':
        return <Eye className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'OWNER':
        return 'bg-accent/20 border-accent/50 text-accent';
      case 'ADMIN':
        return 'bg-success/20 border-success/50 text-success';
      case 'MEMBER':
        return 'bg-surface border-border text-text-secondary';
      case 'VIEWER':
        return 'bg-text-muted/10 border-text-muted/30 text-text-muted';
      default:
        return 'bg-surface border-border text-text-secondary';
    }
  };

  const completionPct =
    currentStats && currentStats.totalCards > 0
      ? Math.round((currentStats.completedCards / currentStats.totalCards) * 100)
      : 0;

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      OWNER: t.role_owner,
      ADMIN: t.role_admin,
      MEMBER: t.role_member,
      VIEWER: t.role_viewer,
    };
    return labels[role] || role;
  };

  return (
    <>
      <div className="space-y-6">
        {/* Header Navigation */}
        <div className="flex items-center justify-between">
          <Link
            href="/dashboard/workspaces"
            className="flex items-center gap-2 text-sm text-text-muted hover:text-text-primary transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{t.workspace_btn_back}</span>
          </Link>

          {isOwnerOrAdmin && (
            <Link
              href={`/dashboard/workspaces/${workspaceId}/settings`}
              className="px-4 py-2 border border-border bg-surface text-text-primary hover:bg-card transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>{t.workspace_btn_settings}</span>
            </Link>
          )}
        </div>

        {/* Workspace Info Header */}
        <div className="bg-card border border-border p-6">
          <div className="flex items-start gap-6">
            <div
              className="w-20 h-20 flex items-center justify-center flex-shrink-0 border"
              style={{
                backgroundColor: `${currentWorkspace.color}15`,
                color: currentWorkspace.color,
                borderColor: `${currentWorkspace.color}40`,
              }}
            >
              <WorkspaceIcon icon={currentWorkspace.icon} className="w-10 h-10" />
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-2xl font-medium text-text-primary">{currentWorkspace.name}</h1>
                <span
                  className={`inline-flex items-center gap-1.5 px-2 py-1 text-xs font-medium border ${getRoleColor(
                    currentWorkspace.userRole || 'MEMBER'
                  )}`}
                >
                  {getRoleIcon(currentWorkspace.userRole || 'MEMBER')}
                  <span>{getRoleLabel(currentWorkspace.userRole || 'MEMBER')}</span>
                </span>
              </div>

              <p className="text-text-secondary text-sm mb-4">
                {currentWorkspace.description || t.no_description}
              </p>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-accent" />
                  <span className="text-text-primary font-medium">{activeBoards}</span>
                  <span className="text-text-muted">{t.workspace_stat_boards}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-success" />
                  <span className="text-text-primary font-medium">
                    {currentWorkspace.memberCount || 0}
                  </span>
                  <span className="text-text-muted">{t.workspace_stat_members}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-warning" />
                  <span className="text-text-primary font-medium">
                    {boards.reduce((sum, b) => sum + (b.cardCount || 0), 0)}
                  </span>
                  <span className="text-text-muted">{t.workspace_stat_tasks}</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted text-xs">
                    {formatShort(
                      new Date(currentWorkspace.createdAt),
                      user?.timezone,
                      user?.language as 'es' | 'en'
                    )}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PANEL PRINCIPAL (tabs) - 2 columnas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Tab switcher */}
            <div className="flex items-center justify-between">
              <div className="flex border border-border overflow-hidden">
                <button
                  onClick={() => setActiveTab('stats')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors ${
                    activeTab === 'stats'
                      ? 'bg-accent text-white'
                      : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-card'
                  }`}
                >
                  <BarChart2 className="w-4 h-4" />
                  <span>{t.ws_tab_stats}</span>
                </button>
                <button
                  onClick={() => setActiveTab('boards')}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition-colors border-l border-border ${
                    activeTab === 'boards'
                      ? 'bg-accent text-white'
                      : 'bg-surface text-text-secondary hover:text-text-primary hover:bg-card'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                  <span>{t.ws_tab_boards}</span>
                  {activeBoards > 0 && (
                    <span
                      className={`text-xs px-1.5 py-0.5 font-mono ${
                        activeTab === 'boards'
                          ? 'bg-white/20 text-white'
                          : 'bg-accent/10 text-accent'
                      }`}
                    >
                      {activeBoards}
                    </span>
                  )}
                </button>
              </div>

              {/* Acción contextual según tab */}
              {activeTab === 'boards' && isOwnerOrAdmin && (
                <button
                  className="px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium flex items-center gap-2"
                  onClick={() => setShowCreateBoardModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span>{t.workspace_btn_new_board}</span>
                </button>
              )}
            </div>

            {/* ── TAB: ESTADÍSTICAS ── */}
            {activeTab === 'stats' && (
              <div className="bg-card border border-border">
                {!currentStats ? (
                  <div className="flex items-center justify-center py-16">
                    <div className="loading" />
                  </div>
                ) : currentStats.totalCards === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 gap-3">
                    <BarChart2 className="w-10 h-10 text-text-muted opacity-30" />
                    <p className="text-sm text-text-muted">{t.ws_stats_no_data}</p>
                  </div>
                ) : (
                  <div className="p-5 space-y-5">
                    {/* ── Fila 1: métricas de estado ── */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      {/* Progreso global */}
                      <div className="p-3 bg-surface border border-border col-span-2 sm:col-span-2 space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <CheckSquare className="w-3.5 h-3.5 text-success" />
                            <span className="text-xs font-medium text-text-primary">
                              {t.ws_stats_completion_rate}
                            </span>
                          </div>
                          <span className="text-lg font-bold text-success">{completionPct}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-border overflow-hidden">
                          <div
                            className="h-full bg-success transition-all duration-500"
                            style={{ width: `${completionPct}%` }}
                          />
                        </div>
                        <p className="text-[11px] text-text-muted">
                          {currentStats.completedCards} {t.ws_stats_of} {currentStats.totalCards}{' '}
                          {t.ws_stats_cards_done}
                        </p>
                      </div>

                      {/* Vencidas */}
                      <div
                        className={`p-3 border space-y-1 ${currentStats.overdueCards > 0 ? 'bg-error/5 border-error/30' : 'bg-surface border-border'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <AlertCircle
                            className={`w-3.5 h-3.5 ${currentStats.overdueCards > 0 ? 'text-error' : 'text-text-muted'}`}
                          />
                          <span className="text-[11px] text-text-secondary">
                            {t.ws_stats_overdue}
                          </span>
                        </div>
                        <p
                          className={`text-2xl font-bold ${currentStats.overdueCards > 0 ? 'text-error' : 'text-text-muted'}`}
                        >
                          {currentStats.overdueCards}
                        </p>
                        <p className="text-[11px] text-text-muted">{t.ws_stats_overdue_desc}</p>
                      </div>

                      {/* Sin asignar */}
                      <div
                        className={`p-3 border space-y-1 ${currentStats.unassignedCards > 0 ? 'bg-warning/5 border-warning/30' : 'bg-surface border-border'}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <UserX
                            className={`w-3.5 h-3.5 ${currentStats.unassignedCards > 0 ? 'text-warning' : 'text-text-muted'}`}
                          />
                          <span className="text-[11px] text-text-secondary">
                            {t.ws_stats_unassigned}
                          </span>
                        </div>
                        <p
                          className={`text-2xl font-bold ${currentStats.unassignedCards > 0 ? 'text-warning' : 'text-text-muted'}`}
                        >
                          {currentStats.unassignedCards}
                        </p>
                        <p className="text-[11px] text-text-muted">{t.ws_stats_unassigned_desc}</p>
                      </div>
                    </div>

                    {/* ── Fila 2: velocidad + progreso por board ── */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 border-t border-border">
                      {/* Velocidad semanal */}
                      <div className="p-3 bg-surface border border-border space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-medium text-text-primary">
                            {t.ws_stats_velocity}
                          </span>
                        </div>
                        <div className="flex items-end gap-3">
                          <div>
                            <p className="text-2xl font-bold text-accent">
                              {currentStats.completedThisWeek}
                            </p>
                            <p className="text-[11px] text-text-muted">{t.ws_stats_this_week}</p>
                          </div>
                          <div className="pb-1">
                            {currentStats.completedThisWeek > currentStats.completedLastWeek ? (
                              <div className="flex items-center gap-1 text-success text-[11px]">
                                <TrendingUp className="w-3 h-3" />
                                <span>
                                  +{currentStats.completedThisWeek - currentStats.completedLastWeek}{' '}
                                  {t.ws_stats_vs_last_week}
                                </span>
                              </div>
                            ) : currentStats.completedThisWeek < currentStats.completedLastWeek ? (
                              <div className="flex items-center gap-1 text-error text-[11px]">
                                <TrendingDown className="w-3 h-3" />
                                <span>
                                  {currentStats.completedThisWeek - currentStats.completedLastWeek}{' '}
                                  {t.ws_stats_vs_last_week}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-text-muted">
                                {t.ws_stats_same_as_last_week}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Progreso por board */}
                      <div className="p-3 bg-surface border border-border space-y-2">
                        <div className="flex items-center gap-1.5">
                          <Activity className="w-3.5 h-3.5 text-accent" />
                          <span className="text-xs font-medium text-text-primary">
                            {t.ws_stats_board_progress}
                          </span>
                        </div>
                        <div className="space-y-2 max-h-[90px] overflow-y-auto pr-1">
                          {currentStats.boardProgress
                            .filter((b) => b.total > 0)
                            .map((board) => {
                              const pct =
                                board.total > 0
                                  ? Math.round((board.completed / board.total) * 100)
                                  : 0;
                              return (
                                <div key={board.boardId} className="space-y-0.5">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[11px] text-text-secondary truncate max-w-[120px]">
                                      {board.name}
                                    </span>
                                    <span className="text-[11px] font-medium text-text-primary flex-shrink-0">
                                      {pct}%
                                    </span>
                                  </div>
                                  <div className="w-full h-1 bg-border overflow-hidden">
                                    <div
                                      className="h-full bg-accent transition-all"
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              );
                            })}
                          {currentStats.boardProgress.every((b) => b.total === 0) && (
                            <p className="text-[11px] text-text-muted">{t.ws_stats_no_cards_yet}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TAB: BOARDS ── */}
            {activeTab === 'boards' && (
              <div className="bg-card border border-border">
                {boards.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 border border-accent flex items-center justify-center">
                      <LayoutGrid className="w-8 h-8 text-accent" />
                    </div>
                    <h3 className="text-base font-medium mb-2">{t.workspace_empty_boards_title}</h3>
                    <p className="text-text-secondary text-sm mb-6">
                      {isOwnerOrAdmin
                        ? t.workspace_empty_boards_desc_owner
                        : t.workspace_empty_boards_desc_member}
                    </p>
                    {isOwnerOrAdmin && (
                      <button
                        className="px-4 py-2 bg-accent text-white hover:bg-accent/90 inline-flex items-center gap-2"
                        onClick={() => setShowCreateBoardModal(true)}
                      >
                        <Plus className="w-4 h-4" />
                        <span>{t.workspace_btn_create_board}</span>
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="p-4 space-y-2">
                    {boards.map((board) => (
                      <button
                        key={board.id}
                        onClick={() => handleGoToBoard(board.id)}
                        className="group w-full text-left p-4 border border-border bg-surface hover:bg-card hover:border-accent transition-all flex items-center justify-between"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="text-xl font-medium group-hover:text-accent transition-colors truncate">
                              {board.name}
                            </h4>
                            {board.archived && (
                              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-warning/10 border border-warning text-xs flex-shrink-0">
                                <Archive className="w-3 h-3 text-warning" />
                              </div>
                            )}
                          </div>

                          {board.description && (
                            <p className="text-text-secondary text-xs mb-2 line-clamp-1">
                              {board.description}
                            </p>
                          )}

                          <div className="flex items-center gap-4 text-xs text-text-muted">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1 h-4 bg-accent" />
                              <span className="font-medium">{board.listCount || 0}</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span className="font-medium">{board.cardCount || 0}</span>
                            </div>
                          </div>
                        </div>

                        <ChevronRight className="w-5 h-5 text-text-muted group-hover:text-accent group-hover:translate-x-1 transition-all flex-shrink-0 ml-2" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SIDEBAR - 1 columna con Members y Activity */}
          <div className="space-y-6">
            {/* MEMBERS - MÁS COMPACTO */}
            <div className="bg-card border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-success/10 border border-success/30">
                    <Users className="w-4 h-4 text-success" />
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-text-primary">
                      {t.workspace_section_members}
                    </h3>
                    <p className="text-xs text-text-muted">
                      {t.workspace_members_total(currentMembers.length)}
                    </p>
                  </div>
                </div>
                {isOwnerOrAdmin && (
                  <button
                    onClick={() => setShowInviteModal(true)}
                    className="p-1.5 border border-border hover:border-accent hover:bg-accent/10 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                )}
              </div>

              <div className="p-3">
                {currentMembers.length === 0 ? (
                  <div className="text-center py-8">
                    <Users className="w-10 h-10 mx-auto mb-2 text-text-muted opacity-50" />
                    <p className="text-xs text-text-secondary">{t.no_description}</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 max-h-[300px] overflow-y-auto">
                    {currentMembers.map((member) => (
                      <div
                        key={member.id}
                        className="group relative flex items-center gap-2 px-3 py-2 bg-surface border border-border hover:border-accent transition-all"
                      >
                        <div
                          className="w-9 h-9 flex-shrink-0 border overflow-hidden"
                          style={{ borderColor: `${currentWorkspace.color}40` }}
                        >
                          {member.user?.avatar && getAvatarUrl(member.user.avatar) ? (
                            <img
                              src={getAvatarUrl(member.user.avatar)!}
                              alt={member.user.name}
                              crossOrigin="anonymous"
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            <div
                              className="w-full h-full flex items-center justify-center text-sm font-bold"
                              style={{
                                backgroundColor: `${currentWorkspace.color}15`,
                                color: currentWorkspace.color,
                              }}
                            >
                              {member.user?.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>

                        <div className="flex flex-col min-w-0">
                          <p className="text-xs font-medium text-text-primary truncate max-w-[110px]">
                            {member.user?.name}
                          </p>
                          <span
                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 text-[11px] border ${getRoleColor(
                              member.role
                            )}`}
                          >
                            {getRoleIcon(member.role)}
                            <span>{getRoleLabel(member.role)}</span>
                          </span>
                        </div>

                        {isOwnerOrAdmin && member.role !== 'OWNER' && (
                          <button
                            onClick={() =>
                              handleRemoveClick(member.userId, member.user?.name || '')
                            }
                            className="absolute -top-1 -right-1 p-0.5 bg-error text-white hover:bg-error/80 border border-error transition-all opacity-0 group-hover:opacity-100 flex-shrink-0"
                          >
                            <UserMinus className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ACTIVITY */}
            <div className="bg-card border border-border max-h-[300px] flex flex-col">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="p-1.5 bg-warning/10 border border-warning/30">
                  <Activity className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">
                    {t.workspace_section_activity}
                  </h3>
                  <p className="text-xs text-text-muted">{t.workspace_activity_last_7_days}</p>
                </div>
              </div>
              <ActivityFeed workspaceId={workspaceId} />
            </div>

            {/* DOCUMENTS */}
            <DocumentsSection workspaceId={workspaceId} isOwnerOrAdmin={isOwnerOrAdmin} />
          </div>
        </div>
      </div>

      {/* Modals */}
      <InviteMemberModal
        workspaceId={workspaceId}
        isOpen={showInviteModal}
        onClose={() => setShowInviteModal(false)}
      />

      <ConfirmRemoveMemberModal
        isOpen={!!memberToRemove}
        memberName={memberToRemove?.name || ''}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
        isRemoving={removingMember}
      />

      <CreateBoardModal
        workspaceId={workspaceId}
        isOpen={showCreateBoardModal}
        onClose={() => setShowCreateBoardModal(false)}
        onSuccess={handleBoardCreated}
      />
    </>
  );
}
