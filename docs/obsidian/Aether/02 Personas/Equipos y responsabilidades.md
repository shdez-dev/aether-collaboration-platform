---
title: "Equipos y responsabilidades"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Equipos y responsabilidades

## Tres relaciones diferentes

Membresía expresa quién participa. Rol operativo expresa para qué participa. Asignación de trabajo expresa qué compromiso concreto debe ejecutar. Vincular una persona a un equipo no equivale a asignarle todas las tarjetas del proyecto.

El repositorio contiene Team, TeamMember, ProjectTeam, ProjectMember y ProjectRoleAssignment. La especificación debe preservar su propósito sin mantener listas redundantes de autoridad que diverjan.

## Fuente de verdad propuesta

| Concepto | Autoridad | Regla |
| :--- | :--- | :--- |
| Equipo reutilizable | Workspace | No cruza de ámbito por edición genérica |
| Participación en proyecto | Miembro directo o equipo asignado | Se muestra el origen del acceso |
| Responsabilidad principal | Asignación PROJECT_LEAD vigente | Una persona responsable por proyecto |
| Mentoría | Asignación MENTOR | Vigencia y alcance explícitos |
| Coordinación de ingreso | Asignación o equipo institucional autorizado | No implica liderazgo de ejecución |
| Compromiso de tarea | Responsable de tarea | Puede colaborar más de una persona |
| Capacidad | Disponibilidad y asignación temporal | Se mide en una unidad común |

## Corrección metodológica de la conversión

La conversión actual puede usar como propietario al líder, al coordinador o al actor, y puede asociar el equipo institucional de iniciativas al nuevo proyecto. Es una conveniencia técnica que no prueba aceptación del compromiso.

El diseño objetivo exige un líder identificado que acepte la responsabilidad. El equipo de triage conserva su función de gobierno o seguimiento; no se convierte automáticamente en equipo ejecutor. El patrocinador conserva un rol de patrocinio o lectura, sin convertirse por defecto en COLLABORATOR.

Si no existe líder disponible, el proyecto permanece pendiente de formalización y genera una tarea de asignación. La ausencia de capacidad no debe ocultarse asignando al administrador.

## Sustitución y ausencia

Cada rol crítico debe tener una política de suplencia. Una ausencia temporal registra sustituto y vigencia; una sustitución definitiva finaliza la asignación anterior y crea otra. El historial permite reconstruir quién era responsable cuando se tomó una decisión.

La baja de un equipo no debe eliminar los proyectos que atendía. La plataforma presenta impacto, miembros afectados, tareas pendientes y opciones de reasignación antes de confirmar.

## Acuerdo del equipo

El equipo define frecuencia de revisión, canal de escalamiento, límites de trabajo en curso y criterios de finalización. Este acuerdo pertenece al proyecto y puede basarse en una plantilla del workspace. Su cumplimiento se evalúa por resultados y compromisos, sin usar presencia en línea como sustituto de productividad.

Relaciones: [[Actores y necesidades]], [[Portfolios y capacidad]] y [[Conversion y formalizacion]].
