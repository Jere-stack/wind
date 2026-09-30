/* YHTEINEN HAKU PROXYILLE (docs/oikeellisuus.md, O5).
 *
 * Alaviiva nimen alussa: apumoduuli eikä reitti, joten Vercelin 12
 * funktion katto ei kasva (CLAUDE.md).
 *
 * MIKSI. Jokaisella proxylla oli oma `fetchUrl`, joka palautti rungon
 * tilakoodista riippumatta eikä sillä ollut aikarajaa. FMI vastaa
 * virheeseen HTTP 400:lla ja `<ExceptionReport>`-rungolla (mitattu
 * 29.9.2026: liian pitkä jakso, 817 B), jolloin jäsennys ei löytänyt
 * rivejä ja proxy vastasi `{ error: 'no data' }` HTTP 200:lla. Sovellus
 * lukee sen merkinnän LAKKAUTUKSEKSI ja poistaa aseman kartalta
 * (CLAUDE.md, "KATKO JA LAKKAUTUS OVAT ERI ASIA") — eli ylävirran
 * virhe tai kiintiön täyttyminen pyyhki havaintoasemat kartalta.
 *
 * Nyt kaksi tasoa:
 *   haeTeksti(url, { aikaraja, otsakkeet, raaka }) -> { tila, runko [, puskuri] }
 *   haeFmi(url, { aikaraja, tyhjaPoikkeuksesta }) -> runko
 *     Heittää `HakuVirhe`en kun tila ei ole 200 tai runko on
 *     ExceptionReport. Pisteennusteelle (WAM, vedenkorkeus) FMI vastaa
 *     400 + "No data available for '<paikka>'!" silloin kun piste on
 *     mallin ulkopuolella (mitattu 29.9.: Tampere ja Keski-Eurooppa) —
 *     se on tyhjä kate eikä vika, ja `tyhjaPoikkeuksesta` palauttaa
 *     silloin tyhjän rungon (proxy vastaa 'no data' kuten ennenkin).
 *     Vain TÄMÄ teksti on tyhjä kate; muu 400 (väärä parametri, liian
 *     pitkä jakso) on virhe. Havainnoille virhe on aina virhe. */
import https from 'https';

export const AIKARAJA_MS = 8000;

export class HakuVirhe extends Error {
  constructor(viesti, tila) {
    super(viesti);
    this.name = 'HakuVirhe';
    this.tila = tila || 0;
  }
}

/* `raaka: true` palauttaa rungon puskurina (`puskuri`) tekstin sijaan —
   gzip-tiedostot (api/uiras.js). */
export function haeTeksti(url, asetukset) {
  const aikaraja = (asetukset && asetukset.aikaraja) || AIKARAJA_MS;
  const otsakkeet = asetukset && asetukset.otsakkeet;
  const raaka = !!(asetukset && asetukset.raaka);
  return new Promise(function (resolve, reject) {
    let ajastin = null;
    const valmis = function (f, arvo) { clearTimeout(ajastin); f(arvo); };
    const req = https.get(url, otsakkeet ? { headers: otsakkeet } : {}, function (res) {
      const osat = [];
      res.on('data', function (c) { osat.push(c); });
      res.on('error', function (e) { valmis(reject, e); });
      res.on('end', function () {
        const puskuri = Buffer.concat(osat);
        valmis(resolve, raaka ? { tila: res.statusCode, puskuri: puskuri, runko: '' }
                              : { tila: res.statusCode, runko: puskuri.toString('utf8') });
      });
    });
    req.on('error', function (e) { valmis(reject, e); });
    /* AIKARAJA KOKO HAULLE, EI JOUTOAJALLE: ilman sitä yksi jumiin jäänyt
       lähde piti funktiota auki 30 s:n kattoon asti (sama sääntö kuin
       harmonie.js:ssä ja malli.js:n S3-luvussa). `req.setTimeout` olisi
       joutoaika, ja mitattuna 1,2 s:n raja laukesi vasta 2,4 s:ssa —
       hitaasti valuva vastaus ei laukaisisi sitä lainkaan. */
    ajastin = setTimeout(function () {
      req.destroy(new HakuVirhe('aikakatkaisu ' + aikaraja + ' ms', 0));
    }, aikaraja);
  });
}

const POIKKEUS = /^\s*(?:<\?xml[^>]*\?>\s*)?<ExceptionReport\b/;
export function onPoikkeus(runko) { return POIKKEUS.test(runko || ''); }

export async function haeFmi(url, asetukset) {
  const v = await haeTeksti(url, asetukset);
  const poikkeus = onPoikkeus(v.runko);
  if (v.tila === 200 && !poikkeus) return v.runko;
  const teksti = ((v.runko.match(/<ExceptionText>([\s\S]*?)<\/ExceptionText>/) || [])[1] || '').trim();
  if (asetukset && asetukset.tyhjaPoikkeuksesta && v.tila === 400 && /^No data available/i.test(teksti)) return '';
  throw new HakuVirhe('FMI HTTP ' + v.tila + (teksti ? ': ' + teksti.slice(0, 120) : ''), v.tila);
}
