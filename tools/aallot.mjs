/* ------------------------------------------------------------------
   AALLOT KOKO MAAILMAAN — ECMWF WAM 9 km VARASTON POHJAPERHEEKSI
   (docs/aallot.md, V1).

   Lähde: Open-Meteon peili ECMWF:n aaltomallista (`data_spatial/
   ecmwf_wam`, AWS Open Data, CC BY 4.0), O1280-hila kuten kartan tuulen
   `ecmwf_ifs` (6 599 680 pistettä, märkiä 4 716 388). Neljä ajoa
   vuorokaudessa: 00/12Z +360 h, 06/18Z +144 h; tunneittain +90 h:iin,
   sitten 3 h ja +144 h:sta 6 h. Ajo ilmestyy noin kuusi tuntia
   ajohetkensä jälkeen.

   Mitattu 15.10.2026 (docs/aallot.md 4.3): poijuja vasten paras tai
   lähes paras jokaisella alueella (RMSE Itämeri 0,18 m, Havaiji 0,21,
   Yhdysvaltain länsi 0,19, itä 0,19, Irlanti 0,30). Hetki on noin 6 MB
   kolmelle muuttujalle.

   TASOT ovat O1280:stä laatikkosuodatettuja (`aaltopyramidi.mjs`):
   1,0° ja 0,5° koko maapallolle ja koko akselille, 0,25° koko
   maapallolle +7 vrk:een (koko akselilla se oli mitattuna 128 MB 184:stä;
   sen jälkeen askel on 6 h ja asiakas lukee 0,5°:tä). Lähizoomissa 9 km:n
   hila tulee palvelimelta (V4, `api/malli.js`). 0,1° koko maailmalle
   olisi 330–500 MB (docs/aallot.md 7) eikä mahdu Pagesiin.

   AIKA-AKSELI (jokaiselle hetkelle tuorein ajo joka sen kattaa, kuten
   tuulen `rakennaAikaAkseli`):
     menneisyys (48 h) … tuoreimman ajon ajohetki   3 h välein
     ajohetki … +48 h                               tunneittain
     +48 … +144 h                                   3 h välein
     +144 h … kauimmas yltävän ajon loppu           6 h välein
   Noin 134 hetkeä. Aallonkorkeus on ajassa sileä (docs/aallot.md 6.3),
   ja lähiajan tunnit ovat ne joita katsotaan eniten.

   JAKSO on KESKIJAKSO (`wave_period`, ECMWF:n mwp), sama suure kuin
   FMI:n WAMin `WavePeriod` ("Mean wave period", FMI:n metatieto), jotta
   kartalla on yksi jakso eikä kahta. Huippujakso (P9) ratkaistaan
   Copernicus-perheiden myötä (V5).                                    */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';
import { createHash } from 'node:crypto';
import {
  luoAaltoPyramidi, kirjoitaAaltoHetki, tiivistaAaltoAika, kirjoitaAaltoTasot, tarkistaPisteet,
  N, TYHJA, OTSAKE, HS_KATTO, SUUNTA_ASKEL, JAKSO_ASKEL, LUOTTO_KERROIN,
} from './aaltopyramidi.mjs';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const MALLI = 'ecmwf_wam';
const MUUTTUJAT = ['wave_height', 'wave_direction', 'wave_period'];
export const EC_TASOT = [
  { id: 'we0', askel: 0.25, lat: [-90, 90], lng: [-180, 180], loppuH: 168 },
  { id: 'we1', askel: 0.5,  lat: [-90, 90], lng: [-180, 180] },
  { id: 'we2', askel: 1.0,  lat: [-90, 90], lng: [-180, 180] },
];
export const EC_NATIIVI_KM = 9;
/* O1280-maski on mallin ominaisuus: märkiä 4 716 388 (mitattu 14.10.).
   Muutos tarkoittaa uutta hilaa tai maskia, ja se sanotaan yhteenvedossa. */
export const EC_MARKIA = 4716388;
export const EC_LAHDE = 'ECMWF WAM 9 km · Open-Meteo / AWS Open Data · CC BY 4.0';

/* Savutestin pisteet: märät poijujen kohdilta (avomerellä, kaukana
   rannasta), kuivat sisämaasta. Rivit väärin päin, pituusasteen origo
   0…360 tai käänteinen maski kaataa vähintään yhden. */
