/* ------------------------------------------------------------------
   AALTOPYRAMIDI MÄRISTÄ LÄHDEPISTEISTÄ (docs/aallot.md, V1).

   Sama laattamuoto kuin tuulella (`pyramidi.mjs`: 21 × 21 solmua,
   otsake 40 tavua, tasot [aika][y][x], palat ajassa), mutta lähde on
   LUETTELO MÄRISTÄ PISTEISTÄ eikä säännöllinen hila: ECMWF WAM on
   O1280-hilassa (rivien pituus vaihtelee), FMI:n WAM säännöllisessä.
   Molemmat tuodaan tänne samana listana (leveys, pituus, indeksi
   lähdekenttään), joten tasojen suodatus, rannan käsittely ja
   kirjoitus ovat yksi koodi.

   KOLME DATATASOA AIKAA KOHTI:
     1. merkitsevä aallonkorkeus NELIÖJUUREEN KOODATTUNA:
        q = 254 · √(Hs / 16 m). Askel 1,7 cm 0,3 m:ssä, 3,1 cm 1 m:ssä,
        7 cm 5 m:ssä, katto 16 m (mitattu maailman maksimi 12,6–14,7 m;
        vanha 0,03 m:n lineaarinen katkesi 7,62 m:iin).
     2. suunta MISTÄ 2° askelin.
     3. jakso 0,1 s askelin (keskijakso, luettelon `jakso`).
   255 = ei arvoa (maa tai ekstrapoloinnin ulkopuoli).

   KAKSI AIKARIIPPUMATONTA TASOA (liput tavussa 39):
     bitti 0  PAINO 0..255 = 0..1 (alueellinen perhe, kuten tuulella).
     bitti 1  ETÄISYYS lähimpään mallin märkään pisteeseen, km
              neliöjuurena: q = 16 · √km (0 … 252 km), 255 = kauempana.
              Asiakas häivyttää kentän sen mukaan (`luottoKm`).

   RANTA (docs/aallot.md 5.4). Taso on LAATIKKOSUODIN: solmun arvo on
   sen laatikkoon (± puoli askelta) osuvien märkien pisteiden keskiarvo
   (korkeus ja jakso keskiarvona, suunta yksikkövektoreista). Solmu
   jonka laatikossa ei ole märkää pistettä saa arvon VAIN jos lähin märkä
   piste on alle 1,3 × `luottoKm` päässä: arvo on märkien naapurien
   keskiarvo kerros kerrokselta (sama naapurisääntö kuin selaimen
   entisellä ekstrapoloinnilla). `luottoKm` = max(mallin solmuväli,
   0,75 × tason askel): hienoimmalla tasolla matka tulee mallin
   tarkkuudesta (ECMWF 9 km → 12 km), karkealla tason omasta välistä,
   jotta rannan vesi ei jää bilineaarisen interpoloinnin alla tyhjäksi.
   Kauempana kenttä on tyhjä, eikä avomeren aaltoa jatketa lahden
   perukoille. Piirto rajaa rannan pohjakartan rantaviivalla.        */

import { gzipSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const N = 21;
export const TYHJA = 255;
export const OTSAKE = 40;
export const HS_KATTO = 16;
export const SUUNTA_ASKEL = 2;
export const JAKSO_ASKEL = 0.1;
export const LUOTTO_KERROIN = 1.3;
export const SEKOITUS_KM = 50;
/* ALUEELLISEN PERHEEN VALTA (V5): kuiva solmu peittää alemmat vain
   omalla vesialueellaan. Kun pohjamallilla (ECMWF WAM) on solmussa merta
   (märkä piste `POHJA_MERI_KM`:n sisällä; O1280:n pisteväli on
   leveyspiirin suunnassa 10–12 km, joten 5 km jätti meren keskelle
   reikiä) eikä perheellä omaa märkää
   pistettä `VALTA_KM`:n sisällä, kyse on vesialueesta jota alueellinen
   malli ei sisällä — Marmaranmeri Mustanmeren laatikossa, Laatokka
   Itämeren, Kielin lahti Luoteis-Euroopan — ja solmun paino on 0. Rannan
   maa ja rannikon järvet (Bodom 9 km rannasta) jäävät perheen maaksi. */
export const VALTA_KM = 15;
export const POHJA_MERI_KM = 7.5;
const KM_ASTE = 111.2;

export function koodaaHs(h) {
  if (!Number.isFinite(h)) return TYHJA;
  if (h <= 0) return 0;
  return Math.min(254, Math.round(254 * Math.sqrt(Math.min(h, HS_KATTO) / HS_KATTO)));
}
export function puraHs(q) { return q === TYHJA ? NaN : HS_KATTO * (q / 254) * (q / 254); }
export function koodaaKm(km) {
  if (!(km >= 0)) return TYHJA;
  const q = Math.round(16 * Math.sqrt(km));
  return q > 254 ? TYHJA : q;
}
export function puraKm(q) { return q === TYHJA ? Infinity : (q / 16) * (q / 16); }
function koodaaSuunta(d) {
  if (!Number.isFinite(d)) return TYHJA;
  const q = Math.round((((d % 360) + 360) % 360) / SUUNTA_ASKEL);
  return q >= 360 / SUUNTA_ASKEL ? 0 : q;
}
function koodaaJakso(t) {
  if (!Number.isFinite(t) || t <= 0) return TYHJA;
  const q = Math.round(t / JAKSO_ASKEL);
  return q > 254 ? 254 : q;
}
export function smoothstep(s) { const x = s < 0 ? 0 : (s > 1 ? 1 : s); return x * x * (3 - 2 * x); }

/* Tason luottoetäisyys km: täysi luotto tähän asti, nolla 1,3-kertaisena. */
export function luottoKm(askel, natiiviKm) { return Math.max(natiiviKm, 0.75 * askel * KM_ASTE); }

/* SUUNNAN SINI JA KOSINI TAULUKOSTA (0,5°): 4,7 M pistettä joka hetkellä
   ilman trigonometriaa. Puolen asteen kvantisointi on alle tason 2°:n. */
const _SIN = new Float32Array(721), _COS = new Float32Array(721);
for (let i = 0; i <= 720; i++) { const r = i * 0.5 * Math.PI / 180; _SIN[i] = Math.sin(r); _COS[i] = Math.cos(r); }

/* POHJAN MERI RASTERINA (0,02°): solu on merta kun pohjamallin märkä
   piste on `POHJA_MERI_KM`:n sisällä. Rakennetaan kerran ECMWF WAM:n
   märistä pisteistä alueellisten perheiden yhteiselle alueelle, ja
   `luoAaltoPyramidi` kysyy sitä alueellisen tason kuivilta solmuilta
   (`valta`). */
export function pohjaMeri(lahde, alue, askel = 0.02) {
  const la0 = alue.lat[0], lo0 = alue.lng[0];
  const ny = Math.round((alue.lat[1] - la0) / askel) + 1, nx = Math.round((alue.lng[1] - lo0) / askel) + 1;
  const r = new Uint8Array(ny * nx), R = POHJA_MERI_KM;
  const dj = Math.ceil(R / (askel * KM_ASTE)) + 1;
  let n = 0;
  for (let p = 0; p < lahde.n; p++) {
    const la = lahde.lat[p], lo = lahde.lon[p];
    if (la < alue.lat[0] - 0.2 || la > alue.lat[1] + 0.2 || lo < alue.lng[0] - 0.4 || lo > alue.lng[1] + 0.4) continue;
    n++;
    const ky = Math.max(0.05, Math.cos(la * Math.PI / 180));
    const di = Math.ceil(R / (askel * KM_ASTE * ky)) + 1;
    const jc = Math.round((la - la0) / askel), ic = Math.round((lo - lo0) / askel);
    for (let j = Math.max(0, jc - dj); j <= Math.min(ny - 1, jc + dj); j++) {
      const dy = (la0 + j * askel - la) * KM_ASTE;
      if (dy > R || dy < -R) continue;
      for (let i = Math.max(0, ic - di); i <= Math.min(nx - 1, ic + di); i++) {
        const dx = (lo0 + i * askel - lo) * KM_ASTE * ky;
        if (dx * dx + dy * dy <= R * R) r[j * nx + i] = 1;
      }
    }
  }
  return {
    pisteita: n,
    meri(lat, lng) {
      const j = Math.round((lat - la0) / askel), i = Math.round((lng - lo0) / askel);
      return j >= 0 && j < ny && i >= 0 && i < nx && r[j * nx + i] === 1;
    },
  };
}

/* ------------------------------------------------------------------
   Pyramidin rakenne (aikariippumaton). `lahde` = { n, lat, lon, natiiviKm }
   (Float32Arrayt märille pisteille, pituus −180…180), `tasot` =
   [{ id, askel, lat: [a, b], lng: [a, b], paino?: (lat, lng) => 0..1 }].
   `pohjaMeri` (valinnainen, `pohjaMeri()`): painollisen tason kuivat
   solmut väistyvät toisen vesialueen kohdalla (`VALTA_KM`).
   Palauttaa pyramidin; `kirjoitaAaltoHetki` täyttää sen aika-askeleet. */
export function luoAaltoPyramidi(tasot, lahde, nt, log = () => {}, { pohjaMeri: PM = null } = {}) {
  const pyr = { tasot: [], lahde, nt };
  for (const t of tasot) {
    const s = t.askel, span = (N - 1) * s;
    const glob = t.lng[0] <= -180 && t.lng[1] >= 180;
    const la0T = Math.floor(t.lat[0] / span + 1e-9) * span;
    const lo0T = glob ? -180 : Math.floor(t.lng[0] / span + 1e-9) * span;
    const ruutuRivit = Math.ceil((t.lat[1] - la0T) / span - 1e-9);
    const ruutuSar = glob ? Math.round(360 / span) : Math.ceil((t.lng[1] - lo0T) / span - 1e-9);
    const jA = Math.round(la0T / s), jB = jA + ruutuRivit * (N - 1);
    const iA = Math.round(lo0T / s);
    const NI = Math.round(360 / s);
    const WI = glob ? NI : ruutuSar * (N - 1) + 1, WJ = jB - jA + 1;
    const W = WI * WJ;
    const sar = (ii) => {
      if (glob) return ((ii - iA) % NI + NI) % NI;
      const c = ii - iA;
      return c >= 0 && c < WI ? c : -1;
    };
    const lK = luottoKm(s, lahde.natiiviKm), R = LUOTTO_KERROIN * lK;
    /* Valta tarvitsee oman veden etäisyyden `VALTA_KM`:iin asti. */
    const valta = t.paino && PM ? PM : null;
    const Rd = valta ? Math.max(R, VALTA_KM) : R;
    /* Lähdepiste -> solmu (laatikko = lähin solmu), ja märkien määrä. */
    const pnode = new Int32Array(lahde.n);
    const cnt = new Uint32Array(W);
    const dmin = new Float32Array(W).fill(Infinity);
    for (let p = 0; p < lahde.n; p++) {
      const la = lahde.lat[p], lo = lahde.lon[p];
      const jj = Math.round(la / s), ii = Math.round(lo / s);
      const c = sar(ii);
      if (jj < jA || jj > jB || c < 0) { pnode[p] = -1; continue; }
      const w = (jj - jA) * WI + c;
      pnode[p] = w;
      cnt[w]++;
    }
    /* ETÄISYYS LÄHIMPÄÄN MÄRKÄÄN PISTEESEEN, solmuille R:n (valtaa
       laskettaessa `Rd`:n) sisällä (tasa-alueinen likiarvo, pituusaste
       kiertää). Kauempana Infinity. */
    const rj = Math.ceil(Rd / (s * KM_ASTE)) + 1;
    for (let p = 0; p < lahde.n; p++) {
      const la = lahde.lat[p], lo = lahde.lon[p];
      const jj = Math.round(la / s), ii = Math.round(lo / s);
      const ky = Math.max(0.02, Math.cos(la * Math.PI / 180));
      const ri = Math.min(glob ? Math.floor(NI / 2) : WI, Math.ceil(Rd / (s * KM_ASTE * ky)) + 1);
      for (let j = jj - rj; j <= jj + rj; j++) {
        if (j < jA || j > jB) continue;
        const dy = (j * s - la) * KM_ASTE;
        if (Math.abs(dy) > Rd) continue;
        const kx = KM_ASTE * Math.max(0.02, Math.cos((la + j * s) / 2 * Math.PI / 180));
        const rivi = (j - jA) * WI;
        for (let i = ii - ri; i <= ii + ri; i++) {
          const c = sar(i);
          if (c < 0) continue;
          let dl = i * s - lo;
          if (glob) dl = ((dl + 540) % 360) - 180;
          const dx = dl * kx;
          const d2 = dx * dx + dy * dy;
          if (d2 > Rd * Rd) continue;
          const w = rivi + c;
          const d = Math.sqrt(d2);
          if (d < dmin[w]) dmin[w] = d;
        }
      }
    }
    /* Ekstrapoloinnin kierrokset: ei-märkä solmu R:n sisällä saa arvon
       jo arvon saaneista naapureistaan (kohtisuora 1, vino 0,7). Rakenne
       on aikariippumaton, joten naapurilistat lasketaan kerran. */
    const tila = new Uint8Array(W);          /* 1 = märkä, 2 = ekstrapoloitu, 0 = tyhjä */
    for (let w = 0; w < W; w++) if (cnt[w] > 0) tila[w] = 1;
    const naapuri = (w, dj, di) => {
      const j = Math.floor(w / WI) + dj; let c = w % WI + di;
      if (j < 0 || j >= WJ) return -1;
      if (glob) c = (c % NI + NI) % NI; else if (c < 0 || c >= WI) return -1;
      return j * WI + c;
    };
    const kierrokset = [];
    let reuna = [];
    for (let w = 0; w < W; w++) if (!tila[w] && dmin[w] < R) reuna.push(w);
    const odottaa = new Uint8Array(W);
    for (const w of reuna) odottaa[w] = 1;
    for (let k = 0; k < 64 && reuna.length; k++) {
      const solmut = [], naap = [], pain = [], alku = [0];
      const seur = [];
      for (const w of reuna) {
        let n0 = naap.length;
        for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
          if (!dj && !di) continue;
          const q = naapuri(w, dj, di);
          if (q < 0 || !tila[q]) continue;
          naap.push(q); pain.push(dj && di ? 0.7 : 1);
        }
        if (naap.length > n0) { solmut.push(w); alku.push(naap.length); }
        else seur.push(w);
      }
      if (!solmut.length) break;
      for (const w of solmut) { tila[w] = 2; odottaa[w] = 0; }
      kierrokset.push({ solmut: Int32Array.from(solmut), alku: Int32Array.from(alku),
                        naap: Int32Array.from(naap), pain: Float32Array.from(pain) });
      reuna = seur;
    }
    /* Laatat: ne joissa on märkä tai ekstrapoloitu solmu, ja painollisella
       tasolla myös kuivat joiden jossakin VESISOLMUSSA perheen paino on
       alle 1 (väistyvä solmu, avomeren reunan häivytys, alueen
       ulkopuoli). Puuttuva laatta on asiakkaalle perheen kuiva maa joka
       peittää alemmat täysin (`AaltoVarasto._olematon`), joten kohta jossa
       perhe ei saa peittää toista vettä tarvitsee laatan. Vesisolmu on
       pohjan meri (`pohjaMeri`); ilman sitä jokainen solmu. */
    const vaistyy = (w, la, lo) => valta && w >= 0 && tila[w] !== 1 && !(dmin[w] <= VALTA_KM) && valta.meri(la, lo);
    const vesi = PM ? (la, lo) => PM.meri(la, lo) : () => true;
    const ruudut = [];
    let marat = 0, ekstr = 0, vaistoja = 0, kuivia = 0;
    for (let w = 0; w < W; w++) { if (tila[w] === 1) marat++; else if (tila[w] === 2) ekstr++; }
    for (let ry = 0; ry < ruutuRivit; ry++) {
      for (let rx = 0; rx < ruutuSar; rx++) {
        const lat0 = +(la0T + ry * span).toFixed(4), lng0 = +(lo0T + rx * span).toFixed(4);
        const solmu = new Int32Array(N * N).fill(-1);
        let onko = false;
        for (let iy = 0; iy < N; iy++) {
          const j = jA + ry * (N - 1) + iy;
          for (let ix = 0; ix < N; ix++) {
            const c = sar(iA + rx * (N - 1) + ix);
            if (c < 0) continue;
            const w = (j - jA) * WI + c;
            solmu[iy * N + ix] = w;
            if (tila[w]) onko = true;
          }
        }
        if (!onko) {
          if (!t.paino) continue;
          let v = false;
          for (let k = 0; k < N * N && !v; k++) {
            const la = lat0 + Math.floor(k / N) * s, lo = lng0 + (k % N) * s;
            if (vesi(la, lo)) v = vaistyy(solmu[k], la, lo) || Math.round(255 * t.paino(la, lo)) < 255;
          }
          if (!v) continue;
          kuivia++;
        }
        const r = { lat0, lng0, solmu,
          nop: new Uint8Array(nt * N * N).fill(TYHJA),
          suunta: new Uint8Array(nt * N * N).fill(TYHJA),
          puuska: new Uint8Array(nt * N * N).fill(TYHJA),
          etaisyys: new Uint8Array(N * N), paino: null, pakko: !onko };
        for (let k = 0; k < N * N; k++) {
          const w = solmu[k];
          r.etaisyys[k] = w >= 0 && tila[w] ? koodaaKm(cnt[w] > 0 ? Math.min(dmin[w], lK) : dmin[w]) : TYHJA;
        }
        if (t.paino) {
          r.paino = new Uint8Array(N * N);
          for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
            const k = iy * N + ix, la = lat0 + iy * s, lo = lng0 + ix * s;
            if (vaistyy(solmu[k], la, lo)) { r.paino[k] = 0; vaistoja++; continue; }
            r.paino[k] = Math.round(255 * t.paino(la, lo));
          }
        }
        ruudut.push(r);
      }
    }
    pyr.tasot.push({ ...t, span, glob, WI, WJ, W, pnode, tila, kierrokset, ruudut, luottoKm: lK,
      sH: new Float32Array(W), n: new Uint32Array(W), sS: new Float32Array(W), sC: new Float32Array(W),
      sT: new Float32Array(W), nT: new Uint32Array(W) });
    log(`  ${t.id}: askel ${s}°, solmuja märkiä ${marat}, ekstrapoloituja ${ekstr} (${kierrokset.length} kierrosta, `
      + `${R.toFixed(1)} km), laattoja ${ruudut.length}`
      + (valta ? `, väistyviä solmuja ${vaistoja}` : '') + (kuivia ? `, kuivia laattoja ${kuivia}` : ''));
  }
  return pyr;
}

