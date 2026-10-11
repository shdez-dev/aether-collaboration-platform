import Link from 'next/link';
import { LegalDocument, type LegalSection } from '../LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'proposito', title: 'Propósito y alcance', content: <>
      <p>Esta política establece cómo usar el piloto gratuito y por invitación de AETHER sin perjudicar a otras personas, organizaciones o a la infraestructura. Abarca cuentas, espacios, proyectos, documentos, archivos, invitaciones, chat, calendario, IA e integraciones. Complementa los <Link href="/legal/terms">Términos de servicio</Link> y se aplica también a quienes actúan por cuenta de una organización.</p>
      <p>El uso ordinario para coordinar equipos, planificar iniciativas, crear documentos y comunicarse con contactos está permitido siempre que se respeten los permisos y la ley aplicable. Una función disponible técnicamente no autoriza un uso que vulnere derechos ajenos.</p>
    </>,
  },
  {
    id: 'legalidad', title: 'Legalidad y derechos de terceros', content: <>
      <ul>
        <li>No usar AETHER para delitos, fraude, suplantación, estafas, amenazas o actividades que vulneren la ley.</li>
        <li>No subir ni compartir material que infrinja derechos de autor, marcas, secretos comerciales, contratos de confidencialidad u otros derechos sin autorización.</li>
        <li>No divulgar datos personales, secretos o documentos privados de terceros sin una razón legítima y los permisos necesarios.</li>
        <li>Está prohibido cualquier material de explotación o abuso sexual infantil. Los reportes de este tipo se tratarán con prioridad y podrán comunicarse a autoridades competentes según la ley.</li>
      </ul>
    </>,
  },
  {
    id: 'personas', title: 'Respeto a otras personas', content: <>
      <p>No se permite acosar, intimidar, amenazar, discriminar, difamar ni dirigir odio o violencia contra personas o grupos. Esta regla se aplica a nombres de proyectos, documentos, comentarios, etiquetas, perfiles, imágenes y mensajes. El desacuerdo profesional o una evaluación crítica de trabajo no son por sí mismos un incumplimiento; importan el contexto y el daño causado.</p>
      <p>Queda prohibido hacerse pasar por otra persona o institución, ocultar la identidad para engañar o usar el acceso a una organización para hostigar a sus integrantes.</p>
    </>,
  },
  {
    id: 'comunicaciones', title: 'Invitaciones, contactos y calendario', content: <>
      <p>Las invitaciones a organizaciones, espacios, equipos y eventos personales deben enviarse a personas con las que exista una relación legítima. No se permite utilizar búsquedas de personas, contactos, mensajes, menciones, notificaciones o eventos para enviar spam, publicidad no solicitada, campañas masivas o intentos repetidos de contacto tras un rechazo.</p>
      <p>Una invitación de calendario no autoriza a presentar la asistencia como confirmada. No se deben utilizar títulos o descripciones de eventos para engañar, extraer datos ni divulgar horarios privados de otros invitados.</p>
    </>,
  },
  {
    id: 'seguridad', title: 'Cuentas, acceso y pruebas de seguridad', content: <>
      <ul>
        <li>No intentar acceder a cuentas, proyectos, documentos, repositorios o datos fuera de los permisos concedidos, incluso si una URL o respuesta técnica los expone por error.</li>
        <li>No compartir credenciales, tokens de sesión, secretos de integración ni mecanismos para eludir autenticación o restricciones de acceso.</li>
        <li>No introducir malware, ransomware, código dañino ni enlaces que busquen robar credenciales o comprometer dispositivos.</li>
        <li>No realizar ataques de denegación de servicio, escaneos invasivos ni pruebas que comprometan datos o disponibilidad sin autorización expresa.</li>
      </ul>
      <p>Si alguien encuentra una vulnerabilidad, debe detener las pruebas antes de acceder a datos ajenos, conservar una descripción mínima para reportarla y escribir a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. No se promete un programa de recompensas o inmunidad legal inexistente.</p>
    </>,
  },
  {
    id: 'recursos', title: 'Automatización y recursos compartidos', content: <>
      <p>No se permite usar bots, scripts, scrapers o llamadas automatizadas de manera que eludan límites, recolecten perfiles o contenido ajeno, generen carga desproporcionada o degraden el servicio. La automatización autorizada debe respetar permisos, límites técnicos y las instrucciones del operador.</p>
      <p>No crear cuentas u organizaciones repetidas para evitar una suspensión, fingir identidades o ampliar artificialmente una capacidad. Tampoco almacenar archivos o datos ajenos al propósito de colaboración de forma que se utilice AETHER como infraestructura de distribución abusiva.</p>
    </>,
  },
  {
    id: 'integraciones', title: 'GitHub, archivos e IA', content: <>
      <p>Solo se pueden conectar repositorios de GitHub sobre los que se tenga autoridad. No deben incorporarse secretos, claves privadas o datos confidenciales en webhooks, documentos, tareas o prompts de IA salvo que exista necesidad legítima y medidas adecuadas. Desconectar una integración no elimina automáticamente la actividad que ya se incorporó legítimamente a un proyecto.</p>
      <p>La asistencia con IA no debe usarse para generar contenido ilícito, suplantaciones o instrucciones de daño. Su resultado requiere revisión humana y no sustituye decisiones profesionales, legales o de seguridad.</p>
    </>,
  },
  {
    id: 'reportes', title: 'Cómo reportar un problema', content: <>
      <p>Una denuncia útil identifica el recurso o la cuenta, describe la conducta, indica cuándo ocurrió y aporta solo la evidencia necesaria. No debe difundirse públicamente información privada o una vulnerabilidad para demostrar el problema. Los reportes de abuso y seguridad pueden enviarse a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>.</p>
      <p>Los reportes se evaluarán según la gravedad, el contexto y la información disponible. Presentar una denuncia deliberadamente falsa para perjudicar a alguien también puede constituir abuso.</p>
    </>,
  },
  {
    id: 'respuesta', title: 'Medidas ante incumplimientos', content: <>
      <p>La respuesta puede incluir advertir, solicitar corrección, limitar funciones, retirar contenido, suspender acceso o cancelar una cuenta u organización cuando esté justificado. Una amenaza inmediata para personas, datos o infraestructura puede requerir una medida sin aviso previo. Las medidas deben ser proporcionadas y no sustituir las obligaciones legales de conservación o notificación.</p>
      <p>Cuando sea seguro hacerlo, se informará el motivo y cómo solicitar una revisión mediante <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. El procedimiento y los plazos de apelación deben definirse antes de publicar esta política como definitiva. Ante hechos potencialmente delictivos, el operador podrá cooperar con autoridades competentes conforme a la ley.</p>
    </>,
  },
  {
    id: 'cambios', title: 'Cambios y documentos relacionados', content: <>
      <p>El operador del servicio es Juan Sebastian Hernandez Rincon y el canal público de contacto es <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. Esta política aún requiere una fecha de entrada en vigor y revisión jurídica. Los cambios materiales se comunicarán por un medio apropiado. La revisión indicada arriba identifica este borrador, no lo convierte en versión contractual definitiva.</p>
      <p>Para reglas sobre cuentas, contenido y disponibilidad consulte los <Link href="/legal/terms">Términos de servicio</Link>. Para saber qué datos se tratan y cómo solicitar acceso o eliminación consulte la <Link href="/legal/privacy">Política de privacidad</Link>.</p>
    </>,
  },
];

export default function AcceptableUsePage() {
  return <LegalDocument current="aup" title="Política de uso aceptable" lead="Reglas para colaborar con seguridad, respetar a otras personas y proteger los espacios de trabajo." sections={sections} />;
}
