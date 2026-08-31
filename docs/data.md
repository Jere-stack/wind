# Säädata: lähteet, varasto ja käynnistys

Mistä tuuli tulee ja miten se päätyy kentäksi: säälaattavarasto, rajapinnat,
hilalähtöinen kenttä, välimuistit, käynnistysjärjestys ja verkkotila.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä;
> tämä tiedosto luetaan vain kun työ osuu tähän aiheeseen.

## Verkkotila

`Verkkotila` näyttää sirun kun dataa ei saada. Ennen virheet katosivat
`Promise.allSettled`in sisään ja ruudulle jäi edellinen ennuste ilman
merkkiä siitä että se on vanha — käyttäjä ei voinut erottaa "tuuli ei ole
muuttunut" ja "dataa ei tullut" toisistaan. Sääsovelluksessa se on paha,
koska juuri myrskyn alla verkko on epävarmin.

Kaksi tilaa, koska syy ja korjaus ovat eri:

- **offline** — selain kertoo ettei yhteyttä ole. Uudelleenyritystä ei
  tarjota; `online`-tapahtuma hakee datan itse.
- **virhe** — yhteys on mutta ennustetta ei saatu. Yrittäminen voi auttaa.

Asiat jotka eivät ole ilmeisiä:

- **`loadViewport` kertoo tuloksen itse**, ei kutsujat. Latausta
  käynnistetään neljästä paikasta: kolme käynnistyksessä ja yksi näkymän
  muutoksessa. Kutsujiin sijoitettuna käynnistyksen epäonnistuminen olisi
  jäänyt näkymättä — juuri se tapaus jossa ruudulla ei ole yhtään dataa.
  Tämä myös löytyi testissä: ensimmäinen versio ilmoitti vain näkymän
  muutoksesta eikä siru ilmestynyt lainkaan, vaikka 171 pyyntöä oli
  palauttanut 503.
- **Paluuarvo `null` tarkoittaa "vanhentunut lataus"**, ei virhettä.
  `pyydetty === 0` tarkoittaa että kaikki oli välimuistissa, eli näkymälle
  on dataa ja virhetila kuuluu poistaa.
- **Toast ei sopinut tähän**, koska se katoaa itsestään; tila on voimassa
  kunnes se korjautuu.
- **Koko siru on kosketuskohde**, ei nappi sen sisällä — ks. seuraava luku.

## Ensilataus — mihin aika menee

Mitattu Chromiumilla, 4× CPU-jarru, verkko emuloituna:

| profiili | FCP | kartta käytettävissä |
|---|---|---|
| rajaton | 632 ms | ~5,8 s |
| fast-3G (1,6 Mbit, 150 ms) | ~690 ms | ~5,8 s |
| slow-3G (400 kbit, 400 ms) | 2 256 ms | ~13 s |

**Bundle ei ole pullonkaula.** 217 kt siirrettynä (577 kt purettuna) ja FCP
alle 700 ms fast-3G:llä. Aika menee **ennuste-API:n odottamiseen**:
mitattuna 62 pyyntöä, mediaani 2 451 ms, p90 3 214 ms, ja API-ikkuna
(ensimmäinen pyyntö → viimeinen valmis) kattoi **74 % latausajasta**.

Kolme ajoa samalla profiililla: 5 736 / 6 036 / 5 761 ms, eli hajonta
300 ms — luvut ovat vakaita, yksittäinen 9,8 s poikkeama oli
mittausympäristön proxyn hetkellinen hidastus eikä regressio.

Tehtiin: `preconnect` osoitteisiin `api.open-meteo.com` ja
`services.arcgisonline.com`, ja poistettiin kaksi kuollutta
fonttipyyntöä. **Preconnectin hyötyä ei voitu tässä ympäristössä mitata**,
koska API-viive proxyn läpi on suuruusluokkaa isompi kuin säästetty
DNS+TLS-kierros. Se on silti oikea vihje eikä maksa mitään.

Jäljellä olevat, isommat: **ensimmäinen API-pyyntö lähtee vasta 1 125 ms
kohdalla** (siihen asti jäsennetään HTML, ladataan Leaflet ja alustetaan
sovellus), ja pyyntöjen määrä on suuri ennen ensimmäistä käyttökelpoista
näkymää. Molemmat ovat käynnistysjärjestyksen muutoksia eivätkä säätöjä.

## Käynnistys: välimuisti ruudulle ennen verkkoa

Kartta oli mitattuna käytettävissä vasta **4 974 ms** kohdalla, vaikka
ensimmäinen maalaus tapahtui jo 0,7 s kohdalla. Latausruutu odotti
`loadSpots`ia eli verkkoa, vaikka edellinen ennuste oli levyllä.
`_naytaValimuististaHeti()` piirtää tallennetun ennusteen ennen verkkokutsuja
ja kutsuu `hideLoading`in itse. Mitattuna **4 974 → 2 013 ms**.

Asiat jotka eivät ole ilmeisiä:

- **Spotit tallennetaan nyt erikseen** (`fs_spots_<malli>`, noin 29 kt).
  Hilapisteet olivat jo levyllä (`fg_`-avaimet), mutta juuri spotit
  portittavat käynnistyksen: aikajana, spottimerkit ja ensimmäinen kenttä
  rakennetaan `bestTimelineRef`in kautta spottidatasta.
- **Palautettu spotti merkitään `_vanha`ksi.** `loadSpots` ohitti aiemmin
  kaikki spotit joilla oli `wx`, joten välimuistin näyttäminen olisi
  estänyt tuoreen haun kokonaan ja sovellus olisi jäänyt ikuisesti vanhaan
  ennusteeseen. Merkki poistetaan vasta haun jälkeen.
- **Käyttökelpoisuuden ehto on että sarja YLTÄÄ NYKYHETKEEN, ei ikä.**
  Kaksi tuntia vanha ennuste on käyttökelpoinen; eilinen sarja joka loppuu
  ennen tätä hetkeä ei ole, koska `nowIdx` osoittaisi sarjan ulkopuolelle.
- **Vanhuus on kerrottava.** `Verkkotila` sai tilan `vanha`
  ("Ennuste 2 h vanha · päivitetään"), joka poistuu vasta kun tuore data on
  haettu. Vanhan ennusteen näyttäminen tuoreena olisi pahempi vika kuin
  hidas lataus.
- **Käyttäjän aikajanavalintaa ei saa nollata.** Kun kartta on käytettävissä
  jo 2 s kohdalla, käyttäjä ehtii siirtää aikajanaa ennen kuin tuore data
  saapuu — ja `spotsP.then` asetti aina `currentHourIdx = nowIdx(...)`.
  Ennen tätä muutosta nollaus oli näkymätön, koska kartta ei ollut vielä
  käytettävissä. Nyt valinta tunnistetaan vertaamalla
  `State._vanhaAsetettuIdx`:ään ja säilytetään.

**Mitattu ettei varhainen näkymä johda harhaan:** samalla tunnilla
välimuistista piirretty lämpökartta eroaa tuoreesta keskimäärin
**0,8 luminanssia**, ja yli viiden luminanssin eroja on 2,1 % pikseleistä.
Kuva on siis käytännössä sama.

Jäljelle jää 2,0 s, josta FCP on 0,7 s. Loppu on kartan ja Leafletin
alustusta; sen lyhentäminen on eri työ kuin tämä.

Mittausvirhe joka kannattaa välttää: älä aja kahta käynnistystä peräkkäin
samaa API:a vasten ja tulkitse jälkimmäisen virhetilaa. Ensimmäinen ajo
kuormittaa Open-Meteoa niin että toinen saa virheitä, ja siru näyttää
"Ennustetta ei saatu" ilman että koodissa on vikaa — puhtaassa
kontekstissa kaikki 169 vastausta olivat 200.

## Käynnistyksen pyyntömäärä

Mitattuna käynnistys teki **169 API-pyyntöä**. Luokiteltuna 145 niistä meni
`/api/harmonie`-funktioon eli 86 % kaikesta. Syy: `buildHarmonieUrls`
palautti **yhden osoitteen per piste**, ja koska oletusmalli `best_match`
kokeilee HARMONIEa ensin, koko näkymähila haettiin pisteittäin.

Korjaus on erähaku: `/api/harmonie` ottaa vastaan `pts=lat,lng;lat,lng`
-luettelon ja hakee pisteet rinnakkain **palvelinpäässä**, missä viive on
murto-osa mobiiliverkon kierrosajasta. Mitattu **169 → 36 pyyntöä**,
HARMONIE 145 → 12, ja kylmä käynnistys 4 479 → 2 470 ms.

