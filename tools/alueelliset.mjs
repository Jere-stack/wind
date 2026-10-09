/* ------------------------------------------------------------------
   Euroopan alueelliset mallit säännölliseksi 0,05°:n hilaksi
   (docs/eurooppa.md, S1 ja V1).

   Kymmenen kansallista 1–2,5 km mallia luetaan Open-Meteon avoimesta
   S3-peilistä (CC BY 4.0, ei avainta, ei kiintiötä) samalla tavalla kuin
   MET Nordic (`tools/metnordic.mjs`): jokainen lähdepiste lasketaan kerran
   lähimpään 0,05°:n solmuun, ja hetken kenttä on aluekeskiarvo (nopeus
   keskiarvona, suunta yksikkövektoreista). Siitä `tools/pyramidi.mjs`
   kirjoittaa tasot 0,05 / 0,1 / 0,25 / 0,5°.

   JÄRJESTYS JA KÄYTTÖALUEET OVAT TÄSSÄ TAULUKOSSA (`ALUEELLISET`), ja
   rakentaja kirjoittaa järjestyksen luetteloon (`perheet`), josta asiakas
   sen lukee. Sääntö (docs/eurooppa.md, S1): tihein natiivihila ensin,
   kansallinen malli tasapelissä (2–2,5 km), ja jokaisella laajalla
   mallilla käyttöalue — muuten UKV:n 2 km hila voittaisi Oslossa ja DINI
   Helsingissä ja Kroatiassa, joissa ne ovat mallinsa reuna-alueella.

   PAINO = DATAN REUNA × KÄYTTÖALUE.
   - Datan reuna: AROME HD:n ja ICON-D2:n säännöllinen hila on mallin
     Lambert-alueen ympäröivä suorakaide, ja 17 % siitä on NaN:ia
     (mitattu koko hilasta 4.10.2026). Etäisyys lasketaan siksi
     lähimpään TYHJÄÄN solmuun (chamfer, km), ei suorakaiteen reunaan.
     Projektiohiloilla data on täynnä, ja sama lasku antaa etäisyyden
     hilan reunaan. Smoothstep mallin omalla matkalla (`reunaKm`).
   - Käyttöalue: maajoukko `tools/maat.json`ista (meri lähimmälle
     rannikkomaalle 150 km:iin). Alueen sisällä 1, ja sen ulkopuolella
     paino häipyy 30 km:n matkalla (`KAYTTO_KM`): ylempi malli ulottuu
     alemman kotimaahan vain häivytyksen verran, eikä rajalle jää
     kolmannen mallin kaistaa.

   GEOMETRIA ON OPEN-METEON LÄHDEKOODISTA (`Sources/App/Domains/*.swift`)
   ja tarkistettu sen rajapintaa vasten (docs/eurooppa.md, 3.2): lähin
   solu S3:sta = rajapinnan arvo nopeudeltaan ja suunnaltaan.
   Suunnat ovat todellisesta pohjoisesta myös Lambert- ja LAEA-hiloilla. */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { smoothstep } from './pyramidi.mjs';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const RAD = Math.PI / 180;
const H = 3600e3;
export const ASKEL = 0.05;
export const TASOT_POHJA = [0.05, 0.1, 0.25, 0.5, 1.0];
const KAYTTO_KM = 30;

/* -- PROJEKTIOT (Open-Meteon Projectable, Float64:nä) ------------------ */

function lcc({ lon0, lat0, lat1, R }) {
  const l0 = ((lon0 + 180) % 360 - 180) * RAD, p0 = lat0 * RAD, p1 = lat1 * RAD;
  const n = Math.sin(p1);
  const F = Math.cos(p1) * Math.pow(Math.tan(Math.PI / 4 + p1 / 2), n) / n;
  const rho0 = F / Math.pow(Math.tan(Math.PI / 4 + p0 / 2), n);
  return {
    eteen(lat, lon) {
      let d = lon * RAD - l0; d = Math.atan2(Math.sin(d), Math.cos(d));
      const th = n * d, p = F / Math.pow(Math.tan(Math.PI / 4 + lat * RAD / 2), n);
      return [R * p * Math.sin(th), R * (rho0 - p * Math.cos(th))];
    },
    taakse(x, y) {
      const xs = x / R, ys = y / R;
      const th = Math.atan2(xs, rho0 - ys), rho = Math.hypot(xs, rho0 - ys);
      let lon = (l0 + th / n) / RAD; if (lon > 180) lon -= 360;
      return [(2 * Math.atan(Math.pow(F / rho, 1 / n)) - Math.PI / 2) / RAD, lon];
    },
  };
}
function laea({ lon0, lat1, R }) {
  const l0 = lon0 * RAD, p1 = lat1 * RAD;
  return {
    eteen(lat, lon) {
      const l = lon * RAD, p = lat * RAD;
      const k = Math.sqrt(2 / (1 + Math.sin(p1) * Math.sin(p) + Math.cos(p1) * Math.cos(p) * Math.cos(l - l0)));
      return [R * k * Math.cos(p) * Math.sin(l - l0), R * k * (Math.cos(p1) * Math.sin(p) - Math.sin(p1) * Math.cos(p) * Math.cos(l - l0))];
    },
    taakse(x, y) {
      x /= R; y /= R;
      const r = Math.hypot(x, y);
      if (r === 0) return [lat1, lon0];
      const c = 2 * Math.asin(0.5 * r);
      const p = Math.asin(Math.cos(c) * Math.sin(p1) + y * Math.sin(c) * Math.cos(p1) / r);
      const l = l0 + Math.atan2(x * Math.sin(c), r * Math.cos(p1) * Math.cos(c) - y * Math.sin(p1) * Math.sin(c));
      return [p / RAD, l / RAD];
    },
  };
}
/* Kierretty napa (ICON-CH, KNMI). `lat`/`lon` kuten Open-Meteon
   RotatedLatLonProjection(latitude:, longitude:). */
