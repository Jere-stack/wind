# Lämpökartta, pohjakartta ja värit

Tuulikentän piirto ruudulle: pohjakartan valinta ja sävynsäätö, lämpökartan
sekoitustila, väriramppi, tekstuurin projektio ja mitoitus, kartan asetukset.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

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

## Eleen aikana laaja ja karkea, levossa tiukka ja terävä

Tekstuuri rakennettiin aina sen hetkiselle näkymälle 0,6 näkymän
pehmusteella. Se riittää vieritykseen mutta ei ulos zoomaamiseen: **jatkuva
zoom kasvattaa näkymää nopeammin kuin pehmuste kattaa**, joten jokainen
rakennus on valmistuessaan jo liian pieni. Reunoille jäi paljas
pohjakartta.

Ratkaisu on sama minkä pohjakartta jo tekee pysyvällä matalan zoomin
taustalaatallaan (ks. "Nopea zoom ei saa näyttää mustaa") ja sama minkä
laattapyramidi antaisi ilmaiseksi: **ulos zoomatessa näkyviin tulee
karkeampi mutta laajempi taso.** Kaksi tasoa riittää, kun toinen seuraa
näkymää ja toinen kattaa ympäristön.

| | pehmuste / sivu | kate | texelibudjetti |
|---|---|---|---|
| levossa | 0,6 näkymää (`PEHMUSTE`) | 2,2× lineaarinen | zoomin mukaan, 75–260 k |
| eleen aikana | 1,2 näkymää (`PEHMUSTE_ELE`) | 3,4× lineaarinen | kiinteä 90 k (mobiili) |

**Levon laatu ei muutu missään.** `zoom <= 5` -erikoistapaus (kiinteä
2 astetta) on ennallaan levossa; eleen aikana pehmuste on suhteellinen
myös siellä, koska juuri siellä näkymä kasvaa eniten — 2 astetta on z5:n
30 asteen näkymässä vain 6 %.

**Budjetti on eleen aikana KIINTEÄ eikä zoomista riippuva.** Aiemmin eleen
halpuus tehtiin jakamalla sivut `STEP/COARSE_STEP`:llä, mutta se ei käy
kun pehmuste on suuri: sama jakaja antaisi eri hinnan sen mukaan kuinka
laaja alue sattuu olemaan. Kiinteä budjetti rajaa työn suoraan
riippumatta katetusta alueesta — juuri niin kuin laattapyramidissa yksi
laatta on aina yhtä kallis.

`_heatmapCovers` saa zoomissa marginaalin (0,25) kuten siirrossakin.
Ilman sitä rakennus alkoi vasta kun reuna oli jo tullut ruudulle, ja
ulos zoomatessa se oli valmistuessaan jälleen myöhässä.

### Laaja pehmuste tarvitsee laajemman laattapeiton

Reiät hilassa täytetään reunan jatkeella, jotta kuvaan ei tule mustaa —
mutta jatke on arvaus, ei dataa. Kun pehmustetta kasvatettiin, tekstuuri
ulottui alueelle jolle laattoja ei ollut haettu, ja **reikien osuus nousi
13 %:sta 50 %:iin**: puolet hilasta oli levitettyä reunaa. Juuri se
reuna-alue on se joka tulee ruudulle seuraavaksi kun käyttäjä jatkaa ulos
zoomaamista.

Siksi hilapolku hakee puuttuvat laatat itse (`Saalaatat.varmista`
tulta-ja-unohda -kutsuna, 700 ms kuristuksella). `varmista` yhdistää jo
käynnissä olevat pyynnöt ja ohittaa muistissa olevat laatat, joten kutsu
ei voi kertautua. Tulos näkyy seuraavassa rakennuksessa, joita eleen
aikana tulee noin sekunnin välein. Mitattuna reiät putosivat takaisin
**50 %:sta 23 %:iin** laajimmassa näkymässä ja **0 %:iin** kaikissa
muissa, ilman että peitto muuttui.