export const EC_MARAT = [
  ['Pohjois-Atlantti', 50, -20], ['Tyynimeri', 0, -140], ['Havaiji 51001', 24.45, -162.0],
  ['Etelämeri', -50, 90], ['Välimeri', 38, 5], ['Itämeri Gotlanti', 57.3, 20.1],
  ['Intian valtameri', -10, 75], ['Tasmaninmeri', -38, 160],
];
export const EC_KUIVAT = [
  ['Madrid', 40.4, -3.7], ['Moskova', 55.75, 37.6], ['Denver', 39.7, -105.0],
  ['Ulaanbaatar', 47.9, 106.9], ['Sahara', 23, 12], ['Alice Springs', -23.7, 133.9],
  ['Brasília', -15.8, -47.9], ['Tampere', 61.5, 23.8],
];

const iso = (ms) => new Date(ms).toISOString();
const H = 3600e3;

async function haeJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/* Ajot uusimmasta vanhimpaan (00/06/12/18Z), `meta.json` kertoo hetket. */
export async function haeAjot(maxTaakse) {
  const nyt = Date.now(), ajot = [];
  for (let i = 0; i < maxTaakse; i++) {
    const t = new Date(nyt - i * 6 * H);
    const h = Math.floor(t.getUTCHours() / 6) * 6;
    const pv = `${t.getUTCFullYear()}/${String(t.getUTCMonth() + 1).padStart(2, '0')}/${String(t.getUTCDate()).padStart(2, '0')}`;
    const ajo = `${String(h).padStart(2, '0')}00Z`;
    try {
      const meta = await haeJson(`${S3}/data_spatial/${MALLI}/${pv}/${ajo}/meta.json`);
      if (meta && Array.isArray(meta.valid_times) && meta.valid_times.length > 8) {
        ajot.push({ pv, ajo, meta, ms: Date.parse(meta.reference_time),
                    ajat: new Set(meta.valid_times.map(v => Date.parse(v))) });
      }
    } catch (e) { /* ei olemassa — jatka taaksepäin */ }
  }
  if (!ajot.length) throw new Error('ECMWF WAM: yhtään valmista ajoa ei löytynyt');
  ajot.sort((a, b) => b.ms - a.ms);
  return ajot;
}

/* Kohdehetket (ks. otsake) ja jokaiselle tuorein ajo joka sen kattaa. */
export function aaltoAkseli(ajot, menneisyysH, nyt = Date.now()) {
  const T0 = ajot[0].ms;
  const loppu = Math.max(...ajot.map(a => Math.max(...a.ajat)));
  const ehdokkaat = [];
  for (let t = Math.ceil((nyt - menneisyysH * H) / (3 * H)) * 3 * H; t < T0; t += 3 * H) ehdokkaat.push(t);
  for (let t = T0; t <= T0 + 48 * H; t += H) ehdokkaat.push(t);
  for (let t = T0 + 51 * H; t <= T0 + 144 * H; t += 3 * H) ehdokkaat.push(t);
  for (let t = T0 + 150 * H; t <= loppu; t += 6 * H) ehdokkaat.push(t);
  const ulos = [];
  for (const t of ehdokkaat) {
    const ajo = ajot.find(a => a.ajat.has(t));
    if (ajo) ulos.push({ ms: t, ajo, varat: ajot.filter(a => a !== ajo && a.ajat.has(t)) });
  }
  return ulos;
}

function url(ajo, ms) {
  const tied = new Date(ms).toISOString().slice(0, 16).replace(':', '');
  return `${S3}/data_spatial/${MALLI}/${ajo.pv}/${ajo.ajo}/${tied}.om`;
}

/* LUKIJAN MUISTI ON KIINTEÄ 64 MB JA YHTEINEN (`@openmeteo/file-format-
   wasm`, ei kasva: `abortOnCannotGrowMemory`). Koko maapallon kenttä on
   26 MB, ja kolme rinnakkain kaatui mitattuna "Aborted(OOM)". Tiedoston
   lohkot ovat 1 024 pistettä, joten kenttä luetaan KAISTOINA (2^18
   pistettä = 1 MB) ja rinnakkaisten kaistojen määrä on rajattu koko
   prosessissa (`KAISTOJA`). Mitattu: 16 kaistaa rinnakkain lukee
   muuttujan 0,54 s, yhtenä lukuna 2,6 s. Märät pisteet poimitaan suoraan
   kaistoista, joten täyttä kenttää ei pidetä muistissa. */