function kierretty({ lat, lon }) {
  const th = (90 + lat) * RAD, ph = lon * RAD;
  return {
    eteen(la, lo) {
      const l = lo * RAD, p = la * RAD;
      const x = Math.cos(l) * Math.cos(p), y = Math.sin(l) * Math.cos(p), z = Math.sin(p);
      const x2 = Math.cos(th) * Math.cos(ph) * x + Math.cos(th) * Math.sin(ph) * y + Math.sin(th) * z;
      const y2 = -Math.sin(ph) * x + Math.cos(ph) * y;
      const z2 = -Math.sin(th) * Math.cos(ph) * x - Math.sin(th) * Math.sin(ph) * y + Math.cos(th) * z;
      return [-Math.atan2(y2, x2) / RAD, -Math.asin(z2) / RAD];
    },
    taakse(x, y) {
      const l = x * RAD, p = y * RAD;
      const lat2 = -Math.asin(Math.cos(th) * Math.sin(p) - Math.cos(l) * Math.sin(th) * Math.cos(p));
      const lon2 = -(Math.atan2(Math.sin(l), Math.tan(p) * Math.sin(th) + Math.cos(l) * Math.cos(th)) - ph);
      return [lat2 / RAD, ((lon2 / RAD + 180) % 360 + 360) % 360 - 180];
    },
  };
}

/* Hilan määrittely -> lähdepisteen (i, j) paikka. `saannollinen`: rivit
   etelästä pohjoiseen, sarakkeet lännestä itään (Open-Meteon
   RegularGrid). `projektio`: origo projektion koordinaateissa ja askel
   metreinä tai kierretyinä asteina (ProjectionGrid). */
/* Projektiohilan origo ja askel. `vastakulma` (MET Nordic): askel
   johdetaan kulmista eikä kirjoiteta lukuna — 1 000,03 × 1 000,05 m on se
   mikä kulmista tulee, ja pyöreä 1 000 siirtäisi vastakkaisen reunan
   60 m sivuun (`tools/metnordic.mjs`). */
function projektioOf(h) {
  const P = h.proj === 'lcc' ? lcc(h.p) : h.proj === 'laea' ? laea(h.p) : kierretty(h.p);
  let x0 = h.x0, y0 = h.y0, dx = h.dx, dy = h.dy;
  if (h.origo) [x0, y0] = P.eteen(h.origo[0], h.origo[1]);
  if (h.vastakulma) {
    const [x1, y1] = P.eteen(h.vastakulma[0], h.vastakulma[1]);
    dx = (x1 - x0) / (h.nx - 1); dy = (y1 - y0) / (h.ny - 1);
  }
  return { P, x0, y0, dx, dy };
}
export function hilanPaikka(h) {
  if (h.tyyppi === 'saannollinen') {
    return (i, j) => [h.la0 + j * h.dy, h.lo0 + i * h.dx];
  }
  const { P, x0, y0, dx, dy } = projektioOf(h);
  return (i, j) => P.taakse(x0 + i * dx, y0 + j * dy);
}
/* Käänteinen: paikka -> lähdehilan murtoindeksi [i, j] (sarake, rivi).
   Palvelimen natiivikenttä (`api/malli.js`, docs/eurooppa.md V2) näytteistää
   tällä mallin oman hilan bilineaarisesti. */
export function hilanIndeksi(h) {
  if (h.tyyppi === 'saannollinen') {
    return (lat, lng) => [(lng - h.lo0) / h.dx, (lat - h.la0) / h.dy];
  }
  const { P, x0, y0, dx, dy } = projektioOf(h);
  return (lat, lng) => {
    const [x, y] = P.eteen(lat, lng);
    return [(x - x0) / dx, (y - y0) / dy];
  };
}

/* -- MALLIT, JÄRJESTYKSESSÄ (docs/eurooppa.md, S1) --------------------
 *
 * `perhe` = asiakkaan perhe ja lähderekisterin avain (`Lahde.NIMET`).
 * `kentat`: 'uv' (u, v, puuska) tai 'sd' (nopeus, suunta, puuska).
 * `ajoVali`: ajojen väli tunteina (S3:n ajohakemistot, mitattu).
 * `alue`: käyttöalueen maat (`null` = koko data); `avomeri`: suorakaide
 *   (lat, lng) jonka sisällä myös yli 150 km rannikosta oleva meri kuuluu
 *   alueeseen. `rajaus`: pyramidin suorakaide (lat, lng); ilman sitä
 *   hilan oma maantieteellinen ulottuma, ja käyttöalueen kanssa sen ja
 *   alueen (+ häivytys) leikkaus (`rajausOf`).
 * `reunaKm`: pehmennyksen matka datan reunasta.
 * `viimeinen`: saman nimen lapsista luetaan viimeinen (UKV:ssä on kaksi
 *   `wind_speed_10m`-lasta, ja rajapinta käyttää jälkimmäistä).
 * `natiivi`: lähizoomin solmuväli asteina (mallin oma tarkkuus,
 *   docs/eurooppa.md V2); `sarjaTunnit`: aikasarjavaraston lohkon pituus
 *   (`data/<s3>/static/meta.json`, `chunk_time_length`, mitattu 5.10.). */
