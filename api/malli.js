/* ECMWF IFS 9 km (O1280) — KENTTÄ YHDELLE TUNNILLE TAI PISTEEN SARJA.
 *
 * Säälaattavarasto (`tools/tiilet.mjs`) pitää ECMWF:n 0,25°:na Pohjois-
 * Euroopassa ja 0,5–1°:na muualla, koska 9 km koko maapallolle koko
 * jaksolle olisi noin 2,9 GB ajoa kohti (6,6 M pistettä × 145 hetkeä × 3
 * tavua). Tämä funktio lukee 9 km:n datan TARPEEN MUKAAN Open-Meteon
 * avoimesta S3-peilistä (CC BY 4.0) — Windyn tapa: kartta saa valitun
 * tunnin näkymän alueelle, aikajana kartan keskipisteen sarjan.
 *
 * KAKSI LÄHDETTÄ, KAKSI MUOTOA (docs/mallit.md, V5):
 *   ?tila=kentta  `data_spatial/ecmwf_ifs/<ajo>/<hetki>.om` — yksi
 *                 tiedosto per hetki, rivijärjestyksessä. Leveyskaista
 *                 luetaan yhtenä välinä: mitattuna 5° kaista 1,0 s /
 *                 0,28 MB, 20° kaista 2,1 s / 1,42 MB (kolme kenttää).
 *   ?tila=sarja   `data/ecmwf_ifs/<muuttuja>/chunk_N.om` — Open-Meteon
 *                 oma aikasarjavarasto, 504 tuntia tiedostoa kohti,
 *                 lohko 6 pistettä × 504 tuntia. Yksi piste kolmella
 *                 kentällä avauksineen mitattuna 0,7 s / 7,4 kB. Tuorein
 *                 ajo on kirjoitettu vanhojen päälle, joten menneisyys on
 *                 valmiiksi parasta saatavilla olevaa.
 *
 * HILA. O1280 on redusoitu Gaussin hila: 2 560 leveysriviä pohjoisesta
 * etelään, rivillä k (1..1280) 20 + 4(k−1) pistettä pituusasteesta 0
 * itään, eteläinen puolisko peilinä. Leveysasteet ovat Legendren
 * polynomin juuria; Tricomin approksimaatio (4k−1)·180/(4·2560+2) osuu
 * niihin alle 0,0002°:n tarkkuudella. Suunnat tarkistettu säälaattojen
 * ECMWF 0,25°:ta vasten (sama malli uudelleenhilattuna): oikein päin
 * ero 0,8–1,8 m/s (alueen keskiarvo vs 9 km:n piste), peilattuna
 * leveydessä 6,1 ja pituudessa 3,2–6,2.
 *
 * LISENSSI. `@openmeteo/file-reader` on GPL-2.0, ja siksi luku tehdään
 * TÄÄLLÄ eikä selaimessa: palvelimella ajettua koodia ei levitetä.    */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const MALLI = 'ecmwf_ifs';

const NR = 2560;
const nRivi = (k) => (k <= NR / 2 ? 20 + 4 * (k - 1) : 20 + 4 * (NR - k));
/* ALKU[k-1] = rivin k ensimmäisen pisteen indeksi litteässä taulukossa. */
const ALKU = new Float64Array(NR + 1);
for (let k = 1; k <= NR; k++) ALKU[k] = ALKU[k - 1] + nRivi(k);
/* Leveysaste -> jatkuva riviluku (k kokonaislukuna = rivin leveysaste). */
const riviMurto = (la) => ((90 - la) / 180 * (4 * NR + 2) + 1) / 4;

const NOP_ASKEL = 0.2, SUUNTA_ASKEL = 2, TYHJA = 255;
const RAD = Math.PI / 180;
const HALUTUT = ['wind_u_component_10m', 'wind_v_component_10m', 'wind_gusts_10m'];

/* Lämpimän instanssin muisti: tuorein ajo 5 min ja ajojen hetkilistat. */
let tuorein = null, tuoreinT = 0;
const ajoMeta = new Map();

