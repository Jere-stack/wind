/* LARU (Lauttasaari, Helsinki) — Lauttasaaren leijalautailijat ry:n
 * saaasema, mittari Nahkahousun saarella.
 *
 * Ei kuulu FMI:n havaintoverkkoon, joten oma proxy kuten Mellstenilla
 * ja Kruunuvuorenselalla. Lahde on dlarah.org:n tuulisivun oma
 * datahakemisto:
 *
 *   wind_data/stations.txt             "vuosi,vuodenpaiva" + asemalista
 *   wind_data/Laru_<vuosi>-<paiva>.txt yksi vuorokausi, ~2 min valein
 *
 * Paivatiedosto on ~20 kt ja kattaa koko vuorokauden, eli TAMA ASEMA
 * ANTAA HISTORIAA toisin kuin Mellsten (jonka ikkuna on 30 min).
 *
 * RIVIN MUOTO on luettu lahteen OMASTA jasentimesta
 * (`wind_data/history_graph.js`, funktio `parseData`), ei arvattu:
 *
 *   2026,9,8,13,6,13:05,183.5,5.4,6.7,7.7,0.0
 *   [0]  [1][2][3][4][5]  [6]  [7] [8] [9] [10]
 *   vuosi kk pv  h  ?  hh:mm suunta min  KA  max lampo
 *
 * Keskituuli on `fields[8]` eli KOLMAS tuuliluku — sama jarjestys kuin
 * Mellstenilla (min, ka, max). Varmistettu myos riippumatta
 * jasentimesta: min <= ka <= max piti 474/474 rivilla.
 *
 * `fields[3]` on tunti, ja lahteen oma jasennin korjaa sen avulla
 * keskiyon yli menevat rivit (`hour - checkHour > 20` -> edellinen
 * vuorokausi). Sama korjaus tehdaan tassa.
 *
 * `nan`-rivit ohitetaan, kuten lahteen jasennin tekee.
 *
 * ASEMALLA EI OLE LAMPOMITTARIA. Lampotilasarake on 0.0 JOKAISELLA
 * rivilla (474/474 mitattuna), ja Windgurun sama asema palauttaa
 * `"temperature": null`. Nolla ei siis ole lukema vaan puuttuva arvo —
 * se palautetaan nullina, ei asteina.
 *
 * LAHDE VAATII USER-AGENTIN: ilman sita se vastaa 403:lla (mitattu,
 * toistettava).
 *
 * SIJAINTI JA YKSIKKO on varmistettu Windgurun asemalta 47
 * ("Lauttasaari / Larukite", lat 60.150824, lon 24.87184, alt 7 m,
 * timezone Europe/Helsinki). Sama asema kolmella tavalla:
 *   - suunta tasmasi (173,9° taalla vs 173,5° siella, 2 min valissa)
 *   - nopeuksien suhde oli 1,94–2,07 eli SOLMUT/METRIT: Windguru antaa
 *     solmuja, tama lahde METREJA SEKUNNISSA
 *   - molemmat kertovat lampotilaksi "ei mittausta"
 */
import https from 'https';

const BASE = 'https://dlarah.org/wind_data/';
const ASEMA = 'Laru';
const STATION = { name: 'Helsinki Laru', place: 'laru', lat: 60.1508, lng: 24.8718 };
/* Lahde paivittyy noin kahden minuutin valein. */
const TTL_TUOREIN = 60;
const TTL_HISTORIA = 180;
const HISTORIA_OLETUS = 12;
const HISTORIA_MAX = 24;
/* Kaavio niputtaa noin sataankahteenkymmeneen pisteeseen, joten
   nelisensataa riittaa reilusti — ja pitaa JSONin kymmenissa
   kilotavuissa eika sadoissa. */
const PISTE_KATTO = 400;

/* USER-AGENT ON PAKOLLINEN. Mitattu ja toistettava: lahde vastaa
   403:lla kun otsaketta ei ole ja 200:lla kun se on. Noden `https.get`
   ei laheta sellaista oletuksena, joten ilman tata koko asema jaisi
   pysyvasti tyhjaksi — eika mikaan kertoisi miksi. (Eri asia kuin
   api/mellsten.js:n ohimeneva 403, joka toistui vain kerran.) */
