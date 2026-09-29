/* MELLSTEN (Haukilahti, Espoo) — Surfing ry:n oma saaasema.
 *
 * Ei kuulu FMI:n havaintoverkkoon, joten oma proxy kuten
 * Kruunuvuorenselalla. Lahteessa on kolme tekstitiedostoa:
 *
 *   lastWeather.txt   uusin rivi, 67 tavua
 *   weather.txt       30 tuoreinta minuuttia, 1,9 kt
 *   archive/Day-YY-MM-DD  paattynyt vuorokausi minuutin valein, ~92 kt
 *
 * Rivin muoto, paivays ja arkiston nimeaminen: api/_mellsten.js.
 *
 * HISTORIA TULEE NELJASTA PAIKASTA (docs/data.md, "Mellstenin historia
 * omaan varastoon" ja "Katkot pois: kuvaaja, arkisto ja ajastinketju"),
 * tarkeysjarjestyksessa:
 *
 *   weather.txt        30 tuoreinta minuuttia, lahteen oma rivi
 *   arkisto            paattynyt paiva, jota keraaja ei ole viela
 *                      yhdistanyt varastoon (tila.json)
 *   varasto            haara `havainnot`: keraajan tallettamat rivit
 *                      (tools/havainnot.mjs) ja niiden paalla arkisto
 *   plot.gif           lahteen 4 tunnin kuvaaja minuuttiriveiksi
 *                      (api/_mellsten.js, `tulkitseKuvaaja`)
 *
 * Varasto riippuu keraajasta, ja keraaja GitHubin ajastimesta, joka ei
 * ole luotettava: havainnot-tyonkulku ei kaynnistynyt kertaakaan kuuteen
 * tuntiin, ja kaaviossa oli katkoja vaikka asema mittasi koko paivan.
 * Siksi viimeiset nelja tuntia luetaan AINA lahteen kuvaajasta ja
 * paattyneet paivat lahteen arkistosta, jos keraaja ei ole ehtinyt:
 * katko jaa vain siihen osaan kuluvaa paivaa, joka on yli nelja tuntia
 * vanhaa eika keraaja ole ajanut sen aikana.
 *
 * LAHTEESEEN PERAKKAIN, EI RINNAKKAIN: palvelin vastaa rinnakkaisiin
 * pyyntoihin 403:lla (ks. alla). Arkistohauilla on aikabudjetti, ja
 * valmis arkisto muistetaan lampimassa instanssissa, joten sama paiva
 * haetaan lahteesta korkeintaan kerran kuudessa tunnissa.
 *
 * Asema on 60,147 / 24,794. Koordinaatti ei ole arvattu: se on Windyn
 * PWS-tietueesta "Surfing Ry Mellsten", jonka lukemat (6,5 m/s, 196°,
 * puuska 8,1, 15,0 °C, 1009,1 hPa, 85,5 %) taspasivat samalla hetkella
 * taman lahteen riviin taydellisesti. */
import { suojaa } from './_suoja.js';
import {
  LAHDE, OTSAKKEET, KUVAAJA, jasennaAnkkurista, jasennaPaiva, jasennaArkisto, arkistonNimi,
  tulkitseKuvaaja, vertaaKuvaajaan, kuvaajaKelpaa,
} from './_mellsten.js';
import {
  haeTeksti, haeTavut, luePaivat, lueTila, paivatValilla, paivaSiirra, helsinkiPaiva,
  niputaAjassa, nipunLeveys, hhmm, kelpoTz,
} from './_varasto.js';

const STATION = { name: 'Espoo Mellsten', place: 'mellsten', lat: 60.147, lng: 24.794 };
/* Lahde paivittyy minuutin valein; 60 s valimuisti riittaa eika
   tarjoile vanhaa. */
const TTL_TUOREIN = 60;
const TTL_HISTORIA = 120;
const HISTORIA_OLETUS = 24;
const HISTORIA_MAX = 168;