- **Eräkoko on 15** sekä asiakkaassa (`HARMONIE_ERA`) että palvelimella
  (`MAX_PISTEITA`). Yksi piste on noin 16 kt, joten erä on noin 240 kt.
  Isompi erä ei juuri vähentäisi kierroksia mutta kasvattaisi funktion
  30 s aikakatkaisun riskiä.
- **Palvelimen rinnakkaisuus on rajattu kuuteen** (`poolMap`). FMI:n WFS ei
  pidä sadasta yhtaikaisesta pyynnöstä, ja raja pitää myös funktion keston
  kurissa.
- **Yhden pisteen muoto säilyi tavulleen ennallaan** (16 145 tavua ennen ja
  jälkeen). Spottikortti ja havaintopolku käyttävät sitä, joten sitä ei
  saa rikkoa.
- **Yhden pisteen virhe ei kaada erää** vaan näkyy omana alkionaan
  `results`-taulukossa.
- Sudenkuoppa jonka jo kerran astuin: `haePiste` muotoilee koordinaatit
  itse, joten sille annetaan **numerot**. Valmiiksi `toFixed`-käsitellyn
  merkkijonon antaminen kaatoi sen `lat.toFixed is not a function`
  -virheeseen — ja koska erähaku nappaa pistekohtaiset virheet, se näkyi
  vain tuloksen sisällä eikä statuskoodissa.

**Jäljellä:** `/api/fmi` on nyt suurin yksittäinen erä (22 pyyntöä).
Ne lähtevät rinnakkain 13 ms:n ikkunassa ja valmistuvat aikaisin, joten ne
eivät portita käyttövalmiutta — siksi ne jätettiin. Sama erähakukuvio
kävisi niihin jos pyyntömäärää halutaan pienentää lisää.

## Säädata koko maailmalle

Kartta toimi Suomessa mutta ei kunnolla muualla, ja ulos zoomatessa se
lakkasi hakemasta dataa kokonaan. Vikoja oli neljä eri kerroksessa, ja ne
löytyivät vasta kun jokainen mitattiin erikseen.

### 1. Proxy heitti pois valmiin datan HARMONIEn hilan ulkopuolella

`api/harmonie.js` hakee FMI:n HARMONIEn ja Open-Meteon **rinnakkain**.
Jos HARMONIE-haku epäonnistui, Open-Meteo palautettiin — mutta ehto oli
`xmlResult.value.length < 500`.

Hilan ulkopuolella FMI ei kaadu vaan palauttaa **noin 800 tavun
ExceptionReportin**, eli ohi sen rajan. Silloin mentiin parsintaan, sieltä
ulos `{ error: 'no wind data' }`, ja rinnakkain jo haettu Open-Meteon
vastaus katosi. Koko muu maailma sai virheen vaikka data oli kädessä.

Korjaus on `_omVastaus()`, jota kutsutaan **molemmista** haaroista.

### 2. HARMONIEn hila on mitattu, ei arvattu

FMI:n WFS:ää kysyttiin 5° hilassa lat 40–80 / lng −30…50 ja tarkennettiin
reunoilta. Osumat: **lat 50–75, lng −15…50**. Kyseessä on käännetyn navan
laatikko, joten se on vino — Berliini ja Nordkapp ovat sisällä, Pariisi,
Skotlanti ja Kroatia eivät.

`HARMONIE_ALUE` on sen ympäröivä suorakaide marginaalilla (47–78 / −20…55).
**Laatikko on tarkoituksella reilu**: sisällä oleminen maksaa yhden turhan
yrityksen jonka proxy hoitaa, mutta liian pieni laatikko veisi FMI:n
2,5 km hilan sieltä missä se on paras.

> Kohdat 1 ja 2 on pakko tehdä yhdessä. Pelkkä proxyn korjaus saisi
> HARMONIE-polun *onnistumaan* koko maailmassa, jolloin kaikki latautuisi
> `/api/harmonien` kautta 15 pisteen erissä — Open-Meteon oma eräosoite
> ottaa 80 pistettä yhdellä pyynnöllä.

### 3. Ulos zoomaaminen ei hakenut mitään

`_viewportMovedEnough` katsoi vain keskipisteen siirtymää suhteessa
**uuteen** näkymään. Helsingistä z9 → Suomi z5: keskipiste liikkui 3,9°
mutta uuden näkymän korkeus oli 30°, joten kynnys 0,22 vaati 6,6°. Haku
jäi tekemättä. Ruudulla oli z9:n kourallinen pisteitä keskellä ja muualla
ei mitään — joka ikinen kerta kun karttaa veti kauemmas.

Kaksi uutta ehtoa vanhan rinnalle:

1. **Hilaväli vaihtui** — pisteet ovat eri paikoissa eivätkä vanhat kelpaa.
2. **Näkymä ei mahdu edelliseen haettuun alueeseen** (näkymä + 2 × hilaväli,
   ks. `getViewportPoints`). Yksi zoom-askel ulos mahtuu pehmusteeseen eikä
   laukaise turhaa hakua; kaksi ei mahdu.

Turhat laukaisut ovat halpoja: `loadViewport` palaa heti jos jokainen piste
on jo muistissa.

### 4. Katon harvennus vääristi hilan suorakaiteeksi

`getViewportPoints` rajasi 600 pisteeseen suodattamalla `i % every === 0`
rivijärjestyksessä olevasta listasta. Kun leveyssuunnassa oli 72 saraketta
ja `every` oli 4, se pudotti kolme neljäsosaa **sarakkeista** mutta ei
yhtään riviä: koko maailman hila oli 5° pystyssä ja 20° vaakasuunnassa.
Ja `gridStep` — jolla IDW:n tukisäde mitoitetaan — luuli väliä yhä
viideksi asteeksi.

Nyt hilaväliä **kasvatetaan** kunnes lista mahtuu kattoon, ja käytetty väli
jää talteen (`_viimeStep`). Tukisäde luetaan `kaytettyStep()`:llä, joka on
`max(gridStep(zoom), _viimeStep)` — zoomatessa sisään haku on hetken
velkaa, ja silloin on turvallisempaa ylimitoittaa säde kuin alimitoittaa.
Ylimitoitus pehmentää, alimitoitus rikkoo (ks. *Lämpökartta jäi väärään
mittakaavaan*).

### Mitattu lopputulos

Pyyntömäärät synteettisellä säädatalla, jotta luvut ovat toistettavia:

```
näkymä              OM-pyyntöjä   HARMONIE-pyyntöjä   ilman tukipistettä
Helsinki      z9       1                5                  0/121
Sydney        z9       2                1                  0/121
New York      z9       2                1                  0/121
Kap Hoorn     z7       3                1                  0/121
Keski-Atl.    z5       7                1                  0/121
Tyynimeri     z4      12                1                  0/121
koko maailma  z2       9                1                  0/121
```

Jokaisessa näkymässä **0/121 näytettä jäi ilman tukipistettä** — eli
interpolointi ei putoa varatielle missään zoomissa maapallolla.
Ulos zoomatessa Helsingistä z9 → z2 haku laukeaa nyt joka askeleella
(paitsi z9 → z8, jossa hila ei muutu ja näkymä mahtuu pehmusteeseen) ja
kenttä kasvaa 61 → 1282 pisteeseen.

### Tehokkuus: kolme erillistä sääntöä

- **Alue** (`HARMONIE_ALUE`): hilan ulkopuolella ei yritetä FMI:tä.
- **Tiheys** (`HARMONIE_MAX_STEP = 1.0`): HARMONIEn koko etu on 2,5 km hila.
  Kun karttahila on 2,5 **astetta** eli noin 280 km, siitä ei näy mitään.
  Mitattuna Helsingistä z5:een zoomatessa 123 pistettä meni FMI:lle
  yhdeksänä pyyntönä; samat pisteet ovat Open-Meteolta kaksi. Raja pitää
  FMI:n kaikissa näkymissä joissa Suomi täyttää ruudun tai enemmän.
- **Erien lajittelu**: pisteet syntyvät riveittäin, joten koko maailman
  näkymässä yhdessä 80 pisteen erässä on yhden leveyspiirin pisteitä
  laidasta laitaan. Yksikin pohjoiseurooppalainen piste vei ennen koko
  erän HARMONIE-polulle, joka pilkkoo sen vielä kuuteen 15 pisteen
  pyyntöön — mitattuna 80 pistettä lähti FMI:lle vaikka niistä vain
  neljätoista oli sen hilalla. Nyt erät ovat homogeenisia.

