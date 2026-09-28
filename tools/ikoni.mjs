/* FoilSpotin merkki — yksi muoto, sama asu kotivalikossa ja latausruudulla.
 *
 * Merkki on SIIPI YLHÄÄLTÄ PÄIN ja sen alla TUULI. Siipi on wingfoilin
 * oma tunnistettava muoto kolmena osana: täyttöputki (etureuna, kapea
 * kärjistä ja paksu keskeltä), keskituki ja kangas niiden välissä.
 * Tuuli on kaksi juovaa, jotka ovat sama muoto kuin kartan partikkelin
 * jälki ja latausruudun tuulijuova: pää vasemmalla, häntä häipyy.
 * (Edellinen merkki oli 270°:n ramppikaari, "puuska" — se luki
 * latausrinkulana ja kantoi koko rampin, eli seitsemän kylläistä sävyä
 * ikonissa jonka piti olla hillitty. Ks. docs/ui.md, "Uusi merkki:
 * siipi ja tuuli".)
 *
 * VÄRI ON NOPEUS MYÖS MERKISSÄ. Kaikki mikä ei ole tuulta on paperia
 * (`#F0E7CE`), ja juovan sävy on rampin ankkuri SILLÄ nopeudella
 * (`JUOVA_MS`, 5 m/s -> syaani), kuten latausruudun juovilla ja
 * kartalla. Yksi sävy, ei ramppia: merkki sanoo "tuulta", ei asteikkoa.
 *
 * POHJA ON MERI. Paperi merkin pohjana on mitattu ja kaatunut rampin
 * takia (1,06:1), ja nyt pohja on sama tumma meri kuin latausruudun
 * ylälaita ja kartan `--bg`: ikoni -> latausruutu -> kartta on yksi
 * pohja ilman kirkkaushyppyä.
 *
 * Kaikki osat lasketaan YHDESTÄ geometriasta (`siipi`), joten ikoni ja
 * latausruudun merkki ovat pikselilleen sama muoto.
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
   merkki ja latausruudun juovat EIVÄT saa keksiä omia sävyjä, koska
   niiden väri on nopeus. */
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
/* Merkin juova on hitaimman latausruudun juovan värinen: viilein sävy
   jonka ramppi foilattavalla välillä antaa, ja tummalla merellä kirkas
   (syaani 9,65:1 ikonin pohjaa vasten). */
const JUOVA_T = 0.290;

const PAPERI   = '#F0E7CE';
const MERI_YLA = '#15213B';   /* ikonin yläreuna: taivaanrannan sävy    */
const MERI_KES = '#0A1122';
const MERI_ALA = '#04070E';   /* = latausruudun --lr-syva                */
const HEHKU    = '#96B9EB';   /* = latausruudun taivaanrannan kylmä hehku */

/* ------------------------------------------------------------------
   Geometria. Paikallinen kehys: etureunan ympyrän keskipiste origossa,
   y ylös. Siipi on ympyrän yläosa, ja koko kuvio kallistetaan
   (`KALLISTUS`), jotta se lentää eikä seiso.

   Etureunan leveys on sin^0,55 kärjestä kärkeen: suora sini jättää
   kärjet neulanohuiksi pitkältä matkalta, ja potenssi pitää putken
   pullean kuten täytetty putki on. Kärjissä on pyöreä päätykorkki.

   Jättöreuna on kaksi koveraa kaarta kärjestä tuen päähän — sama
   kuvio kuin oikeassa siivessä, jossa kangas kiristyy tuen ja kärjen
   väliin. Suora jättöreuna luki sateenvarjona (kokeiltu).
   ------------------------------------------------------------------ */
const K         = 512;
const SADE      = 300;   /* etureunan keskiviivan säde                 */
const PUOLIKULMA = 55;   /* astetta keskeltä kumpaankin kärkeen         */
const LEV_MAX   = 54;    /* etureunan leveys keskellä                   */
const LEV_KARKI = 7;     /* etureunan leveys kärjessä                   */
const TUKI_PAA  = 95;    /* tuen pää (y), eli kankaan syvyys keskellä   */
const KOVERUUS  = 10;    /* jättöreunan kaaren kovera nousu             */
const KALLISTUS = 20;    /* astetta myötäpäivään: siipi lentää ylös oikealle */
const NAYTE     = 64;    /* ääriviivan pisteitä reunaa kohti            */

