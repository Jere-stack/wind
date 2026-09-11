/* VEDENKORKEUS — mareografien havainto ja FMI:n 48 h ennuste.
 *
 * Suomessa ei ole vuorovetta, joten tata lukua ei ole yhdessakaan
 * kansainvalisessa saaappissa. Se ei tarkoita ettei se liikkuisi.
 * Mitattuna Helsinki Kaivopuisto, 28 vrk, 673 tuntinaytetta:
 *
 *   matalin       -13,1 cm      korkein       +42,8 cm
 *   vaihteluvali   55,9 cm      keskihajonta   10,7 cm
 *   suurin muutos 6 h  32,9 cm  suurin muutos 24 h  41,3 cm
 *
 * Kolmannes metria kuudessa tunnissa on matalalla hiekkarannalla
 * (Haukilahti, Kallahti, Silversand) se ero jolla foili joko irtoaa
 * pohjasta tai ei.
 *
 * KAKSI TILAA, KAKSI OSOITETTA
 *
 *   ?asemat=1        kaikki 14 mareografia YHDELLA kutsulla
 *   ?lat=&lng=&tz=   ennuste yhteen pisteeseen, 48 h, tuntiaskel
 *
 * Havainto on omassa osoitteessaan tarkoituksella: sen vastaus on sama
 * riippumatta siita mita spottia katsotaan, joten jaettuna se on yksi
 * valimuistiosuma eika yksi kutsu spottia kohti. Sama ratkaisu kuin
 * aaltopoijuilla (api/aallot.js), ja samasta mitatusta syysta.
 *
 * ANSA JOKA ON PAKKO MUISTAA: HAVAINTO ON mm, ENNUSTE ON cm.
 * ------------------------------------------------------------------
 * Vastaus-XML EI kerro yksikkoa kummassakaan — `uom`-attribuutti
 * puuttuu. Yksikko on metatietopalvelussa:
 *
 *   /meta?observableProperty=observation&param=SeaLevel  ->  uom="mm"
 *   /meta?observableProperty=forecast&param=SeaLevel     ->  uom="cm"
 *
 * Sama fysikaalinen suure, kertoimen 10 ero, ja molemmat palauttavat
 * kolminumeroisia kelvollisen nakoisia lukuja. Ensimmainen mittaus
 * laski 28 vrk vaihteluvaliksi 559 cm — Helsinkiin ennatystulvan — eika
 * mikaan huutanut. Ristiintarkistus joka sen paljasti:
 *
 *   havainto 2026-09-11T10:00Z   286 mm = 28,6 cm
 *   ennuste  2026-09-11T11:00Z    29,0 cm
 *
 * Sarja on jatkuva vasta kun havainto jaetaan kymmenella. TAMA PROXY
 * PALAUTTAA AINA SENTTIMETREJA, jotta yksikko ratkaistaan kerran eika
 * jokaisessa kayttopaikassa uudelleen.
 *
 * MIKSI VAIN TEOREETTINEN KESKIVESI. Molemmissa on rinnalla myos
 * N2000-korkeusjarjestelma (WLEVN2K / SeaLevelN2000). Se on jatetty
 * pois: "vedenkorkeus" tarkoittaa suomalaisessa saapuheessa nollatasona
 * teoreettista keskivetta, ja kaksi nollatasoa samassa ruudussa on kaksi
 * merkitysta samalle numerolle. Yksi luku, yksi merkitys.
 *
 * MUUT MITATUT RAJAT
 *  - Havaintokysely rajaa 168 h kerrallaan ("Too long time interval
 *    requested! No more than 168.000000 hours allowed"). Tama hakee
 *    vain tuoreimman, joten raja ei tule vastaan.
 *  - Vastauksen koko on ~19 kB riippumatta ikkunasta: asemien metatiedot
 *    hallitsevat. 60 min ikkuna 30 min askeleella on 19,9 kB ja antaa
 *    kaksi naytetta asemaa kohti, eli tuoreimman valintaan jaa varaa.
 *  - Sama kysely palauttaa TW:n eli VEDENLAMMON samassa vastauksessa.
 *    Se on ilmainen lisa: 14 rannikkoasemaa ymparivuotisesti, siella
 *    missa UiRaS-asemaa ei ole (Hanko, Emasalo, Turku, Foglo).
 */
