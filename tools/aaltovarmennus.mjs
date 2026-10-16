#!/usr/bin/env node
/* AALTOJEN JATKUVA VARMENNUS — aaltovarasto poijuja vasten
 * (docs/aallot.md V8 ja hyväksymismittari 5).
 *
 *   node tools/aaltovarmennus.mjs <havaintovaraston-hakemisto>
 *
 * MIKSI. Perheiden järjestys (DWD EWAM > FMI WAM > Copernicus BAL > NWS >
 * IBI > BLK > MED > ECMWF WAM 9 km) on päätetty hilan tiheydestä ja
 * kuuden vuorokauden otoksesta (docs/aallot.md 4.3), jonka poijut olivat
 * enimmäkseen avomerellä yhtenä vuodenaikana. Alueellinen malli kuuluu
 * Parhaaseen vain jos se on alueellaan vähintään yhtä hyvä kuin ECMWF
 * 9 km (mittari 5) — sen kertoo vain jatkuva vertailu. Ja kuten tuulella
 * (tools/varmennus.mjs, O11): mikään muu ei huomaisi, jos rakentaja
 * alkaisi tuottaa väärää aaltoa (koodaus, suunnan kierto, aikasiirto,
 * pysähtynyt lähde) — kartalla se näyttäisi uskottavalta.
 *
 * KOLME VAIHETTA havainnot-työnkulun ajossa (vain Noden omat moduulit ja
 * api/aallot.js:n FMI-jäsennin):
 *
 *   1. ARKISTO. Kun luettelon `aallot2.luotu` on uusi, ennuste luetaan
 *      poijujen kohdalta tunneittain 0–72 h rakennushetkestä: jokainen
 *      perhe erikseen (vain kun perhe kattaa poijun: painokanava > 0,5,
 *      aikapaino > 0 ja märkyys ≥ 0,5) ja Paras samalla säännöllä kuin
 *      kortti ja aikajana (`AaltoVarasto.naytteista` hienoimmalla
 *      tasolla, ilman lähizoomin palvelinhilaa). Mukana jokaisen perheen
 *      lähimmän solmun etäisyys mallin märkään pisteeseen (jatke vai
 *      mallin oma vesi) ja Parhaan pääperhe tunneittain.
 *      -> `varmennus/aallot/ennusteet/<luotu>.json`, säilytys 5 vrk.
 *
 *   2. VERTAILU (enintään kerran tunnissa). Havainnot: FMI:n aaltopoijut
 *      (yksi WFS-kysely, 96 h), NOAA NDBC (aseman viiden vuorokauden
 *      tiedosto) ja Marine Instituten M-poijut (ERDDAP, yksi kysely).
 *      Tasatunnin havainto on lähin enintään 30 min päästä. Jokainen
 *      arkistoitu ennuste jokaista havaittua tuntia vasten: harha, MAE,
 *      RMSE ja SI perheittäin, alueittain, rannikko- ja avomeripoijuilla
 *      ja ennusteen iän mukaan; suunnan MAE kun havaittu Hs ≥ 0,5 m.
 *      Alueellisen perheen ja Parhaan RMSE myös PAREITTAIN ECMWF:n
 *      kanssa (samat poijut, tunnit ja ennusteet; mittari 5), ja Paras
 *      myös pääperheensä mukaan (`paras←<perhe>`: ne tunnit joilla perhe
 *      ratkaisee Parhaan) — se on mittari 5 sellaisenaan.
 *      -> `varmennus/aallot/tulos.json` ja ajon yhteenveto.
 *
 *   3. VUOROKAUDET. Päättynyt UTC-vuorokausi D kirjataan kerran
 *      summina (`varmennus/aallot/paivat.json`, 120 vrk) kun D + 27 h ≤
 *      nyt < D + 48 h: silloin sen viimeinenkin tunti on havaittu (FMI:n
 *      viive enintään 2 h) ja ensimmäisen tunnin 72 h:n ennuste on yhä
 *      arkistossa — siksi säilytys on 5 vrk eikä 4 kuten tuulella.
 *      Summista kertyy kausi, jota 5 vrk:n ikkuna ei näe; yhteenvedon
 *      pareittainen taulukko lukee viimeiset 30 vrk.
 *
 * HÄLYTYKSET (yhteenvetoon, eivät kaada ajoa): luettelossa ei ole
 * aaltovarastoa; perheen ajo yli 36 h vanha rakennushetkellä (Copernicus
 * ja EWAM päivittyvät kerran vuorokaudessa, joten 24 h hälyttäisi joka
 * päivä); Parhaan harha yli 0,3 m tai SI yli 0,5 alueella viimeisen
 * vuorokauden pareissa (n ≥ 30); Parhaan suunnan MEDIAANIero yli 60°
 * (Hs ≥ 1 m, n ≥ 30) — ei MAE, koska yksittäinen kahden aallokon tunti
 * on aito suuri ero; käännetty suunta antaa mediaaniksi ~170°.
 * HUOMIO (ei hälytys): alueellinen perhe tai sen ratkaisemat Parhaan
 * tunnit heikompia kuin ECMWF pareittain (RMSE yli 5 %, vähintään 200
 * paria 30 vrk:ssa) — mittari 5 sanoo että silloin perhe ei kuulu
 * alueensa Parhaaseen; järjestys muutetaan rakentajassa käsin, ei
 * tästä.
 *
 * SUUNTA VERRATAAN SAMAAN SUUREESEEN. Mallin suunta on koko spektrin
 * keskisuunta, NDBC:n MWD huippujakson (DPD) suunta. Ne ovat sama asia
 * vain yksihuippuisessa meressä, joten NDBC:n suunta jätetään pois kun
 * DPD > 1,6 × APD (`NDBC_YKSIHUIPPU`): Havaijilla luoteen maininki ja
 * koillisen pasaatiaallokko vuorottelevat huippuna, ja 15.–16.10. 88
 * paria 96:sta (Hs ≥ 1 m) oli suhteen 1,6 yli, mediaaniero 73° —
 * hälytys joka tunti ilman vikaa. Suhteen mukaan koko NDBC-otoksessa
 * mediaaniero ≤ 1,3: 14°, 1,3–1,45: 13°, 1,45–1,6: 20°, 1,6–1,8: 32°,
 * 1,8–2,0: 41°; Havaijin yksihuippuiset parit 11°. Marine Institute
 * antaa keskisuunnan ja FMI huipun suunnan (ModalWDi) Itämeren
 * yksihuippuisessa meressä (mediaani 8°).
 *
 * EMODnet Physics (Välimeri, Mustameri, Iberia) ei ole mukana: sen
 * ERDDAP katkaisi yhteyden kehitysympäristöstä 15.10.2026, joten
 * MED:llä, BLK:lla ja EWAMilla ei vielä ole poijua. */

import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { poijuSarjat } from '../api/aallot.js';

