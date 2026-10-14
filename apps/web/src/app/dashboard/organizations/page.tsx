'use client';

import { type CSSProperties, type FormEvent, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Building2, BriefcaseBusiness, ChevronLeft, ChevronRight, Clock3, Copy, HardDrive, KeyRound, Mail, MoreHorizontal, RefreshCw, Search, ShieldCheck, Sparkles, Trash2, UserMinus, UserPlus, UserRound, Users, X } from 'lucide-react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import { toast } from 'sonner';
import { apiService } from '@/services/apiService';
import { getAvatarUrl } from '@/lib/utils/avatar';
import { getDisplayOrganizationName } from '@/lib/organizationName';
import { useWorkspaceStore } from '@/stores/workspaceStore';
import { useActiveWorkspaceStore } from '@/stores/activeWorkspaceStore';
import { useAuthStore } from '@/stores/authStore';
import { ProjectOptionSelect } from '@/components/ProjectOptionSelect';
import { MultiSelectDropdown } from '@/components/MultiSelectDropdown';
import { InstitutionalSettingsPanel } from '@/components/InstitutionalSettingsPanel';
import { TeamOrganizationSettingsPanel } from '@/components/TeamOrganizationSettingsPanel';
import styles from './organizations.module.css';

type OrganizationRole = 'OWNER' | 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';
type InviteRole = 'ADMIN' | 'BILLING_ADMIN' | 'MEMBER';

type Organization = {
  id: string;
  name: string;
  type: 'PERSONAL' | 'COMPANY' | 'INSTITUTION' | 'NETWORK_OPERATOR';
  role: OrganizationRole;
  memberCount: number;
  workspaceCount: number;
  portfolioCount?: number;
  networkCount?: number;
  workspaces?: Array<{ id: string; name: string; mode: string; archived: boolean }>;
};

type OrganizationMember = {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatar?: string | null;
  role: OrganizationRole;
  joinedAt: string;
};

type InvitableContact = { id: string; name: string; email: string; avatar: string | null };

type OrganizationInvitation = {
  id: string;
  email: string;
  role: InviteRole;
  expiresAt: string;
  createdAt: string;
  invitedBy: { id: string; name: string };
};

type OrganizationUsage = {
  planCode: string;
  usage: {
    storageUsedBytes: number;
    storageLimitBytes: number | null;
    storagePercent: number | null;
  };
};

type GeneratedInvitation = {
  code: string;
  link: string;
  email: string;
  expiresAt: string;
  emailStatus: 'sent' | 'failed' | 'not_sent';
};

const canManage = (role?: OrganizationRole) => role === 'OWNER' || role === 'ADMIN';
const roleLabel: Record<OrganizationRole, string> = {
  OWNER: 'Propietario',
  ADMIN: 'Administrador',
  BILLING_ADMIN: 'Administrador de facturación',
  MEMBER: 'Miembro',
};

function invitationError(code?: string, message?: string) {
  if (code === 'INVITATION_ALREADY_PENDING') return 'Ya existe una invitación pendiente para ese correo.';
  if (code === 'ALREADY_MEMBER') return 'Esta persona ya pertenece a la organización.';
  if (code === 'PERSONAL_ORGANIZATION_IMMUTABLE') return 'Las organizaciones personales no admiten miembros adicionales.';
  if (code === 'EMAIL_DOMAIN_NOT_ALLOWED') return 'Ese correo no pertenece a un dominio permitido por la organización.';
  if (code === 'INVITATION_OWNER_REQUIRED') return 'Solo el propietario puede enviar invitaciones en esta organización.';
  if (code === 'FORBIDDEN') return 'No tienes permisos para realizar esta acción.';
  return message || 'No se pudo completar la operación. Inténtalo de nuevo.';
}

function memberRemovalError(code?: string) {
  if (code === 'WORKSPACE_OWNERSHIP_TRANSFER_REQUIRED') return 'Transfiere primero la propiedad de los espacios que administra esta persona.';
  if (code === 'OWNER_ROLE_PROTECTED') return 'No se puede retirar al propietario. Primero debe transferir la propiedad de la organización.';
  if (code === 'PERSONAL_ORGANIZATION_IMMUTABLE') return 'Las organizaciones personales no admiten esta acción.';
  if (code === 'FORBIDDEN') return 'No tienes permiso para retirar a esta persona.';
  return 'No se pudo retirar a la persona. Inténtalo de nuevo.';
}

function memberRoleError(code?: string) {
  if (code === 'OWNER_ROLE_PROTECTED') return 'Para cambiar el rol del propietario, transfiere la propiedad de la organización.';
  if (code === 'FORBIDDEN') return 'No tienes permiso para cambiar el rol de esta persona.';
  return 'No se pudo cambiar el rol. Inténtalo de nuevo.';
}

