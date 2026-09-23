/* ------------------------------------------------------------------
   MET Nordic 1 km (MET Norja) säännölliseksi hilaksi.

   Tämä on Yr:n ennusteiden pohja: MEPS-malli (sama MetCoOp-ajo josta
   FMI:n HARMONIE tulee) jälkikäsiteltynä 1 km:iin havainnoilla, ajettuna
   tunneittain. Open-Meteo peilaa sen S3:een nimellä `metno_nordic_pp`
   (CC BY 4.0, ei tunnistautumista, ei kiintiötä).

   VARASTOSSA SE ON FMI:N JATKE, EI KILPAILIJA. Suomen yllä kartta on
   FMI:n HARMONIEa aina kun sitä on; MET Nordic kattaa sen ympäriltä
   Pohjoismaat ja Baltian, ja MENNEISYYDEN, jota FMI:n latauspalvelussa
   ei ole (se säilyttää kaksi viimeisintä ajoa, mitattu 23.9.2026).
   Menneisyys on kunkin tunnin OMAN ajon ensimmäinen hetki eli
   havainnoilla korjattu analyysi, ei vanha ennuste.

   HILA ON LAMBERT, EI LAT/LON. Geometria (docs/mallit.md, "Toteutus"):
   sfääri R 6 371 229 m, standardileveys 63°, keskimeridiaani 15°,
   kulmat (52,302723° / 1,918457°) = indeksi (0, 0) ja
   (72,18527° / 41,764282°) = (NY−1, NX−1). Tarkistettu kuudessa
   pisteessä Open-Meteon rajapintaa vasten: nopeus ja suunta samat.

   UUDELLEENHILAUS ON ALUEKESKIARVO. 0,05° on Suomen leveyksillä
   2,8 × 5,6 km, eli jokaiseen solmuun osuu 10–30 lähdepistettä. Lähin
   piste olisi niistä yksi satunnainen — sama laskostuminen jonka takia
   pyramidin karkeat tasot suodatetaan (`pyramidi.mjs`). Jokainen
   Lambert-piste lasketaan lähimpään solmuun kerran, ja hetken kenttä
   on sen jälkeen pelkkä summaus.                                       */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';
import { smoothstep, SEKOITUS_KM } from './pyramidi.mjs';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const MALLI = 'metno_nordic_pp';

const R = 6371229, RAD = Math.PI / 180;
const FII1 = 63 * RAD, LAMBDA0 = 15 * RAD;
const NN = Math.sin(FII1);
const FF = Math.cos(FII1) * Math.pow(Math.tan(Math.PI / 4 + FII1 / 2), NN) / NN;
const rho = (fii) => R * FF / Math.pow(Math.tan(Math.PI / 4 + fii / 2), NN);
const RHO0 = rho(FII1);

function eteen(lat, lng) {
  const r = rho(lat * RAD), th = NN * (lng * RAD - LAMBDA0);
  return [r * Math.sin(th), RHO0 - r * Math.cos(th)];
}
function taakse(x, y) {
  const dy = RHO0 - y, r = Math.hypot(x, dy), th = Math.atan2(x, dy);
  return [(2 * Math.atan(Math.pow(R * FF / r, 1 / NN)) - Math.PI / 2) / RAD,
          (LAMBDA0 + th / NN) / RAD];
}

export const NX = 1796, NY = 2321;
const [X0, Y0] = eteen(52.302723, 1.918457);
const [X1, Y1] = eteen(72.18527, 41.764282);
/* Hilaväli johdetaan kulmista eikä kirjoiteta lukuna: 1 000,03 × 1 000,05 m
   on se mikä kulmista tulee, ja pyöreä 1 000 siirtäisi vastakkaisen
   reunan 60 m sivuun. */
const DX = (X1 - X0) / (NX - 1), DY = (Y1 - Y0) / (NY - 1);

/* Lambert-indeksi (murtoluku) paikalle. */
export function indeksi(lat, lng) {
  const [x, y] = eteen(lat, lng);
  return { fx: (x - X0) / DX, fy: (y - Y0) / DY };
}

/* Käyttöalueen paino: smoothstep etäisyydestä hilan reunaan, 50 km
   matkalla. Hilaväli on 1 km, joten indeksietäisyys ON kilometrejä. */
