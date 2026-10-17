# Pohjakartta ja rannat (strategia ja toteutus 17.10.2026)

Käyttäjän pyyntö 17.10.: "Windyssä saarten, mantereen ja rantojen värit
ovat liukuvärjätty, hieman tummennettu, jotta ne erottaa selkeästi siitä
mistä vesi alkaa. Tarkistetaan parhaat karttavaihtoehdot jokaiselle
näkymälle ja tehdään suunnitelma. Ei vielä koodata." Tämä on se
suunnitelma: nykytila mitattuna, Windyn tapa sen omista laatoista,
vaihtoehdot kuvattuina oikean sovelluksen päällä ja suositus vaiheineen.
Strategiavaiheessa koodia ei muutettu; toteutus on luvussa
"Toteutus (17.10.)" lopussa.

## Tiivistelmä

- **Windy ei tummenna maata. Se tummentaa RANTAVEDEN, ja sen kartta on
  SÄÄN PÄÄLLÄ.** Windyn `darkmap`-laatta on musta kuva alfalla: avovesi ja
  maa ovat läpinäkyviä, ja veden puolella rannasta lähtee tumma liukuväri
  (alfa noin 0,6 rannassa → 0 noin 20–30 px:ssä) ja ohut rantaviiva.
  Meillä pohjakartta on sään ALLA ja sää summataan siihen (`plus-lighter`).
- **Sama tehoste meille on yksi GL-kerros lämpökartan päälle**, ja sen
  syöte on jo olemassa: `Rantamaski` lukee rannan näkyvästä pohjakartasta
  joka ruudussa. Mitattuna rannan kirkkausero (maa 0–6 px vs rantavesi
  0–6 px) kasvaa joka näkymässä: Helsinki 44,6 → 59,5, Saaristomeri
  30,6 → 43,8, Suomenlahti 24,6 → 44,0, Eurooppa 8,4 → 28,5, Bretagne
  30,6 → 62,2.
- **Maan tummentaminen HUONONTAA rantaa** (Helsinki 44,6 → 20,8,
  Eurooppa 8,4 → −0,9): meillä maa on jo vettä vaaleampi, joten maan
  tummennus sulkee juuri sen eron jota haetaan. Se on kokeiltu ja
  hylätty mittauksella.
- **Parempi karttajärjestelmä on olemassa: oma vektoripohja**
  (OpenFreeMap / OpenMapTiles, OSM-data, ei avainta eikä kiintiötä)
  omilla Yömeren väreillä, rinnevarjostuksella ja suomen- tai
  englanninkielisillä nimillä sään päällä. Se poistaa riippuvuuden
  Esrin vanhasta avaimettomasta osoitteesta (jonka ehdot ovat epäselvät)
  ja ratkaisee pohjakartan kielen (docs/julkaisu.md, auki 28.9.). Se on
  isompi työ kuin rantavarjo, ja sen hinta puhelimella on mittaamatta.
- **Suositus**: V1 rantavarjo nykyisen pohjan päälle (pieni, iso hyöty),
  V2 nimet sään päälle, V3 vektoripohja kokeiluna laitemittauksella,
  V4 Esri pois. Satelliitti tarvitsee rantavarjon eniten.

Kuvat ja vertailu: artefakti "Pohjakartan vaihtoehdot",
https://claude.ai/artifact/Vr5NTHe3iNn8meanJzc8ex (yksityinen). Kuvaus- ja kokoamisskriptit kuvataan alla
(Mittausasetelma).

## Nykytila mitattuna

- Pohja on Esri `World_Dark_Gray_Base` rasterina, `contrast(1.4)`
  (`--pohja-suodin` → `pohjanMaali`), retinalla 128 px:n laattoina
  (`POHJA_LAATTA`). Vesi ≈ 0 ja maa ≈ 57 suotimen jälkeen
  (docs/lampokartta.md "Pohjakartta").
- Lämpökartta summataan pohjaan (`ONE, ONE` = plus-lighter), joten ranta
  näkyy siksi että maa on vettä vaaleampi. Ero säilyy koko rampin yli,
  mutta se on pieni siellä missä sää on kirkas: Euroopan näkymässä
  (z4,6 Leaflet-asteikolla) rannan kirkkausero on 8,4/255.
- Samasta Esrin palvelusta riippuu kolme asiaa: pohja, taustalaatta
  (`pohja-tausta`) ja **`Rantamaski`** (aaltojen ja vuoroveden ranta,
  kynnys vesi ≤ 48, maa ≥ 60). Varatie on CARTO `dark_nolabels`.
- Nimistö on Esrin englanniksi z4–z6 eikä sitä ole z7:stä ylöspäin. Kieli
  oli julkaisun auki jäänyt kohta.
- **Esrin ehdot ovat epäselvät.** `services.arcgisonline.com/.../tile/`
  on vanha avaimeton osoite; Esrin nykyinen ohje on API-avain (2 M laattaa
  kuussa ilmaiseksi) eikä foorumilla ollut vahvistusta osoitteen
  elinkaaresta. Sovellus on siis yhden ulkopuolisen päätöksen päässä
  pohjakartasta JA aaltojen rantamaskista.

## Mitä Windy tekee (mitattu sen laatoista 17.10.)

`tiles.windy.com/tiles/v10.0/darkmap/{z}/{x}/{y}.png` on palettikuva
jossa on kaksi väriä: musta ja täysin läpinäkyvä. Kaikki kartta on mustan
alfaa. Viisi laattaa z5–z10 Suomen etelärannikolta:

- **Avovesi ja maa: alfa 0** (läpinäkyvä). Sää näkyy niiden läpi
  sellaisenaan.
- **Rantavesi: alfa nousee rantaa kohti.** Profiili z9:llä rannasta
  ulos: 78 → 20 → 11 → 4 → 0 (/255) noin 30 px:n matkalla; laaksoissa ja
  lahdissa suurin alfa 139–163 (0,55–0,64), koska kahden rannan varjot
  summautuvat. Pienet järvet tummuvat kokonaan.
- **Rantaviiva** on ohut tummempi reuna, tiet ja rajat 4–20 %:n alfalla
  maan päällä.
- Laatta piirretään sään PÄÄLLE. Nimet ovat sen päällä omana
  kerroksenaan.

Käyttäjän havainto "rannat tummennettu liukuvärillä" on siis tämä:
veden puolelle rannasta lähtevä varjo, joka tekee rannasta reunan
riippumatta siitä minkä värinen sää sen alla on.

## Vaihtoehdot

Jokainen vaihtoehto kuvattiin oikean sovelluksen tuotantobuildin päällä
(oikea lämpökartta, sama hetki, partikkelit pois vertailun ajaksi)
viidessä näkymässä: Helsinki z11,2, Saaristomeri z9,6, Suomenlahti z7,6,
Eurooppa z4,6 ja Bretagne z8,6 (Leaflet-asteikko).

