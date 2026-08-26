/* ------------------------------------------------------------------
   Säälaattojen rakentaja.

   Lukee Open-Meteon avoimen datan suoraan AWS Open Datasta
   (s3://openmeteo, CC BY 4.0, ei tunnistautumista, ei kiintiötä) ja
   kirjoittaa siitä laatat joita sovellus lataa suoraan.

   MIKSI TÄMÄ ON OLEMASSA. Open-Meteon ILMAINEN API laskuttaa paikoittain:
   jokainen koordinaatti erässä on oma kutsunsa. Mitattuna yksi todellinen
   istunto (käynnistys, zoomit, panorointi, maailmanäkymä, spottikortti)
   kuluttaa 1 305 paikkaa eli noin 1 678 painotettua kutsua — 10 000/vrk
   riittää kuuteen istuntoon. Sama data S3:sta on ilmaista ja rajatonta.

   MIKSI ecmwf_ifs025. Se on ainoa malli jonka hetkittäisessä tiedostossa
   on kaikki kolme tarvittavaa suuretta yhdessä: wind_u_component_10m,
   wind_v_component_10m ja wind_gusts_10m. GFS:llä on puuskat mutta ei
   10 m tuulta, joten se vaatisi kaksi mallia — ja kaksi mallia tarkoittaa
   kahta eri fysiikkaa samassa kuvassa. Hila on 721x1440 eli tasan 0,25°,
   WGS84, aika-askel 3 h ja ennuste 15 vrk.

   MITTAUKSIA (26.8.2026):
   - koko maailman kenttä yhdeltä hetkeltä, 3 muuttujaa: 1,85 MB / 16 s
   - 64x64 pisteen ikkuna 4,2 M pisteen tiedostosta: 2,0 kB / 4 pyyntöä
     (osaväliluku toimii, koko tiedostoa ei tarvitse ladata)
   ------------------------------------------------------------------ */

import { OmFileReader, OmHttpBackend, OmDataType } from '@openmeteo/file-reader';
import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const S3 = 'https://openmeteo.s3.amazonaws.com';
const MALLI = 'ecmwf_ifs025';

/* Lähdehilan geometria. Vahvistettu meta.jsonin crs_wkt-kentästä
   (BBOX[-90,-180,90,179.75]) ja tarkistettu lukemalla lämpötilakenttä:
   y=0 on etelänapa (-58 °C elokuussa), y=720 pohjoisnapa, ja x=785
   osuu Saharaan. Rivi 0 on siis ETELÄSSÄ, ei pohjoisessa. */
const SRC = { lat0: -90, lng0: -180, step: 0.25, ny: 721, nx: 1440 };

/* ------------------------------------------------------------------
   Tasot. Jokainen laatta on 21x21 pistettä ja kattaa 20 x askel astetta,
   joten laatan viimeinen rivi on naapurin ensimmäinen — reunalla ei ole
   saumaa jota interpolointi joutuisi arvaamaan.

   Tiheät tasot vain sinne missä spotit ovat. Koko maailman 0,25° olisi
   2 592 laattaa eli 290 MB; sitä ei tarvitse kukaan. Sovelluksen oma
   hilaväli on 0,25° vain zoomista 10 ylöspäin.                        */
const N = 21;                       /* pistettä laatan sivulla */
const TASOT = [
  { id: 'l0', askel: 0.25, lat: [54, 71],  lng: [14, 33]   },  /* Itämeri + Suomi   */
  { id: 'l1', askel: 0.5,  lat: [48, 75],  lng: [-2, 42]   },  /* Pohjois-Eurooppa  */
  { id: 'l2', askel: 1.0,  lat: [28, 80],  lng: [-45, 65]  },  /* Eurooppa + Atlantti */
  { id: 'l3', askel: 2.5,  lat: [-90, 90], lng: [-180, 180]},  /* koko maailma      */
  { id: 'l4', askel: 5.0,  lat: [-90, 90], lng: [-180, 180]},  /* maailma, uloin    */
];
/* MIKSI l4 on olemassa vaikka l3 kattaa saman alueen. Sovelluksen hilaväli
   on zoomissa 3 ja sitä ulompana 5°, ja l3:n 2,5° tarkoittaisi 32 laattaa
   eli 2,65 MB pelkän maailmanäkymän avaamiseen — mitattuna. Viiden asteen
   tasolla sama näkymä on 8 laattaa ja noin 0,7 MB. Data on samaa; ero on
   vain siinä ettei ladata neljä kertaa enempää kuin näytetään. */