const PAIKKA = (o) => o;
export const ALUEELLISET = [
  PAIKKA({
    perhe: 'aladin_cz', s3: 'chmi_aladin_cz_1km', id: 'cz', kentat: 'sd', ajoVali: 6, reunaKm: 30, alue: null,
    natiivi: 0.01, sarjaTunnit: 120,
    hila: { tyyppi: 'saannollinen', la0: 48.5, lo0: 12.0, dy: (51.098 - 48.5) / 289, dx: (18.995 - 12.0) / 500, nx: 501, ny: 290 },
    lahde: 'ČHMÚ · ALADIN 1 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'icon_ch1', s3: 'meteoswiss_icon_ch1', id: 'c1', kentat: 'uv', ajoVali: 3, reunaKm: 100, alue: null,
    natiivi: 0.01, sarjaTunnit: 48,
    hila: { tyyppi: 'projektio', proj: 'kierretty', p: { lat: 43.0, lon: 190.0 }, x0: -6.46, y0: -4.06, dx: 0.01, dy: 0.01, nx: 1089, ny: 705 },
    lahde: 'MeteoSwiss · ICON-CH1 1 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'ukv', s3: 'ukmo_uk_deterministic_2km', id: 'uk', kentat: 'sd', viimeinen: true, ajoVali: 1, reunaKm: 50,
    natiivi: 0.02, sarjaTunnit: 79,
    alue: ['GB', 'IE', 'IM', 'JE', 'GG'],
    hila: { tyyppi: 'projektio', proj: 'laea', p: { lon0: -2.5, lat1: 54.9, R: 6371229 }, x0: -1158000, y0: -1036000, dx: 2000, dy: 2000, nx: 1042, ny: 970 },
    /* MET OFFICEN DATA ON CC BY-SA 4.0 (Open-Meteon lisenssisivu, 4.10.2026):
       siitä johdetut laatat jaetaan samalla lisenssillä, ja Tietoa sanoo sen. */
    lahde: 'Met Office · UKV 2 km · Open-Meteo / AWS Open Data · CC BY-SA 4.0',
  }),
  PAIKKA({
    perhe: 'arome_hd', s3: 'meteofrance_arome_france_hd', id: 'ah', kentat: 'uv', ajoVali: 3, reunaKm: 80, alue: null,
    natiivi: 0.01, sarjaTunnit: 108,
    hila: { tyyppi: 'saannollinen', la0: 37.5, lo0: -12.0, dy: 0.01, dx: 0.01, nx: 2801, ny: 1791 },
    lahde: 'Météo-France · AROME 1,3 km · Open-Meteo / AWS Open Data · Licence Ouverte 2.0',
  }),
  /* MET Nordic on taulukossa järjestyksen, käyttöalueen ja lähizoomin
     natiivihilan vuoksi: varaston lukija on `tools/metnordic.mjs`
     (`erillinen`), ja `tiilet.mjs` kirjoittaa sen kuten ennenkin.
     Käyttöalue rajaa sen MEPS-maihin. Venäjä on mukana, koska
     Luoteis-Venäjällä (Karjala, Kuola) muuta alueellista mallia ei ole ja
     MET Nordic kattoi sen ennenkin; Kaliningrad tulee samalla. Hila on
     `tools/metnordic.mjs`:n Lambert (pallo, 63°, 15°, kulmat). */
  PAIKKA({ perhe: 'metnordic', erillinen: true, s3: 'metno_nordic_pp', kentat: 'sd', ajoVali: 1,
    alue: ['NO', 'SE', 'FI', 'AX', 'EE', 'LV', 'LT', 'SJ', 'RU'],
    natiivi: 0.01, sarjaTunnit: 112,
    hila: { tyyppi: 'projektio', proj: 'lcc', p: { lon0: 15, lat0: 63, lat1: 63, R: 6371229 },
            origo: [52.302723, 1.918457], vastakulma: [72.18527, 41.764282], nx: 1796, ny: 2321 } }),
  /* DINI on UWC-Westin yhteinen malli: Tanskan, Hollannin, Irlannin ja
     Islannin kansallinen (ja Färsaarten, jotka DMI kattaa). Avomeri vain
     Pohjanmeren keskellä, jottei Britannian ja Tanskan väliin jää ECMWF:n
     kaistaa; Atlantin avomerelle se ei kirjoita laattoja. */
  PAIKKA({
    perhe: 'dini', s3: 'dmi_harmonie_arome_europe', id: 'dn', kentat: 'sd', ajoVali: 3, reunaKm: 50,
    natiivi: 0.02, sarjaTunnit: 90,
    alue: ['DK', 'NL', 'BE', 'IE', 'IS', 'FO'], avomeri: { lat: [53.0, 59.5], lng: [-2.0, 9.0] },
    hila: { tyyppi: 'projektio', proj: 'lcc', p: { lon0: 352, lat0: 55.5, lat1: 55.5, R: 6371229 }, origo: [39.671, -25.421997], dx: 2000, dy: 2000, nx: 1906, ny: 1606 },
    lahde: 'DMI · HARMONIE DINI 2 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'icon_ch2', s3: 'meteoswiss_icon_ch2', id: 'c2', kentat: 'uv', ajoVali: 6, reunaKm: 100, alue: null,
    natiivi: 0.02, sarjaTunnit: 144,
    hila: { tyyppi: 'projektio', proj: 'kierretty', p: { lat: 43.0, lon: 190.0 }, x0: -6.46, y0: -4.06, dx: 0.02, dy: 0.02, nx: 545, ny: 353 },
    lahde: 'MeteoSwiss · ICON-CH2 2 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'icon_d2', s3: 'dwd_icon_d2', id: 'd2', kentat: 'uv', ajoVali: 3, reunaKm: 50, alue: ['DE'],
    natiivi: 0.02, sarjaTunnit: 121,
    hila: { tyyppi: 'saannollinen', la0: 43.18, lo0: -3.94, dy: 0.02, dx: 0.02, nx: 1215, ny: 746 },
    lahde: 'DWD · ICON-D2 2,2 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'icon_2i', s3: 'italia_meteo_arpae_icon_2i', id: 'it', kentat: 'sd', ajoVali: 12, reunaKm: 50,
    natiivi: 0.02, sarjaTunnit: 96,
    alue: ['IT', 'SM', 'VA', 'MT', 'ME', 'AL', 'GR', 'TN'],
    hila: { tyyppi: 'saannollinen', la0: 33.7, lo0: 3.0, dy: 0.02, dx: 0.025, nx: 761, ny: 761 },
    lahde: 'ItaliaMeteo · ICON-2I 2,2 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'arome_at', s3: 'geosphere_arome_austria', id: 'at', kentat: 'sd', ajoVali: 3, reunaKm: 50, alue: ['AT'],
    natiivi: 0.025, sarjaTunnit: 108,
    hila: { tyyppi: 'saannollinen', la0: 42.981, lo0: 5.498, dy: 0.018, dx: 0.028, nx: 594, ny: 492 },
    lahde: 'GeoSphere Austria · AROME 2,5 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
  PAIKKA({
    perhe: 'aladin_ce', s3: 'chmi_aladin_central_europe_2km', id: 'ce', kentat: 'sd', ajoVali: 6, reunaKm: 50, alue: null,
    natiivi: 0.02, sarjaTunnit: 120,
    hila: { tyyppi: 'projektio', proj: 'lcc', p: { lon0: 17, lat0: 46.244, lat1: 46.244, R: 6371229 }, origo: [38.599, 1.334], dx: 2325, dy: 2325, nx: 1053, ny: 837 },
    /* Läntinen osa (Ranska, Benelux) on AROMEn ja ICON-D2:n alla: rajaus
       idästä 5 E:stä, joka säästää neljänneksen laatoista. */
    rajaus: { lat: [38.5, 57.3], lng: [5.0, 34.4] },
    lahde: 'ČHMÚ · ALADIN 2,3 km · Open-Meteo / AWS Open Data · CC BY 4.0',
  }),
];

/* Koko järjestys luetteloon: FMI ensin (käyttäjän päätös, Suomi), sitten
   taulukko, lopuksi pohja. Mallin oma hila palvelimelta (`dyn`) on
   asiakkaan perhe eikä luettelon. */
export const JARJESTYS = ['fmi'].concat(ALUEELLISET.map((m) => m.perhe), ['ecmwf']);

/* -- MAARASTERI JA KÄYTTÖALUE ------------------------------------------ */

let _maat = null;
function maat() {
  if (_maat) return _maat;
  const M = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'maat.json'), 'utf8'));
  M.d = gunzipSync(Buffer.from(M.data, 'base64'));
  _maat = M;
  return M;
}

