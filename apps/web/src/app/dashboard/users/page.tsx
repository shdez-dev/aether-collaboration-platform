'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Search, MapPin, Briefcase, UserPlus, Users, Calendar, Star } from 'lucide-react';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import { apiService } from '@/services/apiService';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { formatShort } from '@/lib/utils/date';
import { C } from '@/lib/colors';

// ─── Design tokens ────────────────────────────────────────────────────────────


// ─── Types ────────────────────────────────────────────────────────────────────

interface PublicUser {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  position?: string;
  location?: string;
  createdAt: string;
  sharedWorkspacesCount?: number;
  isFavorite?: boolean;
}

interface UserProfile extends PublicUser {
  sharedWorkspaces: {
    id: string;
    name: string;
    icon?: string;
    color?: string;
    role: string;
  }[];
}

// ─── Avatar helper ────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#fb923c', '#84cc16',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function UserAvatar({ user, size = 32 }: { user: { name: string; avatar?: string }; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const url = getAvatarUrl(user.avatar);
  const initials = getInitials(user.name);
  const color = avatarColor(user.name);
  const fontSize = size <= 32 ? '11px' : size <= 48 ? '14px' : '20px';

  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: color, display: 'flex', alignItems: 'center', justifyContent: 'center',
      overflow: 'hidden', border: `2px solid ${C.border}`,
    }}>
      {url && !imgErr ? (
        <img
          src={url}
          alt={user.name}
          crossOrigin="anonymous"
          onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      ) : (
        <span style={{ fontSize, fontWeight: 600, color: '#fff', lineHeight: 1 }}>{initials}</span>
      )}
    </div>
  );
}

// ─── Panel de detalle ─────────────────────────────────────────────────────────

