/* LARU (Lauttasaari, Helsinki) — Lauttasaaren leijalautailijat ry:n
 * saaasema, mittari Nahkahousun saarella.
 *
 * Ei kuulu FMI:n havaintoverkkoon, joten oma proxy kuten Mellstenilla
 * ja Kruunuvuorenselalla. Lahde on dlarah.org:n tuulisivun oma
 * datahakemisto:
 *
 *   wind_data/stations.txt             "vuosi,vuodenpaiva" + asemalista
 *   wind_data/Laru_<vuosi>-<paiva>.txt yksi vuorokausi, ~1,7 min valein
 *
 * Rivin muoto, paivays, tiedostonimet ja lampomittarin puute:
 * api/_laru.js.
 *
 * HISTORIA 168 h (docs/data.md, "Larun historia"). Kuluva paiva haetaan
 * aina lahteesta, koska lahde antaa sen kokonaan ja tuoreena. Menneet
 * paivat luetaan varastosta (haara `havainnot`, tools/laru.mjs kopioi
 * paattyneet paivat), ja jos varastosta puuttuu paiva, se haetaan
 * lahteesta: lahde pitaa kaikki paivat vuosien takaa, joten historia on
 * taysi vaikka keraaja ei olisi ehtinyt ajaa (GitHubin ajastin ei ole
 * luotettava, docs/data.md). Varasto on siis valimuisti ja varmuuskopio —
 * ilman sita jokainen korttiavaus hakisi lahteesta seitseman 37 kt:n
 * tiedostoa. VARASTOSSA ON VAIN VALMIITA PAIVIA (keraaja kopioi paivan
 * vasta puoli tuntia keskiyon jalkeen), joten siella oleva paiva on koko
 * paiva eika sita tarvitse tarkistaa lahteesta.
 *
 * SIJAINTI JA YKSIKKO on varmistettu Windgurun asemalta 47
 * ("Lauttasaari / Larukite", lat 60.150824, lon 24.87184, alt 7 m,
 * timezone Europe/Helsinki). Sama asema kolmella tavalla:
 *   - suunta tasmasi (173,9° taalla vs 173,5° siella, 2 min valissa)
 *   - nopeuksien suhde oli 1,94–2,07 eli SOLMUT/METRIT: Windguru antaa
 *     solmuja, tama lahde METREJA SEKUNNISSA
 *   - molemmat kertovat lampotilaksi "ei mittausta"
 */
import { suojaa } from './_suoja.js';
import { kameraVastaus } from './_kamerat.js';
import { LAHDE, OTSAKKEET, jasennaLaru, paivanTiedosto, kuluvaLahteesta } from './_laru.js';
import {
  haeTeksti, luePaivat, paivatValilla, helsinkiPaiva, paivaSiirra, seinaAjaksi,
  niputaAjassa, nipunLeveys, kymmenenMinuuttia, hhmm, kelpoTz,
} from './_varasto.js';

const STATION = { name: 'Helsinki Laru', place: 'laru', lat: 60.1508, lng: 24.8718 };
/* Lahde paivittyy noin kahden minuutin valein. */
const TTL_TUOREIN = 60;
const TTL_HISTORIA = 180;
const HISTORIA_OLETUS = 24;
const HISTORIA_MAX = 168;

/* Yksi uusintayritys, sama perustelu kuin api/mellsten.js:ssa. 404 ei
   parane uusinnalla: se on puuttuva paiva, ei ohimenevä vika. */
async function haeLahteesta(tiedosto) {
  try { return (await haeTeksti(LAHDE + tiedosto, OTSAKKEET, 6000)).teksti; }
  catch (e) {
    if (e.status === 404) throw e;
    await new Promise(function (r) { setTimeout(r, 400); });
    return (await haeTeksti(LAHDE + tiedosto, OTSAKKEET, 6000)).teksti;
  }
}

/* Lahteen kuluva paiva ja sen rivit. Paivatiedoston nimi tulee lahteen
   OMASTA luettelosta, ei laskemalla: `stations.txt`:n ensimmainen rivi on
   "vuosi,paiva" sen mukaan mika on lahteen mielesta kuluva vuorokausi.
   Itse laskettu vuodenpaiva menisi pieleen juuri keskiyon molemmin
   puolin, ja silloin vastaus olisi 404. */
