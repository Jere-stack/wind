# Datan oikeellisuus — auditointi ja korjausstrategia (29.9.2026)

Pyyntö: *"Datan oikeellisuus apissa on kaiken tärkein asia. Tarkistetaan
nyt että kaikki data täsmää, on loogisesti se mitä pitäisi olla ja niin
että tarkkuustaso on kaikkein paras kartalla niin heatmapissa,
partikkeleiden osalta kuin havaintojen osalta. Tee strategia kaiken tämän
korjaamiseksi jos sovelluksesta löytyy aukkoja … vaarantamatta
sovelluksen sulavuutta."*

Kirjoitettiin päätösasiakirjaksi. Kaikki luvut on mitattu 29.9.2026 klo
18–19 UTC tuotannon varastosta (luettelo `luotu` 29.9. 10:45 UTC),
tuotannon rajapinnasta (`wind-delta.vercel.app`) ja tuotantobuildista
selaimessa. Mittausasetelma on lopussa.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan kun työ koskee datan oikeellisuutta, varaston
> tuoreutta, kapselin lukemia tai havaintoasemien dataa.

**Tila:** ehdotus. Mitään tämän tiedoston korjauksista ei ole vielä
toteutettu. Kun jokin toteutetaan, merkitse se kohtaan ja kirjaa
jälkimittaus.

## Tiivistelmä

1. **Data itsessään on oikein.** Lähteiden luku, geometria, suunnat,
   yksiköt ja aikaleimat pitävät (taulukko *Kunnossa*). Nykyvarasto osuu
   etelärannikon 28 FMI-asemalla **harhattomasti: tuuli +0,02 m/s, MAE
   0,94 m/s** (FMI), ja MET Nordic on yhtä hyvä. CLAUDE.md:n "sama
   systemaattinen harha −1,79 m/s" on mitattu pelkän ECMWF-varaston
   aikaan eikä päde enää.
2. **Aukot ovat kolmessa paikassa, ja ne ovat johdonmukaisuutta eivätkä
   mallivirhettä:**
   - *Tuoreus.* Säädata ajetaan mediaanina 3,7 h myöhässä ja välit ovat
     enimmillään 11 h; nyt varastossa on FMI 06Z vaikka FMI:llä on 15Z.
     Koska kortin rajapintasarjat ovat tuoreimmasta ajosta, **samassa
     näkymässä on kaksi ajoa**: spoteilla ero 0,45 m/s keskimäärin ja 35 %
     tunneista yli sovelluksen oman 0,5 m/s rajan.
   - *Kapseli.* Kapseli ja partikkelit lukevat zoomivyöhykkeellä n−0,5…n
     eri tasoa kuin lämpökartta (**0,59 m/s keskimäärin, max 1,25**), ja
     kapselin puuska tulee lähimmän spotin sarjasta jopa 81 km päästä.
   - *Havainnot.* Kaksi 12 asemasta on kuolleita, avomeriasemia puuttuu,
     havainnot eivät päivity istunnon aikana, ja FMI:n virhe poistaa
     aseman kartalta kuin se olisi lakkautettu.
3. **Suositus:** neljä vaihetta, joista kolme ensimmäistä ovat
   sovellukselle kevyempiä tai neutraaleja (yksi haku 24:n sijaan, yksi
   näyte pistejoukon läpikäynnin sijaan). Ainoa mitattava hinta on
   kapselin solmuhilan tihentyminen vyöhykkeellä n−0,5…n, ja senkin voi
   kääntää säästöksi jakamalla hilan lämpökartan kanssa. Neljäs vaihe on
   jatkuva varmennus, joka tekee tästä tarkistuksesta pysyvän.

## Kunnossa — mitattu, ei toimenpiteitä