**Tämä yksin ei riittänyt.** Peitto parani mutta jäi 9 %:iin, koska
varsinainen vika oli eleen aikaisessa jäädytyksessä eikä geometriassa —
ks. `docs/eleet.md`, "Lämpökartan jäädytys eleen aikana". Molemmat
tarvittiin: jäädytyskorjaus tekee näkyväksi sen mitä tekstuuri kattaa,
ja laaja pehmuste huolehtii että se kattaa tarpeeksi.

## Tekstuurin reuna häivytetään — raja ei ole viiva

Tekstuuri on suorakaide, ja sen reuna on **datan raja eikä mikään
kartalla oleva asia**. Kun reuna sattuu ruudulle, terävä katkoviiva
lukee virheenä: käyttäjän kuvassa väri loppui partaveitsenterävään
laatikkoon keskellä Atlanttia.

Peitto on korjattu erikseen (`docs/eleet.md`), joten reunan ei pitäisi
näkyä lainkaan. Häivytys on se varmistus jonka takia se ei näy
silloinkaan kun jokin menee pieleen — sama minkä Windy tekee datan
rajalla: häivytys, ei leikkaus.

Toteutus on kaksi CSS-liukua leikattuna toisillaan
(`mask-composite: intersect`), jolloin kaikki neljä reunaa häipyvät.
Kanvaasiin ei kosketa, joten molemmat rakennuspolut saavat sen
ilmaiseksi.

### Leveys on mitattu, ei kiinteä prosentti

Häivytys saa syödä vain sitä osaa tekstuurista joka on ruudun
**ulkopuolella**, ja pehmusteen osuus vaihtelee: levossa 0,6 näkymää per
sivu, mutta uloimmalla zoomilla kiinteä 2 astetta. Sama prosentti olisi
siellä liikaa.

`paivitaHaive()` ottaa leveydeksi puolet siitä marginaalista joka on
oikeasti ruudun ulkopuolella, katkaistuna 3,5 %:iin. Mitattuna:

| tila | häivytys | marginaali |
|---|---|---|
| lepo z3,6 | 4 px | 17 px |
| lepo z5 | 16 px | 46 px |
| lepo z7–z12 | 30 px | 236 px |
| uloin raja | 4 px | 17 px |
| kesken eleen | 29 px | 211 px |
| eleen jälkeen | 13 px | 38 px |

Kaikissa piilossa. Jos tekstuuri jostain syystä olisi näkymää pienempi,
osuus menee nollaan eikä häivytys pehmennä mitään pois.

### Sekoitus ei muuttunut

Maski luo oman kompositointitason, ja tämän tiedoston mukaan juuri
sellaiset muutokset on mitattava (ks. `will-change`). Vakioidulla
näkymällä ja hetkellä, keskialue 25–75 % × 35–65 %:

```
                keski RGB                  kontrasti
ennen    (40,63  88,09  47,97)               196,9
jälkeen  (41,60  88,98  48,40)               196,9
```

Kontrasti on identtinen ja keskiväri eroaa alle yhden yksikön 255:stä
eli ajojen välisen datan verran. `plus-lighter` ja rantaviivan kontrasti
säilyivät.

## Karkea pohjakerros — se mikä ei koskaan lopu kesken

Tarkka tekstuuri kattaa näkymän ja pehmusteen, ja se on oikea ratkaisu
levossa. Ulos zoomatessa se ei riitä millään pehmusteella: näkymä kasvaa
nopeammin kuin tekstuuri, ja jokainen kiinniottorakennus on
valmistuessaan jo liian pieni. Paljas kohta ei ole tyhjä vaan MUSTA,
koska alla on tumma pohjakartta ja lämpökartta on lisäävä.

Mitattuna edellisestä versiosta (iPhone-kokoinen näkymä, 4x kuristus,
300 ms verkkoviive), lämpökartan peitto ruudusta:

