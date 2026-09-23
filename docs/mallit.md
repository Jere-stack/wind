# Säämallit kartalla — nykytila, mittaukset ja strategiat

Pyyntö (syyskuu 2026): *"Kartasta pitäisi saada yhtä yhtenäinen kuin
windy.com koko maapallolle ja niin että esim ilmatieteen laitoksen data on
aina käytössä Suomen yllä tai missä dataa on kun valitaan paras mahdollinen
säämalli. Näiden säämallien rajat pitää olla myös pehmeät ja pitää
varmistaa että aina on ilmatieteenlaitoksen data Suomessa kun se on
saatavilla — näin ei aina ole jos käy kartalla aluksi muualla maailmassa
pyörimässä, ja tämän jälkeen alakulman indikaattori ilmoittaa että jokin
toinen säämalli on käytössä esim. Helsingin yllä."*

Kirjoitettiin päätösasiakirjaksi. Kaikki nykytilan luvut on mitattu
tuotantobuildista ja varaston julkaistuista laatoista 23.9.2026 (varaston
ajo 06Z, HARMONIE-ajo 15Z).

**Päätökset (käyttäjä):** MEPS otetaan käyttöön siinä muodossa jota
Yr.no käyttää (MET Nordic, `metno_nordic_pp`); rajan pehmennys 50 km;
aikajana seuraa karttaa (S4); maailma S3:n mukaan eli Windyn tapaan.
Toteutus etenee vaiheittain, ja jokainen vaihe on oma osionsa lopussa.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan kun työ koskee kartan säämallia, mallien rajoja tai
> varaston tasoja.

## Tiivistelmä

1. **"Helsingin yllä on muu malli" on kolmen asian summa, ja vain yksi
   niistä on satunnainen.**
   - *Malli valitaan zoomista.* HARMONIE on käytössä vasta zoomista 10
     (lämpökartassa 9,5). Helsingin yllä z5–7 on ECMWF 1° ja z8–9 ECMWF
     0,5°. Tämä on nykyinen suunnitteluperiaate ("vähiten laattoja"), ei
     vika — mutta se on juuri se mitä pyyntö ei halua.
   - *Kolme eri valintasääntöä.* Lämpökartta, indikaattori ja
     partikkelit/kapseli laskevat tason eri tavoin. Mitattu z9,6:lla:
     lämpökartta HARMONIE, indikaattori ECMWF.
   - *Valittu hetki voi siirtyä muualla käynnin jälkeen.* Paluussa
     Helsinkiin aikajana rakennetaan uudelleen (akseli vaihtuu varasto →
     spotin sarja → varasto, koska Helsingin laatat on pudotettu 40 laatan
     muistista), ja rakennuksen oma vieritys luettiin käyttäjän
     valinnaksi: hetki jäi 21:00 → 15:00 (−4,6 h) kahdella ajolla
     kolmesta. HARMONIE kattaa vain viimeisimmän ajonsa alusta eteenpäin,
     joten menneisyyteen siirtynyt hetki on ECMWF:ää. **Korjattu (V1).**
2. **FMI:n data ei kata koko Suomea edes lähizoomissa.** Varaston
   HARMONIE-taso on lat 58–66, lng 18–31: Lappi (66–70,1°) ja itäraja
   (31–31,6°) jäävät pois. FMI:n oma HARMONIE kattaa mitattuna lat 50–75,
   lng −15…50.
3. **Rajat ovat kovia ja hyppy on iso.** HARMONIE-alueen reunalla ero
   ECMWF:ään on keskimäärin 1,09 m/s, 44 % pisteistä yli 1 m/s, pahimmillaan
   5,4 m/s. Helsingin seudulla zoomin raja z9 → z10 vaihtaa kentän
   keskimäärin 1,62 m/s (pahimmillaan 7,0 m/s, suunta p90 62°).
