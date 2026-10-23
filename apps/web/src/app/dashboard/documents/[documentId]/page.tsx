// apps/web/src/app/dashboard/documents/[documentId]/page.tsx
'use client';

import { useEffect, useState, useRef, lazy, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
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
} from 'lucide-react';
import { recordRecentDoc } from '@/lib/utils/recentDocs';
import { C } from '@/lib/colors';
import DocumentShareModal, { type DocumentShareMember, type DocumentSharePermission } from '@/components/documents/DocumentShareModal';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import styles from './documentOptions.module.css';

const CollaborativeEditor = lazy(() => import('@/components/documents/CollaborativeEditor'));

// ─── Design tokens ────────────────────────────────────────────────────────────
const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

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

  const documentId   = params.documentId as string;

  const {
    currentDocument, isLoading, error: documentError,
    activeUsers, fetchDocumentById, updateDocument, deleteDocument,
    getDocumentMembers, updatePermission, leaveDocument,
  } = useDocumentStore();
  const { currentWorkspace, fetchMembers } = useWorkspaceStore();

  // El workspace se deriva del propio documento (ruta plana /dashboard/documents/[documentId])
  const workspaceId  = currentDocument?.workspaceId ?? '';
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [title,             setTitle]             = useState('');
  const [description,       setDescription]       = useState('');
  const [isSavingTitle,     setIsSavingTitle]     = useState(false);
  const [showOptionsMenu,   setShowOptionsMenu]   = useState(false);
  const [showDeleteModal,   setShowDeleteModal]   = useState(false);
  const [isDeleting,        setIsDeleting]        = useState(false);
  const deleteDialogRef = useRef<HTMLDivElement>(null);
  const [showShareModal,    setShowShareModal]     = useState(false);
  const [members,           setMembers]           = useState<DocumentShareMember[]>([]);
  const [loadingMembers,    setLoadingMembers]    = useState(false);
  const [updatingPermission,setUpdatingPermission]= useState<string | null>(null);

  // Fetch once on mount — do NOT include workspaceId here; it's derived from
  // currentDocument and starts as '' which would retrigger this effect and
  // call fetchDocumentById again (which resets currentDocument to null → loop).
  useEffect(() => {
    if (documentId) fetchDocumentById(documentId);
    return () => { if (documentId) leaveDocument(documentId); };
  }, [documentId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onDocumentEvent = (event: any) => {
      const eventDocumentId = event?.context?.documentId ?? event?.subject?.id ?? event?.payload?.documentId;
      if (eventDocumentId !== documentId) return;
      if (event.type === 'document.updated') useDocumentStore.getState().handleEvent(event);
      if (event.type === 'document.deleted') router.replace('/dashboard/documents');
    };
    socketService.onEvent(onDocumentEvent);
    return () => socketService.off('event', onDocumentEvent);
  }, [documentId, router]);

  // Record recent doc separately, once workspaceId is resolved from the loaded doc.
  useEffect(() => {
    if (workspaceId && documentId) recordRecentDoc(workspaceId, documentId);
  }, [workspaceId, documentId]);

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
    if (currentDocument) {
      setTitle(currentDocument.title);
      setDescription(currentDocument.description ?? '');
    }
  }, [currentDocument]);

  useEffect(() => {
    if (!showDeleteModal) return;
    deleteDialogRef.current?.focus();
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isDeleting) setShowDeleteModal(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [showDeleteModal, isDeleting]);

  const handleTitleBlur = async () => {
    if (!currentDocument || title === currentDocument.title) return;
    if (!title.trim() || title.length > 180) return;
    setIsSavingTitle(true);
    try { await updateDocument(documentId, { title }); }
    catch { setTitle(currentDocument.title); }
    finally { setIsSavingTitle(false); }
  };

  const handleDescriptionBlur = async () => {
    if (!currentDocument || description === (currentDocument.description ?? '') || description.length > 300) return;
    try { await updateDocument(documentId, { description: description.trim() }); }
    catch { setDescription(currentDocument.description ?? ''); }
  };

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) router.back();
    else router.push('/dashboard/projects');
  };

  const handleShareClick = async () => {
    setShowOptionsMenu(false);
    setShowShareModal(true);
    setLoadingMembers(true);
    try { setMembers(await getDocumentMembers(documentId)); }
    catch {
      setMembers([]);
      toast({ title: 'No se pudieron cargar los permisos', description: 'Inténtalo de nuevo en unos segundos.', variant: 'destructive' });
    }
    finally { setLoadingMembers(false); }
  };

  const handlePermissionChange = async (userId: string, permission: DocumentSharePermission) => {
    setUpdatingPermission(userId);
    try {
      await updatePermission(documentId, userId, permission);
      toast({ title: 'Permisos actualizados', description: 'Los permisos han sido modificados correctamente' });
      try {
        setMembers(await getDocumentMembers(documentId));
      } catch {
        toast({ title: 'Permiso guardado', description: 'La lista no se pudo actualizar. Cierra y vuelve a abrir el modal para verla al día.' });
      }
    } catch (error) {
      toast({ title: 'Error al actualizar permisos', description: error instanceof Error ? error.message : 'No se pudieron modificar los permisos.', variant: 'destructive' });
    } finally { setUpdatingPermission(null); }
  };

  const handleDeleteClick = () => { setShowOptionsMenu(false); setShowDeleteModal(true); };

  const handleConfirmDelete = async () => {
    if (!currentDocument) return;
    setIsDeleting(true);
    try {
      await deleteDocument(documentId);
      toast({ title: 'Documento eliminado', description: 'El documento se eliminó correctamente.', variant: 'success' });
      handleBack();
    } catch {
      toast({ title: 'Error al eliminar', description: 'No se pudo eliminar el documento.', variant: 'destructive' });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

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
          <button
            type="button"
            onClick={() => { void fetchDocumentById(documentId); }}
            style={{
              marginRight: '8px', padding: '8px 14px', border: 0, borderRadius: '8px',
              background: C.accent, color: '#fff', fontSize: '13px', fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reintentar
          </button>
          <SmallBackBtn onClick={handleBack} label={t.btn_back} />
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
          <SmallBackBtn onClick={handleBack} label={t.btn_back} />
          <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
        </div>
      </div>
    );
  }

  if (!currentDocument || !user) return null;

  const userPermission = currentDocument.userPermission || 'VIEW';
  const canEdit        = userPermission === 'EDIT';
  const canComment     = userPermission === 'COMMENT' || canEdit;
  const isCreator      = currentDocument.creator?.id === user.id;
  const canManage      = Boolean(currentDocument.canManage || isCreator);

  return (
    <div className="doc-document-page" style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: C.bg }}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <header
        className="doc-header-enter doc-document-header"
        style={{
          flexShrink: 0, background: C.surface,
          borderBottom: `1px solid ${C.border}`,
          padding: '0 20px',
        }}
      >
        <div className="doc-header-mainline" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', height: '62px' }}>
          {/* Left: back + title */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
            <SmallBackBtn onClick={handleBack} label={t.btn_back} />
            <div style={{ width: '1px', height: '18px', background: C.border2, flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <input
                className="doc-title-input"
                type="text"
                value={title}
                maxLength={Math.max(180, currentDocument.title.length)}
                onChange={(e) => setTitle(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.color = 'var(--c-text)')}
                onBlur={(e) => { e.currentTarget.style.color = C.text; handleTitleBlur(); }}
                disabled={!canEdit || isSavingTitle}
                placeholder="Título del documento"
                style={{
                  width: '100%', background: 'transparent', border: 'none', outline: 'none',
                  fontSize: '16px', fontWeight: 650, color: C.text,
                  fontFamily: SORA,
                  cursor: !canEdit ? 'default' : 'text',
                  transition: 'color 0.12s',
                }}
              />
              <div className="doc-document-meta" style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '2px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <Clock style={{ width: '10px', height: '10px', color: C.text4 }} />
                  <span style={{ fontSize: '10.5px', color: C.text4, fontFamily: MANROPE }}>
                    Actualizado {formatDate(currentDocument.updatedAt)}
                  </span>
                </div>
                <span style={{ fontSize: '10px', color: title.length > 180 ? C.red : C.text4, fontFamily: MANROPE }}>{title.length}/180</span>
                <span style={{ fontSize: '10.5px', color: C.text4, fontFamily: MANROPE }}>
                  Por {currentDocument.creator?.name}
                </span>
              </div>
            </div>
          </div>

          {/* Right: active users + badges + menu */}
          <div className="doc-header-actions" style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
            {/* Active users with avatars */}
            {activeUsers.length > 0 && (
              <div className="doc-active-users" style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <div style={{ display: 'flex' }}>
                  {activeUsers.slice(0, 4).map((u: any, i: number) => (
                    <div
                      key={u.id}
                      title={u.name}
                      style={{
                        width: '26px', height: '26px', borderRadius: '50%',
                        border: `2px solid ${C.surface}`,
                        marginLeft: i === 0 ? 0 : '-7px',
                        background: u.avatar ? 'transparent' : u.color,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '9px', fontWeight: 700, color: '#fff',
                        position: 'relative', zIndex: 4 - i,
                        overflow: 'hidden', flexShrink: 0,
                      }}
                    >
                      {u.avatar
                        ? <img src={u.avatar} alt={u.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        : u.name.charAt(0).toUpperCase()
                      }
                    </div>
                  ))}
                  {activeUsers.length > 4 && (
                    <div style={{
                      width: '26px', height: '26px', borderRadius: '50%',
                      border: `2px solid ${C.surface}`, marginLeft: '-7px',
                      background: C.hover, color: C.text3,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 600,
                    }}>
                      +{activeUsers.length - 4}
                    </div>
                  )}
                </div>
                <span className="doc-active-status" style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  fontSize: '11.5px', color: '#9FC59A', fontFamily: MANROPE,
                  background: 'rgba(118,168,120,0.1)', padding: '2px 8px', borderRadius: '6px',
                }}>
                  <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#548B73' }} />
                  {activeUsers.length === 1 ? 'En línea' : `${activeUsers.length} en línea`}
                </span>
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
            {canManage && (
              <DropdownMenu.Root open={showOptionsMenu} onOpenChange={setShowOptionsMenu}>
                <DropdownMenu.Trigger asChild>
                  <button className={styles.trigger} type="button" aria-label="Opciones del documento" title="Opciones del documento" data-active={showOptionsMenu}>
                    <MoreVertical size={16} aria-hidden="true" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content className={styles.menu} side="bottom" align="end" sideOffset={7} collisionPadding={12}>
                    <DropdownMenu.Item className={styles.menuItem} onSelect={handleShareClick}>
                      <Share2 size={15} aria-hidden="true" />Compartir
                    </DropdownMenu.Item>
                    <DropdownMenu.Separator className={styles.separator} />
                    <DropdownMenu.Item className={`${styles.menuItem} ${styles.danger}`} onSelect={handleDeleteClick}>
                      <Trash2 size={15} aria-hidden="true" />{t.document_btn_delete}
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            )}
          </div>
        </div>
        <div className="doc-description-row" style={{ padding: '0 0 10px 48px', display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="doc-description-input" aria-label="Descripción del documento" value={description} maxLength={Math.max(300, (currentDocument.description ?? '').length)} onChange={(e) => setDescription(e.target.value)} onBlur={handleDescriptionBlur} disabled={!canEdit} placeholder="Añadir descripción del documento…" style={{ flex: 1, minWidth: 0, border: 0, outline: 'none', background: 'transparent', color: C.text3, fontSize: 11.5 }} />
          <small style={{ color: description.length > 300 ? C.red : C.text4, fontSize: 10 }}>{description.length}/300</small>
        </div>
      </header>

      {/* ── Editor ────────────────────────────────────────────────────────── */}
      <div className="doc-editor-stage" style={{ flex: 1, overflow: 'hidden' }}>
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
            canComment={canComment}
          />
        </Suspense>
      </div>

      {/* ── Modal: Compartir ───────────────────────────────────────────────── */}
      {showShareModal && (
        <DocumentShareModal
          members={members}
          loading={loadingMembers}
          projectScoped={Boolean(currentDocument.projectId)}
          updatingUserId={updatingPermission}
          onPermissionChange={handlePermissionChange}
          onClose={() => setShowShareModal(false)}
        />
      )}
      {/* ── Modal: Eliminar ────────────────────────────────────────────────── */}
      {showDeleteModal && (
        <div
          role="presentation"
          style={{
            position: 'fixed', inset: 0, zIndex: 50,
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px',
            background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
          }}
          onClick={(e) => { if (e.target === e.currentTarget && !isDeleting) setShowDeleteModal(false); }}
        >
          <div
            ref={deleteDialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="document-delete-title"
            tabIndex={-1}
            style={{
              width: '100%', maxWidth: '420px',
              background: 'var(--c-surface)', border: `1px solid ${C.border}`,
              borderRadius: '12px', boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
              overflow: 'hidden', fontFamily: MANROPE, outline: 'none',
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
                  <h3 id="document-delete-title" style={{ fontSize: '16px', fontWeight: 700, color: C.text, fontFamily: SORA, marginBottom: '8px' }}>
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
                  cursor: 'pointer', opacity: isDeleting ? 0.5 : 1, fontFamily: MANROPE,
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
                  cursor: isDeleting ? 'not-allowed' : 'pointer', opacity: isDeleting ? 0.7 : 1, fontFamily: MANROPE,
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
        padding: '5px 11px', borderRadius: '7px', fontSize: '12.5px', fontWeight: 500,
        background: h ? C.hover : 'transparent', border: `1px solid ${h ? C.border2 : 'transparent'}`,
        color: h ? C.text : C.text3, cursor: 'pointer',
        transition: 'background 0.12s, border-color 0.12s, color 0.12s',
        flexShrink: 0, fontFamily: MANROPE,
      }}
    >
      <ArrowLeft style={{ width: '13px', height: '13px' }} />
      {label}
    </button>
  );
}
