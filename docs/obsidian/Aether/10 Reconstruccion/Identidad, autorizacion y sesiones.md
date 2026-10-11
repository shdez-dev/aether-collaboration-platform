---
title: "Identidad, autorización y sesiones"
tipo: "seguridad de acceso"
estado: "propuesto"
---

# Identidad, autorización y sesiones

## Autenticación

La aplicación delega autenticación a un proveedor compatible con OpenID Connect. El navegador utiliza Authorization Code con PKCE. El servidor canjea credenciales, crea una sesión opaca y entrega una cookie Secure, HttpOnly y SameSite apropiada. Los tokens del proveedor se cifran en servidor cuando sean necesarios y nunca se guardan en localStorage.

La sesión tiene expiración absoluta e inactividad, rotación al elevar privilegios y revocación por usuario, administrador y respuesta a incidente. Las acciones de alto impacto exigen autenticación reciente. Recuperación, cambio de correo y vinculación de identidades se tratan como operaciones sensibles.

## Autorización

La decisión combina RBAC y atributos contextuales. Un rol concede capacidades candidatas, pero la política verifica organización activa, membresía, espacio, equipo, propiedad, clasificación, estado del recurso, conflicto de interés y acción solicitada.

| Nivel | Pregunta |
| :--- | :--- |
| Identidad | Quién es el sujeto y qué fortaleza tiene la sesión |
| Tenencia | Pertenece a la organización del recurso |
| Capacidad | Su rol incluye la acción candidata |
| Alcance | Tiene acceso al espacio, equipo o recurso |
| Condición | El estado permite la acción y no existe conflicto |
| Obligación | Debe registrar motivo, autenticarse otra vez o solicitar aprobación |

La política vive en servidor y se invoca desde HTTP, WebSocket y worker. La interfaz puede ocultar acciones para claridad, pero no constituye protección.

## Roles iniciales

| Rol | Alcance típico | Responsabilidad |
| :--- | :--- | :--- |
| org_admin | organización | Membresías, políticas, espacios e integraciones |
| methodology_owner | organización o espacio | Estándares y plantillas |
| requester | espacio | Iniciativas propias y compartidas |
| evaluator | asignación | Evaluaciones específicas |
| decision_maker | comité o espacio | Decisiones dentro de mandato |
| sponsor | proyecto | Gobierno y desbloqueo |
| project_lead | proyecto | Plan, equipo y cambios |
| contributor | proyecto | Trabajo asignado y colaboración |
| auditor | organización y periodo | Lectura controlada de evidencia y auditoría |
| support_operator | temporal | Diagnóstico justificado y mínimo |

No se crea un rol universal de superadministrador para operación cotidiana. Las funciones de emergencia usan acceso just in time, aprobación, expiración, registro y revisión posterior.

## Casos negativos obligatorios

Las pruebas deben intentar leer identificadores de otra organización, reutilizar enlaces tras revocación, suscribirse a canales no autorizados, ejecutar un trabajo con membresía retirada, cambiar organization_id en el cuerpo, enumerar recursos por tiempos de respuesta y repetir operaciones con una sesión expirada. La respuesta evita revelar si existe un recurso cuando esa información sea sensible.

## Relaciones

La matriz de roles detallada se deriva de [[Requerimientos funcionales greenfield]]. Las amenazas se modelan en [[Seguridad y modelo de amenazas]].
