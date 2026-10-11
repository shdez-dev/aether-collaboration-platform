---
title: "Requerimientos funcionales greenfield"
tipo: "especificación funcional"
estado: "propuesto"
---

# Requerimientos funcionales greenfield

Cada requerimiento utiliza lenguaje obligatorio, tiene prioridad y debe enlazarse con al menos una historia y un caso de prueba. La prioridad M0 define la primera rebanada operable, M1 completa el MVP, M2 amplía el producto y M3 queda condicionada a validación.

## Identidad, organización y acceso

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-IAM-001 | M0 | El sistema debe autenticar mediante un proveedor OIDC y mantener sesión de servidor | Ningún token de acceso queda en localStorage y la sesión puede revocarse |
| RF-IAM-002 | M0 | El sistema debe permitir pertenencia a varias organizaciones con contexto activo explícito | Cambiar de organización no mezcla datos ni permisos |
| RF-IAM-003 | M0 | El administrador debe invitar, suspender y retirar miembros | La invitación expira y cada cambio queda auditado |
| RF-IAM-004 | M0 | Toda operación protegida debe evaluar acción, sujeto, recurso, organización y estado | La denegación es consistente en API, trabajos y tiempo real |
| RF-IAM-005 | M1 | El usuario debe gestionar sesiones activas, recuperación y preferencias de seguridad | Puede cerrar otras sesiones y reconocer accesos recientes |
| RF-IAM-006 | M2 | Una organización empresarial debe poder configurar SSO y aprovisionamiento | El dominio verificado no concede acceso sin política explícita |

## Organización y espacios de trabajo

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-ORG-001 | M0 | Un administrador debe crear espacios, equipos y membresías acotadas | Cada recurso pertenece a una organización y, cuando aplique, a un espacio |
| RF-ORG-002 | M0 | La organización debe definir responsables y política horaria, regional y de retención | Los valores heredados muestran su origen y pueden sobrescribirse con permiso |
| RF-ORG-003 | M1 | El administrador debe exportar configuración, miembros y auditoría autorizada | La exportación es asíncrona, protegida y expira |

## Iniciativas, evaluación y decisión

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-INI-001 | M0 | Un solicitante debe crear, guardar y presentar una iniciativa | La presentación valida título, problema, resultado, propietario y alcance |
| RF-INI-002 | M1 | El sistema debe advertir posibles duplicados sin impedir una presentación legítima | La decisión de relacionar o continuar queda registrada |
| RF-EVA-001 | M0 | Un responsable debe publicar estándares versionados con dimensiones y reglas | Una versión usada no puede modificarse retroactivamente |
| RF-EVA-002 | M0 | Un evaluador debe guardar borrador y publicar evaluación con cobertura completa | La publicación verifica asignación, conflicto y versión del estándar |
| RF-EVA-003 | M1 | Un evaluador debe declarar conflicto de interés y abstenerse | La abstención reasigna o escala sin revelar datos innecesarios |
| RF-DEC-001 | M0 | Un decisor debe aprobar, rechazar, pausar o solicitar cambios con fundamento | La transición verifica evidencia requerida y notifica a las partes |
| RF-DEC-002 | M1 | Una decisión condicionada debe registrar condiciones, responsables y vencimiento | No puede formalizarse hasta cumplir o eximir condiciones con autoridad |

## Formalización y proyecto

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-FOR-001 | M0 | Una iniciativa aprobada debe convertirse de forma idempotente en proyecto | Repetir la solicitud retorna el mismo resultado y nunca duplica el proyecto |
| RF-FOR-002 | M0 | La formalización debe confirmar patrocinador, líder, objetivo, límites y plantilla | El actor que convierte no recibe roles por conveniencia técnica |
| RF-FOR-003 | M1 | Un fallo posterior debe quedar recuperable y no dejar entidades huérfanas | La transacción revierte o el proceso continúa desde un checkpoint seguro |
| RF-PRJ-001 | M0 | El líder debe definir plan, hitos, tareas, responsables y fechas | Cada elemento mantiene versión y autor de cambios |
| RF-PRJ-002 | M0 | Los miembros deben actualizar trabajo dentro de su alcance | La API evita transiciones inválidas y escrituras perdidas |
| RF-PRJ-003 | M1 | El líder debe registrar riesgos, decisiones, dependencias y solicitudes de cambio | Los cambios de línea base requieren aprobación definida |
| RF-PRJ-004 | M1 | El proyecto debe poder pausarse, cancelarse y cerrarse formalmente | Cada salida exige motivo, resolución del trabajo y comunicación |
| RF-PRJ-005 | M1 | El cierre debe comparar resultados con objetivos y conservar lecciones | La evidencia y los pendientes tienen tratamiento explícito |

## Documentos, evidencia y colaboración

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-DOC-001 | M0 | Un miembro autorizado debe adjuntar y consultar archivos privados | La descarga usa autorización actual y enlace de corta duración |
| RF-DOC-002 | M0 | Todo documento debe indicar propietario, clasificación, versión y relación de negocio | Un archivo sin metadatos obligatorios no se publica |
| RF-DOC-003 | M1 | Los documentos editables deben conservar versiones y recuperación | Se puede restaurar una versión sin borrar la historia posterior |
| RF-DOC-004 | M2 | Varios usuarios autorizados deben editar simultáneamente con recuperación durable | Reconexión y reinicio no pierden cambios confirmados |
| RF-COM-001 | M1 | Los usuarios deben comentar, mencionar y resolver conversaciones contextualizadas | Cada comentario respeta visibilidad del recurso padre |

## Comunicación, auditoría y administración

| ID | Prioridad | Requerimiento | Criterio verificable resumido |
| :--- | :--- | :--- | :--- |
| RF-NOT-001 | M0 | El sistema debe entregar una bandeja de notificaciones y preferencias | La entrega es idempotente y no expone recursos ya inaccesibles |
| RF-NOT-002 | M1 | Los avisos críticos deben poder enviarse por correo con reintentos | Un fallo temporal no pierde el mensaje ni lo duplica sin control |
| RF-AUD-001 | M0 | Las acciones sensibles deben producir auditoría consultable e inmutable por usuarios | Incluye actor, acción, alcance, resultado, tiempo, correlación y motivo cuando aplique |
| RF-ADM-001 | M1 | Soporte debe diagnosticar con acceso privilegiado temporal y justificado | La elevación expira, se audita y evita contenido sensible cuando no es necesario |
| RF-EXP-001 | M1 | Los usuarios autorizados deben exportar datos propios y organizacionales | El proceso respeta alcance, retención, formato y borrado del artefacto |

## Capacidades posteriores

| ID | Prioridad | Requerimiento | Condición de entrada |
| :--- | :--- | :--- | :--- |
| RF-POR-001 | M2 | Gestionar portfolios, capacidad, dependencias y escenarios | Datos de proyecto confiables y demanda validada |
| RF-NET-001 | M3 | Coordinar programas entre organizaciones mediante acuerdos explícitos | Modelo legal, privacidad y caso comercial validados |
| RF-BIL-001 | M3 | Medir uso, limitar plan y facturar sin mezclarlo con autorización | Estrategia de monetización aprobada |
| RF-AI-001 | M3 | Proponer resúmenes, riesgos y búsquedas con fuentes citadas | Evaluación de datos, consentimiento, calidad y costo aprobada |

## Relaciones

Los criterios detallados se desarrollan en [[Historias de usuario greenfield]] y [[Catalogo de casos de prueba]]. La prioridad alimenta [[Roadmap de reconstruccion]].
