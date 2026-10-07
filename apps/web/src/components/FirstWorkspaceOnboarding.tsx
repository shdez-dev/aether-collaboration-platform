'use client';

import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, MotionConfig, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Building2, Check, KeyRound, Layers3, LoaderCircle, Sparkles } from 'lucide-react';
import type { OrganizationSummary } from '@aether/types';
import { apiService } from '@/services/apiService';
import { getDisplayOrganizationName } from '@/lib/organizationName';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import styles from './FirstWorkspaceOnboarding.module.css';

type Organization = Pick<OrganizationSummary, 'id' | 'name' | 'type' | 'role'>;
type Step = 'choose' | 'create-organization' | 'join' | 'workspace' | 'waiting';
type OrganizationType = 'COMPANY' | 'INSTITUTION' | 'NETWORK_OPERATOR';

const organizationTypes: Array<{ value: OrganizationType; title: string; description: string }> = [
  { value: 'COMPANY', title: 'Equipo o empresa', description: 'Coordina el trabajo y las decisiones de tu equipo.' },
  { value: 'INSTITUTION', title: 'Institución', description: 'Da estructura a una colaboración institucional.' },
  { value: 'NETWORK_OPERATOR', title: 'Red u operador', description: 'Organiza una red de equipos y sus espacios.' },
];

function invitationToken(value: string): string {
  const trimmed = value.trim();
  try {
    const parsed = new URL(trimmed);
    return parsed.searchParams.get('token') ?? trimmed;
  } catch {
    return trimmed;
  }
}

