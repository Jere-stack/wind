/* LARUN RIVIT — yhteinen jasennin kahdelle kayttajalle:
 *
 *   api/laru.js      proxy, joka tarjoilee sovellukselle historian
 *   tools/laru.mjs   keraaja, joka kopioi paattyneet paivat varastoon
 *
 * Alaviiva nimen alussa: Vercel ei tee tasta omaa funktiota, eika
 * vite.config.js:n dev-reititys tarjoile sita.
 *
 * LAHDE PITAA KAIKKI PAIVAT. `wind_data/Laru_<vuosi>-<vuodenpaiva>.txt`
 * on yksi Helsingin vuorokausi noin 1,7 min valein (~860 rivia, ~37 kt),
 * ja lahde tarjoilee myos menneet paivat: mitattu 29.9.2026, vastasivat
 * mm. 2026-1, 2026-100, 2026-271, 2025-365, 2024-300 ja 2023-150.
 * Paattyneen paivan Last-Modified on 23:59:5x Suomen aikaa (talvella ja
 * kesalla), eli tiedosto on Helsingin vuorokausi ja valmis keskiyolla.
 *
 * RIVIN MUOTO on luettu lahteen OMASTA jasentimesta
 * (`wind_data/history_graph.js`, funktio `parseData`), ei arvattu:
 *
 *   2026,9,8,13,6,13:05,183.5,5.4,6.7,7.7,0.0
 *   [0]  [1][2][3][4][5]  [6]  [7] [8] [9] [10]
 *   vuosi kk pv  h  ?  hh:mm suunta min  KA  max lampo
 *
 * Keskituuli on `fields[8]` eli KOLMAS tuuliluku — sama jarjestys kuin
 * Mellstenilla (min, ka, max). Varmistettu myos riippumatta
 * jasentimesta: min <= ka <= max piti 474/474 rivilla.
 *
 * `fields[3]` on kirjoitushetken tunti, ja lahteen oma jasennin korjaa
 * sen avulla keskiyon yli menevat rivit (`hour - checkHour > 20` ->
 * edellinen vuorokausi). Se on todellinen tapaus eika teoria: 28.9:n
 * tiedoston ensimmainen rivi on "2026,9,28,0,1,23:59,…" eli 27.9. klo
 * 23:59, kirjoitettu 00:01. Rivit paivataan siksi omista kentistaan eika
 * tiedoston nimesta, ja paivien rivit yhdistetaan minuutin mukaan.
 *
 * `nan`-rivit ohitetaan, kuten lahteen jasennin tekee.
 *
 * ASEMALLA EI OLE LAMPOMITTARIA. Lampotilasarake on 0.0 JOKAISELLA
 * rivilla (474/474 mitattuna), ja Windgurun sama asema palauttaa
 * `"temperature": null`. Nolla ei siis ole lukema vaan puuttuva arvo. */
import { seinaAjaksi } from './_varasto.js';

export const LAHDE = 'https://dlarah.org/wind_data/';
export const ASEMA = 'Laru';

/* USER-AGENT ON PAKOLLINEN. Mitattu ja toistettava: lahde vastaa
   403:lla kun otsaketta ei ole ja 200:lla kun se on. Noden `https.get`
   ei laheta sellaista oletuksena, joten ilman tata koko asema jaisi
   pysyvasti tyhjaksi — eika mikaan kertoisi miksi. (Eri asia kuin
   api/mellsten.js:n ohimeneva 403, joka toistui vain kerran.) */
export const OTSAKKEET = {
  'user-agent': 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)',
  'accept': 'text/plain,*/*',
};

function luku(x) {
  var v = parseFloat(x);
  return isFinite(v) ? v : null;
}

/* Rivit -> pisteet { ms, wd, wsMin, ws, wg }. Paivays tulee rivilta
   itseltaan (kentat 0–2), joten sita ei tarvitse paatella nykyhetkesta
   kuten Mellstenilla. Toinen parametri (varaston paiva) jatetaan
   huomiotta juuri siksi. */
export function jasennaLaru(teksti) {
  var ulos = [];
  var rivit = String(teksti).split('\n');
  for (var i = 0; i < rivit.length; i++) {
    var rivi = rivit[i];
    if (!rivi || rivi.indexOf('nan') >= 0) continue;   /* kuten lahteen oma jasennin */
    var f = rivi.split(',');
    if (f.length < 11) continue;
    var aika = f[5].indexOf('T') > 0 ? f[5].split('T')[1] : f[5];
    var osat = /^\s*(\d{1,2}):(\d{2})/.exec(aika);
    if (!osat) continue;
    var y = parseInt(f[0], 10), mo = parseInt(f[1], 10), d = parseInt(f[2], 10);
    var checkHour = parseInt(f[3], 10);
    var hh = parseInt(osat[1], 10), mm = parseInt(osat[2], 10);
    if (!isFinite(y) || !isFinite(mo) || !isFinite(d) || !isFinite(hh) || !isFinite(mm)) continue;
    /* Sama korjaus kuin lahteen jasentimessa: kellonaika voi olla
       edelliselta vuorokaudelta. */
    var paivaSiirto = 0;
    if (isFinite(checkHour) && hh - checkHour > 20) paivaSiirto = -1;
    var paiva = new Date(Date.UTC(y, mo - 1, d + paivaSiirto)).toISOString().slice(0, 10);
    var ws = luku(f[8]);
    if (ws == null) continue;
    ulos.push({
      ms: seinaAjaksi(paiva, hh, mm),
      wd: luku(f[6]), wsMin: luku(f[7]), ws: ws, wg: luku(f[9]),
    });
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* "2026-09-29" -> { vuosi: 2026, pv: 272 } (vuodenpaiva, 1.1. = 1). */
export function vuodenPaiva(paiva) {
  var p = paiva.split('-');
  var t = Date.UTC(+p[0], +p[1] - 1, +p[2]);
  return { vuosi: +p[0], pv: Math.round((t - Date.UTC(+p[0], 0, 1)) / 864e5) + 1 };
}
/* { vuosi, pv } -> "2026-09-29". */
export function paivaVuodenPaivasta(vuosi, pv) {
  return new Date(Date.UTC(vuosi, 0, 1) + (pv - 1) * 864e5).toISOString().slice(0, 10);
}
/* Lahteen tiedostonimi Helsingin paivalle: "Laru_2026-272.txt". */
export function paivanTiedosto(paiva) {
  var v = vuodenPaiva(paiva);
  return ASEMA + '_' + v.vuosi + '-' + v.pv + '.txt';
}

/* `stations.txt`:n ensimmainen rivi on "vuosi,vuodenpaiva" sen mukaan
   mika on lahteen mielesta kuluva vuorokausi. Palauttaa Helsingin
   paivan tai null. */
export function kuluvaLahteesta(luettelo) {
  var eka = String(luettelo).split('\n')[0].split(',');
  var vuosi = parseInt(eka[0], 10), pv = parseInt(eka[1], 10);
  if (!isFinite(vuosi) || !isFinite(pv) || pv < 1 || pv > 366) return null;
  return paivaVuodenPaivasta(vuosi, pv);
}
