# Lisättävä data: mitä kannattaa hakea ja mistä

Tämä on kartoitus, ei toteutuspäätös. Jokainen lähde on **kokeiltu oikealla
kutsulla 11.9.2026** ja luvut alla ovat niistä vastauksista — ei
dokumentaatiosta eikä muistista. Kolme ilmeiseltä näyttävää lähdettä kaatui
mittaukseen, ja ne ovat tässä samalla painolla kuin ne jotka jäivät: hylkäys
säästää enemmän työtä kuin ehdotus.

Mittausympäristö: kontti, `curl` + `python3` + `@openmeteo/file-reader`.
Kaikki kutsut tehtiin ilman tunnistautumista.

> **TILANNE 11.9.2026 — kohdat 1, 2, 6 ja 7 on toteutettu.**
> Aaltoennuste (`api/wam.js`), vedenkorkeus (`api/vesi.js`), sadetutka
> (`TutkaKerros`) ja puuskaisuus ovat tuotannossa. Toteutuksen omat
> mittaukset ja niissä löytyneet ansat ovat `docs/data.md`:n lopussa —
> tämä tiedosto on yhä se kartoitus jonka perusteella ne valittiin, eikä
> sitä ole kirjoitettu uusiksi jälkikäteen. Kolme asiaa muuttui
> toteutuksessa ja ne on korjattu myös tähän tekstiin alla: WAMin
> ennustepituus, aaltojen suuntakonventio ja `starttime`-vaatimus.
> Kohdat 3, 4, 5, 8, 9 ja 10 ovat yhä tekemättä.

---

## Mistä sovellus lukee nyt

| taso | lähde | mitä |
|---|---|---|
| kartta (lämpökartta, kapseli, partikkelit) | oma laattavarasto, `ecmwf_ifs025` S3:sta | tuuli u/v, puuska |
| aikajana | sama varasto | tuuli, puuska |
| spottikortti | `/api/harmonie` + Open-Meteo | tuuli, puuska, lämpötila, pilvet |
| havainnot | `/api/fmi` (13 asemaa) | tuuli, puuska, suunta, lämpötila, kastepiste |
| aallot | `/api/aallot` (10 poijua) | korkeus, jakso, suunta, vedenlämpö — **havainto** |
| vedenlämpö | UiRaS + Open-Meteo marine | uimaveden lämpötila |
| paikalliset | Kruunuvuori, Mellsten, Laru | tuuli |

Kaksi aukkoa erottuu: **aaltoENNUSTETTA ei ole lainkaan** (poijut ovat
havaintoa, ja `5150fc1` perui Open-Meteon aaltoerän), ja **vedenkorkeutta ei
ole missään muodossa**.

---

# TOP 10 — data

Järjestys on vaikutus päätökseen kerrottuna mitatulla toteutettavuudella.
"Menenkö, minne, millä kalustolla" on mittari; kaikki mikä ei siirrä sitä
neulaa on alempana riippumatta siitä kuinka hienoa dataa se on.

## 1. Aaltoennuste spotille — korkeus, jakso ja suunta

Sovellus näyttää jo poijun jakson, ja sen oma kommentti kertoo miksi:

> `0,4 m / 2,5 s on jyrkkää hakkaavaa, 0,4 m / 6 s on loivaa`

Sama luku ennusteena puuttuu kokonaan. **Lähde on FMI:n WAM-pistekysely**,
ja se mitattiin kaikilla 12 spotilla:

```
spotti                  tunteja   Hs (m)        jakso (s)
Hanko Tulliniemi         61/72    0,33–0,73     3–6
Hanko Silversand          0/72    EI DATAA
Haukilahti                0/72    EI DATAA
Lauttasaari              61/72    0,11–0,64     2–6
Otaniemi                 61/72    0,04–0,28     1–6
Munkkiniemi               0/72    EI DATAA
Hietaniemi               61/72    0,07–0,50     2–6
Kruunuvuorenranta        61/72    0,13–0,70     3–6
Puuskaniemi              61/72    0,07–0,42     2–6
Kallahti                 61/72    0,10–0,60     2–6
Porkkala                 61/72    0,23–0,79     3–6
Emäsalo                  61/72    0,23–0,95     4–6
```

