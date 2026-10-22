// apps/api/src/services/DocumentTemplateService.ts

import * as Y from 'yjs';

/**
 * DocumentTemplateService
 * Servicio para gestionar plantillas profesionales de documentos
 */

export type TemplateCategory =
  | 'meeting-notes'
  | 'project-brief'
  | 'technical-spec'
  | 'retrospective'
  | 'project-documentation'
  | 'software-vision-scope'
  | 'software-requirements'
  | 'software-architecture'
  | 'software-test-plan'
  | 'software-release-plan'
  | 'software-operations-guide'
  | 'software-outcome-measurement'
  | 'quick-note'
  | 'decision-record'
  | 'ai-builder';

export interface DocumentTemplate {
  id: TemplateCategory;
  name: string;
  description: string;
  icon: string;
  category: string;
  getContent: (metadata?: any) => any; // Retorna estructura ProseMirror/TipTap
}

export class DocumentTemplateService {
  /**
   * Obtener todas las plantillas disponibles
   */
  getAvailableTemplates(): Omit<DocumentTemplate, 'getContent'>[] {
    return [
      {
        id: 'meeting-notes',
        name: 'Meeting Notes',
        description: 'Structured template for team meetings with agenda, notes, and action items',
        icon: 'MessageSquare',
        category: 'Collaboration',
      },
      {
        id: 'project-brief',
        name: 'Project Brief',
        description: 'Comprehensive project overview with goals, scope, and timeline',
        icon: 'ClipboardList',
        category: 'Project Management',
      },
      {
        id: 'technical-spec',
        name: 'Technical Specification',
        description: 'Detailed technical documentation for software features',
        icon: 'Settings',
        category: 'Engineering',
      },
      {
        id: 'retrospective',
        name: 'Sprint Retrospective',
        description: 'Agile retrospective template for team reflection',
        icon: 'RotateCcw',
        category: 'Agile',
      },
      {
        id: 'project-documentation',
        name: 'Complete Project Documentation',
        description:
          'Comprehensive project documentation with adaptive sections based on project type',
        icon: 'BookOpen',
        category: 'Documentation',
      },
      {
        id: 'software-vision-scope',
        name: 'Visión y alcance',
        description: 'Problema, objetivo, límites, personas involucradas y criterios de éxito.',
        icon: 'Compass',
        category: 'Software',
      },
      {
        id: 'software-requirements',
        name: 'Requisitos y criterios de aceptación',
        description: 'Necesidades funcionales, calidad esperada y forma de validación.',
        icon: 'ListChecks',
        category: 'Software',
      },
      {
        id: 'software-architecture',
        name: 'Arquitectura y decisiones técnicas',
        description: 'Componentes, datos, integraciones, seguridad y decisiones del sistema.',
        icon: 'Network',
        category: 'Software',
      },
      {
        id: 'software-test-plan',
        name: 'Plan y resultados de pruebas',
        description: 'Estrategia, casos, resultados, defectos y aprobación.',
        icon: 'ShieldCheck',
        category: 'Software',
      },
      {
        id: 'software-release-plan',
        name: 'Plan de entrega y cambios',
        description: 'Contenido de la versión, despliegue, verificación y reversa.',
        icon: 'Rocket',
        category: 'Software',
      },
      {
        id: 'software-operations-guide',
        name: 'Guía de operación',
        description: 'Puesta en marcha, monitoreo, incidentes, recuperación y soporte.',
        icon: 'Activity',
        category: 'Software',
      },
      {
        id: 'software-outcome-measurement',
        name: 'Medición de resultados',
        description: 'Indicadores, línea base, mediciones, interpretación y seguimiento.',
        icon: 'BarChart3',
        category: 'Software',
      },
      {
        id: 'ai-builder',
        name: 'AI Workspace Builder',
        description:
          'Structured template for the AI Builder. Fill in each section and let the AI generate your full workspace.',
        icon: 'Sparkles',
        category: 'AI',
      },
      {
        id: 'quick-note',
        name: 'Nota rápida',
        description: 'Una nota capturada desde cualquier pantalla',
        icon: 'FileText',
        category: 'Collaboration',
      },
      {
        id: 'decision-record',
        name: 'Registro de decisión',
        description: 'Decisión, motivo y siguiente paso',
        icon: 'CheckCircle2',
        category: 'Collaboration',
      },
    ];
  }

  /**
   * Obtener el contenido de una plantilla específica
   */
  getTemplateContent(templateId: TemplateCategory, metadata?: any): any {
    const templates: Record<TemplateCategory, (metadata?: any) => any> = {
      'meeting-notes': this.getMeetingNotesTemplate,
      'project-brief': this.getProjectBriefTemplate,
      'technical-spec': this.getTechnicalSpecTemplate,
      retrospective: this.getRetrospectiveTemplate,
      'project-documentation': this.getProjectDocumentationTemplate,
      'software-vision-scope': this.getSoftwareVisionScopeTemplate,
      'software-requirements': this.getSoftwareRequirementsTemplate,
      'software-architecture': this.getSoftwareArchitectureTemplate,
      'software-test-plan': this.getSoftwareTestPlanTemplate,
      'software-release-plan': this.getSoftwareReleasePlanTemplate,
      'software-operations-guide': this.getSoftwareOperationsGuideTemplate,
      'software-outcome-measurement': this.getSoftwareOutcomeMeasurementTemplate,
      'quick-note': this.getQuickNoteTemplate,
      'decision-record': this.getDecisionRecordTemplate,
      'ai-builder': this.getAiBuilderTemplate,
    };

    const templateFn = templates[templateId];
    if (!templateFn) {
      throw new Error(`Template '${templateId}' not found`);
    }

    return templateFn.call(this, metadata);
  }

