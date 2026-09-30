/* Graafien mittaus ja regressiotesti (docs/graafit.md).
 *
 * Ajaa kaaviomoottorin (`Tuulikaavio.piirra` + `Aikakaavio`) selaimessa
 * synteettisellä sarjalla, jokaisella kortin kytkennällä (osoitin, venytys,
 * asteikon sovitus) — sama koneisto kuin `Ennuste._piirra`ssa. Ei tarvitse
 * verkkoa eikä spotin dataa: sarja rakennetaan sivulla ja moottorin
 * funktioita kutsutaan suoraan.
 *
 * Jokainen rivi on joko `ok` tai `VIKA`; yksikin VIKA antaa poistumiskoodin 1.
 * Luvut ovat samat joita docs/graafit.md:n luvuissa 2 ja 7 mitataan.
 *
 *   1. akselit zoomeittain: päivä, tunti, y-luvut, yksikkö
 *   2. päiväys ruudulla joka vierityskohdassa (tarttuva otsikko)
 *   3. y-luvut kaaviotyypeittäin, "nätti" ylälaita kaikilla yksiköillä
 *   4. hiiri: veto, klikkaus, rulla, hover-pilleri, kursori
 *   5. näppäimet, zoom-napit ja navigaattori
 *   6. käyrä: monotonisuus, poikkeama murtoviivasta, murtoviiva havainnolle,
 *      mallin pisteet lähizoomissa
 *   7. huiput ja saavutettava yhteenveto
 *   8. asteikon sovitus ikkunaan (piirtoja per ele, täyttöaste)
 *   9. kosketus (CDP, oikeat kosketustapahtumat): pito + veto, veto, napautus,
 *      kursorin tartunta, reunavieritys, pystyviiva ei jää vierityksen jälkeen
 *  10. lukema pallon vieressä (kupla, kaikki vertailumallit), geometria
 *      (nuolet ylhäällä, aika-akseli alla) ja ohut tuuliviiva
 *
 * Käyttö:  npm run build && npx vite preview --port 4173 &
 *          PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *            node tools/graafimittaus.mjs http://localhost:4173 [kuvakansio]
 *
 * (`npm run dev` käy myös, mutta Vite lataa sivun uudelleen kun tiedosto
 * muuttuu.) Kuvakansio on valinnainen: sinne tallennetaan kaavio jokaisesta
 * zoomista. Ruutunopeutta tämä ei mittaa (CLAUDE.md, "Mittaaminen tässä
 * ympäristössä"), eikä iOS:n vierityksen tuntumaa — ne tarkistetaan
 * laitteella. */

const osoite = (process.argv[2] || 'http://localhost:4173').replace(/\/$/, '');
const kuvat = process.argv[3] || null;
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const viat = [];
const tarkista = (nimi, ok, tieto) => {
  console.log('  ' + (ok ? 'ok  ' : 'VIKA') + ' ' + nimi + (tieto != null ? ' — ' + tieto : ''));
  if (!ok) viat.push(nimi);
};
const nuku = (ms) => new Promise((r) => setTimeout(r, ms));

const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });

async function avaa(asetus) {
  const kons = await selain.newContext({ ...asetus, locale: 'fi-FI', timezoneId: 'Europe/Helsinki', serviceWorkers: 'block' });
  const sivu = await kons.newPage();
  await sivu.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
  await sivu.goto(osoite + '/?perf=1', { waitUntil: 'domcontentloaded' });
  await sivu.waitForFunction(() => typeof Tuulikaavio !== 'undefined' && typeof Aikakaavio !== 'undefined', null, { timeout: 30000 });
  await sivu.waitForTimeout(2000);
  /* Muu sovellus piiloon: kartan piirtosilmukka (SwiftShader) varaisi
     pääsäikeen, ja CDP-kutsujen viive vääristäisi 200 ms:n pitorajaa. */
  await sivu.evaluate(() => { [].slice.call(document.body.children).forEach((e) => { e.style.display = 'none'; }); });
  await sivu.evaluate(pystytys);
  return { kons, sivu };
}

/* Sivulla: synteettinen sarja ja `__kaavio`, joka kytkee kortin tavoin
   piirron, osoittimen, venytyksen ja asteikon sovituksen. */
