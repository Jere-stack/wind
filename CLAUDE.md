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
  FMI:n aaltopoijut, Kruunuvuorenselän, Mellstenin ja Uiraan mittausdata
  -proxyt).
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
| `docs/ui.md` | paletteja, paneeleita, spottikorttia, aikajanaa, kapselia, havaintoasemia |
| `docs/pwa.md` | service workeria, offline-käynnistystä tai kotivalikon appia |

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
  lukua · Mellsten (Haukilahti) — kolmas oma proxy
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
  meriaseman · Aaltopoijun kaavion voi raahata

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
- **Palkin korkeus on KIINTEÄLLÄ asteikolla (16 m/s = täysi).**
  Sarjakohtainen maksimi teki palkeista vertailukelpoisia vain sarjan
  sisällä, ja sarja vaihtuu joka kartansiirrolla: mitattuna 7,67 m/s oli
  14,1 px ja 8,40 m/s 13,4 px. Älä palauta `maxMs`-skaalausta.
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

**Aaltoennuste** (EI tuotannossa — peruttu erä `5150fc1`)

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
- **Lähdemerkintä kertoo TÄHTÄIMEN lukeman lähteen.** Se luki ennen
  lähimmän ennustepisteen lähteen ja sanoi siksi Helsingissä HARMONIE
  vaikka luku tuli varastosta. Jos muutat kumpaakaan polkua, tarkista
  että merkintä seuraa sitä polkua josta luku oikeasti tulee.

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
