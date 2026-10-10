/* EUROOPAN HAVAINNOT: EUMETNET MeteoGate E-SOH (docs/eurooppa.md, luku 14).
 *
 * Alaviiva nimen alussa: apumoduuli eikä reitti, joten Vercelin 12
 * funktion katto ei kasva (CLAUDE.md). Käyttäjät:
 *
 *   api/fmi.js?eu=laatta   kartan merkit, laatta 4° × 4°: asemat, tunnin
 *                          näytteet 48 h ja tuorein lukema
 *   api/fmi.js?eu=sarja    asemakortin sarja: 24 h täydellä tarkkuudella
 *                          + varaston tunnit sitä vanhemmat
 *   tools/esoh.mjs         historia `havainnot`-haaraan (tunnin näytteet)
 *
 * LÄHDE. E-SOH (EUMETNET Supplementary Observations dataHub) jakaa
 * kansallisten sääpalvelujen asemahavainnot OGC API EDR -rajapinnalla,
 * CoverageJSON, CC BY 4.0, ei avainta. Mitattu 5.10.2026:
 *
 *   - SÄILYTYS ON 24 h. Vanhempi jakso vastaa 404:llä. Aikajanan
 *     menneisyys on 48 h ja asemakortin 168 h, joten vanhemmat tunnit
 *     tulevat omasta varastosta (`tools/esoh.mjs`).
 *   - Tyhjä alue ja asema ilman dataa = 404 ("Requested data not
 *     found"). Se on tyhjä vastaus, ei vika.
 *   - Tuntematon parametrinimi kaataa KOKO kyselyn (400 "Unknown
 *     parameter-name [...]"), joten nimi joka joskus poistuu
 *     luettelosta ei saa viedä kaikkia havaintoja: virheestä luetaan
 *     tuntemattomat nimet ja kysely uusitaan ilman niitä (`haeAlue`).
 *   - Laatta 4° × 4° ja 24 h: 0,2–1,2 s ja 0,1–0,9 MB (Keski-Eurooppa).
 *     Koko Euroopan yksi hetki: 3,5 s, 7 MB, ~3 000 asemaa.
 *   - Tuntiasemat raportoivat tasatunnilla (1 847 / 1 866 hetkeä), 10 min
 *     asemat (FI, NL, BE…) kymmenen minuutin välein.
 *
 * PARAMETRIT ETUSIJAJÄRJESTYKSESSÄ. Sama suure tulee eri maista eri
 * nimellä (3 428 Euroopan tuuliaseman `/locations`ista laskettuna):
 * `point:PT10M` 2 500 asemaa, `point:PT0S` 769, `mean:PT1H` 214,
 * `mean:PT10M` 150 (Suomi). Tuuli on YKSI parametri koko sarjalle,
 * ei hetkittäin vaihtuva: kymmenen minuutin keskiarvo ja tunnin
 * keskiarvo vuorotellen olisi käyrä joka sahaa menetelmän mukaan.
 * Puuska on 10 min puuska kuten FMI:llä (tuulen kanssa samalta
 * jaksolta), ja tunnin puuska vain kun sitä ei ole. */
import { readFileSync } from 'fs';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { gunzipSync } from 'zlib';
import { VARASTO, haeTeksti as haeVarastosta, hhmm } from './_varasto.js';

export const ESOH = 'https://observations.meteogate.eu/collections/observations';
const UA = 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)';

/* HOLLANTI (KNMI) ON OMILLA NIMILLÄÄN (10.10., docs/eurooppa.md luku 16):
   koko KNMI:n verkko (61 asemaa, mm. Muiden, Schiphol, Houtribdijk)
   julkaisee tuulen korkeudella "2.0" eikä 10.0, ja ne jäivät siksi pois
   laatoista — Hollannissa oli kartalla 14 asemaa. Mitattu KNMI:n omaa
   10 min tiedostoa vasten (10.10. klo 20.40–21.20 UTC, viisi asemaa):
   `wind_speed_of_gust:2.0:maximum:PT0S` on TASAN KNMI:n `gff` (10 min
   puuska 10 m:ssä) ja suunta `dd`, mutta `wind_speed:2.0:point:PT0S` EI
   ole `ff` (10 min keskituuli) vaan LIUKUVA TUNNIN KESKIARVO: kuuden
   viimeisen `ff`:n keskiarvo (Houtribdijk 21.10 9,28 = 9,28 ja 21.20
   8,32 = 8,32, Muiden 7,85 / 7,86, Schiphol 7,33 / 7,34, Lelystad 6,82 /
   6,83; IJmuiden ei täsmää), ja `maximum:PT0S` on tunnin suurin `ff`. Siksi se on listan viimeinen, tunnin keskiarvon jälkeen:
   se valitaan vain asemalle jolla muuta tuulta ei ole. */
export const NOPEUS = ['wind_speed:10.0:mean:PT10M', 'wind_speed:10.0:point:PT10M', 'wind_speed:10.0:point:PT0S',
  'wind_speed:10.0:mean:PT2M', 'wind_speed:10.0:mean:PT1M', 'wind_speed:10.0:mean:PT1H', 'wind_speed:2.0:point:PT0S'];
export const SUUNTA = ['wind_from_direction:10.0:mean:PT10M', 'wind_from_direction:10.0:point:PT10M',
  'wind_from_direction:10.0:point:PT0S', 'wind_from_direction:10.0:mean:PT2M', 'wind_from_direction:10.0:mean:PT1M',
  'wind_from_direction:10.0:mean:PT1H'];
export const PUUSKA = ['wind_speed_of_gust:10.0:maximum:PT10M', 'wind_speed_of_gust:10.0:point:PT10M',
  'wind_speed_of_gust:10.0:point:PT30M', 'wind_speed_of_gust:10.0:maximum:PT1H', 'wind_speed_of_gust:10.0:point:PT1H',
  'wind_speed_of_gust:2.0:maximum:PT0S'];