function pystytys() {
  const H = 36e5, nyt = Math.round(Date.now() / H) * H;
  const alku = nyt - 48 * H, loppu = nyt + 15 * 24 * H;
  const t = [], ms = [], gust = [], dir = [];
  for (let x = alku; x <= loppu; x += H) {
    const h = (x - alku) / H, klo = new Date(x).getHours();
    /* Tyyni alku, myrsky noin 10 vrk:n päässä (asteikon sovituksen koe). */
    const v = Math.max(0.6, 4 + 2.4 * Math.sin((klo - 9) / 24 * 2 * Math.PI) + 1.2 * Math.sin(h / 7.3) + 13 * Math.exp(-Math.pow((h - 290) / 14, 2)));
    t.push(x); ms.push(v); gust.push(v * 1.3); dir.push((210 + 60 * Math.sin(h / 40) + 360) % 360);
  }
  window.__P = { t: t, ms: ms, gust: gust, dir: dir };
  window.__nyt = nyt; window.__alku = alku; window.__loppu = loppu; window.__H = H;
  window.__loki = [];
  window.__kaavio = function (W0, o) {
    o = o || {};
    document.querySelectorAll('body > div.__k').forEach(function (d) { d.remove(); });
    const div = document.createElement('div');
    div.className = '__k';
    div.style.cssText = 'position:fixed;left:16px;top:16px;width:' + W0 + 'px;background:#FAF5E7;z-index:99999';
    div.innerHTML = '<div class="en-lukema" id="__lk">rivi</div><div class="ak-kehys" style="--ak-tausta:#FAF5E7;margin:0"><div class="en-kaare" tabindex="0"></div></div>';
    document.body.appendChild(div);
    const kaare = div.querySelector('.en-kaare');
    kaare._W0 = W0;
    const P = o.sarja || window.__P, oletus = o.nakyva || 48, avain = 'test' + Math.random();
    let valittu = nyt + 3 * H;
    window.__valittu = function () { return valittu; };
    window.__piirroksia = 0;
    const laske = function (a, b) {
      const m = 0.25 * (b - a);
      return Tuulikaavio.maxV([P], Math.max(alku, a - m), Math.min(loppu, b + m));
    };
    const piirra = function () {
      window.__piirroksia++;
      const nak = Aikakaavio.nakyva(avain, oletus), W = Math.max(W0, Math.round((loppu - alku) / H * W0 / nak));
      const ikk = Aikakaavio.ikkunaNyt(kaare) || Aikakaavio.ikkunaArvio(alku, loppu, valittu, 0.25, nak);
      const p = Tuulikaavio.piirra({ asu: o.asu || Tuulikaavio.ASUT.kortti, plotH: o.plotH || 0, W: W, alku: alku, loppu: loppu, maxV: laske(ikk.a, ikk.b), nyt: nyt,
        valittu: valittu, akseli: 'kiintea', lat: 60.15, lng: 24.9, bestDirs: [180, 250], paa: P, vertailut: o.vertailut || [], aria: 'mittaus', kayra: o.kayra, ikkunaLuvut: !!o.ikkunaLuvut });
      Aikakaavio.aseta(kaare, [p], valittu, 0.25);
      Aikakaavio.skaala(kaare, laske);
    };
    piirra();
    Aikakaavio.osoitin(kaare, {
      pyorista: H, valittu: function () { return valittu; },
      nayta: function (tt) { window.__loki.push(['nayta', tt == null ? null : Math.round((tt - nyt) / H)]); Aikakaavio.hover(kaare, tt); },
      napautus: function (tt) { valittu = tt; window.__loki.push(['valitse', Math.round((tt - nyt) / H)]); Aikakaavio.hover(kaare, null); },
      nappain: function (askel) { valittu = Math.round(valittu / H) * H + askel * H; window.__loki.push(['nappain', askel]); },
    });
    Aikakaavio.venytys(kaare, { avain: avain, oletus: oletus, min: 12, max: 168, piirra: piirra });
    window.__avain = avain;
    return kaare;
  };
  window.__kaikkiTekstit = function (kaare) {
    return [].slice.call(kaare.querySelectorAll('svg text')).map(function (e) { return { x: +e.getAttribute('x'), y: +e.getAttribute('y'), t: e.textContent, lihava: e.getAttribute('font-weight') }; });
  };
}

/* ───────────────────────── työpöytä ───────────────────────── */
const tyo = await avaa({ viewport: { width: 1200, height: 800 }, deviceScaleFactor: 2 });
const s = tyo.sivu;

console.log('\n1. AKSELIT ZOOMEITTAIN (kortti 358 px)');
console.log('   näkyvä  px/h   päiviä  tuntilukuja  tikkejä  lukuja  y-luvut');
for (const nak of [12, 24, 48, 96, 168, 240, 396]) {
  const r = await s.evaluate(async (nak) => {
    const k = window.__kaavio(358, { nakyva: nak });
    await new Promise((res) => setTimeout(res, 200));
    const sl = k.scrollLeft, tekstit = window.__kaikkiTekstit(k).filter((e) => e.t && e.x >= sl && e.x <= sl + 358);
    const paivat = [].slice.call(k.querySelectorAll('.ak-pv > span')).filter((e) => { const b = e.getBoundingClientRect(), kb = k.getBoundingClientRect(); return b.right > kb.left + 38 && b.left < kb.right; }).length;
    const g0 = k._geot[0];
    /* Geometria 30.9.: lähde ja nuolet ylhäällä, aika-akseli (tunnit, päivät) plotin ALLA. */
    const tunnit = tekstit.filter((e) => e.y > g0.tuntiY && e.y <= g0.paivaY && /^\d\d$/.test(e.t)).length;
    const luvut = tekstit.filter((e) => e.lihava === '700' && e.y > g0.y0 && e.y < g0.pohja).length;
    const tikit = [].slice.call(k.querySelectorAll('svg g[stroke-opacity=".6"] line')).filter((e) => +e.getAttribute('x1') >= sl && +e.getAttribute('x1') <= sl + 358).length;
    const g = k._geot[0];
    return { pxH: +(358 / nak).toFixed(1), paivat: paivat, tunnit: tunnit, tikit: tikit, luvut: luvut, y: g.laput.map((l) => l[1]).join(','), yks: !!k.parentElement.querySelector('.ak-yks') };
  }, nak);
  console.log('   ' + (nak + ' h').padEnd(8) + String(r.pxH).padEnd(6) + String(r.paivat).padEnd(8) + String(r.tunnit).padEnd(13) + String(r.tikit).padEnd(9) + String(r.luvut).padEnd(8) + r.y);
  tarkista('aika-akselilla on tunti-informaatiota (' + nak + ' h)', r.tunnit + r.tikit > 0);
  tarkista('y-akselilla ≥ 3 lukua (' + nak + ' h)', r.y.split(',').length >= 3, r.y);
  tarkista('yksikkö akselilla (' + nak + ' h)', r.yks);
  tarkista('päivä näkyy ruudulla (' + nak + ' h)', r.paivat >= 1, r.paivat + ' lappua');
  if (kuvat) { const el = await s.$('body > div.__k'); await el.screenshot({ path: kuvat + '/kaavio_' + nak + 'h.png' }); }
}

