'use client';

import { type CSSProperties, FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRight, BriefcaseBusiness, Building2, FolderKanban, Plus, RefreshCw, ShieldAlert, Users } from 'lucide-react';
import { PortfolioOrganization, usePortfolioStore } from '@/stores/portfolioStore';
import { getDisplayOrganizationName } from '@/lib/organizationName';

const MANAGE_ROLES = new Set<PortfolioOrganization['role']>(['OWNER', 'ADMIN']);
const date = (value?: string | null) => value ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value)) : 'Sin actividad';

export default function PortfoliosPage() {
  const router = useRouter();
  const { organizations, portfolios, loading, error, fetchOrganizations, fetchPortfolios, createPortfolio } = usePortfolioStore();
  const [organizationId, setOrganizationId] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  useEffect(() => { fetchOrganizations().then((items) => {
    if (items.length) setOrganizationId((selected) => selected || items[0].id);
  }); }, [fetchOrganizations]);
  useEffect(() => { if (organizationId) fetchPortfolios(organizationId); }, [organizationId, fetchPortfolios]);

  const selectedOrganization = useMemo(() => organizations.find((item) => item.id === organizationId) ?? null, [organizations, organizationId]);
  const canCreate = !!selectedOrganization && MANAGE_ROLES.has(selectedOrganization.role);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !canCreate) return;
    setCreateError('');
    const data = new FormData(event.currentTarget);
    const portfolio = await createPortfolio({
      organizationId,
      name: String(data.get('name') ?? '').trim(),
      description: String(data.get('description') ?? '').trim() || undefined,
    });
    if (!portfolio) { setCreateError(usePortfolioStore.getState().error ?? 'No se pudo crear la cartera'); return; }
    setCreating(false);
    router.push(`/dashboard/portfolios/${portfolio.id}`);
  }

  return <main style={page}>
    <header style={header}>
      <div>
        <p style={eyebrow}>GESTIÓN TRANSVERSAL</p>
        <h1 style={title}>Carteras</h1>
        <p style={subtitle}>Una vista ejecutiva de proyectos entre espacios de trabajo de una misma organización.</p>
      </div>
      <div style={headerActions}>
        <label style={selectLabel}><Building2 size={15} /> Organización
          <select value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} style={select} aria-label="Seleccionar organización">
            {organizations.map((organization) => <option key={organization.id} value={organization.id}>{getDisplayOrganizationName(organization.name)}</option>)}
          </select>
        </label>
        {canCreate && <button onClick={() => setCreating(true)} style={primaryButton}><Plus size={17} /> Nueva cartera</button>}
      </div>
    </header>

    {!selectedOrganization && !loading && <section style={empty}><Building2 size={30} /><strong>No hay una organización disponible.</strong><span>Únete a una organización con capacidad de cartera para comenzar.</span></section>}
    {selectedOrganization && !canCreate && <section style={notice}><ShieldAlert size={17} /><span>Puedes consultar las carteras a las que tienes acceso. Solo los administradores de organización pueden crear una nueva.</span></section>}
    {error && <p style={errorStyle}>{error}</p>}
    {selectedOrganization && <section style={grid}>
      {loading ? <div style={empty}><RefreshCw className="animate-spin" size={25} /> Cargando carteras…</div> : portfolios.length === 0 ? <div style={empty}><BriefcaseBusiness size={30} /><strong>Aún no hay carteras.</strong><span>{canCreate ? 'Crea una para observar varios proyectos sin entrar uno por uno.' : 'Cuando un administrador te asigne a una cartera, aparecerá aquí.'}</span></div> : portfolios.map((portfolio) => <Link href={`/dashboard/portfolios/${portfolio.id}`} key={portfolio.id} style={card}>
        <div style={cardTop}><span style={rolePill}>{portfolio.role === 'ADMIN' ? 'Administración' : portfolio.role === 'MANAGER' ? 'Gestión' : 'Lectura'}</span>{portfolio.archivedAt && <span style={archived}>Archivada</span>}</div>
        <h2 style={cardTitle}>{portfolio.name}</h2>
        <p style={cardDescription}>{portfolio.description || 'Sin descripción. Define el alcance de esta cartera.'}</p>
        <div style={stats}><span><FolderKanban size={14} /> {portfolio.projectCount ?? 0} proyectos</span><span><Users size={14} /> {portfolio.memberCount ?? 0} miembros</span></div>
        <div style={cardFooter}><span>Actualizada {date(portfolio.updatedAt)}</span><ArrowRight size={16} /></div>
      </Link>)}</section>}

    {creating && <div style={overlay}><form onSubmit={submit} style={modal}>
      <div><p style={eyebrow}>NUEVA CARTERA</p><h2 style={{ margin: '5px 0 0' }}>Agrupa proyectos para dirección</h2></div>
      <p style={{ ...subtitle, fontSize: 13 }}>Los proyectos deben pertenecer a {selectedOrganization?.name}. La API verificará cada vínculo y permiso.</p>
      <label style={field}>Nombre<input name="name" required minLength={3} maxLength={255} style={input} placeholder="Ej.: Cartera de innovación 2026" /></label>
      <label style={field}>Descripción <span style={{ color: '#77829d', fontWeight: 500 }}>(opcional)</span><textarea name="description" maxLength={10000} style={textarea} placeholder="Qué decisiones o resultados debe apoyar esta cartera." /></label>
      {createError && <p style={errorStyle}>{createError}</p>}
      <div style={actions}><button type="button" onClick={() => setCreating(false)} style={secondaryButton}>Cancelar</button><button style={primaryButton}>Crear cartera</button></div>
    </form></div>}
  </main>;
}

