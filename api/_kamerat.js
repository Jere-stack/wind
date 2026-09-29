/* KELIKAMERAT — yksi rekisteri ja yksi tilasääntö (docs/data.md,
 * "Larun kelikamera").
 *
 * Alaviiva nimen alussa: apumoduuli, ei reitti. Keräin
 * (tools/kamerat.mjs) ja proxy (api/kamera.js) lukevat tätä, ja
 * sovellus saa kamerat proxyn vastauksesta — index.html:ssä ei ole
 * kameralistaa. Kaksi listaa samasta asiasta ajautuisi erilleen, kuten
 * asemarekisterin kopio aikanaan (CLAUDE.md, "ASEMAREKISTERI ON YKSI").
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
/* Keräimen tilaa vanhempi kuin tämä ei kerro nykyhetkestä mitään:
   GitHubin ajastin viivästää ajoja joskus yli puoli tuntia (docs/data.md,
   "Mitä jää"), mutta kaksi tuntia on jo pysähtynyt keräin. */
export const TILA_VANHA_MS = 2 * 3600e3;

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

/* TILASÄÄNTÖ. `k` on keräimen tila (tai null), `nayte` proxyn oma HEAD
 * samaan videoon (tai null jos se epäonnistui).
 *
 *   'live'        kuva on vaihtunut viimeisen 25 min aikana
 *   'pois'        kuva ei vaihdu, lähetys on päättynyt tai video poistettu
 *   'tuntematon'  keräimen tieto puuttuu tai on vanha
 *
 * `viimeisin` on se hetki jolloin keräin näki nykyisen kuvan ilmestyvän
 * (±10 min), eli sammuneella kameralla "viimeisin kuva". */
export function paattele(kamera, k, nyt, nayte) {
  const video = seurattava(kamera, k);
  const pohja = { tila: 'tuntematon', video, syy: null, viimeisin: null };
  /* Päättynyt ja poistettu näkyvät yhdestäkin näytteestä, keräimestä
     riippumatta. */
  if (nayte && nayte.video === video) {
    if (nayte.tila === 404) return Object.assign(pohja, { tila: 'pois', syy: 'poistettu' });
    if (nayte.etag === '0') return Object.assign(pohja, { tila: 'pois', syy: 'paattynyt' });
  }
  const tarkistettu = k ? Date.parse(k.tarkistettu) : NaN;
  if (!k || k.rekisteri !== kamera.video || !(nyt - tarkistettu <= TILA_VANHA_MS)) {
    return Object.assign(pohja, { syy: 'ei-keraajaa' });
  }
  /* Kuva on vaihtunut keräimen käynnin jälkeen. Se todistaa elävyyden
     vain jos käynti on tuore — kahden tunnin takaisen jälkeen vaihtunut
     kuva voi olla puolentoista tunnin takaa. */
  if (nayte && nayte.video === video && nayte.etag && nayte.etag !== k.etag) {
    return nyt - tarkistettu <= 2 * HILJAA_MAX_MS
      ? Object.assign(pohja, { tila: 'live' })
      : Object.assign(pohja, { syy: 'ei-keraajaa' });
  }
  if (!k.etag || k.etag === '0') {
    return Object.assign(pohja, { tila: 'pois', syy: k.etag ? 'paattynyt' : 'poistettu' });
  }
  if (kuvaElaa(k, nyt)) return Object.assign(pohja, { tila: 'live' });
  /* HILJAISUUS ON HAVAINTO, EI PÄÄTELMÄ. Sama kuva on NÄHTÄVÄ rajan
     yli: joko keräin näki sen (`tarkistettu − nahty`) tai oma näyte
     näkee sen nyt. Pelkkä vanha `nahty` ei riitä — jos keräimen ja oman
     näytteen haut epäonnistuivat, tunnin takainen muutos ei kerro että
     kamera sammui, vaan että sitä ei ole katsottu. Ensimmäisellä
     käynnillä muutosta ei ole vielä nähty, joten hiljaisuus alkaa
     todistaa vasta kun se on kestänyt koko rajan. */
  const nahty = Date.parse(k.nahty);
  const samaNyt = !!(nayte && nayte.video === video && nayte.etag === k.etag);
  if (tarkistettu - nahty > HILJAA_MAX_MS || (samaNyt && nyt - nahty > HILJAA_MAX_MS)) {
    return Object.assign(pohja, { tila: 'pois', syy: 'hiljaa', viimeisin: k.muutos ? k.nahty : null });
  }
  return pohja;
}
