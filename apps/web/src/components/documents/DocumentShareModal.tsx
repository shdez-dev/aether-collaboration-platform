'use client';

import { useEffect, useRef } from 'react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import {
  Check,
  ChevronDown,
  Eye,
  MessageSquareText,
  PencilLine,
  Share2,
  X,
} from 'lucide-react';
import { getAvatarUrl } from '@/lib/utils/avatar';
import styles from './DocumentShareModal.module.css';

export type DocumentSharePermission = 'VIEW' | 'COMMENT' | 'EDIT';
type ProjectAccessLevel = 'READ' | 'CONTRIBUTE' | 'MANAGE';

export interface DocumentShareMember {
  userId: string;
  name: string;
  email: string;
  avatar?: string;
  workspaceRole: string;
  effectivePermission: DocumentSharePermission;
  isCreator: boolean;
  projectAccessLevel?: ProjectAccessLevel;
}

interface DocumentShareModalProps {
  members: DocumentShareMember[];
  loading: boolean;
  projectScoped: boolean;
  updatingUserId: string | null;
  onPermissionChange: (userId: string, permission: DocumentSharePermission) => void;
  onClose: () => void;
}

const permissionOptions: Array<{
  value: DocumentSharePermission;
  label: string;
  description: string;
  Icon: typeof Eye;
}> = [
  { value: 'VIEW', label: 'Ver', description: 'Puede leer el documento.', Icon: Eye },
  { value: 'COMMENT', label: 'Comentar', description: 'Puede leer y añadir comentarios.', Icon: MessageSquareText },
  { value: 'EDIT', label: 'Editar', description: 'Puede modificar el contenido.', Icon: PencilLine },
];

