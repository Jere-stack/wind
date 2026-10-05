/* ------------------------------------------------------------------
   Maarasteri: valtio jokaiselle 0,05°:n solmulle Euroopassa.

   Tuottaa `tools/maat.json`in, jota säälaattojen rakentaja lukee
   alueellisten mallien KÄYTTÖALUEISIIN (docs/eurooppa.md, S1): laaja
   malli (UKV, DINI, MET Nordic) ei saa reunavyöhykkeellään ohittaa
   toisen maan omaa mallia. Rasteri ajetaan käsin ja tiedosto on
   repossa, jottei rakennus riipu Natural Earthin saatavuudesta.

     node tools/maat.mjs            (kirjoittaa tools/maat.json)

   LÄHDE: Natural Earth 1:50m admin 0 (public domain). Maakoodi on
   `ISO_A2_EH` (Ranskalla ja Norjalla `ISO_A2` on -99 merentakaisten
   alueiden takia), varalla `ISO_A2` ja `ADM0_A3`.

   MERI KUULUU LÄHIMMÄLLE RANNIKKOMAALLE 150 km:iin asti. Spotit ovat
   rannalla ja niiden tuuli tulee mereltä, joten Tanskan salmet ovat
   Tanskan mallin ja Englannin kanaalin brittipuoli UKV:n aluetta.
   Etäisyys on kaksivaiheinen chamfer-muunnos kilometreinä (pituusaste
   leveyden kosinilla), eli raja on likimain keskiviiva. Kauempana on
   avomeri (koodi 0).

   MUOTO: { la0, lo0, askel, ni, nj, koodit, data } missä `data` on
   base64(gzip(Uint8Array ni*nj)), rivit etelästä pohjoiseen. Tavu on
   koodin indeksi + 1 (0 = avomeri), ja bitti 0x80 kertoo että solmu on
   maata.                                                               */

import { gzipSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
export const RAJAUS = { la0: 26, la1: 76, lo0: -32, lo1: 46, askel: 0.05 };
const MERI_KM = 150;

const r = await fetch(URL_NE);
if (!r.ok) throw new Error('Natural Earth: HTTP ' + r.status);
const ne = await r.json();

const { la0, lo0, askel } = RAJAUS;
const ni = Math.round((RAJAUS.lo1 - lo0) / askel) + 1;
const nj = Math.round((RAJAUS.la1 - la0) / askel) + 1;
const koodi = new Uint8Array(ni * nj);           /* 0 = ei maata vielä */
const koodit = [];

function koodiOf(p) {
  for (const k of ['ISO_A2_EH', 'ISO_A2', 'ADM0_A3']) {
    const v = p[k];
    if (typeof v === 'string' && /^[A-Z]{2,3}$/.test(v)) return v;
  }
  return null;
}

/* Parillisuussääntö per monikulmio (reunat kaikista renkaista, jolloin
   reiät jäävät pois). Solmu on maata jos sen keskipiste on sisällä. */
function rasteroi(renkaat, ki) {
  const reunat = [];
  let latMin = Infinity, latMax = -Infinity;
  for (const r of renkaat) {
    for (let k = 0; k < r.length - 1; k++) {
      const [x0, y0] = r[k], [x1, y1] = r[k + 1];
      if (y0 === y1) continue;
      reunat.push([x0, y0, x1, y1]);
      latMin = Math.min(latMin, y0, y1); latMax = Math.max(latMax, y0, y1);
    }
  }
  const j0 = Math.max(0, Math.ceil((latMin - la0) / askel)), j1 = Math.min(nj - 1, Math.floor((latMax - la0) / askel));
  for (let j = j0; j <= j1; j++) {
    const lat = la0 + j * askel, xs = [];
    for (const [x0, y0, x1, y1] of reunat) {
      if ((y0 <= lat && y1 > lat) || (y1 <= lat && y0 > lat)) xs.push(x0 + (lat - y0) / (y1 - y0) * (x1 - x0));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const i0 = Math.max(0, Math.ceil((xs[k] - lo0) / askel)), i1 = Math.min(ni - 1, Math.floor((xs[k + 1] - lo0) / askel));
      for (let i = i0; i <= i1; i++) koodi[j * ni + i] = ki;
    }
  }
}

for (const f of ne.features) {
  const k = koodiOf(f.properties || {});
  if (!k || !f.geometry) continue;
  const monikulmiot = f.geometry.type === 'Polygon' ? [f.geometry.coordinates]
    : f.geometry.type === 'MultiPolygon' ? f.geometry.coordinates : [];
  let ki = koodit.indexOf(k) + 1;
  for (const m of monikulmiot) {
    /* Nopea hylkäys rajauksen ulkopuolella. */
    let ok = false;
    for (const [x, y] of m[0]) if (x >= lo0 - 1 && x <= RAJAUS.lo1 + 1 && y >= la0 - 1 && y <= RAJAUS.la1 + 1) { ok = true; break; }
    if (!ok) continue;
    if (!ki) { koodit.push(k); ki = koodit.length; }
    rasteroi(m, ki);
  }
}
if (koodit.length > 127) throw new Error('liikaa maita: ' + koodit.length);

/* Meri lähimmälle maalle: chamfer kahdessa suunnassa, kilometreinä. */
const dist = new Float32Array(ni * nj).fill(Infinity), lahin = new Uint8Array(ni * nj);
const maa = new Uint8Array(ni * nj);
for (let k = 0; k < ni * nj; k++) if (koodi[k]) { dist[k] = 0; lahin[k] = koodi[k]; maa[k] = 1; }
const dyKm = askel * 111.2;
const dxKm = (j) => askel * 111.2 * Math.cos((la0 + j * askel) * Math.PI / 180);
const kokeile = (k, kn, d) => { const v = dist[kn] + d; if (v < dist[k]) { dist[k] = v; lahin[k] = lahin[kn]; } };
for (let j = 0; j < nj; j++) {
  const dx = dxKm(j), dd = Math.hypot(dx, dyKm);
  for (let i = 0; i < ni; i++) {
    const k = j * ni + i;
    if (i > 0) kokeile(k, k - 1, dx);
    if (j > 0) { kokeile(k, k - ni, dyKm); if (i > 0) kokeile(k, k - ni - 1, dd); if (i < ni - 1) kokeile(k, k - ni + 1, dd); }
  }
}
for (let j = nj - 1; j >= 0; j--) {
  const dx = dxKm(j), dd = Math.hypot(dx, dyKm);
  for (let i = ni - 1; i >= 0; i--) {
    const k = j * ni + i;
    if (i < ni - 1) kokeile(k, k + 1, dx);
    if (j < nj - 1) { kokeile(k, k + ni, dyKm); if (i < ni - 1) kokeile(k, k + ni + 1, dd); if (i > 0) kokeile(k, k + ni - 1, dd); }
  }
}
const data = new Uint8Array(ni * nj);
let merta = 0, avomerta = 0;
for (let k = 0; k < ni * nj; k++) {
  if (maa[k]) { data[k] = 0x80 | koodi[k]; continue; }
  if (dist[k] <= MERI_KM) { data[k] = lahin[k]; merta++; } else avomerta++;
}

const ulos = join(dirname(fileURLToPath(import.meta.url)), 'maat.json');
const gz = gzipSync(data, { level: 9 });
writeFileSync(ulos, JSON.stringify({
  lahde: 'Natural Earth 1:50m admin 0 (public domain), meri lähimmälle maalle ' + MERI_KM + ' km',
  la0, lo0, askel, ni, nj, koodit, data: gz.toString('base64'),
}));
console.log(`${koodit.length} maata, ${ni} x ${nj} solmua, maata ${maa.reduce((a, b) => a + b, 0)}, `
  + `rannikkomerta ${merta}, avomerta ${avomerta}, ${(gz.length / 1024).toFixed(0)} kt gzip`);
