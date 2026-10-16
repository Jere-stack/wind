# Aallot koko maailmaan ja vuorovesi (strategia 14.10., toteutus 15.10.)

Käyttäjän pyyntö: aaltonäkymä koko maailmaan parhaan mahdollisen datan
mukaan, ja jos hyödyllistä, samoista lähteistä vuorovesi kartoille —
erillinen näkymä ehdotetaan jos sellainen tarvitaan. Näkymän on oltava
yhtä sulava kuin koko maailman tuulen lämpökartta: tarvitaanko
esilatausta, ja miten varmistetaan että data on oikeassa kohdassa
karttaa eikä näy mantereen päällä.

Luvut 1–13 ovat strategia sellaisena kuin se päätettiin 14.10. (silloin
mitään ei ollut koodattu); **toteutus on luvussa 14** (15.10., kaikki
vaiheet V1–V8 suosituksen mukaan). Strategian luvut on mitattu
14.10.2026 lähteistä itsestään (Open-Meteon S3-peili, Copernicus
Marinen ARCO-varastot, FMI:n, NOAA:n, Irlannin Marine Instituten ja
Kartverketin rajapinnat, Esrin pohjakarttalaatat, Natural Earth 1:10m)
ja tuotantobuildista selaimessa. Mittarit ovat scratchpadissa
(`skriptit/hilat.mjs`, `cmems.py`, `siirto.py`, `maski.py`,
`mallisarjat.mjs`, `cmems_sarjat.py`, `tilastot.py`, `vuorovesi.py`,
`nws_vv.py`, `ranta.py`, `koko.py`, `aaltokerros.mjs`), eivät repossa.

## 1. Tiivistelmä

- **Paras globaali aaltomalli on ECMWF WAM 9 km**, ja se on jo samassa
  peilissä ja samassa muodossa kuin kartan tuuli
  (`data_spatial/ecmwf_wam`, O1280-hila kuten `ecmwf_ifs`): neljä ajoa
  vuorokaudessa, 00/12Z +360 h (tunneittain +90 h:iin), CC BY 4.0.
  Poijuja vasten (25 poijua, 6 vrk) se oli paras tai lähes paras
  jokaisella alueella: RMSE Itämerellä 0,18 m, Havaijilla 0,21,
  Yhdysvaltain länsirannikolla 0,19, itärannikolla 0,19 ja Irlannissa
  0,30 m. Météo-Francen MFWAM 1/12° on yhtä hyvä avomerellä mutta
  Itämerellä 0,19 m liian matala, ja NOAA:n GFS-Wave pettää saarten
  tuntumassa (Havaiji 0,92 m).
- **Rannikolla tarkemmat alueelliset mallit ovat avoimesti saatavilla**
  Copernicus Marinesta: Itämeri (FMI:n WAM, ≈ 1,5–1,9 km, ~9 vrk),
  Luoteis-Eurooppa 1,5 km, Biskaja–Iberia ≈ 3 km, Välimeri 4,2 km,
  Mustameri 2,5 km. ARCO-Zarr-varastot vastaavat ilman tunnistautumista,
  ja lisenssi sallii johdetut laatat myös kaupallisesti
  lähdemerkinnällä. Niillä lähin märkä solmu on spoteista 0,2–3,7 km,
  ECMWF 9 km:llä 1,6–13 km. **Itämeren tuote yltää kaikkiin 12 Suomen
  spottiin 0,2–1,7 km:n päästä** (nykyisen FMI WAM -hilan maskin sisällä
  on kolme, joille kortti hakee lähimmän märän solmun) ja ulottuu noin
  9 vrk eteenpäin (nyt 66 h).
- **"Oikea kohta kartalla" ei ole itsestäänselvyys.** Open-Meteon
  `meteofrance_wave`- ja `meteofrance_currents`-tiedostojen metatieto
  sijoittaa hilan puoli solua väärin (≈ 4,6 km pohjoiseen, 60°N:ssä
  2,3 km itään): taulukko on tavulleen sama kuin Copernicuksen
  alkuperäisessä (MAE 0,005 m), mutta mallin kuiva/märkä-raja osuu
  rantaviivaan vain alkuperäisillä koordinaateilla. ECMWF:n, DWD:n ja
  NOAA:n hilat ovat oikein. Georeferointi luetaan siksi lähteen omasta
  määrittelystä, ja rakentaja testaa jokaisen perheen rantaviivaa
  vasten.
- **Mantereen päällä ei näy aaltoja**, kun ranta piirretään
  pohjakartalla kuten nyt (`Rantamaski`): Esrin tumma pohja on sama väri
  koko maailmassa (vesi 36,0 ja maa 71,7 jokaisella 16 mitatulla
  alueella), joten kynnys toimii kaikkialla. Mutta 9 km:n mallilla
  **20–54 % näkyvästä rannikkovedestä on yli 4 km päässä mallin
  lähimmästä märästä solmusta**, eli nykyinen 4 km:n ekstrapolointi
  jättäisi rannoille aukkoja; 12 km kattaa 92–100 %. Matka tulee mallin
  tarkkuudesta, se lasketaan rakentajassa, ja kauempana kenttä häipyy
  eikä keksi avomeren aaltoa lahden perukoille.
- **Nykyinen aaltokerros ei skaalaudu maailmaan.** Se kokoaa solmuhilan
  pääsäikeessä jokaisella tunnin vaihdolla (mitattu 3–41 ms Suomessa,
  noin 0,8 µs solmulta), sillä ei ole tasojen sekoitusta, aikapaloja,
  esilatausta, odotusta eikä häivytystä, `Aallot.varmista` hylkää yli
  60 laatan näkymän, eikä tavukoodaus mahdu maailmaan: Hs 0,03 m:n
  askelin katkeaa 7,62 m:iin, ja mitattuna 0,8 % merisolmuista ylittää
  sen (maksimi 12–15 m).
- **Suositus: aallot samaan koneistoon kuin tuuli, omana kenttänään.**
  Perheet ja painokanava (Copernicuksen alueelliset ECMWF 9 km:n
  päällä), aikapalat, näyttötarkkuuden taso ja tasojen sekoitus,
  solmubudjetti, odotus, häivytys ja koko akselin taustaesilataus — ja
  lisäksi aika interpoloidaan GPU:lla, jolloin toisto ja raahaus eivät
  kokoa mitään saman aika-askeleen sisällä. Lähizoomissa ECMWF 9 km
  palvelimelta kuten tuulella (`MalliHila`).
- **Esilataus: kyllä, sama kuin tuulella**, ja se on halpa: näkymän koko
  akseli on mitatusta datasta laskettuna 0,2–1,7 MB. Ilman sitä
  jokainen aikapalan raja olisi tyhjä hetki.
- **Vuorovesi on hyödyllinen Atlantilla, Kanaalissa, Pohjanmerellä ja
  valtamerien rannoilla — ei Itämerellä.** Asemien omat harmoniset
  ennusteet osuvat havaintoon 3–15 cm:n tarkkuudella. Globaali malli
  (FES2014 1/12°, sama data kuin Open-Meteon `sea_level_height_msl`)
  on avorannikolla 7–19 cm ja 30–60 min etuajassa, mutta lahdissa ja
  vuonoissa se pettää (Seattle 2,1 m ja 3 h, New York 0,41 m, Anchorage
  1,3 m). Suositus: ensin spottikortti ja kapseli parhaasta lähteestä
  (asema > alueellinen malli > globaali malli varauksin); kartalle
  **erillinen "Vuorovesi"-näkymä (beta)**, joka lasketaan harmonisista
  vakioista GPU:lla — aika on silloin ilmainen eikä vuorovettä tarvitse
  rakentaa joka päivä.

## 2. Periaatteet

- **P-a. Sama koneisto, eri kenttä.** Aallot saavat kaiken minkä tuuli
  on jo mitannut toimivaksi (luku 6.1), mutta omana kenttänään omalla
  luettelon avaimellaan. CLAUDE.md:n sääntö pysyy: aalto ei kulje
  tuulen `naytteista`n kautta eikä tuulen perhelistoissa.
- **P-b. Paikka lähteestä, ei metatiedosta.** Solmun koordinaatit
  luetaan alkuperäisen tuottajan määrittelystä, ja rakentaja todistaa
  ne rantaviivaa vasten joka ajolla (luku 5.2).
- **P-c. Ranta on pohjakartan ranta, ja ekstrapolointi on rehellinen.**
  Kenttä jatketaan maan puolelle vain mallin tarkkuuden verran, ja
  kauempana se häipyy. Kortti ja kapseli sanovat etäisyyden mallin
  solmuun kun se on yli kilometrin, kuten nyt.
- **P-d. Paras saatavilla paikan ja hetken mukaan.** Perheet
  painokanavalla tihein ensin, ja järjestys vahvistetaan jatkuvalla
  varmennuksella poijuja vasten (kuten tuulen O11).
- **P-e. Aika ei maksa pääsäiettä.** Toisto ja raahaus interpoloivat
  kahden aika-askeleen välillä varjostimessa; uusi hila kootaan vain
  askeleen rajalla.
- **P-f. Vuorovesi vain siellä missä sitä on, ja lähde sanotaan.**
  Itämerellä on vedenkorkeus (FMI), ei vuorovettä — kaksi eri asiaa.
- **P-g. Infra pysyy.** 12/12 funktiota (uudet reitit tiloina), ei
  kiintiöllisiä rajapintoja selaimesta (Open-Meteon marine-API hylättiin
  aikanaan juuri kiintiön takia), Pages + Actions.

## 3. Nykytila mitattuna

### 3.1 Data

FMI WAM hilana (`tools/wam.mjs`, docs/data.md "Aallot kartalle"):
1967 × 800, ≈ 1 × 2 km, Itämeri, ajohetki +6 … +66 h. Tasot a0 0,02°
(Suomen rannikko), a1 0,05°, a2 0,1° ja a3 0,25°, yhteensä 5,6 MB ja 73
tuntia. Laatat ovat kokonaisia (ei aikapaloja), luettelon oma avain
`aallot` (versio 1), yksi malli. Muualla maailmassa aaltoja ei ole, ja
Kate sanoo sen ("Aaltomalli (FMI WAM) kattaa Itämeren").

### 3.2 Kartta

- `AaltoGL._varmistaHila` kokoaa näkymän pehmustetun alueen (0,5)
  solmuhilan pääsäikeessä `Aallot.nayte`lla jokaiseen solmuun, ja
  ekstrapoloi maan puolelle 1–4 kierrosta naapurien keskiarvolla
  (≈ 4 km). Uusi hila jokaisella hetken vaihdolla, raahauksessa 60 ms:n
  kuristuksella.
- Taso valitaan zoomista portaittain (`Aallot.askelZoomille`: z9+ 0,02°,
  z8 0,05°, z7 0,1°, muuten 0,25°) — ilman tuulen tasojen sekoitusta,
  eli rajan yli kenttä vaihtuu kerralla (sama "hyppy" jonka tuuli
  korjasi 6.10.).
- `Rantamaski` lataa Esrin tumman pohjan laatat näkymän ympäriltä
  kankaalle, lukee ne `getImageData`lla ja kynnystää (vesi ≤ 48, maa
  ≥ 60). Pyöristetyllä zoomilla 256 px:n laatoin, enintään 4096² px.
  Retinalla pohjakartta on yhtä tasoa tarkempi (`POHJA_LAATTA` 128), eli
  maski on puolet näkyvän rannan tarkkuudesta.
- Aallonharjat lasketaan suorittimella joka ruudussa (60–700 kaarta).

### 3.3 Hinta

Tuotantobuild, `vite preview`, Chromium + SwiftShader, tunnin askel
kymmenen kertaa (`_tlValitseIdx`), `AaltoGL._varmistaHila` ja
`LampoGL._rakenna` mitattu kääreellä joka säilyttää `this`in:

| laite, näkymä | aallot: solmuja | aallot: kokoaminen mediaani / max | tuuli: solmuja | tuuli: mediaani / max |
|---|---|---|---|---|
| puhelin Helsinki z10 | 3 300 | 3,4 / 6,0 ms | 899 | 0,1 / 0,2 ms |
| puhelin Helsinki z9 | 12 753 | 9,8 / 17,0 ms | 3 021 | 0,1 / 0,3 ms |
| puhelin Suomenlahti z7 | 8 265 | 5,6 / 6,5 ms | 15 309 | 12,7 / 39,3 ms |
| työpöytä Helsinki z10 | 12 736 | 10,9 / 21,1 ms | 3 069 | 0,1 / 0,9 ms |
| työpöytä Helsinki z9 | 49 625 | 40,9 / 64,8 ms | 10 860 | 0,3 / 0,4 ms |
| työpöytä Suomenlahti z7 | 32 219 | 13,8 / 15,6 ms | 13 467 | 7,1 / 14,6 ms |

Aaltohila maksaa noin 0,8 µs datasolmulta, ja solmuja on lähizoomissa
nelinkertaisesti tuuleen nähden (0,02°:n taso z9:stä, ei solmubudjettia).
Tuulen hila on lähizoomissa pieni (0,05°:n taso, 900–3 000 solmua) ja
tulee usein kokoamismuistista (`_kooste`). Itämeren koko näkymä
z3,5:llä kokosi aalloille 381 × 346 = 132 000 solmun hilan.

### 3.4 Mikä estää maailman

1. **Yksi malli, yksi alue.** Ei perheitä, ei painokanavaa, ei aikarajojen
   pehmennystä.
2. **Kokonaiset laatat.** 15 vuorokauden globaali akseli kokonaisina
   laattoina olisi jokaiselle näkymälle koko akseli kerralla.
3. **Rajat:** `Aallot.varmista` palauttaa nollan kun näkymä vaatisi yli
   60 laattaa, ja hila hylätään yli 400 000 solmulla.
4. **Pääsäie joka tunnilla** (luku 3.3) ilman solmubudjettia.
5. **Ei odotusta, häivytystä eikä esilatausta:** puuttuva laatta on
   hetken tyhjä alue, ja hetken vaihto on kova leikkaus.
6. **Ekstrapolointi 4 km**, kun globaalin mallin solmut ovat 9 km välein
   (luku 5.4).
7. **Koodaus ja asteikko:** Hs 0,03 m × 254 = 7,62 m, ja värirampin LUT
   päättyy 5,1 m:iin. Mitattuna ECMWF 9 km:n kentässä 4,6 % merisolmuista
   on yli 5,1 m ja 0,8 % yli 7,62 m (maksimi 12,6–13,2 m; MFWAM 14,7 m).

### 3.5 Mitä tuulen lämpökartalla on ja aalloilta puuttuu

