# FoilSpot v7

Wingfoil-sääsovellus Suomen rannikon spoteille. Kartta (Leaflet) + tuuliennusteet
(FMI HARMONIE, Open-Meteo, FMI-havaintoasemat) yhdessä self-contained HTML-sivussa.

## Ajokomennot

```bash
npm install       # asenna riippuvuudet
npm run dev       # käynnistä Vite dev-serveri (http://localhost:5173)
npm run build     # tuota tuotantobuild hakemistoon dist/
npm run preview   # esikatsele tuotantobuildia paikallisesti
```

## Rakenne

- `index.html` — koko sovellus: CSS, HTML ja JS yhdessä tiedostossa (ei erillistä
  `src/`-hakemistoa). Leaflet ladataan CDN:stä `<script>`-tagilla.
- `api/*.js` — Vercelin serverless-funktiot (FMI-havainnot, HARMONIE-ennuste,
  Kruunuvuorenselän ja Uiraan mittausdata -proxyt). ES-moduuleja, koska
  `package.json`:ssa on `"type": "module"` — `require()` ei toimi näissä.
- `vite.config.js` — build-asetukset sekä `vercel-api-dev`-plugin, joka ajaa
  `api/*.js`-funktiot myös `npm run dev`- ja `npm run preview` -servereissä.
  Muutokset api-tiedostoihin näkyvät ilman dev-serverin uudelleenkäynnistystä.
- `vercel.json` — Vercel-deployn asetukset (build-komento, output-hakemisto,
  funktioiden aikakatkaisut ja rewrite-säännöt).

## Pohjakartta

Esri Dark Gray Canvas, `services.arcgisonline.com/.../World_Dark_Gray_Base`.

Vaihdettiin CARTO `dark_nolabels` -kartasta, koska siinä maa ja vesi
erottuivat huonosti: maa harmaa 9 ja vesi 36–38, eli ero vain 11 %
kirkkausasteikosta — ja vesi oli maata *vaaleampi*, mikä on karttana
takaperin. Sitä paikkailtiin lasketulla varjokerroksella, joka johti
rantaviivan pohjakartan pikseleistä. Se toimi mutta oli jatkuva
kitkanlähde: laattojen välkkyminen, tarkentuminen zoomatessa ja
ajoittainen katoaminen. Kerros poistettiin kun pohjakartta korjasi
alkuperäisen syyn.

Yksityiskohtia jotka eivät ole ilmeisiä:

- **Osoitteessa on `{z}/{y}/{x}`** — ArcGIS antaa rivin ennen saraketta,
  toisin kuin tavallinen XYZ.
- **`maxNativeZoom: 16`** — z17 palauttaa vaalean "ei dataa" -laatan.
- **`detectRetina: true`** — laatat ovat 256 px eivätkä @2x kuten CARTOlla.
  Ilman tätä ne venytettäisiin retinanäytöllä pehmeiksi. Laatat ovat pieniä
  (noin 5 kt), joten neljänkertainen määrä on yhä kevyempi kuin CARTOn
  @2x-laatat.
- **`.basemap { filter: contrast(1.4) }`** — Esrin vesi on 35 ja maa 77,
  molemmat selvästi alle keskiharmaan, joten contrast tummentaa ja kasvattaa
  eroa samaan aikaan: vesi menee nollaan ja maa arvoon 57, ero 42 → 57.
  Ilman tätä kartta olisi lämpökartan alla selvästi vaaleampi kuin ennen ja
  tuulivärit menettäisivät tehonsa. Suodin on värimatriisi ja ajetaan
  kompositoinnissa; mitattuna sen kustannus ei erotu kohinasta.
- **Nimistö**: z4–z6 sisältää maiden ja merialueiden nimiä (Esrin base ei ole
  täysin labels-vapaa). z7:stä ylöspäin ei nimistöä.
- **Attribuutio** on asetuspaneelin alalaidassa, ei kartalla — kartta luodaan
  `attributionControl: false`. Esrin ehdot vaativat "Powered by Esri"
  -maininnan ja datalähteiden nimet, joten sitä riviä ei saa poistaa.

## Lämpökartta pohjakartan päällä

Lämpökartta on `L.imageOverlay`, joka lisätään **laattapaneeliin**
(`pane: 'tilePane'`) ja sekoitetaan pohjaan `mix-blend-mode: plus-lighter`
-tilassa. Molemmat asiat ovat välttämättömiä; kumpikaan ei toimi yksin.