function UserDetailPanel({ userId }: { userId: string | null }) {
  const t = useT();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isInviting, setIsInviting] = useState(false);

  const { workspaces, fetchWorkspaces, inviteMember } = useWorkspaceStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  useEffect(() => {
    if (!userId) { setProfile(null); return; }
    setIsLoading(true);
    setProfile(null);
    setInviteWorkspaceId('');
    apiService
      .get<{ user: UserProfile; sharedWorkspaces: UserProfile['sharedWorkspaces'] }>(
        `/api/users/${userId}`, true
      )
      .then((res) => {
        if (res.success && res.data) {
          setProfile({ ...res.data.user, sharedWorkspaces: res.data.sharedWorkspaces });
        }
      })
      .finally(() => setIsLoading(false));
  }, [userId]);

  const sharedIds = useMemo(() => new Set(profile?.sharedWorkspaces.map((w) => w.id)), [profile]);
  const invitableWorkspaces = useMemo(
    () => workspaces.filter(
      (w) => (w.userRole === 'OWNER' || w.userRole === 'ADMIN') &&
        !sharedIds.has(w.id) && profile?.id !== currentUser?.id
    ),
    [workspaces, sharedIds, profile, currentUser]
  );

  const handleInvite = async () => {
    if (!inviteWorkspaceId || !profile) return;
    setIsInviting(true);
    try {
      await inviteMember(inviteWorkspaceId, profile.email, inviteRole);
      toast.success(t.users_toast_invited(profile.name));
      setInviteWorkspaceId('');
      const res = await apiService.get<{
        user: UserProfile; sharedWorkspaces: UserProfile['sharedWorkspaces'];
      }>(`/api/users/${userId}`, true);
      if (res.success && res.data) {
        setProfile({ ...res.data.user, sharedWorkspaces: res.data.sharedWorkspaces });
      }
    } catch (err: any) {
      toast.error(err?.message || t.users_toast_invite_error);
    } finally {
      setIsInviting(false);
    }
  };

  // Estado vacío
  if (!userId) {
    return (
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '32px',
        borderLeft: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: '52px', height: '52px', borderRadius: '14px',
          background: `${C.accent}12`, border: `1px solid ${C.accent}25`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          marginBottom: '14px',
        }}>
          <Users style={{ width: '22px', height: '22px', color: C.text4 }} />
        </div>
        <p style={{ fontSize: '14px', fontWeight: 500, color: C.text2, marginBottom: '6px' }}>
          Selecciona un contacto
        </p>
        <p style={{ fontSize: '12.5px', color: C.text4, maxWidth: '260px', lineHeight: 1.6 }}>
          Haz clic en cualquier contacto de la lista para ver su perfil
        </p>
      </div>
    );
  }

  // Cargando
  if (isLoading) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderLeft: `1px solid ${C.border}`,
      }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
      </div>
    );
  }

  if (!profile) {
    return (
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        borderLeft: `1px solid ${C.border}`,
      }}>
        <p style={{ fontSize: '13px', color: C.text4 }}>{t.users_profile_error}</p>
      </div>
    );
  }

  const isOwnProfile = profile.id === currentUser?.id;

  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column',
      borderLeft: `1px solid ${C.border}`, overflowY: 'auto',
    }}>
      {/* Banner + Avatar */}
      <div style={{ position: 'relative', flexShrink: 0 }}>
        <div style={{
          height: '72px',
          background: `linear-gradient(135deg, ${C.accent}28 0%, ${C.accent}0a 60%, transparent 100%)`,
          borderBottom: `1px solid ${C.border}`,
        }} />
        <div style={{ padding: '0 24px 20px' }}>
          <div style={{
            display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
            marginTop: '-28px', marginBottom: '12px',
          }}>
            <div style={{ border: `3px solid ${C.bg}`, borderRadius: '50%' }}>
              <UserAvatar user={profile} size={56} />
            </div>
            {isOwnProfile && (
              <span style={{
                fontSize: '11px', color: C.accent,
                border: `1px solid ${C.accent}40`, borderRadius: '5px',
                padding: '2px 8px', marginBottom: '4px',
              }}>
                {t.users_badge_you}
              </span>
            )}
          </div>

          <h2 style={{ fontSize: '17px', fontWeight: 600, color: C.text, marginBottom: '2px' }}>
            {profile.name}
          </h2>
          <p style={{ fontSize: '12.5px', color: C.text4, marginBottom: '10px' }}>{profile.email}</p>

          {/* Metadata row */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 20px' }}>
            {profile.position && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <Briefcase style={{ width: '12px', height: '12px', color: C.text4, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: C.text3 }}>{profile.position}</span>
              </div>
            )}
            {profile.location && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <MapPin style={{ width: '12px', height: '12px', color: C.text4, flexShrink: 0 }} />
                <span style={{ fontSize: '12px', color: C.text3 }}>{profile.location}</span>
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <Calendar style={{ width: '11px', height: '11px', color: C.text4, flexShrink: 0 }} />
              <span style={{ fontSize: '11.5px', color: C.text4 }}>
                {t.users_joined(
                  formatShort(
                    new Date(profile.createdAt),
                    currentUser?.timezone,
                    currentUser?.language as 'es' | 'en'
                  )
                )}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Secciones */}
      <div style={{ padding: '0 24px 24px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Bio */}
        {profile.bio && (
          <Section label={t.users_section_about}>
            <p style={{ fontSize: '13px', color: C.text3, lineHeight: 1.65 }}>{profile.bio}</p>
          </Section>
        )}

        {/* Workspaces compartidos */}
        {profile.sharedWorkspaces.length > 0 && (
          <Section label={t.users_section_shared_workspaces(profile.sharedWorkspaces.length)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {profile.sharedWorkspaces.map((w) => (
                <WsRow key={w.id} workspace={w} />
              ))}
            </div>
          </Section>
        )}

        {/* Invitar */}
        {!isOwnProfile && invitableWorkspaces.length > 0 && (
          <Section label={t.users_section_invite}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <StyledSelect
                value={inviteWorkspaceId}
                onChange={(v) => setInviteWorkspaceId(v)}
              >
                <option value="">{t.users_select_workspace}</option>
                {invitableWorkspaces.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </StyledSelect>
              <div style={{ display: 'flex', gap: '8px' }}>
                <StyledSelect
                  value={inviteRole}
                  onChange={(v) => setInviteRole(v)}
                  style={{ width: '130px', flexShrink: 0 }}
                >
                  <option value="MEMBER">{t.role_member}</option>
                  <option value="ADMIN">{t.role_admin}</option>
                  <option value="VIEWER">{t.role_viewer}</option>
                </StyledSelect>
                <InviteBtn
                  onClick={handleInvite}
                  disabled={!inviteWorkspaceId || isInviting}
                  isInviting={isInviting}
                  label={t.users_btn_invite}
                  loadingLabel={t.users_btn_inviting}
                />
              </div>
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

// ─── Helpers panel detalle ─────────────────────────────────────────────────────

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: C.bg2, border: `1px solid ${C.border}`,
      borderRadius: '9px', padding: '14px 16px',
    }}>
      <p style={{
        fontSize: '10.5px', fontWeight: 500, color: C.text4,
        textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '10px',
      }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function WsRow({ workspace }: { workspace: { id: string; name: string; icon?: string; color?: string; role: string } }) {
  const [h, setH] = useState(false);
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '7px 10px', borderRadius: '7px',
        background: h ? C.hover : 'transparent',
        transition: 'background 0.1s',
      }}
    >
      <div style={{
        width: '26px', height: '26px', borderRadius: '6px', flexShrink: 0,
        background: workspace.color ? `${workspace.color}22` : `${C.accent}18`,
        border: `1px solid ${workspace.color ? `${workspace.color}40` : `${C.accent}30`}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <WorkspaceIcon icon={workspace.icon} className="w-3.5 h-3.5" style={{ color: workspace.color || C.accent }} />
      </div>
      <span style={{ flex: 1, fontSize: '13px', color: C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {workspace.name}
      </span>
      <span style={{
        fontSize: '10.5px', color: C.text4,
        background: C.surface, border: `1px solid ${C.border}`,
        borderRadius: '4px', padding: '1px 6px',
      }}>
        {workspace.role}
      </span>
    </div>
  );
}

function StyledSelect({ value, onChange, children, style }: {
  value: string; onChange: (v: string) => void;
  children: React.ReactNode; style?: React.CSSProperties;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        flex: 1, padding: '7px 10px', borderRadius: '7px',
        background: C.surface, border: `1px solid ${C.border2}`,
        color: value ? C.text : C.text4, fontSize: '13px', outline: 'none',
        cursor: 'pointer', ...style,
      }}
    >
      {children}
    </select>
  );
}

function InviteBtn({ onClick, disabled, isInviting, label, loadingLabel }: {
  onClick: () => void; disabled?: boolean; isInviting: boolean; label: string; loadingLabel: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '7px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
        background: C.accent, color: '#fff', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.12s',
      }}
    >
      {isInviting ? (
        <>
          <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
          </svg>
          {loadingLabel}
        </>
      ) : (
        <>
          <UserPlus style={{ width: '13px', height: '13px' }} />
          {label}
        </>
      )}
    </button>
  );
}

// ─── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useT();
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showFavOnly, setShowFavOnly] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [favoriteUsers, setFavoriteUsers] = useState<PublicUser[]>([]);
  const [searchFocused, setSearchFocused] = useState(false);

  useEffect(() => {
    apiService
      .get<{ users: PublicUser[]; total: number }>('/api/users?limit=200', true)
      .then((res) => { if (res.success && res.data) setAllUsers(res.data.users); })
      .finally(() => setIsLoading(false));
  }, []);

  const loadFavorites = useCallback(() => {
    apiService
      .get<{ favorites: PublicUser[] }>('/api/users/favorites', true)
      .then((res) => { if (res.success && res.data) setFavoriteUsers(res.data.favorites); });
  }, []);

  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  const handleToggleFavorite = async (userId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await apiService.delete(`/api/users/favorites/${userId}`, true);
        toast.success('Contacto eliminado de favoritos');
      } else {
        await apiService.post(`/api/users/favorites/${userId}`, {}, true);
        toast.success('Contacto agregado a favoritos');
      }
      setAllUsers((prev) => prev.map((u) => u.id === userId ? { ...u, isFavorite: !isFavorite } : u));
      loadFavorites();
    } catch {
      toast.error('Error al actualizar favorito');
    }
  };

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    let base = showFavOnly
      ? allUsers.filter((u) => favoriteUsers.some((f) => f.id === u.id))
      : allUsers;
    if (!q) return base;
    return base.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [allUsers, search, showFavOnly, favoriteUsers]);

  // Si el seleccionado queda fuera del filtro, auto-select primero
  useEffect(() => {
    if (filteredUsers.length === 0) { setSelectedUserId(null); return; }
    if (search.trim() || showFavOnly) {
      const stillVisible = filteredUsers.some((u) => u.id === selectedUserId);
      if (!stillVisible) setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId, search, showFavOnly]);

  // Ctrl/Cmd+F enfoca buscador
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  const favCount = favoriteUsers.length;

  return (
    <div style={{
      display: 'flex', height: 'calc(100vh - 0px)', overflow: 'hidden',
      background: C.bg,
    }}>
      {/* ── Panel izquierdo: lista ──────────────────────────────────────────── */}
      <div style={{
        width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: C.surface, borderRight: `1px solid ${C.border}`,
      }}>
        {/* Header lista */}
        <div style={{
          padding: '14px 14px 10px',
          borderBottom: `1px solid ${C.border}`,
          flexShrink: 0,
        }}>
          {/* Título + toggle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: C.text }}>Contactos</span>
              {!isLoading && (
                <span style={{
                  fontSize: '11px', color: C.text4,
                  background: C.bg2, border: `1px solid ${C.border}`,
                  borderRadius: '4px', padding: '0 5px',
                }}>
                  {filteredUsers.length}
                </span>
              )}
            </div>
            {/* Toggle Todos / ★ */}
            <div style={{
              display: 'flex', background: C.bg2, border: `1px solid ${C.border}`,
              borderRadius: '6px', padding: '2px',
            }}>
              <ToggleBtn active={!showFavOnly} onClick={() => setShowFavOnly(false)} label="Todos" />
              <ToggleBtn
                active={showFavOnly}
                onClick={() => setShowFavOnly(true)}
                label={`★ ${favCount > 0 ? favCount : ''}`}
              />
            </div>
          </div>

          {/* Search */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '7px',
            padding: '0 9px',
            background: C.bg2,
            border: `1px solid ${searchFocused ? C.accent : C.border}`,
            borderRadius: '7px', transition: 'border-color 0.15s',
          }}>
            <Search style={{ width: '12px', height: '12px', color: C.text4, flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar por nombre o email…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                fontSize: '12.5px', color: C.text, padding: '7px 0',
              }}
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.text4, lineHeight: 1, padding: '0 2px' }}
              >
                <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.8" width="10" height="10">
                  <path d="M1 1l10 10M11 1L1 11" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '6px 0' }}>
          {isLoading ? (
            <div style={{ padding: '6px 10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="animate-pulse" style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '8px 10px', borderRadius: '8px',
                }}>
                  <div style={{ width: '34px', height: '34px', borderRadius: '50%', background: C.border, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ height: '11px', background: C.border, borderRadius: '4px', width: '60%' }} />
                    <div style={{ height: '9px', background: C.border, borderRadius: '4px', width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredUsers.length === 0 ? (
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              justifyContent: 'center', padding: '40px 20px', textAlign: 'center',
            }}>
              {showFavOnly ? (
                <>
                  <Star style={{ width: '22px', height: '22px', color: C.text4, marginBottom: '10px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 500, color: C.text3 }}>Sin favoritos</p>
                  <p style={{ fontSize: '11.5px', color: C.text4, marginTop: '4px' }}>
                    Marca contactos con ★ para verlos aquí
                  </p>
                </>
              ) : (
                <>
                  <Users style={{ width: '22px', height: '22px', color: C.text4, marginBottom: '10px' }} />
                  <p style={{ fontSize: '13px', fontWeight: 500, color: C.text3 }}>Sin resultados</p>
                  <p style={{ fontSize: '11.5px', color: C.text4, marginTop: '4px' }}>"{search}"</p>
                </>
              )}
            </div>
          ) : (
            filteredUsers.map((u) => (
              <ContactRow
                key={u.id}
                user={u}
                isSelected={u.id === selectedUserId}
                onSelect={() => setSelectedUserId(u.id)}
                onToggleFav={(e) => { e.stopPropagation(); handleToggleFavorite(u.id, u.isFavorite || false); }}
              />
            ))
          )}
        </div>
      </div>

      {/* ── Panel derecho: detalle ──────────────────────────────────────────── */}
      <UserDetailPanel userId={selectedUserId} />
    </div>
  );
}

// ─── ContactRow ───────────────────────────────────────────────────────────────

function ContactRow({ user, isSelected, onSelect, onToggleFav }: {
  user: PublicUser;
  isSelected: boolean;
  onSelect: () => void;
  onToggleFav: (e: React.MouseEvent) => void;
}) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={onSelect}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 12px', margin: '0 6px',
        borderRadius: '8px', cursor: 'pointer',
        background: isSelected ? `${C.accent}18` : hovered ? C.hover : 'transparent',
        borderLeft: isSelected ? `2px solid ${C.accent}` : '2px solid transparent',
        transition: 'background 0.1s',
      }}
    >
      <UserAvatar user={user} size={34} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: '13px', fontWeight: 500,
          color: isSelected ? C.text : hovered ? C.text : C.text2,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          lineHeight: 1.35,
        }}>
          {user.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
          {user.sharedWorkspacesCount && user.sharedWorkspacesCount > 0 ? (
            <span style={{ fontSize: '11px', color: C.accent, fontWeight: 500 }}>
              {user.sharedWorkspacesCount} {user.sharedWorkspacesCount === 1 ? 'workspace' : 'workspaces'}
            </span>
          ) : null}
          {user.position && (
            <>
              {user.sharedWorkspacesCount && user.sharedWorkspacesCount > 0 && (
                <span style={{ fontSize: '10px', color: C.text4 }}>·</span>
              )}
              <span style={{
                fontSize: '11px', color: C.text4,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {user.position}
              </span>
            </>
          )}
        </div>
      </div>

      <button
        onClick={onToggleFav}
        style={{
          flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: '3px',
          color: user.isFavorite ? C.amber : C.text4,
          opacity: user.isFavorite ? 1 : hovered ? 1 : 0,
          transition: 'opacity 0.1s, color 0.1s',
        }}
        title={user.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
      >
        <Star
          style={{ width: '13px', height: '13px' }}
          fill={user.isFavorite ? 'currentColor' : 'none'}
          strokeWidth={2}
        />
      </button>
    </div>
  );
}

// ─── ToggleBtn ────────────────────────────────────────────────────────────────

function ToggleBtn({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '3px 8px', borderRadius: '4px', fontSize: '11.5px', fontWeight: 500,
        background: active ? C.surface : 'transparent',
        border: active ? `1px solid ${C.border2}` : '1px solid transparent',
        color: active ? C.text : C.text4, cursor: 'pointer',
        transition: 'all 0.1s',
      }}
    >
      {label}
    </button>
  );
}
