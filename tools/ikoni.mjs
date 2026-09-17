/* FoilSpotin merkki — yksi muoto, kaksi asua.
 *
 * Merkki on PUUSKA: kapeasta tyvestä leveäksi paisuva kaari, joka kiertää
 * 270 astetta ja kaartuu lopussa sisään. Kapea pää on tyyni, leveä pää on
 * myrsky — sama järjestys kuin lämpökartalla.
 *
 * ASU SEURAA MAAILMAA, EI TIEDOSTOA. Sovelluksessa on sama jako kuin
 * väreillä muutenkin (`ColorRamp.rgb()` kartalle, `ink()` paneeleihin):
 *
 *   - KOTIVALIKON IKONI on karttamaailmaa. Pohja on meren tummaa ja kaari
 *     kantaa `RAMP_KARTTA`n sellaisenaan. Se on ainoa pohja jolla ramppi
 *     lukee: paperilla sen keskivaihe (limetti, keltainen) on kermaa
 *     vasten lähes näkymätön, mitattuna kontrasti 1,15:1.
 *   - LATAUSRUUDUN MERKKI on paperimaailmaa, joten se on YKSIVÄRINEN
 *     muste. Sama ääriviiva, ei ramppia.
 *
 * Ääriviiva on yksi polku, ja ikonin ramppi maalataan sen SISÄÄN
 * sektoreina (`clipPath`). Niin kumpikin asu on pikselilleen sama muoto —
 * kaksi erikseen laskettua reunaa ajautuisi erilleen ensimmäisellä
 * hienosäädöllä.
 *
 * Ajo:
 *   node tools/ikoni.mjs         -> public/icon.svg
 *   node tools/ikoni.mjs --png   -> myös PNG-sarja (Chromium, ks. docs/pwa.md)
 *   node tools/ikoni.mjs --inline-> latausruudun <svg> vakiovirtaan
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const JUURI = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/* Kartan tuuliramppi. Sama taulukko kuin index.html:n RAMP_KARTTA —
   merkki EI saa keksiä omia sävyjä, koska sen koko idea on olla se
   asteikko jota sovellus piirtää. */
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

/* ------------------------------------------------------------------
   Geometria.

   Kaari alkaa kello yhdeksältä hieman keskilinjan alapuolelta, kiertää
   myötäpäivään ylitse ja päättyy alas kaartuvaan koukkuun. Aukko jää
   alavasemmalle. Umpinainen rengas lukisi kehyksenä tai latausrinkulana;
   aukko ja koukku tekevät siitä liikkeen.

   Leveys kasvaa POTENSSILLA 0,62 eikä lineaarisesti: lineaarinen jättää
   kapean pään näkymättömän ohueksi koko alkumatkalle, vaikka kaaren pitää
   lukea viivana heti ensimmäisestä asteesta.
   ------------------------------------------------------------------ */
const K       = 512;   /* piirtoruudukko                           */
const SADE    = 150;   /* kaaren keskiviivan säde ennen sovitusta   */
const LEV_0   = 9;     /* kapean pään leveys                        */
const LEV_1   = 72;    /* leveän pään leveys                        */
const A_ALKU  = 160;   /* asteina; 0 = kello kolme, kasvaa myötäpäivään */
const A_PYYHK = 270;
/* Ääriviivan pisteitä reunaa kohti. 64 on mitattu riittäväksi: yhden
   jänteen poikkeama kaaresta on 512 px:n ruudukolla 0,13 px, eli alle
   puolen pikselin myös kolminkertaisella laitteella. Tiheämpi vain
   lihottaa index.html:ään upotettua merkkiä. */
const NAYTE   = 64;

/* Merkin osuus sivusta. Kotivalikon ikoni saa olla täyteen asti;
   maskattava ei, koska Android leikkaa siitä 80 %:n ympyrän. */
const OSUUS_TAYSI    = 0.76;
const OSUUS_MASKATTU = 0.58;

const rad = a => (a * Math.PI) / 180;
const p2  = n => Math.round(n * 100) / 100;

const levAt = t => LEV_0 + (LEV_1 - LEV_0) * Math.pow(t, 0.62);
const keskiPiste = t => {
  const a = rad(A_ALKU + A_PYYHK * t);
  return [SADE * Math.cos(a), SADE * Math.sin(a)];
};
const reuna = (t, puoli) => {
  const a = rad(A_ALKU + A_PYYHK * t);
  const r = SADE + (puoli * levAt(t)) / 2;
  return [r * Math.cos(a), r * Math.sin(a)];
};

/* Ääriviiva keskitettynä origoon ja skaalattuna niin että sen PITEMPI
   sivu on `osuus` ruudukon sivusta. Keskitys tehdään rajauslaatikosta
   eikä ympyrän keskipisteestä: kaari ei ole symmetrinen, joten
   geometrinen keskipiste jättäisi merkin ylös ja vasemmalle. */
