'use client';

import { motion } from 'framer-motion';

const techStack = {
  frontend: [
    { name: 'Next.js 14', description: 'React framework', color: 'bg-black' },
    { name: 'TypeScript', description: 'Type safety', color: 'bg-blue-600' },
    { name: 'Tailwind CSS', description: 'Styling', color: 'bg-cyan-500' },
    { name: 'Zustand', description: 'State management', color: 'bg-amber-600' },
    { name: 'Tiptap', description: 'Rich text editor', color: 'bg-purple-600' },
    { name: 'Yjs', description: 'CRDT library', color: 'bg-green-600' },
  ],
  backend: [
    { name: 'Node.js', description: 'Runtime', color: 'bg-green-700' },
    { name: 'Express', description: 'HTTP server', color: 'bg-gray-700' },
    { name: 'Socket.IO', description: 'Real-time', color: 'bg-black' },
    { name: 'PostgreSQL', description: 'Database', color: 'bg-blue-800' },
    { name: 'Redis', description: 'Cache & PubSub', color: 'bg-red-600' },
    { name: 'JWT', description: 'Authentication', color: 'bg-pink-600' },
  ],
};

export function TechStackSection() {
  return (
    <section className="relative py-24 px-4 sm:px-6 lg:px-8">
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
            Stack Tecnológico
          </h2>
          <p className="text-text-secondary text-lg max-w-2xl mx-auto">
            Tecnologías modernas y robustas para una experiencia de desarrollo excepcional
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12">
          {/* Frontend */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-accent mb-2">Frontend</h3>
              <div className="h-1 w-20 bg-gradient-to-r from-accent to-transparent rounded-full" />
            </div>
            <div className="space-y-4">
              {techStack.frontend.map((tech, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ x: 10 }}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-accent/50 transition-all cursor-pointer group"
                >
                  <div
                    className={`w-3 h-3 rounded-full ${tech.color} group-hover:scale-125 transition-transform`}
                  />
                  <div className="flex-1">
                    <h4 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {tech.name}
                    </h4>
                    <p className="text-text-muted text-sm">{tech.description}</p>
                  </div>
                  <svg
                    className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Backend */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <div className="mb-6">
              <h3 className="text-2xl font-bold text-accent mb-2">Backend</h3>
              <div className="h-1 w-20 bg-gradient-to-r from-accent to-transparent rounded-full" />
            </div>
            <div className="space-y-4">
              {techStack.backend.map((tech, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: 20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: index * 0.1 }}
                  whileHover={{ x: -10 }}
                  className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-accent/50 transition-all cursor-pointer group"
                >
                  <svg
                    className="w-5 h-5 text-text-muted group-hover:text-accent transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 19l-7-7 7-7"
                    />
                  </svg>
                  <div className="flex-1">
                    <h4 className="font-semibold text-text-primary group-hover:text-accent transition-colors">
                      {tech.name}
                    </h4>
                    <p className="text-text-muted text-sm">{tech.description}</p>
                  </div>
                  <div
                    className={`w-3 h-3 rounded-full ${tech.color} group-hover:scale-125 transition-transform`}
                  />
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Additional info */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="mt-16 text-center"
        >
          <div className="inline-block p-6 bg-card border border-accent/30 rounded-lg">
            <p className="text-text-secondary mb-2">
              <span className="text-accent font-bold">Monorepo</span> con{' '}
              <span className="text-accent font-bold">pnpm workspaces</span> y{' '}
              <span className="text-accent font-bold">Turborepo</span>
            </p>
            <p className="text-text-muted text-sm font-mono">
              Desarrollo escalable y eficiente con código compartido
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
