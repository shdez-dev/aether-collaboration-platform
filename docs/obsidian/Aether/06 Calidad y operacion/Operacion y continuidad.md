---
title: "Operacion y continuidad"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Operacion y continuidad

## Base observada

Existen Dockerfiles, configuración de CI, validación de variables y migraciones Prisma. El arranque de producción del Dockerfile ejecuta ensure-baseline.js, prisma migrate deploy y luego la API. index.ts indica que el esquema se migra antes de iniciar.

El documento antiguo project-centered-structure menciona dos mecanismos de migración. El runbook más reciente y el arranque inspeccionado señalan Prisma como mecanismo vigente. Esta bóveda toma el código de arranque como evidencia y marca la descripción antigua para actualización.

## Arranque reproducible

| Etapa | Evidencia necesaria |
| :--- | :--- |
| Preparar entorno | Runtime y pnpm compatibles con el repositorio |
| Instalar | Lockfile congelado sin modificaciones inesperadas |
| Configurar | Variables de ejemplo completas y sin secretos reales |
| Base de datos | Servicio disponible y migraciones aplicadas |
| Generar cliente | Prisma Client derivado del esquema |
| Compilar | Tipos, API y frontend |
| Iniciar | Puertos y URLs consistentes |
| Verificar | Salud, sesión y lectura de recurso de prueba |

Los comandos de referencia son corepack pnpm install --frozen-lockfile, corepack pnpm --dir apps/api run db:generate y corepack pnpm run build. Las migraciones se ejecutan únicamente contra la base de destino elegida y verificada. Los valores concretos de conexión no forman parte de esta bóveda.

La elección futura de runtime debe revisarse por soporte y compatibilidad antes de fijarse como política de lanzamiento. La documentación inspeccionada usa Node 20, pero eso no constituye recomendación de soporte vigente para septiembre de 2026.

## Objetivos de servicio propuestos

| Objetivo | Valor inicial de diseño | Evidencia para adoptarlo |
| :--- | :--- | :--- |
| Disponibilidad mensual | 99,5 % | Medición externa y presupuesto de errores |
| Latencia de lectura habitual | p95 menor a 500 ms en API | Carga y dataset representativos |
| Confirmación de escritura habitual | p95 menor a 1 s, sin integraciones lentas | Ensayo concurrente |
| Recuperación de servicio | RTO de 4 horas | Simulacro completo |
| Pérdida tolerable en desastre | RPO de 1 hora | Respaldo o recuperación continua verificada |
| Recuperación de trabajos pendientes | Reanudación automática tras reinicio | Fallo controlado de worker |

Son metas iniciales para validar costos y necesidades, no garantías existentes ni compromisos contractuales. Deben excluir o definir expresamente procesos pesados como PDF e IA.

## Observabilidad

Registrar errores, latencia, volumen, trabajos pendientes, fallos de correo, lag de eventos, conexiones y guardados de documentos. Asociar requestId y correlationId sin registrar tokens ni contenido sensible. Las alertas deben llegar a una persona responsable y tener una acción documentada.

## Copias y restauración

Respaldar base, objetos y metadatos de versiones de forma consistente. Un respaldo no se considera útil hasta restaurarlo y verificar vínculos, permisos y un expediente completo. Registrar fecha, duración, resultado y responsable de cada simulacro.

## Liberación e incidentes

Utilizar migraciones compatibles hacia atrás, comprobar salud después de desplegar y tener imagen anterior disponible. Si la migración rompe compatibilidad, revertir aplicación no basta. Una restauración se ensaya en un entorno aislado antes de intervenir producción.

El incidente registra impacto, inicio, detección, recuperación, causa y acciones preventivas. La comunicación debe distinguir disponibilidad del servicio e integridad de datos.

Relaciones: [[Eventos y tiempo real]], [[Calidad y pruebas]] y [[Definicion de producto completo]].
