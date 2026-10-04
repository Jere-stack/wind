/* FMI HARMONIE — SADE-ENNUSTE HILANA.
 *
 * Lahde: opendata.fmi.fi:n `download`-palvelu, tuottaja
 * `harmonie_scandinavia_surface`, parametri `Precipitation1h`, muoto
 * GRIB2. Vastaus on YKSI aikaaskel yhdelle rajaukselle.
 *
 * TAMA ON ENNUSTE. `Sadetutka` (openwms.fmi.fi/geoserver/Radar) on
 * HAVAINTO. Ne ovat saman kerroksen kaksi lahdetta ja ne erotetaan
 * kartalla nimella ja kellonajalla — mutta ne ovat samalla ASTEIKOLLA,
 * millimetreina tunnissa, koska tama proxy palauttaa mm/h ja tutkan
 * paletti kaannetaan samaan yksikkoon (ks. index.html, Sade.mmh).
 *
 * VIISI MITATTUA ASIAA JOTKA MAARAAVAT TAMAN TIEDOSTON MUODON
 *
 * 1. FMI:N AVOIMESSA WMS:SSA EI OLE YHTAAN ENNUSTEKERROSTA. Tarkistettu
 *    koko palvelun GetCapabilitiesista (450 969 tavua, 128 kerrosta):
 *    tyotiloja on kolme — Basemaps, Radar, silva — ja haku
 *    /fore|ennu|nowcast|harmon|meps|precip|sade|hirlam/i antoi NOLLA
 *    osumaa. Sade-ennustetta ei siis saa valmiina kuvana mistaan, ja
 *    siksi tama tiedosto purkaa GRIBia.
 *
 * 2. GRIB ON YKSINKERTAISTA PAKKAUSTA SAANNOLLISELLA LAT/LON-HILALLA.
 *    Mitattuna: hilamalline 0 (regular_ll), datamalline 0 (simple
 *    packing), skannaus 64 eli i lannesta itaan ja j etelasta pohjoiseen.
 *    Ei uudelleenprojisointia, ei monimutkaista purkua — purkaja on
 *    alla noin viisikymmenta rivia eika vaadi riippuvuutta.
 *
 * 3. YKSIKKO ON kg m-2 s-1, JA KERROIN ON 3600. Tarkistus tehtiin
 *    hakemalla ensin 48 h hila koko Suomen ylle, etsimalla sen suurin
 *    arvo (0,005806 pisteessa 59,8514 / 27,8480 hetkella
 *    2026-09-13T00:00Z) ja kysymalla SAMA piste ja hetki erikseen
 *    pistekyselylla `fmi::forecast::harmonie::surface::point::
 *    timevaluepair`:
 *
 *      GRIB   0,005806 x 3600 = 20,90
 *      piste  Precipitation1h = 20,9      /meta sanoo uom="mm/h"
 *
 *    Sama luku kolmella merkitsevalla numerolla. Kerroin ei siis ole
 *    paatelty vaan mitattu.
 *
 * 4. HILAN KOKO ON PYYDETTAVISSA, JA SE ON AINOA TAPA PITAA VASTAUS
 *    KOHTUULLISENA. `gridsize=W,H` resamploi palvelimella. Mitattu
 *    sama hetki ja rajaus (24,0–25,6 E / 59,7–60,5 N):
 *
 *      natiivi     72x36   8 279 B   max 2,20  ka 0,078  markia 23,9 %
 *      gridsize 64 64x64  12 979 B   max 2,20  ka 0,075  markia 23,3 %
 *
 *    Arvot sailyvat. HUOMAA ETTA 64x64 OLI ISOMPI: se ylinaytteisti
 *    j-suunnan 36 -> 64. Siksi `gridsize` lahetetaan VAIN kun se
 *    oikeasti harventaa. Koko Suomen rajauksella ero on toista luokkaa:
 *    natiivi 534x334 = 557 542 B, `gridresolution=10,10` = 35 354 B.
 *
 * 5. ENNUSTE ON 61–62 TUNTIA. Mitattuna Helsingin pisteessa 81
 *    pyydetysta tunnista 62 oli kelvollista ja loput NaN:ia sarjan
 *    lopussa. Sen jalkeen ei ole dataa — ja se on koko syy silla, etta
 *    kayttoliittyma tyhjentaa kerroksen ja SANOO sen aaneen sen sijaan
 *    etta jattaisi vanhan kuvan nakyviin.
 */
