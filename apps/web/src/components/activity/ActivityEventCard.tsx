'use client';

import { useState } from 'react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import { useT } from '@/lib/i18n';
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

// Campos que NO queremos mostrar en el payload (IDs y campos técnicos)
const EXCLUDED_FIELDS = [
  // IDs generales
  'id',
  '_id',
  'uuid',

  // IDs de entidades (camelCase)
  'ownerId',
  'workspaceId',
  'userId',
  'boardId',
  'listId',
  'cardId',
  'documentId',
  'commentId',
  'inviteeId',
  'inviterId',
  'assignedUserId',
  'unassignedUserId',
  'memberId',
  'authorId',
  'creatorId',
  'editorId',
  'deleterId',
  'labelId',
  'tagId',
  'versionId',
  'parentId',
  'threadId',
  'attachmentId',
  'toUserId',
  'fromUserId',
  'targetUserId',

  // IDs de entidades (snake_case)
  'workspace_id',
  'board_id',
  'list_id',
  'card_id',
  'document_id',
  'comment_id',
  'user_id',
  'owner_id',
  'invitee_id',
  'inviter_id',
  'assigned_user_id',
  'unassigned_user_id',
  'member_id',
  'author_id',
  'creator_id',
  'label_id',
  'tag_id',
  'version_id',
  'parent_id',
  'to_user_id',
  'from_user_id',
  'target_user_id',

  // IDs de movimiento/cambio
  'fromListId',
  'toListId',
  'from_list_id',
  'to_list_id',
  'oldListId',
  'old_list_id',
  'fromBoardId',
  'toBoardId',
  'from_board_id',
  'to_board_id',
  'sourceId',
  'targetId',
  'source_id',
  'target_id',

  // IDs de acciones
  'movedBy',
  'moved_by',
  'deletedBy',
  'deleted_by',
  'archivedBy',
  'archived_by',
  'assignedBy',
  'assigned_by',
  'unassignedBy',
  'unassigned_by',
  'createdBy',
  'created_by',
  'updatedBy',
  'updated_by',
  'restoredBy',
  'restored_by',
  'completedBy',
  'completed_by',

  // Timestamps y fechas de sistema
  'createdAt',
  'updatedAt',
  'deletedAt',
  'archivedAt',
  'timestamp',
  'created_at',
  'updated_at',
  'deleted_at',
  'archived_at',
  'movedAt',
  'moved_at',
  'completedAt',
  'completed_at',

  // Campos técnicos de posición/orden
  'position',
  'order',
  'index',
  'oldPosition',
  'newPosition',
  'old_position',
  'new_position',
  'fromPosition',
  'toPosition',
  'from_position',
  'to_position',
  'sourcePosition',
  'targetPosition',
  'source_position',
  'target_position',

  // Campos que ya están en la descripción principal
  'name', // Ya se muestra en el título del evento
  'title', // Ya se muestra en el título del evento
  'cardTitle', // Ya está en la descripción
  'card_title',
  'boardName', // Ya está en el contexto
  'board_name',
  'boardTitle',
  'board_title',
  'listName', // Ya se muestra mejor traducido
  'list_name',
  'documentTitle',
  'document_title',
  'workspaceName',
  'workspace_name',

  // Campos de metadatos técnicos
  'version',
  'hash',
  'checksum',
  'metadata',
  'data',
  'payload',
  'eventType',
  'event_type',
  'socketId',
  'socket_id',
  'sessionId',
  'session_id',

  // Campos de nombres duplicados
  'oldBoardName',
  'old_board_name',
];

