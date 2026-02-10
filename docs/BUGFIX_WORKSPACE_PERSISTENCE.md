# Bug Fix: Workspaces No Persisten al Refrescar

## 🐛 Problema Reportado

**Síntoma:**

- Usuario deja la página en una workspace
- Deja el servidor encendido y se va
- Cuando vuelve, dice "no se encontró la workspace"
- No hay ninguna workspace visible
- El usuario SÍ está logueado (se muestra su información)

**Reproducción:**

1. Iniciar sesión
2. Ver workspaces (cargan correctamente)
3. Entrar a una workspace
4. Dejar el servidor corriendo
5. Cerrar el navegador o refrescar después de un tiempo
6. Volver → ❌ No hay workspaces

---

## 🔍 Diagnóstico

### Problema 1: WorkspaceStore SIN Persistencia

**Archivo:** `apps/web/src/stores/workspaceStore.ts`

**Antes:**

```typescript
export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  // ...
}));
```

❌ **Problema:** No usa `persist` middleware de Zustand
❌ **Resultado:** Los datos se pierden al refrescar la página

### Problema 2: No Usa apiService con Refresh Automático

**Antes:**

```typescript
async function apiRequest<T>(endpoint: string, options: RequestInit = {}) {
  // Obtiene token manual de localStorage
  const token = localStorage.getItem('token');

  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  // ❌ NO maneja token expirado
  // ❌ NO renueva automáticamente
  return response.json();
}
```

❌ **Problema:** Si el access token expira (1 hora), las peticiones fallan
❌ **Resultado:** No se pueden cargar workspaces aunque el usuario esté logueado

### Problema 3: Socket Desconectado

Cuando refrescas o vuelves después de un tiempo:

- El socket se desconecta
- No se reconecta automáticamente
- Eventos en tiempo real no funcionan

---

## ✅ Solución Implementada

### 1. Persistencia con Zustand

**Archivo:** `apps/web/src/stores/workspaceStore.ts`

**Después:**

```typescript
import { persist, createJSONStorage } from 'zustand/middleware';

export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set, get) => ({
      workspaces: [],
      currentWorkspace: null,
      // ...
    }),
    {
      name: 'aether-workspace-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        workspaces: state.workspaces,
        currentWorkspace: state.currentWorkspace,
      }),
    }
  )
);
```

✅ **Solución:**

- Las workspaces se guardan en localStorage
- Persisten entre recargas
- Se hidratan automáticamente al volver

### 2. Uso de apiService con Refresh Automático

**Antes:**

```typescript
const response = await apiRequest<{ workspaces: Workspace[] }>('/api/workspaces');
```

**Después:**

```typescript
import { apiService } from '@/services/apiService';

const response = await apiService.get<{ workspaces: Workspace[] }>(
  '/api/workspaces',
  true // ← useAuth = true
);
```

✅ **Solución:**

- `apiService` detecta tokens expirados (401)
- Renueva automáticamente con refresh token
- Reintenta la petición con el nuevo token
- Todo transparente para el usuario

**Todas las peticiones actualizadas:**

```typescript
// GET
await apiService.get('/api/workspaces', true);
await apiService.get(`/api/workspaces/${id}`, true);

// POST
await apiService.post('/api/workspaces', data, true);
await apiService.post(`/api/workspaces/${id}/invite`, { email, role }, true);

// PUT
await apiService.put(`/api/workspaces/${id}`, data, true);
await apiService.put(`/api/workspaces/${id}/members/${userId}`, { role }, true);

// DELETE
await apiService.delete(`/api/workspaces/${id}`, true);
await apiService.delete(`/api/workspaces/${id}/members/${userId}`, true);
```

### 3. Reconexión de Socket

**Archivo:** `apps/web/src/stores/authStore.ts` (ya implementado)

```typescript
// En getCurrentUser()
if (socketService && accessToken && !socketService.isConnected()) {
  socketService.connect(accessToken); // ← Reconecta si es necesario
}
```

✅ **Solución:** El socket se reconecta automáticamente cuando se verifica la autenticación

---

## 🔄 Flujo Completo de Recuperación

### Escenario: Usuario vuelve después de 2 horas

```
1. Usuario abre el sitio
   ↓
2. ProtectedRoute se activa
   ↓
3. authStore.isHydrated = true (carga de localStorage)
   ↓
4. ProtectedRoute llama getCurrentUser()
   ↓
5. apiService.get('/api/auth/me', true)
   ↓
6. [Backend responde 401 - Token expirado]
   ↓
7. apiService detecta 401 automáticamente
   ↓
8. apiService usa refresh token para obtener nuevos tokens
   ↓
9. Actualiza tokens en localStorage
   ↓
10. Reintenta GET /api/auth/me con nuevo token
    ↓
11. ✅ Usuario autenticado
    ↓
12. Socket se reconecta
    ↓
13. workspaceStore se hidrata desde localStorage
    ↓
14. Página de workspaces llama fetchWorkspaces()
    ↓
15. apiService.get('/api/workspaces', true)
    ↓
16. Si token expiró nuevamente, repite pasos 7-10
    ↓
17. ✅ Workspaces cargadas desde servidor
    ↓
18. workspaceStore.workspaces actualizado
    ↓
19. ✅ Interfaz muestra workspaces
```

---

## 📊 Comparación: Antes vs Después

