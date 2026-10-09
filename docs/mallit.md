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

**Tila:** V1–V6 toteutettu (valittu hetki, kolme pyramidia ja
painokanava, yksi valintasääntö, aikajana samaan malliin, ECMWF 9 km
"Paras saatavilla" -tilaan, pakotetut mallit perheinä ja mallin omana
hilana), ja lopussa 5.10. kaukaisen zoomin tarkkuus ja 6.–9.10.
näyttötarkkuuden taso (lämpökartta ei hyppää zoomatessa). Nykytila- ja strategiaosiot ovat päätöksen pohjana olleet
mittaukset ajalta ennen toteutusta; voimassa oleva kuvaus on osiossa
*Toteutus*.

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

### V2 — Rakentaja: kolme pyramidia ja painokanava (toteutettu)

`tools/tiilet.mjs` kirjoittaa kolme mallia omiksi pyramideikseen yhteisen
moduulin (`tools/pyramidi.mjs`) kautta:

| perhe | lähde | tasot | alue | aika |
|---|---|---|---|---|
| FMI | HARMONIE 2,5 km, latauspalvelu (GRIB2) | h0 0,05 · h1 0,1 · h2 0,25 · h3 0,5 | lat 58–71, lng 17–33 | kahden viimeisimmän ajon alusta +66 h, tunneittain |
| MET Nordic | `metno_nordic_pp` S3:sta (Lambert 1 km) | n0 0,05 · n1 0,1 · n2 0,25 · n3 0,5 | Lambert-alue (lat 52,3–73,9, lng −11,8…41,8) | −48 h (kunkin tunnin oma ajo) + tuorein ajo, tunneittain |
| ECMWF | `ecmwf_ifs025` S3:sta | l0 0,25 · l1 0,5 · l2 1 · l3 2,5 · l4 5 | l0 lat 50–75, lng −15…45; l2–l4 maapallo | noin −50 h … +15 vrk, 3 h / 6 h |

**Karkeat tasot ovat suodatettuja.** Laatikkosuodin tason askeleen
levyisenä (reunan pisteet puolella painolla), nopeus keskiarvona ja
suunta yksikkövektoreista. Tarkistettu: h1:n solmu on h0:n solmujen
suodin, suurin ero 0,15 m/s eli kvantisoinnin sisällä (340 solmua).

**Painokanava.** Alueellisen mallin laatassa on neljäs tavutaso
(`tools/pyramidi.mjs`, lippu tavussa 39): smoothstep etäisyydestä alueen
reunaan 50 km matkalla. FMI:llä reuna on suorakaide, MET Nordicilla
Lambert-hilan oma reuna (indeksietäisyys on kilometrejä). Helsingissä
paino on 255, lat 58,00:ssa 0 ja 58,25:ssä 149.

**FMI:n latauspalvelu säilyttää kaksi viimeisintä ajoa.** Luotattu
`origintime`lla kolmen tunnin välein 54 h taaksepäin (23.9. klo 20:45
UTC): 15Z ja 12Z vastasivat, muut 400. Ajo kiinnitetään, jotta taso ei
koostu kahdesta ajosta jos uusi valmistuu kesken haun, ja edellisestä
ajosta otetaan tuorein ajohetkeä edeltävät tunnit. Ennen haku alkoi
rakennushetken tunnista; nyt FMI-kate alkaa 3–9 h aiemmin (mitattu:
akseli 12Z → +69 h, 70 tuntia). Menneisyyttä pidemmälle FMI:llä ei ole
— Suomen menneisyys tulee MET Nordicista.

**MET Nordicin luku rivipaloissa.** Lukijan WASM-keko ei kasva, ja neljä
rinnakkaista 4,2 M pisteen kenttää kaatui `Aborted(OOM)`:iin
(kuusitoista kertaa, rakennus jumiin). 320 rivin paloissa kuusi
rinnakkaista hetkeä luettiin 8,7 s:ssa. Uudelleenhilaus on
aluekeskiarvo: jokainen 1 km:n piste lasketaan kerran lähimpään 0,05°:n
solmuun (10–30 pistettä solmua kohti).

**Luettelo.** `versio` pysyi 1:nä (9.10. alkaen 2, ks. "Laatat ajassa paloina"). `tasot` on vanhan asiakkaan lista
(ECMWF ja h0); uudet tasot ovat `lisatasot`issa ja niillä on `perhe`,
`malli`, `paino: true`, oma `ajat` ja `ajoAika`. Tyhjiä laattoja ei
kirjoiteta, ja `laatat` kertoo mitkä ovat olemassa.

Mitattu kontissa (23.9. klo 21–22 UTC):

| osa | laattoja | koko | aika |
|---|---|---|---|
| ECMWF l0–l4 | 352 | 27,8 MB | 238 s |
| FMI h0–h3 | 296 | 13,6 MB | 123 s (55 MB GRIB2) |
| MET Nordic n0–n3 | 1 126 | 64,5 MB | 261 s |
| **yhteensä** | **1 774** | **105,7 MB** | **622 s**, muisti enintään 0,85 GB |

Ensimmäinen ajo GitHub Actionsissa (23.9. klo 21:36 UTC, käsin
käynnistetty): rakennus 494 s (ECMWF 143 s, FMI 147 s ajoista 18Z ja
15Z, MET Nordic 201 s ja 107 tuntia), 107,2 MB, julkaisu 13 s.
Tuotantosivu luki sen heti oikein (sama `ui.mjs`-kierros kuin
kontissa, ei virheitä).

Työnkulun aikaraja nostettiin 30 → 45 min. Orpo haara pitää yhden
version kerrallaan; repon koko oli 31,8 MB kuukauden pakkopäivitysten
jälkeen, eli GitHub siivoaa pudotetut versiot.

### V3 — Sovellus: malli paikan ja hetken mukaan (toteutettu)

**Yksi valintasääntö.** `Saalaatat.naytteista` käy perheet läpi
tärkeimmästä alkaen (FMI, MET Nordic, ECMWF). Perheen paino on
painokanava kertaa aikapaino (smoothstep akselin alussa 2 h, lopussa
6 h), ja se peittää alemmat painonsa verran. Zoom valitsee vain perheen
sisältä tason (`_perheenTaso`, `laattaStep`: z10+ 0,05, z9 0,1, z8 0,25,
z7 0,5). Lämpökartta, partikkelit, kapseli, aikajana ja lähdemerkintä
lukevat kaikki tätä.

**Laatat.** `varmista` hakee perhe kerrallaan eikä hae alempaa perhettä
täyden ylemmän laatan alle; laatat luetellaan tasoittain eikä
näytteistetä (pistenäyte ohitti tason reunakaistaleen: 120 solmua
3 600:sta ilman laattaa). Muisti on käyttöjärjestyksessä ja 160 laattaa.
Puuttuvan laatan tilalla käytetään saman perheen karkeampaa ladattua
tasoa, ja solmu merkitään vajaaksi (maski 2), jolloin lämpökartta
odottaa oikeaa kuten puuttuvaa dataa — ruudulle ei vaihdu hetkeksi
toista mallia. Versioavain on rakennushetki (`luotu`).

Mitattu uudella varastolla (`v3.mjs`, `ui.mjs`, Chromium 1280 × 800 ja
393 × 852 `hasTouch`):

| paikka (nyt) | malli |
|---|---|
| Helsinki, Lauttasaari, Oulu, Utsjoki, Joensuu, Tukholma, Tallinna, Pietari | FMI 100 % |
| Riika, Oslo, Kööpenhamina | MET Nordic 100 % |
| Berliini, Pariisi, New York | ECMWF 100 % |
| Ruotsin rannikko 62,0 / 17,2 | MET Nordic → FMI (raja-alue) |
| Viro 58,3 / 25,0 | FMI → MET Nordic (raja-alue) |

Helsinki hetken mukaan: −47 h MET Nordic 50 % / ECMWF 50 % (MET
Nordicin akselin alku), −30 … −10 h MET Nordic, −6 … +48 h FMI, +58 h
FMI 26 % / ECMWF 74 %, +62 h eteenpäin ECMWF.

