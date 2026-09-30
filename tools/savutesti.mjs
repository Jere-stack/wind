/* Savutesti: aukeaako sovellus selaimessa (docs/julkaisu.md, L9).
 *
 * `npm run build` ei todista mitään selaimesta (CLAUDE.md), joten tämä
 * lataa tuotantobuildin oikeassa selaimessa puhelimena ja työpöytänä ja
 * tarkistaa sen minkä käyttäjä huomaisi ensimmäisenä:
 *
 *   1. sivulla ei ole yhtään kaatunutta skriptiä (`pageerror`)
 *   2. latausruutu poistuu (`#loading.hidden`) — sovellus ei jää sen alle
 *   3. aikajana rakentuu ja spottimerkit piirtyvät
 *   4. spottikortti, asetukset ja Tietoa-näkymä aukeavat ja Esc sulkee ne
 *
 * Käyttö:  npm run build && npx vite preview --port 4173 &
 *          node tools/savutesti.mjs [http://localhost:4173]
 *
 * Playwright ei ole projektin riippuvuus (se hidastaisi jokaista Vercelin
 * asennusta). CI asentaa sen erikseen; paikallisesti osoite annetaan
 * ympäristömuuttujalla PLAYWRIGHT_MODULE, esim.
 * /opt/node22/lib/node_modules/playwright/index.mjs. */

