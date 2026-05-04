'use client';

import { motion } from 'framer-motion';
import { useT } from '@/lib/i18n';

// Feature icons as inline SVG paths
const ICONS = [
  // Kanban / grid
  <svg key="1" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="3" width="12" height="10" rx="1"/>
    <path d="M2 7h12M6 3v10"/>
  </svg>,
  // Document
  <svg key="2" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 2h7l3 3v9H3V2z"/>
    <path d="M10 2v3h3M5 8h6M5 11h4"/>
  </svg>,
  // Feed / lines
  <svg key="3" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M3 5h10M3 8h10M3 11h6"/>
  </svg>,
  // Keyboard / checkmark
  <svg key="4" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <rect x="2" y="4" width="12" height="8" rx="1"/>
    <path d="M5 8l2 2 4-4"/>
  </svg>,
  // API / code
  <svg key="5" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <path d="M5 3L2 8l3 5M11 3l3 5-3 5M9 2l-2 12"/>
  </svg>,
  // Clock / audit
  <svg key="6" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
    <circle cx="8" cy="8" r="6"/>
    <path d="M8 4v4l3 2"/>
  </svg>,
];

export function FeaturesSection() {
  const t = useT();

  const features = [
    { num: '01', title: t.home_feat1_title, body: t.home_feat1_body, icon: ICONS[0] },
    { num: '02', title: t.home_feat2_title, body: t.home_feat2_body, icon: ICONS[1] },
    { num: '03', title: t.home_feat3_title, body: t.home_feat3_body, icon: ICONS[2] },
    { num: '04', title: t.home_feat4_title, body: t.home_feat4_body, icon: ICONS[3] },
    { num: '05', title: t.home_feat5_title, body: t.home_feat5_body, icon: ICONS[4] },
    { num: '06', title: t.home_feat6_title, body: t.home_feat6_body, icon: ICONS[5] },
  ];

  return (
    <section className="relative py-28 px-4 md:px-8" id="features">
      <div className="max-w-[1240px] mx-auto">
        {/* Section header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-16"
        >
          <div
            className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.1em] mb-4"
            style={{ color: '#3b82f6' }}
          >
            <span className="w-5 h-px" style={{ background: '#3b82f6', opacity: 0.6 }} />
            {t.home_features_label}
          </div>
          <h2
            className="font-bold leading-[1.08] mb-5 max-w-[780px]"
            style={{ fontSize: 'clamp(30px, 4vw, 46px)', letterSpacing: '-0.025em', color: 'rgba(255,255,255,0.95)' }}
          >
            {t.home_features_heading}
          </h2>
          <p className="text-[17px] max-w-[620px]" style={{ color: 'rgba(255,255,255,0.48)' }}>
            {t.home_features_sub}
          </p>
        </motion.div>

        {/* Feature grid — 3×2, separated by 1px border lines */}
        <div
          className="grid grid-cols-1 md:grid-cols-3 rounded-xl overflow-hidden"
          style={{
            gap: '1px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          {features.map((f, i) => (
            <motion.div
              key={f.num}
              initial={{ opacity: 0, y: 14 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.06 }}
              className="group relative flex flex-col gap-3 p-8 cursor-default"
              style={{
                background: 'hsl(var(--background))',
                minHeight: '220px',
                transition: 'background 0.2s',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'hsl(var(--muted))';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = 'hsl(var(--background))';
              }}
            >
              <span className="font-mono text-[11px] tracking-[0.05em]" style={{ color: 'rgba(255,255,255,0.28)' }}>
                {f.num}
              </span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center mb-3"
                style={{
                  background: 'rgba(59,130,246,0.08)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  color: '#3b82f6',
                }}
              >
                <div className="w-4 h-4">{f.icon}</div>
              </div>
              <h4
                className="text-[17px] font-semibold"
                style={{ letterSpacing: '-0.01em', color: 'rgba(255,255,255,0.9)' }}
              >
                {f.title}
              </h4>
              <p className="text-[14px] leading-[1.55]" style={{ color: 'rgba(255,255,255,0.48)' }}>
                {f.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