/* KOLME YRITYSTA, KASVAVA ODOTUS JA HAJONTA.
 *
 * Lahde on pieni harrastepalvelin ja rajoittaa RINNAKKAISIA pyyntoja:
 * mitattuna perakkain 12/12 onnistui, mutta kuudella rinnakkaisella
 * pyynnolla puolet vastasi 403:lla. Mikaan ei ollut muuttunut — sama
 * osoite onnistui heti perastapain.
 *
 * Yksi uusinta kiinteassa 400 ms:ssa ei riita siihen: jos kuusi pyyntoa
 * epaonnistuu yhta aikaa, ne kaikki uusivat samalla hetkella ja
 * tormaavat samaan rajoitukseen. Siksi odotus kasvaa ja siina on
 * satunnaishajontaa, joka levittaa uusinnat eri hetkille.
 *
 * Asema on spottikortin lahin havainto Haukilahdelle (1 km), ja
 * epaonnistuminen ei nay virheena vaan SEURAAVANA ASEMANA viiden
 * kilometrin paassa — eli vikaa on vaikea huomata, ja juuri siksi
 * uusinnan pitaa olla riittava.
 *
 * Kolme yritysta ei peita oikeaa vikaa: jos lahde on alhaalla, kaikki
 * kolme kaatuvat ja virhe menee lapi kuten ennenkin. 404 ei parane
 * uusinnalla (arkistoa ei ole), joten se heitetaan heti. */
const UUSINNAT = 3;
async function haeLahteesta(url, tavuina) {
  var viimeVirhe = null;
  for (var k = 0; k < UUSINNAT; k++) {
    if (k > 0) {
      var odota = 250 * Math.pow(2, k - 1) + Math.floor(Math.random() * 250);
      await new Promise(function (r) { setTimeout(r, odota); });
    }
    try { return await (tavuina ? haeTavut : haeTeksti)(url, OTSAKKEET, 6000); }
    catch (e) { if (e.status === 404) throw e; viimeVirhe = e; }
  }
  throw viimeVirhe;
}
function fetchTextRetry(url) { return haeLahteesta(url, false); }

/* PAATTYNEEN PAIVAN ARKISTO SUORAAN LAHTEESTA, kun keraaja ei ole viela
 * yhdistanyt sita varastoon (`tila.json`:n `arkisto`). Ilman tata
 * eilinen jaisi katkonaiseksi niin kauan kuin keraaja ei aja — ja sen
 * ajastin jattaa tunteja valiin. Helsingin paiva D on arkistossa D-1 tai
 * D (api/_mellsten.js), joten kumpikin nimi haetaan, perakkain.
 *
 * Valmis arkisto (Last-Modified yli tunti sitten) ei muutu, joten se
 * muistetaan kuudeksi tunniksi; puuttuva nimi puoleksi tunniksi. Haut
 * loppuvat budjettiin: seuraava pyynto jatkaa muistista siita mihin jai. */
const _arkistot = new Map();
const ARKISTO_BUDJETTI_MS = 6000;
/* `paivat` haetaan tarvittaessa lahteesta; `muistista` (muut menneet
   paivat) otetaan vain jos arkisto on jo muistissa. Jalkimmainen sulkee
   kilpailutilanteen: kun keraaja yhdistaa eilisen ja `tila.json`
   kaantyy, lampimalla instanssilla voi olla viela puoli tuntia vanha
   (vajaa) varastokopio eilisesta — muistissa oleva arkisto peittaa sen. */
async function arkistoLahteesta(paivat, nyt, muistista) {
  var ulos = { rivit: [], haettu: 0, virheita: 0, kesken: 0 };
  var haettavat = new Set(), nimet = [];
  function nimetPaivalle(p, hae) {
    [arkistonNimi(paivaSiirra(p, -1)), arkistonNimi(p)].forEach(function (n) {
      if (nimet.indexOf(n) < 0) nimet.push(n);
      if (hae) haettavat.add(n);
    });
  }
  paivat.forEach(function (p) { nimetPaivalle(p, true); });
  (muistista || []).forEach(function (p) { nimetPaivalle(p, false); });
  var tarvitaan = new Set(paivat.concat(muistista || []));
  var alku = Date.now();
  for (var i = 0; i < nimet.length; i++) {
    var nimi = nimet[i], m = _arkistot.get(nimi), rivit = null;
    if (m && Date.now() - m.t < (m.puuttuu ? 30 * 60e3 : 6 * 36e5)) rivit = m.rivit;
    else if (!haettavat.has(nimi)) continue;
    else if (Date.now() - alku > ARKISTO_BUDJETTI_MS) { ulos.kesken++; continue; }
    else {
      try {
        var a = await haeLahteesta(LAHDE + 'archive/' + nimi, false);
        ulos.haettu++;
        rivit = jasennaArkisto(a.teksti, a.muokattu);
        if (!a.muokattu || nyt - a.muokattu > 36e5) _arkistot.set(nimi, { t: Date.now(), rivit: rivit });
      } catch (e) {
        if (e.status !== 404) { ulos.virheita++; continue; }
        rivit = [];
        _arkistot.set(nimi, { t: Date.now(), rivit: rivit, puuttuu: true });
      }
    }
    rivit.forEach(function (r) { if (tarvitaan.has(r.paiva)) ulos.rivit.push(r); });
  }
  return ulos;
}

