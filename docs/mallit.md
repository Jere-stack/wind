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
hilana). Nykytila- ja strategiaosiot ovat päätöksen pohjana olleet
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

**Luettelo.** `versio` pysyy 1:nä. `tasot` on vanhan asiakkaan lista
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

### Mitä jäi

Tuntuma laitteella: ICON:n ja GFS:n paketin viive (kontissa 1,5–2 s)
ja se, luetaanko ECMWF:n näkyminen haun aikana häiritseväksi. Jos on,
seuraava askel on funktion alue säilön viereen (`pdx1`, ks. V5).
