/* KELIKAMERAT — yksi rekisteri ja yksi tilasääntö (docs/data.md,
 * "Larun kelikamera").
 *
 * Alaviiva nimen alussa: apumoduuli, ei reitti. Keräin
 * (tools/kamerat.mjs) ja proxy (`api/laru.js?kamera=1`, `kameraVastaus`
 * alla) lukevat tätä, ja sovellus saa kamerat proxyn vastauksesta —
 * index.html:ssä ei ole kameralistaa. Kaksi listaa samasta asiasta
 * ajautuisi erilleen, kuten asemarekisterin kopio aikanaan (CLAUDE.md,
 * "ASEMAREKISTERI ON YKSI").
 *
 * EI OMAA REITTIÄ. `api/kamera.js` oli kolmastoista funktio, ja Vercelin
 * Hobby-taso sallii kaksitoista deployta kohti: tuotantodeploy kaatui
 * ("Deployment has failed") eikä mikään muuttunut tuotannossa. Kamera
 * on Larun, joten reitti on Larun proxyssa.
 *
 * YOUTUBEN LIVE-LIPPU EI KERRO ONKO KAMERA PÄÄLLÄ. Larun lähetys on
 * ollut YouTuben mielestä käynnissä 6.12.2019 lähtien ("Striimi alkoi
 * 6.12.2019"), myös niinä kuukausina joina kamera ei lähetä: lähetystä
 * ei lopeteta, siihen vain ei tule kuvaa. Eikä lippua saisi luettua
 * palvelimelta edes luotettavasti: YouTube vastaa palvelinosoitteille
 * katselusivulla bottitarkistuksella (mitattu: /watch → google.com/sorry,
 * /youtubei/v1/player → LOGIN_REQUIRED kuudella asiakastyypillä).
 *
 * KUVA KERTOO. Elävän lähetyksen pikkukuva (i.ytimg.com, ei
 * bottitarkistusta) päivittyy noin viiden minuutin välein, ja sen ETag
 * on laskuri joka kasvaa jokaisella uudella kuvalla: mitattuna 188435 →
 * 188454 93 minuutissa, ja sama luku on YouTuben omassa osoitteessa
 * `hq720.jpg?v=2e026` heksana. Päättyneen lähetyksen ETag on "0",
 * tavallisen videon Unix-aika, ja poistetun videon kuva on 404. Kamera
 * on siis päällä jos ETag on muuttunut hiljattain — ja "hiljattain"
 * vaatii kaksi näytettä eri aikaan. Proxy näkee vain yhden hetken, joten
 * keräin kirjaa ETagin talteen kymmenen minuutin välein
 * (`kamerat/tila.json` haarassa `havainnot`). ETagia verrataan
 * merkkijonona eikä lukuna: muutos on tieto, suuruus ei. */

import { readFile } from 'fs/promises';
import { join } from 'path';

export const KAMERAT = [
  {
    id: 'laru',
    /* Aseman `place` (index.html: PAIKALLISASEMAT). Kortti ja kartan
       pilleri löytävät kameran tällä. */
    asema: 'laru',
    nimi: 'Larukite-kelikamera',
    omistaja: 'Lauttasaaren leijalautailijat ry',
    kanava: 'UCJmadTJ58HxfuPMgDm6rtrg',
    /* Sama lähetys 6.12.2019 lähtien. Jos seura aloittaa uuden, keräin
       löytää sen kanavan syötteestä (tools/kamerat.mjs), eikä tätä
       tarvitse vaihtaa käsin. */
    video: 'o45aDp57IM8',
  },
];

/* Kuva päivittyy ~4,9 min välein (19 kuvaa 93 minuutissa) ja keräin
   käy 10 min välein, joten päällä olevan kameran ETag on muuttunut
   jokaisella käynnillä. 25 min sietää yhden väliin jääneen kuvan ja
   ajastimen tavallisen heiton; sammunut kamera näkyy sammuneena
   20–35 minuutissa. */
