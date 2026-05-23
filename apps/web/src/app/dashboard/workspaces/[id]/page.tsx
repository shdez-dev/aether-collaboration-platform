'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useBoardStore } from '@/stores/boardStore';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { socketService } from '@/services/socketService';
import InviteMemberModal from '@/components/InviteMemberModal';
import ConfirmRemoveMemberModal from '@/components/ConfirmRemoveMemberModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import ActivityFeed from '@/components/ActivityFeed';
import DocumentsSection from '@/components/workspace/DocumentsSection';
import { ActivityTimeline } from '@/components/activity/ActivityTimeline';
import { ActivityFiltersComponent, type ActivityFilters } from '@/components/activity/ActivityFilters';
import { useT } from '@/lib/i18n';
type T = ReturnType<typeof useT>;
import { apiService } from '@/services/apiService';
import { useRealtimeToast } from '@/hooks/useRealtimeToast';
import { getAvatarUrl } from '@/lib/utils/avatar';
import {
  Plus, Archive, UserMinus, Trash2,
  LayoutGrid, Activity, AlertCircle, FileText,
  TrendingUp, TrendingDown, ChevronDown, FolderOpen,
  UserX, Zap, Users, LayoutDashboard,
  Github, GitBranch, GitMerge, GitPullRequest, GitPullRequestClosed,
} from 'lucide-react';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

type TabKey = 'overview' | 'projects' | 'docs' | 'members' | 'activity';

