---
title: "Modelo de datos greenfield"
tipo: "datos"
estado: "conceptual"
---

# Modelo de datos greenfield

## Criterios

El nuevo esquema se deriva del dominio, no del esquema anterior. Cada tabla de negocio incluye identificador estable, organización, marcas temporales, versión para concurrencia y clasificación cuando corresponda. Las relaciones críticas se protegen con claves foráneas, unicidad, checks y transacciones. El borrado lógico no se aplica universalmente; se elige según auditoría, privacidad y semántica.

## Agregados y relaciones

| Agregado | Raíz | Componentes | Regla crítica |
| :--- | :--- | :--- | :--- |
| Organización | organization | membership, workspace, team, policy | El slug y los identificadores externos son únicos en su ámbito |
| Iniciativa | initiative | submission_version, attachment_ref, classification | Una versión presentada es inmutable |
| Estándar | standard | standard_version, dimension, criterion | Una versión publicada no se edita |
| Evaluación | assessment | answer, finding, conflict_declaration | Pertenece a una iniciativa y versión de estándar exactas |
| Decisión | decision | condition, vote_ref | Una resolución publicada no se reemplaza; se supersede formalmente |
| Conversión | conversion | checkpoint, role_confirmation | Clave única por decisión aprobada |
| Proyecto | project | milestone, task, risk, change_request, role_assignment | Cambios de línea base usan versión y aprobación |
| Documento | document | document_version, blob_ref, relation | El binario privado no se sirve por ruta pública permanente |
| Cierre | closure | outcome, lesson, unresolved_item | Pertenece a una versión cerrada del proyecto |

## Tenencia y autorización

organization_id es obligatorio en recursos de una organización. workspace_id se incorpora cuando el aislamiento funcional lo requiere. Las claves compuestas y restricciones impiden relacionar accidentalmente objetos de organizaciones diferentes. Los repositorios reciben un contexto de acceso obligatorio. Se evaluará Row Level Security como defensa adicional mediante prototipo, pero no sustituirá la autorización de negocio.

## Historia y auditoría

La historia de dominio no se implementa copiando cada fila indiscriminadamente. Los cambios que alteran una decisión o línea base generan una versión o entidad de cambio. La auditoría conserva quién intentó qué, sobre qué alcance, con qué resultado y correlación. Datos sensibles se minimizan y, cuando deban aparecer, se redactan según permiso.

## Concurrencia e idempotencia

Los agregados modificables incluyen version. Una actualización exige la versión observada y falla con conflicto si cambió. Las operaciones reintentables aceptan una idempotency key acotada a actor, organización, ruta y ventana. Se almacena huella de solicitud y resultado para impedir que la misma clave represente otra operación.

## Migraciones

| Etapa | Regla |
| :--- | :--- |
| Expandir | Añadir estructuras compatibles sin exigir despliegue simultáneo |
| Migrar | Completar datos con proceso reanudable, medido e idempotente |
| Verificar | Comparar conteos, restricciones, muestras y reglas de negocio |
| Contraer | Retirar estructura antigua solo cuando ningún proceso la use |

No se editan migraciones ya aplicadas. Cada migración dispone de impacto, bloqueo esperado, estrategia de recuperación y prueba sobre volumen representativo.

## Clasificación y retención

| Clase | Ejemplo | Controles |
| :--- | :--- | :--- |
| Pública | Descripción publicada intencionalmente | Aprobación de publicación y cacheable según política |
| Interna | Planes y comentarios de equipo | Acceso de miembros autorizados |
| Confidencial | Evaluaciones, presupuestos, evidencia sensible | Acceso explícito, trazabilidad y exportación limitada |
| Restringida | Identidad, credenciales, datos regulados | Minimización, cifrado, acceso excepcional y retención estricta |

## Relaciones

Las entidades implementan [[Mapa de dominios greenfield]]. Privacidad y amenazas se tratan en [[Seguridad y modelo de amenazas]].