4. **Muu maailma on karkea.** ECMWF 0,25° on vain Suomen ympäristössä,
   Euroopassa 0,5° ja muualla 1° (~100 km). Windyn ECMWF on 9 km.
   Karkeat tasot on lisäksi harvennettu poimimalla lähin piste ilman
   keskiarvoa, joten sama malli näyttää eri luvun eri zoomilla (z7 → z8
   Helsingin seudulla ka 1,01 m/s).
5. **Open-Meteon S3:ssa on paljon parempaa dataa kuin käytämme**, ja se on
   luettavissa suoraan selaimesta: `ecmwf_ifs` (HRES O1280 ≈ 9 km,
   tunneittain, 15 vrk, tuuli + puuska), `metno_nordic_pp` (MEPS-pohjainen
   1 km, lat 52–72 / lng 2–42) ja kymmeniä alueellisia malleja. CORS on auki
   (`Access-Control-Allow-Origin: *`, `Range` sallittu, `Content-Range`
   näkyy).

**Suositus:** S1 heti (malli paikan ja hetken mukaan eikä zoomin, yksi
valintasääntö, pehmeät rajat, hetki aikana, FMI koko Suomeen) — se ratkaisee
pyynnön Suomea koskevat kohdat nykyisen varaston sisällä. Koko maapallon
tarkkuudesta päätetään sen jälkeen: S2 (ECMWF 0,25° globaalisti varastoon,
mitattu 123 MB) on halpa ensimmäinen askel; S3 (suora luku S3:sta, Windyn
taso) vain jos 9 km koko maailmassa on oikea tavoite, ja silloin ensin
prototyyppi.

## Tavoitteet — mitä "yhtenäinen" tarkoittaa tässä

| | tavoite | nyt |
|---|---|---|
| T1 | Malli valitaan **paikan ja hetken** mukaan; zoom valitsee vain tarkkuuden saman mallin sisällä | zoom valitsee mallin |
| T2 | **Yksi** valintasääntö: lämpökartta, partikkelit, kapseli, indikaattori, asetusvihje | kolme sääntöä |
| T3 | Mallien rajat **pehmeät** paikassa ja ajassa | kovat |
| T4 | Valittu hetki on **aika**, ei indeksi | indeksi, joka voi siirtyä |
| T5 | Koko maapallo ilman aukkoja; zoomatessa kenttä **tarkentuu** eikä vaihdu | 1° maailma, harvennetut tasot |

## Nykytila mitattuna

### Varaston tasot (`luettelo.json`, ajo 23.9. 06Z)

| taso | malli | askel | alue | aika | laattoja |
|---|---|---|---|---|---|
| h0 | FMI HARMONIE | 0,05° | lat 58–66, lng 18–31 | ajon alusta (15Z) +60 h, tunneittain | 104 |
| l0 | ECMWF IFS | 0,25° | lat 54–71, lng 14–33 | noin −52 h … +14 vrk, 3 h / 6 h | 25 |
| l1 | ECMWF IFS | 0,5° | lat 28–80, lng −45…65 | sama | 72 |
| l2 | ECMWF IFS | 1° | koko maapallo | sama | 180 |
| l3 / l4 | ECMWF IFS | 2,5° / 5° | koko maapallo | sama | 32 / 8 |

l1–l4 on tehty 0,25°:n kentästä **poimimalla lähin piste** (`srcIdx`,
`tools/tiilet.mjs`), ei keskiarvolla.

### Mikä zoom valitsee minkä tason (Helsinki)

`laattaStep`: z ≤ 4 → 1,25°, z5–7 → 1°, z8–9 → 0,5°, z ≥ 10 → 0,05°.
`taso()` ottaa **karkeimman** tason jonka askel riittää, joten 0,05°:n
tason saa vain kun pyydetty askel on alle 0,25°.

| zoom | lämpökartta | indikaattori |
|---|---|---|
| 7 | l2 ECMWF 1° | "ECMWF IFS 0,25°" |
| 8–9 | l1 ECMWF 0,5° | "ECMWF IFS 0,25°" |
| 9,6 | **h0 HARMONIE** | **"ECMWF IFS 0,25°"** |
| 10–11 | h0 HARMONIE | "FMI HARMONIE 2,5 km" |

