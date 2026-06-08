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
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { openGuide } from '@/lib/utils/onboardingGuide';
import { SocketProvider } from '@/components/providers/SocketProvider';
import { NotificationListener } from '@/components/notifications/NotificationListener';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';
import CommandPalette from '@/components/CommandPalette';
import OnboardingCompanion from '@/components/OnboardingCompanion';
import CreateWorkspaceModal from '@/components/CreateWorkspaceModal';
import CreateBoardModal from '@/components/CreateBoardModal';
import CreateProjectModal from '@/components/CreateProjectModal';
import { socketService } from '@/services/socketService';
import { C } from '@/lib/colors';

const SIDEBAR_W = 260;
const UI_FONT = "-apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', system-ui, sans-serif";

function getInitials(name: string) {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// ── Workspace Dropdown ─────────────────────────────────────────────────────────

function WorkspaceDropdown({
  workspaces,
  activeWorkspaceId,
  onSelect,
  onCreateNew,
}: {
  workspaces: any[];
  activeWorkspaceId: string | null;
  onSelect: (id: string) => void;
  onCreateNew: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const active = workspaces.find((w) => w.id === activeWorkspaceId) ?? workspaces[0] ?? null;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', padding: '10px 10px 8px', borderBottom: `1px solid ${C.border}` }}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
          padding: '8px 10px', borderRadius: '8px',
          background: open ? C.hover : 'transparent',
          border: `1px solid ${open ? C.border2 : 'transparent'}`,
          cursor: 'pointer', textAlign: 'left',
          transition: 'background 0.12s, border-color 0.12s',
          fontFamily: UI_FONT,
        }}
        onMouseEnter={(e) => { if (!open) { e.currentTarget.style.background = C.hover; e.currentTarget.style.borderColor = C.border; } }}
        onMouseLeave={(e) => { if (!open) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; } }}
      >
        {/* Workspace color block */}
        <div style={{
          width: '30px', height: '30px', borderRadius: '7px', flexShrink: 0,
          background: active?.color || '#38b6ff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '14px', fontWeight: 700, color: '#fff',
        }}>
          {active ? (active.name[0]?.toUpperCase() ?? '?') : '?'}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '13.5px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.3 }}>
            {active?.name ?? 'Select workspace'}
          </div>
          <div style={{ fontSize: '11px', color: C.text4, lineHeight: 1.3 }}>
            {active?.memberCount !== undefined
              ? `${active.memberCount} member${active.memberCount !== 1 ? 's' : ''}`
              : 'No workspace'}
          </div>
        </div>

        {/* Chevron */}
        <svg
          viewBox="0 0 12 12" fill="none" stroke={C.text4} strokeWidth="1.5"
          width="11" height="11"
          style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M2 4.5l4 4 4-4" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: '10px', right: '10px',
          background: C.surface, border: `1px solid ${C.border2}`,
          borderRadius: '10px', zIndex: 200,
          boxShadow: '0 8px 32px rgba(0,0,0,0.45)',
          overflow: 'hidden', fontFamily: UI_FONT,
        }}>
          <div style={{ padding: '6px', maxHeight: '220px', overflowY: 'auto' }}>
            {workspaces.filter((w) => !w.archived).map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              return (
                <button
                  key={ws.id}
                  onClick={() => { onSelect(ws.id); setOpen(false); }}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 10px', borderRadius: '7px',
                    background: isActive ? C.hover : 'transparent',
                    border: 'none', cursor: 'pointer', textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                  onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = C.hover; }}
                  onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{
                    width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
                    background: ws.color || '#38b6ff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color: '#fff',
                  }}>
                    {ws.name[0]?.toUpperCase() ?? '?'}
                  </div>
                  <span style={{ flex: 1, fontSize: '13px', fontWeight: isActive ? 600 : 400, color: isActive ? C.text : C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {ws.name}
                  </span>
                  {isActive && (
                    <svg viewBox="0 0 12 12" fill="none" stroke={C.accent} strokeWidth="2" width="11" height="11" style={{ flexShrink: 0 }}>
                      <path d="M2 6l3 3 5-5" />
                    </svg>
                  )}
                </button>
              );
            })}
          </div>
          <div style={{ borderTop: `1px solid ${C.border}`, padding: '6px' }}>
            <button
              onClick={() => { setOpen(false); onCreateNew(); }}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
                padding: '7px 10px', borderRadius: '6px',
                background: 'transparent', border: 'none', cursor: 'pointer',
                fontSize: '12.5px', color: C.text3, transition: 'background 0.1s, color 0.1s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; }}
            >
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" width="12" height="12">
                <path d="M6 1v10M1 6h10" />
              </svg>
              New workspace
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Nav Item ──────────────────────────────────────────────────────────────────

