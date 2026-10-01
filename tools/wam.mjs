/* ------------------------------------------------------------------
   FMI WAM — AALTOENNUSTE HILANA SÄÄLAATTAVARASTOON.

   `api/wam.js` antaa saman mallin pisteeseen (spottikortti); tämä
   kirjoittaa sen kartalle laattapyramidiksi `a0`–`a3`. Luettelossa
   aallot ovat OMANA AVAIMENAAN (`luettelo.aallot`), eivät `tasot`- tai
   `lisatasot`-listassa: ne eivät ole tuulimalli, eikä niitä saa
   sekoittaa tuulen perheisiin (`Saalaatat.PERHEET`). Vanha asiakas ei
   tunne avainta eikä lue sitä.

   MITATTU 1.10.2026 (docs/data.md, "Aallot kartalle"):
     hila                1967 x 800, 0,01707° x 0,01746° (≈ 1 x 2 km),
                         koko Itämeri, märkiä pisteitä ≈ 220 000 (14 %)
     yksi tunti          Hs + suunta koko alueelta 1,15 MB GRIB2:na
     ajot                6 h välein, julkaistu ajohetki + 6 h … + 66 h
     jakso               EI OLE hilana: `WavePeriod` ja
                         `SigWavePeriodSwell0` palauttavat latauspalvelusta
                         HTTP 400. Pistekysely (`multipointcoverage`)
                         antaa sen, kokonaisina sekunteina.

   KOLME SUURETTA, SAMA LAATTAMUOTO KUIN TUULELLA (`pyramidi.mjs`):
     taso 1 (`nop`)     merkitsevä aallonkorkeus, 0,03 m askelin (0 … 7,62)
     taso 2 (`suunta`)  aallon suunta MISTÄ, 2° askelin
     taso 3 (`puuska`)  jakso, 0,1 s askelin
   Tyhjä (255) on maa tai mallin ulkopuoli — asiakas piirtää sen
   läpinäkyvänä eikä arvaa (CLAUDE.md, "PUUTTUVA DATA ON LÄPINÄKYVÄÄ").

   JAKSO PISTEINÄ. Märistä soluista otetaan 0,1°:n (Suomenlahti ja
   Saaristomeri) ja 0,25°:n (muu Itämeri) otos, kysytään pistekyselyllä
   60 pistettä kerrallaan, ja jokainen laatan solmu lukee lähimmän
   pisteen sarjan (enintään 0,4° päästä). Jakso on kokonaisina
   sekunteina ja alueellisesti tasainen, joten otos ei hävitä mitään
   mitä lähteessä olisi. Pistekysely käyttää tuoreinta ajoa; sitä
   edeltävät tunnit saavat sarjan ensimmäisen arvon.             */

import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { sanoma } from './harmonie.mjs';
import { N, TYHJA, laatanRuudukko, kirjoitaLaatta, onDataa } from './pyramidi.mjs';

const WFS = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature';
const DL = 'https://opendata.fmi.fi/download';

/* Hakualue. Lähteen oma bbox alkaa 2,7°:sta, mutta lännessä on vain
   Pohjanmeren reuna; märkä Itämeri alkaa 9,4°:sta. */
const BBOX = [9, 53, 30.5, 66.85];

export const HS_ASKEL = 0.03;
export const JAKSO_ASKEL = 0.1;
export const SUUNTA_ASKEL = 2;

/* TASOT. Hienoin (0,02° ≈ mallin oma hila) vain Suomen rannikolla,
   koska rannikko on se missä aallonkorkeus muuttuu kilometrin matkalla
   (Otaniemi 0,04–0,28 m, Emäsalo 0,23–0,95 m samalta tunnilta). */
export const AALTO_TASOT = [
  { id: 'a0', askel: 0.02, lat: [59.2, 66],  lng: [19, 30.4] },
  { id: 'a1', askel: 0.05, lat: [53, 66.85], lng: [9, 30.5] },
  { id: 'a2', askel: 0.1,  lat: [53, 66.85], lng: [9, 30.5] },
  { id: 'a3', askel: 0.25, lat: [53, 66.85], lng: [9, 30.5] },
];

