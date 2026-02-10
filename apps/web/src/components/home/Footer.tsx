'use client';

import { motion } from 'framer-motion';

export function Footer() {
  return (
    <footer className="relative py-12 px-4 sm:px-6 lg:px-8 border-t border-border">
      <div className="max-w-7xl mx-auto">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          {/* Logo and description */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h3 className="text-2xl font-bold text-accent mb-3 font-mono">AETHER</h3>
            <p className="text-text-muted text-sm leading-relaxed">
              Plataforma de colaboración en tiempo real construida con tecnologías modernas y
              patrones de arquitectura avanzados.
            </p>
          </motion.div>

          {/* Tech info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            <h4 className="text-text-primary font-semibold mb-3">Arquitectura</h4>
            <ul className="space-y-2 text-text-muted text-sm">
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> Event Sourcing
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> CQRS Pattern
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> Real-time Sync
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> CRDT Algorithms
              </li>
            </ul>
          </motion.div>

          {/* Tech Stack */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h4 className="text-text-primary font-semibold mb-3">Stack Principal</h4>
            <ul className="space-y-2 text-text-muted text-sm">
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> Next.js 14
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> TypeScript
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> Node.js + Express
              </li>
              <li className="flex items-center gap-2">
                <span className="text-accent">→</span> PostgreSQL + Redis
              </li>
            </ul>
          </motion.div>
        </div>

        {/* Divider */}
        <div className="h-px bg-border mb-6" />

        {/* Bottom bar */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="flex flex-col sm:flex-row justify-between items-center gap-4 text-text-muted text-sm"
        >
          <p className="font-mono">
            Build <span className="text-accent">2026.02.09</span> | Sistema Operacional
          </p>
          <p className="italic">"Synchronization is an illusion. Only events exist in time."</p>
        </motion.div>

        {/* Decorative elements */}
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-accent/5 rounded-full blur-3xl -z-10 pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500/5 rounded-full blur-3xl -z-10 pointer-events-none" />
      </div>
    </footer>
  );
}