/* Yksi hetki pyramidiin. `arvot` = { hs, dir, tp } Float32Arrayt MÄRILLE
   PISTEILLE (sama järjestys kuin `lahde`); NaN = ei arvoa. Synkroninen:
   tasojen summat ovat jaettuja. */
export function kirjoitaAaltoHetki(pyr, ti, arvot) {
  const { hs, dir, tp } = arvot, n = pyr.lahde.n;
  const pohja = ti * N * N;
  for (const L of pyr.tasot) {
    const { sH, sS, sC, sT, nT, pnode, W } = L;
    const cN = L.n;
    sH.fill(0); cN.fill(0); sS.fill(0); sC.fill(0); sT.fill(0); nT.fill(0);
    for (let p = 0; p < n; p++) {
      const w = pnode[p];
      if (w < 0) continue;
      const h = hs[p];
      if (!(h === h)) continue;
      sH[w] += h; cN[w]++;
      const d = dir ? dir[p] : NaN;
      if (d === d) { const q = Math.round(((d % 360) + 360) % 360 * 2); sS[w] += _SIN[q]; sC[w] += _COS[q]; }
      const t = tp ? tp[p] : NaN;
      if (t === t && t > 0) { sT[w] += t; nT[w]++; }
    }
    /* Märkien solmujen keskiarvot (summat korvataan arvoilla paikallaan:
       sH = korkeus, sS/sC = yksikkövektori, sT = jakso). */
    for (let w = 0; w < W; w++) {
      const c = cN[w];
      if (!c) continue;
      sH[w] /= c;
      const m = Math.hypot(sS[w], sC[w]);
      if (m > 1e-6) { sS[w] /= m; sC[w] /= m; } else { sS[w] = NaN; sC[w] = NaN; }
      sT[w] = nT[w] ? sT[w] / nT[w] : NaN;
    }
    /* Ekstrapolointi kierroksittain. `cN` > 0 = solmulla on arvo. */
    for (const kr of L.kierrokset) {
      const { solmut, alku, naap, pain } = kr;
      for (let a = 0; a < solmut.length; a++) {
        let ws = 0, h = 0, ss = 0, cc = 0, tt = 0, wt = 0;
        for (let b = alku[a]; b < alku[a + 1]; b++) {
          const q = naap[b];
          if (!cN[q]) continue;
          const pw = pain[b];
          ws += pw; h += sH[q] * pw;
          if (sS[q] === sS[q]) { ss += sS[q] * pw; cc += sC[q] * pw; }
          if (sT[q] === sT[q]) { tt += sT[q] * pw; wt += pw; }
        }
        const w = solmut[a];
        if (!ws) continue;
        sH[w] = h / ws;
        const m = Math.hypot(ss, cc);
        sS[w] = m > 1e-6 ? ss / m : NaN; sC[w] = m > 1e-6 ? cc / m : NaN;
        sT[w] = wt ? tt / wt : NaN;
        cN[w] = 1;
      }
    }
    for (const r of L.ruudut) {
      const S = r.solmu;
      for (let k = 0; k < N * N; k++) {
        const w = S[k];
        if (w < 0 || !cN[w]) continue;
        const o = pohja + k;
        r.nop[o] = koodaaHs(sH[w]);
        if (sS[w] === sS[w]) r.suunta[o] = koodaaSuunta(Math.atan2(sS[w], sC[w]) * 180 / Math.PI);
        r.puuska[o] = koodaaJakso(sT[w]);
      }
    }
    /* Seuraavaa hetkeä varten: ekstrapoloitujen merkintä pois. */
    for (const kr of L.kierrokset) for (let a = 0; a < kr.solmut.length; a++) cN[kr.solmut[a]] = 0;
  }
}

