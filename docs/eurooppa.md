# Eurooppa — paras paikallinen data jokaiselle spotille (strategia ja roadmap, 4.10.2026)

Pyyntö (4.10.2026): *"Lähdetään seuraavaksi laajentamaan appia Helsingin ja
Suomen ulkopuolelle. Sovelluksen avainidea on ollut alusta alkaen nähdä
yhdellä silmäyksellä kaikki lokaalit relevantit datapointit samalle
spotille ja sen lähistölle — tehdä tämä paremmin kuin Windyssä ja käyttää
useampia datalähteitä, ettei käyttäjän tarvitse käydä neljällä sivustolla
tarkistamassa samoja datoja. Tehdään kaiken kattava strategia ja roadmap:
lämpökartta ja partikkelit, data, keräys. Esimerkiksi Ranskassa käytetään
kaikki lokaalit parhaat lähteet. GitHubista vastaavat sovellukset,
netistä, keskustelupalstoilta ja kaikista mahdollisista lähteistä
tarkimmat paikalliset lähteet. Koko Eurooppa kerralla niin, että se
saadaan oletusarvoisesti esiladattuun ja laskettuun kenttään, ja niin
että spotin säädatoissa on automaattisesti valittu paras ja tihein
verkko sille spotille, jotta paikalliset erot rannan lähettyvillä
näkyvät lähelle zoomattuna. Sen jälkeen sama koko maailmalle."*

Tämä on päätösasiakirja ja mittauspöytäkirja kuten muutkin `docs/`-
tiedostot. **Jokainen luku alla on mitattu tästä kontista 4.10.2026
klo 19–21 UTC**, ellei rivillä lue *arvio*, *luettelon arvo* tai *ei
mitattu*. Hylätyt lähteet ovat mukana samalla painolla kuin valitut:
hylkäys säästää enemmän työtä kuin ehdotus.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä.
> Mallien sekoituksen nykyinen koneisto on `docs/mallit.md`:ssä (V1–V6),
> datan oikeellisuus `docs/oikeellisuus.md`:ssä ja aiempi lähdekartoitus
> `docs/lisadata.md`:ssä — tämä tiedosto laajentaa niitä Eurooppaan eikä
> toista niitä.

---

## Tiivistelmä

1. **Euroopan tihein avoin säädata on jo samassa paikassa josta varasto
   nyt luetaan.** Open-Meteon avoimessa S3-peilissä (`s3://openmeteo`,
   CC BY 4.0, ei avainta, ei kiintiötä) on **kymmenen kansallista 1–2,5 km
   mallia**: Météo-France AROME 1,3 km, DWD ICON-D2 2,2 km, Met Office
   UKV 1,5/2 km, DMI:n ja KNMI:n yhteinen HARMONIE DINI 2 km,
   MeteoSwiss ICON-CH1 1 km ja ICON-CH2 2 km, ItaliaMeteo ICON-2I
   2,2 km, GeoSphere AROME 2,5 km sekä ČHMÚ:n ALADIN 1 km ja 2,3 km.
   Jokaisen hila, alue, ajot ja ennustepituus on mitattu (luku 3), ja
   kuuden hilan geometria on tarkistettu Open-Meteon rajapintaa vasten:
   samat luvut solulleen.
2. **Varaston nykyinen koneisto kantaa ne sellaisenaan.** Sama pyramidi,
   painokanava ja yksi valintasääntö (`naytteista`) joka nyt sekoittaa FMI:n,
   MET Nordicin ja ECMWF:n. Uutta tarvitaan kolme asiaa: projektioiden
   lukija (säännöllinen, Lambert, LAEA, kierretty napa), paino DATAN
   reunasta eikä suorakaiteesta (AROME- ja ICON-D2-hilan suorakaiteesta
   17 % on tyhjää) ja **käyttöalue**, joka estää laajan mallin
   reunavyöhykettä ohittamasta toisen maan kansallista mallia.
3. **Valintasääntö: tihein natiivihila ensin, kansallinen malli
   tasapelissä, ja jokaisella mallilla käyttöalue.** Pelkkä tiheys ei
   riitä: UKV:n 2 km hila ulottuu Osloon ja DINI Helsinkiin ja
   Kroatiaan, mutta niiden tarkka ydin ja virittäjät ovat muualla.
   Foorumeilla ja paikallisissa palveluissa toistuu sama: tihein malli
   voittaa merituulessa ja järvillä (AROME Gardalla ja Englannin
   itärannikolla, ICON-CH1 Alppien järvillä), mutta tasaväkisten 2–2,5 km
   mallien kesken kansallinen on se jota paikalliset käyttävät (DMI
   Tanskassa ja Saksan Itämerellä). Järjestys on yksi taulukko (luku 8,
   S1), ja varmennus Euroopan havaintoja vasten ratkaisee sen jatkossa.
4. **Lähizoomin paikalliset erot vaativat natiivihilan palvelimelta.**
   Varaston hienoin taso on 0,05° (≈ 5,5 × 3 km), ja se on Suomessa
   mitattu riittäväksi spottien kohdalla (`docs/oikeellisuus.md`). Mutta
   AROME on 1,3 km ja ICON-CH1 1 km, ja Gardan kaltainen 3–4 km leveä
   järvi on 0,05°:ssa yksi solu. Lähizoomissa kenttä haetaan
   palvelimelta mallin omalla hilalla samalla järjestyksellä ja painoilla
   kuin varasto — sama periaate kuin nykyisessä ECMWF 9 km -perheessä
   (`MalliHila`), jolloin zoomatessa kenttä tarkentuu eikä vaihdu.
5. **Spotin sarja tulee pisteen omasta natiivisolusta.** Kaikilla
   kymmenellä mallilla on S3:ssa myös aikasarjavarasto (`data/<malli>/`),
   josta `api/malli.js` lukee jo ECMWF:n, ICONin ja GFS:n pistesarjat.
6. **Havainnot: yksi avoin rajapinta kattaa Euroopan sääpalvelut.**
   EUMETNETin MeteoGate (E-SOH, OGC EDR, CC BY 4.0, ei avainta) palautti
   yhdellä 1,2 s:n kyselyllä **3 083 tuulisarjaa** koko Euroopasta
   (Ranska 350, Saksa 314, Italia 187, Iso-Britannia ja Irlanti 181,
   Espanja ja Portugali 107 …). Se on tunnin tahdissa; kymmenen minuutin
   tarkkuus tulee kansallisista rajapinnoista (Ranska 6 min ja 2 000
   asemaa, Saksa, Hollanti, Tanska, Sveitsi, Itävalta, Belgia) ja
   spottien omat tuulimittarit yhteisöverkoista (OpenWindMap 747 asemaa,
   joista 690 lähetti tunnin sisällä; FFVL ~200; Holfuy vain
   sopimuksella).
7. **Aukot ovat tunnettuja ja mitattuja.** Andalusia ja Tarifa, Lissabon
   ja Algarve, Egeanmeri, Turkin länsirannikko, Kanariansaaret ja
   Mustanmeren rannikko jäävät kaikkien avointen alueellisten mallien
   ulkopuolelle. Espanjan AEMET jakaa HARMONIE-AROMEnsa avoimesti vain
   **värikuvina** (mitattu: JPEG-pakattu RGBA-GeoTIFF, nopeus 10 km/h:n
   väriluokkina, suunta 0,4°:n nuolina) — se ei ole dataa. Aukoissa
   tihein avoin on ICON-EU 6,5 km ja ECMWF 9 km.
8. **Infra kestää ensimmäisen vaiheen, mutta ei koko roadmapia
   Hobby-tasolla.** Varasto kasvoi mitattuna 107 → 267 MB (GitHub
   Pagesin raja 1 GB; luku 12), ja Vercelin 12 funktion katto on jo täynnä —
   uudet reitit ovat tiloja olemassa olevissa funktioissa (CLAUDE.md).
   Käyttäjämäärän kasvaessa varasto siirtyy Cloudflare R2:een
   (maksuton siirto) ja funktiot Pro-tasolle (päätös P5).

**Suositus:** V1 heti (alueelliset mallit varastoon ja Paras-sekoitukseen
koko Euroopassa, luku 9), sitten V2 (lähizoomin natiivihila ja spotin
natiivisarja) ja V3 (MeteoGate-havainnot kartalle ja kortteihin).
Spottitietokanta, meri ja aukkojen paikkaus tulevat niiden jälkeen.

**Tila 5.10.2026:** V1 (luku 12), V2 (luku 13) ja V3:n E-SOH-osa
(luku 14) on toteutettu ja mitattu. V2 kytkeytyy päälle vasta kun
luettelossa on tasojen `natiivi`-kenttä, eli ensimmäisestä
V2-rakentajan Säädata-ajosta. V3:n OpenWindMap odottaa
lisenssipäätöstä (14.2). Luku 15: Euroopan asemat kaukaa pisteinä kuten
Suomen asemat, ja spottien sarjojen esilataus näkymän mukaan (5.10.).
**V1 toteutettiin samassa erässä** — tulokset ovat luvussa 12.

---

## 1. Mitä "paras paikallinen" tarkoittaa — periaatteet

Nämä ovat sovelluksen olemassa olevat säännöt Euroopan mittakaavassa,
eivät uusia:

- **P-a Yksi sekoitussääntö.** Lämpökartta, partikkelit, kapseli,
  aikajana, lähdemerkintä ja spottikortin Paras lukevat saman
  `naytteista`n (CLAUDE.md, "MALLIT SEKOITETAAN PAINOKANAVALLA").
  Eurooppa lisää perheitä, ei sääntöjä.
- **P-b Malli tulee paikasta ja hetkestä, zoom valitsee vain tarkkuuden**
  (`docs/mallit.md`, T1). Lähizoomin natiivihila on saman sekoituksen
  tarkempi näyte, ei toinen malli.
- **P-c Rajat ovat pehmeät paikassa ja ajassa.** 50 km:n smoothstep
  mallin datan reunasta (ei suorakaiteesta), 2 h akselin alussa ja 6 h
  lopussa.
- **P-d Tihein natiivihila ensin — kansallinen tasapelissä.** Ks. luku 8,
  S1. Natiivihila on mallin oma laskentahila, ei julkaisuhila: MET
  Nordicin 1 km on MEPS 2,5 km jälkikäsiteltynä, UKV:n 2 km ulkoalue on
  venytetty 4 km:iin, AROMEn 0,01° julkaisu on 1,3 km:n mallista.
- **P-e Avoin data ilman käyttäjäkohtaista kiintiötä.** Varasto syntyi
  siksi että Open-Meteon rajapinta laskuttaa paikoittain
  (`docs/data.md`, "Oma säädatavarasto"). Uusi lähde joka vaatii avaimen
  tai sopimuksen on erillinen päätös (P6).
- **P-f Puuttuva on läpinäkyvää, ei arvattua.** Malli jota ei ole tässä
  paikassa tai tällä tunnilla ei näy; alempi malli jatkaa pehmeästi.
- **P-g Järjestyksen ratkaisee mittaus.** Kuten Suomessa
  (`docs/oikeellisuus.md`, O11), mallien järjestys on hypoteesi kunnes
  varmennus havaintoja vasten sanoo muuta — nyt Euroopan asemilla.

---

## 2. Nykytila lyhyesti

| kerros | nyt | Euroopassa nyt |
|---|---|---|
| kenttä (varasto) | FMI HARMONIE 2,5 km (Suomi, 58–71 N / 17–33 E), MET Nordic (Pohjoismaat, Baltia), ECMWF 0,25° (Pohjoismaiden ympärillä), 0,5–5° muualla | ECMWF 0,5° Euroopassa, 1° muualla |
| kenttä (palvelimelta) | ECMWF 9 km zoomista 8 (`MalliHila`, `api/malli.js`) | sama 9 km |
| spottikortti | Paras = varasto + spotin ECMWF 9 km -sarja | ei spotteja (12 spottia Suomessa) |
| havainnot | FMI 21 asemaa, paikalliset (Mellsten, Laru, Kruunuvuori), aaltopoijut, mareografit | ei mitään |
| aallot | FMI WAM (Itämeri) | ei mitään |
| sade | FINRAD + nowcast, HARMONIE, ECMWF 9 km | ECMWF 9 km |
| rajoitteet | Vercel Hobby: 12/12 funktiota, 1 M edge-pyyntöä/kk; Pages 1 GB; Actions 45 min | — |

---

## 3. Säämallit Euroopassa — mitattu

### 3.1 Mitä Open-Meteon S3:ssa on

`data_spatial/`-hakemistossa on 77 mallia (listattu 4.10.). Eurooppaa
koskevat, `latest.json` + ensimmäinen tiedosto luettuna:

| S3-malli | tekijä | julkaisuhila | natiivi | alue | jakso | ajot | MB/h* |
|---|---|---|---|---|---|---|---|
| `meteofrance_arome_france_hd` | Météo-France | säännöllinen 0,01° (2801 × 1791) | AROME 1,3 km | 37,5–55,4 N, 12 W–16 E, **83 % täynnä** | +51 h | 3 h | 4,8 |
| `meteofrance_arome_france0025` | Météo-France | 0,025° (1121 × 717) | sama AROME | sama | +51 h | 3 h | 1,1 |
| `dwd_icon_d2` | DWD | 0,02° (1215 × 746) | ICON 2,2 km | 43,18–58,08 N, 3,94 W–20,34 E, **83 %** | +48 h | 3 h | 1,2 |
| `ukmo_uk_deterministic_2km` | Met Office | LAEA 2 km (1042 × 970) | UKV 1,5 km sisäalue, 4 km reuna | kulmat 44,5 N 17,2 W – 61,9 N 15,4 E | +54 h (00, 03 … Z), +12 h muut | tunneittain | 1,9 |
| `dmi_harmonie_arome_europe` | DMI (UWC-West: DMI, KNMI, Met Éireann, IMO) | Lambert 2 km (1906 × 1606) | HARMONIE-AROME DINI 2 km | kulmat 39,7 N 25,4 W – 62,7 N 40,1 E | +59 h | 3 h | 3,9 |
| `knmi_harmonie_arome_netherlands` | KNMI | 0,029 × 0,018° (390 × 390) | DINI-otos | 49–56 N, 0–11,3 E | +50–60 h | tunneittain | 0,2 |
| `knmi_harmonie_arome_europe` | KNMI | kierretty napa 0,05° (676 × 564) | 5,5 km | 39,7–62,6 N | +49–60 h | tunneittain | 0,7 |
| `meteoswiss_icon_ch1` | MeteoSwiss | kierretty napa 0,01° (1089 × 705) | ICON 1 km | kulmat 42,6 N 1,2 E – 49,8 N 16,8 E | +33 h | 3 h | 1,4 |
| `meteoswiss_icon_ch2` | MeteoSwiss | kierretty 0,02° (545 × 353) | ICON 2 km | sama | +120 h | 6 h | 0,3 |
| `italia_meteo_arpae_icon_2i` | ItaliaMeteo / ARPAE | 0,025 × 0,02° (761 × 761) | ICON 2,2 km | 33,7–48,9 N, 3–22 E | +72 h | 12 h | 0,9 |
| `geosphere_arome_austria` | GeoSphere | 0,028 × 0,018° (594 × 492) | AROME 2,5 km | 42,98–51,82 N, 5,5–22,1 E | +60 h | 3 h | 0,7 |
| `chmi_aladin_central_europe_2km` | ČHMÚ | Lambert 2 325 m (1053 × 837) | ALADIN 2,3 km | kulmat 38,6 N 1,3 E – 56,2 N 34,3 E | +72 h | 6 h | 1,4 |
| `chmi_aladin_cz_1km` | ČHMÚ | 0,014 × 0,009° (501 × 290) | ALADIN 1 km | 48,5–51,1 N, 12–19 E | +72 h | 6 h | 0,2 |
| `metno_nordic_pp` | MET Norway | Lambert 1 km | MEPS 2,5 km + havaintokorjaus | 52,3–73,9 N | +56 h | tunneittain | (käytössä) |
| `dwd_icon_eu` | DWD | 0,0625° | ICON 6,5 km | 29,5–70,5 N, 23,5 W–62,5 E | +30 / +120 h | 3 h | 1,3 |
| `meteofrance_arpege_europe` | Météo-France | 0,1° | ARPEGE ~10 km | 20–72 N, 32 W–42 E | +102 h | 6 h | — |
| `ukmo_global_deterministic_10km` | Met Office | 0,14 × 0,094° | 10 km | maapallo | +168 h | 6 h | — |
| `ecmwf_ifs` | ECMWF | O1280 | 9 km | maapallo | +360 h | 6 h | (käytössä) |

