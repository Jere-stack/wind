import { defineConfig } from 'vite';
import { pathToFileURL } from 'node:url';
import { existsSync } from 'node:fs';
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
    if (!/^[a-z0-9_-]+$/i.test(name) || !existsSync(file)) {
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
function versioLeima() {
  return {
    name: 'versio-leima',
    transformIndexHtml(html) {
      let sha = process.env.VERCEL_GIT_COMMIT_SHA || '';
      if (!sha) {
        try { sha = execSync('git rev-parse HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
          .toString().trim(); } catch (e) { /* ei git-repoa */ }
      }
      const lyhyt = sha ? sha.slice(0, 7) : 'dev';
      const aika = new Date().toISOString().slice(0, 16).replace('T', ' ');
      return html.replace(/__BUILD_ID__/g, lyhyt + ' · ' + aika + ' UTC');
    },
  };
}

export default defineConfig({
  plugins: [vercelApiDev(), versioLeima()],
  build: {
    outDir: 'dist',
  },
});
