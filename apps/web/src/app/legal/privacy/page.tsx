'use client';

import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text2)', fontFamily: "'Manrope', system-ui, sans-serif" }}>

      <nav style={{ maxWidth: 800, margin: '0 auto', padding: '28px 24px 0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
          <span style={{ width: 26, height: 26, borderRadius: 8, background: '#7452A6', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M12 4.5L5.5 19.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
              <path d="M12 4.5L18.5 19.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
              <path d="M8.55 12.5Q12 9.2 15.45 12.5" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round"/>
              <circle cx="12" cy="4.5" r="2.2" fill="#FFFFFF"/>
              <circle cx="5.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
              <circle cx="18.5" cy="19.5" r="2.2" fill="#FFFFFF"/>
            </svg>
          </span>
          <span style={{ fontFamily: "'Sora', sans-serif", fontWeight: 600, fontSize: 16, color: 'var(--c-text2)' }}>Aether</span>
        </Link>
        <div style={{ display: 'flex', gap: 20 }}>
          <Link href="/legal/terms" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Términos</Link>
          <Link href="/legal/aup" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Uso aceptable</Link>
        </div>
      </nav>

      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 100px' }}>
        <p style={{ fontSize: 12, color: 'var(--c-text4)', marginBottom: 12 }}>Legal - Aether</p>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          Política de Privacidad
        </h1>
        <p style={{ fontSize: 13, color: 'var(--c-text4)', margin: '0 0 52px' }}>Última actualización: 27 de junio de 2026</p>

        <Section title="1. Responsable del tratamiento">
          <p>El responsable del tratamiento de sus datos personales es <strong style={{ color: 'var(--c-text2)' }}>[NOMBRE LEGAL DE LA EMPRESA]</strong>, con domicilio en <strong style={{ color: 'var(--c-text2)' }}>[DIRECCIÓN LEGAL]</strong> y contacto en <strong style={{ color: 'var(--c-text2)' }}>[EMAIL DE PRIVACIDAD]</strong> («Aether», «nosotros» o «nos»).</p>
          <p>Esta Política describe cómo recopilamos, usamos, almacenamos y protegemos los datos personales de los usuarios de la plataforma Aether («el Servicio»).</p>
        </Section>

        <Section title="2. Datos que recopilamos">
          <p><strong style={{ color: 'var(--c-text2)' }}>Datos que usted nos proporciona directamente:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong style={{ color: 'var(--c-text2)' }}>Información de cuenta:</strong> nombre completo, dirección de correo electrónico y contraseña (almacenada en forma cifrada mediante bcrypt).</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Información de perfil:</strong> foto de perfil, zona horaria e idioma preferido.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Contenido del usuario:</strong> proyectos, tableros, tareas, documentos, comentarios y cualquier otro contenido que cree dentro del Servicio.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Información de pago:</strong> datos de facturación procesados por nuestro proveedor de pagos externo. Aether no almacena números de tarjeta de crédito ni datos bancarios completos.</li>
          </ul>
          <p><strong style={{ color: 'var(--c-text2)' }}>Datos recopilados automáticamente:</strong></p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong style={{ color: 'var(--c-text2)' }}>Datos de uso:</strong> páginas visitadas, funcionalidades utilizadas, fechas y horas de acceso, duración de las sesiones.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Datos técnicos:</strong> dirección IP, tipo y versión del navegador, sistema operativo, identificadores de dispositivo.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Registros del servidor:</strong> registros de actividad necesarios para la operación, seguridad y diagnóstico del Servicio.</li>
          </ul>
        </Section>

        <Section title="3. Finalidades y base legal del tratamiento">
          <Table
            headers={['Finalidad', 'Base legal']}
            rows={[
              ['Proveer y mantener el Servicio', 'Ejecución del contrato (Términos de Servicio)'],
              ['Gestionar su cuenta y autenticación', 'Ejecución del contrato'],
              ['Enviar comunicaciones de servicio (actualizaciones, alertas de seguridad)', 'Interés legítimo / Ejecución del contrato'],
              ['Enviar comunicaciones de marketing (novedades, nuevas funcionalidades)', 'Consentimiento (puede retirarse en cualquier momento)'],
              ['Analizar el uso del Servicio para mejorar la plataforma', 'Interés legítimo'],
              ['Detectar y prevenir fraudes y abusos', 'Interés legítimo / Obligación legal'],
              ['Cumplir con obligaciones legales y regulatorias', 'Obligación legal'],
            ]}
          />
        </Section>

        <Section title="4. Compartición de datos con terceros">
          <p>No vendemos ni alquilamos sus datos personales a terceros. Podemos compartir información con:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong style={{ color: 'var(--c-text2)' }}>Proveedores de servicios:</strong> empresas que nos ayudan a operar el Servicio (infraestructura cloud, procesamiento de pagos, envío de correos). Estos proveedores actúan como encargados del tratamiento y solo pueden usar sus datos según nuestras instrucciones.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Miembros de su workspace:</strong> el contenido que comparta dentro de un workspace será visible para los demás miembros de dicho workspace.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Autoridades y obligaciones legales:</strong> cuando lo exija la ley, una orden judicial o para proteger derechos, propiedad o seguridad de Aether o terceros.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Transacciones corporativas:</strong> en caso de fusión, adquisición o venta de activos, sus datos podrían ser transferidos. Le notificaremos previamente y le daremos la opción de eliminar su cuenta.</li>
          </ul>
          <p>Los principales subencargados que utilizamos actualmente incluyen: <strong style={{ color: 'var(--c-text2)' }}>[PROVEEDOR DE CLOUD]</strong> (infraestructura), <strong style={{ color: 'var(--c-text2)' }}>[PROVEEDOR DE PAGOS]</strong> (pagos) y <strong style={{ color: 'var(--c-text2)' }}>[PROVEEDOR DE EMAIL]</strong> (correo electrónico).</p>
        </Section>

        <Section title="5. Transferencias internacionales de datos">
          <p>Sus datos pueden ser almacenados y procesados en servidores ubicados fuera de su país de residencia. Cuando transferimos datos fuera del Espacio Económico Europeo (EEE), nos aseguramos de que se apliquen las salvaguardas adecuadas exigidas por la normativa vigente (por ejemplo, Cláusulas Contractuales Tipo de la UE).</p>
        </Section>

        <Section title="6. Seguridad de los datos">
          <p>Implementamos medidas técnicas y organizativas razonables para proteger sus datos personales, incluyendo:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Cifrado en tránsito mediante TLS/HTTPS en todas las comunicaciones.</li>
            <li>Contraseñas almacenadas mediante hashing con bcrypt y salt.</li>
            <li>Tokens de acceso con tiempo de expiración y mecanismo de refresco.</li>
            <li>Acceso restringido a los datos: solo el personal autorizado puede acceder a datos de producción.</li>
            <li>Monitoreo continuo de actividades sospechosas.</li>
          </ul>
          <p>No obstante, ningún sistema es 100% seguro. En caso de brecha de seguridad que afecte sus datos, le notificaremos en los plazos exigidos por la ley aplicable.</p>
        </Section>

        <Section title="7. Retención de datos">
          <p>Conservamos sus datos personales mientras su cuenta esté activa o mientras sea necesario para prestar el Servicio. Específicamente:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li>Los datos de cuenta se conservan durante la vigencia de su cuenta y se eliminan en un plazo máximo de 90 días tras la cancelación.</li>
            <li>Los registros de actividad y seguridad se conservan durante un máximo de 12 meses.</li>
            <li>Los datos necesarios para el cumplimiento de obligaciones legales o fiscales se conservan por el período que exija la legislación aplicable.</li>
          </ul>
        </Section>

        <Section title="8. Sus derechos">
          <p>Dependiendo de su ubicación, puede tener los siguientes derechos sobre sus datos personales:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong style={{ color: 'var(--c-text2)' }}>Acceso:</strong> obtener confirmación de si tratamos sus datos y recibir una copia.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Rectificación:</strong> corregir datos inexactos o incompletos (puede hacerlo directamente desde la configuración de su perfil).</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Supresión («derecho al olvido»):</strong> solicitar la eliminación de sus datos cuando ya no sean necesarios o retire su consentimiento.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Portabilidad:</strong> recibir sus datos en un formato estructurado y legible por máquina.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Oposición y limitación:</strong> oponerse al tratamiento o solicitar su limitación en determinadas circunstancias.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Retirada del consentimiento:</strong> retirar en cualquier momento el consentimiento prestado para comunicaciones de marketing.</li>
          </ul>
          <p>Para ejercer sus derechos, escríbanos a <strong style={{ color: 'var(--c-text2)' }}>[EMAIL DE PRIVACIDAD]</strong>. Responderemos en un plazo máximo de 30 días. Tiene derecho a presentar una reclamación ante la autoridad de protección de datos competente de su país.</p>
        </Section>

        <Section title="9. Cookies y tecnologías similares">
          <p>Utilizamos cookies y tecnologías similares para:</p>
          <ul style={{ paddingLeft: 20, margin: '8px 0', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <li><strong style={{ color: 'var(--c-text2)' }}>Cookies esenciales:</strong> necesarias para el funcionamiento del Servicio (autenticación, sesión). No pueden desactivarse.</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Cookies de preferencias:</strong> recuerdan sus configuraciones (idioma, tema).</li>
            <li><strong style={{ color: 'var(--c-text2)' }}>Cookies analíticas:</strong> nos ayudan a entender cómo se utiliza el Servicio para mejorarlo. Puede optar por no participar.</li>
          </ul>
          <p>Puede gestionar sus preferencias de cookies desde la configuración de su navegador. Tenga en cuenta que deshabilitar ciertas cookies puede afectar la funcionalidad del Servicio.</p>
        </Section>

        <Section title="10. Menores de edad">
          <p>El Servicio no está dirigido a menores de 16 años. No recopilamos intencionadamente datos de menores de esa edad. Si detectamos que hemos recopilado datos de un menor sin consentimiento parental verificable, eliminaremos dicha información de inmediato.</p>
        </Section>

        <Section title="11. Cambios a esta Política">
          <p>Podemos actualizar esta Política periódicamente. Le notificaremos los cambios materiales mediante correo electrónico o un aviso en el Servicio con al menos 15 días de anticipación. La versión vigente siempre estará disponible en esta página.</p>
        </Section>

        <Section title="12. Contacto">
          <p>Para cualquier consulta, solicitud o reclamación relacionada con la privacidad de sus datos, contáctenos en:</p>
          <div style={{ background: 'rgba(97,71,130,0.03)', border: '1px solid rgba(97,71,130,0.08)', borderRadius: 10, padding: '16px 20px', marginTop: 8 }}>
            <p style={{ margin: 0 }}><strong style={{ color: 'var(--c-text2)' }}>[NOMBRE LEGAL DE LA EMPRESA]</strong></p>
            <p style={{ margin: '4px 0 0' }}>Atención: Responsable de Protección de Datos</p>
            <p style={{ margin: '4px 0 0' }}><strong style={{ color: 'var(--c-text2)' }}>[DIRECCIÓN POSTAL]</strong></p>
            <p style={{ margin: '4px 0 0' }}>Email: <strong style={{ color: 'var(--c-text2)' }}>[EMAIL DE PRIVACIDAD]</strong></p>
          </div>
        </Section>

        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(97,71,130,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/legal/terms" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Términos de Servicio →</Link>
          <Link href="/legal/aup" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Política de Uso Aceptable →</Link>
          <Link href="/" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none', marginLeft: 'auto' }}>← Volver al inicio</Link>
        </div>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section style={{ marginBottom: 44 }}>
      <h2 style={{ fontFamily: "'Sora', sans-serif", fontSize: 18, fontWeight: 600, color: 'var(--c-text)', margin: '0 0 16px', paddingBottom: 10, borderBottom: '1px solid rgba(97,71,130,0.07)' }}>
        {title}
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14.5, lineHeight: 1.75, color: 'var(--c-text2)' }}>
        {children}
      </div>
    </section>
  );
}

function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div style={{ overflowX: 'auto', marginTop: 8 }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', color: 'var(--c-text2)', fontWeight: 600, background: 'rgba(97,71,130,0.04)', borderBottom: '1px solid rgba(97,71,130,0.1)' }}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} style={{ borderBottom: '1px solid rgba(97,71,130,0.05)' }}>
              {row.map((cell, j) => (
                <td key={j} style={{ padding: '10px 14px', verticalAlign: 'top', color: j === 0 ? 'var(--c-text2)' : 'var(--c-text2)' }}>
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
