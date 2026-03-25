'use client';

import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45 } },
};

export function FeaturesSection() {
  const t = useT();

  const features = [
    { title: t.home_feat1_title, body: t.home_feat1_body },
    { title: t.home_feat2_title, body: t.home_feat2_body },
    { title: t.home_feat3_title, body: t.home_feat3_body },
    { title: t.home_feat4_title, body: t.home_feat4_body },
  ];

  return (
    <section className="relative py-16 md:py-32 px-4 md:px-6 lg:px-8 overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-background via-surface/20 to-background pointer-events-none" />

      <div className="relative z-10 max-w-5xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 md:mb-20"
        >
          <h2 className="text-2xl md:text-5xl font-bold text-text-primary leading-tight">
            {t.home_features_heading}
          </h2>
        </motion.div>

        {/* MOBILE: stacked cards */}
        <div className="space-y-4 md:hidden">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-50px' }}
              transition={{ duration: 0.4, delay: i * 0.05 }}
              className="bg-surface/50 border border-border rounded-lg p-5"
            >
              <h3 className="text-base font-bold text-text-primary mb-2">{f.title}</h3>
              <p className="text-text-secondary text-sm leading-relaxed">{f.body}</p>
            </motion.div>
          ))}
        </div>

        {/* DESKTOP: 2x2 grid */}
        <motion.div
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: '-80px' }}
          className="hidden md:grid md:grid-cols-2 gap-px bg-border border border-border rounded overflow-hidden"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              variants={itemVariants}
              className="group relative bg-background hover:bg-surface/40 transition-colors duration-300 p-10"
            >
              <h3 className="text-xl font-bold text-text-primary mb-4 group-hover:text-accent transition-colors duration-200">
                {f.title}
              </h3>
              <p className="text-text-secondary text-base leading-relaxed">{f.body}</p>
              <div className="absolute bottom-0 left-0 h-px w-0 bg-accent group-hover:w-full transition-all duration-500" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
