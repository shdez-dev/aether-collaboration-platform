'use client';

import type { Document } from '@aether/types';
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { ArrowRight, BookOpen, Check, CheckCheck, ChevronDown, FileCheck2, FilePlus2, FileText, Link2, LoaderCircle, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { projectApi, type ProjectDecision, type ProjectDocumentCategory, type ProjectDocumentation, type ProjectEvidenceLink, type ProjectEvidenceTargetType, type ProjectTraceabilityData } from '@/features/projects/api';
import styles from './ProjectDocumentsTab.module.css';

type Props = {
  projectId: string;
  advancedTraceability: boolean;
  documents: Document[];
  canEdit: boolean;
  canLinkEvidence: boolean;
  onCreate: () => void;
  onCreateSuggested: (category: ProjectDocumentCategory, title: string) => void;
  onOpen: (documentId: string) => void;
};
type Target = { value: string; type: ProjectEvidenceTargetType; id: string | null; label: string };
const guide: { key: ProjectDocumentCategory; title: string; why: string }[] = [
  { key: 'DIRECTION', title: 'Visión y alcance', why: 'Problema, objetivo, límites y criterios de éxito.' },
  { key: 'REQUIREMENTS', title: 'Requisitos y criterios de aceptación', why: 'Qué se necesita y cómo se comprobará.' },
  { key: 'ARCHITECTURE', title: 'Arquitectura y decisiones técnicas', why: 'Componentes, integraciones y razones de diseño.' },
  { key: 'VERIFICATION', title: 'Plan y resultados de pruebas', why: 'Pruebas realizadas, hallazgos y validación.' },
  { key: 'DELIVERY', title: 'Plan de entrega y cambios', why: 'Qué se publicó, cuándo y cómo revertirlo.' },
  { key: 'OPERATIONS', title: 'Guía de operación', why: 'Despliegue, monitoreo e incidentes.' },
  { key: 'METRICS', title: 'Medición de resultados', why: 'Indicadores, fuentes y resultados observados.' },
];
const categoryLabel: Record<ProjectDocumentCategory, string> = {
  GENERAL: 'Sin clasificar', DIRECTION: 'Dirección', REQUIREMENTS: 'Requisitos',
  ARCHITECTURE: 'Arquitectura', VERIFICATION: 'Verificación', DELIVERY: 'Entrega',
  OPERATIONS: 'Operación', METRICS: 'Métricas',
};
const targetLabel: Record<ProjectEvidenceTargetType, string> = {
  PROJECT: 'Proyecto', OBJECTIVE: 'Objetivo', DELIVERABLE: 'Entregable',
  REQUIREMENT: 'Requisito', OUTCOME: 'Resultado medido', DECISION: 'Decisión',
};
const categoryOptions = Object.entries(categoryLabel).map(([value, label]) => ({ value, label }));
const filterOptions = [{ value: 'ALL', label: 'Todos los tipos' }, ...categoryOptions];
const claimMaxLength = 1000;
const excerptMaxLength = 2000;
const emptyDocumentation: ProjectDocumentation = { profiles: [], evidenceLinks: [] };

type MenuOption = { value: string; label: string };
type OptionMenuProps = {
  value: string;
  options: MenuOption[];
  onValueChange: (value: string) => void;
  className: string;
  ariaLabel: string;
  disabled?: boolean;
};

function OptionMenu({ value, options, onValueChange, className, ariaLabel, disabled = false }: OptionMenuProps) {
  const selected = options.find((option) => option.value === value) ?? options[0];
  if (!selected) return null;

  return <DropdownMenu.Root modal={false}>
    <DropdownMenu.Trigger asChild>
      <button type="button" className={className} aria-label={ariaLabel} disabled={disabled}>
        <span>{selected.label}</span><ChevronDown size={14} aria-hidden="true" />
      </button>
    </DropdownMenu.Trigger>
    <DropdownMenu.Portal>
      <DropdownMenu.Content className={styles.optionMenu} align="start" sideOffset={6} collisionPadding={12} style={{ minWidth: 'var(--radix-dropdown-menu-trigger-width)' }}>
        <DropdownMenu.RadioGroup value={value} onValueChange={onValueChange}>
          {options.map((option) => <DropdownMenu.RadioItem key={option.value} value={option.value} className={styles.optionItem}>
            <span>{option.label}</span>
            <DropdownMenu.ItemIndicator className={styles.optionCheck}><Check size={14} aria-hidden="true" /></DropdownMenu.ItemIndicator>
          </DropdownMenu.RadioItem>)}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  </DropdownMenu.Root>;
}

function CharacterLimit({ value, limit }: { value: string; limit: number }) {
  const showCount = value.length >= Math.ceil(limit * 0.8);
  const nearLimit = value.length >= Math.ceil(limit * 0.95);
  return <span className={`${styles.characterLimit} ${showCount ? styles.characterCountVisible : ''} ${nearLimit ? styles.characterLimitNear : ''}`}>
    {showCount ? `${value.length.toLocaleString('es-CL')} / ${limit.toLocaleString('es-CL')}` : `Máximo ${limit.toLocaleString('es-CL')} caracteres`}
  </span>;
}

function tiptapText(value: unknown): string {
  if (Array.isArray(value)) return value.map(tiptapText).filter(Boolean).join(' ');
  if (!value || typeof value !== 'object') return '';
  const node = value as { type?: unknown; text?: unknown; content?: unknown };
  if (node.type === 'text' && typeof node.text === 'string') return node.text;
  if (node.type === 'hardBreak') return ' ';
  return tiptapText(node.content);
}
function documentText(content: string) {
  const source = (content ?? '').trim();
  if (!source) return '';
  try {
    const parsed: unknown = JSON.parse(source);
    if (parsed && typeof parsed === 'object') return tiptapText(parsed).replace(/\s+/g, ' ').trim();
  } catch { /* Legacy HTML. */ }
  return source.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/\s+/g, ' ').trim();
}
function formatDate(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Fecha no disponible' : new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium' }).format(date);
}

