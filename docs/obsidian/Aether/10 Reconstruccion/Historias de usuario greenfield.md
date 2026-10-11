---
title: "Historias de usuario greenfield"
tipo: "backlog de producto"
estado: "propuesto"
---

# Historias de usuario greenfield

Las historias expresan resultados observables. No sustituyen el modelo de dominio ni autorizan introducir lógica únicamente en la interfaz.

## Primera rebanada operable

| ID | Historia | Criterios de aceptación principales | Relación |
| :--- | :--- | :--- | :--- |
| US-001 | Como usuario invitado quiero aceptar una invitación y entrar en la organización correcta para comenzar sin exposición a otras organizaciones | Invitación vigente, identidad verificada, membresía única, sesión segura, auditoría | RF-IAM-001, RF-IAM-003 |
| US-002 | Como administrador quiero crear un espacio y asignar miembros para delimitar trabajo y acceso | Nombre válido, pertenencia comprobada, roles explícitos, denegación cruzada | RF-ORG-001, RF-IAM-004 |
| US-003 | Como solicitante quiero guardar una iniciativa incompleta para continuar luego sin publicar información prematura | Autoguardado controlado, versión, visibilidad privada, recuperación | RF-INI-001 |
| US-004 | Como solicitante quiero presentar una iniciativa y recibir errores concretos para saber si está lista | Validación de datos, transición única, fecha y notificación | RF-INI-001 |
| US-005 | Como evaluador asignado quiero aplicar un estándar congelado para producir una evaluación comparable | Dimensiones completas, conflicto declarado, borrador, publicación inmutable | RF-EVA-001, RF-EVA-002, RF-EVA-003 |
| US-006 | Como decisor quiero revisar iniciativa, evaluación y evidencia y dejar una resolución fundamentada | Permiso, estado, motivo obligatorio, condición opcional, auditoría | RF-DEC-001, RF-DEC-002 |
| US-007 | Como responsable de formalización quiero confirmar patrocinador y líder antes de crear el proyecto | No hay autoasignación implícita, validación de membresía y roles | RF-FOR-002 |
| US-008 | Como responsable de formalización quiero reintentar una conversión interrumpida sin duplicar el proyecto | Idempotency key, mismo resultado, estado recuperable, auditoría | RF-FOR-001, RF-FOR-003 |
| US-009 | Como líder quiero activar un proyecto solo cuando tenga mandato y plan mínimo para evitar proyectos nominales | Objetivo, patrocinador, líder, hito, riesgos y acceso válidos | RF-PRJ-001 |
| US-010 | Como colaborador quiero actualizar una tarea sin sobrescribir el cambio reciente de otra persona | Control de versión, conflicto entendible, permisos y evento | RF-PRJ-002 |
| US-011 | Como líder quiero cerrar un proyecto comparando objetivos y resultados para conservar aprendizaje | Entregables resueltos, evidencia, lecciones, pendientes y aprobación | RF-PRJ-004, RF-PRJ-005 |
| US-012 | Como auditor quiero reconstruir la conversión y cambios posteriores sin acceder a datos ajenos | Filtros de alcance, línea temporal, exportación autorizada | RF-AUD-001 |

## Historias complementarias del MVP

| ID | Historia | Criterios de aceptación principales | Relación |
| :--- | :--- | :--- | :--- |
| US-013 | Como responsable de metodología quiero publicar una nueva versión de estándar sin alterar evaluaciones antiguas | Copia versionada, vigencia, previsualización y prohibición de edición histórica | RF-EVA-001 |
| US-014 | Como usuario quiero adjuntar evidencia privada y retirarla según política | Escaneo, metadatos, autorización actual, retención y auditoría | RF-DOC-001, RF-DOC-002 |
| US-015 | Como participante mencionado quiero recibir un aviso útil sin revelar contenido que ya no puedo abrir | Preferencias, enlace autorizado, deduplicación y estado leído | RF-NOT-001, RF-NOT-002 |
| US-016 | Como administrador quiero suspender un miembro y revocar sesiones para responder a una salida | Efecto inmediato, reasignación advertida, auditoría y notificación | RF-IAM-003, RF-IAM-005 |
| US-017 | Como líder quiero solicitar un cambio de línea base para que alcance, plazo y decisión permanezcan conectados | Diferencia visible, aprobador, motivo, impacto y versión resultante | RF-PRJ-003 |
| US-018 | Como usuario quiero exportar mis datos disponibles para ejercer control sobre mi información | Verificación reciente, proceso asíncrono, enlace temporal y registro | RF-EXP-001 |
| US-019 | Como soporte quiero usar acceso temporal justificado para diagnosticar un incidente sin privilegio permanente | Aprobación según severidad, expiración, minimización y alerta | RF-ADM-001 |
| US-020 | Como usuario de teclado quiero completar el flujo principal sin arrastre ni pérdida de foco | Orden lógico, nombres accesibles, mensajes anunciados y alternativa a gestos | RNF-ACC-001, RNF-ACC-002 |

## Formato para nuevas historias

| Campo | Regla |
| :--- | :--- |
| Resultado | Explicar qué cambia para el actor y no qué componente se programa |
| Contexto | Organización, espacio, rol y estado inicial |
| Camino feliz | Secuencia observable mínima |
| Alternativas | Permiso denegado, conflicto, dependencia caída, repetición y cancelación |
| Criterios | Formato Dado, Cuando, Entonces o tabla equivalente |
| Datos | Información necesaria, clasificación y retención |
| Telemetría | Evento de producto y señal operativa esperados |
| Trazabilidad | RF, RNF, casos, diseño y versión de decisión |

## Relaciones

La cobertura completa aparece en [[Matriz de trazabilidad greenfield]]. La secuencia de implementación está en [[Roadmap de reconstruccion]].
