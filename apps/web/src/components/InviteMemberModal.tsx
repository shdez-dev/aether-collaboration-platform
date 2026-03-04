// apps/web/src/components/InviteMemberModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useT } from '@/lib/i18n';
import { apiService } from '@/services/apiService';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import { X, Star, UserPlus } from 'lucide-react';

interface InviteMemberModalProps {
  workspaceId: string;
  isOpen: boolean;
  onClose: () => void;
}

type Role = 'ADMIN' | 'MEMBER' | 'VIEWER';

interface UserPreview {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  bio?: string;
  position?: string;
  location?: string;
  timezone?: string;
  createdAt?: string;
  isFavorite?: boolean;
}

interface SelectedUser {
  email: string;
  name?: string;
  avatar?: string;
}

export default function InviteMemberModal({
  workspaceId,
  isOpen,
  onClose,
}: InviteMemberModalProps) {
  const t = useT();
  const { inviteMultipleMembers, isLoading } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [emailInput, setEmailInput] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role>('MEMBER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [inviteResults, setInviteResults] = useState<{
    invited: number;
    failed: number;
    details?: any;
  } | null>(null);

  // Estados para búsqueda de usuario en tiempo real
  const [searchResults, setSearchResults] = useState<UserPreview[]>([]);
  const [searchingUser, setSearchingUser] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  // Estados para favoritos
  const [favoriteUsers, setFavoriteUsers] = useState<UserPreview[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [selectedFavorites, setSelectedFavorites] = useState<Set<string>>(new Set());

  // Tabs
  const [activeTab, setActiveTab] = useState<'email' | 'favorites'>('email');

  // Reset form cuando se abre/cierra
  useEffect(() => {
    if (!isOpen) {
      setEmailInput('');
      setSelectedUsers([]);
      setSelectedRole('MEMBER');
      setError('');
      setSuccess(false);
      setInviteResults(null);
      setSelectedFavorites(new Set());
      setActiveTab('email');
      setSearchResults([]);
      setShowDropdown(false);
    } else {
      // Cargar favoritos cuando se abre el modal
      loadFavorites();
      // Focus en el input
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  // Cargar favoritos
  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const response = await apiService.get<{ favorites: UserPreview[] }>(
        '/api/users/favorites',
        true
      );
      if (response.success && response.data) {
        setFavoriteUsers(response.data.favorites);
      }
    } catch (err) {
    } finally {
      setLoadingFavorites(false);
    }
  };

  // Buscar usuarios solo cuando el email es válido
  useEffect(() => {
    const searchUser = async () => {
      const query = emailInput.trim().toLowerCase();

      // Solo buscar si es un email válido completo
      if (!validateEmail(query)) {
        setSearchResults([]);
        setShowDropdown(false);
        return;
      }

      setSearchingUser(true);
      setShowDropdown(true);

      try {
        const authData = localStorage.getItem('aether-auth-storage');
        let token = null;

        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            token = parsed.state?.accessToken || parsed.accessToken;
          } catch (e) {}
        }

        // Buscar por email
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/users/search?email=${encodeURIComponent(query)}`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.user) {
            // Filtrar usuarios ya seleccionados
            const alreadySelected = selectedUsers.some(
              (u) => u.email.toLowerCase() === data.data.user.email.toLowerCase()
            );
            if (!alreadySelected) {
              setSearchResults([data.data.user]);
            } else {
              setSearchResults([]);
            }
          } else {
            setSearchResults([]);
          }
        } else {
          setSearchResults([]);
        }
      } catch (err) {
        setSearchResults([]);
      } finally {
        setSearchingUser(false);
      }
    };

    // Debounce: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      if (emailInput.trim()) {
        searchUser();
      } else {
        setSearchResults([]);
        setShowDropdown(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [emailInput, selectedUsers]);

  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showDropdown) {
          setShowDropdown(false);
        } else {
          onClose();
        }
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose, showDropdown]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

  const handleSelectUser = (user: UserPreview) => {
    // Verificar si ya está seleccionado
    if (selectedUsers.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      setError('Este usuario ya fue agregado');
      return;
    }

    setSelectedUsers([
      ...selectedUsers,
      {
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
    ]);
    setEmailInput('');
    setSearchResults([]);
    setShowDropdown(false);
    setError('');

    // Refocus en el input
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRemoveUser = (email: string) => {
    setSelectedUsers(selectedUsers.filter((u) => u.email !== email));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Backspace en input vacío elimina el último usuario
    if (e.key === 'Backspace' && emailInput === '' && selectedUsers.length > 0) {
      e.preventDefault();
      setSelectedUsers(selectedUsers.slice(0, -1));
    }

    // Enter o Tab para seleccionar el primer resultado
    if ((e.key === 'Enter' || e.key === 'Tab') && searchResults.length > 0) {
      e.preventDefault();
      handleSelectUser(searchResults[0]);
    }
  };

  const toggleFavorite = (userId: string) => {
    const newSelected = new Set(selectedFavorites);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedFavorites(newSelected);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setInviteResults(null);

    let emailsToInvite: string[] = [];

    if (activeTab === 'email') {
      if (selectedUsers.length === 0) {
        setError('Selecciona al menos un usuario');
        return;
      }
      emailsToInvite = selectedUsers.map((u) => u.email);
    } else {
      if (selectedFavorites.size === 0) {
        setError('Selecciona al menos un favorito');
        return;
      }
      emailsToInvite = favoriteUsers
        .filter((user) => selectedFavorites.has(user.id))
        .map((user) => user.email);
    }

    try {
      const results = await inviteMultipleMembers(workspaceId, emailsToInvite, selectedRole);
      setSuccess(true);
      setInviteResults(results);

      // Cerrar modal después de 3 segundos si todas fueron exitosas
      if (results.failed === 0) {
        setTimeout(() => {
          onClose();
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || t.invite_error);
    }
  };

  const roles: { value: Role; label: string; description: string }[] = [
    {
      value: 'VIEWER',
      label: t.invite_role_viewer_label,
      description: t.invite_role_viewer_desc,
    },
    {
      value: 'MEMBER',
      label: t.invite_role_member_label,
      description: t.invite_role_member_desc,
    },
    {
      value: 'ADMIN',
      label: t.invite_role_admin_label,
      description: t.invite_role_admin_desc,
    },
  ];

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-40 animate-fade-in"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="card-terminal max-w-3xl w-full pointer-events-auto animate-scale-in max-h-[90vh] overflow-y-auto"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-normal">{t.invite_title}</h2>
              <p className="text-text-secondary text-sm">
                Invita uno o varios usuarios al workspace
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Success Message */}
          {success && inviteResults && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/50 rounded-terminal">
              <div className="flex items-center gap-3">
                <span className="text-accent text-xl">✓</span>
                <div>
                  <p className="text-accent font-medium">
                    {inviteResults.invited > 0 && `${inviteResults.invited} usuario(s) invitado(s)`}
                  </p>
                  {inviteResults.failed > 0 && (
                    <p className="text-error text-sm mt-1">
                      {inviteResults.failed} invitación(es) fallida(s)
                    </p>
                  )}
                  {inviteResults.details?.failed && inviteResults.details.failed.length > 0 && (
                    <div className="mt-2 text-xs text-text-muted">
                      {inviteResults.details.failed.map((f: any, i: number) => (
                        <div key={i}>
                          • {f.email}: {f.reason}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-border">
            <button
              onClick={() => setActiveTab('email')}
              className={`px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              Por Email
            </button>
            <button
              onClick={() => setActiveTab('favorites')}
              className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
                activeTab === 'favorites'
                  ? 'text-accent border-b-2 border-accent'
                  : 'text-text-muted hover:text-text-secondary'
              }`}
            >
              <Star className="h-4 w-4" />
              Favoritos ({favoriteUsers.length})
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Tab: Email */}
            {activeTab === 'email' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-text-secondary mb-2">
                    Busca usuarios por email
                  </label>

                  {/* Input con chips inline */}
                  <div className="relative">
                    <div
                      className="input-terminal min-h-[42px] flex flex-wrap gap-2 items-center cursor-text"
                      onClick={() => inputRef.current?.focus()}
                    >
                      {/* Chips de usuarios seleccionados */}
                      {selectedUsers.map((user) => (
                        <div
                          key={user.email}
                          className="inline-flex items-center gap-2 bg-accent/20 text-accent border border-accent/40 px-3 py-1 rounded-terminal text-sm animate-scale-in"
                        >
                          {user.avatar && (
                            <Avatar className="h-5 w-5 flex-shrink-0">
                              <AvatarImage
                                src={getAvatarUrl(user.avatar) || undefined}
                                alt={user.name || user.email}
                                crossOrigin="anonymous"
                              />
                              <AvatarFallback className="text-xs">
                                {getInitials(user.name || user.email)}
                              </AvatarFallback>
                            </Avatar>
                          )}
                          <span className="font-medium">{user.name || user.email}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveUser(user.email);
                            }}
                            className="hover:text-accent-dark transition-colors"
                            disabled={isLoading || success}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Input de búsqueda */}
                      <input
                        ref={inputRef}
                        type="text"
                        value={emailInput}
                        onChange={(e) => {
                          setEmailInput(e.target.value);
                          setError('');
                        }}
                        onKeyDown={handleKeyDown}
                        className="flex-1 min-w-[200px] bg-transparent border-none outline-none text-text-primary"
                        placeholder={
                          selectedUsers.length === 0 ? 'Escribe un email para buscar...' : ''
                        }
                        disabled={isLoading || success}
                      />
                    </div>

                    {/* Dropdown de resultados */}
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-terminal shadow-lg z-10 max-h-60 overflow-y-auto">
                        {searchingUser ? (
                          <div className="p-4 flex items-center gap-3">
                            <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                            <span className="text-text-muted text-sm">Buscando...</span>
                          </div>
                        ) : searchResults.length > 0 ? (
                          searchResults.map((user) => {
                            const avatarUrl = getAvatarUrl(user.avatar);
                            return (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => handleSelectUser(user)}
                                className="w-full p-3 hover:bg-surface transition-colors flex items-start gap-3 text-left border-b border-border last:border-b-0"
                              >
                                <Avatar className="h-10 w-10 flex-shrink-0 border border-border">
                                  {avatarUrl && (
                                    <AvatarImage
                                      src={avatarUrl}
                                      alt={user.name}
                                      crossOrigin="anonymous"
                                    />
                                  )}
                                  <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                    {getInitials(user.name)}
                                  </AvatarFallback>
                                </Avatar>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-text-primary font-medium text-sm truncate">
                                      {user.name}
                                    </p>
                                    {user.isFavorite && (
                                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                                    )}
                                  </div>
                                  <p className="text-text-muted text-xs truncate">{user.email}</p>
                                  {user.position && (
                                    <p className="text-text-secondary text-xs truncate mt-0.5">
                                      {user.position}
                                    </p>
                                  )}
                                  {user.bio && (
                                    <p className="text-text-secondary text-xs line-clamp-1 mt-1">
                                      {user.bio}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        ) : validateEmail(emailInput.trim()) ? (
                          <div className="p-4 text-center text-text-muted text-sm">
                            No se encontró ningún usuario con ese email
                          </div>
                        ) : null}
                      </div>
                    )}
                  </div>

                  <p className="text-text-muted text-xs mt-2">
                    {selectedUsers.length > 0 ? (
                      <>
                        {selectedUsers.length} usuario(s) seleccionado(s). Presiona Backspace para
                        eliminar el último.
                      </>
                    ) : (
                      'Escribe un email completo para buscar el usuario'
                    )}
                  </p>
                </div>
              </div>
            )}

            {/* Tab: Favoritos */}
            {activeTab === 'favorites' && (
              <div>
                {loadingFavorites ? (
                  <div className="flex items-center justify-center py-10">
                    <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : favoriteUsers.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <Star className="h-12 w-12 text-text-muted mb-3" />
                    <p className="text-text-muted font-medium">No tienes favoritos</p>
                    <p className="text-text-secondary text-sm mt-1">
                      Marca contactos como favoritos para invitarlos rápidamente
                    </p>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-text-secondary mb-3">
                      Selecciona usuarios favoritos para invitar ({selectedFavorites.size}{' '}
                      seleccionado{selectedFavorites.size !== 1 ? 's' : ''}):
                    </p>
                    <div className="max-h-96 overflow-y-auto space-y-2 bg-card border border-border rounded-terminal p-3">
                      {favoriteUsers.map((user) => {
                        const isSelected = selectedFavorites.has(user.id);
                        const avatarUrl = getAvatarUrl(user.avatar);
                        return (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => toggleFavorite(user.id)}
                            disabled={isLoading || success}
                            className={`w-full flex items-center gap-3 p-3 rounded-terminal transition-all ${
                              isSelected
                                ? 'bg-accent/10 border-2 border-accent'
                                : 'bg-surface border-2 border-transparent hover:border-accent/30'
                            }`}
                          >
                            <Avatar className="h-10 w-10 flex-shrink-0 border border-border">
                              {avatarUrl && (
                                <AvatarImage
                                  src={avatarUrl}
                                  alt={user.name}
                                  crossOrigin="anonymous"
                                />
                              )}
                              <AvatarFallback className="text-sm bg-gradient-to-br from-blue-500 to-purple-600 text-white">
                                {getInitials(user.name)}
                              </AvatarFallback>
                            </Avatar>
                            <div className="flex-1 text-left min-w-0">
                              <p className="text-text-primary font-medium text-sm truncate">
                                {user.name}
                              </p>
                              <p className="text-text-muted text-xs truncate">{user.email}</p>
                              {user.position && (
                                <p className="text-text-secondary text-xs truncate">
                                  {user.position}
                                </p>
                              )}
                            </div>
                            {isSelected && (
                              <div className="flex-shrink-0 w-5 h-5 rounded bg-accent flex items-center justify-center">
                                <span className="text-white text-xs">✓</span>
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Error Message */}
            {error && (
              <p className="text-error text-sm flex items-center gap-2 p-3 bg-error/10 border border-error/30 rounded-terminal">
                <span>⚠</span> {error}
              </p>
            )}

            {/* Role Selector */}
            <div>
              <label className="block text-sm text-text-secondary mb-3">
                Rol para los usuarios invitados
              </label>
              <div className="space-y-2">
                {roles.map((role) => (
                  <button
                    key={role.value}
                    type="button"
                    onClick={() => setSelectedRole(role.value)}
                    disabled={isLoading || success}
                    className={`w-full p-4 rounded-terminal border transition-all text-left ${
                      selectedRole === role.value
                        ? 'border-accent bg-accent/10'
                        : 'border-border hover:border-accent/50 bg-card'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className={`font-medium ${
                          selectedRole === role.value ? 'text-accent' : 'text-text-primary'
                        }`}
                      >
                        {role.label}
                      </span>
                      {selectedRole === role.value && <span className="text-accent">✓</span>}
                    </div>
                    <p className="text-text-secondary text-xs">{role.description}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn-secondary flex-1"
              >
                {t.btn_cancel}
              </button>
              <button
                type="submit"
                disabled={
                  isLoading ||
                  success ||
                  (activeTab === 'email' && selectedUsers.length === 0) ||
                  (activeTab === 'favorites' && selectedFavorites.size === 0)
                }
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <UserPlus className="h-4 w-4" />
                {isLoading
                  ? 'Invitando...'
                  : success
                    ? 'Invitados'
                    : activeTab === 'email'
                      ? `Invitar ${selectedUsers.length} usuario(s)`
                      : `Invitar ${selectedFavorites.size} favorito(s)`}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
