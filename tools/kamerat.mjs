#!/usr/bin/env node
/* KELIKAMEROIDEN TILA — pikkukuvan ETag talteen kymmenen minuutin
 * välein (api/_kamerat.js, docs/data.md "Larun kelikamera").
 *
 *   node tools/kamerat.mjs <hakemisto>
 *
 * MIKSI. Proxy (api/kamera.js) näkee yhden hetken: se osaa sanoa onko
 * lähetys päättynyt tai video poistettu, mutta ei sitä päivittyykö kuva
 * — YouTuben mielestä Larun lähetys on ollut käynnissä vuodesta 2019,
 * myös silloin kun kamera ei lähetä. Päivittyminen vaatii kaksi
 * näytettä eri aikaan, ja ne kerää tämä: jos ETag on eri kuin
 * edellisellä käynnillä, kuva on vaihtunut.
 *
 * TILA on haarassa `havainnot` (sama keruuajo kuin Mellstenillä):
 *
 *   kamerat/tila.json   { kamerat: { laru: { rekisteri, video, etag,
 *                         nahty, muutos, tarkistettu, virhe, haettu,
 *                         ehdokkaat } } }
 *
 *   nahty   milloin nykyinen ETag nähtiin ensimmäisen kerran
 *   muutos  true jos se korvasi eri ETagin (kuva vaihtui ≈ nahty),
 *           false jos se on seurannan ensimmäinen näyte
 *
 * UUSI LÄHETYS. Jos seura joskus lopettaa lähetyksen ja aloittaa uuden,
 * rekisterin video jää pysyvästi pois päältä. Siksi sammuneen kameran
 * kanavan syöte luetaan tunnin välein, ja ehdokas jonka pikkukuva vaihtuu
 * kahden käynnin välillä otetaan seurantaan. Ehdokkaan ETagin on
 * oltava laskuri (enintään kahdeksan numeroa): tavallisen videon ETag
 * on Unix-aika, ja vaihdettu kansikuva ei ole lähetys.
 *
 * EI SAA KAATAA TYÖNKULKUA: sama ajo julkaisee Mellstenin rivit. Virheet
 * kirjataan tilaan ja poistutaan nollalla, ja työnkulun askel on
 * lisäksi `continue-on-error`.
 *
 * Vain Noden omia moduuleita: työnkulku ei aja `npm ci`:tä. */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { KAMERAT, HILJAA_MAX_MS, haeEtag, kuvaElaa, seurattava } from '../api/_kamerat.js';

const HAKU_VALI_MS = 60 * 60e3;
/* Syötteessä ovat kanavan 15 uusinta; uutta lähetystä etsitään vain
   tuoreista, jotta vuosien takaiset tallenteet eivät maksa hakuja. */
const EHDOKAS_TUORE_MS = 60 * 864e5;
const LASKURI = /^\d{1,8}$/;

const hak = process.argv[2];
if (!hak) { console.error('kaytto: node tools/kamerat.mjs <hakemisto>'); process.exit(2); }
const kamHak = join(hak, 'kamerat');
mkdirSync(kamHak, { recursive: true });
const polku = join(kamHak, 'tila.json');

const nyt = Date.now();
const nytIso = new Date(nyt).toISOString();
let tila = { kamerat: {} };
try {
  if (existsSync(polku)) tila = JSON.parse(readFileSync(polku, 'utf8'));
} catch (e) { /* rikkinäinen tila alustetaan: pahimmillaan 25 min "tuntematon" */ }
tila.kamerat = tila.kamerat || {};
const raportti = [];

/* Kuvan ETag yhteen seurantaan. */
function kirjaa(k, etag) {
  if (!('etag' in k)) { k.etag = etag; k.nahty = nytIso; k.muutos = false; return; }
  if (etag !== k.etag) { k.etag = etag; k.nahty = nytIso; k.muutos = true; }
}

