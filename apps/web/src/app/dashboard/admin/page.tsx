'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, Building2, CircleHelp, CreditCard, Database, FileText, FolderKanban, LayoutDashboard, Layers3, Mail, RefreshCw, Search, Server, ShieldCheck, Users } from 'lucide-react';
import { apiService } from '@/services/apiService';
import styles from './page.module.css';

type Tab = 'resumen' | 'usuarios' | 'organizaciones' | 'espacios' | 'proyectos' | 'invitaciones' | 'planes' | 'actividad' | 'sistema';
type PageResponse<T> = { page: number; pageSize: number; total: number } & T;

type Overview = {
  totals: {
    users: number; online_users: number; verified_users: number;
    new_users_7d: number; new_users_30d: number; organizations: number;
    workspaces: number; projects: number; teams: number; boards: number;
    cards: number; documents: number; pending_invitations: number; active_subscriptions: number;
  };
  registrations: { day: string; count: number }[];
  recentUsers: { id: string; name: string; email: string; createdAt: string; emailVerified: boolean; online: boolean }[];
  generatedAt: string;
  onlineScope: 'current_instance';
};
type AdminUser = { id: string; name: string; email: string; emailVerified: boolean; createdAt: string; lastActivityAt: string | null; organizations: number; workspaces: number; online: boolean };
type AdminOrganization = { id: string; name: string; type: string; ownerName: string | null; members: number; workspaces: number; projects: number; createdAt: string };
type AdminWorkspace = { id: string; name: string; organizationName: string; mode: string; archived: boolean; members: number; projects: number; createdAt: string };
type AdminProject = { id: string; name: string; status: string; workspaceName: string; organizationName: string; boards: number; createdAt: string; updatedAt: string };
type AdminActivity = { id: string; type: string; createdAt: string; userName: string; userEmail: string; workspaceName: string | null };
type AdminInvitation = { id: string; email: string; role: string; organizationName: string; inviterName: string; createdAt: string; expiresAt: string };
type AdminSubscription = { id: string; organizationName: string; plan: string; status: string; periodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string };
type AdminSystem = { api: boolean; database: boolean; redis: boolean; uptimeSeconds: number; memoryMb: number; environment: string; checkedAt: string };
type Listing = PageResponse<{ users?: AdminUser[]; organizations?: AdminOrganization[]; workspaces?: AdminWorkspace[]; projects?: AdminProject[]; invitations?: AdminInvitation[]; subscriptions?: AdminSubscription[]; activity?: AdminActivity[] }>;

const NAV: { key: Tab; label: string; icon: typeof Users }[] = [
  { key: 'resumen', label: 'Resumen', icon: LayoutDashboard },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'organizaciones', label: 'Organizaciones', icon: Building2 },
  { key: 'espacios', label: 'Espacios', icon: Layers3 },
  { key: 'proyectos', label: 'Proyectos', icon: FolderKanban },
  { key: 'invitaciones', label: 'Invitaciones', icon: Mail },
  { key: 'planes', label: 'Planes', icon: CreditCard },
  { key: 'actividad', label: 'Actividad', icon: Activity },
  { key: 'sistema', label: 'Sistema', icon: Server },
];

const ACTIVITY_LABELS: Record<string, string> = {
  'workspace.created': 'Creó un espacio', 'workspace.updated': 'Actualizó un espacio',
  'board.created': 'Creó un tablero', 'board.updated': 'Actualizó un tablero', 'board.deleted': 'Eliminó un tablero',
  'card.created': 'Creó una tarjeta', 'card.updated': 'Actualizó una tarjeta', 'card.moved': 'Movió una tarjeta',
  'comment.created': 'Publicó un comentario', 'document.created': 'Creó un documento',
  'project.created': 'Creó un proyecto', 'project.updated': 'Actualizó un proyecto',
  'team.created': 'Creó un equipo', 'team.member.added': 'Añadió un miembro al equipo',
};

function date(value?: string | null) {
  if (!value) return 'Sin registro';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}
function dateTime(value?: string | null) {
  if (!value) return 'Sin registro';
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}
function plural(value: number, singular: string, pluralForm: string) { return `${value} ${value === 1 ? singular : pluralForm}`; }
function actionLabel(type: string) { return ACTIVITY_LABELS[type] ?? `Evento: ${type}`; }