const KAISTA = 1 << 18;
const KAISTOJA = 16;
let _kaistojaNyt = 0;
const _jono = [];
async function kaistaVuoro(tyo) {
  if (_kaistojaNyt >= KAISTOJA) await new Promise(r => _jono.push(r));
  _kaistojaNyt++;
  try { return await tyo(); }
  finally { _kaistojaNyt--; const r = _jono.shift(); if (r) r(); }
}
/* Muuttuja märille pisteille (`idx` nouseva) tai koko kenttänä (`idx` null). */
async function lueMuuttuja(c, idx) {
  const n = Array.from(c.getDimensions())[1];
  const out = new Float32Array(idx ? idx.length : n);
  if (idx) out.fill(NaN);
  const kaistat = [];
  for (let a = 0; a < n; a += KAISTA) kaistat.push([a, Math.min(n, a + KAISTA)]);
  await Promise.all(kaistat.map(([a, b]) => kaistaVuoro(async () => {
    const d = await c.read({ type: OmDataType.FloatArray, ranges: [{ start: 0, end: 1 }, { start: a, end: b }] });
    if (!idx) { out.set(d, a); return; }
    let lo = 0, hi = idx.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if (idx[m] < a) lo = m + 1; else hi = m; }
    for (let p = lo; p < idx.length && idx[p] < b; p++) out[p] = d[idx[p] - a];
  })));
  return out;
}

/* Yhden hetken muuttujat. `idx` = märät pisteet (null = koko kenttä).
   Jokainen luku kahdesti uudelleen jos verkko katkeaa. */
async function lueHetki(osoite, idx) {
  let viime = null;
  for (let yritys = 0; yritys < 3; yritys++) {
    try {
      const reader = await OmFileReader.create(new OmHttpBackend({ url: osoite }));
      try {
        const n = reader.numberOfChildren(), lapset = {};
        for (let i = 0; i < n; i++) {
          const c = await reader.getChild(i);
          if (!c) continue;
          const nimi = c.getName();
          if (MUUTTUJAT.includes(nimi) && !lapset[nimi]) lapset[nimi] = c; else c.dispose();
        }
        if (!lapset.wave_height) throw new Error('wave_height puuttuu');
        const kentat = {};
        for (const nimi of MUUTTUJAT) {
          const c = lapset[nimi];
          if (!c) continue;
          kentat[nimi] = await lueMuuttuja(c, idx);
          c.dispose();
          delete lapset[nimi];
        }
        return kentat;
      } finally {
        reader.dispose();
      }
    } catch (e) {
      viime = e;
      await new Promise(r => setTimeout(r, 2000 * (yritys + 1)));
    }
  }
  throw viime;
}

/* O1280: rivi k = 1 … 2560 pohjoisesta, rivillä 20 + 4(k − 1) pistettä
   (eteläpuoliskolla peilattuna), leveys 90 − (4k − 1)·180 / (4·2560 + 2)
   ja pituus j·360/m nollasta itään — sama kaava kuin `api/malli.js`:n
   `o1280` (varmennettu tuulella Open-Meteon pistesarjaa vasten). */
function o1280Pisteet() {
  const NR = 2560;
  let n = 0;
  for (let k = 1; k <= NR; k++) n += k <= NR / 2 ? 20 + 4 * (k - 1) : 20 + 4 * (NR - k);
  const lat = new Float32Array(n), lon = new Float32Array(n);
  let p = 0;
  for (let k = 1; k <= NR; k++) {
    const m = k <= NR / 2 ? 20 + 4 * (k - 1) : 20 + 4 * (NR - k);
    const la = 90 - (4 * k - 1) * 180 / (4 * NR + 2);
    for (let j = 0; j < m; j++) {
      lat[p] = la;
      const lo = j * 360 / m;
      lon[p] = lo >= 180 ? lo - 360 : lo;
      p++;
    }
  }
  return { n, lat, lon };
}

