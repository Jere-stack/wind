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

Oletus on Esri Dark Gray Canvas,
`services.arcgisonline.com/.../World_Dark_Gray_Base`. Asetuspaneelista voi
valita myös vaalean tai satelliitin — ks. *Kartan asetukset*, jossa on
niiden omat sävynsäätimet ja se miksi vaalea kääntää koko sekoituksen
toisin päin.

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
- **`.basemap { filter: var(--pohja-suodin) }`, tummalla `contrast(1.4)`** —
  Esrin vesi on 35 ja maa 77, molemmat selvästi alle keskiharmaan, joten
  contrast tummentaa ja kasvattaa eroa samaan aikaan: vesi menee nollaan ja
  maa arvoon 57, ero 42 → 57. Ilman tätä kartta olisi lämpökartan alla
  selvästi vaaleampi kuin ennen ja tuulivärit menettäisivät tehonsa. Suodin
  on värimatriisi ja ajetaan kompositoinnissa; mitattuna sen kustannus ei
  erotu kohinasta. Arvo on token, koska muilla pohjakartoilla se on eri.
- **Nimistö**: z4–z6 sisältää maiden ja merialueiden nimiä (Esrin base ei ole
  täysin labels-vapaa). z7:stä ylöspäin ei nimistöä.
- **Attribuutio** on asetuspaneelin alalaidassa, ei kartalla — kartta luodaan
  `attributionControl: false`. Esrin ehdot vaativat "Powered by Esri"
  -maininnan ja *sen palvelun* datalähteet, joten rivi vaihtuu pohjakartan
  mukana (`POHJAT[...].attr` → `#pohja-lahteet`) eikä sitä saa poistaa.

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
- **Sekoitustila on kahdessa paikassa** — CSS:n `--sekoitus`-tokenissa ja
  `updateHeatmapBlur`in inline-tyylissä (`heatSekoitus()`). Molemmat
  päättelevät sen samalla säännöllä. Jos vain CSS:ää muuttaa, inline-arvo
  ohittaa sen. Vaalealla pohjakartalla arvo on `multiply` — ks. *Kartan
  asetukset*.
- **Varatie**: `@supports not (mix-blend-mode: plus-lighter)` palaa
  `screen`iin. Tuki on Chrome 108+ ja Safari 16.4+; vanhemmissa kartta
  toimii ja on yhä parempi kuin ennen (24.7 vs 16.7), koska paneelikorjaus
  herättää myös screenin.
  **Ehto on tokenissa eikä ominaisuudessa, ja se on pakko.** Kun arvo tulee
  `var()`-viittauksesta, tuntematon arvo ei enää pudota sääntöä ja jätä
  edellistä voimaan — se tekee ominaisuudesta alustusarvoisen eli `normal`.
  Vanha `.heatmap-overlay { mix-blend-mode: screen }` -varasääntö ei siis
  toimisi enää. Tokeniin osuvana ehto ratkeaa ennen `var()`-purkua, jolloin
  vanha selain ei koskaan näe sanaa `plus-lighter`.
- **`contrast(1.4)` on mitattu optimi, ei arvaus.** Pyyhkäisy 1.25 / 1.4 /
  1.55: rantaviivan ero 46.3 / 48.9 / 41.3. Yli 1.4 alkaa painaa myös maata
  kohti mustaa (maa on keskiharmaan alapuolella), jolloin ero taas kapenee.

### Väriramppi

**Kirkkaus kantaa nopeuden, sävy vain vahvistaa sitä.** Tämä on rampin
koko suunnitteluperiaate, ja se tulee värisokeudesta.

- **Miksi vanha ramppi vaihdettiin.** Vihreä–keltainen–punainen-perhe
  romahtaa deuteranoopille yhdeksi ruskeanharmaaksi alueeksi. Mitattuna
  renderöidyistä väreistä 1 m/s askelin, pienin dE kahden vähintään 4 m/s
  päässä olevan nopeuden välillä oli **0.8** — eli 8 m/s ja 16 m/s olivat
  käytännössä sama väri. Se on juuri se ero jonka takia sovellusta
  katsotaan, joten kyse ei ollut kosmetiikasta.
- **Mittaa renderöityjä värejä, ei rampin rivejä.** Käyttäjä ei näe
  `RAMP`ia vaan `pohja + alfa*ramppi`. Alfakäyrä puristaa kirkkausvälin
  (ennen 10→81 rampissa, 1→47 ruudulla), joten ruudulla sävy joutui
  kantamaan vielä enemmän kuin rampin luvuista näytti. Rampin raakarivien
  mittaaminen antaa liian ruusuisen kuvan.
- **Sävypolku ja kärki.** Sininen → terässininen → turkoosi → vihreä →
  kulta, ja kärjessä kierto lohen kautta pinkkiin. Kierto ylöspäin on
  **b\*-akselilla, jonka dikromaatti näkee** — siksi kärki erottuu myös
  värisokealle. Vaaleaa ja kylläistä punaista ei ole sRGB:ssä, joten
  monotoninen kirkkaus ja vanha punainen kärki eivät mahdu yhteen.
- **Mitattu ennen → jälkeen**, pienin dE (≥4 m/s ero / 2 m/s askel):

  | näkö | ennen | jälkeen |
  |---|---|---|
  | normaali | 16.9 / 8.6 | 11.7 / 5.2 |
  | deuteranooppi | 0.8 / 1.5 | 7.1 / 4.0 |
  | protanooppi | 2.6 / 1.9 | 7.2 / 3.8 |
  | tritanooppi | 1.6 / 0.4 | 7.7 / 3.9 |

  Kaikki neljä ovat nyt samassa haarukassa 7.1–7.7 — ramppi on yhtä hyvä
  kuin sen huonoin lukija, joten valinta tehtiin minimax-perusteella.

  > **Korjaus.** Yllä olevan taulukon "jälkeen"-sarake on liian ruusuinen.
  > Se mitattiin dikromatiasimulaatiolla joka osoittautui myöhemmin
  > virheelliseksi (LMS-käänteismatriisi ei vastannut suoraa matriisia,
  > ks. *Kolme rikkinäistä väriaistisimulaatiota*). Korjatulla
  > Viénot-matriisilla samat luvut tummalla pohjalla renderöitynä ovat
  > **normaali 19.2 / deuteranooppi 4.9 / protanooppi 7.1 /
  > tritanooppi 2.2**. Suunta oli oikea — vanha ramppi oli tätäkin
  > huonompi — mutta *minimax ei toteutunut*: rampin heikko kohta on
  > **tritanopia**, ei deuteranopia, ja se on 2.2 eikä 7.7. Sitä varten on
  > nyt oma väriasteikko asetuksissa (*Kartan asetukset*).
- **Kirkkaus nousee monotonisesti kaikissa kolmessa näköavaruudessa**:
  normaali 1 → 58, deuteranooppi 1 → 60, protanooppi 1 → 56. Ei siis
  pelkästään "erottuu", vaan *kirkkaampi tarkoittaa kovempaa* jokaiselle.
  Ennen rampissa oli kuusi laskua.
- **Hinta on kylläisyys: keskikroma 40 → 26.** Kartta on vaimeampi kuin
  ennen. Tämä on tietoinen vaihtokauppa, ei laiminlyönti: 11.7 dE on
  normaalinäköiselle yhä moninkertaisesti yli erottumisrajan, ja vaaleus
  on ainoa kanava jonka *kaikki* näkevät.
- **Kirkkausaikataulu on verrannollinen nopeuteen, ei ankkurin
  järjestyslukuun.** Ankkurit ovat epätasavälein (0, 2, 4, 6, 8, 10, 13,
  16, 20). Järjestysluku antoi kirkkautta liikaa alapäähän ja liian vähän
  yläpäähän, ja mitattuna 2 m/s askeleen pienin dE jäi 1.0:aan — juuri
  siellä missä ero pitää nähdä. Korjaus nosti sen 4.0:aan.
- **Väliankkurit.** Rampissa on 17 riviä, joista 8 on väliankkureita:
  segmentin päätepisteiden Lab-keskiarvoja. Ilman niitä sRGB-interpolointi
  etenee epätasaisesti — sama nopeusero näytti eri kohdissa jopa viisi
  kertaa erisuuruiselta — ilman että sovellukseen tuodaan väriavaruus-
  matematiikkaa ajonaikaisesti.
- **Alfakäyrän kuutiollinen lisätermi** nostaa vain kärkeä: 8 m/s pysyy
  0.45:ssä, 20 m/s nousee 0.60:stä 0.75:een. Additiivisessa sekoituksessa
  tämä ei syö rantaviivan kontrastia, koska maan ja veden ero ei riipu
  alfasta. `screen`in kanssa se olisi ollut mahdotonta.

Analyysityökalut ovat kertakäyttöisiä eivätkä ole repossa. Jos ramppiin
koskee, mittaa uudelleen: simuloi dikromatia **renderöidyistä** väreistä ja
katso CIEDE2000-erot 1 m/s askelin. Rampin rivien katsominen ei riitä.

### Kolme rikkinäistä väriaistisimulaatiota — ja miten ne tunnistaa

Tämän projektin dikromatialuvut on jouduttu mittaamaan kahdesti, koska
ensimmäinen työkalu oli rikki eikä se näkynyt luvuista. Kolme yritystä
kaatui peräkkäin:

1. **LMS-käänteismatriisi ei vastannut suoraa matriisia.** Kovakoodattu
   inverssi oli eri lähteestä kuin forward. Oire: tumma sininen ja
   vaaleanpunainen päätyivät molemmat samaan väriin `(0,255,185)`.
2. **HPE-matriisi (XYZ→LMS) ajettiin suoraan lineaarisen RGB:n läpi.**
   Oire: puhdas sininen muuttui vihreäksi.
3. **Toimiva:** klassiset Viénot–Brettel–Mollon -matriisit **suoraan
   lineaarisessa sRGB:ssä**, ei LMS-välivaiheen kautta:

   ```
   deuteranopia [[0.625,0.375,0],[0.700,0.300,0],[0,0.300,0.700]]
   protanopia   [[0.567,0.433,0],[0.558,0.442,0],[0,0.242,0.758]]
   tritanopia   [[0.950,0.050,0],[0,0.433,0.567],[0,0.475,0.525]]
   ```

**Tarkista työkalu ennen kuin uskot sen lukuja.** Nämä kelpaavat
tarkistuksiksi ja ne on ajettu:

- dE2000: musta vs valkoinen = 100.0, sama väri itsensä kanssa = 0.0,
  harmaa 100 vs 150 = 19.4, puhdas punainen vs vihreä = 86.6.
- Simulaatio: deuteranoopin **sinisen rivin** pitää olla `[0, 0.3, 0.7]`,
  eli sininen säilyy. Jos puhdas sininen muuttuu vihreäksi, matriisi on
  väärässä avaruudessa.
- Harmaa ei saa muuttua miksikään missään simulaatiossa.

## Valikoiden ulkoasu — Merikartta

Sovelluksessa on **kolme maailmaa**, ja raja kulkee sen mukaan mitä asia
on — ei sen mukaan missä se sijaitsee:

- **Tuulikenttä pitää värin.** Pohjakartta, lämpökartta ja partikkelit.
  **Sävy tarkoittaa tuulennopeutta, ja vain sitä.**
- **Mitattu data on tummaa pilleriä kartalla.** Havaintoasemien lukemat.
  Ne ovat lämpökartan päällä, joten niiden on oltava tummia — musteeksi
  vaihdettuna lukema katoaisi kokonaan.
- **Kaikki muu on paperia.** Paneelit, kartan päällä kelluvat esineet
  (kapseli, aikavalitsin), karttanapit, latausruutu — ja **spottimerkit**.

Sävyt on otettu suomalaisesta merikartasta: maa-alueen kellertävä pohja,
kartan musta teksti ja merikartan magenta. Magenta on `--accent`, siis
toimintoväri. Aiemmin se oli myös se sävy johon tuuliramppi päättyi
20 m/s kohdalla; värisokeuskorjauksen jälkeen rampin kärki on pinkki,
joten yhteys on nyt vain sukulaisuus eikä sama väri.

### Spottikortin migraatio

Spottikortti jäi pitkään ainoaksi pinnaksi jota ei ollut viety
Merikartta-paletille — kartta, asetukset ja ennustepaneeli mittasivat
0 alitusta, spottikortti 18. Nyt sekin on 0.

Löydökset olivat samaa perhettä eivätkä makuasioita:

- **`--muted` oli itse tumman teeman jäänne** (`rgba(180,215,255,.45)`,
  1,09:1). Se oli 13 paikassa, useimmiten "Ladataan…"-teksteissä. Token
  poistettiin ja käytöt korvattiin `--ink-3`:lla.
- **`--hairline` ja `--hairline-soft` olivat TEKSTIN värinä** viidessä
  paikassa ja koko tuntinauhassa (1,49:1). Ne ovat viivojen värejä; mennyt
  tunti vaimennetaan nyt musteasteikolla, joka on suunniteltu luettavaksi.
- **Kuvaajien tooltipeissä oli tumma tausta mutta muste tekstinä** —
  eli ne olivat lukukelvottomia. Puolittainen migraatio: sisältö oli
  viety paperille, pinta ei.
- **`--accent` oli datavärinä** Tuuli- ja Vesi-lukemissa. Aksentti on
  toimintoväri; asemavalitsin saa sen, lukema ei.
- **Kartan ramppi paneelissa**: puuskalukema käytti `ColorRamp.rgb()`:tä.
  Nyt `ink()`, kuten sääntö sanoo.
- **HAVAINNOT-ruudukossa oli neljä eri väriä** (oliivi, vaaleansininen,
  magenta, kartan ramppi). Nyt värillä on yksi merkitys: tuuli ja puuska
  kantavat musterampin, lämpö ja vesi ovat mustetta. Toinen väriasteikko
  samassa ruudukossa tekisi rampista merkityksettömän.
- **Virhepinnat** (`#toast`, `#rl-banner`) olivat vaaleaa oranssia ja
  punaista DM Monolla läpikuultavan sävytyksen päällä. Virheilmoitus on
  juuri se teksti jonka on pakko mennä perille: nyt paperia ja mustetta,
  ja virheellisyys tulee vasemman reunan varoitusviivasta.
- **Tuntinauhan reunahäivytys**: viimeinen lukema katkesi keskeltä
  numeroa ("19:0") ja näytti vialta. Sama keino kuin aikajanassa.
- **Emoji-taulukko poistettiin.** `_codes` oli pareja `[emoji, sana]`,
  mutta emojia ei renderöity enää missään — se oli ansa joka olisi
  palauttanut ne heti kun joku lukisi `info[0]`. Sanaakaan ei luettu:
  molemmissa lukijoissa oli `const info` jota ei käytetty. Nyt `_kuvaus`
  on sanat, ja sana on tuntisään ikonin `aria-label` — piirretty SVG ei
  muuten kerro ruudunlukijalle mitään.
- **Kuollut `buildWindRoseSVG`** (määritelty, ei kutsuttu) poistettiin.

### Kartan datakieli

Aiemmin kartalla oli **neljä kilpailevaa kieltä**: tummat pillerit
tuulelle, keltaiset pisteet (`#f5c842`) maa-asemille, mintunväriset aallot
(`#29e8a8`) vedenlämmölle ja sinivalkoiset ruksit sijainneille. Kolme
ensimmäistä olivat kategoriavärejä lämpökartan päällä, jonka oma väri taas
tarkoitti jotain. Kaikkien tasojen ollessa päällä ruudulla oli neljä
väriperhettä yhtä aikaa eikä yksikään niistä kertonut mitään.

Nyt kaikki lukemat jakavat **saman tumman pillerin ja saman vaalean
musteen** (`INK_1/INK_2/INK_3`). Ero syntyy **glyfistä**: tuuliviiri vs.
aalto. Toissijaiset asemat ovat pisteitä samassa musteessa — ero
ensisijaisiin on koko ja kirkkaus, ei sävy.

- **Asetusten tasolegenda näyttää glyfin, ei väripalloa.** Kun kartalta
  poistui väri, värilegenda olisi kertonut asiaa jota kartalla ei ole.
  Legendan glyfi on täsmälleen sama jonka merkki piirtää.
- **Tyhjä pilleri putoaa pisteeksi.** Vedenlämpöasema ilman lukemaa
  näytti ennen `~ — °C`, joka vie saman tilan kuin oikea lukema muttei
  kerro mitään.

### Spottimerkit ovat paperia

Sama spotti näytti ennen eri asialta kartalla (tumma levy, neonvihreä
rengas) ja ennustepaneelissa (paperi, mustekaari) — vaikka kyse on samasta
esineestä. Nyt kartan merkki on sama paperimerkki kuin paneelissa:
`spotMarkerSVG(..., paperi = true)` ja `spotIndexInk()`.

Kaksi syytä, joista jälkimmäinen on tärkeämpi:

1. **Sama esine näyttää samalta kaikkialla.**
2. **Neonvihreä `rgb(0,255,140)` oli sama sävy kuin lämpökartan 8 m/s.**
   Spotin pistemäärä ja tuulennopeus kilpailivat samasta sävystä, joten
   kumpikaan ei ollut luettava toisen päällä. Musteramppi on vaimea ja
   asuu paperilla, joten se ei osu lämpökartan kanssa yhteen.

**Nimikyltti ei ota indeksin väriä.** Merkki kertoo pisteet jo kahdesti
(kaaren pituus ja luku); kolmas kerros tekisi nimen luettavuudesta
indeksin panttivangin — matalan pistemäärän spotin nimi olisi harmaa.

### Väistö: kumpi spotti saa täyden merkin

Helsingin edustalla on kahdeksan spottia noin 20 km:n matkalla. Zoomilla 9
ne ovat ruudulla 30 px:n päässä toisistaan, eli renkaat menivät ristiin ja
luvut lukukelvottomiksi. Mitattuna **55,7 % renkaiden pinta-alasta oli
toisen renkaan alla zoomilla 8** ja 23,3 % zoomilla 9.

`_valitseTaydetSpotit()` tekee ahneen valinnan pistemäärän mukaan: kasan
paras saa täyden renkaan, muut kutistuvat pisteiksi. Mittaus väistön
jälkeen: **0 % kummallakin zoomilla.**

- **Mitään ei piiloteta.** Piste on yhtä lailla napautettava ja kertoo
  että spotti on siinä — luettavaksi vain tarjotaan se joka juuri nyt
  kannattaa lukea.
- **Kynnys on ruutupikseleissä**, joten kasat purkautuvat itsestään kun
  zoomaa lähemmäs.
- **Hävinnyt piste piirtyy renkaan ALLE** (`zIndexOffset: -1000`), muuten
  se jäisi puolittain renkaan päälle ja näyttäisi virheeltä.
- **Zoomatessa spotteja ei piirretä uudelleen** vaan skaalataan — se
  säilyttää animaation. Väistöjoukko kuitenkin riippuu zoomista, joten
  `_spotVaistoMuuttuisi()` tarkistaa erikseen muuttuisiko se, ja vain
  silloin ajetaan täysi `renderSpots()`.

### Tokenit

`:root`issa on `--surface / --surface-hi / --surface-lo`, `--hairline(-soft)`,
`--ink / --ink-2 / --ink-3`, `--accent`, `--info`. Kaikki musteet läpäisevät
WCAG AA:n kummallakin pinnalla (14.3 / 5.9 / 4.6 : 1).

Asiat jotka eivät ole ilmeisiä:

- **`--accent` on toiminto- ja varoitusväri, ei korostusväri.** Sääntö
  tarkennettiin kun spottikortti auditoitiin: magenta oli levinnyt kuuteen
  rooliin yhdellä kortilla (asemanimi, "Avomeri", UiRas-otsikko, kaavion
  maksimipiste, ennustepiikki, navinapit). Nyt se on varattu **toiminnoille**
  (navinapit, kytkimet) ja **tiloille jotka vaativat huomiota**
  (verkkotilan siru, mallien voimakas erimielisyys). Pelkkä nimilappu tai
  datapiste ei ole kumpaakaan — ne ovat mustetta. Se varataan kytkimille ja
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
sävypolku ja sama `msToT`, mutta **kirkkaus kulkee vastakkaisiin
suuntiin**: kartalla se nousee tuulen mukana (musta meri alla), musteessa
se laskee (beige paperi alla, L\* 44 → 13). Merkitys on molemmissa sama —
kovempi tuuli tarkoittaa enemmän kontrastia pohjaan. Mustevariantti on
4.52–13.1:1 molemmilla paneelipinnoilla.

**Mustevariantti ei ole värisokeusturvallinen eikä sitä saa siksi.**
Beigellä 4.5:1 kattaa L\*:n noin 44:ään, joten käytettävissä oleva
kirkkausväli on kolmasosa kartan välistä; deuteranoopille pienin dE jää
3.9:ään. Se on tässä hyväksyttävää, koska paneelissa väri on **aina luvun
vieressä** — data on numerossa ja väri vahvistaa sen. Kartalla väri on
ainoa koodaus, ja siksi juuri se ramppi tehtiin turvalliseksi. Älä siirrä
kartan turvallisuusvaatimusta musteeseen äläkä päinvastoin.

Mustevariantilla on nykyään **kolmas tehtävä**: vaalealla pohjakartalla se
on lämpökartan ramppi. Se ei ollut suunniteltua vaan seurausta siitä että
multiply-sekoitus kääntää kirkkaussuunnan — ks. *Kartan asetukset*. Siinä
roolissa se osoittautui mitattuna paremmaksi kuin kartan omat rampit, myös
värisokealle (6.3–7.2), koska paperia vasten signaali kulkee musteen
määrässä. **Jos musteramppia muuttaa, se muuttuu nyt kahdessa paikassa.**

Sama kaksijakoisuus pätee spotti-indeksiin: `spotIndexInk()` paneeleihin
ja `spotMarkerSVG(..., paperi)` vaihtaa renkaan taustan ja uran.
Indeksiasteikon suunta on tuulen suhteen käänteinen — iso pisteluku on
hyvä — joten se kulkee neutraalista kullan kautta vihreään ja turkoosiin.

**Indeksiasteikon yläpää on kylläisempi kuin alapää.** Se ei ole poikkeus
mustesäännöstä vaan sen soveltaminen: asteikko kulutti aiemmin
erottelukykynsä väärässä päässä. Mitattuna 25 vs 60 oli dE 34.2 mutta
60 vs 85 vain 9.3, ja koko ajettavalla alueella 60–100 pienin dE oli 3.7 —
kartalla kaksi hyvää spottia näyttivät samalta, mikä on juuri se vertailu
jota varten kartta avataan. Kroma romahti kärjessä (C50=27, C100=13).
Nyt kroma nousee loppuun (C100=30) ja kirkkaus 32 → 44; **60 vs 85 on
9.3 → 14.8**. Vaimea alapää on sama päätös toisin päin: huono keli ei
tarvitse huutaa.

Kärki on 5.13:1 merkin levyä vasten, eli kylläisyyttä ei voi enää nostaa
ilman että AA pettää. Siksi peräkkäisten 10 pisteen askelten minimi jää
4.4:ään — sitä ei kannata yrittää parantaa tällä pohjalla.

**Jos lisäät paneeliin tuulivärillisen luvun, käytä `ink()`-versiota.**
Kartan versio näyttää siellä siltä kuin teksti olisi haalistunut.

### Typografia

Syne ja DM Mono poistettiin. Käyttöliittymä käyttää järjestelmäfonttia
(iPhonella SF Pro), numerot samaa perhettä `tabular-nums`-asetuksella.
Kaksi ulkoista fonttilatausta vähemmän.

**Poisto oli pitkään kesken, ja se on syytä tietää.** Sävyt ja tyylit
vaihdettiin, mutta `body { font-family: 'Syne', sans-serif }` jäi paikalleen
ja `<head>` jäi lataamaan fontin Google Fontsista. Koska se oli tiedoston
**ainoa** `font-family`-sääntö, koko käyttöliittymä oli oikealla laitteella
Syneä — vaikka tämä luku sanoi toista. Kehitysympäristössä virhettä ei
näkynyt, koska fonttiosoitteeseen ei ollut yhteyttä ja selain putosi
varafonttiin: ruutukaappaukset näyttivät juuri siltä kuin dokumentaatio
lupasi. Nyt `body` pyytää järjestelmäpinoa ja fonttilinkit on poistettu.
Opetus: kun ulkoinen resurssi poistetaan, tarkista sekä sen linkki että
sitä käyttävä sääntö — ja muista että estetty verkko piilottaa juuri tämän
virheen.

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

## Sujuvuus — mitattu, ei arvattu

Kaikki alla oleva on mitattu Chromiumissa **4× CPU-kuristuksella**, DPR 3,
390×844. Se approksimoi puhelinta muttei ole iOS Safari — kompositiota
koskevat löydökset ovat Chromiumin, ja Safari voi käyttäytyä toisin.

### Juurisyy: sekoituskerros canvasin alla

Partikkelicanvas on lämpökartan **päällä**, ja lämpökartalla on
`mix-blend-mode: plus-lighter` ja `filter: blur()`. Jokainen canvasin muutos
pakottaa selaimen sekoittamaan koko kerroksen uudelleen.

**Kustannus on suhteessa canvasin pikselimäärään, ei siihen mitä siihen
piirretään.** Mitattu ablaatio: canvasiin ei kosketa 60 fps → **2×2
pikselin kirjoitus 20 fps** → koko ruudun täyttö 20 fps → häivytys +
kaikki viivat 17 fps. Pelkkä likaantuminen maksaa ~33 ms.

Kustannus jakautuu kahtia: `filter` 18 → 34 fps, `mix-blend-mode`
34 → 60 fps. Kumpaakaan ei voi poistaa — sekoitus on rantaviivan kontrasti
(20,1 → 41,5, katso lämpökartan luku).

**Mikään CSS-eristys ei auta.** Kokeiltu ja mitattu tehottomaksi:
`will-change: transform`, `translateZ(0)`, `isolation: isolate`,
`contain: strict` canvasille; `contain: paint`, `will-change`,
`isolation` tilePanelle; `contain: layout paint` kartalle. `contain: paint`
Leafletin paneelilla näytti 61 fps — mutta paneelin laatikko on 0×0, joten
se leikkasi koko kartan pois. Nopeus ilman kuvaa ei ole nopeutta.

Siksi ainoa vipu on **pikselimäärä**: partikkelicanvas piirretään enintään
2× tarkkuudella (2,96 → 1,32 Mpx). Lepotila 19 → 24 fps.

### Partikkelit pysyvät kartalla — ja jatkavat liikettään

Tästä on tehty kolme versiota, ja kaksi ensimmäistä olivat väärin:

1. Raahaus **jäädytti** partikkelit, himmensi canvasin 25 %:iin ja pyyhki
   sen lopuksi. Jäljet katosivat ja koko kenttä syntyi uudelleen.
2. Valmista bittikarttaa **siirrettiin CSS-muunnoksella** eleen ajan.
   Jäljet pysyivät maastossa, mutta liike pysähtyi silti — canvasiin ei
   piirretty mitään koko eleen aikana. Eleen jälkeen kenttä rakennettiin
   uusiksi, ja siinä meni noin 15 ruutua ennen kuin liike näytti
   jatkuvan. Juuri tämä tuntui viiveeltä.

Kumpikin osti nopeutta lopettamalla animaation. Nyt liike ei katkea
missään vaiheessa, ja se maksaa saman kuin versio joka animoi mutta ei
pysynyt maastossa.

**Perusta: partikkelit ovat jo lat/lng-koordinaateissa.** Vain piirto on
sidottu ruutuun. Kentän vaihtuessa ne ovat siis yhä oikeissa paikoissaan —
`resetParticles()` ei enää tyhjennä canvasia eikä arvo kenttää uusiksi,
vaan sovittaa pelkän lukumäärän. Tyhjennys tapahtuu vain kun canvasin
sisältö on oikeasti pätemätön (ikkunan koon muutos, asennon vaihto).

Kartta liikkuu kahdella tavalla, ja ne vaativat eri ratkaisun
(`KanvasSiirto`):

- **Siirto** (raahaus, inertia, `setView`): bittikarttaa siirretään joka
  ruudussa sen verran kuin kartta liikkui, ja uudet pätkät piirretään
  nykyiseen projektioon. Siirto pyöristetään kokonaisiin laitepikseleihin
  ettei kuva sumene, ja pyöristyksen jäännös kannetaan seuraavaan ruutuun
  ettei pitkässä raahauksessa kerry ryömintää.
- **Zoom** (rulla, tuplanapautus, napit, nipistys): mittakaava muuttuu, ja
  bittikartan skaalaus 60 kertaa sekunnissa sotkisi jäljet puuroksi.
  Siksi zoomin ajaksi **ruudusto jäädytetään** ja canvas venytetään
  CSS-muunnoksella — bittikarttaan ei kosketa, se skaalautuu
  kompositoinnissa kerran ruudussa. Simulaatio jatkuu jäädytetyssä
  ruudustossa, joten jäljet venyvät maaston mukana ja liike jatkuu. Kun
  zoom on ohi, muunnos paistetaan kerran bittikarttaan.

#### CSS-muunnos kelpaa vain suurentamaan

Tämä oli seuraava vika. CSS-muunnos liikuttaa canvasin **suorakulmiota**,
joten alle yhden mittakaava kutistaa canvasin ruutua pienemmäksi eikä
reunoille jää mitään. Mitattuna kolmen zoom-tason nipistys ulos kuristi
partikkelikerroksen ruudun pinta-alasta **100 % → 54 % → 22 % → 4 % → 2 %**.
Kartan reunat olivat tyhjät ja keskellä oli suorakulmio partikkeleita.

Sääntö on siis: **pidä sisältö siinä ruudustossa jossa muunnos suurenee.**

| ele | sisältö | canvas |
|---|---|---|
| siirto | nykyisessä ruudustossa | ei muunnosta (bittikartta siirtyy) |
| zoom sisään | lähtöruudustossa | 1 → s, paistetaan lopuksi |
| zoom ulos, animoitu | paistetaan heti maaliruudustoon | 1/s → 1 |
| zoom ulos, nipistys | paistetaan joka ruudussa nykyiseen | ei muunnosta |

Ulospäin animoidussa zoomissa canvas kulkee siis **käänteismuunnoksesta
identiteettiin**: se aloittaa suurennettuna eikä käy hetkeäkään ruutua
pienempänä. Siirtymä on sama kuin karttatasoilla, ja koska selain
interpoloi sen, omaa pehmennyskäyrää ei tarvitse mallintaa. Peitto on
mitattuna **100 % kaikissa eleissä ja kaikissa vaiheissa**.

Nipistyksessä maalia ei tiedetä, joten ulospäin sisältö paistetaan joka
ruudussa. Se maksaa saman kuin raahaus — yksi koko canvasin veto
ruudussa — ja mitattuna nipistyksen ruutunopeus ei eronnut edellisestä
versiosta (13–15 fps ulos, 14 sisään, 4× kuristuksella).

Asiat jotka eivät ole ilmeisiä:

- **Nipistyksen CSS-muunnosta ei saa paistaa seuraavassa ruudussa.**
  Animaation päätyttyä muunnos pitää paistaa, mutta nipistyksen muunnos
  elää yli ruutujen ja päivittyy joka ruudussa. Kun molemmat kulkivat
  saman lipun kautta, nipistys sisäänpäin paistoi joka ruudussa: mittaus
  näytti canvasin skaalan jäävän arvoon 1,20 vaikka ele oli 3,8-kertainen,
  ja ruutunopeus putosi 15:stä 11:een. Siksi `_animoitu` erottaa nämä.

- **Leaflet valehtelee animaation ajan.** `zoomanim` syttyy ennen kuin
  kartan tila hyppää maaliin, ja heti sen jälkeen `getZoom()` ja
  `latLngToContainerPoint()` kertovat jo maalin — vaikka kuva on vasta
  lähdössä ja karttatasoja venytetään 0,25 s CSS-siirtymällä. Siksi
  lähtötila on luettava juuri siinä tapahtumassa, ja canvasille annetaan
  sama siirtymä (`transform .25s cubic-bezier(0,0,.25,1)`).
- **`transform-origin: 0 0` on pakollinen.** Muunnos lasketaan ruudun
  vasemmasta ylänurkasta kuten Leafletillä; oletusorigo (keskellä)
  skaalaisi väärästä kohdasta.
- **Nipistys ei ole animaatio.** Siinä Leaflet siirtää karttaa suoraan
  joka ruudussa murtoluku-zoomilla, eikä `_animatingZoom` ole päällä.
  Ele tunnistetaan Leafletin omasta `pinch`-lipusta (`map.on('zoom')`).
  Ilman sitä samaan haaraan päätyisi myös kertaloikka (`setView`), jonka
  `zoomend` on jo ehtinyt tapahtua — canvas jäisi pysyvästi venytetyksi.
  Tämä oli oikeasti rikki: mittaus näytti canvasin skaalan jämähtäneen
  arvoon 32.
- **Yli kahden zoom-tason venytystä ei paisteta** vaan canvas
  tyhjennetään: kuva olisi pelkkää puuroa, ja jäljet syntyvät takaisin
  puolessa sekunnissa.
- **Häivytys ja siirto ovat sama veto.** `copy` korvaa kohteen lähteellä,
  ja `globalAlpha` kertoo lähteen läpinäkyvyydellä — tulos on sama kuin
  erillinen `destination-in`-häivytys. Se säästää yhden koko canvasin
  läpikäynnin joka ruudussa, mikä on tässä se mikä maksaa (katso yllä:
  likaantuminen ~33 ms). **Mitattuna vetoele 19 → 26 fps.**
- **Rajat ja zoom luetaan `GeoProject`ista, ei kartalta.** Silmukan on
  nähtävä kartta yhtenä johdonmukaisena tilana: jos rajat luettaisiin
  animaation aikana suoraan kartalta, partikkelit syntyisivät uudelleen
  eri projektiossa kuin missä ne piirretään.

**Mitattu, 4× kuristus, DPR 3, vetoele:** versio joka jäädytti 53 fps,
versio joka animoi muttei pysynyt maastossa 27 fps, **tämä 26 fps**. Eli
maastossa pysyminen on käytännössä ilmaista; hinta tulee animoinnista,
joka on koko pointti. Lepotila on ennallaan (16 fps molemmissa).

