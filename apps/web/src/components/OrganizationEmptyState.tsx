'use client';

import Link from 'next/link';
import { ArrowRight, Building2, FolderPlus, LockKeyhole, RefreshCw } from 'lucide-react';
import { getDisplayOrganizationName } from '@/lib/organizationName';
import styles from './OrganizationEmptyState.module.css';

type Organization = { id: string; name: string; role?: string; workspaceCount?: number };

export default function OrganizationEmptyState({ organization, onCreateWorkspace, onRefresh }: {
  organization: Organization;
  onCreateWorkspace: () => void;
  onRefresh: () => void;
}) {
  const canCreate = organization.role === 'OWNER' || organization.role === 'ADMIN';
  const hasUnassignedSpaces = (organization.workspaceCount ?? 0) > 0;

  return <div className={styles.page}>
    <div className={styles.content}>
      <span className={styles.eyebrow}>TU ORGANIZACIÓN</span>
      <div className={styles.heading}>
        <span className={styles.organizationIcon}><Building2 size={23} strokeWidth={1.8} /></span>
        <div><h1>{getDisplayOrganizationName(organization.name)}</h1><p>Organización sin espacio activo</p></div>
      </div>
      <section className={styles.card} aria-labelledby="empty-organization-title">
        <span className={styles.cardIcon}>{hasUnassignedSpaces ? <LockKeyhole size={23} /> : <FolderPlus size={23} />}</span>
        <h2 id="empty-organization-title">{hasUnassignedSpaces ? 'Aún no tienes acceso a un espacio' : 'Todavía no hay espacios de trabajo'}</h2>
        <p>{hasUnassignedSpaces
          ? canCreate
            ? 'Esta organización tiene espacios a los que no tienes acceso. Puedes crear otro espacio o pedir que te asignen uno existente.'
            : 'Esta organización tiene espacios, pero todavía no te han asignado uno. Un administrador puede darte acceso.'
          : canCreate
            ? 'Crea el primer espacio para empezar a organizar proyectos, documentos y equipos. También puedes gestionar la organización sin crear uno.'
            : 'Podrás trabajar en proyectos, documentos y equipos cuando un administrador cree un espacio y te dé acceso.'}</p>
        <div className={styles.actions}>
          {canCreate && <button type="button" className={styles.primary} onClick={onCreateWorkspace}><FolderPlus size={16} /> Crear espacio de trabajo</button>}
          <Link className={styles.secondary} href={`/dashboard/organizations?organizationId=${encodeURIComponent(organization.id)}`}>Ver organización <ArrowRight size={15} /></Link>
          <button type="button" className={styles.refresh} onClick={onRefresh}><RefreshCw size={15} /> Actualizar</button>
        </div>
      </section>
      <p className={styles.hint}>Mientras tanto, puedes consultar tus notificaciones, contactos y calendario personal.</p>
    </div>
  </div>;
}
