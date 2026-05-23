// apps/web/src/components/MemberPicker.tsx
'use client';

import { useState, useEffect, memo, useCallback, useMemo } from 'react';
import { useT } from '@/lib/i18n';
import { apiService } from '@/services/apiService';
import { Check, X } from 'lucide-react';
import { C } from '@/lib/colors';

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

const AVATAR_PALETTE = ['#3b82f6','#10b981','#f59e0b','#a855f7','#ec4899','#06b6d4','#fb923c'];
function hashColor(str: string) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) | 0;
  return AVATAR_PALETTE[Math.abs(h) % AVATAR_PALETTE.length];
}

export function MemberPicker({ workspaceId, cardId, assignedMembers, onMemberAssigned, onMemberRemoved }: MemberPickerProps) {
  const t = useT();
  const [workspaceMembers, setWorkspaceMembers] = useState<Member[]>([]);
  const [isLoading,   setIsLoading]   = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const assignedMemberIds = useMemo(() => new Set(assignedMembers.map((m) => m.id)), [assignedMembers]);

  useEffect(() => {
    if (workspaceMembers.length > 0) return;
    setIsLoading(true);
    apiService.get<{ members: any[] }>(`/api/workspaces/${workspaceId}/members`, true)
      .then((res) => {
        if (!res.success) throw new Error('Error al obtener miembros');
        const members = (res.data?.members || []).map((item: any) => {
          if (item.name && item.email) return { id: item.id, name: item.name, email: item.email };
          if (item.user) return { id: item.user.id || item.userId, name: item.user.name, email: item.user.email };
          return item;
        });
        setWorkspaceMembers(members);
      })
      .catch(() => setWorkspaceMembers([]))
      .finally(() => setIsLoading(false));
  }, [workspaceId]);

  const handleAssign = useCallback(async (member: Member) => {
    if (assignedMemberIds.has(member.id)) return;
    try {
      const r = await apiService.post(`/api/cards/${cardId}/members`, { userId: member.id }, true);
      if (!r.success) throw new Error(r.error?.message || 'Error al asignar miembro');
      onMemberAssigned(member);
    } catch (e: any) { alert(e.message); }
  }, [cardId, onMemberAssigned, assignedMemberIds]);

  const handleRemove = useCallback(async (memberId: string) => {
    try {
      const r = await apiService.delete(`/api/cards/${cardId}/members/${memberId}`, true);
      if (!r.success) throw new Error(r.error?.message || 'Error al remover miembro');
      onMemberRemoved(memberId);
    } catch (e: any) { alert(e.message); }
  }, [cardId, onMemberRemoved]);

  const { unassigned, assignedFiltered } = useMemo(() => {
    const filtered = workspaceMembers.filter((m) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return m?.name?.toLowerCase().includes(q) || m?.email?.toLowerCase().includes(q);
    });
    return {
      unassigned:      filtered.filter((m) => !assignedMemberIds.has(m.id)),
      assignedFiltered: filtered.filter((m) =>  assignedMemberIds.has(m.id)),
    };
  }, [workspaceMembers, searchQuery, assignedMemberIds]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Assigned chips */}
      {assignedMembers.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
          {assignedMembers.map((member) => (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '3px 8px 3px 5px', borderRadius: '20px', background: C.surface, border: `1px solid ${C.border2}` }}>
              <div style={{ width: '18px', height: '18px', borderRadius: '50%', background: hashColor(member.name), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', fontWeight: 700, color: '#fff', flexShrink: 0 }}>
                {member.name.charAt(0).toUpperCase()}
              </div>
              <span style={{ fontSize: '11.5px', color: C.text2, fontWeight: 500 }}>{member.name.split(' ')[0]}</span>
              <button
                onClick={() => handleRemove(member.id)} type="button"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text4, padding: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = C.red; e.currentTarget.style.background = `${C.red}18`; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = C.text4; e.currentTarget.style.background = 'transparent'; }}
                title="Remover"
              >
                <X style={{ width: '9px', height: '9px' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="text" placeholder={t.board_filter_member}
        value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
        style={{ padding: '6px 8px', borderRadius: '6px', background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '12px', outline: 'none' }}
        onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
        onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
      />

      {/* Member list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
        {isLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px', padding: '16px 0' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
            <span style={{ fontSize: '11px', color: C.text4 }}>Cargando...</span>
          </div>
        ) : workspaceMembers.length === 0 ? (
          <div style={{ padding: '14px 0', textAlign: 'center', fontSize: '12px', color: C.text4 }}>Sin miembros en el workspace</div>
        ) : unassigned.length === 0 && assignedFiltered.length === 0 ? (
          <div style={{ padding: '14px 0', textAlign: 'center', fontSize: '12px', color: C.text4 }}>{t.comments_mention_no_results}</div>
        ) : (
          <>
            {unassigned.length > 0 && (
              <div>
                {assignedFiltered.length > 0 && (
                  <div style={{ fontSize: '9.5px', fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 6px' }}>Disponibles</div>
                )}
                {unassigned.map((member) => (
                  <MemberRow key={member.id} member={member} isAssigned={false} onAssign={() => handleAssign(member)} onRemove={() => {}} />
                ))}
              </div>
            )}
            {assignedFiltered.length > 0 && (
              <div>
                {unassigned.length > 0 && (
                  <div style={{ fontSize: '9.5px', fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '0.08em', padding: '4px 6px', marginTop: '4px' }}>Ya asignados</div>
                )}
                {assignedFiltered.map((member) => (
                  <MemberRow key={member.id} member={member} isAssigned={true} onAssign={() => {}} onRemove={() => handleRemove(member.id)} />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer */}
      {workspaceMembers.length > 0 && (
        <div style={{ paddingTop: '6px', borderTop: `1px solid ${C.border}`, fontSize: '11px', color: C.text4, textAlign: 'right' }}>
          {assignedMembers.length} de {workspaceMembers.length} asignados
        </div>
      )}
    </div>
  );
}

const MemberRow = memo(function MemberRow({ member, isAssigned, onAssign, onRemove }: {
  member: Member; isAssigned: boolean; onAssign: () => void; onRemove: () => void;
}) {
  return (
    <button
      type="button"
      onClick={isAssigned ? onRemove : onAssign}
      style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 6px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{
        width: '26px', height: '26px', borderRadius: '50%', flexShrink: 0,
        background: isAssigned ? `${C.accent}cc` : hashColor(member.name),
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '10px', fontWeight: 700, color: '#fff',
      }}>
        {member.name.charAt(0).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '12px', fontWeight: 500, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.name}</div>
        <div style={{ fontSize: '10.5px', color: C.text4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{member.email}</div>
      </div>
      <div style={{
        width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: isAssigned ? C.accent : `${C.accent}20`,
        border: `1.5px solid ${isAssigned ? C.accent : C.border2}`,
      }}>
        {isAssigned
          ? <Check style={{ width: '10px', height: '10px', color: '#fff' }} />
          : <span style={{ fontSize: '12px', color: C.accent, lineHeight: 1 }}>+</span>
        }
      </div>
    </button>
  );
});
