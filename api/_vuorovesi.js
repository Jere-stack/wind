/* VUOROVESI ASEMILTA JA ALUEELLISESTA MALLISTA (docs/aallot.md V6, T2).
 * Apumoduuli, ei reitti: `api/vesi.js?vuorovesi=…` (funktioita on 12,
 * ja se on Vercelin katto — CLAUDE.md).
 *
 *   ?vuorovesi=noaa&asema=<7 numeroa>   NOAA CO-OPS:n asemaennuste
 *   ?vuorovesi=kartverket&lat=&lng=    Kartverketin paikkaennuste (Norja)
 *   ?vuorovesi=malli&lat=&lng=         Copernicus Marine: Luoteis-Euroopan
 *                                      hyllymeri 1,5 km ja Biskaja–Iberia
 *                                      0,027° — vedenkorkeus (vuorovesi ja
 *                                      myrskynousu yhdessä)
 *   ?vesitaso=sarja&lat=&lng=          Itämeren vedenkorkeus pisteessä
 *                                      (Copernicus Marine BAL PHY 2 km),
 *                                      −48 h … mallin loppu (~+9 vrk)
 *   ?vesitaso=kentta&t=<ISO|ms>        sama kenttänä koko Itämerelle sen
 *                                      2 tunnin palan tunneille joka
 *                                      sisältää hetken t (vuorovesikartta)
 *
 * VASTAUS AINA SAMASSA MUODOSSA: { lahde, nimi?, km?, t0, dt, h: [m],
 * aariarvot?: [{ t, h, tyyppi: 'H'|'L' }] }. Korkeus on metreinä
 * PAIKALLISESTA KESKIVEDESTÄ: sarjan keskiarvo vähennetään, koska NOAA:n
 * aliasemilla on vain MLLW-taso ja mallin pinnankorkeus sisältää
 * keskimääräisen dynaamisen topografian (docs/aallot.md 8.2: vaihteluväli
 * −5,2 … +3,8 m). Ajat UTC-millisekunteina. Lähde jolla ei ole tätä
 * paikkaa on `{ error: 'no data' }` HTTP 200:lla (kuten muut proxyt);
 * ylävirran virhe heittää ja on 502.
 *
 * NOAA: pääasemat antavat tuntisarjan (MLLW), aliasemat vain nousu- ja
 * laskuveden hetket (`interval=hilo`; tuntisarja vastaa "No Predictions
 * data was found", mitattu 15.10.). Aliaseman tuntisarja interpoloidaan
 * puolikosinilla ääriarvojen välillä — sama tapa jolla taulukoita on
 * aina luettu. Ääriarvot pyydetään molemmille: hetki on minuutin tarkka.
 *
 * KARTVERKET: paikkahaku (`tide_request=locationdata`) laskee ennusteen
 * mihin tahansa rannikon pisteeseen lähimmän aseman viiveellä ja
 * kertoimella; vastauksen `obsname` on asema.
 *
 * MALLI: ARCO-Zarrin `geoChunked`-varasto (palat [~3 700 h, 16, 16]),
 * joten pisteen koko sarja on yksi pala (blosc-lz4, `tools/blosc.mjs`).
 * Keskiarvo lasketaan palan kaikista tunneista (~5 kk). Osoite luetaan
 * STAC:sta kuten rakentajassa (`tools/copernicus.mjs`): versio vaihtuu.
 *
 * ITÄMERI (vesitaso, 16.10.): vuorovesi on Itämerellä muutamia senttejä,
 * joten vuorovesikartta näyttää siellä vedenkorkeuden (`sla`, "sea surface
 * height above sea level"). Se on jo keskivedestä: mitattuna FMI:n 14
 * mareografia vasten 72 h (16.10.) ero teoreettiseen keskiveteen on
 * −0,3 … +3 cm ja Perämerellä +7 … +13 cm, tunneittainen hajonta 2–6 cm.
 * Siksi keskiarvoa EI vähennetä (`keskiarvo: false`); palan keskiarvo
 * (~8 kk, kausivaihtelu mukana) olisi siirtänyt nollaa 1–9 cm. Kenttä
 * luetaan `timeChunked`-varastosta, jonka pala on 2 tuntia koko alueelta
 * ([2, 774, 763], ~1 Mt): palvelin harventaa sen 3 × 3 solun meren
 * keskiarvoiksi (255 × 258, cm Int16, ~23 kt gzip kahdelle tunnille). */
