# Marca de Agua del Ciempiés y Scroll Indicator

## Cambios Realizados - 2026-02-09

### 1. ✅ Indicador "Explorar" Reposicionado

**Cambio:** Bajado el indicador de scroll en el Hero Section

**Antes:**

```tsx
className = 'absolute bottom-10 left-1/2 transform -translate-x-1/2';
```

**Ahora:**

```tsx
className = 'absolute bottom-20 left-1/2 transform -translate-x-1/2';
```

**Motivo:** El indicador estaba demasiado arriba. Ahora tiene más espacio respecto al contenido.

**Archivo modificado:** `apps/web/src/components/home/HeroSection.tsx`

---

### 2. ✅ Marca de Agua: Ciempiés SVG Detallado

**Nuevo componente creado:** `CentipedeWatermark.tsx`

#### Características del Ciempiés:

**Diseño:**

- 10 segmentos corporales con degradado de opacidad
- Cabeza con antenas y ojos
- 20 patas (10 por lado) distribuidas uniformemente
- Líneas de segmentación para mayor detalle
- Cola al final

**Propiedades Visuales:**

- **Tamaño:** 80x40px (compacto pero visible)
- **Opacidad inicial:** 20% (semi-transparente)
- **Hover:** Aumenta a 40% y escala 1.1x
- **Color:** Usa `text-accent` (azul del tema AETHER)
- **Posición:** Esquina inferior derecha del footer

**Animaciones:**

- Fade-in desde la derecha al hacer scroll
- Efecto hover suave con transición
- Escala ligeramente al pasar el mouse

#### Código del SVG:

```tsx
'use client';

import { motion } from 'framer-motion';

export function CentipedeWatermark() {
  return (
    <motion.svg
      width="80"
      height="40"
      viewBox="0 0 160 80"
      className="opacity-20 hover:opacity-40 transition-opacity"
      initial={{ opacity: 0, x: 20 }}
      whileInView={{ opacity: 0.2, x: 0 }}
      whileHover={{ opacity: 0.4, scale: 1.1 }}
    >
      {/* 10 segmentos + cabeza + antenas + patas */}
    </motion.svg>
  );
}
```

**Archivo creado:** `apps/web/src/components/home/CentipedeWatermark.tsx`

---

### 3. ✅ Integración en el Footer

**Posicionamiento:**

```tsx
<div className="absolute bottom-4 right-4 z-10">
  <CentipedeWatermark />
</div>
```

**Ubicación:**

- Esquina inferior derecha
- 4 unidades de separación desde abajo y derecha
- z-index 10 para estar sobre los elementos decorativos de fondo
- Semi-oculto (20% opacidad) pero visible al pasar el mouse

**Archivo modificado:** `apps/web/src/components/home/Footer.tsx`

---

## Estructura Visual del Ciempiés

```
     Antenas
        /  \
       /    \
    ╭────╮  ← Cabeza (con ojos)
    │ ●● │
    ╰────╯
     ╱  ╲  ← Patas
    ╱    ╲
  ╭──────╮ ← Segmento 1
  │      │
  ╰──────╯
   ╱    ╲
  ╱      ╲
╭────────╮ ← Segmento 2
│        │
╰────────╯
    ...
  (8 segmentos más)
    ...
   ╭──╮ ← Cola
   │  │
   ╰──╯
```

## Detalles Técnicos

### Anatomía del SVG:

1. **Cabeza (ellipse):**
   - Posición: x=145, y=40
   - Radio: 12x10
   - Color: accent

2. **Antenas (paths):**
   - 2 curvas cuadráticas desde la cabeza
   - Stroke width: 1.5px
   - Caps redondeados

3. **Ojos (circles):**
   - 2 círculos blancos de radio 1.5px
   - Posición: y=38 e y=42

4. **Segmentos (10 ellipses):**
   - Degradado de tamaño: 10px → 5px
   - Degradado de opacidad: 95% → 50%
   - Separados uniformemente