/* Lämpö: Suomen asemat julkaisevat sen vain minuutin ja tunnin
   keskiarvona (`mean:PT1M` 188 asemaa, `mean:PT1H`), muut hetkenä. */
export const LAMPO = ['air_temperature:2.0:point:PT10M', 'air_temperature:2.0:point:PT0S',
  'air_temperature:1.5:point:PT0S', 'air_temperature:1.2:point:PT0S', 'air_temperature:2.0:mean:PT1M',
  'air_temperature:2.0:point:PT1M', 'air_temperature:2.0:mean:PT1H'];
export const TUULI_PARAMETRIT = NOPEUS.concat(SUUNTA, PUUSKA);

/* ── Laattajako ───────────────────────────────────────────────────── */

/* 4° × 4°: puhelimen näkymä zoomilla 8 on 1–2 laattaa ja työpöydän 3–8,
   ja tihein laatta (Keski-Eurooppa) on E-SOH:lta alle 1 MB ja 1,2 s. */
export const ASTE = 4;
export const LAATTA_X = 360 / ASTE, LAATTA_Y = 180 / ASTE;
export function laattaKohdassa(lat, lng) {
  return { x: Math.floor((lng + 180) / ASTE), y: Math.floor((lat + 90) / ASTE) };
}
export function laatanRajat(x, y) {
  const w = x * ASTE - 180, s = y * ASTE - 90;
  return { w: w, s: s, e: w + ASTE, n: s + ASTE };
}
export function laatanAvain(x, y) { return x + '_' + y; }

/* ── Haku ─────────────────────────────────────────────────────────── */

export class EsohVirhe extends Error {
  constructor(viesti, tila) { super(viesti); this.name = 'EsohVirhe'; this.tila = tila || 0; }
}

/* JSON tai null (404 = ei dataa). Aikaraja koko haulle (`AbortSignal`),
   kuten muissa proxyissa: jumittunut lähde ei saa pitää funktiota auki
   sen kattoon asti. */
async function hae(polku, aikaraja) {
  let r;
  try {
    r = await fetch(ESOH + polku, { headers: { 'user-agent': UA, accept: 'application/json' },
      signal: AbortSignal.timeout(aikaraja || 12000) });
  } catch (e) {
    throw new EsohVirhe('E-SOH: ' + (e.name === 'TimeoutError' ? 'aikaraja ' + (aikaraja || 12000) + ' ms' : e.message), 0);
  }
  if (r.status === 404) { await r.arrayBuffer().catch(() => null); return null; }
  if (!r.ok) {
    const teksti = await r.text().catch(() => '');
    throw new EsohVirhe('E-SOH HTTP ' + r.status + (teksti ? ': ' + teksti.slice(0, 160) : ''), r.status);
  }
  return r.json();
}

/* Kysely parametrilistalla. Tuntematon nimi kaataa koko kyselyn, joten
   ne luetaan virheestä ja kysely uusitaan kerran ilman niitä. */
async function haeParametreilla(polkuIlmanParametreja, parametrit, aikaraja) {
  let lista = parametrit.slice();
  for (let yritys = 0; ; yritys++) {
    const erotin = polkuIlmanParametreja.indexOf('?') >= 0 ? '&' : '?';
    try {
      return await hae(polkuIlmanParametreja + erotin + 'parameter-name=' + encodeURIComponent(lista.join(',')), aikaraja);
    } catch (e) {
      const m = e.tila === 400 && /Unknown parameter-name\s*\[([^\]]*)\]/.exec(e.message);
      if (!m || yritys > 0) throw e;
      const tuntemattomat = m[1].split(',').map((s) => s.trim().replace(/^'|'$/g, ''));
      lista = lista.filter((p) => tuntemattomat.indexOf(p) < 0);
      if (!lista.length) throw e;
    }
  }
}

export function isoS(ms) { return new Date(ms).toISOString().slice(0, 19) + 'Z'; }

/* Alueen havainnot jaksolla [alku, loppu]. null = alueella ei dataa. */
export function haeAlue(rajat, alkuMs, loppuMs, parametrit, aikaraja) {
  const { w, s, e, n } = rajat;
  const poly = 'POLYGON((' + w + ' ' + s + ',' + e + ' ' + s + ',' + e + ' ' + n + ',' + w + ' ' + n + ',' + w + ' ' + s + '))';
  return haeParametreilla('/area?coords=' + encodeURIComponent(poly) + '&datetime=' + isoS(alkuMs) + '/' + isoS(loppuMs),
    parametrit || TUULI_PARAMETRIT, aikaraja);
}

/* Yhden aseman havainnot (`locations/{wigos}`). null = ei dataa. */
export function haeAsema(id, alkuMs, loppuMs, parametrit, aikaraja) {
  return haeParametreilla('/locations/' + encodeURIComponent(id) + '?datetime=' + isoS(alkuMs) + '/' + isoS(loppuMs),
    parametrit || TUULI_PARAMETRIT.concat(LAMPO), aikaraja);
}

/* WIGOS-tunnus: sarja-julkaisija-numero-paikallinen. Osoitteeseen
   menee vain tämän muotoinen (L10: käyttäjän syöte ei kulje
   sellaisenaan ylävirran osoitteeseen). */
export function kelpoTunnus(id) {
  return typeof id === 'string' && /^\d{1,2}-\d{1,5}-\d{1,5}-[A-Za-z0-9_.-]{1,32}$/.test(id);
}

/* ── CoverageJSON asemiksi ────────────────────────────────────────── */

/* Yksikkö parametrin omasta kuvauksesta: vastaus kertoo sen, joten sitä
   ei oleteta (vrt. vedenkorkeus, jonka yksikkö ei lukenut vastauksessa). */