  /**
   * Crear un YJS state a partir del contenido de una plantilla
   */
  createYjsStateFromTemplate(templateId: TemplateCategory, metadata?: any): Uint8Array {
    const content = this.getTemplateContent(templateId, metadata);

    const doc = new Y.Doc();
    const fragment = doc.getXmlFragment('default');

    // Convertir el contenido JSON a XML fragment de YJS
    this.jsonToXmlFragment(content, fragment);

    const state = Y.encodeStateAsUpdate(doc);
    doc.destroy();

    return state;
  }

  /**
   * Convertir estructura JSON de TipTap a YJS XML Fragment
   */
  private jsonToXmlFragment(json: any, fragment: Y.XmlFragment): void {
    if (!json || !json.content) return;

    json.content.forEach((node: any) => {
      const element = this.jsonNodeToXmlElement(node);
      if (element) {
        fragment.push([element]);
      }
    });
  }

  /**
   * Convertir un nodo JSON a YJS XML Element
   */
  private jsonNodeToXmlElement(node: any): Y.XmlElement | Y.XmlText | null {
    if (node.type === 'text') {
      const text = new Y.XmlText(node.text || '');

      // Aplicar marcas (bold, italic, etc.)
      if (node.marks && node.marks.length > 0) {
        node.marks.forEach((mark: any) => {
          text.format(0, text.length, { [mark.type]: mark.attrs || true });
        });
      }

      return text;
    }

    const element = new Y.XmlElement(node.type);

    // Agregar atributos
    if (node.attrs) {
      Object.entries(node.attrs).forEach(([key, value]) => {
        element.setAttribute(key, value as string);
      });
    }

    // Agregar contenido hijo
    if (node.content && node.content.length > 0) {
      node.content.forEach((child: any) => {
        const childElement = this.jsonNodeToXmlElement(child);
        if (childElement) {
          element.push([childElement]);
        }
      });
    }

    return element;
  }

  // ==================== PLANTILLAS ====================

  private textParagraphs(value: string): any[] {
    return value.split('\n').map((line) => ({
      type: 'paragraph',
      content: line ? [{ type: 'text', text: line }] : [],
    }));
  }

  private getSoftwareTemplate(
    title: string,
    purpose: string,
    sections: { title: string; points: string[] }[]
  ) {
    const heading = (text: string, level: number) => ({
      type: 'heading',
      attrs: { level },
      content: [{ type: 'text', text }],
    });
    const bulletList = (points: string[]) => ({
      type: 'bulletList',
      content: points.map((point) => ({
        type: 'listItem',
        content: [{ type: 'paragraph', content: [{ type: 'text', text: point }] }],
      })),
    });

    return {
      type: 'doc',
      content: [
        heading(title, 1),
        {
          type: 'paragraph',
          content: [{ type: 'text', marks: [{ type: 'italic' }], text: purpose }],
        },
        {
          type: 'paragraph',
          content: [{
            type: 'text',
            text: 'Guía de trabajo: responde los puntos aplicables, reemplaza estas indicaciones y marca como “No aplica” lo que no corresponda. Vincula requisitos, tarjetas, decisiones y evidencias del proyecto cuando existan. No incluyas contraseñas, tokens ni secretos.',
          }],
        },
        { type: 'horizontalRule' },
        heading('Control del documento', 2),
        bulletList([
          'Responsable de mantenerlo, personas revisoras y aprobadoras.',
          'Versión, fecha de actualización y estado de revisión.',
          'Documentos, decisiones, entregables o tarjetas relacionadas.',
        ]),
        ...sections.flatMap((section) => [
          heading(section.title, 2),
          bulletList(section.points),
        ]),
        heading('Historial de cambios', 2),
        bulletList([
          'Versión y fecha del cambio.',
          'Secciones modificadas y motivo del cambio.',
          'Persona que realizó el cambio y revisión o aprobación asociada.',
        ]),
      ],
    };
  }

  private getSoftwareVisionScopeTemplate() {
    return this.getSoftwareTemplate('Visión y alcance', 'Define por qué existe el proyecto, qué cambio busca producir y qué quedará dentro o fuera del trabajo.', [
      { title: 'Contexto y problema', points: [
        '¿Qué situación origina el proyecto y a quién afecta?',
        '¿Qué evidencia muestra que el problema existe? Incluye datos, ejemplos o fuentes.',
        '¿Cómo se resuelve hoy y qué dificultades, costos o riesgos genera?',
      ] },
      { title: 'Visión y objetivos', points: [
        '¿Qué cambio observable debería producir la solución?',
        '¿Qué objetivos concretos se esperan y qué beneficio aportará cada uno?',
        '¿Qué no intenta resolver este proyecto?',
      ] },
      { title: 'Personas usuarias e involucradas', points: [
        '¿Quién usará, administrará, financiará o recibirá el impacto de la solución?',
        '¿Qué necesidades, permisos, barreras de acceso o consideraciones de accesibilidad tiene cada grupo?',
        '¿Quién toma decisiones y quién acepta el resultado?',
      ] },
      { title: 'Alcance y entregables', points: [
        '¿Qué funciones, procesos, datos, plataformas y grupos están incluidos?',
        '¿Qué queda explícitamente fuera de esta etapa?',
        '¿Qué entregables permitirán comprobar que el alcance fue cubierto?',
      ] },
      { title: 'Restricciones, supuestos y dependencias', points: [
        '¿Qué límites de plazo, presupuesto, tecnología, normativa o recursos deben respetarse?',
        '¿Qué supuestos se están usando y cómo se validarán?',
        '¿De qué equipos, sistemas, proveedores, datos o decisiones depende el proyecto?',
      ] },
      { title: 'Criterios de éxito', points: [
        '¿Qué indicadores mostrarán que el cambio ocurrió? Define nombre, fórmula y unidad.',
        '¿Cuál es la línea base y qué meta se espera alcanzar?',
        '¿De dónde saldrán los datos, con qué frecuencia se medirán y quién revisará el resultado?',
      ] },
      { title: 'Riesgos y preguntas abiertas', points: [
        '¿Qué podría impedir o retrasar el resultado? Indica probabilidad, impacto y respuesta.',
        '¿Qué decisiones o información faltan para confirmar el alcance?',
        '¿Qué señales indicarían que hay que revisar la visión o el plan?',
      ] },
    ]);
  }

