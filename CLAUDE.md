# FoilSpot v7

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (Leaflet) + tuuliennusteet
(FMI HARMONIE, Open-Meteo, FMI-havaintoasemat) yhdessä self-contained HTML-sivussa.

## Ajokomennot

```bash
npm install       # asenna riippuvuudet
npm run dev       # käynnistä Vite dev-serveri (http://localhost:5173)
npm run build     # tuota tuotantobuild hakemistoon dist/
npm run preview   # esikatsele tuotantobuildia paikallisesti
```

## Rakenne

- `index.html` — koko sovellus: CSS, HTML ja JS yhdessä tiedostossa (ei erillistä
  `src/`-hakemistoa). Leaflet ladataan CDN:stä `<script>`-tagilla.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  Kruunuvuorenselän ja Uiraan mittausdata -proxyt). Näitä ei ajeta Vite-devissä;
  frontend kutsuu niitä suoraan tuotanto-osoitteesta
  `https://foilwind.vercel.app/api/...` (katso `index.html`), joten `npm run dev`
  toimii sellaisenaan ilman paikallista API-serveriä.
- `vercel.json` — Vercel-deployn asetukset (build-komento, output-hakemisto,
  funktioiden aikakatkaisut ja rewrite-säännöt).

## Deploy

Sovellus on deployattu osoitteeseen `foilwind.vercel.app` Vercelin kautta.
Vercel ajaa `npm run build`:n ja julkaisee `dist/`-hakemiston sekä `api/`-funktiot.