function muunnin(p) {
  const u = p && p.unit, sym = ((u && u.symbol && (u.symbol.value || u.symbol)) || (u && u.label && u.label.en) || '').toString();
  if (/^(m\/s|m s-1|m·s⁻¹)$/i.test(sym)) return (v) => v;
  if (/^(kn|knot|knots|kt)$/i.test(sym)) return (v) => v * 0.514444;
  if (/^km\/h$/i.test(sym)) return (v) => v / 3.6;
  if (/^(°|deg|degree|degrees)$/i.test(sym)) return (v) => v;
  if (/^(°C|Cel|degC)$/i.test(sym)) return (v) => v;
  if (/^K$/.test(sym)) return (v) => v - 273.15;
  return null;
}

/* KELVOTON ARVO ON PUUTTUVA. Lähteessä on puuttuvan merkkinä mitattuja
   lukuja: ranskalaisen aseman `air_temperature:2.0:point:PT10M` oli koko
   vuorokauden −273 (°C, eli 0 K), vaikka saman aseman `point:PT0S` antoi
   16–21 °C. Rajojen ulkopuolinen arvo pudotetaan jo jäsennyksessä, jolloin
   tyhjä parametri ei voita etusijassa toimivaa. */
function kelpoRaja(nimi) {
  if (/^wind_from_direction:/.test(nimi)) return [0, 360];
  if (/^wind_speed/.test(nimi)) return [0, 75];
  if (/^air_temperature:/.test(nimi)) return [-80, 60];
  return [-Infinity, Infinity];
}

/* CoverageJSON (Coverage tai CoverageCollection) -> Map(wigos -> asema),
   asema = { id, lat, lng, sarjat: { parametri: Map(ms -> arvo) } }.
   Asemalla voi olla useampi kattavuus (10 min ja tunnin sarjat eri
   kattavuuksina), joten ne yhdistetään tunnuksen mukaan. */
export function jasenna(cj, asemat) {
  const ulos = asemat || new Map();
  if (!cj) return ulos;
  const kattavuudet = cj.type === 'CoverageCollection' ? (cj.coverages || []) : [cj];
  const yhteiset = cj.parameters || {};
  for (const c of kattavuudet) {
    const id = c['metocean:wigosId'];
    const ax = c.domain && c.domain.axes;
    if (!id || !ax || !ax.t || !ax.x || !ax.y) continue;
    const ajat = ax.t.values.map((t) => Date.parse(t));
    let a = ulos.get(id);
    if (!a) { a = { id: id, lat: +ax.y.values[0], lng: +ax.x.values[0], sarjat: {} }; ulos.set(id, a); }
    const parametrit = c.parameters || yhteiset;
    for (const nimi of Object.keys(c.ranges || {})) {
      const muunna = muunnin(parametrit[nimi] || yhteiset[nimi]);
      if (!muunna) continue;
      const arvot = c.ranges[nimi].values || [], raja = kelpoRaja(nimi);
      const sarja = a.sarjat[nimi] || (a.sarjat[nimi] = new Map());
      for (let i = 0; i < ajat.length && i < arvot.length; i++) {
        const v = arvot[i];
        if (v == null || !isFinite(v) || !isFinite(ajat[i])) continue;
        const m = muunna(+v);
        if (m < raja[0] || m > raja[1]) continue;
        sarja.set(ajat[i], m);
      }
    }
  }
  return ulos;
}

function lahteet(lista, sarjat) {
  return lista.filter((p) => sarjat[p] && sarjat[p].size);
}

/* Aseman rivit aikajärjestyksessä: hetket joilla on tuuli, ja samalta
 * hetkeltä suunta, puuska ja lämpö. `null` jos tuulta ei ole.
 *
 * TUULI ON YKSI PARAMETRI KOKO SARJALLE (eniten arvoja, tasapelissä
 * etusija): se määrää rivit, eikä menetelmä saa vaihtua kesken käyrän.
 * Puuska, suunta ja lämpö TÄYDENTYVÄT HETKITTÄIN etusijajärjestyksessä:
 * DWD:n tuntiasemalla (Norderney) tunnin puuska puuttuu synop-tunneilta
 * (16 / 24), ja yhden parametrin sääntö jätti joka kolmannen tunnin
 * ilman puuskaa. Puuskan järjestys ei riipu aseman tahdista: tahti
 * lasketaan rivien väleistä, ja keräimen 15 minuutin ikkunassa se on
 * eri kuin proxyn vuorokaudessa — aiempi tahdin mukainen järjestys
 * antoi saman tunnin puuskalle kaksi eri arvoa (96,4 % samoja). */
export function asemanRivit(a) {
  const s = a.sarjat, nopeudet = lahteet(NOPEUS, s);
  if (!nopeudet.length) return null;
  /* Etusijalta ensimmäinen jolla on vähintään puolet suurimmasta
     määrästä. Pelkkä "eniten arvoja" valitsi Suomen asemalle
     vuorokaudessa kahden minuutin keskiarvon (yksi arvo enemmän) ja
     keräimen ikkunassa kymmenen minuutin — 0,2–1,0 m/s ero samaan
     tuntiin. */
  let maxN = 0;
  for (const p of nopeudet) maxN = Math.max(maxN, s[p].size);
  const pWs = nopeudet.find((p) => s[p].size >= maxN / 2);
  const ws = s[pWs];
  const ajat = Array.from(ws.keys()).sort((x, y) => x - y);
  const valit = [];
  for (let i = 1; i < ajat.length; i++) valit.push(ajat[i] - ajat[i - 1]);
  valit.sort((x, y) => x - y);
  const tahtiMin = valit.length ? valit[valit.length >> 1] / 60000 : 60;
  const puuskat = lahteet(PUUSKA, s), suunnat = lahteet(SUUNTA, s), lammot = lahteet(LAMPO, s);
  const arvo = (lista, ms) => {
    for (const p of lista) { const v = s[p].get(ms); if (v != null) return v; }
    return null;
  };
  return {
    tahtiMin: tahtiMin,
    lampomittari: lammot.length > 0,
    rivit: ajat.map((ms) => ({ ms: ms, ws: ws.get(ms), wg: arvo(puuskat, ms), wd: arvo(suunnat, ms), ta: arvo(lammot, ms) })),
  };
}