function aariviiva(osuus) {
  const ulko = [], sisa = [];
  for (let i = 0; i <= NAYTE; i++) {
    const t = i / NAYTE;
    ulko.push(reuna(t, +1));
    sisa.push(reuna(t, -1));
  }
  const kaikki = ulko.concat(sisa);
  const xs = kaikki.map(p => p[0]), ys = kaikki.map(p => p[1]);
  const xMin = Math.min(...xs), xMax = Math.max(...xs);
  const yMin = Math.min(...ys), yMax = Math.max(...ys);
  const s  = (K * osuus) / Math.max(xMax - xMin, yMax - yMin);
  const dx = K / 2 - ((xMin + xMax) / 2) * s;
  const dy = K / 2 - ((yMin + yMax) / 2) * s;
  const M  = ([x, y]) => [p2(x * s + dx), p2(y * s + dy)];

  const r0 = p2((levAt(0) / 2) * s), r1 = p2((levAt(1) / 2) * s);
  /* Peräkkäiset janat kirjoitetaan YHDEN L:n perään (implisiittinen
     lineto). Merkki upotetaan index.html:ään, joten jokainen turha
     kirjain on mukana jokaisessa latauksessa. */
  const jono = ps => ps.map(p => M(p).join(' ')).join(' ');
  let d = 'M' + M(ulko[0]).join(' ')
        + 'L' + jono(ulko.slice(1))
        + `A${r1} ${r1} 0 0 1 ` + M(sisa[NAYTE]).join(' ')
        + 'L' + jono(sisa.slice(0, NAYTE).reverse())
        + `A${r0} ${r0} 0 0 1 ` + M(ulko[0]).join(' ') + 'Z';
  return { d, muunna: M, keski: t => M(keskiPiste(t)) };
}

/* Ramppi maalataan ääriviivan sisään sektoreina: kärki ruudukon
   keskellä, säde ruudukon halkaisijan mittainen. Kulmaväliin jätetään
   limitys, muuten vierekkäisten sektorien väliin jää alipeitetty
   pikselirivi.
 *
 * VIUHKA ULOTTUU KAAREN KULMAVÄLIN YLI MOLEMMISTA PÄISTÄ. Pyöreä
 * päätykorkki pullistuu kulmavälin ULKOPUOLELLE, ja ilman ylitystä
 * sitä ei peitä yksikään sektori: korkki jäi meren väriseksi ja
 * leveä pää luki suorana leikkauksena. Ylityksen väri on rampin pää,
 * ei jatkettu ramppi. */
const YLITYS = 16;   /* astetta kummassakin päässä */

function sektorit(n = 64) {
  const R = K, cx = K / 2, cy = K / 2;
  const alku = A_ALKU - YLITYS, pyyhk = A_PYYHK + 2 * YLITYS;
  const limi = (pyyhk / n) * 0.06;
  /* t kulman mukaan, rampin päihin kiinnitettynä. */
  const tAt = a => Math.min(1, Math.max(0, (a - A_ALKU) / A_PYYHK));
  let out = '';
  for (let i = 0; i < n; i++) {
    const d0 = alku + (pyyhk * i) / n, d1 = alku + (pyyhk * (i + 1)) / n;
    const a0 = rad(d0 - limi), a1 = rad(d1 + limi);
    const x0 = p2(cx + R * Math.cos(a0)), y0 = p2(cy + R * Math.sin(a0));
    const x1 = p2(cx + R * Math.cos(a1)), y1 = p2(cy + R * Math.sin(a1));
    out += `<path d="M${cx} ${cy}L${x0} ${y0}A${R} ${R} 0 0 1 ${x1} ${y1}Z"`
        +  ` fill="${ramppiVari(tAt((d0 + d1) / 2))}"/>`;
  }
  return out;
}

/* Meri: sama sävyperhe kuin kartan --bg (#060912), ylhäältä hieman
   valoisampana jotta ikonilla on muotoa. Ei kiiltoa — iOS lopetti sen
   vuonna 2013 eikä kukaan ole kaivannut. */
const MERI_YLA = '#121D35';
const MERI_ALA = '#05080F';

/** Kotivalikon ikoni: meri + ramppikaari. */
export function ikoniSvg({ koko = K, maskattu = false } = {}) {
  const { d } = aariviiva(maskattu ? OSUUS_MASKATTU : OSUUS_TAYSI);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${K} ${K}"`
    + ` width="${koko}" height="${koko}" role="img"`
    + ` aria-label="FoilSpot">`
    + `<defs><linearGradient id="fs-meri" x1="0" y1="0" x2="0" y2="1">`
    + `<stop offset="0" stop-color="${MERI_YLA}"/>`
    + `<stop offset="1" stop-color="${MERI_ALA}"/></linearGradient>`
    + `<clipPath id="fs-kaari"><path d="${d}"/></clipPath></defs>`
    + `<rect width="${K}" height="${K}" fill="url(#fs-meri)"/>`
    + `<g clip-path="url(#fs-kaari)">${sektorit()}</g></svg>`;
}

/** Latausruudun merkki: sama ääriviiva, yksivärisenä musteena. */
export function merkkiSvg(id = 'load-logo-icon') {
  const { d } = aariviiva(0.94);
  return `<svg id="${id}" viewBox="0 0 ${K} ${K}" aria-hidden="true"`
    + ` xmlns="http://www.w3.org/2000/svg">`
    + `<path d="${d}" fill="currentColor"/></svg>`;
}

/* ------------------------------------------------------------------
   PNG-sarja. Rasterointi Chromiumilla: kontissa ei ole muuta
   rasteroijaa, eikä projektiin oteta riippuvuutta yhden staattisen
   kuvasarjan takia. Tiedostot ovat repossa valmiina — tämä ajetaan
   vain kun merkki muuttuu.
   ------------------------------------------------------------------ */
const PNGT = [
  { tiedosto: 'public/apple-touch-icon.png',  koko: 180, maskattu: false },
  { tiedosto: 'public/icon-192.png',          koko: 192, maskattu: false },
  { tiedosto: 'public/icon-512.png',          koko: 512, maskattu: false },
  { tiedosto: 'public/icon-maskable-512.png', koko: 512, maskattu: true  },
];

async function png() {
  const { chromium } = await import('playwright-core');
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
  console.log('public/icon.svg');
  if (process.argv.includes('--inline')) console.log(merkkiSvg());
  if (process.argv.includes('--png')) await png();
}
