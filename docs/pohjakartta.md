# Pohjakartta ja rannat (strategia 17.10.2026)

Käyttäjän pyyntö 17.10.: "Windyssä saarten, mantereen ja rantojen värit
ovat liukuvärjätty, hieman tummennettu, jotta ne erottaa selkeästi siitä
mistä vesi alkaa. Tarkistetaan parhaat karttavaihtoehdot jokaiselle
näkymälle ja tehdään suunnitelma. Ei vielä koodata." Tämä on se
suunnitelma: nykytila mitattuna, Windyn tapa sen omista laatoista,
vaihtoehdot kuvattuina oikean sovelluksen päällä ja suositus vaiheineen.
Mitään sovelluksen koodia ei muutettu.

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
