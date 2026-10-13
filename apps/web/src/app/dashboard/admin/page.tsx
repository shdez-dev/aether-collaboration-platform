'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Activity, Building2, CircleHelp, CreditCard, Database, FileText, FolderKanban, Landmark, LayoutDashboard, Layers3, Mail, Network, RefreshCw, Search, Send, Server, ShieldCheck, Users, X } from 'lucide-react';
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
type PlanCode = 'FREE' | 'TEAMS' | 'PORTFOLIO' | 'INSTITUTIONAL' | 'NETWORK';
type PlanSelection = PlanCode | 'AUTO';
type OrganizationCreationType = 'INSTITUTION' | 'NETWORK_OPERATOR';
type AdminUser = { id: string; name: string; email: string; emailVerified: boolean; createdAt: string; lastActivityAt: string | null; organizations: number; workspaces: number; online: boolean; personalOrganizationId: string | null; personalPlan: PlanCode; personalPlanSource: 'ADMIN' | 'AUTOMATIC'; organizationCreationTypes?: OrganizationCreationType[] | null };
type AdminOrganization = { id: string; name: string; type: string; ownerName: string | null; members: number; workspaces: number; projects: number; createdAt: string };
type AdminWorkspace = { id: string; name: string; organizationName: string; mode: string; archived: boolean; members: number; projects: number; createdAt: string };
type AdminProject = { id: string; name: string; status: string; workspaceName: string; organizationName: string; boards: number; createdAt: string; updatedAt: string };
type AdminActivity = { id: string; type: string; createdAt: string; userName: string; userEmail: string; workspaceName: string | null };
type AdminInvitation = { id: string; email: string; role: string; organizationName: string; inviterName: string; createdAt: string; expiresAt: string };
type AdminSubscription = { id: string; organizationName: string; plan: string; status: string; periodEnd: string | null; cancelAtPeriodEnd: boolean; createdAt: string };
type AdminSystem = { api: boolean; database: boolean; redis: boolean; users: number; uptimeSeconds: number; memoryMb: number; environment: string; checkedAt: string };
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

