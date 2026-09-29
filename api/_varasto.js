/* HAVAINTOVARASTO — yhteiset osat asemille joiden historia on haarassa
 * `havainnot` (docs/data.md, "Mellstenin historia omaan varastoon" ja
 * "Larun historia"):
 *
 *   api/mellsten.js, api/laru.js          lukevat varaston paivatiedostot
 *   tools/havainnot.mjs, tools/laru.mjs   kirjoittavat ne
 *
 * Alaviiva nimen alussa: Vercel ei tee tasta omaa funktiota (katto on
 * 12 funktiota, CLAUDE.md), eika vite.config.js:n dev-reititys tarjoile
 * sita.
 *
 * Tassa on vain se mika ei riipu asemasta: Helsingin kalenteri, varaston
 * paivatiedoston luku ja niputus ajan mukaan. Rivien muoto on aseman oma
 * (api/_mellsten.js, api/_laru.js). */
import https from 'https';
import { readFile } from 'fs/promises';
import { join } from 'path';

/* Varaston koti. Ymparistomuuttuja on testia varten: se voi olla myos
   paikallinen hakemisto (keraajan tuloste). */
export const VARASTO = process.env.HAVAINNOT_KANTA || 'https://raw.githubusercontent.com/Jere-stack/wind/havainnot/';
const UA = 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)';

/* ── Helsingin kalenteri ─────────────────────────────────────────── */

/* Helsingin poikkeama UTC:sta annetulla hetkella. Intl osaa kesaajan;
   pyoristys taysiin minuutteihin, muuten muotoilun sekuntikatko jattaa
   millisekunnit aikaleimoihin ("...T05:50:00.738Z"). */
var _hkiFmt = null;
export function helsinkiPoikkeamaMs(ms) {
  if (!_hkiFmt) {
    _hkiFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }
  var s = _hkiFmt.format(new Date(ms));          /* "2026-09-08 08:45:00" */
  var utc = Date.parse(s.replace(' ', 'T') + 'Z');
  return Math.round((utc - ms) / 60000) * 60000;  /* +3 h kesalla, +2 h talvella */
}

/* Hetken Helsingin kalenteripaiva, "2026-09-29". */
export function helsinkiPaiva(ms) {
  return new Date(ms + helsinkiPoikkeamaMs(ms)).toISOString().slice(0, 10);
}

/* Paivan siirto kalenterissa: "2026-09-29", -1 -> "2026-09-28". */
export function paivaSiirra(paiva, n) {
  var t = Date.parse(paiva + 'T12:00:00Z') + n * 864e5;
  return new Date(t).toISOString().slice(0, 10);
}

/* Helsingin seinakello -> epoch ms. Poikkeama haetaan kahdesti, koska
   kesaajan vaihto voi osua arvauksen ja tuloksen valiin. */
export function seinaAjaksi(paiva, h, m) {
  var p = paiva.split('-');
  var seina = Date.UTC(+p[0], +p[1] - 1, +p[2], h, m, 0, 0);
  var off = helsinkiPoikkeamaMs(seina - 3 * 36e5);
  var ms = seina - off;
  var off2 = helsinkiPoikkeamaMs(ms);
  return off2 === off ? ms : seina - off2;
}

/* Helsingin paivat hetkesta toiseen, molemmat mukaan. */
export function paivatValilla(alkuMs, loppuMs) {
  var ulos = [], viimeinen = helsinkiPaiva(loppuMs);
  for (var p = helsinkiPaiva(alkuMs); p <= viimeinen; p = paivaSiirra(p, 1)) ulos.push(p);
  return ulos;
}

/* ── Haku ─────────────────────────────────────────────────────────── */

/* { teksti, muokattu } tai virhe. 404 on oma virheensa (`e.status`),
   koska puuttuva paiva ei ole vika. AIKARAJA ON PAKOLLINEN: ilman sita
   jumittunut yhteys piti funktion auki sen kattoon asti. */