/* Kaksivaiheinen chamfer kilometreinä säännöllisellä hilalla (rivit
   etelästä, `la0` + j·askel). `lahde[k]` = 1 → etäisyys 0. */
function chamfer(lahde, ni, nj, la0, askel) {
  const d = new Float32Array(ni * nj);
  for (let k = 0; k < d.length; k++) d[k] = lahde[k] ? 0 : Infinity;
  const dy = askel * 111.2;
  const dxj = (j) => askel * 111.2 * Math.cos((la0 + j * askel) * RAD);
  for (let j = 0; j < nj; j++) {
    const dx = dxj(j), dd = Math.hypot(dx, dy);
    for (let i = 0; i < ni; i++) {
      const k = j * ni + i;
      let v = d[k];
      if (i > 0 && d[k - 1] + dx < v) v = d[k - 1] + dx;
      if (j > 0) {
        if (d[k - ni] + dy < v) v = d[k - ni] + dy;
        if (i > 0 && d[k - ni - 1] + dd < v) v = d[k - ni - 1] + dd;
        if (i < ni - 1 && d[k - ni + 1] + dd < v) v = d[k - ni + 1] + dd;
      }
      d[k] = v;
    }
  }
  for (let j = nj - 1; j >= 0; j--) {
    const dx = dxj(j), dd = Math.hypot(dx, dy);
    for (let i = ni - 1; i >= 0; i--) {
      const k = j * ni + i;
      let v = d[k];
      if (i < ni - 1 && d[k + 1] + dx < v) v = d[k + 1] + dx;
      if (j < nj - 1) {
        if (d[k + ni] + dy < v) v = d[k + ni] + dy;
        if (i < ni - 1 && d[k + ni + 1] + dd < v) v = d[k + ni + 1] + dd;
        if (i > 0 && d[k + ni - 1] + dd < v) v = d[k + ni - 1] + dd;
      }
      d[k] = v;
    }
  }
  return d;
}