const PLAN_OPTIONS: { code: PlanCode; label: string }[] = [
  { code: 'FREE', label: 'Free / Personal' }, { code: 'TEAMS', label: 'Teams' },
  { code: 'PORTFOLIO', label: 'Portfolio' }, { code: 'INSTITUTIONAL', label: 'Institutional' },
  { code: 'NETWORK', label: 'Network' },
];
const ORGANIZATION_CREATION_OPTIONS: { type: OrganizationCreationType; label: string; description: string; icon: typeof Building2 }[] = [
  { type: 'INSTITUTION', label: 'Institución', description: 'Organizaciones para programas y colaboración institucional.', icon: Landmark },
  { type: 'NETWORK_OPERATOR', label: 'Red de colaboración', description: 'Organizaciones que conectan equipos y otras organizaciones.', icon: Network },
];
function planLabel(code: string) { return PLAN_OPTIONS.find((plan) => plan.code === code)?.label ?? code; }
function organizationTypeLabel(type: OrganizationCreationType) { return ORGANIZATION_CREATION_OPTIONS.find((option) => option.type === type)?.label ?? type; }
function userOrganizationCreationTypes(user: AdminUser): OrganizationCreationType[] {
  return Array.isArray(user.organizationCreationTypes)
    ? user.organizationCreationTypes.filter((type): type is OrganizationCreationType => type === 'INSTITUTION' || type === 'NETWORK_OPERATOR')
    : [];
}

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
  const [planUser, setPlanUser] = useState<AdminUser | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<PlanSelection>('AUTO');
  const [savingPlan, setSavingPlan] = useState(false);
  const [planError, setPlanError] = useState('');
  const [organizationPermissionsUser, setOrganizationPermissionsUser] = useState<AdminUser | null>(null);
  const [selectedOrganizationTypes, setSelectedOrganizationTypes] = useState<OrganizationCreationType[]>([]);
  const [savingOrganizationPermissions, setSavingOrganizationPermissions] = useState(false);
  const [organizationPermissionsError, setOrganizationPermissionsError] = useState('');

  const openPlanEditor = (user: AdminUser) => {
    setPlanUser(user);
    setSelectedPlan(user.personalPlanSource === 'ADMIN' ? user.personalPlan : 'AUTO');
    setPlanError('');
  };

  const savePlan = async () => {
    if (!planUser || savingPlan) return;
    setSavingPlan(true);
    setPlanError('');
    try {
      const response = await apiService.patch<{ planCode: PlanCode; source: 'ADMIN' | 'AUTOMATIC' }>(
        `/api/admin/users/${planUser.id}/plan`, { planCode: selectedPlan }, true,
      );
      if (!response.success || !response.data) {
        setPlanError(response.error?.message ?? 'No se pudo cambiar el plan. Inténtalo de nuevo.');
        return;
      }
      const updated = response.data;
      setListing((current) => current ? { ...current, users: current.users?.map((user) => user.id === planUser.id
        ? { ...user, personalPlan: updated.planCode, personalPlanSource: updated.source } : user) } : current);
      setPlanUser(null);
    } catch {
      setPlanError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSavingPlan(false);
    }
  };

  const openOrganizationPermissions = (user: AdminUser) => {
    setOrganizationPermissionsUser(user);
    setSelectedOrganizationTypes(userOrganizationCreationTypes(user));
    setOrganizationPermissionsError('');
  };

  const saveOrganizationPermissions = async () => {
    if (!organizationPermissionsUser || savingOrganizationPermissions) return;
    setSavingOrganizationPermissions(true);
    setOrganizationPermissionsError('');
    try {
      const response = await apiService.patch<{ types: OrganizationCreationType[] }>(
        `/api/admin/users/${organizationPermissionsUser.id}/organization-creation-permissions`,
        { types: selectedOrganizationTypes }, true,
      );
      if (!response.success || !response.data) {
        setOrganizationPermissionsError(response.error?.message ?? 'No se pudieron guardar los permisos. Inténtalo de nuevo.');
        return;
      }
      setListing((current) => current ? {
        ...current,
        users: current.users?.map((user) => user.id === organizationPermissionsUser.id
          ? { ...user, organizationCreationTypes: Array.isArray(response.data!.types) ? response.data!.types : [] } : user),
      } : current);
      setOrganizationPermissionsUser(null);
    } catch {
      setOrganizationPermissionsError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSavingOrganizationPermissions(false);
    }
  };

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
      <div><div className={styles.eyebrow}>AETHER — CONTROL DE PLATAFORMA</div><h1>Administración</h1><p>Personas, estructura, actividad y salud de Aether en un solo lugar.</p></div>
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
        {listing && <ListingPanel tab={tab} listing={listing} onChangeUserPlan={openPlanEditor} onManageOrganizationCreation={openOrganizationPermissions} />}
        {listing && listing.total > listing.pageSize && <div className={styles.pagination}><span>Página {listing.page} de {Math.ceil(listing.total / listing.pageSize)}</span><div><button disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Anterior</button><button disabled={page * listing.pageSize >= listing.total} onClick={() => setPage((value) => value + 1)}>Siguiente</button></div></div>}
      </>}
    </>}
    {planUser && typeof document !== 'undefined' && createPortal(<div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingPlan) setPlanUser(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-plan-title" className={styles.dialog} onKeyDown={(event) => { if (event.key === 'Escape' && !savingPlan) setPlanUser(null); }}>
        <div className={styles.dialogHeading}><h2 id="admin-plan-title">Plan de {planUser.name}</h2><button type="button" aria-label="Cerrar" onClick={() => setPlanUser(null)} disabled={savingPlan}><X size={17} /></button></div>
        <p>Este plan se aplica a la organización personal de <strong>{planUser.email}</strong>. Cambia sus capacidades dentro de Aether; no crea cobros ni modifica una suscripción del proveedor.</p>
        <label className={styles.formField}>Tipo de plan<select autoFocus value={selectedPlan} onChange={(event) => setSelectedPlan(event.target.value as PlanSelection)} disabled={savingPlan}>
          <option value="AUTO">Usar plan de facturación o Free</option>
          {PLAN_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}
        </select></label>
        {planError && <p className={styles.formError} role="alert">{planError}</p>}
        <div className={styles.formActions}><button type="button" onClick={() => setPlanUser(null)} disabled={savingPlan}>Cancelar</button><button type="button" className={styles.actionPrimary} onClick={() => void savePlan()} disabled={savingPlan || selectedPlan === (planUser.personalPlanSource === 'ADMIN' ? planUser.personalPlan : 'AUTO')}>{savingPlan ? 'Guardando…' : 'Guardar plan'}</button></div>
      </section>
    </div>, document.body)}
    {organizationPermissionsUser && typeof document !== 'undefined' && createPortal(<div className={styles.dialogBackdrop} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingOrganizationPermissions) setOrganizationPermissionsUser(null); }}>
      <section role="dialog" aria-modal="true" aria-labelledby="admin-organization-permissions-title" className={`${styles.dialog} ${styles.dialogWide}`} onKeyDown={(event) => { if (event.key === 'Escape' && !savingOrganizationPermissions) setOrganizationPermissionsUser(null); }}>
        <div className={styles.dialogHeading}><h2 id="admin-organization-permissions-title">Creación de organizaciones</h2><button type="button" aria-label="Cerrar" onClick={() => setOrganizationPermissionsUser(null)} disabled={savingOrganizationPermissions}><X size={17} /></button></div>
        <p>Autoriza a <strong>{organizationPermissionsUser.name} — {organizationPermissionsUser.email}</strong> a crear las instituciones o redes seleccionadas. Podrá crear varias de cada tipo y será propietario de cada una.</p>
        <p className={styles.permissionNote}>Los equipos de trabajo están disponibles para todas las cuentas y reciben acceso Teams durante el piloto. Este permiso solo controla la creación de instituciones y redes; no cambia el plan personal.</p>
        <fieldset className={styles.permissionChoices} disabled={savingOrganizationPermissions}>
          <legend>Tipos de organización autorizados</legend>
          {ORGANIZATION_CREATION_OPTIONS.map(({ type, label, description, icon: Icon }) => {
            const checked = selectedOrganizationTypes.includes(type);
            return <label key={type} className={`${styles.permissionOption} ${checked ? styles.permissionOptionSelected : ''}`}>
              <span className={styles.permissionIcon} aria-hidden="true"><Icon size={17} /></span>
              <span className={styles.permissionCopy}><strong>{label}</strong><small>{description}</small></span>
              <input type="checkbox" checked={checked} onChange={() => setSelectedOrganizationTypes((current) => checked ? current.filter((item) => item !== type) : [...current, type])} />
            </label>;
          })}
        </fieldset>
        {organizationPermissionsError && <p className={styles.formError} role="alert">{organizationPermissionsError}</p>}
        <div className={styles.formActions}><button type="button" onClick={() => setOrganizationPermissionsUser(null)} disabled={savingOrganizationPermissions}>Cancelar</button><button type="button" className={styles.actionPrimary} onClick={() => void saveOrganizationPermissions()} disabled={savingOrganizationPermissions}>{savingOrganizationPermissions ? 'Guardando…' : 'Guardar permisos'}</button></div>
      </section>
    </div>, document.body)}
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

