const capabilities = [
  {
    name: 'Proyectos y tableros',
    description: 'El objetivo, los responsables y las tareas comparten el mismo lugar.',
  },
  {
    name: 'Documentos',
    description: 'La información del espacio y la de cada proyecto permanecen distinguibles.',
  },
  {
    name: 'Calendario',
    description: 'Los compromisos personales y compartidos se pueden planificar juntos.',
  },
  {
    name: 'Equipos y conversaciones',
    description: 'Las personas participan con claridad sobre su contexto y su siguiente paso.',
  },
];

export function LandingFeatures() {
  return (
    <>
      <section className="home-context-section" aria-labelledby="home-context-title">
        <div className="home-context-heading">
          <h2 id="home-context-title">La conversación termina.<br />El contexto no.</h2>
          <p>En AETHER, una decisión no queda aislada del trabajo que provoca. Puedes volver al origen y avanzar desde ahí, sin empezar de cero cada vez.</p>
        </div>
        <div className="home-context-demo" aria-label="Ejemplo ilustrativo de una decisión que llega a un proyecto">
          <div className="home-demo-header"><span>Ejemplo ilustrativo</span><span>Contexto de un proyecto</span></div>
          <div className="home-demo-record">
            <div className="home-demo-lead">
              <small>Proyecto</small>
              <strong>Bienvenida de nuevas personas</strong>
              <p>La propuesta original y el motivo de la decisión siguen visibles mientras el equipo trabaja.</p>
            </div>
            <div className="home-demo-links">
              <div><span>Origen</span><strong>Simplificar la incorporación al equipo</strong></div>
              <div><span>Decisión</span><strong>Crear una guía común con responsables</strong></div>
              <div><span>Siguiente paso</span><strong>Revisar tareas, documento y fecha</strong></div>
            </div>
          </div>
          <p>La misma intención acompaña cada cambio de etapa.</p>
        </div>
      </section>

      <section className="home-platform-section" id="plataforma" aria-labelledby="home-platform-title">
        <div className="home-platform-intro">
          <h2 id="home-platform-title">Menos piezas sueltas.<br />Más trabajo conectado.</h2>
          <p>AETHER reúne lo que un equipo necesita para planificar, colaborar y entender el avance. Cada función tiene un propósito dentro del mismo recorrido.</p>
        </div>
        <div className="home-capability-list">
          {capabilities.map((item) => (
            <div className="home-capability" key={item.name}>
              <span className="home-capability-mark" aria-hidden="true" />
              <h3>{item.name}</h3>
              <p>{item.description}</p>
            </div>
          ))}
        </div>
        <p className="home-institution-note">¿Gestionas propuestas antes de convertirlas en proyectos? AETHER también contempla el seguimiento de iniciativas en contextos institucionales.</p>
      </section>
    </>
  );
}