import { bloscPura } from '../tools/blosc.mjs';

const H = 3600e3;
const NOAA = 'https://api.tidesandcurrents.noaa.gov/api/prod/datagetter';
const KARTVERKET = 'https://vannstand.kartverket.no/tideapi.php';
const STAC = 'https://stac.marine.copernicus.eu/metadata';
const MENNYT_H = 24, TULEVA_VRK = 8;

export const MALLIT = [
  { perhe: 'cmems_nws', tuote: 'NWSHELF_ANALYSISFORECAST_PHY_004_013', aineisto: 'cmems_mod_nws_phy-ssh_anfc_1.5km-2D_PT1H-i',
    ala: [46.0, 62.75, -16.0, 13.0], maxKm: 3 },
  { perhe: 'cmems_ibi', tuote: 'IBI_ANALYSISFORECAST_PHY_005_001', aineisto: 'cmems_mod_ibi_phy_anfc_0.027deg-2D_PT1H-m',
    ala: [26.0, 56.0, -19.0, 5.0], maxKm: 4 },
];
/* Itämeren vedenkorkeus: ei vuorovesilähde vaan vuorovesikartan Itämeri
   (ks. tiedoston alku). Ala on mallin hila; asiakas painottaa sen
   länsireunan (Skagerrak) EOT20:een (`BalVesi.paino`). */
export const ITAMERI = { perhe: 'cmems_bal', tuote: 'BALTICSEA_ANALYSISFORECAST_PHY_003_006',
  aineisto: 'cmems_mod_bal_phy_anfc_PT1H-i', ala: [53.0, 65.9, 9.04, 30.21], maxKm: 4,
  muuttuja: 'sla', keskiarvo: false, mennytH: 48 };
const KENTTA_HARVENNUS = 3;

class Tyhja extends Error {}

/* `puuttuvaOk`: Zarr ei kirjoita palaa joka on kokonaan täyttöarvoa (maa),
   ja S3 vastaa puuttuvaan avaimeen 403:lla eikä 404:llä kun listausta ei
   sallita (mitattu 15.10. Pampuksen kohdalla). Vain datapaloille. */
async function hae(url, tyyppi = 'json', ms = 12000, puuttuvaOk = false) {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms), headers: { 'User-Agent': 'FoilSpot (foilspot)' } });
  if (r.status === 404 || (puuttuvaOk && r.status === 403)) return null;
  if (!r.ok) throw new Error('HTTP ' + r.status + ' ' + url.slice(0, 80));
  return tyyppi === 'json' ? r.json() : tyyppi === 'teksti' ? r.text() : new Uint8Array(await r.arrayBuffer());
}

/* Keskiarvo pois: sama paikallinen keskivesi kaikille lähteille. */
function keskiarvoPois(h, ka) {
  let s = 0, n = 0;
  for (const v of h) if (Number.isFinite(v)) { s += v; n++; }
  const k = ka != null ? ka : (n ? s / n : 0);
  return { h: h.map(v => (Number.isFinite(v) ? Math.round((v - k) * 1000) / 1000 : null)), k };
}

const noaaAika = (t) => Date.parse(t.replace(' ', 'T') + ':00Z');
const pv = (ms) => new Date(ms).toISOString().slice(0, 10).replace(/-/g, '');