Helsinki zoomeilla 5–11: lähdemerkintä "Ilmatieteen laitos · HARMONIE
2,5 km" jokaisella (ennen ECMWF alle z10:n). Maailmankierroksen (New
York, Sydney, maailma, Tokio) jälkeen FMI palasi 5 s:ssa työpöydällä ja
2,5 s:ssa puhelimella, valittu hetki pysyi, aikajana 400 tikkiä
varastosta koko ajan.

Rajat (0,05°:n profiili rajan yli, vierekkäisten pisteiden ero):

| raja | raja-alueella ka / max | mallin sisällä ka / max |
|---|---|---|
| FMI etelä (Viro) | 0,08 / 0,23 m/s | 0,18 / 0,80 |
| FMI länsi (Ruotsi) | 0,23 / 1,46 | 0,18 / 0,80 |
| FMI itä (Karjala) | 0,11 / 0,18 | 0,09 / 0,40 |
| FMI pohjoinen (Norja) | 0,86 / 2,18 | 0,55 / 1,20 |
| MET Nordic etelä (Puola) | 0,08 / 0,16 | 0,18 / 0,80 |

Suurimmat erot ovat rannikkoviivoja (Ruotsin rannikko 17,5°, Norjan
pohjoisrannikko), ja suunnan 120–179°:n hypyt osuvat kaikki alle
1 m/s:n tuuleen. Ennen: h0:n reunalla ka 1,09 m/s, 44 % yli 1 m/s,
pahin 5,4 m/s yhden solmuvälin matkalla.

Zoomin rajat Helsingin seudulla, sama piste eri tasoilla: 0,5 → 0,25
ka 0,46 m/s, 0,25 → 0,1 ka 0,23, 0,1 → 0,05 ka 0,14 (ennen 1,01 /
0,66 / 1,62, ja z9 → z10 vaihtoi mallia).

`kokoaHila` 3 600 solmua: 2,4–3,5 ms (Suomi, raja-alue, Pariisi —
kaikki samaa luokkaa).

**Yhteensopivuus molempiin suuntiin.** Uusi asiakas vanhalla
varastolla: FMI h0 lähizoomissa (neljän kerroin estää 0,05°:n tason
leveissä näkymissä), aikaraja pehmenee. Vanha asiakas uudella
varastolla: toimii kuten ennen isommalla h0-alueella, ei virheitä
kolmella ajolla.

### V4 — Aikajana samaan malliin (toteutettu)

`wxTunneittain` laskee jokaisen tunnin `naytteista`lla (tuuli ja
puuska), akselina pohjamallin tuntiakseli. Mitattu Helsingissä z10:
400 tuntia, 0 tyhjää, ero kartan näytteeseen 0,0000 m/s, 1,6 ms.
Sarjassa näkyy sama malliketju kuin kartalla: akselin alussa ECMWF
johon MET Nordic liukuu kahdessa tunnissa, MET Nordic, FMI
(−9 … +54 h), sekoitus, ECMWF.

### Tarkistukset lähteitä vasten

- **MET Nordic** (n0-solmu vs Open-Meteon `metno_nordic`, 99 tuntia):
  Oslo ka 0,12 m/s (max 0,40), Göteborg 0,09 (0,30), Riika 0,09 (0,30).
  Ero on 0,05°:n aluekeskiarvon ja 1 km:n pisteen välinen.
- **FMI** (h0-solmu vs FMI:n pistekysely): ensin ka 1,61 m/s — mutta
  pistekysely oli jo 18Z-ajoa ja varasto 15Z:aa (`origintime` ei
  vaikuta pistekyselyyn). Saman ajon hila vs piste: ka 0,07 m/s. Uusi
  h0 on tavulleen sama kuin tuotannon h0 samasta ajosta.

### V5 — ECMWF 9 km (kokeilu, V6:sta alkaen osa "Paras saatavilla")

Kokeiluvaiheessa asetus oli **Kartan säämalli → Paras + ECMWF 9 km**
(`malli: 'auto9'`). Käyttäjä vertasi laitteella eikä huomannut eroa
sujuvuudessa, joten 9 km on V6:sta alkaen "Paras saatavilla" -tilassa
eikä erillistä sirua ole. Varasto on ennallaan ja antaa kuvan heti; 9 km
tulee sen päälle palvelimelta (`api/malli.js`, Windyn tapaan tunti
kerrallaan):

- **Kenttä** valitulle tasatunnille näkymän pehmustetulle alueelle
  (0,6 näkymää, pyöristetty 0,5°:een välimuistin takia), zoomista 8
  ylöspäin, 0,1°:n hilana. Ei haeta jos FMI tai MET Nordic peittää
  koko näkyvän alueen (mitattu: Helsingin z10 ohitettiin).
- **Sarja** kartan keskipisteelle koko aikajanan akselille. Aikajana on
  Suomessa MET Nordic (menneisyys) → FMI (noin 2,5 vrk) → **ECMWF 9 km**
  loppuun asti.
- **Perhe `ecmwf9`** (V6:sta `dyn`, `api: 'ecmwf'`) on alueellisten alla ja varaston ECMWF:n päällä.
  Paino on 1 vain sillä tunnilla jonka laatta on (tai jolle sarjassa on
  arvo) ja reuna häivytetään 8 %:n matkalla. Raahatessa hetki on tuntien
  välissä, joten eleen aikana näkyy varasto eikä mikään odota verkkoa.
- **Asetusvihje näyttää viimeisen haun keston** (koko matka / siitä
  palvelimella) ja koon, jotta vertailu onnistuu puhelimella.

**Lähteet ja hila.** `data_spatial/ecmwf_ifs/<ajo>/<hetki>.om` kentille
ja Open-Meteon aikasarjavarasto `data/ecmwf_ifs/<muuttuja>/chunk_N.om`
(504 h tiedostoa kohti, lohko 6 pistettä × 504 h) sarjoille. O1280:ssa
on 2 560 riviä pohjoisesta etelään, rivillä k (≤ 1280) 20 + 4(k−1)
pistettä pituusasteesta 0 itään; leveysasteet Tricomin approksimaatiolla.
Suunnat tarkistettu varaston ECMWF 0,25°:ta vasten: oikein päin ka
0,8–1,8 m/s (alueen keskiarvo vs 9 km:n piste), peilattuna leveydessä
6,1 ja pituudessa 3,2–6,2 m/s.

**Kaksi mitattua ansaa:**
- *Muuttujien järjestys vaihtelee tiedostosta toiseen* (saman ajon
  seitsemässä tiedostossa u oli lapsi 20, 24, 25, 27, 28 tai 30), joten
  indeksiä ei voi muistaa. Nimien haku peräkkäin maksoi 4 s, rinnakkain
  yhden kierroksen.
- *ECMWF on tunneittain vain 90 h asti*, sitten 3 h ja 144 h:sta 6 h
  (06Z/18Z-ajo 109 hetkeä, 00Z/12Z 145). Tasatuntia ei aina ole
  tiedostona (mitattu: Kanariansaaret +200 h "File not found"), joten
  palvelin interpoloi kahden hetken välistä nopeuden ja suunnan
  erikseen, kuten varasto.

**Mitattu kontissa** (paikallinen `vite preview` + api, Chromium):

| | kesto | palvelin | koko |
|---|---|---|---|
| kenttä Tarifa z9 (3 321 solmua) | 1,2 s | 1,2 s | 13,5 kB |
| kenttä Helsinki z8 +80 h (9 016 solmua) | 1,9 s | 1,5 s | 36,3 kB |
| kenttä Kanariansaaret z9 | 1,2–3,4 s | | 16,8 kB |
| sarja (397 tuntia) | 1,3–1,4 s | 1,0–1,3 s | 5,5 kB |
| kylmä instanssi (ensimmäinen kutsu) | 2,0 s | | |

Tarifan z9-näkymässä 9 km näyttää levanten purkautuvan salmesta länteen
kielenä, jota 0,5°:n varasto ei erota; tähtäimen lukema samassa
kohdassa 14,2 kts (varasto) ja 17,3 kts (9 km).

