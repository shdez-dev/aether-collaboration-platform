---
title: "Fuentes y trazabilidad"
tipo: "evidencia y método"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Fuentes y trazabilidad

## Método y límites de la revisión

Se revisó el repositorio local el 7 de septiembre de 2026. La referencia de Git es 3e72381807526c668b269dae3232eb322b79fd9c. El árbol tenía cambios locales previos en configuración del editor, dependencias, BoardService y estilos. Los hallazgos reflejan el contenido observado, no necesariamente un commit limpio.

La inspección abarcó documentación de producto, esquema Prisma, declaraciones de rutas, pantallas, controladores de iniciativas y proyectos, servicios de autorización, eventos, colaboración, capacidades, facturación, arranque y configuración. Las lecturas dirigidas de estos componentes sostienen los hallazgos identificados; no se afirma haber auditado cada línea del repositorio.

No se consultaron secretos, bases de datos, cuentas externas o producción. No se ejecutaron pruebas de negocio ni se midió rendimiento. No se modificó código de la plataforma para aplicar las propuestas de esta bóveda.

## Clasificación de afirmaciones

| Categoría | Significado | Uso |
| :--- | :--- | :--- |
| Observado | Existe evidencia directa en la fuente identificada | Inventarios y comportamiento inspeccionado |
| Inferencia | Consecuencia razonada del código o de una contradicción | Riesgo o implicación que requiere validación |
| Propuesto | Regla recomendada para coherencia del producto | Flujos objetivo y criterios |
| Por verificar | La evidencia disponible no acredita el comportamiento | Producción, experiencia y garantías operativas |

El contenido metodológico define un diseño completo de referencia basado en las necesidades expresadas por el usuario y en la tesis del repositorio. No equivale a requisitos aprobados por clientes ni reemplaza investigación con usuarios.

## Orden para resolver contradicciones

Para describir implementación, priorizar código ejecutable y migraciones vigentes, después pruebas observadas y finalmente documentación descriptiva. Las pruebas sólo constituyen evidencia de comportamiento cuando se ejecutan y se conserva su resultado.

Para diseñar el objetivo, priorizar necesidades humanas, invariantes de acceso e integridad y continuidad metodológica. No preservar una incoherencia únicamente porque exista en código.

## Registro de fuentes

Las rutas son relativas a la raíz del repositorio. Los hashes SHA-256 identifican el contenido exacto leído y permiten detectar modificaciones posteriores. Se evita copiar código completo o configuraciones sensibles a la bóveda.

| ID | Ruta | Líneas |
| :--- | :--- | ---: |
| S-01 | `docs/product/README.md` | 207 |
| S-02 | `docs/product/implementation-plan.md` | 553 |
| S-03 | `docs/architecture/project-centered-structure.md` | 67 |
| S-04 | `docs/architecture/workspace-context.md` | 22 |
| S-05 | `docs/architecture/adr_001_event_sourcing.md` | 247 |
| S-06 | `docs/runbooks/database-migrations.md` | 76 |
| S-07 | `apps/api/prisma/schema.prisma` | 1666 |
| S-08 | `apps/api/src/controllers/ProjectController.ts` | 1589 |
| S-09 | `apps/api/src/controllers/InitiativeController.ts` | 475 |
| S-10 | `apps/api/src/services/ProjectAuthorizationService.ts` | 192 |
| S-11 | `apps/api/src/services/PortfolioAuthorizationService.ts` | 132 |
| S-12 | `apps/api/src/services/EventStoreService.ts` | 299 |
| S-13 | `apps/api/src/websocket/Yjsgateway.ts` | 432 |
| S-14 | `apps/api/src/controllers/BillingController.ts` | 15 |
| S-15 | `apps/api/src/services/CapabilityService.ts` | 56 |
| S-16 | `apps/web/src/stores/authStore.ts` | 505 |
| S-17 | `apps/api/src/index.ts` | 330 |
| S-18 | `apps/api/Dockerfile` | 89 |
| S-19 | `apps/api/src/config/env.ts` | 142 |
| S-20 | `apps/web/next.config.js` | 28 |
| S-21 | `.github/workflows/ci.yml` | 271 |

## Relación entre conclusiones y fuentes

