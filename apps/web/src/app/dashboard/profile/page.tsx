// apps/web/src/app/dashboard/profile/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneDisplay, cleanPhoneValue, validatePhone } from '@/lib/utils/phone';
import { useT } from '@/lib/i18n';
import { Camera, Clock3, Mail, MapPin, Phone } from 'lucide-react';

// ── Design tokens ─────────────────────────────────────────────────────────────

const SORA    = "'Sora', system-ui, sans-serif";
const MANROPE = "'Manrope', system-ui, sans-serif";

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string) {
  return (name || 'U').trim().split(/\s+/).slice(0, 2).map(s => s[0]).join('').toUpperCase();
}

const flag = (code: string) =>
  String.fromCodePoint(...[...code.toUpperCase()].map(c => 0x1f1e6 - 65 + c.charCodeAt(0)));

// ── Field components ──────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: 'block', fontFamily: SORA, fontSize: '11.5px', fontWeight: 600,
  letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text3)', marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '13px 15px', borderRadius: '8px',
  border: '1px solid rgba(97,71,130,0.13)',
  background: 'rgba(97,71,130,0.04)',
  color: 'var(--c-text)', fontFamily: MANROPE, fontSize: '14.5px', outline: 'none',
};

function AInput({ value, onChange, type = 'text', placeholder, disabled, readOnly }: {
  value: string; onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string; placeholder?: string; disabled?: boolean; readOnly?: boolean;
}) {
  return (
    <input
      type={type} value={value} onChange={onChange}
      placeholder={placeholder} disabled={disabled} readOnly={readOnly}
      style={{ ...inputStyle, opacity: disabled || readOnly ? 0.55 : 1, cursor: disabled || readOnly ? 'default' : 'text' }}
      onFocus={e  => { if (!disabled && !readOnly) e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)'; }}
      onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(97,71,130,0.13)'; }}
    />
  );
}

function ATextarea({ value, onChange, placeholder, rows = 3 }: {
  value: string; onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <textarea
      value={value} onChange={onChange} placeholder={placeholder} rows={rows}
      style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.55 }}
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(97,71,130,0.13)'; }}
    />
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ children, icon, iconBg, title, desc }: {
  children: React.ReactNode;
  icon: React.ReactNode; iconBg: string;
  title: string; desc: string;
}) {
  return (
    <section style={{
      border: '1px solid rgba(97,71,130,0.08)', borderRadius: '8px',
      background: 'rgba(97,71,130,0.02)', padding: 'clamp(20px,3vw,28px)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '13px', marginBottom: '22px' }}>
        <span style={{
          width: '40px', height: '40px', borderRadius: '50%',
          background: iconBg, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {icon}
        </span>
        <div>
          <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.1rem', color: 'var(--c-text)', margin: 0 }}>
            {title}
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '13px', color: 'var(--c-text3)' }}>{desc}</p>
        </div>
      </div>
      {children}
    </section>
  );
}

// ── Position picker ───────────────────────────────────────────────────────────

const POSITION_GROUPS = [
  { label: 'Ingeniería',       options: ['Frontend Developer','Backend Developer','Full Stack Developer','Mobile Developer','DevOps / SRE','QA Engineer','Security Engineer'] },
  { label: 'Diseño',           options: ['UI/UX Designer','Product Designer','Graphic Designer'] },
  { label: 'Producto & Gestión',options: ['Product Manager','Project Manager','Scrum Master','Tech Lead','Engineering Manager'] },
  { label: 'Datos & IA',       options: ['Data Scientist','Data Analyst','Data Engineer','ML Engineer'] },
];
const ALL_PRESETS = POSITION_GROUPS.flatMap(g => g.options);

function PositionPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,   setOpen]   = useState(false);
  const [custom, setCustom] = useState(!ALL_PRESETS.includes(value) ? value : '');
  const isPreset = ALL_PRESETS.includes(value);

  return (
    <div style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        style={{
          ...inputStyle, textAlign: 'left', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          color: value ? 'var(--c-text)' : 'var(--c-text4)',
          borderColor: open ? 'rgba(116,82,166,0.5)' : 'rgba(97,71,130,0.13)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Sin especificar'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M6 9l6 6 6-6" stroke="var(--c-text3)" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: 'var(--c-surface)', border: '1px solid rgba(97,71,130,0.12)',
            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxHeight: '300px', overflowY: 'auto',
          }}>
            {POSITION_GROUPS.map(g => (
              <div key={g.label}>
                <div style={{ padding: '8px 12px 4px', fontFamily: SORA, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text4)' }}>
                  {g.label}
                </div>
                {g.options.map(opt => {
                  const sel = value === opt;
                  return (
                    <button key={opt} type="button" onClick={() => { onChange(opt); setCustom(''); setOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: sel ? 'rgba(116,82,166,0.1)' : 'transparent',
                        border: 'none', borderLeft: `2px solid ${sel ? '#7452A6' : 'transparent'}`,
                        color: sel ? '#7452A6' : 'var(--c-text2)', fontSize: '13px',
                        fontWeight: sel ? 600 : 400, cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; }}
                      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(97,71,130,0.07)', padding: '10px 12px 12px' }}>
              <div style={{ fontSize: '12px', color: !isPreset && value ? '#7452A6' : 'var(--c-text3)', marginBottom: '6px', fontWeight: 600 }}>
                Otro (personalizado)
              </div>
              <input
                type="text" value={custom}
                onChange={e => { setCustom(e.target.value); onChange(e.target.value); }}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); setOpen(false); } }}
                placeholder="Escribe tu cargo..."
                style={{ ...inputStyle, padding: '8px 12px', fontSize: '13px' }}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Country picker ────────────────────────────────────────────────────────────

const COUNTRIES: { code: string; name: string }[] = [
  {code:'AR',name:'Argentina'},{code:'BO',name:'Bolivia'},{code:'BR',name:'Brasil'},
  {code:'CA',name:'Canadá'},{code:'CL',name:'Chile'},{code:'CO',name:'Colombia'},
  {code:'CR',name:'Costa Rica'},{code:'CU',name:'Cuba'},{code:'DO',name:'República Dominicana'},
  {code:'EC',name:'Ecuador'},{code:'SV',name:'El Salvador'},{code:'ES',name:'España'},
  {code:'US',name:'Estados Unidos'},{code:'GT',name:'Guatemala'},{code:'HN',name:'Honduras'},
  {code:'MX',name:'México'},{code:'NI',name:'Nicaragua'},{code:'PA',name:'Panamá'},
  {code:'PY',name:'Paraguay'},{code:'PE',name:'Perú'},{code:'PR',name:'Puerto Rico'},
  {code:'UY',name:'Uruguay'},{code:'VE',name:'Venezuela'},
  {code:'DE',name:'Alemania'},{code:'FR',name:'Francia'},{code:'GB',name:'Reino Unido'},
  {code:'IT',name:'Italia'},{code:'PT',name:'Portugal'},{code:'JP',name:'Japón'},
  {code:'CN',name:'China'},{code:'IN',name:'India'},{code:'AU',name:'Australia'},
  {code:'NZ',name:'Nueva Zelanda'},{code:'ZA',name:'Sudáfrica'},
];

function CountryPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open,  setOpen]  = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const pickerRef = useRef<HTMLDivElement>(null);
  const selected = COUNTRIES.find(c => c.name === value) ?? null;
  const filtered = query ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : COUNTRIES;

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  function selectCountry(country: string) {
    onChange(country);
    setOpen(false);
    setQuery('');
    setActiveIndex(0);
  }

  return (
    <div ref={pickerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {selected && !open && (
          <span style={{ position: 'absolute', left: '12px', fontSize: '16px', lineHeight: 1, pointerEvents: 'none' }}>
            {flag(selected.code)}
          </span>
        )}
        <input
          id="profile-location"
          type="text" placeholder={open ? 'Buscar país…' : 'Selecciona un país'}
          value={open ? query : (value || '')}
          role="combobox"
          aria-expanded={open}
          aria-controls="profile-country-options"
          aria-autocomplete="list"
          onFocus={() => { setOpen(true); setQuery(''); setActiveIndex(0); }}
          onClick={() => setOpen(true)}
          onChange={e => { setQuery(e.target.value); setActiveIndex(0); setOpen(true); }}
          onKeyDown={e => {
            if (e.key === 'Escape') { setOpen(false); setQuery(''); }
            if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActiveIndex(i => Math.min(i + 1, filtered.length - 1)); }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIndex(i => Math.max(i - 1, 0)); }
            if (e.key === 'Enter' && open && filtered[activeIndex]) { e.preventDefault(); selectCountry(filtered[activeIndex].name); }
          }}
          style={{
            ...inputStyle,
            paddingLeft: selected && !open ? '38px' : '15px', paddingRight: '32px',
            borderColor: open ? 'rgba(116,82,166,0.5)' : 'rgba(97,71,130,0.13)',
          }}
        />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: '12px', pointerEvents: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M6 9l6 6 6-6" stroke="var(--c-text3)" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </div>
      {open && (
        <div id="profile-country-options" role="listbox" style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: 'var(--c-surface)', border: '1px solid rgba(97,71,130,0.12)',
          borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '240px', overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '13px', color: 'var(--c-text3)' }}>Sin resultados para "{query}"</div>
          ) : filtered.map((c, index) => {
            const sel = c.name === value;
            return (
              <button key={c.code} type="button" role="option" aria-selected={sel} onClick={() => selectCountry(c.name)}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', background: sel || index === activeIndex ? 'rgba(116,82,166,0.1)' : 'transparent',
                  border: 'none', borderLeft: `2px solid ${sel ? '#7452A6' : 'transparent'}`,
                  cursor: 'pointer', color: sel ? '#7452A6' : 'var(--c-text2)', fontSize: '13px', fontWeight: sel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(97,71,130,0.04)'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = sel ? 'rgba(116,82,166,0.1)' : 'transparent'; }}
              >
                <span style={{ fontSize: '17px', lineHeight: 1, flexShrink: 0 }}>{flag(c.code)}</span>
                {c.name}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Orange save button ────────────────────────────────────────────────────────

function SaveBtn({ loading, disabled, label, icon }: { loading: boolean; disabled?: boolean; label: string; icon: React.ReactNode }) {
  const off = loading || disabled;
  return (
    <button
      type="submit" disabled={off}
      style={{
        display: 'flex', alignItems: 'center', gap: '8px',
        padding: '12px 22px', borderRadius: '8px', border: 'none',
        background: '#7452A6', color: '#FFFFFF',
        fontFamily: SORA, fontWeight: 600, fontSize: '14.5px',
        cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (!off) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
    >
      {loading ? (
        <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(36,24,10,0.3)', borderTopColor: '#FFFFFF', animation: 'spin 0.8s linear infinite' }} />
      ) : icon}
      {label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ProfilePage() {
  const t = useT();
  const router = useRouter();
  const { user, isLoading, updateProfile, uploadAvatar, changePassword, logout } = useAuthStore();
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const [form, setForm] = useState({
    name: '', bio: '', position: '', phone: '', location: '', language: 'es',
  });
  const [pw, setPw] = useState({ cur: '', next: '', conf: '' });

  const [isSaving,  setIsSaving]  = useState(false);
  const [isChgPw,   setIsChgPw]   = useState(false);
  const [saved,     setSaved]      = useState(false);
  const [phoneErr,  setPhoneErr]   = useState('');
  const [phoneDisp, setPhoneDisp]  = useState('');

  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Init from user
  useEffect(() => {
    if (!user) return;
    setForm({
      name:     user.name     || '',
      bio:      user.bio      || '',
      position: user.position || '',
      phone:    user.phone    || '',
      location: user.location || '',
      language: user.language || 'es',
    });
    setPhoneDisp(formatPhoneDisplay(user.phone || ''));
  }, [user]);

  // Phone change handler
  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    if (!raw) { setPhoneDisp(''); setForm(f => ({ ...f, phone: '' })); setPhoneErr(''); return; }
    const withPlus = raw.startsWith('+') ? raw : `+${raw}`;
    const clean = cleanPhoneValue(withPlus);
    setPhoneDisp(formatPhoneDisplay(clean));
    setForm(f => ({ ...f, phone: clean }));
    const { valid, error } = validatePhone(clean);
    if (!valid) {
      const msgs: Record<string, string> = {
        no_prefix: 'Debe comenzar con el código de país (ej: +56)',
        too_short: 'Número demasiado corto',
        too_long:  'Número demasiado largo (máx. 15 dígitos)',
        invalid_chars: 'Solo se permiten números',
      };
      setPhoneErr(msgs[error!] ?? error ?? '');
    } else {
      setPhoneErr('');
    }
  }

  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    if (phoneErr) return;
    setIsSaving(true); setSaved(false);
    try {
      await updateProfile(form);
      const saveError = useAuthStore.getState().error;
      if (saveError) throw new Error(saveError);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      toast({ title: t.error_title, description: error instanceof Error ? error.message : t.profile_toast_error_desc, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await uploadAvatar(file);
      toast({ title: t.profile_toast_avatar_title, description: t.profile_toast_avatar_desc });
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_avatar_error, variant: 'destructive' });
    }
    if (fileRef.current) fileRef.current.value = '';
  }

  async function handleLogout() {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push('/login');
    } catch {
      setIsLoggingOut(false);
    }
  }

  async function handlePwSave(e: React.FormEvent) {
    e.preventDefault();
    if (pw.next !== pw.conf) { toast({ title: t.error_title, description: t.profile_toast_passwords_no_match, variant: 'destructive' }); return; }
    if (pw.next.length < 6)  { toast({ title: t.error_title, description: t.profile_toast_password_too_short, variant: 'destructive' }); return; }
    setIsChgPw(true);
    try {
      await changePassword(pw.cur, pw.next);
      toast({ title: t.profile_toast_password_title, description: t.profile_toast_password_desc });
      setPw({ cur: '', next: '', conf: '' });
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_password_error, variant: 'destructive' });
    } finally {
      setIsChgPw(false);
    }
  }

  if (!user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(97,71,130,0.1)', borderTopColor: 'var(--c-accent-text)', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: MANROPE, animation: 'fadeUp .4s ease both', padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px' }}>

      {/* Page header */}
      <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.2rem)', letterSpacing: '-0.02em', color: 'var(--c-text)', margin: 0 }}>
        Mi perfil
      </h1>
      <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: 'var(--c-text2)' }}>
        Administra tu información personal y la configuración de tu cuenta.
      </p>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '26px', alignItems: 'flex-start', marginTop: '28px', flexWrap: 'wrap' }}>

        {/* ── Left column ── */}
        <aside style={{ flex: '1 1 280px', maxWidth: '320px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          <div style={{ fontFamily: SORA, fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text4)', paddingLeft: 2 }}>
            Vista previa de tu perfil
          </div>

          {/* Vista previa inspirada en las tarjetas de perfil de Discord. */}
          <section aria-label="Vista previa del perfil" style={{
            border: '1px solid var(--c-border)', borderRadius: 16,
            background: 'var(--c-surface)', overflow: 'hidden',
            boxShadow: '0 14px 32px rgba(36, 24, 55, 0.09)',
          }}>
            <div style={{
              height: 104, position: 'relative',
              background: 'radial-gradient(circle at 82% 15%, rgba(226,207,243,0.5), transparent 35%), linear-gradient(135deg, #4B365F 0%, #7452A6 58%, #A47AC8 100%)',
            }}>
              <span style={{ position: 'absolute', top: 15, right: 17, color: 'rgba(255,255,255,0.86)', fontSize: 10, fontWeight: 800, letterSpacing: '0.11em', textTransform: 'uppercase' }}>Mi perfil</span>
            </div>

            <div style={{ padding: '0 20px 22px', marginTop: -39, position: 'relative' }}>
              <div style={{ position: 'relative', width: 82, height: 82 }}>
                {user.avatar ? (
                  <img src={user.avatar} alt={user.name} style={{ width: 82, height: 82, borderRadius: '50%', border: '4px solid var(--c-surface)', objectFit: 'cover', boxSizing: 'border-box' }} />
                ) : (
                  <div style={{ width: 82, height: 82, borderRadius: '50%', border: '4px solid var(--c-surface)', boxSizing: 'border-box', background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: SORA, fontSize: 26, fontWeight: 700, color: '#FFFFFF' }}>
                    {initials(form.name || user.name)}
                  </div>
                )}
                <button type="button" onClick={() => fileRef.current?.click()} aria-label="Cambiar foto" title="Cambiar foto"
                  style={{ position: 'absolute', right: -2, bottom: -2, width: 28, height: 28, borderRadius: '50%', border: '3px solid var(--c-surface)', background: 'var(--c-surface2)', color: 'var(--c-text2)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                  <Camera size={13} />
                </button>
                <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
              </div>

              <h2 style={{ fontFamily: SORA, fontSize: 18, lineHeight: 1.25, fontWeight: 700, color: 'var(--c-text)', margin: '15px 0 3px', overflowWrap: 'anywhere' }}>
                {form.name || user.name}
              </h2>
              <p style={{ fontSize: 12.5, color: 'var(--c-text3)', margin: 0 }}>{form.position || 'Sin cargo especificado'}</p>

              <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 18, paddingTop: 16 }}>
                <div style={{ fontFamily: SORA, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text4)', marginBottom: 7 }}>Sobre mí</div>
                <p style={{ fontSize: 12.5, color: 'var(--c-text2)', lineHeight: 1.6, margin: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                  {form.bio || 'Añade una biografía para presentarte a otras personas.'}
                </p>
              </div>

              <div style={{ borderTop: '1px solid var(--c-border)', marginTop: 17, paddingTop: 16 }}>
                <div style={{ fontFamily: SORA, fontSize: 10, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--c-text4)', marginBottom: 11 }}>Información</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {[
                    { icon: <Mail size={14} />, text: user.email },
                    form.phone && { icon: <Phone size={14} />, text: form.phone },
                    form.location && { icon: <MapPin size={14} />, text: form.location },
                    { icon: <Clock3 size={14} />, text: tz },
                  ].filter(Boolean).map((row: any, index) => (
                    <div key={index} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, color: 'var(--c-text3)' }}>
                      <span style={{ flexShrink: 0, display: 'flex' }}>{row.icon}</span>
                      <span style={{ fontSize: 12, color: 'var(--c-text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={row.text}>{row.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              <button type="button" onClick={() => fileRef.current?.click()}
                style={{ marginTop: 20, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '10px 12px', borderRadius: 8, border: '1px solid var(--c-border2)', background: 'var(--c-surface2)', color: 'var(--c-text2)', fontFamily: SORA, fontWeight: 600, fontSize: 12, cursor: 'pointer' }}>
                <Camera size={14} /> Cambiar foto
              </button>
              <p style={{ margin: '8px 0 0', color: 'var(--c-text4)', fontSize: 10.5, textAlign: 'center' }}>JPG, PNG o GIF, máximo 10 MB</p>
            </div>
          </section>
          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              padding: '12px', borderRadius: '8px', cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              background: 'rgba(224,82,82,0.07)', border: '1px solid rgba(224,82,82,0.22)',
              color: '#B45C72', fontFamily: SORA, fontWeight: 600, fontSize: '13.5px',
              opacity: isLoggingOut ? 0.6 : 1, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isLoggingOut) { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.14)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.4)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.22)'; }}
          >
            {isLoggingOut ? (
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(224,82,82,0.3)', borderTopColor: '#B45C72', animation: 'spin 0.8s linear infinite' }} />
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M16 17l5-5-5-5M21 12H9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {isLoggingOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
          </button>
        </aside>

        {/* ── Right column ── */}
        <div style={{ flex: '1 1 460px', minWidth: '300px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

          {/* Información personal */}
          <SectionCard
            iconBg="rgba(116,82,166,0.12)"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="#7452A6" strokeWidth="1.7"/><path d="M5 20a7 7 0 0 1 14 0" stroke="#7452A6" strokeWidth="1.7" strokeLinecap="round"/></svg>}
            title="Información personal"
            desc="Actualiza tu perfil y tus datos de contacto."
          >
            <form onSubmit={handleProfileSave}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '18px' }}>

                <div>
                  <label style={labelStyle}>Nombre completo</label>
                  <AInput value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
                </div>

                <div>
                  <label style={labelStyle}>Email</label>
                  <AInput value={user.email} readOnly />
                </div>

                <div>
                  <label style={labelStyle}>Cargo o posición</label>
                  <PositionPicker value={form.position} onChange={v => setForm(f => ({ ...f, position: v }))} />
                </div>

                <div>
                  <label style={labelStyle}>Teléfono</label>
                  <AInput type="tel" value={phoneDisp} onChange={handlePhoneChange} placeholder="+56 9 1234 5678" />
                  {phoneErr && <p style={{ fontSize: '11.5px', color: '#B45C72', marginTop: '5px' }}>{phoneErr}</p>}
                </div>

                <div>
                  <label htmlFor="profile-location" style={labelStyle}>Ubicación</label>
                  <CountryPicker value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} />
                </div>

                <div>
                  <label style={labelStyle}>Zona horaria</label>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '13px 15px', borderRadius: '8px',
                    border: '1px solid rgba(97,71,130,0.08)',
                    background: 'rgba(97,71,130,0.02)',
                  }}>
                    <span style={{ fontSize: '14.5px', color: 'var(--c-text2)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tz}</span>
                    <span style={{ fontSize: '11px', color: 'var(--c-text4)', flexShrink: 0 }}>Automática</span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Idioma</label>
                  <select
                    value={form.language}
                    onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'light' }}
                    onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(116,82,166,0.5)')}
                    onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(97,71,130,0.13)')}
                  >
                    <option value="es">Español</option>
                    <option value="en">English</option>
                  </select>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <label style={labelStyle}>Biografía</label>
                  <ATextarea
                    value={form.bio}
                    onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
                    placeholder="Cuéntanos un poco sobre ti"
                    rows={3}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '14px', marginTop: '22px' }}>
                {saved && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#548B73' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#548B73" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Cambios guardados
                  </span>
                )}
                <SaveBtn
                  loading={isSaving} disabled={!!phoneErr} label="Guardar cambios"
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="#FFFFFF" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 4v5h7M9 14h6" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="round"/></svg>}
                />
              </div>
            </form>
          </SectionCard>

          {/* Cambiar contraseña */}
          <SectionCard
            iconBg="rgba(140,124,158,0.14)"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="#C4B9D0" strokeWidth="1.7"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#C4B9D0" strokeWidth="1.7"/></svg>}
            title="Cambiar contraseña"
            desc="Mantén tu cuenta segura con una contraseña fuerte."
          >
            <form onSubmit={handlePwSave}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '18px' }}>
                <div>
                  <label style={labelStyle}>Contraseña actual</label>
                  <AInput type="password" value={pw.cur} onChange={e => setPw(p => ({ ...p, cur: e.target.value }))} placeholder="••••••••" />
                </div>
                <div>
                  <label style={labelStyle}>Nueva contraseña</label>
                  <AInput type="password" value={pw.next} onChange={e => setPw(p => ({ ...p, next: e.target.value }))} placeholder="Mínimo 8 caracteres" />
                </div>
                <div>
                  <label style={labelStyle}>Confirmar contraseña</label>
                  <AInput type="password" value={pw.conf} onChange={e => setPw(p => ({ ...p, conf: e.target.value }))} placeholder="Repite la contraseña" />
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '22px' }}>
                <SaveBtn
                  loading={isChgPw} label="Actualizar contraseña"
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="#FFFFFF" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#FFFFFF" strokeWidth="1.8"/></svg>}
                />
              </div>
            </form>
          </SectionCard>

        </div>
      </div>

      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
