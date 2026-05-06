// apps/web/src/components/CreateWorkspaceModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // teal
  '#f97316', // orange
  '#ef4444', // red
  '#a855f7', // purple
  '#6b7280', // gray
  '#f59e0b', // amber
  '#ec4899', // pink
];

type Visibility = 'private' | 'team' | 'public';

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const t = useT();
  const { createWorkspace, isLoading } = useWorkspaceStore();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(WORKSPACE_ICON_KEYS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [visibility, setVisibility]   = useState<Visibility>('private');
  const [error, setError]             = useState('');

  // ── Animation state ────────────────────────────────────────────────────────
  const [animIn, setAnimIn] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // small rAF delay so the initial state renders before transition kicks in
      const id = requestAnimationFrame(() => setAnimIn(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimIn(false);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError(t.create_ws_validation_name); return; }
    try {
      await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
      });
      handleClose();
    } catch (err: any) {
      setError(err.message || t.create_ws_error);
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setAnimIn(false);
    closeTimerRef.current = setTimeout(() => {
      setName(''); setDescription(''); setSelectedIcon(WORKSPACE_ICON_KEYS[0]);
      setSelectedColor(COLORS[0]); setVisibility('private'); setError('');
      onClose();
    }, 160);
  };

  // clean up timer on unmount
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  if (!isOpen) return null;

  const visibilityOptions: { id: Visibility; label: string; desc: string }[] = [
    { id: 'private', label: t.ws_settings_visibility_private,       desc: t.ws_settings_visibility_private_desc },
    { id: 'team',    label: 'Equipo',                                desc: 'Visible para tu organización' },
    { id: 'public',  label: t.ws_settings_visibility_public,        desc: t.ws_settings_visibility_public_desc },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: `rgba(0,0,0,${animIn ? 0.65 : 0})`,
        backdropFilter: 'blur(4px)',
        transition: 'background 0.16s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        className="w-full flex flex-col rounded-[12px] overflow-hidden"
        style={{
          maxWidth: '480px',
          maxHeight: '92vh',
          background: C.bg2,
          border: `1px solid ${C.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease',
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}` }}
        >
          <span className="text-[15px] font-semibold" style={{ color: C.text }}>{t.create_ws_title}</span>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="flex items-center justify-center rounded-[6px] transition-colors"
            style={{ width: '26px', height: '26px', color: C.text3 }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text2); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="12" height="12">
              <path d="M1 1l10 10M11 1L1 11" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '20px' }}>
          <form id="ws-form" onSubmit={handleSubmit}>

            {/* ── Live preview ─────────────────────────────────────────── */}
            <div
              className="flex items-center gap-3 rounded-[8px] mb-5"
              style={{
                padding: '14px 16px',
                background: C.surface,
                border: `1px solid ${C.border}`,
              }}
            >
              <div
                className="flex-shrink-0 flex items-center justify-center rounded-[8px]"
                style={{
                  width: '44px', height: '44px',
                  background: `linear-gradient(135deg, ${selectedColor}cc, ${selectedColor}77)`,
                }}
              >
                <WorkspaceIcon icon={selectedIcon} className="w-5 h-5" style={{ color: '#fff' } as any} />
              </div>
              <div className="min-w-0">
                <div
                  className="text-[14px] font-semibold truncate"
                  style={{ color: name ? C.text : C.text4 }}
                >
                  {name || 'Nombre del workspace'}
                </div>
                <div className="text-[12px] truncate" style={{ color: C.text4 }}>
                  {description || 'Descripción opcional'}
                </div>
              </div>
            </div>

            {/* ── Nombre ───────────────────────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: C.text2 }}>
                {t.create_ws_label_name} <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t.create_ws_placeholder_name}
                disabled={isLoading}
                maxLength={255}
                className="w-full rounded-[7px] text-[13px] outline-none transition-colors"
                style={{
                  padding: '9px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
              />
            </div>

            {/* ── Descripción ──────────────────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: C.text2 }}>
                {t.create_ws_label_description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.create_ws_placeholder_description}
                disabled={isLoading}
                maxLength={1000}
                rows={2}
                className="w-full rounded-[7px] text-[13px] outline-none transition-colors resize-none"
                style={{
                  padding: '9px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
              />
            </div>

            {/* ── Color del icono ──────────────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-2" style={{ color: C.text2 }}>
                {t.create_ws_label_color}
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={isLoading}
                    className="flex-shrink-0 rounded-[8px] transition-all"
                    style={{
                      width: '36px', height: '36px',
                      background: color,
                      outline: selectedColor === color ? `2px solid ${C.text}` : '2px solid transparent',
                      outlineOffset: '2px',
                      transform: selectedColor === color ? 'scale(1.08)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* ── Icono ────────────────────────────────────────────────── */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-2" style={{ color: C.text2 }}>
                {t.create_ws_label_icon}
              </label>
              <div
                className="rounded-[7px] overflow-y-auto"
                style={{
                  maxHeight: '76px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  padding: '4px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(32px, 1fr))',
                  gap: '2px',
                }}
              >
                {WORKSPACE_ICON_KEYS.map((key) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedIcon(key)}
                    disabled={isLoading}
                    title={key}
                    className="flex items-center justify-center rounded-[5px] transition-colors"
                    style={{
                      height: '32px',
                      color: selectedIcon === key ? '#fff' : C.text3,
                      background: selectedIcon === key ? selectedColor : 'transparent',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedIcon !== key) {
                        (e.currentTarget.style.background = C.hover);
                        (e.currentTarget.style.color = C.text2);
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedIcon !== key) {
                        (e.currentTarget.style.background = 'transparent');
                        (e.currentTarget.style.color = C.text3);
                      }
                    }}
                  >
                    <WorkspaceIcon icon={key} className="w-[15px] h-[15px]" />
                  </button>
                ))}
              </div>
            </div>

            {/* ── Visibilidad ──────────────────────────────────────────── */}
            <div className="mb-2">
              <label className="block text-[12px] font-medium mb-2" style={{ color: C.text2 }}>
                {t.ws_settings_visibility_title}
              </label>
              <div className="grid grid-cols-3 gap-2">
                {visibilityOptions.map((opt) => {
                  const active = visibility === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setVisibility(opt.id)}
                      disabled={isLoading}
                      className="flex flex-col items-start rounded-[7px] text-left transition-all"
                      style={{
                        padding: '10px 11px',
                        background: active ? `${C.accent}18` : C.surface,
                        border: `1px solid ${active ? C.accent : C.border}`,
                      }}
                    >
                      <div className="flex items-center gap-1.5 mb-1">
                        <div
                          className="rounded-full flex-shrink-0"
                          style={{
                            width: '7px', height: '7px',
                            background: active ? C.accent : C.text4,
                          }}
                        />
                        <span
                          className="text-[12px] font-semibold"
                          style={{ color: active ? C.text : C.text2 }}
                        >
                          {opt.label}
                        </span>
                      </div>
                      <span className="text-[11px] leading-[1.3]" style={{ color: C.text4 }}>
                        {opt.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Error ────────────────────────────────────────────────── */}
            {error && (
              <div
                className="rounded-[7px] text-[12.5px] mt-3"
                style={{ padding: '8px 12px', background: `${C.red}15`, border: `1px solid ${C.red}40`, color: C.red }}
              >
                {error}
              </div>
            )}
          </form>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0"
          style={{ padding: '12px 20px 14px', borderTop: `1px solid ${C.border}`, background: C.bg }}
        >
          <p className="text-[11.5px] mb-3" style={{ color: C.text4 }}>
            Podrás invitar a miembros una vez creado.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="flex-1 rounded-[7px] text-[13px] font-medium transition-colors"
              style={{
                padding: '8px 0',
                background: C.hover,
                border: `1px solid ${C.border2}`,
                color: C.text2,
              }}
              onMouseEnter={(e) => { (e.currentTarget.style.borderColor = C.text4); (e.currentTarget.style.color = C.text); }}
              onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); }}
            >
              {t.create_ws_btn_cancel}
            </button>
            <button
              type="submit"
              form="ws-form"
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-medium text-white transition-colors"
              style={{ padding: '8px 0', background: C.accent }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#2563eb')}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                  </svg>
                  {t.create_ws_btn_creating}
                </>
              ) : (
                <>{t.create_ws_btn_create}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
