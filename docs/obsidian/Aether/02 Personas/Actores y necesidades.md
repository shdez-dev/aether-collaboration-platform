---
title: "Actores y necesidades"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Actores y necesidades

## Catálogo de actores

Los roles técnicos no expresan por sí solos todas las necesidades humanas. Un usuario puede ocupar varios roles en distintos proyectos. La interfaz debe mostrar desde qué contexto actúa y qué responsabilidad asume.

| Actor | Trabajo que necesita realizar | Información que necesita | Criterio de éxito |
| :--- | :--- | :--- | :--- |
| Visitante | Comprender la oferta y solicitar acceso | Propuesta, condiciones y contacto | Encuentra el canal correcto |
| Solicitante | Presentar y mejorar una propuesta | Requisitos, estado y devolución | Recibe una respuesta fundada |
| Coordinador de ingreso | Ordenar y asignar expedientes | Prioridad, antigüedad y carga | Ninguna propuesta queda sin responsable |
| Mentor | Orientar diagnóstico y formalización | Hipótesis, evidencia y bloqueos | El equipo puede tomar la siguiente decisión |
| Evaluador | Emitir un juicio independiente | Rúbrica y versión del expediente | Evaluación completa y atribuible |
| Aprobador | Autorizar inversión de esfuerzo | Evaluaciones, riesgos y recursos | Decisión defendible |
| Líder de proyecto | Conducir ejecución y compromisos | Alcance, equipo, hitos y capacidad | Entregables aceptados |
| Colaborador | Ejecutar y comunicar trabajo | Prioridades, dependencias y criterios | Compromisos visibles y verificables |
| Solicitante beneficiario | Validar utilidad del resultado | Entregables y acuerdos relevantes | Resultado aceptado o devolución explícita |
| Administrador de workspace | Mantener políticas y membresía | Estándares, permisos y salud operativa | Contexto consistente |
| Responsable de portfolio | Priorizar y gestionar capacidad | Resúmenes autorizados y alertas | Recursos asignados con fundamento |
| Administrador de organización | Gobernar la cuenta | Workspaces, miembros y responsabilidades | Continuidad y acceso controlado |
| Administrador de facturación | Gestionar contratación | Plan, uso, períodos y pagos | Capacidad comercial vigente |
| Operador de red | Administrar colaboración interinstitucional | Programas, organizaciones y concesiones | Participación acotada y trazable |
| Patrocinador | Evaluar compromisos e impacto | Reportes expresamente compartidos | Visibilidad suficiente sin sobreexposición |
| Soporte | Resolver incidentes | Diagnóstico técnico autorizado | Recuperación documentada |

## Roles funcionales propuestos

«Aprobador» y «beneficiario» son responsabilidades del diseño objetivo; no se afirma que existan como roles independientes en el esquema actual. Se pueden implementar como asignaciones de capacidad dentro de un ámbito. La aceptación del beneficiario puede registrarse por un responsable si esa persona no dispone de cuenta, preservando quién aportó la evidencia.

## Separación de responsabilidades

El mentor asesora y el evaluador juzga. El coordinador administra el proceso y el aprobador decide. En equipos pequeños se permite acumular responsabilidades, pero un programa que exige revisión independiente debe impedir que el autor apruebe su propia propuesta.

La salida de un usuario no elimina su autoría histórica. Debe transferirse el trabajo pendiente y revocarse el acceso activo. Los indicadores de equipo no se deben convertir automáticamente en clasificaciones de rendimiento personal.

## Accesibilidad y diversidad de uso

El recorrido debe funcionar para usuarios ocasionales, expertos, personas que trabajan desde móvil y personas que navegan con teclado. Cada estado necesita una explicación comprensible y una acción siguiente. La información crítica no puede depender solamente del color ni de conocer jerga como triage, CRDT o workspace.

Relaciones: [[Matriz de permisos]], [[Equipos y responsabilidades]] y [[Experiencia por contexto]].
