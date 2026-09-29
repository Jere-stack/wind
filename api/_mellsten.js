/* MELLSTENIN RIVIT — yhteinen jasennin kahdelle kayttajalle:
 *
 *   api/mellsten.js       proxy, joka tarjoilee sovellukselle historian
 *   tools/havainnot.mjs   keraaja, joka tallentaa historian varastoon
 *
 * Alaviiva nimen alussa: Vercel ei tee tasta omaa funktiota, eika
 * vite.config.js:n dev-reititys tarjoile sita (kuten `_suoja.js`).
 *
 * RIVIN MUOTO on lahteen omalla sivulla dokumentoitu, ei arvattu:
 *
 *   " 08:45 197°   5.6 <  6.5 <  7.8   14.9°C  1009.1  85.5%   0.0"
 *     aika  suunta min <  ka  < max    lampo   paine   kosteus sade
 *
 * Keskituuli on KOLMAS luku (ka), ei ensimmainen. Puuska on maksimi.
 *
 * AIKALEIMASSA ON VAIN KELLONAIKA, SUOMEN AIKAA. Paivays tulee
 * ANKKURISTA, ja ankkuri riippuu tiedostosta:
 *
 *   weather.txt           HTTP:n Last-Modified. Nykyhetki EI kelpaa:
 *                         kun asema sammuu (pilvisella saalla, aurinko-
 *                         paneeli), tiedostoon jaa viimeiset 30 rivia
 *                         vaikka vuorokaudeksi, ja nykyhetkesta laskettuna
 *                         eilisen 01:40 olisi tanaan 01:40.
 *   archive/Day-YY-MM-DD  tiedoston ensimmainen rivi eli luontihetki
 *                         palvelimen vyohykkeessa ("Sun Sep 27 14:00:03
 *                         PDT 2026" = Helsingissa 28.9. klo 00:00).
 *
 * ARKISTON NIMI EI OLE HELSINGIN PAIVA. Palvelin on Kaliforniassa ja
 * nimeaa tiedoston OMAN kalenterinsa mukaan: tavallisesti Helsingin
 * vuorokausi D on tiedostossa D-1, mutta jos asema kaynnistyy katkon
 * jalkeen klo 10 jalkeen Helsingin aikaa, tiedosto on D. Mitattu
 * 29.9.2026: `Day-26-09-27` sisaltaa Helsingin 28.9:n (Windgurun
 * saman aseman 10 min sarja tasmaa siihen, ei 27.9:aan). */

/* Helsingin kalenteri on yhteinen Larun kanssa (api/_varasto.js), ja se
   viedaan taalta edelleen, jotta keraaja ja proxy lukevat sen yhdesta
   paikasta. */
import { helsinkiPoikkeamaMs, helsinkiPaiva, paivaSiirra, seinaAjaksi } from './_varasto.js';
import { puraGif } from './_gif.js';
export { helsinkiPoikkeamaMs, helsinkiPaiva, paivaSiirra, seinaAjaksi };

export const LAHDE = 'https://mellsten.surfing.fi/';

/* Lahde rajoittaa rinnakkaisia pyyntoja (docs/data.md), ja Larun
   kokemus opetti ettei nimetonta pyyntoa kannata tehda.
 *
 * `no-cache`: lahde lahettaa MINUUTIN VALEIN vaihtuvalle weather.txt:lle
 * `Cache-Control: max-age=172800` (kaksi vuorokautta), ja sen oma sivu
 * varoittaa etta valimuistit antavat usein vanhat tiedot. Pyynto kieltaa
 * matkan varrella olevaa valimuistia vastaamasta ilman tarkistusta. */
export const OTSAKKEET = {
  'user-agent': 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)',
  'accept': 'text/plain,*/*',
  'cache-control': 'no-cache',
};

export const RIVI = /^\s*(\d{1,2}):(\d{2})\s+(-?\d+(?:\.\d+)?)°\s+(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s*<\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)°C\s+(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)%\s+(-?\d+(?:\.\d+)?)\s*$/;

/* KUVAAJASTA LUETTU RIVI (ks. `tulkitseKuvaaja` alempana) varastossa:
 *
 *   " 13:05 231°   3.6 <  4.2 <  4.8   kuvaaja"
 *
 * Tuulessa sama muoto kuin lahteen rivissa, mutta lampotilaa, painetta,
 * kosteutta ja sadetta ei ole (kuvaajassa niita ei ole), ja loppusana
 * kertoo mista rivi tuli. "?" = arvo ei nay kuvaajasta (minimi alle
 * 0,8 m/s jaa suuntanauhan alle, maksimi yli 19 m/s tuntimerkkien alle). */
