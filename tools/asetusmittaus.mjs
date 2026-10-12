/* Asetukset paikan mukaan — mittari (docs/asetukset.md, luku 7).
 *
 * Avaa asetuspaneelin kahdessatoista näkymässä Helsingistä Kanariansaarille
 * ja vertaa paneelia KARTAN omaan dataan, ei katerekisteriin itseensä:
 *
 *   1. havaintorivi näkyy  <=>  kartalla on sen ryhmän merkki tai
 *      Euroopan piste näkymässä (+ 25 %)
 *   2. alueellinen malli on listalla  <=  sen PAKOTTAMINEN näyttää sen
 *      kartalla näkymässä (`asetaTila(id)` + `malliKohdassa` 5 × 5 -hilassa).
 *      Listalla saa olla malli jota pakotus ei näytä vain jos sen laatta
 *      oli tuntematon (raportoidaan, ei vika).
 *   3. tila säilyy: Helsinki (rantalämpötilat päälle) -> Quiberon ->
 *      Helsinki, `fs_tasot` tavulleen sama
 *   4. englanniksi paneelissa ei ole suomen sanoja eikä pilkkudesimaaleja
 *   5. mallilista on yksi sarkainpysäkki, ei `pageerror`ia
 *   6. kortin mallivalikko (Pampus): alueelliset jotka kattavat pisteen
 *
 * Käyttö:  npm run build && npx vite preview --port 4173 &
 *          PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *          node tools/asetusmittaus.mjs [http://localhost:4173] [--nopea]
 * Oikea data (varasto, FMI, E-SOH), ei CI:ssä. Noin 4–6 min. */

const osoite = (process.argv.find(a => /^https?:/.test(a)) || 'http://localhost:4173').replace(/\/$/, '');
const NOPEA = process.argv.includes('--nopea');
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const NAKYMAT = [
  ['Helsinki', 60.15, 24.90, 9], ['Hanko', 59.82, 22.95, 9], ['Tallinna', 59.45, 24.75, 9],
  ['Oslo', 59.90, 10.70, 9], ['Quiberon', 47.48, -3.12, 9], ['Provence', 43.30, 5.30, 9],
  ['Garda', 45.65, 10.70, 10], ['Sylt', 54.90, 8.30, 9], ['Cornwall', 50.20, -5.30, 9],
  ['Biskaja', 45.50, -6.50, 7], ['Kanariansaaret', 28.10, -15.40, 9], ['Eurooppa', 52.0, 10.0, 4],
  ['Pampus', 52.37, 5.07, 10],
];
const NAYTETTAVAT = NOPEA ? NAKYMAT.filter(n => ['Helsinki', 'Quiberon', 'Kanariansaaret'].includes(n[0])) : NAKYMAT;

const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const viat = [], rivit = [];
const vika = (s) => { viat.push(s); console.log('VIKA ' + s); };
const ok = (s) => console.log('ok   ' + s);

async function avaa(laite, kieli) {
  const asetus = laite === 'puhelin'
    ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true }
    : { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 };
  const k = await selain.newContext({ ...asetus, locale: 'fi-FI', timezoneId: 'Europe/Helsinki', serviceWorkers: 'block', ignoreHTTPSErrors: true });
  const s = await k.newPage();
  s._virheet = [];
  s.on('pageerror', (e) => s._virheet.push(e.message));
  await s.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
  await s.goto(osoite + '/?perf=1' + (kieli ? '&kieli=' + kieli : ''), { waitUntil: 'domcontentloaded' });
  await s.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 60000 });
  await s.waitForFunction(() => window.FS && FS.Saalaatat._perheet, null, { timeout: 30000 });
  return { k, s };
}

async function siirry(s, lat, lng, z) {
  await s.evaluate(([lat, lng, z]) => {
    if (document.getElementById('settings-popup').classList.contains('open')) document.getElementById('btn-settings').click();
    FS.State.map.setView([lat, lng], z, { animate: false });
  }, [lat, lng, z]);
  /* Laatat, Euroopan luettelo ja laatat: odotetaan että kartan oma lataus
     asettuu (sama kuin käyttäjä joka avaa asetukset hetken päästä). */
  await s.waitForTimeout(4500);
  await s.waitForFunction(() => !FS.State.liikkeessa, null, { timeout: 15000 }).catch(() => {});
}