Indikaattori sanoo "0,25°" myös silloin kun taso on 0,5° tai 1°, koska
kaikilla ECMWF-tasoilla on sama nimi (`Lahde.NIMET.laatta`).

Kolme valintasääntöä:

| kuluttaja | askel |
|---|---|
| lämpökartta (`LampoGL`) | `laattaStep(round(zoom))` |
| indikaattori, asetusvihje | `laattaStep(zoom)` (ei pyöristystä) |
| partikkelit, kapseli (`WindTexture.hila`) | `kaytettyStep(zoom)` — laahaa edellisen haun perässä — tai z ≥ 10 `laattaStep` |
| aikajana, spottisarja | `taso(…, sarjalle = true)` → ei koskaan h0 |

### Maailmankierros ja paluu

`malliraja*.mjs`: Helsinki z10 → New York → Sydney → maailma z3,5 → Rio →
Tokio → `flyTo` Helsinki z10. Neljä ajoa, joista neljäs vahti-ajo.

- HARMONIE palasi lämpökarttaan ja indikaattoriin 2,5 s:ssa kolmella
  mitatulla ajolla (h0-laattoja 0 → 18 → 36). Laattamuisti on 40 laattaa
  ja pudottaa vanhimman ensin (lisäysjärjestys, ei käyttöjärjestys), joten
  muualla käynti tyhjentää Suomen laatat joka kerta.
- **Valittu hetki:** kahdella ajolla 21:00 → 15:00 (−4,6 h), yhdellä se
  pysyi oikeassa. Paluussa akseli vaihtuu edestakaisin: `aikajananLahde()`
  putoaa lähimpään rajapintapisteeseen (spotin HARMONIE-sarja, alkaa
  ajohetkestä 15:00) kun varaston laatta ei ole vielä muistissa, ja palaa
  varastoon kun laatta tulee. **Ensimmäinen arvaus oli että indeksi
  luetaan väärältä akselilta — se oli väärin.** Tarkempi vahti näytti
  kirjoittajaksi aikajanan oman vieritystapahtuman: uudelleenrakennuksen
  snäppäys luettiin sormeksi (ks. *V1* alempana).
- HARMONIEn aika-akseli alkaa **viimeisimmän ajon alusta** (nyt 15Z) eikä
  sillä ole menneisyyttä. Kun valittu hetki on yli tunnin sitä ennen,
  `taso()` ohittaa h0:n ja Helsinki on ECMWF:ää — oikein nykysäännöillä,
  mutta juuri se oire jota pyyntö kuvaa.

### Rajojen hyppy

Varaston omista laatoista, sama piste ja sama hetki, kuusi hetkeä 9 h
välein seuraavan kahden vuorokauden ajalta (`raja.mjs`, `zoomraja.mjs`).

h0:n reunat (HARMONIE vs ECMWF 0,25°):

| reuna | ka | p90 | pahin | yli 1 m/s | suunta p90 |
|---|---|---|---|---|---|
| etelä 58,05° (Viro, Suomenlahti) | 1,40 | 2,44 | 4,80 | 59 % | 37° |
| länsi 18,05° (Ruotsi, Ahvenanmeri) | 0,89 | 1,76 | 2,60 | 38 % | 64° |
| pohjoinen 65,95° (Oulu–Rovaniemi) | 0,75 | 1,44 | 2,68 | 28 % | 58° |
| itä 30,95° (Karjala) | 1,35 | 2,64 | 5,40 | 52 % | 39° |
| **kaikki** | **1,09** | | | **44 %** (yli 2 m/s 13 %) | |

Zoomin rajat Helsingin seudulla (lat 59,6–60,8, lng 23,5–26,5):

| siirtymä | ka | p90 | pahin | yli 1 m/s | suunta p90 |
|---|---|---|---|---|---|
| z7 → z8 (ECMWF 1° → 0,5°) | 1,01 | 2,28 | 5,36 | 42 % | 17° |
| ECMWF 0,5° → 0,25° | 0,66 | 1,64 | 3,28 | 25 % | 10° |
| **z9 → z10 (ECMWF 0,5° → HARMONIE)** | **1,62** | 3,56 | **7,00** | **58 %** | 62° |

