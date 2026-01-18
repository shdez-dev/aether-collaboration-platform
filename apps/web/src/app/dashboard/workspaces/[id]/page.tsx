'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import InviteMemberModal from '@/components/InviteMemberModal';
import ConfirmRemoveMemberModal from '@/components/ConfirmRemoveMemberModal';
import CreateBoardModal from '@/components/CreateBoardModal';
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
} from 'lucide-react';

export default function WorkspaceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const {
    currentWorkspace,
    fetchWorkspaceById,
    fetchMembers,
    currentMembers,
    isLoading,
    removeMember,
    changeMemberRole,
  } = useWorkspaceStore();

  const { boards, fetchBoards } = useBoardStore();

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
    }
  }, [workspaceId, fetchWorkspaceById, fetchMembers, fetchBoards]);

  if (isLoading && !currentWorkspace) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <div className="loading-lg" />
          <p className="text-sm text-text-muted">Cargando workspace...</p>
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
          <h3 className="text-2xl font-medium mb-2">Workspace no encontrado</h3>
          <p className="text-text-secondary mb-8">
            Este workspace no existe o no tienes acceso a él
          </p>
          <Link
            href="/dashboard/workspaces"
            className="btn-secondary inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Volver a Workspaces</span>
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
      alert('Error al eliminar miembro. Intenta de nuevo.');
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
      alert('Error al cambiar rol. Intenta de nuevo.');
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

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      OWNER: 'Propietario',
      ADMIN: 'Admin',
      MEMBER: 'Miembro',
      VIEWER: 'Viewer',
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
            <span>Volver a Workspaces</span>
          </Link>

          {isOwnerOrAdmin && (
            <Link
              href={`/dashboard/workspaces/${workspaceId}/settings`}
              className="px-4 py-2 border border-border bg-surface text-text-primary hover:bg-card transition-colors text-sm font-medium flex items-center gap-2"
            >
              <Settings className="w-4 h-4" />
              <span>Configuración</span>
            </Link>
          )}
        </div>

        {/* Workspace Info Header */}
        <div className="bg-card border border-border p-6">
          <div className="flex items-start gap-6">
            <div
              className="w-20 h-20 flex items-center justify-center text-4xl flex-shrink-0 border"
              style={{
                backgroundColor: `${currentWorkspace.color}15`,
                color: currentWorkspace.color,
                borderColor: `${currentWorkspace.color}40`,
              }}
            >
              {currentWorkspace.icon || '▣'}
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
                {currentWorkspace.description || 'Sin descripción'}
              </p>

              <div className="flex items-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="w-4 h-4 text-accent" />
                  <span className="text-text-primary font-medium">{activeBoards}</span>
                  <span className="text-text-muted">boards</span>
                </div>

                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-success" />
                  <span className="text-text-primary font-medium">
                    {currentWorkspace.memberCount || 0}
                  </span>
                  <span className="text-text-muted">miembros</span>
                </div>

                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-warning" />
                  <span className="text-text-primary font-medium">
                    {boards.reduce((sum, b) => sum + (b.cardCount || 0), 0)}
                  </span>
                  <span className="text-text-muted">tareas</span>
                </div>

                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-text-muted" />
                  <span className="text-text-muted text-xs">
                    {new Date(currentWorkspace.createdAt).toLocaleDateString('es-ES', {
                      month: 'short',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Grid de 3 columnas */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* BOARDS - 2 columnas */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-accent/10 border border-accent/30">
                  <LayoutGrid className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-xl font-medium text-text-primary">Boards</h2>
                  <p className="text-sm text-text-muted">
                    {activeBoards} activos • {boards.length - activeBoards} archivados
                  </p>
                </div>
              </div>
              {isOwnerOrAdmin && (
                <button
                  className="px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors text-sm font-medium flex items-center gap-2"
                  onClick={() => setShowCreateBoardModal(true)}
                >
                  <Plus className="w-4 h-4" />
                  <span>Nuevo</span>
                </button>
              )}
            </div>

            <div className="bg-card border border-border">
              {boards.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 mx-auto mb-4 bg-accent/10 border border-accent flex items-center justify-center">
                    <LayoutGrid className="w-8 h-8 text-accent" />
                  </div>
                  <h3 className="text-base font-medium mb-2">No hay boards aún</h3>
                  <p className="text-text-secondary text-sm mb-6">
                    {isOwnerOrAdmin
                      ? 'Crea tu primer board para comenzar a organizar'
                      : 'No hay boards creados todavía'}
                  </p>
                  {isOwnerOrAdmin && (
                    <button
                      className="px-4 py-2 bg-accent text-white hover:bg-accent/90 inline-flex items-center gap-2"
                      onClick={() => setShowCreateBoardModal(true)}
                    >
                      <Plus className="w-4 h-4" />
                      <span>Crear Board</span>
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
                    <h3 className="text-sm font-medium text-text-primary">Miembros</h3>
                    <p className="text-xs text-text-muted">{currentMembers.length} total</p>
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
                    <p className="text-xs text-text-secondary">Sin miembros</p>
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-3 max-h-[300px] overflow-y-auto">
                    {currentMembers.map((member) => (
                      <div
                        key={member.id}
                        className="group relative flex items-center gap-2 px-3 py-2 bg-surface border border-border hover:border-accent transition-all"
                      >
                        <div
                          className="w-9 h-9 flex items-center justify-center text-sm font-bold border flex-shrink-0"
                          style={{
                            backgroundColor: `${currentWorkspace.color}15`,
                            color: currentWorkspace.color,
                            borderColor: `${currentWorkspace.color}40`,
                          }}
                        >
                          {member.user?.name.charAt(0).toUpperCase()}
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
            <div className="bg-card border border-border">
              <div className="px-4 py-3 border-b border-border flex items-center gap-2">
                <div className="p-1.5 bg-warning/10 border border-warning/30">
                  <Activity className="w-4 h-4 text-warning" />
                </div>
                <div>
                  <h3 className="text-sm font-medium text-text-primary">Actividad</h3>
                  <p className="text-xs text-text-muted">Últimos 7 días</p>
                </div>
              </div>

              <div className="p-4">
                <div className="text-center py-12">
                  <Activity className="w-10 h-10 mx-auto mb-2 text-text-muted opacity-50" />
                  <p className="text-xs text-text-secondary">Sin actividad reciente</p>
                </div>
              </div>
            </div>
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
