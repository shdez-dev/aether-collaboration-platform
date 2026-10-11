---
name: AETHER — páginas públicas
description: Sistema visual de la portada pública «El hilo visible»
colors:
  violet-action: "#A885DD"
  ink: "#191522"
  paper: "#F4EFF8"
  quiet: "#DAD0E2"
typography:
  display:
    fontFamily: "Bricolage Grotesque, Manrope, sans-serif"
    fontSize: "clamp(4.1rem, 6.8vw, 6rem)"
    fontWeight: 700
    lineHeight: 0.99
    letterSpacing: "-.035em"
  headline:
    fontFamily: "Bricolage Grotesque, Manrope, sans-serif"
    fontSize: "clamp(2.7rem, 5.2vw, 5.2rem)"
    fontWeight: 700
    lineHeight: 1.04
    letterSpacing: "-.035em"
  title:
    fontFamily: "Bricolage Grotesque, Manrope, sans-serif"
    fontSize: "clamp(1.35rem, 2.1vw, 2.1rem)"
    fontWeight: 650
    lineHeight: 1.1
    letterSpacing: "-.02em"
  body:
    fontFamily: "Manrope, sans-serif"
    fontSize: "17px"
    lineHeight: 1.7
  label:
    fontFamily: "Manrope, sans-serif"
    fontSize: "11px"
    fontWeight: 800
rounded:
  square: "0px"
spacing:
  page-gutter: "clamp(22px, 5vw, 70px)"
components:
  action-primary:
    backgroundColor: "{colors.violet-action}"
    textColor: "{colors.ink}"
    rounded: "{rounded.square}"
    padding: "0 19px 0 23px"
  action-nav:
    backgroundColor: "transparent"
    textColor: "{colors.paper}"
    rounded: "{rounded.square}"
    padding: "0 17px"
---

# Design System: AETHER — páginas públicas

## Overview

**Creative North Star: "El hilo visible"**

Este documento describe el lenguaje visual implementado en la portada pública de AETHER y orienta futuras páginas públicas de marketing. Su autoridad termina en ese ámbito: las pantallas de aplicación, el dashboard y la autenticación tienen sistemas y necesidades de uso propios. Los tokens de arriba se extraen del contenedor de la portada; no son tokens globales de `apps/web`.

La continuidad se dibuja con líneas, nodos y registros ordenados por reglas. La composición se siente editorial y deliberada: titulares grandes, espacio amplio, geometría plana y una alternancia clara entre fondo oscuro y papel claro. La demostración se identifica como ilustrativa y representa el paso de una propuesta a una decisión y a un proyecto; la forma visual ayuda a seguir esa relación.

**Key Characteristics:**

- Cuatro tintas y ningún degradado en la portada actual.
- Tipografía expresiva para titulares y lectura sobria para texto y controles.
- Líneas, divisores y nodos que explican relaciones o estados.
- Superficies planas, bordes rectos y cero sombras decorativas.

## Colors

El contraste entre berenjena y papel lavanda organiza la lectura; el violeta señala acciones y conexiones.

### Primary

- **Violeta de acción** (`violet-action`): rellena la acción principal, traza el recorrido y marca nodos, números y estados activos.

### Neutral

- **Berenjena de fondo** (`ink`): base oscura de la portada y texto principal sobre las secciones claras.
- **Papel lavanda** (`paper`): texto principal sobre berenjena y fondo de la sección que enseña el contexto de un proyecto.
- **Lavanda tenue** (`quiet`): texto secundario sobre berenjena; conserva jerarquía sin introducir otra familia cromática.

**The Four Inks Rule.** Las nuevas páginas públicas que sigan esta portada parten de estas cuatro tintas. Las líneas translúcidas se mezclan a partir de ellas, sin añadir un quinto color decorativo.

## Typography

**Display Font:** Bricolage Grotesque, con Manrope y sans-serif de respaldo.

**Body Font:** Manrope, con sans-serif de respaldo.

**Character:** Bricolage da una voz amplia y compacta a las ideas principales. Manrope sostiene párrafos, navegación, ejemplos y controles con una lectura más tranquila.

### Hierarchy

