#!/usr/bin/env node
/* EUROOPAN HAVAINTOJEN HISTORIA VARASTOON — MeteoGate E-SOH
 * (docs/eurooppa.md, luku 14).
 *
 *   node tools/esoh.mjs <hakemisto>
 *
 * MIKSI. E-SOH säilyttää havainnot VUOROKAUDEN (vanhempi jakso vastaa
 * 404:llä). Aikajanan menneisyys on 48 h ja asemakortin 168 h, joten
 * ilman omaa kopiota Euroopan aseman pilleri olisi "—" kaikilla yli
 * vuorokauden vanhoilla tunneilla, ja kortti näyttäisi vain vuorokauden.
 * Kartta lukee tunnin lukemaa (`_histValueAt`), joten talteen kerätään
 * TASATUNNIN NÄYTE jokaiselta asemalta, ei kymmenen minuutin sarjaa.
 *
 * MITEN. Sama työnkulku kuin Mellstenillä ja Larulla
 * (.github/workflows/havainnot.yml), oma askel `continue-on-error`illa:
 * E-SOH:n vika ei saa estää Mellstenin rivien julkaisua. Joka ajolla:
 *
 *   1. Tasatunnit jotka ovat 3–24 h vanhoja ja joita varastossa ei vielä
 *      ole (`esoh/tila.json`), vanhin ensin: se putoaa lähteestä
 *      ensimmäisenä. Kolme tuntia, koska tuntiasemien rivit tulevat
 *      lähteeseen viiveellä, ja tuoreemmat tunnit proxy hakee lähteestä
 *      itse. Enintään `MAX_TUNTEJA` ajoa kohti; loput seuraavalla.
 *   2. Jokaiselle tunnille YKSI koko Euroopan kysely ([H − 10 min,
 *      H + 5 min]; mitattuna 3,5 s, 7 MB, ~3 000 asemaa) ja aseman
 *      tunnin näyte samalla säännöllä kuin proxyn laatassa
 *      (`tunninNayte`, `asemanRivit`: parametrien etusija, puuska
 *      aseman tahdin mukaan).
 *   3. Yli `SAILYTYS_PV` vanhat päivät poistetaan.
 *
 * VÄLIIN JÄÄNYT AJO EI JÄTÄ AUKKOA niin kauan kuin jokin ajo osuu
 * vuorokauden sisään: puuttuvat tunnit haetaan lähteen ikkunasta.
 * GitHubin ajastin jättää tunteja väliin (docs/data.md, "Katkot pois"),
 * mutta ei vuorokautta.
 *
 * VARASTO (orpo haara `havainnot`):
 *
 *   esoh/<UTC-päivä>/<x>_<y>.json   laatta 4° × 4° (sama jako kuin
 *                                   `?eu=laatta`): { wigos: { "HH": [ws, wg, wd] } }
 *   esoh/tila.json                  käsitellyt tunnit ja viimeisin ajo
 *   esoh/asemat.json                kaukopisteiden luettelo (`?eu=asemat`):
 *                                   { wigos: [lat, lng, meri, UTC-päivä] }
 *
 * Kaikki asemat talletetaan, myös Suomen rekisterin kopiot: proxy jättää
 * ne pois laatasta, ja varasto pysyy riippumattomana rekisteristä.
 *
 * Vain Noden omia moduuleita: työnkulku ei aja `npm ci`:tä. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { haeAlue, jasenna, asemanRivit, tunninNayte, laattaKohdassa, laatanAvain, asemanTiedot, ASEMALUETTELO, TUULI_PARAMETRIT, r1, r0 } from '../api/_esoh.js';

/* Euroopan rajaus. Koko maailman monikulmio vastaa 500:lla (mitattu),
   ja luettelon asemista 3 428 / 3 516 on tämän sisällä. */
const EUROOPPA = { w: -32, s: 27, e: 45, n: 72 };
const SAILYTYS_PV = 8;
const VALMIS_H = 3;
const MAX_TUNTEJA = 10;
const AIKARAJA_MS = 30000;
/* Koko osan aikaraja: työnkulun askeleen katto on 4 min. */
const BUDJETTI_MS = 150000;

const hakemisto = process.argv[2];
if (!hakemisto) { console.error('käyttö: node tools/esoh.mjs <hakemisto>'); process.exit(2); }
const juuri = join(hakemisto, 'esoh');
mkdirSync(juuri, { recursive: true });
const rivit = [];
const kerro = (s) => rivit.push(s);
const iso = (ms) => new Date(ms).toISOString().slice(0, 13) + ':00Z';

let tila = {};
try { tila = JSON.parse(readFileSync(join(juuri, 'tila.json'), 'utf8')); } catch (e) { tila = {}; }
const tehdyt = new Set(Array.isArray(tila.tunnit) ? tila.tunnit : []);

const alku = Date.now();
const H1 = Math.floor((alku - VALMIS_H * 36e5) / 36e5) * 36e5;
/* Lähteen ikkunan alku + 20 min: ikkunan reunalla oleva tunti voisi olla
   jo osittain pudonnut. */
const H0 = Math.ceil((alku - 24 * 36e5 + 20 * 60e3) / 36e5) * 36e5;
const puuttuvat = [];
for (let H = H0; H <= H1; H += 36e5) if (!tehdyt.has(iso(H))) puuttuvat.push(H);

/* KAUKOPISTEIDEN LUETTELO (docs/eurooppa.md, luku 15). Jokainen asema
   jolla tunnilla oli näyte: sijainti, rannikko (sama maarasteri kuin
   laatan tagilla) ja viimeisin UTC-päivä. Päivä eikä tunti, jotta
   tiedosto muuttuu kerran päivässä eikä joka ajolla (julkaisu siirtää
   vain muuttuneet tiedostot). Yli neljä päivää näkymättömät pois. */
