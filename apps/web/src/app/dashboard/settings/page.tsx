// apps/web/src/app/dashboard/settings/page.tsx

'use client';

import { useState, useEffect } from 'react';
import { usePreferencesStore } from '@/stores/preferencesStore';
import { useTheme } from '@/providers/ThemeProvider';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import {
  Loader2,
  Save,
  Bell,
  Palette,
  Layout,
  Eye,
  Monitor,
  Sun,
  Moon,
  Check,
  Mail,
  Smartphone,
  MessageSquare,
} from 'lucide-react';

export default function SettingsPage() {
  const { preferences, isLoading, loadPreferences, updatePreferences } = usePreferencesStore();
  const { theme: currentTheme, setTheme, actualTheme } = useTheme();
  const { toast } = useToast();

  const [localPrefs, setLocalPrefs] = useState({
    theme: 'dark' as 'light' | 'dark' | 'system',
    emailNotifications: true,
    pushNotifications: true,
    inAppNotifications: true,
    notificationFrequency: 'realtime' as 'realtime' | 'daily' | 'weekly',
    compactMode: false,
    showArchived: false,
    defaultBoardView: 'kanban' as 'kanban' | 'list' | 'calendar',
  });

  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPreferences();
  }, [loadPreferences]);

  useEffect(() => {
    if (preferences) {
      const newPrefs = {
        ...preferences,
        theme: currentTheme,
      };
      setLocalPrefs(newPrefs);
    }
  }, [preferences, currentTheme]);

  useEffect(() => {
    if (preferences) {
      const changed =
        JSON.stringify(localPrefs) !==
        JSON.stringify({
          ...preferences,
          theme: currentTheme,
        });
      setHasChanges(changed);
    }
  }, [localPrefs, preferences, currentTheme]);

  const handleSave = async () => {
    setIsSaving(true);

    try {
      // Aplicar tema inmediatamente
      setTheme(localPrefs.theme);

      // Guardar preferencias en el backend
      const { theme, ...prefsToSave } = localPrefs;
      await updatePreferences({ ...prefsToSave, theme: localPrefs.theme });

      setHasChanges(false);
      toast({
        title: 'Configuración guardada',
        description: 'Tus preferencias han sido actualizadas exitosamente.',
      });
    } catch (error) {
      toast({
        title: 'Error',
        description: 'No se pudo guardar la configuración. Intenta nuevamente.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleThemeChange = (newTheme: 'light' | 'dark' | 'system') => {
    setLocalPrefs({ ...localPrefs, theme: newTheme });
  };

  if (isLoading && !preferences) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const themeOptions = [
    { value: 'light', label: 'Claro', icon: Sun },
    { value: 'dark', label: 'Oscuro', icon: Moon },
    { value: 'system', label: 'Sistema', icon: Monitor },
  ];

  return (
    <div className="container mx-auto max-w-7xl py-8 px-4">
      <div className="space-y-6">
        {/* Header con botón de guardar */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Configuración</h1>
            <p className="text-muted-foreground mt-2">Personaliza tu experiencia en Aether</p>
          </div>

          {hasChanges && (
            <Button onClick={handleSave} disabled={isSaving} size="lg">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          )}
        </div>

        {/* Grid Layout - 2 columnas en desktop */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* COLUMNA IZQUIERDA */}

          {/* Theme Settings */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Palette className="h-5 w-5 text-primary" />
                <CardTitle>Apariencia</CardTitle>
              </div>
              <CardDescription>Elige el tema que más te guste</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {themeOptions.map(({ value, label, icon: Icon }) => (
                  <button
                    key={value}
                    onClick={() => handleThemeChange(value as any)}
                    className={`
                      relative flex flex-col items-center gap-2 p-4 rounded-lg border-2 transition-all
                      ${
                        localPrefs.theme === value
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-accent/5'
                      }
                    `}
                  >
                    {localPrefs.theme === value && (
                      <div className="absolute top-2 right-2">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    <Icon
                      className={`h-6 w-6 ${localPrefs.theme === value ? 'text-primary' : 'text-muted-foreground'}`}
                    />
                    <span
                      className={`text-sm font-medium ${localPrefs.theme === value ? 'text-primary' : 'text-muted-foreground'}`}
                    >
                      {label}
                    </span>
                  </button>
                ))}
              </div>

              <div className="pt-2">
                <div className="rounded-lg border border-border p-3 bg-accent/5">
                  <div className="flex items-center gap-2 text-sm">
                    <div
                      className={`w-3 h-3 rounded-full ${actualTheme === 'dark' ? 'bg-slate-800' : 'bg-white'} border-2 border-primary`}
                    />
                    <span className="text-muted-foreground">
                      Tema actual:{' '}
                      <span className="font-medium text-foreground">
                        {actualTheme === 'dark' ? 'Oscuro' : 'Claro'}
                      </span>
                    </span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Board View Settings */}
          <Card className="h-fit">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Layout className="h-5 w-5 text-primary" />
                <CardTitle>Vista de Boards</CardTitle>
              </div>
              <CardDescription>Personaliza la visualización de los boards</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="compactMode" className="text-base">
                      Modo Compacto
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Reduce el espaciado para ver más contenido
                    </p>
                  </div>
                  <Switch
                    id="compactMode"
                    checked={localPrefs.compactMode}
                    onCheckedChange={(checked) =>
                      setLocalPrefs({ ...localPrefs, compactMode: checked })
                    }
                  />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label htmlFor="defaultBoardView" className="text-base">
                    Vista Predeterminada
                  </Label>
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    {[
                      { value: 'kanban', label: 'Kanban', icon: '▦' },
                      { value: 'list', label: 'Lista', icon: '☰' },
                      { value: 'calendar', label: 'Calendario', icon: '📅' },
                    ].map(({ value, label, icon }) => (
                      <button
                        key={value}
                        onClick={() =>
                          setLocalPrefs({ ...localPrefs, defaultBoardView: value as any })
                        }
                        className={`
                          flex flex-col items-center gap-1 p-3 rounded-lg border transition-all
                          ${
                            localPrefs.defaultBoardView === value
                              ? 'border-primary bg-primary/10 text-primary'
                              : 'border-border hover:border-primary/50 text-muted-foreground'
                          }
                        `}
                      >
                        <span className="text-2xl">{icon}</span>
                        <span className="text-xs font-medium">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="flex items-center justify-between py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="showArchived" className="text-base">
                      Mostrar Archivados
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Incluye elementos archivados en las vistas
                    </p>
                  </div>
                  <Switch
                    id="showArchived"
                    checked={localPrefs.showArchived}
                    onCheckedChange={(checked) =>
                      setLocalPrefs({ ...localPrefs, showArchived: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* COLUMNA DERECHA - Card más grande para notificaciones */}

          {/* Notification Settings */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                <CardTitle>Notificaciones</CardTitle>
              </div>
              <CardDescription>Controla cómo y cuándo recibes notificaciones</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid md:grid-cols-2 gap-6">
                {/* Columna 1: Tipos de notificación */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Canales
                  </h4>

                  <div className="space-y-4">
                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5 flex items-center gap-2">
                        <Mail className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="emailNotifications" className="text-base">
                            Email
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Recibe actualizaciones por correo
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="emailNotifications"
                        checked={localPrefs.emailNotifications}
                        onCheckedChange={(checked) =>
                          setLocalPrefs({ ...localPrefs, emailNotifications: checked })
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5 flex items-center gap-2">
                        <Smartphone className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="pushNotifications" className="text-base">
                            Push
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Notificaciones en el navegador
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="pushNotifications"
                        checked={localPrefs.pushNotifications}
                        onCheckedChange={(checked) =>
                          setLocalPrefs({ ...localPrefs, pushNotifications: checked })
                        }
                      />
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between py-2">
                      <div className="space-y-0.5 flex items-center gap-2">
                        <MessageSquare className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <Label htmlFor="inAppNotifications" className="text-base">
                            In-App
                          </Label>
                          <p className="text-sm text-muted-foreground">
                            Notificaciones dentro de la app
                          </p>
                        </div>
                      </div>
                      <Switch
                        id="inAppNotifications"
                        checked={localPrefs.inAppNotifications}
                        onCheckedChange={(checked) =>
                          setLocalPrefs({ ...localPrefs, inAppNotifications: checked })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Columna 2: Frecuencia */}
                <div className="space-y-4">
                  <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Frecuencia
                  </h4>

                  <div className="space-y-2">
                    <Label className="text-base">Frecuencia de Email</Label>
                    <div className="space-y-2 pt-2">
                      {[
                        {
                          value: 'realtime',
                          label: 'Tiempo Real',
                          desc: 'Inmediatamente cuando ocurra',
                        },
                        { value: 'daily', label: 'Resumen Diario', desc: 'Una vez al día' },
                        { value: 'weekly', label: 'Resumen Semanal', desc: 'Una vez a la semana' },
                      ].map(({ value, label, desc }) => (
                        <button
                          key={value}
                          onClick={() =>
                            setLocalPrefs({ ...localPrefs, notificationFrequency: value as any })
                          }
                          className={`
                            w-full flex items-center gap-3 p-3 rounded-lg border text-left transition-all
                            ${
                              localPrefs.notificationFrequency === value
                                ? 'border-primary bg-primary/10'
                                : 'border-border hover:border-primary/50 hover:bg-accent/5'
                            }
                          `}
                        >
                          <div className="flex-1">
                            <div
                              className={`font-medium ${localPrefs.notificationFrequency === value ? 'text-primary' : 'text-foreground'}`}
                            >
                              {label}
                            </div>
                            <div className="text-xs text-muted-foreground">{desc}</div>
                          </div>
                          {localPrefs.notificationFrequency === value && (
                            <Check className="h-5 w-5 text-primary" />
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Footer con botón de guardar (sticky en mobile) */}
        {hasChanges && (
          <div className="sticky bottom-4 flex justify-center lg:hidden">
            <Button onClick={handleSave} disabled={isSaving} size="lg" className="shadow-lg">
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4" />
                  Guardar Cambios
                </>
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
