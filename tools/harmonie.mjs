/* ------------------------------------------------------------------
   FMI HARMONIE 2,5 km hilana, GRIB2:sta.

   Tämä on säälaattavaraston TOINEN lähde. ECMWF IFS 0,25° (tiilet.mjs)
   kattaa koko maailman ja viisitoista vuorokautta; HARMONIE kattaa
   Itämeren ja 66 tuntia, mutta kymmenkertaisella tarkkuudella. Sovellus
   valitsee niistä hienoimman joka kattaa pyydetyn hetken.

   MIKSI GRIB2 EIKÄ PISTEKYSELY. Pistekysely laskuttaa pisteittäin ja
   antaa yhden pisteen kerrallaan; yksi laatta on 441 pistettä ja tasossa
   on 104 laattaa. `download`-palvelu antaa saman datan hilana: yksi
   pyyntö per aikaikkuna, kolme kenttää kerralla.

   MITATTU (12.9.2026, bbox 18,58,31,66, gridsize 261x161 = 0,05°):
     yksi kenttä yhdeltä hetkeltä        131 kB
     kolme kenttää, 67 tuntia          24,9 MB /  49 s
     aikakate                  ajohetki .. ajohetki + 66 h, tunneittain

   PROJEKTIO ON PAKKO SANOA. Ilman `projection=EPSG:4326` vastaus tulee
   mallin omassa projektiossa, ja section 3:n kentät luetaan silloin
   roskana: mitattuna la1 = 805,55 ja dj = 3785,36. Tässä oli ensimmäinen
   vika, ja se näytti GRIB-jäsentimen vialta vaikka pyyntö oli väärä.

   Section 5:n E ja D ovat ETUMERKKI-ITSEISARVOA eivätkä kahden
   komplementteja — sama sääntö kuin `api/sade.js`:ssä, ja jos muutat
   toista, tarkista toinen.                                            */

const DL = 'https://opendata.fmi.fi/download';

/* Mallin oma hilaväli asteina (2,5 km). `gridsize` LÄHETETÄÄN VAIN KUN
   SE HARVENTAA: ylinäytteistys kasvattaisi vastausta antamatta yhtään
   uutta arvoa. Sama sääntö kuin `api/sade.js`:ssä. */
export const HARMONIE_HILA = 0.0225;

function merkkiItseisarvo(u) { return (u & 0x8000) ? -(u & 0x7fff) : u; }

/* Yksi GRIB2-sanoma offsetista `alku`. Palauttaa myös sanoman pituuden,
   koska vastaus on monta sanomaa peräkkäin — yksi per kenttä per hetki. */