function PermissionSelect({
  member,
  disabled,
  updating,
  onChange,
  onMenuOpenChange,
}: {
  member: DocumentShareMember;
  disabled: boolean;
  updating: boolean;
  onChange: (permission: DocumentSharePermission) => void;
  onMenuOpenChange: (open: boolean) => void;
}) {
  const selected = permissionOptions.find((option) => option.value === member.effectivePermission) ?? permissionOptions[0];
  const SelectedIcon = selected.Icon;
  const projectReadOnly = member.projectAccessLevel === 'READ';

  return (
    <DropdownMenu.Root onOpenChange={onMenuOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className={`${styles.permissionTrigger} ${disabled ? styles.permissionTriggerDisabled : ''}`}
          disabled={disabled || updating}
          aria-label={`Permiso de ${member.name}: ${selected.label}${disabled ? ', protegido' : ''}`}
          title={disabled ? 'El permiso de esta persona está protegido.' : undefined}
        >
          <span className={`${styles.permissionIcon} ${styles[`permissionIcon${member.effectivePermission}`]}`}>
            {updating ? <span className={styles.spinner} aria-hidden="true" /> : <SelectedIcon size={15} strokeWidth={1.8} />}
          </span>
          <span className={styles.permissionTriggerCopy}>
            <span className={styles.permissionTriggerLabel}>{selected.label}</span>
            {disabled && <span className={styles.protectedLabel}>Protegido</span>}
          </span>
          <ChevronDown className={styles.permissionChevron} size={15} aria-hidden="true" />
        </button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className={styles.permissionMenu}
          align="end"
          sideOffset={8}
          collisionPadding={14}
          aria-label={`Cambiar permiso de ${member.name}`}
        >
          <div className={styles.permissionMenuHeading}>Permiso del documento</div>
          <DropdownMenu.RadioGroup
            value={member.effectivePermission}
            onValueChange={(value) => onChange(value as DocumentSharePermission)}
          >
            {permissionOptions.map(({ value, label, description, Icon }) => {
              const editBlocked = value === 'EDIT' && projectReadOnly;
              return (
                <DropdownMenu.RadioItem
                  key={value}
                  value={value}
                  disabled={editBlocked}
                  className={`${styles.permissionOption} ${member.effectivePermission === value ? styles.permissionOptionSelected : ''}`}
                >
                  <span className={styles.optionIcon}><Icon size={16} strokeWidth={1.8} /></span>
                  <span className={styles.optionCopy}>
                    <span className={styles.optionLabel}>{label}</span>
                    <span className={styles.optionDescription}>{description}</span>
                  </span>
                  <DropdownMenu.ItemIndicator className={styles.optionCheck}>
                    <Check size={15} strokeWidth={2.2} />
                  </DropdownMenu.ItemIndicator>
                </DropdownMenu.RadioItem>
              );
            })}
          </DropdownMenu.RadioGroup>
          {projectReadOnly && (
            <p className={styles.permissionMenuNote}>
              Para editar, la persona necesita acceso de colaboración al proyecto.
            </p>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

export default function DocumentShareModal({
  members,
  loading,
  projectScoped,
  updatingUserId,
  onPermissionChange,
  onClose,
}: DocumentShareModalProps) {
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const menuOpenRef = useRef(false);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !menuOpenRef.current) {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab' || menuOpenRef.current) return;

      const focusable = Array.from(
        panelRef.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), [href], [tabindex]:not([tabindex="-1"])',
        ) ?? [],
      ).filter((element) => element.getAttribute('aria-hidden') !== 'true');
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const activeElement = document.activeElement;
      if (event.shiftKey && (activeElement === first || !panelRef.current?.contains(activeElement))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (activeElement === last || !panelRef.current?.contains(activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, []);

  return (
    <div
      className={styles.overlay}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panelRef}
        className={styles.dialog}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-share-title"
        aria-describedby="document-share-description"
        tabIndex={-1}
      >
        <header className={styles.header}>
          <div className={styles.headerIcon}><Share2 size={17} strokeWidth={1.8} /></div>
          <div className={styles.headerCopy}>
            <h2 id="document-share-title">Compartir documento</h2>
            <p id="document-share-description">
              Elige qué puede hacer cada persona con este documento.
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className={styles.closeButton}
            aria-label="Cerrar compartir documento"
            onClick={onClose}
          >
            <X size={17} />
          </button>
        </header>

        {projectScoped && (
          <div className={styles.scopeNote}>
            Los permisos de documento respetan el acceso asignado al proyecto.
          </div>
        )}

        <div className={styles.body}>
          {loading ? (
            <div className={styles.loadingState} role="status" aria-label="Cargando personas">
              <span className={styles.spinnerLarge} aria-hidden="true" />
              <span>Cargando personas…</span>
            </div>
          ) : members.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}><Share2 size={19} /></span>
              <strong>No hay personas para mostrar</strong>
              <span>Las personas deben tener acceso al documento o al proyecto.</span>
            </div>
          ) : (
            <div className={styles.memberList}>
              {members.map((member) => {
                const isOwner = member.workspaceRole === 'OWNER';
                const protectedMember = isOwner || member.isCreator || member.projectAccessLevel === 'MANAGE';
                const avatar = getAvatarUrl(member.avatar);

                return (
                  <article key={member.userId} className={styles.memberRow}>
                    <div className={styles.avatar} aria-hidden="true">
                      {avatar ? <img src={avatar} alt="" /> : member.name.charAt(0).toUpperCase()}
                    </div>
                    <div className={styles.memberInfo}>
                      <div className={styles.memberNameLine}>
                        <span className={styles.memberName}>{member.name}</span>
                        {member.isCreator && <span className={`${styles.roleBadge} ${styles.creatorBadge}`}>Creador</span>}
                        {isOwner && <span className={`${styles.roleBadge} ${styles.ownerBadge}`}>Propietario</span>}
                      </div>
                      <span className={styles.memberEmail}>{member.email}</span>
                      {member.projectAccessLevel === 'READ' && (
                        <span className={styles.projectAccessHint}>Acceso de lectura al proyecto</span>
                      )}
                    </div>
                    <div className={styles.permissionCell}>
                      <PermissionSelect
                        member={member}
                        disabled={protectedMember || Boolean(updatingUserId && updatingUserId !== member.userId)}
                        updating={updatingUserId === member.userId}
                        onChange={(permission) => onPermissionChange(member.userId, permission)}
                        onMenuOpenChange={(open) => { menuOpenRef.current = open; }}
                      />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className={styles.footer}>
          <span className={styles.footerHint}>
            Los cambios se aplican al momento y definen el acceso a este documento.
          </span>
          <button type="button" className={styles.doneButton} onClick={onClose}>Listo</button>
        </footer>
      </section>
    </div>
  );
}
