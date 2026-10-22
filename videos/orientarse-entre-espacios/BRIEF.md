---
workflow: general-video
flow: automation
storyboard: no
message: "Reconoce tu espacio activo y cambia entre espacios y organizaciones desde el menú lateral."
destination: "Centro de ayuda de AETHER, Primeros pasos"
aspect: "16:9"
language: "es"
audience: "Personas que comienzan a usar AETHER"
length: "36,25 segundos"
---

## Intent
El usuario pidió hacer el primer video de «Orientarse entre espacios» para ver cómo queda, después de autorizar la preparación del entorno. Se realiza una primera versión completa y renderizada para revisión.

## Decisions
Formato horizontal 1920×1080, 30 fps. Instrucciones en pantalla, sin voz ni música en esta primera versión. Identidad visual del producto. Cursor guiado, selección visible y pausas de lectura. Una demostración continua con estados sucesivos, sin cambios bruscos de cámara.

## Sources
Comportamiento y etiquetas de apps/web/src/components/WorkspaceContextSwitcher.tsx y su CSS; navegación de apps/web/src/app/dashboard/layout.tsx; docs/architecture/workspace-context.md. Interfaz recreada y ampliada para video. Datos ficticios. El navegador no tiene sesión iniciada; no es una grabación de una cuenta real.

## Scope
Reconocer el contexto; abrir el selector; cambiar entre espacios de una organización; acceder al selector de organizaciones y pasar al espacio personal. No enseña creación, administración ni permisos.

## Delivery
MP4 local, portada, subtítulos WebVTT opcionales y composición editable. El primer corte se revisa antes de integrarlo en el centro de ayuda.
