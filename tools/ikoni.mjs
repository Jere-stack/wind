/* FoilSpotin merkki — yksi muoto, sama asu kotivalikossa ja latausruudulla.
 *
 * Merkki on SIIPI JA SPOTTI: wingfoil-siipi yhtenä umpinaisena muotona
 * (etureuna, jättöreuna ja alareunan lovi, josta siipeä pidellään) ja
 * sen kärjen yläpuolella pallo, joka on spotti — paikka jonne ollaan
 * menossa. Käyttäjän pyyntö: "simppelimpi", siiven ja pallon kuva
 * annetun mallin tyyliin. (Edellinen oli siipi ylhäältä kolmena osana
 * ja kaksi tuulijuovaa, sitä ennen 270°:n ramppikaari. Ks. docs/ui.md,
 * "Merkki yksinkertaistui: siipi ja spotti".)
 *
 * YKSI VÄRI MEREN PÄÄLLÄ. Siipi ja pallo ovat paperia (`#F0E7CE`), kuten
 * sovelluksen spottimerkit ja latausruudun kuski; pohja on sama tumma
 * meri kuin latausruudun ylälaita ja kartan `--bg`. Merkissä ei ole
 * rampin sävyä: kartalla sävy on nopeus, eikä merkki kerro nopeutta.
 * Paperi pohjan keskisävyä vasten 15,25:1.
 *
 * Ajo:
 *   node tools/ikoni.mjs          -> public/icon.svg
 *   node tools/ikoni.mjs --png    -> myös PNG-sarja (Chromium, ks. docs/pwa.md)
 *   node tools/ikoni.mjs --inline -> latausruudun merkkilähde vakiovirtaan
 *                                    (symbolit, avautumisen geometria ja
 *                                    tuulijuovien värit, ks. latausMerkki)
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JUURI = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Kartan tuuliramppi. Sama taulukko kuin index.html:n RAMP_KARTTA —
   latausruudun tuulijuovat EIVÄT saa keksiä omia sävyjä, koska niiden
   väri on nopeus. */
const RAMPPI = [
  [0.000,  12,  30, 120], [0.050,  12,  62, 190], [0.100,   0, 100, 245],
  [0.160,   0, 140, 255], [0.220,   0, 175, 250], [0.290,   0, 205, 220],
  [0.360,   0, 220, 165], [0.430,   0, 230, 105], [0.500,  60, 235,  45],
  [0.575, 140, 240,  20], [0.650, 205, 240,   0], [0.715, 250, 215,   0],
  [0.780, 255, 165,   0], [0.840, 255, 110,  10], [0.900, 255,  50,  50],
  [0.950, 255,  45, 145], [1.000, 255,  85, 235],
];

function ramppiVari(t) {
  const x = Math.min(1, Math.max(0, t));
  for (let i = 1; i < RAMPPI.length; i++) {
    if (x <= RAMPPI[i][0]) {
      const a = RAMPPI[i - 1], b = RAMPPI[i];
      const f = (x - a[0]) / (b[0] - a[0] || 1);
      return '#' + [1, 2, 3]
        .map(k => Math.round(a[k] + (b[k] - a[k]) * f).toString(16).padStart(2, '0'))
        .join('');
    }
  }
  return '#ff55eb';
}

/* Latausruudun tuulijuovien nopeudet ja rampin t (sama kuin index.html:n
   `msToT`). Juova joka kulkee nopeammin on kuumempi. Väli 5-13 m/s on
   foilattava keli — magentaa (20 m/s) ei ruudulla ole. */
const TUULI = [[5, 0.290], [6, 0.360], [7, 0.430], [8, 0.500],
               [9, 0.575], [10, 0.650], [11.5, 0.715], [13, 0.780]];