import https from 'https';
import { suojaa } from './_suoja.js';
import { haeTeksti, haeFmi } from './_haku.js';

const DL = 'https://opendata.fmi.fi/download'
  + '?producer=harmonie_scandinavia_surface'
  + '&param=Precipitation1h&format=grib2&projection=EPSG:4326'
  + '&levels=0&timestep=60';

/* Mallin oma hilavali asteina (mitattu: di 0,022514–0,022541,
   dj 0,022500–0,022523 eli 2,5 km). Tata tiheammaksi ei pyydeta:
   ylinaytteistys kasvattaisi vastausta antamatta yhtaan uutta arvoa. */
const HILA_ASTE = 0.0225;

/* Katto hilan koolle. 160 x 160 = 25 600 solua eli 51 kB raakana ja
   68 kB base64:na — se on ylazoomin hinta, ei tavallinen. Tavallinen
   Helsingin ruutu on noin 40 x 22 solua eli 1,7 kB. */
const HILA_MAX = 160;

/* Lahteen 400 EI OLE VERKKOVIKA. Mitattuna `download` vastaa 400:lla ja
   TYHJALLA rungolla aina kun pyydetty hetki on ajon ulkopuolella —
   seka +120 h etta -72 h antoivat saman. Se on siis "ei dataa talle
   tunnille", ja se on tavallisin vastaus koko rajapinnasta: aikajana on
   16,6 vrk ja ennuste 61. Jos tama heitettaisiin poikkeuksena, kerros
   nayttaisi verkkovikaa joka kerta kun kayttaja raahaa janan
   ennusteen ohi. Sama erottelu kuin FMI-havaintoasemilla. */
const EI_DATAA = 'ei-dataa';

/* Aikaraja koko haulle, kuten api/_haku.js:ssä (docs/oikeellisuus.md,
   O5): jumiin jäänyt latauspalvelu piti funktion auki sen kattoon asti. */
const AIKARAJA_MS = 12000;
function fetchBuf(url) {
  return new Promise(function (resolve, reject) {
    const req = https.get(url, function (res) {
      if (res.statusCode !== 200) {
        clearTimeout(ajastin);
        res.resume();
        reject(new Error(res.statusCode === 400 ? EI_DATAA : 'HTTP ' + res.statusCode));
        return;
      }
      const osat = [];
      res.on('data', function (c) { osat.push(c); });
      res.on('error', reject);
      res.on('end', function () { clearTimeout(ajastin); resolve(Buffer.concat(osat)); });
    });
    req.on('error', function (e) { clearTimeout(ajastin); reject(e); });
    const ajastin = setTimeout(function () {
      req.destroy(new Error('aikakatkaisu ' + AIKARAJA_MS + ' ms'));
    }, AIKARAJA_MS);
  });
}

/* GRIB2:n etumerkki-itseisarvo. Kentat E ja D eivat ole kahden
   komplementteja vaan ylin bitti on merkki — ilman tata E = -33 luetaan
   arvona -32735 ja koko kentta skaalautuu nollaksi (nain kavi
   ensimmaisessa versiossa: kaikki 178 356 pistetta olivat 0,0). */
function merkkiItseisarvo(u) {
  return (u & 0x8000) ? -(u & 0x7fff) : u;
}

/* Yksi GRIB2-sanoma -> { ni, nj, la1, lo1, di, dj, arvot }.
   `arvot` on Float32Array jossa puuttuva on NaN. */