| tilanne | peitto min | ruutuja alle 99 % |
|---|---|---|
| ULOS + panorointi, sormet kiinni | 30,5 % | 2/73 |
| ULOS nopea, sormet kiinni | **14,8 %** | 3/59 |
| `setZoom(uloin)` | 0 % | — |
| `zoomOut(2)` | 0 % | — |

Yhtä tekstuuria ei ole olemassa joka olisi yhtä aikaa lähizoomin terävä
ja uloimman zoomin laaja — sama syy jonka takia karttalaatat ovat
pyramidi eikä yksi kuva. Tehtiin siis pyramidin kaksi alinta askelmaa:

- **tarkka kerros** näkymälle, kuten ennenkin
- **karkea pohjakerros** joka kattaa koko sen alueen johon uloin zoom
  yltää (2,7 uloimman näkymän mittaa keskipisteestä), 60 000 texeliä,
  rakennettu VAIN laattavarastosta ja VAIN levossa

`PohjaTekstuuri` perii `WindTexture`n, joten `build()` ja koko mitoitus
on yhteinen; erillistä ovat vain kangas, puskurit ja `kelpaa`-lippu.
`build` sai neljännen parametrin (`asetukset`), jolla pohja mitoitetaan
uloimmalle zoomille eikä sille jota katsotaan.

### Kaksi lisäävää kerrosta ei saa olla päällekkäin

Ensimmäinen yritys poisti tarkan kerroksen kohdan pohjan kankaasta
(`destination-out`, häivytysprofiili sama kuin CSS-maskissa). Se hajosi
mittauksessa: pohjan texel on lähizoomissa satoja ruutupikseleitä, joten
reikä ei mahdu sen hilaan. Mitattuna z9:llä reikä oli **3,4 x 7,1
texeliä** ja alfaa jäi keskelle **26/255** — kartalla se näkyi kirkkaana
laatikkona keskellä ruutua.

Kerrokset vaihtavat siis vuoroa. Peittotarkistus kertoo kattaako tarkka
kerros ruudun; jos kattaa, pohja on nollassa. Jos ei, pohja nousee
ykköseen ja tarkka laskee nollaan. Koska sekoitus on LINEAARINEN
(`plus-lighter`), summa on ristiinhäivytyksen jokaisessa vaiheessa tasan
yksi: kerrokset esittävät samaa kenttää eri tarkkuudella. Ei tummaa eikä
kirkasta rengasta missään vaiheessa.

Levon kuva ei muutu lainkaan. Mitattuna pikselivertailuna vanhaan
buildiin (partikkelit piilotettuna, kartta-alue):

```
z9  keskiero 0     max 0     kirkkaus 36,7 -> 36,7
z6  keskiero 0     max 0     kirkkaus 61,1 -> 61,1
z4  keskiero 1,43  max 21,4  kirkkaus 62,1 -> 62,0
```

z4:n ero on tarkoitettu: uloimman zoomin levon pehmuste oli KIINTEÄ
2 astetta, ja se jätti tekstuurin reunan vain **17 pikselin** päähän
ruudun reunasta. Nyt se on 0,30 näkymää (noin 190 px), ja texelbudjetti
nostettiin laattapolulla vastaavasti (75 000 -> 170 000), jolloin texelin
koko pysyi ennallaan.

### Liu'un aikana maantiede valehtelee

`_heatmapCovers` vertaa tekstuurin rajoja kartan rajoihin. Leafletin
zoom-liu'un aikana molemmat ovat jo LOPPUTILAN arvoja heti kun `_move` on
ajettu, mutta elementti on kesken transform-siirtymää. Jos siihen väliin
osuu `_reset`, koko on jo kohdezoomin mutta skaalaa animoidaan yhä —
mitattuna kerros renderöityi **470 px** levyisenä vaikka sen rajat
sanoivat **2563 px**, eli 393 px:n ruudusta jäi 70 % paljaaksi samalla
kun peittotarkistus sanoi "kattaa".

