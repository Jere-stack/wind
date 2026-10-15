/* ------------------------------------------------------------------
   DWD EWAM IJSSELMEERILLE JA MARKERMEERILLE (docs/aallot.md V5, luvut
   4.4 ja 4.7).

   IJsselmeer ja Markermeer (Pampus, IJmeer) eivät ole ECMWF:n eivätkä
   Copernicuksen aaltomalleissa: Luoteis-Euroopan hyllymeren mallissa ne
   ovat maata, ja ECMWF:n lähin märkä solmu on Pampuksesta 45 km. Saksan
   sääpalvelun Euroopan aaltomalli (EWAM, 0,05° × 0,1°) laskee ne
   järvinä: lähin märkä piste on Pampuksesta 2,7 km (mitattu 14.10.).

   KÄYTTÖALUE ON VAIN JÄRVI: perhe rakennetaan pelkistä monikulmion
   (IJsselmeer, Markermeer, IJmeer; pohjoisreuna Afsluitdijkiä pitkin)
   sisällä olevista märistä pisteistä, ja paino on 1 monikulmion sisällä
   ja 0 muualla. Monikulmion ulkopuolella EWAM ei ole Parhaassa — merellä
   ovat Copernicuksen ja ECMWF:n perheet — eikä sen kuiva maa peitä
   mitään. Perhe on luettelon ensimmäinen, koska Luoteis-Euroopan malli
   on järven kohdalla kuivaa maata joka peittäisi sen.

   Lähde: Open-Meteon peili (`data_spatial/dwd_ewam`, säännöllinen hila
   30–66 N, 10,5 W – 42 E; DWD:n avoin data), kaksi ajoa vuorokaudessa
   (00/12Z), +78 h tunneittain. Hilan reunat ovat oikein (rantaviivatesti
   98,75 %, docs/aallot.md 5.1). Jakso on keskijakso (`wave_period`, sama
   suure kuin muilla perheillä). Tiedostosta luetaan vain järven ikkuna
   (19 × 12 pistettä).                                                  */

import { OmFileReader, OmDataType } from '@openmeteo/file-reader';
import { akseli as s3Akseli, Esiluku } from './alueelliset.mjs';
import {
  luoAaltoPyramidi, kirjoitaAaltoHetki, tiivistaAaltoAika, kirjoitaAaltoTasot, tarkistaPisteet,
} from './aaltopyramidi.mjs';

export const EWAM_LAHDE = 'DWD EWAM · Open-Meteo / AWS Open Data · CC BY 4.0';

export const EWAM = {
  perhe: 'dwd_ewam', s3: 'dwd_ewam', ajoVali: 12, etuliite: 'wd', luottoKm: 10,
  hila: { la0: 30, lo0: -10.5, dy: 0.05, dx: 0.1, ny: 721, nx: 526 },
  /* Luettava ikkuna (lat, lng) ja tasot: [askel]. Karkeimmalla 0,1°:n
     tasolla järvi on kymmenkunta solmua; sitä karkeammin perhe ei ole
     kartalla (`_perheenTaso` hylkää yli nelinkertaisen askeleen). */
  ikkuna: { lat: [52.25, 53.15], lng: [4.8, 5.9] },
  tasot: [0.02, 0.05, 0.1],
  /* IJsselmeer, Markermeer ja IJmeer (lat, lng) vastapäivään Muidenista.
     Pohjoisreuna kulkee Afsluitdijkiä pitkin (Den Oever – Kornwerderzand),
     joten Waddenzee jää ulkopuolelle; lännessä raja on Durgerdamin
     kohdalla, joten Amsterdamin IJ ja Pohjanmeren kanava jäävät pois. */
  alue: [
    [52.320, 5.060], [52.345, 4.975], [52.395, 4.985], [52.500, 5.050], [52.640, 5.040],
    [52.700, 5.180], [52.765, 5.090], [52.930, 5.020], [53.070, 5.330], [53.095, 5.400],
    [53.000, 5.440], [52.880, 5.340], [52.860, 5.700], [52.680, 5.580], [52.600, 5.850],
    [52.560, 5.750], [52.520, 5.420], [52.420, 5.240], [52.330, 5.170],
  ],
  marat: [['IJsselmeer', 52.85, 5.35], ['Markermeer', 52.55, 5.2], ['IJmeer (Pampus)', 52.37, 5.1]],
  kuivat: [['Flevoland', 52.45, 5.65], ['Noord-Holland', 52.6, 4.85], ['Friesland', 53.0, 5.75]],
};