**Mitattu kiinnitys.** Testi maalaa laikun tunnettuun koordinaattiin ja
katsoo joka askeleen jälkeen, onko laikku yhä siinä mihin koordinaatti
projisoituu: **100 % kahdeksalla askeleella ja inertian läpi.** Zoomissa
verrataan Leafletin omaan zoom-animoituun merkkiin: ero **≤ 1,9 px** koko
animaation ajan, ja se on `GeoProject`in lineaarisen approksimaation
oma virhe (kontrollimittaus antaa saman luvun ilman canvasia).

**Liike ei pysähdy kertaakaan.** Ruutu ruudulta mitattuna 60 partikkelin
otoksesta: raahauksessa, zoomissa, nipistyksessä ja heti eleiden jälkeen
**0 jäätynyttä ruutua** — aiemmin zoomissa niitä oli 12 peräkkäin.

#### Tiheys ei ole ylläpidettävä asia vaan määritelmä

Tässä meni kolme kierrosta väärään suuntaan, ja kannattaa tietää miksi.

Partikkelit elivät **lat/lng-koordinaateissa**. Ajatus on houkutteleva —
partikkeli "on" kartalla — mutta se tekee tiheydestä näkymän funktion:
ulos zoomatessa sama joukko kattaa kahdeksasosan ruudusta, eikä mikään
palauta sitä. Mitattuna kolmen zoom-tason nipistys jätti 32 ruutulohkoa
36:sta tyhjäksi, ja luonnollinen uusiutuminen vei siitä viisi sekuntia.

Sitä paikattiin kolmella perättäisellä koneistolla — ruutukohtainen
pinta-alasääntö, sama sääntö leikkauksen sisältä laskettuna, ja lopuksi
kertatasaus 4×4 ruudukolla eleen lopussa. Jokainen paransi mittaria,
eikä yksikään korjannut syytä. Paras niistä jäi 1,16–1,42-kertaiseksi
satunnaisjakaumaan nähden.

**Partikkeli on nyt ruutupiste (x, y).** Silloin tasainen tiheys ei ole
ylläpidettävä asia vaan määritelmä: uusi partikkeli arvotaan tasaisesti
ruudulta. Tuuli haetaan kääntämällä ruutupiste koordinaatiksi — yksi
kerto- ja yhteenlasku suuntaa kohti. Sama rakenne on Cameron Beccarion
`earth`-projektissa ja siitä johdetuissa (Windy, leaflet-velocity).

Koko tasauskoneisto poistui. Tilalle jäi yksi sääntö:

> **Canvasin sisältö ja partikkelit ovat aina samassa ruudustossa.**

Kun bittikarttaa muunnetaan `(s, tx, ty)`:llä, samat luvut ajetaan
partikkeleille (`siirraPartikkelit`). Ruutukoordinaateissa myös se mitä
näkymän muutos vaatii on eksakti eikä arvio: edellinen ruutu on nyt
suorakulmio `[tx, ty, tx+sW, ty+sH]`, paljastunut alue on ruutu miinus
se, ja sinne kuuluu `N × paljastunutAla / ala` partikkelia. Ne otetaan
ensin niistä jotka valuivat reunan yli.

Tästä seuraa oikea käytös kaikissa eleissä ilman erikoistapauksia:

- **Raahauksessa** reunan yli valuneiden määrä on tasan se minkä
  paljastunut kaista tarvitsee, joten ylimääräisiä ei siirretä eivätkä
  jäljet lyhene.
- **Ulos zoomatessa** reunan yli ei valu ketään ja kehä saa `N(1−s²)`
  partikkelia — tasan se määrä joka pitää tiheyden ennallaan.
- **Sisään zoomatessa** paljastunutta alaa ei ole, ja reunan yli menneet
  arvotaan tasaisesti koko ruudulle.

Kaksi kohtaa joihin kompastuin ja jotka mittaus paljasti:

- **Siirrettävät on otettava kutistuneen laatikon sisältä**, ei mistä
  tahansa. Muuten osa osumista menee jo valmiiksi paljastuneelle
  alueelle, laatikko jää liian tiheäksi ja kehä liian täyteen —
  nipistyksessä kenttä jäi kaksi kertaa epätasaisemmaksi kuin
  satunnaisjakauma.
- **Täydennys ei saa arpoa takaisinpanolla.** 118 arvontaa 120
  partikkelista osuu vain noin 75 eri partikkeliin, joten loput jäävät
  paikalleen. Sama oire, sama mittaustulos.

**Mitattu (CV/Poisson, 1,0 = yhtä tasainen kuin arvottu):**

| ele | ennen | nyt |
|---|---|---|
| lepo | 1,10 | 1,11–1,29 |
| zoom ulos 1 taso | 1,40 | **0,89–1,19** |
| zoom ulos 3 tasoa | — | **0,92–1,14** |
| nipistys ulos | 1,42 | **0,92–1,25** |
| raahaus | — | **0,97–1,13** |

Tyhjiä ruutulohkoja on 0 kaikissa eleissä 400 ms:n kuluttua, ja
peittävyys 100 % koko ajan.

#### Partikkelit kuuluvat NÄKYVÄLLE alueelle, ei sisältöruudustoon

Ruutukoordinaatteihin siirtyminen ei yksin riittänyt. Partikkelit
arvottiin ja karsittiin sisällön ruudustoon — mutta canvasilla voi olla
CSS-muunnos, jolloin vain osa sisällöstä on ruudulla. Sisään
nipistettäessä näkyvien määrä romahti **120:stä seitsemään** (keskiarvo
41), eli kenttä käytännössä tyhjeni juuri silloin kun sitä katsottiin.

Se ei näkynyt mittareissa, koska mittarini laski partikkelit sisällön
ruudustossa. **Mittari oli väärässä koordinaatistossa, ei sovellus.**
Sen jälkeen kun mittaus vietiin canvasin CSS-muunnoksen läpi, vika näkyi
ensimmäisellä ajolla.

- `State.alue` on näkyvä alue sisällön koordinaateissa: CSS-muunnoksen
  käänteiskuva ruudusta. Sitä käyttävät sekä `respawn` että silmukan
  rajatarkistus, joten koko budjetti on aina siellä missä se näkyy.
- **Näkyvä alue voi muuttua ilman että sisältöä muunnetaan.** Nipistys
  sisään `maxZoom`in yli pomauttaa lopuksi takaisin, ja silloin
  partikkelit jäivät siihen pieneen laatikkoon joka oli näkyvissä eleen
  huipulla: 27 ruutulohkoa 36:sta tyhjänä, eikä tilanne korjaantunut
  itsestään. Siksi tasaus vertaa **näkyvän alueen** muutosta
  (`AlueVahti`), ja sisällön muunnos vain siirtää muistissa olevaa
  edellistä aluetta mukanaan.
- **CSS-siirtymän aikana muunnos elää selaimen käsissä**, joten alue
  luetaan siltä ruutu ruudulta. Ilman sitä alue hyppäsi maaliin heti ja
  näkyviä oli 0,25 s ajan 44/120.

**Mitattu ruudun läpi** (CV/Poisson, 1,0 = yhtä tasainen kuin arvottu):

| ele | CV/Poisson | näkyvissä | tyhjiä lohkoja 400 ms:n jälkeen |
|---|---|---|---|
| lepo | 1,09–1,18 | 98–99 % | 0–1 |
| zoom ulos 1 taso | 0,93–1,13 | 98–99 % | 0–1 |
| zoom ulos 3 tasoa | 0,92–1,15 | 98–100 % | 0 |
| nipistys ulos | 1,00–1,35 | 99–100 % | 0 |
| nipistys sisään | 0,93–1,12 | 90–100 % | 0 |
| raahaus | 0,90–1,34 | 98–99 % | 0 |

#### Jälki on geometriaa, ei pikseleitä

Klassinen tapa piirtää tuulipartikkeleita on jättää jäljet canvasille ja
häivyttää koko kuvaa vähän joka ruudussa. Se on halpaa ja näyttää
hyvältä — kunnes karttaa zoomataan. Silloin valmis bittikartta pitäisi
venyttää uuteen mittakaavaan, ja 2–4-kertainen venytys muuttaa ohuet
viivat **turvonneiksi palloiksi**. Kiertoteitä kokeiltiin kolme
(jäädytys, CSS-venytys, paisto bittikarttaan) ja jokainen kaatui samaan
asiaan, koska jälki oli tallessa vain pikseleinä.

Nyt jokainen partikkeli muistaa oman polkunsa: 20 viimeisintä paikkaa,
joka neljäs ruutu. Canvas tyhjennetään joka ruudussa ja polut piirretään
uudelleen nykyiseen muunnokseen. Siitä seuraa neljä asiaa:

- **Mitään ei koskaan venytetä.** Zoomissa jälki on yhtä terävä kuin
  levossa.
- **Canvasille ei tarvita CSS-muunnosta**, joten se peittää aina koko
  ruudun eikä kutistu reunoilta. Koko `_css`/`paista`/bittikartan
  paisto -koneisto poistui.
- **Jäljen pituus on suora luku** (`JALKI × ASKEL` = 80 ruutua) eikä
  häivytysvakion sivutuote. `FADE_OPACITY` poistui.
- **Ruutunopeus kaksinkertaistui.** 4× kuristuksella, DPR 3: 12 → 24 fps
  levossa. Syy on se, että canvas on nyt enimmäkseen tyhjä: häivytettävä
  kuva piti koko ruudun verran mustetta, jonka sekoituskerros joutui
  laskemaan joka ruudussa uudelleen.

Zoom-animaation ajan kartan tila on jo maalissa mutta kuva vasta
matkalla. Siihen ei tarvita omaa pehmennyskäyrää: **`#c-wind-kello` on
näkymätön elementti jolla on sama CSS-siirtymä kuin karttatasoilla**, ja
siltä luetaan joka ruudussa se muunnos jossa kartta juuri nyt näkyy.
Selain hoitaa easingin, me luemme tuloksen.

#### Jälki on kapeneva nauha, ei pino vetoja

Häivytystä yritettiin kahdesti vedoilla, ja molemmat kaatuivat samaan
asiaan: **veto on paksu ja sillä on päät.**

1. *Segmentti kerrallaan, kullakin oma alfa.* Näytti helmiketjulta —
   segmentti on lyhyempi kuin viivan leveys, joten pyöreät päät jäävät
   päällekkäin ja vierekkäiset alfat tekevät niistä erillisiä pisaroita.
2. *Kolme sisäkkäistä vetoa* eri pituudella, leveydellä ja alfalla.
   Tämä luettiin pitkään "komeetaksi", mutta lähikuva kertoi muuta:
   **kolme pyöreäpäistä kapselia päällekkäin**. Leveämmän kirkkaan vedon
   pyöreä pää työntyi kapeamman himmeän yli, ja alfa vaihtui portaana
   kahdessa kohtaa. Kovassa tuulessa pisteitä oli vain yhdeksän
   viidenkymmenen pikselin matkalla, joten polylinja oli myös
   särmikäs. Yhdessä ne lukivat makkarajonona.

Kumpaakaan ei saa pois alfaa tai leveyttä säätämällä, koska **vika on
muodossa**. Nyt jälki on yksi täytetty monikulmio: polun ympärille
lasketaan reunaviiva, jonka puolileveys kapenee kärjestä hännän nollaan.

- **Päätyjä ei ole**, joten mikään ei työnny minkään yli.
- **Alfa on vakio koko jäljellä** eikä portaita synny. Häivytys tulee
  muodosta: kapeneva nauha vie vähemmän mustetta hännässä, ja
  additiivisessa sekoituksessa se lukee himmenemisenä.
- **Reunat ovat käyriä.** Pisteiden puolivälien kautta kulkeva
  neliöllinen käyrä maksaa saman määrän polkukomentoja kuin suora
  jakso, ja poistaa juuri sen särmikkyyden joka luki "pikselinä".
- **Piirtokutsuja on 10 eikä 30**, koska tasoja on yksi.

Kolme yksityiskohtaa jotka eivät ole ilmeisiä:

- **Kapeneminen on `1 − t²`, ei `1 − t`.** Se on tasainen kärjessä
  (derivaatta nolla). Kärkeen tulee pyöristys, ja jos leveys kapenee
  heti sen takaa, pää pullistuu nauhan yli ja jäljelle jää **väkänen**.
  Tasainen alku sulattaa pyöristyksen nauhaan.
- **Kärki pyöristetään puoliympyrällä.** Ilman sitä nauha alkaa
  kohtisuoralla katkaisulla juuri siinä kohdassa mihin katse menee.
- **Normaali lasketaan naapuripisteiden erotuksesta**, jolloin mutkassa
  reuna kääntyy pehmeästi eikä nurkkaa synny.

Mitattu peitto ruudusta (tasainen kenttä, z9):

| m/s | kolme vetoa | nauha |
|---|---|---|
| 4 | 2,3 % | 2,5 % |
| 12 | 16,8 % | 11,1 % |
| 20 | 21,1 % | 14,4 % |

Nauha on kevyempi kovassa tuulessa mutta ei heikossa — juuri se mitä
haettiin. Leveys ja alfa laskettiin samalla (`2,5 + 2,7·t` ja alfakatto
0,50), koska täytetty muoto on tiiviimpi kuin kolme osittain
päällekkäistä vetoa: ilman laskua yksittäinen jälki luki umpinaisena
teränä (musteen keskiarvo 77 → 93).

#### Isompi ja harvempi lukee paremmin kuin ohut ja tiheä

Ensimmäinen tiheys oli noin 310 hiukkasta 390×844 ruudulla (`ala / 1050`),
ja se valittiin ruutunopeudella: 227 antoi 24 fps, 451 antoi 14 fps, 313
antoi 18–19 fps. Ruutunopeus ei kuitenkaan kerro erottuuko jälki.

Mittari joka kertoo: **luettava peitto** = osuus ruudusta jossa on
partikkelimustetta, jonka kontrasti *omaan taustaansa* on vähintään 1,5.
Se rankaisee molemmista suunnista — liian ohut jää kontrastin alle, liian
harva ei kerrytä peittoa. Pyyhkäisy niin että mustemäärä pysyy vakiona
(leveys ylös, määrä alas samassa suhteessa):

| leveys | n | luettava peitto | näkymätöntä |
|---|---|---|---|
| ×1,00 | 313 | 2,95 % | 12 % |
| ×1,25 | 251 | 3,27 % | 11 % |
| **×1,50** | **209** | **3,55 %** | **9 %** |
| ×1,80 | 174 | 3,39 % | 9 % |

Optimi on ×1,50 ja se on aito huippu, ei pyyhkäisyn reuna. Syy on
antialiasointi: ohut viiva menettää huippualfansa osittaiseen peittoon,
paksu ei. Sama muste luettavampana — ja kolmannes vähemmän partikkeleita
on myös halvempi piirtää. Kaksi kierrosta DPR 3:lla ja 4× kuristuksella,
313 → 219 hiukkasta: **levossa 19/17 → 23/21 fps**, vetoeleessä
18/17 → 18/20 fps.

**Nämä kaksi kuuluvat yhteen.** Jos toista muuttaa yksinään, mustemäärä
muuttuu ja pyyhkäisyn tulos ei enää päde.

Nykyarvot ovat `particleLineWidth` = `2,15 + ms/MAX_MS × 2,3` ja tiheys
`ala / 1500`. Leveys on siis noin 15 % ohuempi kuin yllä mitattu optimi:
se on **tietoinen poikkeama ulkoasun hyväksi**, tehty pyynnöstä koska
paksu veto näyttää kartalla raskaalta. Mitattuna se ei maksanut
luettavuutta, koska määrä palautui samaan aikaan täyteen maa/vesi-rajauksen
poiston myötä: **luettava peitto 3,98 %** (153 hiukkasta), eli yli taulukon
parhaan 3,55 %:n. Jos määrä joskus laskee, ohennus alkaa purra — mittaa
uudelleen ennen kuin ohennat lisää.

#### Jäljen pituus rajataan ruudulla, ei ruuduissa

Jälki oli vakiomittainen ajassa: `JALKI × ASKEL` = 80 ruutua liikettä.
Silloin sen pituus **ruudulla** on suoraan nopeus × 80, eli kovassa
tuulessa monikerta siitä mitä heikossa. Mitattuna tasaisella kentällä
z9:llä, sama hiukkasmäärä:

| m/s | jälki px | muste px² | peitto ruudusta |
|---|---|---|---|
| 4 | 23,8 | 6 717 | 2,35 % |
| 12 | 73,7 | 77 395 | 19,44 % |
| 20 | 101,8 | 132 808 | **30,87 %** |

Kolmannes ruudusta täynnä viivaa. Myrsky ei näyttänyt kovalta tuulelta
vaan sotkulta, koska yksittäinen jälki ei erottunut naapureistaan.

Kolme asiaa kasvaa nopeuden mukana yhtä aikaa — pituus 4,3×, leveys
1,7× ja alfa 2,2× — eli mustetta on kärjessä noin 16-kertaisesti.
Leveyttä ja alfaa ei voi laskea, koska ne ovat juuri se mikä tekee
yksittäisestä jäljestä luettavan (ks. edellinen luku), ja tausta on
kovassa tuulessa kirkkaimmillaan. Pituus on ainoa joka saa kylläistyä.

`JALKI_MAX_PX` on pyyhkäisty:

| raja | 4 m/s | 12 m/s | 20 m/s | suhde 20/4 |
|---|---|---|---|---|
| ei rajaa | 2,35 % | 19,44 % | 30,87 % | 13,1× |
| 80 px | 2,17 % | 18,14 % | 23,07 % | 10,6× |
| **62 px** | **2,28 %** | **16,75 %** | **21,10 %** | **9,3×** |
| 45 px | 2,34 % | 14,31 % | 16,33 % | 7,0× |

62 px valittiin koska se **ei kosketa heikkoa tuulta lainkaan** (2,35 →
2,28 %, eli raja puree vasta noin 8 m/s yläpuolella) mutta leikkaa
kärjestä kolmanneksen. 45 px veisi pidemmälle, mutta silloin 12 ja
20 m/s ovat pituudeltaan käytännössä sama (40,7 ja 39,7 px) — nopeuden
kolmesta vihjeestä yksi katoaisi.

Toteutus on jaolasku liikesilmukassa: pisteet ovat `nopeus × ASKEL`
pikselin päässä toisistaan, joten rajaan mahtuva määrä on suoraan
`JALKI_MAX_PX / (nopeus × ASKEL)`.

#### Lyhennys osuu eri nopeuksiin eri kautta

Jälki oli yhä liian pitkä, ja lyhennys piti tehdä **kahdesta suunnasta
kerralla**, koska ne purevat eri nopeuksiin:

- **Heikossa tuulessa pituuden ratkaisee aika**, `JALKI × ASKEL`
  ruutua. Katto ei purista siellä lainkaan.
- **Kovassa tuulessa pituuden ratkaisee katto** `JALKI_MAX_PX`.

Vain toista säätämällä toinen pää jäisi ennalleen. Katto laskettiin
62 → 46 px ja aikaperustainen pituus 80 → 60 ruutuun.

**Aikapituus lyhennettiin askelta pienentämällä, ei pisteitä
vähentämällä**, vaikka `15 × 4` ja `20 × 3` antavat saman 60 ruutua.
Ensimmäinen yritys oli `15 × 4`, ja kovassa tuulessa jälkeen jäi silloin
**6,6 pistettä**: rajaan mahtuva määrä on `raja / (nopeus × ASKEL)`, eikä
pistemäärän vähentäminen vaikuta siihen mitenkään. Niin harvasta hilasta
nauhan reunaan tuli näkyvä nykäys. Askeleella 3 samaan 46 pikseliin
mahtuu 8,4 pistettä ja reuna on sileä.

Tiheämpi talletus ei maksa mitään mitattavaa. Molemmat variantit ajettiin
samassa vertailussa: ruutumäärät olivat 37–52 kummallakin, eikä ero
erottunut kohinasta. Välissä ehdittiin epäillä että `ASKEL 3` ohentaisi
kenttää — hiukkasmäärä valui 212:sta 102:een pitkän ajon aikana — mutta
**sama valuminen tapahtui myös `15 × 4` -variantilla**. Se on
`PerfTracker`in normaalia sopeutumista tässä kontissa, ei tämän
muutoksen aiheuttamaa.

#### Sileys irrotettiin pistemäärästä

Katto laskettiin vielä 46 → 32 px, ja silloin 18 m/s jälkeen jäi taas
**6,6 pistettä** ja nykäys palasi. Sama seinä siis vastaan uudestaan:
talletusväli on `nopeus × ASKEL`, joten mitä lyhyempi jälki, sitä
harvempi hila — ja askeleen pienentäminen edelleen olisi lyhentänyt myös
heikkoa tuulta, jota ei haluttu lyhentää enempää.

Nykäys ei kuitenkaan johdu siitä montako pistettä on **talletettu** vaan
siitä montako kertaa **kapeneminen näytteistetään**. Nauha tihennetään
nyt piirtovaiheessa: raakapisteiden väliin lasketaan lisänäytteitä
kunnes niitä on vähintään `NAUHA_MIN` (14), sijainti lineaarisesti ja
leveys jatkuvasta kaavasta. Portaat katoavat, ja **sileys ei enää riipu
siitä montako pistettä pituusrajaan sattuu mahtumaan** — katon saa nyt
säätää vapaasti ilman että muoto hajoaa.

Tihennys tehdään vain kun sitä tarvitaan: jos raakapisteitä on jo
tarpeeksi, `osat` on 1 eikä mitään lasketa turhaan.

Jäljen pituus kovassa tuulessa lopulta:

| | 18 m/s | 10 m/s |
|---|---|---|
| kolmen vedon pino | 52 px | 47 px |
| nauha, katto 46 | 41 px | 41 px |
| **nauha, katto 32 + tihennys** | **28 px** | **30 px** |

### Partikkelit kirkastavat kenttää, eivät peitä sitä

Partikkeli piirrettiin samalla rampin värillä kuin lämpökartta samassa
nopeudessa — eli **omaa taustaansa vasten**. Mitattuna ruudulta (sama
kuva partikkelien kanssa ja ilman, luminanssiero pikseleittäin):

| | ennen | nyt |
|---|---|---|
| kontrasti omaan taustaan, mediaani | 1,30 | **1,72** |
| alle 1,15 (käytännössä näkymätön) | **26 %** | 10 % |
| alle 1,30 | 50 % | 22 % |
| ylin | 2,32 | 4,21 |

Kaksi muutosta, molemmat sovelluksessa jo käytössä olevaa kieltä:

- **`mix-blend-mode: plus-lighter` partikkelicanvasille.** Sama perustelu
  ja sama varatie kuin lämpökartalla: additiivisena jokainen veto nostaa
  luminanssia, joten jälki erottuu aina.
- **Väri vaalennetaan kohti valkoista** (30 % hännässä, 58 % kärjessä).
  Additiivinen sekoitus yksin ei riitä, koska tummat sävyt lisäävät
  vähän. Rampin sävy kertoo yhä nopeuden, mutta luminanssi nousee
  taustan yli — ja kärki on vaaleampi kuin häntä, jolloin jälki lukee
  suuntansa.

### Nopea sivuvieritys — kolme kerrosta, kolme ennakointia

Kun karttaa heittää sivulle, uutta aluetta paljastuu reunalta nopeammin
kuin mikään kerros ehtii reagoida. Kaikki kolme kerrosta odottivat ennen
samaa asiaa — että jotain on **jo** puuttunut ruudulta — ja lähtivät
vasta sitten liikkeelle. Nyt kaikki kolme katsovat eteenpäin.

Mittausasetelma: 700 px heitto 450 ms:ssa (sama minkä Leafletin inertia
tekee), 180 ms verkkoviive laatoille, näytteet joka ruudulla.

#### 1. Pohjakartta: esihaku kulkusuuntaan

Leafletin oletus `updateWhenIdle` on **mobiililaitteella tosi**, eli
laattoja ei haeta lainkaan liikkeen aikana. Oletus on ajalta jolloin
laattojen purku nykäisi vierityksen. Sen kanssa terävä laattapeitto oli
eleen aikana 45 % ja palasi täydeksi vasta 685 ms kuluttua — siihen asti
puolet ruudusta oli venytettyä isovanhempaa eli sumeaa.

Leaflet hakee tasan sen mitä on näkyvissä juuri nyt, ei laattaakaan
enempää. Tavallinen kiertotie on hakea yksi rengas joka suuntaan; se
auttaa, mutta maksaa 56 % enemmän pyyntöjä **joka kerta kun näkymä
vaihtuu**, myös silloin kun karttaa ei vieritetä — kolme neljäsosaa
renkaasta on aina väärällä puolella.

Tässä pehmuste annetaan vain sinne minne ollaan menossa, ja vain kun
kartta liikkuu. **Paikallaan olevan kartan kustannus on tasan nolla.**

| | terävä peitto eleen aikana | täysi vasta |
|---|---|---|
| Leafletin oletus | 45 % | 685 ms |
| `updateWhenIdle: false` | 56 % | 487 ms |
| rengas joka suuntaan | 76 % | 508 ms |
| **esihaku kulkusuuntaan** | **62–70 %** | **460–476 ms** |

Suunta luetaan kartan keskipisteen siirtymästä pikseleinä. Zoomin aikana
vertailukohta on eri mittakaavassa, joten silloin pehmustetta ei anneta
lainkaan — eikä tarvitakaan, koska zoomatessa uutta aluetta paljastuu
joka puolelta eikä suunnalla ole merkitystä.

Toteutus korvaa `_pxBoundsToTileRange`-metodin laattatasolla. Se on
Leafletin sisusta, joten korvaus asennetaan vain jos metodi on olemassa
— muuten kartta toimii tasan kuten ennenkin, ilman esihakua.

#### 2. Lämpökartta: rakennus alkaa ennen kuin reuna paljastuu

Kate-tarkistus oli **vain zoomissa**. Sivulle vieritettäessä lämpökartta
jäi sinne mihin se oli rakennettu: mitattuna yksi nopea heitto jätti
30 % ruudusta värittämättä, eikä tilanne korjaantunut itsestään
lainkaan — vain uusi datahaku olisi rakentanut tekstuurin uudelleen, ja
sillä on oma kynnyksensä.

Kolme korjausta:

- **Sama kate-tarkistus siirrolle.** Neljä vertailua kehyksessä.
- **Pehmuste mitoitetaan näkymän mukaan** eikä vakiona: puolikas aste on
  z9:llä puoli ruutua mutta z13:lla kymmenen ruutua, eli lähellä turhaa
  työtä ja kaukana liian vähän.
- **Rakennus alkaa ennakkoon.** `_heatmapCovers(0,35)` kysyy "onko reuna
  *paljastumassa*", ei "onko reuna jo paljastunut". Ilman tätä
  lämpökartan kate putosi 66 %:iin heitossa, koska rakennus hävisi kisan
  laattojen lataukselle — nyt se on **100 % joka näytteessä**.

#### 3. Ennustedata: haku lähtee kesken eleen

Data haettiin vasta kun ele oli ohi ja sen päälle odotettiin 350 ms —
koko ele siis kului odottaen, ja vasta sen jälkeen alkoi sekunnin
mittainen haku. Nyt haku lähtee heti kun näkymä on liikkunut tarpeeksi,
sormi kartalla tai ei: mitattuna haku alkaa **1 958 ms kohdalla eikä
3 205 ms kohdalla**, eli 1,25 s aiemmin. Kaksi vartijaa pitää sen
järkevänä: `loadViewport` peruu
edellisen keskeneräisen pyynnön, joten liian tiheä laukaisu estäisi
kaiken valmistumisen — siksi kesken eleen vaaditaan puolen ruudun
siirtymä ja vähintään 600 ms edellisestä.

**Tässä kaatui myös hypoteesi.** Näytti siltä että vierityksen jälkeen
näkymässä oli vain 5 ennustepistettä 12:sta eikä tilanne korjaantunut.
Suoraan mitattuna kaikki 49 pyydettyä pistettä olivat ladattuina,
näkymän neljä hilapistettä mukaan lukien. Ero oli **spoteissa**:
Helsingin edustalla niitä on näkyvissä kahdeksan, idempänä yksi. Datan
lataus ei ollut rikki lainkaan.

#### Karkea tekstuuri oli velkaa jota kukaan ei perinyt

Eleen aikaiset kiinniottorakennukset ovat karkeita (`SCRUB_STEP` 6), ja
zoomille tarkan version palauttaa `zoomend`. Siirrolla ei ollut
vastaavaa. Kun kate-tarkistus laajennettiin siirtoon, syntyi tilanne
jossa karkea tekstuuri jäi ruudulle **toistaiseksi**: ainoa muu tarkka
rakennus on datahaun perässä, eikä se laukea pienessä siirrossa.

`WindTexture.askel` kertoo nyt millä tarkkuudella ruudulla oleva
tekstuuri on laskettu, ja `moveend` rakentaa tarkan version jos velkaa
on. Mitattuna: heiton aikana askel 6, 600 ms kuluttua takaisin 3, kate
100 % koko ajan — myös pienessä siirrossa joka ei ylitä datahaun
kynnystä.

`_hmPending` on samalla muutettu totuusarvosta **askeleeksi**: eleen
aikana pyydetään karkeaa ja pysähdyttäessä tarkkaa, ja jos molemmat
osuvat samaan jonoon, tarkempi voittaa. `WindTexture.build` kirjoittaa
jaettuja kenttiä (`cols`, `latMin`, …), joten kahta rakennusta ei saa
olla lennossa yhtä aikaa.

### Mihin ruutuaika oikeasti menee

Mitattu DPR 3:lla ja 4× CPU-kuristuksella. **Ympäristön pohja
tarkistettiin ensin:** tyhjä sivu samassa kontissa antaa 17 ms / 60 fps,
ja täyden ruudun canvas jota tyhjennetään joka ruutu antaa myös 17 ms.
Luvut ovat siis sovelluksen, eivät kontin.

**Mikä EI ole kallista** — jokainen mitattu erikseen, ero ≤ 3 ms eli
kohinaa:

| kytkin pois | vaikutus |
|---|---|
| lämpökartan `filter: blur() saturate()` | ei mitään |
| lämpökartta kokonaan piiloon | ei mitään |
| `mix-blend-mode` kummallakaan kerroksella | ei mitään |
| `clearRect` täydelle DPR 3 -canvasille | ei mitään |
| `isMarine`, `SpatialIndex.build` | 0,1 ms |

Aiempi arvaus että sekoituskerros olisi juurisyy **ei päde**. Se
mitattiin kerran kumulatiivisilla kytkimillä, jolloin peräkkäiset
muutokset kasautuivat samaan lukuun. Riippumattomasti mitattuna
sekoitus on ilmainen.

**Mikä on kallista:**

- **Partikkelivetojen piirto.** Eristettynä (219 hiukkasta, 30 vetoa,
  60 px jäljet): DPR 3 → 65 ms, DPR 2 → 47 ms. Kustannus on suoraan
  verrannollinen jäljen kokonaispituuteen ruudulla — sama syy kuin
  `JALKI_MAX_PX`:n takana. Kevyessä tuulessa (21 px jäljet) sama joukko
  maksaa vain 13 ms.
- **Tekstuurin rakennus**, ks. seuraava luku.

Tästä seuraa että **lepotilan ruutuaika on koko sovelluksen katto**:
kaikki eleet kulkevat sen päällä. Ainoa jäljellä oleva vipu siihen on
partikkelicanvasin resoluutio, ja se on ulkonäkökysymys eikä
suorituskykykysymys — sitä ei saa ratkaista mittaamalla yksin.

### Kentän rakennus: kaksi mitattua optimointia

`WindTexture.build` oli 45 ms (300×300, askel 3, 4× kuristus). Se ajetaan
joka datahaun jälkeen, joka eleen kiinniotossa, joka aikajanan
askeleella ja joka play-tunnilla — aikajanaa raahatessa 18 kertaa 2,5
sekunnissa.

**1. Väri ja alfa yhtenä 32-bittisenä hakuna.** Täyttösilmukka ajoi
jokaiselle 90 000 pikselille `ColorRamp.rgb()`:n ja alfakaavan
(`Math.exp` + kuutio) — mitattuna 4,5 + 4,6 ms. Ramppi on jo valmiiksi
kvantisoitu 0,1 m/s välein, joten alfan vieminen samaan hilaan ei muuta
kuvaa: ero on korkeintaan 0,002 alfayksikköä, ja päälle ajetaan vielä
3–22 px sumennus. `pikseliLUT()` pakkaa värin ja alfan 201-alkioiseksi
`Uint32Array`ksi, jolloin täyttö on yksi luku ja yksi kirjoitus neljän
sijaan. **Tavujärjestys tarkistetaan ajossa** — kanvaspuskuri on
RGBA-tavuina ja pakkautuu eri järjestyksessä little- ja
big-endian-koneilla.

**2. idw-painot talteen kun kartta on paikallaan.** Painot riippuvat
vain geometriasta: hilasolmujen ja ennustepisteiden sijainneista.
Aikajanaa raahatessa kartta ei liiku lainkaan — vain arvot vaihtuvat —
ja silti sama naapurihaku, `isMarine` ja etäisyyslaskenta ajettiin 18
kertaa. `IdwPainot` tallettaa normalisoidut painot ja tekee jatkossa
pelkän painotetun summan.

Talletusajo on kalliimpi kuin tavallinen rakennus (64 ms vs 23 ms),
joten se kannattaa vain jos sama geometria toistuu vielä monta kertaa.
Kaksi ehtoa, molemmat mitattuja:

- **Kolme peräkkäistä osumaa.** Kahdella osumalla riitti että kaksi
  eleen aikaista kiinniottorakennusta sattui samoihin rajoihin, ja
  talletus maksettiin väärässä paikassa: raahauksen rakennukset
  nousivat 110 ms:stä 163 ms:iin ja eleen jälkeiseen ruutuun tuli
  62 ms:n rakennus. Aikajanan raahauksessa rakennuksia on 18 ja
  play'ssä yli 30, joten kolmas osuma tulee heti eikä hyöty siirry.
- **Vain paikallaan olevalla kartalla.** Liikkeessä geometria vaihtuu
  joka tapauksessa, eikä välimuistille ole käyttöä.