/* Tunnin näyte: rivi jonka hetki on [H − 10 min, H + 5 min] ja lähinnä
   H:ta. Tuntiasema raportoi tasatunnilla, 10 min asema saa H:n oman
   rivinsä; myöhästyneelle tasatunnille (:50-asemat) kelpaa edellinen. */
export function tunninNayte(rivit, H) {
  let paras = null, pd = Infinity;
  for (const r of rivit) {
    if (r.ms < H - 10 * 60000 || r.ms > H + 5 * 60000) continue;
    const d = Math.abs(r.ms - H) + (r.ms > H ? 1 : 0);
    if (d < pd) { pd = d; paras = r; }
  }
  return paras;
}

/* Laatan ja varaston tarkkuus: tuuli 0,1 m/s, suunta asteina. */
export const r1 = (v) => (v == null ? null : Math.round(v * 10) / 10);
export const r0 = (v) => (v == null ? null : Math.round(v) % 360);

/* ── Maarasteri: rannikko vai sisämaa ─────────────────────────────── */

/* `tools/maat.json` (Natural Earth 1:50m, 0,05°, bitti 0x80 = maata,
   alemmat bitit = lähin maa; meri kuuluu lähimmälle rannikkomaalle
   150 km:iin). Luetaan kerran instanssia kohti (~20 ms). */
let _maat = null;
function maat() {
  if (_maat) return _maat;
  const M = JSON.parse(readFileSync(new URL('../tools/maat.json', import.meta.url), 'utf8'));
  M.d = gunzipSync(Buffer.from(M.data, 'base64'));
  _maat = M;
  return M;
}

/* TAGI ON SAMA AVAIN KUIN SUOMEN REKISTERISSÄ (`Meri`, `Lento`): se
   ratkaisee lukeman zoomin (meri z8, maa z10), kerroskytkimen (meri on
   oletuksena näkyvissä, maa ei) ja sen, ohittaako asema sisämaan aseman
   rannikon spotille (`pref`).
     Meri   merta 3 km:n sisällä (rannikko, satama, saari, majakka)
     Lento  sisämaan lentoasema nimen perusteella
     Jarvi  järveä 3 km:n sisällä (ei lentoasema), ks. `jarvenRannalla`
   SÄDE ON MITATTU SUOMEN REKISTERIÄ VASTEN: 3 km antaa 20/21 asemalle
   saman meri/maa-luokan kuin käsin kirjoitettu tagi (ainoa ero
   Kaisaniemi, 2,8 km rasterin merestä), 5 km 19/21 (myös Tapiola
   rannikoksi). Koko Euroopassa 564 rannikkoasemaa 3 428:sta.
   `Avomeri`a ei anneta: rasterin solmuväli on 0,05° (5,6 km
   pohjoiseen), ja sataman asema jonka lähin solmu osuu veteen olisi
   valitsimessa "avomeri". Järvet ovat maarasterissa maata, ja niille on
   oma rasteri (`Jarvi`, alla). */
/* JÄRVI ON VETTÄ (10.10., docs/eurooppa.md luku 16). Maarasterissa
   järvet ovat maata, joten IJsselmeerin, Bodenjärven ja Geneven rannan
   asemat olivat sisämaata: oletuksena piilossa, lukema vasta z10:stä, ja
   spottikortti ohitti ne 40 km:n päässä olevalla meriasemalla (Pampus:
   IJmuiden 40 km eikä Muiden 6 km). `Jarvi` käyttäytyy kuin `Meri`
   (kerros, lukeman zoom, `pref`), mutta sen nimi on "Järvi". Sama
   3 km:n säde, ja oma rasteri (`tools/jarvet.json`, Natural Earth
   1:10m lakes), koska maarasteri omistaa mallien käyttöalueet. */
let _jarvet = null;
function jarvenRannalla(lat, lng) {
  try {
    if (!_jarvet) {
      const J = JSON.parse(readFileSync(new URL('../tools/jarvet.json', import.meta.url), 'utf8'));
      J.b = gunzipSync(Buffer.from(J.data, 'base64'));
      _jarvet = J;
    }
    const J = _jarvet;
    const i0 = Math.round((lng - J.lo0) / J.askel), j0 = Math.round((lat - J.la0) / J.askel);
    const kx = 111.2 * Math.cos(lat * Math.PI / 180), ky = 111.2, r2 = RANTA_KM * RANTA_KM;
    const ri = Math.ceil(RANTA_KM / (kx * J.askel)), rj = Math.ceil(RANTA_KM / (ky * J.askel));
    for (let j = Math.max(0, j0 - rj); j <= Math.min(J.nj - 1, j0 + rj); j++) {
      for (let i = Math.max(0, i0 - ri); i <= Math.min(J.ni - 1, i0 + ri); i++) {
        const s = j * J.ni + i;
        if (!(J.b[s >> 3] & (1 << (s & 7)))) continue;
        const dx = (J.lo0 + i * J.askel - lng) * kx, dy = (J.la0 + j * J.askel - lat) * ky;
        if (dx * dx + dy * dy <= r2) return true;
      }
    }
  } catch (e) { /* rasteri puuttuu: ei järveä */ }
  return false;
}