const OTSAKKEET = {
  'user-agent': 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)',
  'accept': 'text/plain,*/*',
};

function fetchText(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, { headers: OTSAKKEET }, function (res) {
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
/* Yksi uusintayritys, sama perustelu kuin api/mellsten.js:ssa. */
async function fetchTextRetry(url) {
  try { return await fetchText(url); }
  catch (e) {
    await new Promise(function (r) { setTimeout(r, 400); });
    return fetchText(url);
  }
}

/* Helsingin poikkeama UTC:sta. Intl osaa kesaajan; poikkeama
   pyoristetaan taysiin minuutteihin, muuten muotoilun sekuntikatko
   jattaa millisekunnit aikaleimoihin. */
var _hkiFmt = null;
function helsinkiPoikkeamaMs(ms) {
  if (!_hkiFmt) {
    _hkiFmt = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Helsinki', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
    });
  }
  var s = _hkiFmt.format(new Date(ms));
  return Math.round((Date.parse(s.replace(' ', 'T') + 'Z') - ms) / 60000) * 60000;
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

function luku(x) {
  var v = parseFloat(x);
  return isFinite(v) ? v : null;
}

/* Rivit -> pisteet. Paivays tulee riviltä itseltaan (kentat 0–2), joten
   sita ei tarvitse paatella nykyhetkesta kuten Mellstenilla. */
function jasenna(teksti) {
  var ulos = [];
  var rivit = String(teksti).split('\n');
  for (var i = 0; i < rivit.length; i++) {
    var rivi = rivit[i];
    if (!rivi || rivi.indexOf('nan') >= 0) continue;   /* kuten lahteen oma jasennin */
    var f = rivi.split(',');
    if (f.length < 11) continue;
    var aika = f[5].indexOf('T') > 0 ? f[5].split('T')[1] : f[5];
    var osat = /^\s*(\d{1,2}):(\d{2})/.exec(aika);
    if (!osat) continue;
    var y = parseInt(f[0], 10), mo = parseInt(f[1], 10), d = parseInt(f[2], 10);
    var checkHour = parseInt(f[3], 10);
    var hh = parseInt(osat[1], 10), mm = parseInt(osat[2], 10);
    if (!isFinite(y) || !isFinite(mo) || !isFinite(d) || !isFinite(hh)) continue;
    /* Sama korjaus kuin lahteen jasentimessa: kellonaika voi olla
       edelliselta vuorokaudelta. */
    var paivaSiirto = 0;
    if (isFinite(checkHour) && hh - checkHour > 20) paivaSiirto = -1;
    var seina = Date.UTC(y, mo - 1, d + paivaSiirto, hh, mm, 0, 0);
    var ms = seina - helsinkiPoikkeamaMs(seina);
    var ws = luku(f[8]);
    if (ws == null) continue;
    ulos.push({
      ms: ms,
      wd: luku(f[6]), wsMin: luku(f[7]), ws: ws, wg: luku(f[9]),
    });
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Harvennus joka SAILYTTAA PUUSKAT. Tasavalinen poiminta pudottaisi
   juuri ne rivit joissa puuska on, ja kaavion puuskavyohyke kutistuisi
   ilman etta tuuli olisi muuttunut. Niputuksessa keskituuli on
   keskiarvo ja puuska on nipun MAKSIMI — sama sopimus jolla
   kayttoliittyman oma `_havNiputa` niputtaa. */
function niputa(rivit, katto) {
  if (rivit.length <= katto) return rivit;
  var koko = Math.ceil(rivit.length / katto);
  var ulos = [];
  for (var i = 0; i < rivit.length; i += koko) {
    var nippu = rivit.slice(i, i + koko);
    var summa = 0, n = 0, maxG = null, vahvin = nippu[0];
    for (var j = 0; j < nippu.length; j++) {
      summa += nippu[j].ws; n++;
      if (nippu[j].wg != null && (maxG == null || nippu[j].wg > maxG)) maxG = nippu[j].wg;
      if (nippu[j].ws > vahvin.ws) vahvin = nippu[j];
    }
    ulos.push({
      /* Aikaleima nipun VIIMEISESTA rivista: sarjan viimeinen piste on
         silloin oikeasti tuorein havainto eika nipun keskikohta. */
      ms: nippu[nippu.length - 1].ms,
      ws: summa / n,
      wg: maxG,
      /* Suunta vahvimmasta naytteesta: keskiarvo hyppaa 0/360 rajalla
         vaaraan suuntaan, ja kovin hetki on se joka kiinnostaa. */
      wd: vahvin.wd,
      wsMin: nippu[0].wsMin,
    });
  }
  return ulos;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var nyt = Date.now();

  try {
    /* Paivatiedoston nimi tulee lahteen OMASTA luettelosta, ei
       laskemalla: `stations.txt`:n ensimmainen rivi on "vuosi,paiva"
       sen mukaan mika on lahteen mielesta kuluva vuorokausi. Itse
       laskettu vuodenpaiva menisi pieleen juuri keskiyon molemmin
       puolin, ja silloin vastaus olisi 404. */
    var luettelo = await fetchTextRetry(BASE + 'stations.txt');
    var eka = String(luettelo).split('\n')[0].split(',');
    var vuosi = parseInt(eka[0], 10), paiva = parseInt(eka[1], 10);
    if (!isFinite(vuosi) || !isFinite(paiva)) {
      return res.status(502).json({ error: 'stations.txt', station: STATION.name, place: STATION.place });
    }

    var teksti = await fetchTextRetry(BASE + ASEMA + '_' + vuosi + '-' + paiva + '.txt');
    var rivit = jasenna(teksti);
    if (!rivit.length) {
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }
    var v = rivit[rivit.length - 1];

    var runko = {
      station: STATION.name, place: STATION.place,
      lat: STATION.lat, lng: STATION.lng,
      ws: v.ws, wd: v.wd, wg: v.wg, wsMin: v.wsMin,
      /* EI LAMPOTILAA. Sarake on nolla joka rivilla eika asemalla ole
         mittaria; nolla asteena olisi keksitty lukema. */
      tmp: null, lampomittari: false,
      time: hhmm(v.ms, tz),
      lastIso: new Date(v.ms).toISOString(),
      ageMin: Math.round((nyt - v.ms) / 60000),
    };

    if (!isHistory) {
      res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_TUOREIN + ', stale-while-revalidate=60');
      return res.status(200).json(runko);
    }

    var tunnit = Math.max(1, Math.min(HISTORIA_MAX,
      parseInt(req.query.hours, 10) || HISTORIA_OLETUS));
    var raja = v.ms - tunnit * 3600000;
    var ikkuna = niputa(rivit.filter(function (r) { return r.ms >= raja; }), PISTE_KATTO);
    /* SARJAN VIIMEINEN PISTE ON TUOREIN HAVAINTO, EI NIPUN KESKIARVO.
       Kortin iso luku on `latest`, ja kaavion oikea reuna on suoraan sen
       alla — jos ne eroavat, ero nayttaa vialta vaikka molemmat ovat
       oikein omalla tavallaan. Niputus koskee siis historiaa, ei
       nykyhetkea. */
    if (ikkuna.length && ikkuna[ikkuna.length - 1].ws !== v.ws) {
      ikkuna = ikkuna.slice(0, -1).concat([v]);
    }

    var ws = [], wg = [];
    for (var i = 0; i < ikkuna.length; i++) {
      var r = ikkuna[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
      ws.push({ t: t, v: r.ws, d: r.wd, iso: iso });
      wg.push({ t: t, v: r.wg != null ? r.wg : r.ws, iso: iso });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_HISTORIA + ', stale-while-revalidate=60');
    runko.ws = ws; runko.wg = wg;
    /* `ta` on tyhja taulukko eika puuttuva kentta: kayttoliittyma
       osaa piirtaa ilman lampokayraa, mutta `undefined` nayttaisi
       vialta. */
    runko.ta = [];
    runko.ikkunaMin = Math.round((ikkuna[ikkuna.length - 1].ms - ikkuna[0].ms) / 60000);
    runko.pisteita = ikkuna.length;
    runko.latest = {
      ws: v.ws, wd: v.wd, wg: v.wg, tmp: null,
      time: hhmm(v.ms, tz), lastIso: new Date(v.ms).toISOString(),
      ageMin: Math.round((nyt - v.ms) / 60000),
    };
    return res.status(200).json(runko);
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
