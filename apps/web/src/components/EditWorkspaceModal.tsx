'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { C } from '@/lib/colors';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#ef4444',
  '#a855f7', '#6b7280', '#f59e0b', '#ec4899',
];

interface Workspace {
  id: string;
  name: string;
  icon?: string;
  color?: string;
}

interface EditWorkspaceModalProps {
  workspace: Workspace;
  onClose: () => void;
  onDeleted: (id: string) => void;
}

const FL = ({ children }: { children: React.ReactNode }) => (
  <span style={{
    display: 'block', fontSize: '11px', fontWeight: 700,
    letterSpacing: '0.07em', textTransform: 'uppercase' as const,
    fontFamily: SORA, color: C.text2, marginBottom: '7px',
  }}>
    {children}
  </span>
);

export default function EditWorkspaceModal({ workspace, onClose, onDeleted }: EditWorkspaceModalProps) {
  const { updateWorkspace, deleteWorkspace, isLoading } = useWorkspaceStore();

  const [name,          setName]          = useState(workspace.name);
  const [selectedIcon,  setSelectedIcon]  = useState(workspace.icon  ?? WORKSPACE_ICON_KEYS[0]);
  const [selectedColor, setSelectedColor] = useState(workspace.color ?? COLORS[0]);
  const [error,         setError]         = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [animIn,        setAnimIn]        = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const id = requestAnimationFrame(() => setAnimIn(true));
    return () => cancelAnimationFrame(id);
  }, []);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  const handleClose = () => {
    if (isLoading) return;
    setAnimIn(false);
    closeTimerRef.current = setTimeout(onClose, 160);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError('El nombre es obligatorio'); return; }
    try {
      await updateWorkspace(workspace.id, { name: name.trim(), icon: selectedIcon, color: selectedColor });
      handleClose();
    } catch (err: any) {
      setError(err.message || 'Error al guardar los cambios');
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    try {
      await deleteWorkspace(workspace.id);
      onDeleted(workspace.id);
    } catch (err: any) {
      setError(err.message || 'Error al eliminar el espacio');
      setConfirmDelete(false);
    }
  };

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
        background: `rgba(0,0,0,${animIn ? 0.6 : 0})`,
        backdropFilter: 'blur(4px)',
        transition: 'background 0.16s ease',
        fontFamily: MANROPE,
      }}
    >
      <div style={{
        width: '100%', maxWidth: '390px', maxHeight: '90vh',
        display: 'flex', flexDirection: 'column',
        background: C.bg2, border: `1px solid ${C.border}`,
        borderRadius: '12px', overflow: 'hidden',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        opacity: animIn ? 1 : 0,
        transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
        transition: 'opacity 0.16s ease, transform 0.16s ease',
      }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '28px', height: '28px', borderRadius: '7px', flexShrink: 0, background: `linear-gradient(135deg, ${selectedColor}cc, ${selectedColor}77)`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <WorkspaceIcon icon={selectedIcon} style={{ width: '14px', height: '14px', color: '#fff' } as any} />
            </div>
            <span style={{ fontSize: '14px', fontWeight: 600, color: C.text, fontFamily: SORA }}>Editar espacio</span>
          </div>
          <button
            type="button" onClick={handleClose} disabled={isLoading}
            style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: C.text3, display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; }}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12"><path d="M1 1l10 10M11 1L1 11" /></svg>
          </button>
        </div>

        {/* ── Body ── */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <form id="edit-ws-form" onSubmit={handleSave} style={{ display: 'contents' }}>

            {/* Nombre */}
            <div>
              <FL>Nombre del espacio *</FL>
              <input
                type="text" value={name} onChange={(e) => setName(e.target.value)}
                maxLength={255} disabled={isLoading}
                style={{ width: '100%', padding: '9px 12px', borderRadius: '7px', background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontSize: '13px', fontFamily: MANROPE, outline: 'none', boxSizing: 'border-box' as const, transition: 'border-color 0.14s' }}
                onFocus={(e) => { e.currentTarget.style.borderColor = selectedColor; }}
                onBlur={(e)  => { e.currentTarget.style.borderColor = C.border; }}
              />
            </div>

            {/* Color */}
            <div>
              <FL>Color</FL>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' as const }}>
                {COLORS.map((color) => (
                  <button
                    key={color} type="button" disabled={isLoading} aria-label={`Color ${color}`} aria-pressed={selectedColor === color}
                    onClick={() => setSelectedColor(color)}
                    style={{ width: '28px', height: '28px', borderRadius: '7px', background: color, border: 'none', cursor: 'pointer', flexShrink: 0, outline: selectedColor === color ? `2px solid ${C.text}` : '2px solid transparent', outlineOffset: '2px', transition: 'outline 0.14s' }}
                  />
                ))}
              </div>
            </div>

            {/* Icono */}
            <div>
              <FL>Icono</FL>
              <div style={{ borderRadius: '7px', background: C.surface, border: `1px solid ${C.border}`, padding: '3px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(30px, 1fr))', gap: '2px', maxHeight: '68px', overflowY: 'auto' }}>
                {WORKSPACE_ICON_KEYS.map((key) => (
                  <button
                    key={key} type="button" title={key} aria-pressed={selectedIcon === key} disabled={isLoading}
                    onClick={() => setSelectedIcon(key)}
                    style={{ height: '30px', borderRadius: '5px', background: selectedIcon === key ? selectedColor : 'transparent', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: selectedIcon === key ? '#fff' : C.text3, transition: 'background 0.1s' }}
                    onMouseEnter={(e) => { if (selectedIcon !== key) { e.currentTarget.style.background = C.hover; e.currentTarget.style.color = C.text2; } }}
                    onMouseLeave={(e) => { if (selectedIcon !== key) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = C.text3; } }}
                  >
                    <WorkspaceIcon icon={key} style={{ width: '15px', height: '15px' } as any} />
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding: '8px 12px', borderRadius: '7px', background: `${C.red}15`, border: `1px solid ${C.red}40`, color: C.red, fontSize: '12.5px' }}>
                {error}
              </div>
            )}
          </form>
        </div>

        {/* ── Footer ── */}
        <div style={{ padding: '10px 16px 12px', borderTop: `1px solid ${C.border}`, background: C.bg, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button" onClick={handleClose} disabled={isLoading}
              style={{ flex: 1, padding: '7px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500, fontFamily: MANROPE, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', transition: 'all 0.12s' }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = C.text4; e.currentTarget.style.color = C.text; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
            >
              Cancelar
            </button>
            <button
              type="submit" form="edit-ws-form" disabled={isLoading}
              style={{ flex: 1, padding: '7px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 600, fontFamily: SORA, background: C.accent, border: 'none', color: '#fff', cursor: isLoading ? 'not-allowed' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', transition: 'background 0.12s' }}
              onMouseEnter={(e) => { if (!isLoading) e.currentTarget.style.background = '#d94e18'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = C.accent; }}
            >
              {isLoading && (
                <svg style={{ animation: 'spin 1s linear infinite' }} viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
              )}
              Guardar cambios
            </button>
          </div>

          {/* Delete */}
          <button
            type="button" onClick={handleDelete} disabled={isLoading}
            style={{ width: '100%', padding: '5px 12px', borderRadius: '7px', fontSize: '12px', fontFamily: MANROPE, fontWeight: confirmDelete ? 600 : 400, background: confirmDelete ? `${C.red}18` : 'transparent', border: `1px solid ${confirmDelete ? C.red : 'transparent'}`, color: confirmDelete ? C.red : C.text4, cursor: isLoading ? 'not-allowed' : 'pointer', transition: 'all 0.16s', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onMouseEnter={(e) => { if (!confirmDelete) { e.currentTarget.style.color = C.red; e.currentTarget.style.background = `${C.red}0f`; } }}
            onMouseLeave={(e) => { if (!confirmDelete) { e.currentTarget.style.color = C.text4; e.currentTarget.style.background = 'transparent'; } }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="13" height="13">
              <path d="M2 4h10M5 4V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5V4M5.5 6.5v4M8.5 6.5v4M3 4l.7 7.3A.7.7 0 0 0 4.4 12h5.2a.7.7 0 0 0 .7-.7L11 4" />
            </svg>
            {confirmDelete ? '¿Confirmar? Esta acción es permanente' : 'Eliminar espacio'}
          </button>
          {confirmDelete && (
            <button
              type="button" onClick={() => setConfirmDelete(false)}
              style={{ width: '100%', padding: '4px', background: 'transparent', border: 'none', fontSize: '11.5px', color: C.text4, cursor: 'pointer', fontFamily: MANROPE }}
              onMouseEnter={(e) => { e.currentTarget.style.color = C.text2; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = C.text4; }}
            >
              Cancelar eliminación
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
