# FoilSpot

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (Leaflet) + tuuliennusteet
(oma säälaattavarasto, FMI HARMONIE, Open-Meteo, FMI-havaintoasemat) yhdessä
self-contained HTML-sivussa.

## Ajokomennot

```bash
npm install       # asenna riippuvuudet
npm run dev       # käynnistä Vite dev-serveri (http://localhost:5173)
npm run build     # tuota tuotantobuild hakemistoon dist/
npm run preview   # esikatsele tuotantobuildia paikallisesti
npm run saadata   # rakenna säälaatat (tools/laatat.mjs)
```

## Rakenne

- `index.html` — koko sovellus: CSS, HTML ja JS yhdessä tiedostossa (ei erillistä
  `src/`-hakemistoa). Leaflet ladataan CDN:stä `<script>`-tagilla.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  FMI:n aaltopoijut, Kruunuvuorenselän, Mellstenin, Larun ja Uiraan
  mittausdata-proxyt).
  ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
- `tools/laatat.mjs` — säälaattojen rakennus AWS Open Datan ECMWF-datasta.
  Ajetaan GitHub Actionsissa neljästi vuorokaudessa (`.github/workflows/`).
- `tools/suunnat.html` — spottien tuulisuuntien asetustyökalu. `npm run dev`,
  sitten `/tools/suunnat.html`. Ei kuulu tuotantobuildiin. Lukee spotit
  `index.html`:stä ajossa, joten lista ei vanhene.
- `public/sw.js` — service worker. `__BUILD_ID__` korvataan buildissa.
- `vite.config.js` — build-asetukset sekä `vercel-api-dev`-plugin, joka ajaa
  `api/*.js`-funktiot myös `npm run dev`- ja `npm run preview` -servereissä.
- `vercel.json` — Vercel-deployn asetukset.
- `.claude/settings.json` — Claude Coden projektiasetukset. Poistaa
  istuntokontekstista niiden skillien kuvaukset joita tämä projekti ei käytä
  (ne pysyvät silti käsin kutsuttavina `/nimi`:llä) ja sallii projektin omat
  luku- ja buildkomennot ilman lupakyselyä.
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
  lukua · Mellsten (Haukilahti) — kolmas oma proxy · Varaston puuska on
  joka toisella askeleella tuuli · Laru (Lauttasaari) — neljäs oma proxy
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
  siivous: väriliuska pois ja neljä kahdennusta

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

**Rajaa haun tuloste `index.html`:ssä.** Tiedosto on 1,1 MB ja sisältää
base64-kuvia, joten sitomaton `grep` voi palauttaa satoja kilotavuja yhdellä
osumalla. Käytä `-c`, `head -20`, `-o` tai kapeaa hakua — koko rivi
harvoin tarvitaan, ja base64-rivi ei ole koskaan se mitä etsit.

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

Nämä ovat päätöksiä, eivät makuasioita. **Tässä on vain se mitä ei saa
tehdä vahingossa. Jokaisen säännön perustelu, mittaus ja jo kokeillut
vaihtoehdot ovat aiheen omassa `docs/`-tiedostossa** — sääntö kertoo
MITÄ, docs kertoo MIKSI. Lue se tiedosto ennen kuin muutat aluetta jota
sääntö koskee; älä kumoa sääntöä ilman että olet lukenut sen perustelun.

**Nimi ja versio** — perustelut: `docs/pwa.md`

- **Sovelluksen nimi on `FoilSpot` ja sen kanssa kulkeva tunnuslause `wingfoil-sää`.**
- **NIMESSÄ EI OLE VERSIOTA.**
- **Kuvaus on yksi merkkijono.**
- **Laatta on `laatta`, ei `tiili`.**

**Väri** — perustelut: `docs/ui.md`, `docs/lampokartta.md`

- **Kartalla sävy tarkoittaa tuulennopeutta ja vain sitä.**
- **Aikajanan palkit ovat `ColorRamp.paperi()`, eivät `rgb()` eivätkä `ink()`.**
- **AIKAJANALLA EI OLE URAA.** Älä palauta uraa "jotta palkit näkyisivät": palkit saavat kortilla ENEMMÄN kontrastia kuin urassa (heikoin 3,41 → 3,84).
- **Uran päällä olleiden merkintöjen alfat on valittu VAIKUTUKSEN mukaan, ei luvun.**
- **Päivälapuissa EI ole tuulikaistaa.**
- **Kortin paljas paperi mitataan RIVIEN VÄLISTÄ.**
- **Palkin korkeusasteikko on EPÄLINEAARINEN (4–14 m/s levennetty).** Älä palauta lineaarista: se antaa 1,38 px/(m/s) ja peräkkäisten tuntien tyypillinen ero on 0,2 m/s eli alle puoli pikseliä.
- **`ColorRamp.rgb()` on kartalle, `ink()` paneeleihin.**
- **Kartan oletusramppi on kylläinen ja tehty normaalinäköiselle (sininen–syaani–vihreä–keltainen–oranssi–punainen–magenta).** Älä palauta vaimeaa ramppia oletukseksi vetoamalla värisokeuteen.
- **Rampin kylläisyys ruudulla on suunnilleen kroma KERTAA alfa.**
- **`--accent` (magenta) on toiminto- ja varoitusväri, ei korostusväri.**
- **`var()` ei toimi SVG:n esitysattribuuteissa.**

