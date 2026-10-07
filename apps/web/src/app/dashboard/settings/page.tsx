// apps/web/src/app/dashboard/settings/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { UserPreferences } from '@/stores/preferencesStore';
import { useWorkspaceStore, type WorkspaceProjectStandardDefinition } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Bell, Check, ShieldCheck, Workflow } from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

const REQUIRED_FIELD_OPTIONS: Array<{ value: WorkspaceProjectStandardDefinition['requiredProjectFields'][number]; label: string; desc: string }> = [
  { value: 'description', label: 'Descripcion general', desc: 'Pide contexto base del proyecto.' },
  { value: 'problemStatement', label: 'Problema u oportunidad', desc: 'Obliga a explicitar que se quiere resolver.' },
  { value: 'nextStep', label: 'Siguiente paso', desc: 'Exige una accion inmediata y verificable.' },
  { value: 'startDate', label: 'Fecha de inicio', desc: 'Formaliza cuando empieza la ejecucion.' },
  { value: 'endDate', label: 'Fecha de cierre', desc: 'Marca horizonte o compromiso de termino.' },
];

const CHECKLIST_OPTIONS: Array<{ value: WorkspaceProjectStandardDefinition['requiredChecklist'][number]; label: string; desc: string }> = [
  { value: 'owner', label: 'Responsable', desc: 'Debe existir alguien accountable del proyecto.' },
  { value: 'problem', label: 'Problema', desc: 'La iniciativa necesita un problema declarado.' },
  { value: 'team', label: 'Equipo', desc: 'Pide miembros o equipos vinculados.' },
  { value: 'board', label: 'Tablero', desc: 'Exige un espacio operativo para ejecutar.' },
  { value: 'milestone', label: 'Hito proximo', desc: 'Obliga una referencia temporal concreta.' },
  { value: 'document', label: 'Documento base', desc: 'Exige una evidencia, brief o documento de proyecto.' },
  { value: 'nextStep', label: 'Siguiente paso', desc: 'Debe quedar una accion inmediata explicitada.' },
];

const MATURITY_OPTIONS: Array<{ value: WorkspaceProjectStandardDefinition['minimumMaturityForPlanning']; label: string; desc: string }> = [
  { value: 'IDEA', label: 'Idea', desc: 'Permite planificar desde la intuicion inicial.' },
  { value: 'DRAFT', label: 'Borrador', desc: 'Exige una idea ya algo articulada.' },
  { value: 'FORMALIZED', label: 'Formalizado', desc: 'La planificacion nace despues del encuadre minimo.' },
  { value: 'PLANNED', label: 'Planificado', desc: 'Reserva la ejecucion formal para proyectos ya estructurados.' },
];

const INTAKE_STAGE_OPTIONS: Array<{ value: WorkspaceProjectStandardDefinition['intakeStages'][number]; label: string; desc: string }> = [
  { value: 'IDEA', label: 'Idea', desc: 'Captura propuestas aun abiertas o exploratorias.' },
  { value: 'DRAFT', label: 'Borrador', desc: 'Recibe iniciativas con una formulacion inicial.' },
];

function SectionCard({ icon, title, desc, children }: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{
      background: C.bg2,
      border: `1px solid ${C.border}`,
      borderRadius: '12px',
      overflow: 'hidden',
    }}>
      <div style={{
        padding: '16px 20px',
        borderBottom: `1px solid ${C.border}`,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
      }}>
        <div style={{
          width: '34px', height: '34px', borderRadius: '8px',
          background: `${C.accent}18`, border: `1px solid ${C.accent}30`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: C.accent, flexShrink: 0,
        }}>
          {icon}
        </div>
        <div>
          <p style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{title}</p>
          <p style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>{desc}</p>
        </div>
      </div>
      <div style={{ padding: '20px' }}>
        {children}
      </div>
    </div>
  );
}

