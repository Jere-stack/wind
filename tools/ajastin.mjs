#!/usr/bin/env node
/* AJASTINKETJU — luotettava herätin havainnot-työnkululle ilman ulkoista
 * palvelua ja ilman avaimia (docs/data.md, "Katkot pois: kuvaaja, arkisto
 * ja ajastinketju").
 *
 *   node tools/ajastin.mjs        (työnkulun viimeinen askel)
 *
 * MIKSI. GitHubin ajastin ei käynnistänyt havainnot-työnkulkua kertaakaan
 * kuuteen tuntiin (29.9.2026, ~36 vuoroa), ja Säädatan ajastin laukeaa
 * 4–11 tunnin välein. Lähteen kuvaaja kattaa neljä tuntia, joten riittää
 * että keräin ajaa alle neljän tunnin välein — mutta sekään ei onnistu
 * GitHubin ajastimella.
 *
 * MITEN. Jokainen lenkki on havainnot-ajo, jonka ensimmäinen työ
 * (`odota`) viittaa ympäristöön `ajastin`. Ympäristön ODOTUSAJASTIN
 * (Settings → Environments → ajastin → Wait timer) pitää työtä jonossa
 * ilman konetta, eli odotus ei ole jatkuvasti pyörivä Actions-ajo
 * (CLAUDE.md kieltää sen). Odotuksen jälkeen keräin ajaa, ja tämä skripti
 * lähettää seuraavan lenkin: `workflow_dispatch` on ainoa GITHUB_TOKENin
 * tapahtuma joka käynnistää uuden ajon (GitHubin dokumentaatio).
 *
 * TURVALLISUUS — KETJU EI VOI KARATA:
 *   1. Uutta lenkkiä ei lähetetä ellei ympäristöllä ole vähintään
 *      MIN_ODOTUS_MIN minuutin odotusajastinta (luettu rajapinnasta).
 *      Ilman sitä skripti ei tee mitään, ja työnkulku toimii kuten ennen.
 *   2. Lenkki jatkaa ketjua vain jos se ODOTTI (lähetyshetki kulkee
 *      syötteenä `lenkki`). Jos ajastin ei jostain syystä pidätä työtä,
 *      ketju pysähtyy ensimmäiseen lenkkiin eikä ajoja synny minuutin
 *      välein.
 *   3. Jos jokin muu havainnot-ajo on jo jonossa, odottamassa tai
 *      käynnissä, uutta lenkkiä ei lähetetä: ketjuja on korkeintaan yksi.
 *   4. Katkennut ketju käynnistyy uudelleen seuraavasta muusta ajosta
 *      (Säädatan perään, GitHubin ajastin, käsiajo).
 *
 * Skripti ei koskaan kaada ajoa: virhe kirjataan yhteenvetoon. */

const API = process.env.GITHUB_API_URL || 'https://api.github.com';
const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN;
const AJO = String(process.env.GITHUB_RUN_ID || '');
const HAARA = process.env.GITHUB_REF_NAME;
const LENKKI = Number(process.env.LENKKI || 0);
const YMPARISTO = 'ajastin';
const TYONKULKU = 'havainnot.yml';
/* Ajastinta lyhyempi odotus ei ole ketju vaan silmukka. Viisi minuuttia
   on reilusti yli GitHubin tavallisen jonoviiveen. */
const MIN_ODOTUS_MIN = 5;
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

async function paata() {
  if (!REPO || !TOKEN || !HAARA) { kerro('Ei GitHub-ympäristöä (REPO/TOKEN/HAARA puuttuu) — ohitetaan.'); return; }

  /* 1. Onko odotusajastin asetettu? */
  const y = await api('/environments/' + YMPARISTO);
  let ajastinMin = 0;
  if (y.status === 200) {
    const saanto = ((y.json && y.json.protection_rules) || []).find((r) => r.type === 'wait_timer');
    ajastinMin = saanto ? Number(saanto.wait_timer) || 0 : 0;
  } else if (y.status !== 404) {
    kerro('Ympäristöä `' + YMPARISTO + '` ei voitu lukea (HTTP ' + y.status + ') — ketjua ei jatketa.');
    return;
  }
  if (ajastinMin < MIN_ODOTUS_MIN) {
    kerro('Ympäristöllä `' + YMPARISTO + '` ei ole odotusajastinta (' + ajastinMin + ' min, vähintään '
      + MIN_ODOTUS_MIN + ') — ajastinketju ei ole käytössä. Ohje: docs/data.md, "Katkot pois".');
    return;
  }

  /* 2. Lenkki joka ei odottanut ei jatka. */
  if (LENKKI) {
    const odotti = (Date.now() - LENKKI) / 60000;
    if (!(odotti >= MIN_ODOTUS_MIN)) {
      kerro('Tämä lenkki odotti vain ' + odotti.toFixed(1) + ' min (ajastin ' + ajastinMin
        + ' min) — ketju pysäytetään, jottei ajoja synny minuutin välein.');
      return;
    }
    kerro('Lenkki odotti ' + odotti.toFixed(1) + ' min.');
  }

  /* 3. Korkeintaan yksi ketju. */
  const r = await api('/actions/workflows/' + TYONKULKU + '/runs?per_page=20');
  if (r.status !== 200) { kerro('Ajolistaa ei voitu lukea (HTTP ' + r.status + ') — ketjua ei jatketa.'); return; }
  const muut = ((r.json && r.json.workflow_runs) || []).filter((a) => String(a.id) !== AJO && KESKEN.includes(a.status));
  if (muut.length) {
    kerro('Ajo ' + muut[0].id + ' on jo tilassa `' + muut[0].status + '` — uutta lenkkiä ei lähetetä.');
    return;
  }

  /* 4. Seuraava lenkki. */
  const d = await api('/actions/workflows/' + TYONKULKU + '/dispatches', {
    method: 'POST',
    body: JSON.stringify({ ref: HAARA, inputs: { lenkki: String(Date.now()) } }),
  });
  if (d.status === 204) kerro('Seuraava lenkki lähetetty; se kerää ' + ajastinMin + ' min kuluttua.');
  else kerro('Lenkin lähetys epäonnistui (HTTP ' + d.status + (d.json && d.json.message ? ': ' + d.json.message : '') + ').');
}

try { await paata(); } catch (e) { kerro('Virhe: ' + e.message); }
console.log('### Ajastinketju\n');
for (const v of viestit) console.log('- ' + v);