function puraGrib(buf) {
  if (buf.length < 16 || buf.toString('latin1', 0, 4) !== 'GRIB') return null;
  const koko = Number(buf.readBigUInt64BE(8));
  let off = 16;
  let ni = 0, nj = 0, la1 = 0, lo1 = 0, di = 0, dj = 0, skannaus = 0;
  let R = 0, E = 0, D = 0, bittia = 0, npts = 0, drt = -1;
  let bittikartta = null, data = null;

  while (off + 5 <= buf.length && off < koko - 4) {
    const pit = buf.readUInt32BE(off);
    const nro = buf[off + 4];
    if (pit < 5 || off + pit > buf.length) break;
    const s = buf.slice(off, off + pit);

    if (nro === 3) {
      if (s.readUInt16BE(12) !== 0) return null;     /* vain regular_ll */
      ni = s.readUInt32BE(30); nj = s.readUInt32BE(34);
      la1 = s.readInt32BE(46) / 1e6; lo1 = s.readInt32BE(50) / 1e6;
      di = s.readUInt32BE(63) / 1e6; dj = s.readUInt32BE(67) / 1e6;
      skannaus = s[71];
    } else if (nro === 5) {
      npts = s.readUInt32BE(5);
      drt = s.readUInt16BE(9);
      R = s.readFloatBE(11);
      E = merkkiItseisarvo(s.readUInt16BE(15));
      D = merkkiItseisarvo(s.readUInt16BE(17));
      bittia = s[19];
    } else if (nro === 6) {
      bittikartta = s[5] === 0 ? s.slice(6) : null;
    } else if (nro === 7) {
      data = s.slice(5);
    }
    off += pit;
  }

  if (!ni || !nj || drt !== 0 || !data) return null;

  const n = ni * nj;
  const skaala = Math.pow(2, E) / Math.pow(10, D);
  const pohja = R / Math.pow(10, D);
  const ulos = new Float32Array(n);

  let bitti = 0, k = 0;
  for (let i = 0; i < n; i++) {
    const on = bittikartta ? ((bittikartta[i >> 3] >> (7 - (i & 7))) & 1) : 1;
    if (!on) { ulos[i] = NaN; continue; }
    if (bittia === 0) { ulos[i] = pohja; k++; continue; }
    let v = 0;
    for (let b = 0; b < bittia; b++) {
      v = v * 2 + ((data[bitti >> 3] >> (7 - (bitti & 7))) & 1);
      bitti++;
    }
    ulos[i] = pohja + v * skaala;
    k++;
  }
  if (k > npts) return null;

  return { ni: ni, nj: nj, la1: la1, lo1: lo1, di: di, dj: dj,
           skannaus: skannaus, arvot: ulos };
}

/* Kuluvan tunnin alku UTC:na. Sama sääntö kuin api/wam.js:ssa ja
   api/vesi.js:ssa: ilman `starttime`a sarja alkaisi seuraavasta
   tasatunnista. */
function tunninAlku(ms) {
  return new Date(Math.floor(ms / 3600000) * 3600000).toISOString().slice(0, 19) + 'Z';
}

/* ── SADESARJA PISTEESSÄ (`?sarja=1&lat=&lon=`) ────────────────────────
 *
 * Aikajanan sadepalkit sadetilassa (docs/sadetutka.md, V3). Tila tässä
 * funktiossa eikä uusi tiedosto: Vercelin Hobby-tason katto on 12
 * funktiota (CLAUDE.md).
 *
 *   tunnit   48 h tutkan tuntikertymää: FMI `radar_finland_cappi_acrr1h`
 *            (1 km, liukuva 1 h summa, PT5M) tasatunneilla GetFeatureInfolla.
 *            Arvo tunnilla T = sade välillä (T − 1 h, T], sama käytäntö
 *            kuin HARMONIEn `Precipitation1h`. Mitattu 4.10.: piste
 *            61,0 / 27,7 klo 13 UTC = 0,117 mm.
 *   vartit   3 h heijastuvuutta vartin välein (`radar_finland_cappi_dbzh`,
 *            250 m) dBZ:nä — asiakas kääntää sen millimetreiksi SAMALLA
 *            taulukolla kuin kartan (`Sade.mmhDbz`), joten käännöksiä on yksi.
 *   ennuste  HARMONIE `Precipitation1h` pistekyselynä, 61–62 h.
 *
 * GetFeatureInfo palauttaa YHDEN arvon per pyyntö myös aikavälille
 * (mitattu: väli antoi vain yhden arvon), joten tunnit haetaan
 * rinnakkain enintään 16 kerrallaan. Vastaus on sama kaikille saman
 * 0,05°:n pisteen kysyjille, joten CDN kantaa sen viisi minuuttia. */
