# 📧 Guía de Configuración de Brevo (Sendinblue)

Esta guía te ayudará a configurar Brevo para enviar emails transaccionales desde AETHER.

---

## 📝 ¿Qué es Brevo?

Brevo (anteriormente conocido como Sendinblue) es un servicio de email marketing y transaccional que permite enviar emails de forma confiable.

**Ventajas de Brevo:**

- ✅ Plan gratuito: 300 emails/día
- ✅ Fácil configuración
- ✅ Alta entregabilidad
- ✅ Dashboard intuitivo
- ✅ Soporte para SMTP y API

---

## 🚀 Paso 1: Crear una Cuenta en Brevo

1. Ve a [Brevo.com](https://www.brevo.com)
2. Haz clic en **"Sign up free"**
3. Completa el formulario de registro
4. Verifica tu email
5. Completa tu perfil

**Plan Recomendado:**

- **Free**: 300 emails/día (suficiente para desarrollo y pruebas)
- **Starter ($25/mes)**: 20,000 emails/mes (producción pequeña)

---

## 🔑 Paso 2: Obtener tu API Key

1. Inicia sesión en [Brevo Dashboard](https://app.brevo.com)
2. Ve a **Settings** (⚙️ en la esquina superior derecha)
3. Click en **"SMTP & API"** en el menú lateral
4. En la sección **"API Keys"**, haz clic en **"Generate a new API key"**
5. Dale un nombre descriptivo (ejemplo: "AETHER Production")
6. Copia la API key que se genera

**⚠️ Importante:**

- La API key solo se muestra una vez
- Guárdala en un lugar seguro
- NO la compartas públicamente

**Formato de la API key:**

```
xkeysib-1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12-ABCDEFGHIJK
```

---

## 📨 Paso 3: Verificar el Email Remitente

Para poder enviar emails, debes verificar el email desde el cual enviarás:

### **Opción A: Verificación de Email Individual (Recomendado para Gmail)**

1. En Brevo Dashboard, ve a **"Senders & IP"**
2. Haz clic en **"Add a sender"**
3. Ingresa:
   - **Email:** `aether.notifications@gmail.com`
   - **Name:** `Aether Platform`
4. Haz clic en **"Add"**
5. **Importante:** Recibirás un email de verificación en `aether.notifications@gmail.com`
6. Abre ese email y haz clic en el link de verificación
7. Una vez verificado, el email aparecerá con un ✅ verde

### **Opción B: Verificación de Dominio Completo (Avanzado)**

Si tienes un dominio personalizado (ej: `@tuempresa.com`):

1. Ve a **"Senders & IP"** → **"Domains"**
2. Haz clic en **"Add a domain"**
3. Ingresa tu dominio
4. Brevo te dará 3 registros DNS:
   - **TXT** (para verificación)
   - **DKIM** (para autenticación)
   - **SPF** (para prevenir spam)
5. Agrega estos registros a tu proveedor de DNS
6. Espera 24-48 horas para que se propaguen
7. Verifica en Brevo que el dominio esté validado

**Para AETHER usaremos la Opción A** (Gmail).

---

## ⚙️ Paso 4: Configurar Variables de Entorno

### **Para Desarrollo Local:**

Crea o edita tu archivo `.env` en la raíz del proyecto:

```bash
# Brevo Configuration
BREVO_API_KEY=xkeysib-tu_api_key_aqui
EMAIL_FROM=aether.notifications@gmail.com
EMAIL_FROM_NAME=Aether Platform
```

### **Para Producción (Render):**

1. Ve a tu servicio `aether-api` en Render
2. Click en **"Environment"**
3. Agrega estas variables:

```bash
BREVO_API_KEY=xkeysib-tu_api_key_aqui
EMAIL_FROM=aether.notifications@gmail.com
EMAIL_FROM_NAME=Aether Platform
```

4. Guarda los cambios
5. Render re-desplegará automáticamente

---

## ✅ Paso 5: Probar el Envío de Emails

### **Opción 1: Desde la Aplicación**

1. Inicia tu aplicación local o accede a la versión en producción
2. Intenta registrarte con un email de prueba
3. Deberías recibir el email de verificación

### **Opción 2: Desde el Dashboard de Brevo**

1. Ve a **"Campaigns"** → **"Transactional"**
2. Podrás ver todos los emails enviados
3. Revisa el status (✅ Sent, ❌ Failed, etc.)

---

## 📊 Monitoreo y Estadísticas

### **Ver Emails Enviados:**

1. Ve a **"Statistics"** → **"Transactional"**
2. Aquí verás:
   - Total de emails enviados
   - Emails entregados
   - Emails rebotados
   - Emails abiertos
   - Clicks en links

### **Logs Detallados:**

1. Ve a **"Campaigns"** → **"Transactional"**
2. Filtra por fecha, email, subject, etc.
3. Haz clic en cualquier email para ver detalles completos

---

## 🔧 Troubleshooting

### **Problema: "Invalid API Key"**

```
Error: Failed to send email: Invalid API key
```

**Solución:**

1. Verifica que copiaste la API key completa
2. Asegúrate de que no tiene espacios al inicio o final
3. Genera una nueva API key si es necesario

---

### **Problema: "Sender not verified"**

```
Error: The sender email is not verified
```

**Solución:**

1. Ve a Brevo → **"Senders & IP"**
2. Verifica que `aether.notifications@gmail.com` tenga un ✅
3. Si no está verificado, haz clic en **"Resend verification email"**
4. Revisa la bandeja de entrada de `aether.notifications@gmail.com`

---

### **Problema: "Daily limit exceeded"**

```
Error: Daily sending limit exceeded
```

**Solución:**

1. Verifica tu plan en Brevo
2. Plan gratuito: 300 emails/día
3. Si necesitas más, actualiza tu plan
4. Los límites se resetean cada 24 horas

---

### **Problema: "Email blocked as spam"**

```
Email was blocked by spam filter
```

**Solución:**

1. Evita palabras spam en el subject ("FREE", "WINNER", etc.)
2. Verifica que tu dominio tenga registros SPF/DKIM
3. No uses URLs acortadas en el email
4. Mantén una buena ratio de apertura/bounce

---

## 📈 Límites del Plan Gratuito

**Free Plan:**

- ✅ 300 emails/día
- ✅ API ilimitadas
- ✅ Emails transaccionales
- ✅ Estadísticas básicas
- ❌ Sin soporte prioritario

**¿Cuándo actualizar?**

- Si envías más de 300 emails/día
- Si necesitas soporte prioritario
- Si quieres funciones avanzadas (A/B testing, etc.)

---

## 🔐 Mejores Prácticas de Seguridad

1. **Nunca compartas tu API Key**
   - No la subas a GitHub
   - No la pongas en el código
   - Usa siempre variables de entorno

2. **Rota tus API Keys periódicamente**
   - Genera una nueva cada 3-6 meses
   - Elimina las keys antiguas

3. **Usa diferentes keys para desarrollo y producción**
   - Key de desarrollo: para pruebas
   - Key de producción: solo en servidor

4. **Monitorea el uso**
   - Revisa regularmente las estadísticas
   - Alerta si hay picos inusuales de emails

---

## 📧 Tipos de Emails que Enviará AETHER

1. **Verificación de Email** (al registrarse)
2. **Recuperación de Contraseña**
3. **Notificaciones de Workspace** (futuro)
4. **Invitaciones a Workspaces** (futuro)

---

## 🆘 Soporte

Si tienes problemas:

1. **Documentación oficial:** [Brevo Docs](https://developers.brevo.com)
2. **Soporte Brevo:** [support@brevo.com](mailto:support@brevo.com)
3. **Community Forum:** [Brevo Community](https://community.brevo.com)

---

## ✅ Checklist de Configuración

- [ ] Cuenta creada en Brevo
- [ ] API Key generada y guardada
- [ ] Email `aether.notifications@gmail.com` verificado
- [ ] Variables de entorno configuradas (local/producción)
- [ ] Email de prueba enviado exitosamente
- [ ] Estadísticas revisadas en dashboard

---

**¡Listo! Tu sistema de emails está configurado y funcionando. 🎉**

Para volver a la guía de deployment, ve a [DEPLOYMENT_RENDER.md](./DEPLOYMENT_RENDER.md)