console.log('\n2. PÄIVÄMÄÄRÄ RUUDULLA JOKA VIERITYSKOHDASSA (osuus kohdista joissa ei yhtään)');
for (const nak of [12, 24, 48, 168]) {
  const r = await s.evaluate(async (nak) => {
    const k = window.__kaavio(372, { nakyva: nak });
    await new Promise((res) => setTimeout(res, 200));
    const max = k.scrollWidth - k.clientWidth, askel = Math.max(6, Math.round(max / 700));
    let n = 0, nolla = 0;
    for (let x = 0; x <= max; x += askel) {
      k.scrollLeft = x; n++;
      const kb = k.getBoundingClientRect();
      const nakyy = [].slice.call(k.querySelectorAll('.ak-pv > span')).some((e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > kb.left + 38 && b.left < kb.right; });
      if (!nakyy) nolla++;
    }
    return { n: n, nolla: nolla };
  }, nak);
  tarkista('päivämäärä joka kohdassa (' + nak + ' h)', r.nolla === 0, (r.nolla / r.n * 100).toFixed(1) + ' % ilman (' + r.nolla + ' / ' + r.n + ')');
}

console.log('\n3. Y-LUVUT ASUITTAIN JA NÄTTI YLÄLAITA');
const asut = await s.evaluate(() => {
  const P = window.__P, out = [];
  [['kortti', Tuulikaavio.ASUT.kortti, 0, 900], ['rivi', Tuulikaavio.ASUT.rivi, 0, 900],
   ['laaja puhelin vaaka', Object.assign({}, Tuulikaavio.ASUT.laaja, { fs: 1.15 }), 120, 900],
   ['laaja työpöytä', Object.assign({}, Tuulikaavio.ASUT.laaja, { fs: 1.5 }), 420, 900]].forEach((a) => {
    const p = Tuulikaavio.piirra({ asu: a[1], plotH: a[2], W: a[3], alku: window.__nyt, loppu: window.__nyt + 72 * 36e5, maxV: 16, nyt: window.__nyt, akseli: 'kiintea', paa: P, aria: 'x' });
    out.push({ nimi: a[0], luvut: p.g.laput.map((l) => l[1] + (l[2] === 'foil' ? ' (foil)' : '')).join(','), n: p.g.laput.length });
  });
  return out;
});
asut.forEach((r) => tarkista('y-lukuja (foilausraja mukaan lukien) ≥ 3: ' + r.nimi, r.n >= 3, r.n + ' (' + r.luvut + ')'));
const ylat = await s.evaluate(() => {
  const out = {}, vanha = Units._active, sarja = [8, 9.3, 12.7, 16, 21.4, 30];
  for (const u of ['ms', 'kmh', 'kts', 'bft']) {
    Units._active = u;
    out[u] = sarja.map((m) => {
      const v = Tuulikaavio._yla(m * 1.12);
      return u === 'bft' ? { v: v, kynnys: Units._bft.indexOf(v) >= 0 } : { v: v, d: v * (Units.convert(1) || 1) };
    });
  }
  Units._active = vanha;
  return out;
});
for (const u of ['ms', 'kmh', 'kts']) {
  const q = (d) => (d <= 12 ? 2 : (d <= 30 ? 5 : (d <= 80 ? 10 : 20)));
  const ok = ylat[u].every((x) => Math.abs(x.d / q(x.d) - Math.round(x.d / q(x.d))) < 1e-6);
  tarkista('ylälaita on pyöreä luku yksikössä ' + u, ok, ylat[u].map((x) => x.d.toFixed(1)).join(', '));
}
tarkista('bofori: ylälaita on kynnys', ylat.bft.every((x) => x.kynnys));

console.log('\n4. HIIRI (kortti 372 px, 48 h ruudulla)');
await s.evaluate(() => { window.__kaavio(372, { nakyva: 48 }); });
await s.waitForTimeout(300);
const laatikko = await s.evaluate(() => { const r = document.querySelector('.__k .en-kaare').getBoundingClientRect(); return { x: r.left, y: r.top }; });
const sl = () => s.evaluate(() => document.querySelector('.__k .en-kaare').scrollLeft);
const s0 = await sl();
await s.mouse.move(laatikko.x + 250, laatikko.y + 100);
const hover = await s.evaluate(() => { const p = document.querySelector('.__k [data-tk-pill]'); return p ? { teksti: p.querySelector('text').textContent, lev: +p.querySelector('rect').getAttribute('width') } : null; });
tarkista('hover-pilleri tuntirivillä', !!(hover && hover.teksti && hover.lev > 10), hover ? hover.teksti : 'ei pilleriä');
tarkista('kursori on tartunta', await s.evaluate(() => getComputedStyle(document.querySelector('.__k .en-kaare')).cursor === 'grab'));
await s.mouse.down();
for (let i = 1; i <= 12; i++) await s.mouse.move(laatikko.x + 250 - i * 15, laatikko.y + 100);
tarkista('vedon aikana luokka raahaa', await s.evaluate(() => document.querySelector('.__k .en-kaare').classList.contains('raahaa')));
await s.mouse.up();
const s1 = await sl();
tarkista('hiiren veto 180 px vierittää 180 ± 2 px', Math.abs((s1 - s0) - 180) <= 2, (s1 - s0) + ' px');
tarkista('veto ei valitse tuntia', await s.evaluate(() => window.__loki.filter((l) => l[0] === 'valitse').length === 0));
await s.evaluate(() => { window.__loki = []; });
await s.mouse.click(laatikko.x + 200, laatikko.y + 100);
tarkista('klikkaus valitsee tasan kerran', await s.evaluate(() => window.__loki.filter((l) => l[0] === 'valitse').length === 1));
const s1b = await sl();
await s.mouse.wheel(0, 240); await s.waitForTimeout(200);
const s2 = await sl();
await s.keyboard.down('Shift'); await s.mouse.wheel(0, 240); await s.keyboard.up('Shift'); await s.waitForTimeout(300);
const s3 = await sl();
tarkista('pystyrulla ei kaappaa kaaviota', Math.abs(s2 - s1b) < 2, (s2 - s1b) + ' px');
tarkista('Shift+rulla vierittää', s3 - s2 > 100, (s3 - s2) + ' px');