const VARASTO_DIR = process.argv[2] || 'varasto';
const HAKEMISTO = join(VARASTO_DIR, 'varmennus', 'aallot');
const ARKISTO = join(HAKEMISTO, 'ennusteet');
const REPO = process.env.GITHUB_REPOSITORY || 'Jere-stack/wind';
/* Varaston koti: osoite, tai testissä paikallinen rakennushakemisto. */
const KANTA = process.env.SAADATA_KANTA || ('https://raw.githubusercontent.com/' + REPO + '/saadata/');
const H = 36e5;
const LEAD_H = 72;
const SAILYTYS_MS = 5 * 864e5;
const VERTAILU_VALI_MS = 55 * 60e3;
const HAV_H = 96;
const PAIVAT_N = 120;
const PAIVAT_YHTEENVETO = 30;
const TUNNETTU_MS = 14 * 864e5;
const KAISTAT = [[0, 6], [6, 12], [12, 24], [24, 48], [48, 73]];
const RANTA_KM = 25;
const SUUNTA_MIN_HS = 0.5;
/* NDBC:n huippujakson suunta kelpaa mallin keskisuunnaksi vain kun
   DPD ≤ tämä × APD (yksihuippuinen meri; ks. alun "SUUNTA"). */
const NDBC_YKSIHUIPPU = 1.6;
const POHJA = 'ecmwf_wam';
const AJO_IKA_RAJA_H = 36;

const ALUEET = { itameri: 'Itämeri', irlanti: 'Irlanti', 'usa-lansi': 'USA länsi', 'usa-ita': 'USA itä', havaiji: 'Havaiji' };

/* POIJUT. Etäisyys rantaan km Natural Earth 1:10m:n rantaviivasta
   (laskettu kerran 15.10.2026); rannikkopoiju on ≤ `RANTA_KM`. FMI:n
   poijut ja Marine Instituten M-poijut tulevat vastauksesta
   (kausiluontoisia, M4 oli hiljaa 15.10.), ja nämä taulukot antavat vain
   niiden etäisyyden; tuntematon poiju on avomerellä vain jos sen
   etäisyys tiedetään. NDBC:n viisitoista ovat strategian otos
   (docs/aallot.md 4.3). */
const FMI_RANTA = { 103976: 2.5, 108495: 16.1, 134220: 68.5, 134221: 23.3, 134246: 56.6, 137228: 48.9 };
const MI_RANTA = { M2: 42.5, M3: 49.1, M4: 17.5, M5: 50.8, M6: 375.2 };
const NDBC = [
  { id: '51205', nimi: 'Pauwela, Maui', lat: 21.018, lng: -156.421, alue: 'havaiji', km: 10.9 },
  { id: '51201', nimi: 'Waimea Bay', lat: 21.671, lng: -158.118, alue: 'havaiji', km: 6.2 },
  { id: '51001', nimi: 'NW Hawaii', lat: 24.475, lng: -162.03, alue: 'havaiji', km: 159.1 },
  { id: '46026', nimi: 'San Francisco', lat: 37.75, lng: -122.838, alue: 'usa-lansi', km: 19.6 },
  { id: '46237', nimi: 'San Francisco Bar', lat: 37.788, lng: -122.634, alue: 'usa-lansi', km: 9.0 },
  { id: '46042', nimi: 'Monterey', lat: 36.787, lng: -122.408, alue: 'usa-lansi', km: 30.9 },
  { id: '46086', nimi: 'San Clemente Basin', lat: 32.504, lng: -118.029, alue: 'usa-lansi', km: 46.2 },
  { id: '46029', nimi: 'Columbia River Bar', lat: 46.148, lng: -124.508, alue: 'usa-lansi', km: 35.7 },
  { id: '46050', nimi: 'Stonewall Bank', lat: 44.679, lng: -124.535, alue: 'usa-lansi', km: 36.1 },
  { id: '44013', nimi: 'Boston', lat: 42.346, lng: -70.651, alue: 'usa-ita', km: 14.1 },
  { id: '44025', nimi: 'Long Island', lat: 40.258, lng: -73.175, alue: 'usa-ita', km: 41.1 },
  { id: '44100', nimi: 'Duck FRF', lat: 36.257, lng: -75.593, alue: 'usa-ita', km: 14.8 },
  { id: '41025', nimi: 'Diamond Shoals', lat: 35.026, lng: -75.38, alue: 'usa-ita', km: 27.5 },
  { id: '41114', nimi: 'Fort Pierce', lat: 27.564, lng: -80.215, alue: 'usa-ita', km: 9.7 },
  { id: '41010', nimi: 'Canaveral East', lat: 28.86, lng: -78.478, alue: 'usa-ita', km: 204.3 },
];
const luokka = (km) => (km == null ? null : km <= RANTA_KM ? 'ranta' : 'avomeri');

const viestit = [];
const kerro = (s) => viestit.push(s);
const pyor = (x, d) => (x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d));
const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const iso = (ms) => new Date(ms).toISOString();
const pv = (ms) => iso(ms).slice(0, 10);

/* ── Havainnot ─────────────────────────────────────────────────── */

async function haeFmiPoijut() {
  const s = await poijuSarjat(HAV_H, 25000);
  return s.map((a) => ({ id: 'fmi-' + a.fmisid, lahde: 'fmi', nimi: a.nimi, lat: a.lat, lng: a.lng, alue: 'itameri',
    km: FMI_RANTA[a.fmisid] != null ? FMI_RANTA[a.fmisid] : null, ms: a.ms, hs: a.hs, dir: a.dir }));
}

/* NDBC:n viiden vuorokauden tiedosto (realtime2-muoto, uusin ensin,
   puuttuva "MM"). WVHT on merkitsevä aallonkorkeus m ja MWD huippujakson
   (DPD) suunta MISTÄ. Aaltomittaus toistuu 10 min säärivillä ilman
   DPD:tä (sama WVHT, APD ja MWD kuin viereisellä täydellä rivillä);
   vain täydet rivit luetaan — ne kattavat 1 700 tuntia 1 712:sta
   (16.10.). Suunta vain yksihuippuisesta merestä (`NDBC_YKSIHUIPPU`:
   54 % täysistä suuntariveistä 16.10.). */