Liu'un ajaksi luetaan siis se mikä ruudulla oikeasti on
(`getBoundingClientRect` suhteessa karttasäiliöön). Se on asettelunluku,
mutta vain sen 250 ms ajan.

Samasta syystä tarkkaa kerrosta EI piiloteta liu'un aikana: piilotettu
kerros ei ole silloin korvattavissa, koska pohjakin on kesken siirtymää.
Mitattuna peitto putosi tässä ikkunassa nollaan, kun ristiinhäivytys
ajettiin liu'un aikana loppuun asti. Liu'un ajan molemmat ovat päällä;
summa on hetken yli yhden eli kuva on aavistuksen kirkkaampi.

Kiinniottorakennus siirrettiin kokonaan pois liu'un ajalta
(`_heatmapCatchUp` palauttaa työn `_hmPending`iin ja `zoomend` purkaa
sen), koska rakennuksen päätteeksi tuleva `setBounds` on juuri se
`_reset` joka aiheuttaa kaksinkertaisen kutistuksen.

### Tulos

Sama mittaus korjatulla buildilla, kaksi ajoa:

| tilanne | peitto min | ruutuja alle 99 % |
|---|---|---|
| ULOS + panorointi, sormet kiinni | 30,5 % / 28,1 % | 3/102, 3/95 |
| ULOS nopea, sormet kiinni | **100 %** | 0/98, 0/96 |
| SISAAN nopea | 100 % | 0/46, 0/39 |
| SISAAN + voimakas panorointi | 100 % | 0/46, 0/40 |
| `setZoom(uloin)` | **100 %** | 0/37, 0/33 |
| `zoomOut(2)` | **100 %** / 76,6 % | 0/32, 1/32 |

Jäljelle jää 3 ruutua yhdessä skenaariossa (raju ulosnipistys +
panorointi, sormet kiinni 2 s, sitten irrotus) liu'un aikana. Ruudulta
mitattuna — kaappaus eleen aikana, liu'un aikana ja levossa — tummaa
harmaata on 0,1–0,2 % ruudusta kaikissa vaiheissa, eli sitä ei näy.

Pohjan rakennus maksaa 4x kuristuksella mediaanina 43–49 ms (z4, z6, z9,
z12) ja se ajetaan vain levossa, 350 ms viiveellä liikkeen loputtua.

### Pohjan reikäraja on löysempi kuin tarkan

Pohja kattaa mannerten mittakaavan, ja sen reunoilla on aina meriä joita
varastossa ei ole. Mitattuna 46 % solmuista jäi ilman dataa — tarkan
kerroksen 50 %:n raja oli siis juuri ja juuri riittämätön, ja pohja jäi
satunnaisesti rakentamatta (`pohja EI` mittauksessa). Rajaksi tuli 0,9 ja
epäonnistunut rakennus yrittää uudelleen 1,8 s kuluttua, koska hilapolku
hakee puuttuvat laatat matkalla.

## Vuoronvaihto ei tullut tarkistetuksi kesken nipistyksen

Laitteella jäi yhä tilanne jossa kaksi sormea on näytöllä, kartta on
mannerten mittakaavassa ja ruudulla näkyy vain alkuperäinen suorakaide
värillisenä. Syitä oli kaksi ja molemmat olivat *ajastuksessa*, eivät
geometriassa.

**1. Nipistys ei lähetä tapahtumia.** Leaflet ajaa nipistyksen `_move`n
`supressEvent`-lipulla. Pohjakerroksen vuoronvaihto oli
`map.on('move zoom …')`in varassa, eli sitä ei kutsuttu koko eleen
aikana. Mitattuna z11:sta uloimpaan: tarkka kerros peitti ruudusta
**43 %**, peittotarkistus TIESI sen (`_peittaa` epätosi), mutta mikään ei
kysynyt. Nyt `nipistysAlkaa` käynnistää ruutukohtaisen silmukan joka
elää eleen loppuun.

