/* Rajapintojen yhteinen suoja (docs/julkaisu.md, L10).
 *
 * Alaviiva nimen alussa: Vercel ei tee tästä omaa funktiota, eikä
 * vite.config.js:n dev-reititys tarjoile sitä.
 *
 * KAKSI ASIAA:
 *
 * 1. EI `Access-Control-Allow-Origin: *`IA. Jokainen funktio vastasi
 *    ennen jokerilla, jolloin mikä tahansa sivu saattoi käyttää näitä
 *    proxyja omasta selaimestaan — tämän palvelun FMI- ja
 *    Open-Meteo-kiintiöllä ja Vercelin funktioajalla. Sovellus kutsuu
 *    niitä aina samasta originista (`API_BASE = '/api'`), eikä
 *    saman originin pyyntö tarvitse CORS-otsaketta lainkaan, joten
 *    otsake yksinkertaisesti jätetään pois.
 *
 * 2. KEVYT PYYNTÖRAJA IP:TÄ KOHTI. Muistissa, lämpimän instanssin
 *    elinajan: se ei ole täydellinen (instansseja voi olla useita), mutta
 *    pysäyttää yksittäisen silmukan joka takoo samaa instanssia. Raja on
 *    väljä, koska sovellus itse tekee käynnistyksessä noin 75 pyyntöä ja
 *    rajapintavaratiellä panorointi kymmeniä lisää: 300 pyynnön säiliö,
 *    joka täyttyy viisi pyyntöä sekunnissa. */

const SAILIO = 300;
const TAYTTO_S = 5;
const MAX_IP = 5000;
const ipt = new Map();

function osoite(req) {
  const h = (req.headers && (req.headers['x-forwarded-for'] || req.headers['x-real-ip'])) || '';
  const ensin = String(h).split(',')[0].trim();
  return ensin || (req.socket && req.socket.remoteAddress) || 'tuntematon';
}

/* Palauttaa false (ja on jo vastannut 429:llä) jos raja ylittyi. */
export function suojaa(req, res) {
  const ip = osoite(req);
  const nyt = Date.now();
  let s = ipt.get(ip);
  if (!s) {
    s = { t: nyt, n: SAILIO };
    if (ipt.size >= MAX_IP) ipt.delete(ipt.keys().next().value);
    ipt.set(ip, s);
  } else {
    s.n = Math.min(SAILIO, s.n + (nyt - s.t) / 1000 * TAYTTO_S);
    s.t = nyt;
  }
  if (s.n < 1) {
    res.setHeader('Retry-After', '10');
    res.setHeader('Cache-Control', 'no-store');
    res.status(429).json({ error: 'liikaa pyyntöjä' });
    return false;
  }
  s.n -= 1;
  return true;
}
