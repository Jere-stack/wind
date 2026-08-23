/* FoilSpotin service worker.
 *
 * Tavoite on yksi asia: kartta ja sovellus aukeavat rannalla yhdellä
 * palkilla. Ei datansäästöä, ei taustapäivitystä — vain se ettei heikko
 * verkko estä käynnistystä.
 *
 * MITÄ TÄSSÄ EI VÄLIMUISTITETA: /api. Sovelluksella on jo oma
 * ennustevälimuisti localStoragessa, ja se osaa merkitä datan
 * vanhentuneeksi (ks. "Käynnistys: välimuisti ruudulle ennen verkkoa" ja
 * "Verkkotila" CLAUDE.md:ssä). Toinen välimuisti tämän alla tarjoaisi
 * vanhaa dataa tuoreena eikä sovellus tietäisi siitä mitään.
 */

const LEIMA = '__BUILD_ID__';
/* Devissä leima on korvaamatta, jolloin service worker ei tee mitään.
   Muuten Viten HMR ja oma välimuisti sotkeutuisivat keskenään. */
const DEV = LEIMA.slice(0, 7) === '__BUILD';

/* Vain commit-osa nimeen: koko leimassa on valilyonteja ja piste, jotka
   tekevat valimuistin nimesta hankalasti luettavan devtoolsissa. */
const KUORI  = 'kuori-' + LEIMA.split(' ')[0];
/* Laattavälimuistia EI versioida. Sen koko arvo on että eilen katsotut
   laatat ovat tallessa tänään — jos se tyhjenisi joka deployssa, rannalla
   ei olisi mitään. */
const LAATAT = 'laatat-v1';
const LAATTA_KATTO = 600;

const KUORI_TIEDOSTOT = [
  '/',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.min.js',
];

const onLaatta = (u) =>
  u.hostname === 'services.arcgisonline.com' ||
  u.hostname.endsWith('.basemaps.cartocdn.com');

const onKuori = (u) =>
  u.hostname === 'cdn.jsdelivr.net' && u.pathname.includes('leaflet@1.9.4');

self.addEventListener('install', (e) => {
  if (DEV) return;
  e.waitUntil((async () => {
    const c = await caches.open(KUORI);
    /* addAll kaatuu kokonaan jos yksikin osoite pettää, ja CDN voi olla
       nurin juuri asennushetkellä. Haetaan siis erikseen. */
    await Promise.all(KUORI_TIEDOSTOT.map(async (u) => {
      try { const r = await fetch(u, { cache: 'reload' }); if (r.ok) await c.put(u, r); }
      catch (err) { /* jää seuraavaan käyntiin */ }
    }));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    for (const n of await caches.keys()) {
      if (n.startsWith('kuori-') && n !== KUORI) await caches.delete(n);
    }
    await self.clients.claim();
  })());
});

/* Laattavälimuisti kasvaisi rajatta. Siivotaan harvakseltaan eikä joka
   put:n yhteydessä: cache.keys() on koko avainlistan läpikäynti. */
let putLaskuri = 0;
async function siivoaLaatat() {
  if (++putLaskuri % 50) return;
  const c = await caches.open(LAATAT);
  const avaimet = await c.keys();
  const yli = avaimet.length - LAATTA_KATTO;
  for (let i = 0; i < yli; i++) await c.delete(avaimet[i]);
}

/* Navigointi: verkko edellä mutta aikakatkaisulla.
 *
 * Verkko edellä siksi, että sovellus on YKSI index.html ilman
 * hajautettuja tiedostonimiä — cache-first jäädyttäisi koko sovelluksen
 * vanhaan versioon eikä siitä näkyisi mitään ulospäin.
 *
 * Aikakatkaisu siksi, että "yksi palkki" ei ole sama kuin "ei verkkoa":
 * ilman sitä käynnistys jäisi roikkumaan hitaan haun taakse. 3 s jälkeen
 * näytetään välimuisti ja haku jatkuu taustalla. */
async function navigointi(e) {
  const c = await caches.open(KUORI);
  const varalla = await c.match('/');
  const verkosta = fetch(e.request)
    .then((r) => { if (r.ok) c.put('/', r.clone()); return r; });

  if (!varalla) return verkosta.catch(() => new Response(
    'FoilSpot ei ole vielä käynyt verkossa tällä laitteella.',
    { status: 503, headers: { 'Content-Type': 'text/plain; charset=utf-8' } }));

  return Promise.race([
    verkosta.catch(() => varalla),
    new Promise((r) => setTimeout(() => r(varalla), 3000)),
  ]);
}

self.addEventListener('fetch', (e) => {
  if (DEV || e.request.method !== 'GET') return;
  let u;
  try { u = new URL(e.request.url); } catch (err) { return; }
  if (u.protocol !== 'https:' && u.protocol !== 'http:') return;

  if (e.request.mode === 'navigate') { e.respondWith(navigointi(e)); return; }

  if (onKuori(u)) {
    /* Versioitu osoite: sisältö ei voi muuttua, joten välimuisti edellä. */
    e.respondWith((async () => {
      const c = await caches.open(KUORI);
      const osuma = await c.match(e.request);
      if (osuma) return osuma;
      const r = await fetch(e.request);
      if (r.ok) c.put(e.request, r.clone());
      return r;
    })());
    return;
  }

  if (onLaatta(u)) {
    /* Vanhene-ja-virkistä. Laatat ovat <img>-hakuja ilman CORSia, joten
       vastaus on läpinäkymätön eikä sen onnistumista voi tarkistaa —
       cache-first jättäisi yhden epäonnistuneen laatan pysyvästi ruudulle.
       Virkistys korjaa sellaisen seuraavalla käynnillä, ja välimuistista
       tarjoillaan silti heti. */
    e.respondWith((async () => {
      const c = await caches.open(LAATAT);
      const osuma = await c.match(e.request);
      const haku = fetch(e.request)
        .then((r) => { if (r.status === 200 || r.type === 'opaque') {
          c.put(e.request, r.clone()); siivoaLaatat(); } return r; })
        .catch(() => null);
      if (osuma) return osuma;
      const r = await haku;
      return r || Response.error();
    })());
    return;
  }

  /* Kaikki muu — /api mukaan lukien — menee koskemattomana verkkoon. */
});
