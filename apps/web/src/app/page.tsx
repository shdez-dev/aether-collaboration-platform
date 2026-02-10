import { HeroSection } from '@/components/home/HeroSection';
import { FeaturesSection } from '@/components/home/FeaturesSection';
import { ShowcaseSection } from '@/components/home/ShowcaseSection';
import { TechStackSection } from '@/components/home/TechStackSection';
import { Footer } from '@/components/home/Footer';

export default function Home() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <FeaturesSection />
      <ShowcaseSection />
      <TechStackSection />
      <Footer />
    </div>
  );
}