function NavItem({
  href,
  label,
  icon,
  active,
  badge,
  onClick,
}: {
  href?: string;
  label: string;
  icon: React.ReactNode;
  active?: boolean;
  badge?: number;
  onClick?: () => void;
}) {
  const inner = (
    <div
      role="button"
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '9px',
        padding: '6px 10px', borderRadius: '6px', cursor: 'pointer',
        background: active ? C.hover : 'transparent',
        color: active ? C.text : C.text2,
        fontSize: '13.5px', fontFamily: UI_FONT,
        transition: 'background 0.1s, color 0.1s',
      }}
      onMouseEnter={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; } }}
      onMouseLeave={(e) => { if (!active) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; } }}
    >
      {active && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: '2px', height: '16px', borderRadius: '0 2px 2px 0',
          background: `linear-gradient(180deg, ${C.accent}, ${C.green})`,
        }} />
      )}
      <span style={{ color: active ? C.accent : C.text3, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ flex: 1 }}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span style={{
          fontSize: '10px', fontWeight: 700, padding: '1px 5px', borderRadius: '8px',
          background: C.accent + '22', color: C.accent, border: `1px solid ${C.accent}44`,
          lineHeight: '16px', flexShrink: 0,
        }}>
          {badge}
        </span>
      )}
    </div>
  );

  if (href) {
    return (
      <Link href={href} style={{ textDecoration: 'none', display: 'block' }}>
        {inner}
      </Link>
    );
  }
  return <div onClick={onClick} style={{ display: 'block' }}>{inner}</div>;
}

// ── Section Header ─────────────────────────────────────────────────────────────

function SectionHeader({
  label,
  action,
  onAction,
  actionTitle,
}: {
  label: string;
  action?: boolean;
  onAction?: () => void;
  actionTitle?: string;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 10px 4px', fontFamily: UI_FONT }}>
      <span style={{ fontSize: '10.5px', fontWeight: 600, color: C.text4, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
        {label}
      </span>
      {action && onAction && (
        <button
          onClick={onAction}
          title={actionTitle}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '3px', background: 'none', border: 'none', cursor: 'pointer', color: C.text4, transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text4; }}
        >
          <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" width="9" height="9">
            <path d="M5 1v8M1 5h8" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── Expandable Item List ───────────────────────────────────────────────────────

function ExpandableSection({
  label,
  items,
  loading,
  empty,
  onAdd,
  addTitle,
  children,
}: {
  label: string;
  items: any[];
  loading?: boolean;
  empty?: React.ReactNode;
  onAdd?: () => void;
  addTitle?: string;
  children: (items: any[]) => React.ReactNode;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div style={{ marginBottom: '2px', fontFamily: UI_FONT }}>
      {/* Section toggle row */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '4px 8px 2px', gap: '2px' }}>
        <button
          onClick={() => setOpen((v) => !v)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 0', minWidth: 0 }}
        >
          <svg
            viewBox="0 0 10 10" fill="none" stroke={C.text4} strokeWidth="1.5"
            width="8" height="8"
            style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(90deg)' : 'none' }}
          >
            <path d="M3 2l4 3-4 3" />
          </svg>
          <span style={{ fontSize: '11px', fontWeight: 600, color: C.text4, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
            {label}
          </span>
        </button>
        {onAdd && (
          <button
            onClick={(e) => { e.stopPropagation(); onAdd(); }}
            title={addTitle}
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '16px', height: '16px', borderRadius: '3px', background: 'none', border: 'none', cursor: 'pointer', color: C.text4, transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text4; }}
          >
            <svg viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.8" width="9" height="9">
              <path d="M5 1v8M1 5h8" />
            </svg>
          </button>
        )}
      </div>

      {open && (
        <div>
          {loading && (
            <div style={{ padding: '4px 20px 4px 22px', fontSize: '11.5px', color: C.text4 }}>
              Loading…
            </div>
          )}
          {!loading && items.length === 0 && empty}
          {!loading && children(items)}
        </div>
      )}
    </div>
  );
}

// ── Board Item ─────────────────────────────────────────────────────────────────

function BoardItem({
  board,
  workspaceId,
  pathname,
  router,
}: {
  board: any;
  workspaceId: string;
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const path = `/dashboard/workspaces/${workspaceId}/boards/${board.id}`;
  const isActive = pathname === path;
  const color = board.color || '#38b6ff';

  return (
    <div
      onClick={() => router.push(path)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 8px 5px 22px', borderRadius: '5px', cursor: 'pointer',
        background: isActive ? C.hover : 'transparent',
        color: isActive ? C.text : C.text2,
        transition: 'background 0.1s, color 0.1s',
        fontFamily: UI_FONT,
      }}
      onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; } }}
      onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; } }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: '2px', height: '14px', borderRadius: '0 2px 2px 0',
          background: `linear-gradient(180deg, ${C.accent}, ${C.green})`,
        }} />
      )}
      <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
        {board.name}
      </span>
    </div>
  );
}

