---
title: "Estandares y cobertura"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Estandares y cobertura

## Propósito del estándar

Un estándar define qué debe contener un proyecto, cuándo se exige y quién valida. Debe ser versionado e identificable. La plantilla facilita capturar información; el estándar determina qué cuenta como suficiente.

El código conserva WorkspaceProjectStandard y referencias applied_standard_id y applied_standard_version en Project. Sin embargo, hydrateProject consulta el estándar activo del workspace para calcular cobertura y formalización. Cambiar ese estándar puede alterar la lectura de proyectos que declaran otra versión aplicada.

## Regla objetivo de versiones

Cada proyecto utiliza la versión vinculada al formalizarse o crearse, según política. Publicar una versión nueva afecta por defecto a proyectos nuevos. Los anteriores reciben una propuesta de adopción con diferencias, requisitos nuevos e impacto en cumplimiento.

La adopción es explícita, autorizada y auditable. Conserva resultados previos y registra fecha efectiva. Una corrección de seguridad o exigencia obligatoria puede requerir migración, pero debe seguir un procedimiento comunicado, con plazo y responsables.

## Cobertura honesta

| Estado | Significado | Tratamiento |
| :--- | :--- | :--- |
| NOT_APPLICABLE | Requisito no exigible bajo la versión y contexto | Excluir del denominador |
| APPLIES_EMPTY | Requisito exigible sin dato válido | Incluir como pendiente |
| APPLIES_FILLED | Requisito exigible con dato válido | Incluir como satisfecho |
| UNKNOWN | No fue posible evaluar el requisito | Mostrar incertidumbre, sin convertirlo en completo |

UNKNOWN es una extensión propuesta para errores o datos heredados. El código inspeccionado calcula presencia de datos y devuelve 100 cuando no hay campos. El diseño objetivo representa un denominador cero como «sin requisitos aplicables», sin sugerir rendimiento perfecto.

Cobertura = requisitos aplicables satisfechos / requisitos aplicables evaluables. La pantalla debe mostrar numerador, denominador y requisitos no evaluables por separado. Si existen UNKNOWN, el resultado debe advertir que es parcial. Para decisiones de aprobación no se permite ignorar silenciosamente un requisito desconocido.

## Calidad y madurez

Contar documentos no prueba calidad documental. Contar equipos no prueba disponibilidad. Contar hitos no prueba que exista un próximo hito vigente. Cada requisito necesita una función de validación con versión y un mensaje accionable.

| Requisito | Validación propuesta |
| :--- | :--- |
| Documento base | Documento del proyecto, contenido mínimo, versión y aprobación si aplica |
| Equipo | Participantes vigentes y responsabilidades aceptadas |
| Hito | Compromiso futuro o vigente con criterio de aceptación |
| Responsable | Identidad activa, autoridad y aceptación |
| Problema | Campos sustantivos, sin texto vacío o plantilla sin completar |
| Fechas | Coherentes entre sí y con restricciones relevantes |

## Comparabilidad

No promediar porcentajes de estándares distintos sin advertirlo. Un proyecto 4/4 y otro 6/10 producen cobertura micro de 10/14, aproximadamente 71,4 %, mientras el promedio de sus porcentajes es 80 %. Ambos cálculos responden preguntas distintas y deben nombrarse.

Relaciones: [[Conversion y formalizacion]], [[Metricas de producto]] y [[Decisiones de diseno]].
