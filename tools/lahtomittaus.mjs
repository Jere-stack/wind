// Latausruudun lähdön mittari (docs/ui.md, "Latausruutu muuttuu
// sovellukseksi"): merkin spotti lentää kartan tähtäimeksi ja palkki
// päiväkiskon kelikaistaksi. Mittari pysäyttää lähdön siirtymät heti kun
// `.out` tulee ja asettaa niiden ajan itse (Web Animations
// `currentTime`), joten tulos ei riipu kontin ruutunopeudesta.
//
// Lähdön kaksi ajastinta (piilotus 1 000 ms ja `lr-saapuu` 1 300 ms)
// pidätetään, jotta kuvasarjan hitaus ei päätä lähtöä kesken.
//
// Tarkistaa jokaisella laitteella:
//   - spotin keskipiste on lennon lopussa tähtäimen keskellä (≤ 1 px)
//     ja sen koko on tähtäimen pisteen koko (≤ 0,5 px)
//   - palkin lanka on kelikaistan keskiviivalla (≤ 1 px) ja kiskon
//     näkyvän leveyden mittainen (≤ 1 px kummastakin päästä)
//   - kapseli, aikajana ja tähtäimen rengas ovat piilossa lennon
//     aikana (ei kahta tähtäintä) ja näkyvissä lopussa
//   - ei `pageerror`ia
// Jokainen rivi `ok`/`VIKA`, poistumiskoodi 1 vialla.
//
// Käyttö:  PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
//          node tools/lahtomittaus.mjs http://localhost:4173 [--kuvat=<hakemisto>]
// `--kuvat` tallentaa jokaiselta laitteelta kuvasarjan lähdön ajasta
// (0, 100 … 1 000 ms).

const PW = process.env.PLAYWRIGHT_MODULE || 'playwright';
const { chromium } = await import(PW);
const URL0 = process.argv[2] || 'http://localhost:4173';
const kuvaArg = process.argv.find(a => a.startsWith('--kuvat='));
const KUVAT = kuvaArg ? kuvaArg.slice(8) : null;
if (KUVAT) { const fs = await import('node:fs'); fs.mkdirSync(KUVAT, { recursive: true }); }