\* Kolme tuulikenttää (u ja v tai nopeus ja suunta, sekä puuska) koko
hilalta yhdeltä tunnilta, mitattu tavuina lukijan läpi.

**Kansallisuus.** DINI on neljän maan yhteinen operatiivinen malli
(UWC-West, operatiivinen 2024): Tanskan, Hollannin, Irlannin ja Islannin
oma. KNMI:n kaksi tuotetta ovat siitä leikattuja tai harvennettuja, joten
niitä ei tarvita erikseen. MET Nordic ja FMI:n HARMONIE ovat MetCoOpin
MEPS-mallia (Suomi, Ruotsi, Norja).

**Aikasarjat.** Jokaisella yllä olevalla mallilla on myös Open-Meteon
aikasarjavarasto `data/<malli>/<muuttuja>/chunk_N.om` (tarkistettu:
10 m tuuli ja puuska kaikilla, lohkon pituus 48–121 h). Spotin
natiivisarja luetaan siis samalla koneistolla kuin `api/malli.js`:n
nykyiset ECMWF-, ICON- ja GFS-sarjat.

### 3.2 Hilat tarkistettu totuutta vasten

Projektiot ovat Open-Meteon lähdekoodista (`Sources/App/Domains/*.swift`,
avoin repo): Lambert (DINI λ0 352°, φ 55,5°; ALADIN λ0 17°, φ 46,244°;
pallo R = 6 371 229 m), LAEA (UKV λ0 −2,5°, φ1 54,9°, origo
−1 158 000 / −1 036 000 m) ja kierretty napa (ICON-CH napa 43° / 190°,
origo −6,46 / −4,06; KNMI −35° / −8°). JavaScript-toteutus palautti
jokaisen hilan kulmat täsmälleen `latest.json`in `crs_wkt`-rajauksena.

Lähin solu S3:sta vs Open-Meteon rajapinta (`cell_selection=nearest`),
sama hetki, kolme pistettä mallia kohti:

| malli | täsmää | huomio |
|---|---|---|
| AROME HD, ICON-2I, DINI, ICON-CH1, ICON-CH2, ALADIN CE, ALADIN CZ | 3/3 nopeus ja suunta | — |
| ICON-D2 | 2/3 | Bodenjärvellä nopeus 3,52 vs 1,94 m/s, suunta sama |
| AROME Itävalta | 2/3 | Neusiedlillä 0,7 m/s:n tuulessa suunta 138 vs 171° — viereinen solu |
| UKV | 0/3 tarkasti | **tiedostossa on kaksi `wind_speed_10m`- ja `wind_direction_10m`-lasta**; rajapinta käyttää JÄLKIMMÄISTÄ (ero ensimmäiseen 0,1–0,8 m/s ja 1–3°) |

Suunnat ovat todellisesta pohjoisesta myös projektiohiloilla (DINI:n ja
ALADINin Lambert, UKV:n LAEA): Open-Meteo kääntää ne latauksessa, ja
rajapinta vastasi samaa suuntaa asteelleen.

### 3.3 Mikä malli kattaa minkäkin spotin

36 tunnettua tuulispottia (eivät sovelluksen spotteja), malli mukana jos
spotti on sen DATAN sisällä (AROME- ja ICON-D2-hilan tyhjät kulmat
huomioitu maskista). Suluissa etäisyys mallin reunaan kun alle 50 km.

| alue | spotit | kattavat mallit tiheimmästä alkaen |
|---|---|---|
| Ranska | Quiberon, Wissant, Leucate, Almanarre | AROME HD (+ ICON-CH1 reunavyöhykkeellä Leucatessa 20 km ja Hyèresissä 18 km), DINI, ICON-2I |
| Alpit, järvet | Garda, Silvaplana, Como, Lipno | ICON-CH1, AROME HD, ICON-D2, ICON-2I, AROME AT, ALADIN |
| Benelux, Saksa | Brouwersdam, Workum, Sylt (AROME 22 km), Fehmarn (AROME 37 km) | AROME HD, UKV, DINI, ICON-D2, ALADIN CE |
| Tanska | Klitmøller, Hvide Sande | **UKV (ulkoalue)**, DINI, ICON-D2, MET Nordic |
| Brittein saaret | Hayling, Rhosneigr, Dublin | AROME HD (reuna), UKV, DINI |
| Pohjoismaat | Göteborg, Oslo, Hanko, Lauttasaari, Kalmar | **UKV (ulkoalue) Göteborgissa ja Oslossa, DINI Helsingissä**, FMI, MET Nordic |
| Keski- ja Itä-Eurooppa | Hel, Neusiedl, Balaton, Bol, Mamaia | DINI (reuna), ICON-D2, ICON-2I, ALADIN CE, AROME AT |
| Välimeri | Barcelona, Mallorca, Sardinia, Sisilia, Lefkada | AROME HD (Barcelona, Mallorca, Sardinia), ICON-2I (Sisilia, Lefkada vain tämä), ALADIN CE |
| **aukot** | **Tarifa, Lissabon (Guincho), Algarve, Naxos, Rodos, Alaçatı, Teneriffa** | **ei yhtään alueellista** — ICON-EU 6,5 km (ei Kanariaa), ECMWF 9 km, ARPEGE 0,1°, UKMO 10 km |

Lihavoidut kertovat miksi pelkkä tiheysjärjestys on väärä: UKV:n hila
ulottuu Norjaan ja DINI:n hila Suomeen ja Kroatiaan, mutta niissä ne ovat
mallinsa reuna-alueella eivätkä kenenkään paikallisten valinta.

### 3.4 Kansalliset mallit S3:n ulkopuolella

| lähde | tila | mitattu / tiedossa |
|---|---|---|
| **AEMET HARMONIE-AROME** (Espanja, Baleaarit, Kanaria) | **hylätty dataksi** | `www.aemet.es/es/api-eltiempo/modelos/download/harmonie/PB` vastasi ilman avainta 26,6 MB tar.gz:llä: 48 tuntia, 0,025° (640 × 400, 11 W–5 E, 34,5–44,5 N), mutta jokainen kenttä on **RGBA-JPEG-GeoTIFF**: nopeus 10 km/h:n väriluokkina ja suunta GeoJSON-nuolina 0,4°:n välein. Visualisointi, ei lukuja. AEMET OpenData API (avain) antaa pisteennusteita ja havaintoja, ei hilaa |
| IPMA AROME 2,5 km (Portugali, Madeira, Azorit) | pyynnöllä | data maksutonta mutta pyydettävä (comercial@ipma.pt); ei mitattu |
| Met Éireann | katettu | ajaa DINIä (sama kuin DMI) |
| MeteoGalicia WRF | paikallinen lisä | avoin THREDDS (lähdeviittaus riittää): 4 km on 126 × 117 pistettä eli vain Galicia (500 × 464 km), +84 h; 1 km Galicia. Ei Etelä-Espanjaan |
| Météo-France AROME-PI | nowcast-ehdokas | 0,01°, 15 min askel, +6 h, ajo tunneittain; Météo-Francen API-avaimella (50 pyyntöä/min). Ei mitattu |
| Météo-France AWS (`mf-models-on-aws.org`) | varatie | AROME/ARPEGE suoraan Météo-Francelta AWS:ssä; varatie jos Open-Meteon peili muuttuu |
| DWD ICON-D2-RUC | ei mitattu | tunneittain päivittyvä 2,1 km; DWD:n opendata |
| HCMR Poseidon (Kreikka) | selvitettävä | foorumien mukaan Egeanmeren osuvin; avoimuus selvittämättä |

---

## 4. Havainnot Euroopassa — mitattu

### 4.1 MeteoGate E-SOH — Euroopan sääpalvelut yhdestä rajapinnasta

EUMETNETin E-SOH (EUMETNET Supplementary Observations dataHub) jakaa
kansallisten sääpalvelujen asemahavainnot OGC API EDR -rajapinnalla:
`https://observations.meteogate.eu/collections/observations/area`,
CoverageJSON, CC BY 4.0, ei avainta. Mitattu:

```
alue 34–72 N, 25 W–45 E, viimeiset 90 min, kahdeksan tuulimuuttujaa
-> 3 083 sarjaa, 3,5 MB, 1,2 s
FI 396  NO 446  SE 376  FR 350  DE 314  IT 187  UK+IE 181  ES+PT 107
PL+CZ 98  CH+AT 63  EE/LV/LT 24  BE 19  HR/SI/BA 15  NL 14  DK 7  muut 486
```

- **Tahti on enimmäkseen tunti**: 1 979 sarjaa 3 083:sta sisälsi yhden
  hetken 90 minuutissa (mediaani-ikä 43 min, eli tasatunnin havainto).
  Kymmenen minuutin sarjoja julkaisevat mm. Suomi (149 × `PT10M mean`).
- Parametrinimet ovat muotoa `wind_speed:10.0:point:PT10M`,
  `wind_speed_of_gust:10.0:maximum:PT1H` — 1 503 eri yhdistelmää. Sama
  suure tulee eri maista eri nimellä, joten rekisteri lukee niitä
  järjestyksessä (10 min keskiarvo > 10 min piste > tunnin keskiarvo).
- Asema tunnistetaan WIGOS-tunnuksella (`0-620-2101-08580`).
- Hollanti (14) ja Tanska (7) ovat ohuita: niiden tiheät verkot tulevat
  kansallisista rajapinnoista (alla).

### 4.2 Kansalliset rajapinnat (10 min tarkkuus ja tiheämmät verkot)

| maa | lähde | tahti | avain | huomio |
|---|---|---|---|---|
| Ranska | Météo-France `DonneesPubliquesObservation` | 6 min, yli 2 000 asemaa, 24 h | API-avain (maksuton, 100/min) | sisältää myös poijut ja laivat tunneittain |
| Saksa | DWD opendata `10_minutes/wind/now` | 10 min, päivitys alle tunnin | ei | tiedostoina asemittain |
| Hollanti | KNMI Data Platform, 10 min in-situ | 10 min | anonyymi avain (50/min) | + Rijkswaterstaat (alla) |
| Tanska | DMI `opendataapi.dmi.dk` metObs | 10 min | **ei avainta 2.12.2025 alkaen** | |
| Ruotsi | SMHI metobs `station-set/all/period/latest-hour` | tunti | ei | yksi kutsu kaikki asemat |
| Norja | MET Norway Frost | 10 min / tunti | client id (maksuton) | |
| Sveitsi | MeteoSwiss STAC `ch.meteoschweiz.ogd-smn` | 10 min, ~160 asemaa, päivitys 20 min | ei | yksi tiedosto kaikille asemille |
| Itävalta | GeoSphere `station/current/tawes-v1-10min` | 10 min, 235 + 53 asemaa | ei | CC BY 4.0 |
| Belgia | RMI `opendata.meteo.be` AWS WFS | 10 min, 17 asemaa | ei | |
| Puola | IMGW `danepubliczne.imgw.pl/api/data/synop` | tunti, ~60 asemaa | ei | |
| Espanja | AEMET OpenData `/observacion/convencional/todas` | tunti, 12 h | API-avain (sähköposti) | |
| Iso-Britannia | Met Office DataHub Land Observations | tunti, 150 asemaa, 48 h | avain, **360 kutsua/vrk** | |
| Portugali | IPMA `api.ipma.pt` | tunti | ei | ei mitattu |

### 4.3 Spottien omat tuulimittarit (yhteisö- ja liittoverkot)

| verkko | mitattu | ehdot |
|---|---|---|
| **OpenWindMap / Pioupiou** | `api.pioupiou.fr/v1/live/all`: **747 asemaa, 690 lähettänyt tunnin sisällä**, 575 Ranskassa, 111 muualla Euroopassa. Keskiarvo, min, max, suunta | Community License: maksuton myös kaupalliseen käyttöön, näkyvä lähdemerkintä ja linkki, dataa ei saa heikentää eikä viivästää |
| FFVL (Ranskan liitelyliitto) | ~200 asemaa, 5 min, 72 h historia (luettelon arvo) | avain data.ffvl.fr:stä, ehdot wikissä |
| **Holfuy** | `api.holfuy.com/live/` vaatii `pw`:n; automaattinen keruu kielletty ilman sopimusta (ehdot). Mitattu jo 11.9.: "No access" | **vain sopimuksella** — mutta Holfuy on kitespottien yleisin mittari Keski-Euroopassa ja Välimerellä |
| WindsUp, Windguru-asemat, WeatherFlow, iKitesurf | — | suljettuja / maksullisia |
| Netatmo | — | OAuth, rajoitettu `getpublicdata`; tuulimoduuli harvinainen |

### 4.4 Meri: poijut, vedenkorkeus, vuorovesi

