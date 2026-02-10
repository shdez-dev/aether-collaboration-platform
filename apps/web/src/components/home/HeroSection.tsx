'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { useIsAuthenticated } from '@/stores/authStore';

export function HeroSection() {
  const isAuthenticated = useIsAuthenticated();

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background grid */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-background to-surface opacity-50">
        <div
          className="absolute inset-0"
          style={{
            backgroundImage: `
            linear-gradient(to right, rgba(124, 58, 237, 0.1) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(124, 58, 237, 0.1) 1px, transparent 1px)
          `,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(20)].map((_, i) => {
          const randomX = Math.random() * 100;
          const randomY = Math.random() * 100;
          const randomOpacity = Math.random() * 0.5 + 0.2;
          const randomDuration = Math.random() * 3 + 2;
          const randomDelay = Math.random() * 2;

          return (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-accent rounded-full"
              style={{
                left: `${randomX}%`,
                top: `${randomY}%`,
              }}
              initial={{
                opacity: randomOpacity,
              }}
              animate={{
                y: [-20, -220],
                opacity: [randomOpacity, 0],
              }}
              transition={{
                duration: randomDuration,
                repeat: Infinity,
                delay: randomDelay,
              }}
            />
          );
        })}
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-block mb-8"
          >
            <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-accent/30 bg-accent/5 text-accent text-sm font-mono">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-accent"></span>
              </span>
              Sistema Operacional
            </span>
          </motion.div>

          {/* Main title with gradient */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-6xl sm:text-7xl lg:text-8xl font-bold mb-6"
          >
            <span className="bg-gradient-to-r from-accent via-purple-400 to-accent bg-clip-text text-transparent animate-gradient bg-300%">
              AETHER
            </span>
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl sm:text-2xl text-text-secondary mb-4 font-light"
          >
            Plataforma de Colaboración en Tiempo Real
          </motion.p>

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-text-muted text-sm sm:text-base mb-12 max-w-2xl mx-auto font-mono"
          >
            Adaptive Event-driven Trusted Human-Environment for Real-time collaboration
          </motion.p>
        </div>
      </div>
    </section>
  );
}
