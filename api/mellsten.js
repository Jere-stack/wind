/* MELLSTEN (Haukilahti, Espoo) — Surfing ry:n oma saaasema.
 *
 * Ei kuulu FMI:n havaintoverkkoon, joten oma proxy kuten
 * Kruunuvuorenselalla. Lahde on kolme tekstitiedostoa:
 *
 *   lastWeather.txt   uusin rivi, 67 tavua
 *   weather.txt       30 tuoreinta minuuttia, 1,9 kt
 *   archive/Day-YY-MM-DD  koko vuorokausi minuutin valein, ~92 kt
 *
 * RIVIN MUOTO on dokumentoitu lahteen omalla sivulla, ei arvattu:
 *
 *   " 08:45 197°   5.6 <  6.5 <  7.8   14.9°C  1009.1  85.5%   0.0"
 *     aika  suunta min <  ka  < max    lampo   paine   kosteus sade
 *
 * Keskituuli on KOLMAS luku (ka), ei ensimmainen: rivilla on minuutin
 * minimi, keskiarvo ja maksimi tassa jarjestyksessa. Puuska on maksimi.
 * Viimeinen sarake on sade mm/tunnissa.
 *
 * AIKALEIMASSA ON VAIN KELLONAIKA, ja se on SUOMEN aikaa — tiedoston
 * otsikkorivin luontiaika on palvelimen omassa vyohykkeessa (PDT) eika
 * kelpaa ankkuriksi. Paivays johdetaan siksi nykyhetkesta Helsingin
 * seinakellon mukaan, ja tulevaisuuteen osuva rivi siirretaan
 * edelliselle vuorokaudelle (keskiyon yli meneva ikkuna).
 *
 * Asema on 60,147 / 24,794. Koordinaatti ei ole arvattu: se on Windyn
 * PWS-tietueesta "Surfing Ry Mellsten", jonka lukemat (6,5 m/s, 196°,
 * puuska 8,1, 15,0 °C, 1009,1 hPa, 85,5 %) taspasivat samalla hetkella
 * taman lahteen riviin taydellisesti.
 */
import https from 'https';

const BASE = 'https://mellsten.surfing.fi/';
const STATION = { name: 'Espoo Mellsten', place: 'mellsten', lat: 60.147, lng: 24.794 };
/* Lahde paivittyy minuutin valein; 60 s valimuisti riittaa eika
   tarjoile vanhaa. Historia on 30 min ikkuna, joten sekin on lyhyt. */
const TTL_TUOREIN = 60;
const TTL_HISTORIA = 120;

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
 * TAMA ON NYT TARKEAMPAA KUIN ENNEN. Asema on spottikortin lahin
 * havainto Haukilahdelle (1 km), ja epaonnistuminen ei nay virheena
 * vaan SEURAAVANA ASEMANA viiden kilometrin paassa — eli vikaa on
 * vaikea huomata, ja juuri siksi uusinnan pitaa olla riittava.
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
    try { return await fetchText(url); }
    catch (e) { viimeVirhe = e; }
  }
  throw viimeVirhe;
}

function fetchText(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      var body = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { body += c; });
      res.on('error', reject);
      res.on('end', function () { resolve(body); });
    }).on('error', reject);
  });
}

/* Helsingin poikkeama UTC:sta annetulla hetkella. Intl osaa kesaajan;
   kasin kirjoitettu saanto ei — sama ratkaisu kuin api/fmi.js:ssa. */
var _hkiFmt = null;
function helsinkiPoikkeamaMs(ms) {
  if (!_hkiFmt) {
    _hkiFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }
  var s = _hkiFmt.format(new Date(ms));          /* "2026-09-08 08:45:00" */
  var utc = Date.parse(s.replace(' ', 'T') + 'Z');
  /* Pyoristys taysiin minuutteihin. Muotoiltu merkkijono on katkaistu
     sekunnilleen, joten erotukseen jaa `ms`:n millisekunnit — ja ne
     valuisivat suoraan aikaleimoihin ("...T05:50:00.738Z"). Vyohykkeen
     poikkeama on aina taysia minuutteja. */
  return Math.round((utc - ms) / 60000) * 60000;  /* +3 h kesalla, +2 h talvella */
}