Sama malli (ECMWF) eri tasoilla eroaa 0,66–1,01 m/s: se on harvennuksen
laskostumista rannikolla, ei mallieroa.

### Mitä S3:ssa on (tarkistettu 23.9.2026)

`https://openmeteo.s3.amazonaws.com/data_spatial/<malli>/latest.json`:

| malli | hila | alue | hetkiä | tuulimuuttujat |
|---|---|---|---|---|
| `ecmwf_ifs` | O1280 (≈ 9 km, redusoitu Gauss) | maapallo | 145 (15 vrk, alussa tunneittain) | u, v, puuska |
| `ecmwf_ifs025` | 0,25° | maapallo | 49 (06Z-ajo) | u, v |
| `metno_nordic_pp` | Lambert, 1 km | lat 52–72, lng 2–42 | 59 (tunneittain) | nopeus, suunta, puuska |
| `dmi_harmonie_arome_europe` | Lambert | lat 40–63, lng −25…40 | 60 | nopeus, suunta, puuska |
| `dwd_icon_eu` | 0,0625° | lat 30–71, lng −24…63 | 31 | u, v, puuska |

Lisäksi mm. `dwd_icon_d2`, `knmi_harmonie_arome_europe`,
`meteofrance_arome_france_hd`, `ukmo_uk_deterministic_2km`,
`ncep_hrrr_conus`, `jma_msm`, `cmc_gem_hrdps`. CORS:
`Access-Control-Allow-Origin: *`, esikysely sallii `range`-otsakkeen ja
`Content-Range` on näkyvissä. Osavälin luku on mitattu rakentajassa
(`tools/tiilet.mjs`): 64 × 64 pisteen ikkuna 4,2 M pisteen tiedostosta
2,0 kB / 4 pyyntöä.

**`metno_nordic_pp` ei ole Ilmatieteen laitoksen dataa**, vaikka se on
samaa MEPS/HARMONIE-mallia: se on MET Norjan jälkikäsitelty 1 km tuote
(ks. `docs/lisadata.md` "MEPS toisena mallina — se ON HARMONIE"). FMI:n
oma HARMONIE ei ole S3:ssa, joten se tulee jatkossakin omasta putkesta
(`tools/harmonie.mjs`).

### Windy

Windy näyttää yhden mallin kerrallaan; oletus ECMWF on yksi
maailmanlaajuinen kenttä, jonka dataruudut tulevat zoomin mukaisesta
pyramidista ja piirretään GL:llä (`docs/sujuvuus.md`, luettu sen omasta
koodista). "Yhtenäisyys" syntyy siitä että zoom tarkentaa samaa mallia
eikä vaihda sitä. Pehmeää saumaa kahden mallin välillä Windyssä ei ole —
se on tämän pyynnön oma lisävaatimus.

## Strategiat

### S1 — Malli paikan ja hetken mukaan, pehmeät rajat, nykyinen varasto

Pienin muutos joka täyttää T1–T4 Suomessa.

**Rakentaja (`tools/tiilet.mjs`, `tools/harmonie.mjs`):**
- **HARMONIE koko Suomeen.** h0:n alue lat 59,5–70,5, lng 19–32. Latauksen
  arvio suhteessa mitattuun (24,9 MB / 49 s alueelle 8° × 13°): 11° × 13°
  on +38 % eli noin 34 MB / 70 s ja 143 laattaa.
- **HARMONIE-pyramidi.** Samasta HARMONIE-kentästä tasot h1 0,1°, h2 0,25°
  ja h3 0,5°, jolloin Suomen yllä on HARMONIEa kaikilla zoomeilla
  66 tunnin sisällä. Zoom valitsee vain tason tarkkuuden (T1).
- **Karkeat tasot suodatettuina.** Sekä HARMONIE- että ECMWF-tasot
  keskiarvona ruudun alalta (u, v erikseen) eikä lähimpänä pisteenä.
  Zoomin rajan hyppy (ka 0,66–1,01 m/s samassa mallissa) pienenee, koska
  karkea taso on hienon taso tasoitettuna eikä sen satunnainen otos.
