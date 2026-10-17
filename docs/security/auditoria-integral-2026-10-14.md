# Auditoría integral de AETHER — 14 de octubre de 2026

## Resumen ejecutivo

Revisión del código local en `main` (`9318582`) más los cambios todavía sin confirmar del 14 de octubre. Se inspeccionaron API, web, autenticación, permisos, documentos colaborativos, WebSocket, datos, dependencias, CI y la configuración Docker de despliegue. La revisión es estática y se complementa con lint, compilación y pruebas ya ejecutadas sobre este árbol. **No** se hizo una prueba de penetración, un recorrido completo autenticado ni una verificación de un contenedor desplegado. Por ello, «sin hallazgos» en un módulo no equivale a «seguro».

### Avance de correcciones locales

Las descripciones de los hallazgos conservan la evidencia del estado auditado. Después de la auditoría se aplicaron las correcciones descritas a continuación. Su presencia en producción depende del despliegue posterior al push:

| Hallazgo | Estado actual |
| --- | --- |
| A-01 | Mitigación aplicada en código: edición y guardado esperan la sincronización inicial; cada restauración incrementa una generación persistida y los guardados HTTP/WebSocket obsoletos se rechazan bajo bloqueo de fila. El desmontaje por restauración omite el autosave local. Falta recorrido E2E multiusuario, restauración y recuperación bajo carga. |
| A-02 | Corregido en código: respaldo HTTP binario con límite de 8 MB y respuesta 413 explícita. Falta comprobar documento grande en ejecución. |
| A-03 | Mitigación parcial aplicada en código: límites distribuidos en Redis por correo e IP, con cuotas amplias para IP compartida. Pendiente observar y calibrar los umbrales con tráfico real. |
| A-04 y A-05 | Corregidos en código: política compartida, revocación transaccional de refresh tokens, nuevos tokens para la sesión actual y propagación de errores a la interfaz. Los access tokens ya emitidos siguen válidos hasta expirar. |
| A-06 | Parcial: cabeceras CSP básicas y `nosniff` en la web. Migrar tokens a cookies HttpOnly requiere cambiar el contrato de autenticación web, API y Socket.IO. |
| A-07 | Corregido en archivo: DB y Redis ya no publican puertos; se usa Caddy incluido en el repositorio y se corrigió el healthcheck de Redis. |
| A-08 | Corregido en código: listados de documentos y versiones omiten el binario Yjs; el historial usa límite y desplazamiento acotados. |
| A-09 | Parcial: los errores de guardado HTTP y Socket.IO se muestran en el editor y permiten reintentar; quedan pendientes la validación E2E y la revisión de errores silenciosos y registro estructurado. |
| A-10 | Parcial: HMAC sobre cuerpo raw. Idempotencia/orden temporal pendiente hasta definir el proveedor y su formato de eventos. |
| A-11 | Parcial: CI ahora bloquea avisos nuevos de `pnpm audit` y comprueba el parche conocido; aún no ejecuta integración ni E2E. |
| A-12 | Parcial: la imagen API reutiliza dependencias en lugar de volver a descargarlas; la construcción completa sigue ocurriendo en el host de despliegue. |

Prioridad inmediata: impedir que un editor sin sincronizar pueda guardar un estado incompleto; aumentar o rediseñar el límite del guardado Yjs; unificar y revocar sesiones al cambiar la contraseña; corregir el resultado falso de éxito en la interfaz. Antes de usar el `docker-compose.production.yml` alternativo se debe corregir su configuración de red y sus archivos faltantes.

### Estado por área

