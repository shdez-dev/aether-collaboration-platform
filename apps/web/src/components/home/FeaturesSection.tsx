'use client';

import { motion } from 'framer-motion';

const features = [
  {
    tag: 'sync',
    title: 'Zero-conflict sync',
    body: 'Cada keystroke de tu equipo llega en milisegundos. CRDT garantiza que nunca dos ediciones colisionen — sin spinners, sin "recargar para ver cambios".',
    stat: '< 10ms',
    statLabel: 'latencia promedio',
  },
  {
    tag: 'presence',
    title: 'Presencia real',
    body: 'Ve exactamente quién está editando qué, con cursores nombrados en tiempo real. Sin estados fantasma, sin confusión sobre quién cambió algo.',
    stat: '∞',
    statLabel: 'usuarios simultáneos',
  },
  {
    tag: 'history',
    title: 'Historial completo',
    body: 'Cada acción es un evento inmutable. Rebobina cualquier board o documento a cualquier punto en el tiempo. Nada se pierde.',
    stat: '100%',
    statLabel: 'eventos auditables',
  },
  {
    tag: 'offline',
    title: 'Resilencia offline',
    body: 'Trabaja sin conexión. Cuando vuelves, tus cambios se fusionan automáticamente con el estado del equipo. Sin sorpresas.',
    stat: '0',
    statLabel: 'conflictos al reconectar',
  },
  {
    tag: 'boards',
    title: 'Boards Kanban en vivo',
    body: 'Arrastra tarjetas mientras tu equipo te ve. Los cambios se propagan al instante a todos los participantes del workspace.',
    stat: 'DnD',
    statLabel: 'sincronizado en vivo',
  },
  {
    tag: 'perms',
    title: 'Permisos granulares',
    body: 'Controla quién puede ver, editar o administrar cada workspace y board. Roles claros, sin configuración compleja.',
    stat: 'RBAC',
    statLabel: 'por workspace',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export function FeaturesSection() {
  return (
    <section className="relative py-12 md:py-28 px-4 md:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/30 to-background pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* MOBILE Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:hidden"
        >
          <p className="text-accent text-xs font-bold mb-2 uppercase tracking-wider">Capacidades</p>
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
            // capacidades
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-text-primary leading-tight max-w-xl">
            Construido para equipos que no esperan.
          </h2>
        </motion.div>

        {/* MOBILE: Vertical stacked cards */}
        <div className="space-y-4 md:hidden">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-surface/50 backdrop-blur-sm border border-border rounded-lg p-4"
            >
              {/* Compact header */}
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1">
                  <h3 className="text-base font-bold text-text-primary mb-1">{f.title}</h3>
                  <p className="text-[10px] text-accent font-mono uppercase tracking-wider">
                    {f.tag}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-accent font-mono">{f.stat}</div>
                  <div className="text-[9px] text-text-muted font-mono">{f.statLabel}</div>
                </div>
              </div>

              {/* Body */}
              <p className="text-text-secondary text-xs leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>

        {/* DESKTOP: Grid layout */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="hidden md:grid md:grid-cols-2 lg:grid-cols-3 gap-px bg-border"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group relative bg-background hover:bg-surface/60 transition-colors duration-300 p-8"
            >
              {/* Tag */}
              <p className="font-mono text-[10px] text-text-muted tracking-[0.25em] uppercase mb-5">
                [{f.tag}]
              </p>

              {/* Stat */}
              <div className="mb-5">
                <span className="font-mono text-3xl font-bold text-accent">{f.stat}</span>
                <span className="font-mono text-xs text-text-muted ml-2">{f.statLabel}</span>
              </div>

              {/* Title */}
              <h3 className="text-lg font-bold text-text-primary mb-3 group-hover:text-accent transition-colors duration-200">
                {f.title}
              </h3>

              {/* Body */}
              <p className="text-text-muted text-sm leading-relaxed">{f.body}</p>

              {/* Bottom accent line on hover */}
              <div className="absolute bottom-0 left-0 h-px w-0 bg-accent group-hover:w-full transition-all duration-500" />
            </motion.div>
          ))}
        </motion.div>

        {/* Bottom callout */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 sm:mt-16 flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 p-4 sm:p-6 border border-border rounded bg-surface/30"
        >
          <div className="shrink-0">
            <p className="font-mono text-[9px] sm:text-[10px] text-text-muted tracking-[0.2em] sm:tracking-[0.25em] uppercase mb-1">
              arquitectura
            </p>
            <p className="font-mono text-xs sm:text-sm text-accent font-bold">Event-Driven</p>
          </div>
          <div className="w-px h-10 bg-border hidden sm:block shrink-0" />
          <p className="text-text-secondary text-xs sm:text-sm leading-relaxed">
            Cada acción genera un evento inmutable que se propaga por WebSockets, se persiste en
            PostgreSQL y se cachea en Redis. Tu estado siempre es reconstruible desde cero.
          </p>
          <div className="flex flex-wrap gap-2 shrink-0">
            {['Event Sourcing', 'CQRS', 'CRDT', 'WebSockets'].map((t) => (
              <span
                key={t}
                className="px-2 sm:px-2.5 py-0.5 sm:py-1 font-mono text-[10px] sm:text-[11px] text-accent bg-accent/8 border border-accent/20 rounded whitespace-nowrap"
              >
                {t}
              </span>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