| mekanismi | tuuli (`LampoGL`, `Saalaatat`) | aallot (`AaltoGL`, `Aallot`) |
|---|---|---|
| perheet + painokanava | 13 perhettä, reunat 50 km smoothstep | yksi malli |
| aikapalat | 24 askelta, yhden askeleen päällekkäisyys | kokonaiset laatat |
| näyttötarkkuuden taso | `laattaStep`, solmuväli ~5 px | porrastus zoomista |
| tasojen sekoitus | oma + karkea hila, `karkeaPaino` | ei |
| solmubudjetti | 24 000 (puhelin), toistossa 9 000 | ei (400 000 katto) |
| kokoamismuisti | `_kooste` | ei |
| odotus | `_odottava`, hypyssä 0,4 s | ei |
| häivytys | `Haivytys` 0,45 s | ei |
| esilataus | koko akseli näkymälle (`AikaEsilataus`) | ei (laatat kokonaisia) |
| lähizoom | ECMWF 9 km palvelimelta z8+ | 0,02° taso Suomen rannikolla |
| tähtäimen lukema | `Tahtain` (paikan ja hetken, ei zoomin) | hienoin taso (`Aallot.arvo(…, 0)`) |

## 4. Aaltodata maailmalle — lähteet mitattuna

### 4.1 Ehdokkaat

| malli | hila | alue | jakso ja askel | ajot | lähde, lisenssi |
|---|---|---|---|---|---|
| **ECMWF WAM 9 km** | O1280 (6,6 M pistettä) | maapallo | 00/12Z +360 h, 06/18Z +144 h; 1 h → +90 h, 3 h → +144 h, 6 h | 4/vrk | Open-Meteo S3 `ecmwf_wam`, CC BY 4.0 |
| ECMWF WAM 0,25° | 721 × 1440 | maapallo | +144 h, 3 h | 4/vrk | Open-Meteo S3 `ecmwf_wam025` |
| MFWAM (Météo-France) | 1/12° (2041 × 4320) | maapallo 80 S – 90 N | −21 … +240 h, 3 h | 2/vrk | S3 `meteofrance_wave` tai Copernicus GLO |
| GFS-Wave (NOAA) | 0,25° ja 0,167° (15 S – 52,5 N) | maapallo | +384 h; 1 h → +120 h | 4/vrk | S3 `ncep_gfswave025/016`, julkinen |
| DWD GWAM | 0,25° | 85 S – 89 N | +174 h, 3 h | 2/vrk | S3 `dwd_gwam` |
| DWD EWAM | 0,05° × 0,1° | Eurooppa 30–66 N, 10,5 W – 42 E | +78 h, 1 h | 2/vrk | S3 `dwd_ewam` |
| Copernicus BAL (FMI WAM) | 0,0167° × 0,0278° | Itämeri | ~+9 vrk, 1 h | | ARCO, Copernicus Marine |
| Copernicus NWS (Met Office WW3) | 0,0135° × 0,0303° (1,5 km) | 46–62,7 N, 16 W – 13 E | ~+6 vrk, 1 h | | ARCO |
| Copernicus IBI (Météo-France MFWAM) | 0,0278° | 26–56 N, 19 W – 5 E | ~+8 vrk, 1 h | | ARCO |
| Copernicus MED (HCMR MEDWAM4) | 0,0417° (4,2 km) | Välimeri | ~+9 vrk, 1 h | | ARCO |
| Copernicus BLK (Hereon WAM) | 0,025° | Mustameri | ~+9 vrk, 1 h | | ARCO |
| Copernicus ARC (MET Norway WAM) | 3 km | arktinen | ~+5 vrk, 1 h | | ARCO (ei mitattu) |

Tiedostojen koot: ECMWF WAM 9 km on 8,2 MB hetkeltä (neljä muuttujaa),
ajo 1,19 GB; MFWAM 26 MB hetkeltä (12 muuttujaa), ajo 2,27 GB.
Copernicuksen aallonkorkeus koko alueelta (blosc-lz4), tunnilta: NWS
857 kt, IBI 400 kt, Itämeri ~520 kt, MED ~310 kt, BLK ~240 kt (palassa
1–6 tuntia), GLO 4,2 MB kolmen tunnin askeleelta. Open-Meteon peili
pitää ajoja 7–8 vuorokautta. Copernicuksen alueellisten ajotiheyttä ei
mitattu; jakso on tämän päivän luettelosta.

### 4.2 Etäisyys rantaan

Sama mittari jolla ECMWF 0,25° hylättiin Suomessa (docs/data.md): lähin
märkä solmu 49 spotista (13 sovelluksen spottia, 16 Euroopan ja 20
maailman wingfoil-spottia, joista neljä on järvellä tai joessa).
Spottien määrä etäisyyden sisällä (≤ 2,5 / 5 / 10 / 20 km):

| malli | spotteja | ≤ 2,5 | ≤ 5 | ≤ 10 | ≤ 20 km |
|---|---|---|---|---|---|
| ECMWF 0,25° | 49 | 2 | 5 | 16 | 35 |
| GFS-Wave 0,25° | 49 | 1 | 5 | 18 | 37 |
| GFS-Wave 0,167° | 49 | 0 | 3 | 10 | 21 |
| DWD GWAM 0,25° | 49 | 1 | 7 | 25 | 41 |
| MFWAM 1/12° (oikea kohdistus) | 49 | 9 | 26 | 37 | 45 |
| **ECMWF 9 km** | 49 | 5 | 21 | **43** | 45 |
| DWD EWAM | 30 (alueella) | 5 | 17 | 28 | 28 |
| Copernicus BAL | 14 | 14 | 14 | 14 | 14 |
| Copernicus NWS | 6 (merellä) | 6 | 6 | 6 | 6 |
| Copernicus IBI | 9 | 7 | 8 | 9 | 9 |
| Copernicus MED | 7 (merellä) | 2 | 7 | 7 | 7 |

Valikoituja spotteja (km lähimpään märkään solmuun):

| spotti | ECMWF 0,25° | ECMWF 9 km | MFWAM | EWAM | paras alueellinen |
|---|---|---|---|---|---|
| Lauttasaari | 18,3 | 5,6 | 2,4 | 6,3 | BAL 1,2 |
| Haukilahti | 17,3 | 10,4 | 2,1 | 6,2 | BAL 1,7 (FMI WAM -hilassa maskin sisällä) |
| Hanko Tulliniemi | 8,9 | 5,6 | 1,5 | 2,8 | BAL 1,4 |
| Pampus (IJmeer) | 58,8 | 44,9 | 40,5 | **2,7** | — (vain EWAM) |
| Quiberon | 8,0 | 4,7 | 3,0 | 4,7 | NWS 0,3 |
| Klitmøller | 15,2 | 7,2 | 14,1 | 5,6 | NWS 0,3 |
| Sylt | 10,8 | 5,6 | 2,4 | 0,8 | NWS 0,3 |
| Tarifa | 11,3 | 7,4 | 11,3 | 4,3 | IBI 0,8 |
| Bol | 28,4 | 13,0 | 9,9 | 7,3 | MED 2,2 |
| Maui Kanaha | 12,7 | 9,4 | 11,4 | — | — |
| Kapkaupunki Big Bay | 19,6 | 9,1 | 12,3 | — | — |
| Mui Ne | 22,1 | 3,2 | 13,1 | — | — |
| La Ventana | 22,8 | 4,0 | 15,2 | — | — |
| San Francisco Crissy | 19,9 | 5,4 | 5,2 | — | — |
| Garda, Silvaplana, Hood River | > 99 | > 99 | > 99 | > 99 | — |

ECMWF 9 km on 0,25°:n hilaan nähden toinen tuote: CLAUDE.md:n "AALLOT
EIVÄT TULE LAATTAPUTKESTA" koskee 0,25°:ta (3/12 Suomen spottia), ja se
pätee yhä.

### 4.3 Osuvuus poijuja vasten

Aallonkorkeus 8.–14.10.2026 tuntikeskiarvoina: FMI:n kuusi aaltopoijua
(Itämeri), NOAA NDBC:n 15 poijua (Havaiji, Yhdysvaltain länsi- ja
itärannikko) ja Irlannin neljä M-poijua. Malli lähimmästä märästä
solmusta Open-Meteon aikasarjavarastosta (`data/<malli>/wave_height`,
tuorein ajo joka tunnille eli 0–6 h ennuste) ja Copernicuksen
geoChunked-varastosta. RMSE m / harha m / SI / korrelaatio (poijuja):

| alue | ECMWF 9 km | ECMWF 0,25° | MFWAM | GFS-Wave 0,25° | GWAM | EWAM | Copernicus alueellinen |
|---|---|---|---|---|---|---|---|
| Itämeri (6) | **0,18** / −0,02 / 0,15 / 0,93 | 0,31 / +0,05 | 0,33 / −0,19 | 0,34 / −0,21 | 0,31 / +0,07 | 0,22 / −0,01 | BAL **0,16** / −0,04 / 0,14 / 0,93 |
| Havaiji (3) | **0,21** / +0,09 / 0,12 / 0,91 | 0,32 / +0,07 | 0,29 / −0,01 | 0,92 / −0,78 | 0,59 / +0,36 | — | — |
| USA länsi (6) | **0,19** / +0,06 / 0,09 / 0,95 | 0,24 / +0,08 | **0,19** / −0,05 | 0,38 / −0,26 | 0,38 / −0,14 | — | — |
| USA itä (6) | **0,19** / +0,03 / 0,18 / 0,91 | 0,19 / −0,02 | 0,24 / −0,06 | **0,19** / −0,03 | 0,21 / −0,04 | — | — |
| Irlanti (4) | 0,30 / −0,05 / 0,11 / 0,92 | 0,30 / −0,06 | **0,28** / −0,07 | 0,38 / −0,04 | 0,38 / −0,04 | 0,36 / −0,08 | NWS 0,33 / +0,12, IBI 0,34 / −0,15 |

Varaukset: kuusi vuorokautta yhtä vuodenaikaa; poijut ovat enimmäkseen
avomerellä, joten alueellisten mallien varsinainen etu — rannikon
suojaisuus, lahdet, matalikot — ei näy tässä otoksessa (Irlannissa
NWS ja IBI eivät voittaneet avomerellä). Lähtökohdat eivät ole täysin
samat: MFWAMin ajo alkaa 21 h ennen ajohetkeä, joten sen menneet tunnit
ovat ajon omaa jälkiajoa, kun ECMWF:n ja GFS:n luku on 0–6 h ennustetta.
Järjestys ratkaistaan jatkuvasta varmennuksesta, ei tästä otoksesta
(luku 10, V8).

### 4.4 Järvet

ECMWF 9 km kattaa Suuret järvet (2–3 km), Kaspianmeren, Victorian ja
Laatokan; MFWAM Suuret järvet, Kaspianmeren ja Laatokan. Vänern,
IJsselmeer, Balaton, Garda ja Titicaca eivät ole kummassakaan.
IJsselmeerin (Pampus) kattaa vain DWD EWAM. Alppien järvet eivät ole
missään aaltomallissa.

### 4.5 Copernicus Marine: pääsy ja ehdot

- **Pääsy:** STAC-luettelo (`stac.marine.copernicus.eu`) antaa jokaisen
  tuotteen ARCO-osoitteet; `timeChunked.zarr` (palassa 1–6 aika-askelta
  koko alueelta tai sen osalta — kartta) ja `geoChunked.zarr` (palat
  [~3 700 h, 16, 16] — pisteen sarja). Molemmat vastaavat HTTPS:llä
  ilman tunnistautumista (`.zmetadata` ja datapalat 200). Pakkaus
  blosc-lz4, joten luku tehdään rakentajassa (Node-moduuli tai Python),
  ei selaimessa.
- **Ehdot:** maksuton, maailmanlaajuinen, pysyvä; johdetut tuotteet
  (laatat) saa jakaa mihin tahansa käyttöön, myös kaupalliseen, kun
  lähdemerkintä "Generated using E.U. Copernicus Marine Service
  Information" on näkyvillä (Tietoa-näkymä). Rekisteröityminen
  (maksuton) on palvelun ehto; tunnus Actionsin salaisuudeksi siltä
  varalta että anonyymi pääsy suljetaan.
- **Versiot vaihtuvat:** tuoteversio on osoitteessa (`_202411`,
  `_202511`; Itämeren `_202611` on jo luettelossa). Rakentaja lukee
  osoitteen STAC:sta joka ajolla eikä kovakoodaa sitä.

### 4.6 Suunta ja jakso

- ECMWF WAM:n `wave_direction` on MISTÄ, kuten tuulen, poijun ja FMI
  WAM:n suunta: NOAA:n kuutta poijua vasten mediaaniero 7–31°,
  käänteisellä tulkinnalla 149–174°.
- Jakso: ECMWF antaa keski- (`wave_period`) ja huippujakson
  (`wave_peak_period`), Copernicus useita (VTM02, VTM10, VTPK). Nykyinen
  FMI WAM:n `WavePeriod` on kokonaisina sekunteina. Kumpi näytetään on
  päätös P9; maksimi mitattuna 22–24 s.

### 4.7 Johtopäätös: perheet ja järjestys

Tihein natiivihila ensin, käyttöalue rajaa päällekkäiset (kuten tuulen
`tools/alueelliset.mjs`):

| # | perhe | hila | alue | jakso | rooli |
|---|---|---|---|---|---|
| 1 | FMI WAM (Copernicus BAL) | ≈ 1,5–1,9 km | Itämeri | ~9 vrk | Suomi ja Itämeri; nykyinen FMI:n avoimen datan WAM varatieksi |
| 2 | Copernicus NWS | 1,5 km | Pohjanmeri, Brittein saaret, Kanaali, Biskajan pohjoisosa, Skagerrak | ~6 vrk | Luoteis-Euroopan rannat |
| 3 | Copernicus IBI | 0,028° | Biskaja, Iberia, Marokko, Kanariansaaret | ~8 vrk | |
| 4 | Copernicus BLK | 0,025° | Mustameri | ~9 vrk | |
| 5 | Copernicus MED | 4,2 km | Välimeri | ~9 vrk | |
| 6 | DWD EWAM | 0,05° × 0,1° | käyttöalue vain IJsselmeer ja Markermeer | +78 h | ainoa joka kattaa Pampuksen |
| 7 | **ECMWF WAM 9 km** | O1280 | maapallo | 15 vrk | pohja kaikkialla |

MFWAM ja GFS-Wave eivät kuulu Parhaaseen; ne voivat olla kortin
Vertaa-valikossa myöhemmin. Arktinen MET Norway 3 km on valinnainen
(Pohjois-Norja).

**Painokanava aalloille on ALUEEN reunasta, ei maamaskista.** Tuulen
alueelliset mallit painotetaan etäisyydellä datan reunaan (NaN-maski).
Aallolla jokainen ranta on NaN-maskin reuna, ja sama sääntö sekoittaisi
jokaisen rannan ECMWF:ään juuri siellä missä alueellinen malli on
paras. Paino on siksi smoothstep etäisyydestä mallin AVOMEREN reunaan
(alueen raja merellä), ja alueen sisällä alueellisen mallin maski
päättää mikä on maata. Ajassa sama kuin tuulella: alku 2 h, loppu 6 h.

