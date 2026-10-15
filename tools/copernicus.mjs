/* ------------------------------------------------------------------
   COPERNICUS MARINEN ALUEELLISET AALTOMALLIT (docs/aallot.md V5, luvut
   4.5 ja 4.7). Itämeri (FMI WAM), Luoteis-Euroopan hyllymeri (Met
   Office WW3, 1,5 km), Biskaja–Iberia–Irlanti (Météo-France MFWAM,
   0,028°), Välimeri (HCMR WAM 4,2 km) ja Mustameri (Hereon WAM 2,5 km)
   aaltovaraston perheiksi (`tools/aaltopyramidi.mjs`).

   PÄÄSY: STAC-luettelo antaa jokaisen tuotteen ARCO-osoitteet, ja
   tuoteversio vaihtuu (`_202311` → `_202611`), joten osoite luetaan
   luettelosta joka ajolla eikä kovakoodata: uusin versio jolla on
   `timeChunked`-varasto eikä se ole valmisteilla. `timeChunked.zarr` on
   Zarr v2: koko alue yhtenä palana tunnilta, int16 skaalalla ja
   siirtymällä (muuttujakohtaiset: NWS:n korkeus 0,002 m, IBI:n 0,01 m),
   pakkaus blosc-lz4 (`tools/blosc.mjs`). Aika on muuttujan omissa
   yksiköissä (sekunteja 1970 tai tunteja 1950).

   MUUTTUJAT: VHM0 merkitsevä aallonkorkeus, VMDR keskisuunta MISTÄ
   (`sea_surface_wave_from_direction`, sama kuin ECMWF:n ja FMI:n), VTM10
   keskijakso käänteisestä taajuusmomentista (Tm−1,0, sama määritelmä kuin
   ECMWF:n `wave_period`).

   EHDOT: maksuton ja johdetut tuotteet saa jakaa, kun lähdemerkintä
   "Generated using E.U. Copernicus Marine Service Information" näkyy
   (sovelluksen Tietoa-näkymä).

   PAINO AVOMEREN REUNASTA (4.7): siemenet ovat märät pisteet niillä
   hilan reunoilla jotka ovat avomerta (`avoimet`). Kaikki reunat
   siemeninä sekoittaisivat esimerkiksi Perämeren pohjukan ECMWF:ään
   (Itämeren hila päättyy 65,9°N:ssa juuri rannan kohdalla).          */

import { bloscPura } from './blosc.mjs';
import {
  luoAaltoPyramidi, kirjoitaAaltoHetki, tiivistaAaltoAika, kirjoitaAaltoTasot,
  tarkistaPisteet, avomeriPaino,
} from './aaltopyramidi.mjs';

/* Alueellisten aaltoperheiden yhteinen alue (Copernicus, FMI WAM, EWAM):
   pohjan meren rasteri (`pohjaMeri`) rakennetaan tälle kerran. */
export const ALUEELLISTEN_ALUE = { lat: [25, 67], lng: [-20, 43] };

const STAC = 'https://stac.marine.copernicus.eu/metadata';
const H = 3600e3;
export const KOPERNIKUS_LAHDE = 'Generated using E.U. Copernicus Marine Service Information';

/* Perheet etusijajärjestyksessä (tihein ensin; FMI:n avoimen datan WAM
   on niiden yläpuolella, koska sen ajo on tuoreempi, ks. `tools/tiilet.mjs`).
   `tasot`: [askel, lat?, lng?] — ilman rajausta koko hila. */
