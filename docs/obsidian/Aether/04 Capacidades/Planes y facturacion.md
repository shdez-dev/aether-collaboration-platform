---
title: "Planes y facturacion"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Planes y facturacion

## Estado observado

CapabilityService define FREE, TEAMS, PORTFOLIO, INSTITUTIONAL y NETWORK. Resuelve una suscripción efectiva y sus overrides, y comprueba capacidades numéricas o booleanas. BillingController ofrece catálogo, resumen, checkout y webhook.

El checkout depende de BILLING_CHECKOUT_URL y responde indisponibilidad si falta configuración. El webhook usa un contrato genérico y firma HMAC de JSON serializado. Esto no demuestra integración completa con un proveedor comercial específico ni conciliación de pagos.

## Catálogo observado

| Plan | Workspaces | Miembros | Almacenamiento MB | Créditos IA |
| :--- | ---: | ---: | ---: | ---: |
| FREE | 1 | 1 | 250 | 3 |
| TEAMS | 5 | 15 | 10000 | 100 |
| PORTFOLIO | 20 | 50 | 50000 | 500 |
| INSTITUTIONAL | 100 | 500 | 250000 | 2000 |
| NETWORK | 250 | 2000 | 1000000 | 10000 |

Son valores del código inspeccionado, no precios, compromisos comerciales o límites probados de infraestructura. La periodicidad de créditos y el tratamiento de recursos archivados deben quedar definidos antes de publicarlos como oferta.

## Contrato comercial objetivo

| Situación | Comportamiento |
| :--- | :--- |
| Prueba | Capacidades y fecha de fin visibles |
| Activa | Operación dentro de límites contratados |
| Pago pendiente | Período de gracia explícito |
| Límite alcanzado | Bloqueo de nueva expansión con explicación |
| Descenso de plan | Conservación de datos y plan de adaptación |
| Cancelación | Acceso de consulta o exportación según política acordada |
| Evento duplicado | Sin efectos repetidos |
| Evento atrasado | No revierte una suscripción más reciente |

El servidor debe comprobar y reservar cuotas en operaciones concurrentes. Dos creaciones simultáneas no pueden superar un límite por consultar el mismo conteo anterior.

## Implementación necesaria

La integración de pago requiere identificar proveedor, eventos admitidos, firma sobre el formato exacto exigido, identificador de entrega, fecha del evento y reconciliación. Debe evitar que una notificación fuera de orden restablezca un plan antiguo.

No guardar secretos en el frontend. El rol BILLING_ADMIN gestiona pago y uso sin acceder por ese motivo a documentos privados. Los datos comerciales y operativos mantienen permisos diferenciados.

## Criterio de cierre comercial

Un cliente puede contratar, cambiar plan, recibir confirmación, consultar uso, corregir un pago fallido y cancelar sin manipulación manual de base de datos. Si ese recorrido no está disponible, el producto debe ofrecer contratación asistida explícita o restringir la promesa comercial.

Relaciones: [[Organizaciones y membresias]], [[Definicion de producto completo]] y [[Backlog priorizado]].
