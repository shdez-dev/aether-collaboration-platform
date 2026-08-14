'use client';

import { type CSSProperties, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  CalendarClock,
  Check,
  CircleAlert,
  Download,
  FolderKanban,
  Link2,
  LoaderCircle,
  SlidersHorizontal,
  UserPlus,
  Users,
  X,
} from 'lucide-react';
import {
  PortfolioFilters,
  PortfolioOrganizationMember,
  PortfolioProject,
  PortfolioRole,
  usePortfolioStore,
} from '@/stores/portfolioStore';

type Tab = 'summary' | 'projects' | 'alerts' | 'capacity' | 'members';
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'summary', label: 'Resumen' },
  { id: 'projects', label: 'Proyectos' },
  { id: 'alerts', label: 'Alertas' },
  { id: 'capacity', label: 'Capacidad' },
  { id: 'members', label: 'Acceso' },
];
const health: Record<PortfolioProject['health'], { label: string; color: string }> = {
  HEALTHY: { label: 'Saludable', color: '#6ee7a0' },
  ATTENTION: { label: 'Atención', color: '#f7c66e' },
  AT_RISK: { label: 'En riesgo', color: '#ff8b86' },
};
const emptyFilters: PortfolioFilters = { page: 1, limit: 50 };
const today = () => new Date().toISOString().slice(0, 10);
const formatDate = (value?: string | null) =>
  value
    ? new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short' }).format(new Date(value))
    : '—';
const hours = (minutes: number) =>
  `${(minutes / 60).toLocaleString('es-CL', { maximumFractionDigits: 1 })} h`;

