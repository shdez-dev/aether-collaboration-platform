'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export function LandingWrapper({ children }: { children: React.ReactNode }) {
  const lenisRef = useRef<unknown>(null);

  useEffect(() => {
    (async () => {
      const { default: Lenis } = await import('lenis');
      const lenis = new Lenis({
        duration: 1.2,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
        smoothWheel: true,
      });
      lenisRef.current = lenis;
      const ticker = (time: number) => lenis.raf(time * 1000);
      gsap.ticker.add(ticker);
      gsap.ticker.lagSmoothing(0);
      ScrollTrigger.refresh();
      (lenisRef.current as Record<string, unknown>).__ticker = ticker;
    })();

    return () => {
      if (lenisRef.current) {
        const l = lenisRef.current as { destroy?: () => void; __ticker?: (t: number) => void };
        if (l.__ticker) gsap.ticker.remove(l.__ticker);
        if (l.destroy) l.destroy();
      }
    };
  }, []);

  return <>{children}</>;
}
