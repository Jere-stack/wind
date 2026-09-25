/* MALLIN OMA HILA — KENTTÄ TUNNEILLE TAI PISTEEN SARJA.
 *
 * Säälaattavarasto (`tools/tiilet.mjs`) pitää ECMWF:n 0,25°:na Pohjois-
 * Euroopassa ja 0,5–1°:na muualla, koska 9 km koko maapallolle koko
 * jaksolle olisi noin 2,9 GB ajoa kohti. Tämä funktio lukee mallin oman
 * hilan TARPEEN MUKAAN Open-Meteon avoimesta S3-peilistä (CC BY 4.0) —
 * Windyn tapa: kartta saa valitut tunnit näkymän alueelle, aikajana
 * kartan keskipisteen sarjan.
 *
 * MALLIT (`?malli=`, docs/mallit.md, V5 ja V6):
 *   ecmwf  ECMWF IFS 9 km (O1280). Oletus, ja "Paras saatavilla" käyttää
 *          tätä FMI:n ja MET Nordicin alla.
 *   icon   DWD ICON-EU 7 km (0,0625°) omalla alueellaan ja ICON 13 km
 *          (0,125°) muualla. Raja sekoitetaan 50 km matkalla ja ICON-EU:n
 *          jakson loppu kuuden tunnin matkalla — sama sääntö kuin
 *          varaston alueellisilla malleilla.
 *   gfs    NOAA GFS 13 km. Tuuli on `ncep_gfs013`:ssa (Gaussin N768-hila)
 *          mutta puuska vain `ncep_gfs025`:ssä (0,25°), joten puuska
 *          luetaan eri hilasta.
 *
 * KAKSI LÄHDETTÄ, KAKSI MUOTOA:
 *   kenttä  `data_spatial/<lähde>/<ajo>/<hetki>.om` — yksi tiedosto per
 *           hetki. `ennen`/`jalkeen` (0–6 h) pyytää saman alueen useammalle
 *           tunnille yhdellä kutsulla: sovellus interpoloi niiden välissä,
 *           jolloin aikajanan lyhyt raahaus pysyy samassa mallissa.
 *   sarja   `data/<lähde>/<muuttuja>/chunk_N.om` — Open-Meteon oma
 *           aikasarjavarasto. Tuorein ajo on kirjoitettu vanhojen päälle,
 *           joten menneisyys on valmiiksi parasta saatavilla olevaa.
 *
 * LISENSSI. `@openmeteo/file-reader` on GPL-2.0, ja siksi luku tehdään
 * TÄÄLLÄ eikä selaimessa: palvelimella ajettua koodia ei levitetä.    */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const NOP_ASKEL = 0.2, SUUNTA_ASKEL = 2, TYHJA = 255;
const RAD = Math.PI / 180;
const H = 3600e3;
const SEKOITUS_KM = 50, AIKA_ULOS_MS = 6 * H;
const ss = (x) => (x <= 0 ? 0 : (x >= 1 ? 1 : x * x * (3 - 2 * x)));

/* S3-PYYNNÖN AIKARAJA JA UUSINTA. Lukijan oletus on 30 s ja yksi
   uusinta, ja tuotannossa yksi kutsu seitsemästä jumittui täsmälleen
   30 sekuntiin (funktion `maxDuration`). Yksittäinen osaväliluku on
   mitattuna 50–300 ms, joten 6 s on jumi eikä hidas vastaus. */
const TAUSTA = { timeoutMs: 6000, retries: 2 };
const tausta = (url) => new OmHttpBackend({ url, ...TAUSTA });
const hae = (url) => fetch(url, { signal: AbortSignal.timeout(6000) });

/* -- HILAT ------------------------------------------------------------
 *
 * Jokainen hila antaa kolme asiaa:
 *   naapurit(la, lo)     bilineaarisen näytteen pisteet [avain, paino];
 *                        avain on litteä indeksi koko hilassa. Tyhjä
 *                        lista = piste on alueellisen hilan ulkopuolella.
 *   ikkuna(s, n, w, e)   osaväli jonka kenttä tarvitsee, ja avaimen paikka
 *                        luetussa taulukossa (-1 = ikkunan ulkopuolella).
 *   lohkot(avaimet)      samat pisteet aikasarjatiedostosta luettuna.   */

/* O1280 (ECMWF IFS 9 km): redusoitu Gaussin hila, 2 560 leveysriviä
 * pohjoisesta etelään, rivillä k (1..1280) 20 + 4(k−1) pistettä
 * pituusasteesta 0 itään, eteläinen puolisko peilinä. Leveysasteet ovat
 * Legendren polynomin juuria; Tricomin approksimaatio (4k−1)·180/(4·2560+2)
 * osuu niihin alle 0,0002°:n tarkkuudella. Suunnat tarkistettu varaston
 * ECMWF 0,25°:ta vasten: oikein päin ero 0,8–1,8 m/s, peilattuna
 * leveydessä 6,1 ja pituudessa 3,2–6,2 m/s. */
