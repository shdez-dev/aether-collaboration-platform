'use client';

import { useEffect, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CircleDollarSign,
  Landmark,
  Layers3,
  LoaderCircle,
  Network,
  UserRound,
  UsersRound,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

type OrganizationType = 'PERSONAL' | 'COMPANY' | 'INSTITUTION' | 'NETWORK_OPERATOR';
type NewOrganizationType = Exclude<OrganizationType, 'PERSONAL'>;
type PlanCode = 'FREE' | 'TEAMS' | 'PORTFOLIO' | 'INSTITUTIONAL' | 'NETWORK';
type PlanCapability = number | boolean;
type BillingPlan = {
  code: PlanCode;
  name: string;
  capabilities: Record<string, PlanCapability>;
};
type CreatedOrganization = { id: string; name: string; type: OrganizationType; subscription?: { planCode: PlanCode; status: string } | null };

const ORGANIZATION_TYPES: Array<{ id: NewOrganizationType; label: string; description: string; icon: LucideIcon }> = [
  { id: 'COMPANY', label: 'Equipo o empresa', description: 'Coordina el trabajo y los espacios de un equipo.', icon: Building2 },
  { id: 'INSTITUTION', label: 'Institución', description: 'Organiza programas y colaboración institucional.', icon: Landmark },
  { id: 'NETWORK_OPERATOR', label: 'Red de colaboración', description: 'Conecta equipos y organizaciones.', icon: Network },
];

const ORGANIZATION_PLAN_CODES: Record<NewOrganizationType, PlanCode[]> = {
  COMPANY: ['TEAMS', 'PORTFOLIO'],
  INSTITUTION: ['INSTITUTIONAL'],
  NETWORK_OPERATOR: ['NETWORK'],
};

const PLAN_DETAILS: Record<Exclude<PlanCode, 'FREE'>, { label: string; fit: string; description: string }> = {
  TEAMS: {
    label: 'Teams',
    fit: 'Para equipos y empresas',
    description: 'Espacios compartidos, roles avanzados y capacidad para colaborar en equipo.',
  },
  PORTFOLIO: {
    label: 'Portfolio',
    fit: 'Para coordinar varios proyectos',
    description: 'Añade portafolios y analíticas para dar seguimiento a distintos proyectos.',
  },
  INSTITUTIONAL: {
    label: 'Institucional',
    fit: 'Para instituciones',
    description: 'Habilita contexto institucional, recepción de iniciativas y analíticas.',
  },
  NETWORK: {
    label: 'Network',
    fit: 'Para redes de organizaciones',
    description: 'Incluye programas de red para coordinar equipos y organizaciones.',
  },
};

const FEATURE_LABELS: Record<string, string> = {
  advanced_roles: 'Roles avanzados',
  portfolio: 'Portafolios',
  analytics: 'Analíticas',
  institutional_context: 'Contexto institucional',
  intake: 'Recepción de iniciativas',
  network_programs: 'Programas de red',
};

type CreateOrganizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (organization: CreatedOrganization) => void;
};

function formatStorage(value: number) {
  if (value >= 1_000_000) return `${value / 1_000_000} TB`;
  if (value >= 1_000) return `${value / 1_000} GB`;
  return `${value} MB`;
}

function getOrganizationLabel(type: OrganizationType) {
  if (type === 'INSTITUTION') return 'institución';
  if (type === 'NETWORK_OPERATOR') return 'red de colaboración';
  return 'equipo o empresa';
}

function getPlanFacts(plan: BillingPlan) {
  const capabilities = plan.capabilities;
  const facts: string[] = [];
  if (typeof capabilities.workspaces === 'number') facts.push(`${capabilities.workspaces} espacios`);
  if (typeof capabilities.members === 'number') facts.push(`${capabilities.members} miembros`);
  if (typeof capabilities.storage_mb === 'number') facts.push(formatStorage(capabilities.storage_mb));
  return facts;
}

