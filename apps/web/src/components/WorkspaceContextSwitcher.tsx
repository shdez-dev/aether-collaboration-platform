'use client';

import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Check,
  ChevronDown,
  Plus,
  RefreshCw,
  Settings2,
  UserPlus,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Workspace } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { getDisplayOrganizationName } from '@/lib/organizationName';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import styles from './WorkspaceContextSwitcher.module.css';

type SwitcherStep = 'workspaces' | 'organizations';

type OrganizationGroup = {
  id: string;
  name: string;
  type: string;
  role?: string;
  workspaces: Workspace[];
  workspaceCount?: number;
};

type OrganizationSummary = { id: string; name: string; type: string; role?: string; workspaceCount?: number };

type WorkspaceContextSwitcherProps = {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  activeOrganizationId: string | null;
  activeOrganization: OrganizationSummary | null;
  onSelect: (workspaceId: string) => void;
  onSelectOrganization: (organizationId: string) => void;
  onCreateNew: (organizationId?: string) => void;
  onNewOrganization: () => void;
  onEdit: (workspace: Workspace) => void;
  onRefresh: () => Promise<void>;
};

function workspaceModeLabel(mode?: string) {
  if (mode === 'PERSONAL') return 'Personal';
  if (mode === 'INSTITUTIONAL') return 'Institucional';
  return 'Equipo';
}