/* Puuttuneet hetket pois akselilta (kuten `pyramidi.tiivistaAika`). */
export function tiivistaAaltoAika(pyr, sailyta) {
  const L = N * N;
  for (const t of pyr.tasot) for (const r of t.ruudut) for (const k of ['nop', 'suunta', 'puuska']) {
    const a = r[k], b = new Uint8Array(sailyta.length * L);
    sailyta.forEach((ti, uusi) => b.set(a.subarray(ti * L, (ti + 1) * L), uusi * L));
    r[k] = b;
  }
  pyr.nt = sailyta.length;
}

/* Laatta tavuiksi: otsake (sama kuin tuulella, versiotavu 2), kolme
   datatasoa palan askelille, paino ja etäisyys. */
function laattaTavuiksi(taso, r, nt, t0Ms, i0) {
  const koko = nt * N * N, o = i0 * N * N;
  const lisa = (r.paino ? N * N : 0) + N * N;
  const runko = new Uint8Array(OTSAKE + 3 * koko + lisa);
  const dv = new DataView(runko.buffer);
  runko.set(new TextEncoder().encode('FSTILE\0'), 0);
  dv.setUint8(7, 2);
  dv.setFloat32(8, taso.askel, true);
  dv.setFloat32(12, r.lat0, true);
  dv.setFloat32(16, r.lng0, true);
  dv.setUint16(20, N, true);
  dv.setUint16(22, N, true);
  dv.setUint16(24, nt, true);
  dv.setFloat64(26, t0Ms, true);
  dv.setUint32(34, 3600, true);
  dv.setUint8(38, TYHJA);
  dv.setUint8(39, (r.paino ? 1 : 0) | 2);
  runko.set(r.nop.subarray(o, o + koko), OTSAKE);
  runko.set(r.suunta.subarray(o, o + koko), OTSAKE + koko);
  runko.set(r.puuska.subarray(o, o + koko), OTSAKE + 2 * koko);
  let p = OTSAKE + 3 * koko;
  if (r.paino) { runko.set(r.paino, p); p += N * N; }
  runko.set(r.etaisyys, p);
  return runko;
}

