import { defineConfig, minifySync } from 'vite';
import { pathToFileURL } from 'node:url';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { execSync } from 'node:child_process';

/* Ajaa api/*.js -serverless-funktiot Viten dev- ja preview-serverissa.
 * Ilman tata frontend joutuisi kutsumaan API:a tuotannosta, jolloin
 * paikallinen kehitys riippuisi ulkoisesta deploysta — ja sivu voisi
 * puhua eri versiolle API:a kuin mita repossa on.
 *
 * Funktiot ovat Vercel-tyylisia (req, res) -kasittelijoita, joten Noden
 * raakaan req/res-pariin lisataan ne kentat joita ne kayttavat. */
function vercelApiDev() {
  const middleware = async (req, res, next) => {
    if (!req.url || !req.url.startsWith('/api/')) return next();

    const url = new URL(req.url, 'http://localhost');
    const name = url.pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
    const file = resolve(process.cwd(), 'api', name + '.js');
    /* Alaviivalla alkava tiedosto on apumoduuli (esim. `_suoja.js`), ei
       reitti — sama sääntö kuin Vercelillä. */
    if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name) || !existsSync(file)) {
      res.statusCode = 404;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: 'no such api route: ' + name }));
      return;
    }

    /* Vercelin req.query */
    req.query = Object.fromEntries(url.searchParams);

    /* Vercelin res.status().json() */
    res.status = (code) => { res.statusCode = code; return res; };
    res.json = (obj) => {
      if (!res.getHeader('Content-Type')) res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(obj));
      return res;
    };

    try {
      /* Aikaleima kyselyssa -> muutokset api-tiedostoihin näkyvät ilman
         dev-serverin uudelleenkäynnistystä */
      const mod = await import(pathToFileURL(file).href + '?t=' + Date.now());
      await (mod.default || mod)(req, res);
      if (!res.writableEnded) res.end();
    } catch (err) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ error: String(err && err.message || err) }));
    }
  };

  return {
    name: 'vercel-api-dev',
    configureServer(server) { server.middlewares.use(middleware); },
    configurePreviewServer(server) { server.middlewares.use(middleware); },
  };
}

/* Versioleima index.html:aan.
 *
 * Sovellus on yksi HTML-tiedosto ilman hajautettuja tiedostonimiä, joten
 * jos selain tai CDN tarjoaa vanhan index.html:n, koko sovellus on vanha
 * eikä siitä näy mitään ulospäin. Leima kertoo suoraan käyttöliittymästä
 * kumpaa versiota katsotaan, jolloin "eikö muutos mennyt läpi" -kysymys
 * ratkeaa katsomalla eikä arvaamalla.
 *
 * Commit tulee Vercelin ympäristömuuttujasta; paikallisesti se luetaan
 * gitistä. Jos kumpikaan ei ole saatavilla, leima on 'dev'. */
function tunnus() {
  let sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
  if (!sha) {
    try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString().trim(); } catch (e) { /* ei git-repoa */ }
  }
  const lyhyt = sha ? sha.slice(0, 7) : 'dev';
  const aika = new Date().toISOString().slice(0, 16).replace('T', ' ');
  return lyhyt + ' · ' + aika + ' UTC';
}

function versioLeima() {
  let ulos = 'dist';
  return {
    name: 'versio-leima',
    configResolved(cfg) { ulos = cfg.build.outDir; },
    /* Sama leima sw.js:aan. Service worker paivittyy vain jos sen TAVUT
       muuttuvat — ilman leimaa uusi deploy jattaisi vanhan workerin ja sen
       mukana vanhan kuorivalimuistin voimaan. public/ kopioidaan
       sellaisenaan, joten korvaus tehdaan vasta kirjoituksen jalkeen. */
    writeBundle() {
      const t = resolve(process.cwd(), ulos, 'sw.js');
      if (!existsSync(t)) return;
      writeFileSync(t, readFileSync(t, 'utf8').replace(/__BUILD_ID__/g, tunnus()));
    },
    transformIndexHtml(html) {
      return html.replace(/__BUILD_ID__/g, tunnus());
    },
  };
}

/* MapLibre samasta originista kuin sivu (docs/julkaisu.md, L2).
 *
 * Kirjasto ladattiin jsDelivristä estävänä skriptinä: latausruutu ei
 * piirtynyt ennen kuin 1 MB kirjastoa oli perillä, ja CDN:n katko tai
 * suodatus (koulu- ja yritysverkot) tappoi ensikäynnin kokonaan. Nyt se
 * kopioidaan npm-paketista `public/vendor/`iin VERSIOIDULLA nimellä, joten
 * Vite jättää viittauksen rauhaan ja kopioi tiedoston buildiin sellaisenaan,
 * ja dev-serveri tarjoilee sen samasta paikasta. Versio on nimessä, koska
 * service worker ja Vercel välimuistittavat sen muuttumattomana.
 *
 * `index.html`:n osoite on kirjoitettu käsin (luettavuus), joten build
 * kaatuu jos se ja asennettu paketti ovat eri versiota — muuten sivu
 * hakisi tiedostoa jota ei ole. */
