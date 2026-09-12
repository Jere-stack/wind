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
- `tools/tiilet.mjs` — säälaattojen rakennus AWS Open Datan ECMWF-datasta.
  Ajetaan GitHub Actionsissa neljästi vuorokaudessa (`.github/workflows/`).
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
| `docs/ui.md` | paletteja, **sateen väriasteikkoa**, paneeleita, spottikorttia, aikajanaa, kapselia, havaintoasemia |
| `docs/pwa.md` | service workeria, offline-käynnistystä tai kotivalikon appia |
| `docs/lisadata.md` | uuden datan tai uuden lähteen lisäämistä — mitä on kokeiltu, mikä kaatui mittaukseen |

<details>
<summary>Osioiden nimet tiedostoittain (jos et tiedä mistä etsiä)</summary>

- **lampokartta**: Pohjakartta · Lämpökartta pohjakartan päällä · Lämpökartta on
  canvas, ei PNG · Väriasteikko — vain asetuspaneelissa · Lämpökartta jäi väärään
  mittakaavaan ulos zoomatessa · Kartan asetukset · Lämpökartan värit olivat eri
  kohdissa eri zoomeilla · Lämpökartta oli väärässä projektiossa · Nopea zoom ei
  saa näyttää mustaa
- **partikkelit**: Sujuvuus — mitattu, ei arvattu · Partikkelit ovat tasaisia —
  maa/vesi-rajaus kokeiltiin ja poistettiin · Rakeisuus oli kahta eri vikaa ·
  Kolme jatkokorjausta: heitto, lähizoomin terävyys, tiheys
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
  Kartan säämalli valittavaksi
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
  kolme kaaviota · Aikajana: päiväys paikalleen, yö kaistaksi

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
- **Aikajanan palkit ovat `ColorRamp.paperi()`, eivät `rgb()` eivätkä
  `ink()`.** Se on karttaramppi kerrottuna 0,48:lla: sävy on kartan,
  kirkkaus kortin paperin. Kerroin ei ole makuasia — 0,52 jätti limetin
  (10 m/s) 2,97:ään, 0,48 nostaa koko asteikon välille 3,84–13,46
  (mitatusta kortin sävystä 228,219,197) ja peräkkäisten nopeuksien
  pienin dE2000 on 10,7. `rgb()` on väärä koska paljas karttaramppi on
  paperilla 1,02:1; `ink()` on väärä koska se on oma sävypolkunsa eikä
  matchaa karttaan. Taulu ei seuraa pohjakarttaa (mitattu: sama palkki
  tummalla, vaalealla ja satelliitilla) mutta seuraa värisokeusasetusta.
- **AIKAJANALLA EI OLE URAA.** Kortti on yhtä paperia; päivärivi ja
  tuntirivi erottaa vain tyhjä tila (9 px). Ura oli kolmessa muodossa —
  tumma, hiekka, ja lopulta kaksi identtistä uraa (1,01:1 raidasta
  raitaan) — ja jokainen niistä oli reuna jota kortin oma reuna jo
  kertoi. Älä palauta uraa "jotta palkit näkyisivät": palkit saavat
  kortilla ENEMMÄN kontrastia kuin urassa (heikoin 3,41 → 3,84).
- **Uran päällä olleiden merkintöjen alfat on valittu VAIKUTUKSEN
  mukaan, ei luvun.** Yökaista on ollut kolmella eri alustalla ja sen
  voimakkuus on pidetty samana joka kerta: musta .34 tummalla uralla
  1,35:1, `76,89,96` .24 hiekkauralla 1,35:1, ja kortin paperilla sama
  .24 olisi 1,40:1 — eli uran poisto olisi vahingossa äänekkäämpi yö.
  Nyt .20/.129/.060 antaa 1,32:1. Puuskahuntu on samasta syystä muste
  .34 eikä valkoinen .22. Jos vaihdat alustaa, laske alfat uudelleen.
- **Päivälapuissa EI ole tuulikaistaa.** Kokeiltiin ja mitattiin
  toimivaksi (väri ja leveys sen päivän kovimmasta tuulesta valoisaan
  aikaan), mutta poistettiin: kahdeksantoista väripilkkua yhdellä
  rivillä on kahdeksantoista asiaa joita silmä lukee, ja sama tieto on
  tuntirivillä tarkempana. Kisko on navigointia, ei yhteenvetoa.
- **Kortin paljas paperi mitataan RIVIEN VÄLISTÄ.** Rivin sisältä otettu
  näyte osuu palkkiin, yökaistaan, NYT-osoittimeen tai napin varjoon —
  ja väittää sitten että sama paperi on eri väristä eri kohdissa.