async function haeTuorein() {
  if (tuorein && Date.now() - tuoreinT < 300e3) return tuorein;
  const r = await fetch(`${S3}/data_spatial/${MALLI}/latest.json`);
  if (!r.ok) throw new Error('latest.json HTTP ' + r.status);
  tuorein = await r.json();
  tuoreinT = Date.now();
  return tuorein;
}

const ajoPolku = (ms) => {
  const d = new Date(ms);
  return `${d.toISOString().slice(0, 10).replace(/-/g, '/')}/${String(d.getUTCHours()).padStart(2, '0')}00Z`;
};
const tiedosto = (ms) => new Date(ms).toISOString().slice(0, 16).replace(':', '');

/* Ajon hetket. Tunneittain vain 90 h asti, sitten 3 h ja 144 h:sta 6 h
   (00Z/12Z ulottuvat 15 vrk:een, 06Z/18Z kuuteen) — mitattu 18Z-ajosta
   109 hetkeä, askeleet 1 ja 3 h. Hetki askelten välissä interpoloidaan,
   kuten varasto tekee. */
async function haeAjonHetket(a) {
  const avain = String(a);
  if (ajoMeta.has(avain)) return ajoMeta.get(avain);
  let ajat = null;
  try {
    const r = await fetch(`${S3}/data_spatial/${MALLI}/${ajoPolku(a)}/meta.json`);
    if (r.ok) {
      const m = await r.json();
      ajat = (m.valid_times || []).map((t) => Date.parse(t)).filter(Number.isFinite);
    }
  } catch (e) { /* ajoa ei ole */ }
  ajoMeta.set(avain, ajat);
  if (ajoMeta.size > 24) ajoMeta.delete(ajoMeta.keys().next().value);
  return ajat;
}

/* MUUTTUJIEN JÄRJESTYS VAIHTELEE TIEDOSTOSTA TOISEEN (mitattu saman
   ajon seitsemästä tiedostosta: u oli lapsi 20, 24, 25, 27, 28 tai 30),
   joten indeksiä ei voi muistaa. Nimet haetaan rinnakkain yhdellä
   kierroksella; peräkkäin sama maksoi 4 s. */
async function lapsiNimella(reader) {
  const n = reader.numberOfChildren();
  const lapset = await Promise.all(Array.from({ length: n }, (_, i) => reader.getChild(i)));
  const tulos = {};
  for (const c of lapset) if (c && HALUTUT.includes(c.getName())) tulos[c.getName()] = c;
  return tulos;
}

async function lueTiedosto(url, s0, s1) {
  const reader = await OmFileReader.create(new OmHttpBackend({ url }));
  const lapset = await lapsiNimella(reader);
  const kentat = await Promise.all(HALUTUT.map(async (nimi) => {
    const c = lapset[nimi];
    if (!c) return null;
    return c.read({ type: OmDataType.FloatArray, ranges: [{ start: 0, end: 1 }, { start: s0, end: s1 }] });
  }));
  /* Puuska puuttuu analyysihetkeltä (T+0), tuuli ei saa puuttua. */
  if (!kentat[0] || !kentat[1]) throw new Error('tuuli puuttuu tiedostosta');
  return { u: kentat[0], v: kentat[1], g: kentat[2] };
}

/* Hetken kentät leveyskaistalta [k0, k1] (rivit, 1-pohjaiset). Ajo on
   tuorein joka kattaa hetken; vanhempia kokeillaan kuuden tunnin
   välein, koska menneisyys on vanhojen ajojen alkutunneissa. Palauttaa
   yhden tai kaksi tiedostoa ja osuuden niiden välillä. */