**Mitattu tuotannossa** (24.9., `wind-delta.vercel.app`, funktio
`iad1` eli itärannikko, S3-säilö `us-west-2`; jokainen rivi on
välimuistiton `MISS`):

| | kesto | palvelimen luku | koko |
|---|---|---|---|
| kenttä 5° × 3°, sama tunti, 7 aluetta | 1,0–1,1 s (ensimmäinen 2,3 s) | 0,9 s | 6,6 kB |
| kenttä 5° × 3°, +30 / +100 / +200 / −20 h | 1,5–2,2 s | 1,3–2,0 s | 6,6 kB |
| kenttä 24° × 12° (työpöytä z8) | 1,8 s | | 117 kB |
| sarja (409 tuntia), 5 pistettä | 1,8–2,0 s | 1,6–1,9 s | 5,6 kB |
| CDN-osuma | 0,2 s | | |
| selaimessa: Tarifa z9 / Kanaria z9 / Helsinki z8 +80 h | 2,3 / 2,9 / 2,5 s | 2,1 / 2,0 / 2,1 s | 13,5 / 16,8 / 36,3 kB |

Ennen `17efe16`:aa yksi seitsemästä kutsusta jäi odottamaan S3:a koko
funktion 30 sekunnin katon. Nyt S3-luvulla on 6 s aikaraja ja kaksi
uusintaa (`OmHttpBackend`in `timeoutMs`/`retries`, meta-hauilla
`AbortSignal.timeout`) ja sovelluksella 12 s oma raja; ohitettu
(uudempi haku korvasi) ei ole virhe. 16 välimuistitonta kutsua peräkkäin:
ei yhtään jumia eikä virhettä.

**Avoinna:** tuntuma laitteella. Tuotanto on samaa luokkaa kuin kontti
(kenttä 1,0–2,2 s vs 1,2–1,9 s), ja kesto on lähes kokonaan palvelimen
lukua eli peräkkäisiä S3-matkoja (ajon meta, muuttujien haku, data).
Funktion siirto säilön viereen (`pdx1`) lyhentäisi jokaista matkaa,
mutta se koskisi myös FMI-proxyjä, joten se tehdään vasta jos laitteella
tuntuu hitaalta.

### V6 — Pakotettu malli perheinä ja mallin omana hilana (toteutettu)

Pyyntö: *"En huomannut isoa eroa ratkaisuissa. Laitetaan 9km
tuotantoon. Lisäksi tehdään asetus valikosta niin että aina on paras
saatavilla valikosta valittuna. Lisäksi tehdään valinta että voidaan
pakottaa myös yr.no data. Ongelma nyt on jos valitsen esim Icon mallin
niin se ei selvästi ole toteutettu windy tyyliin."*

**Mikä oli vialla.** Pakotettu malli käänsi kartan rajapintapolulle
(`Saalaatat.pois()`): Open-Meteon pisteet 600 pisteen katolla,
näkymätekstuuri ja uusi haku jokaisella panoroinnilla. Pakotettu ICON oli
siis karkea läiskä IDW:llä, ei ICONin hila, ja se piirrettiin eri
koneistolla kuin automaattinen.

**Nyt jokainen tila on sama varasto eri perheillä** (`Saalaatat.TILAT`,
`asetaTila`), ja kartta, kapseli, partikkelit, aikajana ja lähdemerkintä
lukevat saman `naytteista`n:

| tila (siru) | perheet tärkein ensin |
|---|---|
| `auto` Paras saatavilla | FMI > MET Nordic > ECMWF 9 km > ECMWF |
| `fmi` FMI HARMONIE | FMI > ECMWF 9 km > ECMWF |
| `metnordic` Yr (MET Nordic) | MET Nordic > ECMWF 9 km > ECMWF |
| `ecmwf` ECMWF | ECMWF 9 km > ECMWF |
| `icon` ICON | ICON-EU 7 km / ICON 13 km > ECMWF |
| `gfs` GFS | GFS 13 km > ECMWF |

Varaston ECMWF on aina alimpana, koska sen on katettava kaikki: mallin
alueen ja jakson ulkopuolella sekä sen hetken kun mallin oma hila on
matkalla. Lähdemerkintä kertoo silloin ECMWF:n. **Mallivalintaa ei
tallenneta** (`Asetukset.TALLENTAMATTOMAT`): sovellus käynnistyy aina
"Paras saatavilla" -tilassa, ja vanha tallennettu arvo (`auto9`,
`icon_eu` …) ohitetaan.

**Palvelin (`api/malli.js?malli=`)** lukee kolme mallia Open-Meteon
S3:sta samalla koneistolla (hila = naapurit + ikkuna + aikasarjalohkot):

| malli | lähde | hila | jakso |
|---|---|---|---|
| `ecmwf` | `ecmwf_ifs` | O1280 (redusoitu Gauss) | 15 vrk, tunneittain 90 h |
| `icon` | `dwd_icon_eu` + `dwd_icon` | 0,0625° lat 29,5–70,5 lng −23,5…62,5; 0,125° globaali | EU 5 vrk, globaali 7,5 vrk; tunneittain 78 h |
| `gfs` | `ncep_gfs013` (tuuli) + `ncep_gfs025` (puuska) | Gaussin N768 × 3 072; 0,25° | 16 vrk; tunneittain 120 h |

ICON-EU sekoitetaan globaaliin palvelimella 50 km:n reunalla ja jakson
lopussa kuuden tunnin matkalla — sama smoothstep kuin varastossa. GFS:n
10 m tuuli on vain `gfs013`:ssa ja puuska vain `gfs025`:ssä, joten
puuska luetaan eri hilasta. `gfs013`:n rivit ovat etelästä pohjoiseen
(ensimmäinen −89,912°): mitattuna korrelaatio GFS 0,25°:n 100 m tuuleen
oikein päin 0,80, peilattuna 0,07.

**Tuntipaketti.** ICON ja GFS ovat eri malli kuin alla oleva varasto,
joten yhden tunnin kenttä tekisi jokaisesta raahauksesta ja toistosta
mallinvaihdon. Kenttä haetaan siksi valitun tunnin ympäriltä (±3 h,
harvemmin jos solmuja on yli 3 000, vähintään ±1 h) ja se on laatta
omalla aika-akselillaan: `_naytePerhe` interpoloi tuntien välissä
nopeuden ja suunnan erikseen kuten varastossa. Toistossa paketti alkaa
hetkeä edeltävästä tunnista ja jatkuu eteenpäin, ja seuraava haetaan
puolitoista tuntia ennen reunaa. ICON ja GFS haetaan jokaisella
zoomilla (ECMWF 9 km vain zoomista 8, koska alla on sama malli).

**Kolme mitattua ansaa:**
- *Muuttujien otsakkeet yksi kerrallaan.* Lukija hakee jokaisen lapsen
  otsakkeen omalla pyynnöllään, ja ICON-tiedostossa lapsia on 126–128
  (painepinnat). 7 tunnin ICON-paketti vei kontissa **12,4 s**.
  Otsakkeet ovat tiedoston lopussa yhtenä alueena (ICON-EU 161 kB, ICON
  680 kB, ECMWF 302 kB, GFS 188 kB), joten alue haetaan kerralla ja
  lapset luetaan muistista (`Esiluku`): 3 pyyntöä ja 0,4–0,7 s
  tiedostoa kohti, paketti **1,45 s**. Järjestys vaihtelee yhä
  tiedostosta toiseen (ICON:n u oli lapsi 3–8), joten nimet on luettava.
- *Jakson loppu tuoreimmasta ajosta.* Ensimmäinen versio luki ICON-EU:n
  lopun aikasarjavaraston `data_end_time`sta, joka kertoo TUOREIMMAN
  ajon lopun — ja ICON-EU:n välimallit (03Z, 09Z, 15Z, 21Z) ulottuvat
  vain 30 tuntiin. Lyhyen ajon jälkeen ICON-EU häipyi globaaliin jo
  +24 h:n kohdalla: mitattuna Helsingissä kenttä 6,8 m/s, ajo itse ja
  aikajana 7,58. Loppu on nyt 12 tunnin sisällä olevien ajojen pisin
  (`mallinLoppu`), sama sääntö kuin varaston akselilla; jälkeen kenttä
  ja sarja 0,01–0,1 m/s.