## 5. Oikea paikka kartalla, ei mantereen päällä

### 5.1 Open-Meteon MFWAM- ja SMOC-hilat ovat puoli solua sivussa

Open-Meteon `meteofrance_wave`-, `meteofrance_currents`- ja
`meteofrance_sea_surface_temperature`-tiedostojen `crs_wkt` antaa hilan
reunoiksi 79,958 S – 90,042 N ja 179,958 W – 179,958 E. Copernicuksen
alkuperäinen sanoo 80 S – 90 N ja 180 W – 179,917 E. Pohjoisin rivi
90,042°:ssa on mahdoton, eli metatieto on siirtynyt puoli solua
(1/24°) pohjoiseen ja itään.

Mitattu kolmella tavalla:

1. **Taulukot ovat samat.** Open-Meteon `wave_height` ja Copernicuksen
   `VHM0` samalta hetkeltä (15.10. 21Z): indeksisiirrolla 0 MAE 0,005 m
   (kvantisointi) ja maski 100 % sama; yhden solun siirrolla 0,014–0,022.
   Sama Open-Meteon `sea_level_height_msl` = Copernicuksen
   `total_sea_level` (MAE 0,0025 m, siirto 0).
2. **Maski osuu rantaan vain alkuperäisillä koordinaateilla**
   (Natural Earth 1:10m maa + pikkusaaret, solmun keskipiste maalla vs
   mallin kuiva solmu):

   | alue | Copernicuksen koordinaatit | Open-Meteon metatieto |
   |---|---|---|
   | Pohjois-Eurooppa 48–66 N | täsmää 97,57 %, kuiva merellä 1 504, märkä maalla 825 | 97,08 %, 1 772, 1 025 |
   | Välimeri 30–46 N | 97,95 %, 1 541, 446 | 97,34 %, 1 859, 719 |
   | Pohjois-Amerikka 18–50 N | 98,01 %, 2 020, 4 385 | 97,78 %, 2 264, 4 907 |

   Paras siirto viiden × viiden ruudukosta (±1 solu puolen solun
   välein) oli Copernicuksen koordinaatit kahdella alueella kolmesta ja
   tasapeli kolmannella; Open-Meteon kohdistus ei ollut kahdeksan
   parhaan joukossa Euroopassa.
3. **Muut hilat ovat oikein:** samalla testillä ECMWF 0,25° (oma
   kohdistus 98,23 %, puolen solun siirto 97,18–97,19 %), GFS-Wave 0,25°
   (97,95 % vs 97,33–97,48 %) ja DWD EWAM (98,75 % vs 98,27–98,32 %)
   osuvat parhaiten omalla metatiedollaan.

Seuraus: MFWAMin tai SMOCin (vedenkorkeus, virrat) käyttö Open-Meteon
metatiedolla piirtäisi koko kentän 4,6 km väärään paikkaan, ja
rantamaski leikkaisi sen väärästä kohdasta. **Georeferointi luetaan
lähteen omasta määrittelystä** (Copernicus: `latitude`/`longitude`-
taulukot; ECMWF: O1280; DWD ja NOAA: GRIB), ja Open-Meteon `crs_wkt` on
vain ristiintarkistus. Sama koskee kaikkia `meteofrance_*`-hiloja.

### 5.2 Rakentajan rantaviivatesti

Jokaiselle perheelle joka ajolla, ennen julkaisua:

- Mallin kuiva/märkä-maski verrataan Natural Earth 1:10m -maahan
  (rakentajassa jo käytössä `tools/maat.mjs`issä) siirroilla 0 ja ±½ ja
  ±1 solua kummassakin suunnassa. **Jos paras siirto ei ole 0, perhe
  jätetään pois julkaisusta** ja ajon yhteenvetoon tulee hälytys — sama
  periaate kuin tuulen `try/catch` per perhe.
- Lisäksi neljä tunnettua pistettä per perhe (poijun sijainti, märkä)
  ja neljä kuivaa (kaupunki) — halpa savutesti joka kaatuu jos rivien
  suunta tai pituusasteen origo (0–360 vs −180–180) on väärin.

### 5.3 Maski: pohjakartan ranta toimii koko maailmassa

Esrin `World_Dark_Gray_Base` 16 alueelta (z10, 4 × 4 laattaa: Lauttasaari,
Quiberon, Tarifa, Klitmøller, Naxos, Maui, Kapkaupunki, Langebaan,
Jericoacoara, Dakhla, Mui Ne, Perth, San Francisco, Hatteras, Le Morne,
Auckland):

- **Veden kirkkaus on 36,0 jokaisella alueella** (mediaani), maan 71,7
  (10. persentiili 70,7–71,7). Kynnysten 48 ja 60 väliin osuu 0,07–1,28 %
  pikseleistä (rantaviivan reunanpehmennys). Pohja on kartografinen
  kangas eikä kuva, joten kynnys ei riipu paikasta.
- **Retinan ero:** z10:n ja z11:n maski eroaa 0,16–0,97 %:ssa pikseleistä
  (mitattu kuudella alueella) — se on näkyvän rannan ja maskin ero
  puhelimella, koska pohjakartta on retinalla yhtä tasoa tarkempi.

Vaihtoehdot:

| | maski | + | − |
|---|---|---|---|
| M1 | nykyinen: Esri-kynnys suorittimella (`getImageData`) pyöristetyllä zoomilla | toimii, rakennettu | 1–2 px väärin retinalla; kankaan rakennus pääsäikeessä; 4096² katto; zoomin aikana vanha taso |
| **M2** | **sama kynnys GPU:lla laattoina pohjakartan omalla tasolla** (`GLRuudukko`, LUMINANCE-tekstuurit, retinalla z+1, emotaso varana zoomin aikana) | ranta täsmälleen se jonka käyttäjä näkee, myös zoomatessa; ei pääsäiettä | uusi koodi (rakenne on jo `SadeKerros`issa) |
| M3 | vektorimaa (OSM/Natural Earth) MapLibren täyttönä aallon päälle | terävä | satelliittipohjalla peittäisi kuvan; MapLibressa ei ole maskeja; uusi tiililähde |
| M4 | oma etäisyyskenttä (SDF) rantaviivasta laatoiksi | terävä joka zoomilla, pieni | rakennettava ja ylläpidettävä aineisto; ranta eri kuin pohjakartan |

Suositus **M2**. Satelliittipohjalla maski luetaan yhä tummasta pohjasta
(kuten nyt); ero satelliittikuvan rantaan on muutama pikseli.

### 5.4 Rannan aukko ja ekstrapolointi

Näkyvä vesi (Esri-maski, z10) ja sen etäisyys mallin lähimpään märkään
solmuun, osuus näkyvästä vedestä:

| alue | ECMWF 9 km > 4 km | > 8 km | > 12 km | MFWAM > 4 km | > 8 km | > 12 km |
|---|---|---|---|---|---|---|
| Lauttasaari | 53,5 % | 10,6 % | 7,7 % | 34,0 % | 10,8 % | 7,4 % |
| Quiberon | 45,8 % | 4,2 % | 2,0 % | 29,3 % | 2,9 % | 1,3 % |
| Klitmøller | 47,8 % | 3,3 % | 1,7 % | 34,2 % | 14,0 % | 10,5 % |
| San Francisco | 43,2 % | 2,6 % | 1,6 % | 46,8 % | 16,6 % | 11,1 % |
| Auckland | 45,8 % | 5,9 % | 2,7 % | 47,2 % | 15,7 % | 7,5 % |
| Maui Kanaha | 33,2 % | 0,1 % | 0,0 % | 40,6 % | 2,8 % | 0,5 % |
| 16 aluetta | 20–54 % | 0,1–10,6 % | 0–7,7 % | 29–52 % | 0,9–16,6 % | 0,1–11,1 % |

Nykyinen 4 km (FMI WAM:lle mitoitettu) jättäisi globaalilla mallilla
puolet rannikkovedestä tyhjäksi. Mutta pitkä ekstrapolointi on
oikeellisuuskysymys: San Franciscon lahden, Limvuonon tai Helsingin
saariston sisälle jatkettu avomeren aalto olisi väärä luku joka ei näytä
väärältä.

Ehdotus:

- **Ekstrapolointi rakentajassa, perheen tarkkuuden mukaan:** matka
  D = 1,3 × natiivin solmuvälin (ECMWF 9 km → 12 km, MED 4,2 km →
  5 km, NWS ja BAL → 3 km), laskettuna samalla naapurikeskiarvolla kuin
  nyt. Selaimen silmukat poistuvat.
- **Luottamuskanava:** laattaan aikariippumaton N × N -taso (kuten
  painokanava) = etäisyys lähimpään mallin märkään solmuun. Varjostin
  häivyttää kentän välillä 1,0 … 1,3 × solmuväli, ja kapseli ja kortti
  sanovat etäisyyden ("ECMWF 9 km · 6 km merellä").
- **Alueelliset mallit ratkaisevat suojaisat vedet** (Lauttasaari
  BAL:lla 1,2 km, Quiberon NWS:llä 0,3 km), ja ECMWF:n pitkä
  ekstrapolointi jää niiden alle painokanavassa.
- **Spottikortin raja** 2,5 km → mallin tarkkuuden mukaan (≤ 1,3 ×
  solmuväli, enintään 15 km) ja etäisyys aina näkyvissä yli kilometrin
  päästä (päätös P5). CLAUDE.md:n "kauempaa luettu aalto olisi toisen
  paikan aalto" pysyy totena — siksi luku nimeää etäisyyden.

### 5.5 Sisävedet

Esrin maskissa järvet ja joet ovat vettä. Kenttä ei kuitenkaan ulotu
niihin, koska ekstrapolointi on rajattu (D) ja malleissa ei ole niitä
(luku 4.4), joten kartta näyttää sisävedet tyhjinä. Poikkeus: rannan
lähellä olevat laguunit ja jokisuut saavat luottamuskanavan häivyttämän
jatkon. Järvien oma aallokko tuulesta ja pyyhkäisymatkasta (SMB) on
mahdollinen myöhemmin, ei tässä.

## 6. Sulavuus: miten aaltokerros on yhtä sulava kuin tuuli

### 6.1 Mikä tekee tuulen lämpökartasta sulavan

1. **Kenttä on GPU:lla, hila vain kun näkymä karkaa pehmusteesta**
   (`_kattaa`, pehmuste 0,6) — veto ja zoom eivät maalaa uudelleen.
2. **Näyttötarkkuuden taso ja kahden tason sekoitus** (`karkeaPaino`):
   zoomin rajalla ei hyppyä (RMS 0,004–0,05 m/s).
3. **Solmubudjetti** (24 000) ja toistossa karkea taso (9 000 solmua).
4. **Aikapalat ja koko akselin esilataus** (`AikaEsilataus`): hyppy
   0,1–0,45 s.
5. **Odotus ja häivytys:** vanha hila ruudulla kunnes uusi on täysi
   (hypyssä 0,4 s), ja hyppy häivytetään 0,45 s.
6. **Kokoamismuisti** (`_kooste`) ja perheet rinnakkain yhdellä
   kierroksella.
7. **Lähizoomin palvelinhila** (ECMWF 9 km z8+) varaston päällä, ja
   raahauksen aikana varasto.

### 6.2 Aallot samaan koneistoon

Kaksi tapaa:

- **K1. Yleistetty varasto** — `Saalaatat`in koneisto (perheet,
  painokanava, palat, tasot, `varmista`, `kokoaHila`, `AikaEsilataus`,
  `_peitto`, LRU) parametroidaan kentällä: tuuli (nopeus, suunta, puuska
  → u, v) tai aallot (Hs, suunta, jakso → Hs, suunta, jakso). Aalto-
  instanssi lukee `luettelo.aallot`ia (versio 2: `perheet`, `pala`,
  `paino`, `kate`), eikä se koskaan näe tuulen perheitä.
  `AaltoGL` saa `LampoGL`in rakenteen: oma ja karkea hila, odotus,
  häivytys, budjetti.
- **K2. Rinnakkainen aaltovarasto** — sama logiikka kopioituna
  `Aallot`-moduuliin.