export const KUVARIVI = /^\s*(\d{1,2}):(\d{2})\s+(\d+)°\s+(\?|\d+(?:\.\d+)?)\s*<\s*(\d+(?:\.\d+)?)\s*<\s*(\?|\d+(?:\.\d+)?)\s+kuvaaja\s*$/;

/* Yksi rivi -> olio, tai null jos rivi ei ole mittausrivi (otsikko,
   tyhja, 404-sivun HTML). `teksti` on alkuperainen rivi ilman BOMia —
   varasto tallettaa sen sellaisenaan. */
export function riviOlioksi(rivi) {
  var m = RIVI.exec(rivi);
  if (!m) return kuvariviOlioksi(rivi);
  var h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return {
    h: h, m: mi, hhmm: ('0' + h).slice(-2) + ':' + m[2],
    wd: +m[3], wsMin: +m[4], ws: +m[5], wg: +m[6],
    ta: +m[7], paine: +m[8], kosteus: +m[9], sade: +m[10],
    teksti: rivi.replace(/\s+$/, ''),
  };
}

function kuvariviOlioksi(rivi) {
  var m = KUVARIVI.exec(rivi);
  if (!m) return null;
  var h = +m[1], mi = +m[2];
  if (h > 23 || mi > 59) return null;
  return {
    h: h, m: mi, hhmm: ('0' + h).slice(-2) + ':' + m[2],
    wd: +m[3], wsMin: m[4] === '?' ? null : +m[4], ws: +m[5], wg: m[6] === '?' ? null : +m[6],
    ta: null, paine: null, kosteus: null, sade: null, kuvaaja: true,
    teksti: rivi.replace(/\s+$/, ''),
  };
}

function kuvariviTekstiksi(r) {
  function luku(v) { return v == null ? '   ?' : ('    ' + v.toFixed(1)).slice(-4); }
  return ' ' + r.hhmm + ' ' + ('  ' + r.wd).slice(-3) + '°  ' + luku(r.wsMin) + ' < ' + luku(r.ws)
    + ' < ' + luku(r.wg) + '   kuvaaja';
}

function rivit(teksti) {
  return String(teksti).replace(/﻿/g, '').replace(/\r/g, '').split('\n');
}

/* weather.txt / lastWeather.txt: paivays ankkurista (Last-Modified).
   Ankkuria myohempi rivi on edelliselta vuorokaudelta (keskiyon yli
   meneva ikkuna); pieni vara kellojen eroon. */
export function jasennaAnkkurista(teksti, ankkuriMs) {
  var paiva = helsinkiPaiva(ankkuriMs);
  var edellinen = paivaSiirra(paiva, -1);
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    var ms = seinaAjaksi(paiva, r.h, r.m);
    r.paiva = paiva;
    if (ms > ankkuriMs + 5 * 60000) { ms = seinaAjaksi(edellinen, r.h, r.m); r.paiva = edellinen; }
    r.ms = ms;
    ulos.push(r);
  }
  /* Lahde listaa uusin ensin; sarja halutaan nousevana. */
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Arkiston otsikkorivi "Sun Sep 27 14:00:03 PDT 2026" -> epoch ms.
   Vyohykkeet ovat ne joita palvelin kayttaa; tuntematon -> null, jolloin
   kutsuja putoaa Last-Modifiediin eika arvaa. */
var KUUT = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };
var VYOHYKKEET = { PDT: -7, PST: -8, UTC: 0, GMT: 0, EEST: 3, EET: 2 };
export function arkistonAlku(teksti) {
  var eka = rivit(teksti)[0] || '';
  var m = /^\s*\w{3}\s+(\w{3})\s+(\d{1,2})\s+(\d{1,2}):(\d{2}):(\d{2})\s+([A-Z]{2,5})\s+(\d{4})/.exec(eka);
  if (!m || !(m[1] in KUUT) || !(m[6] in VYOHYKKEET)) return null;
  return Date.UTC(+m[7], KUUT[m[1]], +m[2], +m[3], +m[4], +m[5]) - VYOHYKKEET[m[6]] * 36e5;
}