export function paino(lat, lng, km = SEKOITUS_KM) {
  const { fx, fy } = indeksi(lat, lng);
  const d = Math.min(fx, NX - 1 - fx, fy, NY - 1 - fy);
  return d <= 0 ? 0 : smoothstep(d / km);
}

/* Säännöllinen hila joka kattaa koko Lambert-alueen. Rajat on laskettu
   projektiosta: eteläreunan kulmat ovat 52,30°, pohjoisreunan keskikohta
   73,86° (Lambert-alueen yläreuna kaartuu), lännessä −11,76° ja idässä
   41,76°. Lat/lon-suorakaide on siis leveämpi kuin data, ja sen kulmat
   ovat tyhjiä — tyhjät laatat jätetään kirjoittamatta. */
export function saannollinenHila(askel) {
  const la0 = Math.floor(52.30 / askel) * askel, la1 = Math.ceil(73.87 / askel) * askel;
  const lo0 = Math.floor(-11.77 / askel) * askel, lo1 = Math.ceil(41.77 / askel) * askel;
  const ni = Math.round((lo1 - lo0) / askel) + 1, nj = Math.round((la1 - la0) / askel) + 1;
  /* Jokaisen Lambert-pisteen solmu, laskettu kerran. */
  const solmu = new Int32Array(NX * NY);
  const maara = new Uint16Array(ni * nj);
  for (let j = 0; j < NY; j++) {
    for (let i = 0; i < NX; i++) {
      const [lat, lng] = taakse(X0 + i * DX, Y0 + j * DY);
      const sj = Math.round((lat - la0) / askel), si = Math.round((lng - lo0) / askel);
      const s = sj * ni + si;
      solmu[j * NX + i] = s;
      maara[s]++;
    }
  }
  return { la0: +la0.toFixed(4), lo0: +lo0.toFixed(4), askel, ni, nj,
           lat: [+la0.toFixed(4), +la1.toFixed(4)], lng: [+lo0.toFixed(4), +lo1.toFixed(4)],
           solmu, maara };
}

/* Yhden hetken kenttä säännöllisenä hilana, `pyramidi.kirjoitaHetki`n
   muodossa. Suunta keskiarvoistetaan yksikkövektoreina, nopeus ja puuska
   suoraan — sama sääntö kuin pyramidissa. */
export function hilaksi(geom, nop, suunta, puuska) {
  const n = geom.ni * geom.nj;
  const sN = new Float32Array(n), sS = new Float32Array(n), sC = new Float32Array(n);
  const sG = puuska ? new Float32Array(n) : null, wG = puuska ? new Uint16Array(n) : null;
  const w = new Uint16Array(n);
  const { solmu } = geom;
  for (let p = 0; p < solmu.length; p++) {
    const v = nop[p], d = suunta[p];
    if (!Number.isFinite(v) || !Number.isFinite(d)) continue;
    const s = solmu[p], r = d * RAD;
    sN[s] += v; sS[s] += Math.sin(r); sC[s] += Math.cos(r); w[s]++;
    if (puuska) { const g = puuska[p]; if (Number.isFinite(g)) { sG[s] += g; wG[s]++; } }
  }
  for (let s = 0; s < n; s++) {
    if (!w[s]) { sN[s] = NaN; continue; }
    sN[s] /= w[s]; sS[s] /= w[s]; sC[s] /= w[s];
    if (sG) sG[s] = wG[s] ? sG[s] / wG[s] : NaN;
  }
  return { la0: geom.la0, lo0: geom.lo0, askel: geom.askel, ni: geom.ni, nj: geom.nj,
           nop: sN, su: sS, sv: sC, puu: sG };
}

/* ------------------------------------------------------------------ */

const polku = (ms) => {
  const d = new Date(ms);
  const pv = d.toISOString().slice(0, 10).replace(/-/g, '/');
  return `${pv}/${String(d.getUTCHours()).padStart(2, '0')}00Z`;
};
const tiedosto = (ms) => new Date(ms).toISOString().slice(0, 16).replace(':', '');

/* Aika-akseli ja kunkin hetken tiedosto.
 *
 * Tulevaisuus tulee tuoreimmasta VALMIISTA ajosta (`latest.json`,
 * `completed`). Menneisyys tulee kunkin tunnin omasta ajosta (T+0); jos
 * sitä ei ole, avaus kokeilee tuntia vanhempaa ajoa (T+1) — `lueHetki`
 * saa siksi listan ehdokkaita eikä yhtä osoitetta. */
