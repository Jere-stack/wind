/* Sadetutkan liikekentän ja nowcastin mittari (docs/sadetutka.md, V4–V5).
 *
 * Mittaa TOTUUTTA VASTEN (CLAUDE.md): oikeat tutkakehykset ovat totuus.
 *
 *   T2 interpolointi  kehykset t ja t + 20 min, totuus t + 10 min.
 *                     Verrataan ristihäivytystä ((A + B) / 2) ja
 *                     liikekompensoitua sekoitusta (A(x − d/2), B(x + d/2))
 *                     samaan oikeaan kehykseen: MAE ja sadealan
 *                     päällekkäisyys (CSI, kynnys 0,5 mm/h).
 *   T5 nowcast        lähtö t − 60 min, kenttä (t − 75, t − 60), totuus t.
 *                     Advektio (sama sääntö kuin SadeLiike.kehys) vs
 *                     pysyvyys (lähtökehys sellaisenaan): FSS 1 ja 5 mm/h
 *                     30 km:n ikkunassa ja CSI.
 *
 * Mosaiikkina karkea hila (32 solua laattaa kohti, 2,4 km tasolla 9).
 * Kehyksiä lasketaan useasta lähtöhetkestä ja tulostetaan raakaluvut ja
 * mediaani.
 *
 * Käyttö: npm run build && npx vite preview --port 4173 &
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *   node tools/sadeliike.mjs --lat=61.6 --lng=27.5 --z=9 [--n=6] */

const arg = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) arg[m[1]] = m[2] === undefined ? true : m[2]; else arg.osoite = a;
}
const osoite = (arg.osoite || 'http://localhost:4173').replace(/\/$/, '');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');
const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const kont = await selain.newContext({ viewport: { width: 1440, height: 900 }, timezoneId: 'Europe/Helsinki', serviceWorkers: 'block', ignoreHTTPSErrors: true });
const sivu = await kont.newPage();
const virheet = [];
sivu.on('pageerror', (e) => virheet.push(e.message));
await sivu.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
await sivu.goto(osoite + '/?perf=1');
await sivu.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 60000 });
await sivu.evaluate(({ lat, lng, z }) => FS.State.map.setView([lat, lng], z, { animate: false }),
  { lat: +(arg.lat || 61.6), lng: +(arg.lng || 27.5), z: +(arg.z || 9) });
await sivu.waitForTimeout(1000);
await sivu.evaluate(() => _sadetilaAseta(true));
await sivu.waitForFunction(() => Sadetutka._uusin != null, null, { timeout: 30000 });

const N = Math.min(6, +(arg.n || 5));
/* Ladataan kehykset näkymän laatoille: tuoreimmasta 3 h taaksepäin 5 min
   välein. */
await sivu.evaluate(() => {
  const k = window._tutkaKerros, u = Sadetutka._uusin, D = 300000;
  /* Kehysmuistin karsinta pois mittauksen ajaksi: muuten 28 kehyksen
     katto pudottaisi juuri mitattavat. */
  k._karsiLaatta = function () {};
  window._mitattavat = [];
  for (let i = 0; i <= 30; i++) window._mitattavat.push(u - i * D);
  for (const a in k._tiles) {
    const r = k._tiles[a];
    if (!r.current || r.coords.z !== k._tileZoom) continue;
    for (const t of window._mitattavat) if (!r.el._k.has(t)) k._lataa(r.el, t);
  }
});
await sivu.waitForFunction(() => {
  const k = window._tutkaKerros;
  for (const a in k._tiles) {
    const r = k._tiles[a];
    if (!r.current || r.coords.z !== k._tileZoom) continue;
    for (const t of window._mitattavat) { const e = r.el._k.get(t); if (!e || e.tila === 'lataa') return false; }
  }
  return true;
}, null, { timeout: 180000, polling: 1000 });

