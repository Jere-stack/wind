/* FMI:N AALTOPOIJUT — merihavaintoja, ei ennustetta.
 *
 * Lahde: opendata.fmi.fi, tallennettu kysely
 * `fmi::observations::wave::multipointcoverage`. Kentat:
 *
 *   WaveHs     merkitseva aallonkorkeus, m
 *   ModalWDi   aallon suunta, astetta — MISTA pain (mitattu, ks. alla)
 *   WTP        aallon jakso, s
 *   TWATER     veden lampotila, °C
 *
 * (Viides kentta WHDD on suunnan hajonta. Se on jatetty pois: se ei
 * kerro kayttajalle mitaan sellaista jonka perusteella lahtisi vesille.)
 *
 * KOLME MITATTUA ASIAA JOTKA MAARAAVAT TAMAN TIEDOSTON MUODON
 *
 * 1. BBOX EI RAJAA. Mitattuna sama vastaus (10 asemaa, 62 829 tavua)
 *    bboxilla 24,5–25,5 / 59,9–60,3 ja ilman. Yksi haku kattaa siis
 *    KOKO MAAN, eika asemakohtaisia hakuja kannata tehda lainkaan
 *    tuoreimmalle lukemalle — ne olisivat kymmenen hakua yhden hinnalla.
 *    Siksi tama pystyy palvelemaan koko karttakerroksen yhdella pyynnolla.
 *
 * 2. VIIVE ON 57–117 MIN. Poijut raportoivat 30 min valein mutta
 *    aineisto tulee perille myohassa: mitattuna kuusi poijua olivat
 *    57, 87, 87, 87, 117 ja 57 minuuttia jaljessa. Siksi tuoreimman
 *    ikkuna on KUUSI TUNTIA eika kaksi: kolmen tunnin ikkunalla yksi
 *    asema kymmenesta putosi vastauksesta kokonaan (mitattu 9 vs 10).
 *    Ja siksi vastaus kertoo aina `ageMin` — kayttoliittyman on
 *    pystyttava sanomaan lukeman ika, ei esittaa sita nykyhetkena.
 *
 * 3. KAIKKI POIJUT EIVAT MITTAA AALTOJA. Mitattuna 30 h aineistosta
 *    Oulu Santapankki, Kalajoki Maakalla, Pori Kaijakari ja Hanko
 *    Langden antoivat aaltokorkeutta 0 %:ssa riveista mutta veden
 *    lampotilaa 45–50 %:ssa. Ne eivat ole rikki — ne ovat lampoasemia
 *    samassa kyselyssa. Siksi jokainen asema saa `kind`-kentan
 *    ('aalto' | 'lampo'), eika kayttoliittymalle jaa arvattavaksi
 *    kumpi on kyseessa.
 *
 * Vastaus on tarkoituksella "viimeisin EI-NaN rivi", ei viimeinen rivi:
 * sarjan hanta on lahes aina NaN:ia (ks. kohta 2).
 */
import https from 'https';

const WFS = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature'
  + '&storedquery_id=fmi::observations::wave::multipointcoverage';
const PARAMS = 'WaveHs,ModalWDi,WTP,TWATER';

/* Tuoreimman ikkuna: kuusi tuntia. Ks. kohta 2 ylla. */
const LATEST_HOURS = 6;
/* Historian katto on sama 7 vrk kuin FMI:n saahavainnoilla
   (api/fmi.js): kysely vastaa pidemmalle "Too long time interval". */
const HISTORY_MAX = 168;
const HISTORY_DEFAULT = 30;

function fetchUrl(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      var body = '';
      res.on('data', function (c) { body += c; });
      res.on('error', reject);
      res.on('end', function () { resolve(body); });
    }).on('error', reject);
  });
}

/* Aseman tiedot: `gml:id="point-<fmisid>"` … `<gml:pos>lat lng</gml:pos>`
   antaa sijainnin, ja `obsloc-fmisid-<fmisid>-pos` … `locationcode/name`
   nimen. Molemmat on sidottu FMISIDiin, joten niita ei tarvitse yhdistaa
   esiintymisjarjestyksen perusteella — jarjestykseen nojaava jasennys on
   juuri se joka menee rikki kun yksi asema on hiljaa. */