- *Aikajanan sarja pyöristetystä pisteestä.* V5:n sarja oli kartan
  keskipiste 0,05°:een pyöristettynä, ja Helsingin keskustassa se antoi
  0,7–0,9 m/s eri luvun kuin kartta: rannikolla kahden kilometrin siirto
  on jo eri tuuli. Sarja haetaan nyt kentän solmuruudun neljälle
  kulmalle (`askel`, `solmut`), ja `_dynNayte` interpoloi niiden välissä
  samalla säännöllä kuin kartta laatasta. Uusi haku vain kun keskipiste
  siirtyy toiseen ruutuun.

**Mitattu kontissa** (palvelinfunktio suoraan, sitten selaimessa):

| | kesto | koko |
|---|---|---|
| ICON Helsinki 4° × 2,5°, 7 h, 0,05° (ennen otsakekorjausta) | 12,4 s | 116 kB |
| sama korjauksen jälkeen | 1,45 s | 116 kB |
| ICON +100 h, 7 h (kolmen tunnin askel, 8 tiedostoa) | 1,19 s | 116 kB |
| ICON Eurooppa z6, 3 h, 0,5° | 1,53 s | 74 kB |
| GFS Tarifa, 7 h | 1,37 s | 25 kB |
| sarja 415 h (ECMWF / ICON / GFS) | 0,7 / 0,7 / 0,5 s | |
| selaimessa ICON Helsinki z9, 7 h | 1,9 s | 71 kB |
| selaimessa GFS Helsinki z9, 7 h | 1,6 s | 71 kB |

Selaimessa (Chromium, työpöytä ja puhelin `hasTouch`):
- Jokainen tila antaa oikean lähdemerkinnän Helsingissä: FMI, FMI,
  MET Nordic, ECMWF IFS 9 km, DWD ICON-EU 7 km, NOAA GFS 13 km; Tarifa
  ICON-EU, Kanariansaaret (EU-alueen ulkopuolella) ICON 13 km.
- Paketin sisällä tuntien välissä (−2,5 … +2,5 h) malli on ICON-EU 100 %,
  paketin ulkopuolella (±3,5 h) varasto — kuten pitääkin.
- Toisto 12 s: 24/24 näytettä ICON-EU:ta, yksi ennakkohaku.
- Aikajana vs kartta paketin tunneilla: ICON 0,08 m/s, GFS 0,09, ECMWF
  9 km 0,02; automaattinen, FMI ja MET Nordic 0,000.
- Siru napautettuna (puhelin): `aria-checked` seuraa, vihje kertoo mallin
  ja viimeisen haun keston.
- Uudelleenlataus ICON-tilasta: "Paras saatavilla".
- Maailmankierros automaattisessa (Helsinki → Tokio → Sydney → New York
  → Tarifa → Helsinki): valittu hetki pysyy, Helsinki on FMI, 9 km
  latautuu Pohjoismaiden ulkopuolella, 394 tikkiä.

**Mitattu tuotannossa** (25.9., `56587cd`, funktio `iad1`, välimuistiton):
7 tunnin paketti 4° × 2,5° ICON 1,5–1,9 s (kylmä instanssi 3,2 s) ja GFS
1,4–2,3 s, 30 kB; sarja neljälle solmulle 415 h ICON 1,3 s, GFS 1,1 s,
ECMWF 1,0 s, 23–24 kB. Selaintesti samoin kuin kontissa: jokainen tila
oikea merkintä, toisto 24/24 ICON-EU:ta, uudelleenlataus "Paras
saatavilla", ei virheitä; selaimen kokonaisaika 1,1–3,2 s.

**Tiedossa oleva ero, ei vika.** Aikajana näyttää pakotetun mallin koko
jaksolta (sarja), mutta kartta vain haetun paketin tunneilta; muilla
tunneilla kartta on varaston ECMWF:ää kunnes hetki valitaan ja paketti
tulee (1–3 s). Sama koskee automaattista FMI:n ja MET Nordicin jakson
jälkeen: aikajana on 9 km:n sarjaa, kartta 9 km:ä vain valitulla
tunnilla. Mitattuna ero ennen valintaa enimmillään 1,5 m/s (MET Nordic
+60…72 h) ja 3,3 m/s (ICON +24 h ennen pakettia) — se on ECMWF:n ja
toisen mallin ero, ja lähdemerkintä kertoo kummasta on kyse.
Tarkistettu uudelleen (automaattinen, Helsinki z10): valitsemattomina
tunteina +58…+95 h ero oli jopa 2,5 m/s, mutta kun sama tunti VALITAAN,
kartta hakee 9 km:n kentän ja ero on 0,01–0,05 m/s (+59, +70, +79,
+91 h). Mittari joka ohittaa valitsemattomat tunnit vain ICONille ja
GFS:lle (`T._dyn.api !== 'ecmwf'`) raportoi tämän virheenä — se on
mittarin ansa, ei sovelluksen.

### Kaukaa datan omalla tarkkuudella (5.10.)

**Pyyntö (käyttäjä):** "Varmistetaan, että uudet lisätyt kartat ja niiden
data on ajettu näkymään ja laattoihin mahdollisimman tarkasti myös ylös
zoomatussa kartassa Windyn tyyliin."

**Mitä oli.** Alueelliset mallit OLIVAT kaukanakin kartalla: niiden
karkein taso on 0,5° (`<id>3`), ja `_perheenTaso` valitsee sen
askeleilla 1,0–1,25 (taso hylätään vasta kun se on yli neljä kertaa
askelta hienompi). Mutta lämpökartan ja partikkelien **solmuväli** oli
alle z7:n `gridStep` eli 1,0° (z5–6) ja 1,25° (z ≤ 4), joten varaston jo
lähettämästä 0,5°:n datasta otettiin vain joka toinen solmu (z ≤ 4
joka toinen tai kolmas). Solmu oli z5:llä 23 px ja z6:lla 45 px.

**Muutos (`ViewportGrid.kaukoSolmu`, `solmuStep`).** Solmut datan omalla
tarkkuudella: z5–6 0,5° (11–23 px), z4 1,0°. **Taso ei muutu**
(`laattaStep` ennallaan), joten laattoja ja tavuja on tasan yhtä paljon
kuin ennen; ECMWF luetaan yhä 1°:n tasolta (l2) bilineaarisesti 0,5°:n
solmuihin. Toiston ja raahauksen aikana solmut ovat entiset (hila
kootaan jokaiselle hetkelle, ks. hinta), ja levossa tiheät.

**Mitattu** (tuotantobuild, vanha ja uusi rinnakkain vuorotellen;
tarkkuus = kentän arvo 5 × 5 pisteessä vs hienoin varastodata samassa
pisteessä ja hetkessä, `naytteista` askeleella 0,05):

| näkymä | RMS ennen → jälkeen (puhelin) | RMS (työpöytä 1 440 × 900) | max (puhelin) |
|---|---|---|---|
| Eurooppa z4 | 0,80 → 0,64 m/s | 1,18 → 0,88 | 2,91 → 1,51 |
| Eurooppa z5 | 1,12 → 0,59 | 0,69 → 0,63 | 2,49 → 1,48 |
| Ranska z5,5 | 1,20 → 0,61 | 1,01 → 0,74 | 3,86 → 1,40 |
| Itämeri z6 | 1,32 → 0,69 | 1,02 → 0,80 | 3,79 → 1,75 |
| Alpit z6 | 0,71 → 0,53 | 1,04 → 0,72 | 1,81 → 1,58 |

| näkymä | solmuja ennen → jälkeen | kokoaminen (lämpökartta) |
|---|---|---|
| puhelin Eurooppa z5 | 1 452 → 5 063 | 1,5 → 3,7–4,5 ms |
| puhelin Itämeri z6 | 675 → 2 064 | 0,8 → 1,9–2,1 ms |
| työpöytä Eurooppa z5 | 5 029 → 18 392 | 6,8 → 18,2 ms (kenttä 4,2 → 30,7) |
| työpöytä Alpit z6 | 2 700 → 9 570 | 2,9 → 8,2 ms |