const LUETTELO_POLKU = join(hakemisto, ASEMALUETTELO);
let luettelo = {};
try { luettelo = JSON.parse(readFileSync(LUETTELO_POLKU, 'utf8')).asemat || {}; } catch (e) { luettelo = {}; }
const luetteloAlussa = JSON.stringify(luettelo);
const r4 = (x) => Math.round(x * 1e4) / 1e4;
function merkitse(a, H) {
  const pv = Math.floor(H / 864e5), lat = r4(a.lat), lng = r4(a.lng), v = luettelo[a.id];
  if (v && v[0] === lat && v[1] === lng) { if (pv > v[3]) v[3] = pv; return; }
  const t = asemanTiedot(a.lat, a.lng, null);
  luettelo[a.id] = [lat, lng, t.tagi === 'Meri' ? 1 : 0, Math.max(pv, v ? v[3] : 0)];
}

/* Päivätiedostot muistissa ajon ajan; kirjoitetaan lopuksi. */
const tiedostot = new Map();
function tiedosto(paiva, x, y) {
  const avain = paiva + '/' + laatanAvain(x, y);
  let t = tiedostot.get(avain);
  if (!t) {
    const polku = join(juuri, paiva, laatanAvain(x, y) + '.json');
    let data = {};
    try { data = JSON.parse(readFileSync(polku, 'utf8')); } catch (e) { data = {}; }
    t = { paiva: paiva, polku: polku, data: data };
    tiedostot.set(avain, t);
  }
  return t;
}

let tunteja = 0, asemia = 0, virhe = null;
for (const H of puuttuvat.slice(0, MAX_TUNTEJA)) {
  if (Date.now() - alku > BUDJETTI_MS) { kerro('- aikabudjetti täynnä, loput seuraavalla ajolla'); break; }
  let cj;
  try {
    cj = await haeAlue(EUROOPPA, H - 10 * 60e3, H + 5 * 60e3, TUULI_PARAMETRIT, AIKARAJA_MS);
  } catch (e) {
    /* Lähteen vika: tunti jää tekemättä ja haetaan seuraavalla ajolla
       (se on lähteessä vielä vuorokauden). */
    virhe = e.message;
    break;
  }
  const paiva = iso(H).slice(0, 10), hh = iso(H).slice(11, 13);
  let n = 0;
  for (const a of jasenna(cj).values()) {
    const rr = asemanRivit(a);
    const r = rr && tunninNayte(rr.rivit, H);
    if (!r) continue;
    const { x, y } = laattaKohdassa(a.lat, a.lng);
    const t = tiedosto(paiva, x, y);
    (t.data[a.id] || (t.data[a.id] = {}))[hh] = [r1(r.ws), r1(r.wg), r0(r.wd)];
    merkitse(a, H);
    n++;
  }
  /* 404 (null) on tyhjä tunti, ei vika: tunti merkitään tehdyksi, jottei
     sitä haeta joka ajolla uudelleen. */
  tehdyt.add(iso(H));
  tunteja++;
  asemia = Math.max(asemia, n);
  kerro('- ' + iso(H) + ': ' + n + ' asemaa');
}

for (const t of tiedostot.values()) {
  mkdirSync(join(juuri, t.paiva), { recursive: true });
  writeFileSync(t.polku, JSON.stringify(t.data));
}

/* Luettelo: vanhat pois, kirjoitus vain muuttuneena. */
const pvRaja = Math.floor(alku / 864e5) - 4;
for (const id of Object.keys(luettelo)) if (!(luettelo[id][3] >= pvRaja)) delete luettelo[id];
const luetteloMuuttui = JSON.stringify(luettelo) !== luetteloAlussa;
if (luetteloMuuttui || !existsSync(LUETTELO_POLKU)) {
  writeFileSync(LUETTELO_POLKU, JSON.stringify({ paivitetty: new Date().toISOString(), asemat: luettelo }));
}

/* Säilytys: päivähakemistot ja tila. */
const vanhin = new Date(alku - SAILYTYS_PV * 864e5).toISOString().slice(0, 10);
let poistettu = 0;
for (const p of existsSync(juuri) ? readdirSync(juuri) : []) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(p) && p < vanhin) { rmSync(join(juuri, p), { recursive: true, force: true }); poistettu++; }
}
const raja = iso(alku - 30 * 36e5);
const tunnit = Array.from(tehdyt).filter((t) => t >= raja).sort();
writeFileSync(join(juuri, 'tila.json'), JSON.stringify({
  paivitetty: new Date().toISOString(),
  viimeisin: tunnit.length ? tunnit[tunnit.length - 1] : null,
  asemia: asemia || tila.asemia || null,
  tunnit: tunnit,
}, null, 1));

console.log('### E-SOH (Euroopan havainnot)');
console.log('');
console.log('- tunteja talteen: ' + tunteja + ' / puuttui ' + puuttuvat.length
  + (poistettu ? ', poistettiin ' + poistettu + ' vanhaa päivää' : '')
  + ', ' + ((Date.now() - alku) / 1000).toFixed(1) + ' s');
console.log('- kaukopisteiden luettelo: ' + Object.keys(luettelo).length + ' asemaa' + (luetteloMuuttui ? ' (päivitetty)' : ''));
for (const r of rivit) console.log(r);
if (virhe) {
  console.log('- **lähde ei vastannut**: ' + virhe);
  process.exitCode = 1;
}