export async function noaa(asema) {
  if (!/^\d{7}$/.test(asema || '')) throw new Tyhja();
  const alku = Date.now() - MENNYT_H * H, loppu = Date.now() + TULEVA_VRK * 86400e3;
  const osoite = (iv) => `${NOAA}?begin_date=${pv(alku)}&end_date=${pv(loppu)}&station=${asema}&product=predictions`
    + `&datum=MLLW&time_zone=gmt&interval=${iv}&units=metric&application=FoilSpot&format=json`;
  const [tunnit, hilo] = await Promise.all([hae(osoite('h')), hae(osoite('hilo'))]);
  const aa = hilo && Array.isArray(hilo.predictions)
    ? hilo.predictions.map(p => ({ t: noaaAika(p.t), h: parseFloat(p.v), tyyppi: /^H/.test(p.type) ? 'H' : 'L' }))
      .filter(a => Number.isFinite(a.t) && Number.isFinite(a.h))
    : [];
  let t0, h;
  if (tunnit && Array.isArray(tunnit.predictions) && tunnit.predictions.length > 24) {
    t0 = noaaAika(tunnit.predictions[0].t);
    h = tunnit.predictions.map(p => parseFloat(p.v));
  } else if (aa.length >= 4) {
    /* Aliasema: puolikosini ääriarvojen välillä tasatunneille. */
    t0 = Math.ceil(aa[0].t / H) * H;
    h = [];
    for (let t = t0, i = 0; t <= aa[aa.length - 1].t; t += H) {
      while (i < aa.length - 2 && aa[i + 1].t < t) i++;
      const a = aa[i], b = aa[i + 1], x = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t)));
      h.push((a.h + b.h) / 2 + (a.h - b.h) / 2 * Math.cos(Math.PI * x));
    }
  } else throw new Tyhja();
  const { h: hh, k } = keskiarvoPois(h);
  return { lahde: 'noaa', asema, t0, dt: H, h: hh,
    aariarvot: aa.map(a => ({ t: a.t, h: Math.round((a.h - k) * 1000) / 1000, tyyppi: a.tyyppi })) };
}

export async function kartverket(lat, lng) {
  if (!(lat >= 57 && lat <= 81.5 && lng >= 3 && lng <= 33)) throw new Tyhja();
  const iso = (ms) => new Date(ms).toISOString().slice(0, 16);
  const alku = Math.floor((Date.now() - MENNYT_H * H) / H) * H, loppu = alku + (MENNYT_H + TULEVA_VRK * 24) * H;
  const xml = await hae(`${KARTVERKET}?tide_request=locationdata&lat=${lat.toFixed(4)}&lon=${lng.toFixed(4)}`
    + `&datatype=PRE&refcode=MSL&fromtime=${iso(alku)}&totime=${iso(loppu)}&interval=60&lang=en&dst=0&tzone=0`, 'teksti');
  if (!xml || /<error/i.test(xml)) throw new Tyhja();
  const loc = /<location\s([^>]*)\/>/.exec(xml);
  const attr = (s, n) => { const m = new RegExp(n + '="([^"]*)"').exec(s || ''); return m ? m[1] : null; };
  const tulos = [], re = /<waterlevel value="([-\d.]+)" time="([^"]+)"/g;
  let m;
  while ((m = re.exec(xml)) !== null) tulos.push({ t: Date.parse(m[2]), h: parseFloat(m[1]) / 100 });
  if (tulos.length < 24) throw new Tyhja();
  const { h } = keskiarvoPois(tulos.map(x => x.h));
  return { lahde: 'kartverket', nimi: attr(loc && loc[1], 'obsname') || attr(loc && loc[1], 'name'),
    viive: parseFloat(attr(loc && loc[1], 'delay')) || 0, kerroin: parseFloat(attr(loc && loc[1], 'factor')) || 1,
    t0: tulos[0].t, dt: H, h };
}

/* -- Copernicus-mallin vedenkorkeus ---------------------------------- */
const _varastot = new Map();
function tyypitetty(u8, dtype) {
  const b = u8.buffer.slice(u8.byteOffset, u8.byteOffset + u8.byteLength);
  if (dtype === '<f4') return new Float32Array(b);
  if (dtype === '<f8') return new Float64Array(b);
  if (dtype === '<i2') return new Int16Array(b);
  if (dtype === '<i4') return new Int32Array(b);
  if (dtype === '<i8') return Float64Array.from(new BigInt64Array(b), x => Number(x));
  throw new Error('dtype ' + dtype);
}
async function taulu(href, meta, nimi) {
  const a = meta[nimi + '/.zarray'];
  const nc = Math.ceil(a.shape[0] / a.chunks[0]), ulos = new Float64Array(a.shape[0]);
  let o = 0;
  for (let c = 0; c < nc; c++) {
    const x = tyypitetty(bloscPura(await hae(`${href}/${nimi}/${c}`, 'bin', 20000)), a.dtype);
    ulos.set(x.subarray(0, Math.min(x.length, ulos.length - o)), o);
    o += x.length;
  }
  return ulos;
}
/* Varasto muistiin lämpimän funktion ajaksi (enintään 6 h): STAC, metatieto,
   aika ja koordinaatit ovat yhteiset kaikille pisteille. */
