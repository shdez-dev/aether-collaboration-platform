# Orientarse entre espacios — AETHER

Primer corte de un tutorial de 36,25 segundos, 1920×1080 y 30 fps. En español, con instrucciones visuales y sin pista de audio.

## Archivos

- `renders/orientarse-entre-espacios.mp4`: video renderizado.
- `poster.png`: portada.
- `tutorial.es.vtt`: transcripción temporizada para un reproductor accesible.
- `index.html`: composición editable de Hyperframes, con fuentes, logo y GSAP locales.
- `build.mjs`: genera la composición y los subtítulos; requiere las dependencias existentes de `apps/web` y descarga las fuentes/GSAP solo si faltan.
- `BRIEF.md`, `STORYBOARD.md`, `design.md`: alcance, guion visual e identidad.

## Reproducir y editar

Desde esta carpeta:

```powershell
npx hyperframes preview --background --port 4567
```

El proyecto se abre en `http://localhost:4567/#project/orientarse-entre-espacios`.
Si se edita directamente `index.html` en Studio, no ejecutar `build.mjs` sin trasladar antes esos cambios al generador, porque lo regenera.

## Regenerar y exportar

```powershell
node build.mjs
npx hyperframes check
.\render.ps1
```

El script de render localiza FFmpeg en la instalación de Winget si la sesión todavía no tiene el PATH actualizado.

## Fidelidad y revisión

La interfaz es una recreación didáctica ampliada basada en el selector actual `WorkspaceContextSwitcher.tsx`, con los nombres de acciones y la secuencia organización/espacio del producto. Usa datos ficticios; la página de inicio de la demostración se simplifica para concentrar la atención en el selector. No accede ni modifica datos reales.

El tutorial muestra Diseño → Operaciones, luego Estudio Norte → Personal. La selección cambia el contexto y los proyectos visibles. Los textos y enlaces de creación/administración son de contexto, no forman parte de este recorrido.

Revisión: Hyperframes check pasa ejecución, layout, contraste y las aserciones de movimiento. Las advertencias estructurales de lint corresponden a la reutilización del logo y a las siete instrucciones de una única demostración continua. Se revisaron los fotogramas principales; los renderizados se conservan en la carpeta local `renders`, excluida de Git.

Todavía no se integra en el centro de ayuda de la aplicación: este primer corte permite revisar contenido y estilo antes de conectarlo al reproductor.