Siksi toisto ja raahaus pitävät entiset solmut: hila kootaan jokaiselle
hetkelle, ja työpöydän 18–31 ms jokaisella askeleella olisi näkyvää.

**Kokeiltu ja hylätty: 0,5°:n ECMWF-taso (l1) z5–6:lla** (`laattaStep`
0,5). Tarkkuus oli mittauspisteissä SAMA kuin pelkällä solmujen
tihennyksellä (Eurooppa z5 0,59 / 0,59, Itämeri 0,68 / 0,69, Alpit 0,53 /
0,53) — hyöty tuli alueellisten mallien 0,5°:n tason lukemisesta omalla
tarkkuudellaan — mutta näkymä maksoi enemmän laattoja (puhelin Eurooppa
z5 3,4 → 5,8 MB, Ranska z5,5 2,6 → 5,6 MB, työpöytä Suomi z5,5 4,1 →
7,0 MB; l1:n laatta on 21 × 21 solmua × ~100 hetkeä, 70–90 kB).

**Samalla löytyi tavuvuoto: aikajanan esikatselu haki laatat 3,4-kertaiselle
alueelle.** `WindTexture.build` käytti karkealla askeleella eleen
pehmustetta (`PEHMUSTE_ELE` 1,2 näkymää joka laidalla) myös aikajanan
raahauksessa ja toistossa, vaikka kartta on silloin paikallaan, ja haki
puuttuvat laatat koko alueelle. Työpöydän Eurooppa-näkymässä yksi
esikatselu haki 90 kpl 1°:n laattoja (~8 MB) lähes koko pallon
leveydeltä; sama tapahtui satunnaisesti käynnistyksessä (aikajanan
vieritys luettiin raahaukseksi 1/3 ajoista, myös vanhassa versiossa).
Nyt laaja pehmuste on vain kartan eleessä (`State.liikkeessa`) tai kun
varasto ei ole kartan käytössä. Mitattuna työpöydän Eurooppa-näkymä
(z4,4) puhtaalta pöydältä: vanha versio, jossa käynnistyksen esikatselu
osui, 255 laattaa ja 16,2 MB; korjattu 132 laattaa ja 6,9 MB.

**Korvattu 6.10.** `kaukoSolmu` poistui, kun taso itse seuraa
näyttötarkkuutta (seuraava osio): solmut ovat taas tason solmut, ja
taso on kaukanakin tiheämpi kuin tämän osion solmut.

### Näyttötarkkuuden taso (6.–9.10.)

**Raportti (käyttäjä, kaksi iPhone-kuvaa samasta paikasta ja tunnista,
ma 5.10. klo 21):** "Ainut niiden ero on, että toinen on zoomattu hieman
ylemmäksi, ihan marginaalisesti, mutta huomaat kuvasta, että selvästi
lämpökartta muuttuu ja päivittyy. ... mahdollisimman tarkka data, mikä on
lähizoomissa, näkyy myös kaukozoomissa. Tarkasti, jotta partikkelit
menevät oikeaan reittiä ja oikealla nopeudella ja värillä." Kuvissa
Suomenlahden oranssi tuulivyö oli toisessa vihreä.

**Syy.** Varaston taso valittiin pyöristetystä zoomista
(`laattaStep(round(zoom))`), ja karkea taso on hienon
laatikkokeskiarvo (`tools/pyramidi.mjs`). Tasot z6–9 (1,0 / 0,5 / 0,25 /
0,1°) olivat ruudulla 26–64 px:n laatikoita pituussuunnassa (60°N:ssa
leveyssuunnassa kaksinkertaiset), eli paljon lämpökartan omaa sumennusta
(σ 3 px) leveämpiä. Noin 40 km leveä kova vyö latistui laatikkoon, ja kun
zoom ylitti n,5:n, taso vaihtui kerralla toiseen keskiarvoon. Partikkelit
lukivat saman kentän, joten niiden nopeus, reitti ja väri hyppäsivät yhtä
paljon.

**Mittausasetelma.** Tuotantobuild ennen ja jälkeen rinnakkain
(`vite preview`), oikea varasto Noden kautta, pohjakartta reititetty,
puhelin (390 × 844, `hasTouch`, dpr 3) ja työpöytä (1 440 × 900). Samat
maantieteelliset pisteet Suomenlahdella (keskipiste 59,8 N 24,45 E),
sama hetki (varasto 6.10. 04 UTC, hetki 6.10. 20 UTC — seuraavien 45
tunnin hetkistä se jolla kentässä oli eniten vaihtelua). Totuus on
NÄYTÖN IHANNE: varaston hienoin taso 0,05° sumennettuna samalla σ =
3 CSS px kuin lämpökartta, eli tarkin kenttä jonka ruutu voi näyttää.
Lämpökartta = `LampoGL`:n solmuhila Catmull-Romilla kuten varjostin,
samalla sumennuksella; partikkelit = `WindTexture.hila` sellaisenaan.
Hyppy = sama mittaus zoomeilla n,45 ja n,55 (rajan yli), kontrollina
n,35 → n,45 (rajan sisällä), ja pikseliero kuvakaappauksista lämpökartta
yksin (pohjakartta ja merkit piilossa).

**Tarkkuus näytön ihanteeseen** (puhelin, lämpökartta RMS / harha m/s):

| zoom | ennen: taso | ennen | jälkeen: taso | jälkeen |
|---|---|---|---|---|
| 4,45 | 1,25° | 3,96 / −2,45 | 0,5° | 1,69 / −1,05 |
| 5,45 | 1,0° (solmu 0,5) | 1,96 / −1,15 | 0,5° | 1,96 / −1,15 |
| 6,45 | 1,0° (solmu 0,5) | 2,08 / −1,18 | 0,25° | 0,84 / −0,18 |
| 7,45 | 0,5° | 2,13 / −1,20 | 0,1° | 0,41 / −0,04 |
| 8,45 | 0,25° | 0,96 / −0,19 | 0,05° | 0,06 / +0,01 |
| 9,45 | 0,1° | 0,55 / −0,05 | 0,05° | 0,06 / +0,01 (mitattu z 8,55:llä, sama taso) |

z5 on ennallaan: alueellisten mallien karkein taso on 0,5° ja se luettiin
jo ennen (ECMWF 1,0° molemmissa).

**Hyppy rajan yli** (sama paikka ja hetki, zoom n,45 → n,55; lämpökartta
RMS / max m/s, pikseleistä yli 12 tason ero):

| raja | ennen | jälkeen |
|---|---|---|
| 4,45 → 4,55 | 2,64 / 6,61 · 10,2 % | 0,025 / 0,06 · 0,3 % |
| 5,45 → 5,55 | 0,007 / 0,02 · 0,1 % | 0,047 / 0,08 · 0,1 % |
| 6,45 → 6,55 | 0,002 / 0,01 · 0 % | 0,021 / 0,06 · 0 % |
| 7,45 → 7,55 | **1,59 / 2,76 · 27,9 %** | 0,015 / 0,06 · 0 % |
| 8,45 → 8,55 | 0,71 / 2,17 · 14,4 % | 0,004 / 0,02 · 0 % |
| 9,45 → 9,55 | 0,59 / 2,17 · 7,5 % | (sama taso, ei rajaa) |

Kontrolli rajan sisällä molemmissa 0,001–0,03 m/s. Partikkelit: 7,45 →
7,55 1,60 → 0,016, 4,45 → 4,55 2,82 → 0, 8,45 → 8,55 0,72 → 0.
Työpöytä: 7,45 → 7,55 1,59 → 0,015, 8,45 → 8,55 0,73 → 0,003.
Uusintamittaus 9.10. lopullisella buildilla eri hetkellä (varasto 9.10.
11 UTC, hetki 11.10. 04 UTC, vaihtelevampi kenttä): rajan yli puhelin ja
työpöytä 0,005–0,050 m/s, partikkelit 0–0,14.

**Ratkaisu.**

