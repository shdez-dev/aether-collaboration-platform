param(
  [switch]$KeepContainer
)

$ErrorActionPreference = 'Stop'
$containerName = "aether-migration-smoke-$PID"
$hostPort = 55432 + ($PID % 1000)
$databaseUrl = "postgresql://aether:aether_test_password@localhost:$hostPort/aether_test"
$schemaPath = Join-Path $PSScriptRoot 'schema.prisma'

try {
  docker run -d --name $containerName `
    -e POSTGRES_DB=aether_test `
    -e POSTGRES_USER=aether `
    -e POSTGRES_PASSWORD=aether_test_password `
    -p "${hostPort}:5432" postgres:15-alpine | Out-Null

  $ready = $false
  for ($attempt = 0; $attempt -lt 30; $attempt++) {
    docker exec $containerName pg_isready -U aether -d aether_test *> $null
    if ($LASTEXITCODE -eq 0) {
      $ready = $true
      break
    }
    Start-Sleep -Seconds 1
  }
  if (-not $ready) { throw 'PostgreSQL temporal no inició dentro del tiempo esperado' }

  $env:DATABASE_URL = $databaseUrl
  corepack pnpm dlx prisma@5.22.0 migrate deploy --schema $schemaPath
  if ($LASTEXITCODE -ne 0) { throw 'La migración Prisma falló en una base limpia' }

  corepack pnpm dlx prisma@5.22.0 migrate status --schema $schemaPath
  if ($LASTEXITCODE -ne 0) { throw 'El estado de migraciones no quedó limpio' }

  $counts = docker exec $containerName psql -U aether -d aether_test -Atc @"
SELECT
  (SELECT COUNT(*) FROM workspaces WHERE organization_id IS NULL),
  (SELECT COUNT(*) FROM teams WHERE workspace_id IS NULL),
  (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'initiatives');
"@
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo auditar la base migrada' }

  $values = $counts.Trim().Split('|')
  if ($values.Count -ne 3 -or $values[0] -ne '0' -or $values[1] -ne '0' -or $values[2] -ne '1') {
    throw "La auditoría de invariantes falló: $($counts.Trim())"
  }

  Write-Host 'Migration smoke test passed.'
}
finally {
  Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
  if (-not $KeepContainer) {
    docker rm -f $containerName *> $null
  } else {
    Write-Host "Container kept: $containerName"
  }
}
