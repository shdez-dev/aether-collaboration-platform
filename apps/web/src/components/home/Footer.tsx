'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

function AetherLogo() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 220 220"
      fill="none"
      aria-label="Aether logo"
    >
      <path d="M 110 39 L 32 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
      <path d="M 110 39 L 188 173" stroke="#3B82F6" strokeWidth="10" strokeLinecap="round" />
      <path d="M 66 122 L 154 122" stroke="#3B82F6" strokeWidth="7" strokeLinecap="round" />
      <circle cx="110" cy="39" r="9" fill="#3B82F6" />
      <circle cx="32" cy="173" r="9" fill="#3B82F6" />
      <circle cx="188" cy="173" r="9" fill="#3B82F6" />
    </svg>
  );
}

export function Footer() {
  const t = useT();

  const columns = [
    {
      heading: t.home_footer_col_product,
      links: [
        { label: 'Dashboard', href: '/dashboard' },
        { label: 'Workspaces', href: '/dashboard/workspaces' },
        { label: 'Boards Kanban', href: '/dashboard/workspaces' },
        { label: 'Documentos colaborativos', href: '/dashboard/documents' },
        { label: 'Actividad en tiempo real', href: '/#activity' },
        { label: 'Notificaciones', href: '/dashboard/notifications' },
      ],
    },
    {
      heading: t.home_footer_col_resources,
      links: [
        { label: 'Documentación', href: '#' },
        { label: 'Guía de inicio rápido', href: '#' },
        { label: 'API Reference', href: '#' },
        { label: 'Changelog', href: '#' },
        { label: 'Status del sistema', href: '#' },
      ],
    },
    {
      heading: t.home_footer_col_project,
      links: [
        { label: 'Sobre Aether', href: '#' },
        { label: 'Roadmap público', href: '#' },
        { label: 'Contribuir', href: '#' },
        { label: 'Contacto', href: '#' },
        { label: 'GitHub', href: '#' },
      ],
    },
  ];

  return (
    <footer
      className="relative py-16 px-4 md:px-8"
      style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}
    >
      <div className="max-w-[1240px] mx-auto">
        {/* Main grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
          {/* Brand column */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
          >
            <Link href="/" className="flex items-center gap-2 mb-4" style={{ color: 'rgba(255,255,255,0.88)' }}>
              <AetherLogo />
              <span className="text-sm font-semibold">Aether</span>
            </Link>
            <p className="text-[13px] leading-relaxed max-w-[260px]" style={{ color: 'rgba(255,255,255,0.36)' }}>
              {t.home_footer_desc}
            </p>
          </motion.div>

          {/* Link columns */}
          {columns.map((col, i) => (
            <motion.div
              key={col.heading}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: 0.06 * (i + 1) }}
            >
              <h5
                className="font-mono text-[11px] uppercase tracking-[0.08em] font-medium mb-3.5"
                style={{ color: 'rgba(255,255,255,0.28)' }}
              >
                {col.heading}
              </h5>
              <ul className="space-y-1">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link
                      href={l.href}
                      className="block py-1 text-[13px] transition-colors"
                      style={{ color: 'rgba(255,255,255,0.42)' }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)')}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.42)')}
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono text-[11px]"
          style={{
            borderTop: '1px solid rgba(255,255,255,0.06)',
            color: 'rgba(255,255,255,0.28)',
          }}
        >
          <span>{t.home_footer_copyright}</span>
        </div>
      </div>

      {/* Decorative glows */}
      <div
        className="absolute bottom-0 left-0 w-64 h-64 rounded-full pointer-events-none -z-10"
        style={{ background: 'rgba(59,130,246,0.04)', filter: 'blur(80px)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-64 h-64 rounded-full pointer-events-none -z-10"
        style={{ background: 'rgba(168,85,247,0.04)', filter: 'blur(80px)' }}
      />
    </footer>
  );
}