Indeksit osoittavat siihen taulukkoon josta `SpatialIndex` on rakennettu,
ja `SpatialIndex.wf` tarkistetaan ennen kuin painoja luetaan tai
talletetaan — muuten eri taulukolla rakennettu indeksi osoittaisi väärään
pisteeseen.

**Tulos** (300×300, askel 3, 4× kuristus):

| | ennen | nyt |
|---|---|---|
| peräkkäiset ajot samalla geometrialla | 45 ms | 23 → *64* → 25 → **11 → 11 → 11** |
| vaihtuva geometria (ele) | 45 ms | **16–21 ms** |

Kertaluontoinen 64 ms on talletusajo. Vaihtuvan geometrian hyöty tulee
kokonaan hakutaulusta.

**Tarkistettu alkio alkiolta.** Suora laskenta ja välimuistista luettu
antavat saman `msData`:n ja `uData`:n (ero 0 kuudella desimaalilla), ja
90 000 pikselistä **yksi** eroaa yhden LUT-lokeron eli 0,1 m/s verran.
Syy on liukulukujen summausjärjestys: suora tie laskee `su/sw`, luettu
tie summaa valmiiksi normalisoidut painot, eikä liukulukuyhteenlasku ole
assosiatiivinen. Yksi pikseli 90 000:sta 3–22 px sumennuksen alla ei ole
havaittavissa. Sama tarkistus ajettiin myös muuttuneella kentällä
(kertoimet 1,37 ja 0,61): siinä ero oli 0 pikseliä.

### Työ pois eleen päältä

Kaksi erää joita ei tarvitse tehdä juuri silloin kun sormi liikkuu.

**Kentän rakennus odottaa liikkeen loppuun.** Ennakoiva datahaku lähtee
kesken eleen (ks. edellä), ja sen valmistuttua koko ketju —
`buildWindField` + `drawColorField` + `resetParticles` — ajettiin siinä
ruudussa mihin lataus sattui osumaan. Mitattuna raahauksessa
`buildWindField` oli 28–65 ms ja koko ketju kasautui yhteen 125–214 ms:n
ruutuun. Data on jo muistissa; ainoa mitä siirtäminen maksaa on että
väritys päivittyy vasta kartan pysähtyessä, ja sitä varten on oma
kiinniottonsa. `State.liikkeessa` kertoo tilan, ja velka maksetaan
`moveend`issä.

**Aikajana ei rakenna DOMia uusiksi turhaan.** `renderTimeline` tyhjensi
`#tl-scroll`in ja loi noin 370 elementtiä joka kutsulla — mitattuna
**27–43 ms**. Heiton pahimmassa ruudussa (214 ms) se oli suurin
yksittäinen erä, ja siinä kahdesti.

Ensin kokeiltiin muistiota: ohita jos lähdedata on sama olio. **Se ei
riittänyt** — vieritettäessä kartan keskipiste vaihtuu, jolloin lähin
ennustepiste on oikeasti eri ja data siis eri. Mittaus näytti sen
suoraan: `updateTimelineToCenter` oli yhä 40 ms, kahdesti.

Oikea havainto on että **rakenne tulee aikaleimoista, ei arvoista**.
Montako tikkiä, mihin päiväerottimet ja NYT-viiva osuvat, mitkä tunnit
saavat nimikyltin — kaikki tulee `times`-taulukosta, ja kaikki
ennustepisteet tulevat samasta mallista samalla tuntiruudukolla. Vain
palkin korkeus ja väri muuttuvat. Nopea tie päivittää ne paikallaan ja
jättää DOMin koskematta.

Ehtoihin kuuluu **NYT-indeksi**: "mennyt"-tila on sidottu siihen ja se
siirtyy kellon mukana, joten tunnin vaihtuessa on rakennettava kokonaan.
Muistio päivitetään `renderTimeline`ssä eikä kutsujassa, jotta myös sen
kolme suoraa kutsujaa pitävät sen ajan tasalla.

Mitattuna `updateTimelineToCenter` **40 ms → 0–8 ms**, ja heiton
pahimmat ruudut 218/263/196 ms → **129/161/113 ms**.

#### Mikä jäi jäljelle

Pahimmissa ruuduissa on nyt kaksi erää: `WindTexture.build` 21–37 ms
(pohja johon välimuisti ei pure, koska ele vaihtaa geometrian) ja
ruutuja joissa **ei ole yhtään instrumentoitua työtä** mutta jotka
kestävät 110–161 ms. Jälkimmäinen on partikkelien piirtoa ja selaimen
omaa työtä. Se on sama katto joka näkyy lepotilassa.

### Aikajana ja play

Mittarit 4× kuristuksella ovat tarkoituksella pessimistisiä: **tyhjä
sivu samassa kontissa on 17 ms**, eli kuristus on kolmen vuoden takaisen
puhelimen karkea vastine. Sama mitattuna 2×:llä, joka vastaa
lähemmin nykylaitetta:

| | 4× | 2× |
|---|---|---|
| aikajanan raahaus | 15 fps / 69 ms | **50 fps / 20 ms** |
| play | 19 fps / 53 ms | **40 fps / 25 ms** |

Toiminnallisesti: loksahdus janan keskelle 0 px, play'n tuntivälit
788–831 ms (tavoite 800), ja janaan tarttuminen pysäyttää playn.

**Aikajanan raahaus on lepotilan pohjaan sidottu, ei kentän työhön.**
Yksi askel maksaa 4× kuristuksella noin 19 ms — `WindTexture.build`
11 ms (välimuisti puree, 19 osumaa 22:sta) ja `drawColorField` 6 ms —
mutta lepotilan ruutu on 48 ms. Kentän työn puolittaminenkaan ei siis
muuttaisi ruutunopeutta olennaisesti; siihen tarvittaisiin
partikkelicanvasin resoluutio, joka on ulkonäkökysymys.

### Kerrokset samassa paikassa, samaan aikaan

"Kartan eri layerit päivittyvät eri aikaan" oli oikea havainto, mutta
syy ei ollut ajoituksessa.

**Mittari pitää rakentaa oikein.** Ensimmäinen versio vertasi jokaista
kerrosta `map.latLngToContainerPoint`iin. Se on väärä totuus: eleen
aikana Leaflet on jo maalitilassa vaikka ruudulla on vielä lähtötila,
joten mittari näytti 33–628 px eroja siellä missä kerrokset olivat
keskenään tarkalleen kohdallaan. Toimiva mittari lukee **jokaisen
kerroksen oman renderoidyn suorakulmion** (`getBoundingClientRect`) ja
kysyy mihin kohtaan ruutua kukin piirtää saman koordinaatin:

- pohjakartta: se ladattu laatta joka kattaa pisteen, `_tileCoordsToBounds`
- lämpökartta: overlayn `<img>` + `getBounds()`
- partikkelit: `Ruudusto.m ∘ GeoProject`

Leveysasteen ja ruudun y:n välillä on Mercator, joten muunnos tehdään
`ln(tan(π/4 + φ/2))`-avaruudessa — muuten mittari itse tuottaa juuri sen
virheen jota etsitään.

**Lämpökartta oli koko ajan kunnossa** — 0,1–0,5 px pohjakartasta
kaikissa eleissä. Leafletin `ImageOverlay` hoitaa zoom-animaation itse,
eikä `setUrl`in asynkronisuudella ollut väliä (mediaani 9–13 ms).

**Partikkelikerros oli vinossa 4,0 px z9:llä ja 14,8 px z7:llä.**
`GeoProject` sovitti ruudun y:n suoraan leveysasteeseen:

    y = oy + (lat − north) · sy

Mercatorissa se on kaari, ei suora, ja lineaarisen sovitteen virhe on
suurimmillaan juuri ruudun keskellä. `(h²/8)·y″(φ)` ennustaa z9:lle
3,7 px ja z7:lle 14,7 px — eli mitatut luvut tasan. Virhe **riippuu
näkymän korkeudesta asteina**, joten se muuttuu zoomatessa: kenttä
liukui maastoon nähden joka kerta kun zoomia vaihdettiin. Se näyttää
ajoitusvirheeltä vaikka on projektiovirhe.

Korjattuna `project`/`lat` kulkevat Mercator-y:n kautta ja **ero on
0,0–0,5 px kaikissa eleissä**.

Kaksi asiaa jotka menivät samalla oikein:

- **Nopeuden pohjoiskerroin luettiin `_sy`:stä.** Se oli px astetta
  kohti; nyt `_sy` on px Mercator-yksikköä kohti eikä kelpaa
  nopeudeksi. Mercatorissa mittakaava on paikallisesti sama molempiin
  suuntiin, joten `ky = −kx` — mikä oli myös vanhan koodin arvo
  likimäärin, joten liike ei muuttunut.
- **`naytteista` käyttää samaa käänteiskuvaa.** Jos vain `project`
  korjattaisiin, partikkeli piirtyisi eri paikkaan kuin mistä se
  näytteistää tuulen.

#### Zoomista riippuva ulkoasu lähtee kartan mukana

Sumennuksen säde ja spottimerkkien koko riippuvat zoomista, ja
molemmat päivitettiin vasta `zoomend`issä. Kummallakin on oma
pehmennyksensä (0,30 s ja 0,32 s), joten ne lähtivät liikkeelle vasta
kun kartta oli jo pysähtynyt. Mitattuna (animoitu zoom, 3 tasoa,
hetket zoomin alusta):

| | ennen | nyt |
|---|---|---|
| zoom lähtee liikkeelle | +96 ms | +95 ms |
| sumennus maalissa | **+722 ms** | **+95 ms** |
| merkin skaala maalissa | **+400 ms** | **+247 ms** |

Sumennus asettui siis 370 ms *sen jälkeen* kun kartta oli jo
pysähtynyt — juuri silloin kun silmä on levossa ja huomaa sen.
Merkkien skaala on nyt maalissa täsmälleen kun kartan animaatio
päättyy, ei 150 ms myöhemmin.

Molemmat saavat maaliarvonsa `zoomanim`issa, eli heti animaation
alussa, ja muuttuvat kartan liikkeen alla. **Nipistyksessä ei**:
siinä `zoomanim` syttyy joka sormenliikkeellä ja arvon kirjoittaminen
uudelleen käynnistäisi siirtymän joka kerta. Leaflet erottaa nämä
`e.noUpdate`-lipulla — nipistyksessä se on tosi.

### Play liikkuu jatkuvasti, ei tunti kerrallaan

Play eteni ajastimella: se vieritti janan pehmeästi seuraavaan tikkiin ja
vasta kun vieritys pysähtyi (~300 ms) kenttä rakennettiin kerralla. Siitä
seurasi kolme vikaa, kaksi näkyvää ja yksi mitattava.

- **Kartta laahasi janan perässä** kolmanneksen sekunnin.
- **Play ohitti käyttäjän.** Se piti omaa laskuriaan, joten janaan
  tarttuminen kesken toiston ei pysäyttänyt sitä: mitattuna janaa
  vedettiin taaksepäin ja tunti eteni silti eteenpäin.
- **Koko tunnin työ osui yhteen ruutuun.** `WindTexture.build` on 57 ms
  neljän kertaluokan kuristuksella, eli nykäys joka askeleella.

Nyt sijainti on murtoluku, jana seuraa sitä ruutu ruudulta ja kenttä
päivitetään samalla koneistolla kuin sormella raahatessa: karkea tarkkuus
ja korkeintaan yksi rakennus lennossa. Kenttä **sulaa** tunnista toiseen
eikä hyppää.

- **Kynnys on eri sormella ja play'lla.** Sormea seuratessa kentän on
  oltava siinä missä sormi (0,02 h). Play etenee itse tasaisesti eikä
  kukaan vertaa sen sijaintia mihinkään, joten siellä riittää ~10
  rakennusta tuntiaskelta kohti (0,11 h). Partikkelit liikkuvat joka
  ruudussa joka tapauksessa, joten silmä ei näe eroa — mutta mittari
  näkee: ruutunopeus 26 → 31 fps ja pahin ruutu 83 → 50 ms.
- **Käyttäjä voittaa aina.** Kosketus janaan pysäyttää toiston.
- **Taustavälilehti pysäyttää toiston** (`visibilitychange`), muuten rAF
  nukkuisi ja play hyppäisi palatessa.
- Lopetettaessa valinta vahvistetaan lähimpään tuntiin täydellä
  tarkkuudella.

**Mitattu lopputulos:** tuntiaskel 787–826 ms (tasainen), pahin ruutu
50 ms — pienempi kuin alkuperäisen askeltavan version 67 ms. Aikajanan
loksahdus osuu **0,0 px** tarkkuudella oikeaan tuntiin.

### Kolme mitattua korjausta

1. **`SpatialIndex.nearby()` sai yhden alkion muistin.** Tulos riippuu vain
   solukoordinaateista, ja lämpökartan harva hila on säännöllinen ristikko:
   solu on 0,75° kun solmuväli on 0,012°, eli ~60 peräkkäistä solmua saa
   saman vastauksen. Ilman muistia jokainen varasi oman taulukkonsa ja
   kopioi samat 57 pistettä. Mitattu: `nearby` oli 38,3 ms `idw`:n
   50,1 ms:stä. **idw 58,8 → 20,2 ms (−66 %), tekstuurirakennus 83 → 45 ms.**
   Varmistettu bittitarkaksi: 10 201 solmua, **0 poikkeamaa**.

2. **Aikaleimat esilasketaan** (`_ts(h)`). `buildWindField` jäsensi
   `new Date(...)` 12 087 kertaa joka kutsulla, vaikka aikasarja ei muutu.
   **8,7 → 0,52 ms.** Välimuisti asuu `hourly`-oliossa ja katoaa
   luonnostaan kun data korvataan.

3. **Play ei enää rakenna kenttää kolmesti askelta kohti.** `scrollTimelineTo`
   vierittää pehmeästi, ja jokainen vieritystapahtuma laukaisi
   esikatselurakennuksen — ne ovat sormen seuraamista varten, mutta
   ohjelmallisessa vierityksessä määränpää on jo tiedossa. Lisäksi
   `_tlCommitSelection` rakensi kentän aina, myös kun tunti ei vaihtunut.
   **9 sekunnin play: 29 → 10 rakennusta, työ 1042 → 494 ms.**
   Käyttäjän kosketus aikajanaan nollaa lipun heti, joten raahaus toimii
   ennallaan.

### Lopputulos

| | ennen | jälkeen |
|---|---|---|
| Lepo, ruutuväli | 66,7 ms | 50 ms |
| Zoom, fps | 13 | 17 |
| Zoom, p95 ruutu | 166,6 ms | 100 ms |
| Play, fps | 11 | 16 |
| Play, p95 ruutu | 200 ms | 116,7 ms |

### Hypoteesit jotka mittaus kaatoi

Nämä näyttivät ilmeisiltä pullonkauloilta eivätkä olleet. Ei muutettu:

- **`canvas.toDataURL()`** joka lämpökartan päivityksessä: 5–7 ms. Epäilin
  synkronista PNG-pakkausta pääsyyksi; se on kohinaa.
- **Partikkeliviivat yksittäisinä `stroke()`-kutsuina**: 175 viivaa 0,5 ms.
  Niputus yhteen polkuun per väri säästäisi 0,07 ms.
- **`ColorRamp.css()`-merkkijonot** joka partikkelille joka ruudussa:
  0,04 ms.
- **Väriramppi tekstuurin täytössä**: 0,4 ms 24 ms:stä. LUT-taulukko ei
  kannata.
- **Häivytyksen `destination-in fillRect`** koko canvasin yli: 0,02 ms.
- **Canvasin rauhoittaminen eleen aikana**: ei mitattavaa hyötyä
  panoroinnissa eikä zoomauksessa.

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

## Partikkelit ovat tasaisia — maa/vesi-rajaus kokeiltiin ja poistettiin

Partikkelit arvotaan tasaisesti koko ruudulle. **Älä lisää maa/vesi-rajausta
uudelleen ilman että se on erikseen pyydetty** — se on jo kokeiltu ja
poistettu käyttäjän pyynnöstä, koska maan ja veden ero näkyi kartalla
häiritsevänä.

Mitä kokeiltiin: karkea maa/vesi-ruudukko luettuna pohjakartan pikseleistä
(näyte 8 ruudun välein, kynnys 56 — Esrin laatassa vesi on noin 35 ja maa
77), `respawn` arpoi uudelleen jos osuma tuli maalle, ja partikkelimäärä
skaalattiin veden osuudella jotta tiheys vedellä pysyi mitatussa
optimissaan.

Se toimi teknisesti: mitattuna saaristossa maata oli 30,5 % ruudusta ja
partikkelimusteesta maan päällä 11,1 % — tasaisella arvonnalla 30,5 %.
Ongelma oli esteettinen, ei tekninen: **kahden alueen ero luki kartalta
selvästi**, ja tuuli maan yllä on kuitenkin oikeaa dataa.

Poiston jälkeen mitattuna: maata 30,4 % ruudusta ja musteesta maalla 29,7 %,
eli jakauma on tasainen kuten pitääkin.

Kaksi asiaa jotka kannattaa tietää jos tähän joskus palataan:

- **Laattakerros tarvitsi `crossOrigin: true`**, muuten canvas saastuu ja
  `getImageData` heittää. ArcGIS palauttaa `Access-Control-Allow-Origin: *`.
  Asetus poistettiin maskin mukana, koska sillä ei ollut muuta käyttöä.
- **Maskin poistossa meni sormi suuhun tavalla joka on syytä muistaa.**
  Moduuli poistettiin skriptillä joka etsi lohkon lopuksi ensimmäisen
  `};`-esiintymän — ja se osui moduulin SISÄLLÄ olevaan riviin
  `const tiles = tileLayer._tiles || {};`. Loppuosa jäi irrallisiksi
  lauseiksi, ja sivu kaatui virheeseen "Illegal return statement".
  **`npm run build` meni läpi virheettä**, koska Vite ei jäsennä
  index.html:n inline-skriptiä. Vain selain huomasi. Kun tästä tiedostosta
  poistetaan lohkoja, tee se rivipohjaisesti (etsi rivi joka on tasan `};`)
  ja **lataa sivu selaimessa** — buildin läpimeno ei ole todiste mistään.


## Lämpökartta on canvas, ei PNG

Tekstuuri on `KanvasYlitys` — `L.ImageOverlay`, jonka `_initImage` on
kirjoitettu uudelleen niin että elementti **on** `WindTexture.canvas`.

Ennen kierros oli canvas → `toDataURL()` → `<img src>`. Se maksoi mitattuna
1,84 ms per päivitys 300×300 tekstuurilla (vertailuksi `putImageData`
samalle canvasille 0,04 ms) ja tuotti 32 kt base64-merkkiä jotka selain
purki takaisin pikseleiksi.

**Kustannus ei ollut varsinainen syy.** 1,84 ms osuu vain kentän
uudelleenrakennukseen, ei joka ruutuun. Ratkaiseva on että `setUrl` on
**asynkroninen** ja `setBounds` ei: `img.src` alkaa latautua, mutta
elementin koko ja paikka vaihtuvat heti. Niiden välissä ruudulla on
edellinen tekstuuri venytettynä uusiin rajoihin — väärää dataa väärässä
paikassa. Canvas on DOMissa sellaisenaan, joten piirto ja sijoittelu
tapahtuvat samassa hetkessä.

- **`L.ImageOverlay` osaa jo ottaa valmiin elementin, mutta tunnistaa vain
  IMG:n** (`this._url.tagName === 'IMG'`). Siksi `_initImage` on korvattu.
  Muu sijoittelu, zoom-animaatio ja opacity tulevat kantaluokalta
  sellaisenaan, koska ne koskevat vain style-attribuutteja.
- **`setUrl` on ylikirjoitettu no-opiksi**, jottei kutsuja luulisi voivansa
  vaihtaa tekstuuria osoitteella.
- Mitattu jälkeenpäin: elementti on CANVAS ilman `src`-attribuuttia,
  `leaflet-tile-pane`ssa, sekoitustila `plus-lighter`, suodin tallella;
  sisältö muuttuu sekä siirrossa että zoomissa; **kohdistusero omiin
  rajoihinsa 0 px kaikilla neljällä reunalla.**
- **Tekstuurin koko 300×300 on tarkistettu** eikä sitä muuteta: se näkyy
  1232×2533 laitepikselinä, eli texel on 4,1 px ja sumennus 6–8 px peittää
  ruudukon.
- Poistettiin samalla kaksi kuollutta kohtaa: CSS-sääntö
  `.heatmap-overlay img` ja sitä vastaava `querySelectorAll`. Leaflet
  asettaa `className` suoraan kerroksen omaan elementtiin, joten sisäkkäistä
  kuvaa ei ole koskaan ollut.

## Väriasteikko — vain asetuspaneelissa

Asteikko on `#wind-scale` asetuspaneelissa, eikä kartalla ole selitettä.

**Kartalla asteikko oli hetken aikaa ja se poistettiin tarkoituksella.**
Perustelu sen lisäämiselle oli, että lämpökartan sävyt eivät tarkoita mitään
sille joka ei ole avannut asetuksia. Vastaperustelu voitti: tuulivärit ovat
sovelluksen ydinkielioppi ja käyttäjä oppii ne parissa käyttökerralla, joten
pysyvä selite maksaa ruutualaa **jokaisella** katselulla mutta hyödyttää vain
ensimmäisillä. Asetuspaneeli on oikea paikka — siellä se on kun sitä
haetaan. Jos asteikko joskus palaa kartalle, se kuuluu olla jotain mikä
katoaa itsestään eikä pysyvä siru.

Kaksi vikaa jotka löytyivät kartta­version yhteydessä ja jotka on korjattu
myös paneeliversioon:

- **Gradientin pysäkit oli ladottu tasavälein** arvoista 0, 2, 3.5, 5, 6, 7,
  9, 12, jolloin 0–2 m/s sai saman leveyden kuin 9–12 m/s. Pysäkit annetaan
  nyt **prosentteina**, koska palkin x-akseli on lineaarinen nopeudessa
  mutta `msToT` ei ole.
- **Lukemat oli aseteltu `space-between`illä** eri levyisinä teksteinä,
  joten mitattuna "10" oli 13 px ja suurin lukema 26 px väärässä kohdassa.
  Lukemat ovat nyt absoluuttisesti prosenttikohdissaan; päätylukemat
  ankkuroidaan reunoihinsa (`ws-alku` / `ws-loppu`) jottei ne valu ulos.
  Mitattuna 285 px palkissa keskikohdat osuvat ideaaliin (0/71.3/142.6/213.9).

**Yksikkö on otsikossa**, ei lukemarivillä: viimeiseen lukemaan liitettynä se
työnsi lukeman irti palkin reunasta. Ilman sitä asteikolla olisi numeroita
joiden yksikköä ei kerrota missään, koska lukemat seuraavat
yksikkövalintaa — ja kartalta selite on poistettu.

Lukemariviltä poistettiin `inline display:flex`, joka olisi kumonnut
asettelun: **inline voittaa tyylisäännön.**

## Verkkotila

`Verkkotila` näyttää sirun kun dataa ei saada. Ennen virheet katosivat
`Promise.allSettled`in sisään ja ruudulle jäi edellinen ennuste ilman
merkkiä siitä että se on vanha — käyttäjä ei voinut erottaa "tuuli ei ole
muuttunut" ja "dataa ei tullut" toisistaan. Sääsovelluksessa se on paha,
koska juuri myrskyn alla verkko on epävarmin.

Kaksi tilaa, koska syy ja korjaus ovat eri:

- **offline** — selain kertoo ettei yhteyttä ole. Uudelleenyritystä ei
  tarjota; `online`-tapahtuma hakee datan itse.
- **virhe** — yhteys on mutta ennustetta ei saatu. Yrittäminen voi auttaa.

Asiat jotka eivät ole ilmeisiä:

- **`loadViewport` kertoo tuloksen itse**, ei kutsujat. Latausta
  käynnistetään neljästä paikasta: kolme käynnistyksessä ja yksi näkymän
  muutoksessa. Kutsujiin sijoitettuna käynnistyksen epäonnistuminen olisi
  jäänyt näkymättä — juuri se tapaus jossa ruudulla ei ole yhtään dataa.
  Tämä myös löytyi testissä: ensimmäinen versio ilmoitti vain näkymän
  muutoksesta eikä siru ilmestynyt lainkaan, vaikka 171 pyyntöä oli
  palauttanut 503.
- **Paluuarvo `null` tarkoittaa "vanhentunut lataus"**, ei virhettä.
  `pyydetty === 0` tarkoittaa että kaikki oli välimuistissa, eli näkymälle
  on dataa ja virhetila kuuluu poistaa.
- **Toast ei sopinut tähän**, koska se katoaa itsestään; tila on voimassa
  kunnes se korjautuu.
- **Koko siru on kosketuskohde**, ei nappi sen sisällä — ks. seuraava luku.

## Kosketuskohteet ja pseudoelementtien osumapinta

Kaksi kohtaa, joissa 44 px:n kosketusminimi oli näennäisesti kunnossa mutta
ei ollut. Molemmat löytyivät vain napauttamalla, eivät katsomalla.

**Pseudoelementti ei kasvata osumapintaa.** Play-nappi oli 32 px ja lisäala
haettiin `::after { inset: -6px }` -kehällä, ja kommentti väitti että
"Applen kosketusminimi täyttyy". Mitattuna napautus 20 px keskeltä ei
käynnistänyt toistoa — vaikka `elementFromPoint` palautti napin samassa
pisteessä. `elementFromPoint` ei siis kerro mihin napautus menee.

**Chromiumin kosketussäätö siirtää napautuksen lähimpään maalattuun
kohteeseen.** Pelkkä elementin kasvatus 44 px:ään ei riittänyt: tapahtumat
jäljitettynä `pointerdown` ja `touchstart` osuivat oikein nappiin, mutta
synteettinen **`click` meni sisarelle `#tl-scroll`** — napin läpinäkyvä kehä
hävisi vieressä olevalle vierittimelle. Siksi ympyrä täyttää nyt laatikosta
40 px ja läpinäkyvää kehää jää 2 px, jolla ei ole enää mihin siirtyä.
Mitattu jälkeen: napautus osuu 0, 14 ja 19 px keskeltä.

**Sama sääntö verkkotilan sirussa.** Nappi yksin oli 97×22 px, ja sen
kasvatus 44 px:ään olisi tehnyt sirusta noin 60 px korkean palkin. Siksi
kohde on koko siru (252×44) ja nappi on näkyvä vihje, joka on yhä
`<button>` näppäimistölle ja ruudunlukijalle — `pointer-events: none`,
jotta napautus menee sirulle.

Jos lisäät kosketuskohteen, **napauta sitä testissä.** Koon lukeminen
`getBoundingClientRect`ista tai `elementFromPoint`ista ei kerro totuutta.

## Zoom-alue

`maxZoom` on 16 = pohjakartan `maxNativeZoom`. Aiemmin 13, mikä on kaupungin
mittakaava: yksittäistä lahtea tai rantautumispaikkaa ei nähnyt, vaikka
teräviä laattoja on z16 asti. Yli 16 Leaflet venyttäisi laatan.

**Ennuste ei tarkennu zoomatessa** — HARMONIE-hila on noin 2,5 km ja
`ViewportGrid.gridStep` pysyy 0,25 asteessa z10:stä ylös — joten z14–16
näyttää kentän lähes tasaisena. Se on rehellistä: hienompaa tietoa ei ole,
ja siellä katsotaan rantaviivaa ja spottia eikä kentän rakennetta.

Tarkistettu ettei kenttä tyhjene korkealla zoomilla: `buildWindField` lukee
`getAllPoints()`, joka on kumulatiivinen, ja `getViewportPoints` täyttää
`step*2` marginaalilla. Mitattu z16:ssa: 32 laattaa, lämpökartta paikallaan,
partikkelit toimivat, ei virheitä.

## Ensilataus — mihin aika menee

Mitattu Chromiumilla, 4× CPU-jarru, verkko emuloituna:

| profiili | FCP | kartta käytettävissä |
|---|---|---|
| rajaton | 632 ms | ~5,8 s |
| fast-3G (1,6 Mbit, 150 ms) | ~690 ms | ~5,8 s |
| slow-3G (400 kbit, 400 ms) | 2 256 ms | ~13 s |

**Bundle ei ole pullonkaula.** 217 kt siirrettynä (577 kt purettuna) ja FCP
alle 700 ms fast-3G:llä. Aika menee **ennuste-API:n odottamiseen**:
mitattuna 62 pyyntöä, mediaani 2 451 ms, p90 3 214 ms, ja API-ikkuna
(ensimmäinen pyyntö → viimeinen valmis) kattoi **74 % latausajasta**.

Kolme ajoa samalla profiililla: 5 736 / 6 036 / 5 761 ms, eli hajonta
300 ms — luvut ovat vakaita, yksittäinen 9,8 s poikkeama oli
mittausympäristön proxyn hetkellinen hidastus eikä regressio.

Tehtiin: `preconnect` osoitteisiin `api.open-meteo.com` ja
`services.arcgisonline.com`, ja poistettiin kaksi kuollutta
fonttipyyntöä. **Preconnectin hyötyä ei voitu tässä ympäristössä mitata**,
koska API-viive proxyn läpi on suuruusluokkaa isompi kuin säästetty
DNS+TLS-kierros. Se on silti oikea vihje eikä maksa mitään.

Jäljellä olevat, isommat: **ensimmäinen API-pyyntö lähtee vasta 1 125 ms
kohdalla** (siihen asti jäsennetään HTML, ladataan Leaflet ja alustetaan
sovellus), ja pyyntöjen määrä on suuri ennen ensimmäistä käyttökelpoista
näkymää. Molemmat ovat käynnistysjärjestyksen muutoksia eivätkä säätöjä.

## Käynnistys: välimuisti ruudulle ennen verkkoa

Kartta oli mitattuna käytettävissä vasta **4 974 ms** kohdalla, vaikka
ensimmäinen maalaus tapahtui jo 0,7 s kohdalla. Latausruutu odotti
`loadSpots`ia eli verkkoa, vaikka edellinen ennuste oli levyllä.
`_naytaValimuististaHeti()` piirtää tallennetun ennusteen ennen verkkokutsuja
ja kutsuu `hideLoading`in itse. Mitattuna **4 974 → 2 013 ms**.

Asiat jotka eivät ole ilmeisiä:

- **Spotit tallennetaan nyt erikseen** (`fs_spots_<malli>`, noin 29 kt).
  Hilapisteet olivat jo levyllä (`fg_`-avaimet), mutta juuri spotit
  portittavat käynnistyksen: aikajana, spottimerkit ja ensimmäinen kenttä
  rakennetaan `bestTimelineRef`in kautta spottidatasta.
- **Palautettu spotti merkitään `_vanha`ksi.** `loadSpots` ohitti aiemmin
  kaikki spotit joilla oli `wx`, joten välimuistin näyttäminen olisi
  estänyt tuoreen haun kokonaan ja sovellus olisi jäänyt ikuisesti vanhaan
  ennusteeseen. Merkki poistetaan vasta haun jälkeen.
- **Käyttökelpoisuuden ehto on että sarja YLTÄÄ NYKYHETKEEN, ei ikä.**
  Kaksi tuntia vanha ennuste on käyttökelpoinen; eilinen sarja joka loppuu
  ennen tätä hetkeä ei ole, koska `nowIdx` osoittaisi sarjan ulkopuolelle.
- **Vanhuus on kerrottava.** `Verkkotila` sai tilan `vanha`
  ("Ennuste 2 h vanha · päivitetään"), joka poistuu vasta kun tuore data on
  haettu. Vanhan ennusteen näyttäminen tuoreena olisi pahempi vika kuin
  hidas lataus.
- **Käyttäjän aikajanavalintaa ei saa nollata.** Kun kartta on käytettävissä
  jo 2 s kohdalla, käyttäjä ehtii siirtää aikajanaa ennen kuin tuore data
  saapuu — ja `spotsP.then` asetti aina `currentHourIdx = nowIdx(...)`.
  Ennen tätä muutosta nollaus oli näkymätön, koska kartta ei ollut vielä
  käytettävissä. Nyt valinta tunnistetaan vertaamalla
  `State._vanhaAsetettuIdx`:ään ja säilytetään.

**Mitattu ettei varhainen näkymä johda harhaan:** samalla tunnilla
välimuistista piirretty lämpökartta eroaa tuoreesta keskimäärin
**0,8 luminanssia**, ja yli viiden luminanssin eroja on 2,1 % pikseleistä.
Kuva on siis käytännössä sama.

Jäljelle jää 2,0 s, josta FCP on 0,7 s. Loppu on kartan ja Leafletin
alustusta; sen lyhentäminen on eri työ kuin tämä.

Mittausvirhe joka kannattaa välttää: älä aja kahta käynnistystä peräkkäin
samaa API:a vasten ja tulkitse jälkimmäisen virhetilaa. Ensimmäinen ajo
kuormittaa Open-Meteoa niin että toinen saa virheitä, ja siru näyttää
"Ennustetta ei saatu" ilman että koodissa on vikaa — puhtaassa
kontekstissa kaikki 169 vastausta olivat 200.

## Mallien erimielisyys — tulkinta, ei uutta dataa

Spottikortin ennustekaavio hakee **jo** kolme vertailumallia (ECMWF, ICON,
GFS) yhdellä pyynnöllä ja piirtää ne katkoviivoiksi. Se mitä siitä puuttui
oli tulkinta: kolmen päällekkäisen viivan silmäily ei vastaa siihen
kysymykseen jota varten ne ovat — *voiko tähän lukemaan luottaa*.

`mallienHajonta()` laskee suurimman eron mallien välillä valittuna hetkenä
ja `hajontaTeksti()` kääntää sen lauseeksi. Rivi näkyy kahdessa paikassa:
kaaviossa legendan alla ja spottikortin herossa indeksin vieressä, koska
päätös tehdään siellä eikä kaaviota selatessa.

- **Ei yhtään uutta verkkopyyntöä.** Sama data joka juuri piirrettiin
  viivoiksi. Tämä oli myös syy olla toteuttamatta alkuperäistä ehdotusta
  sellaisenaan ("hae toinen malli") — se olisi ollut päällekkäinen haku.
