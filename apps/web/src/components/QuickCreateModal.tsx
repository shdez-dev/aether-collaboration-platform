'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CalendarDays, CheckCircle2, FileText, ListTodo, Plus, X } from 'lucide-react';
import type { Board, List } from '@aether/types';
import { apiService } from '@/services/apiService';
import { useDocumentStore } from '@/stores/documentStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import type { Workspace } from '@/stores/workspaceStore';
import type { Project } from '@/stores/projectStore';
import styles from './QuickCreateModal.module.css';

type CaptureKind = 'task' | 'note' | 'decision';

const options = [
  { kind: 'task', label: 'Tarea', detail: 'Algo por hacer', icon: ListTodo },
  { kind: 'note', label: 'Nota', detail: 'Una idea o apunte', icon: FileText },
  { kind: 'decision', label: 'Decisión', detail: 'Lo acordado y por qué', icon: CheckCircle2 },
  { kind: 'event', label: 'Evento', detail: 'Un momento en el calendario', icon: CalendarDays },
] as const;

export default function QuickCreateModal({ workspaces, activeWorkspaceId, onClose, onEvent }: {
  workspaces: Workspace[];
  activeWorkspaceId: string | null;
  onClose: () => void;
  onEvent: () => void;
}) {
  const router = useRouter();
  const createDocument = useDocumentStore((state) => state.createDocument);
  const setActiveWorkspaceId = useActiveWorkspaceStore((state) => state.setActiveWorkspaceId);
  const availableWorkspaces = useMemo(() => workspaces.filter((workspace) => !workspace.archived), [workspaces]);
  const [kind, setKind] = useState<CaptureKind>('task');
  const [workspaceId, setWorkspaceId] = useState(() =>
    availableWorkspaces.some((workspace) => workspace.id === activeWorkspaceId)
      ? activeWorkspaceId! : availableWorkspaces[0]?.id ?? '');
  const [projectId, setProjectId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [listId, setListId] = useState('');
  const [projects, setProjects] = useState<Project[]>([]);
  const [boards, setBoards] = useState<Board[]>([]);
  const [lists, setLists] = useState<List[]>([]);
  const [loadingDestinations, setLoadingDestinations] = useState(false);
  const [loadingLists, setLoadingLists] = useState(false);
  const [destinationRetry, setDestinationRetry] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [nextStep, setNextStep] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const dialogRef = useRef<HTMLFormElement>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);

  useEffect(() => {
    if (!workspaceId) return;
    let live = true;
    setLoadingDestinations(true);
    setError('');
    setProjects([]);
    setBoards([]);
    setProjectId('');
    setBoardId('');
    setLists([]);
    setListId('');
    Promise.all([
      apiService.get<{ projects: Project[] }>(`/api/workspaces/${workspaceId}/projects`, true),
      apiService.get<{ boards: Board[] }>(`/api/workspaces/${workspaceId}/boards`, true),
    ]).then(([projectResult, boardResult]) => {
      if (!live) return;
      setProjects(projectResult.success ? projectResult.data?.projects ?? [] : []);
      setBoards(boardResult.success ? boardResult.data?.boards ?? [] : []);
      if (!projectResult.success || !boardResult.success) setError('No se pudieron cargar todos los destinos.');
    }).catch(() => {
      if (live) setError('No se pudieron cargar los destinos.');
    }).finally(() => { if (live) setLoadingDestinations(false); });
    return () => { live = false; };
  }, [workspaceId, destinationRetry]);

  useEffect(() => {
    if (!boardId) { setLists([]); setListId(''); return; }
    let live = true;
    setLoadingLists(true);
    setLists([]);
    setListId('');
    apiService.get<{ board: Board }>(`/api/boards/${boardId}`, true).then((result) => {
      if (!live) return;
      if (!result.success) throw new Error(result.error?.message || 'No se pudieron cargar las listas.');
      setLists(result.data?.board.lists ?? []);
    }).catch((cause) => { if (live) setError(cause instanceof Error ? cause.message : 'No se pudieron cargar las listas.'); })
      .finally(() => { if (live) setLoadingLists(false); });
    return () => { live = false; };
  }, [boardId, destinationRetry]);

  const visibleBoards = projectId
    ? boards.filter((board) => projects.find((project) => project.id === projectId)?.boards?.some((item) => item.id === board.id))
    : boards;

  function selectProject(id: string) {
    setProjectId(id);
    setBoardId('');
    setListId('');
    setError('');
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLFormElement>) {
    if (event.key === 'Escape' && !saving) { event.preventDefault(); onClose(); }
    if (event.key !== 'Tab') return;
    const focusables = [...(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled])') ?? [])];
    if (!focusables.length) return;
    if (event.shiftKey && document.activeElement === focusables[0]) { event.preventDefault(); focusables.at(-1)?.focus(); }
    if (!event.shiftKey && document.activeElement === focusables.at(-1)) { event.preventDefault(); focusables[0].focus(); }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (saving || !title.trim() || !workspaceId) return;
    if (kind === 'task' && !listId) { setError('Elige un tablero y una lista para guardar la tarea.'); return; }
    if (kind !== 'task' && !body.trim()) { setError(kind === 'decision' ? 'Explica el motivo de la decisión.' : 'Escribe el contenido de la nota.'); return; }
    setSaving(true);
    setError('');
    try {
      if (kind === 'task') {
        const response = await apiService.post<{ card: { id: string } }>(`/api/lists/${listId}/cards`, {
          title: title.trim(),
          ...(body.trim() && { description: body.trim() }),
          ...(dueDate && { dueDate: new Date(`${dueDate}T12:00:00`).toISOString() }),
        }, true);
        if (!response.success || !response.data?.card) throw new Error(response.error?.message || 'No se pudo crear la tarea.');
        setActiveWorkspaceId(workspaceId);
        onClose();
        router.push(`/dashboard/boards/${boardId}?cardId=${encodeURIComponent(response.data.card.id)}`);
      } else {
        const document = await createDocument(workspaceId, {
          title: kind === 'decision' ? `Decisión: ${title.trim()}` : title.trim(),
          description: body.trim().slice(0, 300),
          projectId: projectId || undefined,
          templateId: kind === 'decision' ? 'decision-record' : 'quick-note',
          metadata: { body: body.trim(), ...(kind === 'decision' && nextStep.trim() && { nextStep: nextStep.trim() }) },
        });
        setActiveWorkspaceId(workspaceId);
        onClose();
        router.push(`/dashboard/documents/${document.id}`);
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'No se pudo guardar. Inténtalo de nuevo.');
      setSaving(false);
    }
  }

  return <div className={styles.backdrop}>
    <form ref={dialogRef} className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="quick-create-title" onKeyDown={onKeyDown} onSubmit={submit}>
      <div className={styles.header}>
        <div><h2 id="quick-create-title">Crear desde aquí</h2><p>Captura la idea ahora y elige dónde guardarla.</p></div>
        <button className={styles.close} type="button" onClick={onClose} disabled={saving} aria-label="Cerrar"><X size={18} /></button>
      </div>

      <div className={styles.kindGrid} role="group" aria-label="Qué quieres crear">
        {options.map((option) => <button key={option.kind} type="button" disabled={saving}
          className={`${styles.kindButton} ${kind === option.kind ? styles.selected : ''}`}
          aria-pressed={kind === option.kind}
          onClick={() => { if (option.kind === 'event') onEvent(); else { setKind(option.kind); setError(''); } }}>
          <option.icon size={19} aria-hidden="true" /><strong>{option.label}</strong><span>{option.detail}</span>
        </button>)}
      </div>

      <div className={styles.fields}>
        <label className={styles.field}>{kind === 'decision' ? '¿Qué se decidió?' : kind === 'note' ? 'Título de la nota' : 'Título de la tarea'}
          <input ref={titleRef} value={title} onChange={(event) => setTitle(event.target.value)}
            maxLength={kind === 'task' ? 255 : kind === 'decision' ? 170 : 180} placeholder={kind === 'decision' ? 'Ej. Continuar con la propuesta A' : kind === 'note' ? 'Ej. Ideas de la reunión' : 'Ej. Preparar la presentación'} required disabled={saving} />
        </label>

        <label className={styles.field}>{kind === 'decision' ? 'Motivo y contexto' : kind === 'note' ? 'Contenido' : 'Descripción (opcional)'}
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={kind === 'task' ? 2 : 4}
            maxLength={kind === 'task' ? 3000 : 5000} required={kind !== 'task'} disabled={saving}
            placeholder={kind === 'decision' ? 'Explica por qué se tomó esta decisión…' : kind === 'note' ? 'Escribe lo que quieres recordar…' : 'Añade contexto para quien vaya a realizarla…'} />
        </label>

        {kind === 'decision' && <label className={styles.field}>Siguiente paso <span>(opcional)</span>
          <textarea value={nextStep} onChange={(event) => setNextStep(event.target.value)} maxLength={1000} rows={2} disabled={saving} placeholder="¿Qué ocurre después?" />
        </label>}
        {kind === 'task' && <label className={styles.field}>Fecha límite <span>(opcional)</span>
          <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} disabled={saving} />
        </label>}

        <div className={styles.destinationHeading}>Dónde guardarlo</div>
        <label className={styles.field}>Espacio de trabajo
          <select value={workspaceId} onChange={(event) => setWorkspaceId(event.target.value)} required disabled={saving}>
            {availableWorkspaces.length === 0 && <option value="">Sin espacios disponibles</option>}
            {availableWorkspaces.map((workspace) => <option key={workspace.id} value={workspace.id}>{workspace.name}</option>)}
          </select>
        </label>

        <label className={styles.field}>Proyecto <span>(opcional)</span>
          <select value={projectId} onChange={(event) => selectProject(event.target.value)} disabled={saving || loadingDestinations}>
            <option value="">{kind === 'task' ? 'Todos los tableros del espacio' : 'Guardar en el espacio'}</option>
            {projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
          </select>
        </label>

        {kind === 'task' && <div className={styles.twoColumns}>
          <label className={styles.field}>Tablero
            <select value={boardId} onChange={(event) => { setBoardId(event.target.value); setError(''); }} disabled={saving || loadingDestinations} required>
              <option value="">{loadingDestinations ? 'Cargando…' : 'Selecciona un tablero'}</option>
              {visibleBoards.map((board) => <option key={board.id} value={board.id}>{board.name}</option>)}
            </select>
          </label>
          <label className={styles.field}>Lista
            <select value={listId} onChange={(event) => setListId(event.target.value)} disabled={saving || loadingLists || !boardId} required>
              <option value="">{loadingLists ? 'Cargando…' : 'Selecciona una lista'}</option>
              {lists.map((list) => <option key={list.id} value={list.id}>{list.name}</option>)}
            </select>
          </label>
        </div>}
        {kind === 'task' && !loadingDestinations && visibleBoards.length === 0 && <p className={styles.hint}>Este {projectId ? 'proyecto' : 'espacio'} aún no tiene tableros disponibles. Crea uno para guardar tareas.</p>}
        {kind === 'task' && boardId && !loadingLists && lists.length === 0 && <p className={styles.hint}>Este tablero aún no tiene listas. Crea una lista para guardar tareas.</p>}
      </div>

      {error && <p className={styles.error} role="alert">{error} {error.includes('cargar') && <button type="button" onClick={() => { setError(''); setDestinationRetry((value) => value + 1); }}>Reintentar</button>}</p>}
      <div className={styles.footer}>
        <button type="button" className={styles.cancel} onClick={onClose} disabled={saving}>Cancelar</button>
        <button type="submit" className={styles.submit} disabled={saving || !workspaceId || !title.trim() || (kind === 'task' ? !listId : !body.trim())}>
          <Plus size={16} aria-hidden="true" />{saving ? 'Guardando…' : `Crear ${kind === 'task' ? 'tarea' : kind === 'note' ? 'nota' : 'decisión'}`}
        </button>
      </div>
    </form>
  </div>;
}
