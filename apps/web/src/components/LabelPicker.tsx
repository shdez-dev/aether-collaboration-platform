// apps/web/src/components/LabelPicker.tsx
'use client';

import { useState, useEffect, memo, useCallback } from 'react';
import { useT } from '@/lib/i18n';
import { useLabelStore, Label } from '@/stores/labelStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { Trash2, Plus, Check } from 'lucide-react';
import { C } from '@/lib/colors';

interface LabelPickerProps {
  workspaceId: string;
  cardId: string;
  assignedLabels: Label[];
  onLabelAssigned: (label: Label) => void;
  onLabelRemoved: (labelId: string) => void;
}

const PRESET_COLORS = [
  '#f06292','#66bb6a','#42a5f5','#ef5350','#ff9800',
  '#ab47bc','#26c6da','#8d6e63','#ffca28','#9ccc65','#ff7043','#5c6bc0',
];

function getTextColor(hex: string): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.substr(0,2),16), g = parseInt(h.substr(2,2),16), b = parseInt(h.substr(4,2),16);
  const lum = (0.299*r + 0.587*g + 0.114*b) / 255;
  return lum > 0.55 ? 'rgba(0,0,0,0.82)' : '#fff';
}

export function LabelPicker({ workspaceId, cardId, assignedLabels, onLabelAssigned, onLabelRemoved }: LabelPickerProps) {
  const t = useT();
  const { getWorkspaceLabels, fetchLabels, createLabel, deleteLabel } = useLabelStore();
  const userRole = useWorkspaceStore((s) => s.currentWorkspace?.userRole);
  const canManage = userRole === 'ADMIN' || userRole === 'OWNER';

  const [isCreating,    setIsCreating]    = useState(false);
  const [newLabelName,  setNewLabelName]  = useState('');
  const [selectedColor, setSelectedColor] = useState(PRESET_COLORS[0]);
  const [searchQuery,   setSearchQuery]   = useState('');
  const [deletingId,    setDeletingId]    = useState<string | null>(null);

  const workspaceLabels  = getWorkspaceLabels(workspaceId);
  const assignedLabelIds = new Set(assignedLabels.map((l) => l.id));

  useEffect(() => {
    if (workspaceLabels.length === 0) fetchLabels(workspaceId);
  }, [workspaceId]);

  const handleAssignLabel = useCallback(async (label: Label) => {
    if (assignedLabelIds.has(label.id)) {
      // toggle off
      try {
        const r = await apiService.delete(`/api/cards/${cardId}/labels/${label.id}`, true);
        if (!r.success) throw new Error(r.error?.message);
        onLabelRemoved(label.id);
      } catch (e: any) { alert(e.message); }
      return;
    }
    try {
      const r = await apiService.post(`/api/cards/${cardId}/labels`, { labelId: label.id }, true);
      if (!r.success && r.error?.code !== 'CONFLICT') throw new Error(r.error?.message);
      onLabelAssigned(label);
    } catch (e: any) { alert(e.message); }
  }, [cardId, onLabelAssigned, onLabelRemoved, assignedLabelIds]);

  const handleDeleteLabel = useCallback(async (labelId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canManage) return;
    setDeletingId(labelId);
    try {
      await deleteLabel(labelId);
      if (assignedLabelIds.has(labelId)) onLabelRemoved(labelId);
    } catch (err: any) { alert(err.message); }
    finally { setDeletingId(null); }
  }, [canManage, deleteLabel, assignedLabelIds, onLabelRemoved]);

  const handleCreateLabel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newLabelName.trim()) return;
    try {
      const newLabel = await createLabel(workspaceId, { name: newLabelName.trim(), color: selectedColor });
      await handleAssignLabel(newLabel);
      setNewLabelName('');
      setSelectedColor(PRESET_COLORS[0]);
      setIsCreating(false);
    } catch (err: any) { alert(err.message); }
  };

  const filteredLabels = workspaceLabels.filter((l) =>
    l.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Assigned badges */}
      {assignedLabels.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', paddingBottom: '8px', borderBottom: `1px solid ${C.border}` }}>
          {assignedLabels.map((label) => (
            <div key={label.id} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 8px 2px 8px', borderRadius: '12px', background: label.color, color: getTextColor(label.color), fontSize: '11px', fontWeight: 600 }}>
              <span>{label.name}</span>
              <button
                onClick={() => handleAssignLabel(label)}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '14px', height: '14px', borderRadius: '50%', background: 'transparent', border: 'none', cursor: 'pointer', color: 'inherit', opacity: 0.8, padding: 0, lineHeight: 1 }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                title="Quitar"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Create form */}
      {isCreating ? (
        <form onSubmit={handleCreateLabel} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: C.text4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Nombre</span>
            <input
              autoFocus type="text" value={newLabelName}
              onChange={(e) => setNewLabelName(e.target.value)}
              placeholder="Nombre de la etiqueta"
              maxLength={50}
              style={{ padding: '6px 8px', borderRadius: '6px', background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '12px', outline: 'none' }}
              onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
              onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
            />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '10px', color: C.text4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>Color</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '4px' }}>
              {PRESET_COLORS.map((color) => (
                <button
                  key={color} type="button"
                  onClick={() => setSelectedColor(color)}
                  style={{
                    width: '28px', height: '20px', borderRadius: '4px', background: color, border: selectedColor === color ? `2px solid ${C.text}` : '2px solid transparent',
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0,
                  }}
                >
                  {selectedColor === color && <Check style={{ width: '10px', height: '10px', color: getTextColor(color) }} />}
                </button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button type="button" onClick={() => { setIsCreating(false); setNewLabelName(''); setSelectedColor(PRESET_COLORS[0]); }}
              style={{ flex: 1, padding: '5px', borderRadius: '5px', fontSize: '11.5px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>
              {t.btn_cancel}
            </button>
            <button type="submit" disabled={!newLabelName.trim()}
              style={{ flex: 1, padding: '5px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 600, background: newLabelName.trim() ? C.accent : C.border2, color: newLabelName.trim() ? '#fff' : C.text4, border: 'none', cursor: newLabelName.trim() ? 'pointer' : 'not-allowed' }}>
              {t.btn_create}
            </button>
          </div>
        </form>
      ) : (
        <>
          {/* Search */}
          <input
            type="text" placeholder={t.board_filter_label}
            value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
            style={{ padding: '6px 8px', borderRadius: '6px', background: C.bg2, border: `1px solid ${C.border}`, color: C.text, fontSize: '12px', outline: 'none' }}
            onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
            onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
          />

          {/* Label list */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {filteredLabels.length === 0 ? (
              <div style={{ padding: '12px 0', textAlign: 'center', fontSize: '12px', color: C.text4 }}>
                {workspaceLabels.length === 0 ? 'Sin etiquetas' : t.checklist_empty}
              </div>
            ) : (
              filteredLabels.map((label) => {
                const isAssigned = assignedLabelIds.has(label.id);
                return (
                  <button
                    key={label.id} type="button"
                    onClick={() => handleAssignLabel(label)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', width: '100%', textAlign: 'left' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {/* Color swatch */}
                    <div style={{ width: '28px', height: '16px', borderRadius: '3px', background: label.color, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '8px', fontWeight: 700, color: getTextColor(label.color) }}>
                        {label.name.slice(0,3).toUpperCase()}
                      </span>
                    </div>
                    <span style={{ flex: 1, fontSize: '12px', color: C.text2 }}>{label.name}</span>

                    {/* Assigned check */}
                    <div style={{
                      width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: `1.5px solid ${isAssigned ? C.accent : C.border2}`,
                      background: isAssigned ? C.accent : 'transparent',
                    }}>
                      {isAssigned && <Check style={{ width: '10px', height: '10px', color: '#fff' }} />}
                    </div>

                    {/* Delete label from workspace */}
                    {canManage && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteLabel(label.id, e)}
                        disabled={deletingId === label.id}
                        style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text4, padding: 0 }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = `${C.red}18`; e.currentTarget.style.color = C.red; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text4; }}
                        title="Eliminar etiqueta"
                      >
                        {deletingId === label.id
                          ? <div style={{ width: '10px', height: '10px', borderRadius: '50%', border: `1.5px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.6s linear infinite' }} />
                          : <Trash2 style={{ width: '10px', height: '10px' }} />
                        }
                      </button>
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* New label button */}
          <button
            type="button" onClick={() => setIsCreating(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 8px', borderRadius: '6px', fontSize: '11.5px', color: C.text3, background: 'transparent', border: `1px dashed ${C.border}`, cursor: 'pointer', width: '100%' }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.accent; e.currentTarget.style.color = C.accent; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text3; }}
          >
            <Plus style={{ width: '11px', height: '11px' }} />
            {t.btn_create}
          </button>
        </>
      )}
    </div>
  );
}
