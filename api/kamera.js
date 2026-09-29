/* KELIKAMERAT — onko kameralla nyt kuvaa (api/_kamerat.js, docs/data.md
 * "Larun kelikamera").
 *
 * Vastaus: { kamerat: [{ id, asema, nimi, omistaja, kanava, video,
 * tila, syy, viimeisin, kuva }] }. Sovellus lukee kamerat TÄSTÄ eikä
 * omasta listastaan: kartan pilleri saa play-kolmion kun `tila` on
 * 'live', ja asemakortti näyttää kameran kolmessa tilassa.
 *
 * KAKSI NÄYTETTÄ. Keräimen tila (haara `havainnot`, 10 min välein)
 * kertoo onko pikkukuva vaihtunut; oma HEAD samaan kuvaan kertoo nyt-
 * hetken — päättyneen lähetyksen ("0") ja poistetun videon (404) heti,
 * ja keräimen käynnin jälkeen vaihtuneen kuvan silloinkin kun GitHubin
 * ajastin on myöhässä. Kumpikin saa epäonnistua yksin: ilman kumpaakaan
 * tila on 'tuntematon', ei virhe.
 *
 * `kuva` on se pikkukuvan ETag josta tila pääteltiin — vianetsintää
 * varten. Sitä EI liitetä kuvan osoitteeseen: i.ytimg.com lukee `?v=`:n
 * kuvan versioksi heksana ja vastaa 404:llä versioon jota ei vielä ole
 * (mitattu), joten desimaalinen ETag rikkoi kuvan. */
import { readFile } from 'fs/promises';
import { join } from 'path';
import { suojaa } from './_suoja.js';
import { KAMERAT, haeEtag, paattele, seurattava, kanavanOsoite } from './_kamerat.js';

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

export default async function handler(req, res) {
  if (!suojaa(req, res)) return;
  const nyt = Date.now();
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

  /* Kuva vaihtuu viiden minuutin välein ja tila hitaammin; minuutti
     CDN:ssä pitää funktion kutsut kurissa eikä näytä vanhaa. */
  res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=240');
  return res.status(200).json({
    kamerat,
    /* Varaston vika sanotaan, jotta 'tuntematon' ei näytä selittämättömältä. */
    varasto: t.status === 'fulfilled' ? (tila ? 'ok' : 'ei tilaa') : String(t.reason && t.reason.message || t.reason),
  });
}