Yhteensä nämä veivät HARMONIE-pyynnöt 74 → 32 ja pisteet 865 → 302 samalla
yhdeksän näkymän sarjalla.

**Vastapaino: karkealla haettu piste päivitetään FMI:llä kun hila tihenee.**
Ilman sitä Suomen hila rapautuisi Open-Meteoksi pala kerrallaan joka kerta
kun karttaa vetää kauas ja takaisin — piste oli jo olemassa, joten sitä ei
haettaisi uudestaan koskaan. Mitattuna kylmältä z3 → z9 hakee 49 pistettä
FMI:ltä ja näkymän pisteet ovat sen jälkeen FMI 49 / Open-Meteo 0.

### Globaali karkea hila heräsi kuolleista

`loadGlobalCoarse` (240 pistettä 15° hilassa, yksi vuorokausi, ~27 kt,
localStoragessa 3 h) oli **kuollutta koodia**: sen ainoa kutsupaikka oli
mallivalitsimessa, eikä käynnistys ole koskaan kutsunut sitä. Nyt se
ajetaan kun näkymä on z5 tai kauempana. Se ehtii ruudulle selvästi ennen
näkymän omaa hakua (jopa 12 pyyntöä × 16 vrk), joten maailmankartta ei ole
tyhjä sillä aikaa kun raskas haku on kesken.

Kattavuus laajennettiin samalla −55…70 → **−60…75**: vanha yläraja jätti
pohjoisimman rivin 65:een, jolloin Pohjois-Norja ja Alaska jäivät
tukipisteiden ulkopuolelle.

## Lähdemerkintä ja aina automaattinen malli

Mallivalitsin (FMI / Auto / ICON / ECMWF / GFS) **poistettiin**. Se oli
ansa: "FMI" kiinnitti koko kartan HARMONIEen *ilman varatietä*
(`fmi_harmonie -> HARMONIE, ei fallbackia`), ja sen hila loppuu
Pohjois-Euroopan reunaan — muualla maailmassa kartta jäi silloin tyhjäksi
eikä mikään kertonut miksi. Vanha `fs_model` siivotaan localStoragesta,
jottei aiemmin FMI:hin kiinnitetty laite jää siihen tilaan.

Reitityskoodi `loadBatch`issa tuntee mallit edelleen, joten valitsin on
helppo palauttaa — mutta silloin FMI-vaihtoehto tarvitsee varatien.

Tilalle tuli **lähdemerkintä**: pieni läpikuultava teksti kartan
alalaidassa vasemmalla, joka kertoo mikä ennuste on tähtäimen alla.

Kolme asiaa jotka eivät ole ilmeisiä:

- **Merkintä seuraa myös aikajanaa, ei vain sijaintia.** Proxy antaa
  HARMONIElta noin 48 h ja jatkaa siitä Open-Meteolla samaan taulukkoon;
  `harmonie_hours` kertoo montako ensimmäistä tuntia on FMI:n omaa. Kun
  aikajanaa vetää sen ohi, merkintä vaihtuu Open-Meteoksi vaikka paikka on
  Suomessa.
- **Etäisyysraja on pakollinen.** Ilman sitä merkintä valehteli pahasti:
  kun näkymän lataus epäonnistui Sydneyn kohdalla, ainoat pisteet joilla
  oli dataa olivat suomalaiset spotit — ja merkintä ilmoitti Australiassa
  lähteeksi FMI HARMONIEn, 16 000 km päästä. Raja on `3 × käytetty
  hilaväli` (sama tukisäde jolla `idw()` interpoloi) ja vähintään 8°.
- **Sijainti mitattiin, ei arvattu.** Ensimmäinen sijoitus 104 px pohjasta
  jäi aikajanan hetkikuplan ("Ma 11:00") alle — kupla on
  `#tl-indicator`in pseudoelementti eikä siksi näy elementin mitoissa.
  126 px jättää siihen 14 px raon; `#rl-banner` nostettiin 172:een.

Merkintä on **kartan maailmaa eikä paneelia**: valkoinen läpikuultava
(`--kartta-teksti`), ja vaalealla pohjakartalla se kääntyy mustaksi samalla
tavalla kuin tilapalkin tummennus. `pointer-events: none` — se on lukema,
ei nappi.

`lahinEnnustepiste()` nostettiin `Crosshair._puuskan` sisältä omaksi
funktiokseen ja muistettiin yhdelle kutsukierrokselle: tähtäin kysyy sitä
nyt kahdesti (puuska ja lähde) samalla keskipisteellä, ja `getAllPoints`
on viewportissa satoja pisteitä.

## Uloin näkymä — 44 % roskaa, kymmenen texelin sumennus

Käyttäjä huomasi kaksi asiaa: uloin zoomtaso "ei näytä oikealta", ja
kerran tuli vastaan ilmoitus API-rajojen täyttymisestä. Molemmat olivat
todellisia, ja niillä oli **kolme erillistä syytä**. Kaksi niistä
vaikuttivat kumpaankin oireeseen yhtä aikaa, mikä on syy siihen miksi ne
kannattaa lukea yhdessä.

### 1. Lähes puolet pyydetyistä koordinaateista oli kelvottomia

Leafletin `worldCopyJump` sallii kartan kelata maapallon ympäri, joten
`map.getBounds()` ei pysy välillä −180…180. Yhdessä mitatussa z2-näkymässä
rajat olivat **lng −238…−101**. Ne pisteet ovat aitoja *geometriana* —
tekstuuri kattaa juuri sen alueen ja interpolointi tarvitsee pisteet
siellä — mutta Open-Meteolle `longitude=-238` on virhe.

Mitattuna yhdessä uloimmassa näkymässä **144 pistettä 324:stä eli 44 %**
lähti roskana. Ne kuluttivat pyyntökiintiön mutta eivät palauttaneet mitään
— eli kartta jäi harvaksi *ja* API rasittui, samasta viasta.

Korjaus: `kaarraLng()` kääntää pituuspiirin takaisin väliin, ja kääntö
tehdään **vasta osoitetta rakennettaessa** (`buildBatchUrl`,
`buildHarmonieUrls`). Sovellus pitää oman geometriansa, API saa kelvolliset
luvut. Sama piste voi silloin esiintyä näkymässä kahdesti (lng −240 ja
+120), joten `loadViewport` kopioi jo haetun datan kaartokopiolle ennen
erien kokoamista — **antimeridiaanin ylittävä näkymä maksaa nyt yhden
pyynnön viiden sijaan**.

Samalla lisättiin napojen ohitus: `Math.floor(s / step) * step` menee
rajauksen alapuolelle, ja 10 asteen hilalla −85 pyöristyy −90:een. Tarkistus
on **silmukan sisällä eikä alkuarvossa**, jotta hila pysyy samassa
lattiassa ja vieritys osuu jo haettuihin pisteisiin.

### 2. Sumennus oli zoomin funktio, vaikka se toimii texeleissä

`updateHeatmapBlur` laski `22 - (z-2) * 2.2` pikseliä. Se on zoomin
funktio, mutta se *mitä sumennus tekee* riippuu siitä kuinka isona yksi
`WindTexture`n texel ruudulla näkyy — eikä se seuraa zoomia, koska
tekstuurin koko (`maxDim`) ja sen kattama alue (`vPad`) muuttuvat
portaittain.

Mitattuna sumennus texeleinä:

```
        z9    z7    z5    z4    z3    z2
ennen   1.7   2.8   9.4   7.4   8.7   9.9
jälkeen 1.8   2.2   2.1   2.0   1.8   2.2
```

Läheltä katsottuna sumennus oli kahden hilaruudun luokkaa ja näytti
oikealta. Kaukaa kenttää sumennettiin **lähes kymmenen hilaruudun yli**, eli
koko maapallo puuroutui yhdeksi tasaiseksi vihreäksi. Juuri se on se "ei
näytä oikealta".

Nyt tavoitellaan 2 texeliä joka zoomissa: se peittää interpolointihilan
portaat mutta ei syö kentän rakennetta. Rajat 3…22 px ovat paikallaan
poikkeustilanteita varten (tekstuuri voi olla tyhjä ensimmäisellä
kutsulla), ja vanha käyrä on yhä varatienä siihen asti kunnes tekstuuri on
olemassa.

### 3. Novelli ratkaisu: aika-askel sovitetaan hilaväliin

Tässä on se kohta jossa tarkkuutta saa **ilman että API rasittuu**.