**Saavutettavuus** — perustelut: `docs/ui.md`

- **Kontrolli on `<button>`, ei `<div class="mctl">`.**
- **Suljettu paneeli piilotetaan `visibility: hidden`illä.**
- **Esc sulkee KAIKKI päällekkäiset pinnat.**
- **Sivulla on `h1` ja `role="main"`, ja ohituslinkki on ensimmäinen fokusoitava elementti.**
- **`role="button"` ei riitä divillä.**
- **Piilota valintaruutu leikkauksella, älä `display: none`llä.**
- **Päällekkäinen pinta kulkee `Modaali`-moduulin kautta.** Älä kirjoita viidettä polkua.
- **`aria-modal` EI pidättele sarkainta.**
- **`Modaali.avaa` on IDEMPOTENTTI.**
- **Paluukohde etsitään uudelleen, ei pelkkää viitettä.**
- **Fokus menee dialogin SÄILIÖÖN, ei ensimmäiseen kontrolliin.**
- **Otsikoksi vaihdettu `div` tarvitsee `margin: 0`.**
- **Havaintoasemien merkit ovat `keyboard: false`.**
- **Asetuspaneelin roolit luetaan RAKENTEESTA, ei kirjoiteta markupiin.**
- **Siruryhmä on `radiogroup`, ei nappirivi.**
- **Nuolet paneelissa vaativat `stopPropagation`in.**
- **Aria-tila synkataan MutationObserverilla.**
- **Pyöreän napin kulma ei ole nappi.**

**Asetukset** — perustelut: `docs/ui.md`

- **Partikkelien ja väriasteikon AVAIMIA ei saa vaihtaa.**
- **Oletus on siruryhmässä ensimmäisenä vasemmalla (tuuli, kts, tumma, partikkelit-Normaali).**
- **Yksikkölista on samassa järjestyksessä asetuspaneelissa ja kapselin valitsimessa.**

**Aikajana** — perustelut: `docs/ui.md`

- **`currentHourIdx` on INDEKSI, ja aika-akseli vaihtuu kartan mukana.** Älä koskaan siirrä indeksiä sellaisenaan akselilta toiselle — hae uusi indeksi AJASTA (`_tlSailytaHetki`).
- **Älä tihennä aikajanaa tuntia pienemmäksi.**
- **Palkin korkeus on KIINTEÄLLÄ asteikolla (16 m/s = täysi).** Älä palauta `maxMs`-skaalausta.
- **Aikajanan valokaista ja puuskavyöhyke päivitetään MYÖS nopeassa polussa.**
- **Nuolinäppäimet kuuluvat Leafletille.**
- **Play ja kelihyppy KELLUVAT URAN PÄÄLLÄ, ja erottuvat kohotuksella.**
- **Nappien peitto mitataan MOLEMMISSA suunnissa.**
- **Päivälapun tuulikaista: LEVEYS on muoto, VÄRI on arvo.**
- **Kaistat päivitetään MYÖS nopeassa polussa.**
- **Päiväkisko on levossa PIILOSSA, ja se palaa MISTÄ TAHANSA kosketuksesta aikajanaan.**
- **Kiskon korkeus on yksi muuttuja (`--tl-paivat-h`).**
- **Aikajanan valinta kulkee `_tlValitseIdx`:n kautta (päiväkisko, näppäimistö, kelihyppy).** Älä kirjoita neljättä polkua.
- **Päiväkiskon napautus ei saa käyttää `scrollTimelineTo`a.**
- **Laattavaraston akseli on 3 h (ja 6 h yli 7,5 vrk).**

**Havaintoasemat** — perustelut: `docs/ui.md`