- **Kynnykset ovat wingfoilauksen mittakaavasta**, eivät tilastollisia:
  alle 1,5 m/s ero ei muuta kalustovalintaa eikä päätöstä; yli 4 m/s voi
  tarkoittaa eroa "ei lähde vesille" ja "liian kova"; väli on se jossa
  kannattaa katsoa uudestaan lähempänä.
- **Hero-rivi on tyhjä kunnes data saapuu**, jotta kortti ei hyppää: rivi
  ei varaa tilaa ennen kuin sillä on sisältöä.
- Aikaikkuna on ±1,5 h valitusta hetkestä; sitä kauempaa ei kelpuuteta,
  koska mallien tuntiruudukot voivat olla eri vaiheessa.

Testattu syöttämällä vertailuvastaus proxyn ohi kolmella erolla (0,5 / 2,5
/ 6 m/s) — kaikki kolme kynnystä tuottavat oikean lauseen sekä herossa että
kaaviossa, ja 75 mallipolkua piirtyy.

**Ympäristöhuomio:** headless-selaimessa vertailupyyntö kaatuu usein
`net::ERR_CONNECTION_RESET`-virheeseen, vaikka sama osoite toimii curlilla
ja palauttaa oikeat avaimet. Sovellus tekee käynnistyksessä ~169
API-pyyntöä, ja tämä yksittäinen pyyntö lähtee niiden perään. Älä tulkitse
tyhjää vertailukaaviota sovelluksen viaksi ennen kuin olet syöttänyt
vastauksen testissä.

## Käynnistyksen pyyntömäärä

Mitattuna käynnistys teki **169 API-pyyntöä**. Luokiteltuna 145 niistä meni
`/api/harmonie`-funktioon eli 86 % kaikesta. Syy: `buildHarmonieUrls`
palautti **yhden osoitteen per piste**, ja koska oletusmalli `best_match`
kokeilee HARMONIEa ensin, koko näkymähila haettiin pisteittäin.

Korjaus on erähaku: `/api/harmonie` ottaa vastaan `pts=lat,lng;lat,lng`
-luettelon ja hakee pisteet rinnakkain **palvelinpäässä**, missä viive on
murto-osa mobiiliverkon kierrosajasta. Mitattu **169 → 36 pyyntöä**,
HARMONIE 145 → 12, ja kylmä käynnistys 4 479 → 2 470 ms.

- **Eräkoko on 15** sekä asiakkaassa (`HARMONIE_ERA`) että palvelimella
  (`MAX_PISTEITA`). Yksi piste on noin 16 kt, joten erä on noin 240 kt.
  Isompi erä ei juuri vähentäisi kierroksia mutta kasvattaisi funktion
  30 s aikakatkaisun riskiä.
- **Palvelimen rinnakkaisuus on rajattu kuuteen** (`poolMap`). FMI:n WFS ei
  pidä sadasta yhtaikaisesta pyynnöstä, ja raja pitää myös funktion keston
  kurissa.
- **Yhden pisteen muoto säilyi tavulleen ennallaan** (16 145 tavua ennen ja
  jälkeen). Spottikortti ja havaintopolku käyttävät sitä, joten sitä ei
  saa rikkoa.
- **Yhden pisteen virhe ei kaada erää** vaan näkyy omana alkionaan
  `results`-taulukossa.
- Sudenkuoppa jonka jo kerran astuin: `haePiste` muotoilee koordinaatit
  itse, joten sille annetaan **numerot**. Valmiiksi `toFixed`-käsitellyn
  merkkijonon antaminen kaatoi sen `lat.toFixed is not a function`
  -virheeseen — ja koska erähaku nappaa pistekohtaiset virheet, se näkyi
  vain tuloksen sisällä eikä statuskoodissa.

**Jäljellä:** `/api/fmi` on nyt suurin yksittäinen erä (22 pyyntöä).
Ne lähtevät rinnakkain 13 ms:n ikkunassa ja valmistuvat aikaisin, joten ne
eivät portita käyttövalmiutta — siksi ne jätettiin. Sama erähakukuvio
kävisi niihin jos pyyntömäärää halutaan pienentää lisää.

## Suosikit ja jaettava linkki

**Suosikit** (`Suosikit`, localStorage `fs_suosikit`) vaikuttavat kolmeen
asiaan: kartta avautuu niiden kohdalle oletusnäkymän sijaan, suosikki
piirtyy **aina täytenä merkkinä**, ja kortissa on tähti jolla sen vaihtaa.

- **Merkin etusija on se joka oikeasti merkitsee.** Merkit kilpailevat
  tilasta (`_valitseTaydetSpotit`), ja Helsingin edustalla spotit ovat
  lähekkäin — ilman etusijaa oma kotispotti katoaa pisteeksi juuri siksi
  että naapurilla sattuu olemaan parempi lukema.
- **Tallennus on nimilistana, ei indekseinä.** `SPOTS`-taulukon järjestys
  voi muuttua, ja indeksi osoittaisi silloin väärään spottiin.
- Yksi suosikki → `setView` zoomilla 10, useampi → `fitBounds`
  `maxZoom: 11`. Sitä lähempää yksi spotti täyttää ruudun eikä kentästä näy
  mitään.

**Jaettava linkki** (`Linkkitila`) kirjoittaa katsotun spotin ja hetken
osoitteen hash-osaan, ja jakonappi kopioi osoitteen leikepöydälle.

- **Aika on ISO-leima, ei tuntinumero.** Tuntinumero on indeksi
  ennustesarjaan, ja sarja alkaa eri kohdasta joka latauksella —
  vastaanottajalla se osoittaisi eri hetkeen. Mitattu päästä päähän:
  lähetetty `2026-08-20T01:00` (idx 40) avautui vastaanottajalla samaan
  aikaan, vaikka indeksi ratkaistiin uudelleen.
- **Hash eikä query**, koska se ei aiheuta uudelleenlatausta eikä vaadi
  palvelimelta mitään.
- **Linkki voittaa suosikit, suosikit voittavat oletusnäkymän.** Jos joku
  lähetti linkin, hän tarkoitti juuri sitä spottia.
- `indeksiAjalle` hyväksyy enintään 2 h poikkeaman; kauempaa ei kelpuuteta,
  koska silloin linkki osoittaisi eri kelin kuin lähettäjä näki.
- Leikepöytä vaatii suojatun yhteyden eikä ole kaikkialla — jos kopiointi
  ei onnistu, osoite näytetään toastissa jotta sen voi ottaa käsin.

## Puvun paksuus

`pukuSuositus(vesiC, ilmaC, ms)` kääntää kolme lukua yhdeksi päätökseksi.
Kortti näytti vedenlämmön, ilman ja tuulen mutta ei sitä mitä niistä
seuraa; suositus on veden lämpötilakortin vieressä, koska siinä kohtaa
vedenlämpöä katsotaan.

- **Vesi on hallitseva mutta ei yksin riitä.** Kylmä ilma ja kova tuuli
  jäähdyttävät märkäpuvun pinnasta koko session ajan, ja juuri se erottaa
  mukavan ja palelevan kelin samalla vedenlämmöllä. Korjaus on neljäsosa
  vesi/ilma-erosta plus enintään kaksi astetta tuulesta.
- **Korjaus on tarkoituksella maltillinen.** Tämä on lähtökohta
  pukukaapilla, ei mittaustulos.
- **Kylmin luokka on kuivapuku.** Alle 8 °C tehollisessa märkäpuvun
  paksuuden hienosäätö ei ole enää oikea kysymys.
- **Ilman vedenlämpöä ei anneta suositusta** — kortti jää silloin kokonaan
  pois. Tämä on tavallista: kehitysympäristössä `loadMarineTemp` ei saa
  dataa lainkaan, ja 0/12 spottia oli ilman vedenlämpöä.

Mitattu kaavan rajat (vesi/ilma/tuuli → puku): 22/22/6 shortsit,
18/18/6 2 mm, 15/15/6 3/2, 12/12/6 4/3, 9/9/6 5/4, 5/5/6 kuivapuku;
15/5/16 pudottaa tehollisen 11,3:een eli 4/3:een.

Testikuoppa jonka jo kerran astuin: `.sh-stat-label` on CSS:llä
`text-transform: uppercase`, joten `innerText` palauttaa "PUKU" eikä
"Puku". Testin `/^Puku/` ei osunut, ja näytti siltä ettei kortti
renderöidy vaikka se oli DOM:issa.

## Ennusteen osuvuus havaintoja vasten

`Osuvuus` (localStorage `fs_osuvuus`) tallentaa ennuste–havainto-pareja ja
kertoo onko ennuste **tällä spotilla** systemaattisesti pielessä. Rannikolla
se on tavallista: maasto ja suojaisuus tekevät paikallisen poikkeaman jota
2,5 km hila ei tavoita. Sovellus näytti ennusteen ja havainnon vierekkäin
mutta heitti vertailun pois kortin sulkeutuessa.

- **Vertailu tehdään NYKYHETKEN tuntiin, ei valittuun.** Valitun tunnin
  ennusteelle ei ole havaintoa.
- **Tunti yksilöi näytteen**, joten sama tunti kirjataan kerran vaikka
  kortti avattaisiin monta kertaa.
- **Epäuskottava havainto hylätään** (alle 0 tai yli 45 m/s).
- **Alle viidellä näytteellä ei sanota mitään**, ja alle 0,5 m/s poikkeama
  esitetään osumana eikä virheenä — se ei muuta kalustovalintaa.
- Katto on 60 näytettä per spotti ja 30 vrk ikä.
- Tallennus on paikallinen: se on tämän laitteen kokemus tästä spotista,
  eikä sitä jaeta mihinkään.

**Kirjaus on kahdessa kohdassa**, koska havainto saapuu kahta reittiä:
tuoreena hakuna ja välimuistista (`CURRENT_TTL` 10 min). Välimuistihaarassa
uutta paria ei synny, mutta rivi pitää silti piirtää.

Sudenkuoppa joka maksoi kierroksen: kirjoitin kirjauksen ensin
`renderFmi`-funktioon, joka näytti oikealta paikalta — mutta sitä ympäröivä
`buildFmiCard` **on määritelty eikä sitä kutsuta koskaan**. Koko ominaisuus
olisi ollut hiljaa kuollut. Kun tähän tiedostoon lisää kytkennän, tarkista
`grep -c` että ympäröivää funktiota oikeasti kutsutaan.

Mitattu: alle minimin ei tekstiä; +2 → "liian kova"; −3 → "liian heikko";
0,2 → "osunut hyvin"; duplikaatti torjutaan; 99 m/s hylätään; 80 kirjausta
→ 60 talletettua. Kortissa rivi renderöityy oikeassa polussa.

## Spottikortin auditointi ja korjaukset

Kortti auditoitiin kokonaan: rakenne koodista, mitattu DOM ja silmämääräinen
tarkastus koko pituudelta. Löydökset ja korjaukset ovat commit-historiassa;
tässä ne joista jää pysyvä sääntö.

**Havaintoasema ratkaistaan yhdessä paikassa.** Kortti näytti aiemmin kaksi
eri asemaa yhtä aikaa (tilastossa lähin, kaaviossa lähin jolla on dataa),
eri lukemin ja ilman selitystä. `_fmiLoadWithFallback` on nyt ainoa
auktoriteetti, koska se on ainoa joka tietää mistä dataa oikeasti saa.
**Jos lisäät korttiin havaintoperäisen kentän, lue se samasta ratkaisusta.**

**`HAVAINTO_MAX_KM = 30`.** Asemalista kattaa pääkaupunkiseudun; Hangon
spoteille lähin on 107–112 km eli eri sääjärjestelmä. Sen yli havaintoa ei
esitetä lainkaan vaan kerrotaan puuttuminen. Tyhjä on rehellisempi kuin
väärä — ja tämä on sama sääntö kuin puvulla ja osuvuudella.

**Sessioikkunan rajat 6 ja 18 m/s tulevat `foilBadge`sta**, eivät erillisestä
vakiosta. Sama määritelmä kahdessa paikassa olisi kahden totuuden alku: jos
kynnyksiä muuttaa, muuta `foilBadge`a ja ikkuna seuraa.

**Tilastokortteja on neljä, ei viisi.** Ruudukko on `repeat(4, 1fr)`, joten
viides jättäisi orvon rivin ja kolme tyhjää solua. Tuuli ja puuska ovat
yhdessä kortissa koska ne ovat sama mittaus samalta asemalta.

Mitattu kortti ennen → jälkeen: **1 148 px → 1 086 px**, aurinkokaari
122 → 83 px, tilastorivit 2 → 1, iso lukema 52 → 38 px ja indeksirengas
48 → 64 px.


## Play ja kapseli — mikä päivittyy mistä

Kapselin tuuli, suunta ja puuska ovat `Crosshair`in, lämpötila
`WeatherWidget`in. Molemmat päivittyvät normaalisti `buildWindField`in
lopusta — mutta **vain kun kutsussa ei ole `scrub`-lippua**:

```js
if (!(opts && opts.scrub)) { Crosshair.refresh(); WeatherWidget.refresh(); }
```

Scrub jättää ne tarkoituksella väliin, jotta sormea seuratessa ei tehdä
turhaa työtä joka ruudussa; vahvistushetki (`_tlCommitSelection`) hoitaa ne.

**Play kulkee aina scrub-polkua eikä sillä ole vahvistushetkeä**, joten
ilman erillistä kutsua kapseli jäätyi koko toiston ajaksi. Mitattuna: play
eteni kahdeksan tuntia, aikakupla ja kartta seurasivat, mutta kapselin
kaikki neljä lukemaa pysyivät ennallaan. Nyt `_playSijainti` kutsuu
molemmat kerran tuntiaskelta kohti — ei joka ruudussa, koska ne lukevat
valmista tekstuuria eivätkä hae verkosta mutta turhaa työtä ei silti tehdä.

**Jos lisäät kapseliin tai tähtäimeen jotain, tarkista molemmat polut:**
`buildWindField`in ei-scrub-haara *ja* `_playSijainti`. Pelkkä ensimmäinen
näyttää toimivan kaikessa käsin tehdyssä testauksessa.

### Puku ja vesi samasta lähteestä

`_paivitaPuku` sitoo pukusuosituksen siihen lämpötilaan joka VESI-korttiin
kirjoitetaan. **Alkurenderöinti ei saa arvata sitä muualta:** UiRas-spoteilla
`vesiNum` jätetään nulliksi, koska VESI tulee niillä UiRas-asemalta joka
vastaa vasta myöhemmin. Jos puku laskettaisiin siinä välissä marine-API:n
`_waterTemp`-arvosta, kortti näyttäisi yhtä aikaa "VESI —" ja "PUKU 3/2 mm"
— ja pysyvästi, jos UiRas ei vastaa. Mitattuna juuri niin kävi.

## Nipistyszoomin pehmennys

Leafletin `TouchZoom._onTouchMove` laskee skaalan ja keskipisteen **suoraan
sormien sijainneista joka touchmove-tapahtumassa, ilman minkäänlaista
suodatusta**. Sormen vapina menee siis sellaisenaan muunnokseen. Tämä ei ole
Leafletin bugi vaan puuttuva ominaisuus: Apple Maps, Google Maps ja Mapbox
kaikki suodattavat eleen ennen kuin se päätyy kameraan.

**Miksi se näkyy juuri reunoilla.** Skaalavirhe `ds` siirtää pistettä joka on
etäisyydellä `r` ankkurista määrän `r*ds`. Ankkurin kohdalla `r = 0` eikä
mitään näy, mutta 390×844 ruudun nurkassa `r` on noin 460 px. Sama virhe on
keskellä näkymätön ja reunalla iso — juuri siksi ilmiö näyttää
"reunojen värinältä" eikä zoomin epävakaudelta.

**Kolme eri tapausta, ei yksi.** Pito (sormet paikallaan lasilla), hidas
tahallinen liike ja nopea ele vaativat kukin oman mittarinsa, ja korjaus
joka ratkaisee yhden ei ratkaise muita. Tämä meni pieleen kahdesti ennen
kuin vaikein tapaus tuli mitatuksi oikein.

**Vaikein on hidas tahallinen liike**: toinen sormi paikallaan, toista
siirretään niin varovasti kuin pystyy. Kaksi syytä:

- **Hidas sormenliike ei ole tasaista.** Se etenee 2–4 px nykäyksin ja
  pysähdyksin — hidas lihaskontrolli on luonnostaan katkonaista. Juuri
  pysähdyksillä käyttäjä odottaa kartan olevan paikallaan.
- **Ele on epäsymmetrinen.** Sormet saavat eri katkotaajuuden, koska One
  Euro adaptoituu kunkin signaalin omaan nopeuteen. Zoom lasketaan niiden
  **erotuksesta**, joten eri viiveet jättävät eroon keinotekoisen
  komponentin joka elää nopeuden mukana.

### One Euro -suodin

Korjaus on One Euro (Casiez, Roussel & Vogel, CHI 2012):
`cutoff = minCutoff + beta*|nopeus|`. Se on tähän oikea työkalu koska se on
**adaptiivinen** — hitaassa liikkeessä suodattaa voimakkaasti (vapina katoaa),
nopeassa löysää otettaan (ele ei jää jälkeen). Kiinteä alipäästö ei kelpaisi:
se joko jättäisi vapinan tai lisäisi viivettä tarkoitukselliseen eleeseen.

**Suodatetaan sormien sijainnit, ei zoomia.** Silloin Leafletin oma
matematiikka pysyy koskemattomana ja etäisyys sekä keskipiste pysyvät
keskenään johdonmukaisina. Zoomin suodattaminen jälkikäteen siirtäisi
ankkuria, koska keskipiste on laskettu eri zoomille — kartta luisuisi sormien
alta. Toteutus (`nipistysPehmennys()` ennen `initMap`ia) korvaa
`map.mouseEventToContainerPoint`in eleen ajaksi ja palauttaa sen `finally`ssä.

Yksityiskohtia jotka eivät ole ilmeisiä:

- **Sormet tunnistetaan `identifier`illa, ei järjestysnumerolla.** Jos sormi
  nousee ja toinen laskee, indeksi osoittaisi eri sormeen ja suodin hyppäisi.
- **Suotimia ei nollata kesken eleen.** Kolmas sormi laukaisee touchstartin,
  joten nollaus on ehdollinen: `if (!this._zooming)`.
- **Näytteenottotaajuutta ei oleteta.** `alpha` lasketaan mitatusta `dt`:stä,
  joten 120 Hz ProMotion suodattaa saman verran kuin 60 Hz.
- **Panorointia ei suodateta.** Se siirtää koko karttaa yhtä paljon
  kaikkialla, joten `r`-vahvistusta ei ole eikä vapina erotu; suodatus vain
  hidastaisi vasteen.

### Kaksi korjausta: dCutoff ja aste

**1. `dCutoff` 1,0 → 0,3.** Nopeusestimaatti alipäästetään paljon tiukemmin.
Ennen **vapina itse ajoi sitä**: mitattuna PAIKALLAAN olevan sormen
katkotaajuus oli 1,79 Hz vaikka `minCutoff` on 1,0. Suodin avasi itsensä
juuri sillä signaalilla jota sen piti vaimentaa. 1,5 px vapina 7,3 Hz:ssä on
69 px/s huippunopeutta, ja `dCutoff 1,0` päästää siitä läpi noin seitsemäsosan
— kerrottuna betalla se on enemmän kuin koko `minCutoff`.

Tämä on One Euron oma ansa: `beta` viritetään yleensä nopealle eleelle, mutta
`dCutoff` ratkaisee toimiiko suodin lainkaan hitaassa päässä.

**2. Toinen aste → neljäs.** Neljä napaa vaimentaa 80 dB/dekadi eikä 40.
Ryhmäviive on `N/(2π·fc)`, joten korkeampi aste maksaa viiveenä — mutta koska
`beta` avaa katkotaajuuden nopeassa eleessä, hinta lankeaa vain sinne missä
vapina ei ole ongelma. **Identtiset reaalinavat eivät ylitä kohdetta**: ei
ylihyppyä eikä soimista, mikä suorassa manipulaatiossa on tärkeämpää kuin
Butterworthin jyrkempi kulma.

### Mitatut arvot

Nämä on mitattu **oikeasta koodista**, ei mallista: Leafletin `_onTouchMove`
kutsutaan suoraan synteettisillä tapahtumilla joiden `timeStamp` on tasan
60 Hz, ja mitataan miten paljon ruudun nurkassa oleva maantieteellinen piste
liikkuu. Näin dispatch-tahti ei sotke mitään mutta koko ketju — oma suodin ja
Leafletin matematiikka — ajetaan sellaisenaan.

```
                            pito         nykivä 3 px      tasainen 4 px/s
2. aste 0,8/0,30 dC 1,0   0,138 px/r   0,327 px/r 30 %   0,248 px/r 15 %
                          14 vaihtoa    11 vaihtoa/s      12 vaihtoa/s
4. aste 1,0/0,30 dC 0,3   0,008 px/r   0,118 px/r  0 %   0,060 px/r  0 %
                           7 vaihtoa     0 vaihtoa/s       0 vaihtoa/s
```

`px/r` = nurkan liike ruudusta toiseen, kohina keskiarvon ympärillä.
`%` = ruudut jotka menevät väärään suuntaan. `vaihtoa/s` = suunnanvaihtoja
sekunnissa.

**Ratkaiseva mittari on suunnanvaihto, ei poikkeama radalta.** Silmä lukee
epämonotonisen liikkeen tärinäksi vaikka poikkeama olisi murto-osa
pikselistä — nykäysten välisillä tauoilla se oli 9 kertaa sekunnissa, nyt 0.
Pidossa kohina putosi 0,138 → 0,008 px ruutua kohti, eli 94 %.

**Hinta.** Tauon aikainen huippuero kasvoi 0,34 → 0,72 px, mutta se on
tasaista kiinniottoa ilman suunnanvaihtoja. Hidas ele laahaa noin 6 px, nopea
zoomaus 10 ms (5 ms ennen), ja 3 px askeleen jälkeen kartta asettuu 500 ms:ssa
(150 ms ennen) — ei valumista.

### Suodin ei riittänyt — vika oli renderöinnissä

Kolme kierrosta viritettiin syötettä, ja käyttäjä näki värinän joka kerta.
Ratkaiseva mittaus oli vasta se joka luki **renderöidyn DOMin** eikä Leafletin
laskemia arvoja: pohjakartan laatan todellinen `getBoundingClientRect()` joka
ruudussa.

```
hidas nipistys 6 px/s        kohina      suunnanvaihtoa/s
laskettu zoom                0,000 px          0
renderöity laatta x          0,556 px         10
renderöity lämpökartta       0,549 px    55 % askelista kokonaisia pikseleitä
```

**Syöte oli täydellisen sileä ja renderöinti tärisi.** Leaflet pyöristää
sijainnit kokonaisiin pikseleihin joka ruudussa, neljässä paikassa:

```
Map._getNewPixelOrigin        ..._round()
Map.latLngToLayerPoint        project(...)._round()
GridLayer._setZoomTransform   ....round()
Marker.update                 latLngToLayerPoint(...).round()
```

Se on **oikein paikallaan olevalle kartalle** — kokonaispikseli pitää laatat
ja tekstin terävinä. Nipistyksessä se on väärin: skaala muuttuu jatkuvasti,
joten pyöristetty siirtymä napsahtaa pikselin kerrallaan. Hitaassa liikkeessä
napsahdukset ovat harvassa, jolloin kukin näkyy erillisenä hyppynä — juuri
siksi vika tuntui pahimmalta silloin kun sormea liikutti varovaisimmin, ja
juuri siksi paremmasta suodatuksesta ei ollut apua.

Pahempi on että **jokainen kerros pyöristää erikseen**: laatat, lämpökartta
(ImageOverlay) ja merkit napsahtavat eri hetkillä, jolloin ne liikkuvat myös
toistensa suhteen. Se on näkyvämpää kuin absoluuttinen liike.

Eleen ajaksi pyöristys poistetaan kaikilta neljältä (`alaPyorista`). Mitattuna
renderöidystä DOMista:

```
                    ennen                    jälkeen
pito, laatta y      0,646 px  26 vaihtoa/s   0,017 px   4 vaihtoa/s
pito, lämpökartta   0,599 px  15 vaihtoa/s   0,019 px   4 vaihtoa/s
nykivä, laatta x    0,562 px  12 vaihtoa/s   0,097 px   0 vaihtoa/s
nykivä, lämpökartta 0,681 px   6 vaihtoa/s   0,224 px   0 vaihtoa/s
tasainen, laatta x  0,556 px  10 vaihtoa/s   0,073 px   0 vaihtoa/s
```

Pidossa laatan heilunta putosi **97 %** ja kokonaispikseliaskelten osuus
42 %:sta nollaan. Liikkeessä suunnanvaihdot menivät nollaan kaikilla
kerroksilla.

**Lippu on nollattava ennen eleen loppusijoittelua, ei sen jälkeen.**
`_onTouchEnd` kutsuu `_animateZoom`/`_resetView`, joka laskee lopullisen
pikseliorigon. Ensimmäinen versio nollasi lipun `zoomend`-tapahtumassa, eli
liian myöhään: origoksi jäi 298217,97 ja kartta olisi ollut levossa
puolikkaan pikselin sivussa — pysyvästi epäterävä. Nyt nollaus tehdään
`_onTouchEnd`in alussa ja origo on levossa kokonaisluku.

### Paikkaukset on asennettava heti, ei ensimmäisessä eleessä

**Leaflet tallentaa tapahtumakuuntelijan funktioviitteen sillä hetkellä kun
kerros lisätään kartalle** (`map.on('zoom', this._reset, this)`). Jos
prototyypin korvaa myöhemmin, jo rekisteröity kuuntelija osoittaa yhä vanhaan
funktioon.

Ensimmäinen versio asensi pyöristyksen purun laiskasti eleen alkaessa. Kolme
neljästä paikkauksesta toimi silti, koska ne kutsutaan sisäisesti ja haetaan
joka kutsulla (`_getNewPixelOrigin`, `latLngToLayerPoint`,
`_setZoomTransform`). Kaksi kuuntelijaksi rekisteröityä — `ImageOverlay._reset`
ja `Marker.update` — eivät päivittyneet lainkaan, eli lämpökartta ja
**kaikki 31 spottimerkkiä pyöristivät edelleen**.

Mitattuna merkin liike eleen aikana:

```
                       kokonaispikseliaskelia
laiska asennus         x 100 %   y 76–88 %
heti latauksessa       x   7 %   y  1–2 %
```

Sata prosenttia tarkoittaa että jokainen askel oli tasan kokonainen pikseli:
31 terävää merkkiä nykii samaan aikaan kun pohjakartta liukuu sileästi. Se on
näkyvämpää kuin pohjakartan oma värinä, koska merkit ovat pieniä ja
kovareunaisia.

**Jos paikkaat Leafletin prototyyppiä, tarkista onko metodi rekisteröity
kuuntelijaksi** (`getEvents()`). Jos on, paikkauksen on oltava paikallaan
ennen `addTo(map)`:ia.

### Ele ei saa ladata uusia laattoja

`updateWhenZooming: false` pohjakartalle. Oletuksena Leaflet luo uuden
laattatason heti kun pyöristetty zoom vaihtuu — myös kesken eleen. Mitattuna
3 sekunnin hitaassa nipistyksessä (z11 → z12,5):

```
                        DOM lisätty  poistettu  laattoja paneelissa
updateWhenZooming true       102         65      32 → 50 kesken eleen
updateWhenZooming false       84         47      32 koko eleen ajan
```

Kokonainen laattataso ladattiin, dekoodattiin ja häivytettiin sisään sillä
aikaa kun käyttäjä vielä liikutti sormia. Se näkyy välkkymisenä ja terävyyden
hyppyinä, eikä mikään syötteen suodatus poista sitä. Nyt olemassa olevat
laatat vain skaalautuvat ja oikea taso ladataan kun ele päättyy — sama minkä
Apple Maps ja Google Maps tekevät.

### Lämpökartta samaan muunnokseen kuin laatat

`ImageOverlay._reset` kirjoittaa joka ruudussa `left`, `top`, **`width`** ja
**`height`**. Kaksi jälkimmäistä ovat layout-operaatioita, ja kohteena on
ruudun suurin elementti. Laatat sen sijaan liikkuvat pelkällä transformilla,
joka menee suoraan kompositoinnille.

Eleen ajaksi lämpökartta saa **täsmälleen saman kaavan kuin laattataso**:
`origin * skaala - pikseliorigo`, koko jäädytetään eleen alun arvoon ja
`scale()` hoitaa loput. Kaksi seurausta: kerrokset eivät voi ajautua
erilleen, koska niiden sijainti tulee samasta lausekkeesta, eikä eleen aikana
tehdä layoutia.

**`mix-blend-mode: plus-lighter` kestää scale-muunnoksen** — se tarkistettiin,
koska sekoitus on helppo rikkoa kompositointia muuttamalla. Mitattu
värikylläisyys levossa 57,7 → kesken eleen 60,5 → eleen jälkeen 60,4.

### Kolme hylättyä ratkaisua — ja mitä ne yhdessä todistavat

**Ennakointi (lead compensation).** Ajatus on kumota viive nopeustermillä
`y + v/(2π·fc)`, jolloin katkotaajuuden voisi laskea rajusti. Mitattuna se
teki hitaasta liikkeestä **11,88** — huonomman kuin suodattamaton 10,03 —
koska hitaalla nopeudella nopeusestimaatti on lähes pelkkää vapinaa ja
ennakointi syöttää sen takaisin. Nollaviive, kaikki värinä.

**Kuollut alue nopeudessa** (`cutoff = mc + beta*max(0, |v| - v0)`). Vei
pidon värinän lähes nollaan, mutta pieni 3 px askel ei ylitä kynnystä
lainkaan: katkotaajuus jää pohjalle ja kartta valuu **3,2 sekuntia** askeleen
jälkeen. Kynnys joka erottaa vapinan liikkeestä erottaa myös liikkeen
liikkeestä.

**Elesuureiden suodattaminen** (etäisyys `d` ja keskipiste `m` erikseen sen
sijaan että suodatetaan sormet) kokeiltiin, koska se poistaisi sormien
välisen viive-eron. Se ei kannattanut: `d` sisältää molempien sormien
vapinan, joten sen nopeusestimaatti on vielä pahemmin vapinan ajama.
Per-sormi voitti mitattuna.

**Holtin kaksoiseksponentti.** Alipäästö laahaa ramppia rakenteellisesti
`v·τ` verran; Holt mallintaa myös trendin, jolloin vakionopeuksisen rampin
pysyvä viive on nolla. Teoriassa juuri se mitä tarvitaan. Mitattuna kohina
0,55–0,88 px/ruutu (nykyinen 0,038), 15 suunnanvaihtoa sekunnissa ja
**4–6 px ylihyppy** kun liike pysähtyy.

**Nollaviiveinen FIR** — pienimmän neliösumman suora N:n viime näytteen
ikkunaan, arvo ikkunan lopusta. Ei takaisinkytkentää, joten ei soimista, ja
rampilla viive on nolla. Mitattuna kohina 0,16–1,8 px/ruutu, eli sekin
huonompi kuin nykyinen 0,028–0,25.

**Mitä nämä kolme yhdessä todistavat.** Kaikki kolme yrittävät poistaa
ramppiviiveen, ja se onnistuu vain estimoimalla signaalin **derivaatta**.
Näillä nopeuksilla derivaatta on lähes kokonaan vapinaa: sormi etenee
2–8 px/s, mutta 1,3 px vapina 7,3 Hz:ssä on 60 px/s huippunopeutta. Signaali-
kohinasuhde derivaatassa on siis selvästi alle yhden, ja jokainen menetelmä
joka nojaa siihen syöttää kohinan takaisin ulostuloon. **Syötteen puolella
lisää pehmeyttä saa vain lisää viivettä vastaan** — se ei ole viritysasia
vaan tiedon puute. Jos joku palaa tähän: älä yritä neljättä
derivaattapohjaista menetelmää, vaan katso onko renderöinnissä vielä jotain.

### Mittarit jotka eivät toimineet

Tämä oli kolme kertaa väärin ennen kuin oli oikein, ja kaikki kolme virhettä
näyttivät uskottavilta lukuina:

1. **Toisen erotuksen RMS selaimessa** antoi 20 px myös nollavapinalla ja
   *pieneni* kun vapinaa lisättiin. Se mittasi omaa dispatch-tahtiani, ei
   karttaa.
2. **Liukuvan keskiarvon jäännös** antoi 9 px nollavapinalla: liukuva
   keskiarvo on harhainen kaarevalla radalla, ja nurkan rata on voimakkaasti
   kaareva (`2^dz`). Savitzky–Golay (kvadraattinen) korjaa harhan mutta
   selaimen eleputki oli silti liian meluisa.
3. **Poikkeama ideaalista yhtenä lukuna** sekoitti tärinän ja viiveen:
   ensimmäinen viritys näytti että suodatus tekee asiasta 14× pahemman,
   koska rampin aikana viive hallitsi mittaria kokonaan.
4. **Savitzky–Golay-jäännös on sokea hitaalle tapaukselle.** Se poistaa
   kaiken trendiä hitaamman, eli juuri sen matalataajuisen huojunnan jonka
   silmä hitaassa liikkeessä näkee. Mittari antoi hitaalle liikkeelle siistin
   0,69 px:n luvun samaan aikaan kun kartta oikeasti peruutti joka
   neljännessä ruudussa. Hitaan liikkeen mittari on **ruutujen välinen
   siirtymä**: sen hajonta suhteessa keskiarvoon, ja väärään suuntaan
   menevien ruutujen osuus.
5. **Yhden suotimen ajaminen sormien etäisyydelle `d`** antaa eri tuloksen
   kuin toteutus, joka suodattaa kaksi sormea erikseen. Ero ei ole
   akateeminen: adaptiivinen katkotaajuus riippuu kunkin signaalin omasta
   nopeudesta, ja `d` muuttuu kaksi kertaa niin nopeasti kuin kumpikaan
   sormi. Ensimmäisen kierroksen viiveluvut olivat siksi noin puolet liian
   pieniä. Harnessin on syötettävä `±d/2` kahtena signaalina.