| Área | Resultado |
| --- | --- |
| Autorización HTTP | Hay controles explícitos en documentos, proyectos, equipos y organizaciones revisados. Queda pendiente una matriz automatizada de permisos para todos los recursos. |
| Autenticación | JWT y refresh tokens rotables; faltan controles contra intentos automatizados y la política de cambio de contraseña es inconsistente. |
| Documentos y tiempo real | Riesgo alto de sobrescritura por snapshots completos, límite de petición insuficiente y errores de sincronización silenciados. |
| Dependencias | `pnpm audit` informa 1 alta, 0 críticas; el aviso alto corresponde a `braces` parcheado localmente. Hay numerosas versiones posteriores, pero estar desactualizado no implica por sí solo vulnerabilidad. |
| Infraestructura | La variante de Compose evaluada aísla DB y Redis; el compose de producción alternativo expone ambos y hace referencia a Nginx ausente. |
| Calidad | Lint pasa con advertencias. Las pruebas unitarias previas pasan; integración y E2E no se ejecutan en CI. |

## Hallazgos y seguimiento, ordenados por riesgo

### A-01 — Alto — Edición habilitada sin sincronización inicial

**Evidencia:** `apps/web/src/components/documents/CollaborativeEditor.tsx:1725-1740` pide una resincronización tras 8 s y, 5 s después, activa `isDocumentReady` aunque no haya recibido `document:sync`. `apps/web/src/components/documents/CollaborativeEditor.tsx:1936-1944` habilita el guardado automático cuando ese indicador es verdadero. `apps/web/src/hooks/useDocumentAutoSave.ts:70-91,154-190` guarda el snapshot local por HTTP, incluido al desmontar. `apps/api/src/services/DocumentService.ts:553-607` reemplaza `yjs_state` completo en la base de datos; la protección por tamaño solo rechaza estados de menos del 10 % del anterior. **Riesgo:** una reconexión lenta o fallida, o dos clientes con snapshots distintos, puede terminar persistiendo contenido incompleto o antiguo. Es un flujo de riesgo confirmado por código; la pérdida efectiva requiere reproducir el orden de eventos en dos clientes.

**Mitigación aplicada:** la edición y el guardado siguen bloqueados hasta recibir y aplicar `document:sync`. El servidor incrementa `restore_generation` al restaurar una versión, y cada guardado HTTP o WebSocket debe indicar la generación que recibió al sincronizarse. El servicio compara ese valor dentro de la transacción y rechaza snapshots obsoletos; la recarga de una restauración no vuelve a guardar el estado local durante el desmontaje. **Seguimiento:** añadir recorrido E2E de desconexión, edición concurrente, guardado en vuelo durante restauración y recuperación bajo carga.

### A-02 — Alto funcional — El guardado de documentos grandes supera el límite JSON

**Evidencia:** `apps/api/src/index.ts:137` usa `express.json()` sin límite explícito (límite predeterminado de 100 KB). `apps/web/src/stores/documentStore.ts:219-224` convierte cada byte de Yjs en un entero dentro de un arreglo JSON, cuyo tamaño textual supera ampliamente el binario. La aplicación permite hasta 100 000 caracteres visibles (`apps/api/src/services/DocumentService.ts:18`). **Impacto:** el autosave HTTP devuelve 413 para estados perfectamente válidos de tamaño moderado; `apps/web/src/hooks/useDocumentAutoSave.ts:92-94` captura y silencia el rechazo. El WebSocket puede seguir guardando, por lo que no se debe asumir pérdida en todos los casos.

**Acción:** usar un cuerpo binario con límite explícito acorde a cuotas o aumentar el límite JSON con validación estricta de tamaño y forma. Mostrar fallo de guardado y conservar una cola de reintentos; probar un documento cercano al máximo admitido.

### A-03 — Alta si la instancia es accesible por terceros — Intentos de autenticación automatizados

**Evidencia:** `apps/api/src/routes/auth.ts:8-14` publica registro, login, refresh y recuperación sin control de intentos. La retirada del límite global por IP fue una decisión anterior para evitar falsos positivos entre personas que comparten una IP. **Impacto:** fuerza bruta, abuso de registro y de correos de recuperación si el origen es alcanzable por atacantes.