console.log('\n5. NÄPPÄIMET, ZOOM-NAPIT JA NAVIGAATTORI');
await s.evaluate(() => document.querySelector('.__k .en-kaare').focus());
const nak = () => s.evaluate(() => Aikakaavio.nakyva(window.__avain, 48));
const n0 = await nak();
await s.keyboard.press('+'); await s.waitForTimeout(250);
const n1 = await nak();
await s.keyboard.press('-'); await s.keyboard.press('-'); await s.waitForTimeout(250);
const n2 = await nak();
tarkista('+ lähentää ja − loitontaa portaittain', n1 === n0 / 2 && n2 === n0 * 2, n0 + ' → ' + n1 + ' → ' + n2);
await s.keyboard.press('End'); await s.waitForTimeout(700);
tarkista('End vie sarjan loppuun', await s.evaluate(() => { const k = document.querySelector('.__k .en-kaare'); return Math.abs(k.scrollLeft - (k.scrollWidth - k.clientWidth)) < 3; }));
await s.keyboard.press('Home'); await s.waitForTimeout(800);
tarkista('Home vie nyt-hetkeen', await s.evaluate(() => { const k = document.querySelector('.__k .en-kaare'), g = k._geot[0]; const x = g.xOf(window.__nyt); return x >= k.scrollLeft && x <= k.scrollLeft + k._W0; }));
await s.evaluate(() => { window.__loki = []; });
await s.keyboard.press('ArrowRight'); await s.keyboard.press('PageDown');
tarkista('nuoli ja PgDn valitsevat (1 h ja 24 h)', await s.evaluate(() => JSON.stringify(window.__loki.map((l) => l[1])) === '[1,24]'));
const tk = await s.evaluate(() => { const t = document.querySelector('.__k .ak-tyokalut'); return t ? { piilossa: t.hidden, napit: [].slice.call(t.querySelectorAll('button')).map((b) => b.disabled) } : null; });
tarkista('työkalurivi ja zoom-napit hiirilaitteella', !!(tk && !tk.piilossa && tk.napit.length === 2 && tk.napit.every((x) => !x)));
const nav = await s.evaluate(() => { const b = document.querySelector('.__k .ak-nav').getBoundingClientRect(); return { x: b.left, y: b.top, w: b.width, h: b.height }; });
await s.mouse.click(nav.x + nav.w * 0.8, nav.y + nav.h / 2); await s.waitForTimeout(250);
const navTulos = await s.evaluate(() => { const k = document.querySelector('.__k .en-kaare'), g = k._geot[0]; return { sl: k.scrollLeft, odotus: 0.8 * g.W - k._W0 / 2 }; });
tarkista('navigaattorin napautus siirtää ikkunan', Math.abs(navTulos.sl - navTulos.odotus) < 0.03 * navTulos.odotus, Math.round(navTulos.sl) + ' vs ' + Math.round(navTulos.odotus));
await s.click('.__k [data-ak-zoom="0.5"]'); await s.waitForTimeout(250);
tarkista('+-nappi zoomaa', (await nak()) < n2, n2 + ' → ' + (await nak()));

console.log('\n6. KÄYRÄ');
const kayra = await s.evaluate(() => {
  const noodit = [4.0, 4.6, 6.4, 10.4, 13.0, 12.0, 9.0, 7.6, 7.2, 8.4, 8.0], sarja = [];
  for (let h = 0; h < (noodit.length - 1) * 3; h++) { const a = Math.floor(h / 3), f = (h % 3) / 3; sarja.push(noodit[a] + (noodit[a + 1] - noodit[a]) * f); }
  sarja.push(noodit[noodit.length - 1]);
  const n = sarja.length;
  /* Vanha käyrä (vaakatangentti joka pisteessä) vertailuksi. */
  const vanha = (pts) => { let d = 'M' + pts[0][0] + ',' + pts[0][1]; for (let i = 1; i < pts.length; i++) { const cx = (pts[i - 1][0] + pts[i][0]) / 2; d += ' C' + cx + ',' + pts[i - 1][1] + ' ' + cx + ',' + pts[i][1] + ' ' + pts[i][0] + ',' + pts[i][1]; } return d; };
  const tulos = [];
  [[30, '12 h'], [7.5, '48 h'], [2.1, '7 vrk']].forEach((z) => {
    const pxH = z[0], pts = sarja.map((v, i) => [i * pxH + 10, 150 - v * 8.4]);
    const mit = (d) => {
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', d);
      const L = p.getTotalLength(); let max = 0, sum = 0, cnt = 0, ylitys = 0;
      for (let x = 0; x <= L; x += 0.25) {
        const q = p.getPointAtLength(x), k = Math.min(n - 2, Math.max(0, Math.floor((q.x - 10) / pxH)));
        const yl = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * (q.x - pts[k][0]) / pxH, e = Math.abs(q.y - yl);
        max = Math.max(max, e); sum += e * e; cnt++;
        const lo = Math.min(pts[k][1], pts[k + 1][1]) - 0.06, hi = Math.max(pts[k][1], pts[k + 1][1]) + 0.06;
        if (q.y < lo || q.y > hi) ylitys++;
      }
      return { max: +max.toFixed(2), rms: +Math.sqrt(sum / cnt).toFixed(2), ylitys: ylitys };
    };
    tulos.push({ zoom: z[1], px: pxH, vanha: mit(vanha(pts)), uusi: mit(Tuulikaavio._polut(pts)[0].d) });
  });
  const suora = Tuulikaavio._polut([[0, 0], [10, 5], [20, 2]], 'suora')[0].d;
  return { tulos: tulos, suora: suora };
});
kayra.tulos.forEach((r) => {
  tarkista('käyrä ' + r.zoom + ': RMS ≤ 0,3 px ja alle 40 % vanhasta (' + r.vanha.rms + ')', r.uusi.rms <= 0.3 && r.uusi.rms < r.vanha.rms * 0.4, 'uusi RMS ' + r.uusi.rms + ' / max ' + r.uusi.max);
  tarkista('käyrä ' + r.zoom + ': ei ylitä naapuriensa väliä', r.uusi.ylitys === 0, r.uusi.ylitys + ' ylitystä (vanha ' + r.vanha.ylitys + ')');
});
tarkista('havainnon käyrä on murtoviiva', kayra.suora === 'M0.0,0.0 L10.0,5.0 L20.0,2.0', kayra.suora);
const pisteet = await s.evaluate(async () => {
  const out = {};
  for (const nak of [12, 96]) { const k = window.__kaavio(358, { nakyva: nak }); await new Promise((r) => setTimeout(r, 150)); out[nak] = [].slice.call(k.querySelectorAll('svg circle')).filter((c) => !c.closest('[data-tk-hover]') && !c.closest('.tk-valittu-piste')).length; }
  return out;
});
tarkista('mallin pisteet lähizoomissa (12 h)', pisteet[12] > 100, pisteet[12] + ' ympyrää');
tarkista('ei pisteitä kun tunti < 9 px (96 h)', pisteet[96] === 0, pisteet[96] + ' ympyrää (ilman kursorin ja valinnan palloja)');