- **Palkin korkeusasteikko on EPÄLINEAARINEN** (4–14 m/s levennetty) ja
  täysi mitta on 35 px. Korkeus on muoto, väri on arvo. Älä palauta
  lineaarista: se antaa 1,38 px/(m/s) ja peräkkäisten tuntien tyypillinen
  ero on 0,2 m/s eli alle puoli pikseliä.
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

- **KARTAN SÄÄMALLIN OLETUS ON `auto` ELI VARASTO, EIKÄ SITÄ SAA
  VAIHTAA.** Varasto (ECMWF 0,25°, esilaskettu) ei maksa
  rajapintakiintiötä, ei tee pyyntöjä panoroinnissa ja antaa 3400
  pistettä; pakotettu malli pudottaa katon 600:aan ja maksaa pyyntöjä
  joka näkymästä. Mitattuna kylmä käynnistys pakotetulla mallilla on
  ~22 s kun varastolla kartta on pystyssä ~3 s:ssa. Pakotus on
  "tarvittaessa"-valinta.
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
- **Palkin korkeus on KIINTEÄLLÄ asteikolla (14 m/s = täysi, 44 px).**
  Sarjakohtainen maksimi teki palkeista vertailukelpoisia vain sarjan
  sisällä, ja sarja vaihtuu joka kartansiirrolla: mitattuna 7,67 m/s oli
  14,1 px ja 8,40 m/s 13,4 px. Älä palauta `maxMs`-skaalausta.
- **KATTO ON 14 m/s, EI 16, ja korkeus 44 px, ei 35.** Molemmat
  palvelevat erottelua siellä missä päätös tehdään: väli 4–11 m/s sai
  4,4–4,7 px metriä sekunnissa kohti (ennen 2,6–3,1), ja 4 → 10 m/s on
  nyt 27 px ero (ennen 17). Yli neljäntoista väli menetti korkeuseron
  kokonaan — se on tarkoitus, siellä ei valita keliä vaan kokoa, ja väri
  jatkaa kyllästymisen jälkeen.
- **PUUSKAHUNTU EI SAA KADOTA KYLLÄSTYNEELLÄ PALKILLA.** Kun sekä tuuli
  että puuska ovat yli katon, korkeuksien erotus on nolla — eli
  myrskyssä, jossa puuskaisuus on tärkeintä, huntu häviäisi. Silloin
  korkeus on kiinteä 3 px eikä yritäkään kertoa määrää; tieto on
  alfassa, kuten muutenkin katon sitoessa.
- **KORTIN KORKEUS ON SUMMA, EI YKSI LUKU.** `#tl-wrap` on
  `97px + var(--tl-paivat-h) + var(--sab-tl)`, ja tuntinauha saa siitä
  sen mikä jää täytteiden jälkeen (61 px). Palkkia ei voi kasvattaa
  koskematta siihen 97:ään. Kisko 40 -> 30 ja nauha 52 -> 61 pitivät
  hereillä olevan kortin ennallaan (128 -> 127); levossa se kasvoi
  88 -> 97, ja se on korkeampien palkkien väistämätön hinta.
- **YÖ ON 2 px KAISTA TIKIN ALALAIDASSA, EI KOKO KORKEUDEN HARSO.**
  Harso (`rgba(76,89,96,.20)` + kaksi astetta) oli mitattu ja
  kalibroitu, mutta se oli rivin suurin muoto ja häiritsi lukemista.
  Kaista mahtuu `.htick`in olemassa olevaan 2 px alatäytteeseen, joten
  se ei vie palkilta korkeutta eikä muuta kortin mittoja. Mitattuna se
  on samalla kertaa PIENEMPI ja SELVEMPI: yö 4,71:1 paperiin, kun
  vanha koko korkeuden harso oli 1,31:1. Päiväerotin saa saman
  kaistan, muuten keskiyöhön jää 34 px aukko. Älä palauta harsoa
  äläkä piirrä auringon korkeutta käyränä — se olisi toinen jatkuva
  muoto palkkien rinnalle.
- **VALOKAISTAN VÄRIT OVAT YHDESSÄ REKISTERISSÄ (`VALO_VARIT`).**
  Spottikortin kaavio ja aikajana kertovat saman asian ja kertoivat sen
  ennen eri sävyillä. Kaavio lukee literaalit (SVG:n
  esitysattribuutit eivät tunne `var()`:ia), aikajana CSS-muuttujat
  jotka `_valoVaritCssiin()` kirjoittaa — kaksi muotoa, yhdet luvut.
- **Aikajanan valokaista ja puuskavyöhyke päivitetään MYÖS nopeassa
  polussa**, ja päiväerottimet ovat oma taulukkonsa (`_tlErottimet`).
  Ne eivät ole `_tlTicks`issä, ja ilman erillistä päivitystä ne jäivät
  edellisen sijainnin sävyyn (mitattu 0/18 oikein). `_tlMuisti`-vertailu
  sisältää lat/lng, koska laattapisteet jakavat aikataulukon.