- **Pehmeä raja paikassa, leivottuna laattoihin.** HARMONIE-tasojen
  reunavyöhykkeellä (esim. 1° ≈ 55–110 km) kirjoitetaan
  `w·HARMONIE + (1−w)·ECMWF` u/v-komponentteina (paikassa vektorit, kuten
  CLAUDE.md vaatii), `w` smoothstep reunaetäisyydestä. Reunalla `w = 0`,
  joten viereinen ECMWF-laatta jatkuu täsmälleen samasta arvosta —
  asiakaspää ei muutu lainkaan.
- **Pehmeä raja ajassa.** HARMONIEn viimeiset 6 h sekoitetaan kohti
  ECMWF:ää samalla tavalla (nopeus ja suunta erikseen, kuten ajassa
  kuuluu), jolloin 60 tunnin rajan ylitys ei hyppää. Menneisyys: joko
  aiempien FMI-ajojen alkutunnit h0:n menneisyydeksi (kuten ECMWF-tasoilla
  jo tehdään — **tarkistettava tukeeko FMI:n download-palvelu vanhoja
  ajoja**), tai sama sekoitus ajon alkuun.

**Asiakaspää (`index.html`):**
- **Yksi valintafunktio** (T2) paikka + hetki + zoom → taso, ja sen
  käyttävät lämpökartta, `WindTexture`, indikaattori ja asetusvihje.
  Pyöristyssääntö sama kaikille.
- **Hetki aikana** (T4): `State.valittuMs` totuutena, indeksi johdetaan
  akselista joka kerta. Korjaa mitatun −4,6 h siirtymän.
- **Laattamuisti käyttöjärjestyksessä** (LRU, luku päivittää) ja
  Suomen näkymän laatat kiinnitettyinä; katto 40 → esim. 80 (≈ 9 MB).
- **Karkeampi varalla hienon latautuessa.** `_hae` kokeilee seuraavaksi
  karkeampaa ladattua tasoa kun hienoa ei vielä ole — ei reikiä eikä
  kuuden sekunnin odotusta, vain tarkentuminen.
- **Indikaattori kertoo sekoituksen:** "FMI HARMONIE", "ECMWF" tai
  "FMI → ECMWF (raja-alue)". ECMWF-tasojen oikea tarkkuus nimeen.

Mitä EI ratkea: muun maailman tarkkuus (T5 Suomen ulkopuolella).
Arvio: 3–5 päivää mittauksineen. Riski: pieni–kohtalainen; kosketus
kohtiin jotka CLAUDE.md on lukinnut (ks. alla).

### S2 — S1 + FMI koko omalle alueelleen + ECMWF 0,25° koko maapallolle

- **HARMONIE koko FMI:n alueelle** (lat 50–75, lng −15…50): 0,05°
  Suomessa ja 0,1° muualla. Arvio: noin 4–5 × nykyinen lataus
  rakennuksessa. Reuna siirtyy mallin omalle reunalle, jossa HARMONIE on
  sidottu isäntämalliinsa, joten saumaa on odotettavasti vähemmän kuin
  nykyisellä rajauksella — **odotus, ei mittaus**.
- **ECMWF l0 0,25° globaaliksi.** Mitattu (`tools/tiilet.mjs`):
  2 592 laattaa, 123 MB, mahtuu orpoon haaraan. Näkymän latauskoko ei
  kasva, koska z ≥ 10 näkymä on yksi laatta. Neljä kertaa nykyistä
  tarkempi Euroopan ulkopuolella.
- Valinnainen: ECMWF-lähteeksi `ecmwf_ifs` (9 km, tunneittain 90 h asti)
  `ecmwf_ifs025`:n sijaan. Vaatii redusoidun Gauss-hilan
  uudelleenhilauksen, ja 0,1° koko maapallolle ei mahdu gitiin (arvio
  ~1 GB/ajo) — vain Eurooppa (arvio ~85 MB) tai ulkoinen säilö.