function sanoma(buf, alku) {
  if (buf.length < alku + 16) return null;
  if (buf.toString('latin1', alku, alku + 4) !== 'GRIB') return null;
  const koko = Number(buf.readBigUInt64BE(alku + 8));
  if (!(koko > 16) || alku + koko > buf.length) return null;
  const loppu = alku + koko;
  let off = alku + 16;
  let ni = 0, nj = 0, la1 = 0, lo1 = 0, di = 0, dj = 0, skannaus = 0;
  let R = 0, E = 0, D = 0, bittia = 0, drt = -1, kat = -1, num = -1;
  let ft = 0, ftYks = 1, ref = 0, data = null, bittikartta = null;

  while (off + 5 <= buf.length && off < loppu - 4) {
    const pit = buf.readUInt32BE(off);
    const nro = buf[off + 4];
    if (pit < 5 || off + pit > loppu) break;
    const s = buf.slice(off, off + pit);
    if (nro === 1) {
      ref = Date.UTC(s.readUInt16BE(12), s[14] - 1, s[15], s[16], s[17], s[18]);
    } else if (nro === 3) {
      if (s.readUInt16BE(12) !== 0) return { koko, ohita: true };  /* vain regular_ll */
      ni = s.readUInt32BE(30); nj = s.readUInt32BE(34);
      la1 = s.readInt32BE(46) / 1e6; lo1 = s.readInt32BE(50) / 1e6;
      di = s.readUInt32BE(63) / 1e6; dj = s.readUInt32BE(67) / 1e6;
      skannaus = s[71];
    } else if (nro === 4) {
      kat = s[9]; num = s[10]; ftYks = s[17]; ft = s.readUInt32BE(18);
    } else if (nro === 5) {
      drt = s.readUInt16BE(9); R = s.readFloatBE(11);
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
  if (!ni || !nj || drt !== 0 || !data) return { koko, ohita: true };

  const n = ni * nj;
  const skaala = Math.pow(2, E) / Math.pow(10, D);
  const pohja = R / Math.pow(10, D);
  const arvot = new Float32Array(n);
  let bitti = 0;
  for (let i = 0; i < n; i++) {
    const on = bittikartta ? ((bittikartta[i >> 3] >> (7 - (i & 7))) & 1) : 1;
    if (!on) { arvot[i] = NaN; continue; }
    if (bittia === 0) { arvot[i] = pohja; continue; }
    let v = 0;
    for (let b = 0; b < bittia; b++) {
      v = v * 2 + ((data[bitti >> 3] >> (7 - (bitti & 7))) & 1);
      bitti++;
    }
    arvot[i] = pohja + v * skaala;
  }
  /* Ennusteaika on sanoman omassa yksikössä: 0 = minuutti, 1 = tunti,
     13 = sekunti. HARMONIE antaa tunteja, mutta yksikkö luetaan silti —
     kiinteä kerroin olisi hiljainen aikavirhe jos se joskus vaihtuu. */
  const kerroin = ftYks === 0 ? 60e3 : ftYks === 13 ? 1000 : 3600e3;
  return { koko, ni, nj, la1, lo1, di, dj, skannaus, kat, num,
           aika: ref + ft * kerroin, ajohetki: ref, arvot };
}

/* Parametrien tunnisteet GRIB2:n taulukossa 4.2 (discipline 0,
   category 2 = momentum). Nimet ovat FMI:n `param`-nimiä. */
const PARAMIT = {
  WindUMS:  { kat: 2, num: 2 },
  WindVMS:  { kat: 2, num: 3 },
  WindGust: { kat: 2, num: 22 },
};

async function haePala(bbox, ni, nj, alku, loppu, parametrit) {
  const url = DL
    + '?producer=harmonie_scandinavia_surface'
    + '&param=' + parametrit.join(',')
    + '&format=grib2&projection=EPSG:4326&levels=0&timestep=60'
    + '&bbox=' + bbox.join(',')
    + '&starttime=' + new Date(alku).toISOString().slice(0, 19) + 'Z'
    + '&endtime=' + new Date(loppu).toISOString().slice(0, 19) + 'Z'
    + '&gridsize=' + ni + ',' + nj;
  const r = await fetch(url);
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 110));
  return Buffer.from(await r.arrayBuffer());
}

/* ------------------------------------------------------------------
   `haeHarmonie({ lat, lng, askel, tunteja, palaH })`

   Palauttaa
     { la0, lo0, askel, ni, nj, ajat: [ms], kentat: Map(nimi -> Map(ms -> Float32Array)) }

   `kentat` on kenttänimi -> hetki -> hila. Hila on rivijärjestyksessä
   ETELÄSTÄ POHJOISEEN (skannausbitti +j), eli indeksi on j*ni + i missä
   j = (lat - la0) / askel.

   PALOITTELU AJASSA. Koko 66 tunnin ikkuna kolmella kentällä on 25 MB
   yhtenä pyyntönä. Se onnistuu, mutta yksi katkos veisi kaiken; ja
   ajastettu työ ei saa kaatua siihen että yksi iso siirto katkesi.
   Palat ovat oletuksena 24 h, ja jokainen yritetään kolmesti.        */
