import Link from 'next/link';
import { BrandMark } from '@/components/brand/BrandMark';

export function LandingFooter() {
  return (
    <footer className="home-footer">
      <Link href="/" className="home-footer-brand" aria-label="AETHER, inicio"><BrandMark size={38} tone="light" /></Link>
      <span>Un lugar para hacer que las ideas avancen.</span>
      <div>
        <Link href="/legal/terms">Términos</Link>
        <Link href="/legal/privacy">Privacidad</Link>
        <Link href="/legal/aup">Uso aceptable</Link>
      </div>
      <small>© {new Date().getFullYear()} AETHER</small>
    </footer>
  );
}
