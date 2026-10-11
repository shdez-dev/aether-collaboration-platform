---
title: "Planificacion y ejecucion"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Planificacion y ejecucion

## Estructura del trabajo

El proyecto define entregables y compromisos. Los tableros organizan tareas. Las listas representan etapas operativas. El cronograma y el backlog son vistas del mismo trabajo. Los hitos de proyecto expresan compromisos de resultado; los hitos de tablero pueden expresar controles operativos y deben relacionarse para evitar duplicación.

El repositorio contiene tarjetas, listas, miembros de tarjeta, etiquetas, checklists, dependencias, sprints y hitos. Hay un servicio de detección de ciclos en dependencias y un endpoint de backlog agregado por proyecto.

## Contrato de una tarea objetivo

| Campo | Uso |
| :--- | :--- |
| Título y descripción | Acción y contexto |
| Entregable relacionado | Relación con el resultado esperado |
| Responsable | Persona que responde por completarla |
| Colaboradores | Participación adicional |
| Estado | Situación del trabajo |
| Criterio de aceptación | Evidencia necesaria para terminar |
| Fechas | Inicio y compromiso, cuando corresponda |
| Estimación | Unidad declarada y nivel de incertidumbre |
| Dependencias | Precondiciones de otras tareas |
| Evidencia | Resultado de ejecución |
| Historial | Cambios relevantes atribuibles |

La relación formal con entregables y todos estos controles son requisitos objetivo; el esquema actual no demuestra su implementación completa.

## Semántica de estados

Mover una tarjeta a una lista llamada «Hecho» no debe contradecir su campo completed. Definir un mapeo explícito entre listas y categorías de estado, o usar un estado canónico que todas las vistas representen. Cambiar el nombre de una lista no puede cambiar accidentalmente el significado de las métricas.

Finalizar requiere cumplir el criterio de la tarea. Si necesita revisión, se mueve a «Pendiente de aceptación». Reabrir registra razón. El progreso de proyecto se calcula sobre entregables aceptados o sobre una metodología declarada, no sólo sobre cantidad de tarjetas cerradas.

## Dependencias y concurrencia

No permitir autorreferencia, duplicados ni ciclos. Ambos extremos deben pertenecer al alcance autorizado. Una comprobación de ciclos antes de insertar no basta frente a dos operaciones concurrentes; la implementación debe serializar el ámbito relevante o comprobar la restricción con garantías equivalentes.

Las fechas propuestas por dependencias deben presentarse como impacto antes de aplicarse. La plataforma no desplaza compromisos aceptados silenciosamente. Un bloqueo informa causa, persona que puede resolver y efecto sobre el siguiente hito.

## Sprints y capacidad

Un sprint es una ventana de compromiso, no una copia del backlog. Su cierre distingue completado, devuelto y pendiente. La velocidad no se compara entre equipos que estiman en unidades diferentes. La disponibilidad de una persona se comparte entre sus proyectos para evitar planes imposibles.

Relaciones: [[Portfolios y capacidad]], [[Ciclo del proyecto]] y [[Calidad y pruebas]].
