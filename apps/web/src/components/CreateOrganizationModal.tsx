'use client';

import { useEffect, useState } from 'react';
import { ArrowRight, Building2, Check, Landmark, Layers3, LoaderCircle, Network, UserRound, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { C } from '@/lib/colors';

type OrganizationType = 'PERSONAL' | 'COMPANY' | 'INSTITUTION' | 'NETWORK_OPERATOR';
type CreatedOrganization = { id: string; name: string; type: OrganizationType };

const ORGANIZATION_TYPES: Array<{ id: OrganizationType; label: string; description: string; icon: LucideIcon }> = [
  { id: 'PERSONAL', label: 'Personal', description: 'Usa tu organización personal, asociada a tu cuenta.', icon: UserRound },
  { id: 'COMPANY', label: 'Equipo o empresa', description: 'Coordina el trabajo de un equipo.', icon: Building2 },
  { id: 'INSTITUTION', label: 'Institución', description: 'Organiza programas y colaboración institucional.', icon: Landmark },
  { id: 'NETWORK_OPERATOR', label: 'Red de colaboración', description: 'Conecta equipos y organizaciones.', icon: Network },
];

type CreateOrganizationModalProps = {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (organization: CreatedOrganization) => void;
};

export default function CreateOrganizationModal({ isOpen, onClose, onCreated }: CreateOrganizationModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<OrganizationType>('COMPANY');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setName('');
      setType('COMPANY');
      setError('');
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, busy, onClose]);

  if (!isOpen) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organizationName = name.trim();
    if ((!organizationName && type !== 'PERSONAL') || busy) return;
    setBusy(true);
    setError('');
    try {
      if (type === 'PERSONAL') {
        const response = await apiService.get<{ organizations: CreatedOrganization[] }>(
          '/api/organizations',
          true,
        );
        if (!response.success || !response.data?.organizations) {
          throw new Error(response.error?.message ?? 'No se pudo cargar tu organización personal. Inténtalo de nuevo.');
        }
        const personalOrganization = response.data.organizations.find(
          (organization) => organization.type === 'PERSONAL',
        );
        if (!personalOrganization) {
          throw new Error('No encontramos una organización personal asociada a tu cuenta. Actualiza la página e inténtalo de nuevo.');
        }
        onCreated(personalOrganization);
        onClose();
        return;
      }

      const response = await apiService.post<{ organization: CreatedOrganization }>(
        '/api/organizations',
        { name: organizationName, type },
        true,
      );
      if (!response.success || !response.data?.organization?.id) {
        throw new Error(response.error?.message ?? 'No se pudo crear la organización. Inténtalo de nuevo.');
      }
      onCreated(response.data.organization);
      onClose();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'No se pudo crear la organización. Comprueba tu conexión e inténtalo de nuevo.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="presentation"
      className="fixed inset-0 z-[70] flex items-center justify-center p-4"
      style={{ background: 'rgba(4, 7, 17, 0.76)', backdropFilter: 'blur(7px)' }}
      onMouseDown={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-organization-title"
        className="w-full overflow-hidden rounded-[18px]"
        style={{
          maxWidth: 660,
          background: C.bg2,
          border: `1px solid ${C.border2}`,
          boxShadow: '0 28px 90px rgba(0,0,0,.58)',
          fontFamily: "'Manrope', system-ui, sans-serif",
          color: C.text,
        }}
      >
        <header className="flex items-start gap-4" style={{ padding: '25px 28px 22px', borderBottom: `1px solid ${C.border}`, background: `radial-gradient(ellipse at top left, ${C.accent}15, transparent 68%)` }}>
          <span className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-[14px]" style={{ color: C.accent, background: `${C.accent}1c`, border: `1px solid ${C.accent}40` }} aria-hidden="true">
            <Building2 size={22} strokeWidth={1.8} />
          </span>
          <div className="min-w-0 flex-1">
            <p style={{ margin: '1px 0 7px', color: C.accent, fontSize: 10, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase' }}>
              01 - Tu estructura de trabajo
            </p>
            <h2 id="create-organization-title" style={{ margin: 0, fontSize: 23, lineHeight: 1.2, fontWeight: 750, letterSpacing: '-.045em' }}>
              Crea una organización
            </h2>
            <p style={{ margin: '8px 0 0', maxWidth: 500, color: C.text3, fontSize: 13, lineHeight: 1.6 }}>
              {type === 'PERSONAL'
                ? 'Tu organización personal ya está asociada a tu cuenta. Úsala para crear un espacio privado.'
                : 'Define quién trabajará en conjunto. Luego podrás crear espacios de trabajo para organizar proyectos e iniciativas.'}
            </p>
          </div>
          <button type="button" aria-label="Cerrar" disabled={busy} onClick={onClose} className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[9px] transition-colors" style={{ color: C.text3, background: 'transparent' }}>
            <X size={18} />
          </button>
        </header>

        <form onSubmit={handleSubmit}>
          <div style={{ padding: '23px 28px 25px' }}>
            {type === 'PERSONAL' ? (
              <div role="status" className="flex items-center gap-3 rounded-[10px]" style={{ minHeight: 54, padding: '11px 13px', color: C.text2, background: `${C.accent}0c`, border: `1px solid ${C.accent}30`, fontSize: 12, lineHeight: 1.5 }}>
                <UserRound size={17} style={{ flexShrink: 0, color: C.accent }} aria-hidden="true" />
                Tu organización personal ya está vinculada a tu cuenta. La usaremos para crear el espacio, sin duplicarla.
              </div>
            ) : (
              <>
                <label htmlFor="organization-name" style={{ display: 'block', marginBottom: 8, color: C.text2, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
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
                  style={{ height: 48, padding: '0 14px', color: C.text, background: C.surface, border: `1px solid ${C.border2}`, fontSize: 13.5, fontFamily: 'inherit' }}
                  onFocus={(event) => { event.currentTarget.style.borderColor = `${C.accent}aa`; event.currentTarget.style.boxShadow = `0 0 0 3px ${C.accent}18`; }}
                  onBlur={(event) => { event.currentTarget.style.borderColor = C.border2; event.currentTarget.style.boxShadow = 'none'; }}
                />
              </>
            )}

            <fieldset style={{ margin: '23px 0 0', padding: 0, border: 0 }}>
                <legend style={{ marginBottom: 10, color: C.text2, fontSize: 11, fontWeight: 800, letterSpacing: '.08em', textTransform: 'uppercase' }}>
                  ¿Qué tipo de organización estás creando?
                </legend>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 10 }}>
                  {ORGANIZATION_TYPES.map((option) => {
                      const selected = type === option.id;
                      const Icon = option.icon;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          aria-pressed={selected}
                          disabled={busy}
                          onClick={() => setType(option.id)}
                          className="flex min-h-[142px] flex-col items-start rounded-[12px] text-left transition-colors duration-300 ease-out motion-reduce:transition-none"
                          style={{
                            padding: '14px 14px 13px',
                            border: `1px solid ${selected ? 'var(--c-accent)' : C.border}`,
                            backgroundColor: selected ? 'color-mix(in srgb, var(--c-accent) 8%, var(--c-surface))' : C.surface,
                            color: C.text,
                          }}
                        >
                          <span
                            className="mb-3 flex h-9 w-9 items-center justify-center rounded-[10px]"
                            style={{ color: selected ? C.accent : C.text3, background: selected ? 'color-mix(in srgb, var(--c-accent) 12%, var(--c-bg))' : C.bg, border: `1px solid ${selected ? 'color-mix(in srgb, var(--c-accent) 30%, transparent)' : C.border}` }}
                            aria-hidden="true"
                          >
                            <Icon size={18} strokeWidth={1.8} />
                          </span>
                          <span className="flex w-full items-center justify-between gap-2">
                            <strong style={{ fontSize: 12, lineHeight: 1.3, fontWeight: 750 }}>{option.label}</strong>
                            <span aria-hidden="true" style={{ display: 'grid', width: 18, height: 18, flexShrink: 0, placeItems: 'center', color: C.accent }}>
                              {selected ? <Check size={16} /> : null}
                            </span>
                          </span>
                          <small style={{ marginTop: 5, color: C.text4, fontSize: 10.5, lineHeight: 1.45 }}>{option.description}</small>
                        </button>
                      );
                  })}
                </div>
            </fieldset>

            <div className="mt-5 flex flex-wrap items-center gap-2 rounded-[10px]" style={{ padding: '11px 12px', background: `${C.accent}0c`, border: `1px solid ${C.accent}24` }} aria-label="Estructura de Aether">
              <span className="flex items-center gap-1.5" style={{ color: C.text2, fontSize: 10.5, fontWeight: 700 }}><Building2 size={14} style={{ color: C.accent }} /> Organización</span>
              <ArrowRight size={13} style={{ color: C.text4 }} aria-hidden="true" />
              <span className="flex items-center gap-1.5" style={{ color: C.text2, fontSize: 10.5, fontWeight: 700 }}><Layers3 size={14} style={{ color: C.accent }} /> Espacios de trabajo</span>
              <ArrowRight size={13} style={{ color: C.text4 }} aria-hidden="true" />
              <span style={{ color: C.text2, fontSize: 10.5, fontWeight: 700 }}>Proyectos e iniciativas</span>
            </div>

            {error ? <p role="alert" style={{ margin: '13px 0 0', color: C.red, fontSize: 12, lineHeight: 1.5 }}>{error}</p> : null}
          </div>

          <footer className="flex flex-wrap items-center justify-between gap-3" style={{ padding: '16px 28px 19px', borderTop: `1px solid ${C.border}`, background: C.bg }}>
            <p style={{ margin: 0, maxWidth: 280, color: C.text4, fontSize: 11.5, lineHeight: 1.5 }}>
              No se creará ningún espacio hasta que definas su nombre en el siguiente paso.
            </p>
            <div className="ml-auto flex items-center gap-2">
              <button type="button" onClick={onClose} disabled={busy} className="rounded-[9px]" style={{ minWidth: 108, padding: '10px 14px', color: C.text2, border: `1px solid ${C.border2}`, background: C.hover, fontSize: 12, fontWeight: 700 }}>
                Cancelar
              </button>
              <button type="submit" disabled={busy || (type !== 'PERSONAL' && name.trim().length < 2)} className="flex items-center justify-center gap-2 rounded-[9px]" style={{ minWidth: 184, padding: '10px 15px', color: '#fff', border: 0, background: C.accent, opacity: busy || (type !== 'PERSONAL' && name.trim().length < 2) ? 0.58 : 1, fontSize: 12, fontWeight: 800 }}>
                {busy ? <><LoaderCircle size={15} className="animate-spin" /> {type === 'PERSONAL' ? 'Abriendo…' : 'Creando organización…'}</> : type === 'PERSONAL' ? <>Usar organización personal <ArrowRight size={15} /></> : <>Crear organización <ArrowRight size={15} /></>}
              </button>
            </div>
          </footer>
        </form>
      </section>
    </div>
  );
}
