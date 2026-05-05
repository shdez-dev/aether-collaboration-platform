// apps/web/src/components/workspace/DocumentsSection.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useDocumentStore } from '@/stores/documentStore';
import { FileText, Plus } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { getRecentDocIds, recordRecentDoc } from '@/lib/utils/recentDocs';
import { C } from '@/lib/colors';


function formatDate(date: string) {
  const d = new Date(date);
  return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'ahora';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d`;
  return formatDate(dateStr);
}

function docTag(title: string): string {
  const word = title.trim().split(/\s+/)[0] ?? '';
  return word.slice(0, 3).toUpperCase();
}

interface DocumentsSectionProps {
  workspaceId: string;
  isOwnerOrAdmin: boolean;
  accentColor?: string;
}

export default function DocumentsSection({ workspaceId, isOwnerOrAdmin, accentColor = '#3b82f6' }: DocumentsSectionProps) {
  const router = useRouter();
  const t = useT();
  const { documents, isLoading, fetchDocuments, createDocument } = useDocumentStore();
  const [recentIds, setRecentIds] = useState<string[]>([]);

  // Modal state
  const [showModal, setShowModal]     = useState(false);
  const [newTitle, setNewTitle]       = useState('');
  const [isCreating, setIsCreating]   = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (workspaceId) {
      fetchDocuments(workspaceId);
      setRecentIds(getRecentDocIds(workspaceId));
    }
  }, [workspaceId, fetchDocuments]);

  useEffect(() => {
    if (showModal) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showModal]);

  // ESC para cerrar
  useEffect(() => {
    if (!showModal) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') closeModal(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal]);

  const sorted = [...recentIds
    .map((id) => documents.find((d) => d.id === id))
    .filter(Boolean) as typeof documents,
    ...documents
      .filter((d) => !recentIds.includes(d.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
  ];

  const goDoc = (id: string) => {
    recordRecentDoc(workspaceId, id);
    setRecentIds(getRecentDocIds(workspaceId));
    router.push(`/dashboard/workspaces/${workspaceId}/documents/${id}`);
  };
  const goAll = () => router.push(`/dashboard/workspaces/${workspaceId}?tab=docs`);

  const openModal = () => { setNewTitle(''); setShowModal(true); };
  const closeModal = () => { if (isCreating) return; setShowModal(false); setNewTitle(''); };

  const handleCreate = async () => {
    if (!newTitle.trim() || isCreating) return;
    setIsCreating(true);
    try {
      const doc = await createDocument(workspaceId, { title: newTitle.trim() });
      setShowModal(false);
      setNewTitle('');
      // Si createDocument devuelve el doc, navegar directo al editor
      if (doc?.id) {
        recordRecentDoc(workspaceId, doc.id);
        router.push(`/dashboard/workspaces/${workspaceId}/documents/${doc.id}`);
      }
    } catch {
      // silencio — el store ya maneja el error
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>

        {/* Barra superior */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
            <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Documentos</span>
            {documents.length > 0 && (
              <span style={{ fontSize: '11px', padding: '0 6px', borderRadius: '10px', background: C.hover, color: C.text3, border: `1px solid ${C.border2}`, lineHeight: '18px' }}>
                {documents.length}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {documents.length > 0 && (
              <button
                onClick={goAll}
                style={{ fontSize: '11.5px', color: C.text4, background: 'none', border: 'none', cursor: 'pointer', transition: 'color 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = C.text4)}
              >
                Ver todo →
              </button>
            )}
            {isOwnerOrAdmin && (
              <button
                onClick={openModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: accentColor, color: '#fff', border: 'none', cursor: 'pointer', transition: 'opacity 0.1s' }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <Plus style={{ width: '12px', height: '12px' }} /> Nuevo doc
              </button>
            )}
          </div>
        </div>

        {/* Body */}
        {isLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 0' }}>
            <svg style={{ width: '20px', height: '20px', animation: 'spin 1s linear infinite' }} viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="6" stroke={accentColor} strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
            </svg>
          </div>
        ) : documents.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '10px', padding: '56px 0', borderRadius: '10px', border: `1px dashed ${C.border2}` }}>
            <FileText style={{ width: '28px', height: '28px', color: C.text4 }} />
            <p style={{ margin: 0, fontSize: '13px', color: C.text3 }}>
              {isOwnerOrAdmin ? 'Crea el primer documento' : 'Sin documentos aún'}
            </p>
            {isOwnerOrAdmin && (
              <button
                onClick={openModal}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '6px 14px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, background: accentColor, color: '#fff', border: 'none', cursor: 'pointer' }}
              >
                <Plus style={{ width: '12px', height: '12px' }} /> Crear
              </button>
            )}
          </div>
        ) : (
          <div style={{ background: C.surface, borderRadius: '10px', border: `1px solid ${C.border}`, overflow: 'hidden' }}>
            {/* Cabecera tabla */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 110px', padding: '7px 16px', borderBottom: `1px solid ${C.border}`, background: C.hover }}>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4 }}>DOCUMENTO</span>
              <span style={{ fontSize: '10.5px', fontWeight: 700, letterSpacing: '0.07em', color: C.text4 }}>ACTUALIZADO</span>
            </div>

            {sorted.map((doc, idx) => {
              const tag = docTag(doc.title);
              const isRecent = recentIds.includes(doc.id);
              return (
                <div
                  key={doc.id}
                  onClick={() => goDoc(doc.id)}
                  style={{ display: 'grid', gridTemplateColumns: '1fr 110px', alignItems: 'center', padding: '10px 16px', borderTop: idx > 0 ? `1px solid ${C.border}` : 'none', cursor: 'pointer', transition: 'background 0.1s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = C.hover; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', overflow: 'hidden' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0, background: `${accentColor}20`, border: `1.5px solid ${accentColor}50`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <span style={{ fontSize: '9px', fontWeight: 800, color: accentColor, letterSpacing: '0.04em' }}>{tag}</span>
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {doc.title}
                        </p>
                        {isRecent && (
                          <span style={{ fontSize: '9px', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: `${accentColor}20`, color: accentColor, border: `1px solid ${accentColor}40`, flexShrink: 0, letterSpacing: '0.04em' }}>RECIENTE</span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: C.text4, marginTop: '2px' }}>
                        {formatDate(doc.createdAt)}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: '11.5px', color: C.text4 }}>{timeAgo(doc.updatedAt)}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Modal crear documento ─────────────────────────────────────────────── */}
      {showModal && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(3px)' }}
          onClick={(e) => { if (e.target === e.currentTarget) closeModal(); }}
        >
          <div
            style={{ width: '420px', maxWidth: 'calc(100vw - 32px)', background: '#13161b', border: `1px solid ${C.border2}`, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.6)' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: `1px solid ${C.border}` }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: `${accentColor}18`, border: `1px solid ${accentColor}33`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FileText style={{ width: '13px', height: '13px', color: accentColor }} />
                </div>
                <span style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>Nuevo documento</span>
              </div>
              <button
                onClick={closeModal}
                disabled={isCreating}
                style={{ width: '26px', height: '26px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: 'none', cursor: 'pointer', color: C.text3, borderRadius: '5px' }}
                onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = 'none'); (e.currentTarget.style.color = C.text3); }}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="11" height="11">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div style={{ padding: '18px' }}>
              <label style={{ display: 'block', fontSize: '11.5px', fontWeight: 500, color: C.text3, marginBottom: '8px' }}>
                Título <span style={{ color: C.red }}>*</span>
              </label>
              <input
                ref={inputRef}
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCreate(); }}
                placeholder="Nombre del documento..."
                disabled={isCreating}
                style={{
                  width: '100%',
                  background: C.surface,
                  border: `1px solid ${C.border2}`,
                  borderRadius: '7px',
                  padding: '9px 12px',
                  fontSize: '14px',
                  color: C.text,
                  outline: 'none',
                  boxSizing: 'border-box',
                  transition: 'border-color 0.15s',
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
                onBlur={(e) => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>

            {/* Footer */}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', padding: '12px 18px 16px', borderTop: `1px solid ${C.border}` }}>
              <button
                onClick={closeModal}
                disabled={isCreating}
                style={{ padding: '7px 16px', borderRadius: '7px', fontSize: '13px', background: 'none', border: `1px solid ${C.border2}`, color: C.text2, cursor: 'pointer' }}
                onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); }}
                onMouseLeave={(e) => { (e.currentTarget.style.background = 'none'); }}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreate}
                disabled={!newTitle.trim() || isCreating}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '7px 16px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
                  background: !newTitle.trim() || isCreating ? `${accentColor}55` : accentColor,
                  color: '#fff', border: 'none',
                  cursor: !newTitle.trim() || isCreating ? 'not-allowed' : 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                {isCreating ? (
                  <>
                    <div style={{ width: '12px', height: '12px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    Creando...
                  </>
                ) : 'Crear documento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  );
}