const LAHDE = 'Ilmatieteen laitos · WAM · CC BY 4.0';
const iso = (ms) => new Date(ms).toISOString().slice(0, 19) + 'Z';

function pakkaa(v, askel) {
  if (!Number.isFinite(v)) return TYHJA;
  const q = Math.round(v / askel);
  return q < 0 ? 0 : (q > 254 ? 254 : q);
}

async function haeTeksti(url, yrityksia = 3) {
  let virhe = null;
  for (let y = 0; y < yrityksia; y++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 120));
      return await r.text();
    } catch (e) { virhe = e; await new Promise(r => setTimeout(r, 1500 * (y + 1))); }
  }
  throw virhe;
}
async function haePuskuri(url, yrityksia = 3) {
  let virhe = null;
  for (let y = 0; y < yrityksia; y++) {
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 120));
      return Buffer.from(await r.arrayBuffer());
    } catch (e) { virhe = e; await new Promise(r => setTimeout(r, 2000 * (y + 1))); }
  }
  throw virhe;
}

/* Saatavilla olevat ajot, tuorein ensin: { ajo, alku, loppu } ms.
   Tallennettu hilakysely luettelee ne `fileReference`-osoitteina, ja
   jokaisessa on ajon oma julkaistu jakso. */
export async function wamAjot() {
  const x = await haeTeksti(WFS + '&storedquery_id=fmi::forecast::wam::grid&parameters=SigWaveHeight');
  const ajot = [];
  for (const m of x.matchAll(/fileReference>([^<]+)</g)) {
    const u = m[1].replace(/&amp;/g, '&');
    const o = /origintime=([^&]+)/.exec(u), a = /starttime=([^&]+)/.exec(u), l = /endtime=([^&]+)/.exec(u);
    if (!o || !a || !l) continue;
    const ajo = Date.parse(o[1]), alku = Date.parse(a[1]), loppu = Date.parse(l[1]);
    if (isFinite(ajo) && isFinite(alku) && isFinite(loppu) && !ajot.some(r => r.ajo === ajo)) {
      ajot.push({ ajo, alku, loppu });
    }
  }
  ajot.sort((p, q) => q.ajo - p.ajo);
  return ajot;
}

/* Tuntiakseli: jokaiselle tunnille tuorein ajo joka sen kattaa (sama
   sääntö kuin ECMWF:n `rakennaAikaAkseli`ssa). Palauttaa [{ t, ajo }]. */
export function aaltoAkseli(ajot) {
  if (!ajot.length) return [];
  const a = Math.min(...ajot.map(r => r.alku)), b = Math.max(...ajot.map(r => r.loppu));
  const ulos = [];
  for (let t = a; t <= b; t += 3600e3) {
    const r = ajot.find(q => q.alku <= t && q.loppu >= t);
    if (r) ulos.push({ t, ajo: r });
  }
  return ulos;
}

/* Solmun lähdelaatikko: lähdesolut joiden etäisyys solmusta on enintään
   puoli tason askelta (vähintään puoli lähdeaskelta, jotta hienoin taso
   osuu aina ainakin yhteen soluun). Laatikkosuodin kuten tuulen
   pyramidissa — karkea taso on hienon keskiarvo, ei poiminta. */
function laatikko(lat, lng, askel, g) {
  const rLat = Math.max(askel, g.dj * 1.001) / 2, rLng = Math.max(askel, g.di * 1.001) / 2;
  const j0 = Math.max(0, Math.ceil((lat - rLat - g.la0) / g.dj - 1e-9));
  const j1 = Math.min(g.nj - 1, Math.floor((lat + rLat - g.la0) / g.dj + 1e-9));
  const i0 = Math.max(0, Math.ceil((lng - rLng - g.lo0) / g.di - 1e-9));
  const i1 = Math.min(g.ni - 1, Math.floor((lng + rLng - g.lo0) / g.di + 1e-9));
  return j0 > j1 || i0 > i1 ? null : [j0, j1, i0, i1];
}