/* Käyttöalueen paino 0,05°:n hilalle (`g`: la0, lo0, ni, nj). Alueen
   sisällä 1, ulkopuolella smoothstep KAYTTO_KM:n matkalla. Maarasterin
   ulkopuolella (ei pitäisi tapahtua Euroopassa) 0. */
export function kayttoPaino(g, alue, avomeri) {
  const n = g.ni * g.nj, w = new Float32Array(n);
  if (!alue) { w.fill(1); return w; }
  const M = maat(), koodit = new Set(alue);
  const sisalla = new Uint8Array(n);
  const avo = avomeri && avomeri.lat ? avomeri : null;
  const A = g.askel || ASKEL;
  for (let j = 0; j < g.nj; j++) {
    const lat = g.la0 + j * A;
    const mj = Math.round((lat - M.la0) / M.askel);
    for (let i = 0; i < g.ni; i++) {
      const lng = g.lo0 + i * A;
      const mi = Math.round((lng - M.lo0) / M.askel);
      if (mj < 0 || mj >= M.nj || mi < 0 || mi >= M.ni) continue;
      const v = M.d[mj * M.ni + mi] & 0x7f;
      const ok = v ? koodit.has(M.koodit[v - 1])
        : !!avo && lat >= avo.lat[0] && lat <= avo.lat[1] && lng >= avo.lng[0] && lng <= avo.lng[1];
      if (ok) sisalla[j * g.ni + i] = 1;
    }
  }
  const d = chamfer(sisalla, g.ni, g.nj, g.la0, A);
  for (let k = 0; k < n; k++) w[k] = sisalla[k] ? 1 : smoothstep(1 - d[k] / KAYTTO_KM);
  return w;
}

/* -- GEOMETRIA: LÄHDEPISTE -> 0,05°:N SOLMU ----------------------------- */

/* Hilan maantieteellinen ulottuma reunoista (projektiohilan ääriarvot
   ovat reunalla). */
function ulottuma(h) {
  const paikka = hilanPaikka(h);
  let la0 = Infinity, la1 = -Infinity, lo0 = Infinity, lo1 = -Infinity;
  const kirjaa = (i, j) => {
    const [lat, lng] = paikka(i, j);
    if (lat < la0) la0 = lat; if (lat > la1) la1 = lat;
    if (lng < lo0) lo0 = lng; if (lng > lo1) lo1 = lng;
  };
  for (let i = 0; i < h.nx; i++) { kirjaa(i, 0); kirjaa(i, h.ny - 1); }
  for (let j = 0; j < h.ny; j++) { kirjaa(0, j); kirjaa(h.nx - 1, j); }
  return { lat: [la0, la1], lng: [lo0, lo1] };
}

/* Pyramidin suorakaide: hilan ulottuma, leikattuna taulukon rajauksella
   tai käyttöalueen suorakaiteella. Alueen ympärille jätetään reunan ja
   häivytyksen matka (`reunaKm` + KAYTTO_KM): rajauksen reuna on datan
   reuna (`reunaPaino`), eikä se saa pienentää painoa alueen sisällä. */
export function rajausOf(m) {
  const u = ulottuma(m.hila);
  let r = m.rajaus || null;
  if (!r && m.alue) {
    const M = maat(), koodit = new Set(m.alue);
    let la0 = Infinity, la1 = -Infinity, lo0 = Infinity, lo1 = -Infinity;
    for (let j = 0; j < M.nj; j++) for (let i = 0; i < M.ni; i++) {
      const v = M.d[j * M.ni + i] & 0x7f;
      if (!v || !koodit.has(M.koodit[v - 1])) continue;
      const lat = M.la0 + j * M.askel, lng = M.lo0 + i * M.askel;
      if (lat < la0) la0 = lat; if (lat > la1) la1 = lat;
      if (lng < lo0) lo0 = lng; if (lng > lo1) lo1 = lng;
    }
    const km = m.reunaKm + KAYTTO_KM;
    const dLat = km / 111.2, dLng = km / (111.2 * Math.cos(Math.max(Math.abs(la0), Math.abs(la1)) * RAD));
    r = { lat: [la0 - dLat, la1 + dLat], lng: [lo0 - dLng, lo1 + dLng] };
  }
  if (!r) return u;
  return { lat: [Math.max(u.lat[0], r.lat[0]), Math.min(u.lat[1], r.lat[1])],
           lng: [Math.max(u.lng[0], r.lng[0]), Math.min(u.lng[1], r.lng[1])] };
}

