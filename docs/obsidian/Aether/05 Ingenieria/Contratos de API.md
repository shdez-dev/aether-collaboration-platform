---
title: "Contratos de API"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Contratos de API

## Principios

La API debe expresar acciones de negocio y retornar capacidades y condiciones calculadas por el servidor. Los clientes no reconstruyen permisos ni reglas de transición con lógica independiente.

El inventario de declaraciones de rutas está en [[Inventario de rutas]]. Ese inventario identifica entradas del código y middleware declarado; no es una especificación OpenAPI completa ni certifica todos los controles internos.

## Convenciones objetivo

| Aspecto | Contrato |
| :--- | :--- |
| Identificador | UUID validado y ámbito resuelto por servidor |
| Respuesta | success, data o error estructurado |
| Error | Código estable, mensaje comprensible y detalles seguros |
| Concurrencia | expectedVersion o If-Match en cambios relevantes |
| Reintentos | Clave de idempotencia para comandos de creación o efectos externos |
| Paginación | Cursor estable con identificador de desempate |
| Fechas | Instante UTC para eventos y zona contextual para visualización |
| Filtros | Validación y límites explícitos |
| Autorización | Recurso resuelto antes de devolver datos o agregados |
| Auditoría | Actor, contexto y correlación sin secretos |

## Comandos de negocio propuestos

Los nombres siguientes son una propuesta contractual; no se presentan como endpoints implementados.

| Acción | Entrada esencial | Salida |
| :--- | :--- | :--- |
| submitInitiative | Contexto, contenido y versión | Expediente recibido |
| transitionInitiative | Destino, motivo, evaluación y versión | Estado e historial |
| convertInitiative | Identidad del expediente y clave idempotente | Proyecto existente o nuevo |
| formalizeProject | Proyecto, estándar, evidencias y versión | Decisión o requisitos faltantes |
| transitionProject | Destino, fundamento y versión | Estado canónico |
| adoptStandard | Versión destino y aceptación del impacto | Vinculación nueva y historial |
| acceptDeliverable | Entregable, versión y evaluación | Aceptación atribuible |
| closeProject | Resultado y acta | Cierre confirmado |
| revokeAccess | Recurso, destinatario y motivo | Revocación y acciones derivadas |

## Ejemplo de conflicto de formalización

```json
{
  "success": false,
  "error": {
    "code": "FORMALIZATION_REQUIREMENTS_MISSING",
    "message": "El proyecto requiere completar condiciones de formalización.",
    "details": {
      "projectVersion": 12,
      "missingRequirements": ["acceptedLead", "approvedBrief"]
    }
  }
}
```

La respuesta no debe exponer nombres de usuarios, documentos o recursos ajenos al solicitante. Cuando se oculta la existencia de un proyecto, usar una respuesta consistente de recurso no encontrado.

## Semántica de respuesta

Una validación de formato puede devolver 400 o 422 según una convención única. Falta de sesión corresponde a 401; falta de permiso puede ser 403 o 404 según privacidad. Un conflicto de versión o transición corresponde a 409. Una dependencia temporalmente indisponible debe tener un código recuperable.

Las operaciones asincrónicas retornan un identificador de trabajo consultable. Un 202 no significa que una exportación o generación haya terminado. Los errores reintentables deben diferenciarse de los definitivos.

Relaciones: [[Matriz de permisos]], [[Eventos y tiempo real]] y [[Casos de aceptacion]].
