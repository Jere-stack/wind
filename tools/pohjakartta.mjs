/* Oma pohjakartta: vektorilaatat ja rinnevarjostus yhdeksi tiedostopariksi
 * (docs/pohjakartta.md, toteutus 17.10.).
 *
 *   node tools/pohjakartta.mjs <hakemisto> [--vain=pohja|rinne] [--pvm=YYYYMMDD]
 *
 * Kirjoittaa hakemistoon `pohja-<versio>.pmtiles` (vektori), `rinne-<versio>
 * .pmtiles` (rinnevarjostus, harmaa + alfa PNG) ja `luettelo.json`in, joka
 * kertoo sovellukselle tiedostojen nimet, tasot ja lähteet. Tiedostot
 * julkaistaan orpoon haaraan `pohjakartta` (ks. docs/pohjakartta.md,
 * "Julkaisu"), ja sovellus lukee ne yhdestä kodista.
 *
 * VEKTORI on Protomapsin päivittäisestä OpenStreetMap-rakennuksesta
 * (build.protomaps.com, ODbL): siitä luetaan HTTP:n Range-pyynnöillä vain
 * tarvittavat laatat, ja niistä jätetään vain se mitä kartta piirtää —
 * maa (earth), vesialueet (water, ei riuttoja), valtioiden rajat,
 * paikannimet ja moottoritiet. Tasoja on kolme kerrosta (TASOT), koska
 * koko maailma lähizoomiin olisi satoja gigatavuja: maailma z0–6, Eurooppa
 * z7–10 ja rannikko z11–12. Sovellus piirtää jokaisen kerroksen omana
 * lähteenään päällekkäin, joten puuttuva tarkempi laatta näyttää
 * karkeamman kerroksen.
 *
 * RINNE on Mapzenin Terrain Tiles -korkeusmallista (AWS Open Data,
 * Terrarium-PNG) laskettu varjostus: harmaa + alfa, varjo mustana ja
 * valo valkoisena, meri ja tasainen maa läpinäkyviä (identtiset laatat
 * tallentuvat kerran). Maailma z0–6 ja Eurooppa z7–8; sovelluksen lukija
 * suurentaa puuttuvan laatan lähimmästä emosta.
 *
 * Vain Noden omia moduuleita (PNG:n luku ja kirjoitus on tässä). */

import { gunzipSync, gzipSync, inflateSync, deflateSync } from 'node:zlib';
import { writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { kirjoita, lueHakemisto, laattaId, avaa } from './pmtiles.mjs';

const ARGS = process.argv.slice(2);
const ULOS = resolve(ARGS.find(a => !a.startsWith('--')) || 'pohjakartta');
const VAIN = (ARGS.find(a => a.startsWith('--vain=')) || '').slice(7);
const PVM = (ARGS.find(a => a.startsWith('--pvm=')) || '').slice(6);

/* Kerrokset: [länsi, etelä, itä, pohjoinen]. Eurooppa kattaa Kanariansaaret,
   Azorit ja Islannin (asetusmittauksen näkymät). Rannikko on Suomen
   rannikko ja jokaisen spotin ympäristö (SPOTIT). */
const EUROOPPA = [-32, 26, 45, 72];
const SUOMEN_RANNIKKO = [[19.0, 59.4, 30.5, 61.0], [20.5, 61.0, 22.5, 64.0], [21.0, 63.0, 26.0, 66.0]];
const SPOTIT = [[4.9, 52.4]];                      /* Suomen ulkopuoliset (Pampus) */
export const TASOT = {
  maailma:  { z: [0, 6], alueet: [[-180, -85, 180, 85]] },
  eurooppa: { z: [7, 10], alueet: [EUROOPPA] },
  rannikko: { z: [11, 12], alueet: SUOMEN_RANNIKKO.concat(SPOTIT.map(([x, y]) => [x - 0.35, y - 0.2, x + 0.35, y + 0.2])) },
};
const RINNE = { maailma: [0, 6], eurooppa: [7, 8] };

/* ── HTTP ────────────────────────────────────────────────────────────── */
async function hae(url, alku, loppu, kerrat = 4) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, alku == null ? {} : { headers: { Range: 'bytes=' + alku + '-' + loppu } });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return Buffer.from(await r.arrayBuffer());
    } catch (e) {
      if (k >= kerrat) throw e;
      await new Promise(f => setTimeout(f, 500 * 2 ** k));
    }
  }
}
async function allas(tehtavat, n, f) {
  let i = 0, valmis = 0;
  const t0 = Date.now();
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < tehtavat.length) {
      const t = tehtavat[i++];
      await f(t);
      if (++valmis % 2000 === 0) process.stdout.write('  ' + valmis + '/' + tehtavat.length + ' ' + Math.round((Date.now() - t0) / 1000) + ' s\n');
    }
  }));
}