// ── Avatar color palette (deterministic per user) ─────────────────────────────
const AVATAR_PALETTE = [
  '#3b82f6', '#10b981', '#f97316', '#a855f7', '#ec4899',
  '#06b6d4', '#f43f5e', '#84cc16', '#f59e0b', '#8b5cf6',
];
function hashColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (Math.imul(31, h) + id.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getRoleBadge(role: string, t: T) {
  if (role === 'OWNER')  return { label: t.role_owner,  bg: 'rgba(56,182,255,0.10)',  color: '#38b6ff', border: 'rgba(56,182,255,0.25)',  dot: '#38b6ff' };
  if (role === 'ADMIN')  return { label: t.role_admin,  bg: 'rgba(0,229,204,0.10)',   color: '#00e5cc', border: 'rgba(0,229,204,0.25)',   dot: '#00e5cc' };
  if (role === 'VIEWER') return { label: t.role_viewer, bg: 'rgba(56,182,255,0.05)',  color: '#4a6480', border: 'rgba(56,182,255,0.12)',  dot: '#4a6480' };
  return                        { label: t.role_member, bg: 'rgba(56,182,255,0.06)',  color: '#8aaac8', border: 'rgba(56,182,255,0.15)',  dot: '#8aaac8' };
}

function getStatusBadge(status: string, t: T) {
  switch (status) {
    case 'ACTIVE':    return { label: t.projects_status_active,    color: '#00e5cc', bg: 'rgba(0,229,204,0.10)',   border: 'rgba(0,229,204,0.25)' };
    case 'PLANNING':  return { label: t.projects_status_planning,  color: '#38b6ff', bg: 'rgba(56,182,255,0.10)',  border: 'rgba(56,182,255,0.25)' };
    case 'ON_HOLD':   return { label: t.projects_status_on_hold,   color: '#f59e0b', bg: 'rgba(245,158,11,0.10)',  border: 'rgba(245,158,11,0.25)' };
    case 'COMPLETED': return { label: t.projects_status_completed, color: '#4a6480', bg: 'rgba(56,182,255,0.05)',  border: 'rgba(56,182,255,0.12)' };
    default:          return { label: status,                       color: '#4a6480', bg: 'rgba(56,182,255,0.05)', border: 'rgba(56,182,255,0.12)' };
  }
}

function getHealthBadge(pct: number, t: T) {
  if (pct >= 60) return { label: t.ws_health_healthy,       color: '#00e5cc', bg: 'rgba(0,229,204,0.10)',  border: 'rgba(0,229,204,0.25)' };
  if (pct >= 30) return { label: t.projects_health_at_risk, color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' };
  return               { label: t.ws_health_critical,       color: '#ef4444', bg: 'rgba(239,68,68,0.10)',  border: 'rgba(239,68,68,0.25)' };
}

function getBoardStatus(updatedAt: string, isLive: boolean, t: T) {
  if (isLive) return { label: t.ws_board_status_active,  color: '#00e5cc', bg: 'rgba(0,229,204,0.10)',  border: 'rgba(0,229,204,0.25)' };
  const days = (Date.now() - new Date(updatedAt).getTime()) / 86400000;
  if (days < 4)  return { label: t.ws_board_status_active,  color: '#00e5cc', bg: 'rgba(0,229,204,0.10)',  border: 'rgba(0,229,204,0.25)' };
  if (days < 14) return { label: t.ws_board_status_review,  color: '#f59e0b', bg: 'rgba(245,158,11,0.10)', border: 'rgba(245,158,11,0.25)' };
  return               { label: t.ws_board_status_backlog,  color: '#4a6480', bg: 'rgba(56,182,255,0.05)', border: 'rgba(56,182,255,0.12)' };
}

function timeAgo(dateStr: string, t: T): string {
  const ms = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(ms / 60000);
  const hours = Math.floor(ms / 3600000);
  const days = Math.floor(ms / 86400000);
  if (mins < 1)   return t.projects_time_ago_now;
  if (mins < 60)  return t.projects_time_ago_min(mins);
  if (hours < 24) return t.projects_time_ago_h(hours);
  if (days < 30)  return t.projects_time_ago_d(days);
  return t.projects_time_ago_d(Math.floor(days / 30));
}

function daysLabel(dateStr: string | null | undefined, t: T): { text: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const d = Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
  if (d < -60 || d > 90) return null;
  if (d < 0)  return { text: t.projects_time_ago_overdue(Math.abs(d)), overdue: true };
  if (d === 0) return { text: t.projects_time_ago_due_today, overdue: false };
  return { text: t.projects_time_ago_days_left(d), overdue: false };
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function WorkspaceDetailPage() {
  const t = useT();
  const ago = (d: string) => timeAgo(d, t);
  const makeDl = (d?: string | null) => daysLabel(d, t);
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceId = params.id as string;

  const {
    currentWorkspace, currentStats,
    fetchWorkspaceById, fetchMembers, fetchStats,
    currentMembers, isLoading, removeMember, changeMemberRole,
  } = useWorkspaceStore();

  const { boards, fetchBoards, handleEvent, deleteBoard } = useBoardStore();
  const { fetchProjectsByWorkspace } = useProjectStore();
  const toast = useRealtimeToast();

  // ── UI state ──────────────────────────────────────────────────────────────
  const initialTab = (searchParams.get('tab') as TabKey | null) ?? 'overview';
  const [activeTab,            setActiveTab]            = useState<TabKey>(initialTab);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  const [showInviteModal,        setShowInviteModal]        = useState(false);
  const [showCreateProjectModal, setShowCreateProjectModal] = useState(false);
  const [memberToRemove,       setMemberToRemove]       = useState<{ userId: string; name: string } | null>(null);
  const [removingMember,       setRemovingMember]       = useState(false);
  const [roleMenuOpen,         setRoleMenuOpen]         = useState<string | null>(null); // userId con menú abierto
  const [changingRole,         setChangingRole]         = useState(false);
  const [boardToDelete,        setBoardToDelete]        = useState<{ id: string; name: string } | null>(null);
  const [isDeletingBoard,      setIsDeletingBoard]      = useState(false);
  const [boardActiveUsers,     setBoardActiveUsers]     = useState<Record<string, { count: number; users: any[] }>>({});
  const [wsProjects,           setWsProjects]           = useState<Project[]>([]);
  const [orphanBoards,         setOrphanBoards]         = useState<any[]>([]);
  const [orphanOpen,           setOrphanOpen]           = useState(true);
  const [planningOpen,         setPlanningOpen]         = useState(false);
  const [assigningBoardId,     setAssigningBoardId]     = useState<string | null>(null);
  const [sideProjects,         setSideProjects]         = useState(true);
  const [sideMembers,          setSideMembers]          = useState(true);
  const [wsTeams,              setWsTeams]              = useState<{ id: string; name: string; color: string | null; members: any[] }[]>([]);
  const [sideActivity,         setSideActivity]         = useState(true);
  const [sideGithub,           setSideGithub]           = useState(true);
  const [githubConnected,      setGithubConnected]      = useState(false);
  const [githubEvents,         setGithubEvents]         = useState<any[]>([]);
  const [docRefreshKey,        setDocRefreshKey]        = useState(0);
  const [activityRefreshKey,   setActivityRefreshKey]   = useState(0);

  // Ref para evitar stale closure en el handler de socket
  const activeTabRef = useRef<TabKey>(initialTab);

  // ── Activity tab ──────────────────────────────────────────────────────────
  const EVENTS_PER_PAGE = 20;
  const [activityEvents,      setActivityEvents]      = useState<any[]>([]);
  const [activityLoading,     setActivityLoading]     = useState(false);
  const [activityLoadingMore, setActivityLoadingMore] = useState(false);
  const [activityError,       setActivityError]       = useState<string | null>(null);
  const [activityHasMore,     setActivityHasMore]     = useState(true);
  const [activityOffset,      setActivityOffset]      = useState(0);
  const [activityBoards,      setActivityBoards]      = useState<Array<{ id: string; name: string }>>([]);
  const [activityFilters,     setActivityFilters]     = useState<ActivityFilters>({
    eventTypes: [], startDate: undefined, endDate: undefined, userId: undefined, boardId: undefined,
  });

  const fetchActivityTab = useCallback(async (reset = false) => {
    try {
      if (reset) { setActivityLoading(true); setActivityOffset(0); setActivityEvents([]); }
      else        { setActivityLoadingMore(true); }
      setActivityError(null);
      const qp = new URLSearchParams();
      qp.append('limit', EVENTS_PER_PAGE.toString());
      qp.append('offset', (reset ? 0 : activityOffset).toString());
      if (activityFilters.eventTypes.length > 0) qp.append('eventTypes', activityFilters.eventTypes.join(','));
      if (activityFilters.startDate) qp.append('startDate', activityFilters.startDate);
      if (activityFilters.endDate)   qp.append('endDate',   activityFilters.endDate);
      if (activityFilters.userId)    qp.append('userId',    activityFilters.userId);
      if (activityFilters.boardId)   qp.append('boardId',   activityFilters.boardId);
      const r = await apiService.get<{ events: any[]; pagination: any }>(
        `/api/workspaces/${workspaceId}/activity?${qp}`, true
      );
      if (!r.success || !r.data) throw new Error(r.error?.message || 'Error');
      const newEvents = r.data.events || [];
      if (reset) setActivityEvents(newEvents);
      else       setActivityEvents((prev) => [...prev, ...newEvents]);
      setActivityHasMore(newEvents.length === EVENTS_PER_PAGE);
      setActivityOffset(reset ? EVENTS_PER_PAGE : activityOffset + EVENTS_PER_PAGE);
    } catch {
      setActivityError(t.ws_activity_error);
    } finally {
      setActivityLoading(false);
      setActivityLoadingMore(false);
    }
  }, [workspaceId, activityOffset, activityFilters]);

  useEffect(() => {
    if (activeTab === 'activity') fetchActivityTab(true);
  }, [activeTab, workspaceId, activityFilters]);

  useEffect(() => {
    if (activeTab !== 'activity' || activityBoards.length > 0) return;
    apiService.get<{ boards: Array<{ id: string; name: string }> }>(
      `/api/workspaces/${workspaceId}/boards`, true
    ).then((r) => { if (r.success && r.data) setActivityBoards(r.data.boards || []); });
  }, [activeTab, workspaceId]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && boardToDelete && !isDeletingBoard) setBoardToDelete(null);
      if (e.key === 'Escape') setRoleMenuOpen(null);
    };
    const onClick = () => setRoleMenuOpen(null);
    document.addEventListener('keydown', onKey);
    document.addEventListener('click', onClick);
    return () => { document.removeEventListener('keydown', onKey); document.removeEventListener('click', onClick); };
  }, [boardToDelete, isDeletingBoard]);

  useEffect(() => {
    if (!workspaceId) return;
    fetchWorkspaceById(workspaceId);
    fetchMembers(workspaceId);
    fetchBoards(workspaceId);
    fetchStats(workspaceId);
    fetchProjectsByWorkspace(workspaceId).then(setWsProjects);
    apiService.get<{ boards: any[] }>(`/api/workspaces/${workspaceId}/boards/orphaned`, true)
      .then((r) => { if (r.success && r.data) setOrphanBoards(r.data.boards || []); });
    apiService.get<{ teams: any[] }>(`/api/workspaces/${workspaceId}/teams`, true)
      .then((r) => { if (r.success && r.data) setWsTeams(r.data.teams || []); });
  }, [workspaceId, fetchWorkspaceById, fetchMembers, fetchBoards, fetchStats, fetchProjectsByWorkspace]);

  useEffect(() => {
    if (!workspaceId) return;
    apiService.get<{ githubLogin: string; repos: string[]; connectedAt: string } | null>(`/api/workspaces/${workspaceId}/github`, true).then((r) => {
      if (r.success && r.data) {
        setGithubConnected(true);
        const ghTypes = 'github.push.received,github.pr.opened,github.pr.closed,github.pr.merged,github.pr.review-submitted,github.pr.review-requested';
        apiService.get<{ events: any[] }>(`/api/workspaces/${workspaceId}/activity?eventTypes=${ghTypes}&limit=10`, true).then((r2) => {
          if (r2.success && r2.data) setGithubEvents(r2.data.events || []);
        });
      }
    });
  }, [workspaceId]);

  useEffect(() => {
    if (boards.length === 0) return;
    Promise.allSettled(
      boards.filter((b) => !b.archived).map(async (board) => {
        const r = await apiService.get<{ users: any[] }>(
          `/api/presence/boards/${board.id}/active-users`, true
        );
        const users = r.success ? (r.data?.users ?? []) : [];
        return { boardId: board.id, count: users.length, users };
      })
    ).then((results) => {
      const map: Record<string, { count: number; users: any[] }> = {};
      for (const r of results) {
        if (r.status === 'fulfilled') map[r.value.boardId] = r.value;
      }
      setBoardActiveUsers(map);
    });
  }, [boards]);

  // ── Real-time project events ──────────────────────────────────────────────
  const handleProjectEvent = useCallback(async (event: { type: string; payload: any }) => {
    const p = event.payload;
    switch (event.type) {
      case 'project.created': {
        if (!p.projectId) break;
        try {
          const r = await apiService.get<{ project: any }>(`/api/projects/${p.projectId}`, true);
          if (r.success && r.data?.project) {
            setWsProjects((prev) => {
              if (prev.some((x) => x.id === p.projectId)) return prev;
              return [r.data!.project, ...prev];
            });
          }
        } catch { /* silencio */ }
        break;
      }
      case 'project.updated':
      case 'project.status.changed': {
        if (!p.projectId) break;
        try {
          const r = await apiService.get<{ project: any }>(`/api/projects/${p.projectId}`, true);
          if (r.success && r.data?.project) {
            setWsProjects((prev) =>
              prev.map((x) => (x.id === p.projectId ? r.data!.project : x))
            );
          }
        } catch { /* silencio */ }
        break;
      }
      case 'project.deleted': {
        if (p.projectId) {
          setWsProjects((prev) => prev.filter((x) => x.id !== p.projectId));
        }
        break;
      }
      case 'board.created': {
        if (!p.boardId) break;
        try {
          const r = await apiService.get<{ board: any }>(`/api/boards/${p.boardId}`, true);
          if (r.success && r.data?.board) {
            setOrphanBoards((prev) => {
              if (prev.some((b) => b.id === p.boardId)) return prev;
              return [r.data!.board, ...prev];
            });
          }
        } catch { /* silencio */ }
        break;
      }
      case 'project.board.linked': {
        if (p.boardId) {
          setOrphanBoards((prev) => prev.filter((b) => b.id !== p.boardId));
        }
        if (p.projectId) {
          try {
            const r = await apiService.get<{ project: any }>(`/api/projects/${p.projectId}`, true);
            if (r.success && r.data?.project) {
              setWsProjects((prev) =>
                prev.map((x) => (x.id === p.projectId ? r.data!.project : x))
              );
            }
          } catch { /* silencio */ }
        }
        break;
      }
      case 'project.board.unlinked': {
        if (p.boardId) {
          try {
            const r = await apiService.get<{ board: any }>(`/api/boards/${p.boardId}`, true);
            if (r.success && r.data?.board) {
              setOrphanBoards((prev) => {
                if (prev.some((b) => b.id === p.boardId)) return prev;
                return [r.data!.board, ...prev];
              });
            }
          } catch { /* silencio */ }
        }
        if (p.projectId) {
          setWsProjects((prev) =>
            prev.map((x) =>
              x.id === p.projectId
                ? { ...x, boards: (x.boards ?? []).filter((b: any) => b.id !== p.boardId) }
                : x
            )
          );
        }
        break;
      }
      case 'board.archived':
      case 'board.deleted': {
        if (p.boardId) {
          setOrphanBoards((prev) => prev.filter((b) => b.id !== p.boardId));
        }
        break;
      }
    }
  }, []);

  // ── Real-time workspace events ────────────────────────────────────────────
  const handleWorkspaceEvent = useCallback((event: { type: string; payload: any }) => {
    const type = event.type as string;

    // Miembros
    if (
      type === 'workspace.member.invited' ||
      type === 'workspace.member.removed' ||
      type === 'workspace.member.role-changed'
    ) {
      fetchMembers(workspaceId);
    }

    // Workspace info
    if (type === 'workspace.updated') {
      fetchWorkspaceById(workspaceId);
    }

    // Documentos
    if (type === 'document.created') {
      setDocRefreshKey((k) => k + 1);
    }

    // Stats
    if (
      type === 'card.created' || type === 'card.updated' ||
      type === 'card.deleted' || type === 'card.status-changed' || type === 'card.moved'
    ) {
      fetchStats(workspaceId);
    }

    // Activity feed del sidebar — refrescar en cualquier evento relevante
    if (
      !type.startsWith('github.') &&
      !type.startsWith('presence.')
    ) {
      setActivityRefreshKey((k) => k + 1);
      // Si el tab de actividad está abierto, prepend para respuesta inmediata
      if (activeTabRef.current === 'activity') {
        setActivityEvents((prev) => [event, ...prev]);
      }
    }
  }, [workspaceId, fetchMembers, fetchWorkspaceById, fetchStats]);

  useEffect(() => {
    if (!workspaceId) return;
    const join = () => socketService.joinWorkspace(workspaceId);
    const onEvent = (event: any) => {
      handleEvent(event);
      handleProjectEvent(event);
      handleWorkspaceEvent(event);
      if ((event.type as string)?.startsWith('github.')) {
        setGithubEvents((prev) => [event, ...prev].slice(0, 20));
        if (!githubConnected) setGithubConnected(true);
      }
    };
    join();
    socketService.onConnect(join);
    socketService.on('event', onEvent);
    return () => {
      socketService.leaveWorkspace(workspaceId);
      socketService.offConnect(join);
      socketService.off('event', onEvent);
    };
  }, [workspaceId, handleEvent, handleProjectEvent, handleWorkspaceEvent]);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !currentWorkspace) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 1s linear infinite' }}>
          <circle cx="12" cy="12" r="9" stroke="rgba(56,182,255,0.15)" strokeWidth="2" />
          <path d="M12 3a9 9 0 0 1 9 9" stroke={C.accent} strokeWidth="2" strokeLinecap="round" />
        </svg>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (!currentWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-3">
        <p style={{ fontSize: '15px', color: C.text2 }}>{t.workspace_not_found_title}</p>
        <Link href="/dashboard/workspaces" style={{ fontSize: '13px', color: C.accent }}>{t.workspace_btn_back}</Link>
      </div>
    );
  }

  // ── Derived ───────────────────────────────────────────────────────────────
  const isOwnerOrAdmin   = ['OWNER', 'ADMIN'].includes(currentWorkspace.userRole || '');
  const isOwner          = currentWorkspace.userRole === 'OWNER';
  const activeBoards     = boards.filter((b) => !b.archived);
  const archivedBoards   = boards.filter((b) =>  b.archived);
  const accentColor      = currentWorkspace.color || C.accent;
  const initial          = (currentWorkspace.name || '?')[0].toUpperCase();
  const roleBadge        = getRoleBadge(currentWorkspace.userRole || 'MEMBER', t);
  const completionPct    = currentStats && currentStats.totalCards > 0
    ? Math.round((currentStats.completedCards / currentStats.totalCards) * 100) : 0;
  const boardProgressMap = new Map(
    (currentStats?.boardProgress ?? []).map((bp) => [bp.boardId, bp])
  );
  const atRiskCount = wsProjects.filter((p) => p.status === 'ACTIVE' && (p.progressPercent ?? 100) < 50).length;
  const showSidebar = activeTab !== 'members' && activeTab !== 'activity';

  // boardId → project (for PROYECTO column)
  const projectBoardMap = new Map<string, { id: string; name: string; color?: string }>();
  for (const proj of wsProjects) {
    for (const b of (proj.boards as any[]) ?? []) {
      projectBoardMap.set(b.id, { id: proj.id, name: proj.name, color: proj.color ?? undefined });
    }
  }

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleConfirmRemove = async () => {
    if (!memberToRemove) return;
    setRemovingMember(true);
    try { await removeMember(workspaceId, memberToRemove.userId); setMemberToRemove(null); }
    catch { alert(t.workspace_error_removing_member); }
    finally { setRemovingMember(false); }
  };

  const handleChangeRole = async (userId: string, role: string) => {
    setChangingRole(true);
    try { await changeMemberRole(workspaceId, userId, role); }
    catch { /* silencio */ }
    finally { setChangingRole(false); setRoleMenuOpen(null); }
  };

  const handleDeleteBoard = async () => {
    if (!boardToDelete) return;
    setIsDeletingBoard(true);
    try {
      await deleteBoard(boardToDelete.id);
      toast.deleted('Board', boardToDelete.name);
      setBoardToDelete(null);
    } catch (err: any) {
      const code = err?.code;
      if (code === 'BOARD_NOT_ARCHIVED')  toast.error(t.ws_board_error_not_archived);
      else if (code === 'BOARD_HAS_LISTS') toast.error(t.ws_board_error_has_lists);
      else toast.error(err?.message || t.ws_board_error_delete);
    } finally { setIsDeletingBoard(false); }
  };

  // ── Icon size shorthand ───────────────────────────────────────────────────
  const ic = (s: number) => ({ width: `${s}px`, height: `${s}px` } as const);

  // ── Tab definitions ───────────────────────────────────────────────────────
  const TABS: Array<{ key: TabKey; label: string; icon: React.ReactNode; count?: number }> = [
    { key: 'overview',  label: 'Overview',                icon: <LayoutDashboard style={ic(11)} />,  count: undefined },
    { key: 'projects',  label: t.projects_title,          icon: <FolderOpen      style={ic(11)} />,  count: wsProjects.length || undefined },
    { key: 'docs',      label: 'Docs',                    icon: <FileText        style={ic(11)} />,  count: undefined },
    { key: 'members',   label: t.workspace_section_members, icon: <Users         style={ic(11)} />,  count: currentMembers.length || undefined },
    { key: 'activity',  label: t.workspace_section_activity, icon: <Activity     style={ic(11)} />,  count: undefined },
  ];

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: C.bg, overflow: 'hidden' }}>

        {/* ══ HEADER ══════════════════════════════════════════════════════ */}
        <header style={{ background: C.bg2, borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>

          {/* Breadcrumb row + top-right actions */}
          <div style={{
            padding: '7px 20px',
            borderBottom: `1px solid ${C.border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <button
              onClick={() => router.push('/dashboard/workspaces')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = C.text)}
              onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" width="13" height="13">
                <path d="M10 3L5 8l5 5" />
              </svg>
              {t.btn_back}
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              {/* Member avatars stacked */}
              <div style={{ display: 'flex', alignItems: 'center' }}>
                {currentMembers.slice(0, 4).map((m, idx) => {
                  const avatarUrl = getAvatarUrl(m.user?.avatar ?? null);
                  const mColor    = hashColor(m.userId);
                  return (
                    <div key={m.id} title={m.user?.name} style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      marginLeft: idx === 0 ? 0 : '-8px',
                      background: `linear-gradient(135deg, ${mColor}dd, ${mColor}88)`,
                      border: `2px solid ${C.bg2}`, zIndex: 4 - idx, position: 'relative',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color: '#fff', overflow: 'hidden',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.4)',
                    }}>
                      {avatarUrl
                        ? <img src={avatarUrl} alt={m.user?.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : (m.user?.name || '?').slice(0, 2).toUpperCase()
                      }
                    </div>
                  );
                })}
                {currentMembers.length > 4 && (
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '50%',
                    marginLeft: '-8px', zIndex: 0, position: 'relative',
                    background: C.hover, border: `2px solid ${C.bg2}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '9px', fontWeight: 700, color: C.text3,
                  }}>
                    +{currentMembers.length - 4}
                  </div>
                )}
              </div>

              {isOwnerOrAdmin && (
                <button onClick={() => setShowInviteModal(true)}
                  style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: C.surface, color: C.text2, border: `1px solid ${C.border2}`, cursor: 'pointer', transition: 'border-color 0.1s, color 0.1s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.text4; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
                >
                  {t.ws_btn_invite}
                </button>
              )}
            </div>
          </div>

          {/* Identity + description + stats */}
          <div style={{
            padding: '14px 20px 12px',
            display: 'flex', alignItems: 'flex-start', gap: '14px',
            background: `linear-gradient(to bottom, ${accentColor}07, transparent)`,
          }}>
            {/* Letter avatar */}
            <div style={{
              width: '52px', height: '52px', borderRadius: '12px', flexShrink: 0,
              background: accentColor,
              boxShadow: `0 0 0 1px ${accentColor}66, 0 4px 12px ${accentColor}33`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '22px', fontWeight: 800, color: '#fff',
            }}>
              {initial}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                <span style={{ fontSize: '17px', fontWeight: 700, color: C.text, letterSpacing: '-0.01em' }}>
                  {currentWorkspace.name}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 700, letterSpacing: '0.05em',
                  padding: '2px 7px', borderRadius: '4px',
                  background: roleBadge.bg, color: roleBadge.color, border: `1px solid ${roleBadge.border}`,
                }}>
                  {roleBadge.label.toUpperCase()}
                </span>
              </div>

              {currentWorkspace.description && (
                <p style={{ fontSize: '12.5px', color: C.text3, marginBottom: '9px', lineHeight: 1.45, maxWidth: '560px' }}>
                  {currentWorkspace.description}
                </p>
              )}

              {/* Stats row — clickable */}
              <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '0' }}>
                {([
                  { icon: <LayoutGrid style={ic(11)} />, label: `${activeBoards.length} board${activeBoards.length !== 1 ? 's' : ''}`,           tab: 'projects' as TabKey },
                  { icon: <FolderOpen style={ic(11)} />, label: t.projects_count(wsProjects.length),           tab: 'projects' as TabKey },
                  { icon: <Users      style={ic(11)} />, label: t.ws_members_team(currentMembers.length),       tab: 'members'  as TabKey },
                ] as const).map(({ icon, label, tab }, i) => (
                  <button key={i} onClick={() => setActiveTab(tab)} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer',
                    padding: '0', transition: 'color 0.1s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = C.text3)}
                  >
                    {i > 0 && <span style={{ color: C.text4, margin: '0 8px' }}>·</span>}
                    {icon}
                    <span>{label}</span>
                  </button>
                ))}
                {atRiskCount > 0 && (
                  <button onClick={() => setActiveTab('projects')} style={{
                    display: 'flex', alignItems: 'center', gap: '4px',
                    fontSize: '12px', color: C.amber, background: 'none', border: 'none', cursor: 'pointer',
                    marginLeft: '10px', padding: '0', transition: 'opacity 0.1s',
                  }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                  >
                    <AlertCircle style={ic(11)} />
                    <span>{t.ws_projects_at_risk(atRiskCount)}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tab bar */}
          <div style={{ padding: '0 20px', display: 'flex', alignItems: 'center', borderTop: `1px solid ${C.border}` }}>
            {TABS.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  style={{
                    padding: '10px 13px',
                    fontSize: '12.5px', fontWeight: isActive ? 600 : 400,
                    color: isActive ? C.text : C.text3,
                    background: 'transparent', border: 'none',
                    borderBottom: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                    cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: '5px',
                    marginBottom: '-1px', transition: 'color 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.color = C.text2; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.color = C.text3; }}
                >
                  <span style={{ opacity: isActive ? 1 : 0.6 }}>{tab.icon}</span>
                  {tab.label}
                  {tab.count !== undefined && (
                    <span style={{
                      fontSize: '10.5px', fontWeight: 600,
                      padding: '0 5px', borderRadius: '8px',
                      background: isActive ? `${accentColor}22` : C.hover,
                      color: isActive ? accentColor : C.text4,
                      border: `1px solid ${isActive ? accentColor + '33' : C.border}`,
                      lineHeight: '16px',
                    }}>
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
            <div style={{ flex: 1 }} />
            <Link href={`/dashboard/workspaces/${workspaceId}/settings`}
              style={{ padding: '10px 13px', fontSize: '12.5px', color: C.text4, textDecoration: 'none', borderBottom: '2px solid transparent', marginBottom: '-1px', display: 'flex', alignItems: 'center', gap: '5px', transition: 'color 0.1s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text4; }}
            >
              {t.workspace_btn_settings}
            </Link>
          </div>

          {/* Accent gradient line */}
          <div style={{ height: '2px', background: `linear-gradient(90deg, ${accentColor}cc, ${accentColor}44, transparent)` }} />
        </header>

        {/* ══ MAIN LAYOUT ═════════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

          {/* Content area */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '22px 26px', display: 'flex', flexDirection: 'column', gap: '22px' }}>

            {/* ── OVERVIEW ────────────────────────────────────────────── */}
            {activeTab === 'overview' && (
              <>
                {/* Projects mini-grid */}
                <section>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <FolderOpen style={{ ...ic(13), color: accentColor }} />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{t.projects_title}</span>
                      {wsProjects.length > 0 && (
                        <span style={{ fontSize: '11px', padding: '0 6px', borderRadius: '10px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '18px' }}>
                          {wsProjects.length}
                        </span>
                      )}
                    </div>
                    <button onClick={() => setActiveTab('projects')}
                      style={{ fontSize: '11.5px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                    >
                      {t.ws_view_all}
                    </button>
                  </div>
                  {(() => {
                    const overviewProjects = wsProjects.filter((p) => p.status === 'ACTIVE');
                    return overviewProjects.length === 0 ? (
                    <div style={{ padding: '24px', borderRadius: '8px', border: `1px dashed ${C.border2}`, textAlign: 'center' }}>
                      <p style={{ fontSize: '13px', color: C.text3 }}>{t.ws_no_active_projects_in_ws}</p>
                    </div>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
                      {overviewProjects.slice(0, 3).map((proj) => {
                        const pct       = proj.progressPercent ?? 0;
                        const st        = getStatusBadge(proj.status, t);
                        const projColor = proj.color || accentColor;
                        const boardList = (proj.boards as any[]) ?? [];
                        const showHealth = proj.status !== 'PLANNING' && boardList.length > 0;
                        const hb        = showHealth ? getHealthBadge(pct, t) : null;
                        return (
                          <Link key={proj.id} href={`/dashboard/projects/${proj.id}`} style={{ textDecoration: 'none', display: 'block' }}>
                            <div
                              style={{ background: C.surface, borderRadius: '9px', border: `1px solid ${C.border}`, overflow: 'hidden', transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s', height: '100%' }}
                              onMouseEnter={(e) => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.borderColor = projColor + '55';
                                el.style.transform = 'translateY(-1px)';
                                el.style.boxShadow = `0 4px 16px ${projColor}18`;
                              }}
                              onMouseLeave={(e) => {
                                const el = e.currentTarget as HTMLElement;
                                el.style.borderColor = C.border;
                                el.style.transform = 'translateY(0)';
                                el.style.boxShadow = 'none';
                              }}
                            >
                              {/* Color stripe — gradient */}
                              <div style={{ height: '3px', background: `linear-gradient(to right, ${projColor}, ${projColor}55)` }} />
                              <div style={{ padding: '12px 14px 13px' }}>
                                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '8px', marginBottom: '5px' }}>
                                  <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, lineHeight: 1.3 }}>
                                    {proj.name}
                                  </span>
                                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: st.bg, color: st.color, border: `1px solid ${st.border}`, flexShrink: 0, lineHeight: '16px' }}>
                                    {st.label}
                                  </span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                                  <span style={{ fontSize: '11px', color: C.text4 }}>
                                    {boardList.length} board{boardList.length !== 1 ? 's' : ''}
                                  </span>
                                  {hb && (
                                    <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '3px', background: hb.bg, color: hb.color, border: `1px solid ${hb.border}` }}>
                                      {hb.label}
                                    </span>
                                  )}
                                </div>
                                {/* Progress bar */}
                                <div style={{ height: '3px', background: C.border2, borderRadius: '2px', overflow: 'hidden', marginBottom: '5px' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, borderRadius: '2px', background: pct === 100 ? C.green : `linear-gradient(to right, ${projColor}, ${projColor}bb)`, transition: 'width 0.4s ease' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: C.text4 }}>{pct}% completado</span>
                              </div>
                            </div>
                          </Link>
                        );
                      })}

                      {/* Card: Nuevo proyecto */}
                      <button
                        onClick={() => setShowCreateProjectModal(true)}
                        style={{ background: 'none', border: `1.5px dashed ${C.border2}`, borderRadius: '9px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px 14px', transition: 'border-color 0.15s, background 0.15s', minHeight: '110px', width: '100%' }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = accentColor + '88';
                          e.currentTarget.style.background = accentColor + '08';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = C.border2;
                          e.currentTarget.style.background = 'none';
                        }}
                      >
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: accentColor + '18', border: `1px solid ${accentColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <Plus style={{ ...ic(13), color: accentColor }} />
                        </div>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: C.text3 }}>{t.projects_btn_create}</span>
                      </button>
                    </div>
                  );
                  })()}
                </section>

                {/* Stats panel */}
                {currentStats && currentStats.totalCards > 0 && (
                  <section>
                    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '9px', padding: '16px 18px' }}>
                      <p style={{ fontSize: '12.5px', fontWeight: 600, color: C.text, marginBottom: '14px' }}>{t.ws_stats_title}</p>
                      <div style={{ marginBottom: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', color: C.text3 }}>Completado</span>
                          <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.green }}>{completionPct}%</span>
                        </div>
                        <div style={{ height: '5px', borderRadius: '4px', background: C.hover, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: '4px', width: `${completionPct}%`, background: `linear-gradient(to right, ${accentColor}, ${C.green})`, transition: 'width 0.5s' }} />
                        </div>
                        <div style={{ fontSize: '11px', color: C.text4, marginTop: '5px' }}>
                          {currentStats.completedCards} {t.ws_stats_of} {currentStats.totalCards} {t.ws_stats_cards_done}
                        </div>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                        {[
                          { label: t.ws_stats_overdue,    value: currentStats.overdueCards,      color: currentStats.overdueCards > 0 ? C.red : C.text4,     Icon: AlertCircle },
                          { label: t.ws_stats_unassigned, value: currentStats.unassignedCards,   color: currentStats.unassignedCards > 0 ? C.amber : C.text4, Icon: UserX },
                          { label: t.ws_stats_this_week,  value: currentStats.completedThisWeek, color: accentColor,                                           Icon: Zap },
                        ].map(({ label, value, color, Icon }) => (
                          <div key={label} style={{ padding: '10px', background: C.hover, border: `1px solid ${C.border}`, borderRadius: '7px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            <Icon style={{ ...ic(13), color }} />
                            <span style={{ fontSize: '19px', fontWeight: 700, color, lineHeight: 1 }}>{value}</span>
                            <span style={{ fontSize: '10.5px', color: C.text4 }}>{label}</span>
                          </div>
                        ))}
                      </div>
                      {currentStats.completedThisWeek !== currentStats.completedLastWeek && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${C.border}` }}>
                          {currentStats.completedThisWeek > currentStats.completedLastWeek
                            ? <TrendingUp  style={{ ...ic(13), color: C.green }} />
                            : <TrendingDown style={{ ...ic(13), color: C.red }} />
                          }
                          <span style={{ fontSize: '12px', color: C.text3 }}>
                            {Math.abs(currentStats.completedThisWeek - currentStats.completedLastWeek)} {t.board_stat_cards}{' '}
                            {currentStats.completedThisWeek > currentStats.completedLastWeek ? t.ws_more_last_week : t.ws_less_last_week}
                          </span>
                        </div>
                      )}
                    </div>
                  </section>
                )}
              </>
            )}

            {/* ── PROJECTS tab ────────────────────────────────────────── */}
            {activeTab === 'projects' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

                {/* Barra superior */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>{t.projects_title} — {currentWorkspace?.name}</span>
                    {wsProjects.length > 0 && (
                      <span style={{ fontSize: '11px', padding: '0 6px', borderRadius: '10px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '18px' }}>
                        {wsProjects.length}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      onClick={() => setShowCreateProjectModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: accentColor, color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <Plus style={ic(12)} /> {t.projects_btn_create}
                    </button>
                  </div>
                </div>

                {/* Empty state */}
                {wsProjects.length === 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '56px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
                    <FolderOpen style={{ width: '28px', height: '28px', color: C.text4 }} />
                    <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>{t.ws_no_projects_in_ws}</p>
                  </div>
                )}

                {/* Cards — separar ACTIVE/ON_HOLD/COMPLETED de PLANNING */}
                {(() => {
                  const activeProjects  = wsProjects.filter((p) => p.status !== 'PLANNING');
                  const planningProjects = wsProjects.filter((p) => p.status === 'PLANNING');

                  const renderCard = (proj: typeof wsProjects[0]) => {
                  const pct        = proj.progressPercent ?? 0;
                  const st         = getStatusBadge(proj.status, t);
                  const projColor  = proj.color || accentColor;
                  const projBoards = (proj.boards as any[]) ?? [];
                  const projDl     = proj.endDate ? makeDl(proj.endDate) : null;
                  const initial    = proj.name.trim()[0]?.toUpperCase() ?? '?';
                  const totalTasks = projBoards.reduce((acc: number, b: any) => {
                    const bp = boardProgressMap.get(b.id);
                    return acc + (bp?.total ?? 0);
                  }, 0);

                  return (
                    <div key={proj.id} style={{ background: C.surface, borderRadius: '10px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>

                      {/* Barra de progreso a ancho completo */}
                      <div style={{ height: '5px', background: C.border2, position: 'relative' }}>
                        <div style={{ position: 'absolute', inset: 0, width: `${pct}%`, background: pct === 100 ? C.green : `linear-gradient(to right, ${projColor}, ${projColor}99)`, transition: 'width 0.5s ease' }} />
                      </div>

                      {/* Header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '13px 16px' }}>

                        {/* Icono con inicial */}
                        <div style={{ width: '42px', height: '42px', borderRadius: '10px', background: projColor + '20', border: `1.5px solid ${projColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ fontSize: '18px', fontWeight: 700, color: projColor, lineHeight: 1 }}>{initial}</span>
                        </div>

                        {/* Nombre + descripción */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '7px', flexWrap: 'wrap', marginBottom: '2px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{proj.name}</span>
                            <span style={{ fontSize: '10px', fontWeight: 700, padding: '1px 7px', borderRadius: '4px', background: st.bg, color: st.color, border: `1px solid ${st.border}`, letterSpacing: '0.04em' }}>{st.label}</span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ fontSize: '11.5px', color: C.text4 }}>{projBoards.length} board{projBoards.length !== 1 ? 's' : ''}</span>
                            {totalTasks > 0 && <span style={{ fontSize: '11.5px', color: C.text4 }}>· {totalTasks} {t.board_stat_cards}</span>}
                            {projDl && <span style={{ fontSize: '11.5px', color: pct < 50 ? C.amber : C.text4 }}>· {projDl.text}</span>}
                          </div>
                        </div>

                        {/* % + link */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: C.text3 }}>{pct}%</span>
                          <Link href={`/dashboard/projects/${proj.id}`}
                            style={{ fontSize: '12px', color: accentColor, textDecoration: 'none', whiteSpace: 'nowrap', padding: '5px 11px', borderRadius: '6px', border: `1px solid ${accentColor}44`, background: accentColor + '0d', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = accentColor + '22'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = accentColor + '0d'; }}
                          >
                            {t.ws_view_project}
                          </Link>
                        </div>
                      </div>

                      {/* Boards sub-lista */}
                      {projBoards.length > 0 && (
                        <div style={{ borderTop: `1px solid ${C.border}` }}>
                          {projBoards.slice(0, 5).map((b: any, bIdx: number) => {
                            const bp       = boardProgressMap.get(b.id);
                            const bPct     = bp && bp.total > 0 ? Math.round((bp.completed / bp.total) * 100) : 0;
                            const bColor   = b.color || projColor;
                            const isLive   = (boardActiveUsers[b.id]?.count ?? 0) > 0;
                            const boardObj = boards.find((bd) => bd.id === b.id);
                            const bStatus  = boardObj ? getBoardStatus(boardObj.updatedAt, isLive, t) : null;
                            return (
                              <div key={b.id}
                                onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/boards/${b.id}`)}
                                style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '7px 16px 7px 72px', cursor: 'pointer', borderTop: bIdx > 0 ? `1px solid ${C.border}` : 'none', transition: 'background 0.1s' }}
                                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                              >
                                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: bColor, flexShrink: 0, boxShadow: isLive ? `0 0 5px ${bColor}99` : 'none' }} />
                                <span style={{ fontSize: '12.5px', color: C.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                                {/* Pills */}
                                {bStatus && (
                                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: bStatus.bg, color: bStatus.color, border: `1px solid ${bStatus.border}`, flexShrink: 0 }}>{bStatus.label}</span>
                                )}
                                {bp && bp.total > 0 && (
                                  <span style={{ fontSize: '10.5px', color: C.text4, background: C.hover, border: `1px solid ${C.border2}`, borderRadius: '4px', padding: '1px 6px', flexShrink: 0 }}>{bp.completed}/{bp.total}</span>
                                )}
                                {boardObj && (
                                  <span style={{ fontSize: '10.5px', color: C.text4, flexShrink: 0 }}>{ago(boardObj.updatedAt)}</span>
                                )}
                                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', width: '60px', flexShrink: 0 }}>
                                  <div style={{ flex: 1, height: '2px', background: C.border2, borderRadius: '1px', overflow: 'hidden' }}>
                                    <div style={{ height: '100%', width: `${bPct}%`, background: bPct === 100 ? C.green : `linear-gradient(to right, ${bColor}, ${C.green})` }} />
                                  </div>
                                  <span style={{ fontSize: '10px', color: C.text4 }}>{bPct}%</span>
                                </div>
                              </div>
                            );
                          })}
                          {projBoards.length > 5 && (
                            <div style={{ padding: '5px 72px', borderTop: `1px solid ${C.border}` }}>
                              <span style={{ fontSize: '11px', color: C.text4 }}>+{projBoards.length - 5} boards más</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                  }; // fin renderCard

                  return (
                    <>
                      {/* Proyectos activos / en pausa / completados */}
                      {activeProjects.length === 0 && planningProjects.length > 0 && (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '40px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
                          <FolderOpen style={{ width: '24px', height: '24px', color: C.text4 }} />
                          <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>{t.ws_no_active_projects}</p>
                          <p style={{ margin: 0, fontSize: '12px', color: C.text4 }}>{t.ws_planning_below}</p>
                        </div>
                      )}
                      {activeProjects.map(renderCard)}

                      {/* ── En planificación (colapsable) ─────────────────── */}
                      {planningProjects.length > 0 && (
                        <div style={{ borderRadius: '10px', border: '1px solid rgba(56,182,255,0.28)', background: 'rgba(56,182,255,0.03)' }}>
                          {/* Header */}
                          <button
                            onClick={() => setPlanningOpen(!planningOpen)}
                            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '10px', transition: 'background 0.15s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(56,182,255,0.07)'; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            {/* Chevron en caja azul */}
                            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(56,182,255,0.14)', border: '1px solid rgba(56,182,255,0.28)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
                              <ChevronDown style={{ width: '12px', height: '12px', color: C.accent, transform: planningOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.22s ease', flexShrink: 0 }} />
                            </div>

                            {/* Título + badge */}
                            <span style={{ fontSize: '13px', fontWeight: 600, color: C.accent }}>{t.projects_status_planning}</span>
                            <span style={{ fontSize: '10.5px', fontWeight: 700, padding: '1px 8px', borderRadius: '10px', background: 'rgba(56,182,255,0.13)', color: C.accent, border: '1px solid rgba(56,182,255,0.28)', lineHeight: '18px', flexShrink: 0 }}>
                              {planningProjects.length}
                            </span>

                            {/* Derecha: hint */}
                            <span style={{ fontSize: '11.5px', color: C.text4, marginLeft: 'auto', flexShrink: 0 }}>
                              {planningProjects.length === 1 ? '1 proyecto sin iniciar' : `${planningProjects.length} proyectos sin iniciar`}
                            </span>
                            <Zap style={{ width: '11px', height: '11px', color: 'rgba(56,182,255,0.5)', flexShrink: 0 }} />
                          </button>

                          {/* Contenido animado con grid */}
                          <div style={{ display: 'grid', gridTemplateRows: planningOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
                            <div style={{ overflow: 'hidden' }}>
                              <div style={{ borderTop: '1px solid rgba(56,182,255,0.18)' }}>
                                {planningProjects.map((proj, idx) => (
                                  <div key={proj.id} style={{ borderTop: idx > 0 ? `1px solid ${C.border}` : 'none' }}>
                                    {renderCard(proj)}
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}

                {/* ── Sin proyecto ─────────────────────────────────────── */}
                {orphanBoards.length > 0 && (
                  <div style={{ background: C.surface, borderRadius: '10px', border: `1px solid ${C.border}` }}>
                    {/* Cabecera colapsable */}
                    <button
                      onClick={() => setOrphanOpen(!orphanOpen)}
                      style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '10px', padding: '11px 16px', background: 'none', border: 'none', cursor: 'pointer', borderRadius: '10px', transition: 'background 0.15s' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      <ChevronDown style={{ ...ic(11), color: C.text4, transform: orphanOpen ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.22s ease', flexShrink: 0 }} />
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text3 }}>{t.ws_no_project_label}</span>
                      <span style={{ fontSize: '11px', padding: '0 6px', borderRadius: '10px', background: C.hover, color: C.text4, border: `1px solid ${C.border2}`, lineHeight: '18px' }}>
                        {orphanBoards.length}
                      </span>
                      <span style={{ fontSize: '11.5px', color: C.text4, marginLeft: 'auto' }}>{t.ws_boards_unassigned}</span>
                    </button>

                    {/* Filas animadas */}
                    <div style={{ display: 'grid', gridTemplateRows: orphanOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.28s ease' }}>
                      <div style={{ overflow: 'hidden' }}>
                    {orphanBoards.map((board: any, idx: number) => {
                      const bColor = board.color || accentColor;
                      return (
                        <div key={board.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '9px 16px 9px 38px', borderTop: `1px solid ${C.border}` }}
                        >
                          {/* Icono */}
                          <div style={{ width: '32px', height: '32px', borderRadius: '7px', flexShrink: 0, background: `${bColor}18`, border: `1.5px solid ${bColor}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: bColor }}>
                            {board.name[0].toUpperCase()}
                          </div>
                          {/* Nombre */}
                          <div
                            style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
                            onClick={() => router.push(`/dashboard/workspaces/${workspaceId}/boards/${board.id}`)}
                          >
                            <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{board.name}</p>
                            <p style={{ margin: 0, fontSize: '11px', color: C.text4, marginTop: '1px' }}>{board.cardCount || 0} cards · {ago(board.updatedAt)}</p>
                          </div>
                          {/* Asignar a proyecto */}
                          {wsProjects.length > 0 && (
                            <select
                              value=""
                              onChange={async (e) => {
                                const projectId = e.target.value;
                                if (!projectId) return;
                                setAssigningBoardId(board.id);
                                try {
                                  await apiService.post(`/api/projects/${projectId}/boards`, { boardId: board.id }, true);
                                  setOrphanBoards((prev) => prev.filter((b) => b.id !== board.id));
                                  fetchProjectsByWorkspace(workspaceId).then(setWsProjects);
                                } catch {
                                  // silently fail
                                } finally {
                                  setAssigningBoardId(null);
                                }
                              }}
                              disabled={assigningBoardId === board.id}
                              style={{ fontSize: '11.5px', padding: '4px 8px', borderRadius: '6px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer', outline: 'none' }}
                            >
                              <option value="">{t.ws_assign_to_project}</option>
                              {wsProjects.map((p) => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ── DOCS tab ────────────────────────────────────────────── */}
            {activeTab === 'docs' && (
              <DocumentsSection workspaceId={workspaceId} isOwnerOrAdmin={isOwnerOrAdmin} accentColor={accentColor} refreshKey={docRefreshKey} />
            )}

            {/* ── MEMBERS tab ─────────────────────────────────────────── */}
            {activeTab === 'members' && (
              <section style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>
                    {t.workspace_section_members} · {currentMembers.length}
                  </span>
                  {isOwnerOrAdmin && (
                    <button onClick={() => setShowInviteModal(true)}
                      style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 500, background: accentColor, color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                      onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                    >
                      <Plus style={ic(13)} /> {t.ws_btn_invite}
                    </button>
                  )}
                </div>

                {/* Equipos con sus miembros */}
                {wsTeams.length > 0 && wsTeams.map((team) => {
                  const teamColor = team.color || accentColor;
                  return (
                    <div key={team.id}>
                      {/* Team header */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: teamColor, flexShrink: 0 }} />
                        <span style={{ fontSize: '12px', fontWeight: 600, color: C.text2 }}>{team.name}</span>
                        <span style={{ fontSize: '11px', color: C.text4 }}>· {t.ws_members_team(team.members.length)}</span>
                        <div style={{ flex: 1, height: '1px', background: C.border }} />
                      </div>
                      {/* Members table */}
                      <div style={{ background: C.surface, borderRadius: '9px', border: `1px solid ${C.border}`, overflow: 'hidden', marginBottom: '4px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `1fr 110px 100px${isOwner ? ' 90px' : ''}`, padding: '7px 18px', borderBottom: `1px solid ${C.border}`, background: C.bg2 }}>
                          {(['MEMBER', 'WS ROLE', 'TEAM ROLE', ...(isOwner ? ['ACTIONS'] : [])] as string[]).map((col) => (
                            <span key={col} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: C.text4 }}>{col}</span>
                          ))}
                        </div>
                        {team.members.map((member: any, idx: number) => {
                          const wsMember = currentMembers.find((m) => m.userId === member.id);
                          const mb = getRoleBadge(wsMember?.role || 'MEMBER', t);
                          const avatarUrl = getAvatarUrl(member.avatar ?? null);
                          const mColor = hashColor(member.id);
                          const isMenuOpen = roleMenuOpen === member.id;
                          const canActOn = isOwner && wsMember?.role !== 'OWNER';
                          return (
                            <div key={member.id}
                              style={{ display: 'grid', gridTemplateColumns: `1fr 110px 100px${isOwner ? ' 90px' : ''}`, padding: '11px 18px', alignItems: 'center', borderTop: idx > 0 ? `1px solid ${C.border}` : 'none', transition: 'background 0.1s' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0, background: `linear-gradient(135deg, ${mColor}ee, ${mColor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff', overflow: 'hidden', boxShadow: `0 0 0 1px ${mColor}44` }}>
                                  {avatarUrl ? <img src={avatarUrl} alt={member.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (member.name || '?').slice(0, 2).toUpperCase()}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '13px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.name}</p>
                                  <p style={{ margin: 0, fontSize: '11px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.email}</p>
                                </div>
                              </div>
                              {/* Rol workspace */}
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: '5px', background: mb.bg, color: mb.color, border: `1px solid ${mb.border}` }}>
                                  {mb.label.toUpperCase()}
                                </span>
                              </div>
                              {/* Rol equipo */}
                              <div>
                                <span style={{ fontSize: '11px', color: member.teamRole === 'LEAD' ? teamColor : C.text4 }}>
                                  {member.teamRole === 'LEAD' ? t.teams_role_lead : t.teams_role_member}
                                </span>
                              </div>
                              {/* Acciones */}
                              {isOwner && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {canActOn && wsMember ? (
                                    <>
                                      <div style={{ position: 'relative' }}>
                                        <button onClick={() => setRoleMenuOpen(isMenuOpen ? null : member.id)} disabled={changingRole}
                                          style={{ width: '26px', height: '26px', borderRadius: '5px', background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, transition: 'all 0.1s' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border2; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border; }}
                                        >
                                          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path d="M7 2a2 2 0 100 4 2 2 0 000-4zM3 11c0-2.2 1.8-4 4-4s4 1.8 4 4" /><path d="M10.5 8.5l1.5 1.5-1.5 1.5" /></svg>
                                        </button>
                                        {isMenuOpen && (
                                          <div style={{ position: 'absolute', right: 0, top: '30px', zIndex: 100, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '7px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '130px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                                                              <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, borderBottom: `1px solid ${C.border}` }}>CHANGE ROLE</div>
                                            {(['ADMIN', 'MEMBER', 'VIEWER'] as const).map((r) => {
                                              const rb = getRoleBadge(r, t); const isCurrent = wsMember.role === r;
                                              return (
                                                <button key={r} onClick={() => handleChangeRole(wsMember.userId, r)} disabled={isCurrent || changingRole}
                                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: isCurrent ? 'default' : 'pointer', color: isCurrent ? C.text3 : C.text2, fontSize: '13px', transition: 'background 0.1s' }}
                                                  onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = C.hover; }}
                                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                                >
                                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: rb.dot, flexShrink: 0 }} />
                                                  {rb.label}
                                                  {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.text4 }}>actual</span>}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={() => setMemberToRemove({ userId: wsMember.userId, name: member.name || '' })}
                                        style={{ width: '26px', height: '26px', borderRadius: '5px', background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, transition: 'all 0.1s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.red}15`; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = `${C.red}40`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border; }}
                                      ><UserMinus style={ic(12)} /></button>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {/* Miembros sin equipo */}
                {(() => {
                  const teamMemberIds = new Set(wsTeams.flatMap((t) => t.members.map((m: any) => m.id)));
                  const standalone = currentMembers.filter((m) => !teamMemberIds.has(m.userId));
                  if (standalone.length === 0 && wsTeams.length > 0) return null;
                  return (
                    <div>
                      {wsTeams.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: C.text3 }}>{t.teams_no_lead}</span>
                          <div style={{ flex: 1, height: '1px', background: C.border }} />
                        </div>
                      )}
                      <div style={{ background: C.surface, borderRadius: '9px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: `1fr 110px${isOwner ? ' 90px' : ''}`, padding: '8px 18px', borderBottom: `1px solid ${C.border}`, background: C.bg2 }}>
                          {(['MEMBER', 'ROLE', ...(isOwner ? ['ACTIONS'] : [])] as string[]).map((col) => (
                            <span key={col} style={{ fontSize: '10px', fontWeight: 700, letterSpacing: '0.08em', color: C.text4 }}>{col}</span>
                          ))}
                        </div>
                        {standalone.map((member, idx) => {
                          const mb = getRoleBadge(member.role, t);
                          const avatarUrl = getAvatarUrl(member.user?.avatar ?? null);
                          const mColor = hashColor(member.userId);
                          const isMenuOpen = roleMenuOpen === member.userId;
                          const canActOn = isOwner && member.role !== 'OWNER';
                          return (
                            <div key={member.id}
                              style={{ display: 'grid', gridTemplateColumns: `1fr 110px${isOwner ? ' 90px' : ''}`, padding: '13px 18px', alignItems: 'center', borderTop: idx > 0 ? `1px solid ${C.border}` : 'none', transition: 'background 0.1s' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                <div style={{ flexShrink: 0 }}>
                                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: `linear-gradient(135deg, ${mColor}ee, ${mColor}88)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: '#fff', overflow: 'hidden', boxShadow: `0 0 0 1px ${mColor}44` }}>
                                    {avatarUrl ? <img src={avatarUrl} alt={member.user?.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : (member.user?.name || '?').slice(0, 2).toUpperCase()}
                                  </div>
                                </div>
                                <div style={{ minWidth: 0 }}>
                                  <p style={{ margin: 0, fontSize: '13.5px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.user?.name}</p>
                                  <p style={{ margin: 0, fontSize: '11.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{member.user?.email || ''}</p>
                                </div>
                              </div>
                              <div>
                                <span style={{ fontSize: '11px', fontWeight: 600, letterSpacing: '0.04em', padding: '2px 8px', borderRadius: '5px', background: mb.bg, color: mb.color, border: `1px solid ${mb.border}` }}>
                                  {mb.label.toUpperCase()}
                                </span>
                              </div>
                              {isOwner && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  {canActOn ? (
                                    <>
                                      <div style={{ position: 'relative' }}>
                                        <button onClick={() => setRoleMenuOpen(isMenuOpen ? null : member.userId)} disabled={changingRole}
                                          style={{ width: '26px', height: '26px', borderRadius: '5px', background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, transition: 'all 0.1s' }}
                                          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; e.currentTarget.style.borderColor = C.border2; }}
                                          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border; }}
                                        >
                                          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><path d="M7 2a2 2 0 100 4 2 2 0 000-4zM3 11c0-2.2 1.8-4 4-4s4 1.8 4 4" /><path d="M10.5 8.5l1.5 1.5-1.5 1.5" /></svg>
                                        </button>
                                        {isMenuOpen && (
                                          <div style={{ position: 'absolute', right: 0, top: '30px', zIndex: 100, background: C.surface, border: `1px solid ${C.border2}`, borderRadius: '7px', boxShadow: '0 8px 24px rgba(0,0,0,0.4)', minWidth: '130px', overflow: 'hidden' }} onClick={(e) => e.stopPropagation()}>
                                            <div style={{ padding: '6px 10px', fontSize: '10px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4, borderBottom: `1px solid ${C.border}` }}>CHANGE ROLE</div>
                                            {(['ADMIN', 'MEMBER', 'VIEWER'] as const).map((r) => {
                                              const rb = getRoleBadge(r, t); const isCurrent = member.role === r;
                                              return (
                                                <button key={r} onClick={() => handleChangeRole(member.userId, r)} disabled={isCurrent || changingRole}
                                                  style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '8px 10px', background: 'none', border: 'none', cursor: isCurrent ? 'default' : 'pointer', color: isCurrent ? C.text3 : C.text2, fontSize: '13px', transition: 'background 0.1s' }}
                                                  onMouseEnter={(e) => { if (!isCurrent) (e.currentTarget as HTMLElement).style.background = C.hover; }}
                                                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'none'; }}
                                                >
                                                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: rb.dot, flexShrink: 0 }} />
                                                  {rb.label}
                                                  {isCurrent && <span style={{ marginLeft: 'auto', fontSize: '10px', color: C.text4 }}>actual</span>}
                                                </button>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                      <button onClick={() => setMemberToRemove({ userId: member.userId, name: member.user?.name || '' })}
                                        style={{ width: '26px', height: '26px', borderRadius: '5px', background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.text3, transition: 'all 0.1s' }}
                                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.red}15`; e.currentTarget.style.color = C.red; e.currentTarget.style.borderColor = `${C.red}40`; }}
                                        onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; e.currentTarget.style.borderColor = C.border; }}
                                      ><UserMinus style={ic(12)} /></button>
                                    </>
                                  ) : null}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </section>
            )}

            {/* ── ACTIVITY tab ────────────────────────────────────────── */}
            {activeTab === 'activity' && (
              <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', alignItems: 'start' }}>
                <div style={{ position: 'sticky', top: '0' }}>
                  <ActivityFiltersComponent
                    filters={activityFilters}
                    onChange={(f) => { setActivityFilters(f); setActivityOffset(0); setActivityEvents([]); }}
                    users={currentMembers.map((m) => ({ id: m.userId, name: m.user?.name || '' }))}
                    boards={activityBoards}
                    accentColor={accentColor}
                  />
                </div>
                <div>
                  {activityError && (
                    <div style={{ padding: '12px 14px', borderRadius: '8px', marginBottom: '12px', background: `${C.red}12`, border: `1px solid ${C.red}33`, color: C.red, fontSize: '13px' }}>
                      {activityError}
                      <button onClick={() => fetchActivityTab(true)} style={{ marginLeft: '10px', textDecoration: 'underline', fontSize: '12px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>
                        Reintentar
                      </button>
                    </div>
                  )}
                  <ActivityTimeline
                    events={activityEvents}
                    onLoadMore={() => { if (!activityLoadingMore && activityHasMore) fetchActivityTab(false); }}
                    hasMore={activityHasMore}
                    isLoading={activityLoading}
                    isLoadingMore={activityLoadingMore}
                    accentColor={accentColor}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── Right sidebar ───────────────────────────────────────────── */}
          {showSidebar && (
            <aside style={{
              width: '256px', flexShrink: 0,
              borderLeft: `1px solid ${C.border}`,
              background: C.bg2,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}>

              {/* Proyectos panel */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => setSideProjects(!sideProjects)}
                  onKeyDown={(e) => e.key === 'Enter' && setSideProjects(!sideProjects)}
                  style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <FolderOpen style={{ ...ic(12), color: accentColor }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.projects_title}</span>
                    <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '16px' }}>
                      {wsProjects.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveTab('projects'); }}
                      style={{ fontSize: '11px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                    >
                      {t.ws_view_all_sidebar}
                    </button>
                    <ChevronDown style={{ ...ic(11), color: C.text4, transform: sideProjects ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  </div>
                </div>
                {sideProjects && (
                  <div style={{ padding: '0 8px 8px' }}>
                    {(() => {
                      const sideActiveProjects = wsProjects.filter((p) => p.status === 'ACTIVE');
                      return sideActiveProjects.length === 0
                      ? <p style={{ fontSize: '12px', color: C.text4, textAlign: 'center', padding: '14px 0' }}>{t.ws_no_active_projects}</p>
                      : sideActiveProjects.slice(0, 5).map((proj) => {
                          const pct       = proj.progressPercent ?? 0;
                          const projColor = proj.color || accentColor;
                          const sideDl    = makeDl(proj.endDate);
                          const bCount    = ((proj.boards as any[]) ?? []).length;
                          const showHealth = proj.status !== 'PLANNING' && bCount > 0;
                          const hb        = showHealth ? getHealthBadge(pct, t) : null;
                          return (
                            <Link key={proj.id} href={`/dashboard/projects/${proj.id}`}
                              style={{ textDecoration: 'none', display: 'block', padding: '7px 7px', borderRadius: '7px', transition: 'background 0.1s' }}
                              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '5px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', flex: 1 }}>
                                  <div style={{ width: '9px', height: '9px', borderRadius: '2px', background: projColor, flexShrink: 0 }} />
                                  <span style={{ fontSize: '12px', fontWeight: 500, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {proj.name}
                                  </span>
                                </div>
                                {hb && (
                                  <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 5px', borderRadius: '4px', background: hb.bg, color: hb.color, border: `1px solid ${hb.border}`, flexShrink: 0, marginLeft: '5px' }}>
                                    {hb.label}
                                  </span>
                                )}
                              </div>
                              {/* Progress bar */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                                <div style={{ flex: 1, height: '3px', background: C.border2, borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? C.green : `linear-gradient(to right, ${projColor}, ${projColor}88)` }} />
                                </div>
                                <span style={{ fontSize: '10px', color: C.text4, fontWeight: 500 }}>{pct}%</span>
                              </div>
                              {/* Context: boards count + days label */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '10.5px', color: C.text4 }}>{bCount} board{bCount !== 1 ? 's' : ''}</span>
                                {sideDl && (
                                  <span style={{ fontSize: '10.5px', color: pct < 50 && sideDl.overdue ? C.red : C.text4 }}>· {sideDl.text}</span>
                                )}
                              </div>
                            </Link>
                          );
                        });
                      })()}
                  </div>
                )}
              </div>

              {/* Miembros panel */}
              <div style={{ borderBottom: `1px solid ${C.border}` }}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => setSideMembers(!sideMembers)}
                  onKeyDown={(e) => e.key === 'Enter' && setSideMembers(!sideMembers)}
                  style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Users style={{ ...ic(12), color: C.green }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.workspace_section_members}</span>
                    <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '16px' }}>
                      {currentMembers.length}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveTab('members'); }}
                      style={{ fontSize: '11px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                    >
                      Ver todos ({currentMembers.length})
                    </button>
                    <ChevronDown style={{ ...ic(11), color: C.text4, transform: sideMembers ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  </div>
                </div>
                {sideMembers && (
                  <div style={{ padding: '0 8px 8px' }}>
                    {currentMembers.slice(0, 5).map((member) => {
                      const mb        = getRoleBadge(member.role, t);
                      const avatarUrl = getAvatarUrl(member.user?.avatar ?? null);
                      const mColor    = hashColor(member.userId);
                      return (
                        <div key={member.id}
                          style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '5px 7px', borderRadius: '6px', transition: 'background 0.1s' }}
                          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                        >
                          <div style={{ position: 'relative', flexShrink: 0 }}>
                            <div style={{
                              width: '28px', height: '28px', borderRadius: '50%',
                              background: `linear-gradient(135deg, ${mColor}ee, ${mColor}88)`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              fontSize: '10px', fontWeight: 700, color: '#fff', overflow: 'hidden',
                            }}>
                              {avatarUrl
                                ? <img src={avatarUrl} alt={member.user?.name} crossOrigin="anonymous" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                : (member.user?.name || '?').slice(0, 2).toUpperCase()
                              }
                            </div>
                            <div style={{
                              position: 'absolute', bottom: '0', right: '0',
                              width: '8px', height: '8px', borderRadius: '50%',
                              background: mb.dot, border: `1.5px solid ${C.bg2}`,
                            }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontSize: '12px', fontWeight: 500, color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.user?.name}
                            </p>
                            <p style={{ fontSize: '10.5px', color: mb.color }}>{mb.label}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* GitHub Activity panel */}
              {githubConnected && (
                <div style={{ borderBottom: `1px solid ${C.border}` }}>
                  <div
                    role="button" tabIndex={0}
                    onClick={() => setSideGithub(!sideGithub)}
                    onKeyDown={(e) => e.key === 'Enter' && setSideGithub(!sideGithub)}
                    style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                      <Github style={{ ...ic(12), color: C.purple }} />
                      <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>GitHub</span>
                      {githubEvents.length > 0 && (
                        <span style={{ fontSize: '10px', padding: '0 5px', borderRadius: '8px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '16px' }}>
                          {githubEvents.length}
                        </span>
                      )}
                    </div>
                    <ChevronDown style={{ ...ic(11), color: C.text4, transform: sideGithub ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  </div>
                  {sideGithub && (
                    <div style={{ padding: '0 8px 8px' }}>
                      {githubEvents.length === 0 ? (
                        <p style={{ fontSize: '12px', color: C.text4, textAlign: 'center', padding: '14px 0' }}>Sin actividad reciente</p>
                      ) : githubEvents.slice(0, 8).map((ev, i) => {
                        const p = ev.payload || {};
                        const repo = (p.repo as string) || '';
                        const repoShort = repo.split('/')[1] || repo;
                        let icon: React.ReactNode;
                        let text = '';

                        if (ev.type === 'github.push.received') {
                          const n = (p.commits as any[])?.length ?? 0;
                          icon = <GitBranch style={{ ...ic(11), color: C.green, flexShrink: 0 }} />;
                          text = `${p.pusher || 'Someone'} pushed ${n} commit${n !== 1 ? 's' : ''} to ${p.branch}`;
                        } else if (ev.type === 'github.pr.opened') {
                          icon = <GitPullRequest style={{ ...ic(11), color: C.accent, flexShrink: 0 }} />;
                          text = `${p.author || 'Someone'} opened PR #${p.prNumber}: ${p.title}`;
                        } else if (ev.type === 'github.pr.merged') {
                          icon = <GitMerge style={{ ...ic(11), color: C.purple, flexShrink: 0 }} />;
                          text = `${p.mergedBy || 'Someone'} merged PR #${p.prNumber}`;
                        } else if (ev.type === 'github.pr.closed') {
                          icon = <GitPullRequestClosed style={{ ...ic(11), color: C.red, flexShrink: 0 }} />;
                          text = `PR #${p.prNumber} cerrado`;
                        } else if (ev.type === 'github.pr.review-submitted') {
                          const state = (p.state as string)?.toLowerCase();
                          icon = <GitPullRequest style={{ ...ic(11), color: state === 'approved' ? C.green : C.amber, flexShrink: 0 }} />;
                          text = `${p.reviewer} ${state === 'approved' ? 'aprobó' : state === 'changes_requested' ? 'solicitó cambios en' : 'revisó'} PR #${p.prNumber}`;
                        } else if (ev.type === 'github.pr.review-requested') {
                          icon = <GitPullRequest style={{ ...ic(11), color: C.amber, flexShrink: 0 }} />;
                          text = `Revisión pedida a ${p.reviewer} en PR #${p.prNumber}`;
                        } else {
                          icon = <Github style={{ ...ic(11), color: C.purple, flexShrink: 0 }} />;
                          text = ev.type;
                        }

                        const createdAt: string | undefined = ev.createdAt || ev.timestamp;
                        return (
                          <div key={ev.id || i}
                            style={{ padding: '6px 7px', borderRadius: '6px', transition: 'background 0.1s' }}
                            onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                            onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '7px' }}>
                              <div style={{ flexShrink: 0, marginTop: '2px' }}>{icon}</div>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ margin: 0, fontSize: '11.5px', color: C.text2, lineHeight: 1.35, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {text}
                                </p>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                  {repoShort && <span style={{ fontSize: '10px', color: C.text4 }}>{repoShort}</span>}
                                  {createdAt && <span style={{ fontSize: '10px', color: C.text4 }}>{repoShort ? '·' : ''} {ago(createdAt)}</span>}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Actividad panel */}
              <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <div
                  role="button" tabIndex={0}
                  onClick={() => setSideActivity(!sideActivity)}
                  onKeyDown={(e) => e.key === 'Enter' && setSideActivity(!sideActivity)}
                  style={{ width: '100%', padding: '11px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', flexShrink: 0 }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                    <Activity style={{ ...ic(12), color: C.amber }} />
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text }}>{t.workspace_section_activity}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button onClick={(e) => { e.stopPropagation(); setActiveTab('activity'); }}
                      style={{ fontSize: '11px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, transition: 'color 0.1s' }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                    >
                      {t.ws_view_all_sidebar}
                    </button>
                    <ChevronDown style={{ ...ic(11), color: C.text4, transform: sideActivity ? 'rotate(0deg)' : 'rotate(-90deg)', transition: 'transform 0.15s' }} />
                  </div>
                </div>
                {sideActivity && (
                  <div style={{ flex: 1, overflowY: 'auto' }}>
                    <ActivityFeed workspaceId={workspaceId} refreshKey={activityRefreshKey} />
                  </div>
                )}
              </div>
            </aside>
          )}
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────────── */}
      <InviteMemberModal workspaceId={workspaceId} isOpen={showInviteModal} onClose={() => setShowInviteModal(false)} />
      <ConfirmRemoveMemberModal
        isOpen={!!memberToRemove}
        memberName={memberToRemove?.name || ''}
        onConfirm={handleConfirmRemove}
        onCancel={() => setMemberToRemove(null)}
        isRemoving={removingMember}
      />
      {showCreateProjectModal && (
        <CreateProjectModal
          onClose={() => setShowCreateProjectModal(false)}
          defaultWorkspaceId={workspaceId}
          onCreated={() => {
            setShowCreateProjectModal(false);
            fetchProjectsByWorkspace(workspaceId).then(setWsProjects);
          }}
        />
      )}

      {/* Delete board confirm */}
      {boardToDelete && (
        <>
          <div className="fixed inset-0 z-40" style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(4px)' }}
            onClick={!isDeletingBoard ? () => setBoardToDelete(null) : undefined}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="pointer-events-auto rounded-[10px] overflow-hidden w-full"
              style={{ maxWidth: '420px', background: '#13161b', border: `1px solid ${C.red}44`, boxShadow: '0 24px 64px rgba(0,0,0,0.7)' }}
              onClick={(e) => e.stopPropagation()}
            >
              <div style={{ padding: '20px 20px 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '14px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: `${C.red}18`, border: `1px solid ${C.red}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <Trash2 style={{ ...ic(16), color: C.red }} />
                  </div>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{t.workspace_section_boards}</p>
                    <p style={{ fontSize: '12px', color: C.text3 }}>{t.ws_settings_confirm_delete}</p>
                  </div>
                </div>
                <div style={{ padding: '11px 14px', marginBottom: '16px', background: C.surface, border: `1px solid ${C.border}`, borderRadius: '7px', fontSize: '13px', color: C.text2 }}>
                  {t.btn_delete} <span style={{ color: C.text, fontWeight: 600 }}>{boardToDelete.name}</span>?
                </div>
              </div>
              <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${C.border}`, display: 'flex', gap: '8px' }}>
                <button onClick={() => setBoardToDelete(null)} disabled={isDeletingBoard}
                  style={{ flex: 1, padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = C.text4)}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = C.border2)}
                >
                  {t.btn_cancel}
                </button>
                <button onClick={handleDeleteBoard} disabled={isDeletingBoard}
                  style={{ flex: 1, padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500, background: C.red, color: '#fff', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  {isDeletingBoard
                    ? <><svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13"><circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" /></svg> {t.btn_deleting}</>
                    : t.btn_delete
                  }
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