console.log('\n7. HUIPUT JA SAAVUTETTAVA YHTEENVETO');
const huiput = await s.evaluate(async () => {
  const k = window.__kaavio(358, { nakyva: 396 });
  await new Promise((r) => setTimeout(r, 200));
  const luvut = window.__kaikkiTekstit(k).filter((e) => e.lihava === '700' && e.y > 34).map((e) => +e.t);
  const P = window.__P; let mx = 0; for (let i = 0; i < P.ms.length; i++) if (P.t[i] >= window.__nyt && P.ms[i] > mx) mx = P.ms[i];
  const svg = k.querySelector('svg');
  return { n: luvut.length, luvut: luvut, kovin: Math.round(Units.convert(mx)), aria: svg.getAttribute('aria-label') };
});
tarkista('loitonnettuna huiput saavat luvun (≥ 5)', huiput.n >= 5, huiput.n + ' lukua');
tarkista('sarjan kovin tuuli on nimetty', huiput.luvut.indexOf(huiput.kovin) >= 0, 'kovin ' + huiput.kovin + ' kts, luvut ' + huiput.luvut.join(','));
tarkista('aria-label kertoo kovimman tuulen ja foilausikkunan', /Kovin tuuli \d+ kts/.test(huiput.aria) && /Foilattavaa/.test(huiput.aria), huiput.aria);

console.log('\n8. ASTEIKKO IKKUNAAN (tyyni alku, myrsky ~12 vrk päässä)');
const as = await s.evaluate(async () => {
  const k = window.__kaavio(358, { nakyva: 48 });
  await new Promise((r) => setTimeout(r, 400));
  const ulos = {}, g0 = () => k._geot[0], P = window.__P;
  const huippu = () => { const ik = Aikakaavio.ikkuna(k); let m = 0; for (let i = 0; i < P.t.length; i++) if (P.t[i] >= ik.a && P.t[i] <= ik.b) m = Math.max(m, P.ms[i], P.gust[i]); return m; };
  ulos.alku = { maxV: g0().maxV, huippu: huippu() };
  const max = k.scrollWidth - k.clientWidth;
  /* Nopea vieritys eleen tapaan: askelia 40 ms välein, ei piirtoa kesken. */
  const ennen = window.__piirroksia;
  for (let i = 1; i <= 8; i++) { k.scrollLeft = Math.round(max * 0.72 * i / 8); await new Promise((r) => setTimeout(r, 40)); }
  ulos.kesken = window.__piirroksia - ennen;
  await new Promise((r) => setTimeout(r, 700));
  ulos.myrsky = { maxV: g0().maxV, huippu: huippu(), piirtoja: window.__piirroksia - ennen };
  const ennen2 = window.__piirroksia;
  for (let i = 1; i <= 8; i++) { k.scrollLeft = Math.round(max * 0.72 * (1 - i / 8)); await new Promise((r) => setTimeout(r, 40)); }
  await new Promise((r) => setTimeout(r, 700));
  ulos.takaisin = { maxV: g0().maxV, huippu: huippu(), piirtoja: window.__piirroksia - ennen2 };
  return ulos;
});
const tayttoaste = (x) => x.huippu / x.maxV;
tarkista('tyynen ikkunan täyttöaste ≥ 55 %', tayttoaste(as.alku) >= 0.55, (tayttoaste(as.alku) * 100).toFixed(0) + ' % (ylälaita ' + as.alku.maxV.toFixed(1) + ' m/s)');
tarkista('kesken vierityksen ei piirretä uudelleen', as.kesken === 0, as.kesken + ' piirtoa');
tarkista('myrskyikkuna: arvo ei leikkaudu ja täyttöaste ≥ 55 %', as.myrsky.huippu <= as.myrsky.maxV * 1.02 && tayttoaste(as.myrsky) >= 0.55, (tayttoaste(as.myrsky) * 100).toFixed(0) + ' %');
tarkista('myrskyyn vieritys: asteikko kasvaa ja piirto on yksi', as.myrsky.maxV > as.alku.maxV * 1.5 && as.myrsky.piirtoja === 1, as.alku.maxV.toFixed(1) + ' → ' + as.myrsky.maxV.toFixed(1) + ' m/s, ' + as.myrsky.piirtoja + ' piirtoa');
tarkista('takaisin tyyneen: asteikko pienenee, täyttöaste ≥ 55 %, yksi piirto', as.takaisin.maxV < as.myrsky.maxV * 0.7 && tayttoaste(as.takaisin) >= 0.55 && as.takaisin.piirtoja === 1, (tayttoaste(as.takaisin) * 100).toFixed(0) + ' %, ' + as.takaisin.piirtoja + ' piirtoa');