**Mitigación aplicada:** Redis mantiene ventanas deslizantes compartidas entre instancias. Login limita 12 credenciales fallidas por correo y 300 solicitudes por IP en 15 minutos; registro, recuperación y reenvío de verificación limitan 3 solicitudes por correo y 300 por IP en una hora. Refresh tiene un límite de 600 solicitudes por IP en 15 minutos. Las claves usan HMAC; el middleware devuelve `429` con `Retry-After` y falla cerrado con `503` si Redis no puede aplicar el control. **Seguimiento:** medir falsos positivos y abuso tras desplegar, y ajustar las cuotas con tráfico real.

### A-04 — Media — Cambio de contraseña inconsistente y sesiones vigentes

**Evidencia:** `apps/api/src/controllers/UserController.ts:512-569` acepta nuevas contraseñas de 6 caracteres, usa bcrypt con coste 10 y solo actualiza `users.password`. Registro y restablecimiento exigen 8–128 caracteres con letra y número y usan coste 12 (`apps/api/src/controllers/AuthController.ts:22-47,910-924`); el restablecimiento revoca refresh tokens. **Impacto:** se puede rebajar la fortaleza de la cuenta y las sesiones anteriores conservan capacidad de renovar el acceso tras cambiar la contraseña.

**Acción:** reutilizar un único esquema de contraseña, revocar refresh tokens al confirmar el cambio y definir si la sesión actual debe renovarse sin expulsar inesperadamente al usuario.

### A-05 — Media funcional — La interfaz anuncia cambio de contraseña exitoso cuando falla

**Evidencia:** `apps/web/src/stores/authStore.ts:442-469` resuelve la promesa aunque la API devuelva `success: false` o falle la petición; solo escribe `error` en el store. `apps/web/src/app/dashboard/profile/page.tsx:425-440` muestra el aviso de éxito y borra los campos después de cualquier resolución. **Impacto:** el usuario puede creer que su contraseña cambió cuando sigue vigente la anterior.

**Acción:** lanzar un error desde el store o devolver un resultado discriminado y mostrar éxito únicamente cuando la API confirme el cambio.

### A-06 — Media — Tokens persistidos en almacenamiento legible por JavaScript

**Evidencia:** `apps/web/src/stores/authStore.ts:472-481` persiste access y refresh tokens en `localStorage`. `apps/web/next.config.js` e `infra/Caddyfile` no definen CSP para las páginas web; la CSP de `apps/api/src/index.ts:77-108` cubre respuestas de la API, no las páginas servidas por Next. **Impacto:** un XSS en el origen web podría extraer tokens persistentes. No se encontró un XSS concreto durante esta revisión.

**Acción:** planificar cookies `HttpOnly`, `Secure` y `SameSite` con defensa CSRF cuando corresponda; implantar CSP en la web y revisar inserciones de HTML y enlaces externos.

### A-07 — Media operativa — Configuración de producción alternativa no lista para uso

**Evidencia:** en la versión evaluada de `docker-compose.production.yml`, PostgreSQL y Redis se publicaban en todas las interfaces del host; también se montaban `./nginx/nginx.conf` y `./nginx/ssl`, rutas ausentes, y se combinaban nombres fijos de contenedor con `deploy.replicas: 2`. **Impacto:** esa configuración exponía servicios internos y probablemente fallaba al iniciar o al escalar. La variante de Compose de menor tamaño evaluada mantenía DB/Redis en la red interna y ligaba Caddy a `127.0.0.1:8081`.

**Acción:** retirar el compose obsoleto o repararlo con proxy incluido, red privada y sin `container_name` en servicios replicables. Probarlo desde cero antes de promoverlo.

### A-08 — Media de rendimiento — Historial de versiones sin paginación y con binarios