const LAITTEET = [
  { nimi: 'puhelin', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  { nimi: 'puhelin-vaaka', viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  { nimi: 'ipad', viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  { nimi: 'tyopoyta', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, hasTouch: false },
];

let vikoja = 0;
function tulos(ok, teksti) { if (!ok) vikoja++; console.log((ok ? 'ok   ' : 'VIKA ') + teksti); }

/* Pidätetään lähdön `display: none` -ajastin (1 000 ms, kutsuu
   `hidden`ia): ilman sitä pysäytetyt siirtymät peruuntuisivat kun ruutu
   piilotetaan. Muut ajastimet kulkevat normaalisti. */
const ALUSTUS = `
  (function () {
    const st = window.setTimeout;
    window.setTimeout = function (fn, ms) {
      if (ms === 1000 && typeof fn === 'function' && /hidden/.test(String(fn))) {
        window.__lahtoPiilo = fn; return 0;
      }
      /* Samoin lr-saapuu-luokan poisto (1 300 ms): kuvasarja kestää
         kauemmin, ja luokan poisto peruisi sovelluksen syttymisen. */
      if (ms === 1300 && typeof fn === 'function' && /lr-saapuu/.test(String(fn))) {
        window.__lahtoSaapuu = fn; return 0;
      }
      return st.apply(this, arguments);
    };
  })();
`;

const selain = await chromium.launch({ args: ['--ignore-certificate-errors'] });
for (const L of LAITTEET) {
  const ctx = await selain.newContext({ ...L, timezoneId: 'Europe/Helsinki', serviceWorkers: 'block' });
  const sivu = await ctx.newPage();
  const virheet = [];
  sivu.on('pageerror', e => virheet.push(String(e)));
  await sivu.addInitScript(ALUSTUS);
  /* Pysäytys heti `.out`in jälkeen: tarkkailija ajetaan mikrotehtävänä
     samassa tehtävässä kuin `classList.add('out')`, eli ennen
     ensimmäistäkään lähdön ruutua. */
  await sivu.addInitScript(`
    document.addEventListener('DOMContentLoaded', function () {
      const el = document.getElementById('loading');
      if (!el) return;
      new MutationObserver(function () {
        if (!el.classList.contains('out') || window.__lahtoAnim) return;
        window.__lahtoAnim = document.getAnimations().filter(a =>
          a.constructor.name === 'CSSTransition' || (a.animationName || '').indexOf('lr-') === 0);
        window.__lahtoAnim.forEach(a => a.pause());
      }).observe(el, { attributes: true, attributeFilter: ['class'] });
    });
  `);
  await sivu.goto(URL0 + '/?kieli=fi', { waitUntil: 'domcontentloaded' });
  try {
    await sivu.waitForFunction(() => window.__lahtoAnim, null, { timeout: 60000 });
  } catch (e) {
    tulos(false, `${L.nimi}: lähtö ei alkanut 60 s:ssa`);
    await ctx.close(); continue;
  }
  const luokat = await sivu.evaluate(() => document.getElementById('loading').className);
  const aseta = (t) => sivu.evaluate((t) => {
    for (const a of window.__lahtoAnim) { try { a.currentTime = t; } catch (e) {} }
  }, t);
  const mittaa = () => sivu.evaluate(() => {
    const r = (s) => { const e = document.querySelector(s); return e ? e.getBoundingClientRect() : null; };
    const lahde = document.getElementById('lr-merkki-lahde');
    const pk = lahde.getAttribute('data-pallo').split(' ').map(Number);
    const sade = +lahde.querySelector('#lm-pallo circle').getAttribute('r');
    const p = r('#lr-m-pallo'), rengas = r('#crosshair .ch-ring'), piste = r('#crosshair .ch-dot');
    const lanka = r('#lr-lanka'), kisko = r('#tl-paivat');
    const op = (s) => { const e = document.querySelector(s); return e ? +getComputedStyle(e).opacity : null; };
    return {
      pallo: { x: p.left + p.width * pk[0] / 100, y: p.top + p.height * pk[1] / 100, d: p.width * 2 * sade / 512 },
      tahtain: { x: rengas.left + rengas.width / 2, y: rengas.top + rengas.height / 2, d: piste.width },
      lanka: { l: lanka.left, r: lanka.right, y: lanka.top + lanka.height / 2, h: lanka.height },
      kisko: { l: Math.max(0, kisko.left), r: Math.min(innerWidth, kisko.right), y: kisko.bottom - 4.5 },
      rengasOp: op('#crosshair .ch-ring'), tlOp: op('#tl-wrap'), kapOp: op('#kapseli'),
      nayttamoOp: op('#lr-nayttamo'),
    };
  });
  tulos(!/lr-ei-/.test(luokat), `${L.nimi}: kaikki lennot käytössä (${luokat})`);

  if (KUVAT) {
    for (let t = 0; t <= 1000; t += 100) {
      await aseta(t);
      await sivu.screenshot({ path: `${KUVAT}/${L.nimi}-${String(t).padStart(4, '0')}.png` });
    }
  }
  /* Lennon aikana (0,4 s): sovelluksen osat eivät vielä näy. */
  await aseta(400);
  const kesken = await mittaa();
  tulos(kesken.rengasOp < 0.05, `${L.nimi}: tähtäimen rengas piilossa lennon aikana (${kesken.rengasOp})`);
  tulos(kesken.tlOp < 0.05, `${L.nimi}: aikajana piilossa lennon aikana (${kesken.tlOp})`);

  /* Lennon lopussa (0,7 s): spotti ja lanka perillä. Läpinäkyvyys
     ohitetaan — paikka mitataan laatikosta. */
  await aseta(700);
  const m = await mittaa();
  const dx = m.pallo.x - m.tahtain.x, dy = m.pallo.y - m.tahtain.y;
  tulos(Math.hypot(dx, dy) <= 1, `${L.nimi}: spotti tähtäimen keskellä (ero ${dx.toFixed(2)}, ${dy.toFixed(2)} px)`);
  tulos(Math.abs(m.pallo.d - m.tahtain.d) <= 0.5, `${L.nimi}: spotti pisteen kokoinen (${m.pallo.d.toFixed(2)} vs ${m.tahtain.d.toFixed(2)} px)`);
  tulos(Math.abs(m.lanka.y - m.kisko.y) <= 1, `${L.nimi}: lanka kelikaistalla (y ${m.lanka.y.toFixed(2)} vs ${m.kisko.y.toFixed(2)})`);
  tulos(Math.abs(m.lanka.l - m.kisko.l) <= 1 && Math.abs(m.lanka.r - m.kisko.r) <= 1,
    `${L.nimi}: lanka kiskon levyinen (${m.lanka.l.toFixed(1)}–${m.lanka.r.toFixed(1)} vs ${m.kisko.l.toFixed(1)}–${m.kisko.r.toFixed(1)})`);
  tulos(Math.abs(m.lanka.h - 2) <= 0.3, `${L.nimi}: lanka kaistan paksuinen (${m.lanka.h.toFixed(2)} px)`);

  await aseta(1100);
  const loppu = await mittaa();
  tulos(loppu.rengasOp > 0.95 && loppu.tlOp > 0.95, `${L.nimi}: tähtäin ja aikajana näkyvissä lopussa (${loppu.rengasOp}, ${loppu.tlOp})`);
  tulos(loppu.nayttamoOp < 0.01, `${L.nimi}: näyttämö häipynyt (${loppu.nayttamoOp})`);

  /* Lopuksi oikea piilotus: animaatiot jatkuvat ja ruutu poistuu. */
  await sivu.evaluate(() => { window.__lahtoAnim.forEach(a => a.play()); window.__lahtoPiilo && window.__lahtoPiilo(); window.__lahtoSaapuu && window.__lahtoSaapuu(); });
  const piilossa = await sivu.evaluate(() => document.getElementById('loading').classList.contains('hidden'));
  tulos(piilossa, `${L.nimi}: latausruutu piilotettu`);
  tulos(virheet.length === 0, `${L.nimi}: ei pageerroria${virheet.length ? ' — ' + virheet[0] : ''}`);
  await ctx.close();
}
await selain.close();
console.log(vikoja ? `\n${vikoja} vikaa.` : '\nKaikki kunnossa.');
process.exit(vikoja ? 1 : 0);