const PAPERI   = '#F0E7CE';
const MERI_YLA = '#15213B';   /* ikonin yläreuna: taivaanrannan sävy    */
const MERI_KES = '#0A1122';
const MERI_ALA = '#04070E';   /* = latausruudun --lr-syva                */
const HEHKU    = '#96B9EB';   /* = latausruudun taivaanrannan kylmä hehku */

/* ------------------------------------------------------------------
   Geometria. Merkki on piirretty omaan ruudukkoonsa (`M_*`-koordinaatit,
   y alas) ja sovitetaan ikonin 512:n ruudukkoon yhdellä muunnoksella.

   SIIPI on yksi umpinainen muoto: etureuna nousee tyvestä kaarena
   kärkeen ylös oikealle, jättöreuna laskee kuperana takaisin, ja
   alareunassa on lovi — puomi ja käsi, joista siipeä pidellään.
   Lovi on se mikä tekee muodosta wingfoil-siiven eikä lehteä tai
   purjetta. PALLO on spotti: paikka jonne siipi on menossa, kärjen
   yläpuolella.

   Muoto on kuutiollisia Bézier-paloja listana, jotta samasta lähteestä
   saadaan sekä SVG-polku että näytepisteet avautumisen kulmille.
   ------------------------------------------------------------------ */
const K = 512;
const M_ALKU = [207, 820];                 /* siiven tyvi               */
const M_PALAT = [
  /* etureuna tyvestä kärkeen */
  ['C', 205, 700, 250, 610, 330, 545],
  ['C', 420, 470, 530, 420, 578, 345],
  /* jättöreuna kärjestä loven takareunaan */
  ['C', 570, 470, 520, 610, 445, 722],
  /* lovi: ylös sisään, kärki, ja takaisin alas */
  ['C', 432, 690, 410, 670, 390, 662],
  ['L', 462, 608],
  ['C', 400, 630, 350, 650, 320, 683],
  ['C', 345, 683, 365, 688, 372, 695],
  /* alareuna takaisin tyveen */
  ['C', 360, 740, 260, 760, 207, 820],
];
const M_PALLO = [398, 326, 32];            /* cx, cy, r                 */
/* Merkin rajauslaatikko omassa ruudukossaan (pallo mukana). */
const M_LAATIKKO = [205, 294, 578, 820];

/* Merkin korkeus sivusta ja optinen siirto: siipi on raskas alaosastaan
   ja pallo kevyt ylhäällä, joten geometrinen keskitys jättäisi merkin
   näyttämään matalalta. */
const OSUUS = 0.64;
const SIIRTO_Y = -6;
/* Maskattava ikoni: Android leikkaa 80 %:n ympyrän. */
const MASKI_SKAALA = 0.8;

const p2 = n => Math.round(n * 100) / 100;