/* Säännöllinen 0,05°:n hila mallin rajaukselle, globaalisti
   kohdistettuna (sama solmu samassa paikassa jokaisessa hilassa), ja
   jokaisen lähdepisteen solmu kerran laskettuna.

   LUETAAN VAIN IKKUNA. Rajaus on usein pieni osa lähdehilasta: DINI:n
   Lambert-alue ulottuu Grönlannista Kaspianmerelle, ja käyttöalueen
   rajauksesta osui ensimmäisessä versiossa 22 % sen pisteistä
   (ICON-D2 31 %, AROME Itävalta 28 %). `ikkuna` on rajaukseen osuvien
   lähdepisteiden indeksilaatikko, ja `solmu` on ikkunan sisäinen
   (rivi j − j0, sarake i − i0); `lue` hakee vain sen. */
export function geometria(m) {
  const rj = rajausOf(m);
  const la0 = Math.floor(rj.lat[0] / ASKEL) * ASKEL, la1 = Math.ceil(rj.lat[1] / ASKEL) * ASKEL;
  const lo0 = Math.floor(rj.lng[0] / ASKEL) * ASKEL, lo1 = Math.ceil(rj.lng[1] / ASKEL) * ASKEL;
  const ni = Math.round((lo1 - lo0) / ASKEL) + 1, nj = Math.round((la1 - la0) / ASKEL) + 1;
  const { nx, ny } = m.hila;
  const paikka = hilanPaikka(m.hila);
  const kaikki = new Int32Array(nx * ny).fill(-1);
  let j0 = ny, j1 = -1, i0 = nx, i1 = -1;
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nx; i++) {
      const [lat, lng] = paikka(i, j);
      const sj = Math.round((lat - la0) / ASKEL), si = Math.round((lng - lo0) / ASKEL);
      if (sj < 0 || sj >= nj || si < 0 || si >= ni) continue;
      kaikki[j * nx + i] = sj * ni + si;
      if (j < j0) j0 = j; if (j > j1) j1 = j;
      if (i < i0) i0 = i; if (i > i1) i1 = i;
    }
  }
  if (j1 < 0) throw new Error(m.s3 + ': rajaukseen ei osu yhtään lähdepistettä');
  const wy = j1 - j0 + 1, wx = i1 - i0 + 1;
  const solmu = new Int32Array(wy * wx);
  const maara = new Uint16Array(ni * nj);
  for (let j = 0; j < wy; j++) {
    for (let i = 0; i < wx; i++) {
      const s = kaikki[(j + j0) * nx + i + i0];
      solmu[j * wx + i] = s;
      if (s >= 0) maara[s]++;
    }
  }
  return { la0: +la0.toFixed(4), lo0: +lo0.toFixed(4), ni, nj, askel: ASKEL,
           lat: [+la0.toFixed(4), +la1.toFixed(4)], lng: [+lo0.toFixed(4), +lo1.toFixed(4)],
           ikkuna: { j0, j1: j1 + 1, i0, i1: i1 + 1 }, solmu, maara };
}

/* Datan reunan paino: solmu on kelvollinen jos vähintään puolet siihen
   osuvista lähdepisteistä on lukuja (ensimmäisen hetken kentästä).
   Etäisyys lähimpään KELVOTTOMAAN solmuun (myös hilan ulkopuoli ja
   rajauksen reuna) smoothstepinä mallin omalla matkalla. */
export function reunaPaino(m, g, nop) {
  const n = g.ni * g.nj, kelpo = new Uint16Array(n);
  const { solmu } = g;
  for (let p = 0; p < solmu.length; p++) if (solmu[p] >= 0 && Number.isFinite(nop[p])) kelpo[solmu[p]]++;
  const huono = new Uint8Array(n);
  for (let s = 0; s < n; s++) huono[s] = !g.maara[s] || kelpo[s] * 2 < g.maara[s] ? 1 : 0;
  for (let i = 0; i < g.ni; i++) { huono[i] = 1; huono[(g.nj - 1) * g.ni + i] = 1; }
  for (let j = 0; j < g.nj; j++) { huono[j * g.ni] = 1; huono[j * g.ni + g.ni - 1] = 1; }
  const d = chamfer(huono, g.ni, g.nj, g.la0, ASKEL);
  const w = new Float32Array(n);
  for (let s = 0; s < n; s++) w[s] = huono[s] ? 0 : smoothstep(d[s] / m.reunaKm);
  return w;
}

/* Painoraste -> pyramidin `paino(lat, lng)` (lähin 0,05°:n solmu). */
export function painoFunktio(g, w) {
  const A = g.askel || ASKEL;
  return (lat, lng) => {
    const j = Math.round((lat - g.la0) / A), i = Math.round((lng - g.lo0) / A);
    if (j < 0 || j >= g.nj || i < 0 || i >= g.ni) return 0;
    return w[j * g.ni + i];
  };
}

/* -- AIKA-AKSELI AJOISTA -------------------------------------------------
 *
 * Tulevaisuus ja menneisyys samalla säännöllä: jokaiselle tunnille
 * TUOREIN ajo joka kattaa sen, mieluiten vähintään tunnin ennuste
 * (analyysihetkellä puuskaa ei ole — se on edeltävän tunnin maksimi).
 * Ajojen pituus vaihtelee (UKV: 00/03/…Z +54 h, muut tunnit +12 h;
 * mitattu), joten akselin loppu on KAUIMMAS YLTÄVÄN ajon loppu eikä
 * tuoreimman — sama sääntö kuin varaston ECMWF-akselilla ja
 * `api/malli.js`:n `mallinLoppu`ssa. */
