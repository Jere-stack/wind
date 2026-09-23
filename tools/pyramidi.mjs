/* ------------------------------------------------------------------
   Säännöllisestä hilasta SUODATETTU laattapyramidi.

   Jokainen malli (ECMWF, FMI HARMONIE, MET Nordic) tuodaan ensin
   säännölliseksi lat/lon-hilaksi, ja siitä kirjoitetaan kaikki saman
   mallin tasot. Karkeampi taso on hienomman SUODATETTU versio eikä sen
   satunnainen otos:

   MIKSI SUODATUS. Tasot tehtiin ennen poimimalla lähin lähdepiste
   (`srcIdx`), ja mitattuna sama ECMWF-malli näytti Helsingin seudulla
   eri luvun eri zoomilla: 1° vs 0,5° keskimäärin 1,01 m/s, 0,5° vs
   0,25° 0,66 m/s (docs/mallit.md). Se on laskostumista — rannikolla
   poiminta osuu satunnaisesti maalle tai merelle. Suodatettuna karkea
   taso on hienon keskiarvo, ja zoomatessa kenttä TARKENTUU eikä vaihdu.

   SUODIN on laatikko jonka leveys on tason askel: lähdepisteet joiden
   etäisyys solmusta on alle puoli askelta saavat painon 1 ja täsmälleen
   puolen askeleen päässä olevat 0,5. Nopeus keskiarvona, suunta
   yksikkövektoreista — sama sääntö kuin sovelluksen paikkainterpoloinnissa
   (`Saalaatat._paikassa`), jotta rakentaja ja asiakas eivät tee samasta
   asiasta kahta eri laskua.

   PAINOKANAVA. Alueellisen mallin laatoissa on neljäs taso: solmun
   paino 0..255 (= 0..1), joka on smoothstep etäisyydestä mallin
   käyttöalueen reunaan 50 km matkalla. Asiakas sekoittaa mallit sillä:
   reunalla paino on 0, joten alempi malli jatkuu täsmälleen samasta
   arvosta — rajaa ei ole (docs/mallit.md, "Rajojen hyppy").        */

export const N = 21;              /* pistettä laatan sivulla */
export const TYHJA = 255;
export const NOP_ASKEL = 0.2;
export const SUUNTA_ASKEL = 2;
export const OTSAKE = 40;
export const SEKOITUS_KM = 50;

export function pakkaaNopeus(v) {
  if (!Number.isFinite(v)) return TYHJA;
  const q = Math.round(v / NOP_ASKEL);
  return q < 0 ? 0 : (q > 254 ? 254 : q);
}
export function pakkaaSuunta(d) {
  if (!Number.isFinite(d)) return TYHJA;
  const q = Math.round(((d % 360) + 360) % 360 / SUUNTA_ASKEL);
  return q >= 180 ? 0 : q;
}

export function laatanRuudukko(taso) {
  const span = (N - 1) * taso.askel;
  const ruudut = [];
  for (let lat = Math.floor(taso.lat[0] / span) * span; lat < taso.lat[1]; lat += span) {
    for (let lng = Math.floor(taso.lng[0] / span) * span; lng < taso.lng[1]; lng += span) {
      ruudut.push({ lat0: +lat.toFixed(4), lng0: +lng.toFixed(4) });
    }
  }
  return ruudut;
}

export function smoothstep(s) {
  const x = s < 0 ? 0 : (s > 1 ? 1 : s);
  return x * x * (3 - 2 * x);
}

/* Paino suorakaiteen sisällä: etäisyys lähimpään reunaan km:nä. */
export function suorakaidePaino(lat, lng, laatikko, km = SEKOITUS_KM) {
  const [la0, la1] = laatikko.lat, [lo0, lo1] = laatikko.lng;
  if (lat < la0 || lat > la1 || lng < lo0 || lng > lo1) return 0;
  const kmLat = 111.19, kmLng = 111.19 * Math.cos(lat * Math.PI / 180);
  const d = Math.min((lat - la0) * kmLat, (la1 - lat) * kmLat, (lng - lo0) * kmLng, (lo1 - lng) * kmLng);
  return smoothstep(d / km);
}