Rannan kirkkausero = maa 0–6 px rannasta miinus vesi 0–6 px rannasta,
luminanssi 0–255, ruutukaappauksesta (vesimaski OpenFreeMapin `water`-
kerroksesta samassa näkymässä).

```
näkymä        nykyinen   A rantavarjo  A' maa tumma  B vektori+rinne  C = B + A   sat Esri  sat EOX
helsinki       +44,6       +59,5         +20,8          +37,0          +51,8      +19,3     +8,7
saaristo       +30,6       +43,8          +9,2          +29,5          +41,5       +7,4     −1,9
suomenlahti    +24,6       +44,0         +10,1          +24,3          +42,1       +0,1     −6,8
eurooppa        +8,4       +28,5          −0,9          +17,8          +35,6      −20,3    −13,9
bretagne       +30,6       +62,2         +16,6          +28,0          +58,2      +19,8     +7,8
```

Rantaveden oma kirkkaus putoaa varjossa 77 → 53 (Helsinki) ja avovesi
pysyy samana (87,0 → 86,9): varjo on vain rannassa.

### A. Rantavarjo nykyisen pohjan päälle (Windyn tapa)

Uusi GL-kerros lämpökartan jälkeen ja partikkelien alle: vesimaski →
Gauss-sumennus (σ noin 10 px lähellä, 6–8 px kaukana) → veden puolelle
`alfa = vesi · min(1, 2,2 · sumea(maa)) · 0,55`, ja ohut rantaviiva
maskin reunasta. Kuvissa tämä laskettiin Pythonilla samasta maskista;
varjostimessa se on kaksi erotettavaa Gauss-vaihetta ja yksi kopio.

- **Syöte on jo olemassa**: `Rantamaski.puskuriin` piirtää maskin ruudun
  kokoiseen puskuriin samalla projektiolla kuin pohjakartta (M2,
  docs/aallot.md). Varjo voidaan sumentaa NELJÄNNESRESOLUUTIOLLA, koska
  liukuväri ei tarvitse pikselin tarkkuutta (rantaviiva otetaan täyden
  resoluution maskista).
- **Hinta on liikkeessä**, kuten lämpökartalla (docs/lampokartta.md:
  pikselikohtainen lisähaku maksetaan joka eleen ruudussa). Neljännes-
  resoluutiolla sumennus on 1/16 lämpökartan sumennuksen pikseleistä.
  Mitattava SwiftShaderilla suhteena ja puhelimella oikeasti.
- **Tuuliväri tummuu rannassa.** Tämä on vaihtoehdon todellinen hinta:
  rampissa kirkkaus kantaa nopeuden, ja 0,55:n varjo saa rannan 10 m/s:n
  vihreän näyttämään hiljaisemmalta. Windy hyväksyy saman. Vaihtoehdot:
  kapeampi ja kevyempi varjo (σ 6, 0,35), tai varjo vain viivana ja
  kapeana hehkuna. Kapseli ja aikajana lukevat lukua eivätkä väriä, joten
  ne eivät muutu. **Päätettävä P1.**
- Säännöt: "kartalla sävy tarkoittaa tuulennopeutta" pysyy — varjo on
  mustaa alfaa, ei sävyä. Aalto- ja vuorovesitilassa varjoa ei tarvita
  samalla tavalla (siellä maa on jo tumma ja ranta maskattu); kuvissa
  (Saaristomeri, aallot) varjo ei tuonut näkyvää eroa. Ei mitattu.

### A'. Maan tummennus (hylätty)

Maa tummaksi (alfa 0,30) ja kevyempi rantavarjo. Rannan ero putosi
joka näkymässä (taulukko). Plus-lighter-pinossa maa on se vaaleampi
puoli; sen tummentaminen vie eron. Älä toteuta tätä "Windyn tapana" —
Windy ei tee sitä.

### B. Oma vektoripohja (OpenFreeMap / OpenMapTiles)

`tiles.openfreemap.org/planet` (TileJSON, vektorilaatat OSM:stä,
OpenMapTiles-skeema). Ei avainta, ei rekisteröintiä, ei kiintiötä;
lähdemerkintä "OpenFreeMap © OpenMapTiles Data from OpenStreetMap" on
pakollinen. Ei SLA:ta. Kuvissa tyyli oli viisi kerrosta: maa `#2b3039`,
vesi `#04070d`, joet, valtioiden rajat katkoviivana, pääväylät z9:stä.

- **Rinnevarjostus**: Mapterhorn (`tiles.mapterhorn.com`, Terrarium-
  koodattu korkeusmalli, 512 px WebP, avoin data, lähdemerkintä
  vaaditaan) MapLibren omana `hillshade`-kerroksena (korostus 0,45).
  Suomessa vaikutus on pieni; Norjassa, Alpeilla ja Bretagnessa se tekee
  maasta maata. Kuvissa rinne on maan päällä ja veden alla.
- **Nimet sään päällä** (`symbol`, OpenFreeMapin fontit, `name:fi` →
  latina → paikallinen; englanniksi `name:en`). Valtiot, kaupungit,
  taajamat. Kieli tulee sovelluksen `KIELI`stä — sama sääntö kuin
  muussa tekstissä.
- **Esri-riippuvuus poistuu**, ja `Rantamaski` voisi piirtää maskinsa
  suoraan vektoriveden täytöstä (puhdas reuna, ei JPEG-kynnystä).
- Vektoripohja yksin ei paranna rantaa (taulukko: sama kuin nykyinen);
  sen hyöty on hallinta (värit tokeneista, kieli, rinne, terävyys
  retinalla) ja riippumattomuus. Ranta paranee vasta varjolla (C).
- **Hinta**: tyylin ylläpito ja fontit (`glyphs`), vektorilaattojen
  piirto ja dekoodaus (MapLibren työsäikeissä, mutta GPU:lle enemmän
  kuin rasteri), ja kolmas palvelu (OpenFreeMap) ilman SLA:ta.
  Varatienä olisi joko nykyinen Esri-rasteri tai oma Protomaps
  PMTiles-pote (Pagesin 1 Gt raja ei riitä koko maapallolle; Eurooppa
  rajatulla zoomilla mahtuisi, tai Cloudflare R2).

### C. Suositus: B + A + nimet

Vektoripohja rinteineen sään alla, rantavarjo sään päällä, nimet
päällimmäisinä (partikkelien ja merkkien alla). Rannan ero on paras tai
lähes paras joka näkymässä (taulukko), ja Euroopan näkymä on ainoa
jossa se on selvästi paras (35,6 vs 28,5), koska vektorin vesi on
tummempaa kuin Esrin.