Suositus **K1**. Kopio on täsmälleen se mitä CLAUDE.md kieltää ("älä
kirjoita toista valintasääntöä"): kaksi koneistoa ajautuisi erilleen,
ja jokainen tuulen korjaus (palat, odotus, perheet rinnakkain) pitäisi
tehdä kahdesti. Hinta: yleistys on riskialtis muutos tuulen polkuun,
joten se mitataan tuulen nykyisillä mittareilla ennen ja jälkeen
(`ensinakyma`, `tuntiaskel`, savu- ja graafitesti, aikahypyn
hyväksymismittarit).

### 6.3 Aika GPU:lla

Tuuli kokoaa uuden hilan jokaiselle tunnille (puhelimella 35–40 ms), ja
toistossa ja raahauksessa karkealle tasolle. Aalloille ehdotetaan
enemmän: **hila kootaan aika-askeleen molemmille puolille** (t0 ja t1,
oma ja karkea taso = neljä RGBA8-tekstuuria), ja varjostin sekoittaa ne
aikapainolla. Toisto ja raahaus askeleen sisällä ovat silloin pelkkä
uniform; kokoaminen tapahtuu vain askeleen rajalla (tunti +90 h:iin,
sitten 3 h ja 6 h). Suunta ja jakso sekoitetaan samoin (suunta
yksikkövektorina), ja aallonharjat lukevat saman sekoituksen
suorittimella. Sama tekniikka sopisi myöhemmin tuuleenkin — ei tässä.

Aallonkorkeus on ajassa sileä: varaston 3 h ja 6 h askeleet
interpoloituina eivät näy (tuulen 3 h akselilla tuntipisteet ovat
suoralla, docs/mallit.md). Häivytys (`Haivytys`) jää hypyille.

### 6.4 Esilataus — tarvitaanko?

**Kyllä, samalla `AikaEsilataus`-koneistolla**, koska globaali akseli on
paloina: ilman sitä jokainen palan raja toistossa ja jokainen hyppy
uuteen palaan olisi hetken vajaa kenttä. Hinta on pieni (luku 7:n
koosta, laattaa kohti 0,3–0,6 kt askeleelta):

| näkymä | taso | laattoja | koko akseli (96 askelta) |
|---|---|---|---|
| puhelin z4 (maapallon puolisko) | 1,0° | ~8 | ~0,4 MB |
| puhelin z6 | 0,5° | ~6 | ~0,3 MB |
| puhelin z7 | 0,25° | ~6 | ~0,2 MB |
| työpöytä z5 | 0,5° | ~35 | ~1,7 MB |
| työpöytä z7 | 0,25° | ~12 | ~0,5 MB |

Lisäksi:

- **Lähizoomin palvelinhila** (luku 6.5): valittu tunti ja ±1 h
  taustalla kuten `MalliHila._esiHae`; toisto ja raahaus lukevat
  varastoa.
- **Rantamaski ei tarvitse aikaesilatausta**: se on pohjakartan laattoja
  (jo selaimen välimuistissa) ja riippuu vain paikasta; pehmuste kuten
  nyt.
- **Vuorovesi harmonisista vakioista ei tarvitse aikaesilatausta
  lainkaan**: vakiot ladataan kerran alueelle, ja jokainen hetki
  lasketaan (luku 8.5).

### 6.5 Lähizoom: varasto vai palvelin

Globaali 0,1°:n taso olisi 330–500 MB (luku 7) — liian suuri Pagesiin
tuulen rinnalle. Kaksi tapaa:

- **Palvelin (suositus):** `api/malli.js` saa tilan `muuttuja=aallot`,
  joka lukee ECMWF WAM:n O1280-rivit näkymän alueelle kuten tuulen
  `ecmwf_ifs` (sama `o1280()`-apu, mitattu tuulella 5°:n kaista 1,0 s /
  0,28 MB). Vain siellä missä alueellinen perhe ei kata näkymää
  täydellä painolla — Euroopan rannikoilla palvelinta ei kutsuta.
  Sama sopimus kuin tuulella: valittu tunti, varasto alla.
- Rannikkokaista 0,1° varastoon (noin 4 600 laattaa, arvio 130 MB) —
  ei kutsuja, mutta varasto kasvaa; vasta jos Pages vaihtuu R2:een.

### 6.6 Koodaus, asteikko ja harjat maailmassa

- **Hs neliöjuurikoodauksella**: q = 254 · √(Hs / 16 m). Askel 1,7 cm
  0,3 m:ssä, 3,1 cm 1 m:ssä, 7 cm 5 m:ssä, katto 16 m. Pienet aallot
  (Itämeri) tarkentuvat ja myrsky mahtuu. Jakso 0,1 s (katto 25,4 s) ja
  suunta 2° pysyvät.
- **Väriasteikko 0–10 m** painotuksella 0–3 m:iin (wingfoil-alue), ja
  aikajanan aaltopalkkien epälineaarinen akseli ulotetaan noin 8 m:iin
  (päätös P6).
- **Harjat** pysyvät suorittimella (enintään 700 kaarta); maailmannäkymässä
  niiden tiheys on ruudun alasta kuten nyt.

## 7. Varasto: koko ja rakennus

Koko oikealla datalla: ECMWF WAM 9 km (15.10. 12–19Z, kahdeksan tuntia),
laatikkosuodin tasoille, 21 × 21 -laatat ja sama tavukoodaus kuin
`tools/wam.mjs` (Hs, suunta, jakso), gzip 9:

| taso | laattoja | 1 h | lisä / askel | 96 askelta | 145 askelta |
|---|---|---|---|---|---|
| 1,0° | 155 | 0,12 MB | 0,088 MB | ~8 MB | ~13 MB |
| 0,5° | 554 | 0,40 MB | 0,278 MB | ~27 MB | ~40 MB |
| 0,25° | 2 041 | 1,17 MB | 0,827 MB | ~80 MB | ~120 MB |
| 0,1° | 11 585 | 4,81 MB | 3,405 MB | ~328 MB | ~495 MB |

(96 askelta = tunneittain +48 h, 3 h → +144 h, 6 h → +240 h; 145 =
ECMWF:n koko 15 vrk.)

Ehdotus varastoon:

| perhe | tasot | arvio |
|---|---|---|
| ECMWF WAM 9 km | 1,0° ja 0,5° koko 15 vrk; 0,25° +7 vrk | ~53 MB + ~70 MB |
| Copernicus BAL, NWS, IBI, MED, BLK | 0,05° ja 0,02° rannikolla (kuten a0/a1) | arvio 40–60 MB (mitattava V5:ssä) |
| DWD EWAM (IJsselmeer) | 0,05° | < 1 MB |

Yhteensä noin 160–190 MB tuulen 267 MB:n rinnalle, eli varasto noin
450 MB (Pagesin raja 1 GB; eurooppa.md S9: R2 kun liikennettä).

Rakennus: ECMWF WAM -ajosta luetaan kolme muuttujaa (~6 MB hetkeltä,
145 hetkeä ≈ 0,9 GB) ja Copernicuksen alueelliset tunneittain
(aallonkorkeus 0,24–0,86 MB tunnilta tuotetta kohti, kolme muuttujaa,
6–9 vrk) arviolta 1–1,5 GB. Arvio ajasta (ei mitattu): ECMWF:n luku ja
suodatus 3–5 min, Copernicuksen alueelliset noin 5 min. Säädata on nyt
26 min (raja 60). Aalloille oma työ — samaan ajoon rinnakkaisena
vaiheena tai omana työnkulkunaan omaan haaraansa (päätös P10; jos uusi
haara, se lisätään Vercelin `git.deploymentEnabled`iin ja Tarkistuksen
`branches-ignore`en, CLAUDE.md).

## 8. Vuorovesi

### 8.1 Missä se on hyödyllinen

Itämerellä vuorovettä ei ole (CLAUDE.md), ja vedenkorkeus (FMI) on jo
kortissa — se on eri asia ja pysyy. Atlantilla ja valtamerillä
vuorovesi päättää spotin käytettävyyden: Bretagnessa nousu on yli 10 m
(docs/eurooppa.md 5.2), Kanaalissa ja Waddenmerellä vuorovesivirta
tekee tuulta vastaan jyrkän aallokon, ja matalikot ja laguunit (Dakhla,
Langebaan, Le Morne) ovat ajettavissa vain osan vuorokaudesta.

### 8.2 Lähteet

- **"Samoista lähteistä": Open-Meteon `meteofrance_currents`**,
  tunneittain −24 … +240 h, kerran vuorokaudessa. Sen
  `sea_level_height_msl` on mitattuna Copernicuksen globaalin
  `merged-sl`-tuotteen `total_sea_level` (MAE 0,0025 m) = FES2014-
  vuorovesi + ilmanpaine + mallin (MERCATOR GLO12) pinnankorkeus —
  **mukaan lukien keskimääräinen dynaaminen topografia** (vaihteluväli
  −5,2 … +3,8 m), eli se ei ole korkeus paikallisesta keskivedestä
  ilman paikallisen keskiarvon vähennystä. Virrat ovat saman
  tuoteperheen `merged-uv`ta (ei mitattu). Lisäksi sama puolen solun
  siirto (luku 5.1).
- **Copernicus `merged-sl` suoraan:** `ocean_tide` (FES2014) erikseen,
  `invert_barometer`, `sea_surface_height` ja `total_sea_level`, ARCO,
  ilman tunnistautumista. Virrat erikseen (`merged-uv`: `utide`/`vtide`,
  `utotal`/`vtotal`).
- **Alueelliset vuorovesimallit:** Copernicus NWS 1,5 km (AMM15,
  vuorovesi mallissa; vedenkorkeus ja virrat tunneittain ja 15 min) ja
  IBI 1/36° — Luoteis-Euroopan ja Iberian rannoille.
- **Harmoniset vakiot:** EOT20 (DGFI-TUM), 17 osavuorovettä, 1/8°,
  66 S – 66 N (napa-alueilla FES2014b), CC BY 4.0, 2 GB NetCDF.
  Ennuste mihin tahansa hetkeen ilman päivittäistä rakennusta.
- **Asemien omat ennusteet** (harmoniset, satamakohtaiset): NOAA CO-OPS
  (Yhdysvallat, julkinen), Kartverket (Norja, CC BY 4.0), lisäksi
  Rijkswaterstaat (avoin), UKHO (maksuton taso, avain), SHOM
  (maksullinen) — docs/eurooppa.md 4.4.

### 8.3 Mitattu tarkkuus

8.–14.10.2026 tunneittain: aseman oma ennuste havaintoa vasten
(lähtötaso) ja Copernicuksen FES2014 (`ocean_tide`, lähin märkä solmu)
aseman ennustetta vasten. RMSE m, amplitudisuhde ja vaihe-ero (miinus =
malli aikaisemmin):

| asema | solmu | asema-ennuste vs havainto | FES2014 vs asema-ennuste | vaihtelu (std) |
|---|---|---|---|---|
| Honolulu | 6,8 km | 0,03 | 0,08, 1,04, −54 min | 0,18 m |
| Key West | 4,4 km | 0,04 | 0,07, 1,03, +36 min | 0,18 m |
| Duck NC (avoranta) | 1,8 km | 0,09 | 0,19, **0,60**, −36 min | 0,39 m |
| San Francisco (Golden Gate) | 4,2 km | 0,07 | 0,15, 1,00, −36 min | 0,53 m |
| Bergen | 8,7 km | 0,08 | 0,14, 1,02, −36 min | 0,44 m |
| Narvik | 44,7 km | 0,10 | 0,16, 0,87, −6 min | 0,95 m |
| Charleston | 9,1 km | 0,15 | 0,28, 0,96, −54 min | 0,60 m |
| Boston | 11,2 km | 0,12 | 0,32, 0,98, −30 min | 1,08 m |
| New York The Battery | 15,4 km | 0,12 | **0,41**, 0,97, −90 min | 0,56 m |
| Tromsø | 29,3 km | 0,09 | **0,44**, 0,82, −72 min | 0,77 m |
| Eastport (Fundy) | 5,4 km | 0,11 | **0,77**, 0,92, −42 min | 2,10 m |
| Anchorage | 2,0 km | 0,15 | **1,32**, 1,04, −48 min | 3,08 m |
| Seattle (Puget Sound) | 69,9 km | 0,08 | **2,09**, 1,18, **−180 min** | 1,04 m |
| Oslo | 36,4 km | 0,11 | 0,06, 0,79, −42 min | 0,16 m |

Alueellinen NWS 1,5 km Bergenissä: aseman ennustetta vasten 0,11 m,
−18 min, ja havaintoa vasten 0,08 m (FES2014 0,16) — nousuvesi ja
myrskynousu ovat mallissa yhdessä.

Johtopäätös: asemaennuste on paras aina kun asema on spotin vesillä.
Globaali malli kelpaa avorannikolle (7–19 cm, 30–60 min etuajassa,
koska solmu on merellä ja vuorovesiaalto tulee sinne ensin), mutta
lahdet, vuonot ja jokisuut vaativat aseman tai alueellisen mallin.

### 8.4 Vaihtoehdot

| | mitä | + | − |
|---|---|---|---|
| T1 | ei vuorovettä | — | globaali sovellus ilman Atlantin pääsuuretta |
| **T2** | **spottikortti ja kapseli parhaasta lähteestä**: asema (≤ 20 km, sama vesialue) > NWS/IBI > EOT20 varauksin; näytetään vain kun kevätvuoroveden vaihteluväli > 0,5 m | tarkin luku spotille; lähde ja etäisyys näkyvät | asemalähteet maittain (proxyt tiloina) |
| **T3** | **"Vuorovesi"-näkymä kartalle (beta)** harmonisista vakioista GPU:lla | aika ilmainen, ei päivittäistä rakennusta, koko valtameri | värisäännön poikkeus; rannoilla mallin tarkkuus |
| T4 | vedenkorkeus tuntikenttinä (Copernicus `total_sea_level`) varastoon | sisältää myrskynousun | 10 vrk, päivittäinen rakennus, koko kuin aalloilla; keskiveden vähennys |
| T5 | virrat (vuorovesi + merivirta) partikkeleina | tuuli vastaan virta -tieto | iso: tuntikentät, alueelliset mallit; myöhemmin |

### 8.5 Erillinen näkymä: "Vuorovesi" (beta)

Tarvitaan, jos vuorovesi halutaan kartalle — se ei mahdu aaltojen
värikieleen (eri suure, eri asteikko, ja aalloilla on jo asteikkonsa).
Ehdotus:

- **Viides kerrosruutu "Vuorovesi"**, näkyvissä vain kun näkymässä on
  vuorovesirannikkoa (Kate: kevätvuoroveden vaihteluväli vakioista).
  Itämerellä ruutua ei ole.
- **Kartta:** vedenkorkeus paikallisesta keskivedestä kaksisuuntaisella
  asteikolla (laskuvesi ↔ nousuvesi), harmonisista vakioista
  laskettuna varjostimessa: 8 pääosavuorovettä (M2, S2, N2, K2, K1, O1,
  P1, Q1) amplitudi ja vaihe tekstuureina, nodaalikorjaukset ja
  tähtitieteelliset argumentit lasketaan JS:ssä kerran hetkeä kohti.
  Toisto näyttää vuorovesiaallon kulun (amfidromiset pisteet) ilman
  yhtään latausta. Lähellä rantaa luottamus heikkenee: rantakaistalla
  ei väitetä enempää kuin malli tietää.
- **Aikajana:** palkit ovat vedenkorkeus tähtäimen pisteessä
  keskiviivasta ylös ja alas, nousu- ja laskuveden huiput merkittyinä
  (kuten aaltotila vaihtaa palkit Hs:ksi). Kelikaista lukee yhä tuulta.
- **Kapseli:** korkeus, suunta (nousee / laskee) ja seuraava nousu- tai
  laskuvesi ("+1,2 m · nousee · nousuvesi 14.32").
- **Spottikortti:** vuorovesimoduuli (käyrä, nousu- ja laskuvesi,
  lähde ja etäisyys) — T2:n lähteestä, ei kartan mallista, kun asema on
  lähellä.
- **Värisääntö:** kartan pinnalla on yhä tasan yksi asteikko; poikkeus
  CLAUDE.md:hen (sade ja aallot) vaatii käyttäjän päätöksen (P7).
- **Data:** EOT20:n vakiot pyramidiksi (1,0° … 0,125°, kahdeksan
  osavuorovettä, amplitudi ja vaihe tavuina): koko valtameri arviolta
  15–20 MB kerran, näkymä alle 1 MB, välimuisti pysyvä (malliversio
  avaimena). Rantakaistaan voi myöhemmin tuoda NWS/IBI:n
  harmonisen analyysin samaan muotoon.

### 8.6 Virrat

Vuorovesivirta on wingfoilille vuorovettä tärkeämpi siellä missä se on
voimakas (Solent, Morbihan, Kanaalisaaret, Wadden). Copernicuksen NWS
1,5 km ja IBI antavat sen tunneittain, globaali `merged-uv` 1/12°.
Ehdotus: myöhempi vaihe "Vuorovesi"-näkymän sisälle partikkeleina
(nopeus 0–3 kn), alueellisista malleista; ei ensimmäisessä erässä.

## 9. Kokonaisvaihtoehdot

| | sisältö | arvio |
|---|---|---|
| S1 | **Minimi**: ECMWF 0,25° nykyiseen `Aallot`iin | halpa, mutta rannalta 17–24 km aukko Suomessa, CPU-polku ja rajat jäävät; ei ammattimainen |
| S2 | ECMWF WAM 9 km nykyiseen kerrokseen, rajat nostettuina ja ekstrapolointi 12 km | keskikokoinen; ei sekoitusta, ei paloja, ei odotusta — hyppää ja nykii maailmannäkymässä |
| **S3** | **aallot tuulen koneistoon (K1) + GPU-aika + M2-maski + alueelliset perheet + palvelinhila lähizoomiin** | suurin työ, mutta sama sulavuus kuin tuulella ja paras data joka paikassa |
| S4 | kolmannen osapuolen aaltolaatat tai pistepalvelu (Stormglass, Open-Meteo marine) | kiintiö ja hinta, ei yhtä sekoitussääntöä, ei hallintaa paikasta |
| S5 | Copernicuksen Zarr suoraan selaimessa | blosc-purku selaimeen, 0,24–0,86 MB tunnilta tuotetta kohti pelkälle aallonkorkeudelle mobiilissa; ei |

Suositus **S3** vaiheittain.

## 10. Suositus ja vaiheet

| vaihe | sisältö | koko | vaikutus |
|---|---|---|---|
| **V1** | **Rakentaja: ECMWF WAM 9 km perheeksi** (1,0° / 0,5° koko 15 vrk, 0,25° +7 vrk), luettelo `aallot` versio 2 (`perheet`, `pala`, luottamuskanava), Hs neliöjuurikoodaus, ekstrapolointi rakentajassa (D = 1,3 × solmuväli), rantaviivatesti; FMI WAM ennallaan päällä | +120 MB, ~+3–5 min | aallot koko maailmaan varastosta |
| **V2** | **Asiakas: aallot tuulen koneistoon (K1)**: perheet ja painokanava, palat, `AikaEsilataus`, tasojen sekoitus, budjetti, odotus, häivytys, tähtäimen sarja; Kate ja tekstit globaaleiksi; asteikko 0–10 m | ±0 | sulavuus tuulen tasolle |
| **V3** | **GPU-aika** (t0/t1-tekstuurit) ja **M2-maski** (`GLRuudukko`, pohjakartan taso, retina z+1), luottamuskanavan häivytys | ±0 | toisto ja raahaus ilman kokoamista; ranta täsmälleen pohjakartan |
| **V4** | **Lähizoom**: `api/malli.js?muuttuja=aallot` (O1280) z ≥ 8 alueellisten ulkopuolella, ±1 h esihaku | kutsuja vain lähizoomissa | 9 km:n tarkkuus rannalla kaikkialla |
| **V5** | **Copernicus-perheet**: BAL (FMI WAM ~9 vrk, kaikki Suomen spotit), NWS, IBI, MED, BLK; EWAM IJsselmeerille; paino alueen reunasta | +40–60 MB, ~+5 min | rannan tarkkuus Euroopassa 0,2–3 km |
| **V6** | **Vuorovesi kortille ja kapseliin (T2)**: NOAA, Kartverket (proxyt tiloina olemassa olevissa funktioissa), NWS/IBI, EOT20 varauksin; Kate vain vuorovesirannikolle | pieni | Atlantin spoteille pääsuure |
| **V7** | **"Vuorovesi"-näkymä (beta, T3)** jos P7 = kyllä; virrat (T5) myöhemmin | ~15–20 MB kerran | kartta vuoroveden vaiheesta |
| **V8** | **Jatkuva varmennus aalloille** (`tools/varmennus.mjs`: FMI-poijut, NDBC, Marine Institute, EMODnet) perheittäin ja alueittain → järjestys datasta | 0 | perheiden järjestys ja ekstrapoloinnin raja mitattuina |

Koot ja ajat ovat luvun 7 arvioita. V1–V3 ovat yksi kokonaisuus
käyttäjälle (ennen V3:a aallot ovat maailmassa mutta raahaus maksaa
pääsäiettä kuten tuuli); V4–V5 tuovat rannan; V6–V7 vuoroveden. V8 voi
alkaa heti V1:n jälkeen.

**Tuotantokelpoisuus** jokaisessa vaiheessa:

- **Luettelon versio:** `aallot` versio 2 (palat, perheet). Nykyinen
  asiakas hylkää sen (`Aallot._ota` vaatii version 1) ja on ilman
  aaltoja seuraavaan latauskertaan asti — sama siirtymä kuin tuulen
  paloilla 9.10. (`Paluu` lataa sivun uudelleen 30 min taustan jälkeen).
- **Kate ja lähdemerkintä:** asetusten katerekisteri lukee aaltoperheiden
  laatat, ja aaltotilan lähdemerkintä nimeää tähtäimen kohdan perheen ja
  ajon (kuten tuulen `malliKohdassa`).
- **Vikasieto perheittäin:** perhe joka ei rakennu tai ei läpäise
  rantaviivatestiä jää pois, muut julkaistaan (kuten tuulen
  `try/catch`); ECMWF:n puuttuessa edellinen rakennus jää voimaan.
- **Valvonta:** ajon yhteenvetoon perheiden ajoaika, akselin pituus,
  laattamäärä, koko ja rantaviivatestin tulos; hälytys kun perhe
  vanhenee yli 24 h.
- **Välimuisti:** laattojen versioavain on rakennushetki (`luotu`),
  service worker pitää aallot omana sukupolvenaan (`saa-a-<v>`, kuten
  nyt).
- **Lisenssit Tietoa-näkymään:** ECMWF (CC BY 4.0), "Generated using
  E.U. Copernicus Marine Service Information", FMI (CC BY 4.0), DWD,
  EOT20 (DGFI-TUM, CC BY 4.0), NOAA, Kartverket (CC BY 4.0), Open-Meteo.
- **Kieli:** kaikki uudet tekstit `_t`/`data-en` ja desimaalipilkku
  (CLAUDE.md).
- **Mittari:** `tools/aaltomittaus.mjs` (luku 11), osa CI:hin kevyenä
  (aaltotilan vaihto savutestissä).

## 11. Hyväksymismittarit

Asetelma kuten docs/aikahyppy.md: tuotantobuild, puhelin (390 × 844,
`hasTouch`, dpr 3) ja työpöytä, `timezoneId` Helsinki, service worker
estetty, varasto oikeasta kodista; mediaani viidestä ajosta, raakaluvut
näkyvissä.

1. **Oikea paikka:** jokaisen perheen rantaviivatestin paras siirto 0;
   satunnaisissa pisteissä (100 / perhe) laatan arvo = lähteen arvo
   kvantisoinnin tarkkuudella; poijujen kohdalla kartta = kortti =
   aikajana (ero 0,00 m).
2. **Ei mantereella:** Esri-maskin maapikseleissä kerroksen alfa 0
   (16 alueella); näkyvästä rannikkovedestä väritetty ≥ 99 % siellä
   missä mallin solmu on ≤ D:n päässä.
3. **Sulavuus:** tunnin askel pääsäikeessä ≤ tuulen (puhelin ≤ 45 ms);
   toistossa ja raahauksessa askeleen sisällä kokoamisia 0 ja JS
   ruudulta ≤ 2 ms; hyppy esiladattuun hetkeen ≤ 0,3 s; zoomin
   tasorajan yli ero ≤ 0,02 m (RMS samoissa pisteissä).
4. **Tavut:** ensimmäinen näkymä aaltotilassa ≤ +1 MB; koko akselin
   esilataus näkymälle ≤ 2 MB (luku 6.4).
5. **Osuvuus (V8):** perhe on Parhaassa vain jos se on alueellaan
   varmennuksessa vähintään yhtä hyvä kuin ECMWF 9 km (RMSE,
   rannikkopoijuilla).
6. **Vuorovesi:** kortin luku asemaennustetta vasten ≤ 0,15 m ja
   ≤ 20 min kun lähde on asema; mallilähteellä etäisyys ja "malli"
   näkyvissä, ja ennustetta ei näytetä kun sen virhe tunnettua asemaa
   vasten alueella on yli 0,3 m tai 45 min.
7. **Ei regressiota tuulessa** (K1): `ensinakyma`, `tuntiaskel`,
   aikahypyn mittarit, savu- ja graafitesti.

## 12. Päätettävät kohdat

| | kysymys | suositus |
|---|---|---|
| P1 | Globaali perusmalli | **ECMWF WAM 9 km** (mitattu paras); MFWAM ja GFS-Wave vain vertailuun |
| P2 | Copernicus Marinen alueelliset (rekisteröityminen, lähdemerkintä) | **kyllä**, BAL ensin (Suomen kaikki spotit, ~9 vrk) |
| P3 | Lähizoom | **palvelin (O1280) alueellisten ulkopuolella**; 0,1° varastoon vasta R2:n myötä |
| P4 | Ekstrapolointi | **1,3 × solmuväli rakentajassa + häivytys**, ei pidemmälle |
| P5 | Spottikortin aaltoraja | **≤ 1,3 × solmuväli (max 15 km), etäisyys näkyvissä** (nyt 2,5 km) |
| P6 | Asteikko ja koodaus | **Hs √-koodaus (katto 16 m), väri 0–10 m painotus 0–3 m** |
| P7 | Vuorovesi kartalle omana näkymänä (värisäännön poikkeus) | **ensin kortti ja kapseli (V6)**; "Vuorovesi"-näkymä (beta) V7:nä jos haluat |
| P8 | Virrat | myöhemmin "Vuorovesi"-näkymän sisälle |
| P9 | Jakso näytössä: keskijakso vai huippujakso | huippujakso maininkirannoilla kertoo enemmän; mitattava kortilla |
| P10 | Rakennus | **oma työ samaan Säädata-ajoon rinnakkain**; oma haara vain jos aikaraja tulee vastaan |

## 13. Riskit ja mitä EI tehdä

**Riskit**

- **Open-Meteon peili on ECMWF WAM:n ainoa lähde 9 km:nä.** Varatie:
  ECMWF:n oma avoin data (aaltovirta 0,25°; 9 km:n vapaa jakelu on
  ilmoitettu tulevaksi) tai Copernicus GLO (MFWAM) — rakentaja vaihtaa
  perheen, asiakas ei tiedä.
- **Copernicuksen osoitteet ja tuoteversiot vaihtuvat** (luku 4.5):
  STAC joka ajolla, ja vanhenemisesta hälytys.
- **Rakennusaika ja lataus:** noin 2 GB lisää ajoa kohti; jos Säädata
  lähestyy 60 min rajaa, aallot omaksi työkseen (P10).
- **K1 koskee tuulen polkuun.** Mittarit ennen ja jälkeen (luku 11, 7).
- **Varaston koko** ~450 MB: Pages kestää, mutta siirto kasvaa — R2
  (eurooppa.md S9) kun liikennettä.

**Mitä EI tehdä**

- **Ei Open-Meteon `crs_wkt`-reunoja MFWAMille eikä SMOCille** (luku 5.1).
- **Ei GFS-Wavea eikä MFWAMia pohjaksi** (Havaiji 0,92 m; Itämeri
  −0,19 m harha).
- **Ei Open-Meteon marine-rajapintaa selaimesta** (kiintiö; peruttu
  erä `5150fc1`).
- **Ei globaalia 0,1°:n tasoa Pagesiin** (330–500 MB).
- **Ei ekstrapolointia ilman ylärajaa ja häivytystä** — lahden perukan
  avomeren aalto olisi väärä luku joka ei näytä väärältä.
- **Ei vuorovettä Itämerelle**; vedenkorkeus on eri suure ja pysyy
  kortissa.
- **Ei Zarria selaimessa** eikä GPL-lukijaa selaimessa
  (`@openmeteo/file-reader` vain palvelimella, kuten nyt).
- **Ei uusia Vercel-funktioita** (12/12): aallot `api/malli.js`in
  tilaksi, vuorovesiproxyt olemassa olevien tiloiksi.

## 14. Toteutus (15.10.)

Kaikki vaiheet V1–V8 toteutettiin suosituksen mukaan, ja päätettävät
P1–P10 ratkaistiin suositusten mukaan (P7: "Vuorovesi"-näkymä tehtiin
betana, P8: virrat jäivät). Tässä luvussa on mitä tehtiin, missä
toteutus poikkesi strategiasta ja mitä mitattiin. Mittarit ovat
scratchpadissa kuten strategiassa — paitsi jatkuva varmennus
(`tools/aaltovarmennus.mjs`), joka on repossa ja ajaa havainnot-työnkulussa.

### 14.1 Vaiheet ja poikkeamat

| vaihe | tehtiin | poikkeama strategiasta |
|---|---|---|
| V1 | `tools/aaltopyramidi.mjs` (yhteinen pyramidi kaikille aaltoperheille: √-koodattu Hs katolla 16 m, suunta 2°, keskijakso 0,1 s, painokanava avomeren reunasta, etäisyystaso, jatke maalle 1,3 × luottoetäisyys, palat 24), `tools/aallot.mjs` (ECMWF WAM O1280 Open-Meteon S3:sta, perhe `ecmwf_wam`, tasot `we0` 0,25° +7 vrk, `we1` 0,5°, `we2` 1,0°), FMI WAM perheeksi `fmi_wam` (`wf0`–`wf5`), luettelon avain `aallot2` (versio 2) | Vanha `aallot` (versio 1, `a0`–`a3`) jäi vanhoille asiakkaille ja uuden asiakkaan varatieksi (`AaltoVarasto._v1`): Itämeri ilman maailmaa on parempi kuin tyhjä kartta. |
| V2 | `AaltoVarasto` = `Object.create(Saalaatat)` omalla tilallaan: perheet ja painokanava, palat, LRU 320, `varmista`, koko akselin esilataus (`AaltoEsilataus`), tasot ja niiden sekoitus, odotus, häivytys, tähtäimen sarja; väriasteikko 0–10 m | **Olematon laatta on kuiva**, ei puuttuva: rakentaja kirjoittaa laatan vain märkien solmujen ympärille, ja ilman tätä ECMWF:n 27 km:n jatke toi meren aallot alueellisen mallin maa-alueen järville (Bodom 0,55 m). **Laattabudjetti** valitsee tason (`AaltoTaso.LAATTABUDJETTI` 70): työpöydän maailmannäkymä oli 19 000 pyyntöä 36 s:ssa. Väriramppi uusiksi (OKLCH sininen → laventeli → violetti → pinkki): Itämeren ramppi piirsi valtameren 1,5–3 m valkoisena. |
| V3 | Aika GPU:lla (`AaltoGL` piirtää hetket A ja B samasta tekstuurista ja interpoloi varjostimessa), rantamaski M2 (`Rantamaski`: Esrin tumman pohjan laatat GL-tekstuureina pohjakartan omalla tasolla, retinalla taso tarkempi) | — |
| V4 | `api/malli.js?muuttuja=aallot` (ECMWF WAM O1280 näkymän alueelle valitulle tunnille, märkien naapurien painotettu keskiarvo, jatke 1,3 × 9 km ja etäisyystaso samalla koodauksella kuin varastossa), asiakkaan `AaltoHila` zoomista 8 | Haku ohitetaan kun alueellinen perhe kattaa näkymän (Itämerellä FMI WAM on jo tarkempi). Vain kartta lukee sitä; aikajana, kortti, kate ja tuulitilan kapseli lukevat varastoa (O12). |
| V5 | `tools/copernicus.mjs` + `tools/blosc.mjs` (BAL, NWS, IBI, BLK, MED ARCO-Zarrista; tuoteversio STAC:sta joka ajolla, blosc-lz4 puhtaana JS:nä), `tools/ewam.mjs` (DWD EWAM vain IJsselmeerille ja Markermeerille) | **Valta:** alueellisen perheen kuiva solmu väistyy (paino 0) kun ECMWF:llä on siinä merta 7,5 km:n sisällä eikä perheellä omaa märkää pistettä 15 km:n sisällä (`VALTA_KM`, `POHJA_MERI_KM`; 5 km jätti O1280:n 10–12 km:n leveyspiirivälin meren keskelle reikiä). Ilman tätä Marmaranmeri oli Mustanmeren laatikossa tyhjä ja Laatokan länsiranta katkesi. ECMWF rakennetaan siksi ensin. Kentän näyte kuutiollisella B-splinillä: 0,05°:n tason bilineaariset taitteet näkyivät Quiberonin lahdessa suorakaiteina. Copernicuksen tunnusta ei tarvittu (anonyymi pääsy toimi). |
| V6 | `api/_vuorovesi.js` (`api/vesi.js?vuorovesi=noaa\|kartverket\|malli`), `tools/vuorovesi.py` (EOT20 → `public/vuorovesi/`), kortin vuorovesimoduuli (`buildVuorovesiModuuli`), kapselin vuorovesirivi (`KapVuorovesi`) | Lähde T2:n mukaan; vedenkorkeuden laatta sanoo vuorovesirannikolla "vuorovesi alempana" eikä toista lukua (P15). |
| V7 | `VuorovesiGL` (vakiot näkymän hilaksi, korkeus GPU:lla hetkeä kohti), `VuorovesiVari`, kerrosruutu "Vuorovesi (beta)" vain vuorovesirannikolla, aikajanan palkit keskiviivasta, kapseli | Rakentaja merkitsee fysikaalisesti mahdottomat vakiot epäluotettaviksi (233 solmua: Saint Lawrencen S2 31 m, Amazonin suu, Maracaibo). Virrat (T5) jäivät (P8). |
| V8 | `tools/aaltovarmennus.mjs` havainnot-työnkulkuun, `api/aallot.js`:n `poijuSarjat`, savutestiin kerrosruutujen tarkistus | EMODnet ei ole mukana: sen ERDDAP katkaisi yhteyden kehitysympäristöstä, joten Välimerellä, Mustallamerellä ja IJsselmeerillä ei vielä ole poijua. Paras verrataan myös pääperheensä mukaan (`paras←<perhe>`), koska se on mittari 5 sellaisenaan. |

### 14.2 Rakentaja: koko ja kesto

Mitattu kontissa 15.10. (täysi rakennus, S3 ja Copernicus verkon yli):

| perhe | tasot | hetkiä | koko | aika | lähteen märkiä / solmuväli |
|---|---|---|---|---|---|
| ECMWF WAM 9 km | `we0`–`we2` | 129 | 152,5 MB (`we0` 95,9, `we1` 42,8, `we2` 13,8) | 305 s | 4 716 388 O1280-pistettä |
| FMI WAM | `wf0`–`wf5` (+ v1 `a0`–`a3`) | 67–73 | noin 14 MB molemmat luettelot | noin 60 s | 1,93 km |
| Copernicus BAL | `wb0`–`wb5` | 83 | 13,7 MB | 29 s | 147 222 / 1,85 km |
| Copernicus NWS | `wn0`–`wn4` | 75 | 14,5 MB | 40 s | 731 648 / 1,96 km |
| Copernicus IBI | `wi0`–`wi4` | 83 | 20,5 MB | 43 s | 547 912 / 3,09 km |
| Copernicus BLK | `wk0`–`wk4` | 85 | 3,4 MB | 15 s | 81 103 / 2,78 km |
| Copernicus MED | `wm0`–`wm4` | 85 | 22,9 MB | 33–35 s | 244 255 / 4,63 km |
| DWD EWAM | `wd0`–`wd2` | 116 | 0,2 MB | 24 s | 43 järvipistettä (luotto 10 km) |

Yhteensä noin 240 MB ja 9 min (Säädata noin 35 min, aikaraja 60 min,
muistia enimmillään 1,31 GB). Arviot olivat V1:lle +120 MB ja 3–5 min ja
V5:lle 40–60 MB ja noin 5 min: ECMWF ylitti arvion, koska 0,25°:n taso
on mukana +7 vrk:een (koko akselilla se olisi ollut 128 MB yksin), ja
Copernicus koska Välimeri ja Biskaja ovat laajoja. ECMWF:n
ekstrapoloituja solmuja `we0`:ssa 31 827 (7 kierrosta, 27,1 km). Akseli:
ECMWF 48 h menneisyyttä → +15 vrk tuoreimmasta ajosta; Copernicus −48 h
6 h välein, tunneittain +24 h:iin, 3 h +144 h:iin ja 6 h loppuun.

Rantaviivatesti (luku 5.2) ajetaan jokaisessa rakennuksessa jokaiselle
perheelle tunnetuilla märillä ja kuivilla pisteillä (`EC_MARAT` /
`EC_KUIVAT`, `FMI_MARAT` / `FMI_KUIVAT`, Copernicuksen ja EWAMin omat);
perhe joka ei läpäise sitä jää pois, ja ilman pohjaperhettä `aallot2`:ta
ei julkaista (asiakas on silloin v1-varatiellä).

### 14.3 Asiakas (V2–V5)

- **Tuuli ei muuttunut (K1, mittari 7):** `Saalaatat._asetaAkseli` sai
  korjauksen (tarkka askel on oma indeksinsä painolla 0 — palan rajalla
  k = 24, 48, … laatta näytti puuttuvalta ja sen saapuminen ohitettiin).
  Tuulen näytteet ovat bitilleen ennallaan: 1 584 näytettä ja 6
  tuntisarjaa vanhaa buildia vasten.
- **Rantamaski (V3, mittari 2):** puhelimella (dpr 3) Helsingissä rannan
  maapikselit (2 px vedestä) joihin aalto piirtyi: z11 16,3 → 11,7 %,
  z12 18,7 → 12,9 %, z13 5,1 → 3,8 %. Vanha versio kokosi koko näkymän
  yhdeksi kankaaksi pääsäikeessä pyöristetyllä zoomilla.
- **Lähizoom (V4):** Biarritz 0,02° 30 000 solmua 1,1–1,4 s palvelimella,
  162 kt. Jokainen tunnin askel tulee esihaun muistista ja hakee
  taustalla seuraavan; saapuminen häivytetään.
- **Perheet kartalla (V5, puhelin, testivarasto):** Helsinki FMI WAM
  0,57 m, Quiberon NWS 1,07 m (lahti suojaisampi), Klitmøller NWS 1,71,
  Tarifa IBI 1,06, Bol MED 0,09, Marmaranmeri ECMWF 2,82 (myrsky),
  Mustameri BLK 1,47, Pampus EWAM 0,19, IJsselmeer EWAM 0,50; 0
  pageerroria. Asetusten aaltoteksti nimeää näkymän mallit ja niiden
  pituuden ("Met Office WW3 1,5 km 6 vrk, MFWAM 3 km 8 vrk ja ECMWF WAM
  9 km 14 vrk").
- **Kortin luku maalla (P5):** lähin märkä piste enintään
  1,3 × paikan päällimmäisen perheen solmuväli, enintään 15 km
  (`luottoKmPaikalle`): FMI WAM 2,5 km, BAL 2,4, NWS 2,5, IBI 4,0, BLK
  3,6, MED 6,0, ECMWF 11,7 ja EWAM 13 km.
- **Aaltokatteen muisti** (`AaltoKate`) nollautuu kun luettelon perheet
  vaihtuvat: Pampus oli maata ennen EWAMia.

### 14.4 Vuorovesi (V6–V7)

- **Vakiot:** EOT20:n kahdeksan osavuorovettä laatoiksi (t0 0,125°
  rannikolle 892 laattaa 6,52 MB, t1 0,5° 153 / 1,83 MB, t2 2,0° 15 /
  0,14 MB), katerasteri 2° (10 396 / 16 200 solua, raja 0,5 m), NOAA:n
  asemat 3 502. Suljetut vedet (IJsselmeer ja Markermeer,
  Noordzeekanaal) ovat maskissa 3. NOAA:n harmonisia vakioita vasten
  verrattiin 1 242 asemaa; 549 epäluotettavaa (RMS yli 0,3 m tai M2 yli
  45 min) merkitsee 15 km:n säteen maskiin 2 (Bristol Bay 1,4–1,9 m,
  Puget Sound 1,3–1,6 m / 4 h). Lisäksi 233 mahdotonta solmua (V7).
- **Laskenta:** Schuremanin argumentit, vuorokautisilla K1 −90°, O1/P1/Q1
  +90° (toisin päin Honolulu 0,22 → 0,03 m). NOAA:n ennustetta vasten
  San Francisco 0,06 m, Key West 0,04, Duck 0,04.
- **Proxyt:** malli 0,2–0,9 s, NOAA 0,5 s, Kartverket 0,9 s; mallin
  "ei dataa" (puuttuva pala = S3 403) on "ei vuorovettä" (Pampus).
- **Kortti (V6):** moduulin korkeus yksi arvo jokaisella spotilla (354 px
  puhelin, 395 työpöytä), Pampuksen kertaluonteinen 334 px:n siirtymä
  poistui esitarkistuksella (`VuorovesiKate.esitarkista`).
- **Kartta (V7, puhelin, 15.10.):**

  | näkymä | hila | kapseli | aikajanan palkit (403 h) |
  |---|---|---|---|
  | Bretagne z8 | 0,125°, 2 078 vesisolmua | "laskee +0,7 m, laskuvesi 03:13" | −2,20 … +2,17 m, 32 nousu- ja 32 laskuvettä |
  | Bretagne z10 | 0,125° | "laskee +0,7 m" (sama luku) | −2,25 … +2,22 m |
  | Kanaali z6 | 0,125°, 20 283 | "nousee +1,9 m" | −3,74 … +3,70 m |
  | Fundy z7 | 0,125°, 6 408 | "laskee +2,6 m" | −4,65 … +4,68 m |
  | San Francisco z10 | 0,125° | "malli ei luotettava tässä" (epäluotettava osuus 0,54) | ei palkkeja |
  | IJsselmeer z9 | — | "ei merta tässä" | ei palkkeja |
  | Helsinki z8 | 0 vesisolmua | "ei vuorovettä tässä" | ei palkkeja |
  | Atlantti z3,5 | 0,5°, 26 426 | "laskee 0,0 m" | −0,61 … +0,61 m |

  Atlantilla luku oli ennen "−0,0 m": etumerkki tuli pyöristämättömästä
  luvusta (−0,04). Nyt etumerkki luetaan pyöristetystä (`_vvM`).
  Kerrosruutu näkyi Bretagnessa ja oli piilossa Helsingissä. **16.10.
  muuttui (luku 15):** ruutu on aina näkyvissä, Helsingissä kartta näyttää
  Itämeren vedenkorkeuden, ja pieni vuorovesi näkyy lukuna eikä
  "ei vuorovettä tässä".

### 14.5 Jatkuva varmennus (V8)

`tools/aaltovarmennus.mjs` (havainnot-työnkulun askel, `continue-on-error`)
toimii kuten tuulen `tools/varmennus.mjs` (O11), kolmessa vaiheessa:

1. **Arkisto.** Uuden `aallot2.luotu`n ennuste luetaan poijujen kohdalta
   tunneittain 0–72 h: jokainen perhe erikseen (kun perhe kattaa poijun:
   painokanava > 0,5, aikapaino > 0, märkyys ≥ 0,5) ja Paras samalla
   säännöllä kuin kortti ja aikajana (`AaltoVarasto.naytteista`
   hienoimmalla tasolla ilman lähizoomin palvelinhilaa; puuttuva laatta
   tekee tunnista tuntemattoman, kuten `_vajaa` sovelluksessa). Mukana
   Parhaan pääperhe tunneittain ja jokaisen perheen lähimmän solmun
   etäisyys mallin märkään pisteeseen. → `varmennus/aallot/ennusteet/`,
   noin 55 kB rakennusta kohti, 5 vrk.
2. **Vertailu** enintään kerran tunnissa: FMI:n aaltopoijut (yksi
   WFS-kysely, `poijuSarjat`, 96 h), NOAA NDBC:n strategian 15 poijua
   (aseman viiden vuorokauden tiedosto) ja Marine Instituten M-poijut
   (ERDDAP, yksi kysely; QC-lippu 9 = puuttuva). Tasatunnin havainto on
   lähin enintään 30 min päästä. Harha, MAE, RMSE ja SI perheittäin,
   alueittain (Itämeri, Irlanti, USA länsi, USA itä, Havaiji),
   rannikkopoijuilla (≤ 25 km Natural Earth 1:10m:n rannasta) ja
   avomerellä sekä ennusteen iän mukaan; suunnan MAE kun havaittu Hs ≥
   0,5 m. **Pareittain ECMWF:n kanssa** samoista poijuista, tunneista ja
   ennusteista, ja Paras myös pääperheensä mukaan (`paras←<perhe>`): ne
   tunnit joilla perhe ratkaisee Parhaan, verrattuna ECMWF:ään samoilla
   tunneilla — mittari 5 sellaisenaan. → `varmennus/aallot/tulos.json`.
3. **Vuorokaudet.** Päättynyt UTC-vuorokausi D kirjataan kerran summina
   (`paivat.json`, 120 vrk) kun D + 27 h ≤ nyt < D + 48 h: viimeinenkin
   tunti on havaittu, ja ensimmäisen tunnin 72 h:n ennuste on yhä
   arkistossa — siksi säilytys on 5 vrk eikä 4 kuten tuulella.
   Yhteenvedon pareittainen taulukko lukee viimeiset 30 vrk.

**Hälytykset** (yhteenvetoon, eivät kaada ajoa): `aallot2` puuttuu,
perheen ajo yli 36 h vanha rakennushetkellä (Copernicus ja EWAM
päivittyvät kerran vuorokaudessa, joten 24 h hälyttäisi joka päivä),
Parhaan harha yli 0,3 m tai SI yli 0,5 alueella (vuorokausi, n ≥ 30),
Parhaan suunnan **mediaani**ero yli 60° (Hs ≥ 1 m, n ≥ 30); käännetty
suunta antaisi ~170°.

**Suunta verrataan samaan suureeseen** (korjattu 16.10. ensimmäisten
tuotantoajojen jälkeen). Mallin suunta on koko spektrin keskisuunta,
NDBC:n MWD huippujakson (DPD) suunta, ja ne ovat sama asia vain
yksihuippuisessa meressä. Havaijilla luoteen maininki ja koillisen
pasaatiaallokko vuorottelevat spektrin huippuna (Waimea 16.10.:
maininki 0,6 m 11,8 s luoteesta, tuuliaallokko 1,4 m 6,2 s koillisesta,
MWD vaihtelee 318° ↔ 41°), ja suunnan hälytys laukesi joka tunti:
mediaaniero 72°. NDBC:n suunta luetaan nyt vain kun DPD ≤ 1,6 × APD
(`NDBC_YKSIHUIPPU`). Mitattuna 15.–16.10. arkistojen ja NDBC:n
viidentoista poijun pareista (Hs ≥ 1 m):

| DPD / APD | ≤ 1,3 | 1,3–1,45 | 1,45–1,6 | 1,6–1,8 | 1,8–2,0 | > 2,0 |
|---|---|---|---|---|---|---|
| n | 50 | 39 | 50 | 99 | 107 | 87 |
| suunnan mediaaniero | 14° | 13° | 20° | 32° | 41° | 34° |

Havaijin pareista 88/96 oli suhteen 1,6 yli (mediaaniero 73°), ja
yksihuippuiset 8 paria osuivat 11°:een. Vuorokauden mediaani laski
Havaijilla 72° → 11° (n 78 → 7) ja USA:n länsirannikolla 25° → 12°
(n 234 → 65); muut ennallaan. Samalla NDBC:n 10 min säärivit, joissa
aaltomittaus toistuu ilman DPD:tä, jätetään pois (täydet rivit kattavat
1 700 tuntia 1 712:sta). Marine Institute antaa keskisuunnan ja FMI
huipun suunnan (ModalWDi) Itämeren yksihuippuisessa meressä (mediaani
7–8°), joten niihin ei tarvittu sääntöä.
**Huomio** (ei hälytys): perhe tai sen ratkaisemat Parhaan tunnit ovat
pareittain yli 5 % ECMWF:ää heikompia vähintään 200 parilla 30 vrk:ssa
— silloin perhe ei mittarin 5 mukaan kuulu alueensa Parhaaseen.
Järjestys muutetaan rakentajassa käsin (`aaltoLuettelo`n perhelista),
ei automaattisesti.

**Ensimmäinen ajo** (testivaraston rakennus 15.10. klo 03:27 UTC
havaintoja vasten klo 03–20 UTC, eli yksi ennuste ja 17 tuntia — ei vielä
johtopäätöksiä, vaan todiste siitä että ketju toimii päästä päähän):

| perhe | alue | n | harha m | RMSE m | pareittain ECMWF |
|---|---|---|---|---|---|
| FMI WAM | Itämeri (6) | 94 | +0,05 | 0,21 | 0,27 |
| Copernicus BAL | Itämeri | 94 | −0,02 | 0,20 | 0,27 |
| Copernicus NWS | Irlanti (3) | 48 | −0,09 | 0,38 | 0,44 |
| Copernicus IBI | Irlanti (4) | 64 | −0,46 | 0,59 | 0,42 |
| ECMWF WAM 9 km | USA länsi (6) / itä (6) / Havaiji (3) | 99 / 96 / 33 | −0,01 / +0,01 / +0,09 | 0,17 / 0,16 / 0,15 | — |
| Paras ← IBI | Irlanti (M6) | 16 | | 0,59 | 0,35 |

Itämerellä alueelliset ovat ECMWF:ää parempia kuten strategian otoksessa
(luku 4.3). IBI oli tässä otoksessa Irlannin poijuilla selvästi matala;
se ratkaisee Parhaan vain M6:lla (NWS:n alueen reunan ulkopuolella), ja
jos sama toistuu 30 vrk:n summissa, mittari 5 nostaa sen huomioksi.
Yksikään poiju ei ole minkään perheen jatkeella (etäisyys märkään
pisteeseen yli mallin solmuvälin), joten **ekstrapoloinnin rajaa ei
voi vielä mitata poijuilla** — siihen tarvittaisiin lahtien poijuja
(esim. CDIP:n rantapoijut).

**Ensimmäiset tuotantoajot (15.–16.10.).** Säädata #293 (herättimen
lähettämä, 15.10. klo 22:36–23:10 UTC) oli ensimmäinen uudella
rakentajalla, ja 16.10. klo 12 mennessä kuusi ajoa oli onnistunut:
20–35 min (vaihtelu on verkkoa — samat perheet 1,5–2 kertaa nopeampia
lyhyissä ajoissa), 4 418 laattaa, gzip 288–290 MB, ja luettelossa
`aallot2` kahdeksalla perheellä. ECMWF WAM 129 hetkeä (we0 98, +7 vrk),
150–153 MB, 198–358 s. FMI WAM:n VANHIMMAN luetellun ajon ensimmäinen
pala (6 h, 12–18 h menneisyydessä) vastasi kolmessa ajossa kuudesta
HTTP 400 (#293, #294, #296: 67/73 hetkeä), muissa 73/73. Kaikki kolme
luetteloitua ajoa latautuivat klo 12:37 UTC, joten kyse on ajonvaihdon
hetkestä jolloin WFS-luettelo ja latauspalvelu ovat eri mieltä
vanhimmasta ajosta. Rakentaja jättää puuttuvat tunnit pois akselilta
kuten tuulella, eli FMI WAM:n jakso alkaa 6 h myöhemmin ja alempi
perhe (BAL, ECMWF) kattaa ne; muuta korjattavaa ei ole. Copernicus
IBI:ltä puuttui #294:ssä 4 hetkeä 84:stä ja MED:ltä 2 / 86, muissa
ajoissa ei mitään. Varmennus arkistoi jokaisen rakennuksen (noin
53 kB) ja vertaa tunnin välein: FMI 6, NDBC 15/15, Marine Institute 4
(M4 hiljaa). Ensimmäinen hälytys oli Havaijin suunta, ja se oli
vertailun vika (ks. yllä "Suunta verrataan samaan suureeseen").

Varhainen havainto, ei päätös (mittari 5 ratkaisee 30 vrk:n summista):
**FMI WAM on kahdella rantaa lähimmällä poijulla korkea.** Suomenlinnan
poijulla (2,5 km rannasta) FMI WAM +0,75 m / RMSE 0,77 m (n 45),
Copernicus BAL +0,07 / 0,11 ja ECMWF +0,38 / 0,39; Orrengrundissa
(16 km) FMI WAM +0,32 / 0,43 ja ECMWF −0,09 / 0,13. Muilla neljällä
poijulla (23–69 km) FMI WAM 0,11–0,29 m.
Varasto toistaa mallin: FMI:n oma pistekysely Suomenlinnan kohdalla
16.10. klo 12–18 UTC 1,61 … 1,27 m, varaston `fmi_wam` 1,57 … 1,24 m.
FMI WAM on järjestyksessä BAL:n yläpuolella, joten Helsingin spottien
kortti näyttää sen — kuten ennen `aallot2`:ta (vanha `aallot` ja
pistekysely olivat myös FMI WAM:ia).

### 14.6 Hyväksymismittarit: tila

| mittari | tila |
|---|---|
| 1. Oikea paikka | Rantaviivatesti joka rakennuksessa jokaiselle perheelle. Kortti, aikajana, tuulitilan kapseli ja varmennus lukevat samaa varaston sekoitusta; kartta lukee zoomista 8 alueellisten ulkopuolella palvelimen hilaa (V4), joten siellä väri voi poiketa kortin luvusta. 100 pisteen laattatarkistusta perheittäin ei tehty. |
| 2. Ei mantereella | Rantamaski pohjakartan tasolla: rannan maapikselit z11–z13 3,8–12,9 % (ennen 5,1–18,7 %); ei mitattu 16 alueella. |
| 3. Sulavuus | Toisto ja raahaus ilman kokoamista askeleen sisällä (aika GPU:lla); ruutuaikaa ei voi mitata kontissa (CLAUDE.md) — laitteella mittaamatta. |
| 4. Tavut | Ei mitattu erikseen; laattabudjetti ja esilataus kuten tuulella. |
| 5. Osuvuus | Mittari käynnissä (`tools/aaltovarmennus.mjs`); päätös 30 vrk:n summista. |
| 6. Vuorovesi | Harmoninen laskenta NOAA:n ennustetta vasten 0,04–0,06 m; epäluotettava malli ei näytä lukua (maski 2, "malli ei luotettava tässä"). |
| 7. Ei regressiota tuulessa | Tuulen näytteet bitilleen ennallaan; savu- ja graafitesti läpi. |

### 14.7 Mitä jäi

- **P9 huippujakso:** jakso on kaikilla perheillä keskijakso (luettelon
  `jakso: 'keski'`); FMI WAM:n jakso on yhä pistekyselystä.
- **0,02°:n taso** NWS:lle, IBI:lle, MED:lle ja BLK:lle (koko), ja
  NWS:n lähizoom palvelimelta.
- **Poijuja Välimerelle, Mustallemerelle ja IJsselmeerille**
  (EMODnet Physics, Rijkswaterstaat) — tarkistettava Actionsista, koska
  kontista yhteys katkesi. Lahtien poijut ekstrapoloinnin rajan
  mittaamiseen.
- **Virrat** (P8) "Vuorovesi"-näkymän sisälle.
- **Laitemittaukset** (mittari 3) oikealla puhelimella ja iPadilla.
- `tools/aaltomittaus.mjs` jäi kirjoittamatta: mittaukset tehtiin
  scratchpadin skripteillä, ja CI:ssä on kevyt osa (savutestin
  kerrosruudut: aallot, sade, vuorovesi ja tuuli vaihtavat tilan, ja
  vuorovesiruutu näkyy sekä Helsingissä että Bretagnessa, 16.10.).

## 15. Parannukset (16.10.): vuorovesi kaikkialla, Itämeren vedenkorkeus, kelikaista ja aaltomallit

Käyttäjän pyynnöt 16.10.: vuorovesiruutu aina näkyviin, Itämerelle ja
Välimerelle vuorovesi tai vastaava, Atlantin tumma kohta korjattava,
asetusten mallilista kerroksen mukaan, kelikaista kerroksen datasta ja
kelihyppy pois muista kuin tuulinäkymästä. Vastaukset suunnitelman
kysymyksiin: Itämerellä näytetään vedenkorkeus, aaltomallit pakotetaan
kuten tuulimallit, ja kelikaista on koko ajan värikäs (lepoväri vain
siellä missä dataa ei ole).

### 15.1 Vuorovesiruutu aina näkyvissä

`AsetusAlue._kerrokset` piilotti ruudun kun näkymässä ei ollut
vuorovesirannikkoa (`Vuorovesi.rannikkoAlueella`, 2°:n katerasteri), joten
Suomen yllä sitä ei löytänyt lainkaan. Nyt ruutu on aina näkyvissä
(käyttäjä: "haluat todennäköisesti nähdä missä kaikkialla vuorovettä on"),
`rannikkoAlueella` poistettiin (ei muita käyttäjiä), ja asteikon selite
kertoo Itämeren näkymässä että siellä kartta on vedenkorkeutta. Savutesti
vaatii ruudun sekä Helsingissä että Bretagnessa ja kytkee sen päälle
(tila `001`).

### 15.2 Atlantin tumma kohta oli amfidromi ja vaihteluvälin raja

Kartan solmun paino oli smoothstep kevätvuoroveden vaihteluvälistä
2·(M2 + S2 + K1 + O1) 0,3 → 0,5 m (V7: "±4 cm:n vuorovesi olisi harmaa
huntu"). Mitattu EOT20:n t1-laatoista:

| paikka | M2 | vaihteluväli |
|---|---|---|
| 57° N 40° W | 0,44 m | 1,53 m |
| 55° N 40° W | 0,30 | 1,09 |
| 52° N 36° W | 0,17 | 0,65 |
| **50° N 40° W** | **0,03** | **0,30** |
| 48° N 38° W | 0,08 | 0,36 |
| Välimeri 40° N 5° E | 0,05 | 0,26 |
| Tyrrhenanmeri 38° N 15° E | 0,08 | 0,28 |
| Ligurianmeri 43° N 7,5° E | 0,08 | 0,32 |
| Adrianmeren pohjukka 45° N 13° E | 0,20 | 1,05 |
| Gabèsinlahti 33,5° N 10,5° E | 0,50 | 1,75 |
| Mustameri 42° N 30° E | 0,01 | 0,08 |
| Itämeri 59,5° N 22° E | 0,01 | 0,08 |

Tumma läiskä oli Pohjois-Atlantin M2-amfidromi (50° N, 40° W), jossa
vuorovesi on fysikaalisesti lähes nolla — sitä ympäröivä meri ylitti rajan,
joten läiskä näytti puuttuvalta datalta ja kapseli sanoi "ei vuorovettä
tässä". Sama raja tyhjensi Välimeren valtaosan (0,1–0,3 m). Data ja maski
olivat kunnossa (maski 1 kaikissa pisteissä).

**Korjaus:** jokaisen märän solmun paino on 1 (`VuorovesiGL._kokoa`), ja
pieni vuorovesi on asteikon hiljaista harmaata (keskivesi on
`VuorovesiVari`n neutraali kohta). Mitattu puhelimella: amfidromi
"0,0 m · laskee · laskuvesi 23:29", aikajana −0,11 … +0,16 m; Välimeri
40° N 5° E "0,0 m · laskuvesi 22:14", −0,10 … +0,11 m; Adrianmeri
−0,54 … +0,49 m. "Ei vuorovettä tässä" jää vain suljetulle vedelle
(maski 3) ja ladattaessa. Spottikortin vuorovesimoduuli ja tuulitilan
kapselin vuorovesirivi pitävät rajan 0,5 m (`Vuorovesi.RAJA_M`): niissä
vuorovesi on lisätieto, ei kerros.

**Sekavuorovesi:** `Vuorovesi.seuraavaVakioista` haki seuraavaa nousu- tai
laskuvettä 14 h eteenpäin. Adrianmeren pohjukassa 16.10. laskuvedestä
(18:00 UTC) seuraavaan nousuveteen oli 15,5 h (olkapää 02–04), ja kapselin
alarivi jäi tyhjäksi. Haku on nyt 26 h.

### 15.3 Itämeren vedenkorkeus vuorovesikartalle

Itämerellä vuorovesi on muutamia senttejä, mutta vedenkorkeus liikkuu
tuulen ja ilmanpaineen mukana yli metrin. Vuorovesikartta näyttää siellä
vedenkorkeuden (käyttäjän päätös), nimellä "vedenkorkeus".

**Data:** Copernicus Marine BALTICSEA_ANALYSISFORECAST_PHY_003_006,
aineisto `cmems_mod_bal_phy_anfc_PT1H-i` (versio 202411; 202611 on
STAC:ssa "in preparation"), muuttuja `sla` ("sea surface height above sea
level"), hila 774 × 763 (1 mpk, 53,0–65,9° N, 9,04–30,21° E), tunneittain
2022-12-02 → noin +9 vrk. ARCO-Zarr:
`timeChunked` palat [2, 774, 763] (koko alue kahdelle tunnille, 1,04 Mt
blosc-lz4, haku 0,85 s kontista) ja `geoChunked` [5844, 16, 8] (pisteen
sarja yhdestä palasta). Aikayksikkö on "days since 1900-01-01" — pelkkä
päivä, jota `varasto()` ei ennen jäsentänyt.

**Nollataso mitattuna:** `sla` FMI:n 14 mareografin havaintoja vasten
(WATLEV, teoreettinen keskivesi), 72 h, 16.10.:

| asema | harha | hajonta |
|---|---|---|
| Föglö Degerby | −0,3 cm | 2,0 cm |
| Hanko | +0,4 | 2,6 |
| Rauma | +0,5 | 2,5 |
| Pori | +0,9 | 1,8 |
| Turku | +1,4 | 3,9 |
| Porvoo Emäsalo | +1,9 | 2,2 |
| Kaskinen | +2,1 | 2,6 |
| Helsinki | +2,4 | 2,0 |
| Hamina | +2,8 | 3,1 |
| Pietarsaari | +3,0 | 3,5 |
| Vaasa | +4,7 | 3,2 |
| Oulu | +6,8 | 6,4 |
| Raahe | +6,9 | 4,4 |
| Kemi | +12,5 | 5,6 |

`sla` on siis jo keskivedestä (harhojen itseisarvojen keskiarvo 3,3 cm,
suurin Kemi +12,5 cm), eikä palan keskiarvoa vähennetä
(`keskiarvo: false`), vaikka tässä 72 h:n otoksessa se olisi pienentänyt
harhaa (3,3 → 2,3 cm, suurin 12,5 → 5,9 cm). Vähennys ei ole vakaa: palan
keskiarvo on sen tuntien keskiarvo (nyt huhti–lokakuu, 4 920 h), ja uuden
palan alussa se kattaa vain päiviä — myrskyviikko siirtäisi nollaa
kymmeniä senttejä. Se myös poistaisi kausivaihtelun, joka kuuluu lukuun:
teoreettisesta keskivedestä mitattuna syksyn korkea vesi on plussalla.
Perämeren +7 … +13 cm (maankohoaminen ja mallin keskivesi) jää tunnetuksi
harhaksi.

**Palvelin** (`api/vesi.js`, funktioita yhä 12):
`?vesitaso=kentta&t=<ms>` palauttaa hetken sisältävän 2 tunnin palan
harvennettuna 3 × 3 meren solun keskiarvoiksi (255 × 258, cm Int16
base64:nä, ~23 kt gzip kahdelle tunnille; kylmänä 5 s, sitten 1 s), ja
`?vesitaso=sarja&lat=&lng=` pisteen sarjan −48 h … mallin loppu
(lähin meren solmu 4 km:n sisältä). Kenttä Helsingin kohdalla 26 cm,
sarja samalla tunnilla 26,8 cm.

**Sovellus** (`BalVesi`):
- Paino R = Itämeren mallin suorakaide, länsireunalla smoothstep 9,3 →
  10,3° E (Skagerrak). Vuoroveden paino vähenee R:n verran VAIN siellä
  missä mallissa on vettä (15.6; ensimmäinen versio kertoi koko
  suorakaiteen (1 − R):llä ja jätti Norjan rannikon tyhjäksi), ja
  vedenkorkeus tulee tunneittain omasta tekstuuristaan (`_balPaivita`:
  tunnit tA ja tA + 1 h, sama neliöjuurikoodaus, rannan jatke kuten
  vuorovedellä). Varjostin sekoittaa painoilla; Itämeren näkymässä
  koodausalue on vähintään ±2 m (Perämeren ennätys +2,01 m).
- Kesken saapuva kenttä ei tyhjennä merta: edellinen pari jää enintään
  6 h:n päähän. Toistossa haetaan kaksi tuntia eteenpäin. Muistissa 24
  tuntia (~6 Mt).
- Kapseli ja aikajana lukevat pisteen sarjaa (0,02°:n ruutu, CDN-osuma),
  kapseli kenttää sarjaa odotellessa. Alarivi "Itämeren vedenkorkeus",
  suunta sarjan kaltevuudesta; nousu- ja laskuveden valoja ei ole.
  Lähdemerkintä "Vedenkorkeus · Copernicus Marine, Itämeren malli (2 km)".
- Mitattu puhelimella: Helsinki "+0,2 m · laskee · Itämeren
  vedenkorkeus", palkit 246/397 tuntia (sarjan jakso) −0,05 … +0,36 m;
  Kattegat 246/397, −0,82 … +0,29 m; Skagerrak 9,8° E (R 0,5) vuorovesi.
  Tietoa-näkymä nimeää aineiston (Baltic Sea Physics, 2 km).

### 15.4 Kelikaista seuraa kerrosta

Ennen (1.10.–16.10.) kaista ja kelihyppy lukivat aina tuulta. Nyt
(`_tlKaistaPiirra`, `_tlKaistaLaji`):

| kerros | kaista | kelihyppy |
|---|---|---|
| tuuli | kelikaista kuten ennen (kynnys `Keli.AJETTAVA`) | näkyy |
| puuska | puuska `ColorRamp`illa | piilossa |
| aallot | aallonkorkeus `AaltoVari`llä | piilossa |
| vuorovesi | vedenkorkeus `VuorovesiVari`llä | piilossa |
| sade | sade sateen rampilla, pouta lepovärillä | piilossa |

Muilla kuin tuulella juova on koko ajan värikäs ja paksuus kasvaa arvon
mukana samalla käyrällä kuin palkki (2,8 → 5 px); lepoväri vain siellä
missä dataa ei ole (maa, mallin jakson ulkopuoli). Puuskalla kelihyppy
hyppäsi ennen puuskaan ≥ 8 m/s — väärä kynnys väärälle sarjalle. K-näppäin
toimii kuten nappi (pikanäppäinohje: "tuulikerroksella"). Mitattu
kaistan kankaasta: värillisiä pikseleitä tuuli 1 928 (loput lepoväriä),
puuska 12 790 / 0, aallot 10 450, vedenkorkeus Helsinki 4 002 ja lepoväri
1 460 sarjan jälkeen, sade 1 124 / 2 280.

### 15.5 Asetusten mallilista kerroksen mukaan, aaltomallin pakotus

`AsetusAlue._malliOsio`: tuulella ja puuskalla tuulimallit kuten ennen,
aalloilla **Kartan aaltomalli** -lista (Paras saatavilla, näkymää kattavat
aaltoperheet luettelon järjestyksessä, ECMWF WAM), vuorovedellä ja
sateella kartan lähteet tietona (EOT20 + Itämeren vedenkorkeus; tutka,
HARMONIE, ECMWF) ilman valintaa.

Aaltoperheen pakotus on tuulen mallien tapaan perhevalinta
(`AaltoVarasto.TILAT` luettelosta: jokainen perhe yksin pohjan päällä, ECMWF
WAM sen alueen ulkopuolella ja jakson jälkeen; `Asetukset.arvot.aaltomalli`,
ei tallennu). Kate on pakotuksesta riippumaton (`AaltoVarasto.perheMarka`:
painokanava ja märkyys, olematon laatta kuiva), joten pakotettu malli ei
piilota muita. Pisteen sarjan muisti on tilan mukaan. Mitattu Helsingin
edustalla: lista "Paras saatavilla (Täällä: FMI WAM · FMI WAM
(Copernicus) · ECMWF WAM), FMI WAM, FMI WAM (Copernicus), ECMWF WAM";
pakotus vaihtaa kapselin (1,1 → 1,2 m) ja lähdemerkinnän, ja englanniksi
"Map wave model", "1.9 km".

### 15.6 Norjan rannikon aukko: Itämeri on mallin vesi, ei suorakaide

Käyttäjän raportti 16.10. (kuva 65° N 12° E, vuorovesinäkymä): "Norjan
rannikoilla on data-aukko vuorovedessä". Kartalla oli tumma suorakaide
rannikon edustalla, kapseli sanoi "ei vuorovettä tässä", lähdemerkintä
"Vedenkorkeus · Copernicus Marine, Itämeren malli" ja aikajanalla oli
tuulen palkit.

**Syy:** `BalVesi.paino` on mallin hilan suorakaide 53–65,9° N,
9,04–30,21° E, ja vuoroveden paino kerrottiin (1 − R):llä koko
suorakaiteessa. Suorakaiteen sisällä on vettä jota Itämeren mallissa ei
ole. Mitattu mallin omasta kentästä (3 × 3 harvennettu hila, 255 × 258):
maata ovat Helgeland 65,3° N 11,8° E, Trondheiminvuono 63,5/10,5,
Kristiansund 63,1/9,3, Oslonvuonon sisäosa 59,6/10,6, Elbe 53,6/9,8 ja
Limvuono 56,9/9,5; vettä Oslonvuonon suu 59,0/10,5 ja Kielinlahti
54,4/10,2. Norjanmeren rannikolla 62–65,9° N vuorovesi sammui eikä
tilalle tullut mitään.

**Korjaus: Itämeren osuus = R × mallin vesi.**
- Mallin vesi on kentän oma maski (`BalVesi._maski`: ensimmäinen
  saapunut kenttä, koska mallin maa on sama joka tunnilla). Maskia
  varten haetaan tarvittaessa nykyhetken kenttä (`maskiOdottaa`), joten
  kaukana valittu tunti ei jätä sitä saamatta.
- Kartta: vuoroveden painoa EI enää kerrota `_kokoa`ssa. Itämeren
  tekstuurin neljäs kanava on vaimennus (`_balPaivita`, a): R niissä
  solmuissa joissa mallilla on arvo (rannan jatke mukana, `_balMeriSolmut`),
  muualla 0, ja varjostin kertoo vuoroveden painon (1 − a):lla.
  Vaimennus on kynnys eikä mallin painon jatke: jatkeen 0,45-solmussa
  vuorovesi laimentaisi vedenkorkeuden alle puoleen.
- Piste (kapseli, aikajana, lähdemerkintä): `BalVesi.osuus` — pisteen
  sarja ensin (mallin vesi 4 km:n sisällä tai ei), sitten maski (vesi
  viereisissä soluissa, noin 5 km). Maskin tultua sarjaa ei haeta
  pisteeseen jonka lähellä mallin vettä ei ole.
- Maskia odotellessa vaimennus on koko R (kuten ennen): Itämeri on hetken
  tyhjä eikä vilauta vuorovettä ennen vedenkorkeutta. Jos nykyhetken
  kenttää ei saada, vaimennus on 0 ja koko suorakaide on EOT20:tä (ei
  pysyvää aukkoa); haku yrittää taustalla, ja kenttä tuo maskin.
- Asetusten lähdelista ja asteikon selite (`BalVesi.alueella`) kysyvät
  maskista onko näkymässä mallin vettä: Helgelandin näkymässä vain EOT20,
  z5-näkymässä Pohjanlahden kanssa myös vedenkorkeus.

**Palkit ilman kerroksen dataa:** vuorovesi-, aalto- ja sadetilassa
palkkia ei ole kun kerroksen data puuttuu (maa, ei mallia, haku kesken;
`_tlPalkkiTyyli`). Ennen vuorovesitila piirsi silloin tuulen palkit, ja
ne luettiin vedenkorkeutena (raportin kuva). Aaltotilassa palkki oli jo
tyhjä maalla. Kelihyppy piiloutuu kerroksen vaihdossa (`_kerrosSirut`)
eikä vasta aikajanan piirrossa: uuden paikan sarjaa odotellessa jana ei
piirry, ja kun aaltotila kytkettiin heti paikan vaihdon perään, nappi
näkyi vielä 500 ms:n kohdalla.

**Mitattu** (puhelin, vuorovesitila; mittari laskee näkymän
merisolmut, Rantamaskin vesi, joissa ei ole vuorovettä eikä
vedenkorkeutta, samalla kaavalla kuin varjostin; vanha build 421a519
kontrollina, aukkoja / merisolmuja):

| paikka | vanha | uusi |
|---|---|---|
| Helgeland 65,3/11,8 z7 | 222 / 557 | 25 / 557 |
| Trondheiminvuono 63,58/9,95 z8 | 25 / 95 | 0 / 95 |
| Norjan rannikko 64/11,5 z6 | 232 / 1 508 | 41 / 1 508 |

Helsingissä, Perämerellä, Kattegatissa, Skagerrakissa ja Oslonvuonossa
kapseli, palkit ja solmut ovat samat kuin vanhalla buildilla.
Jäljelle jääneet 25 Helgelandin solmua ovat kaikki sisämaan järviä
(63,4–66,3° N, 12,1–13,9° E; vuoroveden paino 0, vaimennus 0) — EOT20:llä
ei ole suljetulle vedelle vuorovettä. Suorakaiteen ulkopuolella samaa
luokkaa: Sognefjord 3 / 873, Møre 3 / 708, Lofootit 14 / 696, Skotlanti
4 / 836. Kapseli Helgelandissa ennen "— m · ei vuorovettä tässä", nyt
"−0,5 m · laskee · laskuvesi 23:18", lähdemerkintä EOT20 ja aikajana
394 / 394 tuntia −1,23 … +1,21 m (ennen tuulen palkit). Kentän
viive 3 s (reititetty): Helsinki tyhjä → vedenkorkeus ilman
vuorovesivälähdystä, Helgeland 222 → 25 maskin saapuessa. Itämeren
rajapinta 502:lla: koko suorakaide EOT20:tä, ei virheitä. Englanniksi
"low tide 23:18", "Tide · EOT20 model". Savutesti ja graafimittaus läpi.

### 15.7 Mitä jäi

- Spottikortin vuorovesimoduuli on yhä vain vuorovesirannikolla (0,5 m);
  Itämeren spottien kortilla on FMI:n vedenkorkeus kuten ennen.
- Luoteis-Euroopan ja Biskajan vedenkorkeusmallit (NWS, IBI) ovat
  kortilla mutta eivät kartalla; kartta on niillä EOT20:tä (ilman
  myrskynousua).
- Välimeren ja Mustanmeren vedenkorkeusmallit (Copernicus MED, BLK PHY)
  mittaamatta; kartta näyttää niillä EOT20:n vuoroveden.
- Kentän tarkkuus 3 × 1 mpk; kartan solmuhila on enintään 0,125°, joten
  tarkempaa ei tarvita.

