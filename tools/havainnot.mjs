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
 * MITEN. Ajetaan GitHub Actionsissa (.github/workflows/havainnot.yml):
 * ajastin, Saadata-ajon perään ja ajastinketju. Joka ajolla:
 *
 *   1. weather.txt (30 riviä) yhdistetaan varastoon.
 *   1b. Lahteen 4 tunnin kuvaaja (plot.gif) minuuttiriveiksi
 *      (api/_mellsten.js, `tulkitseKuvaaja`) niille minuuteille joilta
 *      varastossa ei ole rivia. Kuvaaja tarkistetaan saman ajon
 *      weather.txt:ta vasten ja hylataan jos se ei tasmaa. Taman ansiosta
 *      ajovalin ei tarvitse olla alle 30 min vaan alle nelja tuntia:
 *      GitHubin ajastin ei pysty edes siihen luotettavasti (docs/data.md).
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
 *                             sellaisenaan, nousevassa jarjestyksessa;
 *                             kuvaajasta luetut rivit loppusanalla
 *                             "kuvaaja" (ei lampotilaa). Tekstirivi
 *                             korvaa kuvaajarivin, arkisto molemmat.
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
  LAHDE, OTSAKKEET, KUVAAJA, helsinkiPaiva, paivaSiirra, jasennaAnkkurista, jasennaArkisto,
  jasennaPaiva, arkistonNimi, seinaAjaksi, tulkitseKuvaaja, vertaaKuvaajaan, kuvaajaKelpaa,
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
async function hae(url, ehdot, tavuina) {
  let viime = null;
  for (let k = 0; k < 3; k++) {
    if (k > 0) await new Promise((r) => setTimeout(r, 400 * 2 ** (k - 1) + Math.random() * 300));
    try {
      const res = await fetch(url, {
        headers: Object.assign({}, OTSAKKEET, ehdot || {}),
        signal: AbortSignal.timeout(20000),
      });
      if (res.status === 200) {
        const muokattu = Date.parse(res.headers.get('last-modified') || '') || null;
        if (tavuina) return { tila: 200, tavut: Buffer.from(await res.arrayBuffer()), muokattu };
        return { tila: 200, teksti: await res.text(), etag: res.headers.get('etag'), muokattu };
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
/* Kuka voittaa saman minuutin: arkisto (`korvaa`) kaiken, keratty
   tekstirivi (weather.txt) vain kuvaajasta luetun, ja kuvaajarivi ei
   koskaan mitaan — se tayttaa vain tyhjan minuutin. Lahteen oma rivi on
   aina alkuperainen, kuvaaja on sen piirros. */
const ON_KUVARIVI = / kuvaaja\s*$/;
function lisaa(rivit, korvaa) {
  let uusia = 0;
  for (const r of rivit) {
    if (r.paiva < vanhin || r.paiva > tanaan) continue;
    const m = paiva(r.paiva);
    const oli = m.get(r.hhmm);
    if (oli === r.teksti) continue;
    if (oli != null) {
      if (r.kuvaaja) continue;
      if (!korvaa && !ON_KUVARIVI.test(oli)) continue;
    }
    if (oli == null) uusia++;
    m.set(r.hhmm, r.teksti);
    muuttuneet.add(r.paiva);
  }
  return uusia;
}

const raportti = [];

/* ── 1. Tuoreet 30 minuuttia ──────────────────────────────────────── */
let tuoreet = [];
try {
  const v = await hae(LAHDE + 'weather.txt');
  if (v.tila === 200) {
    /* ANKKURI ON Last-Modified, EI NYKYHETKI: sammuneen aseman
       tiedostossa on viimeiset rivit vaikka vuorokauden takaa. */
    const rivit = jasennaAnkkurista(v.teksti, v.muokattu || nyt);
    tuoreet = rivit;
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

/* ── 1b. Kuvaaja: nelja tuntia ────────────────────────────────────── */
/* Tarkistus on saman ajon weather.txt: kuvaaja kelpaa vain jos sen
   minuutit tasmaavat tekstiriveihin (api/_mellsten.js). Aikaleima
   osoitteeseen, koska lahde lahettaa kuvalle max-age 30 vrk. */
try {
  await tauko();
  const k = await hae(LAHDE + KUVAAJA + '?' + Math.floor(nyt / 60000), null, true);
  if (k.tila === 200) {
    const t = tulkitseKuvaaja(k.tavut, k.muokattu);
    const tark = vertaaKuvaajaan(t.rivit, tuoreet);
    if (kuvaajaKelpaa(t, tark)) {
      const uusia = lisaa(t.rivit, false);
      tila.kuvaaja = { haettu: new Date(nyt).toISOString(), rivit: t.rivit.length, uusia, tarkistus: tark };
      raportti.push('plot.gif: ' + t.rivit.length + ' minuuttia (' + t.rivit[0].paiva + ' ' + t.rivit[0].hhmm
        + ' – ' + t.rivit[t.rivit.length - 1].hhmm + '), ' + uusia + ' uutta, tarkistus '
        + tark.osui + '/' + tark.verrattu + ' weather.txt:n minuuttia');
    } else {
      tila.kuvaaja = { haettu: new Date(nyt).toISOString(), hylatty: t.syy || 'ei tasmaa', tarkistus: tark };
      raportti.push('plot.gif HYLÄTTY: ' + (t.syy || ('tarkistus ' + tark.osui + '/' + tark.verrattu)));
    }
  } else {
    raportti.push('plot.gif: HTTP ' + k.tila);
  }
} catch (e) {
  raportti.push('plot.gif: ' + e.message);
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
  + ', Suomen aika\n# aika suunta min < ka < max lämpötila paine kosteus sade — lähteen oma rivi sellaisenaan;'
  + ' "kuvaaja" = luettu lähteen 4 h kuvaajasta (plot.gif), ei lämpötilaa\n';
for (const p of muuttuneet) {
  const m = paivat.get(p);
  const avaimet = [...m.keys()].sort();
  writeFileSync(join(asemaHak, p + '.txt'), OTSIKKO(p) + avaimet.map((k) => m.get(k)).join('\n') + '\n');
  const kuvasta = avaimet.filter((k) => ON_KUVARIVI.test(m.get(k))).length;
  tila.paivat[p] = Object.assign(tila.paivat[p] || {}, { rivit: avaimet.length, kuvaajasta: kuvasta });
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
console.log('\n| päivä | rivejä | kate | kuvaajasta | arkisto |\n|---|---|---|---|---|');
for (const p of Object.keys(tila.paivat).sort().reverse()) {
  const t = tila.paivat[p];
  /* Kate suhteessa siihen mita paivassa VOI olla: tanaan vain tahan asti. */
  const mahd = p === tanaan ? Math.max(1, Math.round((nyt - seinaAjaksi(p, 0, 0)) / 60000)) : 1440;
  console.log('| ' + p + ' | ' + (t.rivit || 0) + ' | ' + Math.min(100, Math.round((t.rivit || 0) / mahd * 100))
    + ' % | ' + (t.kuvaajasta || 0) + ' | ' + (t.arkisto ? 'kyllä' : '–') + ' |');
}