function merkki() {
  const [x0, y0, x1, y1] = M_LAATIKKO;
  const s = (K * OSUUS) / (y1 - y0);
  const dx = K / 2 - ((x0 + x1) / 2) * s;
  const dy = K / 2 - ((y0 + y1) / 2) * s + SIIRTO_Y;
  const M = ([x, y]) => [p2(x * s + dx), p2(y * s + dy)];
  let d = 'M' + M(M_ALKU).join(' ');
  const naytteet = [M(M_ALKU)];
  let ed = M_ALKU;
  for (const pala of M_PALAT) {
    if (pala[0] === 'L') {
      const q = [pala[1], pala[2]];
      d += 'L' + M(q).join(' ');
      naytteet.push(M(q)); ed = q;
    } else {
      const c1 = [pala[1], pala[2]], c2 = [pala[3], pala[4]], q = [pala[5], pala[6]];
      d += 'C' + [c1, c2, q].map(p => M(p).join(' ')).join(' ');
      for (let i = 1; i <= 16; i++) {
        const t = i / 16, u = 1 - t;
        naytteet.push(M([
          u * u * u * ed[0] + 3 * u * u * t * c1[0] + 3 * u * t * t * c2[0] + t * t * t * q[0],
          u * u * u * ed[1] + 3 * u * u * t * c1[1] + 3 * u * t * t * c2[1] + t * t * t * q[1],
        ]));
      }
      ed = q;
    }
  }
  d += 'Z';
  const [pcx, pcy] = M([M_PALLO[0], M_PALLO[1]]);
  const pr = p2(M_PALLO[2] * s);

  /* Avautumisen geometria: kiila pyörii siiven TYVEN ympäri, joten
     siipi aukeaa etureunasta jättöreunaan kuin se nostettaisiin
     tuuleen. Kulmat 0 = kello kolme, myötäpäivään. */
  const tyvi = M(M_ALKU);
  const kulmat = naytteet.slice(1)
    .filter(([x, y]) => Math.hypot(x - tyvi[0], y - tyvi[1]) > 2)
    .map(([x, y]) => (Math.atan2(y - tyvi[1], x - tyvi[0]) * 180) / Math.PI);
  const etaisyys = Math.max(...naytteet.map(([x, y]) => Math.hypot(x - tyvi[0], y - tyvi[1])));
  return {
    siipi: d, pallo: [pcx, pcy, pr], tyvi,
    kulmaMin: Math.min(...kulmat), kulmaMax: Math.max(...kulmat), etaisyys,
    laatikko: [M([x0, y0]), M([x1, y1])],
  };
}

const siipiOsa = g => `<path d="${g.siipi}" fill="${PAPERI}"/>`;
const palloOsa = g => `<circle cx="${g.pallo[0]}" cy="${g.pallo[1]}" r="${g.pallo[2]}" fill="${PAPERI}"/>`;

/** Kotivalikon ikoni: meri, kylmä hehku, siipi ja spotti. */
export function ikoniSvg({ koko = K, maskattu = false } = {}) {
  const g = merkki();
  const sisalto = siipiOsa(g) + palloOsa(g);
  const ryhma = maskattu
    ? `<g transform="translate(${K / 2} ${K / 2}) scale(${MASKI_SKAALA}) translate(${-K / 2} ${-K / 2})">${sisalto}</g>`
    : sisalto;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${K} ${K}"`
    + ` width="${koko}" height="${koko}" role="img" aria-label="FoilSpot">`
    + `<defs><linearGradient id="fs-meri" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${MERI_YLA}"/><stop offset=".55" stop-color="${MERI_KES}"/>`
    + `<stop offset="1" stop-color="${MERI_ALA}"/></linearGradient>`
    + `<radialGradient id="fs-hehku" cx=".72" cy=".2" r=".7">`
    + `<stop offset="0" stop-color="${HEHKU}" stop-opacity=".12"/>`
    + `<stop offset="1" stop-color="${HEHKU}" stop-opacity="0"/></radialGradient></defs>`
    + `<rect width="${K}" height="${K}" fill="url(#fs-meri)"/>`
    + `<rect width="${K}" height="${K}" fill="url(#fs-hehku)"/>`
    + ryhma + `</svg>`;
}

/** Latausruudun merkkilähde: siipi ja pallo omina `<symbol>`einaan
    samassa 512:n ruudukossa kuin ikoni, koska latausruutu tuo ne esiin
    eri liikkeillä (siipi avautuu, spotti syttyy). Samassa elementissä
    kulkee geometria prosentteina merkin laatikosta:

    - `data-keski`: kiilan kärki = siiven tyvi.
    - `data-alku`, `data-pyyhk`: kiilan alkukulma ja pyyhkäisy asteina
      (0 = kello kolme, myötäpäivään), 3° reunavara kummassakin päässä.
    - `data-r`: kiilan säde (kaukaisin piste + reunavara).
    - `data-pallo`: spotin keskipiste, pallon ponnahduksen keskus.
    - `data-tuuli`: kohtauksen tuulijuovien värit, "nopeus väri"
      pilkulla erotettuna. */
