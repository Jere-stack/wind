/* ------------------------------------------------------------------
   Järvirasteri: onko 0,05°:n solmu järveä (Euroopan rajaus).

   Tuottaa `tools/jarvet.json`in, jota `api/_esoh.js` lukee aseman
   tagiin (`asemanTiedot`): maarasterissa (`tools/maat.json`) järvet ovat
   maata, joten IJsselmeerin, Bodenjärven ja Geneven rannan asemat olivat
   "sisämaa"-kerroksessa (oletuksena pois, lukema vasta z10:stä), ja
   Pampuksen spotti sai lähimmäksi asemakseen 40 km:n päässä olevan
   IJmuidenin eikä 6 km:n päässä olevaa Muidenia (docs/eurooppa.md, luku
   16). Erillinen tiedosto eikä bitti maarasterissa: maarasteri omistaa
   alueellisten mallien käyttöalueet (`tools/alueelliset.mjs`), eikä
   aseman tagi saa muuttaa niitä.

     node tools/jarvet.mjs            (kirjoittaa tools/jarvet.json)

   LÄHDE: Natural Earth 1:10m lakes (public domain). 1:50m ei tunne
   Gardaa eikä Comoa. Ajetaan käsin ja tiedosto on repossa, kuten
   maarasteri.

   MUOTO: { la0, lo0, askel, ni, nj, data } — sama ruudukko kuin
   maarasterissa (`RAJAUS`), `data` = base64(gzip(bittikartta)), bitti
   k = solmu k (rivit etelästä pohjoiseen) on järven sisällä.           */

import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_10m_lakes.geojson';
/* Sama ruudukko kuin `tools/maat.mjs`:n RAJAUS (sitä ei tuoda, koska
   maat.mjs hakee ja kirjoittaa tuontihetkellä). */
const RAJAUS = { la0: 26, la1: 76, lo0: -32, lo1: 46, askel: 0.05 };

const r = await fetch(URL_NE);
if (!r.ok) throw new Error('Natural Earth: HTTP ' + r.status);
const ne = await r.json();

const { la0, lo0, askel } = RAJAUS;
const ni = Math.round((RAJAUS.lo1 - lo0) / askel) + 1;
const nj = Math.round((RAJAUS.la1 - la0) / askel) + 1;
const bitit = new Uint8Array(Math.ceil(ni * nj / 8));

/* Parillisuussääntö monikulmiota kohti, kuten maarasterissa: reunat
   kaikista renkaista, joten saaret jäävät pois. */
function rasteroi(renkaat) {
  const reunat = [];
  let latMin = Infinity, latMax = -Infinity;
  for (const rengas of renkaat) {
    for (let k = 0; k < rengas.length - 1; k++) {
      const [x0, y0] = rengas[k], [x1, y1] = rengas[k + 1];
      if (y0 === y1) continue;
      reunat.push([x0, y0, x1, y1]);
      latMin = Math.min(latMin, y0, y1); latMax = Math.max(latMax, y0, y1);
    }
  }
  let n = 0;
  const j0 = Math.max(0, Math.ceil((latMin - la0) / askel)), j1 = Math.min(nj - 1, Math.floor((latMax - la0) / askel));
  for (let j = j0; j <= j1; j++) {
    const lat = la0 + j * askel, xs = [];
    for (const [x0, y0, x1, y1] of reunat) {
      if ((y0 <= lat && y1 > lat) || (y1 <= lat && y0 > lat)) xs.push(x0 + (lat - y0) / (y1 - y0) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - lo0) / askel)), i1 = Math.min(ni - 1, Math.floor((xs[k + 1] - lo0) / askel));
      for (let i = i0; i <= i1; i++) { const s = j * ni + i; bitit[s >> 3] |= 1 << (s & 7); n++; }
    }
  }
  return n;
}

let jarvia = 0, solmuja = 0;
for (const f of ne.features) {
  if (!f.geometry) continue;
  const monikulmiot = f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
    : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  for (const m of monikulmiot) {
    let ok = false;
    for (const [x, y] of m[0]) if (x >= lo0 && x <= RAJAUS.lo1 && y >= la0 && y <= RAJAUS.la1) { ok = true; break; }
    if (!ok) continue;
    const n = rasteroi(m);
    if (n) { jarvia++; solmuja += n; }
  }
}

const ulos = join(dirname(fileURLToPath(import.meta.url)), 'jarvet.json');
const gz = gzipSync(bitit, { level: 9 });
writeFileSync(ulos, JSON.stringify({
  lahde: 'Natural Earth 1:10m lakes (public domain)',
  la0, lo0, askel, ni, nj, data: gz.toString('base64'),
}));
console.log(`${jarvia} järveä solmuina, ${solmuja} solmua, ${ni} x ${nj}, ${(gz.length / 1024).toFixed(0)} kt gzip`);
