// apps/web/src/components/CreateProjectModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useProjectStore, type Project, type ProjectMaturityStage } from '@/stores/projectStore';
import { useWorkspaceStore, type WorkspaceProjectStandardDefinition } from '@/stores/workspaceStore';
import { markStepDone } from '@/lib/utils/onboardingGuide';
import { WorkspaceIcon, WORKSPACE_ICON_KEYS } from '@/components/WorkspaceIcon';
import { X, Check, ChevronDown } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

const COLORS = [
  '#F2571E', '#DB8A66', '#76A878', '#4B607F',
  '#9C9486', '#B85C5C', '#7B8FA8', '#C4A86E',
];

const DEFAULT_STANDARD: WorkspaceProjectStandardDefinition = {
  requiredProjectFields: ['problemStatement', 'nextStep'],
  requiredChecklist: ['owner', 'problem', 'team', 'board', 'milestone', 'nextStep'],
  minimumMaturityForPlanning: 'FORMALIZED',
  intakeStages: ['IDEA', 'DRAFT'],
  targetLabels: {
    intake: 'Intake',
    formalized: 'Formalizado',
    execution: 'Operacion',
  },
};

const MATURITY_LABELS: Record<ProjectMaturityStage, string> = {
  IDEA: 'Idea',
  DRAFT: 'Borrador',
  FORMALIZED: 'Formalizado',
  PLANNED: 'Planificado',
  ACTIVE: 'Activo',
  ON_HOLD: 'En pausa',
  COMPLETED: 'Completado',
  ARCHIVED: 'Archivado',
};

interface CreateProjectModalProps {
  onClose: () => void;
  onCreated: (project: Project) => void;
  defaultWorkspaceId?: string;
}

