import https from 'https';

/* FMI HARMONIE 2.5km + Open-Meteo jatko
   - HARMONIE: 2 vrk historiaa + 2 vrk ennustetta
   - Open-Meteo: jatkaa siita eteenpain 14 vrk (16 vrk yhteensa) */

const OM_URL = 'https://api.open-meteo.com/v1/forecast';

function fetchHarmonieXml(lat, lng) {
  return new Promise(function(resolve, reject) {
    var now = new Date();
    var start = new Date(now.getTime() - 48*3600000).toISOString().slice(0,16) + 'Z';
    var end   = new Date(now.getTime() + 48*3600000).toISOString().slice(0,16) + 'Z';
    var url = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0'
      + '&request=getFeature'
      + '&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair'
      + '&latlon=' + lat + ',' + lng
      + '&parameters=WindSpeedMS,WindDirection,WindGust,Temperature,WeatherSymbol3,TotalCloudCover'
      + '&timestep=60'
      + '&starttime=' + start
      + '&endtime=' + end;
    https.get(url, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('error', reject);
      res.on('end', function() { resolve(body); });
    }).on('error', reject);
  });
}

function fetchOM(lat, lng) {
  return new Promise(function(resolve, reject) {
    var url = OM_URL + '?latitude=' + lat + '&longitude=' + lng
      + '&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m,temperature_2m,weather_code,cloud_cover'
      + '&wind_speed_unit=ms&timezone=auto&forecast_days=16';
    https.get(url, function(res) {
      var body = '';
      res.on('data', function(c) { body += c; });
      res.on('error', reject);
      res.on('end', function() { resolve(JSON.parse(body)); });
    }).on('error', reject);
  });
}

function isDst(d) {
  var mar = new Date(d.getFullYear(), 2, 31);
  mar.setDate(31 - mar.getDay());
  var oct = new Date(d.getFullYear(), 9, 31);
  oct.setDate(31 - oct.getDay());
  return d >= mar && d < oct;
}

function toLocal(iso) {
  var d = new Date(iso);
  d = new Date(d.getTime() + (isDst(d) ? 3 : 2) * 3600000);
  return d.toISOString().slice(0, 16);
}

/* Parsii jokaisen parametrin aika->arvo -kartaksi. NaN sailytetaan null:na,
   jotta parametrit voidaan myohemmin kohdistaa SAMALLE aika-akselille.
   Aiemmin NaN-arvot pudotettiin tasta suoraan, jolloin eri parametrien
   taulukoista tuli ERIPITUISIA ja ne liukuivat toistensa suhteen -- esim.
   weather_code palasi 365-alkioisena kun muut olivat 366, eli saasymboli
   naytettiin vaaralle tunnille. */
function parseHarmonie(xml) {
  var series = {};
  var re = /gml:id="[^"]*-([a-zA-Z0-9]+)"[\s\S]*?(<wml2:point[\s\S]*?<\/wml2:MeasurementTimeseries>)/g;
  var m;
  while ((m = re.exec(xml)) !== null) {
    var param = m[1].toLowerCase();
    var block = m[2];
    var map = {}, times = [], any = false;
    var tvRe = /<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]+)<\/wml2:value>/g;
    var tv;
    while ((tv = tvRe.exec(block)) !== null) {
      var v = parseFloat(tv[2]);
      times.push(tv[1]);
      if (isNaN(v)) { map[tv[1]] = null; }
      else { map[tv[1]] = v; any = true; }
    }
    if (any) series[param] = { map: map, times: times };
  }
  return series;
}

/* FMI WeatherSymbol3 -> WMO weather code.
   HARMONIE palauttaa FMI:n OMAA symboliasteikkoa (1 = selkeaa, 2 = puoli-
   pilvista, 3 = pilvista, 21- kuuroja, 31- vesisadetta, ...), kun taas
   Open-Meteo -jatko kayttaa WMO-koodeja. Ilman muunnosta sama taulukko
   sisaltaisi kahta eri asteikkoa, ja koodit menisivat pahasti ristiin:
   esim. FMI 51 = heikkoa LUMISADETTA mutta WMO 51 = heikkoa TIHKUA.
   Muunnetaan siis HARMONIE-osa WMO:ksi, jolloin koko sarja on yhta asteikkoa.

   Asteikko on ristiintarkistettu HARMONIE:n omaa TotalCloudCover- ja
   Precipitation1h-dataa vastaan (8 pistetta, 60 h): symboli 1 -> pilvisyys
   ka 8 %, 2 -> 56 %, 3 -> 92 %; 31/32/33 -> sade 0.17 / 1.1 / 4.5 mm/h. */