export const KOPERNIKUS = [
  { perhe: 'cmems_bal', tuote: 'BALTICSEA_ANALYSISFORECAST_WAV_003_010', aineisto: 'cmems_mod_bal_wav_anfc_PT1H-i',
    etuliite: 'wb', avoimet: ['w'], tasot: [[0.02, [59.2, 66], [19, 30.4]], [0.05], [0.1], [0.25], [0.5], [1.0]],
    marat: [['Suomenlahti', 59.85, 25.5], ['Selkämeri', 62.0, 19.5], ['Gotlanti', 57.3, 20.1]],
    kuivat: [['Tampere', 61.5, 23.8], ['Uppsala', 59.86, 17.64]] },
  { perhe: 'cmems_nws', tuote: 'NWSHELF_ANALYSISFORECAST_WAV_004_014', aineisto: 'cmems_mod_nws_wav_anfc_1.5km_PT1H-i',
    etuliite: 'wn', avoimet: ['w', 'e', 's', 'n'], tasot: [[0.05], [0.1], [0.25], [0.5], [1.0]],
    marat: [['Pohjanmeri', 56.0, 3.0], ['Kanaali', 50.2, -1.5], ['Irlanninmeri', 53.5, -5.3]],
    kuivat: [['Lontoo', 51.5, -0.12], ['Pariisi', 48.85, 2.35], ['Birmingham', 52.48, -1.9]] },
  { perhe: 'cmems_ibi', tuote: 'IBI_ANALYSISFORECAST_WAV_005_005', aineisto: 'cmems_mod_ibi_wav_anfc_0.027deg_PT1H-i',
    etuliite: 'wi', avoimet: ['w', 'e', 's', 'n'], tasot: [[0.05], [0.1], [0.25], [0.5], [1.0]],
    marat: [['Biskaja', 45.0, -6.0], ['Kanariat', 28.5, -15.5], ['Cádizinlahti', 36.5, -7.5]],
    kuivat: [['Madrid', 40.4, -3.7], ['Sevilla', 37.4, -6.0], ['Bordeaux', 44.84, -0.58]] },
  { perhe: 'cmems_blk', tuote: 'BLKSEA_ANALYSISFORECAST_WAV_007_003', aineisto: 'cmems_mod_blk_wav_anfc_2.5km_PT1H-i',
    etuliite: 'wk', avoimet: ['w', 's'], tasot: [[0.05], [0.1], [0.25], [0.5], [1.0]],
    marat: [['Mustameri', 43.5, 34.0], ['Azovanmeri', 46.0, 36.5]],
    kuivat: [['Krasnodar', 45.04, 38.98], ['Simferopol', 44.95, 34.1]] },
  { perhe: 'cmems_med', tuote: 'MEDSEA_ANALYSISFORECAST_WAV_006_017', aineisto: 'cmems_mod_med_wav_anfc_4.2km_PT1H-i',
    etuliite: 'wm', avoimet: ['w'], tasot: [[0.05], [0.1], [0.25], [0.5], [1.0]],
    marat: [['Tyrrhenanmeri', 40.0, 12.0], ['Levantti', 34.0, 30.0], ['Joonianmeri', 37.0, 18.0]],
    kuivat: [['Rooman sisämaa', 42.0, 13.0], ['Kairo', 30.05, 31.25], ['Ateenan sisämaa', 38.5, 22.5]] },
];

async function hae(url, tyyppi = 'buf', yrityksia = 3) {
  for (let k = 0; ; k++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return tyyppi === 'json' ? await r.json() : new Uint8Array(await r.arrayBuffer());
    } catch (e) {
      if (k >= yrityksia - 1) throw new Error(url.slice(-60) + ': ' + e.message);
      await new Promise(r => setTimeout(r, 1500 * (k + 1)));
    }
  }
}

/* Tuotteen uusin käyttökelpoinen versio STAC:sta: `timeChunked`-varasto
   jonka aikajakso ulottuu nykyhetkeen. */
export async function etsiVarasto(tuote, aineisto) {
  const p = await hae(`${STAC}/${tuote}/product.stac.json`, 'json');
  if (!p) throw new Error(tuote + ': ei tuotetta');
  const ehdokkaat = (p.links || []).filter(l => l.rel === 'item' && l.href.startsWith(aineisto + '_'))
    .map(l => l.href).sort().reverse();
  for (const h of ehdokkaat) {
    const d = await hae(`${STAC}/${tuote}/${h}`, 'json');
    const pr = (d && d.properties) || {};
    if (pr.admp_in_preparation) continue;
    const tc = d.assets && d.assets.timeChunked;
    if (!tc || !tc.href) continue;
    const t = pr['cube:dimensions'] && pr['cube:dimensions'].time;
    const loppu = t && t.extent ? Date.parse(t.extent[1]) : NaN;
    if (Number.isFinite(loppu) && loppu < Date.now()) continue;
    /* Ajohetkeä luettelo ei kerro; datan päivityshetki on lähin vastine
       (BAL 15.10. klo 08.19 UTC), ja yhteenvedon vanhenemishälytys lukee
       sen (`ajoAika`). */
    const paivitetty = Date.parse(pr.admp_updated_data || pr.admp_updated || '');
    return { href: tc.href, versio: h.split('/')[0], loppu, paivitetty: Number.isFinite(paivitetty) ? paivitetty : null };
  }
  throw new Error(tuote + ': ei käyttökelpoista versiota');
}