const ajoPolku = (ms) => {
  const d = new Date(ms);
  return `${d.toISOString().slice(0, 10).replace(/-/g, '/')}/${String(d.getUTCHours()).padStart(2, '0')}00Z`;
};
const tiedosto = (ms) => new Date(ms).toISOString().slice(0, 16).replace(':', '');

/* VERKKOVIRHE UUSITAAN, HTTP-VASTAUS EI. Säädata-ajossa 5.10. ALADIN CZ:n
   ensimmäinen haku (`latest.json`) kaatui 8 ms MET Nordicin lukujen
   jälkeen pelkkään "fetch failed" -viestiin, ja koko perhe jäi varastosta
   pois; muut kymmenen onnistuivat samassa ajossa. Välitön kaatuminen on
   yhteysvirhe (luultavimmin palvelimen jo sulkema keep-alive-yhteys), ei
   puuttuva tiedosto. 404 tarkoittaa että ajoa ei ole, joten sitä ei
   uusita. Syy (`e.cause.code`) kirjoitetaan viestiin — pelkkä "fetch
   failed" ei kerro mitään. */
async function haeJson(url) {
  for (let yritys = 0; ; yritys++) {
    try {
      const r = await fetch(url, { signal: AbortSignal.timeout(20000) });
      if (!r.ok) throw Object.assign(new Error(`HTTP ${r.status} ${url}`), { vastaus: true });
      return await r.json();
    } catch (e) {
      if (e.vastaus || yritys >= 2) {
        const syy = e.cause && (e.cause.code || e.cause.message);
        throw syy && !e.vastaus ? new Error(`${e.message} (${syy}) ${url}`) : e;
      }
      await new Promise((ok) => setTimeout(ok, 1000 + 2000 * yritys));
    }
  }
}

export async function akseli(m, menneisyysH) {
  const tuorein = await haeJson(`${S3}/data_spatial/${m.s3}/latest.json`);
  const uusin = Date.parse(tuorein.reference_time);
  const askel = m.ajoVali * H;
  /* Ajot uusimmasta taaksepäin menneisyyden alun yli (yksi ajoväli
     lisää, koska menneisyyden ensimmäinen tunti tulee sitä edeltävästä
     ajosta). Puuttuva ajo (404) ohitetaan. */
  const alku = Math.floor((Date.now() - menneisyysH * H) / H) * H;
  const ajot = [];
  const ehdokkaat = [];
  for (let a = uusin; a >= alku - askel - 12 * H; a -= askel) ehdokkaat.push(a);
  await Promise.all(ehdokkaat.map(async (a) => {
    try {
      const meta = a === uusin ? tuorein : await haeJson(`${S3}/data_spatial/${m.s3}/${ajoPolku(a)}/meta.json`);
      const ajat = (meta.valid_times || []).map((t) => Date.parse(t)).filter(Number.isFinite);
      if (ajat.length && meta.completed !== false) ajot.push({ ajo: a, ajat: new Set(ajat), loppu: ajat[ajat.length - 1] });
    } catch (e) { /* ajoa ei ole */ }
  }));
  if (!ajot.length) throw new Error(m.s3 + ': yhtään ajoa ei löytynyt');
  ajot.sort((x, y) => y.ajo - x.ajo);
  const loppu = Math.max(...ajot.map((a) => a.loppu));
  const hetket = [];
  for (let t = alku; t <= loppu; t += H) {
    /* Tuorein ajo jolla on vähintään tunnin ennuste tälle hetkelle,
       muuten tuorein joka kattaa sen ylipäätään. */
    const kattavat = ajot.filter((a) => a.ajat.has(t));
    if (!kattavat.length) continue;
    const parhaat = kattavat.filter((a) => t - a.ajo >= H);
    const jarj = parhaat.concat(kattavat.filter((a) => t - a.ajo < H));
    hetket.push({ ms: t, ehdokkaat: jarj.slice(0, 3).map((a) => `${S3}/data_spatial/${m.s3}/${ajoPolku(a.ajo)}/${tiedosto(t)}.om`) });
  }
  return { ajo: ajot[0].ajo, hetket };
}

/* -- LUKU ---------------------------------------------------------------
 *
 * MUUTTUJIEN OTSAKKEET YHDELLÄ PYYNNÖLLÄ (sama ansa kuin `api/malli.js`:n
 * `Esiluku`): lukija hakee jokaisen lapsen otsakkeen omalla pyynnöllään,
 * ja UKV:n tiedostossa lapsia on 391 — mitattuna 41 s pelkkiin
 * otsakkeisiin. Otsakkeet ovat tiedoston lopussa yhtenä alueena, joten se
 * haetaan kerralla.
 *
 * KENTTÄ RIVIPALOISSA: lukijan WASM-keko ei kasva, ja kokonainen
 * 4–5 M pisteen kenttä useassa rinnakkaisessa lukijassa kaatui MET
 * Nordicilla `Aborted(OOM)`:iin (`tools/metnordic.mjs`). */
class Esiluku {
  constructor(url) { this.b = new OmHttpBackend({ url, timeoutMs: 20000, retries: 2 }); this.alue = null; }
  count(signal) { return this.b.count(signal); }
  close() { return this.b.close(); }
  async getBytes(o, n, signal) {
    const a = this.alue;
    if (a && o >= a.o && o + n <= a.o + a.d.length) return a.d.slice(o - a.o, o - a.o + n);
    return this.b.getBytes(o, n, signal);
  }
  async esilataa(o, n) { this.alue = { o, d: await this.b.getBytes(o, n) }; }
}

