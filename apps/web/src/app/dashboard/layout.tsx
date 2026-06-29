// apps/web/src/app/dashboard/layout.tsx
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import ProtectedRoute from '@/components/ProtectedRoute';
import { Toaster } from '@/components/ui/toaster';
import { RealtimeNotificationProvider } from '@/components/realtime/RealtimeNotificationProvider';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { NotificationListener } from '@/components/notifications/NotificationListener';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useNotificationStore } from '@/stores/notificationStore';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';
import CommandPalette from '@/components/CommandPalette';
import OnboardingCompanion from '@/components/OnboardingCompanion';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import EditWorkspaceModal from '@/components/EditWorkspaceModal';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import CreateBoardModal from '@/components/CreateBoardModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import { socketService } from '@/services/socketService';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";
const SIDEBAR_W = 256;

function getInitials(name: string) {
  return name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);
}

// ── Workspace switcher ──────────────────────────────────────────────────────────

function WorkspaceSwitcher({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateNew,
  onEdit,
}: {
  workspaces: any[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
  onEdit: (ws: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const color = active?.color ?? '#DB8A66';

  return (
    <div ref={ref} style={{ position: 'relative', marginBottom: '14px' }}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          width: '100%', padding: '9px 10px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.08)',
          background: open ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.03)',
          cursor: 'pointer', textAlign: 'left',
        }}
        onMouseEnter={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; }}
        onMouseLeave={e => { if (!open) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'; }}
      >
        <span style={{
          width: '26px', height: '26px', borderRadius: '7px', flexShrink: 0,
          background: `linear-gradient(135deg, ${color}cc, ${color}77)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WorkspaceIcon icon={active?.icon ?? 'briefcase'} style={{ width: '13px', height: '13px', color: '#fff' } as any} />
        </span>
        <span style={{ fontFamily: SORA, fontSize: '13.5px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0, textAlign: 'left' }}>
          {active?.name ?? 'Tu espacio'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
          <path d="M8 9l4 4 4-4M8 15l4-4 4 4" stroke="#827A6D" strokeWidth="1.6" strokeLinecap="round"/>
        </svg>
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 200,
          background: '#1E2438', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)', overflow: 'hidden',
        }}>
          <div style={{ padding: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {workspaces.filter(w => !w.archived).map(ws => {
              const isAct = ws.id === activeWorkspaceId;
              const isHov = ws.id === hoveredId;
              return (
                <div
                  key={ws.id}
                  style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: '7px', background: isAct ? 'rgba(255,255,255,0.06)' : isHov ? 'rgba(255,255,255,0.04)' : 'transparent' }}
                  onMouseEnter={() => setHoveredId(ws.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  <button
                    onClick={() => { onSelect(ws.id); setOpen(false); }}
                    style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '9px', padding: '8px 10px', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: MANROPE, minWidth: 0, textAlign: 'left' }}
                  >
                    <span style={{ width: '22px', height: '22px', borderRadius: '6px', flexShrink: 0, background: `linear-gradient(135deg, ${ws.color ?? '#F2571E'}cc, ${ws.color ?? '#F2571E'}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <WorkspaceIcon icon={ws.icon ?? 'briefcase'} style={{ width: '11px', height: '11px', color: '#fff' } as any} />
                    </span>
                    <span style={{ flex: 1, fontSize: '13px', fontWeight: isAct ? 600 : 400, color: isAct ? '#E8E1D2' : '#9C9486', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
                      {ws.name}
                    </span>
                    {isAct && (
                      <svg viewBox="0 0 12 12" fill="none" stroke="#F2571E" strokeWidth="2" width="11" height="11" style={{ flexShrink: 0 }}>
                        <path d="M2 6l3 3 5-5" />
                      </svg>
                    )}
                  </button>
                  {/* Edit button — visible on hover */}
                  <button
                    onClick={(e) => { e.stopPropagation(); setOpen(false); onEdit(ws); }}
                    title="Editar espacio"
                    style={{
                      flexShrink: 0, marginRight: '6px', width: '24px', height: '24px', borderRadius: '5px',
                      background: 'transparent', border: 'none', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#827A6D', opacity: isHov ? 1 : 0, transition: 'opacity 0.12s, background 0.12s',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = '#E8E1D2'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = '#827A6D'; }}
                  >
                    <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                      <path d="M10 2.5a1.41 1.41 0 0 1 2 2L5 12l-3 1 1-3Z" />
                    </svg>
                  </button>
                </div>
              );
            })}
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '6px' }}>
            <button onClick={() => { setOpen(false); onCreateNew(); }}
              style={{ width: '100%', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '12.5px', color: '#827A6D', fontFamily: MANROPE }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#827A6D'; }}
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" width="12" height="12"><path d="M6 1v10M1 6h10" /></svg>
              Nuevo espacio
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nav item ────────────────────────────────────────────────────────────────────

function NavItem({ href, label, icon, active, badge, onClick }: {
  href?: string; label: string; icon: React.ReactNode;
  active?: boolean; badge?: number; onClick?: () => void;
}) {
  const style: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '10px',
    padding: '9px 11px', borderRadius: '8px', cursor: 'pointer',
    background: active ? 'rgba(242,87,30,0.1)' : 'transparent',
    color: active ? '#F2571E' : '#9C9486',
    fontSize: '14px', fontFamily: MANROPE,
    textDecoration: 'none',
  };

  const inner = (
    <div role="button" style={style}
      onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; } }}
      onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; } }}
    >
      <span style={{ display: 'flex', flexShrink: 0, color: active ? '#F2571E' : '#9C9486' }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          marginLeft: 'auto', fontSize: '11px', fontWeight: 700,
          color: '#24180A', background: '#F2571E',
          borderRadius: '8px', minWidth: '18px', height: '18px',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 5px',
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  if (href) return <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>{inner}</Link>;
  return <div onClick={onClick} style={{ display: 'block' }}>{inner}</div>;
}