export default function AdminPage() {
  const [tab, setTab] = useState<Tab>('resumen');
  const [overview, setOverview] = useState<Overview | null>(null);
  const [listing, setListing] = useState<Listing | null>(null);
  const [system, setSystem] = useState<AdminSystem | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [forbidden, setForbidden] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  const endpoint = useMemo(() => {
    if (tab === 'resumen') return '/api/admin/overview';
    if (tab === 'sistema') return '/api/admin/system';
    const params = new URLSearchParams({ page: String(page), search: debouncedSearch });
    if (tab === 'usuarios' && filter !== 'all') params.set('filter', filter);
    const route = tab === 'espacios' ? 'workspaces' : tab === 'actividad' ? 'activity' : tab === 'usuarios' ? 'users' : tab === 'organizaciones' ? 'organizations' : tab === 'invitaciones' ? 'invitations' : tab === 'planes' ? 'subscriptions' : 'projects';
    return `/api/admin/${route}?${params}`;
  }, [tab, page, debouncedSearch, filter]);

  const load = useCallback(async (initial = false) => {
    if (!initial) setRefreshing(true);
    const response = await apiService.get<Overview | Listing | AdminSystem>(endpoint, true);
    if (response.success && response.data) {
      if (tab === 'resumen') setOverview(response.data as Overview);
      else if (tab === 'sistema') setSystem(response.data as AdminSystem);
      else setListing(response.data as Listing);
      setError('');
      setForbidden(false);
    } else {
      setForbidden(response.error?.code === 'FORBIDDEN');
      setError(response.error?.message ?? 'No se pudieron cargar los datos.');
    }
    setLoading(false);
    setRefreshing(false);
  }, [endpoint, tab]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void load(true).catch(() => { if (active) { setError('No se pudo conectar con el servidor.'); setLoading(false); setRefreshing(false); } });
    return () => { active = false; };
  }, [load, refreshKey]);

  useEffect(() => {
    if (tab !== 'resumen' && tab !== 'sistema') return;
    const interval = window.setInterval(() => setRefreshKey((value) => value + 1), 30_000);
    return () => window.clearInterval(interval);
  }, [tab]);

  const switchTab = (next: Tab) => {
    setTab(next); setSearch(''); setDebouncedSearch(''); setFilter('all'); setPage(1); setError(''); setListing(null);
  };
  const changeSearch = (value: string) => { setSearch(value); setPage(1); };
  const changeFilter = (value: string) => { setFilter(value); setPage(1); };

  if (forbidden) return <main className={styles.page}><div className={styles.state}><ShieldCheck size={30} /><h1>Acceso restringido</h1><p>Solo la cuenta designada como administradora de Aether puede abrir este panel.</p></div></main>;

  return <main className={styles.page}>
    <header className={styles.header}>
      <div><div className={styles.eyebrow}>AETHER · CONTROL DE PLATAFORMA</div><h1>Administración</h1><p>Personas, estructura, actividad y salud de Aether en un solo lugar.</p></div>
      <button className={styles.refresh} onClick={() => setRefreshKey((value) => value + 1)} disabled={refreshing} aria-label="Actualizar datos"><RefreshCw size={16} className={refreshing ? styles.spinning : ''} /> Actualizar</button>
    </header>

    <nav className={styles.tabs} aria-label="Secciones de administración">
      {NAV.map(({ key, label, icon: Icon }) => <button key={key} type="button" className={`${styles.tab} ${tab === key ? styles.tabActive : ''}`} onClick={() => switchTab(key)} aria-current={tab === key ? 'page' : undefined}><Icon size={15} />{label}</button>)}
    </nav>

    {error && <div className={styles.warning} role="alert">{error}{(overview || listing || system) && ' Se muestran los últimos datos disponibles.'}</div>}
    {loading && !((tab === 'resumen' && overview) || (tab === 'sistema' && system) || (tab !== 'resumen' && tab !== 'sistema' && listing)) ? <div className={styles.loading}>Cargando {NAV.find((item) => item.key === tab)?.label.toLowerCase()}…</div> : <>
      {tab === 'resumen' && overview && <OverviewPanel overview={overview} />}
      {tab === 'sistema' && system && <SystemPanel system={system} />}
      {tab !== 'resumen' && tab !== 'sistema' && <>
        <div className={styles.listHeader}><div><h2>{NAV.find((item) => item.key === tab)?.label}</h2><p>{listing ? plural(listing.total, 'registro', 'registros') : 'Explora los registros de la plataforma'}</p></div>
          <div className={styles.filters}><label className={styles.search}><Search size={15} /><input value={search} onChange={(event) => changeSearch(event.target.value)} placeholder={`Buscar ${tab === 'usuarios' ? 'por nombre o correo' : tab === 'actividad' ? 'por usuario o evento' : 'por nombre'}…`} aria-label="Buscar registros" /></label>
            {tab === 'usuarios' && <select value={filter} onChange={(event) => changeFilter(event.target.value)} aria-label="Filtrar usuarios"><option value="all">Todos</option><option value="online">En línea</option><option value="verified">Verificados</option><option value="unverified">Sin verificar</option></select>}
          </div>
        </div>
        {listing && <ListingPanel tab={tab} listing={listing} />}
        {listing && listing.total > listing.pageSize && <div className={styles.pagination}><span>Página {listing.page} de {Math.ceil(listing.total / listing.pageSize)}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button disabled={page * listing.pageSize >= listing.total} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div>}
      </>}
    </>}
  </main>;
}