/* Sommitelma. Siipi yläpuolella, juovat alla; ryhmän optinen keskipiste
   on hieman keskikohdan alapuolella, koska siipi on raskas yläosastaan. */
const OSUUS     = 0.72;  /* siiven pitempi sivu sivusta                 */
const SIIPI_DY  = -30;   /* siiven siirto ylös (ruudukon pikseleinä)    */
/* Juovat: [x0, x1, y] sivun osuuksina, paksuus ja peittävyys. */
const JUOVAT = [
  [0.10, 0.60, 0.755, 14, 1],
  [0.50, 0.82, 0.815,  8, 0.5],
];
/* Maskattava ikoni: Android leikkaa 80 %:n ympyrän, joten koko
   sommitelma pienennetään sen sisään. */
const MASKI_SKAALA = 0.8;

const rad = a => (a * Math.PI) / 180;
const p2  = n => Math.round(n * 100) / 100;

function siipi() {
  const kulma = t => rad(90 + PUOLIKULMA - 2 * PUOLIKULMA * t);  /* vasen -> oikea */
  const lev = t => LEV_KARKI + (LEV_MAX - LEV_KARKI) * Math.pow(Math.sin(Math.PI * t), 0.55);
  const piste = (t, puoli) => {
    const a = kulma(t), r = SADE + (puoli * lev(t)) / 2;
    return [r * Math.cos(a), r * Math.sin(a)];
  };
  const ulko = [], sisa = [];
  for (let i = 0; i <= NAYTE; i++) { ulko.push(piste(i / NAYTE, +1)); sisa.push(piste(i / NAYTE, -1)); }
  const tuki = [0, TUKI_PAA];
  const kovera = p => [(p[0] + tuki[0]) / 2, (p[1] + tuki[1]) / 2 + KOVERUUS];
  const ohjV = kovera(sisa[0]), ohjO = kovera(sisa[NAYTE]);

  /* Kierto + sovitus: siiven rajauslaatikko (ei ympyrän keskipiste)
     keskitetään, ja pitempi sivu on `OSUUS` ruudukosta. */
  const kierra = ([x, y]) => {
    const a = rad(-KALLISTUS);   /* y ylös -> myötäpäivään ruudulla */
    return [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];
  };
  const kaikki = [...ulko, ...sisa, tuki].map(kierra);
  const xs = kaikki.map(p => p[0]), ys = kaikki.map(p => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const s = (K * OSUUS) / Math.max(xMax - xMin, yMax - yMin);
  const M = p => {
    const [x, y] = kierra(p);
    return [p2(K / 2 + (x - (xMin + xMax) / 2) * s), p2(K / 2 - (y - (yMin + yMax) / 2) * s + SIIPI_DY)];
  };
  const jono = ps => ps.map(p => M(p).join(' ')).join(' ');
  const rK = p2((LEV_KARKI / 2) * s);

  /* Etureuna yhtenä polkuna; peräkkäiset janat yhden L:n perään, koska
     lähde upotetaan index.html:ään. */
  const etureuna = 'M' + M(ulko[0]).join(' ') + 'L' + jono(ulko.slice(1))
    + `A${rK} ${rK} 0 0 1 ` + M(sisa[NAYTE]).join(' ')
    + 'L' + jono(sisa.slice(0, NAYTE).reverse())
    + `A${rK} ${rK} 0 0 1 ` + M(ulko[0]).join(' ') + 'Z';
  const jattoreuna = 'Q' + M(ohjO).join(' ') + ' ' + M(tuki).join(' ')
    + 'Q' + M(ohjV).join(' ') + ' ' + M(sisa[0]).join(' ');
  const kangas = 'M' + jono(sisa) + jattoreuna + 'Z';
  const jatto = 'M' + M(sisa[NAYTE]).join(' ') + jattoreuna;

  /* Tuki: kapeneva, leveämpi putken päässä. Pää upotetaan jättöreunaan
     suoraan leikkauksena — pyöreä pää jätti nuppineulan pisteen. */
  const [ax, ay] = M(piste(0.5, -1)), [bx, by] = M(tuki);
  const L = Math.hypot(bx - ax, by - ay), nx = -(by - ay) / L, ny = (bx - ax) / L;
  const w0 = 6.5, w1 = 2.5;
  const tukiD = `M${p2(ax + nx * w0)} ${p2(ay + ny * w0)}L${p2(bx + nx * w1)} ${p2(by + ny * w1)}`
    + `L${p2(bx - nx * w1)} ${p2(by - ny * w1)}L${p2(ax - nx * w0)} ${p2(ay - ny * w0)}Z`;

  /* Avautumisen geometria: kaikkien osien kulmat etureunan ympyrän
     keskipisteestä (0 = kello kolme, myötäpäivään) ja kaukaisin etäisyys. */
  const keski = M([0, 0]);
  const pisteet = [...ulko, ...sisa, tuki, ohjV, ohjO].map(M);
  const kulmat = pisteet.map(([x, y]) => (Math.atan2(y - keski[1], x - keski[0]) * 180) / Math.PI);
  const etaisyys = Math.max(...pisteet.map(([x, y]) => Math.hypot(x - keski[0], y - keski[1])));
  return {
    etureuna, kangas, jatto, tuki: tukiD,
    kankaanAlku: M(piste(0.5, 1)), kankaanLoppu: [bx, by],
    keski, kulmaMin: Math.min(...kulmat), kulmaMax: Math.max(...kulmat), etaisyys,
  };
}

function juovaPolku([x0, x1, y, h]) {
  const X0 = K * x0, X1 = K * x1, Y = K * y, r = h / 2;
  /* Pää on puoliympyrä, häntä suippenee 1,2 px:iin. */
  return `M${p2(X0 + r)} ${p2(Y - r)}L${p2(X1)} ${p2(Y - 0.6)}L${p2(X1)} ${p2(Y + 0.6)}`
    + `L${p2(X0 + r)} ${p2(Y + r)}A${r} ${r} 0 0 1 ${p2(X0 + r)} ${p2(Y - r)}Z`;
}

/* Värit ja liu'ut. Etureuna on paperia pienellä valon liu'ulla
   (vasen yläkulma kirkkaampi), jotta täytetty putki saa muodon ilman
   kiiltoa. Kangas on läpikuultavaa: kirkkain etureunan takana, himmenee
   jättöreunaa kohti, kuten valo kankaan läpi. */
function maaritykset(g, etu) {
  const juova = ramppiVari(JUOVA_T);
  return `<linearGradient id="${etu}-reuna" x1="0" y1="0" x2="1" y2="1">`
    + `<stop offset="0" stop-color="#FBF5E4"/><stop offset="1" stop-color="#E4D8B8"/></linearGradient>`
    + `<linearGradient id="${etu}-kangas" gradientUnits="userSpaceOnUse"`
    + ` x1="${g.kankaanAlku[0]}" y1="${g.kankaanAlku[1]}" x2="${g.kankaanLoppu[0]}" y2="${g.kankaanLoppu[1]}">`
    + `<stop offset="0" stop-color="${PAPERI}" stop-opacity=".13"/>`
    + `<stop offset="1" stop-color="${PAPERI}" stop-opacity=".045"/></linearGradient>`
    + `<linearGradient id="${etu}-juova" x1="0" y1="0" x2="1" y2="0">`
    + `<stop offset="0" stop-color="${juova}"/><stop offset=".1" stop-color="${juova}"/>`
    + `<stop offset=".45" stop-color="${juova}" stop-opacity=".55"/>`
    + `<stop offset="1" stop-color="${juova}" stop-opacity="0"/></linearGradient>`;
}
function siipiOsat(g, etu) {
  return `<path d="${g.kangas}" fill="url(#${etu}-kangas)"/>`
    + `<path d="${g.jatto}" fill="none" stroke="${PAPERI}" stroke-opacity=".38" stroke-width="4" stroke-linejoin="round"/>`
    + `<path d="${g.tuki}" fill="${PAPERI}" fill-opacity=".88"/>`
    + `<path d="${g.etureuna}" fill="url(#${etu}-reuna)"/>`;
}
const juovaOsa = (j, etu) =>
  `<path d="${juovaPolku(j)}" fill="url(#${etu}-juova)"${j[4] < 1 ? ` opacity="${j[4]}"` : ''}/>`;

/** Kotivalikon ikoni: meri, kylmä hehku, tuuli ja siipi. */
export function ikoniSvg({ koko = K, maskattu = false } = {}) {
  const g = siipi();
  const sisalto = JUOVAT.map(j => juovaOsa(j, 'fs')).join('') + siipiOsat(g, 'fs');
  const ryhma = maskattu
    ? `<g transform="translate(${K / 2} ${K / 2}) scale(${MASKI_SKAALA}) translate(${-K / 2} ${-K / 2})">${sisalto}</g>`
    : sisalto;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${K} ${K}"`
    + ` width="${koko}" height="${koko}" role="img" aria-label="FoilSpot">`
    + `<defs><linearGradient id="fs-meri" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${MERI_YLA}"/><stop offset=".55" stop-color="${MERI_KES}"/>`
    + `<stop offset="1" stop-color="${MERI_ALA}"/></linearGradient>`
    + `<radialGradient id="fs-hehku" cx=".72" cy=".22" r=".75">`
    + `<stop offset="0" stop-color="${HEHKU}" stop-opacity=".16"/>`
    + `<stop offset="1" stop-color="${HEHKU}" stop-opacity="0"/></radialGradient>`
    + maaritykset(g, 'fs') + `</defs>`
    + `<rect width="${K}" height="${K}" fill="url(#fs-meri)"/>`
    + `<rect width="${K}" height="${K}" fill="url(#fs-hehku)"/>`
    + ryhma + `</svg>`;
}

/** Latausruudun merkkilähde. Kolme `<symbol>`ia samassa 512:n
    ruudukossa kuin ikoni — siipi ja kaksi juovaa erikseen, koska
    latausruutu tuo ne esiin eri liikkeillä (siipi avautuu, tuuli
    saapuu). Samassa elementissä kulkee avautumisen geometria:

    - `data-keski`: etureunan ympyrän KESKIPISTE prosentteina merkin
      laatikosta. Avautumisen kiila pyörii sen ympäri, joten reuna
      pyyhkii etureunaa pitkin kärjestä kärkeen. Piste on siiven
      alapuolella laatikon ulkopuolella — kiila on siksi laatikkoa
      suurempi (`data-r`).
    - `data-alku`, `data-pyyhk`: kiilan alkukulma ja pyyhkäisy asteina
      (0 = kello kolme, myötäpäivään), 3° reunavara kummassakin päässä
      päätykorkkien takia.
    - `data-r`: kiilan säde prosentteina laatikosta (kaukaisin piste
      + reunavara).
    - `data-tuuli`: kohtauksen tuulijuovien värit, "nopeus väri"
      pilkulla erotettuna. */
export function latausMerkki() {
  const g = siipi();
  const pros = v => p2((v / K) * 100);
  const alku = g.kulmaMin - 3, pyyhk = g.kulmaMax - g.kulmaMin + 6;
  const tuuli = TUULI.map(([ms, t]) => `${ms} ${ramppiVari(t)}`).join(',');
  return `<svg id="lr-merkki-lahde" width="0" height="0" aria-hidden="true"`
    + ` focusable="false" style="position:absolute"`
    + ` data-keski="${pros(g.keski[0])} ${pros(g.keski[1])}"`
    + ` data-alku="${p2(alku)}" data-pyyhk="${p2(pyyhk)}" data-r="${pros(g.etaisyys + 12)}"`
    + ` data-tuuli="${tuuli}" xmlns="http://www.w3.org/2000/svg">`
    + `<defs>${maaritykset(g, 'lm')}</defs>`
    + `<symbol id="lm-siipi" viewBox="0 0 ${K} ${K}">${siipiOsat(g, 'lm')}</symbol>`
    + JUOVAT.map((j, i) => `<symbol id="lm-juova${i + 1}" viewBox="0 0 ${K} ${K}">${juovaOsa(j, 'lm')}</symbol>`).join('')
    + `</svg>`;
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