/* "08:45" -> epoch ms. Ankkurina nykyhetki: ikkuna on 30 min tai
   vuorokausi, joten oikea paiva on joko tama tai edellinen. */
function ajaksi(hhmm, nytMs) {
  var osat = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!osat) return null;
  var off = helsinkiPoikkeamaMs(nytMs);
  var hki = new Date(nytMs + off);
  var seina = Date.UTC(hki.getUTCFullYear(), hki.getUTCMonth(), hki.getUTCDate(),
    +osat[1], +osat[2], 0, 0);
  var ms = seina - off;
  /* Rivi ei voi olla tulevaisuudessa. Pieni vara kellojen eroon. */
  if (ms > nytMs + 5 * 60000) ms -= 86400000;
  return ms;
}

var RIVI = /^\s*(\d{1,2}:\d{2})\s+(-?\d+(?:\.\d+)?)°\s+(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)°C\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)\s*$/;

function jasenna(teksti, nytMs) {
  var ulos = [];
  var rivit = String(teksti).replace(/﻿/g, '').split('\n');
  for (var i = 0; i < rivit.length; i++) {
    var m = RIVI.exec(rivit[i]);
    if (!m) continue;
    var ms = ajaksi(m[1], nytMs);
    if (ms == null) continue;
    ulos.push({
      ms: ms, hhmm: m[1],
      wd: +m[2], wsMin: +m[3], ws: +m[4], wg: +m[5],
      ta: +m[6], paine: +m[7], kosteus: +m[8], sade: +m[9],
    });
  }
  /* Lahde listaa uusin ensin; sarja halutaan nousevana. */
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var nyt = Date.now();

  try {
    var teksti = await fetchTextRetry(BASE + (isHistory ? 'weather.txt' : 'lastWeather.txt'));
    var rivit = jasenna(teksti, nyt);
    if (!rivit.length) {
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }
    var v = rivit[rivit.length - 1];

    var runko = {
      station: STATION.name, place: STATION.place,
      lat: STATION.lat, lng: STATION.lng,
      ws: v.ws, wd: v.wd, wg: v.wg, wsMin: v.wsMin,
      tmp: v.ta, paine: v.paine, kosteus: v.kosteus, sade: v.sade,
      time: hhmm(v.ms, tz),
      lastIso: new Date(v.ms).toISOString(),
      ageMin: Math.round((nyt - v.ms) / 60000),
    };

    if (!isHistory) {
      res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_TUOREIN + ', stale-while-revalidate=60');
      return res.status(200).json(runko);
    }

    /* Sarjat samassa muodossa kuin api/fmi.js:n historia, jotta
       havaintokortin kaavio lukee ne ilman omaa haaraa. */
    var ws = [], wg = [], ta = [];
    for (var i = 0; i < rivit.length; i++) {
      var r = rivit[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
      ws.push({ t: t, v: r.ws, d: r.wd, iso: iso });
      wg.push({ t: t, v: r.wg, iso: iso });
      ta.push({ t: t, v: r.ta, iso: iso });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_HISTORIA + ', stale-while-revalidate=60');
    runko.ws = ws; runko.wg = wg; runko.ta = ta;
    /* Ikkunan pituus minuutteina sanotaan, jotta kayttoliittyman ei
       tarvitse paatella sita pisteiden maarasta. */
    runko.ikkunaMin = Math.round((rivit[rivit.length - 1].ms - rivit[0].ms) / 60000);
    runko.latest = {
      ws: v.ws, wd: v.wd, wg: v.wg, tmp: v.ta,
      time: hhmm(v.ms, tz), lastIso: new Date(v.ms).toISOString(),
      ageMin: Math.round((nyt - v.ms) / 60000),
    };
    return res.status(200).json(runko);
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