**Paneeli ratkaisee sen, vaikuttaako sekoitustila lainkaan.**
`mix-blend-mode` sekoittuu vain oman pinoamiskontekstinsa sisällä, ja
jokainen Leafletin paneeli on oma kontekstinsa (`position:absolute` +
`z-index`). Kun lämpökartta oli `overlayPane`ssa (z 400), sen alla ei ollut
mitään — se sekoittui läpinäkyvää vasten, eli sekoitustila oli kuollutta
koodia. Mitattuna sovelluksessa 9,1 m/s tuulessa rantaviivan luminanssiero
oli `normal`, `screen` ja `plus-lighter` -tiloissa **täsmälleen sama 16.7**.
Laattapaneelissa taustana on pohjakartta ja sama mittaus antaa
normal 16.7 / screen 24.7 / **plus-lighter 42.2**.

**Miksi juuri plus-lighter.** `screen` laskee `1-(1-pohja)(1-tuuli)`, jolloin
maan ja veden ero kutistuu kertoimella `(1 - alfa*tuulivari)` — eli katoaa
sitä enemmän mitä kovempi tuuli, juuri siellä minne katsotaan. Erillisessä
mittauksessa oikeilla Esri-laatoilla ero putosi 53:sta 35:een 10 m/s
kohdalla. `plus-lighter` laskee `pohja + alfa*tuuli`, jolloin ero säilyy
sellaisenaan: 55–57 koko rampin yli. Sovelluksen A/B ennen ja jälkeen:
rantaviivan ero **20.1 → 41.5**.

- **Piirtojärjestys ei muutu** paneelin vaihdosta: laattapaneelissa on
  ennestään vain pohjakartta, ja merkit ovat markerPanessa (z 600).
- **Sekoitustila on kahdessa paikassa** — CSS:ssä ja `updateHeatmapBlur`in
  inline-tyylissä (`HEAT_BLEND`). Molemmat päättelevät sen samalla
  `CSS.supports`-säännöllä. Jos vain CSS:ää muuttaa, inline-arvo ohittaa sen.
- **Varatie**: `@supports not (mix-blend-mode: plus-lighter)` palaa
  `screen`iin. Tuki on Chrome 108+ ja Safari 16.4+; vanhemmissa kartta
  toimii ja on yhä parempi kuin ennen (24.7 vs 16.7), koska paneelikorjaus
  herättää myös screenin.
- **`contrast(1.4)` on mitattu optimi, ei arvaus.** Pyyhkäisy 1.25 / 1.4 /
  1.55: rantaviivan ero 46.3 / 48.9 / 41.3. Yli 1.4 alkaa painaa myös maata
  kohti mustaa (maa on keskiharmaan alapuolella), jolloin ero taas kapenee.

### Väriramppi

- **Väliankkurit.** Rampissa on 17 riviä, joista 8 on väliankkureita:
  segmentin päätepisteiden Lab-keskiarvoja. Ilman niitä sRGB-interpolointi
  etenee epätasaisesti — 9→10 m/s harppasi 26.7 dE kun 16→17 liikkui 5.3,
  eli sama nopeusero näytti viisi kertaa suuremmalta. Väliankkurit tasaavat
  suhteen 5.0:sta 2.8:aan ilman että sovellukseen tuodaan väriavaruus-
  matematiikkaa. **Merkitsevät sävyt (8 vihreä, 10 keltainen, 13 oranssi)
  ovat tarkalleen ennallaan** — vain niiden välit ja kärki muuttuivat.
- **Kärki on magenta, ei tummaa viiniä.** Vanha ramppi tummui yli 16 m/s
  (L\* 36 → 20), joten myrsky näytti vaimeammalta kuin 13 m/s. Nyt L\* nousee
  loppuun asti (36 → 47).
- **Alfakäyrän kuutiollinen lisätermi** nostaa vain kärkeä: 8 m/s pysyy
  0.45:ssä, 20 m/s nousee 0.60:stä 0.75:een. Additiivisessa sekoituksessa
  tämä ei syö rantaviivan kontrastia, koska maan ja veden ero ei riipu
  alfasta. `screen`in kanssa se olisi ollut mahdotonta.
- **Värisokeus on yhä ratkaisematta.** 10 ja 13 m/s ovat deuteranoopille
  käytännössä sama väri (dE 3.4 vanhassa, 2.2 uudessa) — vika on
  vihreä–keltainen–punainen-perheessä itsessään, ei näissä säädöissä.
  Korjaus vaatisi rampin vaihtamista toiseen väriperheeseen.

## Valikoiden ulkoasu — Merikartta