async function varasto(M) {
  const v = _varastot.get(M.perhe);
  if (v && Date.now() - v.ts < 6 * H) return v;
  const p = await hae(`${STAC}/${M.tuote}/product.stac.json`);
  const hrefit = ((p && p.links) || []).filter(l => l.rel === 'item' && l.href.startsWith(M.aineisto + '_'))
    .map(l => l.href).sort().reverse();
  let geo = null, aikaHref = null;
  for (const h of hrefit) {
    const d = await hae(`${STAC}/${M.tuote}/${h}`);
    const pr = (d && d.properties) || {};
    if (pr.admp_in_preparation || !d.assets || !d.assets.geoChunked) continue;
    geo = d.assets.geoChunked.href;
    /* Kenttä (koko alue yhdellä hetkellä) luetaan aikapaloista. */
    aikaHref = d.assets.timeChunked ? d.assets.timeChunked.href : null;
    break;
  }
  if (!geo) throw new Error(M.perhe + ': ei geoChunked-varastoa');
  const meta = (await hae(geo + '/.zmetadata')).metadata;
  /* Itämeren varasto on "days since 1900-01-01" (pelkkä päivä). */
  const yks = /^(seconds|minutes|hours|days) since (.+)$/.exec((meta['time/.zattrs'] || {}).units || '');
  if (!yks) throw new Error(M.perhe + ': aikayksikkö');
  let alku = yks[2].trim().replace(' ', 'T');
  if (alku.indexOf('T') < 0) alku += 'T00:00:00';
  const e = Date.parse(alku.replace(/(\+00:00|Z)?$/, 'Z'));
  const kerroin = { seconds: 1e3, minutes: 6e4, hours: H, days: 24 * H }[yks[1]];
  const aika = (await taulu(geo, meta, 'time')).map(x => e + x * kerroin);
  const lat = await taulu(geo, meta, 'latitude'), lon = await taulu(geo, meta, 'longitude');
  const uusi = { ts: Date.now(), geo, meta, aika, lat, lon, aikaHref, aikaMeta: null };
  _varastot.set(M.perhe, uusi);
  return uusi;
}
function lahin(a, x) {
  let lo = 0, hi = a.length - 1;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (a[m] <= x) lo = m; else hi = m; }
  return Math.abs(a[lo] - x) <= Math.abs(a[hi] - x) ? lo : hi;
}

export async function malli(lat, lng) {
  const M = MALLIT.find(m => lat >= m.ala[0] && lat <= m.ala[1] && lng >= m.ala[2] && lng <= m.ala[3]);
  if (!M) throw new Tyhja();
  return sarja(M, lat, lng);
}

/* Pisteen sarja mallin aikasarjapaloista: lähin meren solmu `maxKm`:n
   sisältä, −`mennytH` … aika-akselin loppu. */
