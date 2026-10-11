---
title: "Registro de decisiones y supuestos"
tipo: "gobierno de diseño"
estado: "activo"
---

# Registro de decisiones y supuestos

## Política de decisión

Toda elección con efecto relevante en seguridad, datos, contratos, costo operativo o capacidad de evolución se registra como ADR antes de consolidarse. Una ADR contiene contexto, fuerzas, opciones, decisión, consecuencias, evidencia, fecha, responsables y condición de revisión. El código enlaza la ADR aplicable cuando la razón no sea evidente.

## Decisiones iniciales

| ADR | Estado | Decisión | Motivo resumido | Revisión |
| :--- | :--- | :--- | :--- | :--- |
| ADR-001 | propuesta | Monolito modular con web, servidor y worker desplegables | Minimiza complejidad distribuida y conserva límites extraíbles | Cuando un módulo requiera escala o aislamiento independiente demostrado |
| ADR-002 | propuesta | PostgreSQL como fuente transaccional única | Consistencia, restricciones, búsqueda y operación conocidas | Si aparece un caso medido que no pueda resolverse razonablemente |
| ADR-003 | propuesta | Sesión de servidor en cookie segura | Evita tokens persistentes accesibles desde JavaScript | Al adoptar un patrón de cliente distinto al navegador |
| ADR-004 | propuesta | REST documentado con OpenAPI 3.1 | Contratos claros, generación de cliente y adopción amplia | Si una experiencia exige otro estilo con ventaja demostrable |
| ADR-005 | propuesta | Outbox transaccional para eventos durables | Impide publicar efectos sin el cambio de negocio correspondiente | Al incorporar un bus administrado con garantías equivalentes |
| ADR-006 | propuesta | Almacenamiento de objetos privado compatible con S3 | Separa binarios de la base transaccional y permite políticas de acceso | Al seleccionar proveedor definitivo |
| ADR-007 | propuesta | OIDC con proveedor de identidad intercambiable | Reduce el riesgo de construir autenticación sensible desde cero | Al cerrar requisitos empresariales de SSO y aprovisionamiento |
| ADR-008 | propuesta | Compatibilidad accesible WCAG 2.2 nivel AA | Define una meta verificable desde diseño y pruebas | Ante actualización normativa o estándar superior acordado |

## Supuestos críticos

| Supuesto | Riesgo si es falso | Cómo validarlo | Fecha límite |
| :--- | :--- | :--- | :--- |
| Organizaciones pequeñas y medianas pueden iniciar con aislamiento lógico compartido | Puede requerirse despliegue dedicado o aislamiento físico | Entrevistas comerciales y revisión contractual | Antes de diseñar tenencia definitiva |
| El flujo iniciativa a proyecto es la principal fuente de valor | El MVP podría optimizar una tarea secundaria | Prototipo navegable y pruebas de tareas | Antes del segundo hito de producto |
| La edición simultánea no es requisito del primer lanzamiento | Puede bloquear adopción de equipos distribuidos | Investigación con usuarios y prueba de documentos | Antes de cerrar alcance del MVP |
| Una arquitectura regional inicial cubre residencia de datos | Puede requerirse multirregión o residencia por país | Revisión legal y comercial | Antes de contratar infraestructura |
| El equipo puede operar PostgreSQL, colas y almacenamiento administrados | El costo de soporte puede superar la capacidad | Prueba operativa y estimación de guardias | Antes del primer entorno compartido |

## Plantilla de ADR

| Campo | Contenido esperado |
| :--- | :--- |
| Identificador y título | Número estable y decisión expresada como acción |
| Contexto | Problema, restricciones y evidencia disponible |
| Opciones | Alternativas reales, incluida la opción de no cambiar |
| Decisión | Elección concreta y alcance |
| Consecuencias | Beneficios, costos, riesgos y trabajo posterior |
| Verificación | Prueba, métrica o revisión que demostrará la decisión |
| Reversibilidad | Señales, costo y procedimiento para cambiarla |

## Relaciones

Las decisiones técnicas se detallan en [[Stack tecnologico y politica de versiones]] y [[Arquitectura objetivo greenfield]]. Los supuestos se revisan en cada hito de [[Roadmap de reconstruccion]].
