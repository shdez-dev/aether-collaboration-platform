---
title: "Requerimientos no funcionales greenfield"
tipo: "especificación de calidad"
estado: "objetivos a validar"
---

# Requerimientos no funcionales greenfield

Los valores son objetivos iniciales, no promesas comerciales. Cada uno debe medirse con una carga, alcance y ventana definidos. Si el negocio requiere otro nivel, se registra costo y decisión.

## Seguridad y privacidad

| ID | Requerimiento | Medición y umbral inicial |
| :--- | :--- | :--- |
| RNF-SEC-001 | Los controles deben alinearse con OWASP ASVS nivel 2 como base | Matriz de controles revisada antes de lanzamiento y en cambios sensibles |
| RNF-SEC-002 | Todo tráfico externo e interno no confiable debe usar cifrado en tránsito | TLS vigente, redirección segura y pruebas automáticas de configuración |
| RNF-SEC-003 | Datos y respaldos deben cifrarse en reposo con claves administradas | Evidencia del proveedor, rotación y acceso mínimo |
| RNF-SEC-004 | Los secretos no deben residir en código, imágenes ni registros | Escaneo en precommit y CI, inventario y rotación documentada |
| RNF-SEC-005 | Toda consulta de datos de negocio debe estar acotada por tenencia | Pruebas negativas entre organizaciones para repositorios, API, eventos y archivos |
| RNF-SEC-006 | Vulnerabilidades críticas confirmadas deben mitigarse dentro de 24 horas y altas dentro de 7 días | Tiempo desde clasificación hasta mitigación, con excepción aprobada |
| RNF-PRV-001 | La recopilación debe limitarse al propósito documentado | Inventario, base de tratamiento, retención y propietario por categoría |
| RNF-PRV-002 | Exportación y eliminación deben completarse dentro del plazo normativo aplicable | Caso de prueba y evidencia del proceso, incluidas copias y excepciones legales |

## Disponibilidad, continuidad y rendimiento

| ID | Requerimiento | Medición y umbral inicial |
| :--- | :--- | :--- |
| RNF-AVL-001 | El flujo web autenticado y la API crítica deben alcanzar 99,9 por ciento mensual | SLI de solicitudes válidas exitosas, excluyendo mantenimiento anunciado |
| RNF-AVL-002 | El sistema debe recuperarse de pérdida regional según el nivel contratado | Objetivo inicial RTO de 2 horas y RPO de 15 minutos |
| RNF-AVL-003 | Los respaldos deben ser restaurables, no solo existentes | Restauración automatizada mensual y ejercicio integral trimestral |
| RNF-PER-001 | Las lecturas interactivas críticas deben responder en p95 menor a 400 ms en servidor | Carga de referencia documentada, sin contar latencia del dispositivo |
| RNF-PER-002 | Las escrituras críticas deben responder en p95 menor a 800 ms | Incluye commit y creación de outbox, excluye efectos asíncronos |
| RNF-PER-003 | El primer contenido útil debe cumplir objetivos Core Web Vitals acordados | Medición real por percentil y segmento, no solo laboratorio |
| RNF-PER-004 | Una notificación interna debe estar visible en p95 menor a 5 segundos | Desde commit del evento hasta disponibilidad para el usuario conectado |
| RNF-SCL-001 | El sistema debe soportar el escenario inicial sin rediseño | Base de prueba: 100 organizaciones, 5.000 usuarios registrados, 500 concurrentes y 50 solicitudes por segundo sostenidas |

## Accesibilidad, compatibilidad y experiencia

| ID | Requerimiento | Medición y umbral inicial |
| :--- | :--- | :--- |
| RNF-ACC-001 | Las experiencias de usuario deben cumplir WCAG 2.2 nivel AA | Automatización más revisión manual de teclado, lector y contraste |
| RNF-ACC-002 | Ninguna acción crítica debe depender solo de color, arrastre o puntero | Casos de aceptación por teclado y tecnología asistiva |
| RNF-CMP-001 | Se soportan las dos últimas versiones estables de navegadores objetivo | Matriz revisada por lanzamiento con analítica real |
| RNF-UX-001 | Errores deben explicar qué ocurrió, qué se conservó y cómo continuar | Revisión de contenido y pruebas de escenarios fallidos |

## Mantenibilidad y entrega

| ID | Requerimiento | Medición y umbral inicial |
| :--- | :--- | :--- |
| RNF-MNT-001 | Los módulos de dominio no deben depender de frameworks web ni proveedores | Pruebas de límites de importación en CI |
| RNF-MNT-002 | Toda modificación de esquema debe ser compatible con despliegue progresivo | Migraciones expandir, migrar, contraer y ensayo en copia anonimizada |
| RNF-MNT-003 | Una instalación limpia debe ser reproducible desde documentación | CI parte de entorno vacío y usa lockfile inmutable |
| RNF-MNT-004 | Dependencias y runtime deben seguir una política de soporte | Inventario automático, actualización periódica y bloqueo de componentes sin soporte |
| RNF-TST-001 | Ninguna ruta crítica se libera sin pruebas unitarias, integración, contrato y E2E aplicables | Matriz de trazabilidad sin huecos M0 y M1 |
| RNF-REL-001 | Un despliegue debe poder detenerse o revertirse sin pérdida de datos | Prueba de rollback de aplicación y estrategia forward para datos |

## Observabilidad y soporte

| ID | Requerimiento | Medición y umbral inicial |
| :--- | :--- | :--- |
| RNF-OBS-001 | Cada solicitud y trabajo debe ser correlacionable entre logs, trazas y eventos | correlation_id y trace_id disponibles, sin datos sensibles |
| RNF-OBS-002 | Los SLO críticos deben tener alertas basadas en impacto | Alertas por error budget, latencia, cola, saturación y fallos de dependencia |
| RNF-OBS-003 | La telemetría debe ser estructurada y neutral respecto del proveedor | Instrumentación OpenTelemetry y exportador configurable |
| RNF-SUP-001 | Cada incidente crítico debe tener runbook, propietario y comunicación | Simulación semestral y retrospectiva sin culpa |

## Relaciones

Los SLI y runbooks se detallan en [[Observabilidad, continuidad y soporte]]. Las puertas se incorporan a [[Estrategia de pruebas greenfield]] y [[Definition of Ready, Done y Release]].
