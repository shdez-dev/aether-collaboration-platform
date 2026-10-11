import Link from 'next/link';
import { LegalDocument, type LegalSection } from '../LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'quien', title: 'Quién trata los datos y en qué contexto', content: <>
      <p>AETHER necesita tratar datos para crear cuentas y permitir la colaboración durante un piloto gratuito por invitación. El operador es <strong>Juan Sebastian Hernandez Rincon</strong>, persona natural residente en Chile. Las consultas y solicitudes de privacidad pueden enviarse a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. El domicilio legal aún requiere confirmación antes de publicar esta política como definitiva.</p>
      <p>El operador administra la cuenta y la infraestructura del servicio. Una organización que utiliza AETHER determina quién integra sus espacios, proyectos, equipos y recursos, y puede decidir qué información incorpora sobre otras personas. Según la ley aplicable y cada operación, la organización puede asumir responsabilidades propias sobre ese contenido; el detalle contractual entre ambas partes requiere revisión jurídica.</p>
    </>,
  },
  {
    id: 'datos', title: 'Qué información recibe AETHER', content: <>
      <ul>
        <li><strong>Cuenta y perfil:</strong> nombre, correo, contraseña transformada mediante hash, avatar si se proporciona, datos de perfil, idioma, zona horaria y estado de verificación.</li>
        <li><strong>Colaboración:</strong> organizaciones, membresías, roles, invitaciones, contactos, presencia, proyectos, iniciativas, equipos, tareas, comentarios, documentos, archivos, versiones, actividad y notificaciones.</li>
        <li><strong>Comunicación y calendario:</strong> mensajes directos, lectura de mensajes, solicitudes de contacto, eventos, horarios, invitados y respuestas a invitaciones.</li>
        <li><strong>Operación técnica:</strong> tokens y eventos de sesión, dirección IP y datos habituales de la solicitud, registros de error y seguridad, y datos necesarios para limitar abuso o solucionar incidencias.</li>
        <li><strong>Integraciones opcionales:</strong> datos y eventos autorizados de GitHub, referencias de repositorios y, si se usa el planificador con IA, el contenido que se envíe para generar una propuesta.</li>
      </ul>
      <p>La versión actual no procesa pagos de usuarios. Por eso esta política no atribuye a AETHER una recogida de tarjetas o facturación que aún no existe. Tampoco afirma utilizar una plataforma de analítica o publicidad que no se haya identificado en el producto.</p>
    </>,
  },
  {
    id: 'origen', title: 'De dónde proceden los datos', content: <>
      <p>Parte de la información la aporta directamente cada persona al registrarse o usar una función. El piloto está destinado a participantes invitados, aunque el formulario de registro todavía no exige una invitación. Otra información procede de administradores y colaboradores que envían invitaciones, asignan tareas, mencionan personas o comparten contenido. Los eventos de GitHub llegan solo si alguien autorizado conecta esa integración. La API y el navegador generan datos técnicos cuando se accede al servicio.</p>
      <p>Quien incorpore datos de terceros, especialmente en documentos, contactos o eventos, debe contar con una razón legítima y respetar sus permisos y expectativas de privacidad.</p>
    </>,
  },
  {
    id: 'finalidades', title: 'Para qué se usa la información', content: <>
      <ul>
        <li>Crear y verificar cuentas, autenticar sesiones, recuperar acceso y proteger la plataforma.</li>
        <li>Mostrar el trabajo a quienes tienen permisos, sincronizar documentos, enviar mensajes y gestionar invitaciones y eventos.</li>
        <li>Enviar correos transaccionales de verificación, recuperación e invitación y notificaciones relacionadas con la colaboración.</li>
        <li>Registrar actividad relevante, detectar fallos y abuso, atender solicitudes y cumplir obligaciones legales aplicables.</li>
        <li>Procesar una solicitud de IA solo cuando la función esté habilitada y la persona la invoque.</li>
      </ul>
      <p>La justificación jurídica concreta de cada operación depende de la jurisdicción y del papel del operador y la organización. Puede incluir la prestación solicitada, obligaciones legales, intereses legítimos ponderados o un consentimiento separado cuando corresponda. Usar AETHER no equivale por sí solo a consentir cualquier tratamiento opcional ni comunicaciones comerciales. No se declara aquí una campaña de marketing activa.</p>
    </>,
  },
  {
    id: 'visibilidad', title: 'Quién puede ver cada contenido', content: <>
      <p>Los perfiles y la presencia se muestran de acuerdo con las funciones de contactos y colaboración. Un mensaje directo se dirige a su conversación; una invitación personal de calendario se envía a los contactos elegidos aunque pertenezcan a organizaciones distintas. El contenido de una organización, espacio, proyecto o equipo se muestra conforme a sus membresías y permisos específicos. Un administrador no debería asumir acceso universal a todo proyecto o documento solo por pertenecer a la organización.</p>
      <p>Quien comparte un archivo, comentario, documento, evento o enlace debe comprobar su audiencia. Quitar a alguien de un recurso limita accesos futuros, pero no puede recuperar copias que esa persona hubiera recibido legítimamente fuera del servicio.</p>
    </>,
  },
  {
    id: 'proveedores', title: 'Proveedores y comunicaciones a terceros', content: <>
      <p>El código permite utilizar <strong>Brevo</strong> para correo transaccional; <strong>Cloudflare R2</strong> o almacenamiento local configurado para archivos; <strong>Groq</strong> para el planificador con IA cuando se habilita; y <strong>GitHub</strong> cuando una organización conecta repositorios. La infraestructura que hospeda la aplicación y la base de datos depende del despliegue y aún debe identificarse en la versión publicada de esta política.</p>
      <p>Estos proveedores reciben solo la información necesaria para la función correspondiente, bajo sus condiciones y la configuración del operador. AETHER no debe vender datos personales ni compartir contenido con fines publicitarios sin una explicación y una base válida. Podría comunicar información ante una obligación legal válida o una solicitud de autoridad competente, con el alcance exigible.</p>
    </>,
  },
  {
    id: 'internacional', title: 'Ubicación y transferencias internacionales', content: <>
      <p>La ubicación efectiva de la base de datos, copias de seguridad, almacenamiento y proveedores puede variar según el despliegue. Por ello no se afirma que todos los datos permanezcan en un país ni que ya existan salvaguardas contractuales concretas. Antes de la publicación definitiva debe documentarse dónde se aloja cada categoría, qué transferencias internacionales se realizan y qué garantías exige la ley aplicable.</p>
    </>,
  },
  {
    id: 'conservacion', title: 'Conservación y eliminación', content: <>
      <p>Los <strong>mensajes directos vencen a los 30 días</strong>; un trabajo periódico elimina los mensajes caducados y puede retirar conversaciones antiguas que ya no contienen mensajes. Las cuentas y el contenido compartido se conservan mientras sean necesarios para prestar el servicio y gestionar los recursos que siguen activos, salvo una obligación o derecho que requiera otro tratamiento.</p>
      <p>Documentos, actividad, notificaciones, registros técnicos, respaldos y archivos no tienen en el código una única regla comprobada de eliminación a 90 días o 12 meses. Sus plazos específicos y el ciclo de respaldos deben definirse antes de publicar esta política. Solicitar el cierre de una cuenta no implica borrar automáticamente aportes compartidos que otras personas o la organización deban conservar; cada caso se evaluará según permisos y derechos aplicables.</p>
    </>,
  },
  {
    id: 'seguridad', title: 'Seguridad y límites reales', content: <>
      <p>El registro transforma las contraseñas mediante bcrypt; la API exige autenticación para las rutas protegidas y verifica permisos de recursos. Los tokens de sesión tienen mecanismos de expiración y renovación. Las conexiones HTTPS, los respaldos y el control de acceso a infraestructura dependen también del despliegue y deben verificarse operativamente. Ninguna medida elimina todo riesgo.</p>
      <p>Si se detecta un incidente de seguridad que afecte datos personales, el operador deberá investigarlo, contenerlo y realizar las notificaciones exigidas por la ley aplicable. No se promete aquí un plazo o certificación que no estén definidos.</p>
    </>,
  },
  {
    id: 'navegador', title: 'Cookie, almacenamiento local y preferencias', content: <>
      <p>La aplicación utiliza una cookie ligera llamada <strong>aether_session</strong> para que el middleware detecte una sesión iniciada. No contiene el token de acceso. El navegador guarda los tokens y algunos estados de la aplicación en <strong>localStorage</strong>, incluidos datos de autenticación, preferencias de tema, espacio activo y ciertos estados de interfaz. Estos datos pueden persistir hasta el cierre de sesión, su eliminación o la limpieza del navegador.</p>
      <p>Quien comparta un dispositivo debe cerrar sesión al terminar. Bloquear la cookie o el almacenamiento local puede impedir que funcionen áreas privadas. El código revisado no acredita cookies publicitarias ni de analítica opcional; si se incorporan, esta política y los controles de consentimiento deberán actualizarse antes de activarlas.</p>
    </>,
  },
  {
    id: 'derechos', title: 'Derechos y solicitudes', content: <>
      <p>Según la ley aplicable, una persona puede solicitar información sobre el tratamiento, acceso, corrección, eliminación, oposición, limitación o portabilidad de sus datos, y retirar un consentimiento cuando exista. La respuesta puede requerir verificar identidad y distinguir los datos de su cuenta de los que administra una organización o pertenecen a otras personas.</p>
      <p>Para ejercer estos derechos o plantear una consulta, escriba a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>, describiendo su solicitud sin incluir credenciales ni más datos de los necesarios. El operador podrá pedir información adicional para verificar identidad cuando corresponda. El procedimiento detallado y la autoridad de control competente deben completarse tras la revisión jurídica. No se promete una exportación integral automática ni un plazo de respuesta universal sin base jurídica verificada.</p>
    </>,
  },
  {
    id: 'ia-menores', title: 'IA, decisiones y menores', content: <>
      <p>El planificador con IA propone estructuras de trabajo, pero una persona decide si las utiliza. Esta política no describe una decisión automatizada con efectos jurídicos sobre las personas. Quien lo use debe revisar el resultado y valorar qué información comparte con el proveedor.</p>
      <p>Se propone que el piloto esté dirigido a personas mayores de 18 años, pero el formulario actual aún no comprueba la edad. Antes de presentar esa restricción como vigente deben confirmarse la regla e implementarse su comprobación y un mecanismo para atender solicitudes relacionadas con menores. AETHER no está diseñada como un servicio dirigido específicamente a niñas o niños.</p>
    </>,
  },
  {
    id: 'cambios', title: 'Cambios y contacto', content: <>
      <p>Las modificaciones materiales de esta política deberán comunicarse por un medio apropiado antes de que entren en vigor cuando la ley lo requiera. Se conservará una fecha de vigencia y acceso a la versión aplicable. La revisión indicada arriba solo fecha este borrador, no su entrada en vigor.</p>
      <p>Operador: Juan Sebastian Hernandez Rincon. Contacto: <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. Antes de publicar una versión definitiva deben confirmarse el domicilio legal, la jurisdicción, las ubicaciones de alojamiento, las transferencias, la retención de categorías distintas del chat y el procedimiento detallado de solicitudes. Consulte también los <Link href="/legal/terms">Términos de servicio</Link> y la <Link href="/legal/aup">Política de uso aceptable</Link>.</p>
    </>,
  },
];

export default function PrivacyPage() {
  return <LegalDocument current="privacy" title="Política de privacidad" lead="Qué datos intervienen en la colaboración, quién puede verlos y qué falta confirmar antes de publicar una versión definitiva." sections={sections} />;
}
