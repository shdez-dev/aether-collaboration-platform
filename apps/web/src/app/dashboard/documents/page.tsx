'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useDocumentStore } from '@/stores/documentStore';
import { useAuthStore } from '@/stores/authStore';
import type { Document } from '@aether/types';

const SORA = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

function timeAgo(dateStr: string): string {
  const d = new Date(dateStr);
  const now = Date.now();
  const diff = Math.floor((now - d.getTime()) / 1000);
  if (diff < 60) return 'Hace un momento';
  if (diff < 3600) return `Hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `Hace ${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `Hace ${Math.floor(diff / 86400)} días`;
  return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
}

function docSnippet(content: string): string {
  const plain = content.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  return plain.length > 120 ? plain.slice(0, 120) + '…' : plain || 'Sin contenido';
}

function wordCount(content: string): number {
  const plain = content.replace(/<[^>]+>/g, '').trim();
  if (!plain) return 0;
  return plain.split(/\s+/).filter(Boolean).length;
}

function CreateDocModal({
  workspaceId,
  onClose,
  onCreated,
}: {
  workspaceId: string;
  onClose: () => void;
  onCreated: (doc: Document) => void;
}) {
  const { createDocument } = useDocumentStore();
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [closing, setClosing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { setTimeout(() => inputRef.current?.focus(), 60); }, []);

  const handleClose = () => { setClosing(true); setTimeout(onClose, 150); };

  const handleCreate = async () => {
    if (!title.trim()) return;
    setLoading(true);
    try {
      const doc = await createDocument(workspaceId, { title: title.trim() });
      onCreated(doc);
    } catch {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
    >
      <style>{`
        @keyframes docModalIn { from { opacity:0; transform:scale(0.96) translateY(8px); } to { opacity:1; transform:scale(1) translateY(0); } }
        @keyframes docModalOut { from { opacity:1; transform:scale(1) translateY(0); } to { opacity:0; transform:scale(0.96) translateY(8px); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '420px', margin: '0 20px',
          background: 'var(--c-surface)', borderRadius: '14px',
          border: '1px solid rgba(97,71,130,0.1)',
          boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
          padding: '24px',
          animation: closing ? 'docModalOut 0.15s ease forwards' : 'docModalIn 0.3s cubic-bezier(0.16,1,0.3,1)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px', flexShrink: 0,
            background: 'rgba(116,82,166,0.15)', border: '1px solid rgba(116,82,166,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="#7452A6" strokeWidth="1.7" strokeLinejoin="round" width="15" height="15">
              <path d="M6 3h8l4 4v14H6V3Z"/><path d="M13 3v5h5M9 13h6M9 16.5h6" strokeLinecap="round"/>
            </svg>
          </div>
          <h2 style={{ fontFamily: SORA, fontSize: '15.5px', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>
            Nuevo documento
          </h2>
        </div>

        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: 'var(--c-text3)', marginBottom: '6px', letterSpacing: '0.05em', textTransform: 'uppercase' }}>
          Título
        </label>
        <input
          ref={inputRef}
          value={title}
          onChange={e => setTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') handleClose(); }}
          placeholder="Nombre del documento..."
          style={{
            width: '100%', padding: '10px 12px', borderRadius: '8px', boxSizing: 'border-box',
            background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)',
            color: 'var(--c-text)', fontSize: '14px', fontFamily: MANROPE, outline: 'none',
            marginBottom: '20px',
          }}
          onFocus={e => (e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)')}
          onBlur={e => (e.currentTarget.style.borderColor = 'rgba(97,71,130,0.1)')}
        />

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleClose}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer',
              background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.1)',
              color: 'var(--c-text2)', fontSize: '13.5px', fontFamily: MANROPE, fontWeight: 500,
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'rgba(97,71,130,0.05)')}
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!title.trim() || loading}
            style={{
              flex: 1, padding: '10px', borderRadius: '8px', cursor: title.trim() && !loading ? 'pointer' : 'not-allowed',
              background: title.trim() && !loading ? '#7452A6' : 'rgba(116,82,166,0.3)',
              border: 'none', color: '#fff', fontSize: '13.5px', fontFamily: MANROPE, fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { if (title.trim() && !loading) (e.currentTarget.style.background = '#62438F'); }}
            onMouseLeave={e => { if (title.trim() && !loading) (e.currentTarget.style.background = '#7452A6'); }}
          >
            {loading ? 'Creando…' : 'Crear'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DocRow({ doc, wsName, idx, onClick }: { doc: Document; wsName: string; idx: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const words = wordCount(doc.content);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '16px',
        padding: '14px 20px', cursor: 'pointer',
        background: hov ? 'rgba(97,71,130,0.03)' : 'transparent',
        borderBottom: '1px solid rgba(97,71,130,0.05)',
        transition: 'background 0.12s',
        animation: `docRowIn 0.28s cubic-bezier(0.22,1,0.36,1) ${0.05 + idx * 0.04}s both`,
      }}
    >
      {/* File icon */}
      <div style={{
        width: '36px', height: '36px', borderRadius: '8px', flexShrink: 0,
        background: 'rgba(116,82,166,0.1)', border: '1px solid rgba(116,82,166,0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg viewBox="0 0 24 24" fill="none" stroke="#7452A6" strokeWidth="1.7" strokeLinejoin="round" width="15" height="15">
          <path d="M6 3h8l4 4v14H6V3Z"/><path d="M13 3v5h5M9 13h6M9 16.5h6" strokeLinecap="round"/>
        </svg>
      </div>

      {/* Title + snippet */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: SORA, fontSize: '14px', fontWeight: 600, color: 'var(--c-text)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {doc.title || 'Sin título'}
        </p>
        <p style={{ fontSize: '12.5px', color: 'var(--c-text4)', margin: '3px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {docSnippet(doc.content)}
        </p>
      </div>

      {/* Workspace badge */}
      <span style={{
        fontSize: '11.5px', color: 'var(--c-text3)', background: 'rgba(97,71,130,0.05)',
        border: '1px solid rgba(97,71,130,0.08)', borderRadius: '6px',
        padding: '3px 9px', whiteSpace: 'nowrap', flexShrink: 0,
      }}>
        {wsName}
      </span>

      {/* Word count */}
      <span style={{ fontSize: '12px', color: 'var(--c-text4)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '56px', textAlign: 'right' }}>
        {words > 0 ? `${words} palabras` : '—'}
      </span>

      {/* Updated at */}
      <span style={{ fontSize: '12px', color: 'var(--c-text3)', whiteSpace: 'nowrap', flexShrink: 0, minWidth: '110px', textAlign: 'right' }}>
        {timeAgo(doc.updatedAt)}
      </span>
    </div>
  );
}

export default function DocumentsPage() {
  const router = useRouter();
  const { workspaces } = useWorkspaceStore();
  const { activeWorkspaceId } = useActiveWorkspaceStore();
  const { documents, fetchDocuments, isLoading } = useDocumentStore();
  const { user } = useAuthStore();

  const [allDocs, setAllDocs] = useState<(Document & { wsName: string })[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [loadingAll, setLoadingAll] = useState(true);

  // Fetch docs for all workspaces
  useEffect(() => {
    if (!workspaces.length) return;
    const load = async () => {
      setLoadingAll(true);
      const results: (Document & { wsName: string })[] = [];
      for (const ws of workspaces) {
        await fetchDocuments(ws.id);
        const snap = useDocumentStore.getState().documents;
        snap.forEach(d => {
          if (!results.find(r => r.id === d.id)) {
            results.push({ ...d, wsName: ws.name });
          }
        });
      }
      results.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setAllDocs(results);
      setLoadingAll(false);
    };
    load();
  }, [workspaces.length]);

  const filtered = search.trim()
    ? allDocs.filter(d => d.title.toLowerCase().includes(search.toLowerCase()) || d.content.toLowerCase().includes(search.toLowerCase()))
    : allDocs;

  const activeWsId = activeWorkspaceId ?? workspaces[0]?.id ?? '';
  const activeWsName = workspaces.find(w => w.id === activeWsId)?.name ?? 'Mi espacio';

  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)' }}>
      <style>{`
        @keyframes docListIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes docRowIn  { from { opacity: 0; transform: translateX(-6px); } to { opacity: 1; transform: translateX(0); } }
      `}</style>
      <div style={{ maxWidth: '1140px', margin: '0 auto', padding: '32px clamp(20px,4vw,48px) 60px' }}>

        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: '28px', flexWrap: 'wrap', gap: '12px',
          animation: 'docListIn 0.3s cubic-bezier(0.22,1,0.36,1) both',
        }}>
          <div>
            <h1 style={{ fontFamily: SORA, fontSize: 'clamp(1.4rem,2.5vw,1.9rem)', fontWeight: 700, color: 'var(--c-text)', margin: 0 }}>
              Documentos
            </h1>
            <p style={{ fontSize: '13.5px', color: 'var(--c-text3)', margin: '4px 0 0', fontFamily: MANROPE }}>
              {loadingAll ? 'Cargando…' : `${allDocs.length} documento${allDocs.length !== 1 ? 's' : ''} en todos los espacios`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '10px 18px', borderRadius: '9px',
              background: '#7452A6', border: 'none', cursor: 'pointer',
              color: '#fff', fontFamily: SORA, fontSize: '13.5px', fontWeight: 600,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => (e.currentTarget.style.background = '#62438F')}
            onMouseLeave={e => (e.currentTarget.style.background = '#7452A6')}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"><path d="M12 5v14M5 12h14" strokeLinecap="round"/></svg>
            Nuevo documento
          </button>
        </div>

        {/* Search */}
        <div style={{ position: 'relative', marginBottom: '20px', maxWidth: '360px' }}>
          <svg style={{ position: 'absolute', left: '11px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} viewBox="0 0 24 24" fill="none" width="15" height="15">
            <circle cx="11" cy="11" r="7" stroke="var(--c-text4)" strokeWidth="1.8"/>
            <path d="m20 20-3-3" stroke="var(--c-text4)" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Buscar documentos…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 34px', borderRadius: '8px',
              background: 'rgba(97,71,130,0.05)', border: '1px solid rgba(97,71,130,0.09)',
              color: 'var(--c-text)', fontSize: '13.5px', fontFamily: MANROPE, outline: 'none',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'rgba(116,82,166,0.4)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'rgba(97,71,130,0.09)')}
          />
        </div>

        {/* List */}
        <div style={{
          background: 'var(--c-surface2)', borderRadius: '12px',
          border: '1px solid rgba(97,71,130,0.07)',
          overflow: 'hidden',
          animation: 'docListIn 0.38s cubic-bezier(0.22,1,0.36,1) 0.05s both',
        }}>
          {/* Column headers */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '16px',
            padding: '10px 20px',
            borderBottom: '1px solid rgba(97,71,130,0.07)',
            background: 'rgba(97,71,130,0.02)',
          }}>
            <div style={{ width: '36px', flexShrink: 0 }} />
            <span style={{ flex: 1, fontSize: '11px', fontWeight: 600, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Título</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '80px' }}>Espacio</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '56px', textAlign: 'right' }}>Palabras</span>
            <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--c-text4)', textTransform: 'uppercase', letterSpacing: '0.08em', minWidth: '110px', textAlign: 'right' }}>Modificado</span>
          </div>

          {loadingAll ? (
            <div style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ width: '28px', height: '28px', border: '2px solid rgba(97,71,130,0.1)', borderTopColor: 'var(--c-accent-text)', borderRadius: '50%', margin: '0 auto 12px', animation: 'spin 0.8s linear infinite' }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              <p style={{ fontSize: '13px', color: 'var(--c-text3)' }}>Cargando documentos…</p>
            </div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '56px 20px', textAlign: 'center' }}>
              <div style={{
                width: '48px', height: '48px', borderRadius: '12px', margin: '0 auto 14px',
                background: 'rgba(116,82,166,0.08)', border: '1px solid rgba(116,82,166,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="#7452A6" strokeWidth="1.5" strokeLinejoin="round" width="22" height="22">
                  <path d="M6 3h8l4 4v14H6V3Z"/><path d="M13 3v5h5M9 13h6M9 16.5h6" strokeLinecap="round"/>
                </svg>
              </div>
              <p style={{ fontFamily: SORA, fontSize: '14.5px', fontWeight: 600, color: 'var(--c-text)', margin: '0 0 6px' }}>
                {search ? 'Sin resultados' : 'No hay documentos aún'}
              </p>
              <p style={{ fontSize: '13px', color: 'var(--c-text4)', margin: '0 0 20px' }}>
                {search ? 'Prueba con otro término de búsqueda' : 'Crea tu primer documento para empezar'}
              </p>
              {!search && (
                <button
                  onClick={() => setShowCreate(true)}
                  style={{
                    padding: '9px 20px', borderRadius: '8px', cursor: 'pointer',
                    background: '#7452A6', border: 'none', color: '#fff',
                    fontFamily: SORA, fontSize: '13px', fontWeight: 600,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = '#62438F')}
                  onMouseLeave={e => (e.currentTarget.style.background = '#7452A6')}
                >
                  Crear documento
                </button>
              )}
            </div>
          ) : (
            filtered.map((doc, idx) => (
              <DocRow
                key={doc.id}
                doc={doc}
                wsName={doc.wsName}
                idx={idx}
                onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
              />
            ))
          )}
        </div>
      </div>

      {showCreate && activeWsId && (
        <CreateDocModal
          workspaceId={activeWsId}
          onClose={() => setShowCreate(false)}
          onCreated={doc => {
            setShowCreate(false);
            router.push(`/dashboard/documents/${doc.id}`);
          }}
        />
      )}
    </div>
  );
}