function jasennaNdbc(teksti) {
  const rivit = teksti.split('\n');
  const otsake = (rivit[0] || '').replace(/^#/, '').trim().split(/\s+/);
  const i = (n) => otsake.indexOf(n);
  const iY = i('YY'), iM = i('MM'), iD = i('DD'), ih = i('hh'), im = i('mm'), iH = i('WVHT'), iW = i('MWD');
  const iP = i('DPD'), iA = i('APD');
  if ([iY, iM, iD, ih, im, iH, iP, iA].some((x) => x < 0)) return null;
  const r = [];
  for (const rivi of rivit) {
    if (!rivi || rivi[0] === '#') continue;
    const c = rivi.trim().split(/\s+/);
    const h = parseFloat(c[iH]), dpd = parseFloat(c[iP]), apd = parseFloat(c[iA]);
    if (!(h >= 0 && h < 30) || !(dpd > 0) || !(apd > 0)) continue;
    const d = iW >= 0 ? parseFloat(c[iW]) : NaN;
    r.push([Date.UTC(+c[iY], +c[iM] - 1, +c[iD], +c[ih], +c[im]), h,
      d >= 0 && d <= 360 && dpd <= NDBC_YKSIHUIPPU * apd ? d : null]);
  }
  r.sort((a, b) => a[0] - b[0]);
  return { ms: r.map((x) => x[0]), hs: r.map((x) => x[1]), dir: r.map((x) => x[2]) };
}
async function haeNdbc() {
  const r = await Promise.all(NDBC.map(async (p) => {
    try {
      const v = await fetch('https://www.ndbc.noaa.gov/data/5day2/' + p.id + '_5day.txt', { signal: AbortSignal.timeout(20000) });
      if (!v.ok) return null;
      const s = jasennaNdbc(await v.text());
      return s && s.ms.length ? Object.assign({ id: 'ndbc-' + p.id, lahde: 'ndbc', nimi: p.nimi, lat: p.lat, lng: p.lng, alue: p.alue, km: p.km }, s) : null;
    } catch (e) { return null; }
  }));
  return r.filter(Boolean);
}

/* Marine Instituten M-poijut (ERDDAP, tunneittain). QC_Flag 9 =
   puuttuva; 0 = tuntematon on lähteen tavallinen tila. */
async function haeMi() {
  const alku = iso(Date.now() - HAV_H * H).slice(0, 19) + 'Z';
  const v = await fetch('https://erddap.marine.ie/erddap/tabledap/IWBNetwork.csv?station_id,longitude,latitude,time,'
    + 'WaveHeight,MeanWaveDirection,QC_Flag&time%3E=' + alku, { signal: AbortSignal.timeout(25000) });
  if (!v.ok) throw new Error('Marine Institute HTTP ' + v.status);
  const rivit = (await v.text()).trim().split('\n');
  const o = (rivit[0] || '').split(','), i = (n) => o.indexOf(n);
  const iS = i('station_id'), iLo = i('longitude'), iLa = i('latitude'), iT = i('time'), iH = i('WaveHeight'), iD = i('MeanWaveDirection'), iQ = i('QC_Flag');
  if ([iS, iLo, iLa, iT, iH].some((x) => x < 0)) throw new Error('Marine Institute: tuntematon otsake');
  const asemat = new Map();
  for (const rivi of rivit.slice(2)) {
    const c = rivi.split(',');
    const h = parseFloat(c[iH]), t = Date.parse(c[iT]);
    if (!(h >= 0 && h < 30) || !isFinite(t) || (iQ >= 0 && c[iQ] === '9')) continue;
    const id = c[iS];
    if (!asemat.has(id)) asemat.set(id, { id: 'ie-' + id, lahde: 'mi', nimi: id, lat: +c[iLa], lng: +c[iLo], alue: 'irlanti',
      km: MI_RANTA[id] != null ? MI_RANTA[id] : null, r: [] });
    const d = iD >= 0 ? parseFloat(c[iD]) : NaN;
    asemat.get(id).r.push([t, h, d >= 0 && d <= 360 ? d : null]);
  }
  return [...asemat.values()].map((a) => {
    a.r.sort((x, y) => x[0] - y[0]);
    const ulos = Object.assign({}, a, { ms: a.r.map((x) => x[0]), hs: a.r.map((x) => x[1]), dir: a.r.map((x) => x[2]) });
    delete ulos.r;
    return ulos;
  });
}

/* Kaikki lähteet rinnakkain; yhden lähteen vika ei estä muita. */
async function havainnot() {
  const lahteet = {};
  const [f, n, m] = await Promise.all([
    haeFmiPoijut().catch((e) => { lahteet.fmi = 'virhe: ' + e.message; return []; }),
    haeNdbc().catch((e) => { lahteet.ndbc = 'virhe: ' + e.message; return []; }),
    haeMi().catch((e) => { lahteet.mi = 'virhe: ' + e.message; return []; }),
  ]);
  if (!lahteet.fmi) lahteet.fmi = f.length;
  if (!lahteet.ndbc) lahteet.ndbc = n.length;
  if (!lahteet.mi) lahteet.mi = m.length;
  return { poijut: [...f, ...n, ...m], lahteet };
}

/* Tasatunnin havainto: lähin enintään 30 min päästä. */
function tunneittain(p) {
  const h = new Map();
  for (let i = 0; i < p.ms.length; i++) {
    const t = Math.round(p.ms[i] / H) * H, ero = Math.abs(p.ms[i] - t);
    const o = h.get(t);
    if (!o || ero < o.ero) h.set(t, { hs: p.hs[i], dir: p.dir[i], ero });
  }
  return h;
}

/* ── Aaltovarasto kuten sovellus sen lukee (`AaltoVarasto`) ──────── */

function valmistele(A) {
  if (!A || A.versio !== 2 || !Array.isArray(A.tasot)) return null;
  const perheet = new Map();
  for (const t0 of A.tasot) {
    if (!Array.isArray(t0.ajat) || t0.ajat.length < 2 || !t0.perhe) continue;
    const t = Object.assign({}, t0, { _laatat: new Set((t0.laatat || []).map((r) => r[0] + '_' + r[1])) });
    if (!perheet.has(t.perhe)) perheet.set(t.perhe, []);
    perheet.get(t.perhe).push(t);
  }
  if (!perheet.has(POHJA)) return null;
  const jarjestys = (Array.isArray(A.perheet) && A.perheet.length ? A.perheet : [...perheet.keys()])
    .filter((p) => p !== POHJA).concat([POHJA]);
  const ulos = [];
  for (const id of jarjestys) {
    const tasot = perheet.get(id);
    if (!tasot || !tasot.length) continue;
    tasot.sort((a, b) => a.askel - b.askel);
    const loppu = Math.max(...tasot.map((t) => t.ajat[t.ajat.length - 1]));
    for (const t of tasot) t._lyhyt = t.ajat[t.ajat.length - 1] < loppu - 60e3;
    const bb = [Infinity, -Infinity, Infinity, -Infinity];
    for (const t of tasot) {
      bb[0] = Math.min(bb[0], t.lat[0]); bb[1] = Math.max(bb[1], t.lat[1]);
      const kaikki = !(t.lng[0] > -180 || t.lng[1] < 180);
      bb[2] = Math.min(bb[2], kaikki ? -Infinity : t.lng[0]); bb[3] = Math.max(bb[3], kaikki ? Infinity : t.lng[1]);
    }
    ulos.push({ id, tasot, pohja: id === POHJA, bb, ajoAika: tasot[0].ajoAika || null });
  }
  const pohja = ulos[ulos.length - 1];
  const pisin = pohja.tasot.filter((t) => !t._lyhyt)[0] || pohja.tasot[0];
  const HS = new Float32Array(256);
  for (let q = 0; q < 255; q++) HS[q] = (A.hsKatto || 16) * (q / 254) * (q / 254);
  HS[255] = NaN;
  const SIN = new Float32Array(256), COS = new Float32Array(256);
  for (let q = 0; q < 255; q++) { const r = q * (A.suuntaAskel || 2) * Math.PI / 180; SIN[q] = Math.sin(r); COS[q] = Math.cos(r); }
  return { A, perheet: ulos, perusAvain: avainAjat(pisin.ajat), HS, SIN, COS };
}
const avainAjat = (a) => a[0] + '_' + a[a.length - 1] + '_' + a.length;

/* Tason akselin kohta hetkelle (`Saalaatat._asetaAkseli`): tunnin
   toleranssi päissä, tarkka askel omana indeksinään. */
function akseliKohta(ajat, t) {
  const n = ajat.length;
  if (t < ajat[0] - H || t > ajat[n - 1] + H) return null;
  if (t <= ajat[0]) return { ti: 0, tf: 0 };
  if (t >= ajat[n - 1]) return { ti: n - 1, tf: 0 };
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (ajat[m] < t) lo = m + 1; else hi = m; }
  if (ajat[lo] === t) return { ti: lo, tf: 0 };
  return { ti: lo - 1, tf: (t - ajat[lo - 1]) / (ajat[lo] - ajat[lo - 1]) };
}
/* Perheen aikapaino (`_aikaPaino`): pohja ja pohjan akselin jakava 1,
   muut smoothstep 2 h alussa ja 6 h lopussa. */