console.log('\n10. LUKEMA PALLON VIERESSÄ, GEOMETRIA JA OHUT VIIVA (30.9.)');
const geo = await s.evaluate(async () => {
  const P = window.__P, mk = (id, k) => ({ id: id, t: P.t, ms: P.ms.map((v) => v * k), gust: null, dir: P.dir });
  const k = window.__kaavio(358, { nakyva: 48, vertailut: [mk('ecmwf', 0.85), mk('icon', 1.15)] });
  await new Promise((r) => setTimeout(r, 400));
  const g = k._geot[0], svg = k.querySelector('svg.tk-svg'), sb = svg.getBoundingClientRect(), b = k.getBoundingClientRect();
  const nuolet = [].slice.call(svg.querySelectorAll('[data-tk-nuoli], polygon, path')).filter((e) => e.getAttribute('data-nuoli') != null);
  const tunnit = window.__kaikkiTekstit(k).filter((e) => /^\d\d$/.test(e.t));
  const pv = k.querySelector('.ak-pv-vaippa');
  const inkViivat = [].slice.call(svg.querySelectorAll('path[stroke="' + Tuulikaavio.INK + '"]')).map((e) => +e.getAttribute('stroke-width')).filter((w) => w > 0);
  return {
    x: b.left, y: b.top, y0: g.y0, pohja: g.pohja, ylaY: g.ylaY, tuntiY: g.tuntiY, paivaY: g.paivaY, nuoliH: g.nuoliH, W: g.W,
    tunnitYlhaalla: tunnit.filter((e) => e.y < g.y0).length, tunnitAlla: tunnit.filter((e) => e.y > g.pohja && e.y <= g.paivaY).length,
    paivaTop: pv ? Math.round((pv.getBoundingClientRect().top - sb.top) * 10) / 10 : null,
    ohutViiva: inkViivat.length ? Math.max.apply(null, inkViivat) : null,
  };
});
tarkista('nuolirivi on plotin yläpuolella (ylaY < y0)', geo.nuoliH > 0 && geo.ylaY < geo.y0 && Math.abs(geo.y0 - geo.ylaY - geo.nuoliH) < 0.6, 'ylaY ' + geo.ylaY + ', y0 ' + geo.y0 + ', nuoliH ' + geo.nuoliH);
tarkista('aika-akseli alkaa plotin pohjasta ja tuntilukemat ovat sen alla', geo.tuntiY === geo.pohja && geo.tunnitYlhaalla === 0 && geo.tunnitAlla > 5, 'alla ' + geo.tunnitAlla + ', ylhäällä ' + geo.tunnitYlhaalla);
tarkista('päiväotsikko on tuntirivin alla', geo.paivaTop != null && geo.paivaTop >= geo.paivaY - 1.5 && geo.paivaTop <= geo.paivaY + 2, 'top ' + geo.paivaTop + ' vs paivaY ' + geo.paivaY);
tarkista('tuuliviiva ohut (≤ 1,8 px kortilla)', geo.ohutViiva != null && geo.ohutViiva <= 1.8, 'paksuin musta viiva ' + geo.ohutViiva);

const kuplaMittaus = () => s.evaluate(() => {
  const k = document.querySelector('.__k .en-kaare'), svg = k.querySelector('svg.tk-svg'), h = svg.querySelector('[data-tk-hover]'), g = k._geot[0];
  const kg = h.querySelector('[data-tk-kupla]'), pallo = h.querySelector('[data-tk-pallo]'), r = kg.querySelector('rect');
  const rivit = [].slice.call(kg.querySelectorAll('text')).filter((e) => e.getAttribute('visibility') === 'visible').map((e) => e.textContent);
  const mdot = [].slice.call(h.querySelectorAll('[data-tk-mdot]')).filter((e) => e.getAttribute('visibility') === 'visible');
  const cx = +pallo.getAttribute('cx'), bx = +r.getAttribute('x'), bw = +r.getAttribute('width'), by = +r.getAttribute('y'), bh = +r.getAttribute('height');
  return {
    hover: h.getAttribute('visibility'), kupla: kg.getAttribute('visibility'), rivit: rivit, mdot: mdot.length,
    mdotY: mdot.map((e) => Math.abs(+e.getAttribute('cy') - g.yOf(0)) >= 0), mdotX: mdot.every((e) => Math.abs(+e.getAttribute('cx') - cx) < 0.6),
    vari: mdot.map((e) => e.getAttribute('fill')).join(','),
    vasenReuna: bx, oikeaReuna: bx + bw, cx: cx, sl: k.scrollLeft, w0: k._W0, ylhaalla: by, alhaalla: by + bh, y0: g.y0, pohja: g.pohja,
    oikealla: bx > cx,
  };
});
await s.mouse.move(geo.x + 120, geo.y + geo.y0 + 30);
await s.waitForTimeout(250);
const K1 = await kuplaMittaus();
tarkista('hover: kupla näkyy ja siinä on arvo, puuska ja jokainen vertailumalli', K1.kupla === 'visible' && K1.rivit.length >= 4 && /kts/.test(K1.rivit[0]) && K1.rivit.some((t) => /ECMWF/.test(t)) && K1.rivit.some((t) => /ICON/.test(t)), K1.rivit.join(' | '));
tarkista('hover: väripiste kursorin kohdalla jokaiselle mallille', K1.mdot === 2 && K1.mdotX && K1.vari.split(',').length === 2 && K1.vari.split(',')[0] !== K1.vari.split(',')[1], K1.mdot + ' pistettä, värit ' + K1.vari);
tarkista('hover: kupla pallon vieressä sivulla (ei sen päällä), ruudun sisällä', K1.oikealla && K1.vasenReuna - K1.cx >= 20 && K1.vasenReuna - K1.cx <= 30 && K1.oikeaReuna <= K1.sl + K1.w0, 'kupla ' + K1.vasenReuna.toFixed(0) + '–' + K1.oikeaReuna.toFixed(0) + ', pallo ' + K1.cx.toFixed(0) + ', ruutu ' + K1.sl + '–' + (K1.sl + K1.w0));
tarkista('hover: kupla plotin sisällä pystysuunnassa', K1.ylhaalla >= K1.y0 && K1.alhaalla <= K1.pohja, K1.ylhaalla.toFixed(0) + '–' + K1.alhaalla.toFixed(0) + ' / ' + K1.y0 + '–' + K1.pohja);
await s.mouse.move(geo.x + 340, geo.y + geo.y0 + 30);
await s.waitForTimeout(250);
const K2 = await kuplaMittaus();
tarkista('hover oikeassa reunassa: kupla kääntyy pallon vasemmalle puolelle', K2.kupla === 'visible' && !K2.oikealla && K2.cx - K2.oikeaReuna >= 20 && K2.vasenReuna >= K2.sl, 'kupla ' + K2.vasenReuna.toFixed(0) + '–' + K2.oikeaReuna.toFixed(0) + ', pallo ' + K2.cx.toFixed(0));
await s.mouse.move(geo.x - 80, geo.y + 400);
await s.waitForTimeout(250);
const K3 = await kuplaMittaus();
/* SVG:n `visibility="visible"` lapsessa voittaa vanhemman `hidden`in, joten
   luetaan laskettu näkyvyys jokaiselta osalta eikä vain ryhmältä. */
