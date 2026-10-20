'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarDays,
  Check,
  CircleAlert,
  FileText,
  FolderOpen,
  GitBranch,
  LayoutGrid,
  ListTodo,
  LockKeyhole,
  Plus,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Users,
  UsersRound,
} from 'lucide-react';
import { toast } from 'sonner';
import type {
  OrganizationAccessPermission,
  OrganizationAccessRole,
  OrganizationAccessRolePermissions,
} from '@aether/types';
import { apiService } from '@/services/apiService';
import styles from './organization-access-roles.module.css';

type Props = { organizationId: string; canManage: boolean };

const groups: Array<{
  title: string;
  description: string;
  icon: typeof FolderOpen;
  items: Array<{ key: OrganizationAccessPermission; label: string }>;
}> = [
  { title: 'Proyecto', description: 'Dirección y configuración general.', icon: FolderOpen, items: [
    { key: 'project.view', label: 'Ver el proyecto' },
    { key: 'project.manage', label: 'Editar nombre y configuración' },
  ] },
  { title: 'Personas', description: 'Acceso de integrantes y equipos asignados.', icon: Users, items: [
    { key: 'members.manage', label: 'Invitar y cambiar permisos' },
  ] },
  { title: 'Tableros', description: 'Estructura y mantenimiento de tableros.', icon: LayoutGrid, items: [
    { key: 'boards.manage', label: 'Crear y administrar tableros y listas' },
  ] },
  { title: 'Trabajo', description: 'Tarjetas, requisitos y conversación.', icon: ListTodo, items: [
    { key: 'work.create', label: 'Crear tarjetas' },
    { key: 'work.edit', label: 'Editar y mover tarjetas' },
    { key: 'work.delete', label: 'Eliminar tarjetas y contenido' },
    { key: 'work.comment', label: 'Comentar' },
  ] },
  { title: 'Planificación', description: 'Fechas, hitos y sprints.', icon: CalendarDays, items: [
    { key: 'planning.manage', label: 'Crear y administrar la planificación' },
  ] },
  { title: 'Riesgos', description: 'Registro y seguimiento de riesgos.', icon: AlertTriangle, items: [
    { key: 'risks.manage', label: 'Crear y actualizar riesgos' },
  ] },
  { title: 'Documentos', description: 'Archivos y documentos del proyecto.', icon: FileText, items: [
    { key: 'documents.manage', label: 'Crear y administrar documentos' },
  ] },
  { title: 'Trazabilidad avanzada', description: 'Objetivos, entregables, decisiones y resultados.', icon: GitBranch, items: [
    { key: 'traceability.manage', label: 'Crear y administrar registros' },
  ] },
  { title: 'Equipos', description: 'Membresía y configuración de equipos.', icon: UsersRound, items: [
    { key: 'teams.manage', label: 'Administrar miembros y configuración del equipo' },
  ] },
];

const allViewPermissions: OrganizationAccessRolePermissions = {
  'project.view': true, 'project.manage': false,
  'members.manage': false, 'boards.manage': false,
  'work.create': false, 'work.edit': false, 'work.delete': false, 'work.comment': false,
  'planning.manage': false, 'risks.manage': false, 'documents.manage': false,
  'traceability.manage': false, 'teams.manage': false,
};

function cloneRole(role: OrganizationAccessRole): OrganizationAccessRole {
  return { ...role, permissions: { ...role.permissions } };
}