function aikaPaino(V, p, t) {
  if (p.pohja) return 1;
  const a = p.tasot[0].ajat;
  if (avainAjat(a) === V.perusAvain) return 1;
  if (t < a[0] || t > a[a.length - 1]) return 0;
  return ss((t - a[0]) / (2 * H)) * ss((a[a.length - 1] - t) / (6 * H));
}
/* Hienoin kattava taso (`_perheenTaso` askeleella 0): perhettä lyhyempi
   taso ohitetaan akselinsa ulkopuolella. */
function perheenTaso(p, lat, lo, t) {
  for (const L of p.tasot) {
    if (lat < L.lat[0] || lat > L.lat[1]) continue;
    if ((L.lng[0] > -180 || L.lng[1] < 180) && (lo < L.lng[0] || lo > L.lng[1])) continue;
    if (L._lyhyt && !akseliKohta(L.ajat, t)) continue;
    return L;
  }
  return null;
}
const ruutu = (L, lat, lo) => ({ la0: +(Math.floor(lat / L.span) * L.span).toFixed(4), lo0: +(Math.floor(lo / L.span) * L.span).toFixed(4) });

/* LAATAT. Palat (`pala` askelta, yksi päällekkäin seuraavan kanssa)
   kootaan koko akselin laataksi kuten `Saalaatat._lataa`; `palat[c]`
   kertoo mitkä tulivat. Vain arkistoikkunan palat haetaan. */
const _laatat = new Map();
async function haeTiedosto(A, polku) {
  try {
    if (/^https?:/.test(KANTA)) {
      const r = await fetch(KANTA + polku + '?v=' + encodeURIComponent(A.luotu), { signal: AbortSignal.timeout(20000) });
      if (!r.ok) return null;
      return gunzipSync(Buffer.from(await r.arrayBuffer()));
    }
    return gunzipSync(readFileSync(join(KANTA, polku)));
  } catch (e) { return null; }
}
async function lataaLaatta(V, L, la0, lo0, palat) {
  const nimi = L.id + '/' + la0 + '_' + lo0;
  const nt = L.ajat.length;
  const P = L.pala > 0 ? Math.max(1, Math.ceil((nt - 1) / L.pala)) : 1;
  let l = _laatat.get(nimi);
  if (!l) { l = { palat: new Uint8Array(P), nt }; _laatat.set(nimi, l); }
  const haettavat = palat.filter((c) => !l.palat[c]);
  const tavut = await Promise.all(haettavat.map((c) => haeTiedosto(V.A, nimi + (L.pala > 0 ? '.p' + c : '') + '.bin.gz')));
  haettavat.forEach((c, j) => {
    const b = tavut[j];
    if (!b) { l.palat[c] = 2; return; }
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), O = V.A.otsake || 40;
    const nx = dv.getUint16(20, true), ny = dv.getUint16(22, true), ntp = dv.getUint16(24, true);
    const koko = ntp * nx * ny, liput = dv.getUint8(39);
    if (!l.hs) {
      const T = V.A.tyhja != null ? V.A.tyhja : 255, uusi = () => new Uint8Array(nt * nx * ny).fill(T);
      Object.assign(l, { askel: dv.getFloat32(8, true), la0: dv.getFloat32(12, true), lo0: dv.getFloat32(16, true), nx, ny,
        hs: uusi(), suunta: uusi() });
      const pp = (liput & 1) ? O + 3 * koko : -1, eo = O + 3 * koko + ((liput & 1) ? nx * ny : 0);
      l.paino = pp >= 0 ? b.slice(pp, pp + nx * ny) : null;
      l.etaisyys = (liput & 2) && b.length >= eo + nx * ny ? b.slice(eo, eo + nx * ny) : null;
    }
    const o = (L.pala > 0 ? c * L.pala : 0) * nx * ny, m = Math.min(koko, l.hs.length - o);
    l.hs.set(b.subarray(O, O + m), o);
    l.suunta.set(b.subarray(O + koko, O + koko + m), o);
    l.palat[c] = 1;
  });
  return l.hs ? l : null;
}
const palaIndeksi = (L, i) => (L.pala > 0 ? Math.min(Math.max(1, Math.ceil((L.ajat.length - 1) / L.pala)) - 1, Math.floor(i / L.pala)) : 0);

/* Rannan luottamus etäisyydestä (`AaltoVarasto._luotto`). */
function luotto(V, L) {
  if (L._luottoT) return L._luottoT;
  const t = new Float32Array(256), K = V.A.luottoKerroin || 1.3, Lk = L.luottoKm || 9;
  for (let q = 0; q < 255; q++) {
    const d = (q / 16) * (q / 16);
    const x = Math.min(1, Math.max(0, (d - Lk) / ((K - 1) * Lk)));
    t[q] = 1 - x * x * (3 - 2 * x);
  }
  t[255] = 0;
  return (L._luottoT = t);
}

/* YHDEN PERHEEN NÄYTE (`AaltoVarasto._naytePerhe`): paikassa
   bilineaarinen märkien solmujen kesken (paino × luottamus), ajassa
   korkeus lineaarisesti ja suunta yksikkövektoreina. */
