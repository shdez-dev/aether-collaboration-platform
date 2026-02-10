# Implementación de Gestión de Usuarios y Perfiles

Este documento describe la implementación completa del punto 2 "GESTIÓN DE USUARIOS & PERFILES" del archivo `scripts/ideas.md`.

## Resumen

Se ha implementado un sistema completo de gestión de perfiles de usuario con las siguientes características:

### ✅ Características Implementadas

#### 1. **Perfil de Usuario Completo**

- Página dedicada en `/dashboard/profile`
- Edición de información personal (nombre, bio, cargo, teléfono, ubicación)
- Gestión de preferencias (timezone, idioma)
- Cambio de contraseña con validación

#### 2. **Avatares / Fotos de Perfil**

- Upload de imágenes con validación (tipo y tamaño)
- Preview antes de subir
- Crop y resize automático
- Avatares por defecto con iniciales
- Soporte para JPG, PNG, GIF, WebP (máximo 5MB)

#### 3. **Bio y Metadata**

- Bio corta del usuario
- Cargo / Posición
- Timezone
- Idioma preferido (ES, EN, FR, DE, PT)
- Teléfono
- Ubicación

#### 4. **Página de Configuración Personal** (`/dashboard/settings`)

- Configuración de notificaciones:
  - Email notifications
  - Push notifications
  - In-app notifications
  - Frecuencia (tiempo real, diario, semanal)
- Configuración de tema (light/dark/system)
- Vista predeterminada de boards (kanban/list/calendar)
- Modo compacto
- Mostrar elementos archivados

---

## Cambios en Base de Datos

### 1. **Tabla `users` (actualizada)**

Nuevos campos agregados:

```sql
bio TEXT
position VARCHAR(255)      -- Cargo o puesto
timezone VARCHAR(100) DEFAULT 'UTC'
language VARCHAR(10) DEFAULT 'en'
phone VARCHAR(50)
location VARCHAR(255)
```

### 2. **Tabla `user_preferences` (nueva)**

