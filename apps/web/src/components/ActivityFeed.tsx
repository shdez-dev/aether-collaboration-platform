// apps/web/src/components/ActivityFeed.tsx
'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
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

interface ActivityEvent {
  id: string;
  type: string;
  user: {
    id: string;
    name: string;
    email: string;
    avatar?: string;
  };
  payload: any;
  boardId?: string;
  workspaceId?: string;
  timestamp: string;
}

interface ActivityFeedProps {
  workspaceId: string;
}

export default function ActivityFeed({ workspaceId }: ActivityFeedProps) {
  const { accessToken } = useAuthStore();
  const [activities, setActivities] = useState<ActivityEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadActivity();
  }, [workspaceId]);

  const loadActivity = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}/activity`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al cargar actividad');
      }

      const { data } = await response.json();
      setActivities(data.activities || []);
    } catch (err: any) {
      console.error('Error loading activity:', err);
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const getActivityIcon = (type: string) => {
    if (type.includes('created')) return <Plus className="w-3.5 h-3.5" />;
    if (type.includes('updated')) return <Edit className="w-3.5 h-3.5" />;
    if (type.includes('deleted')) return <Trash2 className="w-3.5 h-3.5" />;
    if (type.includes('moved') || type.includes('reordered'))
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

  const getActivityColor = (type: string) => {
    if (type.includes('created')) return 'text-success';
    if (type.includes('updated')) return 'text-accent';
    if (type.includes('deleted')) return 'text-error';
    if (type.includes('moved') || type.includes('reordered')) return 'text-warning';
    if (type.includes('archived')) return 'text-warning';
    return 'text-text-muted';
  };

  const getActivityMessage = (event: ActivityEvent) => {
    const { type, payload, user } = event;

    switch (type) {
      case 'workspace.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">creó el workspace</span>{' '}
              <strong className="text-accent">{payload.name}</strong>
            </p>
          </div>
        );

      case 'workspace.updated':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">actualizó el workspace</span>{' '}
              <strong className="text-accent">{payload.name}</strong>
            </p>
          </div>
        );

      case 'workspace.deleted':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">eliminó un workspace</span>
            </p>
          </div>
        );

      case 'board.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">creó el board</span>{' '}
              <strong className="text-accent">{payload.title || payload.name}</strong>
            </p>
          </div>
        );

      case 'board.updated':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">actualizó el board</span>{' '}
              <strong className="text-accent">{payload.title || payload.name}</strong>
            </p>
          </div>
        );

      case 'board.archived':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">archivó el board</span>{' '}
              {payload.title && <strong className="text-warning">{payload.title}</strong>}
            </p>
          </div>
        );

      case 'list.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">creó la lista</span>{' '}
              <strong className="text-accent">{payload.name}</strong>
              {payload.boardTitle && (
                <>
                  {' '}
                  <span className="text-text-secondary">en el board</span>{' '}
                  <strong className="text-text-muted">{payload.boardTitle}</strong>
                </>
              )}
            </p>
          </div>
        );

      case 'list.updated':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">renombró la lista a</span>{' '}
              <strong className="text-accent">{payload.name}</strong>
            </p>
          </div>
        );

      case 'list.reordered':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">reordenó la lista</span>{' '}
              {payload.name && <strong className="text-accent">{payload.name}</strong>}
            </p>
          </div>
        );

      case 'list.deleted':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">eliminó la lista</span>{' '}
              {payload.name && <strong className="text-error">{payload.name}</strong>}
            </p>
          </div>
        );

      case 'card.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">creó la tarjeta</span>{' '}
              <strong className="text-accent">{payload.title}</strong>
              {payload.listName && (
                <>
                  {' '}
                  <span className="text-text-secondary">en la lista</span>{' '}
                  <strong className="text-text-muted">{payload.listName}</strong>
                </>
              )}
            </p>
          </div>
        );

      case 'card.updated':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">actualizó la tarjeta</span>{' '}
              <strong className="text-accent">{payload.title}</strong>
            </p>
          </div>
        );

      case 'card.moved':
        return (
          <div>
            <p className="text-xs leading-relaxed mb-1">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">movió la tarjeta</span>{' '}
              <strong className="text-accent">{payload.title}</strong>
            </p>
            {(payload.fromListName || payload.toListName) && (
              <div className="flex items-center gap-1.5 text-[11px] mt-1.5">
                {payload.fromListName && (
                  <span className="px-2 py-0.5 bg-surface border border-border rounded text-text-muted">
                    {payload.fromListName}
                  </span>
                )}
                {payload.fromListName && payload.toListName && (
                  <ArrowRight className="w-3 h-3 text-text-muted" />
                )}
                {payload.toListName && (
                  <span className="px-2 py-0.5 bg-success/10 border border-success/30 text-success rounded font-medium">
                    {payload.toListName}
                  </span>
                )}
              </div>
            )}
          </div>
        );

      case 'card.deleted':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">eliminó la tarjeta</span>{' '}
              {payload.title && <strong className="text-error">{payload.title}</strong>}
            </p>
          </div>
        );

      case 'comment.created':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">comentó en la tarjeta</span>{' '}
              {payload.cardTitle && <strong className="text-accent">{payload.cardTitle}</strong>}
            </p>
            {payload.contentPreview && (
              <p className="text-[11px] text-text-muted italic mt-1 line-clamp-1">
                "{payload.contentPreview}"
              </p>
            )}
          </div>
        );

      case 'card.member.assigned':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">asignó a</span>{' '}
              {payload.memberName && <strong className="text-accent">{payload.memberName}</strong>}
              {payload.cardTitle && (
                <>
                  {' '}
                  <span className="text-text-secondary">a la tarjeta</span>{' '}
                  <strong className="text-text-muted">{payload.cardTitle}</strong>
                </>
              )}
            </p>
          </div>
        );

      case 'card.member.unassigned':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">removió a</span>{' '}
              {payload.memberName && <strong className="text-error">{payload.memberName}</strong>}
              {payload.cardTitle && (
                <>
                  {' '}
                  <span className="text-text-secondary">de la tarjeta</span>{' '}
                  <strong className="text-text-muted">{payload.cardTitle}</strong>
                </>
              )}
            </p>
          </div>
        );

      case 'card.label.added':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">agregó la etiqueta</span>{' '}
              {payload.labelName && <strong className="text-accent">{payload.labelName}</strong>}
              {payload.cardTitle && (
                <>
                  {' '}
                  <span className="text-text-secondary">a la tarjeta</span>{' '}
                  <strong className="text-text-muted">{payload.cardTitle}</strong>
                </>
              )}
            </p>
          </div>
        );

      case 'card.label.removed':
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">removió la etiqueta</span>{' '}
              {payload.labelName && <strong className="text-error">{payload.labelName}</strong>}
              {payload.cardTitle && (
                <>
                  {' '}
                  <span className="text-text-secondary">de la tarjeta</span>{' '}
                  <strong className="text-text-muted">{payload.cardTitle}</strong>
                </>
              )}
            </p>
          </div>
        );

      default:
        return (
          <div>
            <p className="text-xs leading-relaxed">
              <strong className="text-text-primary">{user.name}</strong>{' '}
              <span className="text-text-secondary">realizó una acción</span>
            </p>
          </div>
        );
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return 'Justo ahora';
    if (diffMins < 60) return `Hace ${diffMins}m`;
    if (diffHours < 24) return `Hace ${diffHours}h`;
    if (diffDays === 1) return 'Ayer';
    if (diffDays < 7) return `Hace ${diffDays}d`;

    return date.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
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
        <p className="text-xs text-text-secondary">Sin actividad reciente</p>
        <p className="text-xs text-text-muted mt-1">Los últimos 7 días</p>
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
            {event.user.name.charAt(0).toUpperCase()}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">{getActivityMessage(event)}</div>

              <div className={`flex-shrink-0 ${getActivityColor(event.type)}`}>
                {getActivityIcon(event.type)}
              </div>
            </div>

            <p className="text-xs text-text-muted mt-1">{formatTimestamp(event.timestamp)}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
