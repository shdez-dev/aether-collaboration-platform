// apps/web/src/components/documents/CollaborativeEditor.tsx
'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import * as Y from 'yjs';
import { useEffect, useState, useMemo, useRef } from 'react';
import { socketService } from '@/services/socketService';
import { useDocumentStore } from '@/stores/documentStore';
import { useDocumentAutoSave } from '@/hooks/useDocumentAutoSave';
import { Awareness } from 'y-protocols/awareness';
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Code,
  List,
  ListOrdered,
  ListChecks,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Minus,
  Undo,
  Redo,
  Save,
  Check,
  Eye,
} from 'lucide-react';

interface CollaborativeEditorProps {
  documentId: string;
  workspaceId: string;
  currentUser: {
    id: string;
    name: string;
    color: string;
  };
  canEdit: boolean;
}

function EditorToolbar({
  editor,
  onSave,
  isSaving,
}: {
  editor: any;
  onSave: () => void;
  isSaving: boolean;
}) {
  const ToolbarButton = ({
    onClick,
    isActive,
    disabled,
    children,
    title,
  }: {
    onClick: () => void;
    isActive?: boolean;
    disabled?: boolean;
    children: React.ReactNode;
    title: string;
  }) => (
    <button
      onMouseDown={(e) => {
        e.preventDefault();
        onClick();
      }}
      disabled={disabled}
      title={title}
      className={`p-2 border transition-colors ${
        isActive
          ? 'bg-accent text-white border-accent'
          : 'bg-surface text-text-primary border-border hover:bg-card hover:border-border-hover'
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {children}
    </button>
  );

  return (
    <div className="border-b border-border bg-card px-6 py-2 flex-shrink-0">
      <div className="flex items-center gap-1 flex-wrap">
        <ToolbarButton
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          title="Deshacer (Ctrl+Z)"
        >
          <Undo className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          title="Rehacer (Ctrl+Y)"
        >
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBold().run()}
          isActive={editor.isActive('bold')}
          title="Negrita (Ctrl+B)"
        >
          <Bold className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleItalic().run()}
          isActive={editor.isActive('italic')}
          title="Cursiva (Ctrl+I)"
        >
          <Italic className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          isActive={editor.isActive('underline')}
          title="Subrayado (Ctrl+U)"
        >
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleStrike().run()}
          isActive={editor.isActive('strike')}
          title="Tachado"
        >
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleCode().run()}
          isActive={editor.isActive('code')}
          title="Código inline"
        >
          <Code className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          isActive={editor.isActive('heading', { level: 1 })}
          title="Encabezado 1"
        >
          <Heading1 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          isActive={editor.isActive('heading', { level: 2 })}
          title="Encabezado 2"
        >
          <Heading2 className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          isActive={editor.isActive('heading', { level: 3 })}
          title="Encabezado 3"
        >
          <Heading3 className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          isActive={editor.isActive('bulletList')}
          title="Lista de viñetas"
        >
          <List className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          isActive={editor.isActive('orderedList')}
          title="Lista numerada"
        >
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleTaskList().run()}
          isActive={editor.isActive('taskList')}
          title="Lista de tareas"
        >
          <ListChecks className="w-4 h-4" />
        </ToolbarButton>

        <div className="w-px h-6 bg-border mx-1" />

        <ToolbarButton
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          isActive={editor.isActive('blockquote')}
          title="Cita"
        >
          <Quote className="w-4 h-4" />
        </ToolbarButton>

        <ToolbarButton
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          title="Línea horizontal"
        >
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <div className="flex-1" />

        <button
          onClick={onSave}
          disabled={isSaving}
          title="Guardar (Ctrl+S)"
          className={`px-3 py-2 border transition-all flex items-center gap-2 text-sm ${
            isSaving
              ? 'bg-success/20 border-success text-success'
              : 'bg-surface border-border hover:bg-card text-text-primary'
          } disabled:opacity-50`}
        >
          {isSaving ? (
            <>
              <Check className="w-4 h-4" />
              <span>Guardado</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>Guardar</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export default function CollaborativeEditor({
  documentId,
  workspaceId,
  currentUser,
  canEdit,
}: CollaborativeEditorProps) {
  const [yjsDoc] = useState(() => new Y.Doc());
  const { saveYjsState } = useDocumentStore();
  const isJoinedRef = useRef(false);
  const [isDocumentReady, setIsDocumentReady] = useState(false);
  const initialSyncReceivedRef = useRef(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const provider = useMemo(() => {
    if (typeof window === 'undefined') return null;

    const awareness = new Awareness(yjsDoc);

    awareness.setLocalState({
      user: {
        name: currentUser.name,
        color: currentUser.color,
      },
    });

    return { awareness };
  }, [yjsDoc, currentUser.name, currentUser.color]);

  // UNIRSE AL DOCUMENTO VÍA WEBSOCKET Y ESPERAR SYNC INICIAL
  useEffect(() => {
    if (isJoinedRef.current) return;


    // Handler para recibir el estado inicial
    const handleInitialSync = (data: { documentId: string; update: number[] }) => {
      if (data.documentId === documentId && !initialSyncReceivedRef.current) {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(yjsDoc, update, 'server');
        initialSyncReceivedRef.current = true;
        setIsDocumentReady(true);

        // Cleanup: remover listener después de recibir sync inicial
        socketService.off('document:sync', handleInitialSync);
      }
    };

    // Registrar listener ANTES de hacer join
    socketService.onYjsSync(handleInitialSync);

    // Join al documento
    socketService.joinDocument(documentId, workspaceId);
    isJoinedRef.current = true;

    return () => {
      if (isJoinedRef.current) {
        socketService.leaveDocument(documentId);
        socketService.off('document:sync', handleInitialSync);
        isJoinedRef.current = false;
        initialSyncReceivedRef.current = false;
        setIsDocumentReady(false);
      }
    };
  }, [documentId, workspaceId, yjsDoc]);

  const editor = useEditor(
    {
      immediatelyRender: false,
      extensions: [
        StarterKit.configure({
          history: false,
          bulletList: {
            keepMarks: true,
            keepAttributes: false,
          },
          orderedList: {
            keepMarks: true,
            keepAttributes: false,
          },
        }),
        Collaboration.configure({
          document: yjsDoc,
        }),
        ...(provider
          ? [
              CollaborationCursor.configure({
                provider: provider,
                user: {
                  name: currentUser.name,
                  color: currentUser.color,
                },
              }),
            ]
          : []),
        Placeholder.configure({
          placeholder: canEdit ? 'Comienza a escribir...' : 'Este documento es de solo lectura',
        }),
        Underline,
        Link.configure({
          openOnClick: false,
        }),
        TaskList,
        TaskItem.configure({
          nested: true,
        }),
      ],
      editable: canEdit,
      editorProps: {
        attributes: {
          class: 'focus:outline-none',
        },
      },
    },
    [provider, isDocumentReady]
  );

  // Update editor editable state when canEdit changes with smooth transition
  useEffect(() => {
    if (editor) {
      setIsTransitioning(true);

      // Small delay for smooth transition animation
      setTimeout(() => {
        editor.setEditable(canEdit);

        setTimeout(() => {
          setIsTransitioning(false);
        }, 300);
      }, 150);
    }
  }, [editor, canEdit]);

  // Hook de auto-guardado (híbrido: solo Ctrl+S y al salir)
  const { saveNow, isSaving } = useDocumentAutoSave({
    documentId,
    yjsDoc,
    editor,
    enabled: canEdit && isDocumentReady,
    onSave: async (docId, state) => {
      await saveYjsState(docId, state);
    },
  });
  useEffect(() => {
    if (!editor || !yjsDoc || !isDocumentReady) return;


    const updateHandler = (update: Uint8Array, origin: any) => {
      if (origin !== 'server') {
        socketService.sendYjsUpdate(documentId, update);
      }
    };

    yjsDoc.on('update', updateHandler);

    // Handler para updates en tiempo real de otros usuarios
    const handleUpdate = (data: { documentId: string; update: number[] }) => {
      if (data.documentId === documentId) {
        const update = new Uint8Array(data.update);
        Y.applyUpdate(yjsDoc, update, 'server');
      }
    };

    socketService.onYjsUpdate(handleUpdate);

    return () => {
      yjsDoc.off('update', updateHandler);
      socketService.off('document:yjs:update', handleUpdate);
    };
  }, [editor, yjsDoc, documentId, isDocumentReady]);

  useEffect(() => {
    if (!editor || !provider?.awareness || !isDocumentReady) return;

    const awareness = provider.awareness;

    const sendCurrentAwareness = () => {
      if (!editor) return;

      const { from, to } = editor.state.selection;

      socketService.sendAwareness(documentId, from, { from, to });
    };

    editor.on('selectionUpdate', sendCurrentAwareness);

    const awarenessUpdateHandler = () => {
      sendCurrentAwareness();
    };

    awareness.on('update', awarenessUpdateHandler);

    const handleRemoteAwareness = (data: {
      documentId: string;
      user: any;
      cursor?: number;
      selection?: any;
    }) => {
      if (data.documentId === documentId && data.user?.id !== currentUser.id) {
      }
    };

    socketService.onAwareness(handleRemoteAwareness);

    sendCurrentAwareness();

    return () => {
      editor.off('selectionUpdate', sendCurrentAwareness);
      awareness.off('update', awarenessUpdateHandler);
      socketService.off('document:awareness', handleRemoteAwareness);
    };
  }, [editor, provider, documentId, currentUser.id, isDocumentReady]);

  if (!isDocumentReady || !editor) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
          <div className="text-text-secondary">
            {!isDocumentReady ? 'Cargando documento...' : 'Inicializando editor...'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-surface">
      {canEdit && <EditorToolbar editor={editor} onSave={saveNow} isSaving={isSaving} />}

      <div className="flex-1 overflow-y-auto">
        <div className="min-h-full py-12 px-4">
          <div
            className={`max-w-4xl mx-auto bg-card border border-border shadow-lg transition-all duration-300 ${
              isTransitioning ? 'opacity-50 scale-[0.99]' : 'opacity-100 scale-100'
            }`}
          >
            <div className="px-16 py-12">
              {!canEdit && (
                <div className="mb-4 px-4 py-2 bg-warning/10 border-l-4 border-warning text-warning text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2 duration-300">
                  <Eye className="w-4 h-4" />
                  <span>Este documento es de solo lectura</span>
                </div>
              )}
              <EditorContent
                editor={editor}
                className={`prose prose-invert prose-lg max-w-none transition-opacity duration-300 ${
                  isTransitioning ? 'opacity-50' : 'opacity-100'
                } prose-headings:font-bold prose-headings:tracking-tight prose-h1:text-4xl prose-h1:mb-4 prose-h2:text-3xl prose-h2:mb-3 prose-h3:text-2xl prose-h3:mb-2 prose-p:text-base prose-p:leading-relaxed prose-p:mb-4 prose-blockquote:border-l-4 prose-blockquote:border-accent prose-blockquote:pl-4 prose-blockquote:italic prose-code:bg-surface prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-surface prose-pre:border prose-pre:border-border prose-a:text-accent prose-a:no-underline hover:prose-a:underline prose-strong:text-text-primary prose-strong:font-semibold prose-em:text-text-secondary focus:outline-none`}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