function o1280() {
  const NR = 2560;
  const nRivi = (k) => (k <= NR / 2 ? 20 + 4 * (k - 1) : 20 + 4 * (NR - k));
  const ALKU = new Float64Array(NR + 1);
  for (let k = 1; k <= NR; k++) ALKU[k] = ALKU[k - 1] + nRivi(k);
  const riviMurto = (la) => ((90 - la) / 180 * (4 * NR + 2) + 1) / 4;
  return {
    naapurit(la, lo) {
      const kf = riviMurto(la), k0 = Math.floor(kf), fy = kf - k0;
      const lon = ((lo % 360) + 360) % 360, out = [];
      for (const [kk, wy] of [[k0, 1 - fy], [k0 + 1, fy]]) {
        if (wy <= 0) continue;
        const k = Math.min(NR, Math.max(1, kk));
        const m = nRivi(k), x = lon / 360 * m;
        const j0 = Math.floor(x) % m, j1 = (j0 + 1) % m, fx = x - Math.floor(x);
        if (fx < 1) out.push([ALKU[k - 1] + j0, wy * (1 - fx)]);
        if (fx > 0) out.push([ALKU[k - 1] + j1, wy * fx]);
      }
      return out;
    },
    /* Leveyskaista riveinä, luetaan yhtenä välinä: mitattuna 5° kaista
       1,0 s / 0,28 MB, 20° kaista 2,1 s / 1,42 MB (kolme kenttää). */
    ikkuna(s, n) {
      const k0 = Math.max(1, Math.floor(riviMurto(n)) - 1);
      const k1 = Math.min(NR, Math.ceil(riviMurto(s)) + 1);
      const s0 = ALKU[k0 - 1], s1 = ALKU[k1];
      return { ranges: [{ start: 0, end: 1 }, { start: s0, end: s1 }], avain: String(s0),
               paikka: (a) => (a >= s0 && a < s1 ? a - s0 : -1) };
    },
    /* Peräkkäiset indeksit yhdeksi väliksi (rivin kaksi naapuria ovat
       vierekkäin paitsi rivin saumassa). */
    lohkot(avaimet) {
      const lista = [...new Set(avaimet)].sort((a, b) => a - b), valit = [];
      for (const p of lista) {
        const v = valit[valit.length - 1];
        if (v && p === v[1]) v[1] = p + 1; else valit.push([p, p + 1]);
      }
      return valit.map(([p0, p1]) => ({ ranges: [{ start: 0, end: 1 }, { start: p0, end: p1 }],
                                         paikka: (a) => (a >= p0 && a < p1 ? a - p0 : -1) }));
    },
  };
}

/* Säännöllinen pituusasteväli, rivit ETELÄSTÄ pohjoiseen (tarkistettu:
 * `tools/tiilet.mjs` lukee `ecmwf_ifs025`:n samoin). Leveysaste on joko
 * tasavälinen (`la0`, `dy`) tai Gaussin (`gauss` = rivien määrä, GFS:n
 * N768: ensimmäinen rivi −89,912°, mitattuna oikein päin korrelaatio
 * GFS 0,25°:n 100 m tuuleen 0,80, peilattuna 0,07). */
function saannollinen({ la0, dy, lo0, dx, ny, nx, gauss, globaali }) {
  const rivi = gauss
    ? (la) => ((la + 90) * (4 * gauss + 2) / 180 + 1) / 4 - 1
    : (la) => (la - la0) / dy;
  const sarake = (lo) => (lo - lo0) / dx;
  const rajaa = (x, m) => (x < 0 ? 0 : (x > m ? m : x));
  return {
    naapurit(la, lo) {
      let rf = rivi(la), cf = sarake(lo);
      if (!globaali && (rf < 0 || rf > ny - 1 || cf < 0 || cf > nx - 1)) return [];
      rf = rajaa(rf, ny - 1); cf = rajaa(cf, nx - 1);
      const r0 = Math.min(ny - 2, Math.floor(rf)), c0 = Math.min(nx - 2, Math.floor(cf));
      const fy = rf - r0, fx = cf - c0, out = [];
      for (const [r, wy] of [[r0, 1 - fy], [r0 + 1, fy]]) {
        if (wy <= 0) continue;
        for (const [c, wx] of [[c0, 1 - fx], [c0 + 1, fx]]) {
          if (wx > 0) out.push([r * nx + c, wy * wx]);
        }
      }
      return out;
    },
    ikkuna(s, n, w, e) {
      const r0 = Math.max(0, Math.floor(Math.min(rivi(s), rivi(n))) - 1);
      const r1 = Math.min(ny - 1, Math.ceil(Math.max(rivi(s), rivi(n))) + 1);
      const c0 = Math.max(0, Math.floor(sarake(w)) - 1);
      const c1 = Math.min(nx - 1, Math.ceil(sarake(e)) + 1);
      if (r1 < r0 || c1 < c0) return null;
      const wc = c1 - c0 + 1;
      return { ranges: [{ start: r0, end: r1 + 1 }, { start: c0, end: c1 + 1 }],
               avain: r0 + '_' + r1 + '_' + c0 + '_' + c1,
               paikka: (a) => {
                 const r = Math.floor(a / nx), c = a - r * nx;
                 return r < r0 || r > r1 || c < c0 || c > c1 ? -1 : (r - r0) * wc + (c - c0);
               } };
    },
    lohkot(avaimet) {
      if (!avaimet.length) return [];
      let r0 = ny, r1 = -1, c0 = nx, c1 = -1;
      for (const a of avaimet) {
        const r = Math.floor(a / nx), c = a - r * nx;
        r0 = Math.min(r0, r); r1 = Math.max(r1, r); c0 = Math.min(c0, c); c1 = Math.max(c1, c);
      }
      const wc = c1 - c0 + 1;
      return [{ ranges: [{ start: r0, end: r1 + 1 }, { start: c0, end: c1 + 1 }],
                paikka: (a) => {
                  const r = Math.floor(a / nx), c = a - r * nx;
                  return r < r0 || r > r1 || c < c0 || c > c1 ? -1 : (r - r0) * wc + (c - c0);
                } }];
    },
    /* Alueellisen hilan reuna, pisteen etäisyys siihen (km). */
    alue: globaali ? null : { s: la0, n: la0 + (ny - 1) * dy, w: lo0, e: lo0 + (nx - 1) * dx },
  };
}

