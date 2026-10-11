---
title: "Matriz de permisos"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Matriz de permisos

## Regla general propuesta

La autorización combina identidad vigente, pertenencia o concesión explícita, recurso, acción, estado del recurso y restricciones del programa. El backend decide. La interfaz muestra las mismas capacidades, pero ocultar un botón no constituye un control de acceso.

La pertenencia a un workspace no debe conceder automáticamente acceso a todos sus proyectos. En el servicio actual los administradores del workspace conservan acceso de gobierno; los demás usuarios necesitan una relación autorizante.

## Matriz funcional objetivo

| Actor en su ámbito | Leer expediente | Editar contenido | Evaluar | Aprobar etapa | Administrar participantes | Ver facturación |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| Solicitante | Propio y compartido | Borrador o devolución habilitada | No | No | No | No |
| Coordinador | Expedientes asignados | Campos de gestión | Si está asignado | Sólo con capacidad de aprobación | Ingreso y asignaciones autorizadas | No |
| Mentor | Asignados | Aportes y comentarios | Si no existe incompatibilidad | Sólo si tiene delegación válida | No por defecto | No |
| Evaluador | Expediente de evaluación | Su evaluación | Sí | No por defecto | No | No |
| Líder | Proyecto a cargo | Sí | Revisiones operativas | Transiciones delegadas | Equipo del proyecto | No |
| Colaborador | Proyecto autorizado | Trabajo asignado y compartido | No institucional | No | No | No |
| Lector | Recurso autorizado | No | No | No | No | No |
| Administrador de workspace | Ámbito de gobierno | Sí según política | Según programa | Según política | Workspace | No por ese rol |
| Responsable de portfolio | Resúmenes autorizados | Cartera y asignaciones | No por ese rol | No por ese rol | Miembros del portfolio según nivel | No |
| BILLING_ADMIN | Datos comerciales | Datos comerciales | No | No | No operativo | Sí |
| Externo | Recursos concedidos | Sólo con EDIT y campo permitido | Sólo asignado | No por defecto | No | No |

## Correspondencia con el código

ProjectAuthorizationService resuelve READ, CONTRIBUTE y MANAGE. Reconoce propietario, administración del workspace, membresía directa, equipo asignado, roles operativos y concesiones de red vigentes. PROJECT_LEAD puede gestionar; MENTOR y COLLABORATOR pueden contribuir. Esta resolución debe ser la referencia actual frente a documentación antigua que limita toda edición a administradores de workspace.

PortfolioAuthorizationService distingue VIEW, MANAGE y ADMIN, y declara que un rol de portfolio no otorga permisos de proyecto. OWNER y ADMIN de organización tienen gobierno de portfolio; BILLING_ADMIN no lo obtiene automáticamente.

La matriz objetivo refina acciones que hoy pueden quedar agrupadas en niveles amplios. Editar una tarea, invitar un miembro, aprobar un cierre y exportar información requieren capacidades distintas aunque compartan un ámbito.

## Precedencia y revocación

Una revocación explícita aplicable invalida concesiones anteriores. Una concesión externa válida puede permitir acceso sin membresía interna, pero debe incluir alcance, vigencia y organización emisora. Ningún rol puede superar una prohibición por recurso archivado o por conflicto de interés sin un procedimiento autorizado.

Revocar acceso debe cerrar o invalidar suscripciones de tiempo real, impedir nuevas descargas y limpiar datos del contexto en el cliente. No es posible retirar un archivo que la persona ya descargó; por eso las exportaciones necesitan minimización y auditoría.

## Pruebas obligatorias

La matriz se transforma en casos positivos y negativos por endpoint, detalle, búsqueda, contador, descarga y canal de tiempo real. Se prueban también usuarios con dos organizaciones, roles superpuestos, invitaciones vencidas y revocación durante una sesión.

Relaciones: [[Seguridad y datos]], [[Casos de aceptacion]] y [[Redes y programas]].
