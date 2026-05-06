'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useT } from '@/lib/i18n';
import {
  useAiPlannerStore,
  type AiWorkspacePlan,
  type AiProject,
  type AiBoard,
  type AiList,
  type AiCard,
} from '@/stores/aiPlannerStore';
import { Sparkles, ChevronDown, ChevronRight, Plus, X, AlertTriangle, CheckCircle2, Loader2, FileText, Save, Trash2 } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { useAuthStore } from '@/stores/authStore';
import { C } from '@/lib/colors';

// ── Color tokens ─────────────────────────────────────────────────────────────

// ── Inline editable field ─────────────────────────────────────────────────────
function EditableField({
  value,
  onChange,
  placeholder,
  multiline = false,
  style,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  style?: React.CSSProperties;
}) {
  const [editing, setEditing] = useState(false);
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (editing) ref.current?.focus();
  }, [editing]);

  const baseStyle: React.CSSProperties = {
    background: editing ? C.surface : 'transparent',
    border: editing ? `1px solid ${C.border2}` : '1px solid transparent',
    borderRadius: '4px',
    color: C.text,
    padding: '2px 6px',
    width: '100%',
    outline: 'none',
    fontFamily: 'inherit',
    fontSize: 'inherit',
    resize: 'none',
    ...style,
  };

  if (multiline) {
    return (
      <textarea
        ref={ref as React.Ref<HTMLTextAreaElement>}
        value={value}
        placeholder={placeholder}
        rows={2}
        style={baseStyle}
        onFocus={() => setEditing(true)}
        onBlur={() => setEditing(false)}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <input
      ref={ref as React.Ref<HTMLInputElement>}
      value={value}
      placeholder={placeholder}
      style={baseStyle}
      onFocus={() => setEditing(true)}
      onBlur={() => setEditing(false)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

// ── Priority badge ────────────────────────────────────────────────────────────
function PrioritySelect({ value, onChange }: { value?: string; onChange: (v: 'LOW' | 'MEDIUM' | 'HIGH') => void }) {
  const colors: Record<string, string> = { LOW: C.green, MEDIUM: C.amber, HIGH: C.red };
  const col = colors[value ?? 'LOW'];
  return (
    <select
      value={value ?? 'LOW'}
      onChange={(e) => onChange(e.target.value as any)}
      style={{
        background: col + '22',
        border: `1px solid ${col}44`,
        color: col,
        borderRadius: '4px',
        fontSize: '10px',
        padding: '1px 4px',
        outline: 'none',
        cursor: 'pointer',
      }}
    >
      <option value="LOW">LOW</option>
      <option value="MEDIUM">MED</option>
      <option value="HIGH">HIGH</option>
    </select>
  );
}

// ── Card row ──────────────────────────────────────────────────────────────────
function CardRow({
  card,
  onUpdate,
  onRemove,
}: {
  card: AiCard;
  onUpdate: (c: AiCard) => void;
  onRemove: () => void;
}) {
  return (
    <div
      className="flex items-start gap-2 py-1.5 px-2 rounded-[5px] group"
      style={{ border: `1px solid ${C.border}`, marginBottom: '4px', background: C.bg2 }}
    >
      <div className="flex-1 min-w-0">
        <EditableField
          value={card.title}
          onChange={(v) => onUpdate({ ...card, title: v })}
          placeholder="Card title"
          style={{ fontSize: '12px', fontWeight: 500 }}
        />
        <EditableField
          value={card.description ?? ''}
          onChange={(v) => onUpdate({ ...card, description: v })}
          placeholder="Description (optional)"
          multiline
          style={{ fontSize: '11px', color: C.text3, marginTop: '2px' }}
        />
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0 pt-1">
        <PrioritySelect value={card.priority} onChange={(v) => onUpdate({ ...card, priority: v })} />
        <button
          onClick={onRemove}
          className="opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ color: C.text3 }}
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}

// ── List section ──────────────────────────────────────────────────────────────
function ListSection({
  list,
  onUpdate,
  onRemove,
  t,
}: {
  list: AiList;
  onUpdate: (l: AiList) => void;
  onRemove: () => void;
  t: any;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const addCard = () => {
    onUpdate({ ...list, cards: [...list.cards, { title: 'New card', priority: 'MEDIUM' }] });
  };

  return (
    <div className="mb-3" style={{ borderLeft: `2px solid ${C.border2}`, paddingLeft: '12px' }}>
      <div className="flex items-center gap-1.5 mb-2">
        <button onClick={() => setCollapsed(!collapsed)} style={{ color: C.text3 }}>
          {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        </button>
        <EditableField
          value={list.name}
          onChange={(v) => onUpdate({ ...list, name: v })}
          style={{ fontSize: '11px', fontWeight: 600, color: C.text2 }}
        />
        <span style={{ fontSize: '10px', color: C.text4 }}>({list.cards.length})</span>
        <button onClick={onRemove} style={{ color: C.text4, marginLeft: 'auto' }}>
          <X size={10} />
        </button>
      </div>

      {!collapsed && (
        <>
          {list.cards.map((card, ci) => (
            <CardRow
              key={ci}
              card={card}
              onUpdate={(updated) => {
                const cards = [...list.cards];
                cards[ci] = updated;
                onUpdate({ ...list, cards });
              }}
              onRemove={() => {
                const cards = list.cards.filter((_, i) => i !== ci);
                onUpdate({ ...list, cards });
              }}
            />
          ))}
          <button
            onClick={addCard}
            className="flex items-center gap-1 text-[11px] mt-1"
            style={{ color: C.text4 }}
          >
            <Plus size={11} /> {t.ai_builder_add_card}
          </button>
        </>
      )}
    </div>
  );
}

// ── Board section ─────────────────────────────────────────────────────────────
function BoardSection({
  board,
  onUpdate,
  onRemove,
  t,
}: {
  board: AiBoard;
  onUpdate: (b: AiBoard) => void;
  onRemove: () => void;
  t: any;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const addList = () => {
    onUpdate({ ...board, lists: [...board.lists, { name: 'New list', cards: [] }] });
  };

  return (
    <div
      className="mb-4 p-3 rounded-[8px]"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-center gap-2 mb-3">
        <button onClick={() => setCollapsed(!collapsed)} style={{ color: C.text3 }}>
          {collapsed ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
        </button>
        <div className="flex-1 min-w-0">
          <EditableField
            value={board.name}
            onChange={(v) => onUpdate({ ...board, name: v })}
            style={{ fontSize: '12px', fontWeight: 600, color: C.text }}
          />
          <EditableField
            value={board.description}
            onChange={(v) => onUpdate({ ...board, description: v })}
            placeholder="Board description"
            style={{ fontSize: '11px', color: C.text3 }}
          />
        </div>
        <button
          onClick={onRemove}
          className="flex-shrink-0"
          style={{ color: C.text4, padding: '2px' }}
          title={t.ai_builder_remove}
        >
          <X size={13} />
        </button>
      </div>

      {!collapsed && (
        <>
          {board.lists.map((list, li) => (
            <ListSection
              key={li}
              list={list}
              t={t}
              onUpdate={(updated) => {
                const lists = [...board.lists];
                lists[li] = updated;
                onUpdate({ ...board, lists });
              }}
              onRemove={() => {
                onUpdate({ ...board, lists: board.lists.filter((_, i) => i !== li) });
              }}
            />
          ))}
          <button
            onClick={addList}
            className="flex items-center gap-1 text-[11px] mt-1"
            style={{ color: C.accent }}
          >
            <Plus size={12} /> {t.ai_builder_add_list}
          </button>
        </>
      )}
    </div>
  );
}

// ── Project section ───────────────────────────────────────────────────────────
function ProjectSection({
  project,
  onUpdate,
  onRemove,
  t,
}: {
  project: AiProject;
  onUpdate: (p: AiProject) => void;
  onRemove: () => void;
  t: any;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const addBoard = () => {
    onUpdate({
      ...project,
      boards: [
        ...project.boards,
        { name: 'New board', description: '', lists: [{ name: 'To Do', cards: [] }] },
      ],
    });
  };

  return (
    <div
      className="mb-6 p-4 rounded-[10px]"
      style={{ background: C.bg2, border: `1px solid ${C.border2}` }}
    >
      <div className="flex items-start gap-2 mb-3">
        <button onClick={() => setCollapsed(!collapsed)} style={{ color: C.text3, marginTop: '4px' }}>
          {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
        </button>
        <div className="flex-1 min-w-0">
          <EditableField
            value={project.name}
            onChange={(v) => onUpdate({ ...project, name: v })}
            style={{ fontSize: '13px', fontWeight: 700, color: C.text }}
          />
          <EditableField
            value={project.description}
            onChange={(v) => onUpdate({ ...project, description: v })}
            placeholder="Project description"
            multiline
            style={{ fontSize: '12px', color: C.text2, marginTop: '2px' }}
          />
        </div>
        <button onClick={onRemove} style={{ color: C.text4, flexShrink: 0, marginTop: '4px' }}>
          <X size={14} />
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Milestones summary */}
          {project.milestones.length > 0 && (
            <div className="mb-3">
              <p className="text-[10px] font-semibold mb-1.5 uppercase tracking-wider" style={{ color: C.text4 }}>
                Milestones ({project.milestones.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {project.milestones.map((m, mi) => (
                  <span
                    key={mi}
                    className="text-[11px] px-2 py-0.5 rounded-full"
                    style={{ background: C.accent + '18', color: C.accent, border: `1px solid ${C.accent}33` }}
                  >
                    {m.name}
                    {m.dueDate && <span style={{ color: C.text3 }}> · {m.dueDate}</span>}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Boards */}
          <p className="text-[10px] font-semibold mb-2 uppercase tracking-wider" style={{ color: C.text4 }}>
            {t.ai_builder_boards_section}
          </p>
          {project.boards.map((board, bi) => (
            <BoardSection
              key={bi}
              board={board}
              t={t}
              onUpdate={(updated) => {
                const boards = [...project.boards];
                boards[bi] = updated;
                onUpdate({ ...project, boards });
              }}
              onRemove={() => {
                onUpdate({ ...project, boards: project.boards.filter((_, i) => i !== bi) });
              }}
            />
          ))}
          <button
            onClick={addBoard}
            className="flex items-center gap-1.5 text-[12px]"
            style={{ color: C.accent }}
          >
            <Plus size={13} /> {t.ai_builder_add_board}
          </button>
        </>
      )}
    </div>
  );
}

// ── Step 1: Document input ────────────────────────────────────────────────────
type PlanDoc = { id: string; title: string; updated_at: string };

// ── Guided form types ─────────────────────────────────────────────────────────
interface ProjectForm {
  intro: string;
  problem: string;
  solution: string;
  scopeIn: string;
  scopeOut: string;
  goalGeneral: string;
  goalsSpecific: string[];
  team: Array<{ name: string; role: string; responsibilities: string }>;
  startDate: string;
  launchDate: string;
  milestones: Array<{ name: string; date: string }>;
  stack: { backend: string; frontend: string; database: string; devops: string; apis: string };
  functionalReqs: Array<{ module: string; description: string }>;
  nonFunctional: { performance: string; security: string; scalability: string; compliance: string };
  kpis: Array<{ indicator: string; target: string; frequency: string }>;
  risks: Array<{ risk: string; mitigation: string }>;
}

const EMPTY_FORM: ProjectForm = {
  intro: '', problem: '', solution: '', scopeIn: '', scopeOut: '',
  goalGeneral: '', goalsSpecific: ['', '', ''],
  team: [{ name: '', role: '', responsibilities: '' }],
  startDate: '', launchDate: '',
  milestones: [{ name: '', date: '' }, { name: '', date: '' }, { name: '', date: '' }],
  stack: { backend: '', frontend: '', database: '', devops: '', apis: '' },
  functionalReqs: [{ module: '', description: '' }, { module: '', description: '' }, { module: '', description: '' }],
  nonFunctional: { performance: '', security: '', scalability: '', compliance: '' },
  kpis: [{ indicator: '', target: '', frequency: '' }],
  risks: [{ risk: '', mitigation: '' }],
};

function serializeProjectForm(f: ProjectForm): string {
  const out: string[] = [];
  const push = (...lines: string[]) => lines.forEach(l => out.push(l));

  push('# Constructor IA — Plan de Proyecto', '');

  push('## 1. Introducción');
  push(f.intro.trim() || '(no proporcionado)', '');

  push('## 2. Descripción del Problema');
  push(f.problem.trim() || '(no proporcionado)', '');

  push('## 3. Formulación de la Solución');
  push(f.solution.trim() || '(no proporcionado)', '');

  push('## 4. Alcance y Restricciones');
  push('**Incluido en esta versión:**');
  const inc = f.scopeIn.split('\n').map(l => l.trim()).filter(Boolean);
  inc.length ? inc.forEach(l => push(`- ${l}`)) : push('- (no especificado)');
  push('');
  push('**Excluido (versiones futuras):**');
  const exc = f.scopeOut.split('\n').map(l => l.trim()).filter(Boolean);
  exc.length ? exc.forEach(l => push(`- ${l}`)) : push('- (no especificado)');
  push('');

  push('## 5. Objetivos');
  push(`**Objetivo general:** ${f.goalGeneral.trim() || '(no definido)'}`, '', '**Objetivos específicos:**');
  const specs = f.goalsSpecific.filter(g => g.trim());
  specs.length ? specs.forEach((g, i) => push(`${i + 1}. ${g.trim()}`)) : push('1. (no definido)');
  push('');

  push('## 6. Equipo de Trabajo y Roles');
  push('| Nombre | Rol | Responsabilidades |', '|--------|-----|-------------------|');
  const validTeam = f.team.filter(m => m.name.trim() || m.role.trim());
  validTeam.length ? validTeam.forEach(m => push(`| ${m.name} | ${m.role} | ${m.responsibilities} |`)) : push('| (no definido) | | |');
  push('');

  push('## 7. Cronograma e Hitos');
  push(
    `- **Fecha de inicio del proyecto:** ${f.startDate || '(no definida)'}`,
    `- **Fecha objetivo de lanzamiento:** ${f.launchDate || '(no definida)'}`,
    '', '**Hitos clave:**'
  );
  const validMs = f.milestones.filter(m => m.name.trim());
  validMs.length ? validMs.forEach((m, i) => push(`${i + 1}. ${m.name.trim()}${m.date ? ` — ${m.date}` : ''}`)) : push('1. (no definido)');
  push('');

  push('## 8. Stack Tecnológico');
  push(
    `- **Backend:** ${f.stack.backend || '(no especificado)'}`,
    `- **Frontend:** ${f.stack.frontend || '(no especificado)'}`,
    `- **Base de datos:** ${f.stack.database || '(no especificado)'}`,
    `- **Infraestructura / DevOps:** ${f.stack.devops || '(no especificado)'}`,
    `- **APIs externas / Integraciones:** ${f.stack.apis || '(no especificado)'}`,
    ''
  );

  push('## 9. Requerimientos Funcionales');
  const validReqs = f.functionalReqs.filter(r => r.module.trim());
  validReqs.length ? validReqs.forEach((r, i) => push(`${i + 1}. **${r.module.trim()}:** ${r.description.trim()}`)) : push('1. (no definido)');
  push('');

  push('## 10. Requerimientos No Funcionales');
  push(
    `- **Rendimiento:** ${f.nonFunctional.performance || '(no especificado)'}`,
    `- **Seguridad:** ${f.nonFunctional.security || '(no especificado)'}`,
    `- **Escalabilidad:** ${f.nonFunctional.scalability || '(no especificado)'}`,
    `- **Cumplimiento / Legal:** ${f.nonFunctional.compliance || '(no especificado)'}`,
    ''
  );

  push('## 11. KPIs e Indicadores de Gestión');
  push('| Indicador | Meta | Frecuencia |', '|-----------|------|------------|');
  const validKpis = f.kpis.filter(k => k.indicator.trim());
  validKpis.length ? validKpis.forEach(k => push(`| ${k.indicator} | ${k.target} | ${k.frequency} |`)) : push('| (no definido) | | |');
  push('');

  push('## 12. Riesgos Identificados');
  push('| Riesgo | Mitigación |', '|--------|-----------|');
  const validRisks = f.risks.filter(r => r.risk.trim());
  validRisks.length ? validRisks.forEach(r => push(`| ${r.risk} | ${r.mitigation} |`)) : push('| (no definido) | |');

  return out.join('\n');
}

const FORM_SECTIONS = [
  { title: 'Introducción', hint: 'Contexto general: ¿qué motivó el proyecto, para quién es, qué vacío aborda?' },
  { title: 'Descripción del Problema', hint: '¿Qué problema concreto resuelve? ¿Qué consecuencias tiene no resolverlo?' },
  { title: 'Formulación de la Solución', hint: '¿Qué estás construyendo exactamente? Describe los módulos o componentes principales.' },
  { title: 'Alcance y Restricciones', hint: 'Qué está incluido en esta versión y qué queda para versiones futuras.' },
  { title: 'Objetivos', hint: 'Objetivo general y objetivos específicos medibles.' },
  { title: 'Equipo de Trabajo y Roles', hint: 'Lista cada persona, su rol y responsabilidades. Ayuda a la IA a asignar boards por área.' },
  { title: 'Cronograma e Hitos', hint: 'Fechas de inicio, lanzamiento y hitos clave del proyecto.' },
  { title: 'Stack Tecnológico', hint: 'Tecnologías que guían qué boards crea la IA (Backend, Frontend, DevOps, etc.).' },
  { title: 'Requerimientos Funcionales', hint: 'Funcionalidades y módulos principales. Se convierten en cards concretas.' },
  { title: 'Requerimientos No Funcionales', hint: 'Rendimiento, seguridad, escalabilidad, cumplimiento. Se convierten en cards de QA y DevOps.' },
  { title: 'KPIs e Indicadores', hint: '¿Cómo medirás el éxito? Indicador, meta y frecuencia de medición.' },
  { title: 'Riesgos Identificados', hint: 'Riesgos y estrategias de mitigación. Pueden convertirse en cards de dependencia.' },
];

function Step1({
  credits,
  onGenerate,
  isGenerating,
  error,
  t,
}: {
  credits: number;
  onGenerate: (text: string) => void;
  isGenerating: boolean;
  error: string | null;
  t: any;
}) {
  const { uiLanguage } = useAuthStore();
  const noCredits = credits === 0;

  // Mode toggle
  const [mode, setMode] = useState<'form' | 'text'>('form');

  // ── Form mode state ──────────────────────────────────────────────
  const [form, setForm] = useState<ProjectForm>(EMPTY_FORM);
  const [openSections, setOpenSections] = useState<boolean[]>(
    Array(12).fill(false).map((_, i) => i === 0)
  );
  const toggleSection = (i: number) =>
    setOpenSections(prev => prev.map((v, j) => (j === i ? !v : v)));

  const sectionFilled = [
    form.intro.trim().length > 0,
    form.problem.trim().length > 0,
    form.solution.trim().length > 0,
    form.scopeIn.trim().length > 0 || form.scopeOut.trim().length > 0,
    form.goalGeneral.trim().length > 0 || form.goalsSpecific.some(g => g.trim()),
    form.team.some(m => m.name.trim() || m.role.trim()),
    !!(form.startDate || form.launchDate || form.milestones.some(m => m.name.trim())),
    Object.values(form.stack).some(v => v.trim()),
    form.functionalReqs.some(r => r.module.trim()),
    Object.values(form.nonFunctional).some(v => v.trim()),
    form.kpis.some(k => k.indicator.trim()),
    form.risks.some(r => r.risk.trim()),
  ];
  const filledCount = sectionFilled.filter(Boolean).length;
  const canGenerateForm =
    !isGenerating && !noCredits && form.intro.trim().length > 0 && form.solution.trim().length > 0;

  // ── Text mode state ──────────────────────────────────────────────
  const [text, setText] = useState('');
  const charCount = text.length;
  const tooLong = charCount > 50_000;
  const tooShort = charCount < 10;
  const canGenerateText = !isGenerating && !tooShort && !tooLong && !noCredits;

  // Planning documents (text mode)
  const [plans, setPlans] = useState<PlanDoc[]>([]);
  const [plansLoaded, setPlansLoaded] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [editingPlan, setEditingPlan] = useState<{ id: string; title: string; content: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<'ok' | 'err' | null>(null);
  const [creatingPlan, setCreatingPlan] = useState(false);
  const [planMsg, setPlanMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadPlans = async () => {
    const res = await apiService.get<{ documents: PlanDoc[] }>('/api/ai/documents', true);
    if (res.success && res.data) setPlans(res.data.documents);
    setPlansLoaded(true);
  };
  const handleTogglePlans = () => {
    const next = !showPlans;
    setShowPlans(next);
    if (next && !plansLoaded) loadPlans();
  };
  const handleNewPlan = async () => {
    setCreatingPlan(true);
    setPlanMsg(null);
    const lang = uiLanguage ?? 'en';
    const res = await apiService.post<{ document: PlanDoc & { content: string } }>(
      '/api/ai/documents', { templateId: 'ai-builder', lang }, true
    );
    setCreatingPlan(false);
    if (res.success && res.data?.document) {
      const doc = res.data.document;
      setPlans(p => [doc, ...p]);
      setEditingPlan({ id: doc.id, title: doc.title, content: doc.content });
      setSelectedPlanId(doc.id);
    } else {
      setPlanMsg({ type: 'err', text: t.ai_builder_plan_error });
    }
  };
  const handleSelectPlan = async (id: string) => {
    setSelectedPlanId(id);
    setPlanMsg(null);
    if (!id) { setEditingPlan(null); return; }
    const res = await apiService.get<{ document: PlanDoc & { content: string } }>(`/api/ai/documents/${id}`, true);
    if (res.success && res.data?.document) {
      const d = res.data.document;
      setEditingPlan({ id: d.id, title: d.title, content: d.content });
    } else {
      setPlanMsg({ type: 'err', text: t.ai_builder_plan_error });
    }
  };
  const handleSavePlan = async () => {
    if (!editingPlan) return;
    setSaving(true);
    setSaveMsg(null);
    const res = await apiService.put(`/api/ai/documents/${editingPlan.id}`, { title: editingPlan.title, content: editingPlan.content }, true);
    setSaving(false);
    setSaveMsg(res.success ? 'ok' : 'err');
    if (res.success) {
      setPlans(p => p.map(d => d.id === editingPlan.id ? { ...d, title: editingPlan.title } : d));
      setTimeout(() => setSaveMsg(null), 2000);
    }
  };
  const handleDeletePlan = async (id: string) => {
    await apiService.delete(`/api/ai/documents/${id}`, true);
    setPlans(p => p.filter(d => d.id !== id));
    if (selectedPlanId === id) { setSelectedPlanId(''); setEditingPlan(null); }
  };
  const handleLoadPlan = () => {
    if (!editingPlan?.content) return;
    setText(editingPlan.content);
    setPlanMsg({ type: 'ok', text: t.ai_builder_plan_loaded });
    apiService.patch(`/api/ai/documents/${editingPlan.id}/used`, {}, true);
  };

  // ── Shared input styles ──────────────────────────────────────────
  const inp: React.CSSProperties = {
    background: C.bg2, border: `1px solid ${C.border2}`, borderRadius: '5px',
    color: C.text, padding: '7px 10px', fontSize: '12px', outline: 'none', width: '100%',
  };
  const ta: React.CSSProperties = {
    ...inp, resize: 'vertical' as const, fontFamily: 'inherit', lineHeight: '1.6',
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Credits indicator */}
      <div
        className="flex items-center justify-between mb-5 px-4 py-3 rounded-[8px]"
        style={{ background: C.surface, border: `1px solid ${noCredits ? C.red + '55' : C.border}` }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: noCredits ? C.red : C.accent }} />
          <span className="text-[13px]" style={{ color: noCredits ? C.red : C.text2 }}>
            {noCredits ? t.ai_builder_error_no_credits : t.ai_builder_credits_remaining(credits)}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: C.text4 }}>{t.ai_builder_trial_notice}</span>
      </div>

      {/* Mode tabs */}
      <div
        className="flex mb-5 rounded-[8px] overflow-hidden"
        style={{ border: `1px solid ${C.border}`, background: C.surface }}
      >
        <button
          onClick={() => setMode('form')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-medium transition-all"
          style={{ background: mode === 'form' ? C.accent : 'transparent', color: mode === 'form' ? '#fff' : C.text3 }}
        >
          <FileText size={13} />
          Formulario guiado
        </button>
        <button
          onClick={() => setMode('text')}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 text-[12px] font-medium transition-all"
          style={{ background: mode === 'text' ? C.accent : 'transparent', color: mode === 'text' ? '#fff' : C.text3 }}
        >
          <ChevronRight size={13} />
          Texto libre
        </button>
      </div>

      {/* ══ FORM MODE ══════════════════════════════════════════════════════════ */}
      {mode === 'form' && (
        <>
          {/* Progress */}
          <div className="flex items-center gap-3 mb-5">
            <div className="flex-1 rounded-full overflow-hidden" style={{ height: '4px', background: C.border }}>
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{ width: `${(filledCount / 12) * 100}%`, background: filledCount >= 6 ? C.green : C.accent }}
              />
            </div>
            <span className="text-[11px] flex-shrink-0" style={{ color: C.text4 }}>
              {filledCount} / 12 secciones
            </span>
          </div>

          {/* Sections */}
          {FORM_SECTIONS.map((sec, i) => (
            <div
              key={i}
              className="mb-3 rounded-[8px] overflow-hidden"
              style={{ border: `1px solid ${openSections[i] ? C.accent + '55' : C.border}` }}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(i)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left"
                style={{ background: openSections[i] ? C.accent + '08' : C.surface }}
              >
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{
                    background: sectionFilled[i] ? C.green : C.surface,
                    border: `1px solid ${sectionFilled[i] ? C.green : C.border2}`,
                    color: sectionFilled[i] ? '#fff' : C.text4,
                  }}
                >
                  {sectionFilled[i] ? '✓' : i + 1}
                </div>
                <span className="text-[13px] font-medium flex-1" style={{ color: C.text }}>{sec.title}</span>
                {openSections[i]
                  ? <ChevronDown size={13} style={{ color: C.text4 }} />
                  : <ChevronRight size={13} style={{ color: C.text4 }} />}
              </button>

              {/* Section body */}
              {openSections[i] && (
                <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
                  <p className="text-[11px] mb-3 italic" style={{ color: C.text4 }}>{sec.hint}</p>

                  {/* 1 — Introducción */}
                  {i === 0 && (
                    <textarea value={form.intro} onChange={e => setForm(f => ({ ...f, intro: e.target.value }))}
                      rows={4} placeholder="Describe el contexto general del proyecto..." style={ta} />
                  )}

                  {/* 2 — Problema */}
                  {i === 1 && (
                    <textarea value={form.problem} onChange={e => setForm(f => ({ ...f, problem: e.target.value }))}
                      rows={4} placeholder="¿Qué problema concreto resuelve este proyecto?..." style={ta} />
                  )}

                  {/* 3 — Solución */}
                  {i === 2 && (
                    <textarea value={form.solution} onChange={e => setForm(f => ({ ...f, solution: e.target.value }))}
                      rows={5} placeholder="¿Qué estás construyendo exactamente? Describe los módulos principales..." style={ta} />
                  )}

                  {/* 4 — Alcance */}
                  {i === 3 && (
                    <>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: C.text3 }}>Incluido en esta versión</p>
                      <textarea value={form.scopeIn} onChange={e => setForm(f => ({ ...f, scopeIn: e.target.value }))}
                        rows={3} placeholder={"Un ítem por línea\n- Autenticación de usuarios\n- Dashboard principal"} style={{ ...ta, marginBottom: '12px' }} />
                      <p className="text-[11px] font-semibold mb-1" style={{ color: C.text3 }}>Excluido (versiones futuras)</p>
                      <textarea value={form.scopeOut} onChange={e => setForm(f => ({ ...f, scopeOut: e.target.value }))}
                        rows={3} placeholder={"Un ítem por línea\n- App móvil\n- Integración con ERP"} style={ta} />
                    </>
                  )}

                  {/* 5 — Objetivos */}
                  {i === 4 && (
                    <>
                      <p className="text-[11px] font-semibold mb-1" style={{ color: C.text3 }}>Objetivo general</p>
                      <input value={form.goalGeneral} onChange={e => setForm(f => ({ ...f, goalGeneral: e.target.value }))}
                        placeholder="Una oración que describe la meta global del proyecto" style={{ ...inp, marginBottom: '12px' }} />
                      <p className="text-[11px] font-semibold mb-2" style={{ color: C.text3 }}>Objetivos específicos</p>
                      {form.goalsSpecific.map((g, gi) => (
                        <div key={gi} className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] w-4 text-right flex-shrink-0" style={{ color: C.text4 }}>{gi + 1}.</span>
                          <input value={g} onChange={e => setForm(f => {
                            const gs = [...f.goalsSpecific]; gs[gi] = e.target.value; return { ...f, goalsSpecific: gs };
                          })} placeholder={`Objetivo ${gi + 1} (medible y concreto)`} style={inp} />
                          {form.goalsSpecific.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, goalsSpecific: f.goalsSpecific.filter((_, j) => j !== gi) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, goalsSpecific: [...f.goalsSpecific, ''] }))}
                        className="flex items-center gap-1 text-[11px] mt-1" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar objetivo
                      </button>
                    </>
                  )}

                  {/* 6 — Equipo */}
                  {i === 5 && (
                    <>
                      <div className="flex gap-2 mb-1">
                        <span className="text-[10px] font-semibold flex-1" style={{ color: C.text4 }}>NOMBRE</span>
                        <span className="text-[10px] font-semibold flex-1" style={{ color: C.text4 }}>ROL</span>
                        <span className="text-[10px] font-semibold flex-[2]" style={{ color: C.text4 }}>RESPONSABILIDADES</span>
                        <div style={{ width: '20px' }} />
                      </div>
                      {form.team.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2 mb-2">
                          <input value={m.name} onChange={e => setForm(f => { const t = [...f.team]; t[mi] = { ...t[mi], name: e.target.value }; return { ...f, team: t }; })}
                            placeholder="Nombre" style={{ ...inp, flex: '1' }} />
                          <input value={m.role} onChange={e => setForm(f => { const t = [...f.team]; t[mi] = { ...t[mi], role: e.target.value }; return { ...f, team: t }; })}
                            placeholder="Rol" style={{ ...inp, flex: '1' }} />
                          <input value={m.responsibilities} onChange={e => setForm(f => { const t = [...f.team]; t[mi] = { ...t[mi], responsibilities: e.target.value }; return { ...f, team: t }; })}
                            placeholder="Responsabilidades" style={{ ...inp, flex: '2' }} />
                          {form.team.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, team: f.team.filter((_, j) => j !== mi) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, team: [...f.team, { name: '', role: '', responsibilities: '' }] }))}
                        className="flex items-center gap-1 text-[11px]" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar persona
                      </button>
                    </>
                  )}

                  {/* 7 — Cronograma */}
                  {i === 6 && (
                    <>
                      <div className="flex gap-3 mb-4">
                        <div className="flex-1">
                          <p className="text-[11px] font-semibold mb-1" style={{ color: C.text3 }}>Fecha de inicio</p>
                          <input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} style={inp} />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-semibold mb-1" style={{ color: C.text3 }}>Fecha de lanzamiento</p>
                          <input type="date" value={form.launchDate} onChange={e => setForm(f => ({ ...f, launchDate: e.target.value }))} style={inp} />
                        </div>
                      </div>
                      <p className="text-[11px] font-semibold mb-2" style={{ color: C.text3 }}>Hitos clave</p>
                      {form.milestones.map((m, mi) => (
                        <div key={mi} className="flex items-center gap-2 mb-2">
                          <input value={m.name} onChange={e => setForm(f => { const ms = [...f.milestones]; ms[mi] = { ...ms[mi], name: e.target.value }; return { ...f, milestones: ms }; })}
                            placeholder={`Hito ${mi + 1}`} style={{ ...inp, flex: '2' }} />
                          <input type="date" value={m.date} onChange={e => setForm(f => { const ms = [...f.milestones]; ms[mi] = { ...ms[mi], date: e.target.value }; return { ...f, milestones: ms }; })}
                            style={{ ...inp, flex: '1' }} />
                          {form.milestones.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, milestones: f.milestones.filter((_, j) => j !== mi) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, milestones: [...f.milestones, { name: '', date: '' }] }))}
                        className="flex items-center gap-1 text-[11px]" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar hito
                      </button>
                    </>
                  )}

                  {/* 8 — Stack */}
                  {i === 7 && (
                    <div className="flex flex-col gap-2">
                      {(['backend', 'frontend', 'database', 'devops', 'apis'] as const).map(key => {
                        const labels: Record<string, string> = {
                          backend: 'Backend', frontend: 'Frontend', database: 'Base de datos',
                          devops: 'Infraestructura / DevOps', apis: 'APIs / Integraciones',
                        };
                        const placeholders: Record<string, string> = {
                          backend: 'Node.js + Express', frontend: 'React + Next.js',
                          database: 'PostgreSQL', devops: 'Docker + Railway', apis: 'Stripe, Twilio',
                        };
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-[11px] w-36 flex-shrink-0" style={{ color: C.text3 }}>{labels[key]}</span>
                            <input value={form.stack[key]} onChange={e => setForm(f => ({ ...f, stack: { ...f.stack, [key]: e.target.value } }))}
                              placeholder={`e.g. ${placeholders[key]}`} style={inp} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 9 — Req funcionales */}
                  {i === 8 && (
                    <>
                      <div className="flex gap-2 mb-1">
                        <div style={{ width: '16px' }} />
                        <span className="text-[10px] font-semibold flex-1" style={{ color: C.text4 }}>MÓDULO</span>
                        <span className="text-[10px] font-semibold flex-[2]" style={{ color: C.text4 }}>DESCRIPCIÓN</span>
                        <div style={{ width: '20px' }} />
                      </div>
                      {form.functionalReqs.map((r, ri) => (
                        <div key={ri} className="flex items-center gap-2 mb-2">
                          <span className="text-[11px] w-4 text-right flex-shrink-0" style={{ color: C.text4 }}>{ri + 1}.</span>
                          <input value={r.module} onChange={e => setForm(f => { const reqs = [...f.functionalReqs]; reqs[ri] = { ...reqs[ri], module: e.target.value }; return { ...f, functionalReqs: reqs }; })}
                            placeholder="Módulo o funcionalidad" style={{ ...inp, flex: '1' }} />
                          <input value={r.description} onChange={e => setForm(f => { const reqs = [...f.functionalReqs]; reqs[ri] = { ...reqs[ri], description: e.target.value }; return { ...f, functionalReqs: reqs }; })}
                            placeholder="Descripción breve" style={{ ...inp, flex: '2' }} />
                          {form.functionalReqs.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, functionalReqs: f.functionalReqs.filter((_, j) => j !== ri) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, functionalReqs: [...f.functionalReqs, { module: '', description: '' }] }))}
                        className="flex items-center gap-1 text-[11px]" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar requerimiento
                      </button>
                    </>
                  )}

                  {/* 10 — Req no funcionales */}
                  {i === 9 && (
                    <div className="flex flex-col gap-2">
                      {(['performance', 'security', 'scalability', 'compliance'] as const).map(key => {
                        const labels: Record<string, string> = {
                          performance: 'Rendimiento', security: 'Seguridad',
                          scalability: 'Escalabilidad', compliance: 'Cumplimiento / Legal',
                        };
                        return (
                          <div key={key} className="flex items-center gap-3">
                            <span className="text-[11px] w-36 flex-shrink-0" style={{ color: C.text3 }}>{labels[key]}</span>
                            <input value={form.nonFunctional[key]} onChange={e => setForm(f => ({ ...f, nonFunctional: { ...f.nonFunctional, [key]: e.target.value } }))}
                              placeholder={`Requisito de ${labels[key].toLowerCase()}...`} style={inp} />
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* 11 — KPIs */}
                  {i === 10 && (
                    <>
                      <div className="flex gap-2 mb-1">
                        <span className="text-[10px] font-semibold flex-[2]" style={{ color: C.text4 }}>INDICADOR</span>
                        <span className="text-[10px] font-semibold flex-1" style={{ color: C.text4 }}>META</span>
                        <span className="text-[10px] font-semibold flex-1" style={{ color: C.text4 }}>FRECUENCIA</span>
                        <div style={{ width: '20px' }} />
                      </div>
                      {form.kpis.map((k, ki) => (
                        <div key={ki} className="flex items-center gap-2 mb-2">
                          <input value={k.indicator} onChange={e => setForm(f => { const kpis = [...f.kpis]; kpis[ki] = { ...kpis[ki], indicator: e.target.value }; return { ...f, kpis }; })}
                            placeholder="Indicador" style={{ ...inp, flex: '2' }} />
                          <input value={k.target} onChange={e => setForm(f => { const kpis = [...f.kpis]; kpis[ki] = { ...kpis[ki], target: e.target.value }; return { ...f, kpis }; })}
                            placeholder="Meta" style={{ ...inp, flex: '1' }} />
                          <input value={k.frequency} onChange={e => setForm(f => { const kpis = [...f.kpis]; kpis[ki] = { ...kpis[ki], frequency: e.target.value }; return { ...f, kpis }; })}
                            placeholder="Frecuencia" style={{ ...inp, flex: '1' }} />
                          {form.kpis.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, kpis: f.kpis.filter((_, j) => j !== ki) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, kpis: [...f.kpis, { indicator: '', target: '', frequency: '' }] }))}
                        className="flex items-center gap-1 text-[11px]" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar KPI
                      </button>
                    </>
                  )}

                  {/* 12 — Riesgos */}
                  {i === 11 && (
                    <>
                      <div className="flex gap-2 mb-1">
                        <span className="text-[10px] font-semibold flex-[2]" style={{ color: C.text4 }}>RIESGO</span>
                        <span className="text-[10px] font-semibold flex-[2]" style={{ color: C.text4 }}>MITIGACIÓN</span>
                        <div style={{ width: '20px' }} />
                      </div>
                      {form.risks.map((r, ri) => (
                        <div key={ri} className="flex items-center gap-2 mb-2">
                          <input value={r.risk} onChange={e => setForm(f => { const risks = [...f.risks]; risks[ri] = { ...risks[ri], risk: e.target.value }; return { ...f, risks }; })}
                            placeholder="Riesgo" style={{ ...inp, flex: '2' }} />
                          <input value={r.mitigation} onChange={e => setForm(f => { const risks = [...f.risks]; risks[ri] = { ...risks[ri], mitigation: e.target.value }; return { ...f, risks }; })}
                            placeholder="Mitigación" style={{ ...inp, flex: '2' }} />
                          {form.risks.length > 1 && (
                            <button onClick={() => setForm(f => ({ ...f, risks: f.risks.filter((_, j) => j !== ri) }))} style={{ color: C.text4, flexShrink: 0 }}>
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => setForm(f => ({ ...f, risks: [...f.risks, { risk: '', mitigation: '' }] }))}
                        className="flex items-center gap-1 text-[11px]" style={{ color: C.accent }}>
                        <Plus size={11} /> Agregar riesgo
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 my-4 px-3 py-2 rounded-[6px]"
              style={{ background: C.red + '18', border: `1px solid ${C.red}33`, color: C.red }}>
              <AlertTriangle size={13} />
              <span className="text-[12px]">{error}</span>
            </div>
          )}

          {/* Generate button */}
          <div className="mt-5 flex items-center gap-3">
            <button
              onClick={() => canGenerateForm && onGenerate(serializeProjectForm(form))}
              disabled={!canGenerateForm}
              className="flex items-center gap-2 px-5 py-2.5 rounded-[7px] font-medium text-[13px] transition-all"
              style={{
                background: canGenerateForm ? C.accent : C.border,
                color: canGenerateForm ? '#fff' : C.text3,
                cursor: canGenerateForm ? 'pointer' : 'not-allowed',
              }}
            >
              {isGenerating
                ? <><Loader2 size={14} className="animate-spin" />{t.ai_builder_analyzing}</>
                : <><Sparkles size={14} />{t.ai_builder_analyze}</>}
            </button>
            {!canGenerateForm && !noCredits && (
              <span className="text-[11px]" style={{ color: C.text4 }}>
                Completa al menos Introducción y Solución para continuar
              </span>
            )}
          </div>
        </>
      )}

      {/* ══ TEXT MODE ══════════════════════════════════════════════════════════ */}
      {mode === 'text' && (
        <>
          {/* Planning documents section */}
          <div className="mb-5 rounded-[8px] overflow-hidden" style={{ border: `1px solid ${showPlans ? C.accent + '55' : C.border}` }}>
            <button onClick={handleTogglePlans} className="w-full flex items-center gap-3 px-4 py-3 text-left"
              style={{ background: showPlans ? C.accent + '0d' : C.surface }}>
              <FileText size={14} style={{ color: showPlans ? C.accent : C.text3 }} />
              <div className="flex-1">
                <p className="text-[13px] font-medium" style={{ color: showPlans ? C.text : C.text2 }}>{t.ai_builder_plans_title}</p>
                <p className="text-[11px]" style={{ color: C.text4 }}>{t.ai_builder_plans_subtitle}</p>
              </div>
              {showPlans ? <ChevronDown size={13} style={{ color: C.text3 }} /> : <ChevronRight size={13} style={{ color: C.text3 }} />}
            </button>

            {showPlans && (
              <div className="p-4" style={{ borderTop: `1px solid ${C.border}` }}>
                <div className="flex gap-2 mb-3">
                  <select value={selectedPlanId} onChange={(e) => handleSelectPlan(e.target.value)}
                    style={{ background: C.surface, border: `1px solid ${C.border2}`, color: C.text, borderRadius: '6px', padding: '6px 10px', fontSize: '12px', outline: 'none', cursor: 'pointer', flex: 1 }}>
                    <option value="">{t.ai_builder_select_plan}</option>
                    {plans.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                  <button onClick={handleNewPlan} disabled={creatingPlan}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-[12px] font-medium"
                    style={{ background: C.accent, color: '#fff', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                    {creatingPlan ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
                    {t.ai_builder_new_plan}
                  </button>
                </div>

                {editingPlan && (
                  <div className="rounded-[6px] overflow-hidden" style={{ border: `1px solid ${C.border2}` }}>
                    <div className="flex items-center gap-2 px-3 py-2" style={{ background: C.hover, borderBottom: `1px solid ${C.border}` }}>
                      <input value={editingPlan.title} onChange={(e) => setEditingPlan({ ...editingPlan, title: e.target.value })}
                        className="flex-1 text-[12px] font-medium bg-transparent outline-none" style={{ color: C.text }} />
                      <button onClick={handleSavePlan} disabled={saving}
                        className="flex items-center gap-1 px-2.5 py-1 rounded-[4px] text-[11px] font-medium"
                        style={{ background: C.accent + '22', color: C.accent, cursor: 'pointer' }}>
                        {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                        {saving ? t.ai_builder_saving : saveMsg === 'ok' ? t.ai_builder_plan_saved : t.ai_builder_save_plan}
                      </button>
                      <button onClick={() => handleDeletePlan(editingPlan.id)}
                        className="flex items-center gap-1 px-2 py-1 rounded-[4px] text-[11px]"
                        style={{ color: C.text3, cursor: 'pointer' }}>
                        <Trash2 size={11} />
                      </button>
                    </div>
                    <textarea value={editingPlan.content} onChange={(e) => setEditingPlan({ ...editingPlan, content: e.target.value })}
                      rows={20} spellCheck={false} className="w-full p-4 text-[12px] leading-relaxed font-mono"
                      style={{ background: C.bg2, color: C.text2, outline: 'none', resize: 'vertical', border: 'none' }} />
                    <div className="flex items-center justify-between px-3 py-2" style={{ background: C.hover, borderTop: `1px solid ${C.border}` }}>
                      {planMsg
                        ? <span className="text-[11px]" style={{ color: planMsg.type === 'ok' ? C.green : C.red }}>{planMsg.text}</span>
                        : <span className="text-[11px]" style={{ color: C.text4 }}>{editingPlan.content.length.toLocaleString()} chars</span>}
                      <button onClick={handleLoadPlan} disabled={!editingPlan.content}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-[5px] text-[12px] font-medium"
                        style={{ background: C.green, color: '#fff', cursor: 'pointer' }}>
                        <CheckCircle2 size={12} />
                        {t.ai_builder_load_plan}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Separator */}
          <div className="flex items-center gap-3 mb-4">
            <div style={{ flex: 1, height: '1px', background: C.border }} />
            <span className="text-[11px]" style={{ color: C.text4 }}>{t.ai_builder_or}</span>
            <div style={{ flex: 1, height: '1px', background: C.border }} />
          </div>

          {/* Textarea */}
          <textarea value={text} onChange={(e) => setText(e.target.value)}
            placeholder={t.ai_builder_step1_placeholder} rows={14}
            className="w-full rounded-[8px] p-4 text-[13px] leading-relaxed"
            style={{ background: C.surface, border: `1px solid ${tooLong ? C.red : C.border}`, color: C.text, outline: 'none', resize: 'vertical', fontFamily: 'inherit' }} />
          <div className="mt-2 mb-4">
            <span className="text-[11px]" style={{ color: tooLong ? C.red : C.text4 }}>
              {charCount.toLocaleString()} / 50,000 characters
            </span>
          </div>

          {error && (
            <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-[6px]"
              style={{ background: C.red + '18', border: `1px solid ${C.red}33`, color: C.red }}>
              <AlertTriangle size={13} />
              <span className="text-[12px]">{error}</span>
            </div>
          )}

          <button onClick={() => canGenerateText && onGenerate(text)} disabled={!canGenerateText}
            className="flex items-center gap-2 px-5 py-2.5 rounded-[7px] font-medium text-[13px] transition-all"
            style={{ background: canGenerateText ? C.accent : C.border, color: canGenerateText ? '#fff' : C.text3, cursor: canGenerateText ? 'pointer' : 'not-allowed' }}>
            {isGenerating
              ? <><Loader2 size={14} className="animate-spin" />{t.ai_builder_analyzing}</>
              : <><Sparkles size={14} />{t.ai_builder_analyze}</>}
          </button>
        </>
      )}
    </div>
  );
}

// ── Step 2: Editable preview ──────────────────────────────────────────────────
function Step2({
  plan,
  onPlanChange,
  onBuild,
  onReset,
  isBuilding,
  error,
  t,
}: {
  plan: AiWorkspacePlan;
  onPlanChange: (p: AiWorkspacePlan) => void;
  onBuild: () => void;
  onReset: () => void;
  isBuilding: boolean;
  error: string | null;
  t: any;
}) {
  const totalCards = plan.projects.reduce(
    (acc, p) => acc + p.boards.reduce((a, b) => a + b.lists.reduce((x, l) => x + l.cards.length, 0), 0),
    0
  );
  const totalBoards = plan.projects.reduce((acc, p) => acc + p.boards.length, 0);

  const addProject = () => {
    onPlanChange({
      ...plan,
      projects: [
        ...plan.projects,
        {
          name: 'New project',
          description: '',
          status: 'PLANNING',
          milestones: [],
          boards: [{ name: 'Main board', description: '', lists: [{ name: 'To Do', cards: [] }, { name: 'In Progress', cards: [] }, { name: 'Done', cards: [] }] }],
        },
      ],
    });
  };

  return (
    <div>
      {/* Stats bar */}
      <div
        className="flex items-center gap-6 px-4 py-3 rounded-[8px] mb-6"
        style={{ background: C.surface, border: `1px solid ${C.border}` }}
      >
        <div className="text-center">
          <div className="text-[18px] font-bold" style={{ color: C.text }}>{plan.projects.length}</div>
          <div className="text-[10px]" style={{ color: C.text4 }}>Projects</div>
        </div>
        <div style={{ width: '1px', height: '30px', background: C.border }} />
        <div className="text-center">
          <div className="text-[18px] font-bold" style={{ color: C.text }}>{totalBoards}</div>
          <div className="text-[10px]" style={{ color: C.text4 }}>Boards</div>
        </div>
        <div style={{ width: '1px', height: '30px', background: C.border }} />
        <div className="text-center">
          <div className="text-[18px] font-bold" style={{ color: C.text }}>{totalCards}</div>
          <div className="text-[10px]" style={{ color: C.text4 }}>Cards</div>
        </div>
      </div>

      {/* Workspace info */}
      <div
        className="p-4 rounded-[10px] mb-6"
        style={{ background: C.surface, border: `1px solid ${C.border2}` }}
      >
        <div className="flex items-center gap-2 mb-3">
          <span className="text-[20px]">{plan.workspace.icon}</span>
          <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.text4 }}>
            {t.ai_builder_workspace_section}
          </p>
        </div>
        <EditableField
          value={plan.workspace.name}
          onChange={(v) => onPlanChange({ ...plan, workspace: { ...plan.workspace, name: v } })}
          style={{ fontSize: '15px', fontWeight: 700, color: C.text, marginBottom: '4px' }}
        />
        <EditableField
          value={plan.workspace.description}
          onChange={(v) => onPlanChange({ ...plan, workspace: { ...plan.workspace, description: v } })}
          placeholder="Workspace description"
          multiline
          style={{ fontSize: '12px', color: C.text2 }}
        />
      </div>

      {/* Projects */}
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: C.text4 }}>
          {t.ai_builder_projects_section}
        </p>
        <button
          onClick={addProject}
          className="flex items-center gap-1 text-[11px]"
          style={{ color: C.accent }}
        >
          <Plus size={12} /> {t.ai_builder_add_project}
        </button>
      </div>

      {plan.projects.map((project, pi) => (
        <ProjectSection
          key={pi}
          project={project}
          t={t}
          onUpdate={(updated) => {
            const projects = [...plan.projects];
            projects[pi] = updated;
            onPlanChange({ ...plan, projects });
          }}
          onRemove={() => {
            onPlanChange({ ...plan, projects: plan.projects.filter((_, i) => i !== pi) });
          }}
        />
      ))}

      {/* Error */}
      {error && (
        <div
          className="flex items-center gap-2 mb-4 px-3 py-2 rounded-[6px]"
          style={{ background: C.red + '18', border: `1px solid ${C.red}33`, color: C.red }}
        >
          <AlertTriangle size={13} />
          <span className="text-[12px]">{error}</span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3 mt-6">
        <button
          onClick={onBuild}
          disabled={isBuilding || plan.projects.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-[7px] font-medium text-[13px]"
          style={{
            background: isBuilding || plan.projects.length === 0 ? C.border : C.accent,
            color: isBuilding || plan.projects.length === 0 ? C.text3 : '#fff',
            cursor: isBuilding || plan.projects.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          {isBuilding ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {t.ai_builder_creating}
            </>
          ) : (
            <>
              <Sparkles size={14} />
              {t.ai_builder_create_workspace}
            </>
          )}
        </button>
        <button
          onClick={onReset}
          className="text-[13px]"
          style={{ color: C.text3 }}
        >
          {t.ai_builder_start_over}
        </button>
      </div>
    </div>
  );
}

// ── Step 3: Building / done ───────────────────────────────────────────────────
function Step3({
  isBuilding,
  workspaceId,
  onGoToWorkspace,
  t,
}: {
  isBuilding: boolean;
  workspaceId: string | null;
  onGoToWorkspace: () => void;
  t: any;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      {isBuilding ? (
        <>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: C.accent + '18', border: `2px solid ${C.accent}44` }}
          >
            <Loader2 size={32} style={{ color: C.accent }} className="animate-spin" />
          </div>
          <h2 className="text-[20px] font-bold mb-2" style={{ color: C.text }}>
            {t.ai_builder_step3_title}
          </h2>
          <p className="text-[13px]" style={{ color: C.text3 }}>
            Creating workspace, projects, boards, lists and cards...
          </p>
        </>
      ) : (
        <>
          <div
            className="w-16 h-16 rounded-full flex items-center justify-center mb-6"
            style={{ background: C.green + '18', border: `2px solid ${C.green}44` }}
          >
            <CheckCircle2 size={32} style={{ color: C.green }} />
          </div>
          <h2 className="text-[20px] font-bold mb-2" style={{ color: C.text }}>
            {t.ai_builder_step3_done}
          </h2>
          <button
            onClick={onGoToWorkspace}
            className="flex items-center gap-2 mt-6 px-5 py-2.5 rounded-[7px] font-medium text-[13px]"
            style={{ background: C.accent, color: '#fff' }}
          >
            {t.ai_builder_go_to_workspace}
          </button>
        </>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function AiBuilderPage() {
  const t = useT();
  const router = useRouter();
  const {
    credits,
    plan,
    step,
    isGenerating,
    isBuilding,
    error,
    fetchCredits,
    generatePlan,
    setPlan,
    buildWorkspace,
    reset,
  } = useAiPlannerStore();

  const [builtWorkspaceId, setBuiltWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    fetchCredits();
  }, []);

  const handleGenerate = useCallback(async (text: string) => {
    await generatePlan(text);
  }, [generatePlan]);

  const handleBuild = useCallback(async () => {
    try {
      const wsId = await buildWorkspace();
      setBuiltWorkspaceId(wsId);
    } catch {
      // error already in store
    }
  }, [buildWorkspace]);

  const handleGoToWorkspace = () => {
    if (builtWorkspaceId) {
      router.push(`/dashboard/workspaces`);
    }
  };

  return (
    <div
      className="min-h-screen"
      style={{ background: C.bg, color: C.text }}
    >
      {/* Header */}
      <div
        className="px-8 py-5 flex items-center gap-3"
        style={{ borderBottom: `1px solid ${C.border}` }}
      >
        <div
          className="w-7 h-7 rounded-[6px] flex items-center justify-center"
          style={{ background: C.accent + '22' }}
        >
          <Sparkles size={14} style={{ color: C.accent }} />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-[15px] font-semibold" style={{ color: C.text }}>
              {t.ai_builder_nav_label}
            </h1>
            <span
              className="text-[9px] font-bold px-[5px] py-[1px] rounded-[3px] tracking-wider"
              style={{ background: C.accent + '22', color: C.accent, border: `1px solid ${C.accent}44` }}
            >
              {t.ai_builder_beta_label}
            </span>
          </div>
          <p className="text-[12px]" style={{ color: C.text3 }}>
            {step === 1 ? t.ai_builder_step1_subtitle : step === 2 ? t.ai_builder_step2_subtitle : ''}
          </p>
        </div>

        {/* Step indicator */}
        <div className="ml-auto flex items-center gap-2">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className="flex items-center gap-1.5"
              style={{ color: s === step ? C.text : C.text4 }}
            >
              <div
                className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                style={{
                  background: s === step ? C.accent : s < step ? C.green : C.surface,
                  color: s <= step ? '#fff' : C.text4,
                  border: `1px solid ${s === step ? C.accent : s < step ? C.green : C.border}`,
                }}
              >
                {s < step ? '✓' : s}
              </div>
              {s < 3 && <div style={{ width: '16px', height: '1px', background: s < step ? C.green : C.border }} />}
            </div>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
        {step === 1 && (
          <Step1
            credits={credits}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
            error={error}
            t={t}
          />
        )}

        {step === 2 && plan && (
          <Step2
            plan={plan}
            onPlanChange={setPlan}
            onBuild={handleBuild}
            onReset={reset}
            isBuilding={isBuilding}
            error={error}
            t={t}
          />
        )}

        {step === 3 && (
          <Step3
            isBuilding={isBuilding}
            workspaceId={builtWorkspaceId}
            onGoToWorkspace={handleGoToWorkspace}
            t={t}
          />
        )}
      </div>
    </div>
  );
}
