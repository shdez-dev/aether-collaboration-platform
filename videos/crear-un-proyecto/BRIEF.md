---
workflow: general-video
flow: automation
storyboard: no
message: "Crear un proyecto en un espacio de equipo: describir el problema, su impacto y la propuesta; elegir el enfoque y crear el proyecto."
destination: "Centro de ayuda de AETHER, Primeros pasos"
aspect: "16:9"
language: "es"
audience: "Personas que comienzan a usar AETHER"
length: "45,625 segundos"
---

## Intent

Segundo tutorial de la serie iniciada con «Orientarse entre espacios». El usuario pidió continuar con «Crear un proyecto» reutilizando el estilo y la plantilla para reducir trabajo y consumo. Se entrega un video completo en la misma identidad visual y listo para el centro de ayuda.

## Decisions

1920×1080, 30 fps. Instrucciones en pantalla, sin voz ni música, igual que el primer tutorial. Una interfaz persistente y un cursor guiado muestran el flujo de cuatro pasos. Datos ficticios. Se usa el enfoque Flexible; Scrum y Trazabilidad avanzada se muestran como opciones, sin sugerir que sean obligatorios.

## Sources

`apps/web/src/components/CreateProjectModal.tsx`, `ProjectProposalFields.tsx`, `ProjectMethodologyStep.tsx` y el acceso «+» de Proyectos en `apps/web/src/app/dashboard/layout.tsx`. Diseño y recursos locales del video `videos/orientarse-entre-espacios`.

## Scope

El recorrido se sitúa en un espacio de equipo. Se pulsa «+» junto a Proyectos; se completa Contexto, Impacto, Propuesta y Equipo y enfoque; se crea un proyecto de ejemplo. La interfaz es una recreación didáctica del flujo actual y no accede a datos reales.

## Delivery

MP4 local, portada, subtítulos WebVTT opcionales y composición editable. Integración en «Crear un proyecto» del centro de ayuda.
