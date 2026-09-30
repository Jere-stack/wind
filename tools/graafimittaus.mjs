/* Graafien mittauspohja (docs/graafit.md, V0).
 *
 * Mittaa kaaviomoottorin (`Tuulikaavio.piirra` + `Aikakaavio`) nykyisen
 * käytöksen synteettisellä sarjalla, jotta jokainen graafiparannus voidaan
 * verrata samaan lähtötasoon. Ei tarvitse verkkoa: sarja rakennetaan
 * sivulla, ja moottorin funktioita kutsutaan suoraan (`?perf=1` ei ole
 * tarpeen, mutta ei haittaa).
 *
 *   1. akselit zoomeittain: montako päivä-, tunti-, arvo- ja y-lukua ruudulla
 *   1b. y-luvut kaaviotyypeittäin (kortti, rivi, laaja)
 *   2. hiiri: vetääkö veto kaaviota, vierittääkö rulla, Shift+rulla, deltaX
 *   3. päiväys: osuus vierityskohdista joissa ruudulla EI ole päivämäärää
 *   4. käyrä: nykyisen vaakatangenttikäyrän ja monotonisen kuution poikkeama
 *      datan omasta suorasta (px, RMS ja max)
 *   5. kosketus (CDP, oikeat kosketustapahtumat): voiko pidon jälkeinen veto
 *      estää natiivin vierityksen ("pidä ja liu'uta") ilman että tavallinen
 *      veto lakkaa vierittämästä
 *
 * Käyttö:  npm run dev &   (tai vite preview)
 *          PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *            node tools/graafimittaus.mjs http://localhost:5173 [kuvakansio]
 *
 * Kuvakansio on valinnainen: sinne tallennetaan kaavion PNG jokaisesta
 * zoomista. Ruutunopeutta tämä ei mittaa (CLAUDE.md, "Mittaaminen tässä
 * ympäristössä"). */

const osoite = (process.argv[2] || 'http://localhost:5173').replace(/\/$/, '');
const kuvat = process.argv[3] || null;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
const kons = await selain.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2,
  locale: 'fi-FI', timezoneId: 'Europe/Helsinki', serviceWorkers: 'block',
});
const sivu = await kons.newPage();
await sivu.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
await sivu.goto(osoite + '/?perf=1', { waitUntil: 'domcontentloaded' });
await sivu.waitForFunction(() => typeof Tuulikaavio !== 'undefined' && typeof Aikakaavio !== 'undefined', null, { timeout: 30000 });
await sivu.waitForTimeout(1200);

/* Sarja: 2 vrk menneisyyttä ja 15 vrk eteenpäin, tunneittain. Vuorokausi-
   ja lyhyempi aalto, jotta jokaisella zoomilla on jotain nähtävää. */
await sivu.evaluate(() => {
  const H = 36e5, nyt = Math.round(Date.now() / H) * H;
  const alku = nyt - 48 * H, loppu = nyt + 15 * 24 * H;
  const t = [], ms = [], gust = [], dir = [];
  for (let x = alku; x <= loppu; x += H) {
    const h = (x - alku) / H, klo = new Date(x).getHours();
    const v = Math.max(0.6, 5.2 + 2.6 * Math.sin((klo - 9) / 24 * 2 * Math.PI) + 2.8 * Math.sin(h / 31) + 1.2 * Math.sin(h / 7.3));
    t.push(x); ms.push(v); gust.push(v * 1.3); dir.push((210 + 60 * Math.sin(h / 40) + 360) % 360);
  }
  window.__P = { t: t, ms: ms, gust: gust, dir: dir };
  window.__nyt = nyt; window.__alku = alku; window.__loppu = loppu;
  /* Yksi kaavio kääreessä kuten kortilla; palauttaa kääreen ja geometrian. */
  window.__tee = function (W0, nak) {
    const P = window.__P, W = Math.max(W0, Math.round((loppu - alku) / H * W0 / nak));
    const maxV = Tuulikaavio.maxV([P], nyt - 6 * H, loppu);
    const p = Tuulikaavio.piirra({ asu: Tuulikaavio.ASUT.kortti, W: W, alku: alku, loppu: loppu, maxV: maxV, nyt: nyt,
      valittu: nyt + 3 * H, akseli: 'kiintea', lat: 60.15, lng: 24.9, paa: P, aria: 'mittaus' });
    document.querySelectorAll('body > div.__k').forEach(function (d) { d.remove(); });
    const div = document.createElement('div');
    div.className = '__k';
    div.style.cssText = 'position:fixed;left:20px;top:20px;width:' + W0 + 'px;background:#FAF5E7;z-index:99999';
    div.innerHTML = '<div class="ak-kehys" style="--ak-tausta:#FAF5E7;margin:0"><div class="en-kaare"></div></div>';
    document.body.appendChild(div);
    const kaare = div.querySelector('.en-kaare');
    kaare._W0 = W0;
    Aikakaavio.aseta(kaare, [p], nyt, 0.25);
    window.__loki = [];
    Aikakaavio.osoitin(kaare, {
      pyorista: H,
      nayta: function (tt) { window.__loki.push(['nayta', tt == null ? null : Math.round((tt - nyt) / H)]); },
      napautus: function (tt) { window.__loki.push(['valitse', Math.round((tt - nyt) / H)]); },
    });
    return { kaare: kaare, p: p, maxV: maxV, W: W };
  };
});

