/* ------------------------------------------------------------------
   Säälaattojen rakentaja.

   Lukee Open-Meteon avoimen datan suoraan AWS Open Datasta
   (s3://openmeteo, CC BY 4.0, ei tunnistautumista, ei kiintiötä) ja
   kirjoittaa siitä laatat joita sovellus lataa suoraan.

   KOLME MALLIA, JOKAINEN OMANA PYRAMIDINAAN (docs/mallit.md):
   - ECMWF IFS 0,25° koko maapallolle (tasot l0–l4) — pohja joka on aina.
   - FMI HARMONIE 2,5 km Suomeen ja sen ympärille (h0–h3,
     `tools/harmonie.mjs`).
   - MET Nordic 1 km eli Yr:n data Pohjoismaihin ja Baltiaan, myös
     menneisyyteen (n0–n3, `tools/metnordic.mjs`).
   Alueellisilla malleilla on OMA tuntiakselinsa ja laatoissa PAINOKANAVA,
   jolla asiakas sekoittaa ne alempaan malliin pehmeästi
   (`tools/pyramidi.mjs`). Karkeat tasot ovat kaikissa suodatettuja
   eivätkä poimintoja.

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
import { haeHarmonie, harmonieAjot } from './harmonie.mjs';
import * as MetNordic from './metnordic.mjs';
import {
  N, TYHJA, NOP_ASKEL, SUUNTA_ASKEL, OTSAKE,
  luoPyramidi, uvHilaksi, kirjoitaHetki, tiivistaAika, kirjoitaLaatta, onDataa,
  suorakaidePaino,
} from './pyramidi.mjs';

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

   MIKÄ RAJOITTAA — EI TALLENNUSTILA VAAN LATAUS.
   ----------------------------------------------
   Tässä luki aiemmin että koko maailman 0,25° olisi "2 592 laattaa eli
   290 MB; sitä ei tarvitse kukaan". Luku oli väärä ja perustelu vinossa.
   Mitattuna oikeasti:

     nykyinen varasto            110 laattaa      5,6 MB
     koko maailma 0,25°        2 592 laattaa    123 MB

   123 MB mahtuu GitHubiin vaivatta — repon pehmeä raja on gigatavuja, ja
   orpo haara pakkopäivityksellä pitää koon vakiona. **Tallennustila ei
   siis ole este.** Este on LATAUS: uloin näkymä tarvitsisi 0,25 asteella
   209 laattaa eli 9,9 MB yhden ruudullisen avaamiseen. Nyt sama näkymä on
   24 laattaa ja 1,3 MB.

   Ja koska latauskoko riippuu NÄKYMÄN koosta eikä tason tarkkuudesta,
   tiheä taso on halpa käyttää lähellä (z11:ssä näkymä on 0,1 astetta eli
   yksi laatta) ja kallis kaukana. Siksi oikea kysymys ei ole "paljonko
   tilaa on" vaan "mitä tarkkuutta mikin zoom oikeasti käyttää".

   l0 KATTAA MET NORDICIN YMPÄRISTÖN, ei vain Suomea. MET Nordic
   sekoittuu reunoillaan ECMWF:ään, ja sekoitusvyöhykkeellä ECMWF:n pitää
   olla sen hienoin taso — muuten raja-alue olisi 0,5 asteen kenttää 1 km
   mallin vieressä. Alue on MET Nordicin lat/lon-rajaus (52–74°,
   −12…42°) pyöristettynä laattoihin.

   Sen sijaan ULOIN näkymä näyttää aina ison siivun maailmaa, ja siellä
   hilaväli on 1,25° eli taso l2. Siksi **l2 on nyt globaali**: se on se
   yksi taso jonka kattavuus näkyy joka kerta kun kartta vedetään ulos.
   Mitattuna se maksaa 21 laatan sijaan 162 eli noin 9 MB lisää tilaa, ja
   latauskoko pysyy ENNALLAAN — sama näkymä, sama määrä laattoja, vain
   parempi data siellä missä ennen putosi 2,5 asteeseen.

   Pakkauksesta ei ole apua: mitattuna paikkadelta ennen gzipiä säästää
   13 %, aikadelta 6 % ja molemmat yhdessä 13 %. Data on jo lähellä
   entropiaansa, koska arvot on kvantisoitu tavuun.                     */