export const HILJAA_MAX_MS = 25 * 60e3;
/* Keräimen tilaa vanhempi kuin tämä ei kerro nykyhetkestä mitään
   ILMAN omaa näytettä: GitHubin ajastin viivästää ajoja joskus yli
   puoli tuntia (docs/data.md, "Mitä jää"), mutta kaksi tuntia on jo
   pysähtynyt keräin. Oman näytteen kanssa vanhakin tila kelpaa (alla). */
export const TILA_VANHA_MS = 2 * 3600e3;
/* LASKURI ON KELLO. Kuva vaihtuu päällä olevalla kameralla tasaisesti
   (mitattu 4,9–5,1 min kuvaa kohti, näytteissä on lisäksi CDN:n
   viiden minuutin viive), joten kahden näytteen välinen kuvamäärä
   kertoo onko kuvaa tullut koko ajan. 6 min on tahdin yläraja ja 2
   kuvaa näytteiden viive: jos kamera sammui T_off sitten ja edellinen
   näyte on T:n takaa, sääntö erehtyy vain kun T_off < T/6 + 10 min.
   Vuorokautta vanhempaan näytteeseen sitä ei enää verrata. */
export const KUVA_VALI_MAX_MS = 6 * 60e3;
export const LASKURI_VARA = 2;
export const LASKURI_MAX_MS = 24 * 3600e3;
/* Elävän lähetyksen ETag: laskuri. Tavallisen videon ETag on Unix-aika
   (10 numeroa), joten raja erottaa ne myös keräimen uuden lähetyksen
   haussa (vaihdettu kansikuva ei ole lähetys). */
export const LASKURI = /^\d{1,8}$/;

export function kanavanOsoite(kanava) {
  return 'https://www.youtube.com/channel/' + kanava;
}

/* `hqdefault_live.jpg` on olemassa myös tavalliselle videolle (sama kuva
   kuin ilman päätettä), joten pääte ei ole elävyyden merkki — ETag on. */
export function kuvanOsoite(video, koko) {
  return 'https://i.ytimg.com/vi/' + video + '/' + (koko || 'hqdefault') + '_live.jpg';
}

/* Yksi HEAD pikkukuvaan: { tila: 200, etag } tai { tila: 404, etag: null }.
   Muu vastaus on virhe eikä tieto — 500 ei kerro kamerasta mitään. */
