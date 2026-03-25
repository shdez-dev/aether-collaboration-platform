'use client';

import { motion } from 'framer-motion';
import { useState } from 'react';
import { useT } from '@/lib/i18n';

export function ShowcaseSection() {
  const [activeModule, setActiveModule] = useState(0);
  const t = useT();

  const modules = [
    {
      id: '01',
      name: t.home_mod1_name,
      tagline: t.home_mod1_tagline,
      description: t.home_mod1_desc,
      indicators: [t.home_mod1_i1, t.home_mod1_i2, t.home_mod1_i3],
    },
    {
      id: '02',
      name: t.home_mod2_name,
      tagline: t.home_mod2_tagline,
      description: t.home_mod2_desc,
      indicators: [t.home_mod2_i1, t.home_mod2_i2, t.home_mod2_i3],
    },
    {
      id: '03',
      name: t.home_mod3_name,
      tagline: t.home_mod3_tagline,
      description: t.home_mod3_desc,
      indicators: [t.home_mod3_i1, t.home_mod3_i2, t.home_mod3_i3],
    },
    {
      id: '04',
      name: t.home_mod4_name,
      tagline: t.home_mod4_tagline,
      description: t.home_mod4_desc,
      indicators: [t.home_mod4_i1, t.home_mod4_i2, t.home_mod4_i3],
    },
  ];

  return (
    <section className="relative py-12 md:py-28 px-4 md:px-6 lg:px-8 bg-gradient-to-b from-background to-surface/20">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-8 md:mb-20"
        >
          <h2 className="text-2xl md:text-5xl font-bold text-text-primary leading-tight">
            {t.home_showcase_heading}
          </h2>
        </motion.div>

        {/* MOBILE: Card carousel */}
        <div className="md:hidden">
          <motion.div
            key={activeModule}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
            className="bg-surface/50 border border-border rounded-lg p-5 mb-4"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="text-4xl font-bold text-accent/20 font-mono">
                {modules[activeModule].id}
              </div>
              <div className="text-xs text-text-muted">
                {activeModule + 1} / {modules.length}
              </div>
            </div>

            <h3 className="text-xl font-bold text-text-primary mb-1">
              {modules[activeModule].name}
            </h3>
            <p className="text-xs text-accent italic mb-3">{modules[activeModule].tagline}</p>
            <p className="text-text-secondary text-sm leading-relaxed mb-4">
              {modules[activeModule].description}
            </p>

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

          <div className="flex items-center justify-center gap-2 mb-4">
            {modules.map((_, i) => (
              <button
                key={i}
                onClick={() => setActiveModule(i)}
                className={`h-1.5 rounded-full transition-all ${
                  i === activeModule ? 'w-6 bg-accent' : 'w-1.5 bg-border'
                }`}
                aria-label={`Module ${i + 1}`}
              />
            ))}
          </div>

          <div className="flex items-center justify-center gap-3 mb-8">
            <button
              onClick={() => setActiveModule((prev) => (prev > 0 ? prev - 1 : modules.length - 1))}
              className="px-4 py-2 border border-border rounded-lg text-sm text-text-secondary hover:border-accent/50 hover:text-accent transition-all active:scale-95"
            >
              {t.home_showcase_prev}
            </button>
            <button
              onClick={() => setActiveModule((prev) => (prev < modules.length - 1 ? prev + 1 : 0))}
              className="px-4 py-2 bg-accent/10 border border-accent/30 rounded-lg text-sm text-accent hover:bg-accent/20 transition-all active:scale-95"
            >
              {t.home_showcase_next}
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
              className="group border border-border hover:border-accent/40 rounded bg-background hover:bg-surface/40 transition-all duration-300"
            >
              <div className="flex items-start gap-6 p-8">
                <div className="shrink-0">
                  <span className="font-mono text-4xl font-bold text-border group-hover:text-accent/30 transition-colors duration-300 select-none">
                    {mod.id}
                  </span>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-4 mb-3">
                    <h3 className="text-xl font-bold text-text-primary group-hover:text-accent transition-colors duration-200">
                      {mod.name}
                    </h3>
                    <p className="text-sm text-text-secondary italic">{mod.tagline}</p>
                  </div>
                  <p className="text-text-secondary text-sm leading-relaxed mb-5">
                    {mod.description}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    {mod.indicators.map((ind) => (
                      <span
                        key={ind}
                        className="inline-flex items-center gap-1.5 text-[11px] text-text-muted border border-border rounded px-2.5 py-1 group-hover:border-accent/20 group-hover:text-accent/70 transition-all duration-300"
                      >
                        <span className="text-accent/50">→</span>
                        {ind}
                      </span>
                    ))}
                  </div>
                </div>

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
      </div>
    </section>
  );
}