function OverviewPanel({ overview }: { overview: Overview }) {
  const { totals, registrations, recentUsers } = overview;
  const maxRegistration = Math.max(1, ...registrations.map((item) => item.count));
  const cards = [
    { label: 'Usuarios registrados', value: totals.users, detail: `${totals.verified_users} con correo verificado`, icon: Users },
    { label: 'En línea ahora', value: totals.online_users, detail: 'Conexiones activas en este servidor', icon: Activity },
    { label: 'Altas recientes', value: totals.new_users_7d, detail: `${totals.new_users_30d} en 30 días`, icon: Users },
    { label: 'Organizaciones', value: totals.organizations, detail: `${totals.pending_invitations} invitaciones pendientes`, icon: Building2 },
    { label: 'Espacios', value: totals.workspaces, detail: `${totals.teams} equipos`, icon: Layers3 },
    { label: 'Proyectos', value: totals.projects, detail: `${totals.boards} tableros`, icon: FolderKanban },
    { label: 'Tarjetas', value: totals.cards, detail: 'Trabajo registrado', icon: LayoutDashboard },
    { label: 'Documentos', value: totals.documents, detail: `${totals.active_subscriptions} planes activos o en prueba`, icon: FileText },
  ];
  return <>
    <section className={styles.grid} aria-label="Indicadores de la plataforma">{cards.map(({ label, value, detail, icon: Icon }) => <article className={styles.metric} key={label}><div className={styles.metricTop}><span>{label}</span><span className={styles.metricIcon}><Icon size={17} /></span></div><strong>{value.toLocaleString('es-CL')}</strong><small>{detail}</small></article>)}</section>
    <div className={styles.lower}>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Crecimiento de usuarios</h2><p>Registros diarios durante los últimos 14 días</p></div><span className={styles.panelBadge}>14 días</span></div><div className={styles.chart} role="img" aria-label="Registros diarios de los últimos 14 días">{registrations.map((item) => <div className={styles.barGroup} key={item.day} title={`${date(item.day)}: ${item.count} registros`}><span className={styles.barCount}>{item.count || ''}</span><div className={styles.barTrack}><div className={styles.bar} style={{ height: `${Math.max(item.count ? 8 : 0, (item.count / maxRegistration) * 100)}%` }} /></div><span className={styles.barLabel}>{new Date(`${item.day}T12:00:00`).getDate()}</span></div>)}</div></section>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Últimos registros</h2><p>Personas incorporadas recientemente</p></div></div><div className={styles.userList}>{recentUsers.length === 0 ? <p className={styles.empty}>Aún no hay usuarios registrados.</p> : recentUsers.map((user) => <div className={styles.userRow} key={user.id}><span className={styles.avatar}>{user.name.trim().charAt(0).toUpperCase() || '?'}</span><div className={styles.userInfo}><strong>{user.name}</strong><span>{user.email}</span></div><div className={styles.userMeta}>{user.online && <span className={styles.online}>En línea</span>}<time>{date(user.createdAt)}</time></div></div>)}</div></section>
    </div>
    <p className={styles.note}><CircleHelp size={13} /> «En línea» cuenta conexiones en tiempo real de esta instancia, no sesiones iniciadas en otros servidores. Última lectura: {dateTime(overview.generatedAt)}.</p>
  </>;
}

