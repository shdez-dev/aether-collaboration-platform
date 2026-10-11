---
title: "Portfolios y capacidad"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Portfolios y capacidad

## Propósito

El portfolio permite decidir sobre varios proyectos: prioridades, recursos, riesgo y resultados. Conserva la independencia operativa de cada proyecto y no amplía los permisos de sus miembros.

El esquema ya contiene Portfolio, PortfolioProject, PortfolioMember, disponibilidad de miembros, asignaciones de capacidad, alertas y auditorías de exportación. Las rutas ofrecen overview, capacity, alerts y export.csv.

## Información de gestión

| Vista | Pregunta | Regla de lectura |
| :--- | :--- | :--- |
| Resumen | ¿Qué compromisos concentra la cartera? | Proyectos únicos, fecha y filtros visibles |
| Madurez | ¿Qué falta para preparar proyectos? | Versión de estándar identificada |
| Riesgo | ¿Dónde intervenir? | Causa y responsable de cada alerta |
| Capacidad | ¿Existen recursos comprometidos en exceso? | Misma unidad y período |
| Resultados | ¿Qué valor se entregó? | Evidencia y estado de medición |
| Exportación | ¿Qué información puede compartirse? | Autorización y auditoría |

## Modelo de capacidad objetivo

Definir disponibilidad por persona y período, considerando jornada, ausencias y otras obligaciones. Asignar esfuerzo a proyectos en la misma unidad, preferiblemente horas por período cuando exista base real. Los porcentajes deben indicar su denominador.

Sobrecarga = máximo entre cero y asignación total menos disponibilidad. La ausencia de una estimación se representa como desconocida, no como cero. Una persona asignada a varios portfolios no aumenta su capacidad por aparecer en más de una agrupación.

Las asignaciones deben tener intervalos y autor. Modificar capacidad recalcula las alertas afectadas y conserva la explicación. Las tarjetas de trabajo no constituyen automáticamente un sistema confiable de imputación horaria.

## Alertas accionables

Una alerta necesita condición, evidencia, severidad, recurso, responsable, fecha y estado. Reconocer una alerta significa haberla visto; resolverla exige atender la causa o aceptar el riesgo con autoridad. Cuando la causa reaparece, debe reabrirse o generar un episodio relacionado sin perder historial.

Ejemplos: proyecto sin líder, revisión vencida, sobrecarga, hito retrasado, evidencia retirada y falta de medición de resultados.

## Integridad del ámbito

Sólo incluir proyectos de la organización o vinculaciones explícitamente permitidas por la política. Mover un proyecto a otro workspace u organización debe revisar portfolios, capacidad, documentos y participantes. No se debe mantener una vista agregada que filtre nombres privados a quien carece de permiso.

El resumen para dirección puede usar una proyección autorizada de indicadores sin conceder lectura del expediente completo. Esa proyección necesita contrato propio y controles de privacidad.

Relaciones: [[Matriz de permisos]], [[Metricas de producto]] y [[Modelo de dominio]].