async function lueKentta(tMs, k0, k1) {
  const meta = await haeTuorein();
  const uusin = Date.parse(meta.reference_time);
  const s0 = ALKU[k0 - 1], s1 = ALKU[k1];
  for (let a = uusin; a > uusin - 78 * 3600e3; a -= 6 * 3600e3) {
    if (a > tMs) continue;
    const ajat = await haeAjonHetket(a);
    if (!ajat || !ajat.length || tMs < ajat[0] || tMs > ajat[ajat.length - 1]) continue;
    let i = ajat.findIndex((t) => t >= tMs);
    const url = (t) => `${S3}/data_spatial/${MALLI}/${ajoPolku(a)}/${tiedosto(t)}.om`;
    if (ajat[i] === tMs) {
      return { ajo: a, s0, f: 0, A: await lueTiedosto(url(tMs), s0, s1), B: null };
    }
    const tA = ajat[i - 1], tB = ajat[i];
    const [A, B] = await Promise.all([lueTiedosto(url(tA), s0, s1), lueTiedosto(url(tB), s0, s1)]);
    return { ajo: a, s0, f: (tMs - tA) / (tB - tA), A, B };
  }
  throw new Error('ei ajoa joka kattaa hetken');
}

const pakkaaNopeus = (v) => {
  if (!Number.isFinite(v)) return TYHJA;
  const q = Math.round(v / NOP_ASKEL);
  return q < 0 ? 0 : (q > 254 ? 254 : q);
};
const pakkaaSuunta = (d) => {
  if (!Number.isFinite(d)) return TYHJA;
  const q = Math.round(((d % 360) + 360) % 360 / SUUNTA_ASKEL);
  return q >= 180 ? 0 : q;
};

/* Bilineaarinen näyte O1280:sta: kaksi riviä, kummaltakin kaksi
   naapuria pituusasteessa. Nopeus ja puuska keskiarvona, suunta
   yksikkövektoreista — sama sääntö kuin varastossa ja sovelluksessa. */
function nayte(la, lo, lue) {
  const kf = riviMurto(la);
  let k0 = Math.floor(kf);
  const fy = kf - k0;
  const rivit = [[Math.min(NR, Math.max(1, k0)), 1 - fy], [Math.min(NR, Math.max(1, k0 + 1)), fy]];
  let sN = 0, sS = 0, sC = 0, wN = 0, sG = 0, wG = 0;
  const lon = ((lo % 360) + 360) % 360;
  for (const [k, wy] of rivit) {
    if (wy <= 0) continue;
    const m = nRivi(k), x = lon / 360 * m;
    const j0 = Math.floor(x) % m, j1 = (j0 + 1) % m, fx = x - Math.floor(x);
    for (const [j, wx] of [[j0, 1 - fx], [j1, fx]]) {
      const w = wy * wx;
      if (w <= 0) continue;
      const p = lue(ALKU[k - 1] + j);
      if (!p) continue;
      const s = Math.hypot(p.u, p.v);
      sN += s * w; wN += w;
      if (s > 1e-6) { sS += -p.u / s * w; sC += -p.v / s * w; }
      if (Number.isFinite(p.g)) { sG += p.g * w; wG += w; }
    }
  }
  if (!wN) return null;
  return { ms: sN / wN, dir: (Math.atan2(sS, sC) / RAD + 360) % 360, g: wG ? sG / wG : NaN };
}