const osoite = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const LAITTEET = {
  puhelin: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  tyopoyta: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const selain = await chromium.launch({
  args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'],
});
const viat = [];

async function aja(nimi, asetus) {
  const konteksti = await selain.newContext({
    ...asetus,
    locale: 'fi-FI',
    timezoneId: 'Europe/Helsinki',
    /* Service worker ohittaisi testin reitityksen ja välimuistittaisi
       edellisen ajon (CLAUDE.md, "TESTISSÄ SERVICE WORKER ON ESTETTÄVÄ"). */
    serviceWorkers: 'block',
    ignoreHTTPSErrors: true,
  });
  const sivu = await konteksti.newPage();
  const virheet = [];
  sivu.on('pageerror', (e) => virheet.push(e.message));
  const vika = (viesti) => viat.push(nimi + ': ' + viesti);
  const t0 = Date.now();

  /* Kertaopastus peittäisi napit — testi ajaa palaavana käyttäjänä. */
  await sivu.addInitScript(() => {
    try { localStorage.setItem('fs_opastus', '1'); } catch (e) {}
  });
  await sivu.goto(osoite + '/?perf=1', { waitUntil: 'domcontentloaded' });

  try {
    await sivu.waitForFunction(() => {
      const el = document.getElementById('loading');
      return el && el.classList.contains('hidden');
    }, null, { timeout: 30000 });
  } catch (e) {
    const tila = await sivu.evaluate(() => {
      const el = document.getElementById('loading');
      return el ? el.className + ' | ' + (document.getElementById('load-txt') || {}).textContent : 'ei #loading';
    });
    vika('latausruutu ei poistunut 30 s:ssa (' + tila + ')');
  }
  const lahtoS = ((Date.now() - t0) / 1000).toFixed(1);

  const tila = await sivu.evaluate(() => ({
    tikit: document.querySelectorAll('#tl-scroll .htick').length,
    merkit: document.querySelectorAll('.maplibregl-marker').length,
    kartta: !!(window.FS && window.FS.State && window.FS.State.map),
  }));
  if (!tila.kartta) vika('karttaa ei luotu');
  if (!tila.tikit) vika('aikajana on tyhjä');
  if (!tila.merkit) vika('kartalla ei ole merkkejä');

  /* Spottikortti */
  const kortti = await sivu.evaluate(async () => {
    const s = window.FS.SPOTS.find((x) => x.name === 'Lauttasaari');
    window.FS.openSheet(s);
    await new Promise((r) => setTimeout(r, 1500));
    const el = document.getElementById('sheet');
    const otsikko = el && el.querySelector('#sheet-content h2, #sheet-content .sh-nimi, #sheet-content [id$="title"]');
    return { auki: !!el && getComputedStyle(el).visibility !== 'hidden', teksti: (el && el.innerText || '').slice(0, 200) };
  });
  if (!kortti.auki || !kortti.teksti.includes('Lauttasaari')) vika('spottikortti ei auennut');
  /* Kaavio (docs/graafit.md): jos ennuste ehti latautua, tarttuva päiväotsikko
     ja y-akselin yksikkö ovat paikallaan, ja työkalurivi (zoom-napit,
     navigaattori) on vain hiirilaitteella. Ennusteen puuttuminen ei ole tässä
     vika (ulkoinen palvelu), joten silloin ei tarkisteta mitään. */
  const kaavio = await sivu.evaluate(async () => {
    const el = document.getElementById('sheet');
    for (let i = 0; i < 40; i++) { if (el.querySelector('[data-en-kaare] svg.tk-svg')) break; await new Promise((r) => setTimeout(r, 250)); }
    const k = el.querySelector('[data-en-kaare]');
    if (!k || !k.querySelector('svg.tk-svg')) return null;
    return { paivat: k.querySelectorAll('.ak-pv > span').length, yks: !!k.parentElement.querySelector('.ak-yks'), tyokalut: !!k.parentElement.querySelector('.ak-tyokalut') };
  });
  if (kaavio && (!kaavio.paivat || !kaavio.yks)) vika('kaavion päiväotsikko tai y-yksikkö puuttuu: ' + JSON.stringify(kaavio));
  if (kaavio && kaavio.tyokalut !== (nimi === 'tyopoyta')) vika('kaavion työkalurivi väärällä laitteella: ' + JSON.stringify(kaavio));
  await sivu.keyboard.press('Escape');
  await sivu.waitForTimeout(600);

  /* Parhaat ajankohdat: foilattava = indeksi > 50 JA tuuli >= 10 kts,
     nyt-lista enintään 5 riviä eikä yhtään ei-foilattavaa, ja arki-illat
     + viikonloppu ovat valittavissa yhdessä. */
  const fc = await sivu.evaluate(() => {
    const P = window.FS.ForecastPanel, kts = (v) => v / 1.9438;
    const nyt = P._nytLista();
    P._rajaus.add('arki'); P._rajaus.add('vkl');
    const ke18 = new Date(2026, 8, 30, 18).getTime(), ke10 = new Date(2026, 8, 30, 10).getTime();
    const la12 = new Date(2026, 9, 3, 12).getTime();
    const yhdessa = [P._sallittu(ke18), P._sallittu(la12), P._sallittu(ke10)];
    P._rajaus.clear();
    return {
      rajat: [P.foilattava(51, kts(10)), P.foilattava(50, kts(12)), P.foilattava(80, kts(9.5)), P.foilattava(51, kts(9.9))],
      nyt: nyt.length, nytLiikaa: nyt.some((r) => !P.foilattava(r.score, r.ms)), yhdessa,
    };
  });
  if (fc.rajat.join() !== 'true,false,false,false') vika('foilattava-raja väärin: ' + fc.rajat);
  if (fc.nyt > 5 || fc.nytLiikaa) vika('nyt-lista rikkoo säännön (' + fc.nyt + ' riviä)');
  if (fc.yhdessa.join() !== 'true,true,false') vika('arki+vkl-rajaus väärin: ' + fc.yhdessa);

  /* Asetukset napista */
  const nakyy = (id) => sivu.waitForFunction((i) => {
    const el = document.getElementById(i);
    return !!el && getComputedStyle(el).visibility !== 'hidden';
  }, id, { timeout: 5000 }).then(() => true, () => false);

  await sivu.evaluate(() => document.getElementById('btn-settings').click());
  if (!(await nakyy('settings-popup'))) vika('asetukset eivät auenneet');

  /* Tietoa asetuksista */
  const nappi = await sivu.evaluate(() => {
    const n = document.getElementById('sp-tietoa');
    if (n) n.click();
    return !!n;
  });
  if (!nappi) vika('Tietoa-näkymä: ei nappia');
  else if (!(await nakyy('tietoa'))) vika('Tietoa-näkymä: ei auennut');
  for (let i = 0; i < 3; i++) { await sivu.keyboard.press('Escape'); await sivu.waitForTimeout(300); }
  /* EHTOA ODOTETAAN, EI KELLOA. Suljettu paneeli saa `visibility:
     hidden`in vasta liu'un jälkeen (`transition-delay` .34 s, CLAUDE.md),
     ja kuormitetulla CI-koneella animaation aikajana etenee ruutu
     kerrallaan: mitattuna 6× kuristuksella asetukset olivat yhä
     `visible` 300 ms Escin jälkeen vaikka `open` oli jo poissa, ja CI:ssä
     (työpöydän latausruutu 19,4 s) kiinteä 600 ms ei riittänyt. */
  const PINNAT = ['settings-popup', 'tietoa', 'sheet'];
  const auki = () => sivu.evaluate((ids) => ids.filter((id) => {
    const el = document.getElementById(id);
    return el && getComputedStyle(el).visibility !== 'hidden';
  }), PINNAT);
  try {
    await sivu.waitForFunction((ids) => ids.every((id) => {
      const el = document.getElementById(id);
      return !el || getComputedStyle(el).visibility === 'hidden';
    }), PINNAT, { timeout: 5000 });
  } catch (e) {
    vika('Esc ei sulkenut kaikkia pintoja (auki: ' + (await auki()).join(', ') + ')');
  }

  for (const v of virheet) vika('pageerror: ' + v);
  console.log(nimi + ': latausruutu pois ' + lahtoS + ' s, tikkejä ' + tila.tikit
    + ', merkkejä ' + tila.merkit + ', virheitä ' + virheet.length);
  await konteksti.close();
}

try {
  for (const [nimi, asetus] of Object.entries(LAITTEET)) await aja(nimi, asetus);
} finally {
  await selain.close();
}

if (viat.length) {
  console.error('\nSAVUTESTI EPÄONNISTUI:\n  ' + viat.join('\n  '));
  process.exit(1);
}
console.log('\nSavutesti läpi.');
