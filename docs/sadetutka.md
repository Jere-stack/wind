# Sadetutka 2 — strategia ja roadmap (4.10.2026)

Luvut 1–9 ovat strategia ja luku 10 sen toteutus (4.10.2026, kaikki
vaiheet suosituksen mukaan — lue luku 10 ennen kuin kosket sadekerrokseen).
Mittaukset luvussa 3 on tehty 4.10.2026 noin klo 13:30 UTC suoraan FMI:n
palveluista. Päätettävät kohdat ovat luvussa 6
(P1–P9), ja vaiheet luvussa 7 (V0–V7). Lue ennen tätä `docs/data.md`
("Sadetutka — miksi se ei ole `L.TileLayer.WMS`" … "Sateen asteikko") ja
`docs/ui.md` ("Sateen värit", "Sade neljänneksi kerrokseksi").

## Tiivistelmä

Käyttäjän palaute 4.10.: *"Sadetutka tuntuu kömpelöltä ja näyttää paljon
erilaiselta kuin Ilmatieteen laitoksen data SuperSää-sovelluksen
säätutkalla. Pitäisi olla tarkempi ja näkyä pehmeämmin sateen
liikkuminen, aikajana esim. 15 min tarkkuudella, ja aikajana saisi
näyttää sateen määrän. … Pehmeämpi sateiden liike, ladattu varastoon
dataa ja jatkettu ennuste muulla datalla jos mahdollista."* Vertailukuva:
havainto su 4.10. klo 15:00, koko Suomi, klassinen tutkaväri
(sininen–vihreä–keltainen–punainen), selite viidessä luokassa
(< 0,1 · 0,1–1 · 1–10 · 10–25 · > 25 mm), aikajana tunnin luvuin ja
vartin tikein, "Observation"-lappu.

**Diagnoosi** (luku 2): kömpelyys on ensisijaisesti AIKAA eikä
pikseleitä. Kun aikajana liikkuu, sadekerros sekoittaa vain tasatunteja;
kuuro liikkuu tunnissa 30–50 km, joten välikuvassa näkyy kaksi puolikasta
läiskää eikä yksi liikkuva kuuro. Toiseksi lähde on 500 m:n komposiitti
haettuna enintään ~305 m/px:n tasolta ja pehmennettynä B-splinillä, kun
FMI:llä on samassa palvelussa 250 m:n komposiitti. Kolmanneksi väri on
tarkoituksella sininen–violetti ja läpikuultava, joten kuva ei näytä
tutkalta. Neljänneksi aikajana ei kerro sateesta mitään: palkit ovat
sadetilassakin tuulta.

**Suositus** (luku 5), tärkein ensin:

1. 250 m:n lähde (`radar_finland_cappi_dbzh`, sama WMS, mitattu 4.10.)
   ja terävämpi suodatus — pieni muutos, iso ero.
2. Kaikki 5 minuutin kehykset käyttöön kun aikajana liikkuu, ja
   sadetilassa 15 minuutin valinta tutkan ja nowcastin jaksolla.
3. Aikajanan palkit sadetilassa = sateen määrä keskipisteessä (kuten
   aaltotilassa aallonkorkeus), havainnosta ja ennusteesta.
4. Liikekenttä (optinen virtaus) kehysten väliin: kuuro LIIKKUU eikä
   häivy. Sama kenttä antaa nowcastin 0–2 h eteenpäin.
5. Ennuste jatkuu katkeamatta: tutka → nowcast → HARMONIE 2,5 km →
   (valinnainen) ECMWF 9 km.
6. Väri klassiseksi tutkaväriksi — sallittu vain siksi, että sadetilassa
   ruudulla ei ole tuulen ramppia (kohta 3 poistaa viimeisen).