function organizationDeletionError(code?: string, message?: string) {
  if (code === 'WORKSPACES_EXIST') return 'La organización todavía tiene espacios de trabajo. Elimínalos primero; mientras quede alguno, sus proyectos y documentos están protegidos.';
  if (code === 'PORTFOLIOS_EXIST') return 'La organización todavía tiene carteras. Elimínalas o transfiere su contenido antes de continuar.';
  if (code === 'NETWORKS_EXIST') return 'La organización todavía pertenece a redes de colaboración. Retírala de esas redes antes de continuar.';
  if (code === 'ORGANIZATION_NAME_MISMATCH') return 'El nombre no coincide. Escríbelo exactamente como aparece en la organización.';
  if (code === 'ORGANIZATION_TYPE_NOT_DELETABLE') return 'Solo se pueden eliminar organizaciones de tipo equipo.';
  if (code === 'FORBIDDEN') return 'Solo el propietario de la organización puede eliminarla.';
  return message || 'No se pudo eliminar la organización. Inténtalo de nuevo.';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('es-CL', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

function formatStorageBytes(bytes: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let value = Math.max(0, bytes);
  let unitIndex = 0;
  while (value >= 1000 && unitIndex < units.length - 1) {
    value /= 1000;
    unitIndex += 1;
  }
  return `${new Intl.NumberFormat('es-CL', { maximumFractionDigits: unitIndex === 0 ? 0 : 1 }).format(value)} ${units[unitIndex]}`;
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase();
}

function MemberAvatar({ name, photo }: { name: string; photo?: string | null }) {
  const [imageFailed, setImageFailed] = useState(false);
  const url = getAvatarUrl(photo);
  return <span style={{ ...avatar, overflow: 'hidden' }}>
    {url && !imageFailed ? <img src={url} alt="" onError={() => setImageFailed(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initials(name)}
  </span>;
}

const MEMBERS_PER_PAGE = 10;

function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

export default function OrganizationsPage() {
  const { currentWorkspace, workspaces } = useWorkspaceStore();
  const currentUser = useAuthStore((state) => state.user);
  const currentUserId = currentUser?.id;
  const activeWorkspaceId = useActiveWorkspaceStore((state) => state.activeWorkspaceId);
  const activeWorkspace = workspaces?.find((workspace) => workspace.id === activeWorkspaceId);
  const activeWorkspaceOrganizationId = activeWorkspace?.organizationId;
  const currentWorkspaceOrganizationId = currentWorkspace?.organization?.id ?? currentWorkspace?.organizationId;
  const activeOrganizationId = activeWorkspaceOrganizationId ?? currentWorkspaceOrganizationId;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [organizationId, setOrganizationId] = useState('');
  const [view, setView] = useState<'people' | 'settings'>('people');
  const [members, setMembers] = useState<OrganizationMember[]>([]);
  const [organizationWorkspaces, setOrganizationWorkspaces] = useState<{ organizationId: string; items: Array<{ id: string; name: string; mode: string; archived: boolean }> } | null>(null);
  const [memberSearch, setMemberSearch] = useState('');
  const [memberPage, setMemberPage] = useState(1);
  const [invitations, setInvitations] = useState<OrganizationInvitation[]>([]);
  const [organizationUsage, setOrganizationUsage] = useState<OrganizationUsage | null>(null);
  const [loadingUsage, setLoadingUsage] = useState(false);
  const [usageError, setUsageError] = useState('');
  const [loadingOrganizations, setLoadingOrganizations] = useState(true);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [actionError, setActionError] = useState('');
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<InviteRole>('MEMBER');
  const [contacts, setContacts] = useState<InvitableContact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsError, setContactsError] = useState('');
  const [sending, setSending] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState('');
  const [generatedInvitation, setGeneratedInvitation] = useState<GeneratedInvitation | null>(null);
  const [copyFeedback, setCopyFeedback] = useState('');
  const [memberToAssign, setMemberToAssign] = useState<OrganizationMember | null>(null);
  const [memberToRemove, setMemberToRemove] = useState<OrganizationMember | null>(null);
  const [memberToChangeRole, setMemberToChangeRole] = useState<OrganizationMember | null>(null);
  const [newMemberRole, setNewMemberRole] = useState<InviteRole>('MEMBER');
  const [savingMemberRole, setSavingMemberRole] = useState(false);
  const [memberRoleUpdateError, setMemberRoleUpdateError] = useState('');
  const [removingMemberId, setRemovingMemberId] = useState('');
  const [removeMemberError, setRemoveMemberError] = useState('');
  const [assignWorkspaceIds, setAssignWorkspaceIds] = useState<string[]>([]);
  const [assignRole, setAssignRole] = useState<'MEMBER' | 'VIEWER'>('MEMBER');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [revokingId, setRevokingId] = useState('');
  const [refreshCount, setRefreshCount] = useState(0);
  const [invitationAuthority, setInvitationAuthority] = useState<'OWNER_AND_ADMIN' | 'OWNER_ONLY' | null>(null);
  const [teamInvitationAuthority, setTeamInvitationAuthority] = useState<'OWNER_AND_ADMIN' | 'OWNER_ONLY' | 'ALL_MEMBERS' | null>(null);
  const [organizationDeleteOpen, setOrganizationDeleteOpen] = useState(false);
  const [organizationDeleteName, setOrganizationDeleteName] = useState('');
  const [deletingOrganization, setDeletingOrganization] = useState(false);
  const [organizationDeleteError, setOrganizationDeleteError] = useState('');

  useEffect(() => {
    let active = true;
    setLoadingOrganizations(true);
    apiService.get<{ organizations: Organization[] }>('/api/organizations', true).then((response) => {
      if (!active) return;
      if (!response.success || !response.data) {
        setLoadError(response.error?.message ?? 'No se pudieron cargar las organizaciones.');
        setOrganizations([]);
        return;
      }
      const available = response.data.organizations ?? [];
      setOrganizations(available);
      const query = new URLSearchParams(window.location.search);
      const queryOrganizationId = query.get('organizationId');
      const requestedView = query.get('view');
      const preferred = available.find((organization) => organization.id === queryOrganizationId)
        ?? available.find((organization) => organization.id === activeWorkspaceOrganizationId)
        ?? available.find((organization) => organization.id === currentWorkspaceOrganizationId && organization.type !== 'PERSONAL')
        ?? available.find((organization) => organization.type !== 'PERSONAL')
        ?? available.find((organization) => organization.id === currentWorkspaceOrganizationId)
        ?? available[0];
      setOrganizationId(preferred?.id || '');
      setView(requestedView === 'settings' && (preferred?.type === 'INSTITUTION' || preferred?.type === 'COMPANY') ? 'settings' : 'people');
      if (preferred) window.dispatchEvent(new CustomEvent('aether:select-organization', { detail: preferred.id }));
      setLoadError('');
    }).catch(() => {
      if (active) setLoadError('No se pudieron cargar las organizaciones. Revisa tu conexión.');
    }).finally(() => { if (active) setLoadingOrganizations(false); });
    return () => { active = false; };
  }, [activeWorkspaceOrganizationId, currentWorkspaceOrganizationId, refreshCount]);

  const selectedOrganization = useMemo(
    () => organizations.find((organization) => organization.id === organizationId) ?? null,
    [organizations, organizationId],
  );
  const isManager = canManage(selectedOrganization?.role);
  const isPersonal = selectedOrganization?.type === 'PERSONAL';
  const canDeleteOrganization = selectedOrganization?.type === 'COMPANY' && selectedOrganization.role === 'OWNER';
  const canViewUsage = selectedOrganization?.role === 'OWNER' || selectedOrganization?.role === 'ADMIN' || selectedOrganization?.role === 'BILLING_ADMIN';
  const canInvite = Boolean(selectedOrganization && !isPersonal && (
    selectedOrganization.type === 'INSTITUTION'
      ? isManager && (selectedOrganization.role === 'OWNER' || invitationAuthority === 'OWNER_AND_ADMIN')
      : selectedOrganization.type === 'COMPANY'
        ? isManager || (selectedOrganization.role === 'MEMBER' && teamInvitationAuthority === 'ALL_MEMBERS')
        : isManager
  ));
  useEffect(() => {
    if (!selectedOrganization || !isManager) { setOrganizationWorkspaces(null); return; }
    let active = true;
    const targetOrganizationId = selectedOrganization.id;
    void apiService.get<{ organization: Organization }>(`/api/organizations/${selectedOrganization.id}`, true)
      .then((response) => { if (active) setOrganizationWorkspaces({ organizationId: targetOrganizationId, items: response.success ? response.data?.organization?.workspaces ?? [] : [] }); })
      .catch(() => { if (active) setOrganizationWorkspaces({ organizationId: targetOrganizationId, items: [] }); });
    return () => { active = false; };
  }, [selectedOrganization?.id, isManager]);
  useEffect(() => {
    if (!inviteOpen || !selectedOrganization || !canInvite) return;
    let active = true;
    setContactsLoading(true);
    setContactsError('');
    void apiService.get<{ contacts: InvitableContact[] }>(`/api/organizations/${selectedOrganization.id}/contacts`, true)
      .then((response) => {
        if (!active) return;
        if (response.success && response.data) setContacts(response.data.contacts ?? []);
        else { setContacts([]); setContactsError('No se pudieron cargar tus contactos. Puedes invitar por correo.'); }
      })
      .catch(() => { if (active) { setContacts([]); setContactsError('No se pudieron cargar tus contactos. Puedes invitar por correo.'); } })
      .finally(() => { if (active) setContactsLoading(false); });
    return () => { active = false; };
  }, [inviteOpen, selectedOrganization?.id, canInvite]);
  useEffect(() => {
    setInvitationAuthority(null);
    setTeamInvitationAuthority(null);
    setOrganizationDeleteOpen(false);
    setOrganizationDeleteName('');
    setOrganizationDeleteError('');
  }, [organizationId]);
  function selectOrganizationView(next: 'people' | 'settings') {
    setView(next);
    const url = new URL(window.location.href);
    if (next === 'settings') url.searchParams.set('view', 'settings');
    else url.searchParams.delete('view');
    window.history.replaceState(null, '', url);
  }
  const knownOrganizationWorkspaces = organizationWorkspaces && organizationWorkspaces.organizationId === selectedOrganization?.id ? organizationWorkspaces.items : [];
  const assignableWorkspaces = knownOrganizationWorkspaces.length > 0
    ? knownOrganizationWorkspaces.filter((workspace) => !workspace.archived)
    : (workspaces ?? []).filter((workspace) => workspace.organizationId === selectedOrganization?.id && !workspace.archived);
  const personalWorkspaces = useMemo(
    () => (workspaces ?? []).filter((workspace) => workspace.organizationId === selectedOrganization?.id && !workspace.archived),
    [workspaces, selectedOrganization?.id],
  );
  const personalMember = members.find((member) => member.userId === currentUserId);
  const personalName = personalMember?.name ?? currentUser?.name ?? getDisplayOrganizationName(selectedOrganization?.name ?? 'Tu cuenta');
  const personalEmail = personalMember?.email ?? currentUser?.email ?? '';

  useEffect(() => {
    if (!selectedOrganization || selectedOrganization.type === 'PERSONAL' || !canViewUsage) {
      setOrganizationUsage(null);
      setUsageError('');
      setLoadingUsage(false);
      return;
    }
    let active = true;
    setLoadingUsage(true);
    setOrganizationUsage(null);
    setUsageError('');
    apiService.get<OrganizationUsage>(`/api/billing/organizations/${encodeURIComponent(selectedOrganization.id)}`, true)
      .then((response) => {
        if (!active) return;
        if (!response.success || !response.data) {
          setOrganizationUsage(null);
          setUsageError(response.error?.message ?? 'No se pudo consultar el almacenamiento.');
          return;
        }
        setOrganizationUsage(response.data);
      })
      .catch(() => {
        if (active) {
          setOrganizationUsage(null);
          setUsageError('No se pudo consultar el almacenamiento. Revisa tu conexión.');
        }
      })
      .finally(() => { if (active) setLoadingUsage(false); });
    return () => { active = false; };
  }, [selectedOrganization?.id, selectedOrganization?.type, canViewUsage]);
  const filteredMembers = useMemo(() => {
    const query = normalizeSearch(memberSearch);
    if (!query) return members;
    return members.filter((member) => normalizeSearch(`${member.name} ${member.email}`).includes(query));
  }, [members, memberSearch]);
  const memberPageCount = Math.max(1, Math.ceil(filteredMembers.length / MEMBERS_PER_PAGE));
  const currentMemberPage = Math.min(memberPage, memberPageCount);
  const visibleMembers = filteredMembers.slice((currentMemberPage - 1) * MEMBERS_PER_PAGE, currentMemberPage * MEMBERS_PER_PAGE);

  useEffect(() => {
    setMemberSearch('');
    setMemberPage(1);
  }, [organizationId]);

  useEffect(() => {
    if (!selectedOrganization) {
      setMembers([]);
      setInvitations([]);
      setLoadingMembers(false);
      return;
    }
    if (isPersonal) {
      setMembers([]);
      setInvitations([]);
      setLoadingMembers(false);
      setLoadError('');
      setActionError('');
      return;
    }
    let active = true;
    setLoadingMembers(true);
    setLoadError('');
    setActionError('');
    const memberRequest = apiService.get<{ members: OrganizationMember[] }>(`/api/organizations/${selectedOrganization.id}/members`, true);
    const invitationRequest = isManager
      ? apiService.get<{ invitations: OrganizationInvitation[] }>(`/api/organizations/${selectedOrganization.id}/invitations`, true)
      : Promise.resolve(null);
    Promise.all([memberRequest, invitationRequest]).then(([memberResponse, invitationResponse]) => {
      if (!active) return;
      if (!memberResponse.success || !memberResponse.data) {
        setLoadError(memberResponse.error?.message ?? 'No se pudieron cargar los miembros de la organización.');
        setMembers([]);
      } else {
        setMembers(memberResponse.data.members ?? []);
      }
      if (invitationResponse) {
        if (!invitationResponse.success || !invitationResponse.data) {
          setActionError(invitationError(invitationResponse.error?.code, invitationResponse.error?.message));
          setInvitations([]);
        } else {
          setInvitations(invitationResponse.data.invitations ?? []);
        }
      } else {
        setInvitations([]);
      }
    }).catch(() => {
      if (active) setLoadError('No se pudieron cargar los datos de esta organización. Revisa tu conexión.');
    }).finally(() => { if (active) setLoadingMembers(false); });
    return () => { active = false; };
  }, [selectedOrganization, isManager, isPersonal, refreshCount]);

  async function sendInvitation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization || !canInvite || isPersonal || sending) return;
    setSending(true);
    setActionError('');
    const response = await apiService.post<{ invitation: GeneratedInvitation }>(
      `/api/organizations/${selectedOrganization.id}/invitations`,
      { email: email.trim().toLowerCase(), role: inviteRole },
      true,
    );
    setSending(false);
    if (!response.success) {
      const message = invitationError(response.error?.code, response.error?.message);
      setActionError(message);
      return;
    }
    if (!response.data?.invitation) {
      setActionError('La invitación pudo haberse creado, pero no recibimos su código. Actualiza la lista antes de intentarlo de nuevo.');
      setRefreshCount((count) => count + 1);
      return;
    }
    setGeneratedInvitation(response.data.invitation);
    setCopyFeedback('');
    if (response.data.invitation.emailStatus === 'failed') {
      toast.warning('Invitación creada, pero el correo no se pudo enviar. Comparte el código o enlace manualmente.');
    } else {
      toast.success(`Invitación creada para ${email.trim()}.`);
    }
    setEmail('');
    setInviteRole('MEMBER');
    setInviteOpen(false);
    setRefreshCount((count) => count + 1);
  }

  async function regenerateCode(invitation: OrganizationInvitation) {
    if (!selectedOrganization || regeneratingId) return;
    if (!window.confirm(`Se invalidará el código anterior de ${invitation.email}. ¿Generar uno nuevo?`)) return;
    setRegeneratingId(invitation.id);
    setActionError('');
    const response = await apiService.post<{ invitation: GeneratedInvitation }>(
      `/api/organizations/${selectedOrganization.id}/invitations/${invitation.id}/regenerate`, {}, true,
    );
    setRegeneratingId('');
    if (!response.success || !response.data?.invitation) {
      setActionError(invitationError(response.error?.code, response.error?.message));
      return;
    }
    setGeneratedInvitation(response.data.invitation);
    setCopyFeedback('');
    setRefreshCount((count) => count + 1);
  }

  async function copyInvitation(value: string, label: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopyFeedback(`${label} copiado.`);
    } catch {
      setCopyFeedback('No se pudo copiar automáticamente. Selecciona el texto y cópialo manualmente.');
    }
  }

  function openAssignment(member: OrganizationMember) {
    setMemberToAssign(member);
    setAssignWorkspaceIds(assignableWorkspaces[0]?.id ? [assignableWorkspaces[0].id] : []);
    setAssignRole('MEMBER');
    setAssignError('');
  }

  async function assignWorkspace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!memberToAssign || assignWorkspaceIds.length === 0 || assigning) return;
    setAssigning(true);
    setAssignError('');
    try {
      const assigned: string[] = [];
      const failed: string[] = [];
      for (const workspaceId of assignWorkspaceIds) {
        const workspace = assignableWorkspaces.find((item) => item.id === workspaceId);
        try {
          const response = await apiService.post(`/api/workspaces/${workspaceId}/members`, { userId: memberToAssign.userId, role: assignRole }, true);
          if (!response.success) throw new Error(response.error?.message || 'No se pudo asignar el espacio.');
          assigned.push(workspace?.name ?? 'espacio');
        } catch (error) {
          failed.push(`${workspace?.name ?? 'Espacio'}: ${error instanceof Error ? error.message : 'no se pudo asignar'}`);
        }
      }
      if (assigned.length === assignWorkspaceIds.length) {
        toast.success(`Acceso asignado a ${memberToAssign.name} en ${assigned.length} ${assigned.length === 1 ? 'espacio' : 'espacios'}.`);
        setMemberToAssign(null);
      } else if (assigned.length > 0) {
        toast.warning(`Acceso asignado a ${memberToAssign.name} en ${assigned.length} de ${assignWorkspaceIds.length} espacios. ${failed.join(' · ')}`);
        setMemberToAssign(null);
      } else {
        setAssignError(failed.join(' · ') || 'No se pudo asignar ningún espacio.');
      }
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : 'No se pudo asignar el espacio.');
    } finally {
      setAssigning(false);
    }
  }

  async function revokeInvitation(invitation: OrganizationInvitation) {
    if (!selectedOrganization || revokingId) return;
    const confirmed = window.confirm(`¿Revocar la invitación enviada a ${invitation.email}?`);
    if (!confirmed) return;
    setRevokingId(invitation.id);
    setActionError('');
    const response = await apiService.delete<void>(`/api/organizations/${selectedOrganization.id}/invitations/${invitation.id}`, true);
    setRevokingId('');
    if (!response.success) {
      setActionError(invitationError(response.error?.code, response.error?.message));
      return;
    }
    toast.success('Invitación revocada.');
    setRefreshCount((count) => count + 1);
  }

  async function removeOrganizationMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization || !memberToRemove || !isManager || memberToRemove.role === 'OWNER'
      || memberToRemove.userId === currentUserId || removingMemberId) return;

    setRemovingMemberId(memberToRemove.userId);
    setRemoveMemberError('');
    const response = await apiService.delete<void>(
      `/api/organizations/${selectedOrganization.id}/members/${memberToRemove.userId}`,
      true,
    );
    setRemovingMemberId('');
    if (!response.success) {
      setRemoveMemberError(memberRemovalError(response.error?.code));
      return;
    }

    if (organizationId === selectedOrganization.id) {
      setMembers((current) => current.filter((member) => member.userId !== memberToRemove.userId));
    }
    setOrganizations((current) => current.map((organization) => organization.id === selectedOrganization.id
      ? { ...organization, memberCount: Math.max(0, organization.memberCount - 1) }
      : organization));
    setMemberToRemove(null);
    toast.success(`${memberToRemove.name} ya no pertenece a la organización.`);
  }

  async function changeOrganizationMemberRole(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedOrganization || selectedOrganization.role !== 'OWNER' || !memberToChangeRole
      || memberToChangeRole.role === 'OWNER' || memberToChangeRole.userId === currentUserId
      || memberToChangeRole.role === newMemberRole || savingMemberRole) return;

    setSavingMemberRole(true);
    setMemberRoleUpdateError('');
    const response = await apiService.patch<void>(
      `/api/organizations/${selectedOrganization.id}/members/${memberToChangeRole.userId}`,
      { role: newMemberRole },
      true,
    );
    setSavingMemberRole(false);
    if (!response.success) {
      setMemberRoleUpdateError(memberRoleError(response.error?.code));
      return;
    }
    setMembers((current) => current.map((member) => member.userId === memberToChangeRole.userId
      ? { ...member, role: newMemberRole } : member));
    toast.success(`Rol de ${memberToChangeRole.name} actualizado.`);
    setMemberToChangeRole(null);
  }

  async function deleteOrganization(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const organization = selectedOrganization;
    if (!organization || organization.type !== 'COMPANY' || organization.role !== 'OWNER'
      || organization.workspaceCount > 0 || (organization.portfolioCount ?? 0) > 0 || (organization.networkCount ?? 0) > 0
      || organizationDeleteName.trim() !== organization.name || deletingOrganization) return;

    setDeletingOrganization(true);
    setOrganizationDeleteError('');
    const response = await apiService.delete<void>(
      `/api/organizations/${organization.id}`,
      true,
      { confirmationName: organizationDeleteName },
    );
    setDeletingOrganization(false);
    if (!response.success) {
      setOrganizationDeleteError(organizationDeletionError(response.error?.code, response.error?.message));
      return;
    }

    const remaining = organizations.filter((item) => item.id !== organization.id);
    const nextOrganization = remaining.find((item) => item.type !== 'PERSONAL') ?? remaining[0] ?? null;
    setOrganizations(remaining);
    setOrganizationId(nextOrganization?.id ?? '');
    setView('people');
    setOrganizationDeleteOpen(false);
    setOrganizationDeleteName('');
    toast.success(`Se eliminó la organización ${getDisplayOrganizationName(organization.name)}.`);
  }

  return (
    <main className={styles.page} style={page}>
      <header className={styles.header} style={header}>
        <div>
          <h1 style={title}>{isPersonal ? 'Espacio personal' : selectedOrganization ? getDisplayOrganizationName(selectedOrganization.name) : 'Organización'}</h1>
          <p style={subtitle}>{selectedOrganization ? isPersonal
            ? `${currentUser?.name ?? 'Tu cuenta'} — Plan Free — 1 persona — ${selectedOrganization.workspaceCount} ${selectedOrganization.workspaceCount === 1 ? 'espacio de trabajo' : 'espacios de trabajo'}`
            : `${selectedOrganization.type === 'INSTITUTION' ? 'Institución' : selectedOrganization.type === 'NETWORK_OPERATOR' ? 'Red de colaboración' : 'Equipo o empresa'} — ${selectedOrganization.workspaceCount} ${selectedOrganization.workspaceCount === 1 ? 'espacio de trabajo' : 'espacios de trabajo'} — ${members.length} ${members.length === 1 ? 'persona' : 'personas'}`
            : 'Personas, accesos y configuración de tu organización.'}</p>
        </div>
        {!isPersonal && <div style={headerActions}>
          {selectedOrganization && canInvite && (
            <button type="button" className={styles.primaryButton} style={primaryButton} onClick={() => { setActionError(''); setInviteOpen(true); }}>
              <UserPlus size={16} /> Invitar persona
            </button>
          )}
        </div>}
      </header>

      {loadError && <div role="alert" style={errorBanner}>{loadError}</div>}
      {actionError && <div role="alert" style={errorBanner}>{actionError}</div>}
      {loadingOrganizations && <div style={empty}><RefreshCw className="animate-spin" size={22} /> Cargando organizaciones…</div>}
      {!loadingOrganizations && organizations.length === 0 && !loadError && (
        <section style={empty}><Building2 size={30} /><strong>No hay organizaciones disponibles.</strong><span>Crea una organización o solicita que te inviten para poder administrar su equipo.</span></section>
      )}

      {selectedOrganization && (
        <>
          {isPersonal ? (
            <section className={styles.personalOverview} aria-labelledby="personal-overview-title">
              <div className={styles.personalWelcome}>
                <span className={styles.personalWelcomeIcon}><UserRound size={20} aria-hidden="true" /></span>
                <div className={styles.personalWelcomeCopy}>
                  <span className={styles.personalEyebrow}>ESPACIO PRIVADO</span>
                  <h2 id="personal-overview-title">Tu espacio, bajo tu control</h2>
                  <p>Organiza tu trabajo individual. Solo tú puedes acceder a este espacio y no admite invitaciones.</p>
                </div>
                <span className={styles.personalPlanBadge}><Sparkles size={14} aria-hidden="true" /> Plan Free</span>
              </div>

              <div className={styles.personalGrid}>
                <article className={styles.personalCard}>
                  <div className={styles.personalCardHeading}>
                    <span className={styles.personalCardIcon}><UserRound size={17} aria-hidden="true" /></span>
                    <div><h3>Tu cuenta</h3><p>Propietario del espacio personal</p></div>
                  </div>
                  <div className={styles.personalIdentity}>
                    <span className={styles.personalAvatar}>{initials(personalName)}</span>
                    <span className={styles.personalIdentityCopy}><strong>{personalName}</strong><small>{personalEmail || 'Cuenta de AETHER'}</small></span>
                    <span className={styles.personalOwnerBadge}>Propietario</span>
                  </div>
                </article>

                <article className={styles.personalCard}>
                  <div className={styles.personalCardHeading}>
                    <span className={styles.personalCardIcon}><BriefcaseBusiness size={17} aria-hidden="true" /></span>
                    <div><h3>Espacio de trabajo</h3><p>{selectedOrganization.workspaceCount} {selectedOrganization.workspaceCount === 1 ? 'espacio asociado' : 'espacios asociados'}</p></div>
                  </div>
                  {personalWorkspaces.length > 0 ? <div className={styles.personalWorkspaceList}>
                    {personalWorkspaces.map((workspace) => <div className={styles.personalWorkspace} key={workspace.id}>
                      <span className={styles.personalWorkspaceMark}><Building2 size={15} aria-hidden="true" /></span>
                      <span><strong>{workspace.name}</strong><small>Espacio personal</small></span>
                    </div>)}
                  </div> : <div className={styles.personalWorkspaceFallback}>{selectedOrganization.workspaceCount > 0
                    ? `Tu cuenta conserva ${selectedOrganization.workspaceCount} ${selectedOrganization.workspaceCount === 1 ? 'espacio de trabajo' : 'espacios de trabajo'} personal.`
                    : 'Aún no tienes un espacio de trabajo. Puedes crear uno desde el selector del sidebar.'}</div>}
                  <p className={styles.personalCardFootnote}>Tus proyectos y tableros aquí son privados para ti.</p>
                </article>
              </div>

              <div className={styles.personalPlanCard}>
                <div className={styles.personalPlanCopy}>
                  <span className={styles.personalEyebrow}>PLAN ACTUAL</span>
                  <h3>Free personal</h3>
                  <p>Un espacio individual para organizar tus proyectos.</p>
                </div>
                <div className={styles.personalPlanFacts} aria-label="Incluido en Free personal">
                  <span>1 usuario</span>
                  <span>Proyectos privados</span>
                  <span>Sin invitaciones ni miembros de proyecto</span>
                  <span>Sin equipos, cronograma, sprints ni metodología</span>
                </div>
              </div>

              <aside className={styles.personalCollaborationNote}>
                <ShieldCheck size={18} aria-hidden="true" />
                <div><strong>¿Necesitas colaborar?</strong><p>Desde el selector del sidebar puedes crear o cambiar a una organización compartida para invitar personas y trabajar en equipo.</p></div>
              </aside>
            </section>
          ) : <>
          <nav className={styles.viewTabs} aria-label="Áreas de la organización">
            <button type="button" aria-current={view === 'people' ? 'page' : undefined} onClick={() => selectOrganizationView('people')}><Users size={16} /> Personas y accesos <span>{members.length}</span></button>
            {selectedOrganization.type === 'INSTITUTION' && <button type="button" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => selectOrganizationView('settings')}><Building2 size={16} /> Configuración institucional</button>}
            {selectedOrganization.type === 'COMPANY' && <button type="button" aria-current={view === 'settings' ? 'page' : undefined} onClick={() => selectOrganizationView('settings')}><Building2 size={16} /> Configuración del equipo</button>}
          </nav>
          <div className={styles.organizationViewStage}>
          <div className={styles.organizationViewPanel} data-active={view === 'people'} aria-hidden={view !== 'people'} inert={view !== 'people'} id="organization-people">
          {canViewUsage && <section className={styles.storageUsage} aria-labelledby="organization-storage-title">
            <div className={styles.storageUsageHeading}>
              <span className={styles.storageUsageIcon}><HardDrive size={17} aria-hidden="true" /></span>
              <div className={styles.storageUsageText}>
                <h2 id="organization-storage-title">Almacenamiento de la organización</h2>
                <p>Documentos y versiones guardados en sus espacios de trabajo.</p>
              </div>
              {loadingUsage ? <span className={styles.storageUsageStatus}><RefreshCw size={14} className="animate-spin" /> Midiendo…</span>
                : organizationUsage?.usage.storageLimitBytes !== null && organizationUsage?.usage.storageLimitBytes !== undefined
                  ? <strong className={styles.storageUsageValue}>{formatStorageBytes(organizationUsage.usage.storageUsedBytes)} <span>/ {formatStorageBytes(organizationUsage.usage.storageLimitBytes)}</span></strong>
                  : organizationUsage ? <strong className={styles.storageUsageValue}>{formatStorageBytes(organizationUsage.usage.storageUsedBytes)} <span>usados</span></strong> : null}
            </div>
            {usageError ? <p className={styles.storageUsageError} role="status">{usageError}</p>
              : organizationUsage && organizationUsage.usage.storageLimitBytes !== null && <>
                <div className={styles.storageUsageTrack} role="meter" aria-label="Almacenamiento utilizado" aria-valuemin={0} aria-valuemax={organizationUsage.usage.storageLimitBytes} aria-valuenow={Math.min(organizationUsage.usage.storageUsedBytes, organizationUsage.usage.storageLimitBytes)} aria-valuetext={`${formatStorageBytes(organizationUsage.usage.storageUsedBytes)} de ${formatStorageBytes(organizationUsage.usage.storageLimitBytes)}`}>
                  <span style={{ width: `${Math.min(100, organizationUsage.usage.storagePercent ?? 0)}%` }} />
                </div>
                <p className={styles.storageUsageFootnote}>{organizationUsage.usage.storagePercent ?? 0}% del límite del plan actual</p>
              </>}
          </section>}
          <section className={styles.notice} style={notice}>
              <Mail size={18} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <span>Invita por correo o elige un contacto. Al aceptar, las personas entran al espacio predeterminado si está configurado (excepto el rol de facturación). También puedes asignar espacios directamente desde «Acciones».</span>
              </div>
          </section>

          <div className={`${styles.accessSections} ${!isManager ? styles.accessSectionsSingle : ''}`}>
            <section className={`${styles.section} ${styles.membersSection}`} style={{ ...section, marginTop: 0 }} aria-labelledby="members-title">
              <div className={styles.memberHeading}>
                <div><h2 id="members-title" style={sectionTitle}>Miembros</h2><p style={sectionCopy}>Personas que ya aceptaron unirse a esta organización.</p></div>
                <span style={countPill}>{members.length} {members.length === 1 ? 'persona' : 'personas'}</span>
              </div>
              <div className={styles.memberToolbar}>
                <label className={styles.memberSearch}>
                  <Search size={17} aria-hidden="true" />
                  <span className={styles.srOnly}>Buscar miembros de esta organización</span>
                  <input type="search" value={memberSearch} onChange={(event) => { setMemberSearch(event.target.value); setMemberPage(1); }} placeholder="Buscar por nombre o correo" />
                </label>
                <span className={styles.memberResultCount} aria-live="polite">{memberSearch.trim() ? `${filteredMembers.length} ${filteredMembers.length === 1 ? 'resultado' : 'resultados'}` : `${members.length} en esta organización`}</span>
              </div>
              {loadingMembers ? <div style={listEmpty}><RefreshCw className="animate-spin" size={18} /> Cargando miembros…</div> : members.length === 0 ? <div style={listEmpty}>Todavía no hay miembros en esta organización.</div> : filteredMembers.length === 0 ? (
                <div className={styles.memberEmpty}>No encontramos personas con «{memberSearch.trim()}» en esta organización.</div>
              ) : (
                <>
                  <div className={styles.memberColumnHead} aria-hidden="true"><span>Persona</span><span>Rol</span><span>Acciones</span></div>
                  <div id="member-list" className={styles.memberList}>
                    {visibleMembers.map((member) => {
                      const canRemoveMember = isManager && member.userId !== currentUserId && member.role !== 'OWNER'
                        && (selectedOrganization.role === 'OWNER' || member.role === 'MEMBER');
                      const canAssignMember = isManager && member.userId !== currentUserId && assignableWorkspaces.length > 0;
                      const canChangeRole = selectedOrganization.role === 'OWNER' && member.userId !== currentUserId && member.role !== 'OWNER';
                      return <article key={member.userId} className={styles.memberRow}>
                        <div className={styles.memberIdentity}>
                          <MemberAvatar name={member.name} photo={member.avatar} />
                          <span className={styles.memberIdentityText}><strong>{member.name}</strong><small>{member.email}</small></span>
                        </div>
                        <span className={styles.memberRole}>{roleLabel[member.role]}</span>
                        <div className={styles.memberActions}>
                          {canChangeRole && <button type="button" className={styles.memberRoleButton} aria-label={`Cambiar rol de ${member.name}`} onClick={() => { setMemberToChangeRole(member); setNewMemberRole(member.role as InviteRole); setMemberRoleUpdateError(''); }}><ShieldCheck size={14} aria-hidden="true" /><span className={styles.memberRoleButtonLabel}>Cambiar rol</span></button>}
                          {(canAssignMember || canRemoveMember) && <DropdownMenu.Root>
                            <DropdownMenu.Trigger asChild><button type="button" className={styles.memberActionTrigger} aria-label={`Acciones de ${member.name}`}><MoreHorizontal size={18} /></button></DropdownMenu.Trigger>
                            <DropdownMenu.Portal>
                              <DropdownMenu.Content className={styles.memberActionMenu} sideOffset={5} align="end">
                                {canAssignMember && <DropdownMenu.Item className={styles.memberActionItem} onSelect={() => openAssignment(member)}>Asignar espacio</DropdownMenu.Item>}
                                {canRemoveMember && <DropdownMenu.Item className={`${styles.memberActionItem} ${styles.memberActionDanger}`} onSelect={() => { setRemoveMemberError(''); setMemberToRemove(member); }}>Quitar de la organización</DropdownMenu.Item>}
                              </DropdownMenu.Content>
                            </DropdownMenu.Portal>
                          </DropdownMenu.Root>}
                        </div>
                      </article>;
                    })}
                  </div>
                  <div className={styles.memberPagination}>
                    <span>Mostrando {(currentMemberPage - 1) * MEMBERS_PER_PAGE + 1}–{Math.min(currentMemberPage * MEMBERS_PER_PAGE, filteredMembers.length)} de {filteredMembers.length}</span>
                    {memberPageCount > 1 && <nav aria-label="Páginas de miembros" className={styles.memberPageControls}>
                      <button type="button" onClick={() => setMemberPage(currentMemberPage - 1)} disabled={currentMemberPage === 1} aria-label="Página anterior"><ChevronLeft size={17} /></button>
                      <span>Página {currentMemberPage} de {memberPageCount}</span>
                      <button type="button" onClick={() => setMemberPage(currentMemberPage + 1)} disabled={currentMemberPage === memberPageCount} aria-label="Página siguiente"><ChevronRight size={17} /></button>
                    </nav>}
                  </div>
                </>
              )}
            </section>

            {isManager && <section className={`${styles.section} ${styles.invitationSection}`} style={{ ...section, marginTop: 0, padding: '17px 14px' }}>
              <div className={styles.invitationHeading}><h2 style={sectionTitle}>Invitaciones</h2><span style={countPill}><Clock3 size={14} /> {invitations.length}</span></div>
              <p className={styles.invitationIntro}>Pendientes por aceptar.</p>
              {loadingMembers ? <div style={listEmpty}>Cargando invitaciones…</div> : invitations.length === 0 ? <div style={listEmpty}>No hay invitaciones pendientes.</div> : (
                <div className={styles.invitationList}>
                  {invitations.map((invitation) => (
                    <article key={invitation.id} className={styles.invitationItem}>
                      <strong title={invitation.email}>{invitation.email}</strong>
                      <span>{roleLabel[invitation.role]} — Vence {formatDate(invitation.expiresAt)}</span>
                      <div className={styles.invitationActions}>
                        <button type="button" aria-label={`Regenerar código para ${invitation.email}`} title="Regenerar código (invalida el anterior)" onClick={() => void regenerateCode(invitation)} disabled={!!regeneratingId} style={iconButton}>
                          {regeneratingId === invitation.id ? <RefreshCw size={15} className="animate-spin" /> : <KeyRound size={15} />}
                        </button>
                        <button type="button" aria-label={`Revocar invitación para ${invitation.email}`} title="Revocar invitación" onClick={() => void revokeInvitation(invitation)} disabled={revokingId === invitation.id} style={iconButton}>
                          {revokingId === invitation.id ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>}

            {!isManager && <section className={`${styles.notice} ${styles.accessNotice}`} style={notice}><ShieldCheck size={18} /><span>Solo el propietario o los administradores pueden invitar personas y gestionar invitaciones pendientes.</span></section>}
          </div>
          </div>
          <div className={styles.organizationViewPanel} data-active={view === 'settings'} aria-hidden={view !== 'settings'} inert={view !== 'settings'} id="organization-settings">
          {selectedOrganization.type === 'INSTITUTION' && <InstitutionalSettingsPanel key={selectedOrganization.id} organizationId={selectedOrganization.id} canManage={isManager} onInvitationAuthorityChange={setInvitationAuthority} />}
          {selectedOrganization.type === 'COMPANY' && <>
            <TeamOrganizationSettingsPanel key={selectedOrganization.id} organizationId={selectedOrganization.id} canManage={isManager} onInvitationAuthorityChange={setTeamInvitationAuthority} />
            {canDeleteOrganization && <section className={styles.dangerZone} aria-labelledby="delete-organization-section-title">
              <div className={styles.dangerZoneCopy}>
                <span className={styles.dangerZoneIcon} aria-hidden="true"><Trash2 size={17} /></span>
                <div>
                  <h2 id="delete-organization-section-title">Eliminar organización</h2>
                  <p>Solo se permite cuando no queden espacios, carteras ni redes de colaboración asociadas.</p>
                </div>
              </div>
              <button type="button" className={styles.dangerButton} onClick={() => { setOrganizationDeleteName(''); setOrganizationDeleteError(''); setOrganizationDeleteOpen(true); }}>
                <Trash2 size={15} /> Eliminar organización
              </button>
            </section>}
          </>}
          </div>
          </div>
          </>}
        </>
      )}

      {inviteOpen && selectedOrganization && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !sending) setInviteOpen(false); }}>
        <form onSubmit={(event) => void sendInvitation(event)} className={styles.modal} style={modal}>
          <div style={modalHeader}><div><p style={eyebrow}>INVITAR A LA ORGANIZACIÓN</p><h2 style={modalTitle}>Añadir una persona</h2></div><button type="button" aria-label="Cerrar" onClick={() => setInviteOpen(false)} style={iconButton}><X size={17} /></button></div>
          <p style={modalCopy}>Generaremos un código y un enlace para compartir. También intentaremos enviarlos por correo. Caducan en siete días.</p>
          <label style={field}>Correo electrónico<input autoFocus required type="email" maxLength={255} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nombre@empresa.com" style={input} /></label>
          <div className={styles.contactPicker}>
            <strong>O elige uno de tus contactos</strong>
            {contactsLoading ? <p>Cargando contactos…</p> : contactsError ? <p role="status">{contactsError}</p> : contacts.length === 0 ? <p>No tienes contactos disponibles para invitar a esta organización.</p> : <div className={styles.contactList}>
              {contacts.map((contact) => <button key={contact.id} type="button" aria-pressed={email.toLowerCase() === contact.email.toLowerCase()} onClick={() => setEmail(contact.email)} className={styles.contactOption}>
                <MemberAvatar name={contact.name} photo={contact.avatar} />
                <span><strong>{contact.name}</strong><small>{contact.email}</small></span>
              </button>)}
            </div>}
          </div>
          <div className={styles.selectField} style={field}><span>Rol en la organización</span><ProjectOptionSelect label="Rol en la organización" value={inviteRole} onChange={(value) => setInviteRole(value as InviteRole)} menuZIndex={100} options={[{ value: 'MEMBER', label: 'Miembro' }, ...(selectedOrganization.role === 'OWNER' ? [{ value: 'ADMIN', label: 'Administrador' }, { value: 'BILLING_ADMIN', label: 'Administrador de facturación' }] : [])]} /></div>
          {inviteRole === 'BILLING_ADMIN' ? (
            <p style={roleHint}>Puede actualizar el correo de facturación y consultar plan/uso. La contratación depende de configurar pagos, y propietario y administradores también conservan acceso a plan/uso. No gestiona miembros ni espacios; en el piloto gratuito puedes dejarlo sin asignar.</p>
          ) : selectedOrganization.role !== 'OWNER' ? <p style={roleHint}>Como administrador, puedes invitar miembros. El propietario gestiona los demás roles.</p> : null}
          {actionError && <p role="alert" style={errorBanner}>{actionError}</p>}
          <div style={actions}><button type="button" onClick={() => setInviteOpen(false)} disabled={sending} style={secondaryButton}>Cancelar</button><button type="submit" disabled={!email.trim() || sending} style={primaryButton}>{sending ? 'Generando…' : 'Generar invitación'}</button></div>
        </form>
      </div>, document.body)}
      {generatedInvitation && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget) setGeneratedInvitation(null); }}>
        <section role="dialog" aria-modal="true" aria-label="Código de invitación generado" className={styles.modal} style={{ ...modal, width: 'min(560px, 100%)' }}>
          <div style={modalHeader}><div><p style={eyebrow}>INVITACIÓN GENERADA</p><h2 style={modalTitle}>Comparte el acceso</h2></div><button type="button" aria-label="Cerrar código" onClick={() => setGeneratedInvitation(null)} style={iconButton}><X size={17} /></button></div>
          <p style={modalCopy}>Para <strong>{generatedInvitation.email}</strong>. Vence el {formatDate(generatedInvitation.expiresAt)}. La persona debe iniciar sesión con ese correo.</p>
          {generatedInvitation.emailStatus === 'failed' && <p role="alert" style={errorBanner}>No se pudo enviar el correo. La invitación sí está activa: comparte el código o enlace manualmente.</p>}
          {generatedInvitation.emailStatus === 'not_sent' && <p style={notice}>Se generó un código nuevo; no se envió un correo. El código anterior ya no funciona.</p>}
          {generatedInvitation.emailStatus === 'sent' && <p style={notice}>El proveedor aceptó el correo. También puedes compartir el código o enlace manualmente.</p>}
          <div className={styles.shareRow}>
            <label className={styles.shareField} style={field}>Código de invitación<input aria-label="Código de invitación" readOnly value={generatedInvitation.code} onFocus={(event) => event.currentTarget.select()} style={{ ...input, fontFamily: 'monospace', fontSize: 11 }} /></label>
            <button type="button" className={styles.copyButton} onClick={() => void copyInvitation(generatedInvitation.code, 'Código')}><Copy size={15} /> Copiar código</button>
          </div>
          <div className={styles.shareRow}>
            <label className={styles.shareField} style={field}>Enlace de invitación<input aria-label="Enlace de invitación" readOnly value={generatedInvitation.link} onFocus={(event) => event.currentTarget.select()} style={input} /></label>
            <button type="button" className={styles.copyButton} onClick={() => void copyInvitation(generatedInvitation.link, 'Enlace')}><Copy size={15} /> Copiar enlace</button>
          </div>
          {copyFeedback && <p role="status" style={modalCopy}>{copyFeedback}</p>}
          <p style={roleHint}>Guárdalo ahora: por seguridad, el código no se vuelve a mostrar. Puedes generar otro desde Invitaciones pendientes.</p>
          <div style={actions}><button type="button" onClick={() => setGeneratedInvitation(null)} style={primaryButton}>Listo</button></div>
        </section>
      </div>, document.body)}
      {memberToRemove && selectedOrganization && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !removingMemberId) setMemberToRemove(null); }}>
        <form role="dialog" aria-modal="true" aria-labelledby="remove-member-title" onSubmit={(event) => void removeOrganizationMember(event)} className={`${styles.modal} ${styles.deleteModal}`} style={modal}>
          <div className={styles.deleteHeading}>
            <span className={styles.deleteIcon}><UserMinus size={19} /></span>
            <button type="button" aria-label="Cerrar confirmación" onClick={() => setMemberToRemove(null)} disabled={!!removingMemberId} style={iconButton}><X size={17} /></button>
          </div>
          <div>
            <p className={styles.dangerEyebrow}>CAMBIO DE ACCESO</p>
            <h2 id="remove-member-title" style={modalTitle}>Quitar a {memberToRemove.name}</h2>
          </div>
          <p style={modalCopy}>Dejará de pertenecer a <strong>{getDisplayOrganizationName(selectedOrganization.name)}</strong> y perderá el acceso que recibió por esta organización. Si es propietaria de un espacio de trabajo, primero tendrás que transferirlo.</p>
          {removeMemberError && <p role="alert" style={errorBanner}>{removeMemberError}</p>}
          <div className={styles.deleteActions} style={actions}>
            <button type="button" onClick={() => setMemberToRemove(null)} disabled={!!removingMemberId} style={secondaryButton}>Cancelar</button>
            <button type="submit" className={styles.dangerButton} disabled={!!removingMemberId}>
              {removingMemberId ? <RefreshCw size={15} className="animate-spin" /> : <UserMinus size={15} />} {removingMemberId ? 'Quitando…' : 'Quitar de la organización'}
            </button>
          </div>
        </form>
      </div>, document.body)}
      {memberToChangeRole && selectedOrganization && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !savingMemberRole) setMemberToChangeRole(null); }}>
        <form role="dialog" aria-modal="true" aria-labelledby="change-member-role-title" onSubmit={(event) => void changeOrganizationMemberRole(event)} className={styles.modal} style={modal}>
          <div style={modalHeader}><h2 id="change-member-role-title" style={modalTitle}>Cambiar rol de {memberToChangeRole.name}</h2><button type="button" aria-label="Cerrar cambio de rol" onClick={() => setMemberToChangeRole(null)} disabled={savingMemberRole} style={iconButton}><X size={17} /></button></div>
          <p style={modalCopy}>El rol define los permisos de esta persona dentro de la organización.</p>
          <div className={styles.selectField} style={field}><span>Nuevo rol</span><ProjectOptionSelect label="Nuevo rol" value={newMemberRole} onChange={(value) => setNewMemberRole(value as InviteRole)} menuZIndex={100} options={[{ value: 'MEMBER', label: 'Miembro' }, { value: 'ADMIN', label: 'Administrador' }, { value: 'BILLING_ADMIN', label: 'Administrador de facturación' }]} /></div>
          {memberRoleUpdateError && <p role="alert" style={errorBanner}>{memberRoleUpdateError}</p>}
          <div style={actions}><button type="button" onClick={() => setMemberToChangeRole(null)} disabled={savingMemberRole} style={secondaryButton}>Cancelar</button><button type="submit" disabled={savingMemberRole || newMemberRole === memberToChangeRole.role} style={primaryButton}>{savingMemberRole ? 'Guardando…' : 'Guardar rol'}</button></div>
        </form>
      </div>, document.body)}
      {memberToAssign && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !assigning) setMemberToAssign(null); }}>
        <form onSubmit={(event) => void assignWorkspace(event)} className={styles.modal} style={modal}>
          <div style={modalHeader}><div><p style={eyebrow}>ACCESO A ESPACIO</p><h2 style={modalTitle}>Asignar a {memberToAssign.name}</h2></div><button type="button" aria-label="Cerrar asignación" onClick={() => setMemberToAssign(null)} disabled={assigning} style={iconButton}><X size={17} /></button></div>
          <p style={modalCopy}>Esta persona ya pertenece a la organización. Al asignarla, obtendrá acceso inmediato a los espacios seleccionados.</p>
          <div style={field}><span>Espacios de trabajo</span><MultiSelectDropdown label="Espacios de trabajo" value={assignWorkspaceIds} onChange={setAssignWorkspaceIds} options={assignableWorkspaces.map((workspace) => ({ value: workspace.id, label: workspace.name }))} disabled={assigning} /></div>
          <div className={styles.selectField} style={field}><span>Rol en el espacio</span><ProjectOptionSelect label="Rol en el espacio" value={assignRole} onChange={(value) => setAssignRole(value as 'MEMBER' | 'VIEWER')} disabled={assigning} options={[{ value: 'MEMBER', label: 'Miembro' }, { value: 'VIEWER', label: 'Observador' }]} /></div>
          {assignError && <p role="alert" style={errorBanner}>{assignError}</p>}
          <div style={actions}><button type="button" onClick={() => setMemberToAssign(null)} disabled={assigning} style={secondaryButton}>Cancelar</button><button type="submit" disabled={assigning || assignWorkspaceIds.length === 0} style={primaryButton}>{assigning ? 'Asignando…' : `Asignar a ${assignWorkspaceIds.length || ''} ${assignWorkspaceIds.length === 1 ? 'espacio' : 'espacios'}`}</button></div>
        </form>
      </div>, document.body)}
      {organizationDeleteOpen && selectedOrganization && canDeleteOrganization && typeof document !== 'undefined' && createPortal(<div className={styles.overlay} style={overlay} onMouseDown={(event) => { if (event.target === event.currentTarget && !deletingOrganization) setOrganizationDeleteOpen(false); }}>
        <form role="alertdialog" aria-modal="true" aria-labelledby="delete-organization-title" onSubmit={(event) => void deleteOrganization(event)} className={`${styles.modal} ${styles.deleteModal}`} style={modal}>
          <div className={styles.deleteHeading}>
            <span className={styles.deleteIcon} aria-hidden="true"><Trash2 size={19} /></span>
            <button type="button" aria-label="Cerrar confirmación" onClick={() => setOrganizationDeleteOpen(false)} disabled={deletingOrganization} style={iconButton}><X size={17} /></button>
          </div>
          <div>
            <p className={styles.dangerEyebrow}>ACCIÓN IRREVERSIBLE</p>
            <h2 id="delete-organization-title" style={modalTitle}>¿Eliminar {getDisplayOrganizationName(selectedOrganization.name)}?</h2>
          </div>
          <p style={modalCopy}>Se eliminarán la organización, sus miembros y las invitaciones pendientes. Para proteger su información, primero debes dejarla sin espacios de trabajo, carteras ni redes de colaboración.</p>
          {selectedOrganization.workspaceCount > 0 && <p className={styles.deleteBlocked} role="status">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Bloqueado: quedan {selectedOrganization.workspaceCount} {selectedOrganization.workspaceCount === 1 ? 'espacio de trabajo' : 'espacios de trabajo'} asociado{selectedOrganization.workspaceCount === 1 ? '' : 's'}. Elimina todos antes de borrar la organización.</span>
          </p>}
          {(selectedOrganization.portfolioCount ?? 0) > 0 && <p className={styles.deleteBlocked} role="status">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Bloqueado: quedan {selectedOrganization.portfolioCount} {selectedOrganization.portfolioCount === 1 ? 'cartera' : 'carteras'} asociadas. Elimínalas o transfiere sus datos antes de borrar la organización.</span>
          </p>}
          {(selectedOrganization.networkCount ?? 0) > 0 && <p className={styles.deleteBlocked} role="status">
            <ShieldCheck size={16} aria-hidden="true" />
            <span>Bloqueado: la organización aún pertenece a {selectedOrganization.networkCount} {selectedOrganization.networkCount === 1 ? 'red de colaboración' : 'redes de colaboración'}.</span>
          </p>}
          <label style={field}>Escribe el nombre exacto<input autoFocus value={organizationDeleteName} onChange={(event) => { setOrganizationDeleteName(event.target.value); setOrganizationDeleteError(''); }} placeholder={selectedOrganization.name} autoComplete="off" style={input} /></label>
          {organizationDeleteError && <p role="alert" style={errorBanner}>{organizationDeleteError}</p>}
          <div className={styles.deleteActions} style={actions}>
            <button type="button" onClick={() => setOrganizationDeleteOpen(false)} disabled={deletingOrganization} style={secondaryButton}>Cancelar</button>
            <button type="submit" className={styles.dangerButton} disabled={deletingOrganization || selectedOrganization.workspaceCount > 0 || (selectedOrganization.portfolioCount ?? 0) > 0 || (selectedOrganization.networkCount ?? 0) > 0 || organizationDeleteName.trim() !== selectedOrganization.name}>
              {deletingOrganization ? <RefreshCw size={15} className="animate-spin" /> : <Trash2 size={15} />}
              {deletingOrganization ? 'Eliminando…' : 'Eliminar definitivamente'}
            </button>
          </div>
        </form>
      </div>, document.body)}
    </main>
  );
}

