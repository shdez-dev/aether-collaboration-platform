// apps/web/src/components/CreateWorkspaceModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

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

type WorkspaceTemplateId = 'personal' | 'team' | 'institutional' | 'marketing' | 'construction';

const WORKSPACE_TEMPLATES: Array<{
  id: WorkspaceTemplateId;
  name: string;
  description: string;
  badge: string;
  icon: string;
  color: string;
  checks: string[];
}> = [
  {
    id: 'team',
    name: 'Equipo de trabajo',
    description: 'Para coordinar iniciativas con responsables, tablero y siguiente paso claro.',
    badge: 'Balanceado',
    icon: 'Users',
    color: '#10b981',
    checks: ['Problema', 'Tablero', 'Siguiente paso'],
  },
  {
    id: 'personal',
    name: 'Uso personal',
    description: 'Menos friccion para ordenar ideas, decisiones y tareas propias.',
    badge: 'Ligero',
    icon: 'Target',
    color: '#3b82f6',
    checks: ['Responsable', 'Siguiente paso'],
  },
  {
    id: 'institutional',
    name: 'Institucion / programa',
    description: 'Mayor trazabilidad para formalizar postulaciones, equipos, hitos y cobertura.',
    badge: 'Rigor alto',
    icon: 'Building2',
    color: '#f97316',
    checks: ['Equipo', 'Fechas', 'Hito'],
  },
  {
    id: 'marketing',
    name: 'Marketing y contenidos',
    description: 'Pensado para briefs, campañas, aprobaciones y produccion coordinada.',
    badge: 'Creativo',
    icon: 'Megaphone',
    color: '#f59e0b',
    checks: ['Brief', 'Fechas', 'Produccion'],
  },
  {
    id: 'construction',
    name: 'Construccion / operaciones',
    description: 'Mas estructura para dependencias, planificacion, equipos y ruta critica.',
    badge: 'Operativo',
    icon: 'Building2',
    color: '#6b7280',
    checks: ['Equipo', 'Plan', 'Hito'],
  },
];

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
  const [selectedTemplateId, setSelectedTemplateId] = useState<WorkspaceTemplateId>('team');
  const [error, setError]             = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const selectedTemplate = WORKSPACE_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? WORKSPACE_TEMPLATES[0];

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
    if (!name.trim()) { setNameTouched(true); return; }
    try {
      await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
        workspaceTemplateId: selectedTemplateId,
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
      setSelectedColor(COLORS[0]); setSelectedTemplateId('team'); setError(''); setNameTouched(false);
      onClose();
    }, 160);
  };

  // clean up timer on unmount
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  if (!isOpen) return null;

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
          maxWidth: '720px',
          maxHeight: '92vh',
          background: C.bg2,
          border: `1px solid ${C.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease',
          fontFamily: MANROPE,
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}` }}
        >
          <span style={{ fontSize: '15px', fontWeight: 600, color: C.text, fontFamily: SORA }}>{t.create_ws_title}</span>
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
                <div style={{ fontSize: '14px', fontWeight: 600, fontFamily: SORA, color: name ? C.text : C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {name || 'Nombre del workspace'}
                </div>
                <div style={{ fontSize: '12px', fontFamily: MANROPE, color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {selectedTemplate.name} · {description || 'Descripcion opcional'}
                </div>
              </div>
            </div>

            {/* ── Plantilla ────────────────────────────────────────────── */}
            <div className="mb-5">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
                Tipo de workspace
              </label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(205px, 1fr))', gap: '10px' }}>
                {WORKSPACE_TEMPLATES.map((template) => {
                  const active = selectedTemplateId === template.id;
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => {
                        setSelectedTemplateId(template.id);
                        setSelectedIcon(template.icon);
                        setSelectedColor(template.color);
                      }}
                      disabled={isLoading}
                      style={{
                        minHeight: '126px',
                        borderRadius: '9px',
                        border: `1px solid ${active ? template.color : C.border}`,
                        background: active ? `${template.color}14` : C.surface,
                        padding: '12px',
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        textAlign: 'left',
                        transition: 'border-color 0.12s, background 0.12s, transform 0.12s',
                      }}
                      onMouseEnter={(e) => { if (!active) e.currentTarget.style.borderColor = C.border2; }}
                      onMouseLeave={(e) => { if (!active) e.currentTarget.style.borderColor = C.border; }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', minWidth: 0 }}>
                          <span style={{ width: '28px', height: '28px', borderRadius: '8px', background: `${template.color}22`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <WorkspaceIcon icon={template.icon} className="w-[14px] h-[14px]" style={{ color: template.color } as any} />
                          </span>
                          <span style={{ fontSize: '12.5px', fontWeight: 700, color: C.text, fontFamily: SORA, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {template.name}
                          </span>
                        </div>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: active ? template.color : C.text4, border: `1px solid ${active ? `${template.color}55` : C.border}`, borderRadius: '999px', padding: '3px 7px', flexShrink: 0 }}>
                          {template.badge}
                        </span>
                      </div>
                      <p style={{ margin: '10px 0 0', fontSize: '11.5px', color: C.text4, lineHeight: 1.45 }}>
                        {template.description}
                      </p>
                      <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginTop: '10px' }}>
                        {template.checks.map((check) => (
                          <span key={check} style={{ fontSize: '10.5px', color: active ? C.text2 : C.text4, background: 'rgba(255,255,255,0.04)', border: `1px solid ${C.border}`, borderRadius: '999px', padding: '4px 7px' }}>
                            {check}
                          </span>
                        ))}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ── Nombre ───────────────────────────────────────────────── */}
            {(() => {
              const nameError = nameTouched && !name.trim();
              return (
                <div className="mb-4">
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '7px' }}>
                    {t.create_ws_label_name} <span style={{ color: C.red }}>*</span>
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameTouched(false); }}
                    placeholder={t.create_ws_placeholder_name}
                    disabled={isLoading}
                    maxLength={255}
                    className="w-full rounded-[7px] outline-none transition-colors"
                    style={{
                      padding: '9px 12px',
                      background: C.surface,
                      border: `1px solid ${nameError ? C.red : C.border}`,
                      color: C.text,
                      fontSize: '13px',
                      fontFamily: MANROPE,
                    }}
                    onFocus={(e) => (e.currentTarget.style.borderColor = nameError ? C.red : C.accent)}
                    onBlur={(e) => { setNameTouched(true); e.currentTarget.style.borderColor = !e.currentTarget.value.trim() ? C.red : C.border; }}
                  />
                  {nameError && (
                    <p className="text-[11.5px] mt-1.5" style={{ color: C.red }}>
                      {t.create_ws_validation_name}
                    </p>
                  )}
                </div>
              );
            })()}

            {/* ── Descripción ──────────────────────────────────────────── */}
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '7px' }}>
                {t.create_ws_label_description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.create_ws_placeholder_description}
                disabled={isLoading}
                maxLength={1000}
                rows={2}
                className="w-full rounded-[7px] outline-none transition-colors resize-none"
                style={{
                  padding: '9px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: '13px',
                  fontFamily: MANROPE,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
              />
            </div>

            {/* ── Color del icono ──────────────────────────────────────── */}
            <div className="mb-4">
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
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
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
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
          <p style={{ fontSize: '11.5px', marginBottom: '12px', color: C.text4, fontFamily: MANROPE }}>
            Podrás invitar a miembros una vez creado.
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              style={{
                flex: 1, padding: '8px 0', borderRadius: '7px',
                fontSize: '13px', fontWeight: 500, fontFamily: MANROPE,
                background: C.hover, border: `1px solid ${C.border2}`, color: C.text2,
                cursor: 'pointer', transition: 'all 0.12s',
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
              style={{
                flex: 1, padding: '8px 0', borderRadius: '7px',
                fontSize: '13px', fontWeight: 600, fontFamily: SORA,
                background: C.accent, border: 'none', color: '#fff',
                cursor: isLoading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#d94e18')}
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