**9/12 spottia, 61 h ennuste, ei aukkoja välissä** (tarkistettu: NaN:t ovat
kaikki sarjan hännässä, ei keskellä). Kolme puuttuvaa ovat mallin maamaskin
sisällä — ja ne ovat täsmälleen ne kolme suojaisinta spottia, joilla aalto ei
ole se muuttuja joka ratkaisee. Aukko on siellä missä se haittaa vähiten.

Erottelukyky on oikeasti olemassa eikä vain interpolaatiota: Otaniemi
0,04–0,28 m ja Emäsalo 0,23–0,95 m samalta tunnilta.

```
https://opendata.fmi.fi/wfs?service=WFS&version=2.0.0&request=getFeature
  &storedquery_id=fmi::forecast::wam::point::timevaluepair
  &latlon=60.154,24.868&timestep=60&endtime=<+61h>
```

Sarjat: `SigWaveHeight` (m), `WavePeriod` (s), `WaveDirection` (°).

Toteutuksessa tarkentui kolme asiaa. **Suunta on MISTÄ**, ja se
tarkistettiin kuutta aaltopoijua vasten samalta tunnilta: poikkeamat
1, 2, 16, 21, 35 ja 40 astetta, kun käänteisellä tulkinnalla ne
olisivat 140–179. **`starttime` on pakollinen**: ilman sitä sarja alkaa
seuraavasta tunnista eikä kuluvasta, jolloin kortin rivi oli tyhjä
juuri nykyhetkessä. Ja **"T+0 on NaN" ei ollut sääntö** vaan yhden ajon
reuna — nimenomaisella `starttime`lla NaN:eja ei ole sarjan alussa
lainkaan.

### Hylätty vaihtoehto: ECMWF WAM omaan laattaputkeen

Tämä näytti selvästi paremmalta ja se on mitattu vääräksi.

`tools/tiilet.mjs` lukee jo `s3://openmeteo`-peilistä, ja samassa peilissä on
`data_spatial/ecmwf_wam025/`. Tiedosto avattiin ja sen lapset luettiin:

```
wave_peak_period [721x1440]   wave_period    [721x1440]
wave_direction   [721x1440]   wave_height    [721x1440]
```

**Sama 721×1440 hila kuin tuulella jonka putki jo osaa.** Ei kiintiötä, ei
uutta ajonaikaista riippuvuutta, sama `.om`-muoto, sama ajohakemistorakenne.
Näytti ilmaiselta.

Sitten hila luettiin spottien kohdalta:

```
spotti                lähin solmu    Hs
Hanko Tulliniemi      59,75/23,00    0,60 m
Hanko Silversand      59,75/23,00    0,60 m    (sama solmu)
Porkkala              60,00/24,50    0,36 m
kaikki 9 muuta                       NaN
```

**3/12 spottia** — ja kahdella niistä sama solmu. Kontrolli 5×5
naapurustosta, eli "kuinka kaukana on lähin märkä solmu":

```
Haukilahti          17,3 km    Lauttasaari   18,3 km
Kruunuvuorenranta   18,3 km    Kallahti      21,6 km
Emäsalo             23,5 km
```

Lähin solmu jolla on aalto on **17–24 km ulkomerellä**. Sen lukeman
esittäminen "Lauttasaaren aaltona" olisi väärä luku oikean näköisessä
ruudussa — pahin mahdollinen virhe, koska se ei näytä virheeltä. 0,25° on
Suomenlahdella noin 28 × 14 km eli lahti on kolme solmua leveä.

FMI:n WAM ajaa Itämeren omalla tiheämmällä hilallaan, ja siksi sen
pistekysely osaa mitä S3:n globaali 0,25° ei osaa. **Aallot tulevat FMI:n
rajapinnasta, eivät laattaputkesta.**

---

## 2. Vedenkorkeus — havainto ja 48 h ennuste

