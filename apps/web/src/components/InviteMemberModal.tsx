// apps/web/src/components/InviteMemberModal.tsx
'use client';

import { useState, useEffect, useRef } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useT } from '@/lib/i18n';
import { apiService } from '@/services/apiService';
import { getAvatarUrl, getInitials } from '@/lib/utils/avatar';
import { X, Star, UserPlus } from 'lucide-react';
import { C } from '@/lib/colors';

// ─── Design tokens ────────────────────────────────────────────────────────────


// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Modal ────────────────────────────────────────────────────────────────────

export default function InviteMemberModal({ workspaceId, isOpen, onClose }: InviteMemberModalProps) {
  const t = useT();
  const { inviteMultipleMembers, isLoading } = useWorkspaceStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [emailInput, setEmailInput]     = useState('');
  const [selectedUsers, setSelectedUsers] = useState<SelectedUser[]>([]);
  const [selectedRole, setSelectedRole]   = useState<Role>('MEMBER');
  const [error, setError]                 = useState('');
  const [success, setSuccess]             = useState(false);
  const [inviteResults, setInviteResults] = useState<{ invited: number; failed: number; details?: any } | null>(null);

  const [searchResults, setSearchResults]   = useState<UserPreview[]>([]);
  const [searchingUser, setSearchingUser]   = useState(false);
  const [showDropdown, setShowDropdown]     = useState(false);

  const [favoriteUsers, setFavoriteUsers]     = useState<UserPreview[]>([]);
  const [loadingFavorites, setLoadingFavorites] = useState(false);
  const [selectedFavorites, setSelectedFavorites] = useState<Set<string>>(new Set());

  const [activeTab, setActiveTab] = useState<'email' | 'favorites'>('email');

  useEffect(() => {
    if (!isOpen) {
      setEmailInput(''); setSelectedUsers([]); setSelectedRole('MEMBER');
      setError(''); setSuccess(false); setInviteResults(null);
      setSelectedFavorites(new Set()); setActiveTab('email');
      setSearchResults([]); setShowDropdown(false);
    } else {
      loadFavorites();
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const loadFavorites = async () => {
    setLoadingFavorites(true);
    try {
      const response = await apiService.get<{ favorites: UserPreview[] }>('/api/users/favorites', true);
      if (response.success && response.data) setFavoriteUsers(response.data.favorites);
    } catch {}
    finally { setLoadingFavorites(false); }
  };

  useEffect(() => {
    const searchUser = async () => {
      const query = emailInput.trim().toLowerCase();
      if (!validateEmail(query)) { setSearchResults([]); setShowDropdown(false); return; }
      setSearchingUser(true); setShowDropdown(true);
      try {
        const authData = localStorage.getItem('aether-auth-storage');
        let token = null;
        if (authData) {
          try { const p = JSON.parse(authData); token = p.state?.accessToken || p.accessToken; } catch {}
        }
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/users/search?email=${encodeURIComponent(query)}`,
          { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
        );
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.user) {
            const alreadySelected = selectedUsers.some(
              (u) => u.email.toLowerCase() === data.data.user.email.toLowerCase()
            );
            setSearchResults(alreadySelected ? [] : [data.data.user]);
          } else { setSearchResults([]); }
        } else { setSearchResults([]); }
      } catch { setSearchResults([]); }
      finally { setSearchingUser(false); }
    };

    const id = setTimeout(() => {
      if (emailInput.trim()) searchUser();
      else { setSearchResults([]); setShowDropdown(false); }
    }, 500);
    return () => clearTimeout(id);
  }, [emailInput, selectedUsers]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (showDropdown) setShowDropdown(false);
        else onClose();
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose, showDropdown]);

  if (!isOpen) return null;

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSelectUser = (user: UserPreview) => {
    if (selectedUsers.some((u) => u.email.toLowerCase() === user.email.toLowerCase())) {
      setError('Este usuario ya fue agregado'); return;
    }
    setSelectedUsers([...selectedUsers, { email: user.email, name: user.name, avatar: user.avatar }]);
    setEmailInput(''); setSearchResults([]); setShowDropdown(false); setError('');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const handleRemoveUser = (email: string) =>
    setSelectedUsers(selectedUsers.filter((u) => u.email !== email));

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && emailInput === '' && selectedUsers.length > 0) {
      e.preventDefault(); setSelectedUsers(selectedUsers.slice(0, -1));
    }
    if ((e.key === 'Enter' || e.key === 'Tab') && searchResults.length > 0) {
      e.preventDefault(); handleSelectUser(searchResults[0]);
    }
  };

  const toggleFavorite = (userId: string) => {
    const next = new Set(selectedFavorites);
    next.has(userId) ? next.delete(userId) : next.add(userId);
    setSelectedFavorites(next);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault(); setError(''); setInviteResults(null);
    let emailsToInvite: string[] = [];
    if (activeTab === 'email') {
      if (selectedUsers.length === 0) { setError('Selecciona al menos un usuario'); return; }
      emailsToInvite = selectedUsers.map((u) => u.email);
    } else {
      if (selectedFavorites.size === 0) { setError('Selecciona al menos un favorito'); return; }
      emailsToInvite = favoriteUsers.filter((u) => selectedFavorites.has(u.id)).map((u) => u.email);
    }
    try {
      const results = await inviteMultipleMembers(workspaceId, emailsToInvite, selectedRole);
      setSuccess(true); setInviteResults(results);
      if (results.failed === 0) setTimeout(() => onClose(), 2000);
    } catch (err: any) { setError(err.message || t.invite_error); }
  };

  const roles: { value: Role; label: string; description: string }[] = [
    { value: 'VIEWER', label: t.invite_role_viewer_label, description: t.invite_role_viewer_desc },
    { value: 'MEMBER', label: t.invite_role_member_label, description: t.invite_role_member_desc },
    { value: 'ADMIN',  label: t.invite_role_admin_label,  description: t.invite_role_admin_desc  },
  ];

  const canSubmit =
    !isLoading && !success &&
    (activeTab === 'email' ? selectedUsers.length > 0 : selectedFavorites.size > 0);

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 40,
          background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(4px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px', pointerEvents: 'none',
      }}>
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: '100%', maxWidth: '560px', pointerEvents: 'auto',
            background: '#13161b', border: `1px solid ${C.border}`,
            borderRadius: '12px', overflow: 'hidden',
            boxShadow: '0 24px 64px rgba(0,0,0,0.6)',
            maxHeight: '90vh', display: 'flex', flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 20px 16px', borderBottom: `1px solid ${C.border}`, flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: '30px', height: '30px', borderRadius: '8px',
                background: `${C.accent}18`, border: `1px solid ${C.accent}33`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                <UserPlus style={{ width: '14px', height: '14px', color: C.accent }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: C.text }}>{t.invite_title}</div>
                <div style={{ fontSize: '11.5px', color: C.text4 }}>Invita uno o varios usuarios al workspace</div>
              </div>
            </div>
            <CloseBtn onClick={onClose} />
          </div>

          {/* Scrollable body */}
          <div style={{ overflowY: 'auto', flex: 1 }}>

            {/* Success banner */}
            {success && inviteResults && (
              <div style={{
                margin: '16px 20px 0',
                padding: '12px 14px', borderRadius: '8px',
                background: `${C.green}12`, border: `1px solid ${C.green}30`,
                display: 'flex', alignItems: 'flex-start', gap: '10px',
              }}>
                <span style={{ fontSize: '15px', color: C.green, lineHeight: 1.2 }}>✓</span>
                <div>
                  {inviteResults.invited > 0 && (
                    <p style={{ fontSize: '13px', fontWeight: 500, color: C.green }}>
                      {inviteResults.invited} usuario(s) invitado(s) correctamente
                    </p>
                  )}
                  {inviteResults.failed > 0 && (
                    <p style={{ fontSize: '12px', color: C.red, marginTop: '4px' }}>
                      {inviteResults.failed} invitación(es) fallida(s)
                    </p>
                  )}
                  {inviteResults.details?.failed?.map((f: any, i: number) => (
                    <div key={i} style={{ fontSize: '11px', color: C.text4, marginTop: '2px' }}>
                      • {f.email}: {f.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '18px' }}>

                {/* Tabs */}
                <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, gap: '2px' }}>
                  <TabBtn active={activeTab === 'email'} onClick={() => setActiveTab('email')} label="Por Email" />
                  <TabBtn
                    active={activeTab === 'favorites'}
                    onClick={() => setActiveTab('favorites')}
                    icon={<Star style={{ width: '12px', height: '12px' }} />}
                    label={`Favoritos${favoriteUsers.length > 0 ? ` (${favoriteUsers.length})` : ''}`}
                  />
                </div>

                {/* Tab Email */}
                {activeTab === 'email' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 500, color: C.text2 }}>
                      Busca usuarios por email
                    </label>

                    {/* Input con chips */}
                    <div style={{ position: 'relative' }}>
                      <div
                        onClick={() => inputRef.current?.focus()}
                        style={{
                          minHeight: '42px', display: 'flex', flexWrap: 'wrap', gap: '6px',
                          alignItems: 'center', padding: '6px 10px',
                          background: C.surface, border: `1px solid ${C.border2}`,
                          borderRadius: '8px', cursor: 'text',
                        }}
                      >
                        {selectedUsers.map((user) => (
                          <Chip
                            key={user.email}
                            user={user}
                            onRemove={() => handleRemoveUser(user.email)}
                            disabled={isLoading || success}
                          />
                        ))}
                        <input
                          ref={inputRef}
                          type="text"
                          value={emailInput}
                          onChange={(e) => { setEmailInput(e.target.value); setError(''); }}
                          onKeyDown={handleKeyDown}
                          placeholder={selectedUsers.length === 0 ? 'Escribe un email para buscar…' : ''}
                          disabled={isLoading || success}
                          style={{
                            flex: 1, minWidth: '180px', background: 'transparent',
                            border: 'none', outline: 'none', fontSize: '13px', color: C.text,
                            padding: '2px 0',
                          }}
                        />
                      </div>

                      {/* Dropdown resultados */}
                      {showDropdown && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, zIndex: 10,
                          background: C.surface, border: `1px solid ${C.border2}`,
                          borderRadius: '9px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
                          maxHeight: '240px', overflowY: 'auto',
                        }}>
                          {searchingUser ? (
                            <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <div className="animate-spin" style={{
                                width: '16px', height: '16px', borderRadius: '50%',
                                border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
                              }} />
                              <span style={{ fontSize: '13px', color: C.text4 }}>Buscando…</span>
                            </div>
                          ) : searchResults.length > 0 ? (
                            searchResults.map((user) => (
                              <DropdownUserRow key={user.id} user={user} onSelect={() => handleSelectUser(user)} />
                            ))
                          ) : validateEmail(emailInput.trim()) ? (
                            <div style={{ padding: '14px', textAlign: 'center', fontSize: '13px', color: C.text4 }}>
                              No se encontró ningún usuario con ese email
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>

                    <p style={{ fontSize: '11px', color: C.text4 }}>
                      {selectedUsers.length > 0
                        ? `${selectedUsers.length} usuario(s) seleccionado(s). Backspace para eliminar el último.`
                        : 'Escribe un email completo para buscar el usuario'}
                    </p>
                  </div>
                )}

                {/* Tab Favoritos */}
                {activeTab === 'favorites' && (
                  <div>
                    {loadingFavorites ? (
                      <div style={{ display: 'flex', justifyContent: 'center', padding: '32px 0' }}>
                        <div className="animate-spin" style={{
                          width: '22px', height: '22px', borderRadius: '50%',
                          border: `2px solid ${C.accent}`, borderTopColor: 'transparent',
                        }} />
                      </div>
                    ) : favoriteUsers.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 0', textAlign: 'center' }}>
                        <Star style={{ width: '28px', height: '28px', color: C.text4, marginBottom: '10px' }} />
                        <p style={{ fontSize: '13px', fontWeight: 500, color: C.text3 }}>No tienes favoritos</p>
                        <p style={{ fontSize: '12px', color: C.text4, marginTop: '4px' }}>
                          Marca contactos como favoritos para invitarlos rápidamente
                        </p>
                      </div>
                    ) : (
                      <>
                        <p style={{ fontSize: '12px', color: C.text3, marginBottom: '10px' }}>
                          {selectedFavorites.size > 0
                            ? `${selectedFavorites.size} seleccionado${selectedFavorites.size !== 1 ? 's' : ''}`
                            : 'Selecciona usuarios favoritos para invitar'}
                        </p>
                        <div style={{
                          maxHeight: '260px', overflowY: 'auto',
                          display: 'flex', flexDirection: 'column', gap: '4px',
                          background: C.bg2, border: `1px solid ${C.border}`,
                          borderRadius: '9px', padding: '6px',
                        }}>
                          {favoriteUsers.map((user) => (
                            <FavoriteRow
                              key={user.id}
                              user={user}
                              isSelected={selectedFavorites.has(user.id)}
                              onToggle={() => toggleFavorite(user.id)}
                              disabled={isLoading || success}
                            />
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '8px',
                    padding: '10px 12px', borderRadius: '8px',
                    background: `${C.red}12`, border: `1px solid ${C.red}30`,
                  }}>
                    <span style={{ fontSize: '13px', color: C.red }}>⚠</span>
                    <p style={{ fontSize: '12.5px', color: C.red }}>{error}</p>
                  </div>
                )}

                {/* Role selector */}
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: C.text2, marginBottom: '8px' }}>
                    Rol para los usuarios invitados
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {roles.map((role) => (
                      <RoleOption
                        key={role.value}
                        role={role}
                        isSelected={selectedRole === role.value}
                        onSelect={() => setSelectedRole(role.value)}
                        disabled={isLoading || success}
                      />
                    ))}
                  </div>
                </div>
              </div>

              {/* Footer */}
              <div style={{
                display: 'flex', gap: '8px', padding: '12px 20px 16px',
                borderTop: `1px solid ${C.border}`, background: '#111418', flexShrink: 0,
              }}>
                <CancelBtn onClick={onClose} disabled={isLoading} label={t.btn_cancel} />
                <SubmitBtn
                  disabled={!canSubmit}
                  isLoading={isLoading}
                  success={success}
                  count={activeTab === 'email' ? selectedUsers.length : selectedFavorites.size}
                  activeTab={activeTab}
                />
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

function CloseBtn({ onClick }: { onClick: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)}
      style={{
        width: '26px', height: '26px', borderRadius: '6px', border: 'none',
        background: h ? C.hover : 'transparent', color: h ? C.text2 : C.text4,
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
      <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6" width="11" height="11">
        <path d="M1 1l10 10M11 1L1 11" />
      </svg>
    </button>
  );
}

function TabBtn({ active, onClick, label, icon }: {
  active: boolean; onClick: () => void; label: string; icon?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '8px 12px', fontSize: '12.5px', fontWeight: 500,
        background: 'none', border: 'none', cursor: 'pointer',
        color: active ? C.accent : C.text4,
        borderBottom: `2px solid ${active ? C.accent : 'transparent'}`,
        marginBottom: '-1px', transition: 'color 0.12s',
      }}
    >
      {icon}{label}
    </button>
  );
}

function Chip({ user, onRemove, disabled }: { user: SelectedUser; onRemove: () => void; disabled?: boolean }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      background: `${C.accent}18`, border: `1px solid ${C.accent}35`,
      borderRadius: '5px', padding: '3px 8px 3px 5px',
    }}>
      {user.avatar && (
        <MiniAvatar name={user.name || user.email} avatar={user.avatar} size={18} />
      )}
      <span style={{ fontSize: '12px', fontWeight: 500, color: C.accent }}>
        {user.name || user.email}
      </span>
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.accent, lineHeight: 1, padding: 0 }}
      >
        <X style={{ width: '11px', height: '11px' }} />
      </button>
    </div>
  );
}

function DropdownUserRow({ user, onSelect }: { user: UserPreview; onSelect: () => void }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '10px 14px', textAlign: 'left',
        background: h ? C.hover : 'transparent',
        border: 'none', cursor: 'pointer',
        borderBottom: `1px solid ${C.border}`,
        transition: 'background 0.1s',
      }}
    >
      <MiniAvatar name={user.name} avatar={user.avatar} size={36} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
          <span style={{ fontSize: '13px', fontWeight: 500, color: C.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </span>
          {user.isFavorite && (
            <Star style={{ width: '11px', height: '11px', color: '#f59e0b', flexShrink: 0 }} fill="#f59e0b" />
          )}
        </div>
        <span style={{ fontSize: '11.5px', color: C.text4, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </span>
        {user.position && (
          <span style={{ fontSize: '11px', color: C.text3, display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.position}
          </span>
        )}
      </div>
    </button>
  );
}

function FavoriteRow({ user, isSelected, onToggle, disabled }: {
  user: UserPreview; isSelected: boolean; onToggle: () => void; disabled?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: '10px',
        padding: '8px 10px', borderRadius: '7px', textAlign: 'left',
        background: isSelected ? `${C.accent}15` : h ? C.hover : 'transparent',
        border: `1px solid ${isSelected ? C.accent : 'transparent'}`,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <MiniAvatar name={user.name} avatar={user.avatar} size={34} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: '13px', fontWeight: 500, color: isSelected ? C.text : C.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name}
        </p>
        <p style={{ fontSize: '11.5px', color: C.text4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.email}
        </p>
        {user.position && (
          <p style={{ fontSize: '11px', color: C.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.position}
          </p>
        )}
      </div>
      {isSelected && (
        <div style={{
          width: '18px', height: '18px', borderRadius: '5px', flexShrink: 0,
          background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '11px', color: '#fff', fontWeight: 700 }}>✓</span>
        </div>
      )}
    </button>
  );
}

function RoleOption({ role, isSelected, onSelect, disabled }: {
  role: { value: string; label: string; description: string };
  isSelected: boolean; onSelect: () => void; disabled?: boolean;
}) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onSelect}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        width: '100%', padding: '10px 12px', borderRadius: '8px', textAlign: 'left',
        background: isSelected ? `${C.accent}15` : h ? C.hover : C.surface,
        border: `1px solid ${isSelected ? C.accent : h ? C.border2 : C.border}`,
        cursor: 'pointer', transition: 'all 0.1s',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
        <span style={{ fontSize: '12.5px', fontWeight: 500, color: isSelected ? C.accent : C.text }}>
          {role.label}
        </span>
        {isSelected && <span style={{ fontSize: '12px', color: C.accent }}>✓</span>}
      </div>
      <p style={{ fontSize: '11.5px', color: C.text4 }}>{role.description}</p>
    </button>
  );
}

function CancelBtn({ onClick, disabled, label }: { onClick: () => void; disabled?: boolean; label: string }) {
  const [h, setH] = useState(false);
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        flex: 1, padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
        background: h ? C.border : C.hover, border: `1px solid ${C.border2}`,
        color: h ? C.text : C.text2, cursor: 'pointer', transition: 'all 0.12s',
      }}
    >
      {label}
    </button>
  );
}

function SubmitBtn({ disabled, isLoading, success, count, activeTab }: {
  disabled: boolean; isLoading: boolean; success: boolean; count: number; activeTab: 'email' | 'favorites';
}) {
  const label = isLoading
    ? 'Invitando…'
    : success
    ? 'Invitados ✓'
    : count > 0
    ? `Invitar ${count} usuario${count !== 1 ? 's' : ''}`
    : 'Invitar';

  return (
    <button
      type="submit"
      disabled={disabled}
      style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
        padding: '8px 0', borderRadius: '7px', fontSize: '13px', fontWeight: 500,
        background: success ? C.green : C.accent, color: '#fff', border: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.45 : 1,
        transition: 'opacity 0.12s, background 0.2s',
      }}
    >
      {isLoading ? (
        <svg className="animate-spin" viewBox="0 0 16 16" fill="none" width="13" height="13">
          <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="10" />
        </svg>
      ) : (
        <UserPlus style={{ width: '13px', height: '13px' }} />
      )}
      {label}
    </button>
  );
}

const AVATAR_COLORS = [
  '#3b82f6', '#10b981', '#f59e0b', '#a855f7',
  '#ec4899', '#06b6d4', '#fb923c', '#84cc16',
];

function avatarColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffffffff;
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

function MiniAvatar({ name, avatar, size = 32 }: { name: string; avatar?: string; size?: number }) {
  const [imgErr, setImgErr] = useState(false);
  const url = getAvatarUrl(avatar);
  const fontSize = size <= 24 ? '9px' : size <= 32 ? '11px' : '13px';
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: avatarColor(name), display: 'flex', alignItems: 'center',
      justifyContent: 'center', overflow: 'hidden', border: `1px solid ${C.border}`,
    }}>
      {url && !imgErr ? (
        <img src={url} alt={name} crossOrigin="anonymous" onError={() => setImgErr(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <span style={{ fontSize, fontWeight: 600, color: '#fff', lineHeight: 1 }}>
          {getInitials(name)}
        </span>
      )}
    </div>
  );
}