async function haeKuluva() {
  var kuluva = kuluvaLahteesta(await haeLahteesta('stations.txt'));
  if (!kuluva) { var e = new Error('stations.txt'); e.luettelo = true; throw e; }
  return { paiva: kuluva, rivit: jasennaLaru(await haeLahteesta(paivanTiedosto(kuluva))) };
}

/* Mennyt paiva lahteesta, kun varasto ei sita tuntenut. Paattynyt paiva
   on muuttumaton, joten lammin instanssi muistaa sen — mutta vasta puoli
   tuntia keskiyon jalkeen, samalla marginaalilla jolla keraaja pitaa
   paivaa valmiina (tools/laru.mjs). Tyhjaa ei muisteta (sama saanto kuin
   varastolla). */
const _lahdeMuisti = new Map();
const LAHDE_MUISTI_MS = 6 * 36e5;
async function mennytLahteesta(paiva, nyt) {
  var m = _lahdeMuisti.get(paiva);
  if (m && nyt - m.t < LAHDE_MUISTI_MS) return m.rivit;
  var rivit;
  try { rivit = jasennaLaru((await haeTeksti(LAHDE + paivanTiedosto(paiva), OTSAKKEET, 5000)).teksti); }
  catch (e) { if (e.status === 404) rivit = []; else throw e; }
  var valmis = nyt >= seinaAjaksi(paivaSiirra(paiva, 1), 0, 30);
  if (rivit.length && valmis) _lahdeMuisti.set(paiva, { t: nyt, rivit: rivit });
  return rivit;
}