Suomessa ei ole vuorovettä, joten tätä ei ole missään kansainvälisessä
appissa. Se ei tarkoita ettei se liikkuisi. Helsinki Kaivopuisto, 28
vuorokautta, tuntiaskel, 673 näytettä:

```
matalin        −13,1 cm       28.8. klo 22 UTC
korkein        +42,8 cm       23.8. klo 13 UTC
vaihteluväli    55,9 cm
keskihajonta    10,7 cm
suurin muutos 6 tunnissa       32,9 cm
suurin muutos 24 tunnissa      41,3 cm
```

Puoli metriä kuukaudessa ja kolmannes metriä kuudessa tunnissa. Matalalla
hiekkarannalla — Haukilahti, Kallahti, Silversand — se on ero siinä kuinka
kaukaa foili irtoaa pohjasta ja kuinka pitkälle rantavesi ulottuu. Se on myös
ainoa luku tässä listassa jota kukaan kilpailija ei näytä.

**Havainto**, 14 mareografia yhdellä kutsulla, 1 min askel:

```
fmi::observations::mareograph::instant::multipointcoverage
kentät: WATLEV | TW | WLEVN2K_PT1S_INSTANT
asemat: Kemi Ajos, Raahe Lapaluoto, Porvoo Emäsalo Vaarlahti,
        Helsinki Kaivopuisto, Vaasa Vaskiluoto, Rauma Petäjäs,
        Turku Ruissalo, Oulu Toppila, Pietarsaari, Kaskinen,
        Föglö Degerby, Hanko Pikku Kolalahti, Hamina, Pori Mäntyluoto
```

**Ennuste**, 48 h, tuntiaskel:

```
fmi::forecast::sealevel::point::timevaluepair&latlon=<lat>,<lng>
sarjat: SeaLevel, SeaLevelN2000     n = 96 (2 × 48 h)
```

### ANSA: havainto on millimetrejä, ennuste senttimetrejä

Vastaus-XML **ei kerro yksikköä lainkaan** — `uom`-attribuutti puuttuu
molemmista. Yksikkö on haettava erikseen metatietopalvelusta:

```
/meta?observableProperty=observation&param=SeaLevel  ->  uom="mm"
/meta?observableProperty=forecast&param=SeaLevel     ->  uom="cm"
```

Sama fysikaalinen suure, kertoimen 10 ero, ja molemmat palauttavat
kolminumeroisia lukuja jotka näyttävät kelvollisilta. Ensimmäinen mittaus
tässä dokumentissa laski 28 vrk vaihteluväliksi 559 **cm** ja se meni läpi
ilman että mikään huusi — Helsingissä 4,3 m vedenkorkeus on ennätystulva.

Ristiintarkistus joka sen paljasti, ja joka kannattaa toistaa jos tätä
kosketaan:

```
havainto  2026-09-11T10:00Z   286 mm = 28,6 cm
ennuste   2026-09-11T11:00Z    29,0 cm
```

Sarja on jatkuva vasta kun havainto jaetaan kymmenellä.

Kysely rajaa 168 h kerrallaan (`Too long time interval requested! No more
than 168.000000 hours allowed`), eli kuukausi on neljä kutsua.

---

## 3. Merivaroitukset — FMI:n CAP-syöte

Haettu 11.9.2026, voimassa ollut varoitus sellaisenaan:

> **Keltainen tuulivaroitus merelle: Suomenlahti, pe 11.10 – la 0.00**
> Huomautus veneilijöille: Lännen ja luoteen välistä tuulta aluksi 11 m/s.

Tämä on sovelluksen aihe kirjoitettuna viranomaisen omilla sanoilla. RSS
listaa voimassa olevat 0–5 vrk, ja jokainen linkki on täysi CAP-dokumentti:

```
https://alerts.fmi.fi/cap/feed/rss_fi-FI.rss     1,3 kB
yksi varoitus (CAP XML)                         23,1 kB
kentät: event, severity, urgency, certainty, onset, expires,
        areaDesc, headline, polygon, geocode
kielet: fi / sv / en samassa dokumentissa
alue:   6 polygonia (merialueet erikseen)
lisenssi: CC BY 4.0
```

