/* MELLSTENIN RIVIT — yhteinen jasennin kahdelle kayttajalle:
 *
 *   api/mellsten.js       proxy, joka tarjoilee sovellukselle historian
 *   tools/havainnot.mjs   keraaja, joka tallentaa historian varastoon
 *
 * Alaviiva nimen alussa: Vercel ei tee tasta omaa funktiota, eika
 * vite.config.js:n dev-reititys tarjoile sita (kuten `_suoja.js`).
 *
 * RIVIN MUOTO on lahteen omalla sivulla dokumentoitu, ei arvattu:
 *
 *   " 08:45 197°   5.6 <  6.5 <  7.8   14.9°C  1009.1  85.5%   0.0"
 *     aika  suunta min <  ka  < max    lampo   paine   kosteus sade
 *
 * Keskituuli on KOLMAS luku (ka), ei ensimmainen. Puuska on maksimi.
 *
 * AIKALEIMASSA ON VAIN KELLONAIKA, SUOMEN AIKAA. Paivays tulee
 * ANKKURISTA, ja ankkuri riippuu tiedostosta:
 *
 *   weather.txt           HTTP:n Last-Modified. Nykyhetki EI kelpaa:
 *                         kun asema sammuu (pilvisella saalla, aurinko-
 *                         paneeli), tiedostoon jaa viimeiset 30 rivia
 *                         vaikka vuorokaudeksi, ja nykyhetkesta laskettuna
 *                         eilisen 01:40 olisi tanaan 01:40.
 *   archive/Day-YY-MM-DD  tiedoston ensimmainen rivi eli luontihetki
 *                         palvelimen vyohykkeessa ("Sun Sep 27 14:00:03
 *                         PDT 2026" = Helsingissa 28.9. klo 00:00).
 *
 * ARKISTON NIMI EI OLE HELSINGIN PAIVA. Palvelin on Kaliforniassa ja
 * nimeaa tiedoston OMAN kalenterinsa mukaan: tavallisesti Helsingin
 * vuorokausi D on tiedostossa D-1, mutta jos asema kaynnistyy katkon
 * jalkeen klo 10 jalkeen Helsingin aikaa, tiedosto on D. Mitattu
 * 29.9.2026: `Day-26-09-27` sisaltaa Helsingin 28.9:n (Windgurun
 * saman aseman 10 min sarja tasmaa siihen, ei 27.9:aan). */

/* Helsingin kalenteri on yhteinen Larun kanssa (api/_varasto.js), ja se
   viedaan taalta edelleen, jotta keraaja ja proxy lukevat sen yhdesta
   paikasta. */
import { helsinkiPoikkeamaMs, helsinkiPaiva, paivaSiirra, seinaAjaksi } from './_varasto.js';
export { helsinkiPoikkeamaMs, helsinkiPaiva, paivaSiirra, seinaAjaksi };

export const LAHDE = 'https://mellsten.surfing.fi/';

/* Lahde rajoittaa rinnakkaisia pyyntoja (docs/data.md), ja Larun
   kokemus opetti ettei nimetonta pyyntoa kannata tehda.
 *
 * `no-cache`: lahde lahettaa MINUUTIN VALEIN vaihtuvalle weather.txt:lle
 * `Cache-Control: max-age=172800` (kaksi vuorokautta), ja sen oma sivu
 * varoittaa etta valimuistit antavat usein vanhat tiedot. Pyynto kieltaa
 * matkan varrella olevaa valimuistia vastaamasta ilman tarkistusta. */
export const OTSAKKEET = {
  'user-agent': 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)',
  'accept': 'text/plain,*/*',
  'cache-control': 'no-cache',
};

export const RIVI = /^\s*(\d{1,2}):(\d{2})\s+(-?\d+(?:\.\d+)?)°\s+(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)°C\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)\s*$/;

/* Yksi rivi -> olio, tai null jos rivi ei ole mittausrivi (otsikko,
   tyhja, 404-sivun HTML). `teksti` on alkuperainen rivi ilman BOMia —
   varasto tallettaa sen sellaisenaan. */
