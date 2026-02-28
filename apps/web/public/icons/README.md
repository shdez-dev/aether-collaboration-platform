# PWA Icons

This directory contains icons for the Progressive Web App (PWA) installation.

## Required Icons

The `manifest.json` expects the following icon sizes:

### Standard Icons (purpose: "any")

- 72x72
- 96x96
- 128x128
- 144x144
- 152x152
- 192x192 ⭐ (required minimum)
- 384x384
- 512x512 ⭐ (required minimum)

### Maskable Icons (purpose: "maskable")

- 192x192
- 512x512

## How to Generate Icons

### Option 1: Online Tool (Easiest)

1. Go to https://www.pwabuilder.com/imageGenerator
2. Upload a 512x512 PNG logo (with transparent background recommended)
3. Download the generated icons
4. Extract and place them in this `/public/icons/` directory

### Option 2: Using PWA Asset Generator (CLI)

```bash
npx @pwa/asset-generator [logo.svg|logo.png] public/icons --manifest public/manifest.json
```

### Option 3: Manual (Photoshop, Figma, etc.)

- Create a 512x512 source image
- Export at different sizes
- For maskable icons, keep important content within the "safe zone" (80% of the canvas)

## Design Guidelines

### Standard Icons

- Use your brand logo
- Can have padding/margins
- Works on any background color

### Maskable Icons

- Must fill the entire canvas
- Important content should be within 80% safe zone (centered 410x410 area)
- Will be masked into different shapes on different devices (circle, rounded square, etc.)

## Current Status

⚠️ **Icons not yet generated**

You need to:

1. Create or provide a logo (512x512 PNG recommended)
2. Generate icons using one of the methods above
3. Place them in this directory

## Quick Start Icons (Placeholder)

For development, you can use a simple colored square as placeholder:

```bash
# Create a simple blue square icon (requires ImageMagick)
convert -size 512x512 xc:#3B82F6 icon-512x512.png
convert icon-512x512.png -resize 192x192 icon-192x192.png
```

Or use an online tool like https://favicon.io/favicon-generator/