- **Nuolinäppäimet kuuluvat Leafletille.** Sen `Keyboard` panoroi karttaa
  nuolilla eikä tarkista shiftiä (vain alt/ctrl/meta), joten Shift+nuoli
  panoroi myös. Aikajanan askellus on `,` ja `.`, ja shiftattu merkki on
  eri `e.key` (suomalaisella `:` ja `;`) — lue `e.code`.
- **Play ja kelihyppy KELLUVAT URAN PÄÄLLÄ, ja erottuvat kohotuksella.**
  Ne peittävät mobiilissa 6 näkyvää tuntia 17:stä (35 %; työpöydällä
  8 %) — se on kelluvan kontrollin tietoinen hinta, ei huomaamatta jäänyt
  vika, ja siirto kiskoriville on kokeiltu ja peruttu (transportti kuuluu
  sen raidan päälle jota se ajaa). Näkyvyyttä EI korjata tummentamalla
  nappia: se tekisi kontrollista kortin äänekkäimmän elementin datan
  päällä. Kiekko on uraa VAALEAMPI (`--surface-hi`) + kehä + varjo:
  1,56:1 alustaan, kuvake 16,4:1 kiekkoon. Käytöstä poissa oleva nappi
  menettää kohotuksen — ei `opacity`, joka haalistaa myös varjon.
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
- **PÄIVÄYS SANOTAAN KERRAN.** Kupla ja kisko ovat päällekkäin, ja kun
  kisko näkyy, valittu päivä lukee tummassa pillerissä täsmälleen
  osoittimen kohdalla. Kuplassa on silloin VAIN kellonaika; päiväys
  palaa siihen vasta kun kisko painuu lepoon. Teksti kirjoitetaan
  `_tlKuplaTeksti`ssä ja ajetaan MYÖS kiskon heräämisestä ja
  nukahtamisesta — pelkkä valinnan siirto jättäisi tekstin edellisen
  tilan mukaiseksi seuraavaan tuntiin asti.
- **KISKO SEURAA OSOITINTA JATKUVASTI** (`_tlKiskoKeskita`), ei päivä
  kerrallaan: se on sama akseli karkeampana. Osuus lapun sisällä tulee
  TIKKIVÄLILTÄ (`_i0.._i1`) eikä kellonajasta — akselin reunapäivät ovat
  vajaita, ja kellonajasta laskettuna vajaan päivän ensimmäinen tunti
  olisi heti 58 %:n kohdalla. Kutsu on `_tlUpdateNow`in JÄLKEEN:
  `_tlKorostaPaiva` keskittää `currentHourIdx`:n mukaan, ja raahatessa
  se luku on vielä edellisessä tikissä. `scrollLeft` kirjoitetaan
  suoraan, EI `scrollTo`lla — pehmeä vieritys hakisi sormea vastaan.
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
- **Päiväkisko on levossa PIILOSSA, ja se palaa MISTÄ TAHANSA
  kosketuksesta aikajanaan** — ei vain raahauksesta. Kisko on olemassa
  raahauksen välttämiseksi (12 ruudullista viikon päähän), joten se ei
  saa vaatia raahausta. Päiväys on siksi kuplassa: piilossa ei saa olla
  tietoa jota ei näy muualla. Lepoaika alkaa SORMEN NOUSUSTA, ei
  kosketuksesta — pelkkä ajastin nukuttaisi kiskon kesken pitkää
  raahausta (mitattu 6,5 s eleellä). Toiston aikana ei herätetä.
- **Kiskon korkeus on yksi muuttuja (`--tl-paivat-h`)**, joka kasvattaa
  kääreen korkeutta ja sen ylätäytettä yhtä paljon. Siksi piilotus ei
  siirrä tuntiriviä eikä nappeja pikseliäkään (mitattu 0 px, kortti
  128 → 88). Jos erotat luvut, ne ajautuvat erilleen ensimmäisessä
  säädössä.
- **Aikajanan valinta kulkee `_tlValitseIdx`:n kautta** (päiväkisko,
  näppäimistö, kelihyppy). Älä kirjoita neljättä polkua.
- **Päiväkiskon napautus ei saa käyttää `scrollTimelineTo`a.** Kupla ja
  päiväkorostus päivittyvät VIERITYKSEN mukaan, joten pehmeä animaatio
  kävelee jokaisen välipäivän läpi (mitattu 15 välitilaa ja 1001 ms
  ennen kuin oikea päivä jäi voimaan). Pitkä hyppy asetetaan suoraan
  `_tlSetScrollLeft`illä.
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
  (ECMWF 0,25°); aikajana ja spottikortit lukevat lähintä
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
  muista säästää `.saa-laatat`, ei `.heatmap-overlay`.
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