export function haeTeksti(url, otsakkeet, aikaraja) {
  return hae(url, otsakkeet, aikaraja).then(function (v) {
    return { teksti: v.tavut.toString('utf8'), muokattu: v.muokattu };
  });
}

/* Sama tavuina (kuvat): { tavut: Buffer, muokattu }. */
export function haeTavut(url, otsakkeet, aikaraja) {
  return hae(url, otsakkeet, aikaraja);
}

function hae(url, otsakkeet, aikaraja) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { headers: otsakkeet || { 'user-agent': UA }, timeout: aikaraja || 5000 }, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        var e = new Error('HTTP ' + res.statusCode);
        e.status = res.statusCode;
        reject(e);
        return;
      }
      var osat = [];
      res.on('data', function (c) { osat.push(c); });
      res.on('error', reject);
      res.on('end', function () {
        resolve({ tavut: Buffer.concat(osat), muokattu: Date.parse(res.headers['last-modified'] || '') || null });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('aikaraja ' + (aikaraja || 5000) + ' ms')); });
    req.on('error', reject);
  });
}

/* ── Varaston paivatiedosto ───────────────────────────────────────── */

/* Menneet paivat muistiin lampimaan instanssiin. Kuluva paiva haetaan
   aina: siihen kirjoitetaan kymmenen minuutin valein. TYHJAA PAIVAA EI
   MUISTETA: raw.githubusercontent.com tarjoili mitattuna 404:aa
   valimuistista viela puoli minuuttia haaran syntyman jalkeen, ja
   muistettuna se olisi pitanyt koko paivan tyhjana puoli tuntia. */
const _muisti = new Map();
const MUISTI_MS = 30 * 60e3;

/* `asema` on hakemisto varastossa ('mellsten', 'laru'), `jasennin(teksti,
   paiva)` palauttaa rivit { ms, ... }. Puuttuva tiedosto on tyhja paiva
   (asema oli hiljaa tai varasto on nuorempi kuin pyydetty ikkuna), muu
   virhe heitetaan. */
export async function luePaiva(asema, paiva, jasennin, kuluva) {
  var avain = asema + '/' + paiva;
  var m = _muisti.get(avain);
  if (!kuluva && m && Date.now() - m.t < MUISTI_MS) return m.rivit;
  var polku = asema + '/' + paiva + '.txt';
  var teksti;
  try {
    if (/^https?:/.test(VARASTO)) teksti = (await haeTeksti(VARASTO + polku, { 'user-agent': UA }, 5000)).teksti;
    else teksti = await readFile(join(VARASTO, polku), 'utf8');
  } catch (e) {
    if (e.status === 404 || e.code === 'ENOENT') teksti = '';
    else throw e;
  }
  var rivit = jasennin(teksti, paiva);
  if (rivit.length) _muisti.set(avain, { t: Date.now(), rivit: rivit });
  return rivit;
}

/* Paivat rinnakkain: varasto on GitHubin CDN eika harrastepalvelin.
   Palauttaa paivakohtaiset tulokset, jotta kutsuja nakee mitka paivat
   puuttuivat (Laru hakee ne lahteesta). */
export async function luePaivat(asema, paivat, jasennin, kuluvaPaiva) {
  var tulokset = await Promise.allSettled(paivat.map(function (p) {
    return luePaiva(asema, p, jasennin, p === kuluvaPaiva);
  }));
  return tulokset.map(function (t, i) {
    return t.status === 'fulfilled'
      ? { paiva: paivat[i], rivit: t.value, virhe: null }
      : { paiva: paivat[i], rivit: [], virhe: t.reason };
  });
}

/* Aseman `tila.json` (mita keraaja on tehnyt), tai null jos varasto ei
   vastaa. Viisi minuuttia muistissa: se muuttuu vain keraajan ajossa. */
const _tilat = new Map();
export async function lueTila(asema) {
  var m = _tilat.get(asema);
  if (m && Date.now() - m.t < 5 * 60e3) return m.tila;
  var tila = null;
  try {
    var polku = asema + '/tila.json';
    var teksti = /^https?:/.test(VARASTO)
      ? (await haeTeksti(VARASTO + polku, { 'user-agent': UA }, 4000)).teksti
      : await readFile(join(VARASTO, polku), 'utf8');
    tila = JSON.parse(teksti);
  } catch (e) { tila = null; }
  if (tila) _tilat.set(asema, { t: Date.now(), tila: tila });
  return tila;
}

