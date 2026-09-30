#!/usr/bin/env node
/* JATKUVA VARMENNUS — varasto havaintoja vasten joka päivä
 * (docs/oikeellisuus.md, O11).
 *
 *   node tools/varmennus.mjs <havaintovaraston-hakemisto>
 *
 * MIKSI. Auditointi 29.9.2026 oli kertamittaus: mikään ei huomaisi, jos
 * rakentaja, lähde tai proxy alkaisi tuottaa väärää dataa (suunnan
 * kierto, yksikkö, aikasiirto, pysähtynyt varasto) — kartalla se näyttäisi
 * uskottavalta. Laitekohtainen `Osuvuus` vaatii kortin avauksia eikä
 * näe muiden käyttäjien otosta.
 *
 * KAKSI VAIHETTA, molemmat havainnot-työnkulun ajossa (vain Noden omat
 * moduulit):
 *
 *   1. ARKISTO. Kun varaston luettelon `luotu` on uusi, ennuste luetaan
 *      rekisterin asemille (sama rekisteri kuin sovelluksella:
 *      `api/fmi.js`:n `STATIONS`, tagit `index.html`:n
 *      `FMI_MAP_STATIONS`ista) tunneittain 0–72 h rakennushetkestä:
 *      jokainen perhe erikseen (FMI, MET Nordic, ECMWF) ja Paras-sekoitus
 *      samalla säännöllä kuin `Saalaatat.naytteista` (painokanava kertaa
 *      aikapaino, tärkein ensin). -> `varmennus/ennusteet/<luotu>.json`,
 *      säilytys 4 vrk.
 *
 *   2. VERTAILU (enintään kerran tunnissa). FMI:n havainnot yhdellä
 *      kyselyllä (`kaikkiAsemat`, sama kuin kartan merkeillä), jokainen
 *      arkistoitu ennuste jokaista jo havaittua tuntia vasten: harha ja
 *      MAE perheittäin, ennusteen iän (tunnit rakennuksesta) ja
 *      asematyypin (meri / maa) mukaan; suunnan MAE kun tuuli >= 3 m/s;
 *      puuska tunnin maksimia (10 min puuskista) vasten.
 *      -> `varmennus/tulos.json` ja ajon yhteenveto.
 *
 * HÄLYTYKSET (yhteenvetoon, eivät kaada ajoa): Paras-sekoituksen harha
 * yli 1,5 m/s tai suunnan MAE yli 30° viimeisen vuorokauden pareissa
 * (n >= 30), varasto yli 8 h vanha, asema hiljaa koko 24 h ikkunan.
 *
 * Havainto hetkellä t on FMI:n 10 min keskiarvo joka päättyy t:hen.
 * Ennuste on varaston tunnin arvo, ECMWF:llä 3 h askeleen välistä
 * interpoloituna kuten sovelluksessa. */

import { gunzipSync } from 'node:zlib';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { STATIONS, kaikkiAsemat } from '../api/fmi.js';

const VARASTO_DIR = process.argv[2] || 'varasto';
const HAKEMISTO = join(VARASTO_DIR, 'varmennus');
const ARKISTO = join(HAKEMISTO, 'ennusteet');
const REPO = process.env.GITHUB_REPOSITORY || 'Jere-stack/wind';
const KANTA = process.env.SAADATA_KANTA || ('https://raw.githubusercontent.com/' + REPO + '/saadata/');
const LEAD_H = 72;
const SAILYTYS_MS = 4 * 864e5;
const VERTAILU_VALI_MS = 55 * 60e3;
const HAV_H = 96;
const KAISTAT = [[0, 6], [6, 12], [12, 24], [24, 48], [48, 73]];
const PERHEET = ['paras', 'fmi', 'metnordic', 'ecmwf'];

const viestit = [];
const kerro = (s) => viestit.push(s);
const pyor = (x, d) => (x == null || !isFinite(x) ? null : Math.round(x * Math.pow(10, d)) / Math.pow(10, d));

/* ── Rekisteri: FMISID palvelimelta, tagi sovelluksesta ─────────── */
function rekisteri() {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const lohko = /const FMI_MAP_STATIONS = \[([\s\S]*?)\n\];/.exec(html);
  const tagit = {};
  if (lohko) {
    const re = /place:'([^']+)'[^}]*?tag:(null|'([^']+)')/g;
    let m;
    while ((m = re.exec(lohko[1]))) tagit[m[1]] = m[3] || null;
  }
  return STATIONS.map((s) => ({ place: s.place, name: s.name, lat: s.lat, lng: s.lng,
    meri: tagit[s.place] === 'Meri' || tagit[s.place] === 'Avomeri' }));
}

