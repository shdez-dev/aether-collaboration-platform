'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';

const modules = [
  {
    id: '01',
    name: 'Workspaces',
    tagline: 'Tu espacio, tu equipo.',
    description:
      'Crea un workspace, invita a tu equipo y empieza a colaborar en segundos. Permisos granulares para que cada persona vea solo lo que necesita.',
    indicators: ['Multi-board', 'Invitaciones por email', 'Roles: Admin / Member / Viewer'],
  },
  {
    id: '02',
    name: 'Boards Kanban',
    tagline: 'Mueve tareas. Todos lo ven.',
    description:
      'Tableros con listas y tarjetas que se arrastran en tiempo real. Cuando tú mueves algo, tu equipo lo ve al instante — sin F5, sin lag.',
    indicators: ['Drag & drop sincronizado', 'Etiquetas y fechas', 'Actividad en tiempo real'],
  },
  {
    id: '03',
    name: 'Editor Colaborativo',
    tagline: 'Escribe junto a tu equipo.',
    description:
      'Documentos enriquecidos donde múltiples personas editan al mismo tiempo. Cursores nombrados, historial completo, sin versiones duplicadas.',
    indicators: ['Cursores en vivo', 'Markdown + rich text', 'Historial de 0 a ahora'],
  },
  {
    id: '04',
    name: 'Presencia Global',
    tagline: 'Nadie trabaja en la oscuridad.',
    description:
      'Ve quién está conectado, qué board está mirando y cuándo está escribiendo. La comunicación implícita que los equipos necesitan.',
    indicators: ['Online / Away status', 'Typing indicators', 'Activity feed por workspace'],
  },
];

export function ShowcaseSection() {
  const [activeModule, setActiveModule] = useState(0);

  return (
    <section className="relative py-12 md:py-28 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-background to-surface/20">
      <div className="max-w-6xl mx-auto">
        {/* MOBILE Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-6 md:hidden"
        >
          <p className="text-accent text-xs font-bold mb-2 uppercase tracking-wider">Módulos</p>
          <h2 className="text-2xl font-bold text-text-primary leading-tight">
            Todo lo que necesitas
          </h2>
        </motion.div>

        {/* DESKTOP Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-20 hidden md:block"
        >
          <p className="font-mono text-xs text-accent tracking-[0.3em] uppercase mb-4">
            // módulos
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-text-primary leading-tight max-w-lg">
            Todo lo que tu equipo necesita. Nada más.
          </h2>
        </motion.div>

        {/* MOBILE: Card carousel/swiper */}
        <div className="md:hidden">
          {/* Current module card */}
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.3 }}
            className="bg-surface/50 backdrop-blur-sm border border-border rounded-lg p-5 mb-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl font-bold text-accent/20 font-mono">
                {modules[activeModule].id}
              </div>
              <div className="text-xs text-text-muted font-mono">
                {activeModule + 1} / {modules.length}
              </div>
            </div>

            <h3 className="text-xl font-bold text-text-primary mb-1">
              {modules[activeModule].name}
            </h3>
            <p className="text-xs text-accent/70 italic mb-3">{modules[activeModule].tagline}</p>
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              {modules[activeModule].description}
            </p>

            {/* Indicators as pills */}
            <div className="flex flex-wrap gap-2">
              {modules[activeModule].indicators.map((ind) => (
                <span
                  key={ind}
                  className="inline-flex items-center gap-1 px-2.5 py-1 bg-accent/10 border border-accent/30 rounded-full text-[10px] text-accent font-medium"
                >
                  <span>→</span>
                  {ind}
                </span>
              ))}
            </div>
          </motion.div>

          {/* Navigation dots */}
          <div className="flex items-center justify-center gap-2 mb-4">
            {modules.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveModule(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeModule ? 'w-6 bg-accent' : 'w-1.5 bg-border'
                }`}
                aria-label={`Ver módulo ${i + 1}`}
              />
            ))}
          </div>

          {/* Swipe buttons */}
          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveModule((prev) => (prev > 0 ? prev - 1 : modules.length - 1))}
              className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:border-accent/50 hover:text-accent transition-all active:scale-95"
            >
              ← Anterior
            </button>
            <button
              onClick={() => setActiveModule((prev) => (prev < modules.length - 1 ? prev + 1 : 0))}
              className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent hover:bg-accent/20 transition-all active:scale-95"
            >
              Siguiente →
            </button>
          </div>
        </div>

        {/* DESKTOP: List view */}
        <div className="space-y-2 hidden md:block">
          {modules.map((mod, i) => (
            <motion.div
              key={mod.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group border border-border hover:border-accent/40 rounded bg-background hover:bg-surface/40 transition-all duration-300 overflow-hidden"
            >
              <div className="flex items-start gap-6 p-8">
                {/* ID */}
                <div className="shrink-0">
                  <span className="font-mono text-4xl font-bold text-border group-hover:text-accent/30 transition-colors duration-300 select-none">
                    {mod.id}
                  </span>
                </div>

                {/* Main content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-4 mb-3">
                    <h3 className="text-xl font-bold text-text-primary group-hover:text-accent transition-colors duration-200">
                      {mod.name}
                    </h3>
                    <p className="font-mono text-xs text-text-muted italic">{mod.tagline}</p>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-5">
                    {mod.description}
                  </p>

                  {/* Indicators */}
                  <div className="flex flex-wrap gap-2">
                    {mod.indicators.map((ind) => (
                      <span
                        key={ind}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] text-text-muted border border-border rounded px-2.5 py-1 group-hover:border-accent/20 group-hover:text-accent/70 transition-all duration-300"
                      >
                        <span className="text-accent/50">→</span>
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Right arrow (decorative) */}
                <div className="flex items-center self-center shrink-0 text-border group-hover:text-accent/40 transition-colors duration-300">
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Bottom separator / stat row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-px bg-border border border-border rounded overflow-hidden"
        >
          {[
            { value: 'Real-time', label: 'sync engine' },
            { value: 'CRDT', label: 'conflict resolution' },
            { value: 'E2E', label: 'type safety' },
            { value: 'JWT', label: 'auth & sessions' },
          ].map((s) => (
            <div
              key={s.label}
              className="bg-background px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-5 text-center"
            >
              <p className="font-mono text-sm sm:text-base font-bold text-accent mb-0.5 sm:mb-1">
                {s.value}
              </p>
              <p className="font-mono text-[9px] sm:text-[10px] md:text-[11px] text-text-muted tracking-wide uppercase">
                {s.label}
              </p>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