async function syotteenVideot(kanava) {
  const res = await fetch('https://www.youtube.com/feeds/videos.xml?channel_id=' + kanava,
    { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error('syöte HTTP ' + res.status);
  const xml = await res.text();
  const ulos = [];
  for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
    const id = /<yt:videoId>([\w-]{11})<\/yt:videoId>/.exec(m[1]);
    const pv = /<published>([^<]+)<\/published>/.exec(m[1]);
    if (id) ulos.push({ video: id[1], julkaistu: pv ? Date.parse(pv[1]) : NaN });
  }
  return ulos;
}

/* Sammuneen kameran uusi lähetys. Ehdokkaita ovat syötteen tuoreet ja
   rekisterin oma video (jos seuranta on siirtynyt muualle): jos seura
   jatkaa vanhaa lähetystä, sen pitää löytyä takaisin. */
async function etsiUusi(kamera, k) {
  const ehd = new Set();
  if (k.video !== kamera.video) ehd.add(kamera.video);
  for (const e of await syotteenVideot(kamera.kanava)) {
    if (e.video !== k.video && nyt - e.julkaistu <= EHDOKAS_TUORE_MS) ehd.add(e.video);
  }
  const vanhat = k.ehdokkaat || {};
  const uudet = {};
  let loytyi = null;
  for (const video of ehd) {
    let n;
    try { n = await haeEtag(video, 15000); } catch (e) { continue; }
    const ed = vanhat[video];
    uudet[video] = { etag: n.etag, nahty: ed && ed.etag === n.etag ? ed.nahty : nytIso };
    if (!loytyi && ed && ed.etag && n.etag && n.etag !== ed.etag && LASKURI.test(n.etag)) {
      loytyi = { video, etag: n.etag };
    }
  }
  k.ehdokkaat = uudet;
  return loytyi;
}

for (const kamera of KAMERAT) {
  let k = tila.kamerat[kamera.id];
  /* Rekisteriä on muutettu käsin: vanha seuranta ei koske uutta videota. */
  if (!k || k.rekisteri !== kamera.video) k = { rekisteri: kamera.video, video: kamera.video };
  k.video = seurattava(kamera, k);
  try {
    const n = await haeEtag(k.video, 15000);
    kirjaa(k, n.etag);
    k.tarkistettu = nytIso;
    k.virhe = null;
    /* Hiljaisuus on TODETTU vasta kun kuva on ollut sama koko rajan
       ajan (tai lähetys on päättynyt tai poistettu). Ensimmäinen näyte
       ei vielä kerro mitään, eikä sen perään etsitä uutta lähetystä. */
    const hiljaa = !k.etag || k.etag === '0' || nyt - Date.parse(k.nahty) > HILJAA_MAX_MS;
    raportti.push(kamera.id + ': ' + k.video + ' ETag ' + (n.etag || '404')
      + (k.muutos ? ', kuva vaihtui ' + k.nahty : ', sama kuin ' + k.nahty)
      + (kuvaElaa(k, nyt) ? ' → päällä' : hiljaa ? ' → ei päivity' : ' → ensimmäinen näyte'));
    if (hiljaa && (!k.haettu || nyt - Date.parse(k.haettu) >= HAKU_VALI_MS)) {
      k.haettu = nytIso;
      try {
        const uusi = await etsiUusi(kamera, k);
        if (uusi) {
          raportti.push(kamera.id + ': uusi lähetys ' + uusi.video + ' (kuva vaihtui kahden käynnin välillä)');
          /* Vaihto nähtiin, joten se on muutos eikä ensimmäinen näyte. */
          Object.assign(k, { video: uusi.video, etag: uusi.etag, nahty: nytIso, muutos: true, ehdokkaat: {} });
        } else {
          raportti.push(kamera.id + ': syötteestä ' + Object.keys(k.ehdokkaat).length + ' ehdokasta, ei uutta lähetystä');
        }
      } catch (e) {
        raportti.push(kamera.id + ': syöte ' + e.message);
      }
    }
  } catch (e) {
    /* Epäonnistunut näyte ei ole tieto kamerasta: `tarkistettu` jää
       ennalleen, jolloin proxy toteaa tilan vanhaksi eikä sammuneeksi. */
    k.virhe = String(e && e.message || e);
    raportti.push(kamera.id + ': ' + k.virhe);
  }
  tila.kamerat[kamera.id] = k;
}

/* Rekisteristä poistetut pois tilasta. */
for (const id of Object.keys(tila.kamerat)) {
  if (!KAMERAT.some((c) => c.id === id)) delete tila.kamerat[id];
}
tila.paivitetty = nytIso;
writeFileSync(polku, JSON.stringify(tila, null, 1) + '\n');

console.log('### Kelikamerat\n');
for (const r of raportti) console.log('- ' + r);
