/* Sadetutkan mittari (docs/sadetutka.md, V0).
 *
 * Avaa tuotantobuildin, kytkee sadetilan ja vie kartan annettuun
 * näkymään ja hetkeen, ja mittaa:
 *   - tutkalaattojen pyynnöt ja tavut (T6)
 *   - kuvakaappauksen kartasta (`--kuva`) ja FMI:n oman 250 m kuvan
 *     samasta rajauksesta vertailuun (T1, T7)
 *   - sadekerroksen tilan: leima, lähde, kehykset ruudulla
 *
 * FMI:n vastaukset voi TALLENTAA ja TOISTAA, jotta sama sateinen päivä
 * mitataan uudelleen säästä ja verkosta riippumatta:
 *   --tallenna=hakemisto   kirjoittaa jokaisen openwms/api-sade/S3-vastauksen
 *   --toista=hakemisto     palvelee ne levyltä (puuttuva = 404)
 *
 * Käyttö:
 *   npm run build && npx vite preview --port 4173 &
 *   PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
 *   node tools/sademittaus.mjs --lat=62.6 --lng=27.7 --z=8 \
 *     --aika=2026-10-04T13:00:00Z --kuva=/tmp/sade.png
 *
 * `--laite=puhelin|tyopoyta` (oletus puhelin, `hasTouch` mukana —
 * CLAUDE.md "Mobiiliharness ei ole mobiili ilman hasTouchia"). */

import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const arg = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([^=]+)(?:=(.*))?$/.exec(a);
  if (m) arg[m[1]] = m[2] === undefined ? true : m[2];
  else arg.osoite = a;
}
const osoite = (arg.osoite || 'http://localhost:4173').replace(/\/$/, '');
const lat = +(arg.lat || 60.17), lng = +(arg.lng || 24.94), z = +(arg.z || 9);
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE || 'playwright');

const LAITTEET = {
  puhelin: { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true },
  tyopoyta: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
};
const laite = LAITTEET[arg.laite || 'puhelin'];

const avain = (url) => createHash('sha1').update(url).digest('hex');
const tallennettava = (url) => /openwms\.fmi\.fi|\/api\/sade|fmi-opendata-radar|api\.met\.no/.test(url);

const selain = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist', '--ignore-certificate-errors'] });
const konteksti = await selain.newContext({
  ...laite, locale: 'fi-FI', timezoneId: 'Europe/Helsinki', serviceWorkers: 'block', ignoreHTTPSErrors: true,
});
const sivu = await konteksti.newPage();
const virheet = [];
sivu.on('pageerror', (e) => virheet.push(e.message));

const tilasto = { tutka: 0, tavut: 0, ennuste: 0, muut: 0 };
if (arg.toista || arg.tallenna) {
  const hak = arg.toista || arg.tallenna;
  mkdirSync(hak, { recursive: true });
  await sivu.route((u) => tallennettava(u.toString()), async (reitti) => {
    const url = reitti.request().url();
    const tiedosto = join(hak, avain(url));
    if (arg.toista) {
      if (!existsSync(tiedosto)) return reitti.fulfill({ status: 404, body: '' });
      const meta = JSON.parse(readFileSync(tiedosto + '.json', 'utf8'));
      return reitti.fulfill({ status: meta.status, headers: meta.headers, body: readFileSync(tiedosto) });
    }
    const vastaus = await reitti.fetch();
    const runko = await vastaus.body();
    writeFileSync(tiedosto, runko);
    writeFileSync(tiedosto + '.json', JSON.stringify({ url, status: vastaus.status(), headers: vastaus.headers() }));
    return reitti.fulfill({ response: vastaus, body: runko });
  });
}
sivu.on('response', async (r) => {
  const u = r.url();
  if (/openwms\.fmi\.fi.*request=GetMap/.test(u) && !/width=1&/.test(u)) {
    tilasto.tutka++;
    try { tilasto.tavut += (await r.body()).length; } catch (e) {}
  } else if (/\/api\/sade/.test(u)) tilasto.ennuste++;
});

await sivu.addInitScript(() => { try { localStorage.setItem('fs_opastus', '1'); } catch (e) {} });
await sivu.goto(osoite + '/?perf=1', { waitUntil: 'domcontentloaded' });
await sivu.waitForFunction(() => document.getElementById('loading')?.classList.contains('hidden'), null, { timeout: 60000 });

await sivu.evaluate(({ lat, lng, z }) => { FS.State.map.setView([lat, lng], z, { animate: false }); }, { lat, lng, z });
await sivu.waitForTimeout(1500);
await sivu.evaluate(() => _sadetilaAseta(true));
if (arg.aika) {
  await sivu.evaluate((iso) => {
    const t = new Date(iso).getTime(), ajat = FS.State._tlTimes || [];
    let paras = -1, ero = Infinity;
    for (let i = 0; i < ajat.length; i++) { const e = Math.abs(new Date(ajat[i]).getTime() - t); if (e < ero) { ero = e; paras = i; } }
    if (paras >= 0) _tlValitseIdx(paras);
  }, arg.aika);
}
const odota = +(arg.odota || 12000);
await sivu.waitForTimeout(odota);

const tila = await sivu.evaluate(() => {
  const leima = document.getElementById('tutka-aika');
  return { leima: leima ? leima.textContent : null, zoom: FS.State.map.getZoom(), valittu: FS.State.valittuMs ? new Date(FS.State.valittuMs).toISOString() : null };
});
if (arg.kuva) await sivu.screenshot({ path: arg.kuva });

/* FMI:n oma kuva samasta rajauksesta: oletustyyli, sama aika. Totuus
   jota vasten terävyys ja sävy luetaan (CLAUDE.md "Mittaa totuutta
   vastaan"). */
if (arg.kuva && arg.aika) {
  const r = await sivu.evaluate(() => {
    const b = FS.State.map.ml.getBounds();
    const m = (lo, la) => [lo * 20037508.34 / 180, Math.log(Math.tan(Math.PI / 4 + la * Math.PI / 360)) * 6378137];
    const a = m(b.getWest(), b.getSouth()), c = m(b.getEast(), b.getNorth());
    return { bbox: [a[0], a[1], c[0], c[1]].map(Math.round).join(','), w: innerWidth, h: innerHeight };
  });
  const url = 'https://openwms.fmi.fi/geoserver/Radar/wms?service=WMS&version=1.3.0&request=GetMap'
    + '&layers=radar_finland_cappi_dbzh&styles=&format=image/png&transparent=true&crs=EPSG:3857'
    + '&bbox=' + r.bbox + '&width=' + r.w + '&height=' + r.h + '&time=' + new Date(arg.aika).toISOString().slice(0, 19) + '.000Z';
  try {
    const v = await fetch(url);
    writeFileSync(arg.kuva.replace(/\.png$/, '') + '-fmi.png', Buffer.from(await v.arrayBuffer()));
  } catch (e) { console.log('FMI-vertailukuva ei onnistunut:', e.message); }
}

console.log(JSON.stringify({ ...tila, ...tilasto, virheet }, null, 1));
await selain.close();
process.exit(virheet.length ? 1 : 0);