6. **Symmetrinen rata piilotti koko ongelman.** Kaksi kierrosta viritettiin
   radalla jossa molemmat sormet liikkuvat yhtä paljon vastakkaisiin
   suuntiin. Silloin sormet saavat saman katkotaajuuden eikä viive-eroa
   synny — eli juuri se mekanismi joka käyttäjän tapauksessa tärisyttää
   karttaa puuttui mallista kokonaan. Radan on oltava epäsymmetrinen:
   **toinen sormi paikallaan.**
7. **Tasainen hidas ramppi ei ole hidas liike.** Ihminen ei pysty
   liikuttamaan sormea tasaisesti 5 px/s — liike on nykäyksiä ja taukoja.
   Tasaisella radalla mitattuna kaikki näytti korjatulta samaan aikaan kun
   nykivällä radalla tauoilla oli 11 suunnanvaihtoa sekunnissa.
8. **Tauon aikainen kokonaissiirtymä sekoittaa asettumisen ja värinän.**
   Raskaampi suodin liikkuu tauon aikana ENEMMÄN, koska se ottaa edellistä
   nykäystä kiinni — mittari näytti siis huonommalta juuri kun asia parani.
   Oikea luku on suunnanvaihtojen määrä sen jälkeen kun asettumiselle on
   annettu 250 ms.
9. **Kaikkein tärkein: `tz._center` / `tz._zoom` EI OLE se mitä käyttäjä
   näkee.** Kolme kierrosta mitattiin Leafletin laskemia arvoja, ja ne
   olivat jo toisen kierroksen jälkeen käytännössä täydellisiä — samaan
   aikaan kun ruudulla laatta heilui puoli pikseliä kymmenen kertaa
   sekunnissa. Kun suodatuksen parantaminen ei enää auta, vika on
   suotimen ja pikselien VÄLISSÄ. Mittaa `getBoundingClientRect()`
   oikeista DOM-elementeistä.
10. **Yhden kerroksen mittaaminen ei riitä.** Laatta ja lämpökartta olivat
    jo täsmällisiä samaan aikaan kun merkit liikkuivat 100-prosenttisesti
    kokonaisin pikselein. Mittaa jokainen kerros joka on kartan päällä:
    laatat, lämpökartta, merkit. Erillinen mittari kullekin.
11. **Kaikki mikä liikkuu ei liiku paikassa.** Uusien laattojen lataus ja
    häivytys kesken eleen ei näy missään sijaintimittarissa, mutta näkyy
    silmälle. Se mitataan `MutationObserver`illa laattapaneelista.
12. **Ruutuaikaa ei kannata mitata headless-selaimessa.** Yritettiin:
    mediaani 33,3 ms 1× jarrulla, eli 30 fps, ja laattaelementti vaihtui
    kesken mittauksen niin että askelhajonnaksi tuli 30 px. Molemmat ovat
    mittalaitteen ominaisuuksia, eivät sovelluksen. Deterministinen
    `_onTouchMove` + kaksi rAF:ää on ainoa luotettava selainmittari tässä.

Toimiva mittari kutsuu **oikeaa koodia**: `L.Map.TouchZoom.prototype._onTouchMove`
suoraan synteettisillä tapahtumilla joiden `timeStamp` on tasan 60 Hz, ja
lukee `tz._center` / `tz._zoom` joka kutsun jälkeen. Selaimen eletapahtumia ei
tarvita, joten dispatch-tahti ei sotke — mutta mitään ei myöskään mallinneta.
Analyyttinen harness on hyvä pyyhkäisyihin (satoja asetuksia sekunneissa);
lopputulos varmistetaan aina oikealla koodilla. Ne täsmäsivät kolmen
desimaalin tarkkuudella, mikä on hyvä merkki molemmista.

Ajettavat tapaukset ovat **pito**, **nykivä hidas** (epäsymmetrinen: toinen
sormi paikallaan, 2–4 px askelia ja 380 ms taukoja) ja **tasainen hidas**.
Nopea ele ja asettumisaika ovat regressiotarkistuksia — jälkimmäinen sen
varalta ettei kartta ala valua itsestään.

Rataan kuuluu myös **kvantisointi**: kosketuspisteet raportoidaan
laitepikselihilalla, ja hitaassa liikkeessä se on portaikko eikä
satunnaiskohinaa. Sen osuus suodattamattomasta kohinasta on 25 % nopeudella
10 px/s ja 48 % nopeudella 25 px/s — ei sivuseikka.

Kolmas ansa: **beta on eri mittakaavassa riippuen siitä mitä suodatetaan.**
Zoomin nopeus on noin 0,5/s, sormen etäisyyden kymmeniä px/s. Ensimmäinen
pyyhkäisy tehtiin zoomiavaruudessa ja `beta 0,15` oli siellä käytännössä
nolla. Viritys on tehtävä siinä avaruudessa jossa toteutus toimii.

Selaimessa varmistettiin vain **oikeellisuus**, ei numeroita. Oikeilla
kosketustapahtumilla, `zoomSnap: 0`:n jälkeen:

```
levitys 70→170 px      10,000 → 11,217
kavennus 170→70 px     11,217 →  9,995
hidas 8 px/s            9,995 → 10,277
nopea nykäisy          10,277 → 12,314
kolmas sormi kesken    12,314 → 12,822
```

Lisäksi joka eleen jälkeen: `_zooming` false, alipikselitila purettu,
`nipistys`-luokka poistettu, pikseliorigo kokonaisluku, ei JS-virheitä.

## Eleen loppu ja tuntuma — kolme asiaa Apple Mapsista

Kun eleen aikainen sileys oli mitattu kuntoon, jäljelle jäi kolme asiaa
jotka erottavat selainkartan natiivista. Kaksi niistä ei näy missään
sileysmittarissa, koska ne tapahtuvat sillä hetkellä kun sormet irtoavat.

### 1. zoomSnap 0 — ele päättyy siihen mihin sormet sen jättivät

`zoomSnap` oli 0,5, eli Leaflet animoi eleen jälkeen lähimpään puolikkaaseen
tasoon. Mitattuna kahdeksalla eleellä:

```
sormiväli   zoom irrotettaessa   napsahti   skaalahyppy
   116 px          11,181          11,00       13,4 %
   180 px          11,817          12,00       13,5 %
   240 px          12,239          12,00       18,0 %
keskimäärin 0,133 zoomtasoa, suurin 0,239
```

**Kartta muutti kokoaan jopa 18 % sillä hetkellä kun sormet irtosivat**, joka
ikisessä eleessä. Se on satakertaisesti suurempi epäjatkuvuus kuin ne
alipikselin jäänteet joita eleen aikana oli hiottu. Arvolla 0 hyppy on 0,000
kaikissa kahdeksassa tapauksessa.

**Terävyys ei kärsi, vaikka niin voisi luulla.** Leaflet lataa laattatason
`Math.round(zoom)`, joten zoom 11,5 skaalaa jo nyt z12-laattoja kertoimella
0,707. Skaalan vaihteluväli on `[1/√2, √2]` kummallakin asetuksella —
napsautus ei osta terävyyttä, se vain siirtää kartan pois siitä mihin se
jätettiin.

`zoomDelta` pysyy 0,5:ssä, joten napit ja kaksoisnapautus liikkuvat yhä
siisteinä askelina. Tarkistettu ettei murtolukuzoom riko välimuisteja: kaikki
zoomista riippuva logiikka haarukoi välejä (`ViewportGrid.gridStep`,
ikonikoot, `_windIconSig`).

### 2. Zoom-inertia

Leafletissa on panorointi-inertia mutta zoomille ei mitään — zoom pysähtyy
kuin seinään. Toteutus **ei ole oma animaatiosilmukka** vaan maalin jatko:
eleen päättyessä zoomiin lisätään `v·TAU` ja keskipiste lasketaan uudelleen
samalle ankkurille, minkä jälkeen Leafletin oma 250 ms:n siirtymä
(`cubic-bezier(0,0,0.25,1)`, eli ease-out) hoitaa liu'un. Kerrosten
synkronointi, laattojen lataus ja `zoomend` tulevat valmiina eikä mikään
kilpaile Leafletin tilakoneen kanssa.

Mitattu (kynnys 0,4 /s, TAU 0,12 s, katto 0,5):

```
ele                  zoom irrotettaessa -> lopullinen   lisä    ankkurin luisto
nykäisy 350 ms          13,076 -> 13,475            +0,399        0,45 px
tavallinen 900 ms       12,104 -> 12,164            +0,060        0,33 px
varovainen 8 px/s       11,285 -> 11,285             0,000        1,07 px
pito                    10,997 -> 10,997             0,000        0,36 px
nykäisy ulos             9,156 ->  8,656            −0,500        0,45 px
```

**Kynnys on välttämätön, ei viimeistelyä.** Hitaassa liikkeessä
nopeusestimaatti on lähes pelkkää vapinaa — tässä projektissa se on mitattu
kolmesti (Holt, FIR-sovite ja lead compensation kaatuivat kaikki siihen).
Ilman kynnystä inertia lisäisi satunnaista zoomia juuri siihen eleeseen jota
on eniten hiottu. Mitatut nopeudet erottuvat puhtaasti: nykäisy 3,72 /s,
tavallinen 0,85 /s, varovainen 0,093 /s, pito 0,004 /s. Kynnys vähennetään
lisästä, joten sen ylitys ei tuota hyppyä.

Katto on 0,5 eikä 0,7, koska ulospäin nykäisyssä `|v|` on suurempi kuin
sisäänpäin: sormiväli kutistuu logaritmisella asteikolla nopeammin kuin se
kasvaa. Katolla 0,7 pari oli +0,40 sisään ja −0,70 ulos, mikä tuntuu
epäsymmetriseltä.

### 3. Rasterointi kiinni eleen ajaksi

`.nipistys .leaflet-tile-container, .nipistys .heatmap-overlay
{ will-change: transform }`. Kun skaala muuttuu jatkuvasti, selain voi
rasteroida sisällön uudelleen kesken eleen — se näkyy **terävyyden hyppyinä
eikä siirtymänä**, joten mikään sijaintimittari ei sitä näe. `will-change`
kertoo että muunnos jatkuu, jolloin selain rasteroi kerran ja skaalaa GPU:lla.

Luokka on voimassa **vain eleen ajan**. Pysyvä `will-change` pitäisi kerrokset
omassa muistissaan jatkuvasti ja estäisi alipikselitarkan tekstin renderöinnin
levossa. Tarkistettu mittauksella: `will-change` on levossa `auto`, eleen
aikana `transform`.

`plus-lighter` kestää sen. Kompositointitason muutos on tyypillinen tapa
rikkoa sekoitustila, joten se mitattiin: värikylläisyys 57,7 levossa → 60,5
kesken eleen → 60,4 jälkeen.

### Zoom-eleitä on kaksi

`_installDoubleTapZoom` (tuplanapauta ja vedä pystysuunnassa) kutsuu
`map._move`a **suoraan**, ohi Leafletin `TouchZoom`in. Se jäi siksi kokonaan
ilman alipikselikäsittelyä. Eleen tila on nyt yhdessä paikassa —
`nipistysAlkaa` / `nipistysPaattyy` — ja molemmat polut kutsuvat sitä.

Samalla lisättiin puuttuva `touchcancel`-käsittelijä: ilman sitä keskeytynyt
veto jätti `dtz.active` päälle, ja nyt se olisi jättänyt myös alipikselitilan
ja `will-changen` pysyvästi voimaan. Leafletin oma `TouchZoom` kuuntelee
`'touchend touchcancel'` juuri tästä syystä.

> Tässä luvussa korjattiin vain yhden sormen zoomin **alipikselikäsittely**.
> Itse ele oli edelleen rikki neljällä muulla tavalla — ks.
> *Yhden sormen zoom oli rikki — neljä eri vikaa*.

## Kaksi kokeilua jotka eivät jääneet — älä tee uudestaan

Molemmat rakennettiin, mitattiin ja poistettiin. Luvut kannattaa lukea, koska
ne houkuttelisivat muuten tekemään saman toistamiseen.

**Yksi muunnos koko kartalle** (MapKitin tapa: `tilePane` muunnetaan kerran
eleen ajaksi, kerrokset jäädytetään). Kattohyöty mitattiin ennen toteutusta
ajastamalla se työ jonka se poistaisi: `GridLayer._setZoomTransform` 0,015 +
`ImageOverlay._reset` 0,000 + `Marker.update` 0,016 = **0,031 ms/ruutu**, eli
0,2 % budjetista. Sijainneissa ei ole voitettavaa, koska täydellisellä
syötteellä renderöinti on jo tasan 0,000 px kaikilla kerroksilla, ja
rasteroinnin hoitaa `will-change` murto-osalla vaivasta. Blend-riski
mitattiin silti (se oli aiempi hylkäysperuste): `tilePane` muunnettuna
värikylläisyys 58,77 → 59,49 → 58,78, eli riski ei ollut todellinen. Ei
toteutettu.

**Hiukkaset jäähän eleen ajaksi.** Tämä toteutettiin ja **peruttiin
käyttökokemuksen perusteella**, vaikka mittarit olivat erinomaiset. Eleen
aikainen `renderLoop` putosi 4× CPU-jarrulla 6,30 → 0,10 ms mediaanina ja
pahin ruutu 18,30 → 2,10 ms, koska koko kustannus on `nauha`-funktion
Path2D-nauhojen rakentaminen uudelleen joka ruudussa (9,18 ms/ruutu, 92 %
silmukasta, 210 kutsua/ruutu). Jäädytettynä polut kelpaavat sellaisenaan ja
piirto on yksi matriisi ja kaksi `fill`-kutsua. Rekisteröinti pysyi
täsmälleen ennallaan (0,545 px kartan suhteen molemmilla versioilla).

Silti se oli laitteella huonompi. **Se on tämän luvun tärkein tieto:**
ruutuaikamittari ei kerro kaikkea. Tuulianimaation pysähtyminen eleen ajaksi
maksaa enemmän kuin 6 ms ruutuaikaa voittaa — kartta näyttää jäätyvän juuri
silloin kun sitä katsotaan tarkimmin. Panorointi ohittaa partikkelityön, ja se
tuntuu eri asialta, koska panoroinnissa kuva liikkuu tasaisesti eikä sisältö
muutu.

Jos ruutuaika joskus oikeasti rajoittaa nipistystä, oikea kohde on `nauha`
itse (9,18 ms/ruutu 4× jarrulla) — ei animaation pysäyttäminen.

**Toteutuksessa oli myös vika joka on hyvä muistaa jos joku palaa tähän:**
sulatus ei saa tehdä omaa `_siirra`a jos loppuanimaatio on jo alkanut.
`_onTouchEnd` käynnistää `_animateZoom`in, joka laukaisee `zoomanim`in →
`Ruudusto.zoomAnim` on jo tehnyt siirron ja kello ohjaa matriisia. Oma siirto
tekee sen toiseen kertaan animaation maaliin, jolloin hiukkaset hyppäävät
maalille kartan ollessa vielä matkalla — mitattuna mediaanivirhe 349 px.

Ja mittari joka ei kelpaa: yksittäisen hiukkasen seuranta eleen yli. Se antoi
277–349 px myös oikealla koodilla, koska sulatuksen jälkeen simulaatio jatkuu
ja osa hiukkasista respawnaa satunnaiseen paikkaan. Kelvollinen mittari
kokoaa `siirraPartikkelit`-kutsut yhdeksi affiiniksi muunnokseksi ja vertaa
kartan täsmälliseen muunnokseen.

## PWA — kotivalikkoon ja rannalle

Vaihe 1 pushista: asennettavuus ja offline-käynnistys. Ei ilmoituksia, ei
palvelinta, ei salaisuuksia — nämä tulisivat vasta vaiheessa 2.

Tavoite on **yksi** asia: kartta ja sovellus aukeavat rannalla yhdellä
palkilla. Ei datansäästöä eikä taustapäivitystä.

### Mitä välimuistiin menee — ja mitä ei

```
/ (index.html)         verkko edellä, 3 s aikakatkaisu, varalla välimuisti
Leaflet 1.9.4 CDN      välimuisti edellä (versioitu osoite, ei voi muuttua)
karttalaatat           vanhene-ja-virkistä, katto 600, EI versioitu
/api/*                 ei mitään — menee koskemattomana verkkoon
```

**`/api` on tarkoituksella ulkopuolella.** Sovelluksella on jo oma
ennustevälimuisti localStoragessa ja se osaa merkitä datan vanhentuneeksi.
Toinen välimuisti sen alla tarjoaisi vanhaa dataa tuoreena eikä sovellus
tietäisi siitä mitään.

**Navigointi on verkko edellä, ei välimuisti edellä.** Sovellus on yksi
`index.html` ilman hajautettuja tiedostonimiä, joten välimuisti edellä
jäädyttäisi koko sovelluksen vanhaan versioon eikä siitä näkyisi mitään
ulospäin — sama ongelma jota vastaan versioleima aikanaan tehtiin. Mutta
"yksi palkki" ei ole sama kuin "ei verkkoa", joten pelkkä verkko edellä
jättäisi käynnistyksen roikkumaan hitaan haun taakse. Siksi 3 s aikakatkaisu:
sen jälkeen näytetään välimuisti ja haku jatkuu taustalla.

**Laattavälimuistia ei versioida.** Sen koko arvo on että eilen katsotut
laatat ovat tallessa tänään. Jos se tyhjenisi joka deployssa, rannalla ei
olisi mitään. Kuorivälimuisti sen sijaan versioidaan ja vanha siivotaan
`activate`ssa.

**Laatat ovat vanhene-ja-virkistä eivätkä välimuisti edellä.** Ne ovat
`<img>`-hakuja ilman CORSia, joten vastaus on läpinäkymätön eikä sen
onnistumista voi tarkistaa. Välimuisti edellä jättäisi yhden epäonnistuneen
laatan pysyvästi ruudulle; virkistys korjaa sellaisen seuraavalla käynnillä
ja välimuistista tarjoillaan silti heti.

### Kaksi asiaa jotka pitää muistaa

**Leima menee myös `sw.js`:ään.** Service worker päivittyy vain jos sen
**tavut** muuttuvat — ilman leimaa uusi deploy jättäisi vanhan workerin ja sen
mukana vanhan kuorivälimuistin voimaan. `public/` kopioidaan sellaisenaan,
joten korvaus tehdään `versioLeima`-pluginin `writeBundle`-vaiheessa.

**Devissä worker on tyhjäkäynnillä.** `public/sw.js`:ssä leima on korvaamatta,
ja `DEV`-lippu katkaisee sekä `install`in että `fetch`in. Muuten Viten HMR ja
oma välimuisti sotkeutuisivat keskenään.

### Mitattu

Preview-buildilla, oikealla verkolla:

```
rekisteröinti      scope /, aktivoituu ja ottaa sivun hallintaansa
manifest           standalone, kolme ikonia 200, apple-touch-icon 200
välimuistit        kuori 3 merkintää, laatat 32
/api               ei yhtään merkintää
OFFLINE + reload   sivu latautuu, Leaflet latautuu, kartta rakentuu,
                   28 laattaa ruudulla, /api epäonnistuu (ei valehtele)
deploy (uusi leima) vanha kuori siivottu, uusi luotu, laatat säilyivät,
                   worker aktivoitui ja hallitsee
```

### Testaamisen sudenkuoppa

Chromium ei pääse agenttiproxyn läpi jsdelivriin (`ERR_CONNECTION_RESET`)
vaikka `curl` pääsee. Leaflet on siis tyngättävä testissä — ja tyngät on
asennettava **`context.route`en eikä `page.route`en**, koska service workerin
omat haut eivät kulje sivun reittien kautta.

### Löydös jota ei korjattu

`<head>`issä ladataan yhä Google Fontsista **Syne ja DM Mono**, vaikka
CLAUDE.md:ssä lukee että ne poistettiin. Ne ovat oikeasti yhä käytössä
seitsemässä `font-family`-säännössä, eli lataukset eivät ole pelkkää roskaa —
poisto muuttaisi ulkoasua. Mutta ne ovat kaksi ulkoista pyyntöä joka
latauksella, ja juuri ne ovat kalleimpia heikolla yhteydellä. Tämä on oma
päätöksensä, ei osa PWA-vaihetta.

## Lämpökartta jäi väärään mittakaavaan ulos zoomatessa

Oire: lähelle zoomaamisen jälkeen ulos zoomattu näkymä näytti paikoin
väärää tietoa — litteitä läiskiä jotka eivät seuranneet sitä missä
oikeasti tuulee, eivätkä olleet johdonmukaisia meren päällä.

### Syy: kolmesta kutsupaikasta yksi unohti mitoittaa ytimen

`idw()` mitoittaa tukisäteensä `R = 3 × SpatialIndex.spacing`, ja spacing
asetetaan `SpatialIndex.build(wf, ViewportGrid.gridStep(zoom))`. Tekstuuri
rakennetaan kolmesta paikasta:

```
buildWindField      kutsuu SpatialIndex.buildin ensin   ✓
_heatmapCatchUp     kutsuu SpatialIndex.buildin ensin   ✓
zoomend-käsittelijä EI KUTSU                            ✗
```

Zoomin lopettaminen menee juuri kolmatta polkua. Tekstuuri rakennettiin siis
uudelle laajalle näkymälle mutta tukisäteellä joka oli mitoitettu
edelliselle tiheälle zoomille — z13:n 0,25° jäi voimaan z5:llä, missä sen
pitäisi olla 2,5°.

Mitattuna z13 → z5, näytehila Suomen yli:

```
                          spacing   R        ilman tukea
suoraan z5                2,5       7,50°     0 %
z13 Hanko                 0,25      0,75°    38 %
takaisin z5 (rikki)       0,25      0,75°    38 %
sama, indeksi pakotettu   2,5       7,50°     0 %
```

**38 % tekstuurin näytteistä jäi ilman yhtään tukipistettä.** Niissä `idw()`
putosi varatielle. Ja koska `_points` on kumulatiivinen, tila ei korjaantunut
itsestään — vasta seuraava liike laukaisi rakennuksen jossa väli päivittyi.

Korjaus on rakenteellinen eikä neljäs kutsu: **ydin mitoitetaan
`WindTexture.build`in sisällä**, jolloin yksikään kutsupaikka ei voi unohtaa
sitä. Rakennus tehdään vain jos väli tai kenttä oikeasti vaihtui — `build`
tyhjentää IDW-painojen muistin, ja se on aikajanan raahauksen kallein osa.

### Toinen vika: varatie kopioi lähimmän pisteen

Kun tukisäteen sisään ei osu mitään, vanha koodi kopioi lähimmän pisteen
sellaisenaan. Reuna pysyy jatkuvana, mutta koko katvealue saa **yhden ainoan
pisteen arvon** eikä sekoitu naapureihinsa — juuri se on se litteä läiskä
joka ei seuraa tuulta.

Nyt sädettä laajennetaan nelinkertaiseksi ja painotetaan normaalisti.
Mitattuna harvalla kentällä (2,5° data, 0,25° ydin):

```
                    uniikkeja arvoja   vaakanaapuri tasan sama
vanha varatie         100 / 1681              79,8 %
uusi varatie          718 / 1681              32,7 %
```

Meri/maa-suhde säilyi (8,05/7,31 → 7,99/7,41), eli fysiikka ei vääristy —
vain lohkoisuus katoaa. Nopeaan polkuun tämä ei koske: haara ajetaan vain
kun tukea ei löytynyt.

**`idw()`:llä on kaksoiskappale.** `idwPainoin()` on sama laskenta painojen
talletusta varten, ja tekstuurin rakennus siirtyy siihen heti kun sama
geometria toistuu kolmesti. Varatie oli korjattava molempiin — pelkkä
`idw()` olisi jättänyt läiskät voimaan juuri silloin kun kartta on
paikallaan.

## Aikajana kotivalikon appissa

Selaimessa `env(safe-area-inset-bottom)` on iPhonella nolla, koska Safarin
alapalkki vie sen tilan. Kotivalikon appissa palkkia ei ole ja sama inset on
34 px kotinäppäimelle — ja koska aikajana lisää sen alareunaansa, se
**nostaa** aikajanaa saman verran. Mitattuna rako ruudun pohjaan 8 px → 42 px.

Aikajanalla on nyt oma token `--sab-tl`, joka on oletuksena sama kuin `--sab`
mutta standalone-tilassa 14 px:

```
                              --sab-tl   rako pohjaan   play-napin ala
selain (Safari)                  0 px        8 px           19 px
standalone ennen                34 px       42 px           53 px
standalone nyt                  14 px       22 px           33 px
```

Selainversio ei muutu lainkaan. Standalone laskee 20 px ja play-nappi jää
33 px:n päähän pohjasta eli selvästi irti kotinäppäimestä.

**Kaikki neljä aikajanan osaa on vaihdettava yhdessä.** Ensimmäinen versio
vaihtoi vain `#tl-wrap`in, jolloin `.tl-play-btn` ja `#tl-indicator` jäivät
`--sab`:iin — mitattuna siru olisi ollut 22 px:ssä ja nappi 53 px:ssä, eli
ne olisivat erkaantuneet toisistaan. Myös `#rl-banner` kelluu aikajanan
yläpuolella ja käyttää samaa tokenia, jottei väli muutu.

Tunnistus on kahdesti: `@media (display-mode: standalone)` kattaa nykyiset
selaimet ja `.standalone`-luokka (bootissa `navigator.standalone`) vanhemman
iOS:n. Paneelien `padding-bottom` pitää edelleen koko `--sab`:in — ne ovat
vieritettävää sisältöä jonka on kierrettävä kotinäppäin.

## Kartan asetukset

Asetuspaneelissa on neljä kartan säätöä: **pohjakartta** (tumma / vaalea /
satelliitti), **partikkelit** (normaali / vähän / pois), **väriasteikko**
(nykyinen / värisokeusystävällinen) ja **lämpökartan voimakkuus**
(hillitty / normaali / voimakas).

Arvot ovat yhdessä localStorage-avaimessa `fs_kartta` (JSON), eivät
neljässä erillisessä kuten `fs_model` / `fs_unit` / `fs_suuntamuoto`. Syy:
ne luetaan aina yhdessä, ja `<head>`:n käynnistyslohko tarvitsee niistä
yhden ennen ensimmäistä maalausta. `Asetukset.lue()` tarkistaa jokaisen
arvon sallittujen listaa vasten — localStoragessa voi olla mitä tahansa, ja
tuntematon arvo saisi esimerkiksi `ColorRamp`in rakentamaan LUTin
`undefined`iin. Testattu: rikkinäinen JSON palauttaa kaikki oletuksiin.

### Vaalea pohjakartta kääntää koko sekoituksen

Tämä on luvun tärkein asia, ja se seuraa yhdestä mitatusta luvusta: **Esrin
vaalean kartan maa on 239 ja vesi 208, eli molemmat keskiharmaan
yläpuolella.** (Tumma: 71 / 39. Satelliitti: 51 / 29.)

Siitä seuraa neljä asiaa, kaikki pakollisia:

1. **Sekoitustila `multiply`, ei `plus-lighter`.** Additiivinen sekoitus
   vain työntää vaalean pohjan valkoiseksi: mitattuna rantaviivan ero
   romahti 45.6 → 0.9 ja tuulivärit katosivat. `multiply` kertoo pohjan
   värillä eli **lisää mustetta valkoiselle paperille**, ja rantaviiva
   säilyy. Sama koskee partikkelikanvasta.
2. **Partikkelien vaalennus kääntyy tummennukseksi.** `VAALEA = 0.44`
   vetää värin kohti valkoista; multiplyssa valkoinen ei muuta paperia
   lainkaan, eli jäljet katoaisivat kokonaan. `PAPERI_TUMMENNUS = 0.18`
   toiseen suuntaan. Mitattuna luettava peitto on kaikilla kolmella
   pohjalla käytännössä sama: tumma 4.97 %, vaalea 4.95 %,
   satelliitti 5.69 %.
3. **Lämpökartta käyttää `RAMP_INK`iä.** Kartan omat rampit vaalenevat
   nopeuden mukana, ja multiplyn läpi niiden kirkkaus ei enää nouse
   monotonisesti — 2 ja 8 m/s päätyivät samaan tummuuteen (dE 4.3).
   Musteramppi on jo tehty tummenemaan tuulen mukana. Mitattuna vaalealla
   pohjalla **11.6 normaali / 6.8 deuteran. / 7.2 protan. / 6.3 tritan.**,
   ja L\* laskee monotonisesti.
4. **Sävynsäätimeen tarvitaan `brightness` ennen `contrast`ia.** Pelkkä
   kontrasti leikkaa maan valkoiseksi: puhtailta laatoilta mitattuna
   `contrast(1.2)` vei 75 % pikseleistä arvoon 255 ja `contrast(1.4)`
   kavensi maan ja veden eron 31 → 16. `brightness(0.78) contrast(2.1)`
   siirtää kuvan ensin keskiharmaan alapuolelle. Valmiista ruudusta 10 m/s
   tuulessa mitattuna: **luminanssiero 20.3 → 32.1** ja hienojen
   yksityiskohtien säilyminen **0.73 → 1.10**, kun tuulierottelu pysyy
   ennallaan (24.7 → 24.9).

**Satelliitti on kuin tumma, vain kevyemmällä suotimella.** Ilmakuva on jo
keskiharmaan alapuolella, joten `contrast(1.2)` tummentaa ja terävöittää
yhtä aikaa: ruudulta mitattuna ero 38.0 → 45.7 ja yksityiskohdat
4.15 → 4.98. `contrast(1.35)` antaisi 47.6 / 5.45 mutta painaisi 14 %
pikseleistä puhtaaseen mustaan — syvä vesi ja varjot menettäisivät kaiken
sisältönsä. 1.2:lla 0.7 %.

**Missä nämä asuvat.** `--pohja-suodin` ja `--sekoitus` ovat CSS-tokeneita
`:root[data-pohja=...]`-säännöissä, koska ne tarvitaan ennen ensimmäistä
maalausta; attribuutti asetetaan `<head>`:n käynnistyslohkossa. Kaikki muu
on `POHJAT`-taulussa ja `KarttaAsetukset.kayta()`ssa.

**Tilapalkin tummennus on ainoa kohta jossa pohjakartta vaikuttaa muuhun
kuin karttaan.** Kotivalikon appi ajaa `black-translucent`, eli iOS piirtää
kellon ja akun valkoisena suoraan sivun päälle, eikä tyyliä voi vaihtaa
ajossa — se luetaan kirjanmerkistä käynnistyksessä. Vaalealla kartalla
valkoinen teksti jäisi lukukelvottomaksi, joten `body::before` tummentaa
`--sat`:in korkuisen kaistan. Selaimessa ja ilman lovea `--sat` on 0.

### Värisokeusystävällinen väriasteikko

Nykyinen ramppi on kelvollinen deuteranoopille ja protanoopille (4.9 ja
7.1) mutta romahtaa **tritanoopille: 2.2**. Se on sen todellinen heikko
kohta — ei vihreä–keltainen, kuten tässä dokumentissa aiemmin luki.

`RAMP_CVD` luopuu sävypolusta ja koodaa nopeuden lähes pelkkään
kirkkauteen, sinisestä kellanvalkoiseen — samalla periaatteella kuin
cividis. Tummalla pohjalla renderöitynä, pienin dE2000 kun nopeusero on
vähintään 4 m/s:

| ramppi | normaali | deuteran. | protan. | tritan. |
|---|---|---|---|---|
| nykyinen | 19.2 | 4.9 | 7.1 | 2.2 |
| cividis | 9.0 | 9.4 | 9.3 | 8.3 |
| **RAMP_CVD** | **10.9** | **10.5** | **10.3** | **11.2** |

Tritanoopin erottelu viisinkertaistuu ja kahden muun kaksinkertaistuu.
Hinta on normaalinäön erottelu, 19.2 → 10.9 — siksi tämä on asetus eikä
uusi oletus. Rantaviiva säilyy: maan ja veden ero 10 m/s kohdalla 10.2
(nykyisellä 12.4). Satelliittipohjalla luvut ovat 9.0 / 8.2 / 8.1 / 9.3.

Cividis sellaisenaan ei kelvannut: se on suunniteltu läpinäkymättömäksi
kuvaksi ja sen keskiharmaat sävyt ovat additiivisessa sekoituksessa lähes
värittömiä. `RAMP_CVD` pitää saman kirkkausaikataulun mutta kääntää
keskiosan turkoosiin ja vaaleanvihreään, jolloin se voittaa cividiksen
jokaisella akselilla.

**Asetus ei tee mitään vaalealla pohjakartalla, ja se on tulos eikä
puute.** Subtraktiivisella pohjalla signaali kulkee musteen määrässä eli
kirkkaudessa, jonka jokainen dikromaatti näkee — musteramppi on siellä jo
6.3–7.2. Kartan värisokeusongelma on nimenomaan **tumman pohjan
additiivisen sekoituksen** ongelma. Paneelin vihjeteksti vaihtuu
pohjakartan mukana, jottei käyttäjä valitse vaihtoehtoa eikä näe mitään.

### Partikkelit ja lämpökartan voimakkuus

**Partikkelit.** Kerroin `nParticlesBase()`iin: normaali 1, vähän 0.45,
pois 0. Kerroin tulee **alarajan (60) jälkeen** — toisin päin alaraja söisi
"vähän"-asetuksen pienellä ruudulla ja "pois" palauttaisi 60 partikkelia.
"Pois" ohittaa koko partikkelityön (`partikkelitPois()` sekä
`resetParticles`issa että `renderLoop`issa), ei pelkkää piirtoa — akkusäästö
on koko pointti. Mitattuna 6× kuristetulla suorittimella:

```
             lepo fps    vetoele fps
normaali      22–24        5.6–6.7
vähän         27           7.4–7.9
pois          54–60       14.4–15.7
```

"Vähän" on maltillinen parannus, koska `PerfTracker` on jo laskenut
määrän 219:stä 107–153:een kun laite on tukossa. Sen arvo on laitteessa
joka **ei** ole tukossa mutta jonka akkua käyttäjä säästää. "Pois" on se
iso vipu.