/* Tasot levylle paloina (`pala` askelta, yksi päällekkäin seuraavan
   kanssa, kuten tuulella). Palauttaa luettelon rivit ja tavut. */
export function kirjoitaAaltoTasot(pyr, ajatMs, ulos, pala, lisat, log = () => {}) {
  const rivit = [];
  let tavut = 0;
  for (const t of pyr.tasot) {
    /* TASON OMA AKSELI: `loppuMs` rajaa tason akselin alkuosaan (ECMWF:n
       0,25° +7 vrk:een; sen jälkeen asiakas lukee 0,5°:tä). */
    const ajatT = t.loppuMs ? ajatMs.filter(x => x <= t.loppuMs) : ajatMs;
    const nt = ajatT.length;
    const P = pala > 0 ? Math.max(1, Math.ceil((nt - 1) / pala)) : 1;
    mkdirSync(join(ulos, t.id), { recursive: true });
    const laatat = [];
    let tt = 0;
    for (const r of t.ruudut) {
      let onko = false;
      for (let i = 0; i < r.nop.length; i++) if (r.nop[i] !== TYHJA) { onko = true; break; }
      /* Kuiva laatta kirjoitetaan kun sen puute peittäisi toista vettä
         (`luoAaltoPyramidi`, `pakko`). Painoton laatta kirjoitetaan myös:
         puuttuvana se olisi täysi peitto. */
      if (!onko && !r.pakko) continue;
      for (let c = 0; c < P; c++) {
        const i0 = pala > 0 ? c * pala : 0;
        const n = pala > 0 ? Math.min(i0 + pala, nt - 1) - i0 + 1 : nt;
        const pakattu = gzipSync(laattaTavuiksi(t, r, n, ajatT[i0], i0), { level: 9 });
        const nimi = pala > 0 ? `${r.lat0}_${r.lng0}.p${c}.bin.gz` : `${r.lat0}_${r.lng0}.bin.gz`;
        writeFileSync(join(ulos, t.id, nimi), pakattu);
        tt += pakattu.length;
      }
      laatat.push([r.lat0, r.lng0]);
    }
    tavut += tt;
    log(`  ${t.id}: ${laatat.length}/${t.ruudut.length} laattaa` + (pala > 0 ? ` × ${P} palaa` : '') + `, ${(tt / 1e6).toFixed(1)} MB`);
    rivit.push({ id: t.id, askel: t.askel, span: t.span, lat: t.lat, lng: t.lng, laatat,
      ...(pala > 0 ? { pala } : {}), ajat: ajatT, nt, t0: ajatT[0], dtSek: 3600,
      luottoKm: +t.luottoKm.toFixed(2), natiiviKm: pyr.lahde.natiiviKm,
      ...(t.paino ? { paino: true } : {}), ...lisat });
  }
  return { rivit, tavut };
}