1. **Taso näyttötarkkuuden mukaan** (`ViewportGrid.laattaStep`): z ≤ 3
   1,0°, z4–5 0,5°, z6 0,25°, z7 0,1°, z8:sta 0,05° (9.10. yhtä tiheämpi
   puhelimilla, ks. "Kaukaa kuin läheltä"). Kokonaislukuzoomilla
   solmuväli on 6–11 px pituussuunnassa. Taso on yhä laatikkokeskiarvo,
   mutta laatikko on lämpökartan oman sumennuksen kokoluokkaa, joten
   karkeampi taso on sama kenttä pehmeämpänä eikä eri kenttä.
2. **Tasojen sekoitus kuten mipmap** (`karkeaPaino`): pyöristetyn zoomin
   tz kenttä on L(tz):n ja L(tz − 1):n sekoitus. Karkean paino on 1 heti
   rajan yli (z = tz − 0,5) ja 0 kokonaisluvulla ja siitä ylöspäin
   (smoothstep), joten rajan kummallakin puolella ruudulla on sama
   L(tz − 1), ja kenttä muuttuu zoomin mukana jatkuvasti. Paino on 0 kun
   tasot ovat samat (z5, z ≥ 9) — natiivihila ei häivy zoomin mukana.
3. **Lämpökartalla kaksi hilaa** (`LampoGL._hila`, `_karkea`): varjostin
   lukee molemmat ja sekoittaa nopeuden (`u_kw`); karkea on myös oman
   hilan tausta pehmusteessa. Zoomatessa sisään rajan yli uusi karkea on
   vanha oma ja ulos uusi oma on vanha karkea — molemmat otetaan talteen
   ennen vaihtoa, joten rajalla ei koota mitään uudelleen.
4. **Partikkelit samasta sekoituksesta** (`WindTexture.build`): karkea
   hila samoihin globaalisti kohdistettuihin solmuihin kuin lämpökartan
   karkea, siitä Catmull-Rom partikkelikentän solmuihin (bilineaarinen
   näyte erosi rajalla 0,13–0,33 m/s) ja vektorien sekoitus samalla
   painolla.
5. **Laatat kahtena kerroksena** (`LampoGL.varmistaAlue`): oma taso vain
   näkymälle, karkea näkymälle ja 0,25:n reunukselle. Pehmusteen loppu
   luetaan muistissa olevista tasoista (`_haePerhe`: saman perheen
   karkeampi, sitten hienompi; varalaatta on muistissa `m.vara`, jottei
   jokainen pehmusteen solmu maksa tason valintaa ja avainta), ja laatan
   saapuminen kokoaa osuneet hilat uudelleen (`Saalaatat._kunUusia`,
   enintään neljästi sekunnissa). Koko pehmuste näkymän tasolla oli
   työpöydällä 5,6–8,7 Mt z6–8.
6. **Oman hilan pehmuste 0,25** (`_pehmusteOma`) kun karkea on sen
   taustana: 0,6:lla työpöydän oma hila oli 75 000 solmua ja 90–130 ms
   joka tunnin askeleella.
7. **Kokoaminen nopeammaksi**: perheen alue (`_bb`) ohittaa perheen
   neljällä vertailulla (Euroopassa pisteessä on tavallisesti 2–4
   perhettä neljästätoista), ja suunnan sin/cos tulee taulukosta (suunta
   on kvantisoitu 2°:een, tulos bitilleen sama). Solmulta 1,51 → 0,81 →
   0,65 µs; ennen koko muutosta 0,72.
8. **Toisto ja raahaus**: kenttä kokonaan karkea (`tasoStep`,
   `solmuStep` = `laattaStep(zoom − 1)`), solmuja enintään
   `TOISTO_SOLMUT` 9 000, koska hila kootaan jokaiselle hetkelle; levossa
   oma hila palaa 0,3 s:n häivytyksellä (`TASO_HAIVYTYS_MS`). Kartan eleen
   aikana oma hila odottaa lepoa kun karkea kattaa näkymän (työpöydällä
   oma hila on 30–50 ms).
9. **ECMWF:n 0,5°:n taso (l1) ohitetaan** (9.10. lähtien taas käytössä,
   ks. "Kaukaa kuin läheltä") 0,5°:n pyynnöllä
   (`_perheenTaso`). Näyttötarkkuudella mitattuna l1 oli l0:sta RMS
   0,09–0,39 ja l2 0,16–0,74 m/s (max 4,3), mutta z4–5-näkymässä l1 olisi
   ollut 2,0 Mt 2,1:stä. l0 zoomista 6, l2 z ≤ 5.
10. **Mallin oma hila** (`MalliHila`, ICON ja GFS): askel on
    näyttötarkkuuden taso, mutta ei mallin omaa hilaa tiheämpi
    (`OMA_ASKEL` ICON 0,0625°, GFS 0,1°); paketin pituus solmumäärästä
    (`pakettiPuoli`, puhelin ±3 h, työpöytä ±1 h).
11. **Kapselin aalto** tuulikerroksella hienoimmalta kattavalta tasolta
    zoomista riippumatta (käyttäjän kuvissa "maks. ~3,9" ja "~4,0").
12. **Laattamuisti 160 → 240**: näkymä vaatii saman määrän laattoja joka
    zoomilla.

**Hinta.** Ensimmäinen näkymä puhtaalta pöydältä (laattojen Mt):

| zoom | puhelin ennen → jälkeen | työpöytä ennen → jälkeen |
|---|---|---|
| 6 | 2,1 → 2,7 | 3,9 → 6,4 |
| 7 | 1,5 → 2,2 | 2,8 → 5,7 |
| 7,5 | 1,1 → 2,9 | 4,2 → 7,7 |
| 8 | 1,1 → 2,0 | 2,6 → 4,8 |
| 9 | 1,1 → 1,3 | 1,4 → 2,0 |
| 10 | 1,0 → 0,9 | — |

Tunnin askel (kontti, lämpökartta + partikkelikenttä): puhelin 2–19 ms
(ennen 1–2), työpöytä 6–72 ms (ennen 3–8); pahin heti tason rajan
yläpuolella, jossa molemmat hilat ja partikkelikentän sekoitus kootaan.
Toisto ruutua kohti työpöydällä 4,9 ms (ennen 3,4), puhelimella 3,1 ms.
Laitteella mittaamatta.

**Kaksi vikaa panoroinnissa (9.10.).** Mittari: siirto näkymän verran
(itään, koilliseen, takaisin), asettumisen jälkeen ruudulla oleva hila
vs. samoihin solmuihin juuri koottu kenttä. Puhelin oli kunnossa,
työpöydällä yhden näkymän siirto itään jäi 40 s:ksi ruudulle hilaan jonka
näkyvistä solmuista 3 178 oli ilman omaa tasoaan (ero juuri koottuun
RMS 0,45, max 2,09 m/s). Syitä oli kaksi:

- *Odottava hila jäi odottamaan pysyvästi.* Siirron jälkeen koottu hila
  oli näkymälle vajaa, ja kun laatat tulivat, uusi parempi meni
  odottamaan (`_odottava`), koska vanha kattoi näkymän. Mikään ei
  pyytänyt uutta kokoamista, joten odotuksen raja ei koskaan lauennut.
  Nyt odotus vain kun vanha on uutta täydempi, ja rajalla odottava nousee
  ruudulle aina.
- *ECMWF:n l0-tason reunasarake 45°E oli ilman dataa.* Taso kattaa
  välin −35…45°E suljettuna, mutta alaspäin pyöristetty laatta 45–50°E
  ei ole olemassa, joten tasan 45°E:n solmut (hilan origo on kohdistettu,
  eli 45,0 on aina solmu) jäivät tyhjiksi — läpinäkyvä juova kaikilla
  zoomeilla joilla taso on l0, myös ennen tätä muutosta z8:sta. Nyt
  rajalla oleva piste lukee edellisen laatan reunarivin
  (`_rajaRuutu`).

