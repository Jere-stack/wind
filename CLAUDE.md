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
  esineet (yläreunan kapseli, aikavalitsin), karttanapit ja latausruutu.

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

### Yläreuna — kapseli

Yläreunassa on **tasan yksi esine**: kelluva kapseli kartan päällä.

Sitä ennen tässä oli kolme esinettä (sääsiru, tähtäimen lukema,
tuuliasteikko) kolmella eri korkeudella, sitten koko leveyden infopaneeli,
sitten kaksi neljännesympyrää yläkulmissa. Kaaret toimivat, mutta niiden
säde oli sidottu sisältöön kaavalla `√(R²−y²)`: jokainen tekstin muutos
pakotti laskemaan säteen uudelleen ja leikkaamaan alarivit kaareen.
Kaaret veivät 10,7 % ruudusta, kapseli vie 4,3 %.

Ratkaiseva havainto koko sarjan taustalla: **sääsiru ja tuulilukema
kuvasivat samaa pistettä** — molemmat lukevat `map.getCenter()`. Siksi ne
kuuluvat samaan esineeseen.

**Kolme osaa vasemmalta oikealle: suunta, tuuli, sää.** Jako on tekemisen
mukaan — suunta kertoo mistä, tuuli kuinka kovaa, sää millaista — ja kaksi
hiusviivaa erottavat ryhmät niin ettei rivi lue yhtenä jonona. Kapselin
leveys ei ole sidottu mihinkään: rivi kasvaa ja kutistuu sisällön mukana.

- **Puuska on harmaa eikä rampin värinen**, vaikka se on tuulitieto. Jos
  molemmat luvut ovat värillisiä ja saman kokoisia, silmä ei tiedä kumpaa
  katsoa. Väri varataan sille luvulle joka kertoo pääseekö vesille.
  Puuska on 10,5 px `--ink-3`, keskituuli 23 px rampin musteella.
- **Puuska on nimetty.** Kokeiltiin nimeämätöntä pikkulukua ja pinottua
  saraketta (yksikkö päällä, puuska alla): zoomattuna jälkimmäinen lukee
  murtolukuna. Sana on lyhyempi kuin sen selittäminen jälkikäteen.
- **Ei ajatusviivaa.** `7.9–11.7 m/s` luetaan välinä, mutta väli vaatii
  tasavahvat luvut — pienennetty jälkiosa rikkoo juuri sen lukutavan.
  Joko väli tasavahvana tai puuska erillisenä; ei molempia.
- **Puuskarivi säilyttää tilansa** (`visibility` eikä `display`) kun
  puuskatietoa ei ole, jottei kapselin korkeus hyppisi sen mukaan onko
  lähimmällä ennustepisteellä puuskaa.
- **`width: max-content`** on pakollinen. Kiinteä sijoitus + `left: 50%`
  ilman `right`ia antaa käytettäväksi vain ruudun oikean puoliskon
  (195 px), jolloin lukema katkeaa kahdelle riville. Testattu 320 px:iin
  asti kaikilla yksiköillä: levein sisältö on 254 px.
- **Sanallinen sääkuvaus jäi pois.** Ikoni kertoo sään, ja "tiheitä
  lumikuuroja" leventäisi kapselia kolmanneksella. Sana on tuntisäässä.
- **Suunnan nuoli on piirretty SVG.** Vanha `dirArrow()` kvantisoi
  kahdeksaan suuntaan: 194° näytti samalta kuin 180°. Nuoli kääntyy
  `rotate(dir + 180)` — plus 180, koska `dir` on suunta josta tuulee ja
  nuoli osoittaa siihen minne tuuli puhaltaa.

**Läpikuultavuus on mitattu pois.** iOS-tyylinen materiaali (läpikuultava
pinta + `backdrop-filter`) siirtää beigeä tuulen mukana dE 7,5–11,9 vielä
90 %:n pinnalla — kartan vihreällä siitä tulee salvia, myrskyllä
vaaleanpunainen — ja `--ink-3` putoaa alle AA:n **jokaisella** alfalla,
koska sillä on kiinteälläkin pinnalla vain 4,6:1. Siedettävä siirtymä
vaatisi 96 %:n pinnan, jolloin itse ilmiö on näkymätön. Sweet spotia ei ole.

**Kaikki kolme osaa ovat napautettavia**, ja jokainen laajentaa oman
lukemansa: suunta avaa esitystavan, tuuli yksikön, sää tuntisään.
Kuuntelijat ovat painikkeissa eivätkä niiden sisällä olevissa lukemissa —
kahdella kuuntelijalla kupliva napautus laukaisisi `toggle()`:n kahdesti
eli ei kertaakaan.

### Kapselin valitsimet

Suunta- ja yksikkökortti ovat samaa muottia (`Valitsin`): sama paperi,
sama sijoituslogiikka, sama rakenne. Yhteinen tehdasfunktio tekee kolme
asiaa joita kahdella erillisellä toteutuksella ei saisi ilmaiseksi —
kortit eivät voi ajautua erinäköisiksi, toisen avaaminen sulkee toisen
ilman että ne tuntevat toisensa (`Valitsin.suljeKaikki`), ja uusi kortti
on muutaman rivin työ.

Kortti keskitetään **sen osan alle jota napautettiin**, ei koko kapselin
eikä ruudun keskelle: valikko kuuluu siihen mitä osoitettiin. Reunoille
jää 12 px, jottei kortti valu ulos kapean laitteen laidassa.

Rivin oikeassa laidassa on aina **sama lukema siinä muodossa jota rivi
tarjoaa**, joten kortti kertoo samalla mitä valinta tarkoittaa. Valittu
rivi on mustetäyttö kuten asetusten sirut, ei aksenttia.

### Suunnan esitystapa

Asteet tai ilmansuunta (`fs_suuntamuoto`). Kaksi muotoa tekevät eri työn
eivätkä ole toistensa hienompia versioita: **asteet antavat tarkkuuden,
nimi luettavuuden.**

- **Kirjainmuotoa (SSW) ei ole.** Se on asteita epätarkempi ja nimeä
  vaikeampi lukea, eli häviää kummallekin siinä mitä ne tekevät. Se olisi
  ollut helppo lisätä kolmanneksi riviksi juuri siksi ettei siitä
  tarvitse päättää mitään.
- **Nimet ovat ablatiivissa** ("lounaasta"), koska tuulen suunta on se
  josta tuulee. Nuoli osoittaa päinvastaiseen suuntaan (`rotate(dir+180)`)
  ja on aina ollut niin — sana ei tuo uutta ristiriitaa vaan sanoo
  ääneen sen minkä asteluku jättää arvattavaksi.
- **Nimet ovat kahdeksassa portaassa, asteet yhdessä.** Se on työnjako
  eikä epäjohdonmukaisuus: kuudentoista portaan nimi olisi
  "etelälounaasta" — pidempi kuin lukema jonka se korvaa.
- Pisin nimi ("pohjoisesta") mahtuu 320 px:n laitteelle levein
  mahdollinen muu sisältö rinnalla: kapseli on silloin 246 px.

### Yksikkövalitsin

Oli viimeinen tumman teeman jäänne: pohjaton pillerilista keskellä ruutua,
DM Monolla ja valkoisella tekstillä varjostettuna — paperilla valittu rivi
oli valkoista beigellä eli näkymätön. Nyt se on `Valitsin`-kortti muiden
joukossa, ja yksikön vieressä on **sama tuuli siinä yksikössä**
(`Units.fmtIn`).

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