### D. Satelliitti

- **Esri World Imagery plus-lighterillä pesee sään**: rannan ero 0,1 …
  −20,3 (vesi on kuvassa maata vaaleampaa auringon heijastuksesta ja
  matalikoista), ja kirkas maa + sää saturoituu. Pohjaa pitää tummentaa
  (`raster-brightness-max` noin 0,6–0,7) ja rantavarjo tarvitaan
  kipeimmin juuri tässä.
- **EOX Sentinel-2 cloudless** on tummempi ja tasaisempi, mutta 2018–
  vuosien mosaiikit ovat **CC BY-NC-SA 4.0** (ei kaupallinen); vain 2016
  on CC BY 4.0. Lisenssi tarkistettava ennen käyttöä (vrt. UKV:n
  CC BY-SA, CLAUDE.md "LISENSSI TARKISTETAAN LÄHTEESTÄ").
- Suositus: pidä Esrin satelliitti, tummenna sitä, lisää rantavarjo.

### E. Avaimelliset palvelut (ei suositella nyt)

MapTiler, Stadia, Esri Vector Basemaps ja CARTO GL antavat valmiin
vektorityylin, mutta avain on julkinen (sivu on yksi HTML) ja kiintiö on
käyttäjäkohtainen kustannus — sama syy jonka takia säädata on omassa
varastossa. Omaa tyyliä ne eivät säästä, koska Yömeren värit ja kieli
on joka tapauksessa tehtävä itse.

### F. Maapallo-projektio (ei tässä)

MapLibre 5 osaa `globe`-projektion, mutta jokainen custom-kerros
(lämpökartta, partikkelit, sade, aallot, vuorovesi, maski) olettaa
Mercatorin. Erillinen hanke.

## Kerroksittain

| kerros | mitä pohjalta tarvitaan | suositus |
|---|---|---|
| Tuuli, puuska | ranta erottuu kirkkaan sään alta, kaukaa maat | rantavarjo (A), nimet päälle, vektori + rinne (C) |
| Aallot | maa tummana, ranta = maskin raja | ei rantavarjoa; maski vektorivedestä kun B tulee |
| Vuorovesi (beta) | sama kuin aallot | sama kuin aallot |
| Sade (beta) | sade on myös maalla; ranta kevyesti | kevyt rantavarjo (alfa noin 0,3) tai ei mitään — mitattava |
| Satelliitti | kuva ei saa pestä säätä | tummennettu Esri + rantavarjo |

## Zoomeittain

- **Kaukaa (z ≤ 5)**: maanosat ja nimet. Rantavarjo kaventuu (σ 6 px),
  rinne näkyy vuoristoissa. Esrin englanninkieliset suurnimet korvautuvat
  sovelluksen kielellä.
- **Keskitaso (z6–z9)**: saaristo. Tässä nykyinen on heikoin
  (Saaristomeri: pienet saaret hukkuvat kirkkaaseen säähän), ja varjo
  auttaa eniten.
- **Lähellä (z10+)**: tiet ja taajamat näkyvät jo nyt; varjo tekee
  lahdista ja salmista luettavia.

## Vaiheet

1. **V1 rantavarjo** nykyisen Esri-pohjan päälle `Rantamaski`n
   puskurista: uusi GL-kerros, neljännesresoluution Gauss, rantaviiva.
   Tuulella, puuskalla ja satelliitilla; aalto- ja vuorovesitilassa pois.
   Mittari: rannan kirkkausero (yllä) ja ruutuaika SwiftShaderilla
   suhteena + puhelin.
2. **V2 nimet sään päälle** OpenFreeMapin `place`-kerroksesta, sovelluksen
   kielellä; Esrin omat nimet jäävät silloin pohjaan (z4–z6), joten V2 on
   järkevä vasta V3:n kanssa tai Esrin nimettömän pohjan kanssa.
3. **V3 vektoripohja kokeiluna** (`?pohja=vektori`, ei tallennu): tyyli
   tokeneista, rinne, lähdemerkinnät Tietoa-näkymään ja
   `#pohja-lahteet`iin. Mitattava puhelimella: ensimmäinen näkymä, tavut,
   panorointi ja zoom.
4. **V4 Esri pois oletuksesta**: `Rantamaski` vektorivedestä, Esri-rasteri
   varatieksi (CARTO-varatien paikalle), satelliitti tummennettuna.

## Päätettävät

- **P1** Rantavarjon voimakkuus: Windyn taso (0,55, noin 30 px) vai
  kevyempi (0,35, noin 18 px) koska tuuliväri tummuu rannassa?
- **P2** Nimet kartalla: kyllä (Windyn tapa, sovelluksen kielellä) vai
  ei (nykyinen: ei nimiä z7:stä)?
- **P3** Rinnevarjostus: kyllä vai ei? Suomessa pieni hyöty, muualla iso.
- **P4** Vektoripohjan palvelu: OpenFreeMap suoraan, vai oma PMTiles-pote
  heti alusta?
- **P5** Satelliitin lähde: tummennettu Esri, vai EOX (NC-lisenssi)?

## Mittausasetelma

Sovellusta ei muutettu. Tuotantobuild (`npm run build`, `vite preview`),
Playwright + Chromium SwiftShaderilla, 900 × 620, `?perf=1`, partikkelit
pois, käyttöliittymä piilotettu. Vaihtoehtojen kerrokset lisättiin
ajossa `FS.State.map.ml`:ään ennen `lampokartta`-kerrosta (pohjat) tai
ilman ankkuria (nimet), ja näkyvyyttä vaihdettiin tiloittain samassa
näkymässä, joten sää ja hetki ovat samat joka kuvassa. Vesimaski
(`m-vesi`: OpenFreeMapin `water` valkoisena mustalla) kuvattiin samassa
näkymässä lämpökartta pois. Rantavarjo ja maan tummennus koottiin
maskista Pythonilla (Gauss-sumennus, σ 11 / 8 / 6 px näkymän mukaan),
eli kuvat näyttävät varjostimen tuloksen ilman varjostinta. OpenFreeMapin
ja Esrin rantaviivat eroavat paikoin pikselin tai kaksi, mikä näkyy
A-kuvissa ohuena erona maskin ja Esrin rannan välillä; toteutuksessa
maski on aina näkyvän pohjan oma.


## Toteutus (17.10.)