const LENTO = /AIRPORT|AIRFIELD|AERODROME|AIR BASE|LUFTHAVN|FLYPLASS|FLYGPLATS|AEROPORT|AÉROPORT|AEROPUERTO|AEROPORTO|FLUGHAFEN|FLUGPLATZ|LOTNISKO|LETIŠT|LENTOASEMA|LENTOKENTT|REPÜLŐ|ZRAČNA LUKA|AERODROM/i;
export const RANTA_KM = 3;
export function asemanTiedot(lat, lng, nimi) {
  let tagi = null, maa = null;
  try {
    const M = maat();
    const i0 = Math.round((lng - M.lo0) / M.askel), j0 = Math.round((lat - M.la0) / M.askel);
    if (i0 >= 0 && j0 >= 0 && i0 < M.ni && j0 < M.nj) {
      const oma = M.d[j0 * M.ni + i0];
      if ((oma & 0x7f) > 0) maa = M.koodit[(oma & 0x7f) - 1] || null;
      let meri = !(oma & 0x80);
      const kx = 111.2 * Math.cos(lat * Math.PI / 180), ky = 111.2, r2 = RANTA_KM * RANTA_KM;
      const ri = Math.ceil(RANTA_KM / (kx * M.askel)), rj = Math.ceil(RANTA_KM / (ky * M.askel));
      for (let j = Math.max(0, j0 - rj); j <= Math.min(M.nj - 1, j0 + rj) && !meri; j++) {
        for (let i = Math.max(0, i0 - ri); i <= Math.min(M.ni - 1, i0 + ri); i++) {
          if (M.d[j * M.ni + i] & 0x80) continue;
          const dx = (M.lo0 + i * M.askel - lng) * kx, dy = (M.la0 + j * M.askel - lat) * ky;
          if (dx * dx + dy * dy <= r2) { meri = true; break; }
        }
      }
      if (meri) tagi = 'Meri';
    }
  } catch (e) { /* rasteri puuttuu: ei tagia */ }
  /* Järvi ennen lentoasemaa, koska vesi luetaan SIJAINNISTA: keräin
     (`tools/esoh.mjs`) ei tunne nimiä, ja nimen mukaan eri tagi antaisi
     kaukopisteelle ja merkille eri kerroksen (Kuopion ja Kajaanin kentät
     ovat järven rannalla). */
  if (!tagi && jarvenRannalla(lat, lng)) tagi = 'Jarvi';
  if (!tagi && LENTO.test(nimi || '')) tagi = 'Lento';
  return { tagi: tagi, maa: maa };
}

/* NIMI SELLAISENAAN, VAIN KIRJOITUSASU SIISTITÄÄN. Paikannimiä ei
   käännetä (CLAUDE.md). Lähteessä nimet ovat usein versaalilla ja
   alaviivoin ("MILFORD_HAVEN_CONSERVANCY_BOARD"): alaviiva välilyönniksi
   ja kokonaan versaalinen nimi sanoittain isolla alkukirjaimella.
   Numeron sisältävä sana (FV650, E6) ja roomalainen numero (II) jäävät
   versaaliksi. Pienaakkosin kirjoitettu nimi (Suomi, Islanti) jää. */