/* Rivipala on noin 600 000 pistettä (2,4 MB): MET Nordicin 320 × 1 796
   kesti neljä rinnakkaista lukijaa, ja AROMEn 2 801:n levyisellä
   ikkunalla sama määrä on 214 riviä. */
const PALA_PISTEITA = 6e5;
async function lue(m, g, url) {
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
    const halutut = m.kentat === 'uv'
      ? ['wind_u_component_10m', 'wind_v_component_10m', 'wind_gusts_10m']
      : ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
    const lapset = {};
    for (let i = 0; i < n; i++) {
      const c = await reader.getChild(i);
      if (!c) continue;
      const nimi = c.getName();
      if (!halutut.includes(nimi) || (lapset[nimi] && !m.viimeinen)) { c.dispose(); continue; }
      if (lapset[nimi]) lapset[nimi].dispose();
      lapset[nimi] = c;
    }
    B.alue = null;
    const { nx, ny } = m.hila;
    const ik = g.ikkuna, wx = ik.i1 - ik.i0;
    const pala = Math.max(16, Math.floor(PALA_PISTEITA / wx));
    const kentat = {};
    for (const nimi of halutut) {
      const c = lapset[nimi];
      if (!c) continue;
      const dims = Array.from(c.getDimensions());
      if (dims[0] !== ny || dims[1] !== nx) throw new Error(`${m.s3}: hila vaihtui ${dims.join('x')}`);
      const ulos = new Float32Array((ik.j1 - ik.j0) * wx);
      for (let j = ik.j0; j < ik.j1; j += pala) {
        const je = Math.min(ik.j1, j + pala);
        ulos.set(await c.read({ type: OmDataType.FloatArray,
          ranges: [{ start: j, end: je }, { start: ik.i0, end: ik.i1 }] }), (j - ik.j0) * wx);
      }
      kentat[nimi] = ulos;
    }
    for (const c of Object.values(lapset)) c.dispose();
    if (m.kentat === 'uv' ? !(kentat.wind_u_component_10m && kentat.wind_v_component_10m)
                          : !(kentat.wind_speed_10m && kentat.wind_direction_10m)) throw new Error('tuuli puuttuu');
    return kentat;
  } finally {
    reader.dispose();
  }
}

export async function lueHetki(m, g, hetki) {
  let virhe = null;
  for (const url of hetki.ehdokkaat) {
    for (let yritys = 0; yritys < 2; yritys++) {
      try { return await lue(m, g, url); }
      catch (e) {
        virhe = e;
        if (/40[34]|not found|forbidden/i.test(String(e && e.message))) break;
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
  }
  throw virhe || new Error('ei ehdokkaita');
}

/* Nopeus lähdehilalla (reunan painoa varten). */
export function nopeus(m, k) {
  if (m.kentat === 'sd') return k.wind_speed_10m;
  const u = k.wind_u_component_10m, v = k.wind_v_component_10m, s = new Float32Array(u.length);
  for (let p = 0; p < u.length; p++) s[p] = Math.hypot(u[p], v[p]);
  return s;
}

/* Hetken kenttä 0,05°:n hilana `pyramidi.kirjoitaHetki`n muodossa.
   Suunta MISTÄ tuulee: u/v-malleilla atan2(−u, −v), jolloin sin = −u/s ja
   cos = −v/s (sama kuin `uvHilaksi`). */
export function hilaksi(m, g, k) {
  const n = g.ni * g.nj;
  const sN = new Float32Array(n), sS = new Float32Array(n), sC = new Float32Array(n);
  const sG = new Float32Array(n), wG = new Uint16Array(n), w = new Uint16Array(n);
  const { solmu } = g;
  const G = k.wind_gusts_10m || null;
  const uv = m.kentat === 'uv';
  const A = uv ? k.wind_u_component_10m : k.wind_speed_10m;
  const B = uv ? k.wind_v_component_10m : k.wind_direction_10m;
  for (let p = 0; p < solmu.length; p++) {
    const s = solmu[p];
    if (s < 0) continue;
    const a = A[p], b = B[p];
    if (!Number.isFinite(a) || !Number.isFinite(b)) continue;
    let v, si, co;
    if (uv) {
      v = Math.hypot(a, b);
      if (v > 1e-6) { si = -a / v; co = -b / v; } else { si = 0; co = 0; }
    } else {
      v = a; const r = b * RAD; si = Math.sin(r); co = Math.cos(r);
    }
    sN[s] += v; sS[s] += si; sC[s] += co; w[s]++;
    if (G) { const gg = G[p]; if (Number.isFinite(gg)) { sG[s] += gg; wG[s]++; } }
  }
  for (let s = 0; s < n; s++) {
    if (!w[s]) { sN[s] = NaN; sG[s] = NaN; continue; }
    sN[s] /= w[s]; sS[s] /= w[s]; sC[s] /= w[s];
    sG[s] = wG[s] ? sG[s] / wG[s] : NaN;
  }
  return { la0: g.la0, lo0: g.lo0, askel: ASKEL, ni: g.ni, nj: g.nj, nop: sN, su: sS, sv: sC, puu: G ? sG : null };
}
