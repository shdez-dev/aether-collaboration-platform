'use client';

import { motion } from 'framer-motion';

const showcaseItems = [
  {
    title: 'Workspaces',
    description: 'Organiza proyectos con espacios de trabajo colaborativos',
    features: ['Múltiples boards', 'Gestión de equipo', 'Permisos granulares'],
  },
  {
    title: 'Boards Kanban',
    description: 'Tableros estilo Trello con drag & drop en tiempo real',
    features: ['Listas y tarjetas', 'Drag & drop', 'Sincronización live'],
  },
  {
    title: 'Editor Colaborativo',
    description: 'Documentos enriquecidos con edición simultánea',
    features: ['Cursores en vivo', 'Markdown', 'Historial completo'],
  },
  {
    title: 'Sistema de Presencia',
    description: 'Ve quién está online y en qué está trabajando',
    features: ['Indicadores en vivo', 'Typing indicators', 'Activity feed'],
  },
];

export function ShowcaseSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 bg-gradient-to-b from-background to-surface">
      <div className="max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-text-primary">
            Funcionalidades Principales
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Una plataforma completa para colaboración en equipo
          </p>
        </motion.div>

        {/* Showcase grid */}
        <div className="grid md:grid-cols-2 gap-8">
          {showcaseItems.map((item, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
              className="group"
            >
              <div className="relative h-full p-8 bg-card border border-border rounded-lg hover:border-accent/50 transition-all duration-300 overflow-hidden">
                {/* Animated background gradient */}
                <div className="absolute inset-0 bg-gradient-to-br from-accent/0 via-accent/5 to-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  {/* Number badge */}
                  <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-accent/10 text-accent font-bold text-xl mb-4 group-hover:scale-110 transition-transform">
                    {index + 1}
                  </div>

                  <h3 className="text-2xl font-bold text-text-primary mb-3 group-hover:text-accent transition-colors">
                    {item.title}
                  </h3>

                  <p className="text-text-secondary mb-6">{item.description}</p>

                  {/* Features list */}
                  <ul className="space-y-2">
                    {item.features.map((feature, i) => (
                      <motion.li
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.3, delay: index * 0.1 + i * 0.1 }}
                        className="flex items-center gap-2 text-text-muted text-sm"
                      >
                        <div className="w-1.5 h-1.5 rounded-full bg-accent" />
                        {feature}
                      </motion.li>
                    ))}
                  </ul>
                </div>

                {/* Decorative corner accent */}
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-accent/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-bl-full" />
              </div>
            </motion.div>
          ))}
        </div>

        {/* Call to action */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-8 bg-gradient-to-r from-accent/10 via-purple-500/10 to-accent/10 border border-accent/30 rounded-lg">
            <h3 className="text-2xl font-bold text-text-primary mb-3">Proyecto de Portafolio</h3>
            <p className="text-text-secondary mb-6 max-w-xl">
              AETHER es un proyecto personal que demuestra conocimientos avanzados en arquitectura
              distribuida, programación en tiempo real, y desarrollo full-stack moderno.
            </p>
            <div className="flex flex-wrap justify-center gap-2 text-xs font-mono">
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-full">
                Event Sourcing
              </span>
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-full">CQRS</span>
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-full">CRDT</span>
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-full">WebSockets</span>
              <span className="px-3 py-1 bg-accent/20 text-accent rounded-full">Microservices</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
