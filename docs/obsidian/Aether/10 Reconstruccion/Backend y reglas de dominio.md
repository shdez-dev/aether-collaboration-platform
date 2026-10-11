---
title: "Backend y reglas de dominio"
tipo: "backend"
estado: "propuesto"
---

# Backend y reglas de dominio

## Unidad de diseño

Cada caso de uso se expresa como consulta o comando. El manejador recibe un contexto autenticado, valida autorización, carga agregados, ejecuta reglas, confirma una transacción y devuelve un resultado estable. Los controladores traducen transporte; no contienen decisiones de negocio.

| Elemento | Ejemplo | Regla |
| :--- | :--- | :--- |
| Comando | ConvertApprovedInitiative | Nombre imperativo, intención única e idempotencia cuando aplica |
| Consulta | GetProjectOverview | Proyección autorizada y optimizada para lectura |
| Política | CanPublishAssessment | Decisión pura basada en actor, alcance y estado |
| Invariante | Una decisión produce como máximo un proyecto | Protegida en dominio y base de datos |
| Evento | ProjectCreated | Se emite después de una transición válida y se persiste con outbox |

## Manejo de errores

El dominio usa errores tipados: validación, estado inválido, conflicto, no autorizado, no encontrado seguro, cuota y dependencia. El borde los traduce sin exponer stack, SQL ni datos internos. Los errores inesperados conservan correlation_id y se registran con redacción.

## Transacciones

La frontera transaccional está en aplicación. Repositorios participantes usan la misma conexión. No se mezclan clientes de PostgreSQL que omitan la transacción. Una operación compuesta posee prueba de rollback. Los efectos de red se realizan después del commit mediante outbox, salvo protocolos específicamente diseñados para confirmación externa.

## Lecturas y reportes

Las consultas operativas pueden usar proyecciones SQL explícitas y vistas. Los indicadores documentan numerador, denominador, zona horaria, tratamiento de estados abiertos y datos faltantes. Un promedio nunca descarta silenciosamente casos sin cierre. Las proyecciones reconstruibles no sustituyen la fuente transaccional.

## Dependencias externas

Cada proveedor se encapsula tras un puerto pequeño y dispone de timeout, cancelación, reintento condicionado, circuit breaker cuando aporte valor y métrica. Los reintentos nunca se aplican ciegamente a acciones no idempotentes. Los mocks se limitan a pruebas unitarias; integración usa dobles contractuales o servicios reales efímeros.

## Relaciones

La estructura física se define en [[Estructura del repositorio y normas de desarrollo]] y la persistencia en [[Modelo de datos greenfield]].