| Tema | Fuente principal | Punto observado |
| :--- | :--- | :--- |
| Tesis del producto | S-01, S-02 | Idea, formalización y operación |
| Fronteras de contexto | S-03, S-04, S-07 | Organización, workspace, proyecto |
| Madurez y cobertura | S-08 | computeFormalization, computeCoverage, hydrateProject |
| Estado del proyecto | S-08 | update y transitionWorkflow |
| Conversión institucional | S-09 | convert y transacciones |
| Asignación de roles | S-09, S-10 | Conversión y resolución de autoridad |
| Acceso de portfolio | S-11 | getAccess y niveles |
| Arquitectura de eventos | S-05, S-12 | Promesa de ADR y emisión real |
| Colaboración documental | S-13, S-17 | Guardado y transporte Socket.io |
| Contratación | S-14, S-15 | Checkout, webhook y catálogo |
| Sesiones del cliente | S-16 | Persistencia de tokens |
| Migraciones | S-06, S-17, S-18 | Prisma antes del arranque |
| Configuración local | S-19, S-20 | Defaults de puertos y URLs |
| Puertas de CI | S-21 | Jobs y auditoría no bloqueante |

## Huellas de contenido

| ID | SHA-256 |
| :--- | :--- |
| S-01 | `289bd673d1e61f8d09d39e16027dc5ed06d2b4de38072622b6bb6e2661c7099c` |
| S-02 | `6e0ec55b09d77bc74826627e8b6b85d994d9e488e62ae029a063fcc7e705d0d2` |
| S-03 | `57af8f7267e7e168ab9e23059682d5a6b7efa404d21f5663db5ddc672f6c3fcc` |
| S-04 | `cc5f11bc12e1bdb81c002e930bdcb5ca3e495e42048499bee2f687c058c5cb99` |
| S-05 | `8fd82227869570b21a7961ac398bb0453ff4aa80d2b6440563a488eef662878b` |
| S-06 | `43f99523cf9b227f5f358a08da2f9468a73ae8596a8c33daec08fe3885e4672e` |
| S-07 | `67a023045287d20e190b724eefdc2f50f5fe436412c38c21d77d7ea80374e9c3` |
| S-08 | `a7b24644d77d00f80256cf10ea9f8f26a8801785930ecd599c2b25651db015fa` |
| S-09 | `5700de31fc4dd7c9bda68a2c152e096bb90bb1bd0598cc0e8b010d197b620280` |
| S-10 | `161f752efcd0357bec44b8d6505b6d9849bbb722bbccead30230c08b8ea3c438` |
| S-11 | `1d6815185509fe16304f0c7f6d7f8f8256b45ce6370c35afb9ab2034eed116b2` |
| S-12 | `e23c6113e846ba3567af7d65371ed01a8ef426366058c2a3ff5e6161c1c84bba` |
| S-13 | `0f64ff7e8b435742cd0fcb2df83e1bd96dd7bfddada75bfb323feba03bf82721` |
| S-14 | `a3d3b741fe68e5d8e2bd4190fb870389213a901e2d04b517f2cd4a1d4ef73a1b` |
| S-15 | `c6910b18d95decc155195c595a1e6dcbf2e39984f99d2fe0bbba5cdfa55ffc43` |
| S-16 | `a6f74a680a789f35ac02b0148bcd7155003a3662730adaf6b13bf0b6311b286e` |
| S-17 | `143ab18a4d266f9ecf0d88d2b5f847460b7f73c6ed193239a6d13218d628abee` |
| S-18 | `1ed491b4ab715193452ea5880e2a1ba31f03adfc8ec3e0150c149b0592757d8a` |
| S-19 | `529a493a1996e2d031bf8ea81aa3888797dc7d5d86f4a555396d7668502bc4ea` |
| S-20 | `6529845dd45dc205d24decd10c3b9c13487c922a4e845c3f2e6d47f0c884b63c` |
| S-21 | `82227a2da3ccb1f86f05975231935829d6ad749f90d6330f0679eca30e22a97e` |

## Mantenimiento de la evidencia

Cuando cambia una regla, revisar el método afectado y actualizar esta nota. Si la fuente ya no coincide con su hash, el hallazgo necesita reevaluación antes de seguir tratándose como observado en la versión actual.

Los inventarios son anexos de referencia, no sustitutos del análisis. [[Inventario de datos]] refleja el esquema declarado; [[Inventario de rutas]] refleja declaraciones de router; [[Inventario de pantallas]] refleja archivos de App Router.

La verificación documental de la entrega comprueba enlaces internos, archivos referenciados en inventarios, formato y ausencia de caracteres excluidos por el usuario. No convierte las especificaciones de [[Casos de aceptacion]] en pruebas de plataforma aprobadas.