function tyypitetty(u8, dtype) {
  const b = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  if (dtype === '<f4') return new Float32Array(b);
  if (dtype === '<f8') return new Float64Array(b);
  if (dtype === '<i2') return new Int16Array(b);
  if (dtype === '<i4') return new Int32Array(b);
  if (dtype === '<i8') return Float64Array.from(new BigInt64Array(b), x => Number(x));
  throw new Error('dtype ' + dtype);
}

function aikayksikko(units) {
  const m = /^(seconds|minutes|hours|days) since (.+)$/.exec(units || '');
  if (!m) throw new Error('aikayksikkö ' + units);
  const kerroin = { seconds: 1e3, minutes: 60e3, hours: H, days: 24 * H }[m[1]];
  let t = m[2].trim().replace(' ', 'T');
  if (!/[zZ]|[+-]\d\d:?\d\d$/.test(t)) t += (t.length <= 10 ? 'T00:00:00' : '') + 'Z';
  const e = Date.parse(t);
  if (!Number.isFinite(e)) throw new Error('aikayksikkö ' + units);
  return (v) => e + v * kerroin;
}

/* Zarr v2 -varasto: metatiedot, aika ja koordinaatit, kentän luku. */
export async function avaaZarr(href) {
  const meta = (await hae(href + '/.zmetadata', 'json')).metadata;
  const taulu = async (nimi) => {
    const a = meta[nimi + '/.zarray'];
    const nc = Math.ceil(a.shape[0] / a.chunks[0]), osat = [];
    for (let c = 0; c < nc; c++) osat.push(tyypitetty(bloscPura(await hae(`${href}/${nimi}/${c}`)), a.dtype));
    const ulos = new Float64Array(a.shape[0]);
    let o = 0;
    for (const x of osat) { ulos.set(x.subarray(0, Math.min(x.length, ulos.length - o)), o); o += x.length; }
    return ulos;
  };
  const aikaMs = aikayksikko((meta['time/.zattrs'] || {}).units);
  const aika = (await taulu('time')).map(aikaMs);
  const lat = await taulu('latitude'), lon = await taulu('longitude');
  /* Pala voi sisältää useamman hetken (BAL ja MED 2, BLK 6): purettu pala
     muistetaan, koska rinnakkaiset työt lukevat peräkkäisiä hetkiä. */
  const palat = new Map();
  const pala = (nimi, c) => {
    const avain = nimi + '|' + c;
    let p = palat.get(avain);
    if (!p) {
      const a = meta[nimi + '/.zarray'], sep = a.dimension_separator || '.';
      p = hae(`${href}/${nimi}/${c}${sep}0${sep}0`).then(raaka => (raaka ? tyypitetty(bloscPura(raaka), a.dtype) : null));
      palat.set(avain, p);
      while (palat.size > 36) palat.delete(palat.keys().next().value);
    }
    return p;
  };
  const kentta = async (nimi, ti) => {
    const a = meta[nimi + '/.zarray'], at = meta[nimi + '/.zattrs'] || {};
    const ct = a.chunks[0], c = Math.floor(ti / ct), n = lat.length * lon.length, o = (ti - c * ct) * n;
    const ulos = new Float32Array(n).fill(NaN);
    const x = await pala(nimi, c);
    if (!x) return ulos;
    const sk = at.scale_factor != null ? at.scale_factor : 1, so = at.add_offset != null ? at.add_offset : 0;
    const fill = a.fill_value;
    for (let k = 0; k < n; k++) { const v = x[o + k]; if (v !== fill && v === v) ulos[k] = v * sk + so; }
    return ulos;
  };
  return { href, meta, aika, lat, lon, kentta };
}

/* AKSELI: 48 h menneisyyttä kuuden tunnin välein, tunneittain +24 h:iin,
   kolmen tunnin välein +144 h:iin ja kuuden tunnin välein loppuun.
   Lataus on koko alueen kenttä aika-askeleelta (NWS 2,2 Mt kolmelle
   muuttujalle), joten tunneittainen akseli koko jaksolle olisi
   viisinkertainen; väli interpoloidaan asiakkaalla kuten ECMWF:llä. */