// ── Sidebar ─────────────────────────────────────────────────────────────────────

function Sidebar({
  pathname, router, user, workspaces, userAvatarUrl,
  onLogout, onOpenSearch, activeWorkspaceId, onSelectWorkspace, onCreateWorkspace,
  onEditWorkspace, onCreateBoard, onCreateProject, sidebarProjects, projectsLoading,
}: {
  pathname: string | null; router: ReturnType<typeof useRouter>;
  user: any; workspaces: any[]; userAvatarUrl: string | null;
  onLogout: () => void; onOpenSearch: () => void;
  activeWorkspaceId: string | null; onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void; onEditWorkspace: (ws: any) => void;
  onCreateBoard: () => void; onCreateProject: () => void;
  sidebarProjects: any[]; projectsLoading: boolean;
}) {
  const ic = (s: number) => ({ width: `${s}px`, height: `${s}px` } as const);
  const notifCount  = useNotificationStore(s => s.unreadCount);
  const showBell    = usePreferencesStore(s => s.preferences?.inAppNotifications ?? true);

  const mainNav = [
    {
      label: 'Inicio', href: '/dashboard', active: pathname === '/dashboard',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" {...ic(17)}><path d="M3 10.5 12 3l9 7.5"/><path d="M5.5 9.5V20h13V9.5"/></svg>,
    },
    {
      label: 'Para hoy', href: '/dashboard/today', active: pathname === '/dashboard/today',
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...ic(17)}><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M9 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>,
    },
    {
      label: 'Calendario', href: '/dashboard/calendar', active: !!pathname?.startsWith('/dashboard/calendar'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" {...ic(17)}><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 9h17M8 3.5v3M16 3.5v3" strokeLinecap="round"/></svg>,
    },
    {
      label: 'Bandeja', href: '/dashboard/notifications', active: !!pathname?.startsWith('/dashboard/notifications'),
      icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" {...ic(17)}><path d="M4 6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5V14a2.5 2.5 0 0 1-2.5 2.5H9l-4 3.5V6.5Z"/></svg>,
      badge: notifCount,
    },
    {
      label: 'Documentos',
      href: '/dashboard/documents',
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

  return (
    <aside className="dshScroll" style={{
      width: `${SIDEBAR_W}px`, flexShrink: 0,
      height: '100vh', position: 'sticky', top: 0,
      background: '#191F33',
      borderRight: '1px solid rgba(255,255,255,0.06)',
      display: 'flex', flexDirection: 'column',
      padding: '16px 14px', overflowY: 'auto', zIndex: 30,
    }}>

      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 8px 16px' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <span style={{ width: '30px', height: '30px', borderRadius: '9px', background: '#F2571E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 4px 12px -4px rgba(242,87,30,0.55)' }}>
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5 L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M12 4.5 L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
              <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            </svg>
          </span>
          <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: '17px', color: '#ECE5D6', letterSpacing: '-0.015em' }}>Aether</span>
        </Link>
      </div>

      {/* Workspace switcher */}
      <WorkspaceSwitcher
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelect={onSelectWorkspace}
        onCreateNew={onCreateWorkspace}
        onEdit={onEditWorkspace}
      />

      {/* Search */}
      <div
        onClick={onOpenSearch}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          padding: '8px 11px', borderRadius: '8px',
          background: 'rgba(255,255,255,0.04)', marginBottom: '16px', cursor: 'pointer',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)')}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="#827A6D" strokeWidth="1.8"/><path d="m20 20-3-3" stroke="#827A6D" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <span style={{ fontSize: '13px', color: '#827A6D', flex: 1 }}>Buscar</span>
        <span style={{ fontSize: '11px', color: '#5C5447', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', padding: '1px 5px' }}>⌘K</span>
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
          />
        ))}
      </nav>

      {/* Proyectos section */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '20px 11px 8px' }}>
        <Link
          href="/dashboard/projects"
          style={{
            fontFamily: SORA, fontSize: '11px', fontWeight: 600,
            letterSpacing: '0.1em', textTransform: 'uppercase',
            color: pathname?.startsWith('/dashboard/projects') ? '#9C9486' : '#615846',
            textDecoration: 'none', transition: 'color 0.14s',
          }}
          onMouseEnter={e => ((e.currentTarget as HTMLElement).style.color = '#9C9486')}
          onMouseLeave={e => ((e.currentTarget as HTMLElement).style.color = pathname?.startsWith('/dashboard/projects') ? '#9C9486' : '#615846')}
        >
          Proyectos
        </Link>
        <button onClick={onCreateProject} style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="#827A6D" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>
      <nav style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
        {projectsLoading ? null : activeProjects.length === 0 ? (
          <div
            onClick={onCreateProject}
            style={{ padding: '8px 11px', fontSize: '13px', color: '#615846', cursor: 'pointer', borderRadius: '8px' }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#615846'; }}
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
                color: isAct ? '#E8E1D2' : '#9C9486',
                background: isAct ? 'rgba(255,255,255,0.05)' : 'transparent',
                fontSize: '13px', cursor: 'pointer',
              }}
              onMouseEnter={e => { if (!isAct) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; } }}
              onMouseLeave={e => { if (!isAct) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; } }}
            >
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: p.color ?? '#8C7C9E', flexShrink: 0 }} />
              <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
            </div>
          );
        })}
      </nav>

      {/* Equipo */}
      <div style={{ marginTop: '8px' }}>
        <NavItem
          href="/dashboard/teams"
          label="Equipo"
          active={!!pathname?.startsWith('/dashboard/teams')}
          icon={<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" width="17" height="17"><circle cx="9" cy="8" r="3"/><path d="M3.5 19a5.5 5.5 0 0 1 11 0" strokeLinecap="round"/><path d="M16 6a3 3 0 0 1 0 6M18.5 19a5.5 5.5 0 0 0-3-4.9" strokeLinecap="round"/></svg>}
        />
      </div>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* User footer */}
      <div
        onClick={() => router.push('/dashboard/profile')}
        style={{
          display: 'flex', alignItems: 'center', gap: '10px',
          padding: '9px', borderRadius: '8px',
          border: '1px solid rgba(255,255,255,0.06)',
          marginTop: '14px', cursor: 'pointer',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.14)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.06)'; }}
      >
        <Avatar style={{ width: '30px', height: '30px', flexShrink: 0 }}>
          {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={user?.name ?? ''} crossOrigin="anonymous" />}
          <AvatarFallback style={{ fontSize: '12px', fontWeight: 700, color: '#24180A', background: '#F2571E', width: '30px', height: '30px' }}>
            {user ? getInitials(user.name) : '?'}
          </AvatarFallback>
        </Avatar>
        <span style={{ flex: 1, minWidth: 0, lineHeight: 1.15 }}>
          <span style={{ display: 'block', fontSize: '13px', fontWeight: 600, color: '#E8E1D2', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user?.name ?? 'Usuario'}
          </span>
          <span style={{ display: 'block', fontSize: '11px', color: '#827A6D' }}>Plan gratis</span>
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
          {showBell && <NotificationBell />}
          <button
            onClick={e => { e.stopPropagation(); router.push('/dashboard/settings'); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '4px', borderRadius: '6px' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="#827A6D" strokeWidth="1.7"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="#827A6D" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
        </div>
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
        background: '#191F33',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
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
        onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)')}
        onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'none')}
      >
        <span style={{ display: 'block', width: '18px', height: '1.5px', background: '#9C9486', borderRadius: '2px' }} />
        <span style={{ display: 'block', width: '18px', height: '1.5px', background: '#9C9486', borderRadius: '2px' }} />
        <span style={{ display: 'block', width: '13px', height: '1.5px', background: '#9C9486', borderRadius: '2px' }} />
      </button>

      {/* Logo */}
      <Link href="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none', flex: 1 }}>
        <span style={{
          width: '26px', height: '26px', borderRadius: '8px', background: '#F2571E',
          display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          boxShadow: '0 3px 10px -3px rgba(242,87,30,0.55)',
        }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
            <path d="M12 4.5 L5.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M12 4.5 L18.5 19.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M8.55 12.5 Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
          </svg>
        </span>
        <span style={{ fontFamily: SORA, fontWeight: 700, fontSize: '16px', color: '#ECE5D6', letterSpacing: '-0.015em' }}>
          Aether
        </span>
      </Link>
    </div>
  );
}