function naytePerhe(V, L, l, lat, lo, t) {
  const fy = (lat - l.la0) / l.askel, fx = (lo - l.lo0) / l.askel;
  const iy = Math.max(0, Math.min(l.ny - 2, Math.floor(fy))), ix = Math.max(0, Math.min(l.nx - 2, Math.floor(fx)));
  const wy = Math.max(0, Math.min(1, fy - iy)), wx = Math.max(0, Math.min(1, fx - ix));
  const k = [iy * l.nx + ix, iy * l.nx + ix + 1, (iy + 1) * l.nx + ix, (iy + 1) * l.nx + ix + 1];
  const w = [(1 - wy) * (1 - wx), (1 - wy) * wx, wy * (1 - wx), wy * wx];
  const P = l.paino;
  const paino = P ? (P[k[0]] * w[0] + P[k[1]] * w[1] + P[k[2]] * w[2] + P[k[3]] * w[3]) / 255 : 1;
  if (paino <= 0) return { tila: 'ok', paino: 0, A: 0 };
  const ax = akseliKohta(L.ajat, t);
  if (!ax) return { tila: 'puuttuu' };
  const ib0 = Math.min(ax.ti + 1, l.nt - 1);
  if (l.palat[palaIndeksi(L, ax.ti)] !== 1 || (ib0 !== ax.ti && ax.tf > 0 && l.palat[palaIndeksi(L, ib0)] !== 1)) return { tila: 'puuttuu' };
  const LU = luotto(V, L), E = l.etaisyys, L2 = l.ny * l.nx, ia = ax.ti * L2, ib = ib0 * L2;
  const f = ib === ia ? 0 : ax.tf;
  let sA = 0, sH = 0, sS = 0, sC = 0;
  for (let c = 0; c < 4; c++) {
    if (w[c] <= 1e-6) continue;
    const lu = E ? LU[E[k[c]]] : 1;
    if (lu <= 0) continue;
    const hA = l.hs[ia + k[c]], hB = l.hs[ib + k[c]];
    if (hA === 255 && hB === 255) continue;
    const wa = hA === 255 ? 0 : (hB === 255 ? 1 : 1 - f), wb = 1 - wa, ww = w[c] * lu;
    sA += ww;
    sH += ww * ((wa > 0 ? V.HS[hA] * wa : 0) + (wb > 0 ? V.HS[hB] * wb : 0));
    const dA = l.suunta[ia + k[c]], dB = l.suunta[ib + k[c]];
    if (dA !== 255 && wa > 0) { sS += ww * wa * V.SIN[dA]; sC += ww * wa * V.COS[dA]; }
    if (dB !== 255 && wb > 0) { sS += ww * wb * V.SIN[dB]; sC += ww * wb * V.COS[dB]; }
  }
  const lahin = k[(wy < 0.5 ? 0 : 2) + (wx < 0.5 ? 0 : 1)];
  const ekst = E ? (E[lahin] === 255 ? null : (E[lahin] / 16) * (E[lahin] / 16)) : 0;
  if (sA <= 1e-6) return { tila: 'ok', paino, A: 0, ekst };
  const m = Math.hypot(sS, sC);
  return { tila: 'ok', paino, A: Math.min(1, sA), hs: sH / sA, s: m > 1e-6 ? sS / m : 0, c: m > 1e-6 ? sC / m : 1, ekst };
}

/* PARAS (`AaltoVarasto.naytteista` ilman lähizoomin perhettä): perheet
   tärkeimmästä alkaen, paino = painokanava × aikapaino, ja perhe peittää
   alemmat painonsa verran myös kuivana — olematon laatta on kuiva.
   Puuttuva laatta tai pala (haku epäonnistui) tekee tunnista tuntemattoman:
   sovellus ei näytä vajaata sekoitusta vaan odottaa laatan (`_vajaa`).
   Palauttaa { hs, dir, lahde } tai { kuiva } tai null. */
function sekoita(V, nayt) {
  let jaljella = 1, sW = 0, sA = 0, sH = 0, sS = 0, sC = 0, lahde = -1, lahdeO = 0;
  const osuus = (i, c) => { if (c > lahdeO) { lahdeO = c; lahde = i; } };
  for (let i = 0; i < V.perheet.length; i++) {
    if (jaljella <= 0.002) break;
    const p = V.perheet[i], n = nayt[i];
    let w = n.aikaW;
    if (w <= 0) continue;
    if (n.tila === 'ulkona' || n.tila === 'olematon') {
      if (n.tila === 'olematon' || p.pohja) { const c = jaljella * w; sW += c; osuus(i, c); jaljella *= 1 - w; }
      continue;
    }
    if (n.tila === 'puuttuu') return null;
    if (n.tila !== 'ok') { if (p.pohja && !sW) return null; continue; }
    if (!p.pohja) w *= n.paino;
    if (w <= 0) continue;
    const c = jaljella * w, ca = c * n.A;
    if (ca > 0) { sA += ca; sH += ca * n.hs; sS += ca * n.s; sC += ca * n.c; }
    sW += c; osuus(i, c);
    jaljella *= 1 - w;
  }
  if (!sW) return null;
  if (sA / sW < 0.5) return { kuiva: true };
  return { hs: sH / sA, dir: (Math.atan2(sS, sC) * 180 / Math.PI + 360) % 360, lahde };
}

/* Poijun kaikkien perheiden näytteet hetkelle. Laatat on ladattava
   ennen (`lataaPoijulle`). */
function naytteet(V, b, t) {
  const lo = ((b.lng + 180) % 360 + 360) % 360 - 180;
  return V.perheet.map((p) => {
    const aikaW = aikaPaino(V, p, t);
    const bb = p.bb;
    if (b.lat < bb[0] || b.lat > bb[1] || lo < bb[2] || lo > bb[3]) return { tila: 'ulkona', aikaW };
    const L = perheenTaso(p, b.lat, lo, t);
    if (!L) return { tila: 'eiTasoa', aikaW };
    const r = ruutu(L, b.lat, lo);
    if (!L._laatat.has(r.la0 + '_' + r.lo0)) return { tila: 'olematon', aikaW };
    const l = _laatat.get(L.id + '/' + r.la0 + '_' + r.lo0);
    if (!l || !l.hs) return { tila: 'puuttuu', aikaW };
    return Object.assign(naytePerhe(V, L, l, b.lat, lo, t), { aikaW });
  });
}
async function lataaPoijulle(V, b, ajat) {
  const lo = ((b.lng + 180) % 360 + 360) % 360 - 180;
  const tarve = new Map();
  for (const p of V.perheet) {
    const bb = p.bb;
    if (b.lat < bb[0] || b.lat > bb[1] || lo < bb[2] || lo > bb[3]) continue;
    for (const t of ajat) {
      const L = perheenTaso(p, b.lat, lo, t);
      if (!L) continue;
      const r = ruutu(L, b.lat, lo);
      if (!L._laatat.has(r.la0 + '_' + r.lo0)) continue;
      const ax = akseliKohta(L.ajat, t);
      if (!ax) continue;
      const av = L.id + '/' + r.la0 + '_' + r.lo0;
      if (!tarve.has(av)) tarve.set(av, { L, r, palat: new Set() });
      const e = tarve.get(av);
      e.palat.add(palaIndeksi(L, ax.ti));
      e.palat.add(palaIndeksi(L, Math.min(ax.ti + 1, L.ajat.length - 1)));
    }
  }
  await Promise.all([...tarve.values()].map((e) => lataaLaatta(V, e.L, e.r.la0, e.r.lo0, [...e.palat])));
}

/* ── 1. Arkisto ─────────────────────────────────────────────────── */

