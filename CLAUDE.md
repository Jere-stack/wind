# FoilSpot v7

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (Leaflet) + tuuliennusteet
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
  `src/`-hakemistoa). Leaflet ladataan CDN:stä `<script>`-tagilla.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  aaltoennuste, vedenkorkeus, sade-ennuste GRIB2:sta,
  FMI:n aaltopoijut, Kruunuvuorenselän, Mellstenin, Larun ja Uiraan
  mittausdata-proxyt).
  ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
- `tools/tiilet.mjs` — säälaattojen rakennus AWS Open Datan ECMWF-datasta
  ja FMI:n HARMONIE-hilasta. Ajetaan GitHub Actionsissa neljästi
  vuorokaudessa (`.github/workflows/`).
- `tools/harmonie.mjs` — FMI HARMONIE 2,5 km hilana GRIB2:sta
  (`tiilet.mjs`:n toinen lähde, taso `h0`).
- `tools/ikoni.mjs` — sovelluksen merkin ainoa lähde: kirjoittaa
  `public/icon.svg`:n, `--png` koko PNG-sarjan ja `--inline` sen
  `<svg>`:n joka on latausruudussa. Rasterointi Chromiumilla; tiedostot
  ovat repossa valmiina, joten build ei tarvitse tätä. Ks. `docs/pwa.md`.
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
pakkopäivitys) ja ne haetaan `raw.githubusercontent.com`:sta.

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
| `docs/eleet.md` | nipistystä, zoomia, zoom-aluetta, inertiaa, kosketuskohteita tai kerrosten tahtia eleen jälkeen |
| `docs/data.md` | säälaattoja, rajapintoja, tuulikentän rakennusta, välimuisteja, käynnistystä, aaltopoijuja |
| `docs/ui.md` | paletteja, **sateen väriasteikkoa**, paneeleita, spottikorttia, aikajanaa, kapselia, havaintoasemia, **latausruutua ja sovelluksen merkkiä** |
| `docs/pwa.md` | service workeria, offline-käynnistystä, kotivalikon appia tai **ikonitiedostoja ja manifestia** |
| `docs/lisadata.md` | uuden datan tai uuden lähteen lisäämistä — mitä on kokeiltu, mikä kaatui mittaukseen |
| `docs/sujuvuus.md` | **työpöydän** zoomin ja panoroinnin raskautta, laattojen uudelleenmaalausta, windy.comin arkkitehtuuria, sujuvuusstrategiaa |

<details>
<summary>Osioiden nimet tiedostoittain (jos et tiedä mistä etsiä)</summary>

- **lampokartta**: Pohjakartta · Lämpökartta pohjakartan päällä · Lämpökartta on
  canvas, ei PNG · Väriasteikko — vain asetuspaneelissa · Lämpökartta jäi väärään
  mittakaavaan ulos zoomatessa · Kartan asetukset · Lämpökartan värit olivat eri
  kohdissa eri zoomeilla · Lämpökartta oli väärässä projektiossa · Nopea zoom ei
  saa näyttää mustaa · Zoomin välkky uudestaan — ja se ei ollutkaan
  häivytys
- **partikkelit**: Sujuvuus — mitattu, ei arvattu · Partikkelit ovat tasaisia —
  maa/vesi-rajaus kokeiltiin ja poistettiin · Rakeisuus oli kahta eri vikaa ·
  Kolme jatkokorjausta: heitto, lähizoomin terävyys, tiheys ·
  Jälki lyhennettiin puoleen — raja puree, aikapituus ei
- **eleet**: Kosketuskohteet ja pseudoelementtien osumapinta · Zoom-alue ·
  Nipistyszoomin pehmennys · Eleen loppu ja tuntuma — kolme asiaa Apple Mapsista ·
  Kaksi kokeilua jotka eivät jääneet · Yhden sormen zoom oli rikki — neljä eri
  vikaa · Uloin näkymä rajattiin — ja se muutti kaiken muun · Kerrosten tahti
  eleen jälkeen
- **data**: Verkkotila · Ensilataus — mihin aika menee · Käynnistys: välimuisti
  ruudulle ennen verkkoa · Käynnistyksen pyyntömäärä · Säädata koko maailmalle ·
  Lähdemerkintä ja aina automaattinen malli · Uloin näkymä — 44 % roskaa ·
  Oma säädatavarasto — pois rajapinnan kiintiöstä · Tallennustila ei ollutkaan
  este · Hilalähtöinen kenttä · Zoom raskaampi kuin ennen · Aaltopoijut —
  havaintoa, ei ennustetta · Aikajana ja kartta näyttivät eri
  lukua · Mellsten (Haukilahti) — kolmas oma proxy · Varaston puuska on
  joka toisella askeleella tuuli · Laru (Lauttasaari) — neljäs oma proxy ·
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
  Kartan säämalli valittavaksi · HARMONIE varastoon ja zoomin välkky
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
  Latausruutu: kuva esiin, merkki uusiksi
- **pwa**: PWA — kotivalikkoon ja rannalle · Mitä välimuistiin menee ·
  Kaksi asiaa jotka pitää muistaa · Mitattu · Testaamisen sudenkuoppa ·
  Ikoni ja kotivalikko
- **sujuvuus**: Tiivistelmä · Mittausasetelma · Mitä mitattiin (laattojen
  uudelleenmaalaus per ele, aikajanan askel, pääsäikeen profiili, eleen
  aikana, localStorage, mitä ei voitu mitata) · Miksi juuri työpöytä ·
  windy.com — mitä se tekee · Julkiset lähteet (GitHub) · Vaihtoehdot
  (Vaihe 0, A1–A4, B1–B3, C1–C2) · Suositus ja järjestys · Mitä ei
  ehdoteta

</details>

---

## Työtavat — nämä pätevät joka tehtävässä

**`npm run build`:n läpimeno ei ole todiste mistään.** Vite ei jäsennä
`index.html`:n inline-skriptiä, joten syntaksivirhe menee buildista läpi ja
kaataa vain selaimen. Tarkista skripti erikseen (`new Function(lohko)`) ja
**lataa sivu selaimessa**.

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

**Jos paikkaat Leafletin prototyyppiä, tarkista onko metodi rekisteröity
kuuntelijaksi** (`getEvents()`). Jos on, paikkauksen on oltava paikallaan ennen
`addTo(map)`:ia — Leaflet tallettaa funktioviitteen kerran.

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

**Väri**

- **Kartalla sävy tarkoittaa tuulennopeutta ja vain sitä.** Kaikki muu kartalla
  on joko tummaa pilleriä (mitattu data) tai paperia (kaikki muu).
  **Yksi poikkeus, ja se on ehdollinen: sadekerros.** Kun sadetutka on
  päällä, lämpökartta ja partikkelit sammuvat (`_tuulikerrokset-`
  `Nakyvissa`), jolloin kartan pinnalla on kerrallaan tasan yksi
  väriasteikko ja sävy saa tarkoittaa sateen voimakkuutta. Ehto EI ole
  neuvoteltavissa: jos lämpökartta joskus palautetaan näkyviin
  sadekerroksen alle, sateen värit on poistettava samassa muutoksessa.
- **Aikajanan palkit ovat `ColorRamp.varjo()`, eivät `rgb()`, `paperi()`
  eivätkä `ink()`.** Aikajana on nyt tummennus eikä paperi, ja SEN
  alustan ramppi on karttaramppi sekoitettuna VALKOISEEN kertoimella
  0,45 — `paperi()`:n peilikuva, joka kertoi saman rampin 0,48:lla kohti
  mustaa. Molemmat säilyttävät sävyn ja muuttavat vain kirkkautta, eli
  sen ominaisuuden joka sitoo palkin karttaan.
  Kumpikin paljas ramppi katoaa väärälle alustalleen, ja se on mitattu
  molempiin suuntiin: `rgb()` on paperilla 1,02:1, ja tummennusta vasten
  sen hiljainen pää katoaa samalla tavalla — juuri se pää jota Suomen
  rannikolla katsotaan useimmin.
  `varjo()`:lla mitattuna ruudulta: 2 m/s 7,76:1, 5 m/s 12,30, 8 m/s
  13,65, 11 m/s 15,08, 14 m/s 10,92, 20 m/s 7,93. Heikoin on siis 7,76
  (paperiversiossa 3,41).
  **ALUSTANÄYTE OTETAAN PALKKIEN VÄLISTÄ.** Nämä luvut olivat pitkään
  4,88 / 7,73 / 8,58 / 9,47 / 6,86 / 6,46, ja ne olivat väärin samasta
  syystä kuin kortin paperinäyte aikanaan: mittarin alustapiste oli
  kiinteä `nauha.left + 24`, joka on PLAY-NAPIN sisällä (nappi on
  x 9..53). Se luki siis napin lasia tummennuksena — ja kun lasin alfaa
  nostettiin, "alusta" vaaleni ja jokainen palkki näytti menettäneen
  kontrastia vaikka liukuvärin alfa oli mitattuna noussut. Näyte otetaan
  kahden palkin välistä (tikki 18 px, palkki 12, väliin 6 px) ja mittari
  tarkistaa vielä ettei piste osu nappiin. `ink()` on yhä väärä koska se
  on oma sävypolkunsa eikä matchaa karttaan. Taulu ei seuraa pohjakarttaa mutta
  seuraa värisokeusasetusta — se koskee näköä eikä alustaa.
