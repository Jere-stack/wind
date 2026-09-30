#!/usr/bin/env node
/* SÄÄDATAN HERÄTIN — varasto rakennetaan kun FMI:llä on uudempi ajo
 * (docs/oikeellisuus.md, O1).
 *
 *   node tools/saaherate.mjs        (havainnot-työnkulun askel)
 *
 * MIKSI. Säädata on ajastettu 04:20 / 10:20 / 16:20 / 22:20 UTC, mutta
 * GitHubin ajastin myöhästyy: 22.–29.9.2026 viive ajastuksesta oli
 * mediaanina 3,7 h ja enintään 5,7 h, ja rakennusten väli enintään
 * 11,1 h. 29.9. klo 18:33 UTC varastossa oli FMI 06Z, kun FMI:llä oli jo
 * 15Z. Kortin rajapintasarjat ovat tuoreimmasta ajosta, joten samassa
 * näkymässä oli kaksi ajoa: spoteilla ero 0,45 m/s keskimäärin ja 35 %
 * tunneista yli sovelluksen oman 0,5 m/s rajan (O2).
 *
 * MITEN. Havainnot-työnkulku ajaa jo luotettavasti (ajastinketju ja
 * Säädatan perään, tools/ajastin.mjs). Tämä askel luotaa FMI:n
 * tuoreimman HARMONIE-ajon samalla 5 kB:n luotaimella jota rakentaja
 * käyttää (`harmonieAjot`), vertaa sitä varaston luettelon ajoon ja
 * lähettää Säädatan (`workflow_dispatch`) kun FMI on edellä.
 *
 * PORTIT — HERÄTIN EI VOI KARATA:
 *   1. Varasto on rakennettu vähintään MIN_IKA_H tuntia sitten
 *      (luettelon `luotu`). Säädata kestää noin 10 min ja sen perään
 *      ajetaan Havainnot, joten tämä pysäyttää ketjun heti.
 *   2. Säädataa ei ole jonossa tai käynnissä, eikä yhtään Säädata-ajoa
 *      ole LUOTU viimeisen MIN_VALI_H tunnin aikana — myöskään
 *      epäonnistunutta. Rikkinäinen rakentaja yritetään siis enintään
 *      kerran MIN_VALI_H:ssa eikä joka havaintoajolla.
 *   3. Syy on joko uudempi FMI-ajo tai varaston ikä yli VANHA_H (jos
 *      luotain ei vastaa, MET Nordic ja ECMWF vanhenevat silti).
 *
 * Ajastin jää varalle. Skripti ei koskaan kaada ajoa: virhe kirjataan
 * yhteenvetoon. Vain Noden omat moduulit (Havainnot ei asenna
 * riippuvuuksia); `tools/harmonie.mjs` ei tuo mitään. */

import { harmonieAjot } from './harmonie.mjs';

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN;
const HAARA = process.env.GITHUB_REF_NAME;
const TYONKULKU = 'saadata.yml';
const LUETTELO = process.env.LUETTELO_URL
  || (REPO ? 'https://raw.githubusercontent.com/' + REPO + '/saadata/luettelo.json' : null);
const MIN_IKA_H = 2.5;
const MIN_VALI_H = 2;
const VANHA_H = 6;
const KESKEN = ['queued', 'waiting', 'pending', 'requested', 'in_progress'];

