---
title: "Organizaciones y membresias"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Organizaciones y membresias

## Modelo observado

El esquema incluye organizaciones personales, empresas, instituciones y operadores de red. OrganizationMember distingue OWNER, ADMIN, BILLING_ADMIN y MEMBER. También existen invitaciones y OrganizationAccessRevocation. Los workspaces se vinculan a una organización.

Las rutas permiten crear organizaciones, invitar, aceptar o revocar invitaciones, modificar miembros y transferir propiedad. Esta existencia respalda el diseño, pero no demuestra que todas las combinaciones de baja y transferencia estén probadas.

## Alta objetivo

1. El usuario crea o verifica su identidad.
2. Selecciona crear una organización o aceptar una invitación.
3. El servidor comprueba la vigencia del token y la correspondencia de identidad.
4. Se establece la membresía con su ámbito y rol.
5. Se asigna acceso a los workspaces necesarios mediante una política explícita.
6. La interfaz muestra organización activa, contexto y siguiente acción.

Aceptar una invitación dos veces debe devolver la membresía existente, sin duplicarla. Una invitación no concede permisos antes de su aceptación. Cambiar el correo del usuario no debe permitir apropiarse de invitaciones ajenas.

## Estados e invariantes

| Objeto | Estados conceptuales | Invariante |
| :--- | :--- | :--- |
| Invitación | Pendiente, aceptada, rechazada, revocada, vencida | Un token sólo puede consumirse bajo sus condiciones |
| Membresía | Activa, suspendida, revocada | La consulta de permisos considera vigencia |
| Propiedad | Propietario vigente, transferencia pendiente | La organización nunca queda sin responsable |
| Workspace | Activo, archivado | Archivar conserva historial |
| Sesión | Vigente, expirada, revocada | Cerrar sesión invalida continuidad autorizada |

Son estados conceptuales objetivo. La implementación puede representarlos mediante campos, registros de revocación o tablas específicas, siempre que el comportamiento sea equivalente.

## Baja y transferencia

Antes de retirar a un miembro se identifica si posee proyectos, coordina iniciativas, tiene tareas abiertas o mantiene integraciones. La operación exige una persona sucesora para cada responsabilidad obligatoria. Los comentarios y decisiones conservan autoría.

La transferencia de propiedad requiere autoridad actual, elegibilidad del destinatario y confirmación según política de cuenta. Debe aplicarse en una transacción y registrar quién transfirió, a quién, cuándo y por qué. Un descenso de plan no puede suprimir al propietario ni borrar proyectos.

## Cambio de contexto

El usuario puede pertenecer a varias organizaciones. Al cambiar el contexto, deben invalidarse consultas pendientes y cachés de la organización anterior. La URL y el servidor siguen siendo la autoridad sobre el recurso: no se debe confiar en un organizationId enviado por la interfaz.

Relaciones: [[Limites y contextos]], [[Planes y facturacion]] y [[Comunicacion y experiencia]].