/* -- LÄHTEET ----------------------------------------------------------
 *
 * `ajoVali` on ajojen väli tunteina: ICON-EU:lla kolme, koska sen
 * välimallit (03Z, 09Z…) ovat lyhyitä — kuuden tunnin askel ohittaisi
 * pitkät ajot kokonaan. `sarjaTunnit` on aikasarjatiedoston pituus
 * (`data/<lähde>/static/meta.json`, `chunk_time_length`). */
const U = 'wind_u_component_10m', V = 'wind_v_component_10m', G = 'wind_gusts_10m';
const LAHTEET = {
  ecmwf_ifs:   { hila: o1280(), ajoVali: 6, sarjaTunnit: 504, u: U, v: V, g: G },
  dwd_icon_eu: { hila: saannollinen({ la0: 29.5, dy: 0.0625, lo0: -23.5, dx: 0.0625, ny: 657, nx: 1377 }),
                 ajoVali: 3, sarjaTunnit: 193, u: U, v: V, g: G },
  dwd_icon:    { hila: saannollinen({ la0: -90, dy: 0.125, lo0: -180, dx: 0.125, ny: 1441, nx: 2879, globaali: true }),
                 ajoVali: 6, sarjaTunnit: 253, u: U, v: V, g: G },
  ncep_gfs013: { hila: saannollinen({ gauss: 1536, lo0: -180, dx: 360 / 3072, ny: 1536, nx: 3072, globaali: true }),
                 ajoVali: 6, sarjaTunnit: 481, u: U, v: V, g: null },
  ncep_gfs025: { hila: saannollinen({ la0: -90, dy: 0.25, lo0: -180, dx: 0.25, ny: 721, nx: 1440, globaali: true }),
                 ajoVali: 6, sarjaTunnit: 481, u: null, v: null, g: G },
};
for (const [id, L] of Object.entries(LAHTEET)) L.id = id;

/* Mallin osat tärkein ensin. `puuska` on lähde josta puuska luetaan kun
   tuulen lähteessä sitä ei ole. */
const MALLIT = {
  ecmwf: [{ lahde: 'ecmwf_ifs' }],
  icon:  [{ lahde: 'dwd_icon_eu' }, { lahde: 'dwd_icon' }],
  gfs:   [{ lahde: 'ncep_gfs013', puuska: 'ncep_gfs025' }],
};

/* -- AJOT --------------------------------------------------------------
 *
 * Lämpimän instanssin muisti: tuorein ajo ja sarjan loppu 5 min,
 * ajojen hetkilistat pysyvästi (ajo ei muutu valmistuttuaan). */
const tuoreimmat = new Map(), sarjaMetat = new Map(), ajoMeta = new Map();

async function haeTuorein(L) {
  const m = tuoreimmat.get(L.id);
  if (m && Date.now() - m.haettu < 300e3) return m.arvo;
  const r = await hae(`${S3}/data_spatial/${L.id}/latest.json`);
  if (!r.ok) throw new Error(L.id + ' latest.json HTTP ' + r.status);
  const arvo = await r.json();
  tuoreimmat.set(L.id, { arvo, haettu: Date.now() });
  return arvo;
}

/* MALLIN JAKSON LOPPU ON KAUIMMAS YLTÄVÄN AJON LOPPU, EI TUOREIMMAN.
   ICON-EU:n välimallit (03Z, 09Z, 15Z, 21Z) ulottuvat vain 30 tuntiin,
   pitkät 120:een. Ensimmäinen versio luki lopun aikasarjavaraston
   `data_end_time`sta, joka kertoo TUOREIMMAN ajon lopun: lyhyen ajon
   jälkeen ICON-EU alkoi häipyä globaaliin ICON:iin 24 tunnin kohdalla
   (mitattu Helsingissä kenttä 6,8 m/s, ajo itse 7,58 m/s ja aikajana
   7,58). Sama sääntö kuin varaston akselilla (CLAUDE.md, "VARASTON
   AKSELIN LOPPU TULEE KAUIMMAS YLTÄVÄSTÄ AJOSTA"). Pitkä ajo on aina
   12 tunnin sisällä. */
async function mallinLoppu(L) {
  const m = sarjaMetat.get(L.id);
  if (m && Date.now() - m.haettu < 300e3) return m.arvo;
  let arvo = null;
  try {
    const uusin = Date.parse((await haeTuorein(L)).reference_time), askel = L.ajoVali * H;
    const ajot = [];
    for (let a = uusin; a >= uusin - 12 * H; a -= askel) ajot.push(a);
    for (const ajat of await Promise.all(ajot.map((a) => haeAjonHetket(L, a)))) {
      if (ajat && ajat.length) arvo = Math.max(arvo == null ? -Infinity : arvo, ajat[ajat.length - 1]);
    }
  } catch (e) { /* ei tiedossa: aikapainoa ei rajata */ }
  sarjaMetat.set(L.id, { arvo, haettu: Date.now() });
  return arvo;
}

