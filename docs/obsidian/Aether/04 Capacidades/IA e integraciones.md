---
title: "IA e integraciones"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# IA e integraciones

## Función de la IA

La IA puede ayudar a estructurar un problema, proponer tareas, sugerir riesgos y resumir evidencia. Su salida es una propuesta revisable. No debe declarar una iniciativa aprobada, asignar personas sin autoridad ni afirmar que existe evidencia no aportada.

Se observaron servicios de planificación y construcción con IA, documentos de builder y endpoints de créditos, plan y build. Existen dependencias de proveedores de IA y una integración GitHub. Su presencia no acredita precisión, privacidad o recuperación completa de cada flujo.

## Contrato objetivo de generación

1. Mostrar el contexto y los documentos que se utilizarán.
2. Validar permisos sobre cada recurso seleccionado.
3. Reservar la capacidad o crédito de forma consistente.
4. Generar una propuesta con esquema validado y procedencia.
5. Presentar diferencias antes de crear o modificar recursos.
6. Permitir aceptar parcialmente y editar.
7. Persistir operaciones aprobadas con idempotencia.
8. Registrar consumo y aplicar política de reembolso ante fallo.

Los textos externos y documentos son datos, no instrucciones con autoridad para ejecutar acciones. Una sugerencia de IA no puede ampliar el acceso del usuario.

## GitHub

Los eventos de repositorio deben verificarse antes de producir acciones. El sistema necesita autenticación del emisor, idempotencia por entrega, mapeo explícito entre repositorio y workspace y autorización de la regla.

Un pull request cerrado no equivale necesariamente a una tarea aceptada. La automatización puede proponer estado o aplicar una regla configurada, conservando evidencia y posibilidad de corrección. Un webhook repetido no debe duplicar comentarios, tareas ni eventos de negocio.

## Correo y almacenamiento

El correo es un canal derivado: la acción permanece disponible dentro de Aether aunque el proveedor falle. Los adjuntos pertenecen al recurso de negocio y su disponibilidad debe recuperarse desde almacenamiento persistente.

## Integraciones futuras

Cada integración declara sistema de origen, datos intercambiados, permisos, frecuencia, manejo de errores y procedimiento de desconexión. Evitar sincronización bidireccional sin una autoridad definida por campo. Desconectar credenciales no elimina automáticamente evidencias históricas.

Relaciones: [[Planes y facturacion]], [[Documentos y evidencia]] y [[Eventos y tiempo real]].
