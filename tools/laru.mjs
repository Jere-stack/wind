#!/usr/bin/env node
/* LARUN HISTORIA VARASTOON — Helsinki Laru (dlarah.org, Lauttasaari)
 * (docs/data.md, "Larun historia").
 *
 *   node tools/laru.mjs <hakemisto>
 *
 * MIKSI. Toisin kuin Mellstenin, Larun lahde pitaa itse kaikki paivat
 * vuosien takaa (api/_laru.js), joten proxy saa historian ilman tatakin:
 * varastosta puuttuva paiva haetaan lahteesta. Varasto on silti kaksi
 * asiaa. VALIMUISTI: ilman sita jokainen asemakortin avaus (168 h)
 * hakisi lahteesta seitseman paivatiedostoa. Ja VARMUUSKOPIO: jos lahde
 * siivoaa vanhat tiedostonsa tai katoaa, kuukausi on tallessa taalla —
 * Windgurun asema 47 on sama asema, ja sen historia on Windgurun oma
 * kopio samasta syysta.
 *
 * MITEN. Sama tyonkulku kuin Mellstenilla (.github/workflows/havainnot.yml)
 * mutta oma askeleensa `continue-on-error`illa ja omalla aikarajallaan:
 * Larun vika ei saa estaa Mellstenin rivien julkaisua. Joka ajolla:
 *
 *   1. Paattyneet paivat joita varastossa ei ole kopioidaan lahteesta,
 *      uusin ensin. Ensimmainen ajo hakee koko sailytysikkunan.
 *   2. Kolmen viime paivan kopiot tarkistetaan tunnin valein
 *      ehdollisella haulla (ETag -> 304): jos asema lahettaa rivinsa
 *      myohassa, kopio paivittyy.
 *   3. Yli SAILYTYS_PV vanhat paivat poistetaan.
 *
 * KULUVAA PAIVAA EI KOPIOIDA, JA VARASTOSSA ON VAIN VALMIITA PAIVIA.
 * Juuri siksi proxy voi luottaa siihen: varastossa oleva paiva on koko
 * paiva, ja puuttuva haetaan lahteesta. Kesken kopioitu paiva nayttaisi
 * proxylle valmiilta — ja koska GitHubin ajastin jattaa tunteja valiin
 * (docs/data.md), iltapaivalla kopioitu eilinen olisi jaanyt kortille
 * katkoksi. Kuluva paiva tulee aina lahteesta, joka antaa sen kokonaan.
 *
 * VARASTO (orpo haara `havainnot`, kuten Mellsten):
 *
 *   laru/2026-09-28.txt   lahteen paivatiedosto (Laru_2026-271.txt)
 *                         sellaisenaan, kaksi otsikkorivia edessa
 *   laru/tila.json        mita on haettu ja milloin
 *
 * Tiedoston ensimmainen rivi voi olla edellisen paivan 23:59: lahde
 * kirjoittaa sen joskus vasta keskiyon jalkeen. Rivit paivataan omista
 * kentistaan (api/_laru.js), joten se ei haittaa.
 *
 * Vain Noden omia moduuleita: tyonkulku ei aja `npm ci`:ta. */
