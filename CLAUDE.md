# FoilSpot v7

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (MapLibre GL) + tuuliennusteet
(oma säälaattavarasto, FMI HARMONIE, Open-Meteo, FMI-havaintoasemat) yhdessä
self-contained HTML-sivussa.

## Ajokomennot

```bash
npm install       # asenna riippuvuudet
npm run dev       # käynnistä Vite dev-serveri (http://localhost:5173)
npm run build     # tuota tuotantobuild hakemistoon dist/
npm run preview   # esikatsele tuotantobuildia paikallisesti
npm run saadata   # rakenna säälaatat (tools/tiilet.mjs)
```

## Rakenne

- `index.html` — koko sovellus: CSS, HTML ja JS yhdessä tiedostossa (ei erillistä
  `src/`-hakemistoa). MapLibre GL JS 5 (UMD) ladataan SAMASTA
  originista (`/vendor/maplibre-gl-<versio>.js`, `defer`): Viten
  `karttakirjasto`-plugin kopioi sen npm-paketista `public/vendor/`iin
  (gitignoressa), ja build kaatuu jos `index.html`:n versio ja
  `package.json`:n `maplibre-gl` eroavat — päivitä molemmat ja
  `public/sw.js`:n kuorilista yhdessä. Leafletia ei ole enää: `L` on sovelluksen oma
  pieni yhteensopivuuskerros (`L.marker`, `L.latLng`, `L.Util`…) ja
  `State.map` on `KarttaGL`, Leafletin muotoinen julkisivu jonka
  `map.ml` on varsinainen MapLibre-kartta. Lämpökartta (`LampoGL`),
  partikkelit (`PartikkeliGL`) ja sadekerros (`SadeKerros`, tutka ja HARMONIE-sade) piirtyvät
  MapLibren omaan WebGL-ruutuun custom layereina.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  mallin oma hila Open-Meteon S3:sta — ECMWF 9 km, ICON, GFS — kenttänä ja
  sarjana (`malli.js`),
  aaltoennuste, vedenkorkeus, sade-ennuste GRIB2:sta ja sadetilan
  pistesarja (`sade.js?sarja=1`: tutkan tuntikertymä, vartit, HARMONIE,
  MET Norwayn nowcast), ECMWF:n sade jatkoksi (`malli.js?muuttuja=sade`),
  FMI:n aaltopoijut, Kruunuvuorenselän, Mellstenin, Larun ja Uiraan
  mittausdata-proxyt (Larun proxy kertoo myös kelikameran tilan,
  `laru.js?kamera=1`), selaimen virheraportit `virhe.js`).
  **FUNKTIOITA ON 12, JA SE ON VERCELIN HOBBY-TASON KATTO DEPLOYTA
  KOHTI**: kolmastoista (`api/kamera.js`) kaatoi tuotantodeployn
  ("Deployment has failed") eikä mikään muuttunut tuotannossa. Uusi
  reitti on tila olemassa olevassa funktiossa (kyselyparametri), ei
  uusi tiedosto — ja tarkista deployn tila commitin statuksesta
  (`api.github.com/repos/Jere-stack/wind/commits/<sha>/status`).
  ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
  Alaviivalla alkava tiedosto (`_suoja.js`, `_haku.js`, `_mellsten.js`,
  `_laru.js`, `_varasto.js`, `_kamerat.js`, `_gif.js`) on apumoduuli eikä
  reitti. `_haku.js` on FMI-proxyjen yhteinen haku: tila ja
  ExceptionReport tarkistetaan ja aikaraja on koko haulle — ylävirran
  virhe on 502, ei `no data` (docs/oikeellisuus.md, O5).
  **Jokainen funktio alkaa `if (!suojaa(req, res)) return;`** eikä
  mikään vastaa `Access-Control-Allow-Origin`illa (docs/julkaisu.md,
  L10): sovellus kutsuu samasta originista, ja jokeri antoi kenen
  tahansa sivun käyttää palvelun FMI- ja Open-Meteo-kiintiötä.
- `tools/savutesti.mjs` + `.github/workflows/ci.yml` ("Tarkistus") —
  jokaisella pushilla `node --check api/*.js`, build ja Playwright-
  savutesti (latausruutu poistuu, aikajana ja merkit syntyvät, kortti,
  asetukset ja Tietoa aukeavat, Esc sulkee, ei `pageerror`ia). Paikallisesti
  `PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs
  node tools/savutesti.mjs http://localhost:4173`.
- `tools/graafimittaus.mjs` — kaaviomoottorin regressiotesti ja
  mittaus (akselit zoomeittain, tarttuva päiväys, hiiri, näppäimet, zoom-
  napit, navigaattori, käyrän muoto, huiput, asteikon sovitus, kosketus
  CDP:llä: pito + veto) synteettisellä sarjalla, ei verkkoa; jokainen rivi
  `ok`/`VIKA`, poistumiskoodi 1 vialla. CI ajaa sen savutestin perään
  (`Savutesti ja graafitesti`). Ks. docs/graafit.md, luku 7.
- `tools/korttimittaus.mjs` — spottikortin ja laajan näkymän mittari
  (docs/spottikortti.md, luku 8): korkeudet 127 tunnin, leveyksien
  320–430 px, kielten, ennusteiden ja mallimäärien yli, puoliksi näkyvät
  ja katkaistut tekstit, kupla, avauksen siirtymät, kahdennukset,
  tyylien määrä ja regressiot (kortti = Paras = aikajana, merkki =
  indeksi). Mallisarjat ISTUTETAAN (`KorttiSarjat._m`, avain
  kiinnitetty), joten luvut eivät riipu verkosta eivätkä tunnin
  vaihtumisesta. Ei CI:ssä: havainnot, aallot ja vedenkorkeus tulevat
  oikeista palveluista, ja täysi ajo kestää noin 20 min (`--osat=`,
  `--nopea`).
- `tools/sademittaus.mjs` ja `tools/sadeliike.mjs` — sadetutkan mittarit
  (docs/sadetutka.md, luku 10): kuvakaappaus ja FMI:n oma 250 m kuva
  vertailuun, laattapyynnöt, FMI:n vastausten tallennus/toisto; ja
  liikekompensoitu interpolointi ja nowcast oikeita tutkakehyksiä vasten
  (MAE, CSI, FSS). Ei CI:ssä (oikea tutkadata). Kontin Chromium tarvitsee
  `--ignore-certificate-errors`in, muuten openwms-kuvat kaatuvat.
- `tools/havainnot.mjs` + `.github/workflows/havainnot.yml` —
  Espoo Haukilahden (Mellsten) historian keräin: joka ajolla lähteen
  30 minuutin tekstirivit JA 4 tunnin kuvaaja (`plot.gif` minuutti-
  riveiksi, `api/_mellsten.js` + `api/_gif.js`) ja tunnin välein lähteen
  arkisto orpoon haaraan `havainnot` (`mellsten/YYYY-MM-DD.txt`, 31 vrk).
  `api/mellsten.js` lukee sen. Vain Noden omia moduuleita. Herättimet:
  ajastin (ei laukea), jokaisen Säädata-ajon perään (`workflow_run`) ja
  ajastinketju (`tools/ajastin.mjs`, käyttöön ympäristön `ajastin`
  odotusajastimella). Ks. docs/data.md, "Mellstenin historia omaan
  varastoon" ja "Katkot pois". Samassa ajossa omana askeleenaan
  `tools/laru.mjs` (`continue-on-error`) kopioi Larun PÄÄTTYNEET päivät
  (`laru/YYYY-MM-DD.txt`), joita `api/laru.js` lukee (docs/data.md,
  "Larun historia"). Varaston luku, Helsingin kalenteri ja niputus ovat
  yhteisiä: `api/_varasto.js`. Samassa ajossa `tools/kamerat.mjs`
  (`continue-on-error`) kirjaa kelikameroiden pikkukuvan ETagin
  (`kamerat/tila.json`), josta `api/laru.js?kamera=1` päättelee onko kamera
  päällä (docs/data.md, "Larun kelikamera"). Samassa ajossa myös
  `tools/saaherate.mjs` (lähettää Säädatan kun FMI:llä on varastoa
  uudempi ajo, O1) ja `tools/varmennus.mjs` (varaston ennuste arkistoon
  ja havaintoja vasten, `varmennus/`, O11) — docs/oikeellisuus.md.
- `tools/tiilet.mjs` — säälaattojen rakennus kolmesta mallista: ECMWF
  (AWS Open Data, koko maapallo), FMI:n HARMONIE (Suomi) ja MET Nordic
  (Yr:n data, Pohjoismaat ja Baltia). Ajetaan GitHub Actionsissa neljästi
  vuorokaudessa ajastimella ja lisäksi kun FMI:llä on uudempi ajo
  (`tools/saaherate.mjs`), noin 8–10 min ja 107 MB. ECMWF-puuskan aukot
  (analyysihetki, +93 … +144 h) täytetään rakennuksessa (O8).
- `tools/pyramidi.mjs` — säännöllisestä hilasta suodatettu laattapyramidi
  ja painokanava; kaikki kolme mallia kirjoitetaan sen kautta.
- `tools/harmonie.mjs` — FMI HARMONIE 2,5 km hilana GRIB2:sta (tasot
  `h0`–`h3`), ajo kiinnitettynä `origintime`lla.
- `tools/metnordic.mjs` — MET Nordic 1 km Lambert-hilasta säännölliseksi
  0,05°:n hilaksi (tasot `n0`–`n3`).
- `tools/wam.mjs` — FMI WAM -aaltoennuste hilana GRIB2:sta (tasot
  `a0`–`a3`, luettelon OMA avain `aallot`), jakso pistekyselystä.
  `tiilet.mjs` ajaa sen viimeisenä omassa try/catchissaan (`AALLOT=0`
  ohittaa); suoraan `node tools/wam.mjs <hakemisto>` mittausta varten.
- `tools/ikoni.mjs` — sovelluksen merkin (siipi ja spotti) ainoa lähde:
  kirjoittaa `public/icon.svg`:n, `--png` koko PNG-sarjan ja `--inline`
  latausruudun merkkilähteen (`#lr-merkki-lahde`: siiven ja pallon
  symbolit, avautumisen geometria ja tuulijuovien värit). Rasterointi
  Chromiumilla; tiedostot ovat repossa valmiina, joten build ei tarvitse
  tätä. Ks. `docs/pwa.md`.
- `tools/suunnat.html` — spottien tuulisuuntien asetustyökalu. `npm run dev`,
  sitten `/tools/suunnat.html`. Ei kuulu tuotantobuildiin. Lukee spotit
  `index.html`:stä ajossa, joten lista ei vanhene.
- `public/sw.js` — service worker. `__BUILD_ID__` korvataan buildissa.
- `vite.config.js` — build-asetukset sekä `vercel-api-dev`-plugin, joka ajaa
  `api/*.js`-funktiot myös `npm run dev`- ja `npm run preview` -servereissä.
- `vercel.json` — Vercel-deployn asetukset.
- `docs/*.md` — muistiinpanot tehdyistä päätöksistä ja mittauksista. **Ei ladata
  automaattisesti** — lue se tiedosto jonka aihetta työ koskee (hakemisto alla).

## API-osoitteet ja deploy

Frontend käyttää vakiota `API_BASE = '/api'`, eli funktiot haetaan aina samasta
originista kuin sivu — niin tuotannossa kuin devissä. Koodissa ei ole yhtään
absoluuttista host-osoitetta omaan palveluun, joten sivu ja API ovat aina samaa
versiota.

Vercel ajaa `npm run build`:n ja julkaisee `dist/`-hakemiston sekä
`api/`-funktiot. Deployn tulee tapahtua tästä reposta, jotta sivu ja sen
`/api`-funktiot pysyvät samassa versiossa.

**TUOTANTO ON REPON OLETUSHAARA `claude/vite-project-setup-6je1pq`, EI
`main`.** Vercelin tuotantodeploy seuraa sitä ja julkaisee osoitteeseen
`wind-delta.vercel.app`; muut haarat saavat vain preview-deployn. Repossa ei
ole `main`- eikä `master`-haaraa lainkaan.

**Valmis muutos viedään oletushaaralle, oletuksena ja kysymättä.** Työ tehdään
omalla haarallaan ja siirretään sieltä fast-forwardilla — ei erillistä
sulautuscommittia. Ilman tätä askelta muutos ei ole siinä osoitteessa josta
sovellusta käytetään, ja se on maksanut kolme kierrosta: kolme peräkkäistä
aikajanan korjausta raportoitiin rikkinäisiksi, ja jokainen raportti oli tehty
deploysta jossa niitä ei ollut.

Säälaatat ovat orpossa `saadata`-haarassa (aina tasan yksi committi,
pakkopäivitys), ja sama työ julkaisee ne GitHub Pagesiin. Sovellus
kokeilee ensin Pagesia (`jere-stack.github.io/wind/`) ja sitten
`raw.githubusercontent.com`:ia (`SAALAATAT_KANNAT`); KAIKKI laatat haetaan
siitä kodista josta luettelo tuli, ja toimiva koti muistetaan
(`fs_saakanta`). Pages on 404 kunnes se kytketään repon asetuksista
päälle — siihen asti raw hoitaa kaiken ja konsoliin tulee yksi
CORS-virhe, joka ei ole vika.

Havaintoasemien oma historia on orpossa `havainnot`-haarassa (sama
malli: yksi committi, pakkopäivitys, kymmenen minuutin välein). Vercel
(`git.deploymentEnabled`) ja Tarkistus (`branches-ignore`) ohittavat
molemmat datahaarat — jos lisäät kolmannen, lisää se molempiin.

---

## Muistiinpanot — mistä mikäkin löytyy

Nämä ovat mittauspöytäkirjoja, eivät johdantoja: jokainen kertoo mitä kokeiltiin,
mitä mitattiin ja miksi lopputulos on tällainen. **Lue aihetta vastaava tiedosto
ennen kuin muutat sen aluetta** — moni ilmeiseltä näyttävä parannus on jo
kokeiltu ja kaadettu mittauksella.

| tiedosto | lue kun työ koskee |
|---|---|
| `docs/lampokartta.md` | pohjakarttaa, lämpökarttaa, väriramppia, tekstuurin mitoitusta tai projektiota, kartan asetuksia |
| `docs/partikkelit.md` | tuulipartikkeleita, jäljen muotoa, tiheyttä tai ruutuaikabudjettia |
| `docs/eleet.md` | nipistystä, zoomia, zoom-aluetta, inertiaa, kosketuskohteita tai kerrosten tahtia eleen jälkeen — **alkuosa kertoo mikä on Leaflet-historiaa** |
| `docs/data.md` | **aaltoennustetta kartalla (FMI WAM, `a0`–`a3`, `tools/wam.mjs`)**, säälaattoja, rajapintoja, tuulikentän rakennusta, välimuisteja, käynnistystä, aaltopoijuja, **havaintoasemien oma historia (Mellsten ja Laru, `havainnot`-haara)**, **Mellstenin katkot: 4 h kuvaaja, arkistovaratie ja ajastinketju**, **kelikameran tila (YouTube, pikkukuvan ETag)** |
| `docs/mallit.md` | **kartan säämallia ja sen valintaa, mallien rajoja ja niiden pehmennystä, varaston tasoja ja niiden alueita, MET Nordicia, Open-Meteon S3-malleja** |
| `docs/ui.md` | **väriteemaa (Yömeri: paneelit, tokenit, `Teema`, `ink()`)**, **kerrosvalitsinta (neljä ruutua esikatselukuvin) ja sadekerroksen GL-piirtoa (häivytykset, B-spline; silmukka on historiaa, ks. docs/sadetutka.md)**, **aaltokerrosta: siru, väri, aallonharjat, aikajana, kapseli, poijukaavion ennuste**, paletteja, **sateen väriasteikkoa**, paneeleita, spottikorttia, aikajanaa (**toiston liuku, jatkuva päiväkisko, pehmeä valinta ja kelikaista**), kapselia, havaintoasemia, **latausruutua ja sovelluksen merkkiä**, **kelikameraa asemakortissa ja pillerin play-kolmiota**, **kieltä: suomi ja englanti, käännösmekanismi ja sanasto** |
| `docs/pwa.md` | service workeria, offline-käynnistystä, kotivalikon appia tai **ikonitiedostoja ja manifestia** |
| `docs/lisadata.md` | uuden datan tai uuden lähteen lisäämistä — mitä on kokeiltu, mikä kaatui mittaukseen |
| `docs/spottikortti.md` | **spottikortin uudistusta: tuulikaavio (meteogrammi), kortin pääsarja, mallivalikko, kortin rakenne, yhtenäiset komponentit, kaavion venytys** — strategia, päätökset P1–P9 ja toteutuksen mittaukset (V0–V11: yksi kaaviomoottori, kortti moduuleina, fonttilattia, laajan valinta, venytys, mallit laajassa, **ennustevalikko, kiinteä lukemarivi ja selkeämpi päiväys**), ja **luku 8: rauhallinen ja vakaa kortti (strategia 3.10., päätetty suosituksen mukaan — kupla jää kiinteän kokoisena; toteutus V12–V16 ja mittari `tools/korttimittaus.mjs`): mallilukemat näkyviin laajassa, ei koon muutoksia, kahdennukset pois, kaavion teksti vain kokonaisena, kuusi kirjasinkokoa ja desimaalipilkku** |
| `docs/sujuvuus.md` | **työpöydän** zoomin ja panoroinnin raskautta, windy.comin arkkitehtuuria, sujuvuusstrategiaa, **MapLibre-siirtoa (C2) ja sen mittauksia** |
| `docs/julkaisu.md` | **julkaisukelpoisuutta**: UI-parannusten top 25, suositusjärjestys ja logiikan 10 kriittisintä kohtaa (27.9.), ja **osa 4: mitä niistä toteutettiin 28.9. ja mikä jäi auki** (Pages, lisenssit, pohjakartan kieli) — lue ennen kuin toteutat jonkin niistä, ja merkitse tehdyt |
| `docs/graafit.md` | **kaavioiden vuorovaikutusta ja akseleita** (strategia ja toteutus 30.9., V1–V6): hiiren veto, kosketuksen "pidä ja liu'uta", käyrän pehmennys, x- ja y-akselin tiedot joka zoomilla, asteikko ikkunan mukaan — mittaukset (`tools/graafimittaus.mjs`), päätökset P1–P10, vaiheet ja toteutuksen poikkeamat; lue ennen kuin kosket `Tuulikaavio`on, `Aikakaavio`n osoittimeen tai kaavioiden akseleihin |
| `docs/sadetutka.md` | **sadetutkaa ja sadetilaa (strategia ja toteutus 4.10.; luku 11: koko maailma ja paras paikallinen malli, beta)**: 250 m FINRAD-lähde ja paletti, klassinen tutkaväri, 5 min kehykset, vartit aikajanalla, sadepalkit ja kapseli, liikekenttä (`SadeLiike`) ja nowcast, ECMWF-jatko — mitattu data (FMI WMS ja S3, MET Norway), päätökset P1–P9, toteutus luvussa 10 ja mittaukset (`tools/sadeliike.mjs`); lue ennen kuin kosket `SadeKerros`iin, `Sadetutka`an, `SadeLiike`en tai sadetilan aikajanaan |
| `docs/oikeellisuus.md` | **datan oikeellisuutta** (auditointi 29.9., toteutus 30.9.): varasto havaintoja vasten, **jatkuva varmennus**, **varaston tuoreus ja Säädatan ajastin**, kapselin ja partikkelien taso vs lämpökartta, **kapselin puuska**, havaintoverkko ja sen päivitys, proxyjen virheenkäsittely, UiRaS — aukot O1–O11, suositusjärjestys ja sujuvuusvaikutus; lue ennen kuin toteutat jonkin niistä, ja merkitse tehdyt |

<details>
<summary>Osioiden nimet tiedostoittain (jos et tiedä mistä etsiä)</summary>

- **lampokartta**: Lämpökartta on GL-kerros MapLibren ruudussa ·
  Pohjakartta · Lämpökartta pohjakartan päällä · Lämpökartta on
  canvas, ei PNG · Väriasteikko — vain asetuspaneelissa · Lämpökartta jäi väärään
  mittakaavaan ulos zoomatessa · Kartan asetukset · Lämpökartan värit olivat eri
  kohdissa eri zoomeilla · Lämpökartta oli väärässä projektiossa · Nopea zoom ei
  saa näyttää mustaa · Zoomin välkky uudestaan — ja se ei ollutkaan
  häivytys · Hyppy häivytetään
- **partikkelit**: Partikkelit piirtyvät kartan GL-ruutuun · Sujuvuus —
  mitattu, ei arvattu · Partikkelit ovat tasaisia —
  maa/vesi-rajaus kokeiltiin ja poistettiin · Rakeisuus oli kahta eri vikaa ·
  Kolme jatkokorjausta: heitto, lähizoomin terävyys, tiheys ·
  Jälki lyhennettiin puoleen — raja puree, aikapituus ei ·
  Liike ajasta, pää ei sahaa, syntymä ja kuolema häivytetään
- **eleet**: Kartta on MapLibre GL — mikä tästä tiedostosta on historiaa ·
  Kosketuskohteet ja pseudoelementtien osumapinta · Zoom-alue ·
  Nipistyszoomin pehmennys · Eleen loppu ja tuntuma — kolme asiaa Apple Mapsista ·
  Kaksi kokeilua jotka eivät jääneet · Yhden sormen zoom oli rikki — neljä eri
  vikaa · Uloin näkymä rajattiin — ja se muutti kaiken muun · Lämpökartan
  jäädytys eleen aikana · Uloin raja: vastusta, ei mustaa · Kerrosten tahti
  eleen jälkeen
- **data**: Verkkotila · Ensilataus — mihin aika menee · Käynnistys: välimuisti
  ruudulle ennen verkkoa · Käynnistyksen pyyntömäärä · Säädata koko maailmalle ·
  Lähdemerkintä ja aina automaattinen malli · Uloin näkymä — 44 % roskaa ·
  Oma säädatavarasto — pois rajapinnan kiintiöstä · Tallennustila ei ollutkaan
  este · Hilalähtöinen kenttä · Zoom raskaampi kuin ennen · Aaltopoijut —
  havaintoa, ei ennustetta · Aikajana ja kartta näyttivät eri
  lukua · Mellsten (Haukilahti) — kolmas oma proxy · Varaston puuska on
  joka toisella askeleella tuuli · Laru (Lauttasaari) — neljäs oma proxy ·
  **Mellstenin historia omaan varastoon — kuten Windguru** ·
  **Larun historia — sama varasto, mutta lähde pitää päivänsä itse** ·
  **Katkot pois: kuvaaja, arkisto ja ajastinketju** ·
  Aaltoennuste tuotantoon (FMI WAM, ei laattaputkea) · Vedenkorkeus ja
  yksikkö joka ei lue vastauksessa · Ilman starttimea sarja alkaa
  seuraavasta tunnista · Sadetutka — miksi se ei ole L.TileLayer.WMS ·
  Tutkan silmukka — kehykset löytyvät luotaamalla ·
  Puuskaisuus oli koodissa mutta ei näkyvissä ·
  Sadetutka seuraa aikajanaa — ja jatkuu ennusteena ·
  Tuulikerrokset ja sadekerros ovat toisensa poissulkevat ·
  Sateen asteikko: FMI:n omat selitteet siltana dBZ:n ja mm/h:n välillä ·
  Spottikortin havaintoasema tuli väärästä listasta ·
  "Miksi Helsingin yllä ei tule FMI:tä" — se tulee, mutta ei sanonut sitä ·
  Kartan säämalli valittavaksi · HARMONIE varastoon ja zoomin välkky ·
  **Larun kelikamera — kuva kertoo, YouTuben live-lippu ei** ·
  **Aallot kartalle — WAM säälaattavarastoon**
- **mallit**: Tiivistelmä · Tavoitteet · Nykytila mitattuna (varaston
  tasot, zoom ja taso, maailmankierros ja paluu, rajojen hyppy, mitä
  S3:ssa on, Windy) · Strategiat S1–S4 · Mihin lukittuihin sääntöihin S1
  koskee · Avoimet kysymykset · Toteutus: päätösten tarkennukset ·
  V1 valittu hetki pysyy · V2 rakentaja (kolme pyramidia, painokanava,
  FMI:n ajot, MET Nordicin luku, koko ja kesto) · V3 sovellus (yksi
  valintasääntö, sekoitus, laattamuisti, lähdemerkintä) · V4 aikajana ·
  Tarkistukset lähteitä vasten · V5 ECMWF 9 km (O1280,
  aikasarjavarasto, kaksi ansaa, mittaukset) · V6 pakotettu malli
  perheinä ja mallin omana hilana (tilat, ICON ja GFS, tuntipaketti,
  kolme ansaa, mittaukset) · Mitä jäi
- **lisadata**: Mistä sovellus lukee nyt · TOP 10 — data · TOP 10 — lähteet ·
  Mitattu ja hylätty (MEPS on HARMONIE · hydrodyn 2/12 spottia · vuorovesi ·
  Holfuy · ilmanlaatu) · Toinen kerros — kontekstia, ei päätöstä ·
  Toteutusjärjestys
- **ui**: Valikoiden ulkoasu — Merikartta · Mallien erimielisyys · Suosikit ja
  jaettava linkki · Puvun paksuus · Ennusteen osuvuus havaintoja vasten ·
  Spottikortin auditointi · Play ja kapseli · Aikajana kotivalikon appissa ·
  Havaintoasemien kortit · Tummat jäänteet paperipaneeleissa · Aurinkokaari ·
  Aikajanan ura vaihtui hiekkaan · Kontrollit pois datan päältä, kisko
  kertomaan säästä · Napit takaisin uran päälle — kohotus kontrastin
  tilalle · Päiväkisko sai saman uran kuin tuntinauha · Urat pois — yksi
  paperi, kaksi riviä · Päiväkisko piiloon levossa · Spottien
  tuulisuunnat asteen tarkkuudella · Saavutettavuuserä 1: rakenne,
  sarkain ja piilotus · Saavutettavuuserä 2: dialogit ja fokus ·
  Saavutettavuuserä 3: asetuspaneelin kontrollit · Oletusasetukset ja
  sirujen järjestys · Aaltopoijun lukema tulee samalla zoomilla kuin
  meriaseman · Aaltopoijun kaavion voi raahata · Kapselin puuskarivi katosi ·
  Vuosaaren asema sanoi "ei signaalia" · Havaintokaavio uusiksi: väri tulee
  korkeudesta · Havaintokaavion laajennus koko ruudulle · Laajennettu
  kaavio iPhonella: turva-alueet, liuku ja lukemarivi · Havaintokortin
  siivous: väriliuska pois ja neljä kahdennusta · Sateen värit:
  strategia ja se mitä siitä on jo tehty · Aikajana: korkeammat palkit,
  matalampi kisko, keskitetty päiväys · Laaja näkymä: yksi kuori,
  kolme kaaviota · Aikajana: päiväys paikalleen, yö kaistaksi ·
  Aikajana: huntu pois, tikki kapeammaksi, kisko valitsimeksi ·
  Aikajana, toinen erä: se ei toiminut laitteella ·
  Nauha rakennettiin, mitattiin ja peruttiin ·
  Lukemarivi palkkien alle, päiväerotin pois ·
  Keskiyön vilkahdus oli kiskon väärin luettu scroll-tapahtuma ·
  Palkkien asteikko ei enää kyllästy ·
  Aikajana kelluu tummennuksella — paperikortti pois ·
  Kolme hienosäätöä: päiväys kuplaan, leveämpi tikki, rajan pyöristys ·
  Liukuväri alemmas, lasi ylös, ja päiväyksen välähdys kahdesta syystä ·
  Spottikortin tuuliennustekaavio: laatikko sivuun, pallot omiin
  väreihinsä, akseli oikeaan yksikköön ·
  Latausruutu: kuva esiin, merkki uusiksi (historiaa) ·
  Viisi asiaa: vaalea pohja ja väriasteikko pois, paneelit
  yhtenäisiksi, liukuväri alemmas, tunti pysyy mallin vaihdossa ·
  Valikot yhtenäisiksi: sama sulkunappi, sama ele, sama fontti ·
  Latausruutu liikegrafiikaksi: meri, tuuli ja foilaaja ·
  Latausruutu näkyy pidempään, ja odotus käytetään kartan lataamiseen ·
  Kaaviot yhdeksi moottoriksi ja spottikortti moduuleiksi ·
  Aikajana: palkit kaavion värisiksi, päivän pilleri paikalleen ·
  Uusi merkki: siipi ja tuuli — ja latausruudun viimeistely ·
  Merkki yksinkertaistui: siipi ja spotti ·
  Latausruutu vuorokaudenajan mukaan: Helsinki, nivelletty kuski ja hyppy ·
  Aikajanan liukuväri pois — halot tilalle ·
  **Kelikamera: play-kolmio pilleriin ja kamera asemakorttiin** ·
  **Kieli: suomi ja englanti** ·
  **Aikajana: toisto liukuu, päivä vaihtuu liukuen, kiskoon kelikaista** ·
  **Aikajana: jatkuva päiväkisko, pehmeä valinta ja pilleri ikkunana** ·
  **Aikajana: pilleri jumissa, napautus pysähtyi ja hiiriveto** ·
  **Aallot kartalla: kerros, väri, aallonharjat ja aikajana** ·
  **Sade neljänneksi kerrokseksi: GL-sadekerros ja esikatselukuvat** ·
  **Yömeri: valikot ja kaaviot kuvakkeen väreihin** ·
  **Yömeri, toinen erä: asetukset, kortit, sääikonit, spottien väistö** ·
  **Kartan merkit: pallot kaukana, yksi raja ja sijoittelu** ·
  **Kartan merkit, toinen erä: lukemat taas kaukaa** ·
  **Kapselin vasen lukema: aallot oletuksena**
- **pwa**: PWA — kotivalikkoon ja rannalle · Mitä välimuistiin menee ·
  Kaksi asiaa jotka pitää muistaa · Mitattu · Testaamisen sudenkuoppa ·
  Ikoni ja kotivalikko
- **sujuvuus**: C2 toteutettu — mitä muuttui ja mitä mitattiin ·
  Puhelin ja iPad C2:n jälkeen — mitä eleen aikana vielä ajetaan ·
  Tiivistelmä · Mittausasetelma · Mitä mitattiin (laattojen
  uudelleenmaalaus per ele, aikajanan askel, pääsäikeen profiili, eleen
  aikana, localStorage, mitä ei voitu mitata) · Miksi juuri työpöytä ·
  windy.com — mitä se tekee · Julkiset lähteet (GitHub) · Vaihtoehdot
  (Vaihe 0, A1–A4, B1–B3, C1–C2) · Suositus ja järjestys · Mitä ei
  ehdoteta
- **julkaisu**: Design ja UI, top 25 (P0–P2) · Suositusjärjestys
  (vaiheet 0–3) · Logiikka, top 10 (L1–L10) · Toteutus (28.9.): UI,
  logiikka, auki
- **graafit**: Tiivistelmä (diagnoosi ja suositus) · Nykytila mitattuna
  (akselit zoomeittain, vuorovaikutus, käyrä) · Mitä ammattilaiskaaviot
  tekevät (gesteiden välimiehitys: pito + veto) · Ehdotukset
  osa-alueittain (työpöytä, puhelin, x-akseli, y-akseli, käyrät ja
  pehmennys, laitematriisi) · Päätettävät kohdat P1–P10 · Vaiheet V0–V7 ·
  Mittauspohja · CLAUDE.md:n säännöt jotka tämä koskee · Mitä EI ehdoteta
- **oikeellisuus**: Tiivistelmä · Kunnossa — mitattu, ei toimenpiteitä ·
  Aukot O1–O11 (varaston tuoreus, kaksi ennustetta, kapselin taso,
  kapselin puuska, virhe lakkautuksena, havaintoverkko, havaintojen
  päivitys ja ikä, ECMWF-puuskan aukot, UiRaS, keskiarvoistusikkunat,
  jatkuva varmennus) · Suositusjärjestys · Mitä ei kannata tehdä ·
  Dokumentaatio joka on ristiriidassa mittauksen kanssa · Mittausasetelma ·
  **Toteutus (30.9.2026)**: mitä tehtiin ja jälkimittaukset O1–O11

</details>

---

## Työtavat — nämä pätevät joka tehtävässä

**`npm run build`:n läpimeno ei ole todiste mistään.** Build jäsentää
nyt inline-skriptin (`tiivistys`-plugin, `minifySync`) ja kaatuu
syntaksivirheeseen, mutta ajonaikainen virhe menee yhä läpi ja kaataa
vain selaimen — **lataa sivu selaimessa** (tai aja `tools/savutesti.mjs`).
Dev-serveri ei tiivistä, joten `npm run dev` näyttää lähteen sellaisenaan.
Tiivistys poistaa vain kommentit ja sisennyksen (`compress: false`,
`mangle: false`: ylätason nimet ovat globaaleja ja `onclick`- ja
`?perf=1`-käytössä). CSS:ää EI ajeta oikean minifioijan läpi:
lightningcss pudotti `-webkit-backdrop-filter`in.

**Kun poistat lohkoja `index.html`:stä, tee se rivipohjaisesti.** Kerran lohkon
loppua etsittiin ensimmäisenä `};`-esiintymänä ja se osui moduulin *sisällä*
olevaan riviin; loppuosa jäi irrallisiksi lauseiksi ja sivu kaatui.

**Tarkista `grep -c`:llä että funktiota jota muokkaat oikeasti kutsutaan.**
`buildFmiCard` oli määritelty muttei kutsuttu koskaan — siihen kirjoitettu
ominaisuus olisi ollut hiljaa kuollut.

**Mittari ei saa sitoa `this`:iä eikä pudottaa argumentteja.** `?perf=1`
-paneelin `WindTexture.build`-kääre oli `bind(WindTexture)` + kolmen
parametrin funktio. Se ajoi `PohjaTekstuuri.build()`:n WindTexturelle ja
söi neljännen argumentin — mittaus näytti siltä että koko ominaisuutta ei
ole olemassa, vaikka koodi oli oikein. Kun mittaus väittää ettei jotain
tapahdu lainkaan, epäile ensin mittaria.

**Mobiiliharness ei ole mobiili ilman `hasTouch`ia.** Pelkkä kapea
`viewport` ja `deviceScaleFactor: 3` eivät riitä: ilman
`hasTouch: true` selain kertoo `maxTouchPoints === 0` ja
`(pointer: fine)`, jolloin sovelluksen `TYOPOYTA`-lippu menee päälle ja
työpöydän CSS on voimassa. Mobiilin pikselivertailu mittasi silloin
työpöytäpolkua — ja väitti muutosta regressioksi vaikka se oli juuri se
mitä työpöydällä pitikin tapahtua. Kaikki laitekohtainen mittaus vaatii
`hasTouch`in molempiin suuntiin.

**Kosketuskohde on napautettava testissä.** `getBoundingClientRect` ja
`elementFromPoint` eivät kerro mihin napautus oikeasti menee; Chromiumin
kosketussäätö siirtää sen lähimpään maalattuun kohteeseen.

**Leaflet-zoom on MapLibre-zoom + 1 (`ZOOM_ERO`).** Kaikki sovelluksen
kynnykset (`LUKEMA_Z_MERI` ym., `REUNUS_MIN_Z`, `laattaStep`, `uloinZoom`) ovat
Leaflet-asteikolla, ja `KarttaGL` kääntää rajalla. Jos kutsut `map.ml`:ää
suoraan, käännä itse — muuten jokainen kynnys osuu tason verran väärin.

**Dokumentaatio ja koodi ajautuvat erilleen.** Näin on käynyt kahdesti:
Syne-fontti oli kirjattu poistetuksi mutta `<head>` latasi sen yhä, ja
`State.dpr`-katoksi oli perusteltu 2 mutta rivi sanoi 3. Kun kirjoitat
mittauksen muistiin, tarkista että rivi vastaa sitä.

### Mittaaminen tässä ympäristössä

**Kontti ei kykene mittaamaan ruutunopeutta.** Se antaa 8–18 fps riippumatta
partikkelimäärästä ja CPU-kuristuksesta, eli se mittaa omaa kompositoriaan.
Ruutuaikapäätökset on varmistettava oikealla laitteella.

**Yksittäinen ajo ei kelpaa.** Sama koodi on antanut peräkkäisillä ajoilla
137,7 ms ja 280,9 ms. Toimiva asetelma:

- rinnakkaiset buildit omissa porteissaan, harness ajaa ne **vuorotellen**
- lämmitys, sitten pariton määrä kierroksia, **mediaani**
- **raakaluvut näkyviin** — jos luvut seuraavat järjestystä eivätkä asetusta,
  mittari mittaa itseään
- kontrolli toisin päin; jos se ei täsmää, tulos ei ole tulos

**`?perf=1` vie moduulit `window.FS`:ään** (`State`, `WindTexture`, `Saalaatat`,
`ViewportGrid`, `ColorRamp`, `PerfTracker`, `buildWindField`, `idw`). Ilman
kytkintä globaaliin nimiavaruuteen ei viedä mitään. Automaattinen selaintarkistus
tarvitsee tämän — moduulit ovat muuten saman skriptilohkon `const`-sidoksia.

**ELEEN MITTAAMINEN VAATII OIKEAN MOOTTORIN, TUOTANTOBUILDIN JA
SORMEN.** Chromium + dev-serveri + `scrollLeft`-kirjoitus näytti kolme
kertaa vihreää sellaisesta joka ei toiminut laitteella lainkaan.
Asetelma on: `playwright-core` + **webkit** (asennus `npx playwright
install webkit` ja `install-deps webkit`), `npm run build` +
`vite preview`, iPhone-konteksti (`hasTouch`, `deviceScaleFactor: 3`)
ja `timezoneId: 'Europe/Helsinki'` — kontti ajaa UTC:ssä ja päivärajat
lasketaan paikallisajassa. Ja koska Playwrightilla ei ole touchmovea
eikä mobiili-WebKitissä rullaa, ELE ON SIMULOITAVA OIKEIN:

- **`requestAnimationFrame` on jäädytettävä eleen ajaksi.** WebKit ajaa
  kosketusvieritystä omalla säikeellään eikä ruutupyyntö välttämättä
  palaa ennen kuin sormi nousee. Ilman tätä rAF:n takana oleva koodi
  näyttää toimivan.
- **`scrollend` on estettävä kesken eleen.** Askeleittainen
  `scrollLeft`-kirjoitus saa selaimen lähettämään sen jokaisen askeleen
  jälkeen; aito yhtäjaksoinen sormi ei tee niin, ja ilman estoa mitataan
  vahingossa vahvistuspolkua.
- **Napautus on mitattava VÄRISEVÄNÄ** (pari pikseliä vieritystä sormen
  alas- ja ylösnoston välissä). Puhdas napautus ei paljasta sitä että
  napautukset nielaistaan.

**Mittaa totuutta vastaan, älä zoomia toista vastaan.** Kahden zoomin vertailu
sekoittaa aliotannan ja virheen eikä kerro kumpi on väärässä. Kentän tarkkuus
mitataan analyyttistä kenttää vasten.

---

## Säännöt joita ei saa rikkoa

Nämä ovat päätöksiä, eivät makuasioita. Perustelut ovat aiheen omassa
tiedostossa; tässä on vain se mitä ei saa tehdä vahingossa.

**Kieli** (docs/ui.md, "Kieli: suomi ja englanti")

- **SOVELLUS ON SUOMEKSI JA ENGLANNIKSI, JA JOKAINEN NÄKYVÄ TEKSTI ON
  KAHDESTI.** JS:ssä `_t('suomi', 'English')` tekstin vieressä,
  staattisessa HTML:ssä `data-en` (tekstisisältö, ei lapsielementtejä)
  tai `data-en-aria-label` / `data-en-title` / `data-en-nimi`, ja
  latausruudulla ja rikkaassa tekstissä (Tietoa, pikanäppäimet)
  kielipari `data-kieli="fi|en"`. Uusi teksti ilman englantia ei kaada
  mitään — se jää hiljaa suomeksi englanninkielisen käyttöliittymän
  keskelle. Sama koskee `aria-label`ia ja `title`a.
- **KIELI RATKAISTAAN KERRAN, JA VAIHTO ON UUDELLEENLATAUS.** `<head>`in
  skripti asettaa `<html lang>`in (`fs_kieli`; testaus `?kieli=en|fi`,
  ei tallennu), ja se on ainoa lähde (`KIELI`). `Kieli.vaihda` tallentaa
  ja lataa sivun `Paluu`n tavoin (näkymä ja spotti säilyvät, asetukset
  avautuvat uudelleen). Älä rakenna vaihtoa paikallaan: `_t` ajetaan
  myös vakioissa ja moduulien alustuksessa, ja ne jäisivät vanhaan
  kieleen.
- **Kielivalinta on asetusten ensimmäinen rivi, oletus suomi
  vasemmalla, eikä selaimen kieltä tunnisteta** (englanninkielinen
  puhelin ei tarkoita englanninkielistä käyttäjää). Kielten nimet
  omalla kielellään ja omalla `lang`illaan.
- **`data-en-kaare`, `data-en-nyt`, `data-en-pohja` ja `data-en-vertaa`
  ovat ENNUSTEosion koukkuja, eivät käännöksiä.**
  Käännöskierros lukee vain edellä luetellut attribuutit.
- **Spottien englanninkielinen kuvaus on datassa (`descEn`)**, ei
  `_t`-kutsuna: `tools/suunnat.html` lukee `SPOTS`-lohkon pelkkänä
  literaalina. Kelikameran nimi tulee rekisteristä (`api/_kamerat.js`,
  `nimiEn`), aaltopoijujen nimet käännetään vastauksen saapuessa
  (`poijuNimi`).
- **Paikan-, aseman-, mallin- ja järjestönimiä ei käännetä**
  (poikkeus: poijujen merialueet, jotka ovat englanniksi vakiintuneita).
  Aseman tagi (`Meri`, `Avomeri`, `Lento`) on AVAIN; näkyvä nimi
  tulee `asemaTagi`sta.
- **Englanti on brittienglantia, kello 24-tuntinen ja päiväys
  "Wed 16 Sep"** (`KIELI_LOKAALI` en-GB, `pvmLyhyt`, `pvmNumero`,
  `PV_LYHYT`, `KK_LYHYT`). Suunnan nimi on -erly-muoto
  ("southwesterly"), koska se sanoo mistä tuulee. Sanasto on
  docs/ui.md:ssä — käytä samoja termejä (gust, lull, gust factor,
  rideable, spot index).
- **DESIMAALIEROTIN: SUOMEKSI PILKKU, ENGLANNIKSI PISTE** (P17, V16,
  docs/spottikortti.md 8.10): "6,3 kts" / "6.3 kts", koko
  sovelluksessa. Näkyvä luku muotoillaan `_desim(x, d)`:llä (=
  `x.toFixed(d)` oikealla erottimella, `DESIM`), ja `Units.fmt` /
  `fmtIn` tekevät sen itse. VAIN näkyvään tekstiin: SVG-koordinaatit,
  CSS, osoitteet, ikonien allekirjoitukset ja data pysyvät pisteellä.
  Ennen lukemat olivat pisteellä ja kiinteät nimet pilkulla ("2,5 km")
  samassa kortissa. Tarkistus DOMin tekstistä kuten kielellä:
  suomeksi ei `\d.\d`-lukuja, englanniksi ei `\d,\d`-lukuja.
- **Tarkistus: `?kieli=en` ja DOMin tekstit suomen sanalistaa vasten**,
  jokainen pinta avattuna (docs/ui.md, "Mitattu"). Pelkkä koodihaku ei
  riitä: tekstiä syntyy myös palvelimen datasta.

**Väri**

- **Kartalla sävy tarkoittaa tuulennopeutta ja vain sitä.** Kaikki muu kartalla
  on joko tummaa pilleriä (mitattu data) tai yömerta (kaikki muu: kapseli,
  spottimerkit, karttanapit; ks. "Yömeri" alla).
  **Kaksi poikkeusta, ja ne ovat ehdollisia: sadekerros ja aaltokerros**
  (jälkimmäinen käyttäjän päätöksellä 1.10.). Kun sadetutka on päällä,
  lämpökartta ja partikkelit sammuvat (`_tuulikerrokset-`
  `Nakyvissa`); aaltotilassa (`aaltotila()`, siru "Aallot") samoin
  (`LampoGL._naytetaan`, `partikkelitPois`). Kartan pinnalla on siis
  kerrallaan tasan yksi väriasteikko, ja sävy saa tarkoittaa sateen
  voimakkuutta tai aallonkorkeutta (`AaltoVari`). Sade ja aallot ovat
  myös keskenään poissulkevat (`_aaltotilaAseta`). Ehto EI ole
  neuvoteltavissa: jos lämpökartta joskus palautetaan näkyviin sade- tai
  aaltokerroksen alle, niiden värit on poistettava samassa muutoksessa.
- **AIKAJANAN PALKIT OVAT `ColorRamp.rgb()` — SAMA RAMPPI KUIN
  SPOTTIKORTIN KAAVIOSSA JA ASETUSTEN VÄRIASTEIKOSSA.** Poikkeukset ovat
  sadetila (4.10., docs/sadetutka.md: palkki = tunnin sade logaritmisella
  korkeudella 0,05 → 50 mm ja sateen rampin värillä, tutkan ja nowcastin
  jaksolla neljä vartin siivua, `_tlSadePalkki`) ja aaltotila (käyttäjän päätös 1.10.): silloin palkki on aallonkorkeus
  `AaltoVari`-värillä ja omalla akselillaan (`_tlPalkkiTyyli`,
  `_tlAaltoOsuus`, `State._tlAallot`), ja mallin jakson ulkopuolella
  palkkia ei ole. Kelikaista ja kelihyppy lukevat aina tuulta
  (`State._tlSpeeds`) — aallot eivät vaikuta keliin. Käyttäjän
  päätös: kolme paikkaa, yksi väri samalle nopeudelle. Palkeilla oli
  ennen oma `varjo()` (ramppi sekoitettuna valkoiseen 0,45), joka teki
  niistä pastellin eivätkä ne näyttäneet samoilta kuin kaavio; taulu
  poistettiin. Mitattuna ruudulta, alusta PALKKIEN VÄLISTÄ ja
  tulevilta tunneilta (menneet ovat `opacity .4`): 0 m/s 1,34:1, 1 m/s
  2,24, 2 m/s 3,79, 5 m/s 9,84, 8 m/s 11,98, 11 m/s 13,78, 14 m/s 7,62,
  20 m/s 7,09. Tyynen pää on tietoinen hinta — sillä tunnilla palkki on
  myös matalin. `paperi()` ja `ink()` ovat yhä vääriä: edellinen on
  paperin taulu, jälkimmäinen oma sävypolkunsa.
  **ALUSTANÄYTE OTETAAN PALKKIEN VÄLISTÄ, EI NAPISTA EIKÄ OSOITTIMESTA.**
  Kiinteä `nauha.left + 24` on play-napin sisällä (x 9..53), ja
  keskimmäinen tikki on NYT-viivan alla (magenta 180,0,90 luettiin
  kerran palkiksi). Tikki 18 px, palkki 12, väliin 6 px.
- **AIKAJANALLA EI OLE URAA, KORTTIA EIKÄ LIUKUVÄRIÄ.** Ura oli
  kolmessa muodossa, sitten paperikortti, sitten reunasta reunaan
  tummennus (`#tl-wrap::before`); käyttäjän päätöksellä 28.9. sekin
  poistettiin ("se voi toimia ilman"). Kartta kulkee aikajanan läpi
  sellaisenaan. Luettavuus tulee ELEMENTEISTÄ EIKÄ ALUEESTA: tekstit
  kantavat `--tl-halo`n (tumma ääriviiva + varjo `--tl-pohja`sta),
  palkeilla on tumma hiusreuna ja varjo (lämpökartta on samaa ramppia,
  joten ilman reunaa 8 m/s palkki katoaisi 8 m/s kentän päälle), ja
  himmeät tekstisävyt nousivat (`--tl-teksti-2` .72, `-3` .58).
  **TEKSTIRIVIEN TAKANA ON KAPEA LASIKAISTA** (`#tl-wrap::before`,
  käyttäjän valinta samana päivänä): lukemarivin yläreunasta ruudun
  pohjaan, `blur(10px)` + `--tl-pohja` .34, yläreuna häipyy 8 px:n
  maskilla. PALKKIVYÖHYKKEEN TAKANA EI OLE MITÄÄN — älä venytä kaistaa
  palkkien taakse äläkä palauta koko aikajanan tummennusta ilman
  käyttäjän pyyntöä; jos jokin ei erotu, vahvista sen omaa haloa tai
  reunaa.
- **AIKAJANASSA EI OLE VALOKAISTAA.** Yö oli janassa kolmessa
  muodossa: koko korkeuden harso, 2 px:n kaista tikin alalaidassa, ja
  kolmella eri alustalla kalibroidut alfat (musta .34, `76,89,96` .24,
  lopuksi .20/.129/.060). Kaista oli mitattuna sekä pienempi että
  selvempi kuin harso (yö 4,71:1 paperiin vastaan 1,31:1), eikä se
  silti jäänyt: se häiritsi lukemista. Valovaiheet elävät yhä
  spottikortin kaaviossa (`VALO_VARIT`) ja kelihypyssä, joka osaa
  hypätä vain tuntiin jossa aurinko on ylhäällä (`_tlAurinko`; ehto oli
  hiljaa rikki kun valokaistan kirjoittaja poistettiin, korjattu 30.9.).
  Älä palauta kaistaa janaan — kolme kertaa riittää. (Puuskahuntu oli
  samasta syystä muste .34 eikä valkoinen .22; sekin on poistettu, ks.
  alempaa.) Kelikaista (alla) ei käytä valoisuutta lainkaan (1.10.) —
  älä tee siitä valokaistaa.
- **PÄIVÄKISKOSSA ON KELIKAISTA — YKSI JATKUVA JUOVA, EI PÄIVÄKOHTAISIA
  PILKKUJA** (käyttäjän pyyntö 30.9., `.tl-kaista`, `_tlKaistaPiirra`).
  Päivälappujen tuulikaista (väri ja leveys sen päivän kovimmasta
  tuulesta) mitattiin aikanaan toimivaksi mutta poistettiin:
  kahdeksantoista väripilkkua yhdellä rivillä on kahdeksantoista asiaa
  joita silmä lukee. Kelikaista on eri muoto: yksi sumennettu juova
  kiskon alareunassa koko akselin läpi AJASSA (lapun leveys =
  vuorokausi kellonajan mukaan, sama asteikko kuin kiskon osoittimella),
  levossa tasapaksu (2 px) hiljainen harmaansininen (`124,150,186` alfa
  .52) — eli rivillä on yksi muoto eikä yhtään pilkkua. Foilattavina
  tunteina (tuuli ≥ `Keli.AJETTAVA` pehmeällä kynnyksellä −1…+0,5 m/s)
  juova paisuu 5 px:iin, saa hehkun ja lämpökartan värin
  (`ColorRamp.rgb`). Paino ja nopeus sumennetaan ajassa (σ 0,8 h).
  **VALOISUUS EI OLE EHDOSSA** (käyttäjän päätös 1.10.): 30.9. versio
  kertoi painon valoisuudella, ja tuulinen yö katkaisi juovan kahden
  kelipäivän väliin; nyt juova jatkuu yhtenäisenä jos yöllä tuulee.
  Rampin väri alkaa vasta foilausrajalta, joten hiljaisen pään tumma
  sininen ei koskaan näy kaistassa. Mennyt aika on .45 kuten palkeissa,
  ja akselin ulkopuolelle juova häipyy. Kaista on pillerin ALAPUOLELLA
  (kiskon alimmat 9 px): pilleri on 24 px ja 3 px ylhäältä, ja lapun
  teksti on nostettu samaan (`padding-bottom: 4px`). Älä palauta
  päiväkohtaista lukua äläkä vie kaistaa palkkien alle tuntiriville:
  siellä se luettaisiin tuntien asteikolla vaikka sen asteikko on
  kiskon (2,5 px/h).
- **Kortin paljas paperi mitataan RIVIEN VÄLISTÄ.** Rivin sisältä otettu
  näyte osuu palkkiin, yökaistaan, NYT-osoittimeen tai napin varjoon —
  ja väittää sitten että sama paperi on eri väristä eri kohdissa.
- **Palkin korkeusasteikko on EPÄLINEAARINEN** (4–14 m/s levennetty) ja
  täysi mitta on 72 px (`TL_PALKKI_H`). Korkeus on muoto, väri on arvo.
  Älä palauta lineaarista: se antaa 1,38 px/(m/s) ja peräkkäisten
  tuntien tyypillinen ero on 0,2 m/s eli alle puoli pikseliä.
- **`ColorRamp.rgb()` on kartalle, `ink()` paneeleihin.** Yömeren jälkeen
  `ink()` on SAMA sävypolku kuin kartalla (`RAMP_KARTTA`), nostettuna kohti
  valkoista vain sen verran että se on 4,5:1 `--surface-hi`:ta vasten
  (`_paneeliin`; käytännössä vain 0–3 m/s:n yösininen nousee). `RAMP_INK`
  (paperille tummennettu polku) jää vain vaalean pohjakartan koneistoon,
  jota ei käytetä. Muste ei ole värisokeusturvallinen eikä sen tarvitse
  olla — paneelissa väri on aina luvun vieressä.
- **Kartan ramppi on kylläinen ja tehty normaalinäköiselle**
  (sininen–syaani–vihreä–keltainen–oranssi–punainen–magenta), ja se on
  AINOA. Värisokeusturvallinen `RAMP_CVD` oli ensin oletus ja sitten
  asetus; käyttäjän päätöksellä se poistettiin kokonaan ja väriasteikon
  valitsin sen mukana ("Kirkas" on aina käytössä). Älä palauta vaimeaa
  ramppia oletukseksi vetoamalla värisokeuteen, äläkä palauta valitsinta
  ilman että käyttäjä pyytää sitä. Tallennettu `ramppi`-avain ohitetaan
  (`_sallitut` ei tunne sitä).
- **Rampin kylläisyys ruudulla on suunnilleen kroma KERTAA alfa.**
  Lämpökartta piirtyy alfalla 0,08–0,71, joten taulukon luvut eivät kerro
  mitä nähdään. Mittari on `varit.mjs`, joka lukee `pikseliLUT()`:n ja
  sekoittaa pohjaan — mittaa siitä, älä rampista.
- **YÖMERI: VALIKOT OVAT KUVAKKEEN VÄREISSÄ** (käyttäjän päätös 1.10.,
  docs/ui.md "Yömeri"). Paneelit ja kartan päällä kelluvat ovat kuvakkeen
  yönsinistä (`--surface` `#151C29`, `-hi` `#1D2636`, `-lo` `#0E141F`),
  muste on siiven kermaa (`--ink` `#F0E7CE`, `-2` `#C3BFB2`, `-3`
  `#9CA2AB`), ja valinta on kermatäyttö tummalla tekstillä (`background:
  var(--ink); color: var(--surface)` — sama sääntö kuin paperilla,
  kääntyneenä). Kaikki värit ovat `:root`issa; JS lukee ne `Teema`sta
  (SVG-literaalit) — älä kirjoita sävyä JS:ään lukuna. Paperiteema
  (Merikartta) on historiaa: älä palauta kermapaneelia ilman käyttäjän
  pyyntöä.
- **`--accent` on kuvakkeen hehku (`#96B9EB`) ja TOIMINTOVÄRI**
  (kytkimet, toiminnot, fokus, `.sh-nyt`); sen päällä teksti on
  `--accent-teksti`. **MAGENTA ON VAIN VAROITUS** (`--varoitus` `#FF8FC0`:
  verkkotila, mallien voimakas erimielisyys, äärimmäinen puuskaisuus,
  vaarallinen keli) — käyttäjän päätös 1.10. Nimilappu tai datapiste ei
  ole kumpaakaan; ne ovat mustetta. Aikajanan valintaosoitin ja
  tähtäimen tuulinuoli ovat mustetta (kermaa), eivät aksenttia.
- **SÄÄIKONIT OVAT HILLITYN VÄRIKKÄITÄ** (`WX_ICONS`, käyttäjän pyyntö
  1.10.): aurinko kulta `#EFC566`, pilvi `#BAC4D2` kevyellä täytöllä,
  vesi `#7FB4F2`, lumi `#CFE4F7`, salama `#F2CC5C`, sumu `#A9B2BF` —
  7,0–11,6:1 tummaa pintaa vasten. Ikoni on yhä viivapiirros; älä vie
  sävyjä rampin kylläisyyteen, jottei ikoni lue tuulen värinä. Ikoni on
  kapselissa, tuntisäässä ja spottikortin ilmalaatassa lämpötilan
  vieressä.
- **`var()` ei toimi SVG:n esitysattribuuteissa.** Kaavioiden `fill=` tarvitsee
  literaalin; inline-tyyleissä tokenit toimivat.

**Latausruutu ja sovelluksen merkki**

- **LATAUSRUUTU ON KARTTAMAAILMAA JA LIIKEGRAFIIKKAA** (docs/ui.md,
  "Latausruutu liikegrafiikaksi" ja "Merkki yksinkertaistui: siipi ja
  spotti"): tumma meri, rampin värinen tuuli, paperinvärinen foilaaja,
  ja merkki (paperinen siipi) avautuu tyvestä ennen kuin spotti syttyy.
  Kotivalikon ikoni -> latausruutu -> kartta on yksi pohja; paperiruutu
  teki kaksi kirkkaushyppyä joka käynnistyksessä. Älä palauta
  valokuvaa paperille: se oli 62 kB base64:ää (gzip 467,7 -> 410,4 kB)
  ja sisältö näkyi hitaalla verkolla 320 ms myöhemmin (FCP 812 vs
  492 ms).
- **MERKKI ENSIN, KUSKI VAIN LÄHDÖSSÄ (strategia D, käyttäjän päätös
  29.9.).** Kuski alkoi hallita ruutua ja merkki ja latauspalkki jäivät
  sen varjoon. Levossa ruudulla on meri, taivas, tuuli ja ISO merkki
  (150 px, nimi 32 px, palkki 220 × 3 px, lohko nostettu 7vh), ja
  kuskin kerros `#lr-rata` on `display: none` — sen animaatiot eivät
  pyöri lainkaan (levossa 22 animaatiota, ennen 37). Kun data on
  valmis (`.out`), kuski syntyy: liukuu sisään vasemmalta 0,5 s
  (`lr-tulo-lahto`), tekee ala-käännöksen (`lr-kaarto-lahto`,
  `lr-lauta-lahto`, `lr-kansi-lahto`) ja hyppää viiveellä 0,45 s
  (`lr-hyppy` ja nivelten hyppyavainkuvat); laki noin 0,9 s, ja vasta
  silloin ruutu häipyy (`transition-delay` .85 s) ja nimilohko väistyy
  (.45 s). `display: none` 1 350 ms. Hinta: kartta on käytettävissä
  0,45 s myöhemmin kuin ennen. Vaimennetulla liikkeellä kuskia ei
  näytetä. ÄLÄ PALAUTA KUSKIA LEPOTILAAN.
- **TILANJAKO ON YHÄ KAKSIOSAINEN: KOHTAUS YLHÄÄLLÄ, NIMILOHKO SYVÄLLÄ
  MERELLÄ.** Aallot ja juovat häipyvät ennen nimilohkoa, eikä tekstin
  alla liiku mitään. Mitattu ruudulta: nimi 16,34:1, alanimi 6,47:1,
  tilarivi 7,25:1, heikoin = mediaani (tasainen alusta). Älä vie tekstiä
  kohtauksen päälle — valokuvan aikana mitattuna muste oli kuvaa vasten
  heikoimmillaan 1,62:1, ja sama pätee liikkuvaan kohtaukseen.
- **LATAUSRUUDUN TUULIJUOVAT OVAT LOGON PAPERIA, HIEMAN
  LÄPIKUULTAVINA** (`JUOVA_VARI` `#F0E7CE`, `JUOVA_ALFA` 0,62 juovan
  oman alfan päälle) — käyttäjän päätös 28.9. Ne olivat ennen rampin
  ankkurin värisiä arkin nopeuden mukaan; nopeus näkyy nyt vauhdissa,
  pituudessa ja paksuudessa. `data-tuuli` jää `tools/ikoni.mjs`:n
  tulosteeseen mutta sitä ei lueta. Nimilohko, merkki ja
  edistymispalkki ovat samaa paperia. Magentaa ei ruudulla ole, joten
  `--accent` palkissa sanoisi 20 m/s — ja se on tummalla himmein
  vaihtoehto.
- **LATAUSRUUTU SEURAA VUOROKAUDENAIKAA** (docs/ui.md, "Latausruutu
  vuorokaudenajan mukaan"). `<head>`in `LR_PALETTI` laskee auringon
  korkeuden Helsingissä ja sekoittaa viiden ankkurin paletin (yö,
  sininen hetki, hämärä, kultainen valo, päivä) `--lr-*`-muuttujiin
  ENNEN ensimmäistä maalausta; testaus `?aika=yo|sininen|ilta|paiva`
  tai `?aurinko=<astetta>`. Käyttäjän hyväksymät poikkeukset
  aiempiin sääntöihin: (1) päivällä taivas vaalenee, mutta yläreuna
  pysyy niin tummana että tilapalkin valkoinen on VÄHINTÄÄN 10:1
  (mitattu päivä 10,54, ilta 15,97, sininen 15,51, yö 18,38); (2)
  illan valo on haalea kupari/ruusu, EI rampin kylläistä oranssia; (3)
  kuski on valoisalla (aurinko yli −3°) TUMMA vastavalosiluetti ja
  pimeällä paperia — vaihto on kerralla, ei liukuen (välisävy harmaa).
  Nimilohkon alla on AINA sama syvä meri: tekstien kontrastit ovat
  samat joka vaiheessa (16,34 / 6,48 / 7,25). Tähtiä ei ylimpään 64
  px:iin eikä aurinkoa taivaan puoliväliä ylemmäs, koska molemmat
  vaalensivat tilapalkin alustaa (7,80:1 ja 9,60:1 ennen rajausta).
- **KUSKI ON NIVELLETTY, SE LIIKKUU NÄKYVÄSTI, JA LÄHTÖ ON HYPPY.**
  Asento on oikeasta vastavalokuvasta (mittasuhteiden malli, ei
  upotettu): lähes pystyasento ja nojaus taaksepäin, siipi molemmin
  käsin olkapäiden korkeudella VINOSSA sivulla, ja kädet ovat PUOMILLA.
  KUSKI ON YKSINKERTAINEN TIKKU-UKKO YHDESSÄ SÄVYSSÄ (käyttäjän päätös
  29.9.): yksityiskohtainen ihmishahmo (kasvot, kypärä, tukka, impact
  vest, lihakset, kaksivärinen Droid X -siipi logoineen) oli liian
  hallitseva. Nyt raajat ja vartalo ovat pyöreäpäisiä viivoja, pää on
  ympyrä, siipi on läpikuultava kangas (.26) ja täyttöputki (.8),
  tuki ja puomi, ja lauta ja foili ovat umpinaisia siluetteja — kaikki
  `--lr-kuski`-sävyä (valoisalla tumma, pimeällä paperi) ja koko rigi
  `opacity: .78`. ÄLÄ PALAUTA YKSITYISKOHTIA NÄKYVIIN. Muoto ja
  nivelpisteet säilyivät: nilkat (129,4/204 ja 164,4/204), lantio
  (150/157), olkapää = `#lr-kasi`n nivel (144/124,4), ja kädet ovat
  PUOMILLA (160,4/134,6 ja 180,4/128,6; etukäsi on `#lr-siipi`n
  nivelpisteessä). Jos siirrät kättä tai niveltä, siirrä puomia samassa
  muutoksessa. Suora vana (`#lr-vana`) poistettiin: se nousi hypyssä
  kuskin mukana suorana viivana. Kaarron vaahtojälki häipyy ennen
  ponnistusta. Osat ovat sisäkkäisiä kerroksia omilla
  nivelpisteillään (`#lr-jalat` nilkoista `scaleY`, `#lr-yla` lantiosta
  SAMALLA käyrällä, `#lr-kasi` = molemmat kädet ja siipi olkapäistä,
  `#lr-siipi` etukädestä), ja vartalo piirtyy siiven PÄÄLLE. Liike on
  kolmea kerrosta: pumppaus 2,2 s (jousto 14 %, kaikki nivelet samoilla
  avainkuvilla, painallus 30 %), KAARTO 4,4 s ja liuku 9 s (`#lr-rata`
  sivuttain −5…+6 %). KAARTO ON KÄÄNNÖS JA KALLISTUS, EI KIERTO
  RUUDUN TASOSSA, JA KÄÄNNÖS ON LAUDAN, EI KUSKIN: sivukuvassa laudan
  ja foilin käännös on `#lr-lauta`n `scaleX` (0,70 ala-käännöksessä,
  0,68 hypyn linjanhaussa) ja kallistus kameraa kohti on laudan KANSI
  joka avautuu näkyviin (`#lr-kansi`, sama `scaleX`). Kuski
  (`#lr-keinu`) vain nojaa ja painuu, ja sen mittakaava pysyy
  vähintään 0,97:ssä — koko rigin `scale(.74, .92)` kutisti kuskin
  neljänneksellä ja luki käyttäjän mukaan epäluonnollisena. Viive
  −0,3 s asettaa ala-käännöksen noin 1,0 s kohdalle ja linjan (lauta
  oikenee, kuski nojaa taakse ja nousee) noin 1,6 s kohdalle, eli
  siihen mihin lähtö osuu; lähdössä kaarto PYSÄYTETÄÄN
  (`animation-play-state`) eikä vaihdeta, jottei asento hyppää. ÄLÄ PIENENNÄ LIIKETTÄ ALLE
  TÄMÄN: 1–2°:n ja 7 %:n versio oli mitattuna käynnissä, mutta käyttäjän
  mukaan "kuski ei liiku". Jos muutat joustoa, muuta ylävartalon siirtoa
  samassa suhteessa (45 yks. × jousto), muuten lantio irtoaa reisistä.
  Pään yllä vaakatasossa kelluva siipi luki LIUKUESSA sateenvarjona —
  HYPYSSÄ se on oikein (siipi nousee pään yli, polvet vetäytyvät, kuten
  oikeissa hyppykuvissa: `lr-kasi-hyppy`, `lr-jalat-hyppy`,
  `lr-yla-hyppy`). SIIPI HEILAUTETAAN kuten oikeassa hypyssä
  (vertailukuvat Roca Cup 2022): lastauksessa siipi painuu alas
  (`lr-kasi-hyppy` +18°), ponnistuksessa se heilautetaan pään yli
  yliheitolla (−96° → −84°) ja käännetään lappeelleen etukädestä
  (`lr-siipi-hyppy` +34°), jolloin laella kuski roikkuu siiven alla
  kädet suorina. Ilmassa kuski VÄÄNTÄÄ LAUDAN kääntyneeksi jalkojensa
  alle (`lr-lauta-hyppy`: nokka ylös −13°, `scaleX` .76), ja jalat
  seuraavat sitä (`lr-jalat-hyppy`: `skewY` = laudan kierto, `scaleY`
  polvien koukistus, `skewX` lantio taakse; `lr-yla-hyppy` siirtää
  ylävartaloa samassa suhteessa). Lähtö `.out` ajaa `lr-hyppy`-avainkuvat (viimeinen
  linjanhaku 0–12 %: lauta kääntyy ja kuski nojaa kaarteeseen;
  lastaus 24 %, ponnistus, lento, 0,85 s) viiveellä 0,45 s sisääntulon
  ja ala-käännöksen jälkeen (ks. "Merkki ensin"), ja ruudun häivytys
  alkaa vasta 0,85 s, jotta laki nähdään; `display: none` 1 350 ms.
  Levossa pyörivät kaarto (`lr-kaarto`) ja pumppaus ovat yhä
  koodissa, mutta kerros on levossa piilossa.
- **SILUETTI ON HELSINKI ETELÄSATAMAN SUUNNALTA:** rantarivi ja
  Kauppatori (teltat, Keisarinnan kivi), mäellä Tuomiokirkko,
  Katajanokalla Uspenski ja maailmanpyörä, satamassa Silja Linen laiva
  ja Suomenlinna kirkkomajakkoineen. Käyttäjän päätökset: ensin vain
  tunnistettavat muodot (stadion, laiva, Lauttasaari ja Harmaja pois),
  sitten "yleinen siluetti joka sisältää ainakin" Suomenlinnan,
  Tuomiokirkon, Kauppatorin ja Silja Linen laivan, Haukilahden
  vesitorni pois. Vilkkuva valo on Suomenlinnan kirkon majakka.
- **KAIKKI LATAUSRUUDUN LIIKE ON `transform`IA TAI `opacity`Ä
  HTML-ELEMENTEILLÄ.** Ei canvasia, ei SVG-attribuutteja, ei
  `stroke-dashoffset`ia, ei `width`iä: käynnistyksen aikana pääsäie on
  varattu, ja sen varassa pyörivä animaatio nykisi juuri silloin kun sitä
  katsotaan. Mitattu Chromen jäljityksellä: jokainen latausruudun
  animaatio ja siirtymä `compositeFailed = 0`. Vanhan palkin `width`-
  siirtymä epäonnistui 85–145 kertaa latauksen aikana. Siiven
  avautuminen on siksi pyörivä puolitaso toisen sisällä eikä viivan
  piirto. Mitattu uuden merkin jälkeen: 0 epäonnistunutta (ainoa osuma
  on sovelluksen oma `.up-option`).
- **ANIMAATIOIDEN MÄÄRÄ MAKSAA, EI NIIDEN SISÄLTÖ — SIKSI ARKIT.** Kun
  sovelluksen piirtosilmukka pyytää pääsäikeen ruutuja (koko latauksen
  ajan), selain päivittää jokaisen käynnissä olevan animaation tyylin
  joka ruudussa: 95 animaatiota 1,04 ms/ruutu, 22 animaatiota 0,50,
  pysäytettynä 0,06. Juovat ja aallot ovat arkkeja (yksi animoitu kerros,
  staattinen sisältö, kaksi jaksoa leveä, -50 %), roiske ja kimallus
  varjokopioita. Älä lisää juovaa tai aaltoa omana animaationaan.
- **SISÄÄNTULOT OVAT `backwards`, JA `.out` POISTAA NE.** `both` pitää
  loppuarvon ja voittaa lähdön siirtymän (palkki jäi täytenä ruudulle).
  Päättynytkin sisääntulo samalle ominaisuudelle esti siirtymän
  kompositoinnin (`compositeFailed = 64`). Jokainen liike on OMA
  kääreensä (`#lr-lahto` / `#lr-tulo` / `#lr-keinu`), koska saman
  elementin animaatio ja siirtymä eivät yhdisty.
- **LATAUSRUUDUN SKRIPTI EI LUE IKKUNAN MITTOJA.** `innerWidth` pakotti
  koko dokumentin tyylin ja asettelun kesken jäsennyksen (13–21 ms
  ennen ensimmäistä ruutua). Leveys tulee `screen`istä ja suunta media
  querystä; skripti 6–7 ms.
- **`#loading.hidden` (`display: none`) ON SE MIKÄ PYSÄYTTÄÄ
  ANIMAATIOT.** Ilman sitä parikymmentä ikuista animaatiota jatkaisi
  kompositorissa kartan alla. Mitattu piilotuksen jälkeen: 0 jäljellä.
  `hideLoading` on idempotentti — kutsupaikkoja on viisi.
- **`hideLoading()` ON "DATA VALMIS", EI PIILOTUS.** Lähtö (`_lahde`)
  odottaa lisäksi vähimmäisajan 1,3 s esittelyn alusta (`LAHTO_MIN_MS`,
  kello `#loading._lrAlku`; vaimennetulla liikkeellä 0) ja valmiin
  kartan (`_karttaValmis`: `areTilesLoaded` + lämpökartta ilman
  odottavaa hilaa), jälkimmäistä enintään 1 s (`LAHTO_KARTTA_MAX_MS`).
  Lähtö (`.out`) on 0,3 s vähimmäisajan jälkeen eli 1,6 s kohdalla.
  Napautus, klikkaus tai näppäin ohittaa heti kun data on valmis.
  **1,3 s ja ohjeettomuus ovat käyttäjän päätös:** 3,4 s ja sitten 2 s
  olivat liian pitkiä ("kuski on pysähdystilassa"), eikä ruudulla ole
  "Napauta jatkaaksesi" -tekstiä — älä palauta sitä. **ALARAJA ON
  MERKKI:** siipi on avautunut 1,18 s ja spotti asettunut 1,40 s
  kohdalla, joten `LAHTO_MIN_MS` ei saa laskea alle 1,1 s:n (lähtö
  0,3 s sen jälkeen). Katto tulee vähimmäisajan päälle, joten 2 s:n
  katolla ruutu näkyi hitaalla säälaattayhteydellä 4,3 s; älä kasvata
  kattoa takaisin.
  Mitattuna vanha aukesi lämpimässä käynnistyksessä 0,93 s kohdalla
  karttaan jossa ei ollut laattoja eikä lämpökarttaa (0/3), 3,4 s:n
  versio 3/3 valmiina. 2 s:llä pohjakartan laatat ovat perillä 3/3, ja
  lämpökartan hila ehti kontin hitaalla säälaattayhteydellä 1/3 (muut
  katossa, lähtö 3,3 s). 1,3 s:llä laatat 5/5 ja hila 2/5 lähtöhetkellä
  (lähtö 2,6–3,3 s, eli kontissa katossa tai sen tuntumassa). Älä lisää odotusehtoa ilman kattoa, äläkä laske
  vähimmäisaikaa navigoinnin alusta (hitaalla verkolla se olisi jo
  kulunut kun ruutu syttyy).
- **KÄYNNISTYKSEN VIRHE JA JUMI OVAT LATAUSRUUDUN OMIA TILOJA
  (`Kaynnistys`), EIKÄ NIISSÄ OLE NAPPIA.** `main()`in kaatuminen →
  "Kartta ei käynnistynyt. Napauta yrittääksesi uudelleen."; dataa ei
  15 s:ssa (`JUMI_MS`) → "Lataus kestää. Napauta…". Napautus mihin
  tahansa lataa sivun uudelleen — käyttäjän päätös ("ei laiteta nappia").
  Jumissa lataus jatkuu ja ruutu lähtee normaalisti jos data tulee.
  Ruutu EI aukea tyhjään karttaan ajastimella: vanha 12 s:n "Safety"
  olisi tehnyt juuri sen (ja se oli kuollut, purettiin riviä ennen
  `main()`ia). Nämä tekstit ovat virheilmoituksia, eivät ohje — sääntö
  "ei Napauta jatkaaksesi -tekstiä" koskee normaalia latausta.
- **ELÄMÄ KOHTAUKSESSA ON ARKKEJA JA VARJOKOPIOITA** (docs/ui.md,
  "Pilvet, lokit, kaarron roiske ja jälki"): pilvet ovat YKSI hitaasti
  ajelehtiva arkki taivaan valon värisiä säteittäisiä liukuvärejä
  (`--lr-pilvi`, `--lr-pilvi-a`), lokkiparvi on yksi lentoanimaatio ja
  kaksi siiveniskua, ja kaarron vaahtojälki (`#lr-jalki`) on yksi
  opacity kaarron tahdissa (4,4 s, −0,3 s), pysähtyy lähdössä.
  Kaarron kukonpyrstöroiske poistettiin käyttäjän pyynnöstä — älä
  palauta sitä. Animaatioita esittelyssä 61, levossa 37.
- **TILAPALKKI ON VALKOINEN TUMMALLA, VÄHINTÄÄN 10:1 JOKA
  VUOROKAUDENAIKANA — MYÖS VAAKATILASSA.** Vaakatilassa 7 % on 28 px,
  joten taivaan yläväri on kiinteä 44 px:iin asti, ylin tuulijuova on
  vähintään 70 px alhaalla (`YLIN`), kuu `max(92px, 16%)` ja aurinko
  matalalla ruudulla `max(100px, …)` kapeammalla hehkulla. Ennen
  vaakatila oli mitattuna yöllä 1,19:1 (kuu) ja päivällä 5,45:1
  (auringon hehku); nyt vähintään 11,19:1. Pilvet eivät nouse
  `max(80px, 12%)`:n yläpuolelle. Yöllä ylälaita on kartan `--bg` (18,38:1),
  päivällä tummansininen (10,54:1). Kun ruutu oli kermaa, valkoinen
  tilapalkki oli 1,32:1; älä vaalenna ylälaitaa alle rajan.
- **MERKKI ON SIIPI JA SPOTTI, JA SE SYNTYY `tools/ikoni.mjs`:STÄ.**
  Wingfoil-siipi yhtenä umpinaisena muotona (etureuna, jättöreuna ja
  alareunan lovi = puomi) ja kärjen yläpuolella pallo = spotti, molemmat
  paperia tummalla merellä. Käyttäjän päätökset: ikoni "moderni eikä
  kauhean värikäs", ja sitten "simppelimpi" annetun mallikuvan tyyliin.
  Edellinen 270°:n ramppikaari luki latausrinkulana, ja kolmiosainen
  siipi + tuulijuovat oli liian yksityiskohtainen. ÄLÄ PALAUTA RAMPPIA
  MERKKIIN: merkki ei kerro nopeutta, joten siinä ei ole rampin sävyä.
  Kotivalikon ikoni ja latausruudun merkki ovat SAMA sommitelma samassa
  512:n ruudukossa; `--inline` tulostaa latausruudun merkkilähteen
  (`#lr-merkki-lahde`: symbolit `lm-siipi` ja `lm-pallo`, avautumisen
  keskipiste, kulmat ja säde, pallon keskipiste, kohtauksen
  tuulijuovien värit), ja se vaihdetaan kokonaan tulosteella. Merkin id:t ovat
  `lm-`-alkuisia, koska kohtauksen kuskilla on jo `lr-kangas`:
  sama id kahdesti antoi merkin kankaalle kuskin liu'un (musta kangas).
  Ramppi PAPERILLA on yhä mitattu ja kaatunut (1,06:1). Älä piirrä
  merkkiä käsin uudestaan.
- **SIIVEN AVAUTUMISEN KIILA PYÖRII SIIVEN TYVEN YMPÄRI**
  (`data-keski` 27,55 % / 80,83 %, `data-r`), ei laatikon keskikohdan:
  reuna kääntyy etureunasta jättöreunaan ja siipi nousee tuuleen. Kiila
  on 73° eli yksi pala riittää. Spotin ponnahdus skaalautuu pallon
  omasta keskipisteestä (`data-pallo`).
- **MASKATTAVA IKONI ON ERI KOKO SAMASTA MUODOSTA.** Android leikkaa
  siitä 80 %:n ympyrän. Täyteen asti ulottuva merkki menettäisi päänsä,
  ja maskin mitoille tehty kelluisi pikkuruisena kotivalikossa
  (`MASKI_SKAALA` 0,8 koko sommitelmalle).
- **LATAUSRUUDUN RAE JA VINJETTI OVAT STAATTISIA, JA RAE ON MASKATTU
  POIS YLÄLAIDASTA JA NIMILOHKON ALTA** (`#lr-vinjetti::after`). Rae
  hajottaa tumman taivasliu'un porrastuksen, mutta se vaalentaa pohjaa:
  kaikkialla tilapalkki olisi 17,55:1 ja nimi 15,08:1. Maskattuna
  mitattu 19,65 / 16,34 / 6,48 / 7,25 — samat kuin ennen.
- **`background_color` ON LATAUSRUUTU, `theme_color` ON KARTTA.**
  Edellinen on käynnistyksen välähdys ennen ensimmäistä maalausta, eli
  latausruudun ylälaidan väri; jälkimmäinen värittää järjestelmäpalkit
  kun ruudulla on kartta. Nyt molemmat ovat `#060912`, koska latausruutu
  on tummaa merta. Kun latausruutu oli kermaa, sama luku välähti mustana
  ennen kermaa — jos latausruudun väri joskus vaihtuu, `background_color`
  vaihtuu sen mukana.

**Paneelit**

- **VÄHINTÄÄN 740 px:N LEVEYDELLÄ KAIKKI KOLME PANEELIA OVAT SAMA
  SIVUPANEELI** (asetukset, spottikortti, ennustepaneeli): oikea reuna,
  koko korkeus, `--paneeli-lev` 400 px, sama varjo ja hiusreuna.
  Mitattuna ennen: asetukset 1 038 px (iPad vaaka) ja 1 267 px
  (työpöytä), spottikortti iPadilla koko ruudun levyinen, ennustepaneeli
  pohjalevy kaikkialla. Raja on LEVEYS eikä syöttölaite (`sivupaneelit()`
  lukee saman media queryn kuin CSS), joten iPad saa saman paneelin kuin
  työpöytä ja kapea työpöytäikkuna puhelimen asettelun. Puhelimella
  mikään ei muuttunut.
- **KARTTAA EI KUTISTETA, SE PANOROIDAAN** (`_sivupaneeliPanorointi`).
  Koon muutos vetäisi perässään uloimman zoomin, lämpökartan ja
  pohjakerroksen rajat. Aikajana ja alapalkki väistyvät
  (`html.paneeli-auki #bottom`), ja kosketuslaitteella kapseli siirtyy
  vapaan alueen keskelle. Luokan poistaa vasta VIIMEINEN suljettava
  paneeli: ennustepaneelin sulku ei poista sitä jos spottikortti on
  auki.
- **JOKAISESSA PANEELISSA ON SAMA SULKUNAPPI SAMASSA KOHDASSA**
  (`.paneeli-sulje`): 32 px:n paperiympyrä (V9, oli 30) ja X, 12 px oikeasta
  reunasta, osumapinta 44 px NAPILTA ITSELTÄÄN (ympyrä on sisempi
  span). Asetukset, spotti-/havaintokortti, ennustepaneeli ja
  pikanäppäimet. Ennen asetuksissa oli magenta "Valmis", korteissa
  pelkkä kahva ja ennustepaneelissa EI MITÄÄN — iPadilla sen sai kiinni
  vain karttaa napauttamalla tai Escillä. Sivupaneelitilassa mitattuna
  X on kaikissa neljässä paneelissa samassa pikselissä (351,4 paneelin
  kulmasta). Laajan näkymän sulku on sama `.paneeli-sulje`, ja kaavion
  laajennusnappi on `.ikoninappi` — sama ympyrä ja 44 px osumapinta
  (`.hav-nappi` oli 30 px ja poistettiin, V7). X-kuvio on yhdessä
  paikassa (`_SULJE_SVG`); staattisten nappien span on tyhjä ja
  täytetään siitä. Älä palauta tekstinappia äläkä kirjoita paneelille
  omaa sulkunappia.
- **PANEELIN KORTTI ON PINTA, EI KEHYS** (Yömeri, 1.10.): korotettu
  kortti on `--surface-hi` `--surface`n päällä, 16 px kulma, EI
  reunaviivaa eikä varjoa (`.sp-card`, `.sh-moduli`, `.sh-laatat`,
  `.fc-window`…; lohko "PINNAT ILMAN REUNAVIIVOJA" CSS:n lopussa).
  Moduulin SISÄLLÄ ei ole täytettyä laatikkoa lukemille (V16):
  lukemarivi on tekstiä moduulin pinnalla, ja valitun tunnin laatat
  ovat yksi pinta jonka solut erottaa hiusviiva.
  Ryhmän nimi on kortin ULKOPUOLELLA pienenä versaalina (`.sp-ryhma`,
  `.sh-ryhma`, 600). Kartan päällä kelluvat (kapseli, opastus, toast,
  verkkotila, nappien laput) PITÄVÄT reunansa, koska niiden alla on
  kartta. Valittu segmentti on `--surface-nosto` (`#2B3649`) eikä
  kermatäyttö: asetusten `.sp-seg`, kortin `.segmentti` ja
  ennustepaneelin `.fc-rajaus` ovat sama muoto. Useamman kuin neljän
  vaihtoehdon valinta on LISTA (`.sp-lista`, radio oikealla, alateksti
  kertoo mistä malli on), ei rivittyvä sirurivi. Uusi asetus käyttää
  näitä; älä palauta reunaviivaa korttiin.
- **SEGMENTTIVALITSIN ON YKSI (`.segmentti`)**: jaksot (ennuste,
  havainto, vesi, laaja) ja mallien asettelu. Valittu on korotettu
  pinta ja muste `aria-pressed`ista; kortin ennusteessa oli musta
  pilleri ja muualla korotettu — kaksi valitsinta samalle asialle.
- **YLÄPALKKI ON `.paneeli-yla`: otsikko 17 px/700 vasemmalla, X
  oikealla, 52 px + turva-alue.** Pohjalevyllä (puhelin) turva-aluetta
  ei lasketa, koska levy ei ulotu ruudun yläreunaan; spottikortin
  palkki on 44 px ilman otsikkoa, koska kortin otsikko on sen sisältö.
- **KAHVA ON ELEEN TARTUNTAKOHTA, EI NAPPI** (`.paneeli-kahva`, sama
  36×4 px `--hairline` kaikissa pohjalevyissä). Kahvan napautus sulki
  ennen spottikortin, ja sivupaneelina koko yläpalkki olisi ollut
  näkymätön sulkunappi. Sivupaneelissa kahvaa ei piirretä.
- **SULKUELE ON SAMA KAIKISSA: oikean reunan paneeli sulkeutuu vedolla
  oikealle (`sivuveto`), pohjalevy vedolla alas (`makeSwipeable`).**
  Asetukset ovat laatikko joka laitteella, joten ne vedetään aina
  oikealle; spottikortti ja ennustepaneeli sivupaneelina oikealle ja
  puhelimella alas. 80 px tai heitto 0,5 px/ms sulkee, muuten paneeli
  palaa. Mitattu oikeilla kosketustapahtumilla (CDP
  `Input.dispatchTouchEvent`): 30/30, ja kontrolli vanhaa buildia
  vasten kääntyy (iPadin spottikortti ei sulkeutunut vedolla lainkaan).
- **VAAKAELE KUULUU ENSIN SISÄLLÖLLE** (`_vaakaEleenOmistaja`).
  Vaakaan vierivän nauhan (tuntivalitsin, 5 vrk:n kaavio), ≥ 120 px
  leveän kaavion ja `touch-action: none` -elementin päältä alkava veto
  ei sulje — muuten jokainen tunnin valinta sulkisi kortin. Pienet
  kuvake-SVG:t (X, tähti) EIVÄT estä, eikä kahva (se on paneelin oma).
- **POHJALEVYN ALASVETO VAIN KAHVASTA TAI LISTAN OLLESSA YLHÄÄLLÄ.**
  Ennustepaneelilla oli oma käsittelijä joka lähti mistä tahansa: kun
  käyttäjä veti listaa alas palatakseen ylös, lista vieri JA paneeli
  sulkeutui (mitattu vanhalla buildilla). Nyt se käyttää samaa
  `makeSwipeable`a kuin spottikortti (`kahva`, `scrollEl` parametreina)
  ja saman `.dragging`-säännön.
- **SIVUPANEELISSA PYSTYVETO EI SULJE MITÄÄN**, ja liuku on sama
  .34 s kuin asetuksilla. Spottikortin verho on sivupaneelina
  läpinäkyvä (kortti ei ole modaali ja kartan pitää pysyä luettavana sen
  vieressä; verho jää, koska ohi napauttaminen sulkee kortin).
  Asetukset pitävät oman tummentavan verhonsa, ja puhelimella kaikki
  verhot ovat samat `rgba(6,10,14,.40)` (ennen .32 ja musta .45).
- **NAPIT PERIVÄT FONTTIPERHEEN** (`button, input, select, textarea
  { font-family: inherit }`). Ilman sitä selain antoi napeille oman
  fonttinsa: mitattuna 13 elementtiä spotti- ja havaintokortissa oli
  Arialia. Vain perhe — koko ja paino ovat napin omia. Myös `<kbd>`
  on järjestelmäfonttia, ei tasalevyistä.
- **KYTKIN ON YKSI: 40×24, 20 px:n nuppi, 16 px:n matka.**
  Ennustepaneelin kytkin oli 36×20 ja nimi 10 px `--ink-3`; se oli
  sama kuin asetuksissa. Ennustepaneelissa ei ole enää kytkimiä:
  aikarajaus on `.segmentti` (Kaikki päivät / Arki-illat / Viikonloppu),
  koska "Kaikki päiväajat" ohitti muut eli kyse oli yksivalinnasta
  (docs/julkaisu.md, UI 6).
- **ENNUSTEPANEELI ON "PARHAAT AJANKOHDAT" JA "NYT"-LISTA, JA SE LUKEE
  SAMAA SARJAA KUIN KORTTI** (`ForecastPanel._sarja` → `KorttiSarjat`
  Paras, varatie `spot.wx`). Vain tulevat tunnit, kaikki spotit —
  näkymärajaus sanoi ennen tyhjällä tuloksella "valitse suodatin" kun
  syy oli ettei näkymässä ollut spotteja. "Nyt"-lista on nykyhetken
  tunnilta (`Ennuste.nytTunti()`), ei aikajanan valinnasta, suosikit
  ensin.
- **KAPSELIN VASEN OSA ON OLETUKSENA AALLOT** (käyttäjän pyyntö 4.10.,
  docs/ui.md "Kapselin vasen lukema"): tuulikerroksella merkitsevä
  aallonkorkeus, suunta nuolena (mustetta, ei rampin väriä) ja arvioitu
  suurin aalto (`AALTO_MAKS_KERROIN` 1,9 × Hs, teksti "maks. ~" — WAM ei
  anna suurinta aaltoa). Valikossa on VAIN KAKSI riviä (`#suunta-picker`:
  Aallot / Tuulen suunta, `KapVasen`, `fs_kapseli_vasen`), ja kapselin
  suunta on aina asteina — sanallinen muoto poistettiin valikosta. Missä
  aaltoa ei ole (maa, jakson ulkopuoli, data matkalla) osa on tuulen
  suunta. Ei rantamaskia tuulikerroksella (se on aaltotilan kustannus).
  Aalto- ja sadetilassa vasen osa on pelkkä lukema eikä avaa valikkoa.
  **AALLONKORKEUDEN LUKU ON `AaltoVari`N VÄRI** (`AaltoVari.teksti`,
  nostettu 4,5:1:een `--surface`a vasten) kapselissa molemmissa
  tiloissa, ja sen edessä on aaltomerkki (aaltotilassa pääluvussa,
  tuulinäkymässä vasemmassa osassa)
  (`kapseliAaltoSVG`, sääikonien veden sävy). Sääntö "aallonkorkeus on
  mustetta" koskee tuulen ramppia, ei aaltojen omaa asteikkoa.
- **KAPSELI VÄISTYY KUN SPOTTIKORTTI ON AUKI**
  (`html:has(#sheet.open) #kapseli`). Kapseli lukee kartan keskipisteen
  ja kortti spotin: mitattuna 2,6 ja 6,9 kts yhtä aikaa samalla
  ruudulla. Ennustepaneelin kanssa kapseli jää.
- **REITTIOHJE ON YKSI NAPPI** (`buildNavButtons`): Apple-laitteella
  `maps.apple.com`, Androidilla `geo:`, muualla Google Mapsin
  reittiosoite; Waze tekstilinkkinä alla. Kaksi tasavertaista nappia ei
  tarjonnut iPhonella Apple Mapsia lainkaan.
- **KORTIN ENNUSTE VALITAAN VALIKOSTA, PÄÄLLE LISÄTÄÄN VAIN LAAJASSA**
  (käyttäjän päätös 2.10., docs/spottikortti.md V11). Kaavion yllä on
  valintakenttä (`.en-pohja`, `Ennuste._pohjaNappiHtml`), ja se on
  YKSIRIVINEN kortilla ja laajassa (V14): pelkkä nimi, ja jos se ei
  mahdu, lyhyt nimi (`data-lyhyt`, `_mahdutaPohja`: "Paras"), ei kolmea
  pistettä. Lähde ja ajo ovat kaavion lähdekaistassa — kentän alarivi
  ("Tällä tunnilla FMI HARMONIE…", V10) oli kortilla neljäs maininta
  samasta lähteestä. Kenttä avaa `Valikko`n (Paras saatavilla + viisi
  mallia). **Kortilla kaavio näyttää vain valitun ennusteen.** Laajassa
  sama kenttä valitsee pohjan, ja sen
  vieressä on **"Vertaa"-nappi**, joka avaa monivalinnan muille malleille
  (`Valikko` `moni`, enintään 3; neljäs on pois käytöstä ja valikko
  sanoo miksi) — kaikki samaan kaavioon (P12, 3.10.). "Lisää"-sirurivi
  POISTETTIIN: se vieri sivuttain ilman merkkiä jatkosta, ja valitut
  näkyivät puhelimilla 0–14 % (docs/spottikortti.md, 8.2.1). Älä palauta
  sirurivejä laajaan. Tila on yksi
  (`fs_kortti_mallit` `{ pohja, valitut }`, `Ennuste._muuttui`), eikä
  pohja ole koskaan päällekkäinen käyrä. **ALLEKKAIN-ASUA EI OLE**
  (käyttäjä: "turha"); älä palauta sitä äläkä "Vertaa kaaviossa"
  -riviä. Malli joka ei anna sarjaa sanotaan kortissa — ei vaihdeta
  hiljaa toiseen ennusteeseen.
- **`Valikko` ON AVAUTUVIEN LISTOJEN KOMPONENTTI**: `body`n lapsi ja
  `position: fixed` (moduulin `overflow: hidden` leikkaisi sen),
  `role="option"`-rivit, nuolet, ohi napautus ja sarkain sulkevat, ja
  se on globaalin Esc-listan ENSIMMÄINEN. Uusi pudotusvalikko käyttää
  tätä.
- **Tähti ja jakonappi ovat PIIRRETTYJÄ** (`_tahtiSVG`, `_JAKO_SVG`),
  eivät ☆/⇗-merkkejä. Jakonappi avaa kosketuslaitteella järjestelmän
  jakoarkin (`navigator.share`) ja kopioi työpöydällä linkin;
  peruutus (AbortError) ei ole virhe.

**Saavutettavuus**

- **Kontrolli on `<button>`, ei `<div class="mctl">`.** Divinä ne eivät ole
  fokusoitavia eivätkä ruudunlukijalle painikkeita — mitattuna viidestä
  pääkontrollista 0 tavoitettavissa sarkaimella.
- **Suljettu paneeli piilotetaan `visibility: hidden`illä.** Pelkkä
  `translate` ruudun ulkopuolelle jättää sen sarkainkierrokseen ja
  ruudunlukijan puuhun. Näkyvyys vaihtuu vasta liu'un jälkeen
  (`transition-delay`), muuten paneeli katoaa kesken sulkeutumisen.
- **Esc sulkee KAIKKI päällekkäiset pinnat**, myös asetukset. Jos lisäät
  paneelin, lisää se Esc-listaan.
- **Sivulla on `h1` ja `role="main"`, ja ohituslinkki on ensimmäinen
  fokusoitava elementti.** Kartalla on 12 fokusoitavaa spottimerkkiä,
  joten ilman ohitusta näppäimistökäyttäjä painaa sarkainta 12 kertaa
  ennen yhtäkään kontrollia. `#app` sulkeutuu VASTA lopussa — jos suljet
  sen kartan jälkeen, main ei kata sisältöä (näin oli).
- **`role="button"` ei riitä divillä.** Enter ja välilyönti eivät laukaise
  clickiä, joten fokuspysäkki olisi pysäkki jolla ei voi tehdä mitään.
  Aktivointi tulee yhdestä dokumenttitason käsittelijästä, ja globaali
  näppäinkäsittelijä OHITTAA tapauksen jossa fokus on kontrollissa —
  muuten välilyönti play-napin päällä laukaisisi toiston kahdesti.
- **Piilota valintaruutu leikkauksella, älä `display: none`llä.**
  Ennustepaneelin kytkimet olivat `display:none` eivätkä siksi
  fokusoitavissa edes paneelin ollessa auki.
- **Päällekkäinen pinta kulkee `Modaali`-moduulin kautta.** Pinnat
  (asetukset, spottikortti, ennustepaneeli, pikanäppäimet, laaja näkymä,
  Tietoa ja kertaopastus) avautuvat ja sulkeutuvat eri poluista —
  paneelikohtaiset kuuntelijat ajautuisivat erilleen. Älä kirjoita omaa
  fokuspolkua uudelle pinnalle. Opastus ja Tietoa ovat Esc-listan
  ensimmäiset, koska ne avautuvat muiden päälle (Tietoa asetuksista).
- **`aria-modal` EI pidättele sarkainta.** Se hoitaa vain ruudunlukijan;
  ansa on tehtävä itse (yksi dokumenttitason kuuntelija, pinon
  päällimmäinen). `inert` ei kelpaa, koska paneelit ovat `#app`:n sisällä.
- **`Modaali.avaa` on IDEMPOTENTTI.** `openSheet` kutsutaan uudelleen joka
  aikajanan askeleella, ja jos avaus siirtäisi fokuksen joka kerta,
  jokainen tunnin askel veisi fokuksen pois siitä napista jota käyttäjä
  juuri painoi.
- **Paluukohde etsitään uudelleen, ei pelkkää viitettä.** Spottikortin
  avaaja on karttamerkki, ja `renderSpots` korvaa merkin uudella solmulla
  joka piirrolla — tallennettu viite osoitti irronneeseen solmuun ja
  fokus jäi bodyyn (mitattu). Viitteen rinnalla talletetaan `id` ja
  `title`.
- **Fokus menee dialogin SÄILIÖÖN, ei ensimmäiseen kontrolliin.** Säiliö
  kantaa roolin ja nimen, joten ruudunlukija lukee "Asetukset,
  valintaikkuna". Säiliöltä otetaan ääriviiva pois — fokus on siinä
  mekanismi, ei kontrolli.
- **Otsikoksi vaihdettu `div` tarvitsee `margin: 0`.** `#sp-title` ja
  `#fc-title` olisivat siirtäneet ylätunnisteitaan selaimen oman
  `h2`-marginaalin verran.
- **Havaintoasemien merkit ovat `keyboard: false`.** Muuten sarkain kulkee
  kymmenien merkkien läpi ennen kuin tavoittaa sovelluksen kontrollit.
- **Asetuspaneelin roolit luetaan RAKENTEESTA, ei kirjoiteta markupiin.**
  22 elementtiin käsin kirjoitettu `role`+`tabindex`+`aria-checked` on 22
  paikkaa jotka ajautuvat erilleen. Uusi siru tai kytkin saa kohtelunsa
  ilman lisätyötä.
- **Siruryhmä on `radiogroup`, ei nappirivi**, ja sarkain näkee sen
  YHTENÄ pysäkkinä (vaeltava tabindex) — 17 sirua olisi muuten 17
  pysäkkiä. Ryhmän sisällä nuolet, ja VALINTA SEURAA FOKUSTA, koska
  valinta ajetaan ryhmän delegoidusta klikkauksesta.
- **Nuolet paneelissa vaativat `stopPropagation`in.** Pelkkä
  `preventDefault` ei riitä: nuolet kuuluvat muuten kartalle, joka
  panoroi niillä. (MapLibren näppäinkäsittelijä kuuntelee vain
  karttasäiliötä, joten paneelista kupliva nuoli ei enää yllä siihen.
  Pysäytys jää silti: kuuntelijan paikka on MapLibren sisäinen
  yksityiskohta, ei sopimus.)
- **Aria-tila synkataan MutationObserverilla.** `.active` ja `.on`
  asetetaan kuudessa eri paikassa; aria-tilan kirjoittaminen jokaiseen
  olisi seitsemäs polku samaan asiaan.
- **Pyöreän napin kulma ei ole nappi.** `.mctl` on ympyrä, joten
  napautusmittauksen näytteet otetaan ympyrän sisältä — laatikon kulma
  antaa hudin joka on geometriaa, ei vikaa.

**Asetukset**

- **"AUTOMAATTINEN" TARKOITTAA PARASTA SAATAVILLA, JA PARAS TULEE
  VARASTOSTA.** Varastossa on kolme mallia omina pyramideinaan (FMI
  HARMONIE `h0`–`h3`, MET Nordic `n0`–`n3`, ECMWF `l0`–`l4`), ja niiden
  päällä ECMWF 9 km palvelimelta (`MalliHila`, zoomista 8).
  `kartanMalli()` palauttaa aina varaston. Valinnan tekee
  `Saalaatat.naytteista`: malli tulee PAIKASTA JA HETKESTÄ, zoom valitsee
  vain tarkkuuden saman mallin sisällä (docs/mallit.md). Älä palauta
  rajapinnan pakotusta automaattiin: se veisi kartalta laattapyramidin,
  ja sen hinta on mitattu (panorointi Suomessa 6,1 s ja 44 pyyntöä,
  käynnistys 22 s vastaan 3 s).
- **MALLIT SEKOITETAAN PAINOKANAVALLA, TÄRKEIN ENSIN.** Etusija on
  FMI > MET Nordic > mallin oma hila (`dyn`) > ECMWF (`Saalaatat.PERHEET`
  ja `_dyn`). Alueellisen mallin
  laatassa on neljäs tavutaso, paino 0..1 = smoothstep etäisyydestä
  mallin alueen reunaan 50 km matkalla; ajassa sama smoothstep akselin
  alussa 2 h ja lopussa 6 h. Perhe peittää alemmat painonsa verran, ja
  sekoitus on paikkainterpoloinnin sääntö (nopeus keskiarvona, suunta
  yksikkövektoreista). Reunalla paino on 0, joten raja on jatkuva:
  mitattuna FMI:n reunan hyppy oli 1,09 m/s keskimäärin ja 44 % yli
  1 m/s, nyt vierekkäisten 0,05°:n pisteiden ero raja-alueella on
  samaa luokkaa kuin mallin sisällä. Älä kirjoita toista
  valintasääntöä: lämpökartta, partikkelit, kapseli, aikajana ja
  lähdemerkintä (`malliKohdassa`) lukevat kaikki `naytteista`a.
- **`Saalaatat.taso()` ON VAIN POHJAMALLI.** Se valitsi ennen kaikkien
  tasojen joukosta askeleella, jolloin HARMONIE oli kartalla vasta
  zoomista 10 ja lämpökartta ja lähdemerkintä olivat z9,6:lla eri
  mieltä. Nyt se palauttaa ECMWF-tason `wx()`:lle; perheen taso on
  `_perheenTaso`.
- **VANHA ASIAKAS LUKEE VAIN `tasot`-LISTAN.** Uudet tasot (`h1`–`h3`,
  `n0`–`n3`) ovat luettelon `lisatasot`-listassa, koska vanha asiakas
  valitsee askeleella eikä tunne painokanavaa — se piirtäisi MET
  Nordicin kovalla reunalla. `tasot`issa ovat ECMWF ja `h0`, kuten
  ennenkin. Luettelon `versio` pysyy 1:nä: vanha asiakas hylkää muut.
  Mitattu molempiin suuntiin: uusi asiakas vanhalla varastolla ja
  vanha asiakas uudella, ei virheitä.
- **LAATTOJEN VERSIOAVAIN ON RAKENNUSHETKI (`luotu`), EI ECMWF:N
  AJOAIKA.** Kaksi rakennusta voi käyttää samaa ECMWF-ajoa ja eri
  FMI-ajoa, ja ajoaika avaimena antoi välimuistista edellisen
  rakennuksen FMI-laatan (mitattu: laatassa 63 hetkeä, luettelossa 70).
- **MALLIVALINTA ON PERHEVALINTA, EI TOINEN DATAPOLKU.** Jokainen tila
  (`auto`, `fmi`, `metnordic`, `ecmwf`, `icon`, `gfs`) on sama varasto
  eri perheillä (`Saalaatat.TILAT`, `asetaTila`), ja kartta, kapseli,
  partikkelit, aikajana ja lähdemerkintä lukevat saman `naytteista`n.
  Pakotus käänsi ennen kartan rajapintapolulle (600 pistettä,
  näkymätekstuuri), ja siksi pakotettu ICON oli läiskä eikä ICONin hila.
  Varaston ECMWF on AINA alimpana: se näkyy mallin alueen ja jakson
  ulkopuolella ja sen hetken kun mallin hila on matkalla — tyhjä kartta
  olisi rikki. Älä palauta pakotusta `Saalaatat.pois()`:n kautta.
- **MALLIVALINTAA EI TALLENNETA** (`Asetukset.TALLENTAMATTOMAT`).
  Sovellus käynnistyy aina "Paras saatavilla" -tilassa; pakotus on
  hetken vertailu, ja tallennettu pakotus näyttäisi seuraavalla
  avauksella huonomman mallin ilman muistutusta. Käyttäjän päätös.
- **MALLIN OMA HILA (`MalliHila`, `api/malli.js`).** Dynaaminen perhe
  `dyn` alueellisten alla ja varaston ECMWF:n päällä, `api` vaihtuu
  tilan mukana: `ecmwf` (O1280 9 km, valitulle TASATUNNILLE zoomista 8 —
  alla sama malli, joten raahauksen varasto vaihtaa vain tarkkuutta),
  `icon` (ICON-EU 7 km + ICON 13 km, sekoitus palvelimella 50 km ja
  6 h) ja `gfs` (tuuli `gfs013`, puuska `gfs025`). ICON ja GFS haetaan
  jokaisella zoomilla TUNTIPAKETTINA (±3 h, vähintään ±1 h), koska alla
  on eri malli: laatalla on oma aika-akseli ja tuntien väli interpoloidaan
  kuten varastossa; toistossa paketti jatkuu eteenpäin ja seuraava
  haetaan ennen reunaa. Lukija (`@openmeteo/file-reader`, GPL-2.0)
  ajetaan VAIN palvelimella — älä tuo sitä selaimeen.
  **Muuttujien otsakkeet haetaan YHTENÄ ALUEENA** (`Esiluku`): lukija
  hakee muuten jokaisen lapsen omalla pyynnöllään, ja ICON-tiedostossa
  lapsia on 128 — 7 tunnin paketti vei 12,4 s, alueena 1,45 s.
  **Mallin jakson loppu tulee KAUIMMAS YLTÄVÄSTÄ AJOSTA** (`mallinLoppu`),
  ei `data_end_time`sta: ICON-EU:n välimallit ulottuvat 30 tuntiin, ja
  tuoreimman ajon loppu häivytti ICON-EU:n jo +24 h:ssa (mitattu 6,8 vs
  7,58 m/s). **Aikajanan sarja on KENTÄN SOLMURUUDUN NELJÄ KULMAA**
  (`askel`, `solmut`), ei pyöristetty piste: 0,05°:n piste antoi
  Helsingissä 0,7–0,9 m/s eri luvun kuin kartta; kulmista 0,02–0,09.
  **S3-luvulla on AINA aikaraja** (6 s + kaksi uusintaa, sovelluksessa
  12 s): ilman sitä yksi kutsu seitsemästä jäi tuotannossa odottamaan
  funktion 30 s kattoon asti. Mallin jakson ulkopuolinen tunti ("ei
  ajoa") ei ole virhe vaan muistetaan tyhjänä (docs/mallit.md, V5–V6).
- **TESTISSÄ SERVICE WORKER ON ESTETTÄVÄ** (`serviceWorkers: 'block'`)
  kun varasto reititetään paikallisiin tiedostoihin: SW hakee laatat
  ohi Playwrightin reitityksen, ja testi lukee silloin tuotannon
  laattoja uuden luettelon kanssa.
- **TASOKOHTAINEN AIKA-AKSELI EI OLE YLELLISYYTTÄ.** Mitattuna 10
  pisteessä ja 400 tunnissa: HARMONIE varaston omalle 3 h akselille
  tallennettuna jättäisi tuntien väliin keskimäärin 0,41 m/s ja
  enimmillään 3,34 m/s virhettä, suunnassa 172°, ja **29,8 %
  tunneista ylittäisi sovelluksen oman 0,5 m/s rajan**. Akseli on
  tason ominaisuus (`taso._ax`), ja laatta kantaa sen viitteen
  (`laatta._ax`), koska `naytteista` näkee vain laatan. Älä palauta
  jaettua `_ti`/`_tf`-paria.
- **HETKI ASETETAAN KAIKILLE AKSELEILLE KERRALLA** ja
  `asetaHetki` laskee samalla perheiden aikapainot ja mitätöi
  laattamuistin: sama piste osuu eri perheeseen eri hetkellä.
- **ULOIN NÄKYMÄ PYSYY VARASTOSSA JA ILMAN REUNUSTA.** Se on syy miksi
  varasto on yhä olemassa, ja maailmankartan nopeus on sen ansiota.
- **`kaytossa()` = VARASTO ON KUNNOSSA, `kartallaKaytossa()` = KARTTA
  LUKEE SITÄ.** Mallivalinta ei enää sulje varastoa kartalta (se on
  perhevalinta, ks. yllä), mutta ero pätee yhä: `kartallaKaytossa()` on
  epätosi kun varasto on rikki ja kartta on varatiellä. Varaston omat
  datafunktiot (`varmista`, `naytteista`, `wxTunneittain`) ja AIKAJANA
  ovat `kaytossa()`:n takana, ja niiden ON toimittava vaikka kartta
  lukisi HARMONIEa. Kun nämä olivat hetken sama metodi, `varmista()`
  lakkasi hakemasta laattoja ja aikajana menetti 51 tuntia
  menneisyyttään (54,6 h -> 3,5 h, 403 -> 372 tikkiä) — ja sadetutkan
  mennyt kuva menetti kantamansa samalla. Älä yhdistä niitä takaisin.
- **AIKAJANA ON KARTAN SEKOITUS, TUNTI KERRALLAAN.** `wxTunneittain`
  laskee jokaisen tunnin samalla `naytteista`lla kuin kartta (mitattu
  ero kartan näytteeseen 400 tunnissa 0,0000 m/s, 1,6 ms sarjaa kohti),
  askeleella `laattaStep(round(zoom))` kuten lämpökartta. Akseli on
  yhä pohjamallin, joten se ei vaihdu kartan liikkuessa ja menneisyys
  säilyy (Suomessa se on MET Nordicia). Keskipisteen KAIKKIEN perheiden
  laatat haetaan erikseen (`varmistaPiste`), koska `varmista` jättää
  alemmat perheet hakematta täyden ylemmän alle — ilman sitä janan päät
  jäisivät tyhjiksi.
- **`gridStep` ON RAJAPINTAHILAN VÄLI, `laattaStep` PYRAMIDIN.**
  Ne EIVÄT saa olla sama funktio: `gridStep` synnyttää
  `getViewportPoints`in pistelistan, ja jokainen piste on Open-Meteon
  laskutuksessa oma kutsunsa — 0,05 asteen rajapintahila z12:ssa olisi
  juuri se kiintiö jonka takia koko varasto rakennettiin. `laattaStep`
  taas vain valitsee perheen sisältä tason (z10+ 0,05, z9 0,1, z8 0,25,
  z7 0,5, muuten `gridStep`), ja se on ilmaista. Lämpökartta, tähtäin,
  partikkelit (z7+) ja aikajana lukevat `laattaStep`iä, hilapisteet
  `gridStep`iä. **AINA PYÖRISTETYSTÄ ZOOMISTA** (`laattaStep(Math.round(
  zoom))`): `WindTexture.build` kutsui sitä pyöristämättä, jolloin
  vyöhykkeellä n − 0,5 … n kapseli ja partikkelit lukivat karkeampaa
  tasoa kuin lämpökartta (z 9,7: ka 0,59, max 1,25 m/s eroa). Nyt
  kapselin solmuhila on lämpökartan solmuhila (sama askel, sama
  globaalisti kohdistettu origo), ja se rakennetaan uudelleen levossa
  kun puuttuneet laatat saapuvat (`_taydennaLevossa`) — mitattuna
  z 7,7 / 8,7 / 9,7 / 10,3: max 0,001 m/s (docs/oikeellisuus.md, O3).
- **`onLaatta` HYVÄKSYY YLEMMÄN PERHEEN PEITON, JA `loadViewport`
  ODOTTAA LUETTELOA** (docs/data.md, "Kustannusarvio ja kaksi turhaa
  hakua"). `varmista` ei hae ECMWF-laattaa FMI:n tai MET Nordicin alta,
  joten pelkkää pohjaa katsova `onLaatta` lähetti Suomen pisteet
  `/api/harmonie`en; ja `alusta()` kesken latauksen on sama lupaus
  (`odotaAlustus`), ei `false`. Kumpikin vika maksoi ensikäynnillä
  rajapintaeriä joita kartta ei tarvinnut.
- **`varmista` LUETTELEE LAATAT TASOITTAIN, EI NÄYTTEISTÄ PISTEITÄ.**
  Asteen välein näytteistetty alue ohitti tason reunalle jäävän
  kaistaleen (l0-laatta 10–15° kattaa vanhan l0-alueen vain 14–15°):
  mitattuna 120 solmua 3 600:sta jäi ilman laattaansa. Nyt jokaisen
  tason laatat leikataan alueen kanssa ja testataan kulmista.
- **LAATTAMUISTI ON KÄYTTÖJÄRJESTYKSESSÄ, 160 LAATTAA.** Katto oli 40
  lisäysjärjestyksessä, ja maailmankierros pudotti Suomen laatat joka
  kerta. Mitattu jälkeen: Helsinki on paluussa FMI:tä 2,5–5 s:ssa ja
  valittu hetki pysyy.
- **RAJAPINTAPOLKU ON `Saalaatat.pois()`, EI `?laatat=0` — JA SE ON
  VAIN VARATIE.** Mallin pakotus kulki tätä kautta V6:een asti; nyt
  pakotus on perhevalinta, ja `pois()` jää rikkinäisen varaston
  varatieksi. Mitattuna `?laatat=0` vaihtoi vain piirtotavan ja data tuli
  yhä varastosta (506 pistettä 518:sta). Varaston sulkeminen on se kytkin
  joka siirtää koko kentän rajapintapolulle. (`?laatat=0` poistui
  MapLibre-siirrossa.)
  `LampoGL` lukee `kartallaKaytossa()`a joka ruudussa ja vaihtaa itse
  solmuhilasta näkymätekstuuriin (`WindTexture.canvas`, tila `'kuva'`);
  Leaflet-aikana laattakerros piti poistaa erikseen, ja pelkkä `pois()`
  jätti vanhat laatat kartalle.
  **NÄKYMÄTEKSTUURI LADATAAN SISÄLTÖVERSIOSTA, EI RAJOISTA.**
  `WindTexture.build` tyhjentää kankaan ennen kuin uusi kenttä on
  valmis, ja rajoihin sidottu lataus ehti ottaa tyhjän kankaan
  GPU:lle (mitattu: pakotetun mallin lämpökartta tyhjä). Lataus
  seuraa `WindTexture.kuvaVersio`a ja rajat talletetaan samalla
  (`kuvaRajat`), jotta kuva ja sen paikka tulevat samasta
  rakennuksesta.
- **PAKOTETTU FMI EI OLE PELKKÄ FMI.** HARMONIE kattaa vain Suomen ja
  lähialueet noin 66 tuntiin, joten pakotetussa FMI:ssä (kuten MET
  Nordicissa, ICON:ssa ja GFS:ssä) alue- ja jaksorajan takana on ECMWF
  (`Saalaatat.TILAT`: pohja on aina mukana). Tyhjä kartta
  Keski-Euroopassa ei ole "HARMONIE", se on rikki — sama sääntö mitattiin
  aikanaan rajapintapolulla, jossa `loadBatch`in `fmi_harmonie`-haaraan
  piti lisätä Open-Meteo-varatie (neljä `harmonie_empty`-virhettä ja
  tyhjiä eteläisiä eriä ilman sitä).
- **Partikkelien AVAIMIA ei saa vaihtaa** vaikka nimet
  vaihtuvat: `'vahan'` on nimeltään "Normaali" ja `'normaali'` on
  "Paljon". Avaimen vaihto pudottaisi jokaisen tallennetun valinnan
  oletukseen.
- **Oletus on siruryhmässä ensimmäisenä vasemmalla** (tuuli, kts,
  tumma, partikkelit-Normaali). Poikkeus: lämpökartan voimakkuus on
  asteikko, jossa järjestys on itsessään tieto.
- **POHJAKARTTOJA ON KAKSI: TUMMA JA SATELLIITTI.** Vaalea pohja
  poistettiin valitsimesta käyttäjän päätöksellä ("se ei ole toimiva").
  Sen koneisto (`Asetukset.paperi()`, multiply-sekoitus, `RAMP_INK`,
  sateen paperipaletti) jäi koodiin mutta on käyttämätön, koska
  yhdelläkään `POHJAT`-merkinnällä ei ole `paperi`-lippua. Tallennettu
  `'vaalea'` putoaa tummaan (`_sallitut`), ja `<head>`in
  käynnistysskripti tuntee vain satelliitin.
- **MALLIN VAIHTO EI SIIRRÄ TUNTIA.** Vaihto on vertailua varten ("sama
  tunti, eri malli"): valittu hetki (`State.valittuMs`) pysyy ja indeksi
  johdetaan siitä. Mitattu yhdeksällä peräkkäisellä vaihdolla menneellä
  tunnilla, +3 ja +9 vrk:n päässä ja zoomilla 5, puhelimella ja
  työpöydällä: ei yhtään vieritystä, indeksin kirjoitusta eikä kuplan
  muutosta (tapahtumapohjainen seuranta, ei näytteenotto — kontin
  ajastin antaa vain ~5 näytettä sekunnissa). Käynnissä oleva toisto
  pysäytetään vaihdossa (`kayta('malli')`), koska asetusten avaus ei
  pysäytä sitä ja jana jatkoi muuten kulkuaan vaihdon yli.
- **Yksikkölista on samassa järjestyksessä asetuspaneelissa ja
  kapselin valitsimessa.** Kaksi järjestystä samalle listalle on kaksi
  paikkaa jotka ajautuvat erilleen.

**Aikajana**

- **AIKAJANA ON PALKKEJA JA VIERITIN — NAUHA ON KOKEILTU JA PERUTTU.**
  Koko akseli yhtenä canvasina (0,93 px/tunti) + luuppi eleen ajan
  rakennettiin, mitattiin toimivaksi kahdella moottorilla rAF
  jäädytettynä, ja peruttiin käyttäjän päätöksellä: tuntipalkki on tämän
  aikajanan tunnistettava muoto, eikä yhden pikselin sarake ole palkki.
  Sama kuvio kuin partikkelien eleenaikaisella jäädytyksellä —
  toteutettu, mitattu hyväksi, peruttu käyttökokemuksen perusteella.
  Älä rakenna sitä uudelleen ilman että käyttäjä pyytää sitä nimeltä.
- **KUN KORJAUS "EI TOIMI" LAITTEELLA, TARKISTA JULKAISUHAARA ENSIN.**
  Repon oletushaara on `claude/vite-project-setup-6je1pq` ja Vercelin
  tuotanto seuraa sitä — ei sitä haaraa jolle työ tehdään. Kolme
  kierrosta aikajanan korjauksia raportoitiin rikkinäisiksi, ja jokainen
  raportti oli tehty deploysta jossa niitä ei ollut. Mittausasetelman
  epäily on oikea refleksi vasta sen jälkeen kun on varmistettu että
  testattu osoite sisältää sen commitin jota epäillään.
- **`currentHourIdx` on INDEKSI, ja aika-akseli vaihtuu kartan mukana.**
  Akseli tulee siltä ennustepisteeltä joka on kartan keskellä, ja
  zoomaus vaihtaa pisteen. Älä koskaan siirrä indeksiä sellaisenaan
  akselilta toiselle — hae uusi indeksi AJASTA (`_tlSailytaHetki`).
  Mitattu ilman sitä: −15 h, −55 h, +75 h, ja jopa kahden tuntiakselin
  välillä 5 h, koska ne eivät ala samasta hetkestä.
  **VALITTU HETKI ON `State.valittuMs`, JA SE ON TOTUUS.** Valinta
  kirjoitetaan `_tlValitseHetki(idx, times)`illa, joka lukee ajan SIITÄ
  akselista jolle indeksi kuuluu; akselin vaihdot (`updateTimelineToCenter`,
  mallin vaihto) johtavat indeksin `valittuMs`ista eivätkä kirjoita sitä.
  Älä kirjoita `State.currentHourIdx`iä suoraan valintapaikassa.
- **AIKAJANAN UUDELLEENRAKENNUS EI OLE KÄYTTÄJÄN VALINTA.**
  `_tlBeginSelfScroll`in lippu nollautuu ensimmäisessä `scrollend`issä,
  mutta rakennuksessa vierityksiä on useita (tyhjennys, snäppäys,
  sijoitus). Mitattuna maailmankierroksen jälkeen snäppäysvieritys 68 ms
  rakennuksen jälkeen luettiin sormeksi ja valituksi hetkeksi tuli
  akselin alku: 21:00 → 15:00, kahdella ajolla kolmesta — ja koska
  HARMONIEn ajo alkoi 18:00, Helsinki näytti ECMWF:ää zoomilla 10. Se oli
  "muualla käynnin jälkeen Helsingin yllä on muu malli". Hidas polku
  merkitsee rakennuksen ja sen sijoituksen (`_tlMerkitseRakennus`), ja
  vieritys- ja `scrollend`-käsittelijät ohittavat 400 ms ikkunan
  (`_tlRakennusKesken`) ellei sormi ole nauhalla. Mitattu jälkeen 3/3
  kierrosta ilman siirtymää, ja rullavieritys valitsee yhä.
- **Älä tihennä aikajanaa tuntia pienemmäksi — paitsi sadetilan vartit.**
  Sadetilassa tutkan ja nowcastin jaksolla valinta napsahtaa varttiin
  (`State.sadeVartti` tunnin indeksin rinnalla, `.tl-vartti`-snäppäyskohdat
  vain `html[data-sadekerros="1"]`; käyttäjän päätös 4.10.,
  docs/sadetutka.md V2): tutkassa on oikea 5 min data. `currentHourIdx`
  pysyy lähimpänä tasatuntina, joten tuuli, kortti ja merkit eivät tiedä
  vartista; sen lukevat vain `_tutkaHetki` ja kupla. Uusi tunnin valinta
  nollaa sen (`_tlValitseHetki`). Snäppäyskohta on 1 × 1 px — 0 × 0 px
  ohitettiin ja vieritys palasi tasatuntiin. Tuulen perustelu: varastoaskelen
  sisällä tuntipisteet ovat SUORALLA (poikkeama 0 m/s, 10 640 kolmikkoa),
  muutos minuutissa on 0,0033 m/s eli 150× alle sovelluksen oman
  0,5 m/s rajan, ja 94 % minuuteista renderöityisi identtisesti.
  10 min veisi +7 vrk raahauksen 10 ruudullisesta 60:een.
  Aikajanan vika oli navigointi, ja se on `#tl-paivat`.
- **Palkin korkeus on KIINTEÄLLÄ asteikolla (30 m/s = täysi, 72 px).**
  Sarjakohtainen maksimi teki palkeista vertailukelpoisia vain sarjan
  sisällä, ja sarja vaihtuu joka kartansiirrolla: mitattuna 7,67 m/s oli
  14,1 px ja 8,40 m/s 13,4 px. Älä palauta `maxMs`-skaalausta.
- **KATTO ON 30 m/s JA KORKEUS 72 px — ASTEIKKO EI KYLLÄSTY.** Katto
  oli pitkään 14 m/s sillä perusteella että sen yli ei enää valita
  keliä vaan kokoa, joten väli sai kyllästyä ja värin annettiin jatkaa
  yksin. Se oli väärin: 14, 20 ja 28 m/s piirtyivät PIKSELILLEEN
  samankorkuisina, eli myrskypäivä näytti rivissä samalta kuin kova
  mutta foilattava päivä. Korkeus on rivin ensimmäinen luettava muoto
  eikä se saa vaieta siellä missä lukema on vaarallisin.
  Nyt yläpää saa pienen mutta AINA KASVAVAN siivun: 14 m/s = 0,88,
  20 m/s = 0,96, 30 m/s = 1,00 (14 → 20 on 5,8 px, 20 → 30 on 2,9 px).
  Korkeus 72 px maksaa noston: päätösväli 4–11 m/s pitää 5,8–6,2 px
  metriä sekunnissa kohti eli saman kuin 58 px:llä kapeammalla
  akselilla, ja tavallinen rannikkotuuli nousee korkeammalle
  (6 m/s 18,6 → 25 px, 10 m/s 42,5 → 49 px). Älä palauta kattoa
  kyllästyväksi.
- **PUUSKAHUNTU ON POISTETTU, JA PALKKI SAI SEN TILAN.** Palkin päällä
  oli ylöspäin häviävä muste-huntu (korkeus = puuskan ja tuulen ero,
  katto 11 px; alfa = puuska/tuuli-suhde). Se oli mitattu ja kalibroitu
  kahdesti — täytettynä vyöhykkeenä ja sitten huntuna — mutta se oli
  koko ajan toinen muoto samalla akselilla ja näkyi 85 %:ssa tunneista,
  koska puuska/tuuli-suhteen mediaani on Itämerellä 1,41. Esitystavan
  keventäminen ei riittänyt; tieto on nyt kapselin puuskarivillä ja
  spottikortin kaavion vyöhykkeessä. Poisto vapautti 11 px, ja palkki
  kasvoi 44 → 52. Älä palauta huntua — sille ei ole enää tilaa, ja
  palkin korkeus olisi pudotettava takaisin.
- **TIKKI ON 18 px JA PALKKI 12 px, JA PUOLIKAS LUETAAN
  `TL_TIKKI_PUOLI`:STA.** Tikki kapeni 22 → 16 → 12 koska aikajanan vika
  oli matka (viikon päähän 3 934 px eli kymmenen ruudullista → 2 232 px
  eli 5,7), ja leveni sitten takaisin 16:een koska tunnit lukivat liian
  tiheinä: 12 px:n tikillä ruudulle mahtui 32 tuntia ja lukemien väliin
  jäi 3,1 px. Kahdeksaantoista se leveni siksi että lukema saisi oman
  pykälänsä: 16 px ja 9 px:n lukema jätti väliin 6,0 px, 18 px ja 10 px:n
  lukema jättää 6,9 px — eli rivi hengittää ENEMMÄN vaikka kirjasin
  kasvoi. Näkyviä tunteja on 21 (16 px:llä 24). Viikon matka on 3 024 px
  eli 7,8 ruudullista — hinta maksetaan tietoisesti luettavuudesta.
  Palkkien väli on 6 px — leveys ja väli kuuluvat yhteen, ks. `.htick`.
  Keskityksen puolikas oli ennen kirjoitettu neljään paikkaan lukuina
  (12, 12, 11, 10), joista kaksi oli jo valmiiksi eri mieltä kahden
  muun kanssa.
- **PÄIVÄRAJA ON HIUSVIIVA TIKISSÄ, EI OMA ELEMENTTI — JA SE OLI ELEEN
  VIKA.** Erotin oli 26 px:n laatikko nauhan virrassa, ja se maksoi
  kaksi asiaa. RYTMIN: tikkiväli oli mitattuna 12 px kaikkialla mutta
  **43 px keskiyön yli**. Ja ELEEN: erottimella ei ollut
  `scroll-snap-align`ia, joten `scroll-snap-type: x mandatory` veti
  keskiyötä lähestyvän vierityksen takaisin — mitattuna **neljätoista
  16 px:n askelta peräkkäin eikä jana liikkunut klo 23:sta tuntiakaan**.
  Juuri se on "päivän yli vierittäminen hämää" -oire. Nyt raja on
  `.htick.pv-alku`:n 1 px hiusviiva, joka ulottuu vain lukemariviin;
  tikkiväli on mitattuna sama keskiyön yli kuin muualla (18 px ja
  18 px), yksi tikin askel etenee tunnin koko matkan, ja
  päivälappu pysyy osoittimessa 1,2 px:n sisällä. Älä palauta omaa
  elementtiä, äläkä vedä viivaa palkkien läpi: seitsemäntoista
  pystyviivaa datan päällä lukisi hilana.
- **VIERITYKSEN SEURANTAA EI SAA AJAA `requestAnimationFrame`issa.**
  WebKit ajaa kosketusvieritystä omalla säikeellään, ja ruutupyyntö voi
  jäädä palaamatta koko sen ajan kun sormi liikuttaa kelaa —
  scroll-tapahtumat tulevat silti normaalisti. Mitattuna rAF
  jäädytettynä: tuntinauhaa raahatessa `currentHourIdx` ja kapseli eivät
  liikkuneet lainkaan sormen alla (62 → 62, 6,2 kts → 6,2 kts) ja
  päivittyivät vasta nostosta; päiväkiskolla valinta ei vaihtunut
  kertaakaan. Kuristus on aikaleima (16 ms), ei ruutu. Mitattu hinta
  yhdelle askeleelle: `_tlSeuraaHetkea` mediaani 3 ms, max 4 ms.
- **KISKOSSA EI OLE `scroll-snap`IA, VAIKKA TUNTINAUHASSA ON.**
  `scroll-snap-type: x mandatory` sitoo myös OHJELMALLISEN vierityksen:
  selain vetää jokaisen `scrollLeft`-kirjoituksen lähimpään lappuun ja
  tuottaa siitä oman tapahtumasarjansa. Mitattuna kymmenen 26 px:n
  kirjoitusta siirsivät kiskoa 0 px. `_tlKiskoKeskita` hoitaa
  keskityksen tarkemmin (mitattu −0,9 px) ja se ajetaan eleen
  päätteeksi.
- **KISKON ELE VAATII SORMEN KISKOLLA — SIJAINTIVERTAILU EI RIITÄ
  YKSIN.** Kiskon scroll-käsittelijä päätteli ennen pelkästä
  sijainnista: jos `scrollLeft` ei ole se minkä juuri kirjoitimme
  (±1 px), tapahtuma on käyttäjän. Päättely pettää aina kun oma
  kirjoitus ei laskeudu tarkalleen — ja keskiyön yli se on kiskon
  SUURIN kirjoitus, kokonaisen lapun verran, jonka iOS:n
  `-webkit-overflow-scrolling: touch` asettaa useamman ruudun aikana.
  Seuraus ei ollut kosmeettinen: väärin luettu tapahtuma ajoi
  `_kiskoSeuraa`n, joka vie TUNTINAUHAN kiskon keskimmäisen päivän
  samaan kellonaikaan (`_tlPaivanIdx`). Mitattuna vanhalla koodilla
  **24 tunnin hyppy ja 288 px nauhan siirto sormen ollessa
  tuntinauhalla** — sitä käyttäjä näki päivämäärän vilkahduksena
  väärässä kohdassa. Portti on nyt suora signaali
  (`_tlKiskoSormiOllut`), ei päättely, ja se on MYÖS `_kiskoLoppu`ssa,
  koska sinne tullaan kolmesta paikasta (`scrollend`, varmistusajastin,
  sormen nosto) — pelkkä scroll-polun portti jätti tunnin hypyn
  jäljelle. Mitattu jälkeen 0 h ja 0 px, kontrolli ilman kiskon
  nytkäystä 0 h.
- **Kiskon oma vieritys tunnistetaan SIJAINNISTA, ei ajastimesta.**
  300 ms:n ikkuna oli väärä mittari molempiin suuntiin: kirjoituksen
  jälkeiset tapahtumat voivat tulla myöhemmin (jolloin oma vieritys
  luetaan sormeksi) ja ikkuna oli auki jokaisen kirjoituksen jälkeen,
  eli käytännössä aina (jolloin sormi luetaan omaksi vieritykseksi).
  `_tlKiskoKirjoitettu` + yhden pikselin toleranssi ratkaisee sen ilman
  ajastimia.
- **NAPAUTUS EROTETAAN RAAHAUKSESTA MATKALLA, EI TAPAHTUMALLA.**
  Puhelimella sormi liikkuu napautuksessakin pari pikseliä ja
  scroll-tapahtuma lähtee, joten "onko scrollattu" nielaisee
  napautukset. Mittari on kiskon `scrollLeft` eleen alussa ja lopussa,
  kynnys 6 px.
- **KISKON ELE ON OHI VASTA KUN SORMI ON NOUSSUT JA VIERITYS
  PYSÄHTYNYT** — molemmat, ei kumpi tahansa. Selain lähettää
  `scrollend`in myös kesken eleen aina kun vieritys hetkeksi pysähtyy
  sormen alla, ja siitä päätellen keskitys osuisi sormen alle. Toisaalta
  pelkkä `scrollend` ei riitä päätteeksi: jos se ehti tulla sormen
  ollessa vielä kiinni, kisko jäi keskittämättä (mitattu 10,9 px
  sivussa). Molemmat reitit (`scrollend`/ajastin ja sormen nosto)
  johtavat samaan `_kiskoLoppu`un.
- **KORKEUS ON SUMMA, EI YKSI LUKU, JA JÄRJESTYS ON YLHÄÄLTÄ ALAS
  KARKEAMPAAN.** `#tl-wrap` on `122px + var(--tl-paivat-h) +
  var(--sab-tl)` eli 156 px, ja se jakautuu näin: 6 px ylätäyte,
  96 px tuntinauha, 6 px väli, 34 px päiväkisko, 14 px alatäyte.
  Tuntinauhan 96 jakautuu edelleen kolmeen: **10 px NYT-lappu ylhäällä,
  72 px palkkivyöhyke, 14 px lukemarivi alhaalla.** Kiskon 34 jakautuu
  kahteen: **pilleri ja päiväys 3–27 px, kelikaista alimmat 9 px**
  (juovan keskiviiva 4,5 px kaistan yläreunasta).
  Lukujärjestys on tarkoitus: hetki (kupla), tuuli (palkit), tunti
  (lukemat), päivä (kisko), päivän kelit (kaista) — karkeampi askel
  aina edellisen alla.
  **Alatäyte on 14 px eikä 8, ja se on lähdemerkinnän tila.**
  `#lahde-merkki` ja `#tutka-aika` ovat `bottom: 0`, ja kahdeksalla
  kisko peitti niistä 2 px.
  **Palkin kasvattaminen vaatii joko sen 122:n tai tilan josta se on
  pois.** 44 -> 52 oli jälkimmäistä (puuskahunnun poisto); 52 -> 58 ja
  58 -> 72 ovat edellistä. Palkki päättyy TASAN NYT-lapun alareunaan,
  mitattu päällekkäisyys 0 px.
- **LUKEMA ON ALARIVILLÄ JA JOKA TUNNILLA.** Rivi on 14 px nauhan
  alalaidassa (`.htick`in `padding-bottom`), ja siinä on kaksi painoa:
  himmeä `--tl-teksti-3` joka tunnille, valkoinen `--tl-teksti` + 600
  joka kolmannelle (00, 03, 06, 09, 12, 15, 18, 21). Ennen lukema oli
  PALKKIEN PÄÄLLÄ ylhäällä ja vain joka kolmannessa tikissä, ja
  perustelu oli "kaikki lukemat vierekkäin olisi harmaa juova" — juova
  syntyi siitä ettei niillä ollut omaa riviä.
  **Koko on 10 px, ja se seuraa tikin leveyttä.** Kahdellatoista
  pikselillä mahtui vain 8 px ("23" on 8 px:llä 8,9 px leveä, 9 px:llä
  10,0 ja 10 px:llä 11,1), ja lukemien väliin jäi 3,1 px. Kuudentoista
  tikillä ja 9 px:n lukemalla väli oli 6,0 px; kahdeksantoista tikillä ja
  10 px:n lukemalla se on mitattuna 6,9 px — kirjasin kasvoi ja rivi
  hengittää silti enemmän. Mitattu 391/391 lukemaa, ja mitattuna
  ruudulta lukeman kontrasti alustaan 17,11:1.
- **KAIKKI ON NÄKYVISSÄ, MYÖS LÄHDEMERKINTÄ.** Liukuväri on reunasta
  reunaan ja ulottuu ruudun pohjaan, eli täsmälleen sinne missä
  `#lahde-merkki` ja `#tutka-aika` ovat. Ne olivat `z-index: 19` ja
  aikajana 20, joten tummennus peitti ne kokonaan. Nosto 21:een
  palauttaa ne, ja väri vaihtui kartan mukaan säätyvästä
  `--kartta-teksti`-tokenista aikajanan omaan valoon — alusta ei ole
  enää kartta vaan tummennus. Mittari tarkistaa myös ettei yksikään
  kääreen elementti jää ruudun ulkopuolelle (mitattu: tyhjä lista).
- **NYT-LAPPU ON YLÄREUNASSA, EIKÄ SE MAHDU ALARIVILLE.** Lappu on
  17,5 px leveä 2 px:n merkin päällä eli peittää molemmat naapurit:
  alarivillä siitä tuli mitattuna KOLMEN TUNNIN REIKÄ asteikkoon
  (… 16 17 NYT 21 22 …, 388/391 lukemaa). Ylhäällä se on yksin, koska
  tuntilukemat ja päiväerotin ovat poissa sieltä.
- **`VALO_VARIT` ON NYT VAIN KAAVION.** Aikajana luki samat luvut
  CSS-muuttujina, jotka `_valoVaritCssiin()` kirjoitti; kaista
  poistettiin, eikä muuttujia lukenut enää yksikään sääntö, joten
  kirjoittaja poistettiin samassa. Jos kaista joskus palaa johonkin,
  kirjoita muuttujat uudelleen SIITÄ objektista äläkä kopioi lukuja —
  SVG:n esitysattribuutit eivät tunne `var()`:ia, joten kaavio
  tarvitsee literaalit ja CSS muuttujat: kaksi muotoa, yhdet luvut.
- **NOPEA POLKU PÄIVITTÄÄ VAIN PALKIT.** Se riitti jo ennen kaikelle
  paitsi päiväerottimille, jotka eivät olleet `_tlTicks`issä ja jäivät
  siksi edellisen sijainnin sävyyn (mitattu 0/18 oikein). Sekä erottimet
  että valokaista on poistettu, joten ansaa ei enää ole eikä
  `_tlErottimet`-taulukkoa. `_tlMuisti`-vertailu sisältää yhä lat/lng,
  koska laattapisteet jakavat aikataulukon.
- **KARTAN ELEEN AIKANA PÄIVITETÄÄN VAIN NÄKYVÄT PALKIT, LOPUT
  `moveend`ISSÄ.** Jana seuraa kartan keskustaa myös vedon aikana
  (600 ms välein), ja koko nauhan päivitys oli puhelimen näkymällä eleen
  suurin JS-erä. Hinta on TYYLILASKENTAA, ei asettelua: 394 palkkia,
  pelkkä väri 3,7 ms ja korkeus 5,1 ms, eikä `contain` tai
  elementtien välimuisti muuttanut sitä (6,2 / 6,4 ms) — se on
  verrannollinen kirjoitettujen palkkien määrään. `_tlPaivitaPalkit(
  speeds, keskiIdx)` kirjoittaa `State.liikkeessa`-aikana vain puolen
  ruudun + `TL_PALKIT_REUNA` kummallekin puolelle `keskiIdx`:stä ja
  jättää loput velaksi (`State._tlPalkitVelka`); `_tlPalkitLoppuun`
  maksaa sen kartan `moveend`issä. Mitattuna eristettynä 7,7 → 1,7 ms
  (puhelin) ja 6,9 → 2,0 ms (iPad) päivitystä kohti, ja eleiden jälkeen
  0/394 palkkia väärin. **Velka maksetaan `moveend`istä, ei seuraavasta
  päivityksestä**, koska `updateTimelineToCenter` ohittaa päivityksen
  kun data on sama — muuten 350+ palkkia jäisi edellisen paikan
  arvoihin. Muuttumaton arvo ohitetaan (`bar._tl`), joten maksu ei
  kirjoita uudelleen niitä jotka ele jo kirjoitti.
- **Nuolinäppäimet kuuluvat kartalle.** MapLibren näppäinkäsittelijä
  panoroi nuolilla (kun fokus on kartassa) ja varaa Shift+nuolen
  kierrolle, joka on pois päältä — eli Shift+nuoli ei tee mitään.
  Aikajanan askellus on silti `,` ja `.`, koska nuolet ovat kartan, ja
  shiftattu merkki on eri `e.key` (suomalaisella `:` ja `;`) — lue
  `e.code`.
- **Play ja kelihyppy KELLUVAT PALKKIEN PÄÄLLÄ, EIVÄT LUKEMARIVILLÄ
  EIVÄTKÄ KISKOLLA.** Ne peittävät osan näkyvistä tunneista — se on
  kelluvan kontrollin tietoinen hinta, ei huomaamatta jäänyt vika, ja
  siirto kiskoriville on kokeiltu ja peruttu (transportti kuuluu sen
  raidan päälle jota se ajaa). Alareuna on `--sab-tl + 82px`, ja luku
  johdetaan kääreen pohjasta ylöspäin: turva-alue + 14 (alatäyte) + 34
  (kisko) + 6 (väli) + 14 (lukemarivi) = palkkivyöhykkeen alareuna, ja
  44 px:n kiekko keskitetään sen 72 px:n päälle. Kaksikymmentä peitti
  lukemariviä ja 34 osui kiskoon sen jälkeen kun kisko siirtyi alas.
  **KIEKKO ON LASIA, EI PAPERIA.** Paperikortilla se oli alustaansa
  VAALEAMPI (`--surface-hi` + kehä + varjo, 1,56:1). Tummennuksella
  vaalea kiekko olisi kortin äänekkäin elementti — kirkkaampi kuin
  yksikään palkki — eli sama sääntö rikkoutuisi toisesta suunnasta.
  Lasi on 24 % valkoista + 0,5 px hiusreuna (40 %) + varjo. Käytöstä
  poissa oleva nappi menettää nosteen — ei `opacity`, joka haalistaa
  myös reunan; sen lasi on 11 % ja reuna 20 %.
  **TUMMA VARJO EI NOSTA TUMMALLA ALUSTALLA, JOTEN NOSTO ON VALOSSA.**
  Lasi oli 15 % ja reuna 24 %, ja kohotuksen piti tulla varjosta
  (`0 2px 8px rgba(0,0,0,.28)`) kuten paperikortilla. Tummennusta vasten
  se varjo on näkymätön, joten nosto jäi pelkän lasin varaan: mitattuna
  ruudulta nappi oli alustaansa vasten 1,72:1 (play) ja 1,12:1 (kelinappi
  levossa) — nappi luki liukuvärin ALLA olevana vaikka se on sen päällä.
  Kerrosjärjestys oli koko ajan oikein (nappi `z-index: 6`, liukuväri
  `auto`, ja `elementFromPoint` osuu nappiin), eli vika oli materiaalissa
  eikä pinossa. Nostettuna play 2,45:1 ja kytketty kelinappi 2,12:1.
  Jos epäilet kerrosta, mittaa MOLEMMAT: laskettu z-index kertoo säännön,
  ruudun pikseli sen mitä silmä näkee.
- **Nappien peitto mitataan MOLEMMISSA suunnissa.** Pelkkä vaakavertailu
  väitti siirron jälkeen yhä 29 %:n peittoa vaikka napit olivat eri
  rivillä. Napautus on lisäksi mitattava oikeasti — ja niin että mittari
  palauttaa lähtötilan joka näytteen väliin: kelihyppy kuluttaa akselia,
  ja lopussa se ei liiku vaikka napautus osuu.
- **Kelikaista: LEVEYS on muoto, VÄRI on arvo** (sama kielioppi kuin
  vanhalla päivälapun kaistalla). Pelkkä väri ei kelpaa, koska rampin
  hiljainen pää on tummin eli tyyni näyttäisi raskaimmalta — siksi
  kaistan väri on lepoväriä foilausrajaan asti ja paksuus kertoo kelin.
  Kaista on pillerin ULKOPUOLELLA (alla): sisällä se osuisi pilleriin.
  Kaista kertoo TUULESTA; yö luetaan lappujen rajoilta (keskiyö =
  lappujen raja), ja vain kelihyppy vaatii valoisan tunnin.
- **Kaista päivitetään MYÖS nopeassa polussa** (`renderTimeline`in
  nopea tie kutsuu `_tlKaistaPiirra`a). Kisko rakennetaan vain
  hitaassa (se riippuu aikaleimoista), mutta kaista riippuu nopeuksista
  ja paikasta, ja nopea polku on juuri se joka ajetaan kun aika pysyy ja
  paikka vaihtuu. Sama ansa kuin päiväerottimien valovaiheessa.
  Piirto ~2 ms (kontti, dpr 3), ja muistiavain (`_avain`: akseli,
  nopeudet, nyt, geometria) ohittaa saman syötteen. Päivien rajat
  (`alut`/`loput`) tulevat samasta geometriasta kuin kiskon paikka
  (`_tlPaivaGeo`).
- **PÄIVÄYS ON KUPLASSA, KOSKA SORMI ON KISKON PÄÄLLÄ.** Sääntö oli
  ensin "päiväys sanotaan kerran, ja sen sanoo kisko": kupla näytti
  päiväyksen vain kun kisko oli piilossa, ja kun kisko jäi pysyvästi
  näkyviin, haara poistui. Se päättely piti niin kauan kuin kisko oli
  aikajanan YLÄPUOLELLA. Kisko on nyt alareunassa, eli täsmälleen siinä
  kohdassa jota sormi peittää koko sen eleen ajan jolla päivää
  vaihdetaan — ja juuri silloin päiväystä katsotaan. Kupla on osoittimen
  yläpäässä, sormen yläpuolella, ja se on eleen aikana ainoa paikka
  jossa päiväys näkyy. Kahdennus on tietoinen hinta, ja se maksetaan
  painolla eikä poistolla: päiväys on `.tl-kupla-pv` (500, alfa 0,62) ja
  kellonaika täydellä painolla. Mitattu kupla 102 px leveä, kokonaan
  kääreen YLÄPUOLELLA (pohja 506, kääre alkaa 508), peitettyjä palkkeja
  0 ja mahtuu ruudulle.
  Valittu päivä lukee edelleen VAALEASSA pillerissä täsmälleen
  osoittimen kohdalla — pilleri kääntyi paperin mukana, koska tummalla
  alustalla tumma pilleri katoaisi. Mitattu valkoinen pilleri kiskon
  pohjaa vasten 19,36:1.
- **PÄIVÄKISKO ON JATKUVA AIKA-AKSELI** (käyttäjän päätös 1.10.,
  `_tlKiskoX` / `_tlKiskoFrac`). Lappu on vuorokausi: vasen reuna on
  keskiyö, keskikohta klo 12 ja oikea reuna seuraava keskiyö, ja
  osoitin (kiskon keskikohta, pilleri) on aina VALITUSSA HETKESSÄ
  kellonajan tarkkuudella. Kisko liikkuu siis joka tunnilla (lappu/24
  eli ~2,5 px), ja yöllä pilleri on kahden päivämäärän välissä.
  Kytkentä on molempiin suuntiin: tuntinauhan veto liikuttaa kiskoa
  (`_tlSeurantaAskel` → `_tlKiskoKeskita`) ja kiskon veto tuntinauhaa
  (`_kiskoSeuraa`) 7,2 kertaa nopeammin — kiskolla hienosäätää aamusta
  iltaan pienellä liikkeellä (mitattu 36 px kiskoa = 14,1–14,5 h).
  Osuus tulee KELLONAJASTA eikä tikkiväliltä, joten klo 18:sta alkava
  reunapäivä on lapussaan 75 %:n kohdalla, ja kelikaista (sama
  asteikko) on osoittimen kohdalla oikeassa hetkessä. Kesäajan
  vaihtopäivä on 23 tai 25 tuntia (`alut`/`loput` ovat paikallisia
  keskiöitä). Historia: kisko liukui ensin tikkivälin osuutena, sitten
  lappu lukittiin keskelle ("päivämäärä voisi olla aina keskellä"), 30.9.
  toisto liu'utti sen keskiyön yli, ja 1.10. käyttäjä halusi jatkuvan
  kytkennän. Älä palauta keskelle lukittua lappua ilman käyttäjän
  pyyntöä. Kiskon geometria on talletettu (`_tlPaivaGeo`), koska toisto
  ja liu'ut kysyvät sitä joka ruudussa, ja se mitataan uudelleen kun
  laput tai kiskon leveys vaihtuvat. `scrollLeft` kirjoitetaan
  suoraan, EI `scrollTo`lla, ja alipikselin osa siirtona
  (`_tlKiskoTarkka`; pilleri siirretään saman verran takaisin).
- **KOROSTUS JA KESKITYS TULEVAT SAMASTA HETKESTÄ — INDEKSI KULKEE
  PARAMETRINA.** `_tlKorostaPaiva(d)` korosti päivän `d`:n mukaan mutta
  keskitti kiskon `State.currentHourIdx`:n mukaan. Ne ovat sama luku vain
  silloin kun kutsu tulee `_tlSeuraaHetkea`:sta. `renderTimeline` kutsuu
  `_tlUpdateNow(activeIdx)`:ia akselin vaihtuessa, ja SILLOIN
  `currentHourIdx` on vielä vanhan akselin luku: mitattuna korostus meni
  oikeaan päivään (Ke 16.) ja osoittimen alle jäi **La 12. eli neljä
  päivää sivussa** — ruudulla se on päiväyksen välähdys väärästä
  kohdasta. Nyt indeksi tulee parametrina samasta paikasta kuin `d`.
- **KISKO EI SAA JÄÄDÄ NOLLAAN YHDEKSIKÄÄN RUUDUKSI.**
  `_tlRakennaPaivat` tyhjentää kiskon, jolloin `scrollLeft` menee nollaan
  eli osoittimen alle akselin ENSIMMÄINEN päivä — ja akselissa on noin
  kaksi vuorokautta menneisyyttä. Korostus ja keskitys tehtiin vasta
  `renderTimeline`in `requestAnimationFrame`issa, ja siinä on kaksi
  vuotoa: keskitys vaikenee jos kiskolla on ele kesken (jolloin kisko jää
  nollaan kokonaan), ja nollasta kohteeseen on kiskon suurin mahdollinen
  kirjoitus. Mitattuna heti rakennuksen jälkeen, samassa suorituksessa:
  korostettuna EI MITÄÄN ja osoittimen alla `To 10.` (Chromium, kiskoX 0)
  tai `La 12.` (WebKit, kiskoX 154) kun oikea oli `Ke 16.`. Sijainti ja
  korostus asetetaan nyt `_tlRakennaPaivat`issa itsessään ja
  PAKOTETTUNA — uusia lappuja ei omista mikään ele, koska ne juuri
  syntyivät. Se on `_tlKiskoKeskita`:n `pakota`-lipun ainoa käyttö.
- **SORMI TUNTINAUHALLA -> KISKOLLA EI OLE ELETTÄ.** Tuntinauhaa
  raahatessa kisko liikkuu koko ajan, ja jokainen sen kirjoitus lähettää
  scroll-tapahtuman. `_tlKiskoSormiOllut` sulkee ne vain siihen asti kun
  kiskoa on viimeksi koskettu; `State._tlTouching` sulkee ne aina kun
  sormi on nauhalla. Portti on sekä scroll-polussa että
  `_kiskoLoppu`ssa, mutta `_kiskoLoppu`ssa se EI ole pelkkä `return`:
  liput on nollattava, muuten `_tlKiskoVierii` jäisi päälle ja kisko
  lakkaisi seuraamasta osoitinta pysyvästi.
- **KISKOSSA EI OLE `-webkit-overflow-scrolling: touch`IA.** Se oli
  siellä momentumin takia, mutta iOS 13:sta lähtien momentum on
  `overflow: auto`:n oletus eikä ominaisuus kytke enää mitään päälle —
  sen sijaan se siirtää elementin vanhaan vierityskerrokseen, jossa
  OHJELMALLINEN `scrollLeft`-kirjoitus asettuu useamman ruudun aikana.
  Kiskolla jokainen keskitys on ohjelmallinen kirjoitus, ja kaksi niistä
  ovat suurimmat mahdolliset: lapun siirto keskiyön yli, ja nollasta
  kohteeseen juuri rakennetulla kiskolla. Molemmat luettiin ruudulla
  päiväyksen välähdyksenä — lappu MATKASI paikalleen sen sijaan että
  olisi vaihtunut keskellä. Tätä ei voi mitata kontissa (Linux-WebKitissä
  ominaisuus on no-op), joten se on pääteltyä eikä mitattua; mitattu on
  se mikä välähdyksen sisältö oli.
- **VALINTAPILLERI EI LIIKU — SE ON KISKON KESKELLÄ, JA LAPUT VIERIVÄT
  SEN YLI.** Pilleri oli valitun lapun `::before` 0,15 s:n häivytyksellä,
  ja vanha pilleri himmeni sivussa kun kisko jo keskitettiin
  ("päivämäärän on pysyttävä koko ajan keskellä valkoisella
  valittuna"); sitten se oli kiskon sisarus ja valittu lappu tummui
  luokalla. Jatkuvalla kiskolla (1.10.) pilleri on yöllä KAHDEN lapun
  välissä, eikä luokka osaa tummentaa puolikasta tekstiä. Nyt pilleri
  on kiskon sisällön osa (`.tl-pilleri`, `position: sticky`, `left`
  mittauksesta, sisältökääre `.tl-paivat-sisa` `width: max-content` ja
  `isolation: isolate`), ja lappujen teksti sekoittuu sen kanssa
  erotuksena (`.tl-paiva-txt`, `mix-blend-mode: difference`): jokainen
  kirjain on tumma täsmälleen siltä osin kuin se on pillerin päällä.
  VÄRIT OVAT PARI: teksti `198,201,206`, pilleri `214,224,235`, ja
  |pilleri − teksti| = `16,23,29` eli entinen tumma muste — jos muutat
  toista, muuta toista. Sticky pysyy paikallaan kompositorissa, joten
  sormella vedettäessä teksti ja pilleri eivät ole ruutuakaan eri
  mieltä (JS:n kirjoittama väri olisi iOS:llä ruudun jäljessä).
  `.valittu` on enää semanttinen. Kaikki laput ovat saman levyisiä
  (5,4 em) ja pilleri yhden lapun levyinen. Älä lisää pillerille
  `transition`ia. **JOKAISELLA KÄÄREEN LAPSELLA ON `width` `flex`IN
  RINNALLA** (laput, pilleri, reunavälikkeet): WebKit laskee
  `max-content`-flex-kääreen lasten SISÄLLÖSTÄ eikä `flex-basis`ista,
  jolloin kääre oli 474 px kun sisältö oli 1 459 — ja sticky-pilleri
  jäi kääreen loppuun eli puhelimella "jumiin" kolmannen päivän
  kohdalle (käyttäjän raportti 1.10.: "jumittaa su 4 – ma 5 väliin").
  Chromium mitoittaa basisista, joten vika ei näy siellä — mittaa
  WebKitillä (kääre = sisältö, pilleri keskellä koko matkan).
- **LIUKU: VALINTA ON HETI, NÄYTTÖ LIUKUU** (käyttäjän pyyntö 1.10.,
  `_tlLiuuta`). Tikin, päivälapun, näppäimistön, kelihypyn ja
  spottikortin kaavion valinta (`_tlValitseIdx`) asettaa valinnan,
  kortin, merkit ja kentän (häivytyksellä) kohteeseen ennen ensimmäistä
  ruutua, ja vain tuntinauha ja kisko liukuvat perille: yksi liuku
  kerrallaan (`State._tlLiuku`), joka liikuttaa HETKEÄ eikä
  vierittimiä, joten `_tlNaytaHetki` vie molemmat samaan hetkeen joka
  ruudussa (mitattu ero ≤ 0,005 h molemmilla moottoreilla). Kupla
  rullaa kellonajan perille. Kesto `260 + 75·ln(1 + tunnit)` ms, katto
  560 (tunti 0,31 s, vuorokausi 0,49 s), käyrä ease-in-out. Sama liuku
  päättää toiston (180 ms lähimpään tuntiin) ja kiskon vedon (200 ms).
  Liuku on oma ruutusilmukka eikä `scrollTo({behavior:'smooth'})`:
  selaimen pehmeä vieritys kulki janan kuuntelijoiden kautta ja valitsi
  jokaisen välitunnin (mitattu 15 välitilaa ja 1 001 ms). Kosketus,
  rulla, uusi valinta, toisto ja uudelleenrakennus pysäyttävät liu'un
  PAIKALLEEN (`_tlLiukuSeis`). `renderTimeline`in nopea polku EI
  pysäytä liukua samaan kohteeseen: valinnan oma kentänrakennus ajaa
  sen kesken liu'un laattojen saapuessa, ja katkaisu hyppäisi nauhat
  perille. Toiston ja liu'un aikana `_tlKiskoKeskita` vaikenee (ei
  `pakota`). Vaimennetulla liikkeellä ei liu'uta.
- **Kiskossa on reunavälikkeet**, kuten tuntinauhassa: ilman niitä
  selain rajaa `scrollLeft`in nollaan eikä akselin ensimmäistä ja
  viimeistä päivää saa osoittimen alle.
- **Sormi kiskolla voittaa** (`_tlKiskoKosketusOma`). Lippu nollataan
  IKKUNASTA, koska kisko rakennetaan uudelleen kesken eleen ja
  alkuperäinen kohde irtoaa DOM:sta.
- **KUPLAN VIERESSÄ ON PALUUNAPPI NYKYHETKEEN** (`#tl-nyt`, käyttäjän
  pyyntö 2.10.): kuplan lapsi `left: 100%` (kupla pysyy osoittimen
  keskellä), kermaympyrä 26 px, osumapinta 44 px. Näkyy VAIN kun
  valittu tunti ei ole nyt (`_tlKuplaTeksti`, `Ennuste.nytTunti` =
  `nowIdx`in pyöristys) ja vie `_tlValitseIdx(nowIdx)`:iin kuten Home.
  Kuvake on `_PALUU_SVG`, sama kuin kaavion Nyt-napissa.
- **PÄIVÄKISKO ON ALHAALLA JA AINA NÄKYVISSÄ.** Se piiloutui ennen
  neljän sekunnin levossa, koska paperikortilla se oli 30 px kromia
  128:sta. Liukuvärillä korkeus ei maksa karttaa samalla tavalla —
  tummennus häivyttää eikä katkaise — ja piiloutuva kisko oli silti
  aina yksi ele lisää ennen kuin päivän saattoi valita. Poistuivat
  `html.tl-kisko-piilossa`, `_tlKiskoHerata`, `_tlKiskoNukuta`, niiden
  kolme kutsupaikkaa ja aikakuplan päiväyshaara. `--tl-paivat-h` on
  vakio eikä vaihtele.
- **Aikajanan valinta kulkee `_tlValitseIdx`:n kautta** (tikin ja
  päiväkiskon napautus, näppäimistö, kelihyppy, spottikortin kaavio).
  Älä kirjoita kuudetta polkua. Tikin klikkaus oli pehmeä `scrollTo`,
  joka kävi scroll-käsittelijän kautta jokaisen välitunnin läpi ja sai
  kartan vilkkumaan — nyt se liukuu `_tlLiuuta`lla (ks. "LIUKU").
- **HYPPY HÄIVYTETÄÄN (`Haivytys`, 0,45 s), RAAHAUS JA PLAY EIVÄT.**
  `_tlValitseIdx` pyytää häivytyksen; lämpökartta sekoittaa vanhan ja
  uuden hilan NOPEUDEN varjostimessa (tekstuurit vaihdetaan, ei
  kopioida), partikkelit nopeuden ja suunnan erikseen. Kapseli ei
  sekoita. Hinta vain häivytyksen ruuduissa (docs/lampokartta.md,
  "Hyppy häivytetään").
- **OHJATTU TUNTINAUHA EI SNÄPPÄÄ (`#tl-scroll.ohjattu`) JA LIIKKUU
  ALIPIKSELIN TARKKUUDELLA** (käyttäjän pyyntö 30.9.: "liikkuu
  seuraavaan tuntiin pehmeämmin"). Toisto, liuku ja kiskon veto
  kirjoittavat nauhan sijainnin joka ruudussa murtolukuna, mutta
  `scroll-snap-type: x mandatory` veti jokaisen kirjoituksen
  lähimpään tikkiin: mitattuna (Chromium, puhelin) toiston 103
  ruudusta nauha liikkui 6:ssa, joka kerta tasan 18 px. Luokan kanssa
  65/83. WebKit pitää vierityksen KOKONAISINA pikseleinä (mitattu 0/14
  murto-osaa), joten `_tlNauhaTarkka` kirjoittaa kokonaisosan
  vieritykseksi ja loput `translate3d`-siirroksi. Luokka ja siirto
  poistuvat (`_tlNauhaVapaa`) vasta kun nauha on tikin kohdalla, joten
  snäppäyksen paluu ei siirrä mitään (mitattu 0 px). **`.ohjattu` ON
  MYÖS PORTTI:** nauhan scroll- ja scrollend-kuuntelijat ohittavat
  tapahtumat sen aikana. `_tlBeginSelfScroll`in 300 ms:n lippu ei
  yksin riitä: hitaalla ruudulla (WebKit, kontti ~3 ruutua/s) liu'un
  myöhästynyt tapahtuma luettiin sormeksi ja valinnaksi tuli välitunti
  (klo 19 klo 12:n sijaan). Kosketus, rulla ja hiiri poistavat luokan
  ennen omaa elettään. Jos lisäät nauhaa ohjelmallisesti liikuttavan
  polun, käytä `_tlNaytaHetki`ä tai `_tlLiuuta`a, älä omaa kirjoitusta.
- **LIIKKUVA VALINTA KULKEE `_tlSeuraaHetkea`:N KAUTTA.** Sormi
  tuntinauhalla, sormi päiväkiskolla ja play liikuttavat valintaa ILMAN
  vahvistushetkeä, ja kaikki tuntiin sidottu (aikakupla, päiväkorostus,
  sadekerros, spottimerkit, spottikortti, `currentHourIdx`) on
  päivitettävä matkan varrella. Tämä oli ennen kirjoitettu vain
  `_playSijainti`in, ja siksi raahatessa liikkuivat vain kartta,
  partikkelit ja kupla — mitattuna kapseli ja `currentHourIdx` eivät
  muuttuneet pikseliäkään ennen kuin sormi nousi. Myös `_tlValitseIdx`
  ja `_tlCommitSelection` kutsuvat sitä, joten `changed` on raahauksen
  jälkeen epätosi: silloin jäljellä on VAIN karkean esikatselun
  korvaaminen täydellä kentällä. Vartija lukee sekä `currentHourIdx`:n
  että `_tlLastTick`in — `updateTimelineToCenter` siirtää edellistä
  koskematta jälkimmäiseen.
- **KAPSELI SEURAA SORMEA `_previewField`istä, EI TIKIN VAIHDOSTA.**
  `buildWindField` ohittaa `Crosshair`in ja `WeatherWidget`in
  `scrub`-lipulla, joten päivitys on siinä kohdassa jossa karkea kenttä
  juuri valmistui — kapseli lukee sitä kenttää. Tikin kohdalla luku
  olisi vielä edellisestä kentästä. Play käyttää samaa `_previewField`iä
  (`State._esikatsele`), joten sillä ei ole enää omaa kutsuparia.
- **PÄIVÄKISKO ON RAAHATTAVA VALITSIN, EI NAPPIRIVI.** Kiskon vieritys
  valitsee osoittimen alla olevan HETKEN jatkuvasti (`_tlKiskoNyt` →
  pyöristetty tunti), myös sormen ollessa kiinni, ja vie tuntinauhan
  samaan hetkeen (`.ohjattu`, alipikseli) — sama sopimus kuin
  tuntinauhalla, jonka kanssa se on päällekkäin. Kolme asiaa pitävät
  sen erossa itsestään: kiskon oma `scrollLeft`-kirjoitus tunnistetaan
  sijainnista (`_tlKiskoKirjoitettu`) eikä `_tlRakennaPaivat`in
  tyhjennys siis valitse akselin ensimmäistä päivää; `_tlKiskoKeskita`
  vaikenee koko eleen ajan (`_tlKiskoVierii` kattaa myös heiton, ei
  vain sormen); ja raahauksen perään tuleva click ohitetaan MATKAN
  perusteella (`_tlKiskoAlkuScroll`, 6 px), muuten kisko hyppäisi vielä
  kerran sormen alla olleeseen lappuun. Kenttä päivitetään eleen aikana
  KARKEANA, ja eleen päätteeksi (`_kiskoLoppu`) lähin tunti vahvistetaan
  täydellä kentällä (`_tlVahvista`) ja molemmat nauhat liukuvat sen
  kohdalle — akselin päiden yli vedetty kisko palaa akselin päähän.
  **HIIRELLÄ KISKOA VEDETÄÄN KUTEN SORMELLA** (`_kiskoHiiri`, käyttäjän
  pyyntö 1.10.): veto kirjoittaa `scrollLeft`in suoraan (EI
  `_tlKiskoAsetaScroll`illa, joka merkitsisi sen omaksi), ja kaikki
  muu on sormen polkua. Kursori `grab` myös lapun päällä, kuten
  tuntinauhalla; 4 px:n kynnys, vedon perään tuleva click nielaistaan.
  Jos kisko rakennetaan uudelleen kesken vedon (akseli vaihtuu), veto
  ankkuroidaan uudelleen (`v.sisa`) — ilman sitä kisko heitti 26 h.
  Scroll-kuristus (16 ms) ajaa perään vielä kerran
  (`_kiskoPerassa`): pudotettu viimeinen tapahtuma jätti tuntinauhan
  vedon ajaksi 0,17 h kiskon jälkeen.
- **PÄIVÄN NAPAUTUS VIE KLO 12:EEN, "TÄNÄÄN" NYKYHETKEEN**
  (`_tlPaivanIdx`, käyttäjän päätös 1.10.). Lapun keskikohta on klo 12,
  joten napautettu päivä asettuu pilleriin keskelle; vajaalla
  reunapäivällä otetaan päivän lähin tunti. Ennen napautus säilytti
  kellonajan ("onko lauantaina yhtä kova kuin tänään viideltä") — se
  vertailu tehdään nyt vetämällä kiskoa. Tämän päivän lappu on poikkeus,
  koska se on paluu nykyhetkeen (sama kuin Home): klo 12:een se veisi
  iltapäivällä menneeseen hetkeen — ja siksi se SANOO "Nyt"/"Now" eikä
  "Tänään" (käyttäjän päätös 2.10.). **NAPAUTUS PÄÄTTÄÄ KISKON ELEEN, JA
  LIUKU OMISTAA NAUHAT:** napautuksen pointerdown merkitsee sormen
  kiskolle ja nosto ajastaa `_kiskoLoppu`n 140 ms:n päähän — se laukesi
  kesken napautuksen liu'un, luki kiskolta välihetken ja vahvisti sen
  (käyttäjän raportti: "menee vain vähän eteenpäin"; mitattu idx 49
  kun kohde oli 96). Siksi click nollaa kiskon eleen liput ja ajastimet,
  ja `_kiskoLoppu` ei vahvista mitään liu'un aikana (`State._tlLiuku`).
  Mittari napauttaa OIKEALLA kosketuksella ja värisevästi —
  `_tlValitseIdx`:n suora kutsu ei paljastanut tätä.
- **Päiväkiskon napautus ei saa käyttää `scrollTimelineTo`a.** Kupla ja
  päiväkorostus päivittyivät VIERITYKSEN mukaan, joten pehmeä animaatio
  käveli jokaisen välipäivän läpi (mitattu 15 välitilaa ja 1001 ms
  ennen kuin oikea päivä jäi voimaan). Napautus kulkee `_tlValitseIdx`
  → `_tlLiuuta`, jossa valinta on kohteessa heti ja vain näyttö liukuu.
- **VARASTON AKSELIN LOPPU TULEE KAUIMMAS YLTÄVÄSTÄ AJOSTA, EI
  TUOREIMMASTA.** ECMWF:n 00Z ja 12Z ulottuvat 15 vuorokauteen mutta
  06Z ja 18Z vain kuuteen, joten `ajot[0]` lyhensi aikajanan 15
  vuorokaudesta kuuteen KAHDELLA AJOLLA NELJÄSTÄ (mitattu samana
  päivänä: 99 askelta klo 13:36, 61 klo 18:04). Se ei maksa mitään,
  koska jokaiselle hetkelle valitaan joka tapauksessa tuorein ajo joka
  sen kattaa.
- **Laattavaraston akseli on 3 h (ja 6 h yli 7,5 vrk).**
  `wxTunneittain()` interpoloi siitä tuntiakselin — se ei ole uutta
  dataa vaan täsmälleen se mitä `asetaHetki`+`naytteista` jo antaa
  kartalle (mitattu ero 0 m/s). Akseli rakennetaan KERRAN ja jaetaan;
  pistekohtainen mitätöisi `_ts()`:n muistin.

**Kaaviot ja laaja näkymä**

- **KAIKKI AIKASARJAKAAVIOT OVAT YKSI MOOTTORI** (V8,
  docs/spottikortti.md): `Tuulikaavio.piirra` piirtää, `Aikakaavio`
  omistaa vieritettävän kääreen, kiinteän y-akselin (`.ak-kehys`,
  `_akseli`), osoittimen ja lukemarivin (`.en-lukema`). Tuuliennuste,
  tuulihavainto (`_renderLiveHistory`), vedenlämpö
  (`_uirasChartInteractive`) ja aallot (`_aaltoKaavio`) ovat sen
  asiakkaita, kortilla ja laajassa. Mikä eroaa, on parametreissa
  (`laji`, `ikkunaLuvut`, `loppuPiste`, `y`, `vari`, asu). Älä kirjoita
  viidettä piirtofunktiota äläkä palauta kelluvaa HTML-työkaluvihjettä
  (kupla pallon vieressä on SVG:n sisällä, ks. "LUKEMA PALLON
  VIERESSÄ").
- **KAAVION GEOMETRIA (30.9., käyttäjän pyyntö): YLHÄÄLLÄ LÄHDE JA
  TUULEN SUUNTA, ALLA AIKA-AKSELI.** Ylhäältä alas: lähderivi
  (`lahdeH`; teksti on tarttuva HTML-rivi `.ak-lahteet`, V16),
  nuolirivi (`nuoliH`, tuulen suunta), plotti (`y0`…
  `pohja`), tuntirivi (kellonaika, `tuntiY = pohja`), päiväotsikko
  (HTML `.ak-paivat`, `top = g.paivaY`), sade ja lämpö. Kellonaika ja
  päivämäärä ovat siis SUORAAN GRAAFIN ALLA ja nuolet sen yläpuolella;
  ennen tuntirivi oli nuolten ja lähteen välissä ylhäällä. Kuvion
  y-koordinaatit tulevat `g`:stä (`ylaY`, `tuntiY`, `paivaY`, `paivaH`)
  — älä kirjoita niitä lukuina.
- **PÄÄVIIVA ON OHUT: 1,7 px kortilla, 1,3 px kun tunti < 3 px**
  (`juovaW`; oli 2,4 / 1,8). Paksu musta viiva peitti alleen mallien
  viivat ja värjäyksen; paksuutta ei saa palauttaa vaan korostus tulee
  pallosta, huippulapuista ja täytöstä. Testi vaatii ≤ 1,8 px.
- **PITO-MERKKI SIIVOTAAN KUN SELAIN VIE ELEEN VIERITYKSENÄ.** Sormi
  paikallaan pidon yli sytytti kursorin ja pallon, ja jos `touchmove`
  ei sitten tullut peruttavana (`!e.cancelable`) tai vieritys alkoi
  ennen pitoaikaa, merkki jäi alkupisteeseen ja vieri kaavion mukana:
  "aloituskohtaan jää pystyviiva". `peruMerkki` kutsutaan (1)
  touchmovessa kun ele on vieritys, (2) kääreen `scroll`-tapahtumassa
  kun tila on `paina`/`pito` ja `scrollLeft` on siirtynyt yli 3 px
  (turvaverkko: selain vei eleen eikä `touchmove` kertonut), ja (3)
  `lopeta`ssa kun pitoa ei vahvistettu. Testi simuloi tämän pito +
  `scrollLeft`-kirjoituksella.
- **JAKSOVALITSIMIA EI OLE.** Koko sarja on piirretty ja sitä
  vieritetään sormella; ruudulle mahtuu ennusteessa 48 h, havainnossa
  24 h, aalloissa 48 h ja vedenlämmössä 7 vrk (laajassa 72 h / 48 h /
  72 h / 14 vrk). Käyttäjän päätös: "ei tarvitse olla valintaa siitä
  miten pitkä data näkyy kun graafia pystyy rullaamaan". Havainnon
  tilastot ovat viimeisen 24 h:n, ja jakso sanotaan KERRAN ryhmän
  otsikossa ("Viimeiset 24 h").
- **KÄYRÄ ON MONOTONINEN KUUTIO, HAVAINTO MURTOVIIVA** (V1,
  `Tuulikaavio._polut(pts, tyyli)`). Entinen vaakatangenttibezier teki
  jokaiseen tuntipisteeseen tasanteen (RMS 0,59–0,74 px datan omasta
  murtoviivasta vs 0,23–0,26 px). Fritsch–Butland-tangentit: ei ylitä
  naapuriensa väliä eikä tee tasanteita; ennuste, vertailumallit,
  vedenlämpö ja aallot käyttävät sitä, ja `_havPiirros` antaa
  `kayra: 'suora'` — mitattu 1–10 min keskiarvo on data, ja sen vaihtelu
  on se mitä kaavio näyttää. **MALLIN OMAT PISTEET** piirretään kun
  pisteiden väli ruudulla on ≥ 9·fs px (`o.pisteet !== false`): ennusteella
  vain lähteen oman solmun tunnit (`_natiivi`: FMI, MET Nordic ja
  Open-Meteo tunneittain; ECMWF ~+84 h asti tunneittain, sitten 3 h ja
  +138 h:sta 6 h, rajat nyt-hetkestä eivät ajon alusta — tunnin–kahden
  virhe raja-alueella), havainnolla jokainen nippu. Pääviivan paksuus
  1,8 px kun tunti on < 3 px (2,4 muuten).
- **PÄIVÄOTSIKKO ON HTML-RIVI JA TARTTUVA** (V4, `.ak-paivat` ja
  `.ak-pv > span { position: sticky }`), ei SVG-teksti päivän keskellä:
  keskitetty teksti katosi kun päivän keskikohta vieri ulos, ja 12 h:n
  zoomilla 43,2 % vierityskohdista ei näyttänyt yhtään päivämäärää;
  nyt 0 %. Ei vierityskuuntelijaa, selain hoitaa. Laatikko sävytetään
  lauantaina ja sunnuntaina (`.ak-pv-vk`; vain otsikkorivillä —
  piirtoalueella sävy tarkoittaa yötä). Muotoportaikko päivän leveyden
  mukaan: "**Sunnuntai** 27.9." → "Su 27.9." → "27.9." → "Su 27" →
  "S 27" → "S" (viikonpäivä lihava, päiväys himmeämpi); tänään sanoo
  "Tänään"/"Today" KERMAPILLERISSÄ. **Päiväotsikko on oma kaistansa**
  (`paivaH` 22, laajassa 25, heikko pohja, kirjasin 13·fs — kortin
  tekstikoko, V16) ja päiväraja jatkuu sen läpi
  (2.10., "selkeämpi päiväys"). Rivi piiloutuu venytyksen ajaksi (`.venyy`), koska
  SVG:tä venytetään transformilla eikä sticky venyisi mukana.
  **TUNTITIKIT**: jokainen tunti jolla ei ole lukua saa tikin (≥ 4 px
  välein, muuten 3/6/12 h); loitonnettuna (`askelH` ≥ 24) tuntirivillä
  on vain tikit (6 h, keskipäivä pidempi) ja maanantain päivämäärä —
  ennen 240 h:n ja 396 h:n zoomilla ei ollut tuntitietoa lainkaan.
  Viikon vaihde (maanantain päiväraja) on vahvempi tiheässä rytmissä.
- **LOITONNETTUNA LUVUT OVAT HUIPPUJA, EI KESKIPÄIVÄN ARVOJA** (V6):
  paikalliset huiput prominenssin mukaan (≥ 15 % asteikosta,
  `askelH` ≥ 24 vähän lievemmin), ahneesti tärkein ensin ja
  törmäyksenesto muihin lukuihin ja NYT-lappuun; laaksoille ei lappua.
  Kaavion `aria-label` on data-yhteenveto (`_yhteenveto`: kovin tuuli
  ja aika, foilattavien tuntien määrä, seuraava vähintään kolmen peräkkäisen tunnin ikkuna), ja
  kortin tuulisolu kertoo ilmansuunnan sanalla (nuolen perässä).
- **VAAKAVETO ON VIERITYSTÄ, PITO + VETO LUKEE, TUNTI VALITAAN
  NAPAUTUKSELLA TAI SKRUBIN NOSTOLLA** (docs/graafit.md, V2–V3).
  Kaavioissa on `touch-action: pan-x pan-y`; napautus (matka < 6 px,
  myös värisevä) valitsee, ja nuolet vaihtavat tuntia fokuksessa.
  **Vaakaveto ilman pitoa on yhä natiivia vieritystä** (käyttäjän
  27.9. valinta), ja hiirellä veto vierittää (`cursor: grab`, 4 px:n
  jälkeen; ennen se ei vierittänyt lainkaan: veto 180 px = 0 px).
  **Kosketuksella pito ja liu'utus lukee** (`Aikakaavio.osoitin`):
  sormi paikallaan ~200 ms — tai kosketus alkaa ≤ 28 px:n päästä
  valitun tunnin kursorista — ja sitten veto = lukemarivi ja kursori
  seuraavat sormea, nosto valitsee (`Ennuste.valitse`, kerran;
  havainnossa lukema jää riville 4 s). **PITO PÄÄTETÄÄN TAPAHTUMIEN
  AIKALEIMOISTA, EI AJASTIMESTA**: pito = ensimmäinen yli 8 px:n liike
  on vähintään 200 ms `touchstart`in jälkeen. Ajastin saa vain näyttää
  merkin sormen ollessa paikallaan; kun pääsäie oli varattu, ajastin
  luokitteli tavallisen vedon pidoksi (mitattu). `touchmove.
  preventDefault()` vasta pidon jälkeen ja vain jos `cancelable`
  (muuten selain ehti aloittaa vierityksen ja saa jatkaa); ennen sitä
  natiivi vieritys ja pohjalevyn pystyvieritys säilyvät. Kosketus-
  tapahtumat, ei osoitintapahtumat (`pan-x pan-y` peruu osoittimet), ja
  EI `requestAnimationFrame`a: reunavieritys (sormi < 40 px kääreen
  reunasta) ajetaan `setInterval(16)`llä. Vasen 16 px ei aloita pitoa
  (iOS:n takaisinpyyhkäisy), toinen sormi lopettaa skrubin (venytys
  omistaa eleen), ja skrubin aikana `_akSkrubi` estää asteikon
  sovituksen. **Kursorin tartunta on siksi tahallinen:** testi joka
  aloittaa "tavallisen vedon" valitun tunnin kursorin vierestä saa
  skrubin — aloita veto kauempaa (tools/graafimittaus.mjs tekee niin).
  **Myös laajassa**: laajan napautus kulkee samaa `Ennuste.valitse`-
  polkua, ja `asetaValittu` siirtää kursorin kortissa JA laajassa
  (`ctx.laajaKaare`). Ennen laajalla ei ollut `napautus`ta, ja
  kursori jäi avaushetken tuntiin (V10).
- **HIIRILAITTEELLA ON TYÖKALURIVI (`Aikakaavio._tyokalut`)**: zoom-
  napit (−, +; portaittain, `_akZoomaa` = venytyksen loppu keskipisteenä)
  ja navigaattori (koko sarjan miniatyyri, raahattava ikkuna) —
  vain `(any-hover: hover) and (any-pointer: fine)`, ei laajassa (laatikon
  korkeus lasketaan kaaviolle; laajan otsikossa on omat zoom-napit
  `#hl-zoom`). Näppäimet kääreessä: ← → tunti (Shift 3 h), PgUp/PgDn
  ±24 h (tai leveys ilman valintaa), Home = nyt, End = loppu, + / −
  zoom; kaikki `stopPropagation` (nuolet kuuluvat muuten kartalle).
- **KAKSI SORMEA VENYTTÄÄ, ELEEN AIKANA VAIN TRANSFORM**
  (`Aikakaavio.venytys`, kaikki neljä kaaviota kortilla ja laajassa;
  työpöydällä Ctrl+rulla). Tiheys on `Aikakaavio.nakyva(avain)`,
  näkyviä tunteja, istunnon ajan eikä tallenneta. Kaavio piirretään
  uudelleen vasta sormien noustessa: kesken eleen korvattu SVG irrottaisi
  kosketuksen kohteen. Kosketus- eikä osoitintapahtumat, koska
  `pan-x pan-y` peruu osoittimet. Kahden sormen ele ei ole napautus.
  Y-asteikko ei saa riippua tiheydestä: vedenlämmön asteikko laskettiin
  nipuista, ja se olisi elänyt sormien mukana.
- **LEIJUVA OSOITIN VAIN `(any-hover: hover)`-LAITTEELLA.** WebKit
  lähetti laajan ilmestyessä hiiren `pointermove`n emuloidun osoittimen
  kohtaan, ja laajaan syttyi viiva jota kukaan ei osoittanut.
  Osoittimen kohdalla tuntirivillä on PILLERI ("To 14", `data-tk-pill`
  hover-ryhmässä): SVG:n sisällä samaa perhettä kuin NYT-lappu, ei
  kelluva HTML-laatikko; lukeman kupla pallon vieressä on SVG:n
  sisällä (ks. "LUKEMA PALLON VIERESSÄ").
- **TUNNIN VAIHTO EI RAKENNA SPOTTIKORTTIA UUDELLEEN** (`openSheet`:n
  päivityspolku, `_oliAuki`): vain `#sh-laatat-tunti` kirjoitetaan
  (`Laatat.html`), aaltokaavio siirtää kursorinsa ja lukemarivinsä
  (`kaare._aaltoValitse`), ja ennusteosio saa `asetaValittu`n, joka siirtää kursoria
  CSS-transformilla (`.tk-valittu`, 0,22 s) ja piirtää heron
  (`Ennuste._naytaHero` → `Hero.nayta`). Hero piirretään AVAIMELLA
  (`Hero.avain`: spotti, hetki, osoitus, pohja, sarjojen identiteetti,
  yksiköt): sama avain = ei kirjoitusta eikä asettelun lukua, joten
  kortin rakennuksen perään tuleva `kiinnita` ei piirrä sitä toiseen
  kertaan. Mitattu: osio ja SVG ovat sama elementti napautusten yli,
  päivitys 7 ms vs täysi rakennus 17–18 ms. Jos lisäät korttiin tuntiin
  sidotun osan, lisää se päivityspolkuun — muuten se jää edelliseen
  tuntiin.
- **SPOTTIKORTTI ON MODUULEJA, JÄRJESTYKSESSÄ NYT → TUNNEITTAIN →
  YKSITYISKOHDAT** (V9, Applen Sään rakenne; V15): hero
  (`.sh-moduli`), tuuliennuste, valitun tunnin laatat (`.sh-laatat`),
  aallot (ennuste valitulle tunnille ja poiju nyt), tuulihavainto ja
  UiRas-spotilla vedenlämpö — kukin oman `.sh-ryhma`-nimensä alla.
  "Havainnot nyt" -laatat (tuuli, ilma, vesi, poiju), "Aallot ·
  ennuste" -laatta ja Spotti-moduuli (`#sh-tiedot`: indeksin erittely,
  suunnat, lähde) POISTETTIIN kahdennuksina (P15): havainnon luvut ovat
  kaavioiden lukemariveillä, indeksin erittely ja suunnat ⓘ-selitteessä
  ja lähde kaavion lähdekaistassa. Älä palauta niitä. Havaintoasemakortti
  käyttää samoja osia. Päätös sanotaan kerran: foil-merkin vieressä on
  vain se mitä se ei kerro (`Hero._huomio`, suunta; ennen
  `spotIndexHuomio`) — nopeuteen perustuva selite oli ristiriidassa
  merkin kanssa ("Rajatuuli – kokeile" / "Liian heikko").
- **JOKAISEN MODUULIN PAIKKA ON VARATTU ENSIMMÄISESTÄ MAALAUKSESTA**
  (V15, docs/spottikortti.md 8.10). Myöhään tuleva data täyttää
  LUURANGON, jolla on lopullinen rakenne ja korkeus: `_havLuuranko`
  (tuulihavainto), `_uwLuuranko` (vedenlämpö), `_aaltoLuuranko`
  (aallot) — työkalurivi (`.hav-tyokalut` 32 px), tyhjä lukemarivi,
  kaavion korkuinen paikanpitäjä (`Tuulikaavio.korkeus`, `min-height: 0`
  koska `.en-paikka` on muuten 230 px), selite yhdellä rivillä ja
  havainnon tilastot aina kahden rivin ruudukkona ("–" ilman dataa).
  Lataus, aseman vaihto ja virhe näkyvät SAMASSA luurangossa (syy
  kaavion paikalla), eikä moduuli kutistu "Ladataan…"-riviksi.
  Hiirilaitteella kaavion työkalurivin paikka on varattu
  (`Aikakaavio.tyokalutPaikka`, ja valmis rivi pitää paikkansa
  `visibility`llä myös kun sarja mahtuu ruudulle). Aaltomoduulin kate
  muistetaan ensimmäisestä hausta (`AaltoKate`, `fs_aaltokate`):
  maamaskissa olevalle spotille kaaviota ei varata, ja tuntematon
  spotti saa paikan. Mitattu avauksessa 10 s: 0 siirtymää puhelimella
  ja työpöydällä (ennen 22–24, suurin 985 px). Uusi myöhään tuleva osa
  tarvitsee luurangon samalla korkeudella — mittaa se
  `tools/korttimittaus.mjs --osat=avaus`.
- **VALITUN TUNNIN LAATAT OVAT KIINTEÄ 2 × 2 -RUUDUKKO** (P14, `Laatat`):
  ilma, puku, vedenkorkeus ja aurinko, ryhmän nimi "Valitulla tunnilla"
  ilman kellonaikaa (hero tai yläpalkki kertoo hetken). Laatta on aina
  sama: nimi, arvo yhdellä rivillä (30 px; 22 px:n kirjasin leikkautui
  27 px:n rivissä) ja kahden rivin alalaatikko; laatat ovat YKSI pinta
  (`.sh-laatat`) ja solut erottaa hiusviiva (V16);
  teksti joka ei mahdu vaihtuu lyhyempään (`_mahdutaMuodot`, arvon
  viimeinen muoto pienemmällä kirjasimella `.sh-arvo-pieni`). Tunnilta
  puuttuva arvo on "—" ja syy ("ei ennustetta tälle tunnille"); laattaa
  ei jätetä pois — "viiva olisi lupaus datasta jota ei ole" koskee
  spottia, ei yksittäistä tuntia. Ilman laatta lukee spotin oman sarjan
  rivin AJASTA (`Laatat._rivi`, ±30 min) eikä sarjan päähän rajattua
  indeksiä. Puku käyttää samaa tuulta kuin hero ja UiRas-spotilla samaa
  vedenlämpöä kuin vedenlämpökaavio (`Laatat.paivitaPuku`); muilla
  spoteilla vedenlämpö on puvun alarivillä, koska kortilla ei ole muuta
  paikkaa sille. Mareografin havainto on vedenkorkeuden alarivillä
  nimettynä ("nyt +6 cm · Kaivopuisto"). Mitattu 127 tunnin yli: 1
  korkeus kaikilla leveyksillä (ennen 6–12).
- **HERO ON KORTIN TUULIENNUSTEEN LUKEMA** (P10 ja P13, käyttäjän päätös
  3.10., docs/spottikortti.md 8.10 V14; `Hero`). Levossa se näyttää
  valitun tunnin ja kaaviota osoitettaessa (hiiri, pito + liu'utus)
  osoitetun: samat paikat, vain tekstit vaihtuvat ja pohja tummuu
  (`.osoitettu`). Kortin ennusteella EI OLE omaa lukemariviä — se
  toisti heron luvut 60 px:n päässä; älä palauta sitä. Luvut tulevat
  KAAVION ennusteesta (`Hero.lukema`: pohja → Paras → `spot.wx`): kun
  kaavioon on valittu malli, heron luku, indeksi ja päätös ovat sen
  mallin, ja aikarivi nimeää sen ("· ICON"); Paras-tilassa hero =
  aikajana = spottimerkki kuten ennenkin. Ennen kortilla oli samalle
  tunnille kaksi lukua (hero Paras 6,9 kts, rivi ICON 9,2 kts).
  **JOKAINEN HERON RIVI ON YKSI RIVI** (`nowrap`): pitkä muoto ensin, ja
  jos se ei mahdu, lyhyempi (`data-mahdu` + `Hero._muodot`,
  `_mahduta` kerran kirjoituksen jälkeen) — ei rivity eikä katkea
  kolmeen pisteeseen. Puuskarivi on aina olemassa ("Puuska –"), ja
  hajontarivi varaa korkeutensa myös tyhjänä. "Hyvin puuskainen" on
  päätösrivin varoitus (`.sh-varo`, `--varoitus`), ei puuskarivin sana.
  Lähde ja ajo EIVÄT ole herossa: ne ovat kaavion lähdekaistassa
  (`Lahde.ajoTeksti`). Mitattu 127 tunnin yli: hero 180,5 px joka
  leveydellä 320–430 px molemmilla kielillä (ennen 375 px:llä neljä
  korkeutta 180–200 px ja 44 muutosta). **Kun hero on vierinyt pois**,
  yläpalkissa on tiivis lukema (`Tiivis`, `[data-tiivis-lukema]`,
  `IntersectionObserver` juurena `#sheet-scroll`, raja 45 %), samoista
  muodoista lyhyempään kuten heron rivit; ruudunlukijalle piilossa.
- **ENNUSTEOSIO ON KIINTEÄN KORKUINEN** (V14): ryhmän nimi
  "Tuuliennuste" on kortin ulkopuolella (`.sh-ryhma`), osion yläreunassa
  YKSI rivi (`.en-yla`: valikko, Nyt ja laajennus; Nyt-napin paikka on
  varattu piilossakin), sadekaista on kortilla AINA (`sadeAina`,
  kuivalla jaksolla pohjaviiva), paikanpitäjä ja "ei saatu" ovat kaavion
  korkuisia (`Tuulikaavio.korkeus`), ennusteen vaihdossa edellinen kaavio
  jää himmennettynä paikalleen ("Ladataan ICON…", `.lataa`) kunnes uusi
  on valmis, ja pito-vihje kelluu kaavion päällä (`.ak-vihje`). Mitattu:
  316 px joka tunnilla ja jokaisessa ennusteen vaihdossa latauksineen
  (ennen 418–448 px sadekaistan ja latauksen mukaan). Jos lisäät osioon
  jotain, varaa sen paikka myös silloin kun sitä ei näytetä.
- **NYKYHETKI: NYT-LAPPU, KATKOVIIVA, MENNEISYYS HARSOLLA JA NYT-NAPPI.**
  Nappi näkyy vain kun valinta tai näkymä on muualla, ja se vie
  `Ennuste.nytTunti()`in — sama pyöristys kuin aikajanan `nowIdx`
  (kahta "nyt"-sääntöä ei saa olla). Lappu piirretään kursorin PÄÄLLE.
- **TUULEN Y-ASTEIKKO LASKETAAN NÄKYVÄSTÄ IKKUNASTA** (docs/graafit.md,
  V5; `Aikakaavio.skaala`, `_sovita`): ikkuna ± 25 % marginaali,
  alaraja 8 m/s ja "nätti" yläraja NÄYTTÖYKSIKÖSSÄ (`Tuulikaavio._yla`:
  m/s 2, kts 5, km/h 10, boforilla seuraava kynnys) — data pysyy m/s:nä.
  Ennen asteikko oli koko sarjan (nyt −6 h → loppu) mukaan, ja tyyneen
  jaksoon sarjan myrsky jätti käyrän alaosaan (mitattu oikealla
  spotilla: lähiajan 5,5 m/s täytti 21 % korkeudesta, nyt 53 %). **UUSI
  PIIRTO VASTA KUN ELE ON LOPPUNUT** (`scrollend`, varalla 160 ms:n
  ajastin) ja vain jos ikkunan huippu ylittää ylälaidan (leikkautuisi)
  tai jää alle 80 %:n siitä; skrubin ja venytyksen aikana ei koskaan
  (liikkuva akseli sormen alla lukee huteralta). Kaavio kertoo
  ikkunansa `ikkunaNyt`stä (ei tallennettua tilaa, joka vanhenisi) ja
  ensimmäisellä piirrolla `ikkunaArvio`sta (`aseta`n vierityksen paikka),
  jottei kortti vilku avautuessaan. Väri on nopeuden funktio, joten
  vertailukelpoisuus säilyy asteikon vaihtuessa. Havainnon asteikkoon ei
  oteta ennusteen puuskaa. Vain tuulikaaviot: vedenlämpö ja aallot
  käyttävät omaa datapohjaista asteikkoaan.
- **Y-AKSELI ON KIINTEÄ JA KAAVIO VIERII SEN ALTA** (`.ak-akseli`,
  paperiliuku `--ak-tausta`). SVG:hen piirrettyinä vieritetyn kaavion
  reunaluvut leikkautuivat puoliksi.
- **KAAVION TEKSTI NÄKYY VAIN KOKONAISENA** (V16, P16,
  `Aikakaavio._reunatPaivita`, `.ak-reuna`): luku, tunti, NYT-lappu
  (`data-tk-reuna`), päiväotsikko ja lähdekaista häivytetään (0,12 s)
  kun ne ovat osittain akselin alla tai oikean reunan yli — mitattuna
  ennen 11 levossa ja 15 vieritettynä 390 px:llä, nyt 0 viidellä
  laitteella. SVG-tekstien x-väli mitataan kerran piirtoa kohti
  ensimmäisellä päivityksellä (EI `aseta`ssa, se pakottaisi kortin
  asettelun), tarttuvien paikka lasketaan laatikosta ja vierityksestä;
  kuristus on aikaleima 16 ms + perään ajo, EI rAF (WebKit). Tuntirivin
  pilleri piilottaa alleen jäävän tuntiluvun (`data-tk-tunti`,
  `.ak-pilleri-alla`) ja rajataan NÄKYVÄÄN ikkunaan kuten kupla (SVG:n
  reunoihin rajattuna se jäi laajassa akselin alle). Uusi teksti kaavioon on automaattisesti mukana
  (kaikki `<text>` paitsi hover-ryhmä); HTML-rivi lisätään
  `_reunatMittaa`n listaan.
- **KORTIN KAAVIO ON KEVENNETTY** (P16, V16): kortilla ei puuskan
  lukuja (`ASUT.kortti.puuskaLuvut: false` — puuska on vyöhykkeenä ja
  herossa lukuna, luvut laajassa) ja nuolet vähintään 3 h välein
  lukujen rytmissä (`nuoliMin`, 24 → 16 / 48 h); umpi/ontto-ero säilyy.
  Sadekaistan nimi on "mm" KERRAN kiinteällä akselilla kuten "kts"
  (`.ak-sade`, `g.sadeY`), ei "sade mm/h" joka keskiyönä. Havainto
  pitää puuskalukunsa (ks. "Jakson kovin puuska saa aina lapun").
- **Y-AKSELILLA ON YKSIKKÖ, VÄHINTÄÄN KAKSI LUKUA JA FOILAUSRAJAN OMA
  LUKU** (V5). Yksikkö (`.ak-yks`, `g.yks`) oli ennen vain lukemarivin
  `<small>`issa; pienessä kaaviossa (rivi, laaja puhelimen vaakatilassa)
  oli yksi luku, koska 10 kts:n väli oli 21,9 px ja raja 22 px. Nyt
  "vähintään kaksi viivaa kun ne mahtuvat ≥ 18 px:n välein". Foilausrajan
  (`Keli.AJETTAVA`) luku ja viiva ovat `--kaavio-foil` (`#D8B964`,
  `Teema.foil`), ja sen 11·fs px:n sisällä oleva ruudukon luku jää pois —
  viiva jää. Boforilla ylälaita on kynnys ja foil-luku bofori.
- **KIRJASINLATTIA: 11 px HTML:ssä, 10,5 px SVG:ssä** (V9-lohko CSS:n
  lopussa, `max(Npx, var(--fs-x))` jotta työpöydän tokenit säilyvät).
  Ennen 22 tekstiluokkaa alle 11 px:n, pienimmät 8 px. Uusi teksti
  korttiin tai kaavioon ei saa alittaa lattiaa.
- **KORTIN TYPOGRAFIA ON KUUSI KOKOA JA KOLME MUSTETTA** (V16, lohko
  "KORTIN TYPOGRAFIA" CSS:n lopussa, docs/spottikortti.md 8.10): 11
  (akselin luvut ja yksiköt, solujen, laattojen ja tilastojen nimet,
  yksikkö luvun perässä, lähde — `--ink-3`; ryhmän nimi puolilihava
  versaali), 13 (kuvaukset, alarivit, selitteet, päiväotsikko, heron
  rivit, valitsimet — `--ink-2`, nimi ja päätös lihavana `--ink`), 15
  (lukemarivin sivuluku, ennustevalikon nimi), 17 (aikasolu, tilastojen
  luvut), 22 (pääluku, laatan arvo, kortin otsikko) ja 38 (heron tuuli
  rampin värillä). Työpöydällä 11 → 12,5 ja 13 → 14 (`--ty-11`,
  `--ty-13`). `--accent` vain toiminnoissa (NYT, reittiohje),
  `--varoitus` vain varoituksissa; päätössirun sävy on sen pohjassa ja
  reunassa, teksti mustetta. Versaalit vain ryhmien nimissä. Mitattu
  ennen 29 tyyliä, 10 kokoa ja 8 väriä, nyt 13 / 6 / 6. Uusi teksti
  korttiin valitsee roolin eikä kirjoita omaa kokoa tai väriä.
- **LAAJA NÄKYMÄ ON KUORI, EI KAAVIO.** `HavLaaja` omistaa otsikon,
  lukemarivin, jaksonapit, liu'utuksen, käännön, turva-alueet ja
  `Modaali`-kytkennän; piirtäminen tulee LÄHTEELTÄ
  (`{ el, otsikko, sub, jaksot, piirra(kaavioEl, laatikko, laaja) }`).
  Neljä kaaviota käyttää sitä — tuuliennuste, tuulihavainto, vedenlämpö
  ja aallot. Älä kirjoita viidettä kokoruudun polkua. `jaksot` on nyt
  kaikilla `'[data-ei-jaksoja]'` (rivi piiloutuu).
- **LÄHDE RIPUSTETAAN LAAJENNUSNAPPIIN** (`nappi._havLaajaLahde`), ei
  päätellä napin sijainnista. Sekä napautus että kääntö lukevat sen
  samasta paikasta; päättely (`closest('.hav-kaavio')._havData`) olisi
  yksi haara kaaviotyyppiä kohti.
- **KÄÄNTÖ OTTAA ENSIMMÄISEN KYTKETYN NAPIN, EI ENSIMMÄISTÄ NAPPIA.**
  Kaavio kytkee itsensä korttinsa omassa `setTimeout`issa ja kääntö
  rakentaa kortin uudelleen juuri ennen tapahtumaa: mitattuna käännön
  hetkellä ensimmäisellä napilla oli `_havLaajaLahde === undefined` ja
  koko oikotie jäi laukeamatta, vaikka 1,2 s myöhemmin kaikki oli
  paikallaan. Yritys uusitaan 120 ms välein neljä kertaa.
- **SULKUNAPIN OIKEA REUNA TULEE NIMILOHKOSTA, EI JAKSOVALITSIMESTA.**
  `.hl-jaksot`in `margin-left: auto` teki napin paikasta riippuvan
  siitä ONKO jaksovalitsinta — ja kaaviolla jolla sitä ei ole (kortin
  tuulihavainto) X liukui kiinni nimeen. Työntö on
  `.hl-nimiryhma { flex: 1 1 auto; min-width: 0 }`, ja `min-width: 0`
  on pakollinen: ilman sitä pitkä asemanimi työntäisi napin ulos
  rivistä sen sijaan että katkeaisi kolmeen pisteeseen.
- **PIILOTETTU JAKSORIVI TYHJENNETÄÄN.** Sama näkymä avataan peräkkäin
  eri kaavioille, ja `display:none`-haarasta palaaminen ilman
  tyhjennystä jätti piiloon edellisen kaavion napit (mitattu kolme).
- **KAAVIOT OVAT 1:1 PIKSELEIHIN, MYÖS KORTILLA.** Kortin vanha
  ennustekaavio oli `preserveAspectRatio="none"` ja sen 300 yksikön
  viewBox venyi ~407 px:iin (teksti 36 % leveämpää kuin korkeaa). Uusi
  `Tuulikaavio` mitataan laatikostaan ja piirretään pikseleinä kortilla
  ja laajassa; luettavuus ostetaan kirjasinkoolla (`asu.fs`).
- **LAAJENNUS EI SAA KAVENTAA MITÄÄN, JA SE MITATAAN NÄKYVÄSTÄ
  PIIRTOALUEESTA.** Ulkomitta valehtelee aina kun kaavio vuotaa
  kääreensä yli — ensimmäinen mittari teki juuri tämän virheen ja
  vaati mahdotonta. Laajan piirtoalue tulee laatikon korkeudesta
  (`plotH`), ja kirjasin sen leveydestä (`laajaFs`).
- **Kaavio vuotaa moduulin täytteeseen reunasta reunaan** (`.ak-kehys`
  marginaali `−var(--moduli-tayte)`), ja moduulin `overflow: hidden`
  pyöristää kulmat.
- **TUULIENNUSTEKAAVION Y-AKSELI ON KÄYTTÄJÄN YKSIKÖSSÄ.** Akselille
  kirjoitettiin raaka m/s samaan aikaan kun jokainen lukema samassa
  kortissa on valitussa yksikössä: solmuissa huippurivi sanoi
  "20,7 kts", työkaluvihje "23,8 kts" ja akseli näytti kahtatoista.
  Data pysyy m/s:nä (kaikki laskenta on sitä), mutta TIKIT valitaan
  näyttöyksikössä ja sijoitetaan kertoimella takaisin m/s-akselille.
  **Boforille ei saa keksiä käänteismuunnosta** (sama sääntö kuin
  havaintokaavion gradientissa): sille tikit OVAT `Units._bft`-kynnykset,
  mikä on boforin luonnollinen akseli eikä kiertotie.
- **AKSELIN TIHEYS TULEE PIKSELEISTÄ, EI `maxV`:STÄ.** Askel on pienin
  tikkaista 1/2/5/10/20/50 joka antaa vähintään `asu.ruutuVali · fs` px
  välin (kortti 24, laaja 40, allekkainen rivi 22). Laaja sai
  ensimmäisellä kortin arvolla kahden solmun askeleen ja 19 viivaa —
  ruutupaperia, ei asteikkoa.
- **FOILAUSRAJA ON VAHVEMPI KUIN RUUDUKKO.** Kun ruudukko tiheni,
  6 m/s raja katosi sen sekaan: molemmat olivat samaa hiekkaa ja ero oli
  vain viivanleveys. Raja on sovelluksen oma päätöskynnys (foilBadge
  vaihtuu kuudessa), joten se on `--kaavio-foil` ja 1,5·LW, ja ruudukko
  on kermaa alfalla .11. Rajan kohdalta jätetään tavallinen ruudukkoviiva
  pois, jottei kaksi viivaa paksunna sitä.
- **KAAVION LUKEMA ON KIINTEÄLLÄ RIVILLÄ (`.en-lukema`, kaikissa
  neljässä kaaviossa) JA OSOITETTAESSA MYÖS KUPLASSA PALLON VIERESSÄ.**
  Rivi on ensisijainen: se näyttää levossa valitun tunnin (havainnossa
  tuoreimman lukeman) ja osoittaessa osoitetun; havainnon napautettu
  lukema palaa 4 s:n päästä. Laajassa sama tieto menee `laaja.rivi`in.
  **Kortin tuuliennusteessa kiinteä paikka on HERO, ei rivi** (V14, ks.
  "HERO ON KORTIN TUULIENNUSTEEN LUKEMA"); havainto-, vedenlämpö- ja
  aaltokaavion rivit ja laajan rivi jäävät.
  Lähdettä EI ole tuulisolussa (V13): se on kaavion lähdekaistassa, ja
  solun nimi on pelkkä "Tuuli" — "Tuuli · FMI HARMONIE 2,5 km" katkesi
  kolmeen pisteeseen.
  **RIVI EI RIVITY EIKÄ KASVA: YKSI RIVI, 54 px, KAIKISSA KAAVIOISSA**
  (2.10., käyttäjän pyyntö "ei missään tapauksessa kasva
  pituussuunnassa ja teksti näkyy"). Menneellä tunnilla rivi rivittyi
  ja kasvoi 48 → 83 px. Sivusolut eivät kutistu, pääsolu ottaa
  jäljelle jäävän tilan ja vain SEN nimi (lähde) katkeaa kolmeen
  pisteeseen; kapealla kortilla väli pienenee (`@container`; sen
  kirjasinkoot olivat kuollutta koodia ja poistettiin V16:ssa). Rivi on
  TEKSTIÄ MODUULIN PINNALLA (V16): ei täytettyä laatikkoa, ja
  osoittaessa korostuu aikasolu (`.osoitettu`/`.skrubaa .en-solu-aika`),
  ei koko rivi. Älä palauta `flex-wrap`iä äläkä `min-height`ia, ja
  mittaa uusi solu 320, 360 ja 390 px:n leveydellä molemmilla kielillä.
  **RIVIN RAKENNE (30.9., käyttäjän pyyntö "parannetaan lukemaruudut")**
  on `Aikakaavio.lukemaHtml(solut)`: solut ovat `{ nimi, arvo, ala,
  aika?, paa?, luku?, suunta?, malli?, id?, naute?, mallirivi? }`.
  `aika` = hetki (päivä pienellä, kellonaika 17 px lihavoituna), `paa` =
  rivin pääluku (22 px: tuuli, vedenlämpö, aallonkorkeus), `luku` =
  arvo kiinteän levyisessä sarakkeessa (`.en-luku`), `suunta` = oma
  sarakkeensa, ja `malli` = laajan vertailumalli samanlaisena soluna
  viivanäytteen (`naute`) kanssa `.en-lk-mallit`-kääreessä, jonka
  `mallirivi` varaa myös ilman malleja. Päätöstä (keli-chip) EI toisteta rivillä: kortin
  hero sanoo sen kerran. Skrubissa rivin luvut EIVÄT enää isone
  (`.en-lukema.skrubaa` vaihtaa vain taustan) — pääluku on jo iso.
  **KUPLA PALLON VIERESSÄ (30.9., käyttäjän nimenomainen pyyntö "lukema
  voisi näkyä pallon vieressä ja myös muilla malleilla")** on SVG:n
  sisällä hover-ryhmässä (`data-tk-kupla`, `Aikakaavio._kupla`), EI
  HTML-kelluva laatikko: pääsarjan arvo (`Units.fmt`, sama tarkkuus kuin
  rivillä), puuska ja ilmansuunta, ja JOKAINEN kaaviossa oleva
  vertailumalli omalla värillään (`g.kupla.vertailut`), ja mallien
  käyrille väripiste kursorin kohtaan (`data-tk-mdot`, piirretään
  pääpallon PÄÄLLE, koska mallit ovat usein samassa korkeudessa).
  **KUPLA JÄÄ, MUTTA SE ON KIINTEÄN KOKOINEN** (käyttäjän päätös 3.10.:
  "ei poisteta kuplaa kaavioista", P11 muuten suosituksen B mukaan):
  rivit ovat kiinteät kaaviota kohti (puuttuva arvo "–"), leveys
  MITATAAN kerran piirtoa kohti pisimmästä mahdollisesta rivistä
  (`_kuplaKoko`, `getComputedTextLength`) eikä arvioida merkkimäärästä,
  puoli vaihtuu vain kun kupla ei mahdu sille puolelle (`_akKuplaPuoli`),
  ja kupla pysyy näkyvän piirtoalueen sisällä kiinteän y-akselin
  oikealla puolella. Ennen leveys vaihteli osoitetun tunnin mukaan
  (111–139 px) ja kupla jäi 320 px:n puhelimella 19 px reunan yli.
  Kupla asetetaan kursorin sivulle 24 px:n päähän eli sormen (~22 px
  säde) ohi; pystysuunnassa se rajataan plotin sisään. Skrubissa pallo
  kasvaa 1,6× ja kursoriviiva on umpinainen 1,2 px. Kupla peittää
  alleen jääviä huippulappuja osoitettaessa — se on tietoinen hinta.
  **SVG:N `visibility="visible"` LAPSESSA VOITTAA VANHEMMAN
  `hidden`IN.** Hover-ryhmän piilotus ei piilottanut palloa, kuplaa
  eikä mallipisteitä, koska niille oli asetettu `visible` itse; osoitin
  lähti ja ne jäivät ruudulle. `Aikakaavio.hover(kaare, null)` piilottaa
  ne nimeltä, ja testi lukee LASKETUN näkyvyyden jokaiselta osalta
  (`getComputedStyle`), ei ryhmän attribuuttia.
- **TUNTI VALITAAN KAAVIOSTA AIKAJANAN POLKUA** (`Ennuste.valitse` →
  `_tlValitseIdx` → `openSheet`:n päivityspolku). Mitattu
  CDP-kosketuksella puhelimella ja iPadilla: värisevä napautus
  valitsee, pysty- ja vaakaveto eivät, paneeli pysyy auki vaakavedon
  jälkeen, ja kontrolli (veto herosta) sulkee iPadin paneelin.
- **KORTIN OMA TUNTIVALITSIN ON POISTETTU** (`#sh-timepill`, P5). Se oli
  kolmas valitsin samalle asialle ja kirjoitti valinnan ohi
  `_tlValitseIdx`:n. Älä palauta sitä; heron aikarivi kertoo hetken.
- **MALLIDATAA EI MITATA VERKOSTA.** Sama build antoi peräkkäisillä
  ajoilla 75 ja 0 malliviivaa. Kortin sarjat ovat
  `KorttiSarjat._m`:ssä (spotin nimi → `{avain, sarjat}`), avain
  varaston rakennus + tunti; mittari istuttaa tai lukee ne sieltä
  (`FS.KorttiSarjat` `?perf=1`:llä).

**Havaintoasemat**

- **ASEMAREKISTERI ON YKSI: `FMI_MAP_STATIONS` + `PAIKALLISASEMAT`.**
  `_fmiStationsSorted` piti omaa kopiotaan, ja kopio oli jäänyt
  kahdeksaan asemaan kun kartalla oli yksitoista — puuttuivat `emasalo`,
  `porkkala` ja `hanko`, eli täsmälleen ne jotka ovat pääkaupunkiseudun
  ulkopuolella. Hangon spotti näytti Espoo Tapiolaa 112 km päästä vaikka
  samanniminen asema on 2 km päässä. Korjattuna 11/12 spottia sai
  lähemmän aseman. **Älä lisää asemaa vain toiseen paikkaan.**
  Rekisterissä on 21 FMI-asemaa (29.9. lisättiin avomeri- ja
  rannikkoasemat Kalbådagrund, Orrengrund, Rankki, Haapasaari,
  Bågaskär, Russarö, Vänö, Fagerholm ja Rajakari; docs/oikeellisuus.md
  O6), sekä `FMI_MAP_STATIONS`issa että `api/fmi.js`:n `STATIONS`issa,
  ja **KAIKKI HAETAAN FMISID:LLÄ** — `place=malmi` oli FMI:n
  paikannimihaku ja palautti `numberMatched="0"`. Koordinaatit ovat
  FMI:n omasta vastauksesta. `FMI_SEA_PLACES` johdetaan tagista — se
  oli oma listansa. `tools/varmennus.mjs` lukee saman rekisterin
  (`STATIONS` viedään `api/fmi.js`:stä, tagit `index.html`:stä).
- **KARTAN MERKIT OVAT YKSI HAKU: `/api/fmi?asemat=1&hours=48`**
  (docs/oikeellisuus.md, O6–O7). Yksi multipointcoverage-kysely kaikille
  21 asemalle, tiivis vastaus (`{t0, dt, n, asemat: {place: {ws, wg,
  wd} | null}}`, 65 kB / gzip 18 kB), sama osoite kaikille käyttäjille
  eli CDN-osuma. Ennen 24 kutsua käynnistyksessä ja ei yhtään sen
  jälkeen. Tuorein lukema on historian viimeinen rivi (tuuli, suunta ja
  puuska SAMALTA riviltä). Kortit hakevat yhä oman sarjansa (48 h /
  168 h, `_havHaeSarja`).
- **HAVAINNOT PÄIVITTYVÄT ISTUNNON AIKANA** (`_havPaivita`, O7): FMI,
  Kruunuvuorenselkä, Mellsten, Laru, aaltopoijut, UiRaS ja kamerat
  10 min välein kun sivu näkyy, ja Paluun 5–30 min haarassa heti.
  Latausfunktiot ovat `_havPaivittajat`-listassa; uusi lähde lisätään
  sinne eikä omaksi ajastimekseen. Merkit päivitetään `updateIcons()`illa
  (valittu hetki ja kamera), ei suoralla `setIcon`illa.
- **HAVAINNON IKÄ LASKETAAN LEIMASTA (`_havIkaMin`, `lastIso`), EI
  PROXYN `ageMin`ISTA.** `ageMin` on laskettu hakuhetkellä ja vastaus on
  CDN:ssä 5–10 min: "X min sitten" oli välimuistin iän verran liian
  pieni ja jäätyi. Uusi ikäteksti lukee `_havIkaMin`iä.
- **NYT-TIKILLÄ TUOREIN HAVAINTO, MENNEELLÄ TUNNILLA VAIN HISTORIA.**
  Raja on `Ennuste.nytTunti()` (sama pyöristys kuin `nowIdx`): ennen
  tunnin alkupuolella pilleri näytti tasatunnin historia-arvon ja
  kortin "Havainnot nyt" tuoreimman. Menneellä tunnilla ilman
  historiaa lukema on "—" eikä tuorein havainto, ja "ei signaalia"
  koskee vain nykytilaa. Historia kattaa aikajanan menneisyyden
  (`HAV_KARTTA_H` 48). Puuska haetaan SAMALTA HETKELTÄ (`iso`), ei
  samasta indeksistä — FMI:n puuskasarja ei ole rinnakkain tuulen kanssa.
- **KOPIO EI OLLUT VAIN PUUTTUVA RIVI VAAN VÄÄRÄ MITTAUS KOODISSA.**
  Spottikortin kommenttiin oli kirjattu "Hangon spoteille lähin on
  107–112 km — eri sääjärjestelmä, tyhjä on rehellisempi kuin väärä".
  Mittaus oli oikein mutta se oli tehty vajaasta listasta. Kun mittaat
  etäisyyksiä, tarkista ensin että lista on se jota sovellus käyttää.
- **`pref` JOHDETAAN TAGISTA** (`'Meri'` tai `'Avomeri'`), ei kirjoiteta
  erikseen: erillinen lippu olisi toinen paikka joka ajautuu erilleen.
  Meriasema ohittaa sisämaan aseman alle 40 km:n matkalla.
- **PAIKALLISASEMAT OVAT TAVALLISIA HAVAINTOJA.** Mellsten (Espoo
  Haukilahti), Laru ja Kruunuvuorenselkä eivät ole FMI:n verkossa mutta
  kuuluvat samaan rekisteriin: "lähin havainto" ei saa riippua siitä
  kenen palvelin vastaa. `lahde` kertoo mistä sarja haetaan
  (`_havHaeSarja`), ja karttamerkit lukevat sijaintinsa SAMASTA
  rekisteristä — ei omista kopioistaan.
- **ASEMAN NIMI ON PAIKAN NIMI, EI MASTON.** 'Espoo Mellsten' ->
  'Espoo Haukilahti', koska spotti jonka kohdalla se on, on Haukilahti.
  Mellsten ei katoa: se on lähdemerkinnässä, joka on oikea paikka kertoa
  kenen mittari se on.
- **KALLAHTI EI SAA ASEMAANSA ENSIMMÄISESTÄ OSUMASTA.** Vuosaaren satama
  on 3,9 km päässä mutta ei lähetä tuulta, joten `_fmiLoadWithFallback`
  ohittaa sen. Jos mittaat asemavalintaa, mittaa KETJU äläkä listan
  ensimmäistä — muuten Kallahti näyttää rikkinäiseltä vaikka se toimii.
- **KORTIN TUULIKAAVIOT OVAT KARTAN RAMPPIA, VIIVAT `--ink`**
  (P1, docs/spottikortti.md). Väri on funktio KORKEUDESTA, ei
  sarjasta: vaakaviipale korkeudella y saa sen nopeuden värin jota y
  edustaa. Ennuste- ja havaintokaavio käyttävät samaa: `ColorRamp.rgb()`
  alfalla `Tuulikaavio._alfa(ms)` (0,30 tyynestä 0,78:aan 8 m/s:stä),
  keskituuli täytenä ja puuska 0,42-kertaisena. Havaintokaavio oli
  ennen `paperi()`. Alfa kasvaa nopeuden mukana, koska rampin nollapää
  on tummaa yösinistä ja tyyni päivä olisi muuten kaavion raskain
  kohta. Älä sävytä viivoja rampilla — mitattuna `ink()` katoaa oman
  ramppinsa päälle (kontrasti 1,14–3,33) — ja kaavion luvuilla on
  paperihalo (`paint-order: stroke`), joten niiden kontrasti ei riipu
  täytöstä.
- **`gradientUnits="userSpaceOnUse"` on pakollinen** täytön
  gradientissa. Oletusarvoinen objectBoundingBox suhteuttaisi sen
  täyttöpolun rajauslaatikkoon, jonka yläreuna on korkein puuskapiikki
  eikä piirtoalueen ylälaita — väri ja akseli irtoaisivat toisistaan
  aina kun tuuli ei yllä asteikon huippuun. Pysäkit otetaan
  m/s-asteikolla ja sijoitetaan yOf():n mukaan; käänteistä
  yksikkömuunnosta ei ole eikä saa keksiä (bofori ei ole käännettävissä).
- **KUVAAJASSA EI OLE VÄRILIUSKAA.** Y-akselin vieressä oli gradientti
  kolmen yksikön pystyliuskana. Se oli turha omasta perustelustaan:
  kun väri on funktio KORKEUDESTA, y-akselin numerot ovat jo sen
  selite — liuska oli kolmas kerta samalle tiedolle ja kuvaajan ainoa
  pystysuora muoto joka ei ollut dataa. Älä palauta sitä; jos värin
  merkitys joskus pitää sanoa ääneen, se sanotaan selitteessä sanoina.
- **Kaavion työkalurivi (`.hav-tyokalut`) on `flex-start`, ei `space-between`.**
  Asemavalitsimen paikka on tyhjä havaintokortissa, ja `flex: 1`
  -välikkeenä se työnsi jaksovalitsimen keskelle riviä kun sulkunappi
  jäi oikealle — kaksi kohdistusta samalla rivillä. Laajennusnappi
  menee oikealle `margin-left:auto`illa, ja tyhjä paikka poistuu
  virrasta CSS:llä (`.hav-asemavalitsin:empty`), ei JS-lipulla.
- **ASEMAN NIMI SANOTAAN KERRAN, IKÄ SANOTAAN KERRAN** (V15, P15
  kohdat 7–8). Havaintokortissa otsikko on aseman nimi; SPOTTIKORTISSA
  nimi on VAIN asemavalitsimessa — ei moduulin otsikossa, ei
  selitteessä eikä laatassa (ennen "Helsinki Laru" näkyi neljästi ja
  vedenlämmön asema viidesti). Vedenlämmön selite sanoo vain lähteen
  ("UiRas"). Valitsimen nappi ei rivity: jos se ei mahdu, pois jäävät
  "Asema"-sana, tagi ja etäisyys (`_fmiTriggerMahduta`). Ero
  havaintokorttiin luetaan `data-nimi-otsikossa`-lipusta ELEMENTILTÄ
  ITSELTÄÄN (`el.dataset`), EI `closest`illä — molemmat kortit asuvat
  samassa `#sheet-content`issä. IKÄ SANOTAAN VAIN KUN LUKEMA ON VANHA,
  ja silloin se on varoitus selitteen lopussa ("⚠︎ Asema ei lähetä · 31 h
  sitten", `.hav-selite-varo`); tuoreen lukeman hetki on lukemarivillä
  ("Viimeisin 12:48", ja päiväys kun lukema ei ole tältä päivältä).
  Erillinen `.hav-vanha`-laatikko poistettiin: se kasvatti moduulia
  juuri kun asema hiljeni. Hero mainitsee iän samoin vain vanhana.
- **Spottimerkkiä napauttava mittari on tarkistettava
  `State.sheetSpot`ista.** Lauttasaaressa Larun asemamerkki on spotin
  vieressä, ja kosketussäätö siirtää napautuksen siihen:
  `spottikaavio.mjs` avasi pitkään HAVAINTOkortin ja luuli sitä
  spottikortiksi — ja siitä päätyi kertaalleen raporttiin "spottikortin
  asemavalitsin on rikki", vaikka havaintokortissa sitä valitsinta ei
  kuulukaan olla.
- **Yöharso on täytön PÄÄLLÄ mutta viivojen ALLA** (moottorissa
  `tausta` täyttöryhmän jälkeen). Täytön alla se näkyy vain siellä
  missä täyttöä ei ole ja lukee korostuslaatikkona. Yömerellä harso on
  tummaa (`4,7,14` alfoilla .36/.24/.12): tummalla pinnalla yö on
  tummempi, ei harmaampi. Vedenlämmössä ja aalloissa harsoa ei ole.
- **Jakson kovin puuska saa aina lapun.** Se sulki kerran pois juuri
  sen luvun jonka "Kovin puuska" -ruutu sanoo (7 vrk: ruutu 31,9,
  kaavion suurin lappu 29,0). Moottorissa havainnon luvut ovat
  ikkunoittain (`ikkunaLuvut`: keskiarvo ja puuskan maksimi), ja jos
  reunaikkunan lappu jäi pois, kovin puuska lisätään erikseen.
- **HAVAINTO VIERII, EI NIPUTU RUUTUUN.** Koko ladattu historia (48 h
  spottikortissa, 7 vrk asemakortissa) on piirretty 24 h ruudulle, ja
  niput ovat noin 2,4 px välein (`_havSarja`). Raahaus ei enää lue
  arvoa — napautus lukee — joten vieritys ei syö sitä.
- **Asu valitaan laatikon muodosta, ei media querystä.** Laajan
  piirtoalue on laatikon korkeus ja kirjasin sen leveydestä
  (`laajaFs`); työpöydän kapea ikkuna ja puhelimen vaaka ovat sama
  tilanne.
- **Kääntö sulkee vain jos näkymä avattiin kääntämällä.** Napista avattu
  jää auki ja vaihtaa asua. Nappi on oikea `<button>`; kääntö yksin
  rikkoisi saavutettavuussäännön.
- **LAAJA NÄKYMÄ ON `inset: 0`, JOTEN SE TARVITSEE TURVA-ALUEET
  KAIKILLA NELJÄLLÄ SIVULLA.** Ilman niitä mitattiin iPhone 16:lla neljä
  oiretta yhdestä syystä: pystyssä sulkunappi 7 px ylhäältä (palkki 59),
  vaakassa kaavio 10 px vasemmalta, nappi 12 px oikealta ja rako alas
  18 px (indikaattori 21). Täyte on `max(var(--sat), 6px)` eikä pelkkä
  token, koska selaimessa alainsetti on iPhonella nolla. Vaakatilassa
  palkki on toisella sivulla mutta kumpi riippuu kääntösuunnasta —
  molemmat on käsiteltävä.
- **Laajan korkeus ratkaistaan LAATIKOSTA**, ei vakiona. Lukemarivi on
  täytettävä ENNEN mittausta (sen korkeus muuttaa laatikkoa: 645 vs
  625 px), ja avauksen jälkeen on piirrettävä uudestaan 180 ms:n
  kuluttua (kääntämällä avattaessa mitat eivät ole asettuneet: 714×187
  vs 714×280). Kaavio ei saa olla laatikkoaan korkeampi (V16): matalassa
  laatikossa (puhelin vaakatasossa) lämpörivi jää pois ennen kuin
  piirtoalue painuu alle 120 px:n, ja piirtoalue joustaa 100 px:iin —
  ylivuoto keskittyi ja leikkasi sekä lähdekaistan että lämpörivin.
  Lähderivi on vähintään 13·fs (työpöydällä 16,5 px:n nimi ei mahtunut
  16 px:n riviin).
- **Liu'utusele alkaa mistä tahansa PIIRTOALUEEN YLÄPUOLELTA**
  (kahva, otsikko, lukemarivi, mallirivin välit, kaavion päivä- ja
  tuntirivit; raja `g.y0`, `_piirtoalueenYlapuolella`), ei
  piirtoalueelta. Kuvaajan päällä raahaus on lukeman haku, joten
  sulkuele siellä sulkisi näkymän aina kun arvoa luetaan. Sivuttain
  vierivissä (mallirivi, kaavio) veto on sulkuele vasta kun se on
  selvästi alaspäin. Napit ohitetaan `closest('button')`illa.
- **Laajassa lukema on kiinteällä rivillä JA kuplassa pallon vieressä.**
  Rivi on SAMA komponentti kuin kortilla (`HavLaaja.rivi` →
  `Aikakaavio.lukemaHtml`). Tuuliennusteella (V13, 3.10.) **levossa
  VALITTU TUNTI, osoittaessa osoitettu — samat solut**: aika, tuuli,
  puuska ("–" kun puuttuu) ja vertailumallit soluina viivanäytteineen
  (`data-lk-malli`), joten rivi on samalla käyrien selite. Luvut ovat
  kiinteissä sarakkeissa (`.en-luku`, `.en-suunta`, aikasolun nimen
  leveys), eikä mikään solu siirry tunnista toiseen. **KORKEUS EI RIIPU
  MALLIEN MÄÄRÄSTÄ:** kapeassa (`.hl-lukema` alle 600 px, `@container`)
  mallit ovat aina olemassa olevalla toisella rivillä (98 px; ilman
  malleja siinä on valikon avaava "Vertaa malleja"), leveässä samalla
  rivillä hiusviivan takana (54 px). Ennen ensimmäinen malli kasvatti
  riviä 54 → 80 px ja lyhensi kaaviota, ja levossa rivi kertoi 48 h:n
  keskiarvot eri soluilla kuin osoittaessa. Kupla on samalla 24 px:n
  etäisyydellä kuin kortilla, joten se ei jää sormen alle (aiempi
  HTML-kupla jäi).
- **Lämpötila on VÄLI eikä käyrä.** Oma y-akseli tuulen rinnalla tekisi
  risteämisistä merkitseviä vaikka ne ovat mittayksikön sattumaa.
- **KATKO ON KATKO, EI VIIVA** (`HAV_KATKO_MS` 30 min). Havaintokaavion
  nippu katkeaa kun kahden havainnon väli ylittää sen, ja `_havSarja`
  lisää katkon kohdalle `null`-pisteen, johon käyrä, täyttö, luvut ja
  nuolet katkeavat. Osoitin katkon sisällä näyttää katkon ("Ei
  havaintoa 31 h · viimeinen ennen · jatkui") eikä reunan lukemaa.
  Mellsten sammuu pilvisellä säällä tunneiksi, ja lukumääräniputus veti
  ennen suoran viivan tyhjän yli. 30 min ei katkaise FMI:n 10 min
  sarjaa yhden tai kahden puuttuvan näytteen takia.
- **`wsMin` EI OLE lähteen tyyni vaan nipun sisäinen minimi.** Kun
  nippuun osuu yksi näyte, se on sama luku kuin keskiarvo — mitattuna
  katkoviiva piirtyi 0,00 yksikön päähän keskituulesta koko laajassa
  näkymässä ja kortin 6 h jaksolla. Käyrä ja sen selite piirretään vain
  jos ne erkanevat, ja ehto luetaan DATASTA eikä nipun koosta.

- **KATKO JA LAKKAUTUS OVAT ERI ASIA.** `_fmiLoadWithFallback` antaa
  `onFail`ille syyn: `'tyhja'` = vastaus tuli ja koko ikkuna oli tyhjä
  (proxyn oma `error: 'no data'`, HTTP 200) → merkki ja sen ruksi pois
  kartalta; `'verkko'` = pyyntö kaatui tai palautti poikkeuksen →
  katkoviivainen "ei signaalia" jää. Älä poista mitään verkkovian
  perusteella: mitattuna `/api/fmi`:n katkaisu jättää kaikki 13
  merkkiä paikalleen, ja ilman erottelua yksi katko pyyhkisi
  havaintoasemat kartalta. `error: 'no data'` on proxyn merkintä juuri
  tälle — ensimmäinen versio testasi `!value.error` ja luokitteli
  siksi tyhjän vastauksen verkkoviaksi. Karttamerkkien yhteishaussa
  sama sopimus on `asemat[place] === null` (tyhjä ikkuna → merkki pois,
  ja se palaa kun data palaa) vs kaatunut haku tai 502 (mitään ei
  poisteta, aiempi historia jää ja sen ikä ratkaisee tuoreuden).
  Jos YKSIKÄÄN asema ei vastaa, proxy vastaa 502:lla eikä tyhjällä
  listalla — kaikkien asemien yhtäaikainen "lakkautus" on FMI:n vika.
- **YLÄVIRRAN VIRHE ON 502 JA `no-store`, EI `no data`**
  (`api/_haku.js`, docs/oikeellisuus.md O5). FMI vastaa virheeseen
  HTTP 400:lla ja `<ExceptionReport>`-rungolla; proxyt jäsensivät sen
  ennen tyhjäksi ja vastasivat `{error:'no data'}` HTTP 200:lla, eli
  kiintiön täyttyminen olisi pyyhkinyt havaintoasemat kartalta ja
  WAM-rivin koko istunnoksi (`Aaltoennuste._tyhjat`). `haeFmi` heittää
  muulla kuin 200:lla ja ExceptionReportilla; pisteennusteelle (WAM,
  vedenkorkeus) vain 400 + "No data available" on tyhjä kate
  (`tyhjaPoikkeuksesta`). Aikaraja on KOKO haulle (`req.setTimeout` on
  joutoaika: 1,2 s:n raja laukesi 2,4 s:ssa). `Cache-Control`
  asetetaan vasta onnistuneelle vastaukselle — virhe ei saa jäädä CDN:ään.
- **KRUUNUVUORENSELÄN NOLLARIVI KESKELLÄ TUULTA ON KATKO**
  (`api/kruunuvuori.js`, docs/oikeellisuus.md O10). Rivi `0.0, 0.0, 0`
  (tuuli, puuska, suunta) tuli 14 vrk:ssa viisi kertaa naapureiden
  1–3 m/s puuskan keskellä; kymmenen minuutin puuska 0,0 tarkoittaa ettei
  kuppi pyörinyt. Rivi on puuttuva kun viereisen (≤ 30 min) rivin
  puuska on vähintään 1,5 m/s, muuten se jää tyyneksi. Mellstenin
  nollarivi on eri asia (ks. Mellsten) — älä yhdistä sääntöjä.
- **UiRaS-proxyn vuodet tulevat ajon hetkestä (`[vuosi − 1, vuosi]`) ja
  aikaleimat ovat `toISOString`-muotoa** (api/uiras.js, O9). Lista oli
  kovakoodattu `[2025, 2026]`, ja lähteen leima on
  `2026-09-28T20:58:54.348000+0000` (kuusi desimaalia, vyöhyke ilman
  kaksoispistettä), jota asiakas jäsensi `new Date`llä. Asiakkaan
  `uiras_latest`-leima normalisoidaan samalla säännöllä (`_isoAika`).
- **Vuosaaren satamassa EI OLE tuulihavaintoa.** FMISID 151028 lähetti
  viimeksi 18.8.2026 (mitattu puolitushaulla); asema on yhä FMI:n
  asemarekisterissä, joten rekisteri ei kerro sitä. Korvaajaa
  etsittiin viidestä lähteestä eikä sitä ole (FMI 12 km säteellä, HSY,
  Marine Helsinki, Digitraffic, dlarah.org). Älä lisää sitä takaisin
  kovakoodattuna eikä näytä naapuriaseman lukemaa sen kohdalla —
  merkki palaa itsestään jos FMI jatkaa lähettämistä. Sama koskee
  Malmia (FMISID 101009), joka lähetti viimeksi 25.9.2026.

**Kelikamera** (Laru; docs/data.md "Larun kelikamera", docs/ui.md
"Kelikamera: play-kolmio pilleriin ja kamera asemakorttiin")

- **KAMERAN TILA TULEE PIKKUKUVAN ETAGISTA, EI YOUTUBEN LIVE-LIPUSTA.**
  Larun lähetys on ollut "käynnissä" 6.12.2019 lähtien myös silloin
  kun kamerassa ei ole virtaa (laskurista laskettuna kuvaa noin
  neljännes ajasta), ja katselusivu ja soittimen rajapinta vastaavat
  palvelinosoitteelle bottitarkistuksella. `i.ytimg.com`-kuvan ETag on
  laskuri joka kasvaa ~4,9 min välein; päättyneen lähetyksen ETag on
  "0" ja poistetun kuva 404. Päällä = ETag vaihtui 25 min sisällä, ja
  se vaatii kaksi näytettä eri aikaan: keräin (`tools/kamerat.mjs`,
  sama Actions-ajo kuin Mellsten, `continue-on-error`) kirjaa ne
  `havainnot`-haaraan ja `api/laru.js?kamera=1` lisää oman HEADin.
  **HILJAISUUS ON HAVAINTO**: sama kuva on NÄHTÄVÄ rajan yli — vanha
  muutos ilman uutta näytettä on 'tuntematon', ei 'pois'. **LASKURI ON
  KELLO** (~5 min/kuva): vanhan keräinnäytteen ja oman näytteen välinen
  kuvamäärä (`kuvia ≥ ikä/6 min − 2`, enintään vuorokausi) kertoo onko
  kuvaa tullut koko ajan, joten kolmio ei katoa keräimen viiveeseen.
- **REKISTERI ON YKSI: `api/_kamerat.js`.** Sovellus saa kamerat
  `/api/laru?kamera=1`:n vastauksesta ja kytkee ne asemaan `asema`-kentällä
  (aseman `place`); index.html:ssä ei ole kameralistaa. Uusi lähetys
  löytyy kanavan syötteestä itsestään, joten videota ei vaihdeta käsin.
- **PLAY-KOLMIO VAIN TILASSA `live`**, pillerin viimeisenä osana samaa
  mustetta (`INK_2`) kuin yksikkö ja ilman hiusviivaa (viivan takana se
  luki erillisenä nappina). Se kulkee allekirjoituksessa (`|v`), ja
  datan saapuessa ikoni asetetaan `_asetaTuuliIkoni`lla — muuten
  myöhemmin tullut lukema pudottaisi kolmion.
- **KUVA ENSIN, SOITIN NAPAUTUKSESTA** (youtube-nocookie, mykistettynä,
  samaan 16:9-ruutuun). Kuvan osoitteeseen EI `?v=`:tä: i.ytimg.com
  lukee sen versioksi heksana ja vastaa 404:llä tulevaan versioon
  (desimaalinen ETag rikkoi kuvan). Tilassa `pois` ei kuvaa: talvella
  se olisi kuukausien takaa.
- **FOKUS MODUULIIN, EI SOITTIMEEN, JA SULKU POISTAA SOITTIMEN.** Iframen
  sisällä Esc menee YouTubelle eikä sulje korttia (mitattu).
  `closeSheet` kutsuu `_kameraPysayta`a, koska piilotettu kortti
  striimaisi yhä.
- **Kontin Chromium ei saa `i.ytimg.com`:ia** (`ERR_TOO_MANY_RETRIES`):
  selaintesti reitittää kuvat curlilla haettuihin tiedostoihin.

**Aaltopoijut** (havainto — tämä on tuotannossa)

- **Yksi haku kattaa koko maan.** Rajapinnan `bbox` EI rajaa mitään
  (mitattu: sama 10 asemaa ja 62 829 tavua bboxin kanssa ja ilman).
  Ala tee asemakohtaisia hakuja tuoreimmalle lukemalle — se olisi
  kymmenen pyyntoa yhden hinnalla.
- **Lukema ei ole "nyt" eikä se seuraa aikajanaa.** Viive on mitattuna
  57–117 min, joten tuoreimman ikkuna on 6 h (3 h pudotti yhden aseman
  kymmenestä pois) ja kortti sanoo aina iän (leimasta, `_havIkaMin`). Havaintoa
  tulevaisuuden tunnista ei ole olemassa.
- **Kaikki poijut eivät mittaa aaltoja.** Neljä kymmenestä antaa
  aaltokorkeutta 0 %:ssa riveistä mutta lämpötilaa 45–50 %:ssa — ne ovat
  lämpöasemia samassa kyselyssä. `kind`-kenttä ratkaisee, ja lämpöasema
  kulkee vesi-ikonipolkua. Älä keksi sille omaa asua.
- **Asemat luetaan vastauksesta, ei kovakoodatusta listasta.** Poijut
  ovat kausiluontoisia. Nimi ja sijainti sidotaan FMISIDiin, ei
  esiintymisjärjestykseen — järjestys menee rikki kun asema on hiljaa.
- **Aallonkorkeus on MUSTETTA, ei väriä.** `ColorRamp.ink()` on
  tuuliasteikko; 0,4 m siitä värjättynä sanoisi "0,4 m/s".
- **Aaltopillerin glyfi ei ole vedenlämmön glyfi.** `_pilleri` antaa saman
  pinnan kaikille, joten glyfi on ainoa mikä kertoo suureen.
- **LUKEMAT TULEVAT NÄKYVIIN PORRASTETUSTI: MERI JA POIJU z8, VESI z9,
  MAA z10** (`LUKEMA_Z_MERI/VESI/MAA`, Leaflet-asteikko; käyttäjän
  päätös 2.10. — 1.10.:n "yksi raja z10" peruttiin, koska kaukaa ei
  nähnyt mitään). Päällekkäisyyden hoitaa sijoittelu (alla), ei
  kynnys. Lukeman zoomin alla asema on HARMAA PISTE ILMAN RUKSIA
  (`_kaukoPallo`, käyttäjän päätös 2.10.): z7:stä 5 px, Suomen koossa
  (alle z7) 4 px ja himmeämpi (`.kauko-pallo-pieni`, porras
  `_palloPorras` myös allekirjoituksessa). × pallossa teki Helsingin
  edustasta z7:llä ruudukon. Pisteet ovat neutraalia harmaata, EIVÄT
  kermaa (käyttäjän päätös). Pisteen napautus zoomaa aseman lukeman
  zoomiin (`Merkki`-optio `zoomaaAlle`; osumapinta `::after`). Lukema tulee
  0,22 s:n häivytyksellä (`.merkki-esiin`, vain tilan vaihtuessa).
- **Aaltokaavio on sama moottori kuin muut** (V8): 7 vrk haetaan
  kerralla (`AALTO_HISTORIA_H`) ja vieritetään, napautettu lukema jää
  lukemariville 4 s:ksi, ja suunta (MISTÄ) piirtyy suuntariville.
- **Peitto mitataan SISEMMÄSTÄ elementistä.** Merkin `_icon`-kuori
  (nyt MapLibren `Marker`-elementti, `Merkki._el`) kantaa
  `translate`-sijainnin eikä liiku väistön mukana — kuoresta mitattu
  peitto valehtelee.
- **SPOTTIMERKKI ON KERMA KIEKOLLA** (`spotMarkerSVG`, käyttäjän valinta
  2.10. viidestä vaihtoehdosta, "A"; laatta "D" oli tuotannossa hetken ja
  vaihdettiin): pyöreä yömeren levy (`--surface-hi`), numero kermaa
  (`--ink`, 12,3:1 levyä vasten) ja indeksi OHUENA kaarena (0,075 ×
  koko, ennen 3/36) `spotIndexInk`-värillä — numero ei ole enää indeksin
  värinen. Sama muoto kartalla, spottikortin heron indeksinä ja
  ennustepaneelissa. Sijoittelussa spotti on este ympyränä. Hylätyt:
  ontto rengas (kirkkaalla lämpökartalla kerma 1,3–1,9:1 ilman haloa),
  neula, laatta, pallo ja numero.
- **SUOMEN KOOSSA (alle z7, `SPOT_NUMERO_Z`) KAIKKI OVAT PISTEITÄ, JA
  z7:STÄ KAIKKI SPOTIT OVAT NUMEROINA — PÄÄLLEKKÄIN JOS TARVIS**
  (käyttäjän päätökset 1.–2.10.: "spotit voivat olla päällekkäin,
  kaikki spotit näkyvät kun ne tulevat ensimmäisen kerran näkyviin").
  Spottien väistöä EI OLE: se piilotti z7–z9:llä puolet spoteista
  pisteiksi. Suomen koossa jokainen spotti on 7 px:n harmaa piste
  (`SPOT_PISTE_PX`), joka on asemien pisteiden PÄÄLLÄ (`zIndexOffset`
  −30 vs −40…−200), muuten Hangon asema varasti spotin napautuksen
  (napautus zoomaa z10:een). Päällekkäisten spottien kerros on kiinteä
  (`_spotKerros` = `_spotJarjestys`: suosikit, sitten `SPOTS`), ei tunnin
  pistemäärä — pistemäärällä Munkkiniemi ja Otaniemi vaihtoivat
  paikkaa joka askeleella. Nimilaput väistävät yhä (`_spotNimetPois`).
  Älä tee mistään merkin tilasta lukeman funktiota.
- **ASEMIEN LUKEMAT SIJOITTAA YKSI FUNKTIO (`_sijoitteleHavainnot`)**,
  joka korvasi Kruunuvuorenselän `_avoidSpotOverlap`in ja poijujen
  `_aaltoVaisto`n. Spottirengas on aina tarkassa sijainnissaan; lappu
  ottaa ensimmäisen vapaan paikan kiinteästä listasta (oikea, vasen,
  ylös, alas, vinot, 5 px:n rako), esteinä spottien renkaat ja nimet
  ja jo sijoitetut laput. LAPPU EI HYPI ZOOMATESSA (käyttäjän pyyntö
  2.10.): ensin EDELLINEN suunta (`_viimeSuunta`) jos se on yhä vapaa,
  sitten aseman OMA suunta (`_omaSuunta`: maantieteestä, poispäin
  lähimmistä spoteista ja asemista, sama joka zoomilla), sitten muut.
  Mitattu z8–z11 neljännestasoin kahdessa näkymässä: suunnan vaihtoja
  40 → 14 (29 asemaa), lapun rako ×:ään 10,3 → 7,9 px. Rako on 3 px
  (`SIJOITUS_RAKO`), ja × on 4 px ja harmaa (`156,162,171` .75).
  **RAKO HAETAAN PIKSELIN TARKKUUDELLA JOKA SUUNTAAN (3…44 px,
  `SIJOITUS_MAX`), JA SPOTTIRENGAS ON ESTE YMPYRÄNÄ** (käyttäjän pyyntö
  2.10.: Haukilahden, Larun ja Kruunuvuorenselän lukemat irti
  ×:stä). Kiinteät raot 3/9/16/26 ja laatikkorengas pitivät lapun
  16–26 px irti renkaasta. Valinta: edellinen suunta jos sen rako on
  enintään `SIJOITUS_SIETO` (10) px suurempi kuin paras, sitten oma,
  muuten lähin; 3 px:n sieto toi hyppimisen takaisin (32 vaihtoa).
  Spotin nimi on este mitatulla leveydellä, ei 64 px:llä. Lappujen
  välinen reunus on 2 px, ehdokkaan oma laatikko on tarkka (Larun
  ainoa paikka z10:llä jäi 0,75 px:n reunuksen alle). Lappu jolla on
  pelkkien spottien keskellä enintään kaksi vapaata suuntaa sijoitetaan
  ensin (Laru z10 neljän spotin rypäässä). Mitattu: Laru näkyy nyt
  z9–z12 (ennen piste z9–z10), lappuja z8 9 → 12 ja z10 9 → 11;
  suunnan vaihtoja 22 (30 asemaa, enemmän näkyviä lappuja), loput
  ruudun reunalla.
  Paikat on porrastettu kauemmas, koska spotin vieressä oleva asema (Emäsalo 180 m,
  Kruunuvuorenselkä) jäi lähimmällä kehällä renkaan alle ja pisteeksi
  joka zoomilla, ja RUUDULLE MAHTUVAT paikat kokeillaan ensin (lappu
  meni Kallahti–Emäsalo-näkymässä reunan yli); siksi sijoittelu
  ajetaan myös `moveend`issä. Järjestys on kiinteä (meri ja poiju,
  maa, vesi; nimen mukaan) — EI lukeman mukaan. Lappu jolle ei ole
  tilaa jää palloksi. Vedenlämmön lukema näkyy KAIKILLA UiRaS-
  asemilla z9:stä (myös ei-`prim`, kuten Kallahden asemat). Tarkka sijainti on 4 px:n harmaa × merkin omana lapsena
  (`.sijainti-x`, ei kosketuksia); erillistä ruksimerkkiä
  (`_addStationDot`) ei enää ole. MITÄÄN EI PIIRRETÄ SPOTIN ALLE: ×
  ja asemapallo jäävät pois renkaan (tai kaukana spottipallon) päältä.
  Esteenä on spotin TODELLINEN merkki (rengas vai pallo,
  `State._spotTaydetAvain`). Mitattu 2.10. Helsingin edustalla z6–z11
  kaikki kerrokset päällä: päällekkäisyyksiä 0, spotin alla 0, ja
  spottien ja lappujen tila sama kuudella eri tunnilla (z8, z9, z10).
  Ajetaan `_applyMapLayers`issa, `updateIcons`in lopussa (zoomend) ja
  `renderSpots`in lopussa.
- **Spottikortin aaltorivin raja on 60 km**, ja se on aukko mitatussa
  jakaumassa (kymmenen spottia 5–35 km, Hangon kaksi 114 ja 119 km).
  Rivillä on aina poijun nimi ja etäisyys — muuten se väittäisi
  mittaavansa spottia. V15:stä lähtien rivi on aaltomoduulin alarivi
  ("Poiju nyt 0,30 m · Helsinki Suomenlinna 7 km · 65 min sitten", kaksi
  riviä varattuna, katkeaa vain erottimen jälkeen), ei oma laattansa, ja
  moduulin lukemarivi on valitun tunnin aaltoennuste (`_aaltoKaavio`n
  `o.valittu`, solut "Korkeus", "Suunta" ilmansuuntana ja asteina, "Jakso";
  "–" kun WAM ei kata tuntia).
- **Aaltokaavion y-akseli alkaa NOLLASTA.** Automaattinen alaraja
  suurentaisi 0,20–0,30 m:n vaihtelun koko kaavion korkuiseksi ja tyyni
  vuorokausi näyttäisi myrskyltä.

**Open-Meteon aaltoennuste** (EI tuotannossa — peruttu erä `5150fc1`;
aaltoennuste tulee nyt FMI:n WAMista, ks. yllä)

- **Aaltoennuste on kytkimen takana** (`Asetukset.arvot.aallot`), koska se on
  ainoa uusi rajapintakiintiö sen jälkeen kun tuuli siirrettiin omaan
  varastoon. Pois päältä ei tehdä yhtäkään kutsua.
- **Vain `wave_height`, ei tuuli/maininki-jakoa.** Mitattuna malli lukee
  Itämerellä lähes kaiken maininiksi (`wind_wave` 0,00–0,02 m vs
  `swell_wave` 0,08 m) — kokonaiskorkeus on ainoa luku joka pitää
  paikkansa.
- **`isMarine` EI ole maa/vesi-testi.** Se palauttaa 0,500 sekä
  Tampereelle että avomerelle. Aaltojen maaportti on rajapinnan oma
  `elevation > 20 m` (spottien solut 0–12 m, sisämaa 86–97 m).
- **Välimuistin avain on 0,05° hilalla**, koska mallin solu on ~0,04° ja
  naapurispotit jakavat sen. Kiintiötä säästetään siellä missä se ei
  maksa mitään.

**Aallot kartalla** (docs/data.md "Aallot kartalle", docs/ui.md
"Aallot kartalla")

- **KARTAN AALLOT TULEVAT VARASTOSTA, LUETTELON OMASTA `aallot`-
  AVAIMESTA, EIVÄT TUULEN PERHEISTÄ.** `Aallot` lukee laatat
  `Saalaatat._lataa`lla (sama koti, sama versio, sama LRU), mutta ei
  koskaan `naytteista`n kautta eikä `tasot`/`lisatasot`-listoista: aalto
  sekoitettuna tuuleen olisi väärä luku joka ei näytä väärältä.
- **JAKSO EI OLE HILANA.** Latauspalvelu vastaa `WavePeriod`ille 400;
  rakentaja hakee sen pistekyselynä märistä soluista (kokonaisina
  sekunteina). Älä yritä sitä `download`ista uudelleen.
- **Näyte on märkien solmujen keskiarvo, ja märkyys on alfa.** Maa (255)
  ei ole nolla-aalto: nollana se vetäisi rannikon arvot alas. GL-kerros
  kantaa saman esikerrottuna tekstuurina (r/a).
- **Spotti maskin sisällä lukee lähimmän märän solmun 2,5 km:n
  sisältä**, ja kortti sanoo etäisyyden kun se on yli kilometrin.
  Kauempaa luettu aalto olisi toisen paikan aalto.
- **Kortti, aikajana, kapseli ja kartta lukevat samaa sarjaa**
  (`Aallot.sarja`/`nayte`, `_aaltoEnnusteSarja`); pistekysely
  (`api/wam.js`) on vain varatie vanhalle varastolle.
- **POIJUN KAAVIOSSA ENNUSTE JATKAA MITTAUSTA** (käyttäjän pyyntö
  1.10.): WAM samasta pisteestä katkoviivana NYT-merkin yli, pääsarja on
  yhä mittaus. Spottikortin aaltokaaviossa mittausta ei ole (poiju
  mittaa muualla), joten siellä ennuste on pääsarja.
- **RANTA PIIRRETÄÄN POHJAKARTAN RANTAVIIVALLA, EI MALLIN MASKILLA**
  (Windyn tapa, käyttäjän raportti 1.10.). Kenttä ekstrapoloidaan maan
  puolelle (~4 km), ja `Rantamaski` rajaa sen Esrin tumman pohjan
  laatoista (vesi kirkkaus ≈ 36, maa ≈ 78, kynnys 48/60). Mallin 1 × 2 km
  maski jätti aallokon irti rannasta ja valutti sen kaupungin päälle.
  Kapseli lukee saman kentän ja maskin (`AaltoGL.arvoKohdassa`).
- **AALTOTILASSA AIKAJANA ON AALTODATAN JAKSO** (`_tlAaltoRajaus`,
  käyttäjän pyyntö 1.10.): ei tyhjiä tunteja mallin jakson ulkopuolella.
  Rajattu sarja on muistettava lähdesarjaa kohti — uusi olio joka kutsulla
  rakentaisi janan uudelleen joka kartansiirrolla.
- **Testissä pohjakartan laatat on reititettävä.** Ilman niitä MapLibren
  `load` ei laukea kontissa eikä yhtään custom-kerrosta lisätä.

**Aaltoennuste, vedenkorkeus, sadetutka ja puuskaisuus**
(mittaukset `docs/data.md`, kartoitus `docs/lisadata.md`)

- **ENNUSTESARJA EI ALA KULUVASTA TUNNISTA ILMAN `starttime`A.** Kysely
  laskee tuntiaskeleen kuluvan tunnin alusta mutta aloittaa nyt-hetkestä,
  jolloin ensimmäinen askel osuu SEURAAVAAN tasatuntiin. Mitattuna klo
  12:22 UTC sekä `wam`- että `sealevel`-kysely alkoivat 13:00:sta ja
  12:00 puuttui kokonaan — eli kortin ennusterivit olivat tyhjiä juuri
  nykyhetkessä, joka on se tilanne jossa niitä katsotaan useimmin.
  Molemmat proxyt pyytävät `starttime`ksi kuluvan tunnin alun. Samalla
  kaatui oletus "T+0 on NaN": se oli yhden ajon reuna, ei sääntö.
- **`api/vesi.js` PALAUTTAA AINA SENTTIMETREJÄ.** Lähteessä havainto on
  mm ja ennuste cm, eikä vastaus kerro kumpaa (`uom` puuttuu; yksikkö on
  vain `/meta`-palvelussa). Yksikkö on ratkaistu kerran proxyssä — älä
  ratkaise sitä uudelleen käyttöpaikassa. Tarkistus jos kosket:
  havainto 10:00Z = 286 ja ennuste 11:00Z = 29,0 ovat sama sarja vasta
  kun havainto jaetaan kymmenellä.
- **Vedenkorkeuden nollataso on TEOREETTINEN KESKIVESI, ei N2000.**
  Molemmat ovat vastauksessa; kaksi nollatasoa samassa ruudussa olisi
  kaksi merkitystä samalle numerolle. Etumerkki kirjoitetaan aina
  näkyviin, myös plussalle — se on koko luvun ydin.
- **Aaltoennuste ja poijuhavainto ovat ERI RIVIT.** Ennuste on valittu
  tunti, poiju on "nyt" eikä seuraa aikajanaa. Yhdessä rivissä lukija
  joutuisi päättelemään kumpi luku on kumpaa aikaa. Ennusterivillä EI
  ole aseman nimeä (WAM interpoloi tähän pisteeseen), poijurivillä nimi
  ja etäisyys ovat pakolliset.
- **WAMin `WaveDirection` on MISTÄ**, sama kuin poijun `ModalWDi` ja
  tuuli. Tarkistettu kuudessa pisteessä: poikkeamat 1–40°, käänteiseen
  140–179°.
- **TUTKA ON FINRAD 250 m (`radar_finland_cappi_dbzh`, `qc`), JA SEN
  PALETTI KÄÄNNETÄÄN VOIMAKKUUDEKSI** (docs/sadetutka.md V1): 252 väriä
  (`RADAR_PALETTI`, sama MD5 eri laatoilla ja ajoilla), indeksi → dBZ
  selitteen katkoista (`Sadetutka.DBZ_KATKOT`, 25 indeksin välein),
  dBZ → mm/h `Sade.mmhDbz`. Väriä ei näytetä sellaisenaan: kartan väri
  tulee voimakkuudesta varjostimessa. `raster`-tyyli on venytetty harmaa
  eikä raaka tavu, ja `grayscale(1)` poukkoilee — molemmat mitattu
  vääriksi. **KARTAN SATEEN RAMPPI ON KLASSINEN TUTKAVÄRI** (sininen–
  turkoosi–vihreä–keltainen–oranssi–punainen–pinkki, FMI:n summer-tyylin
  sävyin, peittävyys 0,80–0,88; käyttäjän päätös 4.10.). Se on sallittu
  VAIN koska sadetilassa ruudulla ei ole tuulen ramppia: lämpökartta ja
  partikkelit sammuvat ja aikajanan palkit ovat sadetta. Jos palkit joskus
  palaavat sadetilassa tuuleen, ramppi on palautettava kapeaksi (30.9. sini–
  violetti, dE-mittaus docs/ui.md "Sateen värit").
- **dBZ KÄÄNNETÄÄN MILLIMETREIKSI FMI:N OMISTA SELITTEISTÄ, ei
  Marshall–Palmerin kaavasta** (`Sade.DBZ_MMH`: 8 … 52 dBZ = 0,07 …
  63,13 mm/h, mitattu `suomi_dbz`- ja `suomi_rr`-selitteiden väreistä).
  Väliin interpoloidaan LOGARITMISESTI (lineaarinen antaisi 0,86:n ja
  2,16:n puoliväliin 1,51 kun oikea on 1,36). `Z = 303·R^1,5` on vain
  ristiintarkistus. Sama taulukko kääntää palvelimen vartti-dBZ:n
  (`SadeSarja`), joten käännöksiä on yksi.
- **MASKI ON VOIMAKKUUTTA, EI ALFAA.** Tavu on paletin normalisoitu
  paikka; väri JA peittävyys johdetaan siitä piirrettäessä. Valmis alfa
  hävittäisi voimakkuuden, ja ennustehila tarvitsisi oman käyränsä —
  kaksi käyrää samalle asialle. **Lähteen alfa on osa voimakkuutta**:
  FMI häivyttää tihkun itse indekseillä 1..19, ja erillisenä kertoimena
  mm/h-luku olisi väärä vaikka kuva näyttäisi oikealta.
- **SADEKERROS SEURAA AIKAJANAA, ja ankkuri on VALITTU HETKI.** Kehykset
  laskettiin ennen `Date.now()`:sta, jolloin sama sade näkyi joka
  tunnilla. Hetki luetaan AJASTA (`_tutkaHetki` → `_tlTimeAt` + vartti),
  ei indeksistä. FINRAD-arkisto on 14 vrk (PT5M) ja aikajanan menneisyys
  48 h; sen ulkopuolella kerros TYHJENEE ja sanoo sen. Luotain (`uusin()`)
  ajetaan kerran viidessä minuutissa.
- **RAJA ON TUOREIN TUTKAKEHYS ITSE: tutka ≤ kehys + 2,5 min,
  lähiennuste (nowcast) ≤ + 120 min, sitten ennuste** (`_tutkaLahde`,
  4.10., docs/sadetutka.md V5). Ennen raja oli aikajanan NYT-tikki
  lähimmällä tasatunnilla, koska kaksi aiempaa virhettä tulivat tunnin
  pyöristyksestä ("tuorein kehys + askel" putosi tutkan viiveen takia
  ennusteeseen klo 22:02, ja "kuluva tunti" unohti että NYT-tikki on
  puolenvälin jälkeen seuraava tunti). Nowcast täyttää juuri sen raon,
  ja raja on kehyksen aika eikä pyöristys, joten kumpikaan virhe ei
  toistu. ENNEN ENSIMMÄISTÄ LUOTAUSTA pätee vanha NYT-tikin sääntö, jotta
  NYT-tikki kysyy luotaimen eikä tuleva tunti silti vaadi sitä.
- **TYHJÄ TILA ON OMA LÄHTEENSÄ (`'tyhja'`), ei hilaton `'ennuste'`.**
  Muuten panorointi yrittäisi hakea ennustehilan menneelle tunnille joka
  on tutka-arkiston ulkopuolella — pyyntö johon lähde vastaa aina 400:lla.
- **LUOTAINTA EI AJETA ENNEN LÄHTEEN VALINTAA.** Tulevaisuuden tunti ei
  tarvitse tutkaa lainkaan, ja luotaimen epäonnistuessa "ei saatavilla"
  piilottaisi myös ennusteen — tutkan verkkovika veisi kerroksen jolla ei
  ole tutkan kanssa mitään tekemistä.
- **SILMUKKAA EI OLE, LIIKE ON AIKAJANAN TOISTO** (P8, 4.10.): 30 min
  silmukka levossa oli toinen aika ruudulla kuplan rinnalla. **Kun aikajana
  LIIKKUU (toisto, sormi nauhalla tai kiskolla), tutkan ja nowcastin
  jaksolla A ja B ovat VIEREKKÄISET 5 MIN KEHYKSET ja ne sekoitetaan
  LIIKEKOMPENSOITUNA** (`SadeKerros._kohde`, `SadeLiike`, varjostimen
  `u_fl`): kuuro liikkuu eikä häivy. Siirtymä on ≤ 5 min ja mitattu
  kahdesta havainnosta, joten se on interpolointia eikä keksittyä liikettä
  (mitattu: MAE 0,264 → 0,103 mm/h, CSI 0,57 → 0,88). HARMONIEn tunnit
  sekoitetaan voimakkuudessa ilman liikettä: tunnissa kuuro siirtyy
  30–50 km, ja siellä välikuva olisi arvaus. Toisto kulkee tutkan ja
  nowcastin jaksolla kolmasosanopeudella. Liike luetaan
  `_sadeNayttoHetki`stä ja päättyy 450 ms viimeisestä sijainnista. LIUKU
  EI OLE LIIKETTÄ (`liukuPerilla`): napautuksen valinta on kohteessa heti.
- **NOWCAST ON OMA ADVEKTIO SELAIMESSA** (`SadeLiike`, docs/sadetutka.md
  V5): kenttä lohkohaulla (T − 15, T) karkeista 32²-pienennöksistä,
  taaksepäin kulkeva siirtymä viiden minuutin askelin, lähtö tuoreimman
  kehyksen 256²-mosaiikista näkymän ja YHDEN LAATTARENKAAN yli
  (`GLRuudukko` `reuna`: renkaan laatat hakevat vain tuoreimman ja vartin
  takaisen kehyksen), sumennus 0,02 km/min, vaimennus 25 % / 2 h,
  sekoitus HARMONIEen painolla 1 → 0 välillä +30 … +120 min. Kehys
  lasketaan vain näkymälle +15 % ja muistissa on 8. Ensimmäiset 15 min
  tuorein tutkakehys täydellä tarkkuudella siirrettynä (`u_s`) — pikselin
  piirtää laatta jonka sisällä sen LÄHDE on (laajennettu nelikulmio),
  muuten laattarajalle jää sauma. Aikajana ja kapseli lukevat pisteen
  radan (`SadeLiike.arvo` → `Nowcast`), eivät kehyksiä; MET Norwayn
  pistesarja on varatie. Mitattu 60 min: FSS 1 mm/h 0,11 → 0,94
  pysyvyyteen nähden. Älä siirrä laskentaa palvelimelle tai Actionsiin:
  tutka päivittyy 5 min välein ja ajastin myöhästyy tunteja.
- **ENNUSTEHILA HAETAAN KERRAN KOKO RUUDULLE**, ei laattaa kohti, ja
  puolen näkymän reunuksella. Laattakohtainen haku olisi kaksitoista
  pyyntöä yhden hinnalla. Rivin leveysaste on `ymercInv`, sarakkeen
  pituusaste lineaarinen — molemmat lineaarisina kuuro liukuisi laatan
  sisällä pohjoiseen.
- **`api/sade.js`:n 400 EI OLE VERKKOVIKA.** Lähde vastaa 400:lla ja
  tyhjällä rungolla aina kun hetki on ajon ulkopuolella (mitattu +120 h
  ja −72 h), ja se on rajapinnan tavallisin vastaus: aikajana on 16,6
  vrk ja ennuste 61 h. Proxy kääntää sen `{error:'no data'}`:ksi
  HTTP 200:lla.
- **GRIB2:N E JA D OVAT ETUMERKKI-ITSEISARVOA**, eivät kahden
  komplementteja. `readInt16BE` luki E:n arvona −32735 kun oikea oli
  −33, ja koko kenttä (178 356 pistettä) skaalautui nollaksi. Jos hila
  näyttää olevan tasan nolla, epäile ensin tätä.
- **GRIBin yksikkö on kg m⁻² s⁻¹ ja kerroin 3600.** Tarkistettu
  pistekyselyä vasten: 0,005806 × 3600 = 20,90 ja `Precipitation1h` =
  20,9 samassa pisteessä samana tuntina. Muunnos tehdään proxyssä ja
  vain siellä.
- **`gridsize` LÄHETETÄÄN VAIN KUN SE HARVENTAA.** Mitattuna 64×64
  ylinäytteisti 72×36 hilan ja kasvatti vastauksen 8 279 → 12 979
  tavuun. Proxy leikkaa pyynnön mallin omaan tarkkuuteen.
- **Sadekerros (`SadeKerros`) piirtyy lämpökartan JÄLKEEN ja
  tavallisella alfasekoituksella**, koska lämpökartta summautuu
  pohjakarttaan (`ONE, ONE` = `plus-lighter`) eikä sade saa osallistua
  siihen summaan. Laattajoukon hallinta on `GLRuudukko`n (Leafletin
  `GridLayer`in osajoukko), mutta laatta EI ole enää canvas: kehys on
  8-bittinen VOIMAKKUUSTEKSTUURI (`Sade.v`-asteikko, LUMINANCE) ja väri
  syntyy varjostimessa lineaarisesti suodatetusta LUTista (indeksin 0
  väri = indeksin 1 väri alfalla 0, jottei reuna tummu). Ennustehila
  piirretään suoraan koko ruudun vetona hilatekstuurista, ei laattoina.
- **KAKSI KEHYSTÄ SEKOITETAAN VOIMAKKUUDESSA (`mix`), EI PÄÄLLEKKÄIN.**
  Kahden kuvan päällekkäinen piirto painoillaan tummuisi puolivälissä
  (0,85-alfa → 0,67). Saman lähteen kehykset (silmukka, tunnit,
  siirtymä) sekoitetaan aina varjostimessa; vain eri lähteet (tutka ↔
  ennuste NYT-tikillä, häivytys tyhjään) piirretään painoillaan.
- **PEHMENNYS ON KUUTIOLLINEN B-SPLINE (neljä bilineaarista hakua), JA
  TUTKA HAETAAN 512 px:N LAATTOINA ENINTÄÄN TASOLTA 9** (`tileSize: 512`,
  `maxNativeZoom: 9`, Leafletin asteikko, 153 m pikselillä; lähde 250 m).
  Laattoja on yhtä monta kuin 256 px:llä tasolta 8 (vanha 500 m lähde).
  Älä nosta kattoa tasolle 10: se nelinkertaistaisi pyynnöt ilman uutta
  dataa.
- **HYPPY ODOTTAA KUVAN VALMIIKSI JA HÄIVYTTÄÄ** (`_paata`: enintään
  2,5 s, häivytys 0,38 s). Ennen kerros tyhjeni (`redraw`) ja laatat
  syttyivät yksi kerrallaan. Puuttuva kehys ei tyhjennä laattaa: se
  näyttää viimeksi näytettyä kehystään (`el._viime`), ja ennustehila
  edellistä hilaansa (`_viimeEnnuste`).
- **TUTKAN KEHYSAIKA ON NIMENOMAINEN, EI `current`.** Se ratkaisee kaksi
  asiaa kerralla: silmukka tarvitsee tietyt hetket, ja nimetty aika on
  myös oikea välimuistiavain — lähde sanoo `max-age=86400` ja
  (laatta, kehys) -pari on muuttumaton, joten sama kehys ladataan kerran
  (mitattu: 3 latausta, 1 palvelinosuma). Aiempi `current` + 5 min nonce
  rikkoi välimuistin joka viides minuutti.
- **Kehyslistaa EI haeta `GetCapabilities`ista** (426 kB koko
  Radar-työtilalle). Kehykset ovat kiinteällä 5 min hilalla, joten
  riittää löytää TUOREIN ja laskea loput. Tuorein löytyy luotaamalla
  taaksepäin 1×1 GetMapilla: virheellinen aika palauttaa XML:ää eikä
  kuvaa, ja `Image`in `onerror` erottaa ne ilman jäsennystä. Luotain on
  1 107 B ja viive mitattuna alle 5 – noin 7 min eli 1–2 luotainta.
- **Esilataus on budjetti, ei kaikki kerralla**: levossa tutkan jaksolla
  ±1 h vartin välein, toistossa kolme askelta eteenpäin, ja laatalla on
  enintään kaksi latausta kerrallaan. Laatta on 512 px:nä 12–20 kB
  sateessa (mitattu 4.10.). `prefers-reduced-motion`: ei liukua eikä
  liikekompensaatiota (`_tlVahennaLiiketta`).
- **KARTAN KERROS ON NELJÄ RUUTUA ESIKATSELUKUVIN: TUULI, PUUSKA,
  AALLOT, SADE (BETA)** (`#layers`, Windyn valikon tapaan, käyttäjän pyyntö
  1.10.; "(beta)" omana pienempänä spaninaan 4.10.). Sade oli ennen kytkin "Havainnot kartalla" -ryhmässä; tila on
  yhä `_mapLayerState.tutka` (tallentuu `fs_tasot`iin), ja valittu ruutu
  luetaan kolmesta lipusta yhdessä paikassa (`_kerrosSirut`: sade >
  aallot > `State.activeLayer`). Kuvat piirtää `KerrosKuvat`
  SOVELLUKSEN OMILLA RAMPEILLA (`WindTexture.pikseliLUT`, `AaltoVari`,
  `Sade.lut`) keksityn rannikon päälle, joten ne näyttävät samat värit
  kuin kartta; lämpökartan voimakkuuden vaihto piirtää ne uudelleen.
  Valinta on mustekehys kuvan ympärillä, ei täyttö. Ruutu on yhä
  `.sp-chip` (radiogroup), ja nimi on omassa spanissaan (`data-en`).
  Sateen ja aaltojen asteikot ovat samassa kortissa ruutujen alla.
- **Kehyksen aikaleima ei ole valinnainen.** Liikkuva kuva ilman kelloa
  ei kerro mitä hetkeä katsoo. Se on samalla rivillä lähdemerkinnän
  kanssa mutta vastakkaisessa reunassa — yksi rivi ylempänä se jäi
  aikajanan kortin taakse (mitattu: leima y 825–833, kortti alkaa
  y 756). `aria-live` on POIS: toisto vaihtaa tekstin viidesti
  sekunnissa. Sadetilassa myös kupla sanoo lähteen (Havainto /
  Lähiennuste / Ennuste, `.tl-kupla-laji`), ja kapseli näyttää sateen
  intensiteetin keskipisteessä (`Crosshair._sadeUpdate`) — pysyvää
  väriliuskaa kartalle ei tule.
- **SADETILA ON KOKO MAAILMAN, JA LÄHDE ON PARAS PAIKALLINEN** (4.10.,
  beta, docs/sadetutka.md luku 11): tutka ja nowcast tutkan katteessa
  (`TutkaKate`, asemista laskettu 250 km — WMS:n läpinäkyvyys ei erota
  katetta poudasta), HARMONIE MEPS-alueella (`puuttuva=1` → 65535 alueen
  ulkopuolella, kate `Sadeennuste._maski` 50 km:n reunalla), ECMWF 9 km
  muualla, menneillä tunneilla ja HARMONIEn jälkeen. Varjostin sekoittaa
  HARMONIEn ja ECMWF:n samassa vedossa katteen painolla, ja tutkan
  hetkillä malli piirretään katteen ulkopuolelle taustaksi
  (`_piirraTausta`). ECMWF haetaan vain kun HARMONIE ei kata näkymää.
  Tutkalaatat vain katteen rajauksesta (`_laattaOk`). Sadetilassa tuulen
  lähdemerkintä on piilossa ja leima sanoo mallin. Jos muutat katetta,
  muuta `TutkaKate` (yksi paikka: varjostin, laatat, sarja, kapseli).
- **SADE JATKUU ECMWF 9 km:LLÄ HARMONIEN JÄLKEEN** (V6,
  `api/malli.js?muuttuja=sade`, pisteen sarja `tila=sarja&muuttuja=sade`):
  tiedoston arvo on mallin askeleen kertymä (1/3/6 h), joten intensiteetti
  = kertymä / askeleen tunnit. Leima sanoo "ECMWF 9 km, karkea". ECMWF
  0,25° on yhä hylätty (kolme solua ruudulle).
- **Tutkan muste luetaan `Asetukset.paperi()`:sta**, samasta
  kysymyksestä kuin lämpökartan sekoitustila. Jos pohjakartta vaihtuu,
  kerros on piirrettävä uudelleen — mikään ei tee sitä itsestään.
- **Puuskasuhde jää POIS kun puuskaa ei ole.** `gst` putoaa silloin
  `ms`:ään ja suhde olisi tasan 1,00 eli väite tasaisesta tuulesta
  siellä missä dataa ei ole. Ehto lukee `h.windgusts_10m[idx]` suoraan,
  ei `gst`:tä. Suhde lasketaan SARJAN SISÄLLÄ; varaston puuska ei kelpaa
  (se on joka toisella askeleella tuuli, jolloin suhde on 1,00).

**Uudet lähteet — mitattu ja hylätty** (perustelut `docs/lisadata.md`)

- **`fmi::forecast::meps` JA `fmi::forecast::harmonie` OVAT SAMA DATA.**
  Mitattu kahdessa paikassa: ero max 0,000 m/s 48 h ja 36 h yli. MEPS on
  MetCoOpin malli ja FMI:n harmonie-kysely tarjoillaan siitä. Älä lisää
  sitä "toiseksi malliksi" mallien erimielisyyteen — erimielisyys näyttäisi
  pysyvästi nollaa. Sama koskee peilin `metno_nordic_pp`:tä (jälkiprosessoitu
  MEPS).
- **AALLOT EIVÄT TULE LAATTAPUTKESTA.** `s3://openmeteo`-peilin
  `ecmwf_wam025` on houkutteleva (sama 721×1440 hila, sama `.om`-muoto,
  ei kiintiötä) mutta 0,25° on Suomenlahdella kolme solmua: mitattuna
  **3/12 spottia**, ja lähin märkä solmu Helsingin spoteille on 17–24 km
  ulkomerellä. FMI:n WAM-pistekysely antaa 9/12. Ulkomeren lukema spotin
  kohdalla olisi väärä luku joka ei näytä väärältä.
- **VEDENKORKEUDEN HAVAINTO ON mm, ENNUSTE ON cm.** Vastaus-XML ei kerro
  yksikköä lainkaan (`uom` puuttuu), ja molemmat palauttavat
  kolminumeroisia kelvollisen näköisiä lukuja. Tarkistus: havainto
  10:00Z = 286, ennuste 11:00Z = 29,0 — sarja on jatkuva vasta kun
  havainto jaetaan kymmenellä.
- **Ensemble-tuulta EI ole S3-peilissä.** `ecmwf_ifs025_ensemble` ja
  `ncep_gefs025` sisältävät peilissä vain `precipitation_probability`.
  Hajonta vaatii `ensemble-api.open-meteo.com`:n eli uuden kiintiön —
  siis kytkimen taakse kuten aaltoennuste.
- **FMI hydrodyn ei kata rannikkoa.** Meriveden lämpötila ja virtaus
  ennusteena: mitattuna **2/12 spottia**, ja virtaus 0,0–0,1 m/s eli
  mittaustarkkuuden rajoilla. Vedenlämpö tulee mareografien
  `TW`-kentästä, joka tulee samassa vastauksessa kuin vedenkorkeus.
- **Digitraffic vaatii `Accept-Encoding: gzip`in.** Ilman sitä 406 ja
  runko sanoo sen ääneen. Sama luokka kuin Larun User-Agent.
- **Vuorovettä ei ole.** Itämeri on vuorovedetön; vedenkorkeus ajaa
  tuulesta ja paineesta. Vuorovesirivi olisi väärä sana oikealle luvulle.

**Mellsten (Surfing ry, Haukilahti)**

- **Keskituuli on rivin KOLMAS luku** (`min < ka < max`), puuska on
  maksimi. Ensimmäinen on minuutin minimi.
- **Aikaleimassa on vain kellonaika, ja se on Suomen aikaa. PÄIVÄYS
  TULEE ANKKURISTA, EI NYKYHETKESTÄ** (`api/_mellsten.js`):
  `weather.txt`:lle HTTP:n `Last-Modified`, arkistolle tiedoston
  otsikkorivi (luontihetki PDT:nä). Nykyhetkestä laskettuna sammuneen
  aseman viimeiset rivit päätyivät väärälle päivälle. Vyöhykepoikkeama
  pyöristetään täysiin minuutteihin, muuten millisekunnit valuvat
  aikaleimoihin.
- **ARKISTON NIMI EI OLE HELSINGIN PÄIVÄ.** Palvelin nimeää PDT-
  kalenterinsa mukaan: `Day-26-09-27` on Helsingin 28.9. (tarkistettu
  Windgurua vasten), ja katkon jälkeen klo 10 jälkeen käynnistynyt
  istunto saa päivän D nimen — jonka keskiyöllä alkava seuraava istunto
  kirjoittaa yli (10.9. klo 11:40–23:59 puuttuu arkistosta). Lue päivä
  otsikkoriviltä, älä nimestä.
- **HISTORIA TULEE OMASTA VARASTOSTA, KUTEN WINDGURULLA** (käyttäjän
  pyyntö 29.9.). Lähde antaa kuluvalta päivältä tekstinä vain 30 min,
  joten keräin (`tools/havainnot.mjs`) tallettaa lähteen rivit haaraan
  `havainnot` ja täydentää päättyneet päivät lähteen arkistosta
  (arkiston rivi voittaa kerätyn). Merkki pyytää 48 h (`HAV_KARTTA_H`)
  ja seuraa aikajanaa, asemakortti 168 h, spottikortti 48 h. Mitattu Windgurua
  vasten 28 vrk: ero 0,37 kts, harha 0,000, tunnin siirto 1,5 kts ja
  vuorokauden 4,3 kts.
- **PROXY EI LUOTA KERÄIMEEN** (käyttäjän raportti 29.9.: "apissa on
  katkoksia vaikka Windgurulla on koko päivä"). Järjestys heikoimmasta
  vahvimpaan: lähteen 4 h kuvaaja joka haulla, varasto, lähteen arkisto
  päättyneille päiville joita `tila.json` ei merkitse `arkisto`ksi
  (Helsingin päivä D on nimellä D−1 tai D; valmis 6 h muistissa, 6 s
  budjetti), `weather.txt`. Ennen proxy ei hakenut arkistoa ollenkaan,
  jolloin ajamaton keräin jätti myös menneet päivät vajaiksi. Lähteeseen
  peräkkäin, ja jos `weather.txt` ei vastaa, muuta ei yritetä.
- **KUVAAJA (`plot.gif`) ON NELJÄN TUNNIN MINUUTTISARJA, EI ARVAUS**
  (docs/data.md "Katkot pois"). Lähteen oma asteikko: 240 × 200 px,
  sarake = minuutti, y = 199 − 10·v (0,1 m/s), palkki min..max, valkoinen
  piste keskituuli, suunta = (240 − HSV-sävy) mod 360, tuntimerkit
  riveillä 0–1. Mitattu yhdeksästä kuvasta 968/968 tunnettua
  minuuttia: keskituuli, maksimi ja minimi TASAN samat kuin lähteen
  rivit, suunta ±1°, Windgurua vasten yhtä hyvä kuin tekstirivi. SE
  LUETAAN VAIN TARKISTETTUNA: tuntimerkit
  tasatunneille ja saman haun `weather.txt` täsmää (90 %, ≥ 10 min),
  muuten koko kuva hylätään, ja ilman Last-Modifiedia kuvaa ei lueta
  lainkaan. Minimi alle 0,8 m/s ja maksimi yli 19 m/s ovat `?`, eikä
  lämpötilaa ole. Sade on sininen jakso YLHÄÄLTÄ (32,32,255) eikä
  palkkia; sama väri muualla on pohjoistuulta. Varastossa rivin loppusana on
  `kuvaaja`; TEKSTIRIVI VOITTAA KUVAAJARIVIN, arkisto molemmat, eikä
  kuvaajarivi korvaa koskaan mitään.
- **NOLLARIVI `0° 0.0 < 0.0 < 0.0` ON TYYNI** (naapurit 0,5–0,9 m/s,
  28.9. 150 kpl), joskus katko (29.9. 15:03–15:05 kesken 5 m/s). Lähde ei
  erota niitä, ja sen kuvaaja piirtää ne samoin; älä poista nollarivejä
  "katkoina".
- **TYÖNKULKU NOUTAA VARASTON ENNEN PAKKOPÄIVITYSTÄ, JA TYHJÄSTÄ VAIN
  KUN HAARAA EI OLE** (`ls-remote --exit-code` = 2). Hiljaa
  epäonnistunut nouto pyyhkisi kuluvan päivän kerätyt rivit — ne joita
  lähteessä ei ole missään.
- **Varasto on vaihtoehtoinen, ei pakollinen.** Jos se ei vastaa (tai
  haaraa ei vielä ole), proxy palauttaa lähteen kuvaajan 4 h ja
  menneet päivät arkistosta (mitattu tyhjällä varastolla: 168 h
  kokonaan, 5 arkistohakua 0,58 s, muistista 0,15 s); nipun leveys
  (5 min) valitaan datan kestosta eikä pyydetyistä tunneista.
- **GITHUBIN AJASTIN EI RIITÄ KERUUSEEN — ÄLÄ OLETA ETTÄ SE AJAA.**
  Havainnot-ajastin ei käynnistänyt kuuteen tuntiin yhtään ajoa (~36
  vuoroa, työnkulku `active`, ei GitHubin häiriötä), työnkulkutiedoston
  päivityksen jälkeen se laukesi KERRAN ja vaikeni taas, ja säädata-
  ajastimesta ajettiin 12/14 vuoroa 20 min – 5 h 40 min myöhässä.
  Kuvaajan ansiosta ajovälin pitää olla alle NELJÄ TUNTIA (ei 30 min),
  ja herättimiä on kolme: ajastin, Säädatan perään (`workflow_run`) ja
  AJASTINKETJU (`tools/ajastin.mjs`), joka tarvitsee ympäristön
  `ajastin` odotusajastimen (Settings → Environments, esim. 20 min).
  Ulkoinen `workflow_dispatch` (cron-job.org) toimii yhä. Kun tarkistat
  keruuta, lue varaston `mellsten/tila.json`in `paivitetty` ja ajojen
  `event`: käsiajo (`workflow_dispatch` ilman `lenkki`ä) ei todista
  ajastimesta mitään. Älä korvaa herätintä jatkuvasti pyörivällä
  Actions-ajolla (GitHubin ehdot) — ketjun odotus on ympäristön
  ajastimessa ILMAN konetta.
- **SÄÄDATAN VARSINAINEN HERÄTIN ON HAVAINNOT-AJON ASKEL
  (`tools/saaherate.mjs`, docs/oikeellisuus.md O1).** Säädatan ajastin
  myöhästyi 22.–29.9. mediaanina 3,7 h (enintään 5,7 h), ja varasto oli
  FMI:stä 1–3 ajoa jäljessä. Askel luotaa FMI:n tuoreimman ajon
  (`harmonieAjot`) ja lähettää Säädatan kun FMI on varastoa edellä tai
  varasto on yli 6 h vanha. Portit: varasto vähintään 2,5 h vanha,
  Säädataa ei jonossa tai käynnissä, eikä yhtään Säädata-ajoa (myöskään
  epäonnistunutta) luotu viimeisen 2 h aikana. Säädata on
  `cancel-in-progress: false`: päällekkäinen ajastin ei saa perua melkein
  valmista rakennusta. Jos muutat portteja, testaa yhdeksän tilannetta
  valerajapintaa vasten kuten ajastinketjussa.
- **JATKUVA VARMENNUS ON HAVAINNOT-AJON ASKEL (`tools/varmennus.mjs`,
  O11).** Uuden varaston ennuste arkistoidaan rekisterin asemille
  (`havainnot`-haara, `varmennus/ennusteet/`, 0–72 h, 4 vrk) ja
  verrataan tunnin välein FMI:n havaintoihin: harha, MAE, suunta ja
  puuska perheittäin, iän ja asematyypin mukaan (`varmennus/tulos.json`,
  hälytykset ajon yhteenvetoon). Näytteistys ja Paras-sekoitus ovat
  samat kuin `Saalaatat._naytePerhe` / `naytteista`; jos muutat
  asiakkaan sekoitusta, muuta tätä samassa muutoksessa.
- **AJASTINKETJU EI SAA KARATA.** Kolme porttia `tools/ajastin.mjs`:ssä:
  ei lenkkiä ilman vähintään 5 min odotusajastinta (luettu
  rajapinnasta), lenkki joka ei odottanut (`lenkki`-syöte = lähetyshetki)
  pysäyttää ketjun, ja jos havainnot-ajo on jo jonossa, odottamassa tai
  käynnissä, uutta ei lähetetä. Jos muutat ketjua, testaa kaikki
  yhdeksän tilannetta valerajapintaa vasten (docs/data.md) — virhe
  tässä on ajo minuutin välein.
- **Sijainti 60,147 / 24,794 on Windyn PWS-tietueesta**, ei arvattu —
  sama tietue palautti samat lukemat samalla hetkellä.

**Laru (dlarah.org, Lauttasaari)**

- **Lähde vaatii User-Agentin.** Ilman sitä 403, sen kanssa 200,
  toistettavasti — Noden `https.get` ei lähetä sellaista oletuksena.
  Eri asia kuin Mellstenin kertaluonteinen 403: siellä uusinta auttaa,
  täällä pyyntö ei onnistu koskaan ilman otsaketta.
- **Asemalla EI OLE lämpömittaria.** Lämpötilasarake on 0,0 kaikilla
  474 rivillä ja Windguru antaa samalle asemalle `temperature: null`.
  Proxy palauttaa `tmp: null, lampomittari: false`, ja kortti jättää
  lämpötilaruudun pois kun lippu on `false`. Älä muuta sitä viivaksi —
  viiva tarkoittaa "ei juuri nyt", ja FMI-asemilla se on yhä oikea
  (lippu on `false` eikä puuttuva juuri siksi).
- **Lukemat ovat m/s.** Varmistettu Windgurun asematietuetta 47 vasten:
  suhde 1,94–2,07 (Windguru solmuja) ja suunta 173,9° vs 173,5° kahden
  minuutin sisällä. Sijainti 60,150824 / 24,87184 tulee samasta
  tietueesta, ei arvattu.
- **HISTORIA ON 168 h: KULUVA PÄIVÄ LÄHTEESTÄ, PÄÄTTYNEET VARASTOSTA
  TAI LÄHTEESTÄ** (käyttäjän pyyntö 29.9., docs/data.md "Larun
  historia"). Ennen proxy antoi vain kuluvan vuorokauden. Lähde pitää
  itse kaikki päivät vuosien takaa (`Laru_<vuosi>-<vuodenpäivä>.txt`,
  S3), joten varasto (`tools/laru.mjs`, `laru/YYYY-MM-DD.txt`) on
  VÄLIMUISTI JA VARMUUSKOPIO eikä historian ainoa lähde kuten
  Mellstenillä — puuttuva päivä haetaan lähteestä, ja ajastimen
  viive vain siirtää kopiointia. Merkki pyytää 48 h (aikajanan
  menneisyys, `HAV_KARTTA_H`), asemakortti 168 h, spottikortti 48 h. Mitattu Windgurun
  asemaa 47 vasten 7,6 vrk: ero 0,42 kts, harha −0,002 kts, tunnin
  siirto 1,3 kts ja vuorokauden 5,1–5,5 kts.
- **VARASTOSSA ON VAIN VALMIITA PÄIVIÄ.** Keräin kopioi päivän vasta
  puoli tuntia keskiyön jälkeen eikä koskaan kuluvaa päivää, ja proxy
  luottaa siihen: varastossa oleva päivä on koko päivä, puuttuva
  haetaan lähteestä. Kesken kopioitu päivä näyttäisi proxylle
  valmiilta, ja koska GitHubin ajastin jättää tunteja väliin, sen loppu
  jäisi kortille katkoksi. Älä lisää kuluvan päivän kopiota samaan
  hakemistoon.
- **RIVIN PÄIVÄ ON RIVILLÄ, EI TIEDOSTON NIMESSÄ.** Päivätiedoston
  ensimmäinen rivi voi olla edellisen päivän 23:59 (kirjoitettu 00:01).
  `jasennaLaru` (`api/_laru.js`) päivää rivit omista kentistään kuten
  lähteen oma `parseData`, ja proxy yhdistää päivät minuutin mukaan.
- **Keräin on OMA ASKELEENSA** (`continue-on-error`, `timeout-minutes:
  3`, sisäinen 120 s budjetti): Larun vika ei saa estää Mellstenin
  rivien julkaisua samassa ajossa.
- **TUOREIN LUKEMA ON 10 MIN JAKSO, JA SARJAN VIIMEINEN PISTE ON SAMA
  LUKEMA** (`kymmenenMinuuttia`, api/_varasto.js; docs/oikeellisuus.md
  O10). Larun rivi on noin 1,7 min ja Mellstenin minuutti, ja yksittäinen
  rivi heiluu 10 min keskiarvon ympärillä p10–p90 −0,43 … +0,45 m/s;
  FMI-asemien ja ennusteen lukema on 10 min keskiarvo. `latest` on
  tuoreimpaan riviin päättyvä 10 min jakso (keskiarvo, puuskan maksimi,
  suunta yksikkövektoreista), ja se korvaa sarjan viimeisen pisteen —
  muuten kaavion pää ja kortin päälukema olisivat eri luvut samasta
  hetkestä. Kaavion minuuttirivit eivät muutu.

**Kenttä ja data**

- **SPOTTIKORTTI JA SPOTTIMERKIT LUKEVAT SAMAA SEKOITUSTA KUIN KARTTA**
  (`KorttiSarjat`, "Paras"). Ennen sovelluksessa oli kaksi datatasoa:
  kartta ja aikajana varastosta, kortit ja merkit spotin omasta
  HARMONIE → Open-Meteo -sarjasta, ja ne antoivat eri luvun (mitattu
  3 893 vertailulla ka 1,38 m/s ennen MET Nordicia; spotissa 48 h
  ennen tätä muutosta 0,51–0,96 m/s ja 46–73 % tunneista yli 0,5 m/s).
  Nyt Paras on `Saalaatat.wxTunneittain(lat, lng, 0.05, { perheet:
  ['fmi','metnordic'], dyn: spotin ECMWF 9 km -sarja })`: kortin ja
  aikajanan ero spotissa on mitattuna 0,0000 m/s viidessä spotissa, ja
  merkki ja sen kortti näyttävät saman indeksin (ennen 82 vs 46).
  `spot.wx` on yhä olemassa: se on varatie (varasto rikki, Paras
  matkalla) ja sää-rivien lähde (sade mm/h, lämpötila, pilvet), joita
  varastossa ei ole. Lähimmän pisteen muut käytöt lukevat yhä sitä;
  ennustepaneeli luki sitäkin ja antoi siksi eri luvun kuin kortti
  (docs/julkaisu.md, L5) — nyt se lukee Parasta.
- **KELIN KYNNYKSET OVAT YHDESSÄ TAULUKOSSA (`Keli`), JA INDEKSI ON
  0–100.** Samaa päätöstä teki viisi taulukkoa, ja ne olivat eri mieltä
  (merkki "Tyyni" alle 4 m/s, selite alle 2; "Liian kova" 18 vs 22;
  kolme puuskarajaa). Nyt 2 / 4 / 6 / 8 / 13 / 18 m/s ja puuska 1,25 /
  1,6, ja foil-merkki, indeksin nopeuskäyrä, puuskasana ja -rangaistus,
  kaavion foilausraja ja kelihyppy lukevat kaikki sitä. "Hyvä" alkaa
  8:sta, jotta kelihyppy vie aina tuntiin jota merkki kutsuu hyväksi.
  Indeksin katto oli oikeasti 90 (60 nopeus + 30 suunta);
  `INDEKSI_SKAALA` venyttää osat 67 + 33:een, jotta "N / 100" ja osien
  summa täsmäävät. Älä kirjoita kynnystä käyttöpaikkaan.
- **AIKAJANA LUKEE VARASTOA, ei lähintä ennustepistettä**
  (`aikajananLahde`). Valinta tehtiin YHTENÄISYYDEN perusteella, ei
  tarkkuuden — älä purkaa sitä tarkkuudella ilman uutta mittausta.
  Mitattu jälkeen: aikajana on varaston sarja (4 764 vertailua, max ero
  0,000000). Kapselia vasten jää 0,24 m/s (max 0,73), ja se on
  INTERPOLOINTI eikä data: kapseli on bikuubinen solmuhila, aikajana
  bilineaarinen laattanäyte.
- **AIKAJANAN INDEKSI EI OLE SPOTIN INDEKSI.** Akselit eivät ala
  samasta hetkestä. Merkit lukevat spotin lukeman `_spotLukema`sta
  (Paras AJASTA, varatie `_spotIdx`), `openSheet` valitusta hetkestä
  (`State.valittuMs`). Älä siirrä indeksiä sellaisenaan.
- **Kumpi taso on tarkempi EI OLE RATKAISTU.** Viiden asemaparin
  otoksesta vedettiin kerran johtopäätös "aikajana on tarkempi"; 48 h
  otos käänsi järjestyksen, ja siinäkin aikajanan otos oli vain 30
  paria (spottisarjan menneisyys kattaa ~6 h). Molemmilla oli sama
  systemaattinen harha −1,79 m/s havaintoa vasten — MUTTA SE MITATTIIN
  PELKÄN ECMWF-VARASTON AIKAAN. Nykyvarasto 28 asemalla 29.9.
  (n = 441): FMI +0,02 / MAE 0,94, MET Nordic +0,06 / 0,96, ECMWF 0,25°
  +0,13 / 1,12 m/s (docs/oikeellisuus.md). Mallien järjestys ratkeaa
  jatkuvasta varmennuksesta (`varmennus/tulos.json`, O11) eikä
  yksittäisestä päivästä; älä perustele tasojen valintaa tarkkuudella
  ilman sitä.
- **`WindTexture.hila` on kokonaan varastosta, eivätkä spotit ole
  siinä.** Kun se on olemassa, kaikki tähtäimen alla oleva luku tulee
  varastosta riippumatta siitä kuinka lähellä spotti on (mitattu 0,2 km
  päässä olevan spotin vaikutus lukemaan: ei mitään).
- **VARASTON ECMWF-PUUSKA EI OLE TUNNIN PUUSKA — FMI:N JA MET NORDICIN
  ON.** ECMWF:n puuska on 3 h (+3 … +90 h) tai 6 h maksimi (+150 h →),
  suhde 1,4–1,9, ja S3:n tiedostoista se puuttuu analyysihetkeltä ja
  välillä +93 … +144 h KAIKISSA ajoissa (mitattu 29.9. neljästä
  ajosta). Rakentaja täyttää nyt analyysihetken edellisen ajon +6 h:sta
  ja välin +93 … +144 h puuska/tuuli-suhteena aukon reunoilta
  (`taytaPuuskaAukot`, luettelon `puuskaArvio`; O8), joten "Puuska"-
  kerros ei enää vilku eikä näytä tuulta puuskana. FMI:n ja MET
  Nordicin tasoilla puuska on tunnin puuska samasta ajosta kuin tuuli
  (harha +0,21 / +0,32 m/s havaitun tunnin maksimia vasten), ja
  **KAPSELIN PUUSKA LUETAAN AINA VARASTOSTA SAMASTA NÄYTTEESTÄ KUIN
  TUULI kun kartta lukee varastoa** (`_puuskaVarastosta`, 1.10.). Ehto
  oli ennen "kokonaan FMI:tä tai MET Nordicia", ja muualla puuska tuli
  lähimmästä spotista 15 km:n sisältä — FMI:n jakson jälkeen se oli
  Helsingin edustalla sama Lauttasaaren luku joka kohdassa eikä
  muuttunut karttaa siirrettäessä (käyttäjän raportti). ECMWF:n 3 h
  maksimi kelpaa: varmennus (O11, n = 4 845, 0–48 h) antaa harhan
  +0,04 m/s havaitun tunnin maksimia vasten (FMI −0,30), suhteen
  mediaani +150 h:iin 1,41–1,50. **6 H MAKSIMI EI KELPAA** (suhde 1,78):
  kun ECMWF:n osuus on yli 1 % ja varaston akselin askel yli 3 h,
  riviä ei ole. Rajapintapiste (`_puuskaPiste`, 15 km) on vain kun
  kartta ei lue varastoa. **Rakentaja lainaa puuskan vain enintään
  12 h vanhemmalta ajolta sen omalta +0 … +90 h:lta**
  (`rakennaAikaAkseli`, `varat`): rajaton laina täytti aukon +93 …
  +144 h päivien vanhan ajon 6 h maksimilla, ja puuska oli kolmella
  hetkellä seitsemästä tuulta pienempi (+109 h: tuuli 11,0, puuska 8,8).
- **Lähdemerkintä on VIIDES `_spotIdx`-paikka.** `Lahde.paivita` teki
  `State.currentHourIdx >= pt.wx.harmonie_hours`, eli vertasi aikajanan
  akselia (403 tikkiä, 16,6 vrk) pisteen oman akselin ensimmäisiin
  tunteihin (~52). Tikki 100 on aina >= 52, joten merkintä sanoi
  "Open-Meteo" vaikka 478 pistettä 516:sta oli FMI:tä. Vika oli
  piilossa niin kauan kuin varasto oikosulki koko haaran — mallin
  pakotus toi sen näkyviin.
- **Kapselin puuska on NELJÄS `_spotIdx`-paikka.** `Crosshair._puuska`
  siirsi `State.currentHourIdx`:n sellaisenaan aikajanan akselilta
  rajapintapisteen akselille: mitattuna indeksi 52 oli varastossa
  2026-09-08T10:00 ja rajapintapisteessä 2026-09-10T10:00 eli **48 h
  sivussa**, ja kahdessa paikassa seitsemästä väärän tunnin puuska
  hylättiin liian pieneksi jolloin koko rivi katosi. Vertailu
  "puuska yli 5 % keskituulesta" tehdään SARJAN SISÄLLÄ, ei kapselin
  bikuubista varastonäytettä vastaan — varastopolulla saman näytteen
  tuulta vastaan.
- **Lähdemerkintä kertoo TÄHTÄIMEN lukeman lähteen.** Se luki ennen
  lähimmän ennustepisteen lähteen ja sanoi siksi Helsingissä HARMONIE
  vaikka luku tuli varastosta. Jos muutat kumpaakaan polkua, tarkista
  että merkintä seuraa sitä polkua josta luku oikeasti tulee.
- **LÄHTEEN NIMI ON YHDESSÄ REKISTERISSÄ: `Lahde.NIMET` (pitkä, kartan
  merkintä) ja `Lahde.LYHYET` (kaavion selite ja työkaluvihje).**
  Spottikortin kaaviolla oli oma `modelNames`-taulukko, ja se ajautui
  niin kauas erilleen että selite väitti pääviivasta "Auto" vaikka data
  oli FMI:n HARMONIEa — `State.activeModel` on pysyvästi
  `'best_match'`, koska mallia ei valita enää käsin.
- **FMI:N JA OPEN-METEON RAJA LUETAAN `harmonie_hours`ISTA, JA SE ON
  INDEKSI EIKÄ KESTO** — varatiellä, kun kortti lukee `spot.wx`:ää.
  Raja on `time[hh]`, ei "nyt + 48 h" (sarja voi olla levyltä
  palautettu). `harmonie_hours === 0` = ei FMI:tä.
- **KORTIN KAAVIO KERTOO LÄHTEEN TUNNEITTAIN, EI SELITTEESSÄ.**
  Lähdekaista kaavion yläreunassa jakaa jakson sen mukaan kenen
  osuus sekoituksessa on suurin (`hourly.lahde`, `Lahde.LYHYET`), ja
  lukemarivi nimeää osoitetun tunnin lähteen. Vertailumalli loppuu
  näkyvästi ("ICON päättyy") eikä jatku hiljaa toisena mallina.
  **LÄHDEKAISTA ON TARTTUVA HTML-RIVI** (V16, `.ak-lahteet`, sama
  rakenne kuin päiväotsikolla): jakso on laatikko ja nimi `sticky`,
  joten nimi näkyy kerran ja koko jakson ajan; raja on SVG:n viiva.
  SVG:ssä nimi toistettiin joka keskiyönä, ja reunaan osunut toisto
  jäi puoliksi akselin alle. Kapeassa jaksossa ajo jää pois ja sitten
  nimi.

- **Interpolointijärjestys: paikassa vektorit, ajassa nopeus ja suunta
  erikseen.** Suuntien aritmeettinen keskiarvo hyppää väärään suuntaan 0/360
  rajalla; vektorien interpolointi ajassa tekee vastakkaisten tuntien väliin
  keinotekoisen tyvenen. Molemmat on mitattu.
- **Kaikki aikasarjat pyydetään selaimen omassa vyöhykkeessä** (`AIKAVYOHYKE`).
  `timezone=auto` antaa jokaiselle pisteelle oman kellon ilman että
  merkkijonossa on vyöhykettä — kenttä hajoaa leveillä näkymillä.
- **Piste joka ei kata pyydettyä hetkeä jätetään pois kentästä**, ei kiinnitetä
  sarjansa päähän.
- **PALUU TAUSTALTA ON UUDELLEENLATAUS, EI OSIEN PÄIVITYS** (`Paluu`,
  docs/julkaisu.md L7). ≥ 30 min taustalla → sivu ladataan uudelleen,
  näkymä ja auki ollut spotti säilyvät (sessionStorage) mutta aika
  palaa nykyhetkeen; 5–30 min → nyt-valinta siirtyy uuteen
  nyt-tuntiin (käyttäjän itse valitsemaa tuntia ei siirretä) ja
  havaintomerkit haetaan uudelleen (`_havPaivita`, joka ajaa muuten
  10 min välein etualalla). Osien päivitys paikallaan olisi viisi polkua
  (luettelo, havainnot, ennuste, nykyhetki, kortti), joista jokainen
  voisi jäädä vanhaan — havainnot ovat poikkeus, koska niillä on yksi
  latausfunktioiden lista (`_havPaivittajat`).
- **SELAIMEN VIRHEET MENEVÄT `/api/virhe`:en** (`VirheRaportti`,
  `sendBeacon`): viesti, pinon alku, versio, polku — ei sijaintia eikä
  koordinaatteja, ja Tietoa-näkymän tietosuojateksti sanoo saman. Jos
  lisäät kenttiä, päivitä molemmat.
- **`/api` ei kuulu service workerin välimuistiin.** Sovelluksella on oma
  ennustevälimuisti joka osaa merkitä datan vanhaksi. Säälaatat ovat eri asia:
  ne ovat muuttumattomia ja versioituja (`?v=<luotu>`, rakennushetki;
  ks. "LAATTOJEN VERSIOAVAIN ON RAKENNUSHETKI").

**Partikkelit**

- **LIIKE ON AJASTA, EI RUUDUISTA** (`partikkelitAskel`, `f` = kulunut
  aika 60 Hz:n ruutuina, katto 50 ms). Ruutukohtainen askel teki
  120 Hz:n näytöstä kaksi kertaa nopeamman ja näytti jokaisen
  ruutunopeuden muutoksen nopeutena (mm. hypyn jälkeen). Jälki talletetaan
  kellosta (`ASKEL_MS`). Mitattu: matka ≈ 60 askelta/s fps:stä
  riippumatta, vanha = fps (docs/partikkelit.md, "Liike ajasta").
  **NOPEUS 0.0033 JA JÄLKI 39 PISTETTÄ** (käyttäjän pyyntö 28.9.):
  GEO_SPEED ja aikapituus muutetaan AINA yhdessä, muuten heikon tuulen
  jälki lyhenee pilkuksi. **NOPEUSLUOKKA ON LIUKULUKU**: kokonaislukuna
  väri ja leveys hyppäsivät luokkarajalla (0,30/s partikkelia kohti).
  **AIKA PYÖRISTETÄÄN NÄYTÖN RUUTUVÄLIIN** (`PerfTracker.valiMs()`):
  raaka `performance.now()` piirtohetkellä heilui, ja kärjen askel
  vaihteli ruudusta toiseen 16 % (p90 35 %) — se luki epätarkkuutena.
- **JÄLJEN PÄÄ LEIKATAAN KAARESTA, EI PISTEMÄÄRÄSTÄ** (`nauha`, `p.pit`,
  `NAUHA_N`). Kokonaisina pisteinä pää seisoi 70 % ruuduista ja hyppäsi
  sitten — se oli pyrstön välkyntä. Syntymä ja kuolema häivytetään
  (`_pAlfa`); satunnaista pudotusta (`DROP_RATE`) ei ole, koska se
  pysäytti partikkelin ruuduksi.
- **JÄLJEN PITUUSRAJA ON 19 px (`JalkiViritys.maxPx`), EI 64.** 26 → 22 → 19
  käyttäjän pyynnöstä 28.9. (hieman pilkkurajan alla, käyttäjän arvio), ja
  aikapituus samassa suhteessa (JALKI 45 → 39). Jäljet
  lukivat pitkinä valojuovina; pyydetty ilme on Windyn lyhyt viiva.
  Pyyhkäisy samassa pisteessä (3,8 m/s keskituuli, 80 hiukkasta):

  ```
  maxPx    64     40     30     24     18
  med px  50,9   41,1   29,9   25,2   17,7
  p90 px  70,4   49,1   35,2   28,5   19,5
  peitto%  1,54   1,41   1,17   1,03   0,70
  ```

  Alaraja on talon oma mittaus: **alle 20 px jälki lukee pilkkuna**, joten
  18 olisi vienyt mediaanin sen alle. 26 antaa mitattuna mediaanin 26 px
  ja p90:n 27 px, eli noin puolet entisestä, ja koko jakauma jää
  pilkkurajan yläpuolelle. Muste puolittui (1,54 → 0,66 %) — se on
  lyhyemmän jäljen hinta, ei vika.
  **AIKAPITUUTTA (`JALKI × ASKEL`) EI MUUTETTU.** Tällä tuulella raja on
  se joka sitoo; aikapituuden lyhennys olisi osunut vain heikkoon
  tuuleen, eli sinne missä jälki on jo valmiiksi lyhyt.
  **VANHA MERKINTÄ "raja ei pure lainkaan" OLI TOTTA VAIN SILLÄ
  TUULELLA JOLLA SE MITATTIIN.** Uusi pyyhkäisy purki sen: 3,8 m/s:ssä
  raja puri jokaisella arvolla 40:stä alas.
- **JÄLKIÄ ON ODOTETTAVA, EI OLETETTAVA VALMIIKSI.** `resetParticles`
  nollaa `hn`:n, ja rengaspuskuri täyttyy vasta `JALKI × ASKEL` ruudussa
  — kontissa 5–11 s. Mittari joka luki heti sai `n = 0` kaikilla
  riveillä ja näytti siltä kuin partikkeleita ei olisi lainkaan, vaikka
  niitä oli 117. Odota EHTOA (osuus jäljistä täysimittaisia), älä kelloa.
  Ja rajan muutoksen jälkeen on odotettava erikseen: `odotaJaljet` palaa
  heti kun jäljet ovat pitkiä, ja ne ovat sitä edellisen rivin jäljiltä —
  ilman omaa odotusta kolme eri rajaa antoi pikselilleen saman luvun
  (57,6 / 57,6 / 57,6).
- **`?perf=1` VIE MYÖS `JalkiViritys`, `JALKI` JA `ASKEL`.** Ensimmäinen
  on olio nimenomaan siksi että pituuden voi pyyhkäistä ilman
  uudelleenkäännöstä — mutta se ei ollut viedyissä, joten pyyhkäisy vaati
  buildin per arvo.
- **Älä lisää maa/vesi-rajausta.** Kokeiltu, mitattu toimivaksi ja poistettu
  käyttäjän pyynnöstä — ero luki kartalta häiritsevänä.
- **Leveys ja määrä on viritetty yhdessä.** Jos muutat toista yksin, mustemäärä
  muuttuu eikä pyyhkäisyn tulos enää päde.
- **Älä jäädytä partikkeleita eleen ajaksi.** Toteutettu, mittarit olivat
  erinomaiset, ja se peruttiin käyttökokemuksen perusteella.

**Eleet**

- **KARTTA ON MAPLIBRE GL, JA ELEET OVAT KIRJASTON OMIA.** Veto,
  nipistys, tuplanapautus ja -veto, rulla, inertia ja laatikkozoom
  tulevat MapLibrelta. Leaflet-aikaiset paikkaukset (`nipistysAlkaa` /
  `nipistysPaattyy`, eleenaikainen jäädytys, `bounceAtZoomLimits`-jousto
  `getScaleZoom`issa, `_tasoVuoro`, `_updateLevels`, liu'un vartijat,
  `_heatmapCovers` liu'un aikana, kaksi lämpökarttakerrosta) poistettiin
  EIKÄ niitä siirretty: lähes jokainen korjasi vikaa jossa kartan TILA ja
  KUVA olivat eri asiat (CSS-transformi joka valehtelee rajoista,
  `supressEvent`, liu'un kello). MapLibressa ne ovat sama asia joka
  ruudussa. Historia ja mittaukset ovat `docs/eleet.md`:ssä ja
  `docs/lampokartta.md`:ssä — älä rakenna niitä uudelleen tämän kartan
  päälle.
- **SÄILYTETYT PÄÄTÖKSET OVAT MAPLIBREN ASETUKSIA.** Rulla
  `setWheelZoomRate(1/136)` = puoli tasoa 120 px:n napsautukselta (sama
  sigmoidi kuin Leafletilla, mitattu 0,50/napsautus); tuplaklikkaus +1;
  kierto ja kallistus pois (`dragRotate`, `touchPitch`,
  `disableRotation`); heiton katto 900 / 1500 px/s zoomin mukaan
  (`dragPan.enable({maxSpeed})`); uloin näkymä leveysasteista
  (`setMinZoom`); zoom ei napsahda tasoihin. MapLibre kiinnittää zoomin
  `minZoom`iin myös nipistyksessä — Leafletin jousto päästi mitattuna
  3,46 tasoa ali, eikä sitä tarvitse enää rajata erikseen.
- **Älä yritä neljättä derivaattapohjaista suodinta.** Lead compensation, Holt ja
  nollaviiveinen FIR kaatuivat kaikki samaan asiaan: näillä nopeuksilla
  derivaatta on lähes pelkkää vapinaa. Nipistys on nyt MapLibren oma eikä
  sitä suodateta; sen tuntumaa ei ole mitattu laitteella.
- **LÄMPÖKARTTA ON YKSI HILA JA YKSI VARJOSTIN (`LampoGL`), EI
  LAATTAPYRAMIDI.** Kenttä piirretään JOKA RUUDUSSA solmuhilasta
  (`Saalaatat.kokoaHila`, solmuväli `laattaStep(round(zoom))`) samaan
  WebGL-ruutuun pohjakartan kanssa. Hila on maantieteessä kiinni, joten
  veto tai zoom ei maalaa mitään uudelleen — Leaflet-versio maalasi
  1920×1080:lla 308 laattaa vedon perään ja 494–1722 zoomin perään.
  Vaiheet: Catmull-Rom + `pikseliLUT()` 1 näytteellä CSS-pikseliä kohti
  ruudun ulkopuoliseen puskuriin (reunus `ceil(3σ)+2`), erotettava Gauss
  σ 3 CSS px (13 hakua per vaihe: vierekkäiset texelit parina yhdellä
  lineaarisella haulla, mitattuna tavulleen sama kuin 25 hakua ja
  lämpökartan liikkuva ruutu −35 %; ks. `_painot`),
  `saturate` 1,4 (1,6 z ≤ 5) esikertomattomalle värille,
  sekoitus `ONE, ONE` (plus-lighter) tai `DST_COLOR, ONE_MINUS_SRC_ALPHA`
  (multiply, paperi). Puskurivaiheet ajetaan vain kun näkymä, hila tai
  ramppi muuttuu; levossa jää yksi kopio. Älä palauta pyramidia äläkä
  näkymäntekstuuria DOM-kerroksena.
- **LÄMPÖKARTAN HINTA ON LIIKKEESSÄ, EI LEVOSSA.** Levossa se on yksi
  kopio (SwiftShaderilla pohja 118 → 140 ms/ruutu), liikkuvassa ruudussa
  kaikki kolme puskurivaihetta (137 → 495 ms). Jokainen pikselikohtainen
  lisähaku kenttä- tai sumennusvaiheeseen maksetaan jokaisessa eleen
  ruudussa. Kontti ei mittaa laitteen aikaa, mutta SwiftShaderin
  ruutuaika on GPU-työtä suorittimella, joten kerrosten SUHDE on
  mitattavissa: sama näkymä, `jumpTo` + `render`-tapahtuma, asetukset
  vuorotellen, mediaani.
- **HILAN ORIGO ON GLOBAALISTI KOHDISTETTU** (`floor(x/d)*d`), ei näkymän
  reuna. Siksi uudelleenrakennus ei siirrä kenttää pikseliäkään: sama
  solmu on samassa paikassa jokaisessa hilassa. Ilman kohdistusta kenttä
  hyppäisi jokaisella uudelleenrakennuksella (pyramidissa sama sääntö
  esti saumat laattojen välillä).
- **PUUTTUVA DATA ON LÄPINÄKYVÄÄ, EI ARVATTUA.** `kokoaHila` täyttää
  reiät reunan jatkeella jotta kuubinen ydin ei saa NaNia, mutta jatke on
  arvaus. Solmukohtainen kate (`maski`-parametri) kulkee omana
  tekstuurinaan ja kertoo alfan.
- **UUSI HILA RUUDULLE VASTA KUN SEN NÄKYVÄLTÄ ALUEELTA EI PUUDU DATAA**
  (`_odottava`, enintään `ODOTUS_MS` 6 s). Tämä on `_tasoVuoro`n
  perillinen ja korjaa saman vian: solmuvälin vaihto zoomatessa (esim.
  z9,5 → z10, ECMWF → HARMONIE) tyhjentäisi kartan siksi aikaa kun uuden
  tason laatat haetaan — se oli "kartta välkkyy zoomatessa". Tyhjä
  HETKI on eri asia: jos varasto ei kata valittua tuntia, kerros
  tyhjenee heti, koska väärän tunnin kenttä olisi pahempi kuin ei mitään.
- **HILAN PEHMUSTE ON 0,6 NÄKYMÄÄ JOKA LAIDALLA (z ≥ `REUNUS_MIN_Z` 6),
  ULOMPANA 0,3.** Luku on pyramidin REUNUS ja tulee samasta
  geometriasta: yhden tason ulos-zoomi tarvitsee puoli ruutua joka
  laidalle, ja 0,6 eikä 0,5 koska tuplanapautus zoomaa napautetun
  pisteen ympäri. Hila rakennetaan uudelleen vasta kun näkymä karkaa sen
  yli (`_kattaa`), joten pehmuste on se mikä pitää uudelleenrakennukset
  harvassa. Ulompana jokainen lisäaste maksaa varastolaattoja — älä ulota
  täyttä pehmustetta sinne mittaamatta.
- **ESILATAUS KATTAA SAMAN PEHMUSTETUN ALAN KUIN HILA**
  (`_esilataa`: `getBounds().pad(P)`), ei paljasta näkymää. Muuten
  pehmusteen laatat haettaisiin vasta kun hila niitä tarvitsee, ja
  `_odottava` pitäisi vanhaa hilaa ruudulla sen ajan.
- **ESILATAUKSEN KURISTUS SIIRTÄÄ, EI PUDOTA.** Kaksi zoomia mahtuu
  helposti samaan puoleen sekuntiin: mitattuna (Leaflet-versiossa) kaksi
  zoomia 250 ms välein tuotti YHDEN esilatauksen kahden sijaan, eli
  LOPULLINEN näkymä jäi kokonaan esilataamatta. Pudotettu kutsu jää
  ajastimeen.
- **ESILATAUS KÄYNNISTYY HETI KUN VARASTO ON KARTAN KÄYTÖSSÄ, EI
  ENSIMMÄISESSÄ `moveend`issä** (`esilataaKunValmis`), ja laattojen
  tultua aikajana tarkistetaan (`updateTimelineToCenter`). Aikajana lukee
  varastoa kartan keskeltä (`aikajananLahde`), ja ilman tätä jana jäi
  spotin sarjaan: mitattuna 144 tikkiä 400:n sijaan. Leaflet-versiossa
  tämä ratkesi sattumalta, koska laattakerros esilatasi näkymän heti.
- **Peitto ja väri mitataan PIKSELEISTÄ, kerroksia piilottamalla.**
  Pohjakartta pois: `ml.setLayoutProperty('pohja', 'visibility', 'none')`
  (ja `'pohja-tausta'`); lämpökartta pois: `State._perfNoHeatmap = true`
  + `triggerRepaint()`; partikkelit pois: `State._perfNoParticles`. DOM-
  luokkia `.saa-laatat` ja `.heatmap-overlay` ei ole enää — niihin
  tarttuva mittari ei piilota mitään eikä sano sitä.
- **VERTAA VANHAAN BUILDIIN VASTA YHDEN ZOOMIN JÄLKEEN.** Leaflet-version
  lämpökartalta puuttui `blur`- ja `saturate`-suodin käynnistyksessä
  (ne kirjoitettiin vain tekstuurihaarassa ja zoom-animaation alussa),
  joten sama kartta oli ennen ensimmäistä zoomia eri värinen
  (luminanssi 81,6 → 85,4). GL-versio käyttää suodinta aina. Suotimen
  kanssa ero on keskimäärin 0,5–1,0/255 (`docs/lampokartta.md`).
- **KAIKKI KARTAN PIIRTO ON YHDESSÄ GL-RUUDUSSA, JÄRJESTYKSESSÄ pohja →
  lämpökartta → tutka → partikkelit, ja merkit ovat DOMia sen päällä.**
  Partikkelit ovat siis nyt merkkien ALLA (Leafletissa `#c-wind` oli
  niiden päällä). Ruudun ulkopuoliset puskurit kuuluvat custom-kerroksen
  `prerender`iin: sen jälkeen MapLibre sitoo oman kehyspuskurinsa ja
  näkymänsä uudelleen, `render`in jälkeen ei — siellä sidottu puskuri
  veisi seuraavat kerrokset mukanaan.
- **Kontissa ei ole GPU:ta.** WebGL ajetaan SwiftShaderilla, eli koko
  kartta — pohja, lämpökartta ja partikkelit — suoritetaan samalla
  kuristetulla suorittimella. Ruutunopeuksia ei voi mitata täällä;
  oikeaa laitetta vastaan on mitattava. Pikselivastaavuus ja
  pääsäikeen JS-aika mitataan täällä hyvin.
- **HAVAINTOPILLERIEN LASI ON KOKEILTU POIS JA SE JÄI.** Pillerin
  `backdrop-filter: blur(10px)` sumentaa alustansa joka ruudussa, ja
  kartta muuttuu MapLibre-siirron jälkeen joka ruudussa (8–13 pilleriä
  ruudulla z9–z10), joten sitä epäiltiin puhelimen ja iPadin
  kustannukseksi. Se poistettiin kokeilukytkimellä (`?lasi=0`) ja
  verrattiin laitteella: käyttäjä ei huomannut eroa sujuvuudessa eikä
  ulkoasussa, joten lasi pidettiin ja kytkin poistettiin. Älä poista
  lasia sujuvuuden nimissä ilman uutta laitemittausta.
- **Varjostimet ovat GLSL ES 1.00:aa**, jotta sama koodi ajaa WebGL2:ssa
  ja MapLibren WebGL1-varatiellä. Kenttä kulkee RGBA8:ssa 16-bittisinä
  (±64 m/s, askel 0,002 m/s) eikä liukulukutekstuurina, ja solmut
  luetaan lähimmällä suodatuksella texelin keskeltä — se on WebGL1:ssä
  sama kuin `texelFetch`.
- **MapLibre lähettää `move`- ja `zoom`-tapahtumat MYÖS nipistyksessä**
  (Leaflet ei: `supressEvent`). Kapseli ja spottien mittakaava kuuntelevat
  niitä, ja `State.liikkeessa` on tosi `movestart`ista `moveend`iin myös
  nipistyksen ajan — omaa `_nipistysKesken`-ehtoa ei ole. Partikkelit
  eivät kuuntele tapahtumia lainkaan: `Ruudusto.paivita` lukee kartan
  tilan joka ruudussa ennen piirtoa.
