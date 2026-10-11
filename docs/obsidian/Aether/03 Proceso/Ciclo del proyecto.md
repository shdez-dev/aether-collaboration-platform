---
title: "Ciclo del proyecto"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Ciclo del proyecto

## Problema observado

El modelo actual almacena status, maturity_stage y workflow_stage. ProjectController permite actualizar campos de estado y además dispone de un endpoint de workflow que proyecta valores entre ellos. Esto crea varios caminos de escritura para conceptos relacionados.

En transitionWorkflow se observa actualización del proyecto y escritura posterior del historial mediante consultas separadas. No se observa una validación completa de transiciones permitidas ni de elegibilidad para formalizar en ese método. Avanzar a VALIDATION, PREPARATION o EXECUTION puede sellar formalized_at directamente.

## Modelo canónico propuesto

Separar madurez, situación operativa, salud y resultado final. La madurez indica cuánto se ha formalizado. La situación indica si se está ejecutando o en pausa. La salud indica desviaciones. El resultado final distingue entrega aceptada de cancelación.

| Dimensión | Valores conceptuales | Autoridad |
| :--- | :--- | :--- |
| Madurez | Borrador, formalizado, planificado | Motor de transición y decisiones |
| Situación | Preparación, activo, pausado, en cierre, cerrado | Comando de negocio autorizado |
| Salud | Sin datos, normal, en riesgo, bloqueado | Indicadores y revisión humana |
| Resultado de cierre | Completado, cancelado, sustituido | Acta de cierre |
| Archivo | Fecha y actor de archivo | Política de conservación |

Estos valores son objetivo, no enums existentes. La migración debe mantener temporalmente las columnas heredadas como proyecciones y retirar su edición independiente.

## Tabla de transiciones objetivo

| Origen | Destino | Autoridad | Condiciones |
| :--- | :--- | :--- | :--- |
| Borrador | Formalizado | Aprobador definido por estándar | Puerta de formalización completa |
| Formalizado | Planificado | Líder y aprobador cuando aplica | Entregables, recursos y riesgos |
| Planificado | Activo | Líder autorizado | Inicio acordado y capacidad vigente |
| Activo | Pausado | Líder o gobierno autorizado | Motivo, impacto y revisión |
| Pausado | Estado previo válido | Responsable autorizado | Causa atendida y plan revisado |
| Activo | En cierre | Líder | Entregables listos para aceptación |
| En cierre | Cerrado completado | Aprobador o beneficiario | Aceptación y pendientes transferidos |
| Cualquier estado abierto | Cerrado cancelado | Gobierno autorizado | Justificación y cierre de compromisos |
| Cerrado | Archivado | Política o administrador | Conservación y accesos definidos |

Reabrir un proyecto requiere motivo y autoridad. No debe editar el acta anterior; registra un nuevo episodio operativo.

## Integridad transaccional

El comando recibe estado o versión esperada. El servidor bloquea o compara versión, comprueba permisos vigentes, valida guardas, persiste estado e historial y añade evento a una bandeja transaccional. Si otra persona cambió el proyecto, responde conflicto recuperable y devuelve la versión actual.

Las transiciones no se ejecutan desde un PUT genérico que admita campos arbitrarios. La UI consume allowedActions y missingRequirements del servidor. El evento describe hechos, no intentos sin confirmar.

## Política de cambios

Una ampliación menor se incorpora al plan por autoridad delegada. Una modificación del objetivo, del presupuesto autorizado o de la fecha comprometida requiere revisión. Los criterios deben ser configurables y comunicados antes de ejecutar la acción.

Relaciones: [[Contratos de API]], [[Eventos y tiempo real]] y [[Cierre y aprendizaje]].
