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
 * HISTORIA TULEE OMASTA VARASTOSTA. Lahde ei anna kuluvalta
 * vuorokaudelta kuin 30 minuuttia, joten historia oli ennen puoli
 * tuntia. Nyt keraaja (tools/havainnot.mjs, GitHub Actions 10 min
 * valein) tallettaa lahteen rivit haaraan `havainnot` ja taydentaa ne
 * lahteen arkistosta — kuten Windguru tekee saman aseman kanssa. Tama
 * proxy lukee varaston paivatiedostot ja tuoreimman ikkunan suoraan
 * lahteesta, ja lahteen rivi voittaa saman minuutin varastorivin.
 *
 * Proxy EI hae lahteen arkistoa: se olisi jopa kahdeksan 90 kt:n pyyntoa
 * pienelle harrastepalvelimelle joka korttiavauksella, ja palvelin
 * rajoittaa rinnakkaisia pyyntoja. Arkisto luetaan kerran, keraajassa.
 *
 * Asema on 60,147 / 24,794. Koordinaatti ei ole arvattu: se on Windyn
 * PWS-tietueesta "Surfing Ry Mellsten", jonka lukemat (6,5 m/s, 196°,
 * puuska 8,1, 15,0 °C, 1009,1 hPa, 85,5 %) taspasivat samalla hetkella
 * taman lahteen riviin taydellisesti. */
import { suojaa } from './_suoja.js';
import { LAHDE, OTSAKKEET, jasennaAnkkurista, jasennaPaiva } from './_mellsten.js';
import { haeTeksti, luePaivat, paivatValilla, helsinkiPaiva, niputaAjassa, nipunLeveys, hhmm, kelpoTz } from './_varasto.js';

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
 * kolme kaatuvat ja virhe menee lapi kuten ennenkin. */
const UUSINNAT = 3;
async function fetchTextRetry(url) {
  var viimeVirhe = null;
  for (var k = 0; k < UUSINNAT; k++) {
    if (k > 0) {
      var odota = 250 * Math.pow(2, k - 1) + Math.floor(Math.random() * 250);
      await new Promise(function (r) { setTimeout(r, odota); });
    }
    try { return await haeTeksti(url, OTSAKKEET, 6000); }
    catch (e) { viimeVirhe = e; }
  }
  throw viimeVirhe;
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
    /* Lahde ja varasto rinnakkain: eri palvelimet. Kumpikin saa
       epaonnistua yksin — ilman varastoa vastaus on lahteen 30 min kuten
       ennen, ilman lahdetta varaston tuorein on korkeintaan kymmenen
       minuuttia vanha. */
    var tulos = await Promise.allSettled([
      fetchTextRetry(LAHDE + 'weather.txt'),
      lueVarasto(raja, nyt),
    ]);
    var tuore = tulos[0].status === 'fulfilled'
      ? jasennaAnkkurista(tulos[0].value.teksti, tulos[0].value.muokattu || nyt) : [];
    var varasto = tulos[1].status === 'fulfilled' ? tulos[1].value : { rivit: [], paivia: 0, virheita: 1 };
    if (!tuore.length && !varasto.rivit.length) {
      if (tulos[0].status === 'rejected') throw tulos[0].reason;
      return res.status(200).json({ error: 'no data', station: STATION.name, place: STATION.place });
    }

    /* Minuutti avaimena; lahteen rivi voittaa varaston rivin. */
    var kaikki = new Map();
    varasto.rivit.forEach(function (r) { kaikki.set(r.ms, r); });
    tuore.forEach(function (r) { kaikki.set(r.ms, r); });
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
      wg.push({ t: t, v: r.wg, iso: iso });
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
        varastoVirheita: varasto.virheita },
      latest: tuorein(v, tz, nyt),
    }));
  } catch (err) {
    return res.status(502).json({ error: err.message, station: STATION.name, place: STATION.place });
  }
}
