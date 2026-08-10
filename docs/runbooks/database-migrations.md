# Runbook de migraciones de base de datos

## Principios

- Prisma es la única fuente de verdad para cambios de esquema.
- `ensure-baseline.js` solo marca como aplicadas las seis migraciones históricas que fueron ejecutadas por el runner anterior.
- Nunca se debe usar `prisma migrate reset` contra Railway o una base con datos reales.
- Las migraciones nuevas deben ser incrementales e idempotentes cuando deban convivir con el esquema heredado.

## Validación local

Usar siempre la versión fijada por el repositorio:

```powershell
corepack pnpm --version
corepack pnpm dlx prisma@5.22.0 validate --schema apps/api/prisma/schema.prisma
corepack pnpm --dir D:\aether-prisma-h0 exec prisma generate --schema D:\amadeus-projects\aether-collaboration-platform\apps\api\prisma\schema.prisma
```

La prueba de instalación limpia usa Docker y no toca la base local configurada:

```powershell
corepack pnpm --dir apps/api run db:migrate:smoke
```

## Respaldo previo en Railway

Antes de desplegar una migración, generar un respaldo lógico desde una copia o desde el entorno autorizado de Railway:

```powershell
$env:PGPASSWORD = '<password>'
pg_dump --format=custom --no-owner --no-privileges `
  --file .\backups\aether-before-<migration>.dump `
  '<DATABASE_URL>'
```

El archivo de respaldo debe almacenarse fuera del repositorio y verificarse con:

```powershell
pg_restore --list .\backups\aether-before-<migration>.dump
```

## Despliegue

En el contenedor de producción, el orden es:

1. `ensure-baseline.js` detecta una base heredada sin `_prisma_migrations` y marca las seis migraciones históricas.
2. `prisma migrate deploy` aplica desde `20260728000000_reconcile_legacy_schema` en adelante.
3. La API inicia solo después de que todas las migraciones terminan correctamente.

Comprobaciones posteriores:

```powershell
corepack pnpm --dir apps/api exec prisma migrate status --schema prisma/schema.prisma
```

Y en PostgreSQL:

```sql
SELECT COUNT(*) FROM workspaces WHERE organization_id IS NULL;
SELECT COUNT(*) FROM teams WHERE workspace_id IS NULL;
SELECT COUNT(*) FROM project_role_assignments
WHERE role IN ('TRIAGE_COORDINATOR', 'MENTOR');
```

## Rollback operativo

Las migraciones no se deshacen automáticamente. Si la aplicación falla después de migrar:

1. Detener el despliegue de la API para evitar escrituras incompatibles.
2. Identificar si el fallo es de código o de datos sin modificar el esquema.
3. Volver a la imagen anterior si el esquema mantiene compatibilidad hacia atrás.
4. Si se requiere restauración, crear una base temporal desde el dump y validar la aplicación allí.
5. Restaurar producción únicamente con aprobación explícita y ventana de mantenimiento.
6. Registrar el incidente y crear una migración compensatoria; no editar una migración ya aplicada.