async function kentta(q) {
  const tMs = Math.round(Number(q.t) / 3600e3) * 3600e3;
  const s = Math.max(-89.9, Number(q.s)), n = Math.min(89.9, Number(q.n));
  let w = Number(q.w), e = Number(q.e);
  const askel = Math.min(1, Math.max(0.05, Number(q.askel) || 0.1));
  if (![tMs, s, n, w, e].every(Number.isFinite) || n <= s || e <= w) throw new Error('virheellinen rajaus');
  if (e - w > 120 || n - s > 60) throw new Error('liian laaja rajaus');
  /* Hilan origo globaalisti kohdistettuna, kuten sovelluksen solmuhila. */
  const la0 = Math.floor(s / askel) * askel, lo0 = Math.floor(w / askel) * askel;
  const nj = Math.round((Math.ceil(n / askel) * askel - la0) / askel) + 1;
  const ni = Math.round((Math.ceil(e / askel) * askel - lo0) / askel) + 1;
  const k0 = Math.max(1, Math.floor(riviMurto(la0 + (nj - 1) * askel)) - 1);
  const k1 = Math.min(NR, Math.ceil(riviMurto(la0)) + 1);
  const t0 = Date.now();
  const d = await lueKentta(tMs, k0, k1);
  const luku = Date.now() - t0;
  const lukija = (T) => (idx) => {
    const i = idx - d.s0;
    const u = T.u[i], v = T.v[i];
    if (!Number.isFinite(u) || !Number.isFinite(v)) return null;
    return { u, v, g: T.g ? T.g[i] : NaN };
  };
  const lueA = lukija(d.A), lueB = d.B ? lukija(d.B) : null;
  const N = ni * nj;
  const nop = new Uint8Array(N), suu = new Uint8Array(N), puu = new Uint8Array(N);
  for (let j = 0; j < nj; j++) {
    const la = la0 + j * askel;
    for (let i = 0; i < ni; i++) {
      const lo = lo0 + i * askel, k = j * ni + i;
      let x = nayte(la, lo, lueA);
      /* AJASSA NOPEUS JA SUUNTA ERIKSEEN, suunta lyhintä kaarta — sama
         sääntö kuin sovelluksen `_naytePerhe`. */
      if (x && lueB) {
        const y = nayte(la, lo, lueB);
        if (y) {
          const dd = ((y.dir - x.dir) % 360 + 540) % 360 - 180;
          x = { ms: x.ms + (y.ms - x.ms) * d.f, dir: ((x.dir + dd * d.f) % 360 + 360) % 360,
                g: Number.isFinite(x.g) && Number.isFinite(y.g) ? x.g + (y.g - x.g) * d.f : (Number.isFinite(x.g) ? x.g : y.g) };
        }
      }
      nop[k] = x ? pakkaaNopeus(x.ms) : TYHJA;
      suu[k] = x ? pakkaaSuunta(x.dir) : TYHJA;
      puu[k] = x ? pakkaaNopeus(x.g) : TYHJA;
    }
  }
  const b64 = (a) => Buffer.from(a.buffer, a.byteOffset, a.byteLength).toString('base64');
  return {
    tila: 'kentta', malli: MALLI, t: tMs, ajo: d.ajo, valissa: d.B ? +d.f.toFixed(3) : 0,
    la0: +la0.toFixed(4), lo0: +lo0.toFixed(4), askel, ni, nj,
    nopAskel: NOP_ASKEL, suuntaAskel: SUUNTA_ASKEL, tyhja: TYHJA,
    nop: b64(nop), suunta: b64(suu), puuska: b64(puu),
    ms: { luku, yht: Date.now() - t0 },
  };
}

/* Pisteen sarja tuntiakselilla [alku, loppu]. Tiedosto kattaa 504 tuntia
   (`chunk_time_length`), joten jakso voi osua kahteen. Pisteen neljä
   naapuria ovat kahdella rivillä, ja kummankin rivin kaksi naapuria ovat
   peräkkäin (yksi väli) — paitsi rivin saumassa, jolloin luetaan kaksi. */