const ajoPolku = (ms) => {
  const d = new Date(ms);
  return `${d.toISOString().slice(0, 10).replace(/-/g, '/')}/${String(d.getUTCHours()).padStart(2, '0')}00Z`;
};
const tiedosto = (ms) => new Date(ms).toISOString().slice(0, 16).replace(':', '');

/* Ajon hetket. ECMWF on tunneittain 90 h asti, sitten 3 h ja 144 h:sta
   6 h; ICON 78 h:iin ja sitten 3 h; GFS 120 h:iin ja sitten 3 h. Hetki
   askelten välissä interpoloidaan, kuten varasto tekee. */
async function haeAjonHetket(L, a) {
  const avain = L.id + '|' + a;
  if (ajoMeta.has(avain)) return ajoMeta.get(avain);
  let ajat = null;
  try {
    const r = await hae(`${S3}/data_spatial/${L.id}/${ajoPolku(a)}/meta.json`);
    if (r.ok) {
      const m = await r.json();
      ajat = (m.valid_times || []).map((t) => Date.parse(t)).filter(Number.isFinite);
    }
  } catch (e) { /* ajoa ei ole */ }
  ajoMeta.set(avain, ajat);
  if (ajoMeta.size > 96) ajoMeta.delete(ajoMeta.keys().next().value);
  return ajat;
}

/* Tuorein ajo joka kattaa hetken. Menneisyys on vanhojen ajojen
   alkutunneissa, joten haku alkaa hetkeä edeltävästä ajosta eikä
   tuoreimmasta — ajo joka alkaa hetken jälkeen ei voi sisältää sitä.
   Palauttaa kaksi tiedostoa ja osuuden niiden välillä, tai null. */
async function etsiAjo(L, tMs) {
  const meta = await haeTuorein(L);
  const uusin = Date.parse(meta.reference_time), askel = L.ajoVali * H;
  for (let a = Math.min(uusin, Math.floor(tMs / askel) * askel), k = 0; k < 32 && a > uusin - 96 * H; a -= askel, k++) {
    const ajat = await haeAjonHetket(L, a);
    if (!ajat || !ajat.length || tMs < ajat[0] || tMs > ajat[ajat.length - 1]) continue;
    const i = ajat.findIndex((t) => t >= tMs);
    const url = (t) => `${S3}/data_spatial/${L.id}/${ajoPolku(a)}/${tiedosto(t)}.om`;
    if (ajat[i] === tMs) return { ajo: a, A: url(tMs), B: null, f: 0 };
    const tA = ajat[i - 1], tB = ajat[i];
    return { ajo: a, A: url(tA), B: url(tB), f: (tMs - tA) / (tB - tA) };
  }
  return null;
}

/* MUUTTUJIEN OTSAKKEET YHDELLÄ PYYNNÖLLÄ.
 *
 * Muuttujien järjestys vaihtelee tiedostosta toiseen (mitattu saman ajon
 * seitsemästä tiedostosta: ECMWF:n u oli lapsi 22, 29, 30 tai 31, ICON:n
 * 3–8), joten indeksiä ei voi muistaa ja nimet on luettava. Lukija hakee
 * jokaisen lapsen otsakkeen omalla pyynnöllään, ja ICON-tiedostossa
 * lapsia on 126–128 (painepinnat): 7 tunnin paketti oli mitattuna
 * 12,4 s. Otsakkeet ovat tiedoston lopussa yhtenä alueena (ICON-EU
 * 161 kB, ICON 680 kB, ECMWF 302 kB, GFS 188 kB), joten se haetaan
 * kerralla ja lapset luetaan muistista: 3 pyyntöä ja 0,4–0,7 s
 * tiedostoa kohti mallista riippumatta. */
class Esiluku {
  constructor(url) { this.b = new OmHttpBackend({ url, ...TAUSTA }); this.alue = null; }
  count(signal) { return this.b.count(signal); }
  close() { return this.b.close(); }
  async getBytes(o, n, signal) {
    const a = this.alue;
    if (a && o >= a.o && o + n <= a.o + a.d.length) return a.d.slice(o - a.o, o - a.o + n);
    return this.b.getBytes(o, n, signal);
  }
  async esilataa(o, n) { this.alue = { o, d: await this.b.getBytes(o, n) }; }
}

/* Avatut tiedostot lämpimän instanssin muistissa: `data_spatial` ei muutu
   valmistuttuaan, ja aikajanan raahaus siirtää tuntipakettia tunnin
   kerrallaan, jolloin suurin osa tiedostoista on samoja. Häädetty
   lukija vapautetaan vasta minuutin päästä, koska rinnakkainen kutsu voi
   yhä lukea sitä (funktion katto on 30 s). */
