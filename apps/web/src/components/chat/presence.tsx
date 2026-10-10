'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Check, ChevronDown } from 'lucide-react';
import { apiService } from '@/services/apiService';
import { socketService } from '@/services/socketService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import styles from './presence.module.css';

export type PresenceStatus = 'ONLINE' | 'AWAY' | 'DND' | 'OFFLINE';
const options: { value: PresenceStatus; label: string }[] = [
  { value: 'ONLINE', label: 'En línea' },
  { value: 'AWAY', label: 'Ausente' },
  { value: 'DND', label: 'No molestar' },
  { value: 'OFFLINE', label: 'Desconectada' },
];
export const presenceLabel = (status: PresenceStatus) => options.find(option => option.value === status)?.label ?? 'Desconectada';

export function usePresence(userId?: string) {
  const [statuses, setStatuses] = useState<Record<string, PresenceStatus>>({});
  const [preference, setPreference] = useState<PresenceStatus>('ONLINE');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    if (!userId) return;
    const result = await apiService.get<{ statuses: Record<string, PresenceStatus>; preference: PresenceStatus }>('/api/chat/presence', true);
    if (result.success && result.data) {
      setStatuses(result.data.statuses ?? {});
      if (options.some(option => option.value === result.data?.preference)) setPreference(result.data.preference);
    }
  }, [userId]);
  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    socketService.onConnect(refresh);
    return () => { window.clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); socketService.offConnect(refresh); };
  }, [refresh]);
  const setStatus = async (status: PresenceStatus) => {
    if (!userId || busy) return;
    setBusy(true);
    setError('');
    const result = await apiService.put<{ status: PresenceStatus }>('/api/chat/presence', { status }, true);
    if (result.success) {
      setPreference(status);
      setStatuses(current => ({ ...current, [userId]: status }));
    } else setError('No se pudo cambiar tu estado. Inténtalo otra vez.');
    setBusy(false);
  };
  return { statusFor: (id: string): PresenceStatus => statuses[id] ?? 'OFFLINE', preference, setStatus, busy, error };
}

export function PresenceAvatar({ name, avatar, status, size = 42 }: { name: string; avatar?: string | null; status: PresenceStatus; size?: number }) {
  const [failed, setFailed] = useState(false);
  const url = getAvatarUrl(avatar);
  return <span className={`${styles.avatarWrap} ${size >= 64 ? styles.largeAvatar : ''}`} style={{ width: size, height: size, flexBasis: size }} title={presenceLabel(status)}>
    <span className={styles.avatar} style={{ fontSize: Math.max(13, size * .3) }}>
      {url && !failed ? <img src={url} alt="" onError={() => setFailed(true)} /> : (name || '?').trim().charAt(0).toLocaleUpperCase('es')}
    </span>
    <span className={`${styles.dot} ${styles[status.toLowerCase()]}`} aria-label={presenceLabel(status)} />
  </span>;
}

export function PresencePicker({ name, avatar, status, onChange, disabled, error }: { name: string; avatar?: string | null; status: PresenceStatus; onChange: (status: PresenceStatus) => void; disabled?: boolean; error?: string }) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); };
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false); };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('pointerdown', onPointer); document.removeEventListener('keydown', onKey); };
  }, [open]);
  return <div className={styles.picker} ref={root}>
    <button type="button" className={styles.trigger} aria-label={`Cambiar estado: ${presenceLabel(status)}`} aria-expanded={open} aria-haspopup="menu" onClick={() => setOpen(value => !value)}>
      <PresenceAvatar name={name} avatar={avatar} status={status} size={32} />
      <span className={styles.triggerText}><strong>Mi estado</strong><small>{presenceLabel(status)}</small></span>
      <ChevronDown size={15} aria-hidden="true" />
    </button>
    {open && <div className={styles.menu} role="menu" aria-label="Seleccionar estado">
      {options.map(option => <button key={option.value} type="button" role="menuitemradio" aria-checked={status === option.value} disabled={disabled} onClick={() => { onChange(option.value); setOpen(false); }}>
        <span className={`${styles.menuDot} ${styles[option.value.toLowerCase()]}`} />{option.label}{status === option.value && <Check size={14} />}
      </button>)}
    </div>}
    {error && <small className={styles.error} role="alert">{error}</small>}
  </div>;
}
