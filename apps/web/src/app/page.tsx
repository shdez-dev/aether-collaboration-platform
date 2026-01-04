import Link from 'next/link';

export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        {/* ASCII Art / Logo */}
        <div className="mb-12 text-center">
          <pre className="text-accent text-sm leading-tight font-bold inline-block">
            {`  █████╗ ███████╗████████╗██╗  ██╗███████╗██████╗ 
 ██╔══██╗██╔════╝╚══██╔══╝██║  ██║██╔════╝██╔══██╗
 ███████║█████╗     ██║   ███████║█████╗  ██████╔╝
 ██╔══██║██╔══╝     ██║   ██╔══██║██╔══╝  ██╔══██╗
 ██║  ██║███████╗   ██║   ██║  ██║███████╗██║  ██║
 ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝`}
          </pre>
          <p className="text-text-secondary mt-6 text-sm">
            Adaptive Event-driven Trusted Human-Environment for Real-time collaboration
          </p>
        </div>

        {/* Main card */}
        <div className="card-terminal">
          <h2 className="section-header">SYSTEM.INFO</h2>

          <div className="space-y-6 mb-8">
            <div>
              <h3 className="text-text-primary mb-2">Platform Status</h3>
              <div className="status-online">OPERATIONAL</div>
            </div>

            <div>
              <h3 className="text-text-primary mb-2">Description</h3>
              <p className="text-text-secondary text-sm leading-relaxed">
                Plataforma de colaboración en tiempo real basada en event sourcing. Coordina estados
                compartidos a través de eventos distribuidos confiables con arquitectura
                offline-first y resolución determinística de conflictos.
              </p>
            </div>

            <div>
              <h3 className="text-text-primary mb-2">Features</h3>
              <ul className="text-text-secondary text-sm space-y-1">
                <li className="flex items-center gap-2">
                  <span className="text-success">✓</span> Event-sourced architecture
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-success">✓</span> Real-time synchronization
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-success">✓</span> Offline-first design
                </li>
                <li className="flex items-center gap-2">
                  <span className="text-success">✓</span> Conflict resolution
                </li>
              </ul>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row gap-4">
            <Link href="/login" className="btn-primary flex-1 text-center">
              [ → LOGIN ]
            </Link>
            <Link href="/register" className="btn-secondary flex-1 text-center">
              [ REGISTER ]
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <p className="text-text-muted text-xs mb-2">Version 0.1.0 | Build 2026.01.02</p>
          <p className="text-text-muted text-xs">
            "Synchronization is an illusion. Only events exist in time."
          </p>
        </div>
      </div>
    </div>
  );
}