/* Piste monikulmion sisällä (parillisuussääntö). */
export function sisalla(alue, lat, lng) {
  let s = false;
  for (let i = 0, j = alue.length - 1; i < alue.length; j = i++) {
    const [ya, xa] = alue[i], [yb, xb] = alue[j];
    if ((ya > lat) !== (yb > lat) && lng < (xb - xa) * (lat - ya) / (yb - ya) + xa) s = !s;
  }
  return s;
}

const MUUTTUJAT = ['wave_height', 'wave_direction', 'wave_period'];

/* Ikkuna yhdestä tiedostosta: otsakkeet yhtenä alueena (`Esiluku`), sitten
   kolme muuttujaa ikkunan riveiltä ja sarakkeilta. */
async function lueIkkuna(url, ik) {
  const B = new Esiluku(url);
  const reader = await OmFileReader.create(B);
  try {
    const n = reader.numberOfChildren();
    let lo = Infinity, hi = 0;
    for (let i = 0; i < n; i++) {
      const md = reader._getChildMetadata(i);
      if (md) { lo = Math.min(lo, md.offset); hi = Math.max(hi, md.offset + md.size); }
    }
    if (hi > lo && hi - lo < 8e6) await B.esilataa(lo, hi - lo);
    const lapset = {};
    for (let i = 0; i < n; i++) {
      const c = await reader.getChild(i);
      if (!c) continue;
      if (MUUTTUJAT.includes(c.getName()) && !lapset[c.getName()]) lapset[c.getName()] = c; else c.dispose();
    }
    B.alue = null;
    if (!lapset.wave_height) throw new Error('wave_height puuttuu');
    const kentat = {};
    for (const nimi of MUUTTUJAT) {
      const c = lapset[nimi];
      if (!c) continue;
      const dims = Array.from(c.getDimensions());
      if (dims[0] !== EWAM.hila.ny || dims[1] !== EWAM.hila.nx) throw new Error(`hila vaihtui ${dims.join('x')}`);
      kentat[nimi] = await c.read({ type: OmDataType.FloatArray,
        ranges: [{ start: ik.j0, end: ik.j1 }, { start: ik.i0, end: ik.i1 }] });
    }
    for (const c of Object.values(lapset)) c.dispose();
    return kentat;
  } finally {
    reader.dispose();
  }
}