`severity` on `Moderate` (= keltainen), `onset`/`expires` ovat
aikaleimoja Suomen ajassa, ja polygoni kertoo osuuko varoitus katsottuun
spottiin — ei tarvitse arvata merialueen nimestä.

---

## 4. Paine, näkyvyys, sade ja kosteus — nollan kutsun hinnalla

Tämä on listan halvin kohta ja siksi näin korkealla. Sovellus pyytää jo
molemmat kutsut; se vain heittää suurimman osan vastauksesta pois.

**FMI-havaintoasema antaa 13 parametria, `api/fmi.js` pyytää 5.** Harmaja
11.9.2026 klo 10 UTC, kaikki mitä sama kysely palauttaa:

```
t2m=15,2   ws_10min=10,0   wg_10min=12,1   wd_10min=299   td=8,7    <- nyt käytössä
rh=65      p_sea=1010,8    vis=20000       n_man=0        wawa=0    <- ilmaiseksi
r_1h=—     ri_10min=—      snow_aws=—
```

**HARMONIE antaa 21 sarjaa, `api/harmonie.js` pyytää 6.** Lauttasaari:

```
Pressure 1011,6 | Visibility 59 633 m | Humidity 56 % | PrecipitationAmount 0,0
LowCloudCover / MediumCloudCover / HighCloudCover erikseen
RadiationGlobal 518 | DewPoint 7,6 | WindUMS / WindVMS
```

Kolme näistä muuttaa päätöstä:

- **`p_sea` ja sen trendi.** Paineen lasku ennen rintamaa on se mitä
  kokenut lukee ennen kuin tuuli kääntyy. Yksi luku, kymmenen minuutin
  tiheydellä, jo haetussa vastauksessa.
- **`vis` / `Visibility`.** Sumu on ainoa syy jonka takia avomerelle ei
  mennä vaikka tuuli olisi täydellinen. Harmajalla nyt 20 km (asemalla
  katto), HARMONIE 59,6 km — molemmat kertovat saman: nyt näkee.
- **`PrecipitationAmount` / `r_1h`.** "Sataako kun olen vedessä" on eri
  kysymys kuin pilvisyys, ja sovellus näyttää nyt vain pilvisyyden.

Ei uutta lähdettä, ei uutta kiintiötä, ei uutta vikapistettä. Vain
pidempi `parameters=`-lista kahdessa tiedostossa.

---

## 5. Vedenlämpö 14 rannikkoasemalta

Sama mareografikutsu kuin kohdassa 2 palauttaa `TW`-kentän — vedenlämmön —
**samassa vastauksessa ilman lisäkutsua**. Yksikkö `degC`, tarkistettu
metatietopalvelusta.

Sovelluksen nykyinen vedenlämpö on UiRaS (pääkaupunkiseudun uimarannat) ja
Open-Meteon marine-piste. Mareografit laajentavat kattavuuden Hankoon,
Emäsaloon, Turkuun ja Föglöhön — eli niihin spotteihin joilla UiRaS-asemaa
ei ole. Aaltopoijut antavat jo `TWATER`:in, mutta poijuja on kymmenen ja ne
ovat kausiluontoisia; mareografit ovat ympärivuotisia.

Puku-kortti saa siis lukeman useammassa paikassa ilman että yhtäkään uutta
pyyntöä tehdään.

---

## 6. Sadetutka animoituna

```
https://openwms.fmi.fi/geoserver/Radar/wms
kerros:    suomi_dbz_eureffin
aika:      2026-09-04T10:15Z / 2026-09-11T10:10Z / PT5M
projektio: EPSG:3857 tuettu (testattu GetMap:illa)
vastaus:   image/png, 512×341, 28,6 kB
```

**5 minuutin askel ja 7 vuorokautta historiaa** riittää animaatioon ilman
että mitään tarvitsee tallentaa itse. `L.TileLayer.WMS` osaa tämän
sellaisenaan, ja `TIME`-parametri on vain merkkijono URL:issä.