Sovelluksessa on **kaksi maailmaa**, ja raja kulkee sen mukaan mikä on
dataa ja mikä käyttöliittymää — ei sen mukaan missä elementti sijaitsee:

- **Kartta on tumma ja pitää kaikki värit.** Pohjakartta, lämpökartta,
  partikkelit, spottimerkit ja asemamerkkien pillerit. Väri asuu täällä,
  koska tuulisävy tarkoittaa jotain.
- **Kaikki käyttöliittymä on paperia.** Paneelit (asetukset,
  spottikortti/havaintokortti, ennustepaneeli), kartan päällä kelluvat
  sirut (sääwidget, tähtäimen lukema, tuuliasteikko), karttanapit,
  aikajana ja latausruutu.

Kartan päällä kelluvat elementit ovat siis **paperisiruja tummalla
kartalla** (`--chip`), eivät tummia laatikoita. Asemamerkkien pillerit ovat
poikkeus: ne ovat kartalla ja tummia, koska ne ovat dataa lämpökartan
päällä. Jos niiden tekstin vaihtaa musteeksi, lukema katoaa kokonaan.

Sävyt on otettu suomalaisesta merikartasta: maa-alueen kellertävä pohja,
kartan musta teksti ja merikartan magenta, joka on myös se sävy johon
tuuliramppi päättyy 20 m/s kohdalla.

### Tokenit

`:root`issa on `--surface / --surface-hi / --surface-lo`, `--hairline(-soft)`,
`--ink / --ink-2 / --ink-3`, `--accent`, `--info`. Kaikki musteet läpäisevät
WCAG AA:n kummallakin pinnalla (14.3 / 5.9 / 4.6 : 1).

Asiat jotka eivät ole ilmeisiä:

- **`--accent` on ainoa toimintoväri.** Se varataan kytkimille ja
  toiminnoille. Valittu valintasiru on **mustetta**, ei aksenttia: kolme
  siruryhmää näkyy yhtä aikaa, joten aksenttitäyttö toisi ruudulle kolme
  magentaa laattaa ja söisi tehon siitä missä se merkitsee jotain.
- **`var()` ei toimi SVG:n esitysattribuuteissa.** `fill="var(--ink)"` ei
  renderöidy. Kaavioiden ja renkaiden attribuuteissa on siksi literaalit;
  inline-tyyleissä (`style="color:…"`) tokenit toimivat normaalisti.
- **Emojit poistettiin** valintasiruista. Mallin nimi tekstinä on siistimpi
  kuin väärä ikoni, eikä uusia ikoneita tarvittu.

### Kaksi ramppia

`ColorRamp.rgb()` on kartalle, `ColorRamp.ink()` paneeleihin. Sama
sävyjärjestys, sama `msToT`, samat väliankkurit — vain kylläisyys eroaa.
Syy: kartan neonvihreä on beigellä 1.49:1 ja keltainen 1.34:1, eli kuusi
yhdeksästä ankkurista on lukukelvottomia. Mustevariantti on 4.56–6.6:1.
Sama pätee spotti-indeksiin: `spotIndexColor()` kartalle,
`spotIndexInk()` paneeleihin, ja `spotMarkerSVG(..., paperi)` vaihtaa
renkaan taustan ja uran.

**Jos lisäät paneeliin tuulivärillisen luvun, käytä `ink()`-versiota.**
Kartan versio näyttää siellä siltä kuin teksti olisi haalistunut.

### Typografia

Syne ja DM Mono poistettiin. Käyttöliittymä käyttää järjestelmäfonttia
(iPhonella SF Pro), numerot samaa perhettä `tabular-nums`-asetuksella.
Kaksi ulkoista fonttilatausta vähemmän.

### Aikavalitsin

Aikavalitsin on **säädin, ei paneeli**. Se oli 130 px + turva-alue eli 19 %
ruudusta, reunasta reunaan ulottuvana paperinauhana ja 72 px korkein
palkein — se luki toisena paneelina kartan alla ja peitti juuri sitä merta
jota sen pitäisi täydentää.

Nyt se on kelluva siru (`#tl-wrap::before`), jonka ohi kartta jatkuu
kummaltakin puolelta. Koko jalanjälki kuplan ylälaidasta ruudun pohjaan on
111 px eli 13 % (ennen 203 px / 24 %).

- **Palkit ovat 22 px, eivät 72.** Muodon lukemiseen ei tarvita korkeutta,
  koska palkkia verrataan naapuriin eikä asteikkoon. Kokeiltiin myös
  meteogrammikäyrää: se litistyy nauhan korkeudella lukukelvottomaksi,
  koska käyrä vaatii yhteisen nollatason jota pitää seurata silmällä.
