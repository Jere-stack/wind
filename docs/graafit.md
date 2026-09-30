# Graafit ammattitasolle — strategia

Pyyntö (30.9.2026): *"Seuraavaksi haluan kaikista graafeista todella
ammattimaisia ja intuitiivisia joka laitteella. Esim. työpöydällä graafia
ei voi liuttaa hiirellä eri kohtaan. Lisäksi puhelimella pitäisi saada
näppärämmäksi ja ammattimaiseksi näkymää eli voisi sormella liuttaa
graafia pitkin ja siinä näkyisi suoraan mikä on tuuli. Lisäksi kun zoomaa
lähemmäksi niin graafin pehmennystä voisi miettiä mikäli se on tavallista
muissa samanlaisissa sää apeissa. Keskity myös erityisesti x ja y
akseleiden tietoihin että toimivat joka zoomauksella luontevasti ja niissä
on tarpeeksi dataa pienilläkin zoomeilla. Tee ammattimainen strategia
graafimaailman parantamiseen apissa ja tee suositus. Minä päätän mennäänkö
sitten suosituksella."* (Kirjoitusvirheet korjattu.)

**Tila:** toteutettu 30.9.2026 (käyttäjän päätös: "implementoidaan kaikki
kohdat", suositus kaikkiin P-kohtiin): **V1–V6**. V7 (kartta seuraa
skrubia) jätettiin pois, koska P3:n suositus on ettei kartta seuraa
(valinta nostossa). Strategia on alla sellaisenaan päätöksen pohjana;
mitä tehtiin, mitattiin ja missä toteutus poikkesi strategiasta, on
luvussa **10. Toteutus ja mittaukset**.

> Osa FoilSpotin muistiinpanoja. Hakemisto ja säännöt ovat `CLAUDE.md`:ssä.
> Tämä rakentuu `docs/spottikortti.md`:n V8–V10:n päälle (yksi
> kaaviomoottori, kääre, kiinteä y-akseli, venytys) — lue ne ennen kuin
> toteutat mitään täältä. Sovelluksen lukitut kaaviosäännöt, joihin tämä
> koskee, on lueteltu luvussa 8.

---

## 1. Tiivistelmä

**Diagnoosi.** Kaaviomoottori on jo hyvä *piirtäjä* (yksi kieli, väri
korkeudesta, kiinteä y-akseli, venytys, päällekkäisyystarkistus). Puutteet
ovat *vuorovaikutuksessa* ja *akselien tiedossa*, ja ne ovat mitattavissa:

1. **Hiirellä kaaviota ei voi liikuttaa lainkaan.** Veto 180 px → 0 px
   vierityksen muutosta; pystyrulla 0 px; vierityspalkki on piilotettu
   (`scrollbar-width: none`) eikä mikään kerro että kaavio jatkuu sivuille.
   Vain Shift+rulla ja kosketuslevyn vaakaele toimivat (240 px / 240 px).
2. **Kosketuksella luku tulee vasta napautuksesta.** Veto on natiivi
   vieritys, napautus valitsee tunnin. Sormi ei voi kulkea kaaviota pitkin
   niin että lukema seuraisi — juuri se mitä pyydettiin.
3. **Käyrä kuvaa dataa jota ei ole.** Jokaisen tunnin piste on käyrällä
   pieni tasanne (`_polut`: vaakasuora tangentti joka pisteessä), joten
   tasaisesti nouseva rintama piirtyy uurteisena portaikkona. Vertailu datan omaan
   murtoviivaan: RMS 0,59–0,74 px vs 0,23–0,26 px monotonisella kuutiolla.
   Zoomatessa lähelle (30 px/h) portaat näkyvät; samalla ruudulla ei ole
   merkkiäkään siitä mitkä pisteet ovat mallin omia ja mitkä väliin
   interpoloituja.
4. **X-akseli ei kerro missä ollaan lähizoomissa.** Päivämäärä on päivän
   *keskellä* (klo 12), joten 12 h:n zoomilla **43,2 % vierityskohdista
   ei näytä yhtään päivämäärää**. Loitonnettaessa (≥ 10 vrk) tuntirivi
   katoaa kokonaan (0 tuntilukua; jäljelle jää vain päiväraja), ja
   viikonpäivä putoaa pois ("30.9. 2.10.").
5. **Y-akselilla on liian vähän tietoa ja se ei tiedä yksikköään.**
   Kortilla aina samat kolme lukua (10, 20, 30 kts) kaikilla zoomeilla;
   **pienessä kaaviossa vain yksi** (rivi ja laaja puhelimen vaakatilassa:
   pelkkä "20"); yksikköä ei ole akselilla lainkaan; ylälaita on
   mielivaltainen näyttöyksikössä (16 m/s = 31,1 kts). Asteikko
   sovitetaan koko sarjaan (nyt −6 h → loppu), ei ruudulla olevaan jaksoon —
   se on mekanismi, jonka vaikutus oikealla datalla mitataan V5:n
   ensimmäisenä tehtävänä.