/* ── Niputus ajan mukaan ──────────────────────────────────────────── */

/* Nipuiksi AJAN mukaan, ei lukumaaran: tasaleveat ikkunat eivat koskaan
   ulotu katkon yli, joten katko jaa katkoksi (sama sopimus kuin
   kayttoliittyman `_havNiputa`: keskituuli keskiarvo, puuska maksimi,
   tyyni minimi, suunta yksikkovektoreista). Nipun aika on sen VIIMEINEN
   rivi, jotta sarjan paa on oikeasti tuorein hetki. Puuttuva arvo
   (Larulla ei ole lampomittaria) jaa pois eika muutu nollaksi. */
export function niputaAjassa(rivit, minuutit) {
  if (minuutit <= 1) return rivit;
  var leveys = minuutit * 60000, ulos = [], nippu = [], avain = null;
  function sulje() {
    if (!nippu.length) return;
    var n = nippu.length, sWs = 0, maxG = null, minW = null, sx = 0, sy = 0, nD = 0, sTa = 0, nTa = 0;
    for (var i = 0; i < n; i++) {
      var r = nippu[i];
      sWs += r.ws;
      if (r.wg != null && (maxG == null || r.wg > maxG)) maxG = r.wg;
      if (r.wsMin != null && (minW == null || r.wsMin < minW)) minW = r.wsMin;
      if (r.wd != null) { var a = r.wd * Math.PI / 180; sx += Math.sin(a); sy += Math.cos(a); nD++; }
      if (r.ta != null) { sTa += r.ta; nTa++; }
    }
    ulos.push({
      ms: nippu[n - 1].ms,
      ws: Math.round(sWs / n * 100) / 100,
      wg: maxG,
      wsMin: minW,
      wd: nD ? Math.round((Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360) : null,
      ta: nTa ? Math.round(sTa / nTa * 10) / 10 : null,
    });
    nippu = [];
  }
  for (var i = 0; i < rivit.length; i++) {
    var k = Math.floor(rivit[i].ms / leveys);
    if (k !== avain) { sulje(); avain = k; }
    nippu.push(rivit[i]);
  }
  sulje();
  return ulos;
}

/* Nipun leveys DATAN kestosta, ei pyydetyista tunneista: jos varasto ei
   vastaa, jaljella on tuore ikkuna, ja se naytetaan sellaisenaan eika
   muutamana pisteena. Viisi minuuttia: asemakortin 168 h minuutin
   riveina olisi 10 080 pistetta ja puolitoista megaa JSONia, nipuissa
   2 016. Kortti niputtaa itse viela noin 2,4 px:n valein (24 h ruudulla
   ~10 min), joten tiheampi naky vasta venytettyna. */
export function nipunLeveys(rivit) {
  if (!rivit.length) return 1;
  return rivit[rivit.length - 1].ms - rivit[0].ms > 6 * 36e5 ? 5 : 1;
}

/* ── Muotoilu ─────────────────────────────────────────────────────── */

/* "HH:MM" pyydetyssa vyohykkeessa (selaimen oma, `AIKAVYOHYKE`). */
var _tzFmt = {};
export function hhmm(ms, tz) {
  if (!_tzFmt[tz]) {
    try {
      _tzFmt[tz] = new Intl.DateTimeFormat('sv-SE',
        { timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: false });
    } catch (e) {
      _tzFmt[tz] = new Intl.DateTimeFormat('sv-SE',
        { timeZone: 'Europe/Helsinki', hour: '2-digit', minute: '2-digit', hour12: false });
    }
  }
  return _tzFmt[tz].format(new Date(ms));
}
export function kelpoTz(tz) {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('sv-SE', { timeZone: tz }); return tz; } catch (e) { return null; }
}