| mitä | mitattu | tulos |
|---|---|---|
| HARMONIE-hilan geometria | GRIB2 section 3, bbox 17–33 / 58–71 | origo 58,00 / 17,00, di = dj = 0,05, rivit etelästä pohjoiseen — sama kuin rakentajan oletus |
| HARMONIEn u/v-suunta | hilan u/v:stä laskettu suunta vs FMI:n pistekysely, sama ajo (15Z), 120 solmua ≥ 3 m/s | ero ka −0,06°, \|ero\| 2,2°, ei kiertoa pituusasteen mukana (kulmakerroin −0,14°/°) — palvelu kääntää Lambertin komponentit maantieteellisiksi |
| HARMONIEn puuskan leima | GRIB2 template 4.8 | leima = jakson alku, loppu 1 h myöhemmin, tilasto = max. Rakentajan tunnin siirto on oikein |
| Varaston tarkkuus spoteilla | 0,05° bilineaarinen vs FMI:n pistekysely spotin koordinaatissa, 12 spottia × 36 h | ka 0,062 m/s, p90 0,14, max 0,35 (Hanko). 0,05°-hila on FMI:n pisteotanta (tavulleen sama kuin 0,025°:n yhteiset solmut). Tihentäminen ei kannata |
| Varasto vs havainnot | 28 asemaa, 29.9. 03–18Z (FMI:n tunnit), n = 441 | tuuli: FMI +0,02 / MAE 0,94, MET Nordic +0,06 / 0,96, ECMWF 0,25° +0,13 / 1,12; suunta MAE 10,7–10,8° |
| samat, meri- ja maa-asemat | meri n = 272, maa n = 169 | meri: FMI −0,09 / 1,11, MET Nordic −0,05 / 1,11; maa: FMI +0,19 / 0,67, ECMWF +0,68 / 0,92 (yliarvioi maalla) |
| Menneisyys | 27.9. 10Z – 29.9. 03Z, n = 1 148 | MET Nordic −0,11 / 0,98, ECMWF +0,30 / 1,22 |
| Perheiden järjestys menneisyydessä | 29.9. 03–09Z: FMI-ennuste (etusijalla) vs MET Nordicin analyysi, n = 165 | 1,03 vs 1,07 — FMI:n etusija ei heikennä menneisyyttä |
| Varaston puuska (FMI / MET Nordic) | vs havaittu TUNNIN maksimi (10 min puuskista), n = 440 | FMI +0,21 / MAE 0,97, MET Nordic +0,32 / 1,02 — tuntipuuska on semanttisesti oikein |
| Lämpökartta vs kapseli samalla tasolla | selain, z 10,3, 400 pistettä | ka 0,025 m/s, max 0,11 |
| Lämpökartta vs varasto | sama | ka 0,026 m/s — varjostin lukee varastoa oikein |
| Partikkelien suunta | koodi (`partikkelitAskel`) | u itään, v pohjoiseen, ruudun y alaspäin: liike on myötätuuleen |
| `api/malli.js` | koodi | O1280-rivit (Tricomi) ja pisteet rivillä, ICON-EU-/GFS-hilat, ajassa nopeus ja suunta erikseen, jakson loppu kauimmas yltävästä ajosta |
| `api/vesi.js`, `api/sade.js` | koodi | mm → cm kerran proxyssä; kg m⁻² s⁻¹ × 3600 = mm/h |

## Aukot vakavimmasta alkaen

Jokaisessa: mitä mitattiin, miksi se on väärin, korjaus ja sen vaikutus
sujuvuuteen.

### O1 — Varasto on 1–3 ajoa jäljessä, koska ajastin myöhästyy

**Mitattu.** Säädata on ajastettu 04:20 / 10:20 / 16:20 / 22:20 UTC.
22.9.–29.9. (7,7 vrk) ajettiin 29 ajastettua rakennusta (3,8 / vrk):
viive ajastuksesta mediaani 3,7 h ja enintään 5,7 h, rakennusten väli
mediaani 5,4 h ja enintään 11,1 h. 29.9. klo 18:33 UTC varasto oli
rakennettu 10:45:

| malli | varastossa | tuorein saatavilla |
|---|---|---|
| FMI HARMONIE | 06Z | 15Z |
| MET Nordic | 09Z | 18Z |
| ECMWF 0,25° | 00Z | 06Z |

**Miksi väärin.** Kartta, aikajana ja kortin pääsarja näyttävät vanhempaa
ennustetta kuin lähteeltä saisi, ja kortin rajapintasarjat (`spot.wx`,
kapselin puuska) ovat tuoreimmasta ajosta — eli samassa näkymässä on kaksi
ajoa (O2).

**Tarkkuus.** Tänään (heikko tuuli, 28 asemaa) tuoreempi ajo ei
parantanut keskivirhettä mutta pienensi harhaa:

| tunnit | varasto FMI 06Z | tuoreempi ajo | n |
|---|---|---|---|
| 12Z-ajon ensimmäiset 6 h | MAE 0,90, harha −0,30 | 12Z: 0,91, −0,07 | 168 |
| 15Z-ajon ensimmäiset 3 h | 0,87, −0,41 | 15Z: 0,88, −0,25 | 84 |
| samat, meriasemat | 1,09, −0,82 | 15Z: 1,10, −0,57 | 51 |

Yksi päivä ei ratkaise tätä (CLAUDE.md: "yksittäinen ajo ei kelpaa").
Rintamapäivinä vanha ajo voi osua tunteja väärin; se mitataan O11:llä.

**Korjaus.** Herätin joka ei riipu GitHubin ajastimesta. Havainnot-ajo
ajetaan jo ketjuna ja Säädatan perään; siihen yksi askel, joka luotaa
FMI:n tuoreimman ajon (`harmonieAjot`in 5 kB luotain) ja lähettää
Säädatan (`workflow_dispatch`) kun FMI:llä on varaston ajoa uudempi ajo
ja edellisestä rakennuksesta on ≥ 2,5 h. Kaksi ehtoa:
- Säädatan `concurrency: cancel-in-progress: true` peruisi käynnissä
  olevan rakennuksen — lähetys vain kun Säädata ei ole jonossa tai
  käynnissä (sama portti kuin `tools/ajastin.mjs`:ssä), tai
  `cancel-in-progress: false`.
- Ajastin jää varalle kuten Havainnoissa.

Tulos: FMI noin 3–4 h ajohetkestä (FMI:n oma viive noin 3 h), MET Nordic
enintään noin 3 h vanha, ECMWF 6 h:n tahdissa.

**Sujuvuus.** Ei vaikutusta: luettelo haetaan käynnistyksessä.
Hinta: palaavan käyttäjän laatat vaihtuvat useammin (versioavain `luotu`
8 × vrk nykyisen noin 4:n sijaan; puhelimen näkymä noin 1–1,5 MB).

### O2 — Kortissa ja kapselissa kaksi eri ennustetta

**Mitattu.** 12 spottia, seuraavat 24 h: varaston Paras (FMI 06Z) vs
`/api/harmonie` (FMI 15Z) samassa pisteessä ja tunnissa:

    tuuli   |ero| 0,45 m/s, yli 0,5 m/s 35 % tunneista, max 1,68
    puuska  |ero| 0,61 m/s
    trendi  "Nouseva / Laskeva / Vakaa" eri 14 / 300 tunnissa

**Missä `spot.wx` yhä näkyy Parasin rinnalla.**
- Kapselin puuska (O4).
- `_kirjaaOsuvuus` vertaa havaintoon `spot.wx`:n ennustetta, vaikka kortin
  hero näyttää Parasta — "Ennuste ollut X liian kova" koskee eri
  ennustetta kuin se jota käyttäjä katsoi.
- `windTrend(h, idx)` heron trendissä.
- Varatiet (Paras matkalla, varasto rikki) — ne ovat oikein varateinä.

**Korjaus.** Osuvuus ja trendi lukevat samaa Paras-sarjaa kuin hero
(`KorttiSarjat`, `valittuMs`). O1 kutistaa jäljelle jäävän eron
varateillä.

**Sujuvuus.** Ei vaikutusta.

### O3 — Kapseli ja partikkelit lukevat eri tasoa kuin lämpökartta

**Syy.** `WindTexture.build` kutsuu `ViewportGrid.laattaStep(zoom)`
pyöristämättä (solmuväli `dStep`), kun LampoGL, aikajana ja
lähdemerkintä käyttävät `laattaStep(Math.round(zoom))`. Vyöhykkeellä
n − 0,5 … n ne lukevat eri pyramidin tasoa:

| zoom | lämpökartta | kapseli ja partikkelit |
|---|---|---|
| 6,5–7 | 0,5° | 1,0° (`gridStep`) |
| 7,5–8 | 0,25° | 0,5° |
| 8,5–9 | 0,1° | 0,25° |
| 9,5–10 | 0,05° | 0,1° |

**Mitattu** (tuotantobuild, puhelin, Helsingin edusta 400 pistettä,
tuulisin FMI-tunti, keskituuli 4,3–4,7 m/s):

