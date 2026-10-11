---
title: "API, eventos y trabajos asíncronos"
tipo: "contratos"
estado: "propuesto"
---

# API, eventos y trabajos asíncronos

## API HTTP

La API utiliza REST y OpenAPI 3.1. Los recursos se nombran con lenguaje del dominio. Los comandos sensibles pueden exponerse como acciones cuando una transición no equivale a reemplazar atributos. Los DTO se validan al entrar y se mapean a comandos; nunca se pasan directamente al almacenamiento.

| Aspecto | Regla |
| :--- | :--- |
| Identidad | Sesión de servidor y contexto organizacional explícito |
| Errores | application/problem+json con type, title, status, code, detail seguro y correlation_id |
| Paginación | Cursor estable con orden documentado |
| Concurrencia | ETag o version requerida en escrituras concurrentes |
| Idempotencia | Idempotency-Key en creación y comandos reintentables |
| Filtros | Lista permitida, límites y costo controlado |
| Fechas | UTC en transporte y zona explícita para presentación |
| Identificadores | Opacos, no secuenciales y no interpretables por clientes |
| Evolución | Cambio aditivo por defecto y deprecación con telemetría |

## Eventos de dominio e integración

Un evento describe un hecho confirmado en pasado, por ejemplo InitiativeSubmitted o ProjectCreated. Incluye event_id, event_type, occurred_at, aggregate_id, aggregate_version, organization_id, correlation_id, causation_id y schema_version. El payload contiene solo lo necesario para consumidores autorizados.

La transacción escribe el cambio y el registro outbox. El worker reclama filas con bloqueo, publica o ejecuta el efecto, registra intento y confirma. Los consumidores guardan event_id o una clave funcional para tolerar reentrega. Los fallos permanentes se mueven a una cola de revisión con causa y capacidad de replay controlado.

## Tiempo real

WebSocket acelera la percepción, pero no es fuente de verdad. La conexión autentica sesión y origen. Cada suscripción autoriza organización y recurso. Al reconectar, el cliente consulta estado por HTTP o solicita eventos desde un cursor si el caso lo justifica. Redis puede distribuir presencia y invalidaciones efímeras; no garantiza notificaciones de negocio.

## Trabajos

| Trabajo | Semántica | Protección |
| :--- | :--- | :--- |
| Correo | Al menos una vez con deduplicación | Plantilla versionada, preferencia y límite |
| Exportación | Reanudable | Snapshot lógico, alcance y artefacto temporal |
| Procesamiento de archivo | Pipeline por estados | Cuarentena, escaneo, checksum e idempotencia |
| Métricas de producto | Eventual | Datos mínimos y sin bloquear transacción principal |
| Recordatorios | Programado | Zona horaria, cancelación y clave única |
| IA | Asíncrono y cancelable | Consentimiento, presupuesto, fuentes y revisión |

## Compatibilidad

El contrato OpenAPI se compara en CI para detectar cambios incompatibles. Los eventos tienen esquemas versionados y pruebas de consumidor. No se reutiliza el nombre de un campo con significado diferente. La eliminación requiere confirmar que no existan consumidores mediante telemetría y ventana de deprecación.

## Relaciones

Las garantías se apoyan en [[Arquitectura objetivo greenfield]] y [[Modelo de datos greenfield]]. Los escenarios se prueban en [[Estrategia de pruebas greenfield]].
