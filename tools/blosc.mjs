/* ------------------------------------------------------------------
   BLOSC (v1) JA LZ4 -PURKU PUHTAANA JAVASCRIPTINÄ (docs/aallot.md V5).

   Copernicus Marinen ARCO-Zarr-varastot on pakattu bloscilla (lz4,
   tavusekoitus). Rakentaja lukee ne Actionsissa, eikä sille tarvita
   natiivia riippuvuutta: muoto on pieni ja vakaa.

   Blosc-otsake (16 tavua): versio, lz-versio, liput, alkion koko,
   purettu koko, lohkon koko, pakattu koko. Liput: 0x01 tavusekoitus,
   0x02 pakkaamaton (memcpy), 0x04 bittisekoitus, 0x10 lohkoja ei ole
   jaettu alkion tavuihin, bitit 5–7 pakkaaja (1 = lz4). Pakatussa
   muodossa otsaketta seuraa lohkojen alut (int32), ja lohko on joko yksi
   virta tai alkion koon verran virtoja (kunkin edessä int32 pituus).
   Tuettu: lz4 ja pakkaamaton, tavusekoitus. Muu heittää virheen.    */

/* LZ4-lohko (ei kehystä): `src[a..b)` → `dst[o..o+n)`. */
function lz4(src, a, b, dst, o, n) {
  let ip = a, op = o;
  const loppu = o + n;
  while (ip < b) {
    const token = src[ip++];
    let lit = token >>> 4;
    if (lit === 15) { let x; do { x = src[ip++]; lit += x; } while (x === 255); }
    for (let k = 0; k < lit; k++) dst[op++] = src[ip++];
    if (ip >= b) break;
    const off = src[ip] | (src[ip + 1] << 8);
    ip += 2;
    if (!off) throw new Error('lz4: nollasiirto');
    let m = token & 15;
    if (m === 15) { let x; do { x = src[ip++]; m += x; } while (x === 255); }
    m += 4;
    let r = op - off;
    if (r < o) throw new Error('lz4: siirto ulos');
    for (let k = 0; k < m; k++) dst[op++] = dst[r++];
  }
  if (op !== loppu) throw new Error(`lz4: purettu ${op - o} / ${n} tavua`);
}

/* Tavusekoituksen purku: alkion tavut b ovat peräkkäin (b·nel …). */
function sekoituksesta(src, a, n, ts, dst, o) {
  const nel = Math.floor(n / ts);
  for (let b = 0; b < ts; b++) {
    const s0 = a + b * nel;
    for (let e = 0; e < nel; e++) dst[o + e * ts + b] = src[s0 + e];
  }
  for (let k = nel * ts; k < n; k++) dst[o + k] = src[a + k];
}

/* Blosc-pala → Uint8Array (purettu). */
export function bloscPura(buf) {
  const src = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const dv = new DataView(src.buffer, src.byteOffset, src.byteLength);
  const liput = src[2], ts = src[3] || 1;
  const nbytes = dv.getUint32(4, true), blocksize = dv.getUint32(8, true);
  const ulos = new Uint8Array(nbytes);
  if (liput & 0x02) { ulos.set(src.subarray(16, 16 + nbytes)); return ulos; }
  if (liput & 0x04) throw new Error('blosc: bittisekoitusta ei tueta');
  const pakkaaja = (liput >> 5) & 7;
  if (pakkaaja !== 1) throw new Error('blosc: pakkaaja ' + pakkaaja + ' ei tuettu (vain lz4)');
  const sekoitus = !!(liput & 0x01), eiJakoa = !!(liput & 0x10);
  const nblocks = Math.ceil(nbytes / blocksize);
  const tmp = sekoitus ? new Uint8Array(blocksize) : null;
  for (let i = 0; i < nblocks; i++) {
    const alku = dv.getInt32(16 + 4 * i, true);
    const bsize = i === nblocks - 1 && nbytes % blocksize ? nbytes % blocksize : blocksize;
    const viimeinenVajaa = bsize !== blocksize;
    const nsplit = !eiJakoa && !viimeinenVajaa && ts <= 16 && blocksize / ts >= 128 ? ts : 1;
    const neb = bsize / nsplit;
    const kohde = sekoitus ? tmp : ulos, ko = sekoitus ? 0 : i * blocksize;
    let p = alku;
    for (let s = 0; s < nsplit; s++) {
      const cb = dv.getInt32(p, true);
      p += 4;
      if (cb === neb) kohde.set(src.subarray(p, p + neb), ko + s * neb);
      else lz4(src, p, p + cb, kohde, ko + s * neb, neb);
      p += cb;
    }
    if (sekoitus) sekoituksesta(tmp, 0, bsize, ts, ulos, i * blocksize);
  }
  return ulos;
}
