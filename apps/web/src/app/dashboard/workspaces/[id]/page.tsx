// apps/web/src/app/dashboard/workspaces/[id]/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import InviteMemberModal from '@/components/InviteMemberModal';
import ConfirmRemoveMemberModal from '@/components/ConfirmRemoveMemberModal';
import CreateBoardModal from '@/components/CreateBoardModal';

type Tab = 'boards' | 'members' | 'activity';

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

  const [activeTab, setActiveTab] = useState<Tab>('boards');
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
      <div className="flex items-center justify-center py-12">
        <div className="loading-lg" />
      </div>
    );
  }

  if (!currentWorkspace) {
    return (
      <div className="card-terminal text-center py-12">
        <p className="text-text-secondary mb-4">Workspace not found or you don't have access</p>
        <Link href="/dashboard/workspaces" className="btn-secondary">
          ← Back to Workspaces
        </Link>
      </div>
    );
  }

  const isOwnerOrAdmin = ['OWNER', 'ADMIN'].includes(currentWorkspace.userRole || '');
  const isOwner = currentWorkspace.userRole === 'OWNER';

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
      alert('Failed to remove member. Please try again.');
    } finally {
      setRemovingMember(false);
    }
  };

  const handleChangeRole = async (userId: string, newRole: string, memberName: string) => {
    setChangingRoleMemberId(userId);
    try {
      await changeMemberRole(workspaceId, userId, newRole);
    } catch (error) {
      console.error('Error changing role:', error);
      alert('Failed to change role. Please try again.');
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

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="card-terminal">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-start gap-4">
              <div
                className="w-16 h-16 rounded-terminal flex items-center justify-center text-3xl flex-shrink-0 border-2"
                style={{
                  backgroundColor: `${currentWorkspace.color}20`,
                  color: currentWorkspace.color,
                  borderColor: `${currentWorkspace.color}40`,
                }}
              >
                {currentWorkspace.icon || '▣'}
              </div>

              <div>
                <h1 className="text-2xl font-normal mb-1">{currentWorkspace.name}</h1>
                <p className="text-text-secondary text-sm mb-3">
                  {currentWorkspace.description || 'No description provided'}
                </p>

                <span className="text-xs px-2 py-1 rounded-terminal border border-accent/50 bg-accent/10 text-accent">
                  {currentWorkspace.userRole || 'MEMBER'}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {isOwnerOrAdmin && (
                <Link
                  href={`/dashboard/workspaces/${workspaceId}/settings`}
                  className="btn-secondary"
                >
                  ⚙ Settings
                </Link>
              )}
              <Link href="/dashboard/workspaces" className="btn-secondary">
                ← Back
              </Link>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
            <div className="flex flex-col gap-1">
              <span className="text-text-muted text-xs uppercase">Boards</span>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xl">▦</span>
                <span className="text-text-primary text-lg font-medium">
                  {currentWorkspace.boardCount || 0}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-text-muted text-xs uppercase">Members</span>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xl">◉</span>
                <span className="text-text-primary text-lg font-medium">
                  {currentWorkspace.memberCount || 0}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-text-muted text-xs uppercase">Cards</span>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xl">◈</span>
                <span className="text-text-primary text-lg font-medium">0</span>
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <span className="text-text-muted text-xs uppercase">Created</span>
              <div className="flex items-center gap-2">
                <span className="text-accent text-xl">◷</span>
                <span className="text-text-primary text-sm">
                  {new Date(currentWorkspace.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="card-terminal">
          <div className="flex items-center gap-2 border-b border-border pb-4 mb-6">
            <button
              onClick={() => setActiveTab('boards')}
              className={`px-4 py-2 rounded-terminal transition-colors ${
                activeTab === 'boards'
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'text-text-secondary hover:text-text-primary hover:bg-card'
              }`}
            >
              Boards
            </button>
            <button
              onClick={() => setActiveTab('members')}
              className={`px-4 py-2 rounded-terminal transition-colors ${
                activeTab === 'members'
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'text-text-secondary hover:text-text-primary hover:bg-card'
              }`}
            >
              Members ({currentMembers.length})
            </button>
            <button
              onClick={() => setActiveTab('activity')}
              className={`px-4 py-2 rounded-terminal transition-colors ${
                activeTab === 'activity'
                  ? 'bg-accent/20 text-accent border border-accent/50'
                  : 'text-text-secondary hover:text-text-primary hover:bg-card'
              }`}
            >
              Activity
            </button>
          </div>

          {/* Tab Content */}
          {activeTab === 'boards' && (
            <div>
              {/* Header con botón de crear - SOLO ADMIN/OWNER */}
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm text-text-secondary uppercase">Boards ({boards.length})</h3>
                {isOwnerOrAdmin && (
                  <button
                    className="btn-primary text-sm"
                    onClick={() => setShowCreateBoardModal(true)}
                  >
                    + Create Board
                  </button>
                )}
              </div>

              {/* Empty State */}
              {boards.length === 0 ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4 opacity-50">▦</div>
                  <h3 className="text-xl mb-2 text-text-primary">No boards yet</h3>
                  <p className="text-text-secondary text-sm mb-6">
                    {isOwnerOrAdmin
                      ? 'Create your first board to start organizing tasks and tracking progress'
                      : 'No boards have been created in this workspace yet'}
                  </p>
                  {isOwnerOrAdmin && (
                    <button className="btn-primary" onClick={() => setShowCreateBoardModal(true)}>
                      + Create Board
                    </button>
                  )}
                </div>
              ) : (
                /* Grid de Boards */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {boards.map((board) => (
                    <button
                      key={board.id}
                      onClick={() => handleGoToBoard(board.id)}
                      className="card-terminal text-left hover:border-primary/50 transition-all group p-4"
                    >
                      <h4 className="text-lg font-normal mb-2 group-hover:text-primary transition-colors">
                        {board.name}
                      </h4>

                      {board.description && (
                        <p className="text-text-secondary text-sm mb-4 line-clamp-2">
                          {board.description}
                        </p>
                      )}

                      <div className="flex items-center gap-4 text-text-muted text-sm">
                        <div className="flex items-center gap-1">
                          <span className="text-primary">█</span>
                          <span>{board.listCount || 0} lists</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <span className="text-success">▣</span>
                          <span>{board.cardCount || 0} cards</span>
                        </div>
                      </div>

                      {board.archived && (
                        <div className="mt-3 pt-3 border-t border-border">
                          <span className="text-warning text-xs">⚠ ARCHIVED</span>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm text-text-secondary uppercase">
                  Workspace Members ({currentMembers.length})
                </h3>
                {isOwnerOrAdmin && (
                  <button className="btn-primary" onClick={() => setShowInviteModal(true)}>
                    + Invite Member
                  </button>
                )}
              </div>

              {currentMembers.length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-text-secondary">No members found</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {currentMembers.map((member) => (
                    <div
                      key={member.id}
                      className="flex items-center justify-between p-3 bg-background rounded-terminal border border-border hover:border-accent/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-terminal bg-accent/20 flex items-center justify-center border border-accent/30">
                          <span className="text-accent font-bold">
                            {member.user?.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm text-text-primary font-medium">
                            {member.user?.name}
                          </p>
                          <p className="text-xs text-text-muted">{member.user?.email}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {isOwner && member.role !== 'OWNER' ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              handleChangeRole(
                                member.userId,
                                e.target.value,
                                member.user?.name || ''
                              )
                            }
                            disabled={changingRoleMemberId === member.userId}
                            className={`text-xs px-2 py-1 rounded-terminal border bg-card text-text-primary cursor-pointer hover:border-accent/50 transition-colors ${
                              member.role === 'ADMIN'
                                ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                : 'border-border'
                            }`}
                          >
                            <option value="VIEWER">Viewer</option>
                            <option value="MEMBER">Member</option>
                            <option value="ADMIN">Admin</option>
                          </select>
                        ) : (
                          <span
                            className={`text-xs px-2 py-1 rounded-terminal border ${
                              member.role === 'OWNER'
                                ? 'border-accent bg-accent/20 text-accent'
                                : member.role === 'ADMIN'
                                  ? 'border-blue-500/50 bg-blue-500/10 text-blue-400'
                                  : 'border-border bg-card text-text-secondary'
                            }`}
                          >
                            {member.role}
                          </span>
                        )}

                        {isOwnerOrAdmin && member.role !== 'OWNER' && (
                          <button
                            onClick={() =>
                              handleRemoveClick(member.userId, member.user?.name || '')
                            }
                            className="text-error hover:text-error/80 text-xs px-2 py-1 rounded border border-error/30 hover:bg-error/10 transition-colors"
                          >
                            Remove
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'activity' && (
            <div className="text-center py-12">
              <div className="text-6xl mb-4 opacity-50">◉</div>
              <h3 className="text-xl mb-2 text-text-primary">No recent activity</h3>
              <p className="text-text-secondary text-sm">
                Recent workspace activity will appear here
              </p>
            </div>
          )}
        </div>
      </div>

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
