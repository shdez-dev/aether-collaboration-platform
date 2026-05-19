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


  return (
    <footer
      className="relative py-16 px-4 md:px-8"
      style={{ borderTop: '1px solid var(--home-border)' }}
    >
      <div className="max-w-[1240px] mx-auto">
        {/* Main grid */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-12"
        >
          <Link href="/" className="flex items-center gap-2 mb-4" style={{ color: 'var(--home-text-logo)' }}>
            <AetherLogo />
            <span className="text-sm font-semibold">Aether</span>
          </Link>
          <p className="text-[13px] leading-relaxed max-w-[260px]" style={{ color: 'var(--home-text-3)' }}>
            {t.home_footer_desc}
          </p>
        </motion.div>

        {/* Bottom bar */}
        <div
          className="pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 font-mono text-[11px]"
          style={{
            borderTop: '1px solid var(--home-border)',
            color: 'var(--home-text-4)',
          }}
        >
          <span>{t.home_footer_copyright}</span>
        </div>
      </div>

      {/* Decorative glows */}
      <div
        className="absolute bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none -z-10"
        style={{ background: 'rgba(59,130,246,0.09)', filter: 'blur(90px)' }}
      />
      <div
        className="absolute bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none -z-10"
        style={{ background: 'rgba(168,85,247,0.07)', filter: 'blur(90px)' }}
      />
    </footer>
  );
}