  private getSoftwareRequirementsTemplate() {
    return this.getSoftwareTemplate('Requisitos y criterios de aceptación', 'Describe las necesidades del producto o sistema y cómo el equipo y las personas interesadas comprobarán cada resultado.', [
      { title: 'Propósito, alcance y referencias', points: [
        '¿Qué producto, módulo o proceso cubre este documento y qué queda fuera?',
        '¿Qué términos, siglas, políticas o documentos relacionados deben entenderse antes de leerlo?',
        '¿Qué objetivo y personas usuarias del proyecto motivan estos requisitos?',
      ] },
      { title: 'Actores y necesidades', points: [
        '¿Qué perfiles, sistemas externos o administradores interactúan con la solución?',
        '¿Qué tarea necesita completar cada perfil y con qué resultado?',
        '¿Qué permisos, estados o restricciones aplican a cada uno?',
      ] },
      { title: 'Requisitos funcionales', points: [
        'Para cada requisito registra ID, descripción verificable, origen y prioridad.',
        '¿Qué respuesta debe entregar el sistema en el escenario principal?',
        '¿Qué escenarios alternativos, errores y reglas de negocio deben contemplarse?',
        '¿Qué ejemplos concretos demuestran que el requisito está completo?',
      ] },
      { title: 'Requisitos de calidad', points: [
        '¿Qué niveles de rendimiento, disponibilidad, capacidad y recuperación se necesitan?',
        '¿Qué requisitos de seguridad, privacidad, accesibilidad y compatibilidad aplican?',
        '¿Cómo se medirá cada atributo y cuál es el umbral aceptable?',
      ] },
      { title: 'Datos e integraciones', points: [
        '¿Qué datos se crean, consultan, modifican, eliminan o conservan?',
        '¿Qué sistemas o APIs participan? Indica propietario, dirección del intercambio y fallos posibles.',
        '¿Qué validaciones, formatos, permisos y reglas de retención aplican?',
      ] },
      { title: 'Criterios de aceptación', points: [
        'Para cada requisito define precondiciones, acción y resultado esperado.',
        '¿Qué casos límite y mensajes de error deben aceptarse?',
        '¿Qué evidencia se guardará para demostrar la aceptación y quién la aprobará?',
      ] },
      { title: 'Trazabilidad y cambios', points: [
        '¿Qué objetivo, entregable, tarjeta, prueba o decisión respalda cada requisito?',
        '¿Cómo se revisará el impacto de un cambio en requisitos dependientes?',
        '¿Qué requisitos están pendientes, aprobados, implementados o verificados?',
      ] },
    ]);
  }

  private getSoftwareArchitectureTemplate() {
    return this.getSoftwareTemplate('Arquitectura y decisiones técnicas', 'Explica cómo se organiza la solución, qué límites tiene y por qué se eligieron sus componentes y tecnologías.', [
      { title: 'Resumen y atributos de calidad', points: [
        '¿Qué problema y requisitos de calidad debe resolver esta arquitectura?',
        '¿Qué restricciones de tecnología, equipo, costo o plataforma condicionan el diseño?',
        '¿Qué principios guían el diseño y qué compromisos se aceptan?',
      ] },
      { title: 'Contexto del sistema', points: [
        'Incluye o enlaza un diagrama con usuarios, sistema, límites y actores externos.',
        '¿Qué queda dentro del sistema y qué depende de servicios externos?',
        '¿Qué datos cruzan cada límite de confianza?',
      ] },
      { title: 'Componentes y flujos', points: [
        '¿Qué componentes existen, qué responsabilidad tiene cada uno y cómo se comunican?',
        'Describe los flujos principales desde la entrada hasta el resultado.',
        '¿Qué ocurre si un componente falla, tarda o devuelve información inválida?',
      ] },
      { title: 'Datos e integraciones', points: [
        '¿Qué entidades y relaciones principales utiliza la solución?',
        '¿Dónde se almacenan los datos y cuáles son las reglas de acceso, retención y eliminación?',
        'Para cada integración registra contrato, autenticación, límites, reintentos y manejo de errores.',
      ] },
      { title: 'Decisiones técnicas', points: [
        'Para cada decisión registra contexto, fecha, responsable y estado.',
        '¿Qué opciones se evaluaron y con qué criterios?',
        '¿Qué alternativa se eligió, por qué, qué consecuencias tiene y cuándo se revisará?',
      ] },
      { title: 'Seguridad y privacidad', points: [
        '¿Cómo se autentican personas y servicios y cómo se asignan permisos?',
        '¿Qué datos sensibles se procesan y cómo se protegen en tránsito y almacenamiento?',
        '¿Qué amenazas, auditorías, secretos y obligaciones de privacidad deben contemplarse?',
      ] },
      { title: 'Rendimiento, resiliencia y operación', points: [
        '¿Qué volumen, latencia, disponibilidad y crecimiento se esperan?',
        '¿Cómo se manejan fallos, copias de seguridad, recuperación y degradación del servicio?',
        '¿Qué métricas, logs, trazas y alertas permiten conocer la salud del sistema?',
      ] },
      { title: 'Despliegue y evolución', points: [
        '¿Qué entornos, infraestructura y proceso de publicación requiere?',
        '¿Cómo se migran datos y cómo se revierte un cambio incompatible?',
        '¿Qué limitaciones conocidas, riesgos y mejoras futuras quedan pendientes?',
      ] },
    ]);
  }

