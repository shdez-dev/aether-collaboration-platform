# Desplegar AETHER en Railway

AETHER usa un monorepo con dos aplicaciones que deben ejecutarse como servicios independientes: API y web. PostgreSQL y Redis también son servicios separados. Railway no ejecuta este `docker-compose`; crea un servicio Railway por cada componente.

## 1. Crear los servicios de datos

En el mismo proyecto y entorno de Railway, crea:

- **PostgreSQL**
- **Redis**

Déjalos en la red privada de Railway. No necesitan dominio público. Railway genera `DATABASE_URL` y `REDIS_URL`; la API los consumirá mediante referencias entre servicios.

## 2. Configurar la API

Añade un servicio desde el repositorio GitHub `aether-collaboration-platform`, conectado a `main`. En **Settings → Build** configura:

- **Root Directory:** `/` (la raíz del repositorio; los Dockerfiles copian también `packages/shared-types` y `patches`).
- **Builder:** Dockerfile.
- **Dockerfile Path:** `apps/api/Dockerfile`.

En **Settings → Deploy** establece el health check path en `/health` y un timeout de hasta 300 segundos para el primer arranque, que ejecuta las migraciones antes de abrir el servidor. No configures un `API_PORT` fijo: la API toma el `PORT` dinámico de Railway.

Añade estas variables a la API:

```dotenv
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
REDIS_URL=${{Redis.REDIS_URL}}
JWT_SECRET=<secreto aleatorio de al menos 32 caracteres>
REFRESH_TOKEN_SECRET=<otro secreto aleatorio de al menos 32 caracteres>
```

Reemplaza `Postgres` y `Redis` por los nombres exactos de esos servicios; utiliza el autocompletado de referencias de Railway. Genera dos secretos distintos, por ejemplo con `openssl rand -base64 48`.

### Almacenamiento de archivos

La API requiere almacenamiento persistente. La configuración predeterminada usa Cloudflare R2, así que define también:

```dotenv
STORAGE_DRIVER=r2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY_ID=...
R2_SECRET_ACCESS_KEY=...
R2_BUCKET_NAME=...
R2_PUBLIC_URL=https://<dominio-publico-del-bucket>
```

No uses el almacenamiento local del contenedor sin persistencia: se perderían avatares y archivos al reemplazar el contenedor. Como alternativa, puedes configurar `STORAGE_DRIVER=local`, `LOCAL_STORAGE_DIR=/app/apps/api/public/uploads` y `LOCAL_STORAGE_PUBLIC_URL=https://<dominio-api>/uploads`, y montar un volumen Railway en `/app/apps/api/public/uploads`.

Configura el correo si quieres activar verificación de cuenta e invitaciones: usa `BREVO_SMTP_LOGIN`, `BREVO_SMTP_KEY` y `AETHER_SMTP_FROM` con un remitente verificado, **o** `BREVO_API_KEY`. `EMAIL_FROM` y `EMAIL_FROM_NAME` son opcionales. `GROQ_API_KEY` también es opcional para las funciones de IA.

Genera un dominio público para la API en **Settings → Networking**. La web llama a la API desde el navegador y necesita una URL pública HTTPS.

## 3. Configurar la web

Añade otro servicio GitHub conectado al mismo repositorio y rama `main`. En **Settings → Build** configura:

- **Root Directory:** `/`.
- **Builder:** Dockerfile.
- **Dockerfile Path:** `apps/web/Dockerfile`.

Añade estas variables a la web antes de compilarla:

```dotenv
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
NEXT_PUBLIC_WS_URL=wss://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

Sustituye `api` por el nombre exacto del servicio de API. `NEXT_PUBLIC_*` queda integrado en el JavaScript del navegador durante la compilación; al cambiarlo, Railway debe volver a compilar y desplegar la web. Genera un dominio público para la web.

## 4. Conectar dominios y CORS

Cuando ambos servicios tengan dominio, actualiza las variables de la API. Sustituye `web` por el nombre exacto del servicio web:

```dotenv
FRONTEND_URL=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
CORS_ORIGIN=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
ALLOWED_ORIGINS=https://${{web.RAILWAY_PUBLIC_DOMAIN}}
API_PUBLIC_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
BACKEND_URL=https://${{api.RAILWAY_PUBLIC_DOMAIN}}
```

Aplica los cambios y vuelve a desplegar la API. Verifica que `/health` responda en el dominio de la API, que la web pueda iniciar sesión y que la conexión Socket.IO funcione. Si asignas dominios propios, actualiza estas referencias con los dominios HTTPS correspondientes y vuelve a desplegar ambos servicios.

## 5. Despliegues posteriores

Conecta los dos servicios de aplicación a la rama `main` y activa los despliegues automáticos. Si Railway ofrece la opción de esperar a CI, actívala para desplegar solo después de que pasen las acciones de GitHub. Mantén **una sola réplica de API**: la presencia, los sockets y el estado temporal de documentos usan memoria local y no están preparados para distribuirse entre varias réplicas.

## Referencias

- [Desplegar una aplicación Docker Compose en Railway](https://docs.railway.com/guides/docker-compose)
- [Usar Dockerfiles en Railway](https://docs.railway.com/builds/dockerfiles)
- [Variables de entorno para builds de frontend](https://docs.railway.com/guides/frontend-environment-variables)
- [Variables de Railway](https://docs.railway.com/variables)
- [PostgreSQL en Railway](https://docs.railway.com/databases/postgresql)
- [Redis en Railway](https://docs.railway.com/databases/redis)
