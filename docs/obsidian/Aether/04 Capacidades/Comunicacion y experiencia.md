---
title: "Comunicacion y experiencia"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Comunicacion y experiencia

## Trabajo personal y trabajo compartido

La vista «Hoy» debe reunir tareas, revisiones y decisiones que requieren acción del usuario en sus contextos autorizados. El calendario representa compromisos con fechas, no una copia independiente de ellos. Contactos y presencia ayudan a coordinar, pero no otorgan permisos sobre proyectos.

El repositorio contiene notificaciones, agenda, actividad, preferencias, contactos y standups. Se observaron tareas rápidas del dashboard almacenadas localmente con vigencia de 24 horas. Deben identificarse como recordatorios personales temporales; no deben confundirse con compromisos persistentes de proyecto.

## Comunicación por evento

| Evento | Destinatario | Respuesta que debe facilitar |
| :--- | :--- | :--- |
| Iniciativa recibida | Solicitante y coordinador | Confirmación y seguimiento |
| Aclaración solicitada | Solicitante | Completar datos |
| Evaluación asignada | Evaluador | Abrir expediente y fecha límite |
| Proyecto pendiente de formalizar | Líder | Resolver requisitos |
| Tarea bloqueada | Responsable y líder | Atender causa |
| Revisión vencida | Responsable y escalamiento | Reprogramar o decidir |
| Decisión registrada | Personas afectadas | Comprender motivo y siguiente paso |
| Acceso revocado | Usuario cuando corresponda | Entender fin de participación |

## Ciclo de una notificación

El código tiene acciones de lectura, archivo, resolución y reapertura. El significado objetivo es explícito: leer confirma visualización; archivar retira de la bandeja; resolver atiende la acción asociada. Ninguna de ellas debe alterar un proyecto sin un comando de negocio autorizado.

La deduplicación usa evento, destinatario y propósito. Los reintentos de correo no crean nuevas notificaciones. Si un enlace deja de ser accesible, se muestra un mensaje neutral y no el contenido privado de la notificación antigua.

## Experiencia de error

La interfaz conserva borradores ante errores recuperables, muestra conflictos de versión y diferencia «guardado local», «enviando» y «confirmado por servidor». Una operación lenta no debe producir un segundo envío accidental.

Una bandeja vacía debe explicar si no existen resultados, si los filtros excluyen elementos o si el usuario todavía no tiene asignaciones. Un error de red no se presenta como una lista vacía.

## Escalamiento

Las revisiones y bloqueos tienen responsable y fecha. La notificación inicial puede ir al responsable; el escalamiento posterior se dirige a la persona de gobierno definida por el workspace. Las ventanas y canales se configuran para evitar ruido.

Relaciones: [[Experiencia por contexto]], [[Eventos y tiempo real]] y [[Metricas de producto]].
