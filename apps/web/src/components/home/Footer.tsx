'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useT } from '@/lib/i18n';
import { BrandMark } from '@/components/brand/BrandMark';

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
          <Link href="/" aria-label="AETHER, inicio" className="flex items-center gap-2 mb-4" style={{ color: 'var(--home-text-logo)' }}>
            <BrandMark size={32} />
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