/* ── Varaston laatat, kuten sovellus ne lukee ───────────────────── */
async function haeJson(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url);
  return r.json();
}
const _laatat = new Map();
async function laatta(L, taso, la0, lo0) {
  const nimi = taso.id + '/' + la0 + '_' + lo0 + '.bin.gz';
  if (_laatat.has(nimi)) return _laatat.get(nimi);
  const r = await fetch(KANTA + nimi + '?v=' + encodeURIComponent(L.luotu), { signal: AbortSignal.timeout(20000) });
  let l = null;
  if (r.ok) {
    const b = gunzipSync(Buffer.from(await r.arrayBuffer()));
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
    const nx = dv.getUint16(20, true), ny = dv.getUint16(22, true), nt = dv.getUint16(24, true);
    const koko = nt * nx * ny, O = 40;
    l = { askel: dv.getFloat32(8, true), la0: dv.getFloat32(12, true), lo0: dv.getFloat32(16, true), nx, ny, nt,
      nop: b.subarray(O, O + koko), suunta: b.subarray(O + koko, O + 2 * koko), puuska: b.subarray(O + 2 * koko, O + 3 * koko),
      paino: (dv.getUint8(39) & 1) ? b.subarray(O + 3 * koko, O + 3 * koko + nx * ny) : null };
  }
  _laatat.set(nimi, l);
  return l;
}
/* Perheen hienoin taso joka kattaa paikan (spottikortin askel 0,05°). */
function perheenTaso(L, perhe, lat, lng) {
  const tasot = L.tasot.concat(L.lisatasot || [])
    .filter((t) => (t.perhe || 'ecmwf') === perhe && lat >= t.lat[0] && lat <= t.lat[1] && lng >= t.lng[0] && lng <= t.lng[1])
    .sort((a, b) => a.askel - b.askel);
  return tasot[0] || null;
}
const ss = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));

/* Yhden perheen näyte: paikassa bilineaarinen (nopeus keskiarvona,
   suunta yksikkövektoreista), ajassa nopeus ja suunta erikseen — sama
   järjestys kuin `Saalaatat._naytePerhe`. Palauttaa { ms, g, dir, paino,
   aikaW } tai null. */
async function perheNayte(L, perhe, lat, lng, tMs) {
  const taso = perheenTaso(L, perhe, lat, lng);
  if (!taso) return null;
  const span = taso.span;
  const la0 = +(Math.floor(lat / span) * span).toFixed(4), lo0 = +(Math.floor(lng / span) * span).toFixed(4);
  if (!taso.laatat.some(([a, b]) => Math.abs(a - la0) < 1e-6 && Math.abs(b - lo0) < 1e-6)) return null;
  const l = await laatta(L, taso, la0, lo0);
  if (!l) return null;
  const ajat = taso.ajat || L.ajat;
  if (tMs < ajat[0] || tMs > ajat[ajat.length - 1]) return null;
  const aikaW = perhe === 'ecmwf' ? 1 : ss((tMs - ajat[0]) / (2 * 36e5)) * ss((ajat[ajat.length - 1] - tMs) / (6 * 36e5));
  const fy = (lat - l.la0) / l.askel, fx = (lng - l.lo0) / l.askel;
  const iy = Math.max(0, Math.min(l.ny - 2, Math.floor(fy))), ix = Math.max(0, Math.min(l.nx - 2, Math.floor(fx)));
  const wy = Math.max(0, Math.min(1, fy - iy)), wx = Math.max(0, Math.min(1, fx - ix));
  const k = [iy * l.nx + ix, iy * l.nx + ix + 1, (iy + 1) * l.nx + ix, (iy + 1) * l.nx + ix + 1];
  const w = [(1 - wy) * (1 - wx), (1 - wy) * wx, wy * (1 - wx), wy * wx];
  const paino = l.paino ? k.reduce((a, kk, i) => a + l.paino[kk] * w[i], 0) / 255 : 1;
  let b = 0;
  while (b < ajat.length && ajat[b] < tMs) b++;
  const a = ajat[b] === tMs ? b : b - 1, f = ajat[b] === tMs ? 0 : (tMs - ajat[a]) / (ajat[b] - ajat[a]);
  const T = L.tyhja, taso2 = l.nx * l.ny;
  const paikassa = (ti) => {
    let sN = 0, wN = 0, sS = 0, sC = 0, wD = 0, sG = 0, wG = 0;
    for (let c = 0; c < 4; c++) {
      if (w[c] <= 1e-6) continue;
      const kk = ti * taso2 + k[c], v = l.nop[kk];
      if (v === T) continue;
      sN += v * w[c]; wN += w[c];
      const d = l.suunta[kk];
      if (d !== T) { const r = d * L.suuntaAskel * Math.PI / 180; sS += Math.sin(r) * w[c]; sC += Math.cos(r) * w[c]; wD += w[c]; }
      const g = l.puuska[kk];
      if (g !== T) { sG += g * w[c]; wG += w[c]; }
    }
    if (!wN) return null;
    const ms = sN / wN * L.nopAskel;
    /* Puuttuva puuska on tuuli, kuten asiakkaan `_paikassa`ssa. */
    return { ms, g: wG ? sG / wG * L.nopAskel : ms, dir: wD ? (Math.atan2(sS / wD, sC / wD) * 180 / Math.PI + 360) % 360 : 0 };
  };
  const A = paikassa(a);
  if (!A) return null;
  if (f === 0) return Object.assign(A, { paino, aikaW });
  const B = paikassa(b);
  if (!B) return null;
  const dd = ((B.dir - A.dir) % 360 + 540) % 360 - 180;
  return { ms: A.ms + (B.ms - A.ms) * f, g: A.g + (B.g - A.g) * f, dir: ((A.dir + dd * f) % 360 + 360) % 360, paino, aikaW };
}

