'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LandingWrapper({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ── Reveals de entrada — se configuran de inmediato para evitar parpadeo ──
    let ctx: gsap.Context | undefined;
    if (!reduceMotion) {
      ctx = gsap.context(() => {
        // Hero: entrada en cascada (copy → mock)
        const hero = document.querySelector('.aether-landing > header');
        if (hero) {
          gsap.from(hero.children, {
            y: 34,
            opacity: 0,
            duration: 1,
            ease: 'power3.out',
            stagger: 0.14,
            delay: 0.08,
          });
        }

        // Cada sección (features, CTA, cierre) se revela al entrar en viewport
        const sections = document.querySelectorAll(
          '.aether-landing > section, .aether-landing > footer'
        );
        sections.forEach((el) => {
          gsap.from(el, {
            y: 48,
            opacity: 0,
            duration: 1.05,
            ease: 'power3.out',
            scrollTrigger: {
              trigger: el,
              start: 'top 84%',
              once: true,
            },
          });
        });
      });
    }

    // ── Scroll suave (Lenis) ──
    (async () => {
      const { default: Lenis } = await import('lenis');
      const lenis = new Lenis({
        duration: 1.15,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenisRef.current = lenis;

      const ticker = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);

      // Mantener ScrollTrigger sincronizado con el scroll suave de Lenis
      lenis.on('scroll', ScrollTrigger.update);
      (lenisRef.current as Record<string, unknown>).__ticker = ticker;

      ScrollTrigger.refresh();
    })();

    return () => {
      if (ctx) ctx.revert();
      if (lenisRef.current) {
        const l = lenisRef.current as { destroy?: () => void; __ticker?: (t: number) => void };
        if (l.__ticker) gsap.ticker.remove(l.__ticker);
        if (l.destroy) l.destroy();
      }
      ScrollTrigger.getAll().forEach((st) => st.kill());
    };
  }, []);

  return <>{children}</>;
}