function ToggleRow({ label, desc, checked, onChange, disabled }: {
  label: string;
  desc: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '12px 0', opacity: disabled ? 0.5 : 1,
    }}>
      <div>
        <p style={{ fontSize: '13.5px', fontWeight: 500, color: C.text }}>{label}</p>
        <p style={{ fontSize: '12px', color: C.text3, marginTop: '2px' }}>{desc}</p>
      </div>
      <button
        onClick={() => !disabled && onChange(!checked)}
        style={{
          width: '40px', height: '22px', borderRadius: '11px', flexShrink: 0,
          background: checked ? C.accent : C.border2,
          border: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
          position: 'relative', transition: 'background 0.2s',
        }}
      >
        <div style={{
          position: 'absolute', top: '3px',
          left: checked ? '21px' : '3px',
          width: '16px', height: '16px', borderRadius: '50%',
          background: '#fff', transition: 'left 0.2s',
        }} />
      </button>
    </div>
  );
}

function Divider() {
  return <div style={{ height: '1px', background: C.border, margin: '4px 0' }} />;
}

function SummaryMetric({ label, value, hint }: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div style={{
      padding: '12px 14px',
      borderRadius: '10px',
      border: `1px solid ${C.border}`,
      background: C.surface,
      minWidth: 0,
    }}>
      <div style={{ fontSize: '10.5px', fontWeight: 700, color: C.text4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      <div style={{ marginTop: '7px', fontSize: '20px', fontWeight: 700, color: C.text }}>
        {value}
      </div>
      {hint && (
        <div style={{ marginTop: '5px', fontSize: '11.5px', color: C.text3, lineHeight: 1.4 }}>
          {hint}
        </div>
      )}
    </div>
  );
}

function OptionGrid<T extends string>({
  options,
  selected,
  onToggle,
  disabled,
}: {
  options: Array<{ value: T; label: string; desc: string }>;
  selected: T[];
  onToggle: (value: T) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
      {options.map((option) => {
        const isActive = selected.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => !disabled && onToggle(option.value)}
            disabled={disabled}
            style={{
              minHeight: '78px',
              padding: '12px 14px',
              borderRadius: '8px',
              border: `1px solid ${isActive ? C.accent : C.border2}`,
              background: isActive ? `${C.accent}14` : C.surface,
              color: C.text,
              textAlign: 'left',
              cursor: disabled ? 'not-allowed' : 'pointer',
              opacity: disabled ? 0.6 : 1,
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '10px',
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? C.accent : C.text }}>{option.label}</div>
              <div style={{ fontSize: '11.5px', color: C.text3, marginTop: '4px', lineHeight: 1.4 }}>{option.desc}</div>
            </div>
            <div style={{
              width: '18px',
              height: '18px',
              borderRadius: '999px',
              flexShrink: 0,
              border: `1px solid ${isActive ? C.accent : C.border2}`,
              background: isActive ? C.accent : 'transparent',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              marginTop: '2px',
            }}>
              {isActive ? <Check size={12} /> : null}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export default function SettingsPage() {
  const t = useT();
  const { preferences, isLoading, loadPreferences, updatePreferences } = usePreferencesStore();
  const { workspaces, currentProjectStandard, projectStandardHistory, fetchProjectStandard, fetchProjectStandardHistory, updateProjectStandard } = useWorkspaceStore();
  const { activeWorkspaceId } = useActiveWorkspaceStore();
  const { toast } = useToast();

  const [localPrefs, setLocalPrefs] = useState<UserPreferences>({
    theme: 'dark',
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    notificationFrequency: 'realtime',
    compactMode: false,
    showArchived: false,
    defaultBoardView: 'kanban',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [localStandard, setLocalStandard] = useState<{
    name: string;
    definition: WorkspaceProjectStandardDefinition;
  } | null>(null);
  const [isSavingStandard, setIsSavingStandard] = useState(false);
  const [hasStandardChanges, setHasStandardChanges] = useState(false);

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    if (activeWorkspaceId) {
      fetchProjectStandard(activeWorkspaceId);
      fetchProjectStandardHistory(activeWorkspaceId);
    }
  }, [activeWorkspaceId, fetchProjectStandard, fetchProjectStandardHistory]);

  useEffect(() => {
    if (preferences) setLocalPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (preferences) {
      setHasChanges(JSON.stringify(localPrefs) !== JSON.stringify(preferences));
    }
  }, [localPrefs, preferences]);

  useEffect(() => {
    if (!currentProjectStandard) return;
    setLocalStandard({
      name: currentProjectStandard.name,
      definition: {
        requiredProjectFields: [...currentProjectStandard.definition.requiredProjectFields],
        requiredChecklist: [...currentProjectStandard.definition.requiredChecklist],
        minimumMaturityForPlanning: currentProjectStandard.definition.minimumMaturityForPlanning,
        intakeStages: [...currentProjectStandard.definition.intakeStages],
        targetLabels: { ...currentProjectStandard.definition.targetLabels },
      },
    });
  }, [currentProjectStandard]);

  useEffect(() => {
    if (!currentProjectStandard || !localStandard) {
      setHasStandardChanges(false);
      return;
    }

    setHasStandardChanges(JSON.stringify(localStandard) !== JSON.stringify({
      name: currentProjectStandard.name,
      definition: currentProjectStandard.definition,
    }));
  }, [currentProjectStandard, localStandard]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updatePreferences(localPrefs);
      setHasChanges(false);
      toast({ title: t.settings_toast_saved_title, description: t.settings_toast_saved_desc });
    } catch {
      toast({ title: t.error_title, description: t.settings_toast_error_desc, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null;
  const canManageStandard = workspace?.userRole === 'OWNER' || workspace?.userRole === 'ADMIN';

  const handleToggleField = (value: WorkspaceProjectStandardDefinition['requiredProjectFields'][number]) => {
    setLocalStandard((prev) => {
      if (!prev) return prev;
      const exists = prev.definition.requiredProjectFields.includes(value);
      return {
        ...prev,
        definition: {
          ...prev.definition,
          requiredProjectFields: exists
            ? prev.definition.requiredProjectFields.filter((item) => item !== value)
            : [...prev.definition.requiredProjectFields, value],
        },
      };
    });
  };

  const handleToggleChecklist = (value: WorkspaceProjectStandardDefinition['requiredChecklist'][number]) => {
    setLocalStandard((prev) => {
      if (!prev) return prev;
      const exists = prev.definition.requiredChecklist.includes(value);
      const nextValues = exists
        ? prev.definition.requiredChecklist.filter((item) => item !== value)
        : [...prev.definition.requiredChecklist, value];

      if (nextValues.length === 0) {
        return prev;
      }

      return {
        ...prev,
        definition: {
          ...prev.definition,
          requiredChecklist: nextValues,
        },
      };
    });
  };

  const handleToggleIntakeStage = (value: WorkspaceProjectStandardDefinition['intakeStages'][number]) => {
    setLocalStandard((prev) => {
      if (!prev) return prev;
      const exists = prev.definition.intakeStages.includes(value);
      const nextValues = exists
        ? prev.definition.intakeStages.filter((item) => item !== value)
        : [...prev.definition.intakeStages, value];

      if (nextValues.length === 0) {
        return prev;
      }

      return {
        ...prev,
        definition: {
          ...prev.definition,
          intakeStages: nextValues,
        },
      };
    });
  };

  const handleSaveStandard = async () => {
    if (!activeWorkspaceId || !localStandard) return;

    if (!localStandard.name.trim()) {
      toast({ title: t.error_title, description: 'El estandar necesita un nombre.', variant: 'destructive' });
      return;
    }

    if (localStandard.definition.requiredChecklist.length === 0) {
      toast({ title: t.error_title, description: 'Selecciona al menos una regla de formalizacion.', variant: 'destructive' });
      return;
    }

    if (localStandard.definition.intakeStages.length === 0) {
      toast({ title: t.error_title, description: 'Mantengamos al menos una etapa de intake activa.', variant: 'destructive' });
      return;
    }

    setIsSavingStandard(true);
    try {
      await updateProjectStandard(activeWorkspaceId, {
        name: localStandard.name.trim(),
        definition: localStandard.definition,
      });
      setHasStandardChanges(false);
      toast({ title: 'Estandar actualizado', description: 'La nueva version ya rige el flujo del workspace.' });
    } catch (error: any) {
      toast({ title: t.error_title, description: error?.message || 'No pudimos guardar el estandar.', variant: 'destructive' });
    } finally {
      setIsSavingStandard(false);
    }
  };

  if (isLoading && !preferences) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg }}>
        <Loader2 size={28} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const frequencyOptions = [
    { value: 'realtime', label: t.settings_freq_realtime_label, desc: t.settings_freq_realtime_desc },
    { value: 'daily',    label: t.settings_freq_daily_label,    desc: t.settings_freq_daily_desc },
    { value: 'weekly',   label: t.settings_freq_weekly_label,   desc: t.settings_freq_weekly_desc },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: C.bg }}>
      <div style={{ maxWidth: '1120px', margin: '0 auto', padding: '32px 28px 56px' }}>

        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
              Gobierno del workspace
            </h1>
            <p style={{ fontSize: '13px', color: C.text3, maxWidth: '760px', lineHeight: 1.55 }}>
              {workspace
                ? `${workspace.name} puede definir aquí cómo se formalizan las iniciativas, qué exige el intake y cuándo una idea ya está lista para entrar a operación.`
                : t.settings_subtitle}
            </p>
          </div>

          {hasChanges && (
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '8px 16px', borderRadius: '7px', cursor: isSaving ? 'not-allowed' : 'pointer',
                background: C.accent, color: '#fff', border: 'none',
                fontSize: '13px', fontWeight: 600, opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />{t.btn_saving}</>
                : <><Save size={14} />{t.btn_save_changes}</>
              }
            </button>
          )}
        </div>

        {activeWorkspaceId && localStandard && currentProjectStandard && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(280px, 0.9fr)', gap: '16px', marginBottom: '20px' }}>
            <div style={{ borderRadius: '12px', border: `1px solid ${C.border}`, background: C.bg2, padding: '18px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 700, color: C.text }}>
                    Marco rector: {currentProjectStandard.name}
                  </div>
                  <div style={{ marginTop: '5px', fontSize: '12.5px', color: C.text3, lineHeight: 1.5, maxWidth: '680px' }}>
                    Cada versión publicada cambia la forma en que el workspace recibe, formaliza y compara proyectos. La gracia aquí es mantener un estándar claro sin quitar flexibilidad al equipo.
                  </div>
                </div>

                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: C.accent, background: `${C.accent}14`, border: `1px solid ${C.accent}30`, borderRadius: '999px', padding: '5px 9px' }}>
                    v{currentProjectStandard.version}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: canManageStandard ? C.green : C.amber, background: canManageStandard ? `${C.green}14` : `${C.amber}14`, border: `1px solid ${canManageStandard ? `${C.green}33` : `${C.amber}33`}`, borderRadius: '999px', padding: '5px 9px' }}>
                    {canManageStandard ? 'Puedes publicar cambios' : 'Solo lectura'}
                  </span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: '10px', marginTop: '16px' }}>
                <SummaryMetric label="Version activa" value={`v${currentProjectStandard.version}`} hint="Rige intake, formalizacion y reporting." />
                <SummaryMetric label="Checks" value={String(localStandard.definition.requiredChecklist.length)} hint="Reglas minimas de formalizacion." />
                <SummaryMetric label="Campos" value={String(localStandard.definition.requiredProjectFields.length)} hint="Campos que pesan en cobertura." />
                <SummaryMetric label="Historial" value={String(projectStandardHistory.length)} hint="Versiones almacenadas para trazabilidad." />
              </div>
            </div>

            <div style={{ borderRadius: '12px', border: `1px solid ${C.border}`, background: C.bg2, padding: '18px 20px' }}>
              <div style={{ fontSize: '13px', fontWeight: 700, color: C.text }}>Qué publica una nueva versión</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '14px' }}>
                {[
                  `Intake visible: ${localStandard.definition.intakeStages.join(' / ')}`,
                  `Punto mínimo para planificar: ${MATURITY_OPTIONS.find((item) => item.value === localStandard.definition.minimumMaturityForPlanning)?.label ?? 'Base'}`,
                  `${localStandard.definition.requiredChecklist.length} checks y ${localStandard.definition.requiredProjectFields.length} campos para cobertura`,
                  `Etiquetas operativas: ${localStandard.definition.targetLabels.intake}, ${localStandard.definition.targetLabels.formalized}, ${localStandard.definition.targetLabels.execution}`,
                ].map((item) => (
                  <div key={item} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', color: C.text3, fontSize: '12.5px', lineHeight: 1.5 }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '999px', background: `${C.accent}18`, color: C.accent, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '11px', fontWeight: 700 }}>•</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <SectionCard
          icon={<ShieldCheck size={16} />}
          title="Estandar del workspace"
          desc={workspace ? `Define como ${workspace.name} formaliza y mide proyectos.` : 'Configura el marco rector del workspace activo.'}
        >
          {!activeWorkspaceId ? (
            <p style={{ fontSize: '12.5px', color: C.text3 }}>Selecciona un workspace para editar su estandar operativo.</p>
          ) : !localStandard || !currentProjectStandard ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.text3, fontSize: '12.5px' }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
              Cargando estandar activo...
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '10px',
              }}>
                <div style={{ padding: '12px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ fontSize: '11px', color: C.text3, textTransform: 'uppercase' }}>Version activa</div>
                  <div style={{ marginTop: '6px', fontSize: '16px', fontWeight: 700, color: C.text }}>v{currentProjectStandard.version}</div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ fontSize: '11px', color: C.text3, textTransform: 'uppercase' }}>Cobertura minima</div>
                  <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 600, color: C.text }}>
                    {MATURITY_OPTIONS.find((item) => item.value === localStandard.definition.minimumMaturityForPlanning)?.label}
                  </div>
                </div>
                <div style={{ padding: '12px 14px', borderRadius: '8px', border: `1px solid ${C.border}`, background: C.surface }}>
                  <div style={{ fontSize: '11px', color: C.text3, textTransform: 'uppercase' }}>Etapas de intake</div>
                  <div style={{ marginTop: '6px', fontSize: '13px', fontWeight: 600, color: C.text }}>
                    {localStandard.definition.intakeStages.join(', ')}
                  </div>
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Nombre del estandar
                </label>
                <input
                  type="text"
                  value={localStandard.name}
                  onChange={(e) => setLocalStandard({ ...localStandard, name: e.target.value })}
                  disabled={!canManageStandard || isSavingStandard}
                  maxLength={255}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    borderRadius: '8px',
                    background: C.surface,
                    border: `1px solid ${C.border}`,
                    color: C.text,
                    fontSize: '13px',
                    outline: 'none',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Campos requeridos para cobertura
                </div>
                <OptionGrid
                  options={REQUIRED_FIELD_OPTIONS}
                  selected={localStandard.definition.requiredProjectFields}
                  onToggle={handleToggleField}
                  disabled={!canManageStandard || isSavingStandard}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Checklist de formalizacion
                </div>
                <OptionGrid
                  options={CHECKLIST_OPTIONS}
                  selected={localStandard.definition.requiredChecklist}
                  onToggle={handleToggleChecklist}
                  disabled={!canManageStandard || isSavingStandard}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Madurez minima para planificar
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '10px' }}>
                  {MATURITY_OPTIONS.map((option) => {
                    const isActive = localStandard.definition.minimumMaturityForPlanning === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => canManageStandard && !isSavingStandard && setLocalStandard({
                          ...localStandard,
                          definition: { ...localStandard.definition, minimumMaturityForPlanning: option.value },
                        })}
                        disabled={!canManageStandard || isSavingStandard}
                        style={{
                          minHeight: '74px',
                          padding: '12px 14px',
                          borderRadius: '8px',
                          border: `1px solid ${isActive ? C.accent : C.border2}`,
                          background: isActive ? `${C.accent}14` : C.surface,
                          textAlign: 'left',
                          cursor: !canManageStandard || isSavingStandard ? 'not-allowed' : 'pointer',
                          opacity: !canManageStandard || isSavingStandard ? 0.6 : 1,
                        }}
                      >
                        <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? C.accent : C.text }}>{option.label}</div>
                        <div style={{ fontSize: '11.5px', color: C.text3, marginTop: '4px', lineHeight: 1.4 }}>{option.desc}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Etapas de intake visibles
                </div>
                <OptionGrid
                  options={INTAKE_STAGE_OPTIONS}
                  selected={localStandard.definition.intakeStages}
                  onToggle={handleToggleIntakeStage}
                  disabled={!canManageStandard || isSavingStandard}
                />
              </div>

              <div>
                <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                  Etiquetas operativas
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px' }}>
                  {([
                    ['intake', 'Etiqueta intake'],
                    ['formalized', 'Etiqueta formalizado'],
                    ['execution', 'Etiqueta ejecucion'],
                  ] as const).map(([key, label]) => (
                    <input
                      key={key}
                      type="text"
                      value={localStandard.definition.targetLabels[key]}
                      onChange={(e) => setLocalStandard({
                        ...localStandard,
                        definition: {
                          ...localStandard.definition,
                          targetLabels: {
                            ...localStandard.definition.targetLabels,
                            [key]: e.target.value,
                          },
                        },
                      })}
                      disabled={!canManageStandard || isSavingStandard}
                      placeholder={label}
                      style={{
                        width: '100%',
                        padding: '10px 12px',
                        borderRadius: '8px',
                        background: C.surface,
                        border: `1px solid ${C.border}`,
                        color: C.text,
                        fontSize: '13px',
                        outline: 'none',
                      }}
                    />
                  ))}
                </div>
              </div>

              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
                padding: '12px 14px',
                borderRadius: '8px',
                border: `1px solid ${C.border}`,
                background: C.surface,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: C.text, fontSize: '13px', fontWeight: 600 }}>
                    <Workflow size={14} />
                    Estandar versionado por workspace
                  </div>
                  <div style={{ fontSize: '11.5px', color: C.text3, marginTop: '4px', lineHeight: 1.4 }}>
                    Cada guardado publica una nueva version activa para intake, formalizacion y reporting.
                  </div>
                  {!canManageStandard && (
                    <div style={{ fontSize: '11.5px', color: C.amber, marginTop: '6px' }}>
                      Solo administradores y owners pueden actualizar este marco.
                    </div>
                  )}
                </div>

                {hasStandardChanges && canManageStandard && (
                  <button
                    type="button"
                    onClick={handleSaveStandard}
                    disabled={isSavingStandard}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '9px 14px',
                      borderRadius: '8px',
                      background: C.accent,
                      color: '#fff',
                      border: 'none',
                      cursor: isSavingStandard ? 'not-allowed' : 'pointer',
                      fontSize: '13px',
                      fontWeight: 600,
                      flexShrink: 0,
                      opacity: isSavingStandard ? 0.7 : 1,
                    }}
                  >
                    {isSavingStandard
                      ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />Publicando...</>
                      : <><Save size={14} />Publicar nueva version</>
                    }
                  </button>
                )}
              </div>

              {projectStandardHistory.length > 0 && (
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: C.text3, marginBottom: '8px', textTransform: 'uppercase' }}>
                    Historial de versiones
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {projectStandardHistory.slice(0, 6).map((entry) => (
                      <div
                        key={`${entry.version}-${entry.id ?? 'default'}`}
                        style={{
                          padding: '11px 12px',
                          borderRadius: '8px',
                          border: `1px solid ${entry.isActive ? `${C.accent}44` : C.border}`,
                          background: entry.isActive ? `${C.accent}10` : C.surface,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                          flexWrap: 'wrap',
                        }}
                      >
                        <div>
                          <div style={{ fontSize: '13px', fontWeight: 600, color: entry.isActive ? C.accent : C.text }}>
                            {entry.name} - v{entry.version}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '11.5px', color: C.text3, lineHeight: 1.45 }}>
                            {entry.definition.requiredChecklist.length} checks - {entry.definition.requiredProjectFields.length} campos - intake {entry.definition.intakeStages.join(' / ')}
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontSize: '11px', fontWeight: 700, color: entry.isActive ? C.green : C.text3 }}>
                            {entry.isActive ? 'Activa' : 'Histórica'}
                          </div>
                          <div style={{ marginTop: '4px', fontSize: '11.5px', color: C.text4 }}>
                            {entry.updatedAt ? new Date(entry.updatedAt).toLocaleDateString('es-CL') : 'Base'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </SectionCard>

        {/* Notificaciones */}
        <SectionCard
          icon={<Bell size={16} />}
          title={t.settings_section_notifications}
          desc={t.settings_section_notifications_desc}
        >
          {/* Campana de notificaciones — funcional */}
          <ToggleRow
            label="Campana de notificaciones"
            desc="Muestra el icono de campana en el sidebar con acceso rápido a tus notificaciones."
            checked={localPrefs.inAppNotifications}
            onChange={(v) => setLocalPrefs({ ...localPrefs, inAppNotifications: v })}
          />
          <Divider />

          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '6px',
            padding: '4px 10px', borderRadius: '20px', margin: '16px 0',
            background: `${C.amber}12`, border: `1px solid ${C.amber}30`,
          }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.amber }} />
            <span style={{ fontSize: '11px', color: C.amber, fontWeight: 600 }}>Canales adicionales — próximamente</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '32px', opacity: 0.5, pointerEvents: 'none' }}>
            {/* Canales */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                {t.settings_notifications_channels}
              </p>
              <ToggleRow
                label={t.settings_label_email_notif}
                desc={t.settings_email_notif_desc}
                checked={localPrefs.emailNotifications}
                onChange={(v) => setLocalPrefs({ ...localPrefs, emailNotifications: v })}
                disabled
              />
              <Divider />
              <ToggleRow
                label={t.settings_label_push_notif}
                desc={t.settings_push_notif_desc}
                checked={localPrefs.pushNotifications}
                onChange={(v) => setLocalPrefs({ ...localPrefs, pushNotifications: v })}
                disabled
              />
            </div>

            {/* Frecuencia */}
            <div>
              <p style={{ fontSize: '11px', fontWeight: 700, color: C.text3, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '12px' }}>
                {t.settings_notifications_frequency}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {frequencyOptions.map(({ value, label, desc }) => (
                  <button
                    key={value}
                    onClick={() => setLocalPrefs({ ...localPrefs, notificationFrequency: value as any })}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${localPrefs.notificationFrequency === value ? C.accent : C.border2}`,
                      background: localPrefs.notificationFrequency === value ? `${C.accent}12` : 'transparent',
                    }}
                  >
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: localPrefs.notificationFrequency === value ? C.accent : C.text }}>
                        {label}
                      </p>
                      <p style={{ fontSize: '11.5px', color: C.text3, marginTop: '1px' }}>{desc}</p>
                    </div>
                    {localPrefs.notificationFrequency === value && <Check size={14} color={C.accent} />}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        {/* Botón guardar sticky */}
        {hasChanges && (
          <div style={{ position: 'sticky', bottom: '16px', display: 'flex', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                display: 'flex', alignItems: 'center', gap: '7px',
                padding: '10px 24px', borderRadius: '8px', cursor: isSaving ? 'not-allowed' : 'pointer',
                background: C.accent, color: '#fff', border: 'none',
                fontSize: '13px', fontWeight: 600, opacity: isSaving ? 0.7 : 1,
                boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
              }}
            >
              {isSaving
                ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />{t.btn_saving}</>
                : <><Save size={14} />{t.btn_save_changes}</>
              }
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