/* Paras-sekoitus: `Saalaatat.naytteista` ilman mallin omaa hilaa (kartta
   uloimmilla zoomeilla ja aikajana). */
function sekoita(nayt) {
  let jaljella = 1, sN = 0, sG = 0, sS = 0, sC = 0, sW = 0;
  for (const [perhe, n] of nayt) {
    if (jaljella <= 0.002) break;
    const pohja = perhe === 'ecmwf';
    if (!n) { if (pohja && !sW) return null; continue; }
    let w = n.aikaW;
    if (!pohja) w *= n.paino;
    if (w <= 0) continue;
    const c = jaljella * w, r = n.dir * Math.PI / 180;
    sN += c * n.ms; sG += c * n.g; sS += c * Math.sin(r); sC += c * Math.cos(r); sW += c;
    jaljella *= (1 - w);
  }
  if (!sW) return null;
  return { ms: sN / sW, g: sG / sW, dir: (Math.atan2(sS, sC) * 180 / Math.PI + 360) % 360 };
}

async function arkistoi(L, asemat) {
  const luotu = Date.parse(L.luotu);
  const t0 = Math.floor(luotu / 36e5) * 36e5;
  const n = LEAD_H + 1;
  const ajo = (id) => { const t = L.tasot.concat(L.lisatasot || []).find((x) => x.id === id); return t && t.ajoAika || null; };
  const ulos = { luotu: L.luotu, ajot: { ecmwf: L.ajoAika, fmi: ajo('h0'), metnordic: ajo('n0') }, t0, n, asemat: {} };
  for (const a of asemat) {
    const s = { ws: {}, wd: {}, wg: {} };
    for (const p of PERHEET) { s.ws[p] = []; s.wd[p] = []; s.wg[p] = []; }
    for (let i = 0; i < n; i++) {
      const t = t0 + i * 36e5;
      const nayt = [];
      for (const p of ['fmi', 'metnordic', 'ecmwf']) nayt.push([p, await perheNayte(L, p, a.lat, a.lng, t)]);
      const arvot = { paras: sekoita(nayt) };
      for (const [p, v] of nayt) arvot[p] = v && (p === 'ecmwf' || (v.aikaW > 0 && v.paino > 0.5)) ? v : null;
      for (const p of PERHEET) {
        const v = arvot[p];
        s.ws[p].push(v ? pyor(v.ms, 1) : null);
        s.wd[p].push(v ? Math.round(v.dir) : null);
        s.wg[p].push(v ? pyor(v.g, 1) : null);
      }
    }
    ulos.asemat[a.place] = s;
  }
  mkdirSync(ARKISTO, { recursive: true });
  const nimi = new Date(luotu).toISOString().replace(/[:.]/g, '-') + '.json';
  writeFileSync(join(ARKISTO, nimi), JSON.stringify(ulos));
  return nimi;
}