function luoTasot(nt) {
  return AALTO_TASOT.map(t => ({
    ...t,
    ruudut: laatanRuudukko(t).map(r => ({
      ...r,
      nop: new Uint8Array(nt * N * N).fill(TYHJA),
      suunta: new Uint8Array(nt * N * N).fill(TYHJA),
      puuska: new Uint8Array(nt * N * N).fill(TYHJA),
      paino: null, _box: null, _jp: null,
    })),
  }));
}

/* Yksi hetki pyramidiin. `hs` ja `dir` ovat lähdehilan kentät
   (rivit etelästä pohjoiseen), `jakso(pi)` antaa pistesarjan arvon. */
function kirjoitaHetki(tasot, ti, g, hs, dir, jakso) {
  for (const taso of tasot) {
    for (const r of taso.ruudut) {
      if (!r._box) {
        r._box = new Array(N * N);
        for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
          r._box[iy * N + ix] = laatikko(r.lat0 + iy * taso.askel, r.lng0 + ix * taso.askel, taso.askel, g);
        }
      }
      const pohja = ti * N * N;
      for (let k = 0; k < N * N; k++) {
        const b = r._box[k];
        if (!b) continue;
        let sH = 0, n = 0, sS = 0, sC = 0;
        for (let j = b[0]; j <= b[1]; j++) {
          const rivi = j * g.ni;
          for (let i = b[2]; i <= b[3]; i++) {
            const v = hs[rivi + i];
            if (!Number.isFinite(v)) continue;
            sH += v; n++;
            const d = dir[rivi + i];
            if (Number.isFinite(d)) { const a = d * Math.PI / 180; sS += Math.sin(a); sC += Math.cos(a); }
          }
        }
        if (!n) continue;
        r.nop[pohja + k] = pakkaa(sH / n, HS_ASKEL);
        if (sS || sC) {
          const q = Math.round(((Math.atan2(sS, sC) * 180 / Math.PI) + 360) % 360 / SUUNTA_ASKEL);
          r.suunta[pohja + k] = q >= 360 / SUUNTA_ASKEL ? 0 : q;
        }
        if (r._jp && r._jp[k] >= 0) r.puuska[pohja + k] = pakkaa(jakso(r._jp[k]), JAKSO_ASKEL);
      }
    }
  }
}

/* -- JAKSO PISTEKYSELYSTÄ ------------------------------------------ */

function jaksoPisteet(g, hs) {
  const pisteet = [], nahty = new Set();
  const tihea = (lat, lng) => lat >= 59.2 && lat <= 61 && lng >= 19 && lng <= 30.4;
  for (let j = 0; j < g.nj; j++) {
    const lat = g.la0 + j * g.dj;
    for (let i = 0; i < g.ni; i++) {
      if (!Number.isFinite(hs[j * g.ni + i])) continue;
      const lng = g.lo0 + i * g.di;
      const s = tihea(lat, lng) ? 0.1 : 0.25;
      const y = Math.round(lat / s) * s, x = Math.round(lng / s) * s;
      const avain = s + ':' + y.toFixed(2) + ':' + x.toFixed(2);
      if (nahty.has(avain)) continue;
      /* Pisteeksi märkä solu lähinnä otoksen solmua, ei solmu itse: solmu
         voi olla maalla, ja maapiste palauttaa pelkkää NaN:ia. */
      const jj = Math.round((y - g.la0) / g.dj), ii = Math.round((x - g.lo0) / g.di);
      const kelpo = jj >= 0 && jj < g.nj && ii >= 0 && ii < g.ni && Number.isFinite(hs[jj * g.ni + ii]);
      nahty.add(avain);
      pisteet.push(kelpo ? [g.la0 + jj * g.dj, g.lo0 + ii * g.di] : [lat, lng]);
    }
  }
  return pisteet;
}