**Lämpökartan voimakkuus.** Kerroin alfakäyrään: 0.62 / 1 / 1.45. Kerroin
osuu myös käyrän **kattoon** (0.75) — pelkkä kertominen jättäisi kärjen
kiinni, eli "voimakas" nostaisi vain hiljaisen pään ja jättäisi juuri sen
kovan tuulen ennalleen jonka takia säätöä käytetään. Ylin 0.92 on
pakollinen: kertoimella 1.45 katto nousisi yli ykkösen ja alfa pakataan
tavuun. Mitattuna tummalla pohjalla nopeuserottelu 13.1 / 19.2 / 20.5 ja
rantaviivan ero 11.7 / 12.4 / 10.0 — **voimakas maksaa pohjakartan
näkyvyyttä**, mikä on säädön tarkoitus eikä vika.

### Mitä pitää päivittää yhdessä

Kartan ramppi on kolmessa taulussa ja kaikki kolme on rakennettava
uudestaan kun asetus vaihtuu:

- `ColorRamp.paivita()` — `_rgbLUT`, `_cssLUT`, `_cssAlphaLUT`. Taulut
  täytetään **paikalleen** eikä korvata uusilla, koska ne ovat
  const-sidoksia joihin sulkeumat viittaavat.
- `WindTexture._pikseliLUT = null` — lämpökartan 32-bittinen taulu, jossa
  on sekä väri että alfa.
- `rakennaNippuVarit()` — partikkelien nopeusluokkien värit.

Sen lisäksi `buildLegend()` (asetuspaneelin asteikko) ja
`updateHeatmapBlur()` (kirjoittaa sekoitustilan inline-tyyliin, ohittaa
CSS:n). `ColorRamp.ink()`-kuluttajia on 20 eikä yhtäkään tarvitse
päivittää: musteramppi ei muutu väriasteikkoasetuksesta.

Testattu 90 napautuksella 60 ms välein satunnaisessa järjestyksessä: ei
virheitä, ja lopputila on kaikilta osin yhtenäinen (sirut, localStorage,
laattaosoite, sekoitustila tokenissa ja inlinessä, LUTit, alfa).

## Yhden sormen zoom oli rikki — neljä eri vikaa

Tuplanapauta ja vedä pystysuunnassa (`_installDoubleTapZoom`) nytkähti niin
pahasti että ele oli käytännössä käyttökelvoton. Vikoja oli neljä, ja vain
yksi niistä oli se joka näkyi.

**Mittari.** Se maantieteellinen piste joka oli sormen alla tuplanapautuksen
hetkellä. Jos ankkuri on oikein, sen container-piste ei liiku eleen aikana
lainkaan. Jokainen pikseli jonka se liikkuu on kartan hyppy. Toinen luku on
suurin yhden ruudun siirtymä.

```
                       ankkurin liike     suurin ruutuhyppy
ennen (7 elettä)       0–245 px           0–211 px
jälkeen                0.0 px             0.0 px
```

### 1. Leafletin oma veto panoroi samaan aikaan

Tämä kaatoi eleen kokonaan ja se on tärkein havainto. Leafletin `Draggable`
kuuntelee `touchmove`a **dokumentista** (se lisää kuuntelijan `_onDown`issa),
ja tämä moduuli kuuntelee karttasäiliöstä. `preventDefault` ei estä toista
kuuntelijaa mitenkään — se ei ole `stopPropagation` — eikä
`stopImmediatePropagation` auttaisi, koska se pysäyttää vain **saman
elementin** myöhemmät kuuntelijat.

Mitattuna jokainen sormenliike tuotti kaksi kartan siirtoa peräkkäin:

```
move  →  map:drag   (Leaflet panoroi sormen mukana)
      →  map:zoom   (tämä moduuli asettaa keskipisteen absoluuttisesti)
```

Ne laskevat keskipisteen eri lähtökohdasta, joten kartta nytkähti joka
ruudussa. `map.dragging.disable()` eleen ajaksi on ainoa oikea korjaus;
Leaflet tekee saman `BoxZoom`issa. Palautus `enable()`llä on tehtävä
**jokaisella** poistumistiellä, myös `touchcancel`issa ja silloin kun toinen
sormi vie eleen nipistykselle — muuten karttaa ei voi enää panoroida
lainkaan ennen sivun uudelleenlatausta.

### 2. Ankkuri oli väärässä paikassa

Vanha versio laski siirtymän vain x-akselilla:

```js
var delta = L.point(dtz.startPt.x - dtz.centerPt.x, 0);   /* y aina 0 */
```

Napautettu piste päätyi siis kohtaan **(napautus.x, ruudun keskiY)**.
Ensimmäinen `_move` siirsi karttaa pystysuunnassa sen verran kuin napautus
oli keskikohdasta — ruudun yläosasta napautettaessa yli 200 px, ennen kuin
zoomia oli tapahtunut lainkaan. Oikea siirtymä on `startPt - centerPt`
molemmilla akseleilla. Johto:

```
containerPoint(L) = project(L,z) - pixelOrigin
pixelOrigin       = project(center,z) - size/2
center = unproject(project(L,z) - (startPt - centerPt))
  ⇒ containerPoint(L) = startPt
```

### 3. `zoomstart` ei syttynyt

`map._move()` lähettää vain `move`n ja `zoom`in. Ilman `_moveStart(true,
false)` -kutsua `zoomstart` jäi kokonaan lähettämättä, jolloin
`State.liikkeessa` oli epätosi koko eleen ajan — se ohjaa `IdwPainot`-muistia
ja suorituskyvyn vaihemittaria. Leafletin oma `TouchZoom` kutsuu
`_moveStart`ia täsmälleen samasta syystä ensimmäisellä liikkeellä.

### 4. Vapina näkyi nurkassa

Yhden sormen veto tarvitsee saman One Euro -suotimen kuin nipistys, vaikka
siinä ei olekaan nipistyksen skaalavipua. Mittari on ruudun nurkan liike —
zoomvirhe siirtää ankkurista etäisyydellä `r` olevaa pistettä määrän
`r*ln2*dz`, joten nurkka on herkin kohta. Suunnanvaihdot hitaassa vedossa
(200 px / 2 s):

```
sormen vapina    ennen        jälkeen
±0 px             0            0
±1,5 px          14            0
±3 px            40            2
```

Keskimääräinen nykäys putosi samalla 5.91 → 2.25 px (±1,5 px vapinalla).
Hinta on 6.2 px nurkassa sillä hetkellä kun sormi pysähtyy, ja se kuroutuu
0.2 px:ään 300 ms:ssä. **Ankkuri ei kärsi lainkaan**: suodin vaikuttaa vain
zoomin nopeuteen, ei siihen mihin ankkuri kiinnittyy.

Suodin nostettiin nipistyksen IIFE:stä ulos (`OneEuro`, `Alipaasto` ja
vakiot ovat nyt moduulitasolla), koska kaksi kopiota olisi tarkoittanut
kahta viritystä jotka erkanevat toisistaan. Suodatettava suure on sormen y
ruudulla — samat yksiköt ja sama dynamiikka kuin nipistyksessä.

### Sivulöydökset

- **`setZoomAround` on rajattava ennen kutsua, ei sen sisällä.** Se laskee
  uuden keskipisteen *pyydetyn* zoomin skaalalla ja vasta sitten `setView`
  rajaa zoomin. Maksimizoomissa se antoi kertoimen 2 mukaisen
  keskipistesiirtymän mutta zoomia ei tullut: kartta panoroi **61 px** ilman
  että mitään zoomattiin. Korjaus on `map._limitZoom(startZoom + 1)` ennen
  kutsua ja koko kutsun ohittaminen jos tulos on sama.
- **Napautus ja veto on erotettava kynnyksellä, ei jälkikäteen.** Vanha
  versio zoomasi jo ensimmäisestä liikkeestä mutta päätti vasta
  `touchend`issä oliko kyse napautuksesta (pystymatka < 10 px) — eli lyhyt
  veto ensin zoomasi vähän ja sitten hyppäsi kokonaisen tason. Nyt 8 px:n
  kynnys ratkaisee molemmat. **Kynnysvertailu tehdään raa'alla sijainnilla
  ja zoom suodatetulla**: toisin päin suotimen alkuvaimennus siirtäisi
  kynnyksen ylitystä ajassa eteenpäin ja ele tuntuisi tahmealta lähtiessään.
- **`State._dragZooming` oli kuollut.** Sitä luettiin `moveend`in ja
  `zoomend`in alussa paluuehtona mutta ei asetettu todeksi missään. Kaksi
  vartijaa jotka lupasivat ohittaa lämpökartan ja spottien uudelleenpiirron
  tuplanapautuszoomin ajaksi — mutta juuri se piirto on eleen lopussa
  tehtävä. Poistettu; käytös ei muuttunut, koska lippu oli aina epätosi.
- **Toisen sormen laskeutuessa EI saa kutsua `nipistysPaattyy`ta.**
  `TouchZoom`in oma `_onTouchStart` on rekisteröity kartan luonnissa eli
  ennen tätä moduulia, ja se on jo ehtinyt kutsua `nipistysAlkaa`. Lopetus
  nollaisi juuri sytytetyn lipun ja veisi alipikselitarkkuuden koko
  nipistykseltä. Siksi purku on kahtena funktiona: `siivoa(lopetaNipistys)`
  ja sen päällä `paataEle`.
- **Kesken oleva zoom-animaatio viedään loppuun eikä eleestä luovuta.**
  Leafletin `TouchZoom` kieltäytyy kun `_animatingZoom` on päällä, mutta
  täällä se tarkoittaisi että nopea "zoomaa sisään, zoomaa lisää" -sarja
  tiputtaa joka toisen eleen 250 ms:n ikkunassa. `map._onZoomTransitionEnd()`
  on suojattu omalla lipullaan, joten kutsu on turvallinen.
- **Vartija kadonneen `touchend`in varalta.** Yhden sormen `touchstart`
  kesken oman eleen tarkoittaa että edellinen ele ei saanut `touchend`iä —
  käytännössä siksi että kohde-elementti ehti poistua DOMista (`renderSpots`
  luo spottimerkit uusiksi, ja tuplanapautus voi osua juuri merkkiin). Ilman
  vartijaa `dragging` jäisi pysyvästi pois päältä. Mitattuna Chromium ohjaa
  tapahtuman irronneen solmun sijaan lähimpään kiinni olevaan esi-isään,
  joten tätä ei nykyselaimessa laukea — vartija on siltä varalta ettei niin
  ole.

### Testaamisen sudenkuoppa

**CDP:n `Input.dispatchTouchEvent` ei kelpaa peräkkäisiin eleisiin.**
Ensimmäinen mittausajo näytti että ele toimii vain ruudun alaosassa ja
panoroi muualla. Vika oli mittarissa: eleiden välille jäi tilaa ja
**toinen `touchstart` katosi kokonaan**, jolloin sarjan seuraavat eleet
mittasivat Leafletin tavallista panorointia. Sama ele yksinään ajettuna
toimi joka kerta.

Ratkaisu on luoda `TouchEvent`it sivulla itse (`new Touch(...)` +
`new TouchEvent(...)` + `dispatchEvent` karttasäiliöön). Ne kuplivat
dokumenttiin asti, joten Leafletin oma vetokäsittelijä näkee ne samalla
tavalla kuin oikeat — juuri sitä yhteispeliä tässä testataan. Ainoa asia
joka ei ole uskollinen on selaimen natiivi vieritys, eikä sillä ole tässä
merkitystä.

## Säädata koko maailmalle

Kartta toimi Suomessa mutta ei kunnolla muualla, ja ulos zoomatessa se
lakkasi hakemasta dataa kokonaan. Vikoja oli neljä eri kerroksessa, ja ne
löytyivät vasta kun jokainen mitattiin erikseen.

### 1. Proxy heitti pois valmiin datan HARMONIEn hilan ulkopuolella

`api/harmonie.js` hakee FMI:n HARMONIEn ja Open-Meteon **rinnakkain**.
Jos HARMONIE-haku epäonnistui, Open-Meteo palautettiin — mutta ehto oli
`xmlResult.value.length < 500`.

Hilan ulkopuolella FMI ei kaadu vaan palauttaa **noin 800 tavun
ExceptionReportin**, eli ohi sen rajan. Silloin mentiin parsintaan, sieltä
ulos `{ error: 'no wind data' }`, ja rinnakkain jo haettu Open-Meteon
vastaus katosi. Koko muu maailma sai virheen vaikka data oli kädessä.

Korjaus on `_omVastaus()`, jota kutsutaan **molemmista** haaroista.

### 2. HARMONIEn hila on mitattu, ei arvattu

FMI:n WFS:ää kysyttiin 5° hilassa lat 40–80 / lng −30…50 ja tarkennettiin
reunoilta. Osumat: **lat 50–75, lng −15…50**. Kyseessä on käännetyn navan
laatikko, joten se on vino — Berliini ja Nordkapp ovat sisällä, Pariisi,
Skotlanti ja Kroatia eivät.

`HARMONIE_ALUE` on sen ympäröivä suorakaide marginaalilla (47–78 / −20…55).
**Laatikko on tarkoituksella reilu**: sisällä oleminen maksaa yhden turhan
yrityksen jonka proxy hoitaa, mutta liian pieni laatikko veisi FMI:n
2,5 km hilan sieltä missä se on paras.

> Kohdat 1 ja 2 on pakko tehdä yhdessä. Pelkkä proxyn korjaus saisi
> HARMONIE-polun *onnistumaan* koko maailmassa, jolloin kaikki latautuisi
> `/api/harmonien` kautta 15 pisteen erissä — Open-Meteon oma eräosoite
> ottaa 80 pistettä yhdellä pyynnöllä.

### 3. Ulos zoomaaminen ei hakenut mitään

`_viewportMovedEnough` katsoi vain keskipisteen siirtymää suhteessa
**uuteen** näkymään. Helsingistä z9 → Suomi z5: keskipiste liikkui 3,9°
mutta uuden näkymän korkeus oli 30°, joten kynnys 0,22 vaati 6,6°. Haku
jäi tekemättä. Ruudulla oli z9:n kourallinen pisteitä keskellä ja muualla
ei mitään — joka ikinen kerta kun karttaa veti kauemmas.

Kaksi uutta ehtoa vanhan rinnalle:

1. **Hilaväli vaihtui** — pisteet ovat eri paikoissa eivätkä vanhat kelpaa.
2. **Näkymä ei mahdu edelliseen haettuun alueeseen** (näkymä + 2 × hilaväli,
   ks. `getViewportPoints`). Yksi zoom-askel ulos mahtuu pehmusteeseen eikä
   laukaise turhaa hakua; kaksi ei mahdu.

Turhat laukaisut ovat halpoja: `loadViewport` palaa heti jos jokainen piste
on jo muistissa.

### 4. Katon harvennus vääristi hilan suorakaiteeksi

`getViewportPoints` rajasi 600 pisteeseen suodattamalla `i % every === 0`
rivijärjestyksessä olevasta listasta. Kun leveyssuunnassa oli 72 saraketta
ja `every` oli 4, se pudotti kolme neljäsosaa **sarakkeista** mutta ei
yhtään riviä: koko maailman hila oli 5° pystyssä ja 20° vaakasuunnassa.
Ja `gridStep` — jolla IDW:n tukisäde mitoitetaan — luuli väliä yhä
viideksi asteeksi.

Nyt hilaväliä **kasvatetaan** kunnes lista mahtuu kattoon, ja käytetty väli
jää talteen (`_viimeStep`). Tukisäde luetaan `kaytettyStep()`:llä, joka on
`max(gridStep(zoom), _viimeStep)` — zoomatessa sisään haku on hetken
velkaa, ja silloin on turvallisempaa ylimitoittaa säde kuin alimitoittaa.
Ylimitoitus pehmentää, alimitoitus rikkoo (ks. *Lämpökartta jäi väärään
mittakaavaan*).

### Mitattu lopputulos

Pyyntömäärät synteettisellä säädatalla, jotta luvut ovat toistettavia:

```
näkymä              OM-pyyntöjä   HARMONIE-pyyntöjä   ilman tukipistettä
Helsinki      z9       1                5                  0/121
Sydney        z9       2                1                  0/121
New York      z9       2                1                  0/121
Kap Hoorn     z7       3                1                  0/121
Keski-Atl.    z5       7                1                  0/121
Tyynimeri     z4      12                1                  0/121
koko maailma  z2       9                1                  0/121
```

Jokaisessa näkymässä **0/121 näytettä jäi ilman tukipistettä** — eli
interpolointi ei putoa varatielle missään zoomissa maapallolla.
Ulos zoomatessa Helsingistä z9 → z2 haku laukeaa nyt joka askeleella
(paitsi z9 → z8, jossa hila ei muutu ja näkymä mahtuu pehmusteeseen) ja
kenttä kasvaa 61 → 1282 pisteeseen.

### Tehokkuus: kolme erillistä sääntöä

- **Alue** (`HARMONIE_ALUE`): hilan ulkopuolella ei yritetä FMI:tä.
- **Tiheys** (`HARMONIE_MAX_STEP = 1.0`): HARMONIEn koko etu on 2,5 km hila.
  Kun karttahila on 2,5 **astetta** eli noin 280 km, siitä ei näy mitään.
  Mitattuna Helsingistä z5:een zoomatessa 123 pistettä meni FMI:lle
  yhdeksänä pyyntönä; samat pisteet ovat Open-Meteolta kaksi. Raja pitää
  FMI:n kaikissa näkymissä joissa Suomi täyttää ruudun tai enemmän.
- **Erien lajittelu**: pisteet syntyvät riveittäin, joten koko maailman
  näkymässä yhdessä 80 pisteen erässä on yhden leveyspiirin pisteitä
  laidasta laitaan. Yksikin pohjoiseurooppalainen piste vei ennen koko
  erän HARMONIE-polulle, joka pilkkoo sen vielä kuuteen 15 pisteen
  pyyntöön — mitattuna 80 pistettä lähti FMI:lle vaikka niistä vain
  neljätoista oli sen hilalla. Nyt erät ovat homogeenisia.

Yhteensä nämä veivät HARMONIE-pyynnöt 74 → 32 ja pisteet 865 → 302 samalla
yhdeksän näkymän sarjalla.

**Vastapaino: karkealla haettu piste päivitetään FMI:llä kun hila tihenee.**
Ilman sitä Suomen hila rapautuisi Open-Meteoksi pala kerrallaan joka kerta
kun karttaa vetää kauas ja takaisin — piste oli jo olemassa, joten sitä ei
haettaisi uudestaan koskaan. Mitattuna kylmältä z3 → z9 hakee 49 pistettä
FMI:ltä ja näkymän pisteet ovat sen jälkeen FMI 49 / Open-Meteo 0.

### Globaali karkea hila heräsi kuolleista

`loadGlobalCoarse` (240 pistettä 15° hilassa, yksi vuorokausi, ~27 kt,
localStoragessa 3 h) oli **kuollutta koodia**: sen ainoa kutsupaikka oli
mallivalitsimessa, eikä käynnistys ole koskaan kutsunut sitä. Nyt se
ajetaan kun näkymä on z5 tai kauempana. Se ehtii ruudulle selvästi ennen
näkymän omaa hakua (jopa 12 pyyntöä × 16 vrk), joten maailmankartta ei ole
tyhjä sillä aikaa kun raskas haku on kesken.

Kattavuus laajennettiin samalla −55…70 → **−60…75**: vanha yläraja jätti
pohjoisimman rivin 65:een, jolloin Pohjois-Norja ja Alaska jäivät
tukipisteiden ulkopuolelle.

## Lähdemerkintä ja aina automaattinen malli

Mallivalitsin (FMI / Auto / ICON / ECMWF / GFS) **poistettiin**. Se oli
ansa: "FMI" kiinnitti koko kartan HARMONIEen *ilman varatietä*
(`fmi_harmonie -> HARMONIE, ei fallbackia`), ja sen hila loppuu
Pohjois-Euroopan reunaan — muualla maailmassa kartta jäi silloin tyhjäksi
eikä mikään kertonut miksi. Vanha `fs_model` siivotaan localStoragesta,
jottei aiemmin FMI:hin kiinnitetty laite jää siihen tilaan.

Reitityskoodi `loadBatch`issa tuntee mallit edelleen, joten valitsin on
helppo palauttaa — mutta silloin FMI-vaihtoehto tarvitsee varatien.

Tilalle tuli **lähdemerkintä**: pieni läpikuultava teksti kartan
alalaidassa vasemmalla, joka kertoo mikä ennuste on tähtäimen alla.

Kolme asiaa jotka eivät ole ilmeisiä:

- **Merkintä seuraa myös aikajanaa, ei vain sijaintia.** Proxy antaa
  HARMONIElta noin 48 h ja jatkaa siitä Open-Meteolla samaan taulukkoon;
  `harmonie_hours` kertoo montako ensimmäistä tuntia on FMI:n omaa. Kun
  aikajanaa vetää sen ohi, merkintä vaihtuu Open-Meteoksi vaikka paikka on
  Suomessa.
- **Etäisyysraja on pakollinen.** Ilman sitä merkintä valehteli pahasti:
  kun näkymän lataus epäonnistui Sydneyn kohdalla, ainoat pisteet joilla
  oli dataa olivat suomalaiset spotit — ja merkintä ilmoitti Australiassa
  lähteeksi FMI HARMONIEn, 16 000 km päästä. Raja on `3 × käytetty
  hilaväli` (sama tukisäde jolla `idw()` interpoloi) ja vähintään 8°.
- **Sijainti mitattiin, ei arvattu.** Ensimmäinen sijoitus 104 px pohjasta
  jäi aikajanan hetkikuplan ("Ma 11:00") alle — kupla on
  `#tl-indicator`in pseudoelementti eikä siksi näy elementin mitoissa.
  126 px jättää siihen 14 px raon; `#rl-banner` nostettiin 172:een.

Merkintä on **kartan maailmaa eikä paneelia**: valkoinen läpikuultava
(`--kartta-teksti`), ja vaalealla pohjakartalla se kääntyy mustaksi samalla
tavalla kuin tilapalkin tummennus. `pointer-events: none` — se on lukema,
ei nappi.

`lahinEnnustepiste()` nostettiin `Crosshair._puuskan` sisältä omaksi
funktiokseen ja muistettiin yhdelle kutsukierrokselle: tähtäin kysyy sitä
nyt kahdesti (puuska ja lähde) samalla keskipisteellä, ja `getAllPoints`
on viewportissa satoja pisteitä.

## Lämpökartan värit olivat eri kohdissa eri zoomeilla

Kolme erillistä vikaa, kaikki AJASSA eikä paikassa. Kaksi niistä syntyi
edellisessä muutoksessa. Yhdessä ne tekivät juuri sen mitä käyttäjä
kuvasi: kaukaa katsottuna värit olivat eri paikoissa kuin läheltä.

### Mittari ensin: maailma jonka vastauksen tiedämme

Kahdella ensimmäisellä mittarilla ei saanut mitään irti, ja kummankin
epäonnistuminen kannattaa muistaa:

1. **Naiivi zoomvertailu naytteisti tekstuurin ULKOPUOLELTA.**
   `WindTexture` kattaa vain näkymän + pehmusteen, ja sen ulkopuolella
   `sampleWind` palauttaa reuna-arvon. Ensimmäinen versio naytteisti
   16 × 32 asteen alueen myös z9:stä, jonka tekstuuri on noin asteen
   korkea — 90 % näytteistä oli reunapuuroa.
2. **Kiinteä odotusaika mittasi puoliksi ladattua kenttää.** Sama näkymä
   antoi peräkkäisillä ajoilla keskiarvot 3.06 / 4.28 / 3.14 m/s. Mittari
   oli epävakaampi kuin ilmiö. Nyt odotetaan kunnes pistemäärä lakkaa
   kasvamasta.

Ratkaisu oli korvata säädata **analyyttisellä kentällä**:

```
ms = 9 + 5*sin(lat/12)*cos((lng - 1.5*t)/15)
```

Sileä (aallonpituus ~25°, jonka 10 asteen hilakin esittää hyvin) ja
**vaeltava** — kuvio liikkuu 1,5 astetta tunnissa kuten oikeat
matalapaineet. Vaeltavuus on olennaista: spatiaalisesti vakio aikatermi
lisää saman luvun joka pisteeseen ja **kumoutuu interpoloinnissa**, joten
se ei paljasta pistekohtaista aikavirhettä. Vaeltava aalto muuttaa
aikavirheen näkyväksi paikkavirheeksi.

Nyt mitataan ero TOTUUTEEN, ei kahden zoomin eroa toisiinsa — silloin
tiedetään kumpi on väärässä.

### Vika 1: `timezone=auto` antoi joka pisteelle oman kellon

Open-Meteo palauttaa `timezone=auto` -pyynnöllä jokaisen pisteen ajat SEN
OMASSA vyöhykkeessä — **mutta merkkijonoissa ei ole vyöhykettä mukana.**
Mitattuna rivillä lat 60 pitkin maapalloa:

```
lng   25    tz Europe/Helsinki   offset +10800 s   time[0]=2026-08-24T00:00
lng    0    tz Etc/GMT           offset      0 s   time[0]=2026-08-24T00:00
lng  -60    tz Etc/GMT+4         offset -14400 s   time[0]=2026-08-24T00:00
lng -120    tz America/Edmonton  offset -21600 s   time[0]=2026-08-24T00:00
lng  150    tz Asia/Magadan      offset +39600 s   time[0]=2026-08-24T00:00
```

Sama merkkijono, **17 tunnin haitari**. `_ts()` tekee
`new Date(h.time[i])`, ja ilman vyöhykettä selain tulkitsee sen omaksi
paikallisajakseen — eli jokainen piste sai oman aikavirheensä ja
`buildWindField` poimi eri tunnin eri pisteistä.

**Miksi se näkyi vain kaukaa.** Lähellä zoomattuna kaikki pisteet ovat
samassa vyöhykkeessä ja virhe on tasainen, joten kuva näyttää ehjältä.
Kaukaa näkymä ylittää vyöhykerajoja ja kenttä hajoaa.

Korjaus: kaikki pyydetään **selaimen omassa vyöhykkeessä** (`AIKAVYOHYKE`,
`TZ_PARAM`). Silloin jokainen merkkijono tarkoittaa samaa hetkeä,
`new Date()` osuu oikeaan, eikä yksikään näyttökohta muutu — ne olettavat
jo paikallisaikaa. Open-Meteo hyväksyy minkä tahansa IANA-vyöhykkeen ja
hylkää roskan selkeästi (`Invalid timezone`), joten arvo varmistetaan
Intl:llä; varatie on `Europe/Helsinki` eikä `auto`, koska **yksi yhteinen
akseli on tärkeämpää kuin oikea vyöhyke**.

Sama koski `api/harmonie.js`:ää: se muotoili aina Suomen aikaan käsin
kirjoitetulla kesäaikasäännöllä ja haki Open-Meteon jatkon
`timezone=auto`lla. Nyt se ottaa `tz`-parametrin ja käyttää sitä
molempiin; `Intl` hoitaa kesäajan.

Mitattuna tunnetulla kentällä, keskivirhe m/s:

```
                 z9     z7     z5     z3     z2
Tyynimeri ennen  0.14   0.57   1.78   2.42   1.99
Tyynimeri jälkeen 0.00  0.01   0.06   0.20   0.72
```

Suurin yksittäinen virhe **5.39 → 0.64 m/s**. Suomessa luvut eivät muutu
(0.04 → 0.04), koska Suomi on yksi vyöhyke — juuri siksi vika ei näkynyt
kotona.

### Vika 2: näkymän pisteet saivat yhden vuorokauden kuudentoista sijaan

`loadBatch`issa luki `foreD = forecastDays || (forceOM ? 1 : 16)`. Kun
HARMONIEn hilan ulkopuoliset erät alettiin lähettää `forceOM`-lipulla (ks.
*Säädata koko maailmalle*), ne saivat yhden vuorokauden — näkymän lataus
antaa `forecastDays`iksi `undefined`.

Mitattuna aikasarjojen pituudet:

```
                     ennen        jälkeen
FMI-pisteet          372 h        372 h
Open-Meteo-pisteet    72 h        432 h
aikajana Sydneyssä    72 h        372 h
```

Eli **koko aikajana kutistui kolmeen vuorokauteen** heti kun kartta vietiin
Pohjois-Euroopan ulkopuolelle. Nyt `forceOM` tarkoittaa täsmälleen yhtä
asiaa: ohita HARMONIE. Vuorokausimäärät tulevat parametreista.

### Vika 3: liian lyhyt sarja tarjosi viimeistä tuntiaan

`buildWindField`in aikahaku kiinnittää hetken sarjan päihin
(`targetTime >= viimeinen` → `a = b = viimeinen`). Se on oikein kun ollaan
tunnin murto-osan verran yli, mutta väärin kun piste **ei ulotu sinne
asti**: silloin se työntää kenttään oman viimeisen tuntinsa ikään kuin se
olisi pyydetty hetki.

Näin kävi globaalille karkealle hilalle, jossa on tarkoituksella vain yksi
vuorokausi. Aikajanan vedettyä +72 h se tarjosi yhä eilistä dataa, ja koska
sen pisteet ovat 15 asteen välein koko maapallolla, ne sekoittuivat
näkymän omiin tuoreisiin pisteisiin:

```
Suomenlahti +72 h    z9     z5     z3     z2
ennen               0.03   0.68   3.77   3.95   (max 8.64)
jälkeen             0.03   0.24   0.32   0.75   (max 2.21)
```

Korjaus on yleinen eikä koske vain globaalia hilaa: **piste joka ei kata
pyydettyä hetkeä jätetään pois kentästä.** Tunnin toleranssi, koska sarjat
ovat tasatunneittain ja `targetTime` on tuntien välissä.

### Mitä jää jäljelle

Tunnetulla kentällä keskivirhe on z9 **0.00–0.04**, z7 0.01–0.09,
z5 0.05–0.36, z3 0.18–0.45 ja z2 0.70–0.73 m/s. z2:n virhe on 10 asteen
hilan aliotanta eikä vika — se on sama sileneminen jonka silmä lukee
pehmeytenä, ei siirtymänä.

Oikealla säädatalla samat koordinaatit z9:stä ja z6:sta: keskiero
**0.22 m/s, korrelaatio 0.89, nolla prosenttia yli 1,5 m/s**. Laajemmilla
pareilla ero kasvaa (z6 vs z2: 1.37 m/s, r 0.67) ja keskiarvo laskee
(4.86 → 3.64) — juuri niin kuin keskiarvoistaminen tekee huipukkaalle
kentälle.

**Jos tähän palaa: mittaa totuutta vastaan, älä zoomia toista vastaan.**
Kahden zoomin ero sekoittaa aliotannan ja virheen toisiinsa, eikä kerro
kumpi on väärässä.

## Uloin näkymä — 44 % roskaa, kymmenen texelin sumennus

Käyttäjä huomasi kaksi asiaa: uloin zoomtaso "ei näytä oikealta", ja
kerran tuli vastaan ilmoitus API-rajojen täyttymisestä. Molemmat olivat
todellisia, ja niillä oli **kolme erillistä syytä**. Kaksi niistä
vaikuttivat kumpaankin oireeseen yhtä aikaa, mikä on syy siihen miksi ne
kannattaa lukea yhdessä.

### 1. Lähes puolet pyydetyistä koordinaateista oli kelvottomia

Leafletin `worldCopyJump` sallii kartan kelata maapallon ympäri, joten
`map.getBounds()` ei pysy välillä −180…180. Yhdessä mitatussa z2-näkymässä
rajat olivat **lng −238…−101**. Ne pisteet ovat aitoja *geometriana* —
tekstuuri kattaa juuri sen alueen ja interpolointi tarvitsee pisteet
siellä — mutta Open-Meteolle `longitude=-238` on virhe.

Mitattuna yhdessä uloimmassa näkymässä **144 pistettä 324:stä eli 44 %**
lähti roskana. Ne kuluttivat pyyntökiintiön mutta eivät palauttaneet mitään
— eli kartta jäi harvaksi *ja* API rasittui, samasta viasta.

Korjaus: `kaarraLng()` kääntää pituuspiirin takaisin väliin, ja kääntö
tehdään **vasta osoitetta rakennettaessa** (`buildBatchUrl`,
`buildHarmonieUrls`). Sovellus pitää oman geometriansa, API saa kelvolliset
luvut. Sama piste voi silloin esiintyä näkymässä kahdesti (lng −240 ja
+120), joten `loadViewport` kopioi jo haetun datan kaartokopiolle ennen
erien kokoamista — **antimeridiaanin ylittävä näkymä maksaa nyt yhden
pyynnön viiden sijaan**.

Samalla lisättiin napojen ohitus: `Math.floor(s / step) * step` menee
rajauksen alapuolelle, ja 10 asteen hilalla −85 pyöristyy −90:een. Tarkistus
on **silmukan sisällä eikä alkuarvossa**, jotta hila pysyy samassa
lattiassa ja vieritys osuu jo haettuihin pisteisiin.

### 2. Sumennus oli zoomin funktio, vaikka se toimii texeleissä

`updateHeatmapBlur` laski `22 - (z-2) * 2.2` pikseliä. Se on zoomin
funktio, mutta se *mitä sumennus tekee* riippuu siitä kuinka isona yksi
`WindTexture`n texel ruudulla näkyy — eikä se seuraa zoomia, koska
tekstuurin koko (`maxDim`) ja sen kattama alue (`vPad`) muuttuvat
portaittain.

Mitattuna sumennus texeleinä:

```
        z9    z7    z5    z4    z3    z2
ennen   1.7   2.8   9.4   7.4   8.7   9.9
jälkeen 1.8   2.2   2.1   2.0   1.8   2.2
```

Läheltä katsottuna sumennus oli kahden hilaruudun luokkaa ja näytti
oikealta. Kaukaa kenttää sumennettiin **lähes kymmenen hilaruudun yli**, eli
koko maapallo puuroutui yhdeksi tasaiseksi vihreäksi. Juuri se on se "ei
näytä oikealta".

Nyt tavoitellaan 2 texeliä joka zoomissa: se peittää interpolointihilan
portaat mutta ei syö kentän rakennetta. Rajat 3…22 px ovat paikallaan
poikkeustilanteita varten (tekstuuri voi olla tyhjä ensimmäisellä
kutsulla), ja vanha käyrä on yhä varatienä siihen asti kunnes tekstuuri on
olemassa.