/* Havainnot tunneittain: tuuli ja suunta tasatunnin 10 min rivistä,
   puuska tunnin (t−60, t] kymmenminuuttisten maksimi. */
function havainnotTunneittain(d) {
  const ulos = {};
  for (const [place, s] of Object.entries(d.asemat)) {
    if (!s) continue;
    const h = new Map();
    for (let i = 0; i < d.n; i++) {
      const t = d.t0 + i * d.dt;
      if (t % 36e5 !== 0 || s.ws[i] == null) continue;
      let g = null;
      for (let j = i - 5; j <= i; j++) if (j >= 0 && s.wg[j] != null) g = g == null ? s.wg[j] : Math.max(g, s.wg[j]);
      h.set(t, { ws: s.ws[i], wd: s.wd[i], wg: g });
    }
    ulos[place] = h;
  }
  return ulos;
}

function kerain() { return { n: 0, sE: 0, sA: 0, nD: 0, sD: 0, nG: 0, sGE: 0, sGA: 0 }; }
function lisaa(k, f, o, fd, od, fg, og) {
  k.n++; k.sE += f - o; k.sA += Math.abs(f - o);
  if (o >= 3 && fd != null && od != null) { const dd = Math.abs(((fd - od) % 360 + 540) % 360 - 180); k.nD++; k.sD += dd; }
  if (fg != null && og != null) { k.nG++; k.sGE += fg - og; k.sGA += Math.abs(fg - og); }
}
function tiivista(k) {
  return { n: k.n, harha: k.n ? pyor(k.sE / k.n, 2) : null, mae: k.n ? pyor(k.sA / k.n, 2) : null,
    suuntaMae: k.nD ? pyor(k.sD / k.nD, 1) : null, nSuunta: k.nD,
    puuskaHarha: k.nG ? pyor(k.sGE / k.nG, 2) : null, puuskaMae: k.nG ? pyor(k.sGA / k.nG, 2) : null };
}

async function vertaa(asemat, nyt) {
  const tiedostot = existsSync(ARKISTO) ? readdirSync(ARKISTO).filter((f) => f.endsWith('.json')).sort() : [];
  if (!tiedostot.length) { kerro('Arkistossa ei vielä ennusteita — vertailu odottaa ensimmäistä.'); return null; }
  const d = await kaikkiAsemat(HAV_H, 25000);
  if (!d) throw new Error('FMI ei palauttanut yhtään asemaa');
  const hav = havainnotTunneittain(d);
  const tyyppi = Object.fromEntries(asemat.map((a) => [a.place, a.meri ? 'meri' : 'maa']));
  const k = {}, kVrk = {};
  const avain = (p, kaista, ty) => p + '|' + kaista + '|' + ty;
  for (const f of tiedostot) {
    const e = JSON.parse(readFileSync(join(ARKISTO, f), 'utf8'));
    const luotu = Date.parse(e.luotu);
    for (const [place, s] of Object.entries(e.asemat)) {
      const h = hav[place];
      if (!h) continue;
      for (let i = 0; i < e.n; i++) {
        const t = e.t0 + i * 36e5;
        if (t > nyt) break;
        const o = h.get(t);
        if (!o) continue;
        const lead = (t - luotu) / 36e5;
        if (lead < 0) continue;
        const kaista = KAISTAT.findIndex(([a, b]) => lead >= a && lead < b);
        if (kaista < 0) continue;
        for (const p of PERHEET) {
          const fws = s.ws[p][i];
          if (fws == null) continue;
          for (const ty of [tyyppi[place], 'kaikki']) {
            const kk = avain(p, KAISTAT[kaista].join('–'), ty);
            lisaa(k[kk] || (k[kk] = kerain()), fws, o.ws, s.wd[p][i], o.wd, s.wg[p][i], o.wg);
          }
          if (t > nyt - 864e5) lisaa(kVrk[p] || (kVrk[p] = kerain()), fws, o.ws, s.wd[p][i], o.wd, s.wg[p][i], o.wg);
        }
      }
    }
  }
  const tulos = { laskettu: new Date(nyt).toISOString(), ennusteita: tiedostot.length,
    havaintoasemia: Object.keys(hav).length, ryhmat: {}, vrk: {} };
  for (const [kk, v] of Object.entries(k)) tulos.ryhmat[kk] = tiivista(v);
  for (const [p, v] of Object.entries(kVrk)) tulos.vrk[p] = tiivista(v);
  tulos.hiljaiset = asemat.filter((a) => !hav[a.place] || ![...hav[a.place].keys()].some((t) => t > nyt - 864e5)).map((a) => a.place);
  return tulos;
}

