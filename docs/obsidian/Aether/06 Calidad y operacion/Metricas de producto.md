---
title: "Metricas de producto"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Metricas de producto

## Principio

Cada indicador necesita pregunta, población, período, unidad y fuente. Una métrica sin denominador o con datos faltantes interpretados como cero produce decisiones equivocadas.

## Diccionario propuesto

| Indicador | Definición | Segmentación |
| :--- | :--- | :--- |
| Tiempo de primera respuesta | Primera respuesta humana menos recepción | Programa y cohorte |
| Tiempo de decisión | Decisión final menos recepción | Resultado y tipo |
| Antigüedad pendiente | Ahora menos entrada al estado actual | Responsable y estado |
| Conversión | Iniciativas aprobadas convertidas / aprobadas elegibles | Cohorte |
| Formalización válida | Proyectos que cumplen la puerta / candidatos | Estándar y versión |
| Tiempo hasta primer valor | Primer compromiso aceptado menos activación | Contexto y rol |
| Cumplimiento de hitos | Hitos aceptados en fecha / hitos comprometidos vencidos | Proyecto y período |
| Cobertura | Requisitos válidos / aplicables evaluables | Versión de estándar |
| Riesgo de capacidad | Asignación que excede disponibilidad | Persona y período |
| Resultado medido | Proyectos con medición posterior / cerrados que la requieren | Programa |
| Uso efectivo | Usuarios que completan su trabajo esperado | Rol y período |
| Intervención manual | Incidencias que requieren desarrollador | Recorrido y causa |

## Tiempo en etapas

Medir estadías completadas y expedientes todavía abiertos por separado. El promedio de transiciones terminadas puede parecer favorable mientras los casos atascados quedan fuera del cálculo. Mostrar mediana, percentiles y antigüedad de los pendientes cuando exista volumen suficiente.

InitiativeController calcula tiempos a partir de historiales mediante LEAD. La especificación objetivo debe controlar eventos administrativos que repiten estado, como una conversión APPROVED a APPROVED, para que no se interpreten como una nueva etapa de evaluación.

## Progreso y resultado

Cerrar tarjetas mide movimiento operativo. Aceptar entregables mide cumplimiento. Medir un cambio en el beneficiario mide resultado. Los tres pueden aparecer juntos, pero deben tener nombres diferentes.

No usar número de comentarios, tiempo en línea o edición de documentos como medida automática de productividad. La plataforma acompaña coordinación y aprendizaje; esas señales carecen de contexto suficiente para evaluar desempeño personal.

## Datos faltantes y privacidad

Mostrar «sin datos», «no aplicable» y «no medido» de forma distinta. Un tablero parcial informa cuántos proyectos contiene y qué acceso lo limita. Las comparaciones entre organizaciones requieren política explícita y agregación adecuada.

## Instrumentación

Cada evento analítico debe definir finalidad, campos mínimos, retención y ámbito. Registrar el éxito real de una acción, no solamente el clic. Separar analítica de producto de auditoría de decisiones para evitar que una política de retención borre evidencia necesaria.

Relaciones: [[Estandares y cobertura]], [[Portfolios y capacidad]] y [[Vision y propuesta de valor]].
