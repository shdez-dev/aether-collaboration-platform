'use client';

import { useEffect, useState } from 'react';
import { Bell, Check, LayoutDashboard, Moon, PanelsTopLeft, Sun } from 'lucide-react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useAuthStore } from '@/stores/authStore';
import { useDashboardModeStore, type DashboardMode } from '@/stores/dashboardModeStore';
import { useTheme } from '@/providers/ThemeProvider';
import { C } from '@/lib/colors';
import entrance from '../pageEntrance.module.css';

export default function SettingsPage() {
  const user = useAuthStore((state) => state.user);
  const { theme, setTheme } = useTheme();
  const { preferences, loadPreferences, updatePreferences } = usePreferencesStore();
  const dashboardMode = useDashboardModeStore((state) => state.mode);
  const loadDashboardMode = useDashboardModeStore((state) => state.loadForUser);
  const setDashboardMode = useDashboardModeStore((state) => state.setMode);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => { void loadPreferences(); }, [loadPreferences]);
  useEffect(() => { if (user?.id) loadDashboardMode(user.id); }, [loadDashboardMode, user?.id]);

  function changeDashboardMode(mode: DashboardMode) {
    if (user?.id) setDashboardMode(user.id, mode);
  }

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

        <section style={card} aria-labelledby="dashboard-layout-title">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
            <span style={{ display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 10, background: C.bg2, color: C.accent }}><LayoutDashboard size={19} /></span>
            <div>
              <h2 id="dashboard-layout-title" style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Diseño de la plataforma</h2>
              <p style={{ color: C.text3, fontSize: 12, margin: '3px 0 0' }}>Elige cómo quieres organizar tu espacio de trabajo.</p>
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {([
              ['normal', 'Vista normal', 'Conserva el Inicio y la navegación actuales.', LayoutDashboard],
              ['personalized', 'Vista personalizable', 'Usa una barra compacta y organiza widgets en una cuadrícula.', PanelsTopLeft],
            ] as const).map(([mode, title, description, Icon]) => {
              const selected = dashboardMode === mode;
              return (
                <button key={mode} type="button" aria-pressed={selected} onClick={() => changeDashboardMode(mode)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 12, minHeight: 94, padding: '15px 16px', textAlign: 'left', cursor: 'pointer', borderRadius: 12,
                    border: `1px solid ${selected ? C.accent : C.border}`, background: selected ? C.bg2 : C.surface2, color: C.text }}>
                  <Icon size={19} color={selected ? C.accent : C.text3} style={{ marginTop: 1, flexShrink: 0 }} />
                  <span style={{ flex: 1 }}>
                    <strong style={{ display: 'block', fontSize: 13, fontWeight: selected ? 700 : 600 }}>{title}</strong>
                    <small style={{ display: 'block', color: C.text3, fontSize: 12, lineHeight: 1.5, marginTop: 5 }}>{description}</small>
                  </span>
                  {selected && <Check size={17} color={C.accent} style={{ flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>
          <p style={{ color: C.text4, fontSize: 11, margin: '12px 0 0' }}>La selección y la distribución se guardan en este navegador.</p>
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