Käyttäjän päätökset strategian jälkeen: suositus C (oma vektoripohja +
rantavarjo + nimet), rantavarjo **kevyempi** kuin kuvissa ("se oli aika
vahva"), **nimet kartalle** (P2), **rinnevarjostus** (P3), **oma
karttatiedosto alusta asti** (P4: "jotta kaikki ovat yhdellä levyllä,
ettei ne pompi eri aikaan tai lataudu huonosti") ja **satelliitti
tummennettuna Esrinä** (P5).

### Rakenne

- **Rakentaja `tools/pohjakartta.mjs`** (vain Noden omat moduulit) ja
  **`tools/pmtiles.mjs`** (PMTiles v3 -kirjoitus ja -luku). Ajo käsin:
  `node tools/pohjakartta.mjs <hakemisto>`, noin 12 min ja 250 Mt.
  - **Vektori** Protomapsin päivittäisestä OpenStreetMap-rakennuksesta
    (`build.protomaps.com/<pvm>.pmtiles`, ODbL), luettuna Range-
    pyynnöillä vain tarvittavat laatat. Laatoista jätetään maa (`earth`),
    vesialueet (`water`, ei riuttoja; merten nimipisteet), valtioiden
    rajat, paikat (valtio, taajama) ja moottoritiet — kohteiden tavut
    kopioidaan sellaisinaan, joten geometriaa ei koodata uudelleen.
    Suodatus pudottaa 1 578 Mt → 196 Mt (maankäyttö oli valtaosa).
  - **Kolme kerrosta** (`TASOT`, sovelluksessa `POHJA_TASOT`): maailma
    z0–6 (17,6 Mt), Eurooppa z7–10 (−32…45° E, 26…72° N; 153 Mt kolmessa
    osassa), rannikko z11–12 (Suomen rannikko ja Pampus; 21,7 Mt).
  - **Osat alle 90 Mt**: GitHubin tiedostoraja on 100 Mt. Liian suuri
    kerros jaetaan pituussuunnassa kerroksen alimman zoomin laattarajalta
    (`kirjoitaOsat`), joten jokainen tarkempi laatta kuuluu kokonaan
    yhteen osaan. Luettelo kertoo osan z-välin ja x-välin.
  - **Rinne** Mapzen Terrain Tiles -korkeusmallista (AWS Open Data,
    Terrarium-PNG): 3 × 3 -mosaiikista, joten laattarajalla ei ole
    saumaa; Sobel-rinne, valo luoteesta (45°) ja heikompi lännestä,
    korostus kasvaa loitonnettaessa (z9 2,2× … z0 14×). Tulos harmaa +
    alfa (varjo musta ≤ 0,62, valo valkoinen ≤ 0,20), meri ja tasainen
    läpinäkyviä, alfa 8:n portain (tiedosto puolittuu, porras ei näy).
    Maailma z0–6 ja Eurooppa z7–8: 56,7 Mt, 4 241 / 9 494 laattaa tyhjiä
    (tallentuvat kerran).
  - **Fontit** Noto Sans Regular ja Medium (SIL OFL,
    protomaps/basemaps-assets), seitsemän Unicode-aluetta: 1,4 Mt.
  - Jokainen kirjoitettu laatta luetaan takaisin omalla lukijalla ennen
    kuin rakennus on valmis.
- **Julkaisu: orpo haara `pohjakartta`** (yksi committi, pakkopäivitys,
  kuten `saadata`), luettuna `raw.githubusercontent.com/Jere-stack/wind/
  pohjakartta/`. Vercel ja Tarkistus ohittavat haaran (`vercel.json`,
  `ci.yml`). Tiedostonimissä on rakennushetki, joten vanha istunto ei
  koskaan lue uutta tiedostoa vanhalla hakemistolla.
  ```
  node tools/pohjakartta.mjs /tmp/pk
  git worktree add --orphan -b pk-uusi /tmp/pkwt && cp -r /tmp/pk/* /tmp/pkwt/
  (cd /tmp/pkwt && git add -A && git commit -m "Pohjakartta <versio>" \
     && git push -f origin pk-uusi:pohjakartta)
  ```
  (Mukaan `vercel.json` `{ "git": { "deploymentEnabled": { "pohjakartta":
  false } } }` ja README, kuten ensimmäisessä julkaisussa.)
  **Pages ei ole päällä** (404), joten koti on raw. Range-pyyntö
  `bytes=a-b` on CORS-turvallinen otsake kaikissa nykyselaimissa
  (Chromium, Firefox 117, WebKit 2022), joten raw ei tarvitse
  esitarkistusta — sen OPTIONS-vastaus on 403, joten muu otsake ei
  toimisi.
- **Sovellus**:
  - `Pmtiles` — selaimen PMTiles-lukija (otsake + juuri yhdellä
    16 kt:n pyynnöllä, lehdet muistiin, purku `DecompressionStream`illa).
  - `Pohjakartta` — luettelo (8 s:n aikaraja), osan valinta (z, x),
    MapLibren protokolla `fsp://pohja/…` ja `fsp://rinne/…`, rinteen
    puuttuvan laatan suurennus emosta (Euroopan ulkopuolella z7–8) ja
    **vesimaski** `Rantamaski`lle: maskilaatta piirretään saman vektorin
    vesialueista syvimmästä kerroksesta jolla on laatta (`Mvt` purkaa vain
    `water`-tason renkaat, Canvas 2D täyttää). Tila `pois` (luettelo ei
    auennut tai selain ei osaa purkaa) → Esrin tumma rasteri ja sen
    maski kuten ennen.
  - **Tyyli** (`karttaTyyli`): jokaisella kerroksella oma lähde, ja maa
    ja vesi täytteinä karkeimmasta tarkimpaan; rinne täyttöjen päällä
    (opasiteetti 0,85); viivat ja nimet maailmasta alle z7 ja Euroopasta
    z7:stä ylöspäin (Euroopan ulkopuolella z ≥ 7 ei siis rajoja eikä
    nimiä — hinta tiedoston koosta). Värit ovat tokeneita (`--kartta-maa`
    `#2B3039`, `--kartta-vesi` `#04070D`, raja, tie, nimi, halo) Esrin
    suodatetun pohjan tasolla, koska lämpökartta summataan pohjaan.
  - **Nimet sään päällä** (Windyn tapa): custom-kerrokset lisätään
    `yla-raja`-kerroksen eteen (`kerrosEnnen`), partikkelit mukaan
    lukien. Kieli `KIELI`stä (`name:fi` → `name:en` → `name`), valtiot
    versaalina ja himmeämpänä, kaupungit väestön mukaan, Protomapsin
    `min_zoom` harventaa.
  - **`RantavarjoGL`** lämpökartan, sateen, aaltojen ja vuoroveden päällä
    ja partikkelien alla: `Rantamaski`n ruudun kokoinen vesimaski →
    maa sumeaksi neljännesresoluutiolla (kaksi erotettavaa 25 haun
    vaihetta, vain kun maski tai leveys muuttui) → yksi veto: varjo =
    vesi · (2,2 · sumea maa)^0,9 · 0,38 ja rantaviiva 0,34 maskin
    gradientista. σ = 3 + 0,6·z CSS px, enintään 10. Pois aalto- ja
    vuorovesitilassa, sadetilassa 0,6-kertainen, mukana satelliitilla.
  - **Satelliitti**: Esrin World Imagery `contrast(1.2) brightness(0.62)`
    (`--pohja-suodin`), nimet ja rajat päällä, rantavarjo päällä.
  - **Service worker**: arkistot ja fontit välimuistiin (`pohjakartta-v2`,
    avain osoite + tavuväli KYSELYNÄ `?tavut=a-b`, vastaus 200 täsmälleen
    pyydetyn mittaisena ja talletetaan vain silloin, katto 4 000 riviä) —
    kartta toimii rannalla ilman verkkoa jos alue on katsottu.
    **v1:n avain oli `osoite#bytes=a-b`, ja Cache API jättää fragmentin
    avaimesta pois** (käyttäjän raportti 17.10.: "todella sumea näkymä,
    hetkellisesti tarkempia laattoja mutta ei mitään pysyvää"): jokainen
    tavuväli osui saman arkiston ensimmäiseen talletettuun väliin, joten
    ensimmäinen lataus piirsi kartan ja SW:n ottaessa ohjat yksikään
    laatta ei jäsentynyt — ruudulla oli pelkkä lämpökartta. Mitattu
    puhelinkontekstissa SW päällä: toinen lataus 0 piirrettyä
    pohjapiirrettä (v1) → sama kuin ensimmäinen (v2), z11 rannikko 11
    vesimonikulmiota. Aiemmat testit ajettiin `serviceWorkers: 'block'`,
    eivätkä ne nähneet tätä — pohjakartan testi ajetaan SW:n kanssa ja
    kahdesti.
  - Lähdemerkintä (`POHJAT.tumma.attr`, Tietoa): OpenStreetMap-tekijät,
    Protomaps, Mapzen Terrain Tiles; varatiellä Esri.

### Mitattu

Rannan kirkkausero (maa 0–6 px − vesi 0–6 px rannasta, 0–255), oikea
sovellus, tuotantobuild, sama hetki, partikkelit, nimet, rinne ja viivat
pois mittauksen ajaksi; maski samasta näkymästä lämpökartta pois:

```
näkymä         Esri (ennen)   oma ilman varjoa   oma + rantavarjo
helsinki          +44,6            +37,2              +52,4
saaristo          +30,6            +29,8              +45,8
suomenlahti       +24,6            +23,1              +40,8
eurooppa           +8,4            +18,1              +28,6
bretagne          +30,6            +31,1              +54,7
```

Kevennetty varjo (0,38 / 0,34) antaa saman suuruusluokan kuin
suunnitelman 0,55 (suunnitelmassa 59,5 / 43,8 / 44,0 / 28,5 / 62,2).
Eurooppa paranee myös ilman varjoa, koska vektorin vesi on tummempaa
kuin Esrin.

Hinta liikkuvassa ruudussa (SwiftShader, 900 × 620, sama näkymä,
24 siirtoa kierroksella, viisi kierrosta vuorotellen, mediaanit):
rantavarjo päällä 238,6 / 201,4 / 192,1 / 210,2 / 191,6 ms, pois
177,7 / 188,8 / 172,8 / 175,4 / 175,5 ms → **201,4 vs 175,5 ms (+15 %)**.
Kontti ei mittaa laitteen aikaa; suhde kertoo että hinta on pieni
lämpökartan liikkuvaan ruutuun nähden (docs/lampokartta.md). Puhelimella
mittaamatta.

Tarkistettu selaimessa: luettelo aukeaa raw:sta (`tila ok`), Range-
haut ilman esitarkistusta, nimet suomeksi ja englanniksi (`?kieli=en`),
aaltotilan ranta oman vektorin maskista, satelliitti tummennettuna,
maailma z1,8 … Helsinki z13,2. Savutesti läpi puhelimella ja
työpöydällä. `tools/graafimittaus.mjs` kaatui kontissa (myös edellisellä versiolla)
ja CI:ssä tämän muutoksen jälkeen kohtaan "veto heti vierittää, kierros
2": −106 px joka kerta, eli kierroksen 1 heitto oli jättänyt kaavion
106 px:n päähän päädystä ja testi mittasi rajaa eikä elettä. Testin veto
alkaa nyt vierityksen keskeltä; 2/2 ajoa läpi.

### Mitä jäi

- **Euroopan ulkopuolella z ≥ 7** pohja on maailman z6-laatta
  suurennettuna, ilman rajoja ja nimiä, ja rinne suurennettu z6:sta.
  Laajennus on rivi `TASOT`iin (ja koko kasvaa).
- **Rannikko z11–12** vain Suomen rannikolla ja Pampuksella. Muualla
  Euroopassa lähizoom on z10-geometriaa suurennettuna (pienet saaret
  pyöristyvät). Uusi spotti Suomen ulkopuolelle → `SPOTIT`.
- **Päivitys on käsityötä** (kuten `tools/vuorovesi.py`): OSM:n muutokset
  rantaviivassa ovat harvinaisia. Jos ajastat sen, julkaise kuten
  `saadata` (orpo committi, pakkopäivitys).
- **Pages**: kun Pages kytketään päälle, kodiksi voi lisätä Pagesin kuten
  säälaatoille (`SAALAATAT_KANNAT`) — nyt yksi koti.
- **Kerrosvalitsimen esikatselukuvat** (`KerrosKuvat`) piirtävät yhä
  vanhan pohjan sävyt ja vaalean rantaviivan; pieni ero.
- Ruutunopeus puhelimella ja iPadilla mittaamatta.

## Strategia 2 (17.10.): laattaneliöt, kömpelyys ja kaupunkitaso

Käyttäjän raportti oman pohjan julkaisun jälkeen (iPhone, kuvakaappaus):
nopeassa ulos-zoomissa kartalle jää **neliöitä** (Suomen kohdalla
tarkempi suorakaide järvineen muun kartan keskellä), kartta tuntuu
**kömpelömmältä ja hitaammalta** kuin Esrin aikana, ja lähellä halutaan
**kadut, tiet ja kaupungit**, jotta spotin ja parkkipaikan voi
kohdistaa. Tämä luku on strategia; mitään ei ole vielä koodattu.

### Mitattu

Tuotantobuild, puhelinkonteksti (390 × 844, `hasTouch`), SwiftShader.
Kontti ei mittaa laitteen aikaa, mutta kahden pohjan SUHDE on mitattavissa
samalla liikesarjalla (`easeTo` 900 ms × 6 näkymää z4,2–11, Helsinki ↔
Saaristomeri ↔ Itämeri), kolme kierrosta vuorotellen, mediaanit:

```
                     liikkuvan ruudun   kartta valmis    pääsäikeen pitkät
                     aika (med / p90)   liikkeen jälkeen  tehtävät / liike
Esri-rasteri (ennen)    272 / 345 ms       2,8 s (max 3,4)      2,4 s
oma vektori (nyt)       271 / 351 ms       4,9 s (max 7,8)      4,2 s
```

**Liike itse ei ole raskaampi; raskaus tulee liikkeen PERÄÄN**: kartta
asettuu 77 % hitaammin ja pääsäie on 73 % pidempään varattu. Se on juuri
"kömpelö": seuraava ele osuu kesken laattojen käsittelyä. Erittely
(sama asetelma, osa kerrallaan pois, idle / pitkät tehtävät, liikkuva
ruutu):

```
oma vektori, kaikki            4,5 s / 3,8 s   316 ms
ilman vesimaskia + rantavarjoa 3,7 s / 3,3 s   216 ms
ilman rinnevarjostusta         4,0 s / 3,3 s   255 ms
ilman nimiä                    4,3 s / 3,6 s   288 ms
```

- **Vesimaski + rantavarjo on suurin yksittäinen erä** (−0,8 s, liikkuva
  ruutu kolmanneksen kevyempi). `Pohjakartta.vesimaski` purkaa MVT:n ja
  rasteroi sen 2D-kankaalle ja `getImageData`lla PÄÄSÄIKEESSÄ jokaiselle
  maskilaatalle, ja `RantavarjoGL` ajaa kolme puskurivaihetta jokaisessa
  liikkuvassa ruudussa.
- **Rinne** −0,5 s: puuttuva laatta (Euroopan ulkopuolella z7–8)
  suurennetaan kankaalla ja koodataan PNG:ksi pääsäikeessä, vaikka
  MapLibre osaisi suurentaa rasterin itse GPU:lla.
- **Nimet** −0,1…0,3 s (symbolien sijoittelu).
- **Loput ~1,5–2 s on laattaputki itse**: jokainen laatta on raw.
  githubusercontent.comista kaksi peräkkäistä Range-pyyntöä (lehti-
  hakemisto, sitten laatta), mediaani **0,40 s**, p90 0,95 s, max 1,8 s
  pyyntöä kohti (231 pyyntöä yhdessä ulos-zoomissa). raw on
  tiedostopalvelin eikä laatta-CDN: välimuisti 300 s, ja harvoin luettu
  tavuväli on aina välimuistin ohi. Vertailuksi OpenFreeMapin laatta
  (yksi pyyntö, Cloudflare): 0,19–0,75 s kylmänä, 0,16–0,18 s toisella
  kerralla, ja selaimen HTTP-välimuisti toimii tavallisesti.

**Neliöt** toistuvat kontissa: ulos-zoomin jälkeen 1,5 s:n kohdalla
kartta on tilkkutäkki (vaakasauma ja Suomen kohdalla z6-laatat järvineen
z4,6:ssa), 12 s:n kohdalla valmis. Syy on MapLibren oma tapa: kun
uuden zoomin laatta ei ole vielä valmis, se piirtää paikalle muistissa
olevat TARKEMMAT lapsilaatat — ja muistissa ovat juuri ne joita katsottiin
äsken, eli spotin ympäristö. Puhelimella hitaammalla yhteydellä
välitila kestää pidempään, ja kaksi omaa vikaa pidentää sitä:

1. **Protokolla ei kuuntele keskeytystä** (`addProtocol`in
   `AbortController`): nopeassa eleessä hylätyt laatat haetaan silti
   loppuun ja ne jonottavat uusien edellä.
2. **Kaatunut arkiston avaus muistetaan istunnon loppuun**
   (`Pohjakartta._arkistot`: `a.alku` hylätty → jokainen sen osan laatta
   kaatuu). Yksi verkkokatko otsakkeen haun aikana jättää osan alueesta
   lapsilaattojen varaan pysyvästi — tämä selittää "jää".

### Kaupunkitaso: mitä tarvitaan

Spotin ja parkkipaikan kohdistus vaatii z13–16: kadut ja niiden nimet,
pysäköintialueet (P), kevyen liikenteen väylät, laiturit ja hento
rakennuskerros. Nyt arkisto loppuu z12:een ja siinä on vain moottoritiet;
Suomen rannikon z11–12 on raakana 134 Mt ja suodatettuna 22 Mt.
OpenFreeMapin z14-laatassa Helsingissä (tarkistettu) on `transportation`
(`service`, `parking_aisle`, `footway`), `transportation_name`, `poi`
(`parking`), `building` ja `landuse` — 85–155 kt laatta.

### Vaihtoehdot

**K1. Korjataan oma pohja, ei kaupunkitasoa.** Keskeytys protokollaan,
kaatuneen arkiston uusinta, maailman z0–4 esiladataan käynnistyksessä
(noin 2 Mt: ulos-zoomissa on aina emo eikä lapsia), rinne kahtena
natiivina rasterilähteenä rajoineen (ei kangasta), vesimaski
työntekijäsäikeeseen (`OffscreenCanvas`) ja vain levossa. Arvio: neliöt
lyhenevät ja jälkikuorma laskee lähelle Esriä, mutta 0,4 s:n raw-viive
ja kaksi kierrosta laattaa kohti jäävät. **Ei katuja.**

**K2. Oma arkisto z13–15 rannikolle ja spottien ympärille.** Sama
rakentaja, `TASOT`iin uusi kerros (kadut, nimet, pysäköinti, rakennukset).
Arvio Suomen rannikolle 0,5–1 Gt (z11–12 raaka 134 Mt, jokainen taso
noin 2,5–3 ×), eli kymmenkunta 90 Mt:n osaa raw:ssa — hitain koti
suurimmalle datalle. Kaupunkitaso vain siellä missä se on rakennettu:
Euroopassa ei. **Ei suositella.**

**K3. OpenFreeMap koko vektoripohjaksi** (OpenMapTiles-skeema, koko
maailma z0–14 ja suurennus z18:aan, ei avainta eikä kiintiötä, OSM ODbL).
Yksi lähde maalle, vedelle, rannalle, teille, kaduille, pysäköinnille ja
nimille kaikilla zoomeilla — eli käyttäjän ehto "yhdellä levyllä, ettei
pompi eri aikaan" täyttyy LAATAN sisällä, ja tavallinen `z/x/y`-laatta
CDN:stä poistaa koko Range-koneiston (protokolla, hakemistot, SW:n
tavuvälivälimuisti — se jossa oli 17.10. vika). Tyyli on omamme samoilla
tokeneilla; rinne jää omasta tiedostosta (OpenFreeMapissa ei ole sitä),
ja vesimaski luetaan samasta laatasta (`water`). Hinta: kolmas osapuoli
ilman palvelutasolupausta (lahjoitusrahoitteinen, julkinen vuodesta
2024), ja CLAUDE.md:n sääntö "älä lisää kolmannen osapuolen tyyliä tai
laattoja tumman pohjan osaksi" kumoutuu — käyttäjän päätös. Laatat ovat
suodattamattomina isompia (z14 kaupungissa ~100 kt; mobiilidata on
käyttäjän linjauksella rajaton). Varatie: Esri tumma kuten nyt.

**K4. Hybridi: oma z0–12 + OpenFreeMap z ≥ 12.** Kaukaa oma pohja,
lähellä katutaso. Kaksi lähdettä ja raja z12:ssa — juuri se "pomppiminen"
josta käyttäjä halusi eroon, ja oman pohjan viat (K1) on korjattava
silti. Vain jos oma kaukonäkymä on itsessään arvo.

**K5. Oma koti oikeaan CDN:ään** (Cloudflare R2 + Worker, Protomapsin
oma malli: PMTiles → `z/x/y` reunalla välimuistiin). Koko arkisto omana,
nopea, kaupunkitaso koko Euroopalle (Protomapsin Eurooppa z15 noin
40 Gt). Vaatii käyttäjän Cloudflare-tilin ja muutaman euron kuussa yli
ilmaiskiintiön, ja rakennus ajetaan muualla kuin Actionsissa (koko).
Riippumaton, mutta isoin työ ja ylläpito.

**K6 (lisä mihin tahansa): satelliitti + kadut ja nimet päälle
lähizoomissa.** Pysäköintialue näkyy ilmakuvassa paremmin kuin
vektorina; satelliitilla on jo nimet ja rajat, katuviivat ja -nimet
z ≥ 13 lisätään samasta vektorilähteestä.

### Suositus

**K3 + K1:n yleiset osat + K6**, ja K5 myöhemmäksi jos riippumattomuus
osoittautuu tarpeelliseksi (tyyli ja tokenit siirtyvät sellaisinaan,
koska OpenMapTiles-skeeman voi rakentaa myös itse). Perustelu: kaikki
kolme oiretta tulevat samasta juuresta — raw.githubusercontent ei ole
laattapalvelin, ja sen päälle rakennettu Range-koneisto on hidas (0,4 s
× 2 kierrosta) ja hauras (17.10. SW-vika, kaatuneen avauksen muisti).
K3 poistaa koneiston kokonaan ja tuo kaupunkitason koko maailmaan
samalla kertaa; oma tiedosto ei olisi tuonut kumpaakaan ilman K5:n
infraa.

Vaiheet:

1. **V1 Korjaukset jotka pätevät kaikissa** (pieni): protokollan
   keskeytys (jos protokolla jää), kaatuneen avauksen uusinta, rinne
   natiivina rasterina (kaksi lähdettä rajoineen), vesimaski
   työntekijään ja vain levossa, rantavarjon puskurit puoleen
   resoluutioon liikkeen aikana. Mittari: liikesarja kuten yllä.
2. **V2 OpenFreeMap-pohja** (`POHJAT.tumma`): lähde
   `tiles.openfreemap.org/planet`, kerrokset maa (`landcover`/`landuse`
   tummana maana), vesi (`water`), rannan ja tiet zoomin mukaan
   (moottoritie z5 →, päätiet z8 →, kadut z12 →, pysäköinti- ja
   huoltotiet z14 →, kevyt liikenne z15 →), rakennukset z14 → hennosti,
   pysäköintialue (`landuse`/`poi` parking) täyttönä ja P-merkkinä
   z15 →, nimet: valtiot, kaupungit, kaupunginosat z11 →, kadunnimet
   z14 → tien suuntaan. Kaikki värit tokeneina, katu ei saa kilpailla
   lämpökartan kanssa (muste .13–.30); rannan ero mitataan uudelleen
   (taulukko yllä) ja lämpökartan värit `varit.mjs`:llä.
3. **V3 Nopea ulos-zoomi**: maailman z0–4 laatat esiladataan
   käynnistyksessä (MapLibren `preloadTiles` tai oma kutsu), jolloin
   välitila on karkea emo eikä tarkka lapsineliö. Mittari: kuvat 0,3 / 1 /
   3 s ulos-zoomin jälkeen vs. asettunut kuva — ei yhtään tarkempaa
   suorakaidetta 1 s:n jälkeen (puhelin, työpöytä, SW päällä).
4. **V4 Satelliitin katutaso** (K6): katuviivat ja -nimet z ≥ 13.
5. **V5 Oma arkisto** (`pohjakartta`-haara) jää vain rinteelle ja
   fonteille, tai fontit OpenFreeMapista; vektoriosat poistetaan
   luettelosta. Esri pysyy varatienä.

Hyväksymismittarit: liikkeen jälkeinen asettuminen ja pitkät tehtävät
enintään Esrin tasolla +10 % (yllä oleva asetelma, 5 kierrosta);
ulos-zoomissa ei neliöitä 1 s:n jälkeen; pohja kahdella latauksella SW
päällä; WebKit-puhelinkonteksti; Helsingin kadut ja pysäköintialueet
näkyvät z15:ssä; rannan ero vähintään nykyisen tasolla.

### Päätettävät

- **Q1** Hyväksytäänkö OpenFreeMap (kolmas osapuoli) tumman pohjan
  lähteeksi (K3), vai rakennetaanko oma CDN-koti (K5)? Suositus K3.
- **Q2** Mitä kaupunkitasolla näytetään: kadut ja nimet, pysäköinti
  (alue + P), kevyt liikenne, laiturit, rakennukset hennosti?
  Suositus kaikki, rakennukset .06–.10 alfalla.
- **Q3** Pidetäänkö rantavarjo? Se on suurin yksittäinen kustannus;
  V1 puolittaa sen liikkeessä. Suositus pidetään ja mitataan V1:n jälkeen.
- **Q4** Satelliitin katuviivat z ≥ 13 (K6)? Suositus kyllä.

## Toteutus 2 (17.10.): OpenFreeMap, rinne korkeusmallista ja korjaukset

Q1–Q4 suosituksen mukaan (käyttäjä: "tehdään suosituksella").

### Rakenne

- **Lähde `ofm`** (`OFM_TILEJSON` = `tiles.openfreemap.org/planet`,
  OpenMapTiles z0–14). `Pohjakartta.alusta` hakee TileJSONin 8 s:n
  rajalla; ilman sitä tila on `'pois'` ja kartta on Esrin tummalla
  rasterilla (varatie, ennallaan). Laattojen osoite on versioitu
  (`/planet/<rakennus>/z/x/y.pbf`, max-age 10 v), joten SW pitää ne
  välimuisti edellä (`ofm-v1`, katto 800).
- **Kerrokset** (MapLibren zoomit; sovelluksen tarkin on 15):
  vesi, joet z8 ja purot z12, rakennukset z13 alfa .07, laiturit z12,
  tiet `tie()`-apurilla — pääväylät z5, muut tiet z9, kadut z11,
  huoltotiet z13, kevyt liikenne z14 — valtion raja, ja nimet sään
  päällä: meret, valtiot (z < 8), kaupungit, kylät z10, saaret z11,
  kaupunginosat z12, kadunnimet z13 tien suuntaan ja pysäköinti "P" z14.
  Tokenit `--kartta-tie-paa` .24, `-katu` .17, `-polku` .10, `-laituri`
  .30, `-rakennus` .07, `-pysakointi` ja `-tie-sat`.
- **Pysäköinti on `poi`-piste `class=parking`, rajattu laatan
  `rank`illa** (≤ 8, z14,5:stä ≤ 20) ja `text-padding` 14: ilman rajaa
  jokaisen pihan P peitti korttelin.
- **Kynnykset laskettiin tasolla** suunnitelmasta (kadut z12 → z11
  jne.): suunnitelma oli kirjoitettu Leafletin asteikolla, ja MapLibren
  z15 on sovelluksen katto, joten kevyt liikenne z15 → olisi näkynyt
  vain aivan pohjalla.
- **Satelliitti (K6)**: `metadata.pohja = 'satelliitti'` -katuviiva
  (`ofm-tie-sat`, z12, valkoinen .34) ja `'kaikki'`-nimet ilmakuvan
  päällä. Varatiellä mikään OFM-kerros ei näy.
- **Fontit OpenFreeMapista** (`/fonts/{fontstack}/{range}.pbf`, Noto
  Sans Regular ja Bold; Mediumia ei ole, 404 → Bold). Oman haaran
  fonteista puuttuivat mm. arabian alueet (404 kartan nimille).
- **Rinnevarjostus on MapLibren `hillshade`** `raster-dem`-lähteestä
  (`DEM_LAATAT`, Mapzen Terrain Tiles AWS:ssä, `terrarium`, CORS `*`,
  noin 0,2 s/laatta, maxzoom 8), veden täytön alla: liioittelu 0,5,
  varjo musta .6, valo valkoinen .10, korostus .25. Varjostus lasketaan
  GPU:lla eikä pääsäikeessä, ja `pohjakartta`-haaran arkisto,
  `Pmtiles`, `fsp://`-protokolla ja SW:n tavuvälivälimuisti poistettiin
  koodista (SW poistaa vanhan `pohjakartta-*`-välimuistin).
- **Vesimaski työntekijässä** (`VesiTyo`: Blob-URL-työntekijä,
  `Mvt.monikulmiot` + `_vesiRasteroi` OffscreenCanvasilla, 24 laatan
  hakumuisti; varatie pääsäie). Maskin laatta z lukee OFM:n laatan
  z − 1 (retinalla z − 2), eli saman jonka MapLibre jo haki. Jono
  puretaan vain levossa (`Rantamaski._pumppaa`, `moveend`).
- **Rantavarjo kevyemmin liikkeessä**: sumea maa 1/8-resoluutiolla
  liikkeessä, 1/4 levossa (Q3: pidetään).
- **Emojen esilataus** (`Pohjakartta.esilataa`, `moveend`): näkymän
  laatat kolmelta karkeammalta tasolta (≤ 9 laattaa tasoa kohti,
  `priority: 'low'`), maailma z0–1 käynnistyksessä. MapLibre piirtää
  puuttuvan laatan paikalle muistissa olevat lapset — juuri ne neliöt
  jotka käyttäjä näki — ja emon ollessa selaimen välimuistissa se
  tulee ensin.

### Kaksi vikaa matkalla

- **Nimet ja kaikki niiden jälkeiset kerrokset puuttuivat.**
  `ofm-kaupunki`n `text-size` oli `interpolate`+`zoom` `match`in
  sisällä: MapLibre hylkää sellaisen kerroksen, ja `validateStyle:
  false`:lla myös kaikki sen jälkeen lisätyt — virhe näkyi vasta
  `_updatePlacement`in TypeErrorina. Zoomin interpolointi on nyt
  lausekkeen uloin (sääntö CLAUDE.md:ssä).
- **Ulkomaiset nimet ilman kirjaimia**: oma fonttiarkisto ei kattanut
  kaikkia alueita → OFM:n fontit.

### Mitattu

Sama asetelma kuin strategiassa (puhelin, SwiftShader, 6 näkymän
liikesarja, 3 kierrosta vuorotellen, mediaanit):

```
                              liikkuva ruutu   kartta valmis   pitkät tehtävät
                              med / p90        liikkeen jälkeen  / liike
oma PMTiles-vektori (ennen)    271 / 351 ms      4,9 s             4,2 s
OFM + rinne raw-PNG:nä         —                 3,6 s             3,1 s
OFM ilman rinnettä (erittely)  —                 2,35 s            2,09 s
OFM + rinne korkeusmallista    314 / 413 ms      2,67 s            2,26 s
Esri-rasteri (sama ajo)        273 / 336 ms      2,57 s            2,33 s
```

Hyväksymismittari (Esri + 10 %) täyttyy: asettuminen +4 %, pitkät
tehtävät −3 %. Liikkuva ruutu on vektorilla ~15 % raskaampi kuin
rasterilla (tiet ja nimet piirretään joka ruudussa); kontti ei mittaa
laitteen ruutunopeutta, joten se on varmistettava puhelimella.

- **Ulos-zoomi** z9 → z3,6 700 ms:ssa: 1,5 s:n kuvassa ei yhtään
  tarkempaa suorakaidetta (ennen lapsilaattojen neliöt).
- **SW päällä, kaksi latausta + lähizoom**: tila `ok` kaikissa, samat
  piirretyt kohteet molemmilla latauksilla (vesi 46, kaupungit 40),
  Helsingissä z11 tiet 50 ja kylä-/saarinimet 29.
- **Savutesti** läpi (puhelin ja työpöytä, 0 virhettä).

### Mitä jäi

- Rannan kirkkausero ja lämpökartan värit (`varit.mjs`) mittaamatta
  uuden pohjan päällä; maan ja veden tokenit ovat ennallaan, joten
  ero on odotettavasti sama kuin oman vektorin.
- WebKit-puhelinkonteksti ja oikea laite (ruutunopeus liikkeessä).
- K5 (oma laattakoti) vain jos OpenFreeMapin saatavuus osoittautuu
  ongelmaksi; tyyli siirtyy sellaisenaan, koska skeema on OpenMapTiles.
