---
title: "Casos de aceptacion"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Casos de aceptacion

## Uso

Estos casos son especificaciones de prueba, no pruebas ejecutadas. Cada ejecución debe registrar versión, entorno, datos, actor, resultado, evidencia y defectos. Los identificadores enlazan con [[Backlog priorizado]].

| Caso | Dado | Cuando | Entonces |
| :--- | :--- | :--- | :--- |
| CA-01 | Usuario miembro de workspace sin acceso a proyecto privado | Consulta detalle, búsqueda, contador, exportación y canal | No obtiene información del proyecto |
| CA-02 | Iniciativa aprobada | Dos peticiones simultáneas intentan convertirla | Existe un proyecto y un conjunto único de recursos derivados |
| CA-03 | Proyecto en borrador sin requisitos | Se solicita ejecución | Se rechaza con requisitos faltantes y sin historial de éxito |
| CA-04 | Dos personas editan la misma versión | Ambas cambian estado | Una confirma y la otra recibe conflicto recuperable |
| CA-05 | Proyecto vinculado a estándar v1 | Se activa v2 en el workspace | Conserva cálculo v1 hasta adopción explícita |
| CA-06 | Proyecto formalizado con evidencia aprobada | Se retira la evidencia vigente | Se conserva decisión histórica y se señala incumplimiento actual |
| CA-07 | Iniciativa con coordinador y patrocinador, sin líder aceptado | Se convierte | No se inventa aceptación ni permiso de edición para patrocinador |
| CA-08 | Usuario con sesión y documento abierto | Se revoca acceso | API, tiempo real y nuevas descargas rechazan su acceso |
| CA-09 | Redis o correo indisponible | Se confirma una decisión | Estado e historial persisten y la entrega se reintenta sin duplicar |
| CA-10 | Dos usuarios editan un documento | Se corta conexión o reinicia proceso | Se recuperan los cambios confirmados dentro del contrato de durabilidad |
| CA-11 | Entregable con versión revisada | Se modifica el documento después | La aceptación permanece vinculada a la versión original |
| CA-12 | Proyecto con tarea residual | Se solicita cierre | Se exige resolver o transferir el compromiso y registrar aceptación |
| CA-13 | Solicitud supera plazo de revisión | Se ejecuta escalamiento | Una notificación deduplicada llega al responsable pertinente |
| CA-14 | Hay proyectos sin datos y estándares distintos | Se genera reporte | Expone denominadores, versiones, ausencias y pendientes abiertos |
| CA-15 | Persona disponible 20 horas, asignada 12 y 15 en dos proyectos | Se calcula capacidad del período | Se informa sobrecarga de 7 horas sin duplicar persona |
| CA-16 | Usuario ve resumen pero no documentos privados | Exporta portfolio | El archivo respeta el alcance y registra auditoría |
| CA-17 | Entorno vacío y copia heredada representativa | Se instala, migra y restaura | Ambos arrancan con datos y permisos consistentes |
| CA-18 | Evento de cobro repetido o atrasado | Se procesa el webhook | No duplica efectos ni revierte el estado más reciente |
| CA-19 | Evaluador externo de un programa | Expira su concesión | Pierde acceso a expedientes y conserva sólo lo permitido por política |
| CA-20 | Generación IA válida con crédito reservado | Falla la aplicación de recursos | No deja duplicados y el consumo sigue política documentada |
| CA-21 | Usuario nuevo usando teclado | Completa ingreso, revisión y tarea | Puede terminar con foco, etiquetas y errores comprensibles |

## Escenarios negativos complementarios

Una dependencia A hacia B y otra B hacia A enviadas al mismo tiempo no pueden crear un ciclo. Una organización no puede quedar sin propietario al ejecutar dos bajas concurrentes. Un miembro revocado no recupera acceso por permanecer en un equipo. Un enlace documental externo no puede consultar infraestructura interna durante una exportación.

Un límite de un workspace disponible no puede permitir dos creaciones simultáneas. Una evaluación de un expediente modificado necesita revisión de versión. Una transición rechazada no debe enviar un correo de aprobación.

## Evidencia esperada

Para una prueba de datos se adjuntan identificadores de fixtures y consultas de comprobación. Para una prueba de interfaz se documenta el recorrido y resultado visible. Para recuperación se registra qué se confirmó antes de la caída, qué se recuperó y cuánto tardó.

Los resultados sensibles permanecen en el sistema autorizado de pruebas. Esta bóveda guarda referencias y conclusiones, no tokens ni copias de datos productivos.

## Criterio de cierre

Un caso se considera aprobado cuando satisface todas sus condiciones y no presenta efectos secundarios fuera del ámbito. Un éxito parcial se registra como fallo o excepción abierta, nunca como aprobación completa.

Relaciones: [[Calidad y pruebas]] y [[Definicion de producto completo]].