| | kapseli vs lämpökartta | kapseli vs varasto |
|---|---|---|
| z 9,7 (eri taso) | ka **0,59**, p90 0,95, max 1,25 m/s | ka 0,57 |
| z 10,3 (sama taso) | ka 0,025, max 0,11 | ka 0,024 |

Kolmessa pisteessä kahdeksalla zoomilla sama kuvio: ero syntyy vain
vyöhykkeellä, jolla tasot eroavat. Ero kasvaa tuulen ja rannikon
jyrkkyyden mukana, joten kovalla tuulella se on suurempi.

**Korjaus.** Yksi rivi: `laattaStep(Math.round(zoom))` myös
`WindTexture.build`issä. Parempi: sama solmuhila lämpökartalle ja
WindTexturelle — nyt samasta varastosta kootaan kaksi hilaa eri origoilla
ja pehmusteilla. Yhteisellä hilalla kapseli, partikkelit ja väri ovat
sama luku määritelmän mukaan.

**Sujuvuus.** Pelkkä pyöristys tihentää WindTexturen hilaa vyöhykkeellä
n − 0,5 … n enintään nelinkertaiseksi. Arvio näkymän ja pehmusteen
koosta: puhelin z 9,5 noin 1 500 solmua levossa, työpöytä 1920 × 1080
noin 7 500 (0,1°:llä 400 ja 1 900); `kokoaHila` 3 600 solmua on mitattu
2,4–3,5 ms.
Rakennus ajetaan liikkeen päätteeksi eikä joka ruudussa, ja laatat ovat
jo muistissa lämpökartan takia. Mitattava laitteella ennen julkaisua.
Yhteinen hila poistaa yhden kokoamisen kokonaan, eli se on nettona
kevyempi kuin nykyinen.

### O4 — Kapselin puuska tulee väärästä paikasta ja eri ajosta

**Syy.** `Crosshair._puuskaPiste` hakee lähimmän RAJAPINTApisteen
säteellä `max(3 × kaytettyStep, 0,5°)` (z 10: 0,75° ≈ 80 km). Suomessa
rajapintapisteitä ovat käytännössä vain 12 spottia. Perustelu "varaston
puuska ei kelpaa tähän riviin" mitattiin pelkän ECMWF-varaston aikaan
(6 h maksimi joka toisella askeleella). Nyt FMI:n ja MET Nordicin tasoilla
on tuntipuuska samasta ajosta ja paikasta kuin kapselin tuuli, ja se on
mitattuna oikein (*Kunnossa*: harha +0,21 tunnin maksimia vasten).

**Mitattu** (z 10,3, sama tunti, malli joka paikassa FMI 100 %):

| paikka | kapselin tuuli | kapselin puuska (lähde) | varaston puuska |
|---|---|---|---|
| Turku | 2,9 m/s | 3,6 m/s (Hanko Silversand, **81 km**) | 5,5 m/s |
| Hanko | 2,3–2,4 m/s | 4,3–4,6 m/s (Tulliniemi, 5 km) | 2,8–3,2 m/s |
| Porkkalan ulkopuoli | 1,0–1,4 m/s | 2,5–2,6 m/s (Porkkala, 9 km) | 1,6–2,2 m/s |
| Vaasa | 2,8 m/s | ei riviä (lähin 363 km) | 4,6 m/s |

Porkkalan ulkopuolella kapseli sanoi puuskaa 2,7 kertaa tuulta
(1,0 / 2,6 m/s), kun samassa pisteessä saman mallin suhde oli 1,6.
Kaksi ajoa muutaman minuutin välein; vaihteluväli taulukossa on niiden
välinen.

**Korjaus.** Puuska `Saalaatat.naytteista`sta puuskatilassa samasta
pisteestä ja hetkestä kuin tuuli, kun alueellisten perheiden (FMI, MET
Nordic, mallin oma hila) osuus `_osuus`issa on vähintään 0,99. ECMWF-
pohjalla (varaston puuska 3–6 h maksimi ja aukkoinen, ks. O8) joko ei
riviä tai lähin rajapintapiste tiukalla rajalla (esim. 15 km).

**Sujuvuus.** Kevyempi kuin nyt: yksi `naytteista` pistejoukon
läpikäynnin sijaan.