export async function akseli(menneisyysH) {
  const r = await fetch(`${S3}/data_spatial/${MALLI}/latest.json`);
  if (!r.ok) throw new Error('MET Nordic latest.json: HTTP ' + r.status);
  const meta = await r.json();
  if (!meta.completed) throw new Error('MET Nordic: tuorein ajo kesken');
  const ajo = Date.parse(meta.reference_time);
  const ajat = meta.valid_times.map(t => Date.parse(t)).filter(Number.isFinite);
  const alku = Math.floor((Date.now() - menneisyysH * 3600e3) / 3600e3) * 3600e3;
  const hetket = [];
  for (let t = alku; t < ajo; t += 3600e3) {
    hetket.push({ ms: t, ehdokkaat: [t, t - 3600e3].map(a =>
      `${S3}/data_spatial/${MALLI}/${polku(a)}/${tiedosto(t)}.om`) });
  }
  for (const t of ajat) {
    if (t < ajo) continue;
    hetket.push({ ms: t, ehdokkaat: [`${S3}/data_spatial/${MALLI}/${polku(ajo)}/${tiedosto(t)}.om`] });
  }
  return { ajo, hetket };
}

/* Muuttujan indeksi tiedostossa. Järjestys on sama kaikissa tiedostoissa
   (mitattu), ja nimen hakeminen maksaa pyynnön per lapsi — siksi se
   opitaan kerran ja tarkistetaan nimestä joka kerta. */
const HALUTUT = ['wind_speed_10m', 'wind_direction_10m', 'wind_gusts_10m'];
const RIVIPALA = 320;
let lapset = null;

async function lue(url) {
  const reader = await OmFileReader.create(new OmHttpBackend({ url }));
  const kentat = {};
  /* LUKU RIVIPALOISSA. Lukijan WASM-keko on kiinteän kokoinen eikä
     kasva (`abortOnCannotGrowMemory`), ja kaikki lukijat jakavat sen.
     Yksi 4,2 M pisteen kenttä kerralla mahtui, neljä rinnakkain ei:
     mitattuna `Aborted(OOM)` kuusitoista kertaa ja rakennus jumiin.
     320 riviä on kymmenen lohkoriviä (lohko 32 × 32) eli 2,3 MB. */
  const lueLapsi = async (c) => {
    const dims = Array.from(c.getDimensions());
    if (dims[0] !== NY || dims[1] !== NX) throw new Error('hila vaihtui: ' + dims.join('x'));
    const ulos = new Float32Array(NY * NX);
    for (let j0 = 0; j0 < NY; j0 += RIVIPALA) {
      const j1 = Math.min(NY, j0 + RIVIPALA);
      const pala = await c.read({ type: OmDataType.FloatArray,
        ranges: [{ start: j0, end: j1 }, { start: 0, end: NX }] });
      ulos.set(pala, j0 * NX);
    }
    return ulos;
  };
  if (lapset) {
    for (const [nimi, i] of lapset) {
      const c = await reader.getChild(i);
      if (!c || c.getName() !== nimi) { lapset = null; break; }
      kentat[nimi] = await lueLapsi(c);
    }
  }
  if (!lapset) {
    const loydetyt = [];
    const n = reader.numberOfChildren();
    for (let i = 0; i < n; i++) {
      const c = await reader.getChild(i);
      if (!c || !HALUTUT.includes(c.getName())) continue;
      loydetyt.push([c.getName(), i]);
      kentat[c.getName()] = await lueLapsi(c);
    }
    lapset = loydetyt;
  }
  if (!kentat.wind_speed_10m || !kentat.wind_direction_10m) throw new Error('tuuli puuttuu');
  return kentat;
}

/* Hetken kentät: ensimmäinen ehdokas joka aukeaa. */
export async function lueHetki(hetki) {
  let virhe = null;
  for (const url of hetki.ehdokkaat) {
    for (let yritys = 0; yritys < 2; yritys++) {
      try { return await lue(url); }
      catch (e) {
        virhe = e;
        /* 403/404 = tiedostoa ei ole; uusinta ei auta, seuraava ehdokas. */
        if (/40[34]|not found|forbidden/i.test(String(e && e.message))) break;
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  }
  throw virhe || new Error('ei ehdokkaita');
}
