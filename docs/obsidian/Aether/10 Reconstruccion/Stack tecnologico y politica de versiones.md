---
title: "Stack tecnológico y política de versiones"
tipo: "decisión tecnológica"
estado: "propuesto"
---

# Stack tecnológico y política de versiones

## Selección inicial

| Área | Selección | Uso y restricción |
| :--- | :--- | :--- |
| Runtime | Node.js 24 LTS | Producción usa una línea LTS con soporte y versión exacta en herramientas e imágenes |
| Lenguaje | TypeScript estricto | Sin any implícito; contratos externos se validan en tiempo de ejecución |
| Gestor | pnpm con lockfile inmutable | packageManager, corepack y versión de Node quedan fijados |
| Monorepo | pnpm workspaces y Turborepo | Tareas reproducibles, caché controlada y límites de paquete |
| Web | Next.js App Router y React | Componentes de servidor por defecto; cliente solo donde exista interacción real |
| API | Fastify | REST explícito, validación de entrada, plugins acotados y OpenAPI 3.1 |
| Datos | PostgreSQL 17 en su última versión menor compatible | Fuente transaccional; se evalúa PostgreSQL 18 cuando proveedor y extensiones estén validados |
| Acceso SQL | Kysely con migraciones SQL revisables | Una única abstracción transaccional; SQL específico queda encapsulado |
| Validación | Zod en bordes y contratos | El dominio conserva tipos propios y no confía en datos externos |
| Sesiones | OIDC, cookies HttpOnly y almacenamiento de sesión servidor | Se evita implementar contraseñas y tokens persistentes en el navegador |
| Trabajo durable | Outbox PostgreSQL y worker con bloqueo seguro | Reintento, idempotencia, dead letter y replay controlado |
| Caché y presencia | Redis administrado | Nunca es autoridad de negocio ni canal durable |
| Archivos | Almacenamiento compatible con S3 | Privado, cifrado, presigned URL breve y escaneo |
| Tiempo real | WebSocket autorizado y Yjs solo cuando se apruebe edición colaborativa | Estado durable fuera de memoria y recuperación probada |
| Pruebas | Vitest, Playwright y Testcontainers | Unitaria, integración real, contrato y E2E |
| Telemetría | OpenTelemetry | Trazas, métricas y logs correlacionados con exportador intercambiable |
| Infraestructura | OpenTofu o Terraform y contenedores OCI | Entornos declarativos, revisados y reproducibles |

## Por qué no se replica el stack anterior

La experiencia previa mostró configuraciones TypeScript incompatibles, mezcla de rutas de acceso a datos, canales no durables usados como si fueran confiables, estado colaborativo en memoria y tokens accesibles a JavaScript. La nueva selección no intenta salvar esas decisiones. Establece una autoridad por responsabilidad, soporte explícito y pruebas operativas desde el inicio.

## Política de versiones

| Regla | Aplicación |
| :--- | :--- |
| Runtime soportado | Solo Active LTS o Maintenance LTS, con calendario de actualización antes del fin de soporte |
| Dependencias de producción | Versión exacta en lockfile, revisión automática semanal y actualización agrupada por riesgo |
| Framework | Última estable validada en rama de actualización, nunca latest sin pruebas |
| Base de datos | Mayor explícita, menor siempre vigente, ensayo de actualización y compatibilidad de extensión |
| Imágenes | Digest inmutable y reconstrucción periódica por parches del sistema |
| Contratos | Compatibilidad comprobada en CI y ventana de deprecación documentada |

## Pruebas de concepto obligatorias

Antes del bootstrap definitivo se validarán autenticación OIDC con sesión y revocación, transacción con outbox e idempotencia, migración expandir y contraer, autorización multitenant negativa, carga de un flujo representativo, restauración de PostgreSQL y acceso privado a objetos. Una tecnología que no supere el escenario se reemplaza antes de construir módulos encima.

## Fuentes técnicas

La línea de Node se revisa contra su calendario oficial. La versión de PostgreSQL se mantiene según su política de cinco años por versión mayor y sus menores vigentes. El diseño de Next.js se guía por App Router, la lista de producción, autenticación, CSP y despliegue detrás de proxy. Redis Pub/Sub se reconoce como entrega como máximo una vez, por lo que no se utiliza para trabajo durable. OpenTelemetry aporta instrumentación neutral y no se confunde con un backend de observabilidad. WCAG 2.2 nivel AA es la referencia de accesibilidad.

## Relaciones

Las elecciones se registran en [[Registro de decisiones y supuestos]] y se operacionalizan en [[Infraestructura, entornos y entrega]].