async function arkistoi(V, poijut) {
  const luotu = Date.parse(V.A.luotu);
  const t0 = Math.floor(luotu / H) * H, n = LEAD_H + 1;
  const ajat = Array.from({ length: n }, (_, i) => t0 + i * H);
  const ulos = { luotu: V.A.luotu, t0, n, perheet: V.perheet.map((p) => p.id),
    ajot: Object.fromEntries(V.perheet.map((p) => [p.id, p.ajoAika])),
    natiivi: Object.fromEntries(V.perheet.map((p) => [p.id, p.tasot[0].natiiviKm || null])), poijut: {} };
  let poijuja = 0;
  for (const b of poijut) {
    await lataaPoijulle(V, b, ajat);
    const hs = { paras: [] }, dir = { paras: [] }, pl = [], ekst = {};
    for (const p of V.perheet) { hs[p.id] = []; dir[p.id] = []; }
    for (const t of ajat) {
      const nayt = naytteet(V, b, t);
      const s = sekoita(V, nayt);
      hs.paras.push(s && !s.kuiva ? pyor(s.hs, 2) : null);
      dir.paras.push(s && !s.kuiva ? Math.round(s.dir) % 360 : null);
      pl.push(s && !s.kuiva ? s.lahde : -1);
      V.perheet.forEach((p, i) => {
        const v = nayt[i];
        const kattaa = v.tila === 'ok' && v.aikaW > 0 && (p.pohja || v.paino > 0.5) && v.A >= 0.5 && v.hs != null;
        hs[p.id].push(kattaa ? pyor(v.hs, 2) : null);
        dir[p.id].push(kattaa ? Math.round((Math.atan2(v.s, v.c) * 180 / Math.PI + 360) % 360) % 360 : null);
        if (kattaa && ekst[p.id] == null && v.ekst != null) ekst[p.id] = pyor(v.ekst, 1);
      });
    }
    for (const k of Object.keys(hs)) if (!hs[k].some((x) => x != null)) { delete hs[k]; delete dir[k]; }
    if (!hs.paras) continue;
    ulos.poijut[b.id] = { nimi: b.nimi, lahde: b.lahde, alue: b.alue, km: b.km, lat: b.lat, lng: b.lng, ekst, hs, dir, pl };
    poijuja++;
  }
  mkdirSync(ARKISTO, { recursive: true });
  const nimi = iso(luotu).replace(/[:.]/g, '-') + '.json';
  writeFileSync(join(ARKISTO, nimi), JSON.stringify(ulos));
  return { nimi, poijuja };
}

/* ── 2. ja 3. Vertailu ja vuorokaudet ───────────────────────────── */

const kerain = () => ({ n: 0, sE: 0, sA: 0, sE2: 0, sO: 0, nD: 0, sD: 0 });
function lisaa(k, f, o, fd, od) {
  const e = f - o;
  k.n++; k.sE += e; k.sA += Math.abs(e); k.sE2 += e * e; k.sO += o;
  if (o >= SUUNTA_MIN_HS && fd != null && od != null) { k.nD++; k.sD += Math.abs(((fd - od) % 360 + 540) % 360 - 180); }
}
function tiivista(k) {
  const rmse = k.n ? Math.sqrt(k.sE2 / k.n) : null;
  return { n: k.n, harha: k.n ? pyor(k.sE / k.n, 3) : null, mae: k.n ? pyor(k.sA / k.n, 3) : null, rmse: pyor(rmse, 3),
    si: k.n && k.sO > 0 ? pyor(rmse / (k.sO / k.n), 3) : null, suuntaMae: k.nD ? pyor(k.sD / k.nD, 1) : null, nSuunta: k.nD };
}
const pariKerain = () => ({ n: 0, sE2: 0, sE2ec: 0 });
const pariTiivis = (k) => ({ n: k.n, rmse: k.n ? pyor(Math.sqrt(k.sE2 / k.n), 3) : null, rmseEc: k.n ? pyor(Math.sqrt(k.sE2ec / k.n), 3) : null });
const summaa = (a, b) => { for (const x of Object.keys(b)) a[x] = (a[x] || 0) + b[x]; return a; };

/* Jokainen (ennuste, poiju, tunti) -pari kerran: `kasittele(perhe, alue,
   luokka, lead, t, f, o, fd, od, ec, jatke)`, jossa `ec` on ECMWF:n arvo
   samasta ennusteesta samalle tunnille (pareittainen vertailu) ja `jatke`
   tosi kun poijun lähimmän solmun etäisyys perheen märkään pisteeseen on
   yli mallin solmuvälin (luku on rakentajan ekstrapoloimaa rantaa). */
function kayParit(tiedostot, hav, nyt, kasittele) {
  for (const f of tiedostot) {
    let e;
    try { e = JSON.parse(readFileSync(join(ARKISTO, f), 'utf8')); } catch (err) { continue; }
    const luotu = Date.parse(e.luotu);
    for (const [id, s] of Object.entries(e.poijut)) {
      const h = hav.get(id);
      if (!h) continue;
      const lk = luokka(s.km);
      for (let i = 0; i < e.n; i++) {
        const t = e.t0 + i * H;
        if (t > nyt) break;
        const o = h.get(t);
        if (!o) continue;
        const lead = (t - luotu) / H;
        const ec = s.hs[POHJA] ? s.hs[POHJA][i] : null;
        for (const [p, sarja] of Object.entries(s.hs)) {
          const fv = sarja[i];
          if (fv == null) continue;
          const ek = s.ekst ? s.ekst[p] : null, nat = e.natiivi ? e.natiivi[p] : null;
          kasittele(p, s.alue, lk, lead, t, fv, o.hs, s.dir[p][i], o.dir, p === POHJA ? null : ec,
            ek != null && nat != null && ek > nat);
          /* Paras pääperheensä mukaan (mittari 5 suoraan: ne tunnit joilla
             perhe X ratkaisee Parhaan, verrattuna ECMWF:ään samoilla
             tunneilla). ECMWF:n tunneilla Paras on ECMWF. */
          const pp = p === 'paras' && s.pl && s.pl[i] >= 0 ? e.perheet[s.pl[i]] : null;
          if (pp && pp !== POHJA) kasittele('paras←' + pp, s.alue, lk, lead, t, fv, o.hs, s.dir[p][i], o.dir, ec, false);
        }
      }
    }
  }
}