function karttakirjasto() {
  const juuri = process.cwd();
  const paketti = resolve(juuri, 'node_modules/maplibre-gl');
  const versio = JSON.parse(readFileSync(resolve(paketti, 'package.json'), 'utf8')).version;
  const nimi = 'maplibre-gl-' + versio;
  function kopioi() {
    const kohde = resolve(juuri, 'public/vendor');
    mkdirSync(kohde, { recursive: true });
    for (const paate of ['.js', '.css']) {
      const lahde = readFileSync(resolve(paketti, 'dist/maplibre-gl' + paate), 'utf8')
        /* Lähdekarttaa ei kopioida, joten viittaus siihen pois — muuten
           kehitystyökalut pyytäisivät tiedostoa jota ei ole. */
        .replace(/\n\/\/# sourceMappingURL=\S+\s*$/, '\n');
      const t = resolve(kohde, nimi + paate);
      if (!existsSync(t) || readFileSync(t, 'utf8') !== lahde) writeFileSync(t, lahde);
    }
  }
  return {
    name: 'karttakirjasto',
    config() { kopioi(); },
    transformIndexHtml(html) {
      if (!html.includes('/vendor/' + nimi + '.js') || !html.includes('/vendor/' + nimi + '.css')) {
        throw new Error('index.html ei viittaa asennettuun MapLibreen (' + nimi + ')');
      }
      return html;
    },
  };
}

/* Inline-skriptit ja -tyylit tiivistetään buildissa (docs/julkaisu.md, L8).
 *
 * Lähde on tarkoituksella kommenttien kyllästämä — kommentit ovat
 * mittauspöytäkirjoja — ja mitattuna kommentit ja sisennys olivat 61 %
 * siirrettävästä: gzip 391 kB -> 152 kB. Nimiä EI lyhennetä: skriptin
 * ylätason nimet ovat globaaleja, ja niitä kutsutaan `onclick`-
 * attribuuteista ja `?perf=1`-mittareista. Ei myöskään muita
 * muunnoksia (`compress: false`): tavoite on sama ohjelma ilman
 * kommentteja, ei eri ohjelma.
 *
 * Sivuvaikutus joka on korjaus: jäsennysvirhe inline-skriptissä
 * KAATAA buildin. Ennen se meni läpi ja kaatoi vasta selaimen (CLAUDE.md,
 * "npm run build:n läpimeno ei ole todiste mistään"). */
function tiivistys() {
  return {
    name: 'tiivistys',
    apply: 'build',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const lohkot = [];
        const talteen = (s) => '\u0000' + (lohkot.push(s) - 1) + '\u0000';
        let ulos = html.replace(/<script\b([^>]*)>([\s\S]*?)<\/script>/g, (m, attr, koodi) => {
          if (/\bsrc=/.test(attr) || (/\btype=/.test(attr) && !/type=["']?(text\/)?javascript/.test(attr))) {
            return talteen(m);
          }
          const r = minifySync('inline.js', koodi, { compress: false, mangle: false });
          if (r.errors && r.errors.length) {
            throw new Error('inline-skriptin jäsennys epäonnistui: '
              + r.errors.map((e) => e.codeframe || e.message || String(e)).join('\n'));
          }
          return talteen('<script' + attr + '>' + r.code + '</script>');
        });
        /* CSS:stä vain kommentit ja sisennys. Oikea CSS-minifioija
           (lightningcss) yhdisti `-webkit-backdrop-filter`in
           etuliitteettömään ja pudotti sen — iOS-Safari ennen 18:aa menetti
           pillerien ja nappien lasin. Lähteessä ei ole `/*`-merkkejä
           merkkijonojen sisällä (tarkistettu), joten poisto on turvallinen. */
        ulos = ulos.replace(/<style\b([^>]*)>([\s\S]*?)<\/style>/g, (m, attr, css) => {
          const tiivis = css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n');
          return talteen('<style' + attr + '>' + tiivis.trim() + '</style>');
        });
        ulos = ulos
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/\n[ \t\n]+/g, '\n');
        return ulos.replace(/\u0000(\d+)\u0000/g, (m, i) => lohkot[+i]);
      },
    },
  };
}

export default defineConfig({
  plugins: [vercelApiDev(), versioLeima(), karttakirjasto(), tiivistys()],
  build: {
    outDir: 'dist',
  },
});
