---
title: "Documentos y evidencia"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Documentos y evidencia

## Clases documentales

| Clase | Ámbito | Propósito |
| :--- | :--- | :--- |
| Política | Workspace u organización | Definir reglas |
| Plantilla | Workspace | Orientar elaboración |
| Documento base | Proyecto | Formalizar problema y alcance |
| Plan | Proyecto | Expresar compromisos |
| Evidencia | Iniciativa, proyecto o entregable | Sustentar afirmaciones |
| Acta | Revisión o decisión | Registrar acuerdos |
| Entrega | Proyecto | Material aceptado |
| Aprendizaje | Proyecto o biblioteca autorizada | Reutilizar conocimiento |

El esquema tiene Document, DocumentPermission, DocumentComment y DocumentVersion. Document admite projectId opcional. La revisión confirma primitivas de colaboración y exportación, no un gestor completo de expedientes aprobados.

## Qué hace válida una evidencia

Una evidencia necesita autor o fuente, fecha, recurso identificable, descripción de lo que demuestra, relación con el requisito y nivel de acceso. Una URL sin explicación puede ser un recurso adjunto, pero no debe satisfacer automáticamente un criterio.

Para aprobar se fija una versión de la evidencia. Cambios posteriores generan nueva versión y pueden invalidar una evaluación si alteran su fundamento. Un comentario resuelto no implica aprobación del documento.

## Colaboración y revisión

La edición colaborativa resuelve combinación de texto. La aceptación es una decisión de negocio separada. Mostrar estado de sincronización, último guardado confirmado, revisión vigente y quién puede editar.

La restauración de una versión crea una nueva revisión recuperada. La eliminación o el traslado de una evidencia que sostiene una aprobación requiere comprobación de impacto. Un documento base no puede desaparecer sin que cambie el cumplimiento actual del proyecto.

## Archivos y exportaciones

El almacenamiento debe usar claves internas vinculadas al recurso, límites de tamaño, comprobación de tipo y políticas de descarga. Validar acceso al generar y consumir una descarga según el mecanismo adoptado. Las URLs firmadas deben tener duración acotada.

Exportar un expediente incluye sólo contenido autorizado y deja registro de actor, ámbito, filtros y momento. Si la exportación mezcla recursos con permisos distintos, el sistema debe excluir o bloquear los no autorizados y explicar la cobertura del archivo.

## Riesgos concretos de diseño

Un documento del workspace no es automáticamente evidencia de todos sus proyectos. Una concesión externa al proyecto no debe habilitar documentos reservados por efecto indirecto. Un proceso de PDF que carga recursos externos necesita controles de destinos permitidos y red para evitar acceso a recursos internos del servidor.

El contenido sensible no debe enviarse a un proveedor de IA por el mero hecho de abrir un documento. El propósito y la selección del contenido deben ser explícitos.

Relaciones: [[Seguridad y datos]], [[Eventos y tiempo real]] y [[Plantilla de revision]].