export function kopernikusAkseli(aika, nyt = Date.now(), menneisyysH = 48) {
  const T0 = Math.floor(nyt / H) * H, alku = T0 - menneisyysH * H;
  const ulos = [];
  for (let i = 0; i < aika.length; i++) {
    const t = aika[i];
    if (t < alku || t % H !== 0) continue;
    const dh = (t - T0) / H;
    const askel = dh < 0 ? 6 : dh <= 24 ? 1 : dh <= 144 ? 3 : 6;
    if (((dh % askel) + askel) % askel) continue;
    ulos.push({ t, i });
  }
  return ulos;
}

/* Märät lähdepisteet ensimmäisestä kentästä ja avomeren siemenet
   (märät pisteet kolmen solun sisällä avoimesta reunasta). */
function lahde(z, hs, avoimet) {
  const nj = z.lat.length, ni = z.lon.length;
  let n = 0;
  for (let k = 0; k < hs.length; k++) if (Number.isFinite(hs[k])) n++;
  const lat = new Float32Array(n), lon = new Float32Array(n), idx = new Int32Array(n), siemenet = [];
  let p = 0;
  for (let j = 0; j < nj; j++) for (let i = 0; i < ni; i++) {
    const k = j * ni + i;
    if (!Number.isFinite(hs[k])) continue;
    lat[p] = z.lat[j]; lon[p] = z.lon[i]; idx[p] = k; p++;
    if ((avoimet.includes('s') && j < 3) || (avoimet.includes('n') && j >= nj - 3)
        || (avoimet.includes('w') && i < 3) || (avoimet.includes('e') && i >= ni - 3)) siemenet.push([z.lat[j], z.lon[i]]);
  }
  const dj = Math.abs(z.lat[1] - z.lat[0]), di = Math.abs(z.lon[1] - z.lon[0]);
  const la = (z.lat[0] + z.lat[nj - 1]) / 2;
  const natiiviKm = +Math.max(dj * 111.2, di * 111.2 * Math.cos(la * Math.PI / 180)).toFixed(2);
  return { n, lat, lon, idx, natiiviKm, siemenet };
}

