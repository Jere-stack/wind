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

function fetchBuf(url) {
  return new Promise(function (resolve, reject) {
    https.get(url, function (res) {
      if (res.statusCode === 400) { res.resume(); reject(new Error(EI_DATAA)); return; }
      if (res.statusCode !== 200) {
        res.resume();
        reject(new Error('HTTP ' + res.statusCode));
        return;
      }
      const osat = [];
      res.on('data', function (c) { osat.push(c); });
      res.on('error', reject);
      res.on('end', function () { resolve(Buffer.concat(osat)); });
    }).on('error', reject);
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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
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
    let suurin = 0, markia = 0;
    for (let i = 0; i < n; i++) {
      const v = g.arvot[i];
      let q = 0;
      if (isFinite(v) && v > 0) {
        const mmh = v * 3600;
        if (mmh > suurin) suurin = mmh;
        if (mmh > 0.05) markia++;
        q = Math.min(65535, Math.round(mmh * 100));
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
      lat0: g.la1, lon0: g.lo1, dlat: g.dj, dlon: g.di,
      flip: (g.skannaus & 0x40) === 0,
      /* mm/h x 100, uint16 big-endian, rivi kerrallaan etelasta pohjoiseen. */
      mmh: tavut.toString('base64'),
      max: Math.round(suurin * 100) / 100,
      markia: markia
    });
  } catch (err) {
    if (err && err.message === EI_DATAA) {
      return res.status(200).json({ error: 'no data', time: hetki });
    }
    return res.status(500).json({ error: err.message });
  }
}
