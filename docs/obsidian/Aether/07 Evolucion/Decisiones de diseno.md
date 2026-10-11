---
title: "Decisiones de diseno"
tipo: "diseño propuesto"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Decisiones de diseno

## Registro de decisiones propuestas

Estas decisiones hacen coherente la especificación. Su estado es «propuesta de producto», no aprobación del usuario ni implementación terminada. Pueden adoptarse por bloques siguiendo [[Hoja de ruta]].

| ID | Decisión recomendada | Motivo | Consecuencia |
| :--- | :--- | :--- | :--- |
| D-01 | Proyecto como centro operativo | Une alcance, trabajo y evidencia | Tableros subordinados al proyecto |
| D-02 | Iniciativa separada para selección institucional | El esquema ya la implementa y evita sobrecarga | Entrada directa sigue disponible |
| D-03 | Convertir y formalizar son actos distintos | Crear estructura no confirma compromisos | Nuevo proyecto puede estar pendiente |
| D-04 | Estado canónico con proyecciones heredadas | Evita contradicciones entre tres campos | Retirar edición independiente |
| D-05 | Estándar vinculado por versión inmutable | Conserva condiciones de evaluación | Adopción explícita de cambios |
| D-06 | Permisos por ámbito y acción | Separa coordinación, contribución y gobierno | Matriz única para todas las superficies |
| D-07 | Líder acepta y equipo de ingreso no se copia como ejecutor | Evita responsabilidad ficticia | Conversión propone asignaciones |
| D-08 | Relacional con outbox como evolución inmediata | Coincide con la base implementada | Event sourcing integral queda fuera del supuesto |
| D-09 | Evidencia versionada para aprobar | Conserva fundamento de decisiones | Cambios materiales requieren revisión |
| D-10 | Cobertura, calidad, madurez y resultado separados | Evita indicadores engañosos | Dashboard con métricas diferenciadas |
| D-11 | Capacidad no equivale a número de tareas | Recursos requieren unidad y período | Disponibilidad y asignación consistentes |
| D-12 | Concesión externa acotada y temporal | La red no es acceso universal | Revocación en todos los canales |
| D-13 | IA genera propuestas bajo revisión | Evita decisiones inventadas | Aplicación idempotente y autorizada |
| D-14 | Oferta comercial por recorridos terminados | Limita promesas a capacidad validada | Módulos incompletos fuera de oferta |
| D-15 | Cierre con aceptación y seguimiento | Entrega no implica resultado | Acta y medición posterior |

## Alternativas consideradas

Usar Project para todo el ingreso simplifica entidades, pero duplica el proceso institucional ya representado por Initiative. Se recomienda conservar ambos con fronteras claras y una conversión única.

Migrar toda la plataforma a event sourcing podría aportar reconstrucción histórica, pero exige transformar comandos, proyecciones, permisos y operación. La base revisada permite resolver primero la pérdida de continuidad mediante transacciones, historiales y outbox.

Conceder permisos de proyecto a cualquier miembro del workspace simplifica consultas, pero contradice la separación explícita del servicio actual y compromete expedientes privados. La propuesta conserva acceso explícito con gobierno documentado.

## Decisiones abiertas a investigación

| Tema | Supuesto inicial utilizado | Evidencia necesaria para revisarlo |
| :--- | :--- | :--- |
| Cliente prioritario | Programa institucional con variantes de equipo | Piloto y demanda comercial |
| Aprobación independiente | Obligatoria cuando el estándar la exige | Práctica del cliente |
| Plazos de atención | Configurables por workspace | Volumen y disponibilidad real |
| Contratación | Oferta por capacidades terminadas | Proveedor y política comercial |
| Conservación | Política por despliegue | Requisitos del cliente y evaluación pertinente |
| Presupuesto y finanzas de proyecto | Coordinación básica, sin contabilidad | Necesidad de integración |
| Offline | No prometer soporte completo inicialmente | Casos reales y diseño de sincronización |

Estas incertidumbres no impiden especificar permisos, trazabilidad o conversión correcta. Se documentan para no convertir supuestos en necesidades comprobadas.

Relaciones: [[Plantilla de decision]], [[Estado actual y brechas]] y [[Vision y propuesta de valor]].
