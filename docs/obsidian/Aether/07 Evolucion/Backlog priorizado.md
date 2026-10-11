---
title: "Backlog priorizado"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Backlog priorizado

## Convenciones

P0 significa integridad o coherencia necesaria antes de un piloto con datos relevantes. P1 significa cierre del recorrido y operación. P2 significa extensión comercial o mejora que depende de la oferta elegida. Si se vende un módulo de P2, sus requisitos pasan a bloquear esa oferta.

Todos los elementos siguientes están pendientes de validación e implementación en esta especificación. La estimación y asignación de personas debe realizarse después de una revisión técnica por dominio.

| ID | Prioridad | Resultado entregable | Dependencias | Responsable funcional | Aceptación |
| :--- | :--- | :--- | :--- | :--- | :--- |
| REQ-01 | P0 | Comando canónico de transición con guardas y versión | D-04 | Ingeniería de dominio | CA-03, CA-04 |
| REQ-02 | P0 | Cálculo por estándar aplicado y datos desconocidos | D-05 | Producto y dominio | CA-05 |
| REQ-03 | P0 | Separar elegibilidad, decisión y cumplimiento | REQ-01, REQ-02 | Producto | CA-06 |
| REQ-04 | P0 | Conversión con roles y compromisos explícitos | REQ-03 | Dominio institucional | CA-02, CA-07 |
| REQ-05 | P0 | Matriz única y regresión de accesos por ámbito | D-06 | Seguridad y backend | CA-01, CA-08 |
| REQ-06 | P0 | Estado, historial y outbox atómicos | REQ-01 | Backend | CA-09 |
| REQ-07 | P0 | Contrato de persistencia y recuperación Yjs | REQ-05 | Tiempo real | CA-10 |
| REQ-08 | P0 | Arquitectura de sesión y revocación consistente | REQ-05 | Seguridad y frontend | CA-08 |
| REQ-09 | P1 | Entregables, versiones y aceptación | REQ-03 | Producto y dominio | CA-11 |
| REQ-10 | P1 | Cierre, cancelación y continuidad | REQ-09 | Producto | CA-12 |
| REQ-11 | P1 | Bandejas, devolución y escalamiento | REQ-01, REQ-06 | Experiencia | CA-13 |
| REQ-12 | P1 | Métricas con denominadores y estadías abiertas | REQ-02, REQ-10 | Datos | CA-14 |
| REQ-13 | P1 | Capacidad consistente y alertas accionables | REQ-05 | Portfolio | CA-15 |
| REQ-14 | P1 | Documentos y exportaciones con permiso y versión | REQ-05, REQ-09 | Evidencia | CA-16 |
| REQ-15 | P1 | Arranque único, migración y recuperación ensayada | REQ-06, REQ-07 | Operación | CA-17 |
| REQ-16 | P2 | Pago real, idempotencia y reconciliación | REQ-05, REQ-06 | Contratación | CA-18 |
| REQ-17 | P2 | Programa de red completo y acceso externo temporal | REQ-05, REQ-09 | Redes | CA-19 |
| REQ-18 | P2 | IA revisable y cuota transaccional | REQ-05, REQ-06 | IA y producto | CA-20 |
| REQ-19 | P1 | Navegación accesible por contexto y rol | REQ-05, REQ-11 | Experiencia | CA-21 |
| REQ-20 | P1 | Documentación y evidencias de liberación actualizadas | Todos los entregados | Producto y operación | PC-01 a PC-16 |

## Descomposición de un requisito

Cada requisito se divide en historia, contrato, persistencia, interfaz, pruebas y operación. La historia identifica actor, necesidad y resultado. El contrato especifica casos de error y concurrencia. La migración explica el tratamiento de datos existentes.

Un requisito no se cierra únicamente con código fusionado. Su evidencia incluye pruebas ejecutadas, recorrido de interfaz cuando corresponda y ausencia de contradicciones en documentación.

## Priorización de cambios heredados

Antes de migrar estados o estándares, generar un reporte de proyectos incoherentes. Los casos ambiguos entran en una cola de revisión. No corregir por lote asignando una aprobación que nadie emitió.

La información del proyecto debe conservarse mientras se introduce el modelo nuevo. La compatibilidad temporal permite que frontend y backend migren sin una interrupción extensa.

Relaciones: [[Casos de aceptacion]], [[Hoja de ruta]] y [[Estado actual y brechas]].