Foilaajalle tutka ei ole "sataako" vaan **missä kuurot ovat**: kuuron reuna
on puuskarintama, ja se näkyy tutkassa ennen kuin se näkyy ennusteessa.

Huom: `styles=raster` palauttaa harmaan + alfan (`8-bit gray+alpha`). Väri
pitää tehdä itse tai valita toinen tyyli — ja sovelluksen sääntö pätee:
kartalla sävy tarkoittaa tuulennopeutta, joten tutka ei saa olla
väriramppi. Harmaa alfa on itse asiassa juuri oikea asu.

---

## 7. Puuskaisuus omana lukuna

Ei uutta lähdettä — luku on jo datassa.

Spottiindeksi rankaisee puuskasta (`osat.puuska`), mutta itse suhdetta ei
näytetä missään. `puuska / keskituuli` on se mitä siipikokopäätös oikeasti
seuraa: 8 m/s tasaista ja 8 m/s jossa puuskat ovat 14 ovat eri keli ja eri
siipi.

Mitatut vertailuluvut ovat jo `CLAUDE.md`:ssä:

```
HARMONIEn tuntipuuska samassa pisteessä   1,25
mitattu havainto                          1,16
varaston puuska (6 h maksimi)             1,55–1,77
```

Ja siellä on myös ansa jo kirjattuna: **varaston puuska puuttuu joka
toiselta kolmen tunnin askeleelta** ja laattojen rakennus täyttää aukon
tuulella, jolloin suhde on tasan 1,00. Suhdeluku on siis laskettava samasta
sarjasta jota se kuvaa — kapselin puuska tulee jo `_puuskaPiste`:stä juuri
tästä syystä.

---

## 8. Varusteveikkaus painon mukaan

Ei uutta lähdettä. Tämä on se mitä kilpailijat lisäävät kun raakadata on
kunnossa, ja se on sovelluksen nykyisen `pukuSuositus`-logiikan sisar:

> WingFoilWeather "highlights sessions with a simple star rating" ja antaa
> "gear recommendations" based on rider weight and wing size.

Sovelluksessa on jo spottiindeksi osineen ja puku-kortti. Siipikoko (m²),
lautatilavuus (l) ja siipiprofiili (cm²) ovat funktio painosta, tuulesta ja
taitotasosta — ja paino on ainoa uusi tieto, joka kysytään kerran ja
säilytetään asetuksissa.

Varoitus asetusten säännöstä: **avaimia ei saa vaihtaa myöhemmin.** Jos
paino tallennetaan, sen avain on lopullinen.

---

## 9. Ennusteen epävarmuus — ja miksi se on kytkimen takana

Sovelluksessa on jo "mallien erimielisyys", joka on köyhän miehen
ensemble: kaksi tai kolme deterministista ajoa. Oikea ensemble on 30–50
jäsentä samasta mallista, ja sen hajonta vastaa kysymykseen jota kukaan
deterministinen malli ei osaa: **kuinka varma lauantai on.**

Tämä yritettiin saada ilmaiseksi ja **se ei onnistu**. S3-peili tarkistettiin
kahdesta paikasta:

```
data_spatial/ecmwf_ifs025_ensemble/  ->  vain precipitation_probability
data/ecmwf_ifs025_ensemble/          ->  vain precipitation_probability/, static/
data/ncep_gefs025/                   ->  vain precipitation_probability/, static/
```

**Jäsenkohtaista tuulta ei peilissä ole.** Peili sisältää ensemblesta vain
johdetun sadetodennäköisyyden. Tuulen hajonta on siis haettava
`ensemble-api.open-meteo.com`:sta, joka on **oma kiintiönsä** — ja joka
vastasi tästä kontista `Daily API request limit exceeded`, eli sen
hyötykuormaa ei tässä päästy tarkistamaan lainkaan. Merkitään
varmistamattomaksi.

Koska se on uusi rajapintakiintiö sen jälkeen kun tuuli siirrettiin omaan
varastoon, sitä koskee sama sääntö kuin aaltoennustetta: **kytkimen takana,
pois päältä ei yhtäkään kutsua.**