Matalapaine liikkuu noin 1,5 astetta tunnissa. Kun näkymän hila on
10 astetta, kuvio ehtii kuudessa tunnissa liikkua tasan yhden hilavälin —
eli tunneittainen data sisältää muutosta, jota hila **ei fysikaalisesti
voi esittää**. Se ei ole tarkkuutta, se on tavuja. Näytteenottoteoreema
paikkaulottuvuudessa, sovellettuna aikaan.

Sääntö on siksi `aika-askel ≤ hilaväli / 1,5 °/h`, pyöristettynä
Open-Meteon tarjoamiin arvoihin. `aikaAskelParam()` antaa `hourly_3` kun
hila on 1,5…4,5° ja `hourly_6` sitä leveämmällä; alle 1,5° hilalla
(spotit, lähizoomit) mitään ei muuteta.

Mitattuna yhdellä pisteellä, 16 + 2 vrk:

```
                arvoja   tavuja
hourly (ennen)     432     5687
hourly_3           144     2356
hourly_6            72     1438
```

**Aikaväli ei lyhene.** Aikajanaa voi yhä vetää koko 16 vuorokauden yli —
vain turha tiheys jää pois. Tämä on olennaista: sama säästö olisi saatu
lyhentämällä `forecast_days`ia, mutta se olisi rikkonut aikajanan (ks.
*Lämpökartan värit* → vika 2, jossa juuri niin kävi vahingossa).

Hinta mitattiin tunnettua kenttää vasten: **0.04–0.07 m/s**, kun saman
näkymän spatiaalinen aliotantavirhe on 0.2–0.9 m/s. Eli aika-askel on
suuruusluokkaa pienempi virhelähde kuin se hila johon se sovitetaan —
juuri niin kuin pitääkin.

### Yhteisvaikutus

Viiden näkymän kierros (Suomi z6, uloin z2 kolmesta eri pituuspiiristä,
Atlantti z4):

```
                    ennen    jälkeen
API-paino           57009     39567   (−31 %)
pyyntöjä               24        18
pisteitä             1286       963
kelvottomia koord.    144         0
```

Ja tarkkuus tunnettua kenttää vasten säilyi: z9 0.00–0.04, z5 0.06–0.36,
z3 0.24–0.49, z2 0.80–0.86 m/s. z2:n luku on 10 asteen hilan aliotanta
eikä vika.

### Lähdemerkintä siirtyi aikajanan alle

Merkinnän paikka kiersi kolme kertaa, ja jokainen kierros kertoo jotain:

1. **104 px pohjasta** jäi aikajanan hetkikuplan ("Ma 11:00") alle. Kupla
   on `#tl-indicator`in pseudoelementti eikä siksi näy elementin mitoissa
   — sitä ei löydä muuten kuin katsomalla.
2. **126 px** oli kuplan yläpuolella mutta kartan päällä, ja se pakotti
   `#rl-banner`in ylemmäs. Merkintä alkoi työntää muuta kalustoa.
3. **Aikajanan sirun alapuolella** on rako joka on jo olemassa: siru
   päättyy `--sab-tl + 8px` pohjasta, joten alle jää selaimessa 8 px ja
   kotivalikon appissa 22 px. Mitään ei tarvitse siirtää, ja `#rl-banner`
   palasi omalle paikalleen 148:aan.

Fontti on **8 px ja line-height 1**, koska rako on selaimessa tasan 8 px.
Se on tarkoituksella pienempi kuin mikään muu teksti sovelluksessa — lukema
jota vilkaistaan, ei luetaan. `bottom: 0` + `padding-bottom` eikä
`bottom: calc(...)`, jotta merkintä ei koskaan valu turva-alueen alle
laitteella jolla `--sab-tl` on pieni.

## Oma säädatavarasto — pois rajapinnan kiintiöstä

Sovellus haki tuulikentän Open-Meteon rajapinnasta joka istunnossa. Se ei
kaatunut kustannuksiin vaan **kiintiöön**, ja kiintiön yksikkö on se mikä
tekee tästä ison asian.

### Mitattu ongelma

Open-Meteon ilmainen taso on 10 000 kutsua/vrk, ja **laskutusyksikkö on
paikka, ei HTTP-pyyntö**: jokainen koordinaatti erässä on oma kutsunsa.
Mitattuna selaimessa yhdellä todellisella istunnolla:

```
  käynnistys Helsinki z9    144 paikkaa   ( 3 pyyntöä)
  zoom sisään z12            31           ( 2)
  zoom ulos z7              101           ( 3)
  panorointi                191           ( 5)
  Porkkala z9                50           ( 2)
  maailmanäkymä z3          745           (11)   <- 57 % koko istunnosta
  spottikortti               43           ( 2)
  ------------------------------------------------
  yhteensä                 1305 paikkaa   (28 pyyntöä)
```

18 vuorokauden jakso maksaa vielä ×1,29 (yli kahden viikon pyyntö), joten
istunto on noin **1 678 kutsua — kuusi istuntoa vuorokaudessa**. Kehittäjä
polttaa sen aamupäivässä.

Toinen mitattu luku ratkaisi suunnan: **koko datajoukko jonka sovellus voi
ikinä näyttää on muutama megatavu.** Kiintiöllä maksettiin siitä että sama
taulukko koottiin uudelleen joka istunnossa.

### Mistä data nyt tulee

Open-Meteo julkaisee koko käsitellyn tietokantansa AWS Open Datassa:
`s3://openmeteo`, avoin, ilman tunnistautumista, CC BY 4.0, 68 mallia.
Sama data kuin rajapinnasta, ilman kiintiötä.

Valittu malli on **`ecmwf_ifs025`** yhdestä syystä: se on ainoa jonka
hetkittäisessä tiedostossa on kaikki kolme tarvittavaa suuretta —
`wind_u_component_10m`, `wind_v_component_10m` ja `wind_gusts_10m`.
GFS:llä on puuskat mutta ei 10 metrin tuulta, joten se vaatisi kaksi
mallia, ja kaksi mallia tarkoittaa kahta eri fysiikkaa samassa kuvassa.

Asioita jotka piti selvittää mittaamalla, koska metatiedoista niitä ei
saanut (kirjaston skalaarilukija heittää `crs_wkt`:lle):

- **Rivi 0 on ETELÄSSÄ.** Luin lämpötilakentän 9×12 ruudukkona: y=0 antoi
  −58 °C tasaisesti (Etelämanner elokuussa), y=720 noin −1 °C. Pituuspiiri
  ratkesi samasta kuvasta: x=785 oli 37 °C ja x=916 oli 46 °C, mikä osuu
  Saharaan ja Arabiaan vain jos x=0 on −180°. Siis
  `lat = -90 + y*0.25`, `lng = -180 + x*0.25`.
- **Aika-akseli ei ole tasavälinen.** ECMWF antaa kolmen tunnin askeleen
  kuuden vuorokauden ajan ja sitten kuuden tunnin askeleen
  viidenteentoista: mitattuna 48 kolmen tunnin väliä ja 36 kuuden tunnin
  väliä. Ensimmäinen versio tallensi vain `t0` ja `dt` — jolloin viimeiset
  yhdeksän vuorokautta olisivat olleet väärässä kohdassa aikajanaa ilman
  että mikään olisi näyttänyt rikkinäiseltä. Nyt luettelossa on koko
  aikalista. Interpolointi itse osaa epätasaisen välin, koska se hakee
  hetkeä *ympäröivän parin* eikä kiinteää askelta.
- **Puuskaa ei ole analyysihetkellä.** Se on jakson yli laskettu maksimi,
  eikä nollan mittaiselle jaksolle ole maksimia. Ensimmäinen versio hylkäsi
  koko hetken jos puuska puuttui — eli juuri sen hetken jonka kartta
  oletuksena näyttää.

Suunnan konventio tarkistettiin FMI:n HARMONIEa vasten kolmessa paikassa:
ero 1–5°, nopeusero 0,6–1,2 m/s (normaali mallien välinen erimielisyys
25 km vs 2,5 km hilalla) ja puuskat 4,6 vs 4,8 / 5,4 vs 4,3. Kaava on
`(270 - atan2(v,u)*180/pi) mod 360`.

### Laattojen muoto

Laatta on **21 × 21 pistettä ja 20 × askel astetta**. Viimeinen rivi on
naapurin ensimmäinen, joten reunalla ei ole saumaa jota interpolointi
joutuisi arvaamaan. Sisältö on kolme tavutasoa järjestyksessä
`[aika][y][x]`: nopeus (0,2 m/s), suunta (2°) ja puuska (0,2 m/s), 255 =
puuttuva. Molemmat kvantisoinnit ovat selvästi hienompia kuin ennusteen
oma tarkkuus.

