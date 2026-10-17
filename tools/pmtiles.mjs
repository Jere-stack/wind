/* PMTiles v3 -arkiston kirjoitus ja luku (docs/pohjakartta.md, toteutus).
 *
 * Vain Noden omia moduuleita. Kirjoittaja tekee saman kuin Protomapsin
 * `pmtiles`-työkalu: laatat Hilbert-järjestyksessä (`clustered`), saman
 * sisällön laatat yhteen kopioon (meri ja sisämaa ovat tuhansia
 * identtisiä laattoja), peräkkäiset samat yhdeksi ajoksi, ja juuri-
 * hakemisto mahtuu otsakkeen kanssa ensimmäiseen 16 384 tavuun —
 * muuten loput lehtihakemistoiksi. Selaimen lukija on `index.html`:n
 * `Pmtiles`; sama hakemistomuoto, joten jos muutat tätä, muuta sitä.
 *
 * Spesifikaatio: github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md */

import { gzipSync, gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { openSync, writeSync, closeSync, readFileSync } from 'node:fs';

export const TYYPPI = { mvt: 1, png: 2, jpeg: 3, webp: 4 };

/* Laatan tunniste: kaikkien matalampien tasojen laatat + Hilbert-indeksi
   tasolla z (spesifikaation `zxy_to_tileid`). */
export function laattaId(z, x, y) {
  let acc = 0;
  for (let t = 0; t < z; t++) acc += 4 ** t;
  const n = 2 ** z;
  let d = 0;
  for (let s = n / 2; s >= 1; s /= 2) {
    const rx = (x & s) > 0 ? 1 : 0, ry = (y & s) > 0 ? 1 : 0;
    d += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) { x = s - 1 - x; y = s - 1 - y; }
      const t = x; x = y; y = t;
    }
  }
  return acc + d;
}

function varint(t, v) { while (v >= 0x80) { t.push((v % 128) | 0x80); v = Math.floor(v / 128); } t.push(v); }
function lueVarint(b, o) { let v = 0, s = 0, c; do { c = b[o.i++]; v += (c & 0x7f) * 2 ** s; s += 7; } while (c & 0x80); return v; }

function hakemisto(rivit) {
  const t = [];
  varint(t, rivit.length);
  let ed = 0;
  for (const r of rivit) { varint(t, r.id - ed); ed = r.id; }
  for (const r of rivit) varint(t, r.ajo);
  for (const r of rivit) varint(t, r.pituus);
  for (let i = 0; i < rivit.length; i++) {
    const r = rivit[i], e = rivit[i - 1];
    varint(t, i > 0 && r.siirto === e.siirto + e.pituus ? 0 : r.siirto + 1);
  }
  return gzipSync(Buffer.from(t), { level: 9 });
}

export function lueHakemisto(b) {
  b = gunzipSync(b);
  const o = { i: 0 }, n = lueVarint(b, o), rivit = [];
  let id = 0;
  for (let i = 0; i < n; i++) { id += lueVarint(b, o); rivit.push({ id }); }
  for (const r of rivit) r.ajo = lueVarint(b, o);
  for (const r of rivit) r.pituus = lueVarint(b, o);
  for (let i = 0; i < n; i++) {
    const v = lueVarint(b, o);
    rivit[i].siirto = v === 0 && i > 0 ? rivit[i - 1].siirto + rivit[i - 1].pituus : v - 1;
  }
  return rivit;
}

/* Juuri ja lehdet: lehden koko kasvaa kunnes juuri mahtuu. */
function hakemistot(rivit) {
  const juuri = hakemisto(rivit);
  if (juuri.length <= 16384 - 127) return { juuri, lehdet: Buffer.alloc(0) };
  for (let koko = 4096; ; koko *= 2) {
    const juuriRivit = [], osat = [];
    let siirto = 0;
    for (let i = 0; i < rivit.length; i += koko) {
      const lehti = hakemisto(rivit.slice(i, i + koko));
      juuriRivit.push({ id: rivit[i].id, ajo: 0, pituus: lehti.length, siirto });
      osat.push(lehti); siirto += lehti.length;
    }
    const j = hakemisto(juuriRivit);
    if (j.length <= 16384 - 127) return { juuri: j, lehdet: Buffer.concat(osat) };
  }
}