const page: CSSProperties = { width: '100%', minWidth: 0, minHeight: '100%', padding: 'clamp(22px, 3vw, 42px) clamp(18px, 3vw, 48px) 64px', boxSizing: 'border-box', color: 'var(--c-text)', fontFamily: "'Manrope', system-ui, sans-serif" };
const header: CSSProperties = { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 26 };
const headerActions: CSSProperties = { display: 'flex', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' };
const eyebrow: CSSProperties = { margin: 0, color: 'var(--c-accent-text)', fontSize: 10, fontWeight: 800, letterSpacing: '.12em' };
const title: CSSProperties = { margin: '6px 0 7px', color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 'clamp(29px, 4vw, 38px)', letterSpacing: '-.045em' };
const subtitle: CSSProperties = { margin: 0, color: 'var(--c-text2)', lineHeight: 1.55, fontSize: 14 };
const field: CSSProperties = { display: 'grid', gap: 6, color: 'var(--c-text3)', fontSize: 10, fontWeight: 800, letterSpacing: '.07em', textTransform: 'uppercase' };
const input: CSSProperties = { width: '100%', boxSizing: 'border-box', border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface2)', color: 'var(--c-text)', padding: '11px 12px', font: '500 13px Manrope, system-ui, sans-serif', textTransform: 'none', letterSpacing: 0, outlineColor: 'var(--c-accent-text)' };
const primaryButton: CSSProperties = { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: '1px solid var(--c-accent)', borderRadius: 10, background: 'var(--c-accent)', color: '#fff', padding: '11px 15px', font: "700 13px 'Manrope', system-ui, sans-serif", cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 5px 14px color-mix(in srgb, var(--c-accent) 20%, transparent)' };
const secondaryButton: CSSProperties = { border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface2)', color: 'var(--c-text2)', padding: '10px 14px', font: "600 13px 'Manrope', system-ui, sans-serif", cursor: 'pointer' };
const countPill: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, border: '1px solid var(--c-border)', borderRadius: 999, padding: '7px 10px', color: 'var(--c-text2)', background: 'var(--c-surface2)', fontSize: 11, fontWeight: 700 };
const notice: CSSProperties = { display: 'flex', alignItems: 'flex-start', gap: 11, padding: '14px 16px', marginBottom: 18, border: '1px solid color-mix(in srgb, var(--c-accent-text) 22%, transparent)', borderRadius: 11, background: 'color-mix(in srgb, var(--c-accent-text) 6%, var(--c-surface))', color: 'var(--c-text2)', fontSize: 12.5, lineHeight: 1.6 };
const section: CSSProperties = { padding: '19px 20px', marginTop: 14, border: '1px solid var(--c-border)', borderRadius: 14, background: 'var(--c-surface)', boxShadow: '0 8px 24px color-mix(in srgb, var(--c-text) 3%, transparent)' };
const sectionTitle: CSSProperties = { margin: 0, color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 15 };
const sectionCopy: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text3)', fontSize: 12, lineHeight: 1.5 };
const avatar: CSSProperties = { width: 36, height: 36, flexShrink: 0, display: 'grid', placeItems: 'center', borderRadius: '50%', background: 'var(--c-accent)', color: '#FFFFFF', fontSize: 11, fontWeight: 800 };
const iconButton: CSSProperties = { display: 'inline-grid', placeItems: 'center', flexShrink: 0, width: 34, height: 34, border: '1px solid var(--c-border2)', borderRadius: 9, background: 'var(--c-surface)', color: 'var(--c-text3)', cursor: 'pointer' };
const listEmpty: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 82, border: '1px dashed var(--c-border2)', borderRadius: 10, color: 'var(--c-text3)', background: 'var(--c-surface2)', fontSize: 12 };
const empty: CSSProperties = { minHeight: 220, display: 'grid', justifyItems: 'center', alignContent: 'center', gap: 10, border: '1px dashed var(--c-border2)', borderRadius: 14, color: 'var(--c-text3)', background: 'var(--c-surface)', padding: 24, textAlign: 'center' };
const errorBanner: CSSProperties = { padding: '11px 13px', marginBottom: 12, border: '1px solid color-mix(in srgb, var(--c-red) 30%, transparent)', borderRadius: 10, background: 'color-mix(in srgb, var(--c-red) 9%, var(--c-surface))', color: 'var(--c-red)', fontSize: 12.5 };
const overlay: CSSProperties = { position: 'fixed', inset: 0, zIndex: 80, display: 'grid', placeItems: 'center', padding: 18, background: 'rgba(18, 14, 24, .58)', backdropFilter: 'blur(6px)' };
const modal: CSSProperties = { width: 'min(460px, 100%)', display: 'grid', gap: 15, padding: 22, border: '1px solid var(--c-border2)', borderRadius: 15, background: 'var(--c-surface)', color: 'var(--c-text)', fontFamily: "'Manrope', system-ui, sans-serif", boxShadow: '0 22px 70px rgba(25, 18, 34, .22)' };
const modalHeader: CSSProperties = { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 };
const modalTitle: CSSProperties = { margin: '5px 0 0', color: 'var(--c-text)', fontFamily: "'Sora', system-ui, sans-serif", fontSize: 18 };
const modalCopy: CSSProperties = { margin: 0, color: 'var(--c-text2)', fontSize: 12.5, lineHeight: 1.55 };
const roleHint: CSSProperties = { margin: '-8px 0 0', color: 'var(--c-text3)', fontSize: 11, lineHeight: 1.5 };
const actions: CSSProperties = { display: 'flex', justifyContent: 'flex-end', gap: 9, marginTop: 3 };
