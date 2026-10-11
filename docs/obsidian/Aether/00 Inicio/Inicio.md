---
title: "Inicio"
tipo: "guía"
fecha_revision: 2026-09-07
version_documental: "1.0"
---

# Inicio

Esta bóveda define Aether como producto y como sistema operativo de colaboración. Su objetivo es conectar una necesidad con una decisión, una decisión con responsables, los responsables con ejecución y la ejecución con evidencia de resultados.

El desarrollo nuevo debe comenzar en [[Plan maestro de reconstruccion]]. Esa sección es la especificación greenfield vigente. Las notas anteriores conservan el análisis del sistema legado, sus conceptos y sus brechas, pero no obligan a copiar código, esquema, rutas ni decisiones técnicas.

La referencia es el repositorio local revisado el 7 de septiembre de 2026. Las propuestas describen el funcionamiento objetivo y no certifican que ya esté implementado. La revisión fue documental y estática: no se accedió a producción, no se consultaron bases de datos, no se probaron recorridos con usuarios y no se modificó la aplicación.

## Cómo abrir y recorrer la bóveda

En Obsidian, utilizar «Abrir carpeta como bóveda» y seleccionar la carpeta Aether que contiene esta nota y el directorio .obsidian. La bóveda usa Markdown, enlaces internos, tablas y diagramas Mermaid. No requiere complementos comunitarios, servicios externos ni sincronización de pago.

| Necesidad de lectura | Punto de entrada |
| :--- | :--- |
| Reconstruir el producto desde cero | [[Plan maestro de reconstruccion]] |
| Conocer alcance y exclusiones del producto nuevo | [[Principios, alcance y antiobjetivos]] |
| Revisar requisitos, historias y pruebas del producto nuevo | [[Matriz de trazabilidad greenfield]] |
| Revisar arquitectura y tecnologías del producto nuevo | [[Arquitectura objetivo greenfield]] y [[Stack tecnologico y politica de versiones]] |
| Entender para qué existe el producto | [[Vision y propuesta de valor]] |
| Entender su método de trabajo | [[Metodo operativo]] |
| Conocer usuarios y responsabilidades | [[Actores y necesidades]] |
| Definir quién puede hacer qué | [[Matriz de permisos]] |
| Recorrer el proceso completo | [[Flujo integral]] |
| Resolver contradicciones del producto | [[Decisiones de diseno]] |
| Conocer el estado del código | [[Estado actual y brechas]] |
| Planificar un producto completo | [[Definicion de producto completo]] |
| Implementar con criterios verificables | [[Backlog priorizado]] |
| Revisar evidencia técnica | [[Fuentes y trazabilidad]] |

## Mapa de conocimiento

| Área | Notas |
| :--- | :--- |
| Reconstrucción greenfield | [[Plan maestro de reconstruccion]], [[Requerimientos funcionales greenfield]], [[Requerimientos no funcionales greenfield]], [[Historias de usuario greenfield]], [[Arquitectura objetivo greenfield]], [[Estrategia de pruebas greenfield]], [[Roadmap de reconstruccion]] |
| Fundamentos | [[Vision y propuesta de valor]], [[Metodo operativo]], [[Limites y contextos]] |
| Personas y gobierno | [[Actores y necesidades]], [[Matriz de permisos]], [[Organizaciones y membresias]], [[Equipos y responsabilidades]] |
| Proceso | [[Flujo integral]], [[Ingreso y triage]], [[Diagnostico y evaluacion]], [[Conversion y formalizacion]], [[Ciclo del proyecto]], [[Cierre y aprendizaje]] |
| Capacidades | [[Estandares y cobertura]], [[Planificacion y ejecucion]], [[Documentos y evidencia]], [[Portfolios y capacidad]], [[Redes y programas]], [[Comunicacion y experiencia]], [[IA e integraciones]], [[Planes y facturacion]] |
| Ingeniería | [[Arquitectura tecnica]], [[Modelo de dominio]], [[Contratos de API]], [[Eventos y tiempo real]], [[Seguridad y datos]], [[Experiencia por contexto]] |
| Calidad y operación | [[Calidad y pruebas]], [[Operacion y continuidad]], [[Metricas de producto]], [[Definicion de producto completo]] |
| Evolución | [[Estado actual y brechas]], [[Decisiones de diseno]], [[Backlog priorizado]], [[Hoja de ruta]], [[Casos de aceptacion]] |
| Uso cotidiano | [[Caso integral CREA]], [[Plantilla de iniciativa]], [[Plantilla de proyecto]], [[Plantilla de revision]], [[Plantilla de decision]], [[Plantilla de cierre]] |
| Referencias | [[Fuentes y trazabilidad]], [[Glosario]], [[Inventario de datos]], [[Inventario de rutas]], [[Inventario de pantallas]] |

## Convenciones de lectura

«Observado» significa que se encontró una estructura o comportamiento en el código inspeccionado. «Propuesto» define una regla de diseño recomendada. «Por verificar» señala que la inspección disponible no demuestra el comportamiento completo. Un endpoint presente no demuestra que la experiencia sea correcta, que esté desplegado o que haya sido validado.

Las tablas de permisos, metas de servicio, transiciones objetivo y prioridades son especificaciones propuestas. Los nombres técnicos actuales aparecen únicamente cuando ayudan a conectar la especificación con la implementación. El detalle de los límites de la revisión está en [[Fuentes y trazabilidad]].

Cada nota puede leerse de forma independiente y remite a sus relaciones. Para cambiar una regla, registrar una decisión en [[Plantilla de decision]], actualizar las notas afectadas y relacionarla con un caso de aceptación. No convertir una propuesta en «implementada» hasta disponer de evidencia.