| lähde | mitä | avain |
|---|---|---|
| EMODnet Physics ERDDAP | yli 4 400 alustaa: aallot, tuuli, vedenkorkeus, lämpö, lähes reaaliaikainen | ei |
| Copernicus Marine In Situ TAC | poijut ja mareografit koko Euroopasta | rekisteröinti |
| Rijkswaterstaat WaterWebservices (NL) | 825 vedenkorkeusasemaa, tuuli, aallot, vuorovesi, 10 min | ei |
| Puertos del Estado (ES) | REDEXT 15 syvänveden poijua, REDCOS rannikkopoijut, mareografit | portaali, rajapinta selvitettävä |
| Channel Coastal Observatory (UK) | 53 aaltoasemaa, 16 vuorovesi-, 25 sääasemaa (GeoJSON) | avain |
| Marine Institute (IE) ERDDAP | Irish Weather Buoy Network | ei |
| SHOM REFMAR (FR) | ~50 RONIM-mareografia reaaliajassa, Licence Ouverte 2.0 | ei; **ennusteet maksullisia** |
| Kartverket (NO) | vedenkorkeus, vuorovesi, 5 vrk ennuste, CC BY 4.0 | ei |
| UKHO Admiralty Tidal API | 607 asemaa, kuluva + 6 vrk vuorovedet | maksuton Discovery-taso (10 000 kutsua/kk) |

### 4.5 Tutka, salama, varoitukset

- **OPERA (EUMETNET Open Radar Data)**: Euroopan tutkakomposiitti (DBZH,
  RATE, ACRR), ODIM HDF5 ja COG, CC BY 4.0, 24 h välimuisti S3:ssa
  (`openradar-24h`, `s3.waw3-1.cloudferro.com`, ilman tunnistautumista)
  ja arkisto 2012 alkaen. Korvaa FINRADin rajauksen Euroopassa.
- **MeteoAlarm**: koko Euroopan CAP-varoitukset (Atom ja OGC EDR),
  CC BY 4.0.
- **MTG Lightning Imager** (EUMETSAT): salamat geostationaarisesta
  satelliitista avoimena datana; ei mitattu.

---

## 5. Meri — aallot ja vuorovesi, mitattu

### 5.1 Aaltomallit S3:ssa ja niiden etäisyys rantaan

Suomessa ECMWF:n aaltomalli hylättiin, koska lähin märkä solmu oli 17–24
km ulkomerellä (`docs/lisadata.md`). Sama mittari Euroopan spoteille:

| spotti | DWD EWAM 0,05 × 0,1° | Météo-France MFWAM 1/12° |
|---|---|---|
| Quiberon | 2,7 km | 2,4 km |
| Wissant | 4,8 | 2,5 |
| Brouwersdam | 5,6 | 10,4 |
| Sylt | 0,0 | 2,8 |
| Klitmøller | 6,4 | 12,7 |
| Tarifa | 1,5 | 6,4 |
| Guincho | 4,1 | 2,7 |
| Leucate | 4,2 | 8,1 |
| Hayling | 3,1 | 1,5 |
| Naxos | 5,8 | 8,3 |
| Prasonisi | 4,3 | 2,0 |
| Bol | 7,8 | 6,1 |
| Lauttasaari | 6,3 | 3,2 |

- EWAM: Eurooppa 30–66 N, 10,5 W–42 E, tunneittain +78 h, aalto-,
  maininki- ja tuuliaallokko erikseen. MFWAM: maapallo, 3 h, +240 h,
  kaksi mainingin osaa.
- **Kumpikaan ei ole spotin aalto** sovelluksen nykyisellä säännöllä
  ("lähin märkä solmu 2,5 km:n sisältä", CLAUDE.md): EWAM täyttää sen
  kahdessa spotissa 13:sta. Ulkomeren aalto on kuitenkin oikea luku
  maininkirannoille (Atlantti) kun etäisyys sanotaan.
- Tarkemmat: Copernicus Marinen alueelliset aaltomallit (luettelon
  arvot: Luoteis-Eurooppa ~1,5 km, Biskaja–Iberia ~2,5 km, Välimeri
  ~4,5 km, Itämeri ~1,8 km) ARCO-Zarrina S3:ssa ilman tunnistautumista.
  Ei mitattu.

### 5.2 Vuorovesi — Atlantin spoteilla se on pääsuure

Itämerellä vuorovettä ei ole (CLAUDE.md), mutta Bretagnessa nousu on
10+ m ja Kanaalissa vuorovesivirta päättää foilauksen. Lähteet:

- **S3 `meteofrance_currents`**: maapallo 1/12°, tunneittain +240 h,
  `sea_level_height_msl` (sisältää vuoroveden) ja pintavirrat u/v. Yksi
  tiedosto, ei avainta — mutta 1/12° rannikolla on karkea.
- **EOT20** (DGFI-TUM): globaali vuorovesimalli 1/8°, 17 osavuorovettä,
  **CC BY 4.0** — harmoninen ennuste mihin tahansa rannikkopisteeseen
  ilman rajapintaa.
- Kansalliset harmoniset ennusteet: Kartverket (CC BY), Rijkswaterstaat
  (avoin), UKHO (maksuton taso), SHOM (maksullinen).
- Mittari: ennuste mareografia vasten (REFMAR, RWS, NTSLF) — virhe
  senttimetreinä ja minuutteina ennen kuin rivi näytetään.

---

## 6. Vastaavat sovellukset — mitä ne tekevät ja mitä niistä opitaan

| sovellus | mitä | opittavaa |
|---|---|---|
| **Windy** | yksi malli kerrallaan, "paikalliset" ICON-D2, AROME, AROME HD, UKV, Swiss1k | ei sekoitusta eikä pehmeitä rajoja — käyttäjä valitsee mallin (`docs/mallit.md`) |
| **Windguru** | 40+ mallia taulukkona, oma "WG"-sekoitusmalli (AROME, ICON, HARMONIE …) painotettuna keskiarvona | sekoitus on alan käytäntö; meillä se on paikan ja hetken painokanava eikä mallien keskiarvo |
| Windfinder | Superforecast (oma WRF) | foorumeilla hyvä ajoituksessa, liioittelee IJsselmeerillä |
| **winds.mobi** | avoin (AGPL) asemaverkkojen kerääjä: Holfuy, Pioupiou, FFVL, MeteoSwiss, METAR … yhteiseen muotoon | toimittajakohtainen moduuli → yksi muoto; sama rakenne havaintorekisterille |
| **OpenWind** (AGPL) | MapLibre + Open-Meteo, viisi asemaverkkoa (MeteoSwiss 154, Pioupiou ~600, Netatmo, Météo-France ~185, Windball) | lähes sama pino kuin meillä; ei omaa kenttää eikä sekoitusta |
| **varun.surf** (GPL) | Windguru + Windfinder + ICM, asemat kaavittuna | kaavinta ja välityspalvelin — juuri se mitä emme tee |
| KitePlanet, Swelligence | Open-Meteo + avoin data, spottipisteytys | spottipisteytys on yleinen; kartta ja havaintoverkko ovat harvinaisia |
| labouee.app | poijudata rajapinnaksi (mm. Puertos del Estado) | merihavainnot omana tuotteenaan |
| GardaWind, thewindmaster.app | Gardan oma ennuste AROME 1,3 km:stä | **paikallinen tieto: AROME ja ICON-CH1 ovat Gardan termisissä tuulissa parhaat, globaalit eivät ennusta niitä lainkaan** |
| meltemi.gr, Poseidon | Egeanmeren meltemi | Poseidon foorumeilla osuvin Kreikassa |

**Foorumeilta ja paikallisilta sivuilta** (lähteet lopussa):

- **AROME ja ICON-D2 ennustavat merituulen parhaiten** (UK:n purjehdus-
  ja surffifoorumit; Ipswichissä AROME paras merituulen ennustaja,
  ICON-D2 parempi kuin UKV, UKV lyhyellä aikavälillä lähes AROMEn
  tasoa). 2–1 km:n mallit näyttävät merituulen ja tuulettomat vyöhykkeet.
- **Hollanti**: Harmonie (KNMI) ja AROME lähiajalle, ICON pidemmälle.
- **Saksa**: ICON-D2 (ja RUC) Pohjanmerellä; **Itämeren kitespoteilla
  paikalliset käyttävät tanskalaista ennustetta** — eli DMI:n DINIä.
- **Garda**: AROME 1,3 km ja MeteoSwissin 24 h ennuste; Windguru,
  Windfinder ja Windy "eivät koskaan ennusta hyvää tuulta" termisiin
  tuuliin.
- **Tarifa**: levante on ennustettavissa (mallin 6–7 kts tarkoittaa
  rannalla 13–14 kts — salmen kiihtyminen), poniente on terminen ja
  vaatii 3 km:n mallin tai paikallistuntemusta.
- **Kreikka**: meltemi 48–72 h etukäteen kohtuullisesti kaikilla;
  Poseidon osuvin.
- **Yleinen ohje kaikkialla**: kahden mallin yksimielisyys = luotettava.
  Sovelluksessa tämä on mallien erimielisyys ja laajan näkymän Vertaa.

---

## 7. Mitä Eurooppa vaatii sovellukselta — aukot nykytilassa

1. **Kenttä**: Euroopassa ECMWF 0,5° (varasto) ja 9 km zoomista 8.
2. **Lähizoom**: hienoin taso 0,05°; 1–1,3 km mallien paikalliset erot
   eivät näy.
3. **Spotit**: 12 kovakoodattua spottia (`SPOTS`), tuulisuunnat käsin.
   OpenStreetMapissa on Euroopassa 614 `sport=kitesurfing|windsurfing|
   wingfoil`-kohdetta (Overpass, ODbL) — siemen, ei valmis tietokanta.
4. **Havainnot**: rekisteri on käsin kirjoitettu (`FMI_MAP_STATIONS` +
   `PAIKALLISASEMAT`), haku yhdestä FMI-kyselystä.
5. **Meri**: aallot vain FMI WAM, vuorovettä ei ole käsitteenä.
6. **Lähdenimet ja kortin mallivalikko**: viisi mallia
   (`KorttiSarjat.MALLIT`, `Lahde.NIMET`).
7. **Infra**: 12/12 funktiota, Pages 1 GB, Actions 45 min.

---

## 8. Strategia

### S1 — Kenttä: Euroopan alueelliset mallit varastoon

**Perheet ja järjestys.** Jokainen malli on oma pyramidinsa (0,05 / 0,1 /
0,25 / 0,5°) ja painokanavansa, kuten FMI ja MET Nordic nyt. Järjestys
on yksi taulukko (rakentaja kirjoittaa sen luetteloon, asiakas lukee
sen):

| # | perhe | natiivi | käyttöalue | reunan pehmennys | perustelu |
|---|---|---|---|---|---|
| 1 | FMI HARMONIE | 2,5 km | Suomi ympäristöineen (58–71 N, 17–33 E) | 50 km | käyttäjän päätös: FMI aina Suomessa |
| 2 | ALADIN CZ | 1 km | koko hila | 30 km | kansallinen ja tihein; hila on pieni (2,6° × 7°) |
| 3 | ICON-CH1 | 1 km | koko hila | **100 km** | Alppien järvet; reunavyöhyke pois Leucatesta ja Hyèresistä |
| 4 | UKV | 1,5 km | **Brittein saaret** (GB, IE, IM, Kanaalisaaret + merialueet) | 50 km | ulkoalue (Norja, Tanska) on 4 km:n venytystä |
| 5 | AROME HD | 1,3 km | koko DATA (ei suorakaide) | **80 km** | Ranska, Benelux, Sveitsin länsi, Pohjois-Italia, Pohjois-Espanja, Korsika, Sardinia |
| 6 | MET Nordic | 2,5 km + korjaus | Norja, Ruotsi, Suomi, Baltia, Luoteis-Venäjä + merialueet | 50 km | MEPS on näiden maiden kansallinen; Venäjällä muuta alueellista ei ole |
| 7 | DINI | 2 km | Tanska, Hollanti, Irlanti, Belgia, Islanti, Färsaaret + merialueet ja Pohjanmeren avomeri | 50 km | UWC-Westin kansallinen; ei Pohjoismaihin eikä Keski-Eurooppaan |
| 8 | ICON-CH2 | 2 km | koko hila | 100 km | ICON-CH1:n jatko +33 → +120 h |
| 9 | ICON-D2 | 2,2 km | Saksa + merialueet | 50 km | kansallinen |
| 10 | ICON-2I | 2,2 km | Italia, Malta, Montenegro, Albania, Kreikka (länsi), Tunisia + merialueet | 50 km | kansallinen; ainoa alueellinen Sisiliassa ja Joonianmerellä |
| 11 | AROME AT | 2,5 km | Itävalta | 50 km | kansallinen |
| 12 | ALADIN CE | 2,3 km | koko hila | 50 km | Puola, Slovakia, Unkari, Balkan, Romania, Mustameri (länsi) |
| — | ECMWF 9 km (palvelimelta) | 9 km | maapallo | — | kuten nyt |
| — | ECMWF 0,25–5° (varasto) | 25 km | maapallo | — | pohja kuten nyt |

Käyttöalue on maajoukko, ja merisolu kuuluu lähimmän rannikkomaan
alueeseen 150 km:iin asti (sitä kauempana on "avomeri", jossa järjestys
ratkaisee). Paino on `datan reuna × käyttöalue`, molemmat smoothstepinä.

Lopputulos esimerkkispoteissa: Quiberon, Wissant, Brouwersdam ja
Barcelona AROME; Garda, Silvaplana ja Como ICON-CH1; Hayling ja
Dublin UKV; Klitmøller ja Hvide Sande DINI; Göteborg, Oslo ja Kalmar
MET Nordic; Helsinki ja Hanko FMI; Sylt ja Fehmarn AROMEn reuna
sekoittuneena ICON-D2:een; Hel, Balaton ja Bol ALADIN CE; Neusiedl
AROME AT; Sisilia ja Lefkada ICON-2I.

**Miksi ei pelkkä tiheysjärjestys eikä pelkkä kansallinen.** Tiheys
yksin antaisi UKV:n Osloon ja DINI:n Helsinkiin ja Kroatiaan (luku 3.3).
Kansallinen yksin antaisi Gardalle ICON-2I:n, vaikka paikalliset
käyttävät AROMEa ja ICON-CH1:tä, ja Hollannille DINI:n AROME 1,3 km:n
sijaan. Sääntö "tihein natiivihila, kansallinen tasapelissä (2–2,5 km
mallit), käyttöalue reunavyöhykkeitä vastaan" toistaa kaikki edellä
kirjatut paikalliset valinnat ja Suomen nykyisen järjestyksen.

**Paino datan reunasta.** AROME HD:n ja ICON-D2:n säännöllinen hila on
mallin Lambert-alueen ympäröivä suorakaide, ja 17 % siitä on NaN:ia
(mitattu koko hilasta: alakulmat tyhjiä, 37,8 N:n rivillä data vain
reunoilla). Etäisyys lasketaan siksi lähimpään tyhjään soluun, ei
suorakaiteen reunaan. Projektiohiloilla data on 100 % täynnä (mitattu),
ja etäisyys on indeksietäisyys kertaa solukoko, kuten MET Nordicilla.

