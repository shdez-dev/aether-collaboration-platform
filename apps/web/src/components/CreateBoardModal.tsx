// apps/web/src/components/CreateBoardModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useBoardStore } from '@/stores/boardStore';
import { useProjectStore } from '@/stores/projectStore';
import { LayoutGrid, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n';

const C = {
  bg:      '#0b0d10',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  red:     '#ef4444',
};

const COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#ef4444',
  '#a855f7', '#6b7280', '#f59e0b', '#ec4899',
];

interface CreateBoardModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (boardId: string) => void;
  defaultProjectId?: string;
}

export default function CreateBoardModal({
  workspaceId,
  isOpen,
  onClose,
  onSuccess,
  defaultProjectId,
}: CreateBoardModalProps) {
  const t = useT();
  const { createBoard, isLoading } = useBoardStore();
  const { fetchProjectsByWorkspace } = useProjectStore();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState(COLORS[0]!);
  const [error, setError]             = useState('');
  const [projects, setProjects]       = useState<{ id: string; name: string; color?: string }[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(defaultProjectId ?? '');

  // ── Animation ──────────────────────────────────────────────────────────────
  const [animIn, setAnimIn] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      const id = requestAnimationFrame(() => setAnimIn(true));
      fetchProjectsByWorkspace(workspaceId).then((projs) =>
        setProjects((projs ?? []).map((p) => ({ id: p.id, name: p.name, color: p.color ?? undefined })))
      );
      setSelectedProjectId(defaultProjectId ?? '');
      return () => cancelAnimationFrame(id);
    } else {
      setAnimIn(false);
    }
  }, [isOpen, workspaceId, defaultProjectId]);

  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  // ESC to close
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && isOpen && !isLoading) handleClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, isLoading]);

  const handleClose = () => {
    if (isLoading) return;
    setAnimIn(false);
    closeTimerRef.current = setTimeout(() => {
      setName(''); setDescription(''); setSelectedColor(COLORS[0]!); setError(''); setSelectedProjectId(defaultProjectId ?? '');
      onClose();
    }, 160);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setError(t.create_board_validation_name); return; }
    try {
      const board = await createBoard(workspaceId, {
        name: name.trim(),
        description: description.trim() || undefined,
        color: selectedColor,
        projectId: selectedProjectId || undefined,
      });
      handleClose();
      if (onSuccess) onSuccess(board.id);
    } catch (err: any) {
      setError(err.message || t.create_board_error);
    }
  };

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
          maxWidth: '420px',
          background: '#13161b',
          border: `1px solid ${C.border}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── Header ────────────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between flex-shrink-0"
          style={{ padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex items-center gap-2.5">
            <div
              className="flex items-center justify-center rounded-[7px]"
              style={{ width: '28px', height: '28px', background: `${C.accent}18`, border: `1px solid ${C.accent}33` }}
            >
              <LayoutGrid className="w-3.5 h-3.5" style={{ color: C.accent }} />
            </div>
            <span className="text-[15px] font-semibold" style={{ color: C.text }}>{t.create_board_title}</span>
          </div>
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

        {/* ── Body ──────────────────────────────────────────────────── */}
        <div style={{ padding: '20px' }}>
          <form id="board-form" onSubmit={handleSubmit}>

            {/* Live preview — card style */}
            <div
              className="rounded-[10px] overflow-hidden mb-5"
              style={{ border: `1px solid ${selectedColor}44` }}
            >
              {/* Card header con gradiente + dot pattern */}
              <div style={{
                position: 'relative',
                padding: '12px 14px 11px',
                background: `linear-gradient(135deg, ${selectedColor}33 0%, ${selectedColor}18 50%, ${selectedColor}08 100%)`,
                borderBottom: `1px solid ${selectedColor}22`,
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute', inset: 0, opacity: 0.35,
                  backgroundImage: `radial-gradient(circle, ${selectedColor}55 1px, transparent 1px)`,
                  backgroundSize: '18px 18px',
                }} />
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '10px', color: C.text4, fontWeight: 500 }}>
                    Board · <span style={{ color: '#10b981' }}>activo</span>
                  </span>
                  <span style={{
                    fontSize: '9.5px', fontWeight: 700, letterSpacing: '0.06em',
                    padding: '2px 7px', borderRadius: '4px',
                    background: 'rgba(0,0,0,0.45)',
                    color: C.text3,
                    border: `1px solid ${C.border2}`,
                  }}>
                    KANBAN
                  </span>
                </div>
              </div>

              {/* Card body preview */}
              <div style={{ padding: '12px 14px', background: C.surface }}>
                <div className="text-[14px] font-bold truncate mb-1" style={{ color: name ? C.text : C.text4 }}>
                  {name || 'Nombre del board'}
                </div>
                <div className="text-[11.5px] truncate mb-3" style={{ color: C.text3 }}>
                  {description || 'Descripción opcional'}
                </div>
                {/* Progress bar preview */}
                <div style={{ height: '4px', background: C.border2, borderRadius: '3px', marginBottom: '7px' }}>
                  <div style={{ height: '100%', width: '0%', background: '#10b981', borderRadius: '3px' }} />
                </div>
                <div className="flex items-center justify-between">
                  <span style={{ fontSize: '11px', color: C.text4 }}>0% completado</span>
                  <span style={{ fontSize: '11px', color: C.text4 }}>0 tareas</span>
                </div>
              </div>
            </div>

            {/* Nombre */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: C.text2 }}>
                {t.create_board_label_name} <span style={{ color: C.red }}>*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); setError(''); }}
                placeholder={t.create_board_placeholder_name}
                disabled={isLoading}
                maxLength={255}
                autoFocus
                className="w-full rounded-[7px] text-[13px] outline-none transition-colors"
                style={{
                  padding: '9px 12px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = error ? C.red : C.border)}
              />
            </div>

            {/* Descripción */}
            <div className="mb-4">
              <label className="block text-[12px] font-medium mb-1.5" style={{ color: C.text2 }}>
                {t.create_board_label_description}
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t.create_board_placeholder_description}
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
              <p className="text-[10.5px] mt-1 text-right" style={{ color: C.text4 }}>
                {description.length} / 1000
              </p>
            </div>

            {/* Proyecto */}
            {projects.length > 0 && (
              <div className="mb-4">
                <label className="block text-[12px] font-medium mb-1.5" style={{ color: C.text2 }}>
                  Proyecto <span style={{ color: C.text4, fontWeight: 400 }}>(opcional)</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  disabled={isLoading}
                  className="w-full rounded-[7px] text-[13px] outline-none"
                  style={{ padding: '9px 12px', background: C.surface, border: `1px solid ${C.border}`, color: selectedProjectId ? C.text : C.text3 }}
                  onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                  onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
                >
                  <option value="">Sin proyecto</option>{/* No specific i18n key for this option */}
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Color */}
            <div className="mb-2">
              <label className="block text-[12px] font-medium mb-2" style={{ color: C.text2 }}>
                Color
              </label>
              <div className="flex gap-2 flex-wrap">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    disabled={isLoading}
                    className="flex-shrink-0 rounded-[7px] transition-all"
                    style={{
                      width: '32px', height: '32px',
                      background: color,
                      outline: selectedColor === color ? `2px solid ${C.text}` : '2px solid transparent',
                      outlineOffset: '2px',
                      transform: selectedColor === color ? 'scale(1.1)' : 'scale(1)',
                    }}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
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

        {/* ── Footer ────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0 flex items-center gap-2"
          style={{ padding: '12px 20px 16px', borderTop: `1px solid ${C.border}`, background: '#111418' }}
        >
          <button
            type="button"
            onClick={handleClose}
            disabled={isLoading}
            className="flex-1 rounded-[7px] text-[13px] font-medium transition-colors"
            style={{ padding: '8px 0', background: C.hover, border: `1px solid ${C.border2}`, color: C.text2 }}
            onMouseEnter={(e) => { (e.currentTarget.style.borderColor = C.text4); (e.currentTarget.style.color = C.text); }}
            onMouseLeave={(e) => { (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); }}
          >
            {t.btn_cancel}
          </button>
          <button
            type="submit"
            form="board-form"
            disabled={isLoading || !name.trim()}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-[7px] text-[13px] font-medium text-white transition-colors"
            style={{ padding: '8px 0', background: C.accent, opacity: !name.trim() ? 0.5 : 1 }}
            onMouseEnter={(e) => { if (name.trim() && !isLoading) (e.currentTarget.style.background = '#2563eb'); }}
            onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
                  <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                </svg>
                {t.btn_creating}
              </>
            ) : (
              <><Plus className="w-3.5 h-3.5" /> {t.create_board_title}</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