function isSameRole(left: OrganizationAccessRole | null, right: OrganizationAccessRole | null) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function OrganizationAccessRolesPanel({ organizationId, canManage }: Props) {
  const [roles, setRoles] = useState<OrganizationAccessRole[]>([]);
  const [selectedRoleKey, setSelectedRoleKey] = useState('');
  const [draft, setDraft] = useState<OrganizationAccessRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [reloadCount, setReloadCount] = useState(0);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [saveError, setSaveError] = useState('');

  const selectedRole = useMemo(
    () => roles.find((role) => role.roleKey === selectedRoleKey) ?? null,
    [roles, selectedRoleKey],
  );
  const dirty = !isSameRole(draft, selectedRole);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    apiService.get<{ roles: OrganizationAccessRole[] }>(`/api/organizations/${organizationId}/access-roles`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) {
          setRoles([]);
          setLoadError(response.error?.message ?? 'No se pudieron cargar los roles.');
          return;
        }
        const loaded = response.data.roles ?? [];
        setRoles(loaded);
        setSelectedRoleKey((current) => loaded.some((role) => role.roleKey === current) ? current : loaded[0]?.roleKey ?? '');
      })
      .catch(() => { if (active) { setRoles([]); setLoadError('No se pudieron cargar los roles. Revisa tu conexión.'); } })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [organizationId, reloadCount]);

  useEffect(() => {
    setDraft(selectedRole ? cloneRole(selectedRole) : null);
    setSaveError('');
    setConfirmDelete(false);
  }, [selectedRole]);

  function updatePermission(key: OrganizationAccessPermission, value: boolean) {
    setDraft((current) => {
      if (!current) return current;
      const permissions = { ...current.permissions, [key]: value };
      if (value) permissions['project.view'] = true;
      return { ...current, permissions };
    });
    setSaveError('');
  }

  async function createRole() {
    if (!canManage || creating) return;
    setCreating(true);
    setSaveError('');
    const permissions = { ...allViewPermissions, 'work.create': true, 'work.edit': true, 'work.comment': true };
    try {
      const response = await apiService.post<{ role: OrganizationAccessRole }>(
        `/api/organizations/${organizationId}/access-roles`,
        { name: 'Rol personalizado', description: 'Define el acceso que necesita este equipo.', permissions },
        true,
      );
      if (!response.success || !response.data?.role) throw new Error(response.error?.message ?? 'No se pudo crear el rol.');
      setRoles((current) => [...current, response.data!.role]);
      setSelectedRoleKey(response.data.role.roleKey);
      toast.success('Rol personalizado creado.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo crear el rol.');
    } finally { setCreating(false); }
  }

  async function saveRole() {
    if (!canManage || !draft || !selectedRole || !dirty || saving) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await apiService.put<{ role: OrganizationAccessRole }>(
        `/api/organizations/${organizationId}/access-roles/${encodeURIComponent(draft.roleKey)}`,
        { name: draft.name, description: draft.description, permissions: draft.permissions },
        true,
      );
      if (!response.success || !response.data?.role) throw new Error(response.error?.message ?? 'No se pudieron guardar los permisos.');
      setRoles((current) => current.map((role) => role.roleKey === response.data!.role.roleKey ? response.data!.role : role));
      toast.success(`Se guardaron los permisos de ${response.data.role.name}.`);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los permisos.');
    } finally { setSaving(false); }
  }

  async function deleteRole() {
    if (!canManage || !draft || draft.isSystem || draft.assignedCount > 0 || deleting) return;
    setDeleting(true);
    setSaveError('');
    try {
      const response = await apiService.delete<void>(
        `/api/organizations/${organizationId}/access-roles/${encodeURIComponent(draft.roleKey)}`,
        true,
      );
      if (!response.success) throw new Error(response.error?.message ?? 'No se pudo eliminar el rol.');
      const remaining = roles.filter((role) => role.roleKey !== draft.roleKey);
      setRoles(remaining);
      setSelectedRoleKey(remaining[0]?.roleKey ?? '');
      setConfirmDelete(false);
      toast.success('Rol eliminado.');
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'No se pudo eliminar el rol.');
    } finally { setDeleting(false); }
  }

  function discardChanges() {
    setDraft(selectedRole ? cloneRole(selectedRole) : null);
    setSaveError('');
  }

  return (
    <section className={styles.root} aria-labelledby="access-roles-heading">
      <header className={styles.pageHeading}>
        <div className={styles.headingIcon}><ShieldCheck size={19} aria-hidden="true" /></div>
        <div className={styles.headingText}>
          <p className={styles.eyebrow}>ACCESO ORGANIZACIONAL</p>
          <h2 id="access-roles-heading">Roles y permisos</h2>
          <p>Define qué puede hacer cada rol y asígnalo a personas desde proyectos y equipos.</p>
        </div>
        {canManage && <button type="button" className={styles.createButton} onClick={() => void createRole()} disabled={creating || loading}>
          {creating ? <RefreshCw size={15} className={styles.spin} /> : <Plus size={16} />} Crear rol
        </button>}
      </header>

      <div className={styles.policyNote}>
        <LockKeyhole size={16} aria-hidden="true" />
        <p><strong>La propiedad y administración de la organización se gestionan aparte.</strong> Aquí defines los roles que se asignan dentro de proyectos y equipos.</p>
      </div>

      {loading ? <div className={styles.state}><RefreshCw size={17} className={styles.spin} /> Cargando roles…</div>
          : loadError ? <div className={styles.errorState} role="alert"><CircleAlert size={17} /> <span>{loadError}</span><button type="button" onClick={() => { setLoadError(''); setReloadCount((count) => count + 1); }}>Reintentar</button></div>
          : roles.length === 0 ? <div className={styles.state}>Aún no hay roles de acceso configurados.</div>
            : <div className={styles.workspace}>
              <aside className={styles.roleRail} aria-label="Roles de la organización">
                <div className={styles.railHeading}><span>Roles</span><span>{roles.length}</span></div>
                {roles.map((role) => <button
                  key={role.roleKey}
                  type="button"
                  aria-pressed={selectedRoleKey === role.roleKey}
                  onClick={() => { if (dirty && !window.confirm('¿Descartar los cambios sin guardar?')) return; setSelectedRoleKey(role.roleKey); }}
                  className={styles.roleItem}
                >
                  <span className={styles.roleIcon}><ShieldCheck size={16} aria-hidden="true" /></span>
                  <span className={styles.roleItemCopy}><strong>{role.name}</strong><small>{role.isSystem ? 'Predeterminado' : 'Personalizado'}</small></span>
                  {selectedRoleKey === role.roleKey && <Check size={15} className={styles.selectedCheck} aria-hidden="true" />}
                </button>)}
              </aside>

              {draft && <div className={styles.editor}>
                <div className={styles.editorHeading}>
                  <div>
                    <p className={styles.eyebrow}>{draft.isSystem ? 'ROL PREDETERMINADO' : 'ROL PERSONALIZADO'}</p>
                    <h3>Configurar acceso</h3>
                    <p>Los cambios se aplican a todas las personas que tengan este rol.</p>
                  </div>
                  {canManage && !draft.isSystem && <button type="button" className={styles.deleteButton} disabled={draft.assignedCount > 0 || saving || deleting} onClick={() => setConfirmDelete(true)} title={draft.assignedCount > 0 ? `Reasigna primero ${draft.assignedCount} accesos` : 'Eliminar rol'} aria-label="Eliminar rol">
                    <Trash2 size={16} />
                  </button>}
                </div>

                <div className={styles.fields}>
                  <label className={styles.field}>Nombre del rol
                    <input value={draft.name} maxLength={60} disabled={!canManage || saving} onChange={(event) => setDraft((current) => current ? { ...current, name: event.target.value } : current)} />
                  </label>
                  <label className={styles.field}>Descripción
                    <input value={draft.description} maxLength={180} disabled={!canManage || saving} onChange={(event) => setDraft((current) => current ? { ...current, description: event.target.value } : current)} placeholder="Resume cuándo conviene usar este rol" />
                  </label>
                </div>

                <div className={styles.permissionHeading}>
                  <div><h4>Permisos por área</h4><p>Activa las acciones que podrá realizar quien tenga este rol.</p></div>
                  <span>{groups.reduce((count, group) => count + group.items.filter((item) => draft.permissions[item.key]).length, 0)} de {ORGANIZATION_PERMISSION_KEYS.length} activos</span>
                </div>
                <div className={styles.permissionGrid}>
                  {groups.map((group) => <section className={styles.permissionGroup} key={group.title} aria-label={group.title}>
                    <div className={styles.groupHeader}>
                      <span className={styles.groupIcon}><group.icon size={16} aria-hidden="true" /></span>
                      <div className={styles.groupCopy}><h5>{group.title}</h5><p>{group.description}</p></div>
                      <span className={styles.groupCount} aria-label={`${group.items.filter((item) => draft.permissions[item.key]).length} de ${group.items.length} permisos activos`}>
                        {group.items.filter((item) => draft.permissions[item.key]).length}/{group.items.length}
                      </span>
                    </div>
                    <div className={styles.permissionList}>
                      {group.items.map((item) => {
                        const isRootView = item.key === 'project.view';
                        const hasOtherPermission = ORGANIZATION_PERMISSION_KEYS.some((key) => key !== 'project.view' && draft.permissions[key]);
                        const disabled = !canManage || saving || (isRootView && hasOtherPermission);
                        return <label
                          className={`${styles.permissionRow} ${draft.permissions[item.key] ? styles.permissionRowEnabled : ''} ${disabled ? styles.permissionRowDisabled : ''}`}
                          key={item.key}
                        >
                          <span className={styles.permissionCopy}><strong>{item.label}</strong>{isRootView && hasOtherPermission && <small>Necesario mientras el rol tenga otros permisos.</small>}</span>
                          <input type="checkbox" checked={Boolean(draft.permissions[item.key])} disabled={disabled} onChange={(event) => updatePermission(item.key, event.target.checked)} />
                        </label>;
                      })}
                    </div>
                  </section>)}
                </div>

                {draft.assignedCount > 0 && <p className={styles.assignmentInfo}>{draft.assignedCount} asignaciones en proyectos, equipos o invitaciones.</p>}
                {saveError && <p className={styles.errorMessage} role="alert">{saveError}</p>}
                {!canManage && <p className={styles.readOnlyNotice}>Solo los administradores de la organización pueden editar roles.</p>}
                {canManage && <div className={styles.footerActions}>
                  <span className={styles.saveHint}>{dirty ? 'Hay cambios sin guardar' : 'Los cambios están guardados'}</span>
                  <button type="button" className={styles.secondaryButton} onClick={discardChanges} disabled={!dirty || saving}>Cancelar</button>
                  <button type="button" className={styles.saveButton} onClick={() => void saveRole()} disabled={!dirty || saving || draft.name.trim().length < 2}>
                    {saving ? <RefreshCw size={15} className={styles.spin} /> : <Save size={15} />} {saving ? 'Guardando…' : 'Guardar cambios'}
                  </button>
                </div>}
              </div>}
            </div>}

      {confirmDelete && draft && <div className={styles.confirmOverlay}>
        <section role="alertdialog" aria-modal="true" aria-labelledby="delete-access-role-title" className={styles.confirmDialog}>
          <div className={styles.confirmIcon}><Trash2 size={18} /></div>
          <h3 id="delete-access-role-title">¿Eliminar «{draft.name}»?</h3>
          <p>El rol dejará de estar disponible para nuevas asignaciones. Los roles predeterminados no se pueden eliminar.</p>
          {saveError && <p className={styles.errorMessage} role="alert">{saveError}</p>}
          <div className={styles.confirmActions}>
            <button type="button" className={styles.secondaryButton} onClick={() => { setConfirmDelete(false); setSaveError(''); }} disabled={deleting}>Cancelar</button>
            <button type="button" className={styles.deleteConfirmButton} onClick={() => void deleteRole()} disabled={deleting}>{deleting ? <RefreshCw size={15} className={styles.spin} /> : <Trash2 size={15} />} Eliminar rol</button>
          </div>
        </section>
      </div>}
    </section>
  );
}

const ORGANIZATION_PERMISSION_KEYS = [
  'project.view', 'project.manage', 'members.manage', 'boards.manage',
  'work.create', 'work.edit', 'work.delete', 'work.comment', 'planning.manage',
  'risks.manage', 'documents.manage', 'traceability.manage', 'teams.manage',
] as const satisfies readonly OrganizationAccessPermission[];
