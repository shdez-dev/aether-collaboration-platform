'use client';

import { useCallback, useEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { Building2, Check, ChevronDown, CircleAlert, FolderKanban, Layers, LayoutDashboard, MoreHorizontal, Plus, UsersRound, X } from 'lucide-react';
import { apiService } from '@/services/apiService';
import type { Workspace } from '@/stores/workspaceStore';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import styles from './DashboardBoardControls.module.css';

export type DashboardContext = {
  type: 'PERSONAL' | 'ORGANIZATION' | 'WORKSPACE' | 'PROJECT';
  id: string | null;
};

export type DashboardBoardSummary = {
  id: string;
  name: string;
  context: DashboardContext;
};

type OrganizationOption = { id: string; name: string; type: string };
type ProjectOption = { id: string; name: string };
type ContextSelectOption = { value: string; label: string; icon: ReactNode };

function DashboardContextSelect({
  id, label, value, placeholder, options, emptyMessage, fallbackIcon, disabled = false, onChange,
}: {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  options: ContextSelectOption[];
  emptyMessage: string;
  fallbackIcon: ReactNode;
  disabled?: boolean;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [placement, setPlacement] = useState<'above' | 'below'>('below');
  const [maxHeight, setMaxHeight] = useState(220);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const reduceMotion = useReducedMotion();
  const selectedIndex = options.findIndex((option) => option.value === value);
  const listId = `${id}-options`;

  const positionMenu = useCallback(() => {
    const rect = triggerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const below = Math.max(0, window.innerHeight - rect.bottom - 20);
    const above = Math.max(0, rect.top - 20);
    const shouldOpenAbove = below < 180 && above > below;
    setPlacement(shouldOpenAbove ? 'above' : 'below');
    setMaxHeight(Math.max(96, Math.min(240, shouldOpenAbove ? above : below)));
  }, []);

  function openMenu() {
    positionMenu();
    setOpen(true);
  }

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const reposition = () => positionMenu();
    document.addEventListener('pointerdown', closeOutside);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, positionMenu]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }
    if (event.key === 'Tab' && open) {
      setOpen(false);
      event.preventDefault();
      const form = triggerRef.current?.closest('form');
      const focusables = [...(form?.querySelectorAll<HTMLElement>('button:not([disabled]):not([role="option"]), input:not([disabled]), textarea:not([disabled])') ?? [])];
      const triggerIndex = triggerRef.current ? focusables.indexOf(triggerRef.current) : -1;
      const nextIndex = triggerIndex + (event.shiftKey ? -1 : 1);
      const next = focusables[nextIndex] ?? (event.shiftKey ? focusables.at(-1) : focusables[0]) ?? triggerRef.current;
      requestAnimationFrame(() => next?.focus());
      return;
    }
    if (!open && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault();
      openMenu();
      requestAnimationFrame(() => optionRefs.current[Math.max(selectedIndex, 0)]?.focus());
      return;
    }
    if (!open || options.length === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const current = optionRefs.current.findIndex((option) => option === document.activeElement);
      const next = event.key === 'Home' ? 0
        : event.key === 'End' ? options.length - 1
          : current < 0 ? Math.max(selectedIndex, 0)
            : (current + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
      optionRefs.current[next]?.focus();
    }
  }

  function choose(nextValue: string) {
    onChange(nextValue);
    setOpen(false);
    triggerRef.current?.focus();
  }

  const selected = options[selectedIndex];
  return <div ref={rootRef} className={styles.contextSelect} onKeyDown={handleKeyDown}>
    <button
      ref={triggerRef}
      id={id}
      type="button"
      className={`${styles.selectTrigger} ${open ? styles.selectTriggerOpen : ''}`}
      aria-label={label}
      aria-haspopup="listbox"
      aria-expanded={open}
      aria-controls={listId}
      disabled={disabled}
      onClick={() => open ? setOpen(false) : openMenu()}
    >
      <span className={`${styles.selectIcon} ${!selected ? styles.selectIconMuted : ''}`}>{selected?.icon ?? fallbackIcon}</span>
      <span className={`${styles.selectValue} ${!selected ? styles.selectPlaceholder : ''}`}>{selected?.label ?? placeholder}</span>
      <ChevronDown size={15} className={open ? styles.selectChevronOpen : ''} aria-hidden="true" />
    </button>
    <AnimatePresence>
      {open && <motion.div
        id={listId}
        className={`${styles.selectMenu} ${placement === 'above' ? styles.selectMenuAbove : styles.selectMenuBelow}`}
        role="listbox"
        aria-label={label}
        initial={reduceMotion ? false : { opacity: 0, y: placement === 'above' ? 5 : -5, scale: .985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: placement === 'above' ? 3 : -3, scale: .99 }}
        transition={{ duration: reduceMotion ? 0 : .16, ease: [0.16, 1, 0.3, 1] }}
        style={{ maxHeight, pointerEvents: open ? 'auto' : 'none' }}
      >
        {options.length ? options.map((option, index) => <button
          key={option.value}
          ref={(element) => { optionRefs.current[index] = element; }}
          type="button"
          role="option"
          aria-selected={option.value === value}
          className={`${styles.selectOption} ${option.value === value ? styles.selectOptionSelected : ''}`}
          onClick={() => choose(option.value)}
        >
          <span className={styles.optionIcon}>{option.icon}</span>
          <span className={styles.optionName}>{option.label}</span>
          {option.value === value && <Check size={15} className={styles.optionCheck} aria-hidden="true" />}
        </button>) : <div className={styles.selectEmpty}>{emptyMessage}</div>}
      </motion.div>}
    </AnimatePresence>
  </div>;
}