  private getSoftwareTestPlanTemplate() {
    return this.getSoftwareTemplate('Plan y resultados de pruebas', 'Registra qué se verificará, en qué condiciones, qué resultados se obtuvieron y qué evidencia respalda la decisión de aceptar.', [
      { title: 'Identificación y alcance', points: [
        '¿Qué producto, versión, cambio o entregable se está verificando?',
        '¿Qué requisitos y riesgos están incluidos? ¿Qué queda fuera y por qué?',
        '¿Quién prepara, ejecuta, revisa y acepta las pruebas?',
      ] },
      { title: 'Estrategia y cobertura', points: [
        '¿Qué tipos de prueba se usarán: unidad, integración, sistema, aceptación, rendimiento o seguridad?',
        '¿Qué se automatizará y qué requiere revisión manual?',
        '¿Qué requisitos, flujos, navegadores, dispositivos o niveles de carga deben cubrirse?',
      ] },
      { title: 'Entorno y datos', points: [
        '¿Qué versión, configuración, servicios y dispositivos se usaron?',
        '¿Qué datos de prueba se necesitan y cómo se anonimizaron o reiniciaron?',
        '¿Qué dependencias, limitaciones o diferencias respecto de producción afectan los resultados?',
      ] },
      { title: 'Criterios de inicio y término', points: [
        '¿Qué debe estar listo antes de iniciar la ejecución?',
        '¿Qué umbrales de aprobación, cobertura o defectos se requieren para terminar?',
        '¿Quién puede aceptar riesgos residuales o autorizar una excepción?',
      ] },
      { title: 'Casos de prueba y resultados', points: [
        'Para cada caso registra ID, requisito relacionado, prioridad y precondiciones.',
        'Describe pasos, datos usados, resultado esperado y resultado obtenido.',
        'Marca estado: aprobado, fallido, bloqueado o no ejecutado; adjunta evidencia revisable.',
        'Incluye casos negativos, límites, permisos y recuperación ante errores.',
      ] },
      { title: 'Defectos y riesgos', points: [
        'Para cada hallazgo indica severidad, impacto, pasos para reproducir y evidencia.',
        '¿Quién es responsable, cuál es el estado y qué versión corregirá el problema?',
        '¿Qué riesgos permanecen abiertos y cómo se mitigarán?',
      ] },
      { title: 'Resumen y aceptación', points: [
        'Resume pruebas planificadas, ejecutadas, aprobadas, fallidas y bloqueadas.',
        '¿Qué requisitos quedan verificados y cuáles necesitan seguimiento?',
        'Registra decisión de aceptación, responsable, fecha y condiciones pendientes.',
      ] },
    ]);
  }

  private getSoftwareReleasePlanTemplate() {
    return this.getSoftwareTemplate('Plan de entrega y cambios', 'Deja claro qué se publicará, cómo se desplegará, cómo se comprobará y cómo recuperar el servicio si algo falla.', [
      { title: 'Identificación de la entrega', points: [
        'Registra nombre o versión, responsable, fecha prevista, entornos y estado.',
        '¿Qué proyecto, commit, entregables y cambios están asociados?',
        '¿Quién aprueba la publicación y quién estará disponible durante ella?',
      ] },
      { title: 'Contenido del cambio', points: [
        'Resume funcionalidades, correcciones y cambios técnicos incluidos.',
        '¿Qué tarjetas, requisitos, decisiones y documentación están relacionados?',
        '¿Qué cambios se excluyeron o se pospusieron?',
      ] },
      { title: 'Preparación y dependencias', points: [
        '¿Qué permisos, servicios, configuración o coordinaciones se necesitan antes de publicar?',
        '¿Hay migraciones, cambios de datos, tareas manuales o ventanas de mantenimiento?',
        '¿Se verificaron pruebas, copias de seguridad y compatibilidad hacia atrás?',
      ] },
      { title: 'Plan de despliegue', points: [
        'Detalla pasos ordenados, responsable y resultado esperado de cada paso.',
        '¿El despliegue será gradual, por grupos, con feature flags o en una sola etapa?',
        '¿Qué condiciones detienen el despliegue y quién toma esa decisión?',
      ] },
      { title: 'Verificación posterior', points: [
        '¿Qué pruebas rápidas, flujos críticos y métricas confirmarán que quedó funcionando?',
        '¿Dónde se observarán logs, alertas, errores y experiencia de las personas usuarias?',
        'Registra resultado, hora, responsable y evidencia de cada verificación.',
      ] },
      { title: 'Reversa y contingencia', points: [
        '¿Qué señales obligan a revertir, pausar o activar el plan de contingencia?',
        'Describe pasos para volver a la versión anterior y recuperar o corregir datos.',
        '¿Quién ejecuta la reversa y cuánto tiempo se estima para recuperar el servicio?',
      ] },
      { title: 'Comunicación y cierre', points: [
        '¿A quién se informará, por qué canal y en qué momento?',
        'Resume notas de publicación, cambios visibles, limitaciones y acciones para usuarios.',
        'Registra resultado final, incidentes, deuda técnica y seguimiento acordado.',
      ] },
    ]);
  }