const TUULI_NIMET = new Set(['wind_u_component_10m', 'wind_v_component_10m', 'wind_gusts_10m']);
const avoimet = new Map();
function avaa(url) {
  const vanha = avoimet.get(url);
  if (vanha) { avoimet.delete(url); avoimet.set(url, vanha); return vanha; }
  const p = (async () => {
    const B = new Esiluku(url);
    const reader = await OmFileReader.create(B);
    const n = reader.numberOfChildren();
    let lo = Infinity, hi = 0;
    for (let i = 0; i < n; i++) {
      const m = reader._getChildMetadata(i);
      if (m) { lo = Math.min(lo, m.offset); hi = Math.max(hi, m.offset + m.size); }
    }
    if (hi > lo && hi - lo < 4e6) await B.esilataa(lo, hi - lo);
    const kaikki = await Promise.all(Array.from({ length: n }, (_, i) => reader.getChild(i)));
    const lapset = {};
    for (const c of kaikki) {
      if (!c) continue;
      if (TUULI_NIMET.has(c.getName())) lapset[c.getName()] = c; else c.dispose();
    }
    B.alue = null;
    return { reader, lapset };
  })();
  p.catch(() => { if (avoimet.get(url) === p) avoimet.delete(url); });
  avoimet.set(url, p);
  while (avoimet.size > 48) {
    const [k, v] = avoimet.entries().next().value;
    avoimet.delete(k);
    v.then((o) => setTimeout(() => {
      for (const c of Object.values(o.lapset)) c.dispose();
      o.reader.dispose();
    }, 60e3), () => {});
  }
  return p;
}

