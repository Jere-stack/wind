/* GIF-PURKAJA — vain se mita Mellstenin kuvaaja tarvitsee (api/_mellsten.js).
 *
 * Alaviiva nimen alussa: Vercel ei tee tasta omaa funktiota (katto on 12
 * funktiota, CLAUDE.md), eika vite.config.js:n dev-reititys tarjoile sita.
 *
 * Ensimmainen kuva, globaali tai paikallinen varitaulu, LZW ja lomitus.
 * Palauttaa varitaulun INDEKSIT eika RGB:ta: kuvaajan tulkinta vertaa
 * varitaulun arvoja, ja indeksitaulukko on neljasosa RGBA:sta.
 *
 * Oma purkaja eika npm-paketti, koska keraaja (tools/havainnot.mjs) ajetaan
 * ilman `npm ci`:ta — vain Noden omat moduulit. Tarkistettu Chromiumin
 * purkua vasten: 0 / 48 000 pikselia eri. */

export function puraGif(puskuri) {
  var b = puskuri instanceof Uint8Array ? puskuri : new Uint8Array(puskuri);
  var tunniste = String.fromCharCode(b[0], b[1], b[2], b[3], b[4], b[5]);
  if (tunniste !== 'GIF87a' && tunniste !== 'GIF89a') throw new Error('ei GIF-kuva');
  var p = 6;
  function u16() { var v = b[p] | (b[p + 1] << 8); p += 2; return v; }
  function taulu(koko) {
    var t = [];
    for (var i = 0; i < koko; i++) { t.push([b[p], b[p + 1], b[p + 2]]); p += 3; }
    return t;
  }
  var w = u16(), h = u16();
  var pk = b[p]; p += 3;
  var paletti = (pk & 0x80) ? taulu(1 << ((pk & 7) + 1)) : null;

  for (;;) {
    if (p >= b.length) throw new Error('GIF: ei kuvaa');
    var lohko = b[p++];
    if (lohko === 0x3B) throw new Error('GIF: ei kuvaa');
    if (lohko === 0x21) {                       /* laajennus: ohitetaan */
      p++;
      for (var n = b[p++]; n; n = b[p++]) p += n;
      continue;
    }
    if (lohko !== 0x2C) throw new Error('GIF: tuntematon lohko ' + lohko);
    var x0 = u16(), y0 = u16(), iw = u16(), ih = u16();
    var ipk = b[p++];
    if (ipk & 0x80) paletti = taulu(1 << ((ipk & 7) + 1));
    if (!paletti) throw new Error('GIF: ei varitaulua');
    var lomitus = !!(ipk & 0x40);
    var minKoodi = b[p++];

    /* Alilohkot yhdeksi jonoksi */
    var osat = [], yht = 0;
    for (var m = b[p++]; m; m = b[p++]) { osat.push(b.subarray(p, p + m)); yht += m; p += m; }
    var data = new Uint8Array(yht), o = 0;
    for (var i = 0; i < osat.length; i++) { data.set(osat[i], o); o += osat[i].length; }

    /* LZW */
    var tyhjennys = 1 << minKoodi, loppu = tyhjennys + 1;
    var ulos = new Uint8Array(iw * ih);
    var etu = new Int32Array(4096), mer = new Uint8Array(4096), pino = new Uint8Array(4096);
    for (var k = 0; k < tyhjennys; k++) { etu[k] = -1; mer[k] = k; }
    var koko = minKoodi + 1, seur = loppu + 1, edel = -1, u = 0;
    var bitit = 0, nbit = 0, bp = 0;
    while (u < ulos.length) {
      while (nbit < koko && bp < data.length) { bitit |= data[bp++] << nbit; nbit += 8; }
      if (nbit < koko) break;
      var koodi = bitit & ((1 << koko) - 1);
      bitit >>= koko; nbit -= koko;
      if (koodi === tyhjennys) { koko = minKoodi + 1; seur = loppu + 1; edel = -1; continue; }
      if (koodi === loppu) break;
      var kk = koodi;
      if (koodi >= seur) {                       /* KwKwK */
        if (edel < 0) throw new Error('GIF: LZW');
        kk = edel;
      }
      var np = 0;
      while (kk >= 0) { pino[np++] = mer[kk]; kk = etu[kk]; }
      var ens = pino[np - 1];
      for (var j = np - 1; j >= 0 && u < ulos.length; j--) ulos[u++] = pino[j];
      if (koodi >= seur && u < ulos.length) ulos[u++] = ens;
      if (edel >= 0 && seur < 4096) {
        etu[seur] = edel; mer[seur] = ens; seur++;
        if (seur === (1 << koko) && koko < 12) koko++;
      }
      edel = koodi;
    }

    /* Kankaalle, lomitus auki */
    var ind = new Uint8Array(w * h);
    var rivit = [];
    if (lomitus) {
      var vaiheet = [[0, 8], [4, 8], [2, 4], [1, 2]];
      for (var v = 0; v < vaiheet.length; v++) for (var y = vaiheet[v][0]; y < ih; y += vaiheet[v][1]) rivit.push(y);
    } else {
      for (var yy = 0; yy < ih; yy++) rivit.push(yy);
    }
    for (var r = 0; r < ih; r++) {
      var ky = rivit[r] + y0;
      if (ky >= h) continue;
      for (var x = 0; x < iw; x++) if (x + x0 < w) ind[ky * w + x + x0] = ulos[r * iw + x];
    }
    return { w: w, h: h, paletti: paletti, ind: ind };
  }
}
