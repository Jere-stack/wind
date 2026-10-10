/* ------------------------------------------------------------------
   Latausruudun maapallon mantereet: Natural Earth 1:110m land
   (public domain) yksinkertaistettuna ja tiiviisti koodattuna.

     node tools/maapallo.mjs              (tulostaa tilastot)
     node tools/maapallo.mjs --kirjoita   (vaihtaa index.html:n
                                           #lr-maa-lahde-lohkon sisällön)

   Latausruutu (docs/ui.md, "Latausruutu: maapallo") projisoi nämä
   ortografisesti selaimessa kerran, eikä niitä piirretä koskaan
   uudelleen — ne ovat staattinen SVG, ja kaikki liike on
   `transform`ia. Tiedosto on repossa valmiina, joten build ei tarvitse
   tätä eikä verkkoa.

   YKSINKERTAISTUS: Douglas–Peucker `TOL` astetta, ja renkaat joiden
   ala on alle `MIN_ALA` neliöastetta jäävät pois (110m:n pienet saaret
   olisivat pallon 380 px:n säteellä alle pikselin). Pallo on kaukana
   ja himmeä, joten tarkkuus on riittävä silmälle mutta ei kartaksi.

   KOODAUS: renkaat erotetaan merkillä ';', ja renkaan pisteet ovat
   kymmenesasteina (pituus, leveys) — ensimmäinen absoluuttisena,
   loput erotuksina edellisestä — base36-lukuina pilkuin eroteltuina.
   Erotukset ovat pieniä, joten tavallinen piste on 2–4 merkkiä.     */

import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const URL_NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_110m_land.geojson';
const TOL = 0.35;
const MIN_ALA = 1.5;

const r = await fetch(URL_NE);
if (!r.ok) throw new Error('Natural Earth: HTTP ' + r.status);
const ne = await r.json();

function dp(pts, tol) {
  if (pts.length < 3) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const pino = [[0, pts.length - 1]];
  while (pino.length) {
    const [a, b] = pino.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = Math.hypot(dx, dy) || 1e-9;
    let mx = -1, mi = -1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs(dy * (pts[i][0] - ax) - dx * (pts[i][1] - ay)) / L;
      if (d > mx) { mx = d; mi = i; }
    }
    if (mx > tol) { keep[mi] = 1; pino.push([a, mi], [mi, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}
/* Suljettu rengas (alku = loppu) jaetaan kaukaisimmasta pisteestä:
   kahden saman pisteen välinen jana on nollan pituinen, ja jokaisen
   pisteen etäisyys siitä olisi 0 — koko rengas putoaisi kahteen
   pisteeseen. */
function dpRengas(pts, tol) {
  let mi = 0, mx = -1;
  for (let i = 1; i < pts.length; i++) {
    const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]);
    if (d > mx) { mx = d; mi = i; }
  }
  if (mi <= 0) return pts;
  const a = dp(pts.slice(0, mi + 1), tol), b = dp(pts.slice(mi), tol);
  return a.concat(b.slice(1, -1));
}
function ala(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
    s += x1 * y2 - x2 * y1;
  }
  return Math.abs(s) / 2;
}

const renkaat = [];
for (const f of ne.features) {
  const g = f.geometry;
  const polyt = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  for (const p of polyt) for (const rengas of p) {
    if (ala(rengas) < MIN_ALA) continue;
    const s = dpRengas(rengas, TOL);
    if (s.length >= 4) renkaat.push(s);
  }
}
let pisteita = 0;
const koodi = renkaat.map(rg => {
  let px = 0, py = 0;
  const osat = [];
  for (const [lo, la] of rg) {
    const x = Math.round(lo * 10), y = Math.round(la * 10);
    osat.push((x - px).toString(36), (y - py).toString(36));
    px = x; py = y; pisteita++;
  }
  return osat.join(',');
}).join(';');

console.log(`renkaita ${renkaat.length}, pisteitä ${pisteita}, merkkejä ${koodi.length}`);

if (process.argv.includes('--kirjoita')) {
  const polku = join(dirname(fileURLToPath(import.meta.url)), '..', 'index.html');
  const html = readFileSync(polku, 'utf8');
  const re = /(<script type="text\/plain" id="lr-maa-lahde">)[\s\S]*?(<\/script>)/;
  if (!re.test(html)) throw new Error('index.html: #lr-maa-lahde puuttuu');
  writeFileSync(polku, html.replace(re, (m, a, b) => a + koodi + b));
  console.log('kirjoitettu index.html');
}