function vertaa(poijut, nyt, paivat) {
  const tiedostot = existsSync(ARKISTO) ? readdirSync(ARKISTO).filter((f) => f.endsWith('.json')).sort() : [];
  if (!tiedostot.length) { kerro('Arkistossa ei vielä aaltoennusteita — vertailu odottaa ensimmäistä.'); return null; }
  const hav = new Map(poijut.map((p) => [p.id, tunneittain(p)]));
  const k = {}, kVrk = {}, pari = {};
  /* Kirjattavat vuorokaudet: D + 27 h ≤ nyt < D + 48 h, ei vielä kirjattu. */
  const kirjattavat = new Set();
  for (let d = Math.floor((nyt - 48 * H) / 864e5) * 864e5; d + 27 * H <= nyt; d += 864e5) {
    if (nyt < d + 48 * H && !paivat[pv(d)]) kirjattavat.add(pv(d));
  }
  const uudet = {}, kJ = {}, vrkSuunta = {};
  kayParit(tiedostot, hav, nyt, (p, alue, lk, lead, t, fv, ov, fd, od, ec, jatke) => {
    const kaista = KAISTAT.findIndex(([a, b]) => lead >= a && lead < b);
    if (kaista < 0) return;
    if (!p.startsWith('paras')) {
      const jk = p + '|' + (jatke ? 'jatke' : 'oma');
      lisaa(kJ[jk] || (kJ[jk] = kerain()), fv, ov, fd, od);
    }
    for (const l of lk ? [lk, 'kaikki'] : ['kaikki']) {
      const kk = p + '|' + alue + '|' + l + '|' + KAISTAT[kaista].join('–');
      lisaa(k[kk] || (k[kk] = kerain()), fv, ov, fd, od);
      const kk2 = p + '|' + alue + '|' + l + '|kaikki';
      lisaa(k[kk2] || (k[kk2] = kerain()), fv, ov, fd, od);
      if (ec != null) {
        const pk = p + '|' + alue + '|' + l, q = pari[pk] || (pari[pk] = pariKerain());
        q.n++; q.sE2 += (fv - ov) * (fv - ov); q.sE2ec += (ec - ov) * (ec - ov);
      }
      const d = pv(t);
      if (kirjattavat.has(d)) {
        const u = uudet[d] || (uudet[d] = { ryhmat: {}, parit: {} });
        const gk = p + '|' + alue + '|' + l;
        lisaa(u.ryhmat[gk] || (u.ryhmat[gk] = kerain()), fv, ov, fd, od);
        if (ec != null) {
          const q = u.parit[gk] || (u.parit[gk] = pariKerain());
          q.n++; q.sE2 += (fv - ov) * (fv - ov); q.sE2ec += (ec - ov) * (ec - ov);
        }
      }
    }
    if (t > nyt - 864e5 && p === 'paras') {
      const vk = p + '|' + alue;
      lisaa(kVrk[vk] || (kVrk[vk] = kerain()), fv, ov, fd, od);
      /* Suunnan hälytys mediaanista: yksittäinen kahden aallokon tunti
         voi erota aidosti (NDBC:n kaksihuippuiset tunnit on jo jätetty
         pois, `NDBC_YKSIHUIPPU`), käännetty suunta antaa ~170°. */
      if (ov >= 1 && fd != null && od != null) (vrkSuunta[alue] || (vrkSuunta[alue] = [])).push(Math.abs(((fd - od) % 360 + 540) % 360 - 180));
    }
  });
  const tulos = { laskettu: iso(nyt), ennusteita: tiedostot.length,
    poijuja: poijut.length, ryhmat: {}, vrk: {}, parit: {}, jatke: {} };
  for (const [kk, v] of Object.entries(k)) tulos.ryhmat[kk] = tiivista(v);
  for (const [kk, v] of Object.entries(kJ)) tulos.jatke[kk] = tiivista(v);
  tulos.vrkSuunta = {};
  for (const [alue, a] of Object.entries(vrkSuunta)) {
    a.sort((x, y) => x - y);
    tulos.vrkSuunta[alue] = { n: a.length, mediaani: pyor(a[a.length >> 1], 1) };
  }
  for (const [kk, v] of Object.entries(kVrk)) tulos.vrk[kk] = tiivista(v);
  for (const [kk, v] of Object.entries(pari)) tulos.parit[kk] = pariTiivis(v);
  for (const [d, u] of Object.entries(uudet)) paivat[d] = u;
  /* Vuorokausi jolla ei ollut yhtään paria kirjataan silti, jottei sitä
     yritetä uudelleen tyhjällä arkistolla. */
  for (const d of kirjattavat) if (!paivat[d]) paivat[d] = { ryhmat: {}, parit: {} };
  tulos.kirjatut = [...kirjattavat];
  return tulos;
}

/* Pareittainen ECMWF-vertailu viimeisiltä 30 vuorokaudelta. */
function kertyma(paivat, nyt) {
  const raja = pv(nyt - PAIVAT_YHTEENVETO * 864e5), parit = {};
  let vrk = 0;
  for (const [d, u] of Object.entries(paivat)) {
    if (d < raja) continue;
    vrk++;
    for (const [kk, q] of Object.entries(u.parit || {})) summaa(parit[kk] || (parit[kk] = pariKerain()), q);
  }
  const ulos = {};
  for (const [kk, q] of Object.entries(parit)) ulos[kk] = pariTiivis(q);
  return { vrk, parit: ulos };
}

const fmt = (x) => (x == null ? '—' : String(x).replace('.', ','));
function taulukot(tulos, kert) {
  const r = ['| perhe | alue | poijut | n | harha m | MAE m | RMSE m | SI | suunta MAE ° |', '|---|---|---|---|---|---|---|---|---|'];
  const avaimet = Object.keys(tulos.ryhmat).filter((kk) => kk.endsWith('|kaikki')).sort();
  for (const kk of avaimet) {
    const [p, alue, l] = kk.split('|'), v = tulos.ryhmat[kk];
    if (!v.n) continue;
    r.push('| ' + [p, ALUEET[alue] || alue, l, v.n, fmt(v.harha), fmt(v.mae), fmt(v.rmse), fmt(v.si), fmt(v.suuntaMae)].join(' | ') + ' |');
  }
  const r2 = ['', '**Pareittain ECMWF WAM 9 km:n kanssa (mittari 5)** — samat poijut, tunnit ja ennusteet; RMSE m.', '',
    '| perhe | alue | poijut | n (5 vrk) | RMSE | ECMWF | n (' + kert.vrk + ' vrk) | RMSE | ECMWF |', '|---|---|---|---|---|---|---|---|---|'];
  const pk = new Set([...Object.keys(tulos.parit), ...Object.keys(kert.parit)]);
  for (const kk of [...pk].sort()) {
    const [p, alue, l] = kk.split('|'), a = tulos.parit[kk] || {}, b = kert.parit[kk] || {};
    if (!a.n && !b.n) continue;
    /* Alueella jolla Paras on ECMWF (ei alueellista perhettä) rivi on
       sama luku kahdesti. */
    if ((!a.n || a.rmse === a.rmseEc) && (!b.n || b.rmse === b.rmseEc)) continue;
    r2.push('| ' + [p, ALUEET[alue] || alue, l, a.n || 0, fmt(a.rmse), fmt(a.rmseEc), b.n || 0, fmt(b.rmse), fmt(b.rmseEc)].join(' | ') + ' |');
  }
  return r.join('\n') + '\n' + r2.join('\n');
}

/* ── Ajo ─────────────────────────────────────────────────────────── */

async function lueLuettelo() {
  if (/^https?:/.test(KANTA)) {
    const r = await fetch(KANTA + 'luettelo.json?t=' + Math.floor(Date.now() / 60000), { signal: AbortSignal.timeout(20000) });
    if (!r.ok) throw new Error('luettelo HTTP ' + r.status);
    return r.json();
  }
  return JSON.parse(readFileSync(join(KANTA, 'luettelo.json'), 'utf8'));
}
const lueJson = (polku, oletus) => { try { return JSON.parse(readFileSync(polku, 'utf8')); } catch (e) { return oletus; } };

