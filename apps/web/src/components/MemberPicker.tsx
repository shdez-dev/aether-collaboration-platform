// apps/web/src/components/MemberPicker.tsx
'use client';

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useAuthStore } from '@/stores/authStore';
import '../styles/member-picker.css';

interface Member {
  id: string;
  name: string;
  email: string;
}

interface MemberPickerProps {
  workspaceId: string;
  cardId: string;
  assignedMembers: Member[];
  onMemberAssigned: (member: Member) => void;
  onMemberRemoved: (memberId: string) => void;
}

const MemberItem = memo(function MemberItem({
  member,
  isAssigned,
  onAssign,
  onRemove,
}: {
  member: Member;
  isAssigned: boolean;
  onAssign: () => void;
  onRemove: () => void;
}) {
  return (
    <button onClick={isAssigned ? onRemove : onAssign} className="member-item" type="button">
      <div
        className={`member-avatar ${isAssigned ? 'member-avatar-assigned' : 'member-avatar-unassigned'}`}
      >
        {member.name.charAt(0).toUpperCase()}
      </div>

      <div className="member-info">
        <div className="member-name">{member.name}</div>
        <div className="member-email">{member.email}</div>
      </div>

      <div className={`member-indicator ${isAssigned ? 'member-indicator-assigned' : ''}`}>
        <span>{isAssigned ? '✓' : '+'}</span>
      </div>
    </button>
  );
});

const AssignedMember = memo(function AssignedMember({
  member,
  onRemove,
}: {
  member: Member;
  onRemove: () => void;
}) {
  return (
    <div className="assigned-member-chip">
      <div className="assigned-member-avatar">{member.name.charAt(0).toUpperCase()}</div>
      <span className="assigned-member-name">{member.name}</span>
      <button
        onClick={onRemove}
        className="assigned-member-remove"
        title="Remover miembro"
        type="button"
      >
        ✕
      </button>
    </div>
  );
});

export function MemberPicker({
  workspaceId,
  cardId,
  assignedMembers,
  onMemberAssigned,
  onMemberRemoved,
}: MemberPickerProps) {
  const { accessToken } = useAuthStore();
  const [workspaceMembers, setWorkspaceMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // ✅ FIX: Usar useMemo en lugar de useCallback mal usado
  const assignedMemberIds = useMemo(() => {
    return new Set(assignedMembers.map((m) => m.id));
  }, [assignedMembers]);

  useEffect(() => {
    if (workspaceMembers.length === 0) {
      fetchWorkspaceMembers();
    }
  }, [workspaceId]);

  const fetchWorkspaceMembers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/workspaces/${workspaceId}/members`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error('Error al obtener miembros del workspace');
      }

      const { data } = await response.json();
      const members = data.members || data || [];

      const transformedMembers = members.map((item: any) => {
        if (item.name && item.email) {
          return { id: item.id, name: item.name, email: item.email };
        }
        if (item.user) {
          return {
            id: item.user.id || item.userId,
            name: item.user.name,
            email: item.user.email,
          };
        }
        return item;
      });

      setWorkspaceMembers(transformedMembers);
    } catch (error) {
      setWorkspaceMembers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleAssignMember = useCallback(
    async (member: Member) => {
      // ✅ VALIDACIÓN: No permitir asignar si ya está asignado
      if (assignedMemberIds.has(member.id)) {
        return;
      }

      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${cardId}/members`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${accessToken}`,
            },
            body: JSON.stringify({ userId: member.id }),
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Error al asignar miembro');
        }

        onMemberAssigned(member);
      } catch (error: any) {
        alert(`Error al asignar miembro: ${error.message}`);
      }
    },
    [cardId, accessToken, onMemberAssigned, assignedMemberIds]
  );

  const handleRemoveMember = useCallback(
    async (memberId: string) => {
      try {
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL}/api/cards/${cardId}/members/${memberId}`,
          {
            method: 'DELETE',
            headers: {
              Authorization: `Bearer ${accessToken}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Error al remover miembro');
        }

        onMemberRemoved(memberId);
      } catch (error: any) {
        alert(`Error al remover miembro: ${error.message}`);
      }
    },
    [cardId, accessToken, onMemberRemoved]
  );

  // FIX: Usar useMemo para filtrado
  const { unassignedMembers, assignedFilteredMembers } = useMemo(() => {
    const filtered = workspaceMembers.filter((member) => {
      if (!searchQuery.trim()) return true;
      const query = searchQuery.toLowerCase();
      return (
        member?.name?.toLowerCase().includes(query) || member?.email?.toLowerCase().includes(query)
      );
    });

    return {
      unassignedMembers: filtered.filter((m) => !assignedMemberIds.has(m.id)),
      assignedFilteredMembers: filtered.filter((m) => assignedMemberIds.has(m.id)),
    };
  }, [workspaceMembers, searchQuery, assignedMemberIds]);

  return (
    <div className="member-picker-permanent">
      {/* Assigned Members */}
      {assignedMembers.length > 0 && (
        <div className="assigned-members-section">
          <div className="assigned-members-list">
            {assignedMembers.map((member) => (
              <AssignedMember
                key={member.id}
                member={member}
                onRemove={() => handleRemoveMember(member.id)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder="Buscar miembros..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="member-search-input"
      />

      {/* Members List */}
      <div className="member-content">
        {isLoading ? (
          <div className="member-loading">
            <div className="loading-spinner"></div>
            <p>Cargando miembros...</p>
          </div>
        ) : workspaceMembers.length === 0 ? (
          <div className="member-empty">
            <p>Sin miembros en el workspace</p>
          </div>
        ) : unassignedMembers.length === 0 && assignedFilteredMembers.length === 0 ? (
          <div className="member-empty">
            <p>No se encontraron miembros</p>
          </div>
        ) : (
          <>
            {/* Unassigned Members */}
            {unassignedMembers.length > 0 && (
              <div>
                {assignedFilteredMembers.length > 0 && (
                  <div className="member-section-label">Disponibles</div>
                )}
                {unassignedMembers.map((member) => (
                  <MemberItem
                    key={member.id}
                    member={member}
                    isAssigned={false}
                    onAssign={() => handleAssignMember(member)}
                    onRemove={() => {}}
                  />
                ))}
              </div>
            )}

            {/* Assigned Members */}
            {assignedFilteredMembers.length > 0 && (
              <div>
                {unassignedMembers.length > 0 && (
                  <div className="member-section-label">Ya Asignados</div>
                )}
                {assignedFilteredMembers.map((member) => (
                  <MemberItem
                    key={member.id}
                    member={member}
                    isAssigned={true}
                    onAssign={() => {}}
                    onRemove={() => handleRemoveMember(member.id)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {workspaceMembers.length > 0 && (
        <div className="member-footer">
          {assignedMembers.length} de {workspaceMembers.length} asignados
        </div>
      )}
    </div>
  );
}
