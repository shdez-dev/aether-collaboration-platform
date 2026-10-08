'use client';

import Link from 'next/link';

export default function TermsPage() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--c-bg)', color: 'var(--c-text2)', fontFamily: "'Manrope', system-ui, sans-serif" }}>

      {/* Nav mínima */}
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
          <Link href="/legal/privacy" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Privacidad</Link>
          <Link href="/legal/aup" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Uso aceptable</Link>
        </div>
      </nav>

      {/* Contenido */}
      <main style={{ maxWidth: 800, margin: '0 auto', padding: '56px 24px 100px' }}>
        <p style={{ fontSize: 12, color: 'var(--c-text4)', marginBottom: 12 }}>Legal - Aether</p>
        <h1 style={{ fontFamily: "'Sora', sans-serif", fontSize: 'clamp(28px, 5vw, 40px)', fontWeight: 700, color: 'var(--c-text)', margin: '0 0 8px', lineHeight: 1.2 }}>
          Términos de Servicio
        </h1>
        <p style={{ fontSize: 13, color: 'var(--c-text4)', margin: '0 0 52px' }}>Última actualización: 27 de junio de 2026</p>

        <Section title="1. Aceptación de los términos">
          <p>Al acceder o utilizar la plataforma Aether («el Servicio»), usted acepta estar legalmente vinculado por estos Términos de Servicio («Términos»). Si no acepta estos Términos, no utilice el Servicio.</p>
          <p>El Servicio es operado por <strong style={{ color: 'var(--c-text2)' }}>[NOMBRE LEGAL DE LA EMPRESA]</strong> («Aether», «nosotros» o «nos»), con domicilio en <strong style={{ color: 'var(--c-text2)' }}>[DIRECCIÓN LEGAL]</strong>.</p>
          <p>Si utiliza el Servicio en nombre de una empresa u organización, declara que tiene autoridad para vincular a dicha entidad a estos Términos.</p>
        </Section>

        <Section title="2. Descripción del Servicio">
          <p>Aether es una plataforma de colaboración y gestión de proyectos que ofrece, entre otras funcionalidades: tableros Kanban, seguimiento de sprints, diagramas de Gantt, gestión de documentos, comunicación en equipo y herramientas de planificación.</p>
          <p>El Servicio está dirigido a estudiantes, profesionales independientes (freelancers) y pequeñas y medianas empresas (PYMES). Aether se reserva el derecho de modificar, suspender o discontinuar cualquier funcionalidad del Servicio en cualquier momento, con o sin previo aviso.</p>
        </Section>

        <Section title="3. Cuentas de usuario">
          <p><strong style={{ color: 'var(--c-text2)' }}>Registro:</strong> Para acceder a las funcionalidades del Servicio debe crear una cuenta proporcionando información veraz, completa y actualizada.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Seguridad:</strong> Usted es responsable de mantener la confidencialidad de sus credenciales de acceso y de todas las actividades que ocurran bajo su cuenta. Notifíquenos de inmediato ante cualquier uso no autorizado.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Edad mínima:</strong> Debe tener al menos 16 años para registrarse. Si tiene entre 16 y 18 años, necesita autorización de un tutor legal.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Una cuenta por persona:</strong> No está permitido crear múltiples cuentas personales con el fin de eludir restricciones o planes de uso.</p>
        </Section>

        <Section title="4. Planes y pagos">
          <p>Aether puede ofrecer planes gratuitos y planes de pago. Las condiciones específicas de precios, facturación, renovaciones y cancelaciones se detallarán en la página de precios o en el acuerdo de suscripción correspondiente.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Renovación automática:</strong> Los planes de pago se renuevan automáticamente al final de cada período facturado, a menos que el usuario cancele antes de la fecha de renovación.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Reembolsos:</strong> Los pagos realizados no son reembolsables salvo que la ley aplicable disponga lo contrario o que Aether lo indique expresamente por escrito.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Cambios de precio:</strong> Aether podrá modificar sus precios con un mínimo de 30 días de aviso previo al usuario.</p>
        </Section>

        <Section title="5. Propiedad intelectual y contenido">
          <p><strong style={{ color: 'var(--c-text2)' }}>Su contenido:</strong> Usted conserva todos los derechos sobre el contenido que crea, carga o almacena en el Servicio («Contenido del Usuario»). Al utilizar el Servicio, nos otorga una licencia no exclusiva, mundial, libre de regalías y sublicenciable para alojar, almacenar, reproducir y procesar dicho contenido únicamente con el fin de prestar y mejorar el Servicio.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Nuestro contenido:</strong> El Servicio, incluyendo su diseño, código, marcas, logotipos y toda la tecnología subyacente, es propiedad exclusiva de Aether y está protegido por las leyes de propiedad intelectual aplicables. Queda prohibida su reproducción o uso sin autorización expresa.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Retroalimentación:</strong> Cualquier sugerencia, idea o comentario que nos envíe puede ser utilizado por Aether sin restricción ni obligación de compensación.</p>
        </Section>

        <Section title="6. Conducta del usuario">
          <p>Al utilizar el Servicio, usted se compromete a cumplir con nuestra <Link href="/legal/aup" style={{ color: 'var(--c-accent-text)', textDecoration: 'none' }}>Política de Uso Aceptable</Link>, que forma parte integrante de estos Términos. Cualquier violación de dicha política podrá resultar en la suspensión o cancelación inmediata de su cuenta.</p>
        </Section>

        <Section title="7. Privacidad y protección de datos">
          <p>El tratamiento de sus datos personales se rige por nuestra <Link href="/legal/privacy" style={{ color: 'var(--c-accent-text)', textDecoration: 'none' }}>Política de Privacidad</Link>, incorporada a estos Términos por referencia. Al utilizar el Servicio, usted consiente el tratamiento de sus datos conforme a dicha Política.</p>
        </Section>

        <Section title="8. Disponibilidad y modificaciones del Servicio">
          <p>Aether no garantiza que el Servicio esté disponible de forma ininterrumpida, segura o libre de errores. El Servicio se proporciona «tal como está» y «según disponibilidad».</p>
          <p>Nos reservamos el derecho de modificar estos Términos en cualquier momento. Notificaremos los cambios materiales mediante correo electrónico o un aviso prominente en el Servicio con al menos 15 días de anticipación. El uso continuado del Servicio tras la entrada en vigor de los cambios implica la aceptación de los nuevos Términos.</p>
        </Section>

        <Section title="9. Suspensión y cancelación">
          <p><strong style={{ color: 'var(--c-text2)' }}>Por parte del usuario:</strong> Puede cancelar su cuenta en cualquier momento desde la configuración de su perfil. Tras la cancelación, sus datos serán eliminados conforme a lo establecido en la Política de Privacidad.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Por parte de Aether:</strong> Podemos suspender o cancelar su acceso al Servicio, con o sin previo aviso, si: (i) viola estos Términos o la Política de Uso Aceptable; (ii) su uso representa un riesgo para la seguridad o estabilidad del Servicio; o (iii) así lo exige la ley.</p>
          <p>En caso de cancelación, le daremos un plazo razonable para exportar su contenido, salvo que la cancelación se deba a una violación grave de estos Términos.</p>
        </Section>

        <Section title="10. Limitación de responsabilidad">
          <p>En la máxima medida permitida por la ley aplicable, Aether no será responsable por: (i) pérdida de datos o beneficios; (ii) interrupciones del servicio; (iii) daños indirectos, incidentales, especiales o consecuentes; (iv) acceso no autorizado a su cuenta o datos originado por causas ajenas a Aether.</p>
          <p>La responsabilidad total de Aether frente a usted por cualquier reclamación derivada del uso del Servicio no superará el importe que usted haya pagado a Aether durante los 12 meses anteriores a la reclamación, o 100 USD si no ha realizado ningún pago.</p>
        </Section>

        <Section title="11. Indemnización">
          <p>Usted acepta defender, indemnizar y mantener indemne a Aether, sus directores, empleados y agentes frente a cualquier reclamación, daño, pérdida o gasto (incluidos honorarios razonables de abogados) que surja de: (i) su uso del Servicio; (ii) su Contenido de Usuario; (iii) la violación de estos Términos.</p>
        </Section>

        <Section title="12. Ley aplicable y jurisdicción">
          <p>Estos Términos se rigen e interpretan conforme a las leyes de <strong style={{ color: 'var(--c-text2)' }}>[PAÍS / ESTADO]</strong>. Cualquier disputa que no pueda resolverse de forma amistosa será sometida a los tribunales competentes de <strong style={{ color: 'var(--c-text2)' }}>[CIUDAD, PAÍS]</strong>, con renuncia expresa a cualquier otro fuero que pudiera corresponder.</p>
        </Section>

        <Section title="13. Disposiciones generales">
          <p><strong style={{ color: 'var(--c-text2)' }}>Integridad del acuerdo:</strong> Estos Términos, junto con la Política de Privacidad y la Política de Uso Aceptable, constituyen el acuerdo completo entre usted y Aether respecto al Servicio.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Divisibilidad:</strong> Si alguna disposición de estos Términos es declarada inválida, las demás disposiciones permanecerán en plena vigencia.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>No renuncia:</strong> El hecho de que Aether no ejercite algún derecho no implica renuncia al mismo.</p>
          <p><strong style={{ color: 'var(--c-text2)' }}>Contacto:</strong> Para cualquier consulta sobre estos Términos, escríbanos a <strong style={{ color: 'var(--c-text2)' }}>[EMAIL LEGAL]</strong>.</p>
        </Section>

        {/* Footer de navegación */}
        <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(97,71,130,0.07)', display: 'flex', gap: 24, flexWrap: 'wrap' }}>
          <Link href="/legal/privacy" style={{ fontSize: 13, color: 'var(--c-text4)', textDecoration: 'none' }}>Política de Privacidad →</Link>
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