/* Arkiston paivatiedosto: paivays luontihetkesta. Tiedosto kattaa
   luontihetkesta Helsingin keskiyohon, joten kaikki rivit ovat samaa
   Helsingin paivaa; luontihetkea aiempi rivi (ei pitaisi olla) siirtyy
   seuraavalle paivalle eika jaa vaaraan kohtaan. */
export function jasennaArkisto(teksti, lastModifiedMs) {
  var alku = arkistonAlku(teksti);
  if (alku == null) {
    return lastModifiedMs ? jasennaAnkkurista(teksti, lastModifiedMs) : [];
  }
  var paiva = helsinkiPaiva(alku);
  var seuraava = paivaSiirra(paiva, 1);
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    var ms = seinaAjaksi(paiva, r.h, r.m);
    r.paiva = paiva;
    if (ms < alku - 10 * 60000) { ms = seinaAjaksi(seuraava, r.h, r.m); r.paiva = seuraava; }
    r.ms = ms;
    ulos.push(r);
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Varaston paivatiedosto: paiva on tiedoston nimessa. */
export function jasennaPaiva(teksti, paiva) {
  var ulos = [];
  var rr = rivit(teksti);
  for (var i = 0; i < rr.length; i++) {
    var r = riviOlioksi(rr[i]);
    if (!r) continue;
    r.paiva = paiva;
    r.ms = seinaAjaksi(paiva, r.h, r.m);
    ulos.push(r);
  }
  ulos.sort(function (a, b) { return a.ms - b.ms; });
  return ulos;
}

/* Arkiston tiedostonimi palvelimen kalenteripaivalle: "Day-26-09-27". */
export function arkistonNimi(paiva) {
  return 'Day-' + paiva.slice(2, 4) + '-' + paiva.slice(5, 7) + '-' + paiva.slice(8, 10);
}

/* ── KUVAAJA: lahteen oma 4 tunnin kayra ─────────────────────────────
 *
 * MIKSI. Tekstina lahde antaa kuluvalta paivalta vain 30 minuuttia
 * (weather.txt, plot.html, plot3.html — kaikissa samat 30 rivia), joten
 * jokainen minuutti on luettava puolen tunnin sisalla tai se on poissa
 * keskiyohon asti. GitHubin ajastin ei pysty siihen: havainnot-tyonkulku
 * ei kaynnistynyt kertaakaan kuuteen tuntiin (docs/data.md). Mutta
 * lahteen `plot.gif` piirtaa NELJA TUNTIA minuutin valein, ja sen
 * asteikko on lahteen omalla sivulla: "Kuvaajan leveys vastaa 4 tunnin
 * jaksoa, katkoviiva on 10 m/s kohdalla, maksimituuli on 20 m/s, varit
 * kertovat tuulen suunnan."
 *
 *   240 x 200 px, sarake = minuutti, oikea reuna = tuorein minuutti
 *   y = 199 - 10 * v          10 px / m/s eli 0,1 m/s — sama kuin rivissa
 *   palkki min..max           suunnan varinen
 *   valkoinen piste           keskituuli
 *   rivit 192..199            suuntanauha (sama vari kuin palkki)
 *   rivit 0..1 valkoinen      tuntimerkki (sarake on HH:00)
 *   rivit 0..7 sininen        sade
 *   rivi 99 joka 10. sarake   katkoviiva 10 m/s
 *
 * SUUNTA ON SAVY: kompassi 0 = sininen, 90 = vihrea, 180 = keltainen,
 * 240 = punainen (lahteen colors.png), eli HSV-savy h -> (240 - h) mod
 * 360. Mitattu 29.9.2026 112 minuuttia tekstirivejä vasten: keskituuli,
 * maksimi ja minimi TASMALLEEN samat 112/112, suunta +-1,1 asteen sisalla.
 *
 * HAURAUS HOIDETAAN TARKISTUKSELLA, EI OLETUKSELLA. Kuvaaja luetaan vain
 * jos sen koko on 240 x 200, tuntimerkit osuvat tasatunneille ja samat
 * minuutit tekstirivina (weather.txt) tasmaavat: ulkoasun muutos
 * hylkaa kuvan kokonaan eika tuota vaaria lukuja. Tekstirivi voittaa
 * aina kuvaajasta luetun, ja arkisto korvaa molemmat keskiyon jalkeen. */
export const KUVAAJA = 'plot.gif';

var K_W = 240, K_H = 200;
var K_VIIVA = 99;       /* 10 m/s */
var K_NAUHA = 192;      /* suuntanauha 192..199 */
var K_YLA = 8;          /* tuntimerkit ja sade 0..7 */

function onMusta(c) { return c[0] === 0 && c[1] === 0 && c[2] === 0; }
function onValko(c) { return c[0] === 255 && c[1] === 255 && c[2] === 255; }

/* Kompassisuunta palkin varista (ks. yllä), null jos vari on harmaa. */
function suuntaVarista(c) {
  var r = c[0], g = c[1], b = c[2];
  var mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (!d) return null;
  var h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  return Math.round((240 - h + 360) % 360) % 360;
}

function yleisin(laskuri) {
  var paras = null, n = 0;
  for (var k in laskuri) if (laskuri[k] > n) { n = laskuri[k]; paras = k; }
  return paras;
}

/* plot.gif -> { rivit, uusinMs, tikit, syy }. `muokattuMs` on kuvan
 * Last-Modified: kuva kirjoitetaan joka minuutti samalla hetkella kuin
 * weather.txt, ja sen oikea reuna on sen minuutin rivi (mitattu:
 * 14:02:02 GMT -> 17:02, weather.txt:n tuorein 17:02). Tuntimerkit
 * varmistavat kohdistuksen; jos ne eivat osu millaan minuutin siirrolla,
 * kuvaa ei lueta. Tyhja sarake on puuttuva minuutti eika siita tehda
 * rivia. */
export function tulkitseKuvaaja(tavut, muokattuMs) {
  var g;
  try { g = puraGif(tavut); } catch (e) { return { rivit: [], syy: e.message }; }
  if (g.w !== K_W || g.h !== K_H) return { rivit: [], syy: 'koko ' + g.w + 'x' + g.h };
  function px(x, y) { return g.paletti[g.ind[y * K_W + x]]; }

  /* Katkoviivan vaihe: valkoiset rivilla 99 samassa kohdassa kymmenen
     sarakkeen jaksoa. Kova tuuli voi peittaa osan viivasta, joten
     vaihe luetaan enemmistosta. */
  var vaiheet = {}, x;
  for (x = 0; x < K_W; x++) if (onValko(px(x, K_VIIVA))) vaiheet[x % 10] = (vaiheet[x % 10] || 0) + 1;
  var vaihe = yleisin(vaiheet);
  var viivaa = vaihe == null ? 0 : vaiheet[vaihe];
  vaihe = vaihe == null ? -1 : +vaihe;

  /* Kohdistus: tuorein sarake = Last-Modifiedin minuutti, tarvittaessa
     minuutti tai kaksi siirrettyna. Helsingin ja palvelimen (PDT)
     poikkeamat ovat tasatunteja, joten tasatunti on sama UTC:ssa. */
  var tikit = [];
  for (x = 0; x < K_W; x++) if (onValko(px(x, 0)) && onValko(px(x, 1))) tikit.push(x);
  var ankkuri = Math.floor(muokattuMs / 60000) * 60000;
  var uusin = ankkuri, osumat = -1;
  [0, -1, 1, -2].forEach(function (s) {
    var t = ankkuri + s * 60000, n = 0;
    tikit.forEach(function (tx) { if (new Date(t - (K_W - 1 - tx) * 60000).getUTCMinutes() === 0) n++; });
    if (n > osumat) { osumat = n; uusin = t; }
  });
  if (tikit.length && osumat < tikit.length) return { rivit: [], syy: 'tuntimerkit eivat osu', tikit: tikit };

  var rivit = [];
  for (x = 0; x < K_W; x++) {
    var viivaSarake = x % 10 === vaihe;
    var yla = null, ala = null, pisteet = [], varit = {}, nauha = {}, viivaValko = false, y, c;
    for (y = K_YLA; y < K_NAUHA; y++) {
      c = px(x, y);
      if (onMusta(c)) continue;
      if (onValko(c)) {
        if (y === K_VIIVA && viivaSarake) { viivaValko = true; continue; }
        pisteet.push(y);
      } else {
        varit[c.join(',')] = (varit[c.join(',')] || 0) + 1;
      }
      if (yla === null) yla = y;
      ala = y;
    }
    for (y = K_NAUHA; y < K_H; y++) {
      c = px(x, y);
      if (onValko(c)) pisteet.push(y);
      else if (!onMusta(c)) nauha[c.join(',')] = (nauha[c.join(',')] || 0) + 1;
    }
    /* Keskituuli tasan 10,0 katkoviivan sarakkeessa: piste on viivan alla. */
    if (!pisteet.length && viivaValko && yla !== null && yla <= K_VIIVA && ala >= K_VIIVA) pisteet.push(K_VIIVA);
    var vari = yleisin(varit) || yleisin(nauha);
    var ms = uusin - (K_W - 1 - x) * 60000;
    var r = null;
    if (yla === null) {
      /* Ei palkkia suuntanauhan ylapuolella: joko tyyni (lahteen rivi
         "0° 0.0 < 0.0 < 0.0", kuvaajassa pelkka valkoinen piste alimmalla
         rivilla ilman nauhaa) tai kaikki alle 0,8 m/s nauhan sisalla. */
      if (!pisteet.length) continue;                     /* puuttuva minuutti */
      var ka0 = (K_H - 1 - pisteet[0]) / 10;
      if (ka0 === 0 && !vari) r = { wd: 0, wsMin: 0, ws: 0, wg: 0 };
      else r = { wd: vari ? suuntaVarista(vari.split(',').map(Number)) : 0, wsMin: null, ws: ka0, wg: null };
    } else {
      if (!pisteet.length) continue;                     /* keskituuli ei nay: ei arvata */
      r = {
        wd: vari ? suuntaVarista(vari.split(',').map(Number)) : 0,
        /* Palkki joka jatkuu nauhaan: minimi on alle 0,8 eika sita nae. */
        wsMin: ala >= K_NAUHA - 1 ? null : (K_H - 1 - ala) / 10,
        ws: (K_H - 1 - pisteet[0]) / 10,
        /* Palkki joka ulottuu tuntimerkkeihin: maksimi voi olla leikattu. */
        wg: yla <= K_YLA ? null : (K_H - 1 - yla) / 10,
      };
    }
    if (r.wd == null) r.wd = 0;
    var off = helsinkiPoikkeamaMs(ms);
    var seina = new Date(ms + off);
    r.ms = ms;
    r.paiva = seina.toISOString().slice(0, 10);
    r.h = seina.getUTCHours();
    r.m = seina.getUTCMinutes();
    r.hhmm = ('0' + r.h).slice(-2) + ':' + ('0' + r.m).slice(-2);
    r.ta = null; r.paine = null; r.kosteus = null; r.sade = null;
    r.kuvaaja = true;
    r.teksti = kuvariviTekstiksi(r);
    rivit.push(r);
  }
  return { rivit: rivit, uusinMs: uusin, tikit: tikit, katkoviiva: viivaa };
}

/* Kuvaajan rivit tekstirivejä vasten (weather.txt): samat minuutit,
   keskituuli ja maksimi 0,05 m/s:n sisalla. */
export function vertaaKuvaajaan(kuvaRivit, tekstiRivit) {
  var t = new Map();
  tekstiRivit.forEach(function (r) { t.set(r.ms, r); });
  var verrattu = 0, osui = 0;
  kuvaRivit.forEach(function (k) {
    var r = t.get(k.ms);
    if (!r) return;
    verrattu++;
    if (Math.abs(k.ws - r.ws) < 0.051 && (k.wg == null || Math.abs(k.wg - r.wg) < 0.051)) osui++;
  });
  return { verrattu: verrattu, osui: osui };
}

/* Kelpaako kuvaaja. Tavallisesti tarkistus on weather.txt:n 30 minuuttia
   ja vaatimus 90 %. Jos vertailtavaa ei ole (weather.txt ei vastannut),
   kelpuutetaan vain rakenteeltaan varma kuva: katkoviiva ja vahintaan
   kaksi tuntimerkkia paikallaan. */
export function kuvaajaKelpaa(tulkinta, tarkistus) {
  if (!tulkinta || !tulkinta.rivit || !tulkinta.rivit.length) return false;
  if (tarkistus && tarkistus.verrattu >= 10) return tarkistus.osui >= 0.9 * tarkistus.verrattu;
  return (tulkinta.katkoviiva || 0) >= 10 && (tulkinta.tikit || []).length >= 2;
}
