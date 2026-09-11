/* FMI WAM — AALTOENNUSTE PISTEESEEN.
 *
 * Lahde: opendata.fmi.fi, tallennettu kysely
 * `fmi::forecast::wam::point::timevaluepair`. Sarjat:
 *
 *   SigWaveHeight   merkitseva aallonkorkeus, m
 *   WavePeriod      aallon jakso, s
 *   WaveDirection   aallon suunta, astetta — MISTA pain (mitattu, ks. alla)
 *
 * TAMA ON ENNUSTE. `api/aallot.js` on HAVAINTO kymmenesta poijusta.
 * Ne eivat ole sama asia eivatka saa nayttaa samalta: poiju kertoo mita
 * juuri nyt on (ja sanoo lukemansa ian), tama kertoo mita tulee.
 *
 * NELJA MITATTUA ASIAA JOTKA MAARAAVAT TAMAN TIEDOSTON MUODON
 *
 * 1. KOLME SPOTTIA KAHDESTATOISTA JAA ILMAN. Mitattuna 11.9.2026 WAMin
 *    hila antoi dataa yhdeksalle spotille kahdestatoista; Hanko
 *    Silversand, Haukilahti ja Munkkiniemi olivat mallin maamaskin
 *    sisalla eli KOKO sarja oli NaN. Ne ovat samalla ne kolme
 *    suojaisinta spottia, joilla aalto ei ole se muuttuja joka
 *    ratkaisee — aukko on siella missa se haittaa vahiten.
 *    Siksi vastaus erottaa tyhjan katteen omaksi tilakseen
 *    (`error: 'no data'`) eika palauta tyhjia taulukoita: kayttoliittyman
 *    on osattava JATTAA RIVI POIS eika nayttaa viivoja.
 *
 * 2. ENNUSTE ON 61 TUNTIA, EI VIISI VUOROKAUTTA. Kysely vastaa
 *    pyydettyyn loppuaikaan asti, mutta hannassa on pelkkaa NaN:ia:
 *    mitattuna 120 pyydetysta tunnista 61 oli kelvollista ja NaN:t
 *    olivat KAIKKI sarjan lopussa (aukkoja valissa 0). Siksi sarja
 *    katkaistaan viimeiseen kelvolliseen eika NaN:eja valiteta eteenpain.
 *
 * 3. ILMAN `starttime`A SARJA ALKAA SEURAAVASTA TUNNISTA, ei kuluvasta.
 *    Kysely laskee askeleen "kuluvan tunnin alusta" mutta aloittaa
 *    oletuksena NYT-hetkesta, jolloin ensimmainen tuntiaskel osuu
 *    seuraavaan tasatuntiin. Mitattuna klo 12:22 UTC:
 *
 *      ilman starttimea   eka 13:00 = 0,309   (12:00 puuttuu kokonaan)
 *      starttime=12:00    eka 12:00 = 0,303   n=13, NaN=0
 *
 *    Spottikortti on oletuksena KULUVASSA tunnissa, joten ilman tata
 *    aaltorivi oli tyhja aina kun korttia katsottiin nykyhetkessa —
 *    eli kaytannossa aina. Siksi `starttime` on kuluvan tunnin alku.
 *
 * 4. SUUNTA ON MISTA, JA SE TARKISTETTIIN. Verrattiin kuuden
 *    aaltopoijun mitattuun ModalWDi:hin samalta tunnilta (ModalWDi on
 *    dokumentoidusti MISTA, ks. api/aallot.js):
 *
 *      Suomenlinna  hav 299  WAM 259   ero  40
 *      Orrengrund   hav 274  WAM 239   ero  35
 *      P-Itameri    hav 298  WAM 299   ero   1
 *      Suomenlahti  hav 259  WAM 280   ero  21
 *      Selkameri    hav 340  WAM 324   ero  16
 *      Perameri     hav  26  WAM  24   ero   2
 *
 *    Kaanteista tulkintaa vasten samat erot olisivat 140-179 astetta.
 *    Suunta on siis samaa sukua kuin poijun ja tuulen suunta, ja
 *    kayttoliittyma voi kayttaa samaa nuolta ja samaa 'mista'-selitetta.
 */
import https from 'https';

const WFS = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature'
  + '&storedquery_id=fmi::forecast::wam::point::timevaluepair';