/* Märät pisteet ensimmäisen hetken korkeudesta. */
function marat(hs, geo, natiiviKm) {
  let n = 0;
  for (let i = 0; i < hs.length; i++) if (Number.isFinite(hs[i])) n++;
  const lat = new Float32Array(n), lon = new Float32Array(n), idx = new Int32Array(n);
  const tiiv = createHash('sha1');
  let p = 0;
  for (let i = 0; i < hs.length; i++) {
    if (!Number.isFinite(hs[i])) continue;
    lat[p] = geo.lat[i]; lon[p] = geo.lon[i]; idx[p] = i; p++;
  }
  tiiv.update(Buffer.from(idx.buffer));
  return { n, lat, lon, idx, natiiviKm, tiiviste: tiiv.digest('hex').slice(0, 12) };
}

function poimi(kentta, idx) {
  const out = new Float32Array(idx.length);
  if (!kentta) { out.fill(NaN); return out; }
  for (let p = 0; p < idx.length; p++) out[p] = kentta[idx[p]];
  return out;
}

async function rinnakkain(lista, raja, tyo) {
  let seur = 0;
  await Promise.all(Array.from({ length: Math.min(raja, lista.length) }, async () => {
    for (;;) { const i = seur++; if (i >= lista.length) return; await tyo(lista[i], i); }
  }));
}

/* ------------------------------------------------------------------
   `rakennaEcmwfAallot({ ulos, log, menneisyysH, rinnakkain, maxAskelta,
   pala })` kirjoittaa tasot `we0`–`we2` ja palauttaa { rivit, tilasto }.
   Heittää jos yhtään hetkeä ei saatu tai savutesti kaatui: tiilet.mjs
   ajaa tämän omassa try/catchissaan. */
export async function rakennaEcmwfAallot({ ulos, log = () => {}, menneisyysH = 48, rinnakkainN = 8,
                                          maxAskelta = 0, pala = 24 }) {
  const alkoi = Date.now();
  const ajot = await haeAjot(2 + Math.ceil(menneisyysH / 6) + 2);
  let akseli = aaltoAkseli(ajot, menneisyysH);
  if (maxAskelta > 0) akseli = akseli.slice(0, maxAskelta);
  const kaikkiaan = akseli.length;
  log(`  ajot ${ajot.map(a => a.pv.slice(5) + ' ' + a.ajo).join(', ')}; uusin ${iso(ajot[0].ms)}`);
  log(`  akseli ${akseli.length} hetkeä ${iso(akseli[0].ms)} … ${iso(akseli[akseli.length - 1].ms)}`);

  const geo = o1280Pisteet();
  /* Ensimmäinen hetki: märkä maski ja pyramidin rakenne. */
  let k0 = null, i0 = -1;
  for (let i = 0; i < Math.min(3, akseli.length) && !k0; i++) {
    try { k0 = await lueHetki(url(akseli[i].ajo, akseli[i].ms), null); i0 = i; }
    catch (e) { log(`  ! ${iso(akseli[i].ms)}: ${e.message}`); }
  }
  if (!k0) throw new Error('ECMWF WAM: kolme ensimmäistä hetkeä epäonnistui');
  if (k0.wave_height.length !== geo.n) throw new Error(`ECMWF WAM: hila ${k0.wave_height.length} pistettä, O1280:ssä ${geo.n}`);
  const lahde = marat(k0.wave_height, geo, EC_NATIIVI_KM);
  log(`  märkiä ${lahde.n} (tiiviste ${lahde.tiiviste})` + (lahde.n !== EC_MARKIA ? `  ! odotettiin ${EC_MARKIA}` : ''));
  const pyr = luoAaltoPyramidi(EC_TASOT, lahde, akseli.length, log);
  /* Märkien pisteiden arvot: ensimmäinen hetki poimitaan koko kentästä,
     muut luetaan suoraan märkinä (`lueHetki(…, lahde.idx)`). */
  const kirjoita = (ti, k, koko) => kirjoitaAaltoHetki(pyr, ti, koko ? {
    hs: poimi(k.wave_height, lahde.idx), dir: poimi(k.wave_direction, lahde.idx), tp: poimi(k.wave_period, lahde.idx),
  } : { hs: k.wave_height, dir: k.wave_direction || null, tp: k.wave_period || null });
  kirjoita(i0, k0, true);
  k0 = null;
  const viat = tarkistaPisteet(pyr, EC_MARAT, EC_KUIVAT);
  if (viat.length) throw new Error('ECMWF WAM: savutesti kaatui: ' + viat.join('; '));

  const ok = [i0];
  let valmiit = 1, varalta = 0;
  const loput = akseli.map((a, i) => i).filter(i => i !== i0);
  await rinnakkain(loput, rinnakkainN, async (ti) => {
    const kohta = akseli[ti];
    let k = null;
    /* Tuorein ajo ensin, sitten vanhemmat jotka kattavat saman hetken. */
    for (const ajo of [kohta.ajo, ...kohta.varat.slice(0, 2)]) {
      try { k = await lueHetki(url(ajo, kohta.ms), lahde.idx); if (ajo !== kohta.ajo) varalta++; break; }
      catch (e) { log(`  ! ${iso(kohta.ms)} (${ajo.ajo}): ${e.message}`); }
    }
    if (!k) return;
    kirjoita(ti, k, false);
    ok.push(ti);
    if (++valmiit % 25 === 0 || valmiit === akseli.length) {
      log(`  ${valmiit}/${akseli.length} hetkeä  ${((Date.now() - alkoi) / 1000).toFixed(0)} s`);
    }
  });
  if (ok.length < 6) throw new Error(`ECMWF WAM: vain ${ok.length} hetkeä luettiin`);
  ok.sort((a, b) => a - b);
  if (ok.length < akseli.length) {
    tiivistaAaltoAika(pyr, ok);
    akseli = ok.map(i => akseli[i]);
  }
  const ajat = akseli.map(a => a.ms);
  /* 0,25° +7 vrk:een (docs/aallot.md 7): sen jälkeen 6 h askel ja 0,5°.
     Mitattu 15.10.: koko akselilla 0,25° oli 128 MB 184:stä. */
  for (const t of pyr.tasot) if (t.loppuH) t.loppuMs = ajot[0].ms + t.loppuH * H;
  const { rivit, tavut } = kirjoitaAaltoTasot(pyr, ajat, ulos, pala, {
    perhe: 'ecmwf_wam', malli: 'ecmwf_wam', lahde: EC_LAHDE, ajoAika: iso(ajot[0].ms),
  }, log);
  const tilasto = { perhe: 'ecmwf_wam', hetkia: ajat.length, kaikkiaan,
    puuttui: kaikkiaan - ajat.length, varalta, markia: lahde.n, tiiviste: lahde.tiiviste,
    alku: iso(ajat[0]), loppu: iso(ajat[ajat.length - 1]), mb: tavut / 1e6, s: (Date.now() - alkoi) / 1000 };
  log(`  ${ajat.length} hetkeä, ${(tavut / 1e6).toFixed(1)} MB, ${tilasto.s.toFixed(0)} s`
    + (tilasto.puuttui ? `, ${tilasto.puuttui} puuttui` : '') + (varalta ? `, ${varalta} vanhemmasta ajosta` : ''));
  return { rivit, tilasto };
}

