// apps/web/src/app/dashboard/workspaces/[id]/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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

  // ✅ Estado para mostrar mensaje de éxito
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
      <div className="card-terminal text-center py-12">
        <p className="text-error mb-4">You don't have permission to access settings</p>
        <Link href={`/dashboard/workspaces/${workspaceId}`} className="btn-secondary">
          ← Back to Workspace
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

      // ✅ Mostrar mensaje de éxito
      setShowSuccess(true);

      // ✅ Ocultar mensaje después de 3 segundos
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (error) {
      console.error('Error updating workspace:', error);
      // Aquí podrías mostrar un mensaje de error si quieres
    }
  };

  const handleDelete = async () => {
    await deleteWorkspace(workspaceId);
    router.push('/dashboard/workspaces');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-normal mb-1">Workspace Settings</h1>
          <p className="text-text-secondary text-sm">
            Manage your workspace configuration and members
          </p>
        </div>
        <Link href={`/dashboard/workspaces/${workspaceId}`} className="btn-secondary">
          ← Back
        </Link>
      </div>

      {/* ✅ Success Message */}
      {showSuccess && (
        <div className="card-terminal border-accent bg-accent/10 animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-accent text-xl">✓</span>
            <div>
              <p className="text-accent font-medium">Changes saved successfully</p>
              <p className="text-text-secondary text-sm">Your workspace has been updated</p>
            </div>
          </div>
        </div>
      )}

      {/* General Settings */}
      <div className="card-terminal">
        <h2 className="section-header">GENERAL SETTINGS</h2>

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label htmlFor="name" className="block text-sm text-text-secondary mb-2">
              NAME:
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="input-terminal"
              placeholder="Workspace name"
              maxLength={255}
            />
          </div>

          {/* Description */}
          <div>
            <label htmlFor="description" className="block text-sm text-text-secondary mb-2">
              DESCRIPTION:
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="input-terminal min-h-[80px] resize-none"
              placeholder="Workspace description"
              maxLength={1000}
            />
          </div>

          {/* Icon */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">ICON:</label>
            <div className="grid grid-cols-8 gap-2">
              {ICONS.map((icon) => (
                <button
                  key={icon}
                  type="button"
                  onClick={() => setSelectedIcon(icon)}
                  className={`p-3 rounded-terminal border transition-colors ${
                    selectedIcon === icon
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border hover:border-accent/50 text-text-secondary'
                  }`}
                >
                  <span className="text-2xl">{icon}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div>
            <label className="block text-sm text-text-secondary mb-2">COLOR:</label>
            <div className="grid grid-cols-8 gap-2">
              {COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-10 h-10 rounded-terminal border-2 transition-all ${
                    selectedColor === color ? 'border-white scale-110' : 'border-transparent'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>

          {/* Save Button */}
          <button onClick={handleSave} disabled={isLoading} className="btn-primary">
            {isLoading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Danger Zone */}
      {isOwner && (
        <div className="card-terminal border-error/50 bg-error/5">
          <h2 className="section-header text-error">DANGER ZONE</h2>

          <div className="space-y-4">
            <p className="text-text-secondary text-sm">
              Deleting this workspace will permanently remove all boards, cards, and data. This
              action cannot be undone.
            </p>

            {!showDeleteConfirm ? (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-secondary border-error text-error hover:bg-error/10"
              >
                Delete Workspace
              </button>
            ) : (
              <div className="space-y-3">
                <p className="text-error text-sm font-medium">
                  Are you sure? This action is irreversible.
                </p>
                <div className="flex gap-3">
                  <button onClick={handleDelete} className="btn-primary bg-error hover:bg-error/80">
                    Yes, Delete Forever
                  </button>
                  <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary">
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