export async function haeEtag(video, aikaraja) {
  const res = await fetch(kuvanOsoite(video), {
    method: 'HEAD',
    headers: { 'user-agent': 'FoilSpot/1.0 (+https://github.com/Jere-stack/wind)' },
    signal: AbortSignal.timeout(aikaraja || 5000),
  });
  if (res.status === 404) return { tila: 404, etag: null };
  if (!res.ok) throw new Error('HTTP ' + res.status);
  const etag = String(res.headers.get('etag') || '').replace(/^W\//, '').replace(/"/g, '');
  if (!etag) throw new Error('ei ETagia');
  return { tila: 200, etag };
}

/* Keräimen näkemys yhdestä kamerasta: kuva on vaihtunut viimeisen
   HILJAA_MAX_MS:n aikana, ja vaihto on nähty eikä oletettu. */
export function kuvaElaa(k, nyt) {
  return !!(k && k.etag && k.etag !== '0' && k.muutos
    && nyt - Date.parse(k.nahty) <= HILJAA_MAX_MS);
}

/* Seurattava video: keräimen löytämä, ellei rekisteriä ole sen jälkeen
   muutettu käsin — silloin tila koskee vanhaa videota ja nollautuu. */
export function seurattava(kamera, k) {
  return k && k.rekisteri === kamera.video && k.video ? k.video : kamera.video;
}

/* Onko kuvia tullut tasaisesti näytteen `a` (ikä `ms`) jälkeen
   näytteeseen `b` asti. Vain laskureille: Unix-aikainen ETag on
   tavallinen video. */
export function laskuriKulkee(a, b, ms) {
  if (!LASKURI.test(String(a)) || !LASKURI.test(String(b))) return false;
  const kuvia = Number(b) - Number(a);
  return kuvia > 0 && kuvia >= ms / KUVA_VALI_MAX_MS - LASKURI_VARA;
}

/* TILASÄÄNTÖ. `k` on keräimen tila (tai null), `nayte` proxyn oma HEAD
 * samaan videoon (tai null jos se epäonnistui).
 *
 *   'live'        kuva on vaihtunut viimeisen 25 min aikana
 *   'pois'        kuva ei vaihdu, lähetys on päättynyt tai video poistettu
 *   'tuntematon'  tieto puuttuu, tai sitä ei voi erottaa kummastakaan
 *
 * `viimeisin` on se hetki jolloin keräin näki nykyisen kuvan ilmestyvän
 * (±10 min), eli sammuneella kameralla "viimeisin kuva".
 *
 * HILJAISUUS ON HAVAINTO, EI PÄÄTELMÄ. 'pois' vaatii että sama kuva on
 * NÄHTY rajan yli: oma näyte näkee nyt saman kuvan joka nähtiin
 * `nahty`nä, tai keräin näki sen (`tarkistettu − nahty`). Pelkkä vanha
 * `nahty` ei riitä — jos haut epäonnistuivat, tunnin takainen muutos ei
 * kerro että kamera sammui, vaan että sitä ei ole katsottu. */
export function paattele(kamera, k, nyt, nayte) {
  const video = seurattava(kamera, k);
  const pohja = { tila: 'tuntematon', video, syy: null, viimeisin: null };
  const oma = nayte && nayte.video === video ? nayte : null;
  /* Päättynyt ja poistettu näkyvät yhdestäkin näytteestä, keräimestä
     riippumatta. */
  if (oma && oma.tila === 404) return Object.assign(pohja, { tila: 'pois', syy: 'poistettu' });
  if (oma && oma.etag === '0') return Object.assign(pohja, { tila: 'pois', syy: 'paattynyt' });
  const tarkistettu = k ? Date.parse(k.tarkistettu) : NaN;
  const nahty = k ? Date.parse(k.nahty) : NaN;
  if (!k || k.rekisteri !== kamera.video || !(nyt - tarkistettu >= 0) || !(tarkistettu >= nahty)) {
    return Object.assign(pohja, { syy: 'ei-keraajaa' });
  }
  const ika = nyt - tarkistettu;
  const hiljaa = () => Object.assign(pohja, { tila: 'pois', syy: 'hiljaa', viimeisin: k.muutos ? k.nahty : null });

  if (oma && oma.etag) {
    /* Kuva on vaihtunut keräimen käynnin jälkeen. Tuoreen käynnin jälkeen
       se todistaa elävyyden sellaisenaan; vanhemman jälkeen vain jos
       kuvia on tullut tahdin verran (laskuri kellona). */
    if (oma.etag !== k.etag) {
      if (ika <= 2 * HILJAA_MAX_MS) return Object.assign(pohja, { tila: 'live' });
      if (ika <= LASKURI_MAX_MS && laskuriKulkee(k.etag, oma.etag, ika)) {
        return Object.assign(pohja, { tila: 'live' });
      }
      return Object.assign(pohja, { syy: 'ei-keraajaa' });
    }
    /* Sama kuva nyt kuin `nahty`nä: havainto, keräimen iästä riippumatta. */
    if (nyt - nahty > HILJAA_MAX_MS) return hiljaa();
    return k.muutos ? Object.assign(pohja, { tila: 'live' }) : pohja;
  }

  /* Oma näyte epäonnistui: vain keräimen tuore tila kelpaa. */
  if (ika > TILA_VANHA_MS) return Object.assign(pohja, { syy: 'ei-keraajaa' });
  if (!k.etag || k.etag === '0') {
    return Object.assign(pohja, { tila: 'pois', syy: k.etag ? 'paattynyt' : 'poistettu' });
  }
  if (kuvaElaa(k, nyt)) return Object.assign(pohja, { tila: 'live' });
  if (tarkistettu - nahty > HILJAA_MAX_MS) return hiljaa();
  return pohja;
}

/* ── Proxyn vastaus (api/laru.js?kamera=1) ─────────────────────────
 *
 * { kamerat: [{ id, asema, nimi, omistaja, kanava, video, tila, syy,
 * viimeisin, kuva }], varasto }. Kartan pilleri saa play-kolmion kun
 * `tila` on 'live', ja asemakortti näyttää kameran kolmessa tilassa.
 *
 * KAKSI NÄYTETTÄ. Keräimen tila (haara `havainnot`) kertoo mitä kuvalle
 * on tapahtunut; oma HEAD samaan kuvaan kertoo nyt-hetken — päättyneen
 * ("0") ja poistetun (404) heti, ja keräimen käynnin jälkeen vaihtuneen
 * kuvan silloinkin kun GitHubin ajastin on myöhässä. Kumpikin saa
 * epäonnistua yksin: ilman kumpaakaan tila on 'tuntematon', ei virhe.
 *
 * `kuva` on se ETag josta tila pääteltiin — vianetsintää varten. Sitä EI
 * liitetä kuvan osoitteeseen: i.ytimg.com lukee `?v=`:n kuvan versioksi
 * heksana ja vastaa 404:llä versioon jota ei vielä ole (mitattu), joten
 * desimaalinen ETag rikkoi kuvan. */

/* Sama varasto ja sama testikytkin kuin api/mellsten.js:ssä: muuttuja
   voi olla myös paikallinen hakemisto (keräimen tuloste). */
const VARASTO = process.env.HAVAINNOT_KANTA || 'https://raw.githubusercontent.com/Jere-stack/wind/havainnot/';
const AIKARAJA = 4000;

async function lueTila() {
  const polku = 'kamerat/tila.json';
  if (/^https?:/.test(VARASTO)) {
    const res = await fetch(VARASTO + polku, { signal: AbortSignal.timeout(AIKARAJA) });
    /* Haaraa tai tiedostoa ei vielä ole (keräin ei ole ajanut): ei virhe. */
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('varasto HTTP ' + res.status);
    return res.json();
  }
  try { return JSON.parse(await readFile(join(VARASTO, polku), 'utf8')); }
  catch (e) { if (e.code === 'ENOENT') return null; throw e; }
}

export async function kameraVastaus(nyt) {
  /* Varasto ja rekisterin videoiden kuvat rinnakkain: eri palvelimet. */
  const [t, ...n] = await Promise.allSettled(
    [lueTila()].concat(KAMERAT.map((c) => haeEtag(c.video, AIKARAJA))));
  const tila = t.status === 'fulfilled' ? t.value : null;

  const kamerat = [];
  for (let i = 0; i < KAMERAT.length; i++) {
    const c = KAMERAT[i];
    const k = tila && tila.kamerat ? tila.kamerat[c.id] || null : null;
    const video = seurattava(c, k);
    let nayte = n[i].status === 'fulfilled' ? Object.assign({ video: c.video }, n[i].value) : null;
    /* Keräin on siirtynyt uuteen lähetykseen: näyte siitä. */
    if (video !== c.video) {
      try { nayte = Object.assign({ video }, await haeEtag(video, AIKARAJA)); }
      catch (e) { nayte = null; }
    }
    const p = paattele(c, k, nyt, nayte);
    kamerat.push({
      id: c.id, asema: c.asema, nimi: c.nimi, omistaja: c.omistaja,
      kanava: kanavanOsoite(c.kanava),
      video: p.video, tila: p.tila, syy: p.syy, viimeisin: p.viimeisin,
      kuva: (nayte && nayte.video === p.video && nayte.etag) || (k && k.video === p.video && k.etag) || null,
    });
  }
  return {
    kamerat,
    /* Varaston vika sanotaan, jotta 'tuntematon' ei näytä selittämättömältä. */
    varasto: t.status === 'fulfilled' ? (tila ? 'ok' : 'ei tilaa') : String(t.reason && t.reason.message || t.reason),
  };
}
