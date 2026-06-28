'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useProjectStore, type Project } from '@/stores/projectStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import CreateProjectModal from '@/components/CreateProjectModal';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { C } from '@/lib/colors';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────

const STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  PLANNING:  { label: 'Planificación', color: '#9C9486', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.12)' },
  ACTIVE:    { label: 'Activo',        color: '#F4905A', bg: 'rgba(242,87,30,0.12)',   border: 'rgba(242,87,30,0.25)'   },
  ON_HOLD:   { label: 'En pausa',      color: '#DB8A66', bg: 'rgba(219,138,102,0.12)', border: 'rgba(219,138,102,0.25)' },
  COMPLETED: { label: 'Completado',    color: '#76A878', bg: 'rgba(118,168,120,0.12)', border: 'rgba(118,168,120,0.25)' },
  ARCHIVED:  { label: 'Archivado',     color: '#827A6D', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' },
};

const FILTERS = [
  { key: 'all',       label: 'Todos'         },
  { key: 'ACTIVE',    label: 'Activos'       },
  { key: 'PLANNING',  label: 'Planificación' },
  { key: 'ON_HOLD',   label: 'En pausa'      },
  { key: 'COMPLETED', label: 'Completados'   },
];

function fmtDate(d: string | null | undefined) {
  if (!d) return null;
  return new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
}

function daysLeft(endDate: string | null | undefined) {
  if (!endDate) return null;
  const d = Math.ceil((new Date(endDate).getTime() - Date.now()) / 86400000);
  if (d < 0)   return { label: `${Math.abs(d)}d vencido`, color: '#E05252' };
  if (d === 0) return { label: 'Vence hoy',               color: '#DB8A66' };
  if (d <= 7)  return { label: `${d}d restantes`,         color: '#DB8A66' };
  return              { label: `${d}d restantes`,         color: '#6B6152' };
}

// ── Project card ──────────────────────────────────────────────────────────────