- **Kupla on yksirivinen.** Kaksirivinen oli 39 px ja sen magenta päiväys
  oli koko valitsimen äänekkäin elementti. Päiväys näkyy jo janan
  päiväerottimessa, joten kupla tarvitsee vain viikonpäivän.
- **NYT-merkki on palkkien yläpuolella**, ei tuntirivillä — siellä se
  törmäsi lukemaan ("NYT15").
- **Play-nappi näyttää 32 px:ltä mutta osuu 44 px:n alalta**
  (`::after`-laajennus), eli Applen kosketusminimi täyttyy ilman että
  säädin lihoo.
- **`TICK_W` JS:ssä ja `.htick` flex-basis CSS:ssä on pidettävä samana**,
  muuten keskitys valuu.

### Yläreuna

Yläreunassa oli ensin kolme esinettä (sääsiru, tähtäimen lukema, tuuliasteikko)
kolmella eri korkeudella. Ratkaiseva havainto oli että **sääsiru ja lukema
kuvasivat samaa pistettä** — molemmat lukevat `map.getCenter()` — joten ne
yhdistettiin. Nyt ne ovat kaksi neljännesympyrää, kummassakin yläkulmassa yksi:
vasemmalla tuuli, oikealla sää. Väriasteikko poistui kokonaan; kartan värit ja
merkkien lukemat kertovat saman, ja asteikko on asetuspaneelissa viitteenä.

Muoto syntyy yhdellä border-radiuksella neliöön. Kun leveys, korkeus ja säde
ovat samat, kaari on aito ympyrän neljännes eikä pyöristetty suorakulmio, ja
kaaren keskipiste on ruudun kulmassa.

**Säde seuraa sisällöstä, ei mausta.** Kaari on `x² + y² = R²`, joten
y-syvyydellä mahtuu `√(R²−y²)`. Rajoittava rivi on **hero** (luku + yksikkö +
nuoli), joka on leveimmillään heti turva-alueen alla — ei alarivi, kuten voisi
luulla. Siksi alarivien lyhentäminen ei tuo yhtään pikseliä: pienin säde on
sama tekstillä `209° · 9.0` ja pelkällä `209°`. Sama syy tekee kolmesta
lyhyestä rivistä tehokkaamman kuin yksi pitkä rivi (R 148 vs 160) — pitkä rivi
on leveä syvällä, missä kaari on jo kapea.

Ratkaistuna tälle sisällölle ja iPhonen turva-alueelle: tuuli vaatii R 148,
sää R 120. Käytössä on **150 / 150**, koska symmetria valittiin hierarkian
sijaan; edellinen 164 oli 18 ja 46 px sisältöään suurempi.

- **Kirjasinkoko on osa sädettä.** Hero 26 px kuuluu R 150:een. Jos heroa
  kasvattaa, säde on laskettava uudelleen.
- **Sääikoni on lämpötilan rinnalla, ei yläpuolella.** Omalla rivillään se
  työntäisi sanan 27 px syvemmälle, missä kaari on enää 60 px leveä eikä
  "kevyttä sadetta" mahdu.
- **`sovitaKulmatekstit()` laskee alarivien `max-width`in kaaresta.** Se on
  varmistus eikä asettelu: pisin sääsana ("tiheitä lumikuuroja") mahtuu 1,5
  px:n varalla, ja se vara riippuu kirjasimen metriikasta — testiselain ei
  käytä SF Prota. Ilman rajaa pisin sana valuisi kaaren yli kartalle jollain
  laitteella; rajan kanssa se katkeaa kolmeen pisteeseen. Riveillä on
  `min-height`, jotta raja lasketaan oikein myös tyhjänä — muuten
  käynnistyksessä laskettu raja jäisi 30 px liian löysäksi.
- **Kaarella on 1 px hiusviiva.** Neljänneksessä oikea ja ala reuna ovat
  kokonaan kaarta, joten `border-right` + `border-bottom` piirtää tasan kaaren
  eikä yhtään suoraa pätkää. Viiva tekee muodosta piirretyn eikä leikatun.
- **Kapein laite saa pienemmän kaaren.** Kaksi 150 px:n kaarta vie 300 px, eli
  320 px:n ruudulla väliin jäisi 20 px karttaa. `@media (max-width: 360px)`
  pudottaa säteen 132:een ja kirjasimet vastaavasti.
- **Suunnan nuoli on piirretty SVG.** Vanha `dirArrow()` kvantisoi kahdeksaan
  suuntaan: 194° näytti samalta kuin 180°. Nuoli kääntyy `rotate(dir + 180)` —
  plus 180, koska `dir` on suunta josta tuulee ja nuoli osoittaa siihen minne
  tuuli puhaltaa.