async function lueTiedosto(url, nimet, ranges) {
  const { lapset } = await avaa(url);
  const tulos = {};
  await Promise.all(nimet.map(async (nimi) => {
    const c = lapset[nimi];
    tulos[nimi] = c ? await c.read({ type: OmDataType.FloatArray, ranges }) : null;
  }));
  return tulos;
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

/* Bilineaarinen näyte: nopeus ja puuska keskiarvona, suunta
   yksikkövektoreista — sama sääntö kuin varastossa ja sovelluksessa.
   `lue(avain)` palauttaa { u, v } tai null; puuska luetaan erikseen,
   koska GFS:llä se on eri hilassa. */
function tuuli(naapurit, lue) {
  let sN = 0, sS = 0, sC = 0, wN = 0;
  for (const [a, w] of naapurit) {
    const p = lue(a);
    if (!p) continue;
    const s = Math.hypot(p.u, p.v);
    sN += s * w; wN += w;
    if (s > 1e-6) { sS += -p.u / s * w; sC += -p.v / s * w; }
  }
  if (!wN) return null;
  return { ms: sN / wN, dir: (Math.atan2(sS, sC) / RAD + 360) % 360 };
}
function skalaari(naapurit, lue) {
  let s = 0, w = 0;
  for (const [a, p] of naapurit) {
    const x = lue(a);
    if (Number.isFinite(x)) { s += x * p; w += p; }
  }
  return w ? s / w : NaN;
}
/* AJASSA NOPEUS JA SUUNTA ERIKSEEN, suunta lyhintä kaarta — sama sääntö
   kuin sovelluksen `_naytePerhe`. */
function ajassa(x, y, f) {
  if (!x || !y) return x || y;
  const dd = ((y.dir - x.dir) % 360 + 540) % 360 - 180;
  return { ms: x.ms + (y.ms - x.ms) * f, dir: ((x.dir + dd * f) % 360 + 360) % 360 };
}
const skalaariAjassa = (a, b, f) =>
  (Number.isFinite(a) && Number.isFinite(b) ? a + (b - a) * f : (Number.isFinite(a) ? a : b));

/* Alueellisen hilan paino pisteessä: smoothstep etäisyydestä reunaan
   50 km matkalla (sama kuin varaston painokanava). */
function reunaPaino(alue, la, lo) {
  if (!alue) return 1;
  const kLa = 111.2, kLo = 111.2 * Math.cos(la * RAD);
  const d = Math.min((la - alue.s) * kLa, (alue.n - la) * kLa, (lo - alue.w) * kLo, (alue.e - lo) * kLo);
  return ss(d / SEKOITUS_KM);
}

/* Osien sekoitus tärkein ensin: kukin peittää alemmat painonsa verran,
   nopeus painotettuna keskiarvona ja suunta yksikkövektoreista —
   täsmälleen sovelluksen `naytteista`. */
function sekoita(naytteet) {
  let jaljella = 1, sN = 0, sS = 0, sC = 0, sW = 0, sG = 0, wG = 0;
  for (const x of naytteet) {
    if (!x || x.w <= 0) continue;
    const c = jaljella * x.w, r = x.dir * RAD;
    sN += c * x.ms; sS += c * Math.sin(r); sC += c * Math.cos(r); sW += c;
    if (Number.isFinite(x.g)) { sG += c * x.g; wG += c; }
    jaljella *= 1 - x.w;
    if (jaljella <= 0.002) break;
  }
  if (!sW) return null;
  return { ms: sN / sW, dir: (Math.atan2(sS, sC) / RAD + 360) % 360, g: wG ? sG / wG : NaN };
}

/* -- KENTTÄ ------------------------------------------------------------ */

const kokonaisluku = (x, a, b, oletus) => {
  const n = Math.round(Number(x));
  return Number.isFinite(n) ? Math.min(b, Math.max(a, n)) : oletus;
};

async function kentta(q) {
  const osat = MALLIT[q.malli || 'ecmwf'];
  if (!osat) throw new Error('tuntematon malli');
  const tKeski = Math.round(Number(q.t) / H) * H;
  const ennen = kokonaisluku(q.ennen, 0, 6, 0), jalkeen = kokonaisluku(q.jalkeen, 0, 6, 0);
  const s = Math.max(-89.9, Number(q.s)), n = Math.min(89.9, Number(q.n));
  const w = Number(q.w), e = Number(q.e);
  const askel = Math.min(1, Math.max(0.05, Number(q.askel) || 0.1));
  if (![tKeski, s, n, w, e].every(Number.isFinite) || n <= s || e <= w) throw new Error('virheellinen rajaus');
  if (e - w > 120 || n - s > 60) throw new Error('liian laaja rajaus');
  if (w < -180 || e > 180) throw new Error('päivämääräraja');
  /* Hilan origo globaalisti kohdistettuna, kuten sovelluksen solmuhila. */
  const la0 = Math.floor(s / askel) * askel, lo0 = Math.floor(w / askel) * askel;
  const nj = Math.round((Math.ceil(n / askel) * askel - la0) / askel) + 1;
  const ni = Math.round((Math.ceil(e / askel) * askel - lo0) / askel) + 1;
  const la1 = la0 + (nj - 1) * askel, lo1 = lo0 + (ni - 1) * askel;
  const t0 = Date.now();

  /* Kutsun oma tiedostomuisti: sama tiedosto (kolmen tunnin askelen
     kohdalla usean tunnin päätepiste) luetaan kerran. */
  const luetut = new Map();
  const lue = (url, L, ikkuna, nimet) => {
    const avain = url + '|' + ikkuna.avain + '|' + nimet.join(',');
    if (!luetut.has(avain)) luetut.set(avain, lueTiedosto(url, nimet, ikkuna.ranges).catch(() => null));
    return luetut.get(avain);
  };
  /* Osan ikkuna ja naapurit solmuille kerran lähdettä kohti. */
  const valmistele = (L) => {
    const alue = L.hila.alue;
    if (alue && (la1 < alue.s || la0 > alue.n || lo1 < alue.w || lo0 > alue.e)) return null;
    const ikkuna = L.hila.ikkuna(la0, la1, lo0, lo1);
    if (!ikkuna) return null;
    const nn = new Array(ni * nj), paino = new Float32Array(ni * nj);
    for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
      const la = la0 + j * askel, lo = lo0 + i * askel, k = j * ni + i;
      nn[k] = L.hila.naapurit(la, lo).map(([a, p]) => [ikkuna.paikka(a), p]).filter(([a]) => a >= 0);
      paino[k] = reunaPaino(alue, la, lo);
    }
    return { L, ikkuna, nn, paino };
  };
  const valmisteltu = new Map();
  const valmis = (id) => {
    if (!valmisteltu.has(id)) valmisteltu.set(id, valmistele(LAHTEET[id]));
    return valmisteltu.get(id);
  };

  /* Yhden lähteen yksi hetki: tiedostot ja osuus niiden välillä. */
  async function hetki(id, nimet, tMs) {
    const V_ = valmis(id);
    if (!V_) return null;
    const aj = await etsiAjo(V_.L, tMs);
    if (!aj) return null;
    const [A, B] = await Promise.all([lue(aj.A, V_.L, V_.ikkuna, nimet),
                                      aj.B ? lue(aj.B, V_.L, V_.ikkuna, nimet) : null]);
    if (!A || (aj.B && !B)) return null;
    return { V: V_, A, B, f: aj.f, ajo: aj.ajo };
  }

  const tunnit = [];
  for (let k = -ennen; k <= jalkeen; k++) tunnit.push(tKeski + k * H);
  const loput = await Promise.all(osat.map((o) => mallinLoppu(LAHTEET[o.lahde])));

  const tulokset = await Promise.all(tunnit.map(async (tMs) => {
    const osa = await Promise.all(osat.map(async (o, oi) => {
      const L = LAHTEET[o.lahde];
      const aikaW = oi < osat.length - 1 && loput[oi] != null ? ss((loput[oi] - tMs) / AIKA_ULOS_MS) : 1;
      if (aikaW <= 0) return null;
      const nimet = [L.u, L.v].concat(L.g ? [L.g] : []);
      const [tu, pu] = await Promise.all([
        hetki(o.lahde, nimet, tMs),
        o.puuska ? hetki(o.puuska, [LAHTEET[o.puuska].g], tMs) : null,
      ]);
      if (!tu || !tu.A[L.u] || !tu.A[L.v]) return null;
      return { L, aikaW, tu, pu };
    }));
    if (!osa.some(Boolean)) return null;
    const N = ni * nj;
    const nop = new Uint8Array(N), suu = new Uint8Array(N), puu = new Uint8Array(N);
    let kelpoja = 0;
    for (let k = 0; k < N; k++) {
      const naytteet = osa.map((x) => {
        if (!x) return null;
        const V_ = x.tu.V, wAlue = V_.paino[k] * x.aikaW;
        if (wAlue <= 0 || !V_.nn[k].length) return null;
        const nn = V_.nn[k], L = x.L;
        const lukija = (T) => (a) => {
          const u = T[L.u][a], v = T[L.v][a];
          return Number.isFinite(u) && Number.isFinite(v) ? { u, v } : null;
        };
        const tuA = tuuli(nn, lukija(x.tu.A));
        const t = x.tu.B ? ajassa(tuA, tuuli(nn, lukija(x.tu.B)), x.tu.f) : tuA;
        if (!t) return null;
        /* Puuska: oma lähde (GFS) tai sama tiedosto. Puuttuu analyysin
           hetkeltä (T+0), tuuli ei saa puuttua. */
        let g = NaN;
        if (x.pu) {
          const Pg = x.pu.V.L.g, pn = x.pu.V.nn[k];
          const gA = skalaari(pn, (a) => x.pu.A[Pg] ? x.pu.A[Pg][a] : NaN);
          g = x.pu.B ? skalaariAjassa(gA, skalaari(pn, (a) => x.pu.B[Pg] ? x.pu.B[Pg][a] : NaN), x.pu.f) : gA;
        } else if (L.g) {
          const gA = skalaari(nn, (a) => x.tu.A[L.g] ? x.tu.A[L.g][a] : NaN);
          g = x.tu.B ? skalaariAjassa(gA, skalaari(nn, (a) => x.tu.B[L.g] ? x.tu.B[L.g][a] : NaN), x.tu.f) : gA;
        }
        return { ms: t.ms, dir: t.dir, g, w: wAlue };
      });
      const x = sekoita(naytteet);
      nop[k] = x ? pakkaaNopeus(x.ms) : TYHJA;
      suu[k] = x ? pakkaaSuunta(x.dir) : TYHJA;
      puu[k] = x ? pakkaaNopeus(x.g) : TYHJA;
      if (x) kelpoja++;
    }
    if (!kelpoja) return null;
    const eka = osa.find(Boolean);
    return { t: tMs, nop, suu, puu, ajo: eka.tu.ajo, lahteet: osa.filter(Boolean).map((x) => x.L.id) };
  }));
  const kelvot = tulokset.filter(Boolean);
  if (!kelvot.length) throw new Error('ei ajoa joka kattaa hetken');
  const luku = Date.now() - t0;
  const liita = (k) => {
    const N = ni * nj, ulos = new Uint8Array(N * kelvot.length);
    kelvot.forEach((x, i) => ulos.set(x[k], i * N));
    return Buffer.from(ulos.buffer, ulos.byteOffset, ulos.byteLength).toString('base64');
  };
  const keski = kelvot.find((x) => x.t === tKeski) || kelvot[0];
  return {
    tila: 'kentta', malli: q.malli || 'ecmwf', t: tKeski, ajat: kelvot.map((x) => x.t),
    ajo: keski.ajo, lahteet: keski.lahteet,
    la0: +la0.toFixed(4), lo0: +lo0.toFixed(4), askel, ni, nj,
    nopAskel: NOP_ASKEL, suuntaAskel: SUUNTA_ASKEL, tyhja: TYHJA,
    nop: liita('nop'), suunta: liita('suu'), puuska: liita('puu'),
    ms: { luku, yht: Date.now() - t0, tiedostoja: luetut.size },
  };
}