/* SAVUTESTI TUNNETUILLA PISTEILLÄ (docs/aallot.md 5.2): `marat` pitää
   olla märkiä tai ekstrapoloituja hienoimmalla kattavalla tasolla,
   `kuivat` tyhjiä. Kaatuu jos rivit ovat väärin päin, pituusasteen
   origo on väärä tai maski on käänteinen. */
export function tarkistaPisteet(pyr, marat, kuivat) {
  const viat = [];
  const tilaPisteessa = (la, lo) => {
    for (const t of pyr.tasot.slice().sort((a, b) => a.askel - b.askel)) {
      if (la < t.lat[0] || la > t.lat[1]) continue;
      if (!t.glob && (lo < t.lng[0] || lo > t.lng[1])) continue;
      const jj = Math.round(la / t.askel), ii = Math.round(lo / t.askel);
      const jA = Math.round(Math.floor(t.lat[0] / t.span + 1e-9) * t.span / t.askel);
      const iA = t.glob ? Math.round(-180 / t.askel) : Math.round(Math.floor(t.lng[0] / t.span + 1e-9) * t.span / t.askel);
      const NI = Math.round(360 / t.askel);
      const c = t.glob ? ((ii - iA) % NI + NI) % NI : ii - iA;
      if (jj - jA < 0 || jj - jA >= t.WJ || c < 0 || c >= t.WI) continue;
      return t.tila[(jj - jA) * t.WI + c];
    }
    return null;
  };
  for (const [nimi, la, lo] of marat) { const v = tilaPisteessa(la, lo); if (v == null || v === 0) viat.push(`${nimi} kuiva (pitäisi olla märkä)`); }
  for (const [nimi, la, lo] of kuivat) { const v = tilaPisteessa(la, lo); if (v) viat.push(`${nimi} märkä (pitäisi olla kuiva)`); }
  return viat;
}