Viisi tasoa, tiheät vain sinne missä spotit ovat:

| taso | askel | alue | laattoja |
|---|---|---|---|
| l0 | 0,25° | Itämeri + Suomi | 25 |
| l1 | 0,5° | Pohjois-Eurooppa | 24 |
| l2 | 1° | Eurooppa + Atlantti | 21 |
| l3 | 2,5° | koko maailma | 32 |
| l4 | 5° | koko maailma | 8 |

Koko maailman 0,25° olisi 2 592 laattaa eli 290 MB; sitä ei tarvitse
kukaan. **l4 on olemassa vaikka l3 kattaa saman alueen**, koska
sovelluksen hilaväli on zoomissa 3 ja sitä ulompana 5°: l3:lla
maailmanäkymä oli mitattuna 32 laattaa ja 2,65 MB, l4:llä 8 laattaa ja
0,68 MB. Data on samaa, ero on vain siinä ettei ladata neljä kertaa
enempää kuin näytetään.

Yhteensä 110 laattaa, **9,4 MB gzipattuna**, 98 aika-askelta, jakso 16,6
vuorokautta (2 vrk taakse, 15 eteen). Rakennus kestää noin kolme
minuuttia.

Pakkaus jää 66 prosenttiin eikä siitä kannata yrittää enempää:
kokeiltuna `[y][x][t]` + aikadelta oli **101 %** ja `[t][y][x]` +
aikadelta **93 %** nykyisestä. Kvantisoitu tuuli on tavutasolla lähes
kohinaa.

### Menneisyys tulee vanhemmista ajoista

`data_spatial` sisältää vain ennusteen ajohetkestä eteenpäin, mutta
aikajana ulottuu kaksi vuorokautta taaksepäin. Menneisyys saadaan
vanhempien ajojen alkupäästä: kaksitoista tuntia sitten tehdyn ajon
ensimmäiset askeleet ovat nyt menneisyyttä. Jokaiselle hetkelle valitaan
**tuorein ajo joka sen kattaa**, joten menneisyys on parasta saatavilla
olevaa analyysiä eikä vanhaa ennustetta. Mitattuna yksi akseli koostuu
neljästä eri ajosta.

### Mitä sovelluksessa muuttui

`Saalaatat`-moduuli ja yksi lohko `loadViewport()`:ssa. Laattapisteet
menevät `_points`-karttaan **samassa muodossa kuin rajapinnasta tulevat**,
joten interpolointi, lämpökartta, partikkelit ja aikajana eivät tiedä
erosta. Ainoa näkyvä ero on lähdemerkintä.

Kaksi asiaa jotka piti korjata mittaamalla:

- **Bilineaarinen näyte, ei lähin solmu.** Kun sovellus pyytää 0,5° hilaa
  mutta tarjolla on vain 2,5° taso (Australiassa), lähin solmu antaisi
  viidelle pisteelle saman arvon — kenttä olisi 2,5° palikoita ja
  interpolointi sekoittaisi vain identtisiä naapureita. Suunta
  interpoloidaan yksikkövektoreina samasta syystä kuin
  `_havSuuntaKeskiarvo()`:ssa: 350° ja 10° ovat 20° päässä toisistaan,
  mutta lukujen keskiarvo on vastakkainen suunta.
- **`varmista()` tarvitsee saman pehmusteen kuin `getViewportPoints()`**
  (`step * 2`). Ilman sitä reunapisteet putoavat naapurilaatalle jota ei
  ole ladattu, ja ne menevät rajapintaan vaikka data on olemassa.
  Mitattuna Sydneyn z8-näkymässä 26 pistettä 117:stä jäi näin katveeseen.

Tulos samalla kierroksella kuin alussa mitattu, mutta vaikeampana (mukana
Sydney ja maailmanäkymä):

```
                    ennen        jälkeen
  Open-Meteo        1305 paikkaa    0 paikkaa
  laattoja             —           21 pyyntöä, 1,67 MB
```

### Varatie ei ole valinnainen

Laatat kattavat rajatut alueet, ja ajastettu työ voi olla rikki. Kolme
tilaa testattiin selaimessa ja kaikissa sovellus toimii kuten ennenkin
(375 tunnin aikajana rajapinnasta, ei sivuvirheitä):

- **luettelo puuttuu (404)** → varasto pois käytöstä
- **luettelo on roskaa** → sama
- **luettelo on vanhentunut** → sama. Raja on: jos viimeinen hetki ei
  yllä puolta vuorokautta eteenpäin, ajastettu työ on jäänyt jumiin.
  Vanhentunut varasto on pahempi kuin ei varastoa lainkaan, koska se
  näyttäisi eiliseltä ennusteelta ilman että mikään kertoo siitä.

### Julkaisu

GitHub Actions (`.github/workflows/saadata.yml`) neljä kertaa
vuorokaudessa. Julkisessa reposessa minuutit ovat rajattomat.

Laatat menevät **orpoon `saadata`-haaraan pakkopäivityksellä**, eli
haarassa on aina täsmälleen yksi committi. Jos ne kasautuisivat
historiaan, repo kasvaisi 38 MB vuorokaudessa ja täyttäisi GitHubin
gigatavun rajan neljässä viikossa.

Sovellus lataa ne `raw.githubusercontent.com`:sta: siellä on
`access-control-allow-origin: *` ja `cache-control: max-age=300`, mikä
sopii kolmen tunnin välein päivittyvälle datalle. jsDelivr olisi
nopeampi CDN mutta sen `max-age` on seitsemän vuorokautta `@main`-tagilla,
eli väärä tälle.

**Cloudflare R2 olisi tähän myös hyvä** (10 GB ilmaista, egress
maksuton), ja jos sovellus joskus saa oikeaa liikennetta, se on se
minne siirtyä — GitHubin kaistalla on pehmeä 100 GB/kk raja ja
välimuistiotsakkeisiin ei pääse käsiksi. Tällä mittakaavalla ero ei
näy.

### Mitä varaston jälkeen jäi jäljelle

Laatat veivät kartan pois kiintiöstä, mutta ne eivät vieneet kaikkea.
Mitattuna viisi peräkkäistä sivunlatausta maksoi yhä **25 paikkaa
jokainen** — ei laskevasti vaan tasaisesti, eli mikään ei jäänyt talteen
latausten välillä. 10 000 paikan vuorokausikiintiöllä se on 400
latausta, mikä loppuu kesken yhtenä testipäivänä.

Kolme kuluttajaa, kaikki sama vika: **välimuisti oli olemassa mutta
vain muistissa.** TTL oli voimassa sivun elinajan, ja uudelleenlataus
aloitti tyhjästä.

| kuluttaja | TTL | oli | on |
|---|---|---|---|
| spottien ennusteet | 30 min | `localStorage`, mutta aina `_vanha` | tuoreusraja |
| vedenlämmöt | 60 min | vain muistissa | `fs_vesi` |
| tähtäimen sääkapseli | 30 min | vain muistissa | `fs_saa` |

**Spoteilla tallennus oli jo levyllä** — vika oli lukupäässä.
`_restoreSpots` merkitsi jokaisen palautetun spotin `_vanha`ksi, ja
`loadSpots` hakee `_vanha`t aina uudestaan. Tallennusta siis
kirjoitettiin ja luettiin, mutta se ei säästänyt yhtään kutsua: se
nopeutti vain ensimmäistä ruutua. Nyt alle puolen tunnin ikäinen
tallennus osoittaa samaan tuntiruutuun kuin uusi haku antaisi, joten
merkintä jää pois eikä hakua tule.

Samalla `main()`:iin tuli ehto vanhuussirulle: se näytettiin aina kun
välimuistipolku ajettiin, mikä nyt lupaisi "päivitetään" latauksesta
jota ei tule.

Mitattu ennen ja jälkeen (Open-Meteo-**paikkoja**, ei HTTP-pyyntöjä —
kiintiö veloittaa paikan, joten 80 pistettä yhdessä pyynnössä on 80):

```
lataus     ennen   jälkeen
  1          25       25      kylmä käynnistys
  2          25        0
  3          25        0
  4          25        0
  5          25        0
```

Ja raskas selailu — 18 siirtoa Hangosta Sydneyyn ja takaisin, zoomit
z2–z12 — maksoi **0,9 paikkaa siirtoa kohti**. Jäljelle jäänyt yksi on
aina sama: sääkapseli uudessa 0,1 asteen ruudussa. Tuulikenttä,
lämpökartta ja spotit tulevat laatoista.

