'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import {
  getEventDescription,
  getEventIcon,
  getEventColor,
  formatRelativeTime,
  type ActivityLogEntry,
} from '@/lib/utils/activityLog';

interface ActivityEventCardProps {
  event: ActivityLogEntry;
}

// Campos que NO queremos mostrar en el payload
const EXCLUDED_FIELDS = [
  'name',
  'ownerId',
  'workspaceId',
  'userId',
  'boardId',
  'listId',
  'cardId',
  'id',
  'createdAt',
  'updatedAt',
];

// Función para filtrar y formatear el payload
function getRelevantPayloadInfo(payload: Record<string, any>): Record<string, any> | null {
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Excluir campos no relevantes
    if (EXCLUDED_FIELDS.includes(key)) continue;

    // Excluir valores nulos o undefined
    if (value === null || value === undefined) continue;

    // Formatear el valor según el tipo
    if (typeof value === 'boolean') {
      filtered[key] = value ? 'Sí' : 'No';
    } else if (
      value instanceof Date ||
      (typeof value === 'string' && !isNaN(Date.parse(value)) && value.includes('-'))
    ) {
      // Si es una fecha, formatearla
      try {
        const date = new Date(value);
        filtered[key] = date.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch {
        filtered[key] = value;
      }
    } else {
      filtered[key] = value;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : null;
}

// Función para formatear el nombre de la clave de forma legible
function formatFieldName(key: string): string {
  const translations: Record<string, string> = {
    title: 'Título',
    description: 'Descripción',
    status: 'Estado',
    priority: 'Prioridad',
    dueDate: 'Fecha de vencimiento',
    fromListName: 'Lista origen',
    toListName: 'Lista destino',
    boardTitle: 'Board',
    boardName: 'Board',
    listName: 'Lista',
    cardTitle: 'Card',
    memberName: 'Miembro',
    labelName: 'Etiqueta',
    color: 'Color',
    role: 'Rol',
    visibility: 'Visibilidad',
    contentPreview: 'Vista previa',
    oldValue: 'Valor anterior',
    newValue: 'Valor nuevo',
  };

  return translations[key] || key.charAt(0).toUpperCase() + key.slice(1);
}

export function ActivityEventCard({ event }: ActivityEventCardProps) {
  const [showPayload, setShowPayload] = useState(false);

  const Icon = getEventIcon(event.eventType);
  const avatarUrl = getAvatarUrl(event.userAvatar);
  const description = getEventDescription(event);
  const colorClass = getEventColor(event.eventType);

  return (
    <div className="bg-card border border-border rounded-terminal p-4 hover:bg-accent/5 transition-colors">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <Avatar className="h-10 w-10 flex-shrink-0">
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={event.userName} crossOrigin="anonymous" />
          )}
          <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
            {getInitials(event.userName)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Icon */}
            <div className={`mt-0.5 ${colorClass}`}>
              <Icon className="h-4 w-4" />
            </div>

            {/* Description */}
            <div className="flex-1 min-w-0">
              <p className="text-text-primary text-sm">
                <span className="font-medium">{event.userName}</span>{' '}
                <span className="text-text-secondary">{description}</span>
              </p>

              {/* Context info */}
              <div className="flex items-center gap-2 mt-1 text-xs text-text-muted flex-wrap">
                <span>{formatRelativeTime(event.createdAt)}</span>

                {event.boardName && (
                  <>
                    <span>•</span>
                    <span>Board: {event.boardName}</span>
                  </>
                )}

                {event.workspaceName && (
                  <>
                    <span>•</span>
                    <span>Workspace: {event.workspaceName}</span>
                  </>
                )}
              </div>

              {/* Payload toggle */}
              {(() => {
                const relevantInfo = getRelevantPayloadInfo(event.payload);
                return (
                  relevantInfo && (
                    <>
                      <button
                        onClick={() => setShowPayload(!showPayload)}
                        className="mt-2 flex items-center gap-1 text-xs text-text-muted hover:text-text-secondary transition-colors"
                      >
                        {showPayload ? (
                          <ChevronUp className="h-3 w-3" />
                        ) : (
                          <ChevronDown className="h-3 w-3" />
                        )}
                        {showPayload ? 'Ocultar' : 'Ver'} detalles
                      </button>

                      {/* Payload */}
                      {showPayload && (
                        <div className="mt-2 p-3 bg-surface rounded-terminal border border-border">
                          <dl className="space-y-2">
                            {Object.entries(relevantInfo).map(([key, value]) => (
                              <div key={key} className="flex gap-2 text-xs">
                                <dt className="font-medium text-text-secondary min-w-[120px]">
                                  {formatFieldName(key)}:
                                </dt>
                                <dd className="text-text-primary flex-1">
                                  {typeof value === 'object'
                                    ? JSON.stringify(value, null, 2)
                                    : String(value)}
                                </dd>
                              </div>
                            ))}
                          </dl>
                        </div>
                      )}
                    </>
                  )
                );
              })()}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