function ListingPanel({ tab, listing, onChangeUserPlan, onManageOrganizationCreation }: { tab: Tab; listing: Listing; onChangeUserPlan: (user: AdminUser) => void; onManageOrganizationCreation: (user: AdminUser) => void }) {
  const rows = tab === 'usuarios' ? listing.users ?? [] : tab === 'organizaciones' ? listing.organizations ?? [] : tab === 'espacios' ? listing.workspaces ?? [] : tab === 'proyectos' ? listing.projects ?? [] : tab === 'invitaciones' ? listing.invitations ?? [] : tab === 'planes' ? listing.subscriptions ?? [] : listing.activity ?? [];
  if (rows.length === 0) return <div className={styles.emptyPanel}>No hay resultados para esta búsqueda.</div>;
  return <div className={styles.tableWrap}><table className={styles.table}>
    {tab === 'usuarios' && <><thead><tr><th>Persona</th><th>Estado</th><th>Plan personal</th><th>Tipos que puede crear</th><th>Organizaciones / espacios</th><th>Última actividad registrada</th><th>Registro</th></tr></thead><tbody>{(listing.users ?? []).map((user) => { const creationTypes = userOrganizationCreationTypes(user); return <tr key={user.id}><td><div className={styles.person}><span className={styles.avatar}>{user.name.trim().charAt(0).toUpperCase() || '?'}</span><span><strong>{user.name}</strong><small>{user.email}</small></span></div></td><td><span className={`${styles.pill} ${user.online ? styles.pillGreen : ''}`}>{user.online ? 'En línea' : 'Desconectado'}</span><small className={styles.cellSub}>{user.emailVerified ? 'Correo verificado' : 'Correo sin verificar'}</small></td><td><div className={styles.planCell}><span>{planLabel(user.personalPlan)}</span>{user.personalPlanSource === 'ADMIN' && <small>Administrado</small>}<button type="button" onClick={() => onChangeUserPlan(user)} disabled={!user.personalOrganizationId}>Cambiar plan</button></div></td><td><div className={styles.permissionCell}>{creationTypes.length ? <small>{creationTypes.map(organizationTypeLabel).join(' — ')}</small> : <small>Sin permisos adicionales</small>}<button type="button" onClick={() => onManageOrganizationCreation(user)}>Gestionar permisos</button></div></td><td>{user.organizations} / {user.workspaces}</td><td>{dateTime(user.lastActivityAt)}</td><td>{date(user.createdAt)}</td></tr>; })}</tbody></>}
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
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Acceso administrativo</h2><p>Protegido en el servidor</p></div><ShieldCheck size={19} /></div><p className={styles.systemCopy}>Solo el usuario designado mediante su ID en la configuración del servidor puede usar este panel. Los roles de una organización o de un espacio no conceden acceso global.</p><p className={styles.systemCopy}>Los avisos y cambios de plan se aplican desde aquí. El contenido privado de las cuentas permanece fuera de este panel.</p></section></div>
    <AnnouncementComposer userCount={system.users} />
  </>;
}