export default function WorkspaceContextSwitcher({
  workspaces,
  activeWorkspaceId,
  activeOrganizationId,
  activeOrganization,
  onSelect,
  onSelectOrganization,
  onCreateNew,
  onNewOrganization,
  onEdit,
  onRefresh,
}: WorkspaceContextSwitcherProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<SwitcherStep>('workspaces');
  const [refreshing, setRefreshing] = useState(false);
  const [organizationRecords, setOrganizationRecords] = useState<OrganizationGroup[]>([]);
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationsError, setOrganizationsError] = useState('');
  const [organizationLoadAttempt, setOrganizationLoadAttempt] = useState(0);

  const activeWorkspaces = useMemo(
    () => workspaces.filter((workspace) => !workspace.archived),
    [workspaces],
  );
  const organizations = useMemo(() => {
    const groups = new Map<string, OrganizationGroup>();
    organizationRecords.forEach((organization) => groups.set(organization.id, { ...organization, workspaces: [...organization.workspaces] }));
    if (activeOrganization) groups.set(activeOrganization.id, {
      ...groups.get(activeOrganization.id), ...activeOrganization,
      workspaces: groups.get(activeOrganization.id)?.workspaces ?? [],
    });
    activeWorkspaces.forEach((workspace) => {
      const id = workspace.organization?.id ?? workspace.organizationId;
      const group = groups.get(id);
      if (group) {
        group.workspaces.push(workspace);
        group.workspaceCount = Math.max(group.workspaceCount ?? 0, group.workspaces.length);
        return;
      }
      groups.set(id, {
        id,
        name: getDisplayOrganizationName(workspace.organization?.name ?? 'Organización'),
        type: workspace.organization?.type ?? 'COMPANY',
        workspaces: [workspace],
        workspaceCount: 1,
      });
    });
    return [...groups.values()];
  }, [activeWorkspaces, organizationRecords, activeOrganization]);

  useEffect(() => {
    if (!open || step !== 'organizations') return;
    let active = true;
    setOrganizationsLoading(true);
    setOrganizationsError('');
    apiService.get<{ organizations: OrganizationSummary[] }>('/api/organizations', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data || !Array.isArray(response.data.organizations)) {
          setOrganizationsError(response.error?.message ?? 'No se pudieron actualizar las organizaciones.');
          return;
        }
        setOrganizationRecords(response.data.organizations.map((organization) => ({
          id: organization.id,
          name: getDisplayOrganizationName(organization.name),
          type: organization.type,
          role: organization.role,
          workspaceCount: organization.workspaceCount ?? 0,
          workspaces: [],
        })));
      })
      .catch(() => {
        if (active) setOrganizationsError('No se pudieron cargar las organizaciones. Comprueba tu conexión e inténtalo de nuevo.');
      })
      .finally(() => { if (active) setOrganizationsLoading(false); });
    return () => { active = false; };
  }, [open, step, organizationLoadAttempt]);

  const activeWorkspace = activeWorkspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null;
  const selectedOrganization = organizations.find(
    (organization) => organization.id === activeOrganizationId,
  );
  const organizationWorkspaces = selectedOrganization?.workspaces ?? [];
  const organizationName = getDisplayOrganizationName(selectedOrganization?.name ?? 'Tu organización');
  const canCreateWorkspace = selectedOrganization?.role === 'OWNER' || selectedOrganization?.role === 'ADMIN';
  const emptyWorkspaceLabel = (selectedOrganization?.workspaceCount ?? 0) > 0 ? 'Sin acceso' : 'Sin espacios';

  async function refreshWorkspaces() {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
    }
  }

  function selectOrganization(organization: OrganizationGroup) {
    const firstWorkspace =
      organization.workspaces.find((workspace) => workspace.id === activeWorkspaceId) ??
      organization.workspaces[0];
    if (!firstWorkspace) {
      setOpen(false);
      onSelectOrganization(organization.id);
      return;
    }
    if (firstWorkspace && firstWorkspace.id !== activeWorkspaceId) {
      onSelect(firstWorkspace.id);
    }
    setStep('workspaces');
    setOpen(false);
  }

  const color = activeWorkspace?.color ?? '#7452A6';

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (nextOpen) setStep('workspaces');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          className={`${styles.trigger} dsh-workspace-trigger`}
          aria-label={`Cambiar espacio de trabajo: ${organizationName}, ${activeWorkspace?.name ?? emptyWorkspaceLabel}`}
        >
          <span className={styles.triggerIcon} style={{ '--workspace-color': color } as React.CSSProperties} aria-hidden="true">
            <WorkspaceIcon icon={activeWorkspace?.icon ?? 'briefcase'} size={17} />
          </span>
          <span className={`${styles.triggerCopy} dsh-workspace-copy`}>
            <strong title={activeWorkspace?.name ?? emptyWorkspaceLabel}>{activeWorkspace?.name ?? emptyWorkspaceLabel}</strong>
            <small title={organizationName}>{organizationName}</small>
          </span>
          {activeWorkspace ? <span className={`${styles.modePill} dsh-workspace-mode`}>{workspaceModeLabel(activeWorkspace.mode)}</span> : null}
          <ChevronDown className={`${styles.chevron} dsh-workspace-chevron`} data-open={open} size={16} aria-hidden="true" />
        </button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="right"
        sideOffset={10}
        collisionPadding={12}
        className={styles.panel}
        aria-label="Cambiar organización y espacio de trabajo"
      >
            <header className={styles.panelHeader}>
              <span className={styles.eyebrow}>CAMBIAR DE LUGAR</span>
              <h2>Tu espacio de trabajo</h2>
            </header>

            <AnimatePresence mode="wait" initial={false}>
              {step === 'workspaces' ? (
                <motion.section
                  key="workspaces"
                  className={styles.step}
                  aria-label="Espacios de trabajo"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className={styles.stepHeader}>
                    <div className={styles.organizationHeading}>
                      <span className={styles.eyebrow}>ORGANIZACIÓN</span>
                      <h3>{organizationName}</h3>
                    </div>
                    <button
                      type="button"
                      className={styles.textAction}
                      onClick={() => setStep('organizations')}
                    >
                      Cambiar <ArrowRight size={15} aria-hidden="true" />
                    </button>
                  </div>

                  <div className={styles.options} data-scrollable={organizationWorkspaces.length > 4}>
                    {organizationWorkspaces.length ? organizationWorkspaces.map((workspace) => {
                      const selected = workspace.id === activeWorkspaceId;
                      const workspaceColor = workspace.color ?? '#7452A6';
                      return (
                        <button
                          key={workspace.id}
                          type="button"
                          className={styles.option}
                          data-selected={selected}
                          aria-pressed={selected}
                          onClick={() => {
                            onSelect(workspace.id);
                            setOpen(false);
                          }}
                        >
                          <span className={styles.optionIcon} style={{ '--workspace-color': workspaceColor } as React.CSSProperties} aria-hidden="true">
                            <WorkspaceIcon icon={workspace.icon ?? 'briefcase'} size={17} />
                          </span>
                          <span className={styles.optionCopy}>
                            <strong>{workspace.name}</strong>
                            {selected ? <small>Espacio actual</small> : null}
                          </span>
                          {selected ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                        </button>
                      );
                    }) : (
                      <p className={styles.emptyState}>{emptyWorkspaceLabel === 'Sin acceso' ? 'Todavía no tienes acceso a un espacio de esta organización.' : 'Esta organización todavía no tiene espacios.'}</p>
                    )}
                  </div>

                  <div className={styles.spaceActions}>
                    {canCreateWorkspace && <button type="button" className={styles.createAction} onClick={() => { setOpen(false); onCreateNew(activeOrganizationId ?? undefined); }}>
                      <Plus size={16} aria-hidden="true" />
                      Nuevo espacio
                    </button>}
                    {activeOrganizationId && selectedOrganization?.type !== 'PERSONAL' ? (
                      <button
                        type="button"
                        className={styles.manageAction}
                        onClick={() => {
                          setOpen(false);
                          router.push(`/dashboard/organizations?organizationId=${encodeURIComponent(activeOrganizationId)}`);
                        }}
                      >
                        <UserPlus size={15} aria-hidden="true" />
                        Miembros de la organización
                      </button>
                    ) : null}
                  </div>
                </motion.section>
              ) : (
                <motion.section
                  key="organizations"
                  className={styles.step}
                  aria-label="Organizaciones"
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: 'easeOut' }}
                >
                  <div className={styles.stepHeader}>
                    <button type="button" className={styles.backAction} onClick={() => setStep('workspaces')}>
                      <ArrowLeft size={15} aria-hidden="true" /> Volver
                    </button>
                    <h3>Organizaciones</h3>
                  </div>
                  {organizationsLoading && organizations.length === 0 ? (
                    <p className={styles.emptyState} role="status">Cargando organizaciones…</p>
                  ) : null}
                  {organizationsError ? (
                    <p className={styles.emptyState} role="status">
                      {organizationsError}{' '}
                      <button type="button" className={styles.textAction} onClick={() => setOrganizationLoadAttempt((attempt) => attempt + 1)}>
                        Reintentar
                      </button>
                    </p>
                  ) : null}
                  <div className={styles.options} data-scrollable={organizations.length > 4}>
                    {organizations.map((organization) => {
                      const selected = organization.id === activeOrganizationId;
                      return (
                        <button
                          key={organization.id}
                          type="button"
                          className={styles.option}
                          data-selected={selected}
                          aria-pressed={selected}
                          onClick={() => selectOrganization(organization)}
                        >
                          <span className={styles.organizationIcon} aria-hidden="true"><Building2 size={17} /></span>
                          <span className={styles.optionCopy}>
                            <strong>{organization.name}</strong>
                            <small>{selected ? 'Organización actual' : `${organization.workspaceCount ?? organization.workspaces.length} ${(organization.workspaceCount ?? organization.workspaces.length) === 1 ? 'espacio' : 'espacios'}`}</small>
                          </span>
                          {selected ? <Check size={17} aria-hidden="true" /> : <ArrowRight size={16} aria-hidden="true" />}
                        </button>
                      );
                    })}
                  </div>
                  <div className={styles.spaceActions}>
                    <button type="button" className={styles.createAction} onClick={() => { setOpen(false); onNewOrganization(); }}>
                      <Plus size={16} aria-hidden="true" />
                      Nueva organización
                    </button>
                  </div>
                </motion.section>
              )}
            </AnimatePresence>

            <footer className={styles.panelFooter}>
              <button
                type="button"
                className={styles.footerAction}
                disabled={!activeWorkspace && !activeOrganizationId}
                onClick={() => {
                  setOpen(false);
                  if (activeWorkspace) onEdit(activeWorkspace);
                  else if (activeOrganizationId) router.push(`/dashboard/organizations?organizationId=${encodeURIComponent(activeOrganizationId)}`);
                }}
              >
                <Settings2 size={15} aria-hidden="true" /> Configuración
              </button>
              <button type="button" className={styles.footerAction} onClick={() => void refreshWorkspaces()} disabled={refreshing}>
                <RefreshCw size={15} className={refreshing ? styles.spinning : undefined} aria-hidden="true" />
                {refreshing ? 'Actualizando' : 'Actualizar'}
              </button>
            </footer>
      </PopoverContent>
    </Popover>
  );
}
