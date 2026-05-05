// apps/web/src/app/dashboard/workspaces/[id]/settings/page.tsx
'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import {
  Save, Trash2, AlertTriangle, CheckCircle, Archive, ArchiveRestore,
  Copy, Globe, Lock, Link2, RefreshCw, X, Github, Unlink,
  ChevronDown, ChevronUp, ExternalLink, Settings, Eye, EyeOff,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';


const COLORS = [
  '#3b82f6', '#6366f1', '#8b5cf6', '#a855f7',
  '#ec4899', '#f43f5e', '#ef4444', '#f97316',
  '#f59e0b', '#eab308', '#84cc16', '#10b981',
  '#14b8a6', '#06b6d4', '#0ea5e9', '#64748b',
];

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: '10px', overflow: 'hidden' }}>
      {children}
    </div>
  );
}

function CardHeader({ icon, title, right }: { icon: React.ReactNode; title: string; right?: React.ReactNode }) {
  return (
    <div style={{ padding: '11px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span style={{ color: C.text3, display: 'flex', flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: '13px', fontWeight: 600, color: C.text, flex: 1 }}>{title}</span>
      {right}
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  const t = useT();
  const params = useParams();
  const router = useRouter();
  const workspaceId = params.id as string;

  const {
    currentWorkspace, fetchWorkspaceById, updateWorkspace, deleteWorkspace,
    archiveWorkspace, restoreWorkspace, duplicateWorkspace, updateVisibility,
    regenerateInviteToken, revokeInviteToken, fetchMembers, isLoading,
  } = useWorkspaceStore();

  const [name,               setName]               = useState('');
  const [description,        setDescription]        = useState('');
  const [selectedIcon,       setSelectedIcon]       = useState(WORKSPACE_ICON_KEYS[0]!);
  const [selectedColor,      setSelectedColor]      = useState(COLORS[0]!);
  const [showDeleteConfirm,  setShowDeleteConfirm]  = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showSuccess,        setShowSuccess]        = useState(false);
  const [duplicateBoards,    setDuplicateBoards]    = useState(true);
  const [isDuplicating,      setIsDuplicating]      = useState(false);
  const [duplicateSuccess,   setDuplicateSuccess]   = useState(false);
  const [inviteCopied,       setInviteCopied]       = useState(false);

  interface GithubConnection { githubLogin: string; repos: string[]; connectedAt: string }
  interface GithubRepo { fullName: string; private: boolean; url: string }

  const [ghConnection,    setGhConnection]    = useState<GithubConnection | null | undefined>(undefined);
  const [ghToken,         setGhToken]         = useState('');
  const [ghTokenVisible,  setGhTokenVisible]  = useState(false);
  const [ghRepos,         setGhRepos]         = useState<GithubRepo[]>([]);
  const [ghReposLoading,  setGhReposLoading]  = useState(false);
  const [ghSelected,      setGhSelected]      = useState<string[]>([]);
  const [ghConnecting,    setGhConnecting]    = useState(false);
  const [ghDisconnecting, setGhDisconnecting] = useState(false);
  const [ghError,         setGhError]         = useState('');
  const [ghSuccess,       setGhSuccess]       = useState('');
  const [ghTutorialOpen,  setGhTutorialOpen]  = useState(false);

  const fetchGhConnection = useCallback(async () => {
    if (!workspaceId) return;
    const r = await apiService.get<GithubConnection | null>(`/api/workspaces/${workspaceId}/github`, true);
    setGhConnection(r.success ? (r.data ?? null) : null);
  }, [workspaceId]);

  const fetchGhRepos = useCallback(async (token: string) => {
    if (!token.trim()) return;
    setGhReposLoading(true); setGhError('');
    try {
      const r = await apiService.get<GithubRepo[]>(`/api/workspaces/${workspaceId}/github/repos?token=${encodeURIComponent(token)}`, true);
      if (r.success && r.data) setGhRepos(r.data);
      else setGhError('Token inválido o sin acceso a repos.');
    } catch { setGhError('Error al conectar con GitHub.'); }
    finally { setGhReposLoading(false); }
  }, [workspaceId]);

  const handleGhConnect = async () => {
    if (!ghToken.trim() || ghSelected.length === 0 || ghConnecting) return;
    setGhConnecting(true); setGhError('');
    try {
      const r = await apiService.post<GithubConnection>(`/api/workspaces/${workspaceId}/github`, { githubToken: ghToken.trim(), repos: ghSelected }, true);
      if (r.success && r.data) {
        setGhConnection(r.data); setGhToken(''); setGhRepos([]); setGhSelected([]);
        setGhSuccess(`Conectado como @${r.data.githubLogin}`);
        setTimeout(() => setGhSuccess(''), 4000);
      } else { setGhError((r as any).error?.message ?? 'Error al conectar'); }
    } catch { setGhError('Error inesperado.'); }
    finally { setGhConnecting(false); }
  };

  const handleGhDisconnect = async () => {
    if (ghDisconnecting) return;
    setGhDisconnecting(true);
    try {
      await apiService.delete(`/api/workspaces/${workspaceId}/github`, true);
      setGhConnection(null); setGhSuccess('GitHub desconectado.');
      setTimeout(() => setGhSuccess(''), 3000);
    } catch { setGhError('Error al desconectar.'); }
    finally { setGhDisconnecting(false); }
  };

  useEffect(() => {
    if (workspaceId) { fetchWorkspaceById(workspaceId); fetchMembers(workspaceId); fetchGhConnection(); }
  }, [workspaceId, fetchWorkspaceById, fetchMembers, fetchGhConnection]);

  useEffect(() => {
    if (currentWorkspace) {
      setName(currentWorkspace.name);
      setDescription(currentWorkspace.description || '');
      setSelectedIcon(currentWorkspace.icon || WORKSPACE_ICON_KEYS[0]!);
      setSelectedColor(currentWorkspace.color || COLORS[0]!);
    }
  }, [currentWorkspace]);

  if (!currentWorkspace) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '64px', color: C.text3 }}>
        <div className="w-6 h-6 rounded-full border-2 animate-spin" style={{ borderColor: `${C.accent} transparent transparent transparent` }} />
      </div>
    );
  }

  const isOwner = currentWorkspace.userRole === 'OWNER';
  const isAdmin = currentWorkspace.userRole === 'ADMIN';
  const accentColor = currentWorkspace.color || C.accent;

  if (!isOwner && !isAdmin) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px', textAlign: 'center', gap: '12px' }}>
        <AlertTriangle style={{ width: '20px', height: '20px', color: C.red }} />
        <p style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{t.ws_settings_no_permission_title}</p>
        <p style={{ fontSize: '12.5px', color: C.text3 }}>{t.ws_settings_no_permission_desc}</p>
        <Link href={`/dashboard/workspaces/${workspaceId}`} style={{ fontSize: '12px', color: C.accent }}>← Volver al workspace</Link>
      </div>
    );
  }

  const handleSave = async () => {
    try {
      await updateWorkspace(workspaceId, { name, description, icon: selectedIcon, color: selectedColor });
      setShowSuccess(true); setTimeout(() => setShowSuccess(false), 3000);
    } catch {}
  };

  const handleDelete  = async () => { await deleteWorkspace(workspaceId); router.push('/dashboard/workspaces'); };
  const handleArchive = async () => { await archiveWorkspace(workspaceId); setShowArchiveConfirm(false); router.push('/dashboard/workspaces'); };
  const handleRestore = async () => { await restoreWorkspace(workspaceId); router.push(`/dashboard/workspaces/${workspaceId}`); };

  const handleDuplicate = async () => {
    setIsDuplicating(true);
    try {
      const newWs = await duplicateWorkspace(workspaceId, duplicateBoards);
      setDuplicateSuccess(true);
      setTimeout(() => { setDuplicateSuccess(false); router.push(`/dashboard/workspaces/${newWs.id}`); }, 1500);
    } catch {} finally { setIsDuplicating(false); }
  };

  const handleCopyInvite = () => {
    if (!currentWorkspace?.inviteToken) return;
    navigator.clipboard.writeText(`${window.location.origin}/join/${currentWorkspace.inviteToken}`);
    setInviteCopied(true); setTimeout(() => setInviteCopied(false), 2000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '7px 10px', borderRadius: '6px',
    background: C.bg2, border: `1px solid ${C.border}`,
    color: C.text, fontSize: '13px', outline: 'none', boxSizing: 'border-box',
  };
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: '11px', fontWeight: 500, color: C.text4, marginBottom: '5px', letterSpacing: '0.02em',
  };
  const btnSecondary: React.CSSProperties = {
    display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 12px', borderRadius: '6px',
    fontSize: '12px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`,
    color: C.text2, cursor: 'pointer',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', background: C.bg, minHeight: '100%' }}>

      {/* Header */}
      <div style={{ padding: '12px 22px', borderBottom: `1px solid ${C.border}`, background: C.bg2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '30px', height: '30px', borderRadius: '7px', background: `linear-gradient(135deg, ${accentColor}cc, ${accentColor}55)`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <WorkspaceIcon icon={currentWorkspace.icon} className="w-3.5 h-3.5" style={{ color: '#fff' } as any} />
          </div>
          <div>
            <p style={{ fontSize: '13.5px', fontWeight: 700, color: C.text, lineHeight: 1 }}>{currentWorkspace.name}</p>
            <p style={{ fontSize: '11px', color: C.text4, marginTop: '2px' }}>Configuración</p>
          </div>
        </div>
        <Link
          href={`/dashboard/workspaces/${workspaceId}`}
          style={{ fontSize: '12px', padding: '5px 11px', borderRadius: '6px', background: C.surface, border: `1px solid ${C.border2}`, color: C.text3, display: 'flex', alignItems: 'center', gap: '4px' }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.color = C.text2; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.color = C.text3; }}
        >
          ← Volver
        </Link>
      </div>

      {/* Success banner */}
      {showSuccess && (
        <div style={{ margin: '14px 22px 0', padding: '8px 12px', borderRadius: '7px', background: `${C.green}15`, border: `1px solid ${C.green}40`, display: 'flex', alignItems: 'center', gap: '7px' }}>
          <CheckCircle style={{ width: '13px', height: '13px', color: C.green, flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: C.green }}>{t.ws_settings_success_title}</span>
        </div>
      )}

      {/* ── Main: 3 columnas iguales ── */}
      <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', alignItems: 'start' }}>

          {/* ── Col 1: Ajustes generales ── */}
          <Card>
            <CardHeader icon={<Settings style={{ width: '13px', height: '13px' }} />} title="Ajustes generales" />
            <div style={{ padding: '13px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

              {/* Nombre + Descripción en la misma fila */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={labelStyle}>{t.ws_settings_label_name}</label>
                  <input
                    type="text" value={name} onChange={(e) => setName(e.target.value)}
                    placeholder={t.ws_settings_placeholder_name} maxLength={255}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
                <div>
                  <label style={labelStyle}>{t.ws_settings_label_description}</label>
                  <input
                    type="text" value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder={t.ws_settings_placeholder_description} maxLength={255}
                    style={inputStyle}
                    onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                    onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                  />
                </div>
              </div>

              {/* Iconos + Colores — mismo grid 1fr/1fr que nombre/descripción */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {/* Iconos — auto-fill 26px */}
                <div>
                  <label style={labelStyle}>{t.ws_settings_label_icon}</label>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, 26px)', gap: '2px' }}>
                    {WORKSPACE_ICON_KEYS.map((key) => (
                      <button
                        key={key} type="button" title={key} onClick={() => setSelectedIcon(key)}
                        style={{
                          width: '26px', height: '26px', borderRadius: '5px', padding: 0,
                          border: `1px solid ${selectedIcon === key ? accentColor + '55' : C.border}`,
                          background: selectedIcon === key ? `${accentColor}15` : 'transparent',
                          color: selectedIcon === key ? accentColor : C.text4,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          cursor: 'pointer', transition: 'all 0.1s',
                        }}
                        onMouseEnter={(e) => { if (selectedIcon !== key) { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3; }}}
                        onMouseLeave={(e) => { if (selectedIcon !== key) { e.currentTarget.style.borderColor = C.border; e.currentTarget.style.color = C.text4; }}}
                      >
                        <WorkspaceIcon icon={key} style={{ width: '13px', height: '13px' }} />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Colores — dots 20px, flex-wrap para llenar el ancho */}
                <div>
                  <label style={labelStyle}>{t.ws_settings_label_color}</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                    {COLORS.map((color) => (
                      <button
                        key={color} type="button" onClick={() => setSelectedColor(color)}
                        style={{
                          width: '20px', height: '20px', borderRadius: '50%', background: color,
                          cursor: 'pointer', padding: 0, flexShrink: 0,
                          border: selectedColor === color ? `2px solid rgba(255,255,255,0.65)` : `2px solid transparent`,
                          outline: selectedColor === color ? `1px solid ${color}55` : 'none',
                          outlineOffset: '1px',
                          transform: selectedColor === color ? 'scale(1.12)' : 'scale(1)',
                          transition: 'transform 0.1s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Vista previa — debajo */}
              <div style={{
                padding: '6px 10px', borderRadius: '6px',
                border: `1px solid ${selectedColor}28`,
                background: `linear-gradient(135deg, ${selectedColor}12, transparent)`,
                display: 'flex', alignItems: 'center', gap: '7px',
              }}>
                <div style={{
                  width: '22px', height: '22px', borderRadius: '5px', flexShrink: 0,
                  background: `linear-gradient(135deg, ${selectedColor}cc, ${selectedColor}55)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <WorkspaceIcon icon={selectedIcon} style={{ width: '11px', height: '11px', color: '#fff' } as any} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: 600, color: name ? C.text : C.text4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {name || 'Nombre del workspace'}
                  </span>
                  {description && (
                    <span style={{ fontSize: '10.5px', color: C.text4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '1px' }}>
                      {description}
                    </span>
                  )}
                </div>
              </div>

              {/* Guardar + acciones de peligro inline */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                <button
                  onClick={handleSave} disabled={isLoading || !name.trim()}
                  style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 13px', borderRadius: '6px', fontSize: '12px', fontWeight: 600, background: accentColor, color: '#fff', border: 'none', cursor: 'pointer', opacity: !name.trim() ? 0.5 : 1 }}
                >
                  <Save style={{ width: '11px', height: '11px' }} />
                  {isLoading ? t.btn_saving : t.btn_save}
                </button>
                <Link href={`/dashboard/workspaces/${workspaceId}`} style={btnSecondary as any}>
                  {t.btn_cancel}
                </Link>

                {isOwner && (
                  <>
                    <div style={{ flex: 1 }} />
                    {/* Archivar */}
                    {currentWorkspace.archived ? (
                      <button onClick={handleRestore} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, background: 'transparent', border: `1px solid ${C.amber}30`, color: C.amber, cursor: 'pointer' }}>
                        <ArchiveRestore style={{ width: '11px', height: '11px' }} /> {t.ws_settings_btn_restore}
                      </button>
                    ) : !showArchiveConfirm ? (
                      <button onClick={() => { setShowArchiveConfirm(true); setShowDeleteConfirm(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, background: 'transparent', border: `1px solid ${C.border}`, color: C.text3, cursor: 'pointer' }}>
                        <Archive style={{ width: '11px', height: '11px' }} /> Archivar
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={handleArchive} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: C.amber, color: '#fff', border: 'none', cursor: 'pointer' }}>
                          <Archive style={{ width: '10px', height: '10px' }} /> {t.ws_settings_btn_confirm_archive}
                        </button>
                        <button onClick={() => setShowArchiveConfirm(false)} style={{ ...btnSecondary, padding: '5px 8px', fontSize: '11px' }}>{t.btn_cancel}</button>
                      </div>
                    )}
                    {/* Eliminar */}
                    {!showDeleteConfirm ? (
                      <button onClick={() => { setShowDeleteConfirm(true); setShowArchiveConfirm(false); }} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, background: 'transparent', border: `1px solid ${C.border}`, color: C.text3, cursor: 'pointer' }}>
                        <Trash2 style={{ width: '11px', height: '11px' }} /> Eliminar
                      </button>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <button onClick={handleDelete} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '5px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 600, background: C.red, color: '#fff', border: 'none', cursor: 'pointer' }}>
                          <Trash2 style={{ width: '10px', height: '10px' }} /> {t.ws_settings_btn_confirm_delete}
                        </button>
                        <button onClick={() => setShowDeleteConfirm(false)} style={{ ...btnSecondary, padding: '5px 8px', fontSize: '11px' }}>{t.btn_cancel}</button>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </Card>

          {/* ── Col 2: Visibilidad + Duplicar ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {(isOwner || isAdmin) && (
              <Card>
                <CardHeader icon={<Globe style={{ width: '13px', height: '13px' }} />} title={t.ws_settings_visibility_title} />
                <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    {[
                      { value: 'private' as const, icon: <Lock style={{ width: '11px', height: '11px' }} />, label: t.ws_settings_visibility_private },
                      { value: 'public'  as const, icon: <Globe style={{ width: '11px', height: '11px' }} />, label: t.ws_settings_visibility_public  },
                    ].map(({ value, icon, label }) => {
                      const active = value === 'public' ? currentWorkspace.visibility === 'public' : currentWorkspace.visibility !== 'public';
                      return (
                        <button key={value} onClick={() => updateVisibility(workspaceId, value)} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px 6px', borderRadius: '6px', cursor: 'pointer', border: `1px solid ${active ? accentColor + '50' : C.border}`, background: active ? `${accentColor}12` : C.bg2, color: active ? accentColor : C.text3, fontSize: '11.5px', fontWeight: active ? 600 : 400, transition: 'all 0.12s' }}>
                          {icon} {label}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ paddingTop: '8px', borderTop: `1px solid ${C.border}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '6px' }}>
                      <Link2 style={{ width: '10px', height: '10px', color: C.text4 }} />
                      <span style={{ fontSize: '11px', fontWeight: 500, color: C.text3 }}>{t.ws_settings_invite_link_title}</span>
                    </div>
                    {currentWorkspace.inviteToken ? (
                      <>
                        <div style={{ padding: '5px 8px', borderRadius: '5px', background: C.bg2, border: `1px solid ${C.border}`, marginBottom: '6px' }}>
                          <code style={{ fontSize: '9.5px', color: C.text4, wordBreak: 'break-all', lineHeight: 1.5 }}>
                            {typeof window !== 'undefined'
                              ? `${window.location.origin}/join/${currentWorkspace.inviteToken}`
                              : `/join/${currentWorkspace.inviteToken}`}
                          </code>
                        </div>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                          <button onClick={handleCopyInvite} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: inviteCopied ? C.green : C.text2, cursor: 'pointer' }}>
                            {inviteCopied ? <CheckCircle style={{ width: '10px', height: '10px' }} /> : <Copy style={{ width: '10px', height: '10px' }} />}
                            {inviteCopied ? t.ws_settings_link_copied : t.ws_settings_btn_copy_link}
                          </button>
                          <button onClick={() => regenerateInviteToken(workspaceId)} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}>
                            <RefreshCw style={{ width: '10px', height: '10px' }} /> {t.ws_settings_btn_generate_link}
                          </button>
                          <button onClick={() => revokeInviteToken(workspaceId)} style={{ display: 'flex', alignItems: 'center', gap: '3px', padding: '4px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, background: `${C.red}10`, border: `1px solid ${C.red}28`, color: C.red, cursor: 'pointer' }}>
                            <X style={{ width: '10px', height: '10px' }} /> {t.ws_settings_btn_revoke_link}
                          </button>
                        </div>
                      </>
                    ) : (
                      <button onClick={() => regenerateInviteToken(workspaceId)} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, background: `${C.accent}10`, border: `1px solid ${C.accent}28`, color: C.accent, cursor: 'pointer' }}>
                        <Link2 style={{ width: '11px', height: '11px' }} /> {t.ws_settings_btn_generate_link}
                      </button>
                    )}
                  </div>
                </div>
              </Card>
            )}

            {(isOwner || isAdmin) && (
              <Card>
                <CardHeader icon={<Copy style={{ width: '13px', height: '13px' }} />} title={t.ws_settings_duplicate_title} />
                <div style={{ padding: '11px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '11px', color: C.text4, lineHeight: 1.5 }}>{t.ws_settings_duplicate_desc}</p>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    <input type="checkbox" checked={duplicateBoards} onChange={(e) => setDuplicateBoards(e.target.checked)} style={{ accentColor: accentColor, width: '12px', height: '12px' }} />
                    <span style={{ fontSize: '11.5px', color: C.text2 }}>{t.ws_settings_duplicate_include_boards}</span>
                  </label>
                  {duplicateSuccess ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '7px 10px', borderRadius: '6px', background: `${C.green}12`, border: `1px solid ${C.green}28` }}>
                      <CheckCircle style={{ width: '12px', height: '12px', color: C.green }} />
                      <span style={{ fontSize: '11.5px', color: C.green, fontWeight: 500 }}>{t.ws_settings_duplicate_success}</span>
                    </div>
                  ) : (
                    <button onClick={handleDuplicate} disabled={isDuplicating} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '6px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', opacity: isDuplicating ? 0.6 : 1 }}>
                      <Copy style={{ width: '11px', height: '11px' }} />
                      {isDuplicating ? '…' : t.ws_settings_btn_duplicate}
                    </button>
                  )}
                </div>
              </Card>
            )}
          </div>

          {/* ── Col 3: GitHub ── */}
          {(isOwner || isAdmin) && (
            <Card>
              <CardHeader
                icon={<Github style={{ width: '13px', height: '13px' }} />}
                title="GitHub"
                right={ghConnection
                  ? <span style={{ fontSize: '10px', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', background: `${C.green}15`, border: `1px solid ${C.green}30`, color: C.green }}>@{ghConnection.githubLogin}</span>
                  : undefined
                }
              />
              <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {ghSuccess && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', background: `${C.green}12`, border: `1px solid ${C.green}28` }}>
                    <CheckCircle style={{ width: '11px', height: '11px', color: C.green, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: C.green }}>{ghSuccess}</span>
                  </div>
                )}
                {ghError && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '6px', background: `${C.red}10`, border: `1px solid ${C.red}28` }}>
                    <AlertTriangle style={{ width: '11px', height: '11px', color: C.red, flexShrink: 0 }} />
                    <span style={{ fontSize: '11px', color: C.red, flex: 1 }}>{ghError}</span>
                    <button onClick={() => setGhError('')} style={{ color: C.red, background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}><X style={{ width: '11px', height: '11px' }} /></button>
                  </div>
                )}

                {ghConnection ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <p style={{ fontSize: '11px', color: C.text4, lineHeight: 1.5 }}>Eventos de push, PR y review de repos vinculados.</p>
                    <div>
                      <p style={{ fontSize: '10.5px', fontWeight: 500, color: C.text4, marginBottom: '4px' }}>Repos vinculados</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                        {ghConnection.repos.map((repo) => (
                          <div key={repo} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '5px 8px', borderRadius: '5px', background: C.bg2, border: `1px solid ${C.border}` }}>
                            <Github style={{ width: '10px', height: '10px', color: C.text4, flexShrink: 0 }} />
                            <span style={{ fontSize: '10.5px', fontFamily: 'monospace', color: C.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo}</span>
                            <a href={`https://github.com/${repo}`} target="_blank" rel="noopener noreferrer"><ExternalLink style={{ width: '10px', height: '10px', color: C.text4 }} /></a>
                          </div>
                        ))}
                      </div>
                    </div>
                    <button onClick={handleGhDisconnect} disabled={ghDisconnecting} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '5px 10px', borderRadius: '5px', fontSize: '11px', fontWeight: 500, background: `${C.red}10`, border: `1px solid ${C.red}28`, color: C.red, cursor: 'pointer' }}>
                      <Unlink style={{ width: '11px', height: '11px' }} />
                      {ghDisconnecting ? 'Desconectando…' : 'Desconectar GitHub'}
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '9px' }}>
                    <div style={{ borderRadius: '6px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
                      <button onClick={() => setGhTutorialOpen(v => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', background: C.bg2, border: 'none', cursor: 'pointer' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', fontWeight: 500, color: C.text3 }}>
                          <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: `${C.accent}18`, border: `1px solid ${C.accent}33`, color: C.accent, fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>?</span>
                          ¿Cómo genero el token?
                        </span>
                        {ghTutorialOpen ? <ChevronUp style={{ width: '11px', height: '11px', color: C.text4 }} /> : <ChevronDown style={{ width: '11px', height: '11px', color: C.text4 }} />}
                      </button>
                      {ghTutorialOpen && (
                        <div style={{ padding: '8px 10px 10px', borderTop: `1px solid ${C.border}`, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <ol style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {[
                              'GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic).',
                              'Generate new token (classic).',
                              'Scopes: repo y read:org.',
                              'Genera, copia el token (ghp_...) y pégalo abajo.',
                            ].map((step, i) => (
                              <li key={i} style={{ display: 'flex', gap: '6px', fontSize: '10.5px', color: C.text4, lineHeight: 1.5 }}>
                                <span style={{ width: '13px', height: '13px', borderRadius: '50%', background: `${C.accent}12`, border: `1px solid ${C.accent}28`, color: C.accent, fontSize: '8px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: '1px' }}>{i + 1}</span>
                                <span>{step}</span>
                              </li>
                            ))}
                          </ol>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 8px', borderRadius: '4px', background: `${C.amber}08`, border: `1px solid ${C.amber}20` }}>
                            <AlertTriangle style={{ width: '10px', height: '10px', color: C.amber, flexShrink: 0 }} />
                            <span style={{ fontSize: '10px', color: C.amber }}>Token almacenado cifrado.</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label style={labelStyle}>Personal Access Token</label>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <div style={{ position: 'relative', flex: 1 }}>
                          <input
                            type={ghTokenVisible ? 'text' : 'password'}
                            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                            value={ghToken}
                            autoComplete="new-password"
                            onChange={(e) => { setGhToken(e.target.value); setGhRepos([]); setGhSelected([]); setGhError(''); }}
                            style={{ ...inputStyle, fontFamily: 'monospace', paddingRight: '28px' }}
                            onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                            onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
                          />
                          <button type="button" onClick={() => setGhTokenVisible(v => !v)} style={{ position: 'absolute', right: '7px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: C.text4, padding: 0, display: 'flex' }}>
                            {ghTokenVisible ? <EyeOff style={{ width: '11px', height: '11px' }} /> : <Eye style={{ width: '11px', height: '11px' }} />}
                          </button>
                        </div>
                        <button onClick={() => fetchGhRepos(ghToken)} disabled={!ghToken.trim() || ghReposLoading} style={{ display: 'flex', alignItems: 'center', padding: '7px 10px', borderRadius: '6px', fontSize: '11px', fontWeight: 500, background: C.hover, border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer', whiteSpace: 'nowrap', opacity: !ghToken.trim() ? 0.5 : 1 }}>
                          {ghReposLoading ? '…' : 'Cargar'}
                        </button>
                      </div>
                    </div>

                    {ghRepos.length > 0 && (
                      <div>
                        <label style={labelStyle}>Repos <span style={{ color: C.text4 }}>({ghSelected.length} sel.)</span></label>
                        <div style={{ maxHeight: '130px', overflowY: 'auto', borderRadius: '5px', border: `1px solid ${C.border}`, background: C.bg2 }}>
                          {ghRepos.map((repo) => {
                            const sel = ghSelected.includes(repo.fullName);
                            return (
                              <label key={repo.fullName} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 8px', cursor: 'pointer', borderBottom: `1px solid ${C.border}`, background: sel ? `${C.accent}08` : 'transparent' }}>
                                <input type="checkbox" checked={sel} onChange={() => setGhSelected(prev => sel ? prev.filter(r => r !== repo.fullName) : [...prev, repo.fullName])} style={{ accentColor: C.accent, width: '11px', height: '11px' }} />
                                <span style={{ fontFamily: 'monospace', fontSize: '10.5px', color: sel ? C.text : C.text2, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{repo.fullName}</span>
                                {repo.private && <span style={{ fontSize: '8px', fontWeight: 600, padding: '1px 4px', borderRadius: '3px', background: C.hover, border: `1px solid ${C.border2}`, color: C.text4 }}>PRIV</span>}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <button onClick={handleGhConnect} disabled={!ghToken.trim() || ghSelected.length === 0 || ghConnecting} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', padding: '7px', borderRadius: '6px', fontSize: '11.5px', fontWeight: 600, background: '#24292e', color: '#fff', border: 'none', cursor: 'pointer', opacity: (!ghToken.trim() || ghSelected.length === 0) ? 0.45 : 1 }}>
                      <Github style={{ width: '12px', height: '12px' }} />
                      {ghConnecting ? 'Conectando…' : 'Conectar con GitHub'}
                    </button>
                  </div>
                )}
              </div>
            </Card>
          )}
        </div>

      </div>
    </div>
  );
}
