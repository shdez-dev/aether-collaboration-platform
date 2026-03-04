# 🚀 Guía de Despliegue en Render.com

Esta guía te llevará paso a paso para desplegar **AETHER Collaboration Platform** en Render.com.

---

## 📋 Pre-requisitos

Antes de comenzar, asegúrate de tener:

1. ✅ Una cuenta en [Render.com](https://render.com) (gratis para empezar)
2. ✅ Una cuenta en [Resend](https://resend.com) para emails transaccionales
3. ✅ Tu repositorio Git sincronizado y pusheado a GitHub/GitLab
4. ✅ Acceso al dashboard de Render

---

## 🎯 Pasos para el Despliegue

### **Paso 1: Preparar el Repositorio**

1. Asegúrate de que todos tus cambios estén commiteados:

```bash
git add .
git commit -m "Preparar para deployment en Render"
git push origin main
```

2. Verifica que el archivo `render.yaml` esté en la raíz del proyecto (ya está incluido).

---

### **Paso 2: Conectar Render con tu Repositorio**

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Haz clic en **"New +"** → **"Blueprint"**
3. Conecta tu repositorio de GitHub/GitLab
4. Selecciona el repositorio `aether-collaboration-platform`
5. Render detectará automáticamente el archivo `render.yaml`
6. Haz clic en **"Apply"**

Render comenzará a crear todos los servicios definidos en `render.yaml`:

- ✅ PostgreSQL Database
- ✅ Redis Cache
- ✅ API Backend
- ✅ Web Frontend

**⏱️ Esto puede tardar 10-15 minutos en el primer despliegue.**

---

### **Paso 3: Obtener las URLs de los Servicios**

Una vez que Render termine de crear los servicios, necesitas obtener sus URLs:

1. En el dashboard de Render, verás 4 servicios creados:
   - `aether-postgres` (Base de datos)
   - `aether-redis` (Cache)
   - `aether-api` (Backend)
   - `aether-web` (Frontend)

2. Anota las URLs públicas:
   - **API URL**: `https://aether-api-xxxxx.onrender.com`
   - **WEB URL**: `https://aether-web-xxxxx.onrender.com`

---

### **Paso 4: Configurar Variables de Entorno**

#### **4.1 Configurar el Backend (aether-api)**

Ve al servicio `aether-api` → **Environment** y agrega/actualiza:

```bash
# Database Connection (construir desde las variables individuales)
DATABASE_URL=postgresql://aether:TU_DB_PASSWORD@aether-postgres:5432/aether_production?schema=public

# URLs del Frontend
CORS_ORIGIN=https://aether-web-xxxxx.onrender.com
ALLOWED_ORIGINS=https://aether-web-xxxxx.onrender.com
FRONTEND_URL=https://aether-web-xxxxx.onrender.com

# Redis Connection
REDIS_URL=redis://:TU_REDIS_PASSWORD@aether-redis:6379

# Resend API Key (obtén uno en resend.com)
RESEND_API_KEY=re_tu_clave_de_resend_aquí

# Email Configuration
EMAIL_FROM=noreply@tudominio.com
EMAIL_FROM_NAME=Aether Platform
```

**🔑 Para obtener tu DB Password:**

- Ve al servicio `aether-postgres`
- Busca la variable `POSTGRES_PASSWORD` (Render la generó automáticamente)
- Construye la URL: `postgresql://aether:PASSWORD@aether-postgres:5432/aether_production?schema=public`
- Reemplaza `PASSWORD` con el valor real

**🔑 Para obtener tu Redis Password:**

- Ve al servicio `aether-redis`
- Busca la variable `REDIS_PASSWORD` (Render la generó automáticamente)
- Construye la URL: `redis://:PASSWORD@aether-redis:6379`
- Reemplaza `PASSWORD` con el valor real

**📧 Para obtener tu Resend API Key:**

1. Ve a [Resend Dashboard](https://resend.com/api-keys)
2. Crea una nueva API Key
3. Cópiala y pégala en `RESEND_API_KEY`

#### **4.2 Configurar el Frontend (aether-web)**

Ve al servicio `aether-web` → **Environment** y agrega/actualiza:

```bash
# API URLs
NEXT_PUBLIC_API_URL=https://aether-api-xxxxx.onrender.com
NEXT_PUBLIC_WS_URL=wss://aether-api-xxxxx.onrender.com
```

**💡 Nota:** Cambia `https://` por `wss://` para WebSockets.

---

### **Paso 5: Ejecutar Migraciones de Base de Datos**

Una vez configuradas las variables, necesitas ejecutar las migraciones:

1. Ve al servicio `aether-api` en Render
2. Haz clic en **"Shell"** (botón en la parte superior)
3. Se abrirá una terminal interactiva
4. Ejecuta los siguientes comandos:

```bash
# Navegar al directorio de la API
cd apps/api

# Ejecutar migraciones
npx prisma migrate deploy

# (Opcional) Poblar la base de datos con datos de prueba
npm run seed
```

**✅ Si todo sale bien, verás:** `Database migrations completed successfully`

---

### **Paso 6: Verificar el Despliegue**

1. **Verifica el Backend:**
   - Abre: `https://aether-api-xxxxx.onrender.com/health`
   - Deberías ver: `{"status":"ok","timestamp":"..."}`

2. **Verifica el Frontend:**
   - Abre: `https://aether-web-xxxxx.onrender.com`
   - Deberías ver la página de inicio de AETHER

3. **Prueba el Registro:**
   - Intenta crear una cuenta
   - Verifica que llegue el email de confirmación
   - Si no llega, revisa los logs de `aether-api` y tu configuración de Resend

---

## 🔧 Configuración Adicional (Opcional)

### **Habilitar Dominio Personalizado**

1. Ve al servicio `aether-web` → **Settings** → **Custom Domain**
2. Agrega tu dominio (ej: `app.tudominio.com`)
3. Configura los registros DNS según las instrucciones de Render
4. Actualiza las variables de entorno con el nuevo dominio

### **Actualizar el Plan (Producción)**

Los planes gratuitos de Render tienen limitaciones:

- ⏸️ Los servicios se duermen después de 15 minutos de inactividad
- 🐌 Pueden tardar 30-60 segundos en "despertar"

Para producción, considera actualizar a:

- **Starter Plan**: $7/mes por servicio (siempre activo)
- **Standard Plan**: $25/mes por servicio (más recursos)

### **Configurar Auto-Deploy**

Render ya está configurado para auto-deploy cuando haces push a `main`:

```bash
# Hacer cambios
git add .
git commit -m "Mi cambio"
git push origin main

# Render automáticamente detecta el cambio y re-despliega
```

---

## 📊 Monitoreo y Logs

### **Ver Logs en Tiempo Real**

1. Ve a cualquier servicio en Render
2. Haz clic en **"Logs"**
3. Verás los logs en tiempo real

### **Métricas**

Render proporciona métricas básicas:

- CPU Usage
- Memory Usage
- Request Count
- Response Times

---

## 🐛 Solución de Problemas Comunes

### **Problema: Error de CORS**

```
Access to fetch at 'https://api...' has been blocked by CORS policy
```

**Solución:**

- Verifica que `CORS_ORIGIN` en `aether-api` tenga la URL correcta del frontend
- Debe incluir el protocolo: `https://aether-web-xxxxx.onrender.com`

---

### **Problema: WebSockets no funcionan**

```
WebSocket connection to 'ws://...' failed
```

**Solución:**

- Asegúrate de usar `wss://` (no `ws://`) en `NEXT_PUBLIC_WS_URL`
- Ejemplo: `wss://aether-api-xxxxx.onrender.com`

---

### **Problema: Emails no se envían**

```
Error sending email: Invalid API key
```

**Solución:**

1. Verifica que `RESEND_API_KEY` esté correctamente configurada
2. Ve a [Resend Dashboard](https://resend.com/domains) y verifica tu dominio
3. Asegúrate de que `EMAIL_FROM` use un dominio verificado en Resend

---

### **Problema: Base de datos vacía después de deploy**

```
No users found / Cannot login
```

**Solución:**

```bash
# Conectarse al Shell de aether-api
cd apps/api
npx prisma migrate deploy
npm run seed
```

---

### **Problema: Build falla en el frontend**

```
Error: Cannot find module '@aether/types'
```

**Solución:**

- Verifica que el `Dockerfile` de web incluya la build de packages
- Revisa que `transpilePackages: ['@aether/types']` esté en `next.config.js`

---

## 🔐 Seguridad en Producción

### **Variables Sensibles**

✅ **NUNCA** commitees al repositorio:

- Claves de API (Resend, etc)
- Secretos JWT
- Passwords de base de datos

✅ **SIEMPRE** usa las variables de entorno de Render

### **Secretos Fuertes**

Para generar secretos seguros:

```bash
# JWT_SECRET
openssl rand -base64 32

# REFRESH_TOKEN_SECRET
openssl rand -base64 32
```

Pega estos valores en las variables de entorno de Render.

---

## 📈 Escalabilidad

### **Escalar Horizontalmente**

Para manejar más tráfico:

1. Ve a `aether-api` → **Settings** → **Scaling**
2. Aumenta el número de instancias (ej: 2-4)
3. Render automáticamente balancea la carga

### **Escalar Verticalmente**

Para más recursos por instancia:

1. Cambia el plan a **Standard** o **Pro**
2. Render reiniciará el servicio con más CPU/RAM

---

## 🎉 ¡Listo!

Tu aplicación AETHER está ahora desplegada y lista para usar en producción.

### URLs Finales:

- 🌐 **Frontend**: `https://aether-web-xxxxx.onrender.com`
- 🔌 **API**: `https://aether-api-xxxxx.onrender.com`
- 📊 **Dashboard**: `https://dashboard.render.com`

---

## 📞 Soporte

Si tienes problemas:

1. Revisa los **Logs** en Render Dashboard
2. Consulta la [Documentación de Render](https://render.com/docs)
3. Revisa los issues en el repositorio del proyecto

---

## 🔄 Actualizaciones Futuras

Para actualizar la aplicación:

```bash
# 1. Hacer cambios localmente
git add .
git commit -m "Nueva funcionalidad"

# 2. Push a main
git push origin main

# 3. Render automáticamente re-despliega
# 4. Monitorea el progreso en Render Dashboard
```

---

**¡Buena suerte con tu deployment! 🚀**
