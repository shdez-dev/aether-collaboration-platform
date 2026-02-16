// apps/web/src/app/dashboard/profile/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Save, Key, User, MapPin, Phone, Globe, Languages } from 'lucide-react';
import { formatPhoneDisplay, cleanPhoneValue, validatePhone } from '@/lib/utils/phone';
import { useT } from '@/lib/i18n';

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
    // Si el usuario borra todo, limpiar
    if (!raw) {
      setPhoneDisplay('');
      setProfileForm((f) => ({ ...f, phone: '' }));
      setPhoneError(undefined);
      return;
    }
    // Asegurar que empiece con '+'
    const withPlus = raw.startsWith('+') ? raw : `+${raw}`;
    const clean = cleanPhoneValue(withPlus);
    const display = formatPhoneDisplay(clean);
    setPhoneDisplay(display);
    setProfileForm((f) => ({ ...f, phone: clean }));
    const { valid, error } = validatePhone(clean);
    if (!valid) {
      const lang = profileForm.language === 'en' ? 'en' : 'es';
      const msgs: Record<string, Record<string, string>> = {
        no_prefix: {
          es: 'Debe comenzar con el código de país (ej: +56)',
          en: 'Must start with country code (e.g. +1)',
        },
        too_short: { es: 'Número demasiado corto', en: 'Number too short' },
        too_long: {
          es: 'Número demasiado largo (máx. 15 dígitos)',
          en: 'Number too long (max. 15 digits)',
        },
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
      toast({
        title: t.profile_toast_updated_title,
        description: t.profile_toast_updated_desc,
      });
    } catch {
      toast({
        title: t.error_title,
        description: t.profile_toast_error_desc,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarUpload = async (file: File) => {
    try {
      await uploadAvatar(file);
      toast({
        title: t.profile_toast_avatar_title,
        description: t.profile_toast_avatar_desc,
      });
    } catch {
      toast({
        title: t.error_title,
        description: t.profile_toast_avatar_error,
        variant: 'destructive',
      });
    }
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast({
        title: t.error_title,
        description: t.profile_toast_passwords_no_match,
        variant: 'destructive',
      });
      return;
    }

    if (passwordForm.newPassword.length < 6) {
      toast({
        title: t.error_title,
        description: t.profile_toast_password_too_short,
        variant: 'destructive',
      });
      return;
    }

    setIsChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      toast({
        title: t.profile_toast_password_title,
        description: t.profile_toast_password_desc,
      });
      setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch {
      toast({
        title: t.error_title,
        description: t.profile_toast_password_error,
        variant: 'destructive',
      });
    } finally {
      setIsChangingPassword(false);
    }
  };

  if (!user) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-6xl py-6 px-4">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t.profile_title}</h1>
        <p className="text-zinc-500 text-sm mt-1">{t.profile_subtitle}</p>
      </div>

      {/* Main layout: 2 columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* LEFT COLUMN: Avatar + quick info */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {/* Avatar card */}
          <Card>
            <CardContent className="pt-6">
              <AvatarUpload
                currentAvatar={user.avatar}
                userName={user.name}
                onUpload={handleAvatarUpload}
                isLoading={isLoading}
              />
            </CardContent>
          </Card>

          {/* Quick info summary */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
                {t.profile_section_summary}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-zinc-500 shrink-0" />
                <span className="truncate text-zinc-300">{user.name}</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
                <span className="truncate text-zinc-400">{user.email}</span>
              </div>
              {profileForm.position && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="truncate text-zinc-400">{profileForm.position}</span>
                </div>
              )}
              {profileForm.location && (
                <div className="flex items-center gap-2 text-sm">
                  <MapPin className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="truncate text-zinc-400">{profileForm.location}</span>
                </div>
              )}
              {profileForm.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="truncate text-zinc-400">{profileForm.phone}</span>
                </div>
              )}
              {profileForm.timezone && (
                <div className="flex items-center gap-2 text-sm">
                  <Globe className="h-4 w-4 text-zinc-500 shrink-0" />
                  <span className="truncate text-zinc-400">{profileForm.timezone}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT COLUMN: Forms */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Personal Info */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <User className="h-4 w-4" />
                {t.profile_section_personal_title}
              </CardTitle>
              <CardDescription>{t.profile_section_personal_desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleProfileSubmit} className="space-y-4">
                {/* Row 1: Name + Email */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="name">{t.profile_label_name}</Label>
                    <Input
                      id="name"
                      value={profileForm.name}
                      onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="email">{t.profile_label_email}</Label>
                    <Input
                      id="email"
                      type="email"
                      value={user.email}
                      disabled
                      className="bg-zinc-900/50 opacity-60"
                    />
                  </div>
                </div>

                {/* Row 2: Position + Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="position">{t.profile_label_position}</Label>
                    <Input
                      id="position"
                      value={profileForm.position}
                      onChange={(e) => setProfileForm({ ...profileForm, position: e.target.value })}
                      placeholder={t.profile_placeholder_position}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="phone">{t.profile_label_phone}</Label>
                    <Input
                      id="phone"
                      type="tel"
                      value={phoneDisplay}
                      onChange={handlePhoneChange}
                      placeholder="+56 9 1234 5678"
                      className={phoneError ? 'border-red-500 focus-visible:ring-red-500' : ''}
                    />
                    {phoneError && <p className="text-xs text-red-500">{phoneError}</p>}
                  </div>
                </div>

                {/* Row 3: Location + Timezone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="location">{t.profile_label_location}</Label>
                    <Input
                      id="location"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                      placeholder={t.profile_placeholder_location}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="timezone">{t.profile_label_timezone}</Label>
                    <Input
                      id="timezone"
                      value={Intl.DateTimeFormat().resolvedOptions().timeZone}
                      disabled
                      className="bg-zinc-900/50 opacity-60"
                    />
                    <p className="text-xs text-zinc-500">
                      {t.profile_lang_es === 'Español'
                        ? 'Detectada automáticamente de tu navegador'
                        : 'Automatically detected from your browser'}
                    </p>
                  </div>
                </div>

                {/* Row 4: Language + Bio */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
                  <div className="space-y-1.5">
                    <Label htmlFor="language">
                      <Languages className="h-3.5 w-3.5 inline mr-1" />
                      {t.profile_label_language}
                    </Label>
                    <Select
                      id="language"
                      value={profileForm.language}
                      onChange={(e) => setProfileForm({ ...profileForm, language: e.target.value })}
                    >
                      <option value="es">{t.profile_lang_es}</option>
                      <option value="en">{t.profile_lang_en}</option>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="bio">{t.profile_label_bio}</Label>
                    <Textarea
                      id="bio"
                      value={profileForm.bio}
                      onChange={(e) => setProfileForm({ ...profileForm, bio: e.target.value })}
                      placeholder={t.profile_placeholder_bio}
                      rows={3}
                      className="resize-none"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isSaving || !!phoneError} className="gap-2">
                    {isSaving ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.profile_btn_saving}
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4" />
                        {t.profile_btn_save}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Password */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t.profile_section_password_title}
              </CardTitle>
              <CardDescription>{t.profile_section_password_desc}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="currentPassword">{t.profile_label_current_password}</Label>
                    <Input
                      id="currentPassword"
                      type="password"
                      value={passwordForm.currentPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="newPassword">{t.profile_label_new_password}</Label>
                    <Input
                      id="newPassword"
                      type="password"
                      value={passwordForm.newPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, newPassword: e.target.value })
                      }
                      required
                      minLength={6}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="confirmPassword">{t.profile_label_confirm_password}</Label>
                    <Input
                      id="confirmPassword"
                      type="password"
                      value={passwordForm.confirmPassword}
                      onChange={(e) =>
                        setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })
                      }
                      required
                      minLength={6}
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <Button type="submit" disabled={isChangingPassword} className="gap-2">
                    {isChangingPassword ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t.profile_btn_changing_password}
                      </>
                    ) : (
                      <>
                        <Key className="h-4 w-4" />
                        {t.profile_btn_change_password}
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
