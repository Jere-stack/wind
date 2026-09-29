/* MELLSTEN (Haukilahti, Espoo) — Surfing ry:n oma saaasema.
 *
 * Ei kuulu FMI:n havaintoverkkoon, joten oma proxy kuten
 * Kruunuvuorenselalla. Lahteessa on kolme tekstitiedostoa:
 *
 *   lastWeather.txt   uusin rivi, 67 tavua
 *   weather.txt       30 tuoreinta minuuttia, 1,9 kt
 *   archive/Day-YY-MM-DD  paattynyt vuorokausi minuutin valein, ~92 kt
 *
 * Rivin muoto, paivays ja arkiston nimeaminen: api/_mellsten.js.
 *
 * HISTORIA TULEE OMASTA VARASTOSTA. Lahde ei anna kuluvalta
 * vuorokaudelta kuin 30 minuuttia, joten historia oli ennen puoli
 * tuntia. Nyt keraaja (tools/havainnot.mjs, GitHub Actions 10 min
 * valein) tallettaa lahteen rivit haaraan `havainnot` ja taydentaa ne
 * lahteen arkistosta — kuten Windguru tekee saman aseman kanssa. Tama
 * proxy lukee varaston paivatiedostot ja tuoreimman ikkunan suoraan
 * lahteesta, ja lahteen rivi voittaa saman minuutin varastorivin.
 *
 * Proxy EI hae lahteen arkistoa: se olisi jopa kahdeksan 90 kt:n pyyntoa
 * pienelle harrastepalvelimelle joka korttiavauksella, ja palvelin
 * rajoittaa rinnakkaisia pyyntoja. Arkisto luetaan kerran, keraajassa.
 *
 * Asema on 60,147 / 24,794. Koordinaatti ei ole arvattu: se on Windyn
 * PWS-tietueesta "Surfing Ry Mellsten", jonka lukemat (6,5 m/s, 196°,
 * puuska 8,1, 15,0 °C, 1009,1 hPa, 85,5 %) taspasivat samalla hetkella
 * taman lahteen riviin taydellisesti. */
import https from 'https';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { suojaa } from './_suoja.js';
import { LAHDE, OTSAKKEET, jasennaAnkkurista, jasennaPaiva, helsinkiPaiva, paivaSiirra } from './_mellsten.js';

const STATION = { name: 'Espoo Mellsten', place: 'mellsten', lat: 60.147, lng: 24.794 };
/* Varaston koti. Ymparistomuuttuja on testia varten: se voi olla myos
   paikallinen hakemisto (keraajan tuloste). */
const VARASTO = process.env.HAVAINNOT_KANTA || 'https://raw.githubusercontent.com/Jere-stack/wind/havainnot/';
/* Lahde paivittyy minuutin valein; 60 s valimuisti riittaa eika
   tarjoile vanhaa. */
const TTL_TUOREIN = 60;
const TTL_HISTORIA = 120;
const HISTORIA_OLETUS = 24;
const HISTORIA_MAX = 168;
/* Nipun leveys. Asemakortin 168 h minuutin riveina olisi 10 080 pistetta
   ja puolitoista megaa JSONia; viiden minuutin nipuissa 2 016. Kortti
   niputtaa itse viela noin 2,4 px:n valein (24 h ruudulla ~10 min),
   joten tiheampi naky vasta venytettyna. */
const NIPPU_MIN = 5;

/* KOLME YRITYSTA, KASVAVA ODOTUS JA HAJONTA.
 *
 * Lahde on pieni harrastepalvelin ja rajoittaa RINNAKKAISIA pyyntoja:
 * mitattuna perakkain 12/12 onnistui, mutta kuudella rinnakkaisella
 * pyynnolla puolet vastasi 403:lla. Mikaan ei ollut muuttunut — sama
 * osoite onnistui heti perastapain.
 *
 * Yksi uusinta kiinteassa 400 ms:ssa ei riita siihen: jos kuusi pyyntoa
 * epaonnistuu yhta aikaa, ne kaikki uusivat samalla hetkella ja
 * tormaavat samaan rajoitukseen. Siksi odotus kasvaa ja siina on
 * satunnaishajontaa, joka levittaa uusinnat eri hetkille.
 *
 * Asema on spottikortin lahin havainto Haukilahdelle (1 km), ja
 * epaonnistuminen ei nay virheena vaan SEURAAVANA ASEMANA viiden
 * kilometrin paassa — eli vikaa on vaikea huomata, ja juuri siksi
 * uusinnan pitaa olla riittava.
 *
 * Kolme yritysta ei peita oikeaa vikaa: jos lahde on alhaalla, kaikki
 * kolme kaatuvat ja virhe menee lapi kuten ennenkin. */
const UUSINNAT = 3;
async function fetchTextRetry(url) {
  var viimeVirhe = null;
  for (var k = 0; k < UUSINNAT; k++) {
    if (k > 0) {
      var odota = 250 * Math.pow(2, k - 1) + Math.floor(Math.random() * 250);
      await new Promise(function (r) { setTimeout(r, odota); });
    }
    try { return await fetchText(url, OTSAKKEET, 6000); }
    catch (e) { viimeVirhe = e; }
  }
  throw viimeVirhe;
}