/* Varaston paivat ikkunan alusta tahan paivaan (api/_varasto.js). */
async function lueVarasto(alkuMs, nytMs) {
  var paivat = paivatValilla(alkuMs, nytMs);
  var tulokset = await luePaivat('mellsten', paivat, jasennaPaiva, helsinkiPaiva(nytMs));
  var rivit = [], virheita = 0;
  tulokset.forEach(function (t) {
    rivit = rivit.concat(t.rivit);
    if (t.virhe) virheita++;
  });
  return { rivit: rivit, paivia: paivat.length, virheita: virheita };
}

function tuorein(v, tz, nyt) {
  return {
    ws: v.ws, wd: v.wd, wg: v.wg, tmp: v.ta,
    time: hhmm(v.ms, tz), lastIso: new Date(v.ms).toISOString(),
    ageMin: Math.round((nyt - v.ms) / 60000),
  };
}

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  var tz = kelpoTz(req.query.tz) || 'Europe/Helsinki';
  var isHistory = req.query.history === '1';
  var nyt = Date.now();

  try {
    if (!isHistory) {
      var yksi = await fetchTextRetry(LAHDE + 'lastWeather.txt');
      /* Ankkuri on tiedoston Last-Modified eika nykyhetki: sammuneen
         aseman viimeinen rivi on eilisen, ei taman paivan. */
      var r1 = jasennaAnkkurista(yksi.teksti, yksi.muokattu || nyt);
      if (!r1.length) {
        return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
      }
      var u = r1[r1.length - 1];
      res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_TUOREIN + ', stale-while-revalidate=60');
      return res.status(200).json(Object.assign({
        station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
        wsMin: u.wsMin, paine: u.paine, kosteus: u.kosteus, sade: u.sade,
      }, tuorein(u, tz, nyt)));
    }

    var tunnit = Math.max(1, Math.min(HISTORIA_MAX, parseInt(req.query.hours, 10) || HISTORIA_OLETUS));
    var raja = nyt - tunnit * 3600000;
    var tanaan = helsinkiPaiva(nyt);
    /* Lahde perakkain (weather.txt, sitten kuvaaja), varasto ja sen tila
       rinnakkain: eri palvelimet. Jokainen saa epaonnistua yksin —
       ilman varastoa vastaus on lahteen 4 h kuten kuvaaja sen antaa, ilman
       kuvaajaa varasto + 30 min kuten ennen. */
    var lahteesta = (async function () {
      var w = null, k = null, virhe = null;
      try { w = await haeLahteesta(LAHDE + 'weather.txt', false); } catch (e) { virhe = e; }
      /* Kuvalla on lahteessa max-age 30 vrk: aikaleima osoitteeseen, kuten
         lahteen oma sivu tekee, ettei mikaan valimuisti anna vanhaa.
         Jos weather.txt ei vastannut, lahde on alhaalla: kuvaajan (ja
         arkiston) uusinnat vain pidentaisivat funktion kestoa. */
      if (!virhe) {
        try { k = await haeLahteesta(LAHDE + KUVAAJA + '?' + Math.floor(nyt / 60000), true); } catch (e) { k = null; }
      }
      return { w: w, k: k, virhe: virhe };
    })();
    var tulos = await Promise.allSettled([lahteesta, lueVarasto(raja, nyt), lueTila('mellsten')]);
    var lahde = tulos[0].value;
    var tuore = lahde.w ? jasennaAnkkurista(lahde.w.teksti, lahde.w.muokattu || nyt) : [];
    var varasto = tulos[1].status === 'fulfilled' ? tulos[1].value : { rivit: [], paivia: 0, virheita: 1 };
    var tila = tulos[2].status === 'fulfilled' ? tulos[2].value : null;

    /* Kuvaaja kelpaa vain jos samat minuutit tekstina tasmaavat. */
    var kuva = { rivit: [] }, tarkistus = null, kuvaOk = false;
    if (lahde.k) {
      kuva = tulkitseKuvaaja(lahde.k.tavut, lahde.k.muokattu);
      tarkistus = vertaaKuvaajaan(kuva.rivit, tuore);
      kuvaOk = kuvaajaKelpaa(kuva, tarkistus);
    }

    /* Paattyneet paivat joita keraaja ei ole yhdistanyt arkistosta. Vasta
       tassa, kun lahteen muut haut ovat valmiita (perakkain). */
    var menneet = paivatValilla(raja, nyt).filter(function (p) { return p < tanaan; });
    var arkistoon = menneet.filter(function (p) {
      return !(tila && tila.paivat && tila.paivat[p] && tila.paivat[p].arkisto);
    });
    var yhdistetyt = menneet.filter(function (p) { return arkistoon.indexOf(p) < 0; });
    var arkisto = lahde.virhe ? { rivit: [], haettu: 0, virheita: 0, kesken: arkistoon.length }
      : await arkistoLahteesta(arkistoon, nyt, yhdistetyt);

    /* Minuutti avaimena, heikoimmasta vahvimpaan: kuvaaja, varasto (sen
       tekstirivi voittaa kuvaajan), arkisto, weather.txt. */
    var kaikki = new Map();
    if (kuvaOk) kuva.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    varasto.rivit.forEach(function (r) {
      var oli = kaikki.get(r.ms);
      if (!oli || !r.kuvaaja) kaikki.set(r.ms, r);
    });
    arkisto.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    tuore.forEach(function (r) { kaikki.set(r.ms, r); });
    if (!kaikki.size) {
      if (lahde.virhe) throw lahde.virhe;
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }
    var rivit = Array.from(kaikki.values()).sort(function (a, b) { return a.ms - b.ms; });
    var v = rivit[rivit.length - 1];

    var ikkuna = rivit.filter(function (r) { return r.ms >= raja; });
    /* Asema on ollut hiljaa koko ikkunan: viimeiset tunnetut rivit, jotta
       kortti voi sanoa "viimeisin …" eika vain "ei dataa" (sama kuin
       ennen, kun historia oli weather.txt:n 30 rivia). */
    if (!ikkuna.length) ikkuna = rivit.slice(-30);
    /* Leveys datan kestosta (api/_varasto.js): ilman varastoa jaljella on
       lahteen 30 minuuttia, ja se nakyy minuutteina kuten ennen. */
    var nippuMin = nipunLeveys(ikkuna);
    var niput = niputaAjassa(ikkuna, nippuMin);
    /* SARJAN VIIMEINEN PISTE ON TUOREIN HAVAINTO, EI NIPUN KESKIARVO
       (sama kuin api/laru.js): kaavion paa on kortin ison luvun alla. */
    if (niput.length && niput[niput.length - 1] !== v) niput = niput.slice(0, -1).concat([v]);

    var ws = [], wg = [], ta = [];
    for (var i = 0; i < niput.length; i++) {
      var r = niput[i], iso = new Date(r.ms).toISOString(), t = hhmm(r.ms, tz);
      ws.push({ t: t, v: r.ws, d: r.wd, iso: iso });
      /* Kuvaajasta ei aina nae maksimia (yli 19 m/s): silloin keskituuli,
         kuten Larulla puuttuvalle puuskalle. Lampotila puuttuu kuvaajan
         riveilta, ja null jaa nulliksi. */
      wg.push({ t: t, v: r.wg != null ? r.wg : r.ws, iso: iso });
      ta.push({ t: t, v: r.ta, iso: iso });
    }
    res.setHeader('Cache-Control', 'public, s-maxage=' + TTL_HISTORIA + ', stale-while-revalidate=60');
    return res.status(200).json(Object.assign({
      station: STATION.name, place: STATION.place, lat: STATION.lat, lng: STATION.lng,
      wsMin: v.wsMin, paine: v.paine, kosteus: v.kosteus, sade: v.sade,
    }, tuorein(v, tz, nyt), {
      ws: ws, wg: wg, ta: ta,
      /* Ikkunan pituus sanotaan, jotta kayttoliittyman ei tarvitse
         paatella sita pisteiden maarasta. */
      ikkunaMin: Math.round((ikkuna[ikkuna.length - 1].ms - ikkuna[0].ms) / 60000),
      nippuMin: nippuMin,
      pisteita: niput.length,
      /* Mista rivit tulivat: kaavio ei tarvitse tata, mittari tarvitsee. */
      lahteet: { tuore: tuore.length, varasto: varasto.rivit.length, varastoPaivia: varasto.paivia,
        varastoVirheita: varasto.virheita,
        kuvaaja: kuvaOk ? kuva.rivit.length : 0, kuvaajaTarkistus: tarkistus,
        kuvaajaSyy: !lahde.k ? 'ei haettu' : kuvaOk ? null : (kuva.syy || 'ei tasmaa'),
        arkisto: arkisto.rivit.length, arkistoPaivia: arkistoon.length, arkistoHakuja: arkisto.haettu,
        arkistoVirheita: arkisto.virheita, arkistoKesken: arkisto.kesken, tila: !!tila },
      latest: tuorein(v, tz, nyt),
    }));
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