// Función para formatear valores de forma amigable
function formatValue(key: string, value: any): string {
  // Booleanos
  if (typeof value === 'boolean') {
    // Casos especiales según el campo
    if (key === 'completed' || key === 'archived') {
      return value ? 'Sí' : 'No';
    }
    return value ? 'Sí' : 'No';
  }

  // Roles
  if (key === 'role' || key === 'oldRole' || key === 'newRole') {
    const roleTranslations: Record<string, string> = {
      OWNER: 'Propietario',
      ADMIN: 'Administrador',
      MEMBER: 'Miembro',
      VIEWER: 'Observador',
      owner: 'Propietario',
      admin: 'Administrador',
      member: 'Miembro',
      viewer: 'Observador',
    };
    return roleTranslations[value] || value;
  }

  // Prioridades
  if (key === 'priority' || key === 'oldPriority' || key === 'newPriority') {
    const priorityTranslations: Record<string, string> = {
      LOW: 'Baja',
      MEDIUM: 'Media',
      HIGH: 'Alta',
      URGENT: 'Urgente',
      low: 'Baja',
      medium: 'Media',
      high: 'Alta',
      urgent: 'Urgente',
      none: 'Sin prioridad',
      NONE: 'Sin prioridad',
    };
    return priorityTranslations[value] || value;
  }

  // Visibilidad
  if (key === 'visibility') {
    const visibilityTranslations: Record<string, string> = {
      private: 'Privado',
      public: 'Público',
      PRIVATE: 'Privado',
      PUBLIC: 'Público',
      team: 'Equipo',
      TEAM: 'Equipo',
    };
    return visibilityTranslations[value] || value;
  }

  // Estado de tarjetas
  if (key === 'status') {
    const statusTranslations: Record<string, string> = {
      TODO: 'Por hacer',
      IN_PROGRESS: 'En progreso',
      DONE: 'Completado',
      ARCHIVED: 'Archivado',
      BACKLOG: 'Pendiente',
      todo: 'Por hacer',
      in_progress: 'En progreso',
      done: 'Completado',
      archived: 'Archivado',
      backlog: 'Pendiente',
    };
    return statusTranslations[value] || value;
  }

  // Formatos de exportación
  if (key === 'format' || key === 'exportFormat') {
    const formatTranslations: Record<string, string> = {
      PDF: 'PDF',
      MARKDOWN: 'Markdown',
      HTML: 'HTML',
      DOCX: 'Word',
      TXT: 'Texto plano',
      JSON: 'JSON',
      CSV: 'Excel (CSV)',
      pdf: 'PDF',
      markdown: 'Markdown',
      html: 'HTML',
      docx: 'Word',
      txt: 'Texto plano',
      json: 'JSON',
      csv: 'Excel (CSV)',
    };
    return formatTranslations[value] || value.toUpperCase();
  }

  // Tipos de contenido
  if (key === 'type') {
    const typeTranslations: Record<string, string> = {
      TEXT: 'Texto',
      IMAGE: 'Imagen',
      FILE: 'Archivo',
      LINK: 'Enlace',
      VIDEO: 'Video',
      AUDIO: 'Audio',
      text: 'Texto',
      image: 'Imagen',
      file: 'Archivo',
      link: 'Enlace',
      video: 'Video',
      audio: 'Audio',
    };
    return typeTranslations[value] || value;
  }

  // Colores (mostrar nombre en español)
  if (key === 'color' || key === 'labelColor') {
    const colorTranslations: Record<string, string> = {
      red: 'Rojo',
      blue: 'Azul',
      green: 'Verde',
      yellow: 'Amarillo',
      orange: 'Naranja',
      purple: 'Morado',
      pink: 'Rosa',
      gray: 'Gris',
      black: 'Negro',
      white: 'Blanco',
      RED: 'Rojo',
      BLUE: 'Azul',
      GREEN: 'Verde',
      YELLOW: 'Amarillo',
      ORANGE: 'Naranja',
      PURPLE: 'Morado',
      PINK: 'Rosa',
      GRAY: 'Gris',
      BLACK: 'Negro',
      WHITE: 'Blanco',
    };
    return colorTranslations[value] || value;
  }

  // Fechas (detectar diferentes formatos)
  if (
    key.toLowerCase().includes('date') ||
    key.toLowerCase().includes('fecha') ||
    value instanceof Date ||
    (typeof value === 'string' &&
      !isNaN(Date.parse(value)) &&
      (value.includes('-') || value.includes('/')))
  ) {
    try {
      const date = new Date(value);
      // Verificar que sea una fecha válida
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('es-ES', {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      }
    } catch {
      // Si falla, continuar con el formateo normal
    }
  }

  // Números (formatear con separadores de miles)
  if (typeof value === 'number') {
    return value.toLocaleString('es-ES');
  }

  // Arrays (mostrar como lista)
  if (Array.isArray(value)) {
    if (value.length === 0) return 'Ninguno';
    if (value.length <= 3) {
      return value.join(', ');
    }
    return `${value.slice(0, 3).join(', ')} y ${value.length - 3} más`;
  }

  // Objetos (intentar extraer información útil)
  if (typeof value === 'object' && value !== null) {
    // Si tiene una propiedad 'name' o 'title', mostrar eso
    if ('name' in value && value.name) {
      return String(value.name);
    }
    if ('title' in value && value.title) {
      return String(value.title);
    }
    // Si tiene una propiedad 'label', mostrar eso
    if ('label' in value && value.label) {
      return String(value.label);
    }
    // Si es un objeto simple con pocas propiedades, mostrarlas
    const keys = Object.keys(value);
    if (keys.length > 0 && keys.length <= 3) {
      return keys.map((k) => `${k}: ${value[k]}`).join(', ');
    }
    // Si no se puede extraer nada útil, no mostrar
    return '';
  }

  // Strings largos (truncar si es necesario)
  if (typeof value === 'string' && value.length > 300) {
    return value.substring(0, 300) + '...';
  }

  // Valores vacíos
  if (value === '' || value === null || value === undefined) {
    return 'No especificado';
  }

  return String(value);
}

// Estructura para detalles organizados
interface OrganizedEventDetails {
  sections: Array<{
    title: string;
    items: Array<{
      label: string;
      value: string;
      type?: 'change' | 'info' | 'user' | 'date';
      oldValue?: string;
      newValue?: string;
    }>;
  }>;
}

// Función principal para organizar detalles según el tipo de evento
function getRelevantPayloadInfo(
  payload: Record<string, any>,
  eventType: string
): OrganizedEventDetails | null {
  // Organizar detalles específicos por tipo de evento
  const organized = organizeEventDetails(payload, eventType);

  if (organized && organized.sections.length > 0) {
    return organized;
  }

  // Si no hay organización específica, usar el método genérico
  const genericInfo = getGenericPayloadInfo(payload);
  if (genericInfo && Object.keys(genericInfo).length > 0) {
    // Determinar título basado en el tipo de evento
    let title = 'Detalles';

    if (eventType.startsWith('workspace.')) {
      title = 'Detalles del workspace';
    } else if (eventType.startsWith('board.')) {
      title = 'Detalles del tablero';
    } else if (eventType.startsWith('list.')) {
      title = 'Detalles de la lista';
    } else if (eventType.startsWith('card.')) {
      title = 'Detalles de la tarjeta';
    } else if (eventType.includes('comment')) {
      title = 'Detalles del comentario';
    } else if (eventType.startsWith('document.')) {
      title = 'Detalles del documento';
    }

    return {
      sections: [
        {
          title,
          items: Object.entries(genericInfo).map(([key, value]) => ({
            label: formatFieldName(key),
            value: String(value),
            type: 'info' as const,
          })),
        },
      ],
    };
  }

  return null;
}

// Función para organizar detalles según el tipo de evento
function organizeEventDetails(
  payload: Record<string, any>,
  eventType: string
): OrganizedEventDetails | null {
  const sections: OrganizedEventDetails['sections'] = [];

  // Eventos de Workspace
  if (eventType.startsWith('workspace.')) {
    if (eventType === 'workspace.member.invited') {
      const userItems = [];
      if (payload.inviteeName) {
        userItems.push({
          label: 'Usuario invitado',
          value: payload.inviteeName,
          type: 'user' as const,
        });
      }
      if (payload.inviteeEmail) {
        userItems.push({
          label: 'Correo electrónico',
          value: payload.inviteeEmail,
          type: 'info' as const,
        });
      }
      if (payload.role) {
        userItems.push({
          label: 'Rol asignado',
          value: formatValue('role', payload.role),
          type: 'info' as const,
        });
      }

      if (userItems.length > 0) {
        sections.push({
          title: 'Invitación',
          items: userItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'workspace.member.roleChanged') {
      const changeItems = [];

      if (payload.memberName) {
        changeItems.push({
          label: 'Miembro',
          value: payload.memberName,
          type: 'user' as const,
        });
      }

      if (payload.oldRole && payload.newRole) {
        changeItems.push({
          label: 'Cambio de rol',
          value: '',
          type: 'change' as const,
          oldValue: formatValue('role', payload.oldRole),
          newValue: formatValue('role', payload.newRole),
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambio de permisos',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'workspace.created' || eventType === 'workspace.updated') {
      const infoItems = [];

      if (payload.description) {
        infoItems.push({
          label: 'Descripción',
          value: payload.description,
          type: 'info' as const,
        });
      }

      if (payload.visibility) {
        infoItems.push({
          label: 'Visibilidad',
          value: formatValue('visibility', payload.visibility),
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: 'Configuración del workspace',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }
  }

  // Eventos de Board
  if (eventType.startsWith('board.')) {
    if (eventType === 'board.renamed') {
      const changeItems = [];

      if (payload.oldName && payload.newName) {
        changeItems.push({
          label: 'Cambio de nombre',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldName,
          newValue: payload.newName,
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en el tablero',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'board.description.changed') {
      const changeItems = [];

      if (payload.oldDescription || payload.newDescription) {
        changeItems.push({
          label: 'Cambio de descripción',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldDescription || 'Sin descripción',
          newValue: payload.newDescription || 'Sin descripción',
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en el tablero',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'board.created' || eventType === 'board.updated') {
      const infoItems = [];

      if (payload.description) {
        infoItems.push({
          label: 'Descripción',
          value: payload.description,
          type: 'info' as const,
        });
      }

      if (payload.visibility) {
        infoItems.push({
          label: 'Visibilidad',
          value: formatValue('visibility', payload.visibility),
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: 'Configuración del tablero',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'board.archived' || eventType === 'board.unarchived') {
      const infoItems = [];

      if (payload.name || payload.boardName) {
        infoItems.push({
          label: 'Tablero',
          value: payload.name || payload.boardName,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: eventType === 'board.archived' ? 'Tablero archivado' : 'Tablero restaurado',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'board.deleted') {
      const infoItems = [];

      if (payload.name || payload.boardName) {
        infoItems.push({
          label: 'Tablero eliminado',
          value: payload.name || payload.boardName,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: 'Eliminación de tablero',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }
  }

  // Eventos de Lista
  if (eventType.startsWith('list.')) {
    if (eventType === 'list.renamed') {
      const changeItems = [];

      if (payload.oldName && payload.newName) {
        changeItems.push({
          label: 'Cambio de nombre',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldName,
          newValue: payload.newName,
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en la lista',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'list.created' || eventType === 'list.updated') {
      const infoItems = [];

      if (payload.description) {
        infoItems.push({
          label: 'Descripción',
          value: payload.description,
          type: 'info' as const,
        });
      }

      if (payload.name) {
        infoItems.push({
          label: 'Nombre',
          value: payload.name,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: 'Información de la lista',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'list.deleted' || eventType === 'list.archived') {
      const infoItems = [];

      if (payload.name) {
        infoItems.push({
          label: eventType === 'list.deleted' ? 'Lista eliminada' : 'Lista archivada',
          value: payload.name,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: eventType === 'list.deleted' ? 'Eliminación de lista' : 'Lista archivada',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'list.reordered') {
      // Para reordenamiento, solo mostrar un mensaje simple
      return null; // No mostrar detalles adicionales para reordenamiento
    }
  }

  // Eventos de Tarjetas
  if (eventType.startsWith('card.')) {
    if (eventType === 'card.moved') {
      const moveItems = [];

      if (payload.oldListName && payload.newListName) {
        moveItems.push({
          label: 'Movimiento',
          value: '',
          type: 'change' as const,
          oldValue: `Lista: ${payload.oldListName}`,
          newValue: `Lista: ${payload.newListName}`,
        });
      }

      if (moveItems.length > 0) {
        sections.push({
          title: 'Detalles del movimiento',
          items: moveItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.renamed') {
      const changeItems = [];

      if (payload.oldTitle && payload.newTitle) {
        changeItems.push({
          label: 'Cambio de título',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldTitle,
          newValue: payload.newTitle,
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en la tarjeta',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.description.changed') {
      const changeItems = [];

      if (payload.oldDescription || payload.newDescription) {
        changeItems.push({
          label: 'Cambio de descripción',
          value: '',
          type: 'change' as const,
          oldValue: truncateText(payload.oldDescription || 'Sin descripción', 200),
          newValue: truncateText(payload.newDescription || 'Sin descripción', 200),
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en la tarjeta',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.priority.changed') {
      const changeItems = [];

      if (payload.oldPriority !== undefined && payload.newPriority !== undefined) {
        changeItems.push({
          label: 'Cambio de prioridad',
          value: '',
          type: 'change' as const,
          oldValue: formatValue('priority', payload.oldPriority),
          newValue: formatValue('priority', payload.newPriority),
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en la tarjeta',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.duedate.set' || eventType === 'card.duedate.changed') {
      const dateItems = [];

      if (payload.oldDueDate || payload.newDueDate || payload.dueDate) {
        dateItems.push({
          label: 'Cambio de fecha límite',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldDueDate ? formatValue('dueDate', payload.oldDueDate) : 'Sin fecha',
          newValue: formatValue('dueDate', payload.newDueDate || payload.dueDate),
        });
      }

      if (dateItems.length > 0) {
        sections.push({
          title: 'Fecha límite',
          items: dateItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.member.assigned') {
      const userItems = [];

      if (payload.assignedUserName) {
        userItems.push({
          label: 'Usuario asignado',
          value: payload.assignedUserName,
          type: 'user' as const,
        });
      }

      if (payload.assignedUserEmail) {
        userItems.push({
          label: 'Correo electrónico',
          value: payload.assignedUserEmail,
          type: 'info' as const,
        });
      }

      if (userItems.length > 0) {
        sections.push({
          title: 'Asignación',
          items: userItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.member.unassigned') {
      const userItems = [];

      if (payload.unassignedUserName) {
        userItems.push({
          label: 'Usuario desasignado',
          value: payload.unassignedUserName,
          type: 'user' as const,
        });
      }

      if (userItems.length > 0) {
        sections.push({
          title: 'Desasignación',
          items: userItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.label.added' || eventType === 'card.label.removed') {
      const labelItems = [];

      if (payload.labelName) {
        labelItems.push({
          label: 'Etiqueta',
          value: payload.labelName,
          type: 'info' as const,
        });
      }

      if (payload.labelColor) {
        labelItems.push({
          label: 'Color',
          value: formatValue('color', payload.labelColor),
          type: 'info' as const,
        });
      }

      if (labelItems.length > 0) {
        sections.push({
          title: eventType === 'card.label.added' ? 'Etiqueta agregada' : 'Etiqueta removida',
          items: labelItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.created') {
      const cardItems = [];

      if (payload.description) {
        cardItems.push({
          label: 'Descripción',
          value: truncateText(payload.description, 200),
          type: 'info' as const,
        });
      }

      if (payload.priority) {
        cardItems.push({
          label: 'Prioridad',
          value: formatValue('priority', payload.priority),
          type: 'info' as const,
        });
      }

      if (payload.dueDate) {
        cardItems.push({
          label: 'Fecha límite',
          value: formatValue('dueDate', payload.dueDate),
          type: 'date' as const,
        });
      }

      if (payload.listName) {
        cardItems.push({
          label: 'Lista',
          value: payload.listName,
          type: 'info' as const,
        });
      }

      if (cardItems.length > 0) {
        sections.push({
          title: 'Detalles de la tarjeta',
          items: cardItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.updated') {
      // Para actualizaciones genéricas de tarjeta, no mostrar detalles
      // (los eventos específicos como renamed, description.changed, etc. ya los manejan)
      return null;
    }

    if (eventType === 'card.deleted' || eventType === 'card.archived') {
      const infoItems = [];

      if (payload.title || payload.cardTitle) {
        infoItems.push({
          label: eventType === 'card.deleted' ? 'Tarjeta eliminada' : 'Tarjeta archivada',
          value: payload.title || payload.cardTitle,
          type: 'info' as const,
        });
      }

      if (payload.listName) {
        infoItems.push({
          label: 'Lista',
          value: payload.listName,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: eventType === 'card.deleted' ? 'Tarjeta eliminada' : 'Tarjeta archivada',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.completed' || eventType === 'card.uncompleted') {
      const infoItems = [];

      if (payload.title || payload.cardTitle) {
        infoItems.push({
          label: 'Tarjeta',
          value: payload.title || payload.cardTitle,
          type: 'info' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title:
            eventType === 'card.completed'
              ? 'Tarjeta completada'
              : 'Tarjeta marcada como incompleta',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'card.duedate.removed') {
      const infoItems = [];

      if (payload.oldDueDate) {
        infoItems.push({
          label: 'Fecha límite removida',
          value: formatValue('dueDate', payload.oldDueDate),
          type: 'date' as const,
        });
      }

      if (infoItems.length > 0) {
        sections.push({
          title: 'Fecha límite removida',
          items: infoItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }
  }

  // Eventos de Comentarios
  if (eventType.includes('comment')) {
    if (eventType === 'comment.created' || eventType === 'card.comment.added') {
      const commentItems = [];

      if (payload.content) {
        commentItems.push({
          label: 'Comentario',
          value: truncateText(payload.content, 300),
          type: 'info' as const,
        });
      }

      if (commentItems.length > 0) {
        sections.push({
          title: 'Contenido del comentario',
          items: commentItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'comment.updated' || eventType === 'card.comment.updated') {
      const changeItems = [];

      if (payload.oldContent || payload.newContent) {
        changeItems.push({
          label: 'Cambio de contenido',
          value: '',
          type: 'change' as const,
          oldValue: truncateText(payload.oldContent || '', 200),
          newValue: truncateText(payload.newContent || '', 200),
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en el comentario',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'document.comment.added') {
      const commentItems = [];

      if (payload.content) {
        commentItems.push({
          label: 'Comentario',
          value: truncateText(payload.content, 300),
          type: 'info' as const,
        });
      }

      if (commentItems.length > 0) {
        sections.push({
          title: 'Contenido del comentario',
          items: commentItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }
  }

  // Eventos de Documentos
  if (eventType.startsWith('document.')) {
    if (eventType === 'document.title.changed') {
      const changeItems = [];

      if (payload.oldTitle && payload.newTitle) {
        changeItems.push({
          label: 'Cambio de título',
          value: '',
          type: 'change' as const,
          oldValue: payload.oldTitle,
          newValue: payload.newTitle,
        });
      }

      if (changeItems.length > 0) {
        sections.push({
          title: 'Cambios en el documento',
          items: changeItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'document.exported') {
      const exportItems = [];

      if (payload.format) {
        exportItems.push({
          label: 'Formato de exportación',
          value: formatValue('format', payload.format),
          type: 'info' as const,
        });
      }

      if (exportItems.length > 0) {
        sections.push({
          title: 'Detalles de exportación',
          items: exportItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'document.version.created') {
      const versionItems = [];

      if (payload.versionNumber) {
        versionItems.push({
          label: 'Número de versión',
          value: String(payload.versionNumber),
          type: 'info' as const,
        });
      }

      if (payload.description) {
        versionItems.push({
          label: 'Descripción',
          value: payload.description,
          type: 'info' as const,
        });
      }

      if (versionItems.length > 0) {
        sections.push({
          title: 'Detalles de la versión',
          items: versionItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'document.version.restored') {
      const restoreItems = [];

      if (payload.versionNumber) {
        restoreItems.push({
          label: 'Versión restaurada',
          value: String(payload.versionNumber),
          type: 'info' as const,
        });
      }

      if (restoreItems.length > 0) {
        sections.push({
          title: 'Restauración de versión',
          items: restoreItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }

    if (eventType === 'document.created') {
      const docItems = [];

      if (payload.description) {
        docItems.push({
          label: 'Descripción',
          value: payload.description,
          type: 'info' as const,
        });
      }

      if (payload.templateId) {
        docItems.push({
          label: 'Plantilla usada',
          value: payload.templateId,
          type: 'info' as const,
        });
      }

      if (docItems.length > 0) {
        sections.push({
          title: 'Detalles del documento',
          items: docItems,
        });
      }

      return sections.length > 0 ? { sections } : null;
    }
  }

  return sections.length > 0 ? { sections } : null;
}

// Función auxiliar para truncar texto
function truncateText(text: string, maxLength: number): string {
  if (!text || typeof text !== 'string') return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// Función genérica para eventos sin organización específica
function getGenericPayloadInfo(payload: Record<string, any>): Record<string, any> | null {
  const filtered: Record<string, any> = {};

  for (const [key, value] of Object.entries(payload)) {
    // Excluir campos no relevantes
    if (EXCLUDED_FIELDS.includes(key)) continue;

    // Excluir valores nulos o undefined
    if (value === null || value === undefined) continue;

    // Excluir strings vacíos
    if (typeof value === 'string' && value.trim() === '') continue;

    // Formatear el valor
    const formattedValue = formatValue(key, value);

    // Solo agregar si el valor formateado no está vacío
    if (formattedValue && formattedValue !== '') {
      filtered[key] = formattedValue;
    }
  }

  return Object.keys(filtered).length > 0 ? filtered : null;
}

// Función para formatear el nombre de la clave de forma legible
function formatFieldName(key: string): string {
  const translations: Record<string, string> = {
    // Generales
    title: 'Título',
    description: 'Descripción',
    status: 'Estado',
    name: 'Nombre',
    type: 'Tipo',

    // Tarjetas (Cards)
    priority: 'Prioridad',
    dueDate: 'Fecha límite',
    due_date: 'Fecha límite',
    startDate: 'Fecha de inicio',
    start_date: 'Fecha de inicio',
    cardTitle: 'Tarjeta',
    card_title: 'Tarjeta',
    oldTitle: 'Nombre anterior',
    newTitle: 'Nuevo nombre',
    completed: 'Completada',
    archived: 'Archivada',

    // Listas
    fromListName: 'Lista de origen',
    toListName: 'Lista de destino',
    oldListName: 'Lista anterior',
    newListName: 'Lista nueva',
    listName: 'Lista',
    list_name: 'Lista',
    listPosition: 'Posición en la lista',

    // Boards/Tableros
    boardTitle: 'Tablero',
    boardName: 'Tablero',
    board_name: 'Tablero',
    oldName: 'Nombre anterior',
    newName: 'Nombre nuevo',
    oldDescription: 'Descripción anterior',
    newDescription: 'Descripción nueva',

    // Documentos
    documentTitle: 'Documento',
    document_title: 'Documento',
    format: 'Formato de exportación',
    versionNumber: 'Número de versión',
    exportFormat: 'Formato de exportación',

    // Miembros y usuarios
    memberName: 'Miembro',
    assignedUserName: 'Asignado a',
    unassignedUserName: 'Desasignado',
    inviteeName: 'Usuario invitado',
    userName: 'Usuario',
    user_name: 'Usuario',

    // Etiquetas
    labelName: 'Etiqueta',
    label_name: 'Etiqueta',
    labelColor: 'Color de etiqueta',
    color: 'Color',

    // Permisos y roles
    role: 'Rol',
    oldRole: 'Rol anterior',
    newRole: 'Rol nuevo',
    visibility: 'Visibilidad',
    permissions: 'Permisos',

    // Comentarios
    content: 'Contenido',
    contentPreview: 'Contenido',
    commentText: 'Comentario',
    text: 'Texto',

    // Valores genéricos
    oldValue: 'Valor anterior',
    newValue: 'Valor nuevo',
    old_value: 'Valor anterior',
    new_value: 'Valor nuevo',
    previousValue: 'Valor anterior',
    currentValue: 'Valor actual',

    // Prioridades
    oldPriority: 'Prioridad anterior',
    newPriority: 'Prioridad nueva',

    // Email
    email: 'Correo electrónico',
    inviteeEmail: 'Correo del invitado',

    // Otros
    reason: 'Motivo',
    message: 'Mensaje',
    notes: 'Notas',
    tags: 'Etiquetas',
    category: 'Categoría',
  };

  return translations[key] || key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ');
}

export function ActivityEventCard({ event }: ActivityEventCardProps) {
  const [showPayload, setShowPayload] = useState(false);
  const t = useT();

  const Icon = getEventIcon(event.eventType);
  const avatarUrl = getAvatarUrl(event.userAvatar);
  const description = getEventDescription(event, t);
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
                <span>{formatRelativeTime(event.createdAt, t)}</span>

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
                const relevantInfo = getRelevantPayloadInfo(event.payload, event.eventType);
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
                        <div className="mt-2 p-3 bg-surface rounded-terminal border border-border space-y-3">
                          {relevantInfo.sections.map((section, sectionIdx) => (
                            <div key={sectionIdx}>
                              <p className="text-xs text-text-muted mb-2 font-medium">
                                {section.title}
                              </p>
                              <dl className="space-y-2">
                                {section.items.map((item, itemIdx) => (
                                  <div
                                    key={itemIdx}
                                    className="flex flex-col gap-1 text-xs border-b border-border/50 pb-2 last:border-b-0 last:pb-0"
                                  >
                                    {item.type === 'change' ? (
                                      // Mostrar cambios de "antes → después" de forma visual
                                      <>
                                        <dt className="font-medium text-text-secondary">
                                          {item.label}
                                        </dt>
                                        <dd className="space-y-1">
                                          <div className="flex items-start gap-2">
                                            <span className="text-red-500 font-mono text-[10px] mt-0.5">
                                              -
                                            </span>
                                            <span className="text-text-muted line-through flex-1 break-words">
                                              {item.oldValue}
                                            </span>
                                          </div>
                                          <div className="flex items-start gap-2">
                                            <span className="text-green-500 font-mono text-[10px] mt-0.5">
                                              +
                                            </span>
                                            <span className="text-text-primary font-medium flex-1 break-words">
                                              {item.newValue}
                                            </span>
                                          </div>
                                        </dd>
                                      </>
                                    ) : (
                                      // Mostrar información simple
                                      <>
                                        <dt className="font-medium text-text-secondary">
                                          {item.label}
                                        </dt>
                                        <dd
                                          className={`flex-1 break-words ${
                                            item.type === 'user'
                                              ? 'text-blue-500 font-medium'
                                              : item.type === 'date'
                                                ? 'text-purple-500'
                                                : 'text-text-primary'
                                          }`}
                                        >
                                          {item.value}
                                        </dd>
                                      </>
                                    )}
                                  </div>
                                ))}
                              </dl>
                            </div>
                          ))}
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