  private getSoftwareOperationsGuideTemplate() {
    return this.getSoftwareTemplate('Guía de operación', 'Ofrece al equipo instrucciones seguras para desplegar, observar, mantener y recuperar el servicio.', [
      { title: 'Servicio y responsabilidades', points: [
        '¿Qué hace el servicio, quiénes lo usan y qué funciones son críticas?',
        '¿Quién es responsable de operación, desarrollo, seguridad y escalamiento?',
        'Incluye arquitectura o enlaces a diagramas, dependencias y acuerdos de nivel de servicio.',
      ] },
      { title: 'Entornos y acceso', points: [
        '¿Qué entornos existen y para qué se usa cada uno?',
        '¿Qué requisitos, permisos y herramientas se necesitan para operar?',
        'Indica dónde se gestionan las credenciales; nunca escribas sus valores en este documento.',
      ] },
      { title: 'Configuración y despliegue', points: [
        '¿Qué variables, servicios y parámetros deben estar configurados?',
        'Describe el procedimiento de publicación, comprobaciones y reversa.',
        '¿Qué tareas posteriores al despliegue deben ejecutarse o verificarse?',
      ] },
      { title: 'Monitoreo y alertas', points: [
        '¿Qué métricas, logs, trazas y paneles permiten conocer el estado del servicio?',
        '¿Qué umbrales activan alertas, quién las recibe y cuál es el tiempo de respuesta esperado?',
        '¿Cómo se mide disponibilidad, rendimiento, errores y consumo de recursos?',
      ] },
      { title: 'Incidentes y resolución', points: [
        'Para cada incidente habitual describe síntomas, impacto y cómo confirmarlo.',
        'Enumera pasos de diagnóstico y mitigación con comandos o enlaces seguros.',
        '¿Cuándo escalar, a quién y qué información debe acompañar el reporte?',
      ] },
      { title: 'Copias y recuperación', points: [
        '¿Qué información se respalda, con qué frecuencia y durante cuánto tiempo?',
        'Describe cómo restaurar, validar integridad y documentar una recuperación.',
        '¿Cuándo se probó por última vez la restauración y cuál fue el resultado?',
      ] },
      { title: 'Mantenimiento y seguridad', points: [
        '¿Qué tareas periódicas, actualizaciones y revisiones se deben realizar?',
        '¿Cómo se gestionan vulnerabilidades, permisos, secretos y registros de auditoría?',
        '¿Qué tareas pendientes, limitaciones conocidas o cambios recientes debe conocer el equipo?',
      ] },
    ]);
  }

  private getSoftwareOutcomeMeasurementTemplate() {
    return this.getSoftwareTemplate('Medición de resultados', 'Comprueba si el proyecto produjo el cambio esperado, con indicadores claros, datos rastreables y límites explícitos.', [
      { title: 'Objetivo y población', points: [
        '¿Qué objetivo del proyecto se medirá y para qué decisión servirá el resultado?',
        '¿Qué personas, procesos, productos o periodo abarca la medición?',
        '¿Qué cambio se espera y en qué plazo debería observarse?',
      ] },
      { title: 'Indicadores', points: [
        'Para cada indicador registra nombre, definición, fórmula, unidad y sentido de mejora.',
        '¿Cuál es la línea base, la meta, el umbral de alerta y la fecha objetivo?',
        '¿Cuál es la fuente de datos, frecuencia, responsable y método de cálculo?',
      ] },
      { title: 'Método de medición', points: [
        '¿Cómo se recopilan, validan y comparan los datos?',
        '¿Qué periodo, muestra, segmentos o método de comparación se usó?',
        '¿Qué sesgos, datos faltantes o factores externos pueden afectar la lectura?',
      ] },
      { title: 'Registro de mediciones', points: [
        'Por cada medición registra fecha, periodo cubierto, valor, fuente y persona responsable.',
        'Añade contexto, incidencias y evidencia que permita reproducir o revisar el dato.',
        'Indica si el dato es preliminar, validado, corregido o descartado.',
      ] },
      { title: 'Análisis e interpretación', points: [
        '¿Cómo se compara el resultado con la línea base, la meta y mediciones anteriores?',
        '¿Qué cambios se observan por periodo, perfil de usuario o segmento relevante?',
        '¿Qué evidencia permite atribuir o no el cambio al proyecto?',
      ] },
      { title: 'Efectos y limitaciones', points: [
        '¿Hubo efectos no esperados, impactos negativos o señales de riesgo?',
        '¿Qué limitaciones impiden concluir con certeza que el objetivo se alcanzó?',
        '¿Qué información adicional mejoraría la siguiente medición?',
      ] },
      { title: 'Conclusiones y siguientes pasos', points: [
        '¿Qué se aprendió y qué objetivo o indicador requiere una decisión?',
        '¿Qué acciones se acuerdan, quién las realizará y para cuándo?',
        '¿Cuándo se volverá a medir y quién revisará el avance?',
      ] },
    ]);
  }