/* -- SARJA -------------------------------------------------------------
 *
 * Pisteen sarja tuntiakselilla [alku, loppu]. Tiedosto kattaa
 * `sarjaTunnit` tuntia, joten jakso voi osua kahteen. Luetaan vain
 * pisteen naapurit (O1280:ssa kaksi väliä, säännöllisessä 2 × 2). */
async function lueSarja(L, nimi, avaimet, alkuH, loppuH) {
  const nH = loppuH - alkuH + 1, len = L.sarjaTunnit;
  const arvot = new Map();
  for (const a of avaimet) arvot.set(a, new Float32Array(nH).fill(NaN));
  const lohkot = L.hila.lohkot(avaimet);
  const c0 = Math.floor(alkuH / len), c1 = Math.floor(loppuH / len);
  const tyot = [];
  for (let c = c0; c <= c1; c++) {
    tyot.push((async () => {
      let reader;
      try { reader = await OmFileReader.create(tausta(`${S3}/data/${L.id}/${nimi}/chunk_${c}.om`)); }
      catch (e) { return; }
      const h0 = Math.max(alkuH, c * len), h1 = Math.min(loppuH, c * len + len - 1);
      if (h1 < h0) return;
      const leveys = h1 - h0 + 1;
      await Promise.all(lohkot.map(async (lo) => {
        const x = await reader.read({ type: OmDataType.FloatArray,
          ranges: lo.ranges.concat([{ start: h0 - c * len, end: h1 - c * len + 1 }]) });
        for (const a of avaimet) {
          const p = lo.paikka(a);
          if (p < 0) continue;
          const kohde = arvot.get(a);
          for (let t = 0; t < leveys; t++) kohde[h0 - alkuH + t] = x[p * leveys + t];
        }
      }));
    })());
  }
  await Promise.all(tyot);
  return arvot;
}

/* SARJA KENTÄN SOLMUISTA. Kartta näytteistää kentän solmuhilasta
 * (`askel`), ja aikajanan on näytettävä sama luku (CLAUDE.md, "AIKAJANA
 * ON KARTAN SEKOITUS"). Yksi piste pyöristettynä 0,05°:een antoi
 * Helsingin keskustassa mitattuna 0,7–0,9 m/s eri luvun kuin kartta,
 * koska rannikolla kahden kilometrin siirto on jo eri tuuli. `askel`in
 * kanssa sarja palautetaan pisteen ympäröivän solmuruudun neljälle
 * kulmalle — samoille solmuille joihin kenttä on laskettu — ja sovellus
 * interpoloi niiden välissä samalla säännöllä kuin kartta. */
