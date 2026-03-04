// apps/web/src/hooks/useDocumentAutoSave.ts
import { useEffect, useRef, useCallback, useState } from 'react';
import type React from 'react';
import { Editor } from '@tiptap/react';
import * as Y from 'yjs';

interface UseDocumentAutoSaveOptions {
  documentId: string;
  yjsDoc: Y.Doc;
  editor: Editor | null;
  enabled: boolean;
  onSave: (documentId: string, state: Uint8Array) => Promise<void>;
  /**
   * Snapshot del último estado completo recibido del servidor (document:sync).
   * Se usa como fallback en el cleanup del desmontaje si el yjsDoc local
   * está vacío o no fue inicializado correctamente.
   */
  lastServerSnapshotRef?: React.MutableRefObject<Uint8Array | null>;
}

/**
 * Auto-guardado via HTTP cada vez que hay cambios en el documento.
 * El frontend es la fuente de verdad: guarda directamente a la DB,
 * sin depender del estado en memoria del servidor WebSocket.
 *
 * Estrategia:
 * - Debounce de 1.5 segundos tras el último cambio (auto-save)
 * - Ctrl+S para guardado inmediato manual
 * - Guardado al desmontar usando refs para evitar stale closures
 */
export function useDocumentAutoSave({
  documentId,
  yjsDoc,
  editor,
  enabled,
  onSave,
  lastServerSnapshotRef,
}: UseDocumentAutoSaveOptions) {
  const isSavingRef = useRef(false);
  const pendingSaveRef = useRef(false);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);

  // Refs que siempre apuntan a los valores más recientes — evitan stale closures
  // en el cleanup del desmontaje y en el handler del teclado.
  const yjsDocRef = useRef(yjsDoc);
  const documentIdRef = useRef(documentId);
  const onSaveRef = useRef(onSave);
  const enabledRef = useRef(enabled);
  // Ref al ref del snapshot del servidor — doble-ref para evitar stale closure
  const snapshotRefRef = useRef(lastServerSnapshotRef);

  // Mantener los refs actualizados en cada render
  useEffect(() => {
    yjsDocRef.current = yjsDoc;
  }, [yjsDoc]);
  useEffect(() => {
    documentIdRef.current = documentId;
  }, [documentId]);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);
  useEffect(() => {
    snapshotRefRef.current = lastServerSnapshotRef;
  }, [lastServerSnapshotRef]);

  const doSave = useCallback(async () => {
    if (!enabledRef.current || isSavingRef.current) {
      // Si ya está guardando, marcar que hay otro pendiente
      if (isSavingRef.current) pendingSaveRef.current = true;
      return;
    }

    isSavingRef.current = true;
    setIsSaving(true);

    try {
      const currentState = Y.encodeStateAsUpdate(yjsDocRef.current);

      // No guardar si el estado está vacío (2 bytes = Y.Doc vacío)
      if (currentState.length <= 2) {
        return;
      }

      await onSaveRef.current(documentIdRef.current, currentState);
      setLastSavedAt(new Date());
    } catch {
      // save failure is surfaced via document:save-error socket event
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);

      // Si hubo otro cambio mientras guardaba, guardar de nuevo
      if (pendingSaveRef.current) {
        pendingSaveRef.current = false;
        scheduleAutoSave();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const scheduleAutoSave = useCallback(() => {
    if (!enabledRef.current) return;
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      debounceTimerRef.current = null;
      doSave();
    }, 1500); // Reducido de 3000ms a 1500ms para menor ventana de pérdida
  }, [doSave]);

  // Escuchar cambios en el Yjs Doc y programar guardado
  useEffect(() => {
    if (!enabled || !yjsDoc) return;

    const handleUpdate = (_update: Uint8Array, origin: any) => {
      // Guardar tanto cambios locales como remotos consolidados.
      // origin === 'server' significa que el servidor ya aplicó y propagó
      // el cambio — igualmente lo guardamos para que el HTTP backup esté al día.
      // Solo excluir 'load' (carga inicial desde DB) para evitar guardados redundantes.
      if (origin === 'load') return;
      scheduleAutoSave();
    };

    yjsDoc.on('update', handleUpdate);
    return () => {
      yjsDoc.off('update', handleUpdate);
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [enabled, yjsDoc, scheduleAutoSave]);

  // Ctrl+S para guardado manual inmediato
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        // Cancelar debounce pendiente y guardar ya
        if (debounceTimerRef.current) {
          clearTimeout(debounceTimerRef.current);
          debounceTimerRef.current = null;
        }
        doSave();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [enabled, doSave]);

  // Guardar al desmontar el componente (navegar fuera, cerrar pestaña).
  // IMPORTANTE: usa refs para leer los valores más recientes — si se usaran
  // las variables del closure con deps:[] se guardaría el estado inicial
  // (vacío o desactualizado) en lugar del contenido real actual.
  useEffect(() => {
    return () => {
      // Cancelar debounce pendiente
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }

      if (!enabledRef.current) return;

      let stateToSave: Uint8Array | null = null;

      const currentState = Y.encodeStateAsUpdate(yjsDocRef.current);

      if (currentState.length > 2) {
        // Estado local válido — usarlo directamente
        stateToSave = currentState;
      } else {
        // Estado local vacío o inválido — intentar con el último snapshot del servidor
        // (fallback para el caso en que la inicialización del doc falló parcialmente)
        const snapshot = snapshotRefRef.current?.current;
        if (snapshot && snapshot.length > 2) {
          stateToSave = snapshot;
        } else {
          return;
        }
      }

      onSaveRef.current(documentIdRef.current, stateToSave).catch(() => {});
    };
    // deps vacío intencional: el cleanup solo se registra una vez al montar.
    // Los valores actuales se leen desde los refs, no desde el closure.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    saveNow: doSave,
    isSaving,
    lastSavedAt,
  };
}