/* Kvantisointi. Tuuli 0,2 m/s askelin 0..50,8 m/s ja suunta 2° askelin:
   molemmat selvästi hienompia kuin ennusteen oma tarkkuus, ja mahtuvat
   tavuun. 255 = puuttuva arvo. */
const TYHJA = 255;
const NOP_ASKEL = 0.2;
const SUUNTA_ASKEL = 2;
function pakkaaNopeus(v) {
  if (!Number.isFinite(v)) return TYHJA;
  const q = Math.round(v / NOP_ASKEL);
  return q < 0 ? 0 : (q > 254 ? 254 : q);
}
function pakkaaSuunta(d) {
  if (!Number.isFinite(d)) return TYHJA;
  const q = Math.round(((d % 360) + 360) % 360 / SUUNTA_ASKEL);
  return q >= 180 ? 0 : q;
}

/* ------------------------------------------------------------------ */

function laatanRuudukko(taso) {
  const span = (N - 1) * taso.askel;
  const ruudut = [];
  for (let lat = Math.floor(taso.lat[0] / span) * span; lat < taso.lat[1]; lat += span) {
    for (let lng = Math.floor(taso.lng[0] / span) * span; lng < taso.lng[1]; lng += span) {
      ruudut.push({ lat0: +lat.toFixed(4), lng0: +lng.toFixed(4) });
    }
  }
  return ruudut;
}

/* Lähdehilan indeksi. Kaikki tasojen askeleet ovat 0,25°:n monikertoja,
   joten osuma on tarkka eikä interpolointia tarvita. */
function srcIdx(lat, lng) {
  const y = Math.round((lat - SRC.lat0) / SRC.step);
  let lg = ((lng + 180) % 360 + 360) % 360 - 180;
  const x = Math.round((lg - SRC.lng0) / SRC.step);
  return { y, x: ((x % SRC.nx) + SRC.nx) % SRC.nx };
}

