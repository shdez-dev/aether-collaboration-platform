// apps/web/src/components/CreateWorkspaceModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';

type Mode = 'blank' | 'template';

const TEMPLATES = [
  { id: 'development', icon: 'Code2', color: '#3b82f6' },
  { id: 'marketing', icon: 'Megaphone', color: '#f59e0b' },
  { id: 'design', icon: 'PenTool', color: '#8b5cf6' },
  { id: 'hr', icon: 'Users', color: '#10b981' },
  { id: 'general', icon: 'Folder', color: '#06b6d4' },
] as const;

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
];

export default function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const t = useT();
  const router = useRouter();
  const { createWorkspace, createFromTemplate, isLoading } = useWorkspaceStore();

  const [mode, setMode] = useState<Mode>('blank');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(WORKSPACE_ICON_KEYS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      let workspace;

      if (mode === 'template') {
        if (!selectedTemplate) {
          setError('Selecciona un template');
          return;
        }
        if (!templateName.trim()) {
          setError(t.create_ws_validation_name);
          return;
        }
        workspace = await createFromTemplate(selectedTemplate, templateName.trim());
      } else {
        if (name.trim().length < 1) {
          setError(t.create_ws_validation_name);
          return;
        }
        workspace = await createWorkspace({
          name: name.trim(),
          description: description.trim() || undefined,
          icon: selectedIcon,
          color: selectedColor,
        });
      }

      onClose();
      router.push(`/dashboard/workspaces/${workspace.id}`);
    } catch (err: any) {
      setError(err.message || t.create_ws_error);
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setDescription('');
      setTemplateName('');
      setSelectedTemplate(null);
      setError('');
      setMode('blank');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card-terminal max-w-lg w-full">
        <div className="flex items-center justify-between mb-4">
          <h2 className="section-header">{t.create_ws_title}</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Mode tabs */}
        <div className="flex border border-border mb-6">
          <button
            type="button"
            onClick={() => setMode('blank')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              mode === 'blank'
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.create_ws_btn_create}
          </button>
          <button
            type="button"
            onClick={() => setMode('template')}
            className={`flex-1 py-2 text-xs font-medium transition-colors ${
              mode === 'template'
                ? 'bg-accent text-white'
                : 'bg-surface text-text-secondary hover:text-text-primary'
            }`}
          >
            {t.ws_template_title}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Template Mode */}
          {mode === 'template' && (
            <>
              <div>
                <p className="text-xs text-text-secondary mb-3">{t.ws_template_subtitle}</p>
                <div className="grid grid-cols-1 gap-2">
                  {TEMPLATES.map((tpl) => {
                    const labelKey = `ws_template_${tpl.id}` as keyof typeof t;
                    const descKey = `ws_template_${tpl.id}_desc` as keyof typeof t;
                    const isSelected = selectedTemplate === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTemplate(tpl.id)}
                        className={`flex items-center gap-3 p-3 border text-left transition-colors ${
                          isSelected
                            ? 'border-accent bg-accent/10'
                            : 'border-border bg-surface hover:border-accent/50'
                        }`}
                      >
                        <div
                          className="w-9 h-9 flex items-center justify-center flex-shrink-0 border"
                          style={{
                            backgroundColor: `${tpl.color}15`,
                            color: tpl.color,
                            borderColor: `${tpl.color}40`,
                          }}
                        >
                          <WorkspaceIcon icon={tpl.icon} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <p
                            className={`text-sm font-medium ${isSelected ? 'text-accent' : 'text-text-primary'}`}
                          >
                            {t[labelKey] as string}
                          </p>
                          <p className="text-xs text-text-secondary truncate">
                            {t[descKey] as string}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  {t.create_ws_label_name} <span className="text-error">*</span>
                </label>
                <input
                  type="text"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  className="input-terminal"
                  placeholder={t.ws_template_placeholder_name}
                  disabled={isLoading}
                  maxLength={255}
                />
              </div>
            </>
          )}
          {/* Blank Mode */}
          {mode === 'blank' && (
            <>
              {/* Name */}
              <div>
                <label htmlFor="name" className="block text-sm text-text-secondary mb-2">
                  {t.create_ws_label_name} <span className="text-error">*</span>
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="input-terminal"
                  placeholder={t.create_ws_placeholder_name}
                  disabled={isLoading}
                  maxLength={255}
                />
              </div>

              {/* Description */}
              <div>
                <label htmlFor="description" className="block text-sm text-text-secondary mb-2">
                  {t.create_ws_label_description}
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="input-terminal min-h-[80px] resize-none"
                  placeholder={t.create_ws_placeholder_description}
                  disabled={isLoading}
                  maxLength={1000}
                />
              </div>

              {/* Icon Selector */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  {t.create_ws_label_icon}
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {WORKSPACE_ICON_KEYS.map((key) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedIcon(key)}
                      disabled={isLoading}
                      title={key}
                      className={`aspect-square p-2.5 border transition-colors flex items-center justify-center ${
                        selectedIcon === key
                          ? 'border-accent bg-accent/20 text-accent'
                          : 'border-border hover:border-accent/50 text-text-secondary hover:text-text-primary hover:bg-surface'
                      }`}
                    >
                      <WorkspaceIcon icon={key} className="w-5 h-5" />
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm text-text-secondary mb-2">
                  {t.create_ws_label_color}
                </label>
                <div className="grid grid-cols-8 gap-2">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      disabled={isLoading}
                      className={`w-10 h-10 rounded-terminal border-2 transition-all ${
                        selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </div>
              </div>

              {/* Preview */}
              <div className="p-4 bg-background rounded-terminal border border-border">
                <p className="text-xs text-text-muted mb-2">{t.create_ws_preview_label}</p>
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-terminal flex items-center justify-center border flex-shrink-0"
                    style={{
                      backgroundColor: `${selectedColor}20`,
                      color: selectedColor,
                      borderColor: `${selectedColor}40`,
                    }}
                  >
                    <WorkspaceIcon icon={selectedIcon} className="w-6 h-6" />
                  </div>
                  <div>
                    <p className="text-text-primary font-medium">
                      {name || t.create_ws_placeholder_name}
                    </p>
                    <p className="text-xs text-text-muted">{description || t.no_description}</p>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* Error */}
          {error && (
            <div className="bg-error/10 border border-error/50 rounded-terminal p-3">
              <p className="text-error text-sm">✗ {error}</p>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="btn-secondary flex-1"
            >
              {t.create_ws_btn_cancel}
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading" />
                  {t.create_ws_btn_creating}
                </span>
              ) : (
                t.create_ws_btn_create
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