export function latausMerkki() {
  const g = merkki();
  const pros = v => p2((v / K) * 100);
  const alku = g.kulmaMin - 3, pyyhk = g.kulmaMax - g.kulmaMin + 6;
  const tuuli = TUULI.map(([ms, t]) => `${ms} ${ramppiVari(t)}`).join(',');
  return `<svg id="lr-merkki-lahde" width="0" height="0" aria-hidden="true"`
    + ` focusable="false" style="position:absolute"`
    + ` data-keski="${pros(g.tyvi[0])} ${pros(g.tyvi[1])}"`
    + ` data-alku="${p2(alku)}" data-pyyhk="${p2(pyyhk)}" data-r="${pros(g.etaisyys + 12)}"`
    + ` data-pallo="${pros(g.pallo[0])} ${pros(g.pallo[1])}"`
    + ` data-tuuli="${tuuli}" xmlns="http://www.w3.org/2000/svg">`
    + `<symbol id="lm-siipi" viewBox="0 0 ${K} ${K}">${siipiOsa(g)}</symbol>`
    + `<symbol id="lm-pallo" viewBox="0 0 ${K} ${K}">${palloOsa(g)}</symbol>`
    + `</svg>`;
}

/* Rajauslaatikko ruudukon osuuksina (latausruudun marginaaleja varten). */
export function merkinLaatikko() {
  const { laatikko: [[x0, y0], [x1, y1]] } = merkki();
  return [x0 / K, y0 / K, x1 / K, y1 / K].map(v => Math.round(v * 1000) / 1000);
}

/* ------------------------------------------------------------------
   PNG-sarja. Rasterointi Chromiumilla: kontissa ei ole muuta
   rasteroijaa, eikä projektiin oteta riippuvuutta yhden staattisen
   kuvasarjan takia. Tiedostot ovat repossa valmiina — tämä ajetaan
   vain kun merkki muuttuu. Playwrightin moduulin voi antaa
   ympäristömuuttujalla PLAYWRIGHT_MODULE kuten savutestissä.
   ------------------------------------------------------------------ */
const PNGT = [
  { tiedosto: 'public/apple-touch-icon.png',  koko: 180, maskattu: false },
  { tiedosto: 'public/icon-192.png',          koko: 192, maskattu: false },
  { tiedosto: 'public/icon-512.png',          koko: 512, maskattu: false },
  { tiedosto: 'public/icon-maskable-512.png', koko: 512, maskattu: true  },
];

async function png() {
  const mod = await import(process.env.PLAYWRIGHT_MODULE || 'playwright-core');
  const { chromium } = mod.chromium ? mod : mod.default;
  const selain = await chromium.launch({
    executablePath: process.env.CHROMIUM_POLKU
      || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const ctx  = await selain.newContext({ deviceScaleFactor: 1 });
  const sivu = await ctx.newPage();
  for (const t of PNGT) {
    await sivu.setViewportSize({ width: t.koko, height: t.koko });
    await sivu.setContent(`<body style="margin:0">`
      + ikoniSvg({ koko: t.koko, maskattu: t.maskattu }) + `</body>`);
    const puskuri = await sivu.screenshot();
    writeFileSync(resolve(JUURI, t.tiedosto), puskuri);
    console.log(t.tiedosto, t.koko + 'px', puskuri.length + ' B');
  }
  await selain.close();
}

if (import.meta.url === `file://${process.argv[1]}`) {
  mkdirSync(resolve(JUURI, 'public'), { recursive: true });
  writeFileSync(resolve(JUURI, 'public/icon.svg'), ikoniSvg() + '\n');
  /* Tilarivi virhevirtaan: `--inline > tiedosto` saa vain merkkilähteen. */
  console.error('public/icon.svg');
  if (process.argv.includes('--inline')) console.log(latausMerkki());
  if (process.argv.includes('--png')) await png();
}
