# ⚙️ Configuración de Variables de Entorno

Esta guía te ayudará a configurar correctamente las variables de entorno para ejecutar AETHER en desarrollo.

---

## 📋 Archivos de Entorno

El proyecto usa diferentes archivos `.env` para diferentes propósitos:

```
aether-collaboration-platform/
├── .env.example              # Template para variables globales
├── .env.production.example   # Template para producción
├── apps/
│   ├── api/
│   │   ├── .env              # Variables de desarrollo del backend (NO committear)
│   │   └── .env.example      # Template del backend
│   └── web/
│       ├── .env              # Variables de desarrollo del frontend (NO committear)
│       └── .env.example      # Template del frontend
```

**⚠️ IMPORTANTE:** Los archivos `.env` están en `.gitignore` y NO deben subirse a Git.

---

## 🚀 Configuración Inicial (Primera Vez)

### **Paso 1: Configurar Backend (API)**

1. Ve a la carpeta `apps/api/`
2. El archivo `.env` ya existe, ábrelo y configúralo:

```bash
# Database - PostgreSQL
DB_HOST=localhost
DB_PORT=5432
DB_NAME=aether_dev
DB_USER=aether
DB_PASSWORD=aether_dev_password
DATABASE_URL=postgresql://aether:aether_dev_password@localhost:5432/aether_dev?schema=public

# Redis
REDIS_URL=redis://localhost:6379

# JWT - Authentication & Authorization
JWT_SECRET=cambia-esto-por-un-secreto-muy-largo-y-seguro-en-produccion
JWT_EXPIRES_IN=24h
REFRESH_TOKEN_SECRET=cambia-esto-por-otro-secreto-diferente-para-refresh-tokens
REFRESH_TOKEN_EXPIRES_IN=7d

# Server
API_PORT=3000
NODE_ENV=development

# CORS - Cross-Origin Resource Sharing
CORS_ORIGIN=http://localhost:3001
ALLOWED_ORIGINS=http://localhost:3001
FRONTEND_URL=http://localhost:3001

# Email - Brevo (formerly Sendinblue)
# Get your API key from: https://app.brevo.com/settings/keys/api
BREVO_API_KEY=xkeysib-your_api_key_here
EMAIL_FROM=aether.notifications@gmail.com
EMAIL_FROM_NAME=Aether Platform
```

**📧 Configurar Brevo:**

- Si NO tienes una API key de Brevo, consulta [BREVO_SETUP.md](./BREVO_SETUP.md)
- Para desarrollo, puedes dejarlo como está (los emails darán error pero la app funcionará)
- Para producción, DEBES configurar una API key válida

### **Paso 2: Configurar Frontend (Web)**

1. Ve a la carpeta `apps/web/`
2. El archivo `.env` ya existe, ábrelo y verifica:

```bash
# Web Server Configuration
PORT=3001

# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# WebSocket Configuration
NEXT_PUBLIC_WS_URL=ws://localhost:3000
```

---

## 🔑 Variables Importantes

### **Backend (apps/api/.env)**

| Variable        | Descripción                | Ejemplo                                    |
| --------------- | -------------------------- | ------------------------------------------ |
| `DATABASE_URL`  | Conexión a PostgreSQL      | `postgresql://user:pass@localhost:5432/db` |
| `REDIS_URL`     | Conexión a Redis           | `redis://localhost:6379`                   |
| `JWT_SECRET`    | Secreto para tokens JWT    | `un-secreto-muy-largo-y-aleatorio`         |
| `BREVO_API_KEY` | API key de Brevo           | `xkeysib-xxxx...`                          |
| `EMAIL_FROM`    | Email remitente            | `aether.notifications@gmail.com`           |
| `CORS_ORIGIN`   | URL del frontend permitida | `http://localhost:3001`                    |

### **Frontend (apps/web/.env)**

| Variable              | Descripción                 | Ejemplo                 |
| --------------------- | --------------------------- | ----------------------- |
| `NEXT_PUBLIC_API_URL` | URL del backend             | `http://localhost:3000` |
| `NEXT_PUBLIC_WS_URL`  | URL de WebSockets           | `ws://localhost:3000`   |
| `PORT`                | Puerto del servidor Next.js | `3001`                  |

---

