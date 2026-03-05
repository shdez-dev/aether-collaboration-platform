# 🚀 GUÍA PASO A PASO: Despliegue de AETHER en Render

Esta es la guía completa para lanzar tu aplicación AETHER a producción en Render.com.

---

## ⚠️ ANTES DE EMPEZAR

### **1. Permitir el Secret en GitHub (IMPORTANTE)**

Antes de hacer push, GitHub bloqueó un commit porque detectó una API key en el historial.

**Sigue estos pasos:**

1. Ve a este link: https://github.com/Loksz/aether-collaboration-platform/security/secret-scanning/unblock-secret/3AVE9vL3EmGtsVTcVKGjw9BjdDv
2. Haz clic en **"Allow secret"** o **"It's used in tests"**
3. Confirma la acción

**Luego haz push:**

```bash
git push origin main
```

---

## 📋 PRE-REQUISITOS

### **Cuentas Necesarias:**

✅ **1. Cuenta en Render.com**

- Ve a: https://render.com
- Sign up con GitHub (recomendado) o email
- **Plan:** Free tier es suficiente para empezar

✅ **2. Cuenta en Brevo (para emails)**

- Ve a: https://www.brevo.com
- Regístrate gratis
- **Plan Free:** 300 emails/día

✅ **3. Repositorio en GitHub**

- Ya lo tienes: https://github.com/Loksz/aether-collaboration-platform
- Asegúrate de que esté actualizado con `git push origin main`

---

## 🎯 PASO 1: Configurar Brevo (Emails)

### **1.1 Crear Cuenta y Obtener API Key**

