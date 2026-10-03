/* Spottikortin mittari (docs/spottikortti.md, luku 8 "Rauhallinen ja
 * vakaa kortti", V12).
 *
 * Mittaa kortin ja laajan näkymän sitä mitä luvun 8.7 hyväksymismittarit
 * vaativat: mikään ei muuta kokoaan tunnin, kielen, leveyden, ladatun
 * datan tai mallien määrän mukaan, mikään teksti ei ole puoliksi näkyvissä
 * tai leikattu, ja sama tieto sanotaan kerran. Jokainen rivi on `ok` tai
 * `VIKA`; yksikin VIKA antaa poistumiskoodin 1, kuten graafimittauksessa.
 *
 * MALLIDATAA EI MITATA VERKOSTA (CLAUDE.md). Sama build antoi ennen
 * peräkkäisillä ajoilla 75 ja 0 malliviivaa, ja tunnin vaihtuessa kesken
 * mittauksen kortin sarjat laskettiin uudelleen (`KorttiSarjat._avain`
 * sisältää tunnin) — mallit olivat hetken "ei saatu". Siksi mittari
 * ISTUTTAA spotin sarjat `KorttiSarjat._m`:ään ja kiinnittää avaimen, ja
 * spotin oman sääsarjan (`spot.wx`: sade, lämpö, pilvet) samoin.
 * Sarjat ovat synteettisiä mutta kattavat kortin tilat: tyyni, rajatuuli,
 * hyvä ja liian kova, hyvin puuskainen, kaikki suunnat ja sadejaksot.
 * Havainnot, aallot ja vedenkorkeus tulevat verkosta kuten käyttäjällä —
 * ne ovat juuri niitä myöhään saapuvia moduuleita joiden siirtymät
 * avauksessa mitataan.
 *
 * Osat (`--osat=a,b`, oletuksena kaikki):
 *
 *   laaja     laaja näkymä 0–3 vertailumallilla levossa ja osoittaessa:
 *             lukemarivin ja kaavion korkeus, mallien nimet ja arvot
 *             näkyvissä, valintaohjain näkyvissä, kupla (koko, paikka,
 *             tekstit kuplan sisällä, puolen vaihdot), puoliksi näkyvät
 *             tekstit — puhelimet pystyssä ja vaakassa, iPad, työpöytä
 *   tunnit    127 tuntia (nyt −6 h … +120 h) aikajanan polulla: heron,
 *             ennusteosion ja laattojen korkeus ja kaavion paikka,
 *             320–430 px, suomi ja englanti
 *   vaihto    ennusteen vaihto valikosta, myös lataus ja "ei saatu":
 *             ennusteosion korkeus ruutu ruudulta
 *   lukema    hero on kaavion lukema (osoittaessa ja valitun mallin
 *             luvut), tiivis lukema yläpalkissa
 *   avaus     ensimmäinen avaus: moduulien paikat 10 s ajan
 *   teksti    puoliksi näkyvät ja kolmeen pisteeseen katkaistut tekstit
 *             kortissa (levossa ja kaavio vieritettynä)
 *   kahdennus sama tieto moneen kertaan (luku, lähde, asemat, hetki)
 *   tyyli     tekstityylit, kirjasinkoot, värit, laatikot, versaalit,
 *             kortin korkeus ja ensimmäinen ruudullinen
 *   regressio hero = Paras, spottimerkin indeksi = heron indeksi, ja
 *             (oikealla datalla, jos varasto vastaa) kortti = aikajana
 *
 * Käyttö:  npm run build && npx vite preview --port 4173 &
 *          PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *            node tools/korttimittaus.mjs http://localhost:4173 [--osat=laaja,tunnit] [--nopea] [--kuvat=kansio]
 *
 * `--nopea` ottaa tunneista joka kolmannen ja vähemmän laitteita. Tämä
 * EI ole CI:ssä: kortti hakee havainnot, aallot ja vedenkorkeuden
 * oikeista palveluista, ja avauksen mittaus on niiden ajoituksen
 * mittaamista. Ruutunopeutta ja iOS:n tuntumaa tämä ei mittaa (CLAUDE.md,
 * "Mittaaminen tässä ympäristössä"); kontissa ei ole WebKitiä. */

const argv = process.argv.slice(2);
const osoite = (argv.find((a) => !a.startsWith('--')) || 'http://localhost:4173').replace(/\/$/, '');
const lippu = (n) => { const a = argv.find((x) => x.startsWith('--' + n)); return a ? (a.includes('=') ? a.split('=')[1] : true) : null; };
const OSAT = (lippu('osat') || 'laaja,tunnit,vaihto,lukema,avaus,teksti,kahdennus,tyyli,regressio').split(',');
const NOPEA = !!lippu('nopea');
/* `--laitteet=p390,v844 en` rajaa tapaukset (laite tai "laite kieli"). */
const LAITTEET_RAJAUS = lippu('laitteet') ? String(lippu('laitteet')).split(',').map((x) => x.trim()) : null;
const rajaa = (tapaukset) => !LAITTEET_RAJAUS ? tapaukset : tapaukset.filter((t) => {
  const [laite, kieli] = Array.isArray(t) ? t : [t, ''];
  return LAITTEET_RAJAUS.includes(laite) || LAITTEET_RAJAUS.includes(laite + (kieli ? ' ' + kieli : ''));
});
const KUVAT = lippu('kuvat');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs = await import('node:fs');
if (KUVAT) fs.mkdirSync(KUVAT, { recursive: true });

const viat = [];
const tarkista = (nimi, ok, tieto) => {
  console.log('  ' + (ok ? 'ok  ' : 'VIKA') + ' ' + nimi + (tieto != null && tieto !== '' ? ' — ' + tieto : ''));
  if (!ok) viat.push(nimi);
};
const nuku = (ms) => new Promise((r) => setTimeout(r, ms));
const eri = (arr) => [...new Set(arr.map((v) => (typeof v === 'number' ? Math.round(v * 2) / 2 : v)))];
const SPOTTI = 'Lauttasaari';

/* `hasTouch` molempiin suuntiin (CLAUDE.md, "Mobiiliharness ei ole mobiili
   ilman hasTouchia"). Työpöytä on ainoa ilman. */
