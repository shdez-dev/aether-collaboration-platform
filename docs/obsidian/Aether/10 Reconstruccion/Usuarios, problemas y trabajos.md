---
title: "Usuarios, problemas y trabajos"
tipo: "investigación de producto"
estado: "hipótesis a validar"
---

# Usuarios, problemas y trabajos

Los nombres de rol no deben inventarse desde las pantallas. Deben surgir de responsabilidades reales. Una persona puede desempeñar varios roles, pero cada acción queda asociada al rol y alcance efectivos en ese momento.

## Actores primarios

| Actor | Problema principal | Trabajo que intenta completar | Evidencia de éxito |
| :--- | :--- | :--- | :--- |
| Solicitante | No sabe cómo convertir una necesidad en propuesta evaluable | Registrar contexto, resultado esperado y evidencia inicial | Iniciativa aceptada para evaluación o devuelta con explicación |
| Evaluador | Recibe propuestas incomparables | Aplicar criterios consistentes y dejar observaciones justificadas | Evaluación completa, reproducible y sin conflicto de interés |
| Decisor | Debe asignar atención y recursos con información incompleta | Aprobar, rechazar, pausar o solicitar cambios con fundamento | Decisión auditada y comunicada |
| Patrocinador | Necesita asegurar valor y remover bloqueos | Confirmar propósito, límites y apoyo institucional | Proyecto con mandato y decisiones oportunas |
| Líder de proyecto | Coordina alcance, personas, tiempo, riesgo y evidencia | Transformar la decisión en plan y mantenerlo gobernable | Próximo paso claro, cambios controlados y cierre verificable |
| Colaborador | Necesita saber qué se espera y dónde aportar | Ejecutar tareas, comentar y adjuntar evidencia | Trabajo aceptado y trazable al resultado |
| Responsable de metodología | Busca consistencia sin imponer burocracia innecesaria | Diseñar estándares, plantillas y controles versionados | Adopción medible y excepciones justificadas |
| Gestor de portfolio | Necesita comparar demanda, capacidad y resultados | Priorizar inversiones y revisar dependencias | Decisiones de capacidad con datos actuales |
| Administrador de organización | Protege configuración, membresías y datos | Gestionar accesos, políticas y límites | Cambios seguros, auditados y reversibles |
| Auditor o revisor | Necesita reconstruir qué ocurrió | Consultar decisiones, cambios, acceso y evidencia | Línea temporal íntegra y exportable |
| Soporte y operación | Debe restaurar servicio sin leer datos innecesarios | Diagnosticar, mitigar y documentar incidentes | Recuperación dentro de objetivos y acceso privilegiado auditado |

## Actores secundarios

Los proveedores de identidad, correo, almacenamiento y pagos son actores técnicos externos. Una organización aliada puede participar en un programa sin obtener acceso implícito a recursos privados. Un usuario invitado dispone de alcance temporal y explícito. Un proceso automatizado posee una identidad de servicio propia, permisos mínimos y rotación de credenciales.

## Necesidades transversales

| Necesidad | Respuesta del producto |
| :--- | :--- |
| Comprender estado | Mostrar estado, responsable, próximo paso, causa y antigüedad |
| Confiar en el dato | Exponer origen, versión, autor, fecha y reglas aplicadas |
| Corregir sin ocultar | Conservar historia y motivo, sin reescribir silenciosamente |
| Participar con seguridad | Limitar el alcance por organización, espacio, equipo y recurso |
| Evitar trabajo duplicado | Detectar similitud y permitir relacionar, fusionar o descartar con decisión humana |
| Salir del sistema | Exportar datos autorizados en formato documentado y tramitar eliminación según política |

## Investigación requerida

Antes de congelar flujos se realizarán entrevistas y pruebas de tareas con al menos dos representantes de cada actor primario disponible. Se debe observar el proceso actual fuera del software, registrar decisiones difíciles, documentos usados, tiempos de espera, excepciones, vocabulario y fuentes de verdad. Cada hipótesis se clasificará como confirmada, refutada o pendiente. Ningún rol se incorporará al modelo de permisos solo porque existía en el producto anterior.

## Relaciones

Los trabajos se convierten en [[Historias de usuario greenfield]] y se asignan a contextos en [[Mapa de dominios greenfield]].