const TASOT = [
  { id: 'l0', askel: 0.25, lat: [50, 75],  lng: [-15, 45]  },  /* Pohjoismaat + Baltia */
  { id: 'l1', askel: 0.5,  lat: [28, 80],  lng: [-45, 65]  },  /* Eurooppa + Atlantti */
  { id: 'l2', askel: 1.0,  lat: [-90, 90], lng: [-180, 180]},  /* koko maailma        */
  { id: 'l3', askel: 2.5,  lat: [-90, 90], lng: [-180, 180]},  /* koko maailma        */
  { id: 'l4', askel: 5.0,  lat: [-90, 90], lng: [-180, 180]},  /* maailma, uloin      */
];
/* ------------------------------------------------------------------
   SUOMEN YLLÄ EI OLE ECMWF:ÄÄ VAAN HARMONIEA — KAIKILLA ZOOMEILLA.

   Kaikki edellä olevat tasot ovat samaa 0,25 asteen maailmanlaajuista
   mallia suodatettuna. Hienompi ECMWF-taso ei ole olemassa: 0,25° ON
   mallin oma hila, ja sen alapuolella olisi vain interpolointia jonka
   sovellus tekee itsekin.

   Lähikatselun tarkkuus tulee siis toisesta mallista. FMI:n HARMONIE on
   2,5 km (0,0225°); sovellus on Suomen rannikon kelisovellus. Ennen se
   oli yksi taso (h0) jonka sai vasta zoomilla 10, jolloin Helsingin yllä
   oli zoomista riippuen kolmea eri kenttää (docs/mallit.md). Nyt
   HARMONIElla on oma pyramidinsa h0–h3, ja zoom valitsee vain sen
   tarkkuuden: malli on paikan ja hetken ominaisuus, ei zoomin.

   ALUE ON KOKO SUOMI JA 50 KM SEKOITUSVYÖHYKE SEN ULKOPUOLELLA:
   lat 58–71, lng 17–33. Utsjoki (70,1°) on 100 km ja itäraja (31,6°)
   70 km reunasta, joten vyöhyke osuu kokonaan Suomen ulkopuolelle.
   Painokanava on smoothstep etäisyydestä suorakaiteen reunaan
   (`suorakaidePaino`), ja reunalla sen alla jatkaa MET Nordic — sama
   MEPS-ajo jälkikäsiteltynä, joten raja on myös sisällöltään pehmeä.

   AIKA-AKSELI ON TÄLLÄ TASOLLA OMANSA, eikä se ole valinnainen ylellisyys.
   Mitattuna (10 pistettä, 400 tuntia): jos HARMONIE tallennettaisiin
   varaston omalle kolmen tunnin akselille, tuntien väliin jäävä virhe
   olisi keskimäärin 0,41 m/s ja enimmillään 3,34 m/s — ja **29,8 %
   tunneista ylittäisi sovelluksen oman 0,5 m/s rajan**. Suunnassa virhe
   nousi 172 asteeseen. Kolmen tunnin askel riittää ECMWF:lle, koska se
   ON ECMWF:n oma askel; HARMONIElle se olisi datan heittämistä pois.

   Taso on `vainKartta`: vanha asiakas ei käytä sitä aikajanaan eikä
   spottikorttiin, koska ne tarvitsevat 16,6 vuorokauden sarjan ja tämä
   kattaa noin 70 tuntia.                                              */