const nakyvia = await s.evaluate(() => [].slice.call(document.querySelectorAll('.__k svg.tk-svg [data-tk-hover], .__k svg.tk-svg [data-tk-hover] *')).filter((e) => getComputedStyle(e).visibility === 'visible').length);
tarkista('osoitin pois: kursori, pallo, kupla ja mallipisteet piilossa (laskettu näkyvyys)', K3.hover === 'hidden' && nakyvia === 0, 'näkyviä osia ' + nakyvia);

/* ───────────────────────── kosketus ───────────────────────── */
console.log('\n9. KOSKETUS (Chromium, CDP Input.dispatchTouchEvent, kortti 358 px)');
const kos = await avaa({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const ks = kos.sivu;
await ks.evaluate(() => { window.__kaavio(358, { nakyva: 48 }); });
await ks.waitForTimeout(400);
const cdp = await kos.kons.newCDPSession(ks);
const lk = await ks.evaluate(() => { const r = document.querySelector('.__k .en-kaare').getBoundingClientRect(); return { x: r.left, y: r.top }; });
const slK = () => ks.evaluate(() => document.querySelector('.__k .en-kaare').scrollLeft);
const liuku = (a, b, n) => Array.from({ length: n }, (_, i) => Math.round(a + (b - a) * (i + 1) / n));
async function ele({ x0, pito, liikkeet, y = 90, loppuun = 0 }) {
  await ks.evaluate(() => { window.__loki = []; });
  const a = await slK();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lk.x + x0, y: lk.y + y }] });
  await nuku(pito);
  let keskella = null;
  for (let i = 0; i < liikkeet.length; i++) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lk.x + liikkeet[i], y: lk.y + y }] });
    await nuku(16);
    if (i === 5) keskella = await ks.evaluate(() => ({ skrubi: !!document.querySelector('.__k .en-kaare')._akSkrubi, luokka: document.querySelector('.__k .en-kaare').classList.contains('skrubaa'), rivi: document.getElementById('__lk').classList.contains('skrubaa') }));
  }
  await nuku(loppuun);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await nuku(450);
  const loki = await ks.evaluate(() => window.__loki);
  return { scroll: (await slK()) - a, keskella: keskella, nayta: loki.filter((l) => l[0] === 'nayta' && l[1] != null).map((l) => l[1]), valitse: loki.filter((l) => l[0] === 'valitse').map((l) => l[1]) };
}
/* Lämmittely: ensimmäinen CDP-ele on hidas (kosketuskohteen haku), ja sen
   touchstart–touchmove-väli ylittäisi 200 ms ilman että sormi pitäisi
   paikallaan mitään. Heitetään se pois. */
await ele({ x0: 280, pito: 50, liikkeet: [260] });
/* Kursorin x kääreessä juuri nyt: veto aloitetaan kauempaa (kursorin
   28 px:n tartunta-alue aloittaa skrubin heti, ja edellisen kierroksen
   valinta jättää kursorin sormen viimeiseen kohtaan). */
const kursoriX = () => ks.evaluate(() => { const k = document.querySelector('.__k .en-kaare'), g = k._geot[0], svg = k.querySelector('svg'); return svg.getBoundingClientRect().left + g.xOf(window.__valittu()) - k.getBoundingClientRect().left; });
/* Yksi uusinta: hidas CI-kone voi viivästyttää touchmovea yli 200 ms:n
   (harness, ei sovellus) ja tehdä vedosta pidon. */
