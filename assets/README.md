# Original Atlyn Pareto icon

The icon is original project artwork: four descending pale bars and a rising gold cumulative line on a dark teal rounded square. It uses no stock icon, third-party font, or Microsoft logo.

- `icon.svg`: editable 20-unit vector source.
- `icon.png`: actual **20×20 RGBA PNG**, referenced by the visual manifest.
- `icon-128.png`: larger **128×128 RGBA PNG** for internal review/documentation.
- `icon-300.png`: larger **300×300 RGBA PNG** generated from the same source for listing/report assets.
- `generate-icons.mjs`: dependency-free local rasterizer using Node built-ins and `node:zlib`.

From the repository root:

```powershell
node assets\generate-icons.mjs
```

The generator reads the SVG's rectangles and round-cap polyline, supersamples their geometry, and writes PNG chunks with CRCs. It is a deliberately limited renderer for this original SVG, not a general SVG converter. No browser, external service, new dependency, global tool, or remote asset is involved. Output has no timestamps; the same Node/zlib version and source produce repeatable bytes. The script now emits 20×20, 128×128, and 300×300 PNGs and logs each file CRC32 for reproducibility checks.

If editing the SVG, keep within the renderer's supported shapes or update the renderer accordingly. Regenerate all PNGs and rebuild the package. The image is an icon, not a screenshot, certification badge, or evidence of a tested report. These private project assets do not carry a separate public license grant.