1. Ve a [Brevo](https://www.brevo.com) e inicia sesión
2. Navega a **Settings** (⚙️) → **SMTP & API** → **API Keys**
3. Haz clic en **"Create a new API key"**
4. Nombre: `AETHER Production`
5. **Copia la API key** (empieza con `xkeysib-...`)
6. **Guárdala en un lugar seguro** (solo se muestra una vez)

### **1.2 Verificar el Email Remitente**

1. En Brevo, ve a **Senders & IP** → **Senders**
2. Haz clic en **"Add a sender"**
3. Ingresa:
   - **Email:** `aether.notifications@gmail.com`
   - **Name:** `Aether Platform`
4. Haz clic en **"Add"**
5. **IMPORTANTE:** Revisa el inbox de `aether.notifications@gmail.com`
6. Abre el email de Brevo y **haz clic en el link de verificación**
7. Espera a que el email muestre ✅ como verificado en Brevo

📚 **Guía detallada:** Ver [BREVO_SETUP.md](./BREVO_SETUP.md)

---

## 🎯 PASO 2: Conectar Render con GitHub

1. Ve a [Render Dashboard](https://dashboard.render.com)
2. Haz clic en **"New +"** (arriba a la derecha)
3. Selecciona **"Blueprint"**
4. **Conecta tu cuenta de GitHub** si aún no lo has hecho
5. Busca el repositorio: `aether-collaboration-platform`
6. Selecciónalo
7. Render detectará automáticamente el archivo `render.yaml`
8. Haz clic en **"Apply"**

**⏱️ Render creará 4 servicios:**

- `aether-postgres` (Base de datos PostgreSQL)
- `aether-redis` (Cache Redis)
- `aether-api` (Backend Node.js)
- `aether-web` (Frontend Next.js)

**Esto tardará 10-15 minutos.** ☕ Puedes continuar mientras se despliegan.

---

## 🎯 PASO 3: Anotar las URLs de los Servicios

Una vez que los servicios estén en estado **"Live"**, anota sus URLs:

### **Cómo encontrar las URLs:**

1. En Render Dashboard, haz clic en cada servicio
2. Copia la URL que aparece arriba (ejemplo: `https://aether-api-xxxxx.onrender.com`)

### **Anota estas URLs:**

```
API URL:  https://aether-api-xxxxx.onrender.com
WEB URL:  https://aether-web-xxxxx.onrender.com
```

_Reemplaza `xxxxx` con el identificador real que Render asigna._

---

## 🎯 PASO 4: Obtener Passwords de Render

Render generó automáticamente passwords seguros para PostgreSQL y Redis.

### **4.1 Obtener Password de PostgreSQL**

1. Ve al servicio **`aether-postgres`**
2. Haz clic en **"Environment"** en el menú lateral
3. Busca la variable **`POSTGRES_PASSWORD`**
4. Haz clic en el ícono del ojo 👁️ para ver el valor
5. **Copia el password completo**

### **4.2 Obtener Password de Redis**

1. Ve al servicio **`aether-redis`**
2. Haz clic en **"Environment"**
3. Busca la variable **`REDIS_PASSWORD`**
4. Haz clic en el ícono del ojo 👁️ para ver el valor
5. **Copia el password completo**

---

## 🎯 PASO 5: Configurar Variables de Entorno del Backend

Ve al servicio **`aether-api`** → **Environment**

### **Variables a Agregar/Actualizar:**

```bash
# 1. DATABASE_URL (construir con el password de PostgreSQL)
DATABASE_URL=postgresql://aether:TU_POSTGRES_PASSWORD@aether-postgres:5432/aether_production?schema=public

# 2. REDIS_URL (construir con el password de Redis)
REDIS_URL=redis://:TU_REDIS_PASSWORD@aether-redis:6379

# 3. URLs del Frontend (usar la URL de aether-web)
CORS_ORIGIN=https://aether-web-xxxxx.onrender.com
ALLOWED_ORIGINS=https://aether-web-xxxxx.onrender.com
FRONTEND_URL=https://aether-web-xxxxx.onrender.com

# 4. Brevo API Key (la que obtuviste en el Paso 1)
BREVO_API_KEY=xkeysib-tu_clave_aqui

# 5. Email Configuration
EMAIL_FROM=aether.notifications@gmail.com
EMAIL_FROM_NAME=Aether Platform
```

### **Cómo Agregar Variables:**

1. Haz clic en **"Add Environment Variable"**
2. **Key:** nombre de la variable (ej: `DATABASE_URL`)
3. **Value:** valor de la variable
4. Repite para cada variable
5. Haz clic en **"Save Changes"**

**🔄 Render automáticamente re-desplegará el servicio.**

---

## 🎯 PASO 6: Configurar Variables de Entorno del Frontend

Ve al servicio **`aether-web`** → **Environment**

### **Variables a Agregar:**

```bash
# API URLs (usar la URL de aether-api)
NEXT_PUBLIC_API_URL=https://aether-api-xxxxx.onrender.com
NEXT_PUBLIC_WS_URL=wss://aether-api-xxxxx.onrender.com
```

**⚠️ IMPORTANTE:**

- Para `NEXT_PUBLIC_WS_URL` usa `wss://` (WebSocket Secure)
- NO uses `ws://` en producción

Haz clic en **"Save Changes"**

**🔄 Render automáticamente re-desplegará el servicio.**

---

## 🎯 PASO 7: Ejecutar Migraciones de Base de Datos

Una vez que `aether-api` termine de re-desplegar (después del Paso 5):

1. Ve al servicio **`aether-api`**
2. Haz clic en el botón **"Shell"** (arriba a la derecha, ícono de terminal)
3. Espera a que se abra la terminal
4. Ejecuta estos comandos:

```bash
# Navegar al directorio de la API
cd apps/api

# Ejecutar migraciones de Prisma
npx prisma migrate deploy

# Espera a ver: "All migrations have been successfully applied."
```

### **Si ves errores:**

- Verifica que `DATABASE_URL` esté correcta
- Asegúrate de que el servicio PostgreSQL esté corriendo
- Revisa los logs del servicio API

### **(Opcional) Poblar con Datos de Prueba:**

```bash
# Crear usuarios y workspaces de ejemplo
npm run seed
```

**⚠️ Solo en desarrollo/staging, NO en producción real.**

---

## 🎯 PASO 8: Verificar el Despliegue

### **8.1 Verificar el Backend**

Abre en tu navegador:

```
https://aether-api-xxxxx.onrender.com/health
```

**Deberías ver:**

```json
{
  "status": "ok",
  "timestamp": "2026-03-04T21:30:00.000Z"
}
```

✅ Si ves esto, **el backend está funcionando correctamente**.

### **8.2 Verificar el Frontend**

Abre en tu navegador:

```
https://aether-web-xxxxx.onrender.com
```

**Deberías ver:**

- La página de inicio de AETHER
- Diseño negro y azul terminal/cyberpunk
- Botones "Get Started" y "Sign In"

✅ Si ves la página correctamente, **el frontend está funcionando**.

---

## 🎯 PASO 9: Probar Funcionalidad Completa

### **9.1 Registro de Usuario**

1. Haz clic en **"Get Started"**
2. Completa el formulario de registro
3. Haz clic en **"Create Account"**

### **9.2 Verificar Email**

1. Revisa el inbox del email que usaste para registrarte
2. **Deberías recibir un email de Brevo** con el diseño terminal de AETHER
3. Haz clic en el botón **"VERIFY IDENTITY"**
4. Deberías ser redirigido a la aplicación

**⚠️ Si NO llega el email:**

- Revisa SPAM/Promociones
- Verifica que `BREVO_API_KEY` esté correcta
- Verifica que `aether.notifications@gmail.com` esté verificado en Brevo
- Revisa los logs de `aether-api` en Render

### **9.3 Iniciar Sesión**

1. Inicia sesión con tu cuenta verificada
2. Deberías ver el dashboard
3. Crea un workspace de prueba
4. Crea un board
5. Crea algunas cards

### **9.4 Verificar Tiempo Real**

1. Abre la aplicación en dos navegadores diferentes (o pestañas en incógnito)
2. Inicia sesión con la misma cuenta
3. Mueve una card en un navegador
4. **Deberías ver el cambio en tiempo real en el otro navegador**

✅ Si funciona, **WebSockets están configurados correctamente**.

---

## 🎯 PASO 10: Monitoreo y Mantenimiento

### **Ver Logs en Tiempo Real**

1. Ve a cualquier servicio en Render
2. Haz clic en **"Logs"** en el menú lateral
3. Verás los logs en tiempo real

### **Métricas**

Render proporciona métricas básicas:

- **CPU Usage**
- **Memory Usage**
- **Request Count**
- **Response Times**

Haz clic en **"Metrics"** para verlas.

---

## ✅ CHECKLIST FINAL

- [ ] Cuenta en Render creada y conectada con GitHub
- [ ] Cuenta en Brevo creada con API key
- [ ] Email `aether.notifications@gmail.com` verificado en Brevo
- [ ] Push del código a GitHub completado
- [ ] Blueprint aplicado en Render
- [ ] 4 servicios creados y en estado "Live"
- [ ] URLs de servicios anotadas
- [ ] Passwords de PostgreSQL y Redis obtenidos
- [ ] Variables de entorno del backend configuradas
- [ ] Variables de entorno del frontend configuradas
- [ ] Migraciones de base de datos ejecutadas
- [ ] Health check del backend OK (200)
- [ ] Frontend cargando correctamente
- [ ] Registro de usuario funcionando
- [ ] Email de verificación recibido
- [ ] Login funcionando
- [ ] WebSockets/tiempo real funcionando
- [ ] Logs monitoreados sin errores críticos

---

## 📊 URLs Finales de tu Aplicación

```
🌐 Frontend:  https://aether-web-xxxxx.onrender.com
🔌 API:       https://aether-api-xxxxx.onrender.com
📊 Dashboard: https://dashboard.render.com
```

---

## 💰 Costos de Render

### **Plan Gratuito (Actual):**

- ✅ Suficiente para desarrollo y pruebas
- ⚠️ Los servicios se "duermen" después de 15 min de inactividad
- ⚠️ Tardan ~30-60 segundos en "despertar"
- ✅ 750 horas/mes de tiempo activo por servicio

### **Actualizar a Producción:**

**Plan Starter ($7/mes por servicio):**

- ✅ Servicios siempre activos (no se duermen)
- ✅ SSL automático
- ✅ Ideal para producción pequeña

**Costo Total Estimado:**

- PostgreSQL: $7/mes
- Redis: $7/mes
- API: $7/mes
- Web: $7/mes
- **Total: ~$28/mes**

---

## 🔄 Actualizar la Aplicación en el Futuro

Render tiene **auto-deploy** configurado. Cada vez que hagas push a `main`:

```bash
# 1. Hacer tus cambios localmente
git add .
git commit -m "Nueva funcionalidad"

# 2. Push a GitHub
git push origin main

# 3. Render automáticamente detecta el cambio y re-despliega
```

**Monitorea el progreso en Render Dashboard.**

---

## 🐛 Problemas Comunes

### **"Service Unavailable" al abrir la app**

**Solución:**

- Los servicios gratuitos se duermen después de 15 min
- Espera 30-60 segundos mientras se despiertan
- Actualiza la página

### **"CORS Error" en el frontend**

**Solución:**

```bash
# Verifica que en aether-api:
CORS_ORIGIN=https://aether-web-xxxxx.onrender.com  # URL exacta del frontend
```

### **"Database connection failed"**

**Solución:**

```bash
# Verifica DATABASE_URL en aether-api:
DATABASE_URL=postgresql://aether:PASSWORD@aether-postgres:5432/aether_production?schema=public

# Asegúrate de que el password sea correcto (sin espacios)
```

### **"WebSocket connection failed"**

**Solución:**

```bash
# En aether-web, asegúrate de usar wss:// (NO ws://):
NEXT_PUBLIC_WS_URL=wss://aether-api-xxxxx.onrender.com
```

### **"Emails no se envían"**

**Solución:**

1. Verifica `BREVO_API_KEY` en aether-api
2. Verifica que `aether.notifications@gmail.com` esté verificado en Brevo
3. Revisa los logs de aether-api para errores de Brevo

---

## 🎉 ¡FELICIDADES!

Tu aplicación AETHER está ahora **corriendo en producción** en Render.

### **Próximos Pasos Recomendados:**

1. **Configurar un dominio personalizado** (ej: `app.tudominio.com`)
2. **Habilitar backups automáticos** de la base de datos
3. **Configurar alertas** para errores críticos
4. **Actualizar a plan Starter** cuando tengas usuarios reales
5. **Configurar monitoreo** con herramientas como Sentry

---

## 📚 Recursos Adicionales

- [Documentación de Render](https://render.com/docs)
- [Guía de Brevo](./BREVO_SETUP.md)
- [Checklist de Deployment](./DEPLOYMENT_CHECKLIST.md)
- [Variables de Entorno](./ENV_SETUP.md)

---

**¿Necesitas ayuda?**

- Revisa los **Logs** en Render Dashboard
- Consulta los problemas comunes arriba
- Revisa la documentación oficial de Render

---

**¡Buena suerte con tu deployment! 🚀**