async function lueTila(s) {
  return s.evaluate(async () => {
    document.getElementById('btn-settings').click();
    await new Promise(r => setTimeout(r, 400));
    const p = document.getElementById('settings-popup');
    const mallit = [...p.querySelectorAll('#asetus-malli .sp-chip')].map(c => ({ id: c.dataset.arvo, sub: c.querySelector('.sp-valinta-sub')?.textContent }));
    const tassa = [...document.querySelectorAll('#sp-hav-tassa .sp-toggle-row')].map(r => ({ id: r.dataset.layerToggle, sub: r.querySelector('.sp-toggle-sub').textContent }));
    const muualla = [...document.querySelectorAll('#sp-hav-muualla-rivit .sp-toggle-row')].map(r => r.dataset.layerToggle);
    const aallot = document.querySelector('#layers .sp-chip[data-layer="aallot"]').classList.contains('sp-kerros-ei');
    const pysakit = [...p.querySelectorAll('#asetus-malli [tabindex="0"]')].length;
    const roolit = [...p.querySelectorAll('#asetus-malli .sp-chip')].every(c => c.getAttribute('role') === 'radio' && c.hasAttribute('aria-checked'));
    const teksti = p.innerText;
    const kate = FS.Kate.nakyma();
    return { mallit, tassa, muualla, aallot, pysakit, roolit, teksti,
             tuntemattomat: kate.mallit.filter(m => !m.varma).map(m => m.perhe) };
  });
}

/* Kartan totuus: merkit ja Euroopan pisteet näkymässä, ryhmittäin. */
async function karttaTotuus(s) {
  return s.evaluate(() => {
    const b = FS.State.map.getBounds().pad(0.25);
    const sis = (la, lo) => la >= b.getSouth() && la <= b.getNorth() && lo >= b.getWest() && lo <= b.getEast();
    const ryhmat = {};
    for (const m of window._obsMarkersGlobal) {
      const ll = m.marker.getLatLng();
      if (!sis(ll.lat, ll.lng)) continue;
      const g = m.layerGroup === 'uiras' ? (m.prim ? 'uiras-prim' : 'uiras-sec') : m.layerGroup;
      ryhmat[g] = (ryhmat[g] || 0) + 1;
    }
    for (const a of (FS.EuAsemat.luettelo || [])) {
      if (!sis(a[1], a[2])) continue;
      const g = a[3] ? 'fmi-sea' : 'fmi-land';
      ryhmat[g] = (ryhmat[g] || 0) + 1;
    }
    /* Ladattujen E-SOH-laattojen asemat ovat kartan merkkejä kun ryhmän
       kytkin on päällä (sisämaa on oletuksena pois), ja luettelo päivittyy
       vasta keräimen ajossa. */
    FS.EuAsemat._laatat.forEach(function (l) {
      if (!l.data) return;
      for (const st of l.data._rek) {
        if (!sis(st.lat, st.lng)) continue;
        const g = vesiTagi(st.tag) ? 'fmi-sea' : 'fmi-land';
        ryhmat[g] = (ryhmat[g] || 0) + 1;
      }
    });
    /* Suomen rekisterin asemat ovat merkkejä myös kytkin pois päältä. */
    return ryhmat;
  });
}

/* Mallien totuus: pakota jokainen alueellinen, lue osuus näkymässä. */
async function malliTotuus(s) {
  return s.evaluate(async () => {
    const S = FS.Saalaatat, map = FS.State.map, b = map.getBounds(), z = map.getZoom();
    const st = FS.ViewportGrid.laattaStep(Math.round(z)), hetki = FS.State.valittuMs || Date.now();
    const ulos = [];
    for (const p of S._perheet) {
      if (p.dyn || p.pohja) continue;
      const bb = p._bb;
      if (b.getNorth() < bb[0] || b.getSouth() > bb[1] || b.getEast() < bb[2] || b.getWest() > bb[3]) continue;
      S.asetaTila(p.id);
      /* Paikka, ei hetki: alueellisen jakso on lyhyempi kuin aikajana, joten
         luetaan hetki jolla perhe on varmasti mukana (akselin keskeltä). */
      const ts = p.tasot[0]._ax.tsMs, h = ts[Math.floor(ts.length / 2)];
      S.asetaHetki(h);
      await S.varmista(b, st);
      let osui = 0;
      for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
        const la = b.getSouth() + (b.getNorth() - b.getSouth()) * (j + 0.5) / 5;
        const lo = b.getWest() + (b.getEast() - b.getWest()) * (i + 0.5) / 5;
        const o = S.malliKohdassa(la, lo, st, h);
        if (o && o.some(x => x.perhe === p.id && x.osuus > 0.01)) osui++;
      }
      if (osui) ulos.push(p.id);
    }
    S.asetaTila('auto');
    S.asetaHetki(hetki);
    return ulos;
  });
}

const SUOMEKSI = /\b(asema|asemaa|Muualla|Täällä|näkymä|näkymässä|kata|Ilmatieteen|Pohjakartta|Tumma|Pääkaupunkiseutu|vuorokautta|Tarkin)\b/;

