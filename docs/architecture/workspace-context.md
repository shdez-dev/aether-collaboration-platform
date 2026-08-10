# Contexto de organización y workspace

La cuenta (`organization`) es el límite de facturación y gobierno. Un usuario puede pertenecer a varias organizaciones y cada organización puede contener varios workspaces.

El workspace representa el modo operativo de trabajo:

- `PERSONAL`: foco individual, proyectos y tableros básicos.
- `TEAM`: ejecución colaborativa y capacidad de portfolio.
- `INSTITUTIONAL`: intake, estándar institucional y trazabilidad de iniciativas.

## API

- `GET /api/organizations` lista las organizaciones del usuario.
- `POST /api/organizations` crea una organización `COMPANY`, `INSTITUTION` o `NETWORK_OPERATOR`; el creador queda como `OWNER`.
- `GET /api/organizations/:id` devuelve miembros indirectos, suscripción resumida y workspaces.
- `PUT /api/organizations/:id` permite a `OWNER` o `ADMIN` actualizar nombre, tipo y correo de facturación.
- `PUT /api/workspaces/:id/mode` cambia el modo del workspace; requiere `OWNER` y sincroniza `workspace_institutional_settings`.

La creación de workspace acepta `organizationId`. Si se omite, se usa la organización personal del usuario. Para asociarlo a otra organización, el usuario debe ser `OWNER` o `ADMIN` de ella.

Las respuestas de workspace incluyen `organizationId`, `mode`, `organization`, `institutionalSettings` y `capabilities`; el frontend usa `mode` como contrato de contexto y deja el estándar como sub-plantilla.