async function lueHetki(hetki, ik) {
  let virhe = null;
  for (const url of hetki.ehdokkaat) {
    for (let yritys = 0; yritys < 2; yritys++) {
      try { return await lueIkkuna(url, ik); }
      catch (e) {
        virhe = e;
        if (/40[34]|not found|forbidden/i.test(String(e && e.message))) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw virhe || new Error('ei ehdokkaita');
}

/* Kirjoittaa tasot `wd0`–`wd2` ja palauttaa { rivit, tilasto }; heittää jos
   jakso jäi lyhyeksi tai savutesti kaatui (tiilet.mjs: oma try/catch). */
export async function rakennaEwam({ ulos, log = () => {}, menneisyysH = 48, pala = 24, maxAskelta = 0, rinnakkainN = 6 } = {}) {
  const alkoi = Date.now();
  const P = EWAM, h = P.hila;
  const ik = {
    j0: Math.floor((P.ikkuna.lat[0] - h.la0) / h.dy), j1: Math.ceil((P.ikkuna.lat[1] - h.la0) / h.dy) + 1,
    i0: Math.floor((P.ikkuna.lng[0] - h.lo0) / h.dx), i1: Math.ceil((P.ikkuna.lng[1] - h.lo0) / h.dx) + 1,
  };
  const wx = ik.i1 - ik.i0;
  const ak = await s3Akseli({ s3: P.s3, ajoVali: P.ajoVali }, menneisyysH);
  let hetket = ak.hetket;
  if (maxAskelta > 0) hetket = hetket.slice(0, maxAskelta);
  if (hetket.length < 8) throw new Error('dwd_ewam: liian lyhyt jakso (' + hetket.length + ')');
  const nt = hetket.length;
  log(`  dwd_ewam: ajo ${new Date(ak.ajo).toISOString().slice(0, 13)}Z, ${nt} hetkeä `
    + `${new Date(hetket[0].ms).toISOString().slice(0, 13)} … ${new Date(hetket[nt - 1].ms).toISOString().slice(0, 13)}`);
  /* Lähde ensimmäisestä luetusta hetkestä: monikulmion märät pisteet. */
  let eka = null, i0 = -1;
  for (let i = 0; i < Math.min(3, nt) && !eka; i++) {
    try { eka = await lueHetki(hetket[i], ik); i0 = i; } catch (e) { log(`  ! dwd_ewam ${new Date(hetket[i].ms).toISOString().slice(0, 13)}: ${e.message}`); }
  }
  if (!eka) throw new Error('dwd_ewam: kolme ensimmäistä hetkeä epäonnistui');
  const lat = [], lon = [], idx = [];
  for (let j = ik.j0; j < ik.j1; j++) for (let i = ik.i0; i < ik.i1; i++) {
    const k = (j - ik.j0) * wx + (i - ik.i0);
    const la = h.la0 + j * h.dy, lo = h.lo0 + i * h.dx;
    if (Number.isFinite(eka.wave_height[k]) && sisalla(P.alue, la, lo)) { lat.push(la); lon.push(lo); idx.push(k); }
  }
  if (lat.length < 20) throw new Error('dwd_ewam: järvellä vain ' + lat.length + ' märkää pistettä');
  /* LUOTTOETÄISYYS 10 km eikä pisteväli (6,7 km): järven rantasolut ovat
     mallissa maata, ja 6,7 km:n luotolla Flevolandin ja Lemmerin rannat
     jäivät häivytyksen alle (mitattu 15.10. kuvasta). Monikulmio rajaa
     jatkeen järveen, joten pidempi jatke ei vie järven aaltoa merelle. */
  const lahde = { n: lat.length, lat: Float32Array.from(lat), lon: Float32Array.from(lon), idx: Int32Array.from(idx),
                  natiiviKm: P.luottoKm };
  const paino = (la, lo) => (sisalla(P.alue, la, lo) ? 1 : 0);
  const tasot = P.tasot.map((s, k) => ({
    id: P.etuliite + k, askel: s,
    lat: [Math.floor(P.ikkuna.lat[0] / s) * s, Math.ceil(P.ikkuna.lat[1] / s) * s],
    lng: [Math.floor(P.ikkuna.lng[0] / s) * s, Math.ceil(P.ikkuna.lng[1] / s) * s],
    paino,
  }));
  const pyr = luoAaltoPyramidi(tasot, lahde, nt, log);
  log(`  dwd_ewam: järven märkiä ${lahde.n}, solmuväli ${lahde.natiiviKm} km`);
  const kirjoitetut = new Set();
  const kirjoita = (ti, k) => {
    const n = lahde.n, hs = new Float32Array(n), dir = new Float32Array(n), tp = new Float32Array(n);
    for (let p = 0; p < n; p++) {
      const s = lahde.idx[p];
      hs[p] = k.wave_height[s];
      dir[p] = k.wave_direction ? k.wave_direction[s] : NaN;
      tp[p] = k.wave_period ? k.wave_period[s] : NaN;
    }
    kirjoitaAaltoHetki(pyr, ti, { hs, dir, tp });
    kirjoitetut.add(ti);
  };
  kirjoita(i0, eka);
  const savu = tarkistaPisteet(pyr, P.marat, P.kuivat);
  if (savu.length) throw new Error('dwd_ewam savutesti: ' + savu.join('; '));
  let seur = 0;
  await Promise.all(Array.from({ length: rinnakkainN }, async () => {
    for (;;) {
      const ti = seur++;
      if (ti >= nt) return;
      if (ti === i0) continue;
      try { kirjoita(ti, await lueHetki(hetket[ti], ik)); }
      catch (e) { log(`  ! dwd_ewam ${new Date(hetket[ti].ms).toISOString().slice(0, 13)}: ${e.message}`); }
    }
  }));
  const sailyta = [...kirjoitetut].sort((a, b) => a - b);
  if (sailyta.length < 8) throw new Error('dwd_ewam: liian vähän hetkiä');
  if (sailyta.length < nt) tiivistaAaltoAika(pyr, sailyta);
  const ajat = sailyta.map(i => hetket[i].ms);
  const { rivit, tavut } = kirjoitaAaltoTasot(pyr, ajat, ulos, pala, {
    perhe: P.perhe, malli: P.perhe, lahde: EWAM_LAHDE, ajoAika: new Date(ak.ajo).toISOString(),
  }, log);
  return { rivit, tilasto: { perhe: P.perhe, hetkia: ajat.length, kaikkiaan: nt, puuttui: nt - ajat.length,
    markia: lahde.n, alku: new Date(ajat[0]).toISOString(), loppu: new Date(ajat[ajat.length - 1]).toISOString(),
    mb: tavut / 1e6, s: (Date.now() - alkoi) / 1000 } };
}

/* Suora ajo mittausta varten: `node tools/ewam.mjs ulos [maxAskelta]`. */
if (import.meta.url === 'file://' + process.argv[1]) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ulos = process.argv[2] || 'ewam-testi';
  mkdirSync(ulos, { recursive: true });
  const r = await rakennaEwam({ ulos, log: (s) => console.log(s), maxAskelta: +(process.argv[3] || 0) });
  writeFileSync(`${ulos}/ewam.json`, JSON.stringify(r));
  console.log(JSON.stringify(r.tilasto));
}