## 🔄 Actualizar Variables Existentes

Si ya tenías el proyecto configurado con Resend, debes actualizar:

1. Abre `apps/api/.env`
2. **Elimina:**

   ```bash
   RESEND_API_KEY=...
   RESEND_FROM_EMAIL=...
   ```

3. **Agrega:**
   ```bash
   BREVO_API_KEY=xkeysib-your_api_key_here
   EMAIL_FROM=aether.notifications@gmail.com
   EMAIL_FROM_NAME=Aether Platform
   DATABASE_URL=postgresql://aether:aether_dev_password@localhost:5432/aether_dev?schema=public
   ```

---

## 🧪 Verificar Configuración

### **1. Verificar que Docker esté corriendo:**

```bash
docker ps
```

Deberías ver PostgreSQL y Redis corriendo.

### **2. Verificar conexión a la base de datos:**

```bash
cd apps/api
npx prisma studio
```

Si abre el navegador con Prisma Studio, ¡la conexión funciona! ✅

### **3. Iniciar el backend:**

```bash
cd apps/api
pnpm dev
```

Deberías ver:

```
🚀 Server running on port 3000
✅ Database connected
✅ Redis connected
```

### **4. Iniciar el frontend:**

```bash
cd apps/web
pnpm dev
```

Deberías ver:

```
▲ Next.js ready on http://localhost:3001
```

---

## ⚠️ Problemas Comunes

### **Error: "Cannot connect to database"**

```
Error: P1001: Can't reach database server
```

**Solución:**

1. Verifica que Docker esté corriendo: `docker ps`
2. Verifica que PostgreSQL esté levantado: `docker-compose ps`
3. Revisa que `DATABASE_URL` sea correcta en `.env`

---

### **Error: "BREVO_API_KEY is not configured"**

```
Error: BREVO_API_KEY is not configured in environment variables
```

**Solución:**

1. Abre `apps/api/.env`
2. Agrega tu API key de Brevo (consulta [BREVO_SETUP.md](./BREVO_SETUP.md))
3. Para desarrollo, puedes usar una key de prueba o dejar comentado el envío de emails

---

### **Error: "Invalid JWT secret"**

```
Error: JWT_SECRET must be at least 32 characters
```

**Solución:**

1. Genera un secreto fuerte:
   ```bash
   openssl rand -base64 32
   ```
2. Pégalo en `JWT_SECRET` en `apps/api/.env`

---

### **Error: "CORS policy blocked"**

```
Access to fetch at 'http://localhost:3000' has been blocked by CORS policy
```

**Solución:**

1. Verifica que `CORS_ORIGIN` en `apps/api/.env` sea `http://localhost:3001`
2. Reinicia el servidor backend

---

## 🔒 Seguridad

### **NUNCA:**

- ❌ Subir archivos `.env` a Git
- ❌ Compartir API keys públicamente
- ❌ Usar secretos débiles en producción
- ❌ Hacer commit de credenciales

### **SIEMPRE:**

- ✅ Usar `.env.example` como template
- ✅ Generar secretos fuertes y aleatorios
- ✅ Rotar API keys periódicamente
- ✅ Usar diferentes keys para dev/prod

---

## 📚 Recursos Adicionales

- [Configurar Brevo](./BREVO_SETUP.md) - Guía completa de email
- [Desplegar en Render](./DEPLOYMENT_RENDER.md) - Guía de deployment
- [Checklist de Deployment](./DEPLOYMENT_CHECKLIST.md) - Lista de verificación

---

## ✅ Checklist de Configuración

- [ ] Archivo `apps/api/.env` existe y está configurado
- [ ] Archivo `apps/web/.env` existe y está configurado
- [ ] PostgreSQL corriendo en Docker
- [ ] Redis corriendo en Docker
- [ ] `DATABASE_URL` configurada correctamente
- [ ] `BREVO_API_KEY` configurada (opcional en dev)
- [ ] Backend inicia sin errores
- [ ] Frontend inicia sin errores
- [ ] Puedes acceder a http://localhost:3001

---

**¡Listo! Tu entorno está configurado. 🎉**

Para iniciar ambos servicios:

```bash
# Terminal 1: Backend
cd apps/api && pnpm dev

# Terminal 2: Frontend
cd apps/web && pnpm dev
```