### 3. Novelli ratkaisu: aika-askel sovitetaan hilaväliin

Tässä on se kohta jossa tarkkuutta saa **ilman että API rasittuu**.

Matalapaine liikkuu noin 1,5 astetta tunnissa. Kun näkymän hila on
10 astetta, kuvio ehtii kuudessa tunnissa liikkua tasan yhden hilavälin —
eli tunneittainen data sisältää muutosta, jota hila **ei fysikaalisesti
voi esittää**. Se ei ole tarkkuutta, se on tavuja. Näytteenottoteoreema
paikkaulottuvuudessa, sovellettuna aikaan.

Sääntö on siksi `aika-askel ≤ hilaväli / 1,5 °/h`, pyöristettynä
Open-Meteon tarjoamiin arvoihin. `aikaAskelParam()` antaa `hourly_3` kun
hila on 1,5…4,5° ja `hourly_6` sitä leveämmällä; alle 1,5° hilalla
(spotit, lähizoomit) mitään ei muuteta.

Mitattuna yhdellä pisteellä, 16 + 2 vrk:

```
                arvoja   tavuja
hourly (ennen)     432     5687
hourly_3           144     2356
hourly_6            72     1438
```

**Aikaväli ei lyhene.** Aikajanaa voi yhä vetää koko 16 vuorokauden yli —
vain turha tiheys jää pois. Tämä on olennaista: sama säästö olisi saatu
lyhentämällä `forecast_days`ia, mutta se olisi rikkonut aikajanan (ks.
*Lämpökartan värit* → vika 2, jossa juuri niin kävi vahingossa).

Hinta mitattiin tunnettua kenttää vasten: **0.04–0.07 m/s**, kun saman
näkymän spatiaalinen aliotantavirhe on 0.2–0.9 m/s. Eli aika-askel on
suuruusluokkaa pienempi virhelähde kuin se hila johon se sovitetaan —
juuri niin kuin pitääkin.

### Yhteisvaikutus

Viiden näkymän kierros (Suomi z6, uloin z2 kolmesta eri pituuspiiristä,
Atlantti z4):

```
                    ennen    jälkeen
API-paino           57009     39567   (−31 %)
pyyntöjä               24        18
pisteitä             1286       963
kelvottomia koord.    144         0
```

Ja tarkkuus tunnettua kenttää vasten säilyi: z9 0.00–0.04, z5 0.06–0.36,
z3 0.24–0.49, z2 0.80–0.86 m/s. z2:n luku on 10 asteen hilan aliotanta
eikä vika.

### Lähdemerkintä siirtyi aikajanan alle

Merkinnän paikka kiersi kolme kertaa, ja jokainen kierros kertoo jotain:

1. **104 px pohjasta** jäi aikajanan hetkikuplan ("Ma 11:00") alle. Kupla
   on `#tl-indicator`in pseudoelementti eikä siksi näy elementin mitoissa
   — sitä ei löydä muuten kuin katsomalla.
2. **126 px** oli kuplan yläpuolella mutta kartan päällä, ja se pakotti
   `#rl-banner`in ylemmäs. Merkintä alkoi työntää muuta kalustoa.
3. **Aikajanan sirun alapuolella** on rako joka on jo olemassa: siru
   päättyy `--sab-tl + 8px` pohjasta, joten alle jää selaimessa 8 px ja
   kotivalikon appissa 22 px. Mitään ei tarvitse siirtää, ja `#rl-banner`
   palasi omalle paikalleen 148:aan.

Fontti on **8 px ja line-height 1**, koska rako on selaimessa tasan 8 px.
Se on tarkoituksella pienempi kuin mikään muu teksti sovelluksessa — lukema
jota vilkaistaan, ei luetaan. `bottom: 0` + `padding-bottom` eikä
`bottom: calc(...)`, jotta merkintä ei koskaan valu turva-alueen alle
laitteella jolla `--sab-tl` on pieni.

## Havaintoasemien kortit — mitä FMI antaa ja mitä siitä näytettiin

Käyttäjä kysyi miksi Vuosaaren asemalla ei näy kartalla dataa. Vastaus ei
ollut koodissa vaan asemassa — mutta koodi teki siitä kolme eri vikaa.

### Vuosaari: asema on hiljaa, eikä sitä sanottu

FMISID **151028 (Helsinki Vuosaari satama)** lakkasi lähettämästä
**18.8.2026 klo 10:00 UTC**. Mitattuna kahden vuorokauden ikkunoissa:

```
1.–3.8.    98 riviä, kaikki kelvollisia
10.–12.8.  98 riviä, kaikki kelvollisia
17.–19.8.  98 riviä, 70 kelvollista   ← katko alkaa 18.8. klo 11
20.–22.8.   0 riviä
22.–24.8.   0 riviä
```

Asema on FMI:n rekisterissä yhä auki (`Automaattinen sääasema`), joten
kyseessä on anturikatko eikä lakkautus. Lähin **toimiva** tuuliasema on
Sipoo Itätoukki 12,0 km päässä; Vuosaaren satamassa ei ole toista
tuulihavaintoa (0,1 km:n päässä oleva 104089 on kolmannen osapuolen
ilmanlaatuasema eikä vastaa säähakuun lainkaan).

Mitä sovellus teki väärin:

- **Kartalla** merkki oli mykkä. `_fmiLoadWithFallback` kutsuttiin yhden
  aseman listalla, joten varatietä ei ollut, ja epäonnistuminen jätti
  pillerin tyhjäksi. Tyhjä pilleri näyttää samalta kuin lataamaton — ei
  voinut päätellä oliko vika asemassa, verkossa vai sovelluksessa.
- **Kortissa** sijaisuus tehtiin **hiljaa**. Otsikossa luki "Helsinki
  Vuosaari satama", herossa Itätoukin lukema, ja ainoa vihje oli
  8 px harmaa rivi kaavion alla jossa luki toisen aseman nimi. Se on
  pahempi kuin tyhjä kortti: se on väärä vastaus oikean näköisenä.
- **Historiaikkuna oli 24 h**, joten Vuosaaren omaa dataa ei löytynyt
  vaikka sitä on. 168 tunnin ikkunalla se löytyy — ja siinä on koko juttu:
  aseman viimeiset tunnit ovat yhä katsomisen arvoisia.

Korjaus on kolmiosainen:

1. **API kertoo iän.** `ageMin` ja `lastIso` sekä uusimmassa havainnossa
   että historiassa. Ilman sitä käyttöliittymä ei voi erottaa "hiljainen
   asema" -tilaa "asemaa ei ole" -tilasta.
2. **Kartan merkki kertoo tilansa**: katkoviiva, himmennys ja teksti
   "ei signaalia" pillerin lukeman tilalla (`_pilleri(..., hiljainen)`).
   Merkki jää kartalle, koska asema on oikeasti olemassa.
3. **Kortti näyttää aina sen aseman jota napautettiin.** Sijaisuus tulee
   vasta jos omalla asemalla ei ole dataa lainkaan seitsemään
   vuorokauteen — ja silloin otsikkokin vaihtuu. Hiljaisen aseman kortti
   näyttää oman datansa vanhana (hero 45 % peitteellä), sanoo milloin se
   päättyi, ja tarjoaa yhden painalluksen päässä lähimmän **tuoreen**
   aseman ("Nyt lähistöllä · Sipoo Itätoukki 12 km · 6.8 m/s").

`fetchMaritime`in bbox-varatie **poistettiin historiapolusta**: se olisi
palauttanut toisen aseman datan tämän aseman nimellä, eli tehnyt
palvelimella juuri sen minkä käyttöliittymästä poistettiin. Sijainen
valitaan nyt siellä missä se voidaan myös sanoa.

### Mitä FMI oikeasti antaa

Kaikki mitattu opendata.fmi.fi:stä, asema 105392:

| | timevaluepair | multipointcoverage |
|---|---|---|
| 7 vrk / 10 min / 3 parametria | 993 kt | **84 kt** |
| sama + lämpötila | — | 89,5 kt (gzip 11,9 kt) |

**Kaksitoistakertainen ero**, ja syy on formaatti: timevaluepair kirjoittaa
jokaisen arvon omaan `<wml2:point><wml2:MeasurementTVP>`-rakenteeseensa,
multipointcoverage on kaksi tekstiblokkia — aikaleimat ja luvut riveittäin.

Kaksi rajaa jotka kannattaa muistaa:

- **Aikaikkunan katto on 7 vrk.** 168 h menee läpi, 192 h vastaa
  `Too long time interval requested!`. Siksi kortin pisin jakso on 7 vrk
  eikä jokin pyöreämpi luku.
- **`timestep` on validoitu.** `timestep=180` palauttaa nolla riviä
  hiljaa, ei virhettä — sillä meni ensimmäinen "onko asema ollut hiljaa
  aiemminkin" -mittaus pieleen, kunnes sama ikkuna arvolla 60 antoi täyden
  datan.

**Suunta ja lämpötila olivat aina saatavilla** samalla 10 minuutin
tiheydellä; niitä ei vain pyydetty. Siksi kaavion tooltipin
suuntanuoli oli kuollutta koodia — `p.d` oli aina `null`.

Nyt `history=1` ottaa `hours`-parametrin (1…168, oletus 24) ja palauttaa
`ws` (suunnalla), `wg`, `ta` sekä `ageMin`. Kortti pyytää 168 h,
karttamerkit 24 h — merkit tarvitsevat historian vain aikajanan
liu'utukseen. Käynnistys **halpeni** silti, koska sama 24 h tulee nyt
kompaktissa muodossa: 25 kt (gzip 2,9 kt) aiemman 151 kt XML:n sijaan.

`api/kruunuvuori.js` sai saman `hours`-parametrin (oletus 30, katto 336).
Sen CSV kattaa noin 14 vrk kymmenen minuutin välein — dataa oli koko ajan,
sitä vain leikattiin 30 tuntiin siltä ajalta kun kortti näytti korkeintaan
vuorokauden.

### Kaavio: neljä suuretta, yksi akseli

**Suunta ei ole toinen y-akseli.** Asteet ja metrit sekunnissa eivät mahdu
samalle akselille ilman että kahden asteikon kohdistus keksitään, ja
keksitty kohdistus näyttää korrelaation jota datassa ei ole. Suunta on oma
nauhansa kuvan alla: **kulma kertoo suunnan, väri nopeuden.** Lämpötila on
samasta syystä vain lukemana ja tooltipissa, ei viivana.

**Puuska ei ole oma viivansa.** Vanha kaavio piirsi tuulen vihreällä
(`#2A702D`) ja puuskan oliivilla (`#7A5D07`). Mitattuna paneelin beigeä
vasten ne ovat normaalille näölle **dE 10,9** ja protanoopille **dE 3,6** —
käytännössä sama väri, eli viivat erosivat vain siinä että toinen oli
ylempänä. Eikä hyvää toista sävyä ole olemassakaan: tuuliviiva on
väriramppi joka käy läpi vihreän, kullan, oranssin ja magentan, joten mikä
tahansa kiinteä sävy törmää siihen jossain kohtaa asteikkoa.

Ratkaisu on **vaihtaa kanavaa**: puuska on vyöhyke tuuliviivan yläpuolella.
Vyöhykkeen paksuus *on* puuskaisuus — juuri se mitä foilaaja kaaviosta
lukee — eikä sitä tarvitse päätellä kahden samanvärisen viivan
välimatkasta. Selitteessä tuulen avain on **sama gradientti kuin viiva**,
koska viivalla ei ole yhtä väriä.

**Harvennus säilyttää huiput.** 7 vrk on 1008 havaintoa noin 300 pikselille.
Joka n:nnen pisteen poiminta hukkaisi puuskapiikit — ja piikit ovat se syy
miksi kaaviota katsotaan. Siksi data niputetaan: viiva on nipun keskiarvo,
vyöhyke nipun pienimmästä tuulesta suurimpaan puuskaan. Kuudella tunnilla
nippuun osuu yksi havainto ja vyöhyke kutistuu luonnostaan tuulen ja
puuskan väliksi.

Asiat jotka eivät ole ilmeisiä:

- **Suuntien keskiarvo on ympyrällä.** 350° ja 10° ovat 20° päässä
  toisistaan, mutta niiden aritmeettinen keskiarvo on 180° eli täsmälleen
  väärään suuntaan. `_havSuuntaKeskiarvo` summaa yksikkövektorit.
- **Yksi nuoli on koko välinsä**, ei yksi nippu. Muuten 7 vrk:n nauha olisi
  kymmenen satunnaista pistenäytettä tuhannesta havainnosta: nuoli
  näyttäisi kertovan päivän suunnan, vaikka se kertoisi puolentoista
  tunnin suunnan sattumanvaraisesta kohdasta.
- **X-akselin merkinnät valitaan AJASTA, ei nipun indeksistä.** Ensimmäinen
  versio etsi nippuja joiden keskihetki osuu tasatunnille — ja 7 vrk:n
  jaksossa yksi nippu on puolitoista tuntia, joten tasatunnille ei osu
  kukaan. Akselilla luki "ke 19. pe 21. la 22. ma 24.": kolme päivää
  seitsemästä puuttui ilman mitään sääntöä.
- **Yli 30 h merkitään päivinä.** Pelkkä kellonaika on silloin
  kaksiselitteinen: "12 00 12 00 12" ei kerro mistä päivästä on kyse.
  Keskiyön kohdalla on jo pystyviiva, joten päivän nimi ankkuroidaan
  keskipäivään.
- **`var nayta` varjosti `function nayta`.** X-akselisilmukan boolean ja
  tooltipin funktio olivat samassa funktioskoopissa samannimisinä, joten
  hoistattu funktio korvautui booleanilla ja kosketus kaatui
  (`nayta is not a function`). Sen huomasi vain konsolista — kaavio
  näytti oikealta.
- **Vaakasuoran viivan gradientti tarvitsee `gradientUnits="userSpaceOnUse"`.**
  `<line>`-elementin rajauslaatikon korkeus on nolla, joten oletusarvoinen
  `objectBoundingBox` rappeutuu eikä gradientti näy lainkaan. Selitteen
  tuuliavain oli siksi ensin näkymätön.
- **Tooltip nousee ylös kun piste on alapuoliskossa.** Muuten se peittää
  suuntanauhan ja aikarivin, eli juuri ne kaksi asiaa joita samalla
  luetaan.
- **`ColorRamp.inkCss()`, ei `rgb()`.** Kortti on paperia (ks. *Kaksi
  ramppia*). Mustetaulu rakennetaan uudelleen kun väriasteikkoasetus
  vaihtuu, joten kaavio, nuolet, ruusu ja tilastoluvut seuraavat
  värisokeusramppia ilman omaa haaraa.

Tilastorivi (keskituuli, kovin puuska, vallitseva suunta, lämpötila) ja
suoraan merkityt ääriarvot ovat siellä siksi, että **tooltip saa täydentää
mutta ei portittaa**: jokainen luku on luettavissa myös koskematta
kaavioon. Tuuliruusu vastaa siihen mitä aikasarja ei kerro — onko tämä
pohjois- vai etelärannan paikka.

### Vesikaavio siirtyi paperille