/* ── Etä-PMTiles (lähde) ─────────────────────────────────────────────── */
async function etaArkisto(url) {
  const alku = await hae(url, 0, 16383);
  const u64 = i => Number(alku.readBigUInt64LE(i));
  const h = { juuri: u64(8), juuriP: u64(16), lehdet: u64(40), data: u64(56) };
  const juuri = lueHakemisto(alku.subarray(h.juuri, h.juuri + h.juuriP));
  const lehdet = new Map();
  const etsi = (rivit, id) => {
    let a = 0, z = rivit.length - 1;
    while (a <= z) { const m = (a + z) >> 1; if (rivit[m].id < id) a = m + 1; else if (rivit[m].id > id) z = m - 1; else return rivit[m]; }
    const r = rivit[z];
    return r && (r.ajo === 0 || id - r.id < r.ajo) ? r : null;
  };
  return {
    async laatta(z, x, y) {
      const id = laattaId(z, x, y);
      let rivit = juuri;
      for (let k = 0; k < 4; k++) {
        const r = etsi(rivit, id);
        if (!r) return null;
        if (r.ajo > 0) return hae(url, h.data + r.siirto, h.data + r.siirto + r.pituus - 1);
        const avain = r.siirto;
        if (!lehdet.has(avain)) lehdet.set(avain, hae(url, h.lehdet + r.siirto, h.lehdet + r.siirto + r.pituus - 1).then(lueHakemisto));
        rivit = await lehdet.get(avain);
      }
      return null;
    },
  };
}

async function tuoreinRakennus() {
  if (PVM) return 'https://build.protomaps.com/' + PVM + '.pmtiles';
  const nyt = Date.now();
  for (let d = 0; d < 10; d++) {
    const p = new Date(nyt - d * 864e5).toISOString().slice(0, 10).replace(/-/g, '');
    const url = 'https://build.protomaps.com/' + p + '.pmtiles';
    const r = await fetch(url, { headers: { Range: 'bytes=0-6' } }).catch(() => null);
    if (r && r.status === 206) return url;
  }
  throw new Error('Protomapsin rakennusta ei löytynyt kymmenen päivän ajalta');
}

/* ── MVT-suodatin ────────────────────────────────────────────────────── *
 * Kohteiden tavut kopioidaan sellaisinaan; tason avain- ja arvotaulukot
 * jäävät ennalleen (käyttämättömät arvot maksavat vähän, ja uudelleen-
 * koodaus olisi oma virhelähteensä). */
