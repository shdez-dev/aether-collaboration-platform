---
title: "Modelo de dominio"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Modelo de dominio

## Agregados y relaciones

| Agregado | Entidades principales observadas | Autoridad del agregado |
| :--- | :--- | :--- |
| Identidad | User, UserSession, UserPreferences | Sesiones y preferencias |
| Organización | Organization, OrganizationMember, Subscription | Gobierno y contratación |
| Workspace | Workspace, WorkspaceMember, WorkspaceProjectStandard | Contexto y políticas |
| Iniciativa | Initiative, participantes, evaluaciones e historiales | Expediente de ingreso |
| Proyecto | Project, miembros, roles, hitos y equipos | Compromiso de ejecución |
| Tablero | Board, List, Card, dependencias y sprints | Trabajo operativo |
| Documento | Document, permisos, comentarios y versiones | Contenido y evidencia |
| Portfolio | Portfolio, enlaces, capacidad y alertas | Coordinación agregada |
| Red | Network, Program, invitaciones y grants | Colaboración externa |
| Comunicación | Event, Notification, actividad y presencia | Hechos y señales derivadas |

El inventario exacto de modelos y campos está en [[Inventario de datos]]. Las entidades conceptuales entregable, aceptación, resultado y outbox son extensiones propuestas cuando no cuentan con una representación suficientemente explícita.

## Invariantes de dominio

| Código | Regla objetivo |
| :--- | :--- |
| INV-01 | Todo proyecto tiene un workspace y un responsable principal vigente |
| INV-02 | Una iniciativa genera como máximo un proyecto por conversión canónica |
| INV-03 | Un tablero operativo pertenece a un solo proyecto |
| INV-04 | Recurso y proyecto comparten workspace salvo operación de transferencia definida |
| INV-05 | Una asignación de equipo no cruza de workspace |
| INV-06 | Una decisión aprobada conserva la versión evaluada |
| INV-07 | Estado, historial y evento durable se guardan atómicamente |
| INV-08 | Una revocación aplicable invalida el acceso correspondiente |
| INV-09 | Un portfolio no otorga permisos de proyecto por asociación |
| INV-10 | No existen ciclos de dependencias |
| INV-11 | El estándar aplicado es una versión inmutable |
| INV-12 | Cerrar, archivar y eliminar son operaciones distintas |

Las invariantes deben reflejarse en restricciones de base cuando sea posible y en servicios transaccionales cuando dependan de políticas. La validación de interfaz facilita el uso, pero no constituye la garantía.

## Datos de negocio, derivados y efímeros

Las decisiones, membresías, compromisos y versiones de documentos son persistentes. Cobertura, progreso y capacidad agregada son lecturas derivadas con procedencia. Presencia y escritura en curso son señales efímeras.

Un indicador derivado debe informar qué entradas utiliza y cuándo se calculó. No debe ser editable como si fuera una decisión independiente. El usuario puede registrar una evaluación manual de salud, pero su fundamento y fecha quedan visibles.

## Evolución de esquema

Las nuevas entidades deben introducirse mediante migraciones incrementales. Los estados heredados se conservan hasta disponer de un mapeo y reporte de excepciones. No inferir aprobación histórica a partir de una fecha o un documento presente.

El estándar y las evidencias necesitan versionado; los permisos necesitan vigencia; la capacidad necesita períodos; la auditoría necesita referencias estables aunque una identidad sea desactivada.

Relaciones: [[Ciclo del proyecto]], [[Estado actual y brechas]] y [[Operacion y continuidad]].
