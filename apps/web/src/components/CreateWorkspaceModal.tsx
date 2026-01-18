// apps/web/src/components/CreateWorkspaceModal.tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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

const ICONS = ['▣', '◆', '▦', '▤', '◉', '▲', '●', '■'];

export default function CreateWorkspaceModal({ isOpen, onClose }: CreateWorkspaceModalProps) {
  const router = useRouter();
  const { createWorkspace, isLoading } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (name.trim().length < 1) {
      setError('El nombre es obligatorio');
      return;
    }

    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedIcon,
        color: selectedColor,
      });

      // Cerrar modal y redirigir
      onClose();
      router.push(`/dashboard/workspaces/${workspace.id}`);
    } catch (err: any) {
      setError(err.message || 'Error al crear workspace');
    }
  };

  const handleClose = () => {
    if (!isLoading) {
      setName('');
      setDescription('');
      setError('');
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="card-terminal max-w-lg w-full">
        <div className="flex items-center justify-between mb-6">
          <h2 className="section-header">CREAR WORKSPACE</h2>
          <button
            onClick={handleClose}
            disabled={isLoading}
            className="text-text-muted hover:text-text-primary transition-colors"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm text-text-secondary mb-2">
              NOMBRE: <span className="text-error">*</span>
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-terminal"
              placeholder="Mi Workspace"
              required
              disabled={isLoading}
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm text-text-secondary mb-2">
              DESCRIPCIÓN:
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-terminal min-h-[80px] resize-none"
              placeholder="Descripción del workspace (opcional)"
              disabled={isLoading}
              maxLength={1000}
            />
          </div>

          {/* Icon Selector */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">ICONO:</label>
            <div className="grid grid-cols-8 gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  disabled={isLoading}
                  className={`p-3 rounded-terminal border transition-colors ${
                    selectedIcon === icon
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border hover:border-accent/50 text-text-secondary hover:text-text-primary'
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color Picker */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">COLOR:</label>
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
            <p className="text-xs text-text-muted mb-2">VISTA PREVIA:</p>
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-terminal flex items-center justify-center text-2xl"
                style={{ backgroundColor: `${selectedColor}20`, color: selectedColor }}
              >
                {selectedIcon}
              </div>
              <div>
                <p className="text-text-primary font-medium">{name || 'Nombre del Workspace'}</p>
                <p className="text-xs text-text-muted">{description || 'Sin descripción'}</p>
              </div>
            </div>
          </div>

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
              CANCELAR
            </button>
            <button type="submit" disabled={isLoading} className="btn-primary flex-1">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="loading" />
                  CREANDO...
                </span>
              ) : (
                'CREAR WORKSPACE'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