const uusinnalla = async (ajo, ok) => { let r = await ajo(); if (!ok(r)) r = await ajo(); return r; };
for (let kierros = 1; kierros <= 2; kierros++) {
  const cx = await kursoriX(), a0 = cx > 190 ? 70 : 300, a1 = a0 + (a0 < 190 ? 200 : -200);
  const A = await uusinnalla(() => ele({ x0: a0, pito: 0, liikkeet: liuku(a0, a1, 14) }), (r) => Math.abs(r.scroll) > 150);
  tarkista('veto heti vierittää (kierros ' + kierros + ')', Math.abs(A.scroll) > 150 && A.nayta.length === 0 && A.valitse.length === 0, A.scroll + ' px, lukemia ' + A.nayta.length);
  const cx2 = await kursoriX(), b0 = cx2 > 190 ? 70 : 300, b1 = b0 + (b0 < 190 ? 200 : -200);
  const B = await ele({ x0: b0, pito: 260, liikkeet: liuku(b0, b1, 14) });
  tarkista('pito + veto: ei vieritä, lukema seuraa, nosto valitsee kerran (kierros ' + kierros + ')',
    B.scroll === 0 && B.keskella && B.keskella.skrubi && B.keskella.luokka && B.keskella.rivi && B.nayta.length >= 10 && B.valitse.length === 1,
    B.scroll + ' px, lukemia ' + B.nayta.length + ' (' + B.nayta[0] + '…' + B.nayta[B.nayta.length - 1] + ' h), valintoja ' + B.valitse.length);
  tarkista('skrubin lopussa merkki pois (kierros ' + kierros + ')', await ks.evaluate(() => { const k = document.querySelector('.__k .en-kaare'); return !k._akSkrubi && !k.classList.contains('skrubaa') && !document.getElementById('__lk').classList.contains('skrubaa'); }));
}
const C = await ele({ x0: 200, pito: 30, liikkeet: [] });
tarkista('napautus valitsee kerran', C.valitse.length === 1 && C.scroll === 0, 'valintoja ' + C.valitse.length);
const D = await ele({ x0: 200, pito: 300, liikkeet: [] });
tarkista('pito paikallaan ja nosto valitsee kerran (lukema syttyy)', D.valitse.length === 1 && D.nayta.length >= 1, 'valintoja ' + D.valitse.length + ', lukemia ' + D.nayta.length);
/* Tuo kursori näkyviin ja aloita 6 px sen oikealta puolelta. */
await ks.evaluate(() => { const k = document.querySelector('.__k .en-kaare'), g = k._geot[0]; k.scrollLeft = Math.max(0, g.xOf(window.__valittu()) - 150); });
await ks.waitForTimeout(700);
const kx = await kursoriX();
const E = await ele({ x0: Math.round(kx) + 6, pito: 0, liikkeet: liuku(kx + 6, kx + 90, 12) });
tarkista('kursorin tartunta aloittaa skrubin heti', E.keskella && E.keskella.skrubi && E.scroll === 0 && E.valitse.length === 1, 'kursori x ' + Math.round(kx) + ', lukemia ' + E.nayta.length);
const F = await ele({ x0: 150, pito: 260, liikkeet: liuku(150, 350, 12), loppuun: 700 });
tarkista('skrubi reunaan vierittää kaaviota', F.scroll > 200 && F.valitse.length === 1, F.scroll + ' px, ' + F.nayta[0] + '…' + F.nayta[F.nayta.length - 1] + ' h');
/* PYSTYVIIVA EI JÄÄ (30.9.): sormi paikallaan pidon yli sytyttää merkin, ja
   jos selain vie eleen vierityksenä (`touchmove` ei tule peruttavana) merkki
   jäi alkupisteeseen ja vieri kaavion mukana. Simuloidaan vieritys
   kirjoittamalla `scrollLeft` pidon jälkeen: merkin täytyy kadota. */
const hoverNakyy = () => ks.evaluate(() => { const h = document.querySelector('.__k .en-kaare svg.tk-svg [data-tk-hover]'); return h && h.getAttribute('visibility') === 'visible'; });
await ks.evaluate(() => { document.querySelector('.__k .en-kaare').scrollLeft += 0; });
{
  const kx0 = await kursoriX(), x0 = kx0 > 190 ? 70 : 300;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lk.x + x0, y: lk.y + 90 }] });
  await nuku(320);
  const pidossa = await hoverNakyy();
  await ks.evaluate(() => { document.querySelector('.__k .en-kaare').scrollLeft += 40; });
  await nuku(120);
  const vierityksessa = await hoverNakyy();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await nuku(300);
  const lopussa = await hoverNakyy();
  tarkista('pystyviiva ei jää kun selain vie eleen vierityksenä', pidossa && !vierityksessa && !lopussa, 'pidossa ' + pidossa + ', vierityksessä ' + vierityksessa + ', nostossa ' + lopussa);
}
{
  const kx0 = await kursoriX(), x0 = kx0 > 190 ? 70 : 300, x1 = x0 + (x0 < 190 ? 200 : -200);
  await ele({ x0: x0, pito: 0, liikkeet: liuku(x0, x1, 14) });
  tarkista('nopea veto ei jätä pystyviivaa', !(await hoverNakyy()));
}
/* Kupla seuraa sormea skrubissa ja katoaa nostossa. */
{
  const kx0 = await kursoriX(), x0 = kx0 > 190 ? 70 : 300, x1 = x0 + (x0 < 190 ? 150 : -150);
  const kuplaKosk = () => ks.evaluate(() => { const kg = document.querySelector('.__k .en-kaare svg.tk-svg [data-tk-kupla]'); return !!kg && getComputedStyle(kg).visibility === 'visible'; });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lk.x + x0, y: lk.y + 90 }] });
  await nuku(300);
  for (const x of liuku(x0, x1, 8)) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lk.x + x, y: lk.y + 90 }] }); await nuku(16); }
  const keskella = await kuplaKosk();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await nuku(300);
  tarkista('skrubissa kupla näkyy pallon vieressä ja nostossa se katoaa', keskella && !(await kuplaKosk()), 'skrubin aikana ' + keskella);
}
const Reuna = await ele({ x0: -8, pito: 260, liikkeet: liuku(-8, 100, 10) });
tarkista('vasen reuna (16 px) ei aloita pitoa (iOS:n takaisinpyyhkäisy)', Reuna.nayta.length === 0 && Reuna.valitse.length === 0, 'lukemia ' + Reuna.nayta.length);

await selain.close();
console.log('\n' + (viat.length ? viat.length + ' VIKAA: ' + viat.join('; ') : 'Kaikki tarkistukset läpi.'));
process.exit(viat.length ? 1 : 0);