**Menneisyys.** Jokaisen mallin menneet tunnit tulevat edellisistä
ajoista (tuorein ajo joka kattaa tunnin), kuten MET Nordicilla.
Pituus on päätös P2: 24 h puolittaa lisäkoon 48 tuntiin verrattuna.

**Koko ja aika.** Arvio oli 150–250 MB lisää ja varasto 300–400 MB.
Mitattuna (luku 12): alueelliset perheet 163 MB 24 h menneisyydellä,
varasto 267 MB, rakennus 26 min kontissa (Euroopan osuus 13,4 min).

### S2 — Lähizoom: natiivihila palvelimelta

- `api/malli.js?malli=paras` (tila olemassa olevassa funktiossa, ei uusi
  tiedosto): näkymän alueelle sama järjestys ja samat painot kuin
  varastossa, mutta jokainen malli näytteistetään omasta hilastaan
  (0,01–0,025°). Järjestys, projektiot ja käyttöalueet ovat yhteisessä
  apumoduulissa jota sekä rakentaja että funktio käyttävät, jolloin
  varaston 0,05° ja palvelimen 0,01° ovat saman sekoituksen kaksi
  tarkkuutta.
- Asiakkaassa uusi dynaaminen perhe varaston perheiden PÄÄLLE, vain
  zoomista 10–11 (päätös P4), valitulle tunnille ±1 h. Kuten ECMWF
  9 km: varasto on jo ruudulla, joten haun aikana mikään ei odota.
- Mitattava ennen päätöstä: kentän koko ja kesto (AROMEn 0,01°
  näkymälle z11: noin 1° × 0,6° eli 6 000 solmua, arvio 30–60 kt),
  CDN-osumat ja palvelimen CPU (Hobby 4 CPU-tuntia/kk).
- **Toteutettu toisin** (luku 13.2): palvelin palauttaa yhden perheen
  oman hilan (`malli=<perhe>`), ja sekoitus tehdään asiakkaassa
  varaston painoilla — yksi sekoitussääntö, ei toista palvelimella.
  Mitattu kenttä 1,2–2,0 s ja 1,6–6,6 kt (ei 30–60 kt).

### S3 — Spotin natiivisarja

- `api/malli.js?tila=sarja&malli=paras`: pisteen sarja jokaisen kattavan
  mallin `data/`-aikasarjavarastosta sen omasta solusta, sekoitettuna
  samoilla painoilla. Kortin Paras = tämä + ECMWF 9 km jatko.
- Sääntö "kortti = aikajana = merkki" pysyy: aikajana lukee kartan
  keskipisteen sarjaa samasta funktiosta kun zoom on natiivihilan
  alueella (sama kuin nyt ECMWF 9 km:llä).
- **Toteutettu perheittäin** (`tila=sarja&malli=<perhe>`, luku 13):
  kortti hakee spotin solusta ne perheet jotka ovat varaston
  Paras-sarjan lähteitä, ja paino tulee varastosta.

### S4 — Aukot

- **ICON-EU 6,5 km ECMWF 9 km:n päälle aukkoalueilla ensimmäiset 72 h**
  (päätös P3): Tarifa, Lissabon, Egeanmeri, Mustameri. Perustelu:
  tihein avoin; foorumeilla ICON on "vahva koko Euroopassa". Varmennus
  ratkaisee pysyykö.
- IPMA AROME (Portugali) pyynnöllä; Poseidon (Kreikka) selvitettävä;
  MeteoGalicia Galician rannikolle (lähdeviittaus).
- Kanariansaaret: vain globaalit — AEMET:n HARMONIE on avoimesti
  vain kuvina.

### S5 — Havainnot

- **Rekisteri dataksi**: asema = `{ id, lahde, nimi, lat, lng, tagi,
  tahti }` haettuna rajapinnasta eikä käsin kirjoitettuna (poijut on jo
  tehty näin). Suomen nykyinen rekisteri jää sellaisenaan.
- **Pohja MeteoGate E-SOH**: yksi alue-kysely näkymälle (CDN-
  välimuistiin 5–10 min). Kansalliset 10 min lähteet niissä maissa
  joissa ne ovat avaimettomia (DE, NL, DK, CH, AT, BE, SE, PL), ja
  OpenWindMap (Ranska, Alpit). FFVL, Météo-France, AEMET ja Met Office
  avaimella (P6), Holfuy sopimuksella.
- **Proxyt tiloina olemassa olevissa funktioissa** (`api/fmi.js?lahde=eu`
  tms.) — 12 funktion katto.
- **Historia**: Havainnot-ajo tallettaa tunnin välein E-SOH:n ja
  OpenWindMapin näkymän spottien läheltä `havainnot`-haaraan (48 h
  aikajanalle ja varmennukselle).
- **Merihavainnot**: EMODnet ERDDAP (yksi lähde kaikille merille),
  Rijkswaterstaat, Puertos del Estado.

### S6 — Meri

Aallot EWAM + MFWAM varastoon kuten WAM (`aallot`-avain), etäisyys
sanotaan aina; tarkemmat Copernicus Marinen alueelliset myöhemmin.
Vuorovesi omana rivinään Atlantin, Kanaalin ja Pohjanmeren spoteilla
(EOT20-harmoninen tai `meteofrance_currents`, mareografia vasten
mitattuna). Vuorovesivirrat samasta `meteofrance_currents`ista.

### S7 — Spotit

- Siemen OSM:stä (614 kohdetta, ODbL-lähdemerkintä) + kuratoitu lista
  tunnetuimmista (tällä tiedostolla 36), ja **käyttäjän omat spotit**.
- **Tuulisuunnat rantaviivasta**: rantaviivan normaali (Natural Earth
  tai OSM) antaa sivu- ja maatuulen sektorit automaattisesti; käsin
  viritys `tools/suunnat.html`illa kuten nyt.
- Lähin havaintoasema valitaan rekisteristä kuten Suomessa
  (meriasema ohittaa sisämaan 40 km:iin).

### S8 — Varmennus koko Eurooppaan

`tools/varmennus.mjs` lukee nyt FMI:n havaintoja. Sama vertailu
MeteoGate E-SOH:ta vasten perheittäin ja alueittain (rannikko, järvi,
avomeri) — tämä ratkaisee S1:n taulukon järjestyksen datasta (P-g).

### S9 — Infra

| raja | nyt | Euroopan V1 | kun liikennettä |
|---|---|---|---|
| varaston koko (Pages 1 GB) | 107 MB | 267 MB (mitattu) | R2 (10 GB maksutta, siirto maksuton) |
| Pagesin siirto (pehmeä 100 GB/kk) | — | — | R2 tai Cloudflare-CDN eteen |
| Actions (aikaraja 45 → 60 min) | ~10 min | 26 min (mitattu kontissa) | rinnakkaiset työt mallipareittain |
| Vercel-funktiot (12) | 12/12 | 12/12 (tilat) | Pro tai funktioiden yhdistäminen (P5) |
| Vercel edge-pyynnöt (1 M/kk) | arvio ylittyy ~15 000 käyttäjällä | lähizoom lisää | Pro (~20–28 $/kk) |
| Open-Meteon S3-riippuvuus | ECMWF, MET Nordic | + 10 mallia | varatiet: Météo-France AWS, DWD opendata, DMI |

### S10 — Maailma (seuraava vaihe)

Sama rakenne muualla, S3:ssa jo valmiina: HRRR ja RRFS 3 km
(Yhdysvallat), HRDPS 2,5 km (Kanada), JMA MSM 5 km (Japani), KMA
(Korea), BOM ACCESS (Australia), CMA (Kiina), NBM. Havainnot: WIS 2.0
-välittäjät (sama formaatti kuin E-SOH) ja kansalliset (NOAA). Spotit:
OSM maailmanlaajuisesti.

---

## 9. Roadmap

| vaihe | sisältö | koko | riippuvuus |
|---|---|---|---|
| **V1** | **Alueelliset mallit varastoon**: yleinen projektiolukija, paino datan reunasta, käyttöalueet, 10 uutta perhettä, järjestys luettelosta, asiakas lukee järjestyksen, lähdenimet ja kortin Paras kaikista perheistä — **toteutettu 4.–5.10. (luku 12)** | L | — |
| **V2** | **Lähizoomin natiivihila** (`malli=<perhe>`, paino varastosta) **ja spotin natiivisarja** (`tila=sarja&malli=<perhe>`), yhteinen taulukko rakentajan kanssa — **toteutettu 5.10. (luku 13)** | L | V1 |
| **V3** | **Havainnot: MeteoGate E-SOH** + OpenWindMap kartalle ja kortteihin, dynaaminen rekisteri, historia `havainnot`-haaraan — **E-SOH toteutettu 5.10. (luku 14); OpenWindMap odottaa lisenssipäätöstä (14.2)** | L | — |
| V4 | Varmennus Eurooppaan (E-SOH), järjestys datasta | M | V1, V3 |
| V5 | Spotit: OSM-siemen, kuratointi, käyttäjän spotit, suunnat rantaviivasta, haku | L | V3 |
| V6 | Meri: EWAM/MFWAM varastoon, vuorovesi, virrat, merihavainnot (EMODnet) | L | V5 |
| V7 | Aukot: ICON-EU (P3), IPMA, Poseidon, MeteoGalicia | M | V4 |
| V8 | Sade ja varoitukset Euroopassa: OPERA-komposiitti, MeteoAlarm | M | — |
| V9 | Maailma | XL | V1–V5 |

**Järjestyksen perustelu.** V1 tuo kentän koko Eurooppaan ilman uutta
infraa ja ilman uusia kutsuja selaimesta (laatat), eli sen hinta on
rakennusaika ja varaston koko. V2 tekee siitä paikallisen. V3 on
sovelluksen avainidea (kaikki datapisteet yhdellä silmäyksellä) ja
riippumaton V1:stä. V4 tarvitsee molemmat. Spotit (V5) ovat
käyttöliittymän laajennus jonka data tulee V1–V3:sta.

---

## 10. Päätettävät kohdat

| | kysymys | suositus |
|---|---|---|
| P1 | Etusijasääntö | **Tihein natiivihila, kansallinen tasapelissä, käyttöalueet** (S1). Vaihtoehto: kansallinen ensin kaikkialla (Garda ICON-2I:lle, Hollanti DINI:lle) |
| P2 | Alueellisten mallien menneisyys | **24 h** (puolet koosta); 48 h kun varasto on R2:ssa |
| P3 | ICON-EU aukkoalueille ECMWF 9 km:n päälle | **Kyllä, 72 h:iin asti**, varmennus seuraa |
| P4 | Lähizoomin natiivihila mistä zoomista | **z ≥ 10** (0,05°:n taso alkaa samasta) — mittaa kesto ennen |
| P5 | Infra | **Hobby niin kauan kuin mahtuu**; Pro ja R2 kun liikennettä — ei nyt |
| P6 | Avainta vaativat havaintolähteet | Météo-France ja AEMET kyllä (maksuttomia, avain palvelimelle), Met Office myöhemmin (360/vrk), Holfuy sopimus erikseen |
| P7 | Spottitietokanta | OSM + kuratointi + käyttäjän omat |

---

## 11. Riskit ja mitä EI tehdä

- **Open-Meteon peili muuttuu.** Kymmenen mallia yhdestä peilistä on
  yksi vikapiste. Varatiet: Météo-France AWS, DWD opendata, DMI:n ja
  MeteoSwissin oma avoin data. Rakentaja epäonnistuu mallikohtaisesti
  (try/catch kuten FMI:llä), ei kokonaan.
- **UKV:n kaksi samannimistä lasta** — luetaan rajapinnan käyttämä
  (jälkimmäinen). Jos Open-Meteo korjaa tiedoston, tarkistus nimestä ja
  järjestyksestä.
- **Reunavyöhykkeet** (AROME Saksan pohjoisrannikolla, ICON-CH1
  Ranskan Välimerellä): pehmennys 80–100 km pitää ne sekoituksena.
  Varmennus näyttää onko se oikea.
- **Ei kaavintaa** (Windguru, Windfinder, WindsUp, Holfuy ilman
  sopimusta). Ehdot kieltävät, ja varun.surf tarvitsi sitä varten
  välityspalvelimen.
- **Ei AEMETin värikuvia dataksi.** 10 km/h:n luokista ei saa lukua
  jonka sovellus näyttäisi desimaalin tarkkuudella.
- **Ei ECMWF:n eikä EWAMin aaltoja spotin aaltona ilman etäisyyttä.**
- **Ei mallien keskiarvoa (Windguru WG) Parakseksi.** Paras on paikan ja
  hetken paras malli painokanavalla; keskiarvo hävittäisi tihein mallin
  paikalliset erot — juuri ne joita pyydettiin.

---

## 12. Toteutus (V1, 4.–5.10.2026)

### 12.1 Mitä tehtiin

- **`tools/alueelliset.mjs`** — yksi taulukko (`ALUEELLISET`) omistaa
  järjestyksen, S3-nimen, tason tunnuksen, kentät (u/v tai nopeus/suunta),
  ajovälin, reunan pehmennyksen, käyttöalueen, avomeren, rajauksen, hilan
  ja lähdetekstin. Projektiot Open-Meteon lähdekoodista (Lambert, LAEA,
  kierretty napa, säännöllinen). `geometria` laskee jokaisen lähdepisteen
  0,05°:n solmun kerran ja lukuikkunan, `reunaPaino` datan reunan
  ensimmäisen hetken NaN-maskista (chamfer, km), `kayttoPaino` maajoukosta,
  `akseli` tuoreimman ajon jolla on vähintään tunnin ennuste (loppu
  kauimmas yltävästä ajosta), `lueHetki` otsakkeet yhtenä alueena ja
  ikkunan rivipaloina, `hilaksi` aluekeskiarvon.
- **`tools/maat.mjs` → `tools/maat.json`** — Natural Earth 1:50m
  (public domain), 74 maata, 1 561 × 1 001 solmua 0,05°:n välein, 29 kt.
  Meri kuuluu lähimmälle maalle 150 km:iin (rannikkomerta 334 367 solmua,
  avomerta 528 795). Ajetaan käsin; tiedosto on repossa.
- **`tools/tiilet.mjs`** — Euroopan silmukka MET Nordicin jälkeen, kukin
  malli omassa try/catchissaan; tasot `<id>0`–`<id>3` (0,05 / 0,1 / 0,25 /
  0,5°) `lisatasot`-listaan omalla tuntiakselillaan ja painokanavallaan;
  luettelon `perheet` = järjestys. MET Nordicin paino = Lambert-reuna ×
  käyttöalue. ECMWF:n l0 (0,25°) laajeni Pohjoismaista koko Eurooppaan
  (25–75 N, 35 W–45 E; 60 → 160 laattaa), jotta sekoitusvyöhykkeillä
  pohja on hienoimmallaan kuten ennen MET Nordicin ympärillä.
  Ympäristömuuttujat: `EUROOPPA=0` ohittaa, `EU_MALLIT=arome_hd,dini`
  rajaa, `EU_MENNEISYYS_H` (24), `EU_RINNAKKAIN`, `EU_MAX_ASKELTA`.
