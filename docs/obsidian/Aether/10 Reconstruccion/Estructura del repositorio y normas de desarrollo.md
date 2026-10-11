---
title: "Estructura del repositorio y normas de desarrollo"
tipo: "desarrollo"
estado: "propuesto"
---

# Estructura del repositorio y normas de desarrollo

## Estructura objetivo

```text
apps/
  web/
  server/
  worker/
packages/
  domain/
  application/
  contracts/
  database/
  auth/
  observability/
  ui/
  config/
  testkit/
infra/
  environments/
  modules/
docs/
  adr/
  api/
  runbooks/
  obsidian/Aether/
tools/
```

domain se divide internamente por contexto y no importa paquetes de infraestructura. application contiene casos de uso y puertos. contracts contiene OpenAPI, eventos y tipos generados, pero no entidades persistentes. database posee migraciones y adaptadores. ui no conoce autorización de negocio.

## Configuración TypeScript

Existe un tsconfig.base.json mínimo y configuraciones por tipo de aplicación. Se usa module y moduleResolution compatibles con el runtime y bundler elegidos. No se heredan opciones retiradas. typecheck ejecuta el compilador instalado en el workspace y CI verifica que editor, scripts y build resuelvan la misma versión.

## Comandos canónicos

| Comando | Propósito |
| :--- | :--- |
| pnpm install --frozen-lockfile | Instalación reproducible |
| pnpm lint | Calidad estática y límites arquitectónicos |
| pnpm typecheck | Tipos de todos los paquetes |
| pnpm test | Unidad e integración rápida |
| pnpm test:e2e | Recorridos en entorno efímero |
| pnpm build | Artefactos de producción |
| pnpm db:migrate | Migraciones pendientes controladas |
| pnpm verify | Puerta local equivalente a CI |

## Flujo de contribución

Todo cambio parte de historia o incidencia con riesgo y aceptación. Las ramas son breves. La revisión exige claridad, pruebas, seguridad, migración, telemetría y documentación. CI usa lockfile inmutable, servicios efímeros, caché con clave completa y artefactos firmados. El merge requiere las puertas aplicables y no permite silenciar pruebas sin decisión temporal registrada.

## Calidad del código

Se usa formateo automático, lint estricto, importaciones con fronteras y análisis de ciclos. No se obliga cobertura uniforme a archivos triviales, pero sí casos sobre invariantes. Las fechas, dinero, identificadores y estados usan tipos de dominio. Los logs no reciben objetos de solicitud completos.

## Entorno local

Un archivo de ejemplo enumera variables sin secretos. Los servicios se levantan con contenedores versionados. Los datos semilla son ficticios. La inicialización es idempotente y la documentación comprueba prerrequisitos. La ruta feliz desde clon hasta primer test debe ejecutarse en una máquina limpia.

## Relaciones

La selección está en [[Stack tecnologico y politica de versiones]] y las puertas en [[Definition of Ready, Done y Release]].
