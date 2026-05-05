// apps/web/src/components/CreateProjectModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { X, Check, ChevronDown, LayoutDashboard } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

const COLORS = [
  '#3b82f6', '#10b981', '#f97316', '#ef4444',
  '#a855f7', '#6b7280', '#f59e0b', '#ec4899',
];

interface BoardOption {
  id: string;
  name: string;
  description?: string;
}

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
  defaultWorkspaceId?: string;
}

export default function CreateProjectModal({ onClose, onCreated, defaultWorkspaceId }: CreateProjectModalProps) {
  const t = useT();
  const { createProject } = useProjectStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(WORKSPACE_ICON_KEYS[3]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedWsId, setSelectedWsId] = useState(defaultWorkspaceId ?? '');
  const [selectedBoardIds, setSelectedBoardIds] = useState<string[]>([]);
  const [boardOptions, setBoardOptions] = useState<BoardOption[]>([]);
  const [startDate, setStartDate]     = useState('');
  const [endDate, setEndDate]         = useState('');
  const [isLoading, setIsLoading]     = useState(false);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [error, setError]             = useState('');
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showWsPicker, setShowWsPicker]     = useState(false);
  const [showBoardPicker, setShowBoardPicker] = useState(false);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Cuando cambia la workspace seleccionada, carga sus boards
  useEffect(() => {
    if (!selectedWsId) { setBoardOptions([]); setSelectedBoardIds([]); return; }
    setLoadingBoards(true);
    setSelectedBoardIds([]);
    apiService
      .get<{ boards: BoardOption[] }>(`/api/workspaces/${selectedWsId}/boards`, true)
      .then((res) => {
        if (res.success && res.data) setBoardOptions(res.data.boards ?? []);
        else setBoardOptions([]);
      })
      .catch(() => setBoardOptions([]))
      .finally(() => setLoadingBoards(false));
  }, [selectedWsId]);

  const handleSubmit = async () => {
    if (!name.trim())    { setError(t.create_ws_validation_name); return; }
    if (!selectedWsId)   { setError('Selecciona una workspace'); return; }
    setError('');
    setIsLoading(true);
    try {
      const project = await createProject({
        workspaceId: selectedWsId,
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        boardIds: selectedBoardIds,
      });
      onCreated(project);
    } catch (e: any) {
      setError(e.message || 'Error al crear proyecto');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleBoard = (id: string) =>
    setSelectedBoardIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === overlayRef.current) onClose(); }}
    >
      <div
        className="flex flex-col rounded-[12px] overflow-hidden"
        style={{
          width: '480px',
          maxHeight: '88vh',
          background: C.surface,
          border: `1px solid ${C.border2}`,
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between" style={{ padding: '16px 20px', borderBottom: `1px solid ${C.border}` }}>
          <span className="text-[14px] font-semibold" style={{ color: C.text }}>{t.projects_btn_create}</span>
          <button
            onClick={onClose}
            className="flex items-center justify-center rounded-[6px] transition-colors"
            style={{ width: '26px', height: '26px', color: C.text3 }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex flex-col gap-5 overflow-y-auto" style={{ padding: '20px' }}>

          {/* Icono + Color */}
          <div className="flex items-start gap-4">
            <div className="flex flex-col gap-1.5 relative">
              <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.create_ws_label_icon}</span>
              <button
                onClick={() => setShowIconPicker((v) => !v)}
                className="flex items-center justify-center rounded-[8px] transition-colors"
                style={{
                  width: '48px', height: '48px',
                  background: `${selectedColor}22`,
                  border: `2px solid ${selectedColor}66`,
                }}
              >
                <WorkspaceIcon icon={selectedIcon} style={{ width: '22px', height: '22px', color: selectedColor }} />
              </button>
              {showIconPicker && (
                <div
                  className="absolute rounded-[8px] overflow-y-auto"
                  style={{
                    top: '72px', left: 0,
                    width: '220px',
                    maxHeight: '180px',
                    background: C.bg2,
                    border: `1px solid ${C.border2}`,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    zIndex: 10,
                    padding: '8px',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    gap: '4px',
                  }}
                >
                  {WORKSPACE_ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      onClick={() => { setSelectedIcon(key); setShowIconPicker(false); }}
                      className="flex items-center justify-center rounded-[6px] transition-colors"
                      style={{
                        width: '28px', height: '28px',
                        background: selectedIcon === key ? `${selectedColor}33` : 'transparent',
                        border: selectedIcon === key ? `1px solid ${selectedColor}66` : '1px solid transparent',
                      }}
                      title={key}
                    >
                      <WorkspaceIcon icon={key} style={{ width: '14px', height: '14px', color: selectedIcon === key ? selectedColor : C.text3 }} />
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="flex flex-col gap-1.5 flex-1">
              <span className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.create_ws_label_color}</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className="rounded-full flex items-center justify-center transition-transform"
                    style={{
                      width: '24px', height: '24px',
                      background: color,
                      border: selectedColor === color ? `2px solid ${C.text}` : '2px solid transparent',
                      transform: selectedColor === color ? 'scale(1.15)' : 'scale(1)',
                    }}
                  >
                    {selectedColor === color && <Check className="w-3 h-3" style={{ color: '#fff' }} />}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Nombre */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.projects_config_name} *</label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
              placeholder={t.projects_config_name}
              className="text-[13px] rounded-[8px] outline-none transition-colors"
              style={{
                padding: '9px 12px',
                background: C.bg2,
                border: `1px solid ${error && !name.trim() ? C.red : C.border2}`,
                color: C.text,
              }}
            />
          </div>

          {/* Descripción */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.projects_config_desc}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t.projects_config_desc}
              rows={2}
              className="text-[13px] rounded-[8px] outline-none resize-none"
              style={{
                padding: '9px 12px',
                background: C.bg2,
                border: `1px solid ${C.border2}`,
                color: C.text,
              }}
            />
          </div>

          {/* Workspace (obligatoria) */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>
              Workspace *{/* no specific key */}
            </label>
            <button
              onClick={() => { setShowWsPicker((v) => !v); setShowBoardPicker(false); }}
              className="flex items-center justify-between text-[12.5px] rounded-[8px] transition-colors"
              style={{
                padding: '9px 12px',
                background: C.bg2,
                border: `1px solid ${error && !selectedWsId ? C.red : C.border2}`,
                color: selectedWs ? C.text : C.text3,
              }}
            >
              {selectedWs ? (
                <span className="flex items-center gap-2">
                  <div
                    className="flex items-center justify-center rounded-[4px]"
                    style={{ width: '18px', height: '18px', background: `${selectedWs.color ?? C.accent}22` }}
                  >
                    <WorkspaceIcon icon={selectedWs.icon ?? 'Folder'} style={{ width: '10px', height: '10px', color: selectedWs.color ?? C.accent }} />
                  </div>
                  {selectedWs.name}
                </span>
              ) : (
                <span>{t.workspaces_title}...</span>
              )}
              <ChevronDown className="w-3.5 h-3.5" style={{ color: C.text4 }} />
            </button>

            {showWsPicker && workspaces.length > 0 && (
              <div
                className="flex flex-col rounded-[8px] overflow-hidden overflow-y-auto"
                style={{ maxHeight: '150px', background: C.bg2, border: `1px solid ${C.border2}` }}
              >
                {workspaces.filter((w) => !w.archived).map((ws) => {
                  const sel = ws.id === selectedWsId;
                  return (
                    <button
                      key={ws.id}
                      onClick={() => { setSelectedWsId(ws.id); setShowWsPicker(false); }}
                      className="flex items-center gap-2 text-left transition-colors"
                      style={{ padding: '8px 12px', background: sel ? `${C.accent}12` : 'transparent' }}
                      onMouseEnter={(e) => { if (!sel) (e.currentTarget.style.background = C.hover); }}
                      onMouseLeave={(e) => { (e.currentTarget.style.background = sel ? `${C.accent}12` : 'transparent'); }}
                    >
                      <div
                        className="flex items-center justify-center rounded-[5px] flex-shrink-0"
                        style={{ width: '22px', height: '22px', background: `${ws.color ?? C.accent}22` }}
                      >
                        <WorkspaceIcon icon={ws.icon ?? 'Folder'} style={{ width: '11px', height: '11px', color: ws.color ?? C.accent }} />
                      </div>
                      <span className="text-[12px] flex-1 truncate" style={{ color: sel ? C.text : C.text2 }}>{ws.name}</span>
                      {sel && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.accent }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Boards (opcional, solo si hay workspace seleccionada) */}
          {selectedWsId && (
            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>
                Boards del proyecto
                {selectedBoardIds.length > 0 && (
                  <span className="ml-1.5 normal-case font-normal" style={{ color: C.text3 }}>
                    ({selectedBoardIds.length} seleccionado{selectedBoardIds.length > 1 ? 's' : ''})
                  </span>
                )}
              </label>
              {loadingBoards ? (
                <p className="text-[11.5px]" style={{ color: C.text4 }}>{t.btn_loading}</p>
              ) : boardOptions.length === 0 ? (
                <p className="text-[11.5px]" style={{ color: C.text4 }}>{t.projects_boards_no_boards_in_ws}</p>
              ) : (
                <>
                  <button
                    onClick={() => setShowBoardPicker((v) => !v)}
                    className="flex items-center justify-between text-[12.5px] rounded-[8px] transition-colors"
                    style={{ padding: '9px 12px', background: C.bg2, border: `1px solid ${C.border2}`, color: C.text2 }}
                  >
                    <span className="flex items-center gap-1.5">
                      <LayoutDashboard className="w-3.5 h-3.5" style={{ color: C.text4 }} />
                      {selectedBoardIds.length === 0 ? t.projects_add_board_tab_assign + '...' : `${selectedBoardIds.length} board${selectedBoardIds.length > 1 ? 's' : ''}`}
                    </span>
                    <ChevronDown className="w-3.5 h-3.5" style={{ color: C.text4 }} />
                  </button>

                  {showBoardPicker && (
                    <div
                      className="flex flex-col rounded-[8px] overflow-hidden overflow-y-auto"
                      style={{ maxHeight: '140px', background: C.bg2, border: `1px solid ${C.border2}` }}
                    >
                      {boardOptions.map((board) => {
                        const sel = selectedBoardIds.includes(board.id);
                        return (
                          <button
                            key={board.id}
                            onClick={() => toggleBoard(board.id)}
                            className="flex items-center gap-2 text-left transition-colors"
                            style={{ padding: '8px 12px', background: sel ? `${C.accent}12` : 'transparent' }}
                            onMouseEnter={(e) => { if (!sel) (e.currentTarget.style.background = C.hover); }}
                            onMouseLeave={(e) => { (e.currentTarget.style.background = sel ? `${C.accent}12` : 'transparent'); }}
                          >
                            <LayoutDashboard className="w-3.5 h-3.5 flex-shrink-0" style={{ color: sel ? C.accent : C.text4 }} />
                            <span className="text-[12px] flex-1 truncate" style={{ color: sel ? C.text : C.text2 }}>{board.name}</span>
                            {sel && <Check className="w-3.5 h-3.5 flex-shrink-0" style={{ color: C.accent }} />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Fechas */}
          <div className="flex gap-3">
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.projects_config_start}</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="text-[12.5px] rounded-[8px] outline-none"
                style={{
                  padding: '8px 10px',
                  background: C.bg2,
                  border: `1px solid ${C.border2}`,
                  color: startDate ? C.text : C.text4,
                  colorScheme: 'dark',
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5 flex-1">
              <label className="text-[11px] font-medium uppercase tracking-wide" style={{ color: C.text4 }}>{t.projects_config_end}</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="text-[12.5px] rounded-[8px] outline-none"
                style={{
                  padding: '8px 10px',
                  background: C.bg2,
                  border: `1px solid ${C.border2}`,
                  color: endDate ? C.text : C.text4,
                  colorScheme: 'dark',
                }}
              />
            </div>
          </div>

          {error && (
            <p className="text-[11.5px]" style={{ color: C.red }}>{error}</p>
          )}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-end gap-2"
          style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}` }}
        >
          <button
            onClick={onClose}
            className="text-[12.5px] rounded-[7px] transition-colors"
            style={{ padding: '7px 14px', background: C.hover, color: C.text2, border: `1px solid ${C.border2}` }}
            onMouseEnter={(e) => { (e.currentTarget.style.color = C.text); }}
            onMouseLeave={(e) => { (e.currentTarget.style.color = C.text2); }}
          >
            {t.btn_cancel}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isLoading || !name.trim() || !selectedWsId}
            className="text-[12.5px] font-medium rounded-[7px] transition-colors"
            style={{
              padding: '7px 16px',
              background: isLoading || !name.trim() || !selectedWsId ? `${C.accent}55` : C.accent,
              color: '#fff',
              cursor: isLoading || !name.trim() || !selectedWsId ? 'not-allowed' : 'pointer',
            }}
          >
            {isLoading ? t.btn_creating : t.projects_btn_create}
          </button>
        </div>
      </div>
    </div>
  );
}
