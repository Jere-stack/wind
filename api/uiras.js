import zlib from 'zlib';
import { suojaa } from './_suoja.js';
import { haeTeksti } from './_haku.js';

const BASE = 'https://iot.fvh.fi/opendata/uiras/';

/* VUODET AJON HETKESTÄ, EI KOVAKOODATTUINA (docs/oikeellisuus.md, O9).
   Lista oli `[2025, 2026]`: 1.1.2027 alkaen kuluvan vuoden tiedosto olisi
   jäänyt hakematta ja kaavio olisi pysähtynyt vuodenvaihteeseen. Kuluvan
   vuoden tiedosto on 404 kunnes vuoden ensimmäinen mittaus tulee — se on
   `allSettled`in hylätty haara eikä virhe. */
function vuodet() {
  const y = new Date().getUTCFullYear();
  return [y - 1, y];
}

/* VAIN KAAVION IKKUNA, EI KAHTA VUOTTA. Jokainen vedenlämpökaavio
   (`_uwPiirros`) piirtää viimeiset `UW_HISTORIA_VRK` = 30 vuorokautta
   aseman tuoreimmasta mittauksesta taaksepäin, mutta vastaus oli koko
   kahden vuoden tiedosto: mitattuna 1,2 MB (209 kt brotlilla) joka
   spottikortille ja 0,75–0,96 s CPU:ta joka CDN-hudille, eli Vercelin
   suurin siirto- ja CPU-erä (kustannusarvio 2.10.2026). Ikkuna lasketaan
   aseman OMASTA tuoreimmasta pisteestä kuten kaaviossakin, joten
   talveksi sammunut anturi näyttää yhä viimeisen kuukautensa. Yksi
   vuorokausi varaa, jottei reunan nippu jää vajaaksi. */
const HISTORIA_VRK = 31;

/* AIKALEIMA ISO-MUOTOON, JOKA ON AINA `toISOString()`.
   Lähteen leima on `2026-09-28T20:58:54.348000+0000`: kuusi desimaalia ja
   vyöhyke ilman kaksoispistettä. Chromium ja Node hyväksyvät sen, mutta
   se ei ole ECMAScriptin päiväysmuoto, ja Safari on historiallisesti
   hylännyt `+0000`:n — asiakas jäsentää leiman `new Date(p.t)`:llä
   (`_uwPiirros`). Muoto ratkaistaan tässä kerran. */
function isoAika(s) {
  const m = /^(\d{4}-\d{2}-\d{2})[T ](\d{2}:\d{2}(?::\d{2})?)(\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$/.exec(String(s || '').trim());
  if (!m) return null;
  let vy = m[4] || 'Z';
  if (vy !== 'Z' && vy.indexOf(':') < 0) vy = vy.slice(0, 3) + ':' + vy.slice(3);
  const ms = Date.parse(m[1] + 'T' + m[2] + (m[3] ? m[3].slice(0, 4) : '') + vy);
  return isNaN(ms) ? null : new Date(ms).toISOString();
}

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;

  const id = (req.query.id || '').trim().toUpperCase();
  if (!id || !/^[A-F0-9]{16}$/.test(id)) {
    return res.status(400).json({ error: 'invalid id' });
  }

  try {
    /* Kuluva vuosi ensin. Edellinen haetaan vain jos ikkuna ulottuu sen
       puolelle (tammikuussa tai kun anturi on ollut kauan hiljaa): vuoden
       tiedoston purku ja jäsennys on lähes koko funktion CPU-aika. */
    const [edellinen, kuluva] = vuodet();
    var pts = [], onnistui = false, virhe = null;
    try { pts = await fetchYear(kuluva, id); onnistui = true; }
    catch (e) { virhe = e; }
    var uusin = 0;
    for (var i = 0; i < pts.length; i++) { var tm = Date.parse(pts[i].t); if (tm > uusin) uusin = tm; }
    if (!uusin || uusin - HISTORIA_VRK * 864e5 < Date.UTC(kuluva, 0, 1)) {
      try { pts = pts.concat(await fetchYear(edellinen, id)); onnistui = true; }
      catch (e) { virhe = virhe || e; }
    }
    /* Kumpikaan vuosi ei tullut: se on lähteen vika eikä tyhjä historia.
       Tyhjä 200 jäisi CDN:ään tunniksi. */
    if (!onnistui) {
      res.setHeader('Cache-Control', 'no-store');
      return res.status(502).json({ error: String(virhe && virhe.message || 'uiras') });
    }

    pts.sort(function(a, b) { return a.t < b.t ? -1 : a.t > b.t ? 1 : 0; });
    var seen = new Set();
    var raja = pts.length ? Date.parse(pts[pts.length - 1].t) - HISTORIA_VRK * 864e5 : 0;
    pts = pts.filter(function(p) {
      if (seen.has(p.t) || Date.parse(p.t) < raja) return false;
      seen.add(p.t);
      return true;
    });

    res.setHeader('Cache-Control', 'public, s-maxage=3600');
    return res.status(200).json({ id: id, count: pts.length, data: pts });
  } catch (err) {
    res.setHeader('Cache-Control', 'no-store');
    return res.status(502).json({ error: err.message });
  }
};

async function fetchYear(year, targetId) {
  /* Vuoden tiedosto on 2–4 Mt gzipattuna ja tulee noin 2 s:ssa. */
  const v = await haeTeksti(BASE + 'uiras-all-' + year + '.csv.gz', { aikaraja: 15000, raaka: true });
  if (v.tila !== 200) throw new Error('HTTP ' + v.tila);
  const buf = await new Promise(function (resolve, reject) {
    zlib.gunzip(v.puskuri, function (err, b) { if (err) reject(err); else resolve(b); });
  });
  var lines = buf.toString('utf-8').split('\n');
  var header = lines[0].split(',').map(function(x) {
    return x.trim().replace(/\r/g, '').replace(/"/g, '').toLowerCase();
  });
  var ti = header.indexOf('time');
  var di = header.indexOf('dev-id');
  if (di < 0) di = header.indexOf('dev_id');
  var vi = header.indexOf('temp_water');
  if (ti < 0 || di < 0 || vi < 0) return [];
  var pts = [];
  for (var i = 1; i < lines.length; i++) {
    var c = lines[i].split(',');
    if (c.length < 3) continue;
    if ((c[di] || '').trim().replace(/"/g, '').toUpperCase() !== targetId) continue;
    var t = isoAika((c[ti] || '').replace(/"/g, ''));
    var val = parseFloat(c[vi]);
    if (t && !isNaN(val)) pts.push({ t: t, v: val });
  }
  return pts;
}