**Suositus: kuusi vaihetta tässä järjestyksessä** — V1 käyrä, V2
työpöytä-interaktio, V3 kosketus (pidä ja liu'uta), V4 x-akseli, V5 y-akseli,
V6 huippulaput ja saavutettavuus. V7 (kartta seuraa skrubia) on valinnainen.
Suosituksen ydin kolmessa lauseessa:

- **Kosketus: pidä ja liu'uta**, ei "veto = lukema". Veto säilyy
  vieritysnä (käyttäjän 27.9. valinta: "graafia pystyy kivasti
  rullaamaan"), ja lukema syttyy kun sormi on ollut paikallaan ~200 ms tai
  kun se alkaa valitun tunnin kursorista. Tekninen toteutettavuus on
  mitattu oikeilla kosketustapahtumilla: 16/16 elettä luokittui oikein ja
  pidon jälkeinen veto ei vieritä lainkaan (luku 2.2).
- **Hiiri: veto vierittää** (`cursor: grab`), leijuminen lukee, klikkaus
  valitsee, ja kaavion kulmaan tulee zoom-napit ja työpöydällä
  navigaattorikaista, jotta "missä ollaan" näkyy.
- **Akselit ovat tikkiportaikko, ei kolme kiinteää lukua:** päiväotsikko
  `position: sticky` (0 % vierityskohdista ilman päivämäärää), tuntirivi
  tikkeinä myös loitonnettuna, yksikkö y-akselille, "nätti" ylälaita
  näyttöyksikössä ja asteikko ikkunan mukaan kun ele loppuu.

Päätettävät kohdat ovat luvussa 5 (P1–P10, jokaiselle suositus), joten
"mennään suosituksella" riittää vastaukseksi.

---

## 2. Nykytila mitattuna (ENNEN toteutusta)

*Tämän luvun luvut ovat lähtötaso ennen V1–V6:ta; toteutuksen jälkeiset
mittaukset ovat luvussa 10.*

Kaikki alla oleva on toistettavissa: `tools/graafimittaus.mjs` (ks.
luku 7, V0). Sarja on synteettinen (2 vrk menneisyyttä + 15 vrk, tunneittain,
vuorokausi- ja pidempi aalto), koska kontista ei saa tuotannon dataa;
piirtäjä ja käärekoneisto ovat sovelluksen omat (`Tuulikaavio.piirra`,
`Aikakaavio.aseta`/`osoitin`). Kortin leveys 358 ja 372 px, näyttöyksikkö kts.

### 2.1 Akselit zoomeittain (kortti 358 px, ruudulla näkyvät tekstit)

| näkyvä aika | px/h | päivälappuja | tuntilukuja | lukuja käyrällä | y-lukuja |
|---|---|---|---|---|---|
| 12 h | 29,8 | 1 | 12 | 12 | 10, 20, 30 |
| 24 h | 14,9 | 1 | 12 | 12 | 10, 20, 30 |
| 48 h | 7,5 | 2 | 8 | 8 | 10, 20, 30 |
| 96 h | 3,7 | 4 | 8 | 8 | 10, 20, 30 |
| 168 h | 2,1 | 7 | 14 | 14 | 10, 20, 30 |
| 240 h | 1,5 | 6 | **0** | 10 | 10, 20, 30 |
| 396 h (koko sarja) | 0,9 | 9 | **0** | 8 | 10, 20, 30 |

(372 px:n paneeli antaa lähes samat luvut: 240 h 7 ja 396 h 10 päivälappua.)
Havainnot:

- Y-akseli ei reagoi zoomiin lainkaan: luvut ovat samat jokaisella
  x-zoomilla, koska asteikko on `maxV` = `ceil(max · 1,12 / 2) · 2` m/s koko
  sarjasta (nyt −6 h → loppu), alaraja 8 m/s. Ylälaita on siksi
  mielivaltainen näyttöyksikössä (16 m/s = 31,1 kts, ylin viiva 30),
  yksikköä ei ole akselilla (se on vain lukemarivin `<small>`issa), eikä
  nollaa nimetä.
- **Y-luvut kaaviotyypeittäin** (asteikko 16 m/s = 31 kts): kortti (plotH
  150) 3 lukua (10, 20, 30); **rivi** (allekkaiset mallit, plotH 84)
  **1 luku (20)**; **laaja puhelimen vaakatilassa** (plotH 120) **1 luku
  (20)**; laaja työpöydällä (plotH 420) 6 lukua. Rivillä 10 kts:n väli on
  21,9 px ja raja 22 px, eli 0,1 px vie puolet lukuja.
- Käyrän luvut ovat kiinteällä tuntivälillä ja ≥ 24 h:n askeleella
  keskipäivän arvo. Keskipäivä ei ole päivän huippu: rannikon
  merituuli huipentuu tyypillisesti iltapäivällä, joten luku sanoo
  päivästä vähemmän kuin sen kolmen tunnin lukema.
- Tuntirivi vaatii `askelH < 24`; siitä ylöspäin aika-akselilla ei ole
  tunti-informaatiota lainkaan (ei tuntitikkejä, ei tuntilukuja; jäljelle
  jää vain päiväraja).

### 2.2 Vuorovaikutus

| mitattu | tulos |
|---|---|
| hiiren veto 180 px vasemmalle | **0 px** vierityksen muutos |
| pystyrulla 240 kaavion päällä | 0 px |
| Shift+rulla 240 | 240 px |
| vaakarulla (deltaX 240) | 240 px |
| vierityspalkki / kursori | `none` / `crosshair` |
| päivämäärä ruudulla, osuus vierityskohdista joissa **ei yhtään**: 12 h | **43,2 %** (1 768 / 4 093) |
| sama 24 h / 48 h | 0,0 % / 0,0 % |

**Kosketus, pidä ja liu'uta (Chromium, CDP `Input.dispatchTouchEvent`,
kortti 358 px):** koe-elekuuntelija päättää *tapahtumien aikaleimoista*:
ensimmäinen yli 8 px:n liike ≥ 200 ms touchstartin jälkeen = skrubi
(`touchmove.preventDefault()`), muuten natiivi vieritys.

| ele | vierityksen muutos | päätös | skrubiliikkeet | peruttavissa | `pointercancel` |
|---|---|---|---|---|---|
| veto heti (×2 kierroksella, 4 ajoa) | 209–223 px | vieritys | 0 | – | 1 |
| pito 260 ms, sitten veto (×2, 4 ajoa) | **0 px** | skrubi | 13 / 13 | kyllä | 0 |

16 elettä / 16 oikein. Kaksi oppia tuli mitatessa, ja ne ovat suunnittelun
sääntöjä (luku 3.2): (a) *ajastimeen* perustuva päätös luokitteli
tavallisen vedon pidoksi kun pääsäie oli varattu (touchmove saapui yli
200 ms touchstartin jälkeen) — päätös pitää tehdä aikaleimoista, kuten
CLAUDE.md:n sääntö "kuristus on aikaleima, ei ruutu"; (b) ensimmäinen
CDP-ele on hidas, joten harness lämmitetään.

### 2.3 Käyrä

Rintama 3 h:n solmuista (ECMWF-varaston askel), tunnit suoralla solmujen
välissä kuten varastossa; totuus = tuo murtoviiva. Poikkeama px,
y-mittakaava 8,4 px/(m/s):

| zoom | nykyinen RMS / max | monotoninen kuutio RMS / max |
|---|---|---|
| 12 h (30 px/h) | 0,59 / 1,66 | 0,23 / 1,07 |
| 48 h (7,5 px/h) | 0,64 / 1,62 | 0,24 / 1,07 |
| 7 vrk (2,1 px/h) | 0,74 / 1,71 | 0,26 / 1,07 |

Pikselimäärinä ero on pieni; se ei ole koko, vaan *rytmi*: jokaisessa
tunnissa tasanne, ja 2,4 px:n mustejuova korostaa sitä (silmämääräinen
lähikuva: 12 h:n zoomilla jokainen tunti on pieni tasanne; 7 vrk:n
zoomilla juova näyttää uurteiselta). Monotoninen kuutio ei ylitä
naapuriensa väliä (ei keksi huippua, sama sääntö kuin nykyisen käyrän
kommentissa) eikä tee tasanteita.

### 2.4 Mitä ei ole mitattu

Ruutunopeus ja iOS:n tuntuma (kontti, CLAUDE.md). Y-asteikon sopivuus
*oikealla datalla* — sarja on synteettinen; V5:n ensimmäinen tehtävä on
mitata oikeasta ennusteesta kuinka suuri osa vierityskohdista käyttää alle
40 % piirtokorkeudesta. Kilpailevien sovellusten (Windy, Windguru, Yr, Apple
Sää) käytöstä ei ole omaa mittausta — ne kuvataan luvussa 3 yleisinä
käytäntöinä, ei tosiasioina.

---

## 3. Mitä ammattilaiskaaviot tekevät

Vertailukohtana aikasarjakaaviot yleensä (kaupankäynti- ja sääkaaviot).
Vain lightweight-chartsin kohta on tarkistettu lähteestä (issue-
keskustelut); loput on yleistietoa ja merkitty sellaiseksi.

| aihe | yleinen käytäntö | tähän sovellukseen |
|---|---|---|
| Kosketus, lukema | Vieritettävässä kaaviossa **pito aktivoi ristikon**; lightweight-charts: pito kytkee vierityksen pois ja näyttää arvot. Sen mobiili-issuet ovat silti varoitus: seurantatilassa ristikon liikuttaminen vaatii noston ja uuden painalluksen ([#830](https://github.com/tradingview/lightweight-charts/issues/830), pyyntö "quick tracking mode"), ja iPadilla kaavio liikkui ristikon sijaan ([#894](https://github.com/tradingview/lightweight-charts/issues/894)). | Pito + veto **samassa kosketuksessa**, ja natiivi vieritys estetään vasta kun pito on päätetty (luku 3.2). |
| Kiinteässä ikkunassa (ei vieritystä) | Veto = skrubi suoraan (yleistieto). | Ei sovellu: kaavio on 16 vrk pitkä ja sitä vieritetään. |
| Hiiri | Leijuminen = ristikko, veto = siirto (`grab`), rulla = zoom tai siirto, kaksoisklikkaus/napit = zoom (yleistieto). | Nyt vain leijuminen ja klikkaus. |
| Viivan muoto | **Monotoninen kuutio** (`d3.curveMonotoneX`, Steffen; sama perhe kuin Fritsch–Butland) on tavallinen valinta aikasarjoille joissa käyrä ei saa ylittää dataa (yleistieto). Catmull-Rom ylittää, vaakatangenttibezier tekee tasanteita. | Nyt tasanteet. |
| Lähizoomi | Kun pisteitä on harvassa suhteessa leveyteen, **pisteet piirretään näkyviin** (markerit), jotta erottaa datan sen interpolaatiosta (yleistieto). | Ei pisteitä lainkaan. |
| Päiväotsikko | **Tarttuva** (sticky) otsikko: nykyinen päivä pysyy näkyvissä vieritettäessä (kalenterit, aikataulukaaviot; yleistieto). | Keskitetty, katoaa. |
| Y-asteikko | Ylälaita "nätti" luku; yksikkö akselilla; TradingView-tyyppisessä automaattisessa asteikossa se sovittuu näkyvään ikkunaan. | Kiinteä koko sarjasta, yksikkö vain lukemarivillä. |

### 3.1 Suunnitteluperiaatteet tälle sovellukselle

- **G1 Kolme tapaa lukea, yksi lukemarivi.** Osoita (hiiri leijuu), pidä ja
  liu'uta (kosketus), napauta/klikkaa (valitse). Kaikki kolme päivittävät
  saman kiinteän `.en-lukema`-rivin — päätös "lukema on kiinteällä
  rivillä, ei kelluvassa laatikossa" pysyy (spottikortti.md, V8/V10).
- **G2 Liikuttaminen on aina mahdollista** jokaisella syötteellä: sormi,
  hiiri, rulla, kosketuslevy, näppäimistö.
- **G3 Akseli kertoo aina missä ollaan**: päivä, kellonaika ja yksikkö ovat
  näkyvissä jokaisella zoomilla ja jokaisessa vierityskohdassa.
- **G4 Data ei valehtele**: käyrä ei ylitä dataa, lähizoomissa näkyvät
  mallin omat pisteet, havaintoa ei pehmennetä.
- **G5 Zoom on porras eikä liukuma**: akselin sääntö on tikkiportaikko
  (luku 4.3), ja jokaisella askelmalla on oma tehtävänsä.
- **G6 Ei uutta kromia mittausta vastaan**: ei uusia kelluvia laatikoita,
  ei uusia paneeleita, ei lisäriviä ilman että se korvaa jotain.

### 3.2 Gesteiden välimiehitys (miksi pito, ja miten se tehdään oikein)

Vaihtoehdot mitattuna ja punnittuna:

| vaihtoehto | hyvä | huono | päätös |
|---|---|---|---|
| **A. Pito + veto** (suositus) | säilyttää natiivin vierityksen ja sen tuntuman; vakiintunut malli; ei uutta kromia | vaatii ~200 ms ja löydettävyyttä (vihje) | **valittu**, ja B:n oikotie mukaan |
| B. Tartu kursoriin (aloitus ±28 px valitusta kursorista = heti skrubi) | ei viivettä; löydettävä (iso pallo) | vain silloin kun kursori on ruudulla ja sormi osuu siihen | **oikotienä A:n rinnalle** |
| C. Veto = skrubi suoraan, siirto muualta | nopein lukea | **kumoaa 27.9. päätöksen** (kaavio vierii sormella); vaatii siirtoon oman navigaattorin | hylätty |
| D. Oma vieritys (`touch-action: pan-y` + oma inertia) | täysi hallinta yhdellä tilakoneella | iOS:n natiivi vierityksen tuntuma menetetään; sama ansa kuin Leaflet-paikkaukset (docs/eleet.md) | hylätty |
| E. Kiinteä ristikko keskellä, kaavio vierii alta ("reticle") | lukema aina samassa paikassa | sitoo kaavion vierityksen valittuun hetkeen → kartta piirtyy uudelleen joka ruudussa; kumoaa V8:n "vieritys ei valitse" | hylätty |

**Toteutuksen säännöt (jokainen mitattu tai johdettu repon omista opeista):**

1. **Päätös aikaleimoista.** Pito = ensimmäinen yli 8 px:n liike on
   `touchmove.timeStamp − touchstart.timeStamp ≥ 200 ms`. Ajastin saa vain
   *näyttää* pidon merkin (kursori nousee) kun sormi on paikallaan;
   päätöksen se ei tee (mitattu: ajastin luokitteli vedon väärin kun
   pääsäie oli varattu).
2. **Kosketustapahtumat eivät osoitintapahtumat** (kuten `venytys`:
   `pan-x pan-y` peruu osoittimet heti kun selain aloittaa vierityksen).
   `touchmove` non-passive, `preventDefault` vasta kun päätös on skrubi;
   ennen sitä ei kosketa mihinkään, jotta natiivi vieritys ja pohjalevyn
   pystyvieritys säilyvät.
3. **Ei `requestAnimationFrame`a skrubiin eikä reunavieritykseen**
   (WebKit voi pidättää ruutupyynnön kosketuksen ajan; CLAUDE.md,
   "VIERITYKSEN SEURANTAA EI SAA AJAA rAF:ISSA"). Skrubi kirjoittaa
   `touchmove`n sisällä, reunavieritys `setInterval(16)`llä.
4. **Reunavieritys**: kun sormi on alle 40 px:n päässä kääreen reunasta,
   `scrollLeft` liikkuu nopeudella joka kasvaa reunaa kohti (0 → ~600 px/s),
   ja kursorin aika lasketaan sormen x:stä + `scrollLeft`ista joka tikillä.
5. **Nosto = valinta.** Skrubin aikana päivittyvät vain kaavion kursori,
   lukemarivi ja tuntirivin korostus (halpaa: attribuuttikirjoituksia,
   `Aikakaavio.hover`); nostossa yksi `Ennuste.valitse` →
   `_tlValitseIdx` (aikajana, kartta ja kortti seuraavat kerran).
   Havaintokaavioissa nosto jättää lukeman 4 s:ksi kuten nyt.
6. **Ei reunaa iOS:n takaisinpyyhkäisylle**: 16 px vasemmasta reunasta ei
   aloiteta pitoa. Kahden sormen ele on aina venytys (`venytys` omistaa
   sen), ja toinen sormi kesken skrubin lopettaa skrubin.
7. **Skrubin aikana pystyveto ei vieritä korttia** (`preventDefault` on jo
   päällä) — ele on lukitus kunnes sormi nousee.
8. **Palaute**: kursorin viiva ja pallo kasvavat (pallo 4,6 → 7 px),
   lukemarivi vaihtaa `osoitettu`-tilaan ja numerot kasvavat, ja Androidilla
   `navigator.vibrate(6)` aktivoituessa. iOS:llä haptiikkaa ei ole; visuaalinen
   merkki riittää.
9. **Löydettävyys**: ensimmäisillä avauksilla (`fs_vihje_kaavio`, 3 kertaa)
   pienellä rivillä kaavion alla: "Pidä sormea kaaviolla ja liu'uta" /
   "Touch and hold the chart, then slide".
10. **Yksi tilakone** (`Aikakaavio.osoitin`): `lepo → leijuu` (hiiri) /
    `paina → vieritys | skrubi | napautus | venytys` (kosketus) /
    `paina → raahaa | klikkaus` (hiiri). Nykyinen "matka < 6 px = napautus"
    -sääntö säilyy. Syötteen tyyppi luetaan tapahtumasta (`pointerType`),
    ei media queryistä: hybridilaite on molempia.

---

## 4. Ehdotukset osa-alueittain

### 4.1 Työpöytä: hiiri, kosketuslevy, näppäimistö

- **Veto vierittää.** `pointerdown` (hiiri, painike 0) kääreessä; 4 px:n
  jälkeen `setPointerCapture`, `cursor: grabbing`, `scrollLeft = alku − dx`.
  Levossa `cursor: grab` (nyt `crosshair`; ristikko piirtyy joka
  tapauksessa kaavioon). Vedon perään tuleva klikkaus ohitetaan nykyisellä
  matkasäännöllä (matka sisältää `scrollLeft`in muutoksen). Inertia on
  P4:n toinen vaihe, ei pakollinen.
- **Rulla ei kaappaa sivun vieritystä.** Pystyrulla kaavion päällä
  vierittää korttia kuten nyt (muuten kaavio "vie" rullan ja kortti
  juuttuu). Vaakarulla ja Shift+rulla toimivat jo. Ctrl+rulla/nipistys
  venyttää (jo).
- **Zoom-napit.** Ctrl+rulla on piilossa: hiirikäyttäjä ei löydä sitä.
  `−` ja `+` (`.ikoninappi`, sama ympyrä kuin laajennusnappi) hiirilaitteella
  (`(any-hover: hover)`), askel portaikossa 12 · 24 · 48 · 96 · 168 h.
  Näppäimistö: `+` / `−`.
- **Navigaattorikaista** (vain `(pointer: fine)`): 14 px:n minikuva koko
  sarjasta kaavion alla — käyrän vaimennettu muoto, päivätikit, tänään,
  ja raahattava ikkuna. Klikkaus hyppää. Se korvaa piilotetun
  vierityspalkin ja vastaa kysymykseen "missä sarjassa olen", jonka
  kosketuksella ratkaisee sormen tuntuma ja tarttuva päiväys (4.3).
- **Näppäimistö.** `←`/`→` tunti (Shift 3 h) on jo. Lisäksi `PgUp`/`PgDn`
  ±24 h, `Home` = nyt, `End` = sarjan loppu, `+`/`−` zoom.
- **Leijuva lukema.** Nykyinen leijuminen päivittää lukemarivin ja
  ristikon. Lisäksi tuntiriviin piirtyy kursorin kohdalle **pilleri**
  ("To 14") — ei kelluva laatikko, vaan samaa perhettä kuin NYT-lappu ja
  SVG:n sisällä, ja se sanoo hetken siellä missä silmä on.

### 4.2 Puhelin ja tabletti: pidä ja liu'uta

Sääntö 3.2. Lisäksi:

- Kursorin pallo on aina näkyvä tartuntakohde: osumapinta 44 px, ja
  `touchstart` ≤ 28 px:n päässä valitusta kursorista aloittaa skrubin heti
  (B).
- Lukemarivi on kaavion yläpuolella eli sormen yläpuolella — sormi ei peitä
  sitä (siksi kiinteä rivi eikä kupla, CLAUDE.md: "kokonäytössä kupla jää
  sormen alle"). Skrubin aikana rivi on isompi (14 → 17 px numerot;
  laajassa jo 17).
- Laajassa näkymässä (`HavLaaja`, vaakatila) sama tilakone ja sama
  reunavieritys; sulkuele (alaspäin piirtoalueen yläpuolelta) ei muutu.
- iPad: kosketus kuten puhelin, osoitin (trackpad/hiiri) kuten työpöytä;
  kumpikin samalla kääreellä samaan aikaan (siksi `pointerType`).

### 4.3 X-akseli: tikkiportaikko

`askelH`-portaikko (1, 2, 3, 6, 12, 24, 48, 72, 168 h; sääntö
`a · pxH ≥ lukuVali · fs`) säilyy. Sen askelmiin kiinnitetään kolme uutta
käytöstä, jotta aika-akselilla on tietoa jokaisella zoomilla:

Rajat tulevat nykyisestä säännöstä `a · pxH ≥ 24 · fs` (kortti 358 px):
`askelH` 1 h vaatii ≥ 24 px/h, 2 h ≥ 12, 3 h ≥ 8, 6 h ≥ 4, 12 h ≥ 2, 24 h
≥ 1.

| askelma | px/h ja ikkuna (358 px) | tuntirivi | tikit | käyrällä | päiväotsikko |
|---|---|---|---|---|---|
| tarkka (`askelH` 1–2) | ≥ 12 px/h, ≤ 30 h | joka tunti / 2 h | joka tunti (3 px) | luvut + **mallin omat pisteet** | tarttuva, "La 3.10." |
| päivä (`askelH` 3–12) | 2–12 px/h, 30–180 h | 3 / 6 / 12 h | joka tunti (≥ 4 px/h) tai 3 h | luvut askeleen välein + huiput | tarttuva |
| yleiskuva (`askelH` ≥ 24) | < 2 px/h, yli 7 vrk | **ei tekstiä, vaan tikit**: 6 h (3 px), keskiyö (7 px), keskipäivä | 6 h / 12 h | **huiput ja laaksot** (4.5), ei keskipäivälukuja | tarttuva, viikonpäivä + numero, viikonloppu sävytetty, "Tänään" |

- **Tarttuva päiväotsikko.** Nyt SVG:n `<text>` päivän keskellä. Ehdotus:
  HTML-rivi kääreessä (`.ak-paivat`, koko leveys), jonka jokainen päivä on
  oma laatikkonsa ja sen `span` on `position: sticky; left: 38px`
  (y-akselin liu'un leveys + väli). Ei yhtään vieritysjuoksutusta: selain
  hoitaa, ja laatikon oikea reuna työntää otsikon pois kuten kalenterissa.
  Tavoite (mitattava): 0 % vierityskohdista ilman päivämäärää kaikilla
  zoomeilla (nyt 12 h: 43,2 %).
- **Muotoportaikko** päivän leveyden mukaan: "Su 27.9." (≥ 59 px) →
  "27.9." → "Su 27" → viikonpäivän kirjain + numero → vain maanantait ja
  kuun ensimmäiset. Nykyinen `joka`-harvennus (joka k:s päivä) korvautuu
  tällä, koska viikonpäivän kirjain ("M T K T P L S") kantaa enemmän tietoa
  kuin joka toinen päivämäärä. Englanti: "Sat 3 Oct" → "3 Oct" → "S 3".
- **Viikonloppu.** Lauantai ja sunnuntai sävytetään *päiväotsikkorivillä*
  (ei piirtoalueella: yö on jo piirtoalueella harsona ja sävy tarkoittaa
  siellä yötä). Ennustepaneelissa on jo "Arki-illat / Viikonloppu"; kaavion
  pitää kertoa sama.
- **Tunti kursorin alla**: hover/skrubi-pilleri tuntirivillä (4.1), ja
  valitun tunnin luku tuntirivillä lihavoituna.

### 4.4 Y-akseli

- **Yksikkö akselille**: kiinteän akselipäällisen (`.ak-akseli`)
  ylimmäksi pieni "kts" / "m/s" / "km/h" / "mph" / "Bft" (aalloilla "m",
  vedenlämmöllä "°C"). Nyt yksikkö on vain lukemarivin `<small>`issa.
- **"Nätti" ylälaita näyttöyksikössä.** Ylälaita pyöristetään seuraavaan
  tikkivälin monikertaan *näyttöyksikössä* (kts: 5/10, m/s: 2/5, Bft:
  seuraava kynnys) eikä m/s:n parilliseen lukuun; ylin viiva on aina
  ylälaidassa tai lähellä sitä. Data pysyy m/s:nä (CLAUDE.md: "tikit
  valitaan näyttöyksikössä ja sijoitetaan kertoimella takaisin").
- **Vähintään kaksi lukua pienessäkin kaaviossa** (nyt rivillä ja laajassa
  puhelimen vaakatilassa 1): "vähintään yksi viiva" -sääntö
  (`Tuulikaavio.piirra`) nostetaan kahteen, kun ne mahtuvat ≥ 18 px:n
  välein. Rivillä se riittää: 10 kts:n väli on 21,9 px, eli `ruutuVali`
  22 → 20 antaisi jo 10, 20, 30. Kortti ja iso laaja ennallaan.
- **Foilausraja nimetään**: `#9C8447`-väriin pieni "12" (näyttöyksikössä
  `Keli.AJETTAVA`) akselipäällykseen viivan kohdalle. Se on jo sovelluksen
  päätöskynnys; nyt sen tunnistaa vain katkoviivasta.
- **Asteikko ikkunan mukaan, kun ele loppuu** (P7). Nyt `maxV` on
  `nyt − 6 h → loppu`; ehdotus: `scrollend`in (varalla 120 ms:n
  ajastin, ei rAF) jälkeen `maxV` lasketaan näkyvästä ikkunasta ± 25 %
  marginaali, alaraja 8 m/s ja **hystereesi** (uusi piirto vain jos
  ehdotettu ylälaita eroaa nykyisestä ≥ 20 %). Vertailukelpoisuus säilyy
  koska väri on nopeuden funktio (gradientti `userSpaceOnUse` nopeudesta):
  20 kts on sama väri kummassakin asteikossa. Uusi piirto on jo olemassa
  (`venytys.paata` → `oo.piirra()`), ja `aseta` säilyttää vierityksen.
  Eleen aikana asteikko ei liiku (ei liikkuvaa akselia sormen alla).

### 4.5 Käyrät, pisteet ja pehmennys (kohta "muissa säävapeissa")

| sarja | nyt | ehdotus | miksi |
|---|---|---|---|
| ennusteen tuuli ja puuska-alue | vaakatangenttibezier | **monotoninen kuutio** | ei tasanteita, ei ylitystä (luku 2.3) |
| vertailumallit | sama | monotoninen | sama |
| havainnon keskituuli | sama | **murtoviiva** (ei pehmennystä) | mitattu 10 min / 1 min -keskiarvo, jonka vaihtelu on informaatiota; pehmennys peittäisi puuskaisuuden |
| vedenlämpö, aallot | sama | monotoninen | hitaasti muuttuvia |
| sade | pylväät | pylväät | kertymä on askel |

- **Mallin omat pisteet lähizoomissa** (`pxH ≥ 10`): pieni ontto piste
  jokaisella *mallin omalla* solmulla, ei jokaisella interpoloidulla
  tunnilla. Vaatii sarjaan `askel[i]` (tunteja seuraavaan natiiviin
  solmuun lähteen mukaan: FMI ja MET Nordic 1 h; ECMWF 1 h asti +90 h,
  3 h asti +144 h, sen jälkeen 6 h — docs/mallit.md, V5). `wxTunneittain`
  palauttaa jo `lahde[i]`:n, joten sääntö on sen jatke. Havainnoissa
  piste on jokainen raaka näyte kun px/näyte ≥ 10.
- **Juovan paksuus zoomin mukaan**: 2,4 · `lw` nyt kaikilla zoomeilla.
  Loitonnettuna (`pxH < 3`) 1,8: mitattu 7 vrk:n kuvassa paksu juova
  luki uurteisena ja peitti puuskavyöhykkeen.
- **Huippulaput ansiona, ei kellosta.** Kiinteän tuntivälin luvut
  (`lukuVali`) jäävät tarkalle ja päivätasolle. Loitonnettuna (yleiskuva)
  ja niiden lisäksi päivätasolla merkitään **paikalliset huiput ja
  laaksot prominenssin mukaan** (≥ 15 % asteikosta), ahneesti suurin
  ensin ja törmäyksen esto, samalla pikselisäännöllä kuin nykyiset luvut.
  Näin 16 vrk:n näkymässä on luku jokaisen tärkeän huipun kohdalla eikä
  vain keskipäivän arvoa. "Jakson kovin puuska saa aina lapun" säilyy.
- **Suunta**: nuolirivi säilyy; tarkassa askelmassa (`pxH ≥ 24`) nuolen alle
  ilmansuunta ("SW"/"LO") kun tilaa on.

### 4.6 Lukemarivi, saavutettavuus, suorituskyky

- **Lukemarivi** pysyy kiinteänä. Solut kaikille kaavioille samassa
  järjestyksessä (tuuli · puuska · suunta · lähde/malli · foilattavuus);
  skrubin aikana suunta saa ilmansuuntasanan.
- **Saavutettavuus**: kaavion `aria-label` kertoo yhteenvedon datasta
  (kovin tuuli ja aika, foilattavien tuntien määrä, seuraava
  foilattava ikkuna) — nyt vain "Tuuliennuste <spotti>". Nuolinäppäin
  lukee valitun hetken (`aria-live="polite"`, kuristettu). `prefers-
  reduced-motion` poistaa jo kursorin siirtymän; sama koskee asteikon
  vaihtoa.
- **Suorituskyky**: skrubi ja hover kirjoittavat vain attribuutteja ja
  transformeja (ei uutta piirtoa). Uusi piirto (zoom, asteikon sovitus)
  ≤ 20 ms (mitattu nykyisellä: kortin päivitys 7 ms, täysi rakennus
  17–18 ms). 12 h:n zoomin SVG on ~12 000 px leveä; sitä ei tarvitse
  virtualisoida, mutta V0:n mittari seuraa piirtoaikaa.

### 4.7 Laitematriisi

| laite | pääsyöte | siirto | lukeminen | valinta | zoom |
|---|---|---|---|---|---|
| puhelin | sormi | veto (natiivi) | **pito + liu'uta**, kursorista heti | napautus | kaksi sormea |
| iPad (sivupaneeli) | sormi + osoitin | veto / hiiren veto | pito + liu'uta / leijuminen | napautus / klikkaus | nipistys, napit |
| työpöytä, hiiri | hiiri | **veto**, Shift+rulla, navigaattori, nuolet | leijuminen | klikkaus | **napit**, Ctrl+rulla, `+`/`−` |
| työpöytä, kosketuslevy | kaksi sormea | vaakaele (natiivi) | leijuminen | klikkaus | nipistys |

---

## 5. Päätettävät kohdat

Jokaiselle suositus ensimmäisenä; "mennään suosituksella" = kaikki
ensimmäiset.

| # | kysymys | suositus | vaihtoehto |
|---|---|---|---|
| P1 | Kosketuksen lukema | **Pito (~200 ms) + veto, ja kursorin tartunta heti** | vain kursorin tartunta (ei viivettä, huonompi löydettävyys); veto = skrubi (hylätty, 3.2 C) |
| P2 | Mitä nosto tekee | **Valitsee tunnin** (kortti, aikajana, kartta kerran) | palauttaa edelliseen; jättää esikatseluksi |
| P3 | Kartta skrubin aikana | **Ei seuraa** (vain kaavio + lukemarivi); valinta nostossa | kartta seuraa livenä `_tlSeuraaHetkea`n kautta (V7) |
| P4 | Työpöytä | **Veto + zoom-napit + navigaattori + näppäimet**; inertia myöhemmin | veto + napit ilman navigaattoria |
| P5 | Käyrän muoto | **Ennuste ja vesi monotoninen; havainto murtoviiva** | kaikki murtoviivaksi; nykyinen |
| P6 | Mallin omat pisteet lähizoomissa | **Kyllä** (vaatii `askel`-lipun sarjaan) | ei pisteitä |
| P7 | Y-asteikko | **Sovitetaan ikkunaan kun ele loppuu** (hystereesi 20 %, alaraja 8 m/s) | kiinteä koko sarjasta (nyt); vaihdettava valitsimella |
| P8 | Viikonloppu | **Sävy vain päiväotsikkoriville** | myös piirtoalueelle (sekoittuu yöharsoon) |
| P9 | Luvut loitonnettuna | **Huiput ja laaksot prominenssin mukaan** | keskipäivän luku kuten nyt |
| P10 | Ohjevihje | **Kolme ensimmäistä avausta** | ei vihjettä (kursorin iso pallo yksin) |

---

## 6. Vaiheet

Kokoluokat: S = muutos yhdessä funktiossa, M = uusi käyttäytymiskerros,
L = uusi tilakone tai koskee useaa kaaviota. Jokainen vaihe on itsenäisesti
julkaistavissa ja mitattavissa `tools/graafimittaus.mjs`:llä (laajennetaan
vaihe vaiheelta).

| vaihe | sisältö | koko | riippuu | hyväksymiskriteeri (mitattava kontissa) |
|---|---|---|---|---|
| **V0** | Mittauspohja `tools/graafimittaus.mjs` — **tehty**; lisäksi jatkossa oikean datan y-täyttömittari | S | – | lähtötaso luvussa 2 |
| **V1** | Monotoninen kuutio (`_polut` → `_polut` + `monotoninen`), havainnolle murtoviiva, juovan paksuus, `askel[i]` ja mallin omat pisteet | S–M | – | RMS ≤ 0,25 px kaikilla zoomeilla; ylitystesti 0 rikkomusta (käyrän y aina naapureiden välillä); pisteet vain natiiveilla solmuilla |
| **V2** | Työpöytä: hiiren veto, `grab`, zoom-napit, näppäimet, navigaattori | M | – | veto 180 px → 180 ± 2 px; klikkaus ilman liikettä valitsee, veto ei; Shift+rulla ja deltaX ennallaan; pystyrulla vierittää korttia |
| **V3** | Kosketus: tilakone, pito ja veto, kursorin tartunta, reunavieritys, nosto = valinta, vihje | L | V2 (yhteinen tilakone) | 16/16 elettä oikein (luku 2.2, sekä pito- että vetoeleet) myös kuormitettuna; luku = kursorin alla oleva tunti 40/40 kohdassa; nosto kutsuu `Ennuste.valitse`a tasan kerran; pystyveto vierittää korttia, pohjalevyn sulkuele ja venytys ennallaan; 0 `pageerror`ia |
| **V4** | X-akseli: tarttuva päiväotsikko, tikit, muotoportaikko, viikonloppu, tuntipilleri | M | – | päivämäärä ruudulla 100 % vierityskohdista kaikilla zoomeilla (nyt 12 h: 56,8 %); tuntilukuja tai tikkejä ≥ 1 jokaisella zoomilla (nyt 0 kohdassa 240 h ja 396 h); päällekkäisyystarkistus (V10:n mittari) 0 |
| **V5** | Y-akseli: yksikkö, nätti ylälaita, ≥ 2 lukua pienissä kaavioissa, foilausrajan nimi, ikkunaan sovitus | M | mittaus oikealla datalla | ylin viiva = ylälaita; y-lukuja ≥ 2 rivillä ja puhelimen laajassa (nyt 1); yksikkö näkyvissä 5/5 yksiköllä; uusia piirtoja ≤ 1 per vieritysele; täyttöaste (ikkunan huippu / ylälaita) ≥ 55 % kun ikkunan huippu ≥ 8 m/s (P7) |
| **V6** | Huippulaput, ilmansuuntasana, `aria-label`-yhteenveto | M | V4, V5 | jakson kovin puuska lapulla 100 %; lappujen välinen päällekkäisyys 0; `aria-label` sisältää huipun ja ajan |
| **V7** (valinn.) | Kartta seuraa skrubia (`_tlSeuraaHetkea`) | M | V3 | ei yli 3 ms/tikki JS-aikaa (nykyisen aikajanan mittari) |

**Järjestys ja perustelu.** V1 ensin, koska se on pieni ja näkyvä ja koskee
vain `Tuulikaavio.piirra`a. V2 ja V3 ovat pyynnön ydin (hiiri, sormi) ja
jakavat tilakoneen — tee V2 ensin, jolloin V3 lisää vain kosketushaarat.
V4 ja V5 ovat akselit; V5:n kohta "ikkunaan sovitus" vaatii mittauksen
oikealla datalla ennen päätöstä (P7 pätee kunnes se on tehty). V6 viimeistelee.
Jos halutaan nopein näkyvä hyöty: V1 + V2 + V3 yhdessä sarjassa.

---

## 7. Mittauspohja ja regressiotesti (V0)

`tools/graafimittaus.mjs` (Playwright, Chromium; ei verkkoa; osoite
parametrina, `PLAYWRIGHT_MODULE` kuten savutestissä). Alun perin
mittauspohja (luvun 2 luvut), toteutuksen jälkeen regressiotesti: jokainen
rivi on `ok` tai `VIKA`, ja vika antaa poistumiskoodin 1. CI ajaa sen
savutestin perään (`Savutesti ja graafitesti`, ~30 s).

```bash
npm run build && npx vite preview --port 4173 &
PLAYWRIGHT_MODULE=/opt/node22/lib/node_modules/playwright/index.mjs \
  node tools/graafimittaus.mjs http://localhost:4173 [kuvakansio]
```

Osat: (1) akselit zoomeittain, (2) päiväys ruudulla joka vieritys-
kohdassa, (3) y-luvut kaaviotyypeittäin ja "nätti" ylälaita neljällä
yksiköllä, (4) hiiri, (5) näppäimet, zoom-napit ja navigaattori,
(6) käyrä, (7) huiput ja yhteenveto, (8) asteikon sovitus, (9) kosketus
CDP:llä. Kortin kytkentä (`__kaavio`) on sama kuin `Ennuste._piirra`ssa:
piirto, osoitin, venytys ja asteikon sovitus.

Sudenkuopat jotka löytyivät:

- **Kosketuskokeen ensimmäinen ele on hidas.** Ensimmäinen CDP-kosketus
  (kohteen haku) viivästyi niin että touchstartin ja touchmoven väli
  ylitti 200 ms ilman että "sormi" pysyi paikallaan. Harness heittää
  yhden lämmittelyeleen pois ja piilottaa muun sovelluksen (kartan
  piirtosilmukka varaa pääsäikeen); vedon luokittelu uusitaan kerran.
- **Kursorin tartunta tekee "tavallisesta vedosta" skrubin.** Testi
  joka aloitti vedon edellisen kierroksen valinnan (= sormen viimeisen
  kohdan) vierestä sai skrubin — oikein, koska kursorin ±28 px on
  tartunta-alue. Testi aloittaa vedon kursorista kauempaa.
- **`scrollend` tulee jokaisen ohjelmallisen `scrollLeft`-kirjoituksen
  perään** (hiiren veto, navigaattori, reunavieritys, testin askeleet), joten
  asteikon sovitus viivästetään ja estetään vedon aikana.
- **Vite-dev lataa sivun uudelleen kun tiedosto muuttuu** ja kaataa
  käynnissä olevan mittauksen; mittaa `vite preview`llä.
- **Piirtäjä toimii ilman sovellusta.** `Tuulikaavio.piirra` on puhdas
  funktio; mittaus ei riipu verkosta eikä laattavarastosta. Oikean
  spotin kortti tarkistetaan erikseen (savutesti: päiväotsikko, yksikkö,
  työkalurivi vain hiirilaitteella).

**Mitä ei voi mitata täällä:** ruutunopeus, iOS:n natiivin vierityksen
ja pidon tuntuma (Playwrightin WebKit ei osaa touchmovea; CLAUDE.md),
Android-haptiikka. Ne tarkistetaan laitteella: (a) pito ei laukea
vedossa, (b) pito ei vierittänyt korttia, (c) reunavieritys ei karkaa,
(d) iOS:n takaisinpyyhkäisy reunasta toimii, (e) tarttuva päiväotsikko
pysyy paikallaan iOS:n vierityksessä.

---

## 8. CLAUDE.md:n säännöt jotka tämä koskee

Hyväksyntä tarkoittaa että nämä päivitetään samassa muutoksessa:

- **"VAAKAVETO ON AINA VIERITYSTÄ, TUNTI VALITAAN NAPAUTUKSELLA"**
  (Kaaviot ja laaja näkymä) — täydentyy: pito + veto lukee, nosto valitsee.
  Vaakaveto ilman pitoa on yhä vieritystä.
- **"Y-AKSELI ON KIINTEÄ JA KAAVIO VIERII SEN ALTA"** — pysyy (päällys);
  **"ENNUSTEEN ASTEIKKO ON NYKYHETKESTÄ (−6 h) ETEENPÄIN"** — korvautuu
  ikkunaan sovituksella (P7) ja säilyttää perusteensa (menneisyyden myrsky ei
  saa litistää ennustetta: ikkuna, ei sarja).
- **"KAAVION LUKEMA ON KIINTEÄLLÄ RIVILLÄ, EI KELLUVASSA LAATIKOSSA"** —
  pysyy. Tuntiriville tuleva pilleri on SVG:n sisällä ja samaa perhettä
  kuin NYT-lappu, ei laatikko lukeman päällä.
- **"KAIKKI AIKASARJAKAAVIOT OVAT YKSI MOOTTORI"** — pysyy; kaikki
  ehdotukset ovat moottorin parametreja tai `Aikakaavio`n käyttäytymistä,
  ei viidettä piirtofunktiota.
- **"LEIJUVA OSOITIN VAIN `(any-hover: hover)`-LAITTEELLA"** ja
  **"KAKSI SORMEA VENYTTÄÄ"** — pysyvät; tilakone omistaa molemmat.
- **"VIERITYKSEN SEURANTAA EI SAA AJAA `requestAnimationFrame`issa"** —
  koskee suoraan skrubia ja reunavieritystä (3.2, säännöt 1 ja 3).

---

## 9. Mitä EI ehdoteta

- **Veto = skrubi** vieritettävässä kaaviossa (kumoaa käyttäjän 27.9. valinnan).
- **Omaa inertiaa kosketukselle** tai `touch-action: pan-y` -kaappausta
  (iOS:n tuntuma; sama ansa kuin Leaflet-paikkaukset).
- **Kiinteää ristikkoa keskellä** (sitoo vierityksen kartan piirtoon).
- **Asteikon liikuttamista eleen aikana.** Y-asteikko sovitetaan vasta kun
  ele on loppunut; liikkuva akseli sormen alla lukee huteralta.
- **Catmull-Rom-käyrää** (ylittää datan) tai `curveBasis`ta (ei kulje
  pisteiden kautta).
- **Kelluvaa työkaluvihjettä** (sääntö säilyy).
- **Pehmennystä havaintoon.** Mitattu keskiarvo on data; pehmennys piilottaisi
  sen mitä kaavio on tehty näyttämään.
- **Uutta viikon-/päiväyhteenvetoriviä aikajanalle** (aikajanan
  päivälapun tuulikaista poistettiin tarkoituksella, CLAUDE.md).
- **Virtualisointia** ennen kuin mittari näyttää piirtoajan kasvavan.

---

## 10. Toteutus ja mittaukset (30.9.2026)

Kaikki kuusi vaihetta toteutettiin suosituksella (P1–P10 = ensimmäinen
vaihtoehto). Mittaukset: `tools/graafimittaus.mjs` (synteettinen sarja,
kaikki rivit `ok`, neljä perättäistä ajoa läpi) ja oikean spotin
(Lauttasaari) kortti puhelimella ja työpöydällä (`vite preview`,
Chromium). Ruutunopeutta ja iOS:n tuntumaa ei voitu mitata.

### 10.1 Ennen ja jälkeen

| mittari | ennen | jälkeen |
|---|---|---|
| hiiren veto 180 px | 0 px | 180 px |
| päivämäärä ruudulla, osuus kohdista joissa ei yhtään (12 h zoom) | 43,2 % | **0 %** (12 / 24 / 48 / 168 h) |
| tuntitietoa aika-akselilla 240 h ja 396 h zoomilla | 0 | 49–69 tikkiä + maanantain päivämäärät |
| y-luvut, rivi ja laaja puhelimen vaakatilassa | 1 | 3 (kortti 3–4) foilausraja mukaan lukien |
| yksikkö y-akselilla | ei | kts / m/s / km/h / bft / m |
| ylälaita näyttöyksikössä | mielivaltainen (31,1 kts) | pyöreä (5 kts, 2 m/s, 10 km/h; bofori: kynnys) |
| käyrän RMS datan omasta murtoviivasta (12 / 48 / 7 vrk) | 0,59 / 0,64 / 0,74 px | 0,23 / 0,24 / 0,26 px, ylityksiä 0 |
| kosketus: pito + veto / veto (CDP) | ei skrubia | 16 + 16 elettä oikein, nosto valitsee kerran |
| tavallinen veto pito-eleen vieressä | – | luokittuu vedoksi, skrubi vain ≥ 200 ms tai kursorin tartunnasta |
| kortin piirto (`Ennuste._piirra`, W ≈ 2 700 px) | – | 14 ms |

### 10.2 Asteikko ikkunaan — oikea ennuste

Lauttasaari, puhelin, 48 h ruudulla. Täyttöaste = ikkunan huippu (tuuli
tai puuska) / ylälaita:

| vierityskohta | ikkunan huippu | vanha ylälaita | uusi ylälaita | täyttö vanha → uusi | piirtoja |
|---|---|---|---|---|---|
| alku | 10,5 m/s | 24 | 12,9 | 44 % → **81 %** | 1 |
| 25 % | 8,7 | 24 | 12,9 | 36 % → **68 %** | 0 |
| 50 % | 15,1 | 24 | 20,6 | 63 % → 73 % | 1 |
| 75 % | 21,1 | 24 | 25,7 | 88 % → 82 % | 1 |
| 100 % | 18,2 | 24 | 25,7 | 76 % → 71 % | 0 |

Tyynillä jaksoilla käyrä käyttää lähes kaksinkertaisen osan korkeudesta;
myrskyikkunassa täyttö laskee hieman (nätti yläraja ja ± 25 %:n
marginaali), mutta arvo ei koskaan leikkaudu. Vierityskohdan vaihto
maksaa enintään yhden piirron, eikä kesken vierityksen piirretä (8 askelta
40 ms välein: 0 piirtoa). Synteettisellä sarjalla: 12,9 → 30,9 m/s → takaisin,
yksi piirto kumpaankin suuntaan.

### 10.3 Missä toteutus poikkesi strategiasta

- **V7 jätettiin pois** (P3: kartta ei seuraa skrubia).
- **Ilmansuunnan sana on lukemarivin tuulisolussa, ei nuolen alla**
  kaaviossa ("3,8 kts ↑ E"): nuolen alle 12 px:n rivi olisi kasvattanut
  kaavion korkeutta zoomin mukana (nuolirivi 20 → 31 px), ja kortin
  sisältö olisi hypännyt joka venytyksen lopussa.
- **Valitun tunnin luku ei ole lihavoitu tuntirivillä.** Tuntipilleri
  (hover ja skrubi) kertoo hetken siellä missä silmä on; valittu tunti
  näkyy kursorista ja lukemariviltä.
- **Navigaattori vain kortissa, ei laajassa** (laatikon korkeus lasketaan
  kaaviolle); laajan otsikossa on omat zoom-napit.
- **Asteikon sovitus vain tuulikaavioissa** (ennuste ja havainto, kortti ja
  laaja). Vedenlämpö ja aallot käyttävät datapohjaista asteikkoaan.
- **Foilausrajan luku syrjäyttää viereisen ruudukon luvun** (alle
  11·fs px:n päässä): kortilla ruudukon luku 10 jää pois kun foil-luku 12
  on sen vieressä; viiva jää. Y-akselilla on silti aina vähintään kolme
  lukua foil mukaan lukien.
- **Loitonnettuna "M"-kirjaimen viikonpäivälappu** — päivämäärä tulee
  maanantaille tuntiriville (ei lappuun), koska 21,6 px:n päivälaatikkoon
  ei mahdu "S 27".
- **Luvut ovat huippuja vain ennusteella** (`!ikkunaLuvut`); havainnon
  ikkunaluvut ja "jakson kovin puuska saa aina lapun" ennallaan.

### 10.4 Uudet säännöt ja niiden perustelut

Ne on kirjattu CLAUDE.md:hen (Kaaviot ja laaja näkymä): pito + veto ja
aikaleimapäätös, hiirityökalurivi ja näppäimet, monotoninen käyrä ja
mallin omat pisteet, tarttuva päiväotsikko ja tuntitikit, ikkunan
mukainen asteikko, y-akselin yksikkö ja foil-luku, huiput ja
saavutettava yhteenveto.

### 10.5 Tarkistettavaa laitteella

1. iPhone: pito 200 ms tuntuu luontevalta, veto heti vierittää, pito ei
   laukea vierityksen alussa, ja pito ei vieritä korttia (WebKit:
   `touchmove.preventDefault()` vain pidon jälkeen).
2. iPhone: tarttuva päiväotsikko pysyy paikallaan (`position: sticky`
   vaakavierityksessä, `-webkit-sticky`-etuliite mukana).
3. Työpöytä: hiiren veto tuntuu tartunnalta; navigaattorin raahaus ei
   piirrä kaaviota uudelleen kesken vedon (asteikon sovitus odottaa).
4. Kaikki kosketuslaitteet: reunavieritys (sormi kaavion reunassa) ei karkaa.


### 10.6 Toinen erä (30.9.): ohut viiva, geometria, kupla ja lukemarivi

Käyttäjän pyyntö oli kuusi pientä muutosta. Kaikki ovat `index.html`:ssä
ja niitä vartioi `tools/graafimittaus.mjs` (osa 10 ja osa 9:n lisäykset).

1. **Ohuempi tuuliviiva.** `juovaW` 2,4 / 1,8 → 1,7 / 1,3 (kortti / tunti
   < 3 px). Mitattu paksuin musta viiva 1,7 px; testi vaatii ≤ 1,8.
2. **Pystyviiva ei jää vierityksen jälkeen.** Syy: pito sytytti kursorin ja
   pallon (`merkki(true)`), ja kun selain vei eleen vierityksenä, mikään ei
   sammuttanut niitä — merkki vieri kaavion mukana. Korjaus: `peruMerkki`
   touchmovessa, kääreen `scroll`-turvaverkossa ja `lopeta`ssa. Mitattu
   CDP:llä: pito 320 ms → merkki näkyy, `scrollLeft += 40` → merkki pois,
   nosto → pois; nopea veto ei jätä mitään.
   **Sivulöytö:** SVG:n `visibility="visible"` lapsessa voittaa vanhemman
   `hidden`in, joten hover-ryhmän piilotus ei koskaan piilottanut palloa
   (eikä nyt kuplaa tai mallipisteitä). Testi mittasi ryhmän attribuuttia
   ja meni siksi vihreäksi; se lukee nyt laskettua näkyvyyttä jokaiselta
   osalta (0 näkyvää osaa osoittimen lähdettyä; ensimmäinen korjaus jätti
   vielä neljä kuplan tekstiriviä, koska niillä oli sama `visible`).
3. **Kellonaika ja päivämäärä graafin alle, tuulen suunta ylös.** Geometria
   ylhäältä alas: lähde, nuolirivi, plotti, tuntirivi, päiväotsikko, sade,
   lämpö. Mitattu (kortti, ei lähdettä): `ylaY 0`, `y0 20` (= nuoliH),
   `tuntiY = pohja`, päiväotsikon `top` = `paivaY`; tuntilukemia plotin
   alla 68 ja ylhäällä 0. Allekkain-asussa aika-akseli vain alimmalla rivillä.
4. **Lukema pallon viereen — myös vertailumalleille.** Kupla SVG:n
   sisällä (`data-tk-kupla`): pääarvo, puuska ja suunta sekä jokainen
   kaaviossa oleva malli omalla värillään ja väripiste mallin käyrälle.
   Mitattu: kupla 24 px pallosta (kupla 434–533, pallo 410), ruudun
   sisällä; oikeassa reunassa se kääntyy vasemmalle (518–610, pallo 634);
   pystysuunnassa plotin sisällä (85–149 / 20–170). Kupla käyttää
   `Units.fmt`-tarkkuutta kuten rivi — ensimmäinen versio käytti
   huippulappujen kokonaislukuja ja näytti "ECMWF 7" rivin "6.5":n vieressä.
5. **Lukemarivi.** Aika (päivä pienellä, kellonaika lihavana), iso pääluku
   (22 px) suuntanuolineen, puuska, ja vertailumallit omalla rivillään
   väripisteellä hiusviivan alla. Ei keli-chippiä: hero sanoo päätöksen
   kerran. Rivin korkeus ei riipu mallien määrästä, koska mallit ovat
   omalla rivillään.
6. **Kupla jokaisessa kaaviossa** (ennuste, havainto, vedenlämpö, aallot;
   kortti ja laaja): `g.kupla` tulee `Tuulikaavio.piirra`sta, ja muut
   kaaviot antavat oman `luku`-funktionsa.

**Mitä ei tehty:** kupla ei kata sormen kohdalla olevia lukuja
(24 px:n siirto) mutta peittää alleen huippulappuja osoitettaessa; se on
tietoinen hinta ja sama kuin missä tahansa ammattimaisessa kaaviossa.
**Tarkistettavaa laitteella:** kuplan sijainti oikealla peukalolla
(kääntyy vasemmalle) ja vasemmalla peukalolla iPhonella; lukemarivin
korkeus 390 px:n leveydellä kun mallit on valittu (tarkistettu vain
Chromiumilla 348 px:n kortilla).