/* { teksti, muokattu } tai virhe. 404 on oma virheensa (`e.status`),
   koska varastossa puuttuva paiva ei ole vika. AIKARAJA ON PAKOLLINEN:
   ilman sita jumittunut yhteys piti funktion auki sen kattoon asti. */
function fetchText(url, otsakkeet, aikaraja) {
  return new Promise(function (resolve, reject) {
    var req = https.get(url, { headers: otsakkeet, timeout: aikaraja }, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        var e = new Error('HTTP ' + res.statusCode);
        e.status = res.statusCode;
        reject(e);
        return;
      }
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('error', reject);
      res.on('end', function () {
        resolve({ teksti: body, muokattu: Date.parse(res.headers['last-modified'] || '') || null });
      });
    });
    req.on('timeout', function () { req.destroy(new Error('aikaraja ' + aikaraja + ' ms')); });
    req.on('error', reject);
  });
}

/* ── Varasto ──────────────────────────────────────────────────────── */

/* Menneet paivat muistiin lampimaan instanssiin. Kuluva paiva haetaan
   aina: siihen kirjoitetaan kymmenen minuutin valein. */
const _muisti = new Map();
const MUISTI_MS = 30 * 60e3;

async function luePaiva(paiva, tanaan) {
  var m = _muisti.get(paiva);
  if (paiva !== tanaan && m && Date.now() - m.t < MUISTI_MS) return m.rivit;
  var polku = 'mellsten/' + paiva + '.txt';
  var teksti;
  try {
    if (/^https?:/.test(VARASTO)) {
      teksti = (await fetchText(VARASTO + polku, { 'user-agent': OTSAKKEET['user-agent'] }, 5000)).teksti;
    } else {
      teksti = await readFile(join(VARASTO, polku), 'utf8');
    }
  } catch (e) {
    /* Puuttuva paiva = asema oli koko paivan hiljaa tai varasto on
       nuorempi kuin pyydetty ikkuna. Ei virhe, vaan tyhja paiva. */
    if (e.status === 404 || e.code === 'ENOENT') teksti = '';
    else throw e;
  }
  var rivit = jasennaPaiva(teksti, paiva);
  _muisti.set(paiva, { t: Date.now(), rivit: rivit });
  return rivit;
}

async function lueVarasto(alkuMs, nytMs) {
  var tanaan = helsinkiPaiva(nytMs);
  var paivat = [];
  for (var p = helsinkiPaiva(alkuMs); p <= tanaan; p = paivaSiirra(p, 1)) paivat.push(p);
  /* Rinnakkain: varasto on GitHubin CDN eika harrastepalvelin. */
  var tulokset = await Promise.allSettled(paivat.map(function (p) { return luePaiva(p, tanaan); }));
  var rivit = [], virheita = 0;
  tulokset.forEach(function (t) {
    if (t.status === 'fulfilled') rivit = rivit.concat(t.value);
    else virheita++;
  });
  return { rivit: rivit, paivia: paivat.length, virheita: virheita };
}

/* ── Niputus ──────────────────────────────────────────────────────── */

/* Nipuiksi AJAN mukaan, ei lukumaaran: tasaleveat nipun ikkunat eivat
   koskaan ulotu katkon yli, joten katko jaa katkoksi (sama sopimus kuin
   kayttoliittyman `_havNiputa`: keskituuli keskiarvo, puuska maksimi,
   suunta yksikkovektoreista). Nipun aika on sen VIIMEINEN rivi, jotta
   sarjan paa on oikeasti tuorein hetki. */