const LAITTEET = {
  p320:    { viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  p360:    { viewport: { width: 360, height: 780 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  p375:    { viewport: { width: 375, height: 667 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  p390:    { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  p414:    { viewport: { width: 414, height: 896 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  p430:    { viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  v667:    { viewport: { width: 667, height: 375 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  v844:    { viewport: { width: 844, height: 390 }, deviceScaleFactor: 3, hasTouch: true, isMobile: true },
  ipad:    { viewport: { width: 820, height: 1180 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  tyopoyta: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};

const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

/* Sivulla: synteettiset sarjat spotille. Aika tunnin monikertoina
   paikallisessa ajassa (konteksti on Europe/Helsinki). */
function istuta(nimi) {
  const FS = window.FS, K = FS.KorttiSarjat, s = FS.SPOTS.find((x) => x.name === nimi);
  const H = 36e5, nyt = Math.round(Date.now() / H) * H;
  const alku = nyt - 48 * H, loppu = nyt + 15 * 24 * H;
  /* Perustuuli: vuorokausirytmi, hidas aalto, myrsky noin +100 h (yli
     18 m/s eli "liian kova", kortin ja laajan oletusikkunan ulkopuolella)
     ja tyyni jakso noin +30 h. Suunta kiertää koko kehän noin 50
     tunnissa, joten "N° sivussa parhaasta" ja suunnan sopivuus
     vaihtelevat; puuskasuhde 1,15–1,70 ("hyvin puuskainen" mukana). */
  const perus = (t) => {
    const h = (t - nyt) / H, klo = new Date(t).getHours();
    let v = 5.2 + 2.6 * Math.sin((klo - 9) / 24 * 2 * Math.PI) + 2.4 * Math.sin(h / 9.7) + 9.5 * Math.exp(-Math.pow((h - 100) / 7, 2));
    v *= 1 - 0.85 * Math.exp(-Math.pow((h - 30) / 5, 2));
    return Math.max(0.4, v);
  };
  const suunta = (t) => ((t - nyt) / H * 7.2 + 200 + 3600) % 360;
  const suhde = (t) => 1.15 + 0.55 * (0.5 + 0.5 * Math.sin((t - nyt) / H / 4.3));
  const sarja = (id, a, b, f, lahde) => {
    const tt = [];
    for (let t = a; t <= b; t += H) tt.push(t);
    const T = new Float64Array(tt);
    const ms = tt.map(f), dir = tt.map((t) => (suunta(t) + (id === 'icon' ? 14 : id === 'gfs' ? -18 : 0) + 360) % 360);
    const gust = tt.map((t, i) => ms[i] * suhde(t));
    return { id: id, t: T, ms: ms, dir: dir, gust: gust, lahde: tt.map(lahde), alkuMs: a, loppuMs: b };
  };
  const parasLahde = (t) => t < nyt ? 'metnordic' : (t <= nyt + 60 * H ? 'fmi' : (t <= nyt + 138 * H ? 'ecmwf9' : 'laatta'));
  const sarjat = {
    paras: sarja('paras', alku, loppu, perus, parasLahde),
    fmi: sarja('fmi', nyt - 12 * H, nyt + 60 * H, perus, () => 'fmi'),
    metnordic: sarja('metnordic', alku, nyt + 60 * H, (t) => Math.max(0.3, perus(t) - 0.25), () => 'metnordic'),
    ecmwf: sarja('ecmwf', nyt - 24 * H, nyt + 144 * H, (t) => perus(t) * 1.05 + 0.3, () => 'ecmwf9'),
    icon: sarja('icon', nyt - 24 * H, nyt + 180 * H, (t) => Math.max(0.3, perus(t) * 0.92 + 0.8), (t) => t <= nyt + 78 * H ? 'icon_eu' : 'icon'),
    gfs: sarja('gfs', nyt - 24 * H, loppu, (t) => Math.max(0.3, perus(t) * 1.12 - 0.2 + 0.6 * Math.sin((t - nyt) / H / 9)), () => 'gfs'),
  };
  K._avain = function () { return 'korttimittaus'; };
  K._m.clear();
  K._m.set(nimi, { avain: 'korttimittaus', sarjat: sarjat, lupaukset: {} });
  /* Spotin oma sarja: sade kahdessa jaksossa (ensimmäinen 48 h:n
     ikkunassa, toinen myrskyn kohdalla), lämpö, pilvet, sääkoodi. */
  const time = [], ws = [], wd = [], wg = [], tmp = [], mm = [], cc = [], wc = [];
  const p2 = (n) => ('0' + n).slice(-2);
  for (let t = alku; t <= loppu; t += H) {
    const d = new Date(t), h = (t - nyt) / H;
    time.push(d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()) + 'T' + p2(d.getHours()) + ':00');
    ws.push(perus(t)); wd.push(suunta(t)); wg.push(perus(t) * suhde(t));
    tmp.push(9 + 3.5 * Math.sin((d.getHours() - 9) / 24 * 2 * Math.PI));
    const sade = (h >= 18 && h <= 24) ? 0.3 + 0.25 * (h - 18) : ((h >= 94 && h <= 106) ? 1.4 + Math.sin(h) : 0);
    mm.push(sade); cc.push(sade > 0 ? 95 : (40 + 40 * Math.sin(h / 6)));
    wc.push(sade > 1 ? 63 : sade > 0 ? 61 : (Math.sin(h / 6) > 0.3 ? 3 : 1));
  }
  s.wx = { hourly: { time: time, windspeed_10m: ws, winddirection_10m: wd, windgusts_10m: wg, temperature_2m: tmp,
                     precipitation: mm, cloudcover: cc, weather_code: wc }, harmonie_hours: 48 + 60 };
  return Object.keys(sarjat).map((k) => k + ':' + sarjat[k].t.length).join(' ');
}

async function avaa(laite, o = {}) {
  const kons = await selain.newContext({ ...LAITTEET[laite], locale: o.kieli === 'en' ? 'en-GB' : 'fi-FI',
    timezoneId: 'Europe/Helsinki', serviceWorkers: 'block', ignoreHTTPSErrors: true, reducedMotion: o.liike ? 'no-preference' : 'reduce' });
  const sivu = await kons.newPage();
  sivu._virheet = [];
  sivu.on('pageerror', (e) => sivu._virheet.push(e.message));
  await sivu.addInitScript((alku) => {
    try {
      localStorage.setItem('fs_opastus', '1');
      localStorage.setItem('fs_vihje_kaavio', '0');
      localStorage.setItem('fs_kortti_mallit', JSON.stringify(alku.mallit || { pohja: 'paras', valitut: [] }));
    } catch (e) {}
  }, { mallit: o.mallit || null });
  await sivu.goto(osoite + '/?perf=1' + (o.kieli ? '&kieli=' + o.kieli : ''), { waitUntil: 'domcontentloaded' });
  await sivu.waitForFunction(() => { const el = document.getElementById('loading'); return el && el.classList.contains('hidden') && window.FS; }, null, { timeout: 120000 });
  await sivu.addStyleTag({ content: '#perf-panel{display:none!important}' });
  if (o.istuta !== false) await sivu.evaluate(istuta, SPOTTI);
  return { kons, sivu };
}

async function avaaKortti(sivu, odota = 1500) {
  await sivu.evaluate((n) => window.FS.openSheet(window.FS.SPOTS.find((x) => x.name === n)), SPOTTI);
  await sivu.waitForFunction(() => document.querySelector('#sheet-content [data-en-kaare] svg.tk-svg'), null, { timeout: 30000 });
  await nuku(odota);
}

/* Nykyhetken indeksi aikajanalla (sama pyöristys kuin `nowIdx`). */
const nytIdx = (sivu) => sivu.evaluate(() => {
  const T = window.FS.State._tlTimes || [], nyt = Date.now();
  let p = 0, e = Infinity;
  T.forEach((t, i) => { const d = Math.abs(Date.parse(t) - nyt); if (d < e) { e = d; p = i; } });
  return p;
});

/* ── Sivulla ajettavat apurit (yksi funktio, kopioidaan evaluateen) ── */
function apurit() {
  if (window.__km) return;
  const km = window.__km = {};
  /* Tekstin näkyvä osuus 0..1, null = ei piirretty. Leikkaus tulee
     esivanhemmista joiden `overflow` ei ole `visible` (kortin pysty-
     vieritys ei leikkaa: vierittämällä teksti tulee näkyviin), ja
     vieritettävän kaavion vasemmasta reunasta kiinteän y-akselin
     (`.ak-akseli`, 34 px) alta. Läpinäkyvyys 0 ja `visibility: hidden`
     ovat piilossa. */
  km.osuus = function (el, rect) {
    const r = rect || el.getBoundingClientRect();
    if (!(r.width > 0.5 && r.height > 0.5)) return null;
    const cs0 = getComputedStyle(el);
    if (cs0.visibility === 'hidden' || cs0.display === 'none' || parseFloat(cs0.opacity) < 0.02) return null;
    let x0 = r.left, x1 = r.right, y0 = r.top, y1 = r.bottom;
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p);
      if (cs.display === 'none' || parseFloat(cs.opacity) < 0.02) return null;
      if (p.hidden) return null;
      const q = p.getBoundingClientRect();
      const pystyVieritys = p.id === 'sheet-scroll';
      if (cs.overflowX !== 'visible') { x0 = Math.max(x0, q.left); x1 = Math.min(x1, q.right); }
      if (cs.overflowY !== 'visible' && !pystyVieritys) { y0 = Math.max(y0, q.top); y1 = Math.min(y1, q.bottom); }
      if (p.classList && p.classList.contains('en-kaare')) {
        const ak = p.parentElement && p.parentElement.querySelector(':scope > .ak-akseli');
        if (ak) x0 = Math.max(x0, ak.getBoundingClientRect().right);
      }
    }
    x0 = Math.max(x0, 0); x1 = Math.min(x1, window.innerWidth);
    const w = Math.max(0, x1 - x0), h = Math.max(0, y1 - y0);
    return (w * h) / (r.width * r.height);
  };
  /* Näkyvät tekstit juuren alla: HTML-tekstisolmut (Range-laatikko) ja
     SVG:n <text>. */
  km.tekstit = function (juuri) {
    const ulos = [];
    const kavele = (n) => {
      for (const c of n.childNodes) {
        if (c.nodeType === 3) {
          const t = c.textContent.replace(/\s+/g, ' ').trim();
          if (!t) continue;
          const el = c.parentElement;
          if (el.closest('svg') && el.tagName.toLowerCase() !== 'text' && !el.closest('text')) continue;
          const svgTeksti = el.closest('text');
          let r;
          if (svgTeksti) r = svgTeksti.getBoundingClientRect();
          else { const rg = document.createRange(); rg.selectNodeContents(c); r = rg.getBoundingClientRect(); }
          const os = km.osuus(svgTeksti || el, r);
          if (os == null) continue;
          ulos.push({ t: t, el: svgTeksti || el, os: os, svg: !!svgTeksti, r: r });
        } else if (c.nodeType === 1) {
          const tag = c.tagName.toLowerCase();
          if (tag === 'style' || tag === 'script' || tag === 'defs') continue;
          kavele(c);
        }
      }
    };
    if (juuri) kavele(juuri);
    return ulos;
  };
  /* Puoliksi näkyvät ja kolmeen pisteeseen katkaistut. */
  km.osittaiset = function (juuri) {
    const t = km.tekstit(juuri);
    const osittain = t.filter((x) => x.os > 0.02 && x.os < 0.98).map((x) => x.t.slice(0, 26) + ' [' + Math.round(x.os * 100) + ' %]');
    const katkaistu = [];
    const nahty = new Set();
    t.forEach((x) => {
      const el = x.svg ? null : x.el;
      if (!el || nahty.has(el) || x.os < 0.02) return;
      nahty.add(el);
      for (let p = el; p && p !== juuri; p = p.parentElement) {
        const cs = getComputedStyle(p);
        if (cs.textOverflow === 'ellipsis' && p.scrollWidth > p.clientWidth + 1) { katkaistu.push(p.textContent.replace(/\s+/g, ' ').trim().slice(0, 30)); break; }
      }
    });
    return { osittain: osittain, katkaistu: [...new Set(katkaistu)] };
  };
  km.korkeus = (sel, juuri) => { const el = (juuri || document).querySelector(sel); return el ? Math.round(el.getBoundingClientRect().height * 10) / 10 : null; };
  km.ylä = (sel) => {
    const sc = document.getElementById('sheet-content'), el = sc && sc.querySelector(sel);
    return el ? Math.round((el.getBoundingClientRect().top - sc.getBoundingClientRect().top) * 10) / 10 : null;
  };
  km.ctx = () => { const o = document.querySelector('#sheet-content [data-ennuste]'); return o && o._en; };
  km.malleja = (n) => {
    const FS = window.FS, ctx = km.ctx(), a = FS.Ennuste.asetus();
    a.valitut = ['ecmwf', 'icon', 'gfs'].slice(0, n);
    FS.Ennuste.tallenna();
    FS.Ennuste._muuttui(ctx);
  };
  /* Osoita kääreen kaaviota kohdassa `osuus` näkyvästä leveydestä (osoittimen
     oma polku, `_akOsoitin.nayta`). */
  km.osoita = (kaare, osuus) => {
    if (!kaare || !kaare._akOsoitin) return null;
    if (osuus == null) { kaare._akOsoitin.nayta(null); return null; }
    const g = kaare._geot[0], W0 = kaare._W0 || kaare.clientWidth;
    const t = Math.round(g.msX(kaare.scrollLeft + 34 + (W0 - 34) * osuus) / 36e5) * 36e5;
    kaare._akOsoitin.nayta(t);
    return t;
  };
  /* Kupla: suorakaide, näkyvät tekstit ja piirtoalue ruudulla. */
  km.kupla = (kaare) => {
    const kg = kaare.querySelector('[data-tk-kupla]');
    if (!kg || getComputedStyle(kg).visibility === 'hidden') return null;
    const rect = kg.querySelector('rect').getBoundingClientRect();
    const svg = kaare.querySelector('svg.tk-svg'), g = kaare._geot[0], s = svg.getBoundingClientRect(), k = kaare.getBoundingClientRect();
    const ak = kaare.parentElement.querySelector(':scope > .ak-akseli');
    const alue = { x0: ak ? ak.getBoundingClientRect().right : k.left, x1: k.right, y0: s.top + g.y0, y1: s.top + g.pohja };
    const tekstit = [...kg.querySelectorAll('text')].filter((t) => getComputedStyle(t).visibility !== 'hidden' && t.textContent)
      .map((t) => { const q = t.getBoundingClientRect(); return { t: t.textContent, x0: q.left, x1: q.right, y0: q.top, y1: q.bottom }; });
    return { x: rect.left, y: rect.top, w: rect.width, h: rect.height, x1: rect.right, y1: rect.bottom, alue: alue, tekstit: tekstit };
  };
}

/* ── 1. LAAJA ─────────────────────────────────────────────────────── */
async function osaLaaja() {
  console.log('\nLAAJA: 0–3 vertailumallia, levossa ja osoittaessa');
  const tapaukset = NOPEA
    ? [['p390', ''], ['p360', 'en'], ['v844', ''], ['tyopoyta', '']]
    : [['p320', ''], ['p360', ''], ['p375', ''], ['p390', ''], ['p390', 'en'], ['p360', 'en'], ['v667', ''], ['v844', ''], ['v844', 'en'], ['ipad', ''], ['tyopoyta', ''], ['tyopoyta', 'en']];
  for (const [laite, kieli] of rajaa(tapaukset)) {
    const nimi = laite + (kieli ? ' ' + kieli : '');
    const { kons, sivu } = await avaa(laite, { kieli });
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu);
      await sivu.evaluate(() => document.querySelector('#sheet-content [data-ennuste] [data-hav-laajenna]').click());
      await sivu.waitForFunction(() => document.querySelector('#hav-laaja.auki [data-en-kaare] svg.tk-svg'), null, { timeout: 20000 });
      await nuku(700);
      const korkeudet = [], kaaviot = [], mallit = [], ohjain = [], kuplat = [], paikat = [], osittain = new Set(), katkaistu = new Set();
      for (let n = 0; n <= 3; n++) {
        await sivu.evaluate((n) => window.__km.malleja(n), n);
        await nuku(500);
        for (const os of [null, 0.08, 0.3, 0.55, 0.8, 0.97]) {
          const m = await sivu.evaluate(([n, os]) => {
            const km = window.__km, hl = document.getElementById('hav-laaja'), kaare = hl.querySelector('[data-en-kaare]');
            const t = km.osoita(kaare, os);
            const FS = window.FS, valitut = FS.Ennuste.asetus().valitut;
            /* Valitut mallit lukemarivillä: solu jossa nimi ja arvo. */
            const solut = valitut.map((id) => {
              const nimi = FS.KorttiSarjat.malli(id).nimi;
              const el = hl.querySelector('#hl-lukema [data-lk-malli="' + id + '"]')
                || [...hl.querySelectorAll('#hl-lukema .en-mallisolu')].find((x) => x.textContent.indexOf(nimi) >= 0);
              return { id: id, os: el ? km.osuus(el) : null, teksti: el ? el.textContent.replace(/\s+/g, ' ').trim() : '' };
            });
            /* Valintaohjain: sirut (vanha) tai Vertaa-nappi (uusi). */
            const sirut = valitut.map((id) => {
              const s = hl.querySelector('.en-siru[data-malli="' + id + '"]');
              return s ? { id: id, os: km.osuus(s) } : null;
            }).filter(Boolean);
            const vertaa = hl.querySelector('[data-en-vertaa]');
            const kupla = os != null ? km.kupla(kaare) : null;
            const ost = km.osittaiset(hl);
            /* Solujen paikat (vasen reuna rivin alusta): kiinteät sarakkeet. */
            const lk = hl.querySelector('#hl-lukema'), lx = lk.getBoundingClientRect().left;
            const paikat = [...lk.querySelectorAll('.en-solu')].map((s) => Math.round(s.getBoundingClientRect().left - lx)).join(',');
            km.osoita(kaare, null);
            return { lukema: km.korkeus('#hl-lukema'), kaavio: km.korkeus('#hl-kaavio'), solut: solut, sirut: sirut,
                     vertaa: vertaa ? km.osuus(vertaa) : null, kupla: kupla, ost: ost, t: t, paikat: paikat };
          }, [n, os]);
          korkeudet.push(m.lukema); kaaviot.push(m.kaavio);
          if (n === 3) { m.solut.forEach((s) => mallit.push(s)); paikat.push(m.paikat); }
          m.sirut.forEach((s) => ohjain.push(s));
          if (n === 3 && !m.sirut.length) ohjain.push({ id: 'vertaa', os: m.vertaa });
          if (m.kupla) kuplat.push(Object.assign({ n: n, os: os }, m.kupla));
          m.ost.osittain.forEach((x) => osittain.add(x));
          m.ost.katkaistu.forEach((x) => katkaistu.add(x));
        }
      }
      tarkista('laaja ' + nimi + ': lukemarivin korkeus sama 0–3 mallilla, levossa ja osoittaessa', eri(korkeudet).length === 1, eri(korkeudet).join(' / ') + ' px');
      tarkista('laaja ' + nimi + ': kaavion korkeus sama', eri(kaaviot).length === 1, eri(kaaviot).join(' / ') + ' px');
      const piilossa = mallit.filter((s) => !(s.os >= 0.99));
      tarkista('laaja ' + nimi + ': valittujen mallien nimet ja arvot näkyvissä', piilossa.length === 0,
        piilossa.length ? [...new Set(piilossa.map((s) => s.id + ' ' + (s.os == null ? 'puuttuu' : Math.round(s.os * 100) + ' %')))].join(', ') : '3 mallia × 6 tilaa');
      tarkista('laaja ' + nimi + ': lukemarivin solut eivät siirry (3 mallia, levossa ja osoittaessa)', eri(paikat).length === 1,
        eri(paikat).length + ' asettelua' + (eri(paikat).length > 1 ? ' (' + eri(paikat).slice(0, 3).join(' | ') + ')' : ''));
      const ohjPiilossa = ohjain.filter((s) => !(s.os >= 0.99));
      tarkista('laaja ' + nimi + ': mallien valinta näkyvissä', ohjPiilossa.length === 0,
        ohjPiilossa.length ? [...new Set(ohjPiilossa.map((s) => s.id + ' ' + (s.os == null ? 'puuttuu' : Math.round(s.os * 100) + ' %')))].join(', ') : '');
      /* Kupla: P11 (käyttäjän päätös 3.10.: kupla jää, mutta kiinteän
         kokoisena eikä koskaan leikkautuneena). Koko mallimäärää kohti. */
      const kokoja = [0, 1, 2, 3].map((n) => eri(kuplat.filter((k) => k.n === n).map((k) => Math.round(k.w) + '×' + Math.round(k.h))));
      tarkista('laaja ' + nimi + ': kupla kiinteän kokoinen (mallimäärää kohti)', kokoja.every((k) => k.length <= 1), kokoja.map((k, n) => n + ': ' + k.join(' / ')).join(' · '));
      const ulos = kuplat.filter((k) => k.x < k.alue.x0 - 0.5 || k.x1 > k.alue.x1 + 0.5 || k.y < k.alue.y0 - 0.5 || k.y1 > k.alue.y1 + 0.5);
      tarkista('laaja ' + nimi + ': kupla näkyvän piirtoalueen sisällä', ulos.length === 0,
        ulos.length ? ulos.length + '/' + kuplat.length + ', esim. x ' + Math.round(ulos[0].x - ulos[0].alue.x0) + ' / ' + Math.round(ulos[0].alue.x1 - ulos[0].x1) + ' px' : kuplat.length + ' osoitusta');
      const yli = [];
      kuplat.forEach((k) => k.tekstit.forEach((t) => { if (t.x0 < k.x + 1 || t.x1 > k.x1 - 1 || t.y0 < k.y || t.y1 > k.y1) yli.push(t.t + ' (' + Math.round(Math.max(k.x + 1 - t.x0, t.x1 - k.x1 + 1)) + ' px)'); }));
      tarkista('laaja ' + nimi + ': kuplan tekstit kuplan sisällä', yli.length === 0, [...new Set(yli)].slice(0, 4).join(', '));
      tarkista('laaja ' + nimi + ': ei puoliksi näkyviä tekstejä', osittain.size === 0, [...osittain].slice(0, 6).join(' · '));
      tarkista('laaja ' + nimi + ': ei katkaistuja tekstejä', katkaistu.size === 0, [...katkaistu].slice(0, 4).join(' · '));
      if (KUVAT) {
        await sivu.evaluate(() => { const km = window.__km; km.malleja(3); });
        await nuku(500);
        await sivu.evaluate(() => { const kaare = document.querySelector('#hav-laaja [data-en-kaare]'); window.__km.osoita(kaare, 0.72); });
        await sivu.screenshot({ path: KUVAT + '/laaja-' + nimi.replace(' ', '-') + '.png' });
      }
      if (sivu._virheet.length) tarkista('laaja ' + nimi + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 2. TUNNIT ────────────────────────────────────────────────────── */
async function osaTunnit() {
  console.log('\nTUNNIT: 127 tuntia aikajanan polulla (nyt −6 h … +120 h)');
  const tapaukset = NOPEA
    ? [['p375', ''], ['p390', 'en']]
    : [['p320', ''], ['p360', ''], ['p375', ''], ['p390', ''], ['p414', ''], ['p430', ''], ['p320', 'en'], ['p390', 'en'], ['tyopoyta', '']];
  const askel = NOPEA ? 3 : 1;
  for (const [laite, kieli] of rajaa(tapaukset)) {
    const nimi = laite + (kieli ? ' ' + kieli : '');
    const { kons, sivu } = await avaa(laite, { kieli });
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu);
      const i0 = await nytIdx(sivu);
      const rivit = [];
      for (let d = -6; d <= 120; d += askel) {
        await sivu.evaluate((i) => window.FS._tlValitseIdx(i), i0 + d);
        await nuku(90);
        rivit.push(await sivu.evaluate(() => {
          const km = window.__km;
          return { hero: km.korkeus('#sh-tunti'), ennuste: km.korkeus('#sheet-content [data-ennuste]'), laatat: km.korkeus('#sh-laatat-tunti'),
                   kaavioY: km.ylä('[data-ennuste] .ak-kehys'), kortti: km.korkeus('#sheet-content') };
        }));
      }
      const yht = (k) => { const v = eri(rivit.map((r) => r[k])); let m = 0; for (let i = 1; i < rivit.length; i++) if (rivit[i][k] !== rivit[i - 1][k]) m++; return { v, m }; };
      for (const [k, sel] of [['hero', 'heron korkeus'], ['ennuste', 'ennusteosion korkeus'], ['laatat', 'valitun tunnin laattojen korkeus'], ['kaavioY', 'kaavion paikka pystysuunnassa']]) {
        const y = yht(k);
        tarkista('tunnit ' + nimi + ': ' + sel + ' sama ' + rivit.length + ' tunnin yli', y.v.length === 1,
          y.v.length + ' arvoa (' + y.v.slice(0, 6).join(', ') + (y.v.length > 6 ? ', …' : '') + '), ' + y.m + ' muutosta');
      }
      if (sivu._virheet.length) tarkista('tunnit ' + nimi + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 3. ENNUSTEEN VAIHTO ──────────────────────────────────────────── */
async function osaVaihto() {
  console.log('\nVAIHTO: ennusteen vaihto valikosta (lataus ja "ei saatu" mukana)');
  for (const laite of rajaa(NOPEA ? ['p390'] : ['p390', 'p360', 'tyopoyta'])) {
    const { kons, sivu } = await avaa(laite);
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu);
      /* ICON latautuu 700 ms (paikanpitäjä näkyy), GFS:ää ei saada. */
      await sivu.evaluate((nimi) => {
        const K = window.FS.KorttiSarjat, tila = K._m.get(nimi), varasto = Object.assign({}, tila.sarjat);
        delete tila.sarjat.icon; delete tila.sarjat.gfs;
        const alkup = K.lataa.bind(K);
        K.lataa = function (spot, id, kun) {
          if (spot.name === nimi && id === 'icon' && !tila.sarjat.icon) {
            return new Promise((r) => setTimeout(() => { tila.sarjat.icon = varasto.icon; if (kun) kun(varasto.icon); r(varasto.icon); }, 700));
          }
          if (spot.name === nimi && id === 'gfs') return Promise.resolve(null);
          return alkup(spot, id, kun);
        };
      }, SPOTTI);
      const naytteet = [];
      for (const id of ['ecmwf', 'icon', 'gfs', 'metnordic', 'fmi', 'paras']) {
        const r = await sivu.evaluate(async (id) => {
          const km = window.__km, ctx = km.ctx(), osio = ctx.osio, ulos = [];
          window.FS.Ennuste.asetaPohja(ctx, id);
          const t0 = performance.now();
          await new Promise((valmis) => {
            const kierros = () => {
              ulos.push({ e: Math.round(osio.getBoundingClientRect().height * 10) / 10, h: km.korkeus('#sh-tunti'), paikka: !!osio.querySelector('.en-paikka') });
              if (performance.now() - t0 < 1500) requestAnimationFrame(kierros); else valmis();
            };
            kierros();
          });
          return ulos;
        }, id);
        naytteet.push({ id: id, r: r });
      }
      const kaikki = naytteet.flatMap((x) => x.r.map((y) => y.e));
      const heroT = naytteet.flatMap((x) => x.r.map((y) => y.h));
      const kuvaus = naytteet.map((x) => x.id + ' ' + eri(x.r.map((y) => y.e)).join('→') + (x.r.some((y) => y.paikka) ? ' (paikanpitäjä)' : '')).join(' · ');
      tarkista('vaihto ' + laite + ': ennusteosion korkeus sama kaikilla ennusteilla, latauksessa ja virheessä', eri(kaikki).length === 1, kuvaus);
      tarkista('vaihto ' + laite + ': heron korkeus sama ennusteen vaihdossa', eri(heroT).length === 1, eri(heroT).join(' / ') + ' px');
      if (sivu._virheet.length) tarkista('vaihto ' + laite + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 4. LUKEMA: HERO ON KAAVION LUKEMA (P10, P13) ─────────────────── */
async function osaLukema() {
  console.log('\nLUKEMA: hero lukee kaaviota (P10), seuraa sen ennustetta (P13) ja yläpalkki kertoo sen kun hero ei näy');
  for (const laite of rajaa(NOPEA ? ['p390'] : ['p390', 'tyopoyta'])) {
    const { kons, sivu } = await avaa(laite);
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu);
      const r = await sivu.evaluate(() => {
        const km = window.__km, FS = window.FS, ctx = km.ctx(), kaare = ctx.osio.querySelector('[data-en-kaare]');
        const s = FS.SPOTS.find((x) => x.name === 'Lauttasaari');
        const hero = () => (document.querySelector('#sh-tunti .sh-big-wind') || {}).textContent;
        const ulos = { osoitus: [], korkeus: [] };
        const paras = FS.KorttiSarjat.valmis(s, 'paras');
        ulos.korkeus.push(km.korkeus('#sh-tunti'));
        for (const os of [0.15, 0.5, 0.85]) {
          const t = km.osoita(kaare, os);
          const a = FS.KorttiSarjat.arvo(paras, t);
          ulos.osoitus.push({ hero: hero(), odotettu: a ? Units.fmt(a.ms) : null });
          ulos.korkeus.push(km.korkeus('#sh-tunti'));
        }
        km.osoita(kaare, null);
        return ulos;
      });
      const osuu = r.osoitus.map((o) => (o.hero || '').trim() === (o.odotettu || '').trim());
      tarkista('lukema ' + laite + ': hero näyttää osoitetun tunnin (P10)', osuu.every(Boolean),
        r.osoitus.map((o) => 'hero ' + o.hero + ' / kaavio ' + o.odotettu).join(' · '));
      tarkista('lukema ' + laite + ': heron korkeus ei muutu osoittaessa', eri(r.korkeus).length === 1, eri(r.korkeus).join(' / ') + ' px');
      /* Valittu malli kaavioon: heron luku sen mallin (P13) ja nimetty. */
      const p13 = await sivu.evaluate(async () => {
        const km = window.__km, FS = window.FS, ctx = km.ctx();
        FS.Ennuste.asetaPohja(ctx, 'icon');
        await new Promise((r) => setTimeout(r, 400));
        const s = FS.SPOTS.find((x) => x.name === 'Lauttasaari'), icon = FS.KorttiSarjat.valmis(s, 'icon');
        const a = FS.KorttiSarjat.arvo(icon, ctx.valittu);
        const tulos = { hero: (document.querySelector('#sh-tunti .sh-big-wind') || {}).textContent, odotettu: a ? Units.fmt(a.ms) : null,
                        aikarivi: (document.querySelector('#sh-tunti .sh-aikarivi') || {}).textContent || '' };
        FS.Ennuste.asetaPohja(ctx, 'paras');
        await new Promise((r) => setTimeout(r, 300));
        return tulos;
      });
      tarkista('lukema ' + laite + ': ICON kaaviossa → heron luku ICONin (P13)', (p13.hero || '').trim() === (p13.odotettu || '').trim(), 'hero ' + p13.hero + ' / ICON ' + p13.odotettu);
      tarkista('lukema ' + laite + ': heron aikarivi nimeää mallin', /ICON/.test(p13.aikarivi), p13.aikarivi.replace(/\s+/g, ' ').trim());
      /* Kortin oma lukemarivi poistuu (P10). */
      const rivi = await sivu.evaluate(() => { const l = document.querySelector('#sheet-content [data-ennuste] [data-en-lukema]'); return l ? window.__km.osuus(l) : null; });
      tarkista('lukema ' + laite + ': ennusteosiossa ei omaa lukemariviä', !(rivi > 0), rivi == null ? '' : 'näkyy');
      /* Tiivis lukema yläpalkissa kun hero on vierinyt pois. */
      const yla = await sivu.evaluate(async () => {
        const sc = document.getElementById('sheet-scroll'), en = document.querySelector('#sheet-content [data-ennuste]');
        const ennen = (document.getElementById('sheet-handle').innerText || '').trim();
        sc.scrollTop = en.offsetTop + 40;
        await new Promise((r) => setTimeout(r, 500));
        const el = document.querySelector('#sheet-handle [data-tiivis-lukema]');
        const t = el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
        const os = el ? window.__km.osuus(el) : null;
        sc.scrollTop = 0;
        await new Promise((r) => setTimeout(r, 400));
        const el2 = document.querySelector('#sheet-handle [data-tiivis-lukema]');
        return { ennen: ennen, t: t, os: os, jalkeen: el2 ? window.__km.osuus(el2) : null, luku: (document.querySelector('#sh-tunti .sh-big-wind') || {}).textContent };
      });
      tarkista('lukema ' + laite + ': yläpalkin tiivis lukema kun hero ei näy', yla.os >= 0.99 && yla.t.indexOf((yla.luku || '#').trim()) >= 0, yla.t || 'ei elementtiä');
      tarkista('lukema ' + laite + ': yläpalkin lukema piilossa kun hero näkyy', !(yla.jalkeen > 0.02), yla.jalkeen == null ? '' : Math.round(yla.jalkeen * 100) + ' %');
      /* Aaltomoduulin lukemarivi seuraa valittua tuntia (V15, P15 kohta
         4). Aaltoennuste tulee verkosta, joten se ohitetaan jos ei tullut. */
      const aalto = await sivu.evaluate(async () => {
        const FS = window.FS;
        const rivi = () => { const e = document.querySelector('#sheet-content .sh-aalto-moduli [data-ak-lukema] .en-solu-aika'); return e ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
        for (let i = 0; i < 20 && !rivi(); i++) await new Promise((r) => setTimeout(r, 500));
        if (!rivi()) return { ohita: 'aaltoennuste ei tullut' };
        const T = FS.State._tlTimes, nyt = Date.now();
        let i0 = 0, e = Infinity;
        T.forEach((t, i) => { const d = Math.abs(Date.parse(t) - nyt); if (d < e) { e = d; i0 = i; } });
        const tulos = [];
        for (const d of [0, 10, 30]) {
          FS._tlValitseIdx(i0 + d);
          await new Promise((r) => setTimeout(r, 400));
          const h = new Date(FS.State.valittuMs);
          tulos.push({ odotettu: ('0' + h.getHours()).slice(-2) + ':00', rivi: rivi() });
        }
        FS._tlValitseIdx(i0);
        return { tulos: tulos };
      });
      if (aalto.ohita) console.log('  ohitettu lukema ' + laite + ': aaltojen lukemarivi — ' + aalto.ohita);
      else tarkista('lukema ' + laite + ': aaltojen lukemarivi seuraa valittua tuntia', aalto.tulos.every((x) => x.rivi.indexOf(x.odotettu) >= 0),
        aalto.tulos.map((x) => x.rivi + ' / ' + x.odotettu).join(' · '));
      if (sivu._virheet.length) tarkista('lukema ' + laite + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 5. AVAUS: MODUULIEN PAIKAT 10 s ──────────────────────────────── */
async function osaAvaus() {
  console.log('\nAVAUS: ensimmäinen avaus, moduulien paikat 10 s ajan');
  for (const laite of rajaa(NOPEA ? ['p390'] : ['p390', 'tyopoyta'])) {
    const { kons, sivu } = await avaa(laite);
    try {
      const r = await sivu.evaluate(async (nimi) => {
        const siirrot = [];
        const po = new PerformanceObserver((l) => { for (const e of l.getEntries()) siirrot.push(e.value); });
        try { po.observe({ type: 'layout-shift', buffered: false }); } catch (e) {}
        const s = window.FS.SPOTS.find((x) => x.name === nimi);
        window.FS.openSheet(s);
        const sc = document.getElementById('sheet-content');
        await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
        const kuvaa = (el) => {
          if (el.hidden || getComputedStyle(el).display === 'none') return '-';
          const q = el.getBoundingClientRect(), y0 = sc.getBoundingClientRect().top;
          return Math.round(q.top - y0) + '/' + Math.round(q.height);
        };
        const tila = new Map(), muutokset = [];
        let suurin = 0;
        const t0 = performance.now();
        while (performance.now() - t0 < 10000) {
          const nyt = Math.round(performance.now() - t0);
          [...sc.children].forEach((el, i) => {
            const v = kuvaa(el), vanha = tila.get(el);
            if (vanha !== undefined && vanha !== v) {
              const a = vanha === '-' ? [0, 0] : vanha.split('/').map(Number), b = v === '-' ? [0, 0] : v.split('/').map(Number);
              const d = Math.max(Math.abs(a[0] - b[0]), Math.abs(a[1] - b[1]));
              if (d > 0.5) {
                suurin = Math.max(suurin, d);
                muutokset.push(nyt + ' ms ' + (el.id || el.className.toString().split(' ')[0] || el.tagName) + ' ' + vanha + '→' + v);
              }
            }
            tila.set(el, v);
          });
          await new Promise((r) => setTimeout(r, 40));
        }
        po.disconnect();
        return { muutokset: muutokset, suurin: suurin, summa: siirrot.reduce((a, b) => a + b, 0) };
      }, SPOTTI);
      tarkista('avaus ' + laite + ': moduulit eivät siirry ensimmäisen maalauksen jälkeen', r.muutokset.length === 0,
        r.muutokset.length + ' muutosta, suurin ' + Math.round(r.suurin) + ' px, layout-shift ' + r.summa.toFixed(3) + (r.muutokset.length ? ' — ' + r.muutokset.slice(0, 12).join(' | ') : ''));
      if (sivu._virheet.length) tarkista('avaus ' + laite + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 6. TEKSTI: PUOLIKSI NÄKYVÄT JA KATKAISTUT ───────────────────── */
async function osaTeksti() {
  console.log('\nTEKSTI: puoliksi näkyvät ja kolmeen pisteeseen katkaistut tekstit kortissa');
  const tapaukset = NOPEA ? [['p390', '']] : [['p390', ''], ['p360', 'en'], ['p320', ''], ['p320', 'en'], ['tyopoyta', '']];
  for (const [laite, kieli] of rajaa(tapaukset)) {
    const nimi = laite + (kieli ? ' ' + kieli : '');
    const { kons, sivu } = await avaa(laite, { kieli });
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu, 8000);
      const lepo = await sivu.evaluate(() => window.__km.osittaiset(document.getElementById('sheet')));
      tarkista('teksti ' + nimi + ': ei puoliksi näkyviä tekstejä levossa', lepo.osittain.length === 0, lepo.osittain.length + (lepo.osittain.length ? ': ' + lepo.osittain.slice(0, 6).join(' · ') : ''));
      tarkista('teksti ' + nimi + ': ei katkaistuja tekstejä', lepo.katkaistu.length === 0, lepo.katkaistu.slice(0, 4).join(' · '));
      /* Kaavioiden ULKOPUOLELLA (V15: laatat, rivit, valitsimet, selitteet):
         kaavioiden omat tekstit ovat V16:n asia, ja ne peittäisivät
         muuten kaiken muun listan kuudesta ensimmäisestä. */
      const ulko = await sivu.evaluate(() => {
        const km = window.__km, sheet = document.getElementById('sheet');
        const t = km.tekstit(sheet).filter((x) => !x.el.closest('.en-kaare') && x.os > 0.02 && x.os < 0.98);
        return t.map((x) => x.t.slice(0, 30) + ' [' + Math.round(x.os * 100) + ' %]');
      });
      tarkista('teksti ' + nimi + ': kaavioiden ulkopuolella ei puoliksi näkyviä tekstejä', ulko.length === 0, ulko.length + (ulko.length ? ': ' + ulko.slice(0, 8).join(' · ') : ''));
      /* Jokainen kaavio vieritettynä noin 40 %:iin. */
      const vier = await sivu.evaluate(async () => {
        document.querySelectorAll('#sheet-content .en-kaare').forEach((k) => { const g = k._geot && k._geot[0]; if (g) k.scrollLeft = Math.round((g.W - k.clientWidth) * 0.4) + 7; });
        await new Promise((r) => setTimeout(r, 700));
        return window.__km.osittaiset(document.getElementById('sheet'));
      });
      tarkista('teksti ' + nimi + ': ei puoliksi näkyviä tekstejä kaaviot vieritettyinä', vier.osittain.length === 0, vier.osittain.length + (vier.osittain.length ? ': ' + vier.osittain.slice(0, 6).join(' · ') : ''));
      if (sivu._virheet.length) tarkista('teksti ' + nimi + ': ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
    } finally { await kons.close(); }
  }
}

/* ── 7. KAHDENNUS ─────────────────────────────────────────────────── */
async function osaKahdennus() {
  console.log('\nKAHDENNUS: sama tieto kortilla (puhelin, valittuna nyt, levossa)');
  const { kons, sivu } = await avaa('p390');
  try {
    await sivu.evaluate(apurit);
    await avaaKortti(sivu, 9000);
    const r = await sivu.evaluate(() => {
      const km = window.__km, FS = window.FS, ctx = km.ctx(), s = FS.SPOTS.find((x) => x.name === 'Lauttasaari');
      const paras = FS.KorttiSarjat.valmis(s, 'paras'), a = FS.KorttiSarjat.arvo(paras, ctx.valittu);
      /* Kortin otsikko (`.sh-yla`) on spotin nimi: Lauttasaaren
         vedenlämpöasema on myös "Lauttasaari", eikä spotin nimi ole
         aseman nimen kahdennus. */
      const nakyvat = km.tekstit(document.getElementById('sheet')).filter((x) => x.os >= 0.5 && !x.el.closest('.sh-yla'));
      const html = nakyvat.filter((x) => !x.svg), kaikki = nakyvat;
      const laske = (lista, f) => lista.filter(f).length;
      const d = new Date(ctx.valittu), hh = ('0' + d.getHours()).slice(-2);
      const lahde = FS.Lahde.LYHYET[a.lahde] || a.lahde;
      const asema = s._currentWx && s._currentWx.station;
      /* Vedenlämpöaseman nimi: V15:stä lähtien vain valitsimessa
         (`.uw-trigger`), ennen myös moduulin otsikossa. */
      const vesi = (document.querySelector('#sheet-content .uw-trigger span') || document.querySelector('[id^="uiras-chart-lbl-"]') || {}).textContent || '';
      const vesiAsema = vesi.split('·').pop().trim();
      return {
        tuuli: laske(html, (x) => x.t === Units.fmt(a.ms)),
        puuska: laske(html, (x) => x.t.indexOf(Units.fmt(a.gust)) >= 0),
        lahde: laske(kaikki, (x) => x.t.indexOf(lahde) >= 0), lahdeNimi: lahde,
        asema: asema ? laske(html, (x) => x.t.indexOf(asema) >= 0) : null, asemaNimi: asema,
        vesiAsema: vesiAsema ? laske(html, (x) => x.t.indexOf(vesiAsema) >= 0) : null, vesiNimi: vesiAsema,
        hetki: laske(html, (x) => x.t.indexOf(_t('klo ' + hh, hh + ':00')) >= 0), hetkiTeksti: _t('klo ' + hh, hh + ':00'),
      };
    });
    tarkista('kahdennus: valitun tunnin tuuli näkyy kerran', r.tuuli === 1, r.tuuli + ' kertaa');
    tarkista('kahdennus: valitun tunnin puuska näkyy kerran', r.puuska === 1, r.puuska + ' kertaa');
    tarkista('kahdennus: lähde "' + r.lahdeNimi + '" näkyy kerran', r.lahde === 1, r.lahde + ' kertaa');
    if (r.asema != null) tarkista('kahdennus: havaintoasema "' + r.asemaNimi + '" näkyy kerran', r.asema === 1, r.asema + ' kertaa');
    if (r.vesiAsema != null) tarkista('kahdennus: vedenlämpöasema "' + r.vesiNimi + '" näkyy kerran', r.vesiAsema === 1, r.vesiAsema + ' kertaa');
    tarkista('kahdennus: valittu hetki "' + r.hetkiTeksti + '" näkyy kerran', r.hetki === 1, r.hetki + ' kertaa');
    if (sivu._virheet.length) tarkista('kahdennus: ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
  } finally { await kons.close(); }
}

/* ── 8. TYYLI JA MITAT ────────────────────────────────────────────── */
async function osaTyyli() {
  console.log('\nTYYLI: tekstityylit, kirjasinkoot, värit, laatikot, versaalit, korkeus');
  const { kons, sivu } = await avaa('p390');
  try {
    await sivu.evaluate(apurit);
    await avaaKortti(sivu, 9000);
    const r = await sivu.evaluate(() => {
      const sc = document.getElementById('sheet-content');
      const html = window.__km.tekstit(sc).filter((x) => !x.svg && x.os >= 0.5);
      const tyyli = (el) => { const cs = getComputedStyle(el); return { koko: Math.round(parseFloat(cs.fontSize) * 10) / 10, paino: cs.fontWeight, vari: cs.color, isot: cs.textTransform === 'uppercase' }; };
      const ts = html.map((x) => Object.assign({ t: x.t, el: x.el }, tyyli(x.el)));
      const tyylit = new Set(ts.map((x) => x.koko + '/' + x.paino + '/' + x.vari));
      const koot = [...new Set(ts.map((x) => x.koko))].sort((a, b) => a - b);
      const varit = new Set(ts.map((x) => x.vari));
      const isot = ts.filter((x) => x.isot && !x.el.closest('.sh-ryhma')).map((x) => x.t);
      let laatikot = 0;
      sc.querySelectorAll('*').forEach((el) => {
        if (el.closest('svg')) return;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || el.closest('[hidden]')) return;
        const bg = cs.backgroundColor, bw = parseFloat(cs.borderTopWidth) || 0;
        if ((bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') || (bw > 0 && cs.borderTopStyle !== 'none' && cs.borderTopColor !== 'rgba(0, 0, 0, 0)')) {
          const rr = el.getBoundingClientRect();
          if (rr.width > 30 && rr.height > 16 && !el.classList.contains('ak-pv')) laatikot++;
        }
      });
      const sheet = document.getElementById('sheet-scroll').getBoundingClientRect();
      const en = sc.querySelector('[data-ennuste]');
      document.getElementById('sheet-scroll').scrollTop = 0;
      return { tyylit: tyylit.size, koot: koot, varit: varit.size, isot: isot, laatikot: laatikot,
               korkeus: Math.round(sc.getBoundingClientRect().height), ennusteAla: Math.round(en.getBoundingClientRect().bottom - sheet.top), nakyva: Math.round(sheet.height) };
    });
    tarkista('tyyli: tekstityylejä (koko × paino × väri) ≤ 14', r.tyylit <= 14, r.tyylit);
    tarkista('tyyli: kirjasinkokoja ≤ 6', r.koot.length <= 6, r.koot.length + ' (' + r.koot.join(', ') + ')');
    tarkista('tyyli: tekstivärejä ≤ 6', r.varit <= 6, r.varit);
    tarkista('tyyli: laatikoita ≤ 15', r.laatikot <= 15, r.laatikot);
    tarkista('tyyli: versaalit vain ryhmien nimissä', r.isot.length === 0, r.isot.length + (r.isot.length ? ': ' + [...new Set(r.isot)].slice(0, 5).join(', ') : ''));
    tarkista('tyyli: kortin korkeus 390 px:llä ≤ 2 300 px', r.korkeus <= 2300, r.korkeus + ' px');
    tarkista('tyyli: hero ja koko ennustekaavio ensimmäisessä ruudullisessa (390 × 844)', r.ennusteAla <= r.nakyva, 'ennusteosion alareuna ' + r.ennusteAla + ' / näkyvä ' + r.nakyva + ' px');
    if (KUVAT) await sivu.screenshot({ path: KUVAT + '/kortti-p390.png' });
    if (sivu._virheet.length) tarkista('tyyli: ei sivuvirheitä', false, sivu._virheet.slice(0, 2).join(' | '));
  } finally { await kons.close(); }
}

/* ── 9. REGRESSIOT ────────────────────────────────────────────────── */
async function osaRegressio() {
  console.log('\nREGRESSIO: hero = Paras, merkki = heron indeksi, kortti = aikajana');
  {
    const { kons, sivu } = await avaa('p390');
    try {
      await sivu.evaluate(apurit);
      await avaaKortti(sivu);
      const i0 = await nytIdx(sivu);
      const r = [];
      for (const d of [0, 5, 31, 70, 100]) {
        await sivu.evaluate((i) => window.FS._tlValitseIdx(i), i0 + d);
        await nuku(400);
        r.push(await sivu.evaluate(() => {
          const FS = window.FS, s = FS.SPOTS.find((x) => x.name === 'Lauttasaari'), ctx = window.__km.ctx();
          const a = FS.KorttiSarjat.arvo(FS.KorttiSarjat.valmis(s, 'paras'), FS.State.valittuMs);
          return { hero: (document.querySelector('#sh-tunti .sh-big-wind') || {}).textContent, paras: a ? Units.fmt(a.ms) : null,
                   indeksi: (document.querySelector('#sh-tunti .sh-hero-indeksi svg text') || {}).textContent };
        }));
      }
      tarkista('regressio: hero = Paras valitulla tunnilla (5 tuntia)', r.every((x) => x.hero === x.paras), r.map((x) => x.hero + '/' + x.paras).join(' · '));
      /* Spottimerkki numerona: kartta spotin päälle zoomilla 10 (Leaflet-asteikko). */
      const m = await sivu.evaluate(async () => {
        const FS = window.FS, s = FS.SPOTS.find((x) => x.name === 'Lauttasaari');
        FS.State.map.setView([s.lat, s.lng], 11);
        await new Promise((r) => setTimeout(r, 1800));
        const mk = (FS.State.markers || []).find((x) => x._spot && x._spot.name === 'Lauttasaari');
        const t = mk && mk._el && mk._el.querySelector('.spot-ring svg text');
        return { merkki: t ? t.textContent : null, hero: (document.querySelector('#sh-tunti .sh-hero-indeksi svg text') || {}).textContent };
      });
      tarkista('regressio: spottimerkin indeksi = heron indeksi', m.merkki != null && m.merkki === m.hero, 'merkki ' + m.merkki + ' / hero ' + m.hero);
    } finally { await kons.close(); }
  }
  /* Oikealla datalla: kortin Paras = aikajana spotin kohdalla (V2:n
     0,0000 m/s). Ohitetaan jos varasto ei vastaa. */
  {
    const { kons, sivu } = await avaa('p390', { istuta: false });
    try {
      const r = await sivu.evaluate(async () => {
        const FS = window.FS, s = FS.SPOTS.find((x) => x.name === 'Lauttasaari');
        /* Varaston luettelo voi tulla latausruudun jälkeen: odotetaan. */
        for (let i = 0; i < 40 && !FS.Saalaatat.kaytossa(); i++) await new Promise((r) => setTimeout(r, 1000));
        if (!FS.Saalaatat.kaytossa()) return { ohita: 'varasto ei käytössä 40 s:n jälkeen' };
        FS.State.map.setView([s.lat, s.lng], 11);
        await new Promise((r) => setTimeout(r, 2500));
        const p = await FS.KorttiSarjat.lataa(s, 'paras');
        await new Promise((r) => setTimeout(r, 1500));
        FS.updateTimelineToCenter();
        if (!p) return { ohita: 'Paras ei tullut' };
        const T = FS.State._tlTimes, V = FS.State._tlSpeeds, nyt = Date.now();
        let max = 0, n = 0;
        for (let i = 0; i < T.length; i++) {
          const t = Date.parse(T[i]);
          if (t < nyt - 36e5 || t > nyt + 48 * 36e5 || V[i] == null) continue;
          const a = FS.KorttiSarjat.arvo(p, t);
          if (!a) continue;
          max = Math.max(max, Math.abs(a.ms - V[i])); n++;
        }
        return { max: max, n: n };
      });
      if (r.ohita) console.log('  ohitettu regressio: kortti = aikajana — ' + r.ohita);
      else tarkista('regressio: kortin Paras = aikajana spotissa (oikea data)', r.n > 20 && r.max < 0.0005, r.n + ' tuntia, suurin ero ' + r.max.toFixed(4) + ' m/s');
    } finally { await kons.close(); }
  }
}

const OSIOT = { laaja: osaLaaja, tunnit: osaTunnit, vaihto: osaVaihto, lukema: osaLukema, avaus: osaAvaus,
                teksti: osaTeksti, kahdennus: osaKahdennus, tyyli: osaTyyli, regressio: osaRegressio };
const t0 = Date.now();
try {
  for (const o of OSAT) {
    if (!OSIOT[o]) { console.log('tuntematon osa: ' + o); continue; }
    try { await OSIOT[o](); }
    catch (e) { tarkista(o + ': mittaus kaatui', false, String(e && e.message || e).split('\n')[0]); }
  }
} finally {
  await selain.close();
}
console.log('\n' + (viat.length ? viat.length + ' VIKAA' : 'kaikki ok') + ' (' + Math.round((Date.now() - t0) / 1000) + ' s)');
process.exit(viat.length ? 1 : 0);
