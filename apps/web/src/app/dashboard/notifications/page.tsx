// apps/web/src/app/dashboard/notifications/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useNotifications } from '@/hooks/useNotifications';
import { apiService } from '@/services/apiService';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

const SORA   = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────

const AVATAR_PALETTE = ['#4B607F', '#76A878', '#DB8A66', '#8C7C9E', '#F2571E', '#5B8FA8', '#A87876'];
function hashColor(str: string): string {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

function relativeTime(dateStr: string): string {
  try { return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es }); }
  catch { return ''; }
}

function isToday(dateStr: string): boolean {
  const d = new Date(dateStr);
  const now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

// Map notification type → human action text and target extraction
function parseNotification(n: any): { who: string; action: string; target: string; project: string } {
  const data = (n.data ?? {}) as Record<string, any>;
  const actor  = data.actorName ?? data.senderName ?? data.actor ?? '';
  const board  = data.boardName ?? data.board ?? '';
  const card   = data.cardTitle ?? data.card ?? '';
  const ws     = data.workspaceName ?? data.workspace ?? '';

  const typeMap: Record<string, { action: string; target: string }> = {
    COMMENT_MENTION:  { action: 'te mencionó en',        target: card || board },
    COMMENT_ADDED:    { action: 'comentó en',             target: card || board },
    CARD_ASSIGNED:    { action: 'te asignó a',            target: card },
    CARD_UNASSIGNED:  { action: 'te desasignó de',        target: card },
    CARD_DUE_SOON:    { action: 'vence pronto:',          target: card },
    CARD_OVERDUE:     { action: 'está vencida:',          target: card },
    BOARD_INVITE:     { action: 'te invitó al tablero',   target: board },
    WORKSPACE_INVITE: { action: 'te invitó al espacio',   target: ws || board },
    TEAM_INVITE:      { action: 'te invitó al equipo',    target: data.teamName ?? '' },
    WORKSPACE_REMOVED:{ action: 'te removió de',          target: ws || board },
  };

  const parsed = typeMap[n.type] ?? { action: n.title ?? 'realizó una acción', target: '' };

  // Fallback: try to parse from message if no actor
  const effectiveActor = actor || extractActorFromMessage(n.message ?? '');
  const project = board || ws || '';

  return {
    who: effectiveActor || 'Aether',
    action: parsed.action,
    target: parsed.target || card || board,
    project,
  };
}

function extractActorFromMessage(message: string): string {
  // Messages often start with "Juan comentó..." — extract first word(s)
  const match = message.match(/^([A-ZÁÉÍÓÚÑ][a-záéíóúñ]+(?:\s[A-ZÁÉÍÓÚÑ][a-záéíóúñ]+)?)/);
  return match ? match[1] : '';
}

function getInitials(name: string): string {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';
}

// ── Filter tabs ───────────────────────────────────────────────────────────────

type Filter = 'todo' | 'sin-leer' | 'menciones' | 'asignaciones';

const FILTER_LABELS: { key: Filter; label: string }[] = [
  { key: 'todo',         label: 'Todo' },
  { key: 'sin-leer',     label: 'Sin leer' },
  { key: 'menciones',    label: 'Menciones' },
  { key: 'asignaciones', label: 'Asignaciones' },
];

function filterMatch(n: any, filter: Filter): boolean {
  if (filter === 'todo')         return true;
  if (filter === 'sin-leer')     return !n.read;
  if (filter === 'menciones')    return n.type === 'COMMENT_MENTION';
  if (filter === 'asignaciones') return n.type === 'CARD_ASSIGNED';
  return true;
}

// ── Notification row ──────────────────────────────────────────────────────────

function NotifRow({ n, isOld, onRead, onArchive, onResolve, onClick }: {
  n: any; isOld?: boolean;
  onRead: () => void; onArchive: () => void; onResolve: () => void; onClick: () => void;
}) {
  const [hov, setHov] = useState(false);
  const { who, action, target, project } = parseNotification(n);
  const avatarColor = hashColor(who);
  const initials    = getInitials(who);
  const time        = relativeTime(n.createdAt);
  const unread      = !n.read;

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '13px',
        padding: '14px', borderRadius: '8px', cursor: 'pointer',
        background: hov ? 'rgba(255,255,255,0.03)' : 'transparent',
        position: 'relative',
      }}
    >
      {/* Unread dot */}
      <span style={{
        width: '8px', height: '8px', borderRadius: '50%', flexShrink: 0,
        background: unread ? '#F2571E' : 'transparent',
      }} />

      {/* Avatar */}
      <span style={{
        width: '34px', height: '34px', borderRadius: '50%',
        background: avatarColor, flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '12px', fontWeight: 700, color: '#24180A',
      }}>
        {initials}
      </span>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '14px', lineHeight: 1.4,
          color: isOld ? '#A9B4C6' : '#D8D0C1',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          <strong style={{ color: isOld ? '#D8D0C1' : '#F4EEE2' }}>{who} </strong>
          {action}
          {target && (
            <> <strong style={{ color: isOld ? '#9AB6D8' : '#F2571E' }}>{target}</strong></>
          )}
        </div>
        {project && (
          <div style={{ fontSize: '12px', color: isOld ? '#736B5E' : '#827A6D', marginTop: '2px' }}>
            {project}
          </div>
        )}
        {!project && (
          <div style={{ fontSize: '12px', color: '#736B5E', marginTop: '2px' }}>
            {n.message ? n.message.slice(0, 72) + (n.message.length > 72 ? '…' : '') : ''}
          </div>
        )}
      </div>

      {/* Time + actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {hov ? (
          <>
            {unread && (
              <button
                onClick={e => { e.stopPropagation(); onRead(); }}
                title="Marcar como leída"
                style={{
                  width: '26px', height: '26px', borderRadius: '6px',
                  background: 'none', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#827A6D',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,168,120,0.12)'; (e.currentTarget as HTMLElement).style.color = '#76A878'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#827A6D'; }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
            )}
            <button
              onClick={e => { e.stopPropagation(); onResolve(); }}
              title="Resolver"
              style={{
                width: '26px', height: '26px', borderRadius: '6px',
                background: 'none', border: 'none', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: '#827A6D',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(118,168,120,0.12)'; (e.currentTarget as HTMLElement).style.color = '#76A878'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'none'; (e.currentTarget as HTMLElement).style.color = '#827A6D'; }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
            <button onClick={e => { e.stopPropagation(); onArchive(); }} title="Archivar" style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#827A6D' }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M4 7h16v13H4zM8 3h8v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </>
        ) : (
          <span style={{ fontSize: '12px', color: '#736B5E' }}>{time}</span>
        )}
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function BandejaPage() {
  const router = useRouter();
  const { notifications, isLoading, loadNotifications, markAsRead, markAllAsRead, archiveNotification, resolveNotification } = useNotifications();
  const setActiveWorkspaceId = useActiveWorkspaceStore((s) => s.setActiveWorkspaceId);
  const fetchWorkspaces = useWorkspaceStore((s) => s.fetchWorkspaces);
  const [filter, setFilter] = useState<Filter>('todo');

  useEffect(() => { loadNotifications(); }, []);

  // Filter
  const filtered = notifications.filter(n => filterMatch(n, filter));

  // Split today vs before
  const hoy   = filtered.filter(n => isToday(n.createdAt));
  const antes  = filtered.filter(n => !isToday(n.createdAt));

  const unreadCount = notifications.filter(n => !n.read).length;
  const isEmpty = filtered.length === 0;

  async function handleClick(n: any) {
    if (!n.read) markAsRead(n.id);
    const data = (n.data ?? {}) as any;
    const projectTypes = ['PROJECT_INVITE', 'MILESTONE_COMPLETED', 'MILESTONE_MISSED', 'PROJECT_STATUS_CHANGED'];

    // Switch to the notification's workspace so it opens in the right context.
    // Refresh the workspace list so a newly-joined workspace appears.
    if (data.workspaceId) {
      setActiveWorkspaceId(data.workspaceId);
      fetchWorkspaces().catch(() => {});
    }

    if (projectTypes.includes(n.type) && data.projectId) {
      router.push(`/dashboard/projects/${data.projectId}`);
    } else if (n.type === 'WORKSPACE_INVITE' || n.type === 'WORKSPACE_REMOVED') {
      router.push('/dashboard');
    } else if (data.boardId) {
      // Resolve board → parent project, then open the project page
      try {
        const json = await apiService.get<{ project: { projectId: string } | null }>(
          `/api/boards/${data.boardId}/project`,
          true
        );
        const projectId = json?.data?.project?.projectId;
        router.push(projectId ? `/dashboard/projects/${projectId}` : '/dashboard');
      } catch {
        router.push('/dashboard');
      }
    } else {
      router.push('/dashboard');
    }
  }

  // Filter pill style
  function pillStyle(key: Filter): React.CSSProperties {
    const active = filter === key;
    return {
      padding: '7px 16px', borderRadius: '8px', cursor: 'pointer',
      fontFamily: SORA, fontWeight: 600, fontSize: '13px',
      border: active ? '1px solid rgba(242,87,30,0.4)' : '1px solid rgba(255,255,255,0.09)',
      background: active ? 'rgba(242,87,30,0.1)' : 'rgba(255,255,255,0.02)',
      color: active ? '#F2571E' : '#9C9486',
      transition: 'all 0.15s',
    };
  }

  return (
    <div style={{
      maxWidth: '760px', margin: '0 auto',
      padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px',
      fontFamily: MANROPE, animation: 'fadeUp .4s ease both',
    }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{
            fontFamily: SORA, fontWeight: 700,
            fontSize: 'clamp(1.7rem,3vw,2.2rem)',
            letterSpacing: '-0.02em', color: '#F4EEE2', margin: 0,
          }}>
            Bandeja
          </h1>
          <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: '#9C9486' }}>
            Lo que necesita tu atención, en un solo lugar.
          </p>
        </div>
        {unreadCount > 0 && (
          <span
            onClick={() => markAllAsRead()}
            style={{ fontSize: '13.5px', color: '#F2571E', fontWeight: 600, cursor: 'pointer' }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            Marcar todo como leído
          </span>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: '8px', margin: '24px 0 6px', flexWrap: 'wrap' }}>
        {FILTER_LABELS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            style={pillStyle(key)}
            onMouseEnter={e => { if (filter !== key) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; } }}
            onMouseLeave={e => { if (filter !== key) { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.02)'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; } }}
          >
            {label}
            {key === 'sin-leer' && unreadCount > 0 && (
              <span style={{
                marginLeft: '6px', fontSize: '11px', fontWeight: 700,
                color: filter === 'sin-leer' ? '#24180A' : '#9C9486',
                background: filter === 'sin-leer' ? '#F2571E' : 'rgba(255,255,255,0.1)',
                borderRadius: '8px', padding: '0 6px', minWidth: '18px',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                height: '18px', verticalAlign: 'middle',
              }}>
                {unreadCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Loading */}
      {isLoading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
          <div style={{
            width: '22px', height: '22px', borderRadius: '50%',
            border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#F2571E',
            animation: 'spin 0.8s linear infinite',
          }} />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && isEmpty && (
        <div style={{ textAlign: 'center', padding: '70px 0', color: '#827A6D' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%',
            background: 'rgba(118,168,120,0.1)', border: '1px solid rgba(118,168,120,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 16px',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M5 13l4 4L19 7" stroke="#76A878" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <p style={{ fontSize: '15px', margin: 0, color: '#827A6D' }}>
            {filter === 'todo'
              ? 'No hay nada por aquí. Estás al día.'
              : `Sin notificaciones en "${FILTER_LABELS.find(f => f.key === filter)?.label}".`}
          </p>
        </div>
      )}

      {/* Hoy */}
      {!isLoading && hoy.length > 0 && (
        <>
          <div style={{
            fontFamily: SORA, fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#615846', margin: '20px 4px 6px',
          }}>
            Hoy
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {hoy.map(n => (
              <NotifRow
                key={n.id}
                n={n}
                onRead={() => markAsRead(n.id)}
                onArchive={() => archiveNotification(n.id)}
                onResolve={() => resolveNotification(n.id)}
                onClick={() => handleClick(n)}
              />
            ))}
          </div>
        </>
      )}

      {/* Antes */}
      {!isLoading && antes.length > 0 && (
        <>
          <div style={{
            fontFamily: SORA, fontSize: '12px', fontWeight: 600,
            letterSpacing: '0.08em', textTransform: 'uppercase',
            color: '#615846', margin: '22px 4px 6px',
          }}>
            Antes
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {antes.map(n => (
              <NotifRow
                key={n.id}
                n={n}
                isOld
                onRead={() => markAsRead(n.id)}
                onArchive={() => archiveNotification(n.id)}
                onResolve={() => resolveNotification(n.id)}
                onClick={() => handleClick(n)}
              />
            ))}
          </div>
        </>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