// ── Dashboard Layout ─────────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
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
  const [editingWorkspace, setEditingWorkspace] = useState<any | null>(null);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userAvatarUrl = getAvatarUrl(user?.avatar ?? null);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

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

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId) setActiveWorkspaceId(workspaces[0].id);
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId]);

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
    router.push('/dashboard');
  }, [setActiveWorkspaceId, router]);

  const handleLogout = async () => { await logout(); router.push('/login'); };

  const handleWorkspaceDeleted = useCallback((deletedId: string) => {
    setEditingWorkspace(null);
    const remaining = workspaces.filter(w => w.id !== deletedId && !w.archived);
    if (remaining.length > 0) {
      setActiveWorkspaceId(remaining[0].id);
    }
    router.push('/dashboard');
    fetchWorkspaces();
  }, [workspaces, setActiveWorkspaceId, router, fetchWorkspaces]);

  const sidebarProps = {
    pathname, router, user, workspaces, userAvatarUrl,
    onLogout: handleLogout,
    onOpenSearch: () => setSearchOpen(true),
    activeWorkspaceId,
    onSelectWorkspace: handleSelectWorkspace,
    onCreateWorkspace: () => setCreateWsOpen(true),
    onEditWorkspace: (ws: any) => setEditingWorkspace(ws),
    onCreateBoard: () => setCreateBoardOpen(true),
    onCreateProject: () => setCreateProjectOpen(true),
    sidebarBoards, sidebarProjects, boardsLoading, projectsLoading,
  };

  return (
    <ProtectedRoute>
      <SocketProvider>
        <div style={{ display: 'flex', minHeight: '100vh', background: '#161B2E', color: '#E8E1D2', fontFamily: MANROPE }}>

          {/* Backdrop — visible solo en móvil cuando el drawer está abierto */}
          <div
            className={`dsh-sidebar-backdrop${sidebarOpen ? ' is-open' : ''}`}
            onClick={() => setSidebarOpen(false)}
          />

          {/* Sidebar — drawer en móvil, columna fija en desktop */}
          <div className={`dsh-sidebar-wrap${sidebarOpen ? ' is-open' : ''}`}>
            <Sidebar {...sidebarProps} />
          </div>

          {/* Main */}
          <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: '#161B2E', overflow: 'auto' }}>

            {/* Topbar móvil — oculto en desktop por CSS */}
            <MobileTopbar onMenuClick={() => setSidebarOpen(v => !v)} />

            {children}
          </main>
        </div>

        <Toaster />
        <NotificationListener />
        <RealtimeNotificationProvider />
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        <OnboardingCompanion />

        <CreateWorkspaceModal isOpen={createWsOpen} onClose={() => setCreateWsOpen(false)} />

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
      </SocketProvider>
    </ProtectedRoute>
  );
}