function ListingPanel({ tab, listing }: { tab: Tab; listing: Listing }) {
  const rows = tab === 'usuarios' ? listing.users ?? [] : tab === 'organizaciones' ? listing.organizations ?? [] : tab === 'espacios' ? listing.workspaces ?? [] : tab === 'proyectos' ? listing.projects ?? [] : tab === 'invitaciones' ? listing.invitations ?? [] : tab === 'planes' ? listing.subscriptions ?? [] : listing.activity ?? [];
  if (rows.length === 0) return <div className={styles.emptyPanel}>No hay resultados para esta búsqueda.</div>;
  return <div className={styles.tableWrap}><table className={styles.table}>
    {tab === 'usuarios' && <><thead><tr><th>Persona</th><th>Estado</th><th>Organizaciones / espacios</th><th>Última actividad registrada</th><th>Registro</th></tr></thead><tbody>{(listing.users ?? []).map((user) => <tr key={user.id}><td><div className={styles.person}><span className={styles.avatar}>{user.name.trim().charAt(0).toUpperCase() || '?'}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td><span className={`${styles.pill} ${user.online ? styles.pillGreen : ''}`}>{user.online ? 'En línea' : 'Desconectado'}</span><small className={styles.cellSub}>{user.emailVerified ? 'Correo verificado' : 'Correo sin verificar'}</small></td><td>{user.organizations} / {user.workspaces}</td><td>{dateTime(user.lastActivityAt)}</td><td>{date(user.createdAt)}</td></tr>)}</tbody></>}
    {tab === 'organizaciones' && <><thead><tr><th>Organización</th><th>Tipo</th><th>Propietario</th><th>Miembros</th><th>Espacios</th><th>Proyectos</th><th>Creada</th></tr></thead><tbody>{(listing.organizations ?? []).map((organization) => <tr key={organization.id}><td><strong>{organization.name}</strong></td><td>{organization.type === 'PERSONAL' ? 'Personal' : organization.type === 'COMPANY' ? 'Empresa' : organization.type === 'INSTITUTION' ? 'Institución' : organization.type === 'NETWORK_OPERATOR' ? 'Red' : organization.type}</td><td>{organization.ownerName ?? 'Sin propietario'}</td><td>{organization.members}</td><td>{organization.workspaces}</td><td>{organization.projects}</td><td>{date(organization.createdAt)}</td></tr>)}</tbody></>}
    {tab === 'espacios' && <><thead><tr><th>Espacio</th><th>Organización</th><th>Contexto</th><th>Estado</th><th>Miembros</th><th>Proyectos</th><th>Creado</th></tr></thead><tbody>{(listing.workspaces ?? []).map((workspace) => <tr key={workspace.id}><td><strong>{workspace.name}</strong></td><td>{workspace.organizationName}</td><td>{workspace.mode === 'PERSONAL' ? 'Personal' : workspace.mode === 'TEAM' ? 'Equipo' : workspace.mode}</td><td><span className={`${styles.pill} ${!workspace.archived ? styles.pillGreen : ''}`}>{workspace.archived ? 'Archivado' : 'Activo'}</span></td><td>{workspace.members}</td><td>{workspace.projects}</td><td>{date(workspace.createdAt)}</td></tr>)}</tbody></>}
    {tab === 'proyectos' && <><thead><tr><th>Proyecto</th><th>Organización</th><th>Espacio</th><th>Estado</th><th>Tableros</th><th>Actualizado</th></tr></thead><tbody>{(listing.projects ?? []).map((project) => <tr key={project.id}><td><strong>{project.name}</strong></td><td>{project.organizationName}</td><td>{project.workspaceName}</td><td><span className={styles.pill}>{project.status}</span></td><td>{project.boards}</td><td>{dateTime(project.updatedAt)}</td></tr>)}</tbody></>}
    {tab === 'invitaciones' && <><thead><tr><th>Correo invitado</th><th>Organización</th><th>Rol propuesto</th><th>Invitó</th><th>Creada</th><th>Vence</th></tr></thead><tbody>{(listing.invitations ?? []).map((invitation) => <tr key={invitation.id}><td><strong>{invitation.email}</strong></td><td>{invitation.organizationName}</td><td><span className={styles.pill}>{invitation.role}</span></td><td>{invitation.inviterName}</td><td>{date(invitation.createdAt)}</td><td>{date(invitation.expiresAt)}</td></tr>)}</tbody></>}
    {tab === 'planes' && <><thead><tr><th>Organización</th><th>Plan</th><th>Estado</th><th>Periodo hasta</th><th>Renovación</th><th>Creado</th></tr></thead><tbody>{(listing.subscriptions ?? []).map((subscription) => <tr key={subscription.id}><td><strong>{subscription.organizationName}</strong></td><td>{subscription.plan}</td><td><span className={`${styles.pill} ${subscription.status === 'ACTIVE' ? styles.pillGreen : ''}`}>{subscription.status === 'ACTIVE' ? 'Activo' : subscription.status === 'TRIALING' ? 'En prueba' : subscription.status === 'PAST_DUE' ? 'Pago pendiente' : subscription.status === 'PAUSED' ? 'Pausado' : subscription.status === 'CANCELED' ? 'Cancelado' : subscription.status === 'EXPIRED' ? 'Vencido' : subscription.status}</span></td><td>{date(subscription.periodEnd)}</td><td>{subscription.cancelAtPeriodEnd ? 'Cancela al finalizar' : 'Automática'}</td><td>{date(subscription.createdAt)}</td></tr>)}</tbody></>}
    {tab === 'actividad' && <><thead><tr><th>Persona</th><th>Acción registrada</th><th>Espacio</th><th>Fecha</th></tr></thead><tbody>{(listing.activity ?? []).map((activity) => <tr key={activity.id}><td><strong>{activity.userName}</strong><small className={styles.cellSub}>{activity.userEmail}</small></td><td>{actionLabel(activity.type)}<small className={styles.cellSub}>{activity.type}</small></td><td>{activity.workspaceName ?? '—'}</td><td>{dateTime(activity.createdAt)}</td></tr>)}</tbody></>}
  </table></div>;
}