function lv(b, o) { let v = 0, s = 0, c; do { c = b[o.i++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; }
function ohita(b, o, t) {
  if (t === 0) lv(b, o); else if (t === 2) { const n = lv(b, o); o.i += n; } else if (t === 1) o.i += 8; else if (t === 5) o.i += 4;
  else throw new Error('MVT: tuntematon kenttätyyppi ' + t);
}
function kv(t, v) { while (v >= 0x80) { t.push((v % 128) | 0x80); v = Math.floor(v / 128); } t.push(v); }
function arvo(b, s, e) {
  const o = { i: s };
  while (o.i < e) {
    const k = lv(b, o), f = k >> 3, t = k & 7;
    if (f === 1) { const n = lv(b, o); const v = b.toString('utf8', o.i, o.i + n); o.i += n; return v; }
    if (f >= 4 && f <= 6) return lv(b, o);
    if (f === 7) return !!lv(b, o);
    if (f === 2) { const v = b.readFloatLE(o.i); o.i += 4; return v; }
    if (f === 3) { const v = b.readDoubleLE(o.i); o.i += 8; return v; }
    ohita(b, o, t);
  }
  return null;
}
const PIDA = {
  earth: (t, g) => g === 3,
  water: (t, g) => (g === 3 && t.kind !== 'reef') || (g === 1 && (t.kind === 'ocean' || t.kind === 'sea')),
  boundaries: (t) => t.kind === 'country',
  places: (t, g) => g === 1 && (t.kind === 'country' || t.kind === 'locality'),
  roads: (t, g) => g === 2 && t.kind === 'highway',
};
function suodata(b) {
  const ulos = [], o = { i: 0 };
  while (o.i < b.length) {
    const k = lv(b, o), f = k >> 3, t = k & 7;
    if (f !== 3 || t !== 2) { ohita(b, o, t); continue; }
    const n = lv(b, o), s = o.i, e = s + n; o.i = e;
    const l = { i: s }, avaimet = [], arvot = [], piirteet = [], muut = [];
    let nimi = null;
    while (l.i < e) {
      const a = l.i, kk = lv(b, l), ff = kk >> 3, tt = kk & 7;
      if (ff === 1) { const m = lv(b, l); nimi = b.toString('utf8', l.i, l.i + m); l.i += m; muut.push([a, l.i]); }
      else if (ff === 3) { const m = lv(b, l); avaimet.push(b.toString('utf8', l.i, l.i + m)); l.i += m; muut.push([a, l.i]); }
      else if (ff === 4) { const m = lv(b, l); arvot.push(arvo(b, l.i, l.i + m)); l.i += m; muut.push([a, l.i]); }
      else if (ff === 2) { const m = lv(b, l); piirteet.push([a, l.i, l.i + m]); l.i += m; }
      else { ohita(b, l, tt); muut.push([a, l.i]); }
    }
    const ehto = PIDA[nimi];
    if (!ehto) continue;
    const pidetyt = [];
    for (const [a, ps, pe] of piirteet) {
      const tag = {}, q = { i: ps };
      let g = 0;
      while (q.i < pe) {
        const kk = lv(b, q), ff = kk >> 3, tt = kk & 7;
        if (ff === 2 && tt === 2) { const m = lv(b, q), lp = q.i + m; while (q.i < lp) { const ki = lv(b, q), vi = lv(b, q); tag[avaimet[ki]] = arvot[vi]; } }
        else if (ff === 3 && tt === 0) g = lv(b, q);
        else ohita(b, q, tt);
      }
      if (ehto(tag, g)) pidetyt.push([a, pe]);
    }
    if (!pidetyt.length) continue;
    const runko = [];
    for (const [a, z] of muut) for (let i = a; i < z; i++) runko.push(b[i]);
    for (const [a, z] of pidetyt) for (let i = a; i < z; i++) runko.push(b[i]);
    ulos.push(0x1a); kv(ulos, runko.length);
    for (const x of runko) ulos.push(x);
  }
  return Buffer.from(ulos);
}

/* ── Laattojen luettelo alueista ─────────────────────────────────────── */
function lon2x(lon, z) { return Math.floor((lon + 180) / 360 * 2 ** z); }
function lat2y(lat, z) { const r = lat * Math.PI / 180; return Math.floor((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z); }
function laatatAlueille(alueet, z0, z1) {
  const ulos = new Map();
  for (let z = z0; z <= z1; z++) {
    const n = 2 ** z;
    for (const [w, s, e, nn] of alueet) {
      const x0 = Math.max(0, lon2x(w, z)), x1 = Math.min(n - 1, lon2x(e, z));
      const y0 = Math.max(0, lat2y(Math.min(nn, 85.05), z)), y1 = Math.min(n - 1, lat2y(Math.max(s, -85.05), z));
      for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) ulos.set(z + '/' + x + '/' + y, { z, x, y });
    }
  }
  return [...ulos.values()];
}

/* ── Vektori ─────────────────────────────────────────────────────────── */
async function rakennaPohja(versio) {
  const lahde = await tuoreinRakennus();
  console.log('Lähde:', lahde);
  const arkisto = await etaArkisto(lahde);
  const kaikki = [], tasot = {};
  for (const [nimi, T] of Object.entries(TASOT)) {
    const lista = laatatAlueille(T.alueet, T.z[0], T.z[1]);
    let raaka = 0, tavut = 0, n = 0;
    console.log(nimi, 'z' + T.z.join('–'), lista.length, 'laattaa');
    await allas(lista, 48, async (l) => {
      const d = await arkisto.laatta(l.z, l.x, l.y);
      if (!d) return;
      raaka += d.length;
      let s;
      try { s = suodata(gunzipSync(d)); }
      catch (e) { throw new Error(l.z + '/' + l.x + '/' + l.y + ' (' + d.length + ' t, ' + d.subarray(0, 4).toString('hex') + '): ' + e.message); }
      if (!s.length) return;
      const g = gzipSync(s, { level: 9 });
      tavut += g.length; n++;
      kaikki.push({ z: l.z, x: l.x, y: l.y, data: g, taso: nimi });
    });
    tasot[nimi] = { z: T.z, alueet: T.alueet, laatat: n, raakaMt: +(raaka / 1e6).toFixed(1), suodatettuMt: +(tavut / 1e6).toFixed(1) };
    console.log('  ', JSON.stringify(tasot[nimi]));
  }
  const osat = kirjoitaOsat('pohja-' + versio, kaikki, Object.entries(TASOT).map(([n, T]) => ({ nimi: n, z: T.z })), {
    tyyppi: 'mvt', pakkaus: 'gzip', keski: [24.9, 60.2], keskiZ: 6,
    meta: { name: 'FoilSpot pohja', lahde, attribution: '© OpenStreetMap contributors, Protomaps' },
  });
  return { lahde, tasot, osat };
}

/* OSAT ALLE 90 Mt: GitHubin tiedostoraja on 100 Mt, ja haara julkaistaan
   raw.githubusercontent.comista. Jokainen taso on oma osansa, ja liian
   suuri osa jaetaan kahtia pituussuunnassa tason ALIMMAN zoomin
   laattarajalta — silloin jokainen tarkempi laatta kuuluu kokonaan yhteen
   osaan. Sovelluksen lukija valitsee osan (z, x):n mukaan (`Pohjakartta`). */
const OSA_RAJA = 90e6;
function kirjoitaOsat(etuliite, laatat, tasot, o) {
  const osat = [];
  const jaa = (nimi, z, lista) => {
    const a = z[0];
    const xs = lista.map(l => l.x >> (l.z - a));
    let x0 = Infinity, x1 = -Infinity;
    for (const x of xs) { if (x < x0) x0 = x; if (x > x1) x1 = x; }
    const tavut = lista.reduce((s, l) => s + l.data.length, 0);
    if (tavut > OSA_RAJA && x1 > x0) {
      const m = (x0 + x1 + 1) >> 1;
      jaa(nimi, z, lista.filter((l, i) => xs[i] < m));
      jaa(nimi, z, lista.filter((l, i) => xs[i] >= m));
      return;
    }
    const tiedosto = etuliite + '-' + nimi + (osat.filter(q => q.taso === nimi).length ? '-' + osat.filter(q => q.taso === nimi).length : '') + '.pmtiles';
    const r = kirjoita(resolve(ULOS, tiedosto), lista, o);
    tarkista(resolve(ULOS, tiedosto), lista);
    console.log('  ', tiedosto, JSON.stringify(r));
    osat.push({ tiedosto, taso: nimi, z, x: [x0, x1], tavut: r.tavut });
  };
  for (const t of tasot) {
    const lista = laatat.filter(l => l.z >= t.z[0] && l.z <= t.z[1]);
    if (lista.length) jaa(t.nimi, t.z, lista);
  }
  return osat;
}

/* Jokainen kirjoitettu laatta luetaan takaisin omalla lukijalla. */
function tarkista(polku, laatat) {
  const a = avaa(polku);
  let vika = 0;
  for (const l of laatat) {
    const d = a.laatta(l.z, l.x, l.y);
    if (!d || Buffer.compare(d, l.data) !== 0) vika++;
  }
  if (vika) throw new Error(polku + ': ' + vika + ' laattaa ei lue takaisin');
  console.log('  luettu takaisin', laatat.length, '/', laatat.length);
}

/* ── PNG ─────────────────────────────────────────────────────────────── */
function lueRgb(png) {
  let i = 8, w = 0, h = 0, tyyppi = 0, syv = 0;
  const idat = [];
  while (i < png.length) {
    const n = png.readUInt32BE(i), t = png.toString('ascii', i + 4, i + 8), d = png.subarray(i + 8, i + 8 + n);
    if (t === 'IHDR') { w = d.readUInt32BE(0); h = d.readUInt32BE(4); syv = d[8]; tyyppi = d[9]; }
    else if (t === 'IDAT') idat.push(d);
    i += 12 + n;
  }
  if (syv !== 8 || (tyyppi !== 2 && tyyppi !== 6)) throw new Error('PNG: tyyppi ' + tyyppi + '/' + syv);
  const bpp = tyyppi === 6 ? 4 : 3, rivi = w * bpp, raw = inflateSync(Buffer.concat(idat));
  const ulos = Buffer.alloc(w * h * 3), ed = Buffer.alloc(rivi), nyt = Buffer.alloc(rivi);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (rivi + 1)], s = y * (rivi + 1) + 1;
    for (let x = 0; x < rivi; x++) {
      const a = x >= bpp ? nyt[x - bpp] : 0, b = ed[x], c = x >= bpp ? ed[x - bpp] : 0;
      let v = raw[s + x];
      if (f === 1) v += a; else if (f === 2) v += b; else if (f === 3) v += (a + b) >> 1;
      else if (f === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
      nyt[x] = v & 255;
    }
    for (let x = 0; x < w; x++) for (let k = 0; k < 3; k++) ulos[(y * w + x) * 3 + k] = nyt[x * bpp + k];
    nyt.copy(ed);
  }
  return { w, h, d: ulos };
}
const CRC = (() => { const t = new Int32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c; } return t; })();
function crc(b) { let c = -1; for (const x of b) c = CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ -1) >>> 0; }
function pala(t, d) { const p = Buffer.alloc(12 + d.length); p.writeUInt32BE(d.length, 0); p.write(t, 4, 'ascii'); d.copy(p, 8); p.writeUInt32BE(crc(p.subarray(4, 8 + d.length)), 8 + d.length); return p; }
/* Harmaa + alfa (värityyppi 4), suodin Sub joka rivillä. */
function kirjoitaGA(w, h, ga) {
  const raw = Buffer.alloc(h * (w * 2 + 1));
  for (let y = 0; y < h; y++) {
    const o = y * (w * 2 + 1); raw[o] = 1;
    for (let x = 0; x < w * 2; x++) { const v = ga[y * w * 2 + x], e = x >= 2 ? ga[y * w * 2 + x - 2] : 0; raw[o + 1 + x] = (v - e) & 255; }
  }
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 4;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pala('IHDR', ihdr), pala('IDAT', deflateSync(raw, { level: 9 })), pala('IEND', Buffer.alloc(0))]);
}

