// apps/web/src/app/dashboard/workspaces/[id]/documents/[documentId]/page.tsx
'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { socketService } from '@/services/socketService';
import { useToast } from '@/hooks/use-toast';
import { useT } from '@/lib/i18n';
import {
  ArrowLeft,
  Users,
  Clock,
  MoreVertical,
  Trash2,
  Share2,
  Download,
  FileText,
} from 'lucide-react';
import { recordRecentDoc } from '@/lib/utils/recentDocs';
import { C } from '@/lib/colors';

const CollaborativeEditor = lazy(() => import('@/components/documents/CollaborativeEditor'));

// ─── Design tokens ────────────────────────────────────────────────────────────


// ─── User color ───────────────────────────────────────────────────────────────

function getUserColor(userId: string): string {
  const colors = ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#74B9FF','#A29BFE','#FD79A8','#FDCB6E','#00B894'];
  let hash = 0;
  for (let i = 0; i < userId.length; i++) hash = userId.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

// ─── Página ───────────────────────────────────────────────────────────────────

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();
  const t = useT();

  const workspaceId  = params.id as string;
  const documentId   = params.documentId as string;

  const {
    currentDocument, isLoading, error: documentError,
    activeUsers, fetchDocumentById, updateDocument, deleteDocument,
    getDocumentMembers, updatePermission, leaveDocument,
  } = useDocumentStore();
  const { currentWorkspace, fetchMembers } = useWorkspaceStore();
  const { user, accessToken } = useAuthStore();
  const { toast } = useToast();

  const [title,             setTitle]             = useState('');
  const [isSavingTitle,     setIsSavingTitle]     = useState(false);
  const [showOptionsMenu,   setShowOptionsMenu]   = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const [showShareModal,    setShowShareModal]     = useState(false);
  const [members,           setMembers]           = useState<any[]>([]);
  const [loadingMembers,    setLoadingMembers]    = useState(false);
  const [updatingPermission,setUpdatingPermission]= useState<string | null>(null);
  const [showExportMenu,    setShowExportMenu]    = useState(false);
  const [isExporting,       setIsExporting]       = useState(false);

  useEffect(() => {
    if (documentId) {
      fetchDocumentById(documentId);
      if (workspaceId) recordRecentDoc(workspaceId, documentId);
    }
    return () => { if (documentId) leaveDocument(documentId); };
  }, [documentId, workspaceId, fetchDocumentById, leaveDocument]);

  useEffect(() => {
    if (workspaceId) fetchMembers(workspaceId);
  }, [workspaceId, fetchMembers]);

  useEffect(() => {
    const handlePermissionChanged = (data: { documentId: string; permission: 'VIEW' | 'COMMENT' | 'EDIT'; updatedBy: string }) => {
      if (data.documentId !== documentId) return;
      fetchDocumentById(documentId);
      const cfg = {
        EDIT:    { title: '✏️ Ahora puedes editar',   description: 'Se te han otorgado permisos de edición', variant: 'default'      as const },
        COMMENT: { title: '💬 Ahora puedes comentar', description: 'Puedes agregar comentarios pero no editar', variant: 'default'    as const },
        VIEW:    { title: '👁️ Solo lectura',          description: 'Tus permisos de edición han sido removidos', variant: 'destructive' as const },
      }[data.permission];
      toast(cfg);
    };
    socketService.onPermissionChanged(handlePermissionChanged);
    return () => { socketService.off('document:permission:changed', handlePermissionChanged); };
  }, [documentId, fetchDocumentById, toast]);

  useEffect(() => {
    if (currentDocument) setTitle(currentDocument.title);
  }, [currentDocument]);

  const handleTitleBlur = async () => {
    if (!currentDocument || title === currentDocument.title) return;
    setIsSavingTitle(true);
    try { await updateDocument(documentId, { title }); }
    catch { setTitle(currentDocument.title); }
    finally { setIsSavingTitle(false); }
  };

  const handleBack = () => router.push(`/dashboard/workspaces/${workspaceId}?tab=docs`);

  const handleShareClick = async () => {
    setShowOptionsMenu(false);
    setShowShareModal(true);
    setLoadingMembers(true);
    try { setMembers(await getDocumentMembers(documentId)); }
    catch {}
    finally { setLoadingMembers(false); }
  };

  const handlePermissionChange = async (userId: string, permission: string) => {
    setUpdatingPermission(userId);
    try {
      await updatePermission(documentId, userId, permission as any);
      setMembers(await getDocumentMembers(documentId));
      toast({ title: 'Permisos actualizados', description: 'Los permisos han sido modificados correctamente' });
    } catch {
      toast({ title: 'Error al actualizar permisos', description: 'No se pudo modificar los permisos.', variant: 'destructive' });
    } finally { setUpdatingPermission(null); }
  };

  const handleDeleteClick = () => { setShowOptionsMenu(false); setShowDeleteModal(true); };

  const handleConfirmDelete = async () => {
    if (!currentDocument) return;
    setIsDeleting(true);
    try {
      await deleteDocument(documentId);
      toast({ title: '🗑️ Documento eliminado', description: 'El documento ha sido eliminado correctamente' });
      router.push(`/dashboard/workspaces/${workspaceId}?tab=docs`);
    } catch {
      toast({ title: 'Error al eliminar', description: 'No se pudo eliminar el documento.', variant: 'destructive' });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const handleExport = async (format: 'pdf' | 'html' | 'markdown') => {
    if (!currentDocument) return;
    setIsExporting(true);
    setShowExportMenu(false);
    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      const response = await fetch(`${apiUrl}/api/documents/${documentId}/export?format=${format}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        let msg = 'No se pudo exportar el documento.';
        try {
          if (response.status === 403) msg = 'Sin permiso para exportar este documento.';
          else if (response.status === 404) msg = 'El documento no tiene contenido para exportar.';
          else { const d = await response.json(); if (d?.error?.message) msg = d.error.message; }
        } catch {}
        throw new Error(msg);
      }
      const blob = await response.blob();
      const url  = window.URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      const ext  = { pdf: 'pdf', html: 'html', markdown: 'md' }[format];
      const safe = currentDocument.title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      a.download = `${safe}_${new Date().toISOString().split('T')[0]}.${ext}`;
      document.body.appendChild(a); a.click();
      window.URL.revokeObjectURL(url); document.body.removeChild(a);
      toast({ title: '✅ Documento exportado', description: `Exportado en formato ${format.toUpperCase()}` });
    } catch (error: any) {
      toast({ title: 'Error al exportar', description: error?.message || 'No se pudo exportar.', variant: 'destructive' });
    } finally { setIsExporting(false); }
  };

  const documentReady = !isLoading && currentDocument?.id === documentId && user;

  // ── Loading / error ────────────────────────────────────────────────────────
  if (documentError && !documentReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '10px', margin: '0 auto 16px',
            background: `${C.red}15`, border: `1px solid ${C.red}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: C.red, fontSize: '18px', fontWeight: 700 }}>!</span>
          </div>
          <p style={{ fontSize: '13px', color: C.text3, marginBottom: '16px' }}>{documentError}</p>
          <SmallBackBtn onClick={() => router.push(`/dashboard/workspaces/${workspaceId}?tab=docs`)} label={t.btn_back} />
        </div>
      </div>
    );
  }

  if (!documentReady) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: C.bg }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 14px',
            border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
            animation: 'spin 0.7s linear infinite',
          }} />
          <p style={{ fontSize: '13px', color: C.text3, marginBottom: '16px' }}>{t.document_loading}</p>
          <SmallBackBtn onClick={() => router.push(`/dashboard/workspaces/${workspaceId}?tab=docs`)} label={t.btn_back} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!currentDocument || !user) return null;

  const userPermission = currentDocument.userPermission || 'VIEW';
  const canEdit        = userPermission === 'EDIT';
  const isCreator      = currentDocument.creator?.id === user.id;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header style={{
        flexShrink: 0, background: C.surface,
        borderBottom: `1px solid ${C.border}`,
        padding: '0 20px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', height: '52px' }}>
          {/* Left: back + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <SmallBackBtn onClick={handleBack} label={t.btn_back} />
            <div style={{ width: '1px', height: '18px', background: C.border2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                onBlur={handleTitleBlur}
                disabled={!canEdit || isSavingTitle}
                placeholder="Título del documento"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '14px', fontWeight: 600, color: C.text,
                  cursor: !canEdit ? 'default' : 'text',
                }}
              />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '1px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock style={{ width: '10px', height: '10px', color: C.text4 }} />
                  <span style={{ fontSize: '10.5px', color: C.text4 }}>
                    Actualizado {formatDate(currentDocument.updatedAt)}
                  </span>
                </div>
                <span style={{ fontSize: '10.5px', color: C.text4 }}>
                  Por {currentDocument.creator?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Right: active users + badges + menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
            {/* Active users */}
            {activeUsers.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Users style={{ width: '13px', height: '13px', color: C.text4 }} />
                <div style={{ display: 'flex' }}>
                  {activeUsers.slice(0, 4).map((u, i) => (
                    <div
                      key={u.id}
                      title={u.name}
                      style={{
                        width: '24px', height: '24px', borderRadius: '50%',
                        border: `2px solid ${C.surface}`,
                        marginLeft: i === 0 ? 0 : '-7px',
                        background: u.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700, color: '#fff',
                        position: 'relative', zIndex: 4 - i,
                      }}
                    >
                      {u.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {activeUsers.length > 4 && (
                    <div style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      border: `2px solid ${C.surface}`, marginLeft: '-7px',
                      background: C.hover, color: C.text3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 600,
                    }}>
                      +{activeUsers.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Read-only badge */}
            {!canEdit && (
              <div style={{
                padding: '3px 9px', borderRadius: '5px', fontSize: '11px', fontWeight: 500,
                background: `${C.amber}15`, border: `1px solid ${C.amber}35`, color: C.amber,
              }}>
                Solo lectura
              </div>
            )}

            {/* Options menu */}
            {isCreator && (
              <div style={{ position: 'relative' }}>
                <OptionsBtn active={showOptionsMenu} onClick={() => { setShowOptionsMenu(!showOptionsMenu); setShowExportMenu(false); }} />

                {showOptionsMenu && (
                  <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => { setShowOptionsMenu(false); setShowExportMenu(false); }} />
                    <div style={{
                      position: 'absolute', right: 0, top: 'calc(100% + 6px)',
                      width: '180px', background: C.surface, border: `1px solid ${C.border2}`,
                      borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                      overflow: 'hidden', zIndex: 20,
                      padding: '4px',
                    }}>
                      <MenuItem icon={<Share2 style={{ width: '13px', height: '13px' }} />} label="Compartir" onClick={handleShareClick} />

                      {/* Export submenu */}
                      <div style={{ position: 'relative' }}>
                        <MenuItem
                          icon={<Download style={{ width: '13px', height: '13px' }} />}
                          label="Exportar"
                          disabled={isExporting}
                          suffix={<span style={{ marginLeft: 'auto', color: C.text4, fontSize: '11px' }}>›</span>}
                          onClick={() => setShowExportMenu(!showExportMenu)}
                        />
                        {showExportMenu && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setShowExportMenu(false)} />
                            <div style={{
                              position: 'absolute', right: 'calc(100% + 4px)', top: 0,
                              width: '130px', background: C.surface, border: `1px solid ${C.border2}`,
                              borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                              overflow: 'hidden', zIndex: 30, padding: '4px',
                            }}>
                              {(['pdf', 'html', 'markdown'] as const).map((fmt) => (
                                <MenuItem
                                  key={fmt}
                                  icon={<FileText style={{ width: '13px', height: '13px' }} />}
                                  label={fmt.toUpperCase()}
                                  disabled={isExporting}
                                  onClick={() => handleExport(fmt)}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      <div style={{ height: '1px', background: C.border, margin: '4px 0' }} />
                      <MenuItem
                        icon={<Trash2 style={{ width: '13px', height: '13px' }} />}
                        label={t.document_btn_delete}
                        onClick={handleDeleteClick}
                        danger
                      />
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── Editor ────────────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Suspense fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{
                width: '24px', height: '24px', borderRadius: '50%', margin: '0 auto 12px',
                border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
                animation: 'spin 0.7s linear infinite',
              }} />
              <p style={{ fontSize: '12.5px', color: C.text4 }}>Cargando editor…</p>
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          </div>
        }>
          <CollaborativeEditor
            documentId={documentId}
            workspaceId={workspaceId}
            currentUser={{ id: user.id, name: user.name, color: getUserColor(user.id) }}
            canEdit={canEdit}
          />
        </Suspense>
      </div>

      {/* ── Modal: Compartir ───────────────────────────────────────────────── */}
      {showShareModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowShareModal(false); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '560px', maxHeight: '80vh',
              display: 'flex', flexDirection: 'column',
              background: '#13161b', border: `1px solid ${C.border}`,
              borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{
                  width: '28px', height: '28px', borderRadius: '7px',
                  background: `${C.accent}18`, border: `1px solid ${C.accent}33`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Share2 style={{ width: '13px', height: '13px', color: C.accent }} />
                </div>
                <div>
                  <div style={{ fontSize: '15px', fontWeight: 600, color: C.text }}>Compartir documento</div>
                  <div style={{ fontSize: '11.5px', color: C.text4 }}>Gestiona quién puede ver y editar este documento</div>
                </div>
              </div>
              <ModalCloseBtn onClick={() => setShowShareModal(false)} />
            </div>

            {/* Body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
              {loadingMembers ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '32px 0' }}>
                  <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {members.map((member) => {
                    const isOwner   = member.workspaceRole === 'OWNER';
                    const isCreator = member.isCreator;
                    const isLocked  = isOwner || isCreator;
                    const av        = getAvatarUrl(member.avatar);

                    return (
                      <div
                        key={member.userId}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '12px',
                          padding: '10px 12px', borderRadius: '8px',
                          background: C.surface, border: `1px solid ${C.border}`,
                        }}
                      >
                        {/* Avatar */}
                        <div style={{
                          width: '34px', height: '34px', borderRadius: '50%', flexShrink: 0,
                          background: `${C.accent}22`, color: C.accent,
                          fontSize: '13px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          overflow: 'hidden',
                        }}>
                          {av ? (
                            <img src={av} alt={member.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} crossOrigin="anonymous" />
                          ) : (
                            member.name.charAt(0).toUpperCase()
                          )}
                        </div>

                        {/* Info */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '1px' }}>
                            <span style={{ fontSize: '13px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {member.name}
                            </span>
                            {isCreator && (
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: `${C.accent}18`, color: C.accent, border: `1px solid ${C.accent}33`, flexShrink: 0 }}>
                                Creador
                              </span>
                            )}
                            {isOwner && (
                              <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: `${C.green}15`, color: C.green, border: `1px solid ${C.green}33`, flexShrink: 0 }}>
                                Propietario
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '11.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                            {member.email}
                          </span>
                        </div>

                        {/* Permission select */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                          <select
                            value={member.effectivePermission}
                            onChange={(e) => handlePermissionChange(member.userId, e.target.value)}
                            disabled={isLocked || updatingPermission === member.userId}
                            style={{
                              padding: '5px 8px', borderRadius: '6px', fontSize: '12px',
                              background: C.bg2, border: `1px solid ${C.border2}`, color: C.text2,
                              cursor: isLocked ? 'not-allowed' : 'pointer', outline: 'none',
                              opacity: isLocked ? 0.5 : 1,
                            }}
                          >
                            <option value="VIEW">Ver</option>
                            <option value="COMMENT">Comentar</option>
                            <option value="EDIT">Editar</option>
                          </select>
                          {updatingPermission === member.userId && (
                            <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: `2px solid ${C.accent}`, borderTopColor: 'transparent', animation: 'spin 0.7s linear infinite' }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '12px 20px 16px', borderTop: `1px solid ${C.border}`, background: '#111418', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowShareModal(false)}
                style={{
                  padding: '7px 18px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  background: C.accent, color: '#fff', border: 'none', cursor: 'pointer',
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Eliminar ────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false); }}
        >
          <div
            style={{
              width: '100%', maxWidth: '420px',
              background: '#13161b', border: `1px solid ${C.border}`,
              borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ padding: '24px 24px 20px' }}>
              <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '9px', flexShrink: 0,
                  background: `${C.red}15`, border: `1px solid ${C.red}40`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Trash2 style={{ width: '16px', height: '16px', color: C.red }} />
                </div>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: C.text, marginBottom: '8px' }}>
                    {t.document_delete_modal_title}
                  </h3>
                  <p style={{ fontSize: '13px', color: C.text3, lineHeight: 1.6 }}>
                    ¿Estás seguro de que deseas eliminar{' '}
                    <strong style={{ color: C.text2 }}>"{currentDocument?.title}"</strong>?{' '}
                    Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', padding: '0 24px 20px' }}>
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  background: C.hover, border: `1px solid ${C.border2}`, color: C.text2,
                  cursor: 'pointer', opacity: isDeleting ? 0.5 : 1,
                }}
              >
                {t.btn_cancel}
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                style={{
                  flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                  padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  background: C.red, color: '#fff', border: 'none',
                  cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? (
                  <>
                    <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
                      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                    </svg>
                    Eliminando…
                  </>
                ) : (
                  <><Trash2 style={{ width: '13px', height: '13px' }} /> Eliminar</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function SmallBackBtn({ onClick, label }: { onClick: () => void; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: '5px',
        padding: '5px 10px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500,
        background: h ? C.hover : 'transparent', border: `1px solid ${h ? C.border2 : 'transparent'}`,
        color: h ? C.text : C.text3, cursor: 'pointer', transition: 'all 0.12s', flexShrink: 0,
      }}
    >
      <ArrowLeft style={{ width: '13px', height: '13px' }} />
      {label}
    </button>
  );
}

function OptionsBtn({ active, onClick }: { active: boolean; onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '30px', height: '30px', borderRadius: '7px',
        background: active || h ? C.hover : 'transparent',
        border: `1px solid ${active || h ? C.border2 : 'transparent'}`,
        color: active || h ? C.text2 : C.text4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.12s',
      }}
    >
      <MoreVertical style={{ width: '15px', height: '15px' }} />
    </button>
  );
}

function ModalCloseBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '26px', height: '26px', borderRadius: '6px',
        background: h ? C.hover : 'transparent', border: 'none',
        color: h ? C.text2 : C.text4, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="11" height="11">
        <path d="M1 1l10 10M11 1L1 11" />
      </svg>
    </button>
  );
}

function MenuItem({ icon, label, onClick, disabled, danger, suffix }: {
  icon: React.ReactNode; label: string; onClick: () => void;
  disabled?: boolean; danger?: boolean; suffix?: React.ReactNode;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '8px',
        padding: '7px 10px', borderRadius: '6px', textAlign: 'left', fontSize: '12.5px', fontWeight: 500,
        background: h ? C.hover : 'transparent', border: 'none',
        color: danger ? (h ? C.red : C.text3) : (h ? C.text : C.text3),
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1,
        transition: 'all 0.1s',
      }}
    >
      {icon}
      {label}
      {suffix}
    </button>
  );
}
