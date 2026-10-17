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