function tuorein(v, tz, nyt) {
  return {
    /* Lippu myos tanne: kortti lukee historiavastauksesta `latest`in,
       ja ilman lippua Larun kortissa nakyi tyhja "Ilma · havainto —"
       -laatta (docs/julkaisu.md, UI 14). */
    ws: v.ws, wd: v.wd, wg: v.wg, tmp: null, lampomittari: false,
    time: hhmm(v.ms, tz), lastIso: new Date(v.ms).toISOString(),
    ageMin: Math.round((nyt - v.ms) / 60000),
  };
}

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  /* LARUN KELIKAMERAN TILA (api/_kamerat.js). Tassa eika omana
     reittinaan: `api/kamera.js` oli kolmastoista funktio, ja Vercelin
     Hobby-taso sallii kaksitoista deployta kohti — tuotantodeploy kaatui.
     Kuva vaihtuu viiden minuutin valein ja tila hitaammin; minuutti
     CDN:ssa pitaa kutsut kurissa eika nayta vanhaa. */
  if (req.query.kamera === '1') {
    var vastaus = await kameraVastaus(Date.now());
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240');
    return res.status(200).json(vastaus);
  }
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var nyt = Date.now();

  try {
    if (!isHistory) {
      var k = await haeKuluva();
      if (!k.rivit.length) {
        return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
      }
      /* Tuorein lukema 10 min jaksona kuten FMI:lla (api/_varasto.js). */
      var u = kymmenenMinuuttia(k.rivit);
      res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_TUOREIN + ', stale-while-revalidate=60');
      /* EI LAMPOTILAA. Sarake on nolla joka rivilla eika asemalla ole
         mittaria; nolla asteena olisi keksitty lukema. */
      return res.status(200).json(Object.assign({
        station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
        wsMin: u.wsMin,
      }, tuorein(u, tz, nyt)));
    }

    var tunnit = Math.max(1, Math.min(HISTORIA_MAX, parseInt(req.query.hours, 10) || HISTORIA_OLETUS));
    var raja = nyt - tunnit * 3600000;
    /* Menneet paivat: varasto sisaltaa vain paattyneita paivia, joten
       kuluva jatetaan pois. Lahde ja varasto rinnakkain (eri palvelimet);
       kumpikin saa epaonnistua yksin. */
    var tanaan = helsinkiPaiva(nyt);
    var menneet = paivatValilla(raja, nyt).filter(function (p) { return p < tanaan; });
    var tulos = await Promise.allSettled([haeKuluva(), luePaivat('laru', menneet, jasennaLaru, null)]);
    var kuluva = tulos[0].status === 'fulfilled' ? tulos[0].value : { paiva: null, rivit: [] };
    var varastosta = tulos[1].status === 'fulfilled' ? tulos[1].value
      : menneet.map(function (p) { return { paiva: p, rivit: [], virhe: tulos[1].reason }; });
    /* Varastosta puuttuvat paivat lahteesta. Rinnakkain ja ilman
       uusintaa: tavallisesti niita ei ole yhtaan (keraaja on kopioinut
       ne), ja pahimmillaan ne ovat kuusi kertahakua. Lahteen kuluvaa
       paivaa ei haeta toiseen kertaan. */
    var puuttuvat = varastosta.filter(function (t) { return !t.rivit.length && t.paiva !== kuluva.paiva; });
    var lahteesta = await Promise.allSettled(puuttuvat.map(function (t) { return mennytLahteesta(t.paiva, nyt); }));

    /* Minuutti avaimena; lahteen kuluva paiva voittaa. */
    var kaikki = new Map(), nVarasto = 0, nLahde = 0, virheita = 0;
    varastosta.forEach(function (t) {
      nVarasto += t.rivit.length;
      t.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    });
    lahteesta.forEach(function (t) {
      if (t.status !== 'fulfilled') { virheita++; return; }
      nLahde += t.value.length;
      t.value.forEach(function (r) { kaikki.set(r.ms, r); });
    });
    kuluva.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    var rivit = Array.from(kaikki.values()).sort(function (a, b) { return a.ms - b.ms; });
    if (!rivit.length) {
      if (tulos[0].status === 'rejected') throw tulos[0].reason;
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }
    /* Tuorein lukema 10 min jaksona kuten FMI:lla (docs/oikeellisuus.md,
       O10; api/_varasto.js). */
    var v = kymmenenMinuuttia(rivit);

    var ikkuna = rivit.filter(function (r) { return r.ms >= raja; });
    /* Asema on ollut hiljaa koko ikkunan: viimeiset tunnetut rivit, jotta
       kortti voi sanoa "viimeisin …" eika vain "ei dataa". */
    if (!ikkuna.length) ikkuna = rivit.slice(-30);
    /* Viiden minuutin niput AJAN mukaan (api/_varasto.js), jotta katko
       jaa katkoksi: lukumaaraan perustuva harvennus veti nipun katkon yli. */
    var nippuMin = nipunLeveys(ikkuna);
    var niput = niputaAjassa(ikkuna, nippuMin);
    /* SARJAN VIIMEINEN PISTE ON SAMA LUKEMA KUIN `latest`, EI NIPUN
       KESKIARVO. Kortin iso luku on `latest`, ja kaavion oikea reuna on
       suoraan sen alla — jos ne eroavat, ero nayttaa vialta vaikka
       molemmat ovat oikein omalla tavallaan. `latest` on tuoreimman rivin
       hetkella paattyva 10 min jakso (O10), joten se korvaa viimeisen
       nipun tai rivin samalla hetkella. */
    var pn = niput.length ? niput[niput.length - 1].ms : -Infinity;
    if (pn === v.ms) niput = niput.slice(0, -1).concat([v]);
    else if (pn < v.ms) niput = niput.concat([v]);

    var ws = [], wg = [];
    for (var i = 0; i < niput.length; i++) {
      var r = niput[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
      ws.push({ t: t, v: r.ws, d: r.wd, iso: iso });
      wg.push({ t: t, v: r.wg != null ? r.wg : r.ws, iso: iso });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_HISTORIA + ', stale-while-revalidate=60');
    return res.status(200).json(Object.assign({
      station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
      wsMin: v.wsMin,
    }, tuorein(v, tz, nyt), {
      ws: ws, wg: wg,
      /* `ta` on tyhja taulukko eika puuttuva kentta: kayttoliittyma
         osaa piirtaa ilman lampokayraa, mutta `undefined` nayttaisi
         vialta. */
      ta: [],
      ikkunaMin: Math.round((ikkuna[ikkuna.length - 1].ms - ikkuna[0].ms) / 60000),
      nippuMin: nippuMin,
      pisteita: niput.length,
      /* Mista rivit tulivat: kaavio ei tarvitse tata, mittari tarvitsee. */
      lahteet: { tuore: kuluva.rivit.length, kuluva: kuluva.paiva, varasto: nVarasto,
        lahde: nLahde, lahdePaivia: puuttuvat.length, paivia: menneet.length, virheita: virheita },
      latest: tuorein(v, tz, nyt),
    }));
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