---

## 10. Salamat livenä

```
fmi::observations::lightning::simple&bbox=<lon,lat,lon,lat>&starttime=<-1h>
koko Suomi, viimeinen tunti, ukkosettomana päivänä:    590 B, 0 iskua
Suomenlahti 21–27E / 59–61N, viimeiset 24 h:         1,2 MB, 2 608 iskua
parametrit: peak_current, multiplicity, cloud_indicator, ellipse_major
```

Hinta on nolla kun ei ukkosta ja iso kun on — eli juuri oikein päin.
**Ikkuna on pidettävä tunnissa**, ei vuorokaudessa: 24 h haku
ukkospäivänä on 1,2 MB eli suurempi kuin koko sovelluksen ensilataus.

Vedessä ollessa ukkonen on ainoa sääilmiö joka tappaa, eikä sitä näy
tuuliennusteesta.

---

# Mitattu ja hylätty

Nämä näyttivät hyviltä ja kaatuivat. Ne ovat tässä jotta niitä ei tutkita
uudelleen.

## MEPS toisena mallina — se ON HARMONIE

FMI:n rajapinnassa on sekä `fmi::forecast::harmonie::surface::point` että
`fmi::forecast::meps::surface::point`. Näyttäisi kahdelta mallilta.

```
Lauttasaari, 48 h, tuntiaskel:  ero ka 0,00  med 0,00  max 0,00 m/s
kontrolli Hanko, 36 h:          ero max 0,000 m/s
```

**Täsmälleen sama data, kaikki 48 + 36 tuntia.** MEPS on MetCoOp-yhteistyön
malli, ja FMI:n "harmonie"-kysely tarjoillaan siitä. Jos tämä otettaisiin
"toiseksi malliksi" mallien erimielisyyteen, erimielisyys näyttäisi
pysyvästi nollaa — eli sovellus väittäisi täydellistä varmuutta aina.

Sama koskee peilin `metno_nordic_pp`:tä: 2321×1796 hila ja täydet
tuulikentät, mutta se on jälkiprosessoitu MEPS eli sama malli. Ei
riippumaton mielipide, vaikka jälkikäsittely eroaakin.

Riippumattomat korkean erotuskyvyn vaihtoehdot peilissä ovat
`dwd_icon_eu` (eri dynaaminen ydin), `dmi_harmonie_arome_europe` ja
`knmi_harmonie_arome_europe`.

## FMI hydrodyn — meriveden lämpötila ja virtaus ennusteena

`fmi::forecast::hydrodyn::point::timevaluepair` lupaa `TemperatureSea`,
`Salinity`, `CurrentSpeed`, `CurrentDirection`. Kuulostaa siltä että
vedenlämmön ennuste ratkeaisi tällä.

```
Lauttasaari   Tsea 15,9–16,4 °C   virta 0,0–0,1 m/s
Emäsalo       Tsea 16,4–16,7 °C   virta 0,0–0,1 m/s
10 muuta spottia                  EI DATAA
```

**2/12 spottia.** Malli on rannikolla maamaskin alla samasta syystä kuin
ECMWF WAM. Ja vaikka kattavuus olisi täysi: virtaus on 0,0–0,1 m/s eli
mittauksen tarkkuuden rajoilla. Itämerellä ei ole virtausta jota foilaaja
tuntisi — se on Välimeren ja Atlantin appien ominaisuus koska siellä on
vuorovesi.

Vedenlämpö tulee siis mareografeista (kohta 5), ei tästä.

## Vuorovesi

Ei ole. Itämeri on käytännössä vuorovedetön; kohta 2:n vedenkorkeus on sen
suomalainen vastine ja se ajaa tuulesta ja paineesta, ei kuusta. Jos
vuorovesiriviä joskus harkitaan, se olisi väärä sana oikealle luvulle.

## Holfuy

Paikallisten tuuliasemien verkosto, suosittu liito- ja leijapiireissä.

```
https://api.holfuy.com/live/?s=all&m=JSON  ->  200 OK, runko: "No access"
```

