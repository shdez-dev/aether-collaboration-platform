'use client';

import { motion } from 'framer-motion';
import { Zap, RefreshCw, Target, Shield, FileText, Database } from 'lucide-react';

const features = [
  {
    icon: Zap,
    title: 'Event Sourcing',
    description:
      'Arquitectura basada en eventos que captura cada cambio como un evento inmutable, permitiendo auditoría completa y time travel.',
    color: 'from-yellow-500 to-orange-500',
  },
  {
    icon: RefreshCw,
    title: 'Sincronización en Tiempo Real',
    description:
      'Sincronización instantánea entre usuarios con WebSockets para una experiencia colaborativa fluida.',
    color: 'from-blue-500 to-cyan-500',
  },
  {
    icon: Database,
    title: 'Event Store',
    description:
      'Sistema de almacenamiento persistente de eventos con PostgreSQL y Redis para caché distribuido.',
    color: 'from-green-500 to-emerald-500',
  },
  {
    icon: Target,
    title: 'CRDT & Vector Clocks',
    description:
      'Resolución determinística de conflictos usando Conflict-free Replicated Data Types y relojes vectoriales.',
    color: 'from-purple-500 to-pink-500',
  },
  {
    icon: Shield,
    title: 'Type-Safe',
    description:
      'TypeScript end-to-end con validación en tiempo de compilación. Tipos compartidos entre frontend y backend.',
    color: 'from-indigo-500 to-blue-500',
  },
  {
    icon: FileText,
    title: 'Documentos Colaborativos',
    description:
      'Editor de texto enriquecido con Yjs y Tiptap. Edición simultánea con cursores en tiempo real.',
    color: 'from-red-500 to-rose-500',
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.5,
    },
  },
};

export function FeaturesSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface to-background opacity-50" />

      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl sm:text-5xl font-bold mb-4 text-text-primary">
            Características Técnicas
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Tecnología de vanguardia para colaboración distribuida y confiable
          </p>
        </motion.div>

        {/* Features grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-100px' }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={itemVariants}
              whileHover={{ scale: 1.05, y: -5 }}
              className="group relative"
            >
              {/* Card */}
              <div className="h-full bg-card border border-border rounded-lg p-6 hover:border-accent/50 transition-all duration-300 hover:shadow-lg hover:shadow-accent/10">
                {/* Icon with gradient background */}
                <div
                  className={`inline-flex items-center justify-center w-16 h-16 rounded-lg bg-gradient-to-br ${feature.color} mb-4 transform group-hover:rotate-12 transition-transform duration-300`}
                >
                  <feature.icon className="w-8 h-8 text-white" />
                </div>

                {/* Content */}
                <h3 className="text-xl font-bold text-text-primary mb-2 group-hover:text-accent transition-colors">
                  {feature.title}
                </h3>
                <p className="text-text-secondary text-sm leading-relaxed">{feature.description}</p>

                {/* Hover effect overlay */}
                <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-accent/0 to-accent/0 group-hover:from-accent/5 group-hover:to-transparent transition-all duration-300 pointer-events-none" />
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Architecture highlight */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 p-8 bg-gradient-to-r from-accent/10 via-purple-500/10 to-accent/10 border border-accent/20 rounded-lg"
        >
          <div className="text-center">
            <h3 className="text-2xl font-bold text-text-primary mb-4">Arquitectura Event-Driven</h3>
            <p className="text-text-secondary max-w-3xl mx-auto mb-6">
              AETHER implementa un sistema completo de Event Sourcing donde cada acción del usuario
              genera eventos inmutables que se propagan en tiempo real a través de WebSockets,
              garantizando consistencia y permitiendo reconstruir el estado completo del sistema en
              cualquier punto del tiempo.
            </p>
            <div className="flex flex-wrap justify-center gap-3 text-sm font-mono">
              <span className="px-4 py-2 bg-accent/20 text-accent rounded-full">PostgreSQL</span>
              <span className="px-4 py-2 bg-accent/20 text-accent rounded-full">Redis</span>
              <span className="px-4 py-2 bg-accent/20 text-accent rounded-full">Socket.IO</span>
              <span className="px-4 py-2 bg-accent/20 text-accent rounded-full">Yjs CRDT</span>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
