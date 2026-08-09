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
  Kruunuvuorenselän ja Uiraan mittausdata -proxyt). ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
- `vite.config.js` — build-asetukset sekä `vercel-api-dev`-plugin, joka ajaa
  `api/*.js`-funktiot myös `npm run dev`- ja `npm run preview` -servereissä.
  Muutokset api-tiedostoihin näkyvät ilman dev-serverin uudelleenkäynnistystä.
- `vercel.json` — Vercel-deployn asetukset (build-komento, output-hakemisto,
  funktioiden aikakatkaisut ja rewrite-säännöt).

## Rantaviivan korostus (CoastShade)

`index.html`:ssä oleva `CoastShade` piirtää liu'un veden ja maan rajaan, koska
pohjakartalla ne erottuvat huonosti: CARTO `dark_nolabels` piirtää maan
harmaalla 9 ja veden 36–38, eli ero on vain 11 % kirkkausasteikosta.

Muutamia asioita jotka eivät ole ilmeisiä koodia lukiessa:

- **Geometria tulee pohjakartan omista pikseleistä**, ei erillisestä
  rantaviiva-aineistosta. Suomen saaristossa on kymmeniä tuhansia saaria,
  joten riittävän tarkka vektoriaineisto olisi kymmeniä megatavuja. Laatat
  ovat jo selaimessa, ja `crossOrigin` tekee niiden pikseleistä luettavia.
  Siksi varjo ei voi koskaan olla sivussa rannasta.
- **Se on `L.GridLayer`**, ei yksi näkymän kokoinen overlay. Overlay venyi
  zoomatessa ja luki silmässä toisena karttana.
- **Se on lämpökartan PÄÄLLÄ** (oma pane, z-index 450). Alempaa mitattuna se
  hävisi käytännössä kokonaan: lämpökartan `mix-blend-mode: screen` vaimentaa
  alleen jäävän kontrastin kertoimella (1 − päällyskerros), mikä on tässä
  17–46-kertainen vaimennus.
- **Laskenta odottaa eleen loppua** (`_busy`) ja tehdään aikabudjetilla
  (`_drain`). Suoraan kesken nipistyksen ajettuna 15 laattaa vei ruutuajan
  p95:n 45 ms:stä 110 ms:ään.
- **Tasot ristihäivytetään itse** (`_flush`). Leafletin oma häivytys pitää
  vanhan tason täydessä kirkkaudessa, jolloin läpinäkyvä varjo piirtyy
  kahdesti ja kartta välähtää tummempana.
- **`_sweep()` on vahtikoira.** Laatta joka jää Leafletin kirjanpidossa
  lataamattomaksi on `visibility:hidden`, eli varjo puuttuu siitä kohtaa.
  Sen sijaan että luotettaisiin jokaisen polun muistavan kutsua `done()`,
  taso käydään läpi eleen jälkeen ja puuttuvat viimeistellään.
- **Älä laita Leafletin eläviä laattaelementtejä välimuistiin.** Leaflet
  asettaa poistetun laatan `src`:ksi 1×1 läpinäkyvän kuvan, jolloin niistä
  piirtyy tyhjää ja varjo katoaa. `_usable()` tarkistaa koon.

Kytkin A/B-vertailuun: `?perf=1` → "Rantaviiva".

## API-osoitteet

Frontend käyttää vakiota `API_BASE = '/api'` (`index.html`), eli funktiot
haetaan aina samasta originista kuin sivu — niin tuotannossa kuin devissä.
Koodissa ei ole yhtään absoluuttista host-osoitetta omaan palveluun, joten
sivu ja API ovat aina samaa versiota eikä projekti riipu mistään erikseen
deployatusta ympäristöstä.

## Deploy

Vercel ajaa `npm run build`:n ja julkaisee `dist/`-hakemiston sekä
`api/`-funktiot. Deployn tulee tapahtua tästä reposta, jotta sivu ja sen
`/api`-funktiot pysyvät samassa versiossa.