function SystemPanel({ system }: { system: AdminSystem }) {
  const checks = [
    { label: 'API', active: system.api, icon: Server, description: 'Servidor de aplicación' },
    { label: 'Base de datos', active: system.database, icon: Database, description: 'Consulta de PostgreSQL' },
    { label: 'Redis', active: system.redis, icon: Activity, description: 'Presencia y mensajería' },
  ];
  return <><div className={styles.systemGrid}>{checks.map(({ label, active, icon: Icon, description }) => <article className={styles.panel} key={label}><div className={styles.systemIcon}><Icon size={20} /></div><h2>{label}</h2><p>{description}</p><span className={`${styles.pill} ${active ? styles.pillGreen : styles.pillRed}`}>{active ? 'Operativo' : 'No disponible'}</span></article>)}</div>
    <div className={styles.lower}><section className={styles.panel}><div className={styles.panelHeader}><div><h2>Instancia actual</h2><p>Datos técnicos sin credenciales ni secretos</p></div></div><dl className={styles.details}><div><dt>Entorno</dt><dd>{system.environment}</dd></div><div><dt>Tiempo activo de la API</dt><dd>{Math.floor(system.uptimeSeconds / 3600)} h {Math.floor((system.uptimeSeconds % 3600) / 60)} min</dd></div><div><dt>Memoria del proceso</dt><dd>{system.memoryMb} MB</dd></div><div><dt>Última comprobación</dt><dd>{dateTime(system.checkedAt)}</dd></div></dl></section>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Acceso administrativo</h2><p>Protegido en el servidor</p></div><ShieldCheck size={19} /></div><p className={styles.systemCopy}>Solo el usuario designado mediante su ID en la configuración del servidor puede consultar este panel. Los roles de una organización o de un espacio no conceden acceso global.</p><p className={styles.systemCopy}>Esta versión permite inspeccionar datos y salud del sistema. No permite suspender cuentas, alterar organizaciones ni acceder al contenido privado desde aquí.</p></section></div>
  </>;
}
