'use client';

import { useState, useEffect } from 'react';
import { apiService } from '@/services/apiService';
import type { Sprint } from '@aether/types';
import { C } from '@/lib/colors';

interface CreateSprintForm { name: string; startDate: string; endDate: string; goal: string }

function nextSprintName(sprints: Sprint[]): string {
  const nums = sprints
    .map((s) => {
      const m = s.name.match(/sprint\s*(\d+)/i);
      return m ? parseInt(m[1]) : 0;
    })
    .filter((n) => n > 0);
  const max = nums.length > 0 ? Math.max(...nums) : sprints.length;
  return `Sprint ${max + 1}`;
}

function defaultForm(sprints: Sprint[] = []): CreateSprintForm {
  const today = new Date().toISOString().split('T')[0];
  const end   = new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0];
  return { name: nextSprintName(sprints), startDate: today, endDate: end, goal: '' };
}

export function SprintBanner({ boardId, canEdit }: { boardId: string; canEdit: boolean }) {
  const [sprints,      setSprints]      = useState<Sprint[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showCreate,   setShowCreate]   = useState(false);
  const [showAll,      setShowAll]      = useState(false);
  const [acting,       setActing]       = useState(false);
  const [form,         setForm]         = useState<CreateSprintForm>(() => defaultForm());

  useEffect(() => {
    setLoading(true);
    apiService.get<{ sprints: Sprint[] }>(`/api/boards/${boardId}/sprints`, true)
      .then(r => { if (r.success && r.data) setSprints(r.data.sprints); })
      .finally(() => setLoading(false));
  }, [boardId]);

  const active  = sprints.find(s => s.status === 'ACTIVE');
  const planned = sprints.find(s => s.status === 'PLANNED');
  const current = active ?? planned ?? null;
  const others  = sprints.filter(s => s !== current);

  const cardTotal   = current?.cards?.length ?? 0;
  const cardDone    = current?.cards?.filter((c: any) => c.completed).length ?? 0;
  const progressPct = cardTotal > 0 ? Math.round((cardDone / cardTotal) * 100) : 0;

  async function handleStatusChange(sprintId: string, status: 'ACTIVE' | 'COMPLETED') {
    setActing(true);
    try {
      const r = await apiService.put<{ sprint: Sprint }>(`/api/sprints/${sprintId}`, { status }, true);
      if (r.success && r.data) {
        setSprints(prev => prev.map(s => s.id === sprintId ? r.data!.sprint : s));
      }
    } finally { setActing(false); }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.startDate || !form.endDate) return;
    setActing(true);
    try {
      const r = await apiService.post<{ sprint: Sprint }>(`/api/boards/${boardId}/sprints`, form, true);
      if (r.success && r.data) {
        const updated = [...sprints, r.data.sprint];
        setSprints(updated);
        setForm(defaultForm(updated));
        setShowCreate(false);
        setShowAll(true);
      }
    } finally { setActing(false); }
  }

  const fmtDate     = (d: string) => new Date(d).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  const statusLabel = (s: Sprint) => s.status === 'ACTIVE' ? 'Activo' : s.status === 'PLANNED' ? 'Planificado' : 'Completado';
  const statusColor = (s: Sprint) => s.status === 'ACTIVE' ? '#76A878' : s.status === 'PLANNED' ? '#9C9486' : '#5B8FA8';

  if (loading) return null;

  return (
    <div style={{ background: C.bg2, flexShrink: 0 }}>
      {/* ── Main row ── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '12px 16px', minHeight: '56px', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: '11px', fontWeight: 700, color: C.text3, marginRight: '4px' }}>Sprints</span>
        {/* Sprint icon */}
        <svg viewBox="0 0 16 16" fill="none" stroke={current ? statusColor(current) : C.text4} strokeWidth="1.5"
          width="14" height="14" style={{ flexShrink: 0 }}>
          <path d="M3 8a5 5 0 1 1 10 0M3 8l2-2.5M13 8l-2-2.5" strokeLinecap="round"/>
        </svg>

        {current ? (
          <>
            {/* Name + dates */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '12.5px', fontWeight: 600, color: C.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '180px' }}>
                {current.name}
              </span>
              <span style={{
                fontSize: '10.5px', fontWeight: 500, padding: '1px 7px', borderRadius: '4px',
                background: `${statusColor(current)}18`,
                border: `1px solid ${statusColor(current)}35`,
                color: statusColor(current), flexShrink: 0,
              }}>
                {statusLabel(current)}
              </span>
              <span style={{ fontSize: '11px', color: C.text4, flexShrink: 0 }}>
                {fmtDate(current.startDate)} – {fmtDate(current.endDate)}
              </span>
            </div>

            {/* Progress */}
            {cardTotal > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '240px' }}>
                <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.07)' }}>
                  <div style={{
                    height: '100%', borderRadius: '2px', width: `${progressPct}%`,
                    background: progressPct === 100 ? '#76A878' : '#F4905A',
                    transition: 'width 0.4s ease',
                  }} />
                </div>
                <span style={{ fontSize: '11px', color: C.text4, whiteSpace: 'nowrap' }}>
                  {cardDone}/{cardTotal}
                </span>
              </div>
            )}

            {/* Actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
              {current.status === 'PLANNED' && canEdit && (
                <button
                  onClick={() => handleStatusChange(current.id, 'ACTIVE')}
                  disabled={acting}
                  style={{
                    padding: '3px 11px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 600,
                    background: '#76A87820', border: '1px solid #76A87840', color: '#76A878',
                    cursor: acting ? 'not-allowed' : 'pointer', transition: 'opacity 0.14s',
                    opacity: acting ? 0.5 : 1,
                  }}
                >
                  Iniciar sprint
                </button>
              )}
              {current.status === 'ACTIVE' && canEdit && (
                <button
                  onClick={() => handleStatusChange(current.id, 'COMPLETED')}
                  disabled={acting}
                  style={{
                    padding: '3px 11px', borderRadius: '5px', fontSize: '11.5px', fontWeight: 600,
                    background: '#5B8FA820', border: '1px solid #5B8FA840', color: '#5B8FA8',
                    cursor: acting ? 'not-allowed' : 'pointer', transition: 'opacity 0.14s',
                    opacity: acting ? 0.5 : 1,
                  }}
                >
                  Completar sprint
                </button>
              )}
            </div>
          </>
        ) : (
          <span style={{ fontSize: '12px', color: C.text4 }}>Sin sprint activo</span>
        )}

        {/* All sprints toggle */}
        {sprints.length > 0 && (
          <button
            onClick={() => setShowAll(v => !v)}
            style={{
              marginLeft: current ? '4px' : 'auto',
              padding: '2px 9px', borderRadius: '5px', fontSize: '11px',
              background: showAll ? `${C.accent}18` : 'transparent',
              border: `1px solid ${showAll ? C.accent + '40' : C.border}`,
              color: showAll ? C.accent : C.text4,
              cursor: 'pointer', transition: 'all 0.13s', flexShrink: 0,
              display: 'flex', alignItems: 'center', gap: '4px',
            }}
          >
            <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" width="10" height="10">
              <path d={showAll ? 'M2 8l4-4 4 4' : 'M2 4l4 4 4-4'} strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {showAll ? 'Ocultar sprints' : `Ver sprints (${sprints.length})`}
          </button>
        )}

        {/* New sprint button */}
        {canEdit && (
          <button
            onClick={() => { setForm(defaultForm(sprints)); setShowCreate(v => !v); }}
            style={{
              marginLeft: (current || sprints.length > 0) ? '4px' : 'auto',
              padding: '3px 10px', borderRadius: '5px', fontSize: '11.5px',
              background: 'transparent', border: `1px solid ${C.border}`,
              color: C.text3, cursor: 'pointer', transition: 'border-color 0.13s, color 0.13s', flexShrink: 0,
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text2; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = C.border;  e.currentTarget.style.color = C.text3; }}
          >
            + Nuevo sprint
          </button>
        )}
      </div>

      {/* ── All sprints list ── */}
      {showAll && sprints.length > 0 && (
        <div style={{ borderTop: `1px solid ${C.border}`, padding: '10px 16px 12px' }}>
          <p style={{ margin: '0 0 8px', color: C.text4, fontSize: '10px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>Sprints del tablero</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
            {sprints.map((s) => (
              <div key={s.id} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '5px 10px', borderRadius: '6px',
                background: s === current ? `${C.accent}0c` : 'transparent',
                border: `1px solid ${s === current ? C.accent + '25' : 'transparent'}`,
              }}>
                <span style={{ fontSize: '11.5px', fontWeight: s === current ? 600 : 400, color: s === current ? C.text : C.text3, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {s.name}
                </span>
                <span style={{
                  fontSize: '10px', fontWeight: 500, padding: '1px 6px', borderRadius: '3px',
                  background: `${statusColor(s)}15`, border: `1px solid ${statusColor(s)}30`,
                  color: statusColor(s), flexShrink: 0,
                }}>
                  {statusLabel(s)}
                </span>
                <span style={{ fontSize: '10.5px', color: C.text4, flexShrink: 0 }}>
                  {fmtDate(s.startDate)} – {fmtDate(s.endDate)}
                </span>
                {canEdit && s.status === 'PLANNED' && s !== current && (
                  <button
                    onClick={() => handleStatusChange(s.id, 'ACTIVE')}
                    disabled={acting || !!active}
                    style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                      background: '#76A87818', border: '1px solid #76A87835', color: '#76A878',
                      cursor: (acting || !!active) ? 'not-allowed' : 'pointer',
                      opacity: (acting || !!active) ? 0.4 : 1, flexShrink: 0,
                    }}
                  >
                    Iniciar
                  </button>
                )}
                {canEdit && s.status === 'ACTIVE' && (
                  <button
                    onClick={() => handleStatusChange(s.id, 'COMPLETED')}
                    disabled={acting}
                    style={{
                      padding: '2px 8px', borderRadius: '4px', fontSize: '10.5px', fontWeight: 600,
                      background: '#5B8FA818', border: '1px solid #5B8FA835', color: '#5B8FA8',
                      cursor: acting ? 'not-allowed' : 'pointer',
                      opacity: acting ? 0.4 : 1, flexShrink: 0,
                    }}
                  >
                    Completar
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Create sprint form ── */}
      {showCreate && (
        <div style={{
          borderTop: `1px solid ${C.border}`, padding: '16px',
          background: C.surface, display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap',
        }}>
          <form onSubmit={handleCreate} style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', flexWrap: 'wrap', flex: 1 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <label style={{ fontSize: '10.5px', color: C.text4 }}>Nombre</label>
              <input
                type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Sprint 1"
                style={{
                  height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12.5px',
                  background: C.bg, border: `1px solid ${C.border2}`, color: C.text, outline: 'none', width: '160px',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <label style={{ fontSize: '10.5px', color: C.text4 }}>Inicio</label>
              <input
                type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                style={{
                  height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12.5px',
                  background: C.bg, border: `1px solid ${C.border2}`, color: C.text, outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
              <label style={{ fontSize: '10.5px', color: C.text4 }}>Fin</label>
              <input
                type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                style={{
                  height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12.5px',
                  background: C.bg, border: `1px solid ${C.border2}`, color: C.text, outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: '150px' }}>
              <label style={{ fontSize: '10.5px', color: C.text4 }}>Objetivo (opcional)</label>
              <input
                type="text" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
                placeholder="Meta del sprint…"
                style={{
                  height: '30px', padding: '0 10px', borderRadius: '6px', fontSize: '12.5px',
                  background: C.bg, border: `1px solid ${C.border2}`, color: C.text, outline: 'none',
                }}
                onFocus={e => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={e  => (e.currentTarget.style.borderColor = C.border2)}
              />
            </div>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="submit"
                disabled={!form.name.trim() || !form.startDate || !form.endDate || acting}
                style={{
                  height: '30px', padding: '0 14px', borderRadius: '6px', fontSize: '12.5px', fontWeight: 600,
                  background: C.accent, color: '#fff', border: 'none',
                  cursor: !form.name.trim() || acting ? 'not-allowed' : 'pointer',
                  opacity: !form.name.trim() || acting ? 0.5 : 1,
                }}
              >
                Crear
              </button>
              <button
                type="button" onClick={() => setShowCreate(false)}
                style={{
                  height: '30px', padding: '0 12px', borderRadius: '6px', fontSize: '12.5px',
                  background: 'transparent', border: `1px solid ${C.border2}`, color: C.text3, cursor: 'pointer',
                }}
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
