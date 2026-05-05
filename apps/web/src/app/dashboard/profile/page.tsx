'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Key, User, MapPin, Phone, Globe, Languages, Mail, Briefcase } from 'lucide-react';
import { formatPhoneDisplay, cleanPhoneValue, validatePhone } from '@/lib/utils/phone';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Color tokens ──────────────────────────────────────────────────────────────

// ── Shared input style ────────────────────────────────────────────────────────
function FieldInput({
  id,
  type = 'text',
  value,
  onChange,
  placeholder,
  disabled,
  required,
  minLength,
  hasError,
}: {
  id?: string;
  type?: string;
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  minLength?: number;
  hasError?: boolean;
}) {
  return (
    <input
      id={id}
      type={type}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      minLength={minLength}
      className="w-full text-[13px] rounded-[6px] px-3 py-2 outline-none transition-colors"
      style={{
        background: disabled ? C.bg2 : C.bg,
        border: `1px solid ${hasError ? C.red : C.border}`,
        color: disabled ? C.text3 : C.text,
        cursor: disabled ? 'not-allowed' : 'text',
        opacity: disabled ? 0.7 : 1,
      }}
      onFocus={(e) => {
        if (!disabled) e.currentTarget.style.borderColor = hasError ? C.red : C.border2;
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = hasError ? C.red : C.border;
      }}
    />
  );
}

function FieldTextarea({
  id,
  value,
  onChange,
  placeholder,
  rows = 3,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      id={id}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      className="w-full text-[13px] rounded-[6px] px-3 py-2 outline-none transition-colors resize-none"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        color: C.text,
        fontFamily: 'inherit',
      }}
      onFocus={(e) => (e.currentTarget.style.borderColor = C.border2)}
      onBlur={(e) => (e.currentTarget.style.borderColor = C.border)}
    />
  );
}

function FieldSelect({
  id,
  value,
  onChange,
  children,
}: {
  id?: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={onChange}
      className="w-full text-[13px] rounded-[6px] px-3 py-2 outline-none"
      style={{
        background: C.bg,
        border: `1px solid ${C.border}`,
        color: C.text,
        cursor: 'pointer',
      }}
    >
      {children}
    </select>
  );
}

function FieldLabel({ htmlFor, children }: { htmlFor?: string; children: React.ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] font-medium mb-1.5" style={{ color: C.text3 }}>
      {children}
    </label>
  );
}

