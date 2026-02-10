# Sistema de Tokens con Refresh Automático

## Descripción

El sistema de autenticación ahora implementa **renovación automática de tokens** para mantener la sesión del usuario activa mientras usa la aplicación, sin necesidad de volver a iniciar sesión constantemente.

## Cómo Funciona

### 1. Tokens JWT

El sistema utiliza dos tipos de tokens:

- **Access Token**: Token de corta duración (1 hora) usado para autenticar peticiones a la API
- **Refresh Token**: Token de larga duración (7 días) usado para obtener nuevos access tokens

### 2. Flujo de Autenticación

```
┌─────────────┐
│   Usuario   │
│ hace login  │
└──────┬──────┘
       │
       ▼
┌─────────────────────────────┐
│  Servidor genera:           │
│  • Access Token (1h)        │
│  • Refresh Token (7d)       │
└──────┬──────────────────────┘
       │
       ▼
┌─────────────────────────────┐
│  Cliente guarda en          │
│  localStorage (persistente) │
└─────────────────────────────┘
```

### 3. Renovación Automática

Cuando el access token expira (después de 1 hora):

```
┌────────────────┐
│  Petición API  │
│  con token     │
│  expirado      │
└───────┬────────┘
        │
        ▼
┌────────────────────────────┐
│  Servidor responde 401     │
│  (Unauthorized)            │
└───────┬────────────────────┘
        │
        ▼
┌────────────────────────────────┐
│  apiService detecta 401 y      │
│  automáticamente:              │
│  1. Usa refresh token para     │
│     obtener nuevos tokens      │
│  2. Actualiza localStorage     │
│  3. Reintenta la petición      │
└────────────────────────────────┘
```

### 4. Persistencia de Sesión

La sesión se mantiene activa gracias a:

1. **localStorage**: Los tokens se guardan persistentemente usando Zustand persist
2. **Refresh automático**: El access token se renueva automáticamente cada hora
3. **Expiración del refresh token**: La sesión expira solo si:
   - El usuario cierra sesión manualmente (logout)
   - El refresh token expira (después de 7 días de inactividad)
   - El usuario limpia el localStorage

## Archivos Modificados/Creados

### Backend

1. **apps/api/src/controllers/AuthController.ts**
   - Nuevo método `refresh()` para renovar tokens

2. **apps/api/src/routes/auth.ts**
   - Nueva ruta `POST /api/auth/refresh`

### Frontend

1. **apps/web/src/services/apiService.ts** (NUEVO)
   - Servicio centralizado de API con interceptor
   - Maneja renovación automática de tokens
   - Cola de peticiones durante el refresh

2. **apps/web/src/stores/authStore.ts**
   - Actualizado para usar `apiService`
   - Mantiene persistencia con localStorage

## Uso en el Código

### Hacer peticiones autenticadas

```typescript
import { apiService } from '@/services/apiService';

// GET con autenticación
const response = await apiService.get<WorkspaceData>(
  '/api/workspaces/123',
  true // ← parámetro useAuth = true
);

// POST con autenticación
const response = await apiService.post<CardData>(
  '/api/cards',
  { title: 'Nueva tarea', listId: '456' },
  true // ← parámetro useAuth = true
);

// PUT con autenticación
const response = await apiService.put<CardData>(
  '/api/cards/789',
  { title: 'Tarea actualizada' },
  true
);

// DELETE con autenticación
const response = await apiService.delete<void>('/api/cards/789', true);
```

### Peticiones sin autenticación

```typescript
// Login no requiere autenticación
const response = await apiService.post<LoginData>(
  '/api/auth/login',
  { email, password },
  false // ← useAuth = false
);
```

## Ventajas de esta Implementación

✅ **Seguridad mejorada**: Los access tokens de corta duración minimizan el riesgo si son robados

✅ **Experiencia de usuario mejorada**: El usuario no tiene que volver a iniciar sesión cada hora

✅ **Persistencia**: La sesión se mantiene incluso si el usuario cierra y abre el navegador

✅ **Transparente**: El refresh de tokens es automático e invisible para el usuario

✅ **Cola de peticiones**: Si múltiples peticiones fallan al mismo tiempo, todas esperan a que se renueve el token una sola vez

✅ **Manejo de errores**: Si el refresh token expira, se redirige automáticamente al login

## Configuración

Las duraciones de los tokens se configuran en variables de entorno en el backend:

```env
# .env en apps/api
JWT_SECRET=tu-secreto-super-seguro
JWT_EXPIRES_IN=1h                    # Duración del access token
REFRESH_TOKEN_SECRET=otro-secreto
REFRESH_TOKEN_EXPIRES_IN=7d          # Duración del refresh token
```

Puedes ajustar estas duraciones según tus necesidades:

- `JWT_EXPIRES_IN`: '15m', '1h', '2h', etc.
- `REFRESH_TOKEN_EXPIRES_IN`: '7d', '30d', '90d', etc.

## Testing

Para probar el sistema de refresh:

1. Inicia sesión en la aplicación
2. El access token expirará después de 1 hora
3. Realiza cualquier acción que requiera autenticación
4. El token se renovará automáticamente sin que notes nada

Para forzar una expiración más rápida (solo para testing):

- Cambia `JWT_EXPIRES_IN=10s` en el `.env` del backend
- Reinicia el servidor
- El token expirará en 10 segundos

## Solución de Problemas

### El usuario es deslogueado automáticamente

**Posibles causas**:

1. El refresh token expiró (después de 7 días)
2. El localStorage fue limpiado
3. El servidor no está respondiendo a `/api/auth/refresh`

**Solución**: Verificar que el refresh token esté en localStorage y no haya expirado

### Las peticiones fallan con 401 continuamente

**Posibles causas**:

1. El endpoint `/api/auth/refresh` no está funcionando
2. El refresh token es inválido

**Solución**: Revisar logs del servidor y verificar que la ruta esté registrada correctamente
