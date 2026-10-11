import './legal.css';

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return <div className="aether-legal" lang="es">{children}</div>;
}
