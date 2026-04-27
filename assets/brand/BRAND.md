# Track Brand Assets

Production-facing brand assets live here.

## Source References

- `source/track-logo-reference.png` - original horizontal logo screenshot reference.
- `source/track-mark-reference-padded.png` - original padded mark screenshot reference.
- `source/track-mark-reference-tight.png` - tight mark screenshot reference used to rebuild the SVG mark.

These files are references only. Do not use them directly in app or store surfaces.

## Masters

- `svg/track-mark.svg` - primary standalone mark.
- `svg/track-mark-reversed.svg` - standalone mark for dark surfaces.
- `svg/track-logo.svg` - horizontal logo.
- `svg/track-logo-reversed.svg` - horizontal logo on deep stone.
- `svg/track-app-icon.svg` - dark app icon master.
- `svg/track-favicon.svg` - favicon master.

## Palette

- Deep Stone: `#1b1917`
- Signal Yellow: `#f0b100`
- Warm White: `#faf7f2`
- Stone 200: `#e7e3de`
- Stone 500: `#8f8a83`
- Stone 700: `#3a3631`

## Generated Raster Assets

Generated files live in `raster/`.

Run:

```bash
node assets/brand/scripts/export-brand-assets.mjs
```

The export script renders from SVG masters and writes app icons, favicons, and logo PNGs. Re-run it after editing the SVG masters.
