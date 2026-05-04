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
import { Sparkles, ChevronDown, ChevronRight, Plus, X, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

// ── Color tokens ─────────────────────────────────────────────────────────────
const C = {
  bg:      '#0b0d10',
  bg2:     '#0f1217',
  surface: '#14171c',
  hover:   '#1c2128',
  border:  '#1f2329',
  border2: '#2a2f36',
  text:    '#e6e8eb',
  text2:   '#a1a7b0',
  text3:   '#6b7280',
  text4:   '#4b5260',
  accent:  '#3b82f6',
  green:   '#10b981',
  amber:   '#f59e0b',
  red:     '#ef4444',
};

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
  const [text, setText] = useState('');
  const charCount = text.length;
  const tooLong = charCount > 50000;
  const tooShort = charCount < 10;
  const noCredits = credits === 0;
  const canGenerate = !isGenerating && !tooShort && !tooLong && !noCredits;

  return (
    <div className="max-w-2xl mx-auto">
      {/* Credits indicator */}
      <div
        className="flex items-center justify-between mb-6 px-4 py-3 rounded-[8px]"
        style={{
          background: C.surface,
          border: `1px solid ${noCredits ? C.red + '55' : C.border}`,
        }}
      >
        <div className="flex items-center gap-2">
          <Sparkles size={14} style={{ color: noCredits ? C.red : C.accent }} />
          <span className="text-[13px]" style={{ color: noCredits ? C.red : C.text2 }}>
            {noCredits ? t.ai_builder_error_no_credits : t.ai_builder_credits_remaining(credits)}
          </span>
        </div>
        <span className="text-[11px]" style={{ color: C.text4 }}>
          {t.ai_builder_trial_notice}
        </span>
      </div>

      {/* Textarea — always interactive */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t.ai_builder_step1_placeholder}
        rows={16}
        className="w-full rounded-[8px] p-4 text-[13px] leading-relaxed"
        style={{
          background: C.surface,
          border: `1px solid ${tooLong ? C.red : C.border}`,
          color: C.text,
          outline: 'none',
          resize: 'vertical',
          fontFamily: 'inherit',
          cursor: 'text',
        }}
      />

      {/* Char count */}
      <div className="flex items-center justify-between mt-2 mb-4">
        <span className="text-[11px]" style={{ color: tooLong ? C.red : C.text4 }}>
          {charCount.toLocaleString()} / 50,000 characters
        </span>
      </div>

      {/* Error from generation attempt */}
      {error && (
        <div
          className="flex items-center gap-2 mb-4 px-3 py-2 rounded-[6px]"
          style={{ background: C.red + '18', border: `1px solid ${C.red}33`, color: C.red }}
        >
          <AlertTriangle size={13} />
          <span className="text-[12px]">{error}</span>
        </div>
      )}

      {/* Generate button */}
      <button
        onClick={() => canGenerate && onGenerate(text)}
        disabled={!canGenerate}
        className="flex items-center gap-2 px-5 py-2.5 rounded-[7px] font-medium text-[13px] transition-all"
        style={{
          background: canGenerate ? C.accent : C.border,
          color: canGenerate ? '#fff' : C.text3,
          cursor: canGenerate ? 'pointer' : 'not-allowed',
        }}
      >
        {isGenerating ? (
          <>
            <Loader2 size={14} className="animate-spin" />
            {t.ai_builder_analyzing}
          </>
        ) : (
          <>
            <Sparkles size={14} />
            {t.ai_builder_analyze}
          </>
        )}
      </button>
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
