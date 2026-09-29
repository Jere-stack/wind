#!/usr/bin/env node
/* HAVAINTOVARASTO — Espoo Haukilahden (Surfing ry, Mellsten) historia
 * talteen (docs/data.md, "Mellstenin historia omaan varastoon").
 *
 *   node tools/havainnot.mjs <hakemisto>
 *
 * MIKSI. Lahde tarjoaa kuluvalta vuorokaudelta vain 30 tuoreinta
 * minuuttia (`weather.txt`); paivan arkisto (`archive/Day-…`) ilmestyy
 * vasta kun vuorokausi on ohi. Asemakortti nayttaa FMI-asemilla
 * seitseman vuorokautta, Haukilahdella puoli tuntia. Windgurun asemalla
 * 2399 on sama asema koko historioineen, koska Windguru KERAA sen itse:
 * se lukee lahdetta jatkuvasti ja tallettaa rivit omaan kantaansa. Tama
 * tekee saman.
 *
 * MITEN. Ajetaan GitHub Actionsissa kymmenen minuutin valein
 * (.github/workflows/havainnot.yml). Joka ajolla:
 *
 *   1. weather.txt (30 riviä) yhdistetaan varastoon. Ikkuna on 30 min ja
 *      ajovali 10, joten yksi tai kaksi valiin jaanyttä ajoa ei hukkaa
 *      mitaan.
 *   2. Tunnin valein tarkistetaan lahteen arkisto. Paattyneen paivan
 *      arkistorivit korvaavat keratyt (lahde on alkuperainen), ja ne
 *      tayttavat aukot jotka Actionsin viivastynyt ajastin jatti.
 *      Ensimmaisella ajolla sama taytto hakee koko sailytysikkunan, joten
 *      historia on heti olemassa eika kerry viikossa.
 *   3. Yli SAILYTYS_PV vanhat paivat poistetaan.
 *
 * VARASTO on orpo haara `havainnot` (yksi committi, pakkopaivitys kuten
 * `saadata`):
 *
 *   mellsten/2026-09-29.txt   Helsingin vuorokausi, lahteen OMAT rivit
 *                             sellaisenaan, nousevassa jarjestyksessa
 *   mellsten/tila.json        mita on haettu ja milloin
 *
 * KATKOT OVAT DATAA. Asema sammuu pilvisella saalla (aurinkopaneeli),
 * ja silloin riveja ei ole missaan — ei lahteessa, ei Windgurulla, eika
 * taalla. Puuttuvaa minuuttia ei keksita.
 *
 * Vain Noden omia moduuleita: tyonkulku ei aja `npm ci`:ta. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  LAHDE, OTSAKKEET, helsinkiPaiva, paivaSiirra, jasennaAnkkurista, jasennaArkisto,
  jasennaPaiva, arkistonNimi, seinaAjaksi,
} from '../api/_mellsten.js';

const ASEMA = 'mellsten';
/* Kuukausi talteen. Sovellus nayttaa enintaan 168 h, mutta varasto on
   myos se paikka jossa on rivit joita lahteen arkistossa ei ole. */
const SAILYTYS_PV = 31;
const ARKISTO_VALI_MS = 60 * 60e3;
/* Arkiston nimi jonka palvelinpaiva on tata vanhempi ei enaa muutu: 200
   ja 404 ovat silloin lopullisia. Vuorokausi palvelimen ja Helsingin
   kalenterin eroon + vuorokausi uuden istunnon nimeamiseen. */
const LOPULLINEN_PV = 3;

const hak = process.argv[2];
if (!hak) { console.error('kaytto: node tools/havainnot.mjs <hakemisto>'); process.exit(2); }
const asemaHak = join(hak, ASEMA);
mkdirSync(asemaHak, { recursive: true });

const nyt = Date.now();
const tanaan = helsinkiPaiva(nyt);
const vanhin = paivaSiirra(tanaan, -(SAILYTYS_PV - 1));

/* ── Haku ──────────────────────────────────────────────────────────── */

/* Sama sopimus kuin api/mellsten.js:ssa: lahde rajoittaa RINNAKKAISIA
   pyyntoja, joten haut ovat perakkain, ja ohimenevaan 403:een auttaa
   kasvava odotus. 404 on vastaus eika virhe. */