- **HAVAINTOKAAVION TÄYTTÖ ON `paperi()` JA VIIVAT `--ink`.** Älä sävytä viivoja rampilla — mitattuna `ink()` katoaa oman ramppinsa päälle (kontrasti 1,14–3,33, mediaani 1,6, pohja 1,14 juuri 4–8 m/s kohdalla).
- **`gradientUnits="userSpaceOnUse"` on pakollinen.**
- **KUVAAJASSA EI OLE VÄRILIUSKAA.** Älä palauta sitä; jos värin merkitys joskus pitää sanoa ääneen, se sanotaan selitteessä sanoina.
- **`padX` on MITATTAVA kortilla, ei laskettava.**
- **Kaavion työkalurivi on `flex-start`, ei `space-between`.**
- **ASEMAN NIMI SANOTAAN KERRAN, IKÄ SANOTAAN KERRAN.**
- **Spottimerkkiä napauttava mittari on tarkistettava `State.sheetSpot`ista.**
- **Yöharso on täytön PÄÄLLÄ mutta viivojen ALLA.**
- **Jakson kovin puuska saa aina lapun.**
- **Ei vaakavieritystä.**
- **KOLME ASUA, YKSI PIIRTOFUNKTIO (`HAV_ASU_KORTTI` / `_PYSTY` / `_LAAJA`).** Älä kirjoita laajalle omaa piirtofunktiota.
- **Laajennus on VAAKANÄKYMÄ.**
- **Asu valitaan laatikon muodosta, ei media querystä.**
- **Kääntö sulkee vain jos näkymä avattiin kääntämällä.**
- **LAAJA NÄKYMÄ ON `inset: 0`, JOTEN SE TARVITSEE TURVA-ALUEET KAIKILLA NELJÄLLÄ SIVULLA.**
- **Kaavion korkeus ratkaistaan LAATIKOSTA.**
- **`.hl-kaavio`-sivutäyte on 4 px.**
- **Liu'utusele alkaa vain kahvasta tai otsikkoriviltä.**
- **Laajassa lukema menee kiinteälle riville, ei kelluvaan kuplaan.**
- **Lämpötila on VÄLI eikä käyrä.**
- **`wsMin` EI OLE lähteen tyyni vaan nipun sisäinen minimi.**
- **KATKO JA LAKKAUTUS OVAT ERI ASIA.** Älä poista mitään verkkovian perusteella: mitattuna `/api/fmi`:n katkaisu jättää kaikki 13 merkkiä paikalleen, ja ilman erottelua yksi katko pyyhkisi havaintoasemat kartalta.
- **Vuosaaren satamassa EI OLE tuulihavaintoa.** Älä lisää sitä takaisin kovakoodattuna eikä näytä naapuriaseman lukemaa sen kohdalla — merkki palaa itsestään jos FMI jatkaa lähettämistä.

**Aaltopoijut** (havainto — tämä on tuotannossa) — perustelut: `docs/ui.md`

- **Yksi haku kattaa koko maan.** Ala tee asemakohtaisia hakuja tuoreimmalle lukemalle — se olisi kymmenen pyyntoa yhden hinnalla.
- **Lukema ei ole "nyt" eikä se seuraa aikajanaa.**
- **Kaikki poijut eivät mittaa aaltoja.** Älä keksi sille omaa asua.
- **Asemat luetaan vastauksesta, ei kovakoodatusta listasta.**
- **Aallonkorkeus on MUSTETTA, ei väriä.**
- **Aaltopillerin glyfi ei ole vedenlämmön glyfi.**
- **Poijun lukema tulee z8:lla, samalla kuin meriaseman.**
- **Aaltokaavion raahaus tarvitsee `touch-action: none`in ja `setPointerCapture`in.**
- **Peitto mitataan SISEMMÄSTÄ elementistä.**
- **Väistön suunta lukitaan ensimmäisestä osumasta.**
- **Spottikortin aaltorivin raja on 60 km.**
- **Aaltokaavion y-akseli alkaa NOLLASTA.**

**Aaltoennuste** (EI tuotannossa — peruttu erä `5150fc1`) — perustelut: `docs/data.md`

- **Aaltoennuste on kytkimen takana (`Asetukset.arvot.aallot`).**
- **Vain `wave_height`, ei tuuli/maininki-jakoa.**
- **`isMarine` EI ole maa/vesi-testi.**
- **Välimuistin avain on 0,05° hilalla.**

**Mellsten (Surfing ry, Haukilahti)** — perustelut: `docs/data.md`

- **Keskituuli on rivin KOLMAS luku (`min < ka < max`).**
- **Aikaleimassa on vain kellonaika, ja se on Suomen aikaa.**
- **`history` on nulliksi tarkoituksella.**
- **Kuluvalle vuorokaudelle ei ole pidempää historiaa.**
- **Sijainti 60,147 / 24,794 on Windyn PWS-tietueesta.**