`_uirasChartInteractive` oli jäänyt vanhaan tummaan palettiin: neonsyaani
viiva, syaanit ääriarvomerkinnät, magenta aseman nimi ja lähes musta
tooltip — beigen paneelin päällä. Sävyt vaihdettiin `--info`-tokeniin
(#1C5C86, dokumentoitu veden väri) ja musteisiin.

Samalla paljastui piilossa ollut vika: jaksovalitsimen **valittu** nappi
oli `var(--surface)` beige `var(--surface-hi)` lähes valkoisella, eli
1,1:1 — käytännössä näkymätön. Se ei näkynyt aiemmin, koska taustana oli
syaani lasitus. Nyt valittu on mustetta korotetulla pinnalla, sama kuin
tuulikaaviossa.

**`--accent` on edelleen ainoa toimintoväri.** Aseman nimi ei ole toiminto,
joten se on mustetta; valintamerkki ja valitsimen otsikko saavat pitää
aksentin.

## Tummat jäänteet paperipaneeleissa — ja miksi Helsinki näytti tyhjältä

Kaksi käyttäjän havaintoa, kolme eri vikaa. Kaikki mitattiin renderöidystä
sivusta: skripti kävelee jokaisen tekstisolmun, etsii sen *todellisen*
taustan (ylöspäin kunnes löytyy läpinäkymätön) ja laskee WCAG-suhteen.
Arvaamalla näitä ei löydä, koska tausta on usein eri elementissä kuin
teksti.

### Valikot avautuivat mustalla

`.fmi-dropdown-menu` oli `background: rgba(12,18,36,.98)` — lähes musta —
ja rivien teksti `var(--ink)` eli lähes mustaa. **Valikko oli luettava
vain siltä riviltä joka sattui olemaan `.selected`**, koska sen alla on
`--surface-lo`, joka maalasi tumman pois. Muut rivit olivat mustaa
mustalla. Se selittää myös "ekalla kerralla" -oireen: kun rivin valitsee,
se saa taustan ja alkaa näkyä.

Sama vika oli uimaveden asemavalikossa (`rgba(10,14,28,.98)`) ja se
korjattiin jo *Havaintoasemien kortit* -muutoksessa; tämä oli sen pari
jota ei silloin huomattu.

### Mitä mittari löysi lisää

Spottikortista löytyi kolme sarjaväriä ja neljä tilaväriä, jotka olivat
jääneet vanhasta tummasta teemasta:

```
                              beigellä (#F0E7CE)
mallivertailu ECMWF  #50B4FF        1.83 : 1
mallivertailu ICON   #FFC850        1.25 : 1
mallivertailu GFS    #C864FF        2.53 : 1
trendi ↑             #FFA050        1.64 : 1
trendi ↓             #50B4FF        1.83 : 1
puuskaisuus gusty    #FFC850        1.25 : 1
puuskaisuus extreme  #FF6450        2.37 : 1
"ei dataa" -viestit  rgba(255,100,100,.5–.7)  2.35–2.66 : 1
```

Yhdeksän eri kohtaa käytti punaista `rgba(255,100,100,…)` sanomaan "dataa
ei ole". Se ei ole virhe vaan tila, joten ne ovat nyt `--ink-3`.

### Kolmea erottuvaa sarjaväriä ei beigellä ole

Mallivertailun uudet sävyt ovat `#1C5C86` / `#A15A0E` / `#7A2E8F`
(5.82 / 4.27 / 6.51 : 1). Mutta mitattuna:

```
pari                normaali  protan  deutan  tritan
#1C5C86 / #A15A0E     23.1     19.0    23.6    20.3
#1C5C86 / #7A2E8F     16.7      6.4     1.6    13.8
#A15A0E / #7A2E8F     23.8     24.4    23.5    11.2
```

Sininen ja violetti ovat deuteranoopille **dE 1.6** eli sama väri. Tämä ei
korjaannu sävyä vaihtamalla: pinta on vaalea, joten kontrastivaatimus
pakottaa kaikki sarjat samaan kirkkausluokkaan, ja siinä luokassa
dikromaattinen erottelu romahtaa. Kokeiltiin viittä eri kolmikkoa —
jokaisessa vähintään yksi pari jäi alle rajan.

Ratkaisu on toinen kanava: **jokaisella mallilla on oma
katkoviivakuvionsa**, ja juuri se pari joka värinä sekoittuu on
kuvioltaan kauimpana toisistaan — ECMWF yhtenäinen, GFS pisteitä.
Selitteen avain piirtää saman kuvion, joten selite ei väitä että
mallit erottuisivat pelkällä värillä.

Yksi ansa: `MALLI_VIIVA.ecmwf` on `''` (yhtenäinen viiva), ja
`MALLI_VIIVA[key] || '5,3'` teki siitä katkoviivan — tyhjä merkkijono on
falsy. Sotki täsmälleen sen mallin jonka piti erottua kuviollaan.

### Helsingissä ei näkynyt FMI-havaintoja

Kaksi syytä, molemmat todellisia.

**1. Maa-asemat olivat piilossa, eikä valinta säilynyt.** Karttatasoissa
`'fmi-land': false`. Helsingin asemat — Kaisaniemi, Kumpula, Malmi,
Tapiola, Vantaa — ovat kaikki maa-asemia, ja lähin meriasema Harmaja on
10 km ulkomerellä. Kartta näytti tyhjältä juuri siellä missä käyttäjiä on
eniten. Lisäksi `_mapLayerState` ei tallentunut mihinkään, joten tason
kääntäminen päälle unohtui joka latauksella.

Nyt `fmi-land` on päällä oletuksena, tila muistetaan `fs_tasot`-avaimeen,
ja kytkinten ulkoasu luetaan tilasta eikä HTML:ään kirjoitetusta
oletuksesta.

**2. Maa-aseman lukemaa ei näytetty millään zoomilla.** `mkWindIcon`in
`isPrim` oli boolean: joko pilleri z8:sta ylöspäin tai pelkkä piste
ikuisesti. Maa-asemat olivat jälkimmäisiä, eli niiden lukeman sai näkyviin
vain napauttamalla.

`isPrim` korvattiin `pilleriZ`:llä — se zoom jolla lukema ilmestyy.
Meri 8, maa 10. Porrastus on tarkoituksellinen: meri on se mitä foilaaja
katsoo, mutta kaupunkiin zoomatessa myös maa-aseman lukema on luettavissa.
Mitattuna Helsingin keskustan yllä:

```
       ennen        jälkeen
 z12     0          4   (Kaisaniemi, Kumpula, Harmaja, Kruunuvuorenselkä)
 z11     0          6   (+ Tapiola, Malmi)
 z10     0          9   (+ Vuosaari «ei signaalia», Itätoukki, Vantaa)
  z9     2 meri     4 meri + 5 pistettä
```

Maa-asemille **ei** lisätty ruksi-sijaintimerkkiä: `_stationDots` ei kuulu
`_obsMarkersGlobal`iin, joten `_applyMapLayers` ei piilottaisi niitä, ja
ruksit jäisivät kartalle vaikka taso käännettäisiin pois.

### Kolmas vika: HARMONIE kaatui koko funktion

Tämä löytyi vahingossa — dev-serverin loki kaatui kesken testin:

```
SyntaxError: Unexpected token 'u', "upstream c"... is not valid JSON
    at IncomingMessage.<anonymous> (api/harmonie.js:58:47)
```

`fetchOM`in `res.on('end', … JSON.parse(body))` oli ilman suojaa. Ylävirta
ei aina vastaa JSONia: välityspalvelimen aikakatkaisu palauttaa tekstin
`upstream connect error or disconnect/reset before headers`. Ja koska
heitto tapahtuu **stream-callbackin sisällä**, se ei päädy kutsujan
`try/catch`iin eikä `Promise.allSettled`iin vaan kaataa koko prosessin.

Serverittömässä ajossa se tarkoittaa 500:aa, eli `/api/harmonie` lakkaa
vastaamasta kokonaan — ja HARMONIE-lähde katoaa **kaikkialta**, myös
Helsingin yltä, ilman että mikään kertoo miksi. Nyt `JSON.parse` on
`try/catch`issa ja rejektoi selkeällä viestillä, jolloin
`_omVastaus`-varatie pääsee toimimaan niin kuin oli tarkoitus.

**Jos tähän palaa:** koko `api/`-hakemisto käytiin läpi samalla haulla.
`fmi.js` ja `kruunuvuori.js` resolvoivat raakaa tekstiä (turvallista) ja
`uiras.js` parsii `zlib.gunzip`in callbackissa, jonka virheet
rejektoidaan. Tämä oli ainoa suojaamaton jäsennys.

## Oma säädatavarasto — pois rajapinnan kiintiöstä

Sovellus haki tuulikentän Open-Meteon rajapinnasta joka istunnossa. Se ei
kaatunut kustannuksiin vaan **kiintiöön**, ja kiintiön yksikkö on se mikä
tekee tästä ison asian.

### Mitattu ongelma

Open-Meteon ilmainen taso on 10 000 kutsua/vrk, ja **laskutusyksikkö on
paikka, ei HTTP-pyyntö**: jokainen koordinaatti erässä on oma kutsunsa.
Mitattuna selaimessa yhdellä todellisella istunnolla:

```
  käynnistys Helsinki z9    144 paikkaa   ( 3 pyyntöä)
  zoom sisään z12            31           ( 2)
  zoom ulos z7              101           ( 3)
  panorointi                191           ( 5)
  Porkkala z9                50           ( 2)
  maailmanäkymä z3          745           (11)   <- 57 % koko istunnosta
  spottikortti               43           ( 2)
  ------------------------------------------------
  yhteensä                 1305 paikkaa   (28 pyyntöä)
```

18 vuorokauden jakso maksaa vielä ×1,29 (yli kahden viikon pyyntö), joten
istunto on noin **1 678 kutsua — kuusi istuntoa vuorokaudessa**. Kehittäjä
polttaa sen aamupäivässä.

Toinen mitattu luku ratkaisi suunnan: **koko datajoukko jonka sovellus voi
ikinä näyttää on muutama megatavu.** Kiintiöllä maksettiin siitä että sama
taulukko koottiin uudelleen joka istunnossa.

### Mistä data nyt tulee

Open-Meteo julkaisee koko käsitellyn tietokantansa AWS Open Datassa:
`s3://openmeteo`, avoin, ilman tunnistautumista, CC BY 4.0, 68 mallia.
Sama data kuin rajapinnasta, ilman kiintiötä.

Valittu malli on **`ecmwf_ifs025`** yhdestä syystä: se on ainoa jonka
hetkittäisessä tiedostossa on kaikki kolme tarvittavaa suuretta —
`wind_u_component_10m`, `wind_v_component_10m` ja `wind_gusts_10m`.
GFS:llä on puuskat mutta ei 10 metrin tuulta, joten se vaatisi kaksi
mallia, ja kaksi mallia tarkoittaa kahta eri fysiikkaa samassa kuvassa.

Asioita jotka piti selvittää mittaamalla, koska metatiedoista niitä ei
saanut (kirjaston skalaarilukija heittää `crs_wkt`:lle):

- **Rivi 0 on ETELÄSSÄ.** Luin lämpötilakentän 9×12 ruudukkona: y=0 antoi
  −58 °C tasaisesti (Etelämanner elokuussa), y=720 noin −1 °C. Pituuspiiri
  ratkesi samasta kuvasta: x=785 oli 37 °C ja x=916 oli 46 °C, mikä osuu
  Saharaan ja Arabiaan vain jos x=0 on −180°. Siis
  `lat = -90 + y*0.25`, `lng = -180 + x*0.25`.
- **Aika-akseli ei ole tasavälinen.** ECMWF antaa kolmen tunnin askeleen
  kuuden vuorokauden ajan ja sitten kuuden tunnin askeleen
  viidenteentoista: mitattuna 48 kolmen tunnin väliä ja 36 kuuden tunnin
  väliä. Ensimmäinen versio tallensi vain `t0` ja `dt` — jolloin viimeiset
  yhdeksän vuorokautta olisivat olleet väärässä kohdassa aikajanaa ilman
  että mikään olisi näyttänyt rikkinäiseltä. Nyt luettelossa on koko
  aikalista. Interpolointi itse osaa epätasaisen välin, koska se hakee
  hetkeä *ympäröivän parin* eikä kiinteää askelta.
- **Puuskaa ei ole analyysihetkellä.** Se on jakson yli laskettu maksimi,
  eikä nollan mittaiselle jaksolle ole maksimia. Ensimmäinen versio hylkäsi
  koko hetken jos puuska puuttui — eli juuri sen hetken jonka kartta
  oletuksena näyttää.

Suunnan konventio tarkistettiin FMI:n HARMONIEa vasten kolmessa paikassa:
ero 1–5°, nopeusero 0,6–1,2 m/s (normaali mallien välinen erimielisyys
25 km vs 2,5 km hilalla) ja puuskat 4,6 vs 4,8 / 5,4 vs 4,3. Kaava on
`(270 - atan2(v,u)*180/pi) mod 360`.

### Laattojen muoto

Laatta on **21 × 21 pistettä ja 20 × askel astetta**. Viimeinen rivi on
naapurin ensimmäinen, joten reunalla ei ole saumaa jota interpolointi
joutuisi arvaamaan. Sisältö on kolme tavutasoa järjestyksessä
`[aika][y][x]`: nopeus (0,2 m/s), suunta (2°) ja puuska (0,2 m/s), 255 =
puuttuva. Molemmat kvantisoinnit ovat selvästi hienompia kuin ennusteen
oma tarkkuus.

Viisi tasoa, tiheät vain sinne missä spotit ovat:

| taso | askel | alue | laattoja |
|---|---|---|---|
| l0 | 0,25° | Itämeri + Suomi | 25 |
| l1 | 0,5° | Pohjois-Eurooppa | 24 |
| l2 | 1° | Eurooppa + Atlantti | 21 |
| l3 | 2,5° | koko maailma | 32 |
| l4 | 5° | koko maailma | 8 |

Koko maailman 0,25° olisi 2 592 laattaa eli 290 MB; sitä ei tarvitse
kukaan. **l4 on olemassa vaikka l3 kattaa saman alueen**, koska
sovelluksen hilaväli on zoomissa 3 ja sitä ulompana 5°: l3:lla
maailmanäkymä oli mitattuna 32 laattaa ja 2,65 MB, l4:llä 8 laattaa ja
0,68 MB. Data on samaa, ero on vain siinä ettei ladata neljä kertaa
enempää kuin näytetään.

Yhteensä 110 laattaa, **9,4 MB gzipattuna**, 98 aika-askelta, jakso 16,6
vuorokautta (2 vrk taakse, 15 eteen). Rakennus kestää noin kolme
minuuttia.

Pakkaus jää 66 prosenttiin eikä siitä kannata yrittää enempää:
kokeiltuna `[y][x][t]` + aikadelta oli **101 %** ja `[t][y][x]` +
aikadelta **93 %** nykyisestä. Kvantisoitu tuuli on tavutasolla lähes
kohinaa.

### Menneisyys tulee vanhemmista ajoista

`data_spatial` sisältää vain ennusteen ajohetkestä eteenpäin, mutta
aikajana ulottuu kaksi vuorokautta taaksepäin. Menneisyys saadaan
vanhempien ajojen alkupäästä: kaksitoista tuntia sitten tehdyn ajon
ensimmäiset askeleet ovat nyt menneisyyttä. Jokaiselle hetkelle valitaan
**tuorein ajo joka sen kattaa**, joten menneisyys on parasta saatavilla
olevaa analyysiä eikä vanhaa ennustetta. Mitattuna yksi akseli koostuu
neljästä eri ajosta.

### Mitä sovelluksessa muuttui

`Saalaatat`-moduuli ja yksi lohko `loadViewport()`:ssa. Laattapisteet
menevät `_points`-karttaan **samassa muodossa kuin rajapinnasta tulevat**,
joten interpolointi, lämpökartta, partikkelit ja aikajana eivät tiedä
erosta. Ainoa näkyvä ero on lähdemerkintä.

Kaksi asiaa jotka piti korjata mittaamalla:

- **Bilineaarinen näyte, ei lähin solmu.** Kun sovellus pyytää 0,5° hilaa
  mutta tarjolla on vain 2,5° taso (Australiassa), lähin solmu antaisi
  viidelle pisteelle saman arvon — kenttä olisi 2,5° palikoita ja
  interpolointi sekoittaisi vain identtisiä naapureita. Suunta
  interpoloidaan yksikkövektoreina samasta syystä kuin
  `_havSuuntaKeskiarvo()`:ssa: 350° ja 10° ovat 20° päässä toisistaan,
  mutta lukujen keskiarvo on vastakkainen suunta.
- **`varmista()` tarvitsee saman pehmusteen kuin `getViewportPoints()`**
  (`step * 2`). Ilman sitä reunapisteet putoavat naapurilaatalle jota ei
  ole ladattu, ja ne menevät rajapintaan vaikka data on olemassa.
  Mitattuna Sydneyn z8-näkymässä 26 pistettä 117:stä jäi näin katveeseen.

Tulos samalla kierroksella kuin alussa mitattu, mutta vaikeampana (mukana
Sydney ja maailmanäkymä):

```
                    ennen        jälkeen
  Open-Meteo        1305 paikkaa    0 paikkaa
  laattoja             —           21 pyyntöä, 1,67 MB
```

### Varatie ei ole valinnainen

Laatat kattavat rajatut alueet, ja ajastettu työ voi olla rikki. Kolme
tilaa testattiin selaimessa ja kaikissa sovellus toimii kuten ennenkin
(375 tunnin aikajana rajapinnasta, ei sivuvirheitä):

- **luettelo puuttuu (404)** → varasto pois käytöstä
- **luettelo on roskaa** → sama
- **luettelo on vanhentunut** → sama. Raja on: jos viimeinen hetki ei
  yllä puolta vuorokautta eteenpäin, ajastettu työ on jäänyt jumiin.
  Vanhentunut varasto on pahempi kuin ei varastoa lainkaan, koska se
  näyttäisi eiliseltä ennusteelta ilman että mikään kertoo siitä.

### Julkaisu

GitHub Actions (`.github/workflows/saadata.yml`) neljä kertaa
vuorokaudessa. Julkisessa reposessa minuutit ovat rajattomat.

Laatat menevät **orpoon `saadata`-haaraan pakkopäivityksellä**, eli
haarassa on aina täsmälleen yksi committi. Jos ne kasautuisivat
historiaan, repo kasvaisi 38 MB vuorokaudessa ja täyttäisi GitHubin
gigatavun rajan neljässä viikossa.

Sovellus lataa ne `raw.githubusercontent.com`:sta: siellä on
`access-control-allow-origin: *` ja `cache-control: max-age=300`, mikä
sopii kolmen tunnin välein päivittyvälle datalle. jsDelivr olisi
nopeampi CDN mutta sen `max-age` on seitsemän vuorokautta `@main`-tagilla,
eli väärä tälle.

**Cloudflare R2 olisi tähän myös hyvä** (10 GB ilmaista, egress
maksuton), ja jos sovellus joskus saa oikeaa liikennetta, se on se
minne siirtyä — GitHubin kaistalla on pehmeä 100 GB/kk raja ja
välimuistiotsakkeisiin ei pääse käsiksi. Tällä mittakaavalla ero ei
näy.

### Mitä varaston jälkeen jäi jäljelle

Laatat veivät kartan pois kiintiöstä, mutta ne eivät vieneet kaikkea.
Mitattuna viisi peräkkäistä sivunlatausta maksoi yhä **25 paikkaa
jokainen** — ei laskevasti vaan tasaisesti, eli mikään ei jäänyt talteen
latausten välillä. 10 000 paikan vuorokausikiintiöllä se on 400
latausta, mikä loppuu kesken yhtenä testipäivänä.

Kolme kuluttajaa, kaikki sama vika: **välimuisti oli olemassa mutta
vain muistissa.** TTL oli voimassa sivun elinajan, ja uudelleenlataus
aloitti tyhjästä.

| kuluttaja | TTL | oli | on |
|---|---|---|---|
| spottien ennusteet | 30 min | `localStorage`, mutta aina `_vanha` | tuoreusraja |
| vedenlämmöt | 60 min | vain muistissa | `fs_vesi` |
| tähtäimen sääkapseli | 30 min | vain muistissa | `fs_saa` |

**Spoteilla tallennus oli jo levyllä** — vika oli lukupäässä.
`_restoreSpots` merkitsi jokaisen palautetun spotin `_vanha`ksi, ja
`loadSpots` hakee `_vanha`t aina uudestaan. Tallennusta siis
kirjoitettiin ja luettiin, mutta se ei säästänyt yhtään kutsua: se
nopeutti vain ensimmäistä ruutua. Nyt alle puolen tunnin ikäinen
tallennus osoittaa samaan tuntiruutuun kuin uusi haku antaisi, joten
merkintä jää pois eikä hakua tule.

Samalla `main()`:iin tuli ehto vanhuussirulle: se näytettiin aina kun
välimuistipolku ajettiin, mikä nyt lupaisi "päivitetään" latauksesta
jota ei tule.

Mitattu ennen ja jälkeen (Open-Meteo-**paikkoja**, ei HTTP-pyyntöjä —
kiintiö veloittaa paikan, joten 80 pistettä yhdessä pyynnössä on 80):

```
lataus     ennen   jälkeen
  1          25       25      kylmä käynnistys
  2          25        0
  3          25        0
  4          25        0
  5          25        0
```

Ja raskas selailu — 18 siirtoa Hangosta Sydneyyn ja takaisin, zoomit
z2–z12 — maksoi **0,9 paikkaa siirtoa kohti**. Jäljelle jäänyt yksi on
aina sama: sääkapseli uudessa 0,1 asteen ruudussa. Tuulikenttä,
lämpökartta ja spotit tulevat laatoista.

**Mittarissa oli kaksi omaa vikaa, jotka on syytä tietää jos sen
rakentaa uudestaan.** Laskuri luki vain `latitude`-parametria, mutta
`/api/harmonie` käyttää muotoa `pts=lat,lng;lat,lng` — kahdentoista
pisteen erä näkyi yhtenä, eli kulu näytti kymmenkertaisesti liian
pieneltä. Ja tynkä palautti `pts=`-haaralle väärän muodon (olio eikä
`{results:[…]}`), jolloin sovellus piti vastausta tyhjänä ja putosi
Open-Meteon varatielle: samat 12 spottia näkyivät haettuina kahdesti.
Kumpikaan ei ollut sovelluksen vika.

**Katto on paikkamäärässä, ei tavuissa.** `fs_saa` pitää kahdeksan
viimeksi katsottua paikkaa, koska yksi paikka on ~4 kt (5 vrk tunnin
välein) ja mitattuna kaksitoista paikkaa oli 57 kt. Vanhentuneet
pudotetaan jo luettaessa, jottei tallennus kasva niistä joita ei enää
käytetä.

## Lämpökartta oli väärässä projektiossa

Käyttäjä pyysi tarkentamaan kenttää uloimmassa näkymässä ja mainitsi
erikseen Antarktiksen. Kysymys osui suoraan vikaan, joka oli ollut
koodissa alusta asti.

**`WindTexture`n rivit ladottiin tasavälein LEVEYSASTEESSA**
(`lat = latMax - rr * latStep`), mutta `L.ImageOverlay` projisoi vain
nurkat ja venyttää kuvan niiden väliin **lineaarisesti ruudulla**. Ruudun
y taas on Mercatorissa `ln(tan(π/4 + φ/2))`, ei φ. Jokainen rivi piirtyi
siis eri kohtaan kuin mihin sen data kuuluu.

Virhe kasvaa näkymän korkeuden mukana ja on suurimmillaan navoilla, missä
Mercator venyttää eniten. Mitattuna sovelluksesta terävällä harjalla
(synteettinen kenttä, harja tunnetulla leveysasteella, katsotaan mille
ruudun riville se piirtyy):

| näkymä | ennen | jälkeen |
|---|---|---|
| z11 Helsinki | 0 px | 0 px |
| z9 Suomenlahti | −44 px | +1 px |
| z7 Suomi | **−168 px** | +3 px |
| z5 Itämeri | −97 px | +1 px |
| z3 puolimaailma | **−204 px** | +2 px |
| z2 maailma | +151 px | +1 px |
| z3 Antarktis | **+273 px** | +2 px |
| z4 Antarktis | +191 px | +1 px |

273 px on yli neljäsosa puhelimen ruudun korkeudesta, ja leveysasteina
**12,8°**. Analyyttinen ennuste samalle asetelmalle antoi 259 px, eli
mittaus ja teoria täsmäävät.

Asiat jotka eivät ole ilmeisiä:

- **Sama virhe korjattiin aikanaan `GeoProject`ista partikkeleille** (ks.
  *Kerrokset samassa paikassa, samaan aikaan*), mutta lämpökartta jäi
  silloin väliin. Syy on mittarissa: se vertasi overlayn **RAJOJA**
  pohjakarttaan, ja ne olivat koko ajan 0,1–0,5 px kohdallaan. Rajat
  olivat oikein; **sisältö** ei. Kerroksen kohdistuksen mittaaminen ei
  siis todista sen sisällöstä mitään.
- **`sampleWind` on korjattava samalla.** Se on käänteiskuvaus samaan
  tekstuuriin, ja partikkelit näytteistävät tuulen sen kautta. Jos vain
  `build` korjattaisiin, partikkeli lukisi tuulen eri kohdasta kuin mihin
  lämpökartta sen piirtää — kerrokset erkanisivat juuri siellä missä
  virhe on suurin. Tarkistettu jälkeenpäin: ero `sampleWind`in ja sen
  tekstuuripikselin välillä joka oikeasti piirtyy samaan ruutupisteeseen
  on mediaanina 0,001–0,084 m/s kaikissa näkymissä.
- **`ymerc`/`ymercInv` ovat jo tiedostossa** `GeoProject`ia varten, ja ne
  rajaavat navat ±85,0511:een kuten Leafletin oma projektio.

### Kuinka tarkka kenttä oikeasti on

Projektion korjauksen jälkeen mitattiin mikä kentän tarkkuutta oikeasti
rajoittaa. Mittari on RMS-virhe **tunnettuun kenttään**: totuus on
analyyttinen ja siinä on rakennetta kolmella mittakaavalla, se
näytteistetään siihen hilaan jota sovellus oikeasti käyttää, kenttä
rakennetaan ja tulos verrataan totuuteen näkymän pikseleissä.

**Älä vertaa zoomia toiseen** — se sekoittaa aliotannan ja virheen eikä
kerro kumpi on väärässä.

**1. Interpoloinnin tukisäde oli kaksi kertaa liian suuri.** `R = 3 ×
hilaväli` sekoitti yhdeksän hilaruudun alueelta. Pyyhkäisy:

| R | z7 | z5 | z3 | z2 |
|---|---|---|---|---|
| 3,0 | 0.13 | 0.61 | 1.20 | 1.89 |
| 2,0 | 0.07 | 0.43 | 0.99 | 1.29 |
| **1,7** | **0.06** | **0.36** | **0.90** | **1.22** |
| 1,4 | 0.05 | 0.29 | 0.80 | **1.60** |

1,4 kääntyy z2:ssa huonommaksi: se alittaa rajan jolla säännöllisestä
hilasta löytyy aina tukea, jolloin `idw()` putoaa varatielle. 1,7 on
pienin joka ei tee sitä.

**2. `eps` 0,45 → 0,30.** Parantaa lisää (z5 0.36 → 0.31, z3 0.90 → 0.81).
**RMS ei kuitenkaan näe pilkkukuviota**, ja se on juuri se vika jota
vastaan `eps` alun perin lisättiin — totuus näytteistetään hilan
solmuissa, joten solmuun snappaava interpolantti saa *paremman* RMS:n
vaikka välit olisivat rumia. Siksi tehtiin oma mittaus: yksittäinen
poikkeava piste (+6 m/s) hilan solmujen väliin, ja katsottiin kuinka
leveäksi se leviää.

| R / eps | jäljelle jäänyt poikkeama | puoliarvonleveys |
|---|---|---|
| 3,0 / 0,45 | 0,7 m/s (12 %) | 1,2 hilaväliä |
| 1,7 / 0,45 | 1,1 m/s | 1,2 |
| **1,7 / 0,30** | **~1,9 m/s (~30 %)** | **1,1** |
| 1,7 / 0,08 | 4,1 m/s (69 %) | 0,9 |

Leveys pysyy noin yhdessä hilavälissä **kaikilla** arvoilla — poikkeama
ei kutistu teräväksi nastaksi, eli pilkkukuviota ei synny. Mitä pienempi
`eps`, sitä suurempi osa *oikeasta* paikallisesta poikkeamasta jää
näkyviin. 0,30 on kompromissi: havaintoasema tai spotti näkyy, mutta ei
hallitse naapurustoaan.

**3. Pistekatto kasvatti hilaa juuri siellä missä sitä katsotaan.**
`KATTO: 600` on ajalta jolloin jokainen piste oli oma rajapintakutsunsa.
Maailmannäkymässä 5°:n hila antaa 1260 pistettä, joten katto kaksinkertaisti
välin **kymmeneen asteeseen**. Laattavarastosta pisteet ovat ilmaisia, ja
`taso()` valitsee molemmilla askelilla samat 5°:n laatat — ero on pelkkää
interpolointia eikä yhtään lisätavua verkosta. `KATTO_LAATTA = 1600`.

**4. Tekstuurin koko oli pullonkaula uloimmilla zoomeilla.** `maxDim` oli
120. Pyyhkäisy (RMS, |lat| < 55):

| maxDim | 120 | 160 | 200 | 260 | 340 |
|---|---|---|---|---|---|
| z2 | 1.40 | 1.31 | **1.30** | 1.23 | 1.20 |
| z3 | 0.75 | 0.70 | **0.67** | 0.66 | 0.66 |
| aika | 59/14 | 39/18 | 53/24 | 79/37 | 117/47 ms |

200 on polvi. z5:llä `maxDim` ei vaikuta **mitään** (0.31 kaikilla arvoilla
120–340), koska siellä rajoite on datahila — siksi keskimmäistä porrasta ei
nostettu.

### Mitä EI kannattanut tehdä

- ~~**Tiheämpi datahila.**~~ **TÄMÄ PÄÄTELMÄ OLI VÄÄRÄ** — mittari oli
  rikki, ks. *Uloin näkymä rajattiin* alempana. `WindTexture.build`
  rakentaa `SpatialIndex`in uudestaan arvolla `kaytettyStep(zoom)`,
  joten testin oma `SpatialIndex.build(kenttä, hila)` ylikirjoitettiin
  ja IDW:n tukisäde jäi vanhaan riippumatta siitä mitä dataa syötettiin.
  Pyyhkäisy näytti siksi tasaiselta. Oikein mitattuna tiheämpi hila
  **auttaa paljon**: uloimmassa näkymässä 2,5° → 1,25° antaa
  RMS 0.27 → 0.11 ja z5:llä 0.32 → 0.10.

  Testin on korvattava `ViewportGrid.gridStep`, ei pelkkä
  `SpatialIndex.spacing`.
- **z2:n tarkkuutta ei rajoita data vaan Mercator itse.** Koko ruudun
  RMS on z2:ssa 1.56 mutta pelkän |lat| < 55 vyöhykkeen 1.23 — ero on
  napa-alueiden aliotantaa, jossa yksi tekstuuririvi kattaa valtavan
  leveysastevälin. Sama raja koskee jokaista tasavälistä
  Mercator-rasteria, myös Windyn omaa. **Tämä havainto on yhä voimassa,
  ja siitä tuli syy rajata uloin zoom kokonaan pois z2:sta** — se on
  näkymä jota ei kannata näyttää.
- **`COARSE_STEP`in tihentäminen.** 3 → 1 antoi z3:lla 0.85 → 0.83 ja
  kolminkertaisti työn. Jätettiin kolmeen.

Mitattu A/B oikealla datalla (4× kuristus, DPR 3, ensimmäinen ajo
kummallakin — ks. sudenkuoppa alla): lepotilan ruutunopeus
z2 32 → 36, z3 23 → 25, z5 22 → 23, z7 18 → 19 fps. Uudet arvot ovat siis
myös hitusen nopeammat.

**Sudenkuoppa jonka mittaus itse paljasti:** kahta asetusta ei voi ajaa
peräkkäin samassa sivussa ja tulkita jälkimmäisen lukuja. Kumpi tahansa
ajettiin toisena, sai 8–9 fps — järjestys, ei asetus. Kontrolli on ajaa
sama vertailu toisin päin; jos luvut seuraavat järjestystä eivätkä
asetusta, mittari mittaa itseään.

## Nopea zoom ei saa näyttää mustaa

Nopeasti ulos zoomatessa ruutu meni lähes kokonaan mustaksi. Syy ei ole
asetus vaan Leafletin normaali toiminta: **animaation ajaksi olemassa
olevat laatat vain skaalataan**, ja uuden tason laatat luodaan vasta
`zoomend`issä. Kolme tasoa ulos kutistaa vanhat laatat kahdeksasosaan
leveydestä eli 1/64 pinta-alasta — loppu on paljasta `--bg`:tä, joka on
tummalla teemalla lähes musta (#060912).

Mitattuna laattapeitto eleen aikana (100 % = ei paljasta taustaa):

```
                       ennen              jälkeen
z11 -> z8   (3 tasoa)  min  2 %, 14 ruutua alle 50 %    100 %, 0 ruutua
nipistys ulos, nopea   min  0 %                         100 %, 0 ruutua
nipistys ulos, hidas   min  0 %                         100 %, 0 ruutua
nipistys sisään        min  0 %                         100 %, 0 ruutua
```

**`updateWhenZooming: true` EI korjaa tätä** — mitattuna tismalleen samat
luvut. Se koskee vain nipistystä (`_setView`in `noUpdate`-lippua), ei
animoitua zoomia. Tämän tiedostoon aiemmin kirjoitettu selitys siitä mitä
lippu tekee oli siis oikea, mutta se ei ollut tämän vian syy.

Korjaus on sama minkä Apple Maps ja Google Maps tekevät: **pysyvästi
ladattu matalan zoomin taustalaatta pohjakartan alla.**

- **`maxNativeZoom: 2` eli sama kuin kartan `minZoom`.** Silloin tämän
  tason laatat ovat **aina samat** riippumatta siitä mihin zoomataan — ne
  eivät vaihdu eleen aikana, joten ne eivät voi myöskään puuttua. Yksi
  z2-laatta kattaa 90 astetta, eli z11:ssä se peittää ruudun satoja
  kertoja yli.
- **Hinta on mitattuna 4 laattapyyntöä** koko käynnistyksen ja selailun
  yli (202 → 206). Ei `detectRetina`a: tausta näkyy vain aukoissa
  venytettynä, joten tarkkuus olisi siellä hukkaan heitettyä.
- **Sama luokka `basemap`**, jotta sävynsäädin osuu molempiin ja tausta on
  samanvärinen kuin varsinainen kartta. Ja **sama URL vaihdetaan**
  `KarttaAsetukset.kayta()`ssa, muuten aukoissa vilahtaisi edellinen
  pohjakartta.
- **Lämpökartalle on annettava `zIndex: 2` nimenomaisesti.** Taustalaatta
  on 0 ja pohjakartta 1; ilman arvoa järjestys jäisi DOM-järjestyksen
  varaan ja taustalaatta lisätään kartalle ennen lämpökarttaa.
  Tarkistettu: `plus-lighter` ja suodin ovat tallella, `tilePane`n
  järjestys on 0:basemap 1:basemap 2:heatmap.

**Yli neljän tason hyppy jää osittain kattamatta, ja se on tietoinen
raja.** Leafletin `zoomAnimationThreshold` on 4: sitä isompaa muutosta ei
animoida lainkaan vaan kartta tekee kovan leikkauksen, jolloin
taustalaattakin tarvitsee uuden laatan eikä uusi `img` ole dekoodattu
ensimmäisinä ruutuina. Mitattuna 2–3 ruutua eli alle 50 ms, ja se
tapahtuu vain koodin `setView`istä (suosikkeihin keskitys, jaettu linkki)
jolloin ruutua peittää latausruutu. Käyttäjän omat eleet — nipistys,
rulla, tuplanapautus — pysyvät aina animaatiorajan sisällä.

**Kokeiltu ja poistettu:** `_invalidateAll`in ohitus taustalaatalla.
Mitattuna sitä ei kutsuta taustalaatalle **kertaakaan** (inval 0), eli
paikkaus oli kuollutta koodia — laatat eivät katoa invalidoinnissa vaan
odottavat dekoodausta.

## Aurinkokaari siirtyi tuuliennusteen aika-akselille

Kortilla oli **kaksi eri aika-akselia**. Tuuliennuste alkaa valitusta
hetkestä ja jatkuu 24 h / 5 vrk / koko jakson; aurinkokaari kulki
keskiyöstä keskiyöhön. Ne olivat päällekkäin kortilla mutta eri
ruudukoissa, ja lukijan piti yhdistää ne päässään juuri siinä
kysymyksessä jota varten molemmat ovat: **ehdinkö vielä vesille.**

Mitattu lähtötilanne (kaari renderöitynä):

- Tilarivi `Laski 17:49` osui horisonttiviivalle ja **päällekkäin
  laskuajan `17:49` kanssa** — sama luku kahdesti, toistensa päällä.
- Oikea reuna jäi `.sh-sun-arc { margin: 0 -20px }` -bleedin takia
  kortin häivytyksen alle; sinne osunut valitun tunnin merkintä oli
  lukukelvoton.
- **9 tuntia 24:stä oli yötä**, piirrettynä horisontin alle jäävänä
  lähes näkymättömänä käyränä. Puolet leveydestä ei kantanut tietoa.
- Hämärää, kultaista tuntia, päivän pituutta tai sen muutosta ei ollut.
- Pilvisyys oli haettu (`wx.hourly.cloudcover`) mutta käyttämättä:
  graafi näytti **geometrisen valon**, ei aurinkoa.

### Kaista, ei harso

Ensimmäinen versio varjosti koko kuvaajan yön kohdalta. **Se ei
toiminut**, ja syy on kerrosten määrä: kuvaajassa oli jo kaksi
päällekkäistä taustaa — tuulen värigradientti (alfa 0,05–0,32) ja
vihreä sessioikkuna (`rgba(42,112,45,.13)`) — ja kolmas teki niistä
mutaa jossa mikään ei erottunut. Ruutukaappauksessa yö ja päivä
näyttivät samalta vihertävältä sameudelta.

Nyt valo ja pilvet ovat **omalla 6 px kaistallaan** tuntimerkintöjen
yläpuolella (`LABEL_H` 16 → 24), ja kuvaajan päälle jää vain hyvin
kevyt yöharso tunnelmaksi. Sama aika-akseli, oma kanava.

Asiat jotka eivät ole ilmeisiä:

- **Vaihe luokitellaan auringon KORKEUDESTA joka näytteessä**, ei
  nousu- ja laskuajoista. Se hoitaa monen vuorokauden jaksot ilman
  päivittäistä silmukkaa ja napa-alueet ilman erikoistapausta —
  siellä nousua tai laskua ei yksinkertaisesti ole.
- **Reunat tarkennetaan puolitushaulla näytteiden välistä.** Tunnin
  hilalla pelkkä luokittelu heittäisi auringonlaskun jopa puoli
  tuntia, ja se näkyisi suoraan siinä mihin kohtaan kaistan väri
  vaihtuu.
- **Yö ja pilvi eivät saa olla samaa sävyä.** Ensimmäisessä versiossa
  molemmat olivat `rgba(76,89,96,…)` ja pilvikaton ollessa 0,50
  täysin pilvinen päivä oli lähes yön näköinen — kaista kertoi vain
  "tummaa" eikä sitä kumpi syy oli kyseessä. Nyt yö on sinimustetta
  (`rgba(31,45,58,.74)`), pilvi neutraalia harmaata katolla 0,30.
- **Matala aurinko on lämmin** (`rgba(154,81,22,.60)`), koska se on eri
  asia kuin himmeä päivä: juuri se tunti jota illan sessiossa
  jahdataan. Raja on +6°, vakiintunut "kultaisen tunnin" määritelmä.
- **Täysi päivä jättää pohjauran näkyviin** eikä tyhjää kaistaa. Tyhjä
  lukisi "ei dataa".
- **Sade on oma 2 px kanavansa** kaistan alla: se ei muuta valon määrää
  vaan sitä kannattaako lähteä.
- **Kellonajat jäivät tekstiksi.** "Milloin laskee" luetaan sanoina,
  ei käyrän kohtana. Rivi `03:09–17:49 · 14 h 40 min · −5 min/vrk ·
  hämärä 18:35 asti` vie 14 px siinä missä kaari vei 91. Se on
  **kaavion alla**, koska se selittää juuri sen kaistan — ensin se oli
  havaintoruutujen jäljessä, missä se oli irrallaan kaikesta mihin
  liittyy.

### Aurinko-moduuli

Vanha `calcSunTime` laski nousun ja laskun keskipäivä-approksimaatiolla
ja **palautti null napa-alueilla**, jolloin koko kaistale katosi
ruudulta selittämättä. Uusi `Aurinko.korkeus()` laskee korkeuskulman
suoraan (NOAA:n yksinkertaistettu malli), jolloin samasta funktiosta
saadaan nousu, hämärän vaiheet ja kultainen tunti — ja kaavion tausta
voidaan luokitella ilman että nousuaikoja etsitään lainkaan.

Kulmat eivät ole makuasia vaan vakiintuneita määritelmiä: −0,833°
(yläreuna horisontissa, taittuminen mukana), −6° siviilihämärä, −18°
tähtitieteellinen hämärä, +6° kultainen tunti.

Tarkistettu 25 kohdan regressiolla:

```
Hanko 26.8.     nousu/lasku 03:09/17:49   pituus 880 min   −5 min/vrk
Svalbard kesä   ei laskua,  keskipäivä  35,0°   -> "Aurinko ei laske"
Svalbard talvi  ei nousua,  keskipäivä −11,8°   -> "Aurinko ei nouse"
Antarktis kesäk. keskipäivä −4,5°                (kaamos)
päiväntasaaja   727 min                          (~12 h)
```

Laskun `17:49` täsmää vanhan kaavan kanssa tasan; nousussa on 3 min ero
ja uusi on se tarkempi.

**Aikavyöhyke on selaimen**, kuten koko sovelluksessa (`AIKAVYOHYKE`):
API:lta pyydetään ajat siinä vyöhykkeessä, joten `new Date(times[i])`
on oikein. Jos spotti on eri vyöhykkeellä kuin selain, vuorokauden raja
menee selaimen mukaan — silloin nousu ja lasku voivat osua eri
vuorokausille eikä päivän pituutta näytetä lainkaan. Se on oikea
degradaatio: mieluummin ei lukua kuin negatiivinen luku. Suomen
rannikon spoteilla tilanne ei tule vastaan.

## Uloin näkymä rajattiin — ja se muutti kaiken muun

Koko pallon näyttäminen ei ole tälle sovellukselle hyödyllinen tila.
Edellinen luku päätyi siihen että z2:n tarkkuutta rajoittaa Mercator
itse: napojen kohdalla yksi tekstuuririvi kattaa kymmeniä asteita, eikä
sille voi tehdä mitään. Johtopäätös ei ollut "hyväksytään se" vaan
**"ei näytetä sitä näkymää"** — sama minkä Windy tekee.

Uloimmillaan näkyy Suomen pohjoisin piste (Nuorgam, 70,1°N) ja
päiväntasaajan eteläpuoli.

### Raja on leveysastevälissä, ei zoom-luvussa

Sama zoom näyttää eri määrän eri kokoisilla ruuduilla, joten kiinteä
`minZoom` olisi väärin joka toisella laitteella. Näkymän on katettava
tietty osuus maailman korkeudesta: maailman korkeus zoomilla z on
256·2^z pikseliä, ja vaadittu Mercator-väli on 28,5 % siitä.

```
                minZoom   näkyy pituutta
iPhone 15 Pro     3,54         47°
iPhone Pro Max    3,67         47°
iPhone SE         3,19         58°
iPad              4,01         71°
vaaka 932×430     2,86        180°
```

Asiat jotka eivät ole ilmeisiä:

- **Toinen ehto rajaa pituuspiirin puoleen palloon.** Vaaka-asennossa
  korkeus puolittuu, jolloin sama leveysastesääntö vaatisi niin paljon
  ulos zoomausta että vaakasuunnassa näkyisi koko maailma. Kumpi tahansa
  ehdoista sitoo, tiukempi voittaa — vaaka-asennossa leveysasteväli jää
  81 %:iin vaaditusta, ja se on tietoinen valinta: molempia ei voi saada
  näyttämättä koko palloa.
- **Uudelleenlaskenta `resize`-tapahtumassa.** Kääntäminen vaakatasoon
  puolittaa korkeuden, eikä `setMinZoom` itse siirrä karttaa jos ollaan
  jo rajan alapuolella.
- **Raja pitää kaikilla reiteillä**: `setZoom`, `setView`, `zoomOut` ja
  nipistys päätyvät kaikki samaan lukuun (testattu).

### Sitten data kannatti tihentää

Kun koko palloa ei enää näytetä, leveä näkymä kattaa niin pienen alueen
että tiheämpi hila alkaa kannattaa. Mitattuna tunnettua kenttää vasten
(RMS m/s, 4× kuristus):

```
   hila      uloin (z3,67)      z5
   2,5°    0.27 / 158 ms   0.32 /  21 ms    <- vanha
   1,25°   0.11 /  39 ms   0.10 /  50 ms    <- z<=4
   1,0°    0.08 /  56 ms   0.07 /  35 ms    <- z5-7
   0,5°    0.05 / 127 ms   0.03 /  42 ms
```

- **1,25° ja 1,0° osuvat SAMAAN laattatasoon (l2, 1°)**, joten ne
  hakevat täsmälleen samat laatat — ero on pelkkää interpolointia eikä
  yhtään lisätavua verkosta. 0,5° vaatisi l1:n, joka kattaa vain
  Pohjois-Euroopan.
- **Pistekatto oli nostettava 1600 → 3400**, muuten katto kasvattaisi
  hilavälin takaisin 2,5 asteeseen juuri siellä missä tihennys tehtiin.
- **`maxDim` uloimmalla kaistalla 200 → 260** (RMS 0.11 → 0.09).
  z5–6 pysyy 200:ssa: siellä sama pyyhkäisy antoi 0.07 kaikilla arvoilla
  200–340, eli rajoite on datahila eikä tekstuuri.
- **Sumennus ei ollut ongelma.** Se mitoitetaan kahteen texeliin, ja
  tiheämmällä tekstuurilla se on uloimmassa näkymässä 3 px eli
  alarajallaan.

### Mikä jää saavuttamatta

**Laattojen oma tarkkuus on katto.** Globaalilla tasolla l2 on 1°, eli
ECMWF:n 0,25° hilasta on heitetty pois 16 pistettä kuudestatoista.
Windy renderöi natiivin 0,25° hilan koko maailmalle, mutta se vaatisi
2592 laattaa ja 290 MB — ei tällä hostingilla. Uloin näkymä on siis
tarkempi kuin ennen mutta ei Windyn veroinen, ja syy on tallennustila
eikä koodi.

### Partikkelit

Tiheys 267 → 401 puhelimen ruudulla (jakaja 1500 → 1000) ja jälki
ohennettiin 2,15–4,45 px → 1,30–2,75 px. Tämä on **toinen tietoinen
poikkeama** mitatusta luettavuusoptimista (ks. `particleLineWidth`):
mittari maksimoi luettavuuden yhtä partikkelia kohti, mutta tiheässä
kentässä paksu jälki peittää lämpökartan alleen.

`PerfTracker`in leikkaus tehtiin **suhteelliseksi ruutunopeuteen**.
Kiinteä 0,7 tarvitsi viisi kierrosta eli noin 15 sekuntia ennen kuin
määrä asettui hitaalla laitteella, ja koko sen ajan kuva nyki. Tavoitetta
nostettiin, joten matka alas on pidempi ja askeleen on mukauduttava:
8 fps antaa kertoimen 0,35.

**Ruutunopeutta EI voitu mitata tässä ympäristössä.** Kontti pysyi
8–18 ruudussa sekunnissa riippumatta partikkelimäärästä (0 ja 700
antoivat saman luvun) ja riippumatta CPU-kuristuksesta — mikä kertoo
että pullonkaula on kontin kompositorissa eikä sovelluksessa. Tiheyden
nosto nojaa siis `PerfTracker`iin eikä mittaukseen, ja se on syytä
tarkistaa oikealla laitteella.

**Sudenkuoppa:** `resetParticles(kova)` kutsuu `PerfTracker.reset()`in,
joka palauttaa tavoitteen `nParticlesBase()`:iin. Partikkelimäärää ei
siis voi pyyhkäistä asettamalla `_targetParticles` ja kutsumalla
`resetParticles` — jälkimmäinen kumoaa edellisen.

## Rakeisuus oli kahta eri vikaa

Kartta näytti rakeiselta sekä lämpökartan että partikkelien osalta.
Kerrokset erotettiin toisistaan piilottamalla toinen kerrallaan, ja
lähikuvat kertoivat että **ne olivat kaksi täysin eri vikaa** — sama oire,
eri syy. Ilman erottelua kumpi tahansa korjaus olisi näyttänyt
riittämättömältä.

### 1. Tekstuurin texelit olivat venyneitä, eivät liian harvoja

`maxDim` rajasi molempia sivuja **samalla luvulla**, ja koska näkymä on
pystysuora mutta katettu alue leveä, tekstuuri oli **neliö venytettynä
suorakulmioon**. Mitattuna uloimmassa näkymässä:

```
tekstuuri 260×260  ->  elementti 466×997 CSS px
yksi texel = 1,79 px leveä ja 3,83 px korkea  = 2,1x venynyt pystyyn
```

Ja sumennus mitoitetaan **pituuspiirin** texelistä, joten venyneellä
texelillä se kattoi vaakasuunnassa kaksi texeliä mutta pystysuunnassa
alle yhden — vaakaraidat jäivät näkyviin. Vika ruokki itseään.

Korjaus: **budjetti on texeleissä, muoto tulee näkymästä.** Sivut
lasketaan katetun alueen RUUTUKOOSTA (`latLngToLayerPoint`) tavoitteella
noin 2 CSS px / texel, ja jos tulo ylittää budjetin, molempia kutistetaan
samalla neliöjuurella — jolloin muotosuhde säilyy.

```
             ennen              jälkeen
uloin   1,79 × 3,83 px      2,49 × 2,49 px
z5      2,61 × 5,62         2,56 × 2,55
z8      4,51 × 9,41         5,88 × 5,88
```

Texel on nyt neliö joka zoomilla, ja sumennus osuu molempiin suuntiin
samalla tavalla.

**Uloin kaista on kalliimpi kuin texelmäärä antaa ymmärtää**, koska siellä
datapisteitä on eniten (1,25° hila laajalla alueella) ja jokainen
IDW-solmu maksaa enemmän. Mitattuna kylmällä polulla 4× kuristuksella
110 000 texeliä → 327 ms, 75 000 → 233 ms. Budjetti on siksi siellä
pienempi kuin lähempänä; texel 2,5 px on yhä selvästi sumennuksen (4 px)
alle, joten kuva ei muutu — vain aika.

### 2. Partikkelit olivat pilkkuja, koska jälki oli lyhyt

Lähikuva partikkelikerroksesta yksin näytti sen suoraan: lyhyitä pilkkuja
eikä virtaviivoja. Syy **ei** ollut pituusraja `JALKI_MAX_PX`, vaikka niin
olisi luullut. Pyyhkäisy:

```
maxPx    32    48    64    80
pituus  18,9  19,7  20,2  19,3 px      <- raja ei pure lainkaan
```

Heikossa tuulessa pituuden ratkaisee **aikapituus** (`JALKI × ASKEL`
ruutua) kerrottuna ruutunopeudella, ja ruutunopeus oli niin pieni ettei
raja tullut koskaan vastaan. Oikea vipu oli `GEO_SPEED`:

```
GEO_SPEED   0,0030  0,0045  0,0060
pituus px     19,9    28,4    34,3
peitto  %     2,33    3,25    3,73
```

Alle 20 px jälki lukee pilkkuna. 0,005 antaa noin 30 px ja peiton 3,4 %,
joka osuu talon omaan mitattuun optimiin (3,55 %, ks.
`particleLineWidth`). Samalla `JALKI` 20 → 30, jotta aikapituus riittää
myös heikkoon tuuleen.

**Peitto oli koko ajan ALLE mitatun optimin**, sekä vanhoilla että uusilla
arvoilla (2,3 % vs 3,55 %). Tiheyttä ei siis tarvinnut nostaa enempää —
partikkeleita on 401 ja se riittää, kun jälki on oikean mittainen.

**Mittausansa:** `resetParticles(kova)` kutsuu `PerfTracker.reset()`in,
joka palauttaa tavoitteen `nParticlesBase()`:iin. Määrää ei siis voi
pyyhkäistä asettamalla `_targetParticles` ja kutsumalla `resetParticles`
— jälkimmäinen kumoaa edellisen. Pyyhkäisyssä on ylikirjoitettava
`PerfTracker.getTarget`.