/* Laatikkosuotimen painot k lähdeaskeleen levyiselle ikkunalle. */
function suodin(k) {
  if (k <= 1) return { o: [0], w: [1] };
  const h = k / 2, o = [], w = [];
  for (let j = -Math.floor(h); j <= Math.floor(h); j++) {
    o.push(j);
    w.push(Math.abs(j) < h - 1e-9 ? 1 : 0.5);
  }
  return { o, w };
}

/* Pyramidin puskurit. `tasot` = [{ id, askel, lat, lng, paino?: (lat, lng) => 0..1 }]. */
export function luoPyramidi(tasot, nt) {
  return tasot.map(t => ({
    ...t,
    ruudut: laatanRuudukko(t).map(r => {
      const ruutu = {
        ...r,
        nop: new Uint8Array(nt * N * N).fill(TYHJA),
        suunta: new Uint8Array(nt * N * N).fill(TYHJA),
        puuska: new Uint8Array(nt * N * N).fill(TYHJA),
        paino: null,
      };
      if (t.paino) {
        ruutu.paino = new Uint8Array(N * N);
        for (let iy = 0; iy < N; iy++) for (let ix = 0; ix < N; ix++) {
          ruutu.paino[iy * N + ix] = Math.round(255 * t.paino(r.lat0 + iy * t.askel, r.lng0 + ix * t.askel));
        }
      }
      return ruutu;
    }),
  }));
}

/* Tuulen komponentit säännöllisen hilan muotoon: nopeus ja MISTÄ-suunnan
   yksikkövektori (sin, cos). Meteorologinen suunta: u = −v·sin(d),
   v = −v·cos(d). */
export function uvHilaksi(u, v, g) {
  const n = u.length;
  const nop = new Float32Array(n), su = new Float32Array(n), sv = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const uu = u[i], vv = v[i];
    if (!Number.isFinite(uu) || !Number.isFinite(vv)) { nop[i] = NaN; continue; }
    const s = Math.sqrt(uu * uu + vv * vv);
    nop[i] = s;
    if (s > 1e-6) { su[i] = -uu / s; sv[i] = -vv / s; }
  }
  return { nop, su, sv, puu: g || null };
}

/* Yksi hetki pyramidiin.
 *
 * `hila` = { la0, lo0, askel, ni, nj, nop, su, sv, puu, kierto? } missä
 * indeksi on j*ni + i, rivit ETELÄSTÄ POHJOISEEN. `kierto` = pituusaste
 * kiertää (maailmanlaajuinen hila). Laatan solmut osuvat hilan solmuihin
 * tarkasti, koska tasojen askeleet ovat hilan askeleen monikertoja. */
export function kirjoitaHetki(pyramidi, ti, hila) {
  const { la0, lo0, askel, ni, nj, nop, su, sv, puu, kierto } = hila;
  for (const taso of pyramidi) {
    const k = Math.round(taso.askel / askel);
    const f = suodin(k);
    const pohja = ti * N * N;
    for (const ruutu of taso.ruudut) {
      for (let iy = 0; iy < N; iy++) {
        const lat = ruutu.lat0 + iy * taso.askel;
        const cj = Math.round((lat - la0) / askel);
        if (cj + f.o[0] >= nj || cj + f.o[f.o.length - 1] < 0) continue;
        for (let ix = 0; ix < N; ix++) {
          const lng = ruutu.lng0 + ix * taso.askel;
          let lo = lng;
          if (kierto) lo = ((lng - lo0) % 360 + 360) % 360 + lo0;
          const ci = Math.round((lo - lo0) / askel);
          let sN = 0, wN = 0, sS = 0, sC = 0, sG = 0, wG = 0;
          for (let a = 0; a < f.o.length; a++) {
            const j = cj + f.o[a];
            if (j < 0 || j >= nj) continue;
            const wa = f.w[a], rivi = j * ni;
            for (let b = 0; b < f.o.length; b++) {
              let i = ci + f.o[b];
              if (kierto) i = ((i % ni) + ni) % ni;
              else if (i < 0 || i >= ni) continue;
              const s = rivi + i, v = nop[s];
              if (!Number.isFinite(v)) continue;
              const w = wa * f.w[b];
              sN += v * w; wN += w;
              sS += su[s] * w; sC += sv[s] * w;
              if (puu) { const g = puu[s]; if (Number.isFinite(g)) { sG += g * w; wG += w; } }
            }
          }
          if (!wN) continue;
          const kk = pohja + iy * N + ix;
          ruutu.nop[kk] = pakkaaNopeus(sN / wN);
          ruutu.suunta[kk] = pakkaaSuunta((Math.atan2(sS, sC) * 180 / Math.PI + 360) % 360);
          if (wG) ruutu.puuska[kk] = pakkaaNopeus(sG / wG);
        }
      }
    }
  }
}

