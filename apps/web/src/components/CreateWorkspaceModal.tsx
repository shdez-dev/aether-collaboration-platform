// apps/web/src/components/CreateWorkspaceModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import type { Workspace } from '@/stores/workspaceStore';
import { apiService } from '@/services/apiService';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { C } from '@/lib/colors';
import { getDisplayOrganizationName } from '@/lib/organizationName';

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

type WorkspaceTemplateId = 'personal' | 'team' | 'institutional';
type OrganizationOption = { id: string; name: string; type: string; role: 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER' };

const WORKSPACE_TEMPLATES: Array<{
  id: WorkspaceTemplateId;
  name: string;
  description: string;
  badge: string;
  icon: string;
  color: string;
}> = [
  {
    id: 'team',
    name: 'Espacio de equipo',
    description: 'Configurado para coordinar proyectos, iniciativas y tareas con otras personas.',
    badge: 'Colaborativo',
    icon: 'Users',
    color: '#10b981',
  },
  {
    id: 'personal',
    name: 'Espacio personal',
    description: 'Configurado para organizar tus proyectos y tareas en privado.',
    badge: 'Personal',
    icon: 'Target',
    color: '#3b82f6',
  },
  {
    id: 'institutional',
    name: 'Espacio institucional',
    description: 'Configurado para dar seguimiento a programas, equipos e hitos.',
    badge: 'Institucional',
    icon: 'Building2',
    color: '#f97316',
  },
];

function suggestedTemplateForOrganization(organization?: OrganizationOption): WorkspaceTemplateId {
  if (organization?.type === 'PERSONAL') return 'personal';
  if (organization?.type === 'INSTITUTION') return 'institutional';
  return 'team';
}

interface CreateWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialOrganizationId?: string;
  onCreated?: (workspace: Workspace) => void;
}