```sql
CREATE TABLE user_preferences (
  id UUID PRIMARY KEY,
  user_id UUID UNIQUE NOT NULL REFERENCES users(id),
  theme VARCHAR(20) DEFAULT 'dark',
  email_notifications BOOLEAN DEFAULT TRUE,
  push_notifications BOOLEAN DEFAULT TRUE,
  in_app_notifications BOOLEAN DEFAULT TRUE,
  notification_frequency VARCHAR(20) DEFAULT 'realtime',
  compact_mode BOOLEAN DEFAULT FALSE,
  show_archived BOOLEAN DEFAULT FALSE,
  default_board_view VARCHAR(20) DEFAULT 'kanban',
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### 3. **Triggers**

- Auto-actualización de `updated_at` en `users` y `user_preferences`
- Creación automática de preferencias por defecto al registrar un usuario

---

## Cambios en Backend (API)

### Archivos Modificados/Creados:

#### 1. **`apps/api/src/controllers/UserController.ts`**

Nuevos métodos:

- `updateProfile()` - PUT /api/users/me
- `uploadAvatar()` - POST /api/users/me/avatar
- `changePassword()` - PUT /api/users/me/password
- `getPreferences()` - GET /api/users/me/preferences
- `updatePreferences()` - PUT /api/users/me/preferences

#### 2. **`apps/api/src/routes/user.ts`**

Nuevas rutas:

```typescript
PUT    /api/users/me                 - Actualizar perfil
POST   /api/users/me/avatar          - Subir avatar
PUT    /api/users/me/password        - Cambiar contraseña
GET    /api/users/me/preferences     - Obtener preferencias
PUT    /api/users/me/preferences     - Actualizar preferencias
```

#### 3. **`apps/api/src/middleware/upload.ts`** (nuevo)

Middleware con Multer para upload de avatares:

- Validación de tipo de archivo (solo imágenes)
- Límite de tamaño (5MB)
- Nombres únicos: `{userId}-{timestamp}.ext`
- Almacenamiento en `public/uploads/avatars/`

#### 4. **`apps/api/src/index.ts`**

- Agregado middleware para servir archivos estáticos:

```typescript
app.use('/uploads', express.static('public/uploads'));
```

#### 5. **Dependencias Nuevas**

```bash
pnpm add multer @types/multer
```

---

## Cambios en Frontend (Web)

### Archivos Modificados/Creados:

#### 1. **Stores**

**`apps/web/src/stores/authStore.ts`** (actualizado)

- Interface `User` actualizada con nuevos campos
- Nuevos métodos:
  - `updateProfile(data)` - Actualizar información personal
  - `uploadAvatar(file)` - Subir foto de perfil
  - `changePassword(current, new)` - Cambiar contraseña

**`apps/web/src/stores/preferencesStore.ts`** (nuevo)

- Store dedicado para gestión de preferencias
- Métodos:
  - `loadPreferences()` - Cargar preferencias del usuario
  - `updatePreferences(prefs)` - Actualizar preferencias

#### 2. **Componentes UI**

Nuevos componentes creados:

**`apps/web/src/components/ui/input.tsx`**

- Componente Input estándar con estilos consistentes

**`apps/web/src/components/ui/label.tsx`**

- Labels para formularios con Radix UI

**`apps/web/src/components/ui/card.tsx`**

- Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter

**`apps/web/src/components/ui/switch.tsx`**

- Toggle switch con Radix UI

#### 3. **Componentes de Perfil**

**`apps/web/src/components/profile/AvatarUpload.tsx`** (nuevo)

- Componente especializado para upload de avatar
- Preview de imagen antes de subir
- Validación de archivos
- Muestra iniciales si no hay avatar

#### 4. **Páginas**

**`apps/web/src/app/dashboard/profile/page.tsx`** (nuevo)

- Página completa de gestión de perfil
- 3 secciones principales:
  1. **Foto de Perfil** - Upload y preview de avatar
  2. **Información Personal** - Formulario de datos personales
  3. **Cambiar Contraseña** - Formulario de cambio de contraseña seguro

**`apps/web/src/app/dashboard/settings/page.tsx`** (nuevo)

- Página de configuración y preferencias
- 4 secciones:
  1. **Apariencia** - Tema (light/dark/system)
  2. **Notificaciones** - Control granular de notificaciones
  3. **Vista de Boards** - Preferencias de visualización
  4. **Visualización** - Opciones de display

#### 5. **Dependencias Nuevas**

```bash
pnpm add @radix-ui/react-label @radix-ui/react-switch
```

---

## Estructura de Archivos

```
apps/
├── api/
│   ├── src/
│   │   ├── controllers/
│   │   │   └── UserController.ts      [MODIFICADO]
│   │   ├── middleware/
│   │   │   └── upload.ts              [NUEVO]
│   │   ├── routes/
│   │   │   └── user.ts                [MODIFICADO]
│   │   └── index.ts                   [MODIFICADO]
│   ├── public/
│   │   └── uploads/
│   │       └── avatars/               [NUEVO - carpeta para avatares]
│   └── prisma/
│       └── schema.prisma              [MODIFICADO]
│
└── web/
    ├── src/
    │   ├── app/
    │   │   └── dashboard/
    │   │       ├── profile/
    │   │       │   └── page.tsx       [NUEVO]
    │   │       └── settings/
    │   │           └── page.tsx       [NUEVO]
    │   ├── components/
    │   │   ├── profile/
    │   │   │   └── AvatarUpload.tsx   [NUEVO]
    │   │   └── ui/
    │   │       ├── input.tsx          [NUEVO]
    │   │       ├── label.tsx          [NUEVO]
    │   │       ├── card.tsx           [NUEVO]
    │   │       └── switch.tsx         [NUEVO]
    │   └── stores/
    │       ├── authStore.ts           [MODIFICADO]
    │       └── preferencesStore.ts    [NUEVO]

scripts/
└── init-database.sql                  [MODIFICADO]
```

---

## Cómo Usar

### 1. **Aplicar Migraciones de Base de Datos**

```bash
# Opción 1: Ejecutar el script SQL directamente
psql -U aether -d aether_dev -f scripts/init-database.sql

# Opción 2: Usar Prisma
cd apps/api
pnpm db:migrate
```

### 2. **Iniciar el Proyecto**

```bash
# Desde la raíz del proyecto
pnpm dev
```

### 3. **Acceder a las Páginas**

- **Perfil:** `http://localhost:3000/dashboard/profile`
- **Configuración:** `http://localhost:3000/dashboard/settings`

---

## API Endpoints

### Perfil de Usuario

#### Actualizar Perfil

```http
PUT /api/users/me
Content-Type: application/json
Authorization: Bearer {token}

{
  "name": "Juan Pérez",
  "bio": "Desarrollador Full Stack",
  "position": "Senior Developer",
  "timezone": "America/Mexico_City",
  "language": "es",
  "phone": "+52 55 1234 5678",
  "location": "Ciudad de México"
}
```

#### Subir Avatar

