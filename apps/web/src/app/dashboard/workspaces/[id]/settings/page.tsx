// apps/web/src/app/dashboard/workspaces/[id]/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { ArrowLeft, Save, Trash2, AlertTriangle, CheckCircle } from 'lucide-react';

const COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#f97316',
];

const ICONS = ['▣', '◆', '▦', '▤', '◉', '▲', '●', '■'];

export default function WorkspaceSettingsPage() {
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const {
    currentWorkspace,
    fetchWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    fetchMembers,
    currentMembers,
    isLoading,
  } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(ICONS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    if (workspaceId) {
      fetchWorkspaceById(workspaceId);
      fetchMembers(workspaceId);
    }
  }, [workspaceId, fetchWorkspaceById, fetchMembers]);

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description || '');
      setSelectedIcon(currentWorkspace.icon || ICONS[0]);
      setSelectedColor(currentWorkspace.color || COLORS[0]);
    }
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="loading-lg" />
      </div>
    );
  }

  const isOwner = currentWorkspace.userRole === 'OWNER';
  const isAdmin = currentWorkspace.userRole === 'ADMIN';

  if (!isOwner && !isAdmin) {
    return (
      <div className="bg-card border border-border p-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 bg-error/10 border border-error flex items-center justify-center">
          <AlertTriangle className="w-8 h-8 text-error" />
        </div>
        <h3 className="text-xl font-medium mb-2">Sin permisos</h3>
        <p className="text-error mb-6">No tienes permiso para acceder a la configuración</p>
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Volver al Workspace</span>
        </Link>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateWorkspace(workspaceId, {
        name,
        description,
        icon: selectedIcon,
        color: selectedColor,
      });

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const handleDelete = async () => {
    await deleteWorkspace(workspaceId);
    router.push('/dashboard/workspaces');
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium mb-1">Configuración del Workspace</h1>
          <p className="text-text-secondary text-xs">
            Administra la configuración y personalización de tu espacio de trabajo
          </p>
        </div>
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="px-3 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Volver</span>
        </Link>
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-success/10 border border-success p-3 flex items-start gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-success font-medium text-xs">Cambios guardados exitosamente</p>
            <p className="text-text-secondary text-xs mt-0.5">
              Tu workspace ha sido actualizado correctamente
            </p>
          </div>
        </div>
      )}

      {/* General Settings */}
      <div className="bg-card border border-border p-6">
        <div className="flex items-center gap-2 mb-4 pb-3 border-b border-border">
          <div className="p-1.5 bg-accent/10 border border-accent/30">
            <Save className="w-4 h-4 text-accent" />
          </div>
          <h2 className="text-base font-medium text-text-primary">Configuración General</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Form Fields */}
          <div className="space-y-4">
            {/* Name */}
            <div>
              <label htmlFor="name" className="block text-xs font-medium text-text-primary mb-1.5">
                Nombre del Workspace
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                placeholder="Ingresa un nombre"
                maxLength={255}
              />
            </div>

            {/* Description */}
            <div>
              <label
                htmlFor="description"
                className="block text-xs font-medium text-text-primary mb-1.5"
              >
                Descripción
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 bg-surface border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors min-h-[80px] resize-none"
                placeholder="Describe tu workspace"
                maxLength={1000}
              />
              <p className="text-xs text-text-muted mt-1">{description.length}/1000</p>
            </div>

            {/* Icon & Color in Row */}
            <div className="grid grid-cols-2 gap-4">
              {/* Icon */}
              <div>
                <label className="block text-xs font-medium text-text-primary mb-2">Icono</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`aspect-square p-1.5 border transition-all text-lg ${
                        selectedIcon === icon
                          ? 'border-accent bg-accent/10 text-accent'
                          : 'border-border hover:border-accent/50 text-text-secondary hover:bg-surface'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <label className="block text-xs font-medium text-text-primary mb-2">Color</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => setSelectedColor(color)}
                      className={`aspect-square border-2 transition-all rounded-sm ${
                        selectedColor === color
                          ? 'border-white scale-105 shadow-md'
                          : 'border-border/50 hover:scale-105'
                      }`}
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Preview */}
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-text-primary mb-2">
                Vista Previa
              </label>
              <div className="flex items-start gap-3 p-4 border border-border bg-surface">
                <div
                  className="w-12 h-12 flex-shrink-0 flex items-center justify-center text-2xl border"
                  style={{
                    backgroundColor: `${selectedColor}15`,
                    color: selectedColor,
                    borderColor: `${selectedColor}40`,
                  }}
                >
                  {selectedIcon}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-medium text-text-primary truncate">
                    {name || 'Nombre del workspace'}
                  </h3>
                  <p className="text-xs text-text-secondary mt-1 line-clamp-2">
                    {description || 'Descripción del workspace'}
                  </p>
                </div>
              </div>
            </div>

            {/* Save Buttons - Now in preview column */}
            <div className="flex items-center gap-2 pt-3 border-t border-border">
              <button
                onClick={handleSave}
                disabled={isLoading || !name.trim()}
                className="flex-1 px-4 py-2 bg-accent text-white text-sm font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Guardando...' : 'Guardar'}</span>
              </button>
              <Link
                href={`/dashboard/workspaces/${workspaceId}`}
                className="px-4 py-2 border border-border bg-surface text-text-primary text-sm font-medium hover:bg-card transition-colors"
              >
                Cancelar
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="bg-error/5 border border-error p-4">
          <div className="flex items-center gap-2 mb-3 pb-2 border-b border-error/30">
            <div className="p-1.5 bg-error/10 border border-error/30">
              <AlertTriangle className="w-4 h-4 text-error" />
            </div>
            <h2 className="text-base font-medium text-error">Zona de Peligro</h2>
          </div>

          <div className="flex items-start gap-3 p-3 bg-background border border-error/30">
            <Trash2 className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-medium text-text-primary mb-1">Eliminar Workspace</h3>
              <p className="text-xs text-text-secondary mb-3">
                Al eliminar este workspace se removerán permanentemente todos los boards, tarjetas y
                datos asociados. Esta acción no se puede deshacer.
              </p>

              {!showDeleteConfirm ? (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="px-3 py-1.5 border border-error bg-error/10 text-error text-xs font-medium hover:bg-error hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Eliminar Workspace</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-start gap-2 p-2 bg-error/10 border border-error">
                    <AlertTriangle className="w-3.5 h-3.5 text-error flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-error font-medium">
                      ¿Estás completamente seguro? Esta acción es irreversible.
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleDelete}
                      className="px-3 py-1.5 bg-error text-white text-xs font-medium hover:bg-error/80 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Sí, Eliminar</span>
                    </button>
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      className="px-3 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