async function api(polku, asetukset) {
  const res = await fetch(API + '/repos/' + REPO + polku, Object.assign({
    headers: {
      authorization: 'Bearer ' + TOKEN,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  }, asetukset || {}));
  let json = null;
  if (res.status !== 204) { try { json = await res.json(); } catch (e) { json = null; } }
  return { status: res.status, json };
}

const viestit = [];
const kerro = (s) => viestit.push(s);
const tunteja = (ms) => (ms / 36e5).toFixed(1) + ' h';
const utc = (ms) => new Date(ms).toISOString().slice(0, 16).replace('T', ' ') + 'Z';

async function paata() {
  if (!REPO || !TOKEN || !HAARA || !LUETTELO) { kerro('Ei GitHub-ympäristöä (REPO/TOKEN/HAARA puuttuu) — ohitetaan.'); return; }
  const nyt = Date.now();

  /* Varaston tila luettelosta. */
  const r = await fetch(LUETTELO + '?t=' + Math.floor(nyt / 60000), { signal: AbortSignal.timeout(15000) });
  if (!r.ok) { kerro('Luetteloa ei saatu (HTTP ' + r.status + ') — ei päätöstä.'); return; }
  const l = await r.json();
  const luotu = Date.parse(l.luotu);
  const h0 = (l.tasot || []).concat(l.lisatasot || []).find((t) => t.id === 'h0');
  const fmiVarasto = h0 && h0.ajoAika ? Date.parse(h0.ajoAika) : 0;
  const ika = nyt - luotu;
  kerro('Varasto rakennettu ' + utc(luotu) + ' (' + tunteja(ika) + ' sitten), FMI-ajo '
    + (fmiVarasto ? utc(fmiVarasto) : 'puuttuu') + ', ECMWF ' + (l.ajoAika || '?') + '.');

  /* Portti 1. */
  if (!(ika >= MIN_IKA_H * 36e5)) { kerro('Alle ' + MIN_IKA_H + ' h edellisestä rakennuksesta — ei herätetä.'); return; }

  /* Syy: uudempi FMI-ajo, tai varasto yli VANHA_H vanha. */
  let fmiUusin = 0;
  try { fmiUusin = (await harmonieAjot())[0] || 0; } catch (e) { fmiUusin = 0; }
  kerro('FMI:n tuorein ajo: ' + (fmiUusin ? utc(fmiUusin) : 'luotain ei vastannut') + '.');
  const syy = fmiUusin > fmiVarasto ? 'FMI:llä uudempi ajo'
    : ika >= VANHA_H * 36e5 ? 'varasto yli ' + VANHA_H + ' h vanha' : null;
  if (!syy) { kerro('Varasto on FMI:n tuoreimmassa ajossa — ei herätetä.'); return; }

  /* Portti 2. */
  const a = await api('/actions/workflows/' + TYONKULKU + '/runs?per_page=10');
  if (a.status !== 200) { kerro('Ajolistaa ei voitu lukea (HTTP ' + a.status + ') — ei herätetä.'); return; }
  const ajot = (a.json && a.json.workflow_runs) || [];
  const kesken = ajot.find((x) => KESKEN.includes(x.status));
  if (kesken) { kerro('Säädata-ajo ' + kesken.id + ' on jo tilassa `' + kesken.status + '` — ei herätetä.'); return; }
  const tuore = ajot.find((x) => nyt - Date.parse(x.created_at) < MIN_VALI_H * 36e5);
  if (tuore) {
    kerro('Säädata-ajo ' + tuore.id + ' luotiin ' + tunteja(nyt - Date.parse(tuore.created_at))
      + ' sitten (' + (tuore.conclusion || tuore.status) + ') — seuraava yritys aikaisintaan '
      + MIN_VALI_H + ' h sen jälkeen.');
    return;
  }

  const d = await api('/actions/workflows/' + TYONKULKU + '/dispatches', {
    method: 'POST', body: JSON.stringify({ ref: HAARA }),
  });
  if (d.status === 204) kerro('Säädata lähetetty (' + syy + ').');
  else kerro('Säädatan lähetys epäonnistui (HTTP ' + d.status + (d.json && d.json.message ? ': ' + d.json.message : '') + ').');
}

try { await paata(); } catch (e) { kerro('Virhe: ' + e.message); }
console.log('### Säädatan herätin\n');
for (const v of viestit) { console.log('- ' + v); console.error('saaherate: ' + v); }