async function sarja(M, lat, lng) {
  const V = await varasto(M);
  const mu = M.muuttuja || 'zos';
  const za = V.meta[mu + '/.zarray'], zt = V.meta[mu + '/.zattrs'] || {};
  const [Ct, Cy, Cx] = za.chunks, sep = za.dimension_separator || '.';
  const sk = zt.scale_factor != null ? zt.scale_factor : 1, so = zt.add_offset != null ? zt.add_offset : 0;
  const j0 = lahin(V.lat, lat), i0 = lahin(V.lon, lng);
  /* Ehdokkaat 2 solmun säteellä etäisyysjärjestyksessä; ensimmäinen jolla
     on dataa (maa on täyttöarvoa). */
  const ehd = [];
  for (let dj = -2; dj <= 2; dj++) for (let di = -2; di <= 2; di++) {
    const j = j0 + dj, i = i0 + di;
    if (j < 0 || i < 0 || j >= V.lat.length || i >= V.lon.length) continue;
    const km = Math.hypot((V.lat[j] - lat) * 111.2, (V.lon[i] - lng) * 111.2 * Math.cos(lat * Math.PI / 180));
    if (km <= M.maxKm) ehd.push({ j, i, km });
  }
  ehd.sort((a, b) => a.km - b.km);
  if (!ehd.length) throw new Tyhja();
  const nyt = Date.now();
  const ta = lahin(V.aika, nyt - (M.mennytH || MENNYT_H) * H);
  /* Viimeinen hetki jolla datan kuuluisi olla: aika-akselin loppu. */
  const tb = V.aika.length - 1;
  const palat = new Map();
  const pala = async (ct, cy, cx) => {
    const k = ct + sep + cy + sep + cx;
    if (!palat.has(k)) {
      const raaka = await hae(`${V.geo}/${mu}/${k}`, 'bin', 20000, true);
      palat.set(k, raaka ? tyypitetty(bloscPura(raaka), za.dtype) : null);
    }
    return palat.get(k);
  };
  for (const e of ehd) {
    const cy = Math.floor(e.j / Cy), cx = Math.floor(e.i / Cx), oy = e.j - cy * Cy, ox = e.i - cx * Cx;
    const sarja = [], kaikki = [];
    for (let ct = Math.floor(ta / Ct); ct <= Math.floor(tb / Ct); ct++) {
      const x = await pala(ct, cy, cx);
      for (let k = 0; k < Ct; k++) {
        const ti = ct * Ct + k;
        if (ti > tb) break;
        const q = x ? x[(k * Cy + oy) * Cx + ox] : za.fill_value;
        const v = q === za.fill_value || q == null ? NaN : q * sk + so;
        if (Number.isFinite(v)) kaikki.push(v);
        if (ti >= ta) sarja.push(v);
      }
    }
    if (kaikki.length < 24 * 7 || sarja.filter(Number.isFinite).length < 48) continue;
    /* Keskiarvo palan kaikista tunneista: kuukausien keskivesi, ei vain
       näytetyn jakson (jakson keskiarvo siirtäisi nollaa myrskynousun
       mukana). Itämeren `sla` on jo keskivedestä (`keskiarvo: false`). */
    const ka = M.keskiarvo === false ? 0 : kaikki.reduce((s, v) => s + v, 0) / kaikki.length;
    while (sarja.length && !Number.isFinite(sarja[sarja.length - 1])) sarja.pop();
    const { h } = keskiarvoPois(sarja, ka);
    return { lahde: M.perhe, km: Math.round(e.km * 10) / 10, t0: V.aika[ta], dt: H, h };
  }
  throw new Tyhja();
}

/* Itämeren vedenkorkeus kenttänä: hetken t sisältävän aikapalan tunnit
   harvennettuina (ks. tiedoston alku). Arvot cm Int16 base64:nä, rivi
   etelästä pohjoiseen; `puuttuva` on maa. */