/* 1. Akselit zoomeittain. Rivit erotetaan y-koordinaatista: päivärivi
   y < 18, tuntirivi 18…34, sen alla lihavoidut luvut ovat käyrän lukuja. */
console.log('\n1. AKSELIT ZOOMEITTAIN (kortti, ruudulla näkyvät tekstit)');
console.log('leveys  näkyvä  px/h   päiviä  tunteja  lukuja  y-lukuja (y-akselin luvut)');
for (const W0 of [358, 372]) {
  for (const nak of [12, 24, 48, 96, 168, 240, 396]) {
    const r = await sivu.evaluate(async ([W0, nak]) => {
      const x = window.__tee(W0, nak);
      await new Promise(function (res) { setTimeout(res, 150); });
      const sl = x.kaare.scrollLeft, o = { p: 0, t: 0, l: 0 };
      x.kaare.querySelectorAll('svg text').forEach(function (e) {
        const cx = +e.getAttribute('x'), y = +e.getAttribute('y');
        if (cx < sl || cx > sl + W0) return;
        if (y < 18) o.p++; else if (y < 34) o.t++; else if (e.getAttribute('font-weight') === '700') o.l++;
      });
      return { pxH: +(W0 / nak).toFixed(1), o: o, y: x.p.g.laput.map(function (l) { return l[1]; }).join(',') };
    }, [W0, nak]);
    console.log(String(W0).padEnd(8) + (nak + ' h').padEnd(8) + String(r.pxH).padEnd(6) + String(r.o.p).padEnd(8) + String(r.o.t).padEnd(9) + String(r.o.l).padEnd(8) + r.y);
    if (kuvat && W0 === 358) {
      const el = await sivu.$('body > div.__k');
      await el.screenshot({ path: kuvat + '/kaavio_' + nak + 'h.png' });
    }
  }
}

/* 1b. Y-luvut kaaviotyypeittäin: pieni kaavio (rivi, laaja puhelimen
   vaakatilassa) saa vähemmän viivoja kuin kortti. */
console.log('\n1b. Y-LUVUT ASUITTAIN (asteikko 16 m/s = 31 kts)');
const asut = await sivu.evaluate(function () {
  const P = window.__P, W = 900, out = [];
  [['kortti (plotH 150)', Tuulikaavio.ASUT.kortti, 0], ['rivi (plotH 84)', Tuulikaavio.ASUT.rivi, 0],
   ['laaja, puhelin vaaka (plotH 120, fs 1,15)', Object.assign({}, Tuulikaavio.ASUT.laaja, { fs: 1.15 }), 120],
   ['laaja, työpöytä (plotH 420, fs 1,5)', Object.assign({}, Tuulikaavio.ASUT.laaja, { fs: 1.5 }), 420]].forEach(function (a) {
    const p = Tuulikaavio.piirra({ asu: a[1], plotH: a[2], W: W, alku: window.__nyt, loppu: window.__nyt + 72 * 36e5, maxV: 16, nyt: window.__nyt,
      akseli: 'kiintea', paa: P, aria: 'x' });
    out.push({ nimi: a[0], luvut: p.g.laput.map(function (l) { return l[1]; }).join(','), n: p.g.laput.length });
  });
  return out;
});
asut.forEach(function (r) { console.log('  ' + r.nimi.padEnd(44) + r.n + ' lukua: ' + r.luvut); });