  private getQuickNoteTemplate(metadata?: { body?: string }): any {
    return { type: 'doc', content: this.textParagraphs(metadata?.body ?? '') };
  }

  private getDecisionRecordTemplate(metadata?: { body?: string; nextStep?: string }): any {
    return {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Motivo y contexto' }] },
        ...this.textParagraphs(metadata?.body ?? ''),
        ...(metadata?.nextStep ? [
          { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Siguiente paso' }] },
          ...this.textParagraphs(metadata.nextStep),
        ] : []),
      ],
    };
  }

  /**
   * Plantilla: Meeting Notes
   */
  private getMeetingNotesTemplate(metadata?: any): any {
    const today = new Date().toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Meeting Notes' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' },
            { type: 'text', text: today },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Attendees: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Duration: ' },
            { type: 'text', text: '' },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Agenda' }],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 2' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Topic 3' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Discussion Notes' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action Items' }],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action item description' },
                  ],
                },
              ],
            },
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action item description' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Key Decisions' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Decision 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Decision 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Next Steps' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: '' }],
        },
      ],
    };
  }

  /**
   * Plantilla: Project Brief
   */
  private getProjectBriefTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Project Brief' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'A comprehensive overview of the project goals, scope, timeline, and stakeholders.',
            },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Project Overview' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Project Name: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Project Owner: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Start Date: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Target Completion: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Objectives & Goals' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'What are we trying to achieve?' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Primary objective' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Secondary objective' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Problem Statement' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'What problem are we solving?' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Proposed Solution' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'How will we solve this problem?' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Scope' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'In Scope' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Feature/deliverable 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Feature/deliverable 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Out of Scope' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'What is not included' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Stakeholders' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Name' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Role' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', marks: [{ type: 'bold' }], text: 'Responsibility' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Timeline & Milestones' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Milestone' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target Date' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Phase 1' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'Not Started' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Risks & Mitigation' }],
        },
        {
          type: 'table',
          content: [
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Risk' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impact' }],
                    },
                  ],
                },
                {
                  type: 'tableHeader',
                  content: [
                    {
                      type: 'paragraph',
                      content: [
                        { type: 'text', marks: [{ type: 'bold' }], text: 'Mitigation Strategy' },
                      ],
                    },
                  ],
                },
              ],
            },
            {
              type: 'tableRow',
              content: [
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: 'High/Medium/Low' }],
                    },
                  ],
                },
                {
                  type: 'tableCell',
                  content: [
                    {
                      type: 'paragraph',
                      content: [{ type: 'text', text: '' }],
                    },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Budget & Resources' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Estimated budget and resource requirements' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Success Metrics' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'How will we measure success?' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'KPI 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'KPI 2' }],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Plantilla: Technical Specification
   */
  private getTechnicalSpecTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Technical Specification' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Detailed technical documentation for implementing this feature or system.',
            },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Overview' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Feature Name: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Author: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Status: ' },
            { type: 'text', text: 'Draft / In Review / Approved' },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Goals & Non-Goals' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Goals' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Primary goal' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Non-Goals' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'What we are explicitly not doing' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Architecture & Design' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'System Architecture' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'High-level architecture overview' }],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'Data Model' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'typescript' },
          content: [
            {
              type: 'text',
              text: 'interface Example {\n  id: string;\n  name: string;\n  createdAt: Date;\n}',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 3 },
          content: [{ type: 'text', text: 'API Endpoints' }],
        },
        {
          type: 'codeBlock',
          attrs: { language: 'http' },
          content: [
            {
              type: 'text',
              text: 'GET /api/resource/:id\nPOST /api/resource\nPUT /api/resource/:id\nDELETE /api/resource/:id',
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'User Flow' }],
        },
        {
          type: 'orderedList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'User action 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'System response 1' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'User action 2' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Security Considerations' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Authentication & Authorization' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Data validation' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Rate limiting' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Performance' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Expected load and scale' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Caching strategy' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Database indexes' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Testing Strategy' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Unit tests' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Integration tests' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'E2E tests' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Deployment & Rollout' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Deployment strategy and rollout plan' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Monitoring & Metrics' }],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Key metrics to track' }],
                },
              ],
            },
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: 'Alerts and dashboards' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Future Considerations' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Potential future enhancements or extensions' }],
        },
      ],
    };
  }

  /**
   * Plantilla: Retrospective
   */
  private getRetrospectiveTemplate(metadata?: any): any {
    return {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Sprint Retrospective' }],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Sprint: ' },
            { type: 'text', text: '' },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Date: ' },
            { type: 'text', text: new Date().toLocaleDateString() },
          ],
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', marks: [{ type: 'bold' }], text: 'Facilitator: ' },
            { type: 'text', text: '' },
          ],
        },
        { type: 'horizontalRule' },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What Went Well' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Things that the team did well and should continue',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'What Could Be Improved' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Areas where the team faced challenges or could improve',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Ideas & Experiments' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'New ideas or experiments to try in the next sprint',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Action Items' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Concrete actions to take based on this retrospective',
            },
          ],
        },
        {
          type: 'taskList',
          content: [
            {
              type: 'taskItem',
              attrs: { checked: false },
              content: [
                {
                  type: 'paragraph',
                  content: [
                    { type: 'text', marks: [{ type: 'bold' }], text: '@Owner' },
                    { type: 'text', text: ' - Action description' },
                  ],
                },
              ],
            },
          ],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Shout-Outs' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              marks: [{ type: 'italic' }],
              text: 'Recognize team members for their contributions',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [
                {
                  type: 'paragraph',
                  content: [{ type: 'text', text: '' }],
                },
              ],
            },
          ],
        },
      ],
    };
  }

  /**
   * Plantilla: Complete Project Documentation
   * Plantilla adaptable según el tipo de proyecto
   */
  private getProjectDocumentationTemplate(metadata?: any): any {
    const projectType = metadata?.projectType || 'software'; // software, construction, research, design, marketing, etc.

    // Contenido base común a todos los tipos
    const baseContent = [
      {
        type: 'heading',
        attrs: { level: 1 },
        content: [{ type: 'text', text: 'Complete Project Documentation' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: 'Comprehensive documentation for planning, executing, and delivering this project.',
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '1. Executive Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Project Name: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Project Manager: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Organization: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Start Date: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Expected Completion: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', marks: [{ type: 'bold' }], text: 'Budget: ' },
          { type: 'text', text: '' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Project Summary' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            text: 'Brief overview of what this project aims to achieve and why it matters.',
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '2. Project Objectives & Goals' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Primary Objectives' }],
      },
      {
        type: 'orderedList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Objective 1' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Objective 2' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Success Criteria' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Metric' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '3. Background & Context' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Problem Statement' }],
      },
      {
        type: 'paragraph',
        content: [
          { type: 'text', text: 'What problem or opportunity is this project addressing?' },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Current Situation' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Describe the current state before this project.' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Desired Outcome' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'What will be different after project completion?' }],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '4. Project Scope' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'In Scope' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Deliverable 1' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Deliverable 2' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Out of Scope' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'What is explicitly not included' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Assumptions' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Key assumptions being made' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Constraints' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Limitations or constraints' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
    ];

    // Contenido específico según el tipo de proyecto
    const specificContent = this.getProjectTypeSpecificContent(projectType);

    // Contenido común final
    const finalContent = [
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '6. Team & Stakeholders' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Core Team' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Name' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Role' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Responsibilities' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Contact' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Stakeholders' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Stakeholder' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Interest' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Influence' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'High/Medium/Low' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'High/Medium/Low' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '7. Timeline & Milestones' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Phase' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Milestone' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Start Date' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'End Date' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Planning' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Requirements Complete' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Not Started' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '8. Budget & Resources' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Budget Breakdown' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Category' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Estimated Cost' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Actual Cost' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Variance' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Personnel' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Tools & Software' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Resource Requirements' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Human resources' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Equipment and tools' }],
              },
            ],
          },
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Infrastructure' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '9. Risk Management' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Risk' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Probability' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Impact' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Mitigation Strategy' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Owner' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'H/M/L' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'H/M/L' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '10. Communication Plan' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Communication Type' },
                    ],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Frequency' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Audience' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Method' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Status Updates' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Weekly' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Team & Stakeholders' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Email' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '11. Quality Assurance' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Quality Standards' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Quality standard or requirement' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Testing & Validation' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'How will quality be ensured and validated?' }],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '12. Progress Tracking' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Key Performance Indicators (KPIs)' }],
      },
      {
        type: 'table',
        content: [
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'KPI' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Target' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Current' }],
                  },
                ],
              },
              {
                type: 'tableHeader',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Status' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'tableRow',
            content: [
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
              {
                type: 'tableCell',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: '' }],
                  },
                ],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '13. Lessons Learned' }],
      },
      {
        type: 'paragraph',
        content: [
          {
            type: 'text',
            marks: [{ type: 'italic' }],
            text: 'Document key learnings throughout the project lifecycle',
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'What Worked Well' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Challenges Faced' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Recommendations for Future Projects' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: '' }],
              },
            ],
          },
        ],
      },
      { type: 'horizontalRule' },
      {
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: '14. Appendix' }],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'References & Resources' }],
      },
      {
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [
              {
                type: 'paragraph',
                content: [{ type: 'text', text: 'Link or reference 1' }],
              },
            ],
          },
        ],
      },
      {
        type: 'heading',
        attrs: { level: 3 },
        content: [{ type: 'text', text: 'Glossary' }],
      },
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Define key terms and acronyms used in this document.' }],
      },
    ];

    return {
      type: 'doc',
      content: [...baseContent, ...specificContent, ...finalContent],
    };
  }

  /**
   * Obtener contenido específico según el tipo de proyecto
   */
  private getProjectTypeSpecificContent(projectType: string): any[] {
    switch (projectType) {
      case 'software':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Technical Details (Software Project)' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Technology Stack' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Frontend: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Backend: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Database: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Infrastructure: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'System Architecture' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Describe the high-level system architecture.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Model' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'typescript' },
            content: [
              {
                type: 'text',
                text: '// Add your data models here',
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'API Specifications' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Document key API endpoints and their usage.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Development Environment Setup' }],
          },
          {
            type: 'codeBlock',
            attrs: { language: 'bash' },
            content: [
              {
                type: 'text',
                text: '# Installation steps\nnpm install\n# Run development server\nnpm run dev',
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Deployment Process' }],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Build step' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Test step' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deploy step' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Security Measures' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Authentication & Authorization' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data encryption' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Security testing' }],
                  },
                ],
              },
            ],
          },
        ];

      case 'construction':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Construction Details' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Site Information' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Location: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Site Area: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Zoning: ' },
                      { type: 'text', text: '' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Architectural Plans' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Reference to architectural drawings and blueprints.' },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Materials & Specifications' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Material' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', marks: [{ type: 'bold' }], text: 'Specification' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Quantity' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Supplier' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Contractors & Subcontractors' }],
          },
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Company' }],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [
                          { type: 'text', marks: [{ type: 'bold' }], text: 'Scope of Work' },
                        ],
                      },
                    ],
                  },
                  {
                    type: 'tableHeader',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', marks: [{ type: 'bold' }], text: 'Contact' }],
                      },
                    ],
                  },
                ],
              },
              {
                type: 'tableRow',
                content: [
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                  {
                    type: 'tableCell',
                    content: [
                      {
                        type: 'paragraph',
                        content: [{ type: 'text', text: '' }],
                      },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Permits & Regulations' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Building permits required' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Safety regulations' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Environmental compliance' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Safety Plan' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Safety procedures and protocols for the construction site.' },
            ],
          },
        ];

      case 'research':
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Research Methodology' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Research Questions' }],
          },
          {
            type: 'orderedList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Primary research question' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Secondary research question' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Hypothesis' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'State your research hypothesis.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Research Design' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Type: ' },
                      { type: 'text', text: 'Qualitative / Quantitative / Mixed Methods' },
                    ],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      { type: 'text', marks: [{ type: 'bold' }], text: 'Approach: ' },
                      { type: 'text', text: 'Experimental / Survey / Case Study / etc.' },
                    ],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Collection' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data sources' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Collection methods' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Sample size and selection' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Data Analysis' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Methods and tools for analyzing collected data.' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Ethical Considerations' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'IRB approval status' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Informed consent procedures' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Data privacy measures' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Literature Review' }],
          },
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Summary of relevant existing research and how this project builds upon it.',
              },
            ],
          },
        ];

      default:
        // Generic project type
        return [
          {
            type: 'heading',
            attrs: { level: 2 },
            content: [{ type: 'text', text: '5. Project Details' }],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Detailed Description' }],
          },
          {
            type: 'paragraph',
            content: [
              { type: 'text', text: 'Provide detailed information specific to your project type.' },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Deliverables' }],
          },
          {
            type: 'bulletList',
            content: [
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deliverable 1' }],
                  },
                ],
              },
              {
                type: 'listItem',
                content: [
                  {
                    type: 'paragraph',
                    content: [{ type: 'text', text: 'Deliverable 2' }],
                  },
                ],
              },
            ],
          },
          {
            type: 'heading',
            attrs: { level: 3 },
            content: [{ type: 'text', text: 'Requirements' }],
          },
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Specific requirements for this project.' }],
          },
        ];
    }
  }
  // ==================== AI BUILDER TEMPLATE ====================

  private getAiBuilderTemplate(_metadata?: any): any {
    const h1 = (text: string) => ({
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text }],
    });
    const h2 = (text: string) => ({
      type: 'heading',
      attrs: { level: 2 },
      content: [{ type: 'text', text }],
    });
    const p = (text: string) => ({
      type: 'paragraph',
      content: [{ type: 'text', text }],
    });
    const hint = (text: string) => ({
      type: 'paragraph',
      content: [{ type: 'text', marks: [{ type: 'italic' }], text }],
    });
    const rule = () => ({ type: 'horizontalRule' });
    const blank = () => ({ type: 'paragraph', content: [] });

    return {
      type: 'doc',
      content: [
        h1('AI Workspace Builder — Project Plan'),
        hint('Fill in each section with as much detail as possible. The AI uses this document to generate your complete workspace, projects, boards, milestones, and tasks.'),
        rule(),

        h2('1. Project Overview'),
        hint('Project name, one-line description, type (Web app / Mobile / API / Internal tool), and current stage (Idea / MVP / Growth).'),
        blank(),

        h2('2. Problem & Context'),
        hint('What problem does this project solve? Who is affected? What happens if it is not solved?'),
        blank(),

        h2('3. Proposed Solution'),
        hint('What are you building exactly? Describe the main modules or components.'),
        blank(),

        h2('4. Technology Stack'),
        p('Backend:'),
        p('Frontend:'),
        p('Database:'),
        p('Infrastructure / DevOps:'),
        p('External APIs / Integrations:'),

        h2('5. Scope'),
        hint('What IS included in this version and what is NOT included (future versions).'),
        p('Included:'),
        blank(),
        p('Excluded (future):'),
        blank(),

        h2('6. Objectives'),
        hint('One general objective and 3–6 specific, measurable deliverables.'),
        p('General objective:'),
        blank(),
        p('Specific objectives:'),
        blank(),

        h2('7. Team & Roles'),
        hint('List each person, their role, and their main responsibilities.'),
        blank(),

        h2('8. Timeline & Milestones'),
        hint('Project start date, target launch date, and key milestones with dates (YYYY-MM-DD). The AI will align tasks to these milestones.'),
        p('Start date:'),
        p('Launch date:'),
        blank(),
        p('Milestones:'),
        p('1. Milestone name — YYYY-MM-DD'),
        p('2. Milestone name — YYYY-MM-DD'),
        p('3. Milestone name — YYYY-MM-DD'),

        h2('9. Functional Requirements'),
        hint('List the main features / modules with a brief description. Be specific — the AI turns these into tasks.'),
        blank(),

        h2('10. Non-Functional Requirements'),
        hint('Performance targets, security requirements, scalability expectations, compliance constraints.'),
        blank(),

        h2('11. KPIs & Success Metrics'),
        hint('How will you measure success? Include metric name, target value, and measurement frequency.'),
        blank(),

        h2('12. Known Risks'),
        hint('List risks and how you plan to mitigate them (Risk: description | Mitigation: approach).'),
        blank(),
      ],
    };
  }
}

export const documentTemplateService = new DocumentTemplateService();
