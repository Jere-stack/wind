import { suojaa } from './_suoja.js';
import { haeTeksti, HakuVirhe } from './_haku.js';

const CSV_URL = 'https://swell.fmi.fi/Marinehelsinki/csv/kruunuvuorenselka_weatherdata.csv';
const STATION = { name: 'Kruunuvuorenselkä', place: 'kruunuvuorenselka', lat: 60.163, lng: 24.997 };
/* Historian pituus tulee kutsujalta, kuten api/fmi.js:ssa.
 *
 * CSV kattaa noin 14 vrk kymmenen minuutin välein, eli data on jo
 * olemassa — sitä vain leikattiin 30 tuntiin siltä ajalta kun kortti
 * näytti korkeintaan vuorokauden. Nyt havaintokortti pyytää 168 h (sama
 * katto kuin FMI:n opendata antaa, jolloin jaksovalitsin käyttäytyy
 * samoin riippumatta siitä mikä asema on auki) ja karttamerkki 30 h,
 * jolla se osaa näyttää oikean lukeman aikajanaa liu'utettaessa.
 * Oletus on merkin mitta: kartta latautuu käynnistyksessä, kortti vasta
 * pyydettäessä. */
const HISTORY_DEFAULT = 30;
const HISTORY_MAX = 336;
/* Uimaveden lämpötila esitetään 7/30 vrk/max -jaksoina kuten muutkin
   uimavesipisteet, joten sille otetaan koko CSV:n kattama jakso (~14 vrk).
   Harvennetaan 30 minuuttiin: lähde on 10 min välein eli ~2000 riviä, ja
   graafi piirtää joka tapauksessa enintään 300 pistettä. */
