'use client';

import { useEffect, useState } from 'react';
import { Palette, X } from 'lucide-react';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { useProjectStore, type Project } from '@/stores/projectStore';

const COLORS = ['#7452A6', '#8262B2', '#6676AD', '#4782A5', '#548B73', '#A88353', '#A97556', '#B45C72'];

export function ProjectAppearanceModal({ project, onClose }: { project: Project; onClose: () => void }) {
  const updateProject = useProjectStore(state => state.updateProject);
  const [icon, setIcon] = useState(project.icon || 'Folder');
  const [color, setColor] = useState(project.color || '#7452A6');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !saving) onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose, saving]);

  async function save() {
    setSaving(true);
    setError('');
    try {
      await updateProject(project.id, { icon, color });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo actualizar la apariencia.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !saving) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 55, display: 'grid', placeItems: 'center', padding: 16, background: 'rgba(18,12,25,0.54)', backdropFilter: 'blur(4px)' }}>
      <div role="dialog" aria-modal="true" aria-label="Personalizar proyecto" style={{ width: 'min(100%, 430px)', maxHeight: 'min(680px, calc(100dvh - 32px))', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: '1px solid var(--c-border2)', borderRadius: 16, background: 'var(--c-surface)', boxShadow: '0 25px 75px rgba(18,12,25,0.25)', color: 'var(--c-text)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '17px 20px', borderBottom: '1px solid var(--c-border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 32, height: 32, borderRadius: 9, background: 'color-mix(in srgb, var(--c-accent-text) 12%, var(--c-surface))', color: 'var(--c-accent-text)' }}><Palette size={17} /></span>
            <div>
              <h2 style={{ margin: 0, font: "700 14px 'Sora', system-ui, sans-serif" }}>Personalizar proyecto</h2>
              <p style={{ margin: '3px 0 0', color: 'var(--c-text3)', fontSize: 11 }}>Elige cómo se verá en Aether.</p>
            </div>
          </div>
          <button type="button" aria-label="Cerrar" onClick={onClose} disabled={saving} style={{ display: 'grid', placeItems: 'center', width: 28, height: 28, border: 0, borderRadius: 7, background: 'transparent', color: 'var(--c-text3)', cursor: 'pointer' }}><X size={17} /></button>
        </div>

        <div style={{ overflowY: 'auto', padding: 20, display: 'grid', gap: 22 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 13, padding: 13, border: '1px solid var(--c-border)', borderRadius: 11, background: 'var(--c-surface2)' }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 47, height: 47, flex: 'none', borderRadius: 13, background: `${color}20`, border: `1px solid ${color}55`, color }}><WorkspaceIcon icon={icon} size={24} /></span>
            <div style={{ minWidth: 0 }}>
              <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', font: "700 13px 'Sora', system-ui, sans-serif" }}>{project.name}</div>
              <div style={{ marginTop: 4, color: 'var(--c-text3)', fontSize: 11 }}>Vista previa</div>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 10, color: 'var(--c-text2)', font: "700 11px 'Sora', system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '.06em' }}>Color</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 11 }}>
              {COLORS.map(option => <button key={option} type="button" aria-label={`Elegir color ${option}`} aria-pressed={color.toLowerCase() === option.toLowerCase()} onClick={() => setColor(option)} style={{ width: 30, height: 30, border: '2px solid var(--c-surface)', borderRadius: 10, background: option, boxShadow: color.toLowerCase() === option.toLowerCase() ? `0 0 0 2px ${option}` : '0 0 0 1px var(--c-border2)', cursor: 'pointer', transition: 'transform 150ms ease, box-shadow 150ms ease', transform: color.toLowerCase() === option.toLowerCase() ? 'scale(1.08)' : undefined }} />)}
              <label title="Elegir otro color" style={{ position: 'relative', display: 'grid', placeItems: 'center', width: 31, height: 31, border: '1px dashed var(--c-border2)', borderRadius: 10, color: 'var(--c-text2)', cursor: 'pointer', overflow: 'hidden' }}>
                <Palette size={15} aria-hidden="true" />
                <input type="color" aria-label="Otro color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : '#7452A6'} onChange={event => setColor(event.target.value)} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }} />
              </label>
            </div>
          </div>

          <div>
            <div style={{ marginBottom: 10, color: 'var(--c-text2)', font: "700 11px 'Sora', system-ui, sans-serif", textTransform: 'uppercase', letterSpacing: '.06em' }}>Icono</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(37px, 1fr))', gap: 6 }}>
              {WORKSPACE_ICON_KEYS.map(option => <button key={option} type="button" title={option} aria-label={`Icono ${option}`} aria-pressed={icon === option} onClick={() => setIcon(option)} style={{ display: 'grid', placeItems: 'center', height: 37, borderRadius: 9, border: icon === option ? `1px solid ${color}88` : '1px solid var(--c-border)', background: icon === option ? `${color}1c` : 'var(--c-surface2)', color: icon === option ? color : 'var(--c-text3)', cursor: 'pointer', transition: 'background 150ms ease, color 150ms ease, border-color 150ms ease' }}><WorkspaceIcon icon={option} size={18} /></button>)}
            </div>
          </div>
          {error && <div role="alert" style={{ padding: 10, borderRadius: 8, background: 'rgba(180,92,114,.1)', color: '#B45C72', fontSize: 12 }}>{error}</div>}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: '13px 20px', borderTop: '1px solid var(--c-border)' }}>
          <button type="button" onClick={onClose} disabled={saving} style={{ padding: '9px 13px', border: '1px solid var(--c-border2)', borderRadius: 8, background: 'var(--c-surface2)', color: 'var(--c-text2)', cursor: 'pointer' }}>Cancelar</button>
          <button type="button" onClick={save} disabled={saving} style={{ padding: '9px 16px', border: 0, borderRadius: 8, background: 'var(--c-accent)', color: '#fff', fontWeight: 700, cursor: saving ? 'wait' : 'pointer', opacity: saving ? .7 : 1 }}>{saving ? 'Guardando…' : 'Guardar cambios'}</button>
        </div>
      </div>
    </div>
  );
}
