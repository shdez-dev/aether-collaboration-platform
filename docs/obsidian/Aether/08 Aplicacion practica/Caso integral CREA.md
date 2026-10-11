---
title: "Caso integral CREA"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Caso integral CREA

## Naturaleza del ejemplo

Este caso es ficticio y sirve para validar el diseño. CREA aparece en los documentos de producto como ejemplo de contexto institucional; los nombres, plazos y resultados siguientes son ilustrativos y no representan usuarios o hechos reales.

## Configuración

Una institución crea el workspace «CREA Cohorte Piloto» con modo institucional. Camila administra el contexto, Martín coordina ingreso, Ana actúa como mentora, Diego evalúa y Paula liderará el proyecto si acepta. La rúbrica exige pertinencia, evidencia del problema, viabilidad y beneficiario definido.

El estándar v1 exige problema, responsable aceptado, alcance, documento base, próximo hito y equipo proporcional al trabajo. La cadencia de revisión propuesta es semanal.

## Recorrido

| Momento | Acción humana | Respuesta de Aether |
| :--- | :--- | :--- |
| Recepción | Paula presenta una propuesta para reducir espera en atención estudiantil | Crea expediente y confirma próxima revisión |
| Triage | Martín comprueba elegibilidad y pide datos de espera | Registra criterios y habilita devolución |
| Diagnóstico | Paula y Ana realizan entrevistas y delimitan un piloto | Conserva evidencia y supuestos |
| Evaluación | Diego revisa una versión del expediente | Guarda evaluación independiente |
| Decisión | El aprobador acepta continuar bajo alcance de piloto | Registra motivo y condiciones |
| Conversión | Martín crea el proyecto vinculado | Conserva iniciativa y propone estructura |
| Formalización | Paula acepta liderazgo, equipo y alcance | Comprueba estándar v1 y registra decisión |
| Planificación | Equipo define prototipo, piloto y medición | Relaciona tareas, entregables, hitos y capacidad |
| Ejecución | Un acceso a datos se retrasa | Muestra bloqueo, impacto y responsable |
| Cambio | Se reduce alcance del piloto con aprobación | Conserva plan previo y nuevo compromiso |
| Entrega | Beneficiario acepta prototipo y reporte | Vincula aceptación a versiones |
| Cierre | Paula registra pendientes y continuidad | Libera capacidad y programa seguimiento |
| Resultado | Se mide tiempo de espera después del piloto | Distingue entrega aceptada de impacto medido |

## Pruebas de excepciones

Si Paula no acepta liderazgo, el proyecto permanece pendiente de formalización. Martín no se convierte automáticamente en ejecutor.

Si la institución publica estándar v2 durante la ejecución, el proyecto continúa con v1 hasta adoptar el cambio de forma explícita. El reporte indica la versión utilizada.

Si Diego abandona la institución, se revoca su acceso activo y se conserva la evaluación atribuida. Si una persona externa participa como patrocinadora, recibe únicamente el resumen concedido.

Si Redis falla al aprobar el proyecto, la decisión permanece confirmada y la notificación queda pendiente. La UI puede recuperar el estado desde la API.

## Criterio de éxito del caso

Cada participante puede explicar qué debe hacer, con qué autoridad y qué resultado produce su acción. La dirección puede rastrear el indicador final hasta el proyecto, la iniciativa y la decisión original.

El caso se utiliza como recorrido de piloto y como base de fixtures para [[Casos de aceptacion]]. Los documentos de trabajo se crean desde las plantillas de esta carpeta.
