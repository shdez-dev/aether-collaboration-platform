// apps/web/src/components/ActivityFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { apiService } from '@/services/apiService';
import {
  Clock,
  Plus,
  Edit,
  Trash2,
  Move,
  User,
  Tag,
  MessageCircle,
  Archive,
  LayoutGrid,
  FileText,
  ArrowRight,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import type { ActivityLogEntry } from '@/lib/utils/activityLog';

interface ActivityFeedProps {
  workspaceId: string;
  refreshKey?: number;
}

export default function ActivityFeed({ workspaceId, refreshKey }: ActivityFeedProps) {
  const t = useT();
  const { accessToken } = useAuthStore();
  const [activities, setActivities] = useState<ActivityLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivity();
  }, [workspaceId, refreshKey]);

  const loadActivity = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await apiService.get<{
        events: ActivityLogEntry[];
        pagination: { total: number; limit: number; offset: number; hasMore: boolean };
      }>(`/api/workspaces/${workspaceId}/activity`, true);

      if (!response.success || !response.data) {
        throw new Error(response.error?.message || t.activity_error);
      }

      setActivities(response.data.events || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (eventType: string) => {
    const type = eventType;
    if (type.includes('created')) return <Plus className="w-3.5 h-3.5" />;
    if (type.includes('updated')) return <Edit className="w-3.5 h-3.5" />;
    if (type.includes('deleted')) return <Trash2 className="w-3.5 h-3.5" />;
    if (type.includes('moved') || type.includes('order-changed'))
      return <Move className="w-3.5 h-3.5" />;
    if (type.includes('archived')) return <Archive className="w-3.5 h-3.5" />;
    if (type.includes('assigned')) return <User className="w-3.5 h-3.5" />;
    if (type.includes('label')) return <Tag className="w-3.5 h-3.5" />;
    if (type.includes('comment')) return <MessageCircle className="w-3.5 h-3.5" />;
    if (type.includes('board')) return <LayoutGrid className="w-3.5 h-3.5" />;
    if (type.includes('card')) return <FileText className="w-3.5 h-3.5" />;
    if (type.includes('list')) return <LayoutGrid className="w-3.5 h-3.5" />;
    return <Clock className="w-3.5 h-3.5" />;
  };

  const getActivityColor = (eventType: string) => {
    const type = eventType;
    if (type.includes('created')) return 'text-success';
    if (type.includes('updated')) return 'text-accent';
    if (type.includes('deleted')) return 'text-error';
    if (type.includes('moved') || type.includes('order-changed')) return 'text-warning';
    if (type.includes('archived')) return 'text-warning';
    return 'text-text-muted';
  };

  const getActivityMessage = (event: ActivityLogEntry) => {
    const { eventType, payload, delta, userName, userId, targetName, workspaceName, boardName } = event;
    // Cast to string so the switch accepts both EventType values and any
    // non-standard types stored in user_activity_log (e.g. card.renamed).
    const type = eventType as string;
    const user = { id: userId, name: userName };

    // Names from v2 schema top-level fields, then payload fallbacks
    const wsName   = workspaceName  || payload?.workspaceName || payload?.name;
    const brdName  = boardName      || payload?.boardName     || payload?.boardTitle || payload?.name;
    const listName = payload?.listName || payload?.name;
    const cardName = targetName     || payload?.cardTitle     || payload?.title;
    const docName  = targetName     || payload?.title         || payload?.name;

    const u  = (txt: string)  => <strong className="text-text-primary">{txt}</strong>;
    const a  = (txt?: string) => txt ? <strong className="text-accent">{txt}</strong> : null;
    const e  = (txt?: string) => txt ? <strong className="text-error">{txt}</strong> : null;
    const w  = (txt?: string) => txt ? <strong className="text-warning">{txt}</strong> : null;
    const m  = (txt?: string) => txt ? <strong className="text-text-muted">{txt}</strong> : null;
    const s  = (txt: string)  => <span className="text-text-secondary">{txt}</span>;
    const em = (txt?: string) => txt ? <em className="text-text-muted">{txt}</em> : null;

    switch (type) {
      // ── Workspace ────────────────────────────────────────────────────────────
      case 'workspace.created':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('creó el workspace')} {a(wsName)}</p>;

      case 'workspace.updated':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('actualizó el workspace')} {a(wsName)}
            {delta?.after?.name && delta?.before?.name && (
              <>{s(' · de')} {em(delta.before.name)} {s('→')} {a(delta.after.name)}</>
            )}
          </p>
        );

      case 'workspace.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó el workspace')} {e(wsName)}</p>;

      case 'workspace.member.invited': {
        const invitee = payload?.inviteeName || payload?.inviteeEmail;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('invitó a')} {a(invitee)} {s('al workspace')} {a(wsName)}
          </p>
        );
      }

      case 'workspace.member.joined':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('se unió al workspace')} {a(wsName)}</p>;

      case 'workspace.member.removed': {
        const removed = payload?.memberName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('removió a')} {e(removed)} {s('del workspace')} {a(wsName)}
          </p>
        );
      }

      case 'workspace.member.role-changed': {
        const member  = payload?.memberName || targetName;
        const newRole = payload?.newRole    || delta?.after?.role;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('cambió el rol de')} {a(member)}
            {newRole && <>{s(' a')} <em className="text-text-secondary">{newRole}</em></>}
            {wsName && <>{s(' en')} {a(wsName)}</>}
          </p>
        );
      }

      // ── Board ────────────────────────────────────────────────────────────────
      case 'board.created':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('creó el board')} {a(brdName)}
            {wsName && <>{s(' en')} {a(wsName)}</>}
          </p>
        );

      case 'board.updated':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('actualizó el board')} {a(brdName)}
            {delta?.after?.name && delta?.before?.name && (
              <>{s(' · de')} {em(delta.before.name)} {s('→')} {a(delta.after.name)}</>
            )}
          </p>
        );

      case 'board.archived':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('archivó el board')} {w(brdName)}
            {wsName && <>{s(' en')} {a(wsName)}</>}
          </p>
        );

      case 'board.restored':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('restauró el board')} {a(brdName)}</p>;

      case 'board.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó el board')} {e(brdName)}</p>;

      // ── List ─────────────────────────────────────────────────────────────────
      case 'list.created': {
        const projName = payload?.projectName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('creó la lista')} {a(listName)}
            {brdName && <>{s(' en')} {a(brdName)}</>}
            {projName && <>{s(' · proyecto')} {a(projName)}</>}
          </p>
        );
      }

      case 'list.updated':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('actualizó la lista')} {a(listName)}
            {delta?.after?.name && delta?.before?.name && (
              <>{s(' · de')} {em(delta.before.name)} {s('→')} {a(delta.after.name)}</>
            )}
          </p>
        );

      case 'list.order-changed':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('reordenó las listas')}
            {brdName && <>{s(' en')} {a(brdName)}</>}
          </p>
        );

      case 'list.deleted':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('eliminó la lista')} {e(listName)}
            {brdName && <>{s(' de')} {a(brdName)}</>}
          </p>
        );

      // ── Card ─────────────────────────────────────────────────────────────────
      case 'card.created': {
        const listName = payload?.listName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('creó la tarjeta')} {a(cardName)}
            {listName && <>{s(' en')} {a(listName)}</>}
            {brdName  && <>{s(' ·')} {m(brdName)}</>}
          </p>
        );
      }

      case 'card.updated': {
        const from = delta?.before?.title;
        const to   = delta?.after?.title;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)}{' '}
            {from && to
              ? <>{s('renombró')} {em(from)} {s('→')} {a(to)}</>
              : <>{s('actualizó la tarjeta')} {a(cardName)}</>
            }
            {brdName && <>{s(' en')} {m(brdName)}</>}
          </p>
        );
      }

      case 'card.moved': {
        const from = payload?.fromListName || delta?.before?.listName;
        const to   = payload?.toListName   || payload?.newListName || delta?.after?.listName;
        return (
          <div>
            <p className="text-xs leading-relaxed">
              {u(user.name)} {s('movió')} {a(cardName)}
              {brdName && <>{s(' en')} {m(brdName)}</>}
            </p>
            {(from || to) && (
              <div className="flex items-center gap-1.5 text-[11px] mt-1.5">
                {from && <span className="px-2 py-0.5 bg-surface border border-border rounded text-text-muted">{from}</span>}
                {from && to && <ArrowRight className="w-3 h-3 text-text-muted" />}
                {to && <span className="px-2 py-0.5 bg-success/10 border border-success/30 text-success rounded font-medium">{to}</span>}
              </div>
            )}
          </div>
        );
      }

      case 'card.deleted':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('eliminó la tarjeta')} {e(cardName)}
            {brdName && <>{s(' de')} {m(brdName)}</>}
          </p>
        );

      case 'card.archived':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('archivó la tarjeta')} {w(cardName)}
            {brdName && <>{s(' en')} {m(brdName)}</>}
          </p>
        );

      case 'card.restored':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('restauró la tarjeta')} {a(cardName)}</p>;

      case 'card.status-changed': {
        const completed = delta?.after?.completed ?? payload?.completed;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s(completed ? 'completó' : 'reabrió')}{' '}
            <strong className={completed ? 'text-success' : 'text-accent'}>"{cardName}"</strong>
            {brdName && <>{s(' en')} {m(brdName)}</>}
          </p>
        );
      }

      case 'card.priority.changed': {
        const prev = delta?.before?.priority || payload?.oldPriority;
        const next = delta?.after?.priority  || payload?.newPriority || payload?.priority;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('cambió la prioridad de')} {a(cardName)}
            {prev && next
              ? <>{s(' · ')}{em(prev)}{s(' → ')}{em(next)}</>
              : next && <>{s(' a ')}{em(next)}</>
            }
          </p>
        );
      }

      case 'card.due-date.set': {
        const due = delta?.after?.dueDate || payload?.dueDate;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('estableció fecha límite en')} {a(cardName)}
            {due && <>{s(' → ')}<em className="text-text-muted">{new Date(due).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}</em></>}
          </p>
        );
      }

      case 'card.due-date.removed':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('quitó la fecha límite de')} {w(cardName)}</p>;

      case 'card.member.assigned': {
        const assignee = payload?.memberName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('asignó')} {a(assignee)} {s('a')} {m(cardName)}
          </p>
        );
      }

      case 'card.member.removed': {
        const removed = payload?.memberName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('removió')} {e(removed)} {s('de')} {m(cardName)}
          </p>
        );
      }

      case 'card.label.added': {
        const label = payload?.labelName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('añadió la etiqueta')} {a(label)} {s('en')} {m(cardName)}
          </p>
        );
      }

      case 'card.label.removed': {
        const label = payload?.labelName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('quitó la etiqueta')} {e(label)} {s('de')} {m(cardName)}
          </p>
        );
      }

      case 'card.dependency.added': {
        const blocking = payload?.blockingCardTitle;
        const blocked  = payload?.blockedCardTitle;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('añadió dependencia:')} {a(blocking)} {s('bloquea')} {m(blocked)}
          </p>
        );
      }

      case 'card.dependency.removed':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('removió una dependencia de')} {m(cardName)}
          </p>
        );

      // ── Comment ───────────────────────────────────────────────────────────────
      case 'comment.created': {
        const card = cardName || payload?.cardTitle;
        return (
          <div>
            <p className="text-xs leading-relaxed">{u(user.name)} {s('comentó en')} {a(card)}</p>
            {(payload?.contentPreview || delta?.after?.content) && (
              <p className="text-[11px] text-text-muted italic mt-1 line-clamp-1">
                "{payload?.contentPreview || delta?.after?.content}"
              </p>
            )}
          </div>
        );
      }

      case 'comment.updated':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('editó un comentario en')} {a(cardName || payload?.cardTitle)}</p>;

      case 'comment.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó un comentario en')} {m(cardName || payload?.cardTitle)}</p>;

      case 'comment.mention-added':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('te mencionó en')} {a(cardName || payload?.cardTitle)}</p>;

      // ── Checklist ─────────────────────────────────────────────────────────────
      case 'checklist.item.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              {u(user.name)} {s('añadió un item al checklist de')} {a(cardName || payload?.cardTitle)}
            </p>
            {(payload?.itemTitle || delta?.after?.title) && (
              <p className="text-[11px] text-text-muted italic mt-0.5">
                "{payload?.itemTitle || delta?.after?.title}"
              </p>
            )}
          </div>
        );

      case 'checklist.item.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó un item del checklist de')} {m(cardName || payload?.cardTitle)}</p>;

      // ── Document ──────────────────────────────────────────────────────────────
      case 'document.created':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('creó el documento')} {a(docName)}</p>;

      case 'document.updated':
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('editó el documento')} {a(docName)}
            {delta?.after?.title && delta?.before?.title && (
              <>{s(' · de')} {em(delta.before.title)} {s('→')} {a(delta.after.title)}</>
            )}
          </p>
        );

      case 'document.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó el documento')} {e(docName)}</p>;

      case 'document.version.saved':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('guardó una versión de')} {a(docName)}</p>;

      case 'document.version.restored':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('restauró una versión de')} {a(docName)}</p>;

      case 'document.permission.changed': {
        const targetUser = payload?.targetUserName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('actualizó permisos de')} {a(docName)}
            {targetUser && <>{s(' para')} {a(targetUser)}</>}
          </p>
        );
      }

      // ── Project ───────────────────────────────────────────────────────────────
      case 'project.created':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('creó el proyecto')} {a(targetName || payload?.name)}</p>;

      case 'project.updated':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('actualizó el proyecto')} {a(targetName || payload?.name)}</p>;

      case 'project.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó el proyecto')} {e(targetName || payload?.name)}</p>;

      case 'project.status.changed': {
        const projName  = targetName || payload?.name;
        const newStatus = payload?.newStatus || delta?.after?.status;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('cambió estado de')} {a(projName)}
            {newStatus && <>{s(' a')} <em className="text-text-secondary">{newStatus}</em></>}
          </p>
        );
      }

      case 'project.board.linked': {
        const projName = payload?.projectName || targetName;
        const board    = payload?.boardName   || brdName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('vinculó el board')} {a(board)} {s('al proyecto')} {m(projName)}
          </p>
        );
      }

      case 'project.board.unlinked': {
        const projName = payload?.projectName || targetName;
        const board    = payload?.boardName   || brdName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('desvinculó el board')} {e(board)} {s('del proyecto')} {m(projName)}
          </p>
        );
      }

      case 'project.milestone.created': {
        const milestone = payload?.milestoneName || targetName;
        const projName  = payload?.projectName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('creó el milestone')} {a(milestone)}
            {projName && <>{s(' en')} {m(projName)}</>}
          </p>
        );
      }

      case 'project.milestone.completed': {
        const milestone = payload?.milestoneName || targetName;
        const projName  = payload?.projectName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('completó el milestone')} {a(milestone)}
            {projName && <>{s(' en')} {m(projName)}</>}
          </p>
        );
      }

      // ── Team ──────────────────────────────────────────────────────────────────
      case 'team.created':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('creó el equipo')} {a(targetName || payload?.name)}</p>;

      case 'team.updated':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('actualizó el equipo')} {a(targetName || payload?.name)}</p>;

      case 'team.deleted':
        return <p className="text-xs leading-relaxed">{u(user.name)} {s('eliminó el equipo')} {e(targetName || payload?.name)}</p>;

      case 'team.member.added': {
        const member   = payload?.memberName;
        const teamName = payload?.teamName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('añadió a')} {a(member)} {s('al equipo')} {m(teamName)}
          </p>
        );
      }

      case 'team.member.removed': {
        const member   = payload?.memberName;
        const teamName = payload?.teamName || targetName;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('removió a')} {e(member)} {s('del equipo')} {m(teamName)}
          </p>
        );
      }

      case 'team.member.role-changed': {
        const member   = payload?.memberName;
        const teamName = payload?.teamName || targetName;
        const newRole  = payload?.newRole  || delta?.after?.role;
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('cambió el rol de')} {a(member)} {s('en')} {m(teamName)}
            {newRole && <>{s(' a')} <em className="text-text-secondary">{newRole}</em></>}
          </p>
        );
      }

      // ── Default ───────────────────────────────────────────────────────────────
      default:
        return (
          <p className="text-xs leading-relaxed">
            {u(user.name)} {s('realizó una acción')}{' '}
            <span className="text-text-muted text-[10px]">({type})</span>
          </p>
        );
    }
  };

  const formatTimestamp = (timestamp: string | Date | number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return t.activity_time_just_now;
    if (diffMins < 60) return t.activity_time_minutes(diffMins);
    if (diffHours < 24) return t.activity_time_hours(diffHours);
    if (diffDays === 1) return t.activity_time_yesterday;
    if (diffDays < 7) return t.activity_time_days(diffDays);

    return date.toLocaleDateString(t.locale || 'es-ES', { day: 'numeric', month: 'short' });
  };

  if (isLoading) {
    return (
      <div className="p-4">
        <div className="flex flex-col gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex gap-3 animate-pulse">
              <div className="w-8 h-8 bg-surface rounded-full flex-shrink-0" />
              <div className="flex-1">
                <div className="h-3 bg-surface rounded w-3/4 mb-2" />
                <div className="h-2 bg-surface rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-error">Error: {error}</p>
      </div>
    );
  }

  if (activities.length === 0) {
    return (
      <div className="p-4 text-center py-12">
        <Clock className="w-10 h-10 mx-auto mb-2 text-text-muted opacity-50" />
        <p className="text-xs text-text-secondary">{t.activity_empty_title}</p>
        <p className="text-xs text-text-muted mt-1">{t.activity_empty_desc}</p>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-3 max-h-[400px] overflow-y-auto">
      {activities.map((event) => (
        <div
          key={event.id}
          className="flex gap-3 group hover:bg-surface/50 -mx-2 px-2 py-1.5 rounded transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent text-xs font-bold flex-shrink-0">
            {event.userName.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">{getActivityMessage(event)}</div>

              <div className={`flex-shrink-0 ${getActivityColor(event.eventType)}`}>
                {getActivityIcon(event.eventType)}
              </div>
            </div>

            <p className="text-xs text-text-muted mt-1">{formatTimestamp(event.createdAt)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
