# FoilSpot – oma pohjakartta

Orpo datahaara (aina yksi committi, pakkopäivitys). Sisältö tulee
`tools/pohjakartta.mjs`:stä (päähaara), ja sovellus lukee sen osoitteesta
`raw.githubusercontent.com/Jere-stack/wind/pohjakartta/` (`luettelo.json`
kertoo arkistot). Ks. docs/pohjakartta.md.

- `pohja-*.pmtiles` — OpenStreetMap-vektorilaatat (© OpenStreetMap contributors, ODbL; Protomaps)
- `rinne-*.pmtiles` — rinnevarjostus Mapzen Terrain Tiles -korkeusmallista (AWS Open Data)
- `fontit/` — Noto Sans -glyfit (SIL OFL), protomaps/basemaps-assets
