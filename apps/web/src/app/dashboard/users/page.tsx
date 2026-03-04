'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { Search, MapPin, Briefcase, UserPlus, Users, Calendar, Star } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import { apiService } from '@/services/apiService';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n';
import { WorkspaceIcon } from '@/components/WorkspaceIcon';
import { formatShort } from '@/lib/utils/date';

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

// ── Panel de favoritos (columna derecha) ────────────────────────────────────

function FavoriteContactsList({
  favorites,
  isLoading,
  onSelectUser,
  selectedUserId,
}: {
  favorites: PublicUser[];
  isLoading: boolean;
  onSelectUser: (userId: string) => void;
  selectedUserId: string | null;
}) {
  const t = useT();

  if (isLoading) {
    return (
      <div className="w-64 flex-shrink-0 flex flex-col border-l border-border bg-surface">
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <h3 className="text-text-primary font-medium text-sm">Favoritos</h3>
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="w-64 flex-shrink-0 flex flex-col border-l border-border bg-surface">
      <div className="px-4 pt-4 pb-3 border-b border-border">
        <h3 className="text-text-primary font-medium text-sm">
          Favoritos
          {favorites.length > 0 && (
            <span className="ml-2 text-text-muted font-normal">{favorites.length}</span>
          )}
        </h3>
      </div>

      <div className="flex-1 overflow-y-auto py-1">
        {favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <Star className="h-8 w-8 text-text-muted mb-2" />
            <p className="text-text-muted text-sm font-medium">Sin favoritos</p>
            <p className="text-text-secondary text-xs mt-1">
              Marca contactos como favoritos para acceder rápidamente
            </p>
          </div>
        ) : (
          favorites.map((user) => {
            const isSelected = user.id === selectedUserId;
            const avatarUrl = getAvatarUrl(user.avatar);
            return (
              <button
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 mx-1 rounded-terminal transition-colors ${
                  isSelected
                    ? 'bg-accent/20 text-text-primary'
                    : 'text-text-secondary hover:bg-card hover:text-text-primary'
                }`}
                style={{ width: 'calc(100% - 8px)' }}
              >
                <Avatar className="h-8 w-8 flex-shrink-0 border border-border">
                  {avatarUrl && (
                    <AvatarImage src={avatarUrl} alt={user.name} crossOrigin="anonymous" />
                  )}
                  <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                    {getInitials(user.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 text-left">
                  <p className="text-sm font-medium truncate leading-tight">{user.name}</p>
                  {user.position && (
                    <p className="text-xs text-text-muted truncate leading-tight">
                      {user.position}
                    </p>
                  )}
                </div>
                {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

// ── Panel de detalle (columna central) ───────────────────────────────────────

function UserDetailPanel({ userId }: { userId: string | null }) {
  const t = useT();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteWorkspaceId, setInviteWorkspaceId] = useState('');
  const [inviteRole, setInviteRole] = useState('MEMBER');
  const [isInviting, setIsInviting] = useState(false);

  const { workspaces, fetchWorkspaces, inviteMember } = useWorkspaceStore();
  const { user: currentUser } = useAuthStore();

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      return;
    }
    setIsLoading(true);
    setProfile(null);
    setInviteWorkspaceId('');

    apiService
      .get<{ user: UserProfile; sharedWorkspaces: UserProfile['sharedWorkspaces'] }>(
        `/api/users/${userId}`,
        true
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
    () =>
      workspaces.filter(
        (w) =>
          (w.userRole === 'OWNER' || w.userRole === 'ADMIN') &&
          !sharedIds.has(w.id) &&
          profile?.id !== currentUser?.id
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
      // Refrescar perfil para que aparezca el nuevo workspace compartido
      const res = await apiService.get<{
        user: UserProfile;
        sharedWorkspaces: UserProfile['sharedWorkspaces'];
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

  // Estado vacío — ningún usuario seleccionado
  if (!userId) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 border-l border-border">
        <div className="w-20 h-20 rounded-full bg-surface border border-border flex items-center justify-center mb-4">
          <Users className="h-9 w-9 text-text-muted" />
        </div>
        <p className="text-text-secondary font-medium">Selecciona un contacto</p>
        <p className="text-text-muted text-sm mt-1">
          Busca y selecciona un contacto para ver su perfil
        </p>
      </div>
    );
  }

  // Cargando
  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center border-l border-border">
        <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex-1 flex items-center justify-center border-l border-border">
        <p className="text-text-muted text-sm">{t.users_profile_error}</p>
      </div>
    );
  }

  const isOwnProfile = profile.id === currentUser?.id;
  const avatarUrl = getAvatarUrl(profile.avatar);

  return (
    <div className="flex-1 flex flex-col border-l border-border overflow-y-auto">
      {/* Banner + Avatar */}
      <div className="relative">
        <div className="h-24 bg-gradient-to-r from-accent/30 via-accent/10 to-transparent" />
        <div className="px-6 pb-4">
          <div className="flex items-end justify-between -mt-10 mb-3">
            <Avatar className="h-20 w-20 border-4 border-background">
              {avatarUrl && (
                <AvatarImage src={avatarUrl} alt={profile.name} crossOrigin="anonymous" />
              )}
              <AvatarFallback className="text-2xl bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                {getInitials(profile.name)}
              </AvatarFallback>
            </Avatar>
            {isOwnProfile && (
              <span className="text-xs text-accent border border-accent/40 px-2 py-0.5 rounded-terminal">
                {t.users_badge_you}
              </span>
            )}
          </div>

          {/* Nombre y datos básicos */}
          <h2 className="text-xl text-text-primary font-medium leading-tight">{profile.name}</h2>
          <p className="text-text-muted text-sm">{profile.email}</p>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            {profile.position && (
              <div className="flex items-center gap-1 text-text-secondary text-sm">
                <Briefcase className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{profile.position}</span>
              </div>
            )}
            {profile.location && (
              <div className="flex items-center gap-1 text-text-secondary text-sm">
                <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{profile.location}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-text-muted text-xs">
              <Calendar className="h-3 w-3 flex-shrink-0" />
              <span>
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

      <div className="px-6 pb-6 space-y-5">
        {/* Bio */}
        {profile.bio && (
          <div className="bg-surface rounded-terminal p-4 border border-border">
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
              {t.users_section_about}
            </p>
            <p className="text-text-secondary text-sm leading-relaxed">{profile.bio}</p>
          </div>
        )}

        {/* Workspaces en común */}
        {profile.sharedWorkspaces.length > 0 && (
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider mb-2">
              {t.users_section_shared_workspaces(profile.sharedWorkspaces.length)}
            </p>
            <div className="space-y-1">
              {profile.sharedWorkspaces.map((w) => (
                <div
                  key={w.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-terminal bg-surface border border-border text-sm"
                >
                  <WorkspaceIcon
                    icon={w.icon}
                    className="w-4 h-4 text-text-secondary flex-shrink-0"
                  />
                  <span className="flex-1 text-text-secondary truncate">{w.name}</span>
                  <span className="text-xs text-text-muted">{w.role}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Invitar a workspace */}
        {!isOwnProfile && invitableWorkspaces.length > 0 && (
          <div className="bg-surface rounded-terminal p-4 border border-border space-y-3">
            <p className="text-xs text-text-muted uppercase tracking-wider">
              {t.users_section_invite}
            </p>
            <select
              value={inviteWorkspaceId}
              onChange={(e) => setInviteWorkspaceId(e.target.value)}
              className="input-terminal w-full text-sm"
            >
              <option value="">{t.users_select_workspace}</option>
              {invitableWorkspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
            <div className="flex gap-2">
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="input-terminal text-sm"
              >
                <option value="MEMBER">{t.role_member}</option>
                <option value="ADMIN">{t.role_admin}</option>
                <option value="VIEWER">{t.role_viewer}</option>
              </select>
              <Button
                size="sm"
                onClick={handleInvite}
                disabled={!inviteWorkspaceId || isInviting}
                className="gap-2 flex-1"
              >
                <UserPlus className="h-4 w-4" />
                {isInviting ? t.users_btn_inviting : t.users_btn_invite}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Página principal ─────────────────────────────────────────────────────────

export default function UsersPage() {
  const t = useT();
  const [allUsers, setAllUsers] = useState<PublicUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const [favoriteUsers, setFavoriteUsers] = useState<PublicUser[]>([]);
  const [isFavoritesLoading, setIsFavoritesLoading] = useState(true);

  // Cargar todos los usuarios de una vez (hasta 200), en segundo plano
  useEffect(() => {
    apiService
      .get<{ users: PublicUser[]; total: number }>('/api/users?limit=200', true)
      .then((res) => {
        if (res.success && res.data) {
          setAllUsers(res.data.users);
        }
      })
      .finally(() => setIsLoading(false));
  }, []);

  // Cargar favoritos
  const loadFavorites = useCallback(() => {
    setIsFavoritesLoading(true);
    apiService
      .get<{ favorites: PublicUser[] }>('/api/users/favorites', true)
      .then((res) => {
        if (res.success && res.data) {
          setFavoriteUsers(res.data.favorites);
        }
      })
      .finally(() => setIsFavoritesLoading(false));
  }, []);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  // Toggle favorito
  const handleToggleFavorite = async (userId: string, isFavorite: boolean) => {
    try {
      if (isFavorite) {
        await apiService.delete(`/api/users/favorites/${userId}`, true);
        toast.success('Contacto eliminado de favoritos');
      } else {
        await apiService.post(`/api/users/favorites/${userId}`, {}, true);
        toast.success('Contacto agregado a favoritos');
      }

      // Actualizar estado local
      setAllUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isFavorite: !isFavorite } : u))
      );

      // Recargar lista de favoritos
      loadFavorites();
    } catch (error) {
      toast.error('Error al actualizar favorito');
    }
  };

  // Filtrado en memoria — instantáneo
  // Require minimum 3 characters for search
  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allUsers;
    if (q.length < 3) return []; // Return empty if less than 3 characters
    return allUsers.filter(
      (u) => u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q)
    );
  }, [allUsers, search]);

  // Si el usuario seleccionado queda fuera del filtro de búsqueda, seleccionar el primero visible
  useEffect(() => {
    // Solo aplicar esta lógica si hay búsqueda activa
    if (!search.trim()) {
      return;
    }
    if (filteredUsers.length === 0) {
      setSelectedUserId(null);
      return;
    }
    const stillVisible = filteredUsers.some((u) => u.id === selectedUserId);
    if (!stillVisible) {
      setSelectedUserId(filteredUsers[0].id);
    }
  }, [filteredUsers, selectedUserId, search]);

  // Atajos de teclado: Ctrl/Cmd+F enfoca el buscador
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

  return (
    <div className="flex h-[calc(100vh-8rem)] overflow-hidden rounded-terminal border border-border">
      {/* ── Sidebar izquierda (lista) ── */}
      <div className="w-72 flex-shrink-0 flex flex-col border-r border-border bg-surface">
        {/* Header del sidebar */}
        <div className="px-4 pt-4 pb-3 border-b border-border">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-text-primary font-medium text-sm">
              Contactos
              {search.trim() && !isLoading && (
                <span className="ml-2 text-text-muted font-normal">{filteredUsers.length}</span>
              )}
            </h2>
          </div>

          {/* Buscador */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted" />
            <input
              ref={searchRef}
              type="text"
              placeholder="Buscar contactos por nombre o email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-terminal w-full pl-8 pr-3 py-1.5 text-sm"
            />
          </div>
        </div>

        {/* Lista de usuarios */}
        <div className="flex-1 overflow-y-auto py-1">
          {!search.trim() ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <Users className="h-8 w-8 text-text-muted mb-2" />
              <p className="text-text-muted text-sm font-medium">Busca tus contactos</p>
              <p className="text-text-secondary text-xs mt-1">
                Usuarios con los que compartes workspaces
              </p>
            </div>
          ) : isLoading ? (
            <div className="space-y-1 px-2 pt-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 px-2 py-2 rounded-terminal animate-pulse"
                >
                  <div className="w-8 h-8 rounded-full bg-border flex-shrink-0" />
                  <div className="space-y-1.5 flex-1">
                    <div className="h-2.5 bg-border rounded w-2/3" />
                    <div className="h-2 bg-border rounded w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : search.trim() && search.trim().length < 3 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-text-muted text-sm">Escribe al menos 3 caracteres para buscar</p>
              <p className="text-text-secondary text-xs mt-1">
                {search.trim().length}/3 caracteres
              </p>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-text-muted text-sm">{t.users_no_results}</p>
              <p className="text-text-secondary text-sm font-medium mt-0.5">"{search}"</p>
            </div>
          ) : (
            filteredUsers.map((u) => {
              const isSelected = u.id === selectedUserId;
              const avatarUrl = getAvatarUrl(u.avatar);
              return (
                <div
                  key={u.id}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 mx-1 rounded-terminal transition-colors group ${
                    isSelected
                      ? 'bg-accent/20 text-text-primary'
                      : 'text-text-secondary hover:bg-card hover:text-text-primary'
                  }`}
                  style={{ width: 'calc(100% - 8px)' }}
                >
                  <button
                    onClick={() => setSelectedUserId(u.id)}
                    className="flex items-center gap-2.5 flex-1 min-w-0 text-left"
                  >
                    <Avatar className="h-8 w-8 flex-shrink-0 border border-border">
                      {avatarUrl && (
                        <AvatarImage src={avatarUrl} alt={u.name} crossOrigin="anonymous" />
                      )}
                      <AvatarFallback className="text-xs bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                        {getInitials(u.name)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate leading-tight">{u.name}</p>
                      <div className="flex items-center gap-1.5">
                        {u.sharedWorkspacesCount && u.sharedWorkspacesCount > 0 && (
                          <span className="text-xs text-accent font-medium">
                            {u.sharedWorkspacesCount}{' '}
                            {u.sharedWorkspacesCount === 1 ? 'workspace' : 'workspaces'}
                          </span>
                        )}
                        {u.position && (
                          <>
                            {u.sharedWorkspacesCount && u.sharedWorkspacesCount > 0 && (
                              <span className="text-xs text-text-muted">•</span>
                            )}
                            <p className="text-xs text-text-muted truncate leading-tight">
                              {u.position}
                            </p>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleToggleFavorite(u.id, u.isFavorite || false);
                    }}
                    className={`flex-shrink-0 p-1 rounded transition-colors ${
                      u.isFavorite
                        ? 'text-yellow-500 hover:text-yellow-600'
                        : 'text-text-muted hover:text-yellow-500 opacity-0 group-hover:opacity-100'
                    }`}
                    title={u.isFavorite ? 'Quitar de favoritos' : 'Agregar a favoritos'}
                  >
                    <Star
                      className="h-4 w-4"
                      fill={u.isFavorite ? 'currentColor' : 'none'}
                      strokeWidth={2}
                    />
                  </button>
                  {isSelected && (
                    <div className="w-1.5 h-1.5 rounded-full bg-accent flex-shrink-0" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* ── Panel de detalle (columna central) ── */}
      <UserDetailPanel userId={selectedUserId} />

      {/* ── Panel de favoritos (columna derecha) ── */}
      <FavoriteContactsList
        favorites={favoriteUsers}
        isLoading={isFavoritesLoading}
        onSelectUser={setSelectedUserId}
        selectedUserId={selectedUserId}
      />
    </div>
  );
}