Samalla laattojen saapumiskytkin rajattiin tuulen laattoihin jotka
osuvat vajaaseen hilaan: aaltolaatat (sama `_lataa`) ja spottien
esilataus 300 km:n päässä kokosivat muuten kentän turhaan uudelleen.
Mitattu jälkeen puhelimella ja työpöydällä z6,3 / 7,2 / 7,8 / 8,6,
kolme siirtoa kullakin: hila asettuu kontissa 2,0–7,8 s:ssa, ja sen
jälkeen ero juuri koottuun on 0,0006 m/s (16-bittinen kvantisointi) ja
näkyvissä 0 solmua ilman omaa tasoaan.

**Mitä jäi.**

- **Kaukana (z ≤ 5) kenttä on yhä varaston karkeimpien tasojen varassa**
  (alueelliset 0,5°, ECMWF 1,0°): näytön ihanteesta 1,7–2,7 m/s RMS
  hetken mukaan. Tarkempi kaukaa maksaisi tavuja. Laatat on sittemmin
  pilkottu ajassa (ks. "Laatat ajassa paloina"), ja säästö käytettiin
  tason tihentämiseen kaukana ("Kaukaa kuin läheltä").
- Tavuja on 1,2–2-kertaisesti (taulukko yllä).
- Tunnin askel työpöydällä tason rajan yläpuolella jopa ~70 ms
  kontissa; laitteella mittaamatta.

### Laatat ajassa paloina (9.10.)

**Syy.** Varaston laatta kantoi koko akselin (ECMWF 70–104 hetkeä,
alueelliset omansa), vaikka kartalla on kerrallaan yksi hetki. Näkymän
tavuista valtaosa oli siis tunteja joita kukaan ei katsonut.

**Rakenne.**

- Rakentaja (`tools/tiilet.mjs`, `kirjoitaTaso`) kirjoittaa jokaisen
  tuulitason laatan `PALA` = 24 askeleen paloina:
  `<taso>/<la>_<lo>.p<c>.bin.gz`. Pala c kattaa askeleet
  c·24 … min(c·24 + 24, nt − 1), eli **paloilla on yhden askeleen
  päällekkäisyys**. Siksi kahden hetken interpolointi ei koskaan tarvitse
  kahta palaa. Palojen määrä on max(1, ceil((nt − 1)/24)).
- Jokainen pala on tavallinen laatta: sama otsake, `nt` on palan
  askeleet ja `t0` sen ensimmäinen hetki. `kirjoitaLaatta` saa
  aikasiirtymän (`i0`).
- Luettelon riveillä on `pala: 24` ja luettelon `versio` on 2.
  `PALAT=0` rakentaa vanhan muodon (versio 1).
- Aallot (`tools/wam.mjs`) ovat yhä kokonaisia laattoja.
- Asiakas kokoaa palat yhdeksi koko akselin laattaolioksi
  (`Saalaatat._lataa`). Olio luodaan ensimmäisestä saapuneesta palasta
  tyhjällä (255) täytettynä, ja `palat`-liput kertovat mitkä palat ovat
  muistissa. Kaikki lukijat (`naytteista`, `kokoaHila`,
  `wxTunneittain`) näkevät siis saman muodon kuin ennen.
- Kartta (`varmista`) hakee vain valitun hetken palan
  (`_palaIndeksi`). Toistossa tai raahauksessa haetaan myös seuraava
  pala, kun palan loppuun on alle kuusi askelta.
- Aikajana ja kortit (`varmistaPiste`) hakevat pisteensä kaikki palat,
  koska ne lukevat koko akselin.
- Valmiiksi lasketaan laatta jonka hetken pala on muistissa
  (`_palaValmis`): `_haePerhe`n valmis-ehto ja muistin varatie
  (`_varaMuistiin`) vaativat sen.
- `_pyydaData`n avaimessa on 6 tunnin lokero, jotta uuden hetken
  puuttuvat palat pyydetään.
- `tools/varmennus.mjs` kokoaa palat samalla tavalla.

**Mitattu.** Sama build ja sama data (tuotannon kokonaiset laatat
pilkottuina reitityksessä rakentajan omalla `kirjoitaLaatta`lla).
Ensimmäinen näkymä, kokonaiset → palat:

```
laite      z     kokonaiset          palat
puhelin    5     3 122 kB / 56       1 970 kB / 129
puhelin    6,3   1 952 kB / 33       1 171 kB / 70
puhelin    7,3   1 955 kB            1 176 kB
puhelin    8,3   1 697–1 778 kB      914 kB / 51
puhelin    10      930–1 118 kB      606–810 kB
työpöytä   6,3   4 001 kB / 68       2 312 kB / 141
työpöytä   7,3   5 371 kB / 88       2 697 kB / 154
työpöytä   8,3   3 186 kB / 55       1 611 kB / 88
```

- Tavut putosivat 28–55 %, ja pyyntöjä on noin kaksinkertaisesti.
- Jäljelle jäävästä valtaosa on keskipisteen laattoja, joista aikajana
  tarvitsee koko akselin. Puhelimella z7,3 se on noin 430 kB 1 176:sta.
- Työpöydän z5 ei asettunut kummallakaan ajolla, joten sitä ei verrattu.
- Hyppy +3 vrk maksaa 2–18 uutta palaa (43–491 kB). Kokonaisilla
  laatoilla hyppy maksoi 116–1 473 kB, koska näkymää oli ennen hyppyä
  ehditty laajentaa.
- Asettumisaika näytti paloilla pidemmältä, mutta se on mittarin oma
  hinta: reititys pakkaa palat gzip 9:llä lennossa.

**Oikeellisuus.** Kokonaiset ja palat on verrattu tiivisteillä nyt ja
+3 vrk:n hypyn jälkeen. Molemmilla laitteilla ja zoomeilla 5–10 seuraavat
ovat identtisiä:

- lämpökartan oma hila
- partikkelikenttä
- aikajanan 400 tuntia

Karkea hila on identtinen näkymässä, ja juuri koottua vasten ero on
näkymässä 0 molemmissa muodoissa.

Eroja jäi vain pehmusteeseen, ja ne ovat suunniteltuja. Pehmusteen
loppu luetaan muistin varalta, ja varalaatasta voi puuttua tämän hetken
pala (puhelin z10, +3 vrk: 12 näkymän ulkopuolista solmua). Solmut
tarkentuvat kun ne tulevat näkyviin.

**Vähennetty rakennusajo** (`MAX_ASKELTA=30`, `HARMONIE_H=30`, ilman
MET Nordicia, Eurooppaa ja aaltoja): palarajat 265/265 tavulleen samat,
palojen `nt`:n summa täsmää ja `t0` osuu akselille.

**Kaksi vikaa löytyi matkalla, ja ne korjattiin.**

- *Partikkelikenttä jäi tyhjäksi hypyn jälkeen.* Kun kentästä puuttui
  liikaa, `WindTexture.build` hylkäsi sen, eikä laattojen saapuminen
  rakentanut sitä uudelleen (työpöytä z6,3 +3 vrk: partikkelit 0).
  Kokonaisilla laatoilla dataa oli aina valmiina, joten vika ei näkynyt.
  Nyt hylkäys merkitään (`WindTexture._hilaHylatty`), ja `_kunUusia`
  rakentaa kentän levossa uudelleen.
- *Karkea hila jäi vanhaksi kun `MalliHila` tai natiivihila saapui.*
  Nämä kentät eivät kulje `_kunUusia`n kautta. Työpöydällä 1 452
  näkyvää solmua erosi juuri kootusta. Vika oli vanha eikä paloista
  johtuva. Nyt `LampoGL.paivita()` merkitsee myös karkean likaiseksi
  (`_karkeaLikainen`), ja se kootaan levossa uudelleen.

**Siirtymä.** Vanha asiakas hylkää luettelon version 2 ja putoaa
rajapintapolulle (`Saalaatat.pois()`), kunnes sivu ladataan uudelleen.
Service worker hakee uuden buildin, ja `Paluu` lataa sivun uudelleen
30 minuutin taustan jälkeen. Siirtymä kestää siis yhden avauksen.

### Kaukaa kuin läheltä (9.10.)

**Pyyntö (käyttäjä):** "Tarkennetaan kaukaisella zoomilla kartta samaksi
kuin lähellä mahdollisimman hyvin."