import https from 'https';

const WFS = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature';
const HAVAINTO = WFS + '&storedquery_id=fmi::observations::mareograph::instant::multipointcoverage';
const ENNUSTE  = WFS + '&storedquery_id=fmi::forecast::sealevel::point::timevaluepair';

/* Ikkuna ja askel: ks. tiedoston alun mitatut rajat. */
const IKKUNA_MIN = 60;
const ASKEL_MIN = 30;
/* Ennusteen pituus. Malli antaa 48 h; ylimaara olisi pelkkaa NaN:ia. */
const ENNUSTE_H = 48;

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

var _muotoilijat = {};
function toLocal(iso, tz) {
  var f = _muotoilijat[tz];
  if (!f) {
    f = _muotoilijat[tz] = new Intl.DateTimeFormat('sv-SE', {
      timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hour12: false
    });
  }
  return f.format(new Date(iso)).replace(' ', 'T');
}
function kelpoTz(tz) {
  if (!tz) return null;
  try { new Intl.DateTimeFormat('sv-SE', { timeZone: tz }); return tz; } catch (e) { return null; }
}

/* Asemat FMISIDin kautta, ei esiintymisjarjestyksen — sama ratkaisu ja
   sama syy kuin api/aallot.js:ssa: jarjestys menee rikki heti kun yksi
   asema on hiljaa. */
function parseStations(xml) {
  var asemat = {}, m;
  var re = /gml:id="point-(\d+)"[\s\S]{0,400}?<gml:pos>([^<]+)<\/gml:pos>/g;
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

/* Multipointcoverage: "lat lng epoch" -rivit ja lukurivit rinnakkain.
   Kenttajarjestys luetaan <swe:field>ista eika oleteta — parametrilista
   voi vaihtua, ja jarjestykseen nojaava jasennys vaihtaisi silloin
   vedenkorkeuden ja lampotilan keskenaan hiljaa. */
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
    var avain = parseFloat(pc[0]).toFixed(4) + ',' + parseFloat(pc[1]).toFixed(4);
    if (!out[avain]) out[avain] = [];
    out[avain].push({ ms: sec * 1000, v: vl[i].trim().split(/\s+/).map(parseFloat) });
  }
  return { fields: fields, byPos: out };
}

function haeAsemat(xml, tz) {
  var asemat = parseStations(xml);
  var mp = parseRows(xml);
  if (!mp) return [];
  var iWl = mp.fields.indexOf('WATLEV');
  var iTw = mp.fields.indexOf('TW');
  var out = [];
  for (var id in asemat) {
    var a = asemat[id];
    var rows = mp.byPos[a.lat.toFixed(4) + ',' + a.lng.toFixed(4)];
    if (!rows || !rows.length) continue;
    /* Viimeisin EI-NaN kummallekin suureelle erikseen: vedenkorkeus ja
       vedenlampo katoavat eri hetkina, eika toisen puuttuminen saa
       piilottaa toista. Sama sääntö kuin aaltopoijuilla. */
    var cm = null, tw = null, wlMs = null, twMs = null;
    for (var i = rows.length - 1; i >= 0; i--) {
      var v = rows[i].v;
      if (cm === null && iWl >= 0 && !isNaN(v[iWl])) {
        /* mm -> cm. Ks. tiedoston alun ansa. */
        cm = Math.round(v[iWl]) / 10;
        wlMs = rows[i].ms;
      }
      if (tw === null && iTw >= 0 && !isNaN(v[iTw])) { tw = v[iTw]; twMs = rows[i].ms; }
      if (cm !== null && tw !== null) break;
    }
    var ms = wlMs != null ? wlMs : twMs;
    if (ms == null) continue;
    out.push({
      fmisid: a.fmisid, station: a.name || ('FMISID ' + a.fmisid),
      lat: a.lat, lng: a.lng,
      cm: cm, tw: tw,
      aika: toLocal(new Date(ms).toISOString(), tz),
      lastIso: new Date(ms).toISOString(),
      ageMin: Math.round((Date.now() - ms) / 60000),
      twAgeMin: twMs != null ? Math.round((Date.now() - twMs) / 60000) : null
    });
  }
  out.sort(function (x, y) { return x.lat - y.lat; });
  return out;
}

