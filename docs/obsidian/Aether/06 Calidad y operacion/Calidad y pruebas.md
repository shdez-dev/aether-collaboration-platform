---
title: "Calidad y pruebas"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Calidad y pruebas

## Qué se valida

La compilación demuestra compatibilidad sintáctica y de tipos dentro de su alcance. No demuestra que la autorización, los flujos, las migraciones o la experiencia sean correctos. Esta revisión de documentación no ejecutó la suite ni afirma resultados de pruebas de la versión actual.

El repositorio contiene pruebas unitarias de servicios y autorización, integración de autenticación, workspaces y tableros, y recorridos Playwright de autenticación, colaboración y tableros. La existencia de estos archivos no acredita cobertura de todo el proceso institucional.

## Estrategia objetivo

| Nivel | Propósito | Ejemplos |
| :--- | :--- | :--- |
| Unidad | Reglas deterministas | Cobertura, transiciones y permisos |
| Integración | Base y límites transaccionales | Conversión única y revocación |
| Contrato | Consistencia entre API y cliente | Errores, capacidades y versiones |
| Extremo a extremo | Trabajo de cada actor | Propuesta hasta cierre |
| Concurrencia | Operaciones simultáneas | Doble conversión y ciclo de dependencia |
| Recuperación | Fallos de componentes | Redis caído y reintento de eventos |
| Seguridad | Aislamiento y entradas adversas | IDs ajenos y archivos maliciosos |
| Usabilidad | Comprensión y autonomía | Usuario nuevo completa una revisión |
| Rendimiento | Servicio con carga representativa | Cartera grande y edición simultánea |

## Datos de prueba mínimos

Crear dos organizaciones con usuarios compartidos y separados, tres modos de workspace, proyectos privados, un portfolio, un programa de red y evaluadores externos. Incluir una concesión expirada, una persona revocada, un proyecto sin datos históricos y dos versiones de estándar.

Los casos deben verificar rechazo además de éxito. Un usuario que ve una tarjeta por error puede filtrar información aunque no pueda modificarla. Probar contadores, búsquedas, exportaciones y eventos, no sólo páginas.

## Puertas de integración

Una modificación de regla requiere caso positivo, negativo y de concurrencia cuando aplica. Una migración requiere base vacía y base heredada representativa. Un cambio de permisos requiere matriz de regresión. Una nueva integración requiere fallo, reintento y duplicado.

El pipeline debe producir evidencia revisable. Se observó pnpm audit con continue-on-error en CI; eso no constituye una puerta bloqueante por vulnerabilidades. La política de severidad y excepción debe definirse y ser verificable.

## Validación con usuarios

El piloto utiliza tareas concretas sin instrucciones de dónde pulsar. Registrar finalización, errores, tiempo y dudas. Una métrica de éxito técnico no sustituye la observación del trabajo real.

Los criterios funcionales están en [[Casos de aceptacion]]. La liberación exige que los bloqueantes de [[Definicion de producto completo]] estén cerrados con evidencia.