- **AIKAJANALLA EI OLE URAA EIKÄ KORTTIA.** Ura oli kolmessa muodossa
  (tumma, hiekka, kaksi identtistä uraa 1,01:1 raidasta raitaan) ja
  jokainen oli reuna jota kortin oma reuna jo kertoi; sitten kortti
  poistui sekin. Alusta on nyt liukuväri: läpinäkyvä ylhäältä, tumma
  alhaalta, reunasta reunaan, 64 px ylimenoa kääreen yläpuolelle.
  Kartta jatkuu aikajanan läpi eikä mikään reuna katkaise sitä.
  Älä palauta laatikkoa "jotta palkit näkyisivät": palkit saavat
  tummennuksella ENEMMÄN kontrastia kuin paperilla (heikoin 3,41 →
  7,76).
  **YLIMENO ON 32 px JA PYSÄKIT 0 → .48 → .82 → .90 → .96
  (0 / 17 / 33 / 46 / 100 %).** Ylimeno oli 64 px, ja se tuli liian
  ylös: valkoista vasten mitattuna tummennus alkoi näkyä 58 px kääreen
  yläpuolella ja oli puolessa täsmälleen kääreen ylälaidassa. Nyt se
  alkaa 30 px yläpuolella, eli sama alfaväli kuljetaan puolessa
  matkassa ja reuna häipyy ylöspäin mentäessä nopeammin.
  **PALKKIVYÖHYKKEEN ALFA EI SAA LASKEA SAMALLA.** Ensimmäinen yritys
  siirsi koko käyrää alas (.45/.80/.91), jolloin alfa palkkien takana
  putosi 0,805 → 0,780. Nyt se on 0,822 (+30 px), 0,888 (+50) ja
  0,913 (+74) eli entistä tummempi siellä missä palkit ovat, ja
  lyhennys maksetaan pelkästään ylimenosta.
  Pysäkit eivät ole tasavälein: lineaarinen luki juovana, koska sen
  keskikohta nousee liian nopeasti. Käyrän ainoa kielletty muoto on
  KIIHTYVÄ nousu — osuuksien kaltevuus on 0,0282 → 0,0213 → 0,0062 →
  0,0011 alfaa prosenttia kohti, eli aina edellistä pienempi.
  **LIUKUVÄRIÄ EI MITATA KARTAN PÄÄLTÄ.** Itämeri yöllä on jo valmiiksi
  tummaa ja luminanssi seuraa karttaa eikä alfaa (mitattuna L poukkoili
  0,0046 ja 0,0798 välillä vierekkäisissä näytteissä, ja suurin arvo oli
  lukemarivin teksti). Kartta piilotetaan ja taakse jätetään valkoinen,
  jolloin pikselin arvo ON alfa: `a = (255 − tulos) / (255 − pohja)`.
- **AIKAJANASSA EI OLE VALOKAISTAA.** Yö oli janassa kolmessa
  muodossa: koko korkeuden harso, 2 px:n kaista tikin alalaidassa, ja
  kolmella eri alustalla kalibroidut alfat (musta .34, `76,89,96` .24,
  lopuksi .20/.129/.060). Kaista oli mitattuna sekä pienempi että
  selvempi kuin harso (yö 4,71:1 paperiin vastaan 1,31:1), eikä se
  silti jäänyt: se häiritsi lukemista. Valovaiheet elävät yhä
  spottikortin kaaviossa (`VALO_VARIT`) ja kelihypyssä, joka osaa
  hypätä vain tuntiin jossa aurinko on ylhäällä. Älä palauta kaistaa
  janaan — kolme kertaa riittää. (Puuskahuntu oli samasta syystä muste
  .34 eikä valkoinen .22; sekin on poistettu, ks. alempaa.)
- **Päivälapuissa EI ole tuulikaistaa.** Kokeiltiin ja mitattiin
  toimivaksi (väri ja leveys sen päivän kovimmasta tuulesta valoisaan
  aikaan), mutta poistettiin: kahdeksantoista väripilkkua yhdellä
  rivillä on kahdeksantoista asiaa joita silmä lukee, ja sama tieto on
  tuntirivillä tarkempana. Kisko on navigointia, ei yhteenvetoa.
- **Kortin paljas paperi mitataan RIVIEN VÄLISTÄ.** Rivin sisältä otettu
  näyte osuu palkkiin, yökaistaan, NYT-osoittimeen tai napin varjoon —
  ja väittää sitten että sama paperi on eri väristä eri kohdissa.
- **Palkin korkeusasteikko on EPÄLINEAARINEN** (4–14 m/s levennetty) ja
  täysi mitta on 72 px (`TL_PALKKI_H`). Korkeus on muoto, väri on arvo.
  Älä palauta lineaarista: se antaa 1,38 px/(m/s) ja peräkkäisten
  tuntien tyypillinen ero on 0,2 m/s eli alle puoli pikseliä.
- **`ColorRamp.rgb()` on kartalle, `ink()` paneeleihin.** Ne kulkevat
  vastakkaisiin suuntiin kirkkaudessa. Muste ei ole värisokeusturvallinen eikä
  sen tarvitse olla — paneelissa väri on aina luvun vieressä.
- **Kartan oletusramppi on kylläinen ja tehty normaalinäköiselle**
  (sininen–syaani–vihreä–keltainen–oranssi–punainen–magenta).
  Värisokeusturvallinen `RAMP_CVD` on asetus, ei oletus — se on käyttäjän
  päätös. Älä palauta vaimeaa ramppia oletukseksi vetoamalla värisokeuteen.
- **Rampin kylläisyys ruudulla on suunnilleen kroma KERTAA alfa.**
  Lämpökartta piirtyy alfalla 0,08–0,71, joten taulukon luvut eivät kerro
  mitä nähdään. Mittari on `varit.mjs`, joka lukee `pikseliLUT()`:n ja
  sekoittaa pohjaan — mittaa siitä, älä rampista.
- **`--accent` (magenta) on toiminto- ja varoitusväri, ei korostusväri.**
  Nimilappu tai datapiste ei ole kumpaakaan; ne ovat mustetta.
- **`var()` ei toimi SVG:n esitysattribuuteissa.** Kaavioiden `fill=` tarvitsee
  literaalin; inline-tyyleissä tokenit toimivat.

**Latausruutu ja sovelluksen merkki**

- **LATAUSRUUTU ON KAHDESSA OSASSA: KUVA YLHÄÄLLÄ, PAPERI ALHAALLA.**
  Teksti oli ennen keskellä eli täsmälleen kuvan päällä, jolloin kuvan
  piti väistyä koko ruudun leveydeltä — se oli `opacity: .16` ja
  paperiliuku .30–.86 sen päällä, eli kuvaa näkyi 2–11 %. Älä korjaa
  tätä alfalla: mitattuna paljasta kuvaa vasten muste on nimen
  kaistalla mediaaniltaan 3,09:1 ja heikoimmillaan 1,62:1, ja 66 %
  pinnasta alittaa 4,5:1 (merkin kaistalla 100 %).
  Nimilohko VAATII umpinaisen paperin alleen, ja kuva saa kaiken
  sen yläpuolelta. Mitattu kuvan osuus kaistoittain (0–255, sama ruutu
  kuvan kanssa ja ilman): 9,19 → 67,31 · 12,85 → 103,63 · 9,74 → 33,03
  · 7,98 → 0.
- **RAJALIUKU ON SMOOTHSTEP, EI HIDASTUVA KUTEN AIKAJANALLA.** Aikajanan
  liuku päättyy ILMAAN, jolloin kiihtyvä pää lukee juovana; latausruudun
  liuku päättyy umpinaiseen paperiin MOLEMMISSA päissä, jolloin juovan
  tekee kaltevuuden äkkipysähdys päädyissä. S-käyrä lähtee ja pysähtyy
  nollakaltevuudella. Pysäkit ovat s²(3−2s) kahdeksassa pisteessä, koska
  CSS interpoloi pysäkkien VÄLIT suorina — käyrää ei saa kahdella
  pysäkillä.
- **LATAUSRUUDUN YLÄLAIDAN TUMMENNUS ON TILAPALKKIA VARTEN.**
  `black-translucent` piirtää kellon ja akun VALKOISENA sisällön päälle,
  ja kermalla se on mitattuna 1,32:1 eli näkymätön. Tummennus (190 px,
  ink .60 → 0) nostaa sen 8,18:1:een. Älä poista sitä "koska paperi on
  vaaleaa" — juuri siksi se on siellä.
- **`object-position` VAIKUTTAA VAIN LEVEISSÄ NÄKYMISSÄ.** 562×1000 kuva
  mahtuu 393×852 ruudulle korkeussuunnassa täsmälleen, joten puhelimen
  pystynäkymässä pystyarvo ei tee mitään; työpöydällä ylivuotoa on
  1478 px ja arvo ratkaisee näkyykö kuvassa ratsastaja vai purjekangasta.
- **MERKKI ON YKSI MUOTO JA KAKSI ASUA, JA SE SYNTYY `tools/ikoni.mjs`:STÄ.**
  Kotivalikon ikoni on karttamaailmaa (meren tumma pohja, `RAMP_KARTTA`),
  latausruudun merkki paperimaailmaa (yksivärinen muste) — sama jako kuin
  `rgb()`/`ink()`-säännöllä. Ramppi paperilla on mitattu ja kaatunut:
  kermaa vasten heikoin on 1,06:1 (limetti, t 0,65) ja koko väli
  t 0,50–0,78 jää alle 1,6:1, eli kaaren yläkolmannes katoaa. Älä
  piirrä merkkiä käsin uudestaan kumpaankaan paikkaan.
- **SEKTORIVIUHKAN ON ULOTUTTAVA KAAREN KULMAVÄLIN YLI.** Pyöreä
  päätykorkki pullistuu kulmavälin ulkopuolelle, eikä sitä peitä yksikään
  sektori: korkki jäi pohjan väriseksi ja leveä pää luki suorana
  leikkauksena. Ylitys 16°, ja sen väri on rampin pää eikä jatkettu
  ramppi. Keskitys tehdään RAJAUSLAATIKOSTA eikä ympyrän keskipisteestä —
  270° kaari ei ole symmetrinen.
- **MASKATTAVA IKONI ON ERI KOKO SAMASTA MUODOSTA.** Android leikkaa
  siitä 80 %:n ympyrän. Täyteen asti ulottuva merkki menettäisi päänsä,
  ja maskin mitoille tehty kelluisi pikkuruisena kotivalikossa.
- **`background_color` ON PAPERI, `theme_color` ON KARTTA.** Edellinen on
  käynnistyksen välähdys ennen ensimmäistä maalausta, eli latausruudun
  väri; jälkimmäinen värittää järjestelmäpalkit kun ruudulla on kartta.
  Kun molemmat olivat `#060912`, kotivalikosta avattu appi välähti
  mustana ennen kermaa.

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
- **Päällekkäinen pinta kulkee `Modaali`-moduulin kautta.** Neljä pintaa
  (asetukset, spottikortti, ennustepaneeli, pikanäppäimet), neljä eri
  avaus- ja sulkupolkua — paneelikohtaiset kuuntelijat ajautuisivat
  erilleen. Älä kirjoita viidettä polkua.
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
  `preventDefault` ei riitä: nuolet kuuluvat muuten Leafletille, joka
  panoroi niillä karttaa.
- **Aria-tila synkataan MutationObserverilla.** `.active` ja `.on`
  asetetaan kuudessa eri paikassa; aria-tilan kirjoittaminen jokaiseen
  olisi seitsemäs polku samaan asiaan.
- **Pyöreän napin kulma ei ole nappi.** `.mctl` on ympyrä, joten
  napautusmittauksen näytteet otetaan ympyrän sisältä — laatikon kulma
  antaa hudin joka on geometriaa, ei vikaa.

**Asetukset**

