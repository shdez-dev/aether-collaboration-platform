---
title: "Ingreso y triage"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Ingreso y triage

## Propósito

Recibir una propuesta con poca fricción y asegurar que obtiene una respuesta. Triage significa clasificación inicial: comprobar que la iniciativa pertenece al ámbito, que contiene información suficiente y que existe alguien responsable de atenderla.

## Situación observada

InitiativeController implementa ingreso, asignación de participantes, transiciones, reportes y configuración institucional. El alias POST /api/initiatives/request comparte validación con el ingreso interno y exige autenticación. La creación comprueba membresía de workspace. No debe describirse como un formulario público anónimo.

La configuración incluye campos obligatorios, criterios de triage, cadencia de revisión, equipo coordinador y estándar institucional. La iniciativa conserva una instantánea de criterios para evitar que una modificación posterior cambie silenciosamente la evaluación inicial.

## Información mínima propuesta

| Campo | Razón | Validación |
| :--- | :--- | :--- |
| Título | Identificar el expediente | Texto claro dentro del límite admitido |
| Problema u oportunidad | Expresar necesidad | Situación, afectados y consecuencia |
| Solicitante | Establecer interlocución | Identidad verificable |
| Contexto de destino | Determinar gobierno | Workspace o programa elegible |
| Siguiente paso propuesto | Facilitar conversación | Acción concreta, aunque provisional |
| Evidencia inicial | Fundamentar | Opcional según etapa y estándar |
| Preferencia de confidencialidad | Controlar exposición | Compatible con política del programa |

La prioridad indicada por el solicitante es una solicitud. El coordinador determina la prioridad operativa con criterio documentado. «Urgente» requiere una causa y una fecha de revisión para evitar que toda la bandeja adquiera esa categoría.

## Flujo

1. Guardar borrador y comprobar requisitos antes de enviar.
2. Confirmar envío con identificador, fecha y plazo esperado.
3. Crear entrada de bandeja y asignar coordinación por regla o manualmente.
4. Detectar posible duplicado por contexto y contenido, sin fusionarlo automáticamente.
5. Evaluar elegibilidad usando PASS, FAIL o NOT_APPLICABLE con justificación.
6. Solicitar aclaraciones, continuar a diagnóstico o declinar con fundamento.
7. Comunicar la decisión y la próxima acción al solicitante.

El borrador recuperable y una cola de aclaraciones explícita son requisitos objetivo; no se certifica su cobertura actual.

## Estados actuales y tratamiento objetivo

El enum actual incluye SUBMITTED, TRIAGE, DIAGNOSIS, VALIDATION, APPROVED, DECLINED, PAUSED y ARCHIVED. La aplicación debe presentar transiciones permitidas según estado, persona y expediente, y no una lista genérica de todos los estados.

Una iniciativa pendiente debe tener responsable de atención y fecha de revisión. Los expedientes sin persona asignada aparecen en una cola de excepciones bajo responsabilidad del administrador. Pausar requiere motivo, persona a cargo y fecha de reanudación o revisión.

## Aceptación

Un solicitante sin permisos no puede listar expedientes ajenos. Dos envíos por reintento no deben duplicar la misma solicitud si comparten una clave de idempotencia. Una configuración inválida no puede dejar habilitado un formulario imposible de completar.

Relaciones: [[Diagnostico y evaluacion]], [[Redes y programas]] y [[Caso integral CREA]].