async function haeJaksot(pisteet, alku, loppu, log) {
  const sarjat = pisteet.map(() => new Map());
  const ERA = 60;
  const erat = [];
  for (let k = 0; k < pisteet.length; k += ERA) erat.push(k);
  let ok = 0;
  const tyo = async (k) => {
    const osa = pisteet.slice(k, k + ERA);
    const url = WFS + '&storedquery_id=fmi::forecast::wam::point::multipointcoverage'
      + '&parameters=WavePeriod&timestep=60&starttime=' + iso(alku) + '&endtime=' + iso(loppu)
      + osa.map(p => '&latlon=' + p[0].toFixed(4) + ',' + p[1].toFixed(4)).join('');
    let x;
    try { x = await haeTeksti(url); } catch (e) { log('  ! jaksoerä ' + k + ': ' + e.message); return; }
    const pos = /<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/.exec(x);
    const arv = /<gml:doubleOrNilReasonTupleList>([\s\S]*?)<\/gml:doubleOrNilReasonTupleList>/.exec(x);
    if (!pos || !arv) return;
    const P = pos[1].trim().split(/\s+/).map(Number), V = arv[1].trim().split(/\s+/).map(Number);
    for (let r = 0; r * 3 + 2 < P.length && r < V.length; r++) {
      const la = P[r * 3], lo = P[r * 3 + 1], t = P[r * 3 + 2] * 1000, v = V[r];
      if (!Number.isFinite(v)) continue;
      /* Vastaus toistaa pyydetyn koordinaatin; lähin osan pisteistä. */
      let pi = -1, pd = 1e9;
      for (let q = 0; q < osa.length; q++) {
        const d = Math.abs(osa[q][0] - la) + Math.abs(osa[q][1] - lo);
        if (d < pd) { pd = d; pi = q; }
      }
      if (pi >= 0 && pd < 0.01) sarjat[k + pi].set(t, v);
    }
    ok++;
  };
  let seur = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    for (;;) { const i = seur++; if (i >= erat.length) return; await tyo(erat[i]); }
  }));
  log('  jakso: ' + pisteet.length + ' pistettä, ' + ok + '/' + erat.length + ' erää');
  return sarjat;
}

/* Laattojen solmuille lähin jaksopiste (enintään 0,4°). Ruudukko-
   haku 0,5°:n lokeroista. */
function liitaJaksopisteet(tasot, pisteet, sarjat) {
  const lokero = new Map(), L = 0.5;
  pisteet.forEach((p, i) => {
    if (!sarjat[i].size) return;
    const a = Math.floor(p[0] / L) + ':' + Math.floor(p[1] / L);
    if (!lokero.has(a)) lokero.set(a, []);
    lokero.get(a).push(i);
  });
  for (const taso of tasot) for (const r of taso.ruudut) {
    r._jp = new Int32Array(N * N).fill(-1);
    for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
      const lat = r.lat0 + iy * taso.askel, lng = r.lng0 + ix * taso.askel;
      const ky = Math.cos(lat * Math.PI / 180);
      let pi = -1, pd = 0.4 * 0.4;
      const ly = Math.floor(lat / L), lx = Math.floor(lng / L);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        for (const i of (lokero.get((ly + dy) + ':' + (lx + dx)) || [])) {
          const a = pisteet[i][0] - lat, b = (pisteet[i][1] - lng) * ky;
          const d = a * a + b * b;
          if (d < pd) { pd = d; pi = i; }
        }
      }
      r._jp[iy * N + ix] = pi;
    }
  }
}

/* ------------------------------------------------------------------
   `rakennaAallot({ ulos, log })` — kirjoittaa laatat hakemistoon `ulos`
   ja palauttaa luettelon `aallot`-avaimen. Heittää jos yhtään hetkeä ei
   saatu; tiilet.mjs ajaa tämän omassa try/catchissaan, jolloin varasto
   julkaistaan ilman aaltoja eikä tuuli kärsi. */