- **"AUTOMAATTINEN" TARKOITTAA PARASTA SAATAVILLA, JA PARAS TULEE
  VARASTOSTA.** HARMONIE on nyt varastossa omana tasonaan (`h0`,
  0,05°, tunneittain, 66 h) — se oli tämän säännön edellisen version
  oma johtopäätös ("oikea korjaus nopeudelle on viedä HARMONIE
  laattaputkeen"), ja se on tehty. `kartanMalli()`:n auto-haara
  palauttaa siis aina varaston eikä valitse mallia lainkaan; valinnan
  tekee `Saalaatat.taso()`, joka ottaa hienoimman tason joka kattaa
  sekä PAIKAN että HETKEN. Älä palauta rajapinnan pakotusta
  automaattiin: se veisi kartalta laattapyramidin, ja sen hinta on
  mitattu (panorointi Suomessa 6,1 s ja 44 pyyntöä, käynnistys 22 s
  vastaan 3 s).
- **`vainKartta`-TASO EI KELPAA SARJALLE.** `h0` kattaa 66 tuntia ja
  aikajana 16,6 vuorokautta, joten `wx()` ja `wxTunneittain()` kutsuvat
  `taso(lat, lng, step, /* sarjalle */ true)` joka ohittaa ne. Kartta
  lukee `h0`:aa `naytteista()`n kautta. Jos lisäät tason jolla on oma
  akseli, päätä kumpi se on.
- **TASOKOHTAINEN AIKA-AKSELI EI OLE YLELLISYYTTÄ.** Mitattuna 10
  pisteessä ja 400 tunnissa: HARMONIE varaston omalle 3 h akselille
  tallennettuna jättäisi tuntien väliin keskimäärin 0,41 m/s ja
  enimmillään 3,34 m/s virhettä, suunnassa 172°, ja **29,8 %
  tunneista ylittäisi sovelluksen oman 0,5 m/s rajan**. Akseli on
  tason ominaisuus (`taso._ax`), ja laatta kantaa sen viitteen
  (`laatta._ax`), koska `naytteista` näkee vain laatan. Älä palauta
  jaettua `_ti`/`_tf`-paria.
- **HETKI ASETETAAN KAIKILLE AKSELEILLE KERRALLA** ja
  `asetaHetki` mitätöi laattamuistin: sama piste ja sama askel osuu eri
  tasoon eri hetkellä, koska `taso()` ohittaa tason jonka akseli ei kata
  hetkeä.
- **ULOIN NÄKYMÄ PYSYY VARASTOSSA JA ILMAN REUNUSTA.** Se on syy miksi
  varasto on yhä olemassa, ja maailmankartan nopeus on sen ansiota.
- **`kaytossa()` = VARASTO ON KUNNOSSA, `kartallaKaytossa()` = KARTTA
  LUKEE SITÄ.** Vain jälkimmäinen seuraa mallivalintaa. Varaston omat
  datafunktiot (`varmista`, `naytteista`, `wxTunneittain`) ja AIKAJANA
  ovat `kaytossa()`:n takana, ja niiden ON toimittava vaikka kartta
  lukisi HARMONIEa. Kun nämä olivat hetken sama metodi, `varmista()`
  lakkasi hakemasta laattoja ja aikajana menetti 51 tuntia
  menneisyyttään (54,6 h -> 3,5 h, 403 -> 372 tikkiä) — ja sadetutkan
  mennyt kuva menetti kantamansa samalla. Älä yhdistä niitä takaisin.
- **AIKAJANA LUKEE VARASTOA MYÖS FMI-TILASSA.** Palkit ovat siis
  ECMWF:ää ja kartta HARMONIEa, eli ne voivat näyttää eri lukua. Se on
  tietoinen vaihtokauppa: kadonnut vuorokausi olisi ollut uusi menetys,
  tasojen ero ei ole (se on ollut olemassa ja dokumentoitu, ka
  1,38 m/s).
- **`gridStep` ON RAJAPINTAHILAN VÄLI, `laattaStep` PYRAMIDIN.**
  Ne EIVÄT saa olla sama funktio: `gridStep` synnyttää
  `getViewportPoints`in pistelistan, ja jokainen piste on Open-Meteon
  laskutuksessa oma kutsunsa — 0,05 asteen rajapintahila z12:ssa olisi
  juuri se kiintiö jonka takia koko varasto rakennettiin. `laattaStep`
  taas vain ohjaa `taso()`:n hienompaan laattaan jos sellainen on
  olemassa, ja se on ilmaista. Pyramidi ja tähtäin lukevat
  `laattaStep`iä, hilapisteet `gridStep`iä.
- **MALLIN PAKOTUS ON `Saalaatat.pois()`, EI `?laatat=0`.** Mitattuna
  `?laatat=0` vaihtaa vain piirtotavan ja data tulee yhä varastosta
  (506 pistettä 518:sta). Varaston sulkeminen on se kytkin joka siirtää
  koko kentän rajapintapolulle. Leafletin laattakerros on poistettava
  ERIKSEEN (`_laattakerrosPois`): pelkkä `pois()` jätti `.saa-laatat`in
  kartalle vanhoine laattoineen, eli valittu malli ei näkynyt missään.
- **PAKOTETTU FMI EI OLE PELKKÄ FMI.** HARMONIEn hila kattaa vain
  Pohjois-Euroopan, joten `loadBatch`in `fmi_harmonie`-haarassa on
  oltava Open-Meteo-varatie. Ilman sitä erä jonka yksikään piste ei osu
  hilaan jää KOKONAAN ILMAN DATAA (mitattu: neljä `harmonie_empty`-
  virhettä ja tyhjiä eteläisiä eriä). Tyhjä kartta Keski-Euroopassa ei
  ole "HARMONIE", se on rikki.
- **Partikkelien ja väriasteikon AVAIMIA ei saa vaihtaa** vaikka nimet
  vaihtuvat: `'vahan'` on nimeltään "Normaali" ja `'normaali'` on
  "Paljon". Avaimen vaihto pudottaisi jokaisen tallennetun valinnan
  oletukseen.
- **Oletus on siruryhmässä ensimmäisenä vasemmalla** (tuuli, kts,
  tumma, partikkelit-Normaali). Poikkeus: lämpökartan voimakkuus ja
  väriasteikko ovat asteikkoja, joissa järjestys on itsessään tieto.
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
- **Älä tihennä aikajanaa tuntia pienemmäksi.** Mitattu: varastoaskelen
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
  72 px palkkivyöhyke, 14 px lukemarivi alhaalla.**
  Lukujärjestys on tarkoitus: hetki (kupla), tuuli (palkit), tunti
  (lukemat), päivä (kisko) — karkeampi askel aina edellisen alla.
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
- **Nuolinäppäimet kuuluvat Leafletille.** Sen `Keyboard` panoroi karttaa
  nuolilla eikä tarkista shiftiä (vain alt/ctrl/meta), joten Shift+nuoli
  panoroi myös. Aikajanan askellus on `,` ja `.`, ja shiftattu merkki on
  eri `e.key` (suomalaisella `:` ja `;`) — lue `e.code`.
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
- **Päivälapun tuulikaista: LEVEYS on muoto, VÄRI on arvo.** Pelkkä väri
  ei kelpaa, koska rampin hiljainen pää on paperilla tummin (0 m/s on
  `6,14,58`) eli tyyni päivä näyttäisi raskaimmalta. Kaista on pillerin
  ULKOPUOLELLA: sisällä se osuisi valitun päivän mustaan, jossa ramppi on
  1,3:1. Luku on VALOISAN ajan huippu (varatie: koko väli, kun valoisia
  tunteja on nolla) — yöllä puhaltava huippu ei ole keli.
- **Kaistat päivitetään MYÖS nopeassa polussa.** Kisko rakennetaan vain
  hitaassa (se riippuu aikaleimoista), mutta kaista riippuu nopeuksista
  ja nopea polku on juuri se joka ajetaan kun aika pysyy ja paikka
  vaihtuu. Sama ansa kuin päiväerottimien valovaiheessa.
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
- **KISKO SEURAA OSOITINTA JATKUVASTI** (`_tlKiskoKeskita`), ei päivä
  kerrallaan: se on sama akseli karkeampana. Osuus lapun sisällä tulee
  TIKKIVÄLILTÄ (`_i0.._i1`) eikä kellonajasta — akselin reunapäivät ovat
  vajaita, ja kellonajasta laskettuna vajaan päivän ensimmäinen tunti
  olisi heti 58 %:n kohdalla. Kutsu on `_tlUpdateNow`in JÄLKEEN:
  `_tlKorostaPaiva` keskittää `currentHourIdx`:n mukaan, ja raahatessa
  se luku on vielä edellisessä tikissä. `scrollLeft` kirjoitetaan
  suoraan, EI `scrollTo`lla — pehmeä vieritys hakisi sormea vastaan.
- **KESKITYS PYÖRISTÄÄ INDEKSIN, JA PYÖRISTYS ON `_tlKiskoKeskita`:N
  SISÄLLÄ.** Seuranta valitsee tikin PYÖRISTETYSTÄ luvusta
  (`nearest = Math.round(frac)`) mutta keskitti kiskon RAA'ASTA
  `frac`:sta, ja päivärajalla ne osoittavat eri päivään: frac 50,5
  valitsee jo uuden päivän klo 00:n, mutta `_i0 <= 50,5` valitsee vielä
  vanhan lapun. Mitattuna korostettu lappu jäi silloin **51,9 px eli
  tasan yhden lapun verran sivuun** kolmessa näytteessä yhdeksästä
  (frac −0,5 … −0,2 rajasta) ja asettui keskelle vasta frac 51,0 —
  ruudulla se näkyy niin että päiväys on klo 00 kohdalla sivussa ja
  keskittyy vasta klo 01. Jälkeen 0/9, pahin 0,9 px; sama molemmilla
  moottoreilla.
  **ELE EI KELPAA TÄMÄN MITTARIKSI.** `scroll-snap-type: x mandatory`
  vetää harnessin jokaisen `scrollLeft`-kirjoituksen lähimpään tikkiin,
  joten `frac` on siellä AINA kokonaisluku eikä rajatapausta synny:
  24 askelta yhdeksän pikselin välein antoi 0,7 px poikkeaman
  MOLEMMISSA buildeissa, eli mittari ei yltänyt vikaan. Mittaus tehdään
  ajamalla sama pari suoraan (`_tlSeuraaHetkea(Math.round(frac))` +
  `_tlKiskoKeskita(frac)`) murtoluvuilla rajan molemmin puolin.
  Pyöristys on `_tlKiskoKeskita`:n sisällä eikä kutsupaikassa, koska
  kutsupaikkoja on kolme ja kahdella niistä luku on jo kokonaisluku.
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
- **PÄIVÄYS ON TÄSMÄLLEEN KESKELLÄ EIKÄ LIU'U.** Lapun OMA keskikohta
  asetetaan osoittimen alle, joten päivän sisällä kisko ei liiku
  pikseliäkään (mitattu poikkeama −1,0…+0,1 px kahdeksalla siirrolla,
  tuntiaskel 0 px). Tämä on KÄÄNNÖS aiempaan: kisko liukui ennen
  jatkuvasti ja lappu oli keskellä vain päivän puolivälissä (max
  24,1 px sivussa). Vanha perustelu oli oikea mutta ratkaisu väärä —
  ruudulla liike oli se mitä silmä seurasi. Keskiyön yli kisko siirtyy
  yhden lapun verran, ja se hyppy on SISÄLTÖÄ: se on ainoa hetki
  jolloin päiväys vaihtuu. Älä animoi askelta — pehmeä siirtymä
  laahaisi sormesta jäljessä ja kaksi vierityskonetta hakisi toisiaan.
- **Kiskossa on reunavälikkeet**, kuten tuntinauhassa: ilman niitä
  selain rajaa `scrollLeft`in nollaan eikä akselin ensimmäistä ja
  viimeistä päivää saa osoittimen alle.
- **Sormi kiskolla voittaa** (`_tlKiskoKosketusOma`). Lippu nollataan
  IKKUNASTA, koska kisko rakennetaan uudelleen kesken eleen ja
  alkuperäinen kohde irtoaa DOM:sta.
- **PÄIVÄKISKO ON ALHAALLA JA AINA NÄKYVISSÄ.** Se piiloutui ennen
  neljän sekunnin levossa, koska paperikortilla se oli 30 px kromia
  128:sta. Liukuvärillä korkeus ei maksa karttaa samalla tavalla —
  tummennus häivyttää eikä katkaise — ja piiloutuva kisko oli silti
  aina yksi ele lisää ennen kuin päivän saattoi valita. Poistuivat
  `html.tl-kisko-piilossa`, `_tlKiskoHerata`, `_tlKiskoNukuta`, niiden
  kolme kutsupaikkaa ja aikakuplan päiväyshaara. `--tl-paivat-h` on
  vakio eikä vaihtele.
- **Aikajanan valinta kulkee `_tlValitseIdx`:n kautta** (päiväkiskon
  napautus, näppäimistö, kelihyppy). Älä kirjoita neljättä polkua.
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
  valitsee osoittimen alla olevan päivän jatkuvasti, myös sormen ollessa
  kiinni — sama sopimus kuin tuntinauhalla, jonka kanssa se on
  päällekkäin. Kolme asiaa pitävät sen erossa itsestään: kiskon oma
  `scrollLeft`-kirjoitus tunnistetaan sijainnista
  (`_tlKiskoKirjoitettu`) eikä `_tlRakennaPaivat`in tyhjennys siis
  valitse akselin ensimmäistä päivää; `_tlKiskoKeskita` vaikenee koko
  eleen ajan (`_tlKiskoVierii` kattaa myös heiton, ei vain sormen); ja
  raahauksen perään tuleva click ohitetaan MATKAN perusteella
  (`_tlKiskoAlkuScroll`, 6 px), muuten kisko hyppäisi vielä kerran
  sormen alla olleeseen lappuun. Kenttä päivitetään eleen aikana
  KARKEANA ja täysi tarkkuus tulee `_tlCommitSelection`ista, joka lukee
  tuntinauhan sijainnin.
- **"TÄNÄÄN" VIE NYKYHETKEEN, MUUT PÄIVÄT SÄILYTTÄVÄT KELLONAJAN.**
  `_tlPaivanIdx` palauttaa tämän päivän kohdalla `nowIdx`in. Sama
  kellonaika olisi vienyt paluussa esimerkiksi kello 03:een, eli
  päivään tänään mutta hetkeen joka on jo mennyt — ja lappu lukee
  "Tänään" juuri siksi että se on paluu nykyhetkeen. Muilla päivillä
  kellonaika on vertailun koko pointti ("onko lauantaina yhtä kova kuin
  tänään viideltä").
- **Päiväkiskon napautus ei saa käyttää `scrollTimelineTo`a.** Kupla ja
  päiväkorostus päivittyvät VIERITYKSEN mukaan, joten pehmeä animaatio
  kävelee jokaisen välipäivän läpi (mitattu 15 välitilaa ja 1001 ms
  ennen kuin oikea päivä jäi voimaan). Pitkä hyppy asetetaan suoraan
  `_tlSetScrollLeft`illä.
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

- **LAAJA NÄKYMÄ ON KUORI, EI KAAVIO.** `HavLaaja` omistaa otsikon,
  lukemarivin, jaksonapit, liu'utuksen, käännön, turva-alueet ja
  `Modaali`-kytkennän; piirtäminen tulee LÄHTEELTÄ
  (`{ el, otsikko, sub, jaksot, piirra(kaavioEl, laatikko, laaja) }`).
  Kolme kaaviota käyttää sitä — tuuliennuste, tuulihavainto ja
  vedenlämpö. Älä kirjoita neljättä kokoruudun polkua.
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
- **LAAJA ON 1:1 PIKSELEIHIN, KORTTI VENYTTÄÄ.** Kortin ennustekaavio
  on `preserveAspectRatio="none"` ja sen 300 yksikön viewBox venyy
  ~407 px:iin, eli teksti on jo 36 % leveämpää kuin korkeaa; vaakassa
  sama kerroin olisi 2,7. Laajan viewBox ON laatikon pikselikoko ja
  luettavuus ostetaan kirjasinkoolla (`fs`), ei venytyksellä.
- **LAAJENNUS EI SAA KAVENTAA MITÄÄN, JA SE MITATAAN NÄKYVÄSTÄ
  PIIRTOALUEESTA.** Ulkomitta valehtelee aina kun kaavio vuotaa
  kääreensä yli — ensimmäinen mittari teki juuri tämän virheen ja
  vaati mahdotonta. Nykyiset: ennuste 336 → 346 px (6,1× korkeampi),
  havainto 332 → 334, vesi 314 → 330. Y-akselin ura on `20 × fs`
  (kaksinumeroinen lappu) ja vedenlämmössä `26 × fs` ("12.5°");
  ensimmäinen `30 × fs` jätti 25 px tyhjää ja rikkoi säännön.
- **Y-AKSELIN URA VEDETÄÄN TÄYTTEESEEN KERRAN, EI KAHDESTI.**
  Ennustekaaviossa kompensaatio oli sekä kääreen
  `margin-left: -yPad`issa ETTÄ SVG:n `calc(100% + yPad)`-leveydessä:
  kääre 382 px, SVG 414 px, ja oikea laita jäi `overflow-x: auto`:n
  taakse. Mitattuna 24 h jaksolla piiloon jäi 26,5 px eli **1,8 tuntia
  vuorokaudesta** — ja juuri se jakso on määritelty vierittämättömäksi
  (`PERIOD_W['24h'] = null`). Fluidissa SVG on `width: 100%`. Viisi
  päivää ja Kaikki vierittyvät tarkoituksella ja saavat leveytensä
  `W`:stä. Vedenlämpökaaviossa sama kuvio on oikein, koska siellä
  molemmat termit ovat SAMASSA elementissä ja kumoavat toisensa.
- **LAAJASSA LUKEMA MENEE KIINTEÄLLE RIVILLE MYÖS UUSISSA
  KAAVIOISSA.** `attachTooltip`in kolmas parametri (`scrub`) ja
  vedenlämmön `el._uwScrub` ovat sama ratkaisu kuin `_havScrub`:
  kun koukku on annettu, kuplaa ei edes lasketa.
- **JAKSOVALINTA SÄILYTETÄÄN KORTISSA.** Laajan jaksonapit ovat kortin
  nappien peili (`b.click()`), ja valittu luetaan `aria-pressed`ista —
  toinen lippu samasta asiasta ajautuisi erilleen.
- **TUULIENNUSTEKAAVION Y-AKSELI ON KÄYTTÄJÄN YKSIKÖSSÄ.** Akselille
  kirjoitettiin raaka m/s samaan aikaan kun jokainen lukema samassa
  kortissa on valitussa yksikössä: solmuissa huippurivi sanoi
  "20,7 kts", työkaluvihje "23,8 kts" ja akseli näytti kahtatoista.
  Data pysyy m/s:nä (kaikki laskenta on sitä), mutta TIKIT valitaan
  näyttöyksikössä ja sijoitetaan kertoimella takaisin m/s-akselille.
  **Boforille ei saa keksiä käänteismuunnosta** (sama sääntö kuin
  havaintokaavion gradientissa): sille tikit OVAT `Units._bft`-kynnykset,
  mikä on boforin luonnollinen akseli eikä kiertotie.
- **AKSELIN TIHEYS TULEE PIKSELEISTÄ, EI `maxV`:STÄ.** Askel oli
  `maxV>15?4:maxV>8?2:1`, joten kortti ja kaksi kertaa korkeampi laaja
  näkymä saivat saman askeleen — laajassa mitattiin kuusi viivaa. Nyt
  askel on pienin tikkaista 1/2/5/10/20/50 joka antaa vähintään
  **16·FS px** välin. Kortti pitää entisen tiheytensä (4 lukemaa),
  laaja saa 11. Kymmenellä laaja päätyi 23 viivaan — se on ruutupaperia,
  ei asteikkoa.
- **FOILAUSRAJA ON VAHVEMPI KUIN RUUDUKKO.** Kun ruudukko tiheni,
  6 m/s raja katosi sen sekaan: molemmat olivat samaa hiekkaa ja ero oli
  vain viivanleveys. Raja on sovelluksen oma päätöskynnys (foilBadge
  vaihtuu kuudessa), joten se on `#9C8447` ja 1,5·LW, ja ruudukko meni
  alfaan 0,55. Rajan kohdalta jätetään tavallinen ruudukkoviiva pois,
  jottei kaksi viivaa paksunna sitä. **FMI-rajamerkki pysyy vaaleassa
  hiekassa** (`#CDBE9A`) — se on kontekstia eikä päätöskynnys, ja juuri
  se ero on nyt näkyvissä.
- **MALLIN PALLO ON OMAN VIIVANSA VÄRINEN, PÄÄVIIVAN PALLO `ink()`.**
  Kaikki pallot värjättiin lukemalla (`ColorRamp.ink(v)`), eli ne
  kertoivat saman minkä pallon KORKEUS jo kertoo — ja kolme mallia
  samassa kohdassa saivat lähes saman värin (mitattu rgb(61,94,104) /
  rgb(60,93,93) / rgb(60,80,41)). Pallo on piste omalla viivallaan,
  joten se on viivan värinen; sama koskee selitteen riviä. Pääviiva on
  poikkeus, koska se EI ole yhtä väriä vaan karttarampin gradientti.
  Pallon kehä on VAALEA (`#FAF5E7`): tumma sulaisi sekä viivaan että
  tuuligradienttiin.
- **LUKEMALAATIKKO MENEE OSOITTIMEN SIVUUN, EI PALLOJEN PÄÄLLE.**
  Laatikko oli `translateX(-50%)` + `top: 4px` eli naulattu osoittimen
  päälle ja kuvaajan ylälaitaan: mitattuna se peitti **kaikki neljä
  palloa jokaisessa kolmessa osoituskohdassa**, ja vuoti kuvaajan yli
  (11 px vasemmalta, 18 px oikealta). Nyt se on sillä puolella
  osoitinviivaa jolla on tilaa, pystysuunnassa pallorypään keskellä ja
  kuvaajaan rajattuna — mitattu 0/4 peitossa kaikissa kolmessa.
  **RAKO ON PALLON SÄDE PLUS VÄLI** (`10 + 6·lw`): pelkkä kymmenen
  pikseliä jätti laatikon reunan täsmälleen pallon reunaan ja yksi
  neljästä jäi yhä alle.
- **LAAJAA KAAVIOTA VEDETÄÄN AJASSA, JA KÄÄRE SÄILYY VEDON YLI.**
  Laaja oli umpikuja: 24 h jaksolla kääreessä ei ollut vieritettävää
  lainkaan ja 5 vrk jaksolla sitä oli 382 px eli puolet kuvaajasta —
  mutta SVG:llä on `touch-action: none` ja `attachTooltip` kutsuu
  `preventDefault`ia, joten mitattu 168 px veto siirsi kaaviota 0 px.
  Nyt raahaus on sovelluksen omaa työtä ja tekee yhden asian: siirtää
  aikaa. Järjestys on se missä liike on halvinta — ensin kääreen oma
  vieritys, ja kun se on päässä, ikkuna siirtyy TUNNEITTAIN
  (`laajaSiirtoMs`, sarja on tuntihilalla). Kuuntelijat kiinnitetään
  KERRAN ja vain SVG kääreen sisällä vaihtuu; jos kääre korvattaisiin,
  raahaus kuolisi kesken eleen omaan uudelleenpiirtoonsa — sama ansa
  kuin päiväkiskossa. Tuore geometria talletetaan kääreelle
  (`kaare._d`), ei suljeta sulkeumaan. Siirto NOLLATAAN avattaessa ja
  jaksoa vaihdettaessa: muuten laaja aukeaisi johonkin eiliseen kohtaan
  ilman että mikään kertoisi miksi.
- **MALLIDATAA EI MITATA VERKOSTA.** Sama build antoi peräkkäisillä
  ajoilla 75 ja 0 malliviivaa, ja `wk.mjs`:n curl-välimuisti tallettaa
  myös epäonnistumisen. Mittari istuttaa sarjat sovelluksen OMAAN
  välimuistiin (`spot._modelCache`, avain
  `'_mc_'+nimi+'_'+floor(Date.now()/3600000)`) — se on sovelluksen oma
  polku, joten mitattava koodi on sama kummin päin.

**Havaintoasemat**

- **ASEMAREKISTERI ON YKSI: `FMI_MAP_STATIONS` + `PAIKALLISASEMAT`.**
  `_fmiStationsSorted` piti omaa kopiotaan, ja kopio oli jäänyt
  kahdeksaan asemaan kun kartalla oli yksitoista — puuttuivat `emasalo`,
  `porkkala` ja `hanko`, eli täsmälleen ne jotka ovat pääkaupunkiseudun
  ulkopuolella. Hangon spotti näytti Espoo Tapiolaa 112 km päästä vaikka
  samanniminen asema on 2 km päässä. Korjattuna 11/12 spottia sai
  lähemmän aseman. **Älä lisää asemaa vain toiseen paikkaan.**
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
- **HAVAINTOKAAVION TÄYTTÖ ON `paperi()` JA VIIVAT `--ink`.** Väri on
  funktio KORKEUDESTA, ei sarjasta: vaakaviipale korkeudella y saa sen
  nopeuden värin jota y edustaa. Älä sävytä viivoja rampilla — mitattuna
  `ink()` katoaa oman ramppinsa päälle (kontrasti 1,14–3,33, mediaani
  1,6, pohja 1,14 juuri 4–8 m/s kohdalla). Pienin kontrasti täyttöä
  vasten: `--ink` 3,94:1, `--ink-2` 1,61:1, `--ink-3` 1,25:1 — `--ink`
  on ainoa joka kestää. Yksi kanava, yksi merkitys: täyttö kantaa
  arvon, viivat muodon.
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
- **`padX` on MITATTAVA kortilla, ei laskettava.** Kortin SVG vuotaa
  22 px omaan täytteeseensä (`margin-left:-22px`), joten viewBox-yksiköt
  eivät kerro mihin y-akselin lukema ruudulla osuu: 22 jätti lukeman
  3,2 px otsikkopalstan ulkopuolelle, 24 tuo sen reunaan (−0,7 px).
- **Kaavion työkalurivi on `flex-start`, ei `space-between`.**
  Asemavalitsimen paikka on tyhjä havaintokortissa, ja `flex: 1`
  -välikkeenä se työnsi jaksovalitsimen keskelle riviä kun sulkunappi
  jäi oikealle — kaksi kohdistusta samalla rivillä. Laajennusnappi
  menee oikealle `margin-left:auto`illa, ja tyhjä paikka poistuu
  virrasta CSS:llä (`.hav-asemavalitsin:empty`), ei JS-lipulla.
- **ASEMAN NIMI SANOTAAN KERRAN, IKÄ SANOTAAN KERRAN.** Havainto-
  kortissa otsikko on aseman nimi, joten selite jättää sen pois;
  SPOTTIKORTISSA otsikko on spotin nimi ja selite on ainoa maininta
  käyrän lähteestä, joten siellä nimi JÄÄ. Ero luetaan
  `data-nimi-otsikossa`-lipusta, ja lippu luetaan ELEMENTILTÄ ITSELTÄÄN
  (`el.dataset`), EI `closest`illä — molemmat kortit asuvat samassa
  `#sheet-content`issä, ja esivanhempihaku veisi nimen sieltä missä se
  on välttämätön. Ikä on kuvaajan alla joka kortissa; hero-rivi
  mainitsee sen VAIN kun lukema on vanha (silloin se on varoitus eikä
  aikaleima).
- **Spottimerkkiä napauttava mittari on tarkistettava
  `State.sheetSpot`ista.** Lauttasaaressa Larun asemamerkki on spotin
  vieressä, ja kosketussäätö siirtää napautuksen siihen:
  `spottikaavio.mjs` avasi pitkään HAVAINTOkortin ja luuli sitä
  spottikortiksi — ja siitä päätyi kertaalleen raporttiin "spottikortin
  asemavalitsin on rikki", vaikka havaintokortissa sitä valitsinta ei
  kuulukaan olla.
- **Yöharso on täytön PÄÄLLÄ mutta viivojen ALLA.** Täytön alla se
  näkyy vain siellä missä täyttöä ei ole ja lukee korostuslaatikkona.
  Alfat (.13/.09/.05) ovat aikajanan kalibroinnista, älä säädä niitä
  erikseen.
- **Jakson kovin puuska saa aina lapun.** Muut huiput väistävät oikeaa
  reunaa, mutta se sääntö sulki kerran pois juuri sen luvun jonka
  "Kovin puuska" -ruutu sanoo (7 vrk: ruutu 31,9, kaavion suurin lappu
  29,0). Muille lapuille kynnys on 55 % vaihteluvälistä, jottei lappu
  mene keskitason kumpareelle.
- **Ei vaakavieritystä.** 24 h niputtuu ~110 pisteeseen eli 13 min per
  piste, mikä on tiheämpi kuin lähteen 30 min askel — muoto säilyy
  mahtumalla ruudulle. Vieritys myös söisi raahauksen, jolla kaaviota
  luetaan.
- **KOLME ASUA, YKSI PIIRTOFUNKTIO** (`HAV_ASU_KORTTI` / `_PYSTY` /
  `_LAAJA`). Kaikki mikä eroaa on taulukossa, ei koodihaaroissa. Älä
  kirjoita laajalle omaa piirtofunktiota.
- **Laajennus on VAAKANÄKYMÄ.** Aikasarja tarvitsee leveyttä: mitattuna
  kortti antaa 13,9 px/tunti, vaakaruutu 30,8 (24 h) ja 129 (6 h).
  Pystysuora täysi ruutu antaisi vain korkeutta, jota kortilla on jo yli
  (sisältö 541 px, näkyvä 595 px). Pystyasu on silti olemassa, koska
  ensimmäinen versio antoi pystyssä 373×145 px eli PIENEMMÄN kuin kortti
  (375×209) — laajennusnappi ei saa kutistaa kuvaajaa.
- **Asu valitaan laatikon muodosta, ei media querystä.** Työpöydän kapea
  ikkuna ja puhelimen vaaka ovat sama tilanne.
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
- **Kaavion korkeus ratkaistaan LAATIKOSTA** (`_asu()`), ei vakiona: SVG
  skaalautuu leveyden mukaan, joten kiinteä viewBox jätti pystyssä
  128 px käyttämättä. Lukemarivi on täytettävä ENNEN mittausta (sen
  korkeus muuttaa laatikkoa: 645 vs 625 px), ja avauksen jälkeen on
  piirrettävä uudestaan 180 ms:n kuluttua (kääntämällä avattaessa mitat
  eivät ole asettuneet: 714×187 vs 714×280).
- **`.hl-kaavio`-sivutäyte on 4 px**, koska kortin kaavio vuotaa 22 px
  omaan täytteeseensä. Leveämpi täyte tekee laajennetusta kaaviosta
  KAPEAMMAN kuin se oli kortilla (365 vs 375) — laajennus ei saa
  kaventaa mitään.
- **Liu'utusele alkaa vain kahvasta tai otsikkoriviltä.** Kuvaajan
  päällä raahaus on lukeman haku, joten sulkuele siellä sulkisi näkymän
  aina kun arvoa luetaan. Napit ohitetaan `closest('button')`illa.
- **Laajassa lukema menee kiinteälle riville, ei kelluvaan kuplaan** —
  kokonäytössä kupla jää sormen alle. Rivillä on levossa jakson
  tilastot ja raahatessa hetken arvot.
- **Lämpötila on VÄLI eikä käyrä.** Oma y-akseli tuulen rinnalla tekisi
  risteämisistä merkitseviä vaikka ne ovat mittayksikön sattumaa.
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
  siksi tyhjän vastauksen verkkoviaksi.
- **Vuosaaren satamassa EI OLE tuulihavaintoa.** FMISID 151028 lähetti
  viimeksi 18.8.2026 (mitattu puolitushaulla); asema on yhä FMI:n
  asemarekisterissä, joten rekisteri ei kerro sitä. Korvaajaa
  etsittiin viidestä lähteestä eikä sitä ole (FMI 12 km säteellä, HSY,
  Marine Helsinki, Digitraffic, dlarah.org). Älä lisää sitä takaisin
  kovakoodattuna eikä näytä naapuriaseman lukemaa sen kohdalla —
  merkki palaa itsestään jos FMI jatkaa lähettämistä.

**Aaltopoijut** (havainto — tämä on tuotannossa)

- **Yksi haku kattaa koko maan.** Rajapinnan `bbox` EI rajaa mitään
  (mitattu: sama 10 asemaa ja 62 829 tavua bboxin kanssa ja ilman).
  Ala tee asemakohtaisia hakuja tuoreimmalle lukemalle — se olisi
  kymmenen pyyntoa yhden hinnalla.
- **Lukema ei ole "nyt" eikä se seuraa aikajanaa.** Viive on mitattuna
  57–117 min, joten tuoreimman ikkuna on 6 h (3 h pudotti yhden aseman
  kymmenestä pois) ja kortti sanoo aina `ageMin`. Havaintoa
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
- **Poijun lukema tulee z8:lla, samalla kuin meriaseman** — mutta
  KAPEANA pillerinä, ja täysikokoisena vasta z9:stä. Kynnys yksin oli
  väärä ratkaisu: se teki poijusta toisen luokan havainnon
  (Suomenlahden poiju ilmestyi vasta Harmajan jälkeen). Kiinteä siirto
  pisteen yläpuolelle kokeiltiin ja se vain vaihtoi naapuria
  (Harmaja -> Malmi). Mitattu peitto z8:lla 36 % (perustason pari,
  ei poiju), z9–z12 0 %.
- **Aaltokaavion raahaus tarvitsee `touch-action: none`in ja
  `setPointerCapture`in**, ja lukeman on JÄÄTÄVÄ näkyviin sormen
  noustua — muuten napautus ei tee mitään. Ajastin palauttaa otsikon.
- **Peitto mitataan SISEMMÄSTÄ elementistä.** Leafletin `_icon`-kuori
  kantaa `translate3d`-sijainnin eikä liiku väistön mukana — kuoresta
  mitattu peitto valehtelee.
- **Väistön suunta lukitaan ensimmäisestä osumasta.** Ilman lukitusta se
  työntää ylös yhden ohi, törmää seuraavaan ja työntää takaisin alas:
  nettosiirto 3 px. Pistetilassa väistöä ei ajeta lainkaan.
- **Spottikortin aaltorivin raja on 60 km**, ja se on aukko mitatussa
  jakaumassa (kymmenen spottia 5–35 km, Hangon kaksi 114 ja 119 km).
  Rivillä on aina poijun nimi ja etäisyys — muuten se väittäisi
  mittaavansa spottia.
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
- **SADETUTKA EI SAA KÄYTTÄÄ FMI:N OMAA PALETTIA SELLAISENAAN.** Se on
  lähes sama sävyketju kuin tuuliramppi (syaani–vihreä–keltainen–
  oranssi–punainen–magenta), eli magenta väittäisi kartalla 20 m/s kun
  se tarkoittaa rankkasadetta. Kaksi ilmeistä korjausta on mitattu
  vääriksi: `styles=raster` on alfaltaan 255 kaikkialla ja sen harmaat
  1–109 ovat palettityylin läpinäkyvää kohinaa, ja `grayscale(1)` antaa
  kirkkauden joka poukkoilee (214 askeleesta 65 ylös, 139 alas).
  Ratkaisu on paletin taulukointi ja käännös takaisin voimakkuudeksi.
  Paletti on tavulleen sama pyynnöstä toiseen (tarkistettu).
- **PALETTI KÄÄNNETÄÄN MILLIMETREIKSI FMI:N OMISTA SELITTEISTÄ, ei
  Marshall–Palmerin kaavasta.** `suomi_dbz_eureffin` ja
  `suomi_rr_eureffin` ovat sama komposiitti kahtena tuotteena ja niillä
  on sama väriketju; `GetLegendGraphic&format=application/json` antaa
  molemmille värin ja raaka-arvon, ja rr:n raaka-arvo on mm/h
  sadasosina. Yhdeksän ankkuria osuu palettiin TARKALLEEN (dE 0,0) ja
  indeksit ovat tasan 21 välein. Väliin interpoloidaan LOGARITMISESTI
  (suhteet 1,8–2,5; lineaarinen antaisi 0,86:n ja 2,16:n puoliväliin
  1,51 kun oikea on 1,36). `Z = 303·R^1,5` on vain ristiintarkistus —
  älä korvaa taulukkoa sillä, ne eroavat alapäässä.
- **MASKI ON VOIMAKKUUTTA, EI ALFAA.** Tavu on paletin normalisoitu
  paikka; väri JA peittävyys johdetaan siitä piirrettäessä. Valmis alfa
  hävittäisi voimakkuuden, ja ennustehila tarvitsisi oman käyränsä —
  kaksi käyrää samalle asialle. **Lähteen alfa on osa voimakkuutta**:
  FMI häivyttää tihkun itse indekseillä 1..19, ja erillisenä kertoimena
  mm/h-luku olisi väärä vaikka kuva näyttäisi oikealta.
- **SADEKERROS SEURAA AIKAJANAA, ja ankkuri on VALITTU HETKI.** Kehykset
  laskettiin ennen `Date.now()`:sta, jolloin sama sade näkyi joka
  tunnilla. Hetki luetaan AJASTA (`_tutkaHetki` → `_tlTimeAt`), ei
  indeksistä. Arkisto on mitattu 7 vrk (PT5M) ja aikajanan menneisyys
  48 h, joten kate riittää; sen ulkopuolella kerros TYHJENEE ja sanoo
  sen. Luotain (`uusin()`) on eri asia kuin kehyslista — muuten jokainen
  tunnin askel maksaisi luotaimen.
- **RAJA TUTKAN JA ENNUSTEEN VÄLILLÄ ON AIKAJANAN NYT-TIKKI**, ja se
  haetaan SAMALLA pyöristyksellä kuin `nowIdx` (lähin tasatunti, ei
  kuluva). Kaksi virhettä samassa kohdassa: "tuorein kehys + askel"
  putosi tutkan 5–7 min viiveen takia ennusteeseen kello 22:02, ja
  "kuluva tunti" unohti että nyt-tikki on puolenvälin jälkeen jo
  SEURAAVA tunti (mitattu 18:33 UTC → tikki 19:00). Kahta sääntöä
  samalle "nyt"-käsitteelle ei saa olla. Tuorein kehys ratkaisee yhä
  KEHYSTEN ANKKURIN — siksi nyt-tikistä taaksepäin siirryttäessä
  kehykset liikkuvat VÄHEMMÄN kuin jana (5,50 h vs 6,00 h), ja siirron
  mittaus on tehtävä kahden MENNEEN tunnin välillä.
- **TYHJÄ TILA ON OMA LÄHTEENSÄ (`'tyhja'`), ei hilaton `'ennuste'`.**
  Muuten panorointi yrittäisi hakea ennustehilan menneelle tunnille joka
  on tutka-arkiston ulkopuolella — pyyntö johon lähde vastaa aina 400:lla.
- **LUOTAINTA EI AJETA ENNEN LÄHTEEN VALINTAA.** Tulevaisuuden tunti ei
  tarvitse tutkaa lainkaan, ja luotaimen epäonnistuessa "ei saatavilla"
  piilottaisi myös ennusteen — tutkan verkkovika veisi kerroksen jolla ei
  ole tutkan kanssa mitään tekemistä.
- **ENNUSTEESSA EI OLE SILMUKKAA.** HARMONIEn askel on tunti, ei viisi
  minuuttia; seitsemän kehystä olisi kuusi keksittyä välikuvaa. Silmukan
  pysähtyminen on samalla se merkki jolla käyttäjä huomaa siirtyneensä
  havainnosta ennusteeseen.
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
- **Tutkakerros on `overlayPane`ssa eikä `tilePane`ssa**, koska
  lämpökartta sekoittuu pohjakarttaan `plus-lighter`illä eikä tutka saa
  osallistua siihen summaan. Luokka on `.tutka-laatat` — EI
  `.heatmap-overlay`, joka kantaa elementin kokoon mitoitetun maskin ja
  leikkaisi 0×0-säiliöisen `GridLayer`in kokonaan pois.
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
- **Silmukka on SEITSEMÄN kehystä (30 min), ja luku tulee
  latausbudjetista.** Laatta on 1,5 kB kuivana ja 3–11 kB sateessa, eli
  yksi kehys on 18–88 kB ruudullista kohti. 12 kehystä (60 min) olisi
  yli megan juuri silloin kun kerros kytketään päälle. Älä kasvata
  lukua mittaamatta.
- **YKSI kerros ja alfamaskit, EI seitsemää päällekkäistä kerrosta.**
  Seitsemän `GridLayer`ia olisi Leafletin omaa koneistoa mutta laukaisisi
  seitsemät laattapyynnöt joka panoroinnilla. Maskit ovat
  `Uint8ClampedArray` (1 tavu/pikseli), koska väri on vakio: mitattu
  8,3 MB puhelimen ruudulla ja 16,5 MB työpöydällä — `ImageData`na
  nelinkertaiset. Kehyksen vaihto on 1,7 ms koko kerrokselle.
- **Silmukka käynnistyy vasta kun KAIKKI näkyvät laatat osaavat KAIKKI
  kehykset.** Muuten osa ruudusta olisi eri hetkestä kuin muu, ja juuri
  liikkeen suunta on se mitä kerroksesta luetaan — puolivalmis silmukka
  valehtelisi enemmän kuin pysäytyskuva.
- **`prefers-reduced-motion` NÄYTTÄÄ TUOREIMMAN, ei vanhinta.** Tässä oli
  vika: toisto käynnistyi vanhimmasta ja pysähtyi siihen heti, jolloin
  asetus näytti puoli tuntia vanhaa tutkakuvaa nykyhetkenä. Päätös on
  yhdessä paikassa (`Sadetutka.silmukassa()`) ja se ratkaisee myös
  latauksen: ilman silmukkaa kuutta vanhaa kehystä ei haeta lainkaan
  (12 pyyntöä 84:n sijaan).
- **Kehyksen aikaleima ei ole valinnainen.** Liikkuva kuva ilman kelloa
  ei kerro mitä hetkeä katsoo. Se on samalla rivillä lähdemerkinnän
  kanssa mutta vastakkaisessa reunassa — yksi rivi ylempänä se jäi
  aikajanan kortin taakse (mitattu: leima y 825–833, kortti alkaa
  y 756). `aria-live` on POIS: silmukka vaihtaa tekstin neljästi
  sekunnissa.
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
- **Aikaleimassa on vain kellonaika, ja se on Suomen aikaa.** Päiväys
  johdetaan nykyhetkestä; arkistotiedoston otsikon luontiaika on
  palvelimen omassa vyöhykkeessä (PDT) eikä kelpaa ankkuriksi.
  Vyöhykepoikkeama pyöristetään täysiin minuutteihin, muuten
  millisekunnit valuvat aikaleimoihin.
- **`history` on nulliksi tarkoituksella.** Ikkuna on 30 min eikä kata
  yhtäkään mennyttä tuntia, joten `_histValueAt` antaisi väärän luvun.
  Merkki näyttää aina tuoreimman ja kortti sanoo iän.
- **Kuluvalle vuorokaudelle ei ole pidempää historiaa.** Arkiston
  päivätiedosto kirjoitetaan vasta vuorokauden päätyttyä.
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
- **`history` TÄYTETÄÄN, toisin kuin Mellstenillä.** Lähde antaa koko
  kuluvan vuorokauden ~2 min välein, joten merkki osaa vastata myös
  aikajanan menneistä tunneista (mitattu: neljä tuntia, neljä eri
  lukemaa, ja paluu samaan arvoon). Mellstenin 30 min ikkuna ei riitä
  siihen, ja siksi sen `history` on nulliksi tarkoituksella.
- **Sarjan viimeinen piste on RAAKA tuorein havainto**, ei nipun
  keskiarvo — muuten kaavion pää ja kortin päälukema olisivat eri
  luvut samasta hetkestä.

**Kenttä ja data**

- **SOVELLUKSESSA ON KAKSI DATATASOA, ja ne antavat eri luvun.** Kartta
  (lämpökartta, kapseli, partikkelit) lukee `Saalaatat`-varastoa
  (Suomen rannikolla ja 66 tunnin sisällä HARMONIE 0,05°, muualla
  ECMWF 0,25°); aikajana ja spottikortit lukevat lähintä
  ennustepistettä, joka on Suomessa käytännössä aina spotti ja siis
  HARMONIE. Mitattu 3 893 vertailulla: ka 1,38 m/s, med 1,20, max 7,34,
  ja **86 % tunneista yli 0,5 m/s rajan**. Ero KASVAA tuulen mukana
  (0,82 → 2,78 m/s välillä 0–4 ja 10–14 m/s). Avomerellä 0,10 m/s,
  koska siellä molemmat tulevat varastosta. Älä oleta että jokin kartan
  luku ja jokin paneelin luku ovat samasta lähteestä.
- **AIKAJANA LUKEE VARASTOA, ei lähintä ennustepistettä**
  (`aikajananLahde`). Valinta tehtiin YHTENÄISYYDEN perusteella, ei
  tarkkuuden — älä purkaa sitä tarkkuudella ilman uutta mittausta.
  Mitattu jälkeen: aikajana on varaston sarja (4 764 vertailua, max ero
  0,000000). Kapselia vasten jää 0,24 m/s (max 0,73), ja se on
  INTERPOLOINTI eikä data: kapseli on bikuubinen solmuhila, aikajana
  bilineaarinen laattanäyte.
- **AIKAJANAN INDEKSI EI OLE SPOTIN INDEKSI.** Akselit eivät ala
  samasta hetkestä. `renderSpots`, `_spotVaistoMuuttuisi` ja
  `openSheet` hakevat indeksin AJASTA yhden funktion kautta
  (`_spotIdx`). Älä kirjoita neljättä polkua äläkä siirrä indeksiä
  sellaisenaan.
- **Kumpi taso on tarkempi EI OLE RATKAISTU.** Viiden asemaparin
  otoksesta vedettiin kerran johtopäätös "aikajana on tarkempi"; 48 h
  otos käänsi järjestyksen, ja siinäkin aikajanan otos oli vain 30
  paria (spottisarjan menneisyys kattaa ~6 h). Molemmilla on sama
  systemaattinen harha −1,79 m/s havaintoa vasten. Älä perustele
  tasojen valintaa tarkkuudella ilman uutta mittausta.
- **`WindTexture.hila` on kokonaan varastosta, eivätkä spotit ole
  siinä.** Kun se on olemassa, kaikki tähtäimen alla oleva luku tulee
  varastosta riippumatta siitä kuinka lähellä spotti on (mitattu 0,2 km
  päässä olevan spotin vaikutus lukemaan: ei mitään).
- **VARASTON PUUSKA EI OLE TUNNIN PUUSKA.** Se puuttuu joka toiselta
  kolmen tunnin askeleelta (mitattu 26/99), ja laattojen rakennus
  täyttää aukon tuulella (`puu[t] = nop[t]`) — eli suhde on siellä
  tasan 1,00. Ne askeleet joilla puuska on, ovat kuuden tunnin
  maksimeja: suhde 1,55–1,77, kun HARMONIEn tuntipuuska samassa
  pisteessä on 1,25 ja mitattu havainto 1,16. Älä näytä varaston
  puuskaa lukuna jonka pitää tarkoittaa yhtä tuntia — se vilkkuisi
  päälle ja pois joka toisella aikajanan askeleella. Kapselin puuska
  luetaan siksi lähimmästä RAJAPINTApisteestä (`_puuskaPiste`), ja sen
  etäisyysraja on `3 × step` lattialla 0,5° — TIUKEMPI kuin
  lähdemerkinnällä eikä siinä ole `LAHDE_RAJA_MIN`-lattiaa, koska
  puuska on paikan lukema eikä alueen mallin nimi.
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
  bikuubista varastonäytettä vastaan.
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
  INDEKSI EIKÄ KESTO.** Raja on `time[hh]`, ei "nyt + 48 h": spottidata
  palautetaan levyltä (`_restoreSpots`), jolloin sarja on voinut alkaa
  tunteja sitten ja kelloon sidottu raja osuisi väärään kohtaan.
  `harmonie_hours === 0` tarkoittaa ettei FMI:tä ole eikä rajaa
  piirretä. Ehto `State.activeModel === 'fmi_harmonie'` oli kuollutta
  koodia eikä voinut olla tosi kertaakaan.
- **KAAVION SELITE KUVAA NÄKYVÄÄ JAKSOA, TYÖKALUVIHJE OSOITETTUA
  TUNTIA.** Sarja vaihtaa lähdettä kesken matkaa, joten yksi nimi
  koko kaaviolle olisi väärin toisessa päässä: 24 h jaksolla selite on
  `FMI HARMONIE 2,5 km`, 5 vrk ja kaikki -jaksoilla
  `FMI HARMONIE 2,5 km → Open-Meteo`. Selite päivitetään jaksoa
  vaihdettaessa.
- **Rajaviivan lappu on rajan VASEMMALLA ja lukee "FMI päättyy".**
  Pelkkä "FMI" keskellä viivaa ei kerro kummalla puolella FMI on, ja
  juuri se on rivin koko asia.

- **Interpolointijärjestys: paikassa vektorit, ajassa nopeus ja suunta
  erikseen.** Suuntien aritmeettinen keskiarvo hyppää väärään suuntaan 0/360
  rajalla; vektorien interpolointi ajassa tekee vastakkaisten tuntien väliin
  keinotekoisen tyvenen. Molemmat on mitattu.
- **Kaikki aikasarjat pyydetään selaimen omassa vyöhykkeessä** (`AIKAVYOHYKE`).
  `timezone=auto` antaa jokaiselle pisteelle oman kellon ilman että
  merkkijonossa on vyöhykettä — kenttä hajoaa leveillä näkymillä.
- **Piste joka ei kata pyydettyä hetkeä jätetään pois kentästä**, ei kiinnitetä
  sarjansa päähän.
- **`/api` ei kuulu service workerin välimuistiin.** Sovelluksella on oma
  ennustevälimuisti joka osaa merkitä datan vanhaksi. Säälaatat ovat eri asia:
  ne ovat muuttumattomia ja versioituja (`?v=<ajoAika>`).

**Partikkelit**

- **JÄLJEN PITUUSRAJA ON 26 px (`JalkiViritys.maxPx`), EI 64.** Jäljet
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

- **Älä yritä neljättä derivaattapohjaista suodinta.** Lead compensation, Holt ja
  nollaviiveinen FIR kaatuivat kaikki samaan asiaan: näillä nopeuksilla
  derivaatta on lähes pelkkää vapinaa.
- **Eleen tila kulkee `nipistysAlkaa` / `nipistysPaattyy` -parin kautta**, ja
  molemmat zoom-eleet käyttävät sitä. Palautus on tehtävä jokaisella
  poistumistiellä, myös `touchcancel`issa.
- **Eleen ajaksi jäädytetty kerros on vapautettava `nipistysPaattyy`ssä**, ei
  vasta seuraavassa `_reset`issä. Sormen noustessa kartta liukuu maaliin
  Leafletin omalla animaatiolla, ja `_animateZoom` olettaa että elementin
  koko vastaa sen rajoja — jäädytetty koko ei vastaa, ja kerros lensi
  ruudun ulkopuolelle (musta välähdys).
- **`minZoom` ei rajaa nipistystä.** Leafletin `bounceAtZoomLimits` on
  oletuksena tosi ja päästää eleen käytännössä rajattomasti ali (mitattu
  3,46 tasoa, 92 % ruudusta paljasta taustaa). Raja tehdään joustona
  `getScaleZoom`issa — ei `_move`ssa, koska keskipiste lasketaan zoomista
  ja ankkuri valuisi.
- **Lämpökartta on LAATTAPYRAMIDI** (`SaaLaattaKerros`, `L.GridLayer`).
  Laatta ei liiku koskaan: siirto vain paljastaa uusia. Älä palauta
  näkymänkokoista tekstuuria uudelleenrakennuksineen — se ankkuroitui
  uudelleen kaksi kertaa yhtä sormenvetoa kohti (mitattu luisto z13:lla
  26 288 px), ja juuri se tuntui. Vanha polku on yhä olemassa
  varatienä (`?laatat=0`) mutta ei ole oletus.
- **Laattojen solmuhilan origo on GLOBAALISTI KOHDISTETTU**
  (`floor(x/d)*d`), ei laatan reuna. Muuten naapurit näytteistävät eri
  hilasta ja sauma näkyy. Mittari on `saumat.mjs`: ero sauman yli pitää
  olla enintään sama kuin vierekkäisten sarakkeiden ero laatan sisällä.
- **Laattakerros EI saa käyttää `.heatmap-overlay`-luokkaa.** Se kantaa
  reunahäivytyksen maskin, joka mitoitetaan elementin kokoon — ja
  `GridLayer`in säiliö on 0×0, joten maski leikkaa koko kerroksen pois
  (mitattu: täysin näkymätön vaikka laatat olivat kunnossa). Luokka on
  `.saa-laatat`, ilman maskia: pyramidilla ei ole datan reunaa.
- **`_tasoVuoro`N VALMIUSLASKENTA SAA LASKEA VAIN OMAN TASONSA
  LAATTOJA.** Se laski kaikki `current`-laatat zoomista riippumatta, ja
  se on väärin juuri sillä hetkellä jolla on väliä: Leaflet siirtää
  `_tileZoom`in uuteen zoomiin ja luo uuden tasoelementin ENNEN kuin
  edellisen zoomin laatat merkitään vanhoiksi. Mitattuna uuden tason
  syntyhetkellä `cur = 35, kesken = 0` vaikka uudessa tasossa oli NOLLA
  laattaa ja ne 35 olivat edellisen tason lapsia. Seuraus oli
  päinvastainen kuin `_tasoVuoro`n tarkoitus: **tyhjä uusi taso
  julistettiin valmiiksi ja näytettiin, ja edellinen VALMIS taso
  piilotettiin** (mitattu: taso 6 lapsia 35 alfa 0, taso 7 lapsia 0
  alfa tyhjä). Lämpökartta katosi siis hetkeksi joka zoomilla ja
  rakentui takaisin laatta kerrallaan — se on "kartta välkkyy
  zoomatessa". Portti on `t.coords.z !== this._tileZoom`.
  Mitattu jälkeen: 6/6 uutta tasoa syntyy näkymättömänä (ennen 0/6), ja
  peitto pysyy — 30 näytettä, ei yhtään hetkeä ilman painettua tasoa.
- **UUSI TASO SYNTYY NÄKYMÄTTÖMÄNÄ (`_updateLevels`).** Leaflet luo
  tasoelementin ja liittää siihen laattoja ennen kuin `_tasoVuoro` ehtii
  ajaa, ja elementti on oletuksena läpinäkymätön. Tämä oli kirjattu
  jäännökseksi "2–4 ruutua per zoom" ja seuraavaksi askeleeksi juuri
  tämä. Näkyvyys tulee sen jälkeen aina `_tasoVuoro`lta.
- **ESILATAUS KATTAA SEN MITÄ KERROS MAALAA, EI PELKKÄÄ NÄKYMÄÄ.**
  `_getTiledPixelBounds` laajentaa maalattavan alan kertoimella
  1 + 2·REUNUS (2,2×) zoomista `REUNUS_MIN_Z` ylöspäin, mutta
  `_esilataa` pyysi `map.getBounds()` eli paljaan näkymän — mitattu
  suhde 1,0. Reunuksen laatat jäivät siis esilatauksen ulkopuolelle ja
  hakivat datansa yksi kerrallaan `_valmista`ssa, joka EI kutsu `done`a
  ennen kuin haku on valmis: laatat jäävät näkymättömiksi yksi
  kerrallaan. Ehto on sama kuin kerroksella, joten esilataus ei kasva
  sinne missä reunusta ei ole. Mitattu jälkeen 2,2 (z ≥ 6) ja 1,0 (z 5).
- **ESILATAUKSEN KURISTUS SIIRTÄÄ, EI PUDOTA.** Zoom lähettää sekä
  `zoomend`in että `moveend`in, ja kaksi zoomia mahtuu helposti samaan
  puoleen sekuntiin: mitattuna kaksi zoomia 250 ms välein tuotti YHDEN
  esilatauksen kahden sijaan, eli LOPULLINEN näkymä jäi kokonaan
  esilataamatta. Pudotettu kutsu jää nyt ajastimeen. Mitattu jälkeen 2/2.
- **Pyramidista on näkyvissä TASAN YKSI taso, eikä laattoja häivytetä.**
  `L.GridLayer` on tehty läpinäkymättömille laatoille: se pitää isän
  näkyvissä kunnes lapset ovat valmiit ja häivyttää lapset sisään
  200 ms:ssä. Puoliläpinäkyvillä laatoilla ja lisäävällä sekoituksella se
  ei ole ristihäivytys vaan summa (`a + a(1−a) > a`) — kartta kirkastuu
  koko päällekkäisyyden ajan (mitattu 302–3418 ms zoomia kohti).
  `_tasoVuoro` valitsee näkyvän tason, `_updateOpacity` on korvattu.
  Älä palauta Leafletin häivytystä äläkä salli kahta painettua tasoa.
- **Peitto mitataan PIKSELEISTÄ, ei elementin rajoista.** Pyramidilla
  rajapohjainen mittari antaisi triviaalisti 100 %. Piilota pohjakartta
  ja partikkelit, jolloin kaikki ei-läpinäkyvä on lämpökarttaa — ja
  muista säästää `.saa-laatat`, ei `.heatmap-overlay`. Zoomin aikainen
  peitto vaatii ruutukaappauksen joka kompositointikehyksestä (CDP:n
  `Page.startScreencast`), ei `getBoundingClientRect`ia.
- **PYRAMIDI MAALAA NÄKYMÄÄ LAAJEMMALLE (`REUNUS` 0,6), JA LUKU TULEE
  GEOMETRIASTA.** Ulos zoomatessa Leaflet skaalaa vanhan tason säiliötä
  kertoimella 0,5, joten maalattua alaa on oltava PUOLI RUUTUA joka
  laidalla tai reunoille jää tyhjää; 0,6 eikä 0,5 siksi, että
  kaksoisnapautus zoomaa napautetun pisteen ympäri eikä keskeltä.
  Mitattu ennen: z12 -> z11 peitto putosi 58 %:iin, z13 -> z10 8 %:iin.
  Jälkeen 100 % joka kehyksellä molempiin suuntiin. **Reunus kattaa
  TASAN YHDEN tason** — kahden tason hyppy jää 55 %:iin ja vaatisi
  reunuksen 1,5 eli yhdeksänkertaisen laattamäärän. Älä kasvata sitä
  mittaamatta, äläkä ulota sitä uloimpiin näkymiin
  (`REUNUS_MIN_Z = 6`): siellä se maksaisi varastolaattoja eikä antaisi
  mitään, koska yksi säälaatta kattaa koko ruudun (mitattu z11 -> z5:
  99 % peitto ilman reunusta). Lähizoomissa reunus ei maksa yhtään
  tavua — laajennettu ala mahtuu samojen säälaattojen sisään.
- **Lämpökartta piirtyy GPU:lla kun laite kiihdyttää** (`GLKentta`,
  WebGL2). Varjostimen ja CPU-silmukan on annettava sama tulos: rivin
  leveysaste `ymercInv(myMax - r*myStep)`, sarake `lngMin + c*lngStep`
  (ei texelin keskipiste), ankkuri `clamp(floor(f), 1, g-3)`. Jos
  muutat toista polkua, muuta molemmat — pikselivertailu on
  `glruudulla.mjs`. Ramppi luetaan `pikseliLUT()`:n tavuista, ei
  lasketa uudelleen.
- **`failIfMajorPerformanceCaveat` ei estä ohjelmistorasterointia.**
  Mitattu: Chromium loi kontekstin SwiftShaderille sen kanssa yhtä
  lailla. Portti on renderöijän nimi (`swiftshader`, `llvmpipe`,
  `softpipe`, `basic render`, `software`). Nimen puuttuminen ei ole
  todiste — silloin päästetään läpi.
- **Kontissa ei ole GPU:ta.** WebGL ajetaan SwiftShaderilla, eli
  varjostin suoritetaan samalla kuristetulla suorittimella. GL-polun
  nopeuslukuja ei voi mitata täällä; oikeaa laitetta vastaan on
  mitattava. Pikselivastaavuus sen sijaan mitataan täällä hyvin.
- - **Lämpökartta on KAKSI kerrosta: tarkka ja karkea pohja.** Ne eivät
  ole koskaan yhtä aikaa näkyvissä levossa — kaksi lisäävää kerrosta
  päällekkäin laskettaisiin yhteen. Vuoro vaihtuu peittotarkistuksella
  ja summa pysyy ykkösessä, koska `plus-lighter` on lineaarinen. Reiän
  puhkaisu pohjan kankaaseen kokeiltiin ja mitattiin rikki: pohjan texel
  on lähizoomissa satoja pikseleitä eikä reikä mahdu sen hilaan.
- **Nipistys ei lähetä `move`- eikä `zoom`-tapahtumia** (Leaflet ajaa
  `_move`n `supressEvent`-lipulla). Eleen ajan tarvittava tarkistus on
  ajettava omassa ruutusilmukassa, ei tapahtuman varassa. Samasta
  syystä `State.liikkeessa` on epätosi nipistyksen aikana —
  `_nipistysKesken` on oma ehtonsa.
- **`_heatmapCovers` ei kelpaa zoom-liu'un EIKÄ nipistyksen aikana.** Sen rajat ovat
  lopputilan arvoja, elementti ei ole. Liu'un ajaksi peitto luetaan
  ruudulta (`getBoundingClientRect`).
- **Kerrosta ei piiloteta liu'un aikana.** Korvaava kerros on silloin
  itsekin kesken siirtymää, ja mitattuna peitto putosi nollaan.
- **Tekstuuria ei rakenneta liu'un aikana.** Rakennuksen päättävä
  `setBounds` on `_reset`, joka kirjoittaa koon kohdezoomille kesken
  transform-siirtymän; kerros kutistuu kahdesti.

**Jäädytys on kiinnitettävä VOIMASSA OLEVIIN rajoihin.** Lämpökartta
  rakennetaan uudelleen kesken eleen, ja vanhalla ankkurilla uusi laaja
  tekstuuri piirtyi vanhan pienen alueen kokoisena. `_heatmapCovers` on
  tälle sokea: mittaa elementin `getBoundingClientRect` suhteessa
  karttasäiliöön.
