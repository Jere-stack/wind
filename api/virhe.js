/* Selaimen virheraportit palvelimen lokiin (docs/julkaisu.md, L9).
 *
 * Ennen selaimessa kaatunut skripti ei jättänyt jälkeä mihinkään: vika
 * nähtiin vasta kun käyttäjä kertoi siitä. Sovellus lähettää tänne
 * `navigator.sendBeacon`illa virheen tekstin, pinon alun, version,
 * selaimen tunnisteen ja sivun polun — ei sijaintia, ei koordinaatteja,
 * ei tunnisteita (Tietoa-näkymän tietosuojateksti sanoo saman).
 * Raportti kirjoitetaan Vercelin funktiolokiin yhtenä JSON-rivinä.
 *
 * Kaikki kentät katkaistaan: loki ei saa olla tapa kirjoittaa mitä
 * tahansa kenen tahansa puolesta, ja pyyntöraja (`suojaa`) pitää määrän
 * kurissa. */
import { suojaa } from './_suoja.js';

const MAX_TAVUT = 8192;

function lueRunko(req) {
  if (req.body != null) return Promise.resolve(typeof req.body === 'string' ? req.body : JSON.stringify(req.body));
  return new Promise(function (resolve) {
    let runko = '';
    req.on('data', function (c) { runko += c; if (runko.length > MAX_TAVUT) req.destroy(); });
    req.on('end', function () { resolve(runko); });
    req.on('error', function () { resolve(''); });
  });
}

const leikkaa = (x, n) => String(x == null ? '' : x).slice(0, n);

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST' });
  let r = null;
  try { r = JSON.parse((await lueRunko(req)).slice(0, MAX_TAVUT)); } catch (e) { r = null; }
  if (!r || typeof r !== 'object') return res.status(400).json({ error: 'virheellinen raportti' });
  console.error('[selainvirhe] ' + JSON.stringify({
    laji: leikkaa(r.laji, 40),
    viesti: leikkaa(r.viesti, 500),
    pino: leikkaa(r.pino, 1500),
    versio: leikkaa(r.versio, 60),
    polku: leikkaa(r.polku, 120),
    ua: leikkaa(req.headers['user-agent'], 200),
  }));
  res.statusCode = 204;
  res.end();
}
