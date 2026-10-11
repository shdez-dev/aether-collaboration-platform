---
title: "Fuentes técnicas greenfield"
tipo: "referencias"
estado: "vigente a la fecha de revisión"
fecha_revision: 2026-09-07
---

# Fuentes técnicas greenfield

Las fuentes sirven para justificar capacidades y políticas, no para reemplazar pruebas de concepto. Las versiones concretas se verifican de nuevo al iniciar cada hito.

| Tema | Fuente oficial | Uso en la decisión |
| :--- | :--- | :--- |
| Soporte de Node.js | https://nodejs.org/en/about/previous-releases | Seleccionar una línea LTS soportada y planificar actualización antes de EOL |
| Next.js App Router | https://nextjs.org/docs/app | Estructura de rutas, componentes de servidor y capacidades actuales |
| Producción con Next.js | https://nextjs.org/docs/app/guides/production-checklist | Lista de controles de rendimiento, seguridad y despliegue |
| Autenticación en Next.js | https://nextjs.org/docs/app/guides/authentication | Separación entre autenticación, sesión y autorización |
| Content Security Policy | https://nextjs.org/docs/app/guides/content-security-policy | Estrategia de nonce, hash y contenido dinámico |
| Autoalojamiento de Next.js | https://nextjs.org/docs/app/guides/self-hosting | Uso de proxy inverso y consideraciones operativas |
| Política de PostgreSQL | https://www.postgresql.org/support/versioning/ | Soporte por versión mayor y necesidad de mantener versiones menores vigentes |
| Redis Pub/Sub | https://redis.io/docs/latest/develop/pubsub/ | Reconocer entrega como máximo una vez y evitarlo para trabajo durable |
| Redis Streams | https://redis.io/docs/latest/develop/use-cases/streaming/ | Referencia alternativa cuando se necesiten mensajes persistidos, sin adoptarla automáticamente |
| OpenTelemetry | https://opentelemetry.io/docs/what-is-opentelemetry/ | Instrumentación neutral de trazas, métricas y logs |
| WCAG 2.2 | https://www.w3.org/TR/wcag/ | Meta de accesibilidad nivel AA y criterios verificables |
| OWASP ASVS | https://owasp.org/www-project-application-security-verification-standard/ | Catálogo base de controles de seguridad de aplicación |

## Política de revisión

Antes de aprobar una ADR tecnológica se comprueban soporte, seguridad, licencia, mantenimiento, compatibilidad, costo, capacidad interna y estrategia de salida. Las fuentes secundarias pueden orientar la exploración, pero la decisión cita documentación oficial, pruebas del repositorio y evidencia de operación.

## Relaciones

Estas referencias sustentan [[Stack tecnologico y politica de versiones]], [[Seguridad y modelo de amenazas]] y [[Requerimientos no funcionales greenfield]].