| Aspecto                        | Antes          | Después                    |
| ------------------------------ | -------------- | -------------------------- |
| **Persistencia de workspaces** | ❌ No          | ✅ Sí (localStorage)       |
| **Manejo de token expirado**   | ❌ Falla       | ✅ Renueva automáticamente |
| **Reconexión de socket**       | ⚠️ Manual      | ✅ Automática              |
| **Experiencia al volver**      | ❌ Pierde todo | ✅ Mantiene estado         |
| **Tiempo sin actividad**       | ❌ < 1 hora    | ✅ Hasta 7 días            |
| **Llamadas API**               | `fetch` manual | `apiService` con retry     |

---

## 🧪 Testing

### Casos de Prueba:

#### ✅ Caso 1: Refresh Simple

```
1. Login
2. Ver workspaces
3. F5 (refresh)
4. ✅ Workspaces siguen ahí
```

#### ✅ Caso 2: Cerrar y Abrir Navegador

```
1. Login
2. Ver workspaces
3. Cerrar navegador
4. Abrir navegador
5. Ir al sitio
6. ✅ Workspaces siguen ahí (hidratadas desde localStorage)
7. ✅ Se recargan desde servidor automáticamente
```

#### ✅ Caso 3: Token Expirado (> 1 hora)

```
1. Login
2. Ver workspaces
3. Esperar 1+ hora (o cambiar JWT_EXPIRES_IN a 10s para testing)
4. Refresh
5. ✅ Token se renueva automáticamente
6. ✅ Workspaces cargan correctamente
```

#### ✅ Caso 4: Refresh Token Expirado (> 7 días)

```
1. Login
2. Esperar 7+ días (o cambiar REFRESH_TOKEN_EXPIRES_IN)
3. Volver al sitio
4. ✅ Redirige a /login
5. ✅ Mensaje: "Tu sesión ha expirado"
```

#### ✅ Caso 5: Dentro de una Workspace

```
1. Login
2. Entrar a workspace específica
3. Refresh
4. ✅ Sigue en la misma workspace
5. ✅ Datos de la workspace persisten
```

---

## 🔧 Archivos Modificados

### 1. `apps/web/src/stores/workspaceStore.ts`

**Cambios:**

- ✅ Agregado `persist` middleware
- ✅ Configurado `localStorage` storage
- ✅ Partialize para solo guardar lo necesario
- ✅ Reemplazado `apiRequest` por `apiService`
- ✅ Todas las 9 funciones actualizadas

### 2. Archivos Relacionados (ya existentes)

- `apps/web/src/services/apiService.ts` - Manejo de refresh
- `apps/web/src/stores/authStore.ts` - Ya usa persist
- `apps/web/src/components/ProtectedRoute.tsx` - Verifica auth
- `apps/web/src/app/dashboard/workspaces/page.tsx` - Llama fetchWorkspaces()

---

## 💡 Beneficios Adicionales

### 1. Mejor UX

- ✅ Carga instantánea (datos desde localStorage)
- ✅ Actualización en background (servidor)
- ✅ No pierde contexto al navegar

### 2. Mejor Performance

- ✅ Menos llamadas al servidor
- ✅ Cache local efectivo
- ✅ Hidratación rápida

### 3. Resiliencia

- ✅ Funciona con mala conexión
- ✅ Maneja tokens expirados
- ✅ Recuperación automática

### 4. Mantenibilidad

- ✅ Un solo servicio de API (`apiService`)
- ✅ Lógica centralizada
- ✅ Más fácil de debuggear

---

## 🎯 Próximos Pasos Sugeridos

### 1. Aplicar el Mismo Patrón a Otros Stores

**Stores que pueden beneficiarse:**

- ❓ `boardStore` - Persist boards
- ❓ `listStore` - Persist lists
- ❓ `cardStore` - Persist cards
- ❓ `documentStore` - Persist documents

**Patrón a seguir:**

```typescript
export const useXStore = create<XState>()(
  persist(
    (set, get) => ({
      // Estado
    }),
    {
      name: 'aether-x-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        // Solo lo necesario
      }),
    }
  )
);
```

### 2. Agregar Indicador de Estado

```tsx
// Mostrar cuando se está usando cache vs servidor
{
  isHydrated && !isLoading && (
    <span className="text-xs text-text-muted">📦 Cargado desde cache</span>
  );
}

{
  !isHydrated && isLoading && (
    <span className="text-xs text-text-muted">🌐 Cargando desde servidor...</span>
  );
}
```

### 3. Agregar Refresh Manual

```tsx
<button onClick={() => fetchWorkspaces()}>🔄 Refrescar</button>
```

### 4. Limpiar Cache al Logout

```typescript
// En authStore.logout()
localStorage.removeItem('aether-workspace-storage');
localStorage.removeItem('aether-board-storage');
// etc...
```

---

## 📝 Notas Importantes

### Seguridad

✅ Los tokens persisten en localStorage de forma segura
✅ El refresh token se usa solo cuando es necesario
✅ Los tokens expirados se renuevan automáticamente
✅ Si el refresh token expira, se redirige a login

### Performance

✅ Workspaces cargan instantáneamente desde cache
✅ Se actualizan en background desde el servidor
✅ No bloquea la UI mientras actualiza

### Limitaciones

⚠️ localStorage tiene límite de ~5-10MB
⚠️ Si se borra localStorage, se pierden los datos (pero se recargan del servidor)
⚠️ No sincroniza entre pestañas automáticamente (se puede agregar con BroadcastChannel)

---

## ✅ Conclusión

El bug estaba causado por **falta de persistencia** en el workspaceStore y **no usar el sistema de refresh automático de tokens**.

Con las correcciones:

- ✅ Las workspaces persisten entre recargas
- ✅ Los tokens se renuevan automáticamente
- ✅ El socket se reconecta automáticamente
- ✅ La experiencia del usuario es fluida

**Estado:** 🟢 RESUELTO