**Mittarissa oli kaksi omaa vikaa, jotka on syytä tietää jos sen
rakentaa uudestaan.** Laskuri luki vain `latitude`-parametria, mutta
`/api/harmonie` käyttää muotoa `pts=lat,lng;lat,lng` — kahdentoista
pisteen erä näkyi yhtenä, eli kulu näytti kymmenkertaisesti liian
pieneltä. Ja tynkä palautti `pts=`-haaralle väärän muodon (olio eikä
`{results:[…]}`), jolloin sovellus piti vastausta tyhjänä ja putosi
Open-Meteon varatielle: samat 12 spottia näkyivät haettuina kahdesti.
Kumpikaan ei ollut sovelluksen vika.

**Katto on paikkamäärässä, ei tavuissa.** `fs_saa` pitää kahdeksan
viimeksi katsottua paikkaa, koska yksi paikka on ~4 kt (5 vrk tunnin
välein) ja mitattuna kaksitoista paikkaa oli 57 kt. Vanhentuneet
pudotetaan jo luettaessa, jottei tallennus kasva niistä joita ei enää
käytetä.

## Tallennustila ei ollutkaan este — lataus oli

Tässä tiedostossa ja `tools/tiilet.mjs`:ssä luki että koko maailman
0,25° olisi *"2 592 laattaa eli 290 MB; sitä ei tarvitse kukaan"*, ja
että se on syy miksi uloin näkymä ei yllä Windyn tarkkuuteen. **Luku oli
väärä ja perustelu vinossa.** Mitattuna oikeasti:

```
nykyinen varasto (ennen)     110 laattaa     5,6 MB
koko maailma 0,25°         2 592 laattaa   209 MB
```

209 MB mahtuu GitHubiin vaivatta: repon pehmeä raja on gigatavuja, ja
orpo haara pakkopäivityksellä pitää koon vakiona (haarassa on aina tasan
yksi committi). **Tallennustila oli siis koko ajan saatavilla ja
ilmainen.**

### Este on latauskoko, ja se riippuu näkymästä eikä tasosta

```
uloin näkymä 0,25 asteella   209 laattaa   16,9 MB
uloin näkymä 1   asteella     24 laattaa    2,0 MB
```

Laattojen määrä latauksessa riippuu **näkymän koosta**, ei tason
tarkkuudesta — laatta kattaa aina 20 × askel astetta. Siitä seuraa
kaksi asiaa jotka kääntävät koko kysymyksen ympäri:

1. **Tiheä taso on halpa käyttää lähellä ja kallis kaukana.** z11:ssä
   näkymä on 0,1 astetta eli yksi laatta; uloimmassa se on 47 × 83
   astetta eli satoja.
2. **Sovellus käyttää 0,25 astetta vasta z10:stä ylöspäin**, ja siellä
   katsotaan aina jotain tiettyä spottia. Kaikki spotit ovat Suomessa,
   jonka `l0` jo kattaa. Koko maailman 0,25° palvelisi siis vain sitä
   että joku zoomaa z10:een keskelle Tyyntämerta.

Oikea kysymys ei siis ollut *"paljonko tilaa on"* vaan *"mitä tarkkuutta
mikin zoom oikeasti käyttää"*.

### Mitä tilalla tehtiin

**Uloin näkymä näyttää aina ison siivun maailmaa**, ja siellä hilaväli on
1,25° eli taso `l2`. Se on se yksi taso jonka kattavuus näkyy joka kerta
kun kartta vedetään ulos — ja se kattoi vain Euroopan ja Atlantin, joten
kaikki lat 28° eteläpuolella putosi 2,5 asteeseen. Käyttäjän omassa
kuvakaappauksessa se oli koko Afrikka.

```
        ennen                       nyt
l0  0,25  Itämeri + Suomi     25    Itämeri + Suomi          25
l1  0,5   Pohjois-Eurooppa    24    Eurooppa + Atlantti      72
l2  1     Eurooppa + Atlantti 21    KOKO MAAILMA            180
l3  2,5   koko maailma        32    koko maailma             32
l4  5     koko maailma         8    koko maailma              8
                             110                            317
                            5,6 MB                        27,1 MB
```

**Latauskoko pysyi ennallaan: 24 laattaa ennen ja jälkeen.** Sama näkymä,
sama määrä laattoja, vain parempi data siellä missä ennen putosi 2,5
asteeseen. Tarkistettu koko maailmalta: Sahara, Nigeria, Kongo,
Kapkaupunki, Sydney ja Tyynimeri saavat kaikki nyt tason `l2` (1°).

(Varaston koko kasvoi 5,6 → 27,1 MB myös siksi että tuo ajo sai
lähteestä 99 aika-askelta aiemman 62:n sijaan. Laattojen MÄÄRÄ selittää
osan ja aika-akselin pituus osan — laattakohtainen koko nousi 56 → 87 kt
ilman että mikään tässä muutoksessa vaikutti siihen.)

### l3 ja l4 jäivät, eivätkä ne ole turhia

Ne näyttävät nyt turhilta, koska `l2` kattaa saman alueen tarkempana.
Ne ovat kuitenkin **varatie pistekatolle**: `getViewportPoints` kasvattaa
hilaväliä kunnes pistemäärä mahtuu kattoon, ja hyvin leveällä ikkunalla
väli voi nousta yli kahden asteen. Silloin `taso()` valitsee karkeamman
tason. Ilman niitä sama näkymä ladattaisiin `l2`:sta — 180 laattaa yhden
ruudullisen avaamiseen.

### Pakkauksesta ei ole apua

Selain purkaa `DecompressionStream`illa, joka osaa vain gzipin ja
deflaten — brotli ei ole vaihtoehto. Voitto olisi siis haettava
esikäsittelystä ennen gzipiä. Mitattuna 15 oikealla laatalla:

```
nykyinen        100 %
aikadelta        94 %
paikkadelta      87 %
aika + paikka    87 %
ilman puuskaa    77 %
```

Data on jo lähellä entropiaansa, koska arvot on kvantisoitu tavuun.
13 % ei muuta mitään siinä laskussa joka ratkaisee — ja puuskan
pudottaminen maksaisi toiminnallisuutta.

### Mikä jää yhä saavuttamatta

Windy renderöi kentän **palvelimella valmiiksi rasterilaatoiksi**, jolloin
asiakas lataa kuvia (muutama kilotavu) eikä numeroita. Siksi he voivat
näyttää natiivin 0,25° hilan koko maailmalle. Meidän arkkitehtuurimme
lähettää numerokentän ja interpoloi selaimessa — se on se mikä tekee
tähtäimen lukemasta, aikajanasta ja spottikorteista mahdollisia, mutta se
maksaa latauskokona. Ero ei siis ole tallennustilassa eikä koodin
laadussa vaan siinä kumpaa puolta laskenta tehdään.

## Hilalähtöinen kenttä — säännöllistä hilaa ei pureta pisteiksi

Kun säädatavarasto tuli, **data lakkasi olemasta sironneita pisteitä**:
laatta on täydellisen säännöllinen lat/lng-hila tyyppitaulukoissa.
Sovellus purki sen silti piste kerrallaan `hourly`-olioiksi, työnsi ne
`_points`-karttaan, rakensi niistä hajautetun `SpatialIndex`in ja
interpoloi ne takaisin hilaksi `idw()`:llä. Kolme kierrosta työtä
palataksemme siihen mistä lähdettiin.

Mitattuna yhden näkymän vaihto uloimmassa näkymässä (3 108 hilapistettä,
Node, ei kuristusta):

| | ennen | jälkeen |
|---|---|---|
| `Saalaatat.wx()` + `buildWindField` | 134,0 ms | — |
| `onLaatta()` merkintä | — | 0,2 ms |
| `buildWindField` (`naytteista`) | — | 1,9 ms |
| `WindTexture.build` | 9,4 ms | 4,4 ms |
| **yhteensä** | **143,4 ms** | **6,5 ms** |

### Sarjaa ei rakenneta — hetki luetaan suoraan tavuista

`wx()` palauttaa koko 99-alkioisen aikasarjan kolmena taulukkona. Kenttä
ja lämpökartta lukevat siitä **yhden hetken**, mutta lukevat sen
tuhansista paikoista: uloimmassa näkymässä se on 10 200 taulukkoa ja
miljoona laatikoitua lukua.

- **Kustannus on varauksessa, ei trigonometriassa.** Tämä kokeiltiin:
  suunta on kvantisoitu 2 asteen välein eli vain 180 arvoa, joten
  sin/cos voi korvata hakutaululla. Mitattuna 53,5 → 57,9 ms, eli
  **hakutaulu oli hitaampi**. Se sulki mikro-optimoinnin ja pakotti
  arkkitehtuurimuutokseen.