**Evidencia:** `apps/api/src/services/DocumentService.ts:248-255,326-331` usa `d.*` al listar documentos; `formatDocument` incluye `yjsState` (`:1137`). El historial usa `SELECT *` de todas las versiones y serializa el binario de cada una (`:695-701,1147-1152`). **Impacto:** respuestas y uso de memoria crecientes con el número y tamaño de documentos/versiones, especialmente en hosts con recursos limitados.

**Acción:** proyectar solo metadatos tanto en documentos como en versiones; paginar el historial y descargar el estado binario solo al abrir/restaurar un elemento concreto.

### A-09 — Media de observabilidad — Errores de tiempo real y DB silenciados

**Evidencia actualizada:** `apps/web/src/hooks/useDocumentAutoSave.ts` conserva el error del autosave HTTP; `apps/web/src/components/documents/CollaborativeEditor.tsx` muestra los errores HTTP y `document:save-error` como alerta y ofrece reintentar el guardado del estado Yjs actual. `apps/api/src/websocket/Yjsgateway.ts` ya reintenta persistencia antes de emitir el error. Aún hay rutas de captura que solo fuerzan recarga o devuelven un error genérico, y los errores de consultas de DB no incorporan contexto estructurado de operación. **Impacto:** el usuario puede detectar y volver a intentar un fallo de guardado mientras el editor sigue abierto; la investigación de ciertos fallos operativos sigue siendo limitada. **Seguimiento:** validar fallo y reintento HTTP/WebSocket en E2E; completar registro estructurado sin contenido sensible y revisar los `catch` restantes.

### A-10 — Media condicional — Webhook de facturación frágil y eventos fuera de orden

**Evidencia:** `apps/api/src/controllers/BillingController.ts:46` firma `JSON.stringify(req.body)` en vez de los bytes recibidos. Un proveedor que firme el JSON original rechazará webhooks válidos si cambian espacios u orden de claves. La misma función actualiza suscripciones por `provider_subscription_id` sin guardar ni deduplicar el identificador de evento o comprobar orden temporal. **Alcance:** solo aplica si se configura `BILLING_WEBHOOK_SECRET` y se integra un proveedor de pago; no se comprobó un proveedor real.

**Acción:** verificar HMAC sobre cuerpo raw, usar la especificación del proveedor, registrar id de evento único y rechazar transiciones antiguas.

### A-11 — Media de calidad — Las pruebas de integración y E2E no bloquean cambios

**Evidencia:** `package.json` define `test:integration` y `test:e2e`, pero `test:ci` excluye explícitamente integración y upload; `.github/workflows/ci.yml` ejecuta solo `test:ci` y una prueba de migración de esquema. No hay job E2E. El `pnpm audit` del job de seguridad tiene `continue-on-error: true`. **Impacto:** pueden pasar CI regresiones de permisos, sockets, carga de archivos y flujos multiusuario; un aviso nuevo de dependencias no bloquea la publicación.

**Acción:** añadir integración con PostgreSQL, un smoke E2E de autenticación/documentos/colaboración y una política de seguridad que distinga avisos aceptados por parche de avisos nuevos.

### A-12 — Baja / rendimiento — Construcciones Docker costosas en el host de despliegue

**Evidencia:** `apps/api/Dockerfile:16,65` instala dependencias dos veces y además copia `node_modules` entre etapas; la imagen web copia todo el árbol de dependencias (`apps/web/Dockerfile:65-66`). En la evidencia previa aportada por el usuario, solo instalar dependencias durante un despliegue tomó ~44 minutos en el host de despliegue. **Acción:** generar en CI imágenes compatibles con el entorno de despliegue, publicarlas y hacer pull por digest; reducir dependencias de runtime y descargar Chromium solo donde sea necesario. Medir antes y después.

## Dependencias y avisos