/* 2. Hiiri. Veto 180 px vasemmalle, pystyrulla, Shift+rulla, vaakarulla. */
console.log('\n2. HIIRI (kortti 372 px, 48 h ruudulla)');
await sivu.evaluate(function () { window.__tee(372, 48); });
await sivu.waitForTimeout(400);
const laatikko = await sivu.evaluate(function () { const r = document.querySelector('.__k .en-kaare').getBoundingClientRect(); return { x: r.left, y: r.top }; });
const sl = function () { return sivu.evaluate(function () { return document.querySelector('.__k .en-kaare').scrollLeft; }); };
const s0 = await sl();
await sivu.mouse.move(laatikko.x + 250, laatikko.y + 100);
await sivu.mouse.down();
for (let i = 1; i <= 12; i++) await sivu.mouse.move(laatikko.x + 250 - i * 15, laatikko.y + 100);
await sivu.mouse.up();
const s1 = await sl();
await sivu.mouse.wheel(0, 240); await sivu.waitForTimeout(200);
const s2 = await sl();
await sivu.keyboard.down('Shift'); await sivu.mouse.wheel(0, 240); await sivu.keyboard.up('Shift'); await sivu.waitForTimeout(300);
const s3 = await sl();
await sivu.mouse.wheel(240, 0); await sivu.waitForTimeout(300);
const s4 = await sl();
const tyyli = await sivu.evaluate(function () { const k = document.querySelector('.__k .en-kaare'); const c = getComputedStyle(k); return c.scrollbarWidth + ' / kursori ' + c.cursor; });
console.log('scrollLeft alussa ' + s0 + ' px');
console.log('  veto 180 px vasemmalle : ' + (s1 - s0) + ' px');
console.log('  pystyrulla 240         : ' + (s2 - s1) + ' px');
console.log('  Shift+rulla 240        : ' + (s3 - s2) + ' px');
console.log('  vaakarulla (deltaX)    : ' + (s4 - s3) + ' px');
console.log('  vierityspalkki / kursori: ' + tyyli);

/* 3. Päiväys: osuus vierityskohdista joissa ruudulla ei ole päivämäärää. */
console.log('\n3. PÄIVÄMÄÄRÄ RUUDULLA (osuus vierityskohdista, joissa yhtään päivämäärää ei näy)');
for (const nak of [12, 24, 48]) {
  const r = await sivu.evaluate(function (nak) {
    const x = window.__tee(372, nak), W0 = 372;
    const pv = [].slice.call(x.kaare.querySelectorAll('svg text')).filter(function (e) { return +e.getAttribute('y') < 18; })
      .map(function (e) { return { x: +e.getAttribute('x'), w: e.getComputedTextLength() }; });
    const max = x.kaare.scrollWidth - W0; let nolla = 0, n = 0;
    for (let s = 0; s <= max; s += 3) { n++; if (!pv.some(function (l) { return l.x + l.w / 2 > s + 4 && l.x - l.w / 2 < s + W0 - 4; })) nolla++; }
    return { n: n, nolla: nolla };
  }, nak);
  console.log('  ' + nak + ' h ruudulla: ' + (r.nolla / r.n * 100).toFixed(1) + ' % (' + r.nolla + ' / ' + r.n + ' kohtaa)');
}

/* 4. Käyrä. Rintama 3 h:n solmuista (ECMWF-varaston askel), tunnit
   suoralla solmujen välissä kuten varastossa; totuus = tuo murtoviiva.
   Vertailu: Tuulikaavio._polut (vaakatangentti joka pisteessä) vastaan
   monotoninen kuutio (Fritsch–Butland, harmoninen keskiarvo; d3.curveMonotoneX on saman perheen Steffen-menetelmä). */