- `Saalaatat.naytteista()` ei varaa mitään: tulos jää kenttiin
  `_nU`/`_nV`, ja hetki asetetaan kerran `asetaHetki()`:llä koska se on
  koko kentällä sama. **0,4 ms samalle 3 400 pisteelle — 138× halvempi.**
- Piste vain **merkitään** laattapisteeksi (`p.laatta` = hilaväli).
  Sarja materialisoidaan vasta sille yhdelle pisteelle joka on tähtäimen
  alla. Selaimessa mitattuna: 2 451 laattapistettä, **3 materialisoitua
  sarjaa**.

**Interpolointijärjestys on kopioitava tarkalleen, ei keksittävä.**
Ensimmäinen versio interpoloi ajassa u/v-vektoreina, mikä on
yksinkertaisempaa ja väärin. Vertailu `wx()`:ään paljasti sen heti:
suurin nopeusero **1,51 m/s** ja suuntaero **54,5°**. Sääntö on:

- **paikassa** nopeus painotettuna keskiarvona, suunta yksikkövektorien
  kautta (350° ja 10° keskiarvo on muuten 180°)
- **ajassa** nopeus ja suunta erikseen, suunta lyhintä kulmatietä —
  vektorien interpolointi ajassa tekisi vastakkaisiin suuntiin
  osoittavien tuntien väliin keinotekoisen tyvenen (ks. `_lerpWind`)

Korjattuna ero `wx()`:ään on **0,0000 m/s ja 0,000°** 400 näytteellä,
myös puuskatasolla. Jos hilapolku poikkeaisi sironneesta polusta, sama
kartta näyttäisi eri asiaa sen mukaan kumpi lähde sattuu olemaan
käytössä.

### Bikuubinen, ei bilineaarinen — ja se on mitattu

Tekstuuri luetaan hilasta `kokoaHila()` + Catmull-Rom -ylösnäytteistys.
Sileään kenttään verrattuna, 1° hila, näytteet hilavälien sisältä:

| | RMS totuuteen | 2. erotus, huippu |
|---|---|---|
| `idw()` R=1,7 eps=0,30 | 0,279 m/s | 0,0166 |
| bilineaarinen | 0,169 | **0,0907** |
| **bikuubinen (Catmull-Rom)** | **0,068** | **0,0231** |

Bilineaarinen on tarkempi kuin idw mutta sen toinen erotus on
**viisinkertainen**: hilasolmuihin jää taite, joka lukee kartalla juuri
sinä rakeisuutena joka edellisessä muutoksessa poistettiin. Bikuubinen on
yhtä sileä kuin idw ja neljä kertaa tarkempi.

- **Hila kootaan erikseen, ei näytteistetä suoraan texeliin.** Kuubinen
  ydin lukee neljä solmua akselia kohti; laatan reunalla kaksi niistä
  olisi naapurilaatassa, ja reunaan leikkaaminen jättäisi näkyvän
  taitteen **joka laattarajalle**. Koottuna hilana rajaa ei ole.
- **Ydin lasketaan KAHTENA PYYHKÄISYNÄ, ei yhtenä 4×4-summana.**
  Ks. seuraava luku — tämä oli se yksityiskohta joka teki zoomista
  raskaamman kuin ennen.
- **Reiät paikataan neljällä pyyhkäisyllä**, ei lähimmän haulla. Reikiä
  syntyy vain marginaalissa (tekstuuri ulottuu näkymää laajemmalle kuin
  laatat haetaan), ja haku olisi O(reiät × solmut).

### Kartta näyttää nyt hieman tuulisemmalta, ja se on data

Oikealla ECMWF-datalla vanhan ja uuden polun ero:

| näkymä | RMS-ero | suurin | keskiarvo |
|---|---|---|---|
| z12 spotti | 0,202 m/s | 0,33 | 2,40 → 2,58 |
| z9 Suomenlahti | 0,295 | 1,07 | 1,65 → 1,77 |
| z7 Suomi | 0,443 | 2,40 | 2,21 → 2,41 |
| uloin z3,7 | 0,498 | 5,21 | 4,25 → 4,47 |

Keskituuli nousee johdonmukaisesti **5–8 %**. Se on idw:n ylipehmennyksen
poistuminen, ei virhe: tunnettua kenttää vasten uusi polku on neljä
kertaa lähempänä totuutta. Mutta se on **näkyvä muutos**, ja huiput
joita idw litisti näkyvät nyt sellaisinaan.

**`isMarine()`-pintapainotus ei ole hilapolussa.** `idw()` painottaa
naapuripisteitä sen mukaan ovatko ne samaa pintatyyppiä. Laattahilalla
väli on 0,25–1,25° eli 28–140 km, jolloin painotus ei käytännössä pure —
mutta tämä on **päätös eikä sivuvaikutus**. Jos rantaviivan kontrasti
näyttää muuttuneen, syy on tässä.

### Neljä paikkaa jotka hiljaa rikkoutuivat

Kaikki neljä löytyivät vain ajamalla, eivät lukemalla. Kaikissa oire
olisi ollut sama: kartta näyttää oikealta mutta on tyhjä tai väärä.

- **`getAllPoints()` suodatti `p.wx && p.wx.hourly`.** Laattapisteillä ei
  ole `wx`:ää, joten koko laattadatan polku olisi kadonnut — kenttä olisi
  jäänyt tyhjäksi eikä mikään olisi kertonut miksi.
- **`nearestPointToCenter()`** vaati saman. Aikajana olisi pudonnut
  lähimpään **spottiin** — Sydneyssä se olisi Suomessa.
- **`bestTimelineRef()`** vaati saman, ja se on se joka rakentaa
  `_tlTimes`in. Ilman aikajanaa `_tlTimeAt()` palauttaa nullin eikä
  `buildWindField` osaa poimia hetkeä: **kartta jää tyhjäksi jos
  säälaatat toimivat mutta rajapinta ei** — juuri se tilanne jota varten
  varasto on olemassa. Käynnistyksen `allSettled`-haara rakentaa nyt
  aikajanan jos `spotsP`-haara ei ehtinyt.
- **`WindTexture.hetki`** on pakko välittää erikseen. `buildWindField`
  saa `hourIdx`in joka voi olla eri kuin `State.currentHourIdx` — play ja
  aikajanan raahaus kulkevat murtoluvulla jota ei ole vahvistettu
  valinnaksi. Ilman tätä hilapolku näytteistäisi väärän tunnin juuri
  niissä kahdessa tilanteessa.

**Sivuvaikutus joka on korjaus:** laattapisteitä ei enää kirjoiteta
localStorageen (`_saveCache` ohittaa pisteet joilla ei ole `wx`:ää).
3 400 pisteen sarjat JSONina ylittivät kiintiön, jolloin
`_pruneOldCache()` pyyhki puolet rajapinnasta haetusta välimuistista.

### `_ts()` muisti väärässä paikassa — 80 ms

Muisti asui `hourly`-oliossa, ja rajapintadatalla se oli oikein: jokainen
piste saa oman `time`-taulukkonsa. Säälaatoilla ne eivät ole yksi
yhteen — `wx()` palauttaa uuden `hourly`-olion joka pisteelle, mutta
`time` osoittaa kaikilla samaan jaettuun `_ajat`-taulukkoon. Muisti ei
osunut kertaakaan.

Uloimmassa näkymässä se oli **337 000 `new Date()` -kutsua** ja
`buildWindField` 84 ms; lämpimänä sama työ on 3,9 ms. Korjaus on WeakMap
**taulukon** päällä, jolloin molemmat tapaukset menevät samalla
säännöllä.

### `State.dpr` oli 3, vaikka kommentti sanoi 2

`initCanvases()`:n yläpuolella on kymmenen rivin perustelu sille miksi
partikkelicanvas piirretään enintään 2× tarkkuudella, mittaus mukaan
lukien (19 → 24 fps). Rivi sanoi `Math.min(3, ...)`. iPhonella canvas oli
siis 3,01 Mpx dokumentoidun 1,34 Mpx:n sijaan.

Sama luokka virhettä kuin Syne-fontti aikanaan: **dokumentaatio kuvasi
päätöksen jota koodi ei toteuttanut.** Kun tähän tiedostoon kirjoittaa
mittauksen, tarkista että rivi vastaa sitä.

### `window.FS` mittausta varten (`?perf=1`)