export default function CreateProjectModal({ onClose, onCreated, defaultWorkspaceId }: CreateProjectModalProps) {
  const t = useT();
  const { createProject } = useProjectStore();
  const { workspaces, fetchWorkspaces, currentProjectStandard, fetchProjectStandard } = useWorkspaceStore();

  const [name,             setName]             = useState('');
  const [description,      setDescription]      = useState('');
  const [problemStatement, setProblemStatement] = useState('');
  const [nextStep,         setNextStep]         = useState('');
  const [maturityStage,    setMaturityStage]    = useState<ProjectMaturityStage>('IDEA');
  const [selectedIcon,     setSelectedIcon]     = useState(WORKSPACE_ICON_KEYS[3]);
  const [selectedColor,    setSelectedColor]    = useState(COLORS[0]);
  const [selectedWsId,     setSelectedWsId]     = useState(defaultWorkspaceId ?? '');
  const [startDate,      setStartDate]      = useState('');
  const [endDate,        setEndDate]        = useState('');
  const [isLoading,      setIsLoading]      = useState(false);
  const [error,          setError]          = useState('');
  const [closing,        setClosing]        = useState(false);
  const [showIconPicker, setShowIconPicker] = useState(false);
  const [showWsPicker,   setShowWsPicker]   = useState(false);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    if (selectedWsId) {
      fetchProjectStandard(selectedWsId);
    }
  }, [selectedWsId, fetchProjectStandard]);

  // Sync selected workspace when workspaces load or defaultWorkspaceId arrives late
  useEffect(() => {
    if (defaultWorkspaceId && (!selectedWsId || !workspaces.find((w) => w.id === selectedWsId))) {
      setSelectedWsId(defaultWorkspaceId);
    }
  }, [defaultWorkspaceId, workspaces, selectedWsId]);

  const activeStandard = currentProjectStandard?.workspaceId === selectedWsId
    ? currentProjectStandard
    : null;
  const standardDefinition = activeStandard?.definition ?? DEFAULT_STANDARD;

  useEffect(() => {
    if (!standardDefinition.intakeStages.includes(maturityStage as 'IDEA' | 'DRAFT')) {
      setMaturityStage(standardDefinition.intakeStages[0] ?? 'IDEA');
    }
  }, [standardDefinition, maturityStage]);

  const inputFieldStatus = {
    description: Boolean(description.trim()),
    problemStatement: Boolean(problemStatement.trim()),
    nextStep: Boolean(nextStep.trim()),
    startDate: Boolean(startDate),
    endDate: Boolean(endDate),
    owner: true,
    problem: Boolean(problemStatement.trim()),
    team: false,
    board: false,
    milestone: false,
  };

  const requiredNow = [
    ...standardDefinition.requiredProjectFields,
    ...standardDefinition.requiredChecklist.filter((item) => item === 'problem' || item === 'nextStep'),
  ];

  const unmetRequiredNow = Array.from(new Set(requiredNow)).filter((item) => {
    if (item === 'problemStatement' || item === 'problem') return !inputFieldStatus.problemStatement;
    if (item === 'nextStep') return !inputFieldStatus.nextStep;
    if (item === 'description') return !inputFieldStatus.description;
    if (item === 'startDate') return !inputFieldStatus.startDate;
    if (item === 'endDate') return !inputFieldStatus.endDate;
    return false;
  });

  const postCreateChecklist = standardDefinition.requiredChecklist.map((item) => {
    const done =
      item === 'owner' ? true :
      item === 'problem' ? inputFieldStatus.problem :
      item === 'nextStep' ? inputFieldStatus.nextStep :
      false;

    const label =
      item === 'owner' ? 'Responsable definido' :
      item === 'problem' ? 'Problema u oportunidad' :
      item === 'team' ? 'Equipo o miembros asignados' :
      item === 'board' ? 'Tablero de ejecucion' :
      item === 'milestone' ? 'Hito proximo declarado' :
      'Siguiente paso explicito';

    const hint =
      item === 'owner' ? 'Se asigna automaticamente al crear.' :
      item === 'problem' ? 'Puedes dejarlo listo desde este formulario.' :
      item === 'team' ? 'Se completa vinculando miembros o equipos.' :
      item === 'board' ? 'Se completa creando o enlazando un tablero.' :
      item === 'milestone' ? 'Se completa agregando el primer hito.' :
      'Puedes dejarlo listo desde este formulario.';

    return { key: item, label, hint, done };
  });

  const handleClose = () => {
    if (isLoading) return;
    setClosing(true);
    setTimeout(onClose, 200);
  };

  const handleSubmit = async () => {
    if (!name.trim())  { setError(t.create_ws_validation_name); return; }
    if (!selectedWsId) { setError('Selecciona una workspace'); return; }
    if (unmetRequiredNow.length > 0) {
      setError('Completa los campos obligatorios del estandar antes de crear el proyecto.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const project = await createProject({
        workspaceId: selectedWsId,
        name: name.trim(),
        description: description.trim() || undefined,
        problemStatement: problemStatement.trim() || undefined,
        nextStep: nextStep.trim() || undefined,
        maturityStage,
        icon: selectedIcon,
        color: selectedColor,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      markStepDone('project');
      onCreated(project);
    } catch (e: any) {
      setError(e.message || 'Error al crear proyecto');
    } finally {
      setIsLoading(false);
    }
  };

  const selectedWs = workspaces.find((w) => w.id === selectedWsId);

  // ── shared input base ─────────────────────────────────────────────────────
  const inputBase: React.CSSProperties = {
    width: '100%', padding: '9px 13px', borderRadius: '9px',
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.09)',
    color: '#F4EEE2', fontSize: '13.5px', outline: 'none', boxSizing: 'border-box',
    fontFamily: MANROPE, transition: 'border-color 0.15s',
  };

  // ── field label helper ────────────────────────────────────────────────────
  const FL = ({ children }: { children: React.ReactNode }) => (
    <span style={{ fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', fontFamily: SORA, display: 'block', marginBottom: '7px' }}>
      {children}
    </span>
  );

  return (
    <>
      <style>{`
        @keyframes cpOvIn  { from { opacity:0 } to { opacity:1 } }
        @keyframes cpOvOut { from { opacity:1 } to { opacity:0 } }
        @keyframes cpPnIn  { from { opacity:0; transform:translateY(18px) scale(0.96) } to { opacity:1; transform:translateY(0) scale(1) } }
        @keyframes cpPnOut { from { opacity:1; transform:translateY(0) scale(1) } to { opacity:0; transform:translateY(10px) scale(0.98) } }
        @keyframes cpSpin  { to { transform:rotate(360deg) } }
        .cp-scroll { scrollbar-width:thin; scrollbar-color:rgba(255,255,255,0.1) transparent; }
        .cp-scroll::-webkit-scrollbar { width:4px; }
        .cp-scroll::-webkit-scrollbar-thumb { background:rgba(255,255,255,0.1); border-radius:2px; }
        .cp-input::placeholder { color:#403832; }
      `}</style>

      {/* Overlay */}
      <div
        onClick={handleClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 50,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)',
          animation: `${closing ? 'cpOvOut' : 'cpOvIn'} 0.22s ease forwards`,
        }}
      />

      {/* Center positioner */}
      <div
        onClick={handleClose}
        style={{ position: 'fixed', inset: 0, zIndex: 51, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}
      >
        {/* Panel */}
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '500px', maxHeight: '86vh', display: 'flex', flexDirection: 'column',
            background: '#1A2035', border: '1px solid rgba(255,255,255,0.09)',
            borderRadius: '14px', overflow: 'hidden',
            boxShadow: '0 40px 90px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.03) inset',
            animation: `${closing ? 'cpPnOut 0.18s ease forwards' : 'cpPnIn 0.35s cubic-bezier(0.16,1,0.3,1) both'}`,
          }}
        >

          {/* ── Header ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div style={{
              width: '32px', height: '32px', borderRadius: '9px', flexShrink: 0,
              background: `${selectedColor}20`, border: `1px solid ${selectedColor}45`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              transition: 'background 0.2s, border-color 0.2s',
            }}>
              <WorkspaceIcon icon={selectedIcon} style={{ width: '16px', height: '16px', color: selectedColor }} />
            </div>
            <span style={{ flex: 1, fontSize: '14px', fontWeight: 700, color: '#F4EEE2', fontFamily: SORA }}>
              {t.projects_btn_create}
            </span>
            <button
              onClick={handleClose}
              style={{ width: '26px', height: '26px', borderRadius: '7px', background: 'transparent', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', color: '#615846', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.12s', flexShrink: 0 }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#615846'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.08)'; }}
            >
              <X style={{ width: '13px', height: '13px' }} />
            </button>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="cp-scroll" style={{ flex: 1, overflowY: 'auto', padding: '20px 22px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Icono + Color */}
            <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>

              {/* Icon picker */}
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <FL>{t.create_ws_label_icon}</FL>
                <button
                  onClick={() => { setShowIconPicker((v) => !v); setShowWsPicker(false); }}
                  style={{ width: '48px', height: '48px', borderRadius: '11px', background: `${selectedColor}18`, border: `1.5px solid ${selectedColor}45`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.15s, border-color 0.15s' }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = `${selectedColor}28`; (e.currentTarget as HTMLElement).style.borderColor = `${selectedColor}70`; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = `${selectedColor}18`; (e.currentTarget as HTMLElement).style.borderColor = `${selectedColor}45`; }}
                >
                  <WorkspaceIcon icon={selectedIcon} style={{ width: '22px', height: '22px', color: selectedColor }} />
                </button>
                {showIconPicker && (
                  <div
                    className="cp-scroll"
                    style={{ position: 'absolute', top: '56px', left: 0, width: '218px', maxHeight: '178px', overflowY: 'auto', background: '#141928', border: '1px solid rgba(255,255,255,0.12)', borderRadius: '10px', boxShadow: '0 16px 40px rgba(0,0,0,0.6)', zIndex: 10, padding: '8px', display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}
                  >
                    {WORKSPACE_ICON_KEYS.map((key) => (
                      <button
                        key={key}
                        onClick={() => { setSelectedIcon(key); setShowIconPicker(false); }}
                        style={{ width: '28px', height: '28px', borderRadius: '6px', background: selectedIcon === key ? `${selectedColor}28` : 'transparent', border: `1px solid ${selectedIcon === key ? `${selectedColor}50` : 'transparent'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.1s' }}
                        title={key}
                      >
                        <WorkspaceIcon icon={key} style={{ width: '14px', height: '14px', color: selectedIcon === key ? selectedColor : '#615846' }} />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Color */}
              <div style={{ flex: 1 }}>
                <FL>{t.create_ws_label_color}</FL>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                  {COLORS.map((color) => {
                    const active = selectedColor === color;
                    return (
                      <button
                        key={color}
                        onClick={() => setSelectedColor(color)}
                        style={{ width: '26px', height: '26px', borderRadius: '50%', background: color, cursor: 'pointer', border: 'none', outline: `2px solid ${active ? 'rgba(255,255,255,0.35)' : 'transparent'}`, outlineOffset: '2px', transform: active ? 'scale(1.16)' : 'scale(1)', transition: 'transform 0.14s, outline 0.14s', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
                      >
                        {active && <Check style={{ width: '11px', height: '11px', color: '#fff' }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Nombre */}
            <div>
              <FL>{t.projects_config_name} *</FL>
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
                placeholder={t.projects_config_name}
                className="cp-input"
                style={{ ...inputBase, borderColor: error && !name.trim() ? '#B85C5C' : 'rgba(255,255,255,0.09)' }}
                onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = selectedColor)}
                onBlur={(e)  => ((e.currentTarget as HTMLInputElement).style.borderColor = error && !name.trim() ? '#B85C5C' : 'rgba(255,255,255,0.09)')}
              />
            </div>

            <div style={{
              padding: '14px 14px 12px',
              borderRadius: '10px',
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#F4EEE2', fontFamily: SORA }}>
                    {activeStandard ? `${activeStandard.name} · v${activeStandard.version}` : 'Aether Core Standard'}
                  </div>
                  <div style={{ fontSize: '11.5px', color: '#9C9486', marginTop: '4px', lineHeight: 1.45 }}>
                    Este workspace espera que el intake llegue al menos hasta {MATURITY_LABELS[standardDefinition.minimumMaturityForPlanning]} antes de pasar a planificacion.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {standardDefinition.intakeStages.map((stage) => (
                    <span
                      key={stage}
                      style={{
                        fontSize: '10.5px',
                        fontWeight: 700,
                        color: stage === maturityStage ? '#24180A' : '#C8BFAE',
                        background: stage === maturityStage ? '#F2571E' : 'rgba(255,255,255,0.05)',
                        borderRadius: '999px',
                        padding: '5px 9px',
                      }}
                    >
                      {MATURITY_LABELS[stage]}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#615846', fontFamily: SORA, textTransform: 'uppercase' }}>
                    Debe quedar listo ahora
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px' }}>
                    {requiredNow.length > 0 ? Array.from(new Set(requiredNow)).map((item) => {
                      const done = !unmetRequiredNow.includes(item);
                      const label =
                        item === 'description' ? 'Descripcion' :
                        item === 'problemStatement' || item === 'problem' ? 'Problema' :
                        item === 'nextStep' ? 'Siguiente paso' :
                        item === 'startDate' ? 'Fecha inicio' :
                        'Fecha cierre';
                      return (
                        <span
                          key={item}
                          style={{
                            fontSize: '10.5px',
                            fontWeight: 700,
                            color: done ? '#76A878' : '#C4A86E',
                            background: done ? 'rgba(118,168,120,0.12)' : 'rgba(196,168,110,0.12)',
                            border: `1px solid ${done ? 'rgba(118,168,120,0.22)' : 'rgba(196,168,110,0.22)'}`,
                            borderRadius: '999px',
                            padding: '4px 8px',
                          }}
                        >
                          {done ? 'Listo' : 'Falta'} · {label}
                        </span>
                      );
                    }) : (
                      <span style={{ fontSize: '11.5px', color: '#9C9486' }}>Sin campos obligatorios adicionales.</span>
                    )}
                  </div>
                </div>

                <div style={{ padding: '10px 12px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontSize: '10.5px', fontWeight: 700, color: '#615846', fontFamily: SORA, textTransform: 'uppercase' }}>
                    Pendiente despues de crear
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '9px' }}>
                    {postCreateChecklist.filter((item) => !item.done).length > 0 ? postCreateChecklist.filter((item) => !item.done).map((item) => (
                      <span
                        key={item.key}
                        style={{
                          fontSize: '10.5px',
                          fontWeight: 700,
                          color: '#9C9486',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: '999px',
                          padding: '4px 8px',
                        }}
                      >
                        {item.label}
                      </span>
                    )) : (
                      <span style={{ fontSize: '11.5px', color: '#76A878' }}>Este intake ya deja la formalizacion muy encaminada.</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Descripción */}
            <div>
              <FL>{t.projects_config_desc}{standardDefinition.requiredProjectFields.includes('description') ? ' *' : ''}</FL>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descripción opcional…"
                rows={2}
                className="cp-input"
                style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6 }}
                onFocus={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = selectedColor)}
                onBlur={(e)  => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = 'rgba(255,255,255,0.09)')}
              />
            </div>

            <div>
              <FL>Problema u oportunidad{standardDefinition.requiredProjectFields.includes('problemStatement') || standardDefinition.requiredChecklist.includes('problem') ? ' *' : ''}</FL>
              <textarea
                value={problemStatement}
                onChange={(e) => setProblemStatement(e.target.value)}
                placeholder="Qué se quiere resolver y por qué importa"
                rows={3}
                className="cp-input"
                style={{ ...inputBase, resize: 'vertical', lineHeight: 1.6, borderColor: unmetRequiredNow.includes('problemStatement') || unmetRequiredNow.includes('problem') ? '#C4A86E' : 'rgba(255,255,255,0.09)' }}
                onFocus={(e) => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = selectedColor)}
                onBlur={(e)  => ((e.currentTarget as HTMLTextAreaElement).style.borderColor = unmetRequiredNow.includes('problemStatement') || unmetRequiredNow.includes('problem') ? '#C4A86E' : 'rgba(255,255,255,0.09)')}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <FL>Madurez inicial</FL>
                <select
                  value={maturityStage}
                  onChange={(e) => setMaturityStage(e.target.value as ProjectMaturityStage)}
                  className="cp-input"
                  style={{ ...inputBase, color: '#C8BFAE', colorScheme: 'dark', cursor: 'pointer' }}
                  onFocus={(e) => ((e.currentTarget as HTMLSelectElement).style.borderColor = selectedColor)}
                  onBlur={(e)  => ((e.currentTarget as HTMLSelectElement).style.borderColor = 'rgba(255,255,255,0.09)')}
                >
                  {standardDefinition.intakeStages.map((stage) => (
                    <option key={stage} value={stage}>{MATURITY_LABELS[stage]}</option>
                  ))}
                </select>
              </div>
              <div>
                <FL>Siguiente paso{standardDefinition.requiredProjectFields.includes('nextStep') || standardDefinition.requiredChecklist.includes('nextStep') ? ' *' : ''}</FL>
                <input
                  value={nextStep}
                  onChange={(e) => setNextStep(e.target.value)}
                  placeholder="Ej: armar equipo base"
                  className="cp-input"
                  style={{ ...inputBase, borderColor: unmetRequiredNow.includes('nextStep') ? '#C4A86E' : 'rgba(255,255,255,0.09)' }}
                  onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = selectedColor)}
                  onBlur={(e)  => ((e.currentTarget as HTMLInputElement).style.borderColor = unmetRequiredNow.includes('nextStep') ? '#C4A86E' : 'rgba(255,255,255,0.09)')}
                />
              </div>
            </div>

            {/* Workspace */}
            <div>
              <FL>Workspace *</FL>
              <button
                onClick={() => { setShowWsPicker((v) => !v); setShowIconPicker(false); }}
                style={{ ...inputBase, display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', textAlign: 'left', borderColor: error && !selectedWsId ? '#B85C5C' : showWsPicker ? selectedColor : 'rgba(255,255,255,0.09)' }}
                onMouseEnter={(e) => { if (!showWsPicker) (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; }}
                onMouseLeave={(e) => { if (!showWsPicker) (e.currentTarget as HTMLElement).style.borderColor = error && !selectedWsId ? '#B85C5C' : 'rgba(255,255,255,0.09)'; }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {selectedWs ? (
                    <>
                      <div style={{ width: '18px', height: '18px', borderRadius: '5px', background: `${selectedWs.color ?? C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <WorkspaceIcon icon={selectedWs.icon ?? 'Folder'} style={{ width: '10px', height: '10px', color: selectedWs.color ?? C.accent }} />
                      </div>
                      <span style={{ fontSize: '13.5px', color: '#C8BFAE', fontFamily: MANROPE }}>{selectedWs.name}</span>
                    </>
                  ) : (
                    <span style={{ fontSize: '13.5px', color: '#403832', fontFamily: MANROPE }}>Selecciona una workspace…</span>
                  )}
                </span>
                <ChevronDown style={{ width: '13px', height: '13px', color: '#615846', transition: 'transform 0.15s', transform: showWsPicker ? 'rotate(180deg)' : 'none', flexShrink: 0 }} />
              </button>

              {showWsPicker && workspaces.filter((w) => !w.archived).length > 0 && (
                <div className="cp-scroll" style={{ marginTop: '4px', borderRadius: '9px', border: '1px solid rgba(255,255,255,0.1)', maxHeight: '150px', overflowY: 'auto', background: '#141928', boxShadow: '0 10px 28px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
                  {workspaces.filter((w) => !w.archived).map((ws) => {
                    const sel = ws.id === selectedWsId;
                    return (
                      <button
                        key={ws.id}
                        onClick={() => { setSelectedWsId(ws.id); setShowWsPicker(false); }}
                        style={{ width: '100%', padding: '9px 12px', background: sel ? `${selectedColor}14` : 'transparent', border: 'none', display: 'flex', alignItems: 'center', gap: '9px', cursor: 'pointer', textAlign: 'left', transition: 'background 0.1s' }}
                        onMouseEnter={(e) => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                        onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = sel ? `${selectedColor}14` : 'transparent'; }}
                      >
                        <div style={{ width: '22px', height: '22px', borderRadius: '6px', background: `${ws.color ?? C.accent}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <WorkspaceIcon icon={ws.icon ?? 'Folder'} style={{ width: '11px', height: '11px', color: ws.color ?? C.accent }} />
                        </div>
                        <span style={{ flex: 1, fontSize: '13px', color: sel ? '#F4EEE2' : '#9C9486', fontFamily: MANROPE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ws.name}</span>
                        {sel && <Check style={{ width: '13px', height: '13px', color: selectedColor, flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fechas */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <FL>{t.projects_config_start}{standardDefinition.requiredProjectFields.includes('startDate') ? ' *' : ''}</FL>
                <input
                  type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                  className="cp-input"
                  style={{ ...inputBase, color: startDate ? '#C8BFAE' : '#403832', colorScheme: 'dark', borderColor: unmetRequiredNow.includes('startDate') ? '#C4A86E' : 'rgba(255,255,255,0.09)' }}
                  onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = selectedColor)}
                  onBlur={(e)  => ((e.currentTarget as HTMLInputElement).style.borderColor = unmetRequiredNow.includes('startDate') ? '#C4A86E' : 'rgba(255,255,255,0.09)')}
                />
              </div>
              <div>
                <FL>{t.projects_config_end}{standardDefinition.requiredProjectFields.includes('endDate') ? ' *' : ''}</FL>
                <input
                  type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                  className="cp-input"
                  style={{ ...inputBase, color: endDate ? '#C8BFAE' : '#403832', colorScheme: 'dark', borderColor: unmetRequiredNow.includes('endDate') ? '#C4A86E' : 'rgba(255,255,255,0.09)' }}
                  onFocus={(e) => ((e.currentTarget as HTMLInputElement).style.borderColor = selectedColor)}
                  onBlur={(e)  => ((e.currentTarget as HTMLInputElement).style.borderColor = unmetRequiredNow.includes('endDate') ? '#C4A86E' : 'rgba(255,255,255,0.09)')}
                />
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 13px', borderRadius: '8px', background: 'rgba(184,92,92,0.1)', border: '1px solid rgba(184,92,92,0.25)' }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="#B85C5C" strokeWidth="1.8"/><path d="M12 8v4M12 16h.01" stroke="#B85C5C" strokeWidth="1.8" strokeLinecap="round"/></svg>
                <span style={{ fontSize: '12px', color: '#B85C5C', fontFamily: MANROPE }}>{error}</span>
              </div>
            )}
          </div>

          {/* ── Footer ──────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px', padding: '14px 22px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0, background: 'rgba(255,255,255,0.01)' }}>
            <button
              onClick={handleClose} disabled={isLoading}
              style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#9C9486', cursor: 'pointer', fontFamily: MANROPE, transition: 'all 0.12s' }}
              onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'; (e.currentTarget as HTMLElement).style.color = '#E8E1D2'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; (e.currentTarget as HTMLElement).style.color = '#9C9486'; }}
            >
              {t.btn_cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={isLoading || !name.trim() || !selectedWsId}
              style={{
                padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 700,
                background: isLoading || !name.trim() || !selectedWsId ? 'rgba(242,87,30,0.3)' : '#F2571E',
                color: isLoading || !name.trim() || !selectedWsId ? 'rgba(255,255,255,0.3)' : '#24180A',
                border: 'none', cursor: isLoading || !name.trim() || !selectedWsId ? 'not-allowed' : 'pointer',
                fontFamily: SORA, transition: 'filter 0.12s',
                display: 'flex', alignItems: 'center', gap: '7px',
              }}
              onMouseEnter={(e) => { if (!isLoading && name.trim() && selectedWsId) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.filter = ''; }}
            >
              {isLoading ? (
                <>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', border: '2px solid rgba(36,24,10,0.3)', borderTopColor: '#24180A', animation: 'cpSpin 0.6s linear infinite' }} />
                  {t.btn_creating}
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"/>
                  </svg>
                  {t.projects_btn_create}
                </>
              )}
            </button>
          </div>

        </div>
      </div>
    </>
  );
}