const FMI_ALUE = { lat: [58, 71], lng: [17, 33] };
const FMI_TASOT = [0.05, 0.1, 0.25, 0.5].map((askel, i) => ({
  id: 'h' + i, askel, lat: FMI_ALUE.lat, lng: FMI_ALUE.lng,
  paino: (lat, lng) => suorakaidePaino(lat, lng, FMI_ALUE),
}));
/* `malli` ON LÄHDEREKISTERIN AVAIN, ei vapaa nimi. Sovelluksessa
   lähteiden nimet ovat yhdessä paikassa (`Lahde.NIMET` / `LYHYET`), ja
   lähdemerkintä hakee tason nimen tällä avaimella. Oma nimikenttä tässä
   olisi toinen rekisteri, joka ajautuisi siitä erilleen. */
const FMI_MALLI = { malli: 'fmi', perhe: 'fmi',
  lahde: 'Ilmatieteen laitos · HARMONIE 2,5 km · CC BY 4.0' };
/* MIKSI 0,05° EIKÄ MALLIN OMA 0,0225°. Laatta on 21 x 21 pistettä, joten
   askel määrää myös laatan koon: 0,05° antaa yhden asteen laatan, jolloin
   Helsingin z11-näkymä on yksi laatta. 0,0225° antaisi 0,45 asteen laatan
   eli nelinkertaisen määrän laattoja samaan näkymään — ja viisinkertaisen
   varaston. 0,05° on 2,8 km Suomen leveyksillä eli käytännössä mallin oma
   tarkkuus, ja se on viisi kertaa hienompi kuin l0. */

/* MET Nordic: sama porrastus, oma alue (Lambert-hilan lat/lon-rajaus).
   Paino tulee Lambert-hilan omasta reunasta, ei suorakaiteesta. */
const MN_HILA_ASKEL = 0.05;
const MN_TASOT_POHJA = [0.05, 0.1, 0.25, 0.5];
const MN_MALLI = { malli: 'metnordic', perhe: 'metnordic',
  lahde: 'MET Norway · MET Nordic 1 km (Yr) · Open-Meteo / AWS Open Data · CC BY 4.0' };

/* MIKSI l3 ja l4 ovat yhä olemassa vaikka l2 kattaa saman alueen
   tarkempana. Ne ovat VARATIE pistekatolle: `getViewportPoints`
   kasvattaa hilaväliä kunnes pistemäärä mahtuu kattoon, ja hyvin leveällä
   ikkunalla väli voi nousta yli kahden asteen. Silloin `taso()` valitsee
   karkeamman tason, ja ilman niitä sama näkymä ladattaisiin l2:sta —
   162 laattaa yhden ruudullisen avaamiseen. Data on samaa; ero on vain
   siinä ettei ladata monikertaa enempää kuin näytetään. */

/* Kvantisointi (`pyramidi.mjs`): tuuli 0,2 m/s askelin 0..50,8 m/s ja
   suunta 2° askelin — molemmat selvästi hienompia kuin ennusteen oma
   tarkkuus, ja mahtuvat tavuun. 255 = puuttuva arvo. */