var FMI_SYMBOL_TO_WMO = {
  1: 0,   2: 2,   3: 3,                    /* selkeaa / puolipilvista / pilvista */
  21: 80, 22: 81, 23: 82,                  /* sadekuurot */
  31: 61, 32: 63, 33: 65,                  /* vesisade */
  41: 85, 42: 85, 43: 86,                  /* lumikuurot */
  51: 71, 52: 73, 53: 75,                  /* lumisade */
  61: 95, 62: 95, 63: 95, 64: 96,          /* ukkonen */
  71: 83, 72: 83, 73: 84,                  /* rantakuurot */
  81: 68, 82: 68, 83: 69,                  /* rantasade */
  91: 45, 92: 45                           /* utu / sumu */
};
function fmiSymbolToWmo(v) {
  if (v == null) return null;
  var w = FMI_SYMBOL_TO_WMO[Math.round(v)];
  return w === undefined ? null : w;
}

/* Yhden pisteen haku. Erotettu handlerista, jotta sama logiikka palvelee
   seka yhta pistetta etta eraa — eraversio on se joka poistaa mobiilin
   kierrosajan pullonkaulan. */
function _vastaus(status, body) { return { _status: status, body: body }; }

async function haePiste(lat, lng) {
  try {
    /* Hae HARMONIE ja Open-Meteo rinnakkain */
    var results = await Promise.allSettled([
      fetchHarmonieXml(lat.toFixed(4), lng.toFixed(4)),
      fetchOM(lat.toFixed(4), lng.toFixed(4))
    ]);

    var xmlResult = results[0];
    var omResult  = results[1];

    if (xmlResult.status !== 'fulfilled' || !xmlResult.value || xmlResult.value.length < 500) {
      /* HARMONIE ei saatavilla -- palautetaan Open-Meteo sellaisenaan */
      if (omResult.status === 'fulfilled' && omResult.value.hourly) {
        var oh = omResult.value.hourly;
        return _vastaus(200, {
          source: 'Open-Meteo fallback',
          harmonie_hours: 0,
          hourly: {
            time:              oh.time,
            windspeed_10m:     oh.wind_speed_10m,
            winddirection_10m: oh.wind_direction_10m,
            windgusts_10m:     oh.wind_gusts_10m,
            temperature_2m:    oh.temperature_2m,
            weather_code:      oh.weather_code,
            cloudcover:        oh.cloud_cover,
          }
        });
      }
      return _vastaus(502, { error: 'both sources failed' });
    }

    /* Parsitaan HARMONIE */
    var series = parseHarmonie(xmlResult.value);
    var keys = Object.keys(series);
    var wsKey = keys.find(function(k){ return k.includes('windspeedms'); });
    var wdKey = keys.find(function(k){ return k.includes('winddirection'); });
    var wgKey = keys.find(function(k){ return k.includes('windgust'); });
    var tKey  = keys.find(function(k){ return k.includes('temperature'); });
    var wxKey = keys.find(function(k){ return k.includes('weathersymbol'); });
    var ccKey = keys.find(function(k){ return k.includes('totalcloudcover'); });

    if (!wsKey || !series[wsKey].times.length) {
      return _vastaus(200, { error: 'no wind data', debug_keys: keys });
    }

    /* Yhteinen aika-akseli: tuulennopeuden ne hetket joilla on arvo.
       Kaikki muut parametrit poimitaan TAMAN akselin mukaan aikaleiman
       perusteella, ei jarjestysnumerolla -- silloin yhden parametrin
       puuttuva arvo ei enaa siirra muita. */
    var axis = series[wsKey].times.filter(function(t){ return series[wsKey].map[t] != null; });
    function pick(key, xform) {
      if (!key) return null;
      var s = series[key];
      return axis.map(function(t){
        var v = (t in s.map) ? s.map[t] : null;
        return (v != null && xform) ? xform(v) : v;
      });
    }
    var hTimes = axis.map(toLocal);
    var hWs    = pick(wsKey);
    var hWd    = wdKey ? pick(wdKey) : hWs.map(function(){ return 0; });
    var hWg    = wgKey ? pick(wgKey) : hWs.slice();
    var hT     = pick(tKey);
    var hWx    = wxKey ? pick(wxKey, fmiSymbolToWmo) : null;
    var hCc    = pick(ccKey);

    /* Jos Open-Meteo saatavilla, liitetaan se HARMONIE:n peraan */
    if (omResult.status === 'fulfilled' && omResult.value.hourly) {
      var oh = omResult.value.hourly;
      /* Loyda HARMONIE:n viimeinen aika -- Open-Meteo alkaa siita */
      var harmLastTime = hTimes[hTimes.length - 1];
      var spliceIdx = -1;
      if (oh.time && harmLastTime) {
        for (var i = 0; i < oh.time.length; i++) {
          /* Muunna Open-Meteo aika samaan muotoon (trimmaa sekunnit) */
          var omT = oh.time[i].slice(0, 16);
          if (omT > harmLastTime) { spliceIdx = i; break; }
        }
      }
      if (spliceIdx >= 0) {
        var omTail = oh.time.slice(spliceIdx).map(function(t){ return t.slice(0,16); });
        hTimes = hTimes.concat(omTail);
        hWs    = hWs.concat(oh.wind_speed_10m.slice(spliceIdx));
        hWd    = hWd.concat(oh.wind_direction_10m.slice(spliceIdx));
        hWg    = hWg.concat(oh.wind_gusts_10m.slice(spliceIdx));
        if (hT && oh.temperature_2m)   hT  = hT.concat(oh.temperature_2m.slice(spliceIdx));
        /* Open-Meteo on jo WMO-asteikolla, HARMONIE-osa muunnettiin siihen */
        if (hWx && oh.weather_code)    hWx = hWx.concat(oh.weather_code.slice(spliceIdx));
        if (hCc && oh.cloud_cover)     hCc = hCc.concat(oh.cloud_cover.slice(spliceIdx));
      }
    }

    return _vastaus(200, {
      source:  'FMI HARMONIE 2.5km + Open-Meteo',
      /* Montako ensimmaista alkiota on FMI HARMONIE:a -- loput Open-Meteo:a.
         Frontend voi kertoa kayttajalle kumpi lahde on kyseessa. */
      harmonie_hours: axis.length,
      hourly:  {
        time:              hTimes,
        windspeed_10m:     hWs,
        winddirection_10m: hWd,
        windgusts_10m:     hWg,
        temperature_2m:    hT,
        weather_code:      hWx,
        cloudcover:        hCc,
      }
    });
  } catch (err) {
    return _vastaus(500, { error: err.message });
  }
}