Jokainen asema vaatii omistajansa salasanan. Ei julkista hakua, ei
lisättävissä ilman sopimusta asemakohtaisesti.

## Ilmanlaatu ja siitepöly

`air-quality-api.open-meteo.com` toimii ja on oma kiintiönsä (72 h,
`uv_index`, `pm10`, `birch_pollen`, `grass_pollen` — testattu). Mutta:
`pm10` oli 8,7 µg/m³ ja siitepöly nollassa, eikä kumpikaan muuta sitä
meneekö foilaaja veteen. **UV-indeksi** on ainoa jolla on käyttöä (kesällä,
kolmen tunnin sessio), ja senkin alle jää aurinkorivi joka on jo olemassa.

Ei top-10:een. Jos joskus, niin vain `uv_index` ja aurinkorivin osana.

---

# Toinen kerros — kontekstia, ei päätöstä

Nämä toimivat ja on testattu, mutta ne eivät vastaa kysymykseen "menenkö".
Ne vastaavat kysymykseen "miltä siellä näyttää".

| lähde | mitattu | huomio |
|---|---|---|
| **Windy Webcams API** | vaatii avaimen | ilmaistaso vain matala resoluutio, kuvatunnus vanhenee 10 min. Vaatii oman proxyn kuten Laru ja Mellsten. Ehtona: ilmaistason dataa ei saa rajata vain maksaville käyttäjille |
| **Digitraffic kelikamerat** | 200 OK, 810 kameraa | lähimmät: Ruoholahti 1,9 km, Lauttasaari 2,3 km. **Ne osoittavat tiehen, eivät veteen** — arvo on marginaalinen |
| **Digitraffic AIS** | 200 OK, alukset 10 km säteellä | väylällä foilaaminen; turvallisuutta, ei keliä |
| **OpenSeaMap seamark** | 200 OK, PNG 334 B | merimerkit laattoina, ei avainta. Kevyt |
| **EMODnet bathymetry WMS** | 200 OK, PNG 162 kB | syvyyskäyrät, EPSG:3857, ei avainta. **Raskas** — 162 kB / laatta |
| **SYKE leväseuranta** | ei löytynyt rajapintaa | Järvi-meriwikin ja `rajapinnat.ymparisto.fi`:n polut 404. `vesla`-rajapinta vastaa mutta ei levädataa. Ei tässä ratkennut |

**Kaikilla Digitraffic-kutsuilla on pakko lähettää `Accept-Encoding: gzip`.**
Ilman sitä `406 Not Acceptable` ja runko `Use of gzip compression is required
with Accept-Encoding: gzip header`. Sama luokka ansa kuin Larun
User-Agent-vaatimus: pyyntö ei onnistu koskaan ilman otsaketta.

---

# TOP 10 — lähteet

Sama asia toisesta suunnasta: mistä osoitteista yllä oleva data tulee, mitä
se maksaa ja mitä sen kanssa mitattiin.

| # | lähde | mitä | kiintiö | avain | mitattu |
|---|---|---|---|---|---|
| 1 | **FMI WFS** `fmi::forecast::wam::point::timevaluepair` | aaltoennuste Hs/jakso/suunta | ei | ei | 9/12 spottia, 61 h |
| 2 | **FMI WFS** `mareograph::instant::*` + `forecast::sealevel::point::*` | vedenkorkeus + vedenlämpö, havainto ja 48 h | 168 h / kutsu | ei | 14 asemaa yhdellä kutsulla; mm vs cm |
| 3 | **FMI CAP** `alerts.fmi.fi/cap/feed/rss_fi-FI.rss` | merivaroitukset polygoneineen | ei | ei | 1,3 kB syöte, 23 kB / varoitus, CC BY 4.0 |
| 4 | **FMI WFS** `observations::weather::timevaluepair` | *jo integroitu* — 8 käyttämätöntä parametria | ei | ei | 13 saatavilla, 5 käytössä |
| 5 | **FMI WFS** `forecast::harmonie::surface::point` | *jo integroitu* — 15 käyttämätöntä sarjaa | ei | ei | 21 saatavilla, 6 käytössä |
| 6 | **FMI WMS** `openwms.fmi.fi/geoserver/Radar/wms` | sadetutka, `suomi_dbz_eureffin` | ei | ei | PT5M, 7 vrk, EPSG:3857, 28,6 kB/kuva |
| 7 | **FMI WFS** `observations::lightning::simple` | salamahavainnot | ei | ei | 590 B tyhjänä, 1,2 MB / 24 h ukkosella |
| 8 | **s3://openmeteo** (peili) | *jo integroitu* — laattaputken lähde | ei | ei | ensemble-tuulta EI ole; `ecmwf_wam025` 3/12 spottia |
| 9 | **Open-Meteo Ensemble API** | ennusteen hajonta | **oma kiintiö** | ei | **varmistamatta** — `limit exceeded` |
| 10 | **Windy Webcams API** | kuva vedestä | ilmaistaso | **kyllä** | matala resoluutio, 10 min tunnus, vaatii proxyn |

