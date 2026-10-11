// apps/web/src/app/dashboard/layout.tsx
'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { RealtimeNotificationProvider } from '@/components/realtime/RealtimeNotificationProvider';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { NotificationListener } from '@/components/notifications/NotificationListener';
import { NotificationPopupHost } from '@/components/notifications/NotificationPopupHost';
import { useNotificationStore } from '@/stores/notificationStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';
import CommandPalette from '@/components/CommandPalette';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import CreateOrganizationModal from '@/components/CreateOrganizationModal';
import EditWorkspaceModal from '@/components/EditWorkspaceModal';
import WorkspaceContextSwitcher from '@/components/WorkspaceContextSwitcher';
import CreateBoardModal from '@/components/CreateBoardModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import FirstWorkspaceOnboarding from '@/components/FirstWorkspaceOnboarding';
import OrganizationEmptyState from '@/components/OrganizationEmptyState';
import { socketService } from '@/services/socketService';
import { apiService } from '@/services/apiService';
import ChatDock from '@/components/chat/ChatDock';
import { BellRing, FolderKanban, PanelLeftClose, PanelLeftOpen, Settings } from 'lucide-react';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";
const SIDEBAR_W = 256;
type OrganizationContext = { id: string; name: string; type: string; role?: string; workspaceCount?: number };

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Nav item ────────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon, active, badge, onClick, disabledReason }: {
  href?: string; label: string; icon: React.ReactNode;
  active?: boolean; badge?: number; onClick?: () => void; disabledReason?: string;
}) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 11px', borderRadius: '8px', cursor: disabledReason ? 'not-allowed' : 'pointer',
    background: active ? 'rgba(116,82,166,0.1)' : 'transparent',
    color: active ? '#7452A6' : 'var(--c-text2)',
    fontSize: '14px', fontFamily: MANROPE,
    textDecoration: 'none',
    opacity: disabledReason ? .48 : 1,
  };

  const inner = (
    <div role={disabledReason ? undefined : 'button'} className="dsh-nav-item" style={style} title={disabledReason ?? label} aria-label={label}
      onMouseEnter={e => { if (!active && !disabledReason) { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; } }}
      onMouseLeave={e => { if (!active && !disabledReason) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)'; } }}
    >
      <span className="dsh-nav-icon" style={{ display: 'flex', flexShrink: 0, color: active ? '#7452A6' : 'var(--c-text2)' }}>{icon}</span>
      <span className="dsh-nav-label" style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className="dsh-nav-badge" style={{
          marginLeft: 'auto', fontSize: '11px', fontWeight: 700,
          color: '#FFFFFF', background: '#7452A6',
          borderRadius: '8px', minWidth: '18px', height: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  if (disabledReason) return <div aria-disabled="true" title={disabledReason}>{inner}</div>;
  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  return <div onClick={onClick} style={{ display: 'block' }}>{inner}</div>;
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

function Sidebar({
  pathname, router, user, workspaces, userAvatarUrl,
  onLogout, activeWorkspaceId, onSelectWorkspace, onCreateWorkspace, onCreateOrganization,
  activeOrganizationId, activeOrganization, onSelectOrganization, workspaceUnavailable,
  onEditWorkspace, onRefreshWorkspaces, onCreateBoard, onCreateProject, sidebarProjects, projectsLoading,
  compact, onToggleCompact,
}: {
  pathname: string | null; router: ReturnType<typeof useRouter>;
  user: any; workspaces: any[]; userAvatarUrl: string | null;
  onLogout: () => void;
  activeWorkspaceId: string | null; onSelectWorkspace: (id: string) => void;
  activeOrganizationId: string | null; activeOrganization: OrganizationContext | null;
  onSelectOrganization: (id: string) => void; workspaceUnavailable: boolean;
  onCreateWorkspace: (organizationId?: string) => void; onCreateOrganization: () => void; onEditWorkspace: (ws: any) => void;
  onRefreshWorkspaces: () => Promise<void>;
  onCreateBoard: () => void; onCreateProject: () => void;
  sidebarProjects: any[]; projectsLoading: boolean;
  compact: boolean; onToggleCompact: () => void;
}) {
  const ic = (s: number) => ({ width: `${s}px`, height: `${s}px` } as const);
  const notifCount  = useNotificationStore(s => s.unreadCount);
  const [isPlatformAdmin, setIsPlatformAdmin] = useState(false);

  useEffect(() => {
    let active = true;
    void apiService.get<{ platformAdmin: boolean }>('/api/admin/access', true).then((response) => {
      if (active) setIsPlatformAdmin(response.success && response.data?.platformAdmin === true);
    });
    return () => { active = false; };
  }, [user?.id]);

  const mainNav = [
    {
      label: 'Inicio', href: '/dashboard', active: pathname === '/dashboard',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...ic(17)}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>,
    },
    {
      label: 'Calendario', href: '/dashboard/calendar', active: !!pathname?.startsWith('/dashboard/calendar'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...ic(17)}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M8 3.5v3M16 3.5v3" strokeLinecap="round"/></svg>,
    },
    {
      label: 'Notificaciones', href: '/dashboard/notifications', active: !!pathname?.startsWith('/dashboard/notifications'),
      icon: <BellRing size={17} strokeWidth={1.7} aria-hidden="true" />,
      badge: notifCount,
    },
    {
      label: 'Documentos',
      href: '/dashboard/documents',
      disabledReason: workspaceUnavailable ? 'Necesitas acceso a un espacio de trabajo' : undefined,
      active: !!pathname?.startsWith('/dashboard/documents'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...ic(17)}><path d="M6 3h8l4 4v14H6V3Z"/><path d="M13 3v5h5M9 13h6M9 16.5h6" strokeLinecap="round"/></svg>,
    },
    {
      label: 'Contactos',
      href: '/dashboard/contacts',
      active: !!pathname?.startsWith('/dashboard/contacts'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...ic(17)}><path d="M5 4h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5V4Z"/><path d="M5 4v16"/><circle cx="12.5" cy="10.5" r="2"/><path d="M9.5 16a3 3 0 0 1 6 0" strokeLinecap="round"/></svg>,
    },
  ];

  const activeProjects = sidebarProjects.filter(p => p.status !== 'ARCHIVED' && p.status !== 'COMPLETED').slice(0, 6);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId && workspace.organizationId === activeOrganizationId);
  const isInstitutionalWorkspace = activeWorkspace?.organization?.type === 'INSTITUTION';
  // This is only a navigation affordance. Portfolio endpoints still enforce
  // organization capability and portfolio membership on every request.
  const hasPortfolioCapability = activeWorkspace?.capabilities?.portfolio === true;

  return (
    <aside className="dshScroll dsh-sidebar" style={{
      width: '100%', flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
      background: 'var(--c-bg2)',
      borderRight: '1px solid rgba(97,71,130,0.06)',
      display: 'flex', flexDirection: 'column',
      padding: '16px 14px', overflowY: 'auto', zIndex: 30,
    }}>

      {/* Logo */}
      <div className="dsh-sidebar-logo" style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 16px' }}>
        <Link href="/" title="Aether" aria-label="Aether" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <BrandMark size={38} tone="adaptive" />
        </Link>
        <button type="button" className="dsh-sidebar-toggle" onClick={onToggleCompact}
          aria-label={compact ? 'Expandir barra lateral' : 'Minimizar barra lateral'}
          aria-expanded={!compact} title={compact ? 'Expandir barra lateral' : 'Minimizar barra lateral'}>
          {compact ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
        </button>
      </div>

      {/* Workspace switcher */}
      <div className="dsh-workspace-slot">
      <WorkspaceContextSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        activeOrganizationId={activeOrganizationId}
        activeOrganization={activeOrganization}
        onSelect={onSelectWorkspace}
        onSelectOrganization={onSelectOrganization}
        onCreateNew={onCreateWorkspace}
        onNewOrganization={onCreateOrganization}
        onEdit={onEditWorkspace}
        onRefresh={onRefreshWorkspaces}
      />
      </div>

      {/* Main nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
        {mainNav.map(item => (
          <NavItem
            key={item.href ?? item.label}
            href={item.href}
            label={item.label}
            icon={item.icon}
            active={item.active}
            badge={(item as any).badge}
            disabledReason={'disabledReason' in item ? item.disabledReason : undefined}
          />
          ))}
      </nav>

      {/* Proyectos section */}
      {workspaceUnavailable ? <div className="dsh-projects-expanded" style={{ margin: '21px 11px 11px', color: 'var(--c-text4)', font: `600 11px ${SORA}`, letterSpacing: '.1em' }} title="Necesitas acceso a un espacio de trabajo">PROYECTOS · SIN ESPACIO</div> : <div className="dsh-projects-expanded">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 11px 8px' }}>
        <Link
          href="/dashboard/projects"
          style={{
            fontFamily: SORA, fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: pathname?.startsWith('/dashboard/projects') ? 'var(--c-text2)' : 'var(--c-text4)',
            textDecoration: 'none', transition: 'color 0.14s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = 'var(--c-text2)')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = pathname?.startsWith('/dashboard/projects') ? 'var(--c-text2)' : 'var(--c-text4)')}
        >
          Proyectos
        </Link>
        <button onClick={onCreateProject} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="var(--c-text3)" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {projectsLoading ? null : activeProjects.length === 0 ? (
          <div
            onClick={onCreateProject}
            style={{ padding: '8px 11px', fontSize: '13px', color: 'var(--c-text4)', cursor: 'pointer', borderRadius: '8px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text4)'; }}
          >
            + Nuevo proyecto
          </div>
        ) : activeProjects.map(p => {
          const pPath = `/dashboard/projects/${p.id}`;
          const isAct = pathname?.startsWith(pPath) ?? false;
          return (
            <div
              key={p.id}
              onClick={() => router.push(pPath)}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 11px', borderRadius: '8px',
                color: isAct ? 'var(--c-text)' : 'var(--c-text2)',
                background: isAct ? 'rgba(97,71,130,0.05)' : 'transparent',
                fontSize: '13px', cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isAct) { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text)'; } }}
              onMouseLeave={e => { if (!isAct) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--c-text2)'; } }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color ?? '#8262B2', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          );
        })}
      </nav>
      </div>}
      {!workspaceUnavailable && <nav className="dsh-projects-compact" aria-label="Proyectos">
        <Link href="/dashboard/projects" className={`dsh-compact-icon${pathname?.startsWith('/dashboard/projects') ? ' is-active' : ''}`}
          title="Proyectos" aria-label="Proyectos">
          <FolderKanban size={18} />
        </Link>
        {!projectsLoading && activeProjects.map((project) => (
          <Link key={project.id} href={`/dashboard/projects/${project.id}`}
            className={`dsh-compact-icon dsh-compact-project${pathname?.startsWith(`/dashboard/projects/${project.id}`) ? ' is-active' : ''}`}
            title={project.name} aria-label={`Proyecto: ${project.name}`}>
            <FolderKanban size={17} style={{ color: project.color ?? 'var(--c-accent-text)' }} />
          </Link>
        ))}
      </nav>}

      {/* Equipo */}
      <div style={{ marginTop: '8px' }}>
        <NavItem
          href="/dashboard/teams"
          label="Equipo"
          disabledReason={workspaceUnavailable ? 'Necesitas acceso a un espacio de trabajo' : undefined}
          active={!!pathname?.startsWith('/dashboard/teams')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round"/><path d="M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round"/></svg>}
        />
      </div>

      <div style={{ marginTop: '3px' }}>
        <NavItem
          href={activeOrganizationId ? `/dashboard/organizations?organizationId=${encodeURIComponent(activeOrganizationId)}` : '/dashboard/organizations'}
          label="Organización"
          active={!!pathname?.startsWith('/dashboard/organizations')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><path d="M4 21V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v15M2 21h20M8 8h2m4 0h2M8 12h2m4 0h2M10 21v-4h4v4" strokeLinecap="round" strokeLinejoin="round"/><path d="M9 4V2h6v2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>

      {hasPortfolioCapability && <div style={{ marginTop: '3px' }}>
        <NavItem
          href="/dashboard/portfolios"
          label="Carteras"
          active={!!pathname?.startsWith('/dashboard/portfolios')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><rect x="4" y="5" width="16" height="15" rx="2.5"/><path d="M9 5V3.5h6V5M4 10h16M9 14h6" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        />
      </div>}

      {isInstitutionalWorkspace && <div style={{ marginTop: '3px' }}>
        <NavItem
          href="/dashboard/initiatives"
          label="Iniciativas"
          active={!!pathname?.startsWith('/dashboard/initiatives')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><path d="M7 3.5h10A2.5 2.5 0 0 1 19.5 6v12A2.5 2.5 0 0 1 17 20.5H7A2.5 2.5 0 0 1 4.5 18V6A2.5 2.5 0 0 1 7 3.5Z"/><path d="M8 8h8M8 12h8M8 16h4" strokeLinecap="round"/></svg>}
        />
      </div>}

      {isPlatformAdmin && <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid var(--c-border)' }}>
        <NavItem
          href="/dashboard/admin"
          label="Administración"
          active={!!pathname?.startsWith('/dashboard/admin')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 16v-4m5 4V8m5 8v-6" strokeLinecap="round"/></svg>}
        />
      </div>}

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User footer */}
      <div
        className="dsh-user-footer-expanded"
        onClick={() => router.push('/dashboard/profile')}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px', borderRadius: '8px',
          border: '1px solid rgba(97,71,130,0.06)',
          marginTop: '14px', cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.14)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(97,71,130,0.06)'; }}
      >
        <Avatar style={{ width: '30px', height: '30px', flexShrink: 0 }}>
          {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={user?.name ?? ''} crossOrigin="anonymous" />}
          <AvatarFallback style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', background: '#7452A6', width: '30px', height: '30px' }}>
            {user ? getInitials(user.name) : '?'}
          </AvatarFallback>
        </Avatar>
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: 'var(--c-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Usuario'}
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: 'var(--c-text3)' }}>Plan gratis</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          <button
            onClick={e => { e.stopPropagation(); router.push('/dashboard/settings'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '6px' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.08)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="var(--c-text3)" strokeWidth="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="var(--c-text3)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
      </div>
      <div className="dsh-user-footer-compact">
        <Link href="/dashboard/profile" className="dsh-compact-icon" title="Mi perfil" aria-label="Mi perfil">
          <Avatar style={{ width: '30px', height: '30px', flexShrink: 0 }}>
            {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt="" crossOrigin="anonymous" />}
            <AvatarFallback style={{ fontSize: '12px', fontWeight: 700, color: '#FFFFFF', background: '#7452A6' }}>
              {user ? getInitials(user.name) : '?'}
            </AvatarFallback>
          </Avatar>
        </Link>
        <Link href="/dashboard/settings" className="dsh-compact-icon" title="Ajustes" aria-label="Ajustes">
          <Settings size={18} />
        </Link>
      </div>
    </aside>
  );
}

// ── Mobile topbar ────────────────────────────────────────────────────────────────

function MobileTopbar({ onMenuClick }: { onMenuClick: () => void }) {
  return (
    <div
      className="dsh-topbar"
      style={{
        position: 'sticky', top: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '0 14px', height: '52px',
        background: 'var(--c-bg2)',
        borderBottom: '1px solid rgba(97,71,130,0.06)',
        flexShrink: 0,
      }}
    >
      {/* Hamburger */}
      <button
        onClick={onMenuClick}
        aria-label="Abrir menú"
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '8px', borderRadius: '8px',
          display: 'flex', flexDirection: 'column', gap: '4px',
          flexShrink: 0,
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.06)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
      >
        <span style={{ display: 'block', width: '18px', height: '1.5px', background: 'var(--c-text2)', borderRadius: '2px' }} />
        <span style={{ display: 'block', width: '18px', height: '1.5px', background: 'var(--c-text2)', borderRadius: '2px' }} />
        <span style={{ display: 'block', width: '13px', height: '1.5px', background: 'var(--c-text2)', borderRadius: '2px' }} />
      </button>

      {/* Logo */}
      <Link href="/dashboard" aria-label="AETHER, inicio" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flex: 1 }}>
        <BrandMark size={34} tone="adaptive" />
      </Link>
    </div>
  );
}

// ── Dashboard Layout ─────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces, error: workspaceError } = useWorkspaceStore();
  const { loadPreferences } = usePreferencesStore();
  const {
    activeWorkspaceId, setActiveWorkspaceId,
    fetchSidebarBoards, fetchSidebarProjects,
    sidebarBoards, sidebarProjects,
    boardsLoading, projectsLoading,
    addSidebarProject,
  } = useActiveWorkspaceStore();

  const [searchOpen, setSearchOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [createOrganizationOpen, setCreateOrganizationOpen] = useState(false);
  const [pendingWorkspaceOrganizationId, setPendingWorkspaceOrganizationId] = useState<string | undefined>();
  const [editingWorkspace, setEditingWorkspace] = useState<any | null>(null);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCompact, setSidebarCompact] = useState(false);
  const [workspaceBootstrapLoaded, setWorkspaceBootstrapLoaded] = useState(false);
  const [organizations, setOrganizations] = useState<OrganizationContext[]>([]);
  const [organizationsLoaded, setOrganizationsLoaded] = useState(false);
  const [organizationsError, setOrganizationsError] = useState('');
  const [activeOrganizationId, setActiveOrganizationId] = useState<string | null>(null);

  const userAvatarUrl = getAvatarUrl(user?.avatar ?? null);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    try { setSidebarCompact(window.localStorage.getItem('aether:sidebar-compact') === 'true'); } catch { /* Storage can be unavailable. */ }
  }, []);

  const toggleSidebarCompact = () => {
    const next = !sidebarCompact;
    setSidebarCompact(next);
    try { window.localStorage.setItem('aether:sidebar-compact', String(next)); } catch { /* Keep the in-memory preference. */ }
  };

  // Cierra el drawer al navegar
  useEffect(() => { setSidebarOpen(false); }, [pathname]);

  // Bloquea el scroll del body mientras el drawer está abierto
  useEffect(() => {
    if (sidebarOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  useEffect(() => {
    let active = true;
    void fetchWorkspaces().finally(() => {
      if (active) setWorkspaceBootstrapLoaded(true);
    });
    return () => { active = false; };
  }, [fetchWorkspaces]);

  const refreshOrganizations = useCallback(async () => {
    try {
      const response = await apiService.get<{ organizations: OrganizationContext[] }>('/api/organizations', true);
      if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar las organizaciones.');
      setOrganizations(response.data.organizations ?? []);
      setOrganizationsError('');
    } catch (error) {
      setOrganizationsError(error instanceof Error ? error.message : 'No se pudieron cargar las organizaciones.');
    } finally {
      setOrganizationsLoaded(true);
    }
  }, []);

  useEffect(() => { void refreshOrganizations(); }, [refreshOrganizations, user?.id]);
  useEffect(() => {
    const refresh = () => { void refreshOrganizations(); void fetchWorkspaces(); };
    window.addEventListener('aether:organizations-changed', refresh);
    return () => window.removeEventListener('aether:organizations-changed', refresh);
  }, [refreshOrganizations, fetchWorkspaces]);

  useEffect(() => {
    if (!organizationsLoaded || organizations.length === 0) return;
    if (activeOrganizationId && organizations.some((organization) => organization.id === activeOrganizationId)) return;
    let storedId: string | null = null;
    try { storedId = window.localStorage.getItem(`aether:active-org:${user?.id ?? ''}`); } catch { /* Storage can be unavailable. */ }
    const preferred = organizations.find((organization) => organization.id === storedId)
      ?? organizations.find((organization) => workspaces.some((workspace) => workspace.id === activeWorkspaceId && workspace.organizationId === organization.id))
      ?? organizations.find((organization) => organization.type !== 'PERSONAL')
      ?? organizations[0];
    setActiveOrganizationId(preferred.id);
  }, [organizationsLoaded, organizations, activeOrganizationId, activeWorkspaceId, workspaces, user?.id]);

  useEffect(() => {
    if (!activeOrganizationId || !workspaceBootstrapLoaded) return;
    try { window.localStorage.setItem(`aether:active-org:${user?.id ?? ''}`, activeOrganizationId); } catch { /* Storage can be unavailable. */ }
    const selectedWorkspace = workspaces.find((workspace) => !workspace.archived && workspace.id === activeWorkspaceId);
    if (selectedWorkspace && selectedWorkspace.organizationId !== activeOrganizationId) {
      setActiveOrganizationId(selectedWorkspace.organizationId);
      return;
    }
    const matching = workspaces.filter((workspace) => !workspace.archived && workspace.organizationId === activeOrganizationId);
    if (!matching.some((workspace) => workspace.id === activeWorkspaceId)) setActiveWorkspaceId(matching[0]?.id ?? null);
  }, [activeOrganizationId, activeWorkspaceId, setActiveWorkspaceId, workspaceBootstrapLoaded, workspaces, user?.id]);

  const activeOrganization = organizations.find((organization) => organization.id === activeOrganizationId) ?? null;
  const activeWorkspace = workspaces.find((workspace) => !workspace.archived && workspace.id === activeWorkspaceId && workspace.organizationId === activeOrganizationId);
  const workspaceUnavailable = workspaceBootstrapLoaded && !!activeOrganization && !activeWorkspace;
  const resolvingFirstContext = workspaceBootstrapLoaded && !workspaces.some((workspace) => !workspace.archived)
    && (!organizationsLoaded || (organizations.length > 0 && !activeOrganizationId));
  const needsFirstWorkspace = workspaceBootstrapLoaded && organizationsLoaded && !workspaceError && !organizationsError
    && !workspaces.some((workspace) => !workspace.archived) && organizations.length === 0;

  useEffect(() => {
    if (!activeOrganizationId && workspaces.length > 0 && !activeWorkspaceId && !organizationsLoaded) setActiveWorkspaceId(workspaces[0].id);
  }, [workspaces, activeWorkspaceId, activeOrganizationId, organizationsLoaded, setActiveWorkspaceId]);

  useEffect(() => {
    const match = pathname?.match(/\/dashboard\/workspaces\/([^\/\?]+)/);
    if (match && match[1] !== activeWorkspaceId) setActiveWorkspaceId(match[1]);
  }, [pathname, activeWorkspaceId, setActiveWorkspaceId]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetchSidebarBoards(activeWorkspaceId);
    fetchSidebarProjects(activeWorkspaceId);
  }, [activeWorkspaceId, fetchSidebarBoards, fetchSidebarProjects]);

  useEffect(() => {
    if (!activeWorkspaceId) return;
    const handler = (event: any) => {
      const { type, payload } = event ?? {};
      if (!payload?.workspaceId || payload.workspaceId !== activeWorkspaceId) return;
      if (type === 'board.created' || type === 'board.archived' || type === 'board.deleted') fetchSidebarBoards(activeWorkspaceId);
      if (type === 'project.created' || type === 'project.deleted' || type === 'project.updated') fetchSidebarProjects(activeWorkspaceId);
    };
    socketService.on('event', handler);
    return () => socketService.off('event', handler);
  }, [activeWorkspaceId, fetchSidebarBoards, fetchSidebarProjects]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setSearchOpen(v => !v); }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  const handleSelectWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    const workspace = workspaces.find((item) => item.id === id);
    if (workspace) setActiveOrganizationId(workspace.organizationId);
    router.push('/dashboard');
  }, [setActiveWorkspaceId, router, workspaces]);

  const handleSelectOrganization = useCallback((id: string) => {
    setActiveOrganizationId(id);
    const workspace = workspaces.find((item) => !item.archived && item.organizationId === id);
    setActiveWorkspaceId(workspace?.id ?? null);
    router.push('/dashboard');
  }, [setActiveWorkspaceId, router, workspaces]);

  useEffect(() => {
    const select = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (!id) return;
      setActiveOrganizationId(id);
      const workspace = workspaces.find((item) => !item.archived && item.organizationId === id);
      setActiveWorkspaceId(workspace?.id ?? null);
    };
    window.addEventListener('aether:select-organization', select);
    return () => window.removeEventListener('aether:select-organization', select);
  }, [setActiveWorkspaceId, workspaces]);

  const handleLogout = async () => { await logout(); router.push('/login'); };

  const handleWorkspaceDeleted = useCallback((deletedId: string) => {
    setEditingWorkspace(null);
    const remaining = workspaces.filter(w => w.id !== deletedId && !w.archived && w.organizationId === activeOrganizationId);
    setActiveWorkspaceId(remaining[0]?.id ?? null);
    router.push('/dashboard');
    void fetchWorkspaces();
    void refreshOrganizations();
  }, [workspaces, activeOrganizationId, setActiveWorkspaceId, router, fetchWorkspaces, refreshOrganizations]);

  const sidebarProps = {
    pathname, router, user, workspaces, userAvatarUrl,
    onLogout: handleLogout,
    activeWorkspaceId,
    activeOrganizationId,
    activeOrganization,
    workspaceUnavailable,
    onSelectWorkspace: handleSelectWorkspace,
    onSelectOrganization: handleSelectOrganization,
    onCreateWorkspace: (organizationId?: string) => {
      setPendingWorkspaceOrganizationId(organizationId);
      setCreateWsOpen(true);
    },
    onCreateOrganization: () => setCreateOrganizationOpen(true),
    onEditWorkspace: (ws: any) => setEditingWorkspace(ws),
    onRefreshWorkspaces: async () => { await Promise.all([fetchWorkspaces(), refreshOrganizations()]); },
    onCreateBoard: () => setCreateBoardOpen(true),
    onCreateProject: () => setCreateProjectOpen(true),
    sidebarBoards, sidebarProjects, boardsLoading, projectsLoading,
    compact: sidebarCompact,
    onToggleCompact: toggleSidebarCompact,
  };

  return (
    <ProtectedRoute>
      <SocketProvider>
        {resolvingFirstContext ? (
          <main role="status" style={{ display: 'grid', placeItems: 'center', minHeight: '100dvh', background: 'var(--c-bg)', color: 'var(--c-text3)', fontFamily: MANROPE }}>
            Cargando tu organización…
          </main>
        ) : needsFirstWorkspace ? (
          <FirstWorkspaceOnboarding onWorkspaceCreated={(workspaceId) => {
            setActiveWorkspaceId(workspaceId);
            router.replace('/dashboard');
          }} />
        ) : (
        <>
        <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text)', fontFamily: MANROPE }}>

          {/* Backdrop — visible solo en móvil cuando el drawer está abierto */}
          <div
            className={`dsh-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar — drawer en móvil, columna fija en desktop */}
          <div className={`dsh-sidebar-wrap${sidebarOpen ? ' is-open' : ''}${sidebarCompact ? ' is-compact' : ''}`}
            style={{ '--dsh-sidebar-expanded-width': `${SIDEBAR_W}px` } as React.CSSProperties}>
            <Sidebar {...sidebarProps} />
          </div>

          {/* Main */}
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: 'var(--c-bg)', overflow: 'auto' }}>

            {/* Topbar móvil — oculto en desktop por CSS */}
            <MobileTopbar onMenuClick={() => setSidebarOpen(v => !v)} />

            {workspaceUnavailable && (pathname === '/dashboard' || /^\/dashboard\/(?:projects|documents|teams|boards|workspaces|portfolios|initiatives)(?:\/|$)/.test(pathname ?? ''))
              ? <OrganizationEmptyState
                  organization={activeOrganization}
                  onCreateWorkspace={() => { setPendingWorkspaceOrganizationId(activeOrganization.id); setCreateWsOpen(true); }}
                  onRefresh={() => { void Promise.all([fetchWorkspaces(), refreshOrganizations()]); }}
                />
              : organizationsLoaded && organizationsError && !workspaces.some((workspace) => !workspace.archived) && pathname === '/dashboard'
                ? <div style={{ margin: 'auto', padding: 32, textAlign: 'center' }} role="alert">No pudimos cargar tus organizaciones. <button type="button" onClick={() => void refreshOrganizations()}>Reintentar</button></div>
                : children}
          </main>
        </div>

        <Toaster />
        <NotificationPopupHost sidebarCompact={sidebarCompact} />
        {!pathname?.startsWith('/dashboard/contacts') && <ChatDock userId={user?.id} />}
        <NotificationListener />
        <RealtimeNotificationProvider />
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />

        <CreateWorkspaceModal
          isOpen={createWsOpen}
          initialOrganizationId={pendingWorkspaceOrganizationId}
          onClose={() => {
            setCreateWsOpen(false);
            setPendingWorkspaceOrganizationId(undefined);
          }}
          onCreated={(workspace) => {
            setActiveOrganizationId(workspace.organizationId);
            setActiveWorkspaceId(workspace.id);
            void refreshOrganizations();
            router.push('/dashboard');
          }}
        />

        <CreateOrganizationModal
          isOpen={createOrganizationOpen}
          onClose={() => setCreateOrganizationOpen(false)}
          onCreated={(organization) => {
            setCreateOrganizationOpen(false);
            setOrganizations((current) => current.some((item) => item.id === organization.id) ? current : [...current, organization]);
            setActiveOrganizationId(organization.id);
            setActiveWorkspaceId(null);
            void refreshOrganizations();
            router.push('/dashboard');
          }}
        />

        {editingWorkspace && (
          <EditWorkspaceModal
            workspace={editingWorkspace}
            onClose={() => setEditingWorkspace(null)}
            onDeleted={handleWorkspaceDeleted}
          />
        )}

        {activeWorkspaceId && (
          <CreateBoardModal
            workspaceId={activeWorkspaceId}
            isOpen={createBoardOpen}
            onClose={() => setCreateBoardOpen(false)}
            onSuccess={(boardId) => {
              setCreateBoardOpen(false);
              fetchSidebarBoards(activeWorkspaceId);
              router.push(`/dashboard/boards/${boardId}`);
            }}
          />
        )}

        {createProjectOpen && (
          <CreateProjectModal
            onClose={() => setCreateProjectOpen(false)}
            defaultWorkspaceId={activeWorkspaceId ?? undefined}
            onCreated={(project) => {
              addSidebarProject({
                id: project.id,
                name: project.name,
                color: project.color ?? null,
                status: project.status ?? 'ACTIVE',
                workspaceId: project.workspaceId,
              });
              setCreateProjectOpen(false);
              fetchSidebarProjects(project.workspaceId);
              router.push(`/dashboard/projects/${project.id}`);
            }}
          />
        )}
        </>
        )}
      </SocketProvider>
    </ProtectedRoute>
  );
}
