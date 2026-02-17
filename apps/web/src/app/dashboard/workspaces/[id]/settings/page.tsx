// apps/web/src/app/dashboard/workspaces/[id]/settings/page.tsx
'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  ArrowLeft,
  Save,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Archive,
  ArchiveRestore,
  Copy,
  Globe,
  Lock,
  Link2,
  RefreshCw,
  X,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';

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

export default function WorkspaceSettingsPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const {
    currentWorkspace,
    fetchWorkspaceById,
    updateWorkspace,
    deleteWorkspace,
    archiveWorkspace,
    restoreWorkspace,
    duplicateWorkspace,
    updateVisibility,
    regenerateInviteToken,
    revokeInviteToken,
    fetchMembers,
    isLoading,
  } = useWorkspaceStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(WORKSPACE_ICON_KEYS[0]);
  const [selectedColor, setSelectedColor] = useState(COLORS[0]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [duplicateIncludeBoards, setDuplicateIncludeBoards] = useState(true);
  const [isDuplicating, setIsDuplicating] = useState(false);
  const [duplicateSuccess, setDuplicateSuccess] = useState(false);
  const [inviteLinkCopied, setInviteLinkCopied] = useState(false);

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
      setSelectedIcon(currentWorkspace.icon || WORKSPACE_ICON_KEYS[0]);
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
        <h3 className="text-xl font-medium mb-2">{t.ws_settings_no_permission_title}</h3>
        <p className="text-error mb-6">{t.ws_settings_no_permission_desc}</p>
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="btn-secondary inline-flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{t.ws_settings_btn_back}</span>
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
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (error) {
      console.error('Error updating workspace:', error);
    }
  };

  const handleDelete = async () => {
    await deleteWorkspace(workspaceId);
    router.push('/dashboard/workspaces');
  };

  const handleArchive = async () => {
    await archiveWorkspace(workspaceId);
    setShowArchiveConfirm(false);
    router.push('/dashboard/workspaces');
  };

  const handleRestore = async () => {
    await restoreWorkspace(workspaceId);
    router.push(`/dashboard/workspaces/${workspaceId}`);
  };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const newWs = await duplicateWorkspace(workspaceId, duplicateIncludeBoards);
      setDuplicateSuccess(true);
      setTimeout(() => {
        setDuplicateSuccess(false);
        router.push(`/dashboard/workspaces/${newWs.id}`);
      }, 1500);
    } catch {
      // handled by store
    } finally {
      setIsDuplicating(false);
    }
  };

  const handleVisibilityChange = async (visibility: 'private' | 'public') => {
    await updateVisibility(workspaceId, visibility);
  };

  const handleGenerateInviteLink = async () => {
    await regenerateInviteToken(workspaceId);
  };

  const handleRevokeInviteLink = async () => {
    await revokeInviteToken(workspaceId);
  };

  const handleCopyInviteLink = () => {
    if (!currentWorkspace?.inviteToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${currentWorkspace.inviteToken}`);
    setInviteLinkCopied(true);
    setTimeout(() => setInviteLinkCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-medium mb-0.5">{t.ws_settings_title}</h1>
          <p className="text-text-secondary text-xs">{t.ws_settings_subtitle}</p>
        </div>
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          className="px-3 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors flex items-center gap-1.5"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{t.btn_back}</span>
        </Link>
      </div>

      {/* ── Success banner ─────────────────────────────────────────────── */}
      {showSuccess && (
        <div className="bg-success/10 border border-success p-3 flex items-center gap-2 animate-fade-in">
          <CheckCircle className="w-4 h-4 text-success flex-shrink-0" />
          <p className="text-success font-medium text-xs">{t.ws_settings_success_title}</p>
        </div>
      )}

      {/* ── Main 2-column grid ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-5 gap-4 items-start">
        {/* ════ LEFT COLUMN (3/5) ════════════════════════════════════════ */}
        <div className="xl:col-span-3 space-y-4">
          {/* General Settings card */}
          <div className="bg-card border border-border">
            {/* Card header */}
            <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
              <div className="p-1 bg-accent/10 border border-accent/30">
                <Save className="w-3.5 h-3.5 text-accent" />
              </div>
              <h2 className="text-sm font-medium text-text-primary">
                {t.ws_settings_section_general}
              </h2>
            </div>

            <div className="p-5 space-y-4">
              {/* Name + Description row */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">
                    {t.ws_settings_label_name}
                  </label>
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder={t.ws_settings_placeholder_name}
                    maxLength={255}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">
                    {t.ws_settings_label_description}
                  </label>
                  <input
                    type="text"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full px-3 py-2 bg-surface border border-border text-text-primary text-sm placeholder-text-muted focus:outline-none focus:border-accent transition-colors"
                    placeholder={t.ws_settings_placeholder_description}
                    maxLength={255}
                  />
                </div>
              </div>

              {/* Icon + Color + Preview row */}
              <div className="grid grid-cols-3 gap-4">
                {/* Icon */}
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">
                    {t.ws_settings_label_icon}
                  </label>
                  <div className="grid grid-cols-4 gap-1 max-h-[120px] overflow-y-auto pr-0.5">
                    {WORKSPACE_ICON_KEYS.map((key) => (
                      <button
                        key={key}
                        type="button"
                        title={key}
                        onClick={() => setSelectedIcon(key)}
                        className={`aspect-square p-1.5 border transition-all flex items-center justify-center ${
                          selectedIcon === key
                            ? 'border-accent bg-accent/10 text-accent'
                            : 'border-border hover:border-accent/50 text-text-secondary hover:bg-surface'
                        }`}
                      >
                        <WorkspaceIcon icon={key} className="w-4 h-4" />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color */}
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">
                    {t.ws_settings_label_color}
                  </label>
                  <div className="grid grid-cols-4 gap-1">
                    {COLORS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setSelectedColor(color)}
                        className={`aspect-square border-2 transition-all rounded-sm ${
                          selectedColor === color
                            ? 'border-white scale-110 shadow-md'
                            : 'border-border/40 hover:scale-105'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>

                {/* Preview */}
                <div>
                  <label className="block text-xs font-medium text-text-primary mb-1.5">
                    {t.ws_settings_label_preview}
                  </label>
                  <div className="flex items-center gap-2 p-3 border border-border bg-surface h-[calc(100%-22px)]">
                    <div
                      className="w-10 h-10 flex-shrink-0 flex items-center justify-center border"
                      style={{
                        backgroundColor: `${selectedColor}15`,
                        color: selectedColor,
                        borderColor: `${selectedColor}40`,
                      }}
                    >
                      <WorkspaceIcon icon={selectedIcon} className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-text-primary truncate">
                      {name || t.ws_settings_placeholder_name}
                    </p>
                  </div>
                </div>
              </div>

              {/* Save row */}
              <div className="flex items-center gap-2 pt-2 border-t border-border">
                <button
                  onClick={handleSave}
                  disabled={isLoading || !name.trim()}
                  className="px-4 py-2 bg-accent text-white text-xs font-medium hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  <span>{isLoading ? t.btn_saving : t.btn_save}</span>
                </button>
                <Link
                  href={`/dashboard/workspaces/${workspaceId}`}
                  className="px-4 py-2 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                >
                  {t.btn_cancel}
                </Link>
              </div>
            </div>
          </div>

          {/* Danger Zone card — only for owner */}
          {isOwner && (
            <div className="bg-card border border-error/50">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-error/30">
                <div className="p-1 bg-error/10 border border-error/30">
                  <AlertTriangle className="w-3.5 h-3.5 text-error" />
                </div>
                <h2 className="text-sm font-medium text-error">{t.ws_settings_danger_zone}</h2>
              </div>

              <div className="p-5 space-y-3">
                {/* Archive / Restore row */}
                <div className="flex items-start justify-between gap-4 p-3 bg-surface border border-border">
                  <div className="flex items-start gap-2 min-w-0">
                    {currentWorkspace.archived ? (
                      <ArchiveRestore className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    ) : (
                      <Archive className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary">
                        {currentWorkspace.archived
                          ? t.ws_settings_restore_title
                          : t.ws_settings_archive_title}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        {currentWorkspace.archived
                          ? t.ws_settings_restore_desc
                          : t.ws_settings_archive_desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {currentWorkspace.archived ? (
                      <button
                        onClick={handleRestore}
                        className="px-3 py-1.5 border border-warning bg-warning/10 text-warning text-xs font-medium hover:bg-warning hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <ArchiveRestore className="w-3.5 h-3.5" />
                        <span>{t.ws_settings_btn_restore}</span>
                      </button>
                    ) : !showArchiveConfirm ? (
                      <button
                        onClick={() => setShowArchiveConfirm(true)}
                        className="px-3 py-1.5 border border-warning/50 bg-warning/5 text-warning text-xs font-medium hover:bg-warning hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Archive className="w-3.5 h-3.5" />
                        <span>{t.ws_settings_btn_archive}</span>
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleArchive}
                          className="px-2.5 py-1.5 bg-warning text-white text-xs font-medium hover:bg-warning/80 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Archive className="w-3 h-3" />
                          <span>{t.ws_settings_btn_confirm_archive}</span>
                        </button>
                        <button
                          onClick={() => setShowArchiveConfirm(false)}
                          className="px-2.5 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                        >
                          {t.btn_cancel}
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Delete row */}
                <div className="flex items-start justify-between gap-4 p-3 bg-surface border border-border">
                  <div className="flex items-start gap-2 min-w-0">
                    <Trash2 className="w-4 h-4 text-error flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-text-primary">
                        {t.ws_settings_delete_title}
                      </p>
                      <p className="text-[11px] text-text-secondary mt-0.5 leading-relaxed">
                        {t.ws_settings_delete_desc}
                      </p>
                    </div>
                  </div>

                  <div className="flex-shrink-0">
                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="px-3 py-1.5 border border-error/50 bg-error/5 text-error text-xs font-medium hover:bg-error hover:text-white transition-colors flex items-center gap-1.5 whitespace-nowrap"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>{t.ws_settings_btn_delete}</span>
                      </button>
                    ) : (
                      <div className="flex gap-1.5">
                        <button
                          onClick={handleDelete}
                          className="px-2.5 py-1.5 bg-error text-white text-xs font-medium hover:bg-error/80 transition-colors flex items-center gap-1 whitespace-nowrap"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>{t.ws_settings_btn_confirm_delete}</span>
                        </button>
                        <button
                          onClick={() => setShowDeleteConfirm(false)}
                          className="px-2.5 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                        >
                          {t.btn_cancel}
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ════ RIGHT COLUMN (2/5) ═══════════════════════════════════════ */}
        <div className="xl:col-span-2 space-y-4">
          {/* Visibility & Invite Link card */}
          {(isOwner || isAdmin) && (
            <div className="bg-card border border-border">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
                <div className="p-1 bg-accent/10 border border-accent/30">
                  <Globe className="w-3.5 h-3.5 text-accent" />
                </div>
                <h2 className="text-sm font-medium text-text-primary">
                  {t.ws_settings_visibility_title}
                </h2>
              </div>

              <div className="p-4 space-y-4">
                {/* Visibility toggle */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => handleVisibilityChange('private')}
                    className={`flex flex-col items-center gap-1 p-3 border text-center transition-colors ${
                      currentWorkspace.visibility !== 'public'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <Lock className="w-4 h-4" />
                    <span className="text-xs font-medium">{t.ws_settings_visibility_private}</span>
                    <span className="text-[10px] opacity-70 leading-tight">
                      {t.ws_settings_visibility_private_desc}
                    </span>
                  </button>
                  <button
                    onClick={() => handleVisibilityChange('public')}
                    className={`flex flex-col items-center gap-1 p-3 border text-center transition-colors ${
                      currentWorkspace.visibility === 'public'
                        ? 'border-accent bg-accent/10 text-accent'
                        : 'border-border bg-surface text-text-secondary hover:border-accent/40'
                    }`}
                  >
                    <Globe className="w-4 h-4" />
                    <span className="text-xs font-medium">{t.ws_settings_visibility_public}</span>
                    <span className="text-[10px] opacity-70 leading-tight">
                      {t.ws_settings_visibility_public_desc}
                    </span>
                  </button>
                </div>

                {/* Invite link */}
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Link2 className="w-3 h-3 text-text-muted" />
                    <p className="text-xs font-medium text-text-primary">
                      {t.ws_settings_invite_link_title}
                    </p>
                  </div>

                  {currentWorkspace.inviteToken ? (
                    <>
                      <div className="px-2.5 py-1.5 bg-surface border border-border">
                        <code className="text-[10px] text-text-muted break-all leading-relaxed">
                          {typeof window !== 'undefined'
                            ? `${window.location.origin}/join/${currentWorkspace.inviteToken}`
                            : `/join/${currentWorkspace.inviteToken}`}
                        </code>
                      </div>
                      <div className="flex gap-1.5 flex-wrap">
                        <button
                          onClick={handleCopyInviteLink}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                        >
                          {inviteLinkCopied ? (
                            <CheckCircle className="w-3 h-3 text-success" />
                          ) : (
                            <Copy className="w-3 h-3" />
                          )}
                          <span>
                            {inviteLinkCopied
                              ? t.ws_settings_link_copied
                              : t.ws_settings_btn_copy_link}
                          </span>
                        </button>
                        <button
                          onClick={handleGenerateInviteLink}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card transition-colors"
                        >
                          <RefreshCw className="w-3 h-3" />
                          <span>{t.ws_settings_btn_generate_link}</span>
                        </button>
                        <button
                          onClick={handleRevokeInviteLink}
                          className="flex items-center gap-1 px-2.5 py-1.5 border border-error/40 bg-error/5 text-error text-xs font-medium hover:bg-error/10 transition-colors"
                        >
                          <X className="w-3 h-3" />
                          <span>{t.ws_settings_btn_revoke_link}</span>
                        </button>
                      </div>
                    </>
                  ) : (
                    <button
                      onClick={handleGenerateInviteLink}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-accent/40 bg-accent/5 text-accent text-xs font-medium hover:bg-accent/10 transition-colors"
                    >
                      <Link2 className="w-3.5 h-3.5" />
                      <span>{t.ws_settings_btn_generate_link}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Duplicate card */}
          {(isOwner || isAdmin) && (
            <div className="bg-card border border-border">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
                <div className="p-1 bg-accent/10 border border-accent/30">
                  <Copy className="w-3.5 h-3.5 text-accent" />
                </div>
                <h2 className="text-sm font-medium text-text-primary">
                  {t.ws_settings_duplicate_title}
                </h2>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-[11px] text-text-secondary leading-relaxed">
                  {t.ws_settings_duplicate_desc}
                </p>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={duplicateIncludeBoards}
                    onChange={(e) => setDuplicateIncludeBoards(e.target.checked)}
                    className="w-3.5 h-3.5 accent-accent"
                  />
                  <span className="text-xs text-text-primary">
                    {t.ws_settings_duplicate_include_boards}
                  </span>
                </label>

                {duplicateSuccess ? (
                  <div className="flex items-center gap-1.5 px-3 py-2 bg-success/10 border border-success text-success text-xs font-medium">
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{t.ws_settings_duplicate_success}</span>
                  </div>
                ) : (
                  <button
                    onClick={handleDuplicate}
                    disabled={isDuplicating}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-border bg-surface text-text-primary text-xs font-medium hover:bg-card disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{isDuplicating ? '...' : t.ws_settings_btn_duplicate}</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