// ── Project Item ───────────────────────────────────────────────────────────────

function ProjectItem({
  project,
  pathname,
  router,
}: {
  project: any;
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
}) {
  const path = `/dashboard/projects/${project.id}`;
  const isActive = pathname?.startsWith(path) ?? false;
  const color = project.color || '#3b82f6';

  return (
    <div
      onClick={() => router.push(path)}
      style={{
        position: 'relative',
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '5px 8px 5px 22px', borderRadius: '5px', cursor: 'pointer',
        background: isActive ? C.hover : 'transparent',
        color: isActive ? C.text : C.text2,
        transition: 'background 0.1s, color 0.1s',
        fontFamily: UI_FONT,
      }}
      onMouseEnter={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = C.hover; (e.currentTarget as HTMLElement).style.color = C.text; } }}
      onMouseLeave={(e) => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = C.text2; } }}
    >
      {isActive && (
        <div style={{
          position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)',
          width: '2px', height: '14px', borderRadius: '0 2px 2px 0',
          background: `linear-gradient(180deg, ${C.accent}, ${C.green})`,
        }} />
      )}
      <span style={{ width: '6px', height: '6px', borderRadius: '2px', background: color, flexShrink: 0 }} />
      <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
        {project.name}
      </span>
    </div>
  );
}

// ── Sidebar Content ────────────────────────────────────────────────────────────