/* ------------------------------------------------------------------ */

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
  /* LOPPU ON KAUIMMAS YLTÄVÄ AJO, EI TUOREIN.
   *
   * ECMWF:n ajot eivät ole samanmittaisia: 00Z ja 12Z ulottuvat
   * viiteentoista vuorokauteen (85 askelta), 06Z ja 18Z vain kuuteen
   * (49 askelta). Tässä luki ennen `ajot[0]`, eli tuoreimman ajon
   * viimeinen hetki — ja koska työ ajetaan neljästi vuorokaudessa,
   * KAHDELLA AJOLLA NELJÄSTÄ aikajana lyheni 15 vuorokaudesta kuuteen.
   * Mitattuna samana päivänä: klo 13:36 ajo antoi 99 askelta
   * (-> 27.9.), klo 18:04 ajo 61 askelta (-> 18.9.).
   *
   * Korjaus on yhden rivin mittainen eikä se maksa mitään, koska
   * jokaiselle hetkelle valitaan alempana joka tapauksessa TUOREIN ajo
   * joka sen kattaa: kuuden vuorokauden jälkeiset askeleet tulevat
   * silloin viimeisimmästä 00Z- tai 12Z-ajosta, kuten niiden kuuluukin.
   * `haeAjot` kelaa 60 tuntia taaksepäin, joten pitkä ajo on aina
   * mukana. */
  const loppu = Math.max(...ajot.map(a =>
    Date.parse(a.meta.valid_times[a.meta.valid_times.length - 1])));
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
/* MET Nordicin tiedosto on 7 MB ja kolme tuulikenttää siitä noin 3 MB
   (mitattu 6 s / hetki), joten rinnakkaisuus on ECMWF:ää pienempi:
   jokainen lukija pitää kolmea 4,2 M pisteen kenttää muistissa. */
const MN_RINNAKKAIN = +(process.env.MN_RINNAKKAIN || 4);

rmSync(ULOS, { recursive: true, force: true });
mkdirSync(ULOS, { recursive: true });

const alkoi = Date.now();
let tavujaRaaka = 0, tavujaPakattu = 0, laattojaYht = 0;
const aika = () => `${((Date.now() - alkoi) / 1000).toFixed(0)} s`;

/* Tason laatat levylle. Palauttaa kirjoitettujen laattojen listan —
   tyhjät jätetään pois (`onDataa`), ja luettelo kertoo asiakkaalle mitkä
   ovat olemassa. */
function kirjoitaTaso(taso, nt, t0Ms, dtSek) {
  mkdirSync(join(ULOS, taso.id), { recursive: true });
  const laatat = [];
  let tavut = 0;
  for (const ruutu of taso.ruudut) {
    if (!onDataa(ruutu)) continue;
    const raaka = kirjoitaLaatta(taso, ruutu, nt, t0Ms, dtSek);
    const pakattu = gzipSync(raaka, { level: 9 });
    writeFileSync(join(ULOS, taso.id, `${ruutu.lat0}_${ruutu.lng0}.bin.gz`), pakattu);
    tavujaRaaka += raaka.length; tavujaPakattu += pakattu.length; tavut += pakattu.length;
    laatat.push([ruutu.lat0, ruutu.lng0]);
  }
  laattojaYht += laatat.length;
  console.log(`  ${taso.id}: askel ${taso.askel}°, ${laatat.length}/${taso.ruudut.length} laattaa, `
    + `${(tavut / 1e6).toFixed(1)} MB`);
  return laatat;
}

function rivi(taso, laatat, lisat) {
  return { id: taso.id, askel: taso.askel, span: (N - 1) * taso.askel,
           lat: taso.lat, lng: taso.lng, laatat, ...lisat };
}

/* ==================================================================
   ECMWF — pohja joka kattaa koko maapallon ja 15 vuorokautta.       */

const ajot = await haeAjot(2 + Math.ceil(MENNEISYYS_H / 6));
const dtSek = ajot[0].meta.temporal_resolution_seconds || 10800;
let akseli = rakennaAikaAkseli(ajot, MENNEISYYS_H, dtSek);
if (MAX_ASKELTA > 0) akseli = akseli.slice(0, MAX_ASKELTA);
console.log(`ECMWF: ${ajot.length} ajoa löytyi, uusin ${ajot[0].pv} ${ajot[0].ajo}`);
console.log(`  aika-akseli ${akseli.length} askelta, askel ${dtSek/3600} h`);
console.log(`  ${new Date(akseli[0].ms).toISOString()} .. ${new Date(akseli[akseli.length-1].ms).toISOString()}`);
{
  const kaytetyt = new Map();
  akseli.forEach(a => kaytetyt.set(a.ajo.ajo, (kaytetyt.get(a.ajo.ajo) || 0) + 1));
  console.log('  ajoittain: ' + [...kaytetyt].map(([k, v]) => `${k} ${v}`).join(', '));
}

