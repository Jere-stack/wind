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
  await sivu.keyboard.press('Escape');
  await sivu.waitForTimeout(600);

  /* Asetukset napista */
  await sivu.evaluate(() => document.getElementById('btn-settings').click());
  await sivu.waitForTimeout(700);
  const asetukset = await sivu.evaluate(() => {
    const el = document.getElementById('settings-popup');
    return !!el && getComputedStyle(el).visibility !== 'hidden';
  });
  if (!asetukset) vika('asetukset eivät auenneet');

  /* Tietoa asetuksista */
  const tietoa = await sivu.evaluate(async () => {
    const nappi = document.getElementById('sp-tietoa');
    if (!nappi) return 'ei nappia';
    nappi.click();
    await new Promise((r) => setTimeout(r, 700));
    const el = document.getElementById('tietoa');
    return el && getComputedStyle(el).visibility !== 'hidden' ? 'ok' : 'ei auennut';
  });
  if (tietoa !== 'ok') vika('Tietoa-näkymä: ' + tietoa);
  for (let i = 0; i < 3; i++) { await sivu.keyboard.press('Escape'); await sivu.waitForTimeout(300); }
  const kaikkiKiinni = await sivu.evaluate(() =>
    ['settings-popup', 'tietoa', 'sheet'].every((id) => {
      const el = document.getElementById(id);
      return !el || getComputedStyle(el).visibility === 'hidden';
    }));
  if (!kaikkiKiinni) vika('Esc ei sulkenut kaikkia pintoja');

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