function SidebarContent({
  pathname,
  router,
  user,
  workspaces,
  userAvatarUrl,
  t,
  onLogout,
  onOpenSearch,
  activeWorkspaceId,
  onSelectWorkspace,
  onCreateWorkspace,
  onCreateBoard,
  onCreateProject,
  sidebarBoards,
  sidebarProjects,
  boardsLoading,
  projectsLoading,
}: {
  pathname: string | null;
  router: ReturnType<typeof useRouter>;
  user: any;
  workspaces: any[];
  userAvatarUrl: string | null;
  t: any;
  onLogout: () => void;
  onOpenSearch: () => void;
  activeWorkspaceId: string | null;
  onSelectWorkspace: (id: string) => void;
  onCreateWorkspace: () => void;
  onCreateBoard: () => void;
  onCreateProject: () => void;
  sidebarBoards: any[];
  sidebarProjects: any[];
  boardsLoading: boolean;
  projectsLoading: boolean;
}) {
  const ic = (s: number) => ({ width: `${s}px`, height: `${s}px` } as const);
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);

  const mainNav = [
    {
      label: 'Home',
      href: '/dashboard',
      active: pathname === '/dashboard',
      icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><path d="M2 8L8 2l6 6v6H2V8z" /><path d="M6 14v-4h4v4" /></svg>,
    },
    {
      label: t.nav_calendar,
      href: '/dashboard/calendar',
      active: pathname?.startsWith('/dashboard/calendar'),
      icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><rect x="2" y="3" width="12" height="11" rx="1" /><path d="M5 1v3M11 1v3M2 7h12" /></svg>,
    },
    {
      label: t.nav_inbox || 'Notifications',
      href: '/dashboard/notifications',
      active: pathname?.startsWith('/dashboard/notifications'),
      icon: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><path d="M8 2a5 5 0 0 1 5 5v3l1 2H2l1-2V7a5 5 0 0 1 5-5zM6.5 13a1.5 1.5 0 0 0 3 0" /></svg>,
    },
  ];

  const activeBoards = sidebarBoards;
  const activeProjects = sidebarProjects.filter(
    (p) => p.status === 'ACTIVE' || p.status === 'PLANNING'
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', fontFamily: UI_FONT }}>

      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: '12px 14px 10px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '9px', textDecoration: 'none' }}>
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="22" height="22" aria-label="Aether logo" style={{ flexShrink: 0 }}>
            <defs>
              <linearGradient id="sb-aether" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#22a5d6" />
                <stop offset="100%" stopColor="#3fd0e8" />
              </linearGradient>
            </defs>
            <path d="M18 20 C 38 38, 42 54, 50 78" fill="none" stroke="#1f8fc4" strokeWidth="6.5" strokeLinecap="round" />
            <path d="M50 14 C 50 38, 50 54, 50 78" fill="none" stroke="url(#sb-aether)" strokeWidth="6.5" strokeLinecap="round" />
            <path d="M82 20 C 62 38, 58 54, 50 78" fill="none" stroke="#3fd0e8" strokeWidth="6.5" strokeLinecap="round" />
            <circle cx="18" cy="20" r="5.5" fill="#1f8fc4" />
            <circle cx="50" cy="14" r="5.5" fill="#2bb4dd" />
            <circle cx="82" cy="20" r="5.5" fill="#3fd0e8" />
            <circle cx="50" cy="80" r="8" fill="url(#sb-aether)" />
          </svg>
          <span style={{ fontSize: '16px', fontWeight: 700, color: C.text, letterSpacing: '-0.2px' }}>Aether</span>
        </Link>
      </div>

      {/* ── Workspace Dropdown ───────────────────────────────────────────── */}
      <WorkspaceDropdown
        workspaces={workspaces}
        activeWorkspaceId={activeWorkspaceId}
        onSelect={onSelectWorkspace}
        onCreateNew={onCreateWorkspace}
      />

      {/* ── Search ──────────────────────────────────────────────────────── */}
      <div style={{ padding: '8px 10px', flexShrink: 0 }}>
        <div
          onClick={onOpenSearch}
          style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '7px 10px', borderRadius: '7px', cursor: 'pointer',
            background: C.surface, border: `1px solid ${C.border}`,
            color: C.text3, fontSize: '12.5px',
            transition: 'border-color 0.1s, background 0.1s',
          }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border2; (e.currentTarget as HTMLElement).style.background = C.hover; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = C.border; (e.currentTarget as HTMLElement).style.background = C.surface; }}
        >
          <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="12" height="12"><circle cx="6" cy="6" r="4" /><path d="M10 10l2.5 2.5" /></svg>
          <span style={{ flex: 1 }}>Search...</span>
          <span style={{ fontSize: '10.5px', padding: '1px 5px', borderRadius: '3px', background: C.bg, border: `1px solid ${C.border2}`, color: C.text3 }}>⌘K</span>
        </div>
      </div>

      {/* ── Scrollable nav ──────────────────────────────────────────────── */}
      <nav style={{ flex: 1, overflowY: 'auto', padding: '2px 8px 8px' }}>

        {/* Main navigation */}
        <div style={{ marginBottom: '6px' }}>
          {mainNav.map((item) => (
            <NavItem
              key={item.href}
              href={item.href}
              label={item.label}
              icon={item.icon}
              active={!!item.active}
            />
          ))}
        </div>

        {/* Workspace context section */}
        {activeWorkspaceId && (
          <>
            {/* Divider + workspace label */}
            <div style={{ height: '1px', background: C.border, margin: '6px 2px 4px' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 10px 6px', fontFamily: UI_FONT }}>
              <span style={{ fontSize: '10.5px', fontWeight: 600, color: C.text4, letterSpacing: '0.07em', textTransform: 'uppercase', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                {activeWs?.name ?? 'Workspace'}
              </span>
              <button
                onClick={() => router.push(`/dashboard/workspaces/${activeWorkspaceId}`)}
                style={{ fontSize: '10px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0, transition: 'color 0.1s', marginLeft: '8px' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = C.accent)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
              >
                overview
              </button>
            </div>

            {/* Docs */}
            <NavItem
              href={`/dashboard/workspaces/${activeWorkspaceId}/documents`}
              label="Docs"
              active={!!pathname?.startsWith(`/dashboard/workspaces/${activeWorkspaceId}/documents`)}
              icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><path d="M10 2H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1V6z" /><path d="M10 2v4h4" /></svg>}
            />

            {/* Tasks / Boards — expandable */}
            <ExpandableSection
              label="Tasks"
              items={activeBoards}
              loading={boardsLoading}
              onAdd={onCreateBoard}
              addTitle="New board"
              empty={
                <div
                  onClick={onCreateBoard}
                  style={{ padding: '4px 22px', fontSize: '12px', color: C.text4, cursor: 'pointer', fontFamily: UI_FONT, transition: 'color 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                >
                  + New board
                </div>
              }
            >
              {(boards) =>
                boards.map((b) => (
                  <BoardItem
                    key={b.id}
                    board={b}
                    workspaceId={activeWorkspaceId}
                    pathname={pathname}
                    router={router}
                  />
                ))
              }
            </ExpandableSection>

            {/* Projects — expandable */}
            <ExpandableSection
              label="Projects"
              items={activeProjects}
              loading={projectsLoading}
              onAdd={onCreateProject}
              addTitle="New project"
              empty={
                <div
                  onClick={onCreateProject}
                  style={{ padding: '4px 22px', fontSize: '12px', color: C.text4, cursor: 'pointer', fontFamily: UI_FONT, transition: 'color 0.1s' }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.text2)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
                >
                  + New project
                </div>
              }
            >
              {(projects) =>
                projects.map((p) => (
                  <ProjectItem
                    key={p.id}
                    project={p}
                    pathname={pathname}
                    router={router}
                  />
                ))
              }
            </ExpandableSection>

            {/* Activity */}
            <NavItem
              href={`/dashboard/workspaces/${activeWorkspaceId}?tab=activity`}
              label="Activity"
              active={pathname === `/dashboard/workspaces/${activeWorkspaceId}` && false}
              icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><path d="M1 8h2l2 5 4-10 2 5h4" /></svg>}
            />

            {/* Members */}
            <NavItem
              href={`/dashboard/workspaces/${activeWorkspaceId}?tab=members`}
              label="Members"
              active={false}
              icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><circle cx="6" cy="5" r="2.5" /><path d="M1 14a5 5 0 0 1 10 0" /><circle cx="12.5" cy="5.5" r="2" /><path d="M14.5 14a3.5 3.5 0 0 0-3.5-3.5" /></svg>}
            />
          </>
        )}

        {/* Global section */}
        <div style={{ height: '1px', background: C.border, margin: '8px 2px' }} />

        <NavItem
          href="/dashboard/teams"
          label={t.teams_title || 'Teams'}
          active={!!pathname?.startsWith('/dashboard/teams')}
          icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><rect x="2" y="3" width="12" height="10" rx="1" /><path d="M5 3v10M10 3v10" /></svg>}
        />
        <NavItem
          href="/dashboard/settings"
          label={t.nav_settings}
          active={!!pathname?.startsWith('/dashboard/settings')}
          icon={<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" {...ic(15)}><circle cx="8" cy="8" r="2" /><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.5 3.5l1.5 1.5M11 11l1.5 1.5M3.5 12.5L5 11M11 5l1.5-1.5" /></svg>}
        />
      </nav>

      {/* ── User footer ──────────────────────────────────────────────────── */}
      <div style={{ padding: '10px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '9px', flexShrink: 0 }}>
        <Link href="/dashboard/profile" style={{ display: 'flex', alignItems: 'center', gap: '9px', flex: 1, minWidth: 0, textDecoration: 'none' }}>
          <Avatar style={{ width: '28px', height: '28px', flexShrink: 0 }}>
            {userAvatarUrl && <AvatarImage src={userAvatarUrl} alt={user?.name || ''} crossOrigin="anonymous" />}
            <AvatarFallback
              style={{ fontSize: '11px', fontWeight: 600, color: '#fff', background: 'linear-gradient(135deg, #a855f7, #ec4899)', width: '28px', height: '28px' }}
            >
              {user && getInitials(user.name)}
            </AvatarFallback>
          </Avatar>
          <span style={{ fontSize: '13px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
            {user?.name}
          </span>
        </Link>
        <button
          onClick={onLogout}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '26px', height: '26px', borderRadius: '5px', background: 'none', border: 'none', cursor: 'pointer', color: C.text4, transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text4; }}
          title={t.nav_logout}
          data-testid="logout-button"
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="14" height="14">
            <path d="M10 3h3v10h-3M7 5l-3 3 3 3M4 8h7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ── Dashboard Layout ───────────────────────────────────────────────────────────

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();
  const {
    activeWorkspaceId,
    setActiveWorkspaceId,
    fetchSidebarBoards,
    fetchSidebarProjects,
    sidebarBoards,
    sidebarProjects,
    boardsLoading,
    projectsLoading,
  } = useActiveWorkspaceStore();

  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [searchOpen, setSearchOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [createBoardOpen, setCreateBoardOpen] = useState(false);
  const [createProjectOpen, setCreateProjectOpen] = useState(false);

  const t = useT();
  const userAvatarUrl = getAvatarUrl(user?.avatar ?? null);

  // Load workspaces on mount
  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  // Auto-select first workspace if none set
  useEffect(() => {
    if (workspaces.length > 0 && !activeWorkspaceId) {
      setActiveWorkspaceId(workspaces[0].id);
    }
  }, [workspaces, activeWorkspaceId, setActiveWorkspaceId]);

  // Sync active workspace from URL when navigating to workspace pages
  useEffect(() => {
    const match = pathname?.match(/\/dashboard\/workspaces\/([^\/\?]+)/);
    if (match && match[1] !== activeWorkspaceId) {
      setActiveWorkspaceId(match[1]);
    }
  }, [pathname, activeWorkspaceId, setActiveWorkspaceId]);

  // Fetch sidebar data whenever active workspace changes
  useEffect(() => {
    if (!activeWorkspaceId) return;
    fetchSidebarBoards(activeWorkspaceId);
    fetchSidebarProjects(activeWorkspaceId);
  }, [activeWorkspaceId, fetchSidebarBoards, fetchSidebarProjects]);

  // Keep sidebar in sync with real-time board/project events
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const handler = (event: any) => {
      const { type, payload } = event ?? {};
      if (!payload?.workspaceId || payload.workspaceId !== activeWorkspaceId) return;
      if (type === 'board.created' || type === 'board.archived' || type === 'board.deleted') {
        fetchSidebarBoards(activeWorkspaceId);
      }
      if (type === 'project.created' || type === 'project.deleted' || type === 'project.updated') {
        fetchSidebarProjects(activeWorkspaceId);
      }
    };
    socketService.on('event', handler);
    return () => socketService.off('event', handler);
  }, [activeWorkspaceId, fetchSidebarBoards, fetchSidebarProjects]);

  // ⌘K global shortcut
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

  const handleSelectWorkspace = useCallback((id: string) => {
    setActiveWorkspaceId(id);
    router.push(`/dashboard/workspaces/${id}`);
  }, [setActiveWorkspaceId, router]);

  const handleLogout = async () => {
    await logout();
    router.push('/login');
  };

  // Breadcrumb
  const activeWs = workspaces.find((w) => w.id === activeWorkspaceId);
  const crumb =
    pathname?.startsWith('/dashboard/workspaces') ? (activeWs?.name || t.nav_workspaces)
    : pathname?.startsWith('/dashboard/projects') ? t.projects_title
    : pathname?.startsWith('/dashboard/teams') ? (t.teams_title || 'Teams')
    : pathname?.startsWith('/dashboard/settings') ? t.nav_settings
    : pathname?.startsWith('/dashboard/profile') ? t.nav_profile
    : pathname?.startsWith('/dashboard/notifications') ? t.nav_inbox || 'Notifications'
    : pathname?.startsWith('/dashboard/calendar') ? t.nav_calendar
    : t.nav_dashboard;

  const sidebarProps = {
    pathname, router, user, workspaces, userAvatarUrl, t,
    onLogout: handleLogout,
    onOpenSearch: () => setSearchOpen(true),
    activeWorkspaceId,
    onSelectWorkspace: handleSelectWorkspace,
    onCreateWorkspace: () => setCreateWsOpen(true),
    onCreateBoard: () => setCreateBoardOpen(true),
    onCreateProject: () => setCreateProjectOpen(true),
    sidebarBoards,
    sidebarProjects,
    boardsLoading,
    projectsLoading,
  };

  return (
    <ProtectedRoute>
      <SocketProvider>
        <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: C.bg, color: C.text }}>

          {/* Mobile overlay */}
          {isSidebarOpen && (
            <div
              className="fixed inset-0 bg-black/60 z-20 md:hidden"
              onClick={() => setIsSidebarOpen(false)}
            />
          )}

          {/* Sidebar */}
          <aside
            className="fixed md:relative md:flex-shrink-0 z-30 transition-all duration-200"
            style={{
              width: isSidebarOpen ? `${SIDEBAR_W}px` : '0',
              minWidth: isSidebarOpen ? `${SIDEBAR_W}px` : '0',
              height: '100%',
              background: C.bg2,
              borderRight: `1px solid ${C.border}`,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            <div style={{ width: `${SIDEBAR_W}px`, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
              <SidebarContent {...sidebarProps} />
            </div>
          </aside>

          {/* Main content */}
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minWidth: 0 }}>

            {/* Topbar */}
            <header style={{
              height: '44px', background: C.bg2,
              borderBottom: `1px solid ${C.border}`,
              padding: '0 16px', gap: '12px',
              display: 'flex', alignItems: 'center', flexShrink: 0,
              fontFamily: UI_FONT,
            }}>
              <button
                onClick={() => setIsSidebarOpen((v) => !v)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '5px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s', flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
                aria-label="Toggle sidebar"
              >
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                  <rect x="2" y="2" width="12" height="12" rx="1.5" /><path d="M6 2v12" />
                </svg>
              </button>

              {/* Breadcrumb */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', flex: 1, minWidth: 0 }}>
                <span
                  style={{ color: '#38b6ff', cursor: 'pointer', opacity: 0.7, flexShrink: 0 }}
                  onClick={() => router.push('/dashboard')}
                >
                  Aether
                </span>
                <span style={{ color: C.text4, flexShrink: 0 }}>/</span>
                <span style={{ fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {crumb}
                </span>
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                <NotificationBell />
                <button
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', height: '28px', borderRadius: '5px', color: C.text3, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.1s, color 0.1s' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = C.text3; }}
                  onClick={() => openGuide()}
                  title="Guía de inicio"
                >
                  <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" width="15" height="15">
                    <circle cx="8" cy="8" r="6" /><path d="M6 6a2 2 0 014 0c0 2-2 2-2 3M8 11.5v.5" />
                  </svg>
                </button>
              </div>
            </header>

            {/* Page */}
            <main style={{ flex: 1, overflow: 'auto', background: C.bg }}>
              {children}
            </main>
          </div>
        </div>

        <Toaster />
        <NotificationListener />
        <RealtimeNotificationProvider />
        <CommandPalette open={searchOpen} onClose={() => setSearchOpen(false)} />
        <OnboardingCompanion />

        {/* Workspace creation modal */}
        <CreateWorkspaceModal
          isOpen={createWsOpen}
          onClose={() => setCreateWsOpen(false)}
        />

        {/* Board creation modal — only renders when workspace is active */}
        {activeWorkspaceId && (
          <CreateBoardModal
            workspaceId={activeWorkspaceId}
            isOpen={createBoardOpen}
            onClose={() => setCreateBoardOpen(false)}
            onSuccess={(boardId) => {
              setCreateBoardOpen(false);
              fetchSidebarBoards(activeWorkspaceId);
              router.push(`/dashboard/workspaces/${activeWorkspaceId}/boards/${boardId}`);
            }}
          />
        )}

        {/* Project creation modal */}
        {createProjectOpen && (
          <CreateProjectModal
            onClose={() => setCreateProjectOpen(false)}
            defaultWorkspaceId={activeWorkspaceId ?? undefined}
            onCreated={(project) => {
              setCreateProjectOpen(false);
              fetchSidebarProjects(activeWorkspaceId!);
              router.push(`/dashboard/projects/${project.id}`);
            }}
          />
        )}
      </SocketProvider>
    </ProtectedRoute>
  );
}