export async function itameriKentta(tMs) {
  const M = ITAMERI, V = await varasto(M);
  if (!V.aikaHref) throw new Error(M.perhe + ': ei timeChunked-varastoa');
  if (!V.aikaMeta) V.aikaMeta = (await hae(V.aikaHref + '/.zmetadata')).metadata;
  const mu = M.muuttuja;
  const za = V.aikaMeta[mu + '/.zarray'], zt = V.aikaMeta[mu + '/.zattrs'] || {};
  const [Ct, Cy, Cx] = za.chunks, sep = za.dimension_separator || '.';
  const NY = V.lat.length, NX = V.lon.length;
  if (Cy < NY || Cx < NX) throw new Error(M.perhe + ': aikapala ei kata aluetta');
  const ti = lahin(V.aika, tMs);
  if (Math.abs(V.aika[ti] - tMs) > H / 2) throw new Tyhja();
  const ct = Math.floor(ti / Ct);
  const raaka = await hae(`${V.aikaHref}/${mu}/${ct}${sep}0${sep}0`, 'bin', 20000, true);
  if (!raaka) throw new Tyhja();
  const x = tyypitetty(bloscPura(raaka), za.dtype);
  const sk = zt.scale_factor != null ? zt.scale_factor : 1, so = zt.add_offset != null ? zt.add_offset : 0;
  const F = KENTTA_HARVENNUS, ny = Math.ceil(NY / F), nx = Math.ceil(NX / F);
  const n = Math.min(Ct, V.aika.length - ct * Ct), h = [];
  for (let k = 0; k < n; k++) {
    const o = new Int16Array(ny * nx), pohja = k * NY * NX;
    let meri = 0;
    for (let r = 0; r < ny; r++) for (let c = 0; c < nx; c++) {
      let s = 0, m = 0;
      for (let j = r * F; j < Math.min(NY, r * F + F); j++) {
        for (let i = c * F; i < Math.min(NX, c * F + F); i++) {
          const q = x[pohja + j * NX + i];
          if (q === za.fill_value || q == null || !Number.isFinite(q)) continue;
          s += q * sk + so; m++;
        }
      }
      if (m) { o[r * nx + c] = Math.max(-32767, Math.min(32767, Math.round(s / m * 100))); meri++; }
      else o[r * nx + c] = -32768;
    }
    if (!meri) break;
    h.push(Buffer.from(o.buffer).toString('base64'));
  }
  if (!h.length) throw new Tyhja();
  const dla = (V.lat[NY - 1] - V.lat[0]) / (NY - 1), dlo = (V.lon[NX - 1] - V.lon[0]) / (NX - 1);
  return { lahde: M.perhe, t0: V.aika[ct * Ct], dt: H, n: h.length, nx, ny,
    la0: +(V.lat[0] + dla * (F - 1) / 2).toFixed(6), lo0: +(V.lon[0] + dlo * (F - 1) / 2).toFixed(6),
    dla: +(dla * F).toFixed(8), dlo: +(dlo * F).toFixed(8), yks: 0.01, puuttuva: -32768, h };
}

export async function vesitaso(q) {
  try {
    if (q.vesitaso === 'kentta') {
      const raaka = String(q.t || '');
      const t = /^\d+$/.test(raaka) ? +raaka : Date.parse(raaka);
      if (!Number.isFinite(t)) return { virhe: 't required', tila: 400 };
      return { tulos: await itameriKentta(Math.round(t / H) * H), ika: 3600 };
    }
    if (q.vesitaso === 'sarja') {
      const lat = parseFloat(q.lat), lng = parseFloat(q.lng), A = ITAMERI.ala;
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { virhe: 'lat/lng required', tila: 400 };
      if (!(lat >= A[0] && lat <= A[1] && lng >= A[2] && lng <= A[3])) throw new Tyhja();
      return { tulos: await sarja(ITAMERI, lat, lng), ika: 3600 };
    }
    return { virhe: 'unknown vesitaso mode', tila: 400 };
  } catch (e) {
    if (e instanceof Tyhja) return { tulos: { error: 'no data' }, ika: 3600 };
    throw e;
  }
}

export async function vuorovesi(q) {
  try {
    if (q.vuorovesi === 'noaa') return { tulos: await noaa(String(q.asema || '')), ika: 6 * 3600 };
    const lat = parseFloat(q.lat), lng = parseFloat(q.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return { virhe: 'lat/lng required', tila: 400 };
    if (q.vuorovesi === 'kartverket') return { tulos: await kartverket(lat, lng), ika: 6 * 3600 };
    if (q.vuorovesi === 'malli') return { tulos: await malli(lat, lng), ika: 3600 };
    return { virhe: 'unknown vuorovesi mode', tila: 400 };
  } catch (e) {
    if (e instanceof Tyhja) return { tulos: { error: 'no data' }, ika: 3600 };
    throw e;
  }
}