export async function rakennaAallot({ ulos, log = () => {} }) {
  const alkoi = Date.now();
  const ajot = await wamAjot();
  if (!ajot.length) throw new Error('WAM: ei ajoja');
  const akseli = aaltoAkseli(ajot);
  log('  ajot: ' + ajot.map(r => iso(r.ajo).slice(0, 13) + 'Z').join(', ')
    + ', akseli ' + akseli.length + ' h ' + iso(akseli[0].t) + ' .. ' + iso(akseli[akseli.length - 1].t));

  /* Palat: saman ajon peräkkäiset tunnit, enintään 8 h kerrallaan
     (≈ 9 MB). Yksi katkos vie palan, ei koko rakennusta. */
  const palat = [];
  for (let i = 0; i < akseli.length; i++) {
    const v = palat[palat.length - 1];
    if (v && v.ajo === akseli[i].ajo && v.loppu === akseli[i].t - 3600e3 && v.n < 8) { v.loppu = akseli[i].t; v.n++; }
    else palat.push({ ajo: akseli[i].ajo, alku: akseli[i].t, loppu: akseli[i].t, n: 1 });
  }

  const nt = akseli.length;
  const tasot = luoTasot(nt);
  const tiOf = new Map(akseli.map((a, i) => [a.t, i]));
  let g = null, jaksot = null, pisteet = null, tavuja = 0, hetkia = 0;
  const kirjoitetut = new Set();
  const jakso = (ti) => (pi) => {
    const s = jaksot && jaksot[pi];
    if (!s || !s.size) return NaN;
    const t = akseli[ti].t;
    if (s.has(t)) return s.get(t);
    /* Pistekysely kattaa tuoreimman ajon; sitä edeltävät tunnit saavat
       lähimmän tunnin arvon. */
    let paras = NaN, pd = Infinity;
    for (const [tt, v] of s) { const d = Math.abs(tt - t); if (d < pd) { pd = d; paras = v; } }
    return paras;
  };

  /* Jaksot haetaan kerran, ensimmäisen luetun hetken märistä soluista.
     Lupaus, koska palat käsitellään rinnakkain. */
  let jaksoLupaus = null;
  const kasittele = async (pala, buf) => {
    const kentat = new Map();      /* aika -> { hs, dir } */
    let off = 0;
    while (off < buf.length - 8) {
      const m = sanoma(buf, off);
      if (!m || !m.koko) break;
      off += m.koko;
      if (m.ohita) continue;
      if (!(m.skannaus & 0x40)) throw new Error('WAM: odottamaton skannaussuunta');
      if (!g) {
        g = { la0: m.la1, lo0: m.lo1, di: m.di, dj: m.dj, ni: m.ni, nj: m.nj };
      } else if (m.ni !== g.ni || m.nj !== g.nj || Math.abs(m.la1 - g.la0) > 1e-6 || Math.abs(m.lo1 - g.lo0) > 1e-6) {
        log('  ! hila vaihtui, sanoma ohitetaan'); continue;
      }
      /* Taulukko 4.2, discipline 10 (meri), kategoria 0 (aallot):
         3 = merkitsevä aallonkorkeus, 14 = suunta (yhdistetty). */
      const k = kentat.get(m.aika) || {};
      if (m.kat === 0 && m.num === 3) k.hs = m.arvot;
      else if (m.kat === 0 && m.num === 14) k.dir = m.arvot;
      kentat.set(m.aika, k);
    }
    for (const [t, k] of kentat) {
      const ti = tiOf.get(t);
      if (ti == null || !k.hs || !k.dir) continue;
      if (!jaksoLupaus) {
        pisteet = jaksoPisteet(g, k.hs);
        jaksoLupaus = haeJaksot(pisteet, akseli[0].t, akseli[nt - 1].t, log)
          .then(s => { jaksot = s; liitaJaksopisteet(tasot, pisteet, s); });
      }
      await jaksoLupaus;
      kirjoitaHetki(tasot, ti, g, k.hs, k.dir, jakso(ti));
      kirjoitetut.add(ti);
      hetkia++;
    }
    log('  ' + iso(pala.alku).slice(0, 13) + '…+' + (pala.n - 1) + ' h: ' + (buf.length / 1e6).toFixed(1) + ' MB');
  };
  /* KOLME HAKUA RINNAKKAIN. Rakennus on latauksen kokoinen (115 MB),
     ja yksi haku kerrallaan vei mitattuna 268 s. */
  let seur = 0;
  await Promise.all(Array.from({ length: +(process.env.WAM_RINNAKKAIN || 3) }, async () => {
    for (;;) {
      const pala = palat[seur++];
      if (!pala) return;
      const url = DL + '?producer=wam&param=SigWaveHeight,WaveDirection'
        + '&format=grib2&projection=epsg:4326&bbox=' + BBOX.join(',')
        + '&origintime=' + iso(pala.ajo.ajo) + '&starttime=' + iso(pala.alku) + '&endtime=' + iso(pala.loppu);
      let buf;
      try { buf = await haePuskuri(url); }
      catch (e) { log('  ! pala ' + iso(pala.alku) + ' jäi pois: ' + e.message); continue; }
      tavuja += buf.length;
      await kasittele(pala, buf);
    }
  }));
  if (!hetkia) throw new Error('WAM: yhtään hetkeä ei luettu');

  /* Puuttuneet hetket pois akselilta (sama sääntö kuin tuulella:
     tyhjä hetki olisi tyhjä kartta juuri sillä tunnilla). */
  const sailyta = [...kirjoitetut].sort((a, b) => a - b);
  const L = N * N;
  if (sailyta.length < nt) {
    for (const taso of tasot) for (const r of taso.ruudut) for (const kk of ['nop', 'suunta', 'puuska']) {
      const a = r[kk], b = new Uint8Array(sailyta.length * L);
      sailyta.forEach((ti, u) => b.set(a.subarray(ti * L, (ti + 1) * L), u * L));
      r[kk] = b;
    }
  }
  const ajat = sailyta.map(i => akseli[i].t);

  const rivit = [];
  let tavutUlos = 0;
  for (const taso of tasot) {
    mkdirSync(join(ulos, taso.id), { recursive: true });
    const laatat = [];
    let tt = 0;
    for (const r of taso.ruudut) {
      if (!onDataa(r)) continue;
      const pakattu = gzipSync(kirjoitaLaatta(taso, r, ajat.length, ajat[0], 3600), { level: 9 });
      writeFileSync(join(ulos, taso.id, `${r.lat0}_${r.lng0}.bin.gz`), pakattu);
      laatat.push([r.lat0, r.lng0]);
      tt += pakattu.length;
    }
    tavutUlos += tt;
    log(`  ${taso.id}: askel ${taso.askel}°, ${laatat.length}/${taso.ruudut.length} laattaa, ${(tt / 1e6).toFixed(1)} MB`);
    rivit.push({ id: taso.id, askel: taso.askel, span: (N - 1) * taso.askel, lat: taso.lat, lng: taso.lng, laatat });
  }
  log(`  ${ajat.length} hetkeä, haettu ${(tavuja / 1e6).toFixed(0)} MB, laatat ${(tavutUlos / 1e6).toFixed(1)} MB, `
    + `${((Date.now() - alkoi) / 1000).toFixed(0)} s`);
  return {
    versio: 1, lahde: LAHDE, malli: 'wam',
    ajoAika: new Date(ajot[0].ajo).toISOString(),
    ajat, nt: ajat.length, t0: ajat[0], dtSek: 3600,
    hsAskel: HS_ASKEL, suuntaAskel: SUUNTA_ASKEL, jaksoAskel: JAKSO_ASKEL, tyhja: TYHJA,
    tasot: rivit,
  };
}

/* Suora ajo mittausta varten: `node tools/wam.mjs ulos-hakemisto`. */
if (import.meta.url === 'file://' + process.argv[1]) {
  const ulos = process.argv[2] || 'aallot-testi';
  mkdirSync(ulos, { recursive: true });
  const a = await rakennaAallot({ ulos, log: (s) => console.log(s) });
  writeFileSync(join(ulos, 'aallot.json'), JSON.stringify(a));
}