function AnnouncementComposer({ userCount }: { userCount: number }) {
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [requestId, setRequestId] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [sentCount, setSentCount] = useState<number | null>(null);

  const review = () => {
    setError('');
    setSentCount(null);
    setRequestId(crypto.randomUUID());
    setReviewing(true);
  };
  const send = async () => {
    if (!requestId || sending) return;
    setSending(true);
    setError('');
    try {
      const response = await apiService.post<{ recipients: number }>(
        '/api/admin/announcements', { requestId, title: title.trim(), message: message.trim() }, true,
      );
      if (!response.success || !response.data) {
        setError(response.error?.message ?? 'No se pudo enviar el aviso. Inténtalo de nuevo.');
        return;
      }
      setSentCount(response.data.recipients);
      setTitle(''); setMessage(''); setReviewing(false); setRequestId('');
    } catch {
      setError('No se pudo conectar con el servidor. Inténtalo de nuevo.');
    } finally {
      setSending(false);
    }
  };

  return <section className={`${styles.panel} ${styles.announcementPanel}`} aria-labelledby="announcement-title">
    <div className={styles.panelHeader}><div><h2 id="announcement-title">Aviso a todos los usuarios</h2><p>Aparecerá en la bandeja de notificaciones de todas las cuentas.</p></div><Send size={19} aria-hidden="true" /></div>
    {sentCount !== null && <p className={styles.formSuccess} role="status">Aviso enviado a {plural(sentCount, 'cuenta', 'cuentas')}.</p>}
    {!reviewing ? <form className={styles.announcementForm} onSubmit={(event) => { event.preventDefault(); review(); }}>
      <label className={styles.formField}>Título<input value={title} onChange={(event) => setTitle(event.target.value)} minLength={3} maxLength={120} required placeholder="Ej. Mantenimiento programado" /></label>
      <label className={styles.formField}>Mensaje<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={2000} required rows={5} placeholder="Escribe el aviso que verán todas las personas registradas." /></label>
      <div className={styles.formActions}><span>{plural(userCount, 'cuenta registrada', 'cuentas registradas')}</span><button type="submit" className={styles.actionPrimary} disabled={userCount === 0}>Revisar aviso</button></div>
    </form> : <div className={styles.announcementReview}>
      <p>Se enviará a <strong>{plural(userCount, 'cuenta registrada', 'cuentas registradas')}</strong>.</p>
      <div className={styles.announcementPreview}><strong>{title.trim()}</strong><p>{message.trim()}</p></div>
      {error && <p className={styles.formError} role="alert">{error}</p>}
      <div className={styles.formActions}><button type="button" onClick={() => setReviewing(false)} disabled={sending}>Editar</button><button type="button" className={styles.actionPrimary} onClick={() => void send()} disabled={sending}>{sending ? 'Enviando…' : 'Enviar aviso a todos'}</button></div>
    </div>}
  </section>;
}