/* Yksi perhe varastoon: palauttaa { rivit, tilasto } tai heittää. */
export async function rakennaKopernikus(P, { ulos, log = () => {}, pala = 24, rinnakkainN = 8, maxAskelta = 0, menneisyysH = 48,
                                             pohjaMeri = null } = {}) {
  const alkoi = Date.now();
  const v = await etsiVarasto(P.tuote, P.aineisto);
  const z = await avaaZarr(v.href);
  if (z.lat[1] < z.lat[0]) throw new Error(P.perhe + ': leveysasteet pohjoisesta (ei tuettu)');
  let akseli = kopernikusAkseli(z.aika, Date.now(), menneisyysH);
  if (maxAskelta > 0) akseli = akseli.slice(0, maxAskelta);
  if (akseli.length < 8) throw new Error(P.perhe + ': liian lyhyt jakso (' + akseli.length + ')');
  const nt = akseli.length;
  const alue = { lat: [z.lat[0], z.lat[z.lat.length - 1]], lng: [z.lon[0], z.lon[z.lon.length - 1]] };
  log(`  ${P.perhe}: ${v.versio}, ${z.lat.length} × ${z.lon.length}, ${nt} hetkeä `
    + `${new Date(akseli[0].t).toISOString().slice(0, 13)} … ${new Date(akseli[nt - 1].t).toISOString().slice(0, 13)}`);
  let pyr = null, lahdeL = null, savu = null, tavuja = 0;
  const kirjoitetut = new Set();
  const tasot = (paino) => P.tasot.map(([s, la, lo], k) => ({
    id: P.etuliite + k, askel: s,
    lat: la || [Math.floor(alue.lat[0] / s) * s, Math.ceil(alue.lat[1] / s) * s],
    lng: lo || [Math.floor(alue.lng[0] / s) * s, Math.ceil(alue.lng[1] / s) * s],
    paino,
  }));
  const lueHetki = async (ti) => {
    const { i } = akseli[ti];
    const [hs, dir, tp] = await Promise.all(['VHM0', 'VMDR', 'VTM10'].map(m => z.kentta(m, i)));
    return { hs, dir, tp };
  };
  /* Ensimmäinen hetki rakentaa lähteen ja pyramidin. */
  const eka = await lueHetki(0);
  lahdeL = lahde(z, eka.hs, P.avoimet);
  const paino = avomeriPaino(lahdeL.siemenet, alue);
  pyr = luoAaltoPyramidi(tasot(paino), lahdeL, nt, log, { pohjaMeri });
  log(`  ${P.perhe}: märkiä ${lahdeL.n}, avomeren reunalla ${lahdeL.siemenet.length}, solmuväli ${lahdeL.natiiviKm} km`);
  const kirjoita = (ti, k) => {
    const n = lahdeL.n, hs = new Float32Array(n), dir = new Float32Array(n), tp = new Float32Array(n);
    for (let p = 0; p < n; p++) { const s = lahdeL.idx[p]; hs[p] = k.hs[s]; dir[p] = k.dir[s]; tp[p] = k.tp[s]; }
    kirjoitaAaltoHetki(pyr, ti, { hs, dir, tp });
    kirjoitetut.add(ti);
  };
  kirjoita(0, eka);
  savu = tarkistaPisteet(pyr, P.marat, P.kuivat);
  if (savu.length) throw new Error(P.perhe + ' savutesti: ' + savu.join('; '));
  let seur = 1;
  await Promise.all(Array.from({ length: rinnakkainN }, async () => {
    for (;;) {
      const ti = seur++;
      if (ti >= nt) return;
      try { kirjoita(ti, await lueHetki(ti)); }
      catch (e) { log(`  ! ${P.perhe} ${new Date(akseli[ti].t).toISOString().slice(0, 13)}: ${e.message}`); }
    }
  }));
  const sailyta = [...kirjoitetut].sort((a, b) => a - b);
  if (sailyta.length < 8) throw new Error(P.perhe + ': liian vähän hetkiä');
  if (sailyta.length < nt) tiivistaAaltoAika(pyr, sailyta);
  const ajat = sailyta.map(i => akseli[i].t);
  const { rivit, tavut } = kirjoitaAaltoTasot(pyr, ajat, ulos, pala, {
    perhe: P.perhe, malli: P.perhe, lahde: KOPERNIKUS_LAHDE + ' · ' + v.versio,
    ajoAika: new Date(v.paivitetty || ajat[0]).toISOString(),
  }, log);
  return { rivit, tilasto: { perhe: P.perhe, hetkia: ajat.length, kaikkiaan: nt, puuttui: nt - ajat.length,
    markia: lahdeL.n, versio: v.versio, paivitetty: v.paivitetty ? new Date(v.paivitetty).toISOString() : null,
    alku: new Date(ajat[0]).toISOString(), loppu: new Date(ajat[ajat.length - 1]).toISOString(),
    mb: tavut / 1e6, s: (Date.now() - alkoi) / 1000 } };
}

/* Suora ajo mittausta varten: `node tools/copernicus.mjs ulos [perhe] [maxAskelta]`
   (`VALTA=0` ohittaa pohjan meren, jolloin ECMWF:n maskia ei lueta). */
if (import.meta.url === 'file://' + process.argv[1]) {
  const { writeFileSync, mkdirSync } = await import('node:fs');
  const ulos = process.argv[2] || 'copernicus-testi';
  mkdirSync(ulos, { recursive: true });
  const valitut = process.argv[3] && process.argv[3] !== 'kaikki' ? KOPERNIKUS.filter(p => p.perhe === process.argv[3]) : KOPERNIKUS;
  let pohjaMeri = null;
  if (process.env.VALTA !== '0') {
    const { ecmwfMarat } = await import('./aallot.mjs');
    const { pohjaMeri: pm } = await import('./aaltopyramidi.mjs');
    const t0 = Date.now();
    pohjaMeri = pm(await ecmwfMarat(), ALUEELLISTEN_ALUE);
    console.log(`  pohjan meri: ${pohjaMeri.pisteita} ECMWF:n märkää pistettä, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
  const tulokset = [];
  for (const P of valitut) {
    try {
      const r = await rakennaKopernikus(P, { ulos, log: (s) => console.log(s), maxAskelta: +(process.argv[4] || 0), pohjaMeri });
      tulokset.push(r);
      console.log(JSON.stringify(r.tilasto));
    } catch (e) { console.log('! ' + P.perhe + ': ' + e.message); }
  }
  writeFileSync(`${ulos}/kopernikus.json`, JSON.stringify(tulokset));
}
