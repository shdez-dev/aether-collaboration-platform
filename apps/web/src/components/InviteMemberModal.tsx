// apps/web/src/components/InviteMemberModal.tsx
'use client';

import { useState, useEffect } from 'react';
import { useWorkspaceStore } from '@/stores/workspaceStore';

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
}

export default function InviteMemberModal({
  workspaceId,
  isOpen,
  onClose,
}: InviteMemberModalProps) {
  const { inviteMember, isLoading } = useWorkspaceStore();

  const [email, setEmail] = useState('');
  const [selectedRole, setSelectedRole] = useState<Role>('MEMBER');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // Estados para búsqueda de usuario
  const [userPreview, setUserPreview] = useState<UserPreview | null>(null);
  const [searchingUser, setSearchingUser] = useState(false);
  const [userNotFound, setUserNotFound] = useState(false);

  // Reset form cuando se abre/cierra
  useEffect(() => {
    if (!isOpen) {
      setEmail('');
      setSelectedRole('MEMBER');
      setError('');
      setSuccess(false);
      setUserPreview(null);
      setUserNotFound(false);
    }
  }, [isOpen]);

  // Buscar usuario mientras escribe
  useEffect(() => {
    const searchUser = async () => {
      // Validar que sea un email válido antes de buscar
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setUserPreview(null);
        setUserNotFound(false);
        return;
      }

      setSearchingUser(true);
      setUserNotFound(false);

      try {
        // Obtener token
        const authData = localStorage.getItem('aether-auth-storage');
        let token = null;

        if (authData) {
          try {
            const parsed = JSON.parse(authData);
            token = parsed.state?.accessToken || parsed.accessToken;
          } catch (e) {
            console.error('Error parsing auth data:', e);
          }
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000'}/api/users/search?email=${encodeURIComponent(email)}`,
          {
            headers: {
              ...(token && { Authorization: `Bearer ${token}` }),
            },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.data?.user) {
            setUserPreview(data.data.user);
            setUserNotFound(false);
          } else {
            setUserPreview(null);
            setUserNotFound(true);
          }
        } else {
          setUserPreview(null);
          setUserNotFound(true);
        }
      } catch (err) {
        console.error('Error searching user:', err);
        setUserPreview(null);
      } finally {
        setSearchingUser(false);
      }
    };

    // Debounce: esperar 500ms después de que el usuario deje de escribir
    const timeoutId = setTimeout(() => {
      if (email.trim()) {
        searchUser();
      } else {
        setUserPreview(null);
        setUserNotFound(false);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [email]);

  // Cerrar con ESC
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validación básica
    if (!email.trim()) {
      setError('Email is required');
      return;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Invalid email format');
      return;
    }

    if (!userPreview) {
      setError('User not found. Make sure they have an account.');
      return;
    }

    try {
      await inviteMember(workspaceId, email.trim(), selectedRole);
      setSuccess(true);

      // Cerrar modal después de 1.5 segundos
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to invite member. User may already be a member.');
    }
  };

  const roles: { value: Role; label: string; description: string }[] = [
    {
      value: 'VIEWER',
      label: 'Viewer',
      description: 'Can view boards and cards but cannot edit',
    },
    {
      value: 'MEMBER',
      label: 'Member',
      description: 'Can create and edit boards and cards',
    },
    {
      value: 'ADMIN',
      label: 'Admin',
      description: 'Can manage workspace settings and members',
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
          className="card-terminal max-w-lg w-full pointer-events-auto animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-normal">Invite Member</h2>
              <p className="text-text-secondary text-sm">Add a new member to your workspace</p>
            </div>
            <button
              onClick={onClose}
              className="text-text-muted hover:text-text-primary transition-colors text-2xl leading-none"
            >
              ×
            </button>
          </div>

          {/* Success Message */}
          {success && (
            <div className="mb-6 p-4 bg-accent/10 border border-accent/50 rounded-terminal">
              <div className="flex items-center gap-3">
                <span className="text-accent text-xl">✓</span>
                <div>
                  <p className="text-accent font-medium">Member invited successfully!</p>
                  <p className="text-text-secondary text-sm">They can now access this workspace</p>
                </div>
              </div>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-sm text-text-secondary mb-2">
                EMAIL ADDRESS:
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                className={`input-terminal ${error ? 'border-error' : ''}`}
                placeholder="member@example.com"
                disabled={isLoading || success}
                autoFocus
              />

              {/* User Preview - Loading */}
              {searchingUser && (
                <div className="mt-3 p-3 bg-card border border-border rounded-terminal animate-fade-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-terminal bg-accent/20 animate-pulse" />
                    <div className="flex-1">
                      <div className="h-4 bg-accent/20 rounded animate-pulse mb-2" />
                      <div className="h-3 bg-accent/10 rounded animate-pulse w-2/3" />
                    </div>
                  </div>
                </div>
              )}

              {/* User Preview - Found */}
              {userPreview && !searchingUser && (
                <div className="mt-3 p-3 bg-accent/5 border border-accent/30 rounded-terminal animate-scale-in">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-terminal bg-accent/20 flex items-center justify-center border border-accent/30">
                      <span className="text-accent font-bold text-sm">
                        {userPreview.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="text-text-primary font-medium text-sm flex items-center gap-2">
                        {userPreview.name}
                        <span className="text-accent text-xs">✓</span>
                      </p>
                      <p className="text-text-muted text-xs">{userPreview.email}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* User Preview - Not Found */}
              {userNotFound && !searchingUser && email.trim() && (
                <div className="mt-3 p-3 bg-error/5 border border-error/30 rounded-terminal animate-scale-in">
                  <div className="flex items-center gap-2 text-error">
                    <span>⚠</span>
                    <p className="text-sm">User not found. Make sure they have an account.</p>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {error && (
                <p className="text-error text-xs mt-2 flex items-center gap-1">
                  <span>⚠</span> {error}
                </p>
              )}
            </div>

            {/* Role Selector - Solo visible si hay usuario encontrado */}
            {userPreview && (
              <div className="animate-fade-in">
                <label className="block text-sm text-text-secondary mb-3">SELECT ROLE:</label>
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
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-4 border-t border-border">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isLoading || success || !userPreview}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? 'Inviting...' : success ? 'Invited!' : 'Send Invitation'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