async function hae(url, ehdot) {
  let viime = null;
  for (let k = 0; k < 3; k++) {
    if (k > 0) await new Promise((r) => setTimeout(r, 400 * 2 ** (k - 1) + Math.random() * 300));
    try {
      const res = await fetch(url, {
        headers: Object.assign({}, OTSAKKEET, ehdot || {}),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 200) {
        return { tila: 200, teksti: await res.text(), etag: res.headers.get('etag'),
          muokattu: Date.parse(res.headers.get('last-modified') || '') || null };
      }
      if (res.status === 304 || res.status === 404) return { tila: res.status };
      viime = new Error('HTTP ' + res.status);
    } catch (e) { viime = e; }
  }
  throw viime;
}
const tauko = () => new Promise((r) => setTimeout(r, 350));

/* ── Varasto ───────────────────────────────────────────────────────── */

const tilaPolku = join(asemaHak, 'tila.json');
const tila = existsSync(tilaPolku)
  ? JSON.parse(readFileSync(tilaPolku, 'utf8'))
  : { asema: ASEMA, arkistot: {}, paivat: {} };
tila.arkistot = tila.arkistot || {};
tila.paivat = tila.paivat || {};

/* Paiva kerrallaan muistiin: hhmm -> alkuperainen rivi. */
const paivat = new Map();
const muuttuneet = new Set();
function paiva(p) {
  if (!paivat.has(p)) {
    const m = new Map();
    const polku = join(asemaHak, p + '.txt');
    if (existsSync(polku)) {
      for (const r of jasennaPaiva(readFileSync(polku, 'utf8'), p)) m.set(r.hhmm, r.teksti);
    }
    paivat.set(p, m);
  }
  return paivat.get(p);
}
/* `korvaa`: arkiston rivi voittaa keratyn (lahde on alkuperainen);
   keratty rivi ei koskaan korvaa olemassa olevaa. */
function lisaa(rivit, korvaa) {
  let uusia = 0;
  for (const r of rivit) {
    if (r.paiva < vanhin || r.paiva > tanaan) continue;
    const m = paiva(r.paiva);
    const oli = m.get(r.hhmm);
    if (oli === r.teksti) continue;
    if (oli != null && !korvaa) continue;
    if (oli == null) uusia++;
    m.set(r.hhmm, r.teksti);
    muuttuneet.add(r.paiva);
  }
  return uusia;
}

const raportti = [];

/* ── 1. Tuoreet 30 minuuttia ──────────────────────────────────────── */
try {
  const v = await hae(LAHDE + 'weather.txt');
  if (v.tila === 200) {
    /* ANKKURI ON Last-Modified, EI NYKYHETKI: sammuneen aseman
       tiedostossa on viimeiset rivit vaikka vuorokauden takaa. */
    const rivit = jasennaAnkkurista(v.teksti, v.muokattu || nyt);
    const uusia = lisaa(rivit, false);
    if (rivit.length) tila.uusin = new Date(rivit[rivit.length - 1].ms).toISOString();
    raportti.push('weather.txt: ' + rivit.length + ' riviä, ' + uusia + ' uutta'
      + (v.muokattu ? ', muokattu ' + new Date(v.muokattu).toISOString() : ''));
  } else {
    raportti.push('weather.txt: HTTP ' + v.tila);
  }
} catch (e) {
  raportti.push('weather.txt: ' + e.message);
}

/* ── 2. Arkisto ───────────────────────────────────────────────────── */
/* Helsingin paiva D on palvelimen nimella D-1 tai D (ks. _mellsten.js),
   joten ikkunan paivat [vanhin, tanaan] kattavat nimet [vanhin-1, tanaan]. */
const arkistoAika = !tila.arkistoTarkistettu
  || nyt - Date.parse(tila.arkistoTarkistettu) >= ARKISTO_VALI_MS
  || process.env.HAVAINNOT_ARKISTO === '1';
if (arkistoAika) {
  let haettuja = 0, uusiaYht = 0;
  for (let p = paivaSiirra(vanhin, -1); p <= tanaan; p = paivaSiirra(p, 1)) {
    const nimi = arkistonNimi(p);
    const aiempi = tila.arkistot[nimi];
    const lopullinen = p <= paivaSiirra(tanaan, -LOPULLINEN_PV);
    if (aiempi && lopullinen) continue;
    try {
      /* Muuttumaton tiedosto ei maksa kuin otsakkeet: Apache vastaa
         304:llä kun ETag on sama. */
      const ehdot = aiempi && aiempi.etag ? { 'if-none-match': aiempi.etag } : null;
      const a = await hae(LAHDE + 'archive/' + nimi, ehdot);
      haettuja++;
      if (a.tila === 200) {
        const rivit = jasennaArkisto(a.teksti, a.muokattu);
        const uusia = lisaa(rivit, true);
        uusiaYht += uusia;
        const kpl = {};
        for (const r of rivit) kpl[r.paiva] = (kpl[r.paiva] || 0) + 1;
        for (const p2 of Object.keys(kpl)) {
          if (p2 >= vanhin && p2 <= tanaan) tila.paivat[p2] = Object.assign(tila.paivat[p2] || {}, { arkisto: true });
        }
        tila.arkistot[nimi] = { tila: 200, etag: a.etag || null,
          muokattu: a.muokattu ? new Date(a.muokattu).toISOString() : null, paivat: kpl };
        raportti.push('archive/' + nimi + ': ' + rivit.length + ' riviä → '
          + Object.keys(kpl).map((k) => k + ' (' + kpl[k] + ')').join(', ') + ', ' + uusia + ' uutta');
      } else if (a.tila === 404) {
        tila.arkistot[nimi] = { tila: 404, haettu: new Date(nyt).toISOString() };
      }
    } catch (e) {
      raportti.push('archive/' + nimi + ': ' + e.message);
    }
    await tauko();
  }
  tila.arkistoTarkistettu = new Date(nyt).toISOString();
  raportti.push('arkisto: ' + haettuja + ' pyyntöä, ' + uusiaYht + ' riviä joita varastossa ei ollut');
}

/* ── 3. Kirjoitus ja karsinta ─────────────────────────────────────── */
const OTSIKKO = (p) => '# Espoo Haukilahti, Surfing ry:n sääasema (mellsten.surfing.fi) ' + p
  + ', Suomen aika\n# aika suunta min < ka < max lämpötila paine kosteus sade — lähteen oma rivi sellaisenaan\n';
for (const p of muuttuneet) {
  const m = paivat.get(p);
  const avaimet = [...m.keys()].sort();
  writeFileSync(join(asemaHak, p + '.txt'), OTSIKKO(p) + avaimet.map((k) => m.get(k)).join('\n') + '\n');
  tila.paivat[p] = Object.assign(tila.paivat[p] || {}, { rivit: avaimet.length });
}
for (const f of readdirSync(asemaHak)) {
  const m = /^(\d{4}-\d{2}-\d{2})\.txt$/.exec(f);
  if (m && m[1] < vanhin) unlinkSync(join(asemaHak, f));
}
for (const p of Object.keys(tila.paivat)) if (p < vanhin) delete tila.paivat[p];
for (const n of Object.keys(tila.arkistot)) {
  /* Nimi "Day-YY-MM-DD" -> palvelinpaiva; ikkunan ulkopuoliset pois. */
  const pv = '20' + n.slice(4, 6) + '-' + n.slice(7, 9) + '-' + n.slice(10, 12);
  if (pv < paivaSiirra(vanhin, -1)) delete tila.arkistot[n];
}
tila.asema = ASEMA;
tila.paivitetty = new Date(nyt).toISOString();
writeFileSync(tilaPolku, JSON.stringify(tila, null, 1) + '\n');

/* ── Yhteenveto (tyonkulun GITHUB_STEP_SUMMARY) ───────────────────── */
console.log('### Havainnot: Espoo Haukilahti (Mellsten)\n');
for (const r of raportti) console.log('- ' + r);
console.log('\n| päivä | rivejä | kate | arkisto |\n|---|---|---|---|');
for (const p of Object.keys(tila.paivat).sort().reverse()) {
  const t = tila.paivat[p];
  /* Kate suhteessa siihen mita paivassa VOI olla: tanaan vain tahan asti. */
  const mahd = p === tanaan ? Math.max(1, Math.round((nyt - seinaAjaksi(p, 0, 0)) / 60000)) : 1440;
  console.log('| ' + p + ' | ' + (t.rivit || 0) + ' | ' + Math.min(100, Math.round((t.rivit || 0) / mahd * 100))
    + ' % | ' + (t.arkisto ? 'kyllä' : '–') + ' |');
}
