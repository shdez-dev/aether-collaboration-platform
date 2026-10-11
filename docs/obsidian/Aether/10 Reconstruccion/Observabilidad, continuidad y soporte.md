---
title: "Observabilidad, continuidad y soporte"
tipo: "operación"
estado: "propuesto"
---

# Observabilidad, continuidad y soporte

## Señales

OpenTelemetry instrumenta servidor y worker con trazas, métricas y logs correlacionados. La plataforma de destino es intercambiable. La telemetría usa nombres de dominio estables y evita cuerpos, tokens, correos y archivos salvo campos explícitamente aprobados.

| Área | Señales mínimas |
| :--- | :--- |
| HTTP | Tasa, errores, duración, ruta normalizada y saturación |
| Base de datos | Pool, tiempo de consulta, locks, conexiones y replicación |
| Outbox y worker | Antigüedad, profundidad, intentos, dead letters y duración |
| Sesiones | Login exitoso, rechazo, revocación y anomalías agregadas |
| Archivos | Cargas, escaneo, fallos, bytes y latencia |
| Producto | Presentación, evaluación, decisión, conversión, activación y cierre |

## SLO y error budget

El SLO se calcula sobre interacciones válidas y journeys sintéticos. Las alertas de alta urgencia se basan en consumo acelerado del error budget, pérdida de integridad, seguridad o imposibilidad de completar el flujo principal. Las métricas de infraestructura sin impacto visible generan diagnóstico, no necesariamente una guardia.

## Respaldo y recuperación

PostgreSQL usa respaldo automático y recuperación a punto en el tiempo. Los objetos emplean versionado o protección equivalente según clasificación. Los secretos y configuración tienen procedimiento de reconstrucción. Cada restauración comprueba integridad, permisos, outbox y capacidad de iniciar la aplicación. RTO y RPO solo se declaran cumplidos después de ejercicios medidos.

## Runbooks obligatorios

| Código | Escenario |
| :--- | :--- |
| RB-001 | API indisponible o latencia crítica |
| RB-002 | Saturación, bloqueo o failover de PostgreSQL |
| RB-003 | Outbox detenido o dead letters crecientes |
| RB-004 | Sospecha de acceso cruzado entre organizaciones |
| RB-005 | Compromiso de sesión o secreto |
| RB-006 | Archivos inaccesibles o malware detectado |
| RB-007 | Restauración completa y verificación |
| RB-008 | Proveedor OIDC, correo o almacenamiento degradado |

## Soporte

El soporte recibe correlation_id, estado del servicio y contexto que el usuario pueda compartir. No solicita credenciales. El acceso a datos es temporal, mínimo y auditable. Los incidentes tienen severidad, responsable, línea temporal, comunicación y revisión posterior con acciones rastreables.

## Relaciones

Los umbrales nacen de [[Requerimientos no funcionales greenfield]] y la salida a producción de [[Definition of Ready, Done y Release]].