async function haeJson(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} ${url}`);
  return r.json();
}

/* Ajot uusimmasta vanhimpaan. Ajot ovat 00/06/12/18 UTC ja ilmestyvät
   muutaman tunnin viiveellä, joten tuorein olemassa oleva ei ole sama kuin
   viimeisin kellonaika — siksi kelataan taaksepäin kunnes meta.json löytyy. */
async function haeAjot(maxTaakse) {
  const nyt = new Date();
  const ajot = [];
  for (let i = 0; i < maxTaakse; i++) {
    const t = new Date(nyt.getTime() - i * 6 * 3600e3);
    const h = Math.floor(t.getUTCHours() / 6) * 6;
    const pv = `${t.getUTCFullYear()}/${String(t.getUTCMonth()+1).padStart(2,'0')}/${String(t.getUTCDate()).padStart(2,'0')}`;
    const ajo = `${String(h).padStart(2,'0')}00Z`;
    try {
      const meta = await haeJson(`${S3}/data_spatial/${MALLI}/${pv}/${ajo}/meta.json`);
      if (meta && Array.isArray(meta.valid_times) && meta.valid_times.length > 8) {
        ajot.push({ pv, ajo, meta });
      }
    } catch (e) { /* ei olemassa — jatka taaksepäin */ }
  }
  if (!ajot.length) throw new Error('yhtään valmista ajoa ei löytynyt');
  return ajot;
}

/* Aika-akseli useasta ajosta.
 *
 * MIKSI. data_spatial sisältää vain ENNUSTEEN ajohetkestä eteenpäin, mutta
 * sovelluksen aikajana ulottuu kaksi vuorokautta taaksepäin. Menneisyys
 * saadaan vanhempien ajojen alkupäästä: 12 tuntia sitten tehdyn ajon
 * ensimmäiset askeleet ovat nyt menneisyyttä. Jokaiselle hetkelle
 * valitaan TUOREIN ajo joka sen kattaa, joten menneisyys on parasta
 * saatavilla olevaa analyysiä eikä vanhaa ennustetta. */
function rakennaAikaAkseli(ajot, menneisyysH, dtSek) {
  const dtMs = dtSek * 1000;
  const uusin = ajot[0];
  const loppu = Date.parse(uusin.meta.valid_times[uusin.meta.valid_times.length - 1]);
  const alku = Math.floor((Date.now() - menneisyysH * 3600e3) / dtMs) * dtMs;
  /* Ajo -> Set kattamista hetkistä, jotta valinta on O(1). */
  const katteet = ajot.map(a => ({ a, ajat: new Set(a.meta.valid_times.map(Date.parse)) }));
  const akseli = [];
  for (let t = alku; t <= loppu; t += dtMs) {
    const osuma = katteet.find(k => k.ajat.has(t));
    if (osuma) akseli.push({ ms: t, ajo: osuma.a });
  }
  return akseli;
}

/* Yhden hetken kolme kenttää. Luetaan koko maailma kerralla: mitattuna
   se on 1,85 MB, kun taas 81 laatan lukeminen erikseen olisi satoja
   pikkupyyntöjä per hetki. */
async function lueHetki(url) {
  const reader = await OmFileReader.create(new OmHttpBackend({ url }));
  const n = reader.numberOfChildren();
  const kentat = {};
  const halutut = new Set(['wind_u_component_10m', 'wind_v_component_10m', 'wind_gusts_10m']);
  for (let i = 0; i < n; i++) {
    const c = await reader.getChild(i);
    if (!c) continue;
    const nimi = c.getName();
    if (!halutut.has(nimi)) continue;
    const dims = Array.from(c.getDimensions());
    kentat[nimi] = await c.read({ type: OmDataType.FloatArray,
      ranges: [{ start: 0, end: dims[0] }, { start: 0, end: dims[1] }] });
  }
  /* Tuuli on pakollinen, puuska ei. Analyysihetkellä (T+0) puuskaa ei ole
     olemassa: se on jakson yli laskettu maksimi, eikä nollan mittaiselle
     jaksolle ole maksimia. Ilman tätä eroa koko ensimmäinen hetki putosi
     pois — eli juuri se hetki jonka kartta oletuksena näyttää. */
  for (const h of ['wind_u_component_10m', 'wind_v_component_10m']) {
    if (!kentat[h]) throw new Error('kenttä puuttuu: ' + h);
  }
  return kentat;
}

async function rinnakkain(lista, raja, tyo) {
  let seur = 0;
  const tekijat = Array.from({ length: Math.min(raja, lista.length) }, async () => {
    for (;;) {
      const i = seur++;
      if (i >= lista.length) return;
      await tyo(lista[i], i);
    }
  });
  await Promise.all(tekijat);
}

/* ------------------------------------------------------------------ */

const ULOS = process.argv[2] || 'saadata';
const RINNAKKAIN = +(process.env.RINNAKKAIN || 6);
const MAX_ASKELTA = +(process.env.MAX_ASKELTA || 0);

const MENNEISYYS_H = +(process.env.MENNEISYYS_H || 48);

const ajot = await haeAjot(2 + Math.ceil(MENNEISYYS_H / 6));
const dtSek = ajot[0].meta.temporal_resolution_seconds || 10800;
let akseli = rakennaAikaAkseli(ajot, MENNEISYYS_H, dtSek);
if (MAX_ASKELTA > 0) akseli = akseli.slice(0, MAX_ASKELTA);
const ajat = akseli.map(a => new Date(a.ms).toISOString());
console.log(`${ajot.length} ajoa löytyi, uusin ${ajot[0].pv} ${ajot[0].ajo}`);
console.log(`aika-akseli ${akseli.length} askelta, askel ${dtSek/3600} h`);
console.log(`  ${ajat[0]} .. ${ajat[ajat.length-1]}`);
{
  const kaytetyt = new Map();
  akseli.forEach(a => kaytetyt.set(a.ajo.ajo, (kaytetyt.get(a.ajo.ajo) || 0) + 1));
  console.log('  ajoittain: ' + [...kaytetyt].map(([k, v]) => `${k} ${v}`).join(', '));
}

/* Varataan puskurit: taso -> laatta -> {nop, suunta, puuska} */
const tasot = TASOT.map(t => {
  const ruudut = laatanRuudukko(t);
  return {
    ...t,
    ruudut: ruudut.map(r => ({
      ...r,
      nop:    new Uint8Array(ajat.length * N * N).fill(TYHJA),
      suunta: new Uint8Array(ajat.length * N * N).fill(TYHJA),
      puuska: new Uint8Array(ajat.length * N * N).fill(TYHJA),
    })),
  };
});
const laattojaYht = tasot.reduce((s, t) => s + t.ruudut.length, 0);
console.log(`  ${laattojaYht} laattaa, ${(laattojaYht * ajat.length * N * N * 3 / 1e6).toFixed(1)} MB pakkaamattomana`);

let valmiit = 0, puuttuvat = 0;
const alkoi = Date.now();

await rinnakkain(akseli, RINNAKKAIN, async (kohta, ti) => {
  /* Tiedostonimi on 2026-08-26T1200.om eli ISO ilman sekunteja ja
     kaksoispisteitä. Date.toISOString antaa sekunnit, joten ne leikataan. */
  const d = new Date(kohta.ms);
  const tiedosto = d.toISOString().slice(0, 16).replace(':', '');
  const url = `${S3}/data_spatial/${MALLI}/${kohta.ajo.pv}/${kohta.ajo.ajo}/${tiedosto}.om`;
  let kentat;
  try {
    kentat = await lueHetki(url);
  } catch (e) {
    puuttuvat++;
    console.warn(`  ! ${d.toISOString()}: ${e.message}`);
    return;
  }
  const u = kentat.wind_u_component_10m;
  const v = kentat.wind_v_component_10m;
  const g = kentat.wind_gusts_10m;

  for (const taso of tasot) {
    for (const ruutu of taso.ruudut) {
      const pohja = ti * N * N;
      for (let iy = 0; iy < N; iy++) {
        const lat = ruutu.lat0 + iy * taso.askel;
        if (lat < -90 || lat > 90) continue;
        for (let ix = 0; ix < N; ix++) {
          const lng = ruutu.lng0 + ix * taso.askel;
          const { y, x } = srcIdx(lat, lng);
          if (y < 0 || y >= SRC.ny) continue;
          const si = y * SRC.nx + x;
          const uu = u[si], vv = v[si];
          if (!Number.isFinite(uu) || !Number.isFinite(vv)) continue;
          const nop = Math.sqrt(uu * uu + vv * vv);
          /* Meteorologinen suunta = MISTÄ tuuli tulee. */
          const suunta = (270 - Math.atan2(vv, uu) * 180 / Math.PI + 360) % 360;
          const k = pohja + iy * N + ix;
          ruutu.nop[k] = pakkaaNopeus(nop);
          ruutu.suunta[k] = pakkaaSuunta(suunta);
          if (g) ruutu.puuska[k] = pakkaaNopeus(g[si]);
        }
      }
    }
  }
  valmiit++;
  if (valmiit % 20 === 0 || valmiit === akseli.length) {
    const kulunut = (Date.now() - alkoi) / 1000;
    console.log(`  ${valmiit}/${akseli.length} hetkeä  ${kulunut.toFixed(0)} s`);
  }
});

if (valmiit === 0) throw new Error('yhtään hetkeä ei saatu luettua');

/* ------------------------------------------------------------------
   Kirjoitus. Otsake on kiinteän mittainen ja pikkuendian; sen jälkeen
   kolme tavutasoa järjestyksessä [aika][y][x]. Yksi hetki on siis
   yhtenäinen lohko — sovellus piirtää yhden hetken kerrallaan.        */
const OTSAKE = 40;
function kirjoitaLaatta(taso, ruutu, nt) {
  const runko = new Uint8Array(OTSAKE + 3 * nt * N * N);
  const dv = new DataView(runko.buffer);
  runko.set(new TextEncoder().encode('FSTILE\0'), 0);
  dv.setUint8(7, 1);                          /* versio */
  dv.setFloat32(8, taso.askel, true);
  dv.setFloat32(12, ruutu.lat0, true);
  dv.setFloat32(16, ruutu.lng0, true);
  dv.setUint16(20, N, true);
  dv.setUint16(22, N, true);
  dv.setUint16(24, nt, true);
  dv.setFloat64(26, Date.parse(ajat[0]), true);
  dv.setUint32(34, dtSek, true);
  dv.setUint8(38, TYHJA);
  dv.setUint8(39, 0);
  const koko = nt * N * N;
  runko.set(ruutu.nop.subarray(0, koko), OTSAKE);
  runko.set(ruutu.suunta.subarray(0, koko), OTSAKE + koko);
  runko.set(ruutu.puuska.subarray(0, koko), OTSAKE + 2 * koko);
  return runko;
}

rmSync(ULOS, { recursive: true, force: true });
mkdirSync(ULOS, { recursive: true });

let tavujaRaaka = 0, tavujaPakattu = 0;
const luettelo = {
  versio: 1,
  malli: MALLI,
  lahde: 'Open-Meteo / ECMWF IFS 0.25° · AWS Open Data · CC BY 4.0',
  ajoAika: ajot[0].meta.reference_time,
  luotu: new Date().toISOString(),
  t0: Date.parse(ajat[0]),
  dtSek,
  nt: ajat.length,
  /* Aika-akseli EI OLE tasavälinen, joten se luetellaan kokonaan.
     ECMWF antaa kolmen tunnin askeleen kuuden vuorokauden ajan ja sen
     jälkeen kuuden tunnin askeleen viidenteentoista vuorokauteen —
     mitattuna 48 kolmen tunnin väliä ja 36 kuuden tunnin väliä. Jos
     asiakas rakentaisi akselin kaavasta t0 + i*dt, viimeiset yhdeksän
     vuorokautta olisivat väärässä kohdassa aikajanaa ilman että mikään
     näyttäisi rikkinäiseltä. Lista on 98 lukua eli pari kilotavua.
     Interpolointi osaa epätasaisen välin itsestään: se hakee hetkeä
     ympäröivän parin, ei kiinteää askelta. */
  ajat: ajat.map(a => Date.parse(a)),
  n: N,
  nopAskel: NOP_ASKEL,
  suuntaAskel: SUUNTA_ASKEL,
  tyhja: TYHJA,
  otsake: OTSAKE,
  puuttuvia: puuttuvat,
  tasot: [],
};

for (const taso of tasot) {
  mkdirSync(join(ULOS, taso.id), { recursive: true });
  const tiedostot = [];
  for (const ruutu of taso.ruudut) {
    const raaka = kirjoitaLaatta(taso, ruutu, ajat.length);
    const pakattu = gzipSync(raaka, { level: 9 });
    const nimi = `${ruutu.lat0}_${ruutu.lng0}.bin.gz`;
    writeFileSync(join(ULOS, taso.id, nimi), pakattu);
    tavujaRaaka += raaka.length; tavujaPakattu += pakattu.length;
    tiedostot.push([ruutu.lat0, ruutu.lng0]);
  }
  const span = (N - 1) * taso.askel;
  luettelo.tasot.push({ id: taso.id, askel: taso.askel, span,
    lat: taso.lat, lng: taso.lng, laatat: tiedostot });
  console.log(`  ${taso.id}: askel ${taso.askel}°, ${taso.ruudut.length} laattaa`);
}

writeFileSync(join(ULOS, 'luettelo.json'), JSON.stringify(luettelo));
console.log(`\nvalmis: ${laattojaYht} laattaa`);
console.log(`  raaka   ${(tavujaRaaka/1e6).toFixed(2)} MB`);
console.log(`  gzip    ${(tavujaPakattu/1e6).toFixed(2)} MB  (${(100*tavujaPakattu/tavujaRaaka).toFixed(0)} %)`);
console.log(`  hetkiä  ${valmiit}/${ajat.length}${puuttuvat ? ` (${puuttuvat} puuttui)` : ''}`);
console.log(`  aika    ${((Date.now()-alkoi)/1000).toFixed(0)} s`);