**Laru (dlarah.org, Lauttasaari)** — perustelut: `docs/data.md`

- **Lähde vaatii User-Agentin.**
- **Asemalla EI OLE lämpömittaria.** Älä muuta sitä viivaksi — viiva tarkoittaa "ei juuri nyt", ja FMI-asemilla se on yhä oikea (lippu on `false` eikä puuttuva juuri siksi).
- **Lukemat ovat m/s.**
- **`history` TÄYTETÄÄN, toisin kuin Mellstenillä.**
- **Sarjan viimeinen piste on RAAKA tuorein havainto.**

**Kenttä ja data** — perustelut: `docs/data.md`

- **SOVELLUKSESSA ON KAKSI DATATASOA, ja ne antavat eri luvun.** Älä oleta että jokin kartan luku ja jokin paneelin luku ovat samasta lähteestä.
- **AIKAJANA LUKEE VARASTOA, ei lähintä ennustepistettä (`aikajananLahde`).**
- **AIKAJANAN INDEKSI EI OLE SPOTIN INDEKSI.** Älä kirjoita neljättä polkua äläkä siirrä indeksiä sellaisenaan.
- **Kumpi taso on tarkempi EI OLE RATKAISTU.** Älä perustele tasojen valintaa tarkkuudella ilman uutta mittausta.
- **`WindTexture.hila` on kokonaan varastosta, eivätkä spotit ole siinä.**
- **VARASTON PUUSKA EI OLE TUNNIN PUUSKA.** Älä näytä varaston puuskaa lukuna jonka pitää tarkoittaa yhtä tuntia — se vilkkuisi päälle ja pois joka toisella aikajanan askeleella.
- **Kapselin puuska on NELJÄS `_spotIdx`-paikka.**
- **Lähdemerkintä kertoo TÄHTÄIMEN lukeman lähteen.**
- **Interpolointijärjestys: paikassa vektorit, ajassa nopeus ja suunta erikseen.**
- **Kaikki aikasarjat pyydetään selaimen omassa vyöhykkeessä (`AIKAVYOHYKE`).**
- **Piste joka ei kata pyydettyä hetkeä jätetään pois kentästä.**
- **`/api` ei kuulu service workerin välimuistiin.**

**Partikkelit** — perustelut: `docs/partikkelit.md`

- **Älä lisää maa/vesi-rajausta.**
- **Leveys ja määrä on viritetty yhdessä.**
- **Älä jäädytä partikkeleita eleen ajaksi.**

**Eleet** — perustelut: `docs/eleet.md`, `docs/lampokartta.md`

- **Älä yritä neljättä derivaattapohjaista suodinta.**
- **Eleen tila kulkee `nipistysAlkaa` / `nipistysPaattyy` -parin kautta.**
- **Eleen ajaksi jäädytetty kerros on vapautettava `nipistysPaattyy`ssä.**
- **`minZoom` ei rajaa nipistystä.**
- **Lämpökartta on LAATTAPYRAMIDI (`Laattakerros`, `L.GridLayer`).** Älä palauta näkymänkokoista tekstuuria uudelleenrakennuksineen — se ankkuroitui uudelleen kaksi kertaa yhtä sormenvetoa kohti (mitattu luisto z13:lla 26 288 px), ja juuri se tuntui.
- **Laattojen solmuhilan origo on GLOBAALISTI KOHDISTETTU.**
- **Laattakerros EI saa käyttää `.heatmap-overlay`-luokkaa.**
- **Pyramidista on näkyvissä TASAN YKSI taso, eikä laattoja häivytetä.** Älä palauta Leafletin häivytystä äläkä salli kahta painettua tasoa.
- **Peitto mitataan PIKSELEISTÄ, ei elementin rajoista.**
- **Lämpökartta piirtyy GPU:lla kun laite kiihdyttää (`GLKentta`, WebGL2).**
- **`failIfMajorPerformanceCaveat` ei estä ohjelmistorasterointia.**
- **Kontissa ei ole GPU:ta.**
- **Lämpökartta on KAKSI kerrosta: tarkka ja karkea pohja.**
- **Nipistys ei lähetä `move`- eikä `zoom`-tapahtumia (Leaflet ajaa `_move`n `supressEvent`-lipulla).**
- **`_heatmapCovers` ei kelpaa zoom-liu'un EIKÄ nipistyksen aikana.**
- **Kerrosta ei piiloteta liu'un aikana.**
- **Tekstuuria ei rakenneta liu'un aikana.**

- **Jäädytys on kiinnitettävä VOIMASSA OLEVIIN rajoihin.**
