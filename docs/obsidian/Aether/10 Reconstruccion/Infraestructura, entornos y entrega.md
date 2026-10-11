---
title: "Infraestructura, entornos y entrega"
tipo: "plataforma"
estado: "propuesto"
---

# Infraestructura, entornos y entrega

## Entornos

| Entorno | Propósito | Datos |
| :--- | :--- | :--- |
| Local | Desarrollo y pruebas rápidas | Ficticios y recreables |
| Preview | Revisión por cambio | Ficticios, vida limitada |
| Integración | Contratos, migraciones y E2E compartidos | Sintéticos controlados |
| Preproducción | Ensayo equivalente a producción | Anonimizados solo si está autorizado; preferentemente sintéticos representativos |
| Producción | Servicio real | Clasificados, cifrados y sujetos a retención |

No se copian datos de producción a entornos inferiores sin procedimiento aprobado de minimización y anonimización. Las cuentas y claves se separan por entorno.

## Componentes administrados

La primera operación utiliza PostgreSQL con backups y recuperación a punto en el tiempo, Redis con alta disponibilidad cuando sea necesario, almacenamiento de objetos privado, gestor de secretos, correo transaccional y backend de observabilidad. La región y proveedor se deciden después de residencia, costo, soporte y prueba de restauración.

## Pipeline

| Etapa | Salida obligatoria |
| :--- | :--- |
| Validación | Formato, lint, tipos, límites y secretos |
| Pruebas | Unidad, integración, contrato, seguridad y E2E aplicables |
| Construcción | Imagen OCI inmutable, SBOM, firma y procedencia |
| Migración | Plan, ensayo, compatibilidad y observación de bloqueos |
| Despliegue | Estrategia gradual, health checks y verificación sintética |
| Promoción | Aprobación por riesgo y artefacto idéntico entre entornos |
| Cierre | Métricas estables, anotación y capacidad de rollback |

## Despliegue seguro

Las aplicaciones se despliegan de forma progresiva. Las migraciones siguen expandir, migrar y contraer. Un error de aplicación se revierte a imagen anterior; un cambio de datos se recupera preferentemente con una migración forward, porque deshacer DDL puede destruir información. Las flags se usan para desacoplar despliegue de lanzamiento y tienen propietario, fecha de retiro y valor seguro por defecto.

## Configuración y secretos

La configuración se valida al arrancar. Los secretos se inyectan desde un gestor, se rotan y no aparecen en builds. Los permisos de runtime son mínimos. La infraestructura se define como código con plan revisado y detección de drift.

## Costos

Cada entorno etiqueta recursos y presenta presupuesto y alertas. Se mide costo por organización activa, almacenamiento, trabajos e inferencia si existe IA. La reducción de costo no sacrifica respaldo, cifrado ni auditoría sin una decisión de riesgo explícita.

## Relaciones

Los objetivos se encuentran en [[Requerimientos no funcionales greenfield]] y la respuesta en [[Observabilidad, continuidad y soporte]].