**Läpikuultavuus on mitattu pois.** iOS-tyylinen materiaali (läpikuultava
pinta + `backdrop-filter`) siirtää beigeä tuulen mukana dE 7,5–11,9 vielä 90
%:n pinnalla — kartan vihreällä siitä tulee salvia, myrskyllä
vaaleanpunainen — ja `--ink-3` putoaa alle AA:n **jokaisella** alfalla, koska
sillä on kiinteälläkin pinnalla vain 4,6:1. Siedettävä siirtymä vaatisi 96 %:n
pinnan, jolloin itse ilmiö on näkymätön. Sweet spotia ei ole.

### Kapseli — yläreunan vaihtoehto

Asetuksissa (`Yläreuna`) voi vaihtaa kaaret yhteen kelluvaan kapseliin.
Kaaret vievät 10,7 % ruudusta, kapseli 3,8 %. Kaaret ovat kiinni kulmissa ja
lukevat kehyksenä, kapseli kelluu kartan päällä ja lukee kojeena — kumpi on
parempi riippuu katsooko karttaa vai lukemaa, joten valinta on asetuksissa
eikä koodissa. `YlaMuoto` muistaa sen `localStorage`ssa (`fs_ylareuna`).

- **Sisältö on tiiviimpi, ei suppeampi.** Kaarten kolme riviä mahtuvat yhdelle:
  `7.9–11.7 m/s ↗ 209° │ ☁ 17°`. Puuska on välin toinen luku eikä oma rivinsä
  — tuuli luetaan muutenkin välinä, ja suurempi luku on aina puuska, joten
  sanaa ei tarvita. Ilman puuskatietoa väli kutistuu yhdeksi luvuksi.
- **`width: max-content`** on pakollinen. Kiinteä sijoitus + `left: 50%` ilman
  `right`ia antaa käytettäväksi vain ruudun oikean puoliskon (195 px), jolloin
  lukema katkeaa kahdelle riville. Testattu 320 px:iin asti: levein sisältö
  (km/h, kolminumeroinen suunta, miinuslämpötila) on 280 px.

### Molemmat muodot pysyvät synkassa

Sama lukema näkyy siinä muodossa joka on käytössä. Jos päivitys osoittaisi
id:llä yhteen elementtiin, toinen muoto jäisi jälkeen heti kun jompaakumpaa
muuttaa. Siksi **molemmat julistavat samat paikat `data-paikka`-määreellä** ja
`Crosshair`/`WeatherWidget` kirjoittavat kaikkiin (`paikat(nimi)`): muodot
eivät voi eriytyä. Napautuskohteet ovat molemmissa samat — lukema avaa
yksikkövalitsimen, sääosa tuntisään.

Kapselissa kuuntelija on painikkeessa ja kaaressa itse lukemassa, ei
molemmissa: kapselin lukema on painikkeen sisällä, ja kupliva napautus
laukaisisi `toggle()`:n kahdesti eli ei kertaakaan.

### Yksikkövalitsin

Oli viimeinen tumman teeman jäänne: pohjaton pillerilista keskellä ruutua, DM
Monolla ja valkoisella tekstillä varjostettuna — paperilla valittu rivi oli
valkoista beigellä eli näkymätön. Nyt kortti on samaa paperia kuin muutkin
paneelit ja aukeaa siihen mihin osoitettiin: kaaressa vasen reuna lukeman
kanssa samassa linjassa (x 16), kapselissa keskitettynä kapselin alle.

Yksikön vieressä on **sama tuuli siinä yksikössä** (`Units.fmtIn`), joten
valitsin kertoo samalla mitä valinta tarkoittaa. Valittu rivi on mustetäyttö
kuten asetusten sirut, ei aksenttia.

## API-osoitteet

Frontend käyttää vakiota `API_BASE = '/api'` (`index.html`), eli funktiot
haetaan aina samasta originista kuin sivu — niin tuotannossa kuin devissä.
Koodissa ei ole yhtään absoluuttista host-osoitetta omaan palveluun, joten
sivu ja API ovat aina samaa versiota eikä projekti riipu mistään erikseen
deployatusta ympäristöstä.

## Deploy

Vercel ajaa `npm run build`:n ja julkaisee `dist/`-hakemiston sekä
`api/`-funktiot. Deployn tulee tapahtua tästä reposta, jotta sivu ja sen
`/api`-funktiot pysyvät samassa versiossa.