export function ProjectDocumentsTab({ projectId, advancedTraceability, documents, canEdit, canLinkEvidence, onCreate, onCreateSuggested, onOpen }: Props) {
  const [documentation, setDocumentation] = useState<ProjectDocumentation>(emptyDocumentation);
  const [traceability, setTraceability] = useState<ProjectTraceabilityData | null>(null);
  const [decisions, setDecisions] = useState<ProjectDecision[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<ProjectDocumentCategory | 'ALL'>('ALL');
  const [linking, setLinking] = useState<Document | null>(null);
  const [targetValue, setTargetValue] = useState('PROJECT');
  const [claim, setClaim] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState('');
  const [confirmRemoveId, setConfirmRemoveId] = useState('');
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const [nextDocumentation, nextTraceability, nextDecisions] = await Promise.all([
        projectApi.getDocumentation(projectId),
        advancedTraceability ? projectApi.getTraceability(projectId) : Promise.resolve(null),
        advancedTraceability ? projectApi.getDecisions(projectId) : Promise.resolve([]),
      ]);
      setDocumentation(nextDocumentation); setTraceability(nextTraceability); setDecisions(nextDecisions);
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo cargar la documentación.'); }
    finally { setLoading(false); }
  }, [projectId, advancedTraceability]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    if (!linking) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = previous; returnFocusRef.current?.focus(); };
  }, [linking]);

  const profileByDocument = useMemo(() => new Map(documentation.profiles.map((item) => [item.documentId, item.category])), [documentation.profiles]);
  const evidenceByDocument = useMemo(() => {
    const grouped = new Map<string, ProjectEvidenceLink[]>();
    for (const link of documentation.evidenceLinks) if (link.documentId) grouped.set(link.documentId, [...(grouped.get(link.documentId) ?? []), link]);
    return grouped;
  }, [documentation.evidenceLinks]);
  const visibleDocuments = useMemo(() => documents.filter((doc) =>
    (filter === 'ALL' || (profileByDocument.get(doc.id) ?? 'GENERAL') === filter) &&
    `${doc.title} ${documentText(doc.content)}`.toLocaleLowerCase('es').includes(query.trim().toLocaleLowerCase('es'))
  ), [documents, profileByDocument, filter, query]);
  const targets = useMemo<Target[]>(() => {
    const result: Target[] = [{ value: 'PROJECT', type: 'PROJECT', id: null, label: 'Proyecto en general' }];
    if (traceability?.objective) result.push({ value: 'OBJECTIVE', type: 'OBJECTIVE', id: null, label: 'Objetivo actual' });
    for (const item of traceability?.deliverables ?? []) {
      result.push({ value: `DELIVERABLE:${item.id}`, type: 'DELIVERABLE', id: item.id, label: `Entregable: ${item.name}` });
      for (const requirement of item.requirements) result.push({ value: `REQUIREMENT:${requirement.id}`, type: 'REQUIREMENT', id: requirement.id, label: `Requisito: ${requirement.title}` });
    }
    for (const item of traceability?.outcomes ?? []) result.push({ value: `OUTCOME:${item.id}`, type: 'OUTCOME', id: item.id, label: `Resultado: ${item.metricName}` });
    for (const item of decisions.filter((decision) => decision.isCurrent)) result.push({ value: `DECISION:${item.id}`, type: 'DECISION', id: item.id, label: `Decisión: ${item.title}` });
    return result;
  }, [traceability, decisions]);
  const guideCount = guide.filter((category) => documents.some((doc) => profileByDocument.get(doc.id) === category.key)).length;

  async function changeCategory(documentId: string, category: ProjectDocumentCategory) {
    setUpdatingId(documentId); setError('');
    try {
      await projectApi.classifyDocument(projectId, documentId, category);
      setDocumentation((current) => ({ ...current, profiles: [...current.profiles.filter((item) => item.documentId !== documentId), { documentId, category }] }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo clasificar el documento.'); }
    finally { setUpdatingId(''); }
  }
  async function saveEvidence(event: FormEvent) {
    event.preventDefault();
    if (!linking || !claim.trim()) return;
    const target = targets.find((item) => item.value === targetValue) ?? targets[0];
    setSaving(true); setError('');
    try {
      const evidence = await projectApi.linkEvidence(projectId, {
        documentId: linking.id, targetType: target.type, targetId: target.id,
        claim: claim.trim(), excerpt: excerpt.trim() || null,
      });
      setDocumentation((current) => ({ ...current, evidenceLinks: [evidence, ...current.evidenceLinks] }));
      setNotice('Evidencia vinculada. Se conservó una versión del documento en este momento.');
      setLinking(null); setClaim(''); setExcerpt(''); setTargetValue('PROJECT');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo vincular la evidencia.'); }
    finally { setSaving(false); }
  }
  async function updateEvidence(link: ProjectEvidenceLink) {
    setUpdatingId(link.id); setError('');
    try {
      const updated = await projectApi.setEvidenceStatus(projectId, link.id, link.status === 'VERIFIED' ? 'PENDING' : 'VERIFIED');
      setDocumentation((current) => ({ ...current, evidenceLinks: current.evidenceLinks.map((item) => item.id === link.id ? updated : item) }));
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo actualizar la revisión.'); }
    finally { setUpdatingId(''); }
  }
  async function removeEvidence(link: ProjectEvidenceLink) {
    setUpdatingId(link.id); setError('');
    try {
      await projectApi.removeEvidence(projectId, link.id);
      setDocumentation((current) => ({ ...current, evidenceLinks: current.evidenceLinks.filter((item) => item.id !== link.id) }));
      setConfirmRemoveId('');
      setNotice('Vínculo quitado. El documento no se eliminó.');
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'No se pudo quitar el vínculo.'); }
    finally { setUpdatingId(''); }
  }

  return <div className={styles.root}>
    <header className={styles.header}>
      <div><span className={styles.eyebrow}><BookOpen size={13} /> DOCUMENTACIÓN DEL PROYECTO</span><h2>Documentos y evidencias</h2><p>Organiza lo que el equipo conoce y conecta los documentos que respaldan el trabajo.</p></div>
      {canEdit && <button type="button" className={styles.primaryButton} onClick={onCreate}><FilePlus2 size={16} /> Nuevo documento</button>}
    </header>
    {error && !linking && <div className={styles.error} role="alert">{error} <button type="button" onClick={() => { setError(''); void load(); }}>Reintentar</button></div>}
    {notice && <div className={styles.notice} role="status"><Check size={14} /> {notice}<button type="button" aria-label="Cerrar mensaje" onClick={() => setNotice('')}><X size={14} /></button></div>}
    <div className={styles.layout}>
      <section id="project-documents-library" className={styles.library} aria-label="Biblioteca de documentos">
        <div className={styles.sectionHeading}><h3>Biblioteca <span>{documents.length}</span></h3><p>Documentos colaborativos de este proyecto</p></div>
        <div className={styles.tools}>
          <label className={styles.search}><Search size={16} aria-hidden="true" /><span className={styles.srOnly}>Buscar documentos</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar documentos" /></label>
          <div className={styles.filter}>
            <OptionMenu value={filter} options={filterOptions} onValueChange={(value) => setFilter(value as ProjectDocumentCategory | 'ALL')} className={styles.filterTrigger} ariaLabel="Filtrar por tipo" />
          </div>
        </div>
        {loading ? <div className={styles.empty}><LoaderCircle className={styles.spinner} size={22} /><p>Cargando documentos…</p></div> : visibleDocuments.length === 0 ? (
          <div className={styles.empty}><FileText size={24} /><strong>{documents.length ? 'No hay documentos con ese filtro' : 'Tu biblioteca empieza aquí'}</strong><p>{documents.length ? 'Prueba otra búsqueda o categoría.' : 'Crea un documento para registrar y compartir el trabajo del proyecto.'}</p>{!documents.length && canEdit && <button type="button" onClick={onCreate}>Crear documento <ArrowRight size={14} /></button>}</div>
        ) : <div className={styles.documentList}>{visibleDocuments.map((doc) => {
          const category = profileByDocument.get(doc.id) ?? 'GENERAL';
          const links = evidenceByDocument.get(doc.id) ?? [];
          const preview = documentText(doc.content);
          return <article className={styles.documentRow} key={doc.id}>
            <div className={styles.documentMain}>
              <span className={styles.documentIcon}><FileText size={18} /></span>
              <div className={styles.documentCopy}>
                <button type="button" className={styles.documentTitle} onClick={() => onOpen(doc.id)}>{doc.title}<ArrowRight size={14} /></button>
                <p>{preview ? (preview.length > 125 ? `${preview.slice(0, 125)}…` : preview) : 'Todavía no tiene contenido'}</p>
                <div className={styles.documentMeta}><span>Actualizado {formatDate(doc.updatedAt)}</span>{links.length > 0 && <span className={styles.evidenceTag}><FileCheck2 size={12} /> {links.length} {links.length === 1 ? 'vínculo' : 'vínculos'}</span>}</div>
              </div>
            </div>
            <div className={styles.documentActions}>
              {canEdit ? <OptionMenu value={category} options={categoryOptions} onValueChange={(value) => void changeCategory(doc.id, value as ProjectDocumentCategory)} className={styles.categoryTrigger} ariaLabel={`Clasificación de ${doc.title}`} disabled={updatingId === doc.id} /> : <span className={styles.categoryLabel}>{categoryLabel[category]}</span>}
              {canLinkEvidence && <button type="button" className={styles.linkButton} onClick={(event) => { returnFocusRef.current = event.currentTarget; setLinking(doc); setTargetValue('PROJECT'); setClaim(''); setExcerpt(''); setError(''); }}><Link2 size={14} /> Vincular evidencia</button>}
            </div>
            {links.length > 0 && <div className={styles.evidenceList}>{links.map((link) => <div className={styles.evidenceItem} key={link.id}>
              <span className={link.status === 'VERIFIED' ? styles.verifiedDot : styles.pendingDot} aria-hidden="true" />
              <div><strong>{link.claim}</strong><small>{targetLabel[link.targetType]}{link.status === 'VERIFIED' ? ' · Revisada' : ' · Por revisar'}{link.currentDocumentUpdatedAt && new Date(link.currentDocumentUpdatedAt).getTime() > new Date(link.documentUpdatedAt).getTime() ? ' · Documento editado después del vínculo' : ''}</small><details className={styles.snapshot}><summary>Ver contenido conservado · {formatDate(link.createdAt)}</summary><pre>{link.snapshotText || 'Este documento no tenía texto visible al vincularse.'}</pre></details>{confirmRemoveId === link.id && <div className={styles.removeConfirm}><span>¿Quitar este vínculo y su versión guardada?</span><button type="button" onClick={() => setConfirmRemoveId('')}>Cancelar</button><button type="button" disabled={updatingId === link.id} onClick={() => void removeEvidence(link)}>Quitar</button></div>}</div>
              {canLinkEvidence && <div className={styles.evidenceActions}><button type="button" disabled={updatingId === link.id} onClick={() => void updateEvidence(link)} title={link.status === 'VERIFIED' ? 'Marcar por revisar' : 'Marcar revisada'}>{link.status === 'VERIFIED' ? <CheckCheck size={14} /> : <Check size={14} />}<span className={styles.srOnly}>{link.status === 'VERIFIED' ? 'Marcar por revisar' : 'Marcar revisada'}</span></button><button type="button" disabled={updatingId === link.id} onClick={() => setConfirmRemoveId(confirmRemoveId === link.id ? '' : link.id)} title="Quitar vínculo"><X size={14} /><span className={styles.srOnly}>Quitar vínculo</span></button></div>}
            </div>)}</div>}
          </article>;
        })}</div>}
      </section>
      <aside className={styles.guide} aria-labelledby="software-guide-heading">
        <div className={styles.guideHead}><span className={styles.guideIcon}><Sparkles size={17} /></span><span className={styles.guideBadge}>GUÍA OPCIONAL</span><h3 id="software-guide-heading">Documentos para software</h3><p>Una referencia para orientar el seguimiento. Usa solo lo que aporte valor a este proyecto.</p></div>
        <div className={styles.guideProgress}><span>{guideCount === 0 ? 'Empieza por el documento que te resulte útil' : `${guideCount} ${guideCount === 1 ? 'área documentada' : 'áreas documentadas'} en este proyecto`}</span></div>
        <ol className={styles.guideList}>{guide.map((item, index) => {
          const matching = documents.filter((doc) => profileByDocument.get(doc.id) === item.key);
          return <li key={item.key} className={matching.length ? styles.guideDone : ''}><span className={styles.guideNumber}>{matching.length ? <Check size={14} /> : String(index + 1).padStart(2, '0')}</span><div><strong>{item.title}</strong><p>{item.why}</p>{matching.length > 0 ? <button type="button" onClick={() => { setFilter(item.key); setQuery(''); document.getElementById('project-documents-library')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{matching.length} {matching.length === 1 ? 'documento' : 'documentos'} <ArrowRight size={12} /></button> : canEdit ? <button type="button" onClick={() => onCreateSuggested(item.key, item.title)}>Crear documento <ArrowRight size={12} /></button> : null}</div></li>;
        })}</ol>
        <p className={styles.guideFoot}><ShieldCheck size={15} /> Estas sugerencias no bloquean el avance ni modifican el estado del proyecto.</p>
      </aside>
    </div>
    {linking && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !saving) setLinking(null); }}><div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="link-evidence-title" className={styles.dialog} onKeyDown={(event) => {
      const menuOpen = document.querySelector('[data-radix-popper-content-wrapper]');
      if (event.key === 'Escape' && !menuOpen && !saving) setLinking(null);
      if (event.key !== 'Tab' || menuOpen) return;
      const focusables = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), select:not([disabled]), textarea:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? []);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === dialogRef.current)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }}>
      <div className={styles.dialogHeader}><span className={styles.dialogIcon}><FileCheck2 size={20} /></span><div><span className={styles.eyebrow}>DOCUMENTO COMO EVIDENCIA</span><h3 id="link-evidence-title">Vincular «{linking.title}»</h3></div><button type="button" aria-label="Cerrar" onClick={() => setLinking(null)} disabled={saving}><X size={18} /></button></div>
      <form onSubmit={(event) => void saveEvidence(event)}>
        <div className={styles.dialogBody}>
          <p className={styles.dialogIntro}>Indica qué respalda este documento. Al vincularlo se conserva una versión de su contenido; podrás seguir editando el documento.</p>
          <label className={styles.dialogField}>
            <span className={styles.fieldLabel}>Elemento que respalda</span>
            <OptionMenu value={targetValue} options={targets.map(({ value, label }) => ({ value, label }))} onValueChange={setTargetValue} className={styles.dialogSelect} ariaLabel="Elemento que respalda" />
          </label>
          <label className={styles.dialogField}>
            <span className={styles.fieldLabel}>¿Qué demuestra este documento?</span>
            <textarea autoFocus value={claim} onChange={(event) => setClaim(event.target.value)} required maxLength={claimMaxLength} rows={3} aria-describedby="evidence-claim-limit" placeholder="Ej. La prueba de aceptación confirma el requisito de acceso." />
            <span className={styles.fieldHint} id="evidence-claim-limit"><span>Describe qué parte del elemento queda respaldada.</span><CharacterLimit value={claim} limit={claimMaxLength} /></span>
          </label>
          <label className={styles.dialogField}>
            <span className={styles.fieldLabel}>Referencia o fragmento <small>Opcional</small></span>
            <textarea value={excerpt} onChange={(event) => setExcerpt(event.target.value)} maxLength={excerptMaxLength} rows={2} aria-describedby="evidence-excerpt-limit" placeholder="Sección, página o fragmento que facilita la revisión" />
            <span className={styles.fieldHint} id="evidence-excerpt-limit"><span>Ubica la evidencia dentro del documento.</span><CharacterLimit value={excerpt} limit={excerptMaxLength} /></span>
          </label>
          {error && <p className={styles.dialogError} role="alert">{error}</p>}
        </div>
        <div className={styles.dialogFooter}><button type="button" onClick={() => setLinking(null)} disabled={saving}>Cancelar</button><button type="submit" disabled={saving || !claim.trim()}>{saving ? <LoaderCircle size={16} className={styles.spinner} /> : <Link2 size={16} />} Vincular evidencia</button></div>
      </form>
    </div></div>, document.body)}
  </div>;
}