function parseStations(xml) {
  var asemat = {};
  var re = /gml:id="point-(\d+)"[\s\S]{0,400}?<gml:pos>([^<]+)<\/gml:pos>/g, m;
  while ((m = re.exec(xml)) !== null) {
    var c = m[2].trim().split(/\s+/);
    asemat[m[1]] = { fmisid: m[1], lat: parseFloat(c[0]), lng: parseFloat(c[1]), name: null };
  }
  var nre = /obsloc-fmisid-(\d+)-pos"[\s\S]{0,400}?locationcode\/name">([^<]+)</g;
  while ((m = nre.exec(xml)) !== null) {
    if (asemat[m[1]]) asemat[m[1]].name = m[2].trim();
  }
  return asemat;
}

/* Multipointcoverage: kaksi tekstilohkoa, "lat lng epoch" ja luvut
   riveittain. Sama muoto kuin api/fmi.js:ssa — ja samasta syysta:
   timevaluepair kirjoittaisi jokaisen arvon omaan XML-rakenteeseensa. */
function parseRows(xml) {
  var fields = [], fm, fre = /<swe:field\s+name="([^"]+)"/g;
  while ((fm = fre.exec(xml)) !== null) fields.push(fm[1]);
  var pm = /<gmlcov:positions>([\s\S]*?)<\/gmlcov:positions>/.exec(xml);
  var vm = /<gml:doubleOrNilReasonTupleList>([\s\S]*?)<\/gml:doubleOrNilReasonTupleList>/.exec(xml);
  if (!fields.length || !pm || !vm) return null;
  var pl = pm[1].trim().split('\n'), vl = vm[1].trim().split('\n');
  var out = {};
  for (var i = 0; i < pl.length && i < vl.length; i++) {
    var pc = pl[i].trim().split(/\s+/);
    if (pc.length < 3) continue;
    var sec = parseInt(pc[2], 10);
    if (isNaN(sec)) continue;
    /* Avain on koordinaatti nelilla desimaalilla — samat luvut kuin
       <gml:pos>issa, mutta pyoristettyna sen varalta etta lohkot
       kirjoitetaan eri tarkkuudella. */
    var avain = parseFloat(pc[0]).toFixed(4) + ',' + parseFloat(pc[1]).toFixed(4);
    if (!out[avain]) out[avain] = [];
    out[avain].push({ ms: sec * 1000, v: vl[i].trim().split(/\s+/).map(parseFloat) });
  }
  return { fields: fields, byPos: out };
}

/* HH:MM pyydetyssa vyohykkeessa — Intl, ei kasin kirjoitettua
   kesaaikasaantoa (sama ratkaisu kuin api/fmi.js ja api/harmonie.js). */
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