function ProjectCard({ project, index, onClick }: { project: Project; index: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);
  const s       = STATUS_META[project.status] ?? STATUS_META.PLANNING;
  const progress = project.progressPercent ?? 0;
  const due      = daysLeft(project.endDate);
  const boards   = project.boards?.length ?? 0;

  const barColor = progress >= 80 ? '#76A878' : progress >= 40 ? '#F4905A' : '#5B8FA8';

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: '12px',
        border: `1px solid ${hov ? 'rgba(255,255,255,0.11)' : 'rgba(255,255,255,0.065)'}`,
        background: hov ? 'rgba(255,255,255,0.038)' : 'rgba(255,255,255,0.022)',
        padding: '18px 20px',
        cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: '14px',
        transition: 'border-color 0.15s, background 0.15s, transform 0.18s',
        transform: hov ? 'translateY(-2px)' : 'none',
        animation: `fadeInUp 0.32s ${index * 0.045}s both cubic-bezier(.22,.9,.36,1)`,
      }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
        <div style={{
          width: '38px', height: '38px', borderRadius: '9px', flexShrink: 0,
          background: project.color ? `${project.color}20` : 'rgba(242,87,30,0.14)',
          border: `1px solid ${project.color ? `${project.color}40` : 'rgba(242,87,30,0.28)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <WorkspaceIcon icon={project.icon} size={18} color={project.color ?? C.accent} />
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h3 style={{
            margin: 0, fontSize: '14px', fontWeight: 600, color: '#E8E1D2',
            fontFamily: SORA, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {project.name}
          </h3>
          {project.description && (
            <p style={{
              margin: '3px 0 0', fontSize: '12px', color: '#5A5044',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {project.description}
            </p>
          )}
        </div>

        <span style={{
          fontSize: '10.5px', fontWeight: 500, padding: '2px 8px', borderRadius: '5px',
          background: s.bg, border: `1px solid ${s.border}`, color: s.color, flexShrink: 0,
        }}>
          {s.label}
        </span>
      </div>

      {/* Progress */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
          <span style={{ fontSize: '11px', color: '#5A5044' }}>Progreso</span>
          <span style={{ fontSize: '11px', fontWeight: 600, color: '#9C9486' }}>{progress}%</span>
        </div>
        <div style={{ height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)' }}>
          <div style={{
            height: '100%', borderRadius: '2px', width: `${progress}%`,
            background: barColor, transition: 'width 0.6s ease',
          }} />
        </div>
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {due && (
            <span style={{ fontSize: '11px', color: due.color, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" width="11" height="11">
                <circle cx="7" cy="7" r="5.5" /><path d="M7 4.5v3l1.5 1.5" strokeLinecap="round" />
              </svg>
              {due.label}
            </span>
          )}
          {project.startDate && !due && (
            <span style={{ fontSize: '11px', color: '#5A5044' }}>
              {fmtDate(project.startDate)}
            </span>
          )}
        </div>
        {boards > 0 && (
          <span style={{ fontSize: '11px', color: '#5A5044', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" width="11" height="11">
              <rect x="1" y="1" width="5" height="12" rx="1" />
              <rect x="8" y="1" width="5" height="7" rx="1" />
              <rect x="8" y="10" width="5" height="3" rx="1" />
            </svg>
            {boards} tablero{boards !== 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  );
}

// ── Empty state ────────────────────────────────────────────────────────────────

function EmptyState({ onCreateClick, filtered }: { onCreateClick: () => void; filtered: boolean }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      padding: '80px 24px', gap: '16px', animation: 'fadeIn 0.4s both',
    }}>
      <div style={{
        width: '60px', height: '60px', borderRadius: '16px',
        background: 'rgba(242,87,30,0.1)', border: '1px solid rgba(242,87,30,0.2)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
      }}>
        {filtered ? '🔍' : '📋'}
      </div>
      <div style={{ textAlign: 'center' }}>
        <p style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#E8E1D2', fontFamily: SORA }}>
          {filtered ? 'Sin proyectos para este filtro' : 'Sin proyectos todavía'}
        </p>
        <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#5A5044' }}>
          {filtered ? 'Prueba otro filtro o crea un nuevo proyecto' : 'Crea tu primer proyecto para organizar el trabajo'}
        </p>
      </div>
      {!filtered && (
        <button
          onClick={onCreateClick}
          style={{
            marginTop: '4px', padding: '8px 20px', borderRadius: '8px', fontSize: '13px',
            fontWeight: 600, background: '#F2571E', color: '#fff', border: 'none',
            cursor: 'pointer', fontFamily: MANROPE, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
        >
          + Nuevo proyecto
        </button>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const router   = useRouter();
  const { fetchProjectsByWorkspace } = useProjectStore();
  const { activeWorkspaceId }        = useActiveWorkspaceStore();
  const { workspaces, fetchWorkspaces } = useWorkspaceStore();

  const [projects,       setProjects]       = useState<Project[]>([]);
  const [loading,        setLoading]        = useState(true);
  const [statusFilter,   setStatusFilter]   = useState('all');
  const [search,         setSearch]         = useState('');
  const [showCreate,     setShowCreate]     = useState(false);
  const [mounted,        setMounted]        = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // Ensure workspaces are loaded for CreateProjectModal
  useEffect(() => {
    if (!workspaces.length) fetchWorkspaces();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!activeWorkspaceId) { setLoading(false); return; }
    setLoading(true);
    fetchProjectsByWorkspace(activeWorkspaceId)
      .then(p => setProjects(p))
      .finally(() => setLoading(false));
  }, [activeWorkspaceId, fetchProjectsByWorkspace]);

  const filtered = useMemo(() => {
    let p = projects;
    if (statusFilter !== 'all') p = p.filter(x => x.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      p = p.filter(x => x.name.toLowerCase().includes(q) || x.description?.toLowerCase().includes(q));
    }
    return p;
  }, [projects, statusFilter, search]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: projects.length };
    for (const p of projects) m[p.status] = (m[p.status] ?? 0) + 1;
    return m;
  }, [projects]);

  function handleProjectCreated(project: Project) {
    setProjects(prev => [project, ...prev]);
    setShowCreate(false);
    router.push(`/dashboard/projects/${project.id}`);
  }

  return (
    <div style={{
      minHeight: '100%', background: C.bg, fontFamily: MANROPE,
      opacity: mounted ? 1 : 0, transition: 'opacity 0.2s',
    }}>
      <style>{`
        @keyframes fadeIn    { from { opacity:0; } to { opacity:1; } }
        @keyframes fadeInUp  { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:none; } }
      `}</style>

      <div style={{
        maxWidth: '1140px', margin: '0 auto',
        padding: 'clamp(24px,3vw,40px) clamp(20px,3vw,40px)',
      }}>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: '16px', marginBottom: '28px', flexWrap: 'wrap',
          animation: 'fadeInUp 0.3s both',
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 'clamp(20px,2.5vw,26px)', fontWeight: 700, color: '#E8E1D2', fontFamily: SORA }}>
              Proyectos
            </h1>
            <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#5A5044' }}>
              {loading ? 'Cargando…' : `${projects.length} proyecto${projects.length !== 1 ? 's' : ''} en este workspace`}
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: '7px',
              padding: '9px 18px', borderRadius: '8px', fontSize: '13px',
              fontWeight: 600, background: '#F2571E', color: '#fff',
              border: 'none', cursor: 'pointer', fontFamily: MANROPE,
              transition: 'opacity 0.15s, transform 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.88'; e.currentTarget.style.transform = 'scale(1.02)'; }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1';    e.currentTarget.style.transform = 'none'; }}
          >
            <svg viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" width="13" height="13">
              <path d="M7 2v10M2 7h10" />
            </svg>
            Nuevo proyecto
          </button>
        </div>

        {/* ── Filters ───────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '24px',
          animation: 'fadeInUp 0.3s 0.04s both',
        }}>
          {FILTERS.map(f => {
            const active = statusFilter === f.key;
            const count  = counts[f.key] ?? 0;
            return (
              <button
                key={f.key}
                onClick={() => setStatusFilter(f.key)}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 13px', borderRadius: '20px', fontSize: '12.5px',
                  fontWeight: active ? 600 : 400,
                  background: active ? 'rgba(242,87,30,0.15)' : 'transparent',
                  border: `1px solid ${active ? 'rgba(242,87,30,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  color: active ? '#F4905A' : '#6B6152',
                  cursor: 'pointer', transition: 'all 0.14s',
                }}
                onMouseEnter={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)'; e.currentTarget.style.color = '#9C9486'; } }}
                onMouseLeave={e => { if (!active) { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';  e.currentTarget.style.color = '#6B6152'; } }}
              >
                {f.label}
                {count > 0 && (
                  <span style={{
                    fontSize: '10px', fontWeight: 600,
                    background: active ? 'rgba(242,87,30,0.25)' : 'rgba(255,255,255,0.08)',
                    borderRadius: '10px', padding: '1px 6px',
                    color: active ? '#F4905A' : '#6B6152',
                  }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Search */}
          <div style={{ marginLeft: 'auto', position: 'relative' }}>
            <svg viewBox="0 0 14 14" fill="none" stroke="#5A5044" strokeWidth="1.5" width="12" height="12"
              style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
              <circle cx="6" cy="6" r="4.5" /><path d="M9.5 9.5l2.5 2.5" strokeLinecap="round" />
            </svg>
            <input
              type="text"
              placeholder="Buscar proyectos…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: '30px', paddingRight: '12px',
                height: '32px', borderRadius: '7px', fontSize: '12.5px',
                background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                color: '#E8E1D2', outline: 'none', width: '200px',
                transition: 'border-color 0.15s',
              }}
              onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(242,87,30,0.4)')}
              onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)')}
            />
          </div>
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '80px 0' }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', border: '2.5px solid rgba(255,255,255,0.1)',
              borderTopColor: '#F2571E', animation: 'spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState onCreateClick={() => setShowCreate(true)} filtered={statusFilter !== 'all' || search.trim() !== ''} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(min(320px, 100%), 1fr))',
            gap: '14px',
          }}>
            {filtered.map((p, i) => (
              <ProjectCard
                key={p.id}
                project={p}
                index={i}
                onClick={() => router.push(`/dashboard/projects/${p.id}`)}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Create modal ──────────────────────────────────────────── */}
      {showCreate && (
        <CreateProjectModal
          onClose={() => setShowCreate(false)}
          onCreated={handleProjectCreated}
        />
      )}
    </div>
  );
}
