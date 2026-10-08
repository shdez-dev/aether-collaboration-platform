export function LandingFeatures() {
  return (
    <>
      {/* ── SCENE 01 — Boards ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1240px', margin: 'clamp(70px, 10vw, 140px) auto 0',
        padding: '0 clamp(20px, 5vw, 64px)',
        display: 'flex', gap: 'clamp(32px, 5vw, 80px)',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Text */}
        <div className="landing-feature-text" style={{ flex: '1 1 340px', minWidth: '280px', order: 2 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '14px', fontWeight: 600, color: 'var(--c-accent-text)', letterSpacing: '0.02em' }}>01 / Tableros</div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)', letterSpacing: '-0.025em', lineHeight: 1.08, color: 'var(--c-text)', margin: '14px 0 0' }}>
            Arrastra y listo.
          </h2>
          <p style={{ fontSize: 'clamp(1.02rem, 1.3vw, 1.16rem)', lineHeight: 1.62, color: 'var(--c-text2)', margin: '18px 0 0', maxWidth: '440px' }}>
            Mueve una tarea de una columna a otra con un gesto. Sin recargar la página y sin preguntarte dónde va. Tu equipo lo ve cambiar al instante.
          </p>
        </div>

        {/* Mock */}
        <div style={{ flex: '1 1 480px', minWidth: 0, order: 1, display: 'flex', justifyContent: 'center' }} className="mockWrap mockWrap-340 landing-feature-mock">
          <div className="mockScale" style={{ position: 'relative', width: '500px' }}>
            <div style={{
              position: 'relative', width: '500px', height: '340px',
              borderRadius: '8px', border: '1px solid rgba(97,71,130,0.1)',
              background: 'var(--c-surface2)',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,0.7)',
              overflow: 'hidden', display: 'flex', gap: '14px', padding: '20px',
            }}>
              {/* En curso */}
              <div style={{ flex: '1 1 0' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#7452A6' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text2)' }}>En curso</span>
                </div>
                <div style={{ background: 'var(--c-bg2)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: '8px', padding: '13px', marginBottom: '11px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: '#9271BD', background: 'rgba(116,82,166,0.16)', display: 'inline-block', padding: '3px 8px', borderRadius: '8px', marginBottom: '9px' }}>Diseño</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--c-text2)', fontWeight: 500 }}>Sistema de color</div>
                </div>
                <div style={{ background: 'var(--c-bg2)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: '8px', padding: '13px' }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--c-text2)', background: 'rgba(140,124,158,0.16)', display: 'inline-block', padding: '3px 8px', borderRadius: '8px', marginBottom: '9px' }}>Web</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--c-text2)', fontWeight: 500 }}>Header responsive</div>
                </div>
              </div>

              {/* Hecho — with drop zone + floating card */}
              <div style={{ flex: '1 1 0', position: 'relative' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '14px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#548B73' }} />
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--c-text2)' }}>Hecho</span>
                </div>
                <div style={{ height: '74px', border: '1.5px dashed #7452A6', borderRadius: '8px', background: 'rgba(116,82,166,0.07)', animation: 'pulseDot 2.2s ease-in-out infinite' }} />
                {/* Floating dragged card */}
                <div style={{
                  position: 'absolute', top: '36px', left: '-30px', width: '170px',
                  background: 'var(--c-surface)', border: '1px solid #7452A6',
                  borderRadius: '8px', padding: '13px',
                  boxShadow: '0 26px 44px -14px rgba(0,0,0,0.8)',
                  transform: 'rotate(-4deg)', animation: 'floatY 3.4s ease-in-out infinite',
                }}>
                  <div style={{ fontSize: '10px', fontWeight: 600, color: 'var(--c-accent-text)', background: 'rgba(116,82,166,0.18)', display: 'inline-block', padding: '3px 8px', borderRadius: '8px', marginBottom: '9px' }}>Diseño</div>
                  <div style={{ fontSize: '13.5px', color: 'var(--c-text)', fontWeight: 600 }}>Logo final</div>
                  <svg style={{ position: 'absolute', right: '-2px', bottom: '-20px' }} width="22" height="22" viewBox="0 0 24 24" fill="none">
                    <path d="M5 3l14 7-6 1.6L9 18 5 3z" fill="#fff" stroke="#FFFFFF" strokeWidth="1.2" strokeLinejoin="round"/>
                  </svg>
                  <span style={{ position: 'absolute', right: '-44px', bottom: '-30px', fontSize: '10px', fontWeight: 600, color: '#FFFFFF', background: '#548B73', padding: '2px 7px', borderRadius: '8px', whiteSpace: 'nowrap' }}>Tú</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCENE 02 — Documents ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1240px', margin: 'clamp(70px, 10vw, 140px) auto 0',
        padding: '0 clamp(20px, 5vw, 64px)',
        display: 'flex', gap: 'clamp(32px, 5vw, 80px)',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Text */}
        <div className="landing-feature-text" style={{ flex: '1 1 340px', minWidth: '280px' }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '14px', fontWeight: 600, color: 'var(--c-accent-text)', letterSpacing: '0.02em' }}>02 / Documentos</div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)', letterSpacing: '-0.025em', lineHeight: 1.08, color: 'var(--c-text)', margin: '14px 0 0' }}>
            Escriban a la vez.
          </h2>
          <p style={{ fontSize: 'clamp(1.02rem, 1.3vw, 1.16rem)', lineHeight: 1.62, color: 'var(--c-text2)', margin: '18px 0 0', maxWidth: '440px' }}>
            Un mismo documento abierto para todo el equipo. Lo que escribes aparece al instante en la pantalla de los demás, con cada idea en su sitio.
          </p>
        </div>

        {/* Mock */}
        <div style={{ flex: '1 1 480px', minWidth: 0, display: 'flex', justifyContent: 'center' }} className="mockWrap mockWrap-340 landing-feature-mock">
          <div className="mockScale" style={{ position: 'relative', width: '500px' }}>
            <div style={{
              position: 'relative', width: '500px', height: '340px',
              borderRadius: '8px', border: '1px solid rgba(97,71,130,0.1)',
              background: 'var(--c-surface2)',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}>
              {/* Doc header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(97,71,130,0.07)' }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '13.5px', color: 'var(--c-text)' }}>Brief creativo</span>
                <div style={{ display: 'flex' }}>
                  {[{ bg: '#8076A7', t: 'D', c: '#fff' }, { bg: '#A97556', t: 'S', c: '#fff' }].map((av, i) => (
                    <span key={i} style={{
                      width: '22px', height: '22px', borderRadius: '50%',
                      background: av.bg, border: '2px solid var(--c-surface2)',
                      marginLeft: i > 0 ? '-7px' : 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '9px', fontWeight: 700, color: av.c,
                    }}>{av.t}</span>
                  ))}
                </div>
              </div>

              {/* Doc body */}
              <div style={{ padding: '22px 22px 0', position: 'relative' }}>
                <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '21px', fontWeight: 700, color: 'var(--c-text)', letterSpacing: '-0.02em', marginBottom: '18px' }}>
                  Objetivo de la campaña
                </div>
                <div style={{ height: '9px', borderRadius: '8px', background: 'rgba(97,71,130,0.09)', width: '94%', marginBottom: '12px' }} />
                <div style={{ height: '9px', borderRadius: '8px', background: 'rgba(97,71,130,0.09)', width: '82%', marginBottom: '22px' }} />

                {/* Remote cursor Diego */}
                <div style={{ position: 'absolute', top: '62px', right: '46px', animation: 'bob 3s ease-in-out infinite' }}>
                  <span style={{ display: 'block', width: '2px', height: '20px', background: '#8076A7' }} />
                  <span style={{ position: 'absolute', top: '-2px', left: '2px', fontSize: '9.5px', fontWeight: 600, color: '#fff', background: '#8076A7', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>Diego</span>
                </div>

                <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '13px', fontWeight: 600, color: 'var(--c-accent-text)', marginBottom: '12px' }}>
                  Mensaje principal
                </div>

                {/* Typing line — Sara */}
                <div style={{ display: 'inline-flex', alignItems: 'center', position: 'relative' }}>
                  <div style={{ overflow: 'hidden', whiteSpace: 'nowrap', animation: 'typeline 5s ease-in-out infinite' }}>
                    <span style={{ fontSize: '14px', color: 'var(--c-text2)' }}>Organizar nunca fue tan fácil</span>
                  </div>
                  <span style={{ width: '2px', height: '18px', background: '#A97556', marginLeft: '2px', animation: 'caretBlink 1s step-end infinite' }} />
                  <span style={{ position: 'absolute', right: '-46px', top: '-4px', fontSize: '9.5px', fontWeight: 600, color: '#fff', background: '#A97556', padding: '1px 6px', borderRadius: '8px', whiteSpace: 'nowrap' }}>Sara</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── SCENE 03 — Team ── */}
      <section style={{
        position: 'relative', zIndex: 5,
        maxWidth: '1240px', margin: 'clamp(70px, 10vw, 140px) auto 0',
        padding: '0 clamp(20px, 5vw, 64px)',
        display: 'flex', gap: 'clamp(32px, 5vw, 80px)',
        alignItems: 'center', flexWrap: 'wrap',
      }}>
        {/* Text */}
        <div className="landing-feature-text" style={{ flex: '1 1 340px', minWidth: '280px', order: 2 }}>
          <div style={{ fontFamily: "'Sora', sans-serif", fontSize: '14px', fontWeight: 600, color: 'var(--c-accent-text)', letterSpacing: '0.02em' }}>03 / Tu equipo</div>
          <h2 style={{ fontFamily: "'Sora', sans-serif", fontWeight: 700, fontSize: 'clamp(1.9rem, 3.4vw, 2.9rem)', letterSpacing: '-0.025em', lineHeight: 1.08, color: 'var(--c-text)', margin: '14px 0 0' }}>
            Mira a tu equipo en vivo.
          </h2>
          <p style={{ fontSize: 'clamp(1.02rem, 1.3vw, 1.16rem)', lineHeight: 1.62, color: 'var(--c-text2)', margin: '18px 0 0', maxWidth: '440px' }}>
            Quién está conectado, en qué tarea anda y qué necesita tu atención. Todo a simple vista, sin perseguir a nadie por chat.
          </p>
        </div>

        {/* Mock */}
        <div style={{ flex: '1 1 480px', minWidth: 0, order: 1, display: 'flex', justifyContent: 'center' }} className="mockWrap mockWrap-300 landing-feature-mock">
          <div className="mockScale" style={{ position: 'relative', width: '460px' }}>
            <div style={{
              position: 'relative', width: '460px',
              borderRadius: '8px', border: '1px solid rgba(97,71,130,0.1)',
              background: 'var(--c-surface2)',
              boxShadow: '0 40px 80px -30px rgba(0,0,0,0.7)',
              overflow: 'hidden',
            }}>
              {/* Activity header */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px', borderBottom: '1px solid rgba(97,71,130,0.07)' }}>
                <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: '14px', color: 'var(--c-text)' }}>Actividad</span>
                <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11.5px', color: '#3F7C62', background: 'rgba(118,168,120,0.1)', padding: '3px 10px', borderRadius: '8px' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#548B73', animation: 'pulseDot 1.8s ease-in-out infinite' }} />
                  5 en línea
                </span>
              </div>

              {/* Activity items */}
              <div style={{ padding: '8px 10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(116,82,166,0.06)', animation: 'slideIn 6s ease-in-out infinite' }}>
                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#8076A7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>M</span>
                  <span style={{ fontSize: '13.5px', color: 'var(--c-text2)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--c-text)' }}>María</strong> asignó <strong style={{ color: 'var(--c-accent-text)' }}>Mockups v2</strong> a Diego
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#81748D', flexShrink: 0 }}>ahora</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#548B73', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#FFFFFF' }}>D</span>
                  <span style={{ fontSize: '13.5px', color: 'var(--c-text2)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--c-text)' }}>Diego</strong> completó <strong style={{ color: '#548B73' }}>Análisis previo</strong>
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#81748D', flexShrink: 0 }}>2 min</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', borderRadius: '8px', background: 'rgba(219,138,102,0.07)' }}>
                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: '#A97556', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#fff' }}>S</span>
                  <span style={{ fontSize: '13.5px', color: 'var(--c-text2)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--c-text)' }}>Sara</strong> te mencionó en <strong style={{ color: '#E2A07E' }}>Brief creativo</strong>
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#81748D', flexShrink: 0 }}>5 min</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px' }}>
                  <span style={{ flexShrink: 0, width: '32px', height: '32px', borderRadius: '50%', background: 'rgba(97,71,130,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: 'var(--c-text2)' }}>T</span>
                  <span style={{ fontSize: '13.5px', color: 'var(--c-text2)', lineHeight: 1.4 }}>
                    <strong style={{ color: 'var(--c-text)' }}>Tú</strong> creaste <strong style={{ color: 'var(--c-text2)' }}>Lanzamiento de marca</strong>
                  </span>
                  <span style={{ marginLeft: 'auto', fontSize: '11px', color: '#81748D', flexShrink: 0 }}>12 min</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
