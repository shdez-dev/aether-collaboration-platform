---
title: "Migración y convivencia con el legado"
tipo: "transición"
estado: "propuesto"
---

# Migración y convivencia con el legado

Construir desde cero no obliga a desechar conocimiento ni a importar datos sin criterio. El sistema anterior se trata como una fuente externa con semántica incierta. La migración se decide por conjunto de datos y valor, no por parecido de tablas.

## Clasificación

| Categoría | Tratamiento |
| :--- | :--- |
| Concepto válido | Se redefine en lenguaje nuevo y se implementa sin copiar estructura |
| Dato necesario | Se mapea, limpia, valida y migra con procedencia |
| Dato histórico | Se conserva en archivo de consulta o exportación si existe obligación |
| Dato ambiguo | Requiere regla humana o queda fuera con registro |
| Código útil | Puede servir como ejemplo o fixture, pero se reescribe bajo límites nuevos |
| Deuda conocida | Se convierte en prueba, restricción o ADR, nunca en compatibilidad accidental |

## Proceso

| Etapa | Actividad | Evidencia |
| :--- | :--- | :--- |
| Inventario | Entidades, volúmenes, propietarios, calidad y sensibilidad | Catálogo firmado por negocio y datos |
| Mapeo | Regla campo a campo y transformación semántica | Documento versionado con casos ambiguos |
| Extracción | Exportación repetible de solo lectura | Checksum, conteos y snapshot temporal |
| Transformación | Normalización, deduplicación y referencias | Reporte de errores y decisiones |
| Carga | Importador idempotente a staging y luego dominio | Reanudación, lotes y auditoría |
| Reconciliación | Conteos, invariantes, muestras y aprobación | Informe por organización |
| Corte | Ventana, congelamiento, delta y comunicación | Go o no go con rollback |
| Retiro | Archivo, acceso de consulta y eliminación | Política, fecha y propietario |

## Estrategia de convivencia

La opción preferida es un piloto por organización y un corte controlado. Se evita dual write por su riesgo de divergencia. Si se requiere convivencia, el nuevo sistema lee datos legados mediante una capa anticorrupción y mantiene clara la autoridad de cada concepto. La sincronización es temporal, observable e idempotente.

## Aprendizajes que se convierten en controles

| Observación anterior | Respuesta greenfield |
| :--- | :--- |
| Conversión con múltiples escrituras y permisos implícitos | Transacción única, clave idempotente y confirmación de roles |
| Estados y promedios ambiguos | Máquinas de estado y definición matemática de indicadores |
| Tokens en almacenamiento del navegador | Sesión opaca HttpOnly |
| Redis Pub/Sub para cambios importantes | Outbox durable y Redis solo efímero |
| Documentos colaborativos en memoria | Persistencia de actualizaciones y snapshots antes de habilitar colaboración |
| Dos vías de acceso a PostgreSQL | Un contexto transaccional y una autoridad de migración |
| Configuraciones TypeScript obsoletas | Runtime y compilador fijados con prueba de instalación limpia |

## Relaciones

La evidencia del legado está en [[Estado actual y brechas]] y [[Fuentes y trazabilidad]]. El destino se define en [[Modelo de datos greenfield]].
