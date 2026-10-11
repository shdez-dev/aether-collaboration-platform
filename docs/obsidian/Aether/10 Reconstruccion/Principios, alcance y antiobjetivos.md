---
title: "Principios, alcance y antiobjetivos"
tipo: "producto greenfield"
estado: "propuesto"
---

# Principios, alcance y antiobjetivos

## Tesis de producto

Aether debe permitir que una organización reciba una necesidad, determine si merece inversión, la convierta en un proyecto gobernable y demuestre qué ocurrió. La unidad de valor no es una tarjeta ni un documento aislado. Es una decisión institucional trazable que llega a ejecución y produce evidencia.

## Principios obligatorios

| Código | Principio | Consecuencia de diseño |
| :--- | :--- | :--- |
| P01 | Una sola fuente de verdad por concepto | Estados, permisos y reglas no se duplican entre interfaz, API y trabajos |
| P02 | Seguridad por defecto | Toda operación se deniega hasta demostrar identidad, pertenencia, rol, alcance y condición del recurso |
| P03 | Trazabilidad de extremo a extremo | Una iniciativa convertida conserva origen, decisión, responsables y evidencia posterior |
| P04 | Flujos explícitos | Cada cambio de estado tiene precondiciones, actor, marca temporal y motivo |
| P05 | Integridad antes que velocidad aparente | Las operaciones compuestas usan transacciones, idempotencia y restricciones de base de datos |
| P06 | Complejidad proporcional | Se inicia con un monolito modular y se distribuye solo ante evidencia de escala o aislamiento |
| P07 | Accesibilidad y privacidad desde el diseño | No se tratan como revisión final ni como trabajo opcional |
| P08 | Automatización asistida, decisión humana | La IA puede proponer y resumir, pero no aprueba, asigna presupuesto ni elimina evidencia por sí sola |
| P09 | Operabilidad incorporada | Cada capacidad nace con telemetría, runbook, respaldo y criterio de degradación |
| P10 | Evolución compatible | Datos, eventos y contratos tienen política de cambio y migración |

## Alcance del primer producto operable

El primer producto debe cubrir identidad institucional, organizaciones, espacios de trabajo, ingreso de iniciativas, evaluación con estándares versionados, decisión, conversión transaccional a proyecto, planificación básica, tareas, hitos, evidencia documental, notificaciones, auditoría y un tablero mínimo de resultados. Debe incluir administración, exportación, recuperación de cuenta y soporte operativo.

La colaboración simultánea avanzada puede incorporarse después de validar que la edición documental compartida sea central. Los portfolios sofisticados, redes interorganizacionales, facturación automática, marketplace de plantillas e IA generativa quedan fuera del primer corte salvo que una validación comercial demuestre dependencia directa.

## Antiobjetivos

| Código | La plataforma no debe convertirse en | Motivo |
| :--- | :--- | :--- |
| A01 | Un gestor genérico de tareas | Perdería la relación con evaluación, gobierno y evidencia |
| A02 | Una réplica de una suite de oficina | Los documentos existen al servicio de decisiones y proyectos |
| A03 | Una red social sin propósito operativo | La interacción debe estar vinculada a trabajo, conocimiento o programa |
| A04 | Un conjunto prematuro de microservicios | Aumentaría fallos, costo y coordinación antes de necesitarlos |
| A05 | Un sistema de autorización basado solo en roles globales | Los permisos dependen también de organización, espacio, equipo, recurso y estado |
| A06 | Un almacén de archivos sin clasificación | La evidencia requiere propietario, alcance, versión, retención y auditoría |
| A07 | Una automatización opaca | Toda sugerencia automática debe indicar origen, límites y responsable de confirmación |

## Métricas de éxito de producto

| Resultado | Indicador inicial | Definición |
| :--- | :--- | :--- |
| Menor fricción de ingreso | Tiempo mediano hasta iniciativa válida | Desde creación hasta cumplimiento de datos mínimos |
| Mejores decisiones | Porcentaje de decisiones con estándar y evidencia completos | Excluye borradores |
| Conversión confiable | Porcentaje de conversiones completadas sin reparación manual | Una sola iniciativa produce un solo proyecto válido |
| Ejecución visible | Porcentaje de proyectos activos con responsable, próximo hito y estado reciente | Ventana acordada por la organización |
| Aprendizaje | Porcentaje de proyectos cerrados con resultados y lecciones | Requiere evidencia asociada |
| Confianza | Incidentes de acceso indebido o pérdida de datos | Objetivo cero, con medición y respuesta formal |

## Relaciones

Los principios gobiernan [[Arquitectura objetivo greenfield]], [[Seguridad y modelo de amenazas]] y [[Definition of Ready, Done y Release]]. El alcance alimenta [[Roadmap de reconstruccion]].