const CONTEXT_LABELS: Record<DashboardContext['type'], string> = {
  PERSONAL: 'Personal',
  ORGANIZATION: 'Organización',
  WORKSPACE: 'Espacio',
  PROJECT: 'Proyecto',
};

function contextIcon(type: DashboardContext['type'], size = 15) {
  if (type === 'ORGANIZATION') return <Building2 size={size} aria-hidden="true" />;
  if (type === 'WORKSPACE') return <UsersRound size={size} aria-hidden="true" />;
  if (type === 'PROJECT') return <FolderKanban size={size} aria-hidden="true" />;
  return <LayoutDashboard size={size} aria-hidden="true" />;
}

export function DashboardBoardControls({
  boards, activeId, organizations, workspaces, activeOrganizationId, activeWorkspaceId,
  loading, busy, error, onRetry, onSelect, onCreate, onRename, onDelete,
}: {
  boards: DashboardBoardSummary[];
  activeId: string | null;
  organizations: OrganizationOption[];
  workspaces: Workspace[];
  activeOrganizationId: string | null;
  activeWorkspaceId: string | null;
  loading: boolean;
  busy: boolean;
  error: string;
  onRetry: () => void;
  onSelect: (id: string) => Promise<boolean>;
  onCreate: (name: string, context: DashboardContext) => Promise<boolean>;
  onRename: (id: string, name: string) => Promise<boolean>;
  onDelete: (id: string) => Promise<boolean>;
}) {
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelPosition, setPanelPosition] = useState<{ left: number; top: number; width: number } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [createOpen, setCreateOpen] = useState(false);
  const [contextType, setContextType] = useState<DashboardContext['type']>('PERSONAL');
  const [organizationId, setOrganizationId] = useState(activeOrganizationId ?? '');
  const [workspaceId, setWorkspaceId] = useState(activeWorkspaceId ?? '');
  const [projectId, setProjectId] = useState('');
  const [projects, setProjects] = useState<ProjectOption[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(false);
  const [projectsError, setProjectsError] = useState('');
  const [projectReloadKey, setProjectReloadKey] = useState(0);
  const [name, setName] = useState('Personal');
  const [nameEdited, setNameEdited] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const dockRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();
  const activeBoard = boards.find((board) => board.id === activeId);
  const availableWorkspaces = workspaces.filter((workspace) => !workspace.archived && workspace.organizationId === organizationId);
  const selectedOrganization = organizations.find((item) => item.id === organizationId);
  const selectedWorkspace = workspaces.find((item) => item.id === workspaceId);
  const selectedProject = projects.find((item) => item.id === projectId);
  const targetId = contextType === 'ORGANIZATION' ? organizationId : contextType === 'WORKSPACE' ? workspaceId : contextType === 'PROJECT' ? projectId : null;
  const targetReady = contextType === 'PERSONAL' || Boolean(targetId);
  useEffect(() => {
    if (!createOpen) return;
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => { if (dialog?.open) dialog.close(); };
  }, [createOpen]);

  useEffect(() => {
    if (!panelOpen) return;
    function handlePointerDown(event: PointerEvent) {
      const target = event.target as Node;
      if (dockRef.current?.contains(target) || panelRef.current?.contains(target)) return;
      setPanelOpen(false);
      setMenuOpen(false);
      setManageOpen(false);
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== 'Escape' || createOpen) return;
      setPanelOpen(false);
      setMenuOpen(false);
      setManageOpen(false);
    }
    function handleResize() {
      setPanelOpen(false);
      setMenuOpen(false);
      setManageOpen(false);
    }
    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
    };
  }, [panelOpen, createOpen]);

  useEffect(() => {
    if (!createOpen || contextType !== 'PROJECT' || !workspaceId) return;
    let cancelled = false;
    setProjectsLoading(true);
    setProjectsError('');
    setProjects([]);
    setProjectId('');
    void apiService.get<{ projects: ProjectOption[] }>(`/api/workspaces/${workspaceId}/projects`, true)
      .then((response) => {
        if (cancelled) return;
        if (!response.success || !response.data) throw new Error(response.error?.message ?? 'No se pudieron cargar los proyectos.');
        setProjects(response.data.projects ?? []);
      })
      .catch((cause) => { if (!cancelled) setProjectsError(cause instanceof Error ? cause.message : 'No se pudieron cargar los proyectos.'); })
      .finally(() => { if (!cancelled) setProjectsLoading(false); });
    return () => { cancelled = true; };
  }, [createOpen, contextType, workspaceId, projectReloadKey]);

  useEffect(() => {
    if (nameEdited) return;
    const suggestion = contextType === 'PERSONAL' ? 'Mi tablero personal'
      : contextType === 'ORGANIZATION' ? selectedOrganization?.name ?? 'Organización'
        : contextType === 'WORKSPACE' ? selectedWorkspace?.name ?? 'Espacio'
          : selectedProject?.name ?? 'Proyecto';
    const matchingNames = boards.filter((board) => board.name === suggestion || board.name.startsWith(`${suggestion} `)).length;
    const suffix = matchingNames ? ` ${matchingNames + 1}` : '';
    setName(`${suggestion.slice(0, 80 - suffix.length)}${suffix}`);
  }, [boards, contextType, nameEdited, selectedOrganization?.name, selectedWorkspace?.name, selectedProject?.name]);

  function openCreate() {
    const initialOrganization = organizations.find((item) => item.id === activeOrganizationId) ?? organizations[0];
    const initialWorkspace = workspaces.find((item) => item.id === activeWorkspaceId && item.organizationId === initialOrganization?.id && !item.archived)
      ?? workspaces.find((item) => item.organizationId === initialOrganization?.id && !item.archived);
    setContextType('PERSONAL');
    setOrganizationId(initialOrganization?.id ?? '');
    setWorkspaceId(initialWorkspace?.id ?? '');
    setProjectId('');
    setName('Mi tablero personal');
    setNameEdited(false);
    setMenuOpen(false);
    setManageOpen(false);
    setPanelOpen(false);
    setCreateOpen(true);
  }

  function openBoardSwitcher() {
    const nextOpen = !panelOpen;
    if (nextOpen) {
      const anchor = dockRef.current?.getBoundingClientRect();
      if (anchor) {
        const left = anchor.right + 9;
        const width = Math.max(184, Math.min(312, window.innerWidth - left - 12));
        const maxHeight = Math.min(560, window.innerHeight * 0.78);
        const top = Math.max(12, Math.min(anchor.top, window.innerHeight - maxHeight - 12));
        setPanelPosition({ left, top, width });
      }
      setMenuOpen(true);
      setManageOpen(false);
    } else {
      setMenuOpen(false);
      setManageOpen(false);
    }
    setPanelOpen(nextOpen);
  }

  function changeOrganization(id: string) {
    setOrganizationId(id);
    setWorkspaceId(workspaces.find((item) => item.organizationId === id && !item.archived)?.id ?? '');
    setProjectId('');
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim() || !targetReady || busy) return;
    const created = await onCreate(name.trim(), { type: contextType, id: targetId });
    if (created) setCreateOpen(false);
  }

  async function submitRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeBoard || !renameValue.trim()) return;
    if (await onRename(activeBoard.id, renameValue.trim())) {
      setRenaming(false);
      setManageOpen(false);
    }
  }

  return <>
    <div className={styles.dock} ref={dockRef}>
      <button
        type="button"
        className={styles.launcher}
        onClick={openBoardSwitcher}
        title={`Tablero: ${activeBoard?.name ?? 'Mis tableros'}. Cambiar tablero`}
        aria-label={`Cambiar tablero. Actual: ${activeBoard?.name ?? 'Mis tableros'}`}
        aria-expanded={panelOpen}
        aria-controls="dashboard-board-toolbar"
      >
        <span className={styles.launcherIcon}><Layers size={18} aria-hidden="true" /></span>
        <ChevronDown className={styles.launcherChevron} size={11} aria-hidden="true" />
      </button>
    </div>

    {typeof document !== 'undefined' && createPortal(<AnimatePresence initial={false}>
      {panelOpen && panelPosition && <motion.div
        ref={panelRef}
        id="dashboard-board-toolbar"
        className={styles.bar}
        role="group"
        aria-label="Cambiar tablero"
        style={{ left: panelPosition.left, top: panelPosition.top, width: panelPosition.width }}
        initial={reduceMotion ? false : { opacity: 0, x: -8, scale: 0.985 }}
        animate={{ opacity: 1, x: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: -6, scale: 0.99 }}
        transition={{ duration: reduceMotion ? 0 : 0.18, ease: [0.16, 1, 0.3, 1] }}
      >
      <div className={styles.selector}>
        <button type="button" className={styles.current} onClick={() => setMenuOpen((value) => !value)} aria-expanded={menuOpen} aria-controls="dashboard-board-list" disabled={loading || busy}>
          <span className={styles.currentIcon}>{activeBoard ? contextIcon(activeBoard.context.type, 16) : <LayoutDashboard size={16} />}</span>
          <span className={styles.currentText}><strong>{loading ? 'Cargando tableros…' : activeBoard?.name ?? 'Mis tableros'}</strong><small>{activeBoard ? CONTEXT_LABELS[activeBoard.context.type] : 'Personaliza tu espacio'}</small></span>
          <ChevronDown size={15} className={menuOpen ? styles.chevronOpen : ''} aria-hidden="true" />
        </button>
        {menuOpen && <div className={styles.menu} id="dashboard-board-list">
          <span className={styles.menuLabel}>Cambiar de tablero</span>
          {boards.map((board) => <button type="button" key={board.id} className={`${styles.menuItem} ${board.id === activeId ? styles.menuItemActive : ''}`} onClick={() => { void onSelect(board.id).then((selected) => { if (selected) { setMenuOpen(false); setPanelOpen(false); } }); }}>
            {contextIcon(board.context.type)}<span><strong>{board.name}</strong><small>{CONTEXT_LABELS[board.context.type]}</small></span>
          </button>)}
        </div>}
      </div>
      <div className={styles.barActions}>
        <button type="button" className={styles.addButton} onClick={openCreate} disabled={loading || busy}><Plus size={15} /> <span>Nuevo tablero</span></button>
        <button type="button" className={styles.moreButton} onClick={() => { setManageOpen((value) => !value); setConfirmDelete(false); setRenaming(false); }} disabled={!activeBoard || busy} aria-label="Opciones del tablero" aria-expanded={manageOpen}><MoreHorizontal size={18} /></button>
        {manageOpen && activeBoard && <div className={styles.manageMenu}>
          {renaming ? <form onSubmit={(event) => void submitRename(event)}><label htmlFor="dashboard-rename">Nuevo nombre</label><input id="dashboard-rename" value={renameValue} maxLength={80} onChange={(event) => setRenameValue(event.target.value)} autoFocus /><button type="submit" disabled={busy || !renameValue.trim()}>Guardar</button></form>
            : confirmDelete ? <div className={styles.deleteConfirm}><strong>¿Eliminar «{activeBoard.name}»?</strong><span>Se borrará su distribución de widgets.</span><div><button type="button" onClick={() => setConfirmDelete(false)}>Cancelar</button><button type="button" disabled={busy} onClick={() => { void onDelete(activeBoard.id).then((deleted) => { if (deleted) setManageOpen(false); }); }}>Eliminar</button></div></div>
              : <><button type="button" onClick={() => { setRenameValue(activeBoard.name); setRenaming(true); }}>Cambiar nombre</button><button type="button" disabled={boards.length < 2} onClick={() => setConfirmDelete(true)}>Eliminar tablero</button></>}
          {error && <small className={styles.manageError} role="alert">{error}</small>}
        </div>}
      </div>
      {error && !createOpen && !manageOpen && <button type="button" className={styles.barError} role="alert" title={error} aria-label={`${error} Reintentar`} onClick={onRetry}><CircleAlert size={14} /><span>Reintentar</span></button>}
      <button type="button" className={styles.closeButton} onClick={() => { setPanelOpen(false); setMenuOpen(false); setManageOpen(false); }} aria-label="Cerrar selector de tableros" title="Cerrar"><X size={16} /></button>
      </motion.div>}
    </AnimatePresence>, document.body)}

    {createOpen && <dialog ref={dialogRef} className={styles.dialog} onClose={() => setCreateOpen(false)} onCancel={(event) => { if (busy) event.preventDefault(); else setCreateOpen(false); }} aria-labelledby="dashboard-create-title">
      <form onSubmit={(event) => void submitCreate(event)}>
        <div className={styles.dialogHeading}><div><h2 id="dashboard-create-title">Crear tablero</h2><p>Elige el lugar de trabajo que quieres tener a la vista.</p></div><button type="button" onClick={() => setCreateOpen(false)} disabled={busy} aria-label="Cerrar"><X size={18} /></button></div>
        <fieldset className={styles.contextChoices}><legend>Contexto</legend>
          {(['PERSONAL', 'ORGANIZATION', 'WORKSPACE', 'PROJECT'] as const).map((type) => <label key={type} className={contextType === type ? styles.contextActive : ''}>
            <input type="radio" name="dashboard-context" value={type} checked={contextType === type} onChange={() => { setContextType(type); setNameEdited(false); }} />
            {contextIcon(type, 17)}<span><strong>{CONTEXT_LABELS[type]}</strong><small>{type === 'PERSONAL' ? 'Tu trabajo en AETHER' : type === 'ORGANIZATION' ? 'Todos sus espacios' : type === 'WORKSPACE' ? 'Un espacio concreto' : 'Un proyecto concreto'}</small></span>
          </label>)}
        </fieldset>
        <AnimatePresence initial={false} mode="wait">
          {contextType !== 'PERSONAL' && <motion.div
            key={contextType}
            className={`${styles.targetFields} ${contextType === 'ORGANIZATION' ? styles.targetFieldsSingle : ''}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -7 }}
            animate={{ opacity: 1, height: 'auto', y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, height: 0, y: -7 }}
            transition={{ duration: reduceMotion ? 0 : .2, ease: [0.16, 1, 0.3, 1] }}
          >
          <div className={styles.targetField}><span>Organización</span><DashboardContextSelect
            id="dashboard-create-organization"
            label="Organización"
            value={organizationId}
            placeholder={organizations.length ? 'Selecciona una organización' : 'No hay organizaciones disponibles'}
            emptyMessage="No hay organizaciones disponibles."
            fallbackIcon={<Building2 size={15} aria-hidden="true" />}
            options={organizations.map((item) => ({ value: item.id, label: item.name, icon: <Building2 size={15} aria-hidden="true" /> }))}
            onChange={changeOrganization}
          /></div>
          {(contextType === 'WORKSPACE' || contextType === 'PROJECT') && <div className={styles.targetField}><span>Espacio</span><DashboardContextSelect
            id="dashboard-create-workspace"
            label="Espacio"
            value={workspaceId}
            placeholder={availableWorkspaces.length ? 'Selecciona un espacio' : 'No hay espacios disponibles'}
            emptyMessage="Esta organización todavía no tiene espacios activos."
            fallbackIcon={<UsersRound size={15} aria-hidden="true" />}
            options={availableWorkspaces.map((item) => ({ value: item.id, label: item.name, icon: <WorkspaceIcon icon={item.icon ?? 'Folder'} size={15} color={item.color ?? 'var(--c-accent-text)'} aria-hidden="true" /> }))}
            onChange={(nextId) => { setWorkspaceId(nextId); setProjectId(''); }}
          /></div>}
          {contextType === 'PROJECT' && <div className={styles.targetField}><span>Proyecto</span><DashboardContextSelect
            id="dashboard-create-project"
            label="Proyecto"
            value={projectId}
            placeholder={projectsLoading ? 'Cargando proyectos…' : projects.length ? 'Selecciona un proyecto' : 'No hay proyectos disponibles'}
            emptyMessage={projectsLoading ? 'Cargando proyectos…' : 'Este espacio todavía no tiene proyectos.'}
            fallbackIcon={<FolderKanban size={15} aria-hidden="true" />}
            disabled={projectsLoading || !workspaceId}
            options={projects.map((item) => ({ value: item.id, label: item.name, icon: <FolderKanban size={15} aria-hidden="true" /> }))}
            onChange={setProjectId}
          />{projectsError && <small role="alert">{projectsError} <button type="button" onClick={() => setProjectReloadKey((value) => value + 1)}>Reintentar</button></small>}</div>}
          </motion.div>}
        </AnimatePresence>
        <label className={styles.nameField}>Nombre del tablero<input value={name} maxLength={80} onChange={(event) => { setName(event.target.value); setNameEdited(true); }} placeholder="Ej. Mi semana" required /></label>
        {error && <p className={styles.formError} role="alert">{error}</p>}
        <div className={styles.footer}><button type="button" onClick={() => setCreateOpen(false)} disabled={busy}>Cancelar</button><button type="submit" disabled={busy || !targetReady || !name.trim()}>{busy ? 'Creando…' : 'Crear tablero'}</button></div>
      </form>
    </dialog>}
  </>;
}
