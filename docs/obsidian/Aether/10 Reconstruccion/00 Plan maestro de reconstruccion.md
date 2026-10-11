---
title: "Plan maestro de reconstrucción"
tipo: "índice greenfield"
estado: "propuesto"
fecha_revision: 2026-09-07
---

# Plan maestro de reconstrucción

Esta sección es la fuente de verdad para desarrollar Aether nuevamente desde cero. No prescribe trasladar el código, las tablas ni los endpoints actuales. Conserva la bóveda anterior como evidencia de producto y de deuda, transforma esos aprendizajes en restricciones de diseño y exige validar cada decisión mediante resultados observables.

La nueva plataforma se concibe como un sistema institucional para convertir necesidades en iniciativas evaluables, decisiones trazables y proyectos ejecutables. Su valor no está en acumular módulos, sino en mantener una cadena verificable entre propósito, gobierno, trabajo, evidencia y aprendizaje.

## Regla de precedencia documental

| Nivel | Fuente | Uso |
| :--- | :--- | :--- |
| 1 | Decisión de arquitectura aceptada | Resuelve una elección técnica o de producto vigente |
| 2 | Requerimiento aprobado y criterio de aceptación | Define comportamiento obligatorio |
| 3 | Nota de esta sección | Describe el diseño objetivo |
| 4 | Bóveda de análisis legado | Aporta contexto y aprendizaje, pero no obliga a reproducir una solución |
| 5 | Código anterior | Sirve como evidencia y fuente de migración, nunca como especificación automática |

## Recorrido recomendado

| Pregunta | Nota |
| :--- | :--- |
| Qué producto se construye y qué se excluye | [[Principios, alcance y antiobjetivos]] |
| Para quién se construye | [[Usuarios, problemas y trabajos]] |
| Cómo se divide el negocio | [[Mapa de dominios greenfield]] |
| Qué debe hacer | [[Requerimientos funcionales greenfield]] |
| Qué calidad debe garantizar | [[Requerimientos no funcionales greenfield]] |
| Cómo se expresa el valor para cada actor | [[Historias de usuario greenfield]] |
| Cómo se prueba la cobertura | [[Matriz de trazabilidad greenfield]] y [[Catalogo de casos de prueba]] |
| Qué arquitectura se adopta | [[Arquitectura objetivo greenfield]] |
| Qué tecnologías se seleccionan | [[Stack tecnologico y politica de versiones]] |
| Cómo se protegen identidad y datos | [[Identidad, autorizacion y sesiones]] y [[Seguridad y modelo de amenazas]] |
| Cómo se integran los componentes | [[API, eventos y trabajos asincronos]] |
| Cómo se desarrolla y despliega | [[Estructura del repositorio y normas de desarrollo]] e [[Infraestructura, entornos y entrega]] |
| Cómo se observa y recupera | [[Observabilidad, continuidad y soporte]] |
| Cómo se entrega por incrementos | [[Roadmap de reconstruccion]] |
| Cómo se decide que una entrega está lista | [[Definition of Ready, Done y Release]] |
| Cómo se trata el sistema anterior | [[Migracion y convivencia con el legado]] |

## Resultado esperado

El proyecto puede considerarse listo para iniciar implementación cuando estén aprobadas la visión, los límites del MVP, el modelo de dominio, los requerimientos prioritarios, el modelo de amenazas, los objetivos de servicio, las decisiones críticas y la primera rebanada vertical. Puede considerarse producto operable cuando un usuario complete el flujo principal con autorización, auditoría, recuperación, soporte y métricas verificadas, no solo cuando la interfaz funcione.

## Estado de definición

| Dimensión | Artefacto obligatorio | Evidencia de cierre |
| :--- | :--- | :--- |
| Producto | Alcance, métricas y antiobjetivos | Aprobación de responsables de negocio |
| Dominio | Lenguaje, agregados, invariantes y estados | Taller de dominio y escenarios resueltos |
| Experiencia | Flujos, estados vacíos, errores y accesibilidad | Pruebas con usuarios representativos |
| Ingeniería | ADR, contratos, datos y repositorio | Prototipo técnico y revisión cruzada |
| Seguridad | Amenazas, controles, privacidad y respuesta | Revisión de seguridad y casos abusivos |
| Calidad | Pirámide, casos, ambientes y puertas | Ejecución automatizada reproducible |
| Operación | SLO, telemetría, respaldo y runbooks | Simulación de incidente y restauración |

## Relaciones

Este plan reemplaza a [[Hoja de ruta]] como guía para el desarrollo nuevo. [[Estado actual y brechas]] y [[Fuentes y trazabilidad]] permanecen como memoria del sistema anterior.
