'use client';

import Link from 'next/link';

export default function AUPPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0D0F12', color: '#C8BFAE', fontFamily: "'Manrope', system-ui, sans-serif" }}>

      <nav style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#F2571E', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5L5.5 19.5" stroke="#F8F1E3" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 4.5L18.5 19.5" stroke="#F8F1E3" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#F8F1E3" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="4.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="5.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
              <circle cx="18.5" cy="19.5" r="2.2" fill="#F8F1E3"/>
            </svg>
          </span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 16, color: '#CFC6B5' }}>Aether</span>
        </Link>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/legal/terms" style={{ fontSize: 13, color: '#615846', textDecoration: 'none' }}>Términos</Link>
          <Link href="/legal/privacy" style={{ fontSize: 13, color: '#615846', textDecoration: 'none' }}>Privacidad</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 100px' }}>
        <p style={{ fontSize: 12, color: '#615846', marginBottom: 12 }}>Legal - Aether</p>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: '#F4EEE2', margin: '0 0 8px', lineHeight: 1.2 }}>
          Política de Uso Aceptable
        </h1>
        <p style={{ fontSize: 13, color: '#615846', margin: '0 0 16px' }}>Última actualización: 27 de junio de 2026</p>
        <div style={{ background: 'rgba(242,87,30,0.08)', border: '1px solid rgba(242,87,30,0.25)', borderRadius: 10, padding: '14px 18px', marginBottom: 52, fontSize: 13.5, color: '#C8BFAE', lineHeight: 1.65 }}>
          Esta Política de Uso Aceptable («PUA») forma parte de los <Link href="/legal/terms" style={{ color: '#F2571E', textDecoration: 'none' }}>Términos de Servicio</Link> de Aether. Al usar el Servicio, usted acepta cumplir con estas reglas. Las violaciones pueden resultar en la suspensión o cancelación permanente de su cuenta.
        </div>

        <Section title="1. Usos permitidos">
          <p>Aether está diseñada para facilitar la colaboración, la gestión de proyectos y la productividad. Los usos permitidos incluyen, entre otros:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Gestión de proyectos personales, académicos o profesionales.</li>
            <li>Colaboración con equipos dentro de una organización o entre organizaciones.</li>
            <li>Planificación y seguimiento de tareas, hitos y sprints.</li>
            <li>Creación y edición de documentos colaborativos relacionados con proyectos.</li>
            <li>Comunicación y coordinación entre miembros del equipo en el contexto del trabajo.</li>
            <li>Integración con herramientas externas compatibles mediante las APIs o webhooks autorizados.</li>
          </ul>
        </Section>

        <Section title="2. Conductas prohibidas">
          <p>Queda estrictamente prohibido utilizar el Servicio para:</p>

          <Subsection title="2.1 Actividades ilegales o dañinas">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Violar cualquier ley, regulación o normativa aplicable, local o internacional.</li>
              <li>Facilitar, planificar o ejecutar actividades ilegales de cualquier tipo.</li>
              <li>Infringir derechos de propiedad intelectual, marcas registradas, patentes, secretos comerciales u otros derechos de propiedad de terceros.</li>
              <li>Incurrir en fraude, suplantación de identidad o cualquier tipo de engaño.</li>
              <li>Distribuir, almacenar o procesar material de abuso sexual infantil (CSAM) o cualquier contenido que explote o dañe a menores.</li>
            </ul>
          </Subsection>

          <Subsection title="2.2 Abuso del Servicio y seguridad">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Intentar obtener acceso no autorizado a cuentas de otros usuarios, sistemas o redes.</li>
              <li>Explotar, escanear o realizar pruebas de vulnerabilidades del Servicio sin autorización expresa por escrito de Aether.</li>
              <li>Distribuir malware, virus, ransomware, spyware u otro software malicioso.</li>
              <li>Realizar ataques de denegación de servicio (DoS/DDoS) o sobrecargar intencionalmente la infraestructura.</li>
              <li>Eludir, deshabilitar o interferir con las funciones de seguridad del Servicio.</li>
              <li>Realizar ingeniería inversa, descompilar o desensamblar cualquier parte del Servicio.</li>
              <li>Utilizar scripts automatizados, bots o scrapers para acceder al Servicio de forma no autorizada.</li>
            </ul>
          </Subsection>

          <Subsection title="2.3 Contenido inapropiado u ofensivo">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Publicar, transmitir o almacenar contenido que sea obsceno, pornográfico, difamatorio, amenazante, acosador, discriminatorio u odioso.</li>
              <li>Acosar, intimidar o amenazar a otros usuarios.</li>
              <li>Difundir desinformación o contenido engañoso que pueda causar daño.</li>
              <li>Publicar información personal de terceros sin su consentimiento (doxing).</li>
            </ul>
          </Subsection>

          <Subsection title="2.4 Spam y abuso de comunicaciones">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Enviar mensajes no solicitados, spam o comunicaciones masivas no autorizadas.</li>
              <li>Utilizar el Servicio para distribuir publicidad no solicitada o material promocional sin consentimiento de los destinatarios.</li>
              <li>Crear múltiples cuentas con el fin de eludir restricciones o baneos.</li>
            </ul>
          </Subsection>

          <Subsection title="2.5 Uso comercial indebido">
            <ul style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <li>Revender, sublicenciar o distribuir el acceso al Servicio sin autorización expresa de Aether.</li>
              <li>Utilizar el Servicio para construir un producto o servicio competidor.</li>
              <li>Realizar minería o extracción masiva de datos del Servicio sin autorización.</li>
            </ul>
          </Subsection>
        </Section>

        <Section title="3. Responsabilidades del usuario">
          <p><strong style={{ color: '#C8BFAE' }}>Seguridad de la cuenta:</strong> Usted es responsable de mantener seguras sus credenciales y de todas las actividades realizadas bajo su cuenta, incluidas las de los miembros de su workspace.</p>
          <p><strong style={{ color: '#C8BFAE' }}>Contenido de terceros:</strong> Si su workspace incluye contenido generado por terceros (colaboradores, clientes), es su responsabilidad garantizar que dicho contenido cumpla con esta PUA.</p>
          <p><strong style={{ color: '#C8BFAE' }}>Respaldo de datos:</strong> Aunque Aether implementa medidas de seguridad razonables, recomendamos mantener copias de seguridad de la información crítica. Aether no se responsabiliza por pérdidas de datos causadas por causas ajenas a su control.</p>
          <p><strong style={{ color: '#C8BFAE' }}>Cumplimiento legal:</strong> Es su responsabilidad asegurarse de que el uso que hace del Servicio cumple con las leyes aplicables en su jurisdicción, incluyendo las relativas a protección de datos, privacidad y exportación.</p>
        </Section>

        <Section title="4. Responsabilidad sobre el contenido">
          <p>Aether actúa como proveedor de la plataforma y no revisa de forma proactiva el contenido generado por los usuarios. Sin embargo, nos reservamos el derecho de eliminar cualquier contenido que viole esta PUA o los Términos de Servicio, sin previo aviso.</p>
          <p>Usted es el único responsable del contenido que carga, crea o comparte en el Servicio. Si Aether recibe una reclamación legítima sobre contenido que infringe derechos de terceros, actuaremos conforme a la normativa aplicable (incluyendo procedimientos de notificación y retirada tipo DMCA o equivalente).</p>
        </Section>

        <Section title="5. Investigación y reporte de vulnerabilidades">
          <p>Apreciamos los esfuerzos de la comunidad de seguridad para mejorar la plataforma. Si descubre una vulnerabilidad de seguridad en el Servicio:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Notifíquenosla de forma responsable a <strong style={{ color: '#C8BFAE' }}>[EMAIL DE SEGURIDAD]</strong> antes de divulgarla públicamente.</li>
            <li>No acceda ni modifique datos de otros usuarios.</li>
            <li>No realice ataques que afecten la disponibilidad del Servicio.</li>
          </ul>
          <p>Las investigaciones de seguridad realizadas de buena fe y conforme a estas directrices no serán consideradas violaciones de esta PUA.</p>
        </Section>

        <Section title="6. Consecuencias del incumplimiento">
          <p>El incumplimiento de esta PUA puede resultar en una o más de las siguientes acciones, a discreción de Aether:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Advertencia formal al usuario o workspace.</li>
            <li>Eliminación del contenido infractor.</li>
            <li>Suspensión temporal del acceso al Servicio.</li>
            <li>Cancelación permanente de la cuenta sin reembolso.</li>
            <li>Notificación a las autoridades competentes cuando la actividad sea constitutiva de delito.</li>
            <li>Ejercicio de acciones legales para recuperar daños causados a Aether o a terceros.</li>
          </ul>
          <p>Nos reservamos el derecho de actuar de forma inmediata y sin previo aviso cuando la situación así lo requiera, especialmente en casos de actividad ilegal, riesgo para la seguridad o daño a otros usuarios.</p>
        </Section>

        <Section title="7. Cómo reportar una violación">
          <p>Si detecta un uso del Servicio que viola esta Política, puede reportarlo a:</p>
          <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10, padding: '16px 20px', marginTop: 8 }}>
            <p style={{ margin: 0 }}>Email: <strong style={{ color: '#C8BFAE' }}>[EMAIL DE SOPORTE / ABUSO]</strong></p>
            <p style={{ margin: '6px 0 0', fontSize: 13, color: '#615846' }}>Incluya en su reporte: descripción del contenido o conducta, URL o identificador del recurso, fecha y hora aproximada del incidente.</p>
          </div>
          <p>Revisaremos todos los reportes y tomaremos las medidas que consideremos apropiadas. La presentación de reportes falsos o malintencionados también puede considerarse una violación de esta PUA.</p>
        </Section>

        <Section title="8. Modificaciones">
          <p>Aether puede modificar esta Política en cualquier momento. Le notificaremos los cambios materiales mediante correo electrónico o un aviso en el Servicio. El uso continuado del Servicio tras la entrada en vigor de los cambios implica su aceptación.</p>
        </Section>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/legal/terms" style={{ fontSize: 13, color: '#615846', textDecoration: 'none' }}>Términos de Servicio →</Link>
          <Link href="/legal/privacy" style={{ fontSize: 13, color: '#615846', textDecoration: 'none' }}>Política de Privacidad →</Link>
          <Link href="/" style={{ fontSize: 13, color: '#615846', textDecoration: 'none', marginLeft: 'auto' }}>← Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 600, color: '#F4EEE2', margin: '0 0 16px', paddingBottom: 10, borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5, lineHeight: 1.75, color: '#9C9486' }}>
        {children}
      </div>
    </section>
  );
}

function Subsection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginTop: 4 }}>
      <p style={{ color: '#C8BFAE', fontWeight: 600, margin: '0 0 8px', fontSize: 13.5 }}>{title}</p>
      {children}
    </div>
  );
}