const tulos = await sivu.evaluate((N) => {
  const k = window._tutkaKerros, L = SadeLiike, u = Sadetutka._uusin, M5 = 300000;
  const R = L._rajaus(k, true);
  const mos = (t) => L._mosaiikki(k, R, t, 'karkea');
  const mmh = (b) => Sade.mmh(b / 255);
  const solu = 512 / L.SOLU_K;
  const nayte = (M, x, y) => {
    const x0 = Math.floor(x), y0 = Math.floor(y);
    if (x0 < 0 || y0 < 0 || x0 + 1 >= M.w || y0 + 1 >= M.h) return null;
    const ax = x - x0, ay = y - y0, q = y0 * M.w + x0;
    if (!M.tunnettu[q] || !M.tunnettu[q + 1] || !M.tunnettu[q + M.w] || !M.tunnettu[q + M.w + 1]) return null;
    return (M.d[q] * (1 - ax) + M.d[q + 1] * ax) * (1 - ay) + (M.d[q + M.w] * (1 - ax) + M.d[q + M.w + 1] * ax) * ay;
  };
  /* Kentän siirtymä soluina, `min` minuutissa, maailmapikselistä. */
  const siirto = (kk, x, y, min) => {
    const v = L.nayte(kk, (R.x0 * L.SOLU_K + x + 0.5) * solu, (R.y0 * L.SOLU_K + y + 0.5) * solu);
    return { x: v.x / solu * min / 5, y: v.y / solu * min / 5 };
  };
  const reuna = 6;
  const vertaa = (ennuste, T) => {
    let ae = 0, n = 0, hit = 0, miss = 0, fa = 0;
    for (let y = reuna; y < T.h - reuna; y++) for (let x = reuna; x < T.w - reuna; x++) {
      const q = y * T.w + x, e = ennuste[q];
      if (e == null || !T.tunnettu[q]) continue;
      const a = mmh(e), b = mmh(T.d[q]);
      ae += Math.abs(a - b); n++;
      const ea = a >= 0.5, eb = b >= 0.5;
      if (ea && eb) hit++; else if (!ea && eb) miss++; else if (ea && !eb) fa++;
    }
    return { mae: n ? ae / n : null, csi: hit + miss + fa ? hit / (hit + miss + fa) : null };
  };
  const fss = (ennuste, T, kynnys, ikkuna) => {
    const w = T.w, h = T.h, r = ikkuna;
    const bin = (f) => { const a = new Float32Array(w * h); for (let q = 0; q < w * h; q++) a[q] = f(q) ? 1 : 0; return a; };
    const E = bin((q) => ennuste[q] != null && mmh(ennuste[q]) >= kynnys), O = bin((q) => mmh(T.d[q]) >= kynnys);
    let num = 0, den = 0;
    for (let y = reuna + r; y < h - reuna - r; y += 2) for (let x = reuna + r; x < w - reuna - r; x += 2) {
      let se = 0, so = 0, nn = 0;
      for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) { se += E[yy * w + xx]; so += O[yy * w + xx]; nn++; }
      se /= nn; so /= nn;
      num += (se - so) * (se - so); den += se * se + so * so;
    }
    return den ? 1 - num / den : null;
  };
  const kmSolu = 156.543 * Math.cos(61 * Math.PI / 180) / Math.pow(2, R.z) * solu;
  const ikkuna = Math.max(1, Math.round(15 / kmSolu));   /* 30 km ikkuna */
  const interpoloinnit = [], nowcastit = [];
  for (let i = 0; i < N; i++) {
    /* T2 */
    const t = u - (i * 3 + 4) * M5;
    const A = mos(t), B = mos(t + 4 * M5), C = mos(t + 2 * M5);
    const kk = L.kentta(k, Math.ceil((t + 4 * M5) / 900000) * 900000, true);
    if (A && B && C && kk) {
      const risti = new Array(C.w * C.h), liike = new Array(C.w * C.h);
      for (let y = 0; y < C.h; y++) for (let x = 0; x < C.w; x++) {
        const q = y * C.w + x;
        if (A.tunnettu[q] && B.tunnettu[q]) risti[q] = (A.d[q] + B.d[q]) / 2;
        const d = siirto(kk, x, y, 20);
        const a = nayte(A, x - d.x / 2, y - d.y / 2), b = nayte(B, x + d.x / 2, y + d.y / 2);
        liike[q] = a == null || b == null ? null : (a + b) / 2;
      }
      interpoloinnit.push({ t: new Date(t).toISOString().slice(11, 16), kelpo: kk.kelpo, risti: vertaa(risti, C), liike: vertaa(liike, C) });
    }
    /* T5: lähtö 60 min ennen totuutta */
    const T = u - i * 3 * M5, s0 = T - 12 * M5;
    const S = mos(s0), O = mos(T);
    const k0 = L.kentta(k, Math.floor(s0 / 900000) * 900000, true);
    if (S && O && k0) {
      const pys = new Array(O.w * O.h), adv = new Array(O.w * O.h);
      for (let y = 0; y < O.h; y++) for (let x = 0; x < O.w; x++) {
        const q = y * O.w + x;
        if (S.tunnettu[q]) pys[q] = S.d[q];
        let px = x, py = y;
        for (let m = 0; m < 12; m++) { const d = siirto(k0, px, py, 5); px -= d.x; py -= d.y; }
        adv[q] = nayte(S, px, py);
      }
      nowcastit.push({
        t: new Date(T).toISOString().slice(11, 16), kelpo: k0.kelpo,
        pysyvyys: { fss1: fss(pys, O, 1, ikkuna), fss5: fss(pys, O, 5, ikkuna), ...vertaa(pys, O) },
        advektio: { fss1: fss(adv, O, 1, ikkuna), fss5: fss(adv, O, 5, ikkuna), ...vertaa(adv, O) }
      });
    }
  }
  return { z: R.z, kmSolu: kmSolu, ikkuna: ikkuna, interpoloinnit, nowcastit };
}, N);

