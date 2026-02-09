// apps/web/src/hooks/useDocumentAutoSave.ts
import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';
import * as Y from 'yjs';

interface UseDocumentAutoSaveOptions {
  documentId: string;
  yjsDoc: Y.Doc;
  editor: Editor | null;
  enabled: boolean;
  onSave: (documentId: string, state: Uint8Array) => Promise<void>;
}

/**
 * Hook de auto-guardado híbrido
 *
 * Frontend: Solo Ctrl+S (guardado manual)
 * Backend: Guardado automático (50 ops, 5 min, al salir)
 */
export function useDocumentAutoSave({
  documentId,
  yjsDoc,
  editor,
  enabled,
  onSave,
}: UseDocumentAutoSaveOptions) {
  const lastSavedStateRef = useRef<Uint8Array | null>(null);
  const isSavingRef = useRef(false);

  const saveDocument = useCallback(async () => {
    if (!enabled || isSavingRef.current) return;

    const currentState = Y.encodeStateAsUpdate(yjsDoc);

    // Verificar si hay cambios
    if (lastSavedStateRef.current) {
      const isSame =
        currentState.length === lastSavedStateRef.current.length &&
        currentState.every((val, idx) => val === lastSavedStateRef.current![idx]);

      if (isSame) {
        return;
      }
    }

    isSavingRef.current = true;

    try {
      await onSave(documentId, currentState);
      lastSavedStateRef.current = currentState;
    } catch (error) {
    } finally {
      isSavingRef.current = false;
    }
  }, [documentId, yjsDoc, enabled, onSave]);

  // Ctrl+S para guardar manual
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        saveDocument();
      }
    };

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, saveDocument]);

  return {
    saveNow: saveDocument,
    isSaving: isSavingRef.current,
  };
}