async function sarja(q) {
  const la = Number(q.lat), lo = Number(q.lng);
  const nyt = Math.floor(Date.now() / 3600e3);
  const alkuH = Number.isFinite(Number(q.alku)) ? Math.floor(Number(q.alku) / 3600e3) : nyt - 50;
  const loppuH = Number.isFinite(Number(q.loppu)) ? Math.ceil(Number(q.loppu) / 3600e3) : nyt + 16 * 24;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || loppuH <= alkuH || loppuH - alkuH > 30 * 24) {
    throw new Error('virheellinen piste tai jakso');
  }
  const t0 = Date.now();
  const kf = riviMurto(la), kA = Math.min(NR, Math.max(1, Math.floor(kf))), kB = Math.min(NR, kA + 1);
  const lon = ((lo % 360) + 360) % 360;
  /* Tarvittavat pisteet rivi kerrallaan. */
  const pisteet = new Set();
  for (const k of [kA, kB]) {
    const m = nRivi(k), x = lon / 360 * m, j0 = Math.floor(x) % m;
    pisteet.add(ALKU[k - 1] + j0); pisteet.add(ALKU[k - 1] + (j0 + 1) % m);
  }
  const lista = [...pisteet].sort((a, b) => a - b);
  /* Peräkkäiset indeksit yhdeksi väliksi. */
  const valit = [];
  for (const p of lista) {
    const v = valit[valit.length - 1];
    if (v && p === v[1]) v[1] = p + 1; else valit.push([p, p + 1]);
  }
  const c0 = Math.floor(alkuH / 504), c1 = Math.floor(loppuH / 504);
  const nH = loppuH - alkuH + 1;
  const arvot = {};
  for (const nimi of HALUTUT) arvot[nimi] = new Map();   /* piste -> Float32Array(nH) */
  await Promise.all(HALUTUT.flatMap((nimi) => {
    const tyot = [];
    for (let c = c0; c <= c1; c++) {
      tyot.push((async () => {
        let reader;
        try {
          reader = await OmFileReader.create(new OmHttpBackend({ url: `${S3}/data/${MALLI}/${nimi}/chunk_${c}.om` }));
        } catch (e) { return; }
        const h0 = Math.max(alkuH, c * 504), h1 = Math.min(loppuH, c * 504 + 503);
        if (h1 < h0) return;
        for (const [p0, p1] of valit) {
          const x = await reader.read({ type: OmDataType.FloatArray,
            ranges: [{ start: 0, end: 1 }, { start: p0, end: p1 }, { start: h0 - c * 504, end: h1 - c * 504 + 1 }] });
          const leveys = h1 - h0 + 1;
          for (let p = p0; p < p1; p++) {
            if (!arvot[nimi].has(p)) arvot[nimi].set(p, new Float32Array(nH).fill(NaN));
            const kohde = arvot[nimi].get(p), rivi = (p - p0) * leveys;
            for (let t = 0; t < leveys; t++) kohde[h0 - alkuH + t] = x[rivi + t];
          }
        }
      })());
    }
    return tyot;
  }));
  const U = arvot.wind_u_component_10m, V = arvot.wind_v_component_10m, G = arvot.wind_gusts_10m;
  const nop = new Array(nH), suunta = new Array(nH), puuska = new Array(nH);
  let kelpoja = 0;
  for (let t = 0; t < nH; t++) {
    const x = nayte(la, lo, (idx) => {
      const u = U.get(idx), v = V.get(idx);
      if (!u || !v || !Number.isFinite(u[t]) || !Number.isFinite(v[t])) return null;
      const g = G.get(idx);
      return { u: u[t], v: v[t], g: g ? g[t] : NaN };
    });
    if (!x) { nop[t] = null; suunta[t] = null; puuska[t] = null; continue; }
    kelpoja++;
    nop[t] = Math.round(x.ms * 100) / 100;
    suunta[t] = Math.round(x.dir);
    puuska[t] = Number.isFinite(x.g) ? Math.round(x.g * 100) / 100 : null;
  }
  if (!kelpoja) throw new Error('ei dataa');
  return { tila: 'sarja', malli: MALLI, t0: alkuH * 3600e3, dtSek: 3600, n: nH,
           nop, suunta, puuska, ms: { yht: Date.now() - t0 } };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};
  try {
    const tulos = q.tila === 'sarja' ? await sarja(q) : await kentta(q);
    /* Sama osoite antaa saman ajon vastauksen tunnin ajan; uusi ajo
       tulee kuuden tunnin välein. */
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=1800');
    return res.status(200).json(tulos);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ error: String(err && err.message || err) });
  }
}