function parseEnnuste(xml, tz) {
  /* Vastauksessa on kaksi sarjaa: SeaLevel (teoreettinen keskivesi) ja
     SeaLevelN2000. Otetaan EDELLINEN — ks. tiedoston alku. Sarja
     poimitaan nimella eika jarjestyksella, jottei N2000 paady tanne jos
     palvelin joskus kirjoittaa ne toisin pain. */
  var lohkot = xml.split(/(?=<wml2:MeasurementTimeseries )/);
  var valittu = null;
  for (var i = 1; i < lohkot.length; i++) {
    var nm = /gml:id="([^"]+)"/.exec(lohkot[i]);
    if (!nm) continue;
    var nimi = nm[1].replace(/^mts-\d+-\d+-/, '');
    if (nimi === 'SeaLevel') { valittu = lohkot[i]; break; }
  }
  if (!valittu) return null;
  var time = [], cm = [], m;
  var re = /<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]*)<\/wml2:value>/g;
  while ((m = re.exec(valittu)) !== null) {
    var v = parseFloat(m[2]);
    if (isNaN(v)) continue;
    time.push(toLocal(m[1], tz));
    cm.push(v);   /* ennuste on jo cm */
  }
  return time.length ? { time: time, cm: cm } : null;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';

  try {
    if (req.query.asemat) {
      /* Havainto paivittyy minuutin valein mutta sita ei lueta sen
         tarkemmin: viisi minuuttia on sama katto kuin FMI-havainnoilla. */
      res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
      var st = new Date(Date.now() - IKKUNA_MIN * 60000).toISOString().slice(0, 17) + '00Z';
      var xml = await fetchUrl(HAVAINTO + '&starttime=' + st
        + '&timestep=' + ASKEL_MIN + '&parameters=WATLEV,TW');
      return res.status(200).json({ stations: haeAsemat(xml, tz) });
    }

    var lat = parseFloat(req.query.lat);
    var lng = parseFloat(req.query.lng);
    if (isNaN(lat) || isNaN(lng)) {
      return res.status(400).json({ error: 'lat/lng or asemat=1 required' });
    }
    /* Ennustemalli ajetaan muutaman tunnin valein — tunnin valimuisti ei
       vanhene kayttajan silmissa. */
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
    /* KULUVAN TUNNIN ALKU, EI NYT-HETKI. Ilman `starttime`a kysely
       aloittaa nyt-hetkesta ja ensimmainen tuntiaskel osuu SEURAAVAAN
       tasatuntiin — kuluva tunti puuttuu sarjasta kokonaan. Mitattuna
       klo 12:22 UTC: ilman starttimea eka piste 13:00 = 33 cm,
       starttimen kanssa eka piste 12:00 = 31 cm (n=49, NaN=0).
       Spottikortti katsoo oletuksena kuluvaa tuntia, joten ilman tata
       ennusterivi oli tyhja juuri siina tilanteessa jossa sita
       katsotaan useimmin. */
    var alku  = new Date(Date.now()).toISOString().slice(0, 14) + '00:00Z';
    var loppu = new Date(Date.now() + ENNUSTE_H * 3600000).toISOString().slice(0, 14) + '00:00Z';
    var exml = await fetchUrl(ENNUSTE + '&latlon=' + lat.toFixed(4) + ',' + lng.toFixed(4)
      + '&timestep=60&starttime=' + alku + '&endtime=' + loppu);
    var e = parseEnnuste(exml, tz);
    if (!e) return res.status(200).json({ error: 'no data', lat: lat, lng: lng, time: [] });
    return res.status(200).json({ lat: lat, lng: lng, tz: tz, time: e.time, cm: e.cm });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