### O5 — FMI:n virhe näyttää lakkautukselta ja poistaa merkin

**Mitattu.** FMI vastaa virheeseen HTTP 400:lla ja
`<ExceptionReport>`-rungolla (esim. liian pitkä jakso, 817 B).
`fetchUrl` tiedostoissa `api/fmi.js`, `aallot.js`, `vesi.js` ja `wam.js`
ei tarkista tilakoodia eikä sillä ole aikarajaa (`kruunuvuori.js`
tarkistaa tilan, mutta aikaraja puuttuu siltäkin), jäsennys ei löydä
rivejä, ja proxy vastaa
`{ error: 'no data' }` HTTP 200:lla. Asiakas lukee sen lakkautukseksi
(`_fmiLoadWithFallback` → `'tyhja'`) ja poistaa aseman merkin — juuri se
mitä CLAUDE.md kieltää ("KATKO JA LAKKAUTUS OVAT ERI ASIA … Älä poista
mitään verkkovian perusteella"). WAM-rivi piiloutuu samasta syystä
"tyhjänä katteena". Ruuhkassa (FMI:n kiintiö on jaettu kaikkien
käyttäjien kesken palvelimen IP:llä) koko havaintokerros voisi kadota.

**Korjaus.** `fetchUrl` hylkää muun kuin 200:n ja rungon joka alkaa
`<ExceptionReport`, ja saa aikarajan kuten `harmonie.js`:ssä → proxy
vastaa 502 → asiakas näyttää katkoviivaisen "ei signaalia".

**Sujuvuus.** Ei vaikutusta.

### O6 — Havaintoverkko: kuolleita asemia, avomeriasemia puuttuu

**Mitattu.** Yksi FMI-kysely (etelärannikko 21,5–28,5°E, 59,5–60,6°N,
30 min, 41 kB) palauttaa **28** tuuliasemaa. Rekisterissä
(`FMI_MAP_STATIONS` + `api/fmi.js`) on 12, ja niistä kaksi ei lähetä:
Malmi (`place=malmi` → `numberMatched="0"`) ja Vuosaari (tiedossa).
Lähellä spotteja puuttuvat:

| asema | FMISID | spotit |
|---|---|---|
| Porvoo Kalbådagrund (avomeri, majakka) | 101022 | Emäsalo, itäinen Helsinki |
| Inkoo Bågaskär (avomeri) | 100969 | Porkkala |
| Hanko Russarö (avomeri) | 100932 | Hangon spotit |

Kauempana lisäksi Loviisa Orrengrund (101039), Kotka Rankki (101030) ja
Haapasaari (101042), Kemiönsaari Vänö (100945), Parainen Fagerholm
(100924) ja Turku Rajakari (100947).

Rekisterin koordinaatit poikkeavat FMI:n omista: Espoo Tapiola 1,1 km
(FMI 60,17797 / 24,78743), Helsinki-Vantaa 1,5 km (60,32937 / 24,97274).
Kuusi asemaa haetaan NIMELLÄ (`place=`) eikä FMISID:llä.

Nyt jokainen asema on kaksi pyyntöä (tuorein + 24 h): **24 `/api/fmi`-
kutsua käynnistyksessä**, joista neljä kuolleille asemille, ja osoite on
asemakohtainen.

**Korjaus.** `api/fmi.js`:iin tila (esim. `?asemat=1`, EI uutta
funktiotiedostoa — Vercelin 12 funktion katto) joka hakee kaikki
rekisterin FMISID:t yhdellä multipointcoverage-kyselyllä ja palauttaa
jokaiselle tuoreimman ja 24 h historian. Sama osoite kaikille käyttäjille
→ CDN-osuma. Rekisteriin FMISID kaikille, koordinaatit FMI:n
vastauksesta, Malmi pois (tai näkyviin vain jos data palaa).

**Sujuvuus.** Käynnistyksen havaintopyynnöt 24 → 1. Uudet merkit
kulkevat nykyisen tiheyssäännön ja väistön läpi (meriaseman pilleri
z8:sta).

### O7 — Havainnot eivät päivity, eikä niiden ikä pidä

**Syy.**
- Havaintomerkit haetaan kerran käynnistyksessä. `scheduleRefresh`
  (60 min) päivittää vain rajapintapisteet — ei havaintoja eikä
  varastoa. Paluu lataa sivun uudelleen vasta ≥ 30 min taustalla; 5–30
  min tauon jälkeen havainnot jäävät, ja työpöydän etualalla ne eivät
  päivity koskaan.
- `ageMin` lasketaan palvelimella, ja vastaus on CDN:ssä 5–10 min
  (`s-maxage` 300 / 600, mitattu `x-vercel-cache: HIT`). "X min sitten"
  on siis liian pieni välimuistin iän verran ja jäätyy hakuhetkeen.
  Yksi kohta (`Date.now() − lastIso`, index.html noin r. 21082) tekee jo
  oikein; muut lukevat `ageMin`iä.
- Nyt-tikillä pilleri näyttää historian arvon tasatunnilta
  (`_histValueAt`), kun kortin "Havainnot nyt" näyttää tuoreimman.
  Tunnin alkupuolella (nyt-tikki = kuluva tasatunti) sama asema näyttää
  kahta lukua.

**Korjaus.** Havainnot päivitetään 10 min välein etualalla ja Paluun
5–30 min haarassa (O6:n jälkeen yksi pyyntö); ikä lasketaan asiakkaassa
`lastIso`sta; nyt-tikillä pilleri näyttää tuoreimman havainnon.

**Sujuvuus.** Yksi pieni pyyntö 10 min välein; merkin päivitys käyttää
nykyistä allekirjoitusvertailua (`_iconSig`), joten muuttumaton merkki ei
rakennu uudelleen.

### O8 — ECMWF-varaston puuskassa on aukkoja

**Mitattu** (luettelo 29.9. 10:45, ECMWF 00Z, laatta l0 55/20): puuska
puuttuu jokaiselta analyysihetkeltä menneisyydessä (00/06/12/18Z: T+0:lla
ei ole puuskaa) ja tulevaisuudessa yhtäjaksoisesti **2.10. 21Z – 5.10.
00Z (18 askelta, +93 … +144 h)**. Muina hetkinä puuska/tuuli-suhde on
1,4–1,9 (3–6 h maksimi). `_paikassa` korvaa puuttuvan puuskan tuulella,
joten "Puuska"-kerros näyttää ECMWF-alueella noina hetkinä tuulen
puuskana, ja kerros vilkkuu kolmen tunnin askelin menneisyydessä.

**Korjaus rakentajassa.** Puuttuva puuska toisesta ajosta joka kattaa
saman hetken (analyysihetkelle edellisen ajon +6 h), tai puuska/tuuli-
suhde interpoloituna naapuriaskelista. Asiakas ei muutu.

**Sujuvuus.** Ei vaikutusta.

### O9 — UiRaS-proxy vanhenee vuodenvaihteessa

- `api/uiras.js`: `YEARS = [2025, 2026]`. `uiras-all-2027.csv.gz` on nyt
  404; ilman muutosta kuluvan vuoden vedenlämmöt jäävät hakematta
  1.1.2027 alkaen. Korjaus: `[vuosi − 1, vuosi]` ajon hetkestä.
- Aikaleima on muotoa `2026-09-28T20:58:54.348000+0000`, ja asiakas
  jäsentää sen `new Date(p.t)`:llä (`_uwPiirros`). Chromium ja Node
  hyväksyvät sen; Safari on historiallisesti hylännyt `+0000`-poikkeaman
  ilman kaksoispistettä. **EI MITATTU laitteella** (kontissa ei
  WebKitiä). Proxy kannattaa joka tapauksessa normalisoida
  `toISOString()`-muotoon, jolloin kysymys katoaa.

**Sujuvuus.** Ei vaikutusta.

### O10 — Keskiarvoistusikkuna ja puuskan merkitys vaihtelevat lähteittäin

- FMI-asemat ja Kruunuvuorenselkä: tuuli 10 min keskiarvo, puuska 10 min
  maksimi. Laru: rivi noin 1,7 min välein (min / ka / max), Mellsten
  minuutti; pilleri näyttää tuoreimman rivin. Larun 29.9. päivästä (676
  riviä, tuuli ≥ 2 m/s): rivi vs 10 min keskiarvo mediaani 0, p10–p90
  −0,43 … +0,45 m/s (suhteellinen \|ero\| mediaani 4 %, p90 12 %).
- Ennusteen puuska on TUNNIN maksimi. Havaitun 10 min puuskan rinnalla se
  on mitattuna +1,00 m/s, tunnin maksimia vasten +0,21 m/s — kortin
  "puuska" ja "puuska" ovat eri suureita.
- Kruunuvuorenselän CSV:ssä on rivejä `0.0, 0.0, 0` (tuuli, puuska,
  suunta) keskellä 1–2 m/s tuulta (29.9. 17:40Z naapurit 1,2 / 2,1 ja
  0,7 / 1,5). Puuska 0,0 kymmenessä minuutissa on katko, ei tyyni.

**Korjaus (matala prioriteetti).** Larun ja Mellstenin pilleri ja
"Havainnot nyt" 10 min keskiarvona (historiakaavio ennallaan); kun
havaintoa verrataan ennusteeseen, havainnon puuska tunnin maksimina;
Kruunuvuorenselän (0, 0, 0)-rivi puuttuvaksi kun naapurien puuska on
≥ 1,5 m/s.

**Sujuvuus.** Ei vaikutusta.

### O11 — Jatkuvaa varmennusta ei ole

Tämä tarkistus on kertamittaus. Mikään ei huomaa, jos rakentaja, lähde
tai proxy alkaa tuottaa väärää dataa (suunnan kierto, yksikkö, aikasiirto,
pysähtynyt varasto) — ne näyttäisivät kartalla uskottavilta. `Osuvuus` on
laitekohtainen, vaatii kortin avauksia ja vertaa `spot.wx`:ää eikä
näytettyä Parasta (O2).

**Ehdotus.**
1. Rakentaja kirjoittaa varastoon `pisteet.json`in: rekisterin asemat ja
   spotit, jokainen perhe erikseen ja Paras-sekoitus, 72 h (arviolta alle
   100 kB).
2. Havainnot-ajo (jo ketjutettu, pelkät Noden moduulit) arkistoi sen
   havainnot-haaraan (`varmennus/`) ja vertaa FMI:n havaintoihin yhdellä
   kyselyllä: harha ja MAE perheittäin, ennusteen iän ja asematyypin
   (meri / maa) mukaan.
3. Hälytysrajat ajon yhteenvetoon (esim. suunnan keskivirhe > 30°,
   harha > 1,5 m/s, varasto > 8 h vanha, asema hiljaa > 24 h).

Tulos kertoo myös mikä malli on oikeasti paras spoteilla (CLAUDE.md:
"Kumpi taso on tarkempi EI OLE RATKAISTU"), ja se voi myöhemmin korvata
laitekohtaisen Osuvuuden jaetulla ja isommalla otoksella.

**Sujuvuus.** Ei vaikutusta sovellukseen.

## Suositusjärjestys

| vaihe | kohdat | sujuvuus | arvio |
|---|---|---|---|
| **1 — pienet, riskittömät** | O3 (pyöristys), O5 (virheenkäsittely), O9 (UiRaS), O2 (Osuvuus ja trendi Parasista), O7:n ikä ja nyt-tikin pilleri, Malmi pois | O3 mitataan laitteella, muut neutraaleja | 1 päivä mittauksineen |
| **2 — tuoreus ja kapseli** | O1 (herätin + `concurrency`), O4 (puuska varastosta), O3:n yhteinen hila | O4 ja yhteinen hila kevyempiä kuin nyt | 1–2 päivää |
| **3 — havaintoverkko** | O6 (yksi kysely, uudet asemat, koordinaatit), O7 (päivitys 10 min välein) | pyynnöt 24 → 1 | 1–2 päivää |
| **4 — varmennus** | O11, sitten O8 ja O10 | ei vaikutusta | 2–3 päivää |

Järjestyksen perustelu: vaihe 1 poistaa ne erot jotka käyttäjä näkee
samalla ruudulla (kapseli vs väri, kortin hero vs osuvuus) ja kaksi
hiljaista vikaa (merkin katoaminen, vuodenvaihde). Vaihe 2 poistaa
kahden ajon ongelman juurisyyn. Vaihe 3 parantaa havaintojen kattavuutta
ja on samalla sovellukselle kevyempi. Vaihe 4 tekee tästä tiedostosta
jatkuvan ja antaa datan päätöksille joita ei nyt voi tehdä (mallien
järjestys, paikallinen harhakorjaus).

## Mitä ei kannata tehdä

- **Varaston tihentäminen alle 0,05°:n** (esim. 0,025° leveyssuunnassa,
  jotta ruutu olisi 2,8 × 2,8 km eikä 5,6 × 2,8 km). Spottien kohdalla
  nykyinen taso on FMI:n omasta pistekyselystä 0,062 m/s — hyöty ei maksa
  kaksin- tai nelinkertaista latausta.
- **Perheiden järjestyksen vaihto.** FMI ja MET Nordic ovat asemilla yhtä
  hyviä (0,94 vs 0,96) myös menneisyydessä (1,03 vs 1,07).
- **Harhakorjaus ennen O11:tä.** Nykyinen harha asemilla on +0,02 m/s;
  korjattavaa ei ole ilman pidempää ja kovemman tuulen otosta.

## Dokumentaatio joka on ristiriidassa mittauksen kanssa

- CLAUDE.md, "Kumpi taso on tarkempi …": "Molemmilla on sama
  systemaattinen harha −1,79 m/s havaintoa vasten" — mitattu ECMWF-
  varaston aikaan. Nykyvarasto: FMI +0,02, MET Nordic +0,06, ECMWF 0,25°
  +0,13 m/s (28 asemaa, n = 441).
- CLAUDE.md, "`/api` ei kuulu service workerin välimuistiin": säälaatat
  "versioituja (`?v=<ajoAika>`)" — koodi käyttää `luotu`a (oikein, ks.
  "LAATTOJEN VERSIOAVAIN ON RAKENNUSHETKI").
- `Crosshair`in kommentti "VARASTON PUUSKA EI KELPAA TÄHÄN RIVIIN" ja
  docs/data.md "Varaston puuska on joka toisella askeleella tuuli" pätevät
  vain ECMWF-perheeseen.
- `tools/tiilet.mjs`: "0,05° on 2,8 km Suomen leveyksillä" pätee
  pituussuunnassa; leveyssuunnassa 0,05° on 5,6 km (mittaus osoittaa ettei
  sillä ole spoteilla merkitystä).

## Mittausasetelma

- **Varasto:** tuotannon laatat `raw.githubusercontent.com/…/saadata/`
  (luettelo `luotu` 29.9. 10:45 UTC) purettiin kuten sovellus
  (`_naytePerhe` / `_paikassa`: paikassa bilineaarinen, nopeus
  keskiarvona, suunta yksikkövektoreista; ajassa nopeus ja suunta
  erikseen).
- **Havainnot:** FMI `fmi::observations::weather::multipointcoverage`,
  bbox 21,5–28,5°E / 59,5–60,6°N: tunnin askel 27.9. 10Z – 29.9. 18Z
  (1 589 riviä, 28 asemaa) ja 10 min askel puuskan tunnin maksimiin.
  Meriasemiksi luettiin saaret, majakat ja satamat nimestä.
- **FMI:n ajot:** `opendata.fmi.fi/timeseries` `origintime`lla (12Z,
  15Z) ja latauspalvelun GRIB2 (0,05° ja 0,025°, 15Z).
- **Tuotannon rajapinta:** `/api/harmonie?pts=` (12 spottia, tz=UTC),
  `/api/fmi` (tuorein ja historia, CDN-otsakkeet).
- **Selain:** `npm run build` + `vite preview`, Chromium 1194, 393 × 852,
  `hasTouch`, `deviceScaleFactor` 3, Europe/Helsinki, service worker
  estetty, `?perf=1`. Kontin Chromium ei luota välityspalvelimen CA:han,
  joten ulkoiset HTTPS-pyynnöt reititettiin Noden kautta (TLS pysyi
  tarkistettuna). Zoom asetettiin `setView`illä ilman animaatiota ja
  odotettiin kunnes lämpökartan hila oli pyöristetyn zoomin tasolla.
- **Ajohistoria:** GitHub Actions, Säädata-työnkulun ajastetut ajot
  22.9.–29.9.
- **Rajoitus:** yksi päivä ja heikko tuuli (asemien keskituuli noin
  2–5 m/s). Virheet kasvavat tuulen mukana, joten luvut ovat alarajoja
  kovan tuulen päiville — se on O11:n perustelu.