/* Rinnakkaisuuden rajoitin. FMI:n WFS ei pida sadasta yhtaikaisesta
   pyynnosta, ja funktion aikakatkaisu on 30 s — kuusi kerrallaan pitaa
   molemmat kurissa. */
async function poolMap(lista, raja, fn) {
  const ulos = new Array(lista.length);
  let i = 0;
  async function tyontekija() {
    while (i < lista.length) {
      const oma = i++;
      try { ulos[oma] = await fn(lista[oma], oma); }
      catch (e) { ulos[oma] = { error: String((e && e.message) || e) }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(raja, lista.length) }, tyontekija));
  return ulos;
}

/* Enintaan nain monta pistetta yhdessa pyynnossa. Yksi piste on noin 16 kt,
   joten 15 on noin 240 kt vastauksessa — iso mutta pakattuna kohtuullinen,
   ja isompi era ei juuri vahentaisi kierroksia mutta kasvattaisi
   aikakatkaisuriskia. */
const MAX_PISTEITA = 15;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');

  /* Erahaku: pts=lat,lng;lat,lng;...
     Vastaus on { results: [...] } samassa jarjestyksessa kuin pyydetyt
     pisteet. Yksittaisen pisteen virhe ei kaada eraa vaan nakyy sen omana
     alkiona, jotta yksi huono piste ei vie muita mukanaan. */
  if (req.query.pts) {
    const lista = String(req.query.pts).split(';')
      .map(function (s) { return s.split(','); })
      .filter(function (a) { return a.length === 2; })
      .map(function (a) { return { lat: parseFloat(a[0]), lng: parseFloat(a[1]) }; })
      .filter(function (p) { return !isNaN(p.lat) && !isNaN(p.lng); })
      .slice(0, MAX_PISTEITA);
    if (!lista.length) return res.status(400).json({ error: 'pts required' });
    try {
      const tulokset = await poolMap(lista, 6, function (p) {
        return haePiste(p.lat, p.lng)
          .then(function (r) { return r.body; })
          .catch(function (e) { return { error: String((e && e.message) || e) }; });
      });
      return res.status(200).json({ results: tulokset });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  /* Yhden pisteen muoto sailyy ennallaan: spottikortti ja havaintopolku
     kayttavat sita. */
  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'lat/lng required' });
  }
  try {
    const r = await haePiste(lat, lng);
    return res.status(r._status).json(r.body);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
