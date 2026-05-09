// apps/web/src/app/dashboard/layout.tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { RealtimeNotificationProvider } from '@/components/realtime/RealtimeNotificationProvider';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { NotificationListener } from '@/components/notifications/NotificationListener';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';
import { useProjectStore } from '@/stores/projectStore';
import { useTeamStore } from '@/stores/teamStore';
import CommandPalette from '@/components/CommandPalette';
import { C } from '@/lib/colors';

// ── Color tokens exactos del diseño ────────────────────────────────────────────

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

const WS_VISIBLE = 3;

function WorkspacesSection({
  workspaces,
  router,
  wsColors,
  t,
}: {
  workspaces: any[];
  router: ReturnType<typeof useRouter>;
  wsColors: string[];
  t: any;
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? workspaces : workspaces.slice(0, WS_VISIBLE);
  const hidden = workspaces.length - WS_VISIBLE;

  return (
    <div className="mb-3">
      <div
        className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: C.text4 }}
      >
        <span>{t.nav_workspaces}</span>
        <button
          onClick={() => router.push('/dashboard/workspaces')}
          className="flex items-center justify-center rounded-[3px] transition-colors"
          style={{ width: '16px', height: '16px', color: C.text3 }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
        >
          +
        </button>
      </div>

      {workspaces.length === 0 ? (
        <div
          className="px-2 py-1.5 text-[12px] rounded-[5px] cursor-pointer transition-colors"
          style={{ color: C.text3 }}
          onClick={() => router.push('/dashboard/workspaces')}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text3; }}
        >
          {t.dashboard_btn_create_workspace}
        </div>
      ) : (
        <>
          {visible.map((ws, i) => (
            <Link key={ws.id} href={`/dashboard/workspaces/${ws.id}`}>
              <div
                className="flex items-center gap-2 px-2 py-[5px] rounded-[5px] cursor-pointer transition-colors text-[13px]"
                style={{ color: C.text2 }}
                onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; }}
                onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; }}
              >
                <span
                  className="flex-shrink-0 rounded-[3px]"
                  style={{ width: '10px', height: '10px', background: ws.color || wsColors[i % wsColors.length] }}
                />
                <span className="truncate flex-1">{ws.name}</span>
              </div>
            </Link>
          ))}

          {/* Expand / collapse toggle */}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-[5px] w-full rounded-[5px] transition-colors text-[12px]"
              style={{ color: C.text4 }}
              onMouseEnter={(e) => { (e.currentTarget.style.color = C.text2); }}
              onMouseLeave={(e) => { (e.currentTarget.style.color = C.text4); }}
            >
              <svg
                viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5"
                width="9" height="9"
                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
              >
                <path d="M2 3.5l3 3 3-3" />
              </svg>
              {expanded ? 'Ver menos' : `${hidden} más`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const PROJ_VISIBLE = 3;

function ProjectsSection({ router, pathname, t }: { router: ReturnType<typeof useRouter>; pathname: string | null; t: any }) {
  const { projects, fetchProjects } = useProjectStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetchProjects(); }, [fetchProjects]);

  const active = projects.filter((p) => p.status === 'ACTIVE' || p.status === 'PLANNING');
  const visible = expanded ? active : active.slice(0, PROJ_VISIBLE);
  const hidden = active.length - PROJ_VISIBLE;

  return (
    <div className="mb-3">
      <div
        className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: C.text4 }}
      >
        <span>{t.projects_title}</span>
        <button
          onClick={() => router.push('/dashboard/projects')}
          className="flex items-center justify-center rounded-[3px] transition-colors"
          style={{ width: '16px', height: '16px', color: C.text3 }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
        >
          +
        </button>
      </div>

      {active.length === 0 ? (
        <div
          className="px-2 py-1.5 text-[12px] rounded-[5px] cursor-pointer transition-colors"
          style={{ color: C.text3 }}
          onClick={() => router.push('/dashboard/projects')}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text3; }}
        >
          {t.projects_btn_create}
        </div>
      ) : (
        <>
          {visible.map((proj) => {
            const isActive = pathname?.startsWith(`/dashboard/projects/${proj.id}`);
            return (
              <Link key={proj.id} href={`/dashboard/projects/${proj.id}`}>
                <div
                  className="flex items-center gap-2 px-2 py-[5px] rounded-[5px] cursor-pointer transition-colors text-[13px]"
                  style={{ color: isActive ? C.text : C.text2, background: isActive ? C.hover : 'transparent' }}
                  onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; } }}
                >
                  <span
                    className="flex-shrink-0 rounded-[3px]"
                    style={{ width: '10px', height: '10px', background: proj.color ?? '#3b82f6' }}
                  />
                  <span className="truncate flex-1">{proj.name}</span>
                </div>
              </Link>
            );
          })}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-[5px] w-full rounded-[5px] transition-colors text-[12px]"
              style={{ color: C.text4 }}
              onMouseEnter={(e) => { (e.currentTarget.style.color = C.text2); }}
              onMouseLeave={(e) => { (e.currentTarget.style.color = C.text4); }}
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" width="9" height="9"
                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M2 3.5l3 3 3-3" />
              </svg>
              {expanded ? 'Ver menos' : `${hidden} más`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

const TEAM_VISIBLE = 3;

function TeamsSection({ router, pathname, t }: { router: ReturnType<typeof useRouter>; pathname: string | null; t: any }) {
  const { teams, fetchTeams } = useTeamStore();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetchTeams(); }, [fetchTeams]);

  const visible = expanded ? teams : teams.slice(0, TEAM_VISIBLE);
  const hidden = teams.length - TEAM_VISIBLE;

  return (
    <div className="mb-3">
      <div
        className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.08em]"
        style={{ color: C.text4 }}
      >
        <span>{t.teams_title}</span>
        <button
          onClick={() => router.push('/dashboard/teams')}
          className="flex items-center justify-center rounded-[3px] transition-colors"
          style={{ width: '16px', height: '16px', color: C.text3 }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
        >
          +
        </button>
      </div>

      {teams.length === 0 ? (
        <div
          className="px-2 py-1.5 text-[12px] rounded-[5px] cursor-pointer transition-colors"
          style={{ color: C.text3 }}
          onClick={() => router.push('/dashboard/teams')}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text3; }}
        >
          {t.teams_btn_create}
        </div>
      ) : (
        <>
          {visible.map((team) => {
            const isActive = pathname?.startsWith(`/dashboard/teams/${team.id}`);
            return (
              <Link key={team.id} href={`/dashboard/teams/${team.id}`}>
                <div
                  className="flex items-center gap-2 px-2 py-[5px] rounded-[5px] cursor-pointer transition-colors text-[13px]"
                  style={{ color: isActive ? C.text : C.text2, background: isActive ? C.hover : 'transparent' }}
                  onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; } }}
                  onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; } }}
                >
                  <span
                    className="flex-shrink-0 rounded-[3px]"
                    style={{ width: '10px', height: '10px', background: team.color ?? '#3b82f6' }}
                  />
                  <span className="truncate flex-1">{team.name}</span>
                </div>
              </Link>
            );
          })}
          {hidden > 0 && (
            <button
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5 px-2 py-[5px] w-full rounded-[5px] transition-colors text-[12px]"
              style={{ color: C.text4 }}
              onMouseEnter={(e) => { (e.currentTarget.style.color = C.text2); }}
              onMouseLeave={(e) => { (e.currentTarget.style.color = C.text4); }}
            >
              <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" width="9" height="9"
                style={{ transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                <path d="M2 3.5l3 3 3-3" />
              </svg>
              {expanded ? 'Ver menos' : `${hidden} más`}
            </button>
          )}
        </>
      )}
    </div>
  );
}