export async function haeHarmonie(asetukset) {
  const lat = asetukset.lat, lng = asetukset.lng;
  const askel = asetukset.askel;
  const tunteja = asetukset.tunteja || 66;
  const palaH = asetukset.palaH || 24;
  const log = asetukset.log || (() => {});

  const ni = Math.round((lng[1] - lng[0]) / askel) + 1;
  const nj = Math.round((lat[1] - lat[0]) / askel) + 1;
  if (askel < HARMONIE_HILA) {
    throw new Error('askel ' + askel + '° on mallin omaa hilaa tiheämpi');
  }
  const bbox = [lng[0], lat[0], lng[1], lat[1]];

  /* Aloitus kuluvan tunnin alusta. Lähde kelaa itse ajohetkeen jos
     pyyntö osuu sitä aiemmaksi (mitattu: -24 h antoi ajohetken), joten
     menneisyyttä ei tarvitse erikseen rajata pois. */
  const t0 = Math.floor(Date.now() / 3600e3) * 3600e3;
  const kentat = new Map();
  const parametrit = Object.keys(PARAMIT);
  for (const p of parametrit) kentat.set(p, new Map());
  const numToNimi = new Map(parametrit.map(p => [PARAMIT[p].kat + '/' + PARAMIT[p].num, p]));

  let geom = null, tavuja = 0;
  for (let h = 0; h < tunteja; h += palaH) {
    const alku = t0 + h * 3600e3;
    const loppu = t0 + Math.min(tunteja, h + palaH - 1) * 3600e3;
    let buf = null, virhe = null;
    for (let yritys = 0; yritys < 3; yritys++) {
      try { buf = await haePala(bbox, ni, nj, alku, loppu, parametrit); break; }
      catch (e) { virhe = e; await new Promise(r => setTimeout(r, 2000 * (yritys + 1))); }
    }
    if (!buf) {
      /* Ensimmäinen pala on pakollinen: ilman sitä ei ole tasoa
         lainkaan. Myöhemmän palan puute lyhentää akselia, mikä on
         parempi kuin ei mitään — sovellus putoaa sen jälkeen ECMWF:ään
         aivan kuten +66 tunnin jälkeenkin. */
      if (h === 0) throw virhe || new Error('HARMONIE: ensimmäinen pala puuttuu');
      log('  ! pala +' + h + ' h jäi saamatta: ' + (virhe && virhe.message));
      break;
    }
    tavuja += buf.length;
    let off = 0, n = 0;
    while (off < buf.length - 8) {
      const m = sanoma(buf, off);
      if (!m || !m.koko) break;
      off += m.koko;
      if (m.ohita) continue;
      n++;
      const nimi = numToNimi.get(m.kat + '/' + m.num);
      if (!nimi) continue;
      if (!geom) geom = { ni: m.ni, nj: m.nj, la0: m.la1, lo0: m.lo1, di: m.di, dj: m.dj, skannaus: m.skannaus };
      else if (m.ni !== geom.ni || m.nj !== geom.nj || m.la1 !== geom.la0 || m.lo1 !== geom.lo0) {
        throw new Error('hila vaihtui kesken haun');
      }
      kentat.get(nimi).set(m.aika, m.arvot);
    }
    log('  +' + h + '..' + (h + palaH - 1) + ' h: ' + n + ' sanomaa, '
      + (buf.length / 1e6).toFixed(1) + ' MB');
  }
  if (!geom) throw new Error('HARMONIE: yhtään kelvollista sanomaa ei tullut');

  /* SKANNAUSSUUNTA ON TARKISTETTAVA, EI OLETETTAVA. Bitti 2 (0x40)
     tarkoittaa että rivit etenevät pohjoiseen, jolloin la0 on eteläisin.
     Jos se joskus vaihtuu, hila kääntyisi ylösalaisin hiljaa. */
  if (!(geom.skannaus & 0x40)) throw new Error('odottamaton skannaussuunta 0x' + geom.skannaus.toString(16));

  /* Aika-akseli tulee TUULESTA, ei puuskasta: puuska on jakson yli
     laskettu maksimi ja sen leimat ovat tunnin eri kohdassa. */
  const ajat = [...kentat.get('WindUMS').keys()].sort((a, b) => a - b)
    .filter(t => kentat.get('WindVMS').has(t));
  if (ajat.length < 6) throw new Error('HARMONIE: liian lyhyt akseli (' + ajat.length + ')');

  log('  hila ' + geom.ni + 'x' + geom.nj + ' @ ' + askel + '°, '
    + ajat.length + ' hetkeä, ' + (tavuja / 1e6).toFixed(1) + ' MB');
  return { la0: geom.la0, lo0: geom.lo0, askel, ni: geom.ni, nj: geom.nj, ajat, kentat };
}
