import Link from 'next/link';
import { LegalDocument, type LegalSection } from '../LegalDocument';

const sections: LegalSection[] = [
  {
    id: 'alcance', title: 'Alcance y responsable del servicio', content: <>
      <p>Estos términos describen el uso de AETHER, una plataforma de colaboración para personas, equipos y organizaciones. Se aplican a la cuenta personal, las organizaciones, los espacios de trabajo y las funciones a las que cada persona accede. La <Link href="/legal/privacy">Política de privacidad</Link> explica el tratamiento de datos y la <Link href="/legal/aup">Política de uso aceptable</Link> establece las reglas de conducta.</p>
      <p>AETHER es operado por <strong>Juan Sebastian Hernandez Rincon</strong>, persona natural establecida en Chile. El contacto público para consultas sobre el servicio y estas condiciones es <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. El piloto gratuito se organiza por invitación para participantes de Chile y Argentina. Antes de invitar en Argentina debe aclararse la inscripción del responsable ante la autoridad de protección de datos. Una invitación individual desde otro país requiere revisar previamente las reglas que puedan aplicarse allí.</p>
      <p>El operador está establecido en Chile. La ley y la autoridad o tribunal aplicables a una controversia se determinarán conforme a las normas correspondientes, incluidas las protecciones imperativas del país de la persona participante cuando procedan. Estas condiciones no obligan a renunciar a esos derechos.</p>
    </>,
  },
  {
    id: 'servicio', title: 'Qué ofrece AETHER hoy', content: <>
      <p>AETHER es un MVP en evolución. Permite crear organizaciones y espacios de trabajo, gestionar iniciativas y proyectos, tableros y tareas, equipos, documentos colaborativos, calendarios, contactos, conversaciones y notificaciones. Algunas capacidades, como portafolios, seguimiento institucional, redes, integración con GitHub y asistencia con IA, dependen de la configuración y de las capacidades habilitadas en cada organización.</p>
      <p>Las funciones pueden cambiar a medida que evoluciona el producto. Una función prevista en el catálogo de planes no equivale a una garantía de disponibilidad en todas las cuentas. Los cambios materiales que afecten acceso o contenido deberán informarse con antelación razonable cuando sea posible.</p>
    </>,
  },
  {
    id: 'cuentas', title: 'Cuenta, acceso y seguridad', content: <>
      <p>El piloto es gratuito y está destinado a participantes invitados. Para crear una cuenta nueva se necesita un enlace vigente enviado al correo invitado. Una invitación no garantiza acceso a recursos fuera de los permisos concedidos. Cada persona debe proteger sus credenciales, no compartir su sesión y avisar si sospecha un acceso no autorizado. Los permisos se comprueban también en la API: pertenecer a una organización no concede automáticamente acceso a todos sus espacios, proyectos o documentos.</p>
      <p>Quien cree o administre una organización debe contar con autoridad para hacerlo y para invitar, asignar roles o administrar recursos en nombre de ella. El piloto está pensado para personas adultas; la edad mínima y su comprobación en el registro aún deben definirse e implementarse antes de imponer una restricción de edad como condición vigente.</p>
      <p>Al activar una cuenta nueva se solicita confirmar por separado la lectura de estos términos y de la política de privacidad. La política de uso aceptable forma parte de las reglas de uso de AETHER. La confirmación de lectura de la política de privacidad no equivale a autorizar cualquier finalidad opcional de tratamiento de datos.</p>
    </>,
  },
  {
    id: 'organizaciones', title: 'Organizaciones, espacios y permisos', content: <>
      <p>Una persona puede pertenecer a varias organizaciones. Cada organización administra miembros, roles, invitaciones, espacios y capacidades. Un espacio define el contexto de colaboración; un proyecto puede limitar su acceso a miembros directos, equipos asignados, responsables y otros permisos específicos. Un documento puede ser del espacio o estar vinculado a un proyecto concreto.</p>
      <p>Las personas administradoras deben configurar el acceso con cuidado, obtener autorización para invitar a terceros y revisar quién puede ver, editar o compartir información. La eliminación de una organización requiere las condiciones y confirmaciones del producto, incluida la ausencia de espacios de trabajo. Quien abandona una organización puede perder acceso al contenido compartido aunque conserve su cuenta personal.</p>
    </>,
  },
  {
    id: 'colaboracion', title: 'Colaboración, contactos y eventos', content: <>
      <p>Comentarios, documentos, tareas y cambios pueden ser visibles para quienes tengan permiso sobre el recurso. Contactos y mensajes directos conectan personas, incluso fuera de una misma organización. La presencia comunica el estado que cada persona elige mostrar y no certifica su disponibilidad real.</p>
      <p>Los eventos personales pueden invitar a contactos elegibles. Una invitación no se incorpora al calendario de otra persona como evento aceptado hasta que ella responda. Los eventos de espacio o equipo siguen las reglas de acceso de su contexto. AETHER puede mostrar solapamientos de horario, pero no garantiza que una persona esté libre ni que asistirá.</p>
    </>,
  },
  {
    id: 'contenido', title: 'Contenido y propiedad intelectual', content: <>
      <p>Quien crea o incorpora contenido conserva los derechos que le correspondan sobre textos, fotografías, imágenes, archivos, documentos y demás material. Antes de subirlo, insertarlo o compartirlo debe contar con los derechos o permisos necesarios para ese uso y para el acceso de las personas invitadas. Que una imagen esté disponible en Internet o pueda descargarse gratis no significa que se pueda reutilizar sin condiciones: deben respetarse su licencia, la atribución exigida y, cuando corresponda, los derechos de las personas reconocibles, marcas u obras representadas.</p>
      <p>Al incorporar contenido, la persona concede al operador de AETHER una autorización no exclusiva y sin pago adicional, limitada a alojarlo, copiarlo técnicamente, convertirlo o redimensionarlo para vistas previas, transmitirlo, mostrarlo a quienes tengan acceso según la configuración del recurso y mantener respaldos y seguridad. Estas operaciones podrán realizarse mediante proveedores técnicos que actúen para prestar el servicio, conforme a la <Link href="/legal/privacy">Política de privacidad</Link>. Esta autorización dura mientras el contenido deba permanecer en el servicio según su finalidad, las decisiones de quienes administran el recurso y los plazos de conservación aplicables. No transfiere la propiedad del contenido ni autoriza a AETHER a venderlo, usarlo en publicidad o publicarlo fuera de los permisos configurados.</p>
      <p>Si una persona considera que una imagen u otro contenido vulnera sus derechos, puede solicitar su revisión mediante el procedimiento de la <Link href="/legal/aup#reportes">Política de uso aceptable</Link>. AETHER podrá restringir el acceso o retirar el material cuando corresponda, sin decidir por ese solo hecho quién es su titular definitivo.</p>
      <p>La marca, la interfaz y el software de AETHER pertenecen a sus titulares respectivos. Estos términos no transfieren su propiedad. Las sugerencias enviadas al equipo de AETHER podrán considerarse para mejorar el producto, sin presumir una cesión exclusiva de los derechos sobre ellas.</p>
    </>,
  },
  {
    id: 'integraciones', title: 'Integraciones y asistencia con IA', content: <>
      <p>Si una organización conecta GitHub, la integración recibirá los eventos autorizados y los utilizará para mostrar actividad relacionada con el trabajo. Quien la configure debe tener permiso para conectar el repositorio y puede desconectarla desde las herramientas disponibles. GitHub mantiene sus propias condiciones.</p>
      <p>Cuando se habilita y se usa expresamente el planificador con IA, la información enviada para generar una propuesta puede transmitirse al proveedor configurado. Sus resultados son sugerencias que una persona debe revisar antes de aplicarlas: pueden contener errores u omisiones. No se debe introducir información sensible o de terceros sin autorización y una evaluación apropiada de privacidad.</p>
    </>,
  },
  {
    id: 'planes', title: 'Planes, límites y cobros', content: <>
      <p>AETHER continúa como <strong>piloto gratuito por invitación</strong>, sin cobros activos. Las personas participantes pueden invitar a otras dentro de las capacidades habilitadas para su organización. El código contempla un catálogo de planes y capacidades, pero eso no significa que exista una contratación de pago disponible ni que haya renovación automática, facturación o reembolsos aplicables hoy. Los límites técnicos y las funciones habilitadas pueden variar según la configuración de cada organización.</p>
      <p>Si en el futuro se ofrecen planes pagados, precios, impuestos, período, medios de pago, renovación y cancelación deberán comunicarse antes de contratar y aceptarse mediante condiciones específicas. No se aplicarán cargos por el mero hecho de usar este MVP.</p>
    </>,
  },
  {
    id: 'disponibilidad', title: 'Disponibilidad, cambios y respaldo', content: <>
      <p>Por tratarse de un MVP, AETHER puede experimentar mantenimiento, interrupciones y cambios. No se ofrece en este piloto un acuerdo de nivel de servicio ni una garantía de operación continua. AETHER debe adoptar medidas razonables para proteger el servicio y atender incidentes, sin prometer ausencia absoluta de fallos o pérdida de información.</p>
      <p>Las organizaciones deben conservar copias de la información crítica cuando sus procesos lo requieran. Algunas funciones permiten exportar documentos o informes, pero no debe asumirse que existe una exportación integral de toda la cuenta. La política operativa de respaldos y los plazos de recuperación deben definirse antes de una oferta contractual definitiva.</p>
    </>,
  },
  {
    id: 'conducta', title: 'Uso permitido y actuación ante abusos', content: <>
      <p>El uso de AETHER debe cumplir la ley, los derechos de otras personas y la <Link href="/legal/aup">Política de uso aceptable</Link>. No se permite usar invitaciones, contactos, chat, documentos, archivos, automatizaciones o integraciones para acosar, enviar spam, acceder sin permiso, distribuir software dañino o vulnerar derechos de terceros.</p>
      <p>Ante un riesgo de seguridad, una obligación legal o un incumplimiento grave, el operador podrá limitar acceso, retirar contenido o suspender recursos en la medida necesaria. Cuando sea razonable y seguro, deberá explicar el motivo y permitir corregir o impugnar una medida. No se promete un plazo de apelación que aún no está implementado.</p>
    </>,
  },
  {
    id: 'salida', title: 'Salida, eliminación y contenido compartido', content: <>
      <p>Una organización puede retirar miembros y, bajo las condiciones del producto, eliminar sus espacios y la organización. La salida de una persona no elimina automáticamente documentos, mensajes o actividad que otras personas necesitan para continuar el trabajo compartido. La persona puede solicitar la eliminación de su cuenta desde su perfil, después de transferir o eliminar los recursos que administra. La eliminación se procesa por etapas; el contenido de proyectos compartidos puede permanecer desvinculado de su perfil. Aún no existe una exportación integral de autoservicio; para revisar datos personales presentes en contenido compartido o solicitar asistencia puede escribir a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>.</p>
      <p>Los mensajes directos tienen una caducidad de 30 días y un proceso periódico elimina los vencidos. Otras categorías siguen los criterios explicados en la <Link href="/legal/privacy">Política de privacidad</Link>. Ninguna disposición autoriza conservar datos sin límite o impedir derechos legales de sus titulares.</p>
    </>,
  },
  {
    id: 'responsabilidad', title: 'Responsabilidades y derechos irrenunciables', content: <>
      <p>Cada persona responde por la legalidad del contenido que incorpora y por el uso de sus permisos. AETHER responde conforme a la ley aplicable por sus propias obligaciones. Estas condiciones no fijan topes monetarios de responsabilidad ni excluyen derechos irrenunciables de usuarios o titulares de datos.</p>
      <p>Las controversias pueden plantearse primero mediante el canal de contacto legal, sin impedir que una persona recurra directamente a la autoridad o al tribunal competente cuando la ley lo permita.</p>
    </>,
  },
  {
    id: 'cambios', title: 'Actualizaciones y contacto', content: <>
      <p>La versión vigente deberá mostrar su fecha de entrada en vigor y conservar un acceso claro a los cambios relevantes. Antes de aplicar cambios materiales se informará mediante un medio apropiado y se ofrecerá la opción legalmente exigible de dejar de utilizar el servicio. La simple publicación de un texto no sustituye los avisos o consentimientos que la ley requiera.</p>
      <p>El operador es Juan Sebastian Hernandez Rincon, persona natural establecida en Chile. Puede escribir a <a href="mailto:sebastian@shernandez.dev">sebastian@shernandez.dev</a>. La fecha de entrada en vigor se publicará al aprobar una versión definitiva para el piloto. Para asuntos de datos personales, consulte la <Link href="/legal/privacy">Política de privacidad</Link>; para denuncias de abuso, la <Link href="/legal/aup">Política de uso aceptable</Link>.</p>
    </>,
  },
];

export default function TermsPage() {
  return <LegalDocument current="terms" title="Términos de servicio" lead="Cómo funciona la relación entre AETHER, las personas y las organizaciones que colaboran en la plataforma." sections={sections} />;
}