const TW_STEP = 3;

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;

  try {
    const csvText = await fetchText(CSV_URL);
    const rawLines = csvText.split('\n');

    /* Ohita '#'-kommenttirivit ja tyhjät rivit, poimi otsikko + datarivit */
    const lines = rawLines.map(function (l) { return l.trim(); })
      .filter(function (l) { return l.length && l.charAt(0) !== '#'; });

    if (lines.length < 2) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).json({ error: 'no data', station: STATION.name });
    }

    const dataLines = lines.slice(1); /* rivi 0 = otsikko "Localtime","UTC","Ws",... */
    const hours = Math.max(1, Math.min(HISTORY_MAX, parseInt(req.query.hours, 10) || HISTORY_DEFAULT));
    const cutoffMs = Date.now() - hours * 3600000;

    const wsHist = [];
    const wgHist = [];
    /* Ilman lampotila samaan sarjamuotoon kuin FMI:lla — havaintokortin
       kaavio lukee sen tooltipiin ja tilastoriville. */
    const taHist = [];
    /* Uimaveden lampotila omana sarjanaan: ISO-aikaleima (ei HH:MM), koska
       jakso on paivia eika tunteja — sama pistemuoto {t,v} kuin UiRas-
       asemilla, jolloin frontend voi kayttaa samaa graafia. */
    const twAll = [];
    let latest = null;
    let latestMs = -Infinity;
    let latestValid = null;     /* uusin rivi jossa ws ei ole NaN — käytetään näytölle */
    let latestValidMs = -Infinity;

    const rivit = [];
    for (let i = 0; i < dataLines.length; i++) {
      const cols = dataLines[i].split(',').map(function (s) {
        return s.trim().replace(/^"|"$/g, '');
      });
      if (cols.length < 7) continue;

      const localtime = cols[0];  /* "2026-05-25T12:10:00" — Suomen aika */
      const utcTime   = cols[1];  /* "2026-05-25T09:10:00Z" — yksiselitteinen */
      /* "HH:MM" Localtime-sarakkeesta — sama formaatti kuin muualla apissa
         (_renderLiveHistory ja _histValueAt käyttävät tätä muotoa suoraan) */
      const hhmm = localtime.length >= 16 ? localtime.slice(11, 16) : null;
      if (!hhmm) continue;
      const utcMs = Date.parse(utcTime);
      if (isNaN(utcMs)) continue;
      rivit.push({ utcTime: utcTime, utcMs: utcMs, hhmm: hhmm,
        ws: parseNum(cols[2]), gust: parseNum(cols[3]), wdir: parseNum(cols[4]),
        ta: parseNum(cols[5]), tw: parseNum(cols[6]) });
    }
    rivit.sort(function (a, b) { return a.utcMs - b.utcMs; });

    /* NOLLARIVI KESKELLÄ TUULTA ON KATKO, EI TYYNI (docs/oikeellisuus.md,
       O10). Lähteessä on rivejä `0.0, 0.0, 0` (tuuli, puuska, suunta)
       joiden naapureilla on 1–3 m/s puuska — 14 vrk:ssa viisi, esim.
       29.9. 17:40Z naapurit 1,2 / 2,1 ja 0,7 / 1,5 m/s. Kymmenen minuutin
       puuska 0,0 tarkoittaa ettei kuppi pyörinyt kertaakaan, ja se on
       uskottavaa vain aivan tyynessä. Raja on naapurin puuska 1,5 m/s:
       sen alla nolla voi olla tyyni (28.9. 02:00, naapurit 0,9 / 1,3), ja
       se jää. Mellstenin nollarivi on eri asia (ks. CLAUDE.md). */
    for (let i = 0; i < rivit.length; i++) {
      const r = rivit[i];
      if (r.ws !== 0 || r.gust !== 0 || (r.wdir !== 0 && r.wdir != null)) continue;
      let naapuri = 0;
      for (const j of [i - 1, i + 1]) {
        const n = rivit[j];
        if (n && Math.abs(n.utcMs - r.utcMs) <= 1800000 && n.gust != null) naapuri = Math.max(naapuri, n.gust);
      }
      if (naapuri >= 1.5) { r.ws = null; r.gust = null; r.wdir = null; }
    }

    for (let i = 0; i < rivit.length; i++) {
      const { utcTime, utcMs, hhmm, ws, gust, wdir, ta, tw } = rivit[i];
      if (utcMs >= cutoffMs) {
        /* Anturikatkon NaN-rivit jatetaan pois sarjasta sen sijaan etta ne
           tyontaisivat nullin kaavioon. */
        if (ws != null) wsHist.push({ t: hhmm, v: ws, d: wdir, iso: utcTime });
        if (gust != null) wgHist.push({ t: hhmm, v: gust, iso: utcTime });
        if (ta != null) taHist.push({ t: hhmm, v: ta, iso: utcTime });
      }
      /* Vesisarja koko CSV:n ajalta, ei tuntirajausta */
      if (tw != null) twAll.push({ ms: utcMs, t: utcTime, v: tw });

      /* Uusin havainto = suurin UTC-aikaleima — ei oleteta rivijärjestystä */
      if (utcMs > latestMs) {
        latestMs = utcMs;
        latest = { ws: ws, wg: gust, wd: wdir, ta: ta, tw: tw, hhmm: hhmm, utcTime: utcTime };
      }
      /* Erikseen: uusin rivi jossa tuulilukema on oikeasti olemassa (ei anturikatko) */
      if (ws != null && utcMs > latestValidMs) {
        latestValidMs = utcMs;
        latestValid = { ws: ws, wg: gust, wd: wdir, ta: ta, tw: tw, hhmm: hhmm, utcTime: utcTime };
      }
    }

    if (!latest) {
      res.setHeader('Cache-Control', 'public, s-maxage=300');
      return res.status(200).json({ error: 'no valid rows', station: STATION.name });
    }

    /* Näytölle: käytä viimeisintä validia tuulilukemaa jos sellainen löytyy,
       muuten kaikkein uusinta riviä (voi olla null-arvoinen anturikatko) */
    const display = latestValid || latest;

    res.setHeader('Cache-Control', 'public, s-maxage=300'); /* data päivittyy n. 10min välein */
    return res.status(200).json({
      station: STATION.name,
      place: STATION.place,
      lat: STATION.lat,
      lng: STATION.lng,
      ws: display.ws,
      wg: display.wg,
      wd: display.wd,
      ta: latest.ta,
      tw: latest.tw,
      time: display.hhmm,
      utcTime: display.utcTime,
      history: {
        ws: wsHist, wg: wgHist, ta: taHist,
        station: STATION.name, place: STATION.place,
        lastIso: display.utcTime,
        /* Havainnon ika minuutteina — kortti erottaa talla "asema on
           hiljaa" -tilan "asemaa ei ole" -tilasta. */
        ageMin: Math.round((Date.now() - latestValidMs) / 60000),
      },
      /* Aikajarjestyksessa ja harvennettuna — CSV:n rivijarjestykseen ei luoteta */
      waterHistory: twAll
        .sort(function (a, b) { return a.ms - b.ms; })
        .filter(function (_, i) { return i % TW_STEP === 0; })
        .map(function (p) { return { t: p.t, v: p.v }; })
    });
  } catch (err) {
    /* Ylävirran virhe: 502 eikä välimuistiin (docs/oikeellisuus.md, O5). */
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: err.message, station: STATION.name });
  }
};

function parseNum(s) {
  if (s == null || s === '') return null;
  const v = parseFloat(s);
  return isNaN(v) ? null : v;
}

/* Tila tarkistetaan ja aikaraja on koko haulle (api/_haku.js). */
async function fetchText(url) {
  const v = await haeTeksti(url);
  if (v.tila !== 200) throw new HakuVirhe('HTTP ' + v.tila, v.tila);
  return v.runko;
}

