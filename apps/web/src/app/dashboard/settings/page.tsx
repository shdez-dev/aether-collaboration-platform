'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, Moon, Sun } from 'lucide-react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useTheme } from '@/providers/ThemeProvider';
import { C } from '@/lib/colors';
import entrance from '../pageEntrance.module.css';

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const { preferences, loadPreferences, updatePreferences } = usePreferencesStore();
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);

  async function changeTheme(next: 'light' | 'dark') {
    setTheme(next);
    setMessage('');
    if (!preferences) return;
    setSaving(true);
    await updatePreferences({ theme: next });
    if (usePreferencesStore.getState().error) {
      setMessage('La apariencia se guardó en este dispositivo, pero no se pudo sincronizar con tu cuenta.');
    }
    setSaving(false);
  }

  async function toggleNotification(field: 'emailNotifications' | 'inAppNotifications') {
    if (!preferences) return;
    setSaving(true);
    setMessage('');
    await updatePreferences({ [field]: !preferences[field] });
    if (usePreferencesStore.getState().error) setMessage('No se pudo guardar el cambio. Inténtalo de nuevo.');
    setSaving(false);
  }

  const card: React.CSSProperties = {
    background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16,
    padding: '24px', boxShadow: '0 12px 36px rgba(69,45,91,0.05)',
  };

  return (
    <main className={entrance.page} style={{ minHeight: '100%', overflow: 'auto', background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: 'clamp(24px, 5vw, 52px) 20px 72px', display: 'grid', gap: 20 }}>
        <header style={{ marginBottom: 8 }}>
          <h1 style={{ fontFamily: "'Sora', system-ui, sans-serif", fontSize: 28, fontWeight: 700, margin: 0 }}>Ajustes</h1>
          <p style={{ color: C.text3, fontSize: 14, margin: '8px 0 0' }}>Personaliza cómo se ve Aether y cuándo recibes avisos.</p>
        </header>

        <section style={card} aria-labelledby="appearance-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: C.bg2, color: C.accent }}><Sun size={19} /></span>
            <div>
              <h2 id="appearance-title" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Apariencia</h2>
              <p style={{ color: C.text3, fontSize: 12, margin: '3px 0 0' }}>Elige el tema que te resulte más cómodo.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {([['light', 'Claro', Sun], ['dark', 'Oscuro', Moon]] as const).map(([value, label, Icon]) => {
              const selected = theme === value;
              return (
                <button key={value} type="button" aria-pressed={selected} onClick={() => void changeTheme(value)}
                  style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 68, padding: '14px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 12,
                    border: `1px solid ${selected ? C.accent : C.border}`, background: selected ? C.bg2 : C.surface2, color: C.text }}>
                  <Icon size={20} color={selected ? C.accent : C.text3} />
                  <span style={{ flex: 1, fontSize: 14, fontWeight: selected ? 700 : 500 }}>{label}</span>
                  {selected && <Check size={17} color={C.accent} />}
                </button>
              );
            })}
          </div>
        </section>

        <section style={card} aria-labelledby="notifications-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: C.bg2, color: C.accent }}><Bell size={19} /></span>
            <div>
              <h2 id="notifications-title" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Notificaciones</h2>
              <p style={{ color: C.text3, fontSize: 12, margin: '3px 0 0' }}>Controla los avisos de tu cuenta.</p>
            </div>
          </div>
          {([
            ['inAppNotifications', 'Avisos en Aether', 'Notificaciones dentro de la aplicación.'],
            ['emailNotifications', 'Correos electrónicos', 'Recibe novedades importantes por correo.'],
          ] as const).map(([field, label, description]) => (
            <label key={field} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '16px 0', borderTop: `1px solid ${C.border}`, cursor: preferences && !saving ? 'pointer' : 'default' }}>
              <span><strong style={{ display: 'block', fontSize: 13, fontWeight: 650 }}>{label}</strong><small style={{ display: 'block', color: C.text3, fontSize: 12, marginTop: 3 }}>{description}</small></span>
              <input type="checkbox" checked={preferences?.[field] ?? false} disabled={!preferences || saving} onChange={() => void toggleNotification(field)} style={{ width: 18, height: 18, accentColor: C.accent, cursor: 'pointer' }} />
            </label>
          ))}
        </section>
        {message && <p role="status" style={{ color: C.red, fontSize: 13, margin: 0 }}>{message}</p>}
      </div>
    </main>
  );
}
