// apps/web/src/app/dashboard/settings/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import type { UserPreferences } from '@/stores/preferencesStore';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2, Save, Bell, Layout,
  Check, Kanban, Table2,
} from 'lucide-react';
import { useT } from '@/lib/i18n';
import { C } from '@/lib/colors';

// ── Color tokens (mismo sistema que el resto de la app) ───────────────────────

// ── Componentes locales ───────────────────────────────────────────────────────

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

function OptionButton({ selected, onClick, children }: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px',
        padding: '12px', borderRadius: '8px', cursor: 'pointer',
        border: `1.5px solid ${selected ? C.accent : C.border2}`,
        background: selected ? `${C.accent}12` : 'transparent',
        color: selected ? C.accent : C.text3,
        transition: 'all 0.15s', position: 'relative',
      }}
      onMouseEnter={(e) => { if (!selected) { e.currentTarget.style.borderColor = `${C.accent}50`; e.currentTarget.style.color = C.text2; } }}
      onMouseLeave={(e) => { if (!selected) { e.currentTarget.style.borderColor = C.border2; e.currentTarget.style.color = C.text3; } }}
    >
      {selected && (
        <div style={{
          position: 'absolute', top: '6px', right: '6px',
          width: '14px', height: '14px', borderRadius: '50%',
          background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={9} color="#fff" />
        </div>
      )}
      {children}
    </button>
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

// ── Page ──────────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const t = useT();
  const { preferences, isLoading, loadPreferences, updatePreferences } = usePreferencesStore();
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

  useEffect(() => { loadPreferences(); }, [loadPreferences]);

  useEffect(() => {
    if (preferences) setLocalPrefs(preferences);
  }, [preferences]);

  useEffect(() => {
    if (preferences) {
      setHasChanges(JSON.stringify(localPrefs) !== JSON.stringify(preferences));
    }
  }, [localPrefs, preferences]);

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

  if (isLoading && !preferences) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', background: C.bg }}>
        <Loader2 size={28} color={C.text3} style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  const viewOptions = [
    { value: 'kanban', label: t.settings_view_kanban || 'Kanban', icon: Kanban },
    { value: 'table',  label: t.settings_view_table  || 'Table',  icon: Table2 },
  ];

  const frequencyOptions = [
    { value: 'realtime', label: t.settings_freq_realtime_label, desc: t.settings_freq_realtime_desc },
    { value: 'daily',    label: t.settings_freq_daily_label,    desc: t.settings_freq_daily_desc },
    { value: 'weekly',   label: t.settings_freq_weekly_label,   desc: t.settings_freq_weekly_desc },
  ];

  return (
    <div style={{ height: '100%', overflow: 'auto', background: C.bg }}>
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '32px 28px 56px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 700, color: C.text, marginBottom: '4px' }}>
              {t.settings_title}
            </h1>
            <p style={{ fontSize: '13px', color: C.text3 }}>{t.settings_subtitle}</p>
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

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

          {/* Vista de boards */}
          <SectionCard
            icon={<Layout size={16} />}
            title={t.settings_section_board_view}
            desc={t.settings_section_board_view_desc}
          >
            <p style={{ fontSize: '12px', color: C.text3, marginBottom: '10px' }}>
              {t.settings_label_default_view}
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {viewOptions.map(({ value, label, icon: Icon }) => (
                <OptionButton
                  key={value}
                  selected={localPrefs.defaultBoardView === value}
                  onClick={() => setLocalPrefs({ ...localPrefs, defaultBoardView: value as any })}
                >
                  <Icon size={20} />
                  <span style={{ fontSize: '11.5px', fontWeight: 500 }}>{label}</span>
                </OptionButton>
              ))}
            </div>
          </SectionCard>

          {/* Notificaciones (col-span 2) */}
          <div style={{ gridColumn: '1 / -1' }}>
            <SectionCard
              icon={<Bell size={16} />}
              title={t.settings_section_notifications}
              desc={t.settings_section_notifications_desc}
            >
              {/* Badge "En desarrollo" */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: '6px',
                padding: '4px 10px', borderRadius: '20px', marginBottom: '20px',
                background: `${C.amber}12`, border: `1px solid ${C.amber}30`,
              }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: C.amber }} />
                <span style={{ fontSize: '11px', color: C.amber, fontWeight: 600 }}>En desarrollo — próximamente</span>
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
                  <Divider />
                  <ToggleRow
                    label={t.settings_label_inapp_notif}
                    desc={t.settings_inapp_notif_desc}
                    checked={localPrefs.inAppNotifications}
                    onChange={(v) => setLocalPrefs({ ...localPrefs, inAppNotifications: v })}
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
          </div>
        </div>

        {/* Botón guardar mobile */}
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