export default function CreateWorkspaceModal({ isOpen, onClose, initialOrganizationId, onCreated }: CreateWorkspaceModalProps) {
  const { createWorkspace, isLoading, currentWorkspace } = useWorkspaceStore();

  const [name, setName]               = useState('');
  const [description, setDescription] = useState('');
  const [organizations, setOrganizations] = useState<OrganizationOption[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState('');
  const [organizationsLoading, setOrganizationsLoading] = useState(false);
  const [organizationLoadError, setOrganizationLoadError] = useState('');
  const [organizationLoadAttempt, setOrganizationLoadAttempt] = useState(0);
  const [error, setError]             = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const selectedOrganization = organizations.find((organization) => organization.id === selectedOrganizationId);
  const selectedTemplateId = suggestedTemplateForOrganization(selectedOrganization);
  const selectedTemplate = WORKSPACE_TEMPLATES.find((template) => template.id === selectedTemplateId) ?? WORKSPACE_TEMPLATES[0];

  // ── Animation state ────────────────────────────────────────────────────────
  const [animIn, setAnimIn] = useState(false);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (isOpen) {
      // small rAF delay so the initial state renders before transition kicks in
      const id = requestAnimationFrame(() => setAnimIn(true));
      return () => cancelAnimationFrame(id);
    } else {
      setAnimIn(false);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setOrganizationsLoading(true);
    setOrganizationLoadError('');
    apiService.get<{ organizations: OrganizationOption[] }>('/api/organizations', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data || !Array.isArray(response.data.organizations)) {
          setOrganizations([]);
          setOrganizationLoadError(response.error?.message ?? 'No se pudieron cargar tus organizaciones. Inténtalo de nuevo.');
          return;
        }
        const manageable = response.data.organizations.filter((organization) => organization.role === 'OWNER' || organization.role === 'ADMIN');
        setOrganizations(manageable);
        const preferredOrganizationId = initialOrganizationId ?? currentWorkspace?.organizationId;
        const matchingOrganization = manageable.find((organization) => organization.id === preferredOrganizationId);
        const selectedOrganization = matchingOrganization ?? manageable[0];
        setSelectedOrganizationId(selectedOrganization?.id ?? '');
        if (initialOrganizationId && !matchingOrganization) {
          setOrganizationLoadError('No tienes permisos para crear espacios en esta organización.');
        }
      })
      .catch(() => {
        if (active) {
          setOrganizations([]);
          setOrganizationLoadError('No se pudieron cargar tus organizaciones. Comprueba tu conexión e inténtalo de nuevo.');
        }
      })
      .finally(() => { if (active) setOrganizationsLoading(false); });
    return () => { active = false; };
  }, [isOpen, currentWorkspace?.organizationId, initialOrganizationId, organizationLoadAttempt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!name.trim()) { setNameTouched(true); return; }
    if (organizationsLoading) return;
    if (organizationLoadError) { setError(organizationLoadError); return; }
    if (!selectedOrganizationId) { setError('Selecciona una organización para continuar.'); return; }
    try {
      const workspace = await createWorkspace({
        name: name.trim(),
        description: description.trim() || undefined,
        icon: selectedTemplate.icon,
        color: selectedTemplate.color,
        organizationId: selectedOrganizationId,
        workspaceTemplateId: selectedTemplateId,
      });
      onCreated?.(workspace);
      handleClose();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el espacio de trabajo. Inténtalo de nuevo.');
    }
  };

  const handleClose = () => {
    if (isLoading) return;
    setAnimIn(false);
    closeTimerRef.current = setTimeout(() => {
      setName(''); setDescription(''); setError(''); setNameTouched(false);
      onClose();
    }, 160);
  };

  // clean up timer on unmount
  useEffect(() => () => { if (closeTimerRef.current) clearTimeout(closeTimerRef.current); }, []);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6"
      role="presentation"
      style={{
        background: `rgba(0,0,0,${animIn ? 0.65 : 0})`,
        backdropFilter: 'blur(4px)',
        transition: 'background 0.16s ease',
      }}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-workspace-title"
        aria-describedby="create-workspace-description"
        className="w-full flex flex-col rounded-[16px] overflow-hidden"
        style={{
          maxWidth: '760px',
          maxHeight: 'min(88dvh, 760px)',
          background: C.bg2,
          border: `1px solid ${C.border}`,
          boxShadow: '0 28px 80px rgba(0,0,0,0.52)',
          opacity: animIn ? 1 : 0,
          transform: animIn ? 'scale(1) translateY(0)' : 'scale(0.97) translateY(6px)',
          transition: 'opacity 0.16s ease, transform 0.16s ease',
          fontFamily: MANROPE,
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────── */}
        <div
          className="flex items-start justify-between gap-4 flex-shrink-0"
          style={{ padding: '20px 24px', borderBottom: `1px solid ${C.border}` }}
        >
          <div className="flex min-w-0 items-center gap-3">
            <span
              className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px]"
              style={{ color: C.accent, background: C.hover, border: `1px solid ${C.border}` }}
              aria-hidden="true"
            >
              <WorkspaceIcon icon={selectedTemplate.icon} className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <strong id="create-workspace-title" style={{ display: 'block', fontSize: '16px', fontWeight: 650, color: C.text, fontFamily: SORA, lineHeight: 1.35 }}>
                Crear espacio de trabajo
              </strong>
              <small id="create-workspace-description" style={{ display: 'block', marginTop: 4, color: C.text3, fontSize: '12px', lineHeight: 1.45 }}>
                Elige dónde organizar tus proyectos e iniciativas.
              </small>
            </span>
          </div>
          <button
            onClick={handleClose}
            disabled={isLoading}
            aria-label="Cerrar"
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] transition-colors"
            style={{ color: C.text3, background: 'transparent' }}
            onMouseEnter={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.color = C.text2); }}
            onMouseLeave={(e) => { (e.currentTarget.style.background = 'transparent'); (e.currentTarget.style.color = C.text3); }}
          >
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" width="15" height="15">
              <path d="m3 3 10 10M13 3 3 13" />
            </svg>
          </button>
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto" style={{ padding: '22px 24px 24px' }}>
          <form id="ws-form" onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="workspace-organization" style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
                  Organización
                </label>
                {organizationsLoading ? (
                  <div role="status" style={{ minHeight: 46, display: 'flex', alignItems: 'center', padding: '0 13px', borderRadius: 9, border: `1px solid ${C.border}`, color: C.text3, background: C.surface, fontSize: 12.5 }}>
                    Cargando organizaciones…
                  </div>
                ) : organizationLoadError ? (
                  <div role="alert" style={{ minHeight: 46, display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.red}55`, color: C.red, background: `${C.red}12`, fontSize: 12 }}>
                    <span>{organizationLoadError}</span>
                    <button type="button" onClick={() => setOrganizationLoadAttempt((attempt) => attempt + 1)} style={{ marginLeft: 8, color: C.text, textDecoration: 'underline' }}>
                      Reintentar
                    </button>
                  </div>
                ) : organizations.length > 0 ? (
                  <select
                    id="workspace-organization"
                    value={selectedOrganizationId}
                    onChange={(event) => {
                      setSelectedOrganizationId(event.target.value);
                      setOrganizationLoadError('');
                    }}
                    disabled={isLoading}
                    style={{ boxSizing: 'border-box', width: '100%', height: '46px', borderRadius: '9px', padding: '0 13px', background: C.surface, border: `1px solid ${C.border}`, color: C.text, fontFamily: MANROPE, fontSize: '13px' }}
                  >
                    {organizations.map((organization) => (
                      <option key={organization.id} value={organization.id}>
                        {getDisplayOrganizationName(organization.name)} - {organization.type === 'INSTITUTION' ? 'Institución' : organization.type === 'PERSONAL' ? 'Personal' : 'Organización'}
                      </option>
                    ))}
                  </select>
                ) : (
                  <div style={{ minHeight: 46, display: 'flex', alignItems: 'center', padding: '8px 12px', borderRadius: 9, border: `1px solid ${C.border}`, color: C.text3, background: C.surface, fontSize: 12.5 }}>
                    No tienes organizaciones disponibles. Crea una organización para continuar.
                  </div>
                )}
              </div>

              {(() => {
                const nameError = nameTouched && !name.trim();
                return (
                  <div>
                    <label htmlFor="workspace-name" style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
                      Nombre del espacio de trabajo <span style={{ color: C.red }}>*</span>
                    </label>
                    <input
                      id="workspace-name"
                      type="text"
                      value={name}
                      onChange={(e) => { setName(e.target.value); if (e.target.value.trim()) setNameTouched(false); }}
                      placeholder="Por ejemplo, Mis proyectos"
                      disabled={isLoading || organizationsLoading}
                      maxLength={255}
                      className="w-full rounded-[9px] outline-none transition-colors"
                      style={{
                        boxSizing: 'border-box',
                        height: '46px',
                        padding: '0 13px',
                        background: C.surface,
                        border: `1px solid ${nameError ? C.red : C.border}`,
                        color: C.text,
                        fontSize: '13px',
                        fontFamily: MANROPE,
                      }}
                      onFocus={(e) => (e.currentTarget.style.borderColor = nameError ? C.red : C.accent)}
                      onBlur={(e) => { setNameTouched(true); e.currentTarget.style.borderColor = !e.currentTarget.value.trim() ? C.red : C.border; }}
                    />
                    {nameError && (
                      <p className="text-[11.5px] mt-1.5" style={{ color: C.red }}>
                        El nombre es obligatorio.
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>

            <div style={{ marginTop: 20 }}>
              <p style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, margin: '0 0 8px' }}>
                Estructura del espacio
              </p>
              <div
                aria-live="polite"
                className="flex items-center gap-3 rounded-[11px]"
                style={{ minHeight: 76, padding: '14px 16px', background: `${selectedTemplate.color}0b`, border: `1px solid ${selectedTemplate.color}40` }}
              >
                <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-[11px]" style={{ color: selectedTemplate.color, background: `${selectedTemplate.color}1b` }} aria-hidden="true">
                  <WorkspaceIcon icon={selectedTemplate.icon} className="h-[18px] w-[18px]" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong style={{ display: 'block', color: C.text, fontFamily: SORA, fontSize: 13, lineHeight: 1.4 }}>
                    {selectedTemplate.name}
                  </strong>
                  <small style={{ display: 'block', marginTop: 3, color: C.text3, fontSize: 12, lineHeight: 1.5 }}>
                    {selectedOrganization ? selectedTemplate.description : 'El tipo se define automáticamente según la organización seleccionada.'}
                  </small>
                </span>
                <span className="hidden rounded-full px-2.5 py-1 sm:inline-flex" style={{ flexShrink: 0, color: selectedTemplate.color, background: `${selectedTemplate.color}14`, fontSize: 10.5, fontWeight: 750 }}>
                  {selectedTemplate.badge}
                </span>
              </div>
            </div>

            {/* ── Descripción ──────────────────────────────────────────── */}
            <div style={{ marginTop: 20 }}>
              <label htmlFor="workspace-description" style={{ display: 'block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', fontFamily: SORA, color: C.text2, marginBottom: '8px' }}>
                Descripción (opcional)
              </label>
              <textarea
                id="workspace-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="¿Qué quieres organizar en este espacio?"
                disabled={isLoading || organizationsLoading}
                maxLength={1000}
                rows={3}
                className="w-full rounded-[9px] outline-none transition-colors resize-y"
                style={{
                  boxSizing: 'border-box',
                  minHeight: '86px',
                  padding: '11px 13px',
                  background: C.surface,
                  border: `1px solid ${C.border}`,
                  color: C.text,
                  fontSize: '13px',
                  fontFamily: MANROPE,
                }}
                onFocus={(e) => (e.currentTarget.style.borderColor = C.accent)}
                onBlur={(e)  => (e.currentTarget.style.borderColor = C.border)}
              />
              <p style={{ margin: '6px 0 0', color: C.text4, fontSize: 11, lineHeight: 1.4 }}>
                Opcional - máximo 1000 caracteres
              </p>
            </div>

            {/* ── Error ────────────────────────────────────────────────── */}
            {error && (
              <div
                className="rounded-[7px] text-[12.5px] mt-3"
                style={{ padding: '8px 12px', background: `${C.red}15`, border: `1px solid ${C.red}40`, color: C.red }}
              >
                {error}
              </div>
            )}
          </form>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          className="flex-shrink-0"
          style={{ padding: '14px 24px 18px', borderTop: `1px solid ${C.border}`, background: C.bg }}
        >
          <p style={{ fontSize: '12px', margin: '0 0 12px', color: C.text3, fontFamily: MANROPE }}>
            {selectedOrganization?.type === 'PERSONAL'
              ? 'Este espacio quedará dentro de tu organización personal.'
              : 'Podrás invitar a miembros una vez creado.'}
          </p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={handleClose}
              disabled={isLoading}
              className="w-full sm:w-auto"
              style={{
                minWidth: '112px', padding: '10px 16px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 500, fontFamily: MANROPE,
                background: C.hover, border: `1px solid ${C.border2}`, color: C.text2,
                cursor: 'pointer', transition: 'all 0.12s',
              }}
              onMouseEnter={(e) => { (e.currentTarget.style.background = 'color-mix(in srgb, var(--c-accent) 12%, var(--c-surface))'); (e.currentTarget.style.borderColor = C.accent); (e.currentTarget.style.color = C.text); }}
              onMouseLeave={(e) => { (e.currentTarget.style.background = C.hover); (e.currentTarget.style.borderColor = C.border2); (e.currentTarget.style.color = C.text2); }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              form="ws-form"
              disabled={isLoading || organizationsLoading || Boolean(organizationLoadError) || organizations.length === 0}
              className="w-full sm:w-auto"
              style={{
                minWidth: '230px', padding: '10px 18px', borderRadius: '8px',
                fontSize: '13px', fontWeight: 600, fontFamily: SORA,
                background: C.accent, border: 'none', color: '#fff',
                cursor: isLoading || organizationsLoading || Boolean(organizationLoadError) || organizations.length === 0 ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                transition: 'background 0.12s',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'color-mix(in srgb, var(--c-accent) 82%, #271637)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.accent)}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
                  </svg>
                  Creando espacio…
                </>
              ) : (
                <>Crear espacio de trabajo</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