/* AVOMEREN REUNAN PAINO (docs/aallot.md 4.7). Alueellinen aaltomalli
   sekoittuu alempaan vain sieltä missä sen ALUE PÄÄTTYY MERELLÄ: tuulen
   tapa (paino datan reunasta) sekoittaisi jokaisen rannan, koska ranta on
   aaltomallin datan reuna. `siemenet` = märät pisteet lähdehilan
   uloimmalla rivillä tai sarakkeella; paino = smoothstep(etäisyys
   lähimpään siemeneen / 50 km) koko alueella, alueen ulkopuolella 0. */
export function avomeriPaino(siemenet, alue, km = SEKOITUS_KM) {
  const lok = new Map(), L = 1;
  for (const [la, lo] of siemenet) {
    const a = Math.floor(la / L) + ':' + Math.floor(lo / L);
    if (!lok.has(a)) lok.set(a, []);
    lok.get(a).push([la, lo]);
  }
  return (lat, lng) => {
    if (lat < alue.lat[0] || lat > alue.lat[1] || lng < alue.lng[0] || lng > alue.lng[1]) return 0;
    const ky = Math.cos(lat * Math.PI / 180);
    let d2 = Infinity;
    const ly = Math.floor(lat / L), lx = Math.floor(lng / L);
    for (let dy = -1; dy <= 1; dy++) for (let dx = -2; dx <= 2; dx++) {
      for (const [a, b] of (lok.get((ly + dy) + ':' + (lx + dx)) || [])) {
        const y = (a - lat) * KM_ASTE, x = (b - lng) * KM_ASTE * ky;
        const d = x * x + y * y;
        if (d < d2) d2 = d;
      }
    }
    return smoothstep(Math.sqrt(d2) / km);
  };
}
