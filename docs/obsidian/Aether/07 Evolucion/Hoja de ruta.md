---
title: "Hoja de ruta"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Hoja de ruta

## Secuencia por resultados

No se asignan fechas ficticias sin conocer equipo, disponibilidad y alcance comercial. La secuencia siguiente define dependencias y condiciones de salida.

| Etapa | Propósito | Contenido | Condición de salida |
| :--- | :--- | :--- | :--- |
| E0 | Establecer referencia | Reproducir entorno, inventariar datos y validar decisiones | Diagnóstico y plan de migración revisables |
| E1 | Corregir verdad del proceso | Estados, guardas, estándar y formalización | REQ-01 a REQ-04 aceptados |
| E2 | Asegurar autoridad y durabilidad | Permisos, sesiones, eventos y Yjs | REQ-05 a REQ-08 aceptados |
| E3 | Completar ciclo útil | Entregables, cierre, bandejas y métricas | Un expediente completa el ciclo |
| E4 | Operar un piloto | Capacidad, exportaciones, accesibilidad y recuperación | Usuarios reales operan sin reparación rutinaria |
| E5 | Completar oferta ampliada | Facturación, redes e IA según alcance | Cada módulo vendido supera su puerta |
| E6 | Lanzar y medir | Soporte, evidencia y medición de valor | Decisión formal de liberación |

E1 y E2 se coordinan porque las transiciones requieren autorización y atomicidad desde el inicio. El orden describe dependencias, no una invitación a postergar seguridad hasta el final.

## Plan de migración funcional

1. Clasificar proyectos por combinación actual de estado, madurez, workflow y estándar.
2. Definir mapeos deterministas y separar excepciones.
3. Introducir versión de entidad, registros de decisión y referencias de estándar confiables.
4. Migrar lecturas para exponer el modelo canónico con compatibilidad.
5. Migrar escrituras a comandos con guardas.
6. Probar con copias representativas y sin datos personales innecesarios.
7. Desplegar por contexto o capacidad con monitoreo.
8. Retirar rutas de escritura heredadas cuando ningún cliente dependa de ellas.

## Piloto propuesto

El piloto debe incluir solicitante, coordinador, mentor, líder, colaboradores y al menos un aprobador. Si se evalúa red, se añade un evaluador externo con expiración de acceso. Se usan una iniciativa aprobada, una devuelta, una declinada, un proyecto pausado y uno cerrado.

El resultado del piloto debe mostrar qué acciones requirieron ayuda, dónde se perdió información y si los usuarios comprendieron permisos y estados. Los hallazgos se convierten en backlog con evidencia.

## Condición para ampliar alcance

No añadir nuevos sectores o programas si cada uno exige duplicar lógica central. La configuración debe adaptar requisitos y lenguaje. Si una variación altera autoridad o significado de estados, necesita una decisión de dominio antes de implementarse.

## Gobierno de esta documentación

Actualizar esta bóveda con cada decisión material. Conservar fecha, fuente y condición de aceptación. Los inventarios representan la fotografía de la revisión y deben regenerarse o actualizarse cuando cambie el código.

Relaciones: [[Definicion de producto completo]], [[Decisiones de diseno]] y [[Caso integral CREA]].