export default function FirstWorkspaceOnboarding({
  onWorkspaceCreated,
}: {
  onWorkspaceCreated: (workspaceId: string) => void;
}) {
  const router = useRouter();
  const createWorkspace = useWorkspaceStore((state) => state.createWorkspace);
  const setActiveWorkspaceId = useActiveWorkspaceStore((state) => state.setActiveWorkspaceId);
  const [step, setStep] = useState<Step>('choose');
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null);
  const [organizationsLoading, setOrganizationsLoading] = useState(true);
  const [organizationName, setOrganizationName] = useState('');
  const [organizationType, setOrganizationType] = useState<OrganizationType>('COMPANY');
  const [inviteCode, setInviteCode] = useState('');
  const [workspaceName, setWorkspaceName] = useState('');
  const [workspaceDescription, setWorkspaceDescription] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const personalOrganization = useMemo(
    () => organizations.find((organization) => organization.type === 'PERSONAL') ?? null,
    [organizations],
  );

  const loadOrganizations = async () => {
    setOrganizationsLoading(true);
    try {
      const response = await apiService.get<{ organizations: Organization[] }>('/api/organizations', true);
      if (!response.success || !response.data) {
        throw new Error(response.error?.message ?? 'No se pudieron cargar tus organizaciones.');
      }
      setOrganizations(response.data.organizations);
      return response.data.organizations;
    } finally {
      setOrganizationsLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    apiService.get<{ organizations: Organization[] }>('/api/organizations', true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) {
          setError(response.error?.message ?? 'No se pudieron cargar tus organizaciones.');
          return;
        }
        setOrganizations(response.data.organizations);
      })
      .catch(() => {
        if (active) setError('No se pudieron cargar tus organizaciones. Comprueba la conexión e inténtalo de nuevo.');
      })
      .finally(() => {
        if (active) setOrganizationsLoading(false);
      });
    return () => { active = false; };
  }, []);

  const beginWorkspace = (organization: Organization) => {
    setSelectedOrganization(organization);
    setWorkspaceName('');
    setError('');
    setNotice('');
    setStep('workspace');
  };

  const createOrganization = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      const response = await apiService.post<{ organization: Organization }>(
        '/api/organizations',
        { name: organizationName.trim(), type: organizationType },
        true,
      );
      if (!response.success || !response.data?.organization) {
        throw new Error(response.error?.message ?? 'No fue posible crear la organización.');
      }
      const organization = response.data.organization;
      setOrganizations((current) => [...current, organization]);
      setSelectedOrganization(organization);
      setWorkspaceName('');
      setStep('workspace');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear la organización.');
    } finally {
      setBusy(false);
    }
  };

  const acceptInvitation = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const token = invitationToken(inviteCode);
      const response = await apiService.post<{ message: string; organizationId: string }>(
        `/api/organizations/invitations/${encodeURIComponent(token)}/accept`,
        {},
        true,
      );
      if (!response.success || !response.data?.organizationId) {
        throw new Error(response.error?.message ?? 'No fue posible aceptar la invitación.');
      }
      const updatedOrganizations = await loadOrganizations();
      const joined = updatedOrganizations.find((organization) => organization.id === response.data?.organizationId);
      if (!joined) throw new Error('La invitación se aceptó, pero no pudimos cargar la organización. Actualiza e inténtalo de nuevo.');
      if (joined.role === 'OWNER' || joined.role === 'ADMIN') {
        setSelectedOrganization(joined);
        setStep('workspace');
      } else {
        setSelectedOrganization(joined);
        setStep('waiting');
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible aceptar la invitación.');
    } finally {
      setBusy(false);
    }
  };

  const submitWorkspace = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedOrganization) return;
    setBusy(true);
    setError('');
    try {
      const workspace = await createWorkspace({
        name: workspaceName.trim(),
        description: workspaceDescription.trim() || undefined,
        icon: 'briefcase',
        color: '#F2571E',
        organizationId: selectedOrganization.id,
        workspaceTemplateId: selectedOrganization.type === 'PERSONAL' ? 'personal' : 'team',
      });
      setActiveWorkspaceId(workspace.id);
      onWorkspaceCreated(workspace.id);
      router.replace('/dashboard');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No fue posible crear tu primer espacio.');
    } finally {
      setBusy(false);
    }
  };

  const goBack = () => {
    setError('');
    setNotice('');
    setStep('choose');
  };

  return (
    <MotionConfig reducedMotion="user">
      <main className={styles.shell}>
        <motion.header
          className={styles.header}
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.48, ease: [0.22, 1, 0.36, 1] }}
        >
          <a className={styles.brand} href="/dashboard" aria-label="Aether">
            <span className={styles.brandMark}><Layers3 size={19} strokeWidth={2.2} /></span>
            <span>Aether</span>
          </a>
          <span className={styles.headerNote}>PRIMEROS PASOS</span>
        </motion.header>

      <motion.section
        className={styles.content}
        aria-labelledby="setup-title"
        layout
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.56, ease: [0.22, 1, 0.36, 1], layout: { duration: 0.38, ease: [0.22, 1, 0.36, 1] } }}
      >
        <motion.div className={styles.intro} layout>
          <span className={styles.eyebrow}><Sparkles size={14} /> TU ESPACIO EMPIEZA AQUÍ</span>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 7, filter: 'blur(3px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -5, filter: 'blur(2px)' }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              <h1 id="setup-title" aria-live="polite">
                {step === 'choose' ? '¿Cómo quieres empezar?' :
                  step === 'create-organization' ? 'Crea tu organización.' :
                    step === 'join' ? 'Conecta con tu equipo.' :
                      step === 'waiting' ? 'Ya estás dentro.' : 'Ahora, crea tu primer espacio.'}
              </h1>
              <p>
                {step === 'choose' ? 'Primero elige dónde vivirá tu trabajo. Después podrás invitar a tu equipo y empezar a organizarlo.' :
                  step === 'create-organization' ? 'Define el espacio de tu equipo. El primer workspace quedará listo para trabajar enseguida.' :
                    step === 'join' ? 'Pega el enlace o código de invitación que recibiste para unirte a una organización.' :
                      step === 'waiting' ? `${selectedOrganization?.name ?? 'La organización'} ya forma parte de tu cuenta. Quien la administra debe asignarte acceso a un workspace.` :
                        `Este será el espacio de trabajo de ${selectedOrganization?.name ?? 'tu organización'}.`}
              </p>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <motion.div className={styles.progress} layout aria-label={`Paso ${step === 'choose' ? 1 : 2} de 2`}>
          <span className={styles.progressActive}>01 <i /> ORGANIZACIÓN</span>
          <span className={step === 'workspace' ? styles.progressActive : ''}>02 <i /> WORKSPACE</span>
        </motion.div>

        <AnimatePresence initial={false}>
          {error && (
            <motion.div
              key="onboarding-error"
              className={styles.error}
              role="alert"
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {error}
            </motion.div>
          )}
          {notice && (
            <motion.div
              key="onboarding-notice"
              className={styles.notice}
              role="status"
              initial={{ opacity: 0, y: -5, height: 0 }}
              animate={{ opacity: 1, y: 0, height: 'auto' }}
              exit={{ opacity: 0, y: -4, height: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {notice}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          className={styles.stepStage}
          layout
          transition={{ layout: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } }}
        >
        <AnimatePresence mode="wait">
        <motion.div
          key={step}
          className={styles.stepContent}
          initial={{ opacity: 0, y: 13, scale: 0.99, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -8, scale: 0.995, filter: 'blur(2px)' }}
          transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
        >
        {step === 'choose' && (
          <motion.div className={styles.choices} layout>
            <motion.button layout className={styles.choice} type="button" onClick={() => { setError(''); setStep('create-organization'); }}>
              <span className={styles.choiceIcon}><Building2 size={21} /></span>
              <span className={styles.choiceCopy}><strong>Crear organización</strong><small>Un espacio compartido para un equipo, empresa o institución.</small></span>
              <ArrowRight size={18} />
            </motion.button>
            {organizations.filter((organization) => organization.type !== 'PERSONAL' && (organization.role === 'OWNER' || organization.role === 'ADMIN')).map((organization) => (
              <motion.button layout key={organization.id} className={styles.choice} type="button" onClick={() => beginWorkspace(organization)}>
                <span className={styles.choiceIcon}><Building2 size={21} /></span>
                <span className={styles.choiceCopy}><strong>Continuar con {getDisplayOrganizationName(organization.name)}</strong><small>Ya tienes permisos para preparar un workspace en esta organización.</small></span>
                <ArrowRight size={18} />
              </motion.button>
            ))}
            {personalOrganization && (
              <motion.button layout className={styles.choice} type="button" onClick={() => beginWorkspace(personalOrganization)}>
                <span className={styles.choiceIcon}><Layers3 size={21} /></span>
                <span className={styles.choiceCopy}><strong>Empezar en mi espacio personal</strong><small>Organiza tus proyectos sin crear una organización compartida.</small></span>
                <ArrowRight size={18} />
              </motion.button>
            )}
            <motion.button layout className={styles.choice} type="button" onClick={() => { setError(''); setStep('join'); }}>
              <span className={styles.choiceIcon}><KeyRound size={21} /></span>
              <span className={styles.choiceCopy}><strong>Unirme con invitación</strong><small>Conecta tu cuenta con una organización que ya usa Aether.</small></span>
              <ArrowRight size={18} />
            </motion.button>
            <AnimatePresence initial={false}>
              {organizationsLoading && (
                <motion.p
                  key="organizations-loading"
                  className={styles.loading}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.2 }}
                >
                  <LoaderCircle size={15} /> Cargando tus organizaciones…
                </motion.p>
              )}
            </AnimatePresence>
          </motion.div>
        )}

        {step === 'create-organization' && (
          <form className={styles.panel} onSubmit={createOrganization}>
            <div className={styles.panelHeading}>
              <span className={styles.choiceIcon}><Building2 size={20} /></span>
              <div><strong>Nueva organización</strong><small>Tu cuenta conservará su espacio personal.</small></div>
            </div>
            <label className={styles.field}>
              <span>Nombre de la organización</span>
              <input autoFocus required minLength={2} maxLength={255} value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Por ejemplo, Equipo Aurora" />
            </label>
            <fieldset className={styles.typeField}>
              <legend>Tipo de organización</legend>
              <div className={styles.typeGrid}>
                {organizationTypes.map((type) => (
                  <button key={type.value} type="button" className={`${styles.typeCard} ${organizationType === type.value ? styles.typeCardSelected : ''}`} aria-pressed={organizationType === type.value} onClick={() => setOrganizationType(type.value)}>
                    <span className={styles.typeCheck}>{organizationType === type.value ? <Check size={14} /> : null}</span>
                    <strong>{type.title}</strong><small>{type.description}</small>
                  </button>
                ))}
              </div>
            </fieldset>
            <div className={styles.actions}>
              <button className={styles.backButton} type="button" onClick={goBack}><ArrowLeft size={16} /> Volver</button>
              <button className={styles.primaryButton} type="submit" disabled={busy || !organizationName.trim()}>{busy ? 'Creando…' : 'Continuar'} <ArrowRight size={17} /></button>
            </div>
          </form>
        )}

        {step === 'join' && (
          <form className={styles.panel} onSubmit={acceptInvitation}>
            <div className={styles.panelHeading}>
              <span className={styles.choiceIcon}><KeyRound size={20} /></span>
              <div><strong>Aceptar invitación</strong><small>Usa el correo con el que recibiste la invitación.</small></div>
            </div>
            <label className={styles.field}>
              <span>Enlace o código de invitación</span>
              <input autoFocus required value={inviteCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="Pega aquí tu invitación" />
            </label>
            <div className={styles.actions}>
              <button className={styles.backButton} type="button" onClick={goBack}><ArrowLeft size={16} /> Volver</button>
              <button className={styles.primaryButton} type="submit" disabled={busy || !inviteCode.trim()}>{busy ? 'Validando…' : 'Aceptar invitación'} <ArrowRight size={17} /></button>
            </div>
          </form>
        )}

        {step === 'workspace' && selectedOrganization && (
          <form className={styles.panel} onSubmit={submitWorkspace}>
            <button className={styles.backLink} type="button" onClick={goBack}><ArrowLeft size={15} /> Cambiar cómo empezar</button>
            <div className={styles.selectedOrganization}>
              <span className={styles.choiceIcon}><Building2 size={20} /></span>
              <span><small>ORGANIZACIÓN SELECCIONADA</small><strong>{selectedOrganization.name}</strong></span>
              <Check size={18} />
            </div>
            <label className={styles.field}>
              <span>Nombre del primer workspace</span>
              <input autoFocus required minLength={2} maxLength={100} value={workspaceName} onChange={(event) => setWorkspaceName(event.target.value)} placeholder={selectedOrganization.type === 'PERSONAL' ? 'Por ejemplo, Mis proyectos' : 'Por ejemplo, Operaciones'} />
            </label>
            <label className={styles.field}>
              <span>Descripción <em>OPCIONAL</em></span>
              <textarea rows={3} maxLength={500} value={workspaceDescription} onChange={(event) => setWorkspaceDescription(event.target.value)} placeholder="¿Qué quieres organizar en este espacio?" />
            </label>
            <div className={styles.actions}>
              <button className={styles.backButton} type="button" onClick={goBack}><ArrowLeft size={16} /> Volver</button>
              <button className={styles.primaryButton} type="submit" disabled={busy || !workspaceName.trim()}>{busy ? 'Preparando…' : 'Crear primer workspace'} <ArrowRight size={17} /></button>
            </div>
          </form>
        )}

        {step === 'waiting' && (
          <div className={styles.panel}>
            <div className={styles.waitingIcon}><KeyRound size={22} /></div>
            <h2>Tu acceso a un workspace está pendiente</h2>
            <p className={styles.waitingText}>La invitación te incorporó a la organización, pero sus espacios se asignan por separado.</p>
            <div className={styles.actions}>
              {personalOrganization && <button className={styles.backButton} type="button" onClick={() => beginWorkspace(personalOrganization)}>Crear espacio personal</button>}
              <button className={styles.primaryButton} type="button" onClick={() => { setStep('choose'); setError(''); }}>Ver otras opciones <ArrowRight size={17} /></button>
            </div>
          </div>
        )}
        </motion.div>
        </AnimatePresence>
        </motion.div>

        <motion.p className={styles.footer} layout transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}>
          Tus organizaciones y espacios se administran por separado. Podrás crear otros cuando quieras.
        </motion.p>
      </motion.section>
      </main>
    </MotionConfig>
  );
}