function num(x) { return (x == null || isNaN(x)) ? null : x; }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var fmisid = /^\d{4,7}$/.test(req.query.fmisid || '') ? req.query.fmisid : null;

  try {
    if (isHistory) {
      if (!fmisid) return res.status(400).json({ error: 'fmisid required' });
      var hours = Math.max(1, Math.min(HISTORY_MAX,
        parseInt(req.query.hours, 10) || HISTORY_DEFAULT));
      /* Yli kolmen vuorokauden jaksoilla askel harvennetaan tunniksi:
         mitattuna 7 vrk on 30 min:n askeleella 33,6 kt ja tunnin
         askeleella 19,8 kt, ja kaavio piirtaa joka tapauksessa
         enintaan muutaman sadan pisteen. */
      var step = hours > 72 ? 60 : 30;
      var start = new Date(Date.now() - hours * 3600000).toISOString().slice(0, 19) + 'Z';
      var hx = await fetchUrl(WFS + '&parameters=' + PARAMS + '&timestep=' + step
        + '&fmisid=' + fmisid + '&starttime=' + start);
      res.setHeader('Cache-Control', 'public, s-maxage=600, stale-while-revalidate=120');
      return res.status(200).json(buildHistory(hx, fmisid, tz));
    }

    var startL = new Date(Date.now() - LATEST_HOURS * 3600000).toISOString().slice(0, 19) + 'Z';
    var xml = await fetchUrl(WFS + '&parameters=' + PARAMS + '&timestep=30&starttime=' + startL);
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
    return res.status(200).json(buildLatest(xml, tz));
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

function buildLatest(xml, tz) {
  var asemat = parseStations(xml);
  var mp = parseRows(xml);
  if (!mp) return { stations: [] };
  var iHs = mp.fields.indexOf('WaveHs'), iDi = mp.fields.indexOf('ModalWDi');
  var iTp = mp.fields.indexOf('WTP'), iTw = mp.fields.indexOf('TWATER');
  var out = [];
  for (var id in asemat) {
    var a = asemat[id];
    var rows = mp.byPos[a.lat.toFixed(4) + ',' + a.lng.toFixed(4)];
    if (!rows || !rows.length) continue;
    /* Viimeisin EI-NaN rivi kullekin suureelle erikseen: aaltokorkeus
       ja lampotila katoavat eri hetkina, eika toisen puuttuminen saa
       piilottaa toista. */
    var hs = null, di = null, tp = null, tw = null, hsMs = null, twMs = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      var v = rows[i].v;
      if (hs === null && iHs >= 0 && !isNaN(v[iHs])) {
        hs = v[iHs]; hsMs = rows[i].ms;
        di = num(iDi >= 0 ? v[iDi] : null);
        tp = num(iTp >= 0 ? v[iTp] : null);
      }
      if (tw === null && iTw >= 0 && !isNaN(v[iTw])) { tw = v[iTw]; twMs = rows[i].ms; }
      if (hs !== null && tw !== null) break;
    }
    /* Aaltopoiju vai lampoasema: ratkaisee onko ikkunassa yhtaan
       aaltolukemaa. Ks. tiedoston alun kohta 3. */
    var laji = hs !== null ? 'aalto' : 'lampo';
    var ms = hsMs != null ? hsMs : twMs;
    if (ms == null) continue;
    out.push({
      fmisid: a.fmisid, station: a.name || ('FMISID ' + a.fmisid),
      lat: a.lat, lng: a.lng, kind: laji,
      hs: hs, hdir: di, tp: tp, tw: tw,
      time: hhmm(ms, tz), lastIso: new Date(ms).toISOString(),
      ageMin: Math.round((Date.now() - ms) / 60000),
      twAgeMin: twMs != null ? Math.round((Date.now() - twMs) / 60000) : null,
    });
  }
  out.sort(function (x, y) { return x.lat - y.lat; });
  return { stations: out };
}

function buildHistory(xml, fmisid, tz) {
  var asemat = parseStations(xml);
  var a = asemat[fmisid];
  var mp = parseRows(xml);
  var tyhja = { error: 'no data', fmisid: fmisid,
    station: a ? a.name : null, hs: [], tp: [], tw: [] };
  if (!a || !mp) return tyhja;
  var rows = mp.byPos[a.lat.toFixed(4) + ',' + a.lng.toFixed(4)];
  if (!rows || !rows.length) return tyhja;
  var iHs = mp.fields.indexOf('WaveHs'), iDi = mp.fields.indexOf('ModalWDi');
  var iTp = mp.fields.indexOf('WTP'), iTw = mp.fields.indexOf('TWATER');
  var hs = [], tp = [], tw = [], viimeMs = null;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
    if (iHs >= 0 && !isNaN(r.v[iHs])) {
      /* `d` on suunta samassa pistemuodossa kuin api/fmi.js:n
         tuulisarjassa, jolloin kaavion tooltip osaa piirtaa nuolen
         ilman omaa haaraa. */
      hs.push({ t: t, v: r.v[iHs], d: (iDi >= 0 && !isNaN(r.v[iDi])) ? r.v[iDi] : null, iso: iso });
      viimeMs = r.ms;
    }
    if (iTp >= 0 && !isNaN(r.v[iTp])) tp.push({ t: t, v: r.v[iTp], iso: iso });
    if (iTw >= 0 && !isNaN(r.v[iTw])) tw.push({ t: t, v: r.v[iTw], iso: iso });
  }
  if (!hs.length && !tw.length) return tyhja;
  if (viimeMs == null && tw.length) viimeMs = Date.parse(tw[tw.length - 1].iso);
  return {
    fmisid: fmisid, station: a.name, lat: a.lat, lng: a.lng,
    kind: hs.length ? 'aalto' : 'lampo',
    hs: hs, tp: tp, tw: tw,
    lastIso: new Date(viimeMs).toISOString(),
    ageMin: Math.round((Date.now() - viimeMs) / 60000),
  };
}
