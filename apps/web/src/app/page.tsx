import { LandingWrapper } from '@/components/landing/LandingWrapper';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Home() {
  return (
    <LandingWrapper>
      <div
        className="aether-landing"
        style={{
          position: 'relative',
          minHeight: '100vh',
          background: 'var(--c-bg)',
          color: 'var(--c-text)',
          fontFamily: "'Manrope', system-ui, sans-serif",
          WebkitFontSmoothing: 'antialiased',
          overflowX: 'hidden',
        }}
      >
        {/* Subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none',
          backgroundImage: 'linear-gradient(rgba(97,71,130,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(97,71,130,0.025) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          maskImage: 'radial-gradient(circle at 50% 20%, #000, transparent 78%)',
          WebkitMaskImage: 'radial-gradient(circle at 50% 20%, #000, transparent 78%)',
        }} />

        <LandingNav />
        <LandingHero />
        <LandingFeatures />
        <LandingCTA />
        <LandingFooter />
      </div>
    </LandingWrapper>
  );
}