Arvio: 1–2 viikkoa S1:n päälle. Riski: kohtalainen, lähinnä
rakennusajan ja varaston koon kasvu.

### S3 — Suora luku Open-Meteon S3:sta selaimessa (Windyn taso)

- ECMWF HRES 9 km tunneittain koko maapallolle ja paras alueellinen malli
  kussakin paikassa (ICON-D2, AROME, UKMO 2 km, HRRR …), luettuna
  osaväleinä suoraan `data_spatial`-tiedostoista työsäikeessä
  (`@openmeteo/file-reader`, sama kirjasto kuin rakentajassa).
- Mallien sekoitus GPU:lla: `LampoGL` saa kaksi kenttää ja painon, sama
  smoothstep kuin S1:ssä mutta ajossa.
- FMI HARMONIE pysyy omana tasonaan Suomessa (S1/S2), koska sitä ei ole
  S3:ssa.
- **Hinnat, mittaamatta:** pyyntöjen määrä ja viive Suomesta puhelimella
  (yksi tiedosto per hetki — aikajanan raahaus hakee uusia tiedostoja),
  reprojektio Lambert/Gauss → Mercator, riippuvuus Open-Meteon
  hakemistorakenteesta, aikajanan pistesarjat (`data_spatial` on
  hetkikohtainen; sarjat vaatisivat `data/`-lohkot tai nykyisen
  varaston).

Arvio: viikkoja. Riski: suuri. Ensin 1–2 päivän prototyyppi, joka mittaa
pyynnöt ja viiveen laitteella.

### S4 (valinnainen, S1:n kanssa) — Aikajana samaan malliin

Aikajanan palkit ovat nyt ECMWF:ää myös Suomessa (`vainKartta`), ja
kartan ja janan ero on dokumentoitu (ka 1,38 m/s). Kun varastossa on
HARMONIE-pyramidi ja pehmeä aikaraja, sarja voi olla HARMONIEa ~60 h ja
sen jälkeen ECMWF:ää sekoitettuna — jolloin jana ja kartta näyttävät
saman luvun Suomessa. Menneisyys riippuu S1:n menneisyyskysymyksestä.

## Mihin lukittuihin sääntöihin S1 koskee

Nämä ovat CLAUDE.md:ssä päätöksiä, ja S1 muuttaa niitä tietoisesti:

- "AUTOMAATTINEN TARKOITTAA PARASTA SAATAVILLA, JA PARAS TULEE
  VARASTOSTA" — säilyy; muuttuu vain se, että paras ei riipu zoomista.
- "`vainKartta`-TASO EI KELPAA SARJALLE" — S4 purkaa tämän.
- "AIKAJANA LUKEE VARASTOA MYÖS FMI-TILASSA" — säilyy; S4:ssä varasto
  itse sisältää FMI:n.
- "`currentHourIdx` on INDEKSI" — T4 tekee siitä johdetun arvon.
- "Kumpi taso on tarkempi EI OLE RATKAISTU" — S1 ei väitä HARMONIEa
  tarkemmaksi, vaan toteuttaa pyynnön: FMI Suomessa kun sitä on.

## Avoimet kysymykset

1. Kelpaako `metno_nordic_pp` (MET Norjan MEPS-pohjainen 1 km) FMI:n
   HARMONIEn jatkeeksi Suomen ulkopuolella, vai vain FMI:n oma data?
2. Sekoitusvyöhykkeen leveys: 50 vai 100 km? Leveämpi on pehmeämpi
   mutta vie FMI:tä pois reunalta.
3. Seuraako aikajana karttaa (S4)?
4. Maailman tavoitetaso: 0,25° (S2, ECMWF:n avoin data) vai 9 km (S3,
   Windyn taso)?

## Mittausasetelma

