---
title: "Redes y programas"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Redes y programas

## Modelo

Una red articula organizaciones. Un programa define una convocatoria, incubadora, desafío, fondo o mentoría. Las iniciativas pueden participar en un programa sin abandonar su organización o workspace de origen.

El esquema contiene redes, organizaciones de red, miembros, programas, invitaciones externas, concesiones de acceso, criterios, evaluaciones y auditorías. Las concesiones pueden dirigirse a iniciativa, documento o proyecto.

## Recorrido objetivo de un programa

1. La organización anfitriona define propósito, elegibilidad, fechas y criterios.
2. Se invita a organizaciones participantes y se acuerdan responsabilidades.
3. Se publica el programa con una versión de reglas identificable.
4. Las iniciativas ingresan desde un contexto permitido.
5. Se asignan mentores y evaluadores con acceso mínimo y vencimiento.
6. Se evalúa, decide y comunica devolución.
7. Se acompaña la conversión y ejecución sin trasladar propiedad por defecto.
8. Se cierra el programa y se revocan concesiones temporales.

DRAFT, OPEN, REVIEWING, CLOSED y ARCHIVED existen como estados de programa. El producto debe aplicar fechas y acciones permitidas de forma consistente con ese estado.

## Concesión externa

| Atributo | Requisito |
| :--- | :--- |
| Destinatario | Identidad verificada |
| Emisor | Persona autorizada por la organización responsable |
| Recurso | Identificador y tipo explícitos |
| Permiso | Lectura, edición o evaluación según contrato |
| Propósito | Justificación |
| Vigencia | Inicio y expiración |
| Revocación | Actor, fecha y motivo |
| Auditoría | Concesión, uso relevante y exportación |

Ser patrocinador, socio o miembro de una red no concede acceso general a los expedientes. Las evaluaciones reservadas tienen un ámbito diferente de la información compartida con el solicitante.

## Conflictos que se deben resolver

La lectura de un proyecto por una concesión externa no demuestra autorización para listar todos los proyectos del workspace. Los enlaces desde un informe deben conducir sólo a recursos accesibles. Una evaluación no debe mostrar correos u otros datos personales innecesarios.

Al expirar un programa, los proyectos pueden seguir operando en su organización. La expiración afecta los accesos temporales y compromisos del programa, no borra su ejecución. Las reglas de retención y publicación de resultados se establecen antes de abrirlo.

## Criterio de producto completo

Un evaluador externo debe poder aceptar una invitación, abrir sólo sus expedientes, evaluar, corregir dentro del plazo permitido y perder acceso al expirar la concesión. El recorrido debe funcionar en API, interfaz, documentos y tiempo real.

Relaciones: [[Diagnostico y evaluacion]], [[Organizaciones y membresias]] y [[Seguridad y datos]].
