---
title: "Definition of Ready, Done y Release"
tipo: "gobierno de entrega"
estado: "propuesto"
---

# Definition of Ready, Done y Release

## Ready para desarrollar

| Condición | Evidencia |
| :--- | :--- |
| Resultado entendido | Actor, problema, resultado y métrica |
| Alcance acotado | Incluido, excluido y dependencias |
| Comportamiento verificable | Criterios felices, alternativos y abusivos |
| Dominio definido | Estado, invariantes, datos y vocabulario |
| Acceso definido | Acción, roles candidatos, alcance y condiciones |
| Riesgo tratado | Privacidad, seguridad, migración y operación |
| Diseño suficiente | Contrato, experiencia y ADR cuando corresponda |
| Trazabilidad completa | RF, RNF, historia y casos enlazados |

## Done para integrar

| Condición | Evidencia |
| :--- | :--- |
| Implementación completa | Código revisado y límites respetados |
| Calidad | Tipos, lint y suites aplicables en verde |
| Datos | Migración compatible y ensayo realizado |
| Seguridad | Permitidos, denegados y secretos revisados |
| Experiencia | Carga, vacío, error, conflicto y accesibilidad |
| Observabilidad | Logs, métricas, trazas y eventos de producto |
| Operación | Configuración, flag, runbook y rollback |
| Documentación | Contrato, decisión y ayuda actualizados |

## Ready para liberar

| Condición | Evidencia |
| :--- | :--- |
| Artefacto | Imagen firmada, SBOM y procedencia |
| Compatibilidad | API, evento, esquema y cliente comprobados |
| Entorno | Configuración validada y capacidad disponible |
| Datos | Backup reciente y recuperación ensayada según riesgo |
| Seguridad | Sin vulnerabilidad crítica abierta y excepciones con vencimiento |
| Producto | Aceptación y métrica habilitada |
| Operación | Alertas, tablero, guardia y comunicación |
| Lanzamiento | Plan gradual, flag y criterio de detener |

## Criterio de producto completo

Completo no significa que todos los módulos imaginables existan. Significa que el segmento objetivo completa su trabajo principal de forma segura, accesible y confiable; la organización puede gobernar acceso y datos; operación puede detectar, restaurar y responder; y el equipo puede cambiar el producto sin perder integridad ni compatibilidad.

## Relaciones

Estas puertas aplican a cada hito de [[Roadmap de reconstruccion]] y usan la evidencia de [[Matriz de trazabilidad greenfield]].