**2. Peitto luetaan ruudulta myös nipistyksessä.** Eleen ajaksi kerros
jäädytetään (kiinteä koko + transform), ja tekstuuri rakennetaan
uudelleen kesken eleen: rajat kasvavat, elementti ei. Maantieteellinen
tarkistus sanoo silloin "kattaa" vaikka ruudulla on musta reunus. Sama
sääntö kuin liu'ussa: eleen ajan luetaan `getBoundingClientRect`.

**3. Pohjaa ei rakenneta eikä sijoiteta kesken nipistyksen.**
`State.liikkeessa` on epätosi nipistyksen aikana, koska `zoomstart` ei
tule. Ilman omaa ehtoa pohja rakennettiin keskellä elettä, jolloin
`setBounds` ankkuroi jäädytyksen uudelleen ja kerros lensi ruudun
ulkopuolelle (mitattuna z13 -> uloin, `x = -16 162 px`).

Mitattuna, ruudun peitto (nipistys lähtözoomista uloimpaan, sormet
kiinni 2,5 s, sitten irrotus):

| lähtözoom | ennen | jälkeen |
|---|---|---|
| z13 | 0 % (2 ruutua) | **100 %** |
| z11 | 39,1 % | 39,1 % *(1 ruutu, häivytyksen ensimmäinen)* |
| z9 | 100 % | 100 % |

Ja pääsarja: kaikki nipistysskenaariot **100 %**, 0 ruutua alle 99 %
(ennen 30,5 % ja 4/108).

### Häivytys on epäsymmetrinen

Symmetrisellä ristiinhäivytyksellä summa pysyy ykkösessä vain siellä
missä molemmat kerrokset peittävät. Juuri se alue jonka takia vaihto
tehdään on pelkän pohjan varassa, ja siellä symmetrinen ramppi tarkoittaa
120 ms puolipimeää. Esiin tuleva kerros nousee siis 60 ms:ssä ja väistyvä
laskee 200 ms:ssä: päällekkäisyys näkyy korkeintaan aavistuksen
kirkkaampana, eikä pimeää tule.

## Uloin raja ei saa nojata pelkkään getMinZoomiin

Käyttäjän laitteella kartan sai yhä zoomattua mannerten mittakaavan ohi
— kuvassa näkyi yhtä aikaa Grönlanti ja Sahara. Kuvasta laskettuna
näkymä kattoi 67 % maailman korkeudesta eli **z ≈ 2,3**, vaikka lasketun
rajan piti olla 3,54.

Syy ei ole joustossa vaan siinä mistä se lukee rajan. `uloinZoom()`
lasketaan kartan KOOSTA, ja `paivitaUloinZoom()` ajettiin vain kerran
käynnistyksessä ja `resize`ssä. Mobiilissa korkeus ei ole vakio:
osoiterivi piiloutuu ja palaa, turva-alueet ja näppäimistö muuttavat
sitä, ja kotivalikon appi käynnistyy eri kokoisena kuin selain. Jos
ensimmäinen laskenta osui pieneen korkeuteen, `minZoom` jäi pysyvästi
liian löysäksi — ja koska jousto lasketaan siitä, myös jousto oli
löysä.

Kaksi korjausta:

- `paivitaUloinZoom()` ajetaan myös `zoomstart`issa ja `movestart`issa.
  Se on kaksi logaritmia, joten se kelpaa eleen alkuun. Kesken eleen
  tai liu'un se ei siirrä karttaa, koska ele päättyy joka tapauksessa
  `_limitZoom`iin.
- `joustaZoom` lukee rajan MOLEMMISTA ja ottaa tiukemman:
  `Math.max(map.getMinZoom(), map._uloinZoom)`.

Testattu pakottamalla `setMinZoom(2)` kesken ajon ja ajamalla kolme
peräkkäistä rajua ulosnipistystä: raja palautui 3,544:ään, ele pysähtyi
3,295:een (0,25 tasoa ali) ja ruudun peitto oli 100 %.