function SectionCard({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-[10px] p-5"
      style={{ background: C.surface, border: `1px solid ${C.border}` }}
    >
      <div className="flex items-start gap-3 mb-5 pb-4" style={{ borderBottom: `1px solid ${C.border}` }}>
        {icon && (
          <div
            className="w-7 h-7 rounded-[6px] flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: C.hover }}
          >
            <span style={{ color: C.text3 }}>{icon}</span>
          </div>
        )}
        <div>
          <h2 className="text-[14px] font-semibold" style={{ color: C.text }}>{title}</h2>
          {subtitle && <p className="text-[12px] mt-0.5" style={{ color: C.text3 }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function SubmitButton({
  loading,
  disabled,
  loadingLabel,
  label,
  icon,
}: {
  loading: boolean;
  disabled?: boolean;
  loadingLabel: string;
  label: string;
  icon: React.ReactNode;
}) {
  const isDisabled = loading || disabled;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="flex items-center gap-2 px-4 py-2 rounded-[6px] text-[13px] font-medium transition-all"
      style={{
        background: isDisabled ? C.border : C.accent,
        color: isDisabled ? C.text3 : '#fff',
        cursor: isDisabled ? 'not-allowed' : 'pointer',
      }}
    >
      {loading ? (
        <>
          <Loader2 size={14} className="animate-spin" />
          {loadingLabel}
        </>
      ) : (
        <>
          {icon}
          {label}
        </>
      )}
    </button>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ProfilePage() {
  const t = useT();
  const { user, isLoading, updateProfile, uploadAvatar, changePassword } = useAuthStore();
  const { toast } = useToast();

  const [profileForm, setProfileForm] = useState({
    name: '',
    bio: '',
    position: '',
    phone: '',
    location: '',
    timezone: '',
    language: '',
  });

  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [phoneError, setPhoneError] = useState<string | undefined>();
  const [phoneDisplay, setPhoneDisplay] = useState('');

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setPhoneDisplay('');
      setProfileForm((f) => ({ ...f, phone: '' }));
      setPhoneError(undefined);
      return;
    }
    const withPlus = raw.startsWith('+') ? raw : `+${raw}`;
    const clean = cleanPhoneValue(withPlus);
    const display = formatPhoneDisplay(clean);
    setPhoneDisplay(display);
    setProfileForm((f) => ({ ...f, phone: clean }));
    const { valid, error } = validatePhone(clean);
    if (!valid) {
      const lang = profileForm.language === 'en' ? 'en' : 'es';
      const msgs: Record<string, Record<string, string>> = {
        no_prefix: { es: 'Debe comenzar con el código de país (ej: +56)', en: 'Must start with country code (e.g. +1)' },
        too_short: { es: 'Número demasiado corto', en: 'Number too short' },
        too_long: { es: 'Número demasiado largo (máx. 15 dígitos)', en: 'Number too long (max. 15 digits)' },
        invalid_chars: { es: 'Solo se permiten números', en: 'Only numbers are allowed' },
      };
      setPhoneError(msgs[error!]?.[lang] ?? error);
    } else {
      setPhoneError(undefined);
    }
  };

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        bio: user.bio || '',
        position: user.position || '',
        phone: user.phone || '',
        location: user.location || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        language: user.language || 'es',
      });
      setPhoneDisplay(formatPhoneDisplay(user.phone || ''));
    }
  }, [user]);

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phoneError) return;
    setIsSaving(true);
    try {
      await updateProfile(profileForm);
      toast({ title: t.profile_toast_updated_title, description: t.profile_toast_updated_desc });
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_error_desc, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      await uploadAvatar(file);
      toast({ title: t.profile_toast_avatar_title, description: t.profile_toast_avatar_desc });
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_avatar_error, variant: 'destructive' });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({ title: t.error_title, description: t.profile_toast_passwords_no_match, variant: 'destructive' });
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast({ title: t.error_title, description: t.profile_toast_password_too_short, variant: 'destructive' });
      return;
    }
    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast({ title: t.profile_toast_password_title, description: t.profile_toast_password_desc });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      toast({ title: t.error_title, description: t.profile_toast_password_error, variant: 'destructive' });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center" style={{ background: C.bg }}>
        <Loader2 size={24} className="animate-spin" style={{ color: C.text3 }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: C.bg, color: C.text }}>
      {/* Header */}
      <div className="px-8 py-5" style={{ borderBottom: `1px solid ${C.border}` }}>
        <h1 className="text-[16px] font-semibold" style={{ color: C.text }}>{t.profile_title}</h1>
        <p className="text-[12px] mt-0.5" style={{ color: C.text3 }}>{t.profile_subtitle}</p>
      </div>

      <div className="px-8 py-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

          {/* LEFT — Avatar + quick summary */}
          <div className="flex flex-col gap-4">
            {/* Avatar */}
            <div
              className="rounded-[10px] p-5 flex flex-col items-center"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <AvatarUpload
                currentAvatar={user.avatar}
                userName={user.name}
                onUpload={handleAvatarUpload}
                isLoading={isLoading}
              />
            </div>

            {/* Quick info */}
            <div
              className="rounded-[10px] p-4"
              style={{ background: C.surface, border: `1px solid ${C.border}` }}
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: C.text4 }}>
                {t.profile_section_summary}
              </p>
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <User size={13} style={{ color: C.text4, flexShrink: 0 }} />
                  <span className="text-[12px] truncate" style={{ color: C.text2 }}>{user.name}</span>
                </div>
                <div className="flex items-center gap-2.5">
                  <Mail size={13} style={{ color: C.text4, flexShrink: 0 }} />
                  <span className="text-[12px] truncate" style={{ color: C.text3 }}>{user.email}</span>
                </div>
                {profileForm.position && (
                  <div className="flex items-center gap-2.5">
                    <Briefcase size={13} style={{ color: C.text4, flexShrink: 0 }} />
                    <span className="text-[12px] truncate" style={{ color: C.text3 }}>{profileForm.position}</span>
                  </div>
                )}
                {profileForm.location && (
                  <div className="flex items-center gap-2.5">
                    <MapPin size={13} style={{ color: C.text4, flexShrink: 0 }} />
                    <span className="text-[12px] truncate" style={{ color: C.text3 }}>{profileForm.location}</span>
                  </div>
                )}
                {profileForm.phone && (
                  <div className="flex items-center gap-2.5">
                    <Phone size={13} style={{ color: C.text4, flexShrink: 0 }} />
                    <span className="text-[12px] truncate" style={{ color: C.text3 }}>{profileForm.phone}</span>
                  </div>
                )}
                {profileForm.timezone && (
                  <div className="flex items-center gap-2.5">
                    <Globe size={13} style={{ color: C.text4, flexShrink: 0 }} />
                    <span className="text-[12px] truncate" style={{ color: C.text3 }}>{profileForm.timezone}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT — Forms */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Personal info */}
            <SectionCard
              title={t.profile_section_personal_title}
              subtitle={t.profile_section_personal_desc}
              icon={<User size={14} />}
            >
              <form onSubmit={handleProfileSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="name">{t.profile_label_name}</FieldLabel>
                    <FieldInput
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="email">{t.profile_label_email}</FieldLabel>
                    <FieldInput id="email" type="email" value={user.email} disabled />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="position">{t.profile_label_position}</FieldLabel>
                    <FieldInput
                      id="position"
                      value={profileForm.position}
                      onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                      placeholder={t.profile_placeholder_position}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="phone">{t.profile_label_phone}</FieldLabel>
                    <FieldInput
                      id="phone"
                      type="tel"
                      value={phoneDisplay}
                      onChange={handlePhoneChange}
                      placeholder="+56 9 1234 5678"
                      hasError={!!phoneError}
                    />
                    {phoneError && (
                      <p className="text-[11px] mt-1" style={{ color: C.red }}>{phoneError}</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <FieldLabel htmlFor="location">{t.profile_label_location}</FieldLabel>
                    <FieldInput
                      id="location"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                      placeholder={t.profile_placeholder_location}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="timezone">{t.profile_label_timezone}</FieldLabel>
                    <FieldInput
                      id="timezone"
                      value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                      disabled
                    />
                    <p className="text-[11px] mt-1" style={{ color: C.text4 }}>
                      {profileForm.language === 'en'
                        ? 'Automatically detected from your browser'
                        : 'Detectada automáticamente de tu navegador'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div>
                    <FieldLabel htmlFor="language">
                      <span className="flex items-center gap-1.5">
                        <Languages size={12} />
                        {t.profile_label_language}
                      </span>
                    </FieldLabel>
                    <FieldSelect
                      id="language"
                      value={profileForm.language}
                      onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                    >
                      <option value="es">{t.profile_lang_es}</option>
                      <option value="en">{t.profile_lang_en}</option>
                    </FieldSelect>
                  </div>
                  <div>
                    <FieldLabel htmlFor="bio">{t.profile_label_bio}</FieldLabel>
                    <FieldTextarea
                      id="bio"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder={t.profile_placeholder_bio}
                      rows={3}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <SubmitButton
                    loading={isSaving}
                    disabled={!!phoneError}
                    loadingLabel={t.profile_btn_saving}
                    label={t.profile_btn_save}
                    icon={<Save size={13} />}
                  />
                </div>
              </form>
            </SectionCard>

            {/* Password */}
            <SectionCard
              title={t.profile_section_password_title}
              subtitle={t.profile_section_password_desc}
              icon={<Key size={14} />}
            >
              <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <FieldLabel htmlFor="currentPassword">{t.profile_label_current_password}</FieldLabel>
                    <FieldInput
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="newPassword">{t.profile_label_new_password}</FieldLabel>
                    <FieldInput
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                  <div>
                    <FieldLabel htmlFor="confirmPassword">{t.profile_label_confirm_password}</FieldLabel>
                    <FieldInput
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <SubmitButton
                    loading={isChangingPassword}
                    loadingLabel={t.profile_btn_changing_password}
                    label={t.profile_btn_change_password}
                    icon={<Key size={13} />}
                  />
                </div>
              </form>
            </SectionCard>

          </div>
        </div>
      </div>
    </div>
  );
}