"Varasto" toteutetaan selaimen muistina ja CDN:nä, ei omana
git-haarana: FMI pitää tutkan arkiston itse (WMS 14 vrk, S3 vähintään
vuosi), ja Actions-ajastin myöhästyy tunteja (docs/data.md, "GitHubin
ajastin ei riitä keruuseen") — 5 minuutin dataa ei voi kerätä sillä.

---

## 1. Mitä vertailukuva näyttää ja mikä siitä on tavoite

| piirre vertailukuvassa | meillä nyt | tavoite |
|---|---|---|
| kuurojen sisärakenne näkyy (yksittäiset solut, nauhat) | 500 m lähde, katto ~305 m/px, B-spline | 250 m lähde, terävä mutta ei porrastu |
| klassinen tutkaväri, lähes peittävä | sininen–violetti, alfa 0,28–0,85 | klassinen ramppi (P2), peittävyys ~0,85 yli 0,1 mm/h |
| selite kartalla, viisi luokkaa | asteikko vain asetuksissa (sääntö) | P3 |
| aikajana tunnin luvuin ja vartin tikein | tuntitikit | vartit tutkan ja nowcastin jaksolla (P4) |
| "Observation"-lappu | leima "Sadetutka 15:05" | Havainto / Nowcast / Ennuste -lappu |
| play kulkee aikajanaa | 30 min silmukka levossa, aikajanan toisto erikseen | yksi aika: aikajanan toisto (P8) |

Vertailukuvan pohjakartta on vaalea Apple Maps; meillä tumma pohja ja se
pysyy (Yömeri-päätös). Klassinen tutkaväri erottuu tummalla pohjalla
paremmin kuin vaalealla, joten pohjan ero ei estä tavoitetta.

Emme tiedä mitä SuperSää tekee sisäisesti (interpolointi, nowcast), joten
tavoitteet on kirjoitettu siitä mitä kuvassa NÄKYY, ja jokainen mitataan
FMI:n omaa dataa vastaan, ei toista sovellusta.

---

## 2. Nykytila koodista luettuna

| asia | nyt | lähde |
|---|---|---|
| tutkalähde | WMS `suomi_dbz_eureffin`, 500 m, 5 min, 7 vrk | `Sadetutka.KERROS` |
| tarkin haettu taso | `maxNativeZoom: 8` (Leaflet-asteikko) ≈ 305 m/px Helsingin leveydellä | `SadeKerros.options` |
| suodatus | kuutiollinen B-spline (approksimoiva: pehmentää myös solmuissa) | `SadeKerros`-varjostin |
| väri | `Sade.RAMPPI_TUMMA` sininen → violetti, alfa voimakkuudesta | `Sade` |
| levossa, havainto | 30 min silmukka (7 × 5 min), häivytys | `_silmukkaKehys` |
| aikajana liikkuu | tasatuntien ristihäivytys voimakkuudessa | `_kohde`, `_sadeLiike` |
| ennuste | HARMONIE `Precipitation1h` 2,5 km, tunneittain, ~61 h | `api/sade.js`, `Sadeennuste` |
| yli 61 h | tyhjä + leima "Ei sade-ennustetta" | `_kehys` |
| raja tutka/ennuste | aikajanan NYT-tikki (lähin tasatunti) | `_tutkaLahde` |
| aikajanan palkit sadetilassa | tuuli (`ColorRamp.rgb`) | `_tlPalkkiTyyli` |

### Miksi se tuntuu kömpelöltä — viisi syytä painojärjestyksessä

1. **Liikkeessä aika-askel on tunti.** Toisto ja raahaus sekoittavat
   tasatunteja (`_kohde`: `h0`, `h0+1`, `f`). Kuuron siirtymä tunnissa on
   30–50 km, Helsingin z10-ruutu on ~40 km leveä: välikuvassa sama kuuro
   on kahdessa paikassa puolella voimakkuudella. Silmä ei lue sitä
   liikkeenä vaan vilkkumisena. Tämä on "kömpelön" ydin.
2. **Kaksi aikaa ruudulla.** Levossa havainto pyörii omaa 30 min
   silmukkaansa, joka on eri aika kuin aikajanan valinta. Vertailukuvassa
   on yksi aika: aikajana.
3. **Lähde on puolet karkeampi kuin saatavilla on**, katto pudottaa sen
   vielä ~305 m/px:iin, ja approksimoiva B-spline sumentaa noin yhden
   lähdepikselin verran lisää. Tulos on mössö, josta solurakenne katoaa.
4. **Väri ja peittävyys.** Sininen–violetti ramppi valittiin 30.9.
   erottumaan aikajanan tuulipalkeista (docs/ui.md, "Sateen värit", pienin
   dE 5,1). Hinta: kuva ei näytä tutkalta, ja matala alfa (tihku 0,28)
   hukkuu tummaan pohjaan.
5. **Aikajana ei kerro sateesta.** Palkit ovat tuulta, joten sadetilassa
   rivin ensimmäinen luettava muoto puhuu eri asiasta kuin kartta.

---

## 3. Mitä dataa on — mitattu 4.10.2026

### 3.1 FMI WMS: 250 m:n komposiitti samassa palvelussa

`openwms.fmi.fi/geoserver/Radar/wms` GetCapabilities (426 507 tavua),
tutkan Suomi-kerrokset:

```
radar_finland_cappi_dbzh    heijastuvuus, FINRAD    PT5M  14 vrk  FILTER qc|unfiltered
radar_finland_cappi_rate    sadeintensiteetti mm/h  PT5M  14 vrk  finradfast
radar_finland_cappi_acrr1h  1 h kertymä (liukuva)   PT5M  14 vrk
radar_finland_cappi_acrr12h / acrr24h               PT5M
suomi_dbz_eureffin          nykyinen lähde          PT5M   7 vrk
suomi_rr_eureffin / rr1h / rr12h / rr24h            PT5M / PT1H
```

**Resoluutio mitattiin kuvasta.** Sama 40 × 40 km:n sateinen alue
(EPSG:3067, keskipiste 540000 / 6760000) 400 × 400 px:nä eli 100 m/px;
saman arvon peräkkäisten pikselien juoksun mediaani:

```
radar_finland_cappi_dbzh   3 px   -> 250 m (FINRAD-hila 5120 × 6144)
suomi_dbz_eureffin         6 px   -> 500 m (nykyinen)
radar_finland_cappi_rate  10 px   -> 1 km  (finradfast)
```

Muut ominaisuudet:

- **EPSG:3857 toimii** (GetMap 256 × 256 → 200, paletoitu PNG), vaikka
  capabilities listaa vain 3067:n ja CRS:84:n. Nykyinen laattapolku
  kelpaa sellaisenaan.
- `Cache-Control: max-age=86400, must-revalidate` ja
  `Access-Control-Allow-Origin: *` kuten nykyisellä kerroksella.
- Laatan koko sateisella alueella (z9-laatan bbox, klo 13:00):
  `radar_finland_cappi_dbzh` 256 px 11,6 kB / 512 px 19,9 kB,
  `suomi_dbz_eureffin` 9,0 / 15,1 kB. Vastausaika 0,8–1,4 s.
- Tyylit: `radar_dbz_summer_8_50` (oletus), `_cvdopt`
  (värisokeusoptimoitu), `radar_dbz_winter_fi`, `radar_dbz_summer_fi`,
  `_nodata`, `raster`. Oletustyylin selite (`GetLegendGraphic`, JSON)
  antaa värin dBZ-arvolle: 8 `#0A9BE1`, 12 `#06CDAA`, 18 `#8CE614`,
  24 `#F0F014`, 30 `#FFCD14`, 34 `#FF9632`, 40 `#FF503C`, 50 `#FA78FF`
  … — **samat dBZ-katkot kuin nykyisen taulukon ankkureissa** (8, 12,
  18, 24, 30, 34, 40, 46, 52 dBZ ↔ 0,07 … 63 mm/h, docs/data.md "Sateen
  asteikko"). dBZ → mm/h -käännös on siis jo mitattu ja pätee.
- `raster`-tyyli on 8-bittinen harmaa, mutta arvojen merkitys ei ole
  selvä (näytteessä 1…255; 0,5·v − 32 antaisi 95 dBZ). Ei käytetä ennen
  kuin mitattu (V0).

### 3.2 FMI:n S3 (AWS Open Data): raaka 250 m GeoTIFF

`fmi-opendata-radar-geotiff`:

```
YYYY/MM/DD/finrad/<aika>_finland_cappi_600_dbzh_finrad_qc.tif
  5120 × 6144, uint8, dBZ = 0,5·v − 32, EPSG:3067, 250 m
  LZW, 256 × 256 laatat, YKSI IFD (ei overview-tasoja), otsake tiedoston alussa
  2,2–2,5 MB / kehys, 5 min välein, valmis ~6 min kehysajan jälkeen
  (kehys 13:25 → LastModified 13:31:33)
YYYY/MM/DD/finradfast/<aika>_composite_cappi_600_acrr1h_finradfast_qc.tif
  1280 × 1536, float32, gain 0,001 (mm), 1 km, tunneittain, 387 kB
  myös acrr3h / 6h / 12h / 24h
```

- `Access-Control-Allow-Origin: *` ja `Range` toimii (206). Koska otsake
  ja laattojen siirtymät ovat tiedoston alussa, selain voi lukea vain ne
  64 km:n laatat jotka näkymä tarvitsee — mutta ilman overview-tasoja koko
  Suomi on 480 laattaa eli koko tiedosto.
- Kuluvan päivän avaimet ovat suoraan päivähakemistossa, menneet päivät
  alihakemistoissa (`finrad/`, `finradfast/`, tutkat erikseen).
  Vuoden takainen päivä on olemassa eri nimeämisellä
  (`2025/10/04/fianj/…_cappi_600_dbzh_qc.tif`). Polut on luettava
  listauksesta, ei oletettava.
- `*_nowcast_qc.tif`: nimen perusteella nowcastin syötteeksi
  laadunvarmistettu heijastuvuus samalla aikaleimalla, EI ennuste.
  Varmistettava (V0) ennen kuin sitä käytetään mihinkään.

### 3.3 Nowcast: FMI:llä ei ole avointa, MET Norwaylla on pisteenä

- FMI:n WFS:n tallennetut kyselyt (`describeStoredQueries`, 439 kB):
  `fmi::radar::*`, `fmi::forecast::harmonie::*`, `…::meps::*`,
  `…::edited::weather::scandinavia::*` — **ei sade-nowcastia**. WMS:ssä
  ei ole yhtään ennustekerrosta (docs/data.md, 128 kerrosta, mitattu
  aiemmin).
- **MET Norway `nowcast/2.0/complete`** kattaa Suomen:
  `radar_coverage: "ok"` Helsingissä (60,17 / 24,94) ja Joensuussa
  (62,6 / 29,7), sarja 5 min välein ~90 min, `precipitation_rate` mm/h.
  Pistekysely, vaatii `User-Agent`in → proxy. CC BY 4.0.
  Hilana (THREDDS, netCDF) se olisi raskas — ei ehdoteta.
- **Oma nowcast** tutkakehyksistä (advektio liikekentällä) on toteutettavissa
  selaimessa, ks. S3.

### 3.4 Ennusteen jatko

| lähde | hila | askel | kantama | tila |
|---|---|---|---|---|
| HARMONIE `Precipitation1h` | 2,5 km | 1 h | ~61 h | käytössä (`api/sade.js`) |
| ECMWF 9 km (Open-Meteo S3, `api/malli.js`:n infra) | 9 km | 1 h → 3 h → 6 h | 10 vrk+ | mittaamatta sateelle |
| `edited::weather::scandinavia` (meteorologin muokkaama) | ? | ? | ? | mittaamatta |
| ECMWF 0,25° | 14 × 28 km | 3–6 h | 15 vrk | HYLÄTTY 2026-09 (kolme solua ruudulle) |

---

## 4. Tavoitteet — mitattavina

| # | tavoite | mittari (V0:n työkalu) |
|---|---|---|
| T1 | Terävyys: kuurojen sisärakenne näkyy z9–z11 | efektiivinen resoluutio (gradienttienergia) FMI:n oman 250 m kuvan vastaavasta bboxista; ero vertailuun |
| T2 | Liike: kuuro liikkuu, ei häivy | "jätä yksi pois": interpoloi 0 ja 10 min kehyksistä 5 min kehys ja vertaa oikeaan (sadealan päällekkäisyys, haamupikselit) |
| T3 | Aika: 15 min valinta tutkan ja nowcastin jaksolla | kupla ja kartta samassa varttitunnissa; ei välitilojen valintaa liu'ussa |
| T4 | Aikajana kertoo sateen määrän | palkki = mm keskipisteessä; havaintojaksolla sama luku kuin FMI:n `acrr1h` samassa pisteessä |
| T5 | Ennuste ei katkea: tutka → nowcast → HARMONIE | ei tyhjää kehystä rajoilla; nowcastin osuvuus ≥ HARMONIEn 0–90 min (FSS 1 mm/h) |
| T6 | Lataus kohtuullinen | tavut ja pyynnöt / 6 h toisto Helsingin ruudulla, puhelin; ei yli nykyisen 30 min silmukan ×3 |
| T7 | Näyttää FMI:n tutkalta | sävy samassa luokassa kuin FMI:n oma tyyli samalle dBZ:lle (P2) |
| T8 | Sujuvuus | GPU-työn SUHDE nykyiseen (SwiftShader, mediaani); laitemittaus iPhonella |

---

## 5. Strategia — kuusi rakennuspalikkaa

### S1. Lähde 250 m: WMS ensin, S3 varatienä

**Suositus:** vaihdetaan `KERROS` → `radar_finland_cappi_dbzh`
(`FILTER=qc`), paletti taulukoidaan kuten ennen (oletustyyli on paletoitu
PNG; selitteen dBZ-arvot sitovat käännöksen samaan ANKKURIT-taulukkoon).
Katto nostetaan tasolle 9 (≈ 153 m/px, 250 m lähteelle riittävä
ylinäytteistys) ja laatta 512 px:ään, jolloin pyyntöjen määrä pysyy
nykyisen luokassa (taso 9 on 4× laattoja tasoon 8 nähden, 512 px jakaa
sen neljällä). Taso 10 vain jos mittaus näyttää eron.

**Suodatus:** B-spline vaihtuu interpoloivaan (Catmull-Rom tai
bilineaarinen + kevyt jälkipehmennys vain suurennoksessa). B-spline oli
oikea 500 m:n portaille; 250 m:llä se syö juuri sen yksityiskohdan jota
haetaan. Mitataan T1:llä.

**Miksi WMS eikä S3:** WMS antaa 3857-laatat suoraan, paletoitu PNG on
pieni, välimuisti on valmiiksi oikein ja nykyinen koneisto (luotain,
kehyslista, `_k`-muisti) kelpaa. S3:n raaka dBZ on parempi kahteen
asiaan: liikekentän laskentaan (ei palettikäännöstä, ei 3857-
uudelleennäytteistystä) ja kuormaan jos FMI:n WMS osoittautuu hitaaksi.
S3 vaatii selaimeen LZW-purkajan (~60 riviä) ja 3067 → 3857 -muunnoksen
(laatta piirretään 16 × 16 -verkkona, solmut projisoidaan JS:ssä; ei
TM35-kaavaa GLSL:ään). Tämä on P1.

### S2. Väri: klassinen tutkaväri, kun aikajana ei enää näytä tuulta

Nykyinen sininen–violetti valittiin kahden ehdon alla: (1) kartan
tuulikerrokset sammuvat sadetilassa ja (2) aikajanan palkit pysyvät
tuulen rampissa, joten sateen piti erottua niistä (pienin dE 5,1).
Kun S4 muuttaa palkit sateeksi, ehto (2) poistuu, ja CLAUDE.md:n sääntö
("kartan pinnalla kerrallaan tasan yksi väriasteikko, sävy saa
tarkoittaa sateen voimakkuutta") sallii klassisen rampin.

**Suositus (P2 = A):** oma klassinen ramppi FMI:n `radar_dbz_summer`-
sävyjen mukaan (sininen → turkoosi → vihreä → keltainen → oranssi →
punainen → pinkki), mm/h-ankkureilla, ei FMI:n palettia sellaisenaan
(väri tulee voimakkuudesta varjostimessa kuten nyt). Peittävyys ~0,85
yli 0,1 mm/h, tihku häivytetään 0,05–0,1 mm/h välillä. Värisokeille
vertailukohdaksi `_cvdopt`-paletin taulukointi (docs/ui.md, "Sateen
värit" kohta 5).

Samassa muutoksessa: `Sade.lut`, asetusten asteikko, `KerrosKuvat`in
sadekuva, ja CLAUDE.md:n väriluku (sateen ramppi). Spottimerkin
indeksikaari ja havaintopillerit eivät ole rampin värisiä tummalla
pinnalla (`spotIndexInk`, muste), mutta ne tarkistetaan dE:llä uutta
ramppia vasten.

### S3. Liike: liikekenttä kehysten väliin — ja sama kenttä nowcastiksi

Kaksi tasoa, halvin ensin:

**S3a — kaikki 5 minuutin kehykset.** Kun aikajana liikkuu tutkan
jaksolla, A ja B ovat ympäröivät 5 min kehykset eivätkä tasatunnit.
5 minuutissa kuuro siirtyy 2,5–4 km eli noin solun verran, joten
ristihäivytys näyttää jo lähes liikkeeltä. Tämä yksin korjaa diagnoosin
kohdan 1 suurimmaksi osaksi.

**S3b — liikekompensoitu interpolointi.** Liikekenttä lasketaan
Web Workerissa viimeisistä 3–4 kehyksestä karkealla (~2 km) hilalla
(Lucas–Kanade pyramidina tai lohkohaku, tasoitettu kenttä), ja varjostin
näytteistää välihetkellä `f`:

```
I(x, t) = (1 − f) · A(x − f·v·Δt) + f · B(x + (1 − f)·v·Δt)
```

Kuuro liikkuu jatkuvasti eikä mikään välikuva ole "kaksi puolikasta".
Kenttä on pieni tekstuuri (esim. 64 × 64 vektoria näkymän ja reunuksen
yli). Varmuusmitta (kehyksen ennustusvirhe) ratkaisee: huonolla
varmuudella palataan ristihäivytykseen.

**Ristiriita aiempaan kirjaukseen ja sen ratkaisu.** docs/data.md sanoo
"keksitty liike valehtelisi enemmän kuin pysäytyskuva" — se koski
HARMONIEn TUNTIaskelta, jossa välikuva olisi 30–50 km:n arvaus.
5 minuutin kehysten välissä siirtymä on enintään ~2 km ja se on
mitattu kahdesta havainnosta, eli kyse on interpoloinnista eikä
keksimisestä. Mittari on totuus (T2: interpoloitu 5 min kehys oikeaa
vastaan), ei silmämääräinen arvio. HARMONIE-tuntien välinen
liikeinterpolointi on eri asia ja eri päätös (P5).

**Nowcast samasta kentästä:** tuoreinta kehystä siirretään kentän
mukaan (puoli-Lagrangen advektio) 0–90/120 min eteenpäin, epävarmuus
kasvaa johtoajan mukaan (voimakkuus vaimenee ja sumenee). Ei pysteps-
ensembleä: Python, raskas, eikä mahdu Vercelin funktioon.

### S4. Aikajana sadetilassa: palkit ovat sadetta, vartit tutkan jaksolla

**Palkit = sateen määrä keskipisteessä**, sadevärillä ja omalla
akselillaan — sama malli kuin aaltotilassa (`_tlPalkkiTyyli`,
`_tlAaltoOsuus`, `State._tlAallot`, `_tlAaltoRajaus`). Kelikaista ja
kelihyppy lukevat edelleen tuulta. Lähteet:

| jakso | lähde | yksikkö |
|---|---|---|
| mennyt (≤ 48 h) | FMI `acrr1h` keskipisteessä (proxy-tila, ks. S5) | mm / h (kertymä) |
| nowcast (0–90 min) | MET Norway piste ja/tai oma advektio pisteessä | mm / h |
| ennuste (→ 61 h) | HARMONIE `Precipitation1h` keskipisteessä | mm / h |
| (yli 61 h) | ECMWF 9 km tai tyhjä (P9) | mm / h |

Määrä on KERTYMÄ (mm tunnissa tai vartissa), kartta on INTENSITEETTI
(mm/h hetkellä). Kumpikin sanotaan omalla nimellään; vertailukuvan "mm"
on epämääräinen, meidän ei tarvitse olla.

**15 minuuttia — suositus B1 (P4):** tuntitikit pysyvät (koko
aikajanan geometria, `TL_TIKKI`, kisko, indeksit), mutta sadetilassa
tutkan ja nowcastin jaksolla (1) palkki jakautuu neljään vartin
siivuun (pieni histogrammi 12 px:n palkissa), (2) valinta
(`State.valittuMs`) napsahtaa varttiin eikä tuntiin, ja kupla sanoo
"15:15", ja (3) toisto kulkee varteittain liukuen. `currentHourIdx`
pysyy tunnin indeksinä. Vaihtoehto B2 (sadetilassa oma akseli, tikki =
15 min) olisi oma aikajana 32 000 rivin tiedoston herkimpään osaan ja
rikkoisi kymmenkunta CLAUDE.md:n aikajanasääntöä — ei suositella.

**Ristiriita aiempaan sääntöön.** CLAUDE.md: "Älä tihennä aikajanaa
tuntia pienemmäksi." Mittaus koski TUULTA: varastoaskelen sisällä
tuntipisteet ovat suoralla, eikä minuuttiaskel tuo uutta dataa. Tutkassa
on oikea 5 minuutin data, joten perustelu ei päde sateeseen. Poikkeus
rajataan sadetilaan ja tutkan + nowcastin jaksoon, ja sääntöön kirjataan
poikkeus samassa muutoksessa.

**Lappu:** kuplan tai leiman yhteyteen Havainto / Nowcast / Ennuste,
kuten vertailukuvan "Observation".

### S5. Esilataus ja "varasto"

| taso | mitä | miksi |
|---|---|---|
| GPU / muisti | laattakohtainen kehysmuisti (nyt 16 kehystä), LRU | toisto ja raahaus eivät odota |
| HTTP-välimuisti | WMS-kehys on muuttumaton nimetyllä ajalla, `max-age=86400` | ilmainen, toimii jo |
| CDN (Vercel) | aikajanan sadesarja ja nowcast-piste proxyn kautta, 5 min | yksi laskenta kaikille käyttäjille |
| FMI | WMS 14 vrk, S3 vähintään vuosi | arkisto on jo olemassa |
| oma git-haara | EI tutkakehyksille | 5 min tahti vs ajastin joka myöhästyy tunteja |

**Esilatausjärjestys:** valittu hetki → ±1 h vartit → toiston suunta →
loput näkyvästä jaksosta. Budjetti per ruutu ja vaimennetulla liikkeellä
vain valittu kehys (kuten `silmukassa()` nyt).

**Proxy uutena TILANA, ei uutena tiedostona** (12 funktiota = Vercel
Hobbyn katto): `api/sade.js?sarja=1&lat&lon` (FMI `acrr1h` pisteessä,
S3-laatta tai WMS GetFeatureInfo — mitataan V0:ssa) ja
`api/sade.js?nowcast=1&lat&lon` (MET Norway, User-Agent). Pistettä
pyöristetään 0,05°:een, jotta CDN osuu.

Jos "ladattu varastoon" tarkoitti omaa palvelinvarastoa (esim.
nowcastin varmennus kuten O11), se on erillinen myöhempi vaihe (P6).

### S6. Ennusteen jatko yhdeksi jatkumoksi

```
… tutka (5 min) ── tuorein kehys ── nowcast (0–90 min) ──┐
                                   HARMONIE (1 h, → 61 h) ┴── ECMWF 9 km (P9) …
                                   paino: nowcast 1 → 0 välillä +30 … +120 min
```

- Nowcastin ja HARMONIEn sekoitus voimakkuudessa painolla johtoajan
  mukaan (kuten varaston perheiden aikapaino); painot viritetään
  mittauksella (V5: kumpi osuu paremmin millä johtoajalla).
- **Raja tutka/ennuste muuttuu:** nyt se on NYT-tikki (lähin tasatunti).
  Vartin tarkkuudella raja on tuorein tutkakehys itse; sen jälkeen
  nowcast. Vanha virhe (tunnin pyöristys, docs/data.md) ei toistu, koska
  raja on kehyksen aika eikä pyöristys. CLAUDE.md:n sääntö kirjoitetaan
  uudelleen samassa muutoksessa (P7).
- Yli 61 h: ECMWF 9 km on 4–5 solua Helsingin ruudulle — aluekuva, ei
  kuurokuva; leima sanoo sen ("karkea, ECMWF"). Vaihtoehto on nykyinen
  tyhjä.

---

## 6. Päätettävät kohdat

| # | kysymys | suositus | vaihtoehdot |
|---|---|---|---|
| P1 | 250 m:n lähde | WMS `radar_finland_cappi_dbzh` | S3 GeoTIFF heti (raaka dBZ, enemmän työtä) |
| P2 | Väri | klassinen tutkaväri (S2), ehtona S4:n sadepalkit | nykyinen sininen–violetti peittävämpänä |
| P3 | Selite kartalla | ei pysyvää liuskaa; kapseli näyttää sadetilassa mm/h keskipisteessä, asteikko asetuksissa | kompakti luokkaselite kartalla sadetilassa (vertailukuvan tapaan; rikkoo säännön "asteikko vain asetuksissa") |
| P4 | 15 min | B1: tuntitikit + vartit sadetilassa tutkan/nowcastin jaksolla | B2 oma akseli; tai ei vartteja |
| P5 | Liikeinterpolointi | tutkakehysten välillä kyllä; HARMONIE-tunneille ei ensin | myös HARMONIE (merkittynä); tai vain ristihäivytys |
| P6 | Varasto | selain + CDN, FMI arkistona | oma haara (vain varmennukselle) |
| P7 | Nowcast | oma advektio selaimessa + MET Norway pisteenä aikajanalle | vain MET Norway; tai ei nowcastia |
| P8 | 30 min silmukka levossa | pois — aikajanan toisto hoitaa | jää lepoon |
| P9 | Yli 61 h | ECMWF 9 km merkittynä | tyhjä kuten nyt |

---

## 7. Roadmap

Koko: S = alle päivä, M = 1–3 päivää, L = 3–5 päivää. Jokainen vaihe on
oma committinsa ja viedään oletushaaralle vasta kun sen hyväksymismittaus
on ajettu (ja laitteella testattava kohta on merkitty).

### V0 — Mittauspohja ja avoimet kysymykset (S–M)

- `tools/sademittaus.mjs`: sateinen päivä taltioituna (WMS-laatat ja
  S3-kehykset curlilla tiedostoiksi, Playwright reitittää), joten
  mittaus ei riipu säästä eikä verkosta.
- Mittarit T1 (terävyys FMI:n 250 m kuvaa vasten), T2 (jätä yksi pois),
  T6 (tavut ja pyynnöt / 6 h toisto), T8 (GPU-suhde SwiftShaderilla).
- Selvitetään: `raster`-tyylin arvot, `*_nowcast_qc`-tiedostojen
  merkitys, `acrr1h` pisteessä (S3-laatta vs GetFeatureInfo; koko ja
  aika), FMI:n WMS:n kuormaraja, ECMWF 9 km sade Open-Meteon S3:ssa.
- **Hyväksyntä:** nykyversion luvut kirjattuina (lähtötaso).

### V1 — Terävyys ja väri (M)

- `radar_finland_cappi_dbzh` + `FILTER=qc`, paletin taulukointi
  selitteen dBZ-arvoista, katto 9 ja 512 px laatta, interpoloiva suodatus.
- P2:n mukainen ramppi ja peittävyys; `Sade.lut`, asetusten asteikko,
  `KerrosKuvat`.
- **Hyväksyntä:** T1 vähintään FMI:n oman kuvan tasolla z9–z11, T6 ei
  yli 1,5× lähtötason, savutesti, kielitarkistus (`?kieli=en`).
- Huom: jos P2 = A, V1:n väri ja V3:n sadepalkit kuuluvat samaan
  julkaisuun (muuten tuulipalkit ja klassinen ramppi ovat ruudulla
  yhtä aikaa). Silloin V1 julkaistaan värin osalta vasta V3:n kanssa.

### V2 — Tiheä aika: 5 min kehykset ja vartit (M–L)

- Liikkeessä tutkan jaksolla A/B = 5 min kehykset (S3a).
- Sadetilassa valinta varttiin (B1): `valittuMs` napsahtaa, kupla,
  toisto varteittain, `_tlLiuuta`-kesto ja näppäimet (`,`/`.` = vartti
  sadetilassa).
- 30 min silmukka pois (P8), esilatausjärjestys ja budjetti.
- **Hyväksyntä:** WebKit + iPhone-konteksti + rAF jäädytettynä
  (CLAUDE.md, eleen mittaus): raahaus näyttää jokaisen 5 min kehyksen,
  napautus ei valitse välitiloja, toisto ei odota latausta Helsingin
  ruudulla. Aikajanan graafitesti ja savutesti läpi.

### V3 — Aikajanan sadepalkit ja lappu (M)

- `api/sade.js?sarja=1` (FMI `acrr1h` pisteessä), HARMONIE-piste
  tulevaisuuteen, sadepalkit omalla akselillaan (`_tlPalkkiTyyli`-haara
  kuten aalloissa), vartin siivut tutkan jaksolla.
- Havainto / Nowcast / Ennuste -lappu.
- **Hyväksyntä:** T4 (palkki = `acrr1h` samassa pisteessä ±0,1 mm),
  aikajanan rajaus sadetilassa, CLAUDE.md:n aikajana- ja värisäännöt
  päivitetty.

### V4 — Liikekenttä ja liikekompensoitu interpolointi (L)

- Worker: liikekenttä viimeisistä kehyksistä, tasoitus, varmuusmitta.
- Varjostin: kaksisuuntainen siirto (S3b), varatie ristihäivytykseen.
- **Hyväksyntä:** T2 — interpoloitu 5 min kehys on oikeaa kehystä
  lähempänä kuin ristihäivytys (haamupikselit ja sadealan päällekkäisyys,
  mediaani yli taltioidun päivän), T8 suhteena; laitetesti iPhonella.

### V5 — Nowcast 0–90/120 min ja sekoitus HARMONIEen (L)

- Advektio samasta kentästä, epävarmuuden kasvu, sekoitus HARMONIEen
  johtoajan painolla; `api/sade.js?nowcast=1` (MET Norway) aikajanan
  pisteeksi ja vertailukohdaksi.
- **Hyväksyntä:** jälkikäteisvarmennus taltioidusta päivästä: nowcast
  kehyksestä t − 60 min oikeaa kehystä t vastaan (FSS 1 mm/h ja 5 mm/h
  johtoajoittain), verrattuna HARMONIEen ja MET Norwayhin; painot
  valitaan tästä. Raja-säännön (P7) uusi muoto CLAUDE.md:hen.

### V6 — Jatko yli 61 h (S–M, valinnainen, P9)

- ECMWF 9 km sade `api/malli.js`:n tilana (ei uutta funktiota), leima
  "karkea".
- **Hyväksyntä:** ei tyhjää kehystä HARMONIEn lopussa, sekoitus 6 h
  ikkunassa kuten tuulessa.

### V7 — Viimeistely (S–M)

- Kieli (jokainen uusi teksti kahdesti), saavutettavuus (lappu
  `aria-live` pois kuten leimassa), Tietoa-näkymän lähteet (FMI, MET
  Norway CC BY 4.0), `docs/data.md` ja `docs/ui.md` päivitys, CLAUDE.md:n
  sadesäännöt, laitemittaus iPhonella ja iPadilla.

### Järjestyksen perustelu

V1 ja V2 tuovat suurimman näkyvän eron pienimmällä riskillä (sama
koneisto, uusi lähde ja tiheämpi aika). V3 on värimuutoksen ehto. V4 ja
V5 ovat suurin työ ja suurin riski (algoritmi, sujuvuus puhelimella), ja
ne nojaavat V0:n taltioituun päivään — ilman sitä liikkeen laatua ei
voi mitata kontissa.

---

## 8. Riskit

- **Laattamäärä.** Katto 8 → 9 on 4× laattoja per kehys, ja vartit
  kertovat kehysten määrän. 512 px laatta ja esilatausjärjestys ovat
  vastalääke; mitataan V0/V1:ssä ennen kuin katto nousee.
- **FMI:n WMS:n kuorma** (ei avainta, rajaa ei tiedetä). Jos se
  hidastuu, S3 on sama data ilman palvelinrenderöintiä (P1).
- **Liikekentän laatu** kasvavissa ja häviävissä kuuroissa ja
  maakaikujen kohdalla: varmuusmitta ja varatie ristihäivytykseen.
- **Puhelimen muisti:** 8-bittinen kehys on 256 kB / 512 px laatta;
  24 kehystä × 9 laattaa ≈ 57 MB GPU-muistia. LRU ja katto
  kehysmäärälle.
- **Kontti ei mittaa ruutunopeutta.** Sujuvuus varmistetaan laitteella
  (CLAUDE.md, "Mittaaminen tässä ympäristössä").

## 9. Mitä EI ehdoteta

- Omaa tutka-arkistoa git-haaraan (5 min data, ajastin myöhästyy
  tunteja, FMI pitää arkiston).
- 13. Vercel-funktiota (kaikki uudet reitit tiloina olemassa oleviin).
- FMI:n palettia sellaisenaan kartalle (väri tulee voimakkuudesta
  varjostimessa).
- ECMWF 0,25° sateelle (hylätty mittauksella).
- Lämpökarttaa tai partikkeleita sadekerroksen alle.
- Pysteps-ensembleä tai muuta palvelinpuolen Python-laskentaa.
- Kartalle pysyvää väriliuskaa ilman P3:n päätöstä.

---

## 10. Toteutus (4.10.2026) — kaikki vaiheet suosituksen mukaan

Käyttäjän päätös 4.10.: "Tehdään kaikki vaiheet suosituksen mukaan" eli
P1–P9 luvun 6 suositussarakkeen mukaan. Commitit `7a7857d` (V1),
`f9db8ce` (V2), `2737b9c` (V3), `0aaeb61` (V4+V5), `e215e27` (V6) ja
viimeistely.

### V0 — mittarit

- `tools/sademittaus.mjs`: kuvakaappaus sadetilasta annetussa näkymässä
  ja hetkessä, FMI:n oma 250 m kuva samasta rajauksesta vertailuun,
  tutkalaattojen pyynnöt ja tavut, `--tallenna`/`--toista` FMI:n
  vastauksille.
- `tools/sadeliike.mjs`: liikekompensoitu interpolointi ja nowcast oikeita
  tutkakehyksiä vasten (luku "Mitattu" alla).
- **Kontin Chromium tarvitsee `--ignore-certificate-errors`in**
  (välityspalvelimen CA): ilman sitä jokainen openwms-kuva kaatui
  `ERR_CERT_AUTHORITY_INVALID`iin ja kerros jäi "ladataan"-tilaan —
  mittari olisi väittänyt tutkan rikki.

### V1 — 250 m ja klassinen väri

- `Sadetutka.KERROS` = `radar_finland_cappi_dbzh` (FINRAD, `qc`).
  Paletti on 252 RGB + 252 alfaa (`RADAR_PALETTI`, sama MD5 eri laatoilla
  ja ajoilla). Indeksi → dBZ on GeoServerin ramppi selitteen katkoista
  (`DBZ_KATKOT` 5, 8, 12, 18, 24, 30, 34, 40, 50, 68,8 dBZ, 25 indeksin
  välein), ristiintarkistettu `raster`-tyyliä vasten (idx 25/50/75/100 =
  raaka 80/88/100/112 = 8/12/18/24 dBZ). dBZ → mm/h `Sade.mmhDbz`
  (`DBZ_MMH`, samat FMI:n selitteet kuin ennen). Indeksit 1–24 ovat FMI:n
  oma häivytys (alfa < 255): niille dBZ alfasta, 5 + 3·a/255.
  `raster`-tyyli EI kelpaa suoraan: se on venytetty harmaa (1,75·raaka +
  3), ei raaka tavu.
- `SadeKerros`: `tileSize: 512`, `maxNativeZoom: 9` = 153 m/px
  Helsingin leveydellä, laattoja yhtä monta kuin ennen 256 px:llä tasolta
  8. B-spline jäi: 153 m:n tekseleillä sen pehmennys on alle lähteen
  250 m:n, ja se peittää WMS:n lähimmän naapurin portaat.
- `Sade.RAMPPI_TUMMA` FMI:n summer-tyylin sävyin samoissa dBZ-katkoissa,
  peittävyys 0,80 → 0,88 (`Sade.alfa`, tihku syttyy 0,015 → 0,09 mm/h).
  Asetusten asteikon luvut 0,1 · 1 · 10 · 25.

### V2 — 5 min ja vartit

- Liikkeessä (toisto, veto) tutkan ja nowcastin jaksolla A ja B ovat
  vierekkäiset 5 min kehykset (`_kohde`), ennusteessa tunnit.
- **Vartit**: `State.sadeVartti` (−30 … +30 min) tunnin indeksin rinnalla;
  `currentHourIdx` on lähin tasatunti, joten tuuli, kortti ja merkit eivät
  muuttuneet. `.tl-vartti`-snäppäyskohdat (+15/+30/+45 min eli 4,5 px:n
  välein) tutkan ja nowcastin jakson tikeissä, `scroll-snap-align` vain
  `html[data-sadekerros="1"]`. **Snäppäyskohta ei saa olla 0 × 0 px:n
  laatikko**: Chromium ohitti sen, ja vierityksen loppu veti aina
  tasatuntiin (mitattu: +2 näppäinaskelta palasi 0:aan); 1 × 1 px toimii.
  Asettavat vain eleen, toiston ja näppäimen päätteet (`_sadeVarttiFrac`,
  `_sadeVarttiAseta`); `_tlValitseHetki` nollaa. Näppäin `,`/`.` on
  sadetilassa vartti (Shift ja PgUp/PgDn tunteja). Kupla hh:mm.
- Toisto kulkee tutkan ja nowcastin jaksolla kolmasosanopeudella (5 min
  kehys 200 ms välein).
- 30 min silmukka, sen pisterivi, `Sadetutka.KEHYKSIA`, `silmukassa()` ja
  `kehykset()` poistettiin (P8). Esilataus levossa ±1 h vartein,
  toistossa kolme askelta eteenpäin; kehysmuisti 28.

### V3 — palkit, lappu, kapseli

- `api/sade.js?sarja=1&lat&lon`: 48 h `radar_finland_cappi_acrr1h`
  tasatunneilla (GetFeatureInfo, 16 rinnakkain), 12 vartin dBZ
  (`radar_finland_cappi_dbzh`), HARMONIE `Precipitation1h` pisteenä ja
  MET Norwayn nowcast (V5). Mitattu 1,4 s; CDN 5 min. GetFeatureInfo
  aikavälille palauttaa vain yhden arvon, siksi rinnakkain.
- Sadetilassa palkki = tunnin kertymä (T − 1 h, T] logaritmisella
  korkeudella 0,05 → 50 mm ja sateen rampin värillä (`_tlSadePalkki`);
  kuiva tunti on 2 px:n hiljainen pohja, tutkan ja nowcastin jaksolla
  neljä vartin siivua. Aikajana rajataan sateen jaksoon (48 h tutkaa →
  ECMWF:n sarjan loppu, `_tlAaltoRajaus`).
- Kupla: Havainto / Lähiennuste / Ennuste (`.tl-kupla-laji`). Kapseli
  (`Crosshair._sadeUpdate`): intensiteetti mm/h rampin värillä, lähde ja
  tunnin kertymä; tuulen nuoli piilossa.

### V4–V5 — liikekenttä ja nowcast (`SadeLiike`, `Nowcast`)

- Laatan kehyksestä talletetaan `karkea` 32² (kaikille) ja `pieni` 256²
  (vain tuoreimmalle). Kenttä: lohkohaku 8 × 8 solua, SAD ±6 tai ±8
  solua, alipikseli paraabelilla, täyttö ja kaksi tasoitusta; yksikkö
  maailmapikseliä viidessä minuutissa. Ei tarpeeksi sadetta → nollakenttä
  (pysyvyys).
- Varjostin (`_pLaatta`) lukee kentän tekstuurista ja sekoittaa A:n
  kohdasta x − f·d ja B:n kohdasta x + (1 − f)·d.
- Nowcast: taaksepäin kulkeva siirtymä karkealla hilalla viiden minuutin
  askelin, lähtö 256²-mosaiikista näkymän ja laattarenkaan yli
  (`GLRuudukko`n uusi `reuna`-optio: renkaan laatat hakevat vain
  tuoreimman ja vartin takaisen kehyksen). Sumennus σ = 0,02 km/min,
  vaimennus 25 % / 2 h. Kehys lasketaan vain näkymälle +15 %
  (mitattuna 80 → 14–20 ms kontissa) ja muisti on 8 kehystä.
  Ensimmäiset 15 min tuorein tutkakehys täydellä tarkkuudella siirrettynä
  kentän mukana (`u_s`), häivyttäen mosaiikkiin; **saumaton, koska
  laajennettu nelikulmio piirtää pikselin sen laatan tekstuurista jonka
  sisällä LÄHDE on** (ensimmäinen versio käytti siirtämätöntä näytettä
  laatan ulkopuolella ja jätti laattarajalle näkyvän sauman).
- Sekoitus HARMONIEen: paino 1 → 0 välillä +30 … +120 min
  (`painoNowcast`). Raja: hetki ≤ tuorein kehys + 2,5 min = tutka,
  ≤ + 120 min = lähiennuste, sitten ennuste (`_tutkaLahde`); ennen
  ensimmäistä luotausta vanha tunnin sääntö.
- Aikajana ja kapseli lukevat nowcastin pisteen radasta (`SadeLiike.arvo`
  → `Nowcast.vartti`/`tunti`), eivät kehyksistä; varatienä MET Norwayn
  pistesarja.
- Ensimmäinen versio laski kaikki 24 kehystä taustalla koko mosaiikille
  ja näytti +40 min kohdalla pelkkää HARMONIEa, koska kehys jäi
  laskematta (`_laskettu`) eikä uutta ruutua pyydetty. Nyt odotus
  laskee kehyksen ja pyytää ruudun.

### V6 — ECMWF:n jatko

- `api/malli.js?muuttuja=sade&t&s&n&w&e`: ECMWF IFS 9 km `precipitation`
  samassa muodossa kuin HARMONIE-hila; tiedoston arvo on askeleen kertymä
  (1/3/6 h), intensiteetti = kertymä / askeleen tunnit.
  `tila=sarja&muuttuja=sade`: pisteen tuntisarja 10 vrk (Open-Meteon
  aikasarjavarasto jakaa kertymät tunneille). Tarkistettu Open-Meteon
  rajapintaa vasten 8.10. klo 16–18 UTC: rajapinta 0,10 mm/h kukin,
  kenttä 0,08 mm/h (0,24 mm / 3 h; eri solmu).
- `Sadeennuste.varmista` hakee ECMWF:n kun tunti on HARMONIEn jakson
  jälkeen tai HARMONIE vastaa tulevalle tunnille tyhjää; leima "ECMWF
  9 km, karkea".

### Mitattu

Kontti, Chromium + SwiftShader, 4.10. klo 14–15 UTC, sateinen Savo
(61,6 / 27,5), taso 9, karkea hila 2,4 km.

```
T2 interpolointi (t, t+20 min -> t+10 min)   MAE mm/h        CSI 0,5 mm/h
hetki  kelpo-lohkoja                 risti   liike     risti   liike
14:00      54                        0,276   0,110     0,584   0,877
13:45      49                        0,285   0,103     0,582   0,899
13:30      52                        0,263   0,091     0,568   0,893
13:15      47                        0,264   0,105     0,564   0,853
13:00      49                        0,245   0,095     0,571   0,845
mediaani                             0,264   0,103     0,571   0,877

T5 nowcast 60 min          FSS 1 mm/h (30 km)   FSS 5 mm/h       CSI 0,5
hetki  kelpo               pysyv.  advekt.      pysyv.  advekt.  pysyv. advekt.
14:35    49                0,169   0,936        0,062   0,502    0,053  0,507
14:20    46                0,130   0,958        0,006   0,841    0,035  0,512
14:05    46                0,108   0,942        0,001   0,758    0,023  0,472
13:50    47                0,081   0,918        0,000   0,585    0,029  0,477
13:35    46                0,053   0,555        0,000   0,015    0,013  0,229
mediaani                   0,108   0,936        0,001   0,585    0,029  0,477
```

Liikekompensoitu interpolointi puolitti virheen ja nosti sadealan
osuvuuden 0,57 → 0,88; nowcast 60 min oli moninkertaisesti pysyvyyttä
parempi (nopeasti liikkuva rintama, jolloin pysyvyys on heikko vertailu).
HARMONIEa vasten nowcastia ei ole mitattu (eri hila ja projektio) —
sekoituksen painot ovat suosituksen eivätkä mittauksen.

Hinta (kontti, puhelinkonteksti): kenttä 9–37 ms (mediaani ~18 ms),
nowcast-kehys 14–20 ms, kapselin ja aikajanan 24 pisteen arvo 0,1 ms.
Ruutunopeutta ei voi mitata täällä (CLAUDE.md) — **laitetesti iPhonella
on tekemättä**.

Muut tarkistukset: savutesti ja graafitesti läpi, `?kieli=en` sadetilassa
(Observation / Nowcast / Forecast, "radar + HARMONIE", "ECMWF 9 km,
coarse", "in the hour"), ei `pageerror`ia.

### Mitä jäi auki

- Laitetesti (iPhone, WebKit): toiston sujuvuus tutkan jaksolla ja
  nowcastin laskennan hinta pääsäikeellä.
- Interpolointi laattarajalla: kahden kehyksen sekoituksessa laatan
  ulkopuolelle osuva näyte luetaan siirtämättä (siirto on ≤ 5 min eli
  pieni), joten liikkeen aikana rajalla voi näkyä heikko epäjatkuvuus.
- Renkaan ulkopuolelta tuleva sade (yli ~80 min tasolla 9) puuttuu
  nowcastista; HARMONIE-sekoitus peittää sen +30 min jälkeen osittain.
- Lumi (talvityyli) ja värisokeusvaihtoehto (`_cvdopt`).

## 11. Koko maailma ja paras paikallinen malli (4.10.2026, beta)

Käyttäjän pyyntö: sadenäkymä samalla tavalla koko maailmalle kuin
tuulinäkymä, paras paikallinen malli aina käytössä; asetusten
esikatselukuva uuteen (klassiseen) väriin ja nimen perään "(beta)".

**Lähteiden järjestys joka pisteessä ja hetkessä** (sama periaate kuin
tuulen Paras-sekoituksessa):

1. **FMI:n tutka** (menneet hetket) ja **nowcast** (+0 … +120 min)
   tutkan katteen sisällä. Kate ei näy datasta — WMS on katteen
   ulkopuolella läpinäkyvä kuten poudalla — joten se lasketaan
   tutka-asemista (`TutkaKate`: 12 asemaa, 250 km, reunalla 40 km:n
   siirtymä). Samaa funktiota käyttävät varjostin (`tutkaKate`),
   laattojen karsinta (`_laattaOk`: tutkalaattoja ei haeta katteen
   rajauksen ulkopuolelta), aikajanan pistesarja ja kapseli.
2. **HARMONIE** (MEPS-alue: Pohjoismaat ja Baltia) jaksonsa loppuun.
   `api/sade.js?puuttuva=1` merkitsee alueen ulkopuolen 65535:ksi (NaN
   ennen nollana oli sama kuin pouta), ja asiakas laskee hilasta katteen
   maskin (`Sadeennuste._maski`, chamfer-etäisyys, 50 km:n smoothstep).
   GRIBin pituusaste 0–360 käännetään −180…180:ksi (länsi oli 350).
3. **ECMWF 9 km** kaikkialla muualla ja HARMONIEn jälkeen, myös
   menneillä tunneilla (vanhojen ajojen alkutunnit, `etsiAjo` 96 h;
   pistesarja nyt −50 h … +10 vrk). `malli.js?muuttuja=sade` hyväksyy
   koko maapallon; hila on silloinkin enintään 160 × 160 (2,25°).

**Piirto.** Ennustehila on LUMINANCE_ALPHA (voimakkuus, kate) ja
varjostin lukee tunnista HARMONIEn ja ECMWF:n (A ja B -tunnit, neljä
tekstuuria) ja sekoittaa voimakkuudet HARMONIEn katteella. Tutkan
hetkillä katteen ulkopuolelle piirretään sama malli taustaksi (kaksi
tasatuntia hetken osuudella, `_piirraTausta`, `u_kat` = 1 → malli
väistyy tutkan alta), ja nowcastin alla malli on painolla
1 − wn·kate (katteen ulkopuolella täysi). ECMWF haetaan vasta kun
HARMONIE ei kata näkymää kokonaan, joten Suomessa pyyntöjä ei tule
lisää; ECMWF:n rajaus pyöristetään 1/16:aan omasta koostaan (CDN).

**Mitattu (kontti, tuotantobuild):** ECMWF-hila Suomi 1,2 s, Eurooppa
1,5 s, koko maailma 3,3 s. Biskajanlahdella aikajanan 289 tuntia ovat
kaikki ECMWF:ää (myös menneet), Helsingissä tutka 48 h, nowcast,
HARMONIE 48 h ja ECMWF 191 h. Leima kertoo mallin ("Sadetutka 22:00 ·
muualla ECMWF 9 km", "Sade-ennuste 18:00 · HARMONIE + ECMWF 9 km"), ja
sadetilassa tuulen lähdemerkintä väistyy, jottei kaksi lappua mene
päällekkäin. Savutesti ja graafitesti läpi, ei `pageerror`ia
kummallakaan kielellä.

**Esikatselukuva** käyttää logaritmista voimakkuutta (laaja heikko
sininen–vihreä, keltainen ja oranssi kuuroissa, punainen ytimissä);
lineaarinen käyrä teki klassisella rampilla kuvasta lähes kokonaan
punaisen. Nimi on "Sade (beta)" / "Rain (beta)", beta pienempänä ja
himmeämpänä, ja se saa ulottua ruutujen väliin 320 px:n puhelimella.

**Auki:** tutkan kate on laskettu eikä mitattu (FMI:n komposiitin
todellinen reuna voi olla lähempänä etenkin Ruotsin puolella);
ICON-EU olisi Keski-Euroopassa ECMWF:ää tarkempi, mutta tuulen
Paras-sekoitus käyttää samaa järjestystä (FMI > ECMWF), ja yksi
järjestys on pidetty molemmille.