/* ── Rinnevarjostus ──────────────────────────────────────────────────── *
 * Korkeus Terrarium-koodista (r·256 + g + b/256 − 32768), meri nollaksi.
 * Rinne lasketaan 3 × 3 -laattojen mosaiikista, joten laattarajalla ei
 * ole saumaa. Valo luoteesta 45° korkeudelta ja toinen heikompi lännestä
 * (monisuuntainen, kuten Esrin tumma rinne), ja korostus kasvaa
 * loitonnettaessa: pikseli on z4:llä ~10 km, ja ilman korostusta vuoristo
 * olisi tasainen. Tulos: varjo mustana alfalla ≤ VARJO, valo valkoisena
 * alfalla ≤ VALO; |rinne| < kynnys on läpinäkyvää. */
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/';
const VARJO = 0.62, VALO = 0.20;
async function rakennaRinne(versio) {
  const muisti = new Map();
  const korkeus = (z, x, y) => {
    const n = 2 ** z; x = ((x % n) + n) % n;
    if (y < 0 || y >= n) return Promise.resolve(null);
    const k = z + '/' + x + '/' + y;
    if (!muisti.has(k)) muisti.set(k, hae(DEM + k + '.png').then(png => {
      if (!png) return null;
      const { d } = lueRgb(png), e = new Float32Array(65536);
      for (let i = 0; i < 65536; i++) e[i] = Math.max(0, d[i * 3] * 256 + d[i * 3 + 1] + d[i * 3 + 2] / 256 - 32768);
      return e;
    }));
    return muisti.get(k);
  };
  const lista = [];
  for (const [nimi, [z0, z1]] of Object.entries(RINNE)) {
    lista.push(...laatatAlueille(nimi === 'maailma' ? [[-180, -85, 180, 85]] : [EUROOPPA], z0, z1));
  }
  lista.sort((a, b) => a.z - b.z || a.y - b.y || a.x - b.x);
  console.log('rinne', lista.length, 'laattaa');
  const kaikki = [];
  let tyhjat = 0;
  const TYHJA = kirjoitaGA(256, 256, Buffer.alloc(256 * 256 * 2));
  await allas(lista, 24, async (l) => {
    const naap = await Promise.all([-1, 0, 1].flatMap(dy => [-1, 0, 1].map(dx => korkeus(l.z, l.x + dx, l.y + dy))));
    const keski = naap[4];
    const ga = Buffer.alloc(256 * 256 * 2);
    if (keski) {
      const e = (px, py) => {
        const tx = px < 0 ? 0 : px > 255 ? 2 : 1, ty = py < 0 ? 0 : py > 255 ? 2 : 1;
        const t = naap[ty * 3 + tx] || keski;
        return t[(((py % 256) + 256) % 256) * 256 + (((px % 256) + 256) % 256)];
      };
      /* Pikselin koko metreinä tämän rivin leveysasteella. */
      const n = 2 ** l.z;
      const korostus = Math.min(14, Math.max(1.3, 2.2 * 2 ** ((9 - l.z) * 0.45)));
      for (let py = 0; py < 256; py++) {
        const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (l.y + (py + 0.5) / 256) / n)));
        const m = 40075016.7 * Math.cos(lat) / (n * 256);
        for (let px = 0; px < 256; px++) {
          const h0 = e(px, py);
          const dzdx = ((e(px + 1, py - 1) + 2 * e(px + 1, py) + e(px + 1, py + 1)) - (e(px - 1, py - 1) + 2 * e(px - 1, py) + e(px - 1, py + 1))) / (8 * m);
          const dzdy = ((e(px - 1, py + 1) + 2 * e(px, py + 1) + e(px + 1, py + 1)) - (e(px - 1, py - 1) + 2 * e(px, py - 1) + e(px + 1, py - 1))) / (8 * m);
          if (h0 <= 0 && dzdx === 0 && dzdy === 0) continue;
          const gx = dzdx * korostus, gy = dzdy * korostus, nn = Math.sqrt(gx * gx + gy * gy + 1);
          /* Normaali (itä, pohjoinen, ylös) = (−gx, gy, 1)/nn, koska
             kuvan y kasvaa etelään. Valo atsimuutista az (myötäpäivään
             pohjoisesta) ja korkeudelta alt. */
          const valo = (az, alt) => {
            const a = az * Math.PI / 180, c = alt * Math.PI / 180;
            return (-gx * Math.sin(a) * Math.cos(c) + gy * Math.cos(a) * Math.cos(c) + Math.sin(c)) / nn;
          };
          const s = 0.7 * valo(315, 45) + 0.3 * valo(270, 50);
          const tasainen = 0.7 * Math.sin(45 * Math.PI / 180) + 0.3 * Math.sin(50 * Math.PI / 180);
          const ero = s - tasainen;
          const i = (py * 256 + px) * 2;
          /* Alfa 8:n portain: 3 % askel ei näy tummalla maalla (≈1,5/255),
             ja tiedosto puolittuu (Alpit z6 60 → 34 kt, Suomi z7 32 → 10). */
          const q = (v) => { const a = Math.round(v * 255 / 8) * 8; return a < 12 ? 0 : Math.min(255, a); };
          if (ero < -0.015) { ga[i] = 0; ga[i + 1] = q(Math.min(1, -ero / 0.7) * VARJO); }
          else if (ero > 0.015) { ga[i] = 255; ga[i + 1] = q(Math.min(1, ero / 0.3) * VALO); }
        }
      }
    }
    let kaikkiNolla = true;
    for (let i = 1; i < ga.length; i += 2) if (ga[i]) { kaikkiNolla = false; break; }
    if (kaikkiNolla) { tyhjat++; kaikki.push({ z: l.z, x: l.x, y: l.y, data: TYHJA }); return; }
    kaikki.push({ z: l.z, x: l.x, y: l.y, data: kirjoitaGA(256, 256, ga) });
    if (muisti.size > 3000) for (const k of [...muisti.keys()].slice(0, 1000)) muisti.delete(k);
  });
  const osat = kirjoitaOsat('rinne-' + versio, kaikki, Object.entries(RINNE).map(([n, z]) => ({ nimi: n, z })), {
    tyyppi: 'png', pakkaus: 'none', keski: [24.9, 60.2], keskiZ: 6,
    meta: { name: 'FoilSpot rinne', lahde: DEM, attribution: 'Mapzen Terrain Tiles (AWS Open Data)' },
  });
  console.log('rinne: tyhjiä', tyhjat, '/', kaikki.length);
  return { lahde: DEM, tasot: RINNE, osat };
}