function niputa(rivit, minuutit) {
  if (minuutit <= 1) return rivit;
  var leveys = minuutit * 60000, ulos = [], nippu = [], avain = null;
  function sulje() {
    if (!nippu.length) return;
    var n = nippu.length, sWs = 0, maxG = -Infinity, minW = Infinity, sx = 0, sy = 0, sTa = 0, nTa = 0;
    for (var i = 0; i < n; i++) {
      var r = nippu[i];
      sWs += r.ws;
      if (r.wg > maxG) maxG = r.wg;
      if (r.wsMin < minW) minW = r.wsMin;
      var a = r.wd * Math.PI / 180;
      sx += Math.sin(a); sy += Math.cos(a);
      if (r.ta != null) { sTa += r.ta; nTa++; }
    }
    ulos.push({
      ms: nippu[n - 1].ms,
      ws: Math.round(sWs / n * 100) / 100,
      wg: maxG,
      wsMin: minW,
      wd: Math.round((Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360),
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

/* ── Muotoilu ─────────────────────────────────────────────────────── */

var _tzFmt = {};
function hhmm(ms, tz) {
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
function kelpoTz(tz) {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('sv-SE', { timeZone: tz }); return tz; } catch (e) { return null; }
}

function tuorein(v, tz, nyt) {
  return {
    ws: v.ws, wd: v.wd, wg: v.wg, tmp: v.ta,
    time: hhmm(v.ms, tz), lastIso: new Date(v.ms).toISOString(),
    ageMin: Math.round((nyt - v.ms) / 60000),
  };
}

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var nyt = Date.now();

  try {
    if (!isHistory) {
      var yksi = await fetchTextRetry(LAHDE + 'lastWeather.txt');
      /* Ankkuri on tiedoston Last-Modified eika nykyhetki: sammuneen
         aseman viimeinen rivi on eilisen, ei taman paivan. */
      var r1 = jasennaAnkkurista(yksi.teksti, yksi.muokattu || nyt);
      if (!r1.length) {
        return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
      }
      var u = r1[r1.length - 1];
      res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_TUOREIN + ', stale-while-revalidate=60');
      return res.status(200).json(Object.assign({
        station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
        wsMin: u.wsMin, paine: u.paine, kosteus: u.kosteus, sade: u.sade,
      }, tuorein(u, tz, nyt)));
    }

    var tunnit = Math.max(1, Math.min(HISTORIA_MAX, parseInt(req.query.hours, 10) || HISTORIA_OLETUS));
    var raja = nyt - tunnit * 3600000;
    /* Lahde ja varasto rinnakkain: eri palvelimet. Kumpikin saa
       epaonnistua yksin — ilman varastoa vastaus on lahteen 30 min kuten
       ennen, ilman lahdetta varaston tuorein on korkeintaan kymmenen
       minuuttia vanha. */
    var tulos = await Promise.allSettled([
      fetchTextRetry(LAHDE + 'weather.txt'),
      lueVarasto(raja, nyt),
    ]);
    var tuore = tulos[0].status === 'fulfilled'
      ? jasennaAnkkurista(tulos[0].value.teksti, tulos[0].value.muokattu || nyt) : [];
    var varasto = tulos[1].status === 'fulfilled' ? tulos[1].value : { rivit: [], paivia: 0, virheita: 1 };
    if (!tuore.length && !varasto.rivit.length) {
      if (tulos[0].status === 'rejected') throw tulos[0].reason;
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }

    /* Minuutti avaimena; lahteen rivi voittaa varaston rivin. */
    var kaikki = new Map();
    varasto.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    tuore.forEach(function (r) { kaikki.set(r.ms, r); });
    var rivit = Array.from(kaikki.values()).sort(function (a, b) { return a.ms - b.ms; });
    var v = rivit[rivit.length - 1];

    var ikkuna = rivit.filter(function (r) { return r.ms >= raja; });
    /* Asema on ollut hiljaa koko ikkunan: viimeiset tunnetut rivit, jotta
       kortti voi sanoa "viimeisin …" eika vain "ei dataa" (sama kuin
       ennen, kun historia oli weather.txt:n 30 rivia). */
    if (!ikkuna.length) ikkuna = rivit.slice(-30);
    /* Nipun leveys DATAN kestosta, ei pyydetyista tunneista: jos varasto
       ei vastaa, jaljella on lahteen 30 minuuttia, ja se nakyy
       minuutteina kuten ennen eika kuutena pisteena. */
    var nippuMin = ikkuna[ikkuna.length - 1].ms - ikkuna[0].ms > 6 * 36e5 ? NIPPU_MIN : 1;
    var niput = niputa(ikkuna, nippuMin);
    /* SARJAN VIIMEINEN PISTE ON TUOREIN HAVAINTO, EI NIPUN KESKIARVO
       (sama kuin api/laru.js): kaavion paa on kortin ison luvun alla. */
    if (niput.length && niput[niput.length - 1] !== v) niput = niput.slice(0, -1).concat([v]);

    var ws = [], wg = [], ta = [];
    for (var i = 0; i < niput.length; i++) {
      var r = niput[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
      ws.push({ t: t, v: r.ws, d: r.wd, iso: iso });
      wg.push({ t: t, v: r.wg, iso: iso });
      ta.push({ t: t, v: r.ta, iso: iso });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_HISTORIA + ', stale-while-revalidate=60');
    return res.status(200).json(Object.assign({
      station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
      wsMin: v.wsMin, paine: v.paine, kosteus: v.kosteus, sade: v.sade,
    }, tuorein(v, tz, nyt), {
      ws: ws, wg: wg, ta: ta,
      /* Ikkunan pituus sanotaan, jotta kayttoliittyman ei tarvitse
         paatella sita pisteiden maarasta. */
      ikkunaMin: Math.round((ikkuna[ikkuna.length - 1].ms - ikkuna[0].ms) / 60000),
      nippuMin: nippuMin,
      pisteita: niput.length,
      /* Mista rivit tulivat: kaavio ei tarvitse tata, mittari tarvitsee. */
      lahteet: { tuore: tuore.length, varasto: varasto.rivit.length, varastoPaivia: varasto.paivia,
        varastoVirheita: varasto.virheita },
      latest: tuorein(v, tz, nyt),
    }));
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
