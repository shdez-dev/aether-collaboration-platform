---
title: "Mapa de dominios greenfield"
tipo: "diseño de dominio"
estado: "propuesto"
---

# Mapa de dominios greenfield

## Dominio central

El dominio central es el gobierno de una oportunidad desde su ingreso hasta la evidencia de resultados. Aether se diferencia si mantiene continuidad semántica entre evaluación, decisión, formalización, ejecución y aprendizaje.

| Contexto | Responsabilidad | Objetos principales | Invariantes |
| :--- | :--- | :--- | :--- |
| Intake | Capturar y calificar una necesidad | Iniciativa, borrador, evidencia inicial, clasificación | Un borrador no participa en decisiones; toda presentación tiene autor y versión |
| Evaluación | Aplicar criterios y producir recomendación | Estándar, versión, dimensión, evaluación, hallazgo | Una evaluación publicada conserva la versión exacta del estándar |
| Decisión | Resolver el destino de una iniciativa | Decisión, condición, motivo, comité | Solo actores autorizados deciden; toda decisión tiene fundamento y fecha |
| Formalización | Crear un compromiso ejecutable | Conversión, mandato, proyecto, roles iniciales | Una conversión idempotente produce como máximo un proyecto por decisión |
| Ejecución | Planificar, coordinar y controlar trabajo | Proyecto, hito, entregable, tarea, riesgo, cambio | Todo proyecto activo tiene líder, patrocinador, objetivo y próximo hito |
| Evidencia y aprendizaje | Demostrar resultados y conservar conocimiento | Evidencia, resultado, lección, cierre | No se cierra sin resolución de entregables y declaración de resultados |

## Dominios de apoyo

| Contexto | Responsabilidad | Límite explícito |
| :--- | :--- | :--- |
| Identidad y acceso | Sesiones, membresías, políticas y autorización | No decide reglas de negocio del proyecto |
| Organización y espacios | Tenencia, configuración, equipos y estructura | No replica perfiles del proveedor de identidad |
| Documentos | Metadatos, versiones, edición y almacenamiento | No define por sí mismo que una evidencia sea aceptada |
| Comunicación | Notificaciones, preferencias y bandeja | No es fuente de verdad del estado de negocio |
| Auditoría | Registro inmutable de acciones relevantes | No reemplaza telemetría operacional |
| Portfolio | Priorización, capacidad, dependencias y resultados agregados | Consume proyectos, no modifica su historia directamente |
| Programas y red | Coordinación entre organizaciones bajo acuerdos explícitos | Nunca rompe aislamiento de tenencia |
| Suscripción | Planes, medición y facturación | No contiene autorización fina del producto |
| Inteligencia asistida | Resumen, búsqueda y propuestas | No ejecuta decisiones irreversibles sin confirmación |

## Relaciones entre contextos

| Productor | Consumidor | Contrato |
| :--- | :--- | :--- |
| Intake | Evaluación | Identificador, versión presentada, propietario y alcance |
| Evaluación | Decisión | Resultado, cobertura, hallazgos, versión del estándar |
| Decisión | Formalización | Resolución aprobada, condiciones y mandato |
| Formalización | Ejecución | Proyecto creado, roles confirmados y referencia de origen |
| Ejecución | Evidencia y aprendizaje | Entregables, cambios, resultados y riesgos resueltos |
| Todos los contextos | Auditoría | Actor, acción, recurso, alcance, resultado, tiempo y correlación |
| Todos los contextos | Comunicación | Evento notificable sin datos sensibles innecesarios |

Las integraciones internas utilizan llamadas de aplicación dentro del monolito cuando se necesita consistencia inmediata. Los efectos secundarios posteriores al commit se publican mediante outbox. Un evento no se usa para ocultar una transacción distribuida dentro del mismo proceso.

## Estados canónicos del flujo principal

| Entidad | Estados iniciales |
| :--- | :--- |
| Iniciativa | borrador, presentada, en_triage, en_evaluacion, pendiente_decision, aprobada, rechazada, pausada, convertida, retirada |
| Evaluación | borrador, en_revision, publicada, anulada |
| Conversión | pendiente, procesando, completada, fallida_compensable |
| Proyecto | preparacion, activo, en_pausa, en_cierre, cerrado, cancelado |

Cada transición se documentará como comando con precondiciones, permisos, efectos, evento y código de error. Los estados finales no se reabren mediante edición directa. Se usa una transición formal que preserve el motivo.

## Relaciones

El mapa se materializa en [[Modelo de datos greenfield]], [[Backend y reglas de dominio]] y [[API, eventos y trabajos asincronos]].