const med = (a) => { const b = a.filter((x) => x != null).sort((x, y) => x - y); return b.length ? b[b.length >> 1] : null; };
const f = (x) => x == null ? '  –  ' : x.toFixed(3);
console.log(`taso ${tulos.z}, solu ${tulos.kmSolu.toFixed(2)} km, FSS-ikkuna ±${tulos.ikkuna} solua`);
console.log('\nT2 interpolointi (t, t+20 -> t+10)     MAE mm/h           CSI 0,5');
console.log('hetki  kelpo   risti   liike      risti   liike');
for (const r of tulos.interpoloinnit) console.log(`${r.t}  ${String(r.kelpo).padStart(4)}   ${f(r.risti.mae)}  ${f(r.liike.mae)}     ${f(r.risti.csi)}  ${f(r.liike.csi)}`);
console.log(`mediaani        ${f(med(tulos.interpoloinnit.map((r) => r.risti.mae)))}  ${f(med(tulos.interpoloinnit.map((r) => r.liike.mae)))}     ${f(med(tulos.interpoloinnit.map((r) => r.risti.csi)))}  ${f(med(tulos.interpoloinnit.map((r) => r.liike.csi)))}`);
console.log('\nT5 nowcast 60 min          FSS 1 mm/h        FSS 5 mm/h        CSI 0,5');
console.log('hetki  kelpo   pysyv  advek     pysyv  advek     pysyv  advek');
for (const r of tulos.nowcastit) console.log(`${r.t}  ${String(r.kelpo).padStart(4)}   ${f(r.pysyvyys.fss1)} ${f(r.advektio.fss1)}    ${f(r.pysyvyys.fss5)} ${f(r.advektio.fss5)}    ${f(r.pysyvyys.csi)} ${f(r.advektio.csi)}`);
const m = (k1, k2) => f(med(tulos.nowcastit.map((r) => r[k1][k2])));
console.log(`mediaani       ${m('pysyvyys', 'fss1')} ${m('advektio', 'fss1')}    ${m('pysyvyys', 'fss5')} ${m('advektio', 'fss5')}    ${m('pysyvyys', 'csi')} ${m('advektio', 'csi')}`);
if (virheet.length) console.log('virheet', virheet);
await selain.close();
