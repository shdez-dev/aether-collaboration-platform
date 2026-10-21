import Link from 'next/link';
import { LegalDocument, type LegalSection } from '../LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'quien', title: 'Quién trata los datos y en qué contexto', content: <>
      <p>AETHER necesita tratar datos para crear cuentas y permitir la colaboración durante un piloto gratuito por invitación. El operador es <strong>Juan Sebastian Hernandez Rincon</strong>, persona natural establecida en Chile. Las consultas y solicitudes de privacidad pueden enviarse a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. La primera etapa del piloto contempla participantes de Chile y Argentina; la inscripción del responsable en Argentina debe aclararse antes de enviar invitaciones allí.</p>
      <p>El operador administra la cuenta y la infraestructura del servicio. Una organización que utiliza AETHER determina quién integra sus espacios, proyectos, equipos y recursos, y puede decidir qué información incorpora sobre otras personas. Según la ley aplicable y cada operación, la organización puede asumir responsabilidades propias sobre ese contenido; el detalle contractual entre ambas partes requiere revisión jurídica.</p>
    </>,
  },
  {
    id: 'datos', title: 'Qué información recibe AETHER', content: <>
      <ul>
        <li><strong>Cuenta y perfil:</strong> nombre, correo, contraseña transformada mediante hash, avatar si se proporciona, datos de perfil, idioma, zona horaria y estado de verificación.</li>
        <li><strong>Colaboración:</strong> organizaciones, membresías, roles, invitaciones, contactos, presencia, proyectos, iniciativas, equipos, tareas, comentarios, documentos, archivos, versiones, actividad y notificaciones.</li>
        <li><strong>Comunicación y calendario:</strong> mensajes directos, lectura de mensajes, solicitudes de contacto, eventos, horarios, invitados y respuestas a invitaciones.</li>
        <li><strong>Denuncias de usuarios:</strong> identidad de quien reporta y de la persona denunciada, motivo elegido, descripción de lo ocurrido, fecha y estado de revisión.</li>
        <li><strong>Operación técnica:</strong> tokens y eventos de sesión, dirección IP y datos habituales de la solicitud, registros de error y seguridad, y datos necesarios para limitar abuso o solucionar incidencias.</li>
        <li><strong>Integraciones opcionales:</strong> datos y eventos autorizados de GitHub, referencias de repositorios y, si se usa el planificador con IA, el contenido que se envíe para generar una propuesta.</li>
      </ul>
      <p>El nombre, correo y contraseña son necesarios para activar la cuenta. El avatar y otros datos de perfil se aportan si la persona decide configurarlos. El contenido de colaboración depende de lo que cada participante o su organización incorpore; puede incluir datos de otras personas dentro de documentos, archivos, comentarios y eventos. No se deben subir datos sensibles o secretos sin una necesidad y autorización adecuadas.</p>
      <p>La versión actual no procesa pagos de usuarios. Por eso esta política no atribuye a AETHER una recogida de tarjetas o facturación que aún no existe. Tampoco afirma utilizar una plataforma de analítica o publicidad que no se haya identificado en el producto.</p>
    </>,
  },
  {
    id: 'origen', title: 'De dónde proceden los datos', content: <>
      <p>Parte de la información la aporta directamente cada persona al activar su cuenta mediante una invitación o usar una función. Otra información procede de administradores y colaboradores que envían invitaciones, asignan tareas, mencionan personas o comparten contenido. Los eventos de GitHub llegan solo si alguien autorizado conecta esa integración. La API y el navegador generan datos técnicos cuando se accede al servicio.</p>
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
        <li>Recibir y revisar denuncias sobre otras personas, investigar lo comunicado y adoptar medidas proporcionadas cuando corresponda.</li>
        <li>Procesar una solicitud de IA solo cuando la función esté habilitada y la persona la invoque.</li>
      </ul>
      <p>Los datos de cuenta y sesión se usan para prestar el acceso solicitado; los datos de colaboración se usan para mostrar y sincronizar el trabajo con las personas autorizadas; los datos técnicos se usan para operar y proteger el servicio. Los correos se limitan a mensajes relacionados con la cuenta y la colaboración. No se declara aquí una campaña de marketing activa ni una finalidad publicitaria. AETHER no usa los documentos para entrenar un modelo propio.</p>
      <p>La base jurídica concreta de cada operación debe determinarse según el país, el tipo de dato y el papel del operador y la organización. La lectura de esta política no constituye por sí sola consentimiento para usos opcionales. Cuando una finalidad requiera autorización separada, deberá solicitarse antes de realizarla y conservarse prueba de esa decisión.</p>
    </>,
  },
  {
    id: 'visibilidad', title: 'Quién puede ver cada contenido', content: <>
      <p>Los perfiles y la presencia se muestran de acuerdo con las funciones de contactos y colaboración. Un mensaje directo se dirige a su conversación; una invitación personal de calendario se envía a los contactos elegidos aunque pertenezcan a organizaciones distintas. El contenido de una organización, espacio, proyecto o equipo se muestra conforme a sus membresías y permisos específicos. Un administrador no debería asumir acceso universal a todo proyecto o documento solo por pertenecer a la organización.</p>
      <p>Las denuncias enviadas desde Contactos se muestran en el panel de la administración de la plataforma, no en el perfil público ni a la persona denunciada. La información puede comunicarse en la medida necesaria para investigar o responder a una reclamación, conforme a la ley aplicable.</p>
      <p>Quien comparte un archivo, comentario, documento, evento o enlace debe comprobar su audiencia. Quitar a alguien de un recurso limita accesos futuros, pero no puede recuperar copias que esa persona hubiera recibido legítimamente fuera del servicio.</p>
    </>,
  },
  {
    id: 'proveedores', title: 'Proveedores y comunicaciones a terceros', content: <>
      <p>El código permite utilizar <strong>Brevo</strong> para enviar correos transaccionales y, por tanto, comunicarle al menos la dirección de correo y el contenido necesario del mensaje; <strong>Cloudflare R2</strong> o almacenamiento local configurado para guardar archivos; <strong>Groq</strong> para procesar la solicitud y el contenido que una persona envíe al planificador con IA cuando lo active; y <strong>GitHub</strong> para intercambiar datos autorizados de repositorios cuando una organización conecte esa integración. La infraestructura que hospeda la aplicación, PostgreSQL y Redis depende del despliegue y aún debe identificarse en la versión publicada de esta política.</p>
      <p>Estos proveedores reciben solo la información necesaria para la función correspondiente, bajo sus condiciones y la configuración del operador. AETHER no debe vender datos personales ni compartir contenido con fines publicitarios sin una explicación y una base válida. Podría comunicar información ante una obligación legal válida o una solicitud de autoridad competente, con el alcance exigible.</p>
    </>,
  },
  {
    id: 'internacional', title: 'Ubicación y transferencias internacionales', content: <>
      <p>Participar desde Chile o Argentina no significa que los datos se almacenen en ese mismo país. La ubicación efectiva de la base de datos, copias de seguridad, almacenamiento y proveedores puede variar según el despliegue. Por ello no se afirma que todos los datos permanezcan en un país ni que ya existan salvaguardas contractuales concretas. Antes de publicar esta política como definitiva debe documentarse dónde se aloja cada categoría, qué transferencias internacionales se realizan y qué garantías exige cada ley aplicable.</p>
    </>,
  },
  {
    id: 'conservacion', title: 'Conservación y eliminación', content: <>
      <p>Los <strong>mensajes directos vencen a los 30 días</strong>; un trabajo periódico elimina los mensajes caducados y puede retirar conversaciones antiguas que ya no contienen mensajes. Las cuentas y el contenido compartido se conservan mientras sean necesarios para prestar el servicio y gestionar los recursos que siguen activos, salvo una obligación o derecho que requiera otro tratamiento. La retirada de acceso a un proyecto no implica por sí sola la eliminación del contenido que permanece compartido con el equipo.</p>
      <p>Documentos, actividad, notificaciones, denuncias, registros técnicos, respaldos y archivos no tienen en el código una única regla comprobada de eliminación a 90 días o 12 meses. Sus plazos específicos y el ciclo de respaldos deben definirse antes de publicar esta política. Solicitar el cierre de una cuenta no implica borrar automáticamente aportes compartidos que otras personas o la organización deban conservar; cada caso se evaluará según permisos y derechos aplicables.</p>
      <p>Desde «Mi perfil» puede solicitarse la eliminación de la cuenta tras confirmar la contraseña. El acceso se desactiva al aceptar la solicitud y los datos asociados se procesan por lotes. Si la persona todavía es propietaria de organizaciones, espacios o proyectos activos, debe transferirlos o eliminarlos antes de solicitar la baja. Se eliminan las conversaciones directas en las que participaba, incluidas las copias visibles para otros participantes. Las aportaciones que deban permanecer en recursos de proyecto compartidos se desvinculan del perfil; los datos personales incluidos en el propio contenido compartido pueden requerir una revisión específica. La eliminación de copias de respaldo seguirá el plazo que se defina para la infraestructura.</p>
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
      <p>Para ejercer estos derechos, retirar una autorización cuando proceda o plantear una consulta, escriba a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>, describiendo su solicitud y el correo asociado a la cuenta, sin incluir contraseñas ni más datos de los necesarios. El operador podrá pedir información adicional para verificar identidad cuando corresponda, confirmar la recepción y responder según los plazos de la ley aplicable. Si los datos forman parte de recursos administrados por una organización, puede ser necesario coordinar la respuesta con ella. El procedimiento detallado y las autoridades competentes para Chile y Argentina deben completarse tras la revisión jurídica. No se promete una exportación integral automática ni un plazo de respuesta universal sin base jurídica verificada.</p>
    </>,
  },
  {
    id: 'ia-menores', title: 'IA, decisiones y menores', content: <>
      <p>El planificador con IA propone estructuras de trabajo, pero una persona decide si las utiliza. Esta política no describe una decisión automatizada con efectos jurídicos sobre las personas. Quien lo use debe revisar el resultado y valorar qué información comparte con el proveedor.</p>
      <p>El piloto está pensado para personas adultas, pero el formulario actual aún no comprueba la edad. Antes de presentar una edad mínima como condición vigente deben definirla e implementar su comprobación y un mecanismo para atender solicitudes relacionadas con menores. AETHER no está diseñada como un servicio dirigido específicamente a niñas o niños.</p>
    </>,
  },
  {
    id: 'cambios', title: 'Cambios y contacto', content: <>
      <p>Las modificaciones materiales de esta política deberán comunicarse por un medio apropiado antes de que entren en vigor cuando la ley lo requiera. Se conservará una fecha de vigencia y acceso a la versión aplicable. La revisión indicada arriba solo fecha este borrador, no su entrada en vigor.</p>
      <p>Operador: Juan Sebastian Hernandez Rincon, persona natural establecida en Chile. Contacto: <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. Antes de publicar una versión definitiva deben confirmarse las ubicaciones de alojamiento, las transferencias, la retención de categorías distintas del chat, las bases jurídicas por operación y el procedimiento detallado de solicitudes. Antes de invitar en Argentina debe aclararse la inscripción del responsable y la información que debe proporcionarse a las personas participantes. Consulte también los <Link href="/legal/terms">Términos de servicio</Link> y la <Link href="/legal/aup">Política de uso aceptable</Link>.</p>
    </>,
  },
];

export default function PrivacyPage() {
  return <LegalDocument current="privacy" title="Política de privacidad" lead="Qué datos intervienen en la colaboración, quién puede verlos y qué falta confirmar antes de publicar una versión definitiva." sections={sections} />;
}