/* Pyydetaan 72 h vaikka mallissa on 61: ylimaara on pelkkaa NaN:ia joka
   karsiutuu kohdassa 2, ja ajon pituus vaihtelee ajokohtaisesti. Liian
   lyhyt pyynto sen sijaan katkaisisi sarjan kesken. */
const TUNTEJA = 72;

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

/* UTC-aikaleima -> 'YYYY-MM-DDTHH:MM' halutussa vyohykkeessa.
   Sama Intl-ratkaisu kuin api/harmonie.js:ssa — kasin kirjoitettua
   kesaaikasaantoa ei yllapideta kahdessa paikassa. */
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

/* Sarjat aika->arvo -kartoiksi. NaN pudotetaan tassa, koska sarjat
   kohdistetaan jaljempana AIKALEIMAN perusteella eika jarjestysnumerolla:
   jakso ja suunta voivat puuttua sielta missa korkeus on, eika toisen
   puuttuminen saa siirtaa toisen arvoja yhdella. */
function parseSarjat(xml) {
  var out = {};
  var lohkot = xml.split(/(?=<wml2:MeasurementTimeseries )/);
  for (var i = 1; i < lohkot.length; i++) {
    var b = lohkot[i];
    var nm = /gml:id="([^"]+)"/.exec(b);
    if (!nm) continue;
    var nimi = nm[1].replace(/^mts-\d+-\d+-/, '');
    var kartta = {}, m;
    var re = /<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]*)<\/wml2:value>/g;
    while ((m = re.exec(b)) !== null) {
      var v = parseFloat(m[2]);
      if (!isNaN(v)) kartta[m[1]] = v;
    }
    out[nimi] = kartta;
  }
  return out;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  /* WAM ajetaan neljasti vuorokaudessa, joten tunnin valimuisti ei
     vanhene kayttajan silmissa. Sama katto kuin /api/harmoniella. */
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');

  var lat = parseFloat(req.query.lat);
  var lng = parseFloat(req.query.lng);
  if (isNaN(lat) || isNaN(lng)) return res.status(400).json({ error: 'lat/lng required' });
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';

  /* Kuluvan tunnin alku, ei nyt-hetki. Ks. kohta 3. */
  var alku  = new Date(Date.now()).toISOString().slice(0, 14) + '00:00Z';
  var loppu = new Date(Date.now() + TUNTEJA * 3600000).toISOString().slice(0, 14) + '00:00Z';

  try {
    var xml = await fetchUrl(WFS
      + '&latlon=' + lat.toFixed(4) + ',' + lng.toFixed(4)
      + '&timestep=60&starttime=' + alku + '&endtime=' + loppu);

    var s = parseSarjat(xml);
    var hs = s.SigWaveHeight || {}, tp = s.WavePeriod || {}, di = s.WaveDirection || {};

    /* Aika-akseli tulee KORKEUDESTA: se on sarja jonka takia rivi on
       olemassa, ja jakso ja suunta poimitaan sen aikaleimoilla. Jos
       akseli rakennettaisiin kaikkien sarjojen unionista, yksi ylimaarainen
       jaksopiste tekisi kohtaan korkeudettoman rivin. */
    var ajat = Object.keys(hs).sort();
    if (!ajat.length) {
      /* TYHJA KATE, EI VERKKOVIKA. Ks. kohta 1. Sama erottelu kuin
         FMI-havaintoasemilla: `error: 'no data'` HTTP 200:lla tarkoittaa
         "vastaus tuli ja se oli tyhja", jolloin rivi jatetaan pois. */
      return res.status(200).json({ error: 'no data', lat: lat, lng: lng, time: [] });
    }

    var time = [], vHs = [], vTp = [], vDi = [];
    for (var i = 0; i < ajat.length; i++) {
      var t = ajat[i];
      time.push(toLocal(t, tz));
      vHs.push(hs[t]);
      vTp.push(tp[t] != null ? tp[t] : null);
      vDi.push(di[t] != null ? di[t] : null);
    }

    return res.status(200).json({
      lat: lat, lng: lng, tz: tz,
      time: time, hs: vHs, tp: vTp, dir: vDi,
      /* Sarjan pituus tunteina — kayttoliittyma voi kertoa mihin asti
         ennuste ulottuu sen sijaan etta vaikenisi lopusta. */
      hours: time.length,
      viimeinen: time[time.length - 1] || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