function taulukko(tulos) {
  const rivit = ['| perhe | ikä h | tyyppi | n | harha m/s | MAE m/s | suunta MAE ° | puuskan harha | puuskan MAE |', '|---|---|---|---|---|---|---|---|---|'];
  for (const p of PERHEET) {
    for (const [a, b] of KAISTAT) {
      for (const ty of ['kaikki', 'meri', 'maa']) {
        const r = tulos.ryhmat[p + '|' + a + '–' + b + '|' + ty];
        if (!r || !r.n) continue;
        rivit.push('| ' + [p, a + '–' + (b - 1), ty, r.n, r.harha, r.mae, r.suuntaMae, r.puuskaHarha, r.puuskaMae].map((x) => x == null ? '—' : x).join(' | ') + ' |');
      }
    }
  }
  return rivit.join('\n');
}

async function aja() {
  const nyt = Date.now();
  const asemat = rekisteri();
  mkdirSync(HAKEMISTO, { recursive: true });
  const tilaPolku = join(HAKEMISTO, 'tila.json');
  let tila = {};
  try { tila = JSON.parse(readFileSync(tilaPolku, 'utf8')); } catch (e) { tila = {}; }

  /* 1. Arkisto */
  const L = await haeJson(KANTA + 'luettelo.json?t=' + Math.floor(nyt / 60000));
  const ika = nyt - Date.parse(L.luotu);
  if (tila.arkistoitu !== L.luotu) {
    const nimi = await arkistoi(L, asemat);
    tila.arkistoitu = L.luotu;
    kerro('Arkistoitiin varaston ennuste ' + L.luotu + ' (' + asemat.length + ' asemaa, 0–' + LEAD_H + ' h): ' + nimi + '.');
  } else kerro('Varasto ' + L.luotu + ' on jo arkistossa.');
  if (existsSync(ARKISTO)) {
    for (const f of readdirSync(ARKISTO)) {
      const e = JSON.parse(readFileSync(join(ARKISTO, f), 'utf8'));
      if (nyt - Date.parse(e.luotu) > SAILYTYS_MS) { rmSync(join(ARKISTO, f)); kerro('Poistettiin vanha ' + f + '.'); }
    }
  }
  const halytykset = [];
  if (ika > 8 * 36e5) halytykset.push('Varasto on ' + (ika / 36e5).toFixed(1) + ' h vanha (raja 8 h).');

  /* 2. Vertailu, enintään kerran tunnissa */
  if (tila.vertailtu && nyt - Date.parse(tila.vertailtu) < VERTAILU_VALI_MS) {
    kerro('Vertailtu ' + tila.vertailtu + ' — seuraava vertailu tunnin välein.');
  } else {
    const tulos = await vertaa(asemat, nyt);
    if (tulos) {
      writeFileSync(join(HAKEMISTO, 'tulos.json'), JSON.stringify(tulos, null, 1));
      tila.vertailtu = tulos.laskettu;
      const p = tulos.vrk.paras;
      if (p && p.n >= 30) {
        if (Math.abs(p.harha) > 1.5) halytykset.push('Paras-sekoituksen harha viimeisen vuorokauden pareissa ' + p.harha + ' m/s (raja 1,5).');
        if (p.suuntaMae != null && p.nSuunta >= 30 && p.suuntaMae > 30) halytykset.push('Suunnan MAE ' + p.suuntaMae + '° (raja 30°).');
      }
      if (tulos.hiljaiset.length) kerro('Hiljaa koko vuorokauden: ' + tulos.hiljaiset.join(', ') + '.');
      kerro('Vertailtiin ' + tulos.ennusteita + ' arkistoitua ennustetta ' + tulos.havaintoasemia + ' aseman havaintoihin.');
      viestit.push('\n' + taulukko(tulos));
    }
  }
  writeFileSync(tilaPolku, JSON.stringify(tila, null, 1));
  for (const h of halytykset) viestit.unshift('HÄLYTYS: ' + h);
}

try { await aja(); } catch (e) { kerro('Virhe: ' + e.message); }
console.log('### Varmennus\n');
for (const v of viestit) console.log(v.startsWith('\n') ? v : '- ' + v);
for (const v of viestit) if (!v.startsWith('\n')) console.error('varmennus: ' + v);