- **Asiakas** — `Saalaatat._alusta` lukee järjestyksen luettelosta
  (`PERHEET` on vain vanhan luettelon varatie; pohja on aina viimeisenä),
  `alueelliset()` ja `onAlueellinen()`; "Paras saatavilla" (`TILAT.auto`)
  ja kortin Paras ovat kaikki alueelliset; `MalliHila`n peittotarkistus
  ja kaavion `_natiivi` lukevat `onAlueellinen`ia; lähdenimet
  `Lahde.NIMET`/`LYHYET`issä ja varatie luettelon `lahde`sta perheelle
  jota sivu ei vielä tunne; `_haePerhe` muistaa myös puuttuvan laatan;
  asetusten mallikuvaus, kortin Paras-alarivi ("Paikan tarkin malli
  tunneittain") ja Tietoa-näkymän lähteet ja lisenssit.

### 12.2 Poikkeamat suunnitelmasta

1. **DINI:n alueeseen Islanti ja Färsaaret** (IMO on UWC-Westin jäsen).
   Avomeri vain Pohjanmeren suorakaiteessa (53–59,5 N, 2 W–9 E): koko
   avomerellä DINI olisi kirjoittanut laattoja Atlantille Irlannin ja
   Islannin väliin. Hinta: DINI:n lukuikkuna kasvoi 22 %:sta 66 %:iin
   hilasta (185 s, 23 MB).
2. **MET Nordicin alueeseen Venäjä.** Luoteis-Venäjällä (Karjala, Kuola,
   Pietari, Kaliningrad) muuta alueellista mallia ei ole, ja MET Nordic
   kattoi sen ennenkin; ilman sitä alue olisi pudonnut ECMWF:ään.
3. **Vain lukuikkuna luetaan**: rajaukseen osuvien lähdepisteiden
   indeksilaatikko (UKV 57 %, ICON-D2 31 %, AROME Itävalta 28 % hilasta).
4. **Lisenssit tarkistettiin lähteistä, eikä kaikki ole CC BY.** Met
   Officen data on **CC BY-SA 4.0** (Open-Meteon lisenssisivu): UKV:stä
   johdetut laatat jaetaan samalla lisenssillä, ja Tietoa-näkymä sanoo
   sen. Météo-France: Licence Ouverte 2.0. DWD, DMI, MeteoSwiss,
   ItaliaMeteo-ARPAE, GeoSphere Austria (aineiston sivu) ja ČHMÚ
   ("Jak mohu používat otevřená data ČHMÚ?"): CC BY 4.0.
5. **ECMWF:n l0 Eurooppaan** (ei ollut S1:ssä, ks. yllä).

### 12.3 Rakennus mitattuna (kontti, 4.10.2026 klo 20.32–20.58 UTC)

| perhe | hetkiä | laattoja | MB | aika | lukuikkuna |
|---|---|---|---|---|---|
| ALADIN CZ (`cz`) | 89 | 42 | 2,0 | 18 s | 100 % |
| ICON-CH1 (`c1`) | 56 | 181 | 7,4 | 33 s | 100 % |
| UKV (`uk`) | 74 | 267 | 13,5 | 109 s | 57 % |
| AROME HD (`ah`) | 71 | 639 | 31,5 | 160 s | 100 % |
| DINI (`dn`) | 82 | 449 | 23,0 | 185 s | 66 % |
| ICON-CH2 (`c2`) | 137 | 181 | 18,1 | 34 s | 100 % |
| ICON-D2 (`d2`) | 71 | 126 | 6,5 | 62 s | 31 % |
| ICON-2I (`it`) | 89 | 253 | 17,1 | 51 s | 81 % |
| AROME AT (`at`) | 80 | 40 | 2,5 | 37 s | 28 % |
| ALADIN CE (`ce`) | 89 | 697 | 41,6 | 116 s | 87 % |
| **yhteensä** | | **2 875** | **163,2** | **805 s** | |

Yksikään Euroopan hetki ei epäonnistunut (MET Nordicilta puuttui kuusi
menneisyyden tuntia kuten ennenkin). Koko varasto: ECMWF 452 laattaa
39,5 MB (oli 352), FMI 296 / 12,7 MB, MET Nordic 761 / 45,8 MB (oli
1 126 — käyttöalue siirsi Tanskan, Pohjois-Saksan, Puolan ja Britannian
itärannikon omille malleilleen), Eurooppa 2 875 / 163,2 MB, aallot
6,2 MB: **267 MB (oli 107)**. Rakennus 1 550 s (oli 622 s), muistihuippu
1,31 GB (oli 0,85). Työnkulun aikaraja nostettiin 45:stä 60 minuuttiin.

Luettelo kasvoi 33,9 → 114 kt, gzipattuna 5,4 → 11,2 kt. Tasojen
`ajat` toistuvat neljästi perhettä kohti, mutta gzip syö toiston, joten
muotoa ei muutettu.

### 12.4 Laatat rajapintaa vasten

Laatan 0,05°:n solmu (aluekeskiarvo) vs Open-Meteon rajapinta samassa
pisteessä (`cell_selection=nearest`), koko akseli, korrelaatio myös
tunnin siirrolla (aika-akselin tarkistus):

| piste | malli | n | harha m/s | MAE | kor 0 h | kor −1 / +1 h | suunta |
|---|---|---|---|---|---|---|---|
| Lipno (paino 0,58) | ALADIN CZ | 89 | +0,11 | 0,14 | 0,978 | 0,837 / 0,811 | 5° |
| Praha | ALADIN CZ | 89 | +0,10 | 0,16 | 0,953 | 0,762 / 0,699 | 2° |
| Brno | ALADIN CZ | 89 | −0,02 | 0,09 | 0,988 | 0,866 / 0,884 | 2° |
| Neusiedl | AROME AT | 80 | +0,12 | 0,28 | 0,931 | 0,744 / 0,736 | 10° |
| Attersee | AROME AT | 80 | +0,06 | 0,44 | 0,396 | 0,291 / 0,343 | 51° |
| Wien | AROME AT | 80 | −0,01 | 0,21 | 0,946 | 0,809 / 0,858 | 3° |
| Bregenz | AROME AT | 80 | +0,05 | 0,26 | 0,964 | 0,770 / 0,746 | 5° |
| Quiberon | AROME HD | 71 | −0,48 | 0,70 | 0,874 | 0,766 / 0,764 | 13° |
| Wissant | AROME HD | 71 | −0,07 | 0,40 | 0,934 | 0,793 / 0,888 | 7° |
| Barcelona | AROME HD | 71 | +0,33 | 0,75 | 0,642 | 0,539 / 0,525 | 13° |
| Brouwersdam | AROME HD | 71 | −0,03 | 0,40 | 0,935 | 0,899 / 0,867 | 7° |
| Hayling | UKV | 74 | −0,13 | 0,41 | 0,884 | 0,767 / 0,764 | 9° |
| Rhosneigr | UKV | 74 | −0,13 | 0,37 | 0,960 | 0,960 / 0,939 | 14° |
| Dublin | UKV | 74 | +0,11 | 0,82 | 0,638 | 0,492 / **0,668** | 16° |
| Klitmøller | DINI | 82 | −0,75 | 0,76 | 0,974 | 0,942 / 0,967 | 4° |
| Hvide Sande | DINI | 82 | +0,10 | 0,58 | 0,946 | 0,912 / **0,953** | 8° |
| Reykjavík | DINI | 82 | +0,61 | 0,70 | 0,974 | 0,913 / 0,921 | 9° |
| Sylt | ICON-D2 | 71 | +0,44 | 0,60 | 0,969 | 0,961 / 0,945 | 5° |
| Fehmarn | ICON-D2 | 71 | −0,07 | 0,30 | 0,974 | 0,957 / 0,924 | 4° |
| Garda | ICON-CH1 | 56 | −1,02 | 1,18 | 0,852 | 0,654 / 0,706 | 16° |
| Silvaplana | ICON-CH1 | 56 | −0,09 | 0,57 | 0,708 | 0,677 / 0,661 | 17° |
| Garda | ICON-CH2 | 124 | +0,60 | 0,79 | 0,609 | 0,550 / 0,512 | 24° |
| Sisilia | ICON-2I | 89 | +0,06 | 0,37 | 0,985 | 0,980 / 0,961 | 5° |
| Lefkada | ICON-2I | 89 | +0,05 | 0,20 | 0,954 | 0,889 / 0,842 | 6° |
| Hel | ALADIN CE | 89 | −0,81 | 0,84 | 0,959 | 0,929 / 0,946 | 5° |
| Balaton | ALADIN CE | 89 | +0,21 | 0,47 | 0,596 | 0,470 / 0,521 | 10° |
| Bol | ALADIN CE | 89 | +0,33 | 0,63 | 0,871 | 0,832 / 0,801 | 17° |
| Mamaia | ALADIN CE | 89 | +0,04 | 0,35 | 0,734 | 0,613 / 0,681 | 6° |

**Aika-akseli on oikein**: viive 0 h on paras tai tasoissa 26 pisteessä
28:sta; kaksi poikkeusta (Dublin, Hvide Sande) ovat rantasolmuja, joissa
keskiarvo ja lähin solu tulevat eri pinnalta, ja ero on 0,007–0,030.
Tiedostonimi on voimassaoloaika, ja solun suora vertailu (luku 3.2)
täsmäsi. **Harha on suurin rannoilla ja järvillä**: Garda −1,02 m/s,
Hel −0,81, Klitmøller −0,75, Reykjavík +0,61, Attersee suunta 51°.
0,05°:n solmu on 1–25 lähdesolun keskiarvo, ja rannalla se sekoittaa
vettä ja maata — juuri tämä on V2:n (natiivihila lähizoomissa ja spotin
natiivisarja) peruste, ei vika tässä vaiheessa.

### 12.5 Selaimessa

Tuotantobuild (`vite preview`), paikallinen varasto reititettynä
molempiin koteihin, service worker estetty, työpöytä, zoom 10;
`malliKohdassa` kartan keskellä ja lähdemerkinnän teksti:

| piste | kartalla | merkintä (fi) |
|---|---|---|
| Helsinki | FMI 100 % | Ilmatieteen laitos · HARMONIE 2,5 km · ajo 4.10. klo 18:00 |
| Göteborg | MET Nordic 100 % | MET Norway · MET Nordic 1 km (Yr) |
| Quiberon, Mallorca | AROME HD 100 % | Météo-France · AROME 1,3 km |
| Hayling | UKV 100 % | Met Office · UKV 2 km |
| Klitmøller, Reykjavík | DINI 100 % | DMI · HARMONIE DINI 2 km |
| Sylt | AROME 51 %, ICON-D2 34 %, DINI 15 % | AROME 1,3 km → ICON-D2 2,2 km (raja-alue) |
| Garda | ICON-CH1 100 % | MeteoSwiss · ICON-CH1 1 km |
| Sisilia | ICON-2I 100 % | ItaliaMeteo · ICON-2I 2,2 km |
| Neusiedl | AROME AT 100 % | GeoSphere Austria · AROME 2,5 km |
| Lipno | ALADIN CZ 58 %, ICON-CH1 42 % | ALADIN 1 km → ICON-CH1 1 km (raja-alue) |
| Hel | ALADIN CE 100 % | ČHMÚ · ALADIN 2,3 km |
| Tarifa | ECMWF 0,25° (aukko) | ECMWF IFS 0,25° · esilaskettu |

Englanniksi samat nimet desimaalipisteellä ("AROME 1.3 km → ICON-D2
2.2 km (blend zone) · run 4 Oct 18:00"). Sivuvirheitä 0, puuttuvia
laattapyyntöjä 0. Hilan 80 × 50 kokoaminen 2,8–7,6 ms (suurin raja-
alueella, jossa kolme perhettä sekoittuu). Aikajanan sarja (`Paras`,
kaikki alueelliset): Quiberon AROME → ECMWF; Garda ICON-CH1 → AROME →
ICON-CH2 → ECMWF; Klitmøller DINI → ECMWF; Lauttasaari MET Nordic →
FMI → ECMWF 9 km kuten ennen. Savutesti ja graafitesti läpi tuotannon
NYKYISTÄ varastoa vasten: ilman luettelon `perheet`-kenttää asiakas
käyttää omaa listaansa, eli uusi sivu toimii myös ennen ensimmäistä
uutta rakennusta.

### 12.6 Actionsissa (Säädata #186, 5.10.2026 klo 04.57–05.25 UTC)

Ensimmäinen V1-rakennus Actionsissa: rakennusaskel 1 635 s (27 min
15 s; kontissa 26 min), koko työ 28 min, 4 342 laattaa, raaka 497 MB,
gzip **260 MB**. ECMWF 97/97 hetkeä, FMI 70 hetkeä, MET Nordic 97/102
(viisi menneisyyden tuntia puuttui S3:sta kuten ennenkin). Euroopan
perheet:

| perhe | hetkiä | laattoja | MB | aika |
|---|---|---|---|---|
| ALADIN CZ | — | — | — | **pois** |
| ICON-CH1 | 56/56 | 181 | 7,4 | 36 s |
| UKV | 74/74 | 267 | 13,8 | 112 s |
| AROME HD | 71/71 | 639 | 31,9 | 165 s |
| DINI | 79/79 | 449 | 22,4 | 178 s |
| ICON-CH2 | 140/140 | 181 | 18,7 | 38 s |
| ICON-D2 | 71/71 | 126 | 6,6 | 65 s |
| ICON-2I | 92/92 | 253 | 17,7 | 55 s |
| AROME AT | 80/80 | 40 | 2,5 | 39 s |
| ALADIN CE | 92/92 | 697 | 43,2 | 128 s |

**ALADIN CZ jäi pois yhteysvirheeseen**: sen ensimmäinen haku
(`latest.json`) kaatui 8 ms MET Nordicin viimeisen luvun jälkeen pelkkään
"fetch failed" -viestiin, ja muut kymmenen perhettä onnistuivat samassa
ajossa. Välitön kaatuminen on yhteysvirhe eikä puuttuva tiedosto
(luultavimmin palvelimen jo sulkema keep-alive-yhteys). Korjaus:
`alueelliset.mjs`:n `haeJson` uusii verkkovirheen ja aikarajan kahdesti
(1 s ja 3 s), HTTP-vastausta (404 = ajoa ei ole) ei, ja virheviestiin
kirjoitetaan syy (`e.cause.code`). Tarkistettu: ALADIN CZ:n akseli
0,74 s (116 hetkeä), olematon malli kaatuu 404:ään 85 ms:ssa ilman
uusintaa. Lukujen omat uusinnat (`OmHttpBackend`, `retries: 2`) olivat
jo olemassa.

Julkaistussa luettelossa järjestys (`perheet`) ja l0:n Eurooppa
(160 laattaa) olivat oikein. GitHub Pagesin julkaisu kaatui 404:ään
("Ensure GitHub Pages has been enabled") kuten ennenkin
(`continue-on-error`): Pages ei ole päällä, ja sovellus lukee varaston
`raw.githubusercontent.com`:sta.

**Säädata #187 (V2-rakentaja, 5.10. klo 05.40–06.02 UTC):** kaikki
kaksitoista alueellista perhettä mukana, ALADIN CZ 92/92 h (42 laattaa,
2,0 MB, 16 s). Rakennusaskel 1 242 s (20 min 42 s), 4 384 laattaa, raaka
506 MB, gzip **264 MB**. Luettelossa tasojen `natiivi` (MET Nordic,
ALADIN CZ, ICON-CH1 ja AROME HD 0,01°; AROME AT 0,025°; muut 0,02°;
FMI:llä ja ECMWF:llä ei kenttää).

### 12.7 Mitä jäi

- **Lähizoomin natiivihila ja spotin natiivisarja (V2)** — toteutettu,
  luku 13.
- **Vanha sivu välimuistissa** ei tunne Euroopan perheitä: niiden
  alueella se näyttää ECMWF:ää, ja Tanskassa, Pohjois-Saksassa ja
  Puolassa myös MET Nordicin tilalla (MET Nordicin paino rajattiin
  käyttöalueeseen). Korjautuu kun sivu päivittyy.
- **Kortin vertailuvalikossa ei ole Euroopan malleja**, koska spotit ovat
  Suomessa (V5). Paras sisältää ne jo.
- **Menneisyys on Euroopassa 24 h** (P2): aikajanan 24–48 h takaperin on
  ECMWF:ää.
- **Aukot** (Tarifa, Lissabon, Egeanmeri, Mustameri, Kanariansaaret) ovat
  ECMWF:ää kuten ennen (V7).

---

## 13. Toteutus (V2, 5.10.2026): lähizoomin natiivihila ja spotin natiivisarja

Pyynnön toinen puolisko: *"kun spotin säädatoja katsoo, automaattisesti
on valittu paras ja tihein verkko sille spotille, jotta paikalliset erot
rannan lähettyvillä näkyvät lähelle zoomattuna."* V1:n varasto on
0,05°:n solmuina 3–6 km, ja luvun 12.4 suurimmat harhat olivat rannoilla
ja järvillä (Garda −1,02 m/s, Hel −0,81, Klitmøller −0,75): solmu on
mallin solujen keskiarvo ja sekoittaa vettä ja maata.

### 13.1 Rakenne

- **Palvelin** (`api/malli.js`, ei uutta funktiota — 12/12): jokainen
  `ALUEELLISET`-taulukon perhe on oma mallinsa, hila ja projektio
  samasta taulukosta kuin rakentajalla (`hilanIndeksi` = käänteinen
  projektio murtoindeksiksi; ikkuna rajauksen reunoilta näytteistettynä,
  koska Lambert-hilan rivit ovat kaarevia).
  - kenttä `?malli=<perhe>&t=&s=&n=&w=&e=&askel=` — askel vähintään
    0,01°, enintään 250 × 250 solmua; ajotiedostosta (`data_spatial`),
    tuoreimmasta ajosta joka kattaa tunnin
  - sarja `?tila=sarja&malli=<perhe>&askel=&lat=&lng=&alku=&loppu=` —
    solmuruudun neljä kulmaa aikasarjavarastosta (`data/`), sarjan
    pituus `sarjaTunnit`
  - nopeus/suunta-mallit (`kentat: 'sd'`: UKV, DINI, ICON-2I, AROME AT,
    ALADIN, MET Nordic) käännetään vektoreiksi (`uv`), ja UKV:n kahdesta
    samannimisestä lapsesta luetaan jälkimmäinen kuten rakentajassa.
- **Rakentaja** kirjoittaa luettelon tasoille `natiivi` = perheen pienin
  askel (ALADIN CZ, ICON-CH1, AROME HD, MET Nordic 0,01°; UKV, DINI,
  ICON-CH2, ICON-D2, ICON-2I, ALADIN CE 0,02°; AROME AT 0,025°).
  Asiakas kytkee natiivihilan vain perheille joilla kenttä on: vanha
  luettelo = ei pyyntöjä.
- **Asiakas** (`Natiivi`): zoomista 10 (Leaflet-asteikko, P4) kartan
  pysähtyessä valitulle TASATUNNILLE haetaan näkymän perheet (sama
  `malliKohdassa` kuin lähdemerkinnällä, 5 × 5 pistettä, enintään kolme
  suurimman osuuden perhettä), kenttä näkymän 0,6:n pehmusteella
  (`MalliHila._alue`, sama kuin ECMWF 9 km:llä) ja 10 askeleeseen
  pyöristettynä (sama osoite naapurinäkymille = CDN-osuma).
  Aikajana saa kartan keskipisteen solmuruudun sarjan samalla askeleella.
  Askel 0,025° (z10), 0,02° (z11), 0,01° (z12+), mutta ei mallin omaa
  tarkkuutta tiheämmin.
- **Yksi sekoitussääntö** (`Saalaatat._natNayte` `naytteista`ssa):
  perheen ARVO tulee natiivihilasta, PAINO varaston laatasta. Järjestys,
  käyttöalueet ja rajojen pehmennys pysyvät siis samoina, ja natiivihila
  on saman sekoituksen tarkempi näyte. Kentän pehmusteen reunassa
  (8 %) arvo liukuu varaston arvoon, ettei panoroitaessa näy saumaa.
- **Solmuväli** (`ViewportGrid.solmuStep`) tihenee natiivihilan mukana
  lämpökartassa ja kapselin/partikkelien hilassa (sama hila, O3), mutta
  varaston taso valitaan yhä `laattaStep`illä.
- **Kortti** (`KorttiSarjat` Paras): ensin varaston sekoitus, ja sen
  tunneittaisista lähteistä (`hourly.lahde`) ne perheet joilla on
  natiivihila haetaan spotin omasta solusta mallin hienoimmalla
  askeleella (`Natiivi.pisteenSarjat`); FMI- ja MET Nordic -vertailu
  samoin.

### 13.2 Poikkeamat suunnitelmasta (S2–S3)

1. **Ei `malli=paras`-sekoitusta palvelimella.** Palvelin palauttaa
   yhden perheen oman hilan, ja sekoitus tehdään asiakkaassa. Syyt:
   (a) yksi sekoitussääntö (`naytteista`) — palvelimen oma olisi toinen,
   ja ne ajautuisivat erilleen; (b) paino tarvitsee käyttöalueen
   maarasterin ja datan reunan ensimmäisen hetken NaN-maskista, jotka
   rakentaja on jo laskenut laattoihin — palvelin joutuisi laskemaan ne
   joka kutsulla; (c) välimuistiavain on perheen ja näkymän, ei koko
   sekoituksen.
2. **Askel ei ole aina 0,01°**: zoomin mukaan 0,025 / 0,02 / 0,01°, ja
   mallin oma tarkkuus on alaraja (2 km:n mallia ei näytteistetä
   0,01°:een).
3. **Vain tasatunnit ja levossa.** Kartta käyttää natiivikenttää vain
   sille tunnille jolle se haettiin; vartit, toiston välihetket ja
   raahaus ovat varastoa kuten ECMWF 9 km:llä (`MalliHila`).
4. **MET Nordic sai natiivihilan** (1 km, Pohjoismaat ja Baltia), vaikka
   S2 puhui Euroopan malleista: Suomen spottien kortin menneet tunnit
   tulevat nyt spotin omasta solusta.

### 13.3 Mitattu (5.10.2026 klo 05.30–05.45 UTC)

**Palvelin suoraan** (`api/malli.js` kontissa, kenttä 3 h päähän):

| malli | paikka | kenttä | askel | kesto | koko | sarja 73 h |
|---|---|---|---|---|---|---|
| AROME HD | Quiberon | 46 × 28 | 0,01° | 1,97 s | 5,5 kt | 1,32 s |
| UKV | Hayling | 24 × 14 | 0,02° | 1,75 s | 1,6 kt | 1,03 s |
| DINI | Klitmøller | 21 × 16 | 0,02° | 1,44 s | 1,6 kt | 1,14 s |
| MET Nordic | Göteborg | 51 × 31 | 0,01° | 1,43 s | 6,6 kt | 1,06 s |
| ICON-CH1 | Garda | 41 × 36 | 0,01° | 1,21 s | 6,2 kt | 1,06 s |

**Kenttä ja sarja ovat sama data**: samoissa neljässä solmussa hetkillä
−3, +2, +12 ja +24 h (AROME HD, UKV, DINI, MET Nordic, ICON-D2, ALADIN
CE) suurin ero on 0,10 m/s ja 1° — kvantisoinnin puolikas (0,2 m/s ja
2°). Kenttä tulee ajotiedostosta ja sarja aikasarjavarastosta, joten
aikajana ja kartta näyttävät saman luvun.

**Selaimessa** (tuotantobuild, paikallinen varasto, pohjakartta
reititettynä, kartan keskellä, 81 näkymän pistettä natiivi vs varasto):

| paikka | zoom | perhe | solmuja | kenttä | sarja | natiivi − varasto mediaani / suurin | aikajana: suurin ero varastoon (403 h) |
|---|---|---|---|---|---|---|---|
| Quiberon | 12 | AROME HD 0,01° | 6 771 | 1,6 s | 0,99 s | 0,17 / −1,42 m/s | 2,03 m/s |
| Klitmøller | 11 | DINI 0,02° | 4 551 | 1,4 s | 1,32 s | 0,36 / +1,72 m/s | 1,25 m/s |
| Garda | 12 | ICON-CH1 0,01° | 6 161 | 1,2 s | 1,01 s | 0,30 / +3,58 m/s | 4,95 m/s |

Solmuväli tiheni 0,05 → 0,01° (Quiberon, Garda) ja 0,02° (Klitmøller)
sekä lämpökartassa että kapselin ja partikkelien hilassa. Kolmeen
paikkaan 18 natiivipyyntöä, sivuvirheitä 0. Gardan pohjoispään
tuulikanava (ICON-CH1 1 km) näkyy natiivihilassa ja puuttuu varastosta:
kapseli samassa kohdassa 6,2 kts natiivina, 4,3 kts varastona.

**Kortti, Lauttasaari** (Paras lähteittäin ECMWF 9 km → MET Nordic →
FMI → ECMWF 9 km): MET Nordicin 40 menneen tunnin arvot tulevat nyt
spotin omasta 1 km solusta — ero varaston 0,05°:n sekoitukseen
keskimäärin 0,15 m/s, enintään 1,01 m/s. FMI-tunnit eivät muuttuneet
(FMI:llä ei ole natiivihilaa). Yksi natiivisarjan pyyntö spottia kohti.

Savutesti läpi (puhelin 18,0 s, työpöytä 11,2 s, virheitä 0) ja
graafitesti 96/96.

**Tuotannon varastoa vasten** (Säädata #187, sama sivu tuotantobuildina,
natiivihila paikallisesta `api/malli.js`:stä, 5.10. klo 06.20–06.30
UTC): luettelon perheet ja natiiviaskeleet luettiin oikein, ja kuudessa
paikassa kenttä, aikajanan sarja ja tihennetty solmuväli olivat valmiit
2,8–4,0 s kartan siirrosta:

| paikka | zoom | kartalla keskellä | natiivihila | kenttä |
|---|---|---|---|---|
| Quiberon | 12 | AROME HD 100 % | 0,01° | 1,6 s |
| Garda | 12 | ICON-CH1 100 % | 0,01° | 1,3 s |
| Lipno | 11 | ALADIN CZ 58 %, ICON-CH1 42 % | 0,02° | 1,5 s |
| Göteborg | 12 | MET Nordic 100 % | 0,01° | 1,2 s |
| Hayling | 11 | UKV 100 % | 0,02° | 1,7 s |
| Hel | 11 | ALADIN CE 100 % | 0,02° | 1,8 s |

Natiivipyyntöjä 27, kaikki 200, sivuvirheitä 0; kortti (Lauttasaari)
38 MET Nordicin tuntia spotin omasta solusta. Gardassa (z11, oikea
pohjakartta) kapseli samassa kohdassa 10,9 kts natiivina ja 7,3 kts
varastona, ja järven tuulikanava näkyy vain natiivihilassa. Kontrolli
vanhalla (V1) luettelolla: 0 natiivipyyntöä, sivu kuten V1.

**Korjattu mittauksessa: yhdistetty sarjahaku kuului ensimmäiselle
kutsujalle.** `Natiivi._sarja` yhdisti samanaikaiset pyynnöt, mutta haku
oli sidottu kutsujan keskeytykseen: kun uusi kierros (`_hae`, kartan
liike tai tunnin vaihto) keskeytti edellisen kesken sarjan haun, perässä
tullut kierros sai saman keskeytetyn lupauksen ja tyhjän sarjan, eikä
sarjaa haettu uudelleen ennen seuraavaa liikettä. Toistettu viivästetyllä
vastauksella (kenttä tuli, sarja ei 15 s:ssa); korjattuna sarja tuli
1,1 s toisen kierroksen jälkeen. Nyt yhdistetyllä haulla on oma
aikarajansa, ja kutsuja vain jättää tuloksen käyttämättä jos se itse on
keskeytetty (kuten `MalliHila.pisteenSarja`ssa jo oli).

Tuotannon funktiota ei voitu kutsua kontista: `wind-delta.vercel.app`
vastasi 5.10. `DEPLOYMENT_NOT_FOUND` (Vercel, `x-vercel-error`), vaikka
commitin tuotantodeploy oli valmis, ja deployn omat osoitteet vaativat
Vercel-kirjautumisen. Funktion paketin sisältö tarkistettiin Vercelin
omalla jäljittimellä (`@vercel/nft`): `tools/alueelliset.mjs`,
`tools/pyramidi.mjs` ja `tools/maat.json` ovat mukana.

### 13.4 Hinta

- **Pyynnöt:** lähizoomissa kartan pysähtyessä enintään kolme kenttää
  ja keskipisteen sarjat; kenttä on pyöristetty 10 askeleeseen ja sarja
  solmuruutuun, ja vastaus on CDN:ssä 30 min (`s-maxage=1800`), joten
  saman alueen käyttäjät osuvat välimuistiin. Käynnistyksessä
  `esilataaSpotit` hakee jokaisen spotin natiivisarjan (Suomessa MET
  Nordic, 12 pyyntöä samaan aikaan kuin ECMWF 9 km -sarjat); osoite
  riippuu vain solmuruudusta ja varaston akselista, eli se on sama
  kaikille saman rakennuksen ajan.
- **Palvelimen aika:** 1,2–2,0 s kenttää ja 1,0–1,3 s sarjaa kohti
  kontissa, ja siitä suurin osa on S3-lukua; funktion CPU-aikaa ei
  mitattu.
- **Selaimen hila:** solmuja lähizoomissa 4 551–6 771 (yllä) eli samaa
  luokkaa kuin V1:n mittauksen 80 × 50 = 4 000 solmun hila (2,8–7,6 ms,
  luku 12.5); natiivihilan kokoamisaikaa ei mitattu erikseen.

### 13.5 Mitä jäi

- **Natiivihila on voimassa Säädata #187:stä** (5.10., luettelon
  `natiivi`); sivu joka saa vanhan luettelon toimii kuten V1.
- **Tuotanto-osoite** (`wind-delta.vercel.app`) on tarkistettava Vercelin
  projektin Domains-asetuksista (yllä).
- **Natiivihila ei kata vartteja eikä toistoa**: liikkuva kartta on
  varastoa, ja pysähtynyt tasatunti tarkentuu 1–2 s:ssa.
- **Varmennus** (S8, V4) ratkaisee, kumpi on oikeammin spotin kohdalla:
  natiivisolu vai varaston keskiarvo. Rannoilla natiivisolu on joko
  meri- tai maasolu, ja varmennuksen on kerrottava kumpi vastaa
  havaintoa — tämä on mitattava eikä oletettava.

---

## 14. Toteutus (V3, 5.10.2026): Euroopan havainnot (MeteoGate E-SOH)

Euroopan sääpalvelujen asemat ovat kartalla, asemakortissa,
spottikortin asemavalitsimessa ja vapaan pisteen kortissa samalla
koneistolla kuin Suomen asemat. Lähde on EUMETNETin MeteoGate E-SOH
(luku 4.1, CC BY 4.0, ei avainta).

### 14.1 Rakenne

**Palvelin: tilat olemassa olevassa funktiossa** (12 funktion katto).
`api/_esoh.js` on apumoduuli, ja `api/fmi.js` sai kaksi tilaa:

- `?eu=laatta&x=<0..89>&y=<0..44>` — laatta 4° × 4°. Kolme hakua
  rinnakkain: `/locations?bbox` (asemat ja nimet, muistissa
  vuorokauden), `/area` viimeiset 24 h (tuuliparametrit) ja oman
  varaston päivätiedostot jaksolle 48–24 h sitten. Vastaus: asemat
  (`id` = WIGOS, `nimi`, `lat`, `lng`, `tagi`, `maa`, `tahti`), 49
  tasatunnin näytettä (`ws`, `wg`, `wd`) ja tuorein rivi `v`. CDN 5 min
  (+ SWR 10 min), tyhjä laatta (avomeri) 15 min, ylävirran virhe 502 ja
  `no-store` (O5).
- `?eu=sarja&id=<WIGOS>&lat&lng&hours=<1..168>` — asemakortin sarja:
  `locations/{id}` 24 h täydellä tarkkuudella ja varaston tunnit sitä
  vanhemmat. Muoto on `api/fmi.js`:n historian (`{ws:[{t,v,d,iso}],
  wg, ta}`) + `latest`, `lampomittari` ja `tahtiMin`, joten
  `_renderLiveHistory` piirtää sen ilman omaa haaraa.

**Rekisteri: kolmas osa, datana.** Suomen rekisteri
(`FMI_MAP_STATIONS` + `PAIKALLISASEMAT`) on ennallaan (S5), ja E-SOH:n
kopiot sen asemista (`0-246-0-<FMISID>`) jätetään laatasta pois — muuten
Harmaja olisi kartalla kahdesti. Asiakkaan `EuAsemat` pitää ladatut
laatat ja antaa niiden asemat rekisterin muodossa (`lahde: 'eu'`), ja
`_fmiStationsSorted` lukee kaikki kolme. Spottikortin asemavalitsin,
asemakortin naapurit ja vapaan pisteen kortti näkevät siis Euroopan
asemat ilman omaa polkuaan.

**Kartta.** `_addObsMarkers`in Eurooppa-lohko luo merkit näkymän
(+ 25 % reunus) laattojen asemista, vain päällä oleville kerroksille,
ja poistaa ne kun näkymä siirtyy. Zoomista 8 rannikkoasemat (lukema
z8:sta kuten meriasemilla) ja zoomista 9 sisämaan asemat (lukema z10:stä)
kun "sisämaa"-kerros on päällä. Pilleri, sijoittelu
(`_sijoitteleHavainnot`), aikajana (`_histValueAt`) ja istunnon aikainen
päivitys (`_havPaivittajat`) ovat samat kuin FMI:n asemilla.

**Kortti.** `_openObsSheet('eu')` kulkee FMI:n polkua (`_havHaeSarja`
`lahde: 'eu'`). Otsikkorivillä on maa käyttöliittymän kielellä
(`Intl.DisplayNames`) ja välittäjä ("Tuulihavainto · Ranska ·
EUMETNET E-SOH"): kansallinen laitos ei kulje vastauksessa
(WMO-numeroidun aseman julkaisija on 20000), joten sitä ei arvata.
Alarivillä lähde ja lisenssi, ja Tietoa-näkymässä lähdemerkintä.

**Historia.** `tools/esoh.mjs` on Havainnot-työnkulun askel: tasatunnit
jotka ovat 3–24 h vanhoja ja puuttuvat varastosta, vanhin ensin, yksi
koko Euroopan kysely tuntia kohti, tallennus
`esoh/<UTC-päivä>/<x>_<y>.json` (`{ wigos: { "HH": [ws, wg, wd] } }`),
säilytys 8 vrk. Väliin jäänyt ajo ei jätä aukkoa niin kauan kuin jokin
ajo osuu vuorokauden sisään.

**Kerroskytkimet** olivat "FMI · Meri" ja "FMI · Maa"; nyt "Tuuliasemat ·
rannikko" ja "Tuuliasemat · sisämaa", koska ne ohjaavat myös Euroopan
asemia. Avaimet (`fmi-sea`, `fmi-land`) ovat ennallaan, joten tallennetut
valinnat säilyvät, ja sisämaa on yhä oletuksena pois.

### 14.2 Päätökset ja poikkeamat suunnitelmasta (S5)

- **OpenWindMap EI OLE MUKANA — LISENSSI ON PÄÄTETTÄVÄ ENSIN.**
  Community Licensen jakamisehto ("Sharing clause") vaatii, että KAIKKI
  muu sovellukseen integroitu anturidata on avointa: julkista,
  maksutonta, uudelleenkäytettävää myös kaupallisesti, heikentämätöntä ja
  viivästämätöntä, ja arkisto saatavilla. FMI, E-SOH ja UiRaS täyttävät
  sen, mutta Mellstenin (Surfing ry) ja Larun (dlarah.org) ehtoja ei ole
  julkaistu. Vaihtoehdot: lähteiden ehtojen selvitys, Extended License
  (sopimus), tai OpenWindMap pois. Mitattu tekninen osa (747 asemaa,
  `live/all`, 4 min arkisto) on luvussa 4.3.
- **Kansalliset 10 min lähteet eivät ole V3:ssa.** E-SOH kattaa kaikki
  maat yhdellä rajapinnalla; Hollanti (14) ja Tanska (7) ovat ohuita
  (luku 4.1), ja niiden kansalliset rajapinnat ovat seuraava askel.
- **Laatta eikä koko rekisteri selaimeen.** Koko Euroopan rekisteri
  olisi 170 kB (noin 55 kB pakattuna) jokaiselle käyttäjälle, ja
  `/locations` on lähteessä 4,5 MB ja 6,9 s. Laatta tuo nimet mukanaan,
  ja puhelin hakee käynnistyksessä nolla laattaa (zoom 7,2 < 8).
- **Rannikko maarasterista** (`tools/maat.json`, 0,05°): merta 3 km:n
  sisällä = `Meri`. Säde kalibroitiin Suomen käsin tagattua rekisteriä
  vasten: 3 km antaa 20/21 asemalle saman meri/maa-luokan (ainoa ero
  Kaisaniemi, 2,8 km rasterin merestä), 5 km 19/21 (myös Tapiola).
  Euroopassa 564 rannikkoasemaa 3 428:sta. `Avomeri`-tagia ei anneta:
  rasterin solmuväli tekisi satamasta "avomeren". Lentoasema tunnistetaan
  nimestä (`Lento`).
- **Kartalle tunnin näyte, ei 10 min sarjaa.** Pilleri lukee valitun
  tunnin (`_histValueAt`, lähin hetki tunnin sisällä) ja tuoreen lukeman
  erikseen; 10 min sarja olisi kuusinkertainen eikä näkyisi kartalla.
  Näyte on rivi välillä [H − 10 min, H + 5 min], lähinnä H:ta
  (tuntiasemat raportoivat tasatunnilla: 1 847 / 1 866 hetkeä).
- **Tuoreus kuten FMI:llä (90 min), mutta harva asema ei ole "ei
  signaalia".** Kolmen tunnin synop-asema olisi muuten katkoviivalla
  kaksi tuntia kolmesta. Lukeman ollessa 90 min – max(3 h, 1,5 × tahti)
  vanha pilleri on "—" (ei lukemaa tälle tunnille), vasta sen jälkeen
  "ei signaalia".
- **Sama asema kahdella tunnuksella.** Luettelossa on 170 tuuliasemaparia
  alle kilometrin päässä toisistaan, joista 146 alle 50 m: Met Office
  julkaisee aseman sekä WMO-numerolla (tunneittain) että omalla
  tunnuksellaan (10 min). Laatassa alle 100 m:n päässä toisistaan
  olevista jää se jonka lukema on tuorein. Satojen metrien päässä olevat
  ovat eri mittareita (tiesääasema ja synop) ja jäävät.
- **Kelvoton arvo on puuttuva.** Ranskalaisen aseman
  `air_temperature:2.0:point:PT10M` oli koko vuorokauden −273 °C (0 K),
  ja kortti näytti sen. Rajojen ulkopuolinen arvo (tuuli 0–75 m/s, suunta
  0–360°, lämpö −80…60 °C) pudotetaan jäsennyksessä, jolloin seuraava
  parametri voittaa.
- **Tuulen parametri on yksi koko sarjalle; puuska, suunta ja lämpö
  täydentyvät hetkittäin.** Tuuleksi etusijalta ensimmäinen jolla on
  vähintään puolet suurimmasta määrästä: "eniten arvoja" valitsi Suomen
  asemalle vuorokaudessa kahden minuutin keskiarvon (142 vs 141 arvoa) ja
  keräimen tunnin ikkunassa kymmenen minuutin. Puuska on 10 min puuska
  kuten FMI:llä ja tunnin puuska vain kun sitä ei ole: DWD:n
  tuntiasemalla tunnin puuska puuttuu synop-tunneilta (16 / 24), ja
  tahdin mukainen järjestys antoi keräimelle ja proxylle eri puuskan.
- **Kaavion katkosääntö mukautuu E-SOH:n sarjoissa** (`_havKatko`,
  `mukautuvaKatko`): tuntiasemalla kiinteä 30 min katkaisi jokaisen
  välin, ja kortin kaaviossa oli pelkkiä irtopisteitä. Katko on väli joka
  on yli 30 min ja yli 2,5 × naapurivälien suurempi. Suomen lähteiden
  sääntö on ennallaan.
- **Julkaisu siirtää vain muutoksen.** Havainnot-työnkulku poisti
  kloonin `.git`in ja lähetti koko haaran joka ajolla; nyt orpo committi
  tehdään kloonin päälle (`julkaisu:havainnot`). Mitattu paikallisesti:
  yhden tiedoston muutos 2,86 MiB → 584 tavua. Kolme polkua testattu
  paikallista paljasta repoa vasten (ei haaraa, muutos ja lisäys,
  poisto): haarassa aina yksi committi.

### 14.3 Mitattu (5.10.2026)

**Rajapinta.** Laatta 4° × 4° ja 24 h: 0,2–1,2 s ja 0,1–0,9 MB; koko
Euroopan yksi hetki 3,5 s, 7 MB, 2 993 asemaa. Tyhjä alue ja asema ilman
dataa 404, tuntematon parametri 400 ("Unknown parameter-name"), yli
vuorokauden vanha jakso 404, koko maailman monikulmio 500.

**Proxy.** Laatta 0,7–2,9 s (kylmä instanssi ja maarasterin luku
mukana), 18–33 kB, pakattuna 3,1–4,5 kB; asemakortin sarja 4–17 kB.

**Keräin.** 10 tuntia 33–38 s:ssa, 2 289–2 984 asemaa tunnissa; 10 tuntia
on 99 laattatiedostoa ja 581 kB, eli noin 1,4 MB vuorokaudessa ja 11 MB
kahdeksassa.

**Actionsissa** (Havainnot-ajo 37300880952, ajastinketjun lenkki,
5.10. klo 11.27 UTC, ensimmäinen ajo uudella työnkululla): "Euroopan
havainnot" 97 s kymmenelle tunnille, eli GitHubin koneelta noin 10 s
tuntia kohti (kontista 3,5 s) — aikabudjetti 150 s ja askeleen katto
4 min riittävät. Julkaisu 1,4 s. Haarassa yksi committi, Mellsten
2,3 MB ja Laru 1,2 MB ennallaan, `esoh/` 808 kB (99 laattaa, 2 971
asemaa), ja proxy lukee tiedostot raw-osoitteesta (200).

**Varasto proxya vasten** (sama tunti molemmista, 9 laattaa): ennen
korjauksia 96,4 % identtisiä, puuskan järjestyksen jälkeen 98,1 %,
tuulen parametrin säännön jälkeen **99,6 %** (2 287 tuntia). Loput ovat
Met Officen jälkikäteen korjaamia rivejä.

**Selaimessa** (tuotantobuild, Chromium, E-SOH oikea):

| tilanne | tulos |
|---|---|
| käynnistys Helsingissä, työpöytä (z 9,3) | 2 laattaa, 2 Euroopan merkkiä (Inkoo Jakobramsjö, Pakri); rekisterin asemat eivät kahdennu |
| käynnistys puhelimella (z 7,2, `hasTouch`) | ei yhtään Euroopan pyyntöä |
| Bretagne z9 | 11 rannikkoasemaa (puhelimella 6), lukemia 6, "ei signaalia" 4; sijoittelu 4–5 ms |
| sama, merkit koko laatalle (ennen rajausta) | 22 merkkiä, puolet näkymän ulkopuolella |
| Benelux z8, sisämaa päällä | ennen 571 merkkiä (DOM 633), nyt 0 sisämaan + 9 rannikon |
| Benelux z9, sisämaa päällä | 26 merkkiä, sijoittelu 3 ms |
| asemakortti (Ouessant Stiff) | otsikko, "Tuulihavainto · Ranska · EUMETNET E-SOH", lukema, 24 h kaavio, CC BY 4.0 |
| aikajana 5 h sitten | 6 / 11 pilleriä historian lukemalla (loput tuntiasemia ilman sitä tuntia) |
| aikajana 30 h sitten | "—" kaikissa (varasto vielä tyhjä; täyttyy keräimen ajoista) |
| vapaa piste Quiberonin edustalla | lähin asema Belle Ile Le Talut 21,9 km, kaavio |
| zoom 7 | Euroopan merkit pois |
| englanniksi | kaikki uudet tekstit, desimaalipiste |

Savutesti ja graafimittaus läpi; sivuvirheitä 0.

### 14.4 Mitä jäi

- **OpenWindMap** (lisenssipäätös, 14.2), kansalliset 10 min lähteet
  (DE, NL, DK, CH, AT, BE, SE, PL), Météo-France 6 min (avain, P6) ja
  Holfuy (sopimus).
- **Järvet ovat maata.** Gardan, Silvaplanan ja Neusiedlin asemat ovat
  "sisämaa"-kerroksessa (oletuksena pois) ja lukema tulee z10:stä.
  Järvirasteri (Natural Earth lakes) maarasterin rinnalle korjaisi sen.
- **Suomen rekisterin ulkopuoliset asemat** tulevat E-SOH:sta
  englanninkielisin tarkentein ("Jomala Maarianhamina airport") ja
  vuorokauden historialla; FMI:n oma rajapinta antaisi niille suomenkielisen
  nimen ja 7 vrk.
- **Varasto täyttyy ajoista.** Aikajanan 24–48 h ja kortin yli
  vuorokauden tunnit tulevat vasta kun keräin on ajanut; ensimmäinen ajo
  hakee kymmenen tuntia ja loput seuraavat.
- **Varmennus E-SOH:ta vasten** (V4) ja spottien laajennus Eurooppaan
  (V5): spottikortin lähin asema Euroopassa toimii jo vapaassa pisteessä.


## 15. Toteutus (5.10.2026): Euroopan asemat kaukaa ja spotit Euroopassa

Pyyntö (5.10.): *"Lisätään nyt kaikille lisätyille datapisteille
samanlainen näkymä kuin Helsingin ympärillä olevilla tuulipisteillä
havaintoasemilla. Ja myös spoteille samanlainen näkymä, mikäli niitä
lisätään myöhemmin karttaan."*

### 15.1 Mikä erosi

Suomen asemat näkyvät jokaisella zoomilla: lukeman zoomin alla
(`LUKEMA_Z_MERI` 8, `_MAA` 10) harmaana pisteenä (`_kaukoPallo`, alle z7
4 px ja .6, muuten 5 px ja .9), sen jälkeen pillerinä. Euroopan asemat
(luku 14) syntyivät DOM-merkeiksi vasta zoomista 8 (rannikko) tai 9
(sisämaa) ja vain näkymän laatoista, eli kaukaa niitä ei ollut kartalla
lainkaan — Suomen naapureissa kartta näytti tyhjältä siellä missä
asemia on eniten.

### 15.2 Rakenne

- **Luettelo keräimestä.** Kaukopisteisiin tarvitaan vain sijainti ja
  kerros, mutta laatat (48 h tunnit) ovat raskaita: Euroopan näkymä z4:llä
  olisi ~150 laattapyyntöä, ja koko Euroopan `/locations` on lähteessä
  4,4 MB ja 12,5 s (mitattu). Keräin (`tools/esoh.mjs`) näkee joka ajolla
  koko Euroopan, joten se kirjoittaa `havainnot`-haaraan
  `esoh/asemat.json`: `{ wigos: [lat, lng, meri, UTC-päivä] }`, rannikko
  samasta maarasterista kuin laatan tagi (`asemanTiedot`), päivä eikä
  tunti, jotta tiedosto muuttuu kerran päivässä eikä joka ajolla. Yli
  neljä päivää näkymättömät poistuvat.
- **`/api/fmi?eu=asemat`** (tila olemassa olevassa funktiossa, ei uusi
  reitti): luettelo ilman Suomen rekisterin kopioita, kahta päivää
  vanhempia ja saman aseman toista tunnusta (alle 100 m, sama sääntö
  kuin `kahdennuksetPois`, ruudukolla). `[[wigos, lat, lng, meri], …]`,
  CDN 30 min + vanha kelpaa vuorokauden; puuttuva tiedosto on tyhjä
  luettelo (5 min), ei virhe.
- **Kartalla GL-pisteinä** (`eu-asemapisteet`, MapLibren circle-kerros,
  GL-pinon ylin): DOM-merkki maksaa siirron joka ruudussa, ja asemia on
  yli 3 000. Ulkoasu on `_kaukoPallo`n (koko, peittävyys z7:n porras,
  väri ja hiusreuna `--asema-piste`-tokeneista `Teema`n kautta).
  Suodatin: kerroskytkimet (`fmi-sea` / `fmi-land`) ja **ei asemaa jolla on
  oma merkki** (`_euMerkit`): piste väistyy kun DOM-merkki syntyy ja
  palaa kun se poistuu, joten lukeman zoomissa laatan latauksen aikana
  piste ei katoa tyhjään. Napautus 12 px:n säteellä (piste on 4–5 px)
  lentää aseman lukeman zoomiin kuten DOM-pisteen `zoomaaAlle`;
  DOM-merkin napautus ei kuulu tänne. Työpöydällä kursori on osoitin
  pisteen päällä.
- **Spotit.** Merkki, kortti, Paras-sekoitus, lähin asema ja reittiohje
  ovat jo spotista riippumattomia, joten Euroopan spotti saa saman näkymän
  kun se lisätään `SPOTS`iin (`descEn` ja suunnat dataan). Yksi kohta ei
  skaalautunut: `KorttiSarjat.esilataaSpotit` laski käynnistyksessä
  KAIKKIEN spottien Paras-sarjat (laatat ja kaksi palvelinkutsua per
  spotti). Nyt jono on näkymä ja sen ympäristö (näkymän verran joka
  suuntaan tai 300 km, `ESI_KM`), lähin ensin, ja kartan pysähtyminen
  täydentää sen (`esilataaAjasta`). Suomen 12 spottia ovat toistensa
  300 km:n sisällä, joten niillä mikään ei muutu.

### 15.3 Mitattu (5.10.2026, paikallinen varasto ja tuotantobuild)

| | |
|---|---|
| keräimen ajo (10 tuntia) | 138,6 s, luettelossa 3 281 asemaa (546 rannikolla), 139 kB |
| `?eu=asemat` | 3 116 asemaa (503 rannikolla, 131 Suomen rekisterin ulkopuolista FMI-asemaa), 114 kB JSON, 22 ms |
| puhelin Eurooppa z4 | 352 rannikkopistettä, sisämaan kytkimellä 2 589 |
| Bretagne z8 | 10 DOM-merkkiä, piste ja merkki samalle asemalle 0 kertaa |
| pisteen napautus z6 (Saksan rannikko) | lento z8:aan, keskipiste aseman kohdalla (0,00 km) |
| kerrosjärjestys | pisteet GL-pinon päällimmäisinä (partikkelien päällä) |

Savutesti ja graafimittaus läpi, sivuvirheitä 0.

### 15.4 Mitä jäi

- **Hiljainen asema kaukaa.** Suomen pisteellä on hiljaisen aseman
  himmeämpi asu; luettelo kertoo vain päivän, joten Euroopan piste on
  aina tavallinen ja hiljaisuus näkyy vasta merkissä (lukeman zoomissa).
- **Ensimmäinen ajo.** Luettelo syntyy ensimmäisestä keräimen ajosta
  tämän muutoksen jälkeen; siihen asti `?eu=asemat` on tyhjä ja kaukaa ei
  näy pisteitä (lähempää merkit kuten ennen).
- **Spottimerkit ovat DOMia** ja ne luodaan kaikille spoteille. Kymmenillä
  spoteilla se on kevyt; jos spotteja tulee satoja, merkit kannattaa luoda
  näkymän mukaan kuten Euroopan asemamerkit.

---

## Lähteet

Mitattu suoraan: Open-Meteon S3-peili (`openmeteo.s3.amazonaws.com`,
`data_spatial/` ja `data/`), Open-Meteon lähdekoodi
(github.com/open-meteo/open-meteo, `Sources/App/*/…Domain.swift`,
`Sources/App/Domains/*Projection*.swift`), Open-Meteon rajapinta,
MeteoGate E-SOH, OpenWindMap, AEMET, MeteoGalician THREDDS, Overpass.

Verkkolähteet:
[Open-Meteo: uudet KNMI-, DMI- ja Met Office -mallit](https://openmeteo.substack.com/p/new-meteofrance-wave-models-and-knmi-dmi-uk-metoffice-models) ·
[UWC-West / Met Éireann](https://www.met.ie/new-met-eireann-weather-and-climate-supercomputer-becomes-operational-in-unique-collaboration-with-three-other-national-meteorological-services) ·
[KNMI HARMONIE open data](https://english.knmidata.nl/open-data/harmonie) ·
[Open-Meteo CHMI](https://open-meteo.com/en/docs/chmi-api) ·
[Open-Meteo GeoSphere](https://open-meteo.com/en/docs/geosphere-austria-api) ·
[Open-Meteo ItaliaMeteo](https://open-meteo.com/en/docs/italia-meteo-arpae-api) ·
[MeteoSwiss ICON-CH1/2](https://opendatadocs.meteoswiss.ch/e-forecast-data/e2-e3-numerical-weather-forecasting-model) ·
[AEMET HARMONIE (MITECO-luettelo)](https://catalogo.datosabiertos.miteco.gob.es/catalogo/en/dataset/46e25cfb-d421-425e-8077-1cd7063793a9/resource/9ba745ed-6d3f-4812-9784-11ebafad3dea) ·
[IPMA data](https://mf2.ipma.pt/downloads/data/) ·
[MeteoGalicia THREDDS](https://thredds.meteogalicia.gal/) ·
[Météo-France AROME-PI](https://www.data.gouv.fr/dataservices/api-modele-arome-prevision-immediate) ·
[Météo-France models on AWS](https://mf-models-on-aws.org/en/doc/datasets/v1/) ·
[MeteoGate](https://eumetnet.github.io/meteogate-documentation/2-discovering-and-accessing-data/) ·
[Open Radar Data](https://eumetnet.github.io/openradardata-documentation/2-ORD-API-discovering-and-accessing-data/) ·
[MeteoAlarm](https://feeds.meteoalarm.org/) ·
[Météo-France observations API](https://www.data.gouv.fr/dataservices/api-donnees-dobservation) ·
[DWD 10 min wind](https://opendata.dwd.de/climate_environment/CDC/observations_germany/climate/10_minutes/wind/DESCRIPTION_obsgermany_climate_10min_wind_en.pdf) ·
[KNMI Open Data API](https://developer.dataplatform.knmi.nl/open-data-api) ·
[DMI open data](https://github.com/LasseRegin/dmi-open-data) ·
[SMHI metobs](https://opendata.smhi.se/metobs/introduction) ·
[Frost](https://frost.met.no/howto.html) ·
[MeteoSwiss AWS](https://opendatadocs.meteoswiss.ch/a-data-groundbased/a1-automatic-weather-stations) ·
[GeoSphere TAWES](https://dataset.api.hub.geosphere.at/v1/docs/getting-started.html) ·
[RMI AWS](https://opendata.meteo.be/documentation/?dataset=aws) ·
[IMGW](https://danepubliczne.imgw.pl/apiinfo) ·
[AEMET OpenData](https://opendata.aemet.es/centrodedescargas/productosAEMET) ·
[Met Office Land Observations](https://datahub.metoffice.gov.uk/pricing/observations) ·
[Pioupiou licensing](http://developers.pioupiou.fr/data-licensing/) ·
[Holfuy API](https://api.holfuy.com/live/) · [Holfuy ehdot](https://holfuy.com/en/terms/) ·
[FFVL open data](https://www.data.gouv.fr/datasets/reseau-de-balises-et-donnees-meteo-de-la-ffvl) ·
[EMODnet Physics](https://emodnet.ec.europa.eu/en/emodnet-physics-portal) ·
[Rijkswaterstaat](https://rijkswaterstaat.github.io/wm-ws-dl/) ·
[Puertos del Estado](https://portus.puertos.es/Portus/html/info/infotr.html) ·
[CCO API](https://coastalmonitoring.org/ccoresources/api/) ·
[SHOM](https://diffusion.shom.fr/services-numeriques/api-shom.html) ·
[Kartverket](https://vannstand.kartverket.no/tideapi_en.html) ·
[UKHO Tidal API](https://admiraltyapi.portal.azure-api.net/products/uk-tidal-api) ·
[EOT20](https://www.seanoe.org/data/00683/79489/) ·
[Copernicus Marine ARCO](https://github.com/hypertidy/cmemsarco) ·
[winds.mobi](https://github.com/winds-mobi/winds-mobi-providers) ·
[OpenWind](https://github.com/Guillaumeperrottet/openwind) ·
[varun.surf](https://github.com/pwittchen/varun.surf) ·
[kitesurfing-aihe GitHubissa](https://github.com/topics/kitesurfing) ·
[Windguru-opas 2026](https://www.glissevolution.com/en/blog/news-1/2026-guide-using-windguru-for-kite-and-wing-570) ·
[YBW: paras UK-malli](https://forums.ybw.com/threads/best-uk-weather-model.584185/) ·
[Windy community: merituuli](https://community.windy.com/topic/11785/sea-breeze-prediction-which-is-the-best-model-to-use) ·
[windsurfing.nl: beste windvoorspeller](https://forum.windsurfing.nl/viewtopic.php?t=7459) ·
[Ridersguide](https://ridersguide.nl/haal-meer-uit-de-windvoorspellingen/) ·
[oaseforum: Windguru vs Windfinder](https://oaseforum.de/archive/index.php/t-83928.html) ·
[GardaWind](https://garda-wind.vercel.app/) · [xkite Garda](https://www.xkite.it/en/weather-info/) ·
[Tarifa: Windguru-opas](https://en.kitefuntarifa.com/blog/wind-forecast-tarifa-how-to-read-windguru.html) ·
[Meltemi](https://sailarmada.com/meltemi-wind-greece/) ·
[GitHub Pages limits](https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits) ·
[Vercel limits](https://vercel.com/docs/functions/limitations) ·
[Cloudflare R2](https://nubbo.app/blog/cloudflare-r2-free-tier/)