async function aja() {
  const nyt = Date.now();
  mkdirSync(HAKEMISTO, { recursive: true });
  const tilaPolku = join(HAKEMISTO, 'tila.json'), paivatPolku = join(HAKEMISTO, 'paivat.json');
  const tila = lueJson(tilaPolku, {});
  const halytykset = [], huomiot = [];

  const Lt = await lueLuettelo();
  const V = valmistele(Lt.aallot2);
  if (!V) halytykset.push('Luettelossa ei ole aaltovarastoa (`aallot2`): ECMWF WAM ei rakentunut tai rakentaja on vanha.');
  const arkistoon = V && tila.arkistoitu !== V.A.luotu;
  const vertailuun = !tila.vertailtu || nyt - Date.parse(tila.vertailtu) >= VERTAILU_VALI_MS;
  if (V) {
    const luotu = Date.parse(V.A.luotu);
    for (const p of V.perheet) {
      const ika = p.ajoAika ? (luotu - Date.parse(p.ajoAika)) / H : null;
      if (ika != null && ika > AJO_IKA_RAJA_H) halytykset.push('Perheen ' + p.id + ' ajo oli rakennushetkellä ' + ika.toFixed(0) + ' h vanha (raja ' + AJO_IKA_RAJA_H + ' h).');
    }
  }
  const arkistoa = existsSync(ARKISTO) && readdirSync(ARKISTO).some((f) => f.endsWith('.json'));
  if (!arkistoon && !arkistoa) {
    kerro('Ei arkistoa eikä uutta aaltovarastoa arkistoitavaksi — havaintoja ei haeta.');
  } else if (!arkistoon && !vertailuun) {
    kerro('Aaltovarasto ' + (V ? V.A.luotu : '—') + ' on jo arkistossa; vertailtu ' + tila.vertailtu + ' — seuraava vertailu tunnin välein.');
  } else {
    const { poijut, lahteet } = await havainnot();
    kerro('Havainnot: FMI ' + lahteet.fmi + ', NDBC ' + lahteet.ndbc + '/' + NDBC.length + ', Marine Institute ' + lahteet.mi + '.');
    /* Tunnetut poijut (FMI ja M-poijut vastauksesta) jäävät muistiin
       kahdeksi viikoksi, jottei havaintohaun hetkellinen vika jätä niitä
       arkistosta pois. */
    const tunnetut = tila.tunnetut || {};
    for (const p of poijut) if (p.lahde !== 'ndbc') tunnetut[p.id] = { lahde: p.lahde, nimi: p.nimi, lat: p.lat, lng: p.lng, alue: p.alue, km: p.km, nahty: iso(nyt) };
    for (const [id, p] of Object.entries(tunnetut)) if (nyt - Date.parse(p.nahty) > TUNNETTU_MS) delete tunnetut[id];
    tila.tunnetut = tunnetut;
    for (const l of ['fmi', 'ndbc', 'mi']) if (lahteet[l] === 0 || typeof lahteet[l] === 'string') huomiot.push('Lähde ' + l + ' ei antanut yhtään poijua: ' + lahteet[l] + '.');

    if (arkistoon) {
      const rekisteri = new Map(NDBC.map((p) => ['ndbc-' + p.id, Object.assign({}, p, { id: 'ndbc-' + p.id, lahde: 'ndbc' })]));
      for (const [id, p] of Object.entries(tunnetut)) if (!rekisteri.has(id)) rekisteri.set(id, Object.assign({ id }, p));
      const a = await arkistoi(V, [...rekisteri.values()]);
      tila.arkistoitu = V.A.luotu;
      kerro('Arkistoitiin aaltovaraston ennuste ' + V.A.luotu + ' (' + a.poijuja + ' poijua, 0–' + LEAD_H + ' h): ' + a.nimi + '.');
    }
    if (existsSync(ARKISTO)) {
      for (const f of readdirSync(ARKISTO)) {
        const e = lueJson(join(ARKISTO, f), null);
        if (!e || nyt - Date.parse(e.luotu) > SAILYTYS_MS) { rmSync(join(ARKISTO, f)); kerro('Poistettiin vanha ' + f + '.'); }
      }
    }
    if (vertailuun) {
      const P = lueJson(paivatPolku, { versio: 1, paivat: {} });
      const tulos = vertaa(poijut, nyt, P.paivat);
      if (tulos) {
        const avaimet = Object.keys(P.paivat).sort();
        while (avaimet.length > PAIVAT_N) delete P.paivat[avaimet.shift()];
        writeFileSync(paivatPolku, JSON.stringify(P));
        writeFileSync(join(HAKEMISTO, 'tulos.json'), JSON.stringify(tulos, null, 1));
        tila.vertailtu = tulos.laskettu;
        if (tulos.kirjatut.length) kerro('Kirjattiin vuorokausi ' + tulos.kirjatut.join(', ') + ' (`paivat.json`).');
        for (const alue of Object.keys(ALUEET)) {
          const v = tulos.vrk['paras|' + alue];
          if (v && v.n >= 30) {
            if (Math.abs(v.harha) > 0.3) halytykset.push('Parhaan harha alueella ' + ALUEET[alue] + ' viimeisen vuorokauden pareissa ' + fmt(v.harha) + ' m (raja 0,3).');
            if (v.si != null && v.si > 0.5) halytykset.push('Parhaan SI alueella ' + ALUEET[alue] + ' ' + fmt(v.si) + ' (raja 0,5).');
          }
          const d = tulos.vrkSuunta[alue];
          if (d && d.n >= 30 && d.mediaani > 60) halytykset.push('Parhaan suunnan mediaaniero alueella ' + ALUEET[alue] + ' ' + fmt(d.mediaani) + '° kun Hs ≥ 1 m (raja 60°).');
        }
        const kert = kertyma(P.paivat, nyt);
        for (const [kk, q] of Object.entries(kert.parit)) {
          const [p, alue, l] = kk.split('|');
          if (p === 'paras' || l !== 'kaikki' || q.n < 200 || !(q.rmse > q.rmseEc * 1.05)) continue;
          const vrt = '(RMSE ' + fmt(q.rmse) + ' vs ' + fmt(q.rmseEc) + ' m, n ' + q.n + ', ' + kert.vrk + ' vrk)';
          huomiot.push(p.startsWith('paras←')
            ? 'Parhaan tunnit joilla pääperhe on ' + p.slice(6) + ' ovat alueella ' + (ALUEET[alue] || alue) + ' ECMWF WAM 9 km:ää heikompia ' + vrt + ' — mittari 5: perhe ei kuulu siellä Parhaaseen.'
            : p + ' on alueella ' + (ALUEET[alue] || alue) + ' ECMWF WAM 9 km:ää heikompi pareittain ' + vrt + '.');
        }
        kerro('Vertailtiin ' + tulos.ennusteita + ' arkistoitua ennustetta ' + tulos.poijuja + ' poijun havaintoihin.');
        /* EKSTRAPOLOINNIN RAJA (docs/aallot.md P4): poijut joissa perheen
           luku on rakentajan jatketta. */
        const jatkeella = Object.keys(tulos.jatke).filter((kk) => kk.endsWith('|jatke') && tulos.jatke[kk].n);
        if (!jatkeella.length) kerro('Yksikään poiju ei ole minkään perheen jatkeella (etäisyys märkään pisteeseen > mallin solmuväli), joten ekstrapoloinnin rajaa ei vielä mitata poijuilla.');
        for (const kk of jatkeella) {
          const p = kk.split('|')[0], a = tulos.jatke[kk], b = tulos.jatke[p + '|oma'] || {};
          kerro(p + ' jatkeella: n ' + a.n + ', RMSE ' + fmt(a.rmse) + ' m, harha ' + fmt(a.harha) + ' m; omalla vedellä n ' + (b.n || 0) + ', RMSE ' + fmt(b.rmse) + ' m.');
        }
        viestit.push('\n' + taulukot(tulos, kert));
      }
    }
  }
  writeFileSync(tilaPolku, JSON.stringify(tila, null, 1));
  for (const h of huomiot.reverse()) viestit.unshift('HUOMIO: ' + h);
  for (const h of halytykset.reverse()) viestit.unshift('HÄLYTYS: ' + h);
}

try { await aja(); } catch (e) { kerro('Virhe: ' + e.message); }
console.log('### Aaltojen varmennus\n');
for (const v of viestit) console.log(v.startsWith('\n') ? v : '- ' + v);
for (const v of viestit) if (!v.startsWith('\n')) console.error('aaltovarmennus: ' + v);
