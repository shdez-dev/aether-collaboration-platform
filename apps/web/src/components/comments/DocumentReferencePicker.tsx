'use client';

import { useEffect, useRef, useState } from 'react';
import { FileText, Search, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

export type SelectedDocumentReference = {
  documentId: string;
  title: string;
  quote: string;
  from: number;
  to: number;
};

type Candidate = { id: string; title: string };

export function DocumentReferencePicker({ cardId, onSelect, onClose }: {
  cardId: string;
  onSelect: (reference: SelectedDocumentReference) => void;
  onClose: () => void;
}) {
  const [documents, setDocuments] = useState<Candidate[]>([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ id: string; title: string; content: string } | null>(null);
  const [range, setRange] = useState<{ from: number; to: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    apiService.get<{ documents: Candidate[] }>(`/api/cards/${cardId}/document-candidates`, true)
      .then((response) => {
        if (cancelled) return;
        if (!response.success) throw new Error(response.error?.message || 'No se pudieron cargar los documentos');
        setDocuments(response.data?.documents ?? []);
      })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar los documentos'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [cardId, reloadKey]);

  const openDocument = async (candidate: Candidate) => {
    setError('');
    setRange(null);
    try {
      const response = await apiService.get<{ document: { id: string; title: string; content: string } }>(`/api/documents/${candidate.id}`, true);
      if (!response.success || !response.data?.document) throw new Error(response.error?.message || 'No se pudo abrir el documento');
      setSelected(response.data.document);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo abrir el documento');
    }
  };

  const captureSelection = () => {
    const selection = window.getSelection();
    const root = previewRef.current;
    if (!selection || !root || selection.isCollapsed || !selection.rangeCount) return;
    const current = selection.getRangeAt(0);
    const textNode = root.firstChild;
    if (!textNode || current.startContainer !== textNode || current.endContainer !== textNode) return;
    const from = current.startOffset;
    const to = current.endOffset;
    if (to <= from || !selected?.content.slice(from, to).trim()) return;
    if (to - from > 500) { setError('Selecciona un fragmento de hasta 500 caracteres'); return; }
    setError('');
    setRange({ from, to });
  };

  const filtered = documents.filter((document) => document.title.toLowerCase().includes(search.toLowerCase()));

  return (
    <div role="dialog" aria-label="Adjuntar fragmento de documento" style={{ border: `1px solid ${C.border2}`, borderRadius: 12, background: C.surface, padding: 14, boxShadow: '0 14px 36px rgba(25,21,34,0.16)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <strong style={{ fontSize: 12.5, color: C.text }}>Adjuntar fragmento de documento</strong>
        <button type="button" onClick={onClose} aria-label="Cerrar" style={{ border: 0, background: 'transparent', color: C.text3, cursor: 'pointer' }}><X size={15} /></button>
      </div>
      {!selected ? (
        <>
          <label style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 9px', border: `1px solid ${C.border}`, borderRadius: 8, color: C.text3 }}>
            <Search size={14} />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar documento" style={{ flex: 1, minWidth: 0, border: 0, outline: 0, background: 'transparent', color: C.text, fontSize: 12 }} />
          </label>
          <div style={{ maxHeight: 180, overflowY: 'auto', marginTop: 8 }}>
            {loading ? <p style={{ color: C.text3, fontSize: 12 }}>Cargando documentos...</p> : error ? null : filtered.length === 0 ? <p style={{ color: C.text3, fontSize: 12 }}>No hay documentos disponibles en este proyecto.</p> : filtered.map((document) => (
              <button key={document.id} type="button" onClick={() => openDocument(document)} style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 6px', border: 0, borderRadius: 6, background: 'transparent', color: C.text2, textAlign: 'left', cursor: 'pointer', fontSize: 12 }}>
                <FileText size={14} /> {document.title}
              </button>
            ))}
          </div>
        </>
      ) : (
        <>
          <button type="button" onClick={() => { setSelected(null); setRange(null); }} style={{ border: 0, padding: 0, background: 'transparent', color: C.accent, cursor: 'pointer', fontSize: 11 }}>← Elegir otro documento</button>
          <p style={{ margin: '8px 0', fontSize: 12, fontWeight: 700, color: C.text }}>{selected.title}</p>
          <p style={{ margin: '0 0 8px', fontSize: 11, color: C.text3 }}>Selecciona con el cursor el texto que quieres referenciar.</p>
          <div ref={previewRef} onMouseUp={captureSelection} onKeyUp={captureSelection} tabIndex={0} style={{ maxHeight: 190, overflowY: 'auto', padding: 10, border: `1px solid ${C.border}`, borderRadius: 8, background: C.bg2, color: C.text, fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', userSelect: 'text' }}>{selected.content || 'Este documento todavía no tiene contenido.'}</div>
          {range && <p style={{ margin: '7px 0', color: C.text2, fontSize: 11 }}>Fragmento seleccionado: “{selected.content.slice(range.from, range.to)}”</p>}
          <button type="button" disabled={!range} onClick={() => range && onSelect({ documentId: selected.id, title: selected.title, quote: selected.content.slice(range.from, range.to), ...range })} style={{ marginTop: 8, width: '100%', padding: '8px 12px', border: 0, borderRadius: 7, background: range ? C.accent : C.border2, color: range ? '#fff' : C.text4, cursor: range ? 'pointer' : 'not-allowed', fontSize: 12, fontWeight: 700 }}>Adjuntar fragmento</button>
        </>
      )}
      {error && <p role="alert" style={{ margin: '8px 0 0', color: C.red, fontSize: 11 }}>{error}{!selected && <button type="button" onClick={() => { setError(''); setLoading(true); setReloadKey((value) => value + 1); }} style={{ display: 'block', marginTop: 6, padding: 0, border: 0, background: 'transparent', color: C.accent, cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>Reintentar</button>}</p>}
    </div>
  );
}