export default function CreateOrganizationModal({ isOpen, onClose, onCreated }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<NewOrganizationType | null>(null);
  const [step, setStep] = useState<'organization' | 'plans'>('organization');
  const [createdOrganization, setCreatedOrganization] = useState<CreatedOrganization | null>(null);
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [busy, setBusy] = useState(false);
  const [plansLoading, setPlansLoading] = useState(false);
  const [creationPermissions, setCreationPermissions] = useState<NewOrganizationType[]>([]);
  const [permissionsLoading, setPermissionsLoading] = useState(false);
  const [permissionsError, setPermissionsError] = useState('');
  const [error, setError] = useState('');

  function finishCreatedOrganization() {
    if (!createdOrganization) return;
    onCreated(createdOrganization);
    setCreatedOrganization(null);
    onClose();
  }

  function dismiss() {
    if (busy) return;
    if (createdOrganization) {
      finishCreatedOrganization();
      return;
    }
    onClose();
  }

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setType(null);
      setStep('organization');
      setCreatedOrganization(null);
      setPlans([]);
      setCreationPermissions([]);
      setPermissionsError('');
      setError('');
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, createdOrganization, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    setPermissionsLoading(true);
    setPermissionsError('');
    void apiService.get<{ types: NewOrganizationType[] }>('/api/organizations/creation-permissions', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data?.types) {
          setCreationPermissions([]);
          setPermissionsError(response.error?.message ?? 'No pudimos verificar los permisos especiales. Aún puedes crear equipos de trabajo.');
          return;
        }
        setCreationPermissions(response.data.types);
      })
      .catch(() => {
        if (!active) return;
        setCreationPermissions([]);
        setPermissionsError('No pudimos verificar los permisos especiales. Aún puedes crear equipos de trabajo; inténtalo más tarde para crear instituciones o redes.');
      })
      .finally(() => { if (active) setPermissionsLoading(false); });
    return () => { active = false; };
  }, [isOpen]);

  if (!isOpen) return null;

  async function handleUsePersonalOrganization() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.get<{ organizations: CreatedOrganization[] }>('/api/organizations', true);
      if (!response.success || !response.data?.organizations) {
        throw new Error(response.error?.message ?? 'No se pudo cargar tu organización personal. Inténtalo de nuevo.');
      }
      const personalOrganization = response.data.organizations.find((organization) => organization.type === 'PERSONAL');
      if (!personalOrganization) {
        throw new Error('No encontramos una organización personal asociada a tu cuenta. Actualiza la página e inténtalo de nuevo.');
      }
      onCreated(personalOrganization);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo abrir tu organización personal. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  async function loadPlanCatalog() {
    setPlansLoading(true);
    try {
      const response = await apiService.get<{ plans: BillingPlan[] }>('/api/billing/catalog', true);
      if (!response.success || !response.data?.plans) {
        throw new Error(response.error?.message ?? 'No se pudieron cargar los planes.');
      }
      setPlans(response.data.plans);
      setError('');
    } catch {
      setError('No pudimos cargar las opciones de plan. Puedes continuar con el acceso actual de tu organización.');
    } finally {
      setPlansLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationName = name.trim();
    if (organizationName.length < 2 || busy || !type) return;
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post<{ organization: CreatedOrganization }>(
        '/api/organizations',
        { name: organizationName, type },
        true,
      );
      if (!response.success || !response.data?.organization?.id) {
        throw new Error(response.error?.message ?? 'No se pudo crear la organización. Inténtalo de nuevo.');
      }
      setCreatedOrganization(response.data.organization);
      setStep('plans');
      void loadPlanCatalog();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la organización. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  const availablePlanCodes = createdOrganization
    ? ORGANIZATION_PLAN_CODES[createdOrganization.type as NewOrganizationType] ?? []
    : [];
  const availablePlans = plans.filter((plan) => availablePlanCodes.includes(plan.code));
  const activePlanCode = createdOrganization?.subscription?.planCode ?? 'FREE';
  const activePlanLabel = activePlanCode === 'FREE' ? 'Free' : PLAN_DETAILS[activePlanCode]?.label ?? activePlanCode;
  const canCreateOrganization = !busy && Boolean(type) && name.trim().length >= 2;

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, var(--c-bg) 82%, transparent)', backdropFilter: 'blur(7px)' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget) dismiss(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-organization-title"
        className="flex w-full flex-col overflow-hidden rounded-[18px]"
        style={{
          maxWidth: step === 'plans' ? 760 : 680,
          maxHeight: 'calc(100dvh - 32px)',
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          boxShadow: '0 28px 90px rgba(0,0,0,.58)',
          fontFamily: "'Manrope', system-ui, sans-serif",
          color: C.text,
        }}
      >
        <header className="flex flex-shrink-0 items-start gap-4" style={{ padding: '23px 26px 20px', borderBottom: `1px solid ${C.border}`, background: `radial-gradient(ellipse at top left, ${C.accent}15, transparent 68%)` }}>
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-[13px]" style={{ color: C.accent, background: `${C.accent}1c`, border: `1px solid ${C.accent}40` }} aria-hidden="true">
            {step === 'plans' ? <CircleDollarSign size={21} strokeWidth={1.8} /> : <Building2 size={21} strokeWidth={1.8} />}
          </span>
          <div className="min-w-0 flex-1">
            <p style={{ margin: '1px 0 6px', color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '.14em', textTransform: 'uppercase' }}>
              {step === 'plans' ? 'Organización creada' : 'Nueva organización'}
            </p>
            <h2 id="create-organization-title" style={{ margin: 0, fontSize: 22, lineHeight: 1.2, fontWeight: 750, letterSpacing: '-.04em' }}>
              {step === 'plans' ? 'Tu organización está lista' : 'Crea una organización'}
            </h2>
            <p style={{ margin: '7px 0 0', maxWidth: 550, color: C.text3, fontSize: 12.5, lineHeight: 1.55 }}>
              {step === 'plans'
                ? `El acceso ${activePlanLabel} pertenece a ${createdOrganization?.name ?? 'esta organización'}; el plan personal de sus miembros no cambia.`
                : 'Define la organización que compartirá espacios de trabajo, proyectos e iniciativas.'}
            </p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={busy} onClick={dismiss} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] transition-colors" style={{ color: C.text3, background: 'transparent' }}>
            <X size={18} />
          </button>
        </header>

        {step === 'organization' ? (
          <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '21px 26px 22px' }}>
              <label htmlFor="organization-name" style={{ display: 'block', marginBottom: 8, color: C.text2, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                Nombre de la organización
              </label>
              <input
                id="organization-name"
                autoFocus
                required
                minLength={2}
                maxLength={255}
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Por ejemplo, Equipo Aurora"
                disabled={busy}
                className="w-full rounded-[10px] outline-none transition-colors"
                style={{ height: 46, padding: '0 14px', color: C.text, background: C.surface, border: `1px solid ${C.border2}`, fontSize: 13, fontFamily: 'inherit' }}
                onFocus={(event) => { event.currentTarget.style.borderColor = `${C.accent}aa`; event.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}18`; }}
                onBlur={(event) => { event.currentTarget.style.borderColor = C.border2; event.currentTarget.style.boxShadow = 'none'; }}
              />

              <fieldset style={{ margin: '21px 0 0', padding: 0, border: 0 }}>
                <legend style={{ marginBottom: 4, color: C.text2, fontSize: 10.5, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  Tipo de organización
                </legend>
                <p style={{ margin: '0 0 11px', color: C.text4, fontSize: 11.5, lineHeight: 1.45 }}>
                  Puedes crear equipos de trabajo directamente. Las instituciones y redes requieren autorización administrativa.
                </p>
                <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                  {ORGANIZATION_TYPES.map((option) => {
                    const Icon = option.icon;
                    const permitted = option.id === 'COMPANY' || creationPermissions.includes(option.id);
                    const selected = type === option.id;
                    return (
                      <button
                        key={option.id}
                        type="button"
                        aria-pressed={selected}
                        aria-disabled={!permitted || (option.id !== 'COMPANY' && permissionsLoading)}
                        disabled={!permitted || (option.id !== 'COMPANY' && permissionsLoading) || busy}
                        onClick={() => setType(option.id)}
                        className="flex min-h-[128px] flex-col items-start rounded-[12px] p-3.5 text-left transition-colors duration-200 ease-out motion-reduce:transition-none"
                        style={{
                          border: `1px solid ${selected ? C.accent : C.border}`,
                          backgroundColor: selected ? `${C.accent}0c` : C.bg,
                          color: permitted ? C.text2 : C.text3,
                          cursor: permitted ? 'pointer' : 'not-allowed',
                        }}
                      >
                        <span className="mb-3 flex h-8 w-8 items-center justify-center rounded-[9px]" style={{ color: permitted ? C.accent : C.text3, background: C.hover, border: `1px solid ${C.border}` }} aria-hidden="true">
                          <Icon size={16} strokeWidth={1.8} />
                        </span>
                        <span className="flex w-full items-center justify-between gap-2">
                          <strong style={{ fontSize: 11.5, lineHeight: 1.3, fontWeight: 750 }}>{option.label}</strong>
                          <span className="rounded-full px-1.5 py-1" style={{ flexShrink: 0, color: permitted ? C.accent : C.text3, background: C.hover, fontSize: 8.5, lineHeight: 1, fontWeight: 800 }}>{option.id === 'COMPANY' ? 'Disponible' : permissionsLoading ? 'Cargando' : permitted ? 'Disponible' : 'No habilitado'}</span>
                        </span>
                        <small style={{ marginTop: 5, color: C.text3, fontSize: 10.5, lineHeight: 1.45 }}>{option.description}</small>
                      </button>
                    );
                  })}
                </div>
              </fieldset>
              {permissionsError ? <p role="alert" style={{ margin: '10px 0 0', color: C.red, fontSize: 11.5, lineHeight: 1.5 }}>{permissionsError}</p> : null}

              <div className="mt-4 flex flex-col gap-3 rounded-[11px] sm:flex-row sm:items-center sm:justify-between" style={{ padding: '12px 13px', background: `${C.accent}0b`, border: `1px solid ${C.accent}24` }}>
                <div className="flex items-start gap-2.5">
                  <UserRound size={17} style={{ flexShrink: 0, marginTop: 1, color: C.accent }} aria-hidden="true" />
                  <p style={{ margin: 0, color: C.text3, fontSize: 11.5, lineHeight: 1.5 }}>
                    ¿Trabajarás solo? Tu espacio personal ya existe y conserva el plan Free.
                  </p>
                </div>
                <button type="button" onClick={() => void handleUsePersonalOrganization()} disabled={busy} className="flex flex-shrink-0 items-center gap-1.5 self-start rounded-[8px] px-2 py-1.5 text-left sm:self-auto" style={{ color: C.accent, background: 'transparent', fontSize: 11, fontWeight: 800 }}>
                  {busy ? <LoaderCircle size={14} className="animate-spin" /> : null}
                  Usar espacio personal <ArrowRight size={14} />
                </button>
              </div>

              {error ? <p role="alert" style={{ margin: '13px 0 0', color: C.red, fontSize: 12, lineHeight: 1.5 }}>{error}</p> : null}
            </div>

            <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3" style={{ padding: '14px 26px 17px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
              <p style={{ margin: 0, maxWidth: 300, color: C.text4, fontSize: 10.5, lineHeight: 1.5 }}>
                Las personas invitadas usarán las capacidades del plan de esta organización.
              </p>
              <div className="ml-auto flex items-center gap-2">
                <button type="button" onClick={dismiss} disabled={busy} className="rounded-[9px]" style={{ minWidth: 94, padding: '9px 13px', color: C.text2, border: `1px solid ${C.border2}`, background: C.hover, fontSize: 11.5, fontWeight: 700 }}>
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={!canCreateOrganization}
                  className="flex items-center justify-center gap-2 rounded-[9px] transition-colors duration-200 ease-out motion-reduce:transition-none"
                  style={{
                    minWidth: 190,
                    padding: '10px 14px',
                    color: canCreateOrganization ? 'hsl(var(--primary-foreground))' : C.text3,
                    border: canCreateOrganization ? `1px solid ${C.accent}` : `1px solid ${C.border}`,
                    background: canCreateOrganization ? C.accent : C.hover,
                    cursor: canCreateOrganization ? 'pointer' : 'not-allowed',
                    fontSize: 11.5,
                    fontWeight: 800,
                  }}
                >
                  {busy ? <><LoaderCircle size={15} className="animate-spin" /> Creando organización…</> : 'Crear organización'}
                </button>
              </div>
            </footer>
          </form>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto" style={{ padding: '19px 26px 21px' }}>
              <div className="flex items-start gap-3 rounded-[11px]" style={{ padding: '12px 14px', background: `${C.accent}0b`, border: `1px solid ${C.accent}28` }}>
                <BadgeCheck size={18} style={{ flexShrink: 0, marginTop: 1, color: C.accent }} aria-hidden="true" />
                <div>
                  <strong style={{ display: 'block', marginBottom: 3, fontSize: 11.5, fontWeight: 800 }}>Acceso actual: {activePlanLabel}</strong>
                  <p style={{ margin: 0, color: C.text3, fontSize: 11.5, lineHeight: 1.5 }}>
                    {activePlanCode === 'INSTITUTIONAL'
                      ? 'Ya puedes crear espacios institucionales. El acceso fue habilitado por administración, sin cobro; tu plan personal no cambia.'
                      : activePlanCode === 'TEAMS'
                        ? 'Teams queda habilitado para tu organización durante este piloto: hasta 15 miembros y 10 GB compartidos, sin activar cobros. Tu plan personal no cambia.'
                      : 'Tu organización comienza con acceso Free. Revisar las opciones siguientes no activa un plan ni genera cobros.'}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3">
                <div>
                  <h3 style={{ margin: 0, fontSize: 15, lineHeight: 1.3, fontWeight: 800 }}>Opciones para {getOrganizationLabel(createdOrganization?.type ?? 'COMPANY')}</h3>
                  <p style={{ margin: '4px 0 0', color: C.text4, fontSize: 11.5, lineHeight: 1.45 }}>Planes informativos; todavía no se pueden seleccionar ni contratar.</p>
                </div>
                {plansLoading ? <LoaderCircle size={17} className="animate-spin" style={{ flexShrink: 0, color: C.accent }} aria-label="Cargando planes" /> : null}
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2.5">
                {availablePlans.map((plan, index) => {
                  const details = PLAN_DETAILS[plan.code as Exclude<PlanCode, 'FREE'>];
                  if (!details) return null;
                  const facts = getPlanFacts(plan);
                  const features = Object.entries(FEATURE_LABELS)
                    .filter(([capability]) => plan.capabilities[capability] === true)
                    .map(([, label]) => label);
                  return (
                    <button
                      key={plan.code}
                      type="button"
                      aria-disabled="true"
                      disabled
                      className="w-full cursor-not-allowed rounded-[11px] text-left"
                      style={{ padding: '13px 14px', background: C.surface, border: `1px solid ${C.border}`, color: C.text2 }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 800 }}>{details.label}</h4>
                            <span className="rounded-full px-2 py-1" style={{ color: plan.code === activePlanCode ? C.accent : C.text3, background: C.bg, fontSize: 9, fontWeight: 800 }}>{plan.code === activePlanCode ? 'Activo' : 'No disponible'}</span>
                          </div>
                          <p style={{ margin: '4px 0 0', color: C.text4, fontSize: 10.5, fontWeight: 700 }}>{details.fit}</p>
                        </div>
                      </div>
                      <p style={{ margin: '8px 0 9px', color: C.text3, fontSize: 11, lineHeight: 1.5 }}>{details.description}</p>
                      <div className="flex flex-wrap gap-1.5">
                        {facts.map((fact) => <span key={fact} className="rounded-full px-2 py-1" style={{ color: C.text2, background: C.bg, border: `1px solid ${C.border}`, fontSize: 9.5, fontWeight: 700 }}>{fact}</span>)}
                      </div>
                      {features.length ? <p style={{ margin: '8px 0 0', color: C.text4, fontSize: 10, lineHeight: 1.45 }}>{features.join(' — ')}</p> : null}
                    </button>
                  );
                })}
              </div>

              {!plansLoading && availablePlans.length === 0 ? (
                <div role="status" className="rounded-[10px]" style={{ marginTop: 12, padding: '12px 13px', color: C.text3, background: C.surface, border: `1px solid ${C.border}`, fontSize: 11.5, lineHeight: 1.5 }}>
                  No pudimos cargar las opciones ahora. Puedes continuar con el acceso {activePlanLabel}.
                  <button type="button" onClick={() => void loadPlanCatalog()} className="ml-1 underline underline-offset-2" style={{ color: C.accent, fontWeight: 800 }}>Reintentar</button>
                </div>
              ) : null}

              <p className="mt-3 flex items-start gap-2" style={{ marginBottom: 0, color: C.text4, fontSize: 10.5, lineHeight: 1.45 }}>
                <UsersRound size={14} style={{ flexShrink: 0, marginTop: 1, color: C.text3 }} aria-hidden="true" />
                <span>El plan lo administra el propietario o un administrador de facturación. Cada miembro mantiene su propio plan personal fuera de esta organización.</span>
              </p>
              {error && plansLoading ? <p role="status" style={{ margin: '10px 0 0', color: C.text4, fontSize: 10.5 }}>{error}</p> : null}
            </div>

            <footer className="flex flex-shrink-0 flex-wrap items-center justify-between gap-3" style={{ padding: '14px 26px 17px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
              <p style={{ margin: 0, maxWidth: 340, color: C.text4, fontSize: 10.5, lineHeight: 1.5 }}>
                La contratación se habilitará desde la administración de la organización.
              </p>
              <button type="button" onClick={finishCreatedOrganization} className="flex items-center justify-center gap-2 rounded-[9px]" style={{ minWidth: 204, padding: '10px 14px', color: 'hsl(var(--primary-foreground))', border: 0, background: C.accent, fontSize: 11.5, fontWeight: 800 }}>
                Ir a la organización <ArrowRight size={15} />
              </button>
            </footer>
          </div>
        )}
      </section>
    </div>
  );
}