/* Puuttuneet hetket pois akselilta. Tyhjä hetki akselilla olisi kartalla
   tyhjä ruutu juuri sillä tunnilla — pois jätetty hetki taas
   interpoloidaan naapureistaan, kuten kaikki muutkin välit. `sailyta` on
   säilytettävien hetkien vanhat indeksit nousevassa järjestyksessä. */
export function tiivistaAika(pyramidi, sailyta) {
  const L = N * N;
  for (const taso of pyramidi) {
    for (const r of taso.ruudut) {
      for (const k of ['nop', 'suunta', 'puuska']) {
        const a = r[k], b = new Uint8Array(sailyta.length * L);
        sailyta.forEach((ti, uusi) => b.set(a.subarray(ti * L, (ti + 1) * L), uusi * L));
        r[k] = b;
      }
    }
  }
}

/* Otsake on kiinteän mittainen ja pikkuendian; sen jälkeen kolme
   tavutasoa järjestyksessä [aika][y][x] ja painollisella tasolla vielä
   yksi aikariippumaton N×N-taso. Vanha asiakas lukee vain kolme
   ensimmäistä (siirtymät otsakkeen nt:stä), joten lisätaso ei riko sitä. */
export function kirjoitaLaatta(taso, ruutu, nt, t0Ms, dt) {
  const koko = nt * N * N;
  const runko = new Uint8Array(OTSAKE + 3 * koko + (ruutu.paino ? N * N : 0));
  const dv = new DataView(runko.buffer);
  runko.set(new TextEncoder().encode('FSTILE\0'), 0);
  dv.setUint8(7, 1);
  dv.setFloat32(8, taso.askel, true);
  dv.setFloat32(12, ruutu.lat0, true);
  dv.setFloat32(16, ruutu.lng0, true);
  dv.setUint16(20, N, true);
  dv.setUint16(22, N, true);
  dv.setUint16(24, nt, true);
  dv.setFloat64(26, t0Ms, true);
  dv.setUint32(34, dt, true);
  dv.setUint8(38, TYHJA);
  dv.setUint8(39, ruutu.paino ? 1 : 0);        /* liput: bitti 0 = painotaso */
  runko.set(ruutu.nop.subarray(0, koko), OTSAKE);
  runko.set(ruutu.suunta.subarray(0, koko), OTSAKE + koko);
  runko.set(ruutu.puuska.subarray(0, koko), OTSAKE + 2 * koko);
  if (ruutu.paino) runko.set(ruutu.paino, OTSAKE + 3 * koko);
  return runko;
}

/* Onko laatassa yhtään dataa jolla on painoa? Tyhjiä laattoja ei
   kirjoiteta: alueellisen mallin lat/lon-suorakaide on leveämpi kuin sen
   oma hila (MET Nordicin Lambert-alue kaartuu), ja tyhjä laatta maksaisi
   latauksen eikä antaisi mitään. Asiakas lukee luettelon `laatat`-
   listasta mitkä laatat ovat olemassa. */
export function onDataa(ruutu) {
  if (ruutu.paino && !ruutu.paino.some(p => p > 0)) return false;
  const a = ruutu.nop;
  for (let i = 0; i < a.length; i++) if (a[i] !== TYHJA) return true;
  return false;
}
