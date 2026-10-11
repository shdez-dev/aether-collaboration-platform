---
title: "Estrategia de pruebas greenfield"
tipo: "calidad"
estado: "propuesto"
---

# Estrategia de pruebas greenfield

## Principio

Las pruebas demuestran riesgos e invariantes, no solo ejecución de líneas. Se priorizan autorización multitenant, máquinas de estado, transacciones, idempotencia, migraciones, recuperación, accesibilidad y contratos. Cada defecto de producción relevante genera una prueba de regresión en la capa más baja capaz de reproducirlo.

## Capas

| Capa | Objetivo | Tecnología | Ejecución |
| :--- | :--- | :--- | :--- |
| Unidad | Políticas, cálculos, estados y valores | Vitest | En cada cambio |
| Integración | Repositorios, transacciones, migraciones, outbox y adaptadores | Vitest y Testcontainers | En cada cambio |
| Contrato | OpenAPI, eventos y proveedores | Validación de esquema y tests de consumidor | En cada cambio relevante |
| Componente web | Formularios, estados y accesibilidad | Testing Library y axe | En cada cambio |
| E2E | Recorridos críticos y fallos visibles | Playwright | En cada merge y despliegue |
| Seguridad | Autorización, dependencias, secretos y análisis dinámico | Herramientas automatizadas y revisión dirigida | Continua y antes de release |
| Rendimiento | Carga, estrés y duración | k6 o equivalente | Por hito y cambio de arquitectura |
| Resiliencia | Caída de dependencias, reintento y recuperación | Inyección controlada | Preproducción periódica |

## Datos y ambientes

Cada suite crea datos aislados mediante builders con organización explícita. Ninguna prueba depende del orden. Integración usa PostgreSQL real efímero, no una base sustituta con semántica diferente. E2E usa identidades de prueba y servicios simulados en bordes costosos, con un conjunto menor contra sandbox real del proveedor.

## Puertas

| Riesgo | Evidencia exigida |
| :--- | :--- |
| Cambio de permiso | Caso permitido y denegado, incluida otra organización |
| Cambio de estado | Todas las transiciones válidas e inválidas afectadas |
| Migración | Base vacía, actualización desde versión soportada, volumen y rollback de aplicación |
| Evento o trabajo | Duplicado, reintento, orden cuando importe y dead letter |
| Archivo | Tipo falso, tamaño, malware simulado, revocación y expiración |
| Interfaz crítica | Teclado, foco, lector, error, espera y conflicto |

La cobertura de líneas tiene un piso acordado y nunca puede transformarse en cien por ciento cuando no existen pruebas. Se publican total de archivos y comportamientos sin ejecutar para evitar métricas engañosas.

## Flakiness

Una prueba inestable no se reintenta hasta ocultarla. Se etiqueta, asigna propietario y corrige dentro de un plazo. La cuarentena solo se permite si no cubre una puerta crítica y existe incidencia con vencimiento. Se preservan trace, video y logs redactados para diagnóstico.

## Relaciones

Los escenarios concretos están en [[Catalogo de casos de prueba]] y la cobertura en [[Matriz de trazabilidad greenfield]].