Kahdeksan kymmenestä on Ilmatieteen laitosta, ilman avainta, ilman
kiintiötä, ja **viisi niistä on rajapintoja joita sovellus jo kutsuu.**
Se on tämän kartoituksen pääasiallinen tulos: suurin osa siitä mitä
kannattaa lisätä on jo haetun vastauksen sisällä tai saman palvelimen
naapuriosoitteessa.

---

# Toteutusjärjestys

Halvimmasta kalleimpaan, ei tärkeimmästä:

1. **Parametrilistat auki** (kohdat 4 ja 5). Kaksi merkkijonoa,
   `api/fmi.js` ja `api/harmonie.js`. Nolla uutta pyyntöä, nolla uutta
   vikapistettä. Tästä saa paineen, näkyvyyden, sateen ja kosteuden.
2. **Puuskaisuus** (kohta 7). Luku on jo muistissa; puuttuu vain ruutu —
   ja varmistus että suhde lasketaan samasta sarjasta.
3. **Vedenkorkeus** (kohta 2). Uusi proxy `api/vesi.js`, mareografit ja
   sealevel yhdessä. Yksi kutsu kattaa koko maan havainnot. Muista mm/cm.
4. **Aaltoennuste** (kohta 1). Uusi proxy `api/wam.js`, ja spottikortin
   aaltorivi laajenee havainnosta ennusteeksi. Kolme spottia jää ilman —
   rivi jätetään pois eikä arvata.
5. **Varoitukset** (kohta 3). Polygonin sisällä/ulkona -testi, ja `--accent`
   on jo määritelty varoitusväriksi.
6. **Salamat** (kohta 10) ja **tutka** (kohta 6). Molemmat ovat karttatasoja
   ja molemmat menevät lämpökartan päälle — eli niiden asu on ratkaistava
   yhdessä, ei erikseen.
7. **Varusteveikkaus** (kohta 8). Vaatii asetuksiin painon.
8. **Ensemble** (kohta 9). Kytkimen takana, ja vasta kun hyötykuorma on
   oikeasti nähty.

---

# Mitä tästä ei saa päätellä

**Kattavuusluvut ovat yhdeltä ajolta.** WAMin 9/12 ja hydrodynin 2/12 ovat
maamaskista, joka ei muutu ajojen välillä — mutta 61 h ennustepituus on sen
ajon pituus, ja se vaihtelee ajokohtaisesti.

**Vaihteluvälit ovat elokuu–syyskuu 2026.** Vedenkorkeuden 56 cm on 28
vuorokauden otos loppukesältä. Talvimyrskyissä Suomenlahdella liikutaan
metreissä, eli luku on alaraja eikä tyypillinen.

**Aaltokorkeudet ovat tyynen jakson lukuja** (Hs 0,04–0,95 m). Ne kertovat
että malli erottelee spotit toisistaan, eivät sitä mikä on kova keli.

**Ensemble-kohta on ainoa jota ei tarkistettu.** Kaikki muu tässä
dokumentissa on luettu vastauksesta.
