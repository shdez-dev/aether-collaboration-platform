---
title: "Inventario de pantallas"
tipo: "inventario observado"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Inventario de pantallas

## Estructura observada

El frontend utiliza App Router bajo apps/web/src/app. Se encontraron 39 archivos de página, layout o estado especial en esta extracción. No se encontraron Route Handlers route.ts o route.js en esa estructura. Los endpoints de negocio se exponen en Express.

Los segmentos entre corchetes representan parámetros dinámicos. Un layout compone interfaz compartida y no define una página independiente. La presencia de una página no acredita el recorrido de negocio completo.

| Ruta visible o ámbito | Tipo de archivo | Fuente |
| :--- | :--- | :--- |
| `/dashboard/ai-builder` | page.tsx | `apps/web/src/app/dashboard/ai-builder/page.tsx` |
| `/dashboard/boards/[boardId]/dependencies` | page.tsx | `apps/web/src/app/dashboard/boards/[boardId]/dependencies/page.tsx` |
| `/dashboard/boards/[boardId]` | page.tsx | `apps/web/src/app/dashboard/boards/[boardId]/page.tsx` |
| `/dashboard/calendar` | page.tsx | `apps/web/src/app/dashboard/calendar/page.tsx` |
| `/dashboard/contacts` | page.tsx | `apps/web/src/app/dashboard/contacts/page.tsx` |
| `/dashboard/documents` | page.tsx | `apps/web/src/app/dashboard/documents/page.tsx` |
| `/dashboard/documents/[documentId]` | page.tsx | `apps/web/src/app/dashboard/documents/[documentId]/page.tsx` |
| `/dashboard/initiatives` | page.tsx | `apps/web/src/app/dashboard/initiatives/page.tsx` |
| `/dashboard/initiatives/reports` | page.tsx | `apps/web/src/app/dashboard/initiatives/reports/page.tsx` |
| `/dashboard/initiatives/settings` | page.tsx | `apps/web/src/app/dashboard/initiatives/settings/page.tsx` |
| `/dashboard/initiatives/[id]` | page.tsx | `apps/web/src/app/dashboard/initiatives/[id]/page.tsx` |
| `/dashboard` | layout.tsx | `apps/web/src/app/dashboard/layout.tsx` |
| `/dashboard/network` | page.tsx | `apps/web/src/app/dashboard/network/page.tsx` |
| `/dashboard/notifications` | page.tsx | `apps/web/src/app/dashboard/notifications/page.tsx` |
| `/dashboard` | page.tsx | `apps/web/src/app/dashboard/page.tsx` |
| `/dashboard/portfolios` | page.tsx | `apps/web/src/app/dashboard/portfolios/page.tsx` |
| `/dashboard/portfolios/[id]` | page.tsx | `apps/web/src/app/dashboard/portfolios/[id]/page.tsx` |
| `/dashboard/profile` | page.tsx | `apps/web/src/app/dashboard/profile/page.tsx` |
| `/dashboard/projects` | page.tsx | `apps/web/src/app/dashboard/projects/page.tsx` |
| `/dashboard/projects/[id]` | page.tsx | `apps/web/src/app/dashboard/projects/[id]/page.tsx` |
| `/dashboard/settings` | page.tsx | `apps/web/src/app/dashboard/settings/page.tsx` |
| `/dashboard/teams` | page.tsx | `apps/web/src/app/dashboard/teams/page.tsx` |
| `/dashboard/teams/[id]` | page.tsx | `apps/web/src/app/dashboard/teams/[id]/page.tsx` |
| `/dashboard/today` | page.tsx | `apps/web/src/app/dashboard/today/page.tsx` |
| `/dashboard/users` | page.tsx | `apps/web/src/app/dashboard/users/page.tsx` |
| `/forgot-password` | page.tsx | `apps/web/src/app/forgot-password/page.tsx` |
| `/join/[token]` | page.tsx | `apps/web/src/app/join/[token]/page.tsx` |
| `/` | layout.tsx | `apps/web/src/app/layout.tsx` |
| `/legal/aup` | page.tsx | `apps/web/src/app/legal/aup/page.tsx` |
| `/legal/privacy` | page.tsx | `apps/web/src/app/legal/privacy/page.tsx` |
| `/legal/terms` | page.tsx | `apps/web/src/app/legal/terms/page.tsx` |
| `/login` | page.tsx | `apps/web/src/app/login/page.tsx` |
| `/` | not-found.tsx | `apps/web/src/app/not-found.tsx` |
| `/organization-invitation` | page.tsx | `apps/web/src/app/organization-invitation/page.tsx` |
| `/` | page.tsx | `apps/web/src/app/page.tsx` |
| `/register` | page.tsx | `apps/web/src/app/register/page.tsx` |
| `/reset-password` | page.tsx | `apps/web/src/app/reset-password/page.tsx` |
| `/verify-email` | page.tsx | `apps/web/src/app/verify-email/page.tsx` |
| `/verify-email/pending` | page.tsx | `apps/web/src/app/verify-email/pending/page.tsx` |

## Interpretación funcional

Las rutas de iniciativas, proyectos, portfolios y redes son superficies de dominio. Hoy, calendario y notificaciones son superficies de atención personal. Documentos y tableros ofrecen trabajo operativo. Perfil y configuración sostienen identidad y contexto.

La arquitectura objetivo conserva esas capacidades y adapta su prioridad según el estado y el rol, como se describe en [[Experiencia por contexto]]. Una ruta visible debe resolver siempre su recurso y autorización en el servidor.