console.log('\n4. KÄYRÄ (poikkeama datan omasta murtoviivasta, px; y-mittakaava 8,4 px / (m/s))');
const kayra = await sivu.evaluate(function () {
  const noodit = [4.0, 4.6, 6.4, 10.4, 13.0, 12.0, 9.0, 7.6, 7.2, 8.4, 8.0], sarja = [];
  for (let h = 0; h < (noodit.length - 1) * 3; h++) { const a = Math.floor(h / 3), f = (h % 3) / 3; sarja.push(noodit[a] + (noodit[a + 1] - noodit[a]) * f); }
  sarja.push(noodit[noodit.length - 1]);
  const n = sarja.length;
  const mono = function (pts) {
    const m = pts.length, d = [], t = new Array(m).fill(0);
    for (let i = 0; i < m - 1; i++) d.push((pts[i + 1][1] - pts[i][1]) / (pts[i + 1][0] - pts[i][0]));
    t[0] = d[0]; t[m - 1] = d[m - 2];
    for (let i = 1; i < m - 1; i++) t[i] = d[i - 1] * d[i] <= 0 ? 0 : 2 / (1 / d[i - 1] + 1 / d[i]);
    let s = 'M' + pts[0][0].toFixed(1) + ',' + pts[0][1].toFixed(1);
    for (let i = 0; i < m - 1; i++) {
      const dx = (pts[i + 1][0] - pts[i][0]) / 3;
      s += ' C' + (pts[i][0] + dx).toFixed(1) + ',' + (pts[i][1] + t[i] * dx).toFixed(1) + ' ' + (pts[i + 1][0] - dx).toFixed(1) + ',' + (pts[i + 1][1] - t[i + 1] * dx).toFixed(1) + ' ' + pts[i + 1][0].toFixed(1) + ',' + pts[i + 1][1].toFixed(1);
    }
    return s;
  };
  const tulos = [];
  [[30, '12 h'], [7.5, '48 h'], [2.1, '7 vrk']].forEach(function (z) {
    const pxH = z[0], pts = sarja.map(function (v, i) { return [i * pxH + 10, 150 - v * 8.4]; });
    const mit = function (d) {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
      const L = p.getTotalLength(); let max = 0, sum = 0, cnt = 0;
      for (let s = 0; s <= L; s += 0.25) {
        const q = p.getPointAtLength(s), k = Math.min(n - 2, Math.max(0, Math.floor((q.x - 10) / pxH)));
        const yl = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * (q.x - pts[k][0]) / pxH, e = Math.abs(q.y - yl);
        max = Math.max(max, e); sum += e * e; cnt++;
      }
      return { max: +max.toFixed(2), rms: +Math.sqrt(sum / cnt).toFixed(2) };
    };
    tulos.push({ zoom: z[1], pxH: pxH, nykyinen: mit(Tuulikaavio._polut(pts)[0].d), monotoninen: mit(mono(pts)) });
  });
  return tulos;
});
kayra.forEach(function (r) {
  console.log('  ' + r.zoom.padEnd(6) + ('(' + r.pxH + ' px/h)').padEnd(13) + 'nykyinen RMS ' + r.nykyinen.rms + ' / max ' + r.nykyinen.max
    + '   monotoninen RMS ' + r.monotoninen.rms + ' / max ' + r.monotoninen.max);
});

/* 5. Kosketus. Koe-elekuuntelija: ensimmäinen liike vasta 200 ms:n
   paikallaanolon jälkeen -> skrubi (touchmove preventDefault), muuten
   natiivi vieritys. Chromium + CDP; WebKitin
   (iOS) käytöstä tämä ei todista, eikä Playwrightin WebKit osaa touchmovea
   (CLAUDE.md, "ELEEN MITTAAMINEN"). */