/* laatat: [{ z, x, y, data: Buffer }] valmiiksi pakattuina (`pakkaus`).
   Tyhjää laattaa ei kirjoiteta: lukija antaa silloin "ei laattaa". */
export function kirjoita(polku, laatat, o) {
  const rivit = laatat.map(l => ({ id: laattaId(l.z, l.x, l.y), data: l.data, z: l.z }))
    .sort((a, b) => a.id - b.id);
  const sisallot = new Map(), osat = [];
  let siirto = 0, ajot = [];
  for (const r of rivit) {
    const h = createHash('sha1').update(r.data).digest('hex');
    let s = sisallot.get(h);
    if (!s) { s = { siirto, pituus: r.data.length }; sisallot.set(h, s); osat.push(r.data); siirto += r.data.length; }
    const e = ajot[ajot.length - 1];
    if (e && e.id + e.ajo === r.id && e.siirto === s.siirto) e.ajo++;
    else ajot.push({ id: r.id, ajo: 1, pituus: s.pituus, siirto: s.siirto });
  }
  const { juuri, lehdet } = hakemistot(ajot);
  const meta = gzipSync(Buffer.from(JSON.stringify(o.meta || {})), { level: 9 });
  const h = Buffer.alloc(127);
  h.write('PMTiles', 0, 'ascii'); h[7] = 3;
  let p = 127;
  const u64 = (i, v) => h.writeBigUInt64LE(BigInt(v), i);
  u64(8, p); u64(16, juuri.length); p += juuri.length;
  u64(24, p); u64(32, meta.length); p += meta.length;
  u64(40, p); u64(48, lehdet.length); p += lehdet.length;
  u64(56, p); u64(64, siirto);
  u64(72, rivit.length); u64(80, ajot.length); u64(88, sisallot.size);
  h[96] = 1; h[97] = 2; h[98] = o.pakkaus === 'gzip' ? 2 : 1; h[99] = TYYPPI[o.tyyppi];
  let zmin = 99, zmax = 0;
  for (const r of rivit) { if (r.z < zmin) zmin = r.z; if (r.z > zmax) zmax = r.z; }
  h[100] = zmin; h[101] = zmax;
  const [w, s, e, n] = o.rajat || [-180, -85, 180, 85];
  h.writeInt32LE(Math.round(w * 1e7), 102); h.writeInt32LE(Math.round(s * 1e7), 106);
  h.writeInt32LE(Math.round(e * 1e7), 110); h.writeInt32LE(Math.round(n * 1e7), 114);
  h[118] = o.keskiZ || 4;
  h.writeInt32LE(Math.round((o.keski || [0, 0])[0] * 1e7), 119);
  h.writeInt32LE(Math.round((o.keski || [0, 0])[1] * 1e7), 123);
  const fd = openSync(polku, 'w');
  for (const b of [h, juuri, meta, lehdet, ...osat]) writeSync(fd, b);
  closeSync(fd);
  return { tavut: p + siirto, laatat: rivit.length, ajot: ajot.length, sisallot: sisallot.size };
}

/* Luku tiedostosta (tarkistus rakennuksen lopussa). */
export function avaa(polku) {
  const b = readFileSync(polku);
  const u64 = i => Number(b.readBigUInt64LE(i));
  const h = { juuri: u64(8), juuriP: u64(16), lehdet: u64(40), data: u64(56), min: b[100], max: b[101], tyyppi: b[99] };
  const hae = (rivit, id) => {
    let a = 0, z = rivit.length - 1;
    while (a <= z) { const m = (a + z) >> 1; if (rivit[m].id < id) a = m + 1; else if (rivit[m].id > id) z = m - 1; else return rivit[m]; }
    const r = rivit[z];
    if (r && (r.ajo === 0 || id - r.id < r.ajo)) return r;
    return null;
  };
  return {
    otsake: h,
    laatta(z, x, y) {
      const id = laattaId(z, x, y);
      let rivit = lueHakemisto(b.subarray(h.juuri, h.juuri + h.juuriP));
      for (let k = 0; k < 4; k++) {
        const r = hae(rivit, id);
        if (!r) return null;
        if (r.ajo > 0) return b.subarray(h.data + r.siirto, h.data + r.siirto + r.pituus);
        rivit = lueHakemisto(b.subarray(h.lehdet + r.siirto, h.lehdet + r.siirto + r.pituus));
      }
      return null;
    },
  };
}
