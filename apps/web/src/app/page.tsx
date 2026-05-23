import { LandingWrapper } from '@/components/landing/LandingWrapper';
import { LandingNav } from '@/components/landing/LandingNav';
import { LandingHero } from '@/components/landing/LandingHero';
import { LandingFeatures } from '@/components/landing/LandingFeatures';
import { LandingArchitecture } from '@/components/landing/LandingArchitecture';
import { LandingCTA } from '@/components/landing/LandingCTA';
import { LandingFooter } from '@/components/landing/LandingFooter';

export default function Home() {
  return (
    <LandingWrapper>
      <div style={{ background: '#080c14', minHeight: '100vh' }}>
        <LandingNav />
        <LandingHero />
        <LandingFeatures />
        <LandingArchitecture />
        <LandingCTA />
        <LandingFooter />
      </div>
    </LandingWrapper>
  );
}