async function sarja(q) {
  const osat = MALLIT[q.malli || 'ecmwf'];
  if (!osat) throw new Error('tuntematon malli');
  const la = Number(q.lat), lo = Number(q.lng);
  const nyt = Math.floor(Date.now() / H);
  const alkuH = Number.isFinite(Number(q.alku)) ? Math.floor(Number(q.alku) / H) : nyt - 50;
  const loppuH = Number.isFinite(Number(q.loppu)) ? Math.ceil(Number(q.loppu) / H) : nyt + 16 * 24;
  if (!Number.isFinite(la) || !Number.isFinite(lo) || loppuH <= alkuH || loppuH - alkuH > 30 * 24) {
    throw new Error('virheellinen piste tai jakso');
  }
  const a = Number(q.askel) > 0 ? Math.min(1, Math.max(0.05, Number(q.askel))) : null;
  const pyor = (x) => +x.toFixed(4);
  const la0 = a ? pyor(Math.floor(la / a + 1e-9) * a) : la, lo0 = a ? pyor(Math.floor(lo / a + 1e-9) * a) : lo;
  const pisteet = a
    ? [[la0, lo0], [la0, pyor(lo0 + a)], [pyor(la0 + a), lo0], [pyor(la0 + a), pyor(lo0 + a)]]
    : [[la, lo]];
  const t0 = Date.now(), nH = loppuH - alkuH + 1;
  /* Osa kerrallaan: kaikkien pisteiden naapurit luetaan yhdellä kertaa. */
  const osaSarjat = await Promise.all(osat.map(async (o) => {
    const L = LAHTEET[o.lahde], P = o.puuska ? LAHTEET[o.puuska] : null;
    const nnt = pisteet.map(([y, x]) => L.hila.naapurit(y, x));
    const pnnt = P ? pisteet.map(([y, x]) => P.hila.naapurit(y, x)) : null;
    const avaimet = [...new Set(nnt.flat().map(([k]) => k))];
    if (!avaimet.length) return null;
    const [Us, Vs, Gs] = await Promise.all([
      lueSarja(L, L.u, avaimet, alkuH, loppuH),
      lueSarja(L, L.v, avaimet, alkuH, loppuH),
      P ? lueSarja(P, P.g, [...new Set(pnnt.flat().map(([k]) => k))], alkuH, loppuH)
        : (L.g ? lueSarja(L, L.g, avaimet, alkuH, loppuH) : null),
    ]);
    return pisteet.map(([y, x], pi) => {
      const nn = nnt[pi], gnn = P ? pnnt[pi] : nn;
      if (!nn.length) return null;
      const arvot = new Array(nH);
      let viimeinen = -1;
      for (let t = 0; t < nH; t++) {
        const tt = tuuli(nn, (k) => {
          const u = Us.get(k)[t], v = Vs.get(k)[t];
          return Number.isFinite(u) && Number.isFinite(v) ? { u, v } : null;
        });
        if (!tt) { arvot[t] = null; continue; }
        arvot[t] = { ms: tt.ms, dir: tt.dir, g: Gs ? skalaari(gnn, (k) => Gs.get(k)[t]) : NaN };
        viimeinen = t;
      }
      return { arvot, viimeinen, alue: reunaPaino(L.hila.alue, y, x) };
    });
  }));
  let kelpoja = 0;
  const solmut = pisteet.map((_, pi) => {
    const nop = new Array(nH), suunta = new Array(nH), puuska = new Array(nH);
    for (let t = 0; t < nH; t++) {
      const naytteet = osaSarjat.map((os, oi) => {
        const o = os && os[pi];
        if (!o || !o.arvot[t]) return null;
        /* Alueellisen osan aikaraja: sen oman sarjan viimeisestä tunnista
           kuuden tunnin smoothstep, kuten kentässä. */
        const aikaW = oi < osat.length - 1 ? ss((o.viimeinen - t) * H / AIKA_ULOS_MS) : 1;
        return { ...o.arvot[t], w: o.alue * aikaW };
      });
      const x = sekoita(naytteet);
      if (!x) { nop[t] = null; suunta[t] = null; puuska[t] = null; continue; }
      kelpoja++;
      nop[t] = Math.round(x.ms * 100) / 100;
      suunta[t] = Math.round(x.dir);
      puuska[t] = Number.isFinite(x.g) ? Math.round(x.g * 100) / 100 : null;
    }
    return { nop, suunta, puuska };
  });
  if (!kelpoja) throw new Error('ei dataa');
  const yhteiset = { tila: 'sarja', malli: q.malli || 'ecmwf', t0: alkuH * H, dtSek: 3600, n: nH,
                     ms: { yht: Date.now() - t0 } };
  return a ? { ...yhteiset, la0, lo0, askel: a, solmut } : { ...yhteiset, ...solmut[0] };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  const q = req.query || {};
  try {
    const tulos = q.tila === 'sarja' ? await sarja(q) : await kentta(q);
    /* Sama osoite antaa saman ajon vastauksen tunnin ajan; uusi ajo
       tulee 3–6 tunnin välein. */
    res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=1800');
    return res.status(200).json(tulos);
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ error: String(err && err.message || err) });
  }
}
