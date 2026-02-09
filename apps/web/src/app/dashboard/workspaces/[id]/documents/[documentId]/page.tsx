// apps/web/src/app/dashboard/workspaces/[id]/documents/[documentId]/page.tsx
'use client';

import { useEffect, useState, lazy, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { socketService } from '@/services/socketService';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Users, Clock, MoreVertical, Trash2, Share2, Check } from 'lucide-react';

// Lazy load del editor colaborativo (reduce bundle inicial en ~150 KB)
const CollaborativeEditor = lazy(() => import('@/components/documents/CollaborativeEditor'));

export default function DocumentEditorPage() {
  const params = useParams();
  const router = useRouter();

  const workspaceId = params.id as string;
  const documentId = params.documentId as string;

  const {
    currentDocument,
    isLoading,
    activeUsers,
    fetchDocumentById,
    updateDocument,
    deleteDocument,
    getDocumentMembers,
    updatePermission,
    leaveDocument,
  } = useDocumentStore();
  const { currentWorkspace } = useWorkspaceStore();
  const { user } = useAuthStore();
  const { toast } = useToast();

  const [title, setTitle] = useState('');
  const [isSavingTitle, setIsSavingTitle] = useState(false);
  const [showOptionsMenu, setShowOptionsMenu] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [members, setMembers] = useState<any[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [updatingPermission, setUpdatingPermission] = useState<string | null>(null);

  useEffect(() => {
    if (documentId) {
      fetchDocumentById(documentId);
    }

    return () => {
      if (documentId) {
        leaveDocument(documentId);
      }
    };
  }, [documentId, fetchDocumentById, leaveDocument]);

  // Escuchar cambios de permisos en tiempo real
  useEffect(() => {
    const handlePermissionChanged = (data: {
      documentId: string;
      permission: 'VIEW' | 'COMMENT' | 'EDIT';
      updatedBy: string;
    }) => {
      if (data.documentId === documentId) {
        // Refrescar el documento para obtener el nuevo permiso
        fetchDocumentById(documentId);

        // Mostrar toast notification según el permiso
        const permissionConfig = {
          EDIT: {
            title: '✏️ Ahora puedes editar',
            description: 'Se te han otorgado permisos de edición en este documento',
            variant: 'default' as const,
          },
          COMMENT: {
            title: '💬 Ahora puedes comentar',
            description: 'Puedes agregar comentarios pero no editar el documento',
            variant: 'default' as const,
          },
          VIEW: {
            title: '👁️ Solo lectura',
            description: 'Tus permisos de edición han sido removidos',
            variant: 'destructive' as const,
          },
        };

        const config = permissionConfig[data.permission];

        toast({
          title: config.title,
          description: config.description,
          variant: config.variant,
        });
      }
    };

    socketService.onPermissionChanged(handlePermissionChanged);

    return () => {
      socketService.off('document:permission:changed', handlePermissionChanged);
    };
  }, [documentId, fetchDocumentById, toast]);

  useEffect(() => {
    if (currentDocument) {
      setTitle(currentDocument.title);
    }
  }, [currentDocument]);

  const handleTitleBlur = async () => {
    if (!currentDocument || title === currentDocument.title) return;

    setIsSavingTitle(true);
    try {
      await updateDocument(documentId, { title });
    } catch (error) {
      setTitle(currentDocument.title);
    } finally {
      setIsSavingTitle(false);
    }
  };

  const handleBack = () => {
    router.push(`/dashboard/workspaces/${workspaceId}/documents`);
  };

  const handleShareClick = async () => {
    setShowOptionsMenu(false);
    setShowShareModal(true);
    setLoadingMembers(true);
    try {
      const fetchedMembers = await getDocumentMembers(documentId);
      setMembers(fetchedMembers);
    } catch (error) {
    } finally {
      setLoadingMembers(false);
    }
  };

  const handlePermissionChange = async (userId: string, permission: string) => {
    setUpdatingPermission(userId);
    try {
      await updatePermission(documentId, userId, permission as any);
      // Refresh members list
      const fetchedMembers = await getDocumentMembers(documentId);
      setMembers(fetchedMembers);

      toast({
        title: 'Permisos actualizados',
        description: 'Los permisos del usuario han sido modificados correctamente',
      });
    } catch (error) {
      toast({
        title: 'Error al actualizar permisos',
        description: 'No se pudo modificar los permisos. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingPermission(null);
    }
  };

  const handleDeleteClick = () => {
    setShowOptionsMenu(false);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = async () => {
    if (!currentDocument) return;

    setIsDeleting(true);
    try {
      await deleteDocument(documentId);

      toast({
        title: '🗑️ Documento eliminado',
        description: 'El documento ha sido eliminado correctamente',
      });

      // Navegar de vuelta a la lista de documentos
      router.push(`/dashboard/workspaces/${workspaceId}/documents`);
    } catch (error) {
      toast({
        title: 'Error al eliminar',
        description: 'No se pudo eliminar el documento. Por favor intenta de nuevo.',
        variant: 'destructive',
      });
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const formatDate = (date: string) => {
    const d = new Date(date);
    return d.toLocaleDateString('es-ES', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading || !currentDocument || !user) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-text-secondary">Cargando documento...</p>
        </div>
      </div>
    );
  }

  const userPermission = currentDocument.userPermission || 'VIEW';
  const canEdit = userPermission === 'EDIT';
  const isCreator = currentDocument.creator?.id === user.id;

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card flex-shrink-0">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 flex-1 min-w-0">
              <button
                onClick={handleBack}
                className="flex items-center gap-2 px-3 py-1.5 text-sm text-text-muted hover:text-text-primary hover:bg-surface border border-transparent hover:border-border transition-all"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Volver</span>
              </button>

              <div className="w-px h-6 bg-border" />

              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onBlur={handleTitleBlur}
                  disabled={!canEdit || isSavingTitle}
                  className="text-xl font-medium text-text-primary bg-transparent border-none focus:outline-none w-full disabled:cursor-not-allowed"
                  placeholder="Título del documento"
                />
                <div className="flex items-center gap-4 mt-1 text-xs text-text-muted">
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    <span>Actualizado {formatDate(currentDocument.updatedAt)}</span>
                  </div>
                  <span>•</span>
                  <span>Creado por {currentDocument.creator?.name}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-text-muted" />
                <div className="flex -space-x-2">
                  {activeUsers.slice(0, 5).map((user) => (
                    <div
                      key={user.id}
                      className="w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-medium text-white"
                      style={{ backgroundColor: user.color }}
                      title={user.name}
                    >
                      {user.name.charAt(0).toUpperCase()}
                    </div>
                  ))}
                  {activeUsers.length > 5 && (
                    <div className="w-8 h-8 rounded-full border-2 border-card bg-surface flex items-center justify-center text-xs text-text-muted">
                      +{activeUsers.length - 5}
                    </div>
                  )}
                </div>
              </div>

              {!canEdit && (
                <div className="px-3 py-1 bg-warning/10 border border-warning/30 text-warning text-xs">
                  Solo lectura
                </div>
              )}

              {/* Menú de opciones - Solo visible para el creador */}
              {isCreator && (
                <div className="relative">
                  <button
                    onClick={() => setShowOptionsMenu(!showOptionsMenu)}
                    className="p-2 hover:bg-surface border border-transparent hover:border-border transition-all"
                    title="Opciones"
                  >
                    <MoreVertical className="w-5 h-5 text-text-muted" />
                  </button>

                  {showOptionsMenu && (
                    <>
                      <div
                        className="fixed inset-0 z-10"
                        onClick={() => setShowOptionsMenu(false)}
                      />
                      <div className="absolute right-0 top-full mt-2 w-48 bg-card border border-border shadow-lg z-20">
                        <button
                          onClick={handleShareClick}
                          className="w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-surface flex items-center gap-2 transition-colors"
                        >
                          <Share2 className="w-4 h-4" />
                          <span>Compartir</span>
                        </button>
                        <div className="border-t border-border" />
                        <button
                          onClick={handleDeleteClick}
                          className="w-full px-4 py-2 text-left text-sm text-error hover:bg-surface flex items-center gap-2 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                          <span>Eliminar documento</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Editor */}
      <div className="flex-1 overflow-hidden">
        <Suspense
          fallback={
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-primary border-r-transparent mb-4"></div>
                <p className="text-sm text-text-muted">Cargando editor...</p>
              </div>
            </div>
          }
        >
          <CollaborativeEditor
            documentId={documentId}
            workspaceId={workspaceId}
            currentUser={{
              id: user.id,
              name: user.name,
              color: activeUsers.find((u) => u.id === user.id)?.color || '#3B82F6',
            }}
            canEdit={canEdit}
          />
        </Suspense>
      </div>

      {/* Modal de compartir documento */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border shadow-2xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-accent/10 flex items-center justify-center">
                    <Share2 className="w-5 h-5 text-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-text-primary">Compartir documento</h3>
                    <p className="text-sm text-text-secondary">
                      Gestiona quién puede ver y editar este documento
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowShareModal(false)}
                  className="text-text-muted hover:text-text-primary transition-colors"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              {loadingMembers ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="space-y-2">
                  {members.map((member) => {
                    const isOwner = member.workspaceRole === 'OWNER';
                    const isCreator = member.isCreator;
                    const isLocked = isOwner || isCreator;

                    return (
                      <div
                        key={member.userId}
                        className="flex items-center justify-between p-3 bg-surface border border-border hover:border-border-light transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-accent flex items-center justify-center text-white font-medium flex-shrink-0">
                            {member.avatar ? (
                              <img
                                src={member.avatar}
                                alt={member.name}
                                className="w-full h-full rounded-full object-cover"
                              />
                            ) : (
                              member.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-text-primary truncate">
                                {member.name}
                              </p>
                              {isCreator && (
                                <span className="px-2 py-0.5 bg-accent/20 text-accent text-xs">
                                  Creador
                                </span>
                              )}
                              {isOwner && (
                                <span className="px-2 py-0.5 bg-success/20 text-success text-xs">
                                  Propietario
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-text-secondary truncate">{member.email}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <select
                            value={member.effectivePermission}
                            onChange={(e) => handlePermissionChange(member.userId, e.target.value)}
                            disabled={isLocked || updatingPermission === member.userId}
                            className="px-3 py-1.5 bg-card border border-border text-text-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            <option value="VIEW">Ver</option>
                            <option value="COMMENT">Comentar</option>
                            <option value="EDIT">Editar</option>
                          </select>
                          {updatingPermission === member.userId && (
                            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 bg-accent text-white hover:bg-accent/90 transition-colors"
                >
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmación de eliminación */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card border border-border shadow-2xl max-w-md w-full">
            <div className="p-6">
              <div className="flex items-start gap-4">
                <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center flex-shrink-0">
                  <Trash2 className="w-5 h-5 text-error" />
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-text-primary mb-2">
                    Eliminar documento
                  </h3>
                  <p className="text-sm text-text-secondary mb-4">
                    ¿Estás seguro de que deseas eliminar el documento{' '}
                    <strong>"{currentDocument?.title}"</strong>? Esta acción no se puede deshacer.
                  </p>
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 border border-border text-text-primary hover:bg-surface transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmDelete}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isDeleting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Eliminando...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-4 h-4" />
                      <span>Eliminar</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