export default function PortfolioDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params.id;
  const store = usePortfolioStore();
  const {
    detail,
    projects,
    alerts,
    capacity,
    candidates,
    candidatesLoading,
    loading,
    detailLoading,
    error,
    actionError,
  } = store;
  const [tab, setTab] = useState<Tab>('summary');
  const [filters, setFilters] = useState<PortfolioFilters>(emptyFilters);
  const [filterOpen, setFilterOpen] = useState(false);
  const [candidateQuery, setCandidateQuery] = useState('');
  const [selectedCandidateId, setSelectedCandidateId] = useState('');
  const [organizationMembers, setOrganizationMembers] = useState<PortfolioOrganizationMember[]>([]);
  const [selectedMemberId, setSelectedMemberId] = useState('');
  const [selectedRole, setSelectedRole] = useState<PortfolioRole>('VIEWER');
  const [availabilityUserId, setAvailabilityUserId] = useState('');
  const [availabilityHours, setAvailabilityHours] = useState('40');
  const [allocationUserId, setAllocationUserId] = useState('');
  const [allocationProjectId, setAllocationProjectId] = useState('');
  const [allocationHours, setAllocationHours] = useState('4');

  useEffect(() => {
    if (!id) return;
    store.clear();
    void Promise.all([
      store.fetchDetail(id),
      store.fetchOverview(id),
      store.fetchAlerts(id),
      store.fetchCapacity(id),
    ]);
  }, [id]); // Store actions are stable Zustand actions.

  useEffect(() => {
    if (!id || !detail?.permissions.canManage || tab !== 'projects') return;
    const timer = window.setTimeout(
      () =>
        void store.fetchCandidates(id, {
          query: candidateQuery || undefined,
          workspaceId: filters.workspaceId,
        }),
      180
    );
    return () => window.clearTimeout(timer);
  }, [id, detail?.permissions.canManage, tab, candidateQuery, filters.workspaceId]);

  useEffect(() => {
    if (!detail?.permissions.canManage) return;
    void store
      .fetchOrganizationMembers(detail.portfolio.organizationId)
      .then(setOrganizationMembers);
  }, [detail?.permissions.canManage, detail?.portfolio.organizationId]);

  const metrics = useMemo(
    () => ({
      atRisk: projects.filter((project) => project.health === 'AT_RISK').length,
      attention: projects.filter((project) => project.health === 'ATTENTION').length,
      criticalAlerts: alerts.filter((alert) => alert.severity === 'CRITICAL').length,
      overloaded: capacity?.people.filter((person) => person.overallocated).length ?? 0,
    }),
    [projects, alerts, capacity]
  );
  const filterOptions = useMemo(
    () => ({
      workspaces: [
        ...new Map(projects.map((project) => [project.workspace.id, project.workspace])).values(),
      ],
      teams: [
        ...new Map(
          projects.flatMap((project) => project.teams ?? []).map((team) => [team.id, team])
        ).values(),
      ],
      priorities: [
        ...new Set(projects.map((project) => project.topPriority).filter(Boolean)),
      ] as string[],
      statuses: [...new Set(projects.map((project) => project.status).filter(Boolean))] as string[],
      maturities: [
        ...new Set(projects.map((project) => project.maturity).filter(Boolean)),
      ] as string[],
      owners: [
        ...new Map(
          projects
            .filter((project) => project.owner)
            .map((project) => [project.owner!.id, project.owner!])
        ).values(),
      ],
    }),
    [projects]
  );
  const linkedIds = useMemo(
    () => new Set(detail?.projectLinks.map((link) => link.projectId) ?? []),
    [detail?.projectLinks]
  );
  const linkableCandidates = candidates.filter((candidate) => !linkedIds.has(candidate.id));
  const portfolioMemberIds = useMemo(
    () => new Set(detail?.members.map((member) => member.userId) ?? []),
    [detail?.members]
  );

  async function refreshPortfolio(includeDetail = false) {
    await Promise.all([
      includeDetail ? store.fetchDetail(id) : Promise.resolve(null),
      store.fetchOverview(id, { ...filters, page: 1, limit: 50 }),
      store.fetchAlerts(id),
      store.fetchCapacity(id),
    ]);
  }
  function updateFilter(key: keyof PortfolioFilters, value: string) {
    setFilters((current) => ({ ...current, [key]: value || undefined }));
  }
  async function linkProject() {
    if (!detail?.permissions.canManage || !selectedCandidateId) return;
    if (await store.addProject(id, selectedCandidateId)) {
      setSelectedCandidateId('');
      await refreshPortfolio(true);
    }
  }
  async function unlinkProject(projectId: string) {
    if (detail?.permissions.canManage && (await store.removeProject(id, projectId)))
      await refreshPortfolio(true);
  }
  async function lifecycleAlert(alertId: string, status: 'ACKNOWLEDGED' | 'RESOLVED') {
    if (detail?.permissions.canManage && (await store.updateAlert(id, alertId, status)))
      await store.fetchAlerts(id);
  }
  async function savePortfolioMember() {
    if (!detail?.permissions.canAdminister || !selectedMemberId) return;
    if (await store.saveMember(id, { userId: selectedMemberId, role: selectedRole })) {
      setSelectedMemberId('');
      await store.fetchDetail(id);
    }
  }
  async function deletePortfolioMember(userId: string) {
    if (detail?.permissions.canAdminister && (await store.removeMember(id, userId)))
      await store.fetchDetail(id);
  }
  async function saveAvailability() {
    const weeklyAvailableMinutes = Math.round(Number(availabilityHours) * 60);
    if (
      !detail?.permissions.canManageOrganizationCapacity ||
      !availabilityUserId ||
      !Number.isFinite(weeklyAvailableMinutes) ||
      weeklyAvailableMinutes < 0
    )
      return;
    if (
      await store.addAvailability(id, {
        userId: availabilityUserId,
        weeklyAvailableMinutes,
        effectiveFrom: today(),
      })
    )
      await refreshPortfolio();
  }
  async function saveAllocation() {
    const weeklyMinutes = Math.round(Number(allocationHours) * 60);
    if (
      !detail?.permissions.canManage ||
      !allocationUserId ||
      !allocationProjectId ||
      !Number.isFinite(weeklyMinutes) ||
      weeklyMinutes < 0
    )
      return;
    if (
      await store.addAllocation(id, {
        projectId: allocationProjectId,
        userId: allocationUserId,
        weeklyMinutes,
        effectiveFrom: today(),
      })
    )
      await refreshPortfolio();
  }

  if (detailLoading && !detail)
    return (
      <main style={page}>
        <section style={empty}>
          <LoaderCircle className="animate-spin" /> Cargando cartera…
        </section>
      </main>
    );
  if (!detail)
    return (
      <main style={page}>
        <Link href="/dashboard/portfolios" style={back}>
          <ArrowLeft size={16} /> Volver a carteras
        </Link>
        <section style={empty}>
          <CircleAlert size={28} />
          <strong>No fue posible abrir esta cartera.</strong>
          <span>{error || 'Puede que no tengas acceso o que ya no exista.'}</span>
        </section>
      </main>
    );

  const { portfolio, permissions } = detail;
  return (
    <main style={page}>
      <Link href="/dashboard/portfolios" style={back}>
        <ArrowLeft size={16} /> Todas las carteras
      </Link>
      <header style={header}>
        <div>
          <p style={eyebrow}>
            CARTERA ·{' '}
            {permissions.level === 'ADMIN'
              ? 'ADMINISTRACIÓN'
              : permissions.level === 'MANAGE'
                ? 'GESTIÓN'
                : 'LECTURA'}
          </p>
          <h1 style={title}>{portfolio.name}</h1>
          <p style={subtitle}>{portfolio.description || 'Sin descripción declarada.'}</p>
        </div>
        <div style={headerActions}>
          <span style={headerMeta}>
            <FolderKanban size={15} /> {projects.length} proyectos visibles
          </span>
          {permissions.canAdminister && (
            <button onClick={() => void store.exportCsv(id, filters)} style={secondaryButton}>
              <Download size={15} /> Exportar CSV
            </button>
          )}
        </div>
      </header>
      {(error || actionError) && <p style={errorStyle}>{actionError || error}</p>}
      <nav style={tabRow}>
        {tabs
          .filter((item) => item.id !== 'members' || permissions.canAdminister)
          .map((item) => (
            <button
              key={item.id}
              onClick={() => setTab(item.id)}
              style={tab === item.id ? activeTab : tabButton}
            >
              {item.label}
              {item.id === 'alerts' && alerts.length > 0 ? <b>{alerts.length}</b> : null}
            </button>
          ))}
      </nav>

      {tab === 'summary' && (
        <>
          <section style={metricGrid}>
            <Metric label="Proyectos en riesgo" value={metrics.atRisk} tone="#ff8b86" />
            <Metric label="Requieren atención" value={metrics.attention} tone="#f7c66e" />
            <Metric label="Alertas críticas" value={metrics.criticalAlerts} tone="#ff8b86" />
            <Metric label="Personas sobrecargadas" value={metrics.overloaded} tone="#c4b5fd" />
          </section>
          <section style={section}>
            <div style={sectionHeader}>
              <div>
                <h2 style={sectionTitle}>Foco de dirección</h2>
                <p style={sectionSub}>Primero lo que impide avanzar, no cada dato operativo.</p>
              </div>
              <button style={linkButton} onClick={() => setTab('projects')}>
                Ver todos <ArrowUpRight size={15} />
              </button>
            </div>
            <ProjectTable projects={projects.slice(0, 6)} />
          </section>
        </>
      )}

      {tab === 'projects' && (
        <section style={section}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Proyectos</h2>
              <p style={sectionSub}>
                La cartera es una proyección ejecutiva: abrir un proyecto sigue requiriendo acceso
                propio.
              </p>
            </div>
            <button onClick={() => setFilterOpen((open) => !open)} style={linkButton}>
              <SlidersHorizontal size={15} /> {filterOpen ? 'Ocultar filtros' : 'Filtrar'}
            </button>
          </div>
          {filterOpen && (
            <PortfolioFilterPanel
              filters={filters}
              options={filterOptions}
              onChange={updateFilter}
              onApply={() => void refreshPortfolio()}
              onClear={() => {
                setFilters(emptyFilters);
                void store.fetchOverview(id, emptyFilters);
              }}
            />
          )}
          {permissions.canManage && (
            <div style={associationBox}>
              <strong>Asociar proyecto</strong>
              <p style={rowText}>
                Sólo aparecen proyectos de la organización que aún puedes gestionar; el servidor
                vuelve a validar ambas condiciones.
              </p>
              <div style={associationControls}>
                <input
                  value={candidateQuery}
                  onChange={(event) => {
                    setCandidateQuery(event.target.value);
                    setSelectedCandidateId('');
                    store.clearActionError();
                  }}
                  placeholder="Buscar proyecto o espacio"
                  style={associationInput}
                />
                <select
                  value={selectedCandidateId}
                  onChange={(event) => setSelectedCandidateId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">
                    {candidatesLoading
                      ? 'Buscando proyectos…'
                      : linkableCandidates.length
                        ? 'Selecciona un proyecto'
                        : 'No hay candidatos'}
                  </option>
                  {linkableCandidates.map((candidate) => (
                    <option key={candidate.id} value={candidate.id}>
                      {candidate.name} · {candidate.workspace.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => void linkProject()}
                  style={manageButton}
                  disabled={!selectedCandidateId || candidatesLoading}
                >
                  <Link2 size={15} /> Asociar
                </button>
              </div>
            </div>
          )}
          <ProjectTable
            projects={projects}
            loading={loading}
            canManage={permissions.canManage}
            onRemove={unlinkProject}
          />
        </section>
      )}

      {tab === 'alerts' && (
        <section style={section}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Alertas activas</h2>
              <p style={sectionSub}>
                La señal se calcula desde actividad, responsables, bloqueos, fechas y capacidad.
              </p>
            </div>
          </div>
          {alerts.length === 0 ? (
            <Empty text="No hay alertas activas en esta cartera." />
          ) : (
            <div style={alertList}>
              {alerts.map((alert) => (
                <div
                  key={alert.id}
                  style={{
                    ...alertRow,
                    borderColor: alert.severity === 'CRITICAL' ? '#713d47' : '#655631',
                  }}
                >
                  <AlertTriangle
                    size={18}
                    color={alert.severity === 'CRITICAL' ? '#ff8b86' : '#f7c66e'}
                  />
                  <div style={{ flex: 1 }}>
                    <strong>{alert.title}</strong>
                    <p style={rowText}>{alert.detail}</p>
                    <p style={statusText}>
                      Estado:{' '}
                      {alert.status === 'ACKNOWLEDGED'
                        ? 'revisada'
                        : alert.status === 'RESOLVED'
                          ? 'resuelta'
                          : 'abierta'}
                    </p>
                  </div>
                  {permissions.canManage && alert.status !== 'RESOLVED' && (
                    <div style={inlineActions}>
                      {alert.status === 'OPEN' && (
                        <button
                          onClick={() => void lifecycleAlert(alert.id, 'ACKNOWLEDGED')}
                          style={secondaryButton}
                        >
                          <Check size={14} /> Revisar
                        </button>
                      )}
                      <button
                        onClick={() => void lifecycleAlert(alert.id, 'RESOLVED')}
                        style={manageButton}
                      >
                        Resolver
                      </button>
                    </div>
                  )}
                  {alert.canOpenProject ? (
                    <Link href={`/dashboard/projects/${alert.projectId}`} style={projectLink}>
                      Abrir <ArrowUpRight size={14} />
                    </Link>
                  ) : (
                    <span style={muted}>Sin acceso</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {tab === 'capacity' && (
        <section style={section}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Capacidad</h2>
              <p style={sectionSub}>
                La disponibilidad y la demanda son semanales. No cambian permisos de workspace o
                proyecto.
              </p>
            </div>
          </div>
          {permissions.canManage && (
            <div style={formGrid}>
              {permissions.canManageOrganizationCapacity && (
                <div style={formBox}>
                <strong>Registrar disponibilidad</strong>
                <p style={rowText}>Sólo administración de cartera.</p>
                <select
                  value={availabilityUserId}
                  onChange={(event) => setAvailabilityUserId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">Selecciona una persona</option>
                  {organizationMembers.map((member) => (
                    <option value={member.userId} key={member.userId}>
                      {member.name} · {member.email}
                    </option>
                  ))}
                </select>
                <label style={formLabel}>
                  Horas disponibles por semana
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.5"
                    value={availabilityHours}
                    onChange={(event) => setAvailabilityHours(event.target.value)}
                    style={associationInput}
                  />
                </label>
                <button
                  onClick={() => void saveAvailability()}
                  disabled={!availabilityUserId}
                  style={manageButton}
                >
                  Guardar disponibilidad
                </button>
                </div>
              )}
              <div style={formBox}>
                <strong>Asignar carga a proyecto</strong>
                <p style={rowText}>
                  Gestión de cartera; el servidor comprueba además el permiso de proyecto cuando
                  aplica.
                </p>
                <select
                  value={allocationProjectId}
                  onChange={(event) => setAllocationProjectId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">Selecciona un proyecto</option>
                  {projects.map((project) => (
                    <option value={project.projectId} key={project.projectId}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  value={allocationUserId}
                  onChange={(event) => setAllocationUserId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">Selecciona una persona</option>
                  {organizationMembers.map((member) => (
                    <option value={member.userId} key={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <label style={formLabel}>
                  Horas semanales
                  <input
                    type="number"
                    min="0"
                    max="168"
                    step="0.5"
                    value={allocationHours}
                    onChange={(event) => setAllocationHours(event.target.value)}
                    style={associationInput}
                  />
                </label>
                <button
                  onClick={() => void saveAllocation()}
                  disabled={!allocationUserId || !allocationProjectId}
                  style={manageButton}
                >
                  Guardar asignación
                </button>
              </div>
            </div>
          )}
          {permissions.canManage && !permissions.canAdminister && (
            <div style={formBox}>
              <strong>Asignar carga a proyecto</strong>
              <p style={rowText}>
                Tu permiso permite asignar carga sólo donde también tengas gestión de proyecto.
              </p>
              <div style={associationControls}>
                <select
                  value={allocationProjectId}
                  onChange={(event) => setAllocationProjectId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">Proyecto</option>
                  {projects.map((project) => (
                    <option value={project.projectId} key={project.projectId}>
                      {project.name}
                    </option>
                  ))}
                </select>
                <select
                  value={allocationUserId}
                  onChange={(event) => setAllocationUserId(event.target.value)}
                  style={candidateSelect}
                >
                  <option value="">Persona</option>
                  {organizationMembers.map((member) => (
                    <option value={member.userId} key={member.userId}>
                      {member.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  max="168"
                  step="0.5"
                  value={allocationHours}
                  onChange={(event) => setAllocationHours(event.target.value)}
                  style={associationInput}
                  aria-label="Horas semanales"
                />
                <button
                  onClick={() => void saveAllocation()}
                  disabled={!allocationUserId || !allocationProjectId}
                  style={manageButton}
                >
                  Asignar
                </button>
              </div>
            </div>
          )}
          {!capacity ? (
            <Empty text="No hay datos de capacidad disponibles todavía." />
          ) : (
            <div style={capacityGrid}>
              <CapacityPeople people={capacity.people} />
              <div>
                <h3 style={minorTitle}>Equipos</h3>
                {capacity.teams.length === 0 ? (
                  <Empty text="Sin equipos asociados." />
                ) : (
                  capacity.teams.map((team) => (
                    <div key={team.teamId} style={capacityRow}>
                      <div>
                        <strong>{team.name}</strong>
                        <p style={rowText}>
                          {team.memberCount} integrantes · {team.projectCount} proyectos
                        </p>
                      </div>
                      <LoadBadge percent={team.loadPercent} over={team.overallocated} />
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {tab === 'members' && permissions.canAdminister && (
        <section style={section}>
          <div style={sectionHeader}>
            <div>
              <h2 style={sectionTitle}>Acceso a la cartera</h2>
              <p style={sectionSub}>
                Estos roles no conceden entrada automática a los proyectos asociados.
              </p>
            </div>
          </div>
          <div style={associationBox}>
            <strong>Agregar o cambiar rol</strong>
            <div style={associationControls}>
              <select
                value={selectedMemberId}
                onChange={(event) => setSelectedMemberId(event.target.value)}
                style={candidateSelect}
              >
                <option value="">Persona de la organización</option>
                {organizationMembers.map((member) => (
                  <option key={member.userId} value={member.userId}>
                    {member.name} · {member.email}
                    {portfolioMemberIds.has(member.userId) ? ' (ya tiene rol)' : ''}
                  </option>
                ))}
              </select>
              <select
                value={selectedRole}
                onChange={(event) => setSelectedRole(event.target.value as PortfolioRole)}
                style={candidateSelect}
              >
                <option value="VIEWER">Lector</option>
                <option value="MANAGER">Gestor</option>
                <option value="ADMIN">Administrador</option>
              </select>
              <button
                onClick={() => void savePortfolioMember()}
                disabled={!selectedMemberId}
                style={manageButton}
              >
                <UserPlus size={15} /> Guardar rol
              </button>
            </div>
          </div>
          <div style={memberList}>
            {detail.members.map((member) => (
              <div key={member.userId} style={memberRow}>
                <div>
                  <strong>{member.user?.name ?? 'Miembro'}</strong>
                  <p style={rowText}>{member.user?.email ?? ''}</p>
                </div>
                <span style={rolePill}>
                  {member.role === 'ADMIN'
                    ? 'Administración'
                    : member.role === 'MANAGER'
                      ? 'Gestión'
                      : 'Lectura'}
                </span>
                <button
                  onClick={() => void deletePortfolioMember(member.userId)}
                  style={removeButton}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function Metric({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div style={metric}>
      <span style={{ color: '#9da9bf', fontSize: 12 }}>{label}</span>
      <strong style={{ color: tone, fontSize: 29 }}>{value}</strong>
    </div>
  );
}
function Empty({ text }: { text: string }) {
  return <div style={emptySmall}>{text}</div>;
}
function LoadBadge({ percent, over }: { percent: number | null; over: boolean }) {
  return (
    <span
      style={{
        ...load,
        color: over ? '#ff9b97' : '#a9c9f2',
        borderColor: over ? '#713d47' : '#3e5779',
      }}
    >
      {percent === null ? 'Sin capacidad' : `${percent}%`}
    </span>
  );
}
function CapacityPeople({
  people,
}: {
  people: NonNullable<ReturnType<typeof usePortfolioStore.getState>['capacity']>['people'];
}) {
  return (
    <div>
      <h3 style={minorTitle}>Personas</h3>
      {people.length === 0 ? (
        <Empty text="Sin asignaciones de capacidad." />
      ) : (
        people.map((person) => (
          <div key={person.userId} style={capacityRow}>
            <div>
              <strong>{person.name}</strong>
              <p style={rowText}>
                {hours(person.allocatedMinutes)} asignadas · {hours(person.availableMinutes)}{' '}
                disponibles
              </p>
            </div>
            <LoadBadge percent={person.loadPercent} over={person.overallocated} />
          </div>
        ))
      )}
    </div>
  );
}
function PortfolioFilterPanel({
  filters,
  options,
  onChange,
  onApply,
  onClear,
}: {
  filters: PortfolioFilters;
  options: {
    workspaces: Array<{ id: string; name: string }>;
    teams: Array<{ id: string; name: string }>;
    priorities: string[];
    statuses: string[];
    maturities: string[];
    owners: Array<{ id: string; name: string }>;
  };
  onChange: (key: keyof PortfolioFilters, value: string) => void;
  onApply: () => void;
  onClear: () => void;
}) {
  return (
    <div style={filterPanel}>
      <Filter label="Espacio">
        <select
          value={filters.workspaceId ?? ''}
          onChange={(event) => onChange('workspaceId', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todos</option>
          {options.workspaces.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Equipo">
        <select
          value={filters.teamId ?? ''}
          onChange={(event) => onChange('teamId', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todos</option>
          {options.teams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Prioridad">
        <select
          value={filters.priority ?? ''}
          onChange={(event) => onChange('priority', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todas</option>
          {options.priorities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Riesgo">
        <select
          value={filters.risk ?? ''}
          onChange={(event) => onChange('risk', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todos</option>
          <option value="HIGH">Alto</option>
          <option value="MEDIUM">Medio</option>
          <option value="LOW">Bajo</option>
        </select>
      </Filter>
      <Filter label="Estado">
        <select
          value={filters.status ?? ''}
          onChange={(event) => onChange('status', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todos</option>
          {options.statuses.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Madurez">
        <select
          value={filters.maturity ?? ''}
          onChange={(event) => onChange('maturity', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todas</option>
          {options.maturities.map((item) => (
            <option key={item} value={item}>
              {item}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Responsable">
        <select
          value={filters.ownerId ?? ''}
          onChange={(event) => onChange('ownerId', event.target.value)}
          style={filterSelect}
        >
          <option value="">Todos</option>
          {options.owners.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </Filter>
      <Filter label="Desde">
        <input
          type="date"
          value={filters.dateFrom ?? ''}
          onChange={(event) => onChange('dateFrom', event.target.value)}
          style={filterSelect}
        />
      </Filter>
      <Filter label="Hasta">
        <input
          type="date"
          value={filters.dateTo ?? ''}
          onChange={(event) => onChange('dateTo', event.target.value)}
          style={filterSelect}
        />
      </Filter>
      <div style={filterActions}>
        <button onClick={onClear} style={clearButton}>
          <X size={14} /> Limpiar
        </button>
        <button onClick={onApply} style={manageButton}>
          <CalendarClock size={14} /> Aplicar
        </button>
      </div>
    </div>
  );
}
function Filter({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={filterField}>
      {label}
      {children}
    </label>
  );
}
function ProjectTable({
  projects,
  loading = false,
  canManage = false,
  onRemove,
}: {
  projects: PortfolioProject[];
  loading?: boolean;
  canManage?: boolean;
  onRemove?: (projectId: string) => void;
}) {
  if (loading) return <Empty text="Actualizando proyectos…" />;
  if (!projects.length)
    return <Empty text="No hay proyectos vinculados o visibles en esta cartera." />;
  return (
    <div style={table}>
      {projects.map((project) => (
        <div key={project.projectId} style={projectRow}>
          <div style={{ minWidth: 170, flex: 1.35 }}>
            <strong>{project.name}</strong>
            <p style={rowText}>
              {project.workspace.name} · {project.owner?.name ?? 'Sin responsable'}
            </p>
          </div>
          <div style={tableCell}>
            <span style={{ ...healthPill, color: health[project.health].color }}>
              {health[project.health].label}
            </span>
            <p style={rowText}>
              {project.risk === 'HIGH'
                ? 'Riesgo alto'
                : project.risk === 'MEDIUM'
                  ? 'Riesgo medio'
                  : 'Riesgo bajo'}
            </p>
          </div>
          <div style={tableCell}>
            <strong>
              {project.progress.percent === null ? '—' : `${project.progress.percent}%`}
            </strong>
            <p style={rowText}>
              {project.progress.completedCards}/{project.progress.totalCards} tarjetas
            </p>
          </div>
          <div style={tableCell}>
            <strong>{formatDate(project.nextReviewAt || project.nextMilestoneAt)}</strong>
            <p style={rowText}>{project.nextStep || 'Sin próximo paso'}</p>
          </div>
          {project.canOpenProject ? (
            <Link href={`/dashboard/projects/${project.projectId}`} style={projectLink}>
              <ArrowUpRight size={16} />
            </Link>
          ) : (
            <span style={muted}>Sin acceso</span>
          )}
          {canManage && (
            <button onClick={() => onRemove?.(project.projectId)} style={removeButton}>
              Quitar
            </button>
          )}
        </div>
      ))}
    </div>
  );
}

const page: CSSProperties = {
  minHeight: '100%',
  padding: '34px clamp(20px, 4vw, 64px)',
  background: '#12172a',
  color: '#f8fafc',
  fontFamily: "'Manrope', system-ui, sans-serif",
};
const back: CSSProperties = {
  display: 'inline-flex',
  gap: 7,
  alignItems: 'center',
  marginBottom: 22,
  color: '#aab9d1',
  textDecoration: 'none',
  fontSize: 13,
  fontWeight: 700,
};
const header: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 24,
  alignItems: 'flex-end',
  flexWrap: 'wrap',
  marginBottom: 22,
};
const headerActions: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  flexWrap: 'wrap',
};
const eyebrow: CSSProperties = {
  margin: 0,
  color: '#f97316',
  fontWeight: 800,
  fontSize: 11,
  letterSpacing: '.1em',
};
const title: CSSProperties = {
  margin: '5px 0 8px',
  fontSize: 'clamp(30px, 4vw, 45px)',
  letterSpacing: '-.05em',
};
const subtitle: CSSProperties = { margin: 0, color: '#a8b3c7', lineHeight: 1.55, maxWidth: 690 };
const headerMeta: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#aebad0',
  fontSize: 12,
};
const tabRow: CSSProperties = {
  display: 'flex',
  gap: 7,
  borderBottom: '1px solid #2f3950',
  marginBottom: 22,
  overflowX: 'auto',
};
const tabButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 7,
  padding: '10px 13px',
  border: 0,
  borderBottom: '2px solid transparent',
  color: '#9aa8bd',
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 750,
  whiteSpace: 'nowrap',
};
const activeTab: CSSProperties = { ...tabButton, color: '#fff1e9', borderBottomColor: '#f2571e' };
const metricGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
  gap: 12,
  marginBottom: 18,
};
const metric: CSSProperties = {
  display: 'grid',
  gap: 7,
  background: '#181e33',
  border: '1px solid #303a53',
  borderRadius: 12,
  padding: '15px 16px',
};
const section: CSSProperties = {
  background: '#181e33',
  border: '1px solid #303a53',
  borderRadius: 13,
  padding: '18px',
  marginBottom: 20,
};
const sectionHeader: CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 14,
  marginBottom: 15,
};
const sectionTitle: CSSProperties = { margin: 0, fontSize: 18 };
const sectionSub: CSSProperties = {
  margin: '5px 0 0',
  color: '#9ca9bf',
  fontSize: 12.5,
  lineHeight: 1.5,
};
const linkButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: '#f8b28d',
  border: 0,
  background: 'transparent',
  cursor: 'pointer',
  fontWeight: 800,
  whiteSpace: 'nowrap',
};
const secondaryButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  border: '1px solid #3a455e',
  borderRadius: 8,
  padding: '8px 9px',
  color: '#cbd7e9',
  background: '#1b2135',
  cursor: 'pointer',
  fontWeight: 750,
  fontSize: 12,
};
const manageButton: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 5,
  border: 0,
  borderRadius: 8,
  padding: '9px 10px',
  color: '#22140d',
  background: '#f49568',
  cursor: 'pointer',
  fontWeight: 800,
  fontSize: 12,
  whiteSpace: 'nowrap',
};
const filterPanel: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
  gap: 10,
  padding: 13,
  marginBottom: 14,
  border: '1px solid #35405a',
  borderRadius: 10,
  background: '#151b2e',
};
const filterField: CSSProperties = {
  display: 'grid',
  gap: 5,
  color: '#aebbd1',
  fontSize: 11,
  fontWeight: 800,
};
const filterSelect: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  minHeight: 36,
  color: '#ecf0f8',
  background: '#11172a',
  border: '1px solid #38445f',
  borderRadius: 7,
  padding: '7px 8px',
};
const filterActions: CSSProperties = {
  display: 'flex',
  gap: 7,
  alignItems: 'end',
  flexWrap: 'wrap',
};
const clearButton: CSSProperties = { ...secondaryButton, color: '#b6c1d5' };
const associationBox: CSSProperties = {
  display: 'grid',
  gap: 10,
  padding: 13,
  marginBottom: 14,
  border: '1px solid #3e4d69',
  borderRadius: 10,
  background: '#172039',
};
const associationControls: CSSProperties = { display: 'flex', gap: 8, flexWrap: 'wrap' };
const associationInput: CSSProperties = {
  flex: 1,
  minWidth: 150,
  padding: '9px 10px',
  color: '#edf2fb',
  background: '#101629',
  border: '1px solid #3b4761',
  borderRadius: 8,
};
const candidateSelect: CSSProperties = {
  flex: 1,
  minWidth: 180,
  padding: '9px 10px',
  color: '#edf2fb',
  background: '#101629',
  border: '1px solid #3b4761',
  borderRadius: 8,
};
const table: CSSProperties = { display: 'grid', borderTop: '1px solid #303a53' };
const projectRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '13px 3px',
  borderBottom: '1px solid #283149',
  flexWrap: 'wrap',
};
const tableCell: CSSProperties = { minWidth: 110, flex: 0.7 };
const rowText: CSSProperties = {
  margin: '3px 0 0',
  color: '#9ca9bf',
  fontSize: 11.5,
  lineHeight: 1.4,
};
const healthPill: CSSProperties = { display: 'inline-flex', fontWeight: 800, fontSize: 11.5 };
const projectLink: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 5,
  color: '#aad2f8',
  textDecoration: 'none',
  fontSize: 12,
  fontWeight: 800,
  marginLeft: 'auto',
};
const muted: CSSProperties = { color: '#69758c', fontSize: 11, marginLeft: 'auto' };
const removeButton: CSSProperties = {
  border: '1px solid #663b46',
  borderRadius: 7,
  background: '#321e2a',
  color: '#f6b1af',
  padding: '6px 8px',
  cursor: 'pointer',
  fontSize: 11,
  fontWeight: 800,
};
const alertList: CSSProperties = { display: 'grid', gap: 10 };
const alertRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '13px',
  background: '#151b2e',
  border: '1px solid',
  borderRadius: 10,
  flexWrap: 'wrap',
};
const inlineActions: CSSProperties = { display: 'flex', gap: 7, alignItems: 'center' };
const statusText: CSSProperties = {
  margin: '5px 0 0',
  color: '#8c9bb4',
  fontSize: 11,
  fontWeight: 700,
};
const capacityGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 22,
};
const minorTitle: CSSProperties = { margin: '0 0 10px', fontSize: 14, color: '#dfe7f4' };
const capacityRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 12,
  padding: '11px 0',
  borderBottom: '1px solid #2a334a',
};
const load: CSSProperties = {
  border: '1px solid',
  borderRadius: 99,
  padding: '5px 8px',
  fontSize: 12,
  fontWeight: 800,
  whiteSpace: 'nowrap',
};
const formGrid: CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 12,
  marginBottom: 17,
};
const formBox: CSSProperties = {
  display: 'grid',
  gap: 9,
  padding: 13,
  background: '#151b2e',
  border: '1px solid #33405b',
  borderRadius: 10,
  marginBottom: 15,
};
const formLabel: CSSProperties = {
  display: 'grid',
  gap: 5,
  color: '#aebbd1',
  fontSize: 11,
  fontWeight: 800,
};
const memberList: CSSProperties = { display: 'grid' };
const memberRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 11,
  padding: '12px 4px',
  borderBottom: '1px solid #2a334a',
  flexWrap: 'wrap',
};
const rolePill: CSSProperties = {
  marginLeft: 'auto',
  border: '1px solid #47526e',
  borderRadius: 99,
  padding: '4px 7px',
  color: '#d6e1f2',
  fontSize: 11,
  fontWeight: 800,
};
const empty: CSSProperties = {
  minHeight: 230,
  display: 'grid',
  placeItems: 'center',
  alignContent: 'center',
  gap: 10,
  color: '#a8b3c7',
  border: '1px dashed #3d4760',
  borderRadius: 13,
  textAlign: 'center',
};
const emptySmall: CSSProperties = {
  minHeight: 110,
  display: 'grid',
  placeItems: 'center',
  color: '#9ca9bf',
  border: '1px dashed #3a455d',
  borderRadius: 10,
  fontSize: 13,
  textAlign: 'center',
  padding: 12,
};
const errorStyle: CSSProperties = { color: '#fca5a5', margin: '0 0 13px' };