const page: CSSProperties = { minHeight: '100%', padding: '40px clamp(20px, 4vw, 64px)', background: '#12172a', color: '#f8fafc', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 18, flexWrap: 'wrap', marginBottom: 24 };
const headerActions: CSSProperties = { display: 'flex', alignItems: 'end', gap: 10, flexWrap: 'wrap' };
const eyebrow: CSSProperties = { margin: 0, color: '#f97316', fontSize: 11, fontWeight: 800, letterSpacing: '.11em' };
const title: CSSProperties = { margin: '4px 0 8px', fontSize: 'clamp(32px, 4vw, 46px)', letterSpacing: '-.05em' };
const subtitle: CSSProperties = { margin: 0, color: '#a6afc5', lineHeight: 1.55, maxWidth: 650 };
const selectLabel: CSSProperties = { display: 'grid', gap: 6, color: '#b9c2d6', fontSize: 11, fontWeight: 800, letterSpacing: '.04em' };
const select: CSSProperties = { minWidth: 210, background: '#181e33', color: '#edf1fa', border: '1px solid #36405a', padding: '10px 12px', borderRadius: 9 };
const primaryButton: CSSProperties = { border: 0, borderRadius: 9, background: '#f2571e', color: '#1c1320', padding: '11px 14px', display: 'inline-flex', gap: 7, alignItems: 'center', fontWeight: 800, cursor: 'pointer', textDecoration: 'none' };
const secondaryButton: CSSProperties = { border: '1px solid #39435d', borderRadius: 9, background: '#1a2035', color: '#e7ebf3', padding: '10px 14px', fontWeight: 700, cursor: 'pointer' };
const notice: CSSProperties = { display: 'flex', alignItems: 'center', gap: 9, padding: '12px 14px', border: '1px solid #3e465d', borderRadius: 10, background: '#1a2034', color: '#c8d1e0', marginBottom: 18, fontSize: 13 };
const errorStyle: CSSProperties = { color: '#fca5a5', margin: '0 0 14px' };
const grid: CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(285px, 1fr))', gap: 15 };
const card: CSSProperties = { display: 'flex', flexDirection: 'column', minHeight: 220, padding: 18, borderRadius: 13, border: '1px solid #2f3852', background: '#181e33', color: '#edf1fa', textDecoration: 'none' };
const cardTop: CSSProperties = { display: 'flex', justifyContent: 'space-between', gap: 8 };
const rolePill: CSSProperties = { border: '1px solid #42516f', color: '#a7c8f0', background: '#182940', borderRadius: 99, padding: '4px 8px', fontSize: 11, fontWeight: 800 };
const archived: CSSProperties = { color: '#f6c86e', fontSize: 11, fontWeight: 800 };
const cardTitle: CSSProperties = { margin: '16px 0 7px', fontSize: 18, letterSpacing: '-.02em' };
const cardDescription: CSSProperties = { margin: 0, minHeight: 44, color: '#aeb8ca', fontSize: 13, lineHeight: 1.5 };
const stats: CSSProperties = { display: 'flex', gap: 14, color: '#9eabc2', fontSize: 12, marginTop: 18 };
const cardFooter: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: '#8290aa', fontSize: 11, marginTop: 'auto', paddingTop: 18 };
const empty: CSSProperties = { minHeight: 250, gridColumn: '1 / -1', display: 'grid', alignContent: 'center', justifyItems: 'center', gap: 10, textAlign: 'center', color: '#aab5c8', border: '1px dashed #3d4760', borderRadius: 13, padding: 25 };
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 70, display: 'grid', placeItems: 'center', background: 'rgba(7,10,20,.74)', padding: 20 };
const modal: CSSProperties = { width: 'min(520px, 100%)', display: 'grid', gap: 15, padding: 22, borderRadius: 14, background: '#1a2138', border: '1px solid #3b4663' };
const field: CSSProperties = { display: 'grid', gap: 7, color: '#c7d0df', fontWeight: 800, fontSize: 12 };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', background: '#11172a', border: '1px solid #36415c', borderRadius: 8, color: '#f8fafc', padding: '10px 11px' };
const textarea: CSSProperties = { ...input, minHeight: 90, resize: 'vertical', fontFamily: 'inherit' };
const actions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 4 };