/* ── Fontit ──────────────────────────────────────────────────────────── *
 * Nimien glyfit (MapLibren `glyphs`) samaan kotiin: Noto Sans (SIL OFL)
 * Protomapsin basemaps-assets-kokoelmasta. Latinalaiset, kreikka ja
 * kyrillinen sekä yleiset välimerkit — sovellus pyytää suomen- tai
 * englanninkielisen nimen, ja paikallinen nimi on varatie. Puuttuva alue
 * ei kaada mitään: sen merkit jäävät vain piirtämättä. */
const FONTIT = ['Noto Sans Regular', 'Noto Sans Medium'];
const ALUEET = ['0-255', '256-511', '512-767', '768-1023', '1024-1279', '7680-7935', '8192-8447'];
async function haeFontit() {
  let tavut = 0;
  for (const f of FONTIT) {
    mkdirSync(resolve(ULOS, 'fontit', f), { recursive: true });
    for (const a of ALUEET) {
      const b = await hae('https://protomaps.github.io/basemaps-assets/fonts/' + encodeURIComponent(f) + '/' + a + '.pbf');
      if (!b) throw new Error('fontti puuttuu: ' + f + ' ' + a);
      writeFileSync(resolve(ULOS, 'fontit', f, a + '.pbf'), b);
      tavut += b.length;
    }
  }
  console.log('fontit', FONTIT.length * ALUEET.length, 'tiedostoa', tavut, 't');
  return { fontit: FONTIT, alueet: ALUEET, lahde: 'protomaps/basemaps-assets (SIL OFL)' };
}

mkdirSync(ULOS, { recursive: true });
const versio = new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '');
const luettelo = { versio: 1, luotu: new Date().toISOString() };
if (VAIN !== 'rinne') luettelo.pohja = await rakennaPohja(versio);
if (VAIN !== 'pohja') luettelo.rinne = await rakennaRinne(versio);
if (!VAIN) luettelo.fontit = await haeFontit();
writeFileSync(resolve(ULOS, 'luettelo.json'), JSON.stringify(luettelo, null, 1));
console.log('valmis', ULOS);
