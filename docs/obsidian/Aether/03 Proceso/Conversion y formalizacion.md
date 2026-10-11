---
title: "Conversion y formalizacion"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Conversion y formalizacion

## Diferencia central

Convertir crea un proyecto a partir de una iniciativa aprobada. Formalizar confirma que ese proyecto posee compromisos suficientes para planificar o ejecutar. Son dos operaciones diferentes. Una iniciativa aprobada puede convertirse en un proyecto todavía pendiente de líder, equipo o documentos.

## Comportamiento observado

La conversión actual usa una transacción y bloquea la iniciativa. Comprueba estado APPROVED, campos institucionales y criterios de triage. La relación source_initiative_id es única y una segunda conversión puede devolver el proyecto existente.

El código crea el proyecto como FORMALIZED, registra formalized_at, añade un tablero, genera un hito a siete días, vincula el equipo institucional y copia roles. No se observa creación de documento base en ese tramo. El propietario puede derivarse del coordinador o del actor cuando falta un líder. Esta automatización genera estructura, pero no prueba compromisos reales.

## Contrato objetivo de conversión

1. Validar autoridad y estado aprobado dentro de la transacción.
2. Verificar que no existe un proyecto asociado.
3. Fijar la versión del expediente y el estándar de destino.
4. Crear el proyecto en preparación de formalización.
5. Copiar problema y antecedentes conservando procedencia.
6. Proponer miembros y recursos sin atribuir aceptación no otorgada.
7. Registrar vínculo, historial y evento durable.
8. Devolver el mismo resultado cuando se repite la misma operación.

La fecha de un hito debe provenir del acuerdo del equipo o presentarse como sugerencia sin compromiso. Las evidencias heredadas conservan permisos y versión; copiar un enlace no concede automáticamente acceso.

## Puerta de formalización propuesta

| Condición | Evidencia suficiente | Evidencia insuficiente |
| :--- | :--- | :--- |
| Responsable | Líder vigente que acepta el compromiso | Administrador asignado por defecto |
| Problema | Necesidad y beneficiarios identificados | Texto de relleno |
| Alcance | Incluidos, excluidos y entregable inicial | Sólo un título |
| Equipo | Personas o capacidad comprometida | Equipo vacío vinculado |
| Documento base | Versión revisada con contenido mínimo | Documento vacío |
| Próximo compromiso | Hito o siguiente paso con responsable | Fecha generada sin acuerdo |
| Estándar | Versión aplicable y requisitos resueltos | Referencia a configuración cambiante |
| Aprobación | Decisión de actor autorizado | Porcentaje calculado automáticamente |

El estándar personal puede declarar equipo múltiple o comité como no aplicables. Mantiene un responsable y una decisión proporcional.

## Corrección de semántica

readyToFormalize expresa elegibilidad. formalizedAt expresa un hecho histórico. currentCompliance expresa cumplimiento actual. Deben ser campos distintos. Si se retira una evidencia después de formalizar, se conserva la fecha histórica y se abre una alerta o reevaluación; no se mantiene un «todo completo» basado exclusivamente en esa fecha.

## Aceptación

La formalización rechaza los requisitos incumplidos con códigos y detalle. Una doble conversión no duplica tableros, hitos ni personas. La conversión de un patrocinador no lo convierte en editor. El proyecto resultante identifica claramente qué elementos son propuestas y cuáles están aceptados.

Relaciones: [[Estandares y cobertura]], [[Equipos y responsabilidades]] y [[Ciclo del proyecto]].