/* Luettelon `aallot2`-avain perheistä (tärkein ensin, pohja viimeisenä). */
export function aaltoLuettelo(perheet, luotu) {
  const tasot = [], jarjestys = [];
  for (const p of perheet) {
    if (!p || !p.rivit || !p.rivit.length) continue;
    jarjestys.push(p.rivit[0].perhe);
    tasot.push(...p.rivit);
  }
  return {
    versio: 2, luotu,
    otsake: OTSAKE, tyhja: TYHJA, n: N,
    hsKoodaus: 'sqrt', hsKatto: HS_KATTO, suuntaAskel: SUUNTA_ASKEL, jaksoAskel: JAKSO_ASKEL,
    jakso: 'keski', etaisyysKoodaus: 'sqrt16', luottoKerroin: LUOTTO_KERROIN,
    perheet: jarjestys, tasot,
  };
}

/* Suora ajo mittausta varten: `node tools/aallot.mjs ulos [maxAskelta]`. */
if (import.meta.url === 'file://' + process.argv[1]) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ulos = process.argv[2] || 'aallot-testi';
  mkdirSync(ulos, { recursive: true });
  const r = await rakennaEcmwfAallot({ ulos, log: (s) => console.log(s), maxAskelta: +(process.argv[3] || 0),
                                       rinnakkainN: +(process.env.RINNAKKAIN || 8) });
  writeFileSync(`${ulos}/aallot2.json`, JSON.stringify(aaltoLuettelo([r], new Date().toISOString())));
  console.log(JSON.stringify(r.tilasto));
}
