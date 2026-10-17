# A-06 — Plan de migración de tokens

## Estado actual

- El frontend persiste `accessToken` y `refreshToken` en el estado de Zustand guardado en `localStorage` (`aether-auth-storage`).
- Las llamadas HTTP envían el access token como `Authorization: Bearer ...`; `/api/auth/refresh` recibe el refresh token en el cuerpo JSON.
- Socket.IO recibe el access token desde el cliente durante el handshake y lo actualiza al rotar.
- La cookie `aether_session=1` que se escribe desde el navegador solo guía la navegación de Next.js. Es falsificable, no autentica peticiones y no contiene un secreto; el API sigue validando JWT y permisos.

## Contrato objetivo

1. El API emite access y refresh tokens en cookies `HttpOnly`, `Secure` en producción, `SameSite=Lax` cuando web y API están en el mismo sitio, y con `Path` limitado al endpoint que las necesita cuando sea viable.
2. Si web y API quedan en sitios distintos, usar `SameSite=None; Secure` y exigir protección CSRF explícita. No habilitar CORS con credenciales para orígenes comodín.
3. Las mutaciones autenticadas validan `Origin` contra la lista de orígenes permitidos y requieren un token CSRF no-HttpOnly en un header dedicado. El servidor rota/revoca los refresh tokens como ahora.
4. El frontend mantiene el usuario y el access token solo en memoria; restaura la sesión mediante un endpoint autenticado y deja de serializar ambos tokens en `localStorage`.
5. Socket.IO deja de aceptar tokens de larga vida del almacenamiento del navegador. Elegir antes de migrar entre cookie de sesión con validación de `Origin` o un ticket de conexión de un solo uso, corto y emitido por un endpoint autenticado.

## Secuencia de despliegue

### Fase 0 — Verificar topología y clientes

- Confirmar los dominios reales de web, API y websocket, si son mismo sitio, y si existen clientes móviles, integraciones o consumidores API que dependan de Bearer tokens.
- Definir la lista de orígenes por ambiente y documentar expiraciones actuales de access y refresh tokens.
- No habilitar cookies cross-site hasta disponer de HTTPS y pruebas de CSRF.

### Fase 1 — API compatible

- Añadir emisión, lectura, rotación y borrado de cookies sin quitar todavía el contrato Bearer/body.
- Preferir la cookie cuando exista; aceptar temporalmente el contrato anterior para clientes que aún no hayan migrado.
- Aplicar validación de `Origin` y CSRF a solicitudes autenticadas por cookie; los clientes Bearer no deben recibir cookies automáticamente.
- Añadir pruebas de integración para login, renovación/rotación, logout, expiración, origen no permitido, CSRF ausente y reuso de refresh token.

### Fase 2 — Web

- Cambiar `apiService` para enviar credenciales, obtener el token CSRF y reintentar una sola vez cuando el access token expire.
- Dejar de persistir `accessToken` y `refreshToken`; limpiar las copias locales existentes al completar una restauración de sesión.
- Mantener los tokens solo en memoria y restaurar la sesión desde el servidor.
- Añadir E2E de login, recarga, renovación, logout y rechazo de una mutación CSRF.

### Fase 3 — Tiempo real

- Migrar el handshake de Socket.IO al mecanismo de cookie o ticket elegido en la Fase 0.
- Verificar `Origin` en el gateway y probar reconexión tras rotación, cierre de sesión y revocación.
- Retirar el parámetro `auth.token` del cliente y del gateway solo después de actualizar todos los clientes conocidos.

### Fase 4 — Retirada

- Medir el uso del contrato antiguo con contadores sin registrar tokens ni datos sensibles.
- Tras el periodo de compatibilidad, dejar de aceptar refresh tokens en el cuerpo y access tokens Bearer para el frontend migrado; conservar Bearer únicamente si hay clientes de API documentados.
- Revocar sesiones antiguas y retirar del estado serializado cualquier campo de token residual.

## Condiciones para iniciar el cambio de código

- Dominios y topología confirmados por despliegue.
- Decisión documentada para el handshake de Socket.IO y clientes externos.
- Pruebas de integración y E2E de CSRF, rotación y revocación preparadas antes de cambiar el almacenamiento.
- Despliegue gradual con métricas de compatibilidad; nunca registrar cabeceras, cookies, tickets o JWT.
