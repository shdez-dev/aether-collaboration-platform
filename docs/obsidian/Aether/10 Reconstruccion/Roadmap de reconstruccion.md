---
title: "Roadmap de reconstrucción"
tipo: "plan de entrega"
estado: "propuesto"
---

# Roadmap de reconstrucción

El roadmap se gobierna por resultados y puertas, no por fechas inventadas. La duración se estima después de medir capacidad del equipo y tamaño de historias. Cada hito entrega una rebanada demostrable y operable.

| Hito | Resultado | Alcance principal | Puerta de salida |
| :--- | :--- | :--- | :--- |
| H0 Descubrimiento | Problema y límites validados | Investigación, mapa de dominio, prototipo, ADR, amenazas y métricas | Actores confirman flujo y antiobjetivos; riesgos críticos tienen tratamiento |
| H1 Plataforma segura | Un miembro entra a un espacio aislado | Monorepo, CI, OIDC, sesión, organización, permisos, auditoría, telemetría y deploy | Pruebas multitenant, accesibilidad base, restore y recorrido sintético |
| H2 Decisión | Una iniciativa llega a resolución gobernada | Intake, estándares, evaluación, conflicto y decisión | Historia completa, versión inmutable, pruebas negativas y métricas |
| H3 Proyecto | Una aprobación se convierte y ejecuta | Conversión idempotente, roles, plan, tareas, hitos, riesgos y cambios | Fallos transaccionales probados, concurrencia y cierre básico |
| H4 Evidencia operable | El flujo produce evidencia y puede soportarse | Archivos, documentos versionados, avisos, exportación, cierre, runbooks y panel mínimo | Seguridad de archivos, RTO y RPO, SLO y soporte ensayados |
| H5 Piloto | Equipos reales completan el ciclo | Onboarding, migración seleccionada, feedback, rendimiento y contenido | Éxito de tareas, cero brechas críticas y plan de adopción |
| H6 Expansión | Capacidades avanzadas responden a demanda demostrada | Portfolio, red, billing, IA y colaboración simultánea según evidencia | Caso comercial, privacidad, costo y arquitectura aprobados por capacidad |

## Primera rebanada vertical

La primera rebanada no será un sistema de login aislado. Permitirá aceptar invitación, crear espacio, registrar una iniciativa mínima, presentarla y consultar su auditoría. Incluye base de datos, autorización, contrato, interfaz, telemetría, CI y despliegue. Con ello se valida el esqueleto real antes de multiplicar módulos.

## Orden de trabajo dentro de un hito

| Paso | Resultado |
| :--- | :--- |
| 1 | Hipótesis y métrica de resultado |
| 2 | Historia, escenarios y amenaza |
| 3 | Modelo y contrato |
| 4 | Rebanada de extremo a extremo detrás de flag |
| 5 | Pruebas, observabilidad y runbook |
| 6 | Validación con usuarios y operación |
| 7 | Decisión de continuar, ajustar o retirar |

## Capacidades que no deben adelantarse

Microservicios, motor genérico de workflows, editor colaborativo propio, sistema de facturación propio, data warehouse, personalización ilimitada y acciones autónomas de IA no entran antes de que su necesidad sea medible. La plataforma conserva puntos de extensión sin pagar desde el inicio todo el costo de esas soluciones.

## Relaciones

Las puertas se detallan en [[Definition of Ready, Done y Release]] y el tratamiento del sistema anterior en [[Migracion y convivencia con el legado]].