for (const laite of ['puhelin', 'tyopoyta']) {
  const { k, s } = await avaa(laite);
  console.log('\n== ' + laite);
  for (const [nimi, lat, lng, z] of NAYTETTAVAT) {
    await siirry(s, lat, lng, z);
    const t = await lueTila(s);
    const kartta = await karttaTotuus(s);
    const ryhmat = ['fmi-sea', 'aallot', 'uiras-prim', 'fmi-land', 'uiras-sec'];
    const nakyvat = t.tassa.map(r => r.id);
    const turhat = nakyvat.filter(g => !kartta[g]);
    const puuttuvat = ryhmat.filter(g => kartta[g] && nakyvat.indexOf(g) < 0);
    const alue = t.mallit.map(m => m.id).filter(id => !['auto', 'ecmwf', 'icon', 'gfs'].includes(id));
    let totuus = null;
    if (laite === 'puhelin') {
      await s.evaluate(() => document.getElementById('btn-settings').click());
      totuus = await malliTotuus(s);
    }
    const piilossa = totuus ? totuus.filter(id => alue.indexOf(id) < 0) : [];
    const ylim = totuus ? alue.filter(id => totuus.indexOf(id) < 0) : [];
    const rivi = `${nimi.padEnd(15)} havainnot [${nakyvat.join(', ')}] muualla [${t.muualla.join(', ')}]  mallit [${alue.join(', ')}]`
      + (totuus ? `  pakotus näyttää [${totuus.join(', ')}]` : '') + `  aallot ${t.aallot ? 'ei' : 'on'}`;
    console.log(rivi);
    console.log('     Paras: ' + t.mallit[0].sub + ' | ' + t.tassa.map(r => r.id + ': ' + r.sub).join(' | '));
    rivit.push(laite + ' ' + rivi);
    if (turhat.length) vika(`${laite} ${nimi}: näkyvä rivi ilman merkkiä: ${turhat.join(', ')}`);
    if (puuttuvat.length) vika(`${laite} ${nimi}: piilotettu rivi jolla on merkki: ${puuttuvat.join(', ')}`);
    if (piilossa.length) vika(`${laite} ${nimi}: malli puuttuu listalta vaikka pakotus näyttää sen: ${piilossa.join(', ')}`);
    for (const id of ylim) {
      const tunt = t.tuntemattomat.indexOf(id) >= 0;
      (tunt ? ok : vika)(`${laite} ${nimi}: listalla ${id}, jota pakotus ei näytä` + (tunt ? ' (laatta tuntematon — sallittu)' : ''));
    }
    if (t.pysakit !== 1) vika(`${laite} ${nimi}: mallilistassa ${t.pysakit} sarkainpysäkkiä`);
    if (!t.roolit) vika(`${laite} ${nimi}: mallisirulta puuttuu rooli tai aria-checked`);
    if (/\d\.\d/.test(t.teksti.replace(/Version [^\n]*|Versio [^\n]*/g, ''))) vika(`${laite} ${nimi}: pistedesimaali suomeksi`);
    if (laite === 'puhelin' && totuus) await s.evaluate(() => { if (document.getElementById('settings-popup').classList.contains('open')) document.getElementById('btn-settings').click(); });
    else await s.evaluate(() => document.getElementById('btn-settings').click());
  }

  /* Tila säilyy matkan yli. */
  if (laite === 'puhelin') {
    await siirry(s, 60.15, 24.90, 9);
    const ennen = await s.evaluate(async () => {
      document.getElementById('btn-settings').click();
      await new Promise(r => setTimeout(r, 300));
      const r = document.querySelector('[data-layer-toggle="uiras-prim"]');
      if (!document.getElementById('toggle-uiras-prim').classList.contains('on')) r.click();
      document.getElementById('btn-settings').click();
      return localStorage.getItem('fs_tasot');
    });
    await siirry(s, 47.48, -3.12, 9);
    const ranska = await s.evaluate(async () => {
      document.getElementById('btn-settings').click();
      await new Promise(r => setTimeout(r, 300));
      const muualla = !!document.querySelector('#sp-hav-muualla-rivit [data-layer-toggle="uiras-prim"]');
      document.getElementById('btn-settings').click();
      return { muualla, tasot: localStorage.getItem('fs_tasot') };
    });
    await siirry(s, 60.15, 24.90, 9);
    const jalkeen = await s.evaluate(async () => {
      document.getElementById('btn-settings').click();
      await new Promise(r => setTimeout(r, 300));
      const tassa = !!document.querySelector('#sp-hav-tassa [data-layer-toggle="uiras-prim"]');
      const on = document.getElementById('toggle-uiras-prim').classList.contains('on');
      document.getElementById('btn-settings').click();
      return { tassa, on, tasot: localStorage.getItem('fs_tasot') };
    });
    if (ennen === ranska.tasot && ranska.tasot === jalkeen.tasot && ranska.muualla && jalkeen.tassa && jalkeen.on) ok('tila säilyy Helsinki -> Quiberon -> Helsinki (' + ennen + ')');
    else vika('tila ei säilynyt: ' + JSON.stringify({ ennen, ranska, jalkeen }));

    /* Pakotettu AROME Quiberonissa: kartta lukee sitä. */
    await siirry(s, 47.48, -3.12, 9);
    const pakotus = await s.evaluate(async () => {
      document.getElementById('btn-settings').click();
      await new Promise(r => setTimeout(r, 300));
      const c = document.querySelector('#asetus-malli .sp-chip[data-arvo="arome_hd"]');
      if (!c) return { virhe: 'ei AROME-riviä' };
      c.click();
      await new Promise(r => setTimeout(r, 6000));
      const m = FS.State.map.getCenter();
      const o = FS.Saalaatat.malliKohdassa(m.lat, m.lng, 0.05, FS.State.valittuMs);
      const vihje = document.getElementById('malli-vihje').textContent;
      const valittu = document.querySelector('#asetus-malli .sp-chip.active')?.dataset.arvo;
      document.querySelector('#asetus-malli .sp-chip[data-arvo="auto"]').click();
      await new Promise(r => setTimeout(r, 1500));
      document.getElementById('btn-settings').click();
      return { o, vihje, valittu };
    });
    if (pakotus.valittu === 'arome_hd' && pakotus.o && pakotus.o[0] && pakotus.o[0].perhe === 'arome_hd') ok('pakotettu AROME kartalla: ' + JSON.stringify(pakotus.o.slice(0, 2)) + ' — ' + pakotus.vihje.slice(0, 90));
    else vika('pakotettu AROME: ' + JSON.stringify(pakotus).slice(0, 300));

    /* Kortin mallivalikko Pampuksessa. */
    const kortti = await s.evaluate(async () => {
      const spot = { lat: 52.37, lng: 5.07 };
      await FS.Saalaatat.varmistaPiste(spot.lat, spot.lng, 0.05, true);
      return FS.KorttiSarjat.mallitPisteelle(spot, []).map(m => m.id + ' ' + m.vari + ' ' + m.viiva);
    });
    console.log('kortin mallit Pampus: ' + kortti.join(' | '));
    if (kortti.some(x => x.startsWith('fmi ') || x.startsWith('metnordic '))) vika('kortin valikossa Suomen malli Pampuksessa');
    else ok('kortin valikko Pampuksessa ilman HARMONIEa ja MET Nordicia');
    const helsinki = await s.evaluate(async () => {
      await FS.Saalaatat.varmistaPiste(60.153, 24.87, 0.05, true);
      return FS.KorttiSarjat.mallitPisteelle({ lat: 60.153, lng: 24.87 }, []).map(m => m.id);
    });
    console.log('kortin mallit Lauttasaari: ' + helsinki.join(', '));
    if (helsinki.indexOf('fmi') >= 0 && helsinki.indexOf('metnordic') >= 0) ok('kortin valikko Lauttasaaressa: FMI ja MET Nordic mukana');
    else vika('kortin valikko Lauttasaaressa: ' + helsinki.join(', '));
  }
  if (s._virheet.length) vika(laite + ': pageerror ' + s._virheet.join(' / '));
  await k.close();
}

/* Englanti: Quiberon ja Helsinki. */
{
  const { k, s } = await avaa('puhelin', 'en');
  for (const [nimi, lat, lng, z] of [NAKYMAT[4], NAKYMAT[0]]) {
    await siirry(s, lat, lng, z);
    const t = await lueTila(s);
    await s.evaluate(() => { document.getElementById('sp-hav-muualla-nappi').click(); });
    const teksti = await s.evaluate(() => document.getElementById('settings-popup').innerText);
    const osuma = teksti.match(SUOMEKSI);
    if (osuma) vika(`en ${nimi}: suomea paneelissa: "${osuma[0]}"`);
    else ok(`en ${nimi}: ei suomen sanoja (${t.tassa.map(r => r.sub).join(' | ')})`);
    if (/\d,\d/.test(teksti)) vika(`en ${nimi}: pilkkudesimaali englanniksi`);
    await s.evaluate(() => document.getElementById('btn-settings').click());
  }
  if (s._virheet.length) vika('en: pageerror ' + s._virheet.join(' / '));
  await k.close();
}

await selain.close();
console.log('\n' + (viat.length ? viat.length + ' vikaa' : 'kaikki ok'));
process.exit(viat.length ? 1 : 0);