- **Display** (`display`): titular de apertura, a gran escala y con interletrado compacto.
- **Headline** (`headline`): encabezados de secciones y cierre.
- **Title** (`title`): nombres de capacidades y estaciones del recorrido; su tamaño se ajusta al contexto.
- **Body** (`body`): explicación de cada sección; los textos introductorios se mantienen en columnas de lectura moderadas.
- **Label** (`label`): rótulos breves, números y encabezados del ejemplo; la implementación usa tamaños de 11 a 13 px según su lugar.

**The Two Voices Rule.** Los titulares y los títulos de contenido usan Bricolage Grotesque; la navegación, los controles y la lectura continua usan Manrope. No incorporar Inter a esta expresión pública.

## Layout

La portada tiene una anchura máxima de 1440 px en navegación y apertura, y de 1300 px en bloques de contenido. El margen horizontal sigue `page-gutter`. Los titulares ocupan una columna dominante y el texto auxiliar se limita a una anchura más cómoda. Las secciones alternan superficies oscuras y claras, separadas por espacio y reglas visibles.

El recorrido de tres etapas distribuye estaciones desiguales sobre una línea horizontal. Bajo 600 px se convierte en una secuencia vertical con la línea al lado; el detalle seleccionado pasa a una sola columna. Bajo 880 px, los encabezados de dos columnas y las capacidades se apilan. Los cortes responden a la legibilidad del contenido, no a una retícula fija de tarjetas.

**The Ruled Layout Rule.** Una línea o un divisor debe ayudar a seguir una secuencia, separar información o mostrar una relación. La geometría no es un patrón de fondo.

## Elevation & Depth

El sistema público es plano. No hay sombras de tarjeta ni superficies flotantes en la implementación actual. La profundidad se construye mediante la alternancia entre `ink`, `paper` y `violet-action`, el espaciado, los trazos y los cambios de estado.

## Shapes

La silueta es recta (`square`): botones y registros sin esquinas redondeadas. Los nodos del recorrido y las marcas de capacidades son cuadrados girados 45 grados. El símbolo de marca conserva su construcción geométrica de puntos conectados; las líneas y los rombos tienen función de orientación, estado o identidad.

## Components

### Primary action

Enlace rectangular con relleno violeta, texto berenjena y flecha. La altura mínima observada es de 51 px. Al pasar el puntero, el relleno se vuelve papel y el control sube 2 px; el foco visible usa un contorno violeta de 2 px desplazado 5 px. En el cierre violeta se invierten los colores: base berenjena y texto papel.

### Secondary action and navigation

La acción secundaria es un enlace de texto subrayado en violeta. La navegación es delgada, delimitada por una regla inferior; sus enlaces tenues aclaran y se subrayan al pasar el puntero. La acción de navegación es rectangular, contorneada en violeta y de al menos 44 px de alto. Bajo 880 px se ocultan los enlaces centrales, mientras se mantienen marca y acceso.

### Journey stages

Tres botones de texto ocupan posiciones desiguales sobre un trazado continuo. Cada uno tiene número, nombre, subtítulo y nodo romboidal. La etapa seleccionada rellena su nodo y actualiza un detalle textual marcado como ejemplo ilustrativo. El hover introduce una tintura violeta tenue; `aria-pressed` y el foco visible comunican el estado más allá del color.

### Example record and capability rows

El ejemplo de proyecto se organiza como un registro de dos columnas con reglas horizontales y una división vertical; en móvil se vuelve una sola columna. La lista de capacidades usa filas anchas con divisor, rombo, título y explicación. Estas piezas parecen información conectada, no tarjetas independientes.

## Do's and Don'ts

### Do:

- **Do** aplicar este sistema solo a superficies públicas de marketing que adopten «El hilo visible».
- **Do** usar las cuatro tintas, los dos tipos y las reglas para mostrar relaciones verificables entre conceptos.
- **Do** etiquetar los ejemplos conceptuales como ilustrativos y mantener a equipos y organizaciones como público principal.
- **Do** conservar el foco visible y una lectura clara cuando el recorrido se apile en móvil.

### Don't:

- **Don't** trasladar estos tokens o componentes a la aplicación, el dashboard o los formularios de autenticación por defecto.
- **Don't** añadir degradados genéricos, tarjetas SaaS redondeadas, sombras decorativas ni Inter a este lenguaje público.
- **Don't** representar las líneas y los nodos como adorno desconectado del contenido o el estado.
- **Don't** insinuar métricas, clientes, testimonios o precios no verificados mediante la composición visual.