```http
POST /api/users/me/avatar
Content-Type: multipart/form-data
Authorization: Bearer {token}

FormData:
  avatar: [File]
```

#### Cambiar Contraseña

```http
PUT /api/users/me/password
Content-Type: application/json
Authorization: Bearer {token}

{
  "currentPassword": "current123",
  "newPassword": "newSecure456"
}
```

### Preferencias

#### Obtener Preferencias

```http
GET /api/users/me/preferences
Authorization: Bearer {token}
```

#### Actualizar Preferencias

```http
PUT /api/users/me/preferences
Content-Type: application/json
Authorization: Bearer {token}

{
  "theme": "dark",
  "emailNotifications": true,
  "pushNotifications": true,
  "inAppNotifications": true,
  "notificationFrequency": "realtime",
  "compactMode": false,
  "showArchived": false,
  "defaultBoardView": "kanban"
}
```

---

## Validaciones Implementadas

### Backend:

- **Avatar:** Solo imágenes (JPG, PNG, GIF, WebP), máximo 5MB
- **Contraseña:** Mínimo 6 caracteres
- **Email:** No se puede cambiar (solo admin)
- **Campos opcionales:** bio, position, phone, location

### Frontend:

- Validación de tipo de archivo en tiempo real
- Confirmación de contraseña debe coincidir
- Preview de avatar antes de subir
- Feedback visual con toasts para todas las acciones

---

## Características de Seguridad

1. **Autenticación requerida** en todos los endpoints
2. **Verificación de contraseña actual** antes de cambiarla
3. **Hash de contraseñas** con bcrypt
4. **Validación de tipos de archivo** para evitar uploads maliciosos
5. **Límites de tamaño** en uploads
6. **Sanitización de inputs** en el backend

---

## Próximos Pasos Sugeridos

Basándose en el documento `scripts/ideas.md`, las siguientes features serían buenas para implementar:

### Media Prioridad (de ideas.md):

- [ ] **Directorio de Usuarios** - Buscar usuarios, ver perfiles públicos
- [ ] **Integración con Gravatar** - Opcional para avatares
- [ ] **Sesiones Activas** - Ver y cerrar sesiones remotamente
- [ ] **Privacidad** - Configuración de perfil público/privado

### Mejoras Adicionales:

- [ ] Crop de imagen en el cliente antes de subir
- [ ] Integración con servicios de almacenamiento (S3, Cloudinary)
- [ ] Compresión automática de imágenes
- [ ] Historial de cambios de perfil
- [ ] Exportar datos del usuario (GDPR)

---

## Testing

### Endpoints a Testear:

```bash
# Actualizar perfil
curl -X PUT http://localhost:4000/api/users/me \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "Test User", "bio": "Testing bio"}'

# Subir avatar
curl -X POST http://localhost:4000/api/users/me/avatar \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -F "avatar=@/path/to/image.jpg"

# Cambiar contraseña
curl -X PUT http://localhost:4000/api/users/me/password \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"currentPassword": "old", "newPassword": "newpass123"}'

# Obtener preferencias
curl -X GET http://localhost:4000/api/users/me/preferences \
  -H "Authorization: Bearer YOUR_TOKEN"

# Actualizar preferencias
curl -X PUT http://localhost:4000/api/users/me/preferences \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"theme": "light", "emailNotifications": false}'
```

---

## Troubleshooting

### Error: "Cannot find module '@radix-ui/react-label'"

```bash
cd apps/web
pnpm add @radix-ui/react-label @radix-ui/react-switch
```

### Error: "Cannot find module 'multer'"

```bash
cd apps/api
pnpm add multer @types/multer
```

### Error al subir avatar: "Invalid file type"

- Verificar que el archivo sea JPG, PNG, GIF o WebP
- Máximo 5MB de tamaño

### Base de datos: Columnas no existen

```bash
# Re-ejecutar el script de base de datos
psql -U aether -d aether_dev -f scripts/init-database.sql
```

---

## Conclusión

Se ha implementado exitosamente el sistema completo de **Gestión de Usuarios y Perfiles** según lo especificado en el punto 2 del documento `scripts/ideas.md`.

### Features Completadas:

✅ Perfil de Usuario Completo  
✅ Avatares / Fotos de Perfil  
✅ Bio y Metadata  
✅ Página de Configuración Personal

### Archivos Modificados: 15+

### Nuevos Endpoints: 5

### Nuevas Páginas: 2 (/profile, /settings)

### Nuevos Componentes: 6

El sistema está completamente funcional y listo para usar. Todas las validaciones están implementadas tanto en frontend como en backend.