import { readFileSync, writeFileSync, mkdirSync, readdirSync, unlinkSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { LAHDE, OTSAKKEET, jasennaLaru, paivanTiedosto } from '../api/_laru.js';
import { helsinkiPaiva, paivaSiirra, seinaAjaksi } from '../api/_varasto.js';

const ASEMA = 'laru';
/* Kuukausi kuten Mellstenilla. Sovellus nayttaa enintaan 168 h. */
const SAILYTYS_PV = 31;
/* Paiva on valmis kun se on haettu vahintaan puoli tuntia keskiyon
   jalkeen. Lahteen paattyneen paivan viimeinen kirjoitus on mitattuna
   23:59:5x (Last-Modified), joten marginaali on varovaisuutta. */
const VALMIS_MS = 30 * 60e3;
const TARKISTUS_VALI_MS = 60 * 60e3;
const TUORE_PV = 3;
/* Koko osan aikaraja. Tyonkulun katto on 8 min, eika jumittunut lahde
   saa vieda ajoa mukanaan; jaljelle jaaneet paivat haetaan seuraavalla
   ajolla, koska ne ovat yha "puuttuvia". */
const BUDJETTI_MS = 120e3;

const hak = process.argv[2];
if (!hak) { console.error('kaytto: node tools/laru.mjs <hakemisto>'); process.exit(2); }
const asemaHak = join(hak, ASEMA);
mkdirSync(asemaHak, { recursive: true });

const alku = Date.now();
const nyt = alku;
const tanaan = helsinkiPaiva(nyt);
const vanhin = paivaSiirra(tanaan, -(SAILYTYS_PV - 1));
const paivanLoppu = (p) => seinaAjaksi(paivaSiirra(p, 1), 0, 0);

/* ── Haku ──────────────────────────────────────────────────────────── */

/* Kolme yritysta kasvavalla odotuksella, kuten tools/havainnot.mjs:ssa.
   304 ja 404 ovat vastauksia eivatka virheita. */
async function hae(url, ehdot) {
  let viime = null;
  for (let k = 0; k < 3; k++) {
    if (k > 0) await new Promise((r) => setTimeout(r, 400 * 2 ** (k - 1) + Math.random() * 300));
    try {
      const res = await fetch(url, {
        headers: Object.assign({}, OTSAKKEET, ehdot || {}),
        signal: AbortSignal.timeout(15000),
      });
      if (res.status === 200) {
        return { tila: 200, teksti: await res.text(), etag: res.headers.get('etag'),
          muokattu: Date.parse(res.headers.get('last-modified') || '') || null };
      }
      if (res.status === 304 || res.status === 404) { await res.body?.cancel(); return { tila: res.status }; }
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
  : { asema: ASEMA, paivat: {} };
tila.paivat = tila.paivat || {};

const OTSIKKO = (p, tiedosto) => '# Helsinki Laru (dlarah.org Lauttasaari) ' + p + ' Suomen aikaa'
  + ' — lähteen ' + tiedosto + ' sellaisenaan\n'
  + '# vuosi kk pv kirjoitus-h kirjoitus-min hh:mm suunta min ka max lämpötila (asemalla ei mittaria)\n';

/* Kate: kuinka monessa paivan 144:sta kymmenen minuutin lokerosta on
   vahintaan yksi paivan oma rivi. Lukumaara ei kelpaa, koska lahteen
   vali on ~1,7 min eika tasan minuutti. */
function kate(p, rivit) {
  const a = seinaAjaksi(p, 0, 0), l = paivanLoppu(p);
  const lokerot = new Set();
  for (const r of rivit) if (r.ms >= a && r.ms < l) lokerot.add(Math.floor((r.ms - a) / 600000));
  return { rivit: rivit.filter((r) => r.ms >= a && r.ms < l).length,
    kate: Math.round(lokerot.size / Math.round((l - a) / 600000) * 100) };
}

const raportti = [];
let pyyntoja = 0, uusia = 0, paivitettyja = 0, ennallaan = 0, puuttuu = 0, kesken = 0;

/* ── 1–2. Paattyneet paivat, uusin ensin ──────────────────────────── */
for (let p = paivaSiirra(tanaan, -1); p >= vanhin; p = paivaSiirra(p, -1)) {
  /* Eilinen vasta puoli tuntia keskiyon jalkeen; siihen asti proxy
     hakee sen lahteesta. */
  if (nyt < paivanLoppu(p) + VALMIS_MS) continue;
  const tiedosto = paivanTiedosto(p);
  const polku = join(asemaHak, p + '.txt');
  const e = tila.paivat[p];
  const kopio = e && e.tila === 200 && existsSync(polku);
  const tuore = p >= paivaSiirra(tanaan, -TUORE_PV);
  let ehdot = null;
  if (kopio) {
    /* Valmis kopio: vanha on lopullinen, tuore tarkistetaan tunnin
       valein ehdollisesti. */
    if (!tuore || nyt - Date.parse(e.tarkistettu || e.haettu) < TARKISTUS_VALI_MS) continue;
    if (e.etag) ehdot = { 'if-none-match': e.etag };
  } else if (e && e.tila === 404) {
    /* Lahteessa ei ollut. Vanha on lopullinen, tuore voi viela
       ilmestya (asema lahettaa myohassa). */
    if (!tuore || nyt - Date.parse(e.tarkistettu || e.haettu) < TARKISTUS_VALI_MS) continue;
  }
  if (Date.now() - alku > BUDJETTI_MS) { kesken++; continue; }

  try {
    const v = await hae(LAHDE + tiedosto, ehdot);
    pyyntoja++;
    const hetki = new Date().toISOString();
    if (v.tila === 200) {
      const teksti = v.teksti.replace(/\s+$/, '') + '\n';
      const sisalto = OTSIKKO(p, tiedosto) + teksti;
      const oli = existsSync(polku) ? readFileSync(polku, 'utf8') : null;
      const k = kate(p, jasennaLaru(teksti));
      if (oli !== sisalto) {
        writeFileSync(polku, sisalto);
        if (oli == null) uusia++; else paivitettyja++;
        raportti.push(tiedosto + ' → ' + p + ': ' + k.rivit + ' riviä, kate ' + k.kate + ' %'
          + (oli == null ? '' : ' (päivitetty)'));
      } else ennallaan++;
      tila.paivat[p] = { tila: 200, tiedosto: tiedosto, etag: v.etag || null,
        muokattu: v.muokattu ? new Date(v.muokattu).toISOString() : null,
        haettu: hetki, tarkistettu: hetki, rivit: k.rivit, kate: k.kate };
    } else if (v.tila === 304) {
      ennallaan++;
      tila.paivat[p].tarkistettu = hetki;
    } else if (kopio) {
      /* Lahde poisti paivan jonka kopio on tallessa: juuri tata varten
         varasto on. Kopio jaa, ja tila kertoo sen. */
      tila.paivat[p].tarkistettu = hetki;
      tila.paivat[p].lahteessa = false;
      raportti.push(tiedosto + ': lähde vastasi 404, kopio jää varastoon');
    } else {
      puuttuu++;
      tila.paivat[p] = { tila: 404, tiedosto: tiedosto, haettu: (e && e.haettu) || hetki, tarkistettu: hetki };
    }
  } catch (err) {
    /* Tila ei muutu, joten paiva yritetaan uudelleen seuraavalla ajolla. */
    raportti.push(tiedosto + ': ' + err.message);
  }
  await tauko();
}

/* ── 3. Karsinta ──────────────────────────────────────────────────── */
for (const f of readdirSync(asemaHak)) {
  const m = /^(\d{4}-\d{2}-\d{2})\.txt$/.exec(f);
  if (m && m[1] < vanhin) unlinkSync(join(asemaHak, f));
}
for (const p of Object.keys(tila.paivat)) if (p < vanhin) delete tila.paivat[p];
tila.asema = ASEMA;
tila.paivitetty = new Date(nyt).toISOString();
writeFileSync(tilaPolku, JSON.stringify(tila, null, 1) + '\n');

/* ── Yhteenveto (tyonkulun GITHUB_STEP_SUMMARY) ───────────────────── */
console.log('### Havainnot: Helsinki Laru (dlarah.org)\n');
for (const r of raportti) console.log('- ' + r);
console.log('- ' + pyyntoja + ' pyyntöä: ' + uusia + ' uutta päivää, ' + paivitettyja + ' päivitetty, '
  + ennallaan + ' ennallaan, ' + puuttuu + ' ei lähteessä'
  + (kesken ? ', ' + kesken + ' jäi aikarajan takia seuraavaan ajoon' : ''));
console.log('\n| päivä | rivejä | kate | lähde muokattu |\n|---|---|---|---|');
for (const p of Object.keys(tila.paivat).sort().reverse()) {
  const t = tila.paivat[p];
  if (t.tila !== 200) { console.log('| ' + p + ' | – | – | ei lähteessä |'); continue; }
  console.log('| ' + p + ' | ' + t.rivit + ' | ' + t.kate + ' % | '
    + (t.muokattu ? t.muokattu.slice(0, 16).replace('T', ' ') + 'Z' : '–')
    + (t.lahteessa === false ? ' (poistettu lähteestä)' : '') + ' |');
}
