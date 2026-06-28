// apps/web/src/app/dashboard/profile/page.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/hooks/use-toast';
import { formatPhoneDisplay, cleanPhoneValue, validatePhone } from '@/lib/utils/phone';
import { useT } from '@/lib/i18n';

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
  letterSpacing: '0.1em', textTransform: 'uppercase', color: '#827A6D', marginBottom: '8px',
};

const inputStyle: React.CSSProperties = {
  width: '100%', boxSizing: 'border-box',
  padding: '13px 15px', borderRadius: '8px',
  border: '1px solid rgba(255,255,255,0.13)',
  background: 'rgba(255,255,255,0.04)',
  color: '#E8E1D2', fontFamily: MANROPE, fontSize: '14.5px', outline: 'none',
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
      onFocus={e  => { if (!disabled && !readOnly) e.currentTarget.style.borderColor = 'rgba(242,87,30,0.5)'; }}
      onBlur={e   => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; }}
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
      onFocus={e => { e.currentTarget.style.borderColor = 'rgba(242,87,30,0.5)'; }}
      onBlur={e  => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)'; }}
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
      border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
      background: 'rgba(255,255,255,0.02)', padding: 'clamp(20px,3vw,28px)',
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
          <h2 style={{ fontFamily: SORA, fontWeight: 600, fontSize: '1.1rem', color: '#F4EEE2', margin: 0 }}>
            {title}
          </h2>
          <p style={{ margin: '3px 0 0', fontSize: '13px', color: '#827A6D' }}>{desc}</p>
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
          color: value ? '#E8E1D2' : '#5C5447',
          borderColor: open ? 'rgba(242,87,30,0.5)' : 'rgba(255,255,255,0.13)',
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Sin especificar'}
        </span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M6 9l6 6 6-6" stroke="#827A6D" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div style={{
            position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
            background: '#1E2438', border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
            maxHeight: '300px', overflowY: 'auto',
          }}>
            {POSITION_GROUPS.map(g => (
              <div key={g.label}>
                <div style={{ padding: '8px 12px 4px', fontFamily: SORA, fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#615846' }}>
                  {g.label}
                </div>
                {g.options.map(opt => {
                  const sel = value === opt;
                  return (
                    <button key={opt} type="button" onClick={() => { onChange(opt); setCustom(''); setOpen(false); }}
                      style={{
                        width: '100%', textAlign: 'left', padding: '8px 12px',
                        background: sel ? 'rgba(242,87,30,0.1)' : 'transparent',
                        border: 'none', borderLeft: `2px solid ${sel ? '#F2571E' : 'transparent'}`,
                        color: sel ? '#F2571E' : '#C8BFAE', fontSize: '13px',
                        fontWeight: sel ? 600 : 400, cursor: 'pointer',
                      }}
                      onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                      onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            ))}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', padding: '10px 12px 12px' }}>
              <div style={{ fontSize: '12px', color: !isPreset && value ? '#F2571E' : '#827A6D', marginBottom: '6px', fontWeight: 600 }}>
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
  const selected = COUNTRIES.find(c => c.name === value) ?? null;
  const filtered = query ? COUNTRIES.filter(c => c.name.toLowerCase().includes(query.toLowerCase())) : COUNTRIES;

  return (
    <div style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        {selected && !open && (
          <span style={{ position: 'absolute', left: '12px', fontSize: '16px', lineHeight: 1, pointerEvents: 'none' }}>
            {flag(selected.code)}
          </span>
        )}
        <input
          type="text" placeholder={open ? 'Buscar país…' : 'Selecciona un país'}
          value={open ? query : (value || '')}
          onFocus={() => { setOpen(true); setQuery(''); }}
          onChange={e => setQuery(e.target.value)}
          onBlur={() => setTimeout(() => { setOpen(false); setQuery(''); }, 150)}
          style={{
            ...inputStyle,
            paddingLeft: selected && !open ? '38px' : '15px', paddingRight: '32px',
            borderColor: open ? 'rgba(242,87,30,0.5)' : 'rgba(255,255,255,0.13)',
          }}
        />
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" style={{ position: 'absolute', right: '12px', pointerEvents: 'none', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          <path d="M6 9l6 6 6-6" stroke="#827A6D" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </div>
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 50,
          background: '#1E2438', border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: '8px', boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
          maxHeight: '240px', overflowY: 'auto',
        }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '14px', fontSize: '13px', color: '#827A6D' }}>Sin resultados para "{query}"</div>
          ) : filtered.map(c => {
            const sel = c.name === value;
            return (
              <button key={c.code} type="button" onMouseDown={e => { e.preventDefault(); onChange(c.name); setOpen(false); }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 12px', background: sel ? 'rgba(242,87,30,0.1)' : 'transparent',
                  border: 'none', borderLeft: `2px solid ${sel ? '#F2571E' : 'transparent'}`,
                  cursor: 'pointer', color: sel ? '#F2571E' : '#C8BFAE', fontSize: '13px', fontWeight: sel ? 600 : 400,
                }}
                onMouseEnter={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
                onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLElement).style.background = sel ? 'rgba(242,87,30,0.1)' : 'transparent'; }}
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
        background: '#F2571E', color: '#24180A',
        fontFamily: SORA, fontWeight: 600, fontSize: '14.5px',
        cursor: off ? 'not-allowed' : 'pointer', opacity: off ? 0.55 : 1,
      }}
      onMouseEnter={e => { if (!off) (e.currentTarget as HTMLElement).style.filter = 'brightness(1.08)'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.filter = 'none'; }}
    >
      {loading ? (
        <div style={{ width: '15px', height: '15px', borderRadius: '50%', border: '2px solid rgba(36,24,10,0.3)', borderTopColor: '#24180A', animation: 'spin 0.8s linear infinite' }} />
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
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_error_desc, variant: 'destructive' });
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
        <div style={{ width: '22px', height: '22px', borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#F2571E', animation: 'spin 0.8s linear infinite' }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  const pfInitials = initials(user.name);

  return (
    <div style={{ fontFamily: MANROPE, animation: 'fadeUp .4s ease both', padding: 'clamp(24px,3.5vw,44px) clamp(20px,4vw,48px) 80px' }}>

      {/* Page header */}
      <h1 style={{ fontFamily: SORA, fontWeight: 700, fontSize: 'clamp(1.7rem,3vw,2.2rem)', letterSpacing: '-0.02em', color: '#F4EEE2', margin: 0 }}>
        Mi perfil
      </h1>
      <p style={{ margin: '7px 0 0', fontSize: '1.02rem', color: '#9C9486' }}>
        Administra tu información personal y la configuración de tu cuenta.
      </p>

      {/* Two-column layout */}
      <div style={{ display: 'flex', gap: '26px', alignItems: 'flex-start', marginTop: '28px', flexWrap: 'wrap' }}>

        {/* ── Left column ── */}
        <aside style={{ flex: '1 1 280px', maxWidth: '320px', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

          {/* Identity card */}
          <div style={{
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px',
            background: 'rgba(255,255,255,0.02)', textAlign: 'center',
            position: 'relative', overflow: 'hidden',
          }}>
            {/* Orange header tint */}
            <div style={{ height: '78px', background: 'rgba(242,87,30,0.18)' }} />

            {/* Avatar */}
            <div style={{ position: 'relative', width: '96px', height: '96px', margin: '-48px auto 0' }}>
              {user.avatar ? (
                <img
                  src={user.avatar} alt={user.name}
                  style={{ width: '96px', height: '96px', borderRadius: '50%', border: '3px solid #161B2E', objectFit: 'cover' }}
                />
              ) : (
                <div style={{
                  width: '96px', height: '96px', borderRadius: '50%',
                  background: '#F2571E', border: '3px solid #161B2E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: SORA, fontSize: '30px', fontWeight: 700, color: '#24180A',
                }}>
                  {pfInitials}
                </div>
              )}
              {/* Camera button */}
              <button
                onClick={() => fileRef.current?.click()}
                title="Cambiar foto"
                style={{
                  position: 'absolute', right: '2px', bottom: '2px',
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: '#222A40', border: '2px solid #161B2E',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = '#1e2838')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = '#222A40')}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                  <path d="M4 7h3l1.5-2h7L17 7h3v12H4V7Z" stroke="#9C9486" strokeWidth="1.6" strokeLinejoin="round"/>
                  <circle cx="12" cy="13" r="3.2" stroke="#9C9486" strokeWidth="1.6"/>
                </svg>
              </button>
              <input ref={fileRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarFile} />
            </div>

            <div style={{ padding: '14px 20px 22px' }}>
              <div style={{ fontFamily: SORA, fontSize: '17px', fontWeight: 600, color: '#F4EEE2', marginTop: '14px' }}>
                {user.name}
              </div>
              <div style={{ fontSize: '13px', color: '#827A6D', marginTop: '3px' }}>
                {form.position || 'Sin cargo especificado'}
              </div>
              <button
                onClick={() => fileRef.current?.click()}
                style={{
                  marginTop: '16px', width: '100%', padding: '10px',
                  borderRadius: '8px', border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.03)', color: '#D8D0C1',
                  fontFamily: SORA, fontWeight: 600, fontSize: '13px', cursor: 'pointer',
                }}
                onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.07)')}
                onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)')}
              >
                Cambiar foto
              </button>
              <div style={{ fontSize: '11.5px', color: '#5C5447', marginTop: '10px' }}>
                JPG, PNG o GIF, máximo 10 MB
              </div>
            </div>
          </div>

          {/* Summary card */}
          <div style={{ border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', padding: '18px' }}>
            <div style={{ fontFamily: SORA, fontSize: '12px', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#615846', marginBottom: '14px' }}>
              Resumen
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '13px' }}>
              {[
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M4 4h16v16H4z" stroke="#615846" strokeWidth="1.6" strokeLinejoin="round" strokeDasharray="0"/><circle cx="12" cy="12" r="3" stroke="#615846" strokeWidth="1.6"/></svg>, text: user.email },
                form.phone    && { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="5" y="2" width="11" height="20" rx="2" stroke="#615846" strokeWidth="1.6"/><path d="M10 18h1" stroke="#615846" strokeWidth="1.6" strokeLinecap="round"/></svg>, text: form.phone },
                form.location && { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M12 21s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="#615846" strokeWidth="1.6" strokeLinejoin="round"/><circle cx="12" cy="10" r="2.4" stroke="#615846" strokeWidth="1.6"/></svg>, text: form.location },
                { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="#615846" strokeWidth="1.6"/><path d="M12 7v5l3 2" stroke="#615846" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/></svg>, text: tz },
              ].filter(Boolean).map((row: any, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                  <span style={{ flexShrink: 0 }}>{row.icon}</span>
                  <span style={{ fontSize: '13.5px', color: '#C8BFAE', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.text}
                  </span>
                </div>
              ))}
            </div>
          </div>
          {/* Logout button */}
          <button
            onClick={handleLogout}
            disabled={isLoggingOut}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '9px',
              padding: '12px', borderRadius: '8px', cursor: isLoggingOut ? 'not-allowed' : 'pointer',
              background: 'rgba(224,82,82,0.07)', border: '1px solid rgba(224,82,82,0.22)',
              color: '#E05252', fontFamily: SORA, fontWeight: 600, fontSize: '13.5px',
              opacity: isLoggingOut ? 0.6 : 1, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { if (!isLoggingOut) { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.14)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.4)'; } }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(224,82,82,0.07)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(224,82,82,0.22)'; }}
          >
            {isLoggingOut ? (
              <div style={{ width: '14px', height: '14px', borderRadius: '50%', border: '2px solid rgba(224,82,82,0.3)', borderTopColor: '#E05252', animation: 'spin 0.8s linear infinite' }} />
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
            iconBg="rgba(242,87,30,0.12)"
            icon={<svg width="20" height="20" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="8" r="3.6" stroke="#F2571E" strokeWidth="1.7"/><path d="M5 20a7 7 0 0 1 14 0" stroke="#F2571E" strokeWidth="1.7" strokeLinecap="round"/></svg>}
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
                  {phoneErr && <p style={{ fontSize: '11.5px', color: '#E05252', marginTop: '5px' }}>{phoneErr}</p>}
                </div>

                <div>
                  <label style={labelStyle}>Ubicación</label>
                  <CountryPicker value={form.location} onChange={v => setForm(f => ({ ...f, location: v }))} />
                </div>

                <div>
                  <label style={labelStyle}>Zona horaria</label>
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '13px 15px', borderRadius: '8px',
                    border: '1px solid rgba(255,255,255,0.08)',
                    background: 'rgba(255,255,255,0.02)',
                  }}>
                    <span style={{ fontSize: '14.5px', color: '#9C9486', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tz}</span>
                    <span style={{ fontSize: '11px', color: '#5C5447', flexShrink: 0 }}>Automática</span>
                  </div>
                </div>

                <div>
                  <label style={labelStyle}>Idioma</label>
                  <select
                    value={form.language}
                    onChange={e => setForm(f => ({ ...f, language: e.target.value }))}
                    style={{ ...inputStyle, cursor: 'pointer', colorScheme: 'dark' }}
                    onFocus={e  => (e.currentTarget.style.borderColor = 'rgba(242,87,30,0.5)')}
                    onBlur={e   => (e.currentTarget.style.borderColor = 'rgba(255,255,255,0.13)')}
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '13px', color: '#76A878' }}>
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
                      <path d="M5 13l4 4L19 7" stroke="#76A878" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                    Cambios guardados
                  </span>
                )}
                <SaveBtn
                  loading={isSaving} disabled={!!phoneErr} label="Guardar cambios"
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><path d="M5 4h11l3 3v13H5V4Z" stroke="#24180A" strokeWidth="1.8" strokeLinejoin="round"/><path d="M8 4v5h7M9 14h6" stroke="#24180A" strokeWidth="1.8" strokeLinecap="round"/></svg>}
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
                  icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="#24180A" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="#24180A" strokeWidth="1.8"/></svg>}
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