Tuotantobuild (`vite preview`), Chromium 1194, 1280 × 800 ja 393 × 852
(`hasTouch`). Varaston laatat luettiin suoraan
`raw.githubusercontent.com/…/saadata/`ista ja purettiin kuten sovellus
(`naytteista`: bilineaarinen, suunta yksikkövektoreina). Skriptit
scratchpadissa: `malliraja*.mjs` (maailmankierros, indikaattori ja
hetki), `raja.mjs` (h0:n reunat), `zoomraja.mjs` (zoomin rajat).

---

## Toteutus

### Päätösten tarkennukset

- **MET Nordic on Yr:n data.** MET Norjan oma dokumentaatio: MET Nordic
  -ennuste on Yr:n ennusteiden pohja; MEPS-malli jälkikäsiteltynä 1 km:iin
  havainnoilla (myös joukkoistetuilla asemilla), päivitys tunneittain,
  58–64 h. Open-Meteon `metno_nordic_pp` on sama tuote.
- **Hilan geometria tarkistettiin totuutta vasten.** Lambert (sfääri
  R 6 371 229 m, standardileveys 63°, keskimeridiaani 15°), kulmapisteet
  (52,302723° / 1,918457°) ja (72,18527° / 41,764282°), 1 796 × 2 321
  pistettä: hilaväliksi tulee 1 000,03 × 1 000,05 m. Kuusi pistettä
  (Lauttasaari, Utö, Oulu, Kilpisjärvi, Tukholma, Bergen) luettiin
  S3-tiedostosta ja Open-Meteon rajapinnasta samalta hetkeltä: nopeus
  ja suunta täsmälleen samat kaikissa.
- **GPL-2.0 ratkaisi missä S3 luetaan.** `@openmeteo/file-reader` on
  GPL-2.0, eikä repossa ole lisenssiä. Selaimeen toimitettuna koko
  sovellus pitäisi levittää GPL-yhteensopivana; palvelimella ja
  rakentajassa ajettuna koodia ei levitetä. Siksi Windyn tapaan
  omat dataruudut palvelimelta (Vercel-funktio + CDN), ei lukua
  selaimessa.

### V1 — Valittu hetki pysyy (toteutettu)

Juurisyy ei ollut akseleiden kilpajuoksu, vaikka se näytti siltä, vaan
aikajanan uudelleenrakennus: `_tlBeginSelfScroll`in lippu nollautuu
ensimmäisessä `scrollend`issä, ja rakennuksessa vierityksiä on useita.
Vahti `valittuMs`:n ja indeksin kirjoittajiin näytti pinon
`scroll → _tlSeurantaAskel → _tlSeuraaHetkea(0)` 68 ms rakennuksen
jälkeen (scrollLeft 54) — snäppäyksen oma siirto luettiin sormeksi.

Korjaus kahdessa osassa:
1. **Hetki aikana.** `State.valittuMs` on totuus; valintapaikat kirjoittavat
   sen `_tlValitseHetki(idx, times)`illa sen akselin ajasta jolle indeksi
   kuuluu, ja `_tlSailytaHetki` johtaa uuden akselin indeksin siitä.
2. **Rakennusikkuna.** Hidas polku merkitsee rakennuksen ja sijoituksen;
   vieritys- ja `scrollend`-käsittelijät ohittavat 400 ms ikkunan ellei
   sormi ole nauhalla.

Mitattu (`malliraja3.mjs`, maailmankierros ja `flyTo` Helsinkiin):

| | ennen | jälkeen |
|---|---|---|
| valittu hetki paluussa | 21:00 → 15:00 kahdella ajolla kolmesta | 3/3 ajoa ennallaan |
| Helsinki z10 paluun jälkeen | ECMWF kun HARMONIE-ajo alkoi 18:00 | FMI HARMONIE 3/3 |
| rullavieritys aikajanalla | — | valitsee ja kirjoittaa `valittuMs`:n |

Akseli vaihtuu paluussa yhä edestakaisin (varasto 391 tikkiä ↔ spotin
sarja 366), koska kartan keskikohdan varastolaatta on pudonnut 40 laatan
muistista. Hetki säilyy nyt vaihdoissa; itse edestakaisuus poistuu
V3:ssa (laattamuisti ja varataso).