const ecmwf = luoPyramidi(TASOT, akseli.length);
const ecmwfOk = [];
let valmiit = 0;

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
    console.warn(`  ! ${d.toISOString()}: ${e.message}`);
    return;
  }
  /* Lähdehila on koko maapallo 0,25°:n välein, rivi 0 etelänavalla ja
     pituusaste kiertää. Tasojen askeleet ovat 0,25°:n monikertoja, joten
     laatan solmut osuvat hilan solmuihin tarkasti. */
  kirjoitaHetki(ecmwf, ti, {
    la0: SRC.lat0, lo0: SRC.lng0, askel: SRC.step, ni: SRC.nx, nj: SRC.ny, kierto: true,
    ...uvHilaksi(kentat.wind_u_component_10m, kentat.wind_v_component_10m, kentat.wind_gusts_10m),
  });
  ecmwfOk.push(ti);
  valmiit++;
  if (valmiit % 20 === 0 || valmiit === akseli.length) {
    console.log(`  ${valmiit}/${akseli.length} hetkeä  ${aika()}`);
  }
});

if (ecmwfOk.length === 0) throw new Error('yhtään hetkeä ei saatu luettua');
const puuttuvat = akseli.length - ecmwfOk.length;
ecmwfOk.sort((a, b) => a - b);
if (puuttuvat) {
  tiivistaAika(ecmwf, ecmwfOk);
  akseli = ecmwfOk.map(i => akseli[i]);
}
const ajat = akseli.map(a => a.ms);

const luettelo = {
  versio: 1,
  malli: MALLI,
  lahde: 'Open-Meteo / ECMWF IFS 0.25° · AWS Open Data · CC BY 4.0',
  ajoAika: ajot[0].meta.reference_time,
  luotu: new Date().toISOString(),
  t0: ajat[0],
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
  ajat,
  n: N,
  nopAskel: NOP_ASKEL,
  suuntaAskel: SUUNTA_ASKEL,
  tyhja: TYHJA,
  otsake: OTSAKE,
  puuttuvia: puuttuvat,
  /* `tasot` on se lista jota VANHA asiakas lukee: se valitsee siitä
     askeleella eikä tunne painokanavaa. Siksi siinä ovat vain ECMWF ja
     HARMONIEn hienoin taso (joka oli siinä ennenkin, nyt isommalla
     alueella). Uudet tasot ovat `lisatasot`-listassa, jonka vain
     painokanavan osaava asiakas lukee — muuten vanha asiakas valitsisi
     MET Nordicin tai karkean HARMONIEn pelkän askeleen perusteella ja
     piirtäisi sen kovalla reunalla. */
  tasot: [],
  lisatasot: [],
};

console.log('\nECMWF-laatat:');
for (const taso of ecmwf) {
  const laatat = kirjoitaTaso(taso, ajat.length, ajat[0], dtSek);
  luettelo.tasot.push(rivi(taso, laatat, { perhe: 'ecmwf' }));
}

/* ==================================================================
   FMI HARMONIE — Suomi.

   Ajetaan ECMWF:n JÄLKEEN ja omassa try/catchissaan. Jos FMI on
   poissa, varasto julkaistaan ilman näitä tasoja — sovellus näyttää
   silloin MET Nordicia tai ECMWF:ää. Ajastettu työ ei saa kaatua siihen
   että toinen lähde on hetken nurin.

   KAKSI AJOA. Tuoreimmasta ajosta koko ennuste, ja edellisestä ajosta
   sen alkutunnit tuoreimman ajohetkeen asti — latauspalvelu säilyttää
   vain nämä kaksi (`harmonieAjot`). Ennen haku alkoi rakennushetken
   tunnista, jolloin FMI kattoi vasta rakennuksesta eteenpäin ja kaikki
   sitä edeltävä oli ECMWF:ää; nyt kate alkaa 3–9 h aiemmin.          */
