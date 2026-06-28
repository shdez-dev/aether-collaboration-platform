'use client';

const AVATARS = [
  { bg: '#4B607F', t: 'M', c: '#fff' },
  { bg: '#76A878', t: 'D', c: '#24180A' },
  { bg: '#DB8A66', t: 'S', c: '#fff' },
];

export function LandingHero() {
  return (
    <header style={{
      position: 'relative', zIndex: 10,
      maxWidth: '1320px', margin: '0 auto',
      padding: 'clamp(36px, 6vw, 84px) clamp(20px, 5vw, 64px) 40px',
      display: 'flex', gap: 'clamp(32px, 5vw, 72px)',
      alignItems: 'center', flexWrap: 'wrap',
    }}>

      {/* ── Left — copy ── */}
      <div className="landing-hero-text" style={{ flex: '1 1 380px', minWidth: '300px' }}>

        {/* Badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '9px',
          fontFamily: "'Sora', sans-serif", fontSize: '12.5px', fontWeight: 600,
          letterSpacing: '0.16em', textTransform: 'uppercase', color: '#F2571E',
          background: 'rgba(242,87,30,0.08)', border: '1px solid rgba(242,87,30,0.18)',
          padding: '7px 14px', borderRadius: '8px',
        }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F2571E', animation: 'pulseDot 2.4s ease-in-out infinite' }} />
          Organización sin complicaciones
        </div>

        {/* H1 */}
        <h1 style={{
          fontFamily: "'Sora', sans-serif", fontWeight: 700,
          fontSize: 'clamp(2.6rem, 5.4vw, 4.5rem)',
          lineHeight: 1.03, letterSpacing: '-0.035em',
          margin: '22px 0 0', color: '#F4EEE2',
        }}>
          Ordena tus proyectos{' '}
          <span style={{ background: '#F2571E', WebkitBackgroundClip: 'text', backgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            sin romperte la cabeza.
          </span>
        </h1>

        {/* Description */}
        <p style={{ maxWidth: '480px', margin: '22px 0 0', fontSize: 'clamp(1.05rem, 1.4vw, 1.2rem)', lineHeight: 1.62, color: '#9C9486' }}>
          Aether es el espacio donde tú y tu equipo organizan el trabajo de forma natural. Abres, arrastras, escribes. Ya está.
        </p>
      </div>

      {/* ── Right — Living Board ── */}
      <div style={{ flex: '1 1 560px', minWidth: 0, display: 'flex', justifyContent: 'center' }} className="mockWrap mockWrap-452">
        <div className="mockScale" style={{ position: 'relative', width: '600px' }}>
          <div style={{
            position: 'relative', width: '600px', height: '452px',
            borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)',
            background: 'rgba(20,28,46,0.92)',
            boxShadow: '0 50px 100px -34px rgba(0,0,0,0.75)',
            overflow: 'hidden',
          }}>

            {/* Board topbar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
                <span style={{ width: '9px', height: '9px', borderRadius: '50%', background: '#F2571E' }} />
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '14.5px', color: '#E6DFD0' }}>Lanzamiento de marca</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex' }}>
                  {AVATARS.map((av, i) => (
                    <span key={i} style={{
                      width: '24px', height: '24px', borderRadius: '50%',
                      background: av.bg, border: '2px solid #1C2238',
                      marginLeft: i > 0 ? '-7px' : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '10px', fontWeight: 700, color: av.c,
                    }}>{av.t}</span>
                  ))}
                </div>
                <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '11px', color: '#9FC59A', background: 'rgba(118,168,120,0.1)', padding: '3px 9px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#76A878', animation: 'pulseDot 2s ease-in-out infinite' }} />
                  3 en línea
                </span>
              </div>
            </div>

            {/* Columns */}
            <div style={{ display: 'flex', gap: '12px', padding: '16px' }}>

              {/* Col 1 — Por hacer */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px', height: '22px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#64748B' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9C9486' }}>Por hacer</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#827A6D', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '8px' }}>2</span>
                </div>
                <div style={{ height: '92px', border: '1.5px dashed rgba(255,255,255,0.12)', borderRadius: '8px', marginBottom: '10px' }} />
                <div style={{ background: '#1B2237', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '11px 12px' }}>
                  <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: 'rgba(140,124,158,0.16)', color: '#C4B9D0' }}>Contenido</span></div>
                  <div style={{ fontSize: '13px', color: '#D8D0C1', fontWeight: 500 }}>Guion del video</div>
                </div>
              </div>

              {/* Col 2 — En curso */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px', height: '22px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#F2571E' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9C9486' }}>En curso</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#827A6D', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '8px' }}>1</span>
                </div>
                <div style={{ height: '92px', border: '1.5px dashed rgba(255,255,255,0.12)', borderRadius: '8px', marginBottom: '10px' }} />
                <div style={{ background: '#1B2237', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '11px 12px' }}>
                  <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: 'rgba(242,87,30,0.16)', color: '#F4905A' }}>Diseño</span></div>
                  <div style={{ fontSize: '13px', color: '#D8D0C1', fontWeight: 500 }}>Página de inicio</div>
                </div>
              </div>

              {/* Col 3 — Hecho */}
              <div style={{ flex: '1 1 0', minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '12px', height: '22px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#76A878' }} />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#9C9486' }}>Hecho</span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#827A6D', background: 'rgba(255,255,255,0.06)', padding: '1px 7px', borderRadius: '8px' }}>1</span>
                </div>
                <div style={{ height: '92px', border: '1.5px dashed rgba(255,255,255,0.12)', borderRadius: '8px', marginBottom: '10px' }} />
                <div style={{ background: '#1B2237', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '11px 12px', opacity: 0.72 }}>
                  <div style={{ marginBottom: '8px' }}><span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: 'rgba(118,168,120,0.16)', color: '#A6C9A0' }}>Investigación</span></div>
                  <div style={{ fontSize: '13px', color: '#9C9486', fontWeight: 500, textDecoration: 'line-through' }}>Análisis previo</div>
                </div>
              </div>

            </div>

            {/* Traveling card */}
            <div style={{
              position: 'absolute', top: '106px', left: '16px', width: '181px',
              background: '#20293F', border: '1px solid #F2571E',
              borderRadius: '8px', padding: '11px 12px', zIndex: 6,
              animation: 'travelCard 7s ease-in-out infinite',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px' }}>
                <span style={{ fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '8px', background: 'rgba(242,87,30,0.18)', color: '#F6A878' }}>Diseño</span>
                <span style={{ marginLeft: 'auto', width: '18px', height: '18px', borderRadius: '50%', background: '#4B607F', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', fontWeight: 700, color: '#fff' }}>D</span>
              </div>
              <div style={{ fontSize: '13px', color: '#ECE5D6', fontWeight: 600, lineHeight: 1.3 }}>Mockups v2</div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '10px' }}>
                <span style={{ width: '15px', height: '15px', borderRadius: '50%', border: '1.5px solid #5C6A82' }} />
                <span style={{ fontSize: '10px', color: '#8995AD', background: 'rgba(255,255,255,0.05)', padding: '2px 7px', borderRadius: '8px' }}>Vie</span>
              </div>
            </div>

            {/* Animated cursor */}
            <div style={{ position: 'absolute', top: '106px', left: '16px', zIndex: 7, animation: 'travelCursor 7s ease-in-out infinite' }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M5 3l14 7-6 1.6L9 18 5 3z" fill="#fff" stroke="#24180A" strokeWidth="1.2" strokeLinejoin="round"/>
              </svg>
              <span style={{ position: 'absolute', left: '18px', top: '18px', fontSize: '10px', fontWeight: 600, color: '#fff', background: '#8C7C9E', padding: '2px 7px', borderRadius: '8px', whiteSpace: 'nowrap' }}>María</span>
            </div>

          </div>
        </div>
      </div>
    </header>
  );
}
