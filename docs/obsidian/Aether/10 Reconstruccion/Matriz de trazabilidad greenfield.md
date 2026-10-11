---
title: "Matriz de trazabilidad greenfield"
tipo: "trazabilidad"
estado: "base inicial"
---

# Matriz de trazabilidad greenfield

La trazabilidad evita construir pantallas sin propósito y declarar calidad sin evidencia. Una fila no está completa si falta requerimiento, historia, caso, señal operacional o responsable.

| Resultado | Requerimientos | Historias | Casos principales | RNF dominante | Hito |
| :--- | :--- | :--- | :--- | :--- | :--- |
| Acceso institucional seguro | RF-IAM-001 a RF-IAM-005 | US-001, US-016 | CP-IAM-001 a CP-IAM-006 | RNF-SEC-001 a RNF-SEC-005 | H1 |
| Aislamiento de organización y espacio | RF-ORG-001, RF-IAM-004 | US-002, US-012 | CP-TEN-001 a CP-TEN-005 | RNF-SEC-005 | H1 |
| Iniciativa presentable | RF-INI-001, RF-INI-002 | US-003, US-004 | CP-INI-001 a CP-INI-005 | RNF-PER-001, RNF-ACC-001 | H2 |
| Evaluación reproducible | RF-EVA-001 a RF-EVA-003 | US-005, US-013 | CP-EVA-001 a CP-EVA-006 | RNF-MNT-002, RNF-TST-001 | H2 |
| Decisión gobernada | RF-DEC-001, RF-DEC-002 | US-006 | CP-DEC-001 a CP-DEC-005 | RNF-SEC-001, RNF-OBS-001 | H2 |
| Conversión íntegra | RF-FOR-001 a RF-FOR-003 | US-007, US-008 | CP-FOR-001 a CP-FOR-007 | RNF-AVL-001, RNF-REL-001 | H3 |
| Ejecución controlada | RF-PRJ-001 a RF-PRJ-005 | US-009 a US-011, US-017 | CP-PRJ-001 a CP-PRJ-010 | RNF-PER-002, RNF-MNT-001 | H3 |
| Evidencia privada y recuperable | RF-DOC-001 a RF-DOC-003 | US-014 | CP-DOC-001 a CP-DOC-006 | RNF-SEC-002 a RNF-PRV-002 | H4 |
| Comunicación confiable | RF-NOT-001, RF-NOT-002 | US-015 | CP-NOT-001 a CP-NOT-004 | RNF-PER-004 | H4 |
| Auditoría y soporte | RF-AUD-001, RF-ADM-001, RF-EXP-001 | US-012, US-018, US-019 | CP-AUD-001 a CP-SUP-004 | RNF-OBS-001 a RNF-SUP-001 | H4 |
| Experiencia accesible | Todos los flujos M0 y M1 | US-020 y aplicables | CP-ACC-001 a CP-ACC-005 | RNF-ACC-001, RNF-ACC-002 | H1 a H4 |

## Puerta de cobertura

Un requerimiento M0 o M1 no puede pasar a listo para desarrollar sin propietario, criterios, modelo de datos afectado, riesgo de seguridad y caso de aceptación. No puede pasar a liberado sin prueba ejecutada, telemetría disponible, documentación operativa y evidencia de autorización negativa.

La cobertura de código no reemplaza esta matriz. Un porcentaje alto puede omitir una transición crítica. La métrica principal es cobertura de comportamientos e invariantes. La cobertura de líneas se utiliza como señal secundaria y nunca puede reportar éxito cuando no existan pruebas.

## Gestión de cambios

Cuando un requerimiento cambia, se revisan historias, casos, contratos, migraciones, métricas, contenido de ayuda y ADR relacionadas. Si el cambio elimina un comportamiento, se documentan compatibilidad, datos históricos y comunicación. La matriz debe validarse automáticamente cuando sea posible mediante identificadores en pruebas y descripciones de cambios.

## Relaciones

Los casos están en [[Catalogo de casos de prueba]], la automatización en [[Estrategia de pruebas greenfield]] y los hitos en [[Roadmap de reconstruccion]].