Kaikki moduulit ovat saman skriptilohkon `const`-sidoksia, eli konsolista
tai automaattisesta testistä niihin ei pääse käsiksi lainkaan. Se tekee
juuri sen tarkistuksen mahdottomaksi jota tämä tiedosto vaatii — sivu voi
näyttää oikealta samalla kun kenttä on tyhjä tai tekstuuri väärässä
tarkkuudessa.

Mittauspaneelin portin takana (`?perf=1`) viedään nyt
`window.FS = { State, WindTexture, Saalaatat, ViewportGrid, ColorRamp,
PerfTracker, buildWindField, idw }`. Tuotantopolussa globaaliin
nimiavaruuteen ei viedä mitään — tarkistettu: ilman kytkintä
`typeof window.FS === 'undefined'`.

Selaintarkistus jonka tämä mahdollistaa (preview-build, api estetty,
laatat tarjoiltuna `context.route`n kautta):

```
ensilataus     kenttä 506 pistettä, askel 1, tekstuuri 224x491,
               NaN 0, läpinäkyviä pikseleitä 0,0 %, dpr 2,
               canvas 786x1704, lähde "ECMWF IFS 0,25° · esilaskettu"
zoom ulos 3    kenttä 2 416, tekstuuri 182x411
zoom z11       kenttä 2 451, tekstuuri 280x607
aikajana +30h  hetki siirtyy oikein, kenttä ennallaan
virheitä       0
```

### Mitä tästä EI kannata päätellä

- **Ajanmittaus tässä kontissa on epäluotettavaa.** Ensimmäinen vertailu
  antoi hilapolulle 2,9–6,7× nopeutuksen; kun sama ajettiin toisin päin,
  uusi polku näytti *hitaammalta*. Luvut seurasivat järjestystä eivätkä
  polkua. Yllä olevat luvut on mitattu lämmityksellä (10 kierrosta),
  **vuorotellen A/B/A/B** ja mediaanina, ja kontrolli toisin päin täsmää.
  Jos mittaat uudelleen, tee sama.
- **Tekstuurin rakennus yksin ei ole se iso voitto** (9,4 → 4,4 ms).
  Voitto tulee siitä että pistekohtainen purku ja `_ts`-vika katosivat.
  Jos joku optimoi vain `WindTexture.build`ia, hän optimoi väärää asiaa.
- **Ruutunopeutta ei ole mitattu laitteella.** Kaikki yllä on CPU-työtä
  pöytäkoneella. Kuinka paljon tämä tuntuu iPhonella, on vielä auki.

## Zoom raskaampi kuin ennen — kaksi vikaa hilapolussa

Hilalähtöinen kenttä oli levossa nopeampi mutta **eleen aikana
raskaampi**, ja käyttäjä huomasi sen ennen kuin mikään mittari huomasi.
Vikoja oli kaksi, ja molemmat syntyivät samasta väärinkäsityksestä:
sironneen ja hilapolun kustannus on eri paikassa.

```
sironnut   kallis osa on SOLMUT (idw), täyttö on aina täysi
hila       solmu on lähes ilmainen (tavujen luku), kallis osa on TÄYTTÖ
```

### 1. `coarseStep` ei tehnyt mitään

`_heatmapCatchUp` pyytää eleen aikana karkeaa rakennusta
(`SCRUB_STEP` 6). Sironneessa polussa se harventaa `idw()`-kutsut
36:nteen osaan. Hilapolku otti parametrin vastaan ja **jätti sen
huomiotta**: jokainen eleen aikainen kiinniottorakennus tehtiin täydellä
tarkkuudella.

Mitattuna nipistyksessä (4× kuristus, DPR 3, vuorotteleva A/B):

```
                        eleen aikainen rakennus
vanha (idw), STEP 6              79,5 ms
hilapolku, STEP jätetty huomiotta 137,7 ms
```

Korjaus: hilapolussa sama lippu harventaa **texeleitä**, ei solmuja —
sivut jaetaan `STEP / COARSE_STEP`:llä. Eleen aikana texel on kaksi
kertaa leveämpi.

**Se on vähemmän karkeaa kuin vanha polku oli**, ei enemmän: vanha
interpoloi eleen aikana 12 CSS px:n ruuduissa lineaarisesti, tämä
4 px:n texeleissä kuubisesti. `zoomend` ja `moveend` rakentavat tarkan
version heti eleen jälkeen, ja `askel`-velka ohjaa sen kuten ennenkin —
siksi `this.askel = STEP` molemmissa polissa, ei `1`.

### 2. Kuubinen ydin laskettiin yhtenä 4×4-summana

Tämä oli isompi ja se koskee myös lepotilaa. Suoraan laskettuna jokainen
texel lukee 16 solmua kummastakin kentästä. Ydin on kuitenkin
**separoituva**, ja x-interpolointi riippuu vain sarakkeesta ja
hilarivistä — hilarivejä on kymmeniä, texelirivejä satoja:

| | näytteitä | aika |
|---|---|---|
| yhtenä 4×4-summana | 2 721 328 | 7,73 ms |
| kahtena pyyhkäisynä | 709 764 | **1,98 ms** |

**3,9× halvempi.** Ero tulokseen on 9,5·10⁻⁷ m/s (välitaulukko on
Float32, eli yksi pyöristys lisää) — seitsemän kertaluokkaa rampin
kvantisoinnin alle, eikä yksikään LUT-lokero voi vaihtua sen takia.

### 3. Turhat varaukset ja keskeytymätön hilan kokoaminen

Kaksi pienempää, molemmat eleen aikana:

- **Kolme Float32Arraya ja ImageData varattiin joka rakennuksessa** —
  170 000 texelillä 2,7 MB, ja eleen aikana rakennuksia on useita
  sekunnissa. Nyt ne kierrätetään kun koko ei muutu. Molemmat polut
  kirjoittavat joka texelin, joten vanha sisältö ei voi vuotaa läpi.
- **`kokoaHila` kävi koko hilan läpi vaikka mikään ei löytynyt.** Kun
  uuden zoom-tason laattoja ei ole vielä ladattu, ele maksoi molemmat
  polut: 3 300 solmun haku (jokainen merkkijonoavaimella, koska muisti ei
  osu kun mitään ei löydy) ja sitten sironnut polku päälle. Nyt raja
  annetaan `kokoaHila`lle ja se keskeyttää heti sen ylityttyä.

### Mitattu lopputulos

Nipistys ulos, 4× kuristus, DPR 3, **neljä vuorottelevaa kierrosta**,
mediaani:

| | eleen rakennus | texeleitä | nipistys yht | pahin ruutuväli |
|---|---|---|---|---|
| vanha (idw) | 79,5 ms | 170 240 | 522 ms | 533 ms |
| vain separoituva | 45,8 ms | 170 240 | 396 ms | 433 ms |
| **separoituva + harvennus** | **36,1 ms** | 42 560 | **194 ms** | **383 ms** |

Separoituva yksin riittäisi jo kumoamaan regression samalla
texelimäärällä ja täsmälleen samalla kuvalla. Harvennus pidettiin, koska
se on eleen aikaista laatua koskeva päätös jonka sovellus on jo tehnyt
(`SCRUB_STEP` on olemassa juuri tätä varten) ja koska se on mitattuna
vähemmän karkeaa kuin se mitä se korvaa.

### Mittaustapa — ja miksi kolme ensimmäistä ajoa oli roskaa

Yksittäinen ajo tässä kontissa **ei kelpaa**. Sama koodi antoi eleen
aikaiselle rakennukselle 137,7 ms ja 280,9 ms peräkkäisillä ajoilla, ja
lepotilan ruutunopeus heilui 2,2 ja 6,8 fps välillä ilman että mitään
muuttui. Kolme ensimmäistä johtopäätöstä olisivat olleet vääriä.

Toimiva asetelma:

- **Kolme buildia rinnakkain omissa porteissaan**, ja sama harness ajaa
  ne **vuorotellen** — järjestys ei saa selittää eroa.
- **Neljä kierrosta, mediaani.** Raakaluvut tulostetaan, jotta hajonnan
  näkee: `[72,4  98,3  79,5  52,4]` on vielä kelvollinen, mutta yhdestä
  luvusta ei voi päätellä mitään.
- **`WindTexture.build` kääritään** ja mitataan sen oma kesto sekä
  `cols × rows`. Texelimäärä on se joka kertoo kumpi polku ajoi — pelkkä
  `askel` ei enää erota niitä, koska molemmat merkitsevät saman luvun.
- Vanhan version buildiin on lisättävä `window.FS` käsin (`?perf=1`
  -paneelin kohdalle), muuten sitä ei voi mitata samalla mittarilla.
