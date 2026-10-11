import type { ReactNode } from 'react';
import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';

export type LegalSection = {
  id: string;
  title: string;
  content: ReactNode;
};

type LegalDocumentProps = {
  current: 'terms' | 'privacy' | 'aup';
  title: string;
  lead: string;
  sections: LegalSection[];
};

const documents = [
  { id: 'terms', label: 'Términos', href: '/legal/terms' },
  { id: 'privacy', label: 'Privacidad', href: '/legal/privacy' },
  { id: 'aup', label: 'Uso aceptable', href: '/legal/aup' },
] as const;

export function LegalDocument({ current, title, lead, sections }: LegalDocumentProps) {
  return (
    <>
      <header className="legal-header">
        <div className="legal-header-inner">
          <Link className="legal-brand" href="/" aria-label="AETHER, volver al inicio">
            <BrandMark size={40} tone="light" />
          </Link>
          <Link className="legal-back" href="/">
            <svg viewBox="0 0 18 18" fill="none" aria-hidden="true"><path d="M15 9H4m4 4L4 9l4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" /></svg>
            Volver al inicio
          </Link>
        </div>
      </header>

      <div className="legal-hero">
        <div className="legal-hero-inner">
          <h1>{title}</h1>
          <p>{lead}</p>
          <span>Revisión de contenido: 10 de octubre de 2026</span>
        </div>
      </div>

      <nav className="legal-document-nav" aria-label="Páginas legales">
        <div>
          {documents.map((document) => (
            <Link key={document.id} href={document.href} aria-current={current === document.id ? 'page' : undefined}>
              {document.label}
            </Link>
          ))}
        </div>
      </nav>

      <div className="legal-content-grid">
        <aside className="legal-index" aria-label="Contenido de esta página">
          <p>En esta página</p>
          <nav>
            {sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>)}
          </nav>
        </aside>

        <article className="legal-article">
          <div className="legal-review-note" role="note">
            <strong>Documento en revisión</strong>
            <p>AETHER es un piloto gratuito por invitación operado por Juan Sebastian Hernandez Rincon, persona natural residente en Chile. El domicilio legal, la jurisdicción aplicable, los detalles del alojamiento de datos y la regla de edad mínima aún requieren confirmación y revisión jurídica antes de presentar estas páginas como condiciones definitivas.</p>
          </div>

          {sections.map((section) => (
            <section className="legal-section" id={section.id} key={section.id} aria-labelledby={`${section.id}-title`}>
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              <div className="legal-copy">{section.content}</div>
            </section>
          ))}

          <div className="legal-end">
            <span>Fin de {title.toLowerCase()}</span>
            <Link href="/">Volver al inicio <span aria-hidden="true">→</span></Link>
          </div>
        </article>
      </div>

      <footer className="legal-footer">
        <Link href="/" aria-label="AETHER, volver al inicio"><BrandMark size={36} /></Link>
        <nav aria-label="Otras páginas legales">
          {documents.filter((document) => document.id !== current).map((document) => (
            <Link key={document.id} href={document.href}>{document.label}</Link>
          ))}
        </nav>
      </footer>
    </>
  );
}