export function riviOlioksi(rivi) {
  var m = RIVI.exec(rivi);
  if (!m) return null;
  var h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return {
    h: h, m: mi, hhmm: ('0' + h).slice(-2) + ':' + m[2],
    wd: +m[3], wsMin: +m[4], ws: +m[5], wg: +m[6],
    ta: +m[7], paine: +m[8], kosteus: +m[9], sade: +m[10],
    teksti: rivi.replace(/\s+$/, ''),
  };
}

function rivit(teksti) {
  return String(teksti).replace(/﻿/g, '').replace(/\r/g, '').split('\n');
}

/* weather.txt / lastWeather.txt: paivays ankkurista (Last-Modified).
   Ankkuria myohempi rivi on edelliselta vuorokaudelta (keskiyon yli
   meneva ikkuna); pieni vara kellojen eroon. */
export function jasennaAnkkurista(teksti, ankkuriMs) {
  var paiva = helsinkiPaiva(ankkuriMs);
  var edellinen = paivaSiirra(paiva, -1);
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    var ms = seinaAjaksi(paiva, r.h, r.m);
    r.paiva = paiva;
    if (ms > ankkuriMs + 5 * 60000) { ms = seinaAjaksi(edellinen, r.h, r.m); r.paiva = edellinen; }
    r.ms = ms;
    ulos.push(r);
  }
  /* Lahde listaa uusin ensin; sarja halutaan nousevana. */
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Arkiston otsikkorivi "Sun Sep 27 14:00:03 PDT 2026" -> epoch ms.
   Vyohykkeet ovat ne joita palvelin kayttaa; tuntematon -> null, jolloin
   kutsuja putoaa Last-Modifiediin eika arvaa. */
var KUUT = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
var VYOHYKKEET = { PDT: -7, PST: -8, UTC: 0, GMT: 0, EEST: 3, EET: 2 };
export function arkistonAlku(teksti) {
  var eka = rivit(teksti)[0] || '';
  var m = /^\s*\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+([A-Z]{2,5})\s+(\d{4})/.exec(eka);
  if (!m || !(m[1] in KUUT) || !(m[6] in VYOHYKKEET)) return null;
  return Date.UTC(+m[7], KUUT[m[1]], +m[2], +m[3], +m[4], +m[5]) - VYOHYKKEET[m[6]] * 36e5;
}

/* Arkiston paivatiedosto: paivays luontihetkesta. Tiedosto kattaa
   luontihetkesta Helsingin keskiyohon, joten kaikki rivit ovat samaa
   Helsingin paivaa; luontihetkea aiempi rivi (ei pitaisi olla) siirtyy
   seuraavalle paivalle eika jaa vaaraan kohtaan. */
export function jasennaArkisto(teksti, lastModifiedMs) {
  var alku = arkistonAlku(teksti);
  if (alku == null) {
    return lastModifiedMs ? jasennaAnkkurista(teksti, lastModifiedMs) : [];
  }
  var paiva = helsinkiPaiva(alku);
  var seuraava = paivaSiirra(paiva, 1);
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    var ms = seinaAjaksi(paiva, r.h, r.m);
    r.paiva = paiva;
    if (ms < alku - 10 * 60000) { ms = seinaAjaksi(seuraava, r.h, r.m); r.paiva = seuraava; }
    r.ms = ms;
    ulos.push(r);
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Varaston paivatiedosto: paiva on tiedoston nimessa. */
export function jasennaPaiva(teksti, paiva) {
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    r.paiva = paiva;
    r.ms = seinaAjaksi(paiva, r.h, r.m);
    ulos.push(r);
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Arkiston tiedostonimi palvelimen kalenteripaivalle: "Day-26-09-27". */
export function arkistonNimi(paiva) {
  return 'Day-' + paiva.slice(2, 4) + '-' + paiva.slice(5, 7) + '-' + paiva.slice(8, 10);
}
