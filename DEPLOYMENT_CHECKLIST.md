# ✅ Checklist de Despliegue en Render

Usa este checklist para asegurarte de que no te saltas ningún paso crítico.

---

## 📝 Pre-Deployment

- [ ] Todos los cambios están commiteados y pusheados a GitHub/GitLab
- [ ] El archivo `render.yaml` está en la raíz del proyecto
- [ ] Tienes una cuenta activa en [Render.com](https://render.com)
- [ ] Tienes una cuenta y API key de [Brevo](https://www.brevo.com)
- [ ] Has verificado el email aether.notifications@gmail.com en Brevo

---

## 🚀 Deployment Inicial

- [ ] Conectar repositorio a Render
- [ ] Aplicar Blueprint (`render.yaml`)
- [ ] Esperar a que se creen todos los servicios (10-15 min)
- [ ] Verificar que los 4 servicios estén en estado "Live":
  - [ ] `aether-postgres`
  - [ ] `aether-redis`
  - [ ] `aether-api`
  - [ ] `aether-web`

---

## 🔑 Configuración de Variables de Entorno

### Backend (aether-api)

- [ ] Obtener URL del servicio `aether-web`
- [ ] Configurar `CORS_ORIGIN` con URL de aether-web
- [ ] Configurar `ALLOWED_ORIGINS` con URL de aether-web
- [ ] Configurar `FRONTEND_URL` con URL de aether-web
- [ ] Obtener password de Redis desde servicio `aether-redis`
- [ ] Configurar `REDIS_URL` con formato: `redis://:PASSWORD@aether-redis:6379`
- [ ] Agregar `BREVO_API_KEY` desde Brevo dashboard
- [ ] Configurar `EMAIL_FROM` con dominio verificado
- [ ] Configurar `EMAIL_FROM_NAME`
- [ ] Guardar cambios y esperar redeploy

### Frontend (aether-web)

- [ ] Obtener URL del servicio `aether-api`
- [ ] Configurar `NEXT_PUBLIC_API_URL` (https://)
- [ ] Configurar `NEXT_PUBLIC_WS_URL` (wss://)
- [ ] Guardar cambios y esperar redeploy

---

## 🗄️ Base de Datos

- [ ] Abrir Shell del servicio `aether-api`
- [ ] Ejecutar: `cd apps/api`
- [ ] Ejecutar: `npx prisma migrate deploy`
- [ ] Verificar que las migraciones se ejecutaron correctamente
- [ ] (Opcional) Ejecutar: `npm run seed` para datos de prueba

---

## ✅ Verificación Post-Deployment

### Backend Health Check

- [ ] Visitar: `https://aether-api-xxxxx.onrender.com/health`
- [ ] Verificar respuesta: `{"status":"ok",...}`

### Frontend

- [ ] Visitar: `https://aether-web-xxxxx.onrender.com`
- [ ] Verificar que la página de inicio carga correctamente
- [ ] Verificar que los estilos se cargan

### Funcionalidad Completa

- [ ] Crear una cuenta de prueba
- [ ] Verificar que llega el email de confirmación
- [ ] Confirmar email
- [ ] Iniciar sesión
- [ ] Crear un workspace
- [ ] Crear un board
- [ ] Crear una card
- [ ] Verificar WebSockets (actualizaciones en tiempo real)

---

## 🔧 Configuración Opcional

- [ ] Configurar dominio personalizado (si aplica)
- [ ] Actualizar DNS records
- [ ] Actualizar variables de entorno con nuevo dominio
- [ ] Configurar SSL/HTTPS automático (Render lo hace por defecto)
- [ ] Revisar y ajustar plan de servicios según necesidades
- [ ] Configurar alertas de monitoreo
- [ ] Configurar backups automáticos de base de datos

---

## 🐛 Troubleshooting

Si algo no funciona, verifica:

- [ ] Logs de `aether-api` en Render Dashboard
- [ ] Logs de `aether-web` en Render Dashboard
- [ ] Variables de entorno están correctamente configuradas
- [ ] URLs no tienen espacios ni caracteres especiales
- [ ] Redis password es correcto
- [ ] Brevo API key es válida
- [ ] Email aether.notifications@gmail.com está verificado en Brevo

---

## 📊 Monitoreo Continuo

- [ ] Configurar notificaciones de deployment en Render
- [ ] Revisar métricas de uso regularmente
- [ ] Configurar alertas para errores críticos
- [ ] Revisar logs periódicamente
- [ ] Hacer backups regulares de la base de datos

---

## 🎉 Deployment Exitoso

Si todos los checkmarks están marcados, ¡tu aplicación está lista para producción!

**URLs Finales:**

```
Frontend: https://aether-web-xxxxx.onrender.com
API:      https://aether-api-xxxxx.onrender.com
```

---

## 🔄 Para Futuros Deploys

Cada vez que hagas cambios:

- [ ] Hacer commit de cambios
- [ ] Push a branch main
- [ ] Render automáticamente re-despliega
- [ ] Verificar que el deploy fue exitoso
- [ ] Probar funcionalidad afectada

---

**¡Buena suerte! 🚀**