5. **Patas (20 paths):**
   - 10 arriba, 10 abajo
   - Stroke width: 1.2px
   - Caps redondeados
   - Opacidad: 80%

6. **Líneas de segmentación:**
   - 8 líneas verticales entre segmentos
   - Stroke width: 0.5px
   - Color: background
   - Opacidad: 30%

### Responsividad:

- El SVG mantiene su tamaño en todas las resoluciones
- Posición absoluta respecto al footer
- Visible en desktop y mobile

### Accesibilidad:

- No interfiere con el contenido principal
- Semi-transparente por defecto
- Se puede hacer clic a través de él (pointer-events heredado)

---

## Personalización

### Cambiar Tamaño:

```tsx
<motion.svg
  width="100" // Más grande
  height="50"
  // ...
/>
```

### Cambiar Color:

El ciempiés usa `className="text-accent"`, que hereda el color del tema.

Para cambiar:

```tsx
// Opción 1: Cambiar a otro color del tema
className = 'text-purple-500';

// Opción 2: Color fijo
fill = '#3B82F6';
```

### Cambiar Opacidad:

```tsx
// Inicial
className = 'opacity-30 hover:opacity-60';

// Más visible
className = 'opacity-40 hover:opacity-80';

// Más sutil
className = 'opacity-10 hover:opacity-30';
```

### Cambiar Posición:

```tsx
// Centro inferior
<div className="absolute bottom-4 left-1/2 -translate-x-1/2">

// Esquina inferior izquierda
<div className="absolute bottom-4 left-4">

// Más arriba
<div className="absolute bottom-8 right-4">
```

---

## Archivos Afectados

### Nuevos:

1. `apps/web/src/components/home/CentipedeWatermark.tsx` - Componente del ciempiés

### Modificados:

1. `apps/web/src/components/home/HeroSection.tsx` - Scroll indicator bajado
2. `apps/web/src/components/home/Footer.tsx` - Ciempiés integrado

---

## Testing

### Checklist de Verificación:

- [ ] El indicador "Explorar" está más abajo (bottom-20 en lugar de bottom-10)
- [ ] El ciempiés aparece en la esquina inferior derecha del footer
- [ ] El ciempiés es semi-transparente (20% opacidad)
- [ ] Al hacer hover, el ciempiés se hace más visible (40%) y escala
- [ ] El ciempiés tiene 10 segmentos visibles
- [ ] Se ven las antenas en la cabeza
- [ ] Se ven los ojos (2 puntos blancos)
- [ ] Las patas están distribuidas en ambos lados
- [ ] El color coincide con el accent del tema (azul)
- [ ] La animación de entrada funciona (fade desde la derecha)

### Para Ver los Cambios:

```bash
pnpm dev
```

Abrir: `http://localhost:3000`

- Hacer scroll hasta el footer
- Pasar el mouse sobre el ciempiés
- Verificar que aparece con animación

---

## Easter Egg

El ciempiés es tu **marca de agua personal**. Es:

- ✨ Sutil pero presente
- 🎨 Profesional y creativo
- 🔍 Un detalle que demuestra atención
- 🎯 Único y memorable

Perfecto para un portafolio que quiere destacar con pequeños detalles que hacen la diferencia.

---

## Notas de Diseño

### ¿Por qué un ciempiés?

1. **Representa código:** Múltiples segmentos = módulos/componentes
2. **Movimiento continuo:** Como el flujo de eventos en AETHER
3. **Estructura segmentada:** Como la arquitectura de microservicios
4. **Atención al detalle:** Cada pata/segmento está cuidadosamente posicionado

### Filosofía:

> "Los grandes portafolios no solo muestran lo que haces,  
> sino **cómo piensas** a través de los pequeños detalles."

El ciempiés es ese detalle que diferencia un portafolio bueno de uno memorable.