const WMS = 'https://openwms.fmi.fi/geoserver/Radar/wms';
function gfiUrl(kerros, lat, lon, ms) {
  return WMS + '?service=WMS&version=1.3.0&request=GetFeatureInfo&layers=' + kerros
    + '&query_layers=' + kerros + '&styles=raster&crs=EPSG:4326'
    + '&bbox=' + (lat - 0.01).toFixed(4) + ',' + (lon - 0.01).toFixed(4) + ',' + (lat + 0.01).toFixed(4) + ',' + (lon + 0.01).toFixed(4)
    + '&width=3&height=3&i=1&j=1&info_format=application/json'
    + '&time=' + new Date(ms).toISOString().slice(0, 19) + 'Z';
}
async function gfi(kerros, lat, lon, ms) {
  try {
    const v = await haeTeksti(gfiUrl(kerros, lat, lon, ms), { aikaraja: 6000 });
    if (v.tila !== 200) return null;
    const j = JSON.parse(v.runko);
    const x = j && j.features && j.features[0] && j.features[0].properties
      ? j.features[0].properties.GRAY_INDEX : null;
    return typeof x === 'number' && isFinite(x) ? x : null;
  } catch (e) { return null; }
}
async function rinnakkain(tehtavat, n) {
  const ulos = new Array(tehtavat.length);
  let i = 0;
  async function tyolainen() { while (i < tehtavat.length) { const k = i++; ulos[k] = await tehtavat[k](); } }
  await Promise.all(Array.from({ length: Math.min(n, tehtavat.length) }, tyolainen));
  return ulos;
}
async function sarja(req, res) {
  const lat = Math.round(parseFloat(req.query.lat) * 20) / 20;
  const lon = Math.round(parseFloat(req.query.lon) * 20) / 20;
  if (!isFinite(lat) || !isFinite(lon)) return res.status(400).json({ error: 'lat, lon required' });
  const H = 3600000, V = 900000, nyt = Date.now();
  /* Tutkan viive on alle 5 – noin 7 min (docs/data.md); 10 min varmuus. */
  const tuorein = nyt - 10 * 60000;
  const tunnit = [], vartit = [];
  for (let t = Math.floor(tuorein / H) * H, k = 0; k < 48; k++, t -= H) tunnit.push(t);
  for (let t = Math.floor(tuorein / V) * V, k = 0; k < 12; k++, t -= V) vartit.push(t);
  const ennusteUrl = 'https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature'
    + '&storedquery_id=fmi::forecast::harmonie::surface::point::timevaluepair'
    + '&latlon=' + lat + ',' + lon + '&parameters=Precipitation1h&timestep=60'
    + '&starttime=' + tunninAlku(nyt);
  /* MET Norwayn nowcast (radar_coverage, 5 min, ~90 min) varatieksi
     selaimen omalle advektiolle. Vaatii User-Agentin; CC BY 4.0. */
  const metUrl = 'https://api.met.no/weatherapi/nowcast/2.0/complete?lat=' + lat.toFixed(2) + '&lon=' + lon.toFixed(2);
  const metHaku = haeTeksti(metUrl, { aikaraja: 6000, otsakkeet: { 'User-Agent': 'FoilSpot/7 github.com/Jere-stack/wind' } })
    .then(function (v) {
      if (v.tila !== 200) return [];
      const j = JSON.parse(v.runko);
      if (!j.properties || j.properties.meta.radar_coverage !== 'ok') return [];
      return j.properties.timeseries.map(function (x) {
        const r = x.data && x.data.instant && x.data.instant.details ? x.data.instant.details.precipitation_rate : null;
        return [Date.parse(x.time), typeof r === 'number' ? r : null];
      }).filter(function (x) { return x[1] != null; });
    }, function () { return []; });
  const [mm, dbz, ennuste, met] = await Promise.all([
    rinnakkain(tunnit.map(function (t) { return function () { return gfi('radar_finland_cappi_acrr1h', lat, lon, t); }; }), 16),
    rinnakkain(vartit.map(function (t) { return function () { return gfi('radar_finland_cappi_dbzh', lat, lon, t); }; }), 12),
    haeFmi(ennusteUrl, { aikaraja: 8000, tyhjaPoikkeuksesta: true }).then(function (xml) {
      const ulos = [], re = /<wml2:time>([^<]+)<\/wml2:time>\s*<wml2:value>([^<]*)<\/wml2:value>/g;
      let m;
      while ((m = re.exec(xml))) {
        const v = parseFloat(m[2]);
        if (isFinite(v)) ulos.push([Date.parse(m[1]), Math.round(v * 100) / 100]);
      }
      return ulos;
    }, function () { return null; }),
    metHaku
  ]);
  /* Kertymän puuttuva arvo on −1 (ODIM nodata) tai katvealue. */
  const T = tunnit.map(function (t, i) {
    const v = mm[i];
    return [t, v == null || v < 0 || v > 500 ? null : Math.round(v * 100) / 100];
  }).reverse();
  /* dBZ: alle 5 = ei kaikua (0), yli 70 = katve tai ei dataa (null). */
  const Q = vartit.map(function (t, i) {
    const v = dbz[i];
    return [t, v == null || v > 70 ? null : (v < 5 ? 0 : Math.round(v * 10) / 10)];
  }).reverse();
  const onnistui = T.some(function (x) { return x[1] != null; }) || Q.some(function (x) { return x[1] != null; }) || (ennuste && ennuste.length);
  if (!onnistui) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: 'radar and forecast unavailable' });
  }
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=120');
  return res.status(200).json({ lat: lat, lon: lon, luotu: nyt, tunnit: T, vartit: Q, ennuste: ennuste || [], met: met || [] });
}

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  if (req.query.sarja) return sarja(req, res);
  /* HARMONIE ajetaan neljasti vuorokaudessa. Puolen tunnin valimuisti on
     kayttajalle huomaamaton ja leikkaa aikajanan raahauksen toistuvat
     osumat — sama tunti ja sama rajaus haetaan raahatessa monta kertaa. */
  res.setHeader('Cache-Control', 'public, s-maxage=1800, stale-while-revalidate=600');

  const bb = String(req.query.bbox || '').split(',').map(parseFloat);
  if (bb.length !== 4 || bb.some(isNaN)) {
    return res.status(400).json({ error: 'bbox=lon1,lat1,lon2,lat2 required' });
  }
  const lo1 = Math.min(bb[0], bb[2]), lo2 = Math.max(bb[0], bb[2]);
  const la1 = Math.min(bb[1], bb[3]), la2 = Math.max(bb[1], bb[3]);
  if (lo2 - lo1 <= 0 || la2 - la1 <= 0) {
    return res.status(400).json({ error: 'empty bbox' });
  }

  const t = req.query.time ? Date.parse(req.query.time) : Date.now();
  if (isNaN(t)) return res.status(400).json({ error: 'bad time' });
  const hetki = tunninAlku(t);

  /* Toivottu hila tulee asiakkaalta ruudun pikseleista. Se katkaistaan
     seka kattoon etta MALLIN OMAAN TARKKUUTEEN — ylinaytteistys olisi
     isompi vastaus ilman yhtaan uutta arvoa (ks. kohta 4). */
  const natNi = Math.max(2, Math.round((lo2 - lo1) / HILA_ASTE));
  const natNj = Math.max(2, Math.round((la2 - la1) / HILA_ASTE));
  let ni = parseInt(req.query.ni, 10), nj = parseInt(req.query.nj, 10);
  if (!(ni > 0)) ni = natNi;
  if (!(nj > 0)) nj = natNj;
  ni = Math.min(ni, natNi, HILA_MAX);
  nj = Math.min(nj, natNj, HILA_MAX);

  let url = DL
    + '&bbox=' + [lo1, la1, lo2, la2].map(function (v) { return v.toFixed(4); }).join(',')
    + '&starttime=' + hetki + '&endtime=' + hetki;
  if (ni < natNi || nj < natNj) url += '&gridsize=' + ni + ',' + nj;

  try {
    const buf = await fetchBuf(url);
    const g = puraGrib(buf);
    if (!g) {
      /* TYHJA KATE, EI VERKKOVIKA. Sama erottelu kuin api/wam.js:ssa ja
         FMI-havaintoasemilla: vastaus tuli mutta siina ei ollut hilaa —
         kayttoliittyman on tyhjennettava kerros eika jaatava vanhaan. */
      return res.status(200).json({ error: 'no data', time: hetki });
    }

    /* mm/h SADASOSINA 16-bittisena. Yksikkomuunnos tehdaan TASSA ja
       vain tassa (ks. kohta 3); asiakas ei tieda kg m-2 s-1:sta mitaan.
       Kaksi tavua eika yksi, koska yhden tavun mahduttaminen vaatisi
       KAYRAN — ja kayra on asiakkaan puolella jo olemassa tutkan
       palettia varten. Kaksi kayraa samalle asialle ajautuisi erilleen. */
    const n = g.ni * g.nj;
    const tavut = Buffer.allocUnsafe(n * 2);
    /* `puuttuva=1` (sovellus 4.10.): mallin alueen ulkopuoli (NaN) on
       65535 eikä nolla, jotta asiakas erottaa poudan katteen reunasta ja
       voi jatkaa sitä ECMWF:llä (docs/sadetutka.md, luku 11). Vanha
       asiakas ei pyydä sitä ja saa nollan kuten ennen. */
    const puuttuva = req.query.puuttuva === '1';
    let suurin = 0, markia = 0, puuttuvia = 0;
    for (let i = 0; i < n; i++) {
      const v = g.arvot[i];
      let q = 0;
      if (puuttuva && !isFinite(v)) { tavut.writeUInt16BE(65535, i * 2); puuttuvia++; continue; }
      if (isFinite(v) && v > 0) {
        const mmh = v * 3600;
        if (mmh > suurin) suurin = mmh;
        if (mmh > 0.05) markia++;
        q = Math.min(puuttuva ? 65534 : 65535, Math.round(mmh * 100));
      }
      tavut.writeUInt16BE(q, i * 2);
    }

    return res.status(200).json({
      time: hetki,
      ni: g.ni, nj: g.nj,
      /* Hilan ETELAREUNA ja LANSIREUNA, ja askel pohjoiseen/itaan.
         Skannaus on mitattu 64:ksi eli rivi 0 on etelaisin; jos lahde
         joskus vaihtaa sen, `flip` kertoo sen asiakkaalle eika jata
         kuvaa ylosalaisin ilman etta kukaan huomaa. */
      /* GRIB kertoo pituusasteen 0..360; länsi on siis 350 eikä −10. */
      lat0: g.la1, lon0: g.lo1 > 180 ? g.lo1 - 360 : g.lo1, dlat: g.dj, dlon: g.di,
      flip: (g.skannaus & 0x40) === 0,
      /* mm/h x 100, uint16 big-endian, rivi kerrallaan etelasta pohjoiseen. */
      mmh: tavut.toString('base64'),
      max: Math.round(suurin * 100) / 100,
      markia: markia,
      puuttuvia: puuttuvia
    });
  } catch (err) {
    if (err && err.message === EI_DATAA) {
      return res.status(200).json({ error: 'no data', time: hetki });
    }
    /* Otsake asetettiin jo onnistumisen varalle: virhe ei saa jäädä CDN:ään
       puoleksi tunniksi. */
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: err.message });
  }
}