console.log('\n5. KOSKETUS (Chromium, CDP Input.dispatchTouchEvent, kortti 358 px)');
const kosk = await selain.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true,
  locale: 'fi-FI', timezoneId: 'Europe/Helsinki', serviceWorkers: 'block',
});
const ks = await kosk.newPage();
await ks.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
await ks.goto(osoite + '/?perf=1', { waitUntil: 'domcontentloaded' });
await ks.waitForFunction(() => typeof Tuulikaavio !== 'undefined', null, { timeout: 30000 });
await ks.waitForTimeout(1000);
await ks.evaluate(function () {
  const H = 36e5, nyt = Math.round(Date.now() / H) * H, alku = nyt - 48 * H, loppu = nyt + 15 * 24 * H;
  const t = [], ms = [], gust = [], dir = [];
  for (let x = alku; x <= loppu; x += H) { const h = (x - alku) / H, v = 5 + 3 * Math.sin(h / 9) + 2 * Math.sin(h / 31); t.push(x); ms.push(v); gust.push(v * 1.3); dir.push(200); }
  const W0 = 358, W = Math.round((loppu - alku) / H * W0 / 48);
  const p = Tuulikaavio.piirra({ asu: Tuulikaavio.ASUT.kortti, W: W, alku: alku, loppu: loppu, maxV: 16, nyt: nyt, valittu: nyt, akseli: 'kiintea', lat: 60, lng: 25, paa: { t: t, ms: ms, gust: gust, dir: dir }, aria: 'x' });
  /* Muu sovellus piiloon: kartan piirtosilmukka (SwiftShader) varaisi
     pääsäikeen, ja CDP-kutsujen viive vääristäisi 200 ms:n rajaa. */
  [].slice.call(document.body.children).forEach(function (e) { e.style.display = 'none'; });
  const div = document.createElement('div');
  div.id = '__k'; div.style.cssText = 'position:fixed;left:16px;top:120px;width:358px;background:#FAF5E7;z-index:99999';
  div.innerHTML = '<div class="ak-kehys" style="margin:0"><div class="en-kaare"></div></div>';
  document.body.appendChild(div);
  const kaare = div.querySelector('.en-kaare');
  kaare._W0 = W0; Aikakaavio.aseta(kaare, [p], nyt, 0.25);
  /* Päätös TAPAHTUMIEN AIKALEIMOISTA, ei ajastimesta: kuormitetulla pääsäikeellä
     ajastin ehtii laueta ennen kuin nopean vedon ensimmäinen touchmove on
     perillä, ja tavallinen veto luettaisiin pidoksi. Aikaleima kertoo milloin
     sormi liikkui, ei milloin koodi sai tiedon siitä. */
  const S = window.__k = { x: [], pcancel: 0, cancelable: [], paatos: null };
  let t0 = 0, x0 = 0, y0 = 0;
  kaare.addEventListener('pointercancel', function () { S.pcancel++; });
  kaare.addEventListener('touchstart', function (e) {
    S.paatos = null; t0 = e.timeStamp; x0 = e.touches[0].clientX; y0 = e.touches[0].clientY;
  }, { passive: true });
  kaare.addEventListener('touchmove', function (e) {
    const dx = e.touches[0].clientX - x0, dy = e.touches[0].clientY - y0;
    if (!S.paatos && Math.hypot(dx, dy) > 8) S.paatos = (e.timeStamp - t0 >= 200) ? 'skrubi' : 'vieritys';
    if (S.paatos === 'skrubi') { S.cancelable.push(e.cancelable); if (e.cancelable) e.preventDefault(); S.x.push(Math.round(e.touches[0].clientX)); }
  }, { passive: false });
});
const cdp = await kosk.newCDPSession(ks);
const lk = await ks.evaluate(function () { const r = document.querySelector('#__k .en-kaare').getBoundingClientRect(); return { x: r.left, y: r.top }; });
const slK = function () { return ks.evaluate(function () { return document.querySelector('#__k .en-kaare').scrollLeft; }); };
const nuku = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
/* Lämmittely: ensimmäinen CDP-ele on hidas (kosketuskohteen haku), ja sen
   touchstart–touchmove-väli ylittäisi 200 ms ilman että sormi pitäisi
   paikallaan mitään. Heitetään se pois. */
await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lk.x + 280, y: lk.y + 90 }] });
await nuku(50);
await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lk.x + 260, y: lk.y + 90 }] });
await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await nuku(500);
for (const [nimi, pito] of [['veto heti (ei pitoa)', 0], ['pito 260 ms, sitten veto', 260], ['veto heti (toisto)', 0], ['pito 260 ms, sitten veto (toisto)', 260]]) {
  await ks.evaluate(function () { Object.assign(window.__k, { paatos: null, x: [], pcancel: 0, cancelable: [] }); });
  const a = await slK(), x = lk.x + 280, y = lk.y + 90;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x, y: y }] });
  await nuku(pito);
  for (let i = 1; i <= 14; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x - i * 14, y: y }] }); await nuku(16); }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await nuku(400);
  const b = await slK(), S = await ks.evaluate(function () { return window.__k; });
  console.log('  ' + nimi.padEnd(34) + 'vierityksen muutos ' + String(b - a).padStart(4) + ' px | päätös ' + String(S.paatos).padEnd(8) + ' | skrubiliikkeitä ' + String(S.x.length).padStart(2)
    + ' | peruttavissa ' + (S.cancelable.length ? S.cancelable.every(Boolean) : '-') + ' | pointercancel ' + S.pcancel);
}

await selain.close();