if (process.env.HARMONIE !== '0') {
  const h0alkoi = Date.now();
  try {
    console.log('\nFMI HARMONIE:');
    const ajotH = await harmonieAjot();
    if (!ajotH.length) throw new Error('yhtään ajoa ei löytynyt');
    console.log('  ajot: ' + ajotH.map(t => new Date(t).toISOString().slice(0, 13) + 'Z').join(', '));
    const yhteinen = { lat: FMI_ALUE.lat, lng: FMI_ALUE.lng, askel: FMI_TASOT[0].askel,
                       log: (s) => console.log(s) };
    const uusin = await haeHarmonie({ ...yhteinen, ajo: ajotH[0],
                                      tunteja: +(process.env.HARMONIE_H || 66) });
    let edellinen = null;
    if (ajotH[1]) {
      try {
        edellinen = await haeHarmonie({ ...yhteinen, ajo: ajotH[1], minHetkia: 1,
                                        tunteja: Math.round((ajotH[0] - ajotH[1]) / 3600e3) - 1 });
        if (edellinen.ni !== uusin.ni || edellinen.nj !== uusin.nj
            || edellinen.la0 !== uusin.la0 || edellinen.lo0 !== uusin.lo0) {
          console.warn('  ! edellisen ajon hila eri, jätetään pois');
          edellinen = null;
        }
      } catch (e) {
        console.warn(`  ! edellinen ajo jäi pois: ${e.message}`);
      }
    }
    const hetket = [];
    if (edellinen) for (const t of edellinen.ajat) if (t < uusin.ajo) hetket.push({ t, h: edellinen });
    for (const t of uusin.ajat) hetket.push({ t, h: uusin });

    const fmi = luoPyramidi(FMI_TASOT, hetket.length);
    hetket.forEach(({ t, h }, ti) => {
      const U = h.kentat.get('WindUMS'), V = h.kentat.get('WindVMS'), G = h.kentat.get('WindGust');
      /* PUUSKAN LEIMA ON TUNNIN EDELLÄ. Mitattuna samassa pisteessä:
         pistekyselyn WindGust klo 13:00 = 8,50 ja hilan puuska leimalla
         12:00 = 8,47, kun taas hilan puuska leimalla 13:00 = 8,12 — joka
         on pistekyselyn klo 14:00 arvo. Hilassa leima on siis jakson ALKU
         ja pistekyselyssä sen loppu. Ilman siirtoa laatan puuska olisi
         tunnin myöhässä ja eri luku kuin spottikortin puuska SAMASTA
         MALLISTA. Siirto tehdään AJON SISÄLLÄ: ajon ensimmäiselle tunnille
         käytetään sen omaa leimaa. */
      const g = G.has(t - 3600e3) ? G.get(t - 3600e3) : (G.get(t) || null);
      kirjoitaHetki(fmi, ti, { la0: h.la0, lo0: h.lo0, askel: h.askel, ni: h.ni, nj: h.nj,
                               ...uvHilaksi(U.get(t), V.get(t), g) });
    });

    const hAjat = hetket.map(x => x.t);
    for (const taso of fmi) {
      const laatat = kirjoitaTaso(taso, hAjat.length, hAjat[0], 3600);
      const r = rivi(taso, laatat, {
        /* TASON OMA AIKA-AKSELI. Asiakas lukee tämän eikä luettelon
           yhteistä `ajat`-taulukkoa, ja `taso()` ohittaa tason kokonaan
           niinä hetkinä joita se ei kata. */
        ajat: hAjat, nt: hAjat.length, t0: hAjat[0], dtSek: 3600,
        ...FMI_MALLI, ajoAika: new Date(uusin.ajo).toISOString(),
        paino: true, vainKartta: true,
      });
      (taso.id === 'h0' ? luettelo.tasot : luettelo.lisatasot).push(r);
    }
    console.log(`  ${hAjat.length} hetkeä  ${new Date(hAjat[0]).toISOString()} .. `
      + `${new Date(hAjat[hAjat.length - 1]).toISOString()}  `
      + `${((Date.now() - h0alkoi) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.warn(`  ! HARMONIE-tasot jäivät pois: ${e.message}`);
  }
}

/* ==================================================================
   MET Nordic — Pohjoismaat ja Baltia, myös menneisyys.             */
if (process.env.METNORDIC !== '0') {
  const mnAlkoi = Date.now();
  try {
    console.log('\nMET Nordic:');
    const ax = await MetNordic.akseli(+(process.env.MN_MENNEISYYS_H || MENNEISYYS_H));
    let hetket = ax.hetket;
    if (MAX_ASKELTA > 0) hetket = hetket.slice(0, MAX_ASKELTA);
    console.log(`  ajo ${new Date(ax.ajo).toISOString()}, ${hetket.length} hetkeä`);
    const geom = MetNordic.saannollinenHila(MN_HILA_ASKEL);
    const tasotMN = MN_TASOT_POHJA.map((askel, i) => ({
      id: 'n' + i, askel, lat: geom.lat, lng: geom.lng, paino: MetNordic.paino,
    }));
    const mn = luoPyramidi(tasotMN, hetket.length);
    const ok = [];
    let n = 0;
    await rinnakkain(hetket, MN_RINNAKKAIN, async (h, ti) => {
      let k;
      try { k = await MetNordic.lueHetki(h); }
      catch (e) { console.warn(`  ! ${new Date(h.ms).toISOString()}: ${e.message}`); return; }
      kirjoitaHetki(mn, ti, MetNordic.hilaksi(geom, k.wind_speed_10m, k.wind_direction_10m,
                                              k.wind_gusts_10m));
      ok.push(ti);
      if (++n % 20 === 0 || n === hetket.length) console.log(`  ${n}/${hetket.length} hetkeä  ${aika()}`);
    });
    if (ok.length < 6) throw new Error(`vain ${ok.length} hetkeä luettiin`);
    ok.sort((a, b) => a - b);
    if (ok.length < hetket.length) tiivistaAika(mn, ok);
    const mAjat = ok.map(i => hetket[i].ms);
    for (const taso of mn) {
      const laatat = kirjoitaTaso(taso, mAjat.length, mAjat[0], 3600);
      luettelo.lisatasot.push(rivi(taso, laatat, {
        ajat: mAjat, nt: mAjat.length, t0: mAjat[0], dtSek: 3600,
        ...MN_MALLI, ajoAika: new Date(ax.ajo).toISOString(),
        paino: true, vainKartta: true,
      }));
    }
    console.log(`  ${mAjat.length}/${hetket.length} hetkeä  ${new Date(mAjat[0]).toISOString()} .. `
      + `${new Date(mAjat[mAjat.length - 1]).toISOString()}  `
      + `${((Date.now() - mnAlkoi) / 1000).toFixed(0)} s`);
  } catch (e) {
    console.warn(`  ! MET Nordic -tasot jäivät pois: ${e.message}`);
  }
}

writeFileSync(join(ULOS, 'luettelo.json'), JSON.stringify(luettelo));
console.log(`\nvalmis: ${laattojaYht} laattaa`);
console.log(`  raaka   ${(tavujaRaaka/1e6).toFixed(2)} MB`);
console.log(`  gzip    ${(tavujaPakattu/1e6).toFixed(2)} MB  (${(100*tavujaPakattu/tavujaRaaka).toFixed(0)} %)`);
console.log(`  ECMWF-hetkiä  ${ecmwfOk.length}/${ecmwfOk.length + puuttuvat}${puuttuvat ? ` (${puuttuvat} puuttui)` : ''}`);
console.log(`  aika    ${aika()}`);