**Mistä ero tuli — mitattu ennen kuin muutettiin.** Offline-laskuri
(perheen hienoin taso nopeutena, sumennettuna σ = 3 CSS px, vs tason
solmut Catmull-Romilla ja samalla sumennuksella; neljä aluetta:
Suomenlahti FMI, Norja MET Nordic, Ranska AROME, Biskaja ECMWF):

- **Suotimen muoto ei ratkaise.** Laatikko, Gauss σ = 0,25 / 0,35 /
  0,5 askelta ja pisteotanta antoivat 0,25°:n ja 0,5°:n tasolle saman
  virheen ±0,05 m/s:n sisällä; pisteotanta oli huonoin (laskostuma).
- **Solmuväli ratkaisee.** Virhe kasvaa tason solmuvälin mukana
  ruudulla: esim. FMI 0,25° z4 0,12 → z5 0,27 → z6 0,41 m/s; ECMWF l2
  (1°) z4 0,56, l1 (0,5°) 0,20. 6.10. taulukossa solmuväli oli z5–7
  9–11 px.
- **Kaukaisimmassa näkymässä alueellinen malli luettiin laskostuneena**:
  karkein taso oli 0,5°, ja 1,0°:n pyyntö luki sitä 1,0°:n solmuin eli
  joka toisen solmun (Suomenlahti z3,5 1,22 m/s).

**Muutos.**

1. **Tiheämpi taso** (`ViewportGrid.laattaStep`): z ≤ 3 1,0°, z4 0,5°,
   z5 0,25°, z6 0,1° ja z7:stä 0,05° — solmuväli kokonaisluvulla noin
   4,6–5,7 px (ennen 9–11 px zoomeilla 5–7).
2. **Solmubudjetti** (`SOLMUBUDJETTI` 24 000, `_nakymaSolmut`): tiheä
   taulukko vain kun näkymän solmuja on tason tiheimmässä kohdassa
   (zoom − 0,5) enintään budjetin verran, muuten 6.10. taulukko.
   Laskelma on näytön koosta (leveysaste 55°), ei paikasta, joten taso
   ei vaihdu panoroitaessa. Puhelimet (11 700–22 200) saavat tiheän,
   tabletit ja työpöytä (46 000–78 000) entisen: työpöydällä tiheä
   taulukko oli z4,5:llä 110 000 solmua ja tunnin vaihto 729 ms
   (kontti; ennen 28 700 ja 89 ms).
3. **ECMWF:n 0,5°:n taso (l1) käyttöön z4:llä.** Se ohitettiin 5.–9.10.,
   koska Suomenlahdella (alueellisten mallien alla) se ei muuttanut
   mitään. Avomerellä (Atlantti 41–49 N, 28–16 W, pelkkää ECMWF:ää)
   puhelimella z4 0,31 → 0,15 ja z4,45 0,36 → 0,17 m/s.
4. **Alueellisille malleille 1,0°:n taso** (`h4`, `n4`, `<id>4`;
   `tools/tiilet.mjs`, `tools/alueelliset.mjs` `TASOT_POHJA`). Offline
   z3: FMI 0,65 → 0,48, MET Nordic 0,42 → 0,29, AROME 0,27 → 0,23 m/s,
   ja kaukaisimman näkymän laattoja on neljännes entisestä. Laatta on
   20° leveä (FMI:llä neljä). Tarkistettu vähennetyllä rakennuksella:
   solmu 2,80 m/s vs 0,05°:n laatikkokeskiarvo 2,73 (kvantisointi 0,2).
   Vanha luettelo ilman sitä toimii: 1,0°:n pyyntö lukee silloin 0,5°:n.
5. **Sama hila kootaan kerran** (`Saalaatat.kokoaHila`, muisti
   `_kooste`, neljä viimeistä). Tunnin vaihdossa partikkelikenttä kokoaa
   oman ja karkean hilan, ja sen valmistuminen likaa lämpökartan, joka
   kokosi samat hilat samoihin solmuihin uudelleen. Avain kattaa
   pyynnön, hetken, kentän, jokaisen saapuneen tuulen laatan
   (`_saapuneet`), muistin koon ja perheiden tilan (pois, aikapaino,
   natiivikenttä, mallin oma laatta); keskeytetty kokoaminen ei jää
   muistiin. Tulos on bitilleen sama (tarkkuusmittauksen jokainen luku
   sama muistin kanssa ja ilman).

**Mitattu** (tuotantobuild, varasto jäädytettynä levylle, sama hetki
10.10. 02 UTC, lämpökartta RMS näytön ihanteeseen m/s):

| näkymä | z | ennen | jälkeen |
|---|---|---|---|
| puhelin Suomenlahti | 5 | 1,03 | 0,36 |
| | 5,45 | 1,12 | 0,44 |
| | 6 | 0,52 | 0,14 |
| | 6,45 | 0,58 | 0,18 |
| | 7 | 0,20 | 0,05 |
| | 7,45 | 0,24 | 0,06 |
| puhelin Ranska (AROME) | 5 / 6 / 7 | — | 0,15–0,20 / 0,07 / 0,04 |
| puhelin Atlantti (ECMWF) | 4 / 4,45 | 0,31 / 0,36 | 0,15 / 0,17 |
| työpöytä Suomenlahti | 4–8 | | sama kuin ennen (budjetti) |

Zoomeilla 3,5–4,5 Suomen edustalla virhe on yhä 0,7–1,2 m/s
(alueellinen 1,0°:n taso tuli varastoon Säädata-ajossa 9.10. klo 14:38
UTC; selaimessa tarkistettu, että z3,5:n karkea hila lukee `h4`/`n4`/
`<id>4`-laattoja ja näkyvissä ei puutu solmuja), ja z4:n 0,5°:n tasoa tiheämpi nelinkertaistaisi solmut.

**Hinta** (kontti, puhelin 390 × 844):

- **Tunnin vaihto** (lämpökartta + partikkelikenttä, mediaani viidestä):
  ennen 5–17 ms, tiheällä tasolla ilman muistia 21–108 ms, muistin
  kanssa 35–40 ms (z4,6 / 5,75 / 6,75: 67 → 40, 66 → 34, 54 → 37).
  Työpöytä on budjetin takia ennallaan (20–126 ms). Laitteella
  mittaamatta.
- **Ensimmäisen näkymän tavut** (Suomenlahti, puhelin, kB):

  | z | 4 | 4,5 | 5 | 5,5 | 6 | 6,5 | 7 | 7,5 | 8 |
  |---|---|---|---|---|---|---|---|---|---|
  | ennen | 2 808 | 2 201 | 1 662 | 2 543 | 1 750 | 1 989 | 1 264 | 1 636 | 1 199 |
  | jälkeen | 3 220 | 5 833 | 3 305 | 5 038 | 3 249 | 3 511 | 1 883 | 1 293 | 1 204 |

  Pahin kohta on n,5, jossa näkymän oma taso on tiheimmillään mutta
  karkean paino on 1; zoomin keskellä hinta on noin kaksinkertainen, ja
  se on suunnilleen se minkä ajassa pilkotut laatat säästivät.
- **Työpöytä** (budjetti, tiheä taso ei käytössä): ensimmäinen näkymä
  z4,5 3 139 → 4 409 kB ja z5 2 716 → 3 332 kB — ero on ECMWF:n l1
  (1,0–1,4 Mt), z6 2 747 → 3 881 kB. Tarkkuus Suomenlahdella sama kuin
  ennen (alueellisten alla l1 ei vaikuta).
- **Laattamuisti 240 → 320** (`Saalaatat._MAX_LAATTAA`): puhelimen
  z4,5-näkymä on yksin 227 laattaa (z5,5 174, z6,5 136), ja 240:n katolla
  panorointi olisi pudottanut näkymän omia laattoja. Noin 40 Mt.

### Mitä jäi

Tuntuma laitteella: ICON:n ja GFS:n paketin viive (kontissa 1,5–2 s)
ja se, luetaanko ECMWF:n näkyminen haun aikana häiritseväksi. Jos on,
seuraava askel on funktion alue säilön viereen (`pdx1`, ks. V5).