const ROOMA = /^(I|II|III|IV|V|VI|VII|VIII|IX|X)$/;
const LYHENTEET = /^(AWS|RAF|MCAS|ASOS|NATO|TV|LH)$/;
export function siistiNimi(raaka) {
  /* Nimi on ylävirran dataa ja päätyy sovelluksessa HTML:ään (L10):
     kulmasulut ja lainausmerkki pois jo tässä, ja asiakas escapoi silti. */
  let s = String(raaka || '').replace(/[<>"]/g, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s || /\p{Ll}/u.test(s)) return s;
  return s.split(' ').map(function (sana) {
    if (/\d/.test(sana) || ROOMA.test(sana) || LYHENTEET.test(sana)) return sana;
    return sana.toLowerCase().replace(/(^|[-(/.'’])(\p{L})/gu, function (m, a, b) { return a + b.toUpperCase(); });
  }).join(' ');
}

/* ── Laatan asemat (`/locations?bbox`) ────────────────────────────── */

/* Asemaluettelo muuttuu harvoin: muistissa vuorokauden lämpimässä
   instanssissa. Vanhentunut luettelo kelpaa jos uusi haku kaatuu. */
const _luettelot = new Map();
const LUETTELO_MS = 24 * 36e5;

export async function laatanAsemat(x, y, aikaraja) {
  const avain = laatanAvain(x, y), m = _luettelot.get(avain);
  if (m && Date.now() - m.t < LUETTELO_MS) return m.asemat;
  const { w, s, e, n } = laatanRajat(x, y);
  let fc;
  try {
    fc = await hae('/locations?bbox=' + [w, s, e, n].join(','), aikaraja || 10000);
  } catch (err) {
    if (m) return m.asemat;
    throw err;
  }
  const asemat = new Map();
  /* TYHJÄÄ LUETTELOA EI MUISTETA vuorokaudeksi: avomeren laatta on
     oikeasti tyhjä, mutta ohimenevä 404 ei saa pyyhkiä maa-alueen asemia
     päiväksi (CDN pitää tyhjän laatan vastauksen 15 min). */
  for (const f of (fc && fc.features) || []) {
    const ps = (f.properties && f.properties['parameter-name']) || [];
    if (!ps.some((p) => /^wind_speed:10\.0:/.test(p) || NOPEUS.indexOf(p) >= 0)) continue;
    const c = f.geometry && f.geometry.coordinates;
    if (!c || !isFinite(c[0]) || !isFinite(c[1])) continue;
    const lat = +c[1], lng = +c[0];
    /* Rajalla oleva asema kuuluu laatalle jonka sisällä se on. */
    if (lng < w || lng >= e || lat < s || lat >= n) continue;
    const nimi = siistiNimi(f.properties.name) || f.id;
    asemat.set(f.id, Object.assign({ id: f.id, nimi: nimi, lat: lat, lng: lng }, asemanTiedot(lat, lng, f.properties.name)));
  }
  if (asemat.size) _luettelot.set(avain, { t: Date.now(), asemat: asemat });
  return asemat;
}

/* ── Kaukopisteiden asemaluettelo (`esoh/asemat.json`) ────────────────
 *
 * KARTAN KAUKAINEN ZOOM NÄYTTÄÄ EUROOPAN ASEMAT PISTEINÄ kuten Suomen
 * asemat (docs/eurooppa.md, luku 15). Laatat (48 h tunnit) ovat siihen
 * liian raskaita: Euroopan näkymä olisi satoja laattapyyntöjä, ja koko
 * Euroopan `/locations` on lähteessä 4,4 MB ja 12,5 s (mitattu 5.10.).
 * Keräin (`tools/esoh.mjs`) näkee jo joka ajolla koko Euroopan, joten se
 * kirjoittaa luettelon: `{ paivitetty, asemat: { wigos: [lat, lng, meri,
 * päivä] } }`, päivä = viimeisin UTC-päivä jolloin asemalla oli tunnin
 * näyte (päivä eikä tunti, jotta tiedosto ei muutu joka ajolla).
 *
 * Proxy jättää pois Suomen rekisterin kopiot (`pois`, kuten laatassa),
 * asemat joita ei ole nähty kahteen päivään, ja saman aseman toisen
 * tunnuksen (alle 100 m, sama sääntö kuin `kahdennuksetPois`). */
export const ASEMALUETTELO = 'esoh/asemat.json';
const _asemaluettelo = { t: 0, data: null };
export async function asemaluettelo(pois, nytMs) {
  const nyt = nytMs || Date.now();
  if (!_asemaluettelo.data || nyt - _asemaluettelo.t > 10 * 60e3) {
    try {
      const teksti = /^https?:/.test(VARASTO)
        ? (await haeVarastosta(VARASTO + ASEMALUETTELO, { 'user-agent': UA }, 4000)).teksti
        : await readFile(join(VARASTO, ASEMALUETTELO), 'utf8');
      _asemaluettelo.data = JSON.parse(teksti);
    } catch (e) {
      /* Puuttuva tiedosto = keräin ei ole vielä kirjoittanut sitä: tyhjä
         luettelo, ei virhe. Muu virhe: vanha luettelo kelpaa. */
      if (e.status === 404 || e.code === 'ENOENT') _asemaluettelo.data = { asemat: {} };
      else if (!_asemaluettelo.data) throw e;
    }
    _asemaluettelo.t = nyt;
  }
  const data = _asemaluettelo.data, raja = Math.floor(nyt / 864e5) - 2;
  const lista = [];
  for (const id of Object.keys(data.asemat || {})) {
    const a = data.asemat[id];
    if (!Array.isArray(a) || (pois && pois.has(id)) || !(a[3] >= raja)) continue;
    lista.push({ id: id, lat: +a[0], lng: +a[1], meri: a[2] ? 1 : 0, pv: a[3] });
  }
  /* Kahdennukset ruudukolla (0,01°): naapuriruudut riittävät 100 m:n
     säteelle. Tuorein ensin, tasapelissä tunnus aakkosjärjestyksessä,
     jotta vastaus on sama joka kerta. */
  lista.sort((p, q) => (q.pv - p.pv) || (p.id < q.id ? -1 : p.id > q.id ? 1 : 0));
  const ruudut = new Map(), ulos = [];
  for (const a of lista) {
    const ry = Math.floor(a.lat * 100), rx = Math.floor(a.lng * 100), kx = 111.2 * Math.cos(a.lat * Math.PI / 180);
    let sama = false;
    for (let dy = -1; dy <= 1 && !sama; dy++) for (let dx = -1; dx <= 1 && !sama; dx++) {
      for (const b of ruudut.get((ry + dy) + '_' + (rx + dx)) || []) {
        if (Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 111.2) < 0.1) { sama = true; break; }
      }
    }
    if (sama) continue;
    const k = ry + '_' + rx;
    (ruudut.get(k) || ruudut.set(k, []).get(k)).push(a);
    ulos.push([a.id, a.lat, a.lng, a.meri]);
  }
  return { paivitetty: data.paivitetty || null, asemat: ulos };
}

/* Nimi muistista, jos jokin laatta sen jo tuntee (asemakortin sarja). */
export function tunnettuAsema(id) {
  for (const m of _luettelot.values()) { const a = m.asemat.get(id); if (a) return a; }
  return null;
}

/* ── Oma varasto: tunnin näytteet `havainnot`-haarassa ─────────────── */

/* `esoh/<UTC-päivä>/<x>_<y>.json` = { wigos: { "HH": [ws, wg, wd] } }.
   Keräin (tools/esoh.mjs) kirjoittaa tunnit jotka ovat 3–24 h vanhoja,
   joten päättyneen päivän tiedosto ei enää muutu: muistissa 6 h, kuluva
   ja eilinen 10 min. Puuttuva tiedosto on tyhjä (varasto on nuorempi
   kuin pyydetty jakso), muu virhe ohitetaan: varasto on vaihtoehtoinen,
   ja live-jakso näytetään ilman sitä. */
const _paivat = new Map();
export function varastonPolku(paiva, x, y) { return 'esoh/' + paiva + '/' + laatanAvain(x, y) + '.json'; }

export async function luePaiva(paiva, x, y) {
  const avain = paiva + '/' + laatanAvain(x, y), m = _paivat.get(avain);
  const tanaan = new Date().toISOString().slice(0, 10);
  const vanha = paiva < new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  if (m && Date.now() - m.t < (vanha ? 6 * 36e5 : 10 * 60e3)) return m.data;
  const polku = varastonPolku(paiva, x, y);
  let data = null;
  try {
    const teksti = /^https?:/.test(VARASTO)
      ? (await haeVarastosta(VARASTO + polku, { 'user-agent': UA }, 4000)).teksti
      : await readFile(join(VARASTO, polku), 'utf8');
    data = JSON.parse(teksti);
  } catch (e) {
    if (!(e.status === 404 || e.code === 'ENOENT')) return m ? m.data : null;
    data = {};
  }
  if (paiva <= tanaan) _paivat.set(avain, { t: Date.now(), data: data });
  return data;
}

/* Päivät jotka leikkaavat jakson [alku, loppu) UTC:ssa. */
export function paivatJaksolla(alkuMs, loppuMs) {
  const ulos = [];
  for (let t = Math.floor(alkuMs / 864e5) * 864e5; t < loppuMs; t += 864e5) ulos.push(new Date(t).toISOString().slice(0, 10));
  return ulos;
}

/* Varaston tunnit asemittain jaksolla: Map(wigos -> Map(H -> [ws, wg, wd])). */
export async function varastonTunnit(x, y, alkuMs, loppuMs, vainId) {
  const paivat = paivatJaksolla(alkuMs, loppuMs);
  const tiedostot = await Promise.all(paivat.map((p) => luePaiva(p, x, y).catch(() => null)));
  const ulos = new Map();
  tiedostot.forEach(function (data, k) {
    if (!data) return;
    const p0 = Date.parse(paivat[k] + 'T00:00:00Z');
    for (const id of (vainId ? [vainId] : Object.keys(data))) {
      const tunnit = data[id];
      if (!tunnit) continue;
      let m = ulos.get(id);
      for (const hh of Object.keys(tunnit)) {
        const H = p0 + (+hh) * 36e5;
        if (H < alkuMs || H >= loppuMs) continue;
        if (!m) { m = new Map(); ulos.set(id, m); }
        m.set(H, tunnit[hh]);
      }
    }
  });
  return ulos;
}

/* ── Laatta kartalle ──────────────────────────────────────────────── */

/* KARTAN MERKKI TARVITSEE TUNNIN: pilleri näyttää valitun tunnin lukeman
 * (`_histValueAt`, lähin hetki tunnin sisällä), ja tuoreen lukeman
 * erikseen. Siksi laatta antaa jokaiselle asemalle 48 h tunnin näytteet
 * (49 tasatuntia) ja tuoreimman rivin — ei kymmenen minuutin sarjaa,
 * joka olisi kuusinkertainen eikä näkyisi kartalla. Tunnit ovat
 * varastosta (yli 24 h) ja E-SOH:sta (24 h), jälkimmäinen voittaa.
 *
 *   { laatta, t0, dt: 3600000, n: 49,
 *     asemat: [ { id, nimi, lat, lng, tagi, maa,
 *                 ws: [...49], wg: [...49], wd: [...49],
 *                 v: [ms, ws, wg, wd] | null } ] }
 *
 * Asema jolla ei ole yhtään lukemaa 48 tunnissa jätetään pois (sama
 * sopimus kuin FMI:n `null`: tyhjä ikkuna = ei havaintoverkossa nyt).
 * `pois` = tunnukset jotka tulevat muualta (Suomen rekisteri, FMISID). */
export async function rakennaLaatta(x, y, pois, nytMs) {
  const nyt = nytMs || Date.now();
  const H1 = Math.floor(nyt / 36e5) * 36e5, n = 49, t0 = H1 - (n - 1) * 36e5;
  const liveAlku = nyt - 24 * 36e5 + 60e3;
  const [luettelo, cj, varasto] = await Promise.all([
    laatanAsemat(x, y),
    haeAlue(laatanRajat(x, y), liveAlku, nyt),
    varastonTunnit(x, y, t0, liveAlku).catch(() => new Map()),
  ]);
  const live = jasenna(cj);
  const ulos = [];
  for (const a of luettelo.values()) {
    if (pois && pois.has(a.id)) continue;
    const ws = new Array(n).fill(null), wg = new Array(n).fill(null), wd = new Array(n).fill(null);
    let yksikin = false, v = null;
    const vt = varasto.get(a.id);
    if (vt) {
      for (const [H, arr] of vt) {
        const i = Math.round((H - t0) / 36e5);
        if (i < 0 || i >= n || !arr || arr[0] == null) continue;
        ws[i] = arr[0]; wg[i] = arr[1] == null ? null : arr[1]; wd[i] = arr[2] == null ? null : arr[2];
        yksikin = true;
      }
    }
    const la = live.get(a.id), rr = la ? asemanRivit(la) : null;
    if (rr && rr.rivit.length) {
      for (let i = 0; i < n; i++) {
        const H = t0 + i * 36e5;
        if (H < liveAlku - 10 * 60000) continue;
        const r = tunninNayte(rr.rivit, H);
        if (!r) continue;
        ws[i] = r1(r.ws); wg[i] = r1(r.wg); wd[i] = r0(r.wd);
        yksikin = true;
      }
      const vika = rr.rivit[rr.rivit.length - 1];
      v = [vika.ms, r1(vika.ws), r1(vika.wg), r0(vika.wd)];
      yksikin = true;
    }
    if (!yksikin) continue;
    /* `tahti` = aseman tavallinen väli minuutteina: kolmen tunnin
       synop-asema ei ole "ei signaalia" lukemiensa välissä. */
    ulos.push({ id: a.id, nimi: a.nimi, lat: a.lat, lng: a.lng, tagi: a.tagi, maa: a.maa,
      tahti: rr ? Math.round(rr.tahtiMin) : null, ws: ws, wg: wg, wd: wd, v: v });
  }
  return { laatta: laatanAvain(x, y), t0: t0, dt: 36e5, n: n, asemat: kahdennuksetPois(ulos) };
}

/* SAMA ASEMA KAHDELLA TUNNUKSELLA. Luettelossa on 170 tuuliasemaparia alle
   kilometrin päässä toisistaan, joista 146 alle 50 m: Met Office julkaisee
   aseman sekä WMO-numerolla (0-20000-0-03803, tunneittain) että omalla
   tunnuksellaan (0-826-0-…, 10 min), ja kartalla ne olisivat kaksi
   merkkiä päällekkäin. Alle 100 m:n päässä toisistaan olevista jää se
   jonka lukema on tuorein, sitten se jolla on eniten tunteja. Satojen
   metrien päässä toisistaan olevat ovat eri mittareita (tiesääasema ja
   synop, "FOKSTUGU" ja "E6 FOKSTUGU") ja jäävät molemmat. */
export function kahdennuksetPois(asemat) {
  const tunteja = (a) => a.ws.reduce((s, v) => s + (v != null ? 1 : 0), 0);
  const jarjestys = asemat.slice().sort((p, q) => ((q.v ? q.v[0] : 0) - (p.v ? p.v[0] : 0)) || (tunteja(q) - tunteja(p)));
  const pidetyt = [];
  for (const a of jarjestys) {
    const kx = 111.2 * Math.cos(a.lat * Math.PI / 180);
    const sama = pidetyt.some((b) => Math.hypot((a.lng - b.lng) * kx, (a.lat - b.lat) * 111.2) < 0.1);
    if (!sama) pidetyt.push(a);
  }
  /* Alkuperäinen (luettelon) järjestys takaisin: vastaus ei muutu tunnista
     toiseen lukemien mukaan. */
  const pois = new Set(asemat.filter((a) => pidetyt.indexOf(a) < 0));
  return asemat.filter((a) => !pois.has(a));
}

/* ── Asemakortin sarja ────────────────────────────────────────────── */

/* Sama muoto kuin `api/fmi.js`:n historia (`{ws:[{t,v,d,iso}], wg, ta}`),
 * joten `_renderLiveHistory` piirtää sen ilman omaa haaraa. 24 h täydellä
 * tarkkuudella E-SOH:sta ja sitä vanhemmat tunnit varastosta (tunnin
 * näytteet). `latest` on tuorein rivi. */
export async function rakennaSarja(id, lat, lng, tunnit, tz, nytMs) {
  const nyt = nytMs || Date.now();
  const alku = nyt - tunnit * 36e5, liveAlku = nyt - 24 * 36e5 + 60e3;
  const { x, y } = laattaKohdassa(lat, lng);
  const [cj, varasto] = await Promise.all([
    haeAsema(id, Math.max(alku, liveAlku), nyt),
    alku < liveAlku ? varastonTunnit(x, y, alku, liveAlku, id).catch(() => new Map()) : Promise.resolve(new Map()),
  ]);
  const la = jasenna(cj).get(id), rr = la ? asemanRivit(la) : null;
  const rivit = [];
  const ensimmainenLive = rr && rr.rivit.length ? rr.rivit[0].ms : Infinity;
  const vt = varasto.get(id);
  if (vt) {
    Array.from(vt.keys()).sort((p, q) => p - q).forEach(function (H) {
      const arr = vt.get(H);
      if (H >= ensimmainenLive || !arr || arr[0] == null) return;
      rivit.push({ ms: H, ws: arr[0], wg: arr[1], wd: arr[2], ta: null });
    });
  }
  if (rr) for (const r of rr.rivit) if (r.ms >= alku) rivit.push(r);
  const tunnettu = tunnettuAsema(id);
  const nimi = tunnettu ? tunnettu.nimi : id;
  if (!rivit.length) return { error: 'no data', station: nimi, place: id, ws: [], wg: [], ta: [] };
  const ws = [], wg = [], ta = [];
  for (const r of rivit) {
    const iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
    ws.push({ t: t, v: Math.round(r.ws * 100) / 100, d: r.wd == null ? null : Math.round(r.wd), iso: iso });
    if (r.wg != null) wg.push({ t: t, v: Math.round(r.wg * 100) / 100, iso: iso });
    if (r.ta != null) ta.push({ t: t, v: Math.round(r.ta * 10) / 10, iso: iso });
  }
  const vika = rivit[rivit.length - 1], tuorein = rr && rr.rivit.length ? rr.rivit[rr.rivit.length - 1] : null;
  let tmp = null;
  if (rr) for (let i = rr.rivit.length - 1; i >= 0; i--) if (rr.rivit[i].ta != null) { tmp = Math.round(rr.rivit[i].ta * 10) / 10; break; }
  const lastIso = new Date(vika.ms).toISOString();
  return {
    station: nimi, place: id, lat: lat, lng: lng,
    ws: ws, wg: wg, ta: ta,
    lastIso: lastIso, ageMin: Math.round((nyt - vika.ms) / 60000),
    tahtiMin: rr ? Math.round(rr.tahtiMin) : 60,
    /* Lämpömittarin lippu kuten Larulla: `false` jättää kortin ilman
       lämpötilaa eikä näytä viivaa (CLAUDE.md, Laru). */
    lampomittari: !!(rr && rr.lampomittari),
    latest: tuorein ? {
      ws: tuorein.ws, wg: tuorein.wg, wd: tuorein.wd == null ? null : Math.round(tuorein.wd), tmp: tmp,
      time: hhmm(tuorein.ms, tz), lastIso: new Date(tuorein.ms).toISOString(),
      ageMin: Math.round((nyt - tuorein.ms) / 60000), station: nimi, place: id,
    } : null,
  };
}
