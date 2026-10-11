---
title: "Estado actual y brechas"
tipo: "diagnóstico estático"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Estado actual y brechas

## Alcance de la evidencia

La base observada es el checkout local asociado al commit 3e72381807526c668b269dae3232eb322b79fd9c, incluyendo los cambios locales existentes al iniciar la revisión. No se revisó un despliegue productivo. Los hallazgos siguientes provienen de lectura de fuentes específicas; no son resultados de pruebas de penetración o ejecución.

| Capacidad | Evidencia observada | Límite de la conclusión |
| :--- | :--- | :--- |
| Usuarios y organizaciones | Modelos, rutas y servicios | No se verificó todo el ciclo real de sesiones |
| Ingreso institucional | Controller, esquema y UI | No acredita acceso público externo |
| Conversión | Transacción y vínculo único | No prueba calidad de formalización |
| Proyectos | Datos, reglas, páginas y componentes | Estados tienen vías de escritura diversas |
| Cobertura | Cálculo en ProjectController | Predomina presencia, no calidad |
| Tableros | CRUD, dependencias y sprints | Concurrencia integral pendiente |
| Documentos | Versiones y colaboración Yjs | Durabilidad multiinstancia no acreditada |
| Portfolio | Roles, capacidad, alertas y exportación | Recorrido completo pendiente de piloto |
| Redes | Programas, grants y evaluaciones | Cobertura transversal de permisos pendiente |
| Facturación | Capacidades y contrato genérico | Proveedor efectivo no verificado |
| Calidad | Archivos de pruebas y CI | Ejecución actual no realizada |

## Hallazgos prioritarios

| ID | Hallazgo comprobable o límite | Implicación | Fuente y acción |
| :--- | :--- | :--- | :--- |
| B-01 | hydrateProject calcula usando estándar activo | Resultados pueden cambiar aunque se declare otra versión aplicada | ProjectController, REQ-02 |
| B-02 | isFormalized usa fecha histórica o checklist listo | Confunde elegibilidad, aprobación y cumplimiento actual | ProjectController, REQ-03 |
| B-03 | transitionWorkflow actualiza e inserta historial por separado | Un fallo intermedio puede dejar trazabilidad incompleta | ProjectController, REQ-01 y REQ-06 |
| B-04 | El método de workflow no muestra guardas completas de origen y destino | Posibilidad de avance sin condiciones metodológicas | ProjectController, REQ-01 |
| B-05 | Conversión crea FORMALIZED y hito automático | Estructura generada puede aparentar compromiso aceptado | InitiativeController, REQ-04 |
| B-06 | Conversión puede asignar coordinador y equipo de ingreso | Gobierno y ejecución se mezclan | InitiativeController, REQ-04 |
| B-07 | Roles no contemplados de iniciativa caen en COLLABORATOR | SPONSOR puede adquirir semántica de contribución | InitiativeController, REQ-04 |
| B-08 | Eventos usan publicación sin entrega durable demostrada | Caída de Redis puede perder notificación del hecho | EventStoreService, REQ-06 |
| B-09 | Estado Yjs en memoria con guardado diferido | Ventana de durabilidad y multiinstancia por verificar | Yjsgateway, REQ-07 |
| B-10 | Tokens persistidos en localStorage | Requiere decidir arquitectura de sesión y mitigaciones | authStore, REQ-08 |
| B-11 | Checkout depende de URL configurada y webhook genérico | No se puede declarar cobro comercial completo | BillingController, REQ-16 |
| B-12 | Documentación antigua limita edición a admins de workspace | Contradice servicio actual que admite líderes | ProjectAuthorizationService, REQ-05 |
| B-13 | ADR promete event sourcing integral | No se acredita replay de todo el estado | ADR y servicios SQL, REQ-06 |
| B-14 | Documento antiguo menciona dos migradores | Contradice arranque Prisma inspeccionado | Dockerfile, index y runbook, REQ-15 |
| B-15 | Defaults de puertos distintos entre frontend y API | Instalación nueva puede requerir correcciones manuales | next.config, config/env y scripts, REQ-15 |
| B-16 | Cobertura vacía devuelve 100 | Puede representar falta de requisitos como calidad total | computeCoverage, REQ-02 |
| B-17 | Reporte temporal sólo usa estadías con transición siguiente | Pendientes largos no aparecen en ese promedio | InitiativeController.reports, REQ-12 |

## Qué requiere validación adicional

No se certificaron integridad de datos existentes, volumen, carga, seguridad de producción, experiencia móvil, aceptación por usuarios, correcta configuración de proveedores ni efectividad de respaldos.

La ausencia de un control en un método no prueba que no exista en ninguna capa del sistema. Antes de implementar una corrección se debe confirmar su recorrido completo, revisar pruebas y producir una reproducción cuando corresponda. Los hallazgos con lectura directa de escritura y cálculo sí respaldan las divergencias descritas.

## Interpretación

El repositorio contiene una base funcional amplia. La prioridad consiste en cerrar significado, autoridad y continuidad del flujo antes de sumar nuevas superficies. El diseño objetivo está en [[Decisiones de diseno]] y su ejecución en [[Backlog priorizado]].

La documentación creada en esta tarea no corrige automáticamente estos comportamientos en la aplicación.
