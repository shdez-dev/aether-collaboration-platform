'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useT } from '@/lib/i18n';

export function Footer() {
  const t = useT();

  return (
    <footer className="relative py-12 md:py-16 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-10 mb-10">
          {/* Logo + description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-xl font-bold text-accent mb-3">AETHER</h3>
            <p className="text-text-secondary text-sm leading-relaxed max-w-xs">
              {t.home_footer_desc}
            </p>
          </motion.div>

          {/* Links */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="sm:text-right"
          >
            <h4 className="text-text-primary text-sm font-semibold mb-3">{t.home_footer_access}</h4>
            <ul className="space-y-2 text-text-secondary text-sm">
              <li>
                <Link href="/register" className="hover:text-accent transition-colors">
                  {t.home_footer_create_account}
                </Link>
              </li>
              <li>
                <Link href="/login" className="hover:text-accent transition-colors">
                  {t.home_footer_sign_in}
                </Link>
              </li>
              <li>
                <Link href="/dashboard" className="hover:text-accent transition-colors">
                  Dashboard
                </Link>
              </li>
            </ul>
          </motion.div>
        </div>

        <div className="h-px bg-border mb-6" />

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-col sm:flex-row justify-between items-center gap-3 text-text-muted text-xs"
        >
          <p>{t.home_footer_copyright}</p>
          <p className="text-text-muted italic">&quot;Synchronization is an illusion. Only events exist in time.&quot;</p>
        </motion.div>
      </div>

      {/* Decorative glows */}
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/4 rounded-full blur-3xl -z-10 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/4 rounded-full blur-3xl -z-10 pointer-events-none" />
    </footer>
  );
}