- `corepack pnpm audit --json` sobre el lockfile local: **1 alta, 0 críticas, 0 moderadas**. La alta es `braces@3.0.3` ([GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)). El repositorio aplica `patches/braces@3.0.3.patch` y la comprobación `node scripts/check-braces-patch.cjs` pasó en la revisión focalizada. El escáner no entiende el parche y sigue informando el aviso; no se debe ocultar sin mantener la prueba del parche.
- La resolución local de `prosemirror-view` ya se unificó en 1.42.6 en `package.json` y `pnpm-lock.yaml` (cambio pendiente de commit/despliegue). La apertura real del documento de la captura sigue pendiente de verificación autenticada.
- `pnpm outdated` encuentra versiones posteriores de paquetes directos como Next, React, Yjs y Tiptap. Estas versiones **no son por sí mismas hallazgos de seguridad**; conviene actualizar por grupos compatibles, con pruebas de editor y colaboración antes de saltos mayores. Los overrides del `package.json` requieren mantenimiento para no congelar dependencias indefinidamente.

## Controles positivos observados

- Las rutas de equipos y organizaciones pasan por `authenticateJWT` y comprueban acceso en middleware o controladores (`apps/api/src/routes/teams.ts`, `apps/api/src/routes/organizations.ts`). Las rutas de documentos comprobadas diferencian permiso de lectura y edición (`apps/api/src/routes/documentss.ts:72-99`).
- La API configura Helmet, HSTS, CORS por orígenes y consultas SQL parametrizadas en los flujos revisados (`apps/api/src/index.ts:77-138`). Las interpolaciones dinámicas examinadas en `middleware/project.ts`, `DocumentService.ts` y `NetworkController.ts` provienen de mapas cerrados, no directamente de texto de usuario.
- El webhook de GitHub verifica HMAC sobre cuerpo raw (`apps/api/src/index.ts:134-135`, `apps/api/src/routes/github_webhook.ts:93-115`).
- La variante de Compose de menor tamaño evaluada mantiene Postgres y Redis en la red interna y Caddy solo en loopback.

## Verificaciones y límites

- En esta ampliación: `corepack pnpm lint` terminó con código 0, con advertencias de hooks, imágenes y deprecación de `next lint`; `corepack pnpm typecheck` pasó; `corepack pnpm test:ci` pasó (30 suites/237 pruebas API y 32 suites/193 pruebas web); `corepack pnpm audit --json` informó solo el aviso de `braces` parcheado localmente y `check:braces-patch` pasó. Se inspeccionaron rutas, controladores, servicios, WebSocket, stores, Docker y CI.
- La comprobación de migraciones con PostgreSQL, la construcción de imágenes y Trivy no pudieron reproducirse en este equipo: Docker no estaba iniciado, y no estaban disponibles `psql` ni `trivy`. El build de Next y los checks de GitHub Actions aportan verificación adicional, pero no sustituyen pruebas multiusuario ni del despliegue activo.
- No se ejecutaron integración, E2E, fuzzing, análisis dinámico ni revisión de secretos de producción. No se inspeccionó una sesión autenticada real; tampoco se comprobó qué commit/imágenes están activos actualmente en producción.
- Los cambios del informe focalizado (`docs/security/audit-2026-10-14.md`) siguen **solo en el árbol local**. Este informe no modifica código ni despliega nada.

## Plan de corrección propuesto

1. **Integridad de documentos:** resolver A-01 y A-02, añadir pruebas de dos clientes, red lenta, reconexión y documento grande; después desplegar y abrir el documento que fallaba.
2. **Cuenta y acceso:** resolver A-04 y A-05; observar y calibrar la mitigación de auth (A-03) tras desplegar. Añadir casos de permisos de propietario, administrador, miembro, observador e invitado.
3. **Operación:** mostrar errores de persistencia (A-09), arreglar el compose alternativo (A-07) y medir un despliegue con imágenes preconstruidas (A-12).
4. **Endurecimiento sostenido:** migración de tokens/CSP (A-06), paginación de versiones (A-08), webhook de facturación cuando se active (A-10) y ampliar CI (A-11).