function SidebarContent({
  pathname,
  router,
  user,
  workspaces,
  userAvatarUrl,
  t,
  onLogout,
  onOpenSearch,
}: {
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
  user: any;
  workspaces: any[];
  userAvatarUrl: string | null;
  t: any;
  onLogout: () => void;
  onOpenSearch: () => void;
}) {
  const mainNav = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      active: pathname === '/dashboard',
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <path d="M2 8L8 2l6 6v6H2V8z" /><path d="M6 14v-4h4v4" />
        </svg>
      ),
    },
    {
      label: t.nav_workspaces,
      href: '/dashboard/workspaces',
      active: pathname?.startsWith('/dashboard/workspaces'),
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5 3v10M10 3v10" />
        </svg>
      ),
    },
    {
      label: t.ai_builder_nav_label,
      href: '/dashboard/ai-builder',
      active: pathname?.startsWith('/dashboard/ai-builder'),
      badge: t.ai_builder_beta_label,
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <path d="M8 1l1.5 3.5L13 6l-3.5 1.5L8 11l-1.5-3.5L3 6l3.5-1.5L8 1z" />
          <path d="M13 10l.8 1.8L15.5 12.5l-1.7.7L13 15l-.8-1.7L10.5 12.5l1.7-.7L13 10z" />
        </svg>
      ),
    },
    {
      label: 'Inbox',
      href: '/dashboard/users',
      active: pathname?.startsWith('/dashboard/users'),
      icon: (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
          <path d="M2 3h12v8a1 1 0 01-1 1H3a1 1 0 01-1-1V3z" /><path d="M2 9h3l1.5 2h3L11 9h3" />
        </svg>
      ),
    },
  ];

  const wsColors = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#ec4899', '#06b6d4', '#fb923c'];

  return (
    <>
      {/* Workspace switcher + search */}
      <div style={{ padding: '10px 10px 10px', borderBottom: `1px solid ${C.border}` }}>
        <Link href="/">
          <div
            className="flex items-center gap-2.5 px-2 py-2 rounded-md cursor-pointer transition-colors"
            style={{ color: C.text }}
            onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <svg width="20" height="20" viewBox="0 0 220 220" fill="none" aria-label="Aether logo" style={{ flexShrink: 0 }}>
              <path d="M 110 39 L 32 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
              <path d="M 110 39 L 188 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
              <path d="M 66 122 L 154 122" stroke="#3B82F6" strokeWidth="7" strokeLinecap="round" />
              <circle cx="110" cy="39" r="9" fill="#3B82F6" />
              <circle cx="32" cy="173" r="9" fill="#3B82F6" />
              <circle cx="188" cy="173" r="9" fill="#3B82F6" />
            </svg>
            <span className="text-[13px] font-semibold flex-1 truncate tracking-[0.06em]">Aether</span>
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12" style={{ color: C.text3, flexShrink: 0 }}>
              <path d="M3 5l3-3 3 3M3 7l3 3 3-3" />
            </svg>
          </div>
        </Link>

        {/* Search trigger */}
        <div
          className="flex items-center gap-2 px-2.5 rounded-md cursor-pointer transition-all mt-1.5"
          style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text3, height: '32px' }}
          onClick={onOpenSearch}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = C.hover;
            (e.currentTarget as HTMLElement).style.borderColor = C.border2;
            (e.currentTarget as HTMLElement).style.color = C.text2;
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = C.surface;
            (e.currentTarget as HTMLElement).style.borderColor = C.border;
            (e.currentTarget as HTMLElement).style.color = C.text3;
          }}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13" style={{ flexShrink: 0 }}>
            <circle cx="7" cy="7" r="4.5" /><path d="M10.5 10.5L14 14" />
          </svg>
          <span className="flex-1" />
          <span
            className="font-mono text-[10.5px] px-[5px] py-[1px] rounded-[3px] flex-shrink-0"
            style={{ background: C.bg, border: `1px solid ${C.border2}`, color: C.text3 }}
          >
            ⌘K
          </span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto" style={{ padding: '10px 8px' }}>
        {/* Main group */}
        <div className="mb-3">
          {mainNav.map((item) => (
            <Link key={item.href} href={item.href}>
              <div
                className="relative flex items-center gap-2 px-2 py-[5px] rounded-[5px] cursor-pointer transition-colors text-[13px]"
                style={{ color: item.active ? C.text : C.text2, background: item.active ? C.hover : 'transparent' }}
                onMouseEnter={(e) => { if (!item.active) (e.currentTarget as HTMLElement).style.background = C.hover; if (!item.active) (e.currentTarget as HTMLElement).style.color = C.text; }}
                onMouseLeave={(e) => { if (!item.active) (e.currentTarget as HTMLElement).style.background = 'transparent'; if (!item.active) (e.currentTarget as HTMLElement).style.color = C.text2; }}
              >
                {item.active && (
                  <div
                    className="absolute rounded-[2px]"
                    style={{ left: '-8px', top: '50%', transform: 'translateY(-50%)', width: '2px', height: '14px', background: C.accent }}
                  />
                )}
                <span style={{ color: item.active ? C.text : C.text3 }}>{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {(item as any).badge && (
                  <span
                    className="text-[9px] font-bold px-[5px] py-[1px] rounded-[3px] tracking-wider"
                    style={{ background: C.accent + '22', color: C.accent, border: `1px solid ${C.accent}44` }}
                  >
                    {(item as any).badge}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>

        {/* Workspaces group */}
        <WorkspacesSection workspaces={workspaces} router={router} wsColors={wsColors} t={t} />

        {/* Proyectos group */}
        <ProjectsSection router={router} pathname={pathname} t={t} />

        {/* Equipos group */}
        <TeamsSection router={router} pathname={pathname} t={t} />

        {/* Settings */}
        <div>
          <div className="flex items-center justify-between px-2 pb-1.5 font-mono text-[10px] uppercase tracking-[0.08em]" style={{ color: C.text4 }}>
            <span>{t.nav_settings}</span>
          </div>
          <Link href="/dashboard/settings">
            <div
              className="flex items-center gap-2 px-2 py-[5px] rounded-[5px] cursor-pointer transition-colors text-[13px]"
              style={{ color: C.text2 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; }}
            >
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14" style={{ color: C.text3 }}>
                <circle cx="8" cy="8" r="2" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5" />
              </svg>
              {t.nav_settings}
            </div>
          </Link>
        </div>
      </nav>

      {/* User */}
      <div
        className="flex items-center gap-2.5 flex-shrink-0"
        style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}` }}
      >
        <Link href="/dashboard/profile" className="flex items-center gap-2.5 flex-1 min-w-0 group">
          <Avatar className="w-[26px] h-[26px] flex-shrink-0">
            {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={user?.name || ''} crossOrigin="anonymous" />}
            <AvatarFallback
              className="text-[11px] font-semibold text-white"
              style={{ background: 'linear-gradient(135deg, #a855f7, #ec4899)' }}
            >
              {user && getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span className="text-[12.5px] font-medium truncate flex-1 min-w-0" style={{ color: C.text }}>{user?.name}</span>
        </Link>
        <button
          onClick={onLogout}
          className="flex items-center justify-center rounded-[5px] flex-shrink-0 transition-colors"
          style={{ width: '24px', height: '24px', color: C.text3 }}
          onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
          onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          title={t.nav_logout}
          data-testid="logout-button"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
            <path d="M10 3h3v10h-3M7 5l-3 3 3 3M4 8h7" />
          </svg>
        </button>
      </div>
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  const userAvatarUrl = getAvatarUrl(user?.avatar ?? null);

  // ⌘K / Ctrl+K global shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);
  const t = useT();

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Breadcrumb label
  const crumb = pathname?.startsWith('/dashboard/workspaces') ? t.nav_workspaces
    : pathname?.startsWith('/dashboard/settings') ? t.nav_settings
    : pathname?.startsWith('/dashboard/profile') ? t.nav_profile
    : pathname?.startsWith('/dashboard/users') ? t.nav_users
    : pathname?.startsWith('/dashboard/notifications') ? t.nav_notifications
    : t.nav_dashboard;

  const sidebarProps = { pathname, router, user, workspaces, userAvatarUrl, t, onLogout: handleLogout, onOpenSearch: () => setSearchOpen(true) };

  return (
    <ProtectedRoute>
      <SocketProvider>
        <div className="flex" style={{ height: '100vh', overflow: 'hidden', background: C.bg, color: C.text }}>

          {/* Mobile overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-20 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar — mobile: fixed overlay, desktop: flex item */}
          <aside
            className="fixed md:relative md:flex-shrink-0 flex flex-col z-30 transition-all duration-200"
            style={{
              width: isSidebarOpen ? '220px' : '0',
              minWidth: isSidebarOpen ? '220px' : '0',
              height: '100%',
              background: C.bg2,
              borderRight: `1px solid ${C.border}`,
              overflow: 'hidden',
            }}
          >
            <div style={{ width: '220px', display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <SidebarContent {...sidebarProps} />
            </div>
          </aside>

          {/* Main content */}
          <div
            className="flex flex-col min-w-0 flex-1 overflow-hidden transition-all duration-200"
            style={{ marginLeft: isSidebarOpen ? '0' : '0' }}
          >
            {/* Topbar */}
            <header
              className="flex items-center flex-shrink-0"
              style={{ height: '44px', background: C.bg2, borderBottom: `1px solid ${C.border}`, padding: '0 16px', gap: '14px' }}
            >
              {/* Toggle sidebar */}
              <button
                onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                className="flex items-center justify-center rounded-[5px] transition-colors"
                style={{ width: '28px', height: '28px', color: C.text3 }}
                onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
                aria-label="Toggle sidebar"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                  <rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M6 2v12" />
                </svg>
              </button>

              {/* Breadcrumbs */}
              <div className="flex items-center gap-1.5 text-[13px]">
                <span style={{ color: C.text3, cursor: 'pointer' }} onClick={() => router.push('/dashboard')}>Aether</span>
                <span style={{ color: C.text4 }}>/</span>
                <span className="font-medium" style={{ color: C.text }}>{crumb}</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 ml-auto">
                {/* Notifications */}
                <NotificationBell />

                {/* Help */}
                <button
                  className="flex items-center justify-center rounded-[5px] transition-colors"
                  style={{ width: '28px', height: '28px', color: C.text3 }}
                  onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
                  onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
                  title="Ayuda"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                    <circle cx="8" cy="8" r="6" /><path d="M6 6a2 2 0 014 0c0 2-2 2-2 3M8 11.5v.5" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Page content */}
            <main className="flex-1 overflow-auto" style={{ background: C.bg }}>
              {children}
            </main>
          </div>
        </div>

        <Toaster />
        <NotificationListener />
        <RealtimeNotificationProvider />
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
      </SocketProvider>
    </ProtectedRoute>
  );
}
